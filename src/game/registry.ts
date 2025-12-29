// Real-world npm package registry for authentic game feel
// Icon keys map to Devicon identifiers (https://devicon.dev/)

export type PackageArchetype = 'utility' | 'framework' | 'tooling' | 'legacy' | 'runtime';

export interface PackageIdentity {
  name: string;
  iconKey: string;        // Devicon icon name
  archetype: PackageArchetype;
  baseDeps: number;       // Typical dependency count
  weight: number;         // Base size in KB
  isHub: boolean;         // High symlink attraction (like lodash)
}

// Hub packages - ubiquitous utilities that everything depends on
const HUB_PACKAGES: PackageIdentity[] = [
  { name: 'lodash', iconKey: 'lodash', archetype: 'utility', baseDeps: 0, weight: 70, isHub: true },
  { name: 'chalk', iconKey: 'npm', archetype: 'utility', baseDeps: 0, weight: 10, isHub: true },
  { name: 'debug', iconKey: 'npm', archetype: 'utility', baseDeps: 1, weight: 15, isHub: true },
  { name: 'semver', iconKey: 'npm', archetype: 'utility', baseDeps: 0, weight: 20, isHub: true },
  { name: 'uuid', iconKey: 'npm', archetype: 'utility', baseDeps: 0, weight: 10, isHub: true },
  { name: 'ms', iconKey: 'npm', archetype: 'utility', baseDeps: 0, weight: 5, isHub: true },
  { name: 'tslib', iconKey: 'typescript', archetype: 'utility', baseDeps: 0, weight: 30, isHub: true },
];

// Framework packages - heavy, spawn many dependencies
const FRAMEWORK_PACKAGES: PackageIdentity[] = [
  { name: 'react', iconKey: 'react', archetype: 'framework', baseDeps: 2, weight: 130, isHub: false },
  { name: 'react-dom', iconKey: 'react', archetype: 'framework', baseDeps: 3, weight: 140, isHub: false },
  { name: 'vue', iconKey: 'vuejs', archetype: 'framework', baseDeps: 1, weight: 95, isHub: false },
  { name: 'angular', iconKey: 'angularjs', archetype: 'framework', baseDeps: 8, weight: 200, isHub: false },
  { name: 'svelte', iconKey: 'svelte', archetype: 'framework', baseDeps: 0, weight: 50, isHub: false },
  { name: 'next', iconKey: 'nextjs', archetype: 'framework', baseDeps: 12, weight: 300, isHub: false },
  { name: 'express', iconKey: 'express', archetype: 'framework', baseDeps: 4, weight: 60, isHub: false },
];

// Tooling packages - build tools, bundlers, transformers
const TOOLING_PACKAGES: PackageIdentity[] = [
  { name: 'webpack', iconKey: 'webpack', archetype: 'tooling', baseDeps: 8, weight: 250, isHub: false },
  { name: 'vite', iconKey: 'vitejs', archetype: 'tooling', baseDeps: 6, weight: 80, isHub: false },
  { name: 'esbuild', iconKey: 'npm', archetype: 'tooling', baseDeps: 0, weight: 40, isHub: false },
  { name: 'rollup', iconKey: 'rollup', archetype: 'tooling', baseDeps: 4, weight: 100, isHub: false },
  { name: 'babel', iconKey: 'babel', archetype: 'tooling', baseDeps: 6, weight: 150, isHub: false },
  { name: 'typescript', iconKey: 'typescript', archetype: 'tooling', baseDeps: 0, weight: 180, isHub: false },
  { name: 'eslint', iconKey: 'eslint', archetype: 'tooling', baseDeps: 10, weight: 120, isHub: false },
  { name: 'jest', iconKey: 'jest', archetype: 'tooling', baseDeps: 15, weight: 200, isHub: false },
  { name: 'vitest', iconKey: 'vitest', archetype: 'tooling', baseDeps: 5, weight: 80, isHub: false },
  { name: 'prettier', iconKey: 'npm', archetype: 'tooling', baseDeps: 0, weight: 60, isHub: false },
];

// Legacy packages - often cause version conflicts
const LEGACY_PACKAGES: PackageIdentity[] = [
  { name: 'moment', iconKey: 'npm', archetype: 'legacy', baseDeps: 0, weight: 300, isHub: false },
  { name: 'request', iconKey: 'npm', archetype: 'legacy', baseDeps: 5, weight: 80, isHub: false },
  { name: 'underscore', iconKey: 'npm', archetype: 'legacy', baseDeps: 0, weight: 60, isHub: false },
  { name: 'bluebird', iconKey: 'npm', archetype: 'legacy', baseDeps: 0, weight: 90, isHub: false },
  { name: 'async', iconKey: 'npm', archetype: 'legacy', baseDeps: 0, weight: 50, isHub: false },
];

// Runtime packages - node polyfills, core utilities
const RUNTIME_PACKAGES: PackageIdentity[] = [
  { name: 'node', iconKey: 'nodejs', archetype: 'runtime', baseDeps: 0, weight: 50, isHub: true },
  { name: 'fs-extra', iconKey: 'nodejs', archetype: 'runtime', baseDeps: 2, weight: 30, isHub: false },
  { name: 'path', iconKey: 'nodejs', archetype: 'runtime', baseDeps: 0, weight: 5, isHub: true },
  { name: 'buffer', iconKey: 'nodejs', archetype: 'runtime', baseDeps: 1, weight: 40, isHub: false },
  { name: 'process', iconKey: 'nodejs', archetype: 'runtime', baseDeps: 0, weight: 10, isHub: true },
];

// Leaf packages - zero dependencies, stabilizers
const LEAF_PACKAGES: PackageIdentity[] = [
  { name: 'is-odd', iconKey: 'npm', archetype: 'utility', baseDeps: 0, weight: 2, isHub: false },
  { name: 'is-even', iconKey: 'npm', archetype: 'utility', baseDeps: 0, weight: 2, isHub: false },
  { name: 'is-number', iconKey: 'npm', archetype: 'utility', baseDeps: 0, weight: 2, isHub: false },
  { name: 'left-pad', iconKey: 'npm', archetype: 'utility', baseDeps: 0, weight: 1, isHub: false },
  { name: 'escape-html', iconKey: 'npm', archetype: 'utility', baseDeps: 0, weight: 3, isHub: false },
  { name: 'safe-buffer', iconKey: 'npm', archetype: 'utility', baseDeps: 0, weight: 5, isHub: false },
  { name: 'inherits', iconKey: 'npm', archetype: 'utility', baseDeps: 0, weight: 2, isHub: false },
  { name: 'color-name', iconKey: 'npm', archetype: 'utility', baseDeps: 0, weight: 3, isHub: false },
  { name: 'has-flag', iconKey: 'npm', archetype: 'utility', baseDeps: 0, weight: 2, isHub: false },
  { name: 'supports-color', iconKey: 'npm', archetype: 'utility', baseDeps: 1, weight: 4, isHub: false },
];

// Combined registry
export const PACKAGE_REGISTRY: PackageIdentity[] = [
  ...HUB_PACKAGES,
  ...FRAMEWORK_PACKAGES,
  ...TOOLING_PACKAGES,
  ...LEGACY_PACKAGES,
  ...RUNTIME_PACKAGES,
  ...LEAF_PACKAGES,
];

// Weighted distribution for realistic spawning
// Matches research: 50% leaf, heavy tail distribution
export interface DependencyTier {
  count: number;
  weight: number;  // Probability weight
}

export const DEPENDENCY_DISTRIBUTION: DependencyTier[] = [
  { count: 0, weight: 50 },   // Leaf nodes - stabilizers
  { count: 1, weight: 15 },   // Minimal deps
  { count: 2, weight: 15 },   // Light
  { count: 3, weight: 10 },   // Normal
  { count: 4, weight: 5 },    // Heavy-ish
  { count: 5, weight: 3 },    // Heavy
  { count: 8, weight: 1.5 },  // Very heavy
  { count: 12, weight: 0.5 }, // Legendary (jest, webpack)
];

/**
 * Pick a random package identity from the registry
 * Weights by archetype rarity
 */
export function pickRandomIdentity(): PackageIdentity {
  // Weight: leaf/hub appear more often, frameworks rare
  const roll = Math.random();

  let pool: PackageIdentity[] = LEAF_PACKAGES; // default
  if (roll < 0.40) {
    // 40% chance: leaf package
    pool = LEAF_PACKAGES;
  } else if (roll < 0.65) {
    // 25% chance: hub utility
    pool = HUB_PACKAGES;
  } else if (roll < 0.80) {
    // 15% chance: runtime
    pool = RUNTIME_PACKAGES;
  } else if (roll < 0.90) {
    // 10% chance: tooling
    pool = TOOLING_PACKAGES;
  } else if (roll < 0.97) {
    // 7% chance: framework
    pool = FRAMEWORK_PACKAGES;
  } else {
    // 3% chance: legacy (conflict-prone)
    pool = LEGACY_PACKAGES;
  }

  const index = Math.floor(Math.random() * pool.length);
  return pool[index]!;
}

/**
 * Roll dependency count using realistic distribution
 * Returns the number of deps to spawn
 */
export function rollRealisticDependencyCount(identity?: PackageIdentity): number {
  // If we have identity, use its baseDeps as influence
  if (identity && identity.baseDeps > 0) {
    // Use package's typical dep count with some variance
    const variance = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
    return Math.max(0, identity.baseDeps + variance);
  }

  // Otherwise use the weighted distribution
  const totalWeight = DEPENDENCY_DISTRIBUTION.reduce((sum, tier) => sum + tier.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const tier of DEPENDENCY_DISTRIBUTION) {
    roll -= tier.weight;
    if (roll <= 0) {
      return tier.count;
    }
  }

  return 0; // Fallback to leaf
}

/**
 * Get hub packages of a specific version for symlink matching
 */
export function getHubPackages(): PackageIdentity[] {
  return PACKAGE_REGISTRY.filter(p => p.isHub);
}

/**
 * Check if an identity tends to cause conflicts (legacy packages)
 */
export function isConflictProne(identity: PackageIdentity): boolean {
  return identity.archetype === 'legacy';
}
