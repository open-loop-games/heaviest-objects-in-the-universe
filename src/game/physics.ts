// Force-directed graph physics for node positioning
// Enhanced with tree-organizing forces for cleaner layouts

import { gameConfig, graph, rootIdRef } from './state'
import { collapseState, markPackageAbsorbed, dragState } from './ui-state'
import type { Package, Wire } from './types'
import { getAllDuplicateGroups } from './symlinks'
import { getGraphAtPath } from './scope'
import { on } from './events'
import type { GraphEdge, SpatialGraph } from 'open-loop-engine'

const RADIAL_CONFIG = {
  baseRadius: 120,
  radiusPerDepth: 100,
  minAngularSpread: 0.15,
  anchorStrength: 0.12,
  anchorBoostStrength: 0.25,
  repulsionRange: 70,
  hardPushDistance: 35,
  hardPushMultiplier: 2.5,
  phasingDuration: 2.0,
  phasingRepulsionMult: 0.05,
  organizeBoostDuration: 0.8,
  chaosJitter: 5,
  topLevelSpacing: 90,
  ringGap: 100,
  maxPerRing: 10,
}

let organizeBoostTimer = 0
let lastCleanliness = 1

const phasingPackages = new Map<string, number>()

const anchorPositions = new Map<string, { x: number; y: number }>()

/** Drop physics-side per-package state. Call on ship / prestige / load —
 *  ID counters reset on those paths, so a stale phasing timer keyed by
 *  `pkg_0` would otherwise apply to the next run's `pkg_0`. */
export function resetPhysicsState(): void {
  phasingPackages.clear()
  anchorPositions.clear()
  organizeBoostTimer = 0
  lastCleanliness = 1
}

/** Children of `pkgId` in `g` via outgoing dependency edges. */
function getDependencyChildren(
  g: SpatialGraph<Package, Wire>,
  pkgId: string
): string[] {
  if (!g.getNode(pkgId)) return []
  const result: string[] = []
  let edgeIter: Iterable<GraphEdge<Wire>>
  try {
    edgeIter = g.edgesOf(pkgId)
  } catch {
    return result
  }
  for (const edge of edgeIter) {
    if (edge.fromId === pkgId && edge.data.wireType === 'dependency') {
      result.push(edge.toId)
    }
  }
  return result
}

function getSubtreeSize(g: SpatialGraph<Package, Wire>, pkgId: string): number {
  const node = g.getNode(pkgId)
  if (!node) return 0
  let size = 1
  for (const childId of getDependencyChildren(g, pkgId)) {
    size += getSubtreeSize(g, childId)
  }
  return size
}

/**
 * Compute radial anchor positions for all root-graph packages.
 * Root at center, top-level packages in multi-ring layout.
 */
function computeRadialAnchors(rootId: string | null): void {
  anchorPositions.clear()

  if (!rootId) return
  const rootNode = graph.getNode(rootId)
  if (!rootNode) return

  anchorPositions.set(rootId, { x: 0, y: 0 })

  assignTopLevelAnchors(rootId)
}

function getCapacityForRing(radius: number, spacing: number): number {
  const circumference = 2 * Math.PI * radius
  return Math.max(1, Math.floor(circumference / spacing))
}

function assignTopLevelAnchors(rootId: string): void {
  const childIds: string[] = []
  for (const id of graph.nodes.keys()) {
    if (id === rootId) continue
    childIds.push(id)
  }
  if (childIds.length === 0) return

  const childSizes: { id: string; size: number; pkg: Package }[] = []
  for (const childId of childIds) {
    const node = graph.getNode(childId)
    if (!node) continue
    // Top-levels at root scope have no children at root scope (their deps live
    // in their child graph), so subtree size is 1 — but compute defensively.
    const size = Math.max(1, getSubtreeSize(graph, childId))
    childSizes.push({ id: childId, size, pkg: node.data })
  }

  if (childSizes.length === 0) return

  const rings: (typeof childSizes)[] = []
  let currentRing: typeof childSizes = []
  let ringIndex = 0
  let currentRadius = RADIAL_CONFIG.baseRadius

  let ringCapacity = getCapacityForRing(
    currentRadius,
    RADIAL_CONFIG.topLevelSpacing
  )

  for (const child of childSizes) {
    if (currentRing.length >= ringCapacity) {
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

  if (currentRing.length > 0) {
    rings.push(currentRing)
  }

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r]!
    const radius = RADIAL_CONFIG.baseRadius + r * RADIAL_CONFIG.ringGap

    let totalSize = 0
    for (const child of ring) {
      totalSize += child.size
    }

    const ringOffset = r * 0.3
    let currentAngle = -Math.PI / 2 + ringOffset

    for (const { id: childId, size } of ring) {
      const proportion = size / totalSize
      const childAngleSpan = Math.max(
        RADIAL_CONFIG.minAngularSpread,
        Math.PI * 2 * proportion
      )

      const childAngle = currentAngle + childAngleSpan / 2

      const x = Math.cos(childAngle) * radius
      const y = Math.sin(childAngle) * radius

      anchorPositions.set(childId, { x, y })

      // Top-levels at root have no in-root-graph children; recurse anyway
      // for safety (no-op when subtree is empty).
      assignChildAnchors(childId, currentAngle, childAngleSpan)

      currentAngle += childAngleSpan
    }
  }
}

function assignChildAnchors(
  parentId: string,
  startAngle: number,
  angleSpan: number
): void {
  const parentNode = graph.getNode(parentId)
  if (!parentNode) return
  const childIds = getDependencyChildren(graph, parentId)
  if (childIds.length === 0) return

  const childDepth = parentNode.data.depth + 1
  const radius =
    RADIAL_CONFIG.baseRadius + (childDepth - 1) * RADIAL_CONFIG.radiusPerDepth

  const childSizes: { id: string; size: number }[] = []
  let totalSize = 0

  for (const childId of childIds) {
    const size = Math.max(1, getSubtreeSize(graph, childId))
    childSizes.push({ id: childId, size })
    totalSize += size
  }

  let currentAngle = startAngle

  for (const { id: childId, size } of childSizes) {
    const proportion = size / totalSize
    const childAngleSpan = Math.max(
      RADIAL_CONFIG.minAngularSpread,
      angleSpan * proportion
    )

    const childAngle = currentAngle + childAngleSpan / 2

    const x = Math.cos(childAngle) * radius
    const y = Math.sin(childAngle) * radius

    anchorPositions.set(childId, { x, y })

    assignChildAnchors(childId, currentAngle, childAngleSpan)

    currentAngle += childAngleSpan
  }
}

export function getAnchorPosition(
  pkgId: string
): { x: number; y: number } | null {
  return anchorPositions.get(pkgId) || null
}

/**
 * Mark a package as relocated (needs phasing).
 */
export function markPackageRelocated(packageId: string): void {
  phasingPackages.set(packageId, RADIAL_CONFIG.phasingDuration)

  computeRadialAnchors(rootIdRef.value)

  const node = graph.getNode(packageId)
  const anchor = anchorPositions.get(packageId)

  if (node && anchor) {
    const pkg = node.data
    const teleportFactor = 0.6
    pkg.position.x =
      pkg.position.x + (anchor.x - pkg.position.x) * teleportFactor
    pkg.position.y =
      pkg.position.y + (anchor.y - pkg.position.y) * teleportFactor
    pkg.velocity.vx = (anchor.x - pkg.position.x) * 0.1
    pkg.velocity.vy = (anchor.y - pkg.position.y) * 0.1
  }
}

function isPhasing(packageId: string): boolean {
  return phasingPackages.has(packageId)
}

export function calculateCleanliness(): number {
  const duplicateGroups = getAllDuplicateGroups()
  const totalPackages = graph.nodes.size

  if (totalPackages <= 1) return 1

  let duplicateCount = 0
  for (const group of duplicateGroups) {
    duplicateCount += group.packageIds.length - 1
  }

  const rawCleanliness = 1 - duplicateCount / totalPackages
  return Math.max(0.1, Math.min(1, rawCleanliness))
}

export function triggerOrganizeBoost(): void {
  organizeBoostTimer = RADIAL_CONFIG.organizeBoostDuration
}

function getAnchorStrength(): number {
  return organizeBoostTimer > 0
    ? RADIAL_CONFIG.anchorBoostStrength
    : RADIAL_CONFIG.anchorStrength
}

export function updatePhysics(deltaTime: number): void {
  if (organizeBoostTimer > 0) {
    organizeBoostTimer = Math.max(0, organizeBoostTimer - deltaTime)
  }

  for (const [pkgId, timeLeft] of phasingPackages) {
    const newTime = timeLeft - deltaTime
    if (newTime <= 0) {
      phasingPackages.delete(pkgId)
    } else {
      phasingPackages.set(pkgId, newTime)
    }
  }

  const cleanliness = calculateCleanliness()
  lastCleanliness = cleanliness

  const packages: Package[] = []
  for (const node of graph.nodes.values()) {
    packages.push(node.data)
  }

  computeRadialAnchors(rootIdRef.value)

  const anchorStrength = getAnchorStrength()
  const chaosAmount = 1 - cleanliness

  const isRootDragging =
    dragState.value.packageId !== null && !dragState.value.isInternalScope
  const rootDraggedId = dragState.value.packageId

  for (const pkg of packages) {
    // Root stays anchored at origin
    if (pkg.id === rootIdRef.value) {
      pkg.position.x = 0
      pkg.position.y = 0
      pkg.velocity.vx = 0
      pkg.velocity.vy = 0
      continue
    }

    if (isRootDragging && pkg.id === rootDraggedId) {
      pkg.velocity.vx = 0
      pkg.velocity.vy = 0
      continue
    }

    const forces = calculateForces(pkg, packages, anchorStrength, chaosAmount)

    pkg.velocity.vx += forces.fx * deltaTime
    pkg.velocity.vy += forces.fy * deltaTime

    const dampingFactor = gameConfig.damping
    pkg.velocity.vx *= dampingFactor
    pkg.velocity.vy *= dampingFactor

    const maxSpeed = organizeBoostTimer > 0 ? 300 : 200
    const speed = Math.sqrt(pkg.velocity.vx ** 2 + pkg.velocity.vy ** 2)
    if (speed > maxSpeed) {
      pkg.velocity.vx = (pkg.velocity.vx / speed) * maxSpeed
      pkg.velocity.vy = (pkg.velocity.vy / speed) * maxSpeed
    }

    pkg.position.x += pkg.velocity.vx
    pkg.position.y += pkg.velocity.vy
  }
}

function calculateForces(
  pkg: Package,
  allPackages: Package[],
  anchorStrength: number,
  chaosAmount: number
): { fx: number; fy: number } {
  let fx = 0
  let fy = 0

  const pkgIsPhasing = isPhasing(pkg.id)

  const anchor = anchorPositions.get(pkg.id)
  if (anchor) {
    const dx = anchor.x - pkg.position.x
    const dy = anchor.y - pkg.position.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > 1) {
      const phasingMult = pkgIsPhasing ? 3.0 : 1.0
      const force = anchorStrength * phasingMult

      fx += dx * force
      fy += dy * force
    }
  }

  const repulsionMult = pkgIsPhasing ? RADIAL_CONFIG.phasingRepulsionMult : 1.0

  for (const other of allPackages) {
    if (other.id === pkg.id) continue

    const dx = pkg.position.x - other.position.x
    const dy = pkg.position.y - other.position.y
    const distSq = dx * dx + dy * dy
    const dist = Math.sqrt(distSq)

    if (dist < 1 || dist > RADIAL_CONFIG.repulsionRange) continue

    const otherIsPhasing = isPhasing(other.id)
    const effectiveMult =
      pkgIsPhasing || otherIsPhasing
        ? RADIAL_CONFIG.phasingRepulsionMult
        : repulsionMult

    const closeRangeMult =
      dist < RADIAL_CONFIG.hardPushDistance
        ? RADIAL_CONFIG.hardPushMultiplier
        : 1.0

    const force =
      (gameConfig.nodeRepulsion / distSq) * effectiveMult * closeRangeMult
    fx += (dx / dist) * force
    fy += (dy / dist) * force
  }

  if (chaosAmount > 0.3) {
    const jitterStrength = chaosAmount * RADIAL_CONFIG.chaosJitter
    fx += (Math.random() - 0.5) * jitterStrength * 0.1
    fy += (Math.random() - 0.5) * jitterStrength * 0.1
  }

  return { fx, fy }
}

export function getCleanliness(): number {
  return lastCleanliness
}

export function isOrganizing(): boolean {
  return organizeBoostTimer > 0
}

// ============================================
// INTERNAL SCOPE PHYSICS
// ============================================

const internalAnchorPositions = new Map<string, { x: number; y: number }>()

const INTERNAL_CONFIG = {
  spacingPerNode: 65,
  minRadius: 130,
  ringGap: 75,
  maxPerRing: 12,
  radiusPerDepth: 70,
  minAngularSpread: 0.2,
  anchorStrength: 0.18,
  repulsionRange: 60,
  hardPushDistance: 30,
  hardPushMultiplier: 3.0,
}

function computeInternalAnchors(
  scopeGraph: SpatialGraph<Package, Wire>,
  scopeRootId: string
): void {
  internalAnchorPositions.clear()

  internalAnchorPositions.set(scopeRootId, { x: 0, y: 0 })

  // First-level packages = direct dep children of scope owner.
  const firstLevelIds = getDependencyChildren(scopeGraph, scopeRootId)
  if (firstLevelIds.length === 0) return

  const firstLevel: Package[] = []
  for (const id of firstLevelIds) {
    const node = scopeGraph.getNode(id)
    if (node) firstLevel.push(node.data)
  }

  firstLevel.sort((a, b) => a.id.localeCompare(b.id))

  for (let i = 0; i < firstLevel.length; i++) {
    const pkg = firstLevel[i]!
    const ringIndex = Math.floor(i / INTERNAL_CONFIG.maxPerRing)
    const indexInRing = i % INTERNAL_CONFIG.maxPerRing
    const countInThisRing = Math.min(
      INTERNAL_CONFIG.maxPerRing,
      firstLevel.length - ringIndex * INTERNAL_CONFIG.maxPerRing
    )

    const radius =
      INTERNAL_CONFIG.minRadius + ringIndex * INTERNAL_CONFIG.ringGap

    const ringOffset = ringIndex * 0.15
    const angleStep = (Math.PI * 2) / countInThisRing
    const angle = -Math.PI / 2 + ringOffset + indexInRing * angleStep

    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius

    internalAnchorPositions.set(pkg.id, { x, y })

    const childBaseRadius = radius + INTERNAL_CONFIG.radiusPerDepth
    assignInternalChildAnchors(
      scopeGraph,
      pkg.id,
      angle,
      angleStep * 0.8,
      childBaseRadius
    )
  }
}

function assignInternalChildAnchors(
  scopeGraph: SpatialGraph<Package, Wire>,
  parentId: string,
  parentAngle: number,
  angleSpan: number,
  parentRadius: number,
  visited: Set<string> = new Set()
): void {
  if (visited.has(parentId)) return
  visited.add(parentId)

  const childIds = getDependencyChildren(scopeGraph, parentId)
  const children: Package[] = []
  for (const id of childIds) {
    if (visited.has(id)) continue
    const node = scopeGraph.getNode(id)
    if (node) children.push(node.data)
  }

  if (children.length === 0) return

  const childRadius = parentRadius + INTERNAL_CONFIG.radiusPerDepth

  const minRequiredSpan = children.length * INTERNAL_CONFIG.minAngularSpread
  const effectiveSpan = Math.max(angleSpan, minRequiredSpan)

  const angleStep = effectiveSpan / (children.length + 1)
  const startAngle = parentAngle - effectiveSpan / 2

  for (let i = 0; i < children.length; i++) {
    const child = children[i]!
    const childAngle = startAngle + angleStep * (i + 1)

    const x = Math.cos(childAngle) * childRadius
    const y = Math.sin(childAngle) * childRadius

    internalAnchorPositions.set(child.id, { x, y })

    assignInternalChildAnchors(
      scopeGraph,
      child.id,
      childAngle,
      angleStep,
      childRadius,
      visited
    )
  }
}

/**
 * Update physics for internal packages of a specific scope.
 */
export function updateInternalPhysics(
  scopePath: string[],
  deltaTime: number
): void {
  if (scopePath.length === 0) return

  const scopeGraph = getGraphAtPath(scopePath)
  if (!scopeGraph) return

  const scopeRootId = scopePath[scopePath.length - 1]!

  const packages: Package[] = []
  for (const [id, node] of scopeGraph.nodes) {
    if (id === scopeRootId) continue // skip shadow
    packages.push(node.data)
  }
  if (packages.length === 0) return

  const isDragging =
    dragState.value.packageId !== null && dragState.value.isInternalScope
  const draggedId = dragState.value.packageId

  computeInternalAnchors(scopeGraph, scopeRootId)

  for (const pkg of packages) {
    if (isDragging) {
      if (pkg.id !== draggedId) {
        pkg.velocity.vx = 0
        pkg.velocity.vy = 0
      }
      continue
    }

    let fx = 0
    let fy = 0

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

    for (const other of packages) {
      if (other.id === pkg.id) continue

      const rdx = pkg.position.x - other.position.x
      const rdy = pkg.position.y - other.position.y
      const distSq = rdx * rdx + rdy * rdy
      const rDist = Math.sqrt(distSq)

      if (rDist < 1 || rDist > INTERNAL_CONFIG.repulsionRange) continue

      const closeMult =
        rDist < INTERNAL_CONFIG.hardPushDistance
          ? INTERNAL_CONFIG.hardPushMultiplier
          : 1.0

      const force = (150 / distSq) * closeMult
      fx += (rdx / rDist) * force
      fy += (rdy / rDist) * force
    }

    pkg.velocity.vx += fx * deltaTime
    pkg.velocity.vy += fy * deltaTime

    const damping = 0.92
    pkg.velocity.vx *= damping
    pkg.velocity.vy *= damping

    const maxSpeed = 150
    const speed = Math.sqrt(pkg.velocity.vx ** 2 + pkg.velocity.vy ** 2)
    if (speed > maxSpeed) {
      pkg.velocity.vx = (pkg.velocity.vx / speed) * maxSpeed
      pkg.velocity.vy = (pkg.velocity.vy / speed) * maxSpeed
    }

    pkg.position.x += pkg.velocity.vx
    pkg.position.y += pkg.velocity.vy
  }
}

// ============================================
// COLLAPSE PHYSICS
// ============================================

const COLLAPSE_CONFIG = {
  duration: 5.0,
  baseAcceleration: 350,
  maxVelocity: 900,
  absorptionRadius: 15,
  stretchStartDistance: 300,
  maxStretch: 4.0,
  minWidth: 0.12,
  waveCount: 3,
  wavePauseDuration: 0.15,
  waveIntensities: [0.6, 0.85, 1.0],
}

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

  const t = 1 - distance / COLLAPSE_CONFIG.stretchStartDistance
  const eased = t * t

  const stretch = 1 + eased * (COLLAPSE_CONFIG.maxStretch - 1)
  const width = 1 - eased * (1 - COLLAPSE_CONFIG.minWidth)

  return { stretch, width, angle }
}

export function isCollapseActive(): boolean {
  return collapseState.value.active
}

export function getCollapseProgress(): number {
  return collapseState.value.progress
}

export function getCollapseWaveIntensity(): number {
  if (!collapseState.value.active) return 0
  return getWaveIntensity(collapseState.value.progress)
}

export function isPackageAbsorbed(pkgId: string): boolean {
  return collapseState.value.absorbedPackages.has(pkgId)
}

function getWaveIntensity(progress: number): number {
  const { waveCount, wavePauseDuration, waveIntensities } = COLLAPSE_CONFIG

  const waveLength = 1 / waveCount
  const currentWaveIndex = Math.min(
    waveCount - 1,
    Math.floor(progress / waveLength)
  )
  const waveProgress = (progress % waveLength) / waveLength

  const baseIntensity = waveIntensities[currentWaveIndex] ?? 1

  const rampEnd = 0.2
  const pauseStart = 1 - wavePauseDuration
  const minIntensity = 0.4

  let waveMultiplier: number
  if (waveProgress < rampEnd) {
    const rampProgress = waveProgress / rampEnd
    const eased = rampProgress * rampProgress
    waveMultiplier = minIntensity + (1 - minIntensity) * eased
  } else if (waveProgress < pauseStart) {
    waveMultiplier = 1
  } else {
    const pauseProgress = (waveProgress - pauseStart) / wavePauseDuration
    const eased = (1 - pauseProgress) * (1 - pauseProgress)
    waveMultiplier = minIntensity + (1 - minIntensity) * eased
  }

  return baseIntensity * waveMultiplier
}

/**
 * Update physics during collapse - gravitational pull toward black hole.
 */
export function updateCollapsePhysics(deltaTime: number): boolean {
  if (!collapseState.value.active) return false

  const elapsed = (Date.now() - collapseState.value.startTime) / 1000
  collapseState.value.progress = Math.min(1, elapsed / COLLAPSE_CONFIG.duration)

  const progress = collapseState.value.progress
  const waveIntensity = getWaveIntensity(progress)

  const targetX = collapseState.value.targetX
  const targetY = collapseState.value.targetY
  const packages: Package[] = []
  for (const node of graph.nodes.values()) {
    packages.push(node.data)
  }

  let allAbsorbed = true

  for (const pkg of packages) {
    if (collapseState.value.absorbedPackages.has(pkg.id)) {
      continue
    }

    allAbsorbed = false

    const dx = targetX - pkg.position.x
    const dy = targetY - pkg.position.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance < COLLAPSE_CONFIG.absorptionRadius) {
      markPackageAbsorbed(pkg.id)
      continue
    }

    const nx = dx / distance
    const ny = dy / distance

    const progressMult = 1 + progress * 2.5
    const distanceMult =
      1 + COLLAPSE_CONFIG.stretchStartDistance / Math.max(50, distance)

    const acceleration =
      COLLAPSE_CONFIG.baseAcceleration *
      progressMult *
      distanceMult *
      waveIntensity

    pkg.velocity.vx += nx * acceleration * deltaTime
    pkg.velocity.vy += ny * acceleration * deltaTime

    const collapseSpeed = Math.sqrt(pkg.velocity.vx ** 2 + pkg.velocity.vy ** 2)
    if (collapseSpeed > COLLAPSE_CONFIG.maxVelocity) {
      pkg.velocity.vx =
        (pkg.velocity.vx / collapseSpeed) * COLLAPSE_CONFIG.maxVelocity
      pkg.velocity.vy =
        (pkg.velocity.vy / collapseSpeed) * COLLAPSE_CONFIG.maxVelocity
    }

    pkg.position.x += pkg.velocity.vx * deltaTime
    pkg.position.y += pkg.velocity.vy * deltaTime
  }

  return allAbsorbed || collapseState.value.progress >= 1
}

// ============================================
// EVENT SUBSCRIPTIONS
// ============================================

on('physics:trigger-organize', ({ relocatedIds }) => {
  for (const pkgId of relocatedIds) {
    markPackageRelocated(pkgId)
  }
  triggerOrganizeBoost()
})
