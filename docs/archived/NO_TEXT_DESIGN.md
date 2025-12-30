# No-Text Visual Design Guide

This document defines the visual language for communicating game state, mechanics, and progression without text. All information must be conveyed through shapes, colors, icons, animations, and spatial relationships.

## Core Principle: Show, Don't Tell

Players learn through:
1. **Experimentation** - Click things, see what happens
2. **Visual feedback** - Immediate response to actions
3. **Pattern recognition** - Consistent visual language
4. **Discovery** - Mystery creates engagement

**Zero tutorials.** The game teaches itself through its visual systems.

---

## Visual Language Reference

### Shape = Package Version/Type

| Shape | Meaning | Visual | Use Case |
|-------|---------|--------|----------|
| **Circle** | Stable/latest | ● | Default packages, resolved dependencies |
| **Square** | Major v1.x | ■ | First major version packages |
| **Triangle** | Major v2.x | ▲ | Second major version |
| **Diamond** | Major v3.x | ◆ | Third major version |
| **Hexagon** | Major v4+ | ⬡ | Higher versions |
| **Star** | Rare/special | ★ | Famous packages (lodash, react, webpack) |

**Implementation:** Shape is determined by semver major version. Special packages override with star shape.

### Border Color = Current State

| Color | Hex | State | Animation |
|-------|-----|-------|-----------|
| **Blue** | `#4A9EFF` | Installing | Pulse animation |
| **Green** | `#4ADE80` | Ready/resolved | Solid, slight glow |
| **Red** | `#F87171` | Conflict/error | Flash animation |
| **Cyan** | `#22D3EE` | Optimized/deduped | Shimmer effect |
| **Yellow** | `#FACC15` | Warning/outdated | Slow pulse |
| **Gray** | `#6B7280` | Disabled/locked | No animation |
| **Purple** | `#A78BFA` | Symlinked | Dotted border |

### Fill Color = Health/Heat Level

Fill represents system strain (heat) or package health:

```
Fill Level    Meaning              Color Gradient
─────────────────────────────────────────────────
0-20%         Cool/healthy         Dark blue → Green
20-50%        Warming              Green → Yellow
50-80%        Hot/strained         Yellow → Orange
80-100%       Critical/overheating Orange → Red
```

**Visual:** Fill rises from bottom of shape like a thermometer.

### Progress Ring = Installation/Resolution

Circular progress indicator around the node:
- **Clockwise fill** = Installation progress (0-100%)
- **Counter-clockwise** = Resolution/deduplication progress
- **Complete** = Ring disappears, state changes

### Wire/Connection Styles

| Style | Meaning | Visual |
|-------|---------|--------|
| **Solid line** | Direct dependency | ─── |
| **Dotted line** | Devdependency | ┈┈┈ |
| **Dashed line** | Peer dependency | - - - |
| **Glowing line** | Symlink | ═══ (cyan glow) |
| **Red line** | Conflict path | ─── (red, thicker) |

Wire thickness indicates dependency depth (thicker = shallower in tree).

---

## Teaching Mechanics Visually

### First-Time Discovery Sequence

When a new mechanic is encountered:

```
1. MYSTERY      → Show "???" or locked icon
2. HINT         → Subtle visual cue (glow, particle)
3. INTERACTION  → Player clicks/hovers
4. REVELATION   → Mechanic activates with feedback
5. REINFORCEMENT → Repeat pattern establishes learning
```

### Click-to-Install Feedback Loop

```
Player clicks node
       ↓
[Ripple animation from click point]
       ↓
[Bandwidth bar decreases visually]
       ↓
[Progress ring appears on node]
       ↓
[Node pulses blue during install]
       ↓
[Progress ring fills clockwise]
       ↓
[Green flash + particles on complete]
       ↓
[Dependencies burst outward as new nodes]
```

This sequence teaches: click → cost → progress → completion → spawning.

### Conflict Discovery

```
Dependencies collide (same package, different versions)
       ↓
[Both nodes flash red]
       ↓
[Red connecting line appears]
       ↓
[Shake animation on both]
       ↓
[Heat meters rise on affected nodes]
       ↓
Player holds click on conflict
       ↓
[Resolution progress ring appears]
       ↓
[On complete: one node absorbs other with merge animation]
```

### Resource Bar Feedback

HUD resources communicate through:

| Resource | Icon | Bar Behavior |
|----------|------|--------------|
| **Bandwidth** | ↓ | Depletes on action, regenerates over time |
| **Weight** | ◆ | Grows with installations, triggers prestige threshold |
| **Heat** | ● | Rises with conflicts, causes problems when high |

**No labels.** Players learn through correlation:
- Click install → bandwidth drops → "that's the cost"
- Install completes → weight rises → "that's accumulation"
- Conflicts appear → heat rises → "that's bad"

---

## Progressive Disclosure System

### Visibility States

```typescript
type VisibilityState = 'hidden' | 'mystery' | 'revealed';
```

| State | Visual | Player Knowledge |
|-------|--------|------------------|
| **Hidden** | Nothing shown | Doesn't know it exists |
| **Mystery** | ??? or locked icon | Knows something exists |
| **Revealed** | Full visual | Understands mechanic |

### Unlock Triggers

Features reveal based on thresholds, not tutorials:

```
Feature              Unlock Condition              Visual Trigger
─────────────────────────────────────────────────────────────────
Symlink button       First conflict resolved       Button fades in
Dedupe tool          5+ duplicate packages         Tool slot glows
Prestige option      Weight reaches 50k            Black hole icon pulses
Cache tokens         First prestige complete       Token counter appears
Upgrade shop         10+ packages installed        Shop icon materializes
```

### Mystery Placeholders

For unrevealed content, show:
- **???** shape with question mark
- Grayed out / desaturated version
- Lock icon overlay
- Subtle particle effect hinting at hidden content

When revealed:
1. ??? dissolves
2. Real content fades in
3. Brief glow/sparkle effect
4. Optional: screen shake for major reveals

---

## Phase Transitions

### Visual Progression Arc

The game communicates progression through visual density and order:

```
EARLY GAME (Chaos)
├── Sparse nodes
├── Tangled wires
├── Frequent red conflicts
├── Erratic node movement
└── Visual: Messy, organic

MID GAME (Growth)
├── Dense node clusters
├── Some organized sections
├── Mixed conflict states
├── Emerging patterns
└── Visual: Busy but structured

LATE GAME (Optimization)
├── Tight, efficient layouts
├── Parallel wire bundles
├── Cyan optimized nodes
├── Smooth, minimal movement
└── Visual: Clean, geometric

PRESTIGE (Collapse)
├── All nodes pull toward center
├── Black hole forms
├── Everything absorbed
├── Flash to white
└── Visual: Dramatic, satisfying
```

### Prestige Visual Sequence

```
Weight threshold reached
       ↓
[Screen edges darken]
       ↓
[Gravity increases - nodes drift toward center]
       ↓
[Central black hole icon appears]
       ↓
[Spiral animation - all nodes pulled in]
       ↓
[Bright flash]
       ↓
[Counter shows cache tokens earned]
       ↓
[Fade to fresh canvas]
```

---

## Icon Reference

### Tool/Action Icons

| Icon | Action | Visual Description |
|------|--------|-------------------|
| ↓ | Install/Download | Downward arrow |
| ⟳ | Refresh/Retry | Circular arrow |
| ⊕ | Add/Expand | Plus in circle |
| ⊗ | Remove/Delete | X in circle |
| ⟔ | Symlink | Chain link |
| ◎ | Deduplicate | Concentric circles |
| ⚡ | Optimize | Lightning bolt |
| ● | Black hole/Prestige | Filled circle with glow |

### Package Identity Icons

Real packages get recognizable icons (from Devicon/Simple Icons):
- React → Atom symbol
- Vue → V shape
- Webpack → Cube bundle
- Lodash → Underscore
- TypeScript → TS box
- Node → Hexagon

Generic packages use shape-only representation.

### State Indicator Icons

| Icon | Meaning |
|------|---------|
| ✓ | Complete/Success |
| ! | Warning |
| ✗ | Error/Conflict |
| ⏳ | In progress |
| 🔒 | Locked |
| ??? | Undiscovered |

---

## Animation Guidelines

### Timing

| Animation Type | Duration | Easing |
|---------------|----------|--------|
| State change | 200ms | ease-out |
| Progress fill | continuous | linear |
| Reveal/unlock | 400ms | ease-in-out |
| Error flash | 150ms × 3 | linear |
| Prestige collapse | 2000ms | ease-in |

### Feedback Animations

**Success:**
- Green pulse outward
- Particle burst (small, green/white)
- Brief scale up (1.1×) then back

**Error:**
- Red flash
- Shake (3-5px horizontal)
- Brief scale down (0.95×)

**Progress:**
- Steady pulse while active
- Progress ring fills smoothly
- Subtle particle trail

**Discovery:**
- Sparkle effect
- Scale from 0 → 1 with bounce
- Glow intensifies then fades

---

## Spatial Communication

### Position = Relationship

```
        [Root Package]
              │
    ┌─────────┼─────────┐
    │         │         │
 [Dep A]   [Dep B]   [Dep C]
    │
 [Sub-dep]
```

- **Vertical position** = Depth in dependency tree
- **Horizontal spread** = Sibling relationships
- **Clustering** = Related/shared dependencies
- **Distance** = Dependency strength (closer = tighter coupling)

### Gravity and Weight

Visual weight communicates importance:
- **Larger nodes** = More dependents
- **Denser clusters** = Heavily used packages
- **Central position** = Core dependencies
- **Peripheral position** = Leaf dependencies

---

## Color Palette

### Primary Colors

```css
:root {
  /* States */
  --color-installing: #4A9EFF;  /* Blue */
  --color-ready: #4ADE80;       /* Green */
  --color-conflict: #F87171;    /* Red */
  --color-optimized: #22D3EE;   /* Cyan */
  --color-warning: #FACC15;     /* Yellow */
  --color-disabled: #6B7280;    /* Gray */
  --color-symlink: #A78BFA;     /* Purple */

  /* Heat gradient */
  --heat-cool: #1E3A5F;         /* Dark blue */
  --heat-warm: #4ADE80;         /* Green */
  --heat-hot: #F97316;          /* Orange */
  --heat-critical: #DC2626;     /* Red */

  /* Background */
  --bg-primary: #0F172A;        /* Dark slate */
  --bg-secondary: #1E293B;      /* Lighter slate */

  /* Wires */
  --wire-default: #475569;      /* Slate */
  --wire-active: #94A3B8;       /* Light slate */
  --wire-conflict: #F87171;     /* Red */
}
```

### Accessibility Considerations

- High contrast between states
- Don't rely on color alone (use shape + color)
- Animation can be reduced for motion sensitivity
- Consistent meaning across all uses

---

## Testing Visual Communication

### Playtest Questions

After watching new players (no hints given):

1. Did they understand clicking installs packages?
2. Did they recognize conflicts (red state)?
3. Did they discover resolution (hold click)?
4. Did they understand resource costs?
5. Did they find the prestige mechanic?
6. How long before first "aha!" moment?

### Success Metrics

- **< 30 seconds** to first successful install
- **< 2 minutes** to understand conflict resolution
- **< 5 minutes** to grasp resource management
- **Zero** "what do I do?" confusion after 10 minutes

### Failure Indicators

- Player clicking randomly with no understanding
- Ignoring visual feedback
- Missing obvious state changes
- Frustration without discovery moments

---

## Reference: Research Sources

This guide synthesizes patterns from:

- **A Dark Room** - Mystery-first design, environmental storytelling
- **Candy Box 2** - Progressive disclosure, zero tutorials
- **Universal Paperclips** - Visual phase transitions
- **Cookie Clicker** - Central icon focus, color-coded states
- **Kittens Game** - Persistent resource bars, category colors

Key research documents:
- `discovery-systems.md` - ??? placeholders, visibility states
- `hidden-content-systems.md` - Shadow content, reveal mechanics
- `narrative-systems.md` - Teaching through mechanics
- `game-layout-patterns.md` - Spatial communication

---

## Quick Reference Card

```
SHAPES          BORDERS         FILLS           WIRES
───────         ───────         ─────           ─────
● Circle=v0     Blue=Installing Dark=Cool       Solid=Dep
■ Square=v1     Green=Ready     Green=OK        Dotted=Dev
▲ Triangle=v2   Red=Conflict    Yellow=Warm     Dashed=Peer
◆ Diamond=v3    Cyan=Optimized  Orange=Hot      Glow=Symlink
★ Star=Special  Purple=Symlink  Red=Critical    Red=Conflict

DISCOVERY: hidden → ??? → revealed
FEEDBACK: action → animation → state change → particles
TEACHING: mystery → experiment → feedback → understanding
```
