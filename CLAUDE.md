# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**The Heaviest Objects in the Universe** - A game jam incremental game about recursive npm dependencies.

**Theme:** Inception (dependencies within dependencies)
**Constraint:** No text - communicate through shapes, colors, icons only
**Stack:** TypeScript + Vue 3 + Pixi.js

Core fantasy: Taming chaos through optimization. Watch a messy dependency tree snap into an efficient, deduplicated web.

**Game Jam:** https://itch.io/jam/new-years-incremental-game-jam-2026

## Code Conventions

- **Jam mentality:** Ship fast, iterate, don't over-engineer
- **No backwards compat:** Break things freely, no migration code
- **Prefer editing:** Modify existing files over creating new ones
- **Keep rendering pure:** Game logic in `game/`, visuals in `rendering/`

## Development Commands

```bash
pnpm dev          # Start dev server (Vite + HMR)
pnpm build        # Production build
pnpm typecheck    # Vue + TypeScript checking
pnpm lint         # ESLint
pnpm circular     # dpdm circular
```

## Architecture

```
src/
├── components/
│   ├── GameCanvas.vue    # Pixi.js canvas + input handling
│   └── hud/              # HUD components (resource bars, navigation, automation)
├── game/
│   ├── state.ts          # Reactive game state (Vue refs)
│   ├── types.ts          # Core interfaces (Package, Wire, GameState)
│   ├── events.ts         # Typed event bus (emit/on/once)
│   ├── ui-state.ts       # UI-specific state (drag, collapse, wiggle)
│   ├── loop.ts           # Game tick, physics updates
│   ├── packages.ts       # Package creation, dependency spawning
│   ├── cascade.ts        # Staggered spawn system with depth rewards
│   ├── scope.ts          # Scope navigation (dive into packages)
│   ├── automation.ts     # Auto-resolve (tier-gated)
│   ├── symlinks.ts       # Duplicate detection + merge logic
│   ├── registry.ts       # Real npm package identities + archetypes
│   ├── upgrades.ts       # Cache token upgrades + tier system
│   ├── config.ts         # Game constants, initial state factory
│   └── persistence.ts    # Save/load (localStorage)
├── rendering/
│   ├── renderer.ts       # Pixi.js setup, camera, world container
│   ├── nodes.ts          # Package node visuals (shapes, states, effects)
│   ├── wires.ts          # Dependency line rendering
│   └── colors.ts         # Color palette, state mappings
└── onboarding/
    ├── book-state.ts     # Teaching book UI state (tabs, unlocks)
    ├── tutorial-state.ts # Ghost hand hint prioritization
    ├── tutorial-cursor.ts# Click/drag animation rendering
    ├── hint-timers.ts    # Per-hint inactivity tracking
    └── animations/       # Pixi.js mechanic demos (install, conflicts, etc.)
```

### Key Patterns

**State:** Vue reactivity for resources; `Map<string, Package>` for graph
**Scopes:** Top-level packages contain their own `internalPackages` + `internalWires` maps
**Rendering:** Layered Pixi containers (wires behind nodes)
**Physics:** Force-directed layout with repulsion/attraction
**Game Loop:** `requestAnimationFrame` → physics → cascade spawning → automation → rendering
**Events:** Typed pub/sub via `emit()`/`on()` for decoupled cross-module communication
**Onboarding:** Ghost Hand = primary teacher (shows HOW after inactivity), Teaching Book = passive reference (shows WHAT)

## Design Documents

- `docs/GAME_DESIGN.md` - Full mechanics, progression, balance
- `docs/PRESTIGE_PROGRESSION.md` - Tier system, cache tokens, unlocks
- `docs/CONCEPT.md` - Original concept
- `docs/archived/` - Legacy design docs (may be outdated)
- `TODO.md` - Incomplete work tracking

## No-Text Communication (STRICT)

**Jam rule:** "Anything you can type out is text; symbols are fine."

This means **NO numbers, NO letters** anywhere in the game UI. Only:
- Unicode symbols (↓ ◆ ★ ⚡ ⟲ ← ✓)
- Geometric shapes (rendered graphics)
- Progress bars, fill levels, dot counters
- Colors and animations

| Element | Meaning |
|---------|---------|
| **Package icons** | Identity (Devicon for real packages, archetype fallbacks) |
| **Border color** | State (blue=installing, green=ready, red=conflict, cyan=optimized) |
| **Fill color** | Package type/archetype |
| **Progress ring** | Installation/resolution progress |
| **Wire style** | Solid=dependency, dashed=symlink, red crackling=conflict |
| **Portal rings** | Top-level packages have internal scopes (pristine/unstable/stable) |
| **Glows/Halos** | Duplicate detection, affordability hints |
| **Golden glow** | Depth 3+ reward package (4x weight) |
| **Bar fill** | Resource amount (NOT numeric display) |

## Game Mechanics

**Resources:**
- Bandwidth (↓) - spent to install, regenerates over time
- Weight (◆) - total node_modules size, triggers ship
- Cache Fragments - depth rewards, convert to tokens on ship
- Cache Tokens - meta-currency, persistent across runs

**Core Loop:**
1. Click root → spawn top-level package (has internal scope)
2. Click top-level package → enter scope, trigger cascade
3. Cascade spawns dependencies with staggered timing + depth rewards
4. Conflicts appear on wires → click wire to Prune
5. Duplicates detected → drag to merge (symlink)
6. Stabilize scope → exit with satisfaction
7. Weight accumulates → **Ship to npm** at threshold → gain cache tokens

**Ship & Collapse:**
- **Ship to npm** (soft reset): When weight fills the bar, ship your packages to the registry. Resets run, grants cache tokens based on weight + efficiency. Repeatable.
- **Collapse** (hard ending): At Tier 5, hold the collapse button (5 seconds) to trigger the finale. Black hole consumes everything. Shows end screen with lifetime stats. Option to continue in Endless Mode.

**Scope System:**
- Top-level packages are "compressed" - they contain internal node_modules
- Click to dive in, back button to exit
- Internal state: pristine → unstable (has conflicts/dupes) → stable (resolved)
- Depth totem shows current scope level (max depth = tier)

**Progression (Tiers 1-5):**
- Tier 1: Base game, depth 1 only
- Tier 2: Depth 2 unlocked, auto-resolve available
- Tier 3: Depth 3+, golden packages spawn
- Tier 4-5: Deeper nesting, faster automation
- Tier 5: Collapse available (finale)

**Automation (Tier 2+):**
- Auto-resolve: Automatically resolves conflicts when enabled

## Current Implementation Status

**Working:**
- Canvas with pan/zoom
- Package installation + cascade spawning
- Scope system (dive into packages, navigate back)
- Force-directed physics (per-scope)
- Wire-based conflict system (Prune/Upgrade)
- Duplicate detection + symlink merge UI
- Automation system (auto-resolve)
- Tier/progression system
- Ship to npm (soft prestige, cache tokens)
- Collapse finale (Tier 5 black hole ending, end screen)
- Depth rewards (golden packages, cache fragments)
- Save/load (localStorage)
- Package icons (Devicon integration)
- HUD with integrated upgrades
- Resource bars, scope navigation, automation toggles
- Event system (typed event bus)
- Teaching book (tabbed drawer with Pixi animations)
- Ghost hand hints (inactivity-triggered tutorials)
- Curated starter-kit (slower cascade, deferred conflicts)

**Not Started:**
- Particle effects (beyond basic ripples)
