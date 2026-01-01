// Surge system - bandwidth reservation for cascade boosts

import { gameState } from './state'
import {
  SURGE_COST_PER_SEGMENT,
  SURGE_SEGMENTS,
  SURGE_CASCADE_BOOST,
  SURGE_GOLDEN_BOOST,
  SURGE_FRAGMENT_BOOST,
} from './config'

// ============================================
// SURGE COST & AVAILABILITY
// ============================================

/**
 * Get the bandwidth cost for a given number of surge segments
 */
export function getSurgeCost(segments: number): number {
  return Math.floor(
    gameState.resources.maxBandwidth * SURGE_COST_PER_SEGMENT * segments
  )
}

/**
 * Get the currently reserved bandwidth (for charged segments)
 */
export function getSurgeReserved(): number {
  return getSurgeCost(gameState.surge.chargedSegments)
}

/**
 * Get available bandwidth (total - reserved for surge)
 */
export function getAvailableBandwidth(): number {
  return Math.max(0, gameState.resources.bandwidth - getSurgeReserved())
}

/**
 * Check if surge is unlocked (P2+)
 */
export function isSurgeUnlocked(): boolean {
  return gameState.meta.totalPrestiges >= 2
}

// ============================================
// SURGE CHARGE MANAGEMENT
// ============================================

/**
 * Set surge charge level (clamps to valid range)
 * Returns true if change was made
 */
export function setSurgeCharge(segments: number): boolean {
  const maxSegments = Math.min(gameState.surge.unlockedSegments, SURGE_SEGMENTS)
  const newCharge = Math.max(0, Math.min(segments, maxSegments))

  // Check if we can afford this charge level
  const newCost = getSurgeCost(newCharge)
  if (newCost > gameState.resources.bandwidth) {
    // Can't afford - find max affordable
    const maxAffordable = Math.floor(
      gameState.resources.bandwidth /
        (gameState.resources.maxBandwidth * SURGE_COST_PER_SEGMENT)
    )
    gameState.surge.chargedSegments = Math.min(maxAffordable, maxSegments)
    return gameState.surge.chargedSegments !== newCharge
  }

  if (gameState.surge.chargedSegments !== newCharge) {
    gameState.surge.chargedSegments = newCharge
    return true
  }
  return false
}

// ============================================
// SURGE CONSUMPTION
// ============================================

export interface SurgeBoosts {
  sizeMultiplier: number
  goldenBoost: number
  fragmentBoost: number
}

/**
 * Consume surge and return boost multipliers
 * Called when cascade starts
 */
export function consumeSurge(): SurgeBoosts {
  const segments = gameState.surge.chargedSegments

  if (segments === 0) {
    return { sizeMultiplier: 1, goldenBoost: 0, fragmentBoost: 0 }
  }

  // Consume the reserved bandwidth
  const cost = getSurgeCost(segments)
  gameState.resources.bandwidth = Math.max(
    0,
    gameState.resources.bandwidth - cost
  )

  // Reset charge
  gameState.surge.chargedSegments = 0

  // Calculate boosts
  return {
    sizeMultiplier: 1 + segments * SURGE_CASCADE_BOOST, // +8% per segment
    goldenBoost: segments * SURGE_GOLDEN_BOOST, // +0.5% per segment
    fragmentBoost: segments * SURGE_FRAGMENT_BOOST, // +0.4% per segment
  }
}
