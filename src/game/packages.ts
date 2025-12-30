// Package creation and management logic

import { toRaw } from 'vue'
import { gameState, gameConfig } from './state'
import {
  enterScope as _enterScope,
  exitScope,
  enterScopeAtPath,
  getPackageAtPath,
} from './scope'
import { addPackage, addWire, spendBandwidth } from './mutations'
import { generateId, generateWireId } from './id-generator'
import { type Package, type Wire, type InternalState } from './types'
import { rollDependencyCount, rollPackageSize } from './formulas'
import { getEffectiveInstallCost } from './upgrades'
import {
  pickRandomIdentity,
  pickDirectInstallIdentity,
  checkIncompatibilityWithPackages,
  areIncompatible,
  STARTER_KIT_IDENTITY,
  STARTER_KIT_INTERNAL_DEPS,
  type PackageIdentity,
} from './registry'
import { setRecalculateCallback } from './symlinks'

// Re-export ID initialization for save/load
export { initIdCounterFromState } from './id-generator'

// Re-export queries for backwards compatibility
export { findPackageAtPosition, getInternalStats } from './queries'

/**
 * Get deterministic size for a package based on its identity.
 * Same identity = same size, for visual consistency of duplicates.
 */
function getIdentitySize(
  identity: PackageIdentity | undefined,
  minSize: number = 10
): number {
  if (!identity) return rollPackageSize()
  // Use identity weight directly - no random variance
  // This ensures duplicates of the same package look identical
  return Math.max(minSize, identity.weight)
}

// Root package identity - npm itself
const ROOT_IDENTITY: PackageIdentity = {
  name: 'package.json',
  iconKey: 'npm',
  archetype: 'runtime',
  baseDeps: 5,
  weight: 1,
  isHub: true,
}

/**
 * Create the root package (first package in the tree)
 */
export function createRootPackage(): Package | null {
  if (gameState.rootId !== null) {
    return null // Root already exists
  }

  const id = generateId()
  const pkg: Package = {
    id,
    parentId: null,
    position: { x: 0, y: 0 },
    velocity: { vx: 0, vy: 0 },
    state: 'ready',
    size: 100,
    depth: 0,
    children: [],
    installProgress: 1,
    conflictProgress: 0,
    identity: ROOT_IDENTITY,
    // Scope system - root doesn't have internal tree
    internalPackages: null,
    internalWires: null,
    internalState: null,
    // Ghost system
    isGhost: false,
    ghostTargetId: null,
    ghostTargetScope: null,
  }

  gameState.rootId = id
  addPackage(pkg)
  return pkg
}

/**
 * Attempt to install a new package as a child of the target
 * This is a DIRECT player install - uses tier-appropriate packages
 */
export function installPackage(parentId: string): Package | null {
  const parent = gameState.packages.get(parentId)
  if (!parent) return null

  // Tutorial gating: before first prestige, must stabilize previous package before installing next
  if (gameState.meta.totalPrestiges === 0 && parentId === gameState.rootId) {
    // Find existing top-level packages
    const topLevelPackages = Array.from(gameState.packages.values()).filter(
      (p) => p.parentId === gameState.rootId
    )

    // If there's already a top-level package that isn't stable, block install
    const unstableTopLevel = topLevelPackages.find(
      (p) => p.internalState !== null && p.internalState !== 'stable'
    )
    if (unstableTopLevel) {
      // Can't install new package until current one is stabilized
      return null
    }
  }

  const cost = getEffectiveInstallCost()
  if (!spendBandwidth(cost)) {
    return null // Not enough bandwidth
  }

  // Mark first click complete for onboarding
  if (!gameState.onboarding.firstClickComplete) {
    gameState.onboarding.firstClickComplete = true
  }

  const id = generateId()
  const angle = Math.random() * Math.PI * 2
  const distance = 80 + Math.random() * 40

  // First install before prestige: always use starter-kit
  const isFirstInstall =
    gameState.meta.totalPrestiges === 0 &&
    parentId === gameState.rootId &&
    parent.children.length === 0

  // Pick a package identity based on ecosystem tier
  const identity = isFirstInstall
    ? STARTER_KIT_IDENTITY
    : pickDirectInstallIdentity(gameState.meta.ecosystemTier)

  // Use deterministic size based on identity (no variance for duplicate consistency)
  const size = getIdentitySize(identity)

  // Check if this is a top-level package (parent is root)
  const isTopLevel = parentId === gameState.rootId

  const pkg: Package = {
    id,
    parentId,
    position: {
      x: parent.position.x + Math.cos(angle) * distance,
      y: parent.position.y + Math.sin(angle) * distance,
    },
    velocity: { vx: 0, vy: 0 },
    state: 'installing',
    size,
    depth: parent.depth + 1,
    children: [],
    installProgress: 0,
    conflictProgress: 0,
    identity,
    // Scope system - top-level packages have internal trees
    internalPackages: isTopLevel ? new Map() : null,
    internalWires: isTopLevel ? new Map() : null,
    internalState: isTopLevel ? 'pristine' : null,
    // Ghost system
    isGhost: false,
    ghostTargetId: null,
    ghostTargetScope: null,
  }

  // Add wire connecting parent to child
  const wire: Wire = {
    id: generateWireId(),
    fromId: parentId,
    toId: id,
    wireType: 'dependency',
    isSymlink: false,
    flowProgress: 0,
    conflicted: false,
    conflictTime: 0,
  }

  parent.children.push(id)
  addPackage(pkg)
  addWire(wire)

  return pkg
}

/**
 * Spawn dependencies for a package that just finished installing
 * NOTE: Top-level packages (direct children of root) do NOT spawn at root.
 * They are "compressed" and expand when the player enters them.
 */
export function spawnDependencies(packageId: string): Package[] {
  const pkg = gameState.packages.get(packageId)
  if (!pkg) return []

  // Top-level packages are "compressed" - they don't cascade at root scope.
  // Their internal dependencies spawn when the player enters them.
  const isTopLevel = pkg.parentId === gameState.rootId
  if (isTopLevel) {
    return [] // Compressed seed - cascade happens on enter
  }

  // Don't spawn if too deep
  if (pkg.depth >= gameConfig.dependencyDepthLimit) {
    return []
  }

  // Use identity-based dep count if available, otherwise use distribution
  let count: number
  if (pkg.identity && pkg.identity.baseDeps > 0) {
    const variance = Math.floor(Math.random() * 3) - 1
    count = Math.max(0, pkg.identity.baseDeps + variance)
  } else {
    count = rollDependencyCount(gameConfig)
  }

  // Early game clamp: before first prestige, limit cascade size
  if (gameState.meta.totalPrestiges === 0) {
    const packageCount = gameState.packages.size
    if (packageCount < 10) {
      count = Math.min(count, 2)
    } else if (packageCount < 30) {
      count = Math.min(count, 3)
    } else if (packageCount < 60) {
      count = Math.min(count, 4)
    }
  }

  const spawned: Package[] = []

  for (let i = 0; i < count; i++) {
    // Fan children downward, spread evenly with randomness
    const spreadAngle = Math.PI * 0.7
    const startAngle = Math.PI * 0.5 - spreadAngle / 2
    const baseAngle =
      count > 1 ? startAngle + (spreadAngle * i) / (count - 1) : Math.PI * 0.5
    const angle = baseAngle + (Math.random() - 0.5) * 0.3
    const distance = 80 + Math.random() * 40

    const id = generateId()
    const identity = pickRandomIdentity()
    const size = getIdentitySize(identity)

    const child: Package = {
      id,
      parentId: packageId,
      position: {
        x: pkg.position.x + Math.cos(angle) * distance,
        y: pkg.position.y + Math.sin(angle) * distance,
      },
      velocity: {
        vx: Math.cos(angle) * 2,
        vy: Math.sin(angle) * 2,
      },
      state: 'installing',
      size,
      depth: pkg.depth + 1,
      children: [],
      installProgress: 0,
      conflictProgress: 0,
      identity,
      internalPackages: null,
      internalWires: null,
      internalState: null,
      isGhost: false,
      ghostTargetId: null,
      ghostTargetScope: null,
    }

    // Check for incompatibility conflict with ancestors
    const isConflicted = checkIncompatibilityWithPackages(
      identity,
      packageId,
      toRaw(gameState.packages)
    )

    const wire: Wire = {
      id: generateWireId(),
      fromId: packageId,
      toId: id,
      wireType: 'dependency',
      isSymlink: false,
      flowProgress: 0,
      conflicted: isConflicted,
      conflictTime: isConflicted ? Date.now() : 0,
    }

    if (isConflicted) {
      child.state = 'conflict'
      if (!gameState.onboarding.firstConflictSeen) {
        gameState.onboarding.firstConflictSeen = true
      }
    }

    pkg.children.push(id)
    addPackage(child)
    addWire(wire)
    spawned.push(child)
  }

  return spawned
}

// ============================================
// INTERNAL SCOPE SYSTEM
// ============================================

// Import cascade and scope systems
import {
  startCascade,
  isCascadeActive,
  setCascadeEndCallback,
} from './cascade'
import { getScopeDepth } from './scope'

/**
 * Enter a package's internal scope (works at any depth)
 * If the package is pristine, starts the cascade (staggered spawning)
 */
export function enterPackageScope(packageId: string): boolean {
  // For layer 1 (entering from root), use the original enterScope
  if (gameState.scopeStack.length === 0) {
    const pkg = gameState.packages.get(packageId)
    if (!pkg) return false

    if (!_enterScope(packageId)) return false

    // If pristine, start the staggered cascade
    if (pkg.internalState === 'pristine') {
      startCascade([packageId])
      pkg.internalState = 'unstable'
    }

    return true
  }

  // For deeper layers, use generic path-based entry
  if (!enterScopeAtPath(packageId)) return false

  // Get the package we just entered using the new scope path
  const pkg = getPackageAtPath(gameState.scopeStack)
  if (!pkg) return false

  // If pristine, start the cascade
  if (pkg.internalState === 'pristine') {
    startCascade([...gameState.scopeStack])
    pkg.internalState = 'unstable'
  }

  return true
}

/**
 * Enter a compressed internal dep's scope (legacy wrapper)
 * Now just calls the unified enterPackageScope
 */
export function enterInternalPackageScope(internalPkgId: string): boolean {
  return enterPackageScope(internalPkgId)
}

/**
 * Check if a cascade is currently in progress
 */
export { isCascadeActive }

/**
 * Get current scope depth (0 = root, 1+)
 */
export { getScopeDepth }

/**
 * Exit the current scope (go up one level)
 */
export function exitPackageScope(): void {
  // Recalculate state before exiting (at current depth)
  if (gameState.scopeStack.length > 0) {
    recalculateStateAtPath([...gameState.scopeStack])
  }

  exitScope()
}

/**
 * Spawn internal dependencies for a top-level package
 */
export function spawnInternalDependencies(packageId: string): void {
  const pkg = gameState.packages.get(packageId)
  if (!pkg) return

  if (!pkg.internalPackages || !pkg.internalWires) return
  if (pkg.internalPackages.size > 0) return

  const isStarterKit = pkg.identity?.name === 'starter-kit'

  const depIdentities: PackageIdentity[] = isStarterKit
    ? [...STARTER_KIT_INTERNAL_DEPS]
    : []

  if (!isStarterKit) {
    let count: number
    if (pkg.identity && pkg.identity.baseDeps > 0) {
      const variance = Math.floor(Math.random() * 5) - 2
      count = Math.max(6, pkg.identity.baseDeps + variance)
    } else {
      count = 6 + Math.floor(Math.random() * 7)
    }
    count = Math.min(count, 12)
    count = Math.max(count, 6)

    for (let i = 0; i < count; i++) {
      depIdentities.push(pickRandomIdentity())
    }
  }

  const count = depIdentities.length

  // Spawn internal packages in a circle
  for (let i = 0; i < count; i++) {
    const baseAngle = (Math.PI * 2 * i) / count - Math.PI / 2
    const angle = baseAngle + (Math.random() - 0.5) * 0.2
    const distance = 80 + Math.random() * 40

    const id = generateId()
    const identity = depIdentities[i]!
    const size = getIdentitySize(identity)

    const innerPkg: Package = {
      id,
      parentId: packageId,
      position: {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
      },
      velocity: {
        vx: Math.cos(angle) * 2,
        vy: Math.sin(angle) * 2,
      },
      state: 'installing',
      size,
      depth: 1,
      children: [],
      installProgress: 0.8 + Math.random() * 0.2,
      conflictProgress: 0,
      identity,
      internalPackages: null,
      internalWires: null,
      internalState: null,
      isGhost: false,
      ghostTargetId: null,
      ghostTargetScope: null,
    }

    const isConflicted = checkInternalIncompatibility(
      identity,
      pkg.internalPackages
    )

    const wire: Wire = {
      id: generateWireId(),
      fromId: packageId,
      toId: id,
      wireType: 'dependency',
      isSymlink: false,
      flowProgress: 0,
      conflicted: isConflicted,
      conflictTime: isConflicted ? Date.now() : 0,
    }

    if (isConflicted) {
      innerPkg.state = 'conflict'
    }

    pkg.internalPackages.set(id, innerPkg)
    pkg.internalWires.set(wire.id, wire)

    pkg.size += size
    gameState.resources.weight += size
  }

  // SECOND PASS: Spawn sub-deps for some internal packages
  const internalPkgIds = Array.from(pkg.internalPackages.keys())

  for (const parentInternalId of internalPkgIds) {
    if (Math.random() > 0.4) continue

    const parentInternalPkg = pkg.internalPackages.get(parentInternalId)
    if (!parentInternalPkg) continue
    if (parentInternalPkg.depth >= 2) continue

    const subDepCount = 1 + Math.floor(Math.random() * 2)
    for (let j = 0; j < subDepCount; j++) {
      const parentAngle = Math.atan2(
        parentInternalPkg.position.y,
        parentInternalPkg.position.x
      )
      const subAngle = parentAngle + (Math.random() - 0.5) * 0.5
      const subDistance =
        Math.sqrt(
          parentInternalPkg.position.x ** 2 + parentInternalPkg.position.y ** 2
        ) +
        50 +
        Math.random() * 30

      const subId = generateId()
      const subIdentity = pickRandomIdentity()
      const subSize = getIdentitySize(subIdentity, 5)

      const subPkg: Package = {
        id: subId,
        parentId: parentInternalId,
        position: {
          x: Math.cos(subAngle) * subDistance,
          y: Math.sin(subAngle) * subDistance,
        },
        velocity: {
          vx: Math.cos(subAngle) * 1.5,
          vy: Math.sin(subAngle) * 1.5,
        },
        state: 'installing',
        size: subSize,
        depth: 2,
        children: [],
        installProgress: 0.9 + Math.random() * 0.1,
        conflictProgress: 0,
        identity: subIdentity,
        internalPackages: null,
        internalWires: null,
        internalState: null,
        isGhost: false,
        ghostTargetId: null,
        ghostTargetScope: null,
      }

      const subConflicted = checkInternalIncompatibility(
        subIdentity,
        pkg.internalPackages
      )

      const subWire: Wire = {
        id: generateWireId(),
        fromId: parentInternalId,
        toId: subId,
        wireType: 'dependency',
        isSymlink: false,
        flowProgress: 0,
        conflicted: subConflicted,
        conflictTime: subConflicted ? Date.now() : 0,
      }

      if (subConflicted) {
        subPkg.state = 'conflict'
      }

      parentInternalPkg.children.push(subId)
      pkg.internalPackages.set(subId, subPkg)
      pkg.internalWires.set(subWire.id, subWire)

      pkg.size += subSize
      gameState.resources.weight += subSize
    }
  }

  recalculateInternalState(packageId)
}

/**
 * Check if a package identity conflicts with any existing internal packages
 */
function checkInternalIncompatibility(
  identity: ReturnType<typeof pickRandomIdentity> | undefined,
  internalPackages: Map<string, Package>
): boolean {
  if (!identity) return false

  for (const innerPkg of internalPackages.values()) {
    if (innerPkg.identity) {
      if (areIncompatible(identity.name, innerPkg.identity.name)) {
        return true
      }
    }
  }
  return false
}

// Callback for stable celebration
let onStableCelebration: ((packageId: string) => void) | null = null

export function setStableCelebrationCallback(
  callback: (packageId: string) => void
): void {
  onStableCelebration = callback
}

/**
 * Recalculate internal state for a package at any path
 * Works for top-level packages (path length 1) or nested packages (path length 2+)
 */
export function recalculateStateAtPath(scopePath: string[]): void {
  if (scopePath.length === 0) return

  const pkg = getPackageAtPath(scopePath)
  if (!pkg?.internalPackages || !pkg?.internalWires) return

  const previousState = pkg.internalState

  // Check for conflicted wires
  let conflictCount = 0
  for (const wire of pkg.internalWires.values()) {
    if (wire.conflicted) conflictCount++
  }

  // Check for duplicate identities
  const identityCounts = new Map<string, number>()
  for (const innerPkg of pkg.internalPackages.values()) {
    if (innerPkg.identity && !innerPkg.isGhost) {
      const name = innerPkg.identity.name
      identityCounts.set(name, (identityCounts.get(name) || 0) + 1)
    }
  }
  let duplicateCount = 0
  for (const count of identityCounts.values()) {
    if (count > 1) duplicateCount += count - 1
  }

  // Check for unstable compressed internal deps (propagation from deeper levels)
  let unstableCompressedCount = 0
  for (const innerPkg of pkg.internalPackages.values()) {
    // Compressed packages have internal maps
    if (innerPkg.internalPackages && innerPkg.internalWires) {
      // If compressed dep hasn't been entered yet (pristine), count as stable
      // If it's been entered and explored, check its state
      if (
        innerPkg.internalState !== null &&
        innerPkg.internalState !== 'stable'
      ) {
        unstableCompressedCount++
      }
    }
  }

  let newState: InternalState
  if (
    conflictCount === 0 &&
    duplicateCount === 0 &&
    unstableCompressedCount === 0
  ) {
    newState = 'stable'
  } else {
    newState = 'unstable'
  }

  pkg.internalState = newState

  // Trigger celebration callback for top-level packages
  if (
    scopePath.length === 1 &&
    previousState !== 'stable' &&
    newState === 'stable' &&
    onStableCelebration
  ) {
    onStableCelebration(scopePath[0]!)
  }

  // Propagate state change up the tree
  // If this package became stable/unstable, parent may need recalculation
  if (scopePath.length > 1 && previousState !== newState) {
    recalculateStateAtPath(scopePath.slice(0, -1))
  }
}

/**
 * Legacy wrapper for top-level package state recalculation
 */
export function recalculateInternalState(packageId: string): void {
  recalculateStateAtPath([packageId])
}

/**
 * Handle cascade completion - recalculate state for the scope and propagate up
 */
function handleCascadeEnd(scopePath: string[]): void {
  recalculateStateAtPath(scopePath)
}

// Register callbacks - both now use path-based approach
setRecalculateCallback(recalculateStateAtPath)
setCascadeEndCallback(handleCascadeEnd)
