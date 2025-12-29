# The Heaviest Objects in the Universe

An incremental game about recursive npm dependencies, where your `node_modules` folder grows until it collapses into a black hole.

**Game Jam:** [New Year's Incremental Game Jam 2026](https://itch.io/jam/new-years-incremental-game-jam-2026)

**Theme:** Inception (dependencies within dependencies)

**Constraint:** No text - communicate through shapes, colors, and icons only

## Play

```bash
pnpm install
pnpm dev
```

## The Game

You are a dependency resolver. Click to install packages. Each package explodes into dependencies. Dependencies explode into more dependencies. The tree grows fractally. Weight accumulates. Eventually, gravity wins - collapse into a singularity and prestige into a new ecosystem.

**Core fantasy:** Taming chaos through optimization. Watch a messy dependency tree snap into an efficient, deduplicated web.

## Stack

- TypeScript + Vue 3 + Pixi.js
- Vite for dev/build

## Development

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm typecheck    # Type checking
pnpm lint         # ESLint
```

## Docs

- [Game Design](docs/GAME_DESIGN.md) - Full mechanics and progression
- [Visual Design](docs/VISUAL_DESIGN.md) - No-text communication system
- [Conflict/Symlink](docs/CONFLICT_SYMLINK_REDESIGN.md) - Wire-based conflicts, halo-based symlinks
- [Original Concept](docs/CONCEPT.md) - Initial brainstorm (historical)
