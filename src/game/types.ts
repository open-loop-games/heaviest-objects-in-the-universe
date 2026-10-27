// Core game types for "The Heaviest Objects in the Universe"

import type { PackageIdentity } from './registry'

export type PackageState = 'installing' | 'ready' | 'conflict' | 'optimized'

export type WireType = 'dependency' | 'symlink' | 'sibling'

export interface Position {
  x: number
  y: number
}

export interface Velocity {
  vx: number
  vy: number
}

// Package data lives on a Graph node. Tree topology (parent/children),
// nested scopes, and per-scope state labels are owned by the graph and
// scope stack — not stored on the package.
export interface Package {
  id: string
  position: Position
  velocity: Velocity
  state: PackageState
  size: number // Weight contribution
  depth: number // Layout depth within its scope
  installProgress: number // 0-1 for installation animation
  conflictProgress: number // 0-1 for conflict resolution
  identity?: PackageIdentity // Real package identity (name, icon, archetype)

  // Ghost status (for symlinked-away nodes)
  isGhost: boolean
  ghostTargetId: string | null // Package ID where real node lives
  ghostTargetScope: string | null // Package ID for scope

  // Depth rewards
  isGolden: boolean // Golden package (4x weight, only spawns at depth 3+)
  hasCacheFragment: boolean // Contains collectible cache fragment

  // Path of this package's scope in the run's board plan (board.ts); null for a package
  // with no scope of its own.
  planPath: number[] | null
}

export interface Wire {
  id: string
  fromId: string
  toId: string
  wireType: WireType
  flowProgress: number // 0-1 for data flow animation
  conflicted: boolean // True if wire connects incompatible packages
  conflictTime: number // Timestamp when conflict started (for animations)
}

export interface GameResources {
  weight: number
  cacheFragments: number // Collected this run, converted to tokens on prestige
}

/** Levels owned on the meta layer's tracks, which the spine prices. */
export interface Upgrades {
  comboPayout: number
  comboWindow: number
  autoResolve: number
  /** Timed challenges cleared. */
  timed: number
}

export interface MetaResources {
  cacheTokens: number // The wallet; unlocking a map tier spends it
  unlockedTier: number // Highest map tier bought
  timesShipped: number // Renamed from totalPrestiges
  hasCollapsed: boolean // Player has triggered the finale
  endlessMode: boolean // Player chose endless after collapse
}

// Collapse hold gesture state (Tier 5 finale)
export interface CollapseHoldState {
  isHolding: boolean // Currently holding
  startTime: number // When hold began (ms)
  progress: number // 0-1, quadratic curve
  locked: boolean // >80% = point of no return
  drainedTiers: number // 5→0 visual countdown
}

/** Lifetime counts, kept through ships. */
export interface GameStats {
  totalPackagesInstalled: number
  totalConflictsResolved: number
  totalSymlinksCreated: number
  goldenPackagesFound: number
  cacheFragmentsCollected: number
  peakQuality: number // Highest q shipped across all runs
  totalWeight: number // Cumulative weight across all runs
}

/** The run's board: which map tier it plays, and what of it is installed. */
export interface BoardState {
  tier: number
  topLevelInstalled: number // Top-level deps installed from the root, of the tier's count
}

/** This run's measures, reset when the run ends. */
export interface RunStats {
  comboCount: number // Current combo level (0-10)
  comboLastActionTime: number // Timestamp of last combo-building action
  // The ship reward's inputs (spine.ts shipReward)
  runGrossWeight: number // Weight added this run; merges and prunes never subtract
  runResolved: number // Conflicts and duplicates resolved this run, by the player or auto-resolve
  runActs: number // Player acts that build combo
  runComboSum: number // Sum of the combo counter each act found
  resolvedShare: number // q: runResolved over runResolved plus the problems still open
}

// Cascade system for staggered spawning
export interface PendingSpawn {
  packageId: string // Parent scope package ID
  identity: unknown // PackageIdentity (avoid circular import)
  position: Position
  velocity: Velocity
  size: number
  depth: number
  parentInternalId: string | null // For sub-deps, the internal parent ID
  isSubDep: boolean
}

export interface CascadeState {
  active: boolean
  scopePackageId: string | null // Which package scope is cascading
  pendingSpawns: PendingSpawn[] // Queue of deps to spawn
  lastSpawnTime: number // For timing between spawns
  spawnInterval: number // ms between spawns (100ms default)
  // Extended cascade data (populated during active cascade)
  scopePath: string[] | null // Full path to the package whose internals are cascading
  subDepQueue: Array<{ parentIndex: number; identity: PackageIdentity }> | null
  compressedSlots: Map<number, number> | null // Dep index → its child slot in the board plan
  // Tutorial pacing (curated packages get slower cascade)
  isStarterKit: boolean // Whether this cascade is for the starter-kit package
  isSecondPackage: boolean // Whether this cascade is for the curated second package (express)
  isThirdPackage: boolean // Whether this cascade is for the curated third package (react)
  isReactDom: boolean // Whether this cascade is for react-dom (nested inside react)
  deferConflicts: boolean // Defer conflict detection until after cascade ends
  breathPhase: boolean // In breath phase - waiting before revealing conflicts
  breathStartTime: number // When breath phase started
}

// Onboarding milestone tracking for staged HUD reveal
export interface OnboardingState {
  introAnimationComplete: boolean // Root node materialization done
  firstClickComplete: boolean // Player has clicked root at least once
  firstConflictSeen: boolean // Player has seen a conflict
  firstSymlinkSeen: boolean // Player has seen duplicates (symlink opportunity)
  firstInnerConflictSeen: boolean // Player has seen a conflict inside a package scope
  firstDivablePackageSeen: boolean // A divable package (top-level) has become ready
  firstDiveSeen: boolean // Player has entered a package scope (dived in)
  firstScopeExited: boolean // Player has exited a stable scope (exit teaching complete)
  firstPrestigeComplete: boolean // Player has prestiged at least once
  firstHighComboSeen: boolean // Player reached combo 5+ (unlock combo teaching tab)
  // Sticky UI visibility (persists across prestiges)
  weightSeen: boolean // Weight indicator has been shown
  qualitySeen: boolean // Quality bar has been shown
}

// Automation state for auto-resolve
// Note: Auto-dedup removed - merging stays manual for gameplay
export interface AutomationState {
  resolveEnabled: boolean // Auto-resolve toggle; saved with the run

  // Auto-resolve in progress
  resolveActive: boolean // Currently processing a resolve
  resolveTargetWireId: string | null // Wire being auto-resolved
  resolveTargetScope: string[] | null // Scope path where wire lives

  // Timing
  processStartTime: number // When current process started (for animation)
  lastResolveTime: number // Last time auto-resolve fired
}

// The game's state, by what resets it. Graph topology (packages, wires, scope hierarchy)
// lives on the Graph + ScopeStack exported from state.ts.
export interface GameState {
  // ---- The run: reset when it ends (Ship), saved ----
  seed: number // RNG seed for the run's rolls
  resources: GameResources
  board: BoardState
  run: RunStats
  camera: {
    x: number
    y: number
    zoom: number
  }

  // ---- The game: kept through ships, reset by a new game, saved ----
  meta: MetaResources
  upgrades: Upgrades
  stats: GameStats
  onboarding: OnboardingState // Sticky HUD reveal and teaching state

  // ---- Within a frame or a gesture: never saved ----
  cascade: CascadeState
  automation: AutomationState
  collapseHold: CollapseHoldState
}

export interface GameConfig {
  // Physics
  nodeRepulsion: number
  wireAttraction: number
  damping: number
}

// User settings (separate from game state, persists independently)
export interface UserSettings {
  /** When true, clicking background exits scope (default: false) */
  backgroundClickToExit: boolean
}
