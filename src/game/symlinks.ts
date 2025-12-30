// Symlink detection and duplicate management
// SCOPE-AWARE: All functions work for both root scope and internal package scopes

import { toRaw } from 'vue'
import { gameState } from './state'
import {
  getCurrentScopePackages,
  getCurrentScopeWires,
  getCurrentScopeRoot,
  isInPackageScope,
  isCurrentScopeRoot,
} from './scope'
import type { Package } from './types'
import { triggerOrganizeBoost, markPackageRelocated } from './physics'

// Callback to avoid circular dependency
// Set by packages.ts on initialization - takes full scope path for arbitrary depth
let _recalculateStateAtPath: ((scopePath: string[]) => void) | null = null

export function setRecalculateCallback(fn: (scopePath: string[]) => void): void {
  _recalculateStateAtPath = fn
}

function getRecalculateStateAtPath() {
  return _recalculateStateAtPath
}

// Halo colors for duplicate groups (cycle through these)
export const HALO_COLORS = [
  0x22d3ee, // Cyan
  0xe879f9, // Magenta
  0xfacc15, // Yellow
  0x84cc16, // Lime
]

export interface DuplicateGroup {
  identityName: string
  packageIds: string[]
  haloColor: number
  haloColorIndex: number
}

// Cache of duplicate groups (recalculated each frame, scope-aware)
const duplicateGroups: Map<string, DuplicateGroup> = new Map()

// ============================================
// DUPLICATE DETECTION (SCOPE-AWARE)
// ============================================

/**
 * Find all duplicate package groups (packages with same identity)
 * SCOPE-AWARE: Uses getCurrentScopePackages() so it works both at root and inside packages
 * Call this each frame or when packages change
 */
export function updateDuplicateGroups(): void {
  duplicateGroups.clear()

  const identityGroups = new Map<string, string[]>()
  const scopePackages = toRaw(getCurrentScopePackages())

  for (const [id, pkg] of scopePackages) {
    if (!pkg.identity) continue
    if (pkg.isGhost) continue

    // At root scope, never include root in duplicate groups
    if (!isInPackageScope() && id === gameState.rootId) continue

    // At root scope, exclude packages with internal scopes (complex packages)
    // These have portal rings and can't be simply merged like duplicates
    if (
      !isInPackageScope() &&
      pkg.internalPackages &&
      pkg.internalPackages.size > 0
    )
      continue

    const name = pkg.identity.name
    const group = identityGroups.get(name) || []
    group.push(id)
    identityGroups.set(name, group)
  }

  // Only keep groups with 2+ packages (actual duplicates)
  let colorIndex = 0
  for (const [name, ids] of identityGroups) {
    if (ids.length >= 2) {
      duplicateGroups.set(name, {
        identityName: name,
        packageIds: ids,
        haloColor: HALO_COLORS[colorIndex % HALO_COLORS.length]!,
        haloColorIndex: colorIndex % HALO_COLORS.length,
      })
      colorIndex++
    }
  }
}

/**
 * Get the duplicate group for a package (if any)
 * SCOPE-AWARE
 */
export function getDuplicateGroup(packageId: string): DuplicateGroup | null {
  const scopePackages = toRaw(getCurrentScopePackages())
  const pkg = scopePackages.get(packageId)
  if (!pkg?.identity) return null

  return duplicateGroups.get(pkg.identity.name) || null
}

/**
 * Check if a package has duplicates
 */
export function hasDuplicates(packageId: string): boolean {
  return getDuplicateGroup(packageId) !== null
}

/**
 * Get all duplicate groups
 */
export function getAllDuplicateGroups(): DuplicateGroup[] {
  return Array.from(duplicateGroups.values())
}

/**
 * Get other packages that are duplicates of this one
 * SCOPE-AWARE
 */
export function getOtherDuplicates(packageId: string): Package[] {
  const group = getDuplicateGroup(packageId)
  if (!group) return []

  const scopePackages = toRaw(getCurrentScopePackages())
  return group.packageIds
    .filter((id) => id !== packageId)
    .map((id) => scopePackages.get(id))
    .filter((pkg): pkg is Package => pkg !== undefined)
}

// ============================================
// SYMLINK OPERATIONS (SCOPE-AWARE)
// ============================================

/**
 * Check if two packages can be symlinked (same identity)
 * SCOPE-AWARE: Works for both root scope and internal packages
 */
export function canSymlink(sourceId: string, targetId: string): boolean {
  if (sourceId === targetId) return false

  // Never allow scope root to be a symlink source
  if (isCurrentScopeRoot(sourceId)) return false

  const scopePackages = toRaw(getCurrentScopePackages())
  const source = scopePackages.get(sourceId)
  const target = scopePackages.get(targetId)

  if (!source?.identity || !target?.identity) return false
  if (source.identity.name !== target.identity.name) return false

  return true
}

/**
 * Result of a symlink merge operation
 */
export interface MergeResult {
  weightSaved: number
  bandwidthRefund: number
}

/**
 * Check if a package is compressed (has internal scope)
 */
function isCompressed(pkg: Package): boolean {
  return pkg.internalPackages !== null && pkg.internalWires !== null
}

/**
 * Determine which node should be kept in a merge.
 * Priority: 1) compressed packages, 2) lower depth, 3) closer to origin.
 * Returns true if A should be kept over B.
 */
function shouldKeep(a: Package, b: Package): boolean {
  // First priority: prefer compressed packages (preserve nested content)
  const aCompressed = isCompressed(a)
  const bCompressed = isCompressed(b)
  if (aCompressed !== bCompressed) {
    return aCompressed
  }

  // Second priority: lower depth = more central (closer to root in tree)
  if (a.depth !== b.depth) {
    return a.depth < b.depth
  }

  // Third priority: closer to center (euclidean distance)
  const distA = Math.sqrt(a.position.x ** 2 + a.position.y ** 2)
  const distB = Math.sqrt(b.position.x ** 2 + b.position.y ** 2)
  return distA < distB
}

/**
 * Perform a symlink merge: keep the more central node, other vanishes cleanly
 * SCOPE-AWARE: Works for both root scope and internal packages
 * Returns the weight saved from the merge
 */
export function performSymlinkMerge(
  sourceId: string,
  targetId: string
): number {
  if (!canSymlink(sourceId, targetId)) return 0

  const packages = getCurrentScopePackages()
  const wires = getCurrentScopeWires()
  const inScope = isInPackageScope()

  let source = packages.get(sourceId)
  let target = packages.get(targetId)
  if (!source || !target) return 0

  // Prefer keeping: compressed packages > lower depth > closer to center
  // This preserves nested content and keeps merged hub nodes well-positioned
  if (shouldKeep(source, target)) {
    // Swap: source becomes target, target becomes source
    ;[source, target] = [target, source]
    ;[sourceId, targetId] = [targetId, sourceId]
  }

  // Calculate weight savings (50% of source)
  const weightSaved = Math.floor(source.size / 2)

  // === IMMEDIATE REWARDS ===
  const bandwidthRefund = Math.floor(source.size * 0.3)
  gameState.resources.bandwidth = Math.min(
    gameState.resources.maxBandwidth,
    gameState.resources.bandwidth + bandwidthRefund
  )

  // Reduce global weight
  gameState.resources.weight -= weightSaved

  // If in scope, also reduce the scope package's size (works at any depth)
  if (inScope) {
    const scopePkg = getCurrentScopeRoot()
    if (scopePkg) {
      scopePkg.size -= weightSaved
    }
  }

  // === HANDLE WIRES ===
  const wiresToDelete: string[] = []

  for (const [wireId, wire] of wires) {
    if (wire.toId === sourceId) {
      if (wire.fromId === targetId) {
        wiresToDelete.push(wireId)
      } else {
        const wouldDuplicate = Array.from(wires.values()).some(
          (w) =>
            w.id !== wireId && w.fromId === wire.fromId && w.toId === targetId
        )
        if (wouldDuplicate) {
          wiresToDelete.push(wireId)
        } else {
          wire.toId = targetId
        }
      }
    } else if (wire.fromId === sourceId) {
      if (wire.toId === targetId) {
        wiresToDelete.push(wireId)
      } else {
        const wouldDuplicate = Array.from(wires.values()).some(
          (w) =>
            w.id !== wireId && w.fromId === targetId && w.toId === wire.toId
        )
        if (wouldDuplicate) {
          wiresToDelete.push(wireId)
        } else {
          wire.fromId = targetId
        }
      }
    }
  }

  for (const wireId of wiresToDelete) {
    wires.delete(wireId)
  }

  // === HANDLE PARENT'S CHILDREN LIST ===
  if (source.parentId && !isCurrentScopeRoot(source.parentId)) {
    const parent = packages.get(source.parentId)
    if (parent) {
      parent.children = parent.children.filter((id) => id !== sourceId)
    }
  }

  // === TRANSFER CHILDREN ===
  for (const childId of source.children) {
    const child = packages.get(childId)
    if (child) {
      child.parentId = targetId
      if (!target.children.includes(childId)) {
        target.children.push(childId)
      }
      // At root scope, mark relocated for phasing
      if (!inScope) {
        markSubtreeRelocated(childId, packages)
      }
    }
  }

  // === REMOVE SOURCE ===
  packages.delete(sourceId)

  // === UPDATE STATS ===
  gameState.stats.totalSymlinksCreated++
  if (!gameState.onboarding.firstSymlinkSeen) {
    gameState.onboarding.firstSymlinkSeen = true
  }

  // === POST-MERGE ACTIONS ===
  // === OPTION B: Recompute anchor for target (now a hub with more connections) ===
  // Mark target for relocation so physics pulls it toward optimal position
  if (!inScope) {
    markPackageRelocated(targetId)
    // Trigger organize boost for root scope
    triggerOrganizeBoost()
  }

  if (inScope) {
    // Recalculate internal state (might become stable) - use full scope path
    const recalcFn = getRecalculateStateAtPath()
    if (recalcFn) {
      recalcFn([...gameState.scopeStack])
    }
  }

  return weightSaved
}

/**
 * Helper: Mark a subtree as relocated for physics phasing
 */
function markSubtreeRelocated(
  pkgId: string,
  packages: Map<string, Package>
): void {
  markPackageRelocated(pkgId)
  const pkg = packages.get(pkgId)
  if (pkg) {
    for (const childId of pkg.children) {
      markSubtreeRelocated(childId, packages)
    }
  }
}
