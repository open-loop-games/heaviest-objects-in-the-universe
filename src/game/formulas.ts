// Cost and production formulas based on design doc

import { toRaw } from 'vue'
import type { GameState, GameConfig, Package } from './types'
import { DEFAULT_CONFIG } from './config'

// Note: getEffectiveBandwidthRegen is now in upgrades.ts (uses upgrade system)

/**
 * Count unresolved duplicates within a single scope (packages that could be symlink-merged)
 * Returns { duplicates: number, total: number }
 */
function countScopeDuplicates(packages: Map<string, Package>): {
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
 * Recursively count unresolved duplicates across all entered scopes
 * Pristine scopes don't count - they haven't been entered yet
 */
function countAllScopeDuplicates(packages: Map<string, Package>): {
  duplicates: number
  total: number
} {
  let totalDuplicates = 0
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

      // Recurse into nested scopes
      const nested = countAllScopeDuplicates(internalPkgs)
      totalDuplicates += nested.duplicates
      totalPackages += nested.total
    }
  }

  return { duplicates: totalDuplicates, total: totalPackages }
}

/**
 * Calculate efficiency based on unresolved within-scope duplicates
 * Counts duplicates that the player could symlink-merge but hasn't
 * Pristine scopes don't count (not entered yet)
 */
export function calculateEfficiency(state: GameState): number {
  const rawPackages = toRaw(state.packages)

  const { duplicates, total } = countAllScopeDuplicates(rawPackages)

  // Debug: log duplicate info (throttled)
  if (Math.random() < 0.03) {
    console.log(`[Efficiency] Unresolved scope dupes: ${duplicates}/${total}`)
  }

  if (total === 0) return 1

  // Efficiency = 1 - (unresolved duplicates / total packages in entered scopes)
  const efficiency = 1 - duplicates / total

  return efficiency
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
