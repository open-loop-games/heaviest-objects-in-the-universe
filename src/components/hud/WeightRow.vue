<script setup lang="ts">
import { computed, ref } from 'vue'
import { gameState, computed_gravity } from '../../game/state'
import {
  getUpgradeLevel,
  canPurchaseUpgrade,
  purchaseUpgrade,
  setPreviewedUpgrade,
  UPGRADES,
} from '../../game/upgrades'

// ============================================
// WEIGHT BAR
// ============================================

const SEGMENTS = 12

// Progress toward prestige threshold (0-1, capped)
const prestigeProgress = computed(() => {
  return Math.min(1, computed_gravity.value)
})

// Segmented weight bar - split into separate computeds for v-memo
const filledSegments = computed(() =>
  Math.floor(prestigeProgress.value * SEGMENTS)
)

// Round partial to 2 decimal places to reduce updates
const partialFill = computed(() => {
  const raw = (prestigeProgress.value * SEGMENTS) % 1
  return Math.round(raw * 100) / 100
})

// Static segment indices for v-for
const segmentIndices = Array.from({ length: SEGMENTS }, (_, i) => i)
const LAST_SEGMENT = SEGMENTS - 1

// ============================================
// MAGNITUDE DOTS (B, K, M, G)
// ============================================

const magnitude = computed(() => {
  const w = gameState.resources.weight * 1024
  if (w < 1000) return 0 // B
  if (w < 1000000) return 1 // K
  if (w < 1000000000) return 2 // M
  return 3 // G
})

// How far through current magnitude (0-1) for milestone detection
const weightFillPercent = computed(() => {
  const w = gameState.resources.weight * 1024
  if (w < 1000) return w / 1000
  if (w < 1000000) return (w - 1000) / (1000000 - 1000)
  if (w < 1000000000) return (w - 1000000) / (1000000000 - 1000000)
  return Math.min(1, (w - 1000000000) / 1000000000)
})

// Weight milestone: approaching next magnitude
const weightMilestone = computed(() => {
  return weightFillPercent.value > 0.8
})

// ============================================
// COMPRESSION UPGRADE (P3+ only)
// ============================================

const showCompression = computed(() => {
  return gameState.meta.totalPrestiges >= 3
})

const compressionLevel = computed(() => getUpgradeLevel('compression'))
const compressionMaxLevel = computed(() => UPGRADES.compression?.maxLevel ?? 8)
const canAffordCompression = computed(() => canPurchaseUpgrade('compression'))

// Local hover state for upgrade preview
const isHoveringCompression = ref(false)

function handleCompressionClick() {
  if (canAffordCompression.value) {
    purchaseUpgrade('compression')
  }
}

function handleCompressionEnter() {
  isHoveringCompression.value = true
  setPreviewedUpgrade('compression')
}

function handleCompressionLeave() {
  isHoveringCompression.value = false
  setPreviewedUpgrade(null)
}
</script>

<template>
  <div
    class="resource-row weight-row"
    :class="{
      'prestige-ready': prestigeProgress >= 1,
      'milestone-near': weightMilestone,
    }"
  >
    <!-- Weight icon -->
    <div class="resource-icon" :class="{ 'milestone-pulse': weightMilestone }">
      ◆
    </div>

    <!-- Segmented weight bar -->
    <div class="resource-bar">
      <div
        v-for="i in segmentIndices"
        :key="i"
        v-memo="[i < filledSegments, i === filledSegments ? partialFill : 0]"
        class="segment"
        :class="{
          filled: i < filledSegments,
          partial: i === filledSegments && partialFill > 0,
          'milestone-segment': i === LAST_SEGMENT,
        }"
      >
        <div
          v-if="i === filledSegments && partialFill > 0"
          class="segment-fill"
          :style="{ height: partialFill * 100 + '%' }"
        ></div>
      </div>
    </div>

    <!-- Magnitude dots (B, K, M, G) -->
    <div class="magnitude-dots">
      <span
        v-for="i in 4"
        :key="i"
        class="mag-dot"
        :class="{ active: magnitude >= i - 1 }"
      />
    </div>

    <!-- Compression pips (P3+ only) -->
    <div
      v-if="showCompression"
      class="upgrade-pips-container compression-container"
      @mouseenter="handleCompressionEnter"
      @mouseleave="handleCompressionLeave"
      @click="handleCompressionClick"
    >
      <div class="upgrade-pips compression-pips">
        <span
          v-for="i in compressionMaxLevel"
          :key="i"
          class="pip compression"
          :class="{
            filled: i <= compressionLevel,
            affordable: i === compressionLevel + 1 && canAffordCompression,
            'next-level': i === compressionLevel + 1,
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

/* Resource icon */
.resource-icon {
  font-size: 18px;
  color: var(--hud-weight);
  transition: all var(--hud-t-normal) ease-out;
  width: 24px;
  text-align: center;
}

.resource-icon.milestone-pulse {
  animation: milestone-glow 1.2s ease-in-out infinite;
  text-shadow: 0 0 12px rgba(255, 170, 90, 0.6);
}

/* Segmented bar */
.resource-bar {
  display: flex;
  gap: 2px;
  height: 20px;
  padding: 2px;
  background: rgba(20, 18, 15, 0.8);
  border-radius: 4px;
  min-width: 140px;
  flex: 1;
}

.segment {
  position: relative;
  flex: 1;
  height: 100%;
  background: rgba(255, 170, 90, 0.15);
  border-radius: 2px;
  overflow: hidden;
  transition: all var(--hud-t-fast) ease;
}

.segment.filled {
  background: linear-gradient(
    to top,
    var(--hud-weight-dark),
    var(--hud-weight)
  );
  box-shadow: 0 0 4px rgba(255, 170, 90, 0.4);
}

.segment.partial {
  background: rgba(255, 170, 90, 0.15);
}

.segment .segment-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(
    to top,
    var(--hud-weight-dark),
    var(--hud-weight)
  );
  border-radius: 2px;
  transition: height 0.1s ease-out;
}

/* Last segment (milestone) styling */
.segment.milestone-segment {
  border: 1px solid rgba(122, 90, 255, 0.4);
}

.segment.milestone-segment.filled {
  background: linear-gradient(
    to top,
    var(--hud-prestige),
    var(--hud-prestige-light)
  );
  box-shadow: 0 0 8px rgba(122, 90, 255, 0.6);
  animation: hud-pulse 1s ease-in-out infinite alternate;
}

/* Magnitude dots (B, K, M, G) */
.magnitude-dots {
  display: flex;
  flex-direction: column;
  gap: 1px;
  align-items: center;
}

.mag-dot {
  width: 4px;
  height: 4px;
  background: rgba(255, 170, 90, 0.2);
  border-radius: 50%;
  transition: all var(--hud-t-normal) ease;
}

.mag-dot.active {
  background: var(--hud-weight);
  box-shadow: 0 0 3px rgba(255, 170, 90, 0.6);
}

/* Upgrade pips container */
.upgrade-pips-container {
  padding: 4px 6px;
  border-radius: 6px;
  transition: background var(--hud-t-fast) ease;
  cursor: pointer;
}

.upgrade-pips-container:hover {
  background: rgba(255, 170, 90, 0.1);
}

/* Compression upgrade pips */
.upgrade-pips {
  display: flex;
  gap: 2px;
}

.pip {
  width: 6px;
  height: 6px;
  background: #2a2a3a;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s;
  will-change: transform;
  flex-shrink: 0;
}

.pip.filled {
  background: #5aff5a;
  box-shadow: 0 0 3px rgba(90, 255, 90, 0.4);
}

.pip.affordable {
  background: #2a3a2a;
  box-shadow: 0 0 6px #5aff5a;
  animation: pip-glow 1s infinite;
}

.pip:hover:not(.filled) {
  background: #3a3a4a;
  transform: scale(1.2);
}

.pip.affordable:hover {
  background: #3a5a3a;
  box-shadow: 0 0 10px #5aff5a;
}

/* Compression pips have a different color */
.pip.compression.filled {
  background: #ffaa5a;
  box-shadow: 0 0 4px rgba(255, 170, 90, 0.4);
}

.pip.compression.affordable {
  background: #3a2a2a;
  box-shadow: 0 0 6px #ffaa5a;
}

.pip.compression.affordable:hover {
  background: #5a3a2a;
  box-shadow: 0 0 10px #ffaa5a;
}

.pip.compression.next-level:not(.affordable) {
  background: #3a3a4a;
  border: 1px solid #5a5a6a;
}

@keyframes pip-glow {
  0%,
  100% {
    box-shadow: 0 0 4px currentColor;
  }
  50% {
    box-shadow: 0 0 8px currentColor;
  }
}

@keyframes milestone-glow {
  0%,
  100% {
    text-shadow: 0 0 8px rgba(255, 170, 90, 0.4);
    transform: scale(1);
  }
  50% {
    text-shadow: 0 0 16px rgba(255, 170, 90, 0.8);
    transform: scale(1.1);
  }
}
</style>
