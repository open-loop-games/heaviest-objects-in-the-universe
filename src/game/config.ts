// Game configuration constants and initial state factory

import type { GameConfig, GameState } from './types'

// ============================================
// TIER SYSTEM
// ============================================

// Cache token thresholds for each ecosystem tier (1-5)
// Tier is derived from cache tokens, not tracked separately
// Unlocks: Tier 2 = auto-resolve, Tier 3 = auto-hoist, Tier 4/5 = faster
export const TIER_THRESHOLDS = [0, 9, 21, 42, 63] as const

// Max depth allowed at each tier (tier N = depth N)
export const TIER_MAX_DEPTH = [1, 2, 3, 4, 5] as const

// ============================================
// COMPRESSION SCALING
// ============================================

// Base compression chance (before token scaling)
export const BASE_COMPRESSION_CHANCE = 0.2

// Additional compression per cache token
export const COMPRESSION_PER_TOKEN = 0.01

// Compression softcap (reached at 20 tokens)
export const COMPRESSION_SOFTCAP = 0.4

// Compression hardcap (asymptotic limit)
export const COMPRESSION_HARDCAP = 0.5

// Depth multipliers for compression chance
// depth 1 = 100%, depth 5 = 0% (always leaves)
export const DEPTH_COMPRESSION_MULT = [1.0, 0.75, 0.5, 0.25, 0.0] as const

// Max compressed packages per scope by tier [tier 1-5]
// Prevents exponential scope growth
export const MAX_COMPRESSED_PER_SCOPE = [1, 2, 2, 3, 3] as const

// ============================================
// ACTION COSTS (Bandwidth)
// ============================================

// Per-dependency spawn cost - NOW FREE (momentum loop)
// Cascades flow uninterrupted, cost moved to install
export const DEP_SPAWN_COST = 0

// Conflict resolution cost - NOW GENERATES BW (see momentum.ts)
export const CONFLICT_RESOLVE_COST = 0

// Symlink merge cost - NOW GENERATES BW (see momentum.ts)
export const SYMLINK_MERGE_COST = 0

// Automation fixed drain per operation (momentum loop)
export const AUTO_RESOLVE_DRAIN = 8
export const AUTO_HOIST_DRAIN = 12

// Maximum pending deps in queue
export const MAX_PENDING_DEPS = 40

// ============================================
// MOMENTUM SYSTEM (Activity-driven BW)
// ============================================

// Generation amounts (base, scaled by tier)
export const MOMENTUM_PACKAGE_RESOLVE = 4 // Per package install complete
export const MOMENTUM_CONFLICT_RESOLVE = 15 // Manual conflict resolution
export const MOMENTUM_SYMLINK_MERGE = 20 // Drag-merge duplicates
export const MOMENTUM_STABILIZE_BASE = 50 // Base burst on scope stabilize
export const MOMENTUM_STABILIZE_PER_PKG = 5 // Additional per package in scope
export const MOMENTUM_GOLDEN_SPAWN = 8 // Golden package appears
export const MOMENTUM_FRAGMENT_COLLECT = 5 // Cache fragment collected

// Tier multipliers for generation [tier 1-5]
export const MOMENTUM_TIER_MULTIPLIERS = [1.0, 1.0, 1.3, 1.6, 2.0, 2.5] as const

// Safety passive regen by tier [tier 1-5]
export const SAFETY_REGEN_BY_TIER = [2, 2, 2.5, 3, 3.5, 4] as const

// Dampening (prevents spam exploit)
export const MOMENTUM_DAMPENING_WINDOW = 5000 // ms
export const MOMENTUM_DAMPENING_THRESHOLD = 100 // BW in window before dampening
export const MOMENTUM_DAMPENING_FLOOR = 0.2 // Minimum generation rate (20%)

// Install cost (entry gate to cascade)
export const INSTALL_BASE_COST = 25 // × tier × 1.15^activeScopes

// ============================================
// SURGE SYSTEM (P2+)
// ============================================

// Total segments in surge bar
export const SURGE_SEGMENTS = 10

// Cost per segment (percentage of max bandwidth)
export const SURGE_COST_PER_SEGMENT = 0.1 // 10% of max bandwidth per segment

// Boost effects per segment
export const SURGE_CASCADE_BOOST = 0.08 // +8% cascade size per segment
export const SURGE_GOLDEN_BOOST = 0.005 // +0.5% absolute golden chance per segment
export const SURGE_FRAGMENT_BOOST = 0.004 // +0.4% absolute fragment chance per segment

// ============================================
// DEPTH REWARDS
// ============================================

// Golden packages (only spawn at depth 3+, 4x weight)
export const GOLDEN_SPAWN_CHANCE = 0.05
export const GOLDEN_WEIGHT_MULTIPLIER = 4
export const GOLDEN_MIN_DEPTH = 3

// Cache fragments (collectible bonus tokens)
export const CACHE_FRAGMENT_CHANCE = 0.04
export const CACHE_FRAGMENT_MIN_DEPTH = 2
export const FRAGMENT_TO_TOKEN_RATIO = 5 // 5 fragments = 1 cache token on prestige

// Depth weight multipliers: [depth 0, depth 1, depth 2, depth 3, depth 4+]
export const DEPTH_WEIGHT_MULTIPLIERS = [1.0, 1.0, 1.15, 1.25, 1.35] as const

// ============================================
// DEFAULT CONFIG
// ============================================

// Default configuration based on design doc
export const DEFAULT_CONFIG: GameConfig = {
  // Cost scaling
  baseBandwidthCost: 10,
  costMultiplier: 1.15,

  // Production rates
  baseBandwidthRegen: 1,
  cacheTokenMultiplier: 1.1,

  // Dependencies
  minDependencies: 1,
  maxDependencies: 5,
  dependencyDepthLimit: 4,

  // Physics
  nodeRepulsion: 150, // Lower = nodes slide past each other easier
  wireAttraction: 0.01,
  damping: 0.95,
}

// Starting values - tweak these for early game balance
const STARTING_MAX_BANDWIDTH = 1000
const STARTING_BANDWIDTH = STARTING_MAX_BANDWIDTH / 2 // Start half full

// Save version - increment to force reset on incompatible changes
export const SAVE_VERSION = 2

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
      cacheFragments: 0,
    },
    meta: {
      cacheTokens: 0,
      ecosystemTier: 1,
      totalPrestiges: 0,
    },
    upgrades: {
      bandwidthLevel: 0,
      efficiencyLevel: 0,
      compressionLevel: 0,
      resolveSpeedLevel: 0,
      hoistSpeedLevel: 0,
      surgeLevel: 0,
    },
    onboarding: {
      introAnimationComplete: false,
      firstClickComplete: false,
      firstConflictSeen: false,
      firstSymlinkSeen: false,
      firstInnerConflictSeen: false,
      firstScopeExited: false,
      firstHoistSeen: false,
      firstPrestigeComplete: false,
      weightSeen: false,
      efficiencySeen: false,
    },
    packages: new Map(),
    wires: new Map(),
    rootId: null,
    // Hoisting system
    hoistedDeps: new Map(),
    // Scope system
    currentScope: 'root',
    scopeStack: [], // Empty = root scope
    tutorialGating: true, // Relaxed after first prestige
    // Cascade system
    cascade: {
      active: false,
      scopePackageId: null,
      pendingSpawns: [],
      lastSpawnTime: 0,
      spawnInterval: 100, // ms between spawns
      guaranteedCrits: 0, // Earned from inner scope merges
    },
    // Automation system
    automation: {
      // Toggle states (default off, user enables)
      resolveEnabled: false,
      hoistEnabled: false,
      // Auto-resolve
      resolveActive: false,
      resolveTargetWireId: null,
      resolveTargetScope: null,
      // Auto-hoist
      hoistActive: false,
      hoistTargetDepName: null,
      hoistTargetSources: null,
      // Timing
      processStartTime: 0,
      lastResolveTime: 0,
      lastHoistTime: 0,
    },
    // Surge system (P2+ - boost cascades)
    surge: {
      chargedSegments: 0,
      unlockedSegments: 1, // Start with 1 unlocked, upgrade for more
    },
    stats: {
      totalPackagesInstalled: 0,
      totalConflictsResolved: 0,
      totalSymlinksCreated: 0,
      maxWeightReached: 0,
      currentEfficiency: 1,
      currentStability: 1,
      goldenPackagesFound: 0,
      cacheFragmentsCollected: 0,
    },
    camera: {
      x: 0,
      y: 0,
      zoom: 1,
    },
  }
}
