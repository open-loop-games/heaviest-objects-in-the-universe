// Hint timer management - separated to avoid circular dependencies
// Game modules emit 'player:action' events, this file subscribes
// tutorial-state.ts reads timer state from here

import { on } from '../game/events'

// ============================================
// GHOST HINT TYPES (shared with tutorial-state.ts)
// ============================================

export type GhostHintType =
  | 'click-root' // Click root to spawn first package
  | 'click-package' // Click spawned package to dive in
  | 'drag-merge' // Drag duplicate to merge
  | 'click-conflict' // Click conflict wire then X
  | 'click-prestige' // Click singularity to prestige (legacy)
  | 'click-ship' // Click ship button to ship packages
  | 'click-fragment' // Click fragment pip on golden package

// ============================================
// TIMER STATE
// ============================================

// Per-hint inactivity tracking (timestamps)
export let clickPackageInactiveTime = 0
export let dragMergeInactiveTime = 0
export let clickConflictInactiveTime = 0
export let clickPrestigeInactiveTime = 0
export let clickShipInactiveTime = 0
export let clickFragmentInactiveTime = 0

// Track when conditions first became true
export let clickPackageConditionMet = false
export let dragMergeConditionMet = false
export let clickConflictConditionMet = false
export let clickPrestigeConditionMet = false
export let clickShipConditionMet = false
export let clickFragmentConditionMet = false

// ============================================
// RESET FUNCTIONS
// ============================================

/**
 * Reset all hint timing (call on player action)
 */
export function resetHintTimers(): void {
  const now = Date.now()
  clickPackageInactiveTime = now
  dragMergeInactiveTime = now
  clickConflictInactiveTime = now
  clickPrestigeInactiveTime = now
  clickShipInactiveTime = now
  clickFragmentInactiveTime = now
  // Also reset condition flags so timers restart fresh
  clickPackageConditionMet = false
  dragMergeConditionMet = false
  clickConflictConditionMet = false
  clickPrestigeConditionMet = false
  clickShipConditionMet = false
  clickFragmentConditionMet = false
}

/**
 * Reset specific hint timing (call when that action is taken)
 */
export function resetHintTimer(type: GhostHintType): void {
  const now = Date.now()
  switch (type) {
    case 'click-package':
      clickPackageInactiveTime = now
      clickPackageConditionMet = false
      break
    case 'drag-merge':
      dragMergeInactiveTime = now
      dragMergeConditionMet = false
      break
    case 'click-conflict':
      clickConflictInactiveTime = now
      clickConflictConditionMet = false
      break
    case 'click-prestige':
      clickPrestigeInactiveTime = now
      clickPrestigeConditionMet = false
      break
    case 'click-ship':
      clickShipInactiveTime = now
      clickShipConditionMet = false
      break
    case 'click-fragment':
      clickFragmentInactiveTime = now
      clickFragmentConditionMet = false
      break
  }
}

// Setters for tutorial-state.ts to update
export function setClickPackageTimer(
  time: number,
  conditionMet: boolean
): void {
  clickPackageInactiveTime = time
  clickPackageConditionMet = conditionMet
}

export function setDragMergeTimer(time: number, conditionMet: boolean): void {
  dragMergeInactiveTime = time
  dragMergeConditionMet = conditionMet
}

export function setClickConflictTimer(
  time: number,
  conditionMet: boolean
): void {
  clickConflictInactiveTime = time
  clickConflictConditionMet = conditionMet
}

export function setClickPrestigeTimer(
  time: number,
  conditionMet: boolean
): void {
  clickPrestigeInactiveTime = time
  clickPrestigeConditionMet = conditionMet
}

export function setClickShipTimer(time: number, conditionMet: boolean): void {
  clickShipInactiveTime = time
  clickShipConditionMet = conditionMet
}

export function setClickFragmentTimer(
  time: number,
  conditionMet: boolean
): void {
  clickFragmentInactiveTime = time
  clickFragmentConditionMet = conditionMet
}

// ============================================
// EVENT SUBSCRIPTION
// ============================================

// Subscribe to player action events - decouples game files from tutorial system
on('player:action', resetHintTimers)
