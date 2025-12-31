// Package query functions - scope-aware where applicable

import { gameState } from './state'
import {
  getCurrentScopePackages,
  getCurrentScopeRoot,
  isInPackageScope,
} from './scope'
import type { Package, Position } from './types'
import { getNodeRadius } from '../rendering/nodes'

/**
 * Check if position hits any badge on a package
 * Badges: drill-down (bottom), cache fragment (left)
 */
function hitsBadge(
  pos: Position,
  pkgX: number,
  pkgY: number,
  pkg: Package
): boolean {
  const nodeRadius = getNodeRadius(pkg)
  const badgeRadius = 10 // Slightly generous for easier clicking

  // Drill-down badge (bottom) - for packages with internal scope
  if (pkg.internalPackages !== null) {
    const badgeY = pkgY + nodeRadius + 6
    const dx = pkgX - pos.x
    const dy = badgeY - pos.y
    if (Math.sqrt(dx * dx + dy * dy) <= badgeRadius) {
      return true
    }
  }

  // Cache fragment badge (left)
  if (pkg.hasCacheFragment) {
    const badgeX = pkgX - nodeRadius - 6
    const dx = badgeX - pos.x
    const dy = pkgY - pos.y
    if (Math.sqrt(dx * dx + dy * dy) <= badgeRadius) {
      return true
    }
  }

  return false
}

/**
 * Find package at screen position (for click detection)
 * SCOPE-AWARE: Searches current scope's packages (works at any depth)
 */
export function findPackageAtPosition(
  pos: Position,
  radius: number = 30
): Package | null {
  // When in package scope, check the scope root (rendered at 0,0) and its internal packages
  if (isInPackageScope()) {
    const scopeRoot = getCurrentScopeRoot()
    if (scopeRoot) {
      // Scope root is rendered at (0,0)
      const dx = 0 - pos.x
      const dy = 0 - pos.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= radius || hitsBadge(pos, 0, 0, scopeRoot)) {
        return scopeRoot
      }
    }

    // Search internal packages in current scope
    const scopePackages = getCurrentScopePackages()
    for (const pkg of scopePackages.values()) {
      const dx = pkg.position.x - pos.x
      const dy = pkg.position.y - pos.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (
        dist <= radius ||
        hitsBadge(pos, pkg.position.x, pkg.position.y, pkg)
      ) {
        return pkg
      }
    }
    return null
  }

  // Root scope: search main packages
  for (const pkg of gameState.packages.values()) {
    const dx = pkg.position.x - pos.x
    const dy = pkg.position.y - pos.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist <= radius || hitsBadge(pos, pkg.position.x, pkg.position.y, pkg)) {
      return pkg
    }
  }
  return null
}

/**
 * Get conflict and duplicate counts for a package's internal tree
 */
export function getInternalStats(packageId: string): {
  conflicts: number
  duplicates: number
} {
  const pkg = gameState.packages.get(packageId)
  if (!pkg || !pkg.internalPackages || !pkg.internalWires) {
    return { conflicts: 0, duplicates: 0 }
  }

  let conflicts = 0
  for (const wire of pkg.internalWires.values()) {
    if (wire.conflicted) conflicts++
  }

  const identityCounts = new Map<string, number>()
  for (const innerPkg of pkg.internalPackages.values()) {
    if (innerPkg.identity && !innerPkg.isGhost) {
      const name = innerPkg.identity.name
      identityCounts.set(name, (identityCounts.get(name) || 0) + 1)
    }
  }
  let duplicates = 0
  for (const count of identityCounts.values()) {
    if (count > 1) duplicates += count - 1
  }

  return { conflicts, duplicates }
}
