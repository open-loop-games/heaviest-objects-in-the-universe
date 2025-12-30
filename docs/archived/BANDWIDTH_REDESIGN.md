# Bandwidth & Resource System Redesign

## Overview

Transform bandwidth from a passive pacing timer into the **universal action currency**. Every meaningful action costs bandwidth, creating moment-to-moment tension and decision-making.

**Design Goals:**
- Every action competes for the same resource pool
- Upgrades live alongside their affected resources (no separate shop)
- Automation is toggleable with visible BW drain
- No-text compliant throughout

---

## 1. Bandwidth Costs

All costs are **flat** (no scaling with progress). Upgrades reduce costs.

| Action | Base Cost | Notes |
|--------|-----------|-------|
| Initial install | Existing formula | Scales with package count |
| Dependency spawn | 5 BW | Per dep, queued if unaffordable |
| Conflict resolve | 15 BW | Click wire to resolve |
| Symlink merge | 8 BW | Drag-merge action |
| Auto-resolve op | 2 BW | Drained per operation |
| Auto-dedup op | 1.5 BW | Drained per operation |
| Auto-hoist op | 3 BW | Drained per operation |

### Config Constants

```typescript
// config.ts
export const DEP_SPAWN_COST = 5
export const CONFLICT_RESOLVE_COST = 15
export const SYMLINK_MERGE_COST = 8
export const AUTO_RESOLVE_DRAIN = 2
export const AUTO_DEDUP_DRAIN = 1.5
export const AUTO_HOIST_DRAIN = 3
export const MAX_PENDING_DEPS = 40
```

---

## 2. Dependency Queue System

When spawning dependencies, if bandwidth is insufficient, deps enter a queue and "drip install" as BW regenerates.

### State Changes

```typescript
// types.ts - extend PendingSpawn
export interface PendingSpawn {
  packageId: string
  identity: PackageIdentity
  position: Position
  velocity: Velocity
  size: number
  depth: number
  parentInternalId: string | null
  isSubDep: boolean
  // NEW
  awaitingBandwidth: boolean  // true if queued due to BW shortage
  queuedAt: number            // timestamp for progress calculation
}
```

### Logic Flow

```
cascade.ts:
1. Before spawning each dep:
   - Check gameState.resources.bandwidth >= DEP_SPAWN_COST
   - If YES: spawn immediately, deduct BW
   - If NO: add to pendingSpawns with awaitingBandwidth=true

loop.ts (each tick):
1. Check pendingSpawns queue (filter awaitingBandwidth=true)
2. While queue.length > 0 AND bandwidth >= DEP_SPAWN_COST:
   - Shift first item from queue
   - Spawn the dep
   - Deduct DEP_SPAWN_COST
3. Cap queue at MAX_PENDING_DEPS (drop oldest if exceeded)
```

### Visual Representation

Queued deps render as:
- **Faded outline** (alpha 0.3) at target position
- **Progress ring** showing BW accumulation toward DEP_SPAWN_COST
- When BW reaches cost, dep "materializes" with pop animation

```typescript
// nodes.ts
function renderQueuedDep(spawn: PendingSpawn, container: Container) {
  // Faded box outline
  const outline = new Graphics()
  outline.lineStyle(2, 0x5a5a7a, 0.5)
  outline.drawRoundedRect(-20, -20, 40, 40, 8)
  outline.alpha = 0.3

  // Progress ring
  const progress = Math.min(1, gameState.resources.bandwidth / DEP_SPAWN_COST)
  const ring = new Graphics()
  ring.lineStyle(3, 0x5a7aff, 0.8)
  ring.arc(0, 0, 25, -Math.PI/2, -Math.PI/2 + progress * Math.PI * 2)

  container.addChild(outline, ring)
}
```

---

## 3. Action Costs

### Conflict Resolution

```typescript
// mutations.ts
export function resolveWireConflict(wireId: string, scopePath: string[] = []): boolean {
  // Check affordability
  if (gameState.resources.bandwidth < CONFLICT_RESOLVE_COST) {
    return false  // UI should show "can't afford" state
  }

  // Deduct cost
  gameState.resources.bandwidth -= CONFLICT_RESOLVE_COST

  // ... existing resolution logic
}
```

### Symlink Merge

```typescript
// symlinks.ts
export function performSymlinkMerge(sourceId: string, targetId: string): number {
  // Check affordability
  if (gameState.resources.bandwidth < SYMLINK_MERGE_COST) {
    return 0  // Merge fails silently, UI shows can't afford
  }

  // Deduct cost
  gameState.resources.bandwidth -= SYMLINK_MERGE_COST

  // ... existing merge logic
}
```

### UI Affordability Indicators

When an action is unaffordable:
- Wire conflict glow changes from red to **gray pulsing**
- Duplicate halo changes from colored to **gray**
- Cursor shows "blocked" state on hover
- Ghost segment on bandwidth bar shows required amount

---

## 4. Automation System

### New State

```typescript
// types.ts - extend AutomationState
export interface AutomationState {
  // Existing fields...

  // Toggle states (NEW)
  resolveEnabled: boolean
  dedupEnabled: boolean
  hoistEnabled: boolean

  // Hoist tracking (NEW)
  hoistActive: boolean
  hoistTargetDepName: string | null
  hoistTargetSources: string[] | null
}
```

### Tier Unlocks

| Tier | Unlocks |
|------|---------|
| 1 | Nothing (manual only) |
| 2 | Auto-resolve toggle |
| 3 | Auto-dedup toggle, Auto-hoist toggle |
| 4 | Faster intervals |
| 5 | Maximum speed |

### Automation Update Logic

```typescript
// automation.ts
export function updateAutomation(now: number, deltaTime: number): void {
  const tier = getEcosystemTier(gameState.meta.cacheTokens)
  const auto = gameState.automation

  // ============================================
  // AUTO-RESOLVE (Tier 2+)
  // ============================================
  if (tier >= 2 && auto.resolveEnabled) {
    if (auto.resolveActive) {
      // Check if we can afford to continue
      const drain = AUTO_RESOLVE_DRAIN * deltaTime
      if (gameState.resources.bandwidth >= drain) {
        gameState.resources.bandwidth -= drain
        // ... continue processing
      } else {
        // Pause - not enough BW
        // Don't complete, just wait
      }
    } else {
      // Start new resolve if interval passed
      // ... existing start logic
    }
  }

  // ============================================
  // AUTO-DEDUP (Tier 3+)
  // ============================================
  if (tier >= 3 && auto.dedupEnabled) {
    // Same pattern as resolve
  }

  // ============================================
  // AUTO-HOIST (Tier 3+)
  // ============================================
  if (tier >= 3 && auto.hoistEnabled) {
    if (auto.hoistActive) {
      const drain = AUTO_HOIST_DRAIN * deltaTime
      if (gameState.resources.bandwidth >= drain) {
        gameState.resources.bandwidth -= drain
        // ... continue processing
      }
    } else if (now - auto.lastHoistTime >= getHoistInterval(tier)) {
      // Find next shared dep to hoist
      const sharedDeps = findSharedDeps()
      if (sharedDeps.size > 0) {
        const [depName, sources] = sharedDeps.entries().next().value
        auto.hoistActive = true
        auto.hoistTargetDepName = depName
        auto.hoistTargetSources = sources
        auto.processStartTime = now
      }
      auto.lastHoistTime = now
    }
  }
}
```

### Automation Intervals by Tier

```typescript
// Resolve intervals (ms)
export const RESOLVE_INTERVALS = [
  Infinity, // Tier 0 (unused)
  Infinity, // Tier 1: no automation
  3000,     // Tier 2: 3s
  2000,     // Tier 3: 2s
  1000,     // Tier 4: 1s
  500,      // Tier 5: 0.5s
]

// Dedup intervals (ms)
export const DEDUP_INTERVALS = [
  Infinity, // Tier 0
  Infinity, // Tier 1
  Infinity, // Tier 2: not unlocked
  3000,     // Tier 3: 3s
  2000,     // Tier 4: 2s
  1000,     // Tier 5: 1s
]

// Hoist intervals (ms)
export const HOIST_INTERVALS = [
  Infinity, // Tier 0
  Infinity, // Tier 1
  Infinity, // Tier 2: not unlocked
  4000,     // Tier 3: 4s (slower than dedup)
  2500,     // Tier 4: 2.5s
  1500,     // Tier 5: 1.5s
]
```

---

## 5. Unified HUD Layout

### Structure

```
┌─────────────────────────────────────────────────────────────┐
│  ↓ [████████░░] ●●●○○○○○○○      ← Bandwidth bar + pips     │
│  ◆ [██████████████░░] ●●○○○○    ← Weight bar + compression │
│  ⚙● ●●○○○  ⟲● ●○○○  ⤴● ●○○○    ← Auto toggles + pips      │
│  ⚡[█████░░] ✓[███████░░]        ← Quality metrics          │
└─────────────────────────────────────────────────────────────┘
```

### Component Breakdown

```vue
<!-- HUD.vue - Resource rows -->

<!-- Bandwidth Row -->
<div class="resource-row bandwidth-row" v-if="showBandwidth">
  <div class="resource-icon">↓</div>
  <div class="resource-bar segmented">
    <div v-for="seg in bandwidthSegments"
         :key="seg.index"
         class="segment"
         :class="{ filled: seg.filled, partial: seg.partial > 0, cost: seg.isCost }" />
  </div>
  <div class="upgrade-pips" @click="cycleBandwidthUpgrade">
    <span v-for="i in 10"
          :key="i"
          class="pip"
          :class="{
            filled: i <= bandwidthLevel,
            affordable: i === bandwidthLevel + 1 && canAffordBandwidthUpgrade
          }" />
  </div>
</div>

<!-- Weight Row -->
<div class="resource-row weight-row" v-if="showWeight">
  <div class="resource-icon">◆</div>
  <div class="resource-bar segmented">
    <div v-for="seg in weightSegments" ... />
  </div>
  <!-- Compression pips (only after P3) -->
  <div class="upgrade-pips" v-if="showCompression">
    <span v-for="i in 8"
          :key="i"
          class="pip compression"
          :class="{ filled: i <= compressionLevel }" />
  </div>
</div>

<!-- Automation Row -->
<div class="resource-row automation-row" v-if="showAnyAutomation">
  <!-- Auto-resolve (Tier 2+) -->
  <div class="auto-group" v-if="tier >= 2">
    <button class="auto-toggle" @click="toggleResolve">
      <span class="auto-icon">⚙</span>
      <span class="toggle-dot" :class="resolveToggleState">●</span>
    </button>
    <div class="upgrade-pips mini">
      <span v-for="i in 5" :key="i" class="pip" :class="{ filled: i <= resolveSpeedLevel }" />
    </div>
  </div>

  <!-- Auto-dedup (Tier 3+) -->
  <div class="auto-group" v-if="tier >= 3">
    <button class="auto-toggle" @click="toggleDedup">
      <span class="auto-icon">⟲</span>
      <span class="toggle-dot" :class="dedupToggleState">●</span>
    </button>
    <div class="upgrade-pips mini">
      <span v-for="i in 5" :key="i" class="pip" :class="{ filled: i <= dedupSpeedLevel }" />
    </div>
  </div>

  <!-- Auto-hoist (Tier 3+) -->
  <div class="auto-group" v-if="tier >= 3">
    <button class="auto-toggle" @click="toggleHoist">
      <span class="auto-icon">⤴</span>
      <span class="toggle-dot" :class="hoistToggleState">●</span>
    </button>
    <div class="upgrade-pips mini">
      <span v-for="i in 5" :key="i" class="pip" :class="{ filled: i <= hoistSpeedLevel }" />
    </div>
  </div>
</div>

<!-- Quality Metrics Row -->
<div class="quality-metrics" v-if="showEfficiency">
  <div class="quality-bar efficiency">
    <span class="quality-icon">⚡</span>
    <div class="quality-track">
      <div class="quality-fill" :style="{ width: efficiency * 100 + '%' }" />
    </div>
  </div>
  <div class="quality-bar stability">
    <span class="quality-icon">✓</span>
    <div class="quality-track">
      <div class="quality-fill" :style="{ width: stability * 100 + '%' }" />
    </div>
  </div>
</div>
```

### Toggle States

| State | Color | Meaning |
|-------|-------|---------|
| `on` | Green ● | Enabled and working (or idle) |
| `off` | Red ● | Disabled |
| `paused` | Yellow ● | Enabled but paused (no BW) |
| `working` | Green ● pulsing | Actively processing |

```typescript
// Computed toggle state
const resolveToggleState = computed(() => {
  if (!gameState.automation.resolveEnabled) return 'off'
  if (gameState.automation.resolveActive) return 'working'
  if (gameState.resources.bandwidth < AUTO_RESOLVE_DRAIN) return 'paused'
  return 'on'
})
```

---

## 6. HUD Component Decomposition

The current `HUD.vue` is ~1000+ lines. Decompose during this redesign since we're restructuring into natural component boundaries anyway.

### Target Structure

```
src/components/
├── HUD.vue                      # Thin orchestrator (~100-150 lines)
└── hud/
    ├── BandwidthRow.vue         # Bandwidth bar + upgrade pips
    ├── WeightRow.vue            # Weight bar + compression pips
    ├── AutomationRow.vue        # Toggle buttons + speed pips
    ├── QualityMetrics.vue       # Efficiency + stability bars
    ├── PrestigeOrbit.vue        # Bottom orbital visualization
    ├── ScopeNavigation.vue      # Back button + depth totem
    └── SettingsPanel.vue        # Save/reset buttons + panel
```

### Component Responsibilities

#### HUD.vue (Orchestrator)
```vue
<script setup lang="ts">
// Visibility gating
const showBandwidth = computed(() => gameState.onboarding.firstClickComplete)
const showWeight = computed(() => gameState.onboarding.weightSeen)
const showAutomation = computed(() => computed_ecosystemTier.value >= 2)
const showPrestige = computed(() => computed_gravity.value > 0.3)
</script>

<template>
  <div class="hud">
    <ScopeNavigation v-if="inPackageScope" />

    <div class="hud-top">
      <BandwidthRow v-if="showBandwidth" />
      <WeightRow v-if="showWeight" />
      <AutomationRow v-if="showAutomation" />
      <QualityMetrics v-if="showWeight" />
    </div>

    <SettingsPanel />

    <PrestigeOrbit v-if="showPrestige" />
  </div>
</template>

<style scoped>
/* Layout positioning only */
</style>
```

#### BandwidthRow.vue
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { gameState } from '@/game/state'
import {
  getUpgradeLevel,
  getUpgradeCost,
  canPurchaseUpgrade,
  purchaseUpgrade
} from '@/game/upgrades'

// Segments
const SEGMENTS = 10
const bandwidthPercent = computed(() =>
  gameState.resources.bandwidth / gameState.resources.maxBandwidth
)
const segments = computed(() => /* segment calculation */)

// Upgrade pips
const level = computed(() => getUpgradeLevel('bandwidth'))
const cost = computed(() => getUpgradeCost('bandwidth'))
const canAfford = computed(() => canPurchaseUpgrade('bandwidth'))

function handlePipClick(pipIndex: number) {
  if (pipIndex === level.value + 1 && canAfford.value) {
    purchaseUpgrade('bandwidth')
  }
}

// Warning states
const warning = computed(() => {
  if (bandwidthPercent.value < 0.1) return 'critical'
  if (bandwidthPercent.value < 0.3) return 'low'
  return null
})
</script>

<template>
  <div class="resource-row" :class="{ 'warning-low': warning === 'low', 'warning-critical': warning === 'critical' }">
    <div class="resource-icon">↓</div>
    <div class="resource-bar">
      <div v-for="seg in segments" :key="seg.index" class="segment" :class="seg.classes" />
    </div>
    <div class="upgrade-pips">
      <span
        v-for="i in 10"
        :key="i"
        class="pip"
        :class="{ filled: i <= level, affordable: i === level + 1 && canAfford }"
        @click="handlePipClick(i)"
      />
    </div>
  </div>
</template>

<style scoped>
/* Bandwidth-specific styles */
</style>
```

#### WeightRow.vue
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { gameState, computed_gravity } from '@/game/state'
import { getUpgradeLevel, purchaseUpgrade } from '@/game/upgrades'

// Weight progress toward prestige
const progress = computed(() => Math.min(1, computed_gravity.value))
const segments = computed(() => /* 12 segments */)

// Compression upgrade (P3+ only)
const showCompression = computed(() => gameState.meta.totalPrestiges >= 3)
const compressionLevel = computed(() => getUpgradeLevel('compression'))

// Magnitude dots (B, K, M, G)
const magnitude = computed(() => {
  const w = gameState.resources.weight * 1024
  if (w < 1000) return 0
  if (w < 1000000) return 1
  if (w < 1000000000) return 2
  return 3
})
</script>

<template>
  <div class="resource-row weight-row" :class="{ 'prestige-ready': progress >= 1 }">
    <div class="resource-icon">◆</div>
    <div class="resource-bar">
      <div v-for="seg in segments" :key="seg.index" class="segment" :class="seg.classes" />
    </div>
    <div class="magnitude-dots">
      <span v-for="i in 4" :key="i" class="mag-dot" :class="{ active: magnitude >= i - 1 }" />
    </div>
    <div class="upgrade-pips" v-if="showCompression">
      <span
        v-for="i in 8"
        :key="i"
        class="pip compression"
        :class="{ filled: i <= compressionLevel }"
        @click="/* purchase */"
      />
    </div>
  </div>
</template>
```

#### AutomationRow.vue
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { gameState, computed_ecosystemTier } from '@/game/state'
import { getUpgradeLevel, purchaseUpgrade } from '@/game/upgrades'
import { AUTO_RESOLVE_DRAIN, AUTO_DEDUP_DRAIN, AUTO_HOIST_DRAIN } from '@/game/config'

const tier = computed(() => computed_ecosystemTier.value)

// Toggle states
function getToggleState(enabled: boolean, active: boolean, drain: number) {
  if (!enabled) return 'off'
  if (active) return 'working'
  if (gameState.resources.bandwidth < drain) return 'paused'
  return 'on'
}

const resolveState = computed(() =>
  getToggleState(
    gameState.automation.resolveEnabled,
    gameState.automation.resolveActive,
    AUTO_RESOLVE_DRAIN
  )
)

const dedupState = computed(() =>
  getToggleState(
    gameState.automation.dedupEnabled,
    gameState.automation.dedupActive,
    AUTO_DEDUP_DRAIN
  )
)

const hoistState = computed(() =>
  getToggleState(
    gameState.automation.hoistEnabled,
    gameState.automation.hoistActive,
    AUTO_HOIST_DRAIN
  )
)

// Toggle handlers
function toggleResolve() {
  gameState.automation.resolveEnabled = !gameState.automation.resolveEnabled
}
function toggleDedup() {
  gameState.automation.dedupEnabled = !gameState.automation.dedupEnabled
}
function toggleHoist() {
  gameState.automation.hoistEnabled = !gameState.automation.hoistEnabled
}
</script>

<template>
  <div class="resource-row automation-row">
    <!-- Auto-resolve (Tier 2+) -->
    <div class="auto-group" v-if="tier >= 2">
      <button class="auto-toggle" @click="toggleResolve">
        <span class="auto-icon">⚙</span>
        <span class="toggle-dot" :class="resolveState">●</span>
      </button>
      <div class="upgrade-pips mini">
        <span v-for="i in 5" :key="i" class="pip" :class="{ filled: i <= getUpgradeLevel('resolveSpeed') }" />
      </div>
    </div>

    <!-- Auto-dedup (Tier 3+) -->
    <div class="auto-group" v-if="tier >= 3">
      <button class="auto-toggle" @click="toggleDedup">
        <span class="auto-icon">⟲</span>
        <span class="toggle-dot" :class="dedupState">●</span>
      </button>
      <div class="upgrade-pips mini">
        <span v-for="i in 5" :key="i" class="pip" :class="{ filled: i <= getUpgradeLevel('dedupSpeed') }" />
      </div>
    </div>

    <!-- Auto-hoist (Tier 3+) -->
    <div class="auto-group" v-if="tier >= 3">
      <button class="auto-toggle" @click="toggleHoist">
        <span class="auto-icon">⤴</span>
        <span class="toggle-dot" :class="hoistState">●</span>
      </button>
      <div class="upgrade-pips mini">
        <span v-for="i in 5" :key="i" class="pip" :class="{ filled: i <= getUpgradeLevel('hoistSpeed') }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.toggle-dot.on { color: #5aff5a; }
.toggle-dot.off { color: #ff5a5a; }
.toggle-dot.paused { color: #ffaa5a; }
.toggle-dot.working { color: #5aff5a; animation: pulse 0.5s infinite; }
</style>
```

#### QualityMetrics.vue
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { gameState } from '@/game/state'
import { calculateStabilityRatio } from '@/game/formulas'

const efficiency = computed(() => gameState.stats.currentEfficiency)
const stability = computed(() => calculateStabilityRatio(gameState))

const efficiencyWarning = computed(() => {
  if (efficiency.value <= 0.3) return 'critical'
  if (efficiency.value <= 0.5) return 'low'
  return null
})
</script>

<template>
  <div class="quality-metrics">
    <div class="quality-bar" :class="{ warning: efficiencyWarning }">
      <span class="quality-icon">⚡</span>
      <div class="quality-track">
        <div class="quality-fill efficiency" :style="{ width: efficiency * 100 + '%' }" />
        <div class="threshold-marker" /> <!-- 50% marker -->
      </div>
      <span class="indicator">{{ efficiency >= 0.5 ? '▲' : '▼' }}</span>
    </div>

    <div class="quality-bar">
      <span class="quality-icon">✓</span>
      <div class="quality-track">
        <div class="quality-fill stability" :style="{ width: stability * 100 + '%' }" />
      </div>
      <span class="indicator">{{ stability >= 1 ? '●' : '○' }}</span>
    </div>
  </div>
</template>
```

#### ScopeNavigation.vue
- Back button with depth-based arrows (← or ← ←)
- Depth totem (vertical circles)
- Scope status indicators (conflicts/duplicates)
- Existing logic extracted from HUD.vue

#### PrestigeOrbit.vue
- Orbital decay visualization
- Tier arc progress
- Cache token display
- Prestige button
- Existing logic extracted from HUD.vue

#### SettingsPanel.vue
- Save button with flash
- Settings gear toggle
- Soft/hard reset buttons
- Existing logic extracted from HUD.vue

### Shared Styles

Create `src/components/hud/shared.css` for common patterns:

```css
/* Resource row base */
.resource-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(20, 20, 30, 0.8);
  border-radius: 8px;
  margin-bottom: 6px;
}

/* Resource icon */
.resource-icon {
  font-size: 20px;
  width: 28px;
  text-align: center;
}

/* Segmented bar */
.resource-bar {
  display: flex;
  gap: 2px;
  flex: 1;
}

.segment {
  flex: 1;
  height: 16px;
  background: #1a1a2a;
  border-radius: 2px;
  position: relative;
  overflow: hidden;
}

.segment.filled {
  background: linear-gradient(180deg, #5a7aff, #3a5adf);
}

/* Upgrade pips */
.upgrade-pips {
  display: flex;
  gap: 3px;
}

.pip {
  width: 8px;
  height: 8px;
  background: #2a2a3a;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s;
}

.pip.filled {
  background: #5aff5a;
}

.pip.affordable {
  background: #2a3a2a;
  box-shadow: 0 0 6px #5aff5a;
  animation: pip-glow 1s infinite;
}

@keyframes pip-glow {
  0%, 100% { box-shadow: 0 0 4px #5aff5a; }
  50% { box-shadow: 0 0 8px #5aff5a; }
}

/* Warning states */
.resource-row.warning-low .resource-icon { color: #ffaa5a; }
.resource-row.warning-critical .resource-icon { color: #ff5a5a; animation: pulse 0.5s infinite; }
```

### Extraction Order

1. **ScopeNavigation.vue** - Most isolated, no dependencies on new systems
2. **SettingsPanel.vue** - Isolated, just save/reset
3. **QualityMetrics.vue** - Simple, existing logic
4. **PrestigeOrbit.vue** - Complex but self-contained
5. **BandwidthRow.vue** - New structure with pips
6. **WeightRow.vue** - New structure with compression
7. **AutomationRow.vue** - New component entirely

### Props vs Direct State Access

Each component directly imports from `@/game/state` and `@/game/upgrades` rather than receiving props. This keeps HUD.vue thin and avoids prop drilling.

Exception: Visibility flags are computed in HUD.vue and control v-if rendering.

---

## 7. Upgrade System

### Upgrade Definitions

```typescript
// upgrades.ts
export const UPGRADES = {
  bandwidth: {
    id: 'bandwidth',
    icon: '↓',
    maxLevel: 10,
    baseCost: 40,
    costMultiplier: 1.6,
    effects: {
      regen: (level: number) => 1 + level * 0.4,      // +40% per level
      capacity: (level: number) => 1000 + level * 400, // +400 per level
    }
  },

  efficiency: {
    id: 'efficiency',
    icon: '⚡',
    maxLevel: 10,
    baseCost: 60,
    costMultiplier: 1.8,
    effects: {
      speed: (level: number) => 1 + level * 0.25,     // +25% per level
      costReduction: (level: number) => Math.pow(0.94, level), // -6% per level
    }
  },

  compression: {
    id: 'compression',
    icon: '◆↓',
    maxLevel: 8,
    baseCost: 100,
    costMultiplier: 2.0,
    prestigeRequirement: 3, // Only visible after 3 prestiges
    effects: {
      weightReduction: (level: number) => Math.pow(0.95, level), // -5% per level
    }
  },

  resolveSpeed: {
    id: 'resolveSpeed',
    icon: '⚙+',
    maxLevel: 5,
    baseCost: 50,
    costMultiplier: 1.7,
    tierRequirement: 2,
    effects: {
      drainReduction: (level: number) => Math.pow(0.9, level),  // -10% drain
      speedBoost: (level: number) => 1 + level * 0.15,          // +15% speed
    }
  },

  dedupSpeed: {
    id: 'dedupSpeed',
    icon: '⟲+',
    maxLevel: 5,
    baseCost: 50,
    costMultiplier: 1.7,
    tierRequirement: 3,
    effects: {
      drainReduction: (level: number) => Math.pow(0.9, level),
      speedBoost: (level: number) => 1 + level * 0.15,
    }
  },

  hoistSpeed: {
    id: 'hoistSpeed',
    icon: '⤴+',
    maxLevel: 5,
    baseCost: 60,
    costMultiplier: 1.8,
    tierRequirement: 3,
    effects: {
      drainReduction: (level: number) => Math.pow(0.9, level),
      speedBoost: (level: number) => 1 + level * 0.15,
    }
  },
}
```

### Upgrade Purchase Flow

1. Player hovers/taps resource row
2. Next affordable pip glows green
3. Player clicks pip
4. If affordable: deduct BW, increment level, apply effects
5. If not affordable: pip pulses red briefly

---

## 8. Visibility Rules

| Element | Visible When |
|---------|--------------|
| Bandwidth row | After first click (existing) |
| Bandwidth pips | Always with row |
| Weight row | After 8 packages (existing) |
| Compression pips | After prestige 3 |
| Auto-resolve toggle | Tier 2+ |
| Auto-dedup toggle | Tier 3+ |
| Auto-hoist toggle | Tier 3+ |
| Automation pips | With their toggle |
| Quality metrics | After 8 packages (existing) |

---

## 9. Implementation Order

### Phase 1: Core Bandwidth Costs
1. Add cost constants to `config.ts`
2. Add BW check + deduction to `resolveWireConflict()`
3. Add BW check + deduction to `performSymlinkMerge()`
4. Update UI to show affordability states

### Phase 2: Dependency Queue
1. Extend `PendingSpawn` with queue fields
2. Update `cascade.ts` to queue unaffordable deps
3. Update `loop.ts` to drip-spawn from queue
4. Add queued dep rendering to `nodes.ts`

### Phase 3: Automation System
1. Extend `AutomationState` with toggle booleans + hoist fields
2. Add auto-hoist logic to `automation.ts`
3. Update automation to check toggles before processing
4. Add BW drain during active processing

### Phase 4: HUD Decomposition (Extract Existing)
1. Create `src/components/hud/` directory
2. Extract `ScopeNavigation.vue` from HUD.vue
3. Extract `SettingsPanel.vue` from HUD.vue
4. Extract `QualityMetrics.vue` from HUD.vue
5. Extract `PrestigeOrbit.vue` from HUD.vue
6. Create `shared.css` with common styles
7. Verify HUD.vue still works with extracted components

### Phase 5: HUD Redesign (New Components)
1. Create `BandwidthRow.vue` with segmented bar + upgrade pips
2. Create `WeightRow.vue` with magnitude dots + compression pips
3. Create `AutomationRow.vue` with toggles + speed pips
4. Update HUD.vue as thin orchestrator (~100-150 lines)
5. Remove `UpgradePanel.vue`

### Phase 6: Upgrade Integration
1. Update `upgrades.ts` with new definitions
2. Add automation speed upgrades (resolveSpeed, dedupSpeed, hoistSpeed)
3. Add compression upgrade (P3 gated)
4. Wire pip clicks to purchase logic
5. Add upgrade state to types + persistence

### Phase 7: Polish
1. Affordability animations (pulse, glow)
2. Queue visualization (faded outlines, progress rings)
3. Toggle state transitions (on/off/paused/working)
4. Upgrade preview ghosts on hover
5. Transition animations for component reveals

---

## 10. Migration Notes

### State Changes
- New fields in `AutomationState`: `resolveEnabled`, `dedupEnabled`, `hoistEnabled`, `hoistActive`, `hoistTargetDepName`, `hoistTargetSources`, `lastHoistTime`
- New fields in `PendingSpawn`: `awaitingBandwidth`, `queuedAt`
- New fields in `Upgrades`: `compressionLevel`, `resolveSpeedLevel`, `dedupSpeedLevel`, `hoistSpeedLevel`

### Prestige Reset
- Toggles reset to `false` (must re-enable each run)
- Upgrade levels reset (except meta-progression)
- Queue clears

### Save Compatibility
- Add migration for missing fields with defaults
- `resolveEnabled: false`, `dedupEnabled: false`, `hoistEnabled: false`
- New upgrade levels default to 0

---

## 11. Balance Notes

### Early Game (Pre-Prestige 1)
- BW regen: ~5/sec base
- Install cost: ~10-50 BW
- Dep spawn cost: 5 BW each
- Player manually resolves conflicts (15 BW each)
- Cascades create BW pressure, forcing pace breaks

### Mid Game (Prestige 1-2)
- BW regen: ~10-20/sec with upgrades + cache tokens
- Auto-resolve unlocks (Tier 2), drains 2 BW/op
- Player toggles automation based on BW budget
- Symlink merges cost 8 BW, creating optimization decisions

### Late Game (Prestige 3+)
- BW regen: ~30-50/sec
- All automation available
- Compression upgrade appears (reduces weight gain)
- Tension: fast weight vs high efficiency for prestige rewards

### Automation Tension
When all automations are on at max tier:
- Auto-resolve: ~4 ops/sec = 8 BW/sec drain
- Auto-dedup: ~1 op/sec = 1.5 BW/sec drain
- Auto-hoist: ~0.7 ops/sec = 2.1 BW/sec drain
- Total potential drain: ~11.6 BW/sec

At 30 BW/sec regen, automation consumes ~39% of income.
Player must still manually install + handle bursts.

---

## 12. No-Text Compliance Checklist

| Element | Compliance |
|---------|------------|
| Resource bars | ✓ Segmented fill, no numbers |
| Upgrade pips | ✓ Filled/empty dots |
| Toggle indicators | ✓ Colored circles (●) |
| Affordability | ✓ Glow colors (green/red/gray) |
| Queue progress | ✓ Arc rings |
| Cost preview | ✓ Ghost segments on bar |
| Automation state | ✓ Color coding |

---

*Document Version: 1.1*
*Created: 2024-12-29*
*Updated: 2024-12-29 - Added HUD decomposition (Section 6)*
*Status: Ready for Implementation*
