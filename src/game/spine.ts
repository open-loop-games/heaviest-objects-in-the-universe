// ─── The spine ───
// Heaviest's economy between runs, in plain arithmetic: no engine, no game state. A run is
// takeHome(pace, q*, tier, upgrades, surge) → { currency, duration }, and
// `src/balance/spine-walk.ts` walks the meta layer over it. A value marked "feel" is a guess;
// the event-stream recordings refit it. Everything else is solved here or read from code.
//
// Buckets, per subsystem:
//   one run's take-home → pure closed form per fixed input: κ · W · q · (1 + c·d̄) · flat · timed
//   combo depth d̄       → stochastic load-bearing: each gap G continues the counter with
//                         s = P(G ≤ w), G ~ Erlang(k, 60/pace), so d̄ reads the spread of the
//                         gaps and not only their mean
//   ship point q*       → optimal stopping, declined: a persona axis, never tuned
//   meta purchases      → combinatorial selection; the walk's driver buys by Δrate / cost
//
// Growth shape: with take-home s·a^L and a level cost c·r^L, a = r gives parallel
// time-to-milestone curves, a > r spread and a < r convergence. Skill reaches the growth rate
// only through c(L)·d̄. Pace also shortens a run, a constant ratio: a parallel offset that
// the 2-3x cap pays for before combo adds anything.

import { COMBO_MAX, SURGE_CASCADE_BOOST, SURGE_PACKAGE_BOOST } from './config'

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
  /** Stationary d̄ at the slowest gap inside a scope; solves the base window. Feel. */
  slowestStationaryDepth: number
  /** c(0): combo payout per unit of d̄ before any upgrade. Feel. */
  comboBase: number
  /** Payout added per comboPayout level. Feel. */
  comboStep: number
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
  /** Seconds per auto-resolve, per autoResolve level. Level 0 has none. automation.ts RESOLVE_INTERVALS, tiers 2-5. */
  autoResolveIntervals: number[]
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
  slowestStationaryDepth: 2.5,
  comboBase: 0.05,
  comboStep: 0.04,
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
  autoResolveIntervals: [Infinity, 3, 2, 1, 0.5],
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
  /** Flat track's multiplier per level, solved for the crossover at the reference pace. */
  flatStep: number
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

/**
 * Mean depth of an endless chain whose gaps each continue with s: E[min(Geom, C)] =
 * s(1 − s^C)/(1 − s). Depth is the counter an act finds, 0 for a chain's first act.
 */
export function stationaryDepth(s: number): number {
  if (s >= 1) return COMBO_MAX
  return (s * (1 - s ** COMBO_MAX)) / (1 - s)
}

const depthMemo = new Map<string, number>()

/**
 * Mean depth over one run's acts: `scopes` bursts of `actsPerScope`, a gap inside a burst
 * continuing with P(G ≤ w) and a scope change with P(G ≤ w − transition). A fractional burst
 * interpolates its two whole neighbours.
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

export function comboPayout(spine: Spine, level: number): number {
  return spine.anchors.comboBase + spine.anchors.comboStep * level
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
  const conflicts = problems * a.conflictShare
  const target = input.shipQuality * problems
  const overhead =
    a.runFixedSeconds +
    board.scopes *
      a.transitionSeconds *
      (gap / spine.referenceGap) ** a.overheadPaceExponent
  const window = comboWindow(spine, input.upgrades.comboWindow)
  const c = comboPayout(spine, input.upgrades.comboPayout)
  const value =
    spine.tokensPerWeight *
    board.weight *
    scale *
    input.shipQuality *
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
      currency: value * (1 + c * depth),
      duration,
      comboDepth: depth,
      playerActs,
      autoResolved,
      leftBehind,
    }
  }

  const clean = settle(target, 0, overhead + target * gap, false)
  const interval =
    a.autoResolveIntervals[input.upgrades.autoResolve] ?? Infinity
  if (!Number.isFinite(interval)) return clean

  const behindShare = 1 - 1 / board.scopes
  const merges = Math.min(problems - conflicts, target)
  const reachable = Math.min(target - merges, conflicts * behindShare)
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

export function deriveSpine(anchors: Anchors = ANCHORS): Spine {
  const a = anchors
  const referenceGap = Math.sqrt(a.pace.slowestGap * a.pace.fastestGap)
  const q = referencePersona(a).shipQuality

  // The base window is the w at which the slowest pace holds slowestStationaryDepth inside a
  // scope. stationaryDepth(P(G ≤ w)) rises in w, so bisect.
  let lo = 0
  let hi = 60
  for (let i = 0; i < 60; i++) {
    const w = (lo + hi) / 2
    const depth = stationaryDepth(erlangCdf(w, a.pace.slowestGap, a.gapShape))
    if (depth < a.slowestStationaryDepth) lo = w
    else hi = w
  }
  const baseWindow = (lo + hi) / 2

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

  // Weight per package is the solved quantity: each tier pays tierRateStep more per minute
  // than the last at the reference pace, so ρ_L = step^(L−1) · rate₁ / rawRate_L.
  const probe: Spine = {
    anchors: a,
    referenceGap,
    baseWindow,
    flatStep: 0,
    boards: a.tiers.map((t, i) => ({
      scopes: scopes[i]!,
      problems: scopes[i]! * t.actsPerScope,
      weight: rawWeight[i]!,
      richness: 1,
    })),
    tokensPerWeight: 1,
    timedLimits: [],
  }
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
  const first = takeHome(
    { ...probe, boards },
    { pace: referencePace, shipQuality: q, tier: 1, upgrades: NO_UPGRADES }
  )
  const tokensPerWeight = a.tokensPerReferenceRun / first.currency

  // Crossover at the reference pace: the flat track's first level is worth the combo track's
  // first level, φ = Δc·d̄ / (1 + c₀·d̄). Both ladders cost the same.
  const flatStep =
    (a.comboStep * first.comboDepth) / (1 + a.comboBase * first.comboDepth)

  const spine: Spine = {
    anchors: a,
    referenceGap,
    baseWindow,
    flatStep,
    boards,
    tokensPerWeight,
    timedLimits: [],
  }

  // A timed limit is the slowest pace's fully stable run with every auto-resolve level
  // (timed-run-opt-in), plus slack.
  const lateAuto = { ...NO_UPGRADES, autoResolve: a.tracks.autoResolve.levels }
  spine.timedLimits = a.tiers.map(
    (_, i) =>
      (1 + a.timedSlack) *
      takeHome(spine, {
        pace: 60 / a.pace.slowestGap,
        shipQuality: 1,
        tier: i + 1,
        upgrades: lateAuto,
      }).duration
  )
  return spine
}
