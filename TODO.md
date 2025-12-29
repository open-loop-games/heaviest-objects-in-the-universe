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

## Fractal Scope System (Inception Theme)

See `docs/FRACTAL_SCOPE_DESIGN.md` for full design spec.

**Core concept:** Click into packages to resolve internal dependency chaos. Two-world model (Root Scope / Package Scope).

### Design (Complete)
- [x] Navigation model: Click-to-enter, ← back button
- [x] Internal tree spawning and state tracking
- [x] Cross-package conflicts (sibling wires, "Resolve Inside")
- [x] Cross-package symlinks (ghost nodes)
- [x] Tutorial flow (starter-kit → Package 2 → Package 3 → prestige)

### Implementation
- [x] **Phase 1: Core Scope Navigation**
  - [x] Add `currentScope` to game state
  - [x] Enter/exit scope transitions
  - [x] Render internal trees when in package scope
  - [x] Back button (←) UI in upper left
- [x] **Phase 2: Internal State**
  - [x] `internalPackages` and `internalWires` on Package type
  - [x] `internalState`: pristine/unstable/stable
  - [x] Internal conflict/duplicate counting
  - [x] Package glow based on internal state (blue/red/green)
- [x] **Phase 3: Curated Starter Package**
  - [x] `starter-kit` with deterministic deps (lodash, moment, date-fns, debug)
  - [x] Guaranteed moment⚡date-fns conflict
  - [x] Tutorial gating (first run only)
- [x] **Phase 4: Cross-Package Systems**
  - [x] Sibling conflict wires at root scope
  - [x] "Resolve Inside" action on sibling wires
  - [x] Cross-package duplicate detection (matching halos on packages)
- [x] **Phase 5: Ghost Nodes & Symlink**
  - [x] Drag package onto package at root scope
  - [x] Ghost node visual (dashed, transparent, ⤳ icon)
  - [x] Weight transfer to larger package
  - [x] Ghost reference indicator when inside
- [x] **Phase 6: Polish**
  - [x] Stable celebration (particles + glow shift)
  - [x] Back button glow when stable
  - [x] Smooth scope transitions
  - [x] Stability bonus in prestige formula

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

*Last updated: 2025-12-29*
