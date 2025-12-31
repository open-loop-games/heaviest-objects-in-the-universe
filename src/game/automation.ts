// Automation system for auto-resolve
// Unlocks at tier 2
// Note: Auto-dedup intentionally removed - merging stays manual for gameplay

import { toRaw } from 'vue'
import { gameState, getEcosystemTier } from './state'
import { getPackageAtPath, getPackagesAtPath, getWiresAtPath } from './scope'
import { hasDuplicatesInScope, hasConflictsInScope } from './formulas'
import { getCascadeScopePath, isCascadeActive } from './cascade'
import {
  getResolveDrainMultiplier,
  getResolveSpeedMultiplier,
} from './upgrades'
import { AUTO_RESOLVE_DRAIN } from './config'
import type { Package } from './types'

// ============================================
// AUTOMATION TIMING CONSTANTS
// ============================================

// Interval between auto-resolves by tier (ms)
// Index 0 unused, Index 1-5 = Tiers 1-5
// Tier 1 = no automation, Tier 2 = 3s, Tier 3 = 2s, Tier 4 = 1s, Tier 5 = 0.5s
const RESOLVE_INTERVALS = [
  Infinity, // unused (index 0)
  Infinity, // Tier 1: no automation
  3000, // Tier 2: 3s
  2000, // Tier 3: 2s
  1000, // Tier 4: 1s
  500, // Tier 5: 0.5s
] as const

// Duration of "processing" animation before completion (ms)
const PROCESS_DURATION = 400

// ============================================
// CONFLICT FINDING (ALL SCOPES)
// ============================================

interface ConflictLocation {
  wireId: string
  scopePath: string[] // [] = root, [pkgId] = layer 1, etc.
}

/**
 * Check if a scope path is currently being populated by the cascade system.
 * We should skip automation on scopes that are still populating to avoid
 * race conditions between cascade spawning and automation resolution.
 */
function isScopePopulating(scopePath: string[]): boolean {
  if (!isCascadeActive()) return false

  const cascadePath = getCascadeScopePath()
  if (cascadePath.length === 0) return false

  // Check if the scope path matches or is inside the cascading scope
  // e.g., if cascade is at [A, B], skip [A, B] and [A, B, C] but not [A] or [X]
  if (scopePath.length < cascadePath.length) return false

  for (let i = 0; i < cascadePath.length; i++) {
    if (scopePath[i] !== cascadePath[i]) return false
  }

  return true
}

/**
 * Find the first conflicted wire across all scopes.
 * Searches root scope first, then internal scopes of each package.
 * Skips scopes that are currently being populated by the cascade system.
 */
export function findFirstConflictedWire(): ConflictLocation | null {
  // Check root scope first (root is never cascading)
  for (const [wireId, wire] of toRaw(gameState.wires)) {
    if (wire.conflicted) {
      return { wireId, scopePath: [] }
    }
  }

  // Check internal scopes (recursively), skipping cascading scopes
  for (const [pkgId, pkg] of toRaw(gameState.packages)) {
    const result = findConflictInPackage(pkg, [pkgId])
    if (result) return result
  }

  return null
}

/**
 * Recursively search for conflicts in a package's internal scope
 * Skips scopes that are currently being populated by the cascade system.
 */
function findConflictInPackage(
  pkg: Package,
  scopePath: string[]
): ConflictLocation | null {
  if (!pkg.internalWires) return null

  // Skip this scope if it's currently being populated by the cascade
  // This prevents race conditions between automation and cascade spawning
  if (isScopePopulating(scopePath)) return null

  // Check this package's internal wires
  for (const [wireId, wire] of toRaw(pkg.internalWires)) {
    if (wire.conflicted) {
      return { wireId, scopePath }
    }
  }

  // Recurse into internal packages that have their own scopes
  if (pkg.internalPackages) {
    for (const [innerPkgId, innerPkg] of toRaw(pkg.internalPackages)) {
      const result = findConflictInPackage(innerPkg, [...scopePath, innerPkgId])
      if (result) return result
    }
  }

  return null
}

// ============================================
// SCOPE-AWARE RESOLUTION HELPERS
// ============================================

/**
 * Resolve a wire conflict at a specific scope path
 */
function resolveWireAtPath(wireId: string, scopePath: string[]): boolean {
  const wires = getWiresAtPath(scopePath)
  const packages = getPackagesAtPath(scopePath)

  if (!wires || !packages) return false

  const wire = wires.get(wireId)
  if (!wire || !wire.conflicted) return false

  // Mark wire as resolved
  wire.conflicted = false
  wire.conflictTime = 0

  // Find the conflicted package and mark it as ready
  const targetPkg = packages.get(wire.toId)
  if (targetPkg && targetPkg.state === 'conflict') {
    targetPkg.state = 'ready'
    targetPkg.conflictProgress = 0
  }

  gameState.stats.totalConflictsResolved++

  // If this was inside a package, recalculate its internal state
  if (scopePath.length > 0) {
    recalculateInternalStateAtPath(scopePath)
  }

  return true
}

/**
 * Recalculate internal state after changes at a path
 */
function recalculateInternalStateAtPath(scopePath: string[]): void {
  if (scopePath.length === 0) return

  // Walk up the path and recalculate states
  for (let i = scopePath.length; i > 0; i--) {
    const path = scopePath.slice(0, i)
    const pkg = getPackageAtPath(path)
    if (!pkg) continue

    // Check if all internal issues are resolved
    const hasConflicts = hasConflictsInScope(pkg)
    const hasDuplicates = hasDuplicatesInScope(pkg)

    if (!hasConflicts && !hasDuplicates) {
      pkg.internalState = 'stable'
    } else {
      pkg.internalState = 'unstable'
    }
  }
}

// ============================================
// AUTOMATION UPDATE (CALLED FROM GAME LOOP)
// ============================================

// Callback for visual effects when automation completes
// Includes position for spawning effects at the right location
let onAutoResolveComplete:
  | ((scopePath: string[], position: { x: number; y: number }) => void)
  | null = null

export function setAutoResolveCallback(
  callback: (scopePath: string[], position: { x: number; y: number }) => void
): void {
  onAutoResolveComplete = callback
}

/**
 * Main automation update - call this from the game loop
 * @param now Current timestamp
 * @param deltaTime Time since last update in seconds (for BW drain)
 */
export function updateAutomation(now: number, _deltaTime: number = 0): void {
  const tier = getEcosystemTier(gameState.meta.cacheTokens)
  const auto = gameState.automation

  // ============================================
  // AUTO-RESOLVE (Tier 2+, requires toggle enabled)
  // Momentum loop: Fixed drain per operation (not continuous)
  // ============================================
  if (tier >= 2 && auto.resolveEnabled) {
    // Apply speed upgrade to interval (faster with upgrades)
    const baseInterval = RESOLVE_INTERVALS[tier] ?? Infinity
    const resolveInterval = baseInterval / getResolveSpeedMultiplier()

    // Check if we should start a new resolve
    if (!auto.resolveActive && now - auto.lastResolveTime >= resolveInterval) {
      const conflict = findFirstConflictedWire()
      if (conflict) {
        // Check if we can afford the fixed drain cost
        const drainCost = AUTO_RESOLVE_DRAIN * getResolveDrainMultiplier()
        if (gameState.resources.bandwidth >= drainCost) {
          // Start processing
          auto.resolveActive = true
          auto.resolveTargetWireId = conflict.wireId
          auto.resolveTargetScope = conflict.scopePath
          auto.processStartTime = now
        }
        // If can't afford, don't start - will try again next interval
      }
      auto.lastResolveTime = now
    }

    // Check if current resolve should complete
    if (auto.resolveActive && auto.resolveTargetWireId) {
      if (now - auto.processStartTime >= PROCESS_DURATION) {
        const scopePath = auto.resolveTargetScope ?? []

        // Safety check: abort if the target scope started cascading mid-resolution
        // This prevents race conditions if cascade started after we targeted this wire
        if (isScopePopulating(scopePath)) {
          // Cancel this resolve - we'll find the conflict again after cascade ends
          auto.resolveActive = false
          auto.resolveTargetWireId = null
          auto.resolveTargetScope = null
        } else {
          // Get the wire's target position BEFORE resolving
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

          // Deduct fixed drain cost on completion (momentum loop)
          const drainCost = AUTO_RESOLVE_DRAIN * getResolveDrainMultiplier()
          gameState.resources.bandwidth = Math.max(
            0,
            gameState.resources.bandwidth - drainCost
          )

          // Complete the resolve (no momentum generation - automation doesn't reward)
          const success = resolveWireAtPath(auto.resolveTargetWireId, scopePath)

          if (success && onAutoResolveComplete) {
            onAutoResolveComplete(scopePath, effectPosition)
          }

          // Reset state
          auto.resolveActive = false
          auto.resolveTargetWireId = null
          auto.resolveTargetScope = null
        }
      }
    }
  } else if (auto.resolveActive) {
    // Toggle turned off while processing - cancel
    auto.resolveActive = false
    auto.resolveTargetWireId = null
    auto.resolveTargetScope = null
  }
}

// ============================================
// AUTOMATION STATUS QUERIES
// ============================================

/**
 * Check if automation is currently processing anything
 */
export function isAutomationProcessing(): boolean {
  return gameState.automation.resolveActive
}

/**
 * Get the type of automation currently processing
 */
export function getAutomationProcessingType(): 'resolve' | null {
  if (gameState.automation.resolveActive) return 'resolve'
  return null
}
