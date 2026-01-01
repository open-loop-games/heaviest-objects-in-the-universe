// State mutation helpers

import type { Package, Wire } from './types'
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
} from './config'
import { calculateEfficiency, calculateStabilityRatio } from './formulas'
import { gameState } from './state'
import { getEcosystemTier } from './formulas'
import {
  getCurrentScopePackages,
  getCurrentScopeWires,
  isInPackageScope,
} from './scope'
import { emit, on } from './events'
import { getCompressionMultiplier, getStabilizationBonus } from './upgrades'
import { getEfficiencyTierRank } from './formulas'
import { updateEfficiencyTracking } from './prestige'

// Quality event types are now in the main event bus (src/game/events.ts)
// Use emit('quality:efficiency-improved', ...) etc.

// ============================================
// EFFICIENCY TRACKING (for tier-up detection)
// ============================================

/** Check efficiency changes and emit events if needed */
function checkEfficiencyChange(newEfficiency: number): void {
  const { tierChanged, oldTier, newTier, delta } =
    updateEfficiencyTracking(newEfficiency)

  // Emit tier-up event if tier improved
  const oldRank = getEfficiencyTierRank(oldTier)
  const newRank = getEfficiencyTierRank(newTier)

  if (tierChanged && newRank > oldRank) {
    emit('quality:efficiency-tier-up', { oldTier, newTier })
  }

  // Emit improvement event if efficiency increased significantly (>1%)
  if (delta > 0.01) {
    emit('quality:efficiency-improved', {
      delta,
      newValue: newEfficiency,
      newTier,
    })
  }
}

// ============================================
// MOMENTUM SYSTEM (Activity-driven BW generation)
// ============================================

// Track recent generation for dampening calculation
interface GenerationEvent {
  amount: number
  timestamp: number
}

const recentGeneration: GenerationEvent[] = []

function cleanOldEvents(): void {
  const cutoff = Date.now() - MOMENTUM_DAMPENING_WINDOW
  // Use optional chaining for safety (though length check makes it safe)
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

/** Generate BW when a package finishes installing */
export function onPackageResolved(): number {
  const amount = generateBandwidth(MOMENTUM_PACKAGE_RESOLVE)
  emit('game:package-resolved', { amount })
  return amount
}

/** Generate BW when a conflict is manually resolved */
export function onConflictResolved(position?: {
  x: number
  y: number
}): number {
  const amount = generateBandwidth(MOMENTUM_CONFLICT_RESOLVE)
  emit('game:conflict-resolved', { amount, position })
  return amount
}

/** Generate BW when packages are merged via symlink */
export function onSymlinkMerged(
  weightSaved: number,
  position: { x: number; y: number }
): number {
  const amount = generateBandwidth(MOMENTUM_SYMLINK_MERGE)
  emit('game:symlink-merged', { amount, weightSaved, position })
  return amount
}

/** Generate BW burst when a scope stabilizes */
export function onScopeStabilized(packageCount: number): number {
  const baseAmount =
    MOMENTUM_STABILIZE_BASE + packageCount * MOMENTUM_STABILIZE_PER_PKG
  const upgradeBonus = getStabilizationBonus()

  const scopeId =
    gameState.scopeStack[gameState.scopeStack.length - 1] ?? 'root'

  const amount = generateBandwidth(Math.floor(baseAmount * upgradeBonus))
  emit('game:scope-stabilized', { amount, scopeId, packageCount })

  return amount
}

/** Generate BW when a golden package spawns */
export function onGoldenSpawned(): number {
  const amount = generateBandwidth(MOMENTUM_GOLDEN_SPAWN, false)
  emit('game:golden-spawned', { amount })
  return amount
}

/** Generate BW when a cache fragment is collected */
export function onFragmentCollected(): number {
  const amount = generateBandwidth(MOMENTUM_FRAGMENT_COLLECT, false)
  emit('game:fragment-collected', { amount })
  return amount
}

/** Get safety regen rate (BW/sec) - minimal passive to prevent soft-lock */
export function getSafetyRegenRate(): number {
  const tier = getEcosystemTier(gameState.meta.cacheTokens)
  return SAFETY_REGEN_BY_TIER[tier] ?? 2
}

/** Apply safety regen for a time delta (called from game loop) */
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

/**
 * Add weight with compression multiplier applied
 * @param baseWeight The base weight to add
 * @returns The actual weight added (after compression)
 */
export function addWeight(baseWeight: number): number {
  const compressedWeight = baseWeight * getCompressionMultiplier()
  gameState.resources.weight += compressedWeight
  gameState.stats.maxWeightReached = Math.max(
    gameState.stats.maxWeightReached,
    gameState.resources.weight
  )
  return compressedWeight
}

// ============================================
// PACKAGE MUTATIONS
// ============================================

export function addPackage(pkg: Package): void {
  gameState.packages.set(pkg.id, pkg)
  addWeight(pkg.size)
  gameState.stats.totalPackagesInstalled++
}

export function removePackage(id: string): void {
  // NEVER delete the root node
  if (id === gameState.rootId) {
    console.error('Attempted to remove root package!')
    return
  }

  const pkg = gameState.packages.get(id)
  if (pkg) {
    gameState.resources.weight -= pkg.size
    gameState.packages.delete(id)

    // Remove associated wires
    for (const [wireId, wire] of gameState.wires) {
      if (wire.fromId === id || wire.toId === id) {
        gameState.wires.delete(wireId)
      }
    }
  }
}

/**
 * Remove a package and all of its descendants recursively
 */
export function removePackageWithSubtree(id: string): void {
  const pkg = gameState.packages.get(id)
  if (!pkg) return

  // Recursively remove all children first
  for (const childId of [...pkg.children]) {
    removePackageWithSubtree(childId)
  }

  // Remove from parent's children list
  if (pkg.parentId) {
    const parent = gameState.packages.get(pkg.parentId)
    if (parent) {
      parent.children = parent.children.filter((cid) => cid !== id)
    }
  }

  // Remove the package itself
  removePackage(id)
}

// ============================================
// WIRE MUTATIONS
// ============================================

export function addWire(wire: Wire): void {
  gameState.wires.set(wire.id, wire)
  if (wire.wireType === 'symlink') {
    gameState.stats.totalSymlinksCreated++
  }
}

/**
 * Remove a wire by ID
 */
export function removeWire(id: string): void {
  gameState.wires.delete(id)
}

// ============================================
// RESOURCE MUTATIONS
// ============================================

export function updateEfficiency(): void {
  const newEfficiency = calculateEfficiency(gameState)
  gameState.stats.currentEfficiency = newEfficiency
  // Check for tier-up events (emits quality events for UI juice)
  checkEfficiencyChange(newEfficiency)
}

export function updateStability(): void {
  gameState.stats.currentStability = calculateStabilityRatio(gameState)
}

/**
 * Resolve a conflict on a package
 * SCOPE-AWARE: Works for both outer packages and internal packages
 */
export function resolveConflict(packageId: string): void {
  const packages = getCurrentScopePackages()
  const pkg = packages.get(packageId)

  if (pkg && pkg.state === 'conflict') {
    pkg.state = 'ready'
    pkg.conflictProgress = 0
    gameState.stats.totalConflictsResolved++
  }
}

/**
 * Get the cost to resolve a conflict
 * Momentum loop: Conflicts are FREE to resolve (generates BW instead)
 */
export function getConflictResolveCost(): number {
  return 0 // Free in momentum loop - generates BW instead
}

/**
 * Check if we can afford to resolve a conflict
 * Always true in momentum loop (no cost)
 */
export function canAffordConflictResolve(): boolean {
  return true // Always affordable in momentum loop
}

/**
 * Resolve a conflict on a wire
 * SCOPE-AWARE: Works for both outer wires and internal wires
 * Momentum loop: Generates bandwidth instead of costing
 * Returns false if wire doesn't exist or isn't conflicted
 */
export function resolveWireConflict(wireId: string): boolean {
  const wires = getCurrentScopeWires()
  const packages = getCurrentScopePackages()

  const wire = wires.get(wireId)
  if (!wire || !wire.conflicted) return false

  // Momentum loop: Generate bandwidth for manual conflict resolution
  onConflictResolved()

  // Mark wire as resolved
  wire.conflicted = false
  wire.conflictTime = 0

  // Find the conflicted package and mark it as ready
  const targetPkg = packages.get(wire.toId)
  if (targetPkg && targetPkg.state === 'conflict') {
    targetPkg.state = 'ready'
    targetPkg.conflictProgress = 0
    gameState.stats.totalConflictsResolved++
  }

  // Mark first inner conflict as seen for onboarding
  if (isInPackageScope() && !gameState.onboarding.firstInnerConflictSeen) {
    gameState.onboarding.firstInnerConflictSeen = true
  }

  // Emit event for scope state recalculation
  if (isInPackageScope()) {
    emit('scope:recalculate', { scopePath: [...gameState.scopeStack] })
  }

  return true
}

// ============================================
// CACHE FRAGMENT COLLECTION
// ============================================

/**
 * Collect a cache fragment from a package
 * @param packageId The package to collect from
 * @returns true if collection succeeded
 */
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

// Handle scope stabilization event (decouples scope → mutations)
on('scope:stabilized', ({ packageCount }) => {
  onScopeStabilized(packageCount)
})
