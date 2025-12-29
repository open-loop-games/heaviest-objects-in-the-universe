# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**The Heaviest Objects in the Universe** - A game jam incremental game about recursive npm dependencies.

**Theme:** Inception (dependencies within dependencies)
**Constraint:** No text - communicate through shapes, colors, icons only
**Stack:** TypeScript + Vue 3 + Pixi.js

Core fantasy: Taming chaos through optimization. Watch a messy dependency tree snap into an efficient, deduplicated web.

**Game Jam:** https://itch.io/jam/new-years-incremental-game-jam-2026

## Development Commands

```bash
pnpm dev          # Start dev server (Vite + HMR)
pnpm build        # Production build
pnpm typecheck    # Vue + TypeScript checking
pnpm lint         # ESLint
```

## Architecture

```
src/
├── components/
│   ├── GameCanvas.vue    # Pixi.js canvas + input handling
│   └── HUD.vue           # Resource bars, tools (uses unicode symbols)
├── game/
│   ├── state.ts          # Reactive game state (Vue refs)
│   ├── loop.ts           # Game tick, physics, spawning
│   ├── packages.ts       # Package/dependency tree management
│   ├── formulas.ts       # Cost scaling, production rates
│   └── types.ts          # Core interfaces
└── rendering/
    ├── renderer.ts       # Pixi.js setup, camera, world container
    ├── nodes.ts          # Package node visuals (shapes, states)
    ├── wires.ts          # Dependency line rendering
    └── colors.ts         # Color palette, state mappings
```

### Key Patterns

**State:** Vue reactivity for resources; `Map<string, Package>` for graph
**Rendering:** Layered Pixi containers (wires behind nodes)
**Physics:** Force-directed layout with repulsion/attraction
**Game Loop:** `requestAnimationFrame` → physics → spawning → rendering

## Design Documents

- `docs/GAME_DESIGN.md` - Full game design doc (mechanics, progression, balance)
- `docs/VISUAL_DESIGN.md` - Complete visual language and teaching systems
- `docs/CONFLICT_SYMLINK_REDESIGN.md` - Wire-based conflicts, halo-based symlinks (implemented)
- `docs/RESEARCH_NPM_HEAVY_PACKAGES.md` - Real npm data, icon sources
- `TODO.md` - Incomplete work tracking

## No-Text Communication (STRICT)

**Jam rule:** "Anything you can type out is text; symbols are fine."

This means **NO numbers, NO letters** anywhere in the game UI. Only:
- Unicode symbols (↓ ◆ ● ★ ⚡ ⟲)
- Geometric shapes (rendered graphics)
- Progress bars, fill levels, dot counters
- Colors and animations

| Element | Meaning |
|---------|---------|
| **Package icons** | Identity (Devicon for real packages, archetype shapes for fallback) |
| **Border color** | State (blue=installing, green=ready, red=conflict, cyan=optimized) |
| **Fill color** | Health/heat level |
| **Progress ring** | Installation/resolution progress |
| **Wire style** | Solid=dependency, double=symlink, crackling red=conflict |
| **Glows** | Affordability (green=can click, blue=almost, red=needs attention) |
| **Halos** | Duplicate detection (matching colors pulse in sync) |
| **Bar fill** | Resource amount (NOT numeric display) |

See `docs/VISUAL_DESIGN.md` for full visual language spec.

## Game Mechanics Quick Reference

**Resources:**
- Bandwidth (↓) - spent to install, regenerates
- Weight (◆) - total node_modules size, triggers prestige
- Heat (●) - system strain, causes conflicts

**Core Loop:**
1. Click node → spend bandwidth → create package
2. Package bursts → spawns 1-5 dependencies
3. Chain reaction → tree grows fractally
4. Conflicts spawn (incompatible archetypes) → click wire to Prune or Upgrade
5. Duplicates appear → drag to merge (symlink)
6. Weight accumulates → gravity increases → prestige

**Prestige:** At 100k weight, collapse into black hole, gain cache tokens, restart with multipliers.

## Code Conventions

- **Jam mentality:** Ship fast, iterate, don't over-engineer
- **No backwards compat:** Break things freely, no migration code
- **Prefer editing:** Modify existing files over creating new ones
- **Keep rendering pure:** Game logic in `game/`, visuals in `rendering/`

## Current Implementation Status

**Working:**
- Canvas with pan/zoom
- Package installation + dependency spawning
- Force-directed physics
- Wire-based conflict system (Prune/Upgrade actions)
- Symlink data layer + duplicate detection
- Prestige system

**Partial:**
- HUD (has resource bars, needs full no-text compliance)
- Symlink UI (drag-to-merge interaction incomplete)
- Upgrade system (types defined, no shop UI)
- Edge indicators (off-screen event arrows)

**Not Started:**
- Real package icons (Devicon integration)
- Vulnerability spread mechanic
- Sound effects
- Particle effects
- Save/load

See `TODO.md` for full tracking.
