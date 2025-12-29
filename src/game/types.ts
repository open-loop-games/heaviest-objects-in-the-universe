// Core game types for "The Heaviest Objects in the Universe"

import type { PackageIdentity } from './registry';

export type PackageState = 'installing' | 'ready' | 'conflict' | 'optimized';

export type VersionShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'star';

export type WireType = 'dependency' | 'devDependency' | 'peerDependency' | 'symlink';

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
  version: VersionShape;
  size: number; // Weight contribution
  depth: number; // How deep in the tree (for rendering inner trees)
  children: string[]; // Child package IDs
  installProgress: number; // 0-1 for installation animation
  conflictProgress: number; // 0-1 for conflict resolution
  heat: number; // Local heat contribution
  identity?: PackageIdentity; // Real package identity (name, icon, archetype)
}

export interface Wire {
  id: string;
  fromId: string;
  toId: string;
  wireType: WireType;
  isSymlink: boolean; // Kept for backwards compat, derived from wireType
  flowProgress: number; // 0-1 for data flow animation
}

export interface GameResources {
  bandwidth: number;
  maxBandwidth: number;
  bandwidthRegen: number;
  weight: number;
  heat: number;
  maxHeat: number;
}

export interface MetaResources {
  cacheTokens: number;
  algorithmFragments: number;
  ecosystemTier: number;
  totalPrestiges: number;
}

export interface Upgrades {
  bandwidthRegenLevel: number;
  maxBandwidthLevel: number;
  autoInstallLevel: number;
  autoResolveLevel: number;
  installSpeedLevel: number;
  costReductionLevel: number;
  symlinkUnlocked: boolean;
  pruneUnlocked: boolean;
}

export interface GameStats {
  totalPackagesInstalled: number;
  totalConflictsResolved: number;
  totalSymlinksCreated: number;
  maxWeightReached: number;
  currentEfficiency: number;
}

export interface GameState {
  // Core resources
  resources: GameResources;

  // Meta resources (persist through prestige)
  meta: MetaResources;

  // Upgrades
  upgrades: Upgrades;

  // Graph data
  packages: Map<string, Package>;
  wires: Map<string, Wire>;
  rootId: string | null;

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

  // Heat mechanics
  heatPerPackage: number;
  heatDecay: number;
  conflictChancePerHeat: number;

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
