// ─── The spine ───
// Heaviest's economy between runs, in plain arithmetic: no engine, no game state. A run is
// takeHome(pace, q*, tier, upgrades, surge) → { currency, duration }, and
// `src/balance/spine-walk.ts` walks the meta layer over it. A value marked "feel" is a guess;
// the event-stream recordings refit it. Everything else is solved here or read from code.
//
// Buckets, per subsystem:
//   one run's take-home → pure closed form per fixed input: κ · W · q · (1 + d̄)^e · flat · timed
//   combo depth d̄       → stochastic load-bearing: each gap G continues the counter with
//                         s = P(G ≤ w), G ~ Erlang(k, 60/pace), so d̄ reads the spread of the
//                         gaps and not only their mean
//   ship point q*       → optimal stopping, declined: a persona axis, never tuned
//   meta purchases      → combinatorial selection; the walk's driver buys by Δrate / cost
//
// Growth shape: with take-home s·a^L and a level cost c·r^L, a = r gives parallel
// time-to-milestone curves, a > r spread and a < r convergence. Skill reaches the growth rate
// only through the combo exponent: each level multiplies take-home by (1 + d̄)^Δe, so the
// skilled-to-casual ratio per run compounds with levels. Pace also shortens a run, a constant
// ratio: a parallel offset that the 2-3x cap pays for before combo adds anything.
//
// Values solved only through the walk are in `spine-solved.ts`, which `pnpm spine --write`
// generates. The closed-form solves are in deriveSpine.

import { COMBO_MAX, SURGE_CASCADE_BOOST, SURGE_PACKAGE_BOOST } from './config'
import { SPINE_SOLVED } from './spine-solved'

export interface TierAnchor {
  id: string
  /** Deepest scope on the board. */
  depth: number
  /** Run length at the reference pace for the reference persona, no upgrades. Feel. */
  runMinutes: number
  /** Conflicts and duplicates per scope. Feel; today's rolls give 2 guaranteed pairs plus conflicts. */
  actsPerScope: number
}

export interface Persona {
  id: string
  /** q*: the share of the board's problems resolved when this persona ships. */
  shipQuality: number
}

export interface TrackAnchor {
  levels: number
  /** First level's price, in tier-1 reference runs of take-home. */
  baseInRuns: number
  growth: number
}

export type TrackId = 'comboPayout' | 'comboWindow' | 'flat' | 'autoResolve'

export interface Anchors {
  /** Seconds per act, endpoints of the supported range. */
  pace: { slowestGap: number; fastestGap: number }
  /** Erlang shape of the act gap; coefficient of variation 1/√k. Feel. */
  gapShape: number
  /** Seconds to leave one scope and settle in the next: exit, dive, cascade. Feel. */
  transitionSeconds: number
  /** Seconds a run spends outside its scopes: setup, first look, the ship animation. Feel. */
  runFixedSeconds: number
  /** Overhead ∝ gap^β. 0 holds overhead equal across paces, the case kindest to the cap. Feel. */
  overheadPaceExponent: number
  /** d̄ the slowest pace realizes on a tier-1 board, scope changes included; solves the base window. */
  slowestRealizedDepth: number
  /** e(0): the combo exponent before any upgrade. Feel. */
  comboBaseExponent: number
  /** Reference persona's finale time, slowest pace over fastest; solves Δe. Authored, starting at the cap's top. */
  capTarget: number
  /** Seconds of window added per comboWindow level. Feel. */
  windowStep: number
  tiers: TierAnchor[]
  /** Packages per scope. cascade.ts startCascadeImmediate: 8 + randInt(0, 7) deps, plus 40% × 1.5 sub-deps each. */
  packagesPerScope: number
  /** Mean spawned package weight: getIdentitySize over pickRandomIdentity, 200k samples. */
  meanPackageWeight: number
  /** Share of a scope's problems that are conflicts, the rest duplicates. Feel. */
  conflictShare: number
  /** Take-home per minute, tier L+1 over tier L, at the reference pace. Feel. */
  tierRateStep: number
  /** Scale: tokens one tier-1 reference run takes home. Arbitrary unit. */
  tokensPerReferenceRun: number
  tracks: Record<TrackId, TrackAnchor>
  /** Share of a tier-1 board's left-behind conflicts that auto-resolve level 1 clears at the slowest pace. Feel. */
  autoResolveFirstShare: number
  /** A lower tier pays at least this share of the best unlocked tier's take-home per minute. Feel. */
  lowerTierFloor: number
  /** Permanent take-home multiplier per timed challenge cleared. Feel. */
  timedReward: number
  /** A timed limit's margin over the slowest pace's time with every auto-resolve level. Feel. */
  timedSlack: number
  /** Minute the reference walker unlocks each tier, index = tier; tier 1 is free. Feel. */
  unlockMinutes: number[]
  personas: Persona[]
  referencePersona: string
}

export const ANCHORS: Anchors = {
  // 6 s is the decided slowest pace (combo-pays-take-home). 2 s is a guess: holding a
  // conflict alone takes 1.5 s (GameCanvas.vue HOLD_DURATION).
  pace: { slowestGap: 6, fastestGap: 2 },
  gapShape: 4,
  transitionSeconds: 4,
  runFixedSeconds: 20,
  overheadPaceExponent: 0,
  // 2 reads as chains of about 3 acts when chains break at random.
  slowestRealizedDepth: 2,
  comboBaseExponent: 0.1,
  capTarget: 3,
  windowStep: 1,
  tiers: [
    { id: 'utility-lib', depth: 1, runMinutes: 3, actsPerScope: 5 },
    { id: 'app', depth: 2, runMinutes: 4, actsPerScope: 6 },
    { id: 'framework', depth: 3, runMinutes: 5, actsPerScope: 6 },
    { id: 'monorepo', depth: 4, runMinutes: 6, actsPerScope: 7 },
    { id: 'enterprise-app', depth: 5, runMinutes: 7, actsPerScope: 7 },
  ],
  packagesPerScope: 18,
  meanPackageWeight: 49,
  conflictShare: 0.5,
  tierRateStep: 1.6,
  tokensPerReferenceRun: 10,
  // comboPayout and flat share one ladder, so value alone decides the crossover.
  tracks: {
    comboPayout: { levels: 12, baseInRuns: 1.5, growth: 1.55 },
    flat: { levels: 12, baseInRuns: 1.5, growth: 1.55 },
    comboWindow: { levels: 4, baseInRuns: 3, growth: 2.2 },
    autoResolve: { levels: 4, baseInRuns: 4, growth: 2.5 },
  },
  autoResolveFirstShare: 0.5,
  lowerTierFloor: 0.75,
  timedReward: 0.08,
  timedSlack: 0.05,
  unlockMinutes: [0, 0, 10, 25, 45, 70],
  personas: [
    { id: 'hasty', shipQuality: 0.7 },
    { id: 'tidy', shipQuality: 0.9 },
    { id: 'thorough', shipQuality: 1 },
  ],
  referencePersona: 'tidy',
}

export interface Board {
  /** Scopes the player enters: top-level deps and their compressed children. How they nest is content. */
  scopes: number
  problems: number
  /** Gross installed weight (take-home-gross-weight). */
  weight: number
  /** Weight per package over tier 1's, solved for tierRateStep: heavier packages, depth, golden. */
  richness: number
}

export interface Spine {
  anchors: Anchors
  /** Geometric mean of the gap endpoints. */
  referenceGap: number
  /** Combo decay window in seconds before upgrades. Today's COMBO_DECAY_MS is 3 s. */
  baseWindow: number
  /** Δe: combo exponent added per comboPayout level, solved onto capTarget through the walk. */
  comboExponentStep: number
  /** Flat track's multiplier per level, solved for the crossover at the reference pace. */
  flatStep: number
  /** Seconds per auto-resolve, index = autoResolve level. Level 0 has none. */
  autoResolveIntervals: number[]
  /** Index = tier − 1. */
  boards: Board[]
  /** κ: tokens per unit of weight at q = 1, before combo and multipliers. */
  tokensPerWeight: number
  /** Index = tier − 1. Seconds a timed run allows. */
  timedLimits: number[]
}

export interface Upgrades {
  comboPayout: number
  comboWindow: number
  flat: number
  autoResolve: number
  /** Timed challenges cleared. */
  timed: number
}

export const NO_UPGRADES: Upgrades = {
  comboPayout: 0,
  comboWindow: 0,
  flat: 0,
  autoResolve: 0,
  timed: 0,
}

export interface RunInput {
  /** Acts per minute on conflicts and merges. */
  pace: number
  shipQuality: number
  tier: number
  upgrades: Upgrades
  /** Surge segments charged before the run. */
  surge?: number
  /** Highest unlocked tier, which sets the lower-tier floor. Defaults to `tier`. */
  unlockedTier?: number
}

export interface RunResult {
  currency: number
  duration: number
  comboDepth: number
  playerActs: number
  autoResolved: number
  /** The run left conflicts behind for auto-resolve because that paid more per second. */
  leftBehind: boolean
}

// ─── Combo depth ───

/** P(G ≤ t) for G ~ Erlang(shape, mean). */
export function erlangCdf(t: number, mean: number, shape: number): number {
  if (t <= 0) return 0
  const x = (t * shape) / mean
  let term = 1
  let sum = 1
  for (let n = 1; n < shape; n++) {
    term *= x / n
    sum += term
  }
  return 1 - Math.exp(-x) * sum
}

const depthMemo = new Map<string, number>()

/**
 * Mean depth over one run's acts: `scopes` bursts of `actsPerScope`, a gap inside a burst
 * continuing with P(G ≤ w) and a scope change with P(G ≤ w − transition). Depth is the
 * counter an act finds, 0 for a chain's first act. A fractional burst interpolates its two
 * whole neighbours.
 */
export function meanComboDepth(
  scopes: number,
  actsPerScope: number,
  gap: number,
  window: number,
  transition: number,
  shape: number
): number {
  if (actsPerScope <= 0) return 0
  const key = `${scopes}|${actsPerScope}|${gap}|${window}|${transition}|${shape}`
  const hit = depthMemo.get(key)
  if (hit !== undefined) return hit
  const inside = erlangCdf(window, gap, shape)
  const across = erlangCdf(window - transition, gap, shape)
  const lo = Math.floor(actsPerScope)
  const frac = actsPerScope - lo
  const sum =
    (1 - frac) * depthSum(scopes, lo, inside, across) +
    frac * depthSum(scopes, lo + 1, inside, across)
  const depth = sum / (scopes * actsPerScope)
  depthMemo.set(key, depth)
  return depth
}

/** Expected depth summed over every act, walking the counter's distribution act by act. */
function depthSum(
  scopes: number,
  burst: number,
  inside: number,
  across: number
): number {
  let dist: Float64Array = new Float64Array(COMBO_MAX + 1)
  dist[0] = 1
  let total = 0
  for (let scope = 0; scope < scopes; scope++) {
    for (let act = 0; act < burst; act++) {
      if (scope > 0 || act > 0)
        dist = stepCounter(dist, act === 0 ? across : inside)
      for (let d = 1; d <= COMBO_MAX; d++) total += d * dist[d]!
    }
  }
  return total
}

function stepCounter(dist: Float64Array, s: number): Float64Array {
  const next = new Float64Array(COMBO_MAX + 1)
  for (let d = 0; d <= COMBO_MAX; d++) {
    const p = dist[d]!
    next[0]! += (1 - s) * p
    next[Math.min(d + 1, COMBO_MAX)]! += s * p
  }
  return next
}

// ─── One run ───

/** Board scale a surge charge buys: more deps per cascade and more packages. config.ts SURGE_*_BOOST. */
export function surgeScale(segments: number): number {
  return (
    (1 + SURGE_CASCADE_BOOST * segments) * (1 + SURGE_PACKAGE_BOOST * segments)
  )
}

/** The exponent e on (1 + d̄) at a comboPayout level. */
export function comboExponent(spine: Spine, level: number): number {
  return spine.anchors.comboBaseExponent + spine.comboExponentStep * level
}

export function comboWindow(spine: Spine, level: number): number {
  return spine.baseWindow + spine.anchors.windowStep * level
}

export function rateOf(run: RunResult): number {
  return run.currency / run.duration
}

/**
 * One run's take-home and length. q is the share of the board's problems resolved at
 * ship, and take-home is linear in it, so cleaning always pays.
 *
 * Combo pays (1 + d̄)^e, so a player who never chains gets 1 and one more level pays
 * (1 + d̄)^Δe at every level. The additive 1 + c·d̄ is declined: its per-level gain
 * Δc·d̄/(1 + c·d̄) shrinks as c grows, so the flat track overtakes combo at every pace.
 *
 * A lower tier's take-home is lifted to lowerTierFloor × the unlocked tier's rate. Tier rates
 * step by tierRateStep at the reference pace by construction, so the lift is
 * max(1, f · step^(unlocked − tier)) and needs no second run priced.
 *
 * Retired: the jam's efficiency, 0.92^(unresolved / scale) with scale = log10(n + 10) /
 * log10(60) (mutations.ts calculateEfficiency). It counts unresolved problems absolutely:
 * q = 0.7 leaves about 5 unresolved at 120 packages and about 7 at 600. On a finite board
 * every q* persona then does nearly every act, and q* stops being a choice.
 *
 * Auto-resolve works only outside the current scope (auto-resolve-outside-current-scope).
 * A clean player leaves nothing behind for it, so with a level bought the run is priced both
 * ways and plays the better: clean every scope, or merge, move on, and let auto-resolve take
 * the conflicts behind. Auto-resolve starts once the first scope is left, so its capacity
 * is D(1 − 1/S)/τ. Cleanup of what it misses costs no extra transitions here.
 */
export function takeHome(spine: Spine, input: RunInput): RunResult {
  const a = spine.anchors
  const gap = 60 / input.pace
  const board = spine.boards[input.tier - 1]!
  const scale = surgeScale(input.surge ?? 0)
  const problems = board.problems * scale
  const target = input.shipQuality * problems
  const overhead = overheadSeconds(spine, input.tier, input.pace)
  const window = comboWindow(spine, input.upgrades.comboWindow)
  const e = comboExponent(spine, input.upgrades.comboPayout)
  const floor = Math.max(
    1,
    a.lowerTierFloor *
      a.tierRateStep ** ((input.unlockedTier ?? input.tier) - input.tier)
  )
  const value =
    spine.tokensPerWeight *
    board.weight *
    scale *
    input.shipQuality *
    floor *
    (1 + spine.flatStep) ** input.upgrades.flat *
    (1 + a.timedReward) ** input.upgrades.timed

  const settle = (
    playerActs: number,
    autoResolved: number,
    duration: number,
    leftBehind: boolean
  ): RunResult => {
    const depth = meanComboDepth(
      board.scopes,
      playerActs / board.scopes,
      gap,
      window,
      a.transitionSeconds,
      a.gapShape
    )
    return {
      currency: value * (1 + depth) ** e,
      duration,
      comboDepth: depth,
      playerActs,
      autoResolved,
      leftBehind,
    }
  }

  const clean = settle(target, 0, overhead + target * gap, false)
  const interval =
    spine.autoResolveIntervals[input.upgrades.autoResolve] ?? Infinity
  if (!Number.isFinite(interval)) return clean

  const { reachable, behindShare } = leftBehind(spine, input)
  // Capacity binds: D = O + (Q − D·share/τ)·g, so D = (O + Q·g) / (1 + g·share/τ).
  let duration =
    (overhead + target * gap) / (1 + (gap * behindShare) / interval)
  let auto = (duration * behindShare) / interval
  if (auto > reachable) {
    auto = reachable
    duration = overhead + (target - auto) * gap
  }
  const behind = settle(target - auto, auto, duration, true)
  return rateOf(behind) > rateOf(clean) ? behind : clean
}

/**
 * Conflicts a run can leave for auto-resolve: those of the target outside the merges, in
 * scopes already left. Auto-resolve starts once the first scope is left, so it works for
 * behindShare = 1 − 1/S of the run.
 */
function leftBehind(
  spine: Spine,
  input: RunInput
): { reachable: number; behindShare: number } {
  const board = spine.boards[input.tier - 1]!
  const problems = board.problems * surgeScale(input.surge ?? 0)
  const conflicts = problems * spine.anchors.conflictShare
  const target = input.shipQuality * problems
  const merges = Math.min(problems - conflicts, target)
  const behindShare = 1 - 1 / board.scopes
  return {
    reachable: Math.min(target - merges, conflicts * behindShare),
    behindShare,
  }
}

/** Run overhead at a pace: fixed time plus one transition per scope. */
function overheadSeconds(spine: Spine, tier: number, pace: number): number {
  const a = spine.anchors
  return (
    a.runFixedSeconds +
    spine.boards[tier - 1]!.scopes *
      a.transitionSeconds *
      (60 / pace / spine.referenceGap) ** a.overheadPaceExponent
  )
}

// ─── Derivation ───

export function referencePersona(anchors: Anchors): Persona {
  const persona = anchors.personas.find(
    (p) => p.id === anchors.referencePersona
  )
  if (!persona) throw new Error(`no persona ${anchors.referencePersona}`)
  return persona
}

export function trackPrice(
  spine: Spine,
  track: TrackId,
  level: number
): number {
  const t = spine.anchors.tracks[track]
  return spine.anchors.tokensPerReferenceRun * t.baseInRuns * t.growth ** level
}

/**
 * Every closed-form solved value from the anchors. `comboExponentStep` is solved through the
 * walk (`solveSpine` in src/balance/spine-walk.ts); the game reads the committed solve.
 */
export function deriveSpine(
  anchors: Anchors = ANCHORS,
  comboExponentStep: number = SPINE_SOLVED.comboExponentStep
): Spine {
  const a = anchors
  const referenceGap = Math.sqrt(a.pace.slowestGap * a.pace.fastestGap)
  const q = referencePersona(a).shipQuality

  // Scopes per board from the run length: T = fixed + S·(transition + m·q·g_ref).
  const scopes = a.tiers.map((t) =>
    Math.max(
      1,
      Math.round(
        (t.runMinutes * 60 - a.runFixedSeconds) /
          (a.transitionSeconds + t.actsPerScope * q * referenceGap)
      )
    )
  )
  const rawWeight = scopes.map(
    (s) => s * a.packagesPerScope * a.meanPackageWeight
  )

  // The base window is the w at which the slowest pace realizes slowestRealizedDepth on a
  // clean tier-1 run: its bursts and its scope changes, not an endless chain. d̄ rises in w.
  const realized = (w: number) =>
    meanComboDepth(
      scopes[0]!,
      q * a.tiers[0]!.actsPerScope,
      a.pace.slowestGap,
      w,
      a.transitionSeconds,
      a.gapShape
    )
  let lo = 0
  let hi = 60
  if (realized(hi) < a.slowestRealizedDepth)
    throw new Error(
      `no window under ${hi} s realizes d̄ = ${a.slowestRealizedDepth} at the slowest pace`
    )
  for (let i = 0; i < 60; i++) {
    const w = (lo + hi) / 2
    if (realized(w) < a.slowestRealizedDepth) lo = w
    else hi = w
  }
  const baseWindow = (lo + hi) / 2

  const probe: Spine = {
    anchors: a,
    referenceGap,
    baseWindow,
    comboExponentStep,
    flatStep: 0,
    autoResolveIntervals: [Infinity],
    boards: a.tiers.map((t, i) => ({
      scopes: scopes[i]!,
      problems: scopes[i]! * t.actsPerScope,
      weight: rawWeight[i]!,
      richness: 1,
    })),
    tokensPerWeight: 1,
    timedLimits: [],
  }

  // The auto-resolve ladder sells capacity, priced at the slowest pace on a fully stable
  // board: level 1 clears autoResolveFirstShare of tier 1's left-behind conflicts, the top
  // level all of tier 5's, and the levels between step geometrically. With capacity binding,
  // A = D·share/τ and D = O + (Q − A)·g, so τ = (O + (Q − A)·g)·share / A.
  const slowPace = 60 / a.pace.slowestGap
  const intervalFor = (tier: number, share: number) => {
    const input = {
      pace: slowPace,
      shipQuality: 1,
      tier,
      upgrades: NO_UPGRADES,
    }
    const { reachable, behindShare } = leftBehind(probe, input)
    const cleared = share * reachable
    const duration =
      overheadSeconds(probe, tier, slowPace) +
      (probe.boards[tier - 1]!.problems - cleared) * a.pace.slowestGap
    return (duration * behindShare) / cleared
  }
  const levels = a.tracks.autoResolve.levels
  const first = intervalFor(1, a.autoResolveFirstShare)
  const top = intervalFor(a.tiers.length, 1)
  const autoResolveIntervals = [
    Infinity,
    ...Array.from(
      { length: levels },
      (_, i) => first * (top / first) ** (levels > 1 ? i / (levels - 1) : 1)
    ),
  ]

  // Weight per package is the solved quantity: each tier pays tierRateStep more per minute
  // than the last at the reference pace, so ρ_L = step^(L−1) · rate₁ / rawRate_L.
  const referencePace = 60 / referenceGap
  const rawRates = a.tiers.map((_, i) =>
    rateOf(
      takeHome(probe, {
        pace: referencePace,
        shipQuality: q,
        tier: i + 1,
        upgrades: NO_UPGRADES,
      })
    )
  )
  const boards = probe.boards.map((b, i) => {
    const richness = (a.tierRateStep ** i * rawRates[0]!) / rawRates[i]!
    return { ...b, richness, weight: b.weight * richness }
  })

  // κ sets the unit: the tier-1 reference run takes home tokensPerReferenceRun.
  const firstRun = takeHome(
    { ...probe, boards },
    { pace: referencePace, shipQuality: q, tier: 1, upgrades: NO_UPGRADES }
  )
  const tokensPerWeight = a.tokensPerReferenceRun / firstRun.currency

  // Crossover at the reference pace: one flat level pays what one combo level pays there,
  // φ = (1 + d̄_ref)^Δe − 1, at every level. Both ladders cost the same.
  const flatStep = (1 + firstRun.comboDepth) ** comboExponentStep - 1

  const spine: Spine = {
    ...probe,
    flatStep,
    autoResolveIntervals,
    boards,
    tokensPerWeight,
  }

  // A timed limit is the slowest pace's fully stable run with every auto-resolve level
  // (timed-run-opt-in), plus slack.
  const lateAuto = { ...NO_UPGRADES, autoResolve: levels }
  spine.timedLimits = a.tiers.map(
    (_, i) =>
      (1 + a.timedSlack) *
      takeHome(spine, {
        pace: slowPace,
        shipQuality: 1,
        tier: i + 1,
        upgrades: lateAuto,
      }).duration
  )
  return spine
}
