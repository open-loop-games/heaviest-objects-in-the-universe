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
  seedRNG,
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
import { DEFAULT_CONFIG, createInitialState, TIER_THRESHOLDS } from './config'
import {
  getPrestigeThreshold,
  getEcosystemTier,
  getMaxCompressedDepth,
} from './formulas'
import { GAME_SPINE, shipReward } from './spine'

// ============================================
// ENGINE
// ============================================
//
// Owns the save slot and the tick driver. persistence.ts registers the save
// module and boots it. The gameId is the storage key prefix, and the save
// manager moves any `${gameId}-save` key into its first slot as an engine
// envelope, so it must not be `heaviest-objects`: that key holds the
// pre-engine save, which persistence.ts imports itself.
export const engine = createEngine({
  gameId: 'heaviest-objects-in-the-universe',
  saveVersion: 1,
  autoSaveInterval: 30_000,
})

// Global reactive game state (resources, meta, stats, cascade, automation —
// everything except graph topology, which lives on `graph` + `stack` below).
export const gameState = reactive<GameState>(createInitialState())

// Initialize RNG with the game's seed
seedRNG(gameState.seed)

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

// Current prestige threshold (dynamic based on progress)
export const computed_prestigeThreshold: ComputedRef<number> = computed(() => {
  return getPrestigeThreshold(gameState.meta.timesShipped)
})

// Gravity: progress toward prestige (0 to 1+)
// Simple formula: weight / threshold
// Efficiency affects rewards, not when you can ship
export const computed_gravity: ComputedRef<number> = computed(() => {
  const threshold = computed_prestigeThreshold.value
  if (threshold <= 0) return 0
  return gameState.resources.weight / threshold
})

// What a ship would take home now, from this run's counters and the meta upgrades owned.
// The board is the current tier.
export const computed_prestigeReward: ComputedRef<number> = computed(() => {
  const stats = gameState.stats
  return shipReward(GAME_SPINE, {
    grossWeight: stats.runGrossWeight,
    resolvedShare: stats.resolvedShare,
    comboDepth: stats.runActs > 0 ? stats.runComboSum / stats.runActs : 0,
    comboLevel: gameState.upgrades.comboPayout,
    timedCleared: gameState.upgrades.timed,
    tier: gameState.meta.ecosystemTier,
  })
})

// Prestige unlocks when max weight ever reached >= threshold
// Uses peak weight so optimization (merging) doesn't drop below threshold
export const computed_canPrestige: ComputedRef<boolean> = computed(() => {
  const threshold = computed_prestigeThreshold.value
  return gameState.stats.maxWeightReached >= threshold
})

// Reactive root-graph package count (for HUD reveal triggers etc.)
export const computed_rootPackageCount: ComputedRef<number> = computed(() => {
  void graphRevision.value
  return graph.nodes.size
})

// ============================================
// ECOSYSTEM TIER HELPERS
// ============================================

/**
 * Update the stored ecosystemTier to match current cache tokens.
 * Call this after prestige or when loading a save.
 */
export function syncEcosystemTier(): void {
  gameState.meta.ecosystemTier = getEcosystemTier(gameState.meta.cacheTokens)
}

// Computed ecosystem tier (reactive)
export const computed_ecosystemTier: ComputedRef<number> = computed(() => {
  return getEcosystemTier(gameState.meta.cacheTokens)
})

// Computed max depth (reactive)
export const computed_maxDepth: ComputedRef<number> = computed(() => {
  return getMaxCompressedDepth(gameState.meta.cacheTokens)
})

// Tokens needed for next tier (for UI progress display)
export const computed_nextTierThreshold: ComputedRef<number | null> = computed(
  () => {
    const currentTier = computed_ecosystemTier.value
    if (currentTier >= TIER_THRESHOLDS.length) return null // Max tier
    return TIER_THRESHOLDS[currentTier] ?? null
  }
)

// Progress toward next tier (0-1)
export const computed_tierProgress: ComputedRef<number> = computed(() => {
  const currentTier = computed_ecosystemTier.value
  const tokens = gameState.meta.cacheTokens

  if (currentTier >= TIER_THRESHOLDS.length) return 1 // Max tier

  const currentThreshold = TIER_THRESHOLDS[currentTier - 1] ?? 0
  const nextThreshold = TIER_THRESHOLDS[currentTier] ?? 0

  const range = nextThreshold - currentThreshold
  if (range <= 0) return 1 // Safety check
  const progress = tokens - currentThreshold

  return Math.min(1, progress / range)
})

// Collapse availability (Tier 5 only)
export const computed_canCollapse: ComputedRef<boolean> = computed(() => {
  return computed_ecosystemTier.value >= 5
})

// Endless mode state
export const computed_isEndlessMode: ComputedRef<boolean> = computed(() => {
  return gameState.meta.endlessMode
})
