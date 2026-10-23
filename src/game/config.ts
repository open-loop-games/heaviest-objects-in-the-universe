// Game configuration constants and initial state factory

import type { GameConfig, GameState } from './types'

// ============================================
// PLATFORM-SPECIFIC DEFAULTS
// ============================================

/** Check if running on mobile (touch + small screen) */
function isMobilePlatform(): boolean {
  if (typeof window === 'undefined') return false
  const isTouchPrimary =
    'ontouchstart' in window || navigator.maxTouchPoints > 0
  const isSmallScreen = window.innerWidth < 768
  return isTouchPrimary && isSmallScreen
}

/** Default zoom level - smaller on mobile to show more of the graph */
export function getDefaultZoom(): number {
  return isMobilePlatform() ? 0.7 : 1
}

// ============================================
// TIER SYSTEM
// ============================================

// Cache token thresholds for each ecosystem tier (1-5)
// Tier is derived from cache tokens, not tracked separately
// Unlocks: Tier 2 = auto-resolve, Tier 3+ = faster automation
export const TIER_THRESHOLDS = [0, 9, 21, 42, 63] as const

// Max depth allowed at each tier (tier N = depth N)
export const TIER_MAX_DEPTH = [1, 2, 3, 4, 5] as const

// ============================================
// DUPLICATE HALO COLORS
// ============================================

// Halo colors for duplicate groups (cycle through these)
export const HALO_COLORS = [
  0x22d3ee, // Cyan
  0xe879f9, // Magenta
  0xfacc15, // Yellow
  0x84cc16, // Lime
]

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
// BOARD LIMITS
// ============================================

// Maximum pending deps in queue
export const MAX_PENDING_DEPS = 40

// Maximum instances of the same package identity per scope
export const MAX_SAME_IDENTITY_PER_SCOPE = 4

// Minimum duplicate pairs guaranteed per scope
export const MIN_DUPLICATE_PAIRS_PER_SCOPE = 2

// ============================================
// COMBO SYSTEM (Resolution speed → weight retention)
// ============================================

// Maximum combo level
export const COMBO_MAX = 10

// Weight retention scaling: at combo 0 remove 50%, at combo 10 remove 0%
export const COMBO_WEIGHT_RETENTION_MIN = 0.5 // 50% weight removed at combo 0
export const COMBO_WEIGHT_RETENTION_MAX = 1.0 // 0% weight removed at combo 10

// ============================================
// SURGE
// ============================================

// Boost per surge segment, the spine's surge input. Surge is a run-setup choice.
export const SURGE_CASCADE_BOOST = 0.08 // +8% cascade size per segment
export const SURGE_PACKAGE_BOOST = 0.05 // +5% package count per segment

// ============================================
// DEPTH REWARDS
// ============================================

// Golden packages (only spawn at depth 3+, 4x weight + guaranteed fragment)
export const GOLDEN_SPAWN_CHANCE = 0.08
export const GOLDEN_WEIGHT_MULTIPLIER = 4
export const GOLDEN_MIN_DEPTH = 3
// Gross weight a collected fragment adds, so it pays through the ship reward. About one
// mean package (spine.ts meanPackageWeight). Feel.
export const FRAGMENT_WEIGHT = 50

// Depth weight multipliers: [depth 0, depth 1, depth 2, depth 3, depth 4+]
export const DEPTH_WEIGHT_MULTIPLIERS = [1.0, 1.0, 1.15, 1.25, 1.35] as const

// ============================================
// COLLAPSE SYSTEM (Tier 5 finale)
// ============================================

// Hold gesture timing
export const COLLAPSE_HOLD_DURATION = 5000 // 5 seconds in ms
export const COLLAPSE_LOCK_THRESHOLD = 0.8 // 80% = point of no return
export const COLLAPSE_MIN_TIER = 5 // Must be at Tier 5

/**
 * Calculate collapse drain progress with quadratic curve
 * Slow start lets player reconsider, dramatic acceleration commits them
 */
export function calculateCollapseDrainProgress(elapsedMs: number): number {
  const t = Math.min(1, elapsedMs / COLLAPSE_HOLD_DURATION)
  return t * t // Quadratic: progress = (elapsed / 5)²
}

// ============================================
// DEFAULT CONFIG
// ============================================

// Default configuration based on design doc
export const DEFAULT_CONFIG: GameConfig = {
  // Dependencies
  dependencyDepthLimit: 4,

  // Physics
  nodeRepulsion: 150, // Lower = nodes slide past each other easier
  wireAttraction: 0.01,
  damping: 0.95,
}

/**
 * A fresh game's values: the defaults of the game's persistent refs (state.ts), and the
 * starting values of its unsaved sections.
 */
export function createInitialState(): GameState {
  return {
    seed: Date.now(),
    resources: {
      weight: 0,
      cacheFragments: 0,
    },
    meta: {
      cacheTokens: 0,
      ecosystemTier: 1,
      timesShipped: 0,
      hasCollapsed: false,
      endlessMode: false,
    },
    upgrades: {
      comboPayout: 0,
      comboWindow: 0,
      autoResolve: 0,
      timed: 0,
    },
    onboarding: {
      introAnimationComplete: false,
      firstClickComplete: false,
      firstConflictSeen: false,
      firstSymlinkSeen: false,
      firstInnerConflictSeen: false,
      firstDivablePackageSeen: false,
      firstDiveSeen: false,
      firstScopeExited: false,
      firstPrestigeComplete: false,
      firstHighComboSeen: false,
      weightSeen: false,
      efficiencySeen: false,
    },
    // Cascade system
    cascade: {
      active: false,
      scopePackageId: null,
      pendingSpawns: [],
      lastSpawnTime: 0,
      spawnInterval: 100, // ms between spawns
      guaranteedCrits: 0, // Earned from inner scope merges
      // Extended cascade data (null when inactive)
      scopePath: null,
      subDepQueue: null,
      compressedIndices: null,
      // Tutorial pacing
      isStarterKit: false,
      isSecondPackage: false,
      isThirdPackage: false,
      isReactDom: false,
      deferConflicts: false,
      breathPhase: false,
      breathStartTime: 0,
    },
    // Automation system
    automation: {
      // Toggle states (default off, user enables)
      resolveEnabled: false,
      // Auto-resolve
      resolveActive: false,
      resolveTargetWireId: null,
      resolveTargetScope: null,
      // Timing
      processStartTime: 0,
      lastResolveTime: 0,
    },
    // Collapse hold state (Tier 5 finale)
    collapseHold: {
      isHolding: false,
      startTime: 0,
      progress: 0,
      locked: false,
      drainedTiers: 0,
    },
    stats: {
      totalPackagesInstalled: 0,
      totalConflictsResolved: 0,
      totalSymlinksCreated: 0,
      goldenPackagesFound: 0,
      cacheFragmentsCollected: 0,
      peakEfficiency: 1,
      totalWeight: 0,
    },
    run: {
      maxWeightReached: 0,
      currentEfficiency: 1,
      currentStability: 1,
      comboCount: 0,
      comboLastActionTime: 0,
      runGrossWeight: 0,
      runResolved: 0,
      runActs: 0,
      runComboSum: 0,
      resolvedShare: 1,
    },
    camera: {
      x: 0,
      y: 0,
      zoom: getDefaultZoom(),
    },
  }
}
