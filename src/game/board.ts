// The run's board: its map tier's data and the plan drawn from the run's seed. The plan
// fixes how the board's scopes nest, so every board holds the spine's scope count and
// reaches its tier's depth; the cascade reads from it how many compressed children each
// scope gets. Identities stay drawn from the tier's pool, so no two boards look alike.

import { createSeededRNG } from '@open-loop/engine'
import { gameState } from './state'
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
