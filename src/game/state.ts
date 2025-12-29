// Reactive game state management using Vue

import { reactive, computed, type ComputedRef } from 'vue';
import {
  type GameState,
  type GameConfig,
} from './types';
import { DEFAULT_CONFIG, createInitialState } from './config';
import {
  calculatePrestigeReward,
} from './formulas';

// Global reactive game state
export const gameState = reactive<GameState>(createInitialState());

// Global config (can be modified for balancing)
export const gameConfig = reactive<GameConfig>({ ...DEFAULT_CONFIG });

// ============================================
// DYNAMIC PRESTIGE THRESHOLD
// ============================================

/**
 * Calculate prestige threshold based on total prestiges completed
 * - First prestige: 5,000 (intro/tutorial)
 * - Second prestige: 20,000
 * - Third+: 20,000 * 1.8^(n-2) scaling
 */
export function getPrestigeThreshold(totalPrestiges: number): number {
  if (totalPrestiges === 0) return 5000;      // First prestige - intro
  if (totalPrestiges === 1) return 20000;     // Second prestige
  // Scaling: 20k, 36k, 65k, 117k, 210k, ...
  return Math.floor(20000 * Math.pow(1.8, totalPrestiges - 1));
}

// ============================================
// COMPUTED VALUES
// ============================================

// Current prestige threshold (dynamic based on progress)
export const computed_prestigeThreshold: ComputedRef<number> = computed(() => {
  return getPrestigeThreshold(gameState.meta.totalPrestiges);
});

// Gravity: progress toward prestige (0 to 1+)
export const computed_gravity: ComputedRef<number> = computed(() => {
  const threshold = computed_prestigeThreshold.value;
  if (threshold <= 0) return 0;
  return gameState.resources.weight / threshold;
});

export const computed_prestigeReward: ComputedRef<number> = computed(() => {
  return calculatePrestigeReward(gameState, computed_prestigeThreshold.value);
});

export const computed_canPrestige: ComputedRef<boolean> = computed(() => {
  return gameState.resources.weight >= computed_prestigeThreshold.value;
});
