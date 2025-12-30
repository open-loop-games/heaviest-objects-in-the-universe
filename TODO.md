# TODO

Tracking incomplete work for The Heaviest Objects in the Universe.

---

## Mechanics Simplification (Priority)

Refocusing on clear, robust mechanics with low overlap. See `docs/CONCEPT.md` for original vision.

### Cut (Remove from codebase)
- [x] **Heat system** - random, disconnected, hard to teach without text
- [x] **Wire types** - dev/peer/dependency distinction is visual clutter (simplified to dependency + symlink)
- [x] **Algorithm fragments** - unused currency, adds confusion

### Keep
- [x] **Archetype conflicts** - deterministic, teachable through play (react vs angular, etc.)

### Needs Discussion
- [x] **Upgrades** - simplified from 8 tracks to 3: Bandwidth (↓), Efficiency (⚡), Automation (⟲)

### Keep (Core)
- Install → cascade (the loop)
- Symlink/merge duplicates (the satisfaction)
- Black hole prestige (the reset)
- Bandwidth + Weight (simple resources)

---

## Fractal Scope System (Inception Theme) ✓ COMPLETE

See `docs/archived/FRACTAL_REWORK.md` for the design spec.

### Fractal Rework Implementation (All Phases Complete)
- [x] **Phase 1: Compressed Package State**
- [x] **Phase 2: Staggered Cascade** (queue-based spawning, particle effects)
- [x] **Phase 3: Layer 2 Depth** (scope stack, compressed internal deps)
- [x] **Phase 4: Full Layering** (background/midground containers, blur, zoom-in centering)
- [x] **Phase 5: Depth Indicator Totem** (nested circles UI, back button arrows)
- [x] **Phase 6: Stability Propagation** (compressed deps block parent stability)
- [x] **Phase 7: Hoisting System** (drag-to-hoist, orbit ring, ghost marking, ephemeral lines)
- [x] **Phase 8: Polish** (cascade timing, camera easing, animations)

### Previous Implementation (Complete)
- [x] Core scope navigation (enter/exit, back button)
- [x] Internal state tracking (pristine/unstable/stable)
- [x] Curated starter-kit package
- [x] Cross-package conflicts and symlinks
- [x] Ghost nodes and weight transfer

---

## Prestige Progression System (NEW)

See `docs/PRESTIGE_PROGRESSION.md` for full design spec.

### Phase 1: Tier System ✓
- [x] Add `getEcosystemTier()` function (derived from cache tokens)
- [x] Add tier thresholds constant `TIER_THRESHOLDS = [0, 10, 30, 75, 150]`
- [x] Update prestige to recalculate tier after adding tokens

### Phase 2: Dynamic Compression ✓
- [x] Add `getCompressionChance(depth)` with softcap (50%) / hardcap (60%)
- [x] Add depth tapering (100% → 75% → 50% → 25% → 0%)
- [x] Replace `COMPRESSED_CHANCE` and `MAX_COMPRESSED_DEPTH` constants

### Phase 3: Automation State ✓
- [x] Add `AutomationState` interface to types
- [x] Add `automation` field to `GameState`
- [x] Reset automation state on prestige

### Phase 4: Automation Logic ✓
- [x] Create `automation.ts` module
- [x] Implement `findFirstConflictedWire()` (scope-aware)
- [x] Implement `findFirstDuplicatePair()` (scope-aware)
- [x] Implement auto-resolve timer (tier 2+: 3s → 2s → 1s → 0.5s)
- [x] Implement auto-dedup timer (tier 3+: 3s → 2s → 1s)
- [x] Integrate into game loop

### Phase 5: Automation Visuals - HUD ✓
- [x] Add gear icon ⚙ (visible at tier 2+)
- [x] Spinning animation while processing
- [x] Completion flash effect

### Phase 6: Automation Visuals - World ✓
- [x] Add `spawnAutoCompleteEffect()` to effects renderer
- [x] Green burst for resolve, cyan burst for dedup

### Phase 7: Polish ✓
- [x] Tier indicator in HUD (●●●○○ pips)
- [x] Tier-up celebration effect (shake, flash, glow)
- [ ] Tune tier thresholds via playtest (see tuning notes below)

### Tuning Parameters (for Playtest)

All tunable constants are in `src/game/config.ts`:

| Parameter | Current Value | Purpose |
|-----------|---------------|---------|
| `TIER_THRESHOLDS` | [0, 9, 21, 42, 63] | Cache tokens needed for each tier |
| `BASE_COMPRESSION_CHANCE` | 0.2 (20%) | Base chance for package to be compressed |
| `COMPRESSION_PER_TOKEN` | 0.01 (+1%) | Additional compression per cache token |
| `COMPRESSION_SOFTCAP` | 0.4 (40%) | Compression cap before diminishing returns |
| `COMPRESSION_HARDCAP` | 0.5 (50%) | Maximum compression chance |
| `DEPTH_COMPRESSION_MULT` | [1.0, 0.75, 0.5, 0.25, 0.0] | Multiplier per depth level |

Automation timing in `src/game/automation.ts`:

| Tier | Auto-Resolve Interval | Auto-Dedup Interval |
|------|----------------------|---------------------|
| 1 | — | — |
| 2 | 3000ms | — |
| 3 | 2000ms | 3000ms |
| 4 | 1000ms | 2000ms |
| 5 | 500ms | 1000ms |

---

## Visual Polish

### Particle Effects
- [ ] Prestige collapse particles (black hole has animation, needs particles)

---

## ~~Vulnerability Mechanic~~ (Cut - replaced by simplification)

~~From `docs/CONFLICT_SYMLINK_REDESIGN.md` Section 10~~ - removing complex mechanics

---

## Audio

- [ ] Install click sound (soft pop)
- [ ] Dependency burst (bubble wrap pop-pop-pop)
- [ ] Conflict spawn (discordant tone)
- [ ] Conflict resolve (satisfying ding)
- [ ] Symlink snap (zipper/connect)
- [ ] Weight milestone (deep bass)
- [ ] Gravity warning (low rumble)
- [ ] Prestige collapse (whoosh, silence, rebirth chime)

---

## Teaching & Onboarding (Optional Polish)

- [ ] Slow-motion first install (50% speed with staggered effects)

---

## Open Design Questions

1. **Prestige teaching** - How to teach "lose progress to gain power" visually?
2. **Colorblind accessibility** - Test palette with simulations

---

## Research (Nice to Have)

- [ ] Scrape actual dependency graphs from popular packages
- [ ] Analyze common circular dependency patterns
- [ ] Find real version conflict examples
- [ ] Look into pnpm/yarn deduplication stats

---

## Completed

### Core Mechanics
- [x] Canvas with pan/zoom
- [x] Package installation + dependency spawning
- [x] Force-directed physics
- [x] Conflict generation/resolution (wire-based)
- [x] Prestige system
- [x] Symlink data layer

### Conflict/Symlink Redesign
- [x] Remove old version shape system
- [x] Wire-based conflicts with archetype rules
- [x] Click wire for action buttons (Prune/Upgrade)
- [x] Duplicate detection with matching halos
- [x] Efficiency calculation updates

### Symlink UI
- [x] Drag-to-merge interaction
- [x] Ghost line hint between duplicates
- [x] Merge animation (particle burst)

### Save/Load
- [x] LocalStorage persistence
- [x] Prestige data survival
- [x] Auto-save (30s interval)

### HUD No-Text Compliance
- [x] Pure visual bars for all resources
- [x] Magnitude dots for weight display
- [x] Symbol-only icons

### Particle Effects
- [x] Install burst particles
- [x] Conflict resolution particles (flash + ripple)
- [x] Symlink merge particles

### Edge Indicators
- [x] Off-screen conflict arrows
- [x] Edge vignette for urgency
- [x] Multiple event aggregation
- [x] First-conflict spotlight (dims non-conflict nodes)

### Accessibility
- [x] Reduced motion support
- [x] Static alternatives for animations

### Package Icons
- [x] Icon state treatments (installing/healthy/conflict/optimized)
- [x] Icon rendering infrastructure (`icons.ts`)
- [x] Devicon integration (700+ real package icons via SVG path parsing)
- [x] Fallback icon for packages without devicons
- [x] Expanded registry (50+ packages with real icons)

### Glow Feedback System
- [x] Root node pulse for onboarding
- [x] Click hint indicator

### Upgrade System
- [x] Shop UI panel (`UpgradePanel.vue`)
- [x] No-text compliance (cost bars, symbol indicators)

### Teaching & Onboarding
- [x] Empty canvas birth animation
- [x] Root node materialization with delay
- [x] Staged HUD reveal (bandwidth, package count, weight, heat, prestige)
- [x] Onboarding milestone tracking (first click, first conflict, first prestige)

---

*Last updated: 2025-12-29 (Fractal Rework complete)*
