# Conflict & Symlink Mechanics Redesign

> Replacing abstract version shapes with thematic, visually distinct mechanics

**Status:** Proposed
**Date:** 2024-12-29
**Related:** [VISUAL_TEACHING.md](./VISUAL_TEACHING.md) - Core visual teaching principles

---

## Problem Statement

The current version shape system (circle/square/triangle/diamond/star) has issues:

1. **Not glanceable** - Tiny shapes inside nodes are invisible with 30+ packages
2. **No spatial meaning** - Shapes don't create visual patterns
3. **Unclear causality** - Player can't see WHY a conflict occurred
4. **No interesting decisions** - Resolution is just "hold to fix"
5. **Too abstract** - "Version compatibility" doesn't communicate visually

---

## Design Goals

1. **Visible at scale** - Problems obvious even with 100+ nodes
2. **Deterministic** - Player can learn rules and predict conflicts
3. **Thematic** - Reflects real npm ecosystem tensions
4. **Decision-rich** - Resolution involves meaningful tradeoffs
5. **Teachable without text** - Visual language only

---

## New Mechanics Overview

| Mechanic | Trigger | Visual | Resolution | Decision |
|----------|---------|--------|------------|----------|
| **Conflict** | Incompatible archetypes | Red wire | Click wire → choose action | Prune vs Upgrade |
| **Symlink** | Duplicate packages | Matching glow | Drag to merge | When to optimize |

These are **separate mechanics** with different causes, visuals, and resolutions.

---

## 1. Conflicts: Wire-Based Incompatibility

### Cause: Archetype Rules

Conflicts are **deterministic**, based on real npm ecosystem tensions:

```typescript
const INCOMPATIBLE_PAIRS: [string, string][] = [
  // Framework wars (only one UI framework)
  ['react', 'angular'],
  ['react', 'vue'],
  ['vue', 'angular'],
  ['svelte', 'react'],
  ['svelte', 'vue'],

  // Legacy vs Modern (redundant functionality)
  ['moment', 'date-fns'],
  ['request', 'axios'],
  ['lodash', 'underscore'],

  // Bundler conflicts
  ['webpack', 'parcel'],
  ['webpack', 'rollup'],  // in same project

  // Test runner conflicts
  ['jest', 'mocha'],
  ['jest', 'vitest'],

  // Linter wars
  ['eslint', 'tslint'],  // deprecated but thematic
];
```

When a child package spawns, check if it conflicts with ANY ancestor in its branch. If incompatible pair exists → wire to parent becomes conflicted.

### Visual: The Wire Shows the Problem

```
HEALTHY:
[React] ────────── [Redux]     Normal wire

CONFLICT:
[React] ══⚡══⚡══ [Angular]   Red, crackling, animated
   │                  │
   └──────────────────┴── Both nodes have red pulse on border
```

**Wire conflict indicators:**
- Color: Red/orange gradient
- Animation: Electrical crackling particles along wire
- Thickness: Slightly thicker than normal
- Sound: (future) Discordant hum

**Node indicators:**
- Red pulse on border (not fill - keep fill for heat)
- Subtle shake (reuse existing conflict shake)

### Resolution: Click the Wire

Clicking a conflicted wire shows two action buttons ON the wire:

```
                 ┌───┐ ┌───┐
[React] ══⚡══⚡══│ ✕ │ │ ↻ │══ [Angular]
                 └───┘ └───┘
                   │     │
              Prune   Upgrade
```

| Button | Icon | Action | Cost | Result |
|--------|------|--------|------|--------|
| **Prune** | ✕ | Remove child + subtree | None | Lose weight, lose packages |
| **Upgrade** | ↻ | Transform child to compatible | Bandwidth | Child becomes different package |

**Prune details:**
- Removes the child package and all its descendants
- Weight decreases
- Fast, no resource cost
- "Nuclear option" - lose progress

**Upgrade details:**
- Child package morphs into a compatible alternative
- `angular` → `react-dom` (same archetype, compatible)
- `moment` → `date-fns` (modern replacement)
- Costs bandwidth (same as install cost)
- Preserves subtree (children reconnect to new package)

### Upgrade Mappings

```typescript
const UPGRADE_PATHS: Record<string, string> = {
  // When X conflicts, it can become Y
  'angular': 'react',        // or vue, based on what's in tree
  'vue': 'react',
  'moment': 'date-fns',
  'request': 'axios',
  'underscore': 'lodash',
  'parcel': 'vite',
  'mocha': 'jest',
  'tslint': 'eslint',
};
```

If no upgrade path exists, only Prune is available.

### Heat Interaction

Heat doesn't directly cause conflicts, but modifies spawn rates:

| Heat Level | Effect on Spawning |
|------------|-------------------|
| 0-30% | Mostly compatible packages spawn |
| 30-60% | Occasional conflicting archetypes |
| 60-90% | Frequent conflicts, player must manage |
| 90%+ | Chaos - conflicts everywhere |

This creates a **difficulty curve** - early game is peaceful, late game requires active conflict management.

---

## 2. Symlinks: Duplicate Deduplication

### Cause: Same Package Twice

When the same package identity appears multiple times in the tree:

```
[App]
  ├── [Lodash]           ← Instance 1
  └── [Express]
        └── [Lodash]     ← Instance 2 (duplicate!)
```

This is **realistic** - real npm trees have many duplicates.

### Visual: Matching Glow

Duplicate packages share a **colored halo** that pulses in sync:

```
[Lodash]  ◐ ◐ ◐           [Lodash]  ◐ ◐ ◐
   │                          │
   └── Cyan halo, pulsing ────┘

   ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
   Faint dotted line hint between them
```

**Halo colors** (cycle through for multiple duplicate groups):
- Cyan
- Magenta
- Yellow
- Lime

If 3+ copies exist, all share the same halo color.

### Resolution: Drag to Merge

Player drags one duplicate onto another:

1. **Hover source** - Node lifts slightly, cursor changes
2. **Drag toward target** - Dotted line becomes solid, follows cursor
3. **Drop on target** - Merge animation
4. **Result** - One node remains, symlink wire connects old location

```
BEFORE:
[App] → [Lodash₁]
  └── [Express] → [Lodash₂]

AFTER:
[App] → [Lodash]  ←───────────┐
  └── [Express] - - - - - - - ┘  (symlink wire, dotted)
```

### Symlink Benefits

| Benefit | Amount |
|---------|--------|
| Weight reduction | -50% of duplicate's weight |
| Efficiency boost | +5% per symlink |
| Visual satisfaction | Nodes snap together |

### Auto-Symlink (Future Enhancement)

With an upgrade, symlinks happen automatically for hub packages:

```typescript
const AUTO_SYMLINK_HUBS = ['lodash', 'chalk', 'debug', 'semver'];
```

When a hub package spawns and a copy already exists, 30% chance to auto-symlink instead of creating duplicate.

---

## 3. Removing Version Shapes

### What to Remove

```typescript
// DELETE from types.ts
type VersionShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'star';

// DELETE from Package interface
version: VersionShape;

// DELETE from formulas.ts
function rollVersionShape(): VersionShape;

// DELETE from nodes.ts
drawVersionShape();
drawVersionBadge();
```

### What Replaces It

The **package icon** IS the identity. No abstract shapes needed.

| Old | New |
|-----|-----|
| Shape in node center | Package icon |
| Shape determines conflict chance | Archetype rules determine conflicts |
| Shape badge in corner | Nothing (icon is enough) |

### Migration

Packages without icons fall back to **archetype shapes**:

| Archetype | Fallback Visual |
|-----------|-----------------|
| utility | Small circle |
| framework | Hexagon |
| tooling | Gear/cog |
| legacy | Warning triangle |
| runtime | Square |

These are larger and more distinct than the old version shapes.

---

## 4. Visual Teaching (No Text)

Follows principles from [VISUAL_TEACHING.md](./VISUAL_TEACHING.md):
- **Never steal camera** - No forced pans or zoom changes
- **Show, don't tell** - Mechanics teach through feedback loops
- **Progressive disclosure** - Reveal as relevant
- **Edge indicators** - Off-screen events shown at viewport boundaries

---

### Teaching Conflicts

#### First Conflict Special Treatment

When the FIRST conflict spawns (one-time tutorial):

```
t=0ms:     Conflict wire appears
t=0-200:   Screen edge flash (brief red vignette on ALL edges)
t=200:     Non-conflict nodes dim to 0.6 opacity
t=200-500: Wire pulses 3× with increasing brightness
t=500+:    Empty action hint appears on wire (faint ✕ and ↻ outlines)
```

**Key: NO camera movement.** Player discovers conflict by:
1. Edge vignette draws attention
2. If off-screen: Red arrow at screen edge points toward conflict
3. Dimmed nodes create contrast with bright conflict wire

#### Off-Screen Conflict Indicators

```
┌────────────────────────────────────┐
│                                    │
│        [visible viewport]          │
│                                    │
│                                ◀── │ Red pulsing arrow
│                                    │   + red edge vignette
│                                    │
└────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Arrow color | Red (#ff5a5a) |
| Arrow size | 20px |
| Pulse rate | Fast (0.3s cycle) |
| Vignette | Red gradient, 15% opacity, affected edge only |
| Persistence | Until resolved OR player views it |

#### Wire Hover States

```
Normal wire:        [Node] ─────────── [Node]   (gray)

Conflict wire:      [Node] ══⚡══⚡══ [Node]     (red, crackling)

Conflict hovered:   [Node] ══[✕][↻]══ [Node]   (buttons appear ON wire)
```

Buttons fade in over 200ms when wire is hovered. This teaches "click here" without text.

#### Resolution Feedback

```
t=0:       Player clicks ✕ or ↻
t=0-100:   Button scales up (selected feedback)
t=100-300: Wire color transitions red → green
t=300-500: Success particle burst along wire
t=500:     Pruned nodes fade out OR upgraded node morphs
t=600:     Dimmed nodes restore to full opacity
t=600-1100: Brief "calm period" - no new conflicts spawn
```

#### Subsequent Conflicts

After first conflict, reduce tutorial intensity:
- NO edge vignette (unless off-screen)
- NO node dimming
- Edge arrow still appears if off-screen
- Wire still pulses to draw attention

---

### Teaching Symlinks

#### First Duplicate Special Treatment

When first duplicate package spawns:

```
t=0:       Second copy of package appears
t=0-500:   Both copies pulse with SAME color halo (3×)
t=500:     Faint dotted "ghost line" draws between them
t=1000+:   Halos continue subtle sync pulse
```

**Key: This is passive teaching.** No dimming, no urgency. Player discovers naturally.

#### Glow Hierarchy for Duplicates

Uses the three-tier glow system from VISUAL_TEACHING.md:

| Glow State | Meaning | Visual |
|------------|---------|--------|
| **Matching halo** | Symlink opportunity | Cyan/magenta halo, synced pulse |
| **Ghost line** | Hint to connect | Dotted line between duplicates |
| **No glow** | Unique package | Normal rendering |

Multiple duplicate groups get different halo colors:
- Group 1: Cyan
- Group 2: Magenta
- Group 3: Yellow
- Group 4: Lime

#### Drag Interaction Teaching

```
Idle:           [Lodash]◐        [Lodash]◐
                    └─ ─ ─ ─ ─ ─ ─ ┘  (ghost line hint)

Hover source:   [Lodash]◐ ←cursor    [Lodash]◐
                Node lifts slightly (scale 1.08×)
                Cursor changes to "grab" icon

Dragging:       [Lodash]◐ ─────────→ [Lodash]◐
                Solid line follows cursor
                Target node pulses brighter

Drop success:   [Lodash]◐ ═══════════ ┘
                Duplicate fades out (scale 1→0)
                Symlink wire snaps into place
                Efficiency stat bumps up (HUD feedback)
```

#### If Symlink Ignored

No punishment - just missed optimization:
- Halos persist but become subtle (0.2 alpha)
- Ghost line fades after 10 seconds
- Efficiency stat reflects duplicates (lower number)
- Player can always symlink later

---

### Edge Indicators Summary

| Event | Arrow Color | Size | Duration | Edge Vignette |
|-------|-------------|------|----------|---------------|
| Conflict (first) | Red | 20px | Until resolved | Yes (all edges) |
| Conflict (subsequent) | Red | 20px | Until resolved/viewed | Yes (affected edge) |
| Symlink opportunity | Cyan | 12px | 5s then fade | No |
| Prestige ready | Purple | 24px | Persistent | Subtle purple |

---

### Progressive Disclosure

| Trigger | Element Revealed |
|---------|------------------|
| First conflict | Wire action buttons (✕ ↻) |
| First duplicate | Ghost line hint |
| 8+ packages | Efficiency stat in HUD |
| First symlink created | "Symlink count" in stats |

Elements that don't exist yet appear with:
1. Scale 0.5 → 1.0 (bounce ease)
2. Brief glow halo (0.5s)
3. Settle to normal

---

## 5. Implementation Phases

### Phase 1: Remove Old System
- [ ] Delete VersionShape type and all references
- [ ] Remove shape rendering from nodes
- [ ] Remove shape-based conflict logic
- [ ] Clean up formulas.ts

### Phase 2: Wire Conflicts
- [ ] Add Wire.conflicted state
- [ ] Add incompatibility rules to registry
- [ ] Check for conflicts on package spawn
- [ ] Render conflicted wires (red, crackling)
- [ ] Add click detection on wires
- [ ] Render action buttons on wire click
- [ ] Implement Prune action
- [ ] Implement Upgrade action with mappings

### Phase 3: Symlink System
- [ ] Detect duplicate packages (same identity)
- [ ] Render matching halos on duplicates
- [ ] Add drag-to-merge interaction
- [ ] Implement merge logic (remove dupe, create symlink wire)
- [ ] Update efficiency calculation

### Phase 4: Polish
- [ ] Conflict wire particle effects
- [ ] Symlink merge animation
- [ ] Camera auto-pan to first conflict
- [ ] Halo color cycling for multiple duplicate groups
- [ ] Sound effects (future)

---

## 6. Balance Considerations

### Conflict Frequency

| Game Phase | Packages | Conflicts Expected |
|------------|----------|-------------------|
| Early (0-20) | Learning | 0-1 (tutorial) |
| Mid (20-100) | Growing | 2-5 active |
| Late (100-500) | Managing | 5-15 active |
| Prestige (500+) | Chaos | Many, triggers prestige |

### Symlink Frequency

Duplicates should appear organically from hub packages:

| Hub Package | Spawn Rate | Expected Copies |
|-------------|------------|-----------------|
| lodash | 15% of spawns | 3-8 in typical run |
| chalk | 10% | 2-5 |
| debug | 10% | 2-5 |
| semver | 5% | 1-3 |

### Resolution Costs

| Action | Cost | Time |
|--------|------|------|
| Prune | Free | Instant |
| Upgrade | 2x install cost | 1 second animation |
| Symlink | Free | Drag duration |

Prune is free but costly (lose packages). Upgrade preserves progress but costs bandwidth. Symlink is pure optimization win.

---

## 7. Open Questions

1. **Should conflicts block subtree growth?**
   - Option A: Yes, children of conflicted packages don't spawn
   - Option B: No, conflicts are just inefficiency (current behavior)

2. **Can conflicts cascade?**
   - If upgrading creates a new conflict, what happens?
   - Probably: Just show new conflict, don't chain

3. **Symlink limit?**
   - Can a package be symlinked to multiple locations?
   - Probably: Yes, one "real" node with many symlink wires

4. **Visual priority?**
   - If a node is both conflicted AND a symlink candidate, which shows?
   - Probably: Conflict takes priority (more urgent)

---

## 8. Accessibility Considerations

### Reduced Motion Mode

Respect `prefers-reduced-motion` OS setting:

```typescript
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;
```

| Effect | Normal | Reduced Motion |
|--------|--------|----------------|
| Wire crackling | Animated particles | Static red color |
| Halo pulse | Oscillating alpha | Steady glow |
| Ghost line | Animated dashes | Static dashed line |
| Resolution burst | Particle explosion | Brief color flash |
| Node dimming | Animated fade | Instant opacity change |

**Always keep:** Color state changes, edge arrows (static), action buttons.

### Color Independence

Don't rely on color alone - pair with shape/animation:

| State | Color | Secondary Indicator |
|-------|-------|---------------------|
| Conflict wire | Red | Crackling animation + thickness |
| Symlink opportunity | Cyan halo | Synced pulse timing |
| Action button ✕ | Red tint | X shape |
| Action button ↻ | Green tint | Circular arrow shape |

### Colorblind Considerations

Current palette may need testing:

| Concern | Affected | Mitigation |
|---------|----------|------------|
| Red/green | Conflict vs success | Use brightness difference, add patterns |
| Blue/purple | Symlink vs prestige | Different pulse rates |

Consider alternative high-contrast palette option.

---

## 9. Timing Guidelines

Based on flow research from VISUAL_TEACHING.md.

### Conflict Timing

| Phase | Expected Timing | Player State |
|-------|-----------------|--------------|
| First conflict appears | 60-90s into game | Learning |
| Player notices (edge indicator) | +2-5s | Attention drawn |
| Player resolves | +5-15s | Mastering mechanic |
| Calm period after | 0.5s | Breathing room |

### Symlink Timing

| Phase | Expected Timing | Player State |
|-------|-----------------|--------------|
| First duplicate spawns | 45-60s (hub package) | Passive awareness |
| Player notices halo | Variable | Optional discovery |
| Player symlinks | Variable | Optimization mindset |

**Key difference:** Conflicts are URGENT (block progress feel). Symlinks are OPTIONAL (optimization feel).

### Animation Durations

| Animation | Duration | Easing |
|-----------|----------|--------|
| Wire conflict appear | 300ms | Ease-out |
| Action buttons fade in | 200ms | Ease-in |
| Resolution transition | 500ms | Ease-in-out |
| Node prune fade | 400ms | Ease-in |
| Node upgrade morph | 600ms | Bounce |
| Symlink merge | 500ms | Ease-out |
| Halo pulse cycle | 1500ms | Sine wave |
| Ghost line draw | 800ms | Ease-out |

### Cooldown Periods

| Event | Cooldown | Purpose |
|-------|----------|---------|
| After conflict resolved | 500ms | Breathing room |
| Between conflict spawns | 2-5s minimum | Prevent overwhelm |
| After symlink created | None | Encourage chaining |

---

## 10. Testing Checklist

### First-Time Player Verification

Watch new players (no hints) and verify:

- [ ] Player notices first conflict within 10s of spawn (edge indicator works)
- [ ] Player discovers wire click within 30s (hover affordance works)
- [ ] Player understands Prune vs Upgrade difference (icons clear)
- [ ] Player notices duplicate halos within first occurrence
- [ ] Player attempts drag-to-symlink within 2 minutes of seeing hint

### Visual Clarity at Scale

- [ ] Conflict wires visible with 50+ packages
- [ ] Symlink halos distinguishable with 3+ duplicate groups
- [ ] Edge arrows don't overlap with 5+ off-screen events
- [ ] Action buttons readable at all zoom levels

### Failure Indicators

- Clicking nodes instead of wires for conflicts
- Not noticing off-screen conflicts
- Confusion about what ✕ vs ↻ do
- Never discovering symlink mechanic
- "What do I do?" questions

---

*Document Version: 1.1*
*Updated: Added visual teaching alignment, accessibility, timing*
*Status: Ready for Implementation Review*
