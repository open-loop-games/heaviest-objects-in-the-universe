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
  rateOf,
  referencePersona,
  takeHome,
  trackPrice,
  type Persona,
  type RunResult,
  type Spine,
  type TrackId,
  type Upgrades,
} from '../game/spine'

const TRACK_IDS: TrackId[] = [
  'comboPayout',
  'flat',
  'comboWindow',
  'autoResolve',
]
const MAX_RUNS = 3000

export interface WalkResult {
  /** Minute each tier unlocked, index = tier. NaN where it never did. */
  unlockMinutes: number[]
  /** Minute the finale run ends. NaN when the walk never got there. */
  finaleMinutes: number
  runs: number
  upgrades: Upgrades
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
      ...takeHome(spine, { pace, shipQuality, tier, upgrades }),
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
  const cleared = new Set<number>()
  const log: string[] = []
  const q = persona.shipQuality
  let unlocked = 1
  let tokens = 0
  let seconds = 0

  for (let runs = 0; runs < MAX_RUNS; runs++) {
    if (unlocked >= stopAtTier) {
      return { unlockMinutes, finaleMinutes: NaN, runs, upgrades, log }
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
        log,
      }
    }

    let run: RunResult = bestRun(spine, unlocked, pace, q, upgrades)
    for (let tier = 1; tier <= unlocked; tier++) {
      if (cleared.has(tier)) continue
      const timed = takeHome(spine, { pace, shipQuality: 1, tier, upgrades })
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
      } else {
        upgrades[choice.id]++
      }
      log.push(
        `${(seconds / 60).toFixed(1)}m ${choice.id}${choice.id === 'tier' ? unlocked : upgrades[choice.id]}`
      )
    }
  }
  return { unlockMinutes, finaleMinutes: NaN, runs: MAX_RUNS, upgrades, log }
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
