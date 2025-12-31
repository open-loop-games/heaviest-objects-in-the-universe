# Prestige Progression System

> Expanding cache token utility: compression chance scaling, depth unlocks, and automation.

## Overview

Currently, cache tokens (prestige currency) only provide +10% bandwidth regen per token. This document describes a richer progression system that ties cache tokens to:

1. **Compression chance** - More packages can be "zoomed into"
2. **Ecosystem tier** - Unlocks deeper layers and automation
3. **Automation** - Auto-resolve conflicts, auto-dedup duplicates

**Design principle:** As complexity increases (more depth, more compressed packages), automation scales to keep toil manageable.

---

## Current State

| Feature | Current Implementation | Location |
|---------|----------------------|----------|
| Cache Tokens | +10% bandwidth regen each | `upgrades.ts:115` |
| Ecosystem Tier | Stuck at 1, never incremented | `config.ts:49` |
| Max Depth | Hardcoded constant = 1 | `cascade.ts:45` |
| Compression Chance | Flat 25% | `cascade.ts:44` |
| Automation | Does not exist | `loop.ts:197` |
| Render Layers | Already 3 (bg/mid/fg) | `renderer.ts:94-134` |

---

## Design Decisions

### 1. Cache Tokens → Compression Chance

**Formula:**
- Base: 25%
- +1% per cache token
- Softcap at 50% (25 tokens)
- Hardcap at 60% (asymptotic)

```
chance = 0.25 + tokens * 0.01           (if ≤ 50%)
chance = 0.50 + 0.10 * (1 - e^(-overflow/75))  (pushing toward 60%)
```

| Tokens | Compression Chance |
|--------|-------------------|
| 0 | 25% |
| 10 | 35% |
| 25 | 50% (softcap) |
| 50 | ~54% |
| 100 | ~59% |
| 150+ | ~60% (hardcap) |

### 2. Cache Tokens → Ecosystem Tier

Tier is derived from cache token count (not tracked separately):

| Tier | Tokens Required | Unlocks |
|------|-----------------|---------|
| 1 | 0 | Base game |
| 2 | 9 | Depth 2, auto-resolve |
| 3 | 21 | Depth 3, auto-dedup |
| 4 | 42 | Depth 4, faster automation |
| 5 | 63 | Depth 5, maximum automation |

### 3. Ecosystem Tier → Max Depth

Direct mapping: tier N allows depth N.

| Tier | Max Depth | Deepest Layer |
|------|-----------|---------------|
| 1 | 1 | Layer 1 only |
| 2 | 2 | Layer 2 |
| 3 | 3 | Layer 3 |
| 4 | 4 | Layer 4 |
| 5 | 5 | Layer 5 |

### 4. Compression Tapering by Depth

To prevent exponential node explosion, compression chance decreases at deeper levels:

| Depth | Multiplier | At 60% Base |
|-------|------------|-------------|
| 1 | 100% | 60% |
| 2 | 75% | 45% |
| 3 | 50% | 30% |
| 4 | 25% | 15% |
| 5 | 0% | 0% (all leaves) |

**Rationale:** Depth 5 is always terminal (no layer 6). This keeps trees finite and performance bounded.

### 5. Automation Rates by Tier

| Tier | Auto-Resolve | Auto-Dedup |
|------|--------------|------------|
| 1 | — | — |
| 2 | 1 per 3s | — |
| 3 | 1 per 2s | 1 per 3s |
| 4 | 1 per 1s | 1 per 2s |
| 5 | 2 per 1s | 1 per 1s |

**Processing time:** 400ms gear spin before completion (visual feedback).

### 6. Automation Visual Feedback

- **Gear icon** in HUD (visible at tier 2+)
- **Spinning** while processing
- **Juice flash** on completion (radial burst)
- **Wire/node effect** at the resolved/merged target

---

## Technical Specification

### State Changes

```typescript
// types.ts - Add to MetaResources or create new interface
interface AutomationState {
  resolveActive: boolean
  dedupActive: boolean
  resolveTargetWireId: string | null
  dedupTargetPair: [string, string] | null
  processStartTime: number
}

// GameState addition
automation: AutomationState
```

### New Functions

```typescript
// config.ts or state.ts
const TIER_THRESHOLDS = [0, 9, 21, 42, 63]

export function getEcosystemTier(cacheTokens: number): number {
  for (let tier = 5; tier >= 1; tier--) {
    if (cacheTokens >= TIER_THRESHOLDS[tier - 1]) return tier
  }
  return 1
}

export function getMaxCompressedDepth(): number {
  return getEcosystemTier(gameState.meta.cacheTokens)
}
```

```typescript
// cascade.ts
const BASE_COMPRESSION = 0.25
const COMPRESSION_PER_TOKEN = 0.01
const COMPRESSION_SOFTCAP = 0.50
const COMPRESSION_HARDCAP = 0.60
const DEPTH_COMPRESSION_MULT = [1.0, 0.75, 0.50, 0.25, 0.0]

export function getCompressionChance(depth: number): number {
  if (depth >= 5) return 0

  const tokens = gameState.meta.cacheTokens

  // Base with soft/hard cap
  let base = BASE_COMPRESSION + tokens * COMPRESSION_PER_TOKEN
  if (base > COMPRESSION_SOFTCAP) {
    const overflow = tokens - 25
    const push = 0.10 * (1 - Math.exp(-overflow / 75))
    base = Math.min(COMPRESSION_HARDCAP, COMPRESSION_SOFTCAP + push)
  }

  // Depth taper
  const depthMult = DEPTH_COMPRESSION_MULT[depth - 1] ?? 0
  return base * depthMult
}
```

```typescript
// automation.ts (new file)
const RESOLVE_INTERVALS = [Infinity, 3000, 2000, 1000, 500]
const DEDUP_INTERVALS = [Infinity, Infinity, 3000, 2000, 1000]
const PROCESS_DURATION = 400

export function updateAutomation(now: number): void {
  const tier = getEcosystemTier(gameState.meta.cacheTokens)

  // Auto-resolve logic
  if (tier >= 2) {
    updateAutoResolve(now, RESOLVE_INTERVALS[tier])
  }

  // Auto-dedup logic
  if (tier >= 3) {
    updateAutoDedup(now, DEDUP_INTERVALS[tier])
  }
}

function updateAutoResolve(now: number, interval: number): void {
  const auto = gameState.automation

  // Start new resolve if idle and interval passed
  if (!auto.resolveActive && now - lastResolveTime >= interval) {
    const wire = findFirstConflictedWire()
    if (wire) {
      auto.resolveActive = true
      auto.resolveTargetWireId = wire.id
      auto.processStartTime = now
    }
    lastResolveTime = now
  }

  // Complete if processing duration elapsed
  if (auto.resolveActive) {
    if (now - auto.processStartTime >= PROCESS_DURATION) {
      completeAutoResolve()
    }
  }
}

function completeAutoResolve(): void {
  const wireId = gameState.automation.resolveTargetWireId
  if (wireId) {
    resolveWireConflict(wireId)
    spawnAutoCompleteEffect(getWireCenter(wireId), 'resolve')
  }
  gameState.automation.resolveActive = false
  gameState.automation.resolveTargetWireId = null
}

// Similar pattern for updateAutoDedup / completeAutoDedup
```

### Render Layer Culling

Already implemented - only 3 layers rendered regardless of depth:

- Foreground: current scope (100% alpha)
- Midground: parent scope (20% alpha, blurred)
- Background: grandparent scope (12% alpha, more blur)

At depth 5: layers 1-2 are culled, only 3-4-5 visible.

---

## Implementation Phases

### Phase 1: Tier System ✓
- [x] Add `getEcosystemTier()` function
- [x] Update `ecosystemTier` to be derived (computed) from `cacheTokens`
- [x] Add tier thresholds constant `TIER_THRESHOLDS`
- [x] Update prestige to recalculate tier after adding tokens
- [x] Verify existing tier-dependent code still works (package pool selection)

### Phase 2: Dynamic Compression ✓
- [x] Add `getCompressionChance(depth)` function with softcap/hardcap logic
- [x] Add depth tapering multipliers
- [x] Replace `COMPRESSED_CHANCE` constant usage in `cascade.ts`
- [x] Replace `MAX_COMPRESSED_DEPTH` constant with `getMaxCompressedDepth()`
- [x] Test compression at various token counts and depths

### Phase 3: Automation State ✓
- [x] Add `AutomationState` interface to types
- [x] Add `automation` to `GameState`
- [x] Add initial automation state to `createInitialState()`
- [x] Reset automation state on prestige

### Phase 4: Automation Logic ✓
- [x] Create `automation.ts` module
- [x] Implement `findFirstConflictedWire()` - scope-aware conflict finder
- [x] Implement `findFirstDuplicatePair()` - scope-aware duplicate finder
- [x] Implement `updateAutoResolve()` with timer logic
- [x] Implement `updateAutoDedup()` with timer logic
- [x] Integrate `updateAutomation()` into game loop
- [x] Test automation at each tier

### Phase 5: Automation Visuals - HUD ✓
- [x] Add gear icon to HUD (visible when tier >= 2)
- [x] Add spinning animation class
- [x] Connect spinning state to `automation.resolveActive || automation.dedupActive`
- [x] Add completion flash effect
- [x] Position in HUD layout (near other resource indicators)

### Phase 6: Automation Visuals - World ✓
- [x] Add `spawnAutoCompleteEffect()` to effects renderer
- [x] Create particle burst for resolve completion (green-ish)
- [x] Create particle burst for dedup completion (cyan-ish)
- [x] Trigger effects at wire center / merged node position

### Phase 7: Polish & Balance ✓
- [x] Add tier-up celebration effect (when crossing threshold)
- [x] Update HUD to show current tier visually (dots or pips)
- [ ] Tune tier thresholds based on playtest
- [ ] Tune automation intervals
- [ ] Tune compression softcap/hardcap curve
- [ ] Tune depth tapering multipliers

---

## Testing Checklist

### Tier Progression
- [ ] Tier 1 at 0 tokens
- [ ] Tier 2 at 9 tokens
- [ ] Tier 3 at 21 tokens
- [ ] Tier 4 at 42 tokens
- [ ] Tier 5 at 63 tokens
- [ ] Tier persists through save/load

### Compression
- [ ] 25% at 0 tokens, depth 1
- [ ] 35% at 10 tokens, depth 1
- [ ] 50% at 25 tokens, depth 1 (softcap)
- [ ] ~59% at 100 tokens, depth 1
- [ ] Depth 2 = 75% of base
- [ ] Depth 5 = 0% always

### Depth Unlocks
- [ ] Tier 1: cannot enter depth 2
- [ ] Tier 2: can enter depth 2, not 3
- [ ] Tier 5: can enter depth 5
- [ ] Depth 5 packages are always leaves (no internal scope)

### Automation
- [ ] Tier 1: no automation
- [ ] Tier 2: auto-resolve fires, no auto-dedup
- [ ] Tier 3: both fire at expected intervals
- [ ] Gear spins during processing
- [ ] Flash on completion
- [ ] Correct wire/nodes targeted
- [ ] Works inside package scopes (not just root)

### Performance
- [ ] Depth 5 with high compression doesn't lag
- [ ] Automation doesn't cause frame drops
- [ ] Background layers properly culled

---

## Open Questions (Resolved)

| Question | Decision |
|----------|----------|
| Tier progression: prestige count vs tokens? | **Tokens** (smoother) |
| Automation visual feedback? | **Yes** - gear + flash |
| Compression at depth 5? | **0%** (all leaves) |
| Automation scope-aware? | **Yes** - works inside packages |

---

## Future Considerations

- **Tier 6+?** Could extend if game grows, but 5 feels like good cap
- **Selective automation?** Let player toggle auto-resolve vs auto-dedup
- **Automation priority?** Currently first-found; could prioritize by age or severity
- **Visual tier indicator?** Show ●●●●● pips in HUD for current tier

---

*Document Version: 1.0*
*Created: 2025-12-29*
*Status: Ready for Implementation*
