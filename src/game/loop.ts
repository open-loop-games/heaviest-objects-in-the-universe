// Main game loop

import { engine, gameState, graph, stack } from './state'
import { isInPackageScope } from './scope'
import {
  comboWindowMs,
  updateEfficiency,
  updateResolvedShare,
  updateStability,
} from './mutations'
import { spawnDependencies } from './packages'
import { updateCascade } from './cascade'
import { applyUpgradeEffects } from './upgrades'
import {
  updatePhysics,
  updateInternalPhysics,
  isCollapseActive,
} from './physics'
import { updateAutomation } from './automation'
import { applySafetyRegen, onPackageResolved } from './mutations'
import { checkAchievements } from './achievements'
import { isTopLevelPackage } from './scope'
import type { Graph } from '@open-loop/engine'
import type { Package, Wire } from './types'

// ============================================
// LOOP TIMING CONSTANTS
// ============================================

const INSTALL_PROGRESS_RATE = 0.5
const WIRE_FLOW_SPEED = 0.5
const STATS_UPDATE_INTERVAL = 30

// ============================================
// CAMERA TRANSITION CONSTANTS
// ============================================

const CAMERA_POSITION_SPEED = 10
const CAMERA_ZOOM_SPEED = 8
const CAMERA_EASING_BASE = 0.01
const CAMERA_SNAP_THRESHOLD = 0.5
const CAMERA_ZOOM_SNAP_THRESHOLD = 0.01

/**
 * Recursively walk all populated child graphs and update inner-package
 * install progress + inner wire flow.
 */
function updateScopeGraph(
  scopeGraph: Graph<Package, Wire>,
  ownerId: string | null,
  deltaTime: number
): void {
  for (const [id, node] of scopeGraph.nodes) {
    // Skip the shadow scope-owner — it shares data with the parent-graph
    // node, which is updated separately.
    if (id === ownerId) continue
    const pkg = node.data
    if (pkg.state === 'installing') {
      pkg.installProgress += deltaTime * INSTALL_PROGRESS_RATE
      if (pkg.installProgress >= 1) {
        pkg.installProgress = 1
        pkg.state = 'ready'
        onPackageResolved()
      }
    }

    // Recurse into compressed inner deps.
    const child = scopeGraph.getChildGraph(id)
    if (child) {
      updateScopeGraph(child, id, deltaTime)
    }
  }

  // Wire flow animations within this scope.
  for (const edge of scopeGraph.edges.values()) {
    edge.data.flowProgress =
      (edge.data.flowProgress + deltaTime * WIRE_FLOW_SPEED) % 1
  }
}

// The engine's tick driver, with its own timer stopped: each animation frame
// feeds it the frame's elapsed time, so the game ticks (and renders) in step
// with the display. The driver caps a tick at 1s, so a tab returning from the
// background doesn't push minutes of dt through physics at once.
const driver = engine.tickDriver
let animationFrameId: number | null = null
let isRunning = false

let lastFrame = 0
let tickCount = 0

let cameraTargetX = 0
let cameraTargetY = 0
let cameraTargetZoom = 1
let cameraTransitioning = false

export function setCameraTarget(x: number, y: number, zoom?: number): void {
  cameraTargetX = x
  cameraTargetY = y
  if (zoom !== undefined) {
    cameraTargetZoom = zoom
  }
  cameraTransitioning = true
}

function updateCameraTransition(deltaTime: number): void {
  if (!cameraTransitioning) return

  const dx = cameraTargetX - gameState.camera.x
  const dy = cameraTargetY - gameState.camera.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist < CAMERA_SNAP_THRESHOLD) {
    gameState.camera.x = cameraTargetX
    gameState.camera.y = cameraTargetY
  } else {
    const t =
      1 - Math.pow(CAMERA_EASING_BASE, deltaTime * CAMERA_POSITION_SPEED)
    gameState.camera.x += dx * t
    gameState.camera.y += dy * t
  }

  const zoomDiff = cameraTargetZoom - gameState.camera.zoom
  if (Math.abs(zoomDiff) > CAMERA_ZOOM_SNAP_THRESHOLD) {
    const zoomT =
      1 - Math.pow(CAMERA_EASING_BASE, deltaTime * CAMERA_ZOOM_SPEED)
    gameState.camera.zoom += zoomDiff * zoomT
  } else {
    gameState.camera.zoom = cameraTargetZoom
  }

  if (
    dist < CAMERA_SNAP_THRESHOLD &&
    Math.abs(zoomDiff) < CAMERA_ZOOM_SNAP_THRESHOLD
  ) {
    cameraTransitioning = false
  }
}

function tick(deltaTime: number): void {
  const now = Date.now()
  tickCount++

  updateCameraTransition(deltaTime)

  updateResources(deltaTime)

  updateCascade()

  updatePackages(deltaTime)

  if (!isCollapseActive()) {
    updatePhysics(deltaTime)

    if (isInPackageScope()) {
      updateInternalPhysics([...stack.path], deltaTime)
    }
  }

  if (tickCount % STATS_UPDATE_INTERVAL === 0) {
    updateEfficiency()
    updateStability()
    updateResolvedShare()
    checkAchievements()
  }

  updateAutomation(now, deltaTime)

  if (gameState.stats.comboCount > 0) {
    const elapsed = now - gameState.stats.comboLastActionTime
    if (elapsed >= comboWindowMs()) {
      gameState.stats.comboCount = 0
    }
  }
}

// Registered first, so the game tick runs before every onTick subscriber
// (the renderers) within a frame.
driver.onTick(tick)

/** Subscribe to each game tick, after the game has advanced. */
export const onTick = driver.onTick

function frame(): void {
  if (!isRunning) return
  const now = performance.now()
  driver.processInterval((now - lastFrame) / 1000)
  lastFrame = now
  animationFrameId = requestAnimationFrame(frame)
}

function updateResources(deltaTime: number): void {
  applyUpgradeEffects()
  applySafetyRegen(deltaTime)
}

function updatePackages(deltaTime: number): void {
  // Root scope: walk top-level packages + root.
  const packagesToSpawn: string[] = []
  for (const [id, node] of graph.nodes) {
    const pkg = node.data
    if (pkg.state === 'installing') {
      pkg.installProgress += deltaTime * INSTALL_PROGRESS_RATE
      if (pkg.installProgress >= 1) {
        pkg.installProgress = 1
        pkg.state = 'ready'
        packagesToSpawn.push(id)
        onPackageResolved()
        // Track when first divable package becomes ready.
        if (
          isTopLevelPackage(id) &&
          !gameState.onboarding.firstDivablePackageSeen
        ) {
          gameState.onboarding.firstDivablePackageSeen = true
        }
      }
    }
  }

  // Update wire flow animations for root-scope wires.
  for (const edge of graph.edges.values()) {
    edge.data.flowProgress =
      (edge.data.flowProgress + deltaTime * WIRE_FLOW_SPEED) % 1
  }

  // Recurse into all child graphs (inner deps + wires).
  for (const [id] of graph.nodes) {
    const child = graph.getChildGraph(id)
    if (child) {
      updateScopeGraph(child, id, deltaTime)
    }
  }

  // Spawn dependencies for newly installed packages (inner deps only —
  // top-level packages don't cascade until entered).
  for (const id of packagesToSpawn) {
    spawnDependencies(id)
  }
}

export function startGameLoop(): void {
  if (isRunning) return

  isRunning = true
  lastFrame = performance.now()
  animationFrameId = requestAnimationFrame(frame)
}

export function stopGameLoop(): void {
  isRunning = false
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}
