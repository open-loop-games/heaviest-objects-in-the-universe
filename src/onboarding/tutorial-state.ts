// Tutorial state tracking - timers and "first seen" flags

import { gameState, computed_canPrestige } from '../game/state'
import {
  isInPackageScope,
  getCurrentScopePackages,
  getCurrentScopeWires,
} from '../game/scope'
import { getAllDuplicateGroups } from '../game/symlinks'
import {
  type GhostHintType,
  clickPackageInactiveTime,
  clickPackageConditionMet,
  dragMergeInactiveTime,
  dragMergeConditionMet,
  clickConflictInactiveTime,
  clickConflictConditionMet,
  clickPrestigeInactiveTime,
  clickPrestigeConditionMet,
  setClickPackageTimer,
  setDragMergeTimer,
  setClickConflictTimer,
  setClickPrestigeTimer,
} from './hint-timers'

// Re-export types and reset functions from hint-timers for external use
export {
  type GhostHintType,
  resetHintTimers,
  resetHintTimer,
} from './hint-timers'

// ============================================
// GHOST HAND HINT TYPES
// ============================================

export interface GhostHintTarget {
  x: number
  y: number
}

export interface GhostHint {
  type: GhostHintType
  show: boolean
  elapsed: number
  targets: GhostHintTarget[] // 1 for click, 2 for drag (from, to)
}

// Inactivity delay before showing hints (ms)
const HINT_DELAY = 10000

// ============================================
// STATE
// ============================================

// First conflict tracking
let hasSeenFirstConflict = false
let firstConflictTime = 0
let hasActiveConflict = false

// First duplicate tracking
let hasSeenFirstDuplicate = false
let firstDuplicateTime = 0

// First inner conflict tracking (after symlink teaching)
let hasSeenFirstInnerConflict = false
let firstInnerConflictTime = 0
let lastSymlinkSeenState = false
let conflictTeachingTargetWireId: string | null = null

// Selected conflict wire for two-phase teaching
let selectedConflictWireId: string | null = null
let selectedConflictActionPos: { x: number; y: number } | null = null

// Back button position (reported by ScopeNavigation component)
let backButtonPos: { x: number; y: number } | null = null

// First click tutorial timing
let gameStartTime = Date.now()

// Second package hint timing
let waitingForSecondPackage = false
let waitingForSecondPackageTime = 0

// First spawned node tracking
let lastFirstClickState = false
let firstSpawnedPackageId: string | null = null
let firstSpawnedTime = 0

// ============================================
// GETTERS
// ============================================

export function getHasSeenFirstConflict(): boolean {
  return hasSeenFirstConflict
}

export function getFirstConflictTime(): number {
  return firstConflictTime
}

export function getHasActiveConflict(): boolean {
  return hasActiveConflict
}

export function getHasSeenFirstDuplicate(): boolean {
  return hasSeenFirstDuplicate
}

export function getFirstDuplicateTime(): number {
  return firstDuplicateTime
}

export function getHasSeenFirstInnerConflict(): boolean {
  return hasSeenFirstInnerConflict
}

export function getFirstInnerConflictTime(): number {
  return firstInnerConflictTime
}

export function getLastSymlinkSeenState(): boolean {
  return lastSymlinkSeenState
}

export function getConflictTeachingTargetWireId(): string | null {
  return conflictTeachingTargetWireId
}

export function getSelectedConflictWireId(): string | null {
  return selectedConflictWireId
}

export function getSelectedConflictActionPos(): {
  x: number
  y: number
} | null {
  return selectedConflictActionPos
}

export function getGameStartTime(): number {
  return gameStartTime
}

export function getWaitingForSecondPackage(): boolean {
  return waitingForSecondPackage
}

export function getWaitingForSecondPackageTime(): number {
  return waitingForSecondPackageTime
}

export function getLastFirstClickState(): boolean {
  return lastFirstClickState
}

export function getFirstSpawnedPackageId(): string | null {
  return firstSpawnedPackageId
}

export function getFirstSpawnedTime(): number {
  return firstSpawnedTime
}

export function getBackButtonPos(): { x: number; y: number } | null {
  return backButtonPos
}

// ============================================
// SETTERS
// ============================================

export function setHasSeenFirstConflict(value: boolean): void {
  hasSeenFirstConflict = value
}

export function setFirstConflictTime(value: number): void {
  firstConflictTime = value
}

export function setHasActiveConflict(value: boolean): void {
  hasActiveConflict = value
}

export function setHasSeenFirstDuplicate(value: boolean): void {
  hasSeenFirstDuplicate = value
}

export function setFirstDuplicateTime(value: number): void {
  firstDuplicateTime = value
}

export function setHasSeenFirstInnerConflict(value: boolean): void {
  hasSeenFirstInnerConflict = value
}

export function setFirstInnerConflictTime(value: number): void {
  firstInnerConflictTime = value
}

export function setLastSymlinkSeenState(value: boolean): void {
  lastSymlinkSeenState = value
}

export function setConflictTeachingTargetWireId(value: string | null): void {
  conflictTeachingTargetWireId = value
}

export function setSelectedConflictWire(
  wireId: string | null,
  actionPosition: { x: number; y: number } | null
): void {
  selectedConflictWireId = wireId
  selectedConflictActionPos = actionPosition
}

export function setGameStartTime(value: number): void {
  gameStartTime = value
}

export function setWaitingForSecondPackage(value: boolean): void {
  waitingForSecondPackage = value
}

export function setWaitingForSecondPackageTime(value: number): void {
  waitingForSecondPackageTime = value
}

export function setLastFirstClickState(value: boolean): void {
  lastFirstClickState = value
}

export function setFirstSpawnedPackageId(value: string | null): void {
  firstSpawnedPackageId = value
}

export function setFirstSpawnedTime(value: number): void {
  firstSpawnedTime = value
}

export function setBackButtonPos(value: { x: number; y: number } | null): void {
  backButtonPos = value
}

// ============================================
// RESET FUNCTIONS
// ============================================

export function resetGameStartTime(): void {
  gameStartTime = Date.now()
}

export function resetFirstConflict(): void {
  hasSeenFirstConflict = false
  firstConflictTime = 0
  hasActiveConflict = false
}

export function resetFirstDuplicate(): void {
  hasSeenFirstDuplicate = false
  firstDuplicateTime = 0
}

export function resetFirstInnerConflict(): void {
  hasSeenFirstInnerConflict = false
  firstInnerConflictTime = 0
  lastSymlinkSeenState = false
  conflictTeachingTargetWireId = null
}

export function resetFirstSpawnedNode(): void {
  lastFirstClickState = false
  firstSpawnedPackageId = null
  firstSpawnedTime = 0
}

export function resetSecondPackageHint(): void {
  waitingForSecondPackage = false
  waitingForSecondPackageTime = 0
}

export function resetAllTutorialState(): void {
  resetGameStartTime()
  resetFirstConflict()
  resetFirstDuplicate()
  resetFirstInnerConflict()
  resetFirstSpawnedNode()
  resetSecondPackageHint()
  selectedConflictWireId = null
  selectedConflictActionPos = null
}

// ============================================
// COMPUTED / DERIVED STATE
// ============================================

/**
 * Check if we're in the first conflict treatment window
 * Returns a value 0-1 for dimming intensity (1 = full dim, fades to 0)
 */
export function getFirstConflictDimming(): number {
  if (!hasSeenFirstConflict || !hasActiveConflict) return 0

  const now = Date.now()
  const elapsed = now - firstConflictTime
  const treatmentDuration = 2000 // 2 seconds of dimming

  if (elapsed >= treatmentDuration) return 0

  // Fade out the dimming effect over the treatment duration
  return 1 - elapsed / treatmentDuration
}

/**
 * Get extra pulse intensity for conflict wires during first conflict
 * Returns 0-1 where 1 = extra bright
 */
export function getFirstConflictWirePulse(): number {
  if (!hasSeenFirstConflict) return 0

  const now = Date.now()
  const elapsed = now - firstConflictTime

  // 3 pulses over 1.5 seconds
  if (elapsed >= 1500) return 0

  // Pulse 3 times with increasing brightness
  const pulsePhase = (elapsed / 500) % 1 // 3 pulses in 1.5s
  const pulseNumber = Math.floor(elapsed / 500) // 0, 1, 2
  const baseIntensity = 0.3 + pulseNumber * 0.2 // 0.3, 0.5, 0.7

  return baseIntensity * Math.sin(pulsePhase * Math.PI)
}

/**
 * Check if cursor hint should show for first click or second package
 * Returns { show: boolean, elapsed: number } or null
 */
export function getCursorHintState(): {
  show: boolean
  elapsed: number
} | null {
  // Skip cursor hints for players who have prestiged
  if (gameState.meta.cacheTokens > 0) return null

  const now = Date.now()

  // Scenario 1: First click not done yet
  if (!gameState.onboarding.firstClickComplete) {
    if (!gameState.onboarding.introAnimationComplete) return null
    const elapsed = now - gameStartTime
    return { show: elapsed >= 15000, elapsed }
  }

  // Scenario 2: First scope exited but second package not spawned
  if (gameState.onboarding.firstScopeExited) {
    // Count top-level packages (excluding root)
    let topLevelCount = 0
    for (const pkg of gameState.packages.values()) {
      if (pkg.parentId === gameState.rootId) {
        topLevelCount++
      }
    }

    const isWaitingState = topLevelCount === 1

    if (isWaitingState) {
      if (!waitingForSecondPackage) {
        waitingForSecondPackage = true
        waitingForSecondPackageTime = now
      }
      const elapsed = now - waitingForSecondPackageTime
      return { show: elapsed >= 15000, elapsed }
    } else {
      waitingForSecondPackage = false
      waitingForSecondPackageTime = 0
    }
  } else {
    waitingForSecondPackage = false
    waitingForSecondPackageTime = 0
  }

  return null
}

// ============================================
// GHOST HAND HINT SYSTEM
// ============================================

/**
 * Get the currently active ghost hand hint
 * Returns the highest-priority hint that should show, or null
 * Priority order: click-root > click-package > drag-merge > click-conflict > click-prestige
 */
export function getActiveGhostHint(): GhostHint | null {
  // Skip all hints for prestiged players
  if (gameState.meta.cacheTokens > 0) return null

  const now = Date.now()

  // === CLICK-ROOT: First click not done ===
  if (!gameState.onboarding.firstClickComplete) {
    if (!gameState.onboarding.introAnimationComplete) return null

    const rootPkg = gameState.rootId
      ? gameState.packages.get(gameState.rootId)
      : null
    if (!rootPkg) return null

    const elapsed = now - gameStartTime
    return {
      type: 'click-root',
      show: elapsed >= HINT_DELAY,
      elapsed,
      targets: [{ x: rootPkg.position.x, y: rootPkg.position.y }],
    }
  }

  // === CLICK-PACKAGE: First package spawned, not dived yet ===
  // Conditions: At root scope, first click done, not yet dived, has a top-level package
  if (
    !isInPackageScope() &&
    gameState.onboarding.firstClickComplete &&
    !gameState.onboarding.firstDiveSeen
  ) {
    // Find the first top-level package (not root)
    let targetPkg: { x: number; y: number } | null = null
    for (const pkg of gameState.packages.values()) {
      if (pkg.parentId === gameState.rootId && pkg.state === 'ready') {
        targetPkg = { x: pkg.position.x, y: pkg.position.y }
        break
      }
    }

    if (targetPkg) {
      if (!clickPackageConditionMet) {
        setClickPackageTimer(now, true)
      }
      const elapsed = now - clickPackageInactiveTime
      return {
        type: 'click-package',
        show: elapsed >= HINT_DELAY,
        elapsed,
        targets: [targetPkg],
      }
    }
  } else if (!clickPackageConditionMet) {
    // Condition not met, don't change timer
  } else {
    setClickPackageTimer(0, false)
  }

  // === DRAG-MERGE: Duplicates visible, not yet merged one ===
  // Conditions: In a scope, duplicates exist, haven't done first symlink
  if (isInPackageScope() && !gameState.onboarding.firstSymlinkSeen) {
    const duplicateGroups = getAllDuplicateGroups()
    const scopePackages = getCurrentScopePackages()

    // Find first pair of on-scope duplicates
    let dragFrom: { x: number; y: number } | null = null
    let dragTo: { x: number; y: number } | null = null

    for (const group of duplicateGroups) {
      if (group.packageIds.length >= 2) {
        const positions: { x: number; y: number }[] = []
        for (const pkgId of group.packageIds) {
          const pkg = scopePackages.get(pkgId)
          if (pkg && pkg.state !== 'conflict') {
            positions.push({ x: pkg.position.x, y: pkg.position.y })
            if (positions.length >= 2) break
          }
        }
        if (positions.length >= 2) {
          dragFrom = positions[0]!
          dragTo = positions[1]!
          break
        }
      }
    }

    if (dragFrom && dragTo) {
      if (!dragMergeConditionMet) {
        setDragMergeTimer(now, true)
      }
      const elapsed = now - dragMergeInactiveTime
      return {
        type: 'drag-merge',
        show: elapsed >= HINT_DELAY,
        elapsed,
        targets: [dragFrom, dragTo],
      }
    }
  } else if (!isInPackageScope()) {
    setDragMergeTimer(0, false)
  }

  // === CLICK-CONFLICT: Conflict wire visible, not yet resolved ===
  // Conditions: In a scope, conflict exists
  if (isInPackageScope()) {
    const scopeWires = getCurrentScopeWires()
    const scopePackages = getCurrentScopePackages()

    // Find first conflicted wire
    for (const wire of scopeWires.values()) {
      if (wire.conflicted) {
        const fromPkg = scopePackages.get(wire.fromId)
        const toPkg = scopePackages.get(wire.toId)
        if (fromPkg && toPkg) {
          // Target is midpoint of wire
          const midX = (fromPkg.position.x + toPkg.position.x) / 2
          const midY = (fromPkg.position.y + toPkg.position.y) / 2

          if (!clickConflictConditionMet) {
            setClickConflictTimer(now, true)
          }
          const elapsed = now - clickConflictInactiveTime
          return {
            type: 'click-conflict',
            show: elapsed >= HINT_DELAY,
            elapsed,
            targets: [{ x: midX, y: midY }],
          }
        }
      }
    }
  }
  setClickConflictTimer(0, false)

  // === CLICK-PRESTIGE: Prestige available, not yet done ===
  // Conditions: At root scope, can prestige, haven't prestiged before
  if (
    !isInPackageScope() &&
    computed_canPrestige.value &&
    !gameState.onboarding.firstPrestigeComplete
  ) {
    const rootPkg = gameState.rootId
      ? gameState.packages.get(gameState.rootId)
      : null
    if (rootPkg) {
      if (!clickPrestigeConditionMet) {
        setClickPrestigeTimer(now, true)
      }
      const elapsed = now - clickPrestigeInactiveTime
      return {
        type: 'click-prestige',
        show: elapsed >= HINT_DELAY,
        elapsed,
        targets: [{ x: rootPkg.position.x, y: rootPkg.position.y }],
      }
    }
  } else {
    setClickPrestigeTimer(0, false)
  }

  return null
}
