// Cost and production formulas based on design doc

import { toRaw } from 'vue'
import type { GameState, GameConfig, Package } from './types'
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

// Note: getEffectiveBandwidthRegen is now in upgrades.ts (uses upgrade system)

// ============================================
// PRESTIGE THRESHOLD
// ============================================

/**
 * Calculate prestige threshold based on total prestiges completed
 * - First prestige: 5,000 (intro/tutorial)
 * - Second prestige: 20,000
 * - Third+: 20,000 * 1.8^(n-2) scaling
 */
export function getPrestigeThreshold(timesShipped: number): number {
  if (timesShipped === 0) return 5000 // First ship - intro
  if (timesShipped === 1) return 20000 // Second ship
  // Scaling: 20k, 36k, 65k, 117k, 210k, ...
  return Math.floor(20000 * Math.pow(1.8, timesShipped - 1))
}

// ============================================
// ECOSYSTEM TIER (Derived from cache tokens)
// ============================================

/**
 * Calculate ecosystem tier from cache token count.
 * Tier determines max depth and automation unlocks.
 */
export function getEcosystemTier(cacheTokens: number): number {
  for (let tier = TIER_THRESHOLDS.length; tier >= 1; tier--) {
    const threshold = TIER_THRESHOLDS[tier - 1]
    if (threshold !== undefined && cacheTokens >= threshold) {
      return tier
    }
  }
  return 1
}

/**
 * Get max compressed depth allowed at current tier.
 * Tier 1 = depth 1, Tier 5 = depth 5.
 */
export function getMaxCompressedDepth(
  cacheTokens: number,
  ecosystemTier?: number
): number {
  const tier = ecosystemTier ?? getEcosystemTier(cacheTokens)
  return TIER_MAX_DEPTH[tier - 1] ?? 1
}

// ============================================
// COMPRESSION CHANCE (Derived from tokens + depth)
// ============================================

/**
 * Calculate base compression chance from cache tokens (before depth tapering).
 * - Starts at 25%
 * - +1% per token up to 50% softcap (20 tokens)
 * - Asymptotically approaches 60% hardcap
 */
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

/**
 * Calculate compression chance for a given depth.
 *
 * Depth tapering reduces chance at deeper levels:
 * - Depth 1: 100%
 * - Depth 2: 75%
 * - Depth 3: 50%
 * - Depth 4: 25%
 * - Depth 5: 0% (always leaves)
 *
 * @param depth Current scope depth (1-5)
 * @param cacheTokens Token count to use for calculation
 * @returns Compression chance (0-1)
 */
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

/**
 * Get base compression chance (before depth tapering).
 * Useful for UI display.
 */
export function getBaseCompressionChance(cacheTokens: number): number {
  return calculateBaseCompressionChance(cacheTokens)
}

/**
 * Count unresolved duplicates within a single scope (packages that could be symlink-merged)
 * Returns { duplicates: number, total: number }
 */
export function countScopeDuplicates(packages: Map<string, Package>): {
  duplicates: number
  total: number
} {
  const identityCounts = new Map<string, number>()
  let total = 0

  for (const pkg of packages.values()) {
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
      duplicates += count - 1 // Extra copies beyond the first
    }
  }

  return { duplicates, total }
}

/**
 * Check if a package's internal scope has any unresolved duplicates
 * Used by automation to determine if a scope is stable
 */
export function hasDuplicatesInScope(pkg: Package): boolean {
  if (!pkg.internalPackages) return false
  const { duplicates } = countScopeDuplicates(toRaw(pkg.internalPackages))
  return duplicates > 0
}

/**
 * Check if a package's internal scope has any unresolved conflicts (recursively)
 * Used by automation and packages.ts to determine if a scope is stable
 */
export function hasConflictsInScope(pkg: Package): boolean {
  if (!pkg.internalWires) return false

  // Check this package's internal wires
  for (const wire of pkg.internalWires.values()) {
    if (wire.conflicted) return true
  }

  // Recursively check nested packages
  if (pkg.internalPackages) {
    for (const innerPkg of pkg.internalPackages.values()) {
      if (hasConflictsInScope(innerPkg)) return true
    }
  }

  return false
}

/**
 * Recursively count unresolved duplicates and conflicts across all entered scopes
 * Pristine scopes don't count - they haven't been entered yet
 */
function countAllScopeProblems(packages: Map<string, Package>): {
  duplicates: number
  conflicts: number
  total: number
} {
  let totalDuplicates = 0
  let totalConflicts = 0
  let totalPackages = 0

  for (const pkg of packages.values()) {
    // Only count scopes that have been entered (not pristine)
    if (
      pkg.internalPackages &&
      pkg.internalState !== null &&
      pkg.internalState !== 'pristine'
    ) {
      const internalPkgs = toRaw(pkg.internalPackages)
      const { duplicates, total } = countScopeDuplicates(internalPkgs)
      totalDuplicates += duplicates
      totalPackages += total

      // Count conflicts in this scope's wires
      if (pkg.internalWires) {
        for (const wire of pkg.internalWires.values()) {
          if (wire.conflicted) totalConflicts++
        }
      }

      // Recurse into nested scopes
      const nested = countAllScopeProblems(internalPkgs)
      totalDuplicates += nested.duplicates
      totalConflicts += nested.conflicts
      totalPackages += nested.total
    }
  }

  return {
    duplicates: totalDuplicates,
    conflicts: totalConflicts,
    total: totalPackages,
  }
}

// Efficiency formula constants
const EFFICIENCY_BASE = 0.92 // Each problem reduces efficiency by ~8%
const EFFICIENCY_SCALE_ANCHOR = 60 // Log scale anchored around ~50 packages

/**
 * Calculate efficiency using log-dampened exponential decay
 *
 * Problems (duplicates + conflicts) reduce efficiency exponentially,
 * but the impact is dampened logarithmically as total packages grow.
 *
 * Examples (with 0 conflicts):
 *   100 pkgs, 5 dupes → ~70%
 *   250 pkgs, 5 dupes → ~74%
 *   500 pkgs, 5 dupes → ~77%
 *
 * Conflicts add to the problem count with equal weight.
 */
export function calculateEfficiency(state: GameState): number {
  const rawPackages = toRaw(state.packages)

  const { duplicates, conflicts, total } = countAllScopeProblems(rawPackages)

  if (total === 0) return 1

  // Log-dampened scale factor: ~1.0 at 50 packages, grows slowly
  const scale = Math.log10(total + 10) / Math.log10(EFFICIENCY_SCALE_ANCHOR)

  // Total problems = duplicates + conflicts
  const problems = duplicates + conflicts

  // Exponential decay, dampened by scale
  const efficiency = Math.pow(EFFICIENCY_BASE, problems / scale)

  return Math.max(0, Math.min(1, efficiency))
}

// ============================================
// EFFICIENCY TIERS
// ============================================

export type EfficiencyTier =
  | 'bloated'
  | 'messy'
  | 'decent'
  | 'clean'
  | 'pristine'

/** Thresholds for each tier (exclusive upper bound) */
export const EFFICIENCY_TIER_THRESHOLDS: Record<EfficiencyTier, number> = {
  bloated: 0.3,
  messy: 0.5,
  decent: 0.7,
  clean: 0.85,
  pristine: 1.01, // Slightly over 1 to include 100%
}

/** Get the efficiency tier for a given efficiency value (0-1) */
export function getEfficiencyTier(efficiency: number): EfficiencyTier {
  if (efficiency < 0.3) return 'bloated'
  if (efficiency < 0.5) return 'messy'
  if (efficiency < 0.7) return 'decent'
  if (efficiency < 0.85) return 'clean'
  return 'pristine'
}

// ============================================
// EFFICIENCY TRACKING (runtime state)
// ============================================

let lastEfficiency = 1
let lastEfficiencyTier: EfficiencyTier = 'pristine'

/** Reset efficiency tracking (call on prestige/ship) */
export function resetEfficiencyTracking(): void {
  lastEfficiency = 1
  lastEfficiencyTier = 'pristine'
}

/** Get last tracked efficiency tier */
export function getLastEfficiencyTier(): EfficiencyTier {
  return lastEfficiencyTier
}

/** Update efficiency tracking state */
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

/** Get numeric rank for tier comparison (higher = better) */
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

/** Get progress within current tier (0-1) */
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
 * Recursively collect all scopes (packages with internalState) that have been entered
 * Pristine scopes don't count - they haven't been opened yet
 */
function collectAllEnteredScopes(packages: Map<string, Package>): Package[] {
  const result: Package[] = []

  for (const pkg of packages.values()) {
    // Only count packages that have internal scope and have been entered (not pristine)
    if (pkg.internalState !== null && pkg.internalState !== 'pristine') {
      result.push(pkg)
    }
    // Recursively check nested packages
    // Use toRaw() to handle Vue reactivity on nested maps
    const internalPkgs = pkg.internalPackages
      ? toRaw(pkg.internalPackages)
      : null
    if (internalPkgs && internalPkgs.size > 0) {
      result.push(...collectAllEnteredScopes(internalPkgs))
    }
  }

  return result
}

/**
 * Calculate stability ratio across all entered scopes (not just top-level)
 * Only counts scopes that have been entered (not pristine)
 */
export function calculateStabilityRatio(state: GameState): number {
  const rawPackages = toRaw(state.packages)
  const enteredScopes = collectAllEnteredScopes(rawPackages)

  if (enteredScopes.length === 0) return 1

  const stableCount = enteredScopes.filter(
    (p) => p.internalState === 'stable'
  ).length

  return stableCount / enteredScopes.length
}

/**
 * Calculate cache tokens earned from prestige
 * Formula: floor(base * efficiency_multiplier * stability_bonus)
 *
 * Base reward: sqrt(weight / threshold) * 3
 *   - At exact threshold: ~3 tokens base
 *   - Overshooting gives diminishing returns
 *
 * Efficiency multiplier: 0.5x (0%) to 1.5x (100%)
 *   - This is the BIG lever - optimized trees get 3x more than bloated ones
 *   - Symlinks reduce weight but boost efficiency, so they're worth it
 *
 * Stability bonus: 0.7x (all unstable) to 1.0x (all stable)
 *   - Minor bonus for cleaning up before prestige
 */
export function calculatePrestigeReward(
  state: GameState,
  threshold: number
): number {
  const weight = state.resources.weight

  // Base reward scales with sqrt of progress past threshold
  // At threshold: sqrt(1) * 3 = 3 tokens
  // At 2x threshold: sqrt(2) * 3 = ~4.2 tokens
  const progress = Math.max(0, weight / Math.max(1, threshold))
  const baseReward = Math.sqrt(progress) * 3

  // Efficiency multiplier: 0.5x at 0%, 1.5x at 100%
  // This is the main incentive to optimize
  const efficiencyMultiplier = 0.5 + state.stats.currentEfficiency

  // Stability bonus: 0.7x (all unstable) to 1.0x (all stable)
  const stabilityRatio = calculateStabilityRatio(state)
  const stabilityBonus = 0.7 + stabilityRatio * 0.3

  return Math.max(
    1,
    Math.floor(baseReward * efficiencyMultiplier * stabilityBonus)
  )
}

/**
 * Realistic dependency distribution based on npm ecosystem research
 * 50% of packages are leaf nodes (0 deps), with a heavy tail
 */
const DEPENDENCY_DISTRIBUTION = [
  { count: 0, weight: 50 }, // Leaf nodes - stabilizers
  { count: 1, weight: 15 }, // Minimal deps
  { count: 2, weight: 15 }, // Light
  { count: 3, weight: 10 }, // Normal
  { count: 4, weight: 5 }, // Heavy-ish
  { count: 5, weight: 3 }, // Heavy
  { count: 8, weight: 1.5 }, // Very heavy (webpack-like)
  { count: 12, weight: 0.5 }, // Legendary (jest, create-react-app)
]

const TOTAL_DEP_WEIGHT = DEPENDENCY_DISTRIBUTION.reduce(
  (sum, t) => sum + t.weight,
  0
)

/**
 * Get number of dependencies to spawn (realistic weighted random)
 * Uses npm ecosystem research: 50% leaf nodes, heavy tail for rare massive bursts
 */
export function rollDependencyCount(
  _config: GameConfig = DEFAULT_CONFIG
): number {
  let roll = Math.random() * TOTAL_DEP_WEIGHT

  for (const tier of DEPENDENCY_DISTRIBUTION) {
    roll -= tier.weight
    if (roll <= 0) {
      return tier.count
    }
  }

  return 0 // Fallback to leaf
}

/**
 * Get package size (weight contribution)
 */
export function rollPackageSize(): number {
  // Most packages are small, some are large
  const base = 10 + Math.random() * 40
  const isLarge = Math.random() < 0.1
  return Math.floor(isLarge ? base * 5 : base)
}

/**
 * Get deterministic size for a package based on its identity.
 * Same identity = same size, for visual consistency of duplicates.
 */
export function getIdentitySize(
  identity: { weight: number } | undefined,
  minSize: number = 10
): number {
  if (!identity) return rollPackageSize()
  // Use identity weight directly - no random variance
  // This ensures duplicates of the same package look identical
  return Math.max(minSize, identity.weight)
}
