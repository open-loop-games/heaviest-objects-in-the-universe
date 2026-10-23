// Scope navigation — thin wrapper around the engine ScopeStack.
//
// HOITU-specific contract: each populated child graph contains a *shadow*
// node carrying the scope owner's id and Package data reference, so that
// wires from the owner to first-level deps can live as edges within the
// child graph (Graph requires both endpoints in the same graph).
// Iteration helpers strip the shadow when returning user-facing collections.

import type { Package, Wire } from './types'
import { graph, rootIdRef, stack } from './state'
import { emit } from './events'
import type { Graph } from '@open-loop/engine'

// ============================================
// SCOPE DEPTH HELPERS
// ============================================

export function getScopeDepth(): number {
  return stack.depth
}

export function isAtRoot(): boolean {
  return stack.depth === 0
}

export function isAtLayer1(): boolean {
  return stack.depth === 1
}

export function isAtLayer2(): boolean {
  return stack.depth === 2
}

// ============================================
// PACKAGE / GRAPH UTILITIES
// ============================================

/** True for the root package.json node. */
export function isRootPackage(pkgId: string): boolean {
  return rootIdRef.value !== null && pkgId === rootIdRef.value
}

/** True for top-level packages: nodes in the root graph other than rootId. */
export function isTopLevelPackage(pkgId: string): boolean {
  if (rootIdRef.value === null) return false
  if (pkgId === rootIdRef.value) return false
  return graph.getNode(pkgId) !== undefined
}

/** Resolve the Graph at a path (root for empty path), or null. */
export function getGraphAtPath(
  path: readonly string[]
): Graph<Package, Wire> | null {
  let g: Graph<Package, Wire> = graph
  for (const id of path) {
    const child = g.getChildGraph(id)
    if (!child) return null
    g = child
  }
  return g
}

/** Build a Map<id, Package> from a graph's nodes, optionally excluding the
 *  shadow scope-owner node when iterating a child graph. */
function nodesAsPackageMap(
  g: Graph<Package, Wire>,
  excludeId?: string
): Map<string, Package> {
  const result = new Map<string, Package>()
  for (const [id, node] of g.nodes) {
    if (excludeId !== undefined && id === excludeId) continue
    result.set(id, node.data)
  }
  return result
}

/** Build a Map<id, Wire> from a graph's edges. */
function edgesAsWireMap(g: Graph<Package, Wire>): Map<string, Wire> {
  const result = new Map<string, Wire>()
  for (const [id, edge] of g.edges) {
    result.set(id, edge.data)
  }
  return result
}

// ============================================
// SCOPE PRIMITIVES (event-emitting wrappers)
// ============================================

/** Enter a top-level package's scope (must be at root). Returns false if
 *  the target isn't a top-level package or has no child graph. */
export function enterScope(packageId: string): boolean {
  if (!isAtRoot()) return false
  if (!isTopLevelPackage(packageId)) return false
  if (!graph.getChildGraph(packageId)) return false
  stack.enter(packageId)
  return true
}

/** Enter a deeper scope from inside a package scope. */
export function enterInternalScope(internalPkgId: string): boolean {
  if (stack.depth === 0) return false
  return enterScopeAtPath(internalPkgId)
}

/** Exit current scope (one level up). No-op at root. */
export function exitScope(): void {
  stack.exit()
}

/** Exit all the way to root. */
export function exitToRoot(): void {
  stack.exitToRoot()
}

// ============================================
// SCOPE ACCESSORS
// ============================================

export function getCurrentScopePackages(): Map<string, Package> {
  if (stack.depth === 0) {
    return nodesAsPackageMap(graph)
  }
  const ownerId = stack.path[stack.path.length - 1]
  return nodesAsPackageMap(stack.current, ownerId)
}

export function getScopePackageCount(): number {
  return getCurrentScopePackages().size
}

export function getCurrentScopeWires(): Map<string, Wire> {
  return edgesAsWireMap(stack.current)
}

/** The package at the head of the scope stack (or root at depth 0). */
export function getCurrentScopeRoot(): Package | null {
  if (isAtRoot()) {
    if (rootIdRef.value === null) return null
    return graph.getNode(rootIdRef.value)?.data ?? null
  }
  return getPackageAtPath(stack.path)
}

/** The package one scope level up (or null at root or layer 1). */
export function getParentScopePackage(): Package | null {
  if (stack.depth < 2) return null
  return getPackageAtPath(stack.path.slice(0, -1))
}

// ============================================
// SCOPE QUERIES
// ============================================

export function isInPackageScope(): boolean {
  return stack.depth > 0
}

/** Returns 'root' or the innermost scope's package id. */
export function getCurrentScope(): string {
  return stack.currentNodeId ?? 'root'
}

export function getScopeStack(): readonly string[] {
  return stack.path
}

export function isCurrentScopeRoot(packageId: string): boolean {
  if (isAtRoot()) return isRootPackage(packageId)
  return packageId === stack.currentNodeId
}

/** True if the package owns a child graph (i.e., can be entered).
 *  Checks the root graph first, then the currently-viewed scope graph so
 *  compressed inner deps (which live as nodes in `stack.current`, not in
 *  root) are detected correctly. */
export function isPackageCompressed(pkg: Package): boolean {
  if (graph.getChildGraph(pkg.id) !== null) return true
  if (stack.depth > 0 && stack.current.getChildGraph(pkg.id) !== null) {
    return true
  }
  return false
}

export function getLayer1PackageId(): string | null {
  return stack.path[0] ?? null
}

export function getLayer2PackageId(): string | null {
  return stack.path[1] ?? null
}

// ============================================
// PATH-BASED ACCESSORS (arbitrary depth)
// ============================================

/** Resolve a package by walking the scope-graph hierarchy.
 *  Path [topLevelId] returns the top-level package; deeper paths walk into
 *  child graphs and return the matching node's data, or null on miss. */
export function getPackageAtPath(path: readonly string[]): Package | null {
  if (path.length === 0) return null
  const topId = path[0]
  if (!topId) return null
  let current = graph.getNode(topId)?.data ?? null
  if (!current) return null
  let parentGraph: Graph<Package, Wire> = graph
  for (let i = 1; i < path.length; i++) {
    const child = parentGraph.getChildGraph(path[i - 1]!)
    if (!child) return null
    const nextId = path[i]!
    const node = child.getNode(nextId)
    if (!node) return null
    current = node.data
    parentGraph = child
  }
  return current
}

/** Get packages at a given scope path (root for empty path). */
export function getPackagesAtPath(
  path: readonly string[]
): Map<string, Package> {
  const g = getGraphAtPath(path)
  if (!g) return new Map()
  if (path.length === 0) {
    return nodesAsPackageMap(g)
  }
  const ownerId = path[path.length - 1]
  return nodesAsPackageMap(g, ownerId)
}

/** Get wires at a given scope path. */
export function getWiresAtPath(path: readonly string[]): Map<string, Wire> {
  const g = getGraphAtPath(path)
  if (!g) return new Map()
  return edgesAsWireMap(g)
}

/** Enter a scope by package id at any depth. */
export function enterScopeAtPath(packageId: string): boolean {
  if (stack.depth === 0) {
    if (!isTopLevelPackage(packageId)) return false
    if (!graph.getChildGraph(packageId)) return false
    stack.enter(packageId)
    return true
  }
  if (!stack.current.getNode(packageId)) return false
  if (!stack.current.getChildGraph(packageId)) return false
  stack.enter(packageId)
  return true
}

// ============================================
// SCOPE OPERATIONS (enter/exit with cascade integration)
// ============================================

// Lazy import to avoid circular dependency with cascade
let _startCascade: ((scopePath: string[]) => void) | null = null

export function _injectCascade(
  startCascade: (scopePath: string[]) => void
): void {
  _startCascade = startCascade
}

/** Enter a package's scope. If the scope is pristine (never cascaded into),
 *  triggers the staggered cascade. */
export function enterPackageScope(packageId: string): boolean {
  emit('player:action')

  if (stack.depth === 0) {
    if (!isTopLevelPackage(packageId)) return false
    if (!graph.getChildGraph(packageId)) return false
    stack.enter(packageId)
  } else {
    if (!enterScopeAtPath(packageId)) return false
  }

  if (!gameStateOnboardingFirstDive()) {
    setOnboardingFirstDiveSeen()
  }

  // Pristine check via the stack's cached state (recalculate on demand).
  stack.recalculateAt(stack.path)
  if (stack.statusAt(stack.path) === 'pristine') {
    _startCascade?.([...stack.path])
  }
  return true
}

/** Exit the current scope, recalculating its state on the way out. */
export function exitPackageScope(): void {
  emit('player:action')
  if (stack.depth > 0) {
    stack.recalculateAt(stack.path)
    if (
      stack.statusAt(stack.path) === 'stable' &&
      !gameStateOnboardingFirstScopeExited()
    ) {
      setOnboardingFirstScopeExitedSeen()
    }
  }
  stack.exit()
}

/** Trigger a recalculate at the given path (and let it bubble up). Emits a
 *  'scope:stabilized' event when a scope transitions from non-stable to
 *  stable (mutations.ts turns it into the stabilize feedback event). */
export function recalculateStateAtPath(scopePath: readonly string[]): void {
  if (scopePath.length === 0) return
  const before = stack.statusAt(scopePath)
  stack.recalculateAt(scopePath)
  const after = stack.statusAt(scopePath)
  if (before !== 'stable' && after === 'stable') {
    const g = getGraphAtPath(scopePath)
    const ownerId = scopePath[scopePath.length - 1]
    let count = 0
    if (g) {
      for (const id of g.nodes.keys()) {
        if (id !== ownerId) count++
      }
    }
    emit('scope:stabilized', { packageCount: count })
  }
}

/** Read the cached scope state, or null when never recalculated. */
export function getScopeState(
  path: readonly string[]
): 'pristine' | 'unstable' | 'stable' | null {
  const s = stack.statusAt(path)
  if (s === undefined) return null
  if (s === 'pristine' || s === 'unstable' || s === 'stable') return s
  return null
}

// ============================================
// LAZY ONBOARDING ACCESS (avoids circular import with state's reactive)
// ============================================
import { gameState } from './state'
function gameStateOnboardingFirstDive(): boolean {
  return gameState.onboarding.firstDiveSeen
}
function setOnboardingFirstDiveSeen(): void {
  gameState.onboarding.firstDiveSeen = true
}
function gameStateOnboardingFirstScopeExited(): boolean {
  return gameState.onboarding.firstScopeExited
}
function setOnboardingFirstScopeExitedSeen(): void {
  gameState.onboarding.firstScopeExited = true
}
