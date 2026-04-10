// Replay recording system for debugging and testing
//
// Records player actions with timestamps, allowing replay of sessions
// against the same seed to reproduce exact game states.

import { gameState } from './state'

// ============================================
// TYPES
// ============================================

export type ActionType =
  | 'install' // Click root to install a new package
  | 'enter-scope' // Click package to dive into its internals
  | 'exit-scope' // Click back button to exit scope
  | 'prune' // Resolve conflict by removing package
  | 'upgrade' // Resolve conflict by upgrading package
  | 'merge' // Drag duplicate onto target for symlink
  | 'collect-fragment' // Click golden package to collect fragment
  | 'ship' // Trigger prestige/ship
  | 'collapse' // Tier 5 finale
  | 'toggle-auto-resolve' // Toggle automation

export interface ReplayAction {
  type: ActionType
  tick: number // Game tick when action occurred
  timestamp: number // Real time offset from start (ms)
  payload?: {
    targetId?: string // Package or wire ID
    sourceId?: string // For merge: the dragged package
    scopePath?: string[] // For scope operations
  }
}

export interface Replay {
  version: 1
  seed: number
  startTime: number
  actions: ReplayAction[]
  endState?: {
    // Snapshot for validation
    cacheTokens: number
    weight: number
    timesShipped: number
    efficiency: number
  }
}

// ============================================
// STATE
// ============================================

let recording = false
let currentReplay: Replay | null = null
let tickCounter = 0
let startTime = 0

// ============================================
// RECORDING API
// ============================================

/**
 * Start recording a new replay session
 */
export function startRecording(): void {
  recording = true
  tickCounter = 0
  startTime = Date.now()
  currentReplay = {
    version: 1,
    seed: gameState.seed,
    startTime,
    actions: [],
  }
}

/**
 * Stop recording and return the replay
 */
export function stopRecording(): Replay | null {
  if (!currentReplay) return null

  recording = false

  // Capture end state for validation
  currentReplay.endState = {
    cacheTokens: gameState.meta.cacheTokens,
    weight: gameState.resources.weight,
    timesShipped: gameState.meta.timesShipped,
    efficiency: gameState.stats.currentEfficiency,
  }

  const replay = currentReplay
  currentReplay = null
  return replay
}

/**
 * Check if currently recording
 */
export function isRecording(): boolean {
  return recording
}

/**
 * Record an action (called from game code)
 */
export function recordAction(
  type: ActionType,
  payload?: ReplayAction['payload']
): void {
  if (!recording || !currentReplay) return

  currentReplay.actions.push({
    type,
    tick: tickCounter,
    timestamp: Date.now() - startTime,
    payload,
  })
}

/**
 * Increment the tick counter (called from game loop)
 */
export function incrementTick(): void {
  tickCounter++
}

/**
 * Get current tick (for debugging)
 */
export function getCurrentTick(): number {
  return tickCounter
}

/**
 * Reset tick counter (called on prestige)
 */
export function resetTick(): void {
  tickCounter = 0
}

// ============================================
// SERIALIZATION
// ============================================

/**
 * Export replay to JSON string
 */
export function exportReplay(replay: Replay): string {
  return JSON.stringify(replay, null, 2)
}

/**
 * Import replay from JSON string
 */
export function importReplay(json: string): Replay {
  const parsed = JSON.parse(json)

  // Validate structure
  if (parsed.version !== 1) {
    throw new Error(`Unknown replay version: ${parsed.version}`)
  }
  if (typeof parsed.seed !== 'number') {
    throw new Error('Replay missing seed')
  }
  if (!Array.isArray(parsed.actions)) {
    throw new Error('Replay missing actions array')
  }

  return parsed as Replay
}

// ============================================
// PLAYBACK (Basic implementation)
// ============================================

let playbackReplay: Replay | null = null
let playbackIndex = 0

/**
 * Load a replay for playback
 */
export function loadReplay(replay: Replay): void {
  playbackReplay = replay
  playbackIndex = 0
}

/**
 * Get the next action to execute (if tick matches)
 * Returns null if no action ready or playback complete
 */
export function getNextAction(currentTick: number): ReplayAction | null {
  if (!playbackReplay) return null
  if (playbackIndex >= playbackReplay.actions.length) return null

  const action = playbackReplay.actions[playbackIndex]
  if (!action || action.tick > currentTick) return null

  playbackIndex++
  return action
}

/**
 * Check if playback is complete
 */
export function isPlaybackComplete(): boolean {
  if (!playbackReplay) return true
  return playbackIndex >= playbackReplay.actions.length
}

/**
 * Get replay seed for initializing game state
 */
export function getReplaySeed(): number | null {
  return playbackReplay?.seed ?? null
}

/**
 * Clear playback state
 */
export function clearPlayback(): void {
  playbackReplay = null
  playbackIndex = 0
}
