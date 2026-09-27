// Save/Load persistence layer
//
// Save shape (v3, post-spatial cutover):
// {
//   version: 3,
//   ...gameState fields...
//   rootId: string | null,
//   graph: SpatialGraphSnapshot<Package, Wire>,
//   scope: ScopeStackSnapshot,
// }
//
// No legacy load — older saves are dropped on version mismatch.

import {
  seedRNG,
  type ScopeStackSnapshot,
  type SpatialGraph,
  type SpatialGraphSnapshot,
} from '@open-loop/engine'
import type { Package, Wire } from './types'
import { SAVE_VERSION } from './config'
import {
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

const STORAGE_KEY = 'heaviest-objects-save'
const SETTINGS_KEY = 'heaviest-objects-settings'
const ACHIEVEMENTS_KEY = 'heaviest-objects-achievements'
const AUTO_SAVE_INTERVAL = 30000

let autoSaveIntervalId: ReturnType<typeof setInterval> | null = null

interface SaveData {
  version: number
  state: typeof gameState
  rootId: string | null
  graph: SpatialGraphSnapshot<Package, Wire>
  scope: ScopeStackSnapshot
}

function relinkShadowData(g: SpatialGraph<Package, Wire>): void {
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
    let g: SpatialGraph<Package, Wire> = graph
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

export function saveGame(): string {
  const saveData: SaveData = {
    version: SAVE_VERSION,
    state: gameState,
    rootId: rootIdRef.value,
    graph: graph.serialize(),
    scope: stack.serialize(),
  }
  return JSON.stringify(saveData)
}

export function loadGame(saveString: string): boolean {
  try {
    const data = JSON.parse(saveString) as Partial<SaveData>

    if (data.version !== SAVE_VERSION) {
      console.warn(
        `Save version ${data.version ?? 'unknown'} is incompatible with current version ${SAVE_VERSION}. Resetting.`
      )
      return false
    }

    if (!data.graph) return false

    // Reset existing state and rebuild from snapshot.
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

    if (data.state) {
      Object.assign(gameState, data.state)
    }

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
    console.warn('Failed to parse save data:', e)
    return false
  }
}

// ============================================
// LOCALSTORAGE WRAPPERS
// ============================================

export function saveToLocalStorage(): boolean {
  try {
    const saveString = saveGame()
    localStorage.setItem(STORAGE_KEY, saveString)
    saveSettings()
    saveAchievements()
    return true
  } catch (e) {
    console.warn('Failed to save game:', e)
    return false
  }
}

export function loadFromLocalStorage(): boolean {
  try {
    loadSettings()
    loadAchievements()
    const saveString = localStorage.getItem(STORAGE_KEY)
    if (!saveString) return false
    return loadGame(saveString)
  } catch (e) {
    console.warn('Failed to load game:', e)
    return false
  }
}

export function hasSavedGame(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null
}

export function clearSavedGame(): void {
  localStorage.removeItem(STORAGE_KEY)
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

export function startAutoSave(): void {
  if (autoSaveIntervalId) return
  autoSaveIntervalId = setInterval(() => {
    saveToLocalStorage()
  }, AUTO_SAVE_INTERVAL)
}

export function stopAutoSave(): void {
  if (autoSaveIntervalId) {
    clearInterval(autoSaveIntervalId)
    autoSaveIntervalId = null
  }
}
