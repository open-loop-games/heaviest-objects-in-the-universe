// Main game loop

import { toRaw } from 'vue';
import { gameState } from './state';
import { isInPackageScope } from './scope';
import { updateEfficiency } from './mutations';
import { spawnDependencies } from './packages';
import {
  getEffectiveBandwidthRegen,
  getEffectiveInstallSpeed,
  applyUpgradeEffects,
} from './upgrades';
import { updatePhysics, updateInternalPhysics } from './physics';

type TickCallback = (deltaTime: number) => void;

const tickCallbacks: TickCallback[] = [];
let animationFrameId: number | null = null;
let isRunning = false;

// Camera transition state
let cameraTargetX = 0;
let cameraTargetY = 0;
let cameraTransitioning = false;
const CAMERA_TRANSITION_SPEED = 8; // Higher = faster snap

/**
 * Set camera target for smooth transition
 */
export function setCameraTarget(x: number, y: number): void {
  cameraTargetX = x;
  cameraTargetY = y;
  cameraTransitioning = true;
}

/**
 * Instantly set camera position (no transition)
 */
export function setCameraInstant(x: number, y: number): void {
  cameraTargetX = x;
  cameraTargetY = y;
  gameState.camera.x = x;
  gameState.camera.y = y;
  cameraTransitioning = false;
}

/**
 * Update camera position toward target
 */
function updateCameraTransition(deltaTime: number): void {
  if (!cameraTransitioning) return;

  const dx = cameraTargetX - gameState.camera.x;
  const dy = cameraTargetY - gameState.camera.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 0.5) {
    // Close enough - snap to target
    gameState.camera.x = cameraTargetX;
    gameState.camera.y = cameraTargetY;
    cameraTransitioning = false;
    return;
  }

  // Lerp toward target
  const t = 1 - Math.pow(0.01, deltaTime * CAMERA_TRANSITION_SPEED);
  gameState.camera.x += dx * t;
  gameState.camera.y += dy * t;
}

/**
 * Register a callback to be called each tick
 */
export function onTick(callback: TickCallback): () => void {
  tickCallbacks.push(callback);
  return () => {
    const index = tickCallbacks.indexOf(callback);
    if (index > -1) {
      tickCallbacks.splice(index, 1);
    }
  };
}

/**
 * Main tick function - called every frame
 */
function tick(): void {
  if (!isRunning) return;

  const now = Date.now();
  const deltaTime = (now - gameState.lastTick) / 1000; // Convert to seconds
  gameState.lastTick = now;
  gameState.tickCount++;

  // Smooth camera transitions
  updateCameraTransition(deltaTime);

  // Update resources
  updateResources(deltaTime);

  // Update packages
  updatePackages(deltaTime);

  // Update physics
  updatePhysics(deltaTime);

  // Update internal physics when inside a package scope
  if (isInPackageScope()) {
    updateInternalPhysics(gameState.currentScope, deltaTime);
  }

  // Update efficiency
  if (gameState.tickCount % 30 === 0) {
    updateEfficiency();
  }

  // Call registered callbacks
  for (const callback of tickCallbacks) {
    callback(deltaTime);
  }

  // Schedule next tick
  animationFrameId = requestAnimationFrame(tick);
}

/**
 * Update resource regeneration
 */
function updateResources(deltaTime: number): void {
  // Apply upgrade effects (ensures max bandwidth is correct)
  applyUpgradeEffects();

  // Bandwidth regeneration
  const regenRate = getEffectiveBandwidthRegen();
  gameState.resources.bandwidth = Math.min(
    gameState.resources.maxBandwidth,
    gameState.resources.bandwidth + regenRate * deltaTime
  );
}

/**
 * Update package states (installation progress, etc.)
 */
function updatePackages(deltaTime: number): void {
  const packagesToSpawn: string[] = [];
  const installSpeed = getEffectiveInstallSpeed();

  // Use toRaw() to avoid Vue reactivity tracking in game loop
  for (const pkg of toRaw(gameState.packages).values()) {
    // Update installation progress
    if (pkg.state === 'installing') {
      pkg.installProgress += deltaTime * 0.5 * installSpeed; // Base 2 seconds, faster with upgrades

      if (pkg.installProgress >= 1) {
        pkg.installProgress = 1;
        pkg.state = 'ready';
        packagesToSpawn.push(pkg.id);
      }
    }

    // Also update internal packages (if this package has them)
    if (pkg.internalPackages) {
      for (const innerPkg of pkg.internalPackages.values()) {
        if (innerPkg.state === 'installing') {
          innerPkg.installProgress += deltaTime * 0.5 * installSpeed;
          if (innerPkg.installProgress >= 1) {
            innerPkg.installProgress = 1;
            innerPkg.state = 'ready';
            // Internal packages don't spawn further dependencies (flat internal tree)
          }
        }
      }
    }

    // Conflict resolution is handled by player interaction (hold click)
    // No auto-resolution here
  }

  // Spawn dependencies for newly installed packages
  for (const id of packagesToSpawn) {
    spawnDependencies(id);
  }

  // Update wire flow animations
  for (const wire of toRaw(gameState.wires).values()) {
    wire.flowProgress = (wire.flowProgress + deltaTime * 0.5) % 1;
  }

  // Also update internal wire flow animations
  for (const pkg of toRaw(gameState.packages).values()) {
    if (pkg.internalWires) {
      for (const wire of pkg.internalWires.values()) {
        wire.flowProgress = (wire.flowProgress + deltaTime * 0.5) % 1;
      }
    }
  }
}


/**
 * Start the game loop
 */
export function startGameLoop(): void {
  if (isRunning) return;

  isRunning = true;
  gameState.lastTick = Date.now();
  animationFrameId = requestAnimationFrame(tick);
}

/**
 * Stop the game loop
 */
export function stopGameLoop(): void {
  isRunning = false;
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

/**
 * Check if game loop is running
 */
export function isGameRunning(): boolean {
  return isRunning;
}
