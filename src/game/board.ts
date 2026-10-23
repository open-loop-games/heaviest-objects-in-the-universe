// The run's board: its map tier's data and the plan drawn from the run's seed. The plan
// fixes how the board's scopes nest, so every board holds the spine's scope count and
// reaches its tier's depth; the cascade reads from it how many compressed children each
// scope gets. Identities stay drawn from the tier's pool, so no two boards look alike.

import { computed, type ComputedRef } from 'vue'
import { createSeededRNG, type Graph } from '@open-loop/engine'
import { gameState, graph, graphRevision, rootIdRef, stack } from './state'
import type { Package, Wire } from './types'
import { GAME_SPINE } from './spine'
import { SCOPE_WEIGHTS } from './scope-weights'

export interface TierBoard {
  /** Top-level deps the root installs. Feel; the monorepo (tier 4) is wider. */
  topLevel: number
}

/** Index = tier − 1. A board's depth is its tier. */
export const TIER_BOARDS: TierBoard[] = [
  { topLevel: 8 },
  { topLevel: 6 },
  { topLevel: 6 },
  { topLevel: 9 },
  { topLevel: 9 },
]

/** A scope in the plan: the compressed children it holds. */
export interface PlanScope {
  children: PlanScope[]
}

/**
 * The board plan for one run: the tier's top-level scopes, then one chain of nested scopes
 * down to the tier's depth, then the rest of the spine's scope count spread over scopes
 * above that depth.
 */
export function drawBoardPlan(seed: number, tier: number): PlanScope[] {
  const random = createSeededRNG(seed)
  const depth = tier
  const scopes = GAME_SPINE.boards[tier - 1]!.scopes
  const top: PlanScope[] = Array.from(
    { length: TIER_BOARDS[tier - 1]!.topLevel },
    () => ({ children: [] })
  )
  const open: { scope: PlanScope; depth: number }[] = top.map((scope) => ({
    scope,
    depth: 1,
  }))
  const nest = (parent: { scope: PlanScope; depth: number }) => {
    const child = { scope: { children: [] }, depth: parent.depth + 1 }
    parent.scope.children.push(child.scope)
    if (child.depth < depth) open.push(child)
    return child
  }
  let remaining = scopes - top.length
  if (depth > 1) {
    let parent = open[Math.floor(random() * open.length)]!
    for (let d = 1; d < depth && remaining > 0; d++, remaining--) {
      parent = nest(parent)
    }
  }
  for (; remaining > 0 && open.length > 0; remaining--) {
    nest(open[Math.floor(random() * open.length)]!)
  }
  return top
}

/** Expected raw weight of a plan's scopes, from the sampled table. */
function expectedRawWeight(plan: PlanScope[], tier: number): number {
  const nested = SCOPE_WEIGHTS.nested[tier - 1]!
  const walk = (scope: PlanScope, depth: number): number =>
    (depth === 1 ? SCOPE_WEIGHTS.topLevel[tier - 1]! : nested[depth - 2]!) +
    scope.children.reduce((sum, child) => sum + walk(child, depth + 1), 0)
  return plan.reduce((sum, scope) => sum + walk(scope, 1), 0)
}

let current: {
  seed: number
  tier: number
  plan: PlanScope[]
  scale: number
} | null = null

function board() {
  const { seed } = gameState
  const { tier } = gameState.board
  if (!current || current.seed !== seed || current.tier !== tier) {
    const plan = drawBoardPlan(seed, tier)
    current = {
      seed,
      tier,
      plan,
      scale:
        GAME_SPINE.boards[tier - 1]!.weight / expectedRawWeight(plan, tier),
    }
  }
  return current
}

/**
 * Multiplier on every weight the board spawns, so its expected gross weight is the spine's
 * Board.weight: the spine's weight over the expected raw weight of this run's plan.
 */
export function boardWeightScale(): number {
  return board().scale
}

/** Compressed children planned for the scope at a plan path. */
export function plannedChildren(planPath: readonly number[] | null): number {
  if (!planPath || planPath.length === 0) return 0
  let scopes = board().plan
  let scope: PlanScope | undefined
  for (const index of planPath) {
    scope = scopes[index]
    if (!scope) return 0
    scopes = scope.children
  }
  return scope?.children.length ?? 0
}

/** Top-level deps the root has left to install this run. */
export function topLevelRemaining(): number {
  const { tier, topLevelInstalled } = gameState.board
  return TIER_BOARDS[tier - 1]!.topLevel - topLevelInstalled
}

// ============================================
// SHIP AND COLLAPSE GATES
// ============================================

/** Scopes on the board, by whether they have cascaded; the root's own graph is not one. */
function countScopes(): { entered: number; pristine: number } {
  let entered = 0
  let pristine = 0
  const walk = (g: Graph<Package, Wire>, ownerId: string | null) => {
    for (const [id] of g.nodes) {
      if (id === ownerId) continue
      const child = g.getChildGraph(id)
      if (!child) continue
      // A child graph holding only its shadow owner has not cascaded.
      if (child.nodes.size <= 1) pristine++
      else entered++
      walk(child, id)
    }
  }
  walk(graph, null)
  return { entered, pristine }
}

// Every top-level dep installed and every scope cascaded: the whole board is on screen.
export const computed_boardUnpacked: ComputedRef<boolean> = computed(() => {
  void graphRevision.value
  if (rootIdRef.value === null || topLevelRemaining() > 0) return false
  if (gameState.cascade.active) return false
  return countScopes().pristine === 0
})

// The board unpacked with every scope stable: no conflict or duplicate left anywhere.
export const computed_boardStable: ComputedRef<boolean> = computed(() => {
  if (!computed_boardUnpacked.value) return false
  for (const id of graph.nodes.keys()) {
    if (id === rootIdRef.value) continue
    if (stack.statusAt([id]) !== 'stable') return false
  }
  return true
})

// The run's gross weight over the spine's weight for this board (0-1): how heavy it has grown.
export const computed_boardWeightShare: ComputedRef<number> = computed(() =>
  Math.min(
    1,
    gameState.run.runGrossWeight /
      GAME_SPINE.boards[gameState.board.tier - 1]!.weight
  )
)

// Share of the board's planned scopes cascaded so far (0-1): the run's way to Ship.
export const computed_boardProgress: ComputedRef<number> = computed(() => {
  void graphRevision.value
  const planned = GAME_SPINE.boards[gameState.board.tier - 1]!.scopes
  return Math.min(1, countScopes().entered / planned)
})

// Collapse, the one-time finale, ends a fully stable tier-5 board in place of Ship. In
// Endless every board ships.
export const computed_canCollapse: ComputedRef<boolean> = computed(
  () =>
    !gameState.meta.endlessMode &&
    gameState.board.tier >= 5 &&
    computed_boardStable.value
)

// Ship ends a run once its board is unpacked, unless the board offers Collapse instead.
export const computed_canPrestige: ComputedRef<boolean> = computed(
  () => computed_boardUnpacked.value && !computed_canCollapse.value
)
