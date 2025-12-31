// Hoisting system - deduplicating shared deps to root ring
// Like npm's node_modules hoisting but visible and interactive
// Only handles layer 1 deps (direct children of top-level packages)

import { gameState } from './state'
import { generateId } from './id-generator'
import { addWeight } from './mutations'
import type { HoistedDep } from './types'
import type { PackageIdentity } from './registry'

// Constants for hoist ring layout
const BASE_RING_RADIUS = 60 // Inner ring radius at full size
const RING_GAP = 25 // Gap between inner and outer ring
const MAX_PER_RING_FULL_SIZE = 8 // Max items on inner ring before scaling

/**
 * Get layout info for current hoisted deps count
 * Returns scale factor and ring radii
 */
export function getHoistLayoutInfo(): {
  scale: number
  innerRadius: number
  outerRadius: number
  needsOuterRing: boolean
} {
  const count = gameState.hoistedDeps.size

  if (count <= MAX_PER_RING_FULL_SIZE) {
    // Single ring, full size
    return {
      scale: 1.0,
      innerRadius: BASE_RING_RADIUS,
      outerRadius: 0,
      needsOuterRing: false,
    }
  }

  // Scale down to 50% and use two rings
  const scale = 0.5
  const scaledGap = RING_GAP * scale
  return {
    scale,
    innerRadius: BASE_RING_RADIUS - scaledGap / 2,
    outerRadius: BASE_RING_RADIUS + scaledGap / 2,
    needsOuterRing: true,
  }
}

/**
 * Redistribute all hoisted deps across rings when count changes
 */
function redistributeRings(): void {
  const deps = Array.from(gameState.hoistedDeps.values())
  const count = deps.length

  if (count === 0) return

  const layout = getHoistLayoutInfo()

  if (!layout.needsOuterRing) {
    // All on inner ring, evenly spaced
    deps.forEach((dep, i) => {
      dep.ringIndex = 0
      dep.orbitAngle = -Math.PI / 2 + (i / count) * Math.PI * 2
    })
  } else {
    // Split between inner and outer rings
    // Inner ring gets slightly more (ceil)
    const innerCount = Math.ceil(count / 2)

    deps.forEach((dep, i) => {
      if (i < innerCount) {
        dep.ringIndex = 0
        dep.orbitAngle = -Math.PI / 2 + (i / innerCount) * Math.PI * 2
      } else {
        dep.ringIndex = 1
        // Offset outer ring by half step for better packing
        const outerIndex = i - innerCount
        const outerCount = count - innerCount
        dep.orbitAngle =
          -Math.PI / 2 +
          Math.PI / outerCount +
          (outerIndex / outerCount) * Math.PI * 2
      }
    })
  }
}

// ============================================
// SHARED DEP DETECTION (Layer 1 only)
// ============================================

/**
 * Find all package names that appear in multiple top-level packages' layer 1
 * Only scans direct children of top-level packages (not deeper)
 * Returns map of depName -> list of package IDs that contain it
 */
export function findSharedDeps(): Map<string, string[]> {
  const depLocations = new Map<string, string[]>()

  // Scan all top-level packages' internal deps (layer 1 only)
  for (const [pkgId, pkg] of gameState.packages) {
    if (pkg.parentId !== gameState.rootId) continue // Skip non-top-level
    if (!pkg.internalPackages) continue

    for (const internalPkg of pkg.internalPackages.values()) {
      if (!internalPkg.identity) continue
      if (internalPkg.isGhost) continue // Skip already-ghosted

      const depName = internalPkg.identity.name
      const existing = depLocations.get(depName) || []
      if (!existing.includes(pkgId)) {
        existing.push(pkgId)
        depLocations.set(depName, existing)
      }
    }
  }

  // Filter to only shared deps (appear in 2+ packages) that aren't already hoisted
  const sharedDeps = new Map<string, string[]>()
  for (const [depName, pkgIds] of depLocations) {
    if (pkgIds.length >= 2 && !isDepHoisted(depName)) {
      sharedDeps.set(depName, pkgIds)
    }
  }

  return sharedDeps
}

/**
 * Check if a specific package can be hoisted (has shared dep)
 */
export function canHoist(packageId: string): {
  canHoist: boolean
  depName?: string
  sourcePackages?: string[]
} {
  const pkg = gameState.packages.get(packageId)
  if (!pkg) return { canHoist: false }
  if (pkg.parentId !== gameState.rootId) return { canHoist: false }
  if (!pkg.internalPackages) return { canHoist: false }

  const sharedDeps = findSharedDeps()

  // Check if any of this package's internal deps are shared AND not already hoisted
  for (const internalPkg of pkg.internalPackages.values()) {
    if (!internalPkg.identity) continue
    if (internalPkg.isGhost) continue

    const depName = internalPkg.identity.name

    // Skip if this dep is already hoisted
    if (isDepHoisted(depName)) continue

    const sources = sharedDeps.get(depName)
    if (sources && sources.length >= 2) {
      return { canHoist: true, depName, sourcePackages: sources }
    }
  }

  return { canHoist: false }
}

// ============================================
// DROP ZONE DETECTION
// ============================================

const DROP_ZONE_RADIUS = 100 // Distance from root where drop zone activates

/**
 * Check if a position is in the hoist drop zone (near root)
 */
export function isInDropZone(x: number, y: number): boolean {
  if (!gameState.rootId) return false
  const root = gameState.packages.get(gameState.rootId)
  if (!root) return false

  const dx = x - root.position.x
  const dy = y - root.position.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  return distance <= DROP_ZONE_RADIUS
}

/**
 * Get distance to drop zone center (root)
 */
export function getDropZoneDistance(x: number, y: number): number {
  if (!gameState.rootId) return Infinity
  const root = gameState.packages.get(gameState.rootId)
  if (!root) return Infinity

  const dx = x - root.position.x
  const dy = y - root.position.y
  return Math.sqrt(dx * dx + dy * dy)
}

// ============================================
// HOISTING ACTIONS
// ============================================

/**
 * Hoist a shared dep to the root ring (layer 1 only)
 * @param depName The name of the dependency to hoist
 * @returns The hoisted dep ID, or null if failed
 */
export function hoistDep(depName: string): string | null {
  const sharedDeps = findSharedDeps()
  const sourcePackages = sharedDeps.get(depName)
  if (!sourcePackages || sourcePackages.length < 2) return null

  // Check if already hoisted
  for (const hoisted of gameState.hoistedDeps.values()) {
    if (hoisted.identity.name === depName) {
      return hoisted.id // Already hoisted
    }
  }

  // Get the dep identity and weight from first source
  let identity: PackageIdentity | null = null
  let totalWeight = 0
  const internalDepIds: { pkgId: string; internalId: string }[] = []

  for (const pkgId of sourcePackages) {
    const pkg = gameState.packages.get(pkgId)
    if (!pkg?.internalPackages) continue

    for (const [internalId, internalPkg] of pkg.internalPackages) {
      if (internalPkg.identity?.name === depName && !internalPkg.isGhost) {
        if (!identity) {
          identity = internalPkg.identity
        }
        totalWeight += internalPkg.size
        internalDepIds.push({ pkgId, internalId })
      }
    }
  }

  if (!identity) return null

  // Get root position for orbit
  const root = gameState.rootId
    ? gameState.packages.get(gameState.rootId)
    : null
  if (!root) return null

  // Create hoisted dep (position/angle will be set by redistributeRings)
  const hoistedId = generateId()
  const hoistedDep: HoistedDep = {
    id: hoistedId,
    identity,
    sourcePackages,
    position: { x: root.position.x, y: root.position.y }, // Placeholder
    orbitAngle: 0, // Will be set by redistribute
    weight: totalWeight / sourcePackages.length, // Deduplicated weight
    ringIndex: 0, // Will be set by redistribute
  }

  gameState.hoistedDeps.set(hoistedId, hoistedDep)

  // Redistribute all deps across rings for even spacing
  redistributeRings()

  // Mark source instances as ghosts (layer 1 only)
  for (const { pkgId, internalId } of internalDepIds) {
    const pkg = gameState.packages.get(pkgId)
    if (!pkg?.internalPackages) continue

    const internalPkg = pkg.internalPackages.get(internalId)
    if (internalPkg) {
      internalPkg.isGhost = true
      internalPkg.ghostTargetId = hoistedId
      internalPkg.ghostTargetScope = 'hoisted'

      // Reduce parent package weight
      pkg.size -= internalPkg.size
      gameState.resources.weight -= internalPkg.size
    }
  }

  // Add hoisted weight (deduplicated, with compression)
  addWeight(hoistedDep.weight)

  // Mark first hoist for onboarding
  if (!gameState.onboarding.firstHoistSeen) {
    gameState.onboarding.firstHoistSeen = true
  }

  return hoistedId
}

/**
 * Result of a batch hoist operation - includes animation data
 */
export interface HoistResult {
  hoistedId: string
  sourcePositions: { x: number; y: number }[] // All source package positions for animation
  targetPosition: { x: number; y: number }
}

/**
 * Hoist ALL shared deps at once (Global Hoist All)
 * Returns animation data for each hoisted dep
 */
export function hoistAllSharedDeps(): HoistResult[] {
  const sharedDeps = findSharedDeps()
  if (sharedDeps.size === 0) return []

  const results: HoistResult[] = []

  // Hoist each shared dep
  for (const depName of sharedDeps.keys()) {
    // Collect source positions BEFORE hoisting (for animation)
    const sourcePackages = sharedDeps.get(depName) || []
    const sourcePositions: { x: number; y: number }[] = []

    for (const pkgId of sourcePackages) {
      const pkg = gameState.packages.get(pkgId)
      if (pkg) {
        sourcePositions.push({ x: pkg.position.x, y: pkg.position.y })
      }
    }

    // Perform the hoist
    const hoistedId = hoistDep(depName)

    if (hoistedId) {
      const hoisted = gameState.hoistedDeps.get(hoistedId)
      if (hoisted) {
        results.push({
          hoistedId,
          sourcePositions,
          targetPosition: { x: hoisted.position.x, y: hoisted.position.y },
        })
      }
    }
  }

  return results
}

/**
 * Get all hoisted deps for rendering
 */
export function getHoistedDeps(): HoistedDep[] {
  return Array.from(gameState.hoistedDeps.values())
}

/**
 * Update hoisted deps positions (orbit around root, multi-ring layout)
 */
export function updateHoistedPositions(): void {
  const root = gameState.rootId
    ? gameState.packages.get(gameState.rootId)
    : null
  if (!root) return

  const layout = getHoistLayoutInfo()

  for (const hoisted of gameState.hoistedDeps.values()) {
    const radius =
      hoisted.ringIndex === 0 ? layout.innerRadius : layout.outerRadius
    hoisted.position.x = root.position.x + Math.cos(hoisted.orbitAngle) * radius
    hoisted.position.y = root.position.y + Math.sin(hoisted.orbitAngle) * radius
  }
}

// ============================================
// HOIST STATE QUERIES
// ============================================

/**
 * Check if a dep name is already hoisted
 */
export function isDepHoisted(depName: string): boolean {
  for (const hoisted of gameState.hoistedDeps.values()) {
    if (hoisted.identity.name === depName) {
      return true
    }
  }
  return false
}

/**
 * Get the hoisted dep for a ghost package
 */
export function getHoistedDepForGhost(
  ghostTargetId: string
): HoistedDep | null {
  return gameState.hoistedDeps.get(ghostTargetId) || null
}
