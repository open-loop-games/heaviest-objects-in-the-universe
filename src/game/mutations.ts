// State mutation helpers — graph + scope aware

import {
  MOMENTUM_PACKAGE_RESOLVE,
  MOMENTUM_CONFLICT_RESOLVE,
  MOMENTUM_SYMLINK_MERGE,
  MOMENTUM_STABILIZE_BASE,
  MOMENTUM_STABILIZE_PER_PKG,
  MOMENTUM_GOLDEN_SPAWN,
  MOMENTUM_FRAGMENT_COLLECT,
  MOMENTUM_TIER_MULTIPLIERS,
  SAFETY_REGEN_BY_TIER,
  MOMENTUM_DAMPENING_WINDOW,
  MOMENTUM_DAMPENING_THRESHOLD,
  MOMENTUM_DAMPENING_FLOOR,
  COMBO_MAX,
} from './config'
import {
  EFFICIENCY_BASE,
  EFFICIENCY_SCALE_ANCHOR,
  countScopeDuplicates,
} from './formulas'
import { gameState, generateWireId, graph, rootIdRef, stack } from './state'
import { getEcosystemTier } from './formulas'
import type { Package, Wire } from './types'
import type { SpatialGraph } from '@open-loop/engine'
import {
  getCurrentScopePackages,
  getCurrentScopeWires,
  getGraphAtPath,
  isInPackageScope,
} from './scope'
import { emit, on } from './events'
import { getCompressionMultiplier, getStabilizationBonus } from './upgrades'
import { getEfficiencyTierRank, updateEfficiencyTracking } from './formulas'
import { checkAchievements } from './achievements'

// Quality event types are now in the main event bus (src/game/events.ts)
// Use emit('quality:efficiency-improved', ...) etc.

// ============================================
// SCOPE WALKING (graph-aware)
// ============================================

function* iterateEnteredScopes(): Generator<{
  path: string[]
  graph: SpatialGraph<Package, Wire>
  ownerId: string
}> {
  function* walk(
    parent: SpatialGraph<Package, Wire>,
    parentPath: string[]
  ): Generator<{
    path: string[]
    graph: SpatialGraph<Package, Wire>
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

export function calculateEfficiency(): number {
  let totalDuplicates = 0
  let totalConflicts = 0
  let totalPackages = 0

  for (const { graph: scopeGraph, ownerId } of iterateEnteredScopes()) {
    const { duplicates, total } = countScopeDuplicates(scopeGraph, ownerId)
    totalDuplicates += duplicates
    totalPackages += total

    for (const edge of scopeGraph.edges.values()) {
      if (edge.data.conflicted) totalConflicts++
    }
  }

  if (totalPackages === 0) return 1

  const scale =
    Math.log10(totalPackages + 10) / Math.log10(EFFICIENCY_SCALE_ANCHOR)
  const problems = totalDuplicates + totalConflicts
  const efficiency = Math.pow(EFFICIENCY_BASE, problems / scale)

  return Math.max(0, Math.min(1, efficiency))
}

export function calculateStabilityRatio(): number {
  let entered = 0
  let stable = 0
  for (const { path } of iterateEnteredScopes()) {
    entered++
    if (stack.stateAt(path) === 'stable') stable++
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

export function incrementCombo(): void {
  gameState.stats.comboCount = Math.min(
    gameState.stats.comboCount + 1,
    COMBO_MAX
  )
  gameState.stats.comboLastActionTime = Date.now()

  if (
    gameState.stats.comboCount >= 5 &&
    !gameState.onboarding.firstHighComboSeen
  ) {
    gameState.onboarding.firstHighComboSeen = true
  }
}

// ============================================
// MOMENTUM SYSTEM (Activity-driven BW generation)
// ============================================

interface GenerationEvent {
  amount: number
  timestamp: number
}

const recentGeneration: GenerationEvent[] = []

function cleanOldEvents(): void {
  const cutoff = Date.now() - MOMENTUM_DAMPENING_WINDOW
  while (recentGeneration[0] && recentGeneration[0].timestamp < cutoff) {
    recentGeneration.shift()
  }
}

function getRecentTotal(): number {
  cleanOldEvents()
  return recentGeneration.reduce((sum, e) => sum + e.amount, 0)
}

function getDampeningMultiplier(): number {
  const recentTotal = getRecentTotal()
  if (recentTotal <= MOMENTUM_DAMPENING_THRESHOLD) return 1.0
  const excess = recentTotal - MOMENTUM_DAMPENING_THRESHOLD
  return Math.max(
    MOMENTUM_DAMPENING_FLOOR,
    1 -
      (excess / (MOMENTUM_DAMPENING_THRESHOLD * 2)) *
        (1 - MOMENTUM_DAMPENING_FLOOR)
  )
}

function recordGeneration(amount: number): void {
  recentGeneration.push({ amount, timestamp: Date.now() })
}

/** Clear momentum dampening history. Call on ship / prestige / load so a
 *  fresh run isn't immediately throttled by the previous run's events. */
export function resetMomentumState(): void {
  recentGeneration.length = 0
}

function getMomentumTierMultiplier(): number {
  const tier = getEcosystemTier(gameState.meta.cacheTokens)
  return MOMENTUM_TIER_MULTIPLIERS[tier] ?? 1.0
}

function generateBandwidth(
  baseAmount: number,
  applyTierScaling: boolean = true
): number {
  const tierMult = applyTierScaling ? getMomentumTierMultiplier() : 1.0
  const dampeningMult = getDampeningMultiplier()
  const actualAmount = Math.floor(baseAmount * tierMult * dampeningMult)

  if (actualAmount > 0) {
    gameState.resources.bandwidth = Math.min(
      gameState.resources.maxBandwidth,
      gameState.resources.bandwidth + actualAmount
    )
    recordGeneration(actualAmount)
  }
  return actualAmount
}

export function onPackageResolved(): number {
  const amount = generateBandwidth(MOMENTUM_PACKAGE_RESOLVE)
  emit('game:package-resolved', { amount })
  return amount
}

export function onConflictResolved(position?: {
  x: number
  y: number
}): number {
  incrementCombo()
  const amount = generateBandwidth(MOMENTUM_CONFLICT_RESOLVE)
  emit('game:conflict-resolved', { amount, position })
  return amount
}

export function onSymlinkMerged(
  weightSaved: number,
  position: { x: number; y: number }
): number {
  incrementCombo()
  const amount = generateBandwidth(MOMENTUM_SYMLINK_MERGE)
  emit('game:symlink-merged', { amount, weightSaved, position })
  return amount
}

export function onScopeStabilized(packageCount: number): number {
  const baseAmount =
    MOMENTUM_STABILIZE_BASE + packageCount * MOMENTUM_STABILIZE_PER_PKG
  const upgradeBonus = getStabilizationBonus()

  const scopeId = stack.path[stack.path.length - 1] ?? 'root'

  const amount = generateBandwidth(Math.floor(baseAmount * upgradeBonus))
  emit('game:scope-stabilized', { amount, scopeId, packageCount })

  return amount
}

export function onGoldenSpawned(): number {
  const amount = generateBandwidth(MOMENTUM_GOLDEN_SPAWN, false)
  emit('game:golden-spawned', { amount })
  return amount
}

export function onFragmentCollected(): number {
  const amount = generateBandwidth(MOMENTUM_FRAGMENT_COLLECT, false)
  emit('game:fragment-collected', { amount })
  return amount
}

export function getSafetyRegenRate(): number {
  const tier = getEcosystemTier(gameState.meta.cacheTokens)
  return SAFETY_REGEN_BY_TIER[tier] ?? 2
}

export function applySafetyRegen(deltaTime: number): void {
  const regenRate = getSafetyRegenRate()
  gameState.resources.bandwidth = Math.min(
    gameState.resources.maxBandwidth,
    gameState.resources.bandwidth + regenRate * deltaTime
  )
}

// ============================================
// WEIGHT HELPERS
// ============================================

export function addWeight(baseWeight: number): number {
  const finalWeight = baseWeight * getCompressionMultiplier()
  gameState.resources.weight += finalWeight
  gameState.stats.maxWeightReached = Math.max(
    gameState.stats.maxWeightReached,
    gameState.resources.weight
  )
  return finalWeight
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
 * cascade and addInnerPackage both route through it so the seed-cache step
 * can't be missed. Callers handle their own weight bookkeeping, stats, and
 * any package-state mutation downstream of attachment.
 */
export function attachNodeToScope(
  scopePath: readonly string[],
  pkg: Package,
  parentInScopeId: string,
  isCompressed: boolean,
  conflicted: boolean
): { wireId: string; scopeGraph: SpatialGraph<Package, Wire> } {
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

/**
 * Add an inner-scope package to the given scope's child graph. Creates the
 * wire from the parent (scope owner if `parentInScopeId === scopeOwnerId`,
 * or another inner pkg for sub-deps). If the package itself is compressed,
 * its own child graph + shadow are created.
 */
export function addInnerPackage(
  scopePath: readonly string[],
  pkg: Package,
  parentInScopeId: string,
  isCompressed: boolean,
  conflicted: boolean
): void {
  if (scopePath.length === 0) {
    throw new Error('addInnerPackage requires a non-empty scope path')
  }
  attachNodeToScope(scopePath, pkg, parentInScopeId, isCompressed, conflicted)
  addWeight(pkg.size)
  gameState.stats.totalPackagesInstalled++
}

/** Create a child graph for `pkg` and add a shadow node mirroring its data. */
export function ensureChildGraphWithShadow(
  parent: SpatialGraph<Package, Wire>,
  pkg: Package
): SpatialGraph<Package, Wire> {
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
  gameState.stats.currentEfficiency = newEfficiency
  checkEfficiencyChange(newEfficiency)
}

export function updateStability(): void {
  gameState.stats.currentStability = calculateStabilityRatio()
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

export function getConflictResolveCost(): number {
  return 0
}

export function canAffordConflictResolve(): boolean {
  return true
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
