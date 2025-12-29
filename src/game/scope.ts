// Scope navigation - entering/exiting package internal views

import type { Package, Wire } from './types';
import { gameState } from './state';

// ============================================
// SCOPE PRIMITIVES
// ============================================

/**
 * Enter a package's internal scope (low-level)
 * Only top-level packages (direct children of root) can be entered
 *
 * Note: Use enterPackageScope() from packages.ts for full behavior
 * (spawns internal deps if pristine)
 */
export function enterScope(packageId: string): boolean {
  const pkg = gameState.packages.get(packageId);
  if (!pkg) return false;

  // Only enter top-level packages (direct children of root)
  if (pkg.parentId !== gameState.rootId) return false;

  // Can't enter if already in a scope
  if (gameState.currentScope !== 'root') return false;

  gameState.currentScope = packageId;
  return true;
}

/**
 * Exit current scope back to root (low-level)
 *
 * Note: Use exitPackageScope() from packages.ts for full behavior
 * (recalculates internal state before exiting)
 */
export function exitScope(): void {
  gameState.currentScope = 'root';
}

// ============================================
// SCOPE ACCESSORS
// ============================================

/**
 * Get packages for the current scope
 * Returns outer packages if at root, or internal packages if inside a package
 */
export function getCurrentScopePackages(): Map<string, Package> {
  if (gameState.currentScope === 'root') {
    return gameState.packages;
  }
  const scopePkg = gameState.packages.get(gameState.currentScope);
  return scopePkg?.internalPackages || new Map();
}

/**
 * Get wires for the current scope
 */
export function getCurrentScopeWires(): Map<string, Wire> {
  if (gameState.currentScope === 'root') {
    return gameState.wires;
  }
  const scopePkg = gameState.packages.get(gameState.currentScope);
  return scopePkg?.internalWires || new Map();
}

/**
 * Get the local root package for current scope
 * At root scope: returns the actual root (package.json)
 * In package scope: returns the entered package
 */
export function getCurrentScopeRoot(): Package | null {
  if (gameState.currentScope === 'root') {
    return gameState.rootId ? gameState.packages.get(gameState.rootId) || null : null;
  }
  return gameState.packages.get(gameState.currentScope) || null;
}

// ============================================
// SCOPE QUERIES
// ============================================

/**
 * Check if we're currently inside a package scope
 */
export function isInPackageScope(): boolean {
  return gameState.currentScope !== 'root';
}

/**
 * Get the current scope ID
 * Returns 'root' or a package ID
 */
export function getCurrentScope(): string {
  return gameState.currentScope;
}

/**
 * Check if a package is the current scope's root
 */
export function isCurrentScopeRoot(packageId: string): boolean {
  if (gameState.currentScope === 'root') {
    return packageId === gameState.rootId;
  }
  return packageId === gameState.currentScope;
}
