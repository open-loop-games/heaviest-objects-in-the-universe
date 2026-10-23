// State mutation helpers — graph + scope aware

import { COMBO_MAX, FRAGMENT_WEIGHT } from './config'
import {
  EFFICIENCY_BASE,
  EFFICIENCY_SCALE_ANCHOR,
  countScopeDuplicates,
} from './formulas'
import { gameState, generateWireId, graph, rootIdRef, stack } from './state'
import type { Package, Wire } from './types'
import type { Graph } from '@open-loop/engine'
import {
  getCurrentScopePackages,
  getCurrentScopeWires,
  getGraphAtPath,
  isInPackageScope,
} from './scope'
import { emit, on } from './events'
import { getEfficiencyTierRank, updateEfficiencyTracking } from './formulas'
import { checkAchievements } from './achievements'
import { GAME_SPINE, comboWindow } from './spine'
import { boardWeightScale } from './board'

// Quality event types are now in the main event bus (src/game/events.ts)
// Use emit('quality:efficiency-improved', ...) etc.

// ============================================
// SCOPE WALKING (graph-aware)
// ============================================

/** Every entered scope, root's children first, with its graph and owner id. */
export function* iterateEnteredScopes(): Generator<{
  path: string[]
  graph: Graph<Package, Wire>
  ownerId: string
}> {
  function* walk(
    parent: Graph<Package, Wire>,
    parentPath: string[]
  ): Generator<{
    path: string[]
    graph: Graph<Package, Wire>
    ownerId: string
  }> {
    for (const [nodeId] of parent.nodes) {
      // Skip the shadow scope-owner inside a child graph.
      if (
        parentPath.length > 0 &&
        nodeId === parentPath[parentPath.length - 1]
      ) {
        continue
      }
      const child = parent.getChildGraph(nodeId)
      if (!child) continue
      const path = [...parentPath, nodeId]
      // Populated child graphs have shadow + at least one inner dep.
      if (child.nodes.size > 1) {
        yield { path, graph: child, ownerId: nodeId }
      }
      yield* walk(child, path)
    }
  }
  yield* walk(graph, [])
}

/** Duplicates and conflicted wires still open across the entered scopes, and their packages. */
function countOpenProblems(): { open: number; packages: number } {
  let open = 0
  let packages = 0

  for (const { graph: scopeGraph, ownerId } of iterateEnteredScopes()) {
    const { duplicates, total } = countScopeDuplicates(scopeGraph, ownerId)
    open += duplicates
    packages += total

    for (const edge of scopeGraph.edges.values()) {
      if (edge.data.conflicted) open++
    }
  }
  return { open, packages }
}

export function calculateEfficiency(): number {
  const { open, packages } = countOpenProblems()
  if (packages === 0) return 1

  const scale = Math.log10(packages + 10) / Math.log10(EFFICIENCY_SCALE_ANCHOR)
  const efficiency = Math.pow(EFFICIENCY_BASE, open / scale)

  return Math.max(0, Math.min(1, efficiency))
}

/**
 * q for the ship reward: problems resolved this run over those resolved plus those still
 * open. A problem a prune deletes unresolved leaves both counts.
 */
export function updateResolvedShare(): void {
  const { runResolved } = gameState.run
  const { open } = countOpenProblems()
  gameState.run.resolvedShare =
    runResolved + open === 0 ? 1 : runResolved / (runResolved + open)
}

/** Count problems resolved this run, by the player or by auto-resolve. */
export function countResolved(count: number = 1): void {
  gameState.run.runResolved += count
}

export function calculateStabilityRatio(): number {
  let entered = 0
  let stable = 0
  for (const { path } of iterateEnteredScopes()) {
    entered++
    if (stack.statusAt(path) === 'stable') stable++
  }
  if (entered === 0) return 1
  return stable / entered
}

// ============================================
// EFFICIENCY TRACKING (for tier-up detection)
// ============================================

function checkEfficiencyChange(newEfficiency: number): void {
  const { tierChanged, oldTier, newTier, delta } =
    updateEfficiencyTracking(newEfficiency)

  const oldRank = getEfficiencyTierRank(oldTier)
  const newRank = getEfficiencyTierRank(newTier)

  if (tierChanged && newRank > oldRank) {
    emit('quality:efficiency-tier-up', { oldTier, newTier })
  }

  if (delta > 0.01) {
    emit('quality:efficiency-improved', {
      delta,
      newValue: newEfficiency,
      newTier,
    })
  }
}

// ============================================
// COMBO SYSTEM
// ============================================

/** The combo decay window, from the spine's solved base window. */
export function comboWindowMs(): number {
  return comboWindow(GAME_SPINE, gameState.upgrades.comboWindow) * 1000
}

/**
 * One player act. It records the counter it found (0 once the window has lapsed, even
 * before the loop decays it) for the run's mean combo depth, then builds the chain.
 */
export function incrementCombo(): void {
  const run = gameState.run
  const lapsed = Date.now() - run.comboLastActionTime >= comboWindowMs()
  run.runComboSum += lapsed ? 0 : run.comboCount
  run.runActs++

  gameState.run.comboCount = Math.min(gameState.run.comboCount + 1, COMBO_MAX)
  gameState.run.comboLastActionTime = Date.now()

  if (
    gameState.run.comboCount >= 5 &&
    !gameState.onboarding.firstHighComboSeen
  ) {
    gameState.onboarding.firstHighComboSeen = true
  }
}

// ============================================
// PLAYER ACTS
// ============================================

export function onConflictResolved(position?: { x: number; y: number }): void {
  incrementCombo()
  countResolved()
  emit('game:conflict-resolved', { position })
}

export function onSymlinkMerged(
  weightSaved: number,
  position: { x: number; y: number }
): void {
  incrementCombo()
  countResolved()
  emit('game:symlink-merged', { weightSaved, position })
}

function onScopeStabilized(packageCount: number): void {
  const scopeId = stack.path[stack.path.length - 1] ?? 'root'
  emit('game:scope-stabilized', { scopeId, packageCount })
}

// ============================================
// WEIGHT HELPERS
// ============================================

export function addWeight(weight: number): void {
  gameState.resources.weight += weight
  gameState.run.runGrossWeight += weight
  gameState.run.maxWeightReached = Math.max(
    gameState.run.maxWeightReached,
    gameState.resources.weight
  )
}

// ============================================
// PACKAGE / WIRE MUTATIONS (graph-aware)
// ============================================

/**
 * Add a top-level package to the root graph. The wire from rootId to this
 * package is created automatically. The package's child graph is created
 * empty with a shadow node so cascade can wire owner→deps inside.
 */
export function addTopLevelPackage(pkg: Package, rootId: string): void {
  graph.addNode(pkg, { id: pkg.id })
  const wireId = generateWireId()
  graph.addEdge(rootId, pkg.id, makeDependencyWire(wireId, rootId, pkg.id), {
    id: wireId,
  })
  // Top-level packages always have an internal scope (compressed seed).
  ensureChildGraphWithShadow(graph, pkg)
  // Seed the scope-state cache so the renderer can read 'pristine' for the
  // portal ring + drill-down badge before the player first dives in.
  stack.recalculateAt([pkg.id])
  addWeight(pkg.size)
  gameState.stats.totalPackagesInstalled++
}

/**
 * Add the root (package.json) node to the root graph. No wire (it's the
 * root) and no child graph.
 */
export function addRootPackage(pkg: Package): void {
  graph.addNode(pkg, { id: pkg.id })
  addWeight(pkg.size)
  gameState.stats.totalPackagesInstalled++
}

/**
 * Attach a node + parent dep-edge to an existing scope graph and, if the
 * node is itself compressed, ensure its child graph + seed the scope-state
 * cache. Returns the wire id and the resolved scope graph.
 *
 * This is the canonical primitive for "put this package into that scope" —
 * the cascade routes through it so the seed-cache step can't be missed. Callers handle their own weight bookkeeping, stats, and
 * any package-state mutation downstream of attachment.
 */
export function attachNodeToScope(
  scopePath: readonly string[],
  pkg: Package,
  parentInScopeId: string,
  isCompressed: boolean,
  conflicted: boolean
): { wireId: string; scopeGraph: Graph<Package, Wire> } {
  const scopeGraph = getGraphAtPath(scopePath)
  if (!scopeGraph) {
    throw new Error(
      `attachNodeToScope: scope path does not resolve: ${scopePath.join('/')}`
    )
  }
  scopeGraph.addNode(pkg, { id: pkg.id })
  const wireId = generateWireId()
  const wire = makeDependencyWire(wireId, parentInScopeId, pkg.id)
  if (conflicted) {
    wire.conflicted = true
    wire.conflictTime = Date.now()
  }
  scopeGraph.addEdge(parentInScopeId, pkg.id, wire, { id: wireId })
  if (isCompressed) {
    ensureChildGraphWithShadow(scopeGraph, pkg)
    stack.recalculateAt([...scopePath, pkg.id])
  }
  return { wireId, scopeGraph }
}

/** Create a child graph for `pkg` and add a shadow node mirroring its data. */
export function ensureChildGraphWithShadow(
  parent: Graph<Package, Wire>,
  pkg: Package
): Graph<Package, Wire> {
  let child = parent.getChildGraph(pkg.id)
  if (!child) child = parent.createChildGraph(pkg.id)
  if (!child.getNode(pkg.id)) {
    child.addNode(pkg, { id: pkg.id })
  }
  return child
}

function makeDependencyWire(id: string, fromId: string, toId: string): Wire {
  return {
    id,
    fromId,
    toId,
    wireType: 'dependency',
    flowProgress: 0,
    conflicted: false,
    conflictTime: 0,
  }
}

/** Remove a package from the root graph (top-level only). Cascades to
 *  attached wires and any child graph it owns. Caller is responsible for
 *  any weight adjustment beyond the node itself — typical use is to
 *  pre-compute the subtree weight and subtract before calling this. */
export function removeTopLevelPackage(id: string): void {
  if (id === rootIdRef.value) {
    console.error('Attempted to remove root package!')
    return
  }
  const node = graph.getNode(id)
  if (!node) return
  graph.removeNode(id)
}

/** Remove a package from a specific scope (and cascade to its descendants).
 *  Caller handles weight bookkeeping. */
export function removeInnerPackage(
  scopePath: readonly string[],
  id: string
): void {
  const g = getGraphAtPath(scopePath)
  if (!g) return
  if (!g.getNode(id)) return
  g.removeNode(id)
}

// ============================================
// RESOURCE MUTATIONS
// ============================================

export function updateEfficiency(): void {
  const newEfficiency = calculateEfficiency()
  gameState.run.currentEfficiency = newEfficiency
  checkEfficiencyChange(newEfficiency)
}

export function updateStability(): void {
  gameState.run.currentStability = calculateStabilityRatio()
}

export function resolveConflict(packageId: string): void {
  const packages = getCurrentScopePackages()
  const pkg = packages.get(packageId)

  if (pkg && pkg.state === 'conflict') {
    pkg.state = 'ready'
    pkg.conflictProgress = 0
    gameState.stats.totalConflictsResolved++
    checkAchievements()
  }
}

/**
 * Resolve a wire conflict in the current scope. Returns false if the wire
 * doesn't exist or isn't conflicted.
 */
export function resolveWireConflict(wireId: string): boolean {
  const wires = getCurrentScopeWires()
  const packages = getCurrentScopePackages()

  const wire = wires.get(wireId)
  if (!wire || !wire.conflicted) return false

  emit('player:action')
  onConflictResolved()

  wire.conflicted = false
  wire.conflictTime = 0

  const targetPkg = packages.get(wire.toId)
  if (targetPkg && targetPkg.state === 'conflict') {
    targetPkg.state = 'ready'
    targetPkg.conflictProgress = 0
    gameState.stats.totalConflictsResolved++
  }

  if (isInPackageScope() && !gameState.onboarding.firstInnerConflictSeen) {
    gameState.onboarding.firstInnerConflictSeen = true
  }

  checkAchievements()

  if (isInPackageScope()) {
    emit('scope:recalculate', { scopePath: [...stack.path] })
  }

  return true
}

// ============================================
// CACHE FRAGMENT COLLECTION
// ============================================

export function collectCacheFragment(packageId: string): boolean {
  const packages = getCurrentScopePackages()
  const pkg = packages.get(packageId)

  if (!pkg || !pkg.hasCacheFragment) {
    return false
  }

  pkg.hasCacheFragment = false
  addWeight(FRAGMENT_WEIGHT * boardWeightScale())
  gameState.resources.cacheFragments++
  gameState.stats.cacheFragmentsCollected++

  return true
}

// ============================================
// EVENT SUBSCRIPTIONS
// ============================================

on('scope:stabilized', ({ packageCount }) => {
  onScopeStabilized(packageCount)
})
