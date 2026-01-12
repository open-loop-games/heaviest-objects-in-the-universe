<script setup lang="ts">
/**
 * Mobile HUD Layout - Complete Version
 *
 * Bottom-anchored, thumb-reachable design with full feature parity.
 * Upgrade pips replaced with dedicated upgrade sheet (+ button).
 *
 * Layout:
 * ┌─────────────────────────────────────┐
 * │ [← ●●○○○ ✓]              [⚙] [+]   │  ← Top bar
 * │                                     │
 * │           [ CANVAS ]                │
 * │                                     │
 * ├─────────────────────────────────────┤
 * │   [✕ Prune]  [↻ Upgrade]           │  ← Action bar (contextual)
 * ├─────────────────────────────────────┤
 * │ ⚡ ████░░ ▲   │  ✓ ██████ ●        │  ← Quality row
 * ├─────────────────────────────────────┤
 * │  ↓ ████░░░   │  ◎ [==▓▓░░░░]      │  ← Bandwidth + Surge
 * ├─────────────────────────────────────┤
 * │ ◆ ████████████████░░░░  │ ★ ⟲     │  ← Weight + Prestige + Auto
 * └─────────────────────────────────────┘
 */

import { computed, ref, watchEffect } from 'vue'
import {
  gameState,
  computed_gravity,
  computed_canPrestige,
  computed_ecosystemTier,
} from '../../game/state'
import {
  isInPackageScope,
  getScopeDepth,
  getCurrentScopeRoot,
} from '../../game/scope'
import { getSiblingWires } from '../../game/cross-package'
import { getInternalStats } from '../../game/packages'
import { canAffordConflictResolve } from '../../game/mutations'
import { setSurgeCharge, getSurgeCost } from '../../game/surge'
import { SURGE_SEGMENTS } from '../../game/config'
import { hasUnviewedTabs, unlockTab } from '../../onboarding'

// ============================================
// PROPS & EMITS
// ============================================

const props = defineProps<{
  selectedNodeId: string | null
  selectedWireId: string | null
}>()

const emit = defineEmits<{
  back: []
  settings: []
  upgrades: []
  openBook: []
  prune: []
  resolveInside: []
  toggleAutomation: []
  prestige: []
}>()

// ============================================
// TEACHING BOOK TAB UNLOCKS
// ============================================

// Unlock teaching book tabs based on game progress
watchEffect(() => {
  if (gameState.onboarding.firstSymlinkSeen) {
    unlockTab('duplicates')
  }
  if (gameState.onboarding.firstConflictSeen) {
    unlockTab('conflicts')
  }
  if (gameState.onboarding.firstDivablePackageSeen) {
    unlockTab('diving')
  }
  if (
    computed_canPrestige.value ||
    gameState.onboarding.firstPrestigeComplete
  ) {
    unlockTab('ship')
  }
  // Surge tab unlocks after first surge charge (available from T1)
  if (gameState.onboarding.firstSurgeCharged) {
    unlockTab('surge')
  }
})

// ============================================
// SCOPE STATE
// ============================================

const inScope = computed(() => isInPackageScope())
const scopeDepth = computed(() => getScopeDepth())
const maxDepth = 5

const scopeState = computed(() => {
  if (!inScope.value) return null
  const root = getCurrentScopeRoot()
  return root?.internalState || null
})

const scopeStats = computed(() => {
  if (!gameState.currentScope) return { conflicts: 0, duplicates: 0 }
  return getInternalStats(gameState.currentScope)
})

// ============================================
// RESOURCES
// ============================================

// Bandwidth
const bandwidthPercent = computed(
  () => gameState.resources.bandwidth / gameState.resources.maxBandwidth
)

const bandwidthState = computed(() => {
  const pct = bandwidthPercent.value
  if (pct < 0.1) return 'critical'
  if (pct < 0.25) return 'low'
  return 'normal'
})

// Weight / Prestige progress
const WEIGHT_SEGMENTS = 12
const prestigeProgress = computed(() => Math.min(1, computed_gravity.value))
const filledWeightSegments = computed(() =>
  Math.floor(prestigeProgress.value * WEIGHT_SEGMENTS)
)
const partialWeightFill = computed(() => {
  const raw = (prestigeProgress.value * WEIGHT_SEGMENTS) % 1
  return Math.round(raw * 100) / 100
})

// Prestige
const canPrestige = computed(() => computed_canPrestige.value)
const showPrestige = computed(() => {
  return (
    gameState.onboarding.firstPrestigeComplete ||
    gameState.meta.cacheTokens > 0 ||
    computed_gravity.value > 0.2
  )
})

// ============================================
// QUALITY METRICS
// ============================================

const efficiencyValue = computed(() => gameState.stats.currentEfficiency)

const efficiencyIndicator = computed(() => {
  if (efficiencyValue.value < 0.5) return '▼'
  if (efficiencyValue.value >= 0.85) return '▲▲'
  return '▲'
})

const efficiencyState = computed(() => {
  if (efficiencyValue.value < 0.3) return 'critical'
  if (efficiencyValue.value < 0.5) return 'warning'
  if (efficiencyValue.value >= 0.85) return 'excellent'
  return 'normal'
})

const stabilityValue = computed(() => gameState.stats.currentStability)

const stabilityState = computed(() => {
  if (stabilityValue.value >= 1.0) return 'stable'
  if (stabilityValue.value < 0.5) return 'critical'
  if (stabilityValue.value < 0.7) return 'warning'
  return 'normal'
})

// ============================================
// SURGE BAR (Touch-draggable)
// ============================================

const showSurge = computed(() => computed_ecosystemTier.value >= 2)
const chargedSegments = computed(() => gameState.surge.chargedSegments)
const unlockedSegments = computed(() => gameState.surge.unlockedSegments)

const surgeSegmentIndices = Array.from({ length: SURGE_SEGMENTS }, (_, i) => i)

// Touch drag state for surge
const isSurgeDragging = ref(false)

function handleSurgeStart(index: number) {
  isSurgeDragging.value = true
  updateSurgeCharge(index)
}

function handleSurgeMove(e: TouchEvent) {
  if (!isSurgeDragging.value) return

  const touch = e.touches[0]
  if (!touch) return

  const target = document.elementFromPoint(touch.clientX, touch.clientY)
  if (target?.classList.contains('surge-segment')) {
    const index = parseInt(target.getAttribute('data-index') || '0', 10)
    updateSurgeCharge(index)
  }
}

function handleSurgeEnd() {
  isSurgeDragging.value = false
}

function updateSurgeCharge(index: number) {
  const targetCharge = index + 1
  if (index < unlockedSegments.value) {
    setSurgeCharge(targetCharge)
  }
}

function canAffordSurgeSegment(index: number): boolean {
  const cost = getSurgeCost(index + 1)
  return (
    index < unlockedSegments.value &&
    index >= chargedSegments.value &&
    gameState.resources.bandwidth >= cost
  )
}

// ============================================
// AUTOMATION
// ============================================

const showAutomation = computed(() => computed_ecosystemTier.value >= 2)
const autoResolveEnabled = computed(() => gameState.automation.resolveEnabled)
const autoResolveActive = computed(() => gameState.automation.resolveActive)

// ============================================
// ACTION BAR (Wire/Node selection)
// ============================================

const hasSelection = computed(
  () => props.selectedNodeId !== null || props.selectedWireId !== null
)

const selectedWire = computed(() => {
  if (!props.selectedWireId) return null
  const wires = inScope.value
    ? getCurrentScopeRoot()?.internalWires
    : gameState.wires
  let wire = wires?.get(props.selectedWireId)
  // Also check sibling wires (cross-package conflicts) at root scope
  if (!wire && !inScope.value) {
    wire = getSiblingWires().get(props.selectedWireId)
  }
  return wire || null
})

const isSiblingWire = computed(() => selectedWire.value?.wireType === 'sibling')
const canPrune = computed(() => canAffordConflictResolve())

const selectedNode = computed(() => {
  if (!props.selectedNodeId) return null
  return gameState.packages.get(props.selectedNodeId) || null
})

const canEnterScope = computed(() => {
  if (!selectedNode.value) return false
  if (!inScope.value) {
    return selectedNode.value.parentId === gameState.rootId
  }
  return (
    selectedNode.value.internalPackages !== null &&
    selectedNode.value.internalWires !== null
  )
})
</script>

<template>
  <div
    class="mobile-hud"
    @touchmove="handleSurgeMove"
    @touchend="handleSurgeEnd"
  >
    <!-- ==================== TOP BAR ==================== -->
    <div class="top-bar">
      <!-- Back / Scope navigation -->
      <button
        v-if="inScope"
        class="top-btn back-btn"
        :class="{
          stable: scopeState === 'stable',
          unstable: scopeState === 'unstable',
        }"
        @click="emit('back')"
      >
        <span class="btn-icon">←</span>
        <div class="depth-dots">
          <span
            v-for="i in maxDepth"
            :key="i"
            class="depth-dot"
            :class="{ filled: i <= scopeDepth }"
          />
        </div>
        <span v-if="scopeState === 'stable'" class="status-icon stable">✓</span>
        <span v-else-if="scopeStats.conflicts > 0" class="status-icon conflict">
          !
        </span>
      </button>
      <div v-else class="top-spacer" />

      <!-- Right buttons -->
      <div class="top-right-buttons">
        <button
          class="top-btn help-btn"
          :class="{ 'has-unviewed': hasUnviewedTabs }"
          @click="emit('openBook')"
        >
          <span class="btn-icon">?</span>
          <span v-if="hasUnviewedTabs" class="unviewed-dot" />
        </button>
        <button class="top-btn" @click="emit('settings')">
          <span class="btn-icon">⚙</span>
        </button>
        <button class="top-btn upgrade-btn" @click="emit('upgrades')">
          <span class="btn-icon">+</span>
        </button>
      </div>
    </div>

    <!-- ==================== BOTTOM SECTION ==================== -->
    <div class="bottom-section">
      <!-- Action bar (contextual) -->
      <Transition name="slide-up">
        <div v-if="hasSelection" class="action-bar">
          <template v-if="selectedWire">
            <template v-if="isSiblingWire">
              <button
                class="action-btn resolve-inside"
                @click="emit('resolveInside')"
              >
                <span class="action-icon">↘</span>
              </button>
            </template>
            <template v-else>
              <button
                class="action-btn prune"
                :class="{ disabled: !canPrune }"
                :disabled="!canPrune"
                @click="emit('prune')"
              >
                <span class="action-icon">✕</span>
              </button>
            </template>
          </template>
          <template v-else-if="selectedNode && canEnterScope">
            <!-- Visual hint: pulsing arrow -->
            <div class="action-hint">
              <span class="hint-icon">↘</span>
            </div>
          </template>
        </div>
      </Transition>

      <!-- Quality row (Efficiency + Stability) -->
      <div class="resource-row quality-row">
        <!-- Efficiency -->
        <div class="quality-cell efficiency" :class="efficiencyState">
          <span class="quality-icon">⚡</span>
          <div class="quality-bar">
            <div
              class="bar-fill efficiency-fill"
              :style="{ width: efficiencyValue * 100 + '%' }"
            />
            <div class="threshold-marker" />
          </div>
          <span class="quality-indicator" :class="efficiencyState">
            {{ efficiencyIndicator }}
          </span>
        </div>

        <div class="row-divider" />

        <!-- Stability -->
        <div class="quality-cell stability" :class="stabilityState">
          <span class="quality-icon">✓</span>
          <div class="quality-bar">
            <div
              class="bar-fill stability-fill"
              :style="{ width: stabilityValue * 100 + '%' }"
            />
          </div>
          <span class="quality-indicator" :class="stabilityState">
            {{ stabilityState === 'stable' ? '●' : '○' }}
          </span>
        </div>
      </div>

      <!-- Bandwidth + Surge row -->
      <div class="resource-row bandwidth-surge-row">
        <!-- Bandwidth -->
        <div class="bandwidth-cell" :class="bandwidthState">
          <span class="resource-icon">↓</span>
          <div class="bandwidth-bar">
            <div
              class="bar-fill bandwidth-fill"
              :style="{ width: bandwidthPercent * 100 + '%' }"
            />
          </div>
        </div>

        <!-- Surge (if unlocked) -->
        <template v-if="showSurge">
          <div class="row-divider" />
          <div class="surge-cell">
            <span
              class="resource-icon surge-icon"
              :class="{ charged: chargedSegments > 0 }"
              >◎</span
            >
            <div class="surge-bar">
              <div
                v-for="i in surgeSegmentIndices"
                :key="i"
                class="surge-segment"
                :class="{
                  charged: i < chargedSegments,
                  unlocked: i < unlockedSegments && i >= chargedSegments,
                  locked: i >= unlockedSegments,
                  affordable: canAffordSurgeSegment(i),
                }"
                :data-index="i"
                @touchstart.prevent="handleSurgeStart(i)"
              />
            </div>
          </div>
        </template>
      </div>

      <!-- Weight + Prestige + Auto row -->
      <div class="resource-row weight-row">
        <!-- Weight bar -->
        <div class="weight-cell">
          <span class="resource-icon weight-icon">◆</span>
          <div class="weight-bar">
            <div
              v-for="i in WEIGHT_SEGMENTS"
              :key="i"
              class="weight-segment"
              :class="{
                filled: i - 1 < filledWeightSegments,
                partial:
                  i - 1 === filledWeightSegments && partialWeightFill > 0,
                milestone: i === WEIGHT_SEGMENTS,
              }"
            >
              <div
                v-if="i - 1 === filledWeightSegments && partialWeightFill > 0"
                class="segment-partial-fill"
                :style="{ height: partialWeightFill * 100 + '%' }"
              />
            </div>
          </div>
        </div>

        <!-- Prestige button -->
        <button
          v-if="showPrestige"
          class="prestige-btn"
          :class="{ ready: canPrestige }"
          :disabled="!canPrestige"
          @click="emit('prestige')"
        >
          <span class="prestige-icon">★</span>
        </button>

        <!-- Automation toggle -->
        <button
          v-if="showAutomation"
          class="auto-toggle"
          :class="{ on: autoResolveEnabled, working: autoResolveActive }"
          @click="emit('toggleAutomation')"
        >
          <span class="auto-icon" :class="{ spinning: autoResolveActive }"
            >⟲</span
          >
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mobile-hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-family: 'Courier New', monospace;
  color: #eeeeff;

  /* CSS Variables */
  --bg-panel: rgba(20, 20, 35, 0.95);
  --bg-btn: rgba(30, 30, 50, 0.9);
  --border-subtle: rgba(100, 100, 140, 0.3);
  --color-bandwidth: #7a7aff;
  --color-weight: #ffaa5a;
  --color-efficiency: #5affff;
  --color-stability: #5aff8a;
  --color-surge: #f0a040;
  --color-prestige: #a855f7;
  --color-warning: #ff6b6b;
  --color-success: #4ade80;
}

/* ============================================
   TOP BAR
   ============================================ */

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px;
  pointer-events: auto;
}

.top-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  min-height: 48px;
  min-width: 48px;
  background: var(--bg-btn);
  border: 2px solid var(--border-subtle);
  border-radius: 12px;
  color: #aaaacc;
  font-family: inherit;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  justify-content: center;
}

.top-btn:active {
  transform: scale(0.95);
  background: rgba(50, 50, 80, 0.95);
}

.top-right-buttons {
  display: flex;
  gap: 8px;
}

.upgrade-btn {
  background: rgba(40, 50, 60, 0.9);
  border-color: var(--color-efficiency);
  color: var(--color-efficiency);
  font-weight: bold;
  font-size: 24px;
}

.upgrade-btn:active {
  background: rgba(90, 255, 255, 0.2);
}

/* Help button */
.help-btn {
  position: relative;
  background: rgba(30, 30, 60, 0.9);
  border-color: rgba(90, 200, 255, 0.4);
  color: #5affff;
}

.help-btn:active {
  background: rgba(90, 200, 255, 0.2);
}

.help-btn.has-unviewed {
  animation: help-pulse 2s ease-in-out infinite;
}

@keyframes help-pulse {
  0%,
  100% {
    box-shadow: 0 0 4px rgba(90, 200, 255, 0.2);
  }
  50% {
    box-shadow: 0 0 12px rgba(90, 200, 255, 0.5);
  }
}

.unviewed-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ff5a8a;
  box-shadow: 0 0 6px rgba(255, 90, 138, 0.8);
}

/* Back button states */
.back-btn.stable {
  border-color: var(--color-success);
  background: rgba(30, 50, 40, 0.9);
}

.back-btn.stable .btn-icon {
  color: var(--color-success);
}

.back-btn.unstable {
  border-color: var(--color-warning);
}

.back-btn.unstable .btn-icon {
  color: var(--color-warning);
}

.depth-dots {
  display: flex;
  gap: 4px;
}

.depth-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3a3a5a;
  border: 1px solid #4a4a6a;
}

.depth-dot.filled {
  background: #7a7aff;
  border-color: #9a9aff;
}

.back-btn.stable .depth-dot.filled {
  background: var(--color-success);
  border-color: #6ee7a0;
}

.back-btn.unstable .depth-dot.filled {
  background: var(--color-warning);
  border-color: #ff8a8a;
}

.status-icon {
  font-size: 16px;
  font-weight: bold;
}

.status-icon.stable {
  color: var(--color-success);
}

.status-icon.conflict {
  color: var(--color-warning);
}

.top-spacer {
  width: 48px;
}

/* ============================================
   BOTTOM SECTION
   ============================================ */

.bottom-section {
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  background: var(--bg-panel);
  border-top: 1px solid var(--border-subtle);
}

/* ============================================
   ACTION BAR
   ============================================ */

.action-bar {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 10px 16px;
  background: rgba(30, 25, 45, 0.98);
  border-bottom: 1px solid var(--border-subtle);
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 20px;
  min-width: 72px;
  min-height: 52px;
  border: 2px solid;
  border-radius: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:active:not(.disabled) {
  transform: scale(0.95);
}

.action-icon {
  font-size: 22px;
  font-weight: bold;
}

.action-btn.prune {
  background: rgba(60, 20, 20, 0.9);
  border-color: #ff5a5a;
  color: #ff5a5a;
}

.action-btn.resolve-inside {
  background: rgba(40, 40, 80, 0.9);
  border-color: #7a7aff;
  color: #7a7aff;
}

.action-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-hint {
  padding: 12px 20px;
}

.hint-icon {
  font-size: 24px;
  color: #7a7aff;
  animation: pulse-hint 1.5s ease-in-out infinite;
}

@keyframes pulse-hint {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

/* ============================================
   RESOURCE ROWS
   ============================================ */

.resource-row {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  gap: 8px;
  border-bottom: 1px solid rgba(60, 60, 80, 0.3);
}

.resource-row:last-child {
  border-bottom: none;
}

.row-divider {
  width: 1px;
  height: 24px;
  background: rgba(100, 100, 140, 0.3);
  margin: 0 4px;
}

.resource-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

/* ============================================
   QUALITY ROW (Efficiency + Stability)
   ============================================ */

.quality-row {
  padding: 6px 12px;
}

.quality-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.quality-icon {
  font-size: 14px;
  width: 18px;
  text-align: center;
}

.quality-cell.efficiency .quality-icon {
  color: var(--color-efficiency);
}

.quality-cell.stability .quality-icon {
  color: var(--color-stability);
}

.quality-cell.warning .quality-icon,
.quality-cell.critical .quality-icon {
  color: var(--color-warning);
}

.quality-bar {
  flex: 1;
  height: 8px;
  background: rgba(40, 35, 55, 0.9);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease-out;
}

.efficiency-fill {
  background: linear-gradient(
    90deg,
    #ff5a5a 0%,
    #ffaa5a 40%,
    var(--color-efficiency) 100%
  );
}

.quality-cell.excellent .efficiency-fill {
  background: linear-gradient(90deg, #5affaa, var(--color-efficiency));
}

.stability-fill {
  background: linear-gradient(90deg, #ff8a5a 0%, var(--color-stability) 100%);
}

.quality-cell.stable .stability-fill {
  background: var(--color-stability);
}

.threshold-marker {
  position: absolute;
  left: 50%;
  top: -1px;
  bottom: -1px;
  width: 2px;
  background: rgba(255, 255, 255, 0.2);
}

.quality-indicator {
  font-size: 12px;
  width: 20px;
  text-align: center;
  font-weight: bold;
}

.quality-indicator.excellent {
  color: var(--color-efficiency);
}

.quality-indicator.normal {
  color: #5affaa;
}

.quality-indicator.warning {
  color: #ffaa5a;
}

.quality-indicator.critical {
  color: var(--color-warning);
}

.quality-indicator.stable {
  color: var(--color-stability);
}

/* ============================================
   BANDWIDTH + SURGE ROW
   ============================================ */

.bandwidth-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.bandwidth-cell .resource-icon {
  color: var(--color-bandwidth);
}

.bandwidth-cell.low .resource-icon,
.bandwidth-cell.critical .resource-icon {
  color: var(--color-warning);
}

.bandwidth-bar {
  flex: 1;
  height: 14px;
  background: rgba(122, 122, 255, 0.15);
  border-radius: 7px;
  overflow: hidden;
}

.bandwidth-fill {
  background: linear-gradient(to right, #5a5aaa, var(--color-bandwidth));
  box-shadow: 0 0 6px rgba(122, 122, 255, 0.4);
}

.bandwidth-cell.low .bandwidth-fill {
  background: linear-gradient(to right, var(--color-warning), #ffaa5a);
}

.bandwidth-cell.critical .bandwidth-fill {
  background: var(--color-warning);
  animation: pulse-warning 0.5s ease-in-out infinite alternate;
}

@keyframes pulse-warning {
  from {
    opacity: 0.7;
  }
  to {
    opacity: 1;
  }
}

/* Surge */
.surge-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.surge-icon {
  color: var(--color-surge);
  opacity: 0.5;
  transition: all 0.2s ease;
}

.surge-icon.charged {
  opacity: 1;
  text-shadow: 0 0 8px rgba(240, 160, 64, 0.8);
}

.surge-bar {
  display: flex;
  gap: 3px;
  flex: 1;
  height: 14px;
}

.surge-segment {
  flex: 1;
  height: 100%;
  border-radius: 2px;
  transition: all 0.15s ease;
  touch-action: none;
}

.surge-segment.charged {
  background: linear-gradient(to top, #c08020, var(--color-surge));
  box-shadow: 0 0 4px rgba(240, 160, 64, 0.5);
}

.surge-segment.unlocked {
  background: rgba(240, 160, 64, 0.25);
}

.surge-segment.affordable {
  background: rgba(240, 160, 64, 0.4);
  animation: segment-pulse 1s ease-in-out infinite;
}

.surge-segment.locked {
  background: rgba(60, 60, 80, 0.4);
}

@keyframes segment-pulse {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

/* ============================================
   WEIGHT ROW
   ============================================ */

.weight-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.weight-icon {
  color: var(--color-weight);
}

.weight-bar {
  display: flex;
  gap: 2px;
  flex: 1;
  height: 16px;
}

.weight-segment {
  flex: 1;
  height: 100%;
  background: rgba(255, 170, 90, 0.15);
  border-radius: 2px;
  position: relative;
  overflow: hidden;
  transition: all 0.15s ease;
}

.weight-segment.filled {
  background: linear-gradient(to top, #cc8844, var(--color-weight));
  box-shadow: 0 0 4px rgba(255, 170, 90, 0.4);
}

.weight-segment.milestone {
  border: 1px solid rgba(168, 85, 247, 0.4);
}

.weight-segment.milestone.filled {
  background: linear-gradient(to top, var(--color-prestige), #c084fc);
  box-shadow: 0 0 6px rgba(168, 85, 247, 0.5);
}

.segment-partial-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, #cc8844, var(--color-weight));
  border-radius: 2px;
}

/* Prestige button */
.prestige-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(40, 30, 60, 0.9);
  border: 2px solid rgba(168, 85, 247, 0.3);
  color: #666;
  font-size: 20px;
  cursor: not-allowed;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.prestige-btn.ready {
  cursor: pointer;
  border-color: var(--color-prestige);
  color: var(--color-prestige);
  box-shadow: 0 0 12px rgba(168, 85, 247, 0.5);
  animation: prestige-pulse 1.5s ease-in-out infinite;
}

.prestige-btn.ready:active {
  transform: scale(0.9);
}

@keyframes prestige-pulse {
  0%,
  100% {
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(168, 85, 247, 0.8);
  }
}

/* Automation toggle */
.auto-toggle {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: rgba(40, 40, 60, 0.9);
  border: 2px solid #4a4a6a;
  color: #666;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.auto-toggle.on {
  border-color: var(--color-stability);
  color: var(--color-stability);
  background: rgba(40, 60, 50, 0.9);
}

.auto-toggle.working {
  box-shadow: 0 0 10px rgba(90, 255, 138, 0.4);
}

.auto-icon.spinning {
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* ============================================
   TRANSITIONS
   ============================================ */

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.2s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
