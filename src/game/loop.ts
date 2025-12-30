// Main game loop

import { toRaw } from 'vue'
import { gameState } from './state'
import { isInPackageScope } from './scope'
import { updateEfficiency } from './mutations'
import { spawnDependencies } from './packages'
import { updateCascade } from './cascade'
import {
  getEffectiveBandwidthRegen,
  getEffectiveInstallSpeed,
  applyUpgradeEffects,
} from './upgrades'
import { updatePhysics, updateInternalPhysics } from './physics'
import { updateAutomation } from './automation'
import type { Package } from './types'

type TickCallback = (deltaTime: number) => void

/**
 * Recursively update internal packages at any depth
 * Handles install progress and state transitions
 */
function updateInternalPackages(
  packages: Map<string, Package>,
  deltaTime: number,
  installSpeed: number
): void {
  for (const innerPkg of packages.values()) {
    if (innerPkg.state === 'installing') {
      innerPkg.installProgress += deltaTime * 0.5 * installSpeed
      if (innerPkg.installProgress >= 1) {
        innerPkg.installProgress = 1
        innerPkg.state = 'ready'
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

// Camera transition state
let cameraTargetX = 0
let cameraTargetY = 0
let cameraTargetZoom = 1
let cameraTransitioning = false
const CAMERA_POSITION_SPEED = 10 // Higher = faster snap for position

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
 * Instantly set camera position (no transition)
 */
export function setCameraInstant(x: number, y: number): void {
  cameraTargetX = x
  cameraTargetY = y
  gameState.camera.x = x
  gameState.camera.y = y
  cameraTransitioning = false
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
  if (dist < 0.5) {
    // Close enough - snap to target
    gameState.camera.x = cameraTargetX
    gameState.camera.y = cameraTargetY
  } else {
    // Lerp toward target with ease-out feel
    const t = 1 - Math.pow(0.01, deltaTime * CAMERA_POSITION_SPEED)
    gameState.camera.x += dx * t
    gameState.camera.y += dy * t
  }

  // Zoom transition with timed easing
  const zoomDiff = cameraTargetZoom - gameState.camera.zoom
  if (Math.abs(zoomDiff) > 0.01) {
    // Smooth zoom toward target with exponential decay
    const zoomT = 1 - Math.pow(0.01, deltaTime * 8)
    gameState.camera.zoom += zoomDiff * zoomT
  } else {
    gameState.camera.zoom = cameraTargetZoom
  }

  // Check if transition is complete
  if (dist < 0.5 && Math.abs(zoomDiff) < 0.01) {
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
  const deltaTime = (now - gameState.lastTick) / 1000 // Convert to seconds
  gameState.lastTick = now
  gameState.tickCount++

  // Smooth camera transitions
  updateCameraTransition(deltaTime)

  // Update resources
  updateResources(deltaTime)

  // Update cascade (staggered spawning inside packages)
  updateCascade()

  // Update packages
  updatePackages(deltaTime)

  // Update physics
  updatePhysics(deltaTime)

  // Update internal physics when inside a package scope (uses scopeStack for arbitrary depth)
  if (isInPackageScope()) {
    updateInternalPhysics([...gameState.scopeStack], deltaTime)
  }

  // Update efficiency
  if (gameState.tickCount % 30 === 0) {
    updateEfficiency()
  }

  // Update automation (auto-resolve, auto-dedup, auto-hoist)
  updateAutomation(now, deltaTime)

  // Call registered callbacks
  for (const callback of tickCallbacks) {
    callback(deltaTime)
  }

  // Schedule next tick
  animationFrameId = requestAnimationFrame(tick)
}

/**
 * Update resource regeneration
 */
function updateResources(deltaTime: number): void {
  // Apply upgrade effects (ensures max bandwidth is correct)
  applyUpgradeEffects()

  // Bandwidth regeneration
  const regenRate = getEffectiveBandwidthRegen()
  gameState.resources.bandwidth = Math.min(
    gameState.resources.maxBandwidth,
    gameState.resources.bandwidth + regenRate * deltaTime
  )
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
      pkg.installProgress += deltaTime * 0.5 * installSpeed // Base 2 seconds, faster with upgrades

      if (pkg.installProgress >= 1) {
        pkg.installProgress = 1
        pkg.state = 'ready'
        packagesToSpawn.push(pkg.id)
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
    wire.flowProgress = (wire.flowProgress + deltaTime * 0.5) % 1
  }

  // Also update internal wire flow animations (recursive for arbitrary depth)
  for (const pkg of toRaw(gameState.packages).values()) {
    if (pkg.internalWires) {
      updateInternalWires(pkg, deltaTime)
    }
  }
}

/**
 * Recursively update wire flow animations at any depth
 */
function updateInternalWires(pkg: Package, deltaTime: number): void {
  if (pkg.internalWires) {
    for (const wire of pkg.internalWires.values()) {
      wire.flowProgress = (wire.flowProgress + deltaTime * 0.5) % 1
    }
  }

  // Recurse into internal packages
  if (pkg.internalPackages) {
    for (const innerPkg of pkg.internalPackages.values()) {
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
  gameState.lastTick = Date.now()
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

/**
 * Check if game loop is running
 */
export function isGameRunning(): boolean {
  return isRunning
}
