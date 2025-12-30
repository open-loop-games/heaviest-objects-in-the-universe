<script setup lang="ts">
import { computed, ref } from 'vue'
import { gameState, previewedActionType } from '../../game/state'
import {
  getUpgradeLevel,
  canPurchaseUpgrade,
  purchaseUpgrade,
  getEffectiveInstallCost,
  setPreviewedUpgrade,
  previewedUpgradeId,
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

// Static segment indices for v-for
const segmentIndices = Array.from({ length: SEGMENTS }, (_, i) => i)

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
const isPreviewingEfficiency = computed(
  () => previewedUpgradeId.value === 'efficiency'
)
const isPreviewingAny = computed(() => previewedUpgradeId.value !== null)
</script>

<template>
  <div
    class="resource-row bandwidth-row"
    :class="{
      'warning-low': warning === 'low',
      'warning-critical': warning === 'critical',
      'preview-active': isPreviewingAny,
    }"
  >
    <!-- Bandwidth icon -->
    <div
      class="resource-icon"
      :class="{
        'bw-preview': isPreviewingBandwidth,
        'warning-low': warning === 'low',
        'warning-critical': warning === 'critical',
      }"
    >
      ↓
    </div>

    <!-- Segmented bandwidth bar -->
    <div class="resource-bar">
      <div
        v-for="i in segmentIndices"
        :key="i"
        v-memo="[
          i < filledSegments,
          i === filledSegments ? partialFill : 0,
          i >= costStartSegment &&
            i < filledSegments + (partialFill > 0 ? 1 : 0),
          isPreviewingAction &&
            i >= previewStartSegment &&
            i < filledSegments + (partialFill > 0 ? 1 : 0),
          canAffordInstall,
          isPreviewingEfficiency,
          actionAffordable,
        ]"
        class="segment"
        :class="{
          filled: i < filledSegments,
          partial: i === filledSegments && partialFill > 0,
          'is-cost':
            i >= costStartSegment &&
            i < filledSegments + (partialFill > 0 ? 1 : 0) &&
            !isPreviewingEfficiency &&
            !(isPreviewingAction && i >= previewStartSegment),
          unaffordable:
            i >= costStartSegment &&
            i < filledSegments + (partialFill > 0 ? 1 : 0) &&
            !canAffordInstall,
          'action-preview':
            isPreviewingAction &&
            i >= previewStartSegment &&
            i < filledSegments + (partialFill > 0 ? 1 : 0),
          'action-affordable':
            isPreviewingAction &&
            i >= previewStartSegment &&
            i < filledSegments + (partialFill > 0 ? 1 : 0) &&
            actionAffordable,
          'action-unaffordable':
            isPreviewingAction &&
            i >= previewStartSegment &&
            i < filledSegments + (partialFill > 0 ? 1 : 0) &&
            !actionAffordable,
        }"
      >
        <div
          v-if="i === filledSegments && partialFill > 0"
          class="segment-fill"
          :style="{ height: partialFill * 100 + '%' }"
        ></div>
      </div>
    </div>

    <!-- Regen indicator (shows bandwidth recovering during preview) -->
    <div v-if="isPreviewingBandwidth" class="regen-preview-indicator">
      <span class="regen-arrow">↓</span>
      <span class="regen-arrow delayed">↓</span>
    </div>

    <!-- Upgrade pips with hover preview (split into two rows) -->
    <div
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

/* Regen preview indicator */
.regen-preview-indicator {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: 4px;
}

.regen-arrow {
  font-size: 10px;
  color: var(--hud-stability);
  animation: hud-bounce 0.6s ease-in-out infinite;
}

.regen-arrow.delayed {
  animation-delay: 0.3s;
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
