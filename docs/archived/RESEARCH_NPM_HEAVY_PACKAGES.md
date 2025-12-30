# Research: Real-World Heavy npm Packages

> Reference data for making the game feel authentic to the developer experience

---

## Data Sources

- [npm rank (GitHub Gist)](https://gist.github.com/anvaka/8e8fa57c7ee1350e3491) - Daily-updated ranking
- [Bundlephobia](https://bundlephobia.com) - Package size/dependency analyzer
- [Hacker News discussion](https://news.ycombinator.com/item?id=16325098) - Community insights

---

## Most Depended-Upon Packages

These are the "hub nodes" in the real npm graph—packages that everything depends on:

| Package | Dependents | Potential Game Role |
|---------|------------|---------------------|
| lodash | ~69k | The "utility" archetype—appears everywhere |
| chalk | ~40k | Small but ubiquitous |
| request | ~36k | Network-related packages |
| commander | ~32k | CLI tools |
| react | ~31k | Framework archetype |
| express | ~27k | Server archetype |
| debug | ~23k | Dev tooling |
| async | ~23k | Flow control |
| fs-extra | ~22k | File system |
| moment | ~21k | Date handling (notoriously heavy) |

---

## Dependency Tree Statistics

From ecosystem analysis:

| Metric | Value | Game Implication |
|--------|-------|------------------|
| Average tree depth | ~4 levels | Good baseline for chain reactions |
| Deep trees | 10-20+ levels | Rare "legendary" packages |
| Packages with 0 deps | ~50% | Leaf nodes, stabilizers |
| Average direct deps | 5 | Base burst count |

---

## Notorious "Heavy Hitters"

These are the meme-worthy installations—perfect for late-game content:

### create-react-app
- **node_modules size:** 200+ MB
- **Package count:** 1000+ packages
- **Game idea:** "The Monolith" - a special package that triggers massive chain reaction

### jest
- Pulls in babel, coverage tools, watchers
- **Game idea:** "Testing Framework" archetype—spawns many specialized sub-dependencies

### webpack
- Complex plugin ecosystem
- **Game idea:** "The Bundler" - creates connections between unrelated branches

### babel (ecosystem)
- @babel/core, presets, plugins
- **Game idea:** "The Transpiler" - transforms shapes of child nodes

---

## Game Design Applications

### 1. Realistic Burst Distributions

Instead of uniform 1-5 dependencies, use weighted distribution matching reality:
```
0 deps: 50% (leaf nodes - stabilizers)
1-2 deps: 25% (light packages)
3-5 deps: 20% (normal packages)
6-10 deps: 4% (heavy packages)
11+ deps: 1% (legendary/boss packages)
```

### 2. "Hub Node" Mechanic

Some packages should be **attractors**—when installed, they have a chance to be referenced by future packages (simulating lodash/chalk ubiquity). This creates natural symlink opportunities.

### 3. Package Archetypes (Visual Only)

| Archetype | Shape | Color | Behavior |
|-----------|-------|-------|----------|
| Utility | Circle | Blue | High symlink chance |
| Framework | Square | Purple | Deep trees, rare |
| Tooling | Triangle | Orange | Spawns many small deps |
| Legacy | Diamond | Yellow | Causes version conflicts |

### 4. Easter Eggs / Achievements

- "left-pad moment" - Removing a tiny package cascades into chaos
- "node_modules weighs more than the sun" - Reach 1TB weight
- "is-odd depends on is-even" - Circular dependency formed
- "One eternity later..." - Wait through a 10+ level chain reaction

### 5. Weight Milestones (Based on Reality)

| Milestone | Real-World Equivalent |
|-----------|----------------------|
| 100 MB | Fresh create-react-app |
| 500 MB | Medium Next.js project |
| 1 GB | Large monorepo |
| 5 GB | Enterprise nightmare |
| 10+ GB | "How did we get here?" |

---

## Icon Sources for No-Text Design

Real package icons support the no-text mechanic while making the game feel authentic to developers.

### Primary: [Devicon](https://devicon.dev/)
- **150+ icons** covering npm ecosystem (react, vue, babel, webpack, typescript, jest, node, etc.)
- Multiple variants: original, plain, line, colored, wordmark
- Available as **SVG** or icon font
- [GitHub repo](https://github.com/devicons/devicon)
- **License:** MIT

### Secondary: [Simple Icons](https://simpleicons.org/)
- **3000+ brand icons** including all major tech
- Consistent monochrome style
- Great for unified visual language
- **License:** CC0 (public domain)

### Alternative: [Developer Icons](https://github.com/xandemon/developer-icons)
- Well-optimized SVGs
- Customizable (size, color, stroke)
- Newer, growing collection

### Icon State Mapping

| Package State | Icon Treatment |
|---------------|----------------|
| Installing | Monochrome + pulse animation |
| Healthy | Full color |
| Conflict | Red tint/overlay |
| Optimized/Symlinked | Green glow + full color |
| Paused/Inactive | Grayscale, dimmed |

### Variant Usage Ideas

Devicon's multiple variants could indicate progression:
- **Line variant** = package discovered but not installed
- **Plain variant** = installed, basic
- **Original colored** = fully resolved, optimized

---

## Implementation Notes

### Icon Rendering Options

Three approaches for integrating icons into the current Pixi.js node rendering (`src/rendering/nodes.ts`):

#### Option A: Overlay on Existing Shapes (Simplest)
- Keep current version shapes (circle/square/triangle/diamond/star)
- Add small icon sprite in corner for "known" packages
- Unknown/generic packages just show shape
- **Pros:** Minimal code change, preserves shape-based conflict mechanic
- **Cons:** Icons feel secondary, not the main visual

#### Option B: Replace Shapes with Icons (Medium)
- Icon IS the package visual
- Color tint indicates state:
  - Grayscale = installing
  - Full color = ready
  - Red tint = conflict
  - Green glow = optimized
- Use Devicon's line/plain/original variants for progression states
- **Pros:** Clean, iconic look; recognizable at a glance
- **Cons:** Need fallback for packages without icons; version conflicts need different visual

#### Option C: Hybrid Iconic Nodes (Richest)
- Outer ring = state indicator (current border system)
- Inner area = package icon
- Small shape badge in corner = version for conflict resolution
- **Pros:** Best of both worlds; rich information density
- **Cons:** Most complex to implement; may be visually busy at small sizes

#### Technical Considerations
- Pixi.js can render SVGs via `@pixi/svg` or pre-rasterized sprite sheets
- **Sprite sheets recommended** for 1000+ nodes (better performance)
- Could lazy-load icons: start with shapes, reveal icons as packages "resolve"

### Hub Node Mechanic

Some real packages (lodash, chalk, debug) are depended on by *everything*. This creates natural deduplication opportunities.

#### Concept
- Tag certain packages as "hubs" in the registry
- When spawning a new package, check if a hub of matching version already exists
- If yes, chance to auto-create symlink instead of duplicate node
- Creates organic symlink opportunities without player action

#### Implementation Hook
```typescript
// In packages.ts - spawnDependencies()
function shouldSymlinkToHub(newPkg: Package, state: GameState): Package | null {
  const existingHubs = getAllPackages(state)
    .filter(p => p.identity?.isHub && p.version === newPkg.version);

  if (existingHubs.length > 0 && Math.random() < 0.3) {
    return existingHubs[0]; // symlink to this instead of creating new
  }
  return null;
}
```

#### Balance Considerations
- Hub spawn rate: ~10-15% of packages should be hub types
- Symlink chance: 30% when matching hub exists (tunable)
- Hubs should have 0 dependencies themselves (they're leaf utilities)
- Visual: Hubs could have subtle glow or "magnet" icon to hint at their role

#### Candidate Hub Packages
| Package | Why It's a Hub |
|---------|----------------|
| lodash | Used by ~69k packages |
| chalk | CLI coloring everywhere |
| debug | Debugging utility |
| semver | Version parsing |
| uuid | ID generation |
| ms | Time parsing |

---

## Future Research

- [ ] Scrape actual dependency graphs from popular packages
- [ ] Analyze common circular dependency patterns
- [ ] Find real version conflict examples for shape-mismatch inspiration
- [ ] Look into pnpm/yarn deduplication stats for symlink mechanic balance

---

*Last Updated: 2024-12-28*
