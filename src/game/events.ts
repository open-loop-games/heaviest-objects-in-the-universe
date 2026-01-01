// Centralized event bus for game events
// Replaces scattered callback registration patterns with a unified system

import type { Position } from './types'
import type { EfficiencyTier } from './formulas'

// Particle types (defined here to avoid circular imports with Vue components)
export type ParticleType =
  | 'bandwidth-cost'
  | 'bandwidth-gain'
  | 'weight-gain'
  | 'weight-loss'
  | 'gravity-pulse'
  | 'efficiency-up'
  | 'efficiency-down'
  | 'stability-up'
  | 'stability-down'
  | 'fragment-collect'

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

  // Prestige events
  'prestige:start': { onComplete: () => void }
  'prestige:complete': void

  // Automation events
  'automation:resolve-complete': { scopePath: string[]; position: Position }

  // Duplicate detection events
  'packages:changed': void // Signal that packages were added/removed/merged

  // Particle events
  'particles:spawn': { type: ParticleType; x: number; y: number }
  'particles:burst': { type: ParticleType; x: number; y: number; count: number }

  // Input events (from touch/mouse handlers)
  'input:select': { worldX: number; worldY: number }
  'input:deselect': void
  'input:action': { worldX: number; worldY: number }
  'input:wire-tap': { worldX: number; worldY: number; wireId: string }
  'input:drag-start': { worldX: number; worldY: number; nodeId: string }
  'input:drag-move': { worldX: number; worldY: number }
  'input:drag-end': { worldX: number; worldY: number }
  'input:drag-cancel': void

  // Momentum/activity events (bandwidth generation feedback)
  'game:package-resolved': { amount: number }
  'game:conflict-resolved': { amount: number; position?: Position }
  'game:symlink-merged': {
    amount: number
    weightSaved: number
    position: Position
  }
  'game:scope-stabilized': {
    amount: number
    scopeId: string
    packageCount: number
  }
  'game:golden-spawned': { amount: number }
  'game:fragment-collected': { amount: number }

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
}

type EventCallback<T> = T extends void ? () => void : (data: T) => void
type Unsubscribe = () => void

// Internal listener storage
const listeners = new Map<keyof GameEvents, Set<EventCallback<unknown>>>()

/**
 * Emit an event with optional payload
 */
export function emit<K extends keyof GameEvents>(
  event: K,
  ...args: GameEvents[K] extends void ? [] : [GameEvents[K]]
): void {
  const callbacks = listeners.get(event)
  if (!callbacks) return

  const data = args[0]
  for (const callback of callbacks) {
    try {
      callback(data)
    } catch (e) {
      console.error(`Error in event handler for '${event}':`, e)
    }
  }
}

/**
 * Subscribe to an event
 * Returns an unsubscribe function
 */
export function on<K extends keyof GameEvents>(
  event: K,
  callback: EventCallback<GameEvents[K]>
): Unsubscribe {
  if (!listeners.has(event)) {
    listeners.set(event, new Set())
  }

  const callbacks = listeners.get(event)!
  callbacks.add(callback as EventCallback<unknown>)

  // Return unsubscribe function
  return () => {
    callbacks.delete(callback as EventCallback<unknown>)
    if (callbacks.size === 0) {
      listeners.delete(event)
    }
  }
}

/**
 * Subscribe to an event for one-time execution
 */
export function once<K extends keyof GameEvents>(
  event: K,
  callback: EventCallback<GameEvents[K]>
): Unsubscribe {
  const unsubscribe = on(event, ((...args: unknown[]) => {
    unsubscribe()
    ;(callback as (...args: unknown[]) => void)(...args)
  }) as EventCallback<GameEvents[K]>)

  return unsubscribe
}

/**
 * Remove all listeners for an event (useful for cleanup)
 */
export function off<K extends keyof GameEvents>(event: K): void {
  listeners.delete(event)
}

/**
 * Clear all event listeners (useful for testing or reset)
 */
export function clearAllListeners(): void {
  listeners.clear()
}
