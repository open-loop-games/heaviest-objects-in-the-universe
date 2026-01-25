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
import { updateCrossPackageDuplicates } from './cross-package'
import { onSymlinkMerged } from './mutations'
import { emit } from './events'
import {
  HALO_COLORS,
  COMBO_MAX,
  COMBO_WEIGHT_RETENTION_MIN,
  COMBO_WEIGHT_RETENTION_MAX,
} from './config'
import { recordSymlink, checkAchievements } from './achievements'

export interface DuplicateGroup {
  identityName: string
  packageIds: string[]
  haloColor: number
  haloColorIndex: number
}

// Cache of duplicate groups (recalculated when dirty)
const duplicateGroups: Map<string, DuplicateGroup> = new Map()

// Dirty flag for duplicate group recalculation
let duplicateGroupsDirty = true
let lastScopeStackLength = -1

/**
 * Mark duplicate groups as needing recalculation.
 * Call this when packages are added, removed, or merged.
 */
export function markDuplicateGroupsDirty(): void {
  duplicateGroupsDirty = true
}

// ============================================
// COMBO WEIGHT RETENTION
// ============================================

/**
 * Calculate weight retention based on current combo level.
 * At combo 0: 50% of source weight is removed (retention = 0.5)
 * At combo 10: 0% of source weight is removed (retention = 1.0)
 */
function getComboWeightRetention(): number {
  const combo = gameState.stats.comboCount
  const t = combo / COMBO_MAX // 0 to 1
  // Interpolate: 0.5 at combo 0, 1.0 at combo 10
  return (
    COMBO_WEIGHT_RETENTION_MIN +
    t * (COMBO_WEIGHT_RETENTION_MAX - COMBO_WEIGHT_RETENTION_MIN)
  )
}

// ============================================
// DUPLICATE DETECTION (SCOPE-AWARE)
// ============================================

/**
 * Find all duplicate package groups (packages with same identity)
 * SCOPE-AWARE: Uses getCurrentScopePackages() so it works both at root and inside packages
 * Uses dirty flag to avoid recalculating every frame
 */
export function updateDuplicateGroups(): void {
  // Also invalidate on scope change
  const currentScopeLength = gameState.scopeStack.length
  if (currentScopeLength !== lastScopeStackLength) {
    duplicateGroupsDirty = true
    lastScopeStackLength = currentScopeLength
  }

  // Skip recalculation if not dirty
  if (!duplicateGroupsDirty) return
  duplicateGroupsDirty = false

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

  // Set firstSymlinkSeen when duplicates are first detected
  if (duplicateGroups.size > 0 && !gameState.onboarding.firstSymlinkSeen) {
    gameState.onboarding.firstSymlinkSeen = true
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
 * Check if we can afford to perform a symlink merge
 * Momentum loop: Always affordable (generates BW instead of costing)
 */
export function canAffordSymlinkMerge(): boolean {
  return true // Always affordable in momentum loop
}

/**
 * Get the cost to perform a symlink merge
 * Momentum loop: Free (generates BW instead)
 */
export function getSymlinkMergeCost(): number {
  return 0 // Free in momentum loop
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
 * Check if rewiring would create a duplicate wire
 * Used during symlink merge to avoid creating parallel wires
 */
function wouldCreateDuplicateWire(
  wireId: string,
  newFromId: string,
  newToId: string,
  allWires: Map<string, import('./types').Wire>
): boolean {
  return Array.from(allWires.values()).some(
    (w) => w.id !== wireId && w.fromId === newFromId && w.toId === newToId
  )
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
 * Momentum loop: Generates bandwidth instead of costing
 * Returns the weight saved from the merge (0 if failed)
 */
export function performSymlinkMerge(
  sourceId: string,
  targetId: string
): number {
  if (!canSymlink(sourceId, targetId)) return 0

  // Reset ghost hand hint timers on meaningful player action
  emit('player:action')

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

  // Calculate weight removal based on combo (higher combo = less weight removed)
  // At combo 0: 50% removed, at combo 10: 0% removed
  const retention = getComboWeightRetention()
  const weightRemoved = Math.floor(source.size * (1 - retention))
  const weightSaved = source.size - weightRemoved // For stats/particles
  const mergePosition = { x: source.position.x, y: source.position.y }

  // === MOMENTUM LOOP: Generate bandwidth for manual merge ===
  // Also emits 'game:symlink-merged' event for UI juice
  onSymlinkMerged(weightSaved, mergePosition)

  // Reduce global weight (combo affects how much is removed)
  gameState.resources.weight -= weightRemoved

  // If in scope, also reduce the scope package's size (works at any depth)
  if (inScope) {
    const scopePkg = getCurrentScopeRoot()
    if (scopePkg) {
      scopePkg.size -= weightRemoved
    }
  }

  // === HANDLE WIRES ===
  const wiresToDelete: string[] = []

  for (const [wireId, wire] of wires) {
    if (wire.toId === sourceId) {
      // Wire points TO source - redirect to target or delete if duplicate
      if (wire.fromId === targetId) {
        wiresToDelete.push(wireId) // Direct connection between source/target
      } else if (
        wouldCreateDuplicateWire(wireId, wire.fromId, targetId, wires)
      ) {
        wiresToDelete.push(wireId)
      } else {
        wire.toId = targetId
      }
    } else if (wire.fromId === sourceId) {
      // Wire points FROM source - redirect from target or delete if duplicate
      if (wire.toId === targetId) {
        wiresToDelete.push(wireId) // Direct connection between source/target
      } else if (wouldCreateDuplicateWire(wireId, targetId, wire.toId, wires)) {
        wiresToDelete.push(wireId)
      } else {
        wire.fromId = targetId
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
  // Collect IDs for physics relocation (at root scope)
  const relocatedIds: string[] = []
  for (const childId of source.children) {
    const child = packages.get(childId)
    if (child) {
      child.parentId = targetId
      if (!target.children.includes(childId)) {
        target.children.push(childId)
      }
      // At root scope, collect subtree for relocation
      if (!inScope) {
        collectSubtreeIds(childId, packages, relocatedIds)
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

  // === ACHIEVEMENT TRACKING ===
  recordSymlink()
  checkAchievements()

  // === POST-MERGE ACTIONS ===
  // Mark target and children for physics relocation via event
  if (!inScope) {
    relocatedIds.push(targetId)
    emit('physics:trigger-organize', { relocatedIds })
  }

  if (inScope) {
    // Merging duplicates in inner scope grants a guaranteed crit on next pop
    gameState.cascade.guaranteedCrits++

    // Emit event for scope state recalculation
    emit('scope:recalculate', { scopePath: [...gameState.scopeStack] })
  }

  // Mark duplicate groups as dirty and refresh immediately
  markDuplicateGroupsDirty()
  updateDuplicateGroups()
  updateCrossPackageDuplicates()

  // Also emit packages changed for any other listeners
  emit('packages:changed')

  return weightSaved
}

/**
 * Helper: Collect all package IDs in a subtree for physics relocation
 */
function collectSubtreeIds(
  pkgId: string,
  packages: Map<string, Package>,
  result: string[]
): void {
  result.push(pkgId)
  const pkg = packages.get(pkgId)
  if (pkg) {
    for (const childId of pkg.children) {
      collectSubtreeIds(childId, packages, result)
    }
  }
}
