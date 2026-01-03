// Tutorial indicators logic - decides what indicators/vignettes to show
// Based on game state and tutorial progress

import { gameState, computed_canPrestige } from '../game/state'
import {
  isInPackageScope,
  getCurrentScopePackages,
  getCurrentScopeWires,
  getCurrentScopeRoot,
} from '../game/scope'
import { getAllDuplicateGroups } from '../game/symlinks'
import { Colors } from '../rendering/colors'
import * as tutorialState from './tutorial-state'

// ============================================
// TYPES
// ============================================

export interface EdgeIndicator {
  worldX: number
  worldY: number
  color: number
  size: number
  pulseRate: number
  persistent: boolean
  id: string
  // Optional: for teaching arrows positioned at screen coords pointing inward
  screenX?: number
  screenY?: number
  pointTowardX?: number
  pointTowardY?: number
  targetRadius?: number
}

export interface Vignette {
  color: number
  alpha: number
  edges: ('top' | 'bottom' | 'left' | 'right')[]
}

interface ScreenBounds {
  width: number
  height: number
  margin: number
}

type WorldToScreenFn = (x: number, y: number) => { x: number; y: number }

// ============================================
// UTILITIES
// ============================================

function isOffScreen(x: number, y: number, bounds: ScreenBounds): boolean {
  return (
    x < bounds.margin ||
    x > bounds.width - bounds.margin ||
    y < bounds.margin ||
    y > bounds.height - bounds.margin
  )
}

function getClosestEdge(
  x: number,
  y: number,
  bounds: ScreenBounds
): 'top' | 'bottom' | 'left' | 'right' {
  const distances = {
    left: x,
    right: bounds.width - x,
    top: y,
    bottom: bounds.height - y,
  }

  let closest: 'top' | 'bottom' | 'left' | 'right' = 'left'
  let minDist = Infinity

  for (const [edge, dist] of Object.entries(distances)) {
    if (dist < minDist) {
      minDist = dist
      closest = edge as typeof closest
    }
  }

  return closest
}

// ============================================
// CONFLICT INDICATORS (ROOT SCOPE)
// ============================================

export function getConflictIndicators(
  bounds: ScreenBounds,
  worldToScreen: WorldToScreenFn,
  now: number
): { indicators: EdgeIndicator[]; vignettes: Vignette[] } {
  const indicators: EdgeIndicator[] = []
  const vignettes: Vignette[] = []

  if (isInPackageScope()) return { indicators, vignettes }

  tutorialState.setHasActiveConflict(false)

  for (const wire of gameState.wires.values()) {
    if (!wire.conflicted) continue

    tutorialState.setHasActiveConflict(true)

    const fromPkg = gameState.packages.get(wire.fromId)
    const toPkg = gameState.packages.get(wire.toId)
    if (!fromPkg || !toPkg) continue

    // Track first conflict
    if (!tutorialState.getHasSeenFirstConflict()) {
      tutorialState.setHasSeenFirstConflict(true)
      tutorialState.setFirstConflictTime(now)
    }

    const midX = (fromPkg.position.x + toPkg.position.x) / 2
    const midY = (fromPkg.position.y + toPkg.position.y) / 2
    const screenPos = worldToScreen(midX, midY)

    if (isOffScreen(screenPos.x, screenPos.y, bounds)) {
      indicators.push({
        worldX: midX,
        worldY: midY,
        color: Colors.borderConflict,
        size: 20,
        pulseRate: 3,
        persistent: true,
        id: `conflict-${wire.id}`,
      })

      const edge = getClosestEdge(screenPos.x, screenPos.y, bounds)
      if (!vignettes.some((v) => v.edges.includes(edge))) {
        vignettes.push({
          color: Colors.borderConflict,
          alpha: 0.15,
          edges: [edge],
        })
      }
    }
  }

  // First conflict flash vignette (skip for prestiged players)
  if (
    tutorialState.getHasSeenFirstConflict() &&
    gameState.meta.cacheTokens === 0
  ) {
    const elapsed = now - tutorialState.getFirstConflictTime()
    if (elapsed < 500) {
      const flashProgress = elapsed / 500
      const flashAlpha = 0.2 * (1 - flashProgress)
      vignettes.push({
        color: Colors.borderConflict,
        alpha: flashAlpha,
        edges: ['top', 'bottom', 'left', 'right'],
      })
    }
  }

  return { indicators, vignettes }
}

// ============================================
// INNER SCOPE CONFLICT INDICATORS
// ============================================

// Teaching lines removed - ghost hand will handle teaching
// Only shows off-screen arrows for navigation
export function getInnerConflictIndicators(
  bounds: ScreenBounds,
  worldToScreen: WorldToScreenFn,
  _now: number
): { indicators: EdgeIndicator[]; vignettes: Vignette[] } {
  const indicators: EdgeIndicator[] = []
  const vignettes: Vignette[] = []

  if (!isInPackageScope()) {
    return { indicators, vignettes }
  }

  const scopeWires = getCurrentScopeWires()
  const scopePackages = getCurrentScopePackages()
  const scopeRoot = getCurrentScopeRoot()

  // Only show off-screen arrows for conflicts
  for (const wire of scopeWires.values()) {
    if (!wire.conflicted) continue

    const fromPkg =
      scopePackages.get(wire.fromId) ||
      (scopeRoot && scopeRoot.id === wire.fromId ? scopeRoot : null)
    const toPkg = scopePackages.get(wire.toId)
    if (!fromPkg || !toPkg) continue

    const midX = (fromPkg.position.x + toPkg.position.x) / 2
    const midY = (fromPkg.position.y + toPkg.position.y) / 2
    const screenPos = worldToScreen(midX, midY)
    const offScreen = isOffScreen(screenPos.x, screenPos.y, bounds)

    if (offScreen) {
      indicators.push({
        worldX: midX,
        worldY: midY,
        color: Colors.borderConflict,
        size: 18,
        pulseRate: 3,
        persistent: true,
        id: `inner-conflict-${wire.id}`,
      })
    }
  }

  return { indicators, vignettes }
}

// ============================================
// DUPLICATE/SYMLINK INDICATORS
// ============================================

// Teaching lines removed - ghost hand will handle teaching
// Only shows off-screen arrows for navigation
export function getDuplicateIndicators(
  bounds: ScreenBounds,
  worldToScreen: WorldToScreenFn,
  _now: number
): { indicators: EdgeIndicator[]; vignettes: Vignette[] } {
  const indicators: EdgeIndicator[] = []
  const vignettes: Vignette[] = []

  const inScope = isInPackageScope()
  const duplicateGroups = getAllDuplicateGroups()
  const scopePackages = inScope ? getCurrentScopePackages() : gameState.packages

  // Only show off-screen arrows (no teaching lines)
  for (const group of duplicateGroups) {
    if (group.packageIds.length < 2) continue

    let hasOnScreen = false
    let offScreenPos: { x: number; y: number } | null = null

    for (const pkgId of group.packageIds) {
      const pkg = scopePackages.get(pkgId)
      if (!pkg) continue

      const screenPos = worldToScreen(pkg.position.x, pkg.position.y)
      if (isOffScreen(screenPos.x, screenPos.y, bounds)) {
        if (!offScreenPos) {
          offScreenPos = { x: pkg.position.x, y: pkg.position.y }
        }
      } else {
        hasOnScreen = true
      }
    }

    // Only show arrow if one duplicate is on-screen and another is off-screen
    if (hasOnScreen && offScreenPos) {
      indicators.push({
        worldX: offScreenPos.x,
        worldY: offScreenPos.y,
        color: group.haloColor,
        size: 12,
        pulseRate: 1.5,
        persistent: false,
        id: `symlink-${group.identityName}`,
      })
    }
  }

  return { indicators, vignettes }
}

// ============================================
// SCOPE EXIT TEACHING
// ============================================

// Teaching line removed - back button is always visible, ghost hand can show if needed
export function getScopeExitIndicators(_bounds: ScreenBounds): {
  indicators: EdgeIndicator[]
  vignettes: Vignette[]
} {
  return { indicators: [], vignettes: [] }
}

// ============================================
// FIRST SPAWNED NODE TEACHING
// ============================================

// Teaching line removed - ghost hand will handle this instead
export function getFirstSpawnedIndicators(
  _bounds: ScreenBounds,
  _worldToScreen: WorldToScreenFn,
  _now: number
): { indicators: EdgeIndicator[]; vignettes: Vignette[] } {
  return { indicators: [], vignettes: [] }
}

// ============================================
// PRESTIGE TEACHING
// ============================================

// Teaching line to panel removed - ghost hand will handle teaching
// Only shows off-screen arrow when prestige-ready root is not visible
export function getPrestigeIndicators(
  bounds: ScreenBounds,
  worldToScreen: WorldToScreenFn
): { indicators: EdgeIndicator[]; vignettes: Vignette[] } {
  const indicators: EdgeIndicator[] = []
  const vignettes: Vignette[] = []

  if (isInPackageScope() || !computed_canPrestige.value) {
    return { indicators, vignettes }
  }

  const rootPkg = gameState.rootId
    ? gameState.packages.get(gameState.rootId)
    : null
  if (!rootPkg) return { indicators, vignettes }

  const screenPos = worldToScreen(rootPkg.position.x, rootPkg.position.y)
  const isRootOffScreen = isOffScreen(screenPos.x, screenPos.y, bounds)

  // Only show arrow if prestige-ready root is off-screen
  if (isRootOffScreen) {
    indicators.push({
      worldX: rootPkg.position.x,
      worldY: rootPkg.position.y,
      color: 0xa78bfa,
      size: 24,
      pulseRate: 1,
      persistent: true,
      id: 'ship',
    })
  }

  return { indicators, vignettes }
}

// ============================================
// AGGREGATE ALL INDICATORS
// ============================================

export function getAllIndicators(
  screenWidth: number,
  screenHeight: number,
  worldToScreen: WorldToScreenFn,
  now: number
): { indicators: EdgeIndicator[]; vignettes: Vignette[] } {
  const bounds: ScreenBounds = {
    width: screenWidth,
    height: screenHeight,
    margin: 40,
  }
  const allIndicators: EdgeIndicator[] = []
  const allVignettes: Vignette[] = []

  const addResults = (results: {
    indicators: EdgeIndicator[]
    vignettes: Vignette[]
  }) => {
    allIndicators.push(...results.indicators)
    allVignettes.push(...results.vignettes)
  }

  // Collect from all sources
  addResults(getConflictIndicators(bounds, worldToScreen, now))
  addResults(getInnerConflictIndicators(bounds, worldToScreen, now))
  addResults(getDuplicateIndicators(bounds, worldToScreen, now))
  addResults(getScopeExitIndicators(bounds))
  addResults(getFirstSpawnedIndicators(bounds, worldToScreen, now))
  addResults(getPrestigeIndicators(bounds, worldToScreen))

  return { indicators: allIndicators, vignettes: allVignettes }
}
