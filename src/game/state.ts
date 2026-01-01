// Reactive game state management using Vue
//
// Pattern rationale:
// - reactive() for large nested objects mutated in-place (gameState, gameConfig)
// - ref() for primitives or objects replaced wholesale (collapseState, dragState)

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
// Compound formula: raw progress boosted by efficiency
// At 0% efficiency: 0.7x speed (bloat penalty)
// At 50% efficiency: 1.0x speed (neutral)
// At 100% efficiency: 1.3x speed (optimization reward)
export const computed_gravity: ComputedRef<number> = computed(() => {
  const threshold = computed_prestigeThreshold.value
  if (threshold <= 0) return 0

  const rawProgress = gameState.resources.weight / threshold
  const efficiency = gameState.stats.currentEfficiency

  // Efficiency boost: 0.7 + (efficiency × 0.6)
  // Range: 0.7x (0% eff) → 1.0x (50% eff) → 1.3x (100% eff)
  const efficiencyBoost = 0.7 + efficiency * 0.6

  return rawProgress * efficiencyBoost
})

export const computed_prestigeReward: ComputedRef<number> = computed(() => {
  return calculatePrestigeReward(gameState, computed_prestigeThreshold.value)
})

// Raw gravity (without efficiency boost) - for UI comparison
export const computed_rawGravity: ComputedRef<number> = computed(() => {
  const threshold = computed_prestigeThreshold.value
  if (threshold <= 0) return 0
  return gameState.resources.weight / threshold
})

// Prestige unlocks when compound gravity >= 1
// Optimized players can prestige with less raw weight
export const computed_canPrestige: ComputedRef<boolean> = computed(() => {
  return computed_gravity.value >= 1
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

// ============================================
// COLLAPSE STATE (for prestige spaghettification)
// ============================================

export interface CollapseState {
  active: boolean
  progress: number // 0-1 overall collapse progress
  targetX: number // Black hole position in world coordinates
  targetY: number // Black hole position in world coordinates
  startTime: number // When collapse started
  absorbedPackages: Set<string> // Packages that have been consumed
}

export const collapseState = ref<CollapseState>({
  active: false,
  progress: 0,
  targetX: 0,
  targetY: 0,
  startTime: 0,
  absorbedPackages: new Set(),
})

export function startCollapse(targetX: number, targetY: number): void {
  collapseState.value = {
    active: true,
    progress: 0,
    targetX,
    targetY,
    startTime: Date.now(),
    absorbedPackages: new Set(),
  }
}

export function endCollapse(): void {
  collapseState.value = {
    active: false,
    progress: 0,
    targetX: 0,
    targetY: 0,
    startTime: 0,
    absorbedPackages: new Set(),
  }
}

export function markPackageAbsorbed(pkgId: string): void {
  collapseState.value.absorbedPackages.add(pkgId)
}

// ============================================
// DRAG STATE (for physics freeze during drag)
// ============================================

export interface DragState {
  packageId: string | null // Package being dragged (null = no drag)
  isInternalScope: boolean // Whether drag is in an internal scope
}

export const dragState = ref<DragState>({
  packageId: null,
  isInternalScope: false,
})

export function startDrag(packageId: string, isInternalScope: boolean): void {
  dragState.value = { packageId, isInternalScope }
}

export function endDrag(): void {
  dragState.value = { packageId: null, isInternalScope: false }
}

// ============================================
// WIGGLE STATE (for non-draggable nodes)
// ============================================

/** Duration of wiggle animation in ms */
const WIGGLE_DURATION = 400

/** Wiggle oscillation frequency */
const WIGGLE_FREQUENCY = 0.05

// Maps packageId -> wiggle end time (Date.now() timestamp)
export const wiggleState = ref<Map<string, number>>(new Map())

export function triggerWiggle(packageId: string): void {
  wiggleState.value.set(packageId, Date.now() + WIGGLE_DURATION)
}

export function isWiggling(packageId: string): boolean {
  const endTime = wiggleState.value.get(packageId)
  if (!endTime) return false
  if (Date.now() > endTime) {
    wiggleState.value.delete(packageId)
    return false
  }
  return true
}

export function getWigglePhase(packageId: string): number {
  const endTime = wiggleState.value.get(packageId)
  if (!endTime) return 0
  const remaining = endTime - Date.now()
  if (remaining <= 0) return 0
  // Phase oscillates during wiggle duration
  return (
    Math.sin((WIGGLE_DURATION - remaining) * WIGGLE_FREQUENCY) *
    (remaining / WIGGLE_DURATION)
  )
}

// ============================================
// CASCADE STARVED STATE
// ============================================

// True when cascade is waiting on bandwidth to spawn more packages
export const cascadeStarved = ref(false)

export function setCascadeStarved(starved: boolean): void {
  cascadeStarved.value = starved
}
