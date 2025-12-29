# Visual Design Guide

The complete visual language and teaching system for communicating game mechanics without text.

**Status:** Authoritative reference (merged from NO_TEXT_DESIGN.md and VISUAL_TEACHING.md)

---

## Part 1: The No-Text Constraint

### The Rule

Per the game jam: **"Anything you can type out is text; symbols are fine."**

This means:
- **NO numbers** (0-9) - not even "42" or "+5"
- **NO letters** (a-z, A-Z) - no labels, no abbreviations
- **NO typed punctuation as content** - no "???" or "..."

**Allowed:**
- Unicode symbols: ↓ ◆ ● ★ ⚡ ⟲ ◉ ▲ ■
- Geometric shapes rendered as graphics
- Progress bars, fill levels, dot counters
- Colors, animations, spatial relationships
- Icons (graphical, not font-based text)

### Representing Quantities

| Instead of... | Use... |
|---------------|--------|
| "50 bandwidth" | Progress bar fill level |
| "15 packages" | Dot counter (●●●○○) or icon density |
| "+5 tokens" | Icon size pulse or multiple icons appearing |
| "85% efficiency" | Bar fill with color gradient |
| "1.2 GB weight" | Magnitude dots + size of icon |

---

## Part 2: Core Principles

1. **Never steal camera** - No forced pans, zooms, or focus changes
2. **Show, don't tell** - Mechanics teach through feedback loops
3. **Progressive disclosure** - Reveal UI elements as they become relevant
4. **Glow hierarchy** - Color-coded affordability guides action
5. **Edge indicators** - Off-screen events signaled at screen boundaries

Players learn through:
- **Experimentation** - Click things, see what happens
- **Visual feedback** - Immediate response to actions
- **Pattern recognition** - Consistent visual language
- **Discovery** - Mystery creates engagement

**Zero tutorials.** The game teaches itself through its visual systems.

---

## Part 3: Visual Language Reference

### Package Identity = Icons

Package icons ARE the identity. Real packages use Devicon/Simple Icons.

| Library | Coverage | License | Use Case |
|---------|----------|---------|----------|
| **[Devicon](https://devicon.dev/)** | 150+ npm packages | MIT | Primary |
| **[Simple Icons](https://simpleicons.org/)** | 3000+ brands | CC0 | Secondary |

#### Icon State Treatment

| Package State | Icon Treatment |
|---------------|----------------|
| Installing | Monochrome + pulse animation |
| Healthy | Full color |
| Conflict | Red tint/overlay |
| Optimized/Symlinked | Green glow + full color |
| Paused/Inactive | Grayscale, dimmed |

#### Archetype Fallbacks (When No Icon)

| Archetype | Shape | Symbol | Behavior |
|-----------|-------|--------|----------|
| **Utility** | Circle | ○ | High symlink chance, 0 deps |
| **Framework** | Hexagon | ⬡ | Deep trees, rare |
| **Tooling** | Gear | ⚙ | Spawns many small deps |
| **Legacy** | Warning | ⚠ | Causes conflicts |
| **Runtime** | Square | ■ | Stable, foundational |

### Border Color = Current State

| Color | Hex | State | Animation |
|-------|-----|-------|-----------|
| **Blue** | `#4A9EFF` | Installing | Pulse |
| **Green** | `#4ADE80` | Ready/resolved | Solid glow |
| **Red** | `#F87171` | Conflict/error | Flash |
| **Cyan** | `#22D3EE` | Optimized/deduped | Shimmer |
| **Yellow** | `#FACC15` | Warning/outdated | Slow pulse |
| **Gray** | `#6B7280` | Disabled/locked | None |
| **Purple** | `#A78BFA` | Symlinked | Dotted border |

### Fill Color = Health/Heat Level

Fill represents system strain (heat):

```
Fill Level    Meaning              Color Gradient
─────────────────────────────────────────────────
0-20%         Cool/healthy         Dark blue → Green
20-50%        Warming              Green → Yellow
50-80%        Hot/strained         Yellow → Orange
80-100%       Critical             Orange → Red
```

### Glow Hierarchy (Affordability Feedback)

| Glow | Color | Meaning | Animation |
|------|-------|---------|-----------|
| **Attention** | Bright cyan | Primary focus | Concentric rings pulse inward |
| **Affordable** | Steady green | Can interact now | Soft outer glow, 8px, 0.4 alpha |
| **Almost** | Dim blue | Regenerating toward cost | Pulse, 6px, 0.2-0.4 alpha |
| **Conflict** | Red | Needs resolution | Fast pulse, 10px, 0.5-0.8 alpha |
| **Hub** | Gold/amber | Symlink attractor | Slow pulse, 2s cycle |
| **None** | — | Cannot interact | No glow |

### Symlink Halos (Duplicate Detection)

Duplicate packages share a colored halo that pulses in sync:

| Group | Halo Color | Hex |
|-------|------------|-----|
| Group 1 | Cyan | `#22D3EE` |
| Group 2 | Magenta | `#E879F9` |
| Group 3 | Yellow | `#FACC15` |
| Group 4 | Lime | `#84CC16` |

A faint dotted "ghost line" connects duplicates as a merge hint.

### Wire/Connection Styles

| Style | Meaning | Visual |
|-------|---------|--------|
| **Solid line** | Direct dependency | ─────────── |
| **Dotted line** | Dev dependency | ┈┈┈┈┈┈┈┈┈┈┈ |
| **Dashed line** | Peer dependency | ─ ─ ─ ─ ─ ─ |
| **Double line** | Symlink | ═══════════ (cyan glow) |
| **Crackling red** | Conflict | ══⚡══⚡══ (animated) |

Wire thickness indicates dependency depth (thicker = shallower).

### Progress Ring

Circular progress indicator around nodes:
- **Clockwise fill** = Installation progress
- **Counter-clockwise** = Resolution progress
- **Complete** = Ring disappears, state changes

---

## Part 4: HUD Icons

### Resource Icons

| Icon | Resource | Notes |
|------|----------|-------|
| ↓ | Bandwidth | Regenerates, spent on install |
| ◆ | Weight | Accumulates, triggers prestige |
| ● | Heat | Rises with conflicts |
| ⟲ | Cache Tokens | Persists through prestige |
| ⚡ | Efficiency | Ratio indicator |
| ◉ | Gravity | Prestige proximity |
| ★ | Prestige | Collapse trigger |

### Tool/Action Icons

| Icon | Action |
|------|--------|
| ↓ | Install/Download |
| ✕ | Prune/Remove |
| ↻ | Upgrade/Transform |
| ⛓ | Symlink/Link |
| ◎ | Deduplicate |
| 💉 | Patch vulnerability |

### Progress/State Icons

| Icon | Meaning |
|------|---------|
| ○ | Empty/Queued |
| ◔ ◑ ◕ | Partial progress |
| ● | Complete/Filled |
| ⏸ | Paused |
| 🔒 | Locked/undiscovered |

---

## Part 5: Teaching Systems

### First-Launch Sequence

```
t=0s:      Black canvas, nothing visible
t=1s:      Subtle ripple emanates from center
t=2s:      Root node materializes (scale 0→1 with bounce)
t=3s:      Bright pulse begins on root
t=3s+:     Concentric rings pulse inward toward node
```

The first thing the player sees IS the thing to click. No HUD, no distractions.

### First Click (Slow Motion)

The very first install runs at 50% speed:

```
t=0ms:     Player clicks root
t=0-200:   Large ripple effect from click point
t=200-300: Cost line draws from node UP to bandwidth bar
           (bandwidth bar fades in if not visible)
t=300-400: "Energy" animates along line, bar drains
t=400-1200: Progress ring fills (2× slower than normal)
t=1200:    Success burst (larger than normal)
t=1400+:   Dependencies POP outward (staggered)
```

### Staged HUD Reveal

| Trigger | Element Revealed | Animation |
|---------|------------------|-----------|
| Game start | Nothing | — |
| First click | Bandwidth bar | Fade in + glow |
| 3+ packages | Package count | Slide in |
| 8+ packages | Weight display | Slide in + glow |
| First conflict | Heat bar | Flash red |
| 30%+ gravity | Prestige area | Pulse |
| First prestige | Cache counter | Golden glow |

Each reveal: scale 0.5→1.0 (bounce), brief glow halo (0.5s), settle.

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

### Conflict Teaching (Wire-Based)

See `CONFLICT_SYMLINK_REDESIGN.md` for full details.

First conflict spawns:
1. Screen edge flash (brief red vignette)
2. Non-conflict nodes dim to 0.6 opacity
3. Edge arrow if off-screen
4. Wire pulses with action button hints (faint ✕ and ↻)

### Symlink Teaching (Halo-Based)

When first duplicate spawns:
1. Both copies pulse with matching colored halo (3×)
2. Faint dotted ghost line draws between them
3. Halos continue subtle sync pulse

No dimming, no urgency - player discovers naturally.

---

## Part 6: Screen-Edge Indicators

### Off-Screen Event Arrows

When important events occur outside viewport:

| Event Type | Color | Size | Duration | Pulse |
|------------|-------|------|----------|-------|
| Conflict | Red | 20px | Until resolved | Fast |
| New package | Blue | 12px | 3s | Slow fade |
| Prestige ready | Purple | 24px | Persistent | Slow |
| Symlink opportunity | Cyan | 12px | 5s fade | — |

### Edge Vignette

For high-priority off-screen events (conflicts), add edge vignette:

```
Conflict off-screen to the RIGHT:
┌────────────────────────────┐
│                        ░░░░│
│                       ░░░░░│
│                      ░░░░░░│ ← Red gradient
│                       ░░░░░│
│                        ░░░░│
└────────────────────────────┘
```

---

## Part 7: Animation Guidelines

### Timing

| Animation Type | Duration | Easing |
|---------------|----------|--------|
| State change | 200ms | ease-out |
| Progress fill | continuous | linear |
| Reveal/unlock | 400ms | ease-in-out |
| Error flash | 150ms × 3 | linear |
| Prestige collapse | 2000ms | ease-in |

### Feedback Patterns

**Success:** Green pulse outward, particle burst, brief scale up (1.1×)

**Error:** Red flash, shake (3-5px), brief scale down (0.95×)

**Progress:** Steady pulse, ring fills, subtle particle trail

**Discovery:** Sparkle, scale 0→1 with bounce, glow intensifies then fades

---

## Part 8: Color Palette

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

---

## Part 9: Accessibility

### Reduced Motion Mode

Respect `prefers-reduced-motion`:

```typescript
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;
```

| Effect | Normal | Reduced Motion |
|--------|--------|----------------|
| Pulsing | Oscillating | Static highlight |
| Particles | Burst | Brief color flash |
| Progress ring | Animated | Instant fill |
| Screen shake | Shake | Skip |

**Always keep:** Color changes, edge arrows (static), action buttons.

### Color Independence

Don't rely on color alone - pair with shape/animation:

| State | Color | Secondary Indicator |
|-------|-------|---------------------|
| Affordable | Green glow | Steady (no pulse) |
| Almost | Blue pulse | Slow pulse rhythm |
| Conflict | Red pulse | Fast pulse + shake |
| Installing | Blue | Progress ring filling |

---

## Part 10: Testing Checklist

### First-Time Player Observations

Watch new players (no hints) and verify:

- [ ] < 30s: Player clicks the pulsing root node
- [ ] < 60s: Player notices bandwidth bar change
- [ ] < 90s: Player clicks a second time
- [ ] < 180s: Player discovers conflict resolution
- [ ] < 300s: Player understands resource regeneration
- [ ] No "what do I do?" confusion after 5 minutes

### Visual Clarity Tests

- [ ] Can identify clickable vs non-clickable at a glance
- [ ] Can locate off-screen conflicts via edge arrows
- [ ] Can understand cost before clicking (hover preview)
- [ ] Can read resource levels without numbers
- [ ] Can identify when prestige is available

### Failure Indicators

- Random clicking with no understanding
- Ignoring conflict nodes indefinitely
- Not noticing HUD elements when they appear
- Asking "how do I...?" questions

---

## Quick Reference Card

```
ICONS (PRIMARY)              ARCHETYPES (FALLBACK)        HUBS (ATTRACTORS)
───────────────              ─────────────────────        ─────────────────
Devicon/Simple Icons         ○ Circle   = Utility         ◎ Gold glow
for real packages            ⬡ Hexagon  = Framework       Energy flows inward
(react, vue, webpack...)     ⚙ Gear     = Tooling         Auto-symlink 30%
                             ⚠ Warning  = Legacy          lodash, chalk, debug...
                             ■ Square   = Runtime

GLOWS              BORDERS            FILLS            WIRES
─────              ───────            ─────            ─────
Cyan=Attention     Blue=Installing    Dark=Cool        ───── Solid=Dep
Green=Affordable   Green=Ready        Green=OK         ┈┈┈┈┈ Dotted=Dev
Blue=Almost        Red=Conflict       Yellow=Warm      ─ ─ ─ Dashed=Peer
Red=Conflict       Cyan=Optimized     Orange=Hot       ═════ Double=Symlink
Gold=Hub           Purple=Symlink     Red=Critical     ══⚡══ Crackling=Conflict

HALOS (DUPLICATES)           ACTIONS              HUD
──────────────────           ───────              ───
Cyan    = Group 1            ✕ = Prune            ↓ = Bandwidth
Magenta = Group 2            ↻ = Upgrade          ◆ = Weight
Yellow  = Group 3            ⛓ = Symlink          ● = Heat
Lime    = Group 4            ◎ = Dedupe           ⟲ = Cache
                             💉 = Patch           ⚡ = Efficiency

DISCOVERY: hidden → 🔒 → revealed
FEEDBACK: action → animation → state change → particles
TEACHING: mystery → experiment → feedback → understanding
NO TEXT: no numbers, no letters, only symbols + shapes + colors
```

---

*Merged from NO_TEXT_DESIGN.md and VISUAL_TEACHING.md*
*Last updated: 2024-12-29*
