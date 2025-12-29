// Core game types for "The Heaviest Objects in the Universe"

import type { PackageIdentity } from './registry';

export type PackageState = 'installing' | 'ready' | 'conflict' | 'optimized';

export type WireType = 'dependency' | 'symlink' | 'sibling';

// Internal state for top-level packages (scope system)
export type InternalState = 'pristine' | 'unstable' | 'stable';

export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  vx: number;
  vy: number;
}

export interface Package {
  id: string;
  parentId: string | null;
  position: Position;
  velocity: Velocity;
  state: PackageState;
  size: number; // Weight contribution
  depth: number; // How deep in the tree (for rendering inner trees)
  children: string[]; // Child package IDs
  installProgress: number; // 0-1 for installation animation
  conflictProgress: number; // 0-1 for conflict resolution
  identity?: PackageIdentity; // Real package identity (name, icon, archetype)

  // Scope system (top-level packages only, null for inner deps)
  internalPackages: Map<string, Package> | null;
  internalWires: Map<string, Wire> | null;
  internalState: InternalState | null; // null for inner deps

  // Ghost status (for symlinked-away nodes)
  isGhost: boolean;
  ghostTargetId: string | null; // Package ID where real node lives
  ghostTargetScope: string | null; // Scope (package ID) where real node lives
}

export interface Wire {
  id: string;
  fromId: string;
  toId: string;
  wireType: WireType;
  isSymlink: boolean; // Kept for backwards compat, derived from wireType
  flowProgress: number; // 0-1 for data flow animation
  conflicted: boolean; // True if wire connects incompatible packages
  conflictTime: number; // Timestamp when conflict started (for animations)
}

export interface GameResources {
  bandwidth: number;
  maxBandwidth: number;
  bandwidthRegen: number;
  weight: number;
}

export interface MetaResources {
  cacheTokens: number;
  ecosystemTier: number;
  totalPrestiges: number;
}

export interface Upgrades {
  bandwidthLevel: number;    // Combined: regen + capacity
  efficiencyLevel: number;   // Combined: speed + cost reduction
}

export interface GameStats {
  totalPackagesInstalled: number;
  totalConflictsResolved: number;
  totalSymlinksCreated: number;
  maxWeightReached: number;
  currentEfficiency: number;
}

// Onboarding milestone tracking for staged HUD reveal
export interface OnboardingState {
  introAnimationComplete: boolean;  // Root node materialization done
  firstClickComplete: boolean;      // Player has clicked root at least once
  firstConflictSeen: boolean;       // Player has seen a conflict
  firstSymlinkSeen: boolean;        // Player has seen duplicates (symlink opportunity)
  firstPrestigeComplete: boolean;   // Player has prestiged at least once
}

export interface GameState {
  // Core resources
  resources: GameResources;

  // Meta resources (persist through prestige)
  meta: MetaResources;

  // Upgrades
  upgrades: Upgrades;

  // Onboarding (for staged HUD reveal)
  onboarding: OnboardingState;

  // Graph data
  packages: Map<string, Package>;
  wires: Map<string, Wire>;
  rootId: string | null;

  // Scope system
  currentScope: 'root' | string; // 'root' or package ID
  tutorialGating: boolean; // true until first prestige - gates package installs

  // Stats
  stats: GameStats;

  // View state
  camera: {
    x: number;
    y: number;
    zoom: number;
  };

  // Time tracking
  lastTick: number;
  tickCount: number;
}

export interface GameConfig {
  // Cost scaling
  baseBandwidthCost: number;
  costMultiplier: number;

  // Production rates
  baseBandwidthRegen: number;
  cacheTokenMultiplier: number;

  // Dependencies
  minDependencies: number;
  maxDependencies: number;
  dependencyDepthLimit: number;

  // Prestige
  prestigeWeightThreshold: number;

  // Physics
  nodeRepulsion: number;
  wireAttraction: number;
  damping: number;
}
