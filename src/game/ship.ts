// Ship to npm - soft prestige (repeatable)
//
// Replaces the previous "prestige" mechanic with themed naming.
// Ships current run's packages to the npm registry mass, gaining cache tokens.

import { FRAGMENT_TO_TOKEN_RATIO, getDefaultZoom } from './config'
import { calculatePrestigeReward, getPrestigeThreshold } from './formulas'
import { gameState, computed_canPrestige, syncEcosystemTier } from './state'
import { saveToLocalStorage } from './persistence'
import { emit } from './events'
import { resetEfficiencyTracking } from './formulas'

// ============================================
// SHIP TO NPM (Soft Prestige)
// ============================================

/**
 * Perform ship to npm - resets run, grants cache tokens
 * This is the new name for what was "performPrestige"
 */
export function performShip(): void {
  // Reset ghost hand hint timers on meaningful player action
  emit('player:action')

  const threshold = getPrestigeThreshold(gameState.meta.timesShipped)
  const reward = calculatePrestigeReward(gameState, threshold)

  // Track tier before for tier-up detection
  const tierBefore = gameState.meta.ecosystemTier
  const efficiency = gameState.stats.currentEfficiency

  // Track lifetime stats before reset
  gameState.stats.totalWeight += gameState.resources.weight
  gameState.stats.peakEfficiency = Math.max(
    gameState.stats.peakEfficiency,
    gameState.stats.currentEfficiency
  )

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
  gameState.meta.timesShipped++

  // Sync ecosystem tier (derived from cache tokens)
  syncEcosystemTier()

  // Emit reward event for visual feedback (before state reset)
  emit('ship:reward', {
    tokensEarned: reward,
    fragmentBonus,
    tierBefore,
    tierAfter: gameState.meta.ecosystemTier,
    efficiency,
  })

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

  // Save immediately after ship
  saveToLocalStorage()
}

/**
 * Trigger ship with animation
 * Emits ship:start event with callback for animation system
 */
export function triggerShipWithAnimation(): void {
  if (!computed_canPrestige.value) return

  // Emit ship start event with completion callback
  emit('ship:start', {
    onComplete: () => {
      performShip()
      emit('ship:complete')
    },
  })
}

/**
 * Check if ship is available
 */
export function canShip(): boolean {
  return computed_canPrestige.value
}
