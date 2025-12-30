// Upgrade definitions and purchase logic
// 2 core upgrades: Bandwidth, Efficiency

import { gameState } from './state'
import { spendBandwidth } from './mutations'
import { getScopePackageCount } from './scope'

export interface UpgradeDefinition {
  id: string
  icon: string
  maxLevel: number
  baseCost: number
  costMultiplier: number
  unlockAt: number // Package count to unlock
  prestigeRequirement?: number // Only visible after N prestiges
  tierRequirement?: number // Only visible at tier N+
}

// Combined effect functions
const effects = {
  // Bandwidth: increases both regen and capacity
  bandwidthRegen: (level: number) => 1 + level * 0.4, // +40% regen per level
  bandwidthCapacity: (level: number) => 1000 + level * 400, // +400 capacity per level

  // Efficiency: faster installs and lower costs
  installSpeed: (level: number) => 1 + level * 0.25, // +25% speed per level
  costReduction: (level: number) => Math.pow(0.94, level), // -6% cost per level

  // Compression: reduces weight gain (P3+)
  weightReduction: (level: number) => Math.pow(0.95, level), // -5% per level

  // Automation speed upgrades
  drainReduction: (level: number) => Math.pow(0.9, level), // -10% drain per level
  speedBoost: (level: number) => 1 + level * 0.15, // +15% speed per level
}

// Core and automation upgrades
export const UPGRADES: Record<string, UpgradeDefinition> = {
  bandwidth: {
    id: 'bandwidth',
    icon: '↓',
    maxLevel: 15,
    baseCost: 40,
    costMultiplier: 1.6,
    unlockAt: 3,
  },
  efficiency: {
    id: 'efficiency',
    icon: '⚡',
    maxLevel: 12,
    baseCost: 60,
    costMultiplier: 1.8,
    unlockAt: 15,
  },
  compression: {
    id: 'compression',
    icon: '◆↓',
    maxLevel: 8,
    baseCost: 100,
    costMultiplier: 2.0,
    unlockAt: 0,
    prestigeRequirement: 3, // Only visible after 3 prestiges
  },
  resolveSpeed: {
    id: 'resolveSpeed',
    icon: '⚙+',
    maxLevel: 5,
    baseCost: 50,
    costMultiplier: 1.7,
    unlockAt: 0,
    tierRequirement: 2,
  },
  hoistSpeed: {
    id: 'hoistSpeed',
    icon: '⤴+',
    maxLevel: 5,
    baseCost: 60,
    costMultiplier: 1.8,
    unlockAt: 0,
    tierRequirement: 3,
  },
}

// Get current level of an upgrade
export function getUpgradeLevel(upgradeId: string): number {
  const key = `${upgradeId}Level` as keyof typeof gameState.upgrades
  const value = gameState.upgrades[key]
  return typeof value === 'number' ? value : 0
}

// Set upgrade level
function setUpgradeLevel(upgradeId: string, level: number): void {
  const key = `${upgradeId}Level` as keyof typeof gameState.upgrades
  if (key in gameState.upgrades) {
    ;(gameState.upgrades as Record<string, number>)[key] = level
  }
}

// Calculate cost for next level
export function getUpgradeCost(upgradeId: string): number {
  const upgrade = UPGRADES[upgradeId]
  if (!upgrade) return Infinity

  const level = getUpgradeLevel(upgradeId)
  if (level >= upgrade.maxLevel) return Infinity

  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, level))
}

// Check if upgrade can be purchased
export function canPurchaseUpgrade(upgradeId: string): boolean {
  const upgrade = UPGRADES[upgradeId]
  if (!upgrade) return false

  // Must be unlocked (tier/prestige requirements met)
  if (!isUpgradeUnlocked(upgradeId)) return false

  const level = getUpgradeLevel(upgradeId)
  if (level >= upgrade.maxLevel) return false

  const cost = getUpgradeCost(upgradeId)
  return gameState.resources.bandwidth >= cost
}

// Purchase an upgrade
export function purchaseUpgrade(upgradeId: string): boolean {
  if (!canPurchaseUpgrade(upgradeId)) return false

  const cost = getUpgradeCost(upgradeId)
  if (!spendBandwidth(cost)) return false

  const currentLevel = getUpgradeLevel(upgradeId)
  setUpgradeLevel(upgradeId, currentLevel + 1)

  // Apply immediate effects
  applyUpgradeEffects()

  return true
}

// Apply all upgrade effects to game state
export function applyUpgradeEffects(): void {
  // Max bandwidth from bandwidth upgrade
  const bwLevel = getUpgradeLevel('bandwidth')
  gameState.resources.maxBandwidth = effects.bandwidthCapacity(bwLevel)
}

// Get effective values with upgrades applied
export function getEffectiveBandwidthRegen(): number {
  const baseRegen = 5
  const bwLevel = getUpgradeLevel('bandwidth')
  const regenMultiplier = effects.bandwidthRegen(bwLevel)

  // Cache token bonus from prestige (flattened: sqrt scaling instead of exponential)
  // Old: 1.1^tokens → 17× at 30 tokens (breaks balance at P7+)
  // New: 1 + sqrt(tokens) * 0.5 → 3.7× at 30 tokens (maintains sub-20s beats)
  const cacheBonus = 1 + Math.sqrt(gameState.meta.cacheTokens) * 0.5

  return baseRegen * regenMultiplier * cacheBonus * gameState.meta.ecosystemTier
}

export function getEffectiveInstallSpeed(): number {
  const effLevel = getUpgradeLevel('efficiency')
  return effects.installSpeed(effLevel)
}

export function getEffectiveCostMultiplier(): number {
  const effLevel = getUpgradeLevel('efficiency')
  return effects.costReduction(effLevel)
}

// ============================================
// COMPRESSION UPGRADE (P3+)
// ============================================

// Get weight reduction multiplier from compression upgrade
export function getCompressionMultiplier(): number {
  const level = getUpgradeLevel('compression')
  return effects.weightReduction(level)
}

// ============================================
// AUTOMATION SPEED UPGRADES
// ============================================

// Get drain reduction for auto-resolve
export function getResolveDrainMultiplier(): number {
  const level = getUpgradeLevel('resolveSpeed')
  return effects.drainReduction(level)
}

// Get speed boost for auto-resolve
export function getResolveSpeedMultiplier(): number {
  const level = getUpgradeLevel('resolveSpeed')
  return effects.speedBoost(level)
}

// Get drain reduction for auto-hoist
export function getHoistDrainMultiplier(): number {
  const level = getUpgradeLevel('hoistSpeed')
  return effects.drainReduction(level)
}

// Get speed boost for auto-hoist
export function getHoistSpeedMultiplier(): number {
  const level = getUpgradeLevel('hoistSpeed')
  return effects.speedBoost(level)
}

// Check if an upgrade is unlocked based on package count, prestige, and tier
export function isUpgradeUnlocked(upgradeId: string): boolean {
  const upgrade = UPGRADES[upgradeId]
  if (!upgrade) return false

  // Check package count requirement
  if (gameState.packages.size < upgrade.unlockAt) return false

  // Check prestige requirement (e.g., compression requires P3+)
  if (
    upgrade.prestigeRequirement &&
    gameState.meta.totalPrestiges < upgrade.prestigeRequirement
  ) {
    return false
  }

  // Check tier requirement (e.g., resolveSpeed requires Tier 2+)
  if (
    upgrade.tierRequirement &&
    gameState.meta.ecosystemTier < upgrade.tierRequirement
  ) {
    return false
  }

  return true
}

// Get list of unlocked upgrades for UI (sorted by unlock order)
export function getUnlockedUpgrades(): UpgradeDefinition[] {
  return Object.values(UPGRADES)
    .filter((u) => isUpgradeUnlocked(u.id))
    .sort((a, b) => a.unlockAt - b.unlockAt)
}

// Get the next upgrade that will unlock
export function getNextLockedUpgrade(): UpgradeDefinition | null {
  const locked = Object.values(UPGRADES)
    .filter((u) => !isUpgradeUnlocked(u.id))
    .sort((a, b) => a.unlockAt - b.unlockAt)
  return locked[0] || null
}

// Calculate install cost with upgrades applied
// Per-scope scaling: each scope has its own cost curve (resets when entering)
// Tier scaling: higher tiers have higher base costs to match increased regen
export function getEffectiveInstallCost(): number {
  const scopePackageCount = getScopePackageCount()
  const tier = gameState.meta.ecosystemTier
  const baseCost = 10 * tier // 10 → 20 → 30 at tiers 1-3
  const scaledCost = baseCost * Math.pow(1.12, scopePackageCount)
  const costMultiplier = getEffectiveCostMultiplier()
  return Math.floor(scaledCost * costMultiplier)
}

// ============================================
// PREVIEW SYSTEM (for upgrade hover previews)
// ============================================

import { ref } from 'vue'

// Track which upgrade is being previewed
export const previewedUpgradeId = ref<string | null>(null)

export function setPreviewedUpgrade(id: string | null): void {
  previewedUpgradeId.value = id
}

export interface UpgradePreview {
  upgradeId: string
  currentValue: number
  previewValue: number
  percentChange: number
}

// Preview for bandwidth upgrade (shows capacity change)
export function getPreviewBandwidth(): UpgradePreview {
  const upgrade = UPGRADES.bandwidth
  const currentLevel = getUpgradeLevel('bandwidth')
  const nextLevel = Math.min(currentLevel + 1, upgrade?.maxLevel ?? 15)

  const currentValue = effects.bandwidthCapacity(currentLevel)
  const previewValue = effects.bandwidthCapacity(nextLevel)

  return {
    upgradeId: 'bandwidth',
    currentValue,
    previewValue,
    percentChange: ((previewValue - currentValue) / currentValue) * 100,
  }
}

// Preview for efficiency upgrade (shows cost reduction)
export function getPreviewEfficiency(): { current: number; preview: number } {
  const upgrade = UPGRADES.efficiency
  const packageCount = gameState.packages.size
  const baseCost = 10
  const scaledCost = baseCost * Math.pow(1.12, packageCount)

  const currentMultiplier = getEffectiveCostMultiplier()
  const currentLevel = getUpgradeLevel('efficiency')
  const nextLevel = Math.min(currentLevel + 1, upgrade?.maxLevel ?? 12)
  const previewMultiplier = effects.costReduction(nextLevel)

  return {
    current: Math.floor(scaledCost * currentMultiplier),
    preview: Math.floor(scaledCost * previewMultiplier),
  }
}
