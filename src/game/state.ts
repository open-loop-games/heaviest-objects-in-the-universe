// Reactive game state management using Vue
//
// Pattern rationale:
// - reactive() for large nested objects mutated in-place (gameState, gameConfig)
// - ref() for primitives or objects replaced wholesale (collapseState, dragState)

import { reactive, ref, computed, type ComputedRef } from 'vue'
import { type GameState, type GameConfig, type UserSettings } from './types'
import { DEFAULT_CONFIG, createInitialState, TIER_THRESHOLDS } from './config'
import {
  calculatePrestigeReward,
  getPrestigeThreshold,
  getEcosystemTier,
  getMaxCompressedDepth,
} from './formulas'

// Global reactive game state
export const gameState = reactive<GameState>(createInitialState())

// Global config (can be modified for balancing)
export const gameConfig = reactive<GameConfig>({ ...DEFAULT_CONFIG })

// User settings (separate from game state, persists independently)
export const userSettings = ref<UserSettings>({
  backgroundClickToExit: false,
})

// ============================================
// COMPUTED VALUES
// ============================================

// Current prestige threshold (dynamic based on progress)
export const computed_prestigeThreshold: ComputedRef<number> = computed(() => {
  return getPrestigeThreshold(gameState.meta.timesShipped)
})

// Gravity: progress toward prestige (0 to 1+)
// Simple formula: weight / threshold
// Efficiency affects rewards, not when you can ship
export const computed_gravity: ComputedRef<number> = computed(() => {
  const threshold = computed_prestigeThreshold.value
  if (threshold <= 0) return 0
  return gameState.resources.weight / threshold
})

export const computed_prestigeReward: ComputedRef<number> = computed(() => {
  return calculatePrestigeReward(gameState, computed_prestigeThreshold.value)
})

// Prestige unlocks when max weight ever reached >= threshold
// Uses peak weight so optimization (merging) doesn't drop below threshold
export const computed_canPrestige: ComputedRef<boolean> = computed(() => {
  const threshold = computed_prestigeThreshold.value
  return gameState.stats.maxWeightReached >= threshold
})

// ============================================
// ECOSYSTEM TIER HELPERS
// ============================================

/**
 * Update the stored ecosystemTier to match current cache tokens.
 * Call this after prestige or when loading a save.
 */
export function syncEcosystemTier(): void {
  gameState.meta.ecosystemTier = getEcosystemTier(gameState.meta.cacheTokens)
}

// Computed ecosystem tier (reactive)
export const computed_ecosystemTier: ComputedRef<number> = computed(() => {
  return getEcosystemTier(gameState.meta.cacheTokens)
})

// Computed max depth (reactive)
export const computed_maxDepth: ComputedRef<number> = computed(() => {
  return getMaxCompressedDepth(gameState.meta.cacheTokens)
})

// Tokens needed for next tier (for UI progress display)
export const computed_nextTierThreshold: ComputedRef<number | null> = computed(
  () => {
    const currentTier = computed_ecosystemTier.value
    if (currentTier >= TIER_THRESHOLDS.length) return null // Max tier
    return TIER_THRESHOLDS[currentTier] ?? null
  }
)

// Progress toward next tier (0-1)
export const computed_tierProgress: ComputedRef<number> = computed(() => {
  const currentTier = computed_ecosystemTier.value
  const tokens = gameState.meta.cacheTokens

  if (currentTier >= TIER_THRESHOLDS.length) return 1 // Max tier

  const currentThreshold = TIER_THRESHOLDS[currentTier - 1] ?? 0
  const nextThreshold = TIER_THRESHOLDS[currentTier] ?? 0

  const range = nextThreshold - currentThreshold
  if (range <= 0) return 1 // Safety check
  const progress = tokens - currentThreshold

  return Math.min(1, progress / range)
})

// Collapse availability (Tier 5 only)
export const computed_canCollapse: ComputedRef<boolean> = computed(() => {
  return computed_ecosystemTier.value >= 5
})

// Endless mode state
export const computed_isEndlessMode: ComputedRef<boolean> = computed(() => {
  return gameState.meta.endlessMode
})

// ============================================
// RESOURCE MUTATIONS (simple state changes)
// ============================================

/**
 * Spend bandwidth if available
 * @returns true if spent successfully, false if insufficient
 */
export function spendBandwidth(amount: number): boolean {
  if (gameState.resources.bandwidth >= amount) {
    gameState.resources.bandwidth -= amount
    return true
  }
  return false
}
