# Momentum Loop System

## Overview

The momentum loop replaces passive bandwidth regeneration with activity-driven generation. This creates a positive feedback loop where good play rewards players with more energy to play.

**Core Philosophy:** Bandwidth should *reward* the satisfying cascade flow, not interrupt it.

## Design Principles

From incremental game research:

1. **Positive Feedback Loop**: Activity generates BW → enables more activity
2. **Oscillating Rhythm**: 30-60s beats between abundance and scarcity
3. **Decisions = Content**: Trade-offs between manual play (+BW) vs automation (-BW)
4. **Activity-Dominant**: 70-80% of BW from activity, 20-30% from passive safety regen

## Generation Events

| Action | Base BW | Tier Scaling | Notes |
|--------|---------|--------------|-------|
| Package resolves | +4 | × tier | Per package that completes install |
| Conflict resolved (manual) | +15 | × tier | Click wire to resolve |
| Symlink merged | +20 | × tier | Drag-merge duplicates |
| Scope stabilized | +50 + 5×pkgCount | × tier | Burst when scope becomes stable |
| Golden package spawns | +8 | - | Depth reward bonus |
| Cache fragment collected | +5 | - | Minor bonus |

### Tier Multipliers

| Tier | Multiplier | Context |
|------|------------|---------|
| 1 | 1.0× | Baseline |
| 2 | 1.3× | Automation unlocked |
| 3 | 1.6× | Deeper scopes |
| 4 | 2.0× | Complex cascades |
| 5 | 2.5× | Endgame |

## Spending

| Action | Cost | Notes |
|--------|------|-------|
| Install top-level package | 25 × tier × 1.15^activeScopes | Entry gate to cascade |
| Cascade spawns | FREE | Removed - cascades flow uninterrupted |
| Auto-resolve (per conflict) | 8 BW fixed | Convenience cost |
| Auto-hoist (per hoist) | 12 BW fixed | Convenience cost |

### Automation Trade-off

Manual vs automated play creates meaningful decisions:

- Manual conflict resolve: **+15 BW** (reward)
- Auto-resolve: **-8 BW** (cost)
- Net difference: **23 BW per conflict**

Players choose: Engage for rewards, or pay for convenience.

## Passive Safety Regen

Minimal passive regen prevents soft-locks but doesn't drive gameplay:

| Tier | Regen | Purpose |
|------|-------|---------|
| 1 | 2 BW/sec | Safety net |
| 2 | 2.5 BW/sec | Slight increase |
| 3 | 3 BW/sec | |
| 4 | 3.5 BW/sec | |
| 5 | 4 BW/sec | Still activity-dominant |

## Diminishing Returns

Prevents BW spam exploit via recent activity dampening:

```
Window: 5 seconds
Threshold: 100 BW generated in window
Above threshold: Generation scales down to 20% floor

Effect:
- First 100 BW in 5s: 100% generation
- 100-200 BW in 5s: ~75% generation
- 200-300 BW in 5s: ~50% generation
- 300+ BW in 5s: 20% generation (floor)
```

Creates natural burst → rest → burst rhythm.

## Upgrade Rebalancing

Lower costs for activity-dependent economy:

| Upgrade | Old Base/Mult | New Base/Mult |
|---------|---------------|---------------|
| Bandwidth | 40 / 1.6 | 25 / 1.5 |
| Efficiency | 60 / 1.8 | 40 / 1.6 |
| Surge | 80 / 1.5 | 50 / 1.4 |
| Resolve Speed | 50 / 1.7 | 35 / 1.5 |
| Hoist Speed | 60 / 1.8 | 45 / 1.6 |

### Bandwidth Upgrade Effect Change

Old: Increases capacity and passive regen
New: Increases capacity and **stabilization burst bonus**

```typescript
// Stabilize burst now scales with bandwidth upgrade
const burstBonus = 1 + getUpgradeLevel('bandwidth') * 0.1 // +10% per level
const stabilizeBurst = (50 + pkgCount * 5) * burstBonus
```

## Flow State Validation

Target: 30-60 second beats (optimal engagement per research)

| Phase | Duration | BW Flow | Engagement |
|-------|----------|---------|------------|
| Install | 2-5s | -25 to -100 | Active decision |
| Cascade | 15-25s | +48 (12×4) | Watch + anticipate |
| Resolve/Merge | 10-20s | +30 to +55 | Active clicks |
| Stabilize | 1-2s | +80 to +150 | Reward burst |
| **Total** | **30-55s** | **Net positive** | |

## Cascade Simulation (Tier 1)

```
Start: 225 BW (after 25 BW install)
During cascade (40s):
  - 12 packages resolve: +48 BW
  - 3 conflicts, resolve 2: +30 BW
  - 1 symlink merge: +20 BW
  - Scope stabilizes (12 pkg): +110 BW
  - Passive safety: +80 BW (2/sec × 40s)
End: 513 BW

Net gain: +288 BW per cascade cycle
```

## Automation Scenario

With automation enabled, AFK play:

```
Auto-resolve: ~8 BW every 3s = 2.67 BW/sec drain
Auto-hoist: ~12 BW every 4s = 3 BW/sec drain
Safety regen: +2 BW/sec

Net: 2 - 2.67 - 3 = -3.67 BW/sec

Time to deplete from 500 BW: ~136 seconds
Then: Automation pauses until passive refills
```

Creates check-in rhythm matching mobile/idle patterns.

## Implementation Files

- `src/game/mutations.ts` - Generation system, dampening, momentum events
- `src/game/config.ts` - Momentum constants
- `src/game/cascade.ts` - Remove spawn costs, golden/fragment generation
- `src/game/packages.ts` - Scope stabilization generation
- `src/game/automation.ts` - Fixed drain costs
- `src/game/upgrades.ts` - New cost curves, install cost formula
- `src/game/loop.ts` - Safety regen, package resolve generation

## Migration Notes

- No save migration needed (momentum state is transient)
- Existing bandwidth values carry over
- Players may notice immediate difference in flow feel
