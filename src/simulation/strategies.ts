// Strategy implementations for headless simulation
//
// Strategies decide what action to take given the current game state.
// Used by the simulation engine to automate gameplay for balance testing.

import type { GameState, Package, Wire } from '../game/types'
import type { Strategy, StrategyAction } from './types'
import { getPrestigeThreshold } from '../game/formulas'
import { INSTALL_BASE_COST } from '../game/config'

// ============================================
// HELPER FUNCTIONS
// ============================================

function getConflictedWires(state: GameState): Wire[] {
  const wires: Wire[] = []

  // Check root-level wires
  for (const wire of state.wires.values()) {
    if (wire.conflicted) {
      wires.push(wire)
    }
  }

  // Check internal wires in all packages
  for (const pkg of state.packages.values()) {
    if (pkg.internalWires) {
      for (const wire of pkg.internalWires.values()) {
        if (wire.conflicted) {
          wires.push(wire)
        }
      }
    }
  }

  return wires
}

function getDuplicates(
  state: GameState
): Array<{ sourceId: string; targetId: string; scopeId: string | null }> {
  const duplicates: Array<{
    sourceId: string
    targetId: string
    scopeId: string | null
  }> = []

  // Helper to find duplicates in a package map
  function findDuplicatesInScope(
    packages: Map<string, Package>,
    scopeId: string | null
  ) {
    const byName = new Map<string, Package[]>()
    for (const pkg of packages.values()) {
      if (!pkg.identity || pkg.isGhost) continue
      const name = pkg.identity.name
      const existing = byName.get(name) ?? []
      existing.push(pkg)
      byName.set(name, existing)
    }

    for (const pkgs of byName.values()) {
      if (pkgs.length < 2) continue
      // Return first pair
      const first = pkgs[0]
      const second = pkgs[1]
      if (first && second) {
        duplicates.push({ sourceId: first.id, targetId: second.id, scopeId })
      }
    }
  }

  // Check root level
  findDuplicatesInScope(state.packages, null)

  // Check internal scopes
  for (const pkg of state.packages.values()) {
    if (pkg.internalPackages && pkg.internalPackages.size > 0) {
      findDuplicatesInScope(pkg.internalPackages, pkg.id)
    }
  }

  return duplicates
}

function getUnstableTopLevelPackages(state: GameState): Package[] {
  const unstable: Package[] = []
  for (const pkg of state.packages.values()) {
    if (
      pkg.parentId === state.rootId &&
      pkg.internalState === 'unstable' &&
      pkg.state === 'ready'
    ) {
      unstable.push(pkg)
    }
  }
  return unstable
}

function getEnterablePackages(state: GameState): Package[] {
  const enterable: Package[] = []
  for (const pkg of state.packages.values()) {
    if (
      pkg.parentId === state.rootId &&
      pkg.internalPackages &&
      pkg.internalPackages.size === 0 &&
      pkg.internalState === 'pristine' &&
      pkg.state === 'ready'
    ) {
      enterable.push(pkg)
    }
  }
  return enterable
}

function canAffordInstall(state: GameState): boolean {
  // Simplified cost calculation for headless (avoids global state dependency)
  const tier = state.meta.ecosystemTier
  const activeScopes = state.scopeStack.length
  const cost = INSTALL_BASE_COST * tier * Math.pow(1.15, activeScopes)
  return state.resources.bandwidth >= cost
}

function canShip(state: GameState): boolean {
  const threshold = getPrestigeThreshold(state.meta.timesShipped)
  return state.stats.maxWeightReached >= threshold
}

function isInScope(state: GameState): boolean {
  return state.scopeStack.length > 0
}

// ============================================
// OPTIMAL STRATEGY
// ============================================
// Prioritizes efficiency: merge all dupes, resolve conflicts, stabilize scopes

export const OPTIMAL: Strategy = {
  name: 'optimal',
  decide(state: GameState): StrategyAction {
    // 1. If in a scope with duplicates, merge them
    if (isInScope(state)) {
      const dupes = getDuplicates(state)
      // Find dupes in current scope
      const currentScopeId = state.scopeStack[state.scopeStack.length - 1]
      const scopeDupes = dupes.filter((d) => d.scopeId === currentScopeId)
      if (scopeDupes.length > 0) {
        const dupe = scopeDupes[0]!
        return {
          type: 'merge',
          sourceId: dupe.sourceId,
          targetId: dupe.targetId,
        }
      }

      // 2. Resolve conflicts in current scope
      const conflicts = getConflictedWires(state)
      if (conflicts.length > 0) {
        const wire = conflicts[0]!
        return { type: 'prune', wireId: wire.id }
      }

      // 3. Exit stable scope
      return { type: 'exit-scope' }
    }

    // 4. Enter unstable top-level packages to clean them up
    const unstable = getUnstableTopLevelPackages(state)
    if (unstable.length > 0) {
      const pkg = unstable[0]!
      return { type: 'enter-scope', targetId: pkg.id }
    }

    // 5. Enter pristine packages to trigger cascade
    const enterable = getEnterablePackages(state)
    if (enterable.length > 0) {
      const pkg = enterable[0]!
      return { type: 'enter-scope', targetId: pkg.id }
    }

    // 6. Ship if possible
    if (canShip(state)) {
      return { type: 'ship' }
    }

    // 7. Install new package if affordable
    if (canAffordInstall(state) && state.rootId) {
      return { type: 'install' }
    }

    // 8. Wait for bandwidth
    return { type: 'wait' }
  },
}

// ============================================
// GREEDY STRATEGY
// ============================================
// Installs fast, ships ASAP, minimal cleanup

export const GREEDY: Strategy = {
  name: 'greedy',
  decide(state: GameState): StrategyAction {
    // 1. Ship immediately if possible
    if (canShip(state)) {
      return { type: 'ship' }
    }

    // 2. Exit any scope immediately
    if (isInScope(state)) {
      return { type: 'exit-scope' }
    }

    // 3. Install new packages aggressively
    if (canAffordInstall(state) && state.rootId) {
      return { type: 'install' }
    }

    // 4. Enter packages just to trigger cascades
    const enterable = getEnterablePackages(state)
    if (enterable.length > 0) {
      const pkg = enterable[0]!
      return { type: 'enter-scope', targetId: pkg.id }
    }

    // 5. Wait
    return { type: 'wait' }
  },
}

// ============================================
// LAZY STRATEGY
// ============================================
// Minimal actions, relies on automation

export const LAZY: Strategy = {
  name: 'lazy',
  decide(state: GameState): StrategyAction {
    // 1. Ship if possible
    if (canShip(state)) {
      return { type: 'ship' }
    }

    // 2. Only install when at full bandwidth
    if (
      state.resources.bandwidth >= state.resources.maxBandwidth * 0.9 &&
      state.rootId
    ) {
      return { type: 'install' }
    }

    // 3. Exit scopes immediately
    if (isInScope(state)) {
      return { type: 'exit-scope' }
    }

    // 4. Wait most of the time
    return { type: 'wait' }
  },
}

// ============================================
// PASSIVE STRATEGY
// ============================================
// Only waits, never takes action (for testing automation)

export const PASSIVE: Strategy = {
  name: 'passive',
  decide(_state: GameState): StrategyAction {
    return { type: 'wait' }
  },
}

// ============================================
// STRATEGY REGISTRY
// ============================================

export const STRATEGIES: Record<string, Strategy> = {
  optimal: OPTIMAL,
  greedy: GREEDY,
  lazy: LAZY,
  passive: PASSIVE,
}

export function getStrategy(name: string): Strategy {
  const strategy = STRATEGIES[name]
  if (!strategy) {
    throw new Error(`Unknown strategy: ${name}`)
  }
  return strategy
}
