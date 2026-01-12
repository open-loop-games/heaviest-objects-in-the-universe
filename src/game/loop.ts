// Main game loop

import { toRaw } from 'vue'
import { gameState } from './state'
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
import type { Package } from './types'

// ============================================
// LOOP TIMING CONSTANTS
// ============================================

/** Base install progress rate (multiplied by deltaTime and installSpeed) */
const INSTALL_PROGRESS_RATE = 0.5

/** Wire flow animation speed */
const WIRE_FLOW_SPEED = 0.5

/** How often to recalculate efficiency/stability (every N frames) */
const STATS_UPDATE_INTERVAL = 30

// ============================================
// CAMERA TRANSITION CONSTANTS
// ============================================

/** Camera position lerp speed (higher = faster snap) */
const CAMERA_POSITION_SPEED = 10

/** Camera zoom lerp speed */
const CAMERA_ZOOM_SPEED = 8

/** Exponential decay base for smooth easing (smaller = smoother) */
const CAMERA_EASING_BASE = 0.01

/** Distance threshold to snap camera position */
const CAMERA_SNAP_THRESHOLD = 0.5

/** Zoom difference threshold to snap camera zoom */
const CAMERA_ZOOM_SNAP_THRESHOLD = 0.01

type TickCallback = (deltaTime: number) => void

/**
 * Recursively update internal packages at any depth
 * Handles install progress and state transitions
 * Uses toRaw() to avoid Vue reactivity overhead
 */
function updateInternalPackages(
  packages: Map<string, Package>,
  deltaTime: number,
  installSpeed: number
): void {
  // Unwrap reactive map to avoid tracking overhead
  const rawPackages = toRaw(packages)

  for (const innerPkg of rawPackages.values()) {
    if (innerPkg.state === 'installing') {
      innerPkg.installProgress +=
        deltaTime * INSTALL_PROGRESS_RATE * installSpeed
      if (innerPkg.installProgress >= 1) {
        innerPkg.installProgress = 1
        innerPkg.state = 'ready'
        // Momentum: Generate BW when package resolves
        onPackageResolved()
      }
    }

    // Recurse into deeper levels (layer 2, 3, etc.)
    if (innerPkg.internalPackages) {
      updateInternalPackages(innerPkg.internalPackages, deltaTime, installSpeed)
    }
  }
}

const tickCallbacks: TickCallback[] = []
let animationFrameId: number | null = null
let isRunning = false

// Non-reactive timing state (no Vue overhead)
let lastTick = 0
let tickCount = 0

// Camera transition state
let cameraTargetX = 0
let cameraTargetY = 0
let cameraTargetZoom = 1
let cameraTransitioning = false

/**
 * Set camera target for smooth transition
 */
export function setCameraTarget(x: number, y: number, zoom?: number): void {
  cameraTargetX = x
  cameraTargetY = y
  if (zoom !== undefined) {
    cameraTargetZoom = zoom
  }
  cameraTransitioning = true
}

/**
 * Update camera position toward target
 */
function updateCameraTransition(deltaTime: number): void {
  if (!cameraTransitioning) return

  const dx = cameraTargetX - gameState.camera.x
  const dy = cameraTargetY - gameState.camera.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  // Position transition with smooth lerp
  if (dist < CAMERA_SNAP_THRESHOLD) {
    // Close enough - snap to target
    gameState.camera.x = cameraTargetX
    gameState.camera.y = cameraTargetY
  } else {
    // Lerp toward target with ease-out feel
    const t =
      1 - Math.pow(CAMERA_EASING_BASE, deltaTime * CAMERA_POSITION_SPEED)
    gameState.camera.x += dx * t
    gameState.camera.y += dy * t
  }

  // Zoom transition with timed easing
  const zoomDiff = cameraTargetZoom - gameState.camera.zoom
  if (Math.abs(zoomDiff) > CAMERA_ZOOM_SNAP_THRESHOLD) {
    // Smooth zoom toward target with exponential decay
    const zoomT =
      1 - Math.pow(CAMERA_EASING_BASE, deltaTime * CAMERA_ZOOM_SPEED)
    gameState.camera.zoom += zoomDiff * zoomT
  } else {
    gameState.camera.zoom = cameraTargetZoom
  }

  // Check if transition is complete
  if (
    dist < CAMERA_SNAP_THRESHOLD &&
    Math.abs(zoomDiff) < CAMERA_ZOOM_SNAP_THRESHOLD
  ) {
    cameraTransitioning = false
  }
}

/**
 * Register a callback to be called each tick
 */
export function onTick(callback: TickCallback): () => void {
  tickCallbacks.push(callback)
  return () => {
    const index = tickCallbacks.indexOf(callback)
    if (index > -1) {
      tickCallbacks.splice(index, 1)
    }
  }
}

/**
 * Main tick function - called every frame
 */
function tick(): void {
  if (!isRunning) return

  const now = Date.now()
  const deltaTime = (now - lastTick) / 1000 // Convert to seconds
  lastTick = now
  tickCount++

  // Smooth camera transitions
  updateCameraTransition(deltaTime)

  // Update resources
  updateResources(deltaTime)

  // Update cascade (staggered spawning inside packages)
  updateCascade()

  // Update packages
  updatePackages(deltaTime)

  // Skip normal physics during collapse - collapse physics handles everything
  if (!isCollapseActive()) {
    // Update physics
    updatePhysics(deltaTime)

    // Update internal physics when inside a package scope (uses scopeStack for arbitrary depth)
    if (isInPackageScope()) {
      updateInternalPhysics([...gameState.scopeStack], deltaTime)
    }
  }

  // Update efficiency and stability
  if (tickCount % STATS_UPDATE_INTERVAL === 0) {
    updateEfficiency()
    updateStability()
  }

  // Update automation (auto-resolve)
  updateAutomation(now, deltaTime)

  // Combo decay (resets to 0 after COMBO_DECAY_MS of inactivity)
  if (gameState.stats.comboCount > 0) {
    const elapsed = now - gameState.stats.comboLastActionTime
    if (elapsed >= COMBO_DECAY_MS) {
      gameState.stats.comboCount = 0
    }
  }

  // Call registered callbacks
  for (const callback of tickCallbacks) {
    callback(deltaTime)
  }

  // Schedule next tick
  animationFrameId = requestAnimationFrame(tick)
}

/**
 * Update resource regeneration (momentum loop: safety regen only)
 * Main BW generation comes from activity via momentum.ts
 */
function updateResources(deltaTime: number): void {
  // Apply upgrade effects (ensures max bandwidth is correct)
  applyUpgradeEffects()

  // Safety passive regen (minimal, prevents soft-lock)
  // Main BW generation is activity-driven via momentum.ts
  applySafetyRegen(deltaTime)
}

/**
 * Update package states (installation progress, etc.)
 */
function updatePackages(deltaTime: number): void {
  const packagesToSpawn: string[] = []
  const installSpeed = getEffectiveInstallSpeed()

  // Use toRaw() to avoid Vue reactivity tracking in game loop
  for (const pkg of toRaw(gameState.packages).values()) {
    // Update installation progress
    if (pkg.state === 'installing') {
      pkg.installProgress += deltaTime * INSTALL_PROGRESS_RATE * installSpeed

      if (pkg.installProgress >= 1) {
        pkg.installProgress = 1
        pkg.state = 'ready'
        packagesToSpawn.push(pkg.id)
        // Momentum: Generate BW when package resolves
        onPackageResolved()
        // Track when first divable package becomes ready
        if (
          pkg.parentId === gameState.rootId &&
          !gameState.onboarding.firstDivablePackageSeen
        ) {
          gameState.onboarding.firstDivablePackageSeen = true
        }
      }
    }

    // Also update internal packages (if this package has them) - recursive for arbitrary depth
    if (pkg.internalPackages) {
      updateInternalPackages(pkg.internalPackages, deltaTime, installSpeed)
    }

    // Conflict resolution is handled by player interaction (hold click)
    // No auto-resolution here
  }

  // Spawn dependencies for newly installed packages
  for (const id of packagesToSpawn) {
    spawnDependencies(id)
  }

  // Update wire flow animations
  for (const wire of toRaw(gameState.wires).values()) {
    wire.flowProgress = (wire.flowProgress + deltaTime * WIRE_FLOW_SPEED) % 1
  }

  // Also update internal wire flow animations (recursive for arbitrary depth)
  const rawPackagesForWires = toRaw(gameState.packages)
  for (const pkg of rawPackagesForWires.values()) {
    if (pkg.internalWires) {
      updateInternalWires(pkg, deltaTime)
    }
  }
}

/**
 * Recursively update wire flow animations at any depth
 * Uses toRaw() to avoid Vue reactivity overhead
 */
function updateInternalWires(pkg: Package, deltaTime: number): void {
  if (pkg.internalWires) {
    const rawWires = toRaw(pkg.internalWires)
    for (const wire of rawWires.values()) {
      wire.flowProgress = (wire.flowProgress + deltaTime * WIRE_FLOW_SPEED) % 1
    }
  }

  // Recurse into internal packages
  if (pkg.internalPackages) {
    const rawPackages = toRaw(pkg.internalPackages)
    for (const innerPkg of rawPackages.values()) {
      if (innerPkg.internalWires) {
        updateInternalWires(innerPkg, deltaTime)
      }
    }
  }
}

/**
 * Start the game loop
 */
export function startGameLoop(): void {
  if (isRunning) return

  isRunning = true
  lastTick = Date.now()
  animationFrameId = requestAnimationFrame(tick)
}

/**
 * Stop the game loop
 */
export function stopGameLoop(): void {
  isRunning = false
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}
