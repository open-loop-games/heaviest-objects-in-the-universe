// Cost and production formulas based on design doc

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
 * Calculate efficiency based on unique vs total dependencies
 * Efficiency = unique / total (1.0 = perfect, lower = more duplicates)
 */
export function calculateEfficiency(state: GameState): number {
  const packages = Array.from(state.packages.values());
  if (packages.length === 0) return 1;

  // Count unique versions vs total
  const versionCounts = new Map<string, number>();
  for (const pkg of packages) {
    const key = pkg.version;
    versionCounts.set(key, (versionCounts.get(key) || 0) + 1);
  }

  const uniqueVersions = versionCounts.size;
  const totalPackages = packages.length;

  // Base efficiency + bonus for symlinks
  const symlinks = Array.from(state.wires.values()).filter(w => w.isSymlink).length;
  const symlinkBonus = symlinks * 0.05;

  return Math.min(1, (uniqueVersions / totalPackages) + symlinkBonus);
}

/**
 * Calculate gravity based on weight and structure
 * Gravity = weight^1.5 / structure
 * When gravity > 1, collapse begins
 */
export function calculateGravity(state: GameState): number {
  if (state.resources.weight <= 0) return 0;

  // Structure is based on symlinks and optimization
  const symlinks = Array.from(state.wires.values()).filter(w => w.isSymlink).length;
  const structure = Math.max(1, 10 + symlinks * 5);

  return Math.pow(state.resources.weight, 1.5) / (structure * 10000);
}

/**
 * Calculate cache tokens earned from prestige
 * Formula: floor(sqrt(weight / 1000)) * efficiency_bonus
 */
export function calculatePrestigeReward(state: GameState): number {
  const weight = state.resources.weight;
  const efficiencyBonus = 1 + (state.stats.currentEfficiency * 0.5);

  return Math.floor(Math.sqrt(weight / 1000) * efficiencyBonus);
}

/**
 * Get conflict chance based on current heat
 */
export function getConflictChance(heat: number, config: GameConfig = DEFAULT_CONFIG): number {
  return heat * config.conflictChancePerHeat;
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
 * Get random version shape
 */
export function rollVersionShape(): 'circle' | 'square' | 'triangle' | 'diamond' | 'star' {
  const roll = Math.random();
  if (roll < 0.3) return 'square';    // v1.x - most common
  if (roll < 0.55) return 'triangle'; // v2.x - common
  if (roll < 0.75) return 'diamond';  // v3.x - less common
  if (roll < 0.9) return 'circle';    // stable
  return 'star';                       // rare
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
