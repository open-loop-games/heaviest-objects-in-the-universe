<script setup lang="ts">
import { computed, ref } from 'vue'
import { gameState } from '../../game/state'
import { previewedActionType, cascadeStarved } from '../../game/ui-state'
import { isViewingCascadeScope } from '../../game/cascade'
import {
  getUpgradeLevel,
  canPurchaseUpgrade,
  purchaseUpgrade,
  getEffectiveInstallCost,
  setPreviewedUpgrade,
  previewedUpgradeId,
  isUpgradeUnlocked,
  getPreviewBandwidth,
  UPGRADES,
} from '../../game/upgrades'
import { CONFLICT_RESOLVE_COST, SYMLINK_MERGE_COST } from '../../game/config'

// ============================================
// BANDWIDTH BAR
// ============================================

const SEGMENTS = 10

const bandwidthPercent = computed(() => {
  return gameState.resources.bandwidth / gameState.resources.maxBandwidth
})

// Preview: what fill would look like with upgraded capacity
const previewBandwidthPercent = computed(() => {
  if (previewedUpgradeId.value !== 'bandwidth') return null
  const preview = getPreviewBandwidth()
  // Same current bandwidth, divided by the NEW (larger) max
  return gameState.resources.bandwidth / preview.previewValue
})

// Install cost as percentage of max bandwidth
const installCost = computed(() => getEffectiveInstallCost())
const canAffordInstall = computed(() => {
  return gameState.resources.bandwidth >= installCost.value
})

const costPercent = computed(() => {
  return installCost.value / gameState.resources.maxBandwidth
})

// Action preview cost (conflict/symlink hover)
const actionPreviewCost = computed(() => {
  if (previewedActionType.value === 'conflict') return CONFLICT_RESOLVE_COST
  if (previewedActionType.value === 'symlink') return SYMLINK_MERGE_COST
  return 0
})

const actionPreviewPercent = computed(() => {
  return actionPreviewCost.value / gameState.resources.maxBandwidth
})

const isPreviewingAction = computed(() => previewedActionType.value !== null)

// Segmented bar calculation - values used for v-memo
const filledSegments = computed(() =>
  Math.floor(bandwidthPercent.value * SEGMENTS)
)

// Round partial to 2 decimal places to reduce updates
const partialFill = computed(() => {
  const raw = (bandwidthPercent.value * SEGMENTS) % 1
  return Math.round(raw * 100) / 100
})

const costStartSegment = computed(() => {
  const costSegments = Math.ceil(costPercent.value * SEGMENTS)
  return Math.max(
    0,
    filledSegments.value - costSegments + (partialFill.value > 0 ? 1 : 0)
  )
})

const previewStartSegment = computed(() => {
  const previewSegments = Math.ceil(actionPreviewPercent.value * SEGMENTS)
  return Math.max(
    0,
    filledSegments.value - previewSegments + (partialFill.value > 0 ? 1 : 0)
  )
})

const actionAffordable = computed(
  () => gameState.resources.bandwidth >= actionPreviewCost.value
)

// Pre-compute segment states to simplify template and avoid duplicated condition checks
// Each segment has a state object that determines its appearance
const segmentStates = computed(() => {
  const previewingBw = previewedUpgradeId.value === 'bandwidth'
  const previewPercent = previewBandwidthPercent.value

  // Original fill values (always based on current capacity)
  const originalFilled = filledSegments.value
  const originalPartial = partialFill.value
  const originalFilledEnd = originalFilled + (originalPartial > 0 ? 1 : 0)

  // Effective fill: use preview values when previewing bandwidth upgrade
  const effectivePercent =
    previewingBw && previewPercent !== null
      ? previewPercent
      : bandwidthPercent.value
  const filled = Math.floor(effectivePercent * SEGMENTS)
  const partial = Math.round(((effectivePercent * SEGMENTS) % 1) * 100) / 100

  const costStart = costStartSegment.value
  const previewStart = previewStartSegment.value
  const previewingAction = isPreviewingAction.value
  const affordable = actionAffordable.value
  const canAfford = canAffordInstall.value
  const filledEnd = filled + (partial > 0 ? 1 : 0)

  return Array.from({ length: SEGMENTS }, (_, i) => {
    const isFilled = i < filled
    const isPartial = i === filled && partial > 0
    const inFilledRange = i < filledEnd
    const inCostRange = i >= costStart && inFilledRange
    const inPreviewRange =
      previewingAction && i >= previewStart && inFilledRange

    // Headroom gained: segments that are currently filled but would be empty after upgrade
    // These show the "gained capacity" zone with green pulse
    const isHeadroomGained =
      previewingBw && i >= filledEnd && i < originalFilledEnd

    return {
      index: i,
      filled: isFilled,
      partial: isPartial,
      partialValue: isPartial ? partial : 0,
      // Hide cost markers during bandwidth preview
      isCost: inCostRange && !previewingBw && !inPreviewRange,
      unaffordable: inCostRange && !canAfford && !previewingBw,
      actionPreview: inPreviewRange,
      actionAffordable: inPreviewRange && affordable,
      actionUnaffordable: inPreviewRange && !affordable,
      headroomGained: isHeadroomGained,
    }
  })
})

// ============================================
// WARNING STATES
// ============================================

const warning = computed(() => {
  if (!canAffordInstall.value) return 'critical'
  if (bandwidthPercent.value < 0.3) return 'low'
  return null
})

// ============================================
// UPGRADE PIPS
// ============================================

const isUnlocked = computed(() => isUpgradeUnlocked('bandwidth'))
const level = computed(() => getUpgradeLevel('bandwidth'))
const maxLevel = computed(() => UPGRADES.bandwidth?.maxLevel ?? 15)
const canAfford = computed(() => canPurchaseUpgrade('bandwidth'))

// Local hover state for upgrade preview
const isHoveringPips = ref(false)

function handlePipsClick() {
  // Clicking anywhere on the pips container purchases the upgrade if affordable
  if (canAfford.value) {
    purchaseUpgrade('bandwidth')
  }
}

function handlePipsEnter() {
  isHoveringPips.value = true
  setPreviewedUpgrade('bandwidth')
}

function handlePipsLeave() {
  isHoveringPips.value = false
  setPreviewedUpgrade(null)
}

// ============================================
// PREVIEW STATE
// ============================================

const isPreviewingBandwidth = computed(
  () => previewedUpgradeId.value === 'bandwidth'
)
const isPreviewingAny = computed(() => previewedUpgradeId.value !== null)

// Only show starved state when viewing the scope that's actually cascading
// Used in template :class bindings
const showStarved = computed(
  () => cascadeStarved.value && isViewingCascadeScope()
)
void showStarved.value // Suppress TS6133 - used in template
</script>

<template>
  <div
    class="resource-row bandwidth-row"
    :class="{
      'warning-low': warning === 'low',
      'warning-critical': warning === 'critical',
      'preview-active': isPreviewingAny,
      'cascade-starved': showStarved,
    }"
  >
    <!-- Bandwidth icon -->
    <div
      class="resource-icon"
      :class="{
        'bw-preview': isPreviewingBandwidth,
        'warning-low': warning === 'low',
        'warning-critical': warning === 'critical',
        'cascade-starved': showStarved,
      }"
    >
      ↓
    </div>

    <!-- Segmented bandwidth bar -->
    <div class="resource-bar">
      <div
        v-for="seg in segmentStates"
        :key="seg.index"
        class="segment"
        :class="{
          filled: seg.filled,
          partial: seg.partial,
          'is-cost': seg.isCost,
          unaffordable: seg.unaffordable,
          'action-preview': seg.actionPreview,
          'action-affordable': seg.actionAffordable,
          'action-unaffordable': seg.actionUnaffordable,
          'headroom-gained': seg.headroomGained,
        }"
      >
        <div
          v-if="seg.partial"
          class="segment-fill"
          :style="{ height: seg.partialValue * 100 + '%' }"
        ></div>
      </div>
    </div>

    <!-- Upgrade pips with hover preview (split into two rows) - only after first prestige -->
    <div
      v-if="isUnlocked"
      class="upgrade-pips-container"
      @mouseenter="handlePipsEnter"
      @mouseleave="handlePipsLeave"
      @click="handlePipsClick"
    >
      <div class="upgrade-pips">
        <span
          v-for="i in 8"
          :key="i"
          class="pip"
          :class="{
            filled: i <= level,
            affordable: i === level + 1 && canAfford,
            'next-level': i === level + 1,
          }"
        />
      </div>
      <div class="upgrade-pips">
        <span
          v-for="i in maxLevel - 8"
          :key="i + 8"
          class="pip"
          :class="{
            filled: i + 8 <= level,
            affordable: i + 8 === level + 1 && canAfford,
            'next-level': i + 8 === level + 1,
          }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.resource-row {
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: auto;
}

.resource-row.warning-critical .resource-icon {
  animation: hud-shake 0.2s linear infinite;
}

/* Resource icon */
.resource-icon {
  font-size: 18px;
  color: var(--hud-bandwidth);
  text-shadow: 0 0 8px rgba(122, 122, 255, 0.4);
  transition: all var(--hud-t-normal) ease;
  width: 24px;
  text-align: center;
}

.resource-icon.warning-low {
  color: var(--hud-warning-orange);
  text-shadow: 0 0 8px rgba(255, 170, 90, 0.5);
}

.resource-icon.warning-critical {
  color: var(--hud-warning);
  text-shadow: 0 0 8px rgba(255, 90, 90, 0.6);
  animation: hud-shake 0.2s linear infinite;
}

.resource-icon.bw-preview {
  animation: regen-pulse 0.3s ease-in-out infinite alternate;
  color: #5aff9a;
}

.resource-icon.cascade-starved {
  color: var(--hud-warning);
  text-shadow: 0 0 8px rgba(255, 90, 90, 0.6);
  animation: starved-icon-pulse 0.4s ease-in-out infinite;
}

@keyframes starved-icon-pulse {
  0%,
  100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}

/* Segmented bar */
.resource-bar {
  display: flex;
  gap: 3px;
  height: 20px;
  align-items: flex-end;
  flex: 1;
}

.segment {
  position: relative;
  width: 8px;
  flex: 1;
  height: 100%;
  background: rgba(122, 122, 255, 0.15);
  border-radius: 2px;
  transition: all var(--hud-t-fast) ease-out;
}

.segment.filled {
  background: linear-gradient(
    to top,
    var(--hud-bandwidth-dark),
    var(--hud-bandwidth)
  );
  box-shadow: 0 0 4px rgba(122, 122, 255, 0.4);
}

.segment.partial {
  background: rgba(122, 122, 255, 0.15);
}

.segment .segment-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(
    to top,
    var(--hud-bandwidth-dark),
    var(--hud-bandwidth)
  );
  border-radius: 2px;
  box-shadow: 0 0 4px rgba(122, 122, 255, 0.3);
}

/* Cost indicator - segments that will be consumed */
.segment.is-cost.filled {
  background: linear-gradient(to top, #4a4aaa, #6a6acc);
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.2);
  opacity: 0.7;
}

.segment.is-cost.filled::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 2px,
    rgba(255, 255, 255, 0.1) 2px,
    rgba(255, 255, 255, 0.1) 4px
  );
  border-radius: 2px;
}

/* Can't afford - cost segments turn red */
.segment.unaffordable.filled {
  background: linear-gradient(to top, #aa4a4a, #cc6a6a);
  box-shadow: 0 0 6px rgba(255, 90, 90, 0.4);
  opacity: 1;
}

/* Action preview - ghost segments for conflict/symlink cost */
.segment.action-preview.filled {
  opacity: 0.6;
  animation: action-preview-pulse 0.8s ease-in-out infinite;
}

.segment.action-preview.action-affordable.filled {
  background: linear-gradient(to top, #4a8a4a, #6acc6a);
  box-shadow: 0 0 8px rgba(90, 255, 90, 0.4);
}

.segment.action-preview.action-affordable.filled::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 2px,
    rgba(90, 255, 90, 0.15) 2px,
    rgba(90, 255, 90, 0.15) 4px
  );
  border-radius: 2px;
}

.segment.action-preview.action-unaffordable.filled {
  background: linear-gradient(to top, #6a6a7a, #8a8a9a);
  box-shadow: 0 0 4px rgba(150, 150, 170, 0.3);
}

@keyframes action-preview-pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 0.8;
  }
}

/* Headroom gained - green pulse showing capacity increase from bandwidth upgrade */
.segment.headroom-gained {
  background: linear-gradient(to top, #2a4a2a, #3a6a3a);
  box-shadow: 0 0 8px rgba(90, 255, 90, 0.4);
  animation: headroom-pulse 0.8s ease-in-out infinite;
}

.segment.headroom-gained::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 2px,
    rgba(90, 255, 90, 0.15) 2px,
    rgba(90, 255, 90, 0.15) 4px
  );
  border-radius: 2px;
}

@keyframes headroom-pulse {
  0%,
  100% {
    opacity: 0.6;
    box-shadow: 0 0 4px rgba(90, 255, 90, 0.3);
  }
  50% {
    opacity: 1;
    box-shadow: 0 0 12px rgba(90, 255, 90, 0.6);
  }
}

/* Cascade starved - red strobe when waiting for bandwidth during cascade */
.cascade-starved .resource-bar {
  animation: starved-glow 0.4s ease-in-out infinite;
}

.cascade-starved .segment {
  border: 1px solid rgba(255, 90, 90, 0.4);
  animation: starved-segment-pulse 0.4s ease-in-out infinite;
}

.cascade-starved .segment.filled {
  background: linear-gradient(to top, #8a4a4a, #aa6a6a);
  box-shadow: 0 0 8px rgba(255, 90, 90, 0.5);
}

.cascade-starved .segment .segment-fill {
  background: linear-gradient(to top, #8a4a4a, #aa6a6a);
}

@keyframes starved-glow {
  0%,
  100% {
    filter: drop-shadow(0 0 4px rgba(255, 90, 90, 0.3));
  }
  50% {
    filter: drop-shadow(0 0 12px rgba(255, 90, 90, 0.7));
  }
}

@keyframes starved-segment-pulse {
  0%,
  100% {
    border-color: rgba(255, 90, 90, 0.3);
  }
  50% {
    border-color: rgba(255, 90, 90, 0.7);
  }
}

/* Upgrade pips container (two rows) */
.upgrade-pips-container {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border-radius: 6px;
  transition: background var(--hud-t-fast) ease;
  cursor: pointer;
}

.upgrade-pips-container:hover {
  background: rgba(90, 255, 90, 0.05);
}

/* Upgrade pips row */
.upgrade-pips {
  display: flex;
  gap: 3px;
}

.pip {
  width: 8px;
  height: 8px;
  background: #2a2a3a;
  border-radius: 50%;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
  flex-shrink: 0;
}

.pip.filled {
  background: var(--hud-bandwidth);
  box-shadow: 0 0 4px rgba(122, 122, 255, 0.5);
}

.pip.next-level:not(.affordable) {
  background: #3a3a4a;
  border: 1px solid #5a5a6a;
}

.pip.affordable {
  background: #2a4a2a;
  box-shadow: 0 0 8px rgba(90, 255, 90, 0.6);
  animation: pip-glow 1s ease-in-out infinite;
}

.pip:hover:not(.filled) {
  background: #4a4a5a;
  transform: scale(1.3);
}

.pip.affordable:hover {
  background: #3a6a3a;
  box-shadow: 0 0 12px rgba(90, 255, 90, 0.8);
  transform: scale(1.4);
}

.pip.filled:hover {
  transform: scale(1.1);
  box-shadow: 0 0 8px rgba(122, 122, 255, 0.7);
}

@keyframes pip-glow {
  0%,
  100% {
    box-shadow: 0 0 6px rgba(90, 255, 90, 0.5);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 12px rgba(90, 255, 90, 0.8);
    transform: scale(1.15);
  }
}

@keyframes regen-pulse {
  from {
    transform: scale(1);
    opacity: 0.7;
  }
  to {
    transform: scale(1.2);
    opacity: 1;
  }
}
</style>
