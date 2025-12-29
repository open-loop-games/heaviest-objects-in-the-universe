// Package creation and management logic

import { gameState, gameConfig, addPackage, addWire, addHeat, spendBandwidth } from './state';
import {
  type Package,
  type Wire,
  type WireType,
  type Position,
  type VersionShape,
} from './types';
import {
  rollDependencyCount,
  rollVersionShape,
  rollPackageSize,
  getConflictChance,
} from './formulas';
import { getEffectiveInstallCost } from './upgrades';
import { pickRandomIdentity, isConflictProne, type PackageIdentity } from './registry';

/**
 * Roll a random wire type (most are regular deps)
 */
function rollWireType(): WireType {
  const roll = Math.random();
  if (roll < 0.70) return 'dependency';      // 70% regular
  if (roll < 0.90) return 'devDependency';   // 20% dev
  return 'peerDependency';                    // 10% peer
}

let nextId = 0;

function generateId(): string {
  return `pkg_${nextId++}`;
}

function generateWireId(): string {
  return `wire_${nextId++}`;
}

// Root package identity - npm itself
const ROOT_IDENTITY: PackageIdentity = {
  name: 'package.json',
  iconKey: 'npm',
  archetype: 'runtime',
  baseDeps: 5,
  weight: 1,
  isHub: true,
};

/**
 * Create the root package (first package in the tree)
 */
export function createRootPackage(): Package | null {
  if (gameState.rootId !== null) {
    return null; // Root already exists
  }

  const id = generateId();
  const pkg: Package = {
    id,
    parentId: null,
    position: { x: 0, y: 0 },
    velocity: { vx: 0, vy: 0 },
    state: 'ready',
    version: 'circle', // Root is always stable
    size: 100,
    depth: 0,
    children: [],
    installProgress: 1,
    conflictProgress: 0,
    heat: 0,
    identity: ROOT_IDENTITY,
  };

  gameState.rootId = id;
  addPackage(pkg);
  return pkg;
}

/**
 * Attempt to install a new package as a child of the target
 */
export function installPackage(parentId: string): Package | null {
  const parent = gameState.packages.get(parentId);
  if (!parent) return null;

  const cost = getEffectiveInstallCost();
  if (!spendBandwidth(cost)) {
    return null; // Not enough bandwidth
  }

  const id = generateId();
  const angle = Math.random() * Math.PI * 2;
  const distance = 80 + Math.random() * 40;

  // Pick a real package identity
  const identity = pickRandomIdentity();

  // Use identity weight with some variance, or fallback to random
  const size = identity
    ? Math.max(10, identity.weight + Math.floor(Math.random() * 20) - 10)
    : rollPackageSize();

  const pkg: Package = {
    id,
    parentId,
    position: {
      x: parent.position.x + Math.cos(angle) * distance,
      y: parent.position.y + Math.sin(angle) * distance,
    },
    velocity: { vx: 0, vy: 0 },
    state: 'installing',
    version: rollVersionShape(),
    size,
    depth: parent.depth + 1,
    children: [],
    installProgress: 0,
    conflictProgress: 0,
    heat: 0,
    identity,
  };

  // Add wire connecting parent to child
  const wireType = rollWireType();
  const wire: Wire = {
    id: generateWireId(),
    fromId: parentId,
    toId: id,
    wireType,
    isSymlink: false,
    flowProgress: 0,
  };

  parent.children.push(id);
  addPackage(pkg);
  addWire(wire);
  addHeat(gameConfig.heatPerPackage);

  return pkg;
}

/**
 * Spawn dependencies for a package that just finished installing
 */
export function spawnDependencies(packageId: string): Package[] {
  const pkg = gameState.packages.get(packageId);
  if (!pkg) return [];

  // Don't spawn if too deep
  if (pkg.depth >= gameConfig.dependencyDepthLimit) {
    return [];
  }

  // Use identity-based dep count if available, otherwise use distribution
  let count: number;
  if (pkg.identity && pkg.identity.baseDeps > 0) {
    // Use package's typical dep count with variance
    const variance = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
    count = Math.max(0, pkg.identity.baseDeps + variance);
  } else {
    count = rollDependencyCount(gameConfig);
  }

  const spawned: Package[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const distance = 60 + Math.random() * 30;

    const id = generateId();

    // Pick identity for the child
    const identity = pickRandomIdentity();
    const size = identity
      ? Math.max(10, identity.weight + Math.floor(Math.random() * 20) - 10)
      : rollPackageSize();

    const child: Package = {
      id,
      parentId: packageId,
      position: {
        x: pkg.position.x + Math.cos(angle) * distance,
        y: pkg.position.y + Math.sin(angle) * distance,
      },
      velocity: {
        vx: Math.cos(angle) * 2,
        vy: Math.sin(angle) * 2,
      },
      state: 'installing',
      version: rollVersionShape(),
      size,
      depth: pkg.depth + 1,
      children: [],
      installProgress: 0,
      conflictProgress: 0,
      heat: 0,
      identity,
    };

    // Check for version conflict with parent
    // Legacy packages have higher conflict chance
    const conflictBonus = identity && isConflictProne(identity) ? 0.15 : 0;
    if (shouldCreateConflict(pkg.version, child.version, conflictBonus)) {
      child.state = 'conflict';
    }

    const wireType = rollWireType();
    const wire: Wire = {
      id: generateWireId(),
      fromId: packageId,
      toId: id,
      wireType,
      isSymlink: false,
      flowProgress: 0,
    };

    pkg.children.push(id);
    addPackage(child);
    addWire(wire);
    addHeat(gameConfig.heatPerPackage);

    spawned.push(child);
  }

  return spawned;
}

/**
 * Check if a version conflict should be created
 * @param extraBonus - additional conflict chance (e.g., for legacy packages)
 */
function shouldCreateConflict(
  parentVersion: VersionShape,
  childVersion: VersionShape,
  extraBonus: number = 0
): boolean {
  // Conflict chance based on heat
  const baseChance = getConflictChance(gameState.resources.heat, gameConfig);

  // Higher chance if versions are very different
  const versionMismatch = parentVersion !== childVersion && parentVersion !== 'circle';
  const mismatchBonus = versionMismatch ? 0.1 : 0;

  return Math.random() < (baseChance + mismatchBonus + extraBonus);
}

/**
 * Find packages that could be symlinked (same version, not already linked)
 */
export function findSymlinkCandidates(packageId: string): Package[] {
  const pkg = gameState.packages.get(packageId);
  if (!pkg) return [];

  const candidates: Package[] = [];

  for (const [id, other] of gameState.packages) {
    if (id === packageId) continue;
    if (other.version !== pkg.version) continue;

    // Check if already linked
    const alreadyLinked = Array.from(gameState.wires.values()).some(
      w => w.isSymlink && ((w.fromId === packageId && w.toId === id) || (w.fromId === id && w.toId === packageId))
    );

    if (!alreadyLinked) {
      candidates.push(other);
    }
  }

  return candidates;
}

/**
 * Create a symlink between two packages
 */
export function createSymlink(fromId: string, toId: string): Wire | null {
  const from = gameState.packages.get(fromId);
  const to = gameState.packages.get(toId);

  if (!from || !to) return null;
  if (from.version !== to.version) return null;

  const wire: Wire = {
    id: generateWireId(),
    fromId,
    toId,
    wireType: 'symlink',
    isSymlink: true,
    flowProgress: 0,
  };

  addWire(wire);

  // Mark both as optimized
  from.state = 'optimized';
  to.state = 'optimized';

  return wire;
}

/**
 * Get all packages in the tree (breadth-first)
 */
export function getAllPackages(): Package[] {
  return Array.from(gameState.packages.values());
}

/**
 * Get packages at a specific depth
 */
export function getPackagesAtDepth(depth: number): Package[] {
  return Array.from(gameState.packages.values()).filter(p => p.depth === depth);
}

/**
 * Find package at screen position (for click detection)
 */
export function findPackageAtPosition(pos: Position, radius: number = 30): Package | null {
  for (const pkg of gameState.packages.values()) {
    const dx = pkg.position.x - pos.x;
    const dy = pkg.position.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= radius) {
      return pkg;
    }
  }
  return null;
}
