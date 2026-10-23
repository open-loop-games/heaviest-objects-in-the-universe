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
// BOARD LIMITS
// ============================================

// A scope's deps doubled: the cascade crit
export const CASCADE_CRIT_CHANCE = 0.05

// Maximum pending deps in queue
export const MAX_PENDING_DEPS = 40

// Maximum instances of the same package identity per scope
export const MAX_SAME_IDENTITY_PER_SCOPE = 4

// Minimum duplicate pairs guaranteed per scope
export const MIN_DUPLICATE_PAIRS_PER_SCOPE = 2

// ============================================
// COMBO SYSTEM (act pace → the ship reward's combo multiplier)
// ============================================

// Maximum combo level
export const COMBO_MAX = 10

// ============================================
// SURGE
// ============================================

// Boost per surge segment, the spine's surge input. Surge is a run-setup choice.
export const SURGE_CASCADE_BOOST = 0.08 // +8% cascade size per segment
export const SURGE_PACKAGE_BOOST = 0.05 // +5% package count per segment

// ============================================
// DEPTH REWARDS
// ============================================

// Conflicts between top-level packages arrive with the app board (map tier 2)
export const CROSS_PACKAGE_MIN_TIER = 2

// Golden packages (from map tier 3, at effective depth 3+; 4x weight + guaranteed fragment)
export const GOLDEN_MIN_TIER = 3
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
      unlockedTier: 1,
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
      qualitySeen: false,
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
      compressedSlots: null,
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
      peakQuality: 0,
      totalWeight: 0,
    },
    board: {
      tier: 1,
      topLevelInstalled: 0,
    },
    run: {
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
