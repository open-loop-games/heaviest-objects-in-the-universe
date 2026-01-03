// Prestige system - reset and meta-progression logic

import { FRAGMENT_TO_TOKEN_RATIO, getDefaultZoom } from './config'
import { calculatePrestigeReward } from './formulas'
import { gameState, computed_canPrestige, syncEcosystemTier } from './state'
import { getPrestigeThreshold } from './formulas'
import { saveToLocalStorage, clearSavedGame } from './persistence'
import { emit } from './events'
import { createInitialState } from './config'

// ============================================
// EFFICIENCY TRACKING (for tier-up detection)
// ============================================

import { getEfficiencyTier, type EfficiencyTier } from './formulas'

let lastEfficiency = 1
let lastEfficiencyTier: EfficiencyTier = 'pristine'

/** Reset efficiency tracking (call on prestige) */
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

// ============================================
// PRESTIGE & RESET
// ============================================

export function performPrestige(): void {
  // Reset ghost hand hint timers on meaningful player action
  emit('player:action')

  const threshold = getPrestigeThreshold(gameState.meta.totalPrestiges)
  const reward = calculatePrestigeReward(gameState, threshold)

  // Mark first prestige complete for onboarding
  if (!gameState.onboarding.firstPrestigeComplete) {
    gameState.onboarding.firstPrestigeComplete = true
  }

  // Convert fragments to bonus tokens (scaled by efficiency/stability)
  // Poor quality runs get reduced fragment conversion (20% floor, 100% at perfect quality)
  const avgQuality =
    (gameState.stats.currentEfficiency + gameState.stats.currentStability) / 2
  const qualityMultiplier = 0.2 + 0.8 * Math.min(1, avgQuality)
  const fragmentBonus = Math.floor(
    (gameState.resources.cacheFragments / FRAGMENT_TO_TOKEN_RATIO) *
      qualityMultiplier
  )

  // Add meta rewards (base reward + fragment bonus)
  gameState.meta.cacheTokens += reward + fragmentBonus
  gameState.meta.totalPrestiges++

  // Sync ecosystem tier (derived from cache tokens)
  syncEcosystemTier()

  // Reset current run
  gameState.packages.clear()
  gameState.wires.clear()
  gameState.rootId = null

  // Reset scope system
  gameState.currentScope = 'root'
  gameState.scopeStack = []
  gameState.tutorialGating = false // Relax gating after first prestige

  // Reset cascade system
  gameState.cascade.active = false
  gameState.cascade.scopePackageId = null
  gameState.cascade.pendingSpawns = []

  // Reset automation system (toggles reset to off each run)
  gameState.automation.resolveEnabled = false
  gameState.automation.resolveActive = false
  gameState.automation.resolveTargetWireId = null
  gameState.automation.resolveTargetScope = null
  gameState.automation.processStartTime = 0
  gameState.automation.lastResolveTime = 0

  // Reset surge (charge resets, unlocked segments preserved via upgrade)
  gameState.surge.chargedSegments = 0
  gameState.surge.unlockedSegments = 1 + gameState.upgrades.surgeLevel

  gameState.resources.bandwidth = 100 * gameState.meta.ecosystemTier
  gameState.resources.weight = 0
  gameState.resources.cacheFragments = 0

  // Keep upgrades but reset level-specific progress
  gameState.stats.currentEfficiency = 1
  gameState.stats.currentStability = 1
  resetEfficiencyTracking()

  // Reset camera
  gameState.camera.x = 0
  gameState.camera.y = 0
  gameState.camera.zoom = getDefaultZoom()

  // Save immediately after prestige
  saveToLocalStorage()
}

export function triggerPrestigeWithAnimation(): void {
  if (!computed_canPrestige.value) return

  // Emit prestige start event with completion callback
  emit('prestige:start', {
    onComplete: () => {
      performPrestige()
      emit('prestige:complete')
    },
  })
}

/**
 * Soft reset: restart current run but keep meta progress (prestige, cache tokens, upgrades)
 */
export function softReset(): void {
  // Clear current run state
  gameState.packages.clear()
  gameState.wires.clear()
  gameState.rootId = null

  // Reset scope
  gameState.currentScope = 'root'

  // Reset resources to base values (scaled by tier)
  gameState.resources.bandwidth = 100 * gameState.meta.ecosystemTier
  gameState.resources.weight = 0
  gameState.resources.cacheFragments = 0

  // Reset run stats but keep lifetime stats structure
  gameState.stats.currentEfficiency = 1
  gameState.stats.currentStability = 1
  resetEfficiencyTracking()

  // Reset surge charge (keep unlocked segments)
  gameState.surge.chargedSegments = 0

  // Reset camera
  gameState.camera.x = 0
  gameState.camera.y = 0
  gameState.camera.zoom = getDefaultZoom()

  // Reset onboarding for this run (but intro already seen)
  gameState.onboarding.firstClickComplete = false
  gameState.onboarding.firstDivablePackageSeen = false
  // Keep introAnimationComplete and firstPrestigeComplete

  // Save after soft reset
  saveToLocalStorage()
}

/**
 * Hard reset: wipe everything and start completely fresh
 */
export function hardReset(): void {
  // Clear localStorage first
  clearSavedGame()
  // Reset all state to initial
  Object.assign(gameState, createInitialState())
}
