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

// ============================================
// QUALITY TIERS
// ============================================
// Feedback thresholds over q, the share of the board's problems resolved.

export type QualityTier = 'bloated' | 'messy' | 'decent' | 'clean' | 'pristine'

const QUALITY_TIER_FLOORS: [QualityTier, number][] = [
  ['pristine', 0.85],
  ['clean', 0.7],
  ['decent', 0.5],
  ['messy', 0.3],
  ['bloated', 0],
]

export function getQualityTier(q: number): QualityTier {
  return QUALITY_TIER_FLOORS.find(([, floor]) => q >= floor)![0]
}

export function getQualityTierRank(tier: QualityTier): number {
  return (
    QUALITY_TIER_FLOORS.length -
    1 -
    QUALITY_TIER_FLOORS.findIndex(([t]) => t === tier)
  )
}

let lastQuality = 1
let lastQualityTier: QualityTier = 'pristine'

export function resetQualityTracking(): void {
  lastQuality = 1
  lastQualityTier = 'pristine'
}

/** Record a new q; returns its tier and the change since the last one. */
export function updateQualityTracking(q: number): {
  oldTier: QualityTier
  newTier: QualityTier
  delta: number
} {
  const oldTier = lastQualityTier
  const newTier = getQualityTier(q)
  const delta = q - lastQuality
  lastQuality = q
  lastQualityTier = newTier
  return { oldTier, newTier, delta }
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
