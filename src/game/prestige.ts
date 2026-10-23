// Resets beyond a run's end: abandoning a run, a new game, a hard reset.
//
// Note: Ship, the run's end, is in ship.ts

import { createReset, type Reset } from '@open-loop/engine'
import { engine, gameState, hasCollapsedRef } from './state'
import { saveToLocalStorage, clearSavedGame } from './persistence'
import { clearRunSystems, getRunCycle } from './ship'

let newGameReset: Reset | null = null
let hardResetAll: Reset | null = null

/** A reset's run cleanup: the run's systems, and the cycle's clock, which no context names. */
function clearRunAndClock(): void {
  clearRunSystems()
  getRunCycle().elapsed.value = 0
}

engine.use({
  id: 'resets',
  install() {
    // Everything the run and the game hold; a lifetime ref (hasCollapsed, the cycle's
    // count and best time) survives, so the text reveal carries into New Game+.
    newGameReset = createReset({
      resetPersistentContexts: ['run', 'game'],
      onReset: clearRunAndClock,
    })
  },
  connect() {
    const cycle = getRunCycle()
    hardResetAll = createReset({
      resetPersistentContexts: [newGameReset!],
      thingsToReset: [hasCollapsedRef, cycle.count, cycle.bestTime],
      onReset: clearRunAndClock,
    })
  },
})

/**
 * Soft reset: abandon the current run, pay nothing, keep the game (ships, cache tokens,
 * upgrades).
 */
export function softReset(): void {
  const cycle = getRunCycle()
  cycle.reset.reset()
  cycle.elapsed.value = 0

  gameState.onboarding.firstClickComplete = false
  gameState.onboarding.firstDivablePackageSeen = false

  saveToLocalStorage()
}

/** Hard reset: delete the save and start completely fresh. */
export function hardReset(): void {
  clearSavedGame()
  hardResetAll!.reset()
}

/**
 * A new game: reset the run and the game, keeping lifetime refs. Achievements and
 * settings live outside the save's refs and survive.
 */
export function wipeGame(): void {
  newGameReset!.reset()
}
