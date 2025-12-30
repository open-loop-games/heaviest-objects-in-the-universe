// Scope navigation - entering/exiting package internal views
// Supports 2 layers: root → layer 1 (top-level pkg) → layer 2 (compressed internal dep)

import type { Package, Wire } from './types'
import { gameState } from './state'

// ============================================
// SCOPE DEPTH HELPERS
// ============================================

/**
 * Get current scope depth
 * 0 = root, 1 = inside top-level package, 2 = inside compressed internal dep
 */
export function getScopeDepth(): number {
  return gameState.scopeStack.length
}

/**
 * Check if we're at root scope
 */
export function isAtRoot(): boolean {
  return gameState.scopeStack.length === 0
}

/**
 * Check if we're at layer 1 (inside a top-level package)
 */
export function isAtLayer1(): boolean {
  return gameState.scopeStack.length === 1
}

/**
 * Check if we're at layer 2 (inside a compressed internal dep)
 */
export function isAtLayer2(): boolean {
  return gameState.scopeStack.length === 2
}

// ============================================
// SCOPE PRIMITIVES
// ============================================

/**
 * Enter a top-level package's internal scope (layer 1)
 * Only works from root scope
 */
export function enterScope(packageId: string): boolean {
  const pkg = gameState.packages.get(packageId)
  if (!pkg) return false

  // Only enter top-level packages (direct children of root)
  if (pkg.parentId !== gameState.rootId) return false

  // Can only enter layer 1 from root
  if (!isAtRoot()) return false

  gameState.scopeStack.push(packageId)
  gameState.currentScope = packageId // Keep legacy field in sync
  return true
}

/**
 * Enter a compressed internal dep's scope (works at any depth)
 * Requires being inside a package scope already
 */
export function enterInternalScope(internalPkgId: string): boolean {
  // Must be inside a package scope to enter an internal package
  if (gameState.scopeStack.length === 0) return false

  // Use the generic path-based entry
  return enterScopeAtPath(internalPkgId)
}

/**
 * Exit current scope (go up one level)
 * Layer 2 → Layer 1, Layer 1 → Root
 */
export function exitScope(): void {
  if (gameState.scopeStack.length === 0) return

  gameState.scopeStack.pop()

  // Update legacy currentScope field
  if (gameState.scopeStack.length === 0) {
    gameState.currentScope = 'root'
  } else {
    gameState.currentScope =
      gameState.scopeStack[gameState.scopeStack.length - 1] ?? 'root'
  }
}

/**
 * Exit all the way to root
 */
export function exitToRoot(): void {
  gameState.scopeStack = []
  gameState.currentScope = 'root'
}

// ============================================
// SCOPE ACCESSORS
// ============================================

/**
 * Get packages for the current scope (works at any depth)
 */
export function getCurrentScopePackages(): Map<string, Package> {
  return getPackagesAtPath(gameState.scopeStack)
}

/**
 * Get wires for the current scope (works at any depth)
 */
export function getCurrentScopeWires(): Map<string, Wire> {
  return getWiresAtPath(gameState.scopeStack)
}

/**
 * Get the local root package for current scope (works at any depth)
 */
export function getCurrentScopeRoot(): Package | null {
  if (isAtRoot()) {
    return gameState.rootId
      ? gameState.packages.get(gameState.rootId) || null
      : null
  }
  return getPackageAtPath(gameState.scopeStack)
}

/**
 * Get the parent scope's package (works at any depth)
 * Returns the package one level up, or null if at root or layer 1
 */
export function getParentScopePackage(): Package | null {
  if (gameState.scopeStack.length < 2) return null
  return getPackageAtPath(gameState.scopeStack.slice(0, -1))
}

// ============================================
// SCOPE QUERIES
// ============================================

/**
 * Check if we're currently inside a package scope (layer 1 or 2)
 */
export function isInPackageScope(): boolean {
  return gameState.scopeStack.length > 0
}

/**
 * Get the current scope ID
 * Returns 'root' or a package ID
 */
export function getCurrentScope(): string {
  return gameState.currentScope
}

/**
 * Get the full scope stack
 */
export function getScopeStack(): readonly string[] {
  return gameState.scopeStack
}

/**
 * Check if a package is the current scope's root
 */
export function isCurrentScopeRoot(packageId: string): boolean {
  if (isAtRoot()) {
    return packageId === gameState.rootId
  }
  const currentId = gameState.scopeStack[gameState.scopeStack.length - 1]
  return packageId === currentId
}

/**
 * Check if a package is compressed (has internal scope) and can be entered
 */
export function isPackageCompressed(pkg: Package): boolean {
  return pkg.internalPackages !== null && pkg.internalWires !== null
}

/**
 * Get the layer 1 package ID (if in layer 1 or 2)
 */
export function getLayer1PackageId(): string | null {
  if (gameState.scopeStack.length >= 1) {
    return gameState.scopeStack[0] ?? null
  }
  return null
}

/**
 * Get the layer 2 package ID (if in layer 2)
 */
export function getLayer2PackageId(): string | null {
  if (gameState.scopeStack.length >= 2) {
    return gameState.scopeStack[1] ?? null
  }
  return null
}

// ============================================
// GENERIC PATH-BASED ACCESSORS (arbitrary depth)
// ============================================

/**
 * Get a package at an arbitrary path in the nested tree
 * Path is array of package IDs: [topLevelId, internalId, deeperId, ...]
 * Empty path returns null (root is not a package in this context)
 */
export function getPackageAtPath(path: string[]): Package | null {
  if (path.length === 0) return null

  // First element is always a top-level package
  const topLevelId = path[0]
  if (!topLevelId) return null

  let current: Package | undefined = gameState.packages.get(topLevelId)
  if (!current) return null

  // Traverse deeper into internal packages
  for (let i = 1; i < path.length; i++) {
    const nextId = path[i]
    if (!nextId || !current.internalPackages) return null
    current = current.internalPackages.get(nextId)
    if (!current) return null
  }

  return current
}

/**
 * Get the internal packages map at a given path
 * Empty path returns root-level packages
 */
export function getPackagesAtPath(path: string[]): Map<string, Package> {
  if (path.length === 0) {
    return gameState.packages
  }

  const pkg = getPackageAtPath(path)
  return pkg?.internalPackages || new Map()
}

/**
 * Get the internal wires map at a given path
 * Empty path returns root-level wires
 */
export function getWiresAtPath(path: string[]): Map<string, Wire> {
  if (path.length === 0) {
    return gameState.wires
  }

  const pkg = getPackageAtPath(path)
  return pkg?.internalWires || new Map()
}

/**
 * Enter a package scope at any depth
 * Returns true if successful
 */
export function enterScopeAtPath(packageId: string): boolean {
  // If at root, entering means the package must be a top-level package
  if (gameState.scopeStack.length === 0) {
    const pkg = gameState.packages.get(packageId)
    if (!pkg || pkg.parentId !== gameState.rootId) return false
    if (!pkg.internalPackages || !pkg.internalWires) return false

    gameState.scopeStack.push(packageId)
    gameState.currentScope = packageId
    return true
  }

  // Otherwise, we're entering a deeper scope
  const currentPkg = getPackageAtPath(gameState.scopeStack)
  if (!currentPkg?.internalPackages) return false

  const targetPkg = currentPkg.internalPackages.get(packageId)
  if (!targetPkg) return false

  // Can only enter compressed packages (those with internal maps)
  if (!targetPkg.internalPackages || !targetPkg.internalWires) return false

  gameState.scopeStack.push(packageId)
  gameState.currentScope = packageId
  return true
}
