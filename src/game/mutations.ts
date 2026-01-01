// State mutation helpers

import type { Package, Wire } from './types'
import {
  createInitialState,
  FRAGMENT_TO_TOKEN_RATIO,
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
import {
  calculateEfficiency,
  calculateStabilityRatio,
  calculatePrestigeReward,
} from './formulas'
import {
  gameState,
  computed_canPrestige,
  getPrestigeThreshold,
  syncEcosystemTier,
  getEcosystemTier,
} from './state'
import {
  getCurrentScopePackages,
  getCurrentScopeWires,
  isInPackageScope,
} from './scope'
import { saveToLocalStorage, clearSavedGame } from './persistence'
import { emit } from './events'
import { getCompressionMultiplier, getStabilizationBonus } from './upgrades'
import {
  getEfficiencyTier,
  getEfficiencyTierRank,
  type EfficiencyTier,
} from './formulas'

// ============================================
// QUALITY EVENT SYSTEM
// ============================================

export type QualityEvent =
  | {
      type: 'efficiency-improved'
      delta: number
      newValue: number
      newTier: EfficiencyTier
    }
  | {
      type: 'efficiency-tier-up'
      oldTier: EfficiencyTier
      newTier: EfficiencyTier
    }
  | {
      type: 'symlink-merge'
      weightSaved: number
      position: { x: number; y: number }
    }
  | {
      type: 'scope-stabilized'
      scopeId: string
      packageCount: number
    }
  | {
      type: 'conflict-resolved'
      position: { x: number; y: number }
    }
  | {
      type: 'stability-improved'
      newValue: number
      scopesStable: number
      scopesTotal: number
    }

type QualityEventListener = (event: QualityEvent) => void
const qualityEventListeners: Set<QualityEventListener> = new Set()

/** Emit a quality event to all subscribers */
export function emitQualityEvent(event: QualityEvent): void {
  for (const listener of qualityEventListeners) {
    try {
      listener(event)
    } catch (e) {
      console.error('Quality event listener error:', e)
    }
  }
}

/** Subscribe to quality events. Returns unsubscribe function. */
export function onQualityEvent(listener: QualityEventListener): () => void {
  qualityEventListeners.add(listener)
  return () => {
    qualityEventListeners.delete(listener)
  }
}

/** Clear all listeners (for cleanup/testing) */
export function clearQualityEventListeners(): void {
  qualityEventListeners.clear()
}

// ============================================
// EFFICIENCY TRACKING (for tier-up detection)
// ============================================

let lastEfficiency = 1
let lastEfficiencyTier: EfficiencyTier = 'pristine'

/** Check efficiency changes and emit events if needed */
function checkEfficiencyChange(newEfficiency: number): void {
  const newTier = getEfficiencyTier(newEfficiency)
  const delta = newEfficiency - lastEfficiency

  // Emit tier-up event if tier improved
  const oldRank = getEfficiencyTierRank(lastEfficiencyTier)
  const newRank = getEfficiencyTierRank(newTier)

  if (newRank > oldRank) {
    emitQualityEvent({
      type: 'efficiency-tier-up',
      oldTier: lastEfficiencyTier,
      newTier,
    })
  }

  // Emit improvement event if efficiency increased significantly (>1%)
  if (delta > 0.01) {
    emitQualityEvent({
      type: 'efficiency-improved',
      delta,
      newValue: newEfficiency,
      newTier,
    })
  }

  lastEfficiency = newEfficiency
  lastEfficiencyTier = newTier
}

/** Reset efficiency tracking (call on prestige) */
function resetEfficiencyTracking(): void {
  lastEfficiency = 1
  lastEfficiencyTier = 'pristine'
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
  return generateBandwidth(MOMENTUM_PACKAGE_RESOLVE)
}

/** Generate BW when a conflict is manually resolved */
export function onConflictResolved(): number {
  return generateBandwidth(MOMENTUM_CONFLICT_RESOLVE)
}

/** Generate BW when packages are merged via symlink */
export function onSymlinkMerged(): number {
  return generateBandwidth(MOMENTUM_SYMLINK_MERGE)
}

/** Generate BW burst when a scope stabilizes */
export function onScopeStabilized(packageCount: number): number {
  const baseAmount =
    MOMENTUM_STABILIZE_BASE + packageCount * MOMENTUM_STABILIZE_PER_PKG
  const upgradeBonus = getStabilizationBonus()

  // Emit quality event for UI juice
  const scopeId =
    gameState.scopeStack[gameState.scopeStack.length - 1] ?? 'root'
  emitQualityEvent({
    type: 'scope-stabilized',
    scopeId,
    packageCount,
  })

  return generateBandwidth(Math.floor(baseAmount * upgradeBonus))
}

/** Generate BW when a golden package spawns */
export function onGoldenSpawned(): number {
  return generateBandwidth(MOMENTUM_GOLDEN_SPAWN, false)
}

/** Generate BW when a cache fragment is collected */
export function onFragmentCollected(): number {
  return generateBandwidth(MOMENTUM_FRAGMENT_COLLECT, false)
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

export function spendBandwidth(amount: number): boolean {
  if (gameState.resources.bandwidth >= amount) {
    gameState.resources.bandwidth -= amount
    return true
  }
  return false
}

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
// PRESTIGE & RESET
// ============================================

// Prestige completion callback (set by UI to handle post-prestige actions)
let onPrestigeComplete: (() => void) | null = null

export function setPrestigeCompleteCallback(callback: () => void): void {
  onPrestigeComplete = callback
}

export function performPrestige(): void {
  const threshold = getPrestigeThreshold(gameState.meta.totalPrestiges)
  const reward = calculatePrestigeReward(gameState, threshold)

  // Mark first prestige complete for onboarding
  if (!gameState.onboarding.firstPrestigeComplete) {
    gameState.onboarding.firstPrestigeComplete = true
  }

  // Convert fragments to bonus tokens
  const fragmentBonus = Math.floor(
    gameState.resources.cacheFragments / FRAGMENT_TO_TOKEN_RATIO
  )

  // Add meta rewards (base reward + fragment bonus)
  gameState.meta.cacheTokens += reward + fragmentBonus
  gameState.meta.totalPrestiges++

  // Sync ecosystem tier (derived from cache tokens)
  syncEcosystemTier()

  // Reset current run
  gameState.packages.clear()
  gameState.wires.clear()
  gameState.rootId = null

  // Reset scope system
  gameState.currentScope = 'root'
  gameState.scopeStack = []
  gameState.tutorialGating = false // Relax gating after first prestige

  // Reset cascade system
  gameState.cascade.active = false
  gameState.cascade.scopePackageId = null
  gameState.cascade.pendingSpawns = []

  // Reset automation system (toggles reset to off each run)
  gameState.automation.resolveEnabled = false
  gameState.automation.resolveActive = false
  gameState.automation.resolveTargetWireId = null
  gameState.automation.resolveTargetScope = null
  gameState.automation.processStartTime = 0
  gameState.automation.lastResolveTime = 0

  // Reset surge (charge resets, unlocked segments preserved via upgrade)
  gameState.surge.chargedSegments = 0
  gameState.surge.unlockedSegments = 1 + gameState.upgrades.surgeLevel

  gameState.resources.bandwidth = 100 * gameState.meta.ecosystemTier
  gameState.resources.weight = 0
  gameState.resources.cacheFragments = 0

  // Keep upgrades but reset level-specific progress
  gameState.stats.currentEfficiency = 1
  gameState.stats.currentStability = 1
  resetEfficiencyTracking()

  // Reset camera
  gameState.camera.x = 0
  gameState.camera.y = 0
  gameState.camera.zoom = 1

  // Save immediately after prestige
  saveToLocalStorage()
}

export function triggerPrestigeWithAnimation(): void {
  if (!computed_canPrestige.value) return

  // Emit prestige start event with completion callback
  emit('prestige:start', {
    onComplete: () => {
      performPrestige()
      if (onPrestigeComplete) {
        onPrestigeComplete()
      }
    },
  })
}

/**
 * Soft reset: restart current run but keep meta progress (prestige, cache tokens, upgrades)
 */
export function softReset(): void {
  // Clear current run state
  gameState.packages.clear()
  gameState.wires.clear()
  gameState.rootId = null

  // Reset scope
  gameState.currentScope = 'root'

  // Reset resources to base values (scaled by tier)
  gameState.resources.bandwidth = 100 * gameState.meta.ecosystemTier
  gameState.resources.weight = 0
  gameState.resources.cacheFragments = 0

  // Reset run stats but keep lifetime stats structure
  gameState.stats.currentEfficiency = 1
  gameState.stats.currentStability = 1
  resetEfficiencyTracking()

  // Reset surge charge (keep unlocked segments)
  gameState.surge.chargedSegments = 0

  // Reset camera
  gameState.camera.x = 0
  gameState.camera.y = 0
  gameState.camera.zoom = 1

  // Reset onboarding for this run (but intro already seen)
  gameState.onboarding.firstClickComplete = false
  // Keep introAnimationComplete and firstPrestigeComplete

  // Save after soft reset
  saveToLocalStorage()
}

/**
 * Hard reset: wipe everything and start completely fresh
 */
export function hardReset(): void {
  // Clear localStorage first
  clearSavedGame()
  // Reset all state to initial
  Object.assign(gameState, createInitialState())
}
