// Upgrade definitions and purchase logic

import { gameState, spendBandwidth } from './state';

export interface UpgradeDefinition {
  id: string;
  icon: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  unlockAt: number; // Package count to unlock this upgrade
  effect: (level: number) => number;
  // Visual representation type for the effect
  effectType: 'multiplier' | 'rate' | 'reduction';
}

// Effect functions (defined separately to avoid self-reference issues)
const effects = {
  bandwidthRegen: (level: number) => 1 + level * 0.5,
  maxBandwidth: (level: number) => 1000 + level * 500,
  autoInstall: (level: number) => level * 0.2,
  installSpeed: (level: number) => 1 + level * 0.3,
  costReduction: (level: number) => Math.pow(0.92, level),
};

// Upgrade definitions - ordered by unlock progression
export const UPGRADES: Record<string, UpgradeDefinition> = {
  bandwidthRegen: {
    id: 'bandwidthRegen',
    icon: '↓↓',
    maxLevel: 20,
    baseCost: 30,
    costMultiplier: 1.7,
    unlockAt: 3, // First upgrade - unlocks very early
    effect: effects.bandwidthRegen,
    effectType: 'multiplier',
  },
  installSpeed: {
    id: 'installSpeed',
    icon: '⚡',
    maxLevel: 10,
    baseCost: 40,
    costMultiplier: 1.8,
    unlockAt: 8, // Second upgrade
    effect: effects.installSpeed,
    effectType: 'multiplier',
  },
  maxBandwidth: {
    id: 'maxBandwidth',
    icon: '▢+',
    maxLevel: 15,
    baseCost: 100,
    costMultiplier: 2.0,
    unlockAt: 15, // Third upgrade
    effect: effects.maxBandwidth,
    effectType: 'multiplier',
  },
  costReduction: {
    id: 'costReduction',
    icon: '◆−',
    maxLevel: 10,
    baseCost: 150,
    costMultiplier: 2.2,
    unlockAt: 25, // Fourth upgrade
    effect: effects.costReduction,
    effectType: 'reduction',
  },
  autoInstall: {
    id: 'autoInstall',
    icon: '▶▶',
    maxLevel: 10,
    baseCost: 200,
    costMultiplier: 2.5,
    unlockAt: 40, // Fifth upgrade - automation comes later
    effect: effects.autoInstall,
    effectType: 'rate',
  },
};

// Get current level of an upgrade
export function getUpgradeLevel(upgradeId: string): number {
  const key = `${upgradeId}Level` as keyof typeof gameState.upgrades;
  const value = gameState.upgrades[key];
  return typeof value === 'number' ? value : 0;
}

// Set upgrade level
function setUpgradeLevel(upgradeId: string, level: number): void {
  const key = `${upgradeId}Level` as keyof typeof gameState.upgrades;
  if (key in gameState.upgrades) {
    (gameState.upgrades as Record<string, number | boolean>)[key] = level;
  }
}

// Calculate cost for next level
export function getUpgradeCost(upgradeId: string): number {
  const upgrade = UPGRADES[upgradeId];
  if (!upgrade) return Infinity;

  const level = getUpgradeLevel(upgradeId);
  if (level >= upgrade.maxLevel) return Infinity;

  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, level));
}

// Check if upgrade can be purchased
export function canPurchaseUpgrade(upgradeId: string): boolean {
  const upgrade = UPGRADES[upgradeId];
  if (!upgrade) return false;

  const level = getUpgradeLevel(upgradeId);
  if (level >= upgrade.maxLevel) return false;

  const cost = getUpgradeCost(upgradeId);
  return gameState.resources.bandwidth >= cost;
}

// Purchase an upgrade
export function purchaseUpgrade(upgradeId: string): boolean {
  if (!canPurchaseUpgrade(upgradeId)) return false;

  const cost = getUpgradeCost(upgradeId);
  if (!spendBandwidth(cost)) return false;

  const currentLevel = getUpgradeLevel(upgradeId);
  setUpgradeLevel(upgradeId, currentLevel + 1);

  // Apply immediate effects
  applyUpgradeEffects();

  return true;
}

// Apply all upgrade effects to game state
export function applyUpgradeEffects(): void {
  // Max bandwidth
  const maxBwLevel = getUpgradeLevel('maxBandwidth');
  gameState.resources.maxBandwidth = effects.maxBandwidth(maxBwLevel);

  // Bandwidth regen is calculated dynamically in getEffectiveBandwidthRegen
}

// Get effective values with upgrades applied
export function getEffectiveBandwidthRegen(): number {
  const baseRegen = 5; // Increased base regen for better early game
  const regenLevel = getUpgradeLevel('bandwidthRegen');
  const regenMultiplier = effects.bandwidthRegen(regenLevel);

  // Cache token bonus
  const cacheBonus = Math.pow(1.10, gameState.meta.cacheTokens);

  return baseRegen * regenMultiplier * cacheBonus * gameState.meta.ecosystemTier;
}

export function getEffectiveInstallSpeed(): number {
  const speedLevel = getUpgradeLevel('installSpeed');
  return effects.installSpeed(speedLevel);
}

export function getEffectiveCostMultiplier(): number {
  const costLevel = getUpgradeLevel('costReduction');
  return effects.costReduction(costLevel);
}

export function getAutoInstallRate(): number {
  const autoLevel = getUpgradeLevel('autoInstall');
  return effects.autoInstall(autoLevel);
}

// Check if an upgrade is unlocked based on package count
export function isUpgradeUnlocked(upgradeId: string): boolean {
  const upgrade = UPGRADES[upgradeId];
  if (!upgrade) return false;
  return gameState.packages.size >= upgrade.unlockAt;
}

// Get list of unlocked upgrades for UI (sorted by unlock order)
export function getUnlockedUpgrades(): UpgradeDefinition[] {
  return Object.values(UPGRADES)
    .filter(u => isUpgradeUnlocked(u.id))
    .sort((a, b) => a.unlockAt - b.unlockAt);
}

// Get the next upgrade that will unlock (for teaser display)
export function getNextLockedUpgrade(): UpgradeDefinition | null {
  const locked = Object.values(UPGRADES)
    .filter(u => !isUpgradeUnlocked(u.id))
    .sort((a, b) => a.unlockAt - b.unlockAt);
  return locked[0] || null;
}

// Get all upgrades (for internal use)
export function getAllUpgrades(): UpgradeDefinition[] {
  return Object.values(UPGRADES);
}

// Calculate install cost with upgrades applied
export function getEffectiveInstallCost(): number {
  const packageCount = gameState.packages.size;
  const baseCost = 10; // Base cost
  const scaledCost = baseCost * Math.pow(1.12, packageCount); // Slightly lower scaling
  const costMultiplier = getEffectiveCostMultiplier();
  return Math.floor(scaledCost * costMultiplier);
}
