// Types for headless simulation

import type { GameState } from '../game/types'

// ============================================
// CONFIGURATION
// ============================================

export interface SimConfig {
  seed: number
  maxTicks: number
  ticksPerSecond: number // Simulated game speed (60 = normal)
  strategyName: 'optimal' | 'greedy' | 'lazy' | 'passive'
  skipPhysics: boolean // Skip force-directed layout (faster)
  logLevel: 'none' | 'summary' | 'verbose'
}

export const DEFAULT_SIM_CONFIG: SimConfig = {
  seed: Date.now(),
  maxTicks: 100000,
  ticksPerSecond: 60,
  strategyName: 'optimal',
  skipPhysics: true,
  logLevel: 'summary',
}

// ============================================
// STRATEGY
// ============================================

export type StrategyAction =
  | { type: 'install' }
  | { type: 'enter-scope'; targetId: string }
  | { type: 'exit-scope' }
  | { type: 'prune'; wireId: string }
  | { type: 'merge'; sourceId: string; targetId: string }
  | { type: 'ship' }
  | { type: 'wait' }

export interface Strategy {
  name: string
  decide(state: GameState): StrategyAction
}

// ============================================
// RESULTS
// ============================================

export interface SimResult {
  seed: number
  ticks: number
  realTimeMs: number
  endReason: 'max_ticks' | 'collapsed' | 'tier5'

  finalState: {
    cacheTokens: number
    ecosystemTier: number
    timesShipped: number
    efficiency: number
    weight: number
  }

  metrics: SimMetrics
}

export interface SimMetrics {
  ticksToFirstShip: number
  ticksToTier: number[] // Ticks to reach each tier (1-5)
  shipsPerformed: number
  averageEfficiency: number
  peakEfficiency: number
  conflictsResolved: number
  symlinksCreated: number
  packagesInstalled: number
}

// ============================================
// BATCH RUNNING
// ============================================

export interface BatchConfig {
  runs: number
  baseSeed: number
  config: Omit<SimConfig, 'seed'>
  parallel?: number // Worker count (not implemented yet)
}

export interface BatchResult {
  runs: SimResult[]
  summary: {
    meanTokens: number
    medianTokens: number
    stdDevTokens: number
    meanTicksToTier5: number
    meanShips: number
    meanEfficiency: number
  }
}
