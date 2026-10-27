// ─── The meta-layer walk ───
// The spine over successive runs: play a run, bank its take-home, buy, repeat. Plain
// arithmetic over `takeHome`; no engine. The driver's assumptions are the spine's:
//   - each run plays the unlocked tier that pays most per second, or a timed challenge the
//     walker would clear, which counts as cleared on that run;
//   - after a run it buys the option with the highest Δrate / price, a tier unlock among
//     them, and saves while that option is out of reach. It never buys a worse option meanwhile;
//   - unlocking tier 5 makes the next run the finale, a fully stable tier-5 board,
//     whatever the persona's q* (collapse-on-stable-tier-5).
// Surge stays at 0: its price is not in this pass.

import {
  NO_UPGRADES,
  deriveSpine,
  rateOf,
  referencePersona,
  takeHome,
  timedLimit,
  trackPrice,
  type Anchors,
  type Persona,
  type RunResult,
  type Spine,
  type TrackId,
  type WalkSolved,
} from '../game/spine'
import type { Upgrades } from '../game/types'

const TRACK_IDS: TrackId[] = ['comboPayout', 'comboWindow', 'autoResolve']
const MAX_RUNS = 3000

export interface WalkResult {
  /** Minute each tier unlocked, index = tier. NaN where it never did. */
  unlockMinutes: number[]
  /** Minute the finale run ends. NaN when the walk never got there. */
  finaleMinutes: number
  runs: number
  upgrades: Upgrades
  /** Upgrades owned the moment each tier unlocked, index = tier. */
  unlockUpgrades: Upgrades[]
  /** Purchases in order, for reading a walk. */
  log: string[]
}

interface BestRun extends RunResult {
  tier: number
}

function bestRun(
  spine: Spine,
  unlocked: number,
  pace: number,
  shipQuality: number,
  upgrades: Upgrades
): BestRun {
  let best: BestRun | null = null
  for (let tier = 1; tier <= unlocked; tier++) {
    const run = {
      ...takeHome(spine, {
        pace,
        shipQuality,
        tier,
        upgrades,
        unlockedTier: unlocked,
      }),
      tier,
    }
    if (!best || rateOf(run) > rateOf(best)) best = run
  }
  return best!
}

/**
 * Walk one persona at one pace to the finale. `tierPrices[L]` is the price of unlocking
 * tier L; Infinity holds a tier shut.
 */
export function walk(
  spine: Spine,
  tierPrices: number[],
  persona: Persona,
  pace: number,
  stopAtTier = 6
): WalkResult {
  const unlockMinutes = [NaN, 0, NaN, NaN, NaN, NaN]
  const upgrades: Upgrades = { ...NO_UPGRADES }
  const unlockUpgrades: Upgrades[] = [NO_UPGRADES, NO_UPGRADES]
  const cleared = new Set<number>()
  const log: string[] = []
  const q = persona.shipQuality
  let unlocked = 1
  let tokens = 0
  let seconds = 0

  for (let runs = 0; runs < MAX_RUNS; runs++) {
    if (unlocked >= stopAtTier) {
      return {
        unlockMinutes,
        finaleMinutes: NaN,
        runs,
        upgrades,
        unlockUpgrades,
        log,
      }
    }
    if (unlocked === 5) {
      const finale = takeHome(spine, {
        pace,
        shipQuality: 1,
        tier: 5,
        upgrades,
      })
      seconds += finale.duration
      return {
        unlockMinutes,
        finaleMinutes: seconds / 60,
        runs: runs + 1,
        upgrades,
        unlockUpgrades,
        log,
      }
    }

    let run: RunResult = bestRun(spine, unlocked, pace, q, upgrades)
    for (let tier = 1; tier <= unlocked; tier++) {
      if (cleared.has(tier)) continue
      const timed = takeHome(spine, {
        pace,
        shipQuality: 1,
        tier,
        upgrades,
        unlockedTier: unlocked,
      })
      if (timed.duration <= spine.timedLimits[tier - 1]!) {
        run = timed
        cleared.add(tier)
        upgrades.timed++
        log.push(`${(seconds / 60).toFixed(1)}m timed ${tier}`)
        break
      }
    }
    seconds += run.duration
    tokens += run.currency

    for (;;) {
      const current = rateOf(bestRun(spine, unlocked, pace, q, upgrades))
      let choice: {
        id: TrackId | 'tier'
        price: number
        score: number
      } | null = null
      if (unlocked < 5) {
        const price = tierPrices[unlocked + 1]!
        const gain =
          rateOf(bestRun(spine, unlocked + 1, pace, q, upgrades)) - current
        if (Number.isFinite(price) && gain > 0)
          choice = { id: 'tier', price, score: gain / price }
      }
      for (const id of TRACK_IDS) {
        const level = upgrades[id]
        if (level >= spine.anchors.tracks[id].levels) continue
        const price = trackPrice(spine, id, level)
        const next = { ...upgrades, [id]: level + 1 }
        const gain = rateOf(bestRun(spine, unlocked, pace, q, next)) - current
        if (gain > 0 && (!choice || gain / price > choice.score)) {
          choice = { id, price, score: gain / price }
        }
      }
      if (!choice || choice.price > tokens) break
      tokens -= choice.price
      if (choice.id === 'tier') {
        unlocked++
        unlockMinutes[unlocked] = seconds / 60
        unlockUpgrades[unlocked] = { ...upgrades }
      } else {
        upgrades[choice.id]++
      }
      log.push(
        `${(seconds / 60).toFixed(1)}m ${choice.id}${choice.id === 'tier' ? unlocked : upgrades[choice.id]}`
      )
    }
  }
  return {
    unlockMinutes,
    finaleMinutes: NaN,
    runs: MAX_RUNS,
    upgrades,
    unlockUpgrades,
    log,
  }
}

/**
 * Tier prices solved from the walk: each is what the reference walker has banked when the
 * schedule (`unlockMinutes`) says it unlocks that tier, solved in tier order with later
 * tiers shut. Unlocks land between runs, so a tier unlocks after the last run that ends by its minute.
 */
export function solveTierPrices(spine: Spine): number[] {
  const prices = [0, 0, Infinity, Infinity, Infinity, Infinity]
  const persona = referencePersona(spine.anchors)
  const pace = 60 / spine.referenceGap
  for (let tier = 2; tier <= 5; tier++) {
    const target = spine.anchors.unlockMinutes[tier]!
    let lo = Math.log10(spine.anchors.tokensPerReferenceRun * 0.1)
    let hi = Math.log10(spine.anchors.tokensPerReferenceRun * 1e7)
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      prices[tier] = 10 ** mid
      const at = walk(spine, prices, persona, pace, tier).unlockMinutes[tier]!
      if (Number.isNaN(at) || at > target) hi = mid
      else lo = mid
    }
    prices[tier] = 10 ** lo
  }
  return prices
}

/** Slowest over fastest time to the finale, for one persona. */
export function finaleRatio(
  spine: Spine,
  tierPrices: number[],
  persona: Persona
): number {
  const { slowestGap, fastestGap } = spine.anchors.pace
  const slow = walk(spine, tierPrices, persona, 60 / slowestGap).finaleMinutes
  const fast = walk(spine, tierPrices, persona, 60 / fastestGap).finaleMinutes
  return slow / fast
}

export interface Solved extends WalkSolved {
  tierPrices: number[]
}

const FIXED_POINT_ROUNDS = 20

/**
 * The tier prices and timed limits at one Δe. T_L is the slowest pace's clean run on tier L
 * with the upgrades the reference persona owns at that pace when it unlocks tier L+1, or at
 * the finale for tier 5. Those upgrades depend on the timed rewards the walker earned, so the
 * limits are a fixed point, iterated from the limits with no upgrades.
 */
/**
 * Six significant digits, as spine-solved.ts commits them. The solve judges candidates at
 * this precision: the ratio steps at whole purchases, so a rounding can cross a step.
 */
export function roundSolved(solved: Solved): Solved {
  const n = (x: number) => Number(x.toPrecision(6))
  return {
    comboExponentStep: n(solved.comboExponentStep),
    tierPrices: solved.tierPrices.map(n),
    timedLimits: solved.timedLimits.map(n),
  }
}

export function solveAtStep(
  anchors: Anchors,
  comboExponentStep: number
): Solved {
  const persona = referencePersona(anchors)
  const slow = 60 / anchors.pace.slowestGap
  const tiers = anchors.tiers.length
  let timedLimits: number[] = []
  const base = deriveSpine(anchors, { comboExponentStep, timedLimits })
  timedLimits = anchors.tiers.map((_, i) =>
    timedLimit(base, i + 1, NO_UPGRADES)
  )
  for (let round = 0; round < FIXED_POINT_ROUNDS; round++) {
    const spine = deriveSpine(anchors, { comboExponentStep, timedLimits })
    const tierPrices = solveTierPrices(spine)
    const run = walk(spine, tierPrices, persona, slow)
    if (Number.isNaN(run.finaleMinutes))
      throw new Error('the slowest pace never reaches the finale')
    const next = anchors.tiers.map((_, i) =>
      timedLimit(
        spine,
        i + 1,
        i + 1 < tiers ? run.unlockUpgrades[i + 2]! : run.upgrades
      )
    )
    if (next.every((t, i) => Math.abs(t - timedLimits[i]!) < 1e-9))
      return { comboExponentStep, tierPrices, timedLimits }
    timedLimits = next
  }
  throw new Error(
    `the timed limits do not settle in ${FIXED_POINT_ROUNDS} rounds at Δe = ${comboExponentStep}`
  )
}

/**
 * The values only the walk solves. Δe puts the reference persona's finale ratio at or below
 * capTarget, the cap being a ceiling, with the tier prices and timed limits re-solved at each
 * candidate. The ratio is a step function of Δe (whole runs, whole purchases) and not
 * monotone: a large step sells out the tracks and the price solve. So a scan finds the first
 * crossing, bisection refines its edge, and the solve keeps the largest Δe below it. When the
 * ratio never crosses before the fastest walker owns every combo level, the solve keeps the
 * scanned Δe with the highest ratio: skill shows as much as the combo track allows. Throws
 * when overhead alone is over the cap (board pacing reopens), or when the best ratio is under
 * capFloor (combo growth lacks the leverage).
 */
export function solveSpine(anchors: Anchors): Solved & { ratio: number } {
  const persona = referencePersona(anchors)
  const target = anchors.capTarget
  const at = (step: number) => {
    const solved = roundSolved(solveAtStep(anchors, step))
    const spine = deriveSpine(anchors, solved)
    return {
      solved,
      ratio: finaleRatio(spine, solved.tierPrices, persona),
      saturated:
        walk(spine, solved.tierPrices, persona, 60 / anchors.pace.fastestGap)
          .upgrades.comboPayout >= anchors.tracks.comboPayout.levels,
    }
  }
  const scan = 0.005
  let lo = 0
  let below = at(lo)
  if (!(below.ratio < target)) {
    throw new Error(
      `finale ratio is ${below.ratio.toFixed(2)}x with no combo growth, over the ${target}x cap: reopen board pacing`
    )
  }
  let best = below
  for (;;) {
    const next = at(lo + scan)
    if (next.ratio >= target) break
    if (next.ratio > best.ratio) best = next
    if (next.saturated) {
      if (best.ratio < anchors.capFloor) {
        throw new Error(
          `the finale ratio peaks at ${best.ratio.toFixed(2)}x before the combo track saturates, under the ${anchors.capFloor}x floor: combo growth lacks the leverage`
        )
      }
      return { ...best.solved, ratio: best.ratio }
    }
    lo += scan
    below = next
  }
  let hi = lo + scan
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2
    const probe = at(mid)
    if (probe.ratio < target) {
      lo = mid
      below = probe
    } else hi = mid
  }
  return { ...below.solved, ratio: below.ratio }
}
