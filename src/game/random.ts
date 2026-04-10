// Seeded random number generator for deterministic game runs
//
// Uses Mulberry32 algorithm - fast, good distribution, tiny footprint
// All game-affecting randomness should use these functions.
// Visual-only randomness (particles, animations) can stay as Math.random()

let state = 1

/**
 * Initialize the RNG with a seed.
 * Call this at game start and after each prestige.
 */
export function seedRNG(seed: number): void {
  state = seed >>> 0 || 1
}

/**
 * Get the current seed (for saving/debugging).
 */
export function getSeed(): number {
  return state
}

/**
 * Get a random float in [0, 1) - drop-in replacement for Math.random()
 */
export function random(): number {
  state |= 0
  state = (state + 0x6d2b79f5) | 0
  let t = Math.imul(state ^ (state >>> 15), 1 | state)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/**
 * Get a random integer in [min, max] inclusive.
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min
}

/**
 * Pick a random item from an array.
 * Assumes array is non-empty.
 */
export function randomItem<T>(arr: readonly T[]): T {
  const index = randomInt(0, arr.length - 1)

  return arr[index]!
}

/**
 * Shuffle an array using Fisher-Yates algorithm.
 * Returns a new array, does not mutate the original.
 */
export function shuffle<T>(arr: readonly T[]): T[] {
  const result: T[] = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0, i)
    // Safe swap - indices are guaranteed valid
    const temp = result[i] as T
    result[i] = result[j] as T
    result[j] = temp
  }
  return result
}

/**
 * Return true with the given probability (0-1).
 */
export function chance(probability: number): boolean {
  return random() < probability
}

/**
 * Pick from weighted options. Each option has { value, weight }.
 * Higher weight = higher chance of being picked.
 */
export function weightedPick<T>(
  options: readonly { value: T; weight: number }[]
): T {
  const totalWeight = options.reduce((sum, opt) => sum + opt.weight, 0)
  let roll = random() * totalWeight
  for (const opt of options) {
    roll -= opt.weight
    if (roll <= 0) return opt.value
  }
  // Fallback to last option (should only happen due to floating point)
  const lastOption = options[options.length - 1]
  if (!lastOption) {
    throw new Error('weightedPick called with empty options array')
  }
  return lastOption.value
}
