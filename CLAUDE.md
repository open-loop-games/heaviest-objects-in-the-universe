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
- `docs/RESEARCH_NPM_HEAVY_PACKAGES.md` - Real npm data, icon sources, implementation notes

## No-Text Communication

All game state communicated visually:

| Element | Meaning |
|---------|---------|
| **Shapes** | Version (circle=stable, square=v1, triangle=v2, diamond=v3, star=rare) |
| **Border color** | State (blue=installing, green=ready, red=conflict, cyan=optimized) |
| **Fill color** | Health/heat level |
| **Progress ring** | Installation/resolution progress |
| **Wire style** | Solid=dependency, dotted=symlink |

Icon sources for real packages: Devicon, Simple Icons (see research doc)

## Game Mechanics Quick Reference

**Resources:**
- Bandwidth (↓) - spent to install, regenerates
- Weight (◆) - total node_modules size, triggers prestige
- Heat (●) - system strain, causes conflicts

**Core Loop:**
1. Click node → spend bandwidth → create package
2. Package bursts → spawns 1-5 dependencies
3. Chain reaction → tree grows fractally
4. Conflicts spawn → resolve by holding or symlinking
5. Weight accumulates → gravity increases → prestige

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
- Conflict generation/resolution
- Prestige system
- HUD with resource bars

**Partial:**
- Symlink mechanic (data exists, UI incomplete)
- Upgrade system (types defined, no shop UI)

**Not Started:**
- Real package identities/icons
- Sound effects
- Particle effects
- Save/load
