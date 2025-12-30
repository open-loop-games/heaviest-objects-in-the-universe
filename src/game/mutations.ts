// State mutation helpers

import type { Package, Wire } from './types'
import { createInitialState } from './config'
import { calculateEfficiency, calculatePrestigeReward } from './formulas'
import {
  gameState,
  computed_canPrestige,
  getPrestigeThreshold,
  syncEcosystemTier,
} from './state'
import { getCurrentScopePackages, getCurrentScopeWires } from './scope'
import { saveToLocalStorage, clearSavedGame } from './persistence'

// ============================================
// PACKAGE MUTATIONS
// ============================================

export function addPackage(pkg: Package): void {
  gameState.packages.set(pkg.id, pkg)
  gameState.resources.weight += pkg.size
  gameState.stats.totalPackagesInstalled++
  gameState.stats.maxWeightReached = Math.max(
    gameState.stats.maxWeightReached,
    gameState.resources.weight
  )
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
  if (wire.isSymlink) {
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
  gameState.stats.currentEfficiency = calculateEfficiency(gameState)
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
 * Resolve a conflict on a wire
 * SCOPE-AWARE: Works for both outer wires and internal wires
 */
export function resolveWireConflict(wireId: string): boolean {
  const wires = getCurrentScopeWires()
  const packages = getCurrentScopePackages()

  const wire = wires.get(wireId)
  if (!wire || !wire.conflicted) return false

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

  return true
}

// ============================================
// PRESTIGE & RESET
// ============================================

// Callback for triggering collapse animation before prestige
let onPrestigeAnimationStart: ((onComplete: () => void) => void) | null = null
let onPrestigeComplete: (() => void) | null = null

export function setPrestigeAnimationCallback(
  animationStart: (onComplete: () => void) => void,
  afterPrestige: () => void
): void {
  onPrestigeAnimationStart = animationStart
  onPrestigeComplete = afterPrestige
}

export function performPrestige(): void {
  const threshold = getPrestigeThreshold(gameState.meta.totalPrestiges)
  const reward = calculatePrestigeReward(gameState, threshold)

  // Mark first prestige complete for onboarding
  if (!gameState.onboarding.firstPrestigeComplete) {
    gameState.onboarding.firstPrestigeComplete = true
  }

  // Add meta rewards
  gameState.meta.cacheTokens += reward
  gameState.meta.totalPrestiges++

  // Sync ecosystem tier (derived from cache tokens)
  syncEcosystemTier()

  // Reset current run
  gameState.packages.clear()
  gameState.wires.clear()
  gameState.hoistedDeps.clear()
  gameState.rootId = null

  // Reset scope system
  gameState.currentScope = 'root'
  gameState.scopeStack = []
  gameState.tutorialGating = false // Relax gating after first prestige

  // Reset cascade system
  gameState.cascade.active = false
  gameState.cascade.scopePackageId = null
  gameState.cascade.pendingSpawns = []

  // Reset automation system
  gameState.automation.resolveActive = false
  gameState.automation.resolveTargetWireId = null
  gameState.automation.resolveTargetScope = null
  gameState.automation.dedupActive = false
  gameState.automation.dedupTargetPair = null
  gameState.automation.dedupTargetScope = null
  gameState.automation.processStartTime = 0
  gameState.automation.lastResolveTime = 0
  gameState.automation.lastDedupTime = 0

  gameState.resources.bandwidth = 100 * gameState.meta.ecosystemTier
  gameState.resources.weight = 0

  // Keep upgrades but reset level-specific progress
  gameState.stats.currentEfficiency = 1

  // Reset camera
  gameState.camera.x = 0
  gameState.camera.y = 0
  gameState.camera.zoom = 1

  // Save immediately after prestige
  saveToLocalStorage()
}

export function triggerPrestigeWithAnimation(): void {
  if (!computed_canPrestige.value) return

  if (onPrestigeAnimationStart) {
    // Play animation, then prestige
    onPrestigeAnimationStart(() => {
      performPrestige()
      if (onPrestigeComplete) {
        onPrestigeComplete()
      }
    })
  } else {
    // No animation, just prestige
    performPrestige()
    if (onPrestigeComplete) {
      onPrestigeComplete()
    }
  }
}

/**
 * Soft reset: restart current run but keep meta progress (prestige, cache tokens, upgrades)
 */
export function softReset(): void {
  // Clear current run state
  gameState.packages.clear()
  gameState.wires.clear()
  gameState.hoistedDeps.clear()
  gameState.rootId = null

  // Reset scope
  gameState.currentScope = 'root'

  // Reset resources to base values (scaled by tier)
  gameState.resources.bandwidth = 100 * gameState.meta.ecosystemTier
  gameState.resources.weight = 0

  // Reset run stats but keep lifetime stats structure
  gameState.stats.currentEfficiency = 1

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

/**
 * @deprecated Use softReset() or hardReset() instead
 */
export function resetGame(): void {
  hardReset()
}
