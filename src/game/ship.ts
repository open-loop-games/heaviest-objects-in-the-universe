// Ship to npm: the end of a run. The run is an engine Cycle over the `run` module's
// refs (state.ts): a ship pays shipReward, the cycle resets the run, and the next run
// starts at once.

import { createCycle, seedRNG, type Cycle } from '@open-loop/engine'
import { createInitialState } from './config'
import {
  computed_canPrestige,
  computed_prestigeReward,
  engine,
  gameState,
  resetGraphAndStack,
  syncEcosystemTier,
} from './state'
import { saveToLocalStorage } from './persistence'
import { emit } from './events'
import { resetEfficiencyTracking } from './formulas'
import { updateResolvedShare } from './mutations'
import { clearCascadeQueue } from './cascade'
import { resetCrossPackageState } from './cross-package'
import { resetPhysicsState } from './physics'
import { recordShip } from './achievements'

// ============================================
// THE RUN
// ============================================

let runCycle: Cycle | null = null

engine.use({
  id: 'ship',
  install(ctx) {
    runCycle = createCycle({
      resetPersistentContexts: ['run'],
      onEnd: clearRunSystems,
      registerTick: ctx.onTick,
    })
    // `running` isn't saved, and every session continues the run it loads.
    runCycle.resume()
  },
})

/** The run's Cycle; it exists once engine.start() has installed the modules. */
export function getRunCycle(): Cycle {
  if (!runCycle) throw new Error('the run cycle is built at engine.start()')
  return runCycle
}

/**
 * Clear what a run holds outside its persistent refs: the board, the systems that walk
 * it, and within-frame state. A new seed starts the next run.
 */
export function clearRunSystems(): void {
  resetGraphAndStack()
  clearCascadeQueue()
  resetCrossPackageState()
  resetPhysicsState()
  resetEfficiencyTracking()
  const fresh = createInitialState()
  Object.assign(gameState.cascade, fresh.cascade)
  Object.assign(gameState.automation, fresh.automation)
  Object.assign(gameState.collapseHold, fresh.collapseHold)
  gameState.seed = Date.now()
  seedRNG(gameState.seed)
}

// ============================================
// SHIP TO NPM
// ============================================

export function performShip(): void {
  emit('player:action')

  // shipReward (spine.ts) over this run's counters, q measured fresh. Read before the
  // cycle resets them.
  updateResolvedShare()
  const reward = computed_prestigeReward.value
  const tierBefore = gameState.meta.ecosystemTier
  const efficiency = gameState.run.currentEfficiency
  const weight = gameState.resources.weight

  if (!getRunCycle().end()) return

  gameState.stats.totalWeight += weight
  gameState.stats.peakEfficiency = Math.max(
    gameState.stats.peakEfficiency,
    efficiency
  )
  gameState.onboarding.firstPrestigeComplete = true
  gameState.meta.cacheTokens += reward
  gameState.meta.timesShipped++
  recordShip()
  syncEcosystemTier()

  emit('ship:reward', {
    tokensEarned: reward,
    tierBefore,
    tierAfter: gameState.meta.ecosystemTier,
    efficiency,
  })

  saveToLocalStorage()
}

export function triggerShipWithAnimation(): void {
  if (!computed_canPrestige.value) return

  emit('ship:start', {
    onComplete: () => {
      performShip()
      emit('ship:complete')
    },
  })
}

export function canShip(): boolean {
  return computed_canPrestige.value
}
