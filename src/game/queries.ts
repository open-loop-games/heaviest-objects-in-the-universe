// Package query functions - scope-aware where applicable

import { gameState } from './state';
import { getCurrentScopePackages, isInPackageScope } from './scope';
import type { Package, Position } from './types';

/**
 * Get all packages in the current scope
 * SCOPE-AWARE: Returns outer packages at root, internal packages when inside a package
 */
export function getAllPackages(): Package[] {
  return Array.from(getCurrentScopePackages().values());
}

/**
 * Get all packages in the outer (root) scope regardless of current scope
 */
export function getAllOuterPackages(): Package[] {
  return Array.from(gameState.packages.values());
}

/**
 * Get packages at a specific depth in the current scope
 * SCOPE-AWARE
 */
export function getPackagesAtDepth(depth: number): Package[] {
  return getAllPackages().filter(p => p.depth === depth);
}

/**
 * Find package at screen position (for click detection)
 * SCOPE-AWARE: Searches current scope's packages
 */
export function findPackageAtPosition(pos: Position, radius: number = 30): Package | null {
  // When in package scope, also check the scope root (rendered at 0,0)
  if (isInPackageScope()) {
    const scopeRoot = gameState.packages.get(gameState.currentScope);
    if (scopeRoot) {
      // Scope root is rendered at (0,0)
      const dx = 0 - pos.x;
      const dy = 0 - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius) {
        return scopeRoot;
      }

      // Search internal packages
      if (scopeRoot.internalPackages) {
        for (const pkg of scopeRoot.internalPackages.values()) {
          const dx = pkg.position.x - pos.x;
          const dy = pkg.position.y - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= radius) {
            return pkg;
          }
        }
      }
    }
    return null;
  }

  // Root scope: search main packages
  for (const pkg of gameState.packages.values()) {
    const dx = pkg.position.x - pos.x;
    const dy = pkg.position.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= radius) {
      return pkg;
    }
  }
  return null;
}

/**
 * Get conflict and duplicate counts for a package's internal tree
 */
export function getInternalStats(packageId: string): { conflicts: number; duplicates: number } {
  const pkg = gameState.packages.get(packageId);
  if (!pkg || !pkg.internalPackages || !pkg.internalWires) {
    return { conflicts: 0, duplicates: 0 };
  }

  let conflicts = 0;
  for (const wire of pkg.internalWires.values()) {
    if (wire.conflicted) conflicts++;
  }

  const identityCounts = new Map<string, number>();
  for (const innerPkg of pkg.internalPackages.values()) {
    if (innerPkg.identity && !innerPkg.isGhost) {
      const name = innerPkg.identity.name;
      identityCounts.set(name, (identityCounts.get(name) || 0) + 1);
    }
  }
  let duplicates = 0;
  for (const count of identityCounts.values()) {
    if (count > 1) duplicates += count - 1;
  }

  return { conflicts, duplicates };
}

/**
 * Get stats for the current scope
 * SCOPE-AWARE: Returns internal stats when inside a package, outer stats at root
 */
export function getCurrentScopeStats(): { conflicts: number; duplicates: number; packageCount: number } {
  if (isInPackageScope()) {
    const stats = getInternalStats(gameState.currentScope);
    const scopePkg = gameState.packages.get(gameState.currentScope);
    return {
      ...stats,
      packageCount: scopePkg?.internalPackages?.size || 0,
    };
  }

  // Root scope stats
  let conflicts = 0;
  for (const wire of gameState.wires.values()) {
    if (wire.conflicted) conflicts++;
  }

  const identityCounts = new Map<string, number>();
  for (const pkg of gameState.packages.values()) {
    if (pkg.identity && !pkg.isGhost && pkg.id !== gameState.rootId) {
      const name = pkg.identity.name;
      identityCounts.set(name, (identityCounts.get(name) || 0) + 1);
    }
  }
  let duplicates = 0;
  for (const count of identityCounts.values()) {
    if (count > 1) duplicates += count - 1;
  }

  return {
    conflicts,
    duplicates,
    packageCount: gameState.packages.size,
  };
}

/**
 * Check if a package is a top-level package (direct child of root)
 */
export function isTopLevelPackage(packageId: string): boolean {
  const pkg = gameState.packages.get(packageId);
  return pkg?.parentId === gameState.rootId;
}

/**
 * Get all top-level packages (direct children of root)
 */
export function getTopLevelPackages(): Package[] {
  return Array.from(gameState.packages.values()).filter(
    p => p.parentId === gameState.rootId
  );
}
