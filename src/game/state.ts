// Reactive game state management using Vue
//
// Pattern rationale:
// - reactive() for large nested objects mutated in-place (gameState, gameConfig)
// - ref() for primitives or objects replaced wholesale (collapseState, dragState)

import { reactive, ref, computed, type ComputedRef } from 'vue'
import {
  createSpatialGraph,
  createScopeStack,
  type GraphNode,
  type ScopeStack,
  type ScopeState,
  type SpatialGraph,
} from 'open-loop-engine'
import {
  type GameState,
  type GameConfig,
  type Package,
  type UserSettings,
  type Wire,
} from './types'
import { DEFAULT_CONFIG, createInitialState, TIER_THRESHOLDS } from './config'
import {
  calculatePrestigeReward,
  getPrestigeThreshold,
  getEcosystemTier,
  getMaxCompressedDepth,
} from './formulas'
import { seedRNG } from './random'

// Global reactive game state
export const gameState = reactive<GameState>(createInitialState())

// Initialize RNG with the game's seed
seedRNG(gameState.seed)

// ============================================
// SPATIAL GRAPH + SCOPE STACK (OL-500 port in progress)
// ============================================
//
// During the dual-write phase, gameState.packages/wires/scopeStack remain
// the source of truth. At commit 6 the mirror dies; graph + stack become
// authoritative.
//
// Cascade-gate ordering decision (Decision B in
// /home/tony/.claude/plans/proceed-tidy-meerkat.md): callers MUST read
// stack.stateAt(path) BEFORE flipping owner.data.hasBeenEntered, then call
// stack.recalculateAt(path). If the gate were checked after the flip,
// recalculate on an empty child graph would already have transitioned
// pristine → stable, and cascade would never fire.
//
// Sibling overlay edges (cross-package conflict markers) stay
// renderer-only synthetic in cross-package.ts's separate Map; they never
// reach graph.addEdge.
export const graph: SpatialGraph<Package, Wire> = createSpatialGraph<
  Package,
  Wire
>()

function recalculate(
  g: SpatialGraph<Package, Wire>,
  path: readonly string[]
): ScopeState {
  // Root scope (path = []) is never gated; treat as stable.
  if (path.length === 0) return 'stable'

  // Resolve the owning node by walking the path from the root graph.
  let walker: SpatialGraph<Package, Wire> = graph
  let owner: GraphNode<Package> | undefined
  for (let i = 0; i < path.length; i++) {
    const id = path[i]!
    owner = walker.getNode(id)
    if (!owner) return 'stable' // path no longer resolves; bail
    if (i < path.length - 1) {
      const child = walker.getChildGraph(id)
      if (!child) return 'stable'
      walker = child
    }
  }
  if (!owner) return 'stable'

  // Pristine: child graph is empty AND the owner has not yet been entered.
  if (g.nodes.size === 0 && !owner.data.hasBeenEntered) {
    return 'pristine'
  }

  // Conflicted edges → unstable.
  for (const edge of g.edges.values()) {
    if (edge.data.conflicted) return 'unstable'
  }

  // Duplicate identities (ignoring ghosts) → unstable.
  // Ghost nodes and identity-less nodes get a unique-per-node key so they
  // never bucket together as duplicates.
  const groups = g.findDuplicateGroups<string>((node) => {
    if (node.data.isGhost) return `__ghost_${node.id}`
    const name = node.data.identity?.name
    return name ? `id:${name}` : `__no_id_${node.id}`
  })
  for (const [key, group] of groups) {
    if (key.startsWith('id:') && group.length > 1) return 'unstable'
  }

  // Unstable descendant scopes propagate up.
  for (const [nodeId] of g.nodes) {
    if (g.getChildGraph(nodeId) === null) continue
    const childState = stack.stateAt([...path, nodeId])
    if (childState === 'unstable') return 'unstable'
  }

  return 'stable'
}

export const stack: ScopeStack<Package, Wire> = createScopeStack<Package, Wire>(
  { root: graph, recalculate }
)

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

export const computed_prestigeReward: ComputedRef<number> = computed(() => {
  return calculatePrestigeReward(gameState, computed_prestigeThreshold.value)
})

// Prestige unlocks when max weight ever reached >= threshold
// Uses peak weight so optimization (merging) doesn't drop below threshold
export const computed_canPrestige: ComputedRef<boolean> = computed(() => {
  const threshold = computed_prestigeThreshold.value
  return gameState.stats.maxWeightReached >= threshold
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

// ============================================
// RESOURCE MUTATIONS (simple state changes)
// ============================================

/**
 * Spend bandwidth if available
 * @returns true if spent successfully, false if insufficient
 */
export function spendBandwidth(amount: number): boolean {
  if (gameState.resources.bandwidth >= amount) {
    gameState.resources.bandwidth -= amount
    return true
  }
  return false
}
