// Real-world npm package registry for authentic game feel
// Icon keys map to Devicon identifiers (https://devicon.dev/)

export type PackageArchetype =
  | 'utility'
  | 'framework'
  | 'tooling'
  | 'legacy'
  | 'runtime'

// ============================================
// STARTER KIT - Curated first package
// ============================================
// Deterministic first-install experience for teaching mechanics.
// Contains a guaranteed conflict (moment vs date-fns).

export const STARTER_KIT_IDENTITY: PackageIdentity = {
  name: 'starter-kit',
  iconKey: 'npm',
  archetype: 'framework',
  baseDeps: 8,
  weight: 50,
  isHub: false,
}

// Internal dependencies for starter-kit (spawned when entering)
// Curated for first-time experience:
// - 2 conflicts to resolve (moment/date-fns, jest/mocha)
// - 2 duplicates to merge (lodash appears twice)
// - Mix of weights for visual variety
export const STARTER_KIT_INTERNAL_DEPS: PackageIdentity[] = [
  // Conflict pair 1: moment vs date-fns (legacy vs modern)
  {
    name: 'moment',
    iconKey: 'npm',
    archetype: 'legacy',
    baseDeps: 0,
    weight: 300,
    isHub: false,
  },
  {
    name: 'date-fns',
    iconKey: 'npm',
    archetype: 'utility',
    baseDeps: 0,
    weight: 40,
    isHub: false,
  },

  // Conflict pair 2: jest vs mocha (test runner war)
  {
    name: 'jest',
    iconKey: 'jest',
    archetype: 'tooling',
    baseDeps: 0,
    weight: 200,
    isHub: false,
  },
  {
    name: 'mocha',
    iconKey: 'mocha',
    archetype: 'tooling',
    baseDeps: 0,
    weight: 80,
    isHub: false,
  },

  // Duplicate pair: lodash (common hub, shows symlink mechanic)
  {
    name: 'lodash',
    iconKey: 'lodash',
    archetype: 'utility',
    baseDeps: 0,
    weight: 70,
    isHub: true,
  },
  {
    name: 'lodash',
    iconKey: 'lodash',
    archetype: 'utility',
    baseDeps: 0,
    weight: 70,
    isHub: true,
  },

  // Additional deps to fill out the tree
  {
    name: 'debug',
    iconKey: 'npm',
    archetype: 'utility',
    baseDeps: 0,
    weight: 15,
    isHub: true,
  },
  {
    name: 'chalk',
    iconKey: 'npm',
    archetype: 'utility',
    baseDeps: 0,
    weight: 10,
    isHub: true,
  },
]

export interface PackageIdentity {
  name: string
  iconKey: string // Devicon icon name
  archetype: PackageArchetype
  baseDeps: number // Typical dependency count
  weight: number // Base size in KB
  isHub: boolean // High symlink attraction (like lodash)
}

// Hub packages - ubiquitous utilities that everything depends on
const HUB_PACKAGES: PackageIdentity[] = [
  {
    name: 'lodash',
    iconKey: 'lodash',
    archetype: 'utility',
    baseDeps: 0,
    weight: 70,
    isHub: true,
  },
  {
    name: 'axios',
    iconKey: 'axios',
    archetype: 'utility',
    baseDeps: 1,
    weight: 30,
    isHub: true,
  },
  {
    name: 'chalk',
    iconKey: 'npm',
    archetype: 'utility',
    baseDeps: 0,
    weight: 10,
    isHub: true,
  },
  {
    name: 'debug',
    iconKey: 'npm',
    archetype: 'utility',
    baseDeps: 1,
    weight: 15,
    isHub: true,
  },
  {
    name: 'semver',
    iconKey: 'npm',
    archetype: 'utility',
    baseDeps: 0,
    weight: 20,
    isHub: true,
  },
  {
    name: 'uuid',
    iconKey: 'npm',
    archetype: 'utility',
    baseDeps: 0,
    weight: 10,
    isHub: true,
  },
  {
    name: 'ms',
    iconKey: 'npm',
    archetype: 'utility',
    baseDeps: 0,
    weight: 5,
    isHub: true,
  },
  {
    name: 'tslib',
    iconKey: 'typescript',
    archetype: 'utility',
    baseDeps: 0,
    weight: 30,
    isHub: true,
  },
  {
    name: 'rxjs',
    iconKey: 'rxjs',
    archetype: 'utility',
    baseDeps: 0,
    weight: 50,
    isHub: true,
  },
  {
    name: 'redux',
    iconKey: 'redux',
    archetype: 'utility',
    baseDeps: 0,
    weight: 25,
    isHub: true,
  },
  {
    name: 'd3',
    iconKey: 'd3js',
    archetype: 'utility',
    baseDeps: 0,
    weight: 250,
    isHub: false,
  },
  {
    name: 'jquery',
    iconKey: 'jquery',
    archetype: 'utility',
    baseDeps: 0,
    weight: 90,
    isHub: true,
  },
  {
    name: 'graphql',
    iconKey: 'graphql',
    archetype: 'utility',
    baseDeps: 0,
    weight: 40,
    isHub: true,
  },
  {
    name: 'socket.io',
    iconKey: 'socketio',
    archetype: 'utility',
    baseDeps: 2,
    weight: 45,
    isHub: true,
  },
  {
    name: 'chart.js',
    iconKey: 'chartjs',
    archetype: 'utility',
    baseDeps: 0,
    weight: 60,
    isHub: false,
  },
  {
    name: 'zod',
    iconKey: 'npm', // Uses semantic icon (General Zod!)
    archetype: 'utility',
    baseDeps: 0,
    weight: 15,
    isHub: true,
  },
  {
    name: 'yup',
    iconKey: 'npm', // Uses semantic icon (thumbs up)
    archetype: 'utility',
    baseDeps: 0,
    weight: 12,
    isHub: true,
  },
  {
    name: 'joi',
    iconKey: 'npm', // Uses semantic icon (smiley)
    archetype: 'utility',
    baseDeps: 0,
    weight: 20,
    isHub: true,
  },
  {
    name: 'dotenv',
    iconKey: 'npm', // Uses semantic icon (dots)
    archetype: 'utility',
    baseDeps: 0,
    weight: 5,
    isHub: true,
  },
  {
    name: 'cors',
    iconKey: 'npm', // Uses semantic icon (crossed arrows)
    archetype: 'utility',
    baseDeps: 0,
    weight: 8,
    isHub: true,
  },
  {
    name: 'helmet',
    iconKey: 'npm', // Uses semantic icon (viking helmet)
    archetype: 'utility',
    baseDeps: 0,
    weight: 10,
    isHub: true,
  },
]

// Framework packages - heavy, spawn many dependencies
const FRAMEWORK_PACKAGES: PackageIdentity[] = [
  {
    name: 'react',
    iconKey: 'react',
    archetype: 'framework',
    baseDeps: 2,
    weight: 130,
    isHub: false,
  },
  {
    name: 'react-dom',
    iconKey: 'react', // Uses variant system for visual distinction
    archetype: 'framework',
    baseDeps: 3,
    weight: 140,
    isHub: false,
  },
  {
    name: 'vue',
    iconKey: 'vuejs',
    archetype: 'framework',
    baseDeps: 1,
    weight: 95,
    isHub: false,
  },
  {
    name: 'angular',
    iconKey: 'angular',
    archetype: 'framework',
    baseDeps: 8,
    weight: 200,
    isHub: false,
  },
  {
    name: 'svelte',
    iconKey: 'svelte',
    archetype: 'framework',
    baseDeps: 0,
    weight: 50,
    isHub: false,
  },
  {
    name: 'next',
    iconKey: 'nextjs',
    archetype: 'framework',
    baseDeps: 12,
    weight: 300,
    isHub: false,
  },
  {
    name: 'express',
    iconKey: 'express',
    archetype: 'framework',
    baseDeps: 4,
    weight: 60,
    isHub: false,
  },
  {
    name: 'nestjs',
    iconKey: 'nestjs',
    archetype: 'framework',
    baseDeps: 8,
    weight: 180,
    isHub: false,
  },
  {
    name: 'gatsby',
    iconKey: 'gatsby',
    archetype: 'framework',
    baseDeps: 15,
    weight: 350,
    isHub: false,
  },
  {
    name: 'nuxt',
    iconKey: 'nuxtjs',
    archetype: 'framework',
    baseDeps: 10,
    weight: 250,
    isHub: false,
  },
  {
    name: 'remix',
    iconKey: 'remix',
    archetype: 'framework',
    baseDeps: 8,
    weight: 200,
    isHub: false,
  },
  {
    name: 'fastify',
    iconKey: 'fastify',
    archetype: 'framework',
    baseDeps: 3,
    weight: 50,
    isHub: false,
  },
  {
    name: 'electron',
    iconKey: 'electron',
    archetype: 'framework',
    baseDeps: 5,
    weight: 400,
    isHub: false,
  },
  {
    name: 'astro',
    iconKey: 'astro',
    archetype: 'framework',
    baseDeps: 6,
    weight: 120,
    isHub: false,
  },
  {
    name: 'ionic',
    iconKey: 'ionic',
    archetype: 'framework',
    baseDeps: 8,
    weight: 180,
    isHub: false,
  },
  {
    name: 'ember',
    iconKey: 'ember',
    archetype: 'framework',
    baseDeps: 10,
    weight: 220,
    isHub: false,
  },
  {
    name: 'backbone',
    iconKey: 'backbonejs',
    archetype: 'framework',
    baseDeps: 2,
    weight: 70,
    isHub: false,
  },
]

// Tooling packages - build tools, bundlers, transformers
const TOOLING_PACKAGES: PackageIdentity[] = [
  {
    name: 'webpack',
    iconKey: 'webpack',
    archetype: 'tooling',
    baseDeps: 8,
    weight: 250,
    isHub: false,
  },
  {
    name: 'vite',
    iconKey: 'vitejs',
    archetype: 'tooling',
    baseDeps: 6,
    weight: 80,
    isHub: false,
  },
  {
    name: 'esbuild',
    iconKey: 'npm', // No devicon, uses procedural
    archetype: 'tooling',
    baseDeps: 0,
    weight: 40,
    isHub: false,
  },
  {
    name: 'rollup',
    iconKey: 'rollup',
    archetype: 'tooling',
    baseDeps: 4,
    weight: 100,
    isHub: false,
  },
  {
    name: 'babel',
    iconKey: 'babel',
    archetype: 'tooling',
    baseDeps: 6,
    weight: 150,
    isHub: false,
  },
  {
    name: 'typescript',
    iconKey: 'typescript',
    archetype: 'tooling',
    baseDeps: 0,
    weight: 180,
    isHub: false,
  },
  {
    name: 'eslint',
    iconKey: 'eslint',
    archetype: 'tooling',
    baseDeps: 10,
    weight: 120,
    isHub: false,
  },
  {
    name: 'jest',
    iconKey: 'jest',
    archetype: 'tooling',
    baseDeps: 15,
    weight: 200,
    isHub: false,
  },
  {
    name: 'vitest',
    iconKey: 'vitest',
    archetype: 'tooling',
    baseDeps: 5,
    weight: 80,
    isHub: false,
  },
  {
    name: 'prettier',
    iconKey: 'npm', // No devicon, uses procedural
    archetype: 'tooling',
    baseDeps: 0,
    weight: 60,
    isHub: false,
  },
  {
    name: 'postcss',
    iconKey: 'postcss',
    archetype: 'tooling',
    baseDeps: 3,
    weight: 40,
    isHub: false,
  },
  {
    name: 'tailwindcss',
    iconKey: 'tailwindcss',
    archetype: 'tooling',
    baseDeps: 4,
    weight: 90,
    isHub: false,
  },
  {
    name: 'sass',
    iconKey: 'sass',
    archetype: 'tooling',
    baseDeps: 2,
    weight: 50,
    isHub: false,
  },
  {
    name: 'gulp',
    iconKey: 'gulp',
    archetype: 'tooling',
    baseDeps: 8,
    weight: 120,
    isHub: false,
  },
  {
    name: 'grunt',
    iconKey: 'grunt',
    archetype: 'tooling',
    baseDeps: 6,
    weight: 100,
    isHub: false,
  },
  {
    name: 'mocha',
    iconKey: 'mocha',
    archetype: 'tooling',
    baseDeps: 4,
    weight: 80,
    isHub: false,
  },
  {
    name: 'playwright',
    iconKey: 'playwright',
    archetype: 'tooling',
    baseDeps: 3,
    weight: 150,
    isHub: false,
  },
  {
    name: 'storybook',
    iconKey: 'storybook',
    archetype: 'tooling',
    baseDeps: 20,
    weight: 400,
    isHub: false,
  },
  {
    name: 'cypress',
    iconKey: 'cypressio',
    archetype: 'tooling',
    baseDeps: 8,
    weight: 180,
    isHub: false,
  },
  {
    name: 'puppeteer',
    iconKey: 'puppeteer',
    archetype: 'tooling',
    baseDeps: 4,
    weight: 120,
    isHub: false,
  },
  {
    name: 'prisma',
    iconKey: 'prisma',
    archetype: 'tooling',
    baseDeps: 5,
    weight: 100,
    isHub: false,
  },
  {
    name: 'sequelize',
    iconKey: 'sequelize',
    archetype: 'tooling',
    baseDeps: 6,
    weight: 90,
    isHub: false,
  },
  {
    name: 'docker',
    iconKey: 'docker',
    archetype: 'tooling',
    baseDeps: 0,
    weight: 200,
    isHub: false,
  },
  {
    name: 'kubernetes',
    iconKey: 'kubernetes',
    archetype: 'tooling',
    baseDeps: 3,
    weight: 250,
    isHub: false,
  },
  {
    name: 'bun',
    iconKey: 'bun',
    archetype: 'tooling',
    baseDeps: 0,
    weight: 60,
    isHub: false,
  },
]

// Legacy packages - often cause version conflicts
const LEGACY_PACKAGES: PackageIdentity[] = [
  {
    name: 'moment',
    iconKey: 'npm',
    archetype: 'legacy',
    baseDeps: 0,
    weight: 300,
    isHub: false,
  },
  {
    name: 'request',
    iconKey: 'npm',
    archetype: 'legacy',
    baseDeps: 5,
    weight: 80,
    isHub: false,
  },
  {
    name: 'underscore',
    iconKey: 'npm',
    archetype: 'legacy',
    baseDeps: 0,
    weight: 60,
    isHub: false,
  },
  {
    name: 'bluebird',
    iconKey: 'npm',
    archetype: 'legacy',
    baseDeps: 0,
    weight: 90,
    isHub: false,
  },
  {
    name: 'async',
    iconKey: 'npm',
    archetype: 'legacy',
    baseDeps: 0,
    weight: 50,
    isHub: false,
  },
]

// Runtime packages - node polyfills, core utilities
// Only 'node' gets the nodejs icon; others use procedural for visual distinction
const RUNTIME_PACKAGES: PackageIdentity[] = [
  {
    name: 'node',
    iconKey: 'nodejs',
    archetype: 'runtime',
    baseDeps: 0,
    weight: 50,
    isHub: true,
  },
  {
    name: 'fs-extra',
    iconKey: 'npm', // Procedural fallback - unique shape/color
    archetype: 'runtime',
    baseDeps: 2,
    weight: 30,
    isHub: false,
  },
  {
    name: 'path',
    iconKey: 'npm', // Procedural fallback - unique shape/color
    archetype: 'runtime',
    baseDeps: 0,
    weight: 5,
    isHub: true,
  },
  {
    name: 'buffer',
    iconKey: 'npm', // Procedural fallback - unique shape/color
    archetype: 'runtime',
    baseDeps: 1,
    weight: 40,
    isHub: false,
  },
  {
    name: 'process',
    iconKey: 'npm', // Procedural fallback - unique shape/color
    archetype: 'runtime',
    baseDeps: 0,
    weight: 10,
    isHub: true,
  },
]

// Leaf packages - zero dependencies, stabilizers
const LEAF_PACKAGES: PackageIdentity[] = [
  {
    name: 'is-odd',
    iconKey: 'npm',
    archetype: 'utility',
    baseDeps: 0,
    weight: 2,
    isHub: false,
  },
  {
    name: 'is-even',
    iconKey: 'npm',
    archetype: 'utility',
    baseDeps: 0,
    weight: 2,
    isHub: false,
  },
  {
    name: 'is-number',
    iconKey: 'npm',
    archetype: 'utility',
    baseDeps: 0,
    weight: 2,
    isHub: false,
  },
  {
    name: 'left-pad',
    iconKey: 'npm',
    archetype: 'utility',
    baseDeps: 0,
    weight: 1,
    isHub: false,
  },
  {
    name: 'escape-html',
    iconKey: 'npm',
    archetype: 'utility',
    baseDeps: 0,
    weight: 3,
    isHub: false,
  },
  {
    name: 'safe-buffer',
    iconKey: 'npm',
    archetype: 'utility',
    baseDeps: 0,
    weight: 5,
    isHub: false,
  },
  {
    name: 'inherits',
    iconKey: 'npm',
    archetype: 'utility',
    baseDeps: 0,
    weight: 2,
    isHub: false,
  },
  {
    name: 'color-name',
    iconKey: 'npm',
    archetype: 'utility',
    baseDeps: 0,
    weight: 3,
    isHub: false,
  },
  {
    name: 'has-flag',
    iconKey: 'npm',
    archetype: 'utility',
    baseDeps: 0,
    weight: 2,
    isHub: false,
  },
  {
    name: 'supports-color',
    iconKey: 'npm',
    archetype: 'utility',
    baseDeps: 1,
    weight: 4,
    isHub: false,
  },
  {
    name: 'nanoid',
    iconKey: 'npm', // Uses semantic icon (snowflake)
    archetype: 'utility',
    baseDeps: 0,
    weight: 3,
    isHub: false,
  },
  {
    name: 'commander',
    iconKey: 'npm', // Uses semantic icon (chevrons)
    archetype: 'utility',
    baseDeps: 0,
    weight: 8,
    isHub: false,
  },
  {
    name: 'yargs',
    iconKey: 'npm', // Uses semantic icon (pirate flag)
    archetype: 'utility',
    baseDeps: 2,
    weight: 15,
    isHub: false,
  },
  {
    name: 'inquirer',
    iconKey: 'npm', // Uses semantic icon (question bubble)
    archetype: 'utility',
    baseDeps: 3,
    weight: 20,
    isHub: false,
  },
  {
    name: 'ora',
    iconKey: 'npm', // Uses semantic icon (spinner)
    archetype: 'utility',
    baseDeps: 2,
    weight: 8,
    isHub: false,
  },
  {
    name: 'bcrypt',
    iconKey: 'npm', // Uses semantic icon (padlock)
    archetype: 'utility',
    baseDeps: 1,
    weight: 25,
    isHub: false,
  },
  {
    name: 'passport',
    iconKey: 'npm', // Uses semantic icon (ID card)
    archetype: 'utility',
    baseDeps: 2,
    weight: 15,
    isHub: false,
  },
  {
    name: 'jsonwebtoken',
    iconKey: 'npm', // Uses semantic icon (JWT parts)
    archetype: 'utility',
    baseDeps: 1,
    weight: 10,
    isHub: false,
  },
  {
    name: 'mongoose',
    iconKey: 'npm', // Uses semantic icon (mongoose animal)
    archetype: 'utility',
    baseDeps: 3,
    weight: 80,
    isHub: false,
  },
  {
    name: 'got',
    iconKey: 'npm', // Uses semantic icon (arrow)
    archetype: 'utility',
    baseDeps: 2,
    weight: 20,
    isHub: false,
  },
  {
    name: 'node-fetch',
    iconKey: 'npm', // Uses semantic icon (cloud download)
    archetype: 'utility',
    baseDeps: 0,
    weight: 8,
    isHub: false,
  },
  {
    name: 'ajv',
    iconKey: 'npm', // Uses semantic icon (shield checkmark)
    archetype: 'utility',
    baseDeps: 2,
    weight: 25,
    isHub: false,
  },
]

// ============================================
// TIERED DIRECT INSTALL POOLS
// ============================================
// Players install frameworks/tools, not leaf packages.
// What's available scales with ecosystem tier.

// Tier 1: Light packages - manageable bursts (baseDeps 1-4)
const TIER1_DIRECT_INSTALL: PackageIdentity[] = [
  // Light frameworks
  {
    name: 'express',
    iconKey: 'express',
    archetype: 'framework',
    baseDeps: 4,
    weight: 60,
    isHub: false,
  },
  {
    name: 'fastify',
    iconKey: 'fastify',
    archetype: 'framework',
    baseDeps: 3,
    weight: 50,
    isHub: false,
  },
  {
    name: 'svelte',
    iconKey: 'svelte',
    archetype: 'framework',
    baseDeps: 2,
    weight: 50,
    isHub: false,
  },
  {
    name: 'backbone',
    iconKey: 'backbonejs',
    archetype: 'framework',
    baseDeps: 2,
    weight: 70,
    isHub: false,
  },
  // Light tooling
  {
    name: 'postcss',
    iconKey: 'postcss',
    archetype: 'tooling',
    baseDeps: 3,
    weight: 40,
    isHub: false,
  },
  {
    name: 'sass',
    iconKey: 'sass',
    archetype: 'tooling',
    baseDeps: 2,
    weight: 50,
    isHub: false,
  },
  {
    name: 'prettier',
    iconKey: 'npm',
    archetype: 'tooling',
    baseDeps: 2,
    weight: 60,
    isHub: false,
  },
  {
    name: 'bun',
    iconKey: 'bun',
    archetype: 'tooling',
    baseDeps: 0,
    weight: 60,
    isHub: false,
  },
  // Utilities with some deps
  {
    name: 'axios',
    iconKey: 'axios',
    archetype: 'utility',
    baseDeps: 2,
    weight: 30,
    isHub: true,
  },
  {
    name: 'chalk',
    iconKey: 'npm',
    archetype: 'utility',
    baseDeps: 2,
    weight: 10,
    isHub: true,
  },
  {
    name: 'debug',
    iconKey: 'npm',
    archetype: 'utility',
    baseDeps: 2,
    weight: 15,
    isHub: true,
  },
  {
    name: 'fs-extra',
    iconKey: 'npm', // Procedural fallback - unique shape/color
    archetype: 'runtime',
    baseDeps: 3,
    weight: 30,
    isHub: false,
  },
  {
    name: 'socket.io',
    iconKey: 'socketio',
    archetype: 'utility',
    baseDeps: 3,
    weight: 45,
    isHub: true,
  },
]

// Tier 2: Standard frameworks - real cascades (baseDeps 4-8)
const TIER2_DIRECT_INSTALL: PackageIdentity[] = [
  // Standard frameworks
  {
    name: 'react',
    iconKey: 'react',
    archetype: 'framework',
    baseDeps: 4,
    weight: 130,
    isHub: false,
  },
  {
    name: 'vue',
    iconKey: 'vuejs',
    archetype: 'framework',
    baseDeps: 4,
    weight: 95,
    isHub: false,
  },
  {
    name: 'remix',
    iconKey: 'remix',
    archetype: 'framework',
    baseDeps: 6,
    weight: 200,
    isHub: false,
  },
  {
    name: 'astro',
    iconKey: 'astro',
    archetype: 'framework',
    baseDeps: 6,
    weight: 120,
    isHub: false,
  },
  {
    name: 'ionic',
    iconKey: 'ionic',
    archetype: 'framework',
    baseDeps: 6,
    weight: 180,
    isHub: false,
  },
  // Standard tooling
  {
    name: 'vite',
    iconKey: 'vitejs',
    archetype: 'tooling',
    baseDeps: 6,
    weight: 80,
    isHub: false,
  },
  {
    name: 'rollup',
    iconKey: 'rollup',
    archetype: 'tooling',
    baseDeps: 5,
    weight: 100,
    isHub: false,
  },
  {
    name: 'eslint',
    iconKey: 'eslint',
    archetype: 'tooling',
    baseDeps: 6,
    weight: 120,
    isHub: false,
  },
  {
    name: 'tailwindcss',
    iconKey: 'tailwindcss',
    archetype: 'tooling',
    baseDeps: 5,
    weight: 90,
    isHub: false,
  },
  {
    name: 'vitest',
    iconKey: 'vitest',
    archetype: 'tooling',
    baseDeps: 5,
    weight: 80,
    isHub: false,
  },
  {
    name: 'prisma',
    iconKey: 'prisma',
    archetype: 'tooling',
    baseDeps: 5,
    weight: 100,
    isHub: false,
  },
  {
    name: 'sequelize',
    iconKey: 'sequelize',
    archetype: 'tooling',
    baseDeps: 6,
    weight: 90,
    isHub: false,
  },
  {
    name: 'mocha',
    iconKey: 'mocha',
    archetype: 'tooling',
    baseDeps: 5,
    weight: 80,
    isHub: false,
  },
]

// Tier 3+: Heavy hitters - chaos mode (baseDeps 8-20)
const TIER3_DIRECT_INSTALL: PackageIdentity[] = [
  // Heavy frameworks
  {
    name: 'angular',
    iconKey: 'angular',
    archetype: 'framework',
    baseDeps: 10,
    weight: 200,
    isHub: false,
  },
  {
    name: 'next',
    iconKey: 'nextjs',
    archetype: 'framework',
    baseDeps: 12,
    weight: 300,
    isHub: false,
  },
  {
    name: 'nuxt',
    iconKey: 'nuxtjs',
    archetype: 'framework',
    baseDeps: 10,
    weight: 250,
    isHub: false,
  },
  {
    name: 'gatsby',
    iconKey: 'gatsby',
    archetype: 'framework',
    baseDeps: 15,
    weight: 350,
    isHub: false,
  },
  {
    name: 'nestjs',
    iconKey: 'nestjs',
    archetype: 'framework',
    baseDeps: 10,
    weight: 180,
    isHub: false,
  },
  {
    name: 'electron',
    iconKey: 'electron',
    archetype: 'framework',
    baseDeps: 8,
    weight: 400,
    isHub: false,
  },
  // Heavy tooling
  {
    name: 'webpack',
    iconKey: 'webpack',
    archetype: 'tooling',
    baseDeps: 10,
    weight: 250,
    isHub: false,
  },
  {
    name: 'babel',
    iconKey: 'babel',
    archetype: 'tooling',
    baseDeps: 8,
    weight: 150,
    isHub: false,
  },
  {
    name: 'jest',
    iconKey: 'jest',
    archetype: 'tooling',
    baseDeps: 15,
    weight: 200,
    isHub: false,
  },
  {
    name: 'storybook',
    iconKey: 'storybook',
    archetype: 'tooling',
    baseDeps: 20,
    weight: 400,
    isHub: false,
  },
  {
    name: 'playwright',
    iconKey: 'playwright',
    archetype: 'tooling',
    baseDeps: 8,
    weight: 150,
    isHub: false,
  },
  {
    name: 'cypress',
    iconKey: 'cypressio',
    archetype: 'tooling',
    baseDeps: 10,
    weight: 180,
    isHub: false,
  },
  {
    name: 'ember',
    iconKey: 'ember',
    archetype: 'framework',
    baseDeps: 12,
    weight: 220,
    isHub: false,
  },
  {
    name: 'docker',
    iconKey: 'docker',
    archetype: 'tooling',
    baseDeps: 8,
    weight: 200,
    isHub: false,
  },
]

// Combined registry
export const PACKAGE_REGISTRY: PackageIdentity[] = [
  ...HUB_PACKAGES,
  ...FRAMEWORK_PACKAGES,
  ...TOOLING_PACKAGES,
  ...LEGACY_PACKAGES,
  ...RUNTIME_PACKAGES,
  ...LEAF_PACKAGES,
]

// Weighted distribution for realistic spawning
// Matches research: 50% leaf, heavy tail distribution
export interface DependencyTier {
  count: number
  weight: number // Probability weight
}

export const DEPENDENCY_DISTRIBUTION: DependencyTier[] = [
  { count: 0, weight: 50 }, // Leaf nodes - stabilizers
  { count: 1, weight: 15 }, // Minimal deps
  { count: 2, weight: 15 }, // Light
  { count: 3, weight: 10 }, // Normal
  { count: 4, weight: 5 }, // Heavy-ish
  { count: 5, weight: 3 }, // Heavy
  { count: 8, weight: 1.5 }, // Very heavy
  { count: 12, weight: 0.5 }, // Legendary (jest, webpack)
]

/**
 * Pick a random package identity from the registry
 * Used for TRANSITIVE dependencies (spawned automatically)
 * Weights by archetype rarity - lots of leaves, few frameworks
 */
export function pickRandomIdentity(): PackageIdentity {
  // Weight: leaf/hub appear more often, frameworks rare
  const roll = Math.random()

  let pool: PackageIdentity[] = LEAF_PACKAGES // default
  if (roll < 0.4) {
    // 40% chance: leaf package
    pool = LEAF_PACKAGES
  } else if (roll < 0.65) {
    // 25% chance: hub utility
    pool = HUB_PACKAGES
  } else if (roll < 0.8) {
    // 15% chance: runtime
    pool = RUNTIME_PACKAGES
  } else if (roll < 0.9) {
    // 10% chance: tooling
    pool = TOOLING_PACKAGES
  } else if (roll < 0.97) {
    // 7% chance: framework
    pool = FRAMEWORK_PACKAGES
  } else {
    // 3% chance: legacy (conflict-prone)
    pool = LEGACY_PACKAGES
  }

  const index = Math.floor(Math.random() * pool.length)
  return pool[index]!
}

/**
 * Pick a package identity for DIRECT player installs
 * Players install frameworks/tools, not leaf packages.
 * Available packages scale with ecosystem tier for progression.
 *
 * Tier 1: Light (express, postcss, axios) - baseDeps 2-4
 * Tier 2: Standard (react, vite, eslint) - baseDeps 4-8
 * Tier 3+: Heavy (webpack, jest, gatsby) - baseDeps 8-20
 *
 * @param ecosystemTier Current tier (affects available packages)
 * @param exclude Optional set of package names already installed (for uniqueness)
 */
export function pickDirectInstallIdentity(
  ecosystemTier: number,
  exclude?: Set<string>
): PackageIdentity {
  // Build available pool based on tier
  let pool: PackageIdentity[] = [...TIER1_DIRECT_INSTALL]

  if (ecosystemTier >= 2) {
    pool = [...pool, ...TIER2_DIRECT_INSTALL]
  }

  if (ecosystemTier >= 3) {
    pool = [...pool, ...TIER3_DIRECT_INSTALL]
  }

  // Filter out already-installed packages for variety
  if (exclude && exclude.size > 0) {
    pool = pool.filter(p => !exclude.has(p.name))
  }

  // If pool exhausted, allow duplicates rather than crash
  if (pool.length === 0) {
    pool = [...TIER1_DIRECT_INSTALL, ...TIER2_DIRECT_INSTALL, ...TIER3_DIRECT_INSTALL]
  }

  // Higher tiers weight toward heavier packages
  if (ecosystemTier >= 3 && Math.random() < 0.4) {
    const tier3Available = exclude
      ? TIER3_DIRECT_INSTALL.filter(p => !exclude.has(p.name))
      : TIER3_DIRECT_INSTALL
    if (tier3Available.length > 0) {
      const index = Math.floor(Math.random() * tier3Available.length)
      return tier3Available[index]!
    }
  }

  if (ecosystemTier >= 2 && Math.random() < 0.3) {
    const tier2Available = exclude
      ? TIER2_DIRECT_INSTALL.filter(p => !exclude.has(p.name))
      : TIER2_DIRECT_INSTALL
    if (tier2Available.length > 0) {
      const index = Math.floor(Math.random() * tier2Available.length)
      return tier2Available[index]!
    }
  }

  // Otherwise pick from full available pool
  const index = Math.floor(Math.random() * pool.length)
  return pool[index]!
}

/**
 * Roll dependency count using realistic distribution
 * Returns the number of deps to spawn
 */
export function rollRealisticDependencyCount(
  identity?: PackageIdentity
): number {
  // If we have identity, use its baseDeps as influence
  if (identity && identity.baseDeps > 0) {
    // Use package's typical dep count with some variance
    const variance = Math.floor(Math.random() * 3) - 1 // -1, 0, or 1
    return Math.max(0, identity.baseDeps + variance)
  }

  // Otherwise use the weighted distribution
  const totalWeight = DEPENDENCY_DISTRIBUTION.reduce(
    (sum, tier) => sum + tier.weight,
    0
  )
  let roll = Math.random() * totalWeight

  for (const tier of DEPENDENCY_DISTRIBUTION) {
    roll -= tier.weight
    if (roll <= 0) {
      return tier.count
    }
  }

  return 0 // Fallback to leaf
}

/**
 * Find the identity for a package name
 */
export function findIdentityByName(name: string): PackageIdentity | undefined {
  return PACKAGE_REGISTRY.find((p) => p.name === name)
}

// ============================================
// CONFLICT SYSTEM - Archetype Incompatibilities
// ============================================

/**
 * Incompatible package pairs - real npm ecosystem tensions
 * When a child has one of these and an ancestor has the other, wire becomes conflicted
 */
const INCOMPATIBLE_PAIRS: [string, string][] = [
  // Framework wars (only one UI framework)
  ['react', 'angular'],
  ['react', 'vue'],
  ['vue', 'angular'],
  ['svelte', 'react'],
  ['svelte', 'vue'],

  // Legacy vs Modern (redundant functionality)
  ['moment', 'date-fns'],
  ['request', 'axios'],
  ['lodash', 'underscore'],

  // Bundler conflicts
  ['webpack', 'parcel'],
  ['webpack', 'rollup'],

  // Test runner conflicts
  ['jest', 'mocha'],
  ['jest', 'vitest'],

  // Linter wars
  ['eslint', 'tslint'],
]

/**
 * Check if two package names are incompatible
 */
export function areIncompatible(name1: string, name2: string): boolean {
  for (const [a, b] of INCOMPATIBLE_PAIRS) {
    if ((name1 === a && name2 === b) || (name1 === b && name2 === a)) {
      return true
    }
  }
  return false
}

/**
 * Check if a new package identity conflicts with any ancestor in its branch
 * Returns true if incompatible pair found
 */
export function checkIncompatibilityWithPackages(
  identity: PackageIdentity | undefined,
  parentId: string,
  packages: Map<string, { parentId: string | null; identity?: PackageIdentity }>
): boolean {
  if (!identity) return false

  const newName = identity.name

  // Walk up the ancestor chain
  let currentId: string | null = parentId
  const visited = new Set<string>()

  while (currentId !== null) {
    if (visited.has(currentId)) break // Prevent infinite loops
    visited.add(currentId)

    const ancestor = packages.get(currentId)
    if (!ancestor) break

    if (ancestor.identity) {
      if (areIncompatible(newName, ancestor.identity.name)) {
        return true
      }
    }

    currentId = ancestor.parentId
  }

  return false
}

/**
 * Upgrade paths - what a conflicting package can transform into
 */
const UPGRADE_PATHS: Record<string, string> = {
  // Legacy to modern
  moment: 'date-fns',
  request: 'axios',
  underscore: 'lodash',
  tslint: 'eslint',

  // Framework alternatives (less common direction)
  angular: 'react',
  vue: 'react',
}

/**
 * Get an upgrade path for a package (what it can transform into to resolve conflict)
 */
export function getUpgradePath(packageName: string): string | undefined {
  return UPGRADE_PATHS[packageName]
}
