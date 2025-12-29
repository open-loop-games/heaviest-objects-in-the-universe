// Game configuration constants and initial state factory

import type { GameConfig, GameState } from './types';

// Default configuration based on design doc
export const DEFAULT_CONFIG: GameConfig = {
  // Cost scaling
  baseBandwidthCost: 10,
  costMultiplier: 1.15,

  // Production rates
  baseBandwidthRegen: 1,
  cacheTokenMultiplier: 1.10,

  // Dependencies
  minDependencies: 1,
  maxDependencies: 5,
  dependencyDepthLimit: 4,

  // Prestige
  prestigeWeightThreshold: 100000,

  // Physics
  nodeRepulsion: 150,    // Lower = nodes slide past each other easier
  wireAttraction: 0.01,
  damping: 0.95,
};

// Starting values - tweak these for early game balance
export const STARTING_BANDWIDTH = 150;
export const STARTING_MAX_BANDWIDTH = 1000;

// Save version - increment to force reset on incompatible changes
export const SAVE_VERSION = 2;

/**
 * Create a fresh game state for new game or prestige reset
 */
export function createInitialState(): GameState {
  return {
    resources: {
      bandwidth: STARTING_BANDWIDTH,
      maxBandwidth: STARTING_MAX_BANDWIDTH,
      bandwidthRegen: DEFAULT_CONFIG.baseBandwidthRegen,
      weight: 0,
    },
    meta: {
      cacheTokens: 0,
      ecosystemTier: 1,
      totalPrestiges: 0,
    },
    upgrades: {
      bandwidthLevel: 0,
      efficiencyLevel: 0,
    },
    onboarding: {
      introAnimationComplete: false,
      firstClickComplete: false,
      firstConflictSeen: false,
      firstSymlinkSeen: false,
      firstPrestigeComplete: false,
    },
    packages: new Map(),
    wires: new Map(),
    rootId: null,
    // Scope system
    currentScope: 'root',
    tutorialGating: true, // Relaxed after first prestige
    stats: {
      totalPackagesInstalled: 0,
      totalConflictsResolved: 0,
      totalSymlinksCreated: 0,
      maxWeightReached: 0,
      currentEfficiency: 1,
    },
    camera: {
      x: 0,
      y: 0,
      zoom: 1,
    },
    lastTick: Date.now(),
    tickCount: 0,
  };
}
