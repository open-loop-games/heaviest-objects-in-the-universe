# The Heaviest Objects in the Universe
## Core Game Loop Design Document

> An incremental game about recursive dependencies, inspired by the horrors of `node_modules`

**Jam Theme:** Inception (recursive dependencies = layers within layers)
**Bonus Challenge:** No Text (shape/color communication only)
**Tech Stack:** TypeScript + Vue 3 + Canvas (Pixi.js or Canvas2D)

---

## 1. High Concept

You are a dependency resolver. Packages arrive. Each package explodes into dependencies. Dependencies explode into more dependencies. The tree grows. The weight increases. Eventually, gravity wins—the node_modules folder collapses into a singularity, and you prestige into a new ecosystem with better tools.

**Core Fantasy:** Taming chaos through optimization. The satisfaction of watching a messy, sprawling tree snap into an efficient, deduplicated web.

---

## 2. Resources & Currencies

### Primary Resources

| Resource | Symbol | Description | Generation |
|----------|--------|-------------|------------|
| **Bandwidth** | ↓ (down arrow) | Installation speed currency | Passive + click |
| **Packages** | □ (box) | Count of installed packages | Spend bandwidth |
| **Weight** | ◆ (diamond/heavy) | Total node_modules size (KB→MB→GB→TB) | Sum of all packages |
| **Heat** | ○→● (fill circle) | System strain, triggers events | Weight × inefficiency |

### Meta-Currencies (Persist through prestige)

| Currency | Symbol | Description | Source |
|----------|--------|-------------|--------|
| **Cache Tokens** | ⟲ (cycle) | Permanent speed multipliers | Prestige reward |
| **Algorithm Fragments** | △ (triangle) | Unlock new mechanics | Achievements + prestige |

### Derived Stats

| Stat | Formula | Effect |
|------|---------|--------|
| **Efficiency** | `unique_deps / total_deps` | Multiplies bandwidth |
| **Gravity** | `weight^1.5 / structure` | When > threshold, collapse begins |
| **Resolution Speed** | `base × cache_mult × efficiency × ecosystem_bonus` | How fast conflicts resolve |

---

## 3. Core Gameplay Loop

```
┌─────────────────────────────────────────────────────────────┐
│                     THE INSTALL LOOP                        │
│                      (30s - 2min)                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│   │  CLICK   │───▶│  BURST   │───▶│  SPREAD  │             │
│   │ Package  │    │ Open     │    │ Dependencies           │
│   └──────────┘    └──────────┘    └─────┬────┘             │
│                                         │                   │
│                                         ▼                   │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│   │  WEIGHT  │◀───│  GROW    │◀───│  CHAIN   │             │
│   │ Increases│    │ Tree     │    │ Reaction │             │
│   └────┬─────┘    └──────────┘    └──────────┘             │
│        │                                                    │
│        ▼                                                    │
│   ┌──────────┐         ┌──────────┐                        │
│   │  HEAT    │────────▶│ CONFLICT │ (sometimes)            │
│   │ Rises    │         │ Spawns   │                        │
│   └──────────┘         └─────┬────┘                        │
│                              │                              │
│                              ▼                              │
│                        ┌──────────┐                        │
│                        │  RESOLVE │ (player action)        │
│                        │ Conflict │                        │
│                        └──────────┘                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Phase 1: The Install (Player Action)
- **Click** the Root node or an existing package
- **Cost:** Bandwidth (scales at 1.15× per package owned)
- **Result:** A new package box appears, connected by a wire

### Phase 2: The Burst (Automatic)
- Package "opens" with a pop animation
- Spawns 1-5 dependency wires (weighted random)
- Each wire creates a new smaller package
- **Visual:** Satisfying explosion of geometry

### Phase 3: The Chain Reaction (Automatic)
- Each spawned dependency immediately begins its own burst
- Tree grows fractally for 2-4 generations
- **Inception moment:** Zoom into any package to see its internal tree

### Phase 4: Weight Accumulation (Passive)
- Total weight = sum of all package sizes
- Weight increases Heat
- Heat affects stability

### Phase 5: Conflict Generation (Event)
- At random intervals (based on Heat), a **Conflict** spawns
- Visual: A node turns red, shows mismatched shapes
- Must be resolved or tree branch pauses

---

## 4. Activity Systems (A+C Hybrid)

### Type A: Instant Actions (Manual)

| Action | Cost | Effect | Unlock |
|--------|------|--------|--------|
| **Install Package** | Bandwidth | Add new package to tree | Start |
| **Resolve Conflict** | Time (hold) | Fix version mismatch | Start |
| **Symlink** | None | Drag to deduplicate | Layer 2 |
| **Prune** | None | Remove unused branch | Layer 3 |
| **Force Push** | Heat | Instant resolve (adds heat) | Layer 4 |

### Type C: Continuous Production (Automatic)

| Producer | Base Rate | Scaling | Unlock |
|----------|-----------|---------|--------|
| **Bandwidth Regen** | 1/s | +10% per cache token | Start |
| **Auto-Install** | 0.1 pkg/s | ×1.5 per tier | Layer 1 |
| **Auto-Resolve** | 0.05/s | Based on algorithm level | Layer 2 |
| **Background Optimize** | Passive | Slowly improves efficiency | Layer 3 |

### Transition Curve
```
Early Game:  90% clicking, 10% passive
Mid Game:    50% clicking, 50% passive (symlink management)
Late Game:   20% clicking, 80% passive (optimization/prestige timing)
```

---

## 5. Conflict System (No-Text Mechanics)

Conflicts communicate through **shapes** and **colors** only.

### Shape Language

| Shape | Meaning |
|-------|---------|
| ● Circle | Stable/resolved |
| ■ Square | Version 1.x |
| ▲ Triangle | Version 2.x |
| ◆ Diamond | Version 3.x |
| ★ Star | Special/rare |

### Conflict Resolution (Visual)

```
CONFLICT STATE:
┌─────────┐         ┌─────────┐
│ Parent  │────────▶│ Child   │
│   [▲]   │   ✗     │   [■]   │  ← Red border = mismatch
└─────────┘         └─────────┘
   Needs               Has
  Triangle            Square

RESOLUTION OPTIONS:

Option A: Upgrade Child (hold on child)
┌─────────┐         ┌─────────┐
│   [▲]   │────────▶│ [■→▲]  │  ← Progress ring fills
└─────────┘         └─────────┘

Option B: Symlink (drag from matching node)
┌─────────┐         ┌─────────┐
│   [▲]   │◀── ─ ───│   [▲]   │  ← Dotted line = symlink
└─────────┘    │    └─────────┘
               │
          ┌────┴────┐
          │ [▲→●]   │  ← Original becomes stable
          └─────────┘
```

### Color Language

| Color | Meaning |
|-------|---------|
| Green | Healthy/optimal |
| Yellow | Warning/suboptimal |
| Orange | High heat/stress |
| Red | Conflict/error |
| Blue | Selected/active |
| Purple | Rare/special |
| Gray | Paused/inactive |
| White | Neutral/uninstalled |

---

## 6. Progression System

### Unlock Layers

```
LAYER 0: Genesis (0-50 packages)
├── Manual install only
├── Manual conflict resolution
└── Learn core mechanics

LAYER 1: Automation (50-500 packages)
├── Unlock: Auto-installer
├── Unlock: Bandwidth upgrades
└── First efficiency challenges

LAYER 2: Optimization (500-5,000 packages)
├── Unlock: Symlinking (deduplication)
├── Unlock: Auto-resolve (minor conflicts)
└── Efficiency becomes critical

LAYER 3: Architecture (5,000-50,000 packages)
├── Unlock: Monorepo mode
├── Unlock: Workspace management
├── Unlock: Pruning tools
└── Heat management critical

LAYER 4: Collapse (50,000+ packages)
├── Gravity visuals begin
├── Black hole forms at center
├── Prestige becomes available
└── Structure vs. Weight balance

PRESTIGE → New Ecosystem
├── Keep: Cache Tokens, Algorithm Fragments, Achievements
├── Reset: All packages, weight, current bandwidth
└── Gain: Ecosystem multiplier, new mechanics
```

### Upgrade Trees (Visual, No Text)

```
BANDWIDTH TREE:          EFFICIENCY TREE:         AUTOMATION TREE:
     [↓↓]                    [%+]                     [⚙]
    /    \                  /    \                   /    \
 [↓+]    [↓×]           [⟲+]    [◆-]             [▶]    [⟳]
  │        │              │        │               │        │
[↓++]    [↓××]         [⟲++]   [◆--]            [▶▶]    [⟳⟳]
```

Symbols communicate:
- `↓` = bandwidth, `+` = additive, `×` = multiplicative
- `⟲` = cache/reuse, `◆` = weight/size
- `▶` = auto-install, `⟳` = auto-resolve

---

## 7. Prestige System: Ecosystem Collapse

### The Black Hole Mechanic

As weight increases, visual gravity effects intensify:

```
Stage 1 (10K packages): Background starts subtle warping
Stage 2 (25K packages): Nodes drift slightly toward center
Stage 3 (50K packages): Visible gravitational pull
Stage 4 (75K packages): Black hole core visible
Stage 5 (100K packages): Collapse imminent, screen shakes
```

### Prestige Trigger

**Option A: Manual**
- Player clicks the black hole when ready
- Larger weight = more Cache Tokens

**Option B: Forced**
- If Gravity exceeds Structure, auto-collapse
- Penalty: 20% fewer Cache Tokens

### Prestige Formula

```
cache_tokens_gained = floor(sqrt(total_weight / 1000)) × efficiency_bonus

efficiency_bonus = 1 + (efficiency_rating × 0.5)
  where efficiency_rating = unique_packages / total_packages
```

### Ecosystem Tiers

| Tier | Name (Visual Only) | Base Multiplier | Special Mechanic |
|------|-------------------|-----------------|------------------|
| 1 | ● | 1× | — |
| 2 | ●● | 2× | Peer dependencies |
| 3 | ●●● | 4× | Optional dependencies |
| 4 | ●●●● | 8× | Workspaces |
| 5 | ★ | 16× | Monorepo mastery |

---

## 8. Feedback Loops

### Primary Loop: Install Cascade
```
Click → Package → Dependencies → More Packages → More Weight
  ↑                                                    │
  └──────────── Bandwidth Regen ◀─────────────────────┘
                (faster with efficiency)
```

### Secondary Loop: Optimization
```
Symlink → Reduce Duplicates → Increase Efficiency → More Bandwidth
   ↑                                                      │
   └────────────── More Packages to Symlink ◀────────────┘
```

### Prestige Loop: Ecosystem Growth
```
Collapse → Cache Tokens → Better Multipliers → Faster Growth
    ↑                                                │
    └──────────── Reach Higher Weight ◀─────────────┘
```

### Negative Feedback: Heat Management
```
More Packages → More Heat → More Conflicts → Slower Growth
       ↑                                          │
       └────── Resolve Conflicts (player skill) ◀─┘
```

---

## 9. Visual Design Specifications

### Canvas Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [↓ ████████░░ ] [◆ 1.2 GB] [○○○●●] [⟲ 15]                  │ ← HUD (top)
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                                                             │
│                    ┌───┐                                    │
│              ┌───┐─┤   ├─┌───┐                              │
│              │   │ └───┘ │   │                              │
│         ┌───┐└───┘   │   └───┘┌───┐                         │
│         │   │────────┼────────│   │                         │
│         └───┘        │        └───┘                         │
│              ┌───────┴───────┐                              │
│              │     ROOT      │                              │ ← Main canvas
│              └───────────────┘                              │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [Install ●] [Resolve ●] [Symlink ○] [Prune ○]              │ ← Tools (bottom)
└─────────────────────────────────────────────────────────────┘

Legend:
████ = Progress bars (no numbers, just fill)
○/● = Unlocked/locked indicators
```

### Node Design

```
PACKAGE NODE:
┌─────────┐
│  ┌───┐  │ ← Inner shape = version
│  │ ▲ │  │
│  └───┘  │
│ ○○○○●   │ ← Bottom dots = dependency count (filled = resolved)
└─────────┘
    │││
    └┴┴── Wires to children

STATES:
Normal:    White border, dark fill
Installing: Pulsing border animation
Conflict:   Red border, shape mismatch visible
Optimized:  Green glow, symlink indicator
Hot:        Orange/red gradient fill
```

### Animation Principles

1. **Burst**: Packages open like flowers, dependencies shoot out
2. **Connect**: Wires draw themselves, electron-style particles flow
3. **Conflict**: Shake animation, warning pulse
4. **Resolve**: Satisfying "snap" as shapes align
5. **Symlink**: Dotted line zips into place
6. **Collapse**: Spiral into center, particles compress

---

## 10. Audio Design (Conceptual)

Since no text, audio carries emotional weight:

| Event | Sound |
|-------|-------|
| Install click | Soft "pop" |
| Dependency burst | Rapid "pop-pop-pop" (bubble wrap) |
| Conflict spawn | Discordant tone |
| Conflict resolve | Satisfying "ding" |
| Symlink | Zipper/connect sound |
| Weight milestone | Deep bass note |
| Gravity warning | Low rumble |
| Collapse/prestige | Whoosh → silence → rebirth chime |

---

## 11. Balance Parameters

### Cost Scaling

```typescript
// Package install cost
const installCost = (owned: number, free: number = 0): number => {
  return Math.floor(BASE_COST * Math.pow(1.15, owned - free));
};

// BASE_COST = 10 bandwidth
// At 10 packages: ~40 bandwidth
// At 50 packages: ~10,000 bandwidth
// At 100 packages: ~1,000,000 bandwidth
```

### Production Rates

```typescript
const BASE_BANDWIDTH_REGEN = 1; // per second
const CACHE_TOKEN_MULTIPLIER = 1.10; // +10% per token

// Effective regen
const effectiveBandwidth = BASE_BANDWIDTH_REGEN
  * Math.pow(CACHE_TOKEN_MULTIPLIER, cacheTokens)
  * efficiency
  * ecosystemMultiplier;
```

### Prestige Timing

Target prestige points:
- First prestige: ~10-15 minutes
- Second prestige: ~8-10 minutes (faster due to tokens)
- Optimal prestige: When `time_to_next_milestone > time_to_prestige_and_return`

### Heat & Conflict Rates

```typescript
const HEAT_PER_PACKAGE = 0.01;
const HEAT_DECAY = 0.005; // per second
const CONFLICT_CHANCE = heat * 0.1; // per new package

// At 100 heat: 10% conflict chance per install
// At 50 heat: 5% conflict chance per install
```

---

## 12. Technical Architecture (Vue + Canvas)

```
src/
├── components/
│   ├── GameCanvas.vue      # Pixi.js or Canvas2D wrapper
│   ├── HUD.vue             # Resource bars, tool buttons
│   └── UpgradePanel.vue    # Visual upgrade trees
├── game/
│   ├── state.ts            # Reactive game state (Vue ref/reactive)
│   ├── loop.ts             # Game tick (requestAnimationFrame)
│   ├── packages.ts         # Package/dependency logic
│   ├── conflicts.ts        # Conflict generation/resolution
│   ├── prestige.ts         # Collapse/reset logic
│   └── formulas.ts         # Cost scaling, production rates
├── rendering/
│   ├── graph.ts            # Force-directed layout
│   ├── nodes.ts            # Package node rendering
│   ├── wires.ts            # Connection line rendering
│   └── effects.ts          # Particles, animations
└── App.vue
```

### State Management

```typescript
interface GameState {
  // Resources
  bandwidth: number;
  packages: Package[];
  weight: number;
  heat: number;

  // Meta (persisted)
  cacheTokens: number;
  algorithmFragments: number;
  ecosystemTier: number;
  achievements: Achievement[];

  // Derived (computed)
  efficiency: number;
  gravity: number;
  resolutionSpeed: number;
}
```

---

## 13. MVP Scope (Jam Version)

### Must Have (Week 1)
- [ ] Canvas with pan/zoom
- [ ] Root node + package installation
- [ ] Dependency burst animation (1 level deep)
- [ ] Weight counter with visual bar
- [ ] Basic prestige (manual trigger, simple multiplier)

### Should Have (Week 2)
- [ ] Multi-level dependency chains
- [ ] Conflict system (shape mismatch)
- [ ] Symlink mechanic
- [ ] Heat system with visual feedback
- [ ] Black hole collapse animation

### Nice to Have (Polish)
- [ ] Sound effects
- [ ] Particle effects
- [ ] Multiple ecosystem tiers
- [ ] Achievement system
- [ ] Offline progress

---

## 14. Design Decisions (Resolved)

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Interaction model** | Click-to-install | Simpler, faster feedback loop |
| **Zoom-inception** | Render inner trees | Core "inception" theme—see trees within trees |
| **Conflict punishment** | Soft (slows branch) | Keeps flow, doesn't frustrate |
| **Prestige depth** | Single layer | Jam scope—ship clean, not complex |
| **Platform** | Desktop only | Skip touch complexity for jam speed |

---

*Document Version: 0.2*
*Last Updated: 2024-12-28*
*Status: Decisions Locked - Ready for Implementation*
