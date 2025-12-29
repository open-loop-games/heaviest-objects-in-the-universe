// Reactive game state management using Vue

import { reactive, computed, type ComputedRef } from 'vue';
import {
  type GameState,
  type Package,
  type Wire,
  type GameConfig,
} from './types';
import { DEFAULT_CONFIG, createInitialState } from './config';
import {
  calculateEfficiency,
  calculateGravity,
  calculatePrestigeReward,
} from './formulas';

// Global reactive game state
export const gameState = reactive<GameState>(createInitialState());

// Global config (can be modified for balancing)
export const gameConfig = reactive<GameConfig>({ ...DEFAULT_CONFIG });

// Computed values (install cost now in upgrades.ts)
export const computed_gravity: ComputedRef<number> = computed(() => {
  return calculateGravity(gameState);
});

export const computed_prestigeReward: ComputedRef<number> = computed(() => {
  return calculatePrestigeReward(gameState);
});

export const computed_canPrestige: ComputedRef<boolean> = computed(() => {
  return gameState.resources.weight >= gameConfig.prestigeWeightThreshold;
});

// State mutation helpers
export function addPackage(pkg: Package): void {
  gameState.packages.set(pkg.id, pkg);
  gameState.resources.weight += pkg.size;
  gameState.stats.totalPackagesInstalled++;
  gameState.stats.maxWeightReached = Math.max(
    gameState.stats.maxWeightReached,
    gameState.resources.weight
  );
}

export function removePackage(id: string): void {
  const pkg = gameState.packages.get(id);
  if (pkg) {
    gameState.resources.weight -= pkg.size;
    gameState.packages.delete(id);

    // Remove associated wires
    for (const [wireId, wire] of gameState.wires) {
      if (wire.fromId === id || wire.toId === id) {
        gameState.wires.delete(wireId);
      }
    }
  }
}

export function addWire(wire: Wire): void {
  gameState.wires.set(wire.id, wire);
  if (wire.isSymlink) {
    gameState.stats.totalSymlinksCreated++;
  }
}

export function updateEfficiency(): void {
  gameState.stats.currentEfficiency = calculateEfficiency(gameState);
}

export function spendBandwidth(amount: number): boolean {
  if (gameState.resources.bandwidth >= amount) {
    gameState.resources.bandwidth -= amount;
    return true;
  }
  return false;
}

export function addHeat(amount: number): void {
  gameState.resources.heat = Math.min(
    gameState.resources.maxHeat,
    gameState.resources.heat + amount
  );
}

export function resolveConflict(packageId: string): void {
  const pkg = gameState.packages.get(packageId);
  if (pkg && pkg.state === 'conflict') {
    pkg.state = 'ready';
    pkg.conflictProgress = 0;
    gameState.stats.totalConflictsResolved++;
  }
}

export function performPrestige(): void {
  const reward = calculatePrestigeReward(gameState);

  // Add meta rewards
  gameState.meta.cacheTokens += reward;
  gameState.meta.totalPrestiges++;

  // Reset current run
  gameState.packages.clear();
  gameState.wires.clear();
  gameState.rootId = null;

  gameState.resources.bandwidth = 100 * gameState.meta.ecosystemTier;
  gameState.resources.weight = 0;
  gameState.resources.heat = 0;

  // Keep upgrades but reset level-specific progress
  gameState.stats.currentEfficiency = 1;

  // Reset camera
  gameState.camera.x = 0;
  gameState.camera.y = 0;
  gameState.camera.zoom = 1;

  // Save immediately after prestige
  saveToLocalStorage();
}

// Callback for triggering collapse animation before prestige
let onPrestigeAnimationStart: ((onComplete: () => void) => void) | null = null;
let onPrestigeComplete: (() => void) | null = null;

export function setPrestigeAnimationCallback(
  animationStart: (onComplete: () => void) => void,
  afterPrestige: () => void
): void {
  onPrestigeAnimationStart = animationStart;
  onPrestigeComplete = afterPrestige;
}

export function triggerPrestigeWithAnimation(): void {
  if (!computed_canPrestige.value) return;

  if (onPrestigeAnimationStart) {
    // Play animation, then prestige
    onPrestigeAnimationStart(() => {
      performPrestige();
      if (onPrestigeComplete) {
        onPrestigeComplete();
      }
    });
  } else {
    // No animation, just prestige
    performPrestige();
    if (onPrestigeComplete) {
      onPrestigeComplete();
    }
  }
}

export function resetGame(): void {
  Object.assign(gameState, createInitialState());
}

// Save/Load (for persistence)
const STORAGE_KEY = 'heaviest-objects-save';
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

let autoSaveIntervalId: ReturnType<typeof setInterval> | null = null;

export function saveGame(): string {
  const saveData = {
    ...gameState,
    packages: Array.from(gameState.packages.entries()),
    wires: Array.from(gameState.wires.entries()),
  };
  return JSON.stringify(saveData);
}

export function loadGame(saveString: string): boolean {
  try {
    const data = JSON.parse(saveString);

    // Restore maps
    data.packages = new Map(data.packages);
    data.wires = new Map(data.wires);

    Object.assign(gameState, data);
    return true;
  } catch {
    return false;
  }
}

// localStorage wrappers
export function saveToLocalStorage(): boolean {
  try {
    const saveString = saveGame();
    localStorage.setItem(STORAGE_KEY, saveString);
    return true;
  } catch (e) {
    console.warn('Failed to save game:', e);
    return false;
  }
}

export function loadFromLocalStorage(): boolean {
  try {
    const saveString = localStorage.getItem(STORAGE_KEY);
    if (!saveString) return false;
    return loadGame(saveString);
  } catch (e) {
    console.warn('Failed to load game:', e);
    return false;
  }
}

export function hasSavedGame(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

export function clearSavedGame(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function startAutoSave(): void {
  if (autoSaveIntervalId) return;
  autoSaveIntervalId = setInterval(() => {
    saveToLocalStorage();
  }, AUTO_SAVE_INTERVAL);
}

export function stopAutoSave(): void {
  if (autoSaveIntervalId) {
    clearInterval(autoSaveIntervalId);
    autoSaveIntervalId = null;
  }
}
