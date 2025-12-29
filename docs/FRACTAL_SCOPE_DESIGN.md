# Fractal Scope Design

> Drilling into packages to resolve internal chaos—the true "inception" of dependency management.

## Overview

This document describes the **Scope System**: a fundamental pivot where packages contain their own internal dependency trees that players must enter and resolve before the package is considered stable.

**Core Fantasy:** Every package you install is a world unto itself. You don't just see dependencies—you *go inside* them, tame the chaos, and emerge with a clean, optimized module.

---

## The Two-World Model

The game now has two distinct contexts:

```
ROOT SCOPE (outer world)
├─ package.json (root node)
├─ Top-level packages (react, express, starter-kit)
├─ Wires between root and packages
├─ Sibling conflict wires (between incompatible packages)
└─ Package glows indicate internal status

PACKAGE SCOPE (inside a package)
├─ The package as local root
├─ Its internal dependency tree
├─ Internal conflicts and duplicates
├─ Back button (←) to return to root scope
└─ Isolated workspace
```

### Visual Example

```
ROOT SCOPE:                      PACKAGE SCOPE (inside starter-kit):

   package.json                       starter-kit
        │                                  │
   ┌────┼────┐                      ┌──────┼──────┐
starter  react  express           lodash  moment  date-fns  debug
  kit     ⚡                               └──⚡──┘
   │    conflict                          conflict!
 (glow: unstable)
```

---

## Navigation

### Entering a Package Scope

- **Action:** Click on a top-level package
- **Result:** Camera transitions to package scope; package becomes local root; its internal deps are visible
- **Visual:** Smooth zoom/fade transition

### Exiting to Root Scope

- **Action:** Click back button (←) in upper left
- **Result:** Return to root scope view
- **Visual:** Reverse transition
- **Behavior:** Cancels any in-progress interaction (drag, etc.)

### Restrictions

- Only top-level packages can be entered (depth limit: 1 level of nesting)
- Packages inside a scope are leaf nodes—cannot be entered further
- Back button always available when in package scope

---

## Package States

Each top-level package tracks its internal health:

| State | Meaning | Outer Visual | Can Exit? |
|-------|---------|--------------|-----------|
| `pristine` | Just installed, never entered | Pulsing blue glow | Yes |
| `unstable` | Has unresolved conflicts or duplicates | Red/orange glow | Yes |
| `stable` | All internal issues resolved | Green/cyan glow | Yes |

### State Transitions

```
pristine ──(enter)──→ unstable ──(resolve all)──→ stable
                           │
                           └──(new conflict/dup)──→ unstable
```

**Note:** A package becomes `unstable` the moment it's entered (its internal state is evaluated). If it spawns with no conflicts and no duplicates, it transitions directly to `stable`.

---

## Internal Tree Spawning

When a top-level package finishes installing:

1. Its internal dependencies spawn immediately (into internal state)
2. Conflicts and duplicates are detected
3. Package state is set (`pristine` initially, evaluated on first entry)
4. Internal tree does NOT render until player enters

### Curated First Package: `starter-kit`

The very first package installed is deterministic, designed to teach mechanics:

```typescript
const STARTER_KIT: CuratedPackage = {
  name: 'starter-kit',
  iconKey: 'npm',
  internalDeps: [
    { name: 'lodash', iconKey: 'lodash' },      // Hub - will duplicate later
    { name: 'moment', iconKey: 'npm' },          // Legacy
    { name: 'date-fns', iconKey: 'npm' },        // Conflicts with moment!
    { name: 'debug', iconKey: 'npm' },           // Clean leaf
  ],
};
```

**Guaranteed first experience:**
- Enter starter-kit
- See 4 internal deps
- Wire between `moment` and `date-fns` is conflicted (red, crackling)
- Player resolves conflict (Prune or Upgrade)
- Package becomes stable
- Exit, ready for Package 2

---

## Conflict System

### Internal Conflicts (Inside Package Scope)

Same as current wire-based conflicts:
- Incompatible packages connected by wire
- Wire shows red crackling effect
- Click wire → Prune (✕) or Upgrade (↻) actions

### Cross-Package Conflicts (Root Scope)

When two top-level packages contain incompatible internals:

1. A **sibling conflict wire** appears between them
2. Wire shows warning/error indicator
3. Click wire → **"Resolve Inside"** action
4. "Resolve Inside" enters one of the packages, highlighting the offending node

**Example:**
- Package 1 (starter-kit) contains `moment`
- Package 2 (date-tools) contains `date-fns`
- Sibling conflict wire appears at root scope
- Player clicks → enters one package → prunes/upgrades the conflicting dep

### Conflict Wire Actions

| Context | Click Action |
|---------|--------------|
| Inside package scope | Prune / Upgrade (direct resolution) |
| Root scope (sibling wire) | Resolve Inside (navigate to fix) |

---

## Symlink/Duplicate System

### Detection

Duplicates are detected when the same package (by name) exists in multiple places:
- Within a single package scope (internal duplicates)
- Across different top-level packages (cross-package duplicates)

### Internal Duplicates

When inside a package scope:
- Duplicate nodes show matching halo colors
- Player drags one onto the other to merge
- Merged node becomes "optimized" (cyan glow)

### Cross-Package Duplicates

When two top-level packages both contain the same internal dep (e.g., both have `lodash`):

1. Both packages show matching halo at root scope level
2. Player drags one package onto the other
3. Symlink created: smaller package's instance becomes a ghost
4. Weight transfers to the larger package

### Ghost Nodes (Symlink References)

When a duplicate is symlinked away:
- The "losing" instance becomes a **ghost node**
- Visual: Dashed border, semi-transparent, symlink icon (⤳)
- Ghost shows "→ [package name]" indicator
- Ghost has no weight (weight transferred)
- Ghost cannot conflict (it's just a reference)

**Example after symlinking:**
```
Package 1 (starter-kit):         Package 2 (react-app):
      │                                │
   lodash (real)                   lodash (ghost → starter-kit)
   weight: 70                      weight: 0
```

### Weight Attribution

- Package weight = base weight + sum of internal dep weights
- When symlinked: ghost node weight = 0, real node keeps weight
- Tie-breaker: larger package keeps the real node

---

## Tutorial Flow

### First Run Progression

The first run gates Package N+1 behind Package N stability:

```
1. ROOT SCOPE
   └─ Click package.json to install

2. STARTER-KIT INSTALLS (Package 1)
   └─ Pulsing glow invites entry
   └─ (Cannot install Package 2 yet)

3. ENTER STARTER-KIT
   └─ See 4 internal deps
   └─ Conflict: moment ⚡ date-fns
   └─ Resolve conflict (Prune/Upgrade)
   └─ Back button glows (celebration particles)

4. EXIT TO ROOT SCOPE
   └─ starter-kit now stable (green glow)
   └─ Can install Package 2

5. PACKAGE 2 INSTALLS
   └─ Contains lodash internally
   └─ Cross-package duplicate detected (both have lodash)
   └─ Sibling conflict possible if incompatible internals

6. RESOLVE PACKAGE 2
   └─ Enter, handle internal issues
   └─ Symlink lodash at root scope (drag packages)

7. PACKAGE 3 INSTALLS
   └─ Similar flow
   └─ More cross-package interactions

8. PRESTIGE AVAILABLE
   └─ Weight threshold reached
   └─ Black hole forms
   └─ Collapse and restart with bonuses
```

### Post-Prestige Relaxation

After first prestige:
- No longer gated—can install multiple packages freely
- Can have multiple unstable packages simultaneously
- Player manages chaos at their own pace

---

## Prestige Integration

### Weight Calculation

Total weight = sum of all top-level package weights (which include their internal deps, minus symlink ghosts)

### Stability Bonus

Prestige reward is modified by overall stability:

```
stability_ratio = stable_packages / total_packages
stability_bonus = 0.5 + (stability_ratio * 0.5)  // Range: 0.5x to 1.0x

cache_tokens = base_reward × stability_bonus
```

**Implication:** You CAN prestige with chaos (half reward), but cleaning up first gives full reward.

### Prestige Resets

On prestige:
- All packages (outer and inner) cleared
- Weight reset to 0
- Tutorial gating removed (post-prestige)
- Cache tokens and meta progress retained

---

## HUD Behavior

The HUD remains consistent between root scope and package scope:
- Bandwidth bar
- Weight display
- Prestige indicator
- Same layout, same info

**Rationale:** Global resources are global. Player shouldn't lose context when entering/exiting scopes.

**Addition:** Small contextual status near back button when in package scope:
- Conflict count (if any)
- Duplicate count (if any)
- Checkmark when stable

---

## Visual Language Summary

| Element | Root Scope | Package Scope |
|---------|------------|---------------|
| **Root node** | package.json | The entered package |
| **Child nodes** | Top-level packages | Internal dependencies |
| **Conflict wire** | Sibling conflict (between packages) | Internal conflict (between deps) |
| **Duplicate indicator** | Halo on packages | Halo on internal nodes |
| **Ghost node** | N/A | Symlinked-away reference |
| **Back button** | Hidden | Visible (← upper left) |
| **Glow meaning** | Package internal status | Node health status |

### Package Glow States (Root Scope)

| Glow | Meaning |
|------|---------|
| Pulsing blue | Pristine, never entered |
| Red/orange pulse | Unstable, issues inside |
| Steady green/cyan | Stable, fully resolved |
| Matching halo color | Has duplicate with another package |

### Celebration Effects

When package becomes stable:
- Glow shifts from red → green
- Particle burst (small, satisfying)
- Back button glows to indicate "you can exit"

---

## State Structure

### GameState Additions

```typescript
interface GameState {
  // ... existing fields ...

  // Scope navigation
  currentScope: 'root' | string;  // 'root' or package ID

  // Tutorial gating (first run only)
  tutorialGating: boolean;  // true until first prestige
}
```

### Package Additions

```typescript
interface Package {
  // ... existing fields ...

  // Scope system (top-level packages only)
  internalPackages: Map<string, Package> | null;
  internalWires: Map<string, Wire> | null;
  internalState: 'pristine' | 'unstable' | 'stable';
  internalConflictCount: number;
  internalDuplicateCount: number;

  // Ghost status (for symlinked nodes)
  isGhost: boolean;
  ghostTarget: string | null;  // Package ID where real node lives
}
```

---

## Implementation Phases

### Phase 1: Core Scope Navigation
- Add `currentScope` to state
- Implement enter/exit transitions
- Render internal trees when in package scope
- Back button UI

### Phase 2: Internal Conflict Resolution
- Internal deps spawn with conflicts
- Same Prune/Upgrade actions work inside
- Track `internalState` and counts

### Phase 3: Curated First Package
- `starter-kit` with guaranteed conflict
- Tutorial gating logic
- First-run flow

### Phase 4: Cross-Package Systems
- Sibling conflict wires
- "Resolve Inside" action
- Cross-package duplicate detection
- Ghost node visuals

### Phase 5: Symlink Merge
- Drag package onto package at root scope
- Weight transfer logic
- Ghost node creation

### Phase 6: Polish
- Celebration particles
- Back button glow
- Smooth transitions
- Stability bonus in prestige

---

## Open Items (Future)

- **Deeper nesting?** Current design is 1 level. Could go deeper post-jam.
- **Inner-to-inner symlinks?** Currently only cross-package. Could allow within single package.
- **Recursive inception visual?** Tiny preview of internal tree visible on package node before entering.

---

## Removed/Replaced Systems

This design **replaces** or **modifies**:
- Flat dependency tree (now nested)
- Direct conflict resolution anywhere (now scope-aware)
- Simple duplicate detection (now cross-scope)

This design **removes** (per TODO.md simplification):
- Heat system
- Archetype conflicts (replaced by curated incompatibilities)
- Wire types (dev/peer distinction)
- Algorithm fragments

---

*Document Version: 1.0*
*Last Updated: 2025-12-29*
*Status: Ready for Implementation*
