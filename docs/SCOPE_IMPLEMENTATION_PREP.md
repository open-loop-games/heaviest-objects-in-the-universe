# Scope System Implementation Prep

Audit of existing code and required changes for the Fractal Scope system.

---

## File-by-File Analysis

### 1. `src/game/types.ts`

**Current state:** Defines `Package`, `Wire`, `GameState`, etc.

**Changes needed:**

```typescript
// ADD to Package interface:
interface Package {
  // ... existing fields ...

  // Scope system (top-level packages only, null for inner deps)
  internalPackages: Map<string, Package> | null;
  internalWires: Map<string, Wire> | null;
  internalState: 'pristine' | 'unstable' | 'stable' | null;  // null for inner deps

  // Ghost status (for symlinked-away nodes)
  isGhost: boolean;
  ghostTargetId: string | null;  // Package ID where real node lives
  ghostTargetScope: string | null;  // Scope (package ID) where real node lives
}

// ADD to GameState interface:
interface GameState {
  // ... existing fields ...

  currentScope: 'root' | string;  // 'root' or package ID
  tutorialGating: boolean;  // true until first prestige
}

// ADD new type:
type InternalState = 'pristine' | 'unstable' | 'stable';
```

**Risk:** Medium - touches core data structure, need careful migration for saved games.

---

### 2. `src/game/config.ts`

**Current state:** `createInitialState()` creates fresh game state.

**Changes needed:**

```typescript
// ADD to createInitialState():
return {
  // ... existing ...
  currentScope: 'root',
  tutorialGating: true,  // Relaxed after first prestige
};
```

**Note:** `types.ts` shows `Upgrades` has `bandwidthRegenLevel` etc, but config shows `bandwidthLevel`. This is a mismatch to fix.

**Risk:** Low - additive change.

---

### 3. `src/game/state.ts`

**Current state:** Manages global state, prestige, save/load.

**Changes needed:**

```typescript
// ADD: Scope navigation
export function enterScope(packageId: string): boolean {
  const pkg = gameState.packages.get(packageId);
  if (!pkg || pkg.parentId !== null) return false;  // Only enter top-level

  // Initialize internal tree if pristine
  if (pkg.internalState === 'pristine') {
    spawnInternalDependencies(packageId);  // New function
    recalculateInternalState(packageId);
  }

  gameState.currentScope = packageId;
  return true;
}

export function exitScope(): void {
  gameState.currentScope = 'root';
}

export function getCurrentScopePackages(): Map<string, Package> {
  if (gameState.currentScope === 'root') {
    return gameState.packages;
  }
  const scopePkg = gameState.packages.get(gameState.currentScope);
  return scopePkg?.internalPackages || new Map();
}

export function getCurrentScopeWires(): Map<string, Wire> {
  if (gameState.currentScope === 'root') {
    return gameState.wires;
  }
  const scopePkg = gameState.packages.get(gameState.currentScope);
  return scopePkg?.internalWires || new Map();
}

// MODIFY performPrestige():
export function performPrestige(): void {
  // ... existing ...
  gameState.tutorialGating = false;  // Relax after first prestige
  gameState.currentScope = 'root';   // Reset scope
}

// MODIFY save/load to handle nested Maps
```

**Risk:** High - core state management, affects everything.

---

### 4. `src/game/packages.ts`

**Current state:** `installPackage()`, `spawnDependencies()`, `createRootPackage()`.

**Changes needed:**

```typescript
// ADD: Curated starter kit
const STARTER_KIT: PackageIdentity = {
  name: 'starter-kit',
  iconKey: 'npm',
  archetype: 'framework',
  baseDeps: 4,
  weight: 50,
  isHub: false,
};

const STARTER_KIT_DEPS = [
  { name: 'lodash', ... },
  { name: 'moment', ... },
  { name: 'date-fns', ... },  // Conflicts with moment!
  { name: 'debug', ... },
];

// MODIFY installPackage():
// - First install on root (pre-prestige) returns starter-kit
// - Initialize internalPackages/internalWires as empty Maps
// - Set internalState: 'pristine'

// ADD: spawnInternalDependencies(packageId)
// - Called when entering a pristine package
// - For starter-kit: spawn STARTER_KIT_DEPS deterministically
// - For others: spawn random deps into internalPackages/internalWires
// - Detect conflicts within internal tree
// - Set internalState based on conflicts/duplicates

// ADD: recalculateInternalState(packageId)
// - Count internal conflicts and duplicates
// - Set internalState: 'stable' if both are 0, else 'unstable'

// ADD: canInstallNewPackage()
// - If tutorialGating: check if all existing packages are stable
// - Post-prestige: always true
```

**Risk:** High - core gameplay logic.

---

### 5. `src/game/loop.ts`

**Current state:** Ticks resources, packages, physics each frame.

**Changes needed:**

```typescript
// MODIFY updatePackages():
function updatePackages(deltaTime: number): void {
  // Tick OUTER packages (always)
  for (const pkg of toRaw(gameState.packages).values()) {
    // ... existing installation progress logic ...
  }

  // Tick INNER packages (all of them, not just visible)
  for (const outerPkg of toRaw(gameState.packages).values()) {
    if (outerPkg.internalPackages) {
      for (const innerPkg of outerPkg.internalPackages.values()) {
        // ... same installation progress logic ...
      }
    }
  }

  // Wire flow animations for current scope only (visual)
  const wires = getCurrentScopeWires();
  for (const wire of toRaw(wires).values()) {
    wire.flowProgress = (wire.flowProgress + deltaTime * 0.5) % 1;
  }
}

// MODIFY auto-install:
// - Only auto-install at root scope
// - Respect tutorialGating
```

**Decision:** All packages tick (installation completes even off-screen). Visual-only things (wire flow) only tick for current scope.

**Risk:** Medium - performance concern with many internal trees.

---

### 6. `src/rendering/renderer.ts`

**Current state:** Renders `gameState.packages` and `gameState.wires` directly.

**Changes needed:**

```typescript
// MODIFY render():
render(deltaTime: number = 0.016): void {
  // ... existing setup ...

  // Get packages/wires for CURRENT SCOPE
  const rawPackages = toRaw(getCurrentScopePackages());
  const rawWires = toRaw(getCurrentScopeWires());

  // ... rest uses rawPackages/rawWires as before ...

  // ADD: If in package scope, render local root differently
  if (gameState.currentScope !== 'root') {
    // The entered package is the "local root" - render as anchor
  }
}

// UPDATE node cleanup to be scope-aware
```

**Risk:** Medium - rendering changes.

---

### 7. `src/rendering/nodes.ts`

**Current state:** Draws nodes with states: installing, ready, conflict, optimized.

**Changes needed:**

```typescript
// ADD to NodeEffects:
interface NodeEffects {
  // ... existing ...
  internalStateGlow?: 'pristine' | 'unstable' | 'stable';  // For top-level packages
  isGhost?: boolean;  // Ghost node rendering
}

// MODIFY drawNode():
// - Add pristine glow (pulsing blue, invites entry)
// - Add unstable glow (red/orange pulse)
// - Add stable glow (steady green/cyan)
// - Add ghost rendering (dashed border, semi-transparent, ⤳ icon)

// ADD drawGhostNode():
// - Dashed circular border
// - 50% opacity
// - Small reference indicator
```

**Risk:** Low - additive visual changes.

---

### 8. `src/components/GameCanvas.vue`

**Current state:** Handles clicks, drags, wire selection.

**Changes needed:**

```typescript
// ADD: Scope state
const currentScope = computed(() => gameState.currentScope);
const isInPackageScope = computed(() => currentScope.value !== 'root');

// MODIFY handleMouseDown():
// - If clicking top-level package at root scope → ENTER (not install)
// - If clicking root node → install (existing behavior)
// - If clicking inside package scope → existing behavior

// ADD: handleBackButton()
function handleBackButton() {
  exitScope();
  // Cancel any in-progress interaction
  clearWireSelection();
  symlinkDragSource = null;
  // etc.
}

// ADD: Back button glow when package becomes stable
const showBackButtonGlow = computed(() => {
  if (currentScope.value === 'root') return false;
  const pkg = gameState.packages.get(currentScope.value);
  return pkg?.internalState === 'stable';
});
```

**Template changes:**

```vue
<!-- ADD: Back button (only when in package scope) -->
<button
  v-if="isInPackageScope"
  class="back-button"
  :class="{ glowing: showBackButtonGlow }"
  @click="handleBackButton"
>
  ←
</button>
```

**Risk:** Medium - input handling changes.

---

### 9. `src/game/symlinks.ts`

**Current state:** Detects duplicates, performs merge (source vanishes).

**Changes needed:**

```typescript
// MODIFY updateDuplicateGroups():
// - Scope-aware: only look at current scope's packages
// - For root scope: detect cross-package duplicates (packages that both contain lodash internally)

// ADD: Cross-package duplicate detection
export function getCrossPackageDuplicates(): CrossPackageDuplicate[] {
  // Find packages where internalPackages contain same identity
  // Return pairs of (packageA, packageB, identityName)
}

// MODIFY performSymlinkMerge():
// - For inner nodes: existing behavior (source vanishes)
// - For cross-package: create ghost in losing package

// ADD: Ghost node creation
function createGhostNode(sourceId: string, targetId: string, targetScope: string): void {
  const source = /* get from appropriate scope */;
  source.isGhost = true;
  source.ghostTargetId = targetId;
  source.ghostTargetScope = targetScope;
  source.size = 0;  // No weight contribution
}
```

**Risk:** High - core mechanic change.

---

### 10. `src/game/registry.ts`

**Current state:** Package definitions, incompatibility pairs.

**Changes needed:**

```typescript
// ADD: Starter kit definitions
export const STARTER_KIT_IDENTITY: PackageIdentity = { ... };
export const STARTER_KIT_INTERNAL_DEPS: PackageIdentity[] = [ ... ];

// ENSURE: moment + date-fns are in INCOMPATIBLE_PAIRS
// (Already present: ['moment', 'date-fns'])
```

**Risk:** Low - data additions.

---

## Shared State Decisions

### Q: Where do internal packages/wires live?

**Decision:** On the parent `Package` object.

```typescript
package.internalPackages: Map<string, Package>
package.internalWires: Map<string, Wire>
```

**Pros:**
- Clear ownership
- Easy to serialize for save/load
- Natural cleanup on package removal

**Cons:**
- Nested Maps in state
- Need helper functions to get "current" packages/wires

### Q: What happens to inner package IDs?

Inner packages need unique IDs. Options:
1. Global unique IDs (pkg_123) - simple, but ID space shared
2. Scoped IDs (react:lodash) - explicit, longer
3. Same as outer but in different Map - works if we always access through scope

**Decision:** Option 1 (global unique). Simpler, `generateId()` already works.

### Q: Save/load with nested Maps?

Current save/load converts Map to Array. Need to recursively handle:

```typescript
// Save
for (const pkg of packages) {
  if (pkg.internalPackages) {
    pkg._savedInternalPackages = Array.from(pkg.internalPackages.entries());
    pkg._savedInternalWires = Array.from(pkg.internalWires.entries());
  }
}

// Load
for (const pkg of packages) {
  if (pkg._savedInternalPackages) {
    pkg.internalPackages = new Map(pkg._savedInternalPackages);
    pkg.internalWires = new Map(pkg._savedInternalWires);
  }
}
```

---

## Implementation Order

Based on dependencies:

```
Phase 1: Foundation
├── types.ts (add new fields)
├── config.ts (add currentScope, tutorialGating)
└── state.ts (add scope navigation helpers)

Phase 2: Core Mechanics
├── packages.ts (internal tree spawning)
├── registry.ts (starter-kit)
└── loop.ts (scope-aware ticking)

Phase 3: Rendering
├── renderer.ts (scope-aware rendering)
├── nodes.ts (new glows, ghost rendering)
└── GameCanvas.vue (back button, click-to-enter)

Phase 4: Cross-Package
├── symlinks.ts (cross-package detection, ghosts)
├── wires.ts (sibling conflict wires)
└── GameCanvas.vue (Resolve Inside action)

Phase 5: Polish
├── effects.ts (celebration particles)
├── formulas.ts (stability bonus)
└── Tutorial flow testing
```

---

## Breaking Changes

1. **Saved games** - Old saves won't have internal state fields. Need migration or reset.
2. **Click behavior** - Clicking packages now enters instead of... nothing (packages weren't clickable before except root)
3. **Symlink merge** - Now creates ghosts instead of deleting

**Recommendation:** Add save version number, force reset on incompatible version.

---

## Decisions Made

1. **Physics for inner trees:** Same force-directed physics as outer world
   - Inner packages behave identically to outer
   - More complex but feels alive and consistent

2. **Sibling conflict wire rendering:** Curved arc connecting the two packages
   - New wire rendering mode for sibling conflicts
   - Arc curves above the packages

3. **Save migration:** Force reset on old saves
   - No migration code
   - Add save version, reset if incompatible

4. **Weight calculation:** Tracked dynamically
   - Inner package weight propagates to parent on add/remove
   - Parent weight = base + sum(internal)

---

*Prep complete. Phase 1 starting.*
