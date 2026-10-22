// Save/Load persistence layer
//
// The engine's save manager owns the save slot: its version and migrations,
// compression, and protecting a slot whose load failed. Game state rides it
// as one opaque blob in a single persistent ref, flushed before every save
// and restored after every load. Settings and achievements keep their own
// localStorage keys, so a hard reset leaves them, and are written with every
// save.

import { toRaw } from 'vue'
import {
  persistent,
  seedRNG,
  type SerializedScopeStack,
  type Graph,
  type SerializedGraph,
  type Serializable,
} from '@open-loop/engine'
import type { Package, Wire } from './types'
import { createInitialState } from './config'
import {
  engine,
  gameState,
  graph,
  rootIdRef,
  resetGraphAndStack,
  stack,
  syncEcosystemTier,
  syncIdCountersFromGraph,
  userSettings,
} from './state'
import { serializeAchievements, deserializeAchievements } from './achievements'
import { resetMomentumState } from './mutations'
import { clearCascadeQueue } from './cascade'
import { resetCrossPackageState } from './cross-package'
import { resetPhysicsState } from './physics'

const SETTINGS_KEY = 'heaviest-objects-settings'
const ACHIEVEMENTS_KEY = 'heaviest-objects-achievements'

// The save as it stood before the engine owned it: raw JSON of a SaveBlob
// plus this version, imported into the engine slot once.
const LEGACY_SAVE_KEY = 'heaviest-objects-save'
const LEGACY_SAVE_VERSION = 3

interface SaveBlob {
  state: typeof gameState
  rootId: string | null
  graph: SerializedGraph<Package, Wire>
  scope?: SerializedScopeStack
}

// Set when a stored blob fails to restore. Saves then leave the blob ref as
// loaded, so every write puts the player's save back rather than the fresh
// game standing in for it.
let restoreFailed = false

engine.use({
  id: 'save',
  install(ctx) {
    // Typed as Serializable: the game's interfaces lack the index signatures
    // Serializable requires, though the blob is plain JSON. Opaque, so the NaN
    // walk over the whole graph buys nothing.
    const blob = persistent<Serializable>(null, { id: 'blob', checkNaN: false })
    ctx.onSave(() => {
      if (!restoreFailed) blob.value = snapshotGame() as unknown as Serializable
      saveSettings()
      saveAchievements()
    })
    ctx.onLoad(() => {
      if (blob.value === null) return
      // A copy, so the live graph never aliases what a failed restore keeps.
      const data = structuredClone(toRaw(blob.value)) as unknown as SaveBlob
      if (!restoreGame(data)) restoreFailed = true
    })
  },
})

function relinkShadowData(g: Graph<Package, Wire>): void {
  for (const [nodeId, parentNode] of g.nodes) {
    const child = g.getChildGraph(nodeId)
    if (!child) continue
    const shadow = child.getNode(nodeId)
    if (shadow && shadow.data !== parentNode.data) {
      // GraphNode.data is typed `readonly` but the engine stores a plain
      // object — overwrite the reference so cascade-owner mutations remain
      // visible across both views.
      ;(shadow as { data: Package }).data = parentNode.data
    }
    relinkShadowData(child)
  }
}

/** Recompute scope-state labels from leaves up, so parent recalcs see
 *  cached child states rather than `undefined`. The cache is cleared on
 *  load, so this rebuilds it for every populated scope. */
function rebuildScopeStateCache(): void {
  function walk(path: string[]): void {
    let g: Graph<Package, Wire> = graph
    for (const id of path) {
      const child = g.getChildGraph(id)
      if (!child) return
      g = child
    }
    const ownerId = path[path.length - 1]
    for (const [id] of g.nodes) {
      if (path.length > 0 && id === ownerId) continue
      if (g.getChildGraph(id) !== null) {
        walk([...path, id])
      }
    }
    if (path.length > 0) {
      stack.recalculateAt(path)
    }
  }
  walk([])
}

function resetTransientState(): void {
  gameState.cascade = {
    active: false,
    scopePackageId: null,
    pendingSpawns: [],
    lastSpawnTime: 0,
    spawnInterval: 100,
    guaranteedCrits: gameState.cascade.guaranteedCrits ?? 0,
    scopePath: null,
    subDepQueue: null,
    compressedIndices: null,
    surgeGoldenBoost: 0,
    surgeFragmentBoost: 0,
    isStarterKit: false,
    isSecondPackage: false,
    isThirdPackage: false,
    isReactDom: false,
    deferConflicts: false,
    breathPhase: false,
    breathStartTime: 0,
  }

  gameState.automation.resolveActive = false
  gameState.automation.resolveTargetWireId = null
  gameState.automation.resolveTargetScope = null
  gameState.automation.processStartTime = 0
}

function snapshotGame(): SaveBlob {
  return {
    state: toRaw(gameState),
    rootId: rootIdRef.value,
    graph: graph.serialize(),
    scope: stack.serialize(),
  }
}

/** Rebuild the live game from a blob. False, with the graph cleared, if it doesn't restore. */
function restoreGame(data: SaveBlob): boolean {
  try {
    resetGraphAndStack()
    clearCascadeQueue()
    resetCrossPackageState()
    resetPhysicsState()
    resetMomentumState()
    graph.restore(data.graph)
    // Re-link shadow scope-owner nodes back to their parent-graph data so
    // mutations through one are visible to the other (the snapshot path
    // serialized them as separate objects).
    relinkShadowData(graph)
    if (data.scope) {
      try {
        stack.restore(data.scope)
      } catch (e) {
        console.warn('ScopeStack restore failed; resetting to root.', e)
        stack.exitToRoot()
      }
    }

    rootIdRef.value = data.rootId ?? null

    Object.assign(gameState, data.state)
    // A save can lack a stats field the run now counts; a fresh run's value fills it, so a
    // missing counter never turns the ship reward into NaN.
    gameState.stats = { ...createInitialState().stats, ...gameState.stats }

    if (!gameState.seed) {
      gameState.seed = Date.now()
    }
    seedRNG(gameState.seed)

    // Re-seed ID counters past the highest serialized id.
    syncIdCountersFromGraph()

    resetTransientState()

    rebuildScopeStateCache()

    syncEcosystemTier()

    return true
  } catch (e) {
    console.warn('Failed to restore save data:', e)
    resetGraphAndStack()
    return false
  }
}

/** Move a pre-engine save into the engine slot, once. True if it restored. */
function importLegacySave(): boolean {
  const raw = localStorage.getItem(LEGACY_SAVE_KEY)
  if (!raw || engine.saveManager?.hasSave()) return false
  try {
    const data = JSON.parse(raw) as Partial<SaveBlob> & { version?: number }
    if (data.version !== LEGACY_SAVE_VERSION || !data.graph || !data.state) {
      return false
    }
    if (!restoreGame(data as SaveBlob)) return false
  } catch (e) {
    console.warn('Failed to parse legacy save:', e)
    return false
  }
  engine.save()
  localStorage.removeItem(LEGACY_SAVE_KEY)
  return true
}

// ============================================
// ENGINE LIFECYCLE
// ============================================

/**
 * Install the engine's modules and load the save, importing a pre-engine
 * save the first time. Returns whether a game was restored.
 */
export function bootSave(): boolean {
  engine.start()
  // TODO(expansion): EngineOptions has no external-clock mode; the game loop
  // feeds processInterval from requestAnimationFrame, so the driver's timer stops.
  engine.tickDriver.stop()
  loadSettings()
  loadAchievements()
  const result = engine.load()
  if (result.success) return !restoreFailed
  return importLegacySave()
}

/** Save now. False if the write was refused or the loaded save is being kept. */
export function saveToLocalStorage(): boolean {
  const manager = engine.saveManager
  if (!manager) return false
  try {
    engine.save()
  } catch (e) {
    console.warn('Failed to save game:', e)
    return false
  }
  return !restoreFailed && !manager.isSlotProtected(manager.activeSlotId)
}

/** Delete the save, lifting any protection a failed load put on it. */
export function clearSavedGame(): void {
  engine.saveManager?.deleteSave()
  localStorage.removeItem(LEGACY_SAVE_KEY)
  restoreFailed = false
}

// ============================================
// USER SETTINGS PERSISTENCE
// ============================================

export function saveSettings(): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings.value))
  } catch (e) {
    console.warn('Failed to save settings:', e)
  }
}

export function loadSettings(): void {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      userSettings.value = { ...userSettings.value, ...parsed }
    }
  } catch {
    // Ignore invalid settings
  }
}

// ============================================
// ACHIEVEMENTS PERSISTENCE
// ============================================

export function saveAchievements(): void {
  try {
    const data = serializeAchievements()
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('Failed to save achievements:', e)
  }
}

export function loadAchievements(): void {
  try {
    const saved = localStorage.getItem(ACHIEVEMENTS_KEY)
    if (saved) {
      const data = JSON.parse(saved)
      deserializeAchievements(data)
    }
  } catch {
    // Ignore invalid achievements data
  }
}
