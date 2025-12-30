// Cross-package conflict and duplicate detection (Phase 4-5)
// These systems detect relationships BETWEEN top-level packages based on their internal dependencies

import { toRaw } from 'vue'
import { gameState } from './state'
import type { Package, Wire } from './types'
import { areIncompatible } from './registry'
import { HALO_COLORS } from './symlinks'
import { isDepHoisted } from './hoisting'

// ============================================
// CROSS-PACKAGE CONFLICTS (Phase 4)
// ============================================

/**
 * Represents a conflict between two top-level packages
 * due to incompatible internal dependencies
 */
export interface CrossPackageConflict {
  packageAId: string
  packageBId: string
  conflictingDepA: string // Identity name in package A
  conflictingDepB: string // Identity name in package B
}

// Cache for cross-package conflicts (recalculated each frame)
let crossPackageConflicts: CrossPackageConflict[] = []
const siblingWires: Map<string, Wire> = new Map()

// Track packages marked as cross-package conflicted (to clear stale states)
const previouslyConflictedPackages: Set<string> = new Set()

/**
 * Detect conflicts between top-level packages based on their internal deps.
 * E.g., Package A contains "moment", Package B contains "date-fns" → conflict
 * Only runs at root scope.
 */
export function updateCrossPackageConflicts(): void {
  crossPackageConflicts = []
  siblingWires.clear()

  // Only detect at root scope
  if (gameState.currentScope !== 'root') return

  // Clear stale conflict states from previously marked packages
  for (const pkgId of previouslyConflictedPackages) {
    // Find the internal package and clear its state if it still exists
    for (const topLevelPkg of gameState.packages.values()) {
      if (topLevelPkg.parentId !== gameState.rootId) continue
      const innerPkg = topLevelPkg.internalPackages?.get(pkgId)
      if (innerPkg && innerPkg.state === 'conflict') {
        // Reset to ready (will be re-marked if still conflicted)
        innerPkg.state = 'ready'
        // Also clear the wire's conflicted flag
        if (topLevelPkg.internalWires) {
          for (const wire of topLevelPkg.internalWires.values()) {
            if (wire.toId === pkgId) {
              wire.conflicted = false
              wire.conflictTime = 0
            }
          }
        }
      }
    }
  }
  previouslyConflictedPackages.clear()

  const rawPackages = toRaw(gameState.packages)
  const topLevelPackages: Package[] = []

  // Collect all top-level packages (direct children of root)
  for (const pkg of rawPackages.values()) {
    if (pkg.parentId === gameState.rootId && pkg.internalPackages) {
      topLevelPackages.push(pkg)
    }
  }

  // Compare each pair of top-level packages
  for (let i = 0; i < topLevelPackages.length; i++) {
    for (let j = i + 1; j < topLevelPackages.length; j++) {
      const pkgA = topLevelPackages[i]!
      const pkgB = topLevelPackages[j]!

      // Check each internal dep in A against each internal dep in B
      if (!pkgA.internalPackages || !pkgB.internalPackages) continue

      for (const innerA of pkgA.internalPackages.values()) {
        if (!innerA.identity || innerA.isGhost) continue

        for (const innerB of pkgB.internalPackages.values()) {
          if (!innerB.identity || innerB.isGhost) continue

          if (areIncompatible(innerA.identity.name, innerB.identity.name)) {
            crossPackageConflicts.push({
              packageAId: pkgA.id,
              packageBId: pkgB.id,
              conflictingDepA: innerA.identity.name,
              conflictingDepB: innerB.identity.name,
            })

            // Mark the internal packages as conflicted so they show conflict state when inside
            innerA.state = 'conflict'
            innerB.state = 'conflict'

            // Track for cleanup on next frame
            previouslyConflictedPackages.add(innerA.id)
            previouslyConflictedPackages.add(innerB.id)

            // Mark the internal wires to these packages as conflicted (for Prune/Upgrade UI)
            if (pkgA.internalWires) {
              for (const wire of pkgA.internalWires.values()) {
                if (wire.toId === innerA.id) {
                  wire.conflicted = true
                  if (!wire.conflictTime) wire.conflictTime = Date.now()
                }
              }
            }
            if (pkgB.internalWires) {
              for (const wire of pkgB.internalWires.values()) {
                if (wire.toId === innerB.id) {
                  wire.conflicted = true
                  if (!wire.conflictTime) wire.conflictTime = Date.now()
                }
              }
            }

            // Create sibling conflict wire
            const wireId = `sibling_${pkgA.id}_${pkgB.id}`
            if (!siblingWires.has(wireId)) {
              siblingWires.set(wireId, {
                id: wireId,
                fromId: pkgA.id,
                toId: pkgB.id,
                wireType: 'sibling',
                isSymlink: false,
                flowProgress: 0,
                conflicted: true,
                conflictTime: Date.now(),
              })
            }
          }
        }
      }
    }
  }
}

/**
 * Get all cross-package conflicts
 */
export function getCrossPackageConflicts(): CrossPackageConflict[] {
  return crossPackageConflicts
}

/**
 * Get sibling wires (for rendering at root scope)
 */
export function getSiblingWires(): Map<string, Wire> {
  return siblingWires
}

/**
 * Check if a top-level package has any cross-package conflicts
 */
export function hasCrossPackageConflict(packageId: string): boolean {
  return crossPackageConflicts.some(
    (c) => c.packageAId === packageId || c.packageBId === packageId
  )
}

/**
 * Get the conflicting internal dep name for a package in a conflict
 */
export function getConflictingInternalDep(packageId: string): string | null {
  for (const conflict of crossPackageConflicts) {
    if (conflict.packageAId === packageId) return conflict.conflictingDepA
    if (conflict.packageBId === packageId) return conflict.conflictingDepB
  }
  return null
}

// ============================================
// CROSS-PACKAGE DUPLICATES (Phase 4)
// ============================================

/**
 * Represents a duplicate shared between two top-level packages
 */
export interface CrossPackageDuplicate {
  packageAId: string
  packageBId: string
  identityName: string // The shared internal dep name
  haloColor: number
}

// Cache for cross-package duplicates
let crossPackageDuplicates: CrossPackageDuplicate[] = []

/**
 * Detect duplicates between top-level packages.
 * E.g., Package A contains "lodash", Package B contains "lodash" → duplicate
 * Only runs at root scope.
 */
export function updateCrossPackageDuplicates(): void {
  crossPackageDuplicates = []

  // Only detect at root scope
  if (gameState.currentScope !== 'root') return

  const rawPackages = toRaw(gameState.packages)

  // Map: identity name → list of (packageId, internalPkgId)
  const identityToPackages = new Map<
    string,
    { packageId: string; internalId: string }[]
  >()

  // Collect all internal deps from all top-level packages
  for (const pkg of rawPackages.values()) {
    if (pkg.parentId !== gameState.rootId || !pkg.internalPackages) continue

    for (const [internalId, innerPkg] of pkg.internalPackages) {
      if (!innerPkg.identity || innerPkg.isGhost) continue

      const name = innerPkg.identity.name
      const list = identityToPackages.get(name) || []
      list.push({ packageId: pkg.id, internalId })
      identityToPackages.set(name, list)
    }
  }

  // Find identities that appear in multiple top-level packages
  // Skip deps that are already hoisted (they're handled by the hoisting system)
  let colorIndex = 0
  for (const [identityName, locations] of identityToPackages) {
    // Skip if this dep is already hoisted
    if (isDepHoisted(identityName)) continue

    // Get unique package IDs
    const uniquePackageIds = [...new Set(locations.map((l) => l.packageId))]

    if (uniquePackageIds.length >= 2) {
      // Create pairs of duplicates
      for (let i = 0; i < uniquePackageIds.length; i++) {
        for (let j = i + 1; j < uniquePackageIds.length; j++) {
          crossPackageDuplicates.push({
            packageAId: uniquePackageIds[i]!,
            packageBId: uniquePackageIds[j]!,
            identityName,
            haloColor: HALO_COLORS[colorIndex % HALO_COLORS.length]!,
          })
        }
      }
      colorIndex++
    }
  }
}

/**
 * Get all cross-package duplicates
 */
export function getCrossPackageDuplicates(): CrossPackageDuplicate[] {
  return crossPackageDuplicates
}

/**
 * Check if a top-level package has any cross-package duplicates
 */
export function hasCrossPackageDuplicate(packageId: string): boolean {
  return crossPackageDuplicates.some(
    (d) => d.packageAId === packageId || d.packageBId === packageId
  )
}

/**
 * Get duplicate info for a package (for rendering halo)
 */
export function getCrossPackageDuplicateInfo(
  packageId: string
): { haloColor: number; identityName: string } | null {
  const dup = crossPackageDuplicates.find(
    (d) => d.packageAId === packageId || d.packageBId === packageId
  )
  if (!dup) return null
  return { haloColor: dup.haloColor, identityName: dup.identityName }
}

// ============================================
// CROSS-PACKAGE SYMLINK (Phase 5)
// ============================================

/**
 * Check if two top-level packages can be symlinked (share internal deps)
 * Returns the shared identity name if symlinkable, null otherwise
 */
export function canCrossPackageSymlink(
  sourceId: string,
  targetId: string
): string | null {
  if (sourceId === targetId) return null

  const source = toRaw(gameState.packages).get(sourceId)
  const target = toRaw(gameState.packages).get(targetId)

  if (!source || !target) return null
  if (!source.internalPackages || !target.internalPackages) return null

  // Both must be top-level packages
  if (source.parentId !== gameState.rootId) return null
  if (target.parentId !== gameState.rootId) return null

  // Find shared internal deps (same identity name)
  for (const innerSource of source.internalPackages.values()) {
    if (!innerSource.identity || innerSource.isGhost) continue

    for (const innerTarget of target.internalPackages.values()) {
      if (!innerTarget.identity || innerTarget.isGhost) continue

      if (innerSource.identity.name === innerTarget.identity.name) {
        return innerSource.identity.name
      }
    }
  }

  return null
}

/**
 * Get all shared internal dep names between two packages
 */
export function getSharedInternalDeps(
  pkgAId: string,
  pkgBId: string
): string[] {
  const pkgA = toRaw(gameState.packages).get(pkgAId)
  const pkgB = toRaw(gameState.packages).get(pkgBId)

  if (!pkgA?.internalPackages || !pkgB?.internalPackages) return []

  const shared: string[] = []
  const namesInA = new Set<string>()

  for (const inner of pkgA.internalPackages.values()) {
    if (inner.identity && !inner.isGhost) {
      namesInA.add(inner.identity.name)
    }
  }

  for (const inner of pkgB.internalPackages.values()) {
    if (inner.identity && !inner.isGhost && namesInA.has(inner.identity.name)) {
      shared.push(inner.identity.name)
    }
  }

  return shared
}

/**
 * Perform cross-package symlink: source package's internal dep becomes a ghost
 * The ghost points to the target package's real instance
 *
 * @param sourcePackageId - Top-level package whose internal dep will become ghost
 * @param targetPackageId - Top-level package that keeps the real dep
 * @param identityName - The internal dep identity to symlink
 * @returns Weight saved by the ghost conversion
 */
export function performCrossPackageSymlink(
  sourcePackageId: string,
  targetPackageId: string,
  identityName: string
): number {
  const source = gameState.packages.get(sourcePackageId)
  const target = gameState.packages.get(targetPackageId)

  if (!source?.internalPackages || !target?.internalPackages) return 0

  // Find the internal dep in source
  let sourceInner: Package | null = null
  let sourceInnerId: string | null = null
  for (const [id, inner] of source.internalPackages) {
    if (inner.identity?.name === identityName && !inner.isGhost) {
      sourceInner = inner
      sourceInnerId = id
      break
    }
  }

  // Find the internal dep in target
  let targetInner: Package | null = null
  let targetInnerId: string | null = null
  for (const [id, inner] of target.internalPackages) {
    if (inner.identity?.name === identityName && !inner.isGhost) {
      targetInner = inner
      targetInnerId = id
      break
    }
  }

  if (!sourceInner || !targetInner || !sourceInnerId || !targetInnerId) return 0

  // Determine which becomes ghost (smaller package's instance)
  let ghostPkg: Package
  let ghostPkgId: string
  let realPkg: Package
  let ghostOwner: Package
  let realOwner: Package

  if (source.size <= target.size) {
    ghostPkg = sourceInner
    ghostPkgId = sourceInnerId
    realPkg = targetInner
    ghostOwner = source
    realOwner = target
  } else {
    ghostPkg = targetInner
    ghostPkgId = targetInnerId
    realPkg = sourceInner
    ghostOwner = target
    realOwner = source
  }

  // Calculate weight to transfer (ghost loses its weight)
  const weightSaved = ghostPkg.size

  // Convert to ghost
  ghostPkg.isGhost = true
  ghostPkg.ghostTargetId = realPkg.id
  ghostPkg.ghostTargetScope = realOwner.id
  ghostPkg.state = 'optimized'

  // Transfer weight: remove from ghost owner
  ghostOwner.size -= weightSaved
  gameState.resources.weight -= weightSaved

  // Mark real node as optimized
  realPkg.state = 'optimized'

  // Clear any conflicts on the ghost (ghosts can't conflict)
  if (ghostOwner.internalWires) {
    for (const wire of ghostOwner.internalWires.values()) {
      if (wire.toId === ghostPkgId) {
        wire.conflicted = false
        wire.conflictTime = 0
      }
    }
  }

  // Update stats
  gameState.stats.totalSymlinksCreated++

  // Mark first symlink seen
  if (!gameState.onboarding.firstSymlinkSeen) {
    gameState.onboarding.firstSymlinkSeen = true
  }

  return weightSaved
}
