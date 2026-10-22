// Prints the spine: solved values, the first-run decomposition, the pace sweep against the
// 2-3x cap, and the levers that move it. A script that prints, not a test: `pnpm spine`.

import {
  ANCHORS,
  NO_UPGRADES,
  deriveSpine,
  rateOf,
  referencePersona,
  takeHome,
  type Anchors,
  type Persona,
  type Spine,
} from '../game/spine'
import { solveTierPrices, walk } from './spine-walk'

const MILESTONES = ['tier 2', 'tier 3', 'tier 4', 'tier 5', 'finale']

function table(headers: string[], rows: (string | number)[][]): string {
  const line = (cells: (string | number)[]) => `| ${cells.join(' | ')} |`
  return [
    line(headers),
    line(headers.map(() => '---')),
    ...rows.map(line),
  ].join('\n')
}

const f = (n: number, digits = 1) =>
  Number.isFinite(n) ? n.toFixed(digits) : '—'

function sweepGaps(spine: Spine): number[] {
  const { slowestGap, fastestGap } = spine.anchors.pace
  const steps = 6
  return Array.from(
    { length: steps + 1 },
    (_, i) => fastestGap * (slowestGap / fastestGap) ** (i / steps)
  )
}

function milestones(
  spine: Spine,
  prices: number[],
  persona: Persona,
  gap: number
): number[] {
  const r = walk(spine, prices, persona, 60 / gap)
  return [...r.unlockMinutes.slice(2), r.finaleMinutes]
}

/** Slowest over fastest time to the finale, for one persona. */
function finaleRatio(spine: Spine, prices: number[], persona: Persona): number {
  const slow = walk(
    spine,
    prices,
    persona,
    60 / spine.anchors.pace.slowestGap
  ).finaleMinutes
  const fast = walk(
    spine,
    prices,
    persona,
    60 / spine.anchors.pace.fastestGap
  ).finaleMinutes
  return slow / fast
}

function firstRunSplit(spine: Spine, persona: Persona) {
  const run = (gap: number) =>
    takeHome(spine, {
      pace: 60 / gap,
      shipQuality: persona.shipQuality,
      tier: 1,
      upgrades: NO_UPGRADES,
    })
  const slow = run(spine.anchors.pace.slowestGap)
  const fast = run(spine.anchors.pace.fastestGap)
  return {
    slow,
    fast,
    durationRatio: slow.duration / fast.duration,
    comboRatio: fast.currency / slow.currency,
    rateRatio: rateOf(fast) / rateOf(slow),
  }
}

function report(): void {
  const spine = deriveSpine()
  const prices = solveTierPrices(spine)
  const a = spine.anchors
  const out: string[] = []

  out.push('# Heaviest spine\n')
  out.push(
    `Reference gap ${f(spine.referenceGap, 2)} s (pace ${f(60 / spine.referenceGap)}/min). ` +
      `Base combo window ${f(spine.baseWindow, 2)} s (today 3 s). Flat step ${f(spine.flatStep * 100, 2)}% per level.\n`
  )
  const referenceWalk = walk(
    spine,
    prices,
    referencePersona(a),
    60 / spine.referenceGap
  )
  out.push('## Boards\n')
  out.push(
    table(
      [
        'tier',
        'scopes',
        'problems',
        'weight',
        'richness',
        'ref run (min)',
        'timed limit (min)',
        'unlock price',
        'scheduled (min)',
        'walked (min)',
      ],
      a.tiers.map((t, i) => {
        const ref = takeHome(spine, {
          pace: 60 / spine.referenceGap,
          shipQuality: referencePersona(a).shipQuality,
          tier: i + 1,
          upgrades: NO_UPGRADES,
        })
        const b = spine.boards[i]!
        return [
          `${i + 1} ${t.id}`,
          b.scopes,
          b.problems,
          Math.round(b.weight),
          f(b.richness, 2),
          f(ref.duration / 60, 2),
          f(spine.timedLimits[i]! / 60, 2),
          i === 0 ? '—' : Math.round(prices[i + 1]!),
          a.unlockMinutes[i + 1]!,
          f(referenceWalk.unlockMinutes[i + 1]!),
        ]
      })
    )
  )

  out.push('\n## First run, tier 1, no upgrades: slowest vs fastest pace\n')
  out.push(
    table(
      [
        'persona',
        'slow min',
        'fast min',
        'slow d̄',
        'fast d̄',
        'duration ×',
        'combo ×',
        'rate ×',
      ],
      a.personas.map((p) => {
        const s = firstRunSplit(spine, p)
        return [
          p.id,
          f(s.slow.duration / 60, 2),
          f(s.fast.duration / 60, 2),
          f(s.slow.comboDepth, 2),
          f(s.fast.comboDepth, 2),
          f(s.durationRatio, 2),
          f(s.comboRatio, 2),
          f(s.rateRatio, 2),
        ]
      })
    )
  )

  const gaps = sweepGaps(spine)
  for (const p of a.personas) {
    out.push(
      `\n## Sweep: ${p.id} (q* = ${p.shipQuality}), minutes to each milestone\n`
    )
    const rows = gaps.map((g) => [
      `${f(g, 2)} s`,
      ...milestones(spine, prices, p, g).map((m) => f(m)),
    ])
    const fast = milestones(spine, prices, p, a.pace.fastestGap)
    const slow = milestones(spine, prices, p, a.pace.slowestGap)
    const ratios = slow.map((s, i) => s / fast[i]!)
    rows.push(['slow ÷ fast', ...ratios.map((r) => f(r, 2))])
    out.push(table(['gap', ...MILESTONES], rows))
    const drift = ratios[ratios.length - 1]! / ratios[0]!
    out.push(
      `\nShape: ${drift > 1.1 ? 'spread' : drift < 0.9 ? 'convergence' : 'parallel'} (finale ratio ÷ tier-2 ratio = ${f(drift, 2)}).`
    )
    const end = walk(spine, prices, p, 60 / a.pace.fastestGap)
    const endSlow = walk(spine, prices, p, 60 / a.pace.slowestGap)
    out.push(
      `\nUpgrades at the finale, fastest: ${JSON.stringify(end.upgrades)}; slowest: ${JSON.stringify(endSlow.upgrades)}`
    )
  }

  out.push('\n## Lower tiers late: tidy persona, upgrades as at its finale\n')
  out.push(lowerTierRows(spine, prices))

  out.push(
    '\n## Crossover, tier 1: the gap at which one more level of each track pays the same\n'
  )
  out.push(crossoverRows(spine))

  out.push(
    '\n## Levers: tidy persona, finale time slowest ÷ fastest, tier prices re-solved\n'
  )
  out.push(
    table(
      ['lever', 'first-run duration ×', 'first-run rate ×', 'finale ×'],
      levers().map(([name, build]) => {
        const s = build()
        const p = referencePersona(s.anchors)
        const split = firstRunSplit(s, p)
        return [
          name,
          f(split.durationRatio, 2),
          f(split.rateRatio, 2),
          f(finaleRatio(s, solveTierPrices(s), p), 2),
        ]
      })
    )
  )

  out.push(
    '\n## Cap solve: one anchor at a time, tidy finale ratio onto the cap\n'
  )
  out.push(capSolveRows())

  console.log(out.join('\n'))
}

/**
 * The anchor value that puts the reference persona's finale ratio on `target`, by bisection.
 * The ratio must be monotone in the anchor over [lo, hi]; NaN when the target is outside.
 */
function solveAnchor(
  build: (x: number) => Anchors,
  lo: number,
  hi: number,
  target: number
): number {
  const ratio = (x: number) => {
    const s = deriveSpine(build(x))
    return (
      finaleRatio(s, solveTierPrices(s), referencePersona(s.anchors)) - target
    )
  }
  const rising = ratio(hi) > ratio(lo)
  if (Math.sign(ratio(lo)) === Math.sign(ratio(hi))) return NaN
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (ratio(mid) > 0 === rising) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}

function capSolveRows(): string {
  const rows = [3, 2.5].map((target) => [
    `${target}×`,
    f(
      solveAnchor((x) => ({ ...ANCHORS, comboStep: x }), 0, 0.2, target),
      4
    ),
    f(
      solveAnchor((x) => ({ ...ANCHORS, transitionSeconds: x }), 1, 30, target),
      2
    ),
    f(
      solveAnchor((x) => ({ ...ANCHORS, runFixedSeconds: x }), 0, 600, target),
      1
    ),
  ])
  return table(
    [
      'finale cap',
      `comboStep (now ${ANCHORS.comboStep})`,
      `transition s (now ${ANCHORS.transitionSeconds})`,
      `run fixed s (now ${ANCHORS.runFixedSeconds})`,
    ],
    rows
  )
}

/** A lower tier's run length and pay per minute against tier 5, so a short session's worth shows. */
function lowerTierRows(spine: Spine, prices: number[]): string {
  const p = referencePersona(spine.anchors)
  const rows: (string | number)[][] = []
  const ends = [
    spine.anchors.pace.fastestGap,
    spine.anchors.pace.slowestGap,
  ].map((gap) => ({
    gap,
    upgrades: walk(spine, prices, p, 60 / gap).upgrades,
  }))
  for (let tier = 1; tier <= 5; tier++) {
    const row: (string | number)[] = [tier]
    for (const { gap, upgrades } of ends) {
      const run = (t: number) =>
        takeHome(spine, {
          pace: 60 / gap,
          shipQuality: p.shipQuality,
          tier: t,
          upgrades,
        })
      row.push(
        f(run(tier).duration / 60, 2),
        f(rateOf(run(tier)) / rateOf(run(5)), 2)
      )
    }
    rows.push(row)
  }
  return table(
    [
      'tier',
      'fast run (min)',
      'fast pay ÷ tier 5',
      'slow run (min)',
      'slow pay ÷ tier 5',
    ],
    rows
  )
}

function crossoverRows(spine: Spine): string {
  const rows: (string | number)[][] = []
  const p = referencePersona(spine.anchors)
  for (const level of [0, 4, 8, 11]) {
    const up = { ...NO_UPGRADES, comboPayout: level, flat: level }
    const gain = (gap: number, track: 'comboPayout' | 'flat') => {
      const base = takeHome(spine, {
        pace: 60 / gap,
        shipQuality: p.shipQuality,
        tier: 1,
        upgrades: up,
      })
      const next = takeHome(spine, {
        pace: 60 / gap,
        shipQuality: p.shipQuality,
        tier: 1,
        upgrades: { ...up, [track]: level + 1 },
      })
      return rateOf(next) / rateOf(base) - 1
    }
    let lo = spine.anchors.pace.fastestGap
    let hi = spine.anchors.pace.slowestGap
    const diff = (g: number) => gain(g, 'comboPayout') - gain(g, 'flat')
    let crossing = NaN
    if (diff(lo) > 0 && diff(hi) < 0) {
      for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2
        if (diff(mid) > 0) lo = mid
        else hi = mid
      }
      crossing = (lo + hi) / 2
    }
    rows.push([
      level,
      f(crossing, 2),
      f(gain(spine.anchors.pace.fastestGap, 'comboPayout') * 100, 2),
      f(gain(spine.anchors.pace.slowestGap, 'comboPayout') * 100, 2),
      f(spine.flatStep * 100, 2),
    ])
  }
  return table(
    [
      'both tracks at level',
      'crossover gap (s)',
      'combo +% fast',
      'combo +% slow',
      'flat +%',
    ],
    rows
  )
}

/**
 * Each lever re-derives the spine from changed anchors. The combo rows change the derived
 * spine instead, so the flat step and the boards stay as solved.
 */
function levers(): [string, () => Spine][] {
  const from = (anchors: Anchors) => () => deriveSpine(anchors)
  const keep = (change: Partial<Anchors>) => () => {
    const s = deriveSpine()
    return { ...s, anchors: { ...s.anchors, ...change } }
  }
  return [
    ['base', from(ANCHORS)],
    [
      'fastest gap 3 s',
      from({ ...ANCHORS, pace: { ...ANCHORS.pace, fastestGap: 3 } }),
    ],
    ['transition 8 s', from({ ...ANCHORS, transitionSeconds: 8 })],
    ['run fixed 60 s', from({ ...ANCHORS, runFixedSeconds: 60 })],
    ['overhead ∝ gap (β = 1)', from({ ...ANCHORS, overheadPaceExponent: 1 })],
    ['gap CV 0.25 (k = 16)', from({ ...ANCHORS, gapShape: 16 })],
    ['no combo growth (step 0)', keep({ comboStep: 0 })],
    ['no combo payout at all', keep({ comboBase: 0, comboStep: 0 })],
    ['no timed reward', from({ ...ANCHORS, timedReward: 0 })],
  ]
}

report()
