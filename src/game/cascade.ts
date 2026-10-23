// Cascade system for staggered dependency spawning
// Creates the "explosion inside" experience when entering packages
// Supports arbitrary depth using scope paths

import { gameState, generateId, stack } from './state'
import { random, shuffle, chance, type Graph } from '@open-loop/engine'
import {
  carriesFragment,
  getIdentitySize,
  rollGolden,
  rollScopeDepCount,
  rollSubDepCount,
  spawnedSize,
} from './formulas'
import {
  CASCADE_CRIT_CHANCE,
  MAX_PENDING_DEPS,
  MAX_SAME_IDENTITY_PER_SCOPE,
  MIN_DUPLICATE_PAIRS_PER_SCOPE,
} from './config'
import { boardWeightScale, plannedChildren } from './board'
import { addWeight, attachNodeToScope } from './mutations'
import { type Package, type Wire, type PendingSpawn } from './types'
import { recordCascadeSize } from './achievements'
import {
  pickRandomIdentity,
  areIncompatible,
  STARTER_KIT_INTERNAL_DEPS,
  SECOND_PACKAGE_INTERNAL_DEPS,
  THIRD_PACKAGE_INTERNAL_DEPS,
  REACT_DOM_INTERNAL_DEPS,
  type PackageIdentity,
  getConflictingNames,
  wouldConflictWithAny,
  pickDistinctDuplicateIdentities,
} from './registry'
import { getGraphAtPath, getPackageAtPath } from './scope'
import { emit } from './events'

// Constants for cascade behavior
const BASE_SPAWN_INTERVAL = 120
const MIN_SPAWN_INTERVAL = 40
const SPAWN_INTERVAL_DECAY = 0.92
const SPAWN_INTERVAL_JITTER = 0.15
const SPAWN_INTERVAL_SPEEDUP = 0.85

const STARTER_KIT_SPAWN_INTERVAL = 350
const STARTER_KIT_MIN_INTERVAL = 200
const STARTER_KIT_DECAY = 0.96
const STARTER_KIT_BREATH_DURATION = 800

const SECOND_PKG_SPAWN_INTERVAL = 250
const SECOND_PKG_MIN_INTERVAL = 120
const SECOND_PKG_DECAY = 0.94

const THIRD_PKG_SPAWN_INTERVAL = 200
const THIRD_PKG_MIN_INTERVAL = 80
const THIRD_PKG_DECAY = 0.93

let cascadeQueue: string[][] = []

export function isCascadeActive(): boolean {
  return gameState.cascade.active
}

/**
 * Start a cascade at any depth.
 * @param scopePath Path to the package whose internals should cascade.
 */
export function startCascade(scopePath: string[]): void {
  if (scopePath.length === 0) return

  const pkg = getPackageAtPath(scopePath)
  if (!pkg) return
  const scopeGraph = getGraphAtPath(scopePath)
  if (!scopeGraph) return
  const ownerId = scopePath[scopePath.length - 1]!
  // Already populated (only the shadow lives in a pristine graph).
  if (scopeGraph.nodes.size > 1) return

  if (gameState.cascade.active) {
    cascadeQueue.push([...scopePath])
    return
  }

  startCascadeImmediate(scopePath, pkg, scopeGraph, ownerId)
}

function startCascadeImmediate(
  scopePath: string[],
  pkg: Package,
  scopeGraph: Graph<Package, Wire>,
  scopePackageId: string
): void {
  const depth = scopePath.length
  const isStarterKit = pkg.identity?.name === 'starter-kit'
  const isSecondPackage = pkg.identity?.name === 'express'
  const isThirdPackage = pkg.identity?.name === 'react'
  const isReactDom = pkg.identity?.name === 'react-dom'

  const isCurated =
    isStarterKit || isSecondPackage || isThirdPackage || isReactDom
  const depIdentities: PackageIdentity[] = isStarterKit
    ? [...STARTER_KIT_INTERNAL_DEPS]
    : isSecondPackage
      ? [...SECOND_PACKAGE_INTERNAL_DEPS]
      : isThirdPackage
        ? [...THIRD_PACKAGE_INTERNAL_DEPS]
        : isReactDom
          ? [...REACT_DOM_INTERNAL_DEPS]
          : []

  if (!isCurated) {
    const hasGuaranteedCrit = gameState.cascade.guaranteedCrits > 0
    const crit = hasGuaranteedCrit || chance(CASCADE_CRIT_CHANCE)
    const count = rollScopeDepCount(pkg.identity, depth, crit)
    if (crit) {
      if (hasGuaranteedCrit) {
        gameState.cascade.guaranteedCrits--
      }
      emit('cascade:crit', { count })
    }

    const identityCounts = new Map<string, number>()
    const conflictingIdentityNames = new Set<string>()

    const guaranteedDupes = pickDistinctDuplicateIdentities(
      MIN_DUPLICATE_PAIRS_PER_SCOPE
    )
    for (const identity of guaranteedDupes) {
      depIdentities.push(identity, identity)
      identityCounts.set(identity.name, 2)
    }

    let attempts = 0
    const maxAttempts = (count - depIdentities.length) * 10

    while (depIdentities.length < count && attempts < maxAttempts) {
      attempts++
      const candidate = pickRandomIdentity()

      const currentCount = identityCounts.get(candidate.name) ?? 0
      if (currentCount >= MAX_SAME_IDENTITY_PER_SCOPE) {
        continue
      }

      if (wouldConflictWithAny(candidate, conflictingIdentityNames)) {
        if (currentCount > 0) {
          continue
        }
      }

      depIdentities.push(candidate)
      identityCounts.set(candidate.name, currentCount + 1)

      const conflictsWithThis = getConflictingNames(candidate.name)
      for (const conflictName of conflictsWithThis) {
        if (identityCounts.has(conflictName)) {
          conflictingIdentityNames.add(candidate.name)
          conflictingIdentityNames.add(conflictName)
        }
      }
    }

    const shuffledIdentities = shuffle(depIdentities)
    depIdentities.length = 0
    depIdentities.push(...shuffledIdentities)
  }

  // The board plan says how many of this scope's deps are scopes of their own; which
  // deps they are is the run's roll. Each maps to its child slot in the plan.
  const compressedSlots = new Map<number, number>()
  const planned = plannedChildren(pkg.planPath)
  const indices = shuffle(depIdentities.map((_, i) => i))
  for (let slot = 0; slot < Math.min(planned, indices.length); slot++) {
    compressedSlots.set(indices[slot]!, slot)
  }

  const pendingSpawns: PendingSpawn[] = []
  const count = depIdentities.length
  const distance = depth === 1 ? 80 : 60

  for (let i = 0; i < count; i++) {
    const baseAngle = (Math.PI * 2 * i) / count - Math.PI / 2
    const angle = baseAngle + (random() - 0.5) * 0.2
    const dist = distance + random() * (distance * 0.5)
    const identity = depIdentities[i]!

    pendingSpawns.push({
      packageId: scopePackageId,
      identity,
      position: {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
      },
      velocity: {
        vx: Math.cos(angle) * 2,
        vy: Math.sin(angle) * 2,
      },
      size: getIdentitySize(identity),
      depth: 1,
      parentInternalId: null,
      isSubDep: false,
    })
  }

  const subDepPlaceholders: Array<{
    parentIndex: number
    identity: PackageIdentity
  }> = []
  if (!isCurated) {
    for (let i = 0; i < count; i++) {
      if (compressedSlots.has(i)) continue
      for (let j = rollSubDepCount(); j > 0; j--) {
        subDepPlaceholders.push({
          parentIndex: i,
          identity: pickRandomIdentity(),
        })
      }
    }
  }

  const cascade = gameState.cascade
  cascade.scopePath = [...scopePath]
  cascade.subDepQueue = subDepPlaceholders
  cascade.compressedSlots = compressedSlots

  cascade.isStarterKit = isStarterKit
  cascade.isSecondPackage = isSecondPackage
  cascade.isThirdPackage = isThirdPackage
  cascade.isReactDom = isReactDom
  cascade.deferConflicts = isStarterKit
  cascade.breathPhase = false
  cascade.breathStartTime = 0

  cascade.active = true
  cascade.scopePackageId = scopePackageId
  gameState.cascade.pendingSpawns = pendingSpawns
  gameState.cascade.lastSpawnTime = Date.now()

  if (isStarterKit) {
    gameState.cascade.spawnInterval = STARTER_KIT_SPAWN_INTERVAL
  } else if (isSecondPackage) {
    gameState.cascade.spawnInterval = SECOND_PKG_SPAWN_INTERVAL
  } else if (isThirdPackage || isReactDom) {
    gameState.cascade.spawnInterval = THIRD_PKG_SPAWN_INTERVAL
  } else {
    gameState.cascade.spawnInterval = Math.floor(
      BASE_SPAWN_INTERVAL * Math.pow(SPAWN_INTERVAL_SPEEDUP, depth - 1)
    )
  }

  // Spawns attach through attachNodeToScope as the queue drains.
  void scopeGraph
}

export function updateCascade(): void {
  if (!gameState.cascade.active) return

  const cascade = gameState.cascade
  const now = Date.now()

  if (cascade.breathPhase) {
    const breathElapsed = now - cascade.breathStartTime
    if (breathElapsed >= STARTER_KIT_BREATH_DURATION) {
      revealDeferredConflicts()
      endCascade()
    }
    return
  }

  const elapsed = now - cascade.lastSpawnTime

  const jitter = 1 + (random() - 0.5) * 2 * SPAWN_INTERVAL_JITTER
  const effectiveInterval = cascade.spawnInterval * jitter

  if (elapsed >= effectiveInterval) {
    spawnNextFromQueue()
    cascade.lastSpawnTime = now

    const minInterval = cascade.isStarterKit
      ? STARTER_KIT_MIN_INTERVAL
      : cascade.isSecondPackage
        ? SECOND_PKG_MIN_INTERVAL
        : cascade.isThirdPackage || cascade.isReactDom
          ? THIRD_PKG_MIN_INTERVAL
          : MIN_SPAWN_INTERVAL
    const decay = cascade.isStarterKit
      ? STARTER_KIT_DECAY
      : cascade.isSecondPackage
        ? SECOND_PKG_DECAY
        : cascade.isThirdPackage || cascade.isReactDom
          ? THIRD_PKG_DECAY
          : SPAWN_INTERVAL_DECAY
    cascade.spawnInterval = Math.max(minInterval, cascade.spawnInterval * decay)
  }
}

function spawnNextFromQueue(): void {
  const cascade = gameState.cascade

  const scopePath = cascade.scopePath
  if (!scopePath || scopePath.length === 0) {
    endCascade()
    return
  }

  const scopePackageId = scopePath[scopePath.length - 1]
  if (!scopePackageId) {
    endCascade()
    return
  }

  const targetPkg = getPackageAtPath(scopePath)
  if (!targetPkg) {
    endCascade()
    return
  }

  const scopeGraph = getGraphAtPath(scopePath)
  if (!scopeGraph) {
    endCascade()
    return
  }

  // Spawn index = inner package count (excluding the shadow scope-owner).
  const spawnIndex = scopeGraph.nodes.size - 1

  const spawn = cascade.pendingSpawns[0]
  if (!spawn) {
    if (cascade.subDepQueue && cascade.subDepQueue.length > 0) {
      // Internal pkg ids in spawn order: iterate scopeGraph nodes minus
      // owner. Insertion order is preserved by Map.
      const internalPkgIds: string[] = []
      for (const id of scopeGraph.nodes.keys()) {
        if (id !== scopePackageId) internalPkgIds.push(id)
      }

      for (const subDep of cascade.subDepQueue) {
        const parentId = internalPkgIds[subDep.parentIndex]
        if (!parentId) continue

        const parentPkg = scopeGraph.getNode(parentId)?.data
        if (!parentPkg || parentPkg.depth >= 2) continue

        const parentAngle = Math.atan2(
          parentPkg.position.y,
          parentPkg.position.x
        )
        const subAngle = parentAngle + (random() - 0.5) * 0.5
        const subDistance =
          Math.sqrt(parentPkg.position.x ** 2 + parentPkg.position.y ** 2) +
          50 +
          random() * 30

        cascade.pendingSpawns.push({
          packageId: scopePackageId,
          identity: subDep.identity,
          position: {
            x: Math.cos(subAngle) * subDistance,
            y: Math.sin(subAngle) * subDistance,
          },
          velocity: {
            vx: Math.cos(subAngle) * 1.5,
            vy: Math.sin(subAngle) * 1.5,
          },
          size: getIdentitySize(subDep.identity, 5),
          depth: 2,
          parentInternalId: parentId,
          isSubDep: true,
        })
      }

      cascade.subDepQueue = []

      if (cascade.pendingSpawns.length > 0) {
        return
      }
    }

    if (cascade.deferConflicts && !cascade.breathPhase) {
      cascade.breathPhase = true
      cascade.breathStartTime = Date.now()
      return
    }

    endCascade()
    return
  }

  cascade.pendingSpawns.shift()

  if (cascade.pendingSpawns.length > MAX_PENDING_DEPS) {
    cascade.pendingSpawns.length = MAX_PENDING_DEPS
  }

  const depth = scopePath.length
  const planSlot = spawn.isSubDep
    ? undefined
    : cascade.compressedSlots?.get(spawnIndex)
  const isCompressed = planSlot !== undefined

  const id = generateId()
  const identity = spawn.identity as PackageIdentity

  const effectiveDepth = depth + spawn.depth

  const isGolden = rollGolden(effectiveDepth, gameState.board.tier)
  const hasCacheFragment = carriesFragment(identity, isGolden)
  const finalSize = Math.round(
    spawnedSize(spawn.size, effectiveDepth, isGolden) * boardWeightScale()
  )

  if (isGolden) {
    gameState.stats.goldenPackagesFound++
  }

  const innerPkg: Package = {
    id,
    position: spawn.position,
    velocity: spawn.velocity,
    state: 'installing',
    size: finalSize,
    depth: spawn.depth,
    installProgress: 0.7 + random() * 0.3,
    conflictProgress: 0,
    identity,
    isGhost: false,
    ghostTargetId: null,
    ghostTargetScope: null,
    isGolden,
    hasCacheFragment,
    planPath: isCompressed ? [...(targetPkg.planPath ?? []), planSlot] : null,
  }

  const parentInScopeId = spawn.parentInternalId || spawn.packageId

  // Conflict against existing nodes in this scope (excluding the shadow).
  const shouldCheckConflicts = !cascade.deferConflicts
  const isConflicted =
    shouldCheckConflicts &&
    checkInternalIncompatibility(identity, scopeGraph, scopePackageId)

  // Attach the inner package + dep edge through the canonical primitive,
  // which owns add-node + add-edge + ensure-child + seed-cache. Cascade
  // layers its own behaviors (state-on-conflict, scope-owner accumulation,
  // global weight, spawn-effect emit) on top.
  attachNodeToScope(
    scopePath,
    innerPkg,
    parentInScopeId,
    isCompressed,
    isConflicted
  )

  if (isConflicted) {
    innerPkg.state = 'conflict'
    if (!gameState.onboarding.firstConflictSeen) {
      gameState.onboarding.firstConflictSeen = true
    }
  }

  // Update the scope owner's accumulated weight (for visual size) and the run's weight.
  targetPkg.size += finalSize
  addWeight(finalSize)

  if (isViewingCascadeScope()) {
    emit('cascade:spawn-effect', {
      position: spawn.position,
      isConflict: isConflicted,
    })
  }
}

export function isViewingCascadeScope(): boolean {
  const scopePath = gameState.cascade.scopePath
  if (!scopePath) return false

  const viewStack = stack.path
  if (viewStack.length !== scopePath.length) return false

  for (let i = 0; i < viewStack.length; i++) {
    if (viewStack[i] !== scopePath[i]) return false
  }
  return true
}

function checkInternalIncompatibility(
  identity: PackageIdentity | undefined,
  scopeGraph: Graph<Package, Wire>,
  ownerId: string
): boolean {
  if (!identity) return false

  for (const [id, node] of scopeGraph.nodes) {
    if (id === ownerId) continue
    if (node.data.identity) {
      if (areIncompatible(identity.name, node.data.identity.name)) {
        return true
      }
    }
  }
  return false
}

function revealDeferredConflicts(): void {
  const cascade = gameState.cascade
  const scopePath = cascade.scopePath
  if (!scopePath || scopePath.length === 0) return

  const scopeGraph = getGraphAtPath(scopePath)
  if (!scopeGraph) return
  const ownerId = scopePath[scopePath.length - 1]!
  const now = Date.now()
  let dirty = false

  for (const [id, node] of scopeGraph.nodes) {
    if (id === ownerId) continue
    const pkg = node.data
    if (!pkg.identity) continue

    const isConflicted = checkInternalIncompatibility(
      pkg.identity,
      scopeGraph,
      ownerId
    )
    if (!isConflicted) continue

    for (const edge of scopeGraph.edges.values()) {
      if (edge.toId === pkg.id && !edge.data.conflicted) {
        edge.data.conflicted = true
        edge.data.conflictTime = now
        pkg.state = 'conflict'
        dirty = true

        if (!gameState.onboarding.firstConflictSeen) {
          gameState.onboarding.firstConflictSeen = true
        }
        break
      }
    }
  }

  // Recalc immediately rather than waiting for the cascade:end recalc one
  // tick later — without this, scope state stays 'pristine' for a frame
  // while wires are visibly conflicted.
  if (dirty) stack.recalculateAt(scopePath)
}

function endCascade(): void {
  const cascade = gameState.cascade
  const scopePath = cascade.scopePath ? [...cascade.scopePath] : []

  if (cascade.scopePackageId) {
    const scopeGraph = getGraphAtPath(scopePath)
    if (scopeGraph) {
      // Count inner packages excluding the shadow scope-owner.
      recordCascadeSize(Math.max(0, scopeGraph.nodes.size - 1))
    }
  }

  cascade.active = false
  cascade.scopePackageId = null
  cascade.pendingSpawns = []
  cascade.scopePath = null
  cascade.subDepQueue = null
  cascade.compressedSlots = null
  cascade.isStarterKit = false
  cascade.isSecondPackage = false
  cascade.isThirdPackage = false
  cascade.isReactDom = false
  cascade.deferConflicts = false
  cascade.breathPhase = false
  cascade.breathStartTime = 0

  if (scopePath.length > 0) {
    emit('cascade:end', { scopePath })
  }

  if (cascadeQueue.length > 0) {
    const nextPath = cascadeQueue.shift()!
    const nextPkg = getPackageAtPath(nextPath)
    const nextGraph = getGraphAtPath(nextPath)
    if (nextPkg && nextGraph && nextGraph.nodes.size <= 1) {
      const ownerId = nextPath[nextPath.length - 1]!
      startCascadeImmediate(nextPath, nextPkg, nextGraph, ownerId)
    }
  }
}

export function cancelCascade(): void {
  if (gameState.cascade.active) {
    endCascade()
  }
}

export function getCascadeScopePath(): string[] {
  return gameState.cascade.scopePath ? [...gameState.cascade.scopePath] : []
}

export function clearCascadeQueue(): void {
  cascadeQueue = []
}
