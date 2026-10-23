// Centralized event bus for game events
// Replaces scattered callback registration patterns with a unified system

import { createEmitHandle } from '@open-loop/engine'
import type { Position } from './types'
import type { EfficiencyTier } from './formulas'

// Particle types (defined here to avoid circular imports with Vue components)
export type ParticleType =
  | 'weight-gain'
  | 'weight-loss'
  | 'gravity-pulse'
  | 'efficiency-up'
  | 'efficiency-down'
  | 'stability-up'
  | 'stability-down'
  | 'fragment-collect'
  | 'token-collect' // Cache tokens flying to prestige panel on ship
  | 'tier-up' // Special tier-up celebration particle

// End screen stats payload (for collapse finale)
export interface EndScreenStats {
  totalPackagesInstalled: number
  totalConflictsResolved: number
  totalSymlinksCreated: number
  peakEfficiency: number
  totalWeight: number
  timesShipped: number
}

/**
 * Game event definitions
 * Each key is an event name, value is the payload type
 */
export interface GameEvents {
  // Cascade events
  'cascade:spawn-effect': { position: Position; isConflict: boolean }
  'cascade:crit': { count: number }
  'cascade:end': { scopePath: string[] }

  // Scope events
  'scope:recalculate': { scopePath: string[] }

  // Ship events (soft prestige - repeatable)
  'ship:start': { onComplete: () => void }
  'ship:complete': void
  'ship:reward': {
    tokensEarned: number
    tierBefore: number
    tierAfter: number
    efficiency: number
  }

  // Collapse input events (from UI)
  'collapse:begin-hold': void // UI requests hold start
  'collapse:end-hold': void // UI releases hold

  // Collapse state events (from state machine)
  'collapse:hold-start': void
  'collapse:hold-progress': { progress: number; drainedTiers: number }
  'collapse:hold-cancel': void
  'collapse:locked': void // Passed 80%, point of no return
  'collapse:trigger': { onComplete: () => void }
  'collapse:complete': void

  // End screen event
  'end:show': { stats: EndScreenStats }

  // Automation events
  'automation:resolve-complete': { scopePath: string[]; position: Position }

  // Duplicate detection events
  'packages:changed': void // Signal that packages were added/removed/merged

  // Particle events
  'particles:spawn': {
    type: ParticleType
    x: number
    y: number
    scale?: number
  }
  'particles:burst': { type: ParticleType; x: number; y: number; count: number }

  // Gravity pull (request particle from visible package)
  'gravity:pull-particle': void

  // Input events (from touch/mouse handlers)
  'input:select': { worldX: number; worldY: number }
  'input:deselect': void
  'input:action': { worldX: number; worldY: number }
  'input:wire-tap': { worldX: number; worldY: number; wireId: string }
  'input:drag-start': { worldX: number; worldY: number; nodeId: string }
  'input:drag-move': { worldX: number; worldY: number }
  'input:drag-end': { worldX: number; worldY: number }
  'input:drag-cancel': void

  // Player act events (feedback)
  'game:conflict-resolved': { position?: Position }
  'game:symlink-merged': { weightSaved: number; position: Position }
  'game:scope-stabilized': { scopeId: string; packageCount: number }

  // Quality events (efficiency/stability feedback)
  'quality:efficiency-improved': {
    delta: number
    newValue: number
    newTier: EfficiencyTier
  }
  'quality:efficiency-tier-up': {
    oldTier: EfficiencyTier
    newTier: EfficiencyTier
  }
  'quality:stability-improved': {
    newValue: number
    scopesStable: number
    scopesTotal: number
  }

  // Physics events (decouples symlinks → physics)
  'physics:trigger-organize': { relocatedIds: string[] }

  // Scope stabilization event (decouples scope → mutations)
  'scope:stabilized': { packageCount: number }

  // Player action event (decouples game → tutorial-state to avoid circular deps)
  'player:action': void

  // Game lifecycle events
  'game:restart': void // Player chose to restart from end screen

  // Achievement events
  'achievement:earned': { id: string; icon: string }
  'achievement:check': void // Trigger check cycle
}

type EventCallback<T> = T extends void ? () => void : (data: T) => void
type GameEventHandlers = {
  [K in keyof GameEvents]: EventCallback<GameEvents[K]>
}

const bus = createEmitHandle<GameEventHandlers>()

/**
 * Emit an event with optional payload
 */
export function emit<K extends keyof GameEvents>(
  event: K,
  ...args: GameEvents[K] extends void ? [] : [GameEvents[K]]
): void {
  ;(bus.emit as (event: K, ...args: unknown[]) => void)(event, ...args)
}

/**
 * Subscribe to an event
 * Returns an unsubscribe function
 */
export function on<K extends keyof GameEvents>(
  event: K,
  callback: EventCallback<GameEvents[K]>
): () => void {
  // The engine emitter lets a throwing handler abort the rest of the emit;
  // each handler logs its own error so the others still run.
  const guarded = ((data?: GameEvents[K]) => {
    try {
      ;(callback as (data?: GameEvents[K]) => void)(data)
    } catch (e) {
      console.error(`Error in event handler for '${event}':`, e)
    }
  }) as GameEventHandlers[K]
  return bus.on(event, guarded)
}
