// Centralized event bus for game events
// Replaces scattered callback registration patterns with a unified system

import type { Position } from './types'

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

  // Automation events
  'automation:resolve-complete': { scopePath: string[]; position: Position }

  // Duplicate detection events
  'packages:changed': void // Signal that packages were added/removed/merged
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
