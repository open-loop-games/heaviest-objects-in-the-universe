# Visual Teaching & Attention Systems

How to teach game mechanics and draw player attention without text or camera control.

## Core Principles

1. **Never steal camera** - No forced pans, zooms, or focus changes
2. **Show, don't tell** - Mechanics teach through feedback loops
3. **Progressive disclosure** - Reveal UI elements as they become relevant
4. **Glow hierarchy** - Color-coded affordability guides action
5. **Edge indicators** - Off-screen events signaled at screen boundaries

---

## First-Launch Sequence

### Empty Canvas Birth

```
t=0s:      Black canvas, nothing visible
t=1s:      Subtle ripple emanates from center
t=2s:      Root node materializes (scale 0→1 with bounce)
t=3s:      Bright pulse begins on root
t=3s+:     Concentric rings pulse inward toward node
```

The first thing the player sees IS the thing to click. No HUD, no distractions.

### First Click (Slow Motion Tutorial)

The very first install runs at 50% speed with staggered effects:

```
t=0ms:     Player clicks root
t=0-200:   Large ripple effect from click point
t=200-300: Cost line draws from node UP to bandwidth bar
           (bandwidth bar fades in if not visible)
t=300-400: "Energy" animates along line, bar drains
t=400-1200: Progress ring fills (2× slower than normal)
t=1200:    Success burst (larger than normal)
t=1400:    First dependency POPS outward
t=1600:    Second dependency POPS
t=1800:    Third dependency POPS (staggered spawn)
t=2000:    All deps now have their own progress rings
```

After first install, normal speed resumes.

### Staged HUD Reveal

| Trigger | Element Revealed | Animation |
|---------|------------------|-----------|
| Game start | Nothing | — |
| First click | Bandwidth bar | Fade in + glow |
| 3+ packages | Package count | Slide in from left |
| 8+ packages | Weight display | Slide in + glow |
| First conflict | Heat bar | Flash red then settle |
| 30%+ gravity | Prestige area | Pulse from bottom |
| First prestige | Cache token counter | Golden glow |

Each reveal uses:
1. Element scales from 0.5→1.0 (bounce ease)
2. Brief glow halo (0.5s)
3. Settle to normal state

---

## Glow Feedback System

### Three-Tier Hierarchy

Adapted from Alkahistorian's proven system:

| Glow Color | Meaning | Use Case |
|------------|---------|----------|
| **Bright cyan pulse** | Primary attention | Root on fresh save, first conflict |
| **Steady green glow** | Fully affordable | Node clickable, have bandwidth |
| **Dim blue pulse** | Almost affordable | Bandwidth regenerating toward cost |
| **Red pulse** | Needs resolution | Conflict state |
| **No glow** | Cannot interact | Installing, or insufficient resources |

### Implementation

```typescript
type GlowState = 'attention' | 'affordable' | 'almost' | 'conflict' | 'none';

function calculateGlow(pkg: Package, bandwidth: number, cost: number): GlowState {
  if (pkg.state === 'conflict') return 'conflict';
  if (pkg.state !== 'ready') return 'none';
  if (bandwidth >= cost) return 'affordable';
  if (bandwidth >= cost * 0.5) return 'almost';
  return 'none';
}
```

### Glow Rendering

```
affordable:   Soft green outer glow, 8px radius, 0.4 alpha
almost:       Dim blue pulse, 6px radius, 0.2-0.4 alpha oscillating
conflict:     Red pulse, 10px radius, 0.5-0.8 alpha oscillating
attention:    Bright cyan with concentric rings pulsing inward
```

### Throttled Checking

Don't recalculate every frame:

```typescript
const GLOW_CHECK_INTERVAL = 500; // ms
let lastGlowCheck = 0;

function maybeUpdateGlows(now: number) {
  if (now - lastGlowCheck < GLOW_CHECK_INTERVAL) return;
  lastGlowCheck = now;
  recalculateAllGlows();
}
```

---

## Screen-Edge Attention Indicators

### Off-Screen Event Arrows

When important events occur outside the viewport:

```
┌────────────────────────────────────┐
│                                    │
│        [visible viewport]          │
│                                    │
│                                ◀── │ Red: conflict
│                                    │
│    ▼                               │ Blue: new package
└────────────────────────────────────┘
```

### Arrow Properties

| Event Type | Color | Size | Duration | Pulse |
|------------|-------|------|----------|-------|
| Conflict spawn | Red | 20px | Until resolved or viewed | Fast |
| Package installed | Blue | 12px | 3s | Slow fade |
| Prestige ready | Purple | 24px | Persistent | Slow |

### Arrow Positioning

```typescript
function getEdgeIndicator(worldPos: Position, viewport: Rect): EdgeIndicator | null {
  // Check if position is outside viewport
  if (isInsideViewport(worldPos, viewport)) return null;

  // Calculate which edge and position along that edge
  const angle = Math.atan2(
    worldPos.y - viewport.centerY,
    worldPos.x - viewport.centerX
  );

  // Clamp to viewport edge
  const edgePos = clampToViewportEdge(worldPos, viewport);

  return {
    position: edgePos,
    rotation: angle,
    // Arrow points toward the event
  };
}
```

### Edge Vignette for Urgency

For high-priority off-screen events (conflicts), add edge vignette:

```
Conflict off-screen to the RIGHT:
┌────────────────────────────────┐
│                            ░░░░│
│                           ░░░░░│
│                          ░░░░░░│ ← Red gradient vignette
│                           ░░░░░│
│                            ░░░░│
└────────────────────────────────┘
```

---

## Cost-Action Connection Lines

### Hover Preview

When hovering a clickable node, show the cost connection:

```
    ┌──────────────────┐
    │ ↓ [████████░░░░] │ ← Bandwidth bar
    └────────┬─────────┘
             │
             │ ← Dotted line (animated dots flowing down)
             │
             ▼
          ┌─────┐
          │  ●  │ ← Hovered node
          └─────┘
```

### Click Animation

On click, the connection becomes an energy transfer:

```
Frame 0:    Dotted line solidifies
Frame 1-5:  Bright "energy packet" travels UP the line
Frame 5:    Energy reaches bar
Frame 5-10: Bar segment dims/drains
Frame 10:   Line fades out
```

This visually teaches: "clicking this drains that resource."

---

## Conflict Resolution Teaching

### First Conflict Special Treatment

When the first conflict spawns:

1. **Screen edge flash** - Brief red vignette on all edges
2. **Non-conflict dimming** - Other nodes drop to 0.6 opacity
3. **Edge arrow** - If off-screen, red arrow points to it
4. **Enhanced outline** - Conflict node gets 4px red border (vs normal 2px)
5. **Empty progress ring** - Shows outline of fillable ring

### Progress Ring Hint

Show an empty ring outline immediately on conflict:

```
Conflict node (idle):          Conflict node (holding):
      ┌─────┐                        ┌─────┐
      │  ▲  │ ← Red border           │  ▲  │
      └─────┘                        └─────┘
        ╭─╮                            ╭─╮
        │ │  ← Empty ring outline      │█│  ← Filling
        ╰─╯     (dashed, 0.3 alpha)    ╰─╯
```

The empty ring suggests "this can be filled" without explicit instruction.

### Resolution Success

When conflict resolves:

1. Progress ring completes with bright flash
2. Node border transitions red → green
3. Green particle burst
4. Other nodes restore to full opacity
5. Brief "calm" period (0.5s) before next potential conflict

---

## Cascade Visualization

### Wire Energy Flow

When dependencies spawn from a parent:

```
     [Parent]
         │
    ╔════╧════╗
    ║ ══════► ║  ← Energy pulse travels down wire
    ╚════╤════╝
         │
     [Child]
```

### Chain Reaction Breadcrumbs

When dependencies spawn their own dependencies:

1. Parent completes install
2. Wire to child lights up (brief glow)
3. Child completes install
4. Wires to grandchildren light up
5. Pattern continues, creating visual "cascade" effect

This teaches causality: installations cause more installations.

---

## Click Affordance Indicators

### Root Node First-Time Hint

More prominent than a simple arrow:

```
     ╭───────╮
     │ ╭───╮ │
     │ │   │ │  ← Concentric rings pulse INWARD
     │ ╰───╯ │     (universal "tap here" language)
     ╰───────╯
         │
        ╲│╱
         ▼      ← Small bouncing indicator
```

### Hover Scale Feedback

Clickable nodes scale slightly on hover:

```
Normal:     Hovered:
┌─────┐     ┌───────┐
│  ●  │  →  │   ●   │  (1.0× → 1.08×)
└─────┘     └───────┘
```

This teaches interactivity without text.

### Unclickable Feedback

When clicking a node you can't interact with:

- Brief red flash on node
- Small "X" or shake animation
- No ripple effect (vs clickable which gets ripple)

---

## HUD Design (No Numbers)

### Pure Visual Bars

Replace numeric displays with pure bars:

```
Before (text):              After (visual):
↓ 123/200                   ↓ [████████████░░░░░░░░]

◆ 45.2 KB                   ◆ [●●○○] (magnitude dots)
                               └─ 4 dots = 4 orders of magnitude
```

### Magnitude Dots for Weight

```
[○○○○] = 0-999 bytes
[●○○○] = 1KB-999KB
[●●○○] = 1MB-999MB
[●●●○] = 1GB-999GB
[●●●●] = 1TB+
```

Each filled dot = one order of magnitude. No numbers needed.

### Heat as Fill Level

```
Cool:    ● [░░░░░░░░░░] (gray icon, empty bar)
Warm:    ● [████░░░░░░] (orange icon, partial fill)
Hot:     ● [████████░░] (red icon, high fill, pulsing)
Critical:● [██████████] (red icon, full, fast pulse)
```

---

## Prestige Visual Sequence

### Black Hole Formation

As gravity builds (no camera movement):

```
Stage 1 (30%):  Slight vignette darkening at corners
Stage 2 (50%):  Nodes drift slightly toward center (physics)
Stage 3 (70%):  Black hole icon appears at world origin
Stage 4 (90%):  Screen edges darken significantly
Stage 5 (100%): Ready to collapse
```

### Prestige Ready Indicator

When prestige becomes available:

1. Black hole icon pulses at screen center (HUD layer, not world)
2. If black hole is off-screen, purple edge arrow points to it
3. Prestige button in HUD glows purple
4. Subtle particle spiral at world origin

### Collapse Animation (Player-Triggered)

```
t=0:      Player clicks prestige
t=0-500:  All nodes accelerate toward center (physics)
t=500-1500: Spiral animation, nodes compress
t=1500:   Bright white flash
t=1600:   Counter shows cache tokens earned (visual burst)
t=2000:   Fade to fresh canvas
```

---

## Testing Checklist

### First-Time Player Observations

Watch new players (give no hints) and verify:

- [ ] < 30s: Player clicks the pulsing root node
- [ ] < 60s: Player notices bandwidth bar change on click
- [ ] < 90s: Player clicks a second time (understands repeat)
- [ ] < 180s: Player discovers conflict resolution (hold click)
- [ ] < 300s: Player understands resource regeneration
- [ ] No "what do I do?" confusion after 5 minutes

### Visual Clarity Tests

- [ ] Can identify clickable vs non-clickable nodes at a glance
- [ ] Can locate off-screen conflicts via edge arrows
- [ ] Can understand cost before clicking (hover preview)
- [ ] Can read resource levels without numbers
- [ ] Can identify when prestige is available

### Failure Indicators

- Random clicking with no understanding
- Ignoring conflict nodes indefinitely
- Not noticing HUD elements when they appear
- Confusion about what clicking does
- Asking "how do I...?" questions

---

## Implementation Priority

### Phase 1: Core Teaching
1. Root node concentric ring pulse (first-time hint)
2. Staged HUD reveal (start empty)
3. Slow-motion first install
4. Cost connection line on hover

### Phase 2: Attention System
5. Screen-edge arrows for off-screen events
6. Glow hierarchy for affordability
7. Enhanced first-conflict treatment
8. Empty progress ring hint for conflicts

### Phase 3: Polish
9. Remove all numbers from HUD (pure bars)
10. Wire energy flow visualization
11. Cascade breadcrumb effects
12. Edge vignette for urgency

---

## Accessibility Considerations

### Reduced Motion Mode

Respect OS `prefers-reduced-motion` setting:

```typescript
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

if (prefersReducedMotion) {
  // Replace animations with instant state changes
  // Replace pulses with static highlights
  // Disable screen shake
  // Keep essential feedback (color changes, borders)
}
```

**What to disable:**
- Pulsing animations → Static glow
- Concentric rings → Single highlight ring
- Particle bursts → Brief color flash
- Progress ring animation → Instant fill

**What to keep:**
- Color state changes (essential for feedback)
- Edge arrows (static, not animated)
- Scale changes on hover (subtle, no bounce)

### Color Independence

Don't rely on color alone - always pair with shape/animation:

| State | Color | Secondary Indicator |
|-------|-------|---------------------|
| Affordable | Green glow | Steady (no pulse) |
| Almost affordable | Blue pulse | Slow pulse rhythm |
| Conflict | Red pulse | Fast pulse + shake |
| Installing | Blue | Progress ring filling |

### Performance Settings

Provide visual fidelity options:

```
Minimal:  No particles, no glows, instant transitions
Clean:    Subtle glows, smooth transitions, no particles
Full:     All effects enabled (default)
```

---

## Timing Guidelines (From Flow Research)

### Flow Channel Targets

Based on Csikszentmihalyi's Flow Theory:

| Phase | Target Duration | Channel | Player State |
|-------|-----------------|---------|--------------|
| First click | 2-3s | Arousal | Learning |
| First install complete | 5-8s | Arousal | Building momentum |
| First conflict resolution | 10-15s | Arousal→Flow | Mastering mechanic |
| Standard beats | 30-60s | Flow | Optimal engagement |
| Late game beats | 60-120s | Flow | Extended flow |

### Tutorial Phase Timing

**First 30 seconds** (Arousal channel - learning):
- Root appears: t=0-3s
- First click hint visible: t=3-10s
- Player clicks: t=10-20s (expected)
- First install completes: t=25-30s

**First 2 minutes** (Arousal→Flow transition):
- Dependencies spawn and install
- Player clicks 3-5 more times
- First conflict appears: t=60-90s
- Conflict resolved: t=90-120s

**First 5 minutes** (Flow channel - engaged):
- HUD elements revealed
- Prestige bar becomes visible
- Player understands core loop

### Milestone Juice (High ROI)

Research shows 87% of successful games add juice to milestones:

| Milestone | Visual Treatment |
|-----------|------------------|
| First install | Slow-motion, large burst |
| First conflict resolved | Celebration particles, calm period |
| HUD element unlocks | Fade-in with glow halo |
| Prestige available | Black hole pulse, edge glow |
| Prestige complete | Full-screen flash, counter burst |

### Routine Interaction (Low ROI)

Only 23% of games add heavy juice to routine clicks. Avoid:
- Particles on every click (noise)
- Screen shake on normal installs (fatiguing)
- Sound on every action (annoying)

---

## Open Questions & Uncertainties

### 1. Edge Arrow Persistence

**Question:** How long should off-screen arrows persist?

**Options:**
- A) Until player pans to see the event (could be forever)
- B) Fixed duration (3-5s) then fade
- C) Until event resolves (conflict fixed, install complete)
- D) Hybrid: Persist for conflicts, fade for installs

**Current assumption:** Option D (hybrid approach)

**Needs playtesting.**

### 2. Multiple Off-Screen Events

**Question:** What happens with 5+ off-screen events?

**Options:**
- A) Show all arrows (cluttered)
- B) Show only most urgent (miss others)
- C) Aggregate into edge counter "3 ◀"
- D) Priority queue with rotation

**Current assumption:** Option C for same-type events

**Needs playtesting.**

### 3. Cost Line Complexity

**Question:** Does the hover cost-preview line add clarity or visual noise?

**Concerns:**
- May feel "hand-holdy" for experienced players
- Could clutter screen with many nodes
- Line rendering has performance cost

**Options:**
- A) Always show on hover
- B) Only show during first 10 clicks
- C) Make it a setting (default on)
- D) Only show when bandwidth is low

**Needs playtesting.**

### 4. First-Conflict Camera Behavior

**Question:** Should first conflict get special "spotlight" treatment?

**Current design:** Dim other nodes to 0.6 opacity

**Concerns:**
- May feel intrusive after the first time
- Players might not connect dimming with "look at this"

**Alternative:** Only dim nodes on first conflict, never again

**Needs playtesting.**

### 5. HUD Number Removal Feasibility

**Question:** Can players truly understand resources without any numbers?

**Concerns:**
- Weight scale dots might not convey magnitude clearly
- Players may want precise bandwidth amount
- Efficiency percentage is inherently numeric

**Options:**
- A) Pure visual (no numbers anywhere)
- B) Numbers appear on hover/click
- C) Settings toggle for numeric display
- D) Numbers only for secondary stats

**Needs playtesting.**

### 6. Prestige Teaching

**Question:** How do we teach prestige visually?

**Problem:** Prestige is counter-intuitive (lose progress to gain power)

**Ideas:**
- Black hole "pulls" nodes in as gravity builds (physics hint)
- Prestige button shows preview of reward (cache tokens)
- First prestige has extended animation showing "rebirth"
- Post-prestige, briefly show multiplier effect on bandwidth

**Not fully designed - needs iteration.**

### 7. Colorblind Accessibility

**Question:** Do our color choices work for colorblind players?

**Current palette concerns:**
- Red/green distinction (most common colorblindness)
- Blue/purple distinction

**Needs testing with:**
- Protanopia simulation
- Deuteranopia simulation
- Tritanopia simulation

**May need alternative palette option.**

---

## Research Sources

- **Alkahistorian** - Three-tier glow system, throttled affordability checking
- **A Dark Room** - Mystery-first design, environmental teaching
- **Candy Box 2** - Progressive disclosure, zero tutorials
- **Discovery Systems** - ??? placeholders, visibility states
- **NO_TEXT_DESIGN.md** - Shape/color language reference
- **Game Feel & Juice Validation** - Selective juice (milestone vs routine), accessibility
- **Pacing Beat Design Playbook** - Flow channels, timing targets, milestone importance
