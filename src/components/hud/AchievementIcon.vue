<script setup lang="ts">
// Renders achievement icons with geometric arrangements or compound layouts
//
// Geometric: 1-5 symbols in arrangements (centered, pair, triforce, square, pentagon)
// Compound layouts:
//   - spaced: two symbols with gap between
//   - sideBySide: two symbols, second scaled down (for emoji)
//   - triforceBelow: 3 symbols in triforce + 1 below

import { computed } from 'vue'

const props = defineProps<{
  // Geometric layout
  symbol?: string
  count?: 1 | 2 | 3 | 4 | 5
  // Compound layouts
  layout?: 'spaced' | 'sideBySide' | 'triforceBelow'
  symbols?: string[]
  below?: string
}>()

// Position data for geometric arrangements (percentage-based)
const geometricArrangements = {
  1: [{ x: 50, y: 50 }],
  2: [
    { x: 30, y: 50 },
    { x: 70, y: 50 },
  ],
  3: [
    { x: 50, y: 25 },
    { x: 28, y: 70 },
    { x: 72, y: 70 },
  ],
  4: [
    { x: 30, y: 30 },
    { x: 70, y: 30 },
    { x: 30, y: 70 },
    { x: 70, y: 70 },
  ],
  5: [
    { x: 50, y: 15 },
    { x: 82, y: 40 },
    { x: 70, y: 85 },
    { x: 30, y: 85 },
    { x: 18, y: 40 },
  ],
} as const

// Triforce positions for triforceBelow (shifted up to make room for below symbol)
const triforceAbovePositions = [
  { x: 50, y: 18 },
  { x: 28, y: 55 },
  { x: 72, y: 55 },
]

const isGeometric = computed(() => !props.layout && props.symbol && props.count)
const geometricPositions = computed(() => {
  if (!isGeometric.value || !props.count) return []
  return geometricArrangements[props.count]
})
</script>

<template>
  <!-- Geometric layout -->
  <div v-if="isGeometric" class="achievement-icon-container">
    <span
      v-for="(pos, index) in geometricPositions"
      :key="index"
      class="symbol"
      :style="{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
      }"
    >
      {{ symbol }}
    </span>
  </div>

  <!-- Spaced: two symbols with gap -->
  <div
    v-else-if="layout === 'spaced'"
    class="achievement-icon-container spaced"
  >
    <span class="symbol-inline">{{ symbols?.[0] }}</span>
    <span class="symbol-inline">{{ symbols?.[1] }}</span>
  </div>

  <!-- Side by side: two symbols, second scaled -->
  <div
    v-else-if="layout === 'sideBySide'"
    class="achievement-icon-container side-by-side"
  >
    <span class="symbol-inline">{{ symbols?.[0] }}</span>
    <span class="symbol-inline scaled">{{ symbols?.[1] }}</span>
  </div>

  <!-- Triforce with symbol below -->
  <div
    v-else-if="layout === 'triforceBelow'"
    class="achievement-icon-container"
  >
    <span
      v-for="(pos, index) in triforceAbovePositions"
      :key="index"
      class="symbol small"
      :style="{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
      }"
    >
      {{ symbols?.[0] }}
    </span>
    <span class="symbol below">{{ below }}</span>
  </div>
</template>

<style scoped>
.achievement-icon-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.symbol {
  position: absolute;
  transform: translate(-50%, -50%);
  font-size: 12px;
  line-height: 1;
}

.symbol.small {
  font-size: 10px;
}

.symbol.below {
  left: 50%;
  top: 82%;
  font-size: 11px;
  color: #5aff8a;
}

/* Spaced layout - flexbox with gap */
.achievement-icon-container.spaced {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.symbol-inline {
  font-size: 12px;
  line-height: 1;
}

/* Side by side - second symbol scaled down */
.achievement-icon-container.side-by-side {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.symbol-inline.scaled {
  font-size: 10px;
}
</style>
