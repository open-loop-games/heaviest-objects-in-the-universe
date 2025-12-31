# Quality-First HUD Redesign

## Problem Statement

There's a fundamental tension in the current design:

| Action | Immediate Feel | Progression Effect |
|--------|----------------|-------------------|
| Install package | Weight bar goes UP ✓ | Prestige closer |
| Symlink/merge | Weight bar goes DOWN ✗ | Prestige farther |
| Hoist duplicates | Weight bar goes DOWN ✗ | Prestige farther |

**The satisfying optimization actions fight the visible progress bar.**

The game already compensates via efficiency multiplier on prestige rewards (0.5x to 1.5x), but this is:
1. Delayed (only visible at prestige time)
2. Abstract (player doesn't feel the connection)
3. Hidden (quality metrics are tucked below weight)

## Solution: Flip the Information Hierarchy

Research from incremental game analysis shows:
- **Challenge aesthetic (90%)** beats **Accumulation aesthetic (77%)**
- Players intrinsically want optimization puzzles
- "Selective juice" - celebrate quality changes, not accumulation ticks

### Design Principles

1. **Quality metrics become the hero** - largest, most prominent UI elements
2. **Weight becomes secondary** - still visible, but demoted
3. **Compound prestige progress** - efficiency directly speeds up prestige
4. **Immediate feedback** - optimization actions trigger visual celebrations

---

## Part 1: QualityHero Component

### Current Layout
```
┌─────────────────────────────────────────┐
│ BandwidthRow        (always first)      │
│ SurgeRow            (P2+)               │
│ WeightRow           (after 2 packages)  │  ← Currently HERO
│ QualityMetrics      (after 2 packages)  │  ← Tucked below, tiny
│ AutomationRow       (Tier 2+)           │
└─────────────────────────────────────────┘
```

### New Layout
```
┌─────────────────────────────────────────┐
│ ┌─────────────────────────────────────┐ │
│ │ QUALITY HERO                        │ │
│ │ ⚡ [████████████████████] ▲▲       │ │  ← Efficiency LARGE
│ │    [●][●][●][○][○] tier pips       │ │
│ │ ✓ [████████████████] ● stable      │ │  ← Stability LARGE
│ │    scope dots: ●●●○               │ │
│ └─────────────────────────────────────┘ │
│ ─────────────────────────────────────── │
│ BandwidthRow                            │
│ SurgeRow            (P2+)               │
│ ◆ [████] ●●○○       (weight, small)    │  ← Demoted
│ AutomationRow       (Tier 2+)           │
└─────────────────────────────────────────┘
```

### Efficiency Tiers (Visual Thresholds)

| Range | Tier | Color | Pip State |
|-------|------|-------|-----------|
| 0-30% | Bloated | Red | [○][○][○][○][○] |
| 30-50% | Messy | Orange | [●][○][○][○][○] |
| 50-70% | Decent | Yellow-green | [●][●][○][○][○] |
| 70-85% | Clean | Green | [●][●][●][○][○] |
| 85-100% | Pristine | Cyan glow | [●][●][●][●][●] |

Tier-up triggers celebration animation.

### Stability Scope Dots

Show entered scopes as dots:
- `●` = stable scope
- `○` = unstable scope (has conflicts or duplicates)

Example: `●●○●` = 3/4 scopes stable

### Multiplier Preview

Show prestige impact without numbers:
- `▼` = efficiency below 50% (penalty)
- `▲` = efficiency 50-80% (bonus)
- `▲▲` = efficiency 80%+ (excellent bonus)

---

## Part 2: Selective Juice System

### Event Types

```typescript
type QualityEvent =
  | { type: 'efficiency-improved'; delta: number; newTier: EfficiencyTier }
  | { type: 'efficiency-tier-up'; oldTier: EfficiencyTier; newTier: EfficiencyTier }
  | { type: 'symlink-merge'; weightSaved: number; position: {x, y} }
  | { type: 'scope-stabilized'; scopeId: string; packageCount: number }
  | { type: 'conflict-resolved'; position: {x, y} }
```

### Event Sources

| Action | Event Emitted | Location |
|--------|---------------|----------|
| Symlink merge | `symlink-merge` | `symlinks.ts:performSymlinkMerge()` |
| Efficiency recalc | `efficiency-improved` | `loop.ts` (per-frame) |
| Tier threshold crossed | `efficiency-tier-up` | `loop.ts` |
| Scope becomes stable | `scope-stabilized` | `packages.ts:recalculateInternalState()` |
| Wire conflict resolved | `conflict-resolved` | `packages.ts` or conflict handler |

### UI Responses

| Event | Visual Response |
|-------|-----------------|
| `symlink-merge` | Efficiency bar pulses cyan, brief glow |
| `efficiency-tier-up` | Tier pip fills with burst animation, bar flashes |
| `scope-stabilized` | Stability dot fills green, scope indicator pulses |
| `efficiency-improved` | Subtle bar shimmer (not every frame, debounced) |

### Animation Specs

```css
/* Efficiency bar pulse on merge */
@keyframes efficiency-pulse {
  0% { filter: brightness(1); }
  50% { filter: brightness(1.5); box-shadow: 0 0 20px rgba(90, 255, 255, 0.8); }
  100% { filter: brightness(1); }
}

/* Tier pip fill celebration */
@keyframes pip-fill-burst {
  0% { transform: scale(0.5); opacity: 0; background: transparent; }
  40% { transform: scale(1.4); background: currentColor; }
  100% { transform: scale(1); opacity: 1; }
}

/* Tier-up flash */
@keyframes tier-up-flash {
  0% { filter: brightness(1); }
  30% { filter: brightness(2); transform: scale(1.05); }
  100% { filter: brightness(1); transform: scale(1); }
}

/* Stability dot stabilize */
@keyframes dot-stabilize {
  0% { background: var(--unstable-color); }
  50% { transform: scale(1.3); background: var(--stable-color); box-shadow: 0 0 12px var(--stable-color); }
  100% { transform: scale(1); }
}
```

---

## Part 3: Compound Prestige Progress

### Current Formula

```typescript
// state.ts line 51
computed_gravity = weight / threshold
```

Efficiency only affects **reward** at prestige time, not progress.

### New Formula

```typescript
/**
 * Compound gravity: weight progress boosted by efficiency
 *
 * At 0% efficiency:   0.7x progress speed (bloat penalty)
 * At 50% efficiency:  1.0x progress speed (neutral)
 * At 100% efficiency: 1.3x progress speed (optimization reward)
 */
computed_gravity = (weight / threshold) × (0.7 + efficiency × 0.6)
```

### Impact

| Efficiency | Progress Multiplier | Time to Prestige |
|------------|--------------------:|------------------|
| 0% | 0.7x | +43% slower |
| 50% | 1.0x | baseline |
| 100% | 1.3x | -23% faster |

### Visual Communication

Since we can't use numbers, the relationship is shown through:

1. **Weight bar** - shows raw weight accumulation (secondary)
2. **Prestige orbit** - shows compound progress via orbit collapse speed
3. **Quality arcs in PrestigeOrbit** - efficiency/stability directly visible around singularity

Gap between weight bar fill and orbit collapse rate = efficiency boost.

### Reward Formula (unchanged)

Efficiency still multiplies reward at prestige time:
```typescript
efficiencyMultiplier = 0.5 + efficiency  // 0.5x to 1.5x
stabilityBonus = 0.7 + stability × 0.3   // 0.7x to 1.0x
reward = floor(baseReward × efficiencyMultiplier × stabilityBonus)
```

So efficiency matters TWICE:
1. **Progress speed** - reach prestige faster
2. **Reward amount** - get more tokens

Strong incentive to optimize.

---

## Implementation Checklist

### New Files
- [ ] `src/game/events.ts` - Quality event pub/sub system
- [ ] `src/components/hud/QualityHero.vue` - Hero quality display

### Modified Files
- [ ] `src/components/HUD.vue` - Reorder components, add QualityHero
- [ ] `src/components/hud/WeightRow.vue` - Shrink, demote to secondary
- [ ] `src/components/hud/QualityMetrics.vue` - Keep for PrestigeOrbit or delete
- [ ] `src/game/state.ts` - Compound gravity formula
- [ ] `src/game/formulas.ts` - Add efficiency tier calculation
- [ ] `src/game/symlinks.ts` - Emit merge events
- [ ] `src/game/loop.ts` - Track efficiency changes, emit tier-up events
- [ ] `src/game/packages.ts` - Emit scope stabilization events

### Testing Scenarios

1. **First package installed** - QualityHero should appear with 100% efficiency
2. **Duplicates appear** - Efficiency drops, tier pips update, warning state
3. **Symlink merge** - Efficiency bar pulses, tier may increase
4. **Scope stabilized** - Stability dot fills, possible celebration
5. **Efficiency tier-up** - Pip fills with burst, bar flashes
6. **Prestige approach** - Compound progress visible in orbit collapse speed
7. **Low efficiency prestige** - Orbit collapses slower despite weight threshold met

---

## Design Rationale

### Why Compound Progress?

The original design has efficiency affect reward, not progress. This creates:
- Delayed feedback (only visible at prestige)
- Disconnect between action and result
- "Weight goes down" still feels bad in the moment

Compound progress means:
- Symlink merge → efficiency up → orbit speeds up → IMMEDIATE feedback
- Player sees the connection between optimization and progress
- Weight reduction is offset by progress speed boost

### Why Keep Efficiency in Reward Too?

Double-dipping creates strong incentive:
- Progress: 1.3x faster at 100% vs 0.7x at 0% = 1.86x difference
- Reward: 1.5x at 100% vs 0.5x at 0% = 3x difference
- Combined: optimized player gets ~5.6x more tokens per hour

This matches research finding that Challenge aesthetic dominates.

### Why Visual Tiers?

Discrete tiers (Bloated → Messy → Decent → Clean → Pristine) create:
- Clear goals ("get to next tier")
- Celebration moments (tier-up)
- Easier to communicate without numbers
- "One more optimization" compulsion loop

### Why Demote Weight?

Weight is accumulation; efficiency is challenge. Research shows:
- 90% of incrementals create Challenge aesthetic
- Challenge beats Accumulation when explicit
- Players derive more satisfaction from optimization puzzles

Weight still exists, still matters, but it's not the hero metric.

---

## Future Considerations

### Potential Enhancements
- Efficiency history graph (sparkline showing recent trend)
- "Optimization streak" bonus for consecutive tier-ups
- Sound design for tier-ups and stabilization
- Particle effects for merge/stabilize actions

### Balance Tuning
- Compound progress multiplier range (currently 0.7x to 1.3x)
- Tier thresholds (currently 30/50/70/85%)
- Event debouncing (how often to trigger visual feedback)

### Accessibility
- Color-blind modes for tier indicators
- Reduced motion option for celebrations
- High contrast mode for bar fills
