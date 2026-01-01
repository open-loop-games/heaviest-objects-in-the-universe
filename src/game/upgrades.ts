// Upgrade definitions and purchase logic
// 2 core upgrades: Bandwidth, Efficiency

import { gameState, spendBandwidth } from './state'

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
  // Bandwidth: capacity + stabilization burst bonus
  // Capacity: modest linear scaling to keep UI bar readable
  // Regen removed - momentum loop uses activity-driven generation
  bandwidthCapacity: (level: number) => {
    const base = 1000
    const linearGrowth = 1 + level * 0.1 // +10% per level, max 2.5x at L15
    const tierMultiplier = gameState.meta.ecosystemTier // 1-5x from tier
    const tokenBonus = 1 + Math.sqrt(gameState.meta.cacheTokens) * 0.05 // Mild token scaling
    return Math.floor(base * linearGrowth * tierMultiplier * tokenBonus)
  },

  // Stabilization burst: +10% per bandwidth level
  stabilizationBonus: (level: number) => 1 + level * 0.1,

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
// Costs rebalanced for momentum loop with reduced capacity ceiling
export const UPGRADES: Record<string, UpgradeDefinition> = {
  bandwidth: {
    id: 'bandwidth',
    icon: '↓',
    maxLevel: 15,
    baseCost: 80,
    costMultiplier: 1.35,
    unlockAt: 3,
    prestigeRequirement: 1, // Gate behind first prestige to prevent poor early states
  },
  efficiency: {
    id: 'efficiency',
    icon: '⚡',
    maxLevel: 12,
    baseCost: 120,
    costMultiplier: 1.4,
    unlockAt: 15,
  },
  compression: {
    id: 'compression',
    icon: '◆↓',
    maxLevel: 8,
    baseCost: 200,
    costMultiplier: 1.5,
    unlockAt: 0,
    prestigeRequirement: 3, // Only visible after 3 prestiges
  },
  resolveSpeed: {
    id: 'resolveSpeed',
    icon: '⚙+',
    maxLevel: 5,
    baseCost: 100,
    costMultiplier: 1.35,
    unlockAt: 0,
    tierRequirement: 2,
  },
  surge: {
    id: 'surge',
    icon: '◎', // Ripple/burst icon (placeholder, component uses SVG)
    maxLevel: 9, // 1 base + 9 upgrades = 10 total segments
    baseCost: 150,
    costMultiplier: 1.3,
    unlockAt: 0,
    prestigeRequirement: 2, // Unlocks after P2
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

  // Surge unlocked segments from surge upgrade
  const surgeLevel = getUpgradeLevel('surge')
  gameState.surge.unlockedSegments = 1 + surgeLevel
}

// Get effective values with upgrades applied
export function getEffectiveBandwidthRegen(): number {
  // Safety regen by tier: [2, 2.5, 3, 3.5, 4] BW/sec
  // This is minimal - momentum loop generates most BW from activity
  const tier = gameState.meta.ecosystemTier
  const safetyRegen = SAFETY_REGEN_BY_TIER[tier] ?? 2

  // Low bandwidth catch-up: 100% boost when below 20 bandwidth
  const lowBandwidthBoost = gameState.resources.bandwidth < 20 ? 2 : 1

  return safetyRegen * lowBandwidthBoost
}

export function getEffectiveInstallSpeed(): number {
  const effLevel = getUpgradeLevel('efficiency')
  return effects.installSpeed(effLevel)
}

// Get stabilization burst bonus from bandwidth upgrade
// Used when a scope stabilizes to reward activity
export function getStabilizationBonus(): number {
  const bwLevel = getUpgradeLevel('bandwidth')
  return effects.stabilizationBonus(bwLevel)
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

import { SAFETY_REGEN_BY_TIER } from './config'

// Check if an upgrade is unlocked based on package count, prestige, and tier
export function isUpgradeUnlocked(upgradeId: string): boolean {
  const upgrade = UPGRADES[upgradeId]
  if (!upgrade) return false

  // Check prestige requirement (e.g., compression requires P3+)
  const prestigeMet =
    !upgrade.prestigeRequirement ||
    gameState.meta.totalPrestiges >= upgrade.prestigeRequirement

  if (!prestigeMet) {
    return false
  }

  // Check package count requirement (skip if prestige requirement was set and met)
  // Prestige gates are more meaningful than package count for returning players
  if (
    !upgrade.prestigeRequirement &&
    gameState.packages.size < upgrade.unlockAt
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

// Calculate install cost with upgrades applied (momentum loop version)
// Install is the entry gate to cascades - cost scales with tier and active scopes
// Cascades themselves are FREE (removed DEP_SPAWN_COST)
export function getEffectiveInstallCost(): number {
  const tier = gameState.meta.ecosystemTier

  // Count active (non-stable) scopes for scaling
  // Each active scope makes the next install more expensive
  const activeScopes = countActiveScopes()

  // Base cost scales with tier: 25 → 50 → 75 → 100 → 125
  const baseCost = 25 * tier

  // Active scope multiplier: 1.15^activeScopes
  const scopeMultiplier = Math.pow(1.15, activeScopes)

  // Apply efficiency upgrade discount
  const costMultiplier = getEffectiveCostMultiplier()

  return Math.floor(baseCost * scopeMultiplier * costMultiplier)
}

/**
 * Count currently active (non-stable) top-level packages
 * Used for install cost scaling
 */
function countActiveScopes(): number {
  let count = 0
  for (const pkg of gameState.packages.values()) {
    // Only count top-level packages (direct children of root)
    if (pkg.parentId === gameState.rootId) {
      // Count if not stable (pristine, unstable, or null internal state)
      if (pkg.internalState !== 'stable') {
        count++
      }
    }
  }
  return count
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
