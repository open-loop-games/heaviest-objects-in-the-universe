// Main game loop

import { gameState, gameConfig, updateEfficiency } from './state';
import { spawnDependencies, installPackage } from './packages';
import {
  getEffectiveBandwidthRegen,
  getEffectiveInstallSpeed,
  getAutoInstallRate,
  applyUpgradeEffects,
} from './upgrades';
import { updatePhysics } from './physics';

type TickCallback = (deltaTime: number) => void;

const tickCallbacks: TickCallback[] = [];
let animationFrameId: number | null = null;
let isRunning = false;
let autoInstallAccumulator = 0;

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

  // Update resources
  updateResources(deltaTime);

  // Update packages
  updatePackages(deltaTime);

  // Update physics
  updatePhysics(deltaTime);

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

  // Heat decay
  gameState.resources.heat = Math.max(
    0,
    gameState.resources.heat - gameConfig.heatDecay * deltaTime
  );

  // Auto-install
  const autoRate = getAutoInstallRate();
  if (autoRate > 0 && gameState.rootId) {
    autoInstallAccumulator += autoRate * deltaTime;

    while (autoInstallAccumulator >= 1) {
      autoInstallAccumulator -= 1;

      // Find a random ready package to install on
      const readyPackages = Array.from(gameState.packages.values())
        .filter(p => p.state === 'ready');

      if (readyPackages.length > 0) {
        const randomIndex = Math.floor(Math.random() * readyPackages.length);
        const target = readyPackages[randomIndex];
        if (target) {
          installPackage(target.id);
        }
      }
    }
  }
}

/**
 * Update package states (installation progress, etc.)
 */
function updatePackages(deltaTime: number): void {
  const packagesToSpawn: string[] = [];
  const installSpeed = getEffectiveInstallSpeed();

  for (const pkg of gameState.packages.values()) {
    // Update installation progress
    if (pkg.state === 'installing') {
      pkg.installProgress += deltaTime * 2 * installSpeed; // Base 0.5 seconds, faster with upgrades

      if (pkg.installProgress >= 1) {
        pkg.installProgress = 1;
        pkg.state = 'ready';
        packagesToSpawn.push(pkg.id);
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
  for (const wire of gameState.wires.values()) {
    wire.flowProgress = (wire.flowProgress + deltaTime * 0.5) % 1;
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
