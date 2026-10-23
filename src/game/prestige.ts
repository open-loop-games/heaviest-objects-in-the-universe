// Prestige system - reset utilities
//
// Note: Ship (soft prestige) logic is in ship.ts
// Efficiency tracking is in formulas.ts

import { getDefaultZoom, createInitialState } from './config'
import { gameState, resetGraphAndStack } from './state'
import { saveToLocalStorage, clearSavedGame } from './persistence'
import { resetEfficiencyTracking } from './formulas'
import { seedRNG } from '@open-loop/engine'
import { resetRunCounters } from './mutations'
import { clearCascadeQueue } from './cascade'
import { resetCrossPackageState } from './cross-package'
import { resetPhysicsState } from './physics'

// ============================================
// RESET UTILITIES
// ============================================

/**
 * Soft reset: restart current run but keep meta progress
 * (ships, cache tokens, upgrades).
 */
export function softReset(): void {
  gameState.seed = Date.now()
  seedRNG(gameState.seed)

  resetGraphAndStack()
  clearCascadeQueue()
  resetCrossPackageState()
  resetPhysicsState()

  gameState.resources.weight = 0
  gameState.resources.cacheFragments = 0

  gameState.stats.currentEfficiency = 1
  gameState.stats.currentStability = 1
  resetEfficiencyTracking()
  resetRunCounters()

  gameState.camera.x = 0
  gameState.camera.y = 0
  gameState.camera.zoom = getDefaultZoom()

  gameState.onboarding.firstClickComplete = false
  gameState.onboarding.firstDivablePackageSeen = false

  saveToLocalStorage()
}

/**
 * Hard reset: wipe everything and start completely fresh.
 */
export function hardReset(): void {
  clearSavedGame()
  wipeGame()
}

/**
 * Replace all game state, graph and transient systems with a fresh game.
 * Achievements and settings live outside it and survive.
 */
export function wipeGame(): void {
  Object.assign(gameState, createInitialState())
  resetGraphAndStack()
  clearCascadeQueue()
  resetCrossPackageState()
  resetPhysicsState()
  seedRNG(gameState.seed)
}
