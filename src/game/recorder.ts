// The calibration recorder: balance-harness tooling, not a mechanic. In dev builds it records
// each run as a timestamped event stream off the event bus and the scope stack, and posts it
// to the dev server, which writes one JSON file per run (vite.config.ts). The spine's "feel"
// anchors are refit from these files (src/balance/recordings.ts). Nothing leaves the machine.
//
// `?rec=<label>` tags the runs that follow (kept in localStorage), e.g. `slow` or `fast` for
// the pace endpoints; `?rec=off` stops recording in this browser until a new label is set.

import { watch } from 'vue'
import { gameState, stack } from './state'
import { on } from './events'
import { GAME_SPINE } from './spine'
import { comboWindowMs, countOpenProblems } from './mutations'
import { computed_boardStable, computed_boardUnpacked } from './board'

export const RECORDING_VERSION = 1

export type RecordedEvent =
  | {
      t: number
      type: 'act'
      kind: 'conflict' | 'merge'
      found: number
      depth: number
      scope: string | null
    }
  | { t: number; type: 'auto-resolve'; depth: number }
  | { t: number; type: 'install'; installed: number }
  | {
      t: number
      type: 'scope:enter' | 'scope:exit'
      scope: string
      depth: number
    }
  | { t: number; type: 'cascade:end'; depth: number }
  | { t: number; type: 'scope:stable'; scope: string }
  | { t: number; type: 'board:unpacked' | 'board:stable' }
  | {
      t: number
      type: 'sample'
      gross: number
      net: number
      q: number
      combo: number
    }
  | { t: number; type: 'hidden' | 'visible' | 'resume' | 'ship:start' }

/** Counters read off the run when it ends; the ship's reward and q come from ship:reward. */
export interface RunEnd {
  t: number
  kind: 'ship' | 'abandon'
  grossWeight: number
  netWeight: number
  q: number
  reward: number | null
  acts: number
  comboSum: number
  resolved: number
  openConflicts: number
  openDuplicates: number
}

export interface Recording {
  version: number
  id: string
  label: string
  seed: number
  tier: number
  unlockedTier: number
  timesShipped: number
  upgrades: typeof gameState.upgrades
  comboWindowMs: number
  /** The spine's board for this tier, which the recording checks. */
  spineBoard: { scopes: number; problems: number; weight: number }
  startedAt: number
  /** Recording began on a run already under way, so its start and early acts are missing. */
  startedMidRun: boolean
  events: RecordedEvent[]
  end: RunEnd | null
}

const LABEL_KEY = 'heaviest:recorder-label'
const OPEN_KEY = 'heaviest:recording'
const ENDPOINT = '/__recordings'
const SAMPLE_MS = 5000
const FLUSH_MS = 15000

let current: Recording | null = null
let comboSumSeen = 0
let dirty = false
// Counters as of the last event, because the cycle resets the run's refs before ship:reward.
let lastEnd: Omit<RunEnd, 't' | 'kind' | 'reward'> | null = null
// From ship:start to ship:reward the board is torn down; nothing more belongs to the run.
let shipping = false

function readLabel(): string | null {
  const param = new URLSearchParams(location.search).get('rec')
  if (param !== null) localStorage.setItem(LABEL_KEY, param || 'natural')
  const label = localStorage.getItem(LABEL_KEY) ?? 'natural'
  return label === 'off' ? null : label
}

function snapshotEnd(): Omit<RunEnd, 't' | 'kind' | 'reward'> {
  const run = gameState.run
  const open = countOpenProblems()
  return {
    grossWeight: run.runGrossWeight,
    netWeight: gameState.resources.weight,
    q: run.resolvedShare,
    acts: run.runActs,
    comboSum: run.runComboSum,
    resolved: run.runResolved,
    openConflicts: open.conflicts,
    openDuplicates: open.duplicates,
  }
}

function startRun(label: string): Recording {
  const tier = gameState.board.tier
  const board = GAME_SPINE.boards[tier - 1]!
  const now = Date.now()
  comboSumSeen = gameState.run.runComboSum
  lastEnd = snapshotEnd()
  return {
    version: RECORDING_VERSION,
    id: `${new Date(now).toISOString().replace(/[:.]/g, '-')}-t${tier}`,
    label,
    seed: gameState.seed,
    tier,
    unlockedTier: gameState.meta.unlockedTier,
    timesShipped: gameState.meta.timesShipped,
    upgrades: { ...gameState.upgrades },
    comboWindowMs: comboWindowMs(),
    spineBoard: {
      scopes: board.scopes,
      problems: board.problems,
      weight: board.weight,
    },
    startedAt: now,
    startedMidRun:
      gameState.board.topLevelInstalled > 0 || gameState.run.runActs > 0,
    events: [],
    end: null,
  }
}

function push(event: RecordedEvent): void {
  if (!current || shipping) return
  current.events.push(event)
  lastEnd = snapshotEnd()
  dirty = true
}

function persist(): void {
  if (current) localStorage.setItem(OPEN_KEY, JSON.stringify(current))
}

function flush(beacon = false): void {
  if (!current || !dirty) return
  dirty = false
  persist()
  const body = JSON.stringify(current)
  if (beacon) {
    navigator.sendBeacon(
      ENDPOINT,
      new Blob([body], { type: 'application/json' })
    )
    return
  }
  void fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  }).catch((e) => console.warn('recorder: flush failed', e))
}

function endRun(kind: RunEnd['kind'], reward: number | null): void {
  if (!current || !lastEnd) return
  current.end = { t: Date.now(), kind, reward, ...lastEnd }
  dirty = true
  flush()
  localStorage.removeItem(OPEN_KEY)
  current = null
}

/** Start recording, if this is a dev build and the browser has not opted out. */
export function startRecorder(): void {
  const label = readLabel()
  if (label === null) return

  const stored = localStorage.getItem(OPEN_KEY)
  if (stored) {
    const open = JSON.parse(stored) as Recording
    current = open
    if (open.version === RECORDING_VERSION && open.seed === gameState.seed) {
      comboSumSeen = gameState.run.runComboSum
      push({ t: Date.now(), type: 'resume' })
    } else {
      // Its run ended while no recorder ran: post what was recorded, with no end.
      dirty = true
      flush()
      localStorage.removeItem(OPEN_KEY)
      current = null
    }
  }
  current ??= startRun(label)
  dirty = true

  const depth = () => stack.depth
  const scope = () => stack.currentNodeId

  const act = (kind: 'conflict' | 'merge') => {
    // Acts emit after incrementCombo adds the counter the act found to runComboSum.
    const found = gameState.run.runComboSum - comboSumSeen
    comboSumSeen = gameState.run.runComboSum
    push({
      t: Date.now(),
      type: 'act',
      kind,
      found,
      depth: depth(),
      scope: scope(),
    })
  }
  on('game:conflict-resolved', () => act('conflict'))
  on('game:symlink-merged', () => act('merge'))
  on('automation:resolve-complete', ({ scopePath }) =>
    push({ t: Date.now(), type: 'auto-resolve', depth: scopePath.length })
  )
  on('cascade:end', ({ scopePath }) =>
    push({ t: Date.now(), type: 'cascade:end', depth: scopePath.length })
  )
  on('game:scope-stabilized', ({ scopeId }) =>
    push({ t: Date.now(), type: 'scope:stable', scope: scopeId })
  )
  stack.on('scope:entered', (id, d) =>
    push({ t: Date.now(), type: 'scope:enter', scope: id, depth: d })
  )
  stack.on('scope:exited', (id, d) =>
    push({ t: Date.now(), type: 'scope:exit', scope: id, depth: d })
  )
  watch(
    () => gameState.board.topLevelInstalled,
    (installed) => {
      if (installed > 0) push({ t: Date.now(), type: 'install', installed })
    }
  )
  watch(computed_boardUnpacked, (v) => {
    if (v) push({ t: Date.now(), type: 'board:unpacked' })
  })
  watch(computed_boardStable, (v) => {
    if (v) push({ t: Date.now(), type: 'board:stable' })
  })

  on('ship:start', () => {
    push({ t: Date.now(), type: 'ship:start' })
    shipping = true
  })
  // performShip ends the cycle, which resets the run's refs, before it emits the reward.
  on('ship:reward', ({ tokensEarned, quality }) => {
    shipping = false
    // performShip measures q fresh.
    if (lastEnd) lastEnd.q = quality
    endRun('ship', tokensEarned)
    current = startRun(label)
    dirty = true
  })
  // A new seed without a ship: the run was abandoned or the game restarted.
  watch(
    () => gameState.seed,
    (seed) => {
      if (current && current.seed !== seed) {
        endRun('abandon', null)
        current = startRun(label)
        dirty = true
      }
    }
  )

  setInterval(() => {
    const run = gameState.run
    push({
      t: Date.now(),
      type: 'sample',
      gross: run.runGrossWeight,
      net: gameState.resources.weight,
      q: run.resolvedShare,
      combo: run.comboCount,
    })
  }, SAMPLE_MS)
  setInterval(() => flush(), FLUSH_MS)

  document.addEventListener('visibilitychange', () => {
    const hidden = document.visibilityState === 'hidden'
    push({ t: Date.now(), type: hidden ? 'hidden' : 'visible' })
    if (hidden) flush(true)
  })
  window.addEventListener('pagehide', () => flush(true))

  console.info(`recorder: recording runs as "${label}"`)
}
