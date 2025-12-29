<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { getRenderer, destroyRenderer } from '../rendering/renderer';
import { startGameLoop, stopGameLoop, onTick } from '../game/loop';
import { gameState, loadFromLocalStorage, saveToLocalStorage, startAutoSave, stopAutoSave, setPrestigeAnimationCallback } from '../game/state';
import { createRootPackage, installPackage, findPackageAtPosition } from '../game/packages';
import type { Package } from '../game/types';
import { Colors } from '../rendering/colors';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const renderer = getRenderer();

// Track packages for install success detection
let previousPackageStates = new Map<string, string>();

// Conflict resolution state
let holdingPackage: Package | null = null;
let holdStartTime = 0;
const HOLD_DURATION = 1500; // 1.5 seconds to resolve

onMounted(async () => {
  if (canvasRef.value) {
    await renderer.init(canvasRef.value);

    // Try to load saved game, otherwise create fresh root
    const loaded = loadFromLocalStorage();
    if (!loaded || !gameState.rootId) {
      createRootPackage();
    }

    // Start game loop and auto-save
    startGameLoop();
    startAutoSave();

    // Set up prestige animation callback
    setPrestigeAnimationCallback(
      // Animation start: trigger black hole collapse
      (onComplete) => {
        renderer.getBlackHoleRenderer().startCollapse(onComplete);
      },
      // After prestige: create new root package
      () => {
        createRootPackage();
        previousPackageStates.clear();
      }
    );

    // Save on page unload
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Track install completions for particle effects
    onTick(() => {
      const effects = renderer.getEffectsRenderer();

      for (const pkg of gameState.packages.values()) {
        const prevState = previousPackageStates.get(pkg.id);

        // Detect new package spawning as conflict (no previous state + conflict)
        if (prevState === undefined && pkg.state === 'conflict') {
          effects.spawnConflictFlash(pkg.position.x, pkg.position.y);
        }

        // Detect installing -> ready transition
        if (prevState === 'installing' && pkg.state === 'ready') {
          effects.spawnBurst(pkg.position.x, pkg.position.y, Colors.borderReady);
        }

        // Detect conflict -> ready transition (resolution success)
        if (prevState === 'conflict' && pkg.state === 'ready') {
          effects.spawnBurst(pkg.position.x, pkg.position.y, Colors.shapeCircle);
        }

        previousPackageStates.set(pkg.id, pkg.state);
      }

      // Clean up old entries
      for (const id of previousPackageStates.keys()) {
        if (!gameState.packages.has(id)) {
          previousPackageStates.delete(id);
        }
      }
    });

    // Handle mouse interactions
    canvasRef.value.addEventListener('mousedown', handleMouseDown);
    canvasRef.value.addEventListener('mouseup', handleMouseUp);
    canvasRef.value.addEventListener('mouseleave', handleMouseUp);

    // Handle resize
    window.addEventListener('resize', handleResize);
  }
});

onUnmounted(() => {
  stopGameLoop();
  stopAutoSave();
  saveToLocalStorage(); // Final save on unmount
  destroyRenderer();
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('beforeunload', handleBeforeUnload);
});

function handleBeforeUnload() {
  saveToLocalStorage();
}

function getWorldPos(event: MouseEvent): { x: number; y: number } | null {
  if (!canvasRef.value) return null;
  const rect = canvasRef.value.getBoundingClientRect();
  const screenX = event.clientX - rect.left;
  const screenY = event.clientY - rect.top;
  return renderer.screenToWorld(screenX, screenY);
}

function handleMouseDown(event: MouseEvent) {
  // Ignore if shift is held (panning)
  if (event.shiftKey) return;
  if (event.button !== 0) return;

  const worldPos = getWorldPos(event);
  if (!worldPos) return;

  const clickedPkg = findPackageAtPosition(worldPos, 30 / gameState.camera.zoom);

  if (clickedPkg) {
    // Spawn click ripple effect
    const effects = renderer.getEffectsRenderer();
    effects.spawnRipple(clickedPkg.position.x, clickedPkg.position.y, Colors.borderInstalling);

    if (clickedPkg.state === 'conflict') {
      // Start holding to resolve conflict
      holdingPackage = clickedPkg;
      holdStartTime = Date.now();
      clickedPkg.conflictProgress = 0.01; // Start progress
      updateHoldProgress();
    } else if (clickedPkg.state === 'ready') {
      // Install new package
      const newPkg = installPackage(clickedPkg.id);
      if (newPkg) {
        // Ripple on the new package spawn point
        effects.spawnRipple(newPkg.position.x, newPkg.position.y, Colors.borderInstalling);
      }
    }
  }
}

function handleMouseUp() {
  if (holdingPackage) {
    // Cancel if not held long enough
    if (holdingPackage.state === 'conflict') {
      holdingPackage.conflictProgress = 0;
    }
    holdingPackage = null;
  }
}

function updateHoldProgress() {
  if (!holdingPackage || holdingPackage.state !== 'conflict') {
    holdingPackage = null;
    return;
  }

  const elapsed = Date.now() - holdStartTime;
  const progress = Math.min(1, elapsed / HOLD_DURATION);
  holdingPackage.conflictProgress = progress;

  if (progress >= 1) {
    // Resolve conflict
    holdingPackage.state = 'ready';
    holdingPackage.conflictProgress = 0;
    gameState.stats.totalConflictsResolved++;
    holdingPackage = null;
  } else {
    requestAnimationFrame(updateHoldProgress);
  }
}

function handleResize() {
  renderer.resize();
}
</script>

<template>
  <canvas ref="canvasRef" class="game-canvas"></canvas>
</template>

<style scoped>
.game-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
