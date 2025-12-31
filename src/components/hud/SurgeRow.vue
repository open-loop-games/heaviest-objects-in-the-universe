<script setup lang="ts">
import { computed, ref } from 'vue'
import { gameState } from '../../game/state'
import {
  getUpgradeLevel,
  canPurchaseUpgrade,
  purchaseUpgrade,
  setPreviewedUpgrade,
  setSurgeCharge,
  getSurgeCost,
  UPGRADES,
} from '../../game/upgrades'
import { SURGE_SEGMENTS } from '../../game/config'

// ============================================
// SURGE BAR STATE
// ============================================

const chargedSegments = computed(() => gameState.surge.chargedSegments)
const unlockedSegments = computed(() => gameState.surge.unlockedSegments)

// Can we afford to add another segment?
const canAffordNextSegment = computed(() => {
  const nextCost = getSurgeCost(chargedSegments.value + 1)
  return (
    chargedSegments.value < unlockedSegments.value &&
    gameState.resources.bandwidth >= nextCost
  )
})

// Static segment indices
const segmentIndices = Array.from({ length: SURGE_SEGMENTS }, (_, i) => i)

// ============================================
// INTERACTION
// ============================================

const isDragging = ref(false)
const hoverSegment = ref<number | null>(null)

function handleSegmentClick(index: number) {
  // Clicking a segment sets charge to that level (1-indexed)
  const targetCharge = index + 1

  if (targetCharge <= chargedSegments.value) {
    // Clicking a charged segment reduces charge
    setSurgeCharge(index)
  } else if (index < unlockedSegments.value) {
    // Clicking an unlocked segment increases charge
    setSurgeCharge(targetCharge)
  }
}

function handleMouseDown(index: number) {
  isDragging.value = true
  handleSegmentClick(index)
}

function handleMouseEnter(index: number) {
  hoverSegment.value = index
  if (isDragging.value && index < unlockedSegments.value) {
    setSurgeCharge(index + 1)
  }
}

function handleMouseLeave() {
  hoverSegment.value = null
}

function handleMouseUp() {
  isDragging.value = false
}

// Global mouseup to end drag
if (typeof window !== 'undefined') {
  window.addEventListener('mouseup', () => {
    isDragging.value = false
  })
}

// ============================================
// UPGRADE PIPS
// ============================================

const surgeLevel = computed(() => getUpgradeLevel('surge'))
const surgeMaxLevel = computed(() => UPGRADES.surge?.maxLevel ?? 9)
const canAffordSurge = computed(() => canPurchaseUpgrade('surge'))

const isHoveringPips = ref(false)

function handlePipsClick() {
  if (canAffordSurge.value) {
    purchaseUpgrade('surge')
  }
}

function handlePipsEnter() {
  isHoveringPips.value = true
  setPreviewedUpgrade('surge')
}

function handlePipsLeave() {
  isHoveringPips.value = false
  setPreviewedUpgrade(null)
}
</script>

<template>
  <div class="resource-row surge-row" @mouseup="handleMouseUp">
    <!-- Surge icon (ripple/burst SVG) -->
    <div
      class="resource-icon surge-icon"
      :class="{ charged: chargedSegments > 0 }"
    >
      <svg viewBox="0 0 24 24" width="18" height="18">
        <!-- Center dot -->
        <circle cx="12" cy="12" r="3" fill="currentColor" />
        <!-- Inner ring -->
        <circle
          cx="12"
          cy="12"
          r="7"
          stroke="currentColor"
          fill="none"
          stroke-width="1.5"
          :opacity="chargedSegments >= 1 ? 0.8 : 0.3"
          class="ring ring-1"
        />
        <!-- Outer ring -->
        <circle
          cx="12"
          cy="12"
          r="11"
          stroke="currentColor"
          fill="none"
          stroke-width="1.5"
          :opacity="chargedSegments >= 5 ? 0.6 : 0.15"
          class="ring ring-2"
        />
      </svg>
    </div>

    <!-- Segmented surge bar -->
    <div class="resource-bar surge-bar">
      <div
        v-for="i in segmentIndices"
        :key="i"
        class="segment"
        :class="{
          charged: i < chargedSegments,
          unlocked: i < unlockedSegments && i >= chargedSegments,
          locked: i >= unlockedSegments,
          hovering: hoverSegment === i && i < unlockedSegments,
          'next-affordable': i === chargedSegments && canAffordNextSegment,
        }"
        @mousedown.prevent="handleMouseDown(i)"
        @mouseenter="handleMouseEnter(i)"
        @mouseleave="handleMouseLeave"
      />
    </div>

    <!-- Upgrade pips (unlock more segments) -->
    <div
      class="upgrade-pips-container"
      @mouseenter="handlePipsEnter"
      @mouseleave="handlePipsLeave"
      @click="handlePipsClick"
    >
      <div class="upgrade-pips">
        <span
          v-for="i in Math.min(5, surgeMaxLevel)"
          :key="i"
          class="pip"
          :class="{
            filled: i <= surgeLevel,
            affordable: i === surgeLevel + 1 && canAffordSurge,
            'next-level': i === surgeLevel + 1,
          }"
        />
      </div>
      <div v-if="surgeMaxLevel > 5" class="upgrade-pips">
        <span
          v-for="i in surgeMaxLevel - 5"
          :key="i + 5"
          class="pip"
          :class="{
            filled: i + 5 <= surgeLevel,
            affordable: i + 5 === surgeLevel + 1 && canAffordSurge,
            'next-level': i + 5 === surgeLevel + 1,
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

/* Surge icon */
.resource-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hud-surge);
  transition: all var(--hud-t-normal) ease;
}

.resource-icon.charged {
  color: #ffcc44;
  filter: drop-shadow(0 0 6px rgba(255, 200, 60, 0.6));
}

.resource-icon.charged .ring {
  animation: ring-pulse 1.5s ease-in-out infinite;
}

.ring-1 {
  animation-delay: 0s;
}

.ring-2 {
  animation-delay: 0.3s;
}

@keyframes ring-pulse {
  0%,
  100% {
    transform-origin: center;
    transform: scale(1);
    opacity: inherit;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
}

/* Segmented surge bar */
.resource-bar {
  display: flex;
  gap: 3px;
  height: 16px;
  align-items: center;
  flex: 1;
}

.segment {
  position: relative;
  flex: 1;
  height: 100%;
  background: rgba(240, 160, 64, 0.15);
  border-radius: 2px;
  transition: all var(--hud-t-fast) ease-out;
  cursor: pointer;
}

/* Charged segments - gold/amber glow */
.segment.charged {
  background: linear-gradient(to top, #c08020, #f0a040);
  box-shadow: 0 0 6px rgba(240, 160, 64, 0.5);
}

/* Unlocked but not charged */
.segment.unlocked {
  background: rgba(240, 160, 64, 0.25);
}

.segment.unlocked:hover,
.segment.unlocked.hovering {
  background: rgba(240, 160, 64, 0.4);
  box-shadow: 0 0 4px rgba(240, 160, 64, 0.3);
}

/* Next affordable segment pulse */
.segment.next-affordable {
  animation: segment-pulse 1.2s ease-in-out infinite;
}

@keyframes segment-pulse {
  0%,
  100% {
    background: rgba(240, 160, 64, 0.25);
    box-shadow: none;
  }
  50% {
    background: rgba(240, 160, 64, 0.45);
    box-shadow: 0 0 6px rgba(240, 160, 64, 0.4);
  }
}

/* Locked segments - diagonal stripes */
.segment.locked {
  background: rgba(60, 60, 80, 0.4);
  cursor: not-allowed;
}

.segment.locked::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 2px,
    rgba(40, 40, 50, 0.5) 2px,
    rgba(40, 40, 50, 0.5) 4px
  );
  border-radius: 2px;
}

/* Upgrade pips container */
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
  background: rgba(240, 160, 64, 0.1);
}

/* Upgrade pips row */
.upgrade-pips {
  display: flex;
  gap: 3px;
}

.pip {
  width: 6px;
  height: 6px;
  background: #2a2a3a;
  border-radius: 50%;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
  flex-shrink: 0;
}

.pip.filled {
  background: #f0a040;
  box-shadow: 0 0 4px rgba(240, 160, 64, 0.5);
}

.pip.next-level:not(.affordable) {
  background: #3a3a4a;
  border: 1px solid #5a5a6a;
}

.pip.affordable {
  background: #4a3a2a;
  box-shadow: 0 0 8px rgba(240, 160, 64, 0.6);
  animation: pip-glow 1s ease-in-out infinite;
}

.pip:hover:not(.filled) {
  background: #4a4a5a;
  transform: scale(1.3);
}

.pip.affordable:hover {
  background: #6a4a2a;
  box-shadow: 0 0 12px rgba(240, 160, 64, 0.8);
  transform: scale(1.4);
}

.pip.filled:hover {
  transform: scale(1.1);
  box-shadow: 0 0 8px rgba(240, 160, 64, 0.7);
}

@keyframes pip-glow {
  0%,
  100% {
    box-shadow: 0 0 6px rgba(240, 160, 64, 0.5);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 12px rgba(240, 160, 64, 0.8);
    transform: scale(1.15);
  }
}
</style>
