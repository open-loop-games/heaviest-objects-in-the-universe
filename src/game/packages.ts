// Package creation and management logic

import { random } from '@open-loop/engine'
import { gameState, graph, rootIdRef, stack } from './state'
import { _injectCascade } from './scope'
import { addRootPackage, addTopLevelPackage } from './mutations'
import { generateId } from './state'
import type { Package } from './types'
import { getIdentitySize } from './formulas'
import {
  pickDirectInstallIdentity,
  STARTER_KIT_IDENTITY,
  SECOND_PACKAGE_IDENTITY,
  THIRD_PACKAGE_IDENTITY,
  type PackageIdentity,
} from './registry'
import { markDuplicateGroupsDirty } from './symlinks'
import { boardWeightScale, topLevelRemaining } from './board'
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
    planPath: null,
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

  // A finite board: the root installs its tier's top-level deps, then no more.
  if (topLevelRemaining() <= 0) return null

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

  emit('player:action')

  if (!gameState.onboarding.firstClickComplete) {
    gameState.onboarding.firstClickComplete = true
  }

  const id = generateId()
  const angle = random() * Math.PI * 2
  const distance = 80 + random() * 40

  // Curated first three installs: starter-kit → express → react. Each install takes the
  // next top-level slot of the board plan.
  const topLevelCount = gameState.board.topLevelInstalled
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
        : pickDirectInstallIdentity(gameState.board.tier, existingTopLevel)

  const size = Math.round(getIdentitySize(identity) * boardWeightScale())

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
    planPath: [topLevelCount],
  }

  gameState.board.topLevelInstalled++
  addTopLevelPackage(pkg, rootId)
  return pkg
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
