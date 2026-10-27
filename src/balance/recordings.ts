// Reads the dev recorder's runs (src/game/recorder.ts) and prints what they measure beside
// the spine's anchors, per label, so a "feel" anchor can be refit from play. A script that
// prints, not a test: `pnpm recordings [dir]`, the folder defaulting to RECORDINGS_DIR or
// `recordings`.
//
// Measured against the spine's run model, duration = fixed + S · transition + acts · gap:
//   gap        — act to act inside one scope visit, idle gaps dropped
//   transition — act to act across a scope change, less the mean gap, per scope entered
//   fixed      — what the run's active time leaves after S transitions and every act's gap
// Hidden-tab time and reloads are cut out; a gap between inputs over IDLE_SECONDS counts as
// idle, and its excess is cut too.

import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ANCHORS, GAME_SPINE } from '../game/spine'
import type { RecordedEvent, Recording } from '../game/recorder'

const IDLE_SECONDS = 60

interface RunStats {
  id: string
  label: string
  tier: number
  complete: boolean
  activeSeconds: number
  idleSeconds: number
  acts: number
  autoResolved: number
  gaps: number[]
  /** Per scope entered between two acts: the cross gap less the run's mean gap. */
  transitions: number[]
  scopesCascaded: number
  meanDepth: number
  problems: number
  conflicts: number
  q: number
  weightRatio: number
  /** Unpacked to the ship call: the persona's cleanup. */
  cleanupSeconds: number | null
  fixedSeconds: number
}

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN
const variance = (xs: number[]) => {
  const m = mean(xs)
  return mean(xs.map((x) => (x - m) ** 2))
}
const median = (xs: number[]) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}
const f = (n: number | null, digits = 1) =>
  n !== null && Number.isFinite(n) ? n.toFixed(digits) : '—'

function table(headers: string[], rows: (string | number)[][]): string {
  const line = (cells: (string | number)[]) => `| ${cells.join(' | ')} |`
  return [
    line(headers),
    line(headers.map(() => '---')),
    ...rows.map(line),
  ].join('\n')
}

const isInput = (e: RecordedEvent) =>
  e.type === 'act' ||
  e.type === 'install' ||
  e.type === 'scope:enter' ||
  e.type === 'scope:exit' ||
  e.type === 'ship:start'

function analyzeRun(r: Recording): RunStats {
  const end = r.end
  const endT = end?.t ?? r.events[r.events.length - 1]?.t ?? r.startedAt

  // Paused spans: a hidden tab until it shows again, and the dead time before a reload.
  let paused = 0
  let hiddenAt: number | null = null
  let prevT = r.startedAt
  for (const e of r.events) {
    if (e.type === 'hidden') hiddenAt ??= e.t
    else if (e.type === 'visible' && hiddenAt !== null) {
      paused += e.t - hiddenAt
      hiddenAt = null
    } else if (e.type === 'resume') {
      paused += e.t - (hiddenAt ?? prevT)
      hiddenAt = null
    }
    prevT = e.t
  }
  if (hiddenAt !== null) paused += endT - hiddenAt

  // Idle: the excess of a long gap between inputs, outside paused spans.
  let idle = 0
  let lastInput = r.startedAt
  let pausedSince = false
  for (const e of r.events) {
    if (e.type === 'hidden' || e.type === 'resume') pausedSince = true
    if (!isInput(e)) continue
    const gap = (e.t - lastInput) / 1000
    if (!pausedSince && gap > IDLE_SECONDS) idle += gap - IDLE_SECONDS
    lastInput = e.t
    pausedSince = false
  }

  // Act gaps inside one scope visit, and cross gaps over scope changes.
  const gaps: number[] = []
  const cross: { seconds: number; entered: number }[] = []
  let lastAct: number | null = null
  let entered = 0
  let broken = false
  for (const e of r.events) {
    if (e.type === 'hidden' || e.type === 'resume') broken = true
    if (e.type === 'scope:enter') entered++
    if (e.type !== 'act') continue
    if (lastAct !== null && !broken) {
      const seconds = (e.t - lastAct) / 1000
      if (entered === 0 && seconds <= IDLE_SECONDS) gaps.push(seconds)
      else if (entered > 0 && seconds <= IDLE_SECONDS + 30 * entered)
        cross.push({ seconds, entered })
    }
    lastAct = e.t
    entered = 0
    broken = false
  }
  const gap = mean(gaps)
  const transitions = cross.map((c) => (c.seconds - gap) / c.entered)

  const acts = r.events.filter((e) => e.type === 'act')
  const count = (type: RecordedEvent['type']) =>
    r.events.filter((e) => e.type === type).length
  const autoResolved = count('auto-resolve')
  const scopesCascaded = count('cascade:end')
  const unpacked = r.events.find((e) => e.type === 'board:unpacked')
  const shipStart = r.events.find((e) => e.type === 'ship:start')

  const activeSeconds = (endT - r.startedAt - paused) / 1000 - idle
  const problems = end
    ? end.resolved + end.openConflicts + end.openDuplicates
    : NaN
  const conflictActs = acts.filter(
    (e) => e.type === 'act' && e.kind === 'conflict'
  ).length
  const scopes = r.spineBoard.scopes

  return {
    id: r.id,
    label: r.label,
    tier: r.tier,
    complete: !r.startedMidRun && end?.kind === 'ship',
    activeSeconds,
    idleSeconds: idle,
    acts: acts.length,
    autoResolved,
    gaps,
    transitions,
    scopesCascaded,
    meanDepth: mean(acts.map((e) => (e.type === 'act' ? e.found : 0))),
    problems,
    conflicts: end ? conflictActs + autoResolved + end.openConflicts : NaN,
    q: end?.q ?? NaN,
    weightRatio: end ? end.grossWeight / r.spineBoard.weight : NaN,
    cleanupSeconds:
      unpacked && shipStart ? (shipStart.t - unpacked.t) / 1000 : null,
    fixedSeconds:
      activeSeconds - acts.length * gap - scopes * mean(transitions),
  }
}

function load(dir: string): Recording[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map(
      (name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as Recording
    )
    .sort((a, b) => a.startedAt - b.startedAt)
}

function main(): void {
  const dir = resolve(
    process.argv[2] ?? process.env.RECORDINGS_DIR ?? 'recordings'
  )
  const runs = load(dir).map(analyzeRun)
  console.log(`# Recordings in ${dir}\n`)
  if (!runs.length) {
    console.log('No runs recorded yet.')
    return
  }

  console.log('## Runs\n')
  console.log(
    table(
      [
        'run',
        'label',
        'tier',
        'complete',
        'active s',
        'idle s',
        'acts',
        'auto',
        'gap s',
        'transition s',
        'fixed s',
        'd̄',
        'scopes',
        'problems / scope',
        'q',
        'gross ÷ spine',
        'cleanup s',
      ],
      runs.map((s) => [
        s.id,
        s.label,
        s.tier,
        s.complete ? 'yes' : 'no',
        f(s.activeSeconds, 0),
        f(s.idleSeconds, 0),
        s.acts,
        s.autoResolved,
        f(mean(s.gaps), 2),
        f(mean(s.transitions), 2),
        f(s.fixedSeconds, 0),
        f(s.meanDepth, 2),
        `${s.scopesCascaded} / ${GAME_SPINE.boards[s.tier - 1]!.scopes}`,
        f(s.problems / GAME_SPINE.boards[s.tier - 1]!.scopes, 1),
        f(s.q, 2),
        f(s.weightRatio, 2),
        f(s.cleanupSeconds, 0),
      ])
    )
  )

  // Anchors refit from complete runs; gaps and depth use every run's acts.
  const labels = [...new Set(runs.map((s) => s.label))]
  const byLabel = labels.map((label) => {
    const all = runs.filter((s) => s.label === label)
    const complete = all.filter((s) => s.complete)
    const gaps = all.flatMap((s) => s.gaps)
    const acts = all.reduce((n, s) => n + s.acts, 0)
    const depth =
      all.reduce(
        (n, s) => n + (Number.isFinite(s.meanDepth) ? s.meanDepth * s.acts : 0),
        0
      ) / acts
    return {
      label,
      runs: `${complete.length} / ${all.length}`,
      gap: mean(gaps),
      medianGap: median(gaps),
      shape: mean(gaps) ** 2 / variance(gaps),
      transition: mean(all.flatMap((s) => s.transitions)),
      fixed: mean(complete.map((s) => s.fixedSeconds)),
      depth,
      conflictShare:
        complete.reduce((n, s) => n + s.conflicts, 0) /
        complete.reduce((n, s) => n + s.problems, 0),
      tiers: ANCHORS.tiers.map((_, i) => {
        const at = complete.filter((s) => s.tier === i + 1)
        return {
          minutes: mean(at.map((s) => s.activeSeconds / 60)),
          perScope: mean(
            at.map((s) => s.problems / GAME_SPINE.boards[i]!.scopes)
          ),
          weight: mean(at.map((s) => s.weightRatio)),
        }
      }),
    }
  })

  console.log('\n## Anchors beside the recordings\n')
  const a = ANCHORS
  const tierRows = (
    name: string,
    spine: (i: number) => string,
    measured: (l: (typeof byLabel)[number], i: number) => string
  ) =>
    a.tiers.map((_, i) => [
      `${name}, tier ${i + 1}`,
      spine(i),
      ...byLabel.map((l) => measured(l, i)),
    ])
  console.log(
    table(
      ['anchor', 'spine', ...labels],
      [
        ['complete runs / runs', '', ...byLabel.map((l) => l.runs)],
        [
          'act gap s (mean; median)',
          `${a.pace.slowestGap} slowest, ${a.pace.fastestGap} fastest`,
          ...byLabel.map((l) => `${f(l.gap, 2)}; ${f(l.medianGap, 2)}`),
        ],
        [
          'gapShape k = mean² ÷ var',
          a.gapShape,
          ...byLabel.map((l) => f(l.shape, 2)),
        ],
        [
          'transitionSeconds',
          a.transitionSeconds,
          ...byLabel.map((l) => f(l.transition, 2)),
        ],
        [
          'runFixedSeconds',
          a.runFixedSeconds,
          ...byLabel.map((l) => f(l.fixed, 0)),
        ],
        [
          'd̄ realized',
          `${a.slowestRealizedDepth} at the slowest pace`,
          ...byLabel.map((l) => f(l.depth, 2)),
        ],
        [
          'conflictShare',
          a.conflictShare,
          ...byLabel.map((l) => f(l.conflictShare, 2)),
        ],
        ...tierRows(
          'actsPerScope',
          (i) => String(a.tiers[i]!.actsPerScope),
          (l, i) => f(l.tiers[i]!.perScope, 1)
        ),
        ...tierRows(
          'runMinutes',
          (i) => `${a.tiers[i]!.runMinutes} at the reference pace`,
          (l, i) => f(l.tiers[i]!.minutes, 1)
        ),
        ...tierRows(
          'gross ÷ Board.weight',
          () => '1',
          (l, i) => f(l.tiers[i]!.weight, 2)
        ),
      ]
    )
  )

  // Overhead ∝ gap^β, from the two pace endpoints when both are recorded.
  const slow = byLabel.find((l) => l.label === 'slow')
  const fast = byLabel.find((l) => l.label === 'fast')
  if (slow && fast) {
    const beta =
      Math.log(slow.transition / fast.transition) /
      Math.log(slow.gap / fast.gap)
    console.log(
      `\noverheadPaceExponent β (transition, slow over fast): ${f(beta, 2)}; spine ${a.overheadPaceExponent}`
    )
  } else {
    console.log(
      '\noverheadPaceExponent needs runs labelled `slow` and `fast` (`?rec=slow`, `?rec=fast`).'
    )
  }
}

main()
