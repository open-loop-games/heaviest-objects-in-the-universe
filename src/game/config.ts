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

  // Heat mechanics
  heatPerPackage: 0.01,
  heatDecay: 0.005,
  conflictChancePerHeat: 0.1,

  // Dependencies
  minDependencies: 1,
  maxDependencies: 5,
  dependencyDepthLimit: 4,

  // Prestige
  prestigeWeightThreshold: 100000,

  // Physics
  nodeRepulsion: 500,
  wireAttraction: 0.01,
  damping: 0.95,
};

// Starting values - tweak these for early game balance
export const STARTING_BANDWIDTH = 150;
export const STARTING_MAX_BANDWIDTH = 1000;
export const STARTING_MAX_HEAT = 100;

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
      heat: 0,
      maxHeat: STARTING_MAX_HEAT,
    },
    meta: {
      cacheTokens: 0,
      algorithmFragments: 0,
      ecosystemTier: 1,
      totalPrestiges: 0,
    },
    upgrades: {
      bandwidthRegenLevel: 0,
      maxBandwidthLevel: 0,
      autoInstallLevel: 0,
      autoResolveLevel: 0,
      installSpeedLevel: 0,
      costReductionLevel: 0,
      symlinkUnlocked: false,
      pruneUnlocked: false,
    },
    packages: new Map(),
    wires: new Map(),
    rootId: null,
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
