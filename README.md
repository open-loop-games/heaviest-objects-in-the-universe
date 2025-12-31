# The Heaviest Objects in the Universe

An incremental game about recursive npm dependencies, where your `node_modules` folder grows until it collapses into a black hole.

**Game Jam:** [New Year's Incremental Game Jam 2026](https://itch.io/jam/new-years-incremental-game-jam-2026)

**Theme:** Inception (dependencies within dependencies)

**Constraint:** No text - communicate through shapes, colors, and icons only

## Play

**[Play Now](https://namahanna.github.io/heaviest-objects-in-the-universe/)**

Or run locally:
```bash
pnpm install
pnpm dev
```

## The Game

You are a dependency resolver. Your job: tame the chaos of nested node_modules.

**The Loop:**
1. Click the root to spawn a package
2. Each package contains its own `node_modules` - click to dive inside
3. Dependencies cascade, conflicts erupt, duplicates multiply
4. Resolve conflicts (prune), merge duplicates (symlink)
5. Stabilize the scope, exit with satisfaction
6. Go deeper. Unlock automation. Prestige into a black hole.

**Core fantasy:** Watch a messy dependency tree snap into an efficient, deduplicated web. Then collapse it all and start again, stronger.

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

- [Game Design](docs/GAME_DESIGN.md) - Full mechanics, progression, and implementation status
- [Archived Designs](docs/archived/) - Legacy design docs (prestige, concept, visual design, etc.)
