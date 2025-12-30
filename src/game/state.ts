// Reactive game state management using Vue

import { reactive, computed, type ComputedRef } from 'vue'
import { type GameState, type GameConfig } from './types'
import {
  DEFAULT_CONFIG,
  createInitialState,
  TIER_THRESHOLDS,
  TIER_MAX_DEPTH,
  BASE_COMPRESSION_CHANCE,
  COMPRESSION_PER_TOKEN,
  COMPRESSION_SOFTCAP,
  COMPRESSION_HARDCAP,
  DEPTH_COMPRESSION_MULT,
} from './config'
import { calculatePrestigeReward } from './formulas'

// Global reactive game state
export const gameState = reactive<GameState>(createInitialState())

// Global config (can be modified for balancing)
export const gameConfig = reactive<GameConfig>({ ...DEFAULT_CONFIG })

// ============================================
// DYNAMIC PRESTIGE THRESHOLD
// ============================================

/**
 * Calculate prestige threshold based on total prestiges completed
 * - First prestige: 5,000 (intro/tutorial)
 * - Second prestige: 20,000
 * - Third+: 20,000 * 1.8^(n-2) scaling
 */
export function getPrestigeThreshold(totalPrestiges: number): number {
  if (totalPrestiges === 0) return 5000 // First prestige - intro
  if (totalPrestiges === 1) return 20000 // Second prestige
  // Scaling: 20k, 36k, 65k, 117k, 210k, ...
  return Math.floor(20000 * Math.pow(1.8, totalPrestiges - 1))
}

// ============================================
// COMPUTED VALUES
// ============================================

// Current prestige threshold (dynamic based on progress)
export const computed_prestigeThreshold: ComputedRef<number> = computed(() => {
  return getPrestigeThreshold(gameState.meta.totalPrestiges)
})

// Gravity: progress toward prestige (0 to 1+)
export const computed_gravity: ComputedRef<number> = computed(() => {
  const threshold = computed_prestigeThreshold.value
  if (threshold <= 0) return 0
  return gameState.resources.weight / threshold
})

export const computed_prestigeReward: ComputedRef<number> = computed(() => {
  return calculatePrestigeReward(gameState, computed_prestigeThreshold.value)
})

export const computed_canPrestige: ComputedRef<boolean> = computed(() => {
  return gameState.resources.weight >= computed_prestigeThreshold.value
})

// ============================================
// ECOSYSTEM TIER (Derived from cache tokens)
// ============================================

/**
 * Calculate ecosystem tier from cache token count.
 * Tier determines max depth and automation unlocks.
 *
 * Thresholds: [0, 10, 30, 75, 150] → Tiers 1-5
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
export function getMaxCompressedDepth(cacheTokens?: number): number {
  const tokens = cacheTokens ?? gameState.meta.cacheTokens
  const tier = getEcosystemTier(tokens)
  return TIER_MAX_DEPTH[tier - 1] ?? 1
}

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
  return getMaxCompressedDepth()
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
 * @param cacheTokens Optional token count (defaults to current state)
 * @returns Compression chance (0-1)
 */
export function getCompressionChance(
  depth: number,
  cacheTokens?: number
): number {
  if (depth >= 5) return 0

  const tokens = cacheTokens ?? gameState.meta.cacheTokens
  const baseChance = calculateBaseCompressionChance(tokens)

  const depthIndex = Math.min(depth - 1, DEPTH_COMPRESSION_MULT.length - 1)
  const depthMult = DEPTH_COMPRESSION_MULT[depthIndex] ?? 0

  return baseChance * depthMult
}

/**
 * Get base compression chance (before depth tapering).
 * Useful for UI display.
 */
export function getBaseCompressionChance(cacheTokens?: number): number {
  const tokens = cacheTokens ?? gameState.meta.cacheTokens
  return calculateBaseCompressionChance(tokens)
}

// ============================================
// ACTION COST PREVIEW (for HUD bandwidth bar)
// ============================================

import { ref } from 'vue'

// Track action being previewed (conflict resolve, symlink merge)
export type ActionPreviewType = 'conflict' | 'symlink' | null
export const previewedActionType = ref<ActionPreviewType>(null)

export function setActionPreview(type: ActionPreviewType): void {
  previewedActionType.value = type
}
