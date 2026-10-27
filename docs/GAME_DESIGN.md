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
| **Weight** | ◆ | Total node_modules size | Sum of all package sizes |
| **Cache Fragments** | ✦ | Depth rewards (from map tier 3) | Collected during runs; each adds weight |

### Meta-Currencies (Persist through prestige)

| Currency | Symbol | Description | Source |
|----------|--------|-------------|--------|
| **Cache Tokens** | ⟲ | Permanent progression currency | Ship reward |

### Derived Stats

| Stat | Formula | Effect |
|------|---------|--------|
| **Quality (q)** | resolved / (resolved + open) problems this run | The HUD's quality bar and its tier feedback; the ship reward is linear in it |
| **Board progress** | scopes cascaded / the board's planned scopes | Progress toward Ship (100% = the board unpacked) |
| **Tier** | Derived from cache tokens | Unlocks depth, automation, upgrades |

No in-run currency gates the verb: installs are free, and acts on conflicts and duplicates
pay through q and combo at ship.

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
│   │  BOARD   │────────▶│   SHIP   │ (board unpacked)       │
│   │ Grows    │         │ Collapse │                        │
│   └──────────┘         └──────────┘                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Phase 1: Install (Player Action)
- **Click** the root node to spawn a top-level package
- **Cost:** none
- **Result:** A compressed package appears with empty internal `node_modules`

### Phase 2: Enter Scope (Player Action)
- **Click** a top-level package to dive inside
- Package state changes from `pristine` to `unstable`
- Triggers cascade spawning of dependencies

### Phase 3: Cascade (Automatic)
- Dependencies spawn with staggered timing (satisfying popcorn effect)
- Each spawn positioned radially from parent with physics velocity
- Spawn interval accelerates (120ms → 40ms minimum)
- Depth rewards: golden packages (8% at effective depth 3+, from map tier 3) give 4x weight + guaranteed fragment
- Sub-dependencies (40% chance) spawn after main queue

### Phase 4: Resolve Conflicts (Player Action)
- Conflicts appear on wires when incompatible packages exist
- **Click and hold** conflicted wire to resolve
- Resolution counts toward q and builds combo

### Phase 5: Optimize Duplicates (Player Action)
- Duplicate packages get colored halos (cyan, magenta, yellow, lime)
- Halos pulse faster with combo (2s calm → 0.5s urgent → solid at max)
- **Drag** one duplicate onto another to merge (symlink)
- Merging removes the duplicate from the tree; the run's gross weight, which pays, keeps it

### Phase 6: Stabilize & Exit
- When scope has 0 conflicts and 0 duplicates → stable (green glow)
- Exit scope to return to parent level
- Each resolved problem raises q

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

Every scope plants a set number of incompatible pairs, one conflict each (`TIER_BOARDS` in
`src/game/config.ts`), as it plants duplicate pairs. Chance pairings alone made conflicts a few
percent of a board's problems, which left auto-resolve, the slow player's equalizer, nothing to
clear.

**Visual:** Red crackling wire with electric bolts and sparks

**Resolution:** Click and hold wire → progress ring fills → resolved

### Duplicates & Symlinks (Halo-Based)

**Detection:** Same identity name across 2+ packages in scope

**Visual:** Colored halo ring around each duplicate:
- Cyan (0x22d3ee), Magenta (0xe879f9), Yellow (0xfde047), Lime (0xa3e635)

**Merge:** Drag one duplicate onto another:
- Keeps "better" node (compressed > lower depth > closer to center)
- Rewires all connections to kept node
- The duplicate's weight leaves the visible tree; gross weight keeps it, so a merge costs no take-home

### Combo System (Resolution Speed)

**Purpose:** Pace is the skill axis: a fast player chains acts, and the chain pays at ship

**Mechanic:**
- Combo counter (0-10) increments on each conflict resolve or symlink merge
- Decays to 0 after the spine's combo window (`comboWindow` in `src/game/spine.ts`)
- The ship reward multiplies by (1 + d̄)^e, d̄ the mean counter the run's acts found

**Visual Feedback:**
- Duplicate halos pulse faster: 2s (calm) → 1s (active) → 0.5s (urgent) → solid (max)

---

## 6. Progression System

### Map Tiers

A map tier is a finite board, and each adds one thing to it. A board's depth is its tier.

| Tier | Board | Adds |
|------|-------|------|
| **1** | utility lib | Conflicts and duplicates, one level of scopes |
| **2** | app | Nested scopes; conflicts between top-level packages |
| **3** | framework | Golden packages and cache fragments |
| **4** | monorepo | More top-level deps |
| **5** | enterprise app | The heaviest board; Collapse |

Each run draws a board plan from its seed (`src/game/board.ts`): the tier's top-level deps,
one chain of nested scopes to the tier's depth, and the rest of the spine's scope count
spread above it. Package weights are scaled so a board's expected gross weight is the
spine's board weight. Tiers are bought with cache tokens at the walk-solved prices in
`src/game/spine-solved.ts`; a ship buys every tier the wallet affords.

### Meta Upgrades

Upgrades are tracks of the meta layer, bought with cache tokens between runs. The spine
prices them (`TrackId` in `src/game/spine.ts`):

| Track | Effect |
|-------|--------|
| **Combo payout** | Raises the combo exponent e by the solved Δe per level |
| **Combo window** | Widens the combo decay window |
| **Auto-resolve** | Each level shortens the interval at which conflicts are cleared in scopes the player has left; the current scope's conflicts stay the player's |

Symlink merging stays manual (core gameplay). Surge is a run-setup choice: how hot to run
the board.

---

## 7. Prestige System: Ecosystem Collapse

### When a Run Ends

Ship appears once the board is unpacked: every top-level dep installed and every scope,
nested ones included, entered and cascaded. So q is the share of the whole board's
problems, and a hasty player ships early by leaving problems unresolved.

On a tier-5 board resolved completely, hold-to-collapse replaces Ship: the finale, once.
In Endless every board ships.

### Cache Token Reward Formula

The ship reward is `shipReward` in `src/game/spine.ts`, the one formula the balance spine
and the game share:

```
reward = κ × grossWeight × q × floor × (1 + d̄)^e × (1 + timedReward)^timedCleared
```

- **grossWeight**: everything the run spawned, plus fragment weight. Merges and prunes
  never subtract from it, so cleaning costs no take-home.
- **q**: the share of the run's problems (conflicts, duplicates) resolved at ship.
- **d̄**: the mean combo counter the run's player acts found. A player who never chains
  gets 1.
- **κ, e, floor, timedReward**: solved or anchored in the spine (`pnpm spine` prints them).

### What Persists

State is grouped by what resets it (`src/game/state.ts`):

| Scope | Holds | Reset by |
|-------|-------|----------|
| **Run** | The board, weight, fragments, this run's counters (combo, q's inputs), camera, the auto-resolve toggle | Ship (the run's Cycle), abandoning the run |
| **Game** | Cache tokens, ships, tier, meta upgrades, lifetime stats, onboarding | New Game+, hard reset |
| **Lifetime** | `hasCollapsed` (the text reveal), the cycle's run count and best time | Hard reset only |

Achievements and settings keep their own storage and survive every reset.

### Black Hole Animation

As the board unpacks:
1. Background warps toward center
2. Packages drift inward (gravitational pull)
3. Prestige button pulses with intensity
4. On trigger: spiral collapse, spaghettification effect, rebirth

---

## 8. Visual Design

### Color Language

| Color | Hex | Meaning |
|-------|-----|---------|
| **Blue** | 0x7a7aff | Installing, active |
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
| **WeightRow** | Weight progress, magnitude dots, prestige progress |
| **ScopeNavigation** | Back button, depth totem, conflict/dupe indicators |
| **AutomationRow** | Auto-resolve toggle, once a level is owned |
| **PrestigeOrbit** | Singularity button with gravitational effects |
| **QualityHero** | The quality bar (q) |
| **SettingsPanel** | Save, soft reset, hard reset |

---

## 9. Technical Architecture

```
src/
├── components/
│   ├── GameCanvas.vue      # Pixi.js canvas + input handling
│   └── hud/                # HUD components
│       ├── WeightRow.vue
│       ├── ScopeNavigation.vue
│       ├── AutomationRow.vue
│       ├── PrestigeOrbit.vue
│       ├── QualityHero.vue
│       └── SettingsPanel.vue
├── game/
│   ├── state.ts            # Game state over persistent refs, graph, engine
│   ├── types.ts            # Core interfaces (Package, Wire, GameState)
│   ├── loop.ts             # Game tick, physics, automation updates
│   ├── packages.ts         # Package creation, dependency spawning
│   ├── cascade.ts          # Staggered spawn system with depth rewards
│   ├── scope.ts            # Scope navigation (dive into packages)
│   ├── automation.ts       # Auto-resolve
│   ├── symlinks.ts         # Duplicate detection + merge logic
│   ├── registry.ts         # Real npm package identities + archetypes
│   ├── mutations.ts        # State mutations, prestige logic
│   ├── formulas.ts         # Cost scaling, reward calculations
│   ├── config.ts           # Game constants, initial state
│   └── persistence.ts      # Save/load through the engine save manager
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
- [x] Combo system (act pace → the reward's combo multiplier)
- [x] Automation system (auto-resolve)
- [x] Tier/progression system (5 tiers)
- [x] Prestige (black hole animation, cache tokens)
- [x] Depth rewards (golden packages, cache fragments)
- [x] Save/load (localStorage)
- [x] Package icons (Devicon + procedural fallback)
- [x] Full HUD
- [x] Quality bar (q)
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
| **Combo system** | Pays through the ship reward | Skill compounds with combo-payout levels, inside the 2-3x cap |

---

*Document Version: 1.1*
*Last Updated: 2026-01-12*
*Status: Reflects Current Implementation*
