// Headless simulation engine
//
// Runs game logic without Vue reactivity or rendering.
// Used for balance testing and batch simulations.

import type { GameState } from '../game/types'
import {
  createInitialState,
  INSTALL_BASE_COST,
  SAFETY_REGEN_BY_TIER,
} from '../game/config'
import { seedRNG } from '../game/random'
import type {
  SimConfig,
  SimResult,
  SimMetrics,
  Strategy,
  StrategyAction,
} from './types'
import { DEFAULT_SIM_CONFIG } from './types'
import { getStrategy } from './strategies'

// Import game logic functions
import { getPrestigeThreshold, getEcosystemTier } from '../game/formulas'

// ============================================
// HEADLESS ENGINE
// ============================================

export class HeadlessEngine {
  state: GameState
  private tick = 0
  private strategy: Strategy
  private config: SimConfig
  private startTime: number
  private metrics: SimMetrics

  constructor(config: Partial<SimConfig> = {}) {
    this.config = { ...DEFAULT_SIM_CONFIG, ...config }
    this.state = createInitialState(this.config.seed)
    seedRNG(this.config.seed)
    this.strategy = getStrategy(this.config.strategyName)
    this.startTime = Date.now()

    // Initialize metrics
    this.metrics = {
      ticksToFirstShip: 0,
      ticksToTier: [0, 0, 0, 0, 0],
      shipsPerformed: 0,
      averageEfficiency: 0,
      peakEfficiency: 0,
      conflictsResolved: 0,
      symlinksCreated: 0,
      packagesInstalled: 0,
    }
  }

  /**
   * Run a single simulation tick
   */
  step(): void {
    const deltaTime = 1 / this.config.ticksPerSecond

    // 1. Update resources (bandwidth regen)
    this.updateResources(deltaTime)

    // 2. Update package installation progress
    this.updatePackages(deltaTime)

    // 3. Execute strategy decision
    const action = this.strategy.decide(this.state)
    this.executeAction(action)

    // 4. Track metrics
    this.trackMetrics()

    this.tick++
  }

  /**
   * Run simulation until max ticks or end condition
   */
  run(): SimResult {
    while (this.tick < this.config.maxTicks) {
      this.step()

      // Check end conditions
      if (this.state.meta.hasCollapsed) {
        return this.summarize('collapsed')
      }

      if (this.state.meta.ecosystemTier >= 5) {
        return this.summarize('tier5')
      }
    }

    return this.summarize('max_ticks')
  }

  // ============================================
  // GAME LOGIC (Simplified for headless)
  // ============================================

  private updateResources(deltaTime: number): void {
    // Simplified regen calculation for headless (avoids global state dependency)
    const tier = Math.min(
      this.state.meta.ecosystemTier,
      SAFETY_REGEN_BY_TIER.length - 1
    )
    const baseRegen = SAFETY_REGEN_BY_TIER[tier] ?? 2
    const regen = baseRegen * deltaTime * 60 // Scale to ~60 fps

    this.state.resources.bandwidth = Math.min(
      this.state.resources.maxBandwidth,
      this.state.resources.bandwidth + regen
    )
  }

  private updatePackages(deltaTime: number): void {
    // Progress installation for all packages
    const progressRate = 0.5 * deltaTime * 60 // Normalized to 60fps

    for (const pkg of this.state.packages.values()) {
      if (pkg.state === 'installing' && pkg.installProgress < 1) {
        pkg.installProgress = Math.min(1, pkg.installProgress + progressRate)
        if (pkg.installProgress >= 1) {
          pkg.state = 'ready'
        }
      }

      // Also check internal packages
      if (pkg.internalPackages) {
        for (const innerPkg of pkg.internalPackages.values()) {
          if (innerPkg.state === 'installing' && innerPkg.installProgress < 1) {
            innerPkg.installProgress = Math.min(
              1,
              innerPkg.installProgress + progressRate
            )
            if (innerPkg.installProgress >= 1) {
              innerPkg.state = 'ready'
            }
          }
        }
      }
    }
  }

  private executeAction(action: StrategyAction): void {
    switch (action.type) {
      case 'install':
        this.doInstall()
        break
      case 'enter-scope':
        this.doEnterScope(action.targetId)
        break
      case 'exit-scope':
        this.doExitScope()
        break
      case 'prune':
        this.doPrune(action.wireId)
        break
      case 'merge':
        this.doMerge(action.sourceId, action.targetId)
        break
      case 'ship':
        this.doShip()
        break
      case 'wait':
        // Do nothing
        break
    }
  }

  private doInstall(): void {
    // Simplified cost calculation for headless
    const tier = this.state.meta.ecosystemTier
    const activeScopes = this.state.scopeStack.length
    const cost = INSTALL_BASE_COST * tier * Math.pow(1.15, activeScopes)

    if (this.state.resources.bandwidth < cost) return

    this.state.resources.bandwidth -= cost
    this.metrics.packagesInstalled++

    // Simplified: Just add weight (actual cascade system is complex)
    // In a full implementation, this would trigger the cascade system
    const baseWeight = 50 + Math.floor(Math.random() * 100)
    this.state.resources.weight += baseWeight
    this.state.stats.maxWeightReached = Math.max(
      this.state.stats.maxWeightReached,
      this.state.resources.weight
    )
  }

  private doEnterScope(targetId: string): void {
    this.state.scopeStack.push(targetId)
    this.state.currentScope = targetId
  }

  private doExitScope(): void {
    this.state.scopeStack.pop()
    this.state.currentScope =
      this.state.scopeStack[this.state.scopeStack.length - 1] ?? 'root'
  }

  private doPrune(wireId: string): void {
    // Find and remove wire in root or internal
    if (this.state.wires.has(wireId)) {
      this.state.wires.delete(wireId)
      this.metrics.conflictsResolved++
      return
    }

    // Check internal wires
    for (const pkg of this.state.packages.values()) {
      if (pkg.internalWires?.has(wireId)) {
        pkg.internalWires.delete(wireId)
        this.metrics.conflictsResolved++
        return
      }
    }
  }

  private doMerge(_sourceId: string, _targetId: string): void {
    // Simplified: Just count it
    this.metrics.symlinksCreated++
    this.state.stats.currentEfficiency = Math.min(
      1,
      this.state.stats.currentEfficiency + 0.05
    )
  }

  private doShip(): void {
    const threshold = getPrestigeThreshold(this.state.meta.timesShipped)
    if (this.state.stats.maxWeightReached < threshold) return

    // Calculate reward (simplified)
    const efficiency = this.state.stats.currentEfficiency
    const baseReward = Math.floor(
      Math.sqrt(this.state.resources.weight / threshold) * 3
    )
    const reward = Math.floor(baseReward * (0.5 + efficiency))

    // Apply reward
    this.state.meta.cacheTokens += reward
    this.state.meta.timesShipped++

    // Track first ship
    if (this.metrics.ticksToFirstShip === 0) {
      this.metrics.ticksToFirstShip = this.tick
    }

    // Update tier
    const newTier = getEcosystemTier(this.state.meta.cacheTokens)
    if (newTier > this.state.meta.ecosystemTier) {
      this.state.meta.ecosystemTier = newTier
      // Track tier timing
      if (this.metrics.ticksToTier[newTier - 1] === 0) {
        this.metrics.ticksToTier[newTier - 1] = this.tick
      }
    }

    // Reset run state
    this.state.resources.weight = 0
    this.state.stats.maxWeightReached = 0
    this.state.stats.currentEfficiency = 1
    this.state.packages.clear()
    this.state.wires.clear()
    this.state.scopeStack = []
    this.state.currentScope = 'root'

    this.metrics.shipsPerformed++
  }

  private trackMetrics(): void {
    // Track efficiency
    const eff = this.state.stats.currentEfficiency
    this.metrics.peakEfficiency = Math.max(this.metrics.peakEfficiency, eff)

    // Running average
    if (this.tick > 0) {
      this.metrics.averageEfficiency =
        (this.metrics.averageEfficiency * (this.tick - 1) + eff) / this.tick
    }
  }

  // ============================================
  // RESULTS
  // ============================================

  private summarize(endReason: 'max_ticks' | 'collapsed' | 'tier5'): SimResult {
    return {
      seed: this.config.seed,
      ticks: this.tick,
      realTimeMs: Date.now() - this.startTime,
      endReason,
      finalState: {
        cacheTokens: this.state.meta.cacheTokens,
        ecosystemTier: this.state.meta.ecosystemTier,
        timesShipped: this.state.meta.timesShipped,
        efficiency: this.state.stats.currentEfficiency,
        weight: this.state.resources.weight,
      },
      metrics: this.metrics,
    }
  }
}

// ============================================
// BATCH RUNNING
// ============================================

export function runBatch(
  runs: number,
  baseConfig: Partial<SimConfig> = {}
): SimResult[] {
  const results: SimResult[] = []
  const baseSeed = baseConfig.seed ?? Date.now()

  for (let i = 0; i < runs; i++) {
    const config = {
      ...baseConfig,
      seed: baseSeed + i,
    }
    const engine = new HeadlessEngine(config)
    results.push(engine.run())
  }

  return results
}

export function summarizeBatch(results: SimResult[]): {
  meanTokens: number
  medianTokens: number
  stdDevTokens: number
  meanTicksToTier5: number
  meanShips: number
  meanEfficiency: number
} {
  const tokens = results.map((r) => r.finalState.cacheTokens)
  const ships = results.map((r) => r.finalState.timesShipped)
  const efficiency = results.map((r) => r.metrics.averageEfficiency)
  const tier5Ticks = results
    .map((r) => r.metrics.ticksToTier[4])
    .filter((t): t is number => t !== undefined && t > 0)

  const mean = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  const median = (arr: number[]) => {
    if (arr.length === 0) return 0
    const sorted = [...arr].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2
      ? sorted[mid]!
      : (sorted[mid - 1]! + sorted[mid]!) / 2
  }
  const stdDev = (arr: number[]) => {
    const m = mean(arr)
    const variance = arr.reduce((sum, x) => sum + (x - m) ** 2, 0) / arr.length
    return Math.sqrt(variance)
  }

  return {
    meanTokens: mean(tokens),
    medianTokens: median(tokens),
    stdDevTokens: stdDev(tokens),
    meanTicksToTier5: mean(tier5Ticks),
    meanShips: mean(ships),
    meanEfficiency: mean(efficiency),
  }
}
