# The Heaviest Objects in the Universe
## Core Game Design Document

> An incremental game about recursive dependencies, inspired by the horrors of `node_modules`

**Jam Theme:** Inception (recursive dependencies = layers within layers)
**Bonus Challenge:** No Text (shape/color communication only)
**Tech Stack:** TypeScript + Vue 3 + Pixi.js

---

## 1. High Concept

You are a dependency resolver. Packages arrive. Each package contains its own `node_modules` folder you can dive into. Dependencies cascade, conflicts erupt, duplicates multiply. Resolve the chaos, optimize the tree, and watch it all collapse into a black hole—then prestige into a new ecosystem with better tools.

**Core Fantasy:** Taming chaos through optimization. The satisfaction of watching a messy, sprawling tree snap into an efficient, deduplicated web.

---

## 2. Resources & Currencies

### Primary Resources

| Resource | Symbol | Description | Generation |
|----------|--------|-------------|------------|
| **Bandwidth** | ↓ | Installation currency | Passive regen + momentum from actions |
| **Weight** | ◆ | Total node_modules size | Sum of all package sizes |
| **Cache Fragments** | ✦ | Depth rewards (depth 2+) | Collected during runs, convert on prestige |

### Meta-Currencies (Persist through prestige)

| Currency | Symbol | Description | Source |
|----------|--------|-------------|--------|
| **Cache Tokens** | ⟲ | Permanent progression currency | Prestige reward + fragments (5:1) |

### Derived Stats

| Stat | Formula | Effect |
|------|---------|--------|
| **Efficiency** | `optimized_weight / total_weight` | 0.5x-1.5x prestige reward multiplier |
| **Stability** | Ratio of stable scopes | 0.7x-1.0x prestige bonus |
| **Gravity** | `weight / threshold` | Progress toward prestige (100% = ready) |
| **Tier** | Derived from cache tokens | Unlocks depth, automation, upgrades |

### Momentum System

The game uses a "momentum loop" where actions generate bandwidth:
- **Cascade spawns**: Free (0 bandwidth cost)
- **Conflict resolution**: Generates 15 bandwidth
- **Symlink merge**: Generates 20 bandwidth
- **Install cost**: 25 × tier × 1.15^activeScopes (entry gate only)
- **Base safety regen**: 2-4 bandwidth/tick by tier

---

## 3. Core Gameplay Loop

```
┌─────────────────────────────────────────────────────────────┐
│                     THE SCOPE LOOP                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│   │  CLICK   │───▶│  ENTER   │───▶│ CASCADE  │             │
│   │  Root    │    │  Scope   │    │ Spawns   │             │
│   └──────────┘    └──────────┘    └─────┬────┘             │
│                                         │                   │
│                                         ▼                   │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│   │  EXIT    │◀───│ OPTIMIZE │◀───│ RESOLVE  │             │
│   │  Scope   │    │ Duplicates    │ Conflicts │             │
│   └────┬─────┘    └──────────┘    └──────────┘             │
│        │                                                    │
│        ▼                                                    │
│   ┌──────────┐         ┌──────────┐                        │
│   │  WEIGHT  │────────▶│ PRESTIGE │ (at threshold)         │
│   │ Grows    │         │ Collapse │                        │
│   └──────────┘         └──────────┘                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Phase 1: Install (Player Action)
- **Click** the root node to spawn a top-level package
- **Cost:** Bandwidth (scales with tier and active scopes)
- **Result:** A compressed package appears with empty internal `node_modules`

### Phase 2: Enter Scope (Player Action)
- **Click** a top-level package to dive inside
- Package state changes from `pristine` to `unstable`
- Triggers cascade spawning of dependencies

### Phase 3: Cascade (Automatic)
- Dependencies spawn with staggered timing (satisfying popcorn effect)
- Each spawn positioned radially from parent with physics velocity
- Spawn interval accelerates (120ms → 40ms minimum)
- Depth rewards: golden packages (8% at depth 3+, requires P1+) give 4x weight + guaranteed fragment
- Sub-dependencies (40% chance) spawn after main queue

### Phase 4: Resolve Conflicts (Player Action)
- Conflicts appear on wires when incompatible packages exist
- **Click and hold** conflicted wire to resolve
- Resolution generates momentum (bandwidth)

### Phase 5: Optimize Duplicates (Player Action)
- Duplicate packages get colored halos (cyan, magenta, yellow, lime)
- Halos pulse faster with combo (2s calm → 0.5s urgent → solid at max)
- **Drag** one duplicate onto another to merge (symlink)
- Merging reduces weight based on combo: 50% at combo 0, 0% at combo 10

### Phase 6: Stabilize & Exit
- When scope has 0 conflicts and 0 duplicates → stable (green glow)
- Exit scope to return to parent level
- Stable scopes grant efficiency bonus

---

## 4. Scope System (Inception Mechanic)

### Compressed Packages
Top-level packages are "compressed" - they contain internal `node_modules`:
```
root (package.json)
├── express (compressed) ─────────────────┐
│   └── internal node_modules:            │
│       ├── body-parser                   │ Click to
│       ├── cookie-parser                 │ dive in
│       └── debug                         │
├── lodash (compressed) ──────────────────┘
└── ...
```

### Scope Navigation
- **Scope Stack:** `[]` = root, `[pkgId]` = depth 1, `[pkgId, internalId]` = depth 2+
- **Enter:** Click compressed package (cyan portal ring)
- **Exit:** Back button or click outside scope
- **Max Depth:** Limited by tier (Tier N = depth N)

### Internal States
| State | Visual | Meaning |
|-------|--------|---------|
| `pristine` | Cyan pulsing glow | Never entered, click to explore |
| `unstable` | Red pulsing glow | Has conflicts or duplicates |
| `stable` | Green steady glow | All resolved, optimized |

---

## 5. Conflict & Symlink Systems

### Conflicts (Wire-Based)

**Trigger:** Incompatible package pairs (real npm tensions):
- Framework wars: React vs Vue vs Angular vs Svelte
- HTTP clients: request vs axios
- Utilities: lodash vs underscore
- Bundlers: webpack vs parcel vs rollup
- Test runners: jest vs mocha vs vitest

**Visual:** Red crackling wire with electric bolts and sparks

**Resolution:** Click and hold wire → progress ring fills → resolved

### Duplicates & Symlinks (Halo-Based)

**Detection:** Same identity name across 2+ packages in scope

**Visual:** Colored halo ring around each duplicate:
- Cyan (0x22d3ee), Magenta (0xe879f9), Yellow (0xfde047), Lime (0xa3e635)

**Merge:** Drag one duplicate onto another:
- Keeps "better" node (compressed > lower depth > closer to center)
- Rewires all connections to kept node
- Weight removal scales with combo: 50% at combo 0, 0% at combo 10

### Combo System (Resolution Speed)

**Purpose:** Reward fast, skilled play with better weight retention

**Mechanic:**
- Combo counter (0-10) increments on each conflict resolve or symlink merge
- Decays to 0 after 3 seconds of inactivity
- Higher combo = less weight removed on merge

**Visual Feedback:**
- Duplicate halos pulse faster: 2s (calm) → 1s (active) → 0.5s (urgent) → solid (max)
- Weight-loss particles shrink/disappear at high combo

**Impact:**
- Combo 0: 50% weight removed on merge
- Combo 5: 25% weight removed
- Combo 10: 0% weight removed (pure efficiency gain)

---

## 6. Progression System

### Tier System (Cache Token Thresholds)

| Tier | Tokens | Max Depth | Unlocks |
|------|--------|-----------|---------|
| **1** | 0 | 1 | Base game, single-level packages |
| **2** | 9 | 2 | Auto-resolve, Resolve Speed upgrade |
| **3** | 21 | 3 | Golden packages* |
| **4** | 42 | 4 | Faster automation intervals |
| **5** | 63 | 5 | Maximum automation speed |

\* Golden packages require first prestige (P1+) in addition to Tier 3 depth unlock

### Automation (Tier-Gated)

| Feature | Unlock | Base Interval | Effect |
|---------|--------|---------------|--------|
| **Auto-Resolve** | Tier 2 | 3s→2s→1s→0.5s | Resolves conflicted wires automatically |

Note: Symlink merging stays manual (core gameplay)

### Upgrade Tracks (5 Total)

| Upgrade | Icon | Max | Unlock | Effect |
|---------|------|-----|--------|--------|
| **Bandwidth** | ↓ | 15 | P1+ | +10% capacity per level |
| **Efficiency** | ⚡ | 12 | 15 pkgs | -6% install cost, +25% speed |
| **Compression** | ◆↓ | 8 | P3+ | -5% weight gain per level |
| **Resolve Speed** | ⚙+ | 5 | Tier 2 | -10% drain, +15% speed |
| **Surge** | ◎ | 9 | T1+ | +1 surge segment per level |

### Surge System (T1+)

Available from Tier 1 to give early "reserve vs spend" bandwidth choice.

- Charge up to 10 segments (costs 10% max bandwidth each)
- Only consumed at depth 2+ (not on first dive into package)
- Effects per charged segment:
  - +8% cascade size multiplier
  - +5% package count boost
  - +0.5% golden package chance
  - +0.4% cache fragment chance
- Teaching book tab unlocks after first charge

---

## 7. Prestige System: Ecosystem Collapse

### Prestige Thresholds

| Prestige | Weight Required | Formula |
|----------|-----------------|---------|
| P0→P1 | 5,000 | Tutorial threshold |
| P1→P2 | 20,000 | Fixed |
| P2→P3 | 36,000 | 20,000 × 1.8 |
| P3→P4 | 65,000 | 20,000 × 1.8² |
| Pn→Pn+1 | — | 20,000 × 1.8^(n-1) |

**Note:** Prestige unlocks when **peak weight ever reached** >= threshold. This prevents "optimization lockout" where merging duplicates drops you below the threshold.

### Cache Token Reward Formula

```
baseReward = sqrt(weight / threshold) × 3
efficiencyMultiplier = 0.5 + (efficiency × 1.0)  // 0.5x at 0%, 1.5x at 100%
stabilityBonus = 0.7 + (stability × 0.3)         // 0.7x to 1.0x
fragmentBonus = floor(cacheFragments / 5)        // 5 fragments = 1 token

finalReward = floor(baseReward × efficiencyMultiplier × stabilityBonus) + fragmentBonus
```

### What Persists

**Keeps:**
- Cache tokens (accumulated)
- All upgrade levels
- Total prestige count
- Ecosystem tier

**Resets:**
- All packages and wires
- Bandwidth (reset to 100 × tier)
- Weight (reset to 0)
- Cache fragments (converted to tokens)
- Automation toggles (must re-enable)

### Black Hole Animation

As weight approaches threshold:
1. Background warps toward center
2. Packages drift inward (gravitational pull)
3. Prestige button pulses with intensity
4. On trigger: spiral collapse, spaghettification effect, rebirth

---

## 8. Visual Design

### Color Language

| Color | Hex | Meaning |
|-------|-----|---------|
| **Blue** | 0x7a7aff | Installing, active, bandwidth |
| **Green** | 0x5aff5a | Ready, stable, healthy |
| **Red** | 0xff5a5a | Conflict, danger, unstable |
| **Cyan** | 0x5affff | Optimized, symlink, pristine scope |
| **Gold** | 0xffd700 | Golden package, cache fragment, depth reward |
| **Orange** | 0xffaa5a | Warning, paused |
| **Gray** | 0x6a6a7a | Unaffordable, inactive |

### Package Visuals

| Element | Visual |
|---------|--------|
| **Fill color** | State (installing/ready/conflict/optimized) |
| **Border color** | State highlight (brighter version) |
| **Progress ring** | Installation/resolution progress |
| **Portal rings** | 3 concentric rings on compressed packages |
| **Golden fill ring** | Depth 3+ reward package |
| **Cache fragment pip** | Gold diamond badge (left side) |
| **Duplicate halo** | Colored pulsing ring |
| **Ghost style** | Semi-transparent, dashed cyan border |

### Wire Visuals

| Type | Visual |
|------|--------|
| **Normal** | Solid muted purple line with flow particle |
| **Conflict** | Red with electric crackling, sparks at junctions |
| **Symlink** | Dashed cyan with glow |

### Package Icons

Three-tier system:
1. **Semantic Icons:** Custom-drawn for major packages (React, Vue, etc.)
2. **Devicon SVGs:** Real npm package icons with hue variants
3. **Procedural Fallback:** Hash-based shapes by archetype (utility/framework/tooling)

### HUD Components

| Component | Purpose |
|-----------|---------|
| **BandwidthRow** | Segmented bar, cost preview, upgrade pips |
| **WeightRow** | Weight progress, magnitude dots, prestige progress |
| **ScopeNavigation** | Back button, depth totem, conflict/dupe indicators |
| **AutomationRow** | Auto-resolve toggle with speed pips |
| **PrestigeOrbit** | Singularity button with gravitational effects |
| **SurgeRow** | Draggable charge bar (T1+) |
| **QualityHero** | Efficiency/stability bars |
| **SettingsPanel** | Save, soft reset, hard reset |

---

## 9. Technical Architecture

```
src/
├── components/
│   ├── GameCanvas.vue      # Pixi.js canvas + input handling
│   └── hud/                # 8 HUD components
│       ├── BandwidthRow.vue
│       ├── WeightRow.vue
│       ├── ScopeNavigation.vue
│       ├── AutomationRow.vue
│       ├── PrestigeOrbit.vue
│       ├── SurgeRow.vue
│       ├── QualityHero.vue
│       └── SettingsPanel.vue
├── game/
│   ├── state.ts            # Reactive game state (Vue refs)
│   ├── types.ts            # Core interfaces (Package, Wire, GameState)
│   ├── loop.ts             # Game tick, physics, automation updates
│   ├── packages.ts         # Package creation, dependency spawning
│   ├── cascade.ts          # Staggered spawn system with depth rewards
│   ├── scope.ts            # Scope navigation (dive into packages)
│   ├── automation.ts       # Auto-resolve
│   ├── symlinks.ts         # Duplicate detection + merge logic
│   ├── registry.ts         # Real npm package identities + archetypes
│   ├── upgrades.ts         # Cache token upgrades + tier system
│   ├── mutations.ts        # State mutations, prestige logic
│   ├── formulas.ts         # Cost scaling, reward calculations
│   ├── config.ts           # Game constants, initial state
│   └── persistence.ts      # Save/load (localStorage)
└── rendering/
    ├── renderer.ts         # Pixi.js setup, camera, containers
    ├── nodes.ts            # Package visuals (states, icons, effects)
    ├── wires.ts            # Dependency/symlink/conflict rendering
    └── colors.ts           # Color palette
```

### Key Patterns

- **State:** Vue reactivity for resources; `Map<string, Package>` for graph
- **Scopes:** Packages contain `internalPackages` + `internalWires` maps
- **Rendering:** Layered Pixi containers (wires behind nodes)
- **Physics:** Force-directed layout with repulsion/attraction (per-scope)
- **Game Loop:** `requestAnimationFrame` → physics → cascade → automation → rendering

---

## 10. Implementation Status

### ✅ Complete

- [x] Canvas with pan/zoom
- [x] Package installation + cascade spawning
- [x] Scope system (dive into packages, navigate back)
- [x] Force-directed physics (per-scope)
- [x] Wire-based conflict system (resolution with hold)
- [x] Duplicate detection + symlink merge UI
- [x] Combo system (resolution speed → weight retention)
- [x] Automation system (auto-resolve)
- [x] Tier/progression system (5 tiers)
- [x] Prestige (black hole animation, cache tokens)
- [x] Depth rewards (golden packages, cache fragments)
- [x] Surge system (T1+)
- [x] Save/load (localStorage)
- [x] Package icons (Devicon + procedural fallback)
- [x] Full HUD
- [x] Quality metrics (efficiency/stability)
- [x] 5 upgrade tracks

### 🚧 Not Started

- [ ] Sound effects
- [ ] Particle effects (beyond basic ripples)
- [ ] Offline progress

---

## 11. Design Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Conflict model** | Wire-based (not package) | Clear visual, resolves relationship not node |
| **Scope system** | Compressed packages | Core "inception" theme—trees within trees |
| **Cascade timing** | Staggered spawns | Satisfying popcorn effect, manageable chaos |
| **Prestige depth** | Single layer | Jam scope—ship clean, not complex |
| **Automation** | Tier-gated, optional | Player choice, doesn't trivialize gameplay |
| **Symlink merging** | Manual only | Core interaction, too satisfying to automate |
| **Combo system** | Speed-based retention | Rewards skilled play, prevents optimization lockout |

---

*Document Version: 1.1*
*Last Updated: 2026-01-12*
*Status: Reflects Current Implementation*
