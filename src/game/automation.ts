// Auto-resolve, a meta upgrade: each level sells capacity, the rate at which it clears
// conflicts in scopes the player has left. The spine solves the interval per level.

import { gameState, stack } from './state'
import {
  getPackagesAtPath,
  getWiresAtPath,
  recalculateStateAtPath,
} from './scope'
import { getCascadeScopePath, isCascadeActive } from './cascade'
import { emit } from './events'
import { getCrossPackageConflicts } from './cross-package'
import { recordAutoResolve } from './achievements'
import { countResolved, iterateEnteredScopes } from './mutations'
import { GAME_SPINE } from './spine'

const PROCESS_DURATION = 400

/** Milliseconds between auto-resolves at the owned level; Infinity before level 1. */
function resolveIntervalMs(): number {
  const level = gameState.upgrades.autoResolve
  return (GAME_SPINE.autoResolveIntervals[level] ?? Infinity) * 1000
}

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

function isCurrentScope(scopePath: readonly string[]): boolean {
  const current = stack.path
  return (
    current.length === scopePath.length &&
    current.every((id, i) => id === scopePath[i])
  )
}

/**
 * The first conflicted wire in an entered scope the player is not in. The current scope's
 * conflicts stay the player's to chain: clearing them would take a skilled player's combo
 * fodder first, a tax on skill. Skips cross-package conflicts, which re-appear unless the
 * node is removed.
 */
function findLeftBehindConflict(): ConflictLocation | null {
  for (const { path, graph: scopeGraph } of iterateEnteredScopes()) {
    if (isCurrentScope(path) || isScopePopulating(path)) continue
    for (const [wireId, edge] of scopeGraph.edges) {
      if (!edge.data.conflicted) continue
      if (isCrossPackageConflict(wireId, path)) continue
      return { wireId, scopePath: path }
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
  countResolved()

  if (scopePath.length > 0) {
    recalculateStateAtPath(scopePath)
  }

  return true
}

// ============================================
// AUTOMATION UPDATE (CALLED FROM GAME LOOP)
// ============================================

export function updateAutomation(now: number): void {
  const auto = gameState.automation
  const resolveInterval = resolveIntervalMs()

  if (Number.isFinite(resolveInterval) && auto.resolveEnabled) {
    if (!auto.resolveActive && now - auto.lastResolveTime >= resolveInterval) {
      const conflict = findLeftBehindConflict()
      if (conflict) {
        auto.resolveActive = true
        auto.resolveTargetWireId = conflict.wireId
        auto.resolveTargetScope = conflict.scopePath
        auto.processStartTime = now
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
