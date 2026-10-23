# AGENTS.md

Repo conventions — read this whether you are Claude Code, Codex, opencode
or anything else. `.claude/CLAUDE.md` imports this file rather than restating it, so this is
the one home for the content; edit here.

## Project Overview

**The Heaviest Objects in the Universe** - A game jam incremental game about recursive npm dependencies.

**Theme:** Inception (dependencies within dependencies)
**Constraint:** No text until first win (see below)
**Stack:** TypeScript + Vue 3 + Pixi.js

Core fantasy: Taming chaos through optimization. Watch a messy dependency tree snap into an efficient, deduplicated web.

**Game Jam:** https://itch.io/jam/new-years-incremental-game-jam-2026
**Status:** Submitted! Now doing post-jam feedback polish.

## Code Conventions

- **Jam mentality:** Ship fast, iterate, don't over-engineer
- **No backwards compat:** Break things freely, no migration code
- **Prefer editing:** Modify existing files over creating new ones
- **Keep rendering pure:** Game logic in `game/`, visuals in `rendering/`
- **Direct cutover for ports:** delete the old shape, write the new, fix call sites — no staged dual-write or mirror fields. When porting to engine primitives, the engine wrapper (`GraphNode<T>`/`GraphEdge<T>`) carries id/topology; don't denormalize `id`/`parentId`/`children` onto the payload — readers unwrap.

## Development Commands

```bash
pnpm dev          # Start dev server (Vite + HMR)
pnpm build        # Production build
pnpm typecheck    # Vue + TypeScript checking
pnpm lint         # oxlint --fix (rewrites files)
pnpm lint:check   # oxlint, read-only
pnpm circular     # dpdm circular
```

## Architecture

```
src/
├── components/
│   ├── GameCanvas.vue    # Pixi.js canvas + input handling
│   └── hud/              # HUD components (quality and weight bars, navigation, automation)
├── game/
│   ├── state.ts          # Game state over persistent refs, graph, and the engine instance
│   ├── ship.ts           # Ship: the run's end, an engine Cycle over the run's refs
│   ├── prestige.ts       # Abandon-run, New Game+ and hard resets
│   ├── types.ts          # Core interfaces (Package, Wire, GameState)
│   ├── events.ts         # Typed event bus (emit/on/once)
│   ├── ui-state.ts       # UI-specific state (drag, collapse, wiggle)
│   ├── loop.ts           # Game tick, physics updates
│   ├── packages.ts       # Package creation, dependency spawning
│   ├── board.ts          # The run's board: map tier data, seeded plan, weight scale
│   ├── cascade.ts        # Staggered spawn system with depth rewards
│   ├── scope.ts          # Scope navigation (dive into packages)
│   ├── automation.ts     # Auto-resolve (a meta upgrade)
│   ├── symlinks.ts       # Duplicate detection + merge logic
│   ├── registry.ts       # Real npm package identities + archetypes
│   ├── config.ts         # Game constants, initial state factory
│   └── persistence.ts    # Save/load through the engine save manager
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

**State:** one reactive facade over engine persistent refs, grouped by what resets them (run, game, lifetime); never assign a whole section. Topology on the engine Graph + ScopeStack
**Scopes:** Top-level packages contain their own `internalPackages` + `internalWires` maps
**Rendering:** Layered Pixi containers (wires behind nodes)
**Physics:** Force-directed layout with repulsion/attraction
**Game Loop:** `requestAnimationFrame` → physics → cascade spawning → automation → rendering
**Events:** Typed pub/sub via `emit()`/`on()` for decoupled cross-module communication
**Onboarding:** Ghost Hand = primary teacher (shows HOW after inactivity), Teaching Book = passive reference (shows WHAT)

## Design Documents

- `docs/GAME_DESIGN.md` - Full mechanics, progression, balance
- `docs/archived/` - Legacy design docs (may be outdated)
- `TODO.md` - Incomplete work tracking

## No-Text Communication (Until First Win)

**Jam rule:** "Anything you can type out is text; symbols are fine."

**Before first collapse (win):** NO numbers, NO letters anywhere in the game UI. Only:
- Unicode symbols (↓ ◆ ★ ⚡ ⟲ ← ✓)
- Geometric shapes (rendered graphics)
- Progress bars, fill levels, dot counters
- Colors and animations

**After first collapse:** Text is unlocked as a reward. The End Screen, achievements, and stats can display text labels alongside icons. This creates a satisfying "reveal moment" where the game finally speaks to you.

| Element | Meaning |
|---------|---------|
| **Package icons** | Identity (Devicon for real packages, archetype fallbacks) |
| **Border color** | State (blue=installing, green=ready, red=conflict, cyan=optimized) |
| **Fill color** | Package type/archetype |
| **Progress ring** | Installation/resolution progress |
| **Wire style** | Solid=dependency, dashed=symlink, red crackling=conflict |
| **Portal rings** | Top-level packages have internal scopes (pristine/unstable/stable) |
| **Glows/Halos** | Duplicate detection, affordability hints |
| **Golden glow** | Reward package on tier 3+ boards (4x weight) |
| **Bar fill** | Resource amount (NOT numeric display) |

## Game Mechanics

**Resources:**
- Weight (◆) - total node_modules size; the gross weight a run installs pays at ship
- Cache Fragments - depth rewards; each collected fragment adds weight
- Cache Tokens - meta-currency, persistent across runs

No in-run currency gates installs.

**Core Loop:**
1. Click root → spawn top-level package (has internal scope)
2. Click top-level package → enter scope, trigger cascade
3. Cascade spawns dependencies with staggered timing + depth rewards
4. Conflicts appear on wires → click wire to Prune
5. Duplicates detected → drag to merge (symlink)
6. Stabilize scope → exit with satisfaction
7. The board unpacks (every scope entered) → **Ship to npm** → gain cache tokens

**Ship & Collapse:**
- **Ship to npm** (soft reset): once the board is unpacked, ship it to the registry. Ends the run; grants cache tokens by gross weight, q and combo (`shipReward` in `src/game/spine.ts`). Repeatable.
- **Collapse** (hard ending): a tier-5 board resolved completely offers it in place of Ship; hold the collapse button (5 seconds) to trigger the finale. Black hole consumes everything. Shows end screen with lifetime stats. Option to continue in Endless Mode.

**Scope System:**
- Top-level packages are "compressed" - they contain internal node_modules
- Click to dive in, back button to exit
- Internal state: pristine → unstable (has conflicts/dupes) → stable (resolved)
- Depth totem shows current scope level (max depth = tier)

**Progression (map tiers 1-5):** each tier is a finite board drawn from a seeded plan
(`src/game/board.ts`), bought with cache tokens; a board's depth is its tier.
- Tier 1: utility lib, depth 1
- Tier 2: app, nested scopes and cross-package conflicts
- Tier 3: framework, golden packages and fragments
- Tier 4: monorepo, more top-level deps
- Tier 5: enterprise app, Collapse available (finale)

**Automation (meta upgrade):**
- Auto-resolve: resolves conflicts in scopes the player has left, when enabled

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
- Save/load (engine save manager: versioned, compressed, protects a save that fails to load)
- Package icons (Devicon integration)
- HUD (quality, weight, automation)
- Resource bars, scope navigation, automation toggles
- Event system (typed event bus)
- Teaching book (tabbed drawer with Pixi animations)
- Ghost hand hints (inactivity-triggered tutorials)
- Curated starter-kit (slower cascade, deferred conflicts)

**In Progress (Post-Jam Polish):**
- End screen improvements (Restart button, endless mode indicator)
- Achievement system (icon-only until win, text revealed after)

**Not Started:**
- Particle effects (beyond basic ripples)
