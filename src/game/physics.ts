// Force-directed graph physics for node positioning
// Enhanced with tree-organizing forces for cleaner layouts

import { toRaw } from 'vue'
import { gameState, gameConfig } from './state'
import { collapseState, markPackageAbsorbed, dragState } from './ui-state'
import type { Package } from './types'
import { getAllDuplicateGroups } from './symlinks'
import { getPackageAtPath } from './scope'
import { on } from './events'

// Radial layout configuration
const RADIAL_CONFIG = {
  baseRadius: 120, // Radius for first ring (depth 1)
  radiusPerDepth: 100, // Additional radius per depth level
  minAngularSpread: 0.15, // Minimum radians per node (prevents cramping)
  anchorStrength: 0.12, // Spring force toward anchor (higher = snappier)
  anchorBoostStrength: 0.25, // Anchor strength during organize boost (gentler)
  repulsionRange: 70, // Reduced - anchors handle positioning now
  hardPushDistance: 35, // Below this, extra push
  hardPushMultiplier: 2.5, // Close-range repulsion multiplier
  phasingDuration: 2.0, // Seconds of phasing after reparent
  phasingRepulsionMult: 0.05, // Very low repulsion while phasing
  organizeBoostDuration: 0.8, // Seconds of boosted anchor pull after merge (reduced for less jarring motion)
  chaosJitter: 5, // Minimal - anchors provide structure
  // Multi-ring configuration for top-level packages
  topLevelSpacing: 90, // Minimum spacing between top-level packages (they're big!)
  ringGap: 100, // Gap between rings
  maxPerRing: 10, // Soft max before considering next ring
}

// Track organize boost state
let organizeBoostTimer = 0
let lastCleanliness = 1

// Track packages that recently changed parents (for "phasing" through crowds)
// Maps packageId -> remaining phasing time in seconds
const phasingPackages = new Map<string, number>()

// Anchor positions for radial layout
// Maps packageId -> { x, y } target position
const anchorPositions = new Map<string, { x: number; y: number }>()

/**
 * Calculate subtree size (number of descendants + 1)
 */
function getSubtreeSize(pkgId: string, packages: Map<string, Package>): number {
  const pkg = packages.get(pkgId)
  if (!pkg) return 0

  let size = 1
  for (const childId of pkg.children) {
    size += getSubtreeSize(childId, packages)
  }
  return size
}

/**
 * Compute radial anchor positions for all packages
 * Root at center, top-level packages in multi-ring layout, subtrees get angular slices
 */
function computeRadialAnchors(
  packages: Map<string, Package>,
  rootId: string | null
): void {
  anchorPositions.clear()

  if (!rootId) return

  const root = packages.get(rootId)
  if (!root) return

  // Root anchors at center
  anchorPositions.set(rootId, { x: 0, y: 0 })

  // Assign top-level packages with multi-ring support
  assignTopLevelAnchors(rootId, packages)
}

/**
 * Calculate how many packages fit in a ring at given radius
 */
function getCapacityForRing(radius: number, spacing: number): number {
  const circumference = 2 * Math.PI * radius
  return Math.max(1, Math.floor(circumference / spacing))
}

/**
 * Assign top-level packages to multiple rings if needed
 */
function assignTopLevelAnchors(
  rootId: string,
  packages: Map<string, Package>
): void {
  const root = packages.get(rootId)
  if (!root || root.children.length === 0) return

  // Get all top-level packages with their sizes
  const childSizes: { id: string; size: number; pkg: Package }[] = []
  for (const childId of root.children) {
    const pkg = packages.get(childId)
    if (!pkg) continue
    const size = Math.max(1, getSubtreeSize(childId, packages))
    childSizes.push({ id: childId, size, pkg })
  }

  if (childSizes.length === 0) return

  // Calculate ring assignments
  const rings: (typeof childSizes)[] = []
  let currentRing: typeof childSizes = []
  let ringIndex = 0
  let currentRadius = RADIAL_CONFIG.baseRadius

  // Calculate capacity for first ring
  let ringCapacity = getCapacityForRing(
    currentRadius,
    RADIAL_CONFIG.topLevelSpacing
  )

  for (const child of childSizes) {
    if (currentRing.length >= ringCapacity) {
      // Current ring is full, start a new one
      rings.push(currentRing)
      currentRing = []
      ringIndex++
      currentRadius =
        RADIAL_CONFIG.baseRadius + ringIndex * RADIAL_CONFIG.ringGap
      ringCapacity = getCapacityForRing(
        currentRadius,
        RADIAL_CONFIG.topLevelSpacing
      )
    }
    currentRing.push(child)
  }

  // Don't forget the last ring
  if (currentRing.length > 0) {
    rings.push(currentRing)
  }

  // Assign positions for each ring
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r]!
    const radius = RADIAL_CONFIG.baseRadius + r * RADIAL_CONFIG.ringGap

    // Calculate total subtree size for proportional distribution
    let totalSize = 0
    for (const child of ring) {
      totalSize += child.size
    }

    // Distribute around the ring
    // Offset each ring slightly so packages don't align radially
    const ringOffset = r * 0.3
    let currentAngle = -Math.PI / 2 + ringOffset // Start from top

    for (const { id: childId, size } of ring) {
      // Angle for this subtree (proportional to size)
      const proportion = size / totalSize
      const childAngleSpan = Math.max(
        RADIAL_CONFIG.minAngularSpread,
        Math.PI * 2 * proportion
      )

      // Place child at center of its angular slice
      const childAngle = currentAngle + childAngleSpan / 2

      const x = Math.cos(childAngle) * radius
      const y = Math.sin(childAngle) * radius

      anchorPositions.set(childId, { x, y })

      // Recursively assign to this child's children (depth 2+)
      assignChildAnchors(childId, currentAngle, childAngleSpan, packages)

      currentAngle += childAngleSpan
    }
  }
}

/**
 * Recursively assign anchor positions to children (depth 2+)
 * @param parentId - Parent package ID
 * @param startAngle - Start of angular slice (radians)
 * @param angleSpan - Total angle available for this subtree (radians)
 * @param packages - All packages
 */
function assignChildAnchors(
  parentId: string,
  startAngle: number,
  angleSpan: number,
  packages: Map<string, Package>
): void {
  const parent = packages.get(parentId)
  if (!parent || parent.children.length === 0) return

  const childDepth = parent.depth + 1

  // For depth 2+, use standard radial layout
  // (depth 1 is handled by assignTopLevelAnchors with multi-ring)
  const radius =
    RADIAL_CONFIG.baseRadius + (childDepth - 1) * RADIAL_CONFIG.radiusPerDepth

  // Calculate subtree sizes for proportional angle distribution
  const childSizes: { id: string; size: number }[] = []
  let totalSize = 0

  for (const childId of parent.children) {
    const size = Math.max(1, getSubtreeSize(childId, packages))
    childSizes.push({ id: childId, size })
    totalSize += size
  }

  // Distribute angles proportionally to subtree size
  let currentAngle = startAngle

  for (const { id: childId, size } of childSizes) {
    // Angle for this subtree (proportional to size, with minimum)
    const proportion = size / totalSize
    const childAngleSpan = Math.max(
      RADIAL_CONFIG.minAngularSpread,
      angleSpan * proportion
    )

    // Place child at center of its angular slice
    const childAngle = currentAngle + childAngleSpan / 2

    // Calculate position (relative to CENTER, not parent)
    // This creates proper rings around root
    const x = Math.cos(childAngle) * radius
    const y = Math.sin(childAngle) * radius

    anchorPositions.set(childId, { x, y })

    // Recursively assign to this child's children
    assignChildAnchors(childId, currentAngle, childAngleSpan, packages)

    currentAngle += childAngleSpan
  }
}

/**
 * Get anchor position for a package
 */
export function getAnchorPosition(
  pkgId: string
): { x: number; y: number } | null {
  return anchorPositions.get(pkgId) || null
}

/**
 * Mark a package as relocated (needs to phase through other nodes)
 * Call this when a package's parent changes (e.g., after symlink merge)
 *
 * Also performs a partial teleport toward the new anchor to avoid
 * long crossing wires during reorganization.
 */
export function markPackageRelocated(packageId: string): void {
  phasingPackages.set(packageId, RADIAL_CONFIG.phasingDuration)

  // Recompute anchors to get the new target position
  const rawPackages = toRaw(gameState.packages)
  computeRadialAnchors(rawPackages, gameState.rootId)

  // Partial teleport: immediately move 60% toward new anchor
  // This prevents ugly long wires during reorganization
  const pkg = gameState.packages.get(packageId)
  const anchor = anchorPositions.get(packageId)

  if (pkg && anchor) {
    const teleportFactor = 0.6 // Move 60% of the way instantly
    pkg.position.x =
      pkg.position.x + (anchor.x - pkg.position.x) * teleportFactor
    pkg.position.y =
      pkg.position.y + (anchor.y - pkg.position.y) * teleportFactor
    // Give it velocity toward anchor to continue smoothly
    pkg.velocity.vx = (anchor.x - pkg.position.x) * 0.1
    pkg.velocity.vy = (anchor.y - pkg.position.y) * 0.1
  }
}

/**
 * Check if a package is currently phasing (reduced repulsion)
 */
function isPhasing(packageId: string): boolean {
  return phasingPackages.has(packageId)
}

/**
 * Calculate cleanliness score (0-1)
 * 1 = no duplicates (perfect)
 * 0 = many duplicates (chaotic)
 */
export function calculateCleanliness(): number {
  const duplicateGroups = getAllDuplicateGroups()
  const totalPackages = gameState.packages.size

  if (totalPackages <= 1) return 1

  // Count total duplicate packages (packages that share identity with others)
  let duplicateCount = 0
  for (const group of duplicateGroups) {
    // Each group has N packages, N-1 are "extra" duplicates
    duplicateCount += group.packageIds.length - 1
  }

  // Cleanliness = 1 - (duplicates / total)
  // Clamp to reasonable range
  const rawCleanliness = 1 - duplicateCount / totalPackages
  return Math.max(0.1, Math.min(1, rawCleanliness))
}

/**
 * Trigger organize boost (call after merge)
 */
export function triggerOrganizeBoost(): void {
  organizeBoostTimer = RADIAL_CONFIG.organizeBoostDuration
}

/**
 * Get anchor spring strength (boosted after merge)
 */
function getAnchorStrength(): number {
  return organizeBoostTimer > 0
    ? RADIAL_CONFIG.anchorBoostStrength
    : RADIAL_CONFIG.anchorStrength
}

/**
 * Update physics simulation for all packages
 * Uses radial anchor layout with spring forces
 */
export function updatePhysics(deltaTime: number): void {
  // Update organize boost timer
  if (organizeBoostTimer > 0) {
    organizeBoostTimer = Math.max(0, organizeBoostTimer - deltaTime)
  }

  // Update phasing timers (for relocated packages)
  for (const [pkgId, timeLeft] of phasingPackages) {
    const newTime = timeLeft - deltaTime
    if (newTime <= 0) {
      phasingPackages.delete(pkgId)
    } else {
      phasingPackages.set(pkgId, newTime)
    }
  }

  // Calculate current cleanliness
  const cleanliness = calculateCleanliness()
  lastCleanliness = cleanliness

  // Use toRaw() to avoid Vue reactivity tracking in physics loop
  const rawPackages = toRaw(gameState.packages)
  const packages = Array.from(rawPackages.values())

  // Recompute radial anchor positions
  computeRadialAnchors(rawPackages, gameState.rootId)

  // Get anchor spring strength
  const anchorStrength = getAnchorStrength()
  const chaosAmount = 1 - cleanliness

  // Check if we're dragging a package at root level
  const isRootDragging =
    dragState.value.packageId !== null && !dragState.value.isInternalScope
  const rootDraggedId = dragState.value.packageId

  for (const pkg of packages) {
    // Root stays anchored at origin
    if (pkg.parentId === null) {
      pkg.position.x = 0
      pkg.position.y = 0
      pkg.velocity.vx = 0
      pkg.velocity.vy = 0
      continue
    }

    // Skip physics for dragged package at root level
    if (isRootDragging && pkg.id === rootDraggedId) {
      pkg.velocity.vx = 0
      pkg.velocity.vy = 0
      continue
    }

    const forces = calculateForces(pkg, packages, anchorStrength, chaosAmount)

    // Apply forces to velocity
    pkg.velocity.vx += forces.fx * deltaTime
    pkg.velocity.vy += forces.fy * deltaTime

    // Apply damping
    const dampingFactor = gameConfig.damping
    pkg.velocity.vx *= dampingFactor
    pkg.velocity.vy *= dampingFactor

    // Clamp velocity to prevent crazy speeds (safety limit)
    const maxSpeed = organizeBoostTimer > 0 ? 300 : 200 // Allow faster during boost
    const speed = Math.sqrt(pkg.velocity.vx ** 2 + pkg.velocity.vy ** 2)
    if (speed > maxSpeed) {
      pkg.velocity.vx = (pkg.velocity.vx / speed) * maxSpeed
      pkg.velocity.vy = (pkg.velocity.vy / speed) * maxSpeed
    }

    // Update position
    pkg.position.x += pkg.velocity.vx
    pkg.position.y += pkg.velocity.vy
  }
}

/**
 * Calculate net force on a package using radial anchor system
 */
function calculateForces(
  pkg: Package,
  allPackages: Package[],
  anchorStrength: number,
  chaosAmount: number
): { fx: number; fy: number } {
  let fx = 0
  let fy = 0

  const pkgIsPhasing = isPhasing(pkg.id)

  // === SPRING FORCE TOWARD ANCHOR ===
  // This is the primary organizing force - pulls node toward its ideal radial position
  const anchor = anchorPositions.get(pkg.id)
  if (anchor) {
    const dx = anchor.x - pkg.position.x
    const dy = anchor.y - pkg.position.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > 1) {
      // Phasing packages get stronger anchor pull (rush to new position)
      const phasingMult = pkgIsPhasing ? 3.0 : 1.0
      const force = anchorStrength * phasingMult

      fx += dx * force
      fy += dy * force
    }
  }

  // === REPULSION FROM OTHER NODES ===
  // Light repulsion to prevent overlap - anchors do most positioning work
  const repulsionMult = pkgIsPhasing ? RADIAL_CONFIG.phasingRepulsionMult : 1.0

  for (const other of allPackages) {
    if (other.id === pkg.id) continue

    const dx = pkg.position.x - other.position.x
    const dy = pkg.position.y - other.position.y
    const distSq = dx * dx + dy * dy
    const dist = Math.sqrt(distSq)

    if (dist < 1 || dist > RADIAL_CONFIG.repulsionRange) continue

    // If EITHER node is phasing, reduce repulsion
    const otherIsPhasing = isPhasing(other.id)
    const effectiveMult =
      pkgIsPhasing || otherIsPhasing
        ? RADIAL_CONFIG.phasingRepulsionMult
        : repulsionMult

    // Hard push when very close
    const closeRangeMult =
      dist < RADIAL_CONFIG.hardPushDistance
        ? RADIAL_CONFIG.hardPushMultiplier
        : 1.0

    const force =
      (gameConfig.nodeRepulsion / distSq) * effectiveMult * closeRangeMult
    fx += (dx / dist) * force
    fy += (dy / dist) * force
  }

  // === CHAOS JITTER ===
  // Slight random movement when system is chaotic (many duplicates)
  if (chaosAmount > 0.3) {
    const jitterStrength = chaosAmount * RADIAL_CONFIG.chaosJitter
    fx += (Math.random() - 0.5) * jitterStrength * 0.1
    fy += (Math.random() - 0.5) * jitterStrength * 0.1
  }

  return { fx, fy }
}

/**
 * Get last calculated cleanliness (for UI display)
 */
export function getCleanliness(): number {
  return lastCleanliness
}

/**
 * Check if currently in organize boost
 */
export function isOrganizing(): boolean {
  return organizeBoostTimer > 0
}

// Internal scope anchor positions (separate from outer scope)
const internalAnchorPositions = new Map<string, { x: number; y: number }>()

// Internal scope physics configuration
const INTERNAL_CONFIG = {
  spacingPerNode: 65, // Circumference space per node
  minRadius: 130, // First ring radius (larger = more spacing in inner ring)
  ringGap: 75, // Gap between rings
  maxPerRing: 12, // Max first-level packages per ring
  radiusPerDepth: 70, // Additional radius for children
  minAngularSpread: 0.2, // Minimum radians per node
  anchorStrength: 0.18, // Anchor strength (physics still active)
  repulsionRange: 60, // Repulsion distance
  hardPushDistance: 30, // Extra push when very close
  hardPushMultiplier: 3.0, // Close-range multiplier
}

/**
 * Compute radial anchors for internal packages with multi-ring overflow
 * First-level packages distributed across rings, children in outer rings
 */
function computeInternalAnchors(
  internalPackages: Map<string, Package>,
  scopeRootId: string
): void {
  internalAnchorPositions.clear()

  // Scope root is at center
  internalAnchorPositions.set(scopeRootId, { x: 0, y: 0 })

  // Find first-level packages (direct children of scope root)
  const firstLevel: Package[] = []
  for (const pkg of internalPackages.values()) {
    if (pkg.parentId === scopeRootId) {
      firstLevel.push(pkg)
    }
  }

  if (firstLevel.length === 0) return

  // Sort by ID for stable ordering (prevents reshuffling on unrelated changes)
  firstLevel.sort((a, b) => a.id.localeCompare(b.id))

  // Distribute across rings (max 12 per ring)
  for (let i = 0; i < firstLevel.length; i++) {
    const pkg = firstLevel[i]!
    const ringIndex = Math.floor(i / INTERNAL_CONFIG.maxPerRing)
    const indexInRing = i % INTERNAL_CONFIG.maxPerRing
    const countInThisRing = Math.min(
      INTERNAL_CONFIG.maxPerRing,
      firstLevel.length - ringIndex * INTERNAL_CONFIG.maxPerRing
    )

    // Ring radius
    const radius =
      INTERNAL_CONFIG.minRadius + ringIndex * INTERNAL_CONFIG.ringGap

    // Angle: evenly distributed in this ring, with ring offset
    const ringOffset = ringIndex * 0.15 // Slight offset per ring
    const angleStep = (Math.PI * 2) / countInThisRing
    const angle = -Math.PI / 2 + ringOffset + indexInRing * angleStep

    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius

    internalAnchorPositions.set(pkg.id, { x, y })

    // Assign children to outer rings (relative to this package's ring)
    const childBaseRadius = radius + INTERNAL_CONFIG.radiusPerDepth
    assignInternalChildAnchors(
      pkg.id,
      angle,
      angleStep * 0.8, // Children get slightly less angular space
      childBaseRadius,
      internalPackages
    )
  }
}

/**
 * Recursively assign anchor positions to internal children
 * Children are placed in outer rings within their parent's angular slice
 */
function assignInternalChildAnchors(
  parentId: string,
  parentAngle: number,
  angleSpan: number,
  parentRadius: number,
  internalPackages: Map<string, Package>,
  visited: Set<string> = new Set()
): void {
  // Prevent infinite recursion from circular references
  if (visited.has(parentId)) return
  visited.add(parentId)

  // Find children of this parent
  const children: Package[] = []
  for (const pkg of internalPackages.values()) {
    if (pkg.parentId === parentId && !visited.has(pkg.id)) {
      children.push(pkg)
    }
  }

  if (children.length === 0) return

  // Children go in outer ring
  const childRadius = parentRadius + INTERNAL_CONFIG.radiusPerDepth

  // Distribute children within parent's angular slice
  // Enforce minimum angular spread per child to prevent overlap
  const minRequiredSpan = children.length * INTERNAL_CONFIG.minAngularSpread
  const effectiveSpan = Math.max(angleSpan, minRequiredSpan)

  const angleStep = effectiveSpan / (children.length + 1)
  // Center the (possibly expanded) span around parent's angle
  const startAngle = parentAngle - effectiveSpan / 2

  for (let i = 0; i < children.length; i++) {
    const child = children[i]!
    const childAngle = startAngle + angleStep * (i + 1)

    const x = Math.cos(childAngle) * childRadius
    const y = Math.sin(childAngle) * childRadius

    internalAnchorPositions.set(child.id, { x, y })

    // Recurse for deeper levels
    assignInternalChildAnchors(
      child.id,
      childAngle,
      angleStep,
      childRadius,
      internalPackages,
      visited
    )
  }
}

/**
 * Update physics for internal packages of a specific scope
 * Uses tree-aware radial anchors with multi-ring overflow
 * @param scopePath - Path to the scope package (supports arbitrary depth)
 */
export function updateInternalPhysics(
  scopePath: string[],
  deltaTime: number
): void {
  if (scopePath.length === 0) return

  const scopePkg = getPackageAtPath(scopePath)
  if (!scopePkg || !scopePkg.internalPackages) return

  // Use toRaw() to avoid Vue reactivity tracking in physics loop
  const internalPackages = toRaw(scopePkg.internalPackages)
  const packages = Array.from(internalPackages.values())
  if (packages.length === 0) return

  // The scope root ID is the last element in the path
  const scopeRootId = scopePath[scopePath.length - 1]!

  // Check if a node is being dragged in this scope - freeze all other nodes
  const isDragging =
    dragState.value.packageId !== null && dragState.value.isInternalScope
  const draggedId = dragState.value.packageId

  // Compute tree-aware anchor positions (deterministic, stable)
  computeInternalAnchors(internalPackages, scopeRootId)

  for (const pkg of packages) {
    // If dragging, skip physics for ALL nodes (dragged node is moved by mouse)
    if (isDragging) {
      // Zero out velocity to prevent drift when drag ends
      if (pkg.id !== draggedId) {
        pkg.velocity.vx = 0
        pkg.velocity.vy = 0
      }
      continue
    }

    let fx = 0
    let fy = 0

    // === STRONG SPRING TOWARD ANCHOR ===
    // Tree-based anchors are the primary positioning force
    const anchor = internalAnchorPositions.get(pkg.id)
    if (anchor) {
      const dx = anchor.x - pkg.position.x
      const dy = anchor.y - pkg.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > 1) {
        fx += dx * INTERNAL_CONFIG.anchorStrength
        fy += dy * INTERNAL_CONFIG.anchorStrength
      }
    }

    // === REPULSION FROM OTHER NODES ===
    // Secondary force to prevent overlap
    for (const other of packages) {
      if (other.id === pkg.id) continue

      const rdx = pkg.position.x - other.position.x
      const rdy = pkg.position.y - other.position.y
      const distSq = rdx * rdx + rdy * rdy
      const rDist = Math.sqrt(distSq)

      if (rDist < 1 || rDist > INTERNAL_CONFIG.repulsionRange) continue

      // Hard push when very close
      const closeMult =
        rDist < INTERNAL_CONFIG.hardPushDistance
          ? INTERNAL_CONFIG.hardPushMultiplier
          : 1.0

      const force = (150 / distSq) * closeMult
      fx += (rdx / rDist) * force
      fy += (rdy / rDist) * force
    }

    // Apply forces
    pkg.velocity.vx += fx * deltaTime
    pkg.velocity.vy += fy * deltaTime

    // Damping
    const damping = 0.92
    pkg.velocity.vx *= damping
    pkg.velocity.vy *= damping

    // Clamp velocity
    const maxSpeed = 150
    const speed = Math.sqrt(pkg.velocity.vx ** 2 + pkg.velocity.vy ** 2)
    if (speed > maxSpeed) {
      pkg.velocity.vx = (pkg.velocity.vx / speed) * maxSpeed
      pkg.velocity.vy = (pkg.velocity.vy / speed) * maxSpeed
    }

    // Update position
    pkg.position.x += pkg.velocity.vx
    pkg.position.y += pkg.velocity.vy
  }
}

// ============================================
// COLLAPSE PHYSICS (Prestige spaghettification)
// ============================================

const COLLAPSE_CONFIG = {
  // Timing
  duration: 5.0, // Total collapse duration in seconds (extended for wave rhythm)

  // Gravitational pull
  baseAcceleration: 350, // Base acceleration toward black hole
  maxVelocity: 900, // Maximum velocity cap

  // Absorption
  absorptionRadius: 15, // Distance at which packages are absorbed (smaller = more stretch visible)

  // Spaghettification parameters (exported for rendering)
  stretchStartDistance: 300, // Start stretching when this close
  maxStretch: 4.0, // Maximum stretch factor (4x longer)
  minWidth: 0.12, // Minimum width factor (12% of original)

  // Wave rhythm parameters (pull → pause → stronger pull)
  waveCount: 3, // Number of pull waves
  wavePauseDuration: 0.15, // Fraction of wave that is "pause"
  waveIntensities: [0.6, 0.85, 1.0], // Intensity multiplier for each wave
}

/**
 * Get spaghettification parameters for a package based on distance to black hole
 * Returns stretch factor (1 = normal, >1 = elongated) and width factor (1 = normal, <1 = squeezed)
 */
export function getSpaghettification(pkg: Package): {
  stretch: number
  width: number
  angle: number
} {
  if (!collapseState.value.active) {
    return { stretch: 1, width: 1, angle: 0 }
  }

  const dx = collapseState.value.targetX - pkg.position.x
  const dy = collapseState.value.targetY - pkg.position.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx)

  if (distance > COLLAPSE_CONFIG.stretchStartDistance) {
    return { stretch: 1, width: 1, angle }
  }

  // Calculate stretch based on distance (closer = more stretched)
  const t = 1 - distance / COLLAPSE_CONFIG.stretchStartDistance
  const eased = t * t // Quadratic ease-in for dramatic effect near the hole

  const stretch = 1 + eased * (COLLAPSE_CONFIG.maxStretch - 1)
  const width = 1 - eased * (1 - COLLAPSE_CONFIG.minWidth)

  return { stretch, width, angle }
}

/**
 * Check if collapse is active
 */
export function isCollapseActive(): boolean {
  return collapseState.value.active
}

/**
 * Get collapse progress (0-1)
 */
export function getCollapseProgress(): number {
  return collapseState.value.progress
}

/**
 * Get current wave intensity (0-1) for visual sync
 */
export function getCollapseWaveIntensity(): number {
  if (!collapseState.value.active) return 0
  return getWaveIntensity(collapseState.value.progress)
}

/**
 * Check if a package has been absorbed
 */
export function isPackageAbsorbed(pkgId: string): boolean {
  return collapseState.value.absorbedPackages.has(pkgId)
}

/**
 * Calculate the wave intensity multiplier based on progress
 * Creates a rhythm of pull → pause → stronger pull
 * Always maintains minimum pull to prevent stalling
 */
function getWaveIntensity(progress: number): number {
  const { waveCount, wavePauseDuration, waveIntensities } = COLLAPSE_CONFIG

  // Each wave takes up an equal portion of the total time
  const waveLength = 1 / waveCount
  const currentWaveIndex = Math.min(
    waveCount - 1,
    Math.floor(progress / waveLength)
  )
  const waveProgress = (progress % waveLength) / waveLength

  // Get intensity for current wave
  const baseIntensity = waveIntensities[currentWaveIndex] ?? 1

  // Within each wave: ramp up → hold → pause
  // 0-0.2: ramp up (from 0.4 to 1.0)
  // 0.2-0.85: full intensity
  // 0.85-1.0: pause (reduced but never zero)
  const rampEnd = 0.2
  const pauseStart = 1 - wavePauseDuration
  const minIntensity = 0.4 // Always maintain some pull

  let waveMultiplier: number
  if (waveProgress < rampEnd) {
    // Ramp up phase - start at minIntensity, ease to 1.0
    const rampProgress = waveProgress / rampEnd
    const eased = rampProgress * rampProgress // Quadratic ease-in
    waveMultiplier = minIntensity + (1 - minIntensity) * eased
  } else if (waveProgress < pauseStart) {
    // Full intensity phase
    waveMultiplier = 1
  } else {
    // Pause phase - ease down but maintain minimum
    const pauseProgress = (waveProgress - pauseStart) / wavePauseDuration
    const eased = (1 - pauseProgress) * (1 - pauseProgress)
    waveMultiplier = minIntensity + (1 - minIntensity) * eased
  }

  return baseIntensity * waveMultiplier
}

/**
 * Update physics during collapse - gravitational pull toward black hole
 * Uses wave-based rhythm for dramatic effect
 * Returns true when all packages have been absorbed
 */
export function updateCollapsePhysics(deltaTime: number): boolean {
  if (!collapseState.value.active) return false

  // Update progress
  const elapsed = (Date.now() - collapseState.value.startTime) / 1000
  collapseState.value.progress = Math.min(1, elapsed / COLLAPSE_CONFIG.duration)

  const progress = collapseState.value.progress
  const waveIntensity = getWaveIntensity(progress)

  const targetX = collapseState.value.targetX
  const targetY = collapseState.value.targetY
  const rawPackages = toRaw(gameState.packages)
  const packages = Array.from(rawPackages.values())

  let allAbsorbed = true

  for (const pkg of packages) {
    // Skip already absorbed packages
    if (collapseState.value.absorbedPackages.has(pkg.id)) {
      continue
    }

    allAbsorbed = false

    // Calculate direction and distance to black hole
    const dx = targetX - pkg.position.x
    const dy = targetY - pkg.position.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Check for absorption
    if (distance < COLLAPSE_CONFIG.absorptionRadius) {
      markPackageAbsorbed(pkg.id)
      continue
    }

    // Normalize direction
    const nx = dx / distance
    const ny = dy / distance

    // Base multipliers
    const progressMult = 1 + progress * 2.5 // 1x to 3.5x over time
    const distanceMult =
      1 + COLLAPSE_CONFIG.stretchStartDistance / Math.max(50, distance)

    // Apply wave intensity - creates the pull→pause→pull rhythm
    const acceleration =
      COLLAPSE_CONFIG.baseAcceleration *
      progressMult *
      distanceMult *
      waveIntensity

    // Apply gravitational acceleration
    pkg.velocity.vx += nx * acceleration * deltaTime
    pkg.velocity.vy += ny * acceleration * deltaTime

    // Clamp velocity
    const collapseSpeed = Math.sqrt(pkg.velocity.vx ** 2 + pkg.velocity.vy ** 2)
    if (collapseSpeed > COLLAPSE_CONFIG.maxVelocity) {
      pkg.velocity.vx =
        (pkg.velocity.vx / collapseSpeed) * COLLAPSE_CONFIG.maxVelocity
      pkg.velocity.vy =
        (pkg.velocity.vy / collapseSpeed) * COLLAPSE_CONFIG.maxVelocity
    }

    // Update position
    pkg.position.x += pkg.velocity.vx * deltaTime
    pkg.position.y += pkg.velocity.vy * deltaTime
  }

  // Complete when all absorbed or time is up
  return allAbsorbed || collapseState.value.progress >= 1
}

// ============================================
// EVENT SUBSCRIPTIONS
// ============================================

// Handle physics:trigger-organize event from symlinks module
// This decouples symlinks → physics to break circular dependency
on('physics:trigger-organize', ({ relocatedIds }) => {
  for (const pkgId of relocatedIds) {
    markPackageRelocated(pkgId)
  }
  triggerOrganizeBoost()
})
