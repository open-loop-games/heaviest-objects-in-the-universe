// Ship to npm - soft prestige (repeatable)

import { FRAGMENT_TO_TOKEN_RATIO, getDefaultZoom } from './config'
import { calculatePrestigeReward, getPrestigeThreshold } from './formulas'
import {
  computed_canPrestige,
  gameState,
  resetGraphAndStack,
  syncEcosystemTier,
} from './state'
import { saveToLocalStorage } from './persistence'
import { emit } from './events'
import { resetEfficiencyTracking } from './formulas'
import { resetMomentumState } from './mutations'
import { clearCascadeQueue } from './cascade'
import { resetCrossPackageState } from './cross-package'
import { resetPhysicsState } from './physics'

// ============================================
// SHIP TO NPM (Soft Prestige)
// ============================================

export function performShip(): void {
  emit('player:action')

  const threshold = getPrestigeThreshold(gameState.meta.timesShipped)
  const reward = calculatePrestigeReward(gameState, threshold)

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

  const avgQuality =
    (gameState.stats.currentEfficiency + gameState.stats.currentStability) / 2
  const qualityMultiplier = 0.2 + 0.8 * Math.min(1, avgQuality)
  const fragmentBonus = Math.floor(
    (gameState.resources.cacheFragments / FRAGMENT_TO_TOKEN_RATIO) *
      qualityMultiplier
  )

  gameState.meta.cacheTokens += reward + fragmentBonus
  gameState.meta.timesShipped++

  syncEcosystemTier()

  emit('ship:reward', {
    tokensEarned: reward,
    fragmentBonus,
    tierBefore,
    tierAfter: gameState.meta.ecosystemTier,
    efficiency,
  })

  resetGraphAndStack()
  clearCascadeQueue()
  resetCrossPackageState()
  resetPhysicsState()
  resetMomentumState()

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

  gameState.surge.chargedSegments = 0
  gameState.surge.unlockedSegments = 1 + gameState.upgrades.surgeLevel

  gameState.resources.bandwidth = 100 * gameState.meta.ecosystemTier
  gameState.resources.weight = 0
  gameState.resources.cacheFragments = 0

  gameState.stats.currentEfficiency = 1
  gameState.stats.currentStability = 1
  resetEfficiencyTracking()

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
