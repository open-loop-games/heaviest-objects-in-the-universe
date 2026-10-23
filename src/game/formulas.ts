// Cost and production formulas based on design doc

import { random, randomInt, chance, type Graph } from '@open-loop/engine'
import type { Package, Wire } from './types'
import type { PackageIdentity } from './registry'
import {
  DEPTH_WEIGHT_MULTIPLIERS,
  GOLDEN_MIN_DEPTH,
  GOLDEN_MIN_TIER,
  GOLDEN_SPAWN_CHANCE,
  GOLDEN_WEIGHT_MULTIPLIER,
} from './config'

// ============================================
// PRESTIGE THRESHOLD
// ============================================

export function getPrestigeThreshold(timesShipped: number): number {
  if (timesShipped === 0) return 5000
  if (timesShipped === 1) return 20000
  return Math.floor(20000 * Math.pow(1.8, timesShipped - 1))
}

// ============================================
// SCOPE ROLLS
// ============================================
// The cascade's rolls for what a scope holds. The cascade calls them, and the sampler
// behind scope-weights.ts runs them, so a board's expected weight follows the rules.

/** Deps a scope spawns before sub-deps; `crit` doubles them. */
export function rollScopeDepCount(
  owner: PackageIdentity | undefined,
  scopeDepth: number,
  crit: boolean
): number {
  let count: number
  if (owner && owner.baseDeps > 0) {
    count = Math.max(4, owner.baseDeps + randomInt(-2, 2))
  } else {
    const baseCount = scopeDepth === 1 ? 8 : 6
    const variance = scopeDepth === 1 ? 8 : 4
    count = baseCount + randomInt(0, variance - 1)
  }
  if (crit) count *= 2
  return Math.max(3, Math.min(40, count))
}

/** Sub-deps one uncompressed dep grows. */
export function rollSubDepCount(): number {
  return chance(0.4) ? randomInt(1, 2) : 0
}

/** Whether a package spawns golden: from GOLDEN_MIN_TIER, at effective depth GOLDEN_MIN_DEPTH+. */
export function rollGolden(effectiveDepth: number, tier: number): boolean {
  return (
    tier >= GOLDEN_MIN_TIER &&
    effectiveDepth >= GOLDEN_MIN_DEPTH &&
    chance(GOLDEN_SPAWN_CHANCE)
  )
}

/** Whether a spawned package carries a cache fragment. */
export function carriesFragment(
  identity: PackageIdentity | undefined,
  golden: boolean
): boolean {
  return (
    golden ||
    identity?.name === 'break_infinity' ||
    identity?.name === 'break_eternity'
  )
}

/** A spawned package's raw weight: its identity size by depth, ×4 golden. */
export function spawnedSize(
  baseSize: number,
  effectiveDepth: number,
  golden: boolean
): number {
  const depthIndex = Math.min(
    effectiveDepth,
    DEPTH_WEIGHT_MULTIPLIERS.length - 1
  )
  const depthMultiplier = DEPTH_WEIGHT_MULTIPLIERS[depthIndex] ?? 1
  return Math.floor(
    baseSize * depthMultiplier * (golden ? GOLDEN_WEIGHT_MULTIPLIER : 1)
  )
}

/**
 * Count unresolved duplicates within a scope (packages with the same identity
 * that could be symlink-merged). Iterates a graph's nodes excluding the shadow
 * scope-owner if `excludeId` is provided.
 */
export function countScopeDuplicates(
  scopeGraph: Graph<Package, Wire>,
  excludeId?: string
): { duplicates: number; total: number } {
  const identityCounts = new Map<string, number>()
  let total = 0

  for (const [id, node] of scopeGraph.nodes) {
    if (excludeId !== undefined && id === excludeId) continue
    const pkg = node.data
    if (pkg.isGhost) continue
    total++
    const name = pkg.identity?.name
    if (name) {
      identityCounts.set(name, (identityCounts.get(name) || 0) + 1)
    }
  }

  let duplicates = 0
  for (const count of identityCounts.values()) {
    if (count > 1) {
      duplicates += count - 1
    }
  }

  return { duplicates, total }
}

// Efficiency formula constants
export const EFFICIENCY_BASE = 0.92
export const EFFICIENCY_SCALE_ANCHOR = 60

// ============================================
// EFFICIENCY TIERS
// ============================================

export type EfficiencyTier =
  | 'bloated'
  | 'messy'
  | 'decent'
  | 'clean'
  | 'pristine'

export const EFFICIENCY_TIER_THRESHOLDS: Record<EfficiencyTier, number> = {
  bloated: 0.3,
  messy: 0.5,
  decent: 0.7,
  clean: 0.85,
  pristine: 1.01,
}

export function getEfficiencyTier(efficiency: number): EfficiencyTier {
  if (efficiency < 0.3) return 'bloated'
  if (efficiency < 0.5) return 'messy'
  if (efficiency < 0.7) return 'decent'
  if (efficiency < 0.85) return 'clean'
  return 'pristine'
}

let lastEfficiency = 1
let lastEfficiencyTier: EfficiencyTier = 'pristine'

export function resetEfficiencyTracking(): void {
  lastEfficiency = 1
  lastEfficiencyTier = 'pristine'
}

export function getLastEfficiencyTier(): EfficiencyTier {
  return lastEfficiencyTier
}

export function updateEfficiencyTracking(newEfficiency: number): {
  tierChanged: boolean
  oldTier: EfficiencyTier
  newTier: EfficiencyTier
  delta: number
} {
  const newTier = getEfficiencyTier(newEfficiency)
  const delta = newEfficiency - lastEfficiency
  const oldTier = lastEfficiencyTier
  const tierChanged = newTier !== oldTier

  lastEfficiency = newEfficiency
  lastEfficiencyTier = newTier

  return { tierChanged, oldTier, newTier, delta }
}

export function getEfficiencyTierRank(tier: EfficiencyTier): number {
  const ranks: Record<EfficiencyTier, number> = {
    bloated: 0,
    messy: 1,
    decent: 2,
    clean: 3,
    pristine: 4,
  }
  return ranks[tier]
}

export function getEfficiencyTierProgress(efficiency: number): number {
  const tier = getEfficiencyTier(efficiency)
  const thresholds: number[] = [0, 0.3, 0.5, 0.7, 0.85, 1.0]
  const tierIndex = getEfficiencyTierRank(tier)

  const low = thresholds[tierIndex] ?? 0
  const high = thresholds[tierIndex + 1] ?? 1

  if (high <= low) return 1
  return Math.min(1, (efficiency - low) / (high - low))
}

// ============================================
// PACKAGE SIZE
// ============================================

export function rollPackageSize(): number {
  const base = 10 + random() * 40
  const isLarge = chance(0.1)
  return Math.floor(isLarge ? base * 5 : base)
}

/**
 * Deterministic size for a package based on its identity.
 * Same identity = same size, for visual consistency of duplicates.
 */
export function getIdentitySize(
  identity: { weight: number } | undefined,
  minSize: number = 10
): number {
  if (!identity) return rollPackageSize()
  return Math.max(minSize, identity.weight)
}
