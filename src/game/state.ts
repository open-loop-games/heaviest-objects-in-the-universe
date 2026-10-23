// Reactive game state management using Vue + Graph + ScopeStack
//
// Pattern rationale:
// - reactive() for large nested objects mutated in-place (gameState, gameConfig)
// - ref() for primitives or objects replaced wholesale (collapseState, dragState)
// - graph + stack are plain-data, vue-free; reactivity for graph reads is
//   surfaced through `graphRevision` (a ref bumped on every graph/stack event)
//
// Plain-data constraint:
// `Package` and `Wire` data inside graph nodes/edges are NOT Vue Proxies.
// Mutating fields like `pkg.state`, `pkg.size`, `pkg.installProgress`,
// `wire.conflicted`, `wire.flowProgress`, etc. does not trigger Vue updates
// and does not bump `graphRevision`. Per-frame readers (the Pixi renderer,
// physics, the loop) are fine because they re-read fresh each tick. Vue
// computeds and template bindings that depend on these fields will silently
// desync. If you need a UI binding that reacts to per-package state, route
// it through an event-driven update or compute it from `graphRevision` +
// fresh graph traversal — do not bind directly to `pkg.X` / `wire.X`.

import { reactive, ref, computed, type ComputedRef, type Ref } from 'vue'
import {
  createEngine,
  createGraph,
  createScopeStack,
  persistent,
  seedRNG,
  type Persistent,
  type ScopeStack,
  type ScopeStatus,
  type Graph,
} from '@open-loop/engine'
import {
  type GameState,
  type GameConfig,
  type Package,
  type UserSettings,
  type Wire,
} from './types'
import { DEFAULT_CONFIG, createInitialState } from './config'
import { GAME_SPINE, shipReward } from './spine'
import { SPINE_SOLVED } from './spine-solved'

// ============================================
// ENGINE
// ============================================
//
// Owns the save slot and the tick driver. persistence.ts registers the save
// module and boots it. The gameId is the storage key prefix, and the save
// manager moves any `${gameId}-save` key into its first slot as an engine
// envelope, so it must not be `heaviest-objects`: that key holds a pre-engine
// save, which would load as an envelope, fail, and protect the slot.
export const engine = createEngine({
  gameId: 'heaviest-objects-in-the-universe',
  saveVersion: 2,
  // Version 1 is the jam economy's save, one opaque blob; its tokens and tiers mean
  // nothing to the meta layer, so it loads as a fresh game.
  saveMigrations: { 1: () => ({}) },
  autoSaveInterval: 30_000,
})

// ============================================
// GAME STATE
// ============================================
//
// One facade over persistent refs, grouped by what resets them; each module builds every
// saved section GameState declares for it. The `run` module's refs
// reset when a run ends (ship.ts drives it as a Cycle); the `game` module's survive ships
// and reset on a new game; a lifetime ref survives that too. Each field is its own ref,
// which reactive() unwraps on read and writes through on assignment, so readers write
// `gameState.run.comboCount++`. Never assign a whole section: that would replace its refs.
// The modules fill their sections at engine.start(), which runs before the UI mounts.
// cascade, automation and collapseHold are within-frame state, never saved.

export const gameState = reactive({
  cascade: createInitialState().cascade,
  automation: createInitialState().automation,
  collapseHold: createInitialState().collapseHold,
}) as GameState

/** Persistent refs for a section's fields, saved under `${section}.${key}`. */
function persistentFields<T extends object>(
  section: string,
  defaults: T,
  lifetime: readonly (keyof T)[] = []
): T {
  const fields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(defaults)) {
    fields[key] = persistent(value as number | boolean, {
      id: `${section}.${key}`,
      lifetime: lifetime.includes(key as keyof T),
    })
  }
  return fields as T
}

/** The ref behind meta.hasCollapsed: lifetime, so only a hard reset names it. */
export let hasCollapsedRef: Persistent<boolean> | null = null

engine.use({
  id: 'game',
  install() {
    const fresh = createInitialState()
    const meta = persistentFields('meta', fresh.meta, ['hasCollapsed'])
    hasCollapsedRef = (meta as unknown as Record<string, Persistent<boolean>>)
      .hasCollapsed!
    Object.assign(gameState, {
      meta,
      upgrades: persistentFields('upgrades', fresh.upgrades),
      stats: persistentFields('stats', fresh.stats),
      onboarding: persistentFields('onboarding', fresh.onboarding),
    })
  },
})

engine.use({
  id: 'run',
  install(ctx) {
    const fresh = createInitialState()
    Object.assign(gameState, {
      seed: persistent(fresh.seed, { id: 'seed' }),
      resources: persistentFields('resources', fresh.resources),
      board: persistentFields('board', fresh.board),
      run: persistentFields('run', fresh.run),
      camera: persistentFields('camera', fresh.camera),
    })
    // The toggle is saved with the run; the rest of automation is within-frame.
    ;(
      gameState.automation as unknown as Record<string, unknown>
    ).resolveEnabled = persistent(false, { id: 'automation.resolveEnabled' })
    seedRNG(gameState.seed)
    ctx.onLoad(() => seedRNG(gameState.seed))
  },
})

// ============================================
// SPATIAL GRAPH + SCOPE STACK
// ============================================
//
// `graph` is the authoritative topology: root scope nodes (rootId package +
// top-level packages) plus a tree of child graphs for each package's
// internal scope. Wires from a package to its first-level deps live in
// that package's child graph alongside a *shadow* node carrying the same
// id and Package data reference as the parent-graph node — needed because
// Graph requires both edge endpoints to live in the same graph.
//
// Stack owns scope navigation; its `recalculate` callback derives the
// per-scope state label from the graph state.
//
// Sibling overlay edges (cross-package conflict markers) stay renderer-only
// in cross-package.ts's separate Map; they never reach `graph.addEdge`.

// ID generator shared across all graphs (root + child graphs) for stable,
// non-colliding IDs across saves and scope levels.
let nextNodeCounter = 0
function nextNodeId(): string {
  return `pkg_${nextNodeCounter++}`
}
let nextEdgeCounter = 0
function nextEdgeId(): string {
  return `wire_${nextEdgeCounter++}`
}
export function generateId(): string {
  return nextNodeId()
}
export function generateWireId(): string {
  return nextEdgeId()
}

export function resetIdCounters(): void {
  nextNodeCounter = 0
  nextEdgeCounter = 0
}

export function syncIdCountersFromGraph(): void {
  let maxNode = 0
  let maxEdge = 0
  function walk(g: Graph<Package, Wire>) {
    for (const id of g.nodes.keys()) {
      const m = id.match(/^pkg_(\d+)$/)
      if (m) maxNode = Math.max(maxNode, parseInt(m[1]!, 10) + 1)
    }
    for (const id of g.edges.keys()) {
      const m = id.match(/^wire_(\d+)$/)
      if (m) maxEdge = Math.max(maxEdge, parseInt(m[1]!, 10) + 1)
    }
    for (const [, node] of g.nodes) {
      const child = g.getChildGraph(node.id)
      if (child) walk(child)
    }
  }
  walk(graph)
  nextNodeCounter = maxNode
  nextEdgeCounter = maxEdge
}

// Reactive tick that bumps on every graph/stack mutation. Vue computeds that
// derive from graph state read this to retrigger.
export const graphRevision: Ref<number> = ref(0)
function bumpRevision(): void {
  graphRevision.value++
}

export const graph: Graph<Package, Wire> = createGraph<Package, Wire>({
  idGenerator: nextNodeId,
})

// Recursively wire a graph and all its (current and future) child graphs to
// bump the revision tick. Called once on construction and on any new child.
function attachReactivity(g: Graph<Package, Wire>): void {
  g.on('nodeAdded', bumpRevision)
  g.on('nodeRemoved', bumpRevision)
  g.on('edgeAdded', bumpRevision)
  g.on('edgeRemoved', bumpRevision)
  g.on('childGraphCreated', (_id, child) => {
    bumpRevision()
    attachReactivity(child)
  })
  g.on('childGraphDestroyed', bumpRevision)
}
attachReactivity(graph)

// Root package id — the package.json node sitting in the root graph.
// Set by createRootPackage; cleared on prestige/ship/load.
export const rootIdRef: Ref<string | null> = ref(null)

function recalculate(
  g: Graph<Package, Wire>,
  path: readonly string[]
): ScopeStatus {
  // Root scope (path = []) is never gated; treat as stable.
  if (path.length === 0) return 'stable'

  // Pristine until first cascade populates the scope.
  // The shadow scope-owner node is always present in a populated child graph,
  // so a one-node graph means "owner-only, deps not yet spawned."
  if (g.nodes.size <= 1) return 'pristine'

  // Conflicted edges → unstable.
  for (const edge of g.edges.values()) {
    if (edge.data.conflicted) return 'unstable'
  }

  // Duplicate identities (ignoring ghosts and the shadow scope-owner).
  const ownerId = path[path.length - 1]
  const groups = g.findDuplicateGroups<string>((node) => {
    if (node.id === ownerId) return `__owner_${node.id}`
    if (node.data.isGhost) return `__ghost_${node.id}`
    const name = node.data.identity?.name
    return name ? `id:${name}` : `__no_id_${node.id}`
  })
  for (const [key, group] of groups) {
    if (key.startsWith('id:') && group.length > 1) return 'unstable'
  }

  // Unstable descendant scopes propagate up.
  for (const [nodeId] of g.nodes) {
    if (nodeId === ownerId) continue
    if (g.getChildGraph(nodeId) === null) continue
    const childState = stack.statusAt([...path, nodeId])
    if (childState === 'unstable') return 'unstable'
  }

  return 'stable'
}

export const stack: ScopeStack<Package, Wire> = createScopeStack<Package, Wire>(
  { root: graph, recalculate }
)
stack.on('scope:entered', bumpRevision)
stack.on('scope:exited', bumpRevision)
stack.on('scope:recalculated', bumpRevision)

// Reset graph + stack to empty (used by prestige / ship / hard reset / load).
export function resetGraphAndStack(): void {
  stack.exitToRoot()
  // Removing every root node cascades to child graphs.
  const ids = Array.from(graph.nodes.keys())
  for (const id of ids) graph.removeNode(id)
  rootIdRef.value = null
  resetIdCounters()
  bumpRevision()
}

// Global config (can be modified for balancing)
export const gameConfig = reactive<GameConfig>({ ...DEFAULT_CONFIG })

// User settings (separate from game state, persists independently)
export const userSettings = ref<UserSettings>({
  backgroundClickToExit: false,
})

// ============================================
// COMPUTED VALUES
// ============================================

// What a ship would take home now, from this run's counters and the meta upgrades owned.
export const computed_prestigeReward: ComputedRef<number> = computed(() => {
  const run = gameState.run
  return shipReward(GAME_SPINE, {
    grossWeight: run.runGrossWeight,
    resolvedShare: run.resolvedShare,
    comboDepth: run.runActs > 0 ? run.runComboSum / run.runActs : 0,
    comboLevel: gameState.upgrades.comboPayout,
    timedCleared: gameState.upgrades.timed,
    tier: gameState.board.tier,
    unlockedTier: gameState.meta.unlockedTier,
  })
})

// Reactive root-graph package count (for HUD reveal triggers etc.)
export const computed_rootPackageCount: ComputedRef<number> = computed(() => {
  void graphRevision.value
  return graph.nodes.size
})

// ============================================
// MAP TIERS
// ============================================

/** Price of unlocking a map tier, solved through the spine's walk; Infinity past the last. */
export function tierPrice(tier: number): number {
  return SPINE_SOLVED.tierPrices[tier] ?? Infinity
}

/**
 * Spend the wallet on each next map tier it affords. Until the meta layer sells tiers,
 * a ship buys them as soon as they are affordable.
 */
export function unlockAffordableTiers(): void {
  const meta = gameState.meta
  while (meta.cacheTokens >= tierPrice(meta.unlockedTier + 1)) {
    meta.cacheTokens -= tierPrice(meta.unlockedTier + 1)
    meta.unlockedTier++
  }
}

// Price of the next map tier; null once every tier is unlocked.
export const computed_nextTierPrice: ComputedRef<number | null> = computed(
  () => {
    const price = tierPrice(gameState.meta.unlockedTier + 1)
    return Number.isFinite(price) ? price : null
  }
)

// The wallet's progress toward the next map tier (0-1); 1 once every tier is unlocked.
export const computed_tierProgress: ComputedRef<number> = computed(() => {
  const price = computed_nextTierPrice.value
  if (price === null) return 1
  return Math.min(1, gameState.meta.cacheTokens / price)
})

// Endless mode state
export const computed_isEndlessMode: ComputedRef<boolean> = computed(() => {
  return gameState.meta.endlessMode
})
