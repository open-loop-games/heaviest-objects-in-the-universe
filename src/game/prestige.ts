// Prestige system - reset utilities
//
// Note: Ship (soft prestige) logic is in ship.ts
// Efficiency tracking is in formulas.ts

import { getDefaultZoom, createInitialState } from './config'
import { gameState } from './state'
import { saveToLocalStorage, clearSavedGame } from './persistence'
import { resetEfficiencyTracking } from './formulas'

// ============================================
// RESET UTILITIES
// ============================================

/**
 * Soft reset: restart current run but keep meta progress (ships, cache tokens, upgrades)
 */
export function softReset(): void {
  // Clear current run state
  gameState.packages.clear()
  gameState.wires.clear()
  gameState.rootId = null

  // Reset scope
  gameState.currentScope = 'root'
  gameState.scopeStack = []

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
