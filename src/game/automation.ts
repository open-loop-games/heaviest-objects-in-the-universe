// Automation system for auto-resolve and auto-dedup
// Unlocks at tier 2 (resolve) and tier 3 (dedup)

import { toRaw } from 'vue'
import { gameState, getEcosystemTier } from './state'
import { resolveWireConflict } from './mutations'
import { performSymlinkMerge, getAllDuplicateGroups } from './symlinks'
import { getPackageAtPath } from './scope'
import type { Wire, Package } from './types'

// ============================================
// AUTOMATION TIMING CONSTANTS
// ============================================

// Interval between auto-resolves by tier (ms)
// Index 0 unused, Index 1-5 = Tiers 1-5
// Tier 1 = no automation, Tier 2 = 3s, Tier 3 = 2s, Tier 4 = 1s, Tier 5 = 0.5s
export const RESOLVE_INTERVALS = [
  Infinity, // unused (index 0)
  Infinity, // Tier 1: no automation
  3000, // Tier 2: 3s
  2000, // Tier 3: 2s
  1000, // Tier 4: 1s
  500, // Tier 5: 0.5s
] as const

// Interval between auto-dedups by tier (ms)
// Index 0 unused, Index 1-5 = Tiers 1-5
// Tier 1-2 = no automation, Tier 3 = 3s, Tier 4 = 2s, Tier 5 = 1s
export const DEDUP_INTERVALS = [
  Infinity, // unused (index 0)
  Infinity, // Tier 1: no automation
  Infinity, // Tier 2: no automation
  3000, // Tier 3: 3s
  2000, // Tier 4: 2s
  1000, // Tier 5: 1s
] as const

// Duration of "processing" animation before completion (ms)
export const PROCESS_DURATION = 400

// ============================================
// CONFLICT FINDING (ALL SCOPES)
// ============================================

interface ConflictLocation {
  wireId: string
  scopePath: string[] // [] = root, [pkgId] = layer 1, etc.
}

/**
 * Find the first conflicted wire across all scopes.
 * Searches root scope first, then internal scopes of each package.
 */
export function findFirstConflictedWire(): ConflictLocation | null {
  // Check root scope first
  for (const [wireId, wire] of toRaw(gameState.wires)) {
    if (wire.conflicted) {
      return { wireId, scopePath: [] }
    }
  }

  // Check internal scopes (recursively)
  for (const [pkgId, pkg] of toRaw(gameState.packages)) {
    const result = findConflictInPackage(pkg, [pkgId])
    if (result) return result
  }

  return null
}

/**
 * Recursively search for conflicts in a package's internal scope
 */
function findConflictInPackage(
  pkg: Package,
  scopePath: string[]
): ConflictLocation | null {
  if (!pkg.internalWires) return null

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
// DUPLICATE FINDING (ALL SCOPES)
// ============================================

interface DuplicateLocation {
  packageIds: [string, string] // Pair of package IDs with same identity
  scopePath: string[] // [] = root, [pkgId] = layer 1, etc.
}

/**
 * Find the first duplicate pair across all scopes.
 * Searches root scope first, then internal scopes.
 */
export function findFirstDuplicatePair(): DuplicateLocation | null {
  // Check root scope first
  const rootDups = findDuplicatesInScope(
    toRaw(gameState.packages),
    gameState.rootId
  )
  if (rootDups) {
    return { packageIds: rootDups, scopePath: [] }
  }

  // Check internal scopes (recursively)
  for (const [pkgId, pkg] of toRaw(gameState.packages)) {
    const result = findDuplicatesInPackage(pkg, [pkgId])
    if (result) return result
  }

  return null
}

/**
 * Find duplicates within a specific scope (map of packages)
 */
function findDuplicatesInScope(
  packages: Map<string, Package>,
  rootId: string | null
): [string, string] | null {
  const identityGroups = new Map<string, string[]>()

  for (const [id, pkg] of packages) {
    if (!pkg.identity) continue
    if (pkg.isGhost) continue
    if (id === rootId) continue // Don't include root

    // Skip packages with internal scopes at root (complex packages)
    if (
      rootId === gameState.rootId &&
      pkg.internalPackages &&
      pkg.internalPackages.size > 0
    ) {
      continue
    }

    const name = pkg.identity.name
    const group = identityGroups.get(name) || []
    group.push(id)
    identityGroups.set(name, group)
  }

  // Find first group with 2+ packages
  for (const ids of identityGroups.values()) {
    if (ids.length >= 2) {
      return [ids[0]!, ids[1]!]
    }
  }

  return null
}

/**
 * Recursively search for duplicates in a package's internal scope
 */
function findDuplicatesInPackage(
  pkg: Package,
  scopePath: string[]
): DuplicateLocation | null {
  if (!pkg.internalPackages) return null

  // Check this package's internal packages
  const scopeRootId = scopePath[scopePath.length - 1] ?? null
  const dups = findDuplicatesInScope(toRaw(pkg.internalPackages), scopeRootId)
  if (dups) {
    return { packageIds: dups, scopePath }
  }

  // Recurse into internal packages that have their own scopes
  for (const [innerPkgId, innerPkg] of toRaw(pkg.internalPackages)) {
    const result = findDuplicatesInPackage(innerPkg, [...scopePath, innerPkgId])
    if (result) return result
  }

  return null
}

// ============================================
// SCOPE-AWARE RESOLUTION HELPERS
// ============================================

/**
 * Get the wire map for a specific scope path
 */
function getWiresAtPath(scopePath: string[]): Map<string, Wire> | null {
  if (scopePath.length === 0) {
    return gameState.wires
  }

  const pkg = getPackageAtPath(scopePath)
  return pkg?.internalWires ?? null
}

/**
 * Get the package map for a specific scope path
 */
function getPackagesAtPath(scopePath: string[]): Map<string, Package> | null {
  if (scopePath.length === 0) {
    return gameState.packages
  }

  const pkg = getPackageAtPath(scopePath)
  return pkg?.internalPackages ?? null
}

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
 * Merge duplicates at a specific scope path
 */
function mergeDuplicatesAtPath(
  sourceId: string,
  targetId: string,
  scopePath: string[]
): number {
  // For now, we need to temporarily switch scope to perform the merge
  // This is a bit hacky but ensures all the existing merge logic works
  const originalScope = gameState.currentScope
  const originalStack = [...gameState.scopeStack]

  try {
    // Set scope to the target path
    if (scopePath.length === 0) {
      gameState.currentScope = 'root'
      gameState.scopeStack = []
    } else {
      gameState.currentScope = scopePath[scopePath.length - 1]!
      gameState.scopeStack = scopePath
    }

    // Perform the merge using existing scope-aware function
    const result = performSymlinkMerge(sourceId, targetId)

    return result
  } finally {
    // Restore original scope
    gameState.currentScope = originalScope
    gameState.scopeStack = originalStack
  }
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
    const hasConflicts = checkForConflicts(pkg)
    const hasDuplicates = checkForDuplicates(pkg)

    if (!hasConflicts && !hasDuplicates) {
      pkg.internalState = 'stable'
    } else {
      pkg.internalState = 'unstable'
    }
  }
}

function checkForConflicts(pkg: Package): boolean {
  if (!pkg.internalWires) return false
  for (const wire of pkg.internalWires.values()) {
    if (wire.conflicted) return true
  }
  // Check nested packages
  if (pkg.internalPackages) {
    for (const innerPkg of pkg.internalPackages.values()) {
      if (checkForConflicts(innerPkg)) return true
    }
  }
  return false
}

function checkForDuplicates(pkg: Package): boolean {
  if (!pkg.internalPackages) return false
  const scopeRootId = pkg.id
  const dups = findDuplicatesInScope(pkg.internalPackages, scopeRootId)
  return dups !== null
}

// ============================================
// AUTOMATION UPDATE (CALLED FROM GAME LOOP)
// ============================================

// Callback for visual effects when automation completes
// Includes position for spawning effects at the right location
let onAutoResolveComplete:
  | ((scopePath: string[], position: { x: number; y: number }) => void)
  | null = null
let onAutoDedupComplete:
  | ((scopePath: string[], position: { x: number; y: number }) => void)
  | null = null

export function setAutoResolveCallback(
  callback: (scopePath: string[], position: { x: number; y: number }) => void
): void {
  onAutoResolveComplete = callback
}

export function setAutoDedupCallback(
  callback: (scopePath: string[], position: { x: number; y: number }) => void
): void {
  onAutoDedupComplete = callback
}

/**
 * Main automation update - call this from the game loop
 */
export function updateAutomation(now: number): void {
  const tier = getEcosystemTier(gameState.meta.cacheTokens)
  const auto = gameState.automation

  // ============================================
  // AUTO-RESOLVE (Tier 2+)
  // ============================================
  if (tier >= 2) {
    const resolveInterval = RESOLVE_INTERVALS[tier] ?? Infinity

    // Check if we should start a new resolve
    if (!auto.resolveActive && now - auto.lastResolveTime >= resolveInterval) {
      const conflict = findFirstConflictedWire()
      if (conflict) {
        // Start processing
        auto.resolveActive = true
        auto.resolveTargetWireId = conflict.wireId
        auto.resolveTargetScope = conflict.scopePath
        auto.processStartTime = now
      }
      auto.lastResolveTime = now
    }

    // Check if current resolve should complete
    if (auto.resolveActive && auto.resolveTargetWireId) {
      if (now - auto.processStartTime >= PROCESS_DURATION) {
        // Get the wire's target position BEFORE resolving
        const scopePath = auto.resolveTargetScope ?? []
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

        // Complete the resolve
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

  // ============================================
  // AUTO-DEDUP (Tier 3+)
  // ============================================
  if (tier >= 3) {
    const dedupInterval = DEDUP_INTERVALS[tier] ?? Infinity

    // Check if we should start a new dedup
    if (!auto.dedupActive && now - auto.lastDedupTime >= dedupInterval) {
      const duplicates = findFirstDuplicatePair()
      if (duplicates) {
        // Start processing
        auto.dedupActive = true
        auto.dedupTargetPair = duplicates.packageIds
        auto.dedupTargetScope = duplicates.scopePath
        auto.processStartTime = now
      }
      auto.lastDedupTime = now
    }

    // Check if current dedup should complete
    if (auto.dedupActive && auto.dedupTargetPair) {
      if (now - auto.processStartTime >= PROCESS_DURATION) {
        const [sourceId, targetId] = auto.dedupTargetPair
        const scopePath = auto.dedupTargetScope ?? []

        // Get target position BEFORE merging
        const packages = getPackagesAtPath(scopePath)
        let effectPosition = { x: 0, y: 0 }
        if (packages) {
          const targetPkg = packages.get(targetId)
          if (targetPkg) {
            effectPosition = { x: targetPkg.position.x, y: targetPkg.position.y }
          }
        }

        // Complete the merge
        const weightSaved = mergeDuplicatesAtPath(sourceId, targetId, scopePath)

        if (weightSaved > 0 && onAutoDedupComplete) {
          onAutoDedupComplete(scopePath, effectPosition)
        }

        // Reset state
        auto.dedupActive = false
        auto.dedupTargetPair = null
        auto.dedupTargetScope = null
      }
    }
  }
}

// ============================================
// AUTOMATION STATUS QUERIES
// ============================================

/**
 * Check if automation is currently processing anything
 */
export function isAutomationProcessing(): boolean {
  return (
    gameState.automation.resolveActive || gameState.automation.dedupActive
  )
}

/**
 * Get the type of automation currently processing
 */
export function getAutomationProcessingType(): 'resolve' | 'dedup' | null {
  if (gameState.automation.resolveActive) return 'resolve'
  if (gameState.automation.dedupActive) return 'dedup'
  return null
}

/**
 * Get progress of current automation process (0-1)
 */
export function getAutomationProgress(): number {
  const auto = gameState.automation
  if (!auto.resolveActive && !auto.dedupActive) return 0

  const elapsed = Date.now() - auto.processStartTime
  return Math.min(1, elapsed / PROCESS_DURATION)
}
