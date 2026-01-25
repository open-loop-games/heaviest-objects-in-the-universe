// Collapse - hard end (Tier 5 finale)
//
// The dramatic finale that uses the black hole animation.
// Requires Tier 5 (63+ cache tokens) and a 5-second hold gesture.

import {
  COLLAPSE_LOCK_THRESHOLD,
  COLLAPSE_MIN_TIER,
  calculateCollapseDrainProgress,
  createInitialState,
} from './config'
import { createRootPackage } from './packages'
import { gameState, computed_ecosystemTier } from './state'
import { emit, on } from './events'
import type { EndScreenStats } from './events'
import { saveToLocalStorage } from './persistence'
import { triggerAchievement, resetRunTracking } from './achievements'

// ============================================
// HOLD LOOP
// ============================================

let holdAnimationFrame: number | null = null

function startHoldLoop(): void {
  if (holdAnimationFrame !== null) return

  const loop = () => {
    if (!gameState.collapseHold.isHolding) {
      holdAnimationFrame = null
      return
    }

    const shouldTrigger = updateCollapseHold()
    if (shouldTrigger) {
      triggerCollapseWithAnimation()
      holdAnimationFrame = null
      return
    }

    holdAnimationFrame = requestAnimationFrame(loop)
  }

  holdAnimationFrame = requestAnimationFrame(loop)
}

function stopHoldLoop(): void {
  if (holdAnimationFrame !== null) {
    cancelAnimationFrame(holdAnimationFrame)
    holdAnimationFrame = null
  }
}

// ============================================
// EVENT LISTENERS (for decoupled UI)
// ============================================

// Listen to UI input events
on('collapse:begin-hold', () => {
  startCollapseHold()
  startHoldLoop()
})

on('collapse:end-hold', () => {
  stopHoldLoop()
  cancelCollapseHold()
})

// ============================================
// COLLAPSE AVAILABILITY
// ============================================

/**
 * Check if collapse is available (Tier 5 only)
 */
export function canCollapse(): boolean {
  return computed_ecosystemTier.value >= COLLAPSE_MIN_TIER
}

// ============================================
// HOLD-TO-COLLAPSE STATE MACHINE
// ============================================

/**
 * Start hold-to-collapse gesture
 * Call this when player begins holding the collapse button
 */
export function startCollapseHold(): void {
  if (!canCollapse()) return
  if (gameState.collapseHold.isHolding) return // Already holding

  gameState.collapseHold.isHolding = true
  gameState.collapseHold.startTime = Date.now()
  gameState.collapseHold.progress = 0
  gameState.collapseHold.locked = false
  gameState.collapseHold.drainedTiers = 0

  emit('collapse:hold-start')
  emit('player:action')
}

/**
 * Update collapse hold progress
 * Call this every frame while holding
 * @returns true if collapse should trigger (progress >= 100%)
 */
export function updateCollapseHold(): boolean {
  if (!gameState.collapseHold.isHolding) return false

  const elapsed = Date.now() - gameState.collapseHold.startTime
  const progress = calculateCollapseDrainProgress(elapsed)

  gameState.collapseHold.progress = Math.min(1, progress)

  // Calculate drained tiers (5 → 4 → 3 → 2 → 1 → 0)
  // Each tier drains at 20% progress intervals
  const drainedTiers = Math.floor(progress * 5)
  if (drainedTiers !== gameState.collapseHold.drainedTiers) {
    gameState.collapseHold.drainedTiers = drainedTiers
  }

  // Check if locked in (>80% = point of no return)
  if (!gameState.collapseHold.locked && progress >= COLLAPSE_LOCK_THRESHOLD) {
    gameState.collapseHold.locked = true
    emit('collapse:locked')
  }

  // Emit progress for visual effects
  emit('collapse:hold-progress', { progress, drainedTiers })

  // Trigger collapse when complete
  if (progress >= 1) {
    gameState.collapseHold.isHolding = false
    return true
  }

  return false
}

/**
 * Cancel hold gesture (if not locked)
 * Call this when player releases before 80%
 * @returns true if cancel succeeded, false if locked in
 */
export function cancelCollapseHold(): boolean {
  if (!gameState.collapseHold.isHolding) return true

  // Can't cancel if locked (>80%)
  if (gameState.collapseHold.locked) {
    return false
  }

  // Cancel successful - reset state
  gameState.collapseHold.isHolding = false
  gameState.collapseHold.progress = 0
  gameState.collapseHold.drainedTiers = 0
  // Note: startTime and locked are reset on next startCollapseHold()

  emit('collapse:hold-cancel')
  return true
}

/**
 * Reset collapse hold state
 * Call on game reset or when leaving collapse-ready state
 */
export function resetCollapseHold(): void {
  gameState.collapseHold.isHolding = false
  gameState.collapseHold.startTime = 0
  gameState.collapseHold.progress = 0
  gameState.collapseHold.locked = false
  gameState.collapseHold.drainedTiers = 0
}

// ============================================
// COLLAPSE TRIGGER
// ============================================

/**
 * Trigger collapse animation and end screen
 * Call this when hold gesture completes (progress >= 100%)
 */
export function triggerCollapseWithAnimation(): void {
  if (!canCollapse()) return

  // Mark that player has collapsed (they've "won")
  gameState.meta.hasCollapsed = true

  // Prepare end screen stats
  // Note: Add current run's weight to totalWeight for display
  const stats: EndScreenStats = {
    totalPackagesInstalled: gameState.stats.totalPackagesInstalled,
    totalConflictsResolved: gameState.stats.totalConflictsResolved,
    totalSymlinksCreated: gameState.stats.totalSymlinksCreated,
    peakEfficiency: gameState.stats.peakEfficiency,
    totalWeight: gameState.stats.totalWeight + gameState.resources.weight,
    timesShipped: gameState.meta.timesShipped,
  }

  // Save before collapse animation (preserve hasCollapsed)
  saveToLocalStorage()

  // Emit collapse start with animation callback
  emit('collapse:trigger', {
    onComplete: () => {
      // Show end screen after animation
      emit('end:show', { stats })
      emit('collapse:complete')
    },
  })
}

// ============================================
// ENDLESS MODE
// ============================================

/**
 * Enter endless mode (after collapse)
 * Player chose to continue playing at Tier 5
 */
export function enterEndlessMode(): void {
  gameState.meta.endlessMode = true
  saveToLocalStorage()
  // Game state stays as-is - player continues at Tier 5
  // Can trigger collapse again anytime
}

/**
 * Check if in endless mode
 */
export function isEndlessMode(): boolean {
  return gameState.meta.endlessMode
}

/**
 * Check if player has ever collapsed
 */
export function hasCollapsed(): boolean {
  return gameState.meta.hasCollapsed
}

// ============================================
// RESTART (New Game+ after collapse)
// ============================================

/**
 * Restart the game after winning (collapse).
 * Preserves: hasCollapsed (text unlock), achievements
 * Resets: Everything else (fresh start)
 */
export function restartGame(): void {
  // Preserve permanent unlocks
  const preservedHasCollapsed = gameState.meta.hasCollapsed
  // Achievements are stored separately and not reset

  // Reset to initial state
  const freshState = createInitialState()

  // Apply fresh state
  Object.assign(gameState, freshState)

  // Restore permanent unlocks
  gameState.meta.hasCollapsed = preservedHasCollapsed

  // Save the reset state (achievements persist via separate storage key)
  saveToLocalStorage()

  // Create fresh root package
  createRootPackage()

  // Trigger "New Game Plus" achievement
  triggerAchievement('cumulative-2') // New Game Plus
  resetRunTracking()

  // Emit restart event for UI to respond
  emit('game:restart')
}
