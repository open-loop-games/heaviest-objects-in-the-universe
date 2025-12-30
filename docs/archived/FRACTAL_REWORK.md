# Fractal Rework Design

> Rethinking the core loop: explosions happen inside, 2 layers deep, hoisting to root.

**STATUS: ✓ COMPLETE** - All 8 phases implemented. See Implementation Status below.

## Overview

This document describes changes to the fractal scope system to reinforce the inception theme and improve the core gameplay loop.

**Problems with current design:**
- Explosion (the fun) happens at root; inside is cleanup (toil)
- Only 1 layer deep limits inception feeling
- Cross-package resolution feels like whack-a-mole

**Goals:**
- Move the cascade experience INSIDE packages
- Add second layer of depth (inception within inception)
- Make cross-package deduplication feel like optimization, not chores

---

## Core Loop Revision

### Current Flow (Problems)

```
ROOT: Install → explosion happens here (satisfying)
ENTER: Package populated instantly (no drama)
INSIDE: Fix conflicts/dupes (feels like cleanup)
EXIT: Done
```

### New Flow

```
ROOT: Install → "compressed" package appears (seed, no cascade)
ENTER: Cascade happens HERE (you're inside the explosion)
INSIDE: Some deps are compressed → can go deeper
LAYER 2: Enter compressed dep → smaller cascade
RESOLVE: Fix conflicts/dupes as part of the action
EXIT: Bubble back up with stable packages
```

**Key shift:** You're participating in the cascade, not cleaning up after it.

---

## Two-Layer Depth Model

### Depth Definitions

| Depth | Context | Can Enter? | Has Internal Tree? |
|-------|---------|------------|-------------------|
| 0 | Root node | N/A | No |
| 1 | Top-level packages | Yes | Yes |
| 2 | Internal deps (layer 1) | Some (compressed) | Yes |
| 3 | Internal deps (layer 2) | No | No (leaves) |

### Compressed Packages

Some internal deps at layer 1 are "compressed"—they have their own internal scope:

```
ROOT
└── express (depth 1, top-level)
    ├── body-parser (depth 2, COMPRESSED ◉)
    │   └── [internal scope with 3-5 deps]
    ├── cookie-parser (depth 2, leaf)
    ├── serve-static (depth 2, leaf)
    └── debug (depth 2, leaf)
```

**Compressed ratio:** ~20-30% of internal deps are compressed.

**Visual indicator:** Same pulsing as pristine packages (blue glow), indicating "can enter."

### Layer 2 Characteristics

- Fewer deps than layer 1 (3-5 vs 6-10)
- All deps are leaves (no layer 3)
- Smaller cascade, faster to stabilize
- Higher weight-per-dep ratio (incentive to go deep)

---

## Cascade Experience

### Entering a Package (Layer 1)

When player enters a top-level package:

```
Frame 0:     Package as "local root" centered, empty space
Frame 1-10:  First dep bursts out (particle effect)
Frame 10-20: Second dep bursts out
Frame 20-30: Third dep bursts out
...
Frame 60+:   All deps spawned, physics settling
             Conflicts/dupes become visible
             Some deps pulse (compressed)
```

**Timing:** 1-2 seconds for full cascade.

**Player agency:** Can start interacting before cascade finishes (click conflicts, plan which compressed dep to enter).

### Entering a Compressed Dep (Layer 2)

Same cascade experience but smaller:
- 3-5 deps burst out
- ~1 second cascade
- All leaves, no further depth
- Typically 0-1 conflicts, 0-1 dupes

### Cascade Spawning Logic

```typescript
// Layer 1 cascade (inside top-level package)
const LAYER_1_DEP_COUNT = { min: 6, max: 10 };
const LAYER_1_COMPRESSED_CHANCE = 0.25; // 25% of deps are compressed
const LAYER_1_SPAWN_INTERVAL = 100; // ms between each dep

// Layer 2 cascade (inside compressed dep)
const LAYER_2_DEP_COUNT = { min: 3, max: 5 };
const LAYER_2_COMPRESSED_CHANCE = 0; // No layer 3
const LAYER_2_SPAWN_INTERVAL = 80; // Faster, smaller cascade
```

---

## Scope Navigation

### State Model

```typescript
interface GameState {
  // Current view context
  currentScope: ScopeContext;

  // ... existing fields ...
}

type ScopeContext =
  | { type: 'root' }
  | { type: 'package'; packageId: string }           // Layer 1
  | { type: 'internal'; packageId: string; internalId: string }; // Layer 2
```

### Navigation Actions

| Action | From | To | Trigger |
|--------|------|-----|---------|
| Enter package | Root | Layer 1 | Click top-level package |
| Enter compressed | Layer 1 | Layer 2 | Click compressed internal dep |
| Exit to parent | Layer 2 | Layer 1 | Click back button |
| Exit to root | Layer 1 | Root | Click back button |

### Back Button Behavior

- Always visible when not at root
- Shows breadcrumb depth: `←` (layer 1) or `← ←` (layer 2)
- Click exits one level up
- Keyboard: Escape also exits

### Restrictions

- Cannot enter non-compressed deps (they're leaves)
- Cannot skip levels (must traverse through layer 1)
- Cannot enter packages during cascade (wait for settle)

---

## Scope Transition: Full Layering

### The Inception Effect

When entering a package, the outer world doesn't disappear—it **fades and freezes** in the background. You can see the "dream above" while in the "dream below." This is the core visual metaphor for inception.

### Layer Visibility

| Current Scope | Background (10% opacity) | Midground (25% opacity) | Foreground (100%) |
|---------------|-------------------------|------------------------|-------------------|
| Root | — | — | Root scope |
| Layer 1 | — | Root scope (frozen) | Package internals |
| Layer 2 | Root scope (very faint) | Layer 1 (frozen) | Compressed dep internals |

### Visual Structure

```
┌─────────────────────────────────────────────────────┐
│ BACKGROUND LAYER (10-20% opacity, frozen, blurred)  │
│                                                     │
│        [pkg1]  [pkg2]  [pkg3]                       │
│           \     |     /                             │
│            \    |    /                              │
│             [root]                                  │
│                                                     │
├─────────────────────────────────────────────────────┤
│ FOREGROUND LAYER (100% opacity, active)             │
│                                                     │
│      [body-parser]  [cookie-parser]                 │
│              \         /                            │
│               [express]  ← local root               │
│              /         \                            │
│      [serve-static]   [debug]                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Transition Animation: Enter

```
Frame 0:      Current scope fully visible
              Player clicks target package

Frame 1-10:   Camera pushes toward target
              Current scope begins fading (100% → 25%)
              Slight blur applied to current scope
              Target grows toward center

Frame 10-20:  Target reaches center position
              Current scope settles at background opacity
              New scope container fades in (0% → 100%)

Frame 20+:    Cascade begins in new scope
              Background layer frozen (no physics, no interaction)
```

### Transition Animation: Exit

```
Frame 0:      Inside scope, parent visible in background
              Player clicks back button

Frame 1-10:   Current scope fades out (100% → 0%)
              Parent scope sharpens (25% → 100%)
              Camera pulls back

Frame 10+:    Parent scope fully active
              Grandparent (if any) remains in background
```

### Pixi.js Container Structure

```typescript
// Rendering layers (back to front)
worldContainer
├── backgroundScopeContainer  // Grandparent scope (10% alpha, frozen)
│   ├── nodes
│   └── wires
├── midgroundScopeContainer   // Parent scope (25% alpha, frozen)
│   ├── nodes
│   └── wires
├── foregroundScopeContainer  // Current active scope (100% alpha)
│   ├── wiresContainer
│   ├── nodesContainer
│   └── effectsContainer
└── uiContainer               // Depth indicator, back button
```

### Background Layer Behavior

- **Frozen:** No physics updates, no interactions
- **Dimmed:** 10-25% opacity based on depth distance
- **Blurred:** Subtle blur filter (2-4px) for depth separation
- **Scaled:** Slightly smaller (0.9x) to create depth illusion
- **Positioned:** Centered but offset slightly up (you "came from above")

### Visual Feedback While Deep

When inside a scope, the background provides context:
- Player can see where they came from
- Conflicts in outer scope pulse dimly (something needs attention)
- Spatial memory maintained ("I'm inside express, inside my project")

### Performance Considerations

- Background layers only rendered if `alpha > 0`
- Physics disabled for frozen layers
- Interaction disabled for background containers
- Could LOD: simplify background nodes to just icons (no borders, no effects)

---

## Depth Indicator: Nested Shape Totem

### Purpose

With 2+ layers of depth, player needs persistent awareness of "how deep am I?" The depth totem is a small, always-visible indicator in the corner.

### Visual Design

Nested circles showing current depth:

```
Root scope:     Layer 1:        Layer 2:

    ○              ◉               ◉
                   │               │
                   ○               ◉
                                   │
                                   ○

(empty)        (1 filled)      (2 filled)
```

Alternative: concentric rings that fill inward:

```
Root:          Layer 1:        Layer 2:

   ◯              ◉               ◉
                                 (◉)

(outline)      (filled)        (nested)
```

### Placement

- **Position:** Lower-left corner, above any other HUD elements
- **Size:** Small (32x48px area)
- **Always visible:** Even during transitions

### Animation

- **On scope change:** New level pulses briefly (scale 1.0 → 1.2 → 1.0)
- **Idle:** Subtle breathe animation on deepest filled circle
- **Exit hint:** When scope is stable, back-button and totem glow together

### Implementation

```typescript
interface DepthIndicator {
  currentDepth: 0 | 1 | 2;
  maxDepth: 2;  // For jam scope

  // Visual state
  pulsePhase: number;
  exitGlowIntensity: number;
}

// Render as stacked circles
function renderDepthTotem(depth: number): void {
  // Draw from bottom to top
  for (let i = maxDepth; i >= 0; i--) {
    const filled = i <= depth;
    const y = baseY - (i * spacing);
    drawCircle(x, y, radius, filled ? COLORS.active : COLORS.outline);
  }

  // Connect with vertical line
  drawLine(x, baseY, x, baseY - (depth * spacing));
}
```

### Integration with Back Button

The depth totem and back button work together:
- Back button shows `←` (layer 1) or `← ←` (layer 2)
- Totem shows visual depth
- Both glow when current scope is stable (hint to exit)

```
┌─────────────────────────────────┐
│ ← ←                             │  ← back button (layer 2)
│                                 │
│  ◉                              │  ← depth totem
│  │                              │
│  ◉                              │
│  │                              │
│  ○                              │
│                                 │
└─────────────────────────────────┘
```

---

## Cross-Package Deduplication: Hoisting

### Concept

When two packages share an internal dependency, player can "hoist" it to root level—like npm's node_modules hoisting.

```
Before hoisting:              After hoisting:

[pkg1]        [pkg4]          [pkg1]        [pkg4]
  │             │                │             │
lodash       lodash              └─────┬───────┘
(real)       (real)                    │
                                    (lodash)
                                       │
                                    [root]
```

### Hoisted Deps Ring

Hoisted deps orbit the root node in a small ring:

```
            [pkg1]      [pkg2]      [pkg3]
                \         |         /
                 \        |        /
                  ┌───────────────┐
                  │  (L) (A) (R)  │  ← hoisted ring
                  │    [root]     │
                  └───────────────┘
                 /        |        \
                /         |         \
            [pkg6]      [pkg5]      [pkg4]

(L) = lodash, (A) = axios, (R) = react (hoisted)
```

**Visual treatment:**
- Smaller than packages (icon + small circle, no box border)
- Positioned in tight ring around root (not overlapping)
- Soft glow indicating "infrastructure"
- Lines from source packages to hoisted dep (ephemeral, on hover/drag)

### Hoisting Interaction

**Detection:**
- Matching halos on packages indicate shared internal deps (existing system)
- Halos pulse in sync for discoverability

**Action:**
1. Player drags package with shared dep TOWARD root
2. Drop zone ring appears around root as drag approaches
3. Preview shows which dep will hoist (ghost icon in ring)
4. On drop: dep animates out, settles in ring
5. Source packages' internal instances become ghosts
6. Efficiency bonus applied

**Lines:**
- When dragging: line from dragged package to root
- After hoist: lines from ALL source packages to hoisted dep (shown ephemerally on hover)
- Default state: just the hoisted dep icons visible, no permanent lines

### Hoisting State Model

```typescript
interface GameState {
  // ... existing fields ...

  hoistedDeps: Map<string, HoistedDep>;
}

interface HoistedDep {
  id: string;
  identity: PackageIdentity;
  sourcePackages: string[];  // Package IDs that share this dep
  position: { x: number; y: number };  // Orbit position around root
  weight: number;  // Combined weight (deduplicated)
}
```

### Hoisting Effects

| Effect | Value |
|--------|-------|
| Weight reduction | Source package weight -= dep weight |
| Efficiency boost | +5% per unique hoisted dep |
| Visual | Packages become "leaner", root grows richer |

### Ghost Instances

When a dep is hoisted, internal instances become ghosts:

```typescript
interface Package {
  // ... existing fields ...

  isGhost: boolean;
  ghostTarget: 'hoisted' | string | null;  // 'hoisted' = points to root ring
}
```

Ghost visual: faded, dashed border, ⤳ icon pointing toward root.

---

## Conflict Resolution (Unchanged)

Conflicts still work the same way:
- Wire-based detection (incompatible archetypes)
- Click wire → Prune or Upgrade action
- Works at both layer 1 and layer 2

Cross-package conflicts (sibling wires at root) remain:
- Shown as warning wire between packages
- "Resolve Inside" navigates to the package with the conflict
- Player chooses which ecosystem wins

---

## Root Node Behavior

**Click = Install** (unchanged)
- Root node click always installs a new top-level package
- New packages appear as compressed seeds (no cascade at root)

**Drop zone for hoisting** (new)
- Dragging a package near root shows drop zone ring
- Dropping hoists the shared dep
- Does not interfere with click-to-install

**Visual growth:**
- Root visually grows as more deps are hoisted
- Shows "infrastructure" building up
- Satisfying progression indicator

---

## Package States (Revised)

### Top-Level Packages (Depth 1)

| State | Meaning | Visual |
|-------|---------|--------|
| `compressed` | Just installed, never entered | Pulsing blue, seed-like |
| `cascading` | Currently spawning internal deps | Particles, activity |
| `unstable` | Has unresolved conflicts/dupes | Red/orange glow |
| `stable` | All issues resolved | Green/cyan glow |

### Internal Deps (Depth 2)

| State | Meaning | Visual |
|-------|---------|--------|
| `compressed` | Has internal scope, not entered | Pulsing blue |
| `leaf` | No internal scope | Normal node |
| `cascading` | Currently spawning (if compressed) | Particles |
| `unstable` | Has issues (if compressed) | Red glow |
| `stable` | Resolved (if compressed) | Green glow |
| `ghost` | Hoisted away | Faded, dashed, ⤳ icon |

---

## Stability Propagation

For a top-level package to be stable:
1. No internal conflicts
2. No internal duplicates
3. ALL compressed internal deps are stable

This creates a recursive stability requirement:
- Layer 2 must stabilize before layer 1 can stabilize
- Incentivizes going deep

```
stable(package) =
  no_conflicts(internal) AND
  no_duplicates(internal) AND
  ALL(compressed_deps, stable)
```

---

## Prestige Integration

### Weight Calculation

```
total_weight =
  sum(top_level_package_weights) +
  sum(hoisted_dep_weights)

package_weight =
  base_weight +
  sum(internal_dep_weights) -
  sum(ghost_weights)  // Ghosts don't count
```

### Stability Bonus

```
stability_ratio = stable_packages / total_packages
depth_bonus = avg_max_depth_explored * 0.1  // Reward going deep

prestige_multiplier =
  base *
  (0.5 + stability_ratio * 0.5) *
  (1 + depth_bonus)
```

### Hoisting Bonus

```
hoist_efficiency = hoisted_deps.length * 0.05
prestige_multiplier *= (1 + hoist_efficiency)
```

---

## Tutorial Flow (Revised)

### First Package: starter-kit

1. **Root scope:** Click root → starter-kit appears (compressed, pulsing)
2. **Enter:** Click starter-kit → cascade begins
3. **Layer 1:** 6 deps burst out over 1.5 seconds
   - lodash, moment, date-fns, debug, chalk, express(◉ compressed)
   - Conflict: moment ⚡ date-fns
   - express is compressed (can go deeper)
4. **Resolve conflict:** Click wire → Prune moment (or Upgrade)
5. **Go deeper:** Click express → enter layer 2
6. **Layer 2:** 4 deps burst out
   - body-parser, cookie-parser, serve-static, debug
   - Duplicate: debug (also in layer 1)
7. **Resolve duplicate:** Drag to merge
8. **Exit layer 2:** Click back → express now stable
9. **Exit layer 1:** Click back → starter-kit now stable
10. **Second package:** Install another, see hoist opportunity

### Post-First-Prestige

- Tutorial gating removed
- Can have multiple unstable packages
- Automation unlocks (auto-dedup, auto-resolve at 1/sec)

---

## Implementation Phases

### Phase 1: Compressed Package State
- [ ] Add `compressed` state to packages
- [ ] Top-level packages start as compressed (no cascade at root)
- [ ] Cascade triggers on enter (not on install)

### Phase 2: Staggered Cascade
- [ ] Deps spawn one-by-one with timing
- [ ] Particle effects per spawn
- [ ] Physics settles after cascade completes

### Phase 3: Layer 2 Depth ✓
- [x] Some internal deps marked as compressed (25%)
- [x] Enter compressed dep → layer 2 scope
- [x] Layer 2 cascade (smaller, 3-5 deps)
- [x] Scope state model update (scopeStack array)
- [x] Stability propagation (parent stable only if compressed deps stable)

### Phase 4: Full Layering (Inception Visual) ✓
- [x] Refactor container structure (background/midground/foreground)
- [x] Background scope rendering (frozen, dimmed, blurred)
- [x] Disable interaction on background layers (separate renderers)
- [x] Performance optimization (layers hidden when not needed)
- [ ] Scope transition animations (fade, scale, blur) - nice-to-have

### Phase 5: Depth Indicator Totem ✓
- [x] Depth indicator UI component (HUD.vue)
- [x] Nested circle rendering based on current depth
- [x] Pulse animation on scope change
- [x] Integration with back button (coordinated glow, depth arrows)
- [x] Placement in lower-left corner

### Phase 6: Stability Propagation ✓
- [x] Compressed deps track their own internal state
- [x] Parent stability requires child stability
- [x] Visual feedback for "blocking" deps (internalState glow on compressed deps)

### Phase 7: Hoisting System ✓
- [x] `hoistedDeps` state in GameState
- [x] Core hoisting logic (hoisting.ts - shared dep detection, hoist action)
- [x] Hoisted dep rendering (orbit ring around root, purple glow)
- [x] Drop zone detection logic (isInDropZone function)
- [x] Ghost marking for source instances (in hoistDep function)
- [x] Wire up drag-to-hoist interaction (GameCanvas.vue)
- [x] Hoist animation (dep rises to ring with scale pop and glow)
- [x] Ephemeral lines on hover (dashed purple lines to source packages)

### Phase 8: Polish ✓
- [x] Cascade timing tuning (acceleration, jitter, depth-based speed)
- [x] Drop zone visuals (pulsing ring with inward arrows)
- [x] Hoisted ring layout algorithm (orbit positioning, gap-finding)
- [x] Camera transition easing (smooth zoom transitions)
- [x] Background layer rendering (blur, alpha, zoom-in centering)

---

## Open Questions

1. **Cascade interruptibility:** Can player click during cascade, or wait for settle?
2. **Layer 2 conflicts:** Same archetype rules, or simplified?
3. **Hoist animation:** Dep rises up, or packages "push" it out?
4. **Multiple hoists at once:** Drag multiple packages? Or one at a time?

---

## Removed/Simplified

From previous design:
- ~~Cross-package conflict wires~~ → Keep but simplify to "Resolve Inside" only
- ~~Halo colors for hoisted deps~~ → Use ephemeral lines instead
- ~~Complex wire routing~~ → Hub-and-spoke from hoisted ring

---

*Document Version: 1.0*
*Last Updated: 2025-12-29*
*Status: Design Draft*
