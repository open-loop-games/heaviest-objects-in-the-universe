// Cost and production formulas based on design doc

import { toRaw } from 'vue';
import type { GameState, GameConfig } from './types';
import { DEFAULT_CONFIG } from './config';

/**
 * Calculate the cost to install the next package
 * Formula: baseCost * multiplier^(owned - free)
 */
export function getInstallCost(
  ownedPackages: number,
  freePackages: number = 0,
  config: GameConfig = DEFAULT_CONFIG
): number {
  const effectiveOwned = Math.max(0, ownedPackages - freePackages);
  return Math.floor(config.baseBandwidthCost * Math.pow(config.costMultiplier, effectiveOwned));
}

// Note: getEffectiveBandwidthRegen is now in upgrades.ts (uses upgrade system)

/**
 * Calculate efficiency based on unique package identities vs total
 * Efficiency = unique / total (1.0 = perfect, lower = more duplicates)
 */
export function calculateEfficiency(state: GameState): number {
  // Use toRaw() to avoid Vue reactivity tracking
  const packages = Array.from(toRaw(state.packages).values());
  if (packages.length === 0) return 1;

  // Count unique package identities vs total
  const identityCounts = new Map<string, number>();
  for (const pkg of packages) {
    const key = pkg.identity?.name || pkg.id; // Use identity name or fallback to id
    identityCounts.set(key, (identityCounts.get(key) || 0) + 1);
  }

  // Count packages that appear more than once (duplicates)
  let duplicateCount = 0;
  for (const count of identityCounts.values()) {
    if (count > 1) {
      duplicateCount += count - 1; // Extra copies beyond the first
    }
  }

  // Base efficiency: fewer duplicates = higher efficiency
  const baseEfficiency = 1 - (duplicateCount / packages.length);

  // Bonus for symlink merges performed (much more impactful now)
  // Each merge is worth 0.15 efficiency (capped at 1.0 total)
  const mergeCount = state.stats.totalSymlinksCreated;
  const mergeBonus = mergeCount * 0.15;

  return Math.min(1, baseEfficiency + mergeBonus);
}

/**
 * Calculate stability ratio (stable packages / total top-level packages)
 */
export function calculateStabilityRatio(state: GameState): number {
  const packages = Array.from(toRaw(state.packages).values());

  // Only count top-level packages (direct children of root)
  const topLevelPackages = packages.filter(p => p.parentId === state.rootId);
  if (topLevelPackages.length === 0) return 1;

  const stableCount = topLevelPackages.filter(p => p.internalState === 'stable').length;
  return stableCount / topLevelPackages.length;
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
export function calculatePrestigeReward(state: GameState, threshold: number): number {
  const weight = state.resources.weight;

  // Base reward scales with sqrt of progress past threshold
  // At threshold: sqrt(1) * 3 = 3 tokens
  // At 2x threshold: sqrt(2) * 3 = ~4.2 tokens
  const progress = Math.max(0, weight / Math.max(1, threshold));
  const baseReward = Math.sqrt(progress) * 3;

  // Efficiency multiplier: 0.5x at 0%, 1.5x at 100%
  // This is the main incentive to optimize
  const efficiencyMultiplier = 0.5 + state.stats.currentEfficiency;

  // Stability bonus: 0.7x (all unstable) to 1.0x (all stable)
  const stabilityRatio = calculateStabilityRatio(state);
  const stabilityBonus = 0.7 + (stabilityRatio * 0.3);

  return Math.max(1, Math.floor(baseReward * efficiencyMultiplier * stabilityBonus));
}

/**
 * Realistic dependency distribution based on npm ecosystem research
 * 50% of packages are leaf nodes (0 deps), with a heavy tail
 */
const DEPENDENCY_DISTRIBUTION = [
  { count: 0, weight: 50 },   // Leaf nodes - stabilizers
  { count: 1, weight: 15 },   // Minimal deps
  { count: 2, weight: 15 },   // Light
  { count: 3, weight: 10 },   // Normal
  { count: 4, weight: 5 },    // Heavy-ish
  { count: 5, weight: 3 },    // Heavy
  { count: 8, weight: 1.5 },  // Very heavy (webpack-like)
  { count: 12, weight: 0.5 }, // Legendary (jest, create-react-app)
];

const TOTAL_DEP_WEIGHT = DEPENDENCY_DISTRIBUTION.reduce((sum, t) => sum + t.weight, 0);

/**
 * Get number of dependencies to spawn (realistic weighted random)
 * Uses npm ecosystem research: 50% leaf nodes, heavy tail for rare massive bursts
 */
export function rollDependencyCount(_config: GameConfig = DEFAULT_CONFIG): number {
  let roll = Math.random() * TOTAL_DEP_WEIGHT;

  for (const tier of DEPENDENCY_DISTRIBUTION) {
    roll -= tier.weight;
    if (roll <= 0) {
      return tier.count;
    }
  }

  return 0; // Fallback to leaf
}

/**
 * Get package size (weight contribution)
 */
export function rollPackageSize(): number {
  // Most packages are small, some are large
  const base = 10 + Math.random() * 40;
  const isLarge = Math.random() < 0.1;
  return Math.floor(isLarge ? base * 5 : base);
}

/**
 * Format large numbers for display
 */
export function formatNumber(n: number): string {
  if (n < 1000) return Math.floor(n).toString();
  if (n < 1000000) return (n / 1000).toFixed(1) + 'K';
  if (n < 1000000000) return (n / 1000000).toFixed(1) + 'M';
  return (n / 1000000000).toFixed(1) + 'G';
}

/**
 * Format weight as bytes
 */
export function formatWeight(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}
