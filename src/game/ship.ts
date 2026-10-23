// Ship to npm - soft prestige (repeatable)

import { getDefaultZoom } from './config'
import {
  computed_canPrestige,
  computed_prestigeReward,
  gameState,
  resetGraphAndStack,
  syncEcosystemTier,
} from './state'
import { saveToLocalStorage } from './persistence'
import { emit } from './events'
import { resetEfficiencyTracking } from './formulas'
import { resetRunCounters, updateResolvedShare } from './mutations'
import { clearCascadeQueue } from './cascade'
import { resetCrossPackageState } from './cross-package'
import { resetPhysicsState } from './physics'
import { recordShip } from './achievements'

// ============================================
// SHIP TO NPM (Soft Prestige)
// ============================================

export function performShip(): void {
  emit('player:action')

  // shipReward (spine.ts) over this run's counters, q measured fresh.
  updateResolvedShare()
  const reward = computed_prestigeReward.value

  const tierBefore = gameState.meta.ecosystemTier
  const efficiency = gameState.stats.currentEfficiency

  gameState.stats.totalWeight += gameState.resources.weight
  gameState.stats.peakEfficiency = Math.max(
    gameState.stats.peakEfficiency,
    gameState.stats.currentEfficiency
  )

  if (!gameState.onboarding.firstPrestigeComplete) {
    gameState.onboarding.firstPrestigeComplete = true
  }

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

  resetGraphAndStack()
  clearCascadeQueue()
  resetCrossPackageState()
  resetPhysicsState()

  gameState.tutorialGating = false

  gameState.cascade.active = false
  gameState.cascade.scopePackageId = null
  gameState.cascade.pendingSpawns = []

  gameState.automation.resolveEnabled = false
  gameState.automation.resolveActive = false
  gameState.automation.resolveTargetWireId = null
  gameState.automation.resolveTargetScope = null
  gameState.automation.processStartTime = 0
  gameState.automation.lastResolveTime = 0

  gameState.resources.weight = 0
  gameState.resources.cacheFragments = 0

  gameState.stats.currentEfficiency = 1
  gameState.stats.currentStability = 1
  resetEfficiencyTracking()
  resetRunCounters()

  gameState.camera.x = 0
  gameState.camera.y = 0
  gameState.camera.zoom = getDefaultZoom()

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
