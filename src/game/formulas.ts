// Cost and production formulas based on design doc

import { random, chance } from './random'
import type { GameState, GameConfig, Package, Wire } from './types'
import {
  DEFAULT_CONFIG,
  TIER_THRESHOLDS,
  TIER_MAX_DEPTH,
  BASE_COMPRESSION_CHANCE,
  COMPRESSION_PER_TOKEN,
  COMPRESSION_SOFTCAP,
  COMPRESSION_HARDCAP,
  DEPTH_COMPRESSION_MULT,
} from './config'
import type { SpatialGraph } from 'open-loop-engine'

// ============================================
// PRESTIGE THRESHOLD
// ============================================

export function getPrestigeThreshold(timesShipped: number): number {
  if (timesShipped === 0) return 5000
  if (timesShipped === 1) return 20000
  return Math.floor(20000 * Math.pow(1.8, timesShipped - 1))
}

// ============================================
// ECOSYSTEM TIER
// ============================================

export function getEcosystemTier(cacheTokens: number): number {
  for (let tier = TIER_THRESHOLDS.length; tier >= 1; tier--) {
    const threshold = TIER_THRESHOLDS[tier - 1]
    if (threshold !== undefined && cacheTokens >= threshold) {
      return tier
    }
  }
  return 1
}

export function getMaxCompressedDepth(
  cacheTokens: number,
  ecosystemTier?: number
): number {
  const tier = ecosystemTier ?? getEcosystemTier(cacheTokens)
  return TIER_MAX_DEPTH[tier - 1] ?? 1
}

// ============================================
// COMPRESSION CHANCE
// ============================================

function calculateBaseCompressionChance(cacheTokens: number): number {
  let baseChance = BASE_COMPRESSION_CHANCE + cacheTokens * COMPRESSION_PER_TOKEN

  if (baseChance > COMPRESSION_SOFTCAP) {
    const tokensOverSoftcap = cacheTokens - 20
    const push =
      (COMPRESSION_HARDCAP - COMPRESSION_SOFTCAP) *
      (1 - Math.exp(-tokensOverSoftcap / 75))
    baseChance = COMPRESSION_SOFTCAP + push
  }

  return Math.min(COMPRESSION_HARDCAP, baseChance)
}

export function getCompressionChance(
  depth: number,
  cacheTokens: number
): number {
  if (depth >= 5) return 0

  const baseChance = calculateBaseCompressionChance(cacheTokens)

  const depthIndex = Math.min(depth - 1, DEPTH_COMPRESSION_MULT.length - 1)
  const depthMult = DEPTH_COMPRESSION_MULT[depthIndex] ?? 0

  return baseChance * depthMult
}

export function getBaseCompressionChance(cacheTokens: number): number {
  return calculateBaseCompressionChance(cacheTokens)
}

/**
 * Count unresolved duplicates within a scope (packages with the same identity
 * that could be symlink-merged). Iterates a graph's nodes excluding the shadow
 * scope-owner if `excludeId` is provided.
 */
export function countScopeDuplicates(
  scopeGraph: SpatialGraph<Package, Wire>,
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

/**
 * Cache token reward formula.
 */
export function calculatePrestigeReward(
  state: GameState,
  threshold: number
): number {
  const weight = state.resources.weight

  // Base reward scales with sqrt of progress past threshold
  const progress = Math.max(0, weight / Math.max(1, threshold))
  const baseReward = Math.sqrt(progress) * 3

  // Efficiency multiplier: 0.5x at 0%, 1.5x at 100%
  const efficiencyMultiplier = 0.5 + state.stats.currentEfficiency

  // Stability bonus: 0.7x (all unstable) to 1.0x (all stable). Use the
  // pre-computed ratio from gameState rather than recomputing — the live
  // calculation lives in mutations.ts (closer to its callers).
  const stabilityRatio = state.stats.currentStability
  const stabilityBonus = 0.7 + stabilityRatio * 0.3

  return Math.max(
    1,
    Math.floor(baseReward * efficiencyMultiplier * stabilityBonus)
  )
}

// ============================================
// DEPENDENCY COUNT ROLLER
// ============================================

const DEPENDENCY_DISTRIBUTION = [
  { count: 0, weight: 50 },
  { count: 1, weight: 15 },
  { count: 2, weight: 15 },
  { count: 3, weight: 10 },
  { count: 4, weight: 5 },
  { count: 5, weight: 3 },
  { count: 8, weight: 1.5 },
  { count: 12, weight: 0.5 },
]

const TOTAL_DEP_WEIGHT = DEPENDENCY_DISTRIBUTION.reduce(
  (sum, t) => sum + t.weight,
  0
)

export function rollDependencyCount(
  _config: GameConfig = DEFAULT_CONFIG
): number {
  let roll = random() * TOTAL_DEP_WEIGHT

  for (const tier of DEPENDENCY_DISTRIBUTION) {
    roll -= tier.weight
    if (roll <= 0) {
      return tier.count
    }
  }

  return 0
}

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

export function shouldCompress(depth: number, cacheTokens: number): boolean {
  return chance(getCompressionChance(depth, cacheTokens))
}
