// Cascade system for staggered dependency spawning
// Creates the "explosion inside" experience when entering packages
// Supports arbitrary depth using scope paths

import { gameState } from './state'
import { getCompressionChance, getMaxCompressedDepth } from './formulas'
import { setCascadeStarved } from './ui-state'
import {
  MAX_PENDING_DEPS,
  MAX_COMPRESSED_PER_SCOPE,
  GOLDEN_SPAWN_CHANCE,
  GOLDEN_WEIGHT_MULTIPLIER,
  GOLDEN_MIN_DEPTH,
  CACHE_FRAGMENT_CHANCE,
  CACHE_FRAGMENT_MIN_DEPTH,
  DEPTH_WEIGHT_MULTIPLIERS,
} from './config'
import { addWeight, onGoldenSpawned, onFragmentCollected } from './mutations'
import { generateId, generateWireId } from './id-generator'
import {
  type Package,
  type Wire,
  type PendingSpawn,
  type InternalState,
} from './types'
import {
  pickRandomIdentity,
  areIncompatible,
  STARTER_KIT_INTERNAL_DEPS,
  type PackageIdentity,
} from './registry'
import { getPackageAtPath } from './scope'
import { getIdentitySize } from './formulas'
import { consumeSurge, isSurgeUnlocked } from './surge'
import { emit } from './events'

// Constants for cascade behavior
const BASE_SPAWN_INTERVAL = 120 // Initial ms between spawns
const MIN_SPAWN_INTERVAL = 40 // Minimum interval (maximum speed)
const SPAWN_INTERVAL_DECAY = 0.92 // Each spawn gets slightly faster (accelerating cascade)
const SPAWN_INTERVAL_JITTER = 0.15 // Random variation (+/- 15%)
const SPAWN_INTERVAL_SPEEDUP = 0.85 // Deeper layers spawn faster (base multiplier per depth)

// Note: COMPRESSED_CHANCE and MAX_COMPRESSED_DEPTH are now dynamic
// Use getCompressionChance(depth) and getMaxCompressedDepth() from state.ts

// Queue for pending cascades (FIFO - first entered scope gets completed first)
let cascadeQueue: string[][] = []

/**
 * Check if cascade is currently active
 */
export function isCascadeActive(): boolean {
  return gameState.cascade.active
}

/**
 * Start a cascade at any depth
 * @param scopePath Path to the package whose internals should cascade
 */
export function startCascade(scopePath: string[]): void {
  if (scopePath.length === 0) return // Can't cascade at root

  const pkg = getPackageAtPath(scopePath)
  if (!pkg) return
  if (!pkg.internalPackages || !pkg.internalWires) return
  if (pkg.internalPackages.size > 0) return // Already spawned

  // If a cascade is already running, queue this one for later (FIFO)
  if (gameState.cascade.active) {
    cascadeQueue.push([...scopePath])
    return
  }

  startCascadeImmediate(scopePath, pkg)
}

/**
 * Internal: Actually start the cascade (called when no other cascade is active)
 */
function startCascadeImmediate(scopePath: string[], pkg: Package): void {
  if (!pkg.internalPackages || !pkg.internalWires) return
  if (scopePath.length === 0) return // Defensive check

  // Extract scope package ID safely
  const scopePackageId = scopePath[scopePath.length - 1]
  if (!scopePackageId) return

  const depth = scopePath.length
  const isStarterKit = pkg.identity?.name === 'starter-kit'

  // Consume surge boost if available (only at depth 1, unlocked after P2)
  let surgeBoost = { sizeMultiplier: 1, goldenBoost: 0, fragmentBoost: 0 }
  if (depth === 1 && isSurgeUnlocked()) {
    surgeBoost = consumeSurge()
  }

  // Build list of identities to spawn
  const depIdentities: PackageIdentity[] = isStarterKit
    ? [...STARTER_KIT_INTERNAL_DEPS]
    : []

  if (!isStarterKit) {
    let count: number
    if (pkg.identity && pkg.identity.baseDeps > 0) {
      const variance = Math.floor(Math.random() * 5) - 2
      count = Math.max(4, pkg.identity.baseDeps + variance)
    } else {
      // Fewer deps at deeper levels
      const baseCount = depth === 1 ? 8 : 6
      const variance = depth === 1 ? 8 : 4
      count = baseCount + Math.floor(Math.random() * variance)
    }
    // Check for guaranteed crit from inner scope merges, otherwise 5% random crit
    const hasGuaranteedCrit = gameState.cascade.guaranteedCrits > 0
    if (hasGuaranteedCrit || Math.random() < 0.05) {
      count *= 2
      if (hasGuaranteedCrit) {
        gameState.cascade.guaranteedCrits--
      }
      emit('cascade:crit', { count })
    }

    // Apply surge size multiplier
    count = Math.floor(count * surgeBoost.sizeMultiplier)

    count = Math.min(count, 40)
    count = Math.max(count, 3)

    for (let i = 0; i < count; i++) {
      depIdentities.push(pickRandomIdentity())
    }
  }

  // Decide which deps will be compressed (can go deeper)
  // Max depth is determined by ecosystem tier (from cache tokens)
  const cacheTokens = gameState.meta.cacheTokens
  const maxDepth = getMaxCompressedDepth(cacheTokens)
  const compressionChance = getCompressionChance(depth, cacheTokens)

  // Hard cap on compressed packages per scope (tier-gated)
  const tier = gameState.meta.ecosystemTier
  const maxCompressed = MAX_COMPRESSED_PER_SCOPE[tier - 1] ?? 1

  const compressedIndices = new Set<number>()
  if (depth <= maxDepth && compressionChance > 0) {
    for (let i = 0; i < depIdentities.length; i++) {
      // Stop if we've hit the cap
      if (compressedIndices.size >= maxCompressed) break

      const dep = depIdentities[i]
      if (!dep) continue
      // Starter kit: make one specific dep compressed for tutorial
      if (isStarterKit && dep.name === 'express') {
        compressedIndices.add(i)
      } else if (!isStarterKit && Math.random() < compressionChance) {
        compressedIndices.add(i)
      }
    }
  }

  // Prepare pending spawns
  const pendingSpawns: PendingSpawn[] = []
  const count = depIdentities.length
  const distance = depth === 1 ? 80 : 60 // Tighter at deeper levels

  for (let i = 0; i < count; i++) {
    const baseAngle = (Math.PI * 2 * i) / count - Math.PI / 2
    const angle = baseAngle + (Math.random() - 0.5) * 0.2
    const dist = distance + Math.random() * (distance * 0.5)
    const identity = depIdentities[i]!

    pendingSpawns.push({
      packageId: scopePackageId, // Parent is last in path
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
      depth: 1, // Depth within this scope
      parentInternalId: null,
      isSubDep: false,
      awaitingBandwidth: false,
      queuedAt: 0,
    })
  }

  // Prepare sub-deps (only for non-compressed deps)
  const subDepPlaceholders: Array<{
    parentIndex: number
    identity: PackageIdentity
  }> = []
  for (let i = 0; i < count; i++) {
    if (compressedIndices.has(i)) continue // Compressed have their own cascade
    if (Math.random() > 0.4) continue // 40% chance for sub-deps

    const subDepCount = 1 + Math.floor(Math.random() * 2)
    for (let j = 0; j < subDepCount; j++) {
      subDepPlaceholders.push({
        parentIndex: i,
        identity: pickRandomIdentity(),
      })
    }
  }

  // Store cascade data (now properly typed on CascadeState)
  const cascade = gameState.cascade
  cascade.scopePath = [...scopePath]
  cascade.subDepQueue = subDepPlaceholders
  cascade.compressedIndices = compressedIndices
  cascade.surgeGoldenBoost = surgeBoost.goldenBoost
  cascade.surgeFragmentBoost = surgeBoost.fragmentBoost

  // Start the cascade
  cascade.active = true
  cascade.scopePackageId = scopePath[scopePath.length - 1] ?? null
  gameState.cascade.pendingSpawns = pendingSpawns
  gameState.cascade.lastSpawnTime = Date.now()
  // Faster spawns at deeper levels
  gameState.cascade.spawnInterval = Math.floor(
    BASE_SPAWN_INTERVAL * Math.pow(SPAWN_INTERVAL_SPEEDUP, depth - 1)
  )
}

/**
 * Update cascade - spawn next dep if enough time has passed
 */
export function updateCascade(): void {
  if (!gameState.cascade.active) return

  const now = Date.now()
  const elapsed = now - gameState.cascade.lastSpawnTime

  // Add jitter to current interval for organic feel
  const jitter = 1 + (Math.random() - 0.5) * 2 * SPAWN_INTERVAL_JITTER
  const effectiveInterval = gameState.cascade.spawnInterval * jitter

  if (elapsed >= effectiveInterval) {
    spawnNextFromQueue()
    gameState.cascade.lastSpawnTime = now

    // Accelerate for next spawn (cascade gets faster)
    gameState.cascade.spawnInterval = Math.max(
      MIN_SPAWN_INTERVAL,
      gameState.cascade.spawnInterval * SPAWN_INTERVAL_DECAY
    )
  }
}

/**
 * Spawn one dep from the queue
 */
function spawnNextFromQueue(): void {
  const cascade = gameState.cascade

  const scopePath = cascade.scopePath
  if (!scopePath || scopePath.length === 0) {
    endCascade()
    return
  }

  // Extract scope package ID safely (we've validated length > 0 above)
  const scopePackageId = scopePath[scopePath.length - 1]
  if (!scopePackageId) {
    endCascade()
    return
  }

  // Get the package whose internals we're populating
  const targetPkg = getPackageAtPath(scopePath)
  if (!targetPkg) {
    endCascade()
    return
  }

  const targetPackages = targetPkg.internalPackages
  const targetWires = targetPkg.internalWires

  if (!targetPackages || !targetWires) {
    endCascade()
    return
  }

  // Get spawn index before shifting (for compressed check)
  const spawnIndex = targetPackages.size

  // Peek at next spawn (don't remove yet)
  const spawn = cascade.pendingSpawns[0]
  if (!spawn) {
    // Queue empty - check for sub-deps to add
    if (cascade.subDepQueue && cascade.subDepQueue.length > 0) {
      const internalPkgIds = Array.from(targetPackages.keys())

      for (const subDep of cascade.subDepQueue) {
        const parentId = internalPkgIds[subDep.parentIndex]
        if (!parentId) continue

        const parentPkg = targetPackages.get(parentId)
        if (!parentPkg || parentPkg.depth >= 2) continue

        const parentAngle = Math.atan2(
          parentPkg.position.y,
          parentPkg.position.x
        )
        const subAngle = parentAngle + (Math.random() - 0.5) * 0.5
        const subDistance =
          Math.sqrt(parentPkg.position.x ** 2 + parentPkg.position.y ** 2) +
          50 +
          Math.random() * 30

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
          awaitingBandwidth: false,
          queuedAt: 0,
        })
      }

      cascade.subDepQueue = []

      if (cascade.pendingSpawns.length > 0) {
        return
      }
    }

    endCascade()
    return
  }

  // Momentum loop: Cascade spawns are FREE
  // Remove from queue (no bandwidth check needed)
  cascade.pendingSpawns.shift()

  // Clear any legacy awaiting state
  spawn.awaitingBandwidth = false
  spawn.queuedAt = 0
  setCascadeStarved(false)

  // Enforce queue cap
  if (cascade.pendingSpawns.length > MAX_PENDING_DEPS) {
    // Drop oldest items beyond cap
    cascade.pendingSpawns.length = MAX_PENDING_DEPS
  }

  // Check if this dep should be compressed
  const depth = scopePath.length
  const maxDepth = getMaxCompressedDepth(gameState.meta.cacheTokens)
  const isCompressed =
    depth <= maxDepth &&
    !spawn.isSubDep &&
    cascade.compressedIndices?.has(spawnIndex)

  // Create the package
  const id = generateId()
  const identity = spawn.identity as PackageIdentity

  // Calculate effective depth for rewards (scope depth + internal depth)
  const effectiveDepth = depth + spawn.depth

  // Get surge boosts for this cascade
  const surgeGoldenBoost = cascade.surgeGoldenBoost
  const surgeFragmentBoost = cascade.surgeFragmentBoost

  // Roll for golden package (depth 3+ only, boosted by surge)
  const goldenChance = GOLDEN_SPAWN_CHANCE + surgeGoldenBoost
  const isGolden =
    effectiveDepth >= GOLDEN_MIN_DEPTH && Math.random() < goldenChance

  // Roll for cache fragment (depth 2+ only, boosted by surge)
  // Easter egg: break_infinity and break_eternity ALWAYS have fragments
  // (they're the tools of the incremental game trade!)
  const isIncrementalEasterEgg =
    identity?.name === 'break_infinity' || identity?.name === 'break_eternity'
  const fragmentChance = CACHE_FRAGMENT_CHANCE + surgeFragmentBoost
  const hasCacheFragment =
    isIncrementalEasterEgg ||
    (effectiveDepth >= CACHE_FRAGMENT_MIN_DEPTH &&
      Math.random() < fragmentChance)

  // Apply golden weight multiplier and depth weight bonus
  const depthIndex = Math.min(
    effectiveDepth,
    DEPTH_WEIGHT_MULTIPLIERS.length - 1
  )
  const depthMultiplier = DEPTH_WEIGHT_MULTIPLIERS[depthIndex] ?? 1.0
  const goldenMultiplier = isGolden ? GOLDEN_WEIGHT_MULTIPLIER : 1.0
  const finalSize = Math.floor(spawn.size * depthMultiplier * goldenMultiplier)

  // Track golden packages and generate momentum
  if (isGolden) {
    gameState.stats.goldenPackagesFound++
    onGoldenSpawned()
  }

  // Generate momentum for cache fragments
  if (hasCacheFragment) {
    onFragmentCollected()
  }

  const innerPkg: Package = {
    id,
    parentId: spawn.parentInternalId || spawn.packageId,
    position: spawn.position,
    velocity: spawn.velocity,
    state: 'installing',
    size: finalSize,
    depth: spawn.depth,
    children: [],
    installProgress: 0.7 + Math.random() * 0.3,
    conflictProgress: 0,
    identity,
    // Compressed packages have internal maps
    internalPackages: isCompressed ? new Map() : null,
    internalWires: isCompressed ? new Map() : null,
    internalState: isCompressed ? ('pristine' as InternalState) : null,
    isGhost: false,
    ghostTargetId: null,
    ghostTargetScope: null,
    // Depth rewards
    isGolden,
    hasCacheFragment,
  }

  // Check for conflicts
  const isConflicted = checkInternalIncompatibility(identity, targetPackages)

  const wire: Wire = {
    id: generateWireId(),
    fromId: spawn.parentInternalId || spawn.packageId,
    toId: id,
    wireType: 'dependency',
    flowProgress: 0,
    conflicted: isConflicted,
    conflictTime: isConflicted ? Date.now() : 0,
  }

  if (isConflicted) {
    innerPkg.state = 'conflict'
    if (!gameState.onboarding.firstConflictSeen) {
      gameState.onboarding.firstConflictSeen = true
    }
  }

  // If this is a sub-dep, add to parent's children
  if (spawn.parentInternalId) {
    const parentPkg = targetPackages.get(spawn.parentInternalId)
    if (parentPkg) {
      parentPkg.children.push(id)
    }
  }

  // Add to internal maps
  targetPackages.set(id, innerPkg)
  targetWires.set(wire.id, wire)

  // Update weight (with compression applied to global weight)
  targetPkg.size += finalSize
  addWeight(finalSize)

  // Trigger particle effect only if viewing the cascading scope
  // (prevents effects playing on wrong layer when navigating away)
  if (isViewingCascadeScope()) {
    emit('cascade:spawn-effect', {
      position: spawn.position,
      isConflict: isConflicted,
    })
  }
}

/**
 * Check if the current view scope matches the cascade scope
 * Exported so UI can conditionally show cascade-related effects
 */
export function isViewingCascadeScope(): boolean {
  const scopePath = gameState.cascade.scopePath
  if (!scopePath) return false

  const viewStack = gameState.scopeStack
  if (viewStack.length !== scopePath.length) return false

  for (let i = 0; i < viewStack.length; i++) {
    if (viewStack[i] !== scopePath[i]) return false
  }
  return true
}

/**
 * Check if a package identity conflicts with any existing internal packages
 */
function checkInternalIncompatibility(
  identity: PackageIdentity | undefined,
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

/**
 * End the cascade and trigger state recalculation
 */
function endCascade(): void {
  const cascade = gameState.cascade
  const scopePath = cascade.scopePath ? [...cascade.scopePath] : []

  // Reset cascade state to initial values
  cascade.active = false
  cascade.scopePackageId = null
  cascade.pendingSpawns = []
  cascade.scopePath = null
  cascade.subDepQueue = null
  cascade.compressedIndices = null
  cascade.surgeGoldenBoost = 0
  cascade.surgeFragmentBoost = 0

  // Clear starved state
  setCascadeStarved(false)

  // Emit cascade end event for state recalculation
  if (scopePath.length > 0) {
    emit('cascade:end', { scopePath })
  }

  // Process next cascade in queue (FIFO)
  if (cascadeQueue.length > 0) {
    const nextPath = cascadeQueue.shift()!
    const nextPkg = getPackageAtPath(nextPath)
    if (
      nextPkg &&
      nextPkg.internalPackages &&
      nextPkg.internalPackages.size === 0
    ) {
      startCascadeImmediate(nextPath, nextPkg)
    } else {
      // Package no longer valid or already spawned, try next
      endCascade()
    }
  }
}

/**
 * Cancel cascade (e.g., when exiting scope early)
 */
export function cancelCascade(): void {
  if (gameState.cascade.active) {
    endCascade()
  }
}

/**
 * Get pending spawns that are waiting for bandwidth (for rendering)
 * Returns spawns that have awaitingBandwidth=true
 */
export function getPendingSpawnsAwaitingBandwidth(): PendingSpawn[] {
  if (!gameState.cascade.active) return []
  return gameState.cascade.pendingSpawns.filter((s) => s.awaitingBandwidth)
}

/**
 * Get all pending spawns (for rendering queue indicators)
 */
export function getAllPendingSpawns(): PendingSpawn[] {
  if (!gameState.cascade.active) return []
  return [...gameState.cascade.pendingSpawns]
}

/**
 * Get the current cascade scope path
 */
export function getCascadeScopePath(): string[] {
  return gameState.cascade.scopePath ? [...gameState.cascade.scopePath] : []
}

/**
 * Clear the cascade queue (e.g., on prestige)
 */
export function clearCascadeQueue(): void {
  cascadeQueue = []
}
