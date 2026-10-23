<script setup lang="ts">
import { computed, ref } from 'vue'
import { computed_gravity } from '../../game/state'
import { setActiveTooltip } from '../../game/ui-state'

const SEGMENTS = 12

// Progress toward prestige threshold (0-1, capped)
const prestigeProgress = computed(() => {
  return Math.min(1, computed_gravity.value)
})

const filledSegments = computed(() =>
  Math.floor(prestigeProgress.value * SEGMENTS)
)

// Round partial to 2 decimal places to reduce updates
const partialFill = computed(() => {
  const raw = (prestigeProgress.value * SEGMENTS) % 1
  return Math.round(raw * 100) / 100
})

const segmentIndices = Array.from({ length: SEGMENTS }, (_, i) => i)
const LAST_SEGMENT = SEGMENTS - 1

const segmentStates = computed(() => {
  const currentFilled = filledSegments.value
  const currentPartial = partialFill.value
  return segmentIndices.map((i) => {
    const isPartial = i === currentFilled && currentPartial > 0
    return {
      index: i,
      filled: i < currentFilled,
      partial: isPartial,
      partialValue: isPartial ? currentPartial : 0,
      isMilestone: i === LAST_SEGMENT,
    }
  })
})

const iconRef = ref<HTMLElement | null>(null)

function handleIconEnter() {
  setActiveTooltip('weightIcon', iconRef.value ?? undefined)
}

function handleIconLeave() {
  setActiveTooltip(null)
}
</script>

<template>
  <div
    class="resource-row weight-row"
    :class="{ 'prestige-ready': prestigeProgress >= 1 }"
  >
    <!-- Weight icon -->
    <div
      ref="iconRef"
      class="resource-icon"
      @mouseenter="handleIconEnter"
      @mouseleave="handleIconLeave"
    >
      ◆
    </div>

    <!-- Segmented weight bar -->
    <div class="resource-bar">
      <div
        v-for="seg in segmentStates"
        :key="seg.index"
        class="segment"
        :class="{
          filled: seg.filled,
          partial: seg.partial,
          'milestone-segment': seg.isMilestone,
        }"
      >
        <div
          v-if="seg.partial"
          class="segment-fill"
          :style="{ height: seg.partialValue * 100 + '%' }"
        ></div>
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
</style>
