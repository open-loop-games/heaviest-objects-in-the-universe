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
  DEPTH_WEIGHT_MULTIPLIERS,
  MAX_SAME_IDENTITY_PER_SCOPE,
  MIN_DUPLICATE_PAIRS_PER_SCOPE,
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
  SECOND_PACKAGE_INTERNAL_DEPS,
  THIRD_PACKAGE_INTERNAL_DEPS,
  REACT_DOM_INTERNAL_DEPS,
  type PackageIdentity,
  getConflictingNames,
  wouldConflictWithAny,
  pickDistinctDuplicateIdentities,
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

// Starter-kit tutorial pacing - much slower to reduce sensory overload
const STARTER_KIT_SPAWN_INTERVAL = 350 // Much slower initial spawn rate
const STARTER_KIT_MIN_INTERVAL = 200 // Slower minimum
const STARTER_KIT_DECAY = 0.96 // Slower acceleration
const STARTER_KIT_BREATH_DURATION = 800 // ms to pause after cascade before revealing conflicts

// Second package pacing - intermediate between starter-kit and normal
const SECOND_PKG_SPAWN_INTERVAL = 250 // Faster than starter-kit, slower than normal
const SECOND_PKG_MIN_INTERVAL = 120 // Converges to normal speed
const SECOND_PKG_DECAY = 0.94 // Moderate acceleration

// Third package pacing - faster, approaching normal
const THIRD_PKG_SPAWN_INTERVAL = 200 // Faster than second package
const THIRD_PKG_MIN_INTERVAL = 80 // Approaches normal minimum
const THIRD_PKG_DECAY = 0.93 // Slightly faster acceleration

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
  const isSecondPackage = pkg.identity?.name === 'express'
  const isThirdPackage = pkg.identity?.name === 'react'
  const isReactDom = pkg.identity?.name === 'react-dom'

  // Consume surge boost only if this cascade can spawn golden packages
  // Golden packages require effectiveDepth >= GOLDEN_MIN_DEPTH (3)
  // effectiveDepth = scopePath.length + spawn.depth (which starts at 1)
  // So we need scopePath.length >= 2 for golden packages to be possible
  let surgeBoost = { sizeMultiplier: 1, goldenBoost: 0, fragmentBoost: 0 }
  const canSpawnGolden = depth >= GOLDEN_MIN_DEPTH - 1 // depth 2+ means effective depth 3+
  if (isSurgeUnlocked() && canSpawnGolden) {
    surgeBoost = consumeSurge()
  }

  // Build list of identities to spawn
  // Curated packages have deterministic deps for teaching:
  // - starter-kit: 8 packages, 1 duplicate pair (lodash), 1 conflict pair
  // - express: 12 packages, 3-way duplicate (debug), 2-way duplicate (ms), 1 conflict
  // - react: 10 packages, 2 duplicate pairs, 1 compressed (react-dom)
  // - react-dom: 6 packages, 1 duplicate pair (lodash), 1 conflict
  // NO random generation, NO shuffle - deterministic teaching experience
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

  // Only generate random identities for non-curated packages
  if (!isCurated) {
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

    // === NEW IDENTITY GENERATION (C, D, E) ===
    // Track identity counts (C: max 4 per identity)
    const identityCounts = new Map<string, number>()
    // Track conflicting identities (E: conflict packages are unique)
    const conflictingIdentityNames = new Set<string>()

    // D: Inject guaranteed duplicate pairs first
    const guaranteedDupes = pickDistinctDuplicateIdentities(
      MIN_DUPLICATE_PAIRS_PER_SCOPE
    )
    for (const identity of guaranteedDupes) {
      // Add each identity twice (creates a duplicate pair)
      depIdentities.push(identity, identity)
      identityCounts.set(identity.name, 2)
    }

    // Fill remaining slots with random identities
    const remainingSlots = count - depIdentities.length
    let attempts = 0
    const maxAttempts = remainingSlots * 10 // Prevent infinite loops

    while (depIdentities.length < count && attempts < maxAttempts) {
      attempts++
      const candidate = pickRandomIdentity()

      // C: Check identity count cap
      const currentCount = identityCounts.get(candidate.name) ?? 0
      if (currentCount >= MAX_SAME_IDENTITY_PER_SCOPE) {
        continue
      }

      // E: If this identity conflicts with something, check uniqueness
      if (wouldConflictWithAny(candidate, conflictingIdentityNames)) {
        // This identity would create a conflict - ensure it's unique
        if (currentCount > 0) {
          continue // Already have one, skip to prevent duplicate conflicts
        }
      }

      // Accept this identity
      depIdentities.push(candidate)
      identityCounts.set(candidate.name, currentCount + 1)

      // E: Track if this identity is part of any conflict pair
      const conflictsWithThis = getConflictingNames(candidate.name)
      for (const conflictName of conflictsWithThis) {
        if (identityCounts.has(conflictName)) {
          // Both sides of a conflict pair are now in the scope
          conflictingIdentityNames.add(candidate.name)
          conflictingIdentityNames.add(conflictName)
        }
      }
    }

    // D: Shuffle to distribute duplicates throughout the spawn sequence
    for (let i = depIdentities.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[depIdentities[i], depIdentities[j]] = [
        depIdentities[j]!,
        depIdentities[i]!,
      ]
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
      // Third package (react): make react-dom (index 0) compressed to teach nested scopes
      if (isThirdPackage && dep.name === 'react-dom') {
        compressedIndices.add(i)
      } else if (!isCurated && Math.random() < compressionChance) {
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
  // Skip sub-deps entirely for curated packages
  const subDepPlaceholders: Array<{
    parentIndex: number
    identity: PackageIdentity
  }> = []
  if (!isCurated) {
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
  }

  // Store cascade data (now properly typed on CascadeState)
  const cascade = gameState.cascade
  cascade.scopePath = [...scopePath]
  cascade.subDepQueue = subDepPlaceholders
  cascade.compressedIndices = compressedIndices
  cascade.surgeGoldenBoost = surgeBoost.goldenBoost
  cascade.surgeFragmentBoost = surgeBoost.fragmentBoost

  // Tutorial pacing for curated packages
  cascade.isStarterKit = isStarterKit
  cascade.isSecondPackage = isSecondPackage
  cascade.isThirdPackage = isThirdPackage
  cascade.isReactDom = isReactDom
  cascade.deferConflicts = isStarterKit // Defer conflicts for breath moment (starter-kit only)
  cascade.breathPhase = false
  cascade.breathStartTime = 0

  // Start the cascade
  cascade.active = true
  cascade.scopePackageId = scopePath[scopePath.length - 1] ?? null
  gameState.cascade.pendingSpawns = pendingSpawns
  gameState.cascade.lastSpawnTime = Date.now()

  // Curated packages use slower timing to reduce sensory overload
  if (isStarterKit) {
    gameState.cascade.spawnInterval = STARTER_KIT_SPAWN_INTERVAL
  } else if (isSecondPackage) {
    gameState.cascade.spawnInterval = SECOND_PKG_SPAWN_INTERVAL
  } else if (isThirdPackage || isReactDom) {
    gameState.cascade.spawnInterval = THIRD_PKG_SPAWN_INTERVAL
  } else {
    // Faster spawns at deeper levels
    gameState.cascade.spawnInterval = Math.floor(
      BASE_SPAWN_INTERVAL * Math.pow(SPAWN_INTERVAL_SPEEDUP, depth - 1)
    )
  }
}

/**
 * Update cascade - spawn next dep if enough time has passed
 */
export function updateCascade(): void {
  if (!gameState.cascade.active) return

  const cascade = gameState.cascade
  const now = Date.now()

  // Handle breath phase - pause after spawning before revealing conflicts
  if (cascade.breathPhase) {
    const breathElapsed = now - cascade.breathStartTime
    if (breathElapsed >= STARTER_KIT_BREATH_DURATION) {
      // Breath phase complete - reveal conflicts now
      revealDeferredConflicts()
      endCascade()
    }
    return // Don't spawn during breath phase
  }

  const elapsed = now - cascade.lastSpawnTime

  // Add jitter to current interval for organic feel
  const jitter = 1 + (Math.random() - 0.5) * 2 * SPAWN_INTERVAL_JITTER
  const effectiveInterval = cascade.spawnInterval * jitter

  if (elapsed >= effectiveInterval) {
    spawnNextFromQueue()
    cascade.lastSpawnTime = now

    // Accelerate for next spawn (curated packages use slower acceleration)
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

    // For starter-kit with deferred conflicts, enter breath phase
    // This gives physics time to settle before conflicts are revealed
    if (cascade.deferConflicts && !cascade.breathPhase) {
      cascade.breathPhase = true
      cascade.breathStartTime = Date.now()
      return // Don't end yet - updateCascade will handle breath phase
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

  // Get surge boosts for this cascade (fragment boost now merged into golden)
  const surgeGoldenBoost = cascade.surgeGoldenBoost + cascade.surgeFragmentBoost

  // Roll for golden package (depth 3+ only, requires surge unlock)
  // Golden packages give 4x weight AND guaranteed fragment
  // Only spawn after surge is unlocked (P2+) so fragments are introduced with their mechanic
  const goldenChance = GOLDEN_SPAWN_CHANCE + surgeGoldenBoost
  const isGolden =
    isSurgeUnlocked() &&
    effectiveDepth >= GOLDEN_MIN_DEPTH &&
    Math.random() < goldenChance

  // Cache fragments come only from golden packages (merged mechanic)
  // Easter egg: break_infinity and break_eternity ALWAYS have fragments
  const isIncrementalEasterEgg =
    identity?.name === 'break_infinity' || identity?.name === 'break_eternity'
  const hasCacheFragment = isGolden || isIncrementalEasterEgg

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

  // Check for conflicts (deferred for starter-kit to allow breath moment)
  const shouldCheckConflicts = !cascade.deferConflicts
  const isConflicted =
    shouldCheckConflicts &&
    checkInternalIncompatibility(identity, targetPackages)

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
 * Reveal deferred conflicts after breath phase completes
 * Called for starter-kit to show conflicts with a brief pause for player awareness
 */
function revealDeferredConflicts(): void {
  const cascade = gameState.cascade
  const scopePath = cascade.scopePath
  if (!scopePath || scopePath.length === 0) return

  const targetPkg = getPackageAtPath(scopePath)
  if (!targetPkg || !targetPkg.internalPackages || !targetPkg.internalWires)
    return

  const internalPackages = targetPkg.internalPackages
  const internalWires = targetPkg.internalWires
  const now = Date.now()

  // Check each package for conflicts and mark wires accordingly
  for (const pkg of internalPackages.values()) {
    if (!pkg.identity) continue

    // Check if this package conflicts with any other
    const isConflicted = checkInternalIncompatibility(
      pkg.identity,
      internalPackages
    )
    if (!isConflicted) continue

    // Find the wire connecting to this package and mark it conflicted
    for (const wire of internalWires.values()) {
      if (wire.toId === pkg.id && !wire.conflicted) {
        wire.conflicted = true
        wire.conflictTime = now
        pkg.state = 'conflict'

        if (!gameState.onboarding.firstConflictSeen) {
          gameState.onboarding.firstConflictSeen = true
        }
        break // Only mark one wire per package
      }
    }
  }
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
  // Reset tutorial pacing fields
  cascade.isStarterKit = false
  cascade.isSecondPackage = false
  cascade.isThirdPackage = false
  cascade.isReactDom = false
  cascade.deferConflicts = false
  cascade.breathPhase = false
  cascade.breathStartTime = 0

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
