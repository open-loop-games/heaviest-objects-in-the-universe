// Package creation and management logic

import { toRaw } from 'vue'
import { gameState, gameConfig, spendBandwidth } from './state'
import { recalculateStateAtPath, _injectCascade } from './scope'
import { addPackage, addWire } from './mutations'
import { generateId, generateWireId } from './id-generator'
import { type Package, type Wire } from './types'
import { rollDependencyCount, getIdentitySize } from './formulas'
import { getEffectiveInstallCost } from './upgrades'
import {
  pickRandomIdentity,
  pickDirectInstallIdentity,
  checkIncompatibilityWithPackages,
  STARTER_KIT_IDENTITY,
  SECOND_PACKAGE_IDENTITY,
  THIRD_PACKAGE_IDENTITY,
  type PackageIdentity,
} from './registry'
import { markDuplicateGroupsDirty } from './symlinks'
import { emit, on } from './events'
import { startCascade } from './cascade'

// Inject cascade dependency to avoid circular imports
_injectCascade(startCascade)

// Re-export ID initialization for save/load
export { initIdCounterFromState } from './id-generator'

// Re-export queries for backwards compatibility
export { findPackageAtPosition, getInternalStats } from './queries'

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
    // Depth rewards (root doesn't get rewards)
    isGolden: false,
    hasCacheFragment: false,
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
  if (gameState.meta.timesShipped === 0 && parentId === gameState.rootId) {
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

  // Reset ghost hand hint timers on meaningful player action
  emit('player:action')

  // Mark first click complete for onboarding
  if (!gameState.onboarding.firstClickComplete) {
    gameState.onboarding.firstClickComplete = true
  }

  const id = generateId()
  const angle = Math.random() * Math.PI * 2
  const distance = 80 + Math.random() * 40

  // First three installs before prestige: use curated packages for teaching
  // - First: starter-kit (basic mechanics)
  // - Second: express (3-way duplicates)
  // - Third: react (nested scopes)
  const isFirstInstall =
    gameState.meta.timesShipped === 0 &&
    parentId === gameState.rootId &&
    parent.children.length === 0

  const isSecondInstall =
    gameState.meta.timesShipped === 0 &&
    parentId === gameState.rootId &&
    parent.children.length === 1

  const isThirdInstall =
    gameState.meta.timesShipped === 0 &&
    parentId === gameState.rootId &&
    parent.children.length === 2

  // Gather existing top-level package names to ensure variety
  const existingTopLevel = new Set<string>()
  if (parentId === gameState.rootId) {
    for (const childId of parent.children) {
      const child = gameState.packages.get(childId)
      if (child?.identity?.name) {
        existingTopLevel.add(child.identity.name)
      }
    }
  }

  // Pick a package identity based on ecosystem tier (excluding already-installed at root)
  const identity = isFirstInstall
    ? STARTER_KIT_IDENTITY
    : isSecondInstall
      ? SECOND_PACKAGE_IDENTITY
      : isThirdInstall
        ? THIRD_PACKAGE_IDENTITY
        : pickDirectInstallIdentity(
            gameState.meta.ecosystemTier,
            existingTopLevel
          )

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
    // Depth rewards (top-level doesn't get rewards - depth 1)
    isGolden: false,
    hasCacheFragment: false,
  }

  // Add wire connecting parent to child
  const wire: Wire = {
    id: generateWireId(),
    fromId: parentId,
    toId: id,
    wireType: 'dependency',
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
  if (gameState.meta.timesShipped === 0) {
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
      // Depth rewards (root-level spawn - no rewards)
      isGolden: false,
      hasCacheFragment: false,
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
// EVENT SUBSCRIPTIONS
// ============================================

// Subscribe to cascade end events
on('cascade:end', ({ scopePath }) => {
  recalculateStateAtPath(scopePath)
  markDuplicateGroupsDirty()
})

// Subscribe to scope recalculation requests
on('scope:recalculate', ({ scopePath }) => {
  recalculateStateAtPath(scopePath)
})

// Subscribe to package changes (for duplicate detection)
on('packages:changed', () => {
  markDuplicateGroupsDirty()
})
