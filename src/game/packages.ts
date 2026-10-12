// Package creation and management logic

import { random, randomInt } from '@open-loop/engine'
import {
  gameState,
  gameConfig,
  graph,
  rootIdRef,
  spendBandwidth,
  stack,
} from './state'
import {
  getCurrentScopePackages,
  isTopLevelPackage,
  _injectCascade,
} from './scope'
import {
  addInnerPackage,
  addRootPackage,
  addTopLevelPackage,
} from './mutations'
import { generateId } from './state'
import type { Package } from './types'
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
import { recalculateStateAtPath } from './scope'

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
 * Create the root package (first package in the tree).
 */
export function createRootPackage(): Package | null {
  if (rootIdRef.value !== null) {
    return null // Root already exists
  }

  const id = generateId()
  const pkg: Package = {
    id,
    position: { x: 0, y: 0 },
    velocity: { vx: 0, vy: 0 },
    state: 'ready',
    size: 100,
    depth: 0,
    installProgress: 1,
    conflictProgress: 0,
    identity: ROOT_IDENTITY,
    isGhost: false,
    ghostTargetId: null,
    ghostTargetScope: null,
    isGolden: false,
    hasCacheFragment: false,
  }

  addRootPackage(pkg)
  rootIdRef.value = id
  return pkg
}

/**
 * Attempt to install a new package as a top-level child of the root.
 * Tutorial-gated before first prestige.
 */
export function installPackage(parentId: string): Package | null {
  const rootId = rootIdRef.value
  if (!rootId || parentId !== rootId) return null

  const parent = graph.getNode(rootId)?.data
  if (!parent) return null

  // Tutorial gating: before first prestige, must stabilize previous package
  // before installing the next one.
  if (gameState.meta.timesShipped === 0) {
    for (const id of graph.nodes.keys()) {
      if (id === rootId) continue
      const state = stack.statusAt([id])
      if (state !== undefined && state !== 'stable') {
        return null
      }
    }
  }

  const cost = getEffectiveInstallCost()
  if (!spendBandwidth(cost)) {
    return null
  }

  emit('player:action')

  if (!gameState.onboarding.firstClickComplete) {
    gameState.onboarding.firstClickComplete = true
  }

  const id = generateId()
  const angle = random() * Math.PI * 2
  const distance = 80 + random() * 40

  // Curated first three installs: starter-kit → express → react.
  // Counted by current top-level package count (excluding root).
  const topLevelCount = graph.nodes.size - 1
  const isFirstInstall =
    gameState.meta.timesShipped === 0 && topLevelCount === 0
  const isSecondInstall =
    gameState.meta.timesShipped === 0 && topLevelCount === 1
  const isThirdInstall =
    gameState.meta.timesShipped === 0 && topLevelCount === 2

  const existingTopLevel = new Set<string>()
  for (const [nodeId, node] of graph.nodes) {
    if (nodeId === rootId) continue
    if (node.data.identity?.name) {
      existingTopLevel.add(node.data.identity.name)
    }
  }

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

  const size = getIdentitySize(identity)

  const pkg: Package = {
    id,
    position: {
      x: parent.position.x + Math.cos(angle) * distance,
      y: parent.position.y + Math.sin(angle) * distance,
    },
    velocity: { vx: 0, vy: 0 },
    state: 'installing',
    size,
    depth: parent.depth + 1,
    installProgress: 0,
    conflictProgress: 0,
    identity,
    isGhost: false,
    ghostTargetId: null,
    ghostTargetScope: null,
    isGolden: false,
    hasCacheFragment: false,
  }

  addTopLevelPackage(pkg, rootId)
  return pkg
}

/**
 * Spawn dependencies for a top-level package or sub-dep that just finished
 * installing. Top-level packages don't spawn at root scope (they're
 * compressed seeds — cascade fires on enter). Inner deps spawned in
 * cascade may grow sub-trees here.
 */
export function spawnDependencies(packageId: string): Package[] {
  // Top-level packages: compressed seed, no cascade until entered.
  if (isTopLevelPackage(packageId)) return []

  const scopePackages = getCurrentScopePackages()
  const pkg = scopePackages.get(packageId)
  if (!pkg) return []

  if (pkg.depth >= gameConfig.dependencyDepthLimit) {
    return []
  }

  let count: number
  if (pkg.identity && pkg.identity.baseDeps > 0) {
    const variance = randomInt(-1, 1)
    count = Math.max(0, pkg.identity.baseDeps + variance)
  } else {
    count = rollDependencyCount(gameConfig)
  }

  if (gameState.meta.timesShipped === 0) {
    const packageCount = scopePackages.size
    if (packageCount < 10) {
      count = Math.min(count, 2)
    } else if (packageCount < 30) {
      count = Math.min(count, 3)
    } else if (packageCount < 60) {
      count = Math.min(count, 4)
    }
  }

  const spawned: Package[] = []
  const scopePath: string[] = [...stack.path]
  const scopeGraph = stack.current

  const resolvers = {
    getIdentity: (id: string): PackageIdentity | undefined => {
      return scopeGraph.getNode(id)?.data.identity
    },
    getParentId: (id: string): string | null => {
      if (!scopeGraph.getNode(id)) return null
      for (const edge of scopeGraph.edgesOf(id)) {
        if (edge.toId === id && edge.data.wireType === 'dependency') {
          return edge.fromId
        }
      }
      return null
    },
  }

  for (let i = 0; i < count; i++) {
    const spreadAngle = Math.PI * 0.7
    const startAngle = Math.PI * 0.5 - spreadAngle / 2
    const baseAngle =
      count > 1 ? startAngle + (spreadAngle * i) / (count - 1) : Math.PI * 0.5
    const angle = baseAngle + (random() - 0.5) * 0.3
    const distance = 80 + random() * 40

    const id = generateId()
    const identity = pickRandomIdentity()
    const size = getIdentitySize(identity)

    const child: Package = {
      id,
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
      installProgress: 0,
      conflictProgress: 0,
      identity,
      isGhost: false,
      ghostTargetId: null,
      ghostTargetScope: null,
      isGolden: false,
      hasCacheFragment: false,
    }

    const isConflicted = checkIncompatibilityWithPackages(
      identity,
      packageId,
      resolvers
    )
    if (isConflicted) {
      child.state = 'conflict'
      if (!gameState.onboarding.firstConflictSeen) {
        gameState.onboarding.firstConflictSeen = true
      }
    }

    addInnerPackage(scopePath, child, packageId, false, isConflicted)
    spawned.push(child)
  }

  return spawned
}

// ============================================
// EVENT SUBSCRIPTIONS
// ============================================

on('cascade:end', ({ scopePath }) => {
  recalculateStateAtPath(scopePath)
  markDuplicateGroupsDirty()
})

on('scope:recalculate', ({ scopePath }) => {
  recalculateStateAtPath(scopePath)
})

on('packages:changed', () => {
  markDuplicateGroupsDirty()
})
