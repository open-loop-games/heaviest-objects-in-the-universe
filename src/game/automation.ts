// Automation system for auto-resolve
// Unlocks at tier 2

import { gameState, stack } from './state'
import { getEcosystemTier } from './formulas'
import {
  getPackagesAtPath,
  getWiresAtPath,
  recalculateStateAtPath,
} from './scope'
import { getCascadeScopePath, isCascadeActive } from './cascade'
import {
  getResolveDrainMultiplier,
  getResolveSpeedMultiplier,
} from './upgrades'
import { AUTO_RESOLVE_DRAIN } from './config'
import { emit } from './events'
import { getCrossPackageConflicts } from './cross-package'
import { recordAutoResolve } from './achievements'

// ============================================
// AUTOMATION TIMING CONSTANTS
// ============================================

const RESOLVE_INTERVALS = [
  Infinity, // index 0 unused
  Infinity, // Tier 1
  3000,
  2000,
  1000,
  500,
] as const

const PROCESS_DURATION = 400

// ============================================
// CONFLICT FINDING
// ============================================

interface ConflictLocation {
  wireId: string
  scopePath: string[]
}

function isCrossPackageConflict(wireId: string, scopePath: string[]): boolean {
  if (scopePath.length === 0) return false

  const topLevelPkgId = scopePath[0]
  if (!topLevelPkgId) return false

  const wires = getWiresAtPath(scopePath)
  const packages = getPackagesAtPath(scopePath)
  if (!wires || !packages) return false

  const wire = wires.get(wireId)
  if (!wire) return false

  const targetPkg = packages.get(wire.toId)
  if (!targetPkg?.identity) return false

  const targetIdentity = targetPkg.identity.name

  const crossConflicts = getCrossPackageConflicts()
  for (const conflict of crossConflicts) {
    if (conflict.packageAId === topLevelPkgId) {
      if (conflict.conflictingDepA === targetIdentity) return true
    }
    if (conflict.packageBId === topLevelPkgId) {
      if (conflict.conflictingDepB === targetIdentity) return true
    }
  }

  return false
}

function isScopePopulating(scopePath: string[]): boolean {
  if (!isCascadeActive()) return false

  const cascadePath = getCascadeScopePath()
  if (cascadePath.length === 0) return false

  if (scopePath.length < cascadePath.length) return false

  for (let i = 0; i < cascadePath.length; i++) {
    if (scopePath[i] !== cascadePath[i]) return false
  }

  return true
}

/**
 * Find the first conflicted wire in the CURRENT scope.
 * Skips cross-package conflicts (they re-appear unless the node is removed).
 */
export function findFirstConflictedWire(): ConflictLocation | null {
  const scopePath = [...stack.path]

  if (isScopePopulating(scopePath)) return null

  const wires = getWiresAtPath(scopePath)
  if (!wires) return null

  for (const [wireId, wire] of wires) {
    if (wire.conflicted) {
      if (isCrossPackageConflict(wireId, scopePath)) continue

      return { wireId, scopePath }
    }
  }

  return null
}

// ============================================
// RESOLUTION HELPERS
// ============================================

function resolveWireAtPath(wireId: string, scopePath: string[]): boolean {
  const wires = getWiresAtPath(scopePath)
  const packages = getPackagesAtPath(scopePath)

  if (!wires || !packages) return false

  const wire = wires.get(wireId)
  if (!wire || !wire.conflicted) return false

  wire.conflicted = false
  wire.conflictTime = 0

  const targetPkg = packages.get(wire.toId)
  if (targetPkg && targetPkg.state === 'conflict') {
    targetPkg.state = 'ready'
    targetPkg.conflictProgress = 0
  }

  gameState.stats.totalConflictsResolved++

  if (scopePath.length > 0) {
    recalculateStateAtPath(scopePath)
  }

  return true
}

// ============================================
// AUTOMATION UPDATE (CALLED FROM GAME LOOP)
// ============================================

export function updateAutomation(now: number, _deltaTime: number = 0): void {
  const tier = getEcosystemTier(gameState.meta.cacheTokens)
  const auto = gameState.automation

  if (tier >= 2 && auto.resolveEnabled) {
    const baseInterval = RESOLVE_INTERVALS[tier] ?? Infinity
    const resolveInterval = baseInterval / getResolveSpeedMultiplier()

    if (!auto.resolveActive && now - auto.lastResolveTime >= resolveInterval) {
      const conflict = findFirstConflictedWire()
      if (conflict) {
        const drainCost = AUTO_RESOLVE_DRAIN * getResolveDrainMultiplier()
        if (gameState.resources.bandwidth >= drainCost) {
          auto.resolveActive = true
          auto.resolveTargetWireId = conflict.wireId
          auto.resolveTargetScope = conflict.scopePath
          auto.processStartTime = now
        }
      }
      auto.lastResolveTime = now
    }

    if (auto.resolveActive && auto.resolveTargetWireId) {
      if (now - auto.processStartTime >= PROCESS_DURATION) {
        const scopePath = auto.resolveTargetScope ?? []

        if (isScopePopulating(scopePath)) {
          auto.resolveActive = false
          auto.resolveTargetWireId = null
          auto.resolveTargetScope = null
        } else {
          const wires = getWiresAtPath(scopePath)
          const packages = getPackagesAtPath(scopePath)
          const wire = wires?.get(auto.resolveTargetWireId)

          let effectPosition = { x: 0, y: 0 }
          if (wire && packages) {
            const toPkg = packages.get(wire.toId)
            if (toPkg) {
              effectPosition = { x: toPkg.position.x, y: toPkg.position.y }
            }
          }

          const drainCost = AUTO_RESOLVE_DRAIN * getResolveDrainMultiplier()
          gameState.resources.bandwidth = Math.max(
            0,
            gameState.resources.bandwidth - drainCost
          )

          const success = resolveWireAtPath(auto.resolveTargetWireId, scopePath)

          if (success) {
            emit('automation:resolve-complete', {
              scopePath,
              position: effectPosition,
            })
            recordAutoResolve()
          }

          auto.resolveActive = false
          auto.resolveTargetWireId = null
          auto.resolveTargetScope = null
        }
      }
    }
  } else if (auto.resolveActive) {
    auto.resolveActive = false
    auto.resolveTargetWireId = null
    auto.resolveTargetScope = null
  }
}

// ============================================
// AUTOMATION STATUS QUERIES
// ============================================

export function isAutomationProcessing(): boolean {
  return gameState.automation.resolveActive
}

export function getAutomationProcessingType(): 'resolve' | null {
  if (gameState.automation.resolveActive) return 'resolve'
  return null
}
