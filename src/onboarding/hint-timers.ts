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
  | 'click-prestige' // Click singularity to prestige

// ============================================
// TIMER STATE
// ============================================

// Per-hint inactivity tracking (timestamps)
export let clickPackageInactiveTime = 0
export let dragMergeInactiveTime = 0
export let clickConflictInactiveTime = 0
export let clickPrestigeInactiveTime = 0

// Track when conditions first became true
export let clickPackageConditionMet = false
export let dragMergeConditionMet = false
export let clickConflictConditionMet = false
export let clickPrestigeConditionMet = false

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
  // Also reset condition flags so timers restart fresh
  clickPackageConditionMet = false
  dragMergeConditionMet = false
  clickConflictConditionMet = false
  clickPrestigeConditionMet = false
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

// ============================================
// EVENT SUBSCRIPTION
// ============================================

// Subscribe to player action events - decouples game files from tutorial system
on('player:action', resetHintTimers)
