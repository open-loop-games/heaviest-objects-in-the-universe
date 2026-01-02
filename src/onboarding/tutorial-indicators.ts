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

function findClosestEdgePoint(
  targetX: number,
  targetY: number,
  bounds: ScreenBounds
): { edgeX: number; edgeY: number } {
  const distToLeft = targetX
  const distToRight = bounds.width - targetX
  const distToTop = targetY
  const distToBottom = bounds.height - targetY
  const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom)

  if (minDist === distToLeft) {
    return { edgeX: 0, edgeY: targetY }
  } else if (minDist === distToRight) {
    return { edgeX: bounds.width, edgeY: targetY }
  } else if (minDist === distToTop) {
    return { edgeX: targetX, edgeY: 0 }
  } else {
    return { edgeX: targetX, edgeY: bounds.height }
  }
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

export function getInnerConflictIndicators(
  bounds: ScreenBounds,
  worldToScreen: WorldToScreenFn,
  now: number
): { indicators: EdgeIndicator[]; vignettes: Vignette[] } {
  const indicators: EdgeIndicator[] = []
  const vignettes: Vignette[] = []

  if (!isInPackageScope()) {
    tutorialState.setLastSymlinkSeenState(gameState.onboarding.firstSymlinkSeen)
    return { indicators, vignettes }
  }

  const scopeWires = getCurrentScopeWires()
  const scopePackages = getCurrentScopePackages()
  const scopeRoot = getCurrentScopeRoot()

  const isFirstInnerConflictTeaching =
    gameState.meta.cacheTokens === 0 &&
    gameState.onboarding.firstSymlinkSeen &&
    !gameState.onboarding.firstInnerConflictSeen

  // Detect when symlink teaching just completed
  if (
    gameState.onboarding.firstSymlinkSeen &&
    !tutorialState.getLastSymlinkSeenState()
  ) {
    tutorialState.setLastSymlinkSeenState(true)
    tutorialState.setConflictTeachingTargetWireId(null)

    for (const wire of scopeWires.values()) {
      if (wire.conflicted) {
        tutorialState.setConflictTeachingTargetWireId(wire.id)
        tutorialState.setHasSeenFirstInnerConflict(true)
        tutorialState.setFirstInnerConflictTime(now)
        break
      }
    }
  }

  // Clear target if wire is no longer conflicted
  const targetWireId = tutorialState.getConflictTeachingTargetWireId()
  if (targetWireId) {
    const targetWire = scopeWires.get(targetWireId)
    if (!targetWire || !targetWire.conflicted) {
      tutorialState.setConflictTeachingTargetWireId(null)
    }
  }

  let foundConflict = false

  for (const wire of scopeWires.values()) {
    if (!wire.conflicted) continue

    foundConflict = true
    const fromPkg =
      scopePackages.get(wire.fromId) ||
      (scopeRoot && scopeRoot.id === wire.fromId ? scopeRoot : null)
    const toPkg = scopePackages.get(wire.toId)
    if (!fromPkg || !toPkg) continue

    const midX = (fromPkg.position.x + toPkg.position.x) / 2
    const midY = (fromPkg.position.y + toPkg.position.y) / 2
    const screenPos = worldToScreen(midX, midY)
    const onScreen = !isOffScreen(screenPos.x, screenPos.y, {
      ...bounds,
      margin: 60,
    })

    const isTeachingTarget =
      isFirstInnerConflictTeaching &&
      wire.id === tutorialState.getConflictTeachingTargetWireId()

    if (isTeachingTarget) {
      const selectedWireId = tutorialState.getSelectedConflictWireId()
      const selectedActionPos = tutorialState.getSelectedConflictActionPos()
      const isPhase2 = selectedWireId === wire.id && selectedActionPos !== null

      let targetX: number, targetY: number
      if (isPhase2) {
        targetX = selectedActionPos!.x
        targetY = selectedActionPos!.y
      } else {
        const nodeScreenPos = worldToScreen(toPkg.position.x, toPkg.position.y)
        targetX = nodeScreenPos.x
        targetY = nodeScreenPos.y
      }

      const { edgeX, edgeY } = findClosestEdgePoint(targetX, targetY, bounds)

      indicators.push({
        worldX: midX,
        worldY: midY,
        color: Colors.borderConflict,
        size: 24,
        pulseRate: 2.5,
        persistent: true,
        id: `inner-conflict-teach-${wire.id}`,
        screenX: edgeX,
        screenY: edgeY,
        pointTowardX: targetX,
        pointTowardY: targetY,
      })
    } else if (!onScreen) {
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

  // Inner conflict teaching vignette
  if (
    isFirstInnerConflictTeaching &&
    tutorialState.getConflictTeachingTargetWireId() &&
    foundConflict
  ) {
    const elapsed = now - tutorialState.getFirstInnerConflictTime()

    if (elapsed < 500) {
      const flashProgress = elapsed / 500
      const flashAlpha = 0.25 * (1 - flashProgress * 0.5)
      vignettes.push({
        color: Colors.borderConflict,
        alpha: flashAlpha,
        edges: ['top', 'bottom', 'left', 'right'],
      })
    } else {
      vignettes.push({
        color: Colors.borderConflict,
        alpha: 0.1,
        edges: ['top', 'bottom', 'left', 'right'],
      })
    }
  }

  return { indicators, vignettes }
}

// ============================================
// DUPLICATE/SYMLINK INDICATORS
// ============================================

export function getDuplicateIndicators(
  bounds: ScreenBounds,
  worldToScreen: WorldToScreenFn,
  now: number
): { indicators: EdgeIndicator[]; vignettes: Vignette[] } {
  const indicators: EdgeIndicator[] = []
  const vignettes: Vignette[] = []

  const inScope = isInPackageScope()
  const duplicateGroups = getAllDuplicateGroups()
  const scopePackages = inScope ? getCurrentScopePackages() : gameState.packages

  const isFirstDuplicate =
    gameState.meta.cacheTokens === 0 &&
    !gameState.onboarding.firstSymlinkSeen &&
    duplicateGroups.length > 0

  if (isFirstDuplicate && !tutorialState.getHasSeenFirstDuplicate()) {
    tutorialState.setHasSeenFirstDuplicate(true)
    tutorialState.setFirstDuplicateTime(now)
  }

  let teachingTargetFound = false

  for (const group of duplicateGroups) {
    if (group.packageIds.length < 2) continue

    if (isFirstDuplicate && !teachingTargetFound) {
      const onScreenDuplicates: Array<{
        x: number
        y: number
        screenX: number
        screenY: number
      }> = []

      for (const pkgId of group.packageIds) {
        const pkg = scopePackages.get(pkgId)
        if (!pkg || pkg.state === 'conflict') continue

        const screenPos = worldToScreen(pkg.position.x, pkg.position.y)
        if (!isOffScreen(screenPos.x, screenPos.y, { ...bounds, margin: 60 })) {
          onScreenDuplicates.push({
            x: pkg.position.x,
            y: pkg.position.y,
            screenX: screenPos.x,
            screenY: screenPos.y,
          })
        }
      }

      if (onScreenDuplicates.length >= 2) {
        teachingTargetFound = true

        for (let i = 0; i < 2; i++) {
          const dup = onScreenDuplicates[i]!
          const { edgeX, edgeY } = findClosestEdgePoint(
            dup.screenX,
            dup.screenY,
            bounds
          )

          indicators.push({
            worldX: dup.x,
            worldY: dup.y,
            color: group.haloColor,
            size: 24,
            pulseRate: 2.0,
            persistent: true,
            id: `symlink-teach-line-${i}`,
            screenX: edgeX,
            screenY: edgeY,
            pointTowardX: dup.screenX,
            pointTowardY: dup.screenY,
          })
        }
      }
    } else if (!isFirstDuplicate) {
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
  }

  // Duplicate vignette
  if (tutorialState.getHasSeenFirstDuplicate() && duplicateGroups.length > 0) {
    const elapsed = now - tutorialState.getFirstDuplicateTime()
    const firstGroup = duplicateGroups[0]!

    if (elapsed < 500) {
      const flashProgress = elapsed / 500
      const flashAlpha = 0.3 * (1 - flashProgress * 0.5)
      vignettes.push({
        color: firstGroup.haloColor,
        alpha: flashAlpha,
        edges: ['top', 'bottom', 'left', 'right'],
      })
    } else if (isFirstDuplicate) {
      vignettes.push({
        color: firstGroup.haloColor,
        alpha: 0.12,
        edges: ['top', 'bottom', 'left', 'right'],
      })
    }
  }

  return { indicators, vignettes }
}

// ============================================
// SCOPE EXIT TEACHING
// ============================================

export function getScopeExitIndicators(bounds: ScreenBounds): {
  indicators: EdgeIndicator[]
  vignettes: Vignette[]
} {
  const indicators: EdgeIndicator[] = []
  const vignettes: Vignette[] = []

  if (
    !isInPackageScope() ||
    gameState.onboarding.firstScopeExited ||
    gameState.meta.cacheTokens > 0
  ) {
    return { indicators, vignettes }
  }

  const scopePkg = getCurrentScopeRoot()
  if (scopePkg?.internalState !== 'stable') {
    return { indicators, vignettes }
  }

  // Get dynamic back button position from ScopeNavigation component
  const backBtnPos = tutorialState.getBackButtonPos()
  if (!backBtnPos) {
    return { indicators, vignettes }
  }

  indicators.push({
    worldX: 0,
    worldY: 0,
    color: 0x4ade80,
    size: 20,
    pulseRate: 1.5,
    persistent: true,
    id: 'exit-teaching',
    screenX: 0, // left edge
    screenY: bounds.height / 2, // middle of screen vertically
    pointTowardX: backBtnPos.x,
    pointTowardY: backBtnPos.y,
    targetRadius: 30,
  })

  vignettes.push({
    color: 0x4ade80,
    alpha: 0.12,
    edges: ['left'],
  })

  return { indicators, vignettes }
}

// ============================================
// FIRST SPAWNED NODE TEACHING
// ============================================

export function getFirstSpawnedIndicators(
  bounds: ScreenBounds,
  worldToScreen: WorldToScreenFn,
  now: number
): { indicators: EdgeIndicator[]; vignettes: Vignette[] } {
  const indicators: EdgeIndicator[] = []
  const vignettes: Vignette[] = []

  const inScope = isInPackageScope()

  // Skip first-spawned teaching for prestiged players
  if (
    gameState.onboarding.firstPrestigeComplete ||
    gameState.meta.cacheTokens > 0
  ) {
    return { indicators, vignettes }
  }

  if (!inScope && gameState.onboarding.firstClickComplete) {
    if (!tutorialState.getLastFirstClickState()) {
      tutorialState.setLastFirstClickState(true)
      tutorialState.setFirstSpawnedPackageId(null)

      for (const pkg of gameState.packages.values()) {
        if (pkg.id !== gameState.rootId && pkg.depth === 1) {
          tutorialState.setFirstSpawnedPackageId(pkg.id)
          tutorialState.setFirstSpawnedTime(now)
          break
        }
      }
    }

    const firstSpawnedId = tutorialState.getFirstSpawnedPackageId()
    if (firstSpawnedId && !gameState.onboarding.firstConflictSeen) {
      // Wait for physics to settle before showing indicator
      const elapsed = now - tutorialState.getFirstSpawnedTime()
      if (elapsed < 500) {
        return { indicators, vignettes }
      }

      const pkg = gameState.packages.get(firstSpawnedId)
      if (pkg) {
        const screenPos = worldToScreen(pkg.position.x, pkg.position.y)
        const { edgeX, edgeY } = findClosestEdgePoint(
          screenPos.x,
          screenPos.y,
          bounds
        )

        indicators.push({
          worldX: pkg.position.x,
          worldY: pkg.position.y,
          color: Colors.borderInstalling,
          size: 22,
          pulseRate: 1.5,
          persistent: true,
          id: 'first-spawned-teach',
          screenX: edgeX,
          screenY: edgeY,
          pointTowardX: screenPos.x,
          pointTowardY: screenPos.y,
          targetRadius: 50,
        })

        vignettes.push({
          color: Colors.borderInstalling,
          alpha: 0.1,
          edges: ['top', 'bottom', 'left', 'right'],
        })
      }
    }
  } else if (!inScope) {
    tutorialState.setLastFirstClickState(false)
  }

  return { indicators, vignettes }
}

// ============================================
// PRESTIGE TEACHING
// ============================================

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

  if (isRootOffScreen) {
    indicators.push({
      worldX: rootPkg.position.x,
      worldY: rootPkg.position.y,
      color: 0xa78bfa,
      size: 24,
      pulseRate: 1,
      persistent: true,
      id: 'prestige',
    })

    vignettes.push({
      color: 0xa78bfa,
      alpha: 0.1,
      edges: ['top', 'bottom', 'left', 'right'],
    })
  }

  // First prestige teaching - from left edge to prestige panel top (skip for prestiged players)
  if (
    !gameState.onboarding.firstPrestigeComplete &&
    gameState.meta.cacheTokens === 0
  ) {
    // Panel: left 24px, padding 16px horiz / 12px vert, container 100x100
    // Total: 132px wide x 124px tall
    const panelCenterX = 24 + 66 // left offset + half panel width
    const panelTopY = bounds.height - 24 - 124 // top edge of panel

    indicators.push({
      worldX: 0,
      worldY: 0,
      color: 0xa78bfa,
      size: 24,
      pulseRate: 1.2,
      persistent: true,
      id: 'prestige-teach',
      screenX: 0, // left edge
      screenY: bounds.height / 2, // middle of screen
      pointTowardX: panelCenterX,
      pointTowardY: panelTopY,
      targetRadius: 0, // arrow reaches panel edge
    })

    vignettes.push({
      color: 0xa78bfa,
      alpha: 0.15,
      edges: ['bottom', 'left'],
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
