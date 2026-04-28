// Main game loop

import { gameState, graph, stack } from './state'
import { isInPackageScope } from './scope'
import { updateEfficiency, updateStability } from './mutations'
import { spawnDependencies } from './packages'
import { updateCascade } from './cascade'
import { getEffectiveInstallSpeed, applyUpgradeEffects } from './upgrades'
import {
  updatePhysics,
  updateInternalPhysics,
  isCollapseActive,
} from './physics'
import { updateAutomation } from './automation'
import { applySafetyRegen, onPackageResolved } from './mutations'
import { COMBO_DECAY_MS } from './config'
import { checkAchievements, updatePatienceTimer } from './achievements'
import { isTopLevelPackage } from './scope'
import type { SpatialGraph } from 'open-loop-engine'
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

type TickCallback = (deltaTime: number) => void

/**
 * Recursively walk all populated child graphs and update inner-package
 * install progress + inner wire flow.
 */
function updateScopeGraph(
  scopeGraph: SpatialGraph<Package, Wire>,
  ownerId: string | null,
  deltaTime: number,
  installSpeed: number
): void {
  for (const [id, node] of scopeGraph.nodes) {
    // Skip the shadow scope-owner — it shares data with the parent-graph
    // node, which is updated separately.
    if (id === ownerId) continue
    const pkg = node.data
    if (pkg.state === 'installing') {
      pkg.installProgress += deltaTime * INSTALL_PROGRESS_RATE * installSpeed
      if (pkg.installProgress >= 1) {
        pkg.installProgress = 1
        pkg.state = 'ready'
        onPackageResolved()
      }
    }

    // Recurse into compressed inner deps.
    const child = scopeGraph.getChildGraph(id)
    if (child) {
      updateScopeGraph(child, id, deltaTime, installSpeed)
    }
  }

  // Wire flow animations within this scope.
  for (const edge of scopeGraph.edges.values()) {
    edge.data.flowProgress =
      (edge.data.flowProgress + deltaTime * WIRE_FLOW_SPEED) % 1
  }
}

const tickCallbacks: TickCallback[] = []
let animationFrameId: number | null = null
let isRunning = false

let lastTick = 0
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

export function onTick(callback: TickCallback): () => void {
  tickCallbacks.push(callback)
  return () => {
    const index = tickCallbacks.indexOf(callback)
    if (index > -1) {
      tickCallbacks.splice(index, 1)
    }
  }
}

function tick(): void {
  if (!isRunning) return

  const now = Date.now()
  const deltaTime = (now - lastTick) / 1000
  lastTick = now
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
    checkAchievements()
  }

  updatePatienceTimer(deltaTime)

  updateAutomation(now, deltaTime)

  if (gameState.stats.comboCount > 0) {
    const elapsed = now - gameState.stats.comboLastActionTime
    if (elapsed >= COMBO_DECAY_MS) {
      gameState.stats.comboCount = 0
    }
  }

  for (const callback of tickCallbacks) {
    callback(deltaTime)
  }

  animationFrameId = requestAnimationFrame(tick)
}

function updateResources(deltaTime: number): void {
  applyUpgradeEffects()
  applySafetyRegen(deltaTime)
}

function updatePackages(deltaTime: number): void {
  const installSpeed = getEffectiveInstallSpeed()

  // Root scope: walk top-level packages + root.
  const packagesToSpawn: string[] = []
  for (const [id, node] of graph.nodes) {
    const pkg = node.data
    if (pkg.state === 'installing') {
      pkg.installProgress += deltaTime * INSTALL_PROGRESS_RATE * installSpeed
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
      updateScopeGraph(child, id, deltaTime, installSpeed)
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
  lastTick = Date.now()
  animationFrameId = requestAnimationFrame(tick)
}

export function stopGameLoop(): void {
  isRunning = false
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}
