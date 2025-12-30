<script setup lang="ts">
import { computed } from 'vue'
import { gameState } from '../../game/state'
import { calculateStabilityRatio } from '../../game/formulas'

// Efficiency as visual (0-1)
const efficiencyValue = computed(() => {
  return gameState.stats.currentEfficiency
})

// Stability ratio for prestige quality
const stabilityValue = computed(() => {
  return calculateStabilityRatio(gameState)
})

// Efficiency warning: too many duplicates
const efficiencyWarning = computed(() => {
  if (efficiencyValue.value <= 0.3) return 'critical' // Very bad
  if (efficiencyValue.value <= 0.5) return 'low' // Needs attention
  return null
})
</script>

<template>
  <div class="quality-metrics">
    <!-- Efficiency Bar (⚡ - deduplication quality) -->
    <div
      class="quality-bar efficiency"
      :class="{
        warning: efficiencyWarning === 'low',
        critical: efficiencyWarning === 'critical',
        excellent: efficiencyValue >= 0.8,
      }"
    >
      <span class="quality-icon">⚡</span>
      <div class="quality-track">
        <div
          class="quality-fill efficiency-fill"
          :style="{ width: efficiencyValue * 100 + '%' }"
        ></div>
        <!-- Threshold marker at 50% (where multiplier = 1.0) -->
        <div class="threshold-marker"></div>
      </div>
      <!-- Multiplier indicator: < or > based on efficiency -->
      <span
        class="multiplier-indicator"
        :class="{
          negative: efficiencyValue < 0.5,
          positive: efficiencyValue >= 0.5,
          excellent: efficiencyValue >= 0.8,
        }"
      >
        {{ efficiencyValue < 0.5 ? '▼' : efficiencyValue >= 0.8 ? '▲▲' : '▲' }}
      </span>
    </div>

    <!-- Stability Bar (✓ - conflict resolution) -->
    <div
      class="quality-bar stability"
      :class="{
        warning: stabilityValue < 0.7,
        excellent: stabilityValue >= 1.0,
      }"
    >
      <span class="quality-icon">✓</span>
      <div class="quality-track">
        <div
          class="quality-fill stability-fill"
          :style="{ width: stabilityValue * 100 + '%' }"
        ></div>
      </div>
      <!-- Stability state indicator -->
      <span
        class="stability-state"
        :class="{
          unstable: stabilityValue < 0.7,
          stable: stabilityValue >= 1.0,
        }"
      >
        {{ stabilityValue >= 1.0 ? '●' : stabilityValue < 0.7 ? '!' : '○' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.quality-metrics {
  display: flex;
  gap: 12px;
  padding-top: 4px;
  border-top: 1px solid rgba(100, 80, 140, 0.2);
}

.quality-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.quality-icon {
  font-size: 14px;
  width: 18px;
  text-align: center;
  transition: all var(--hud-t-normal) ease;
}

/* Efficiency icon colors */
.quality-bar.efficiency .quality-icon {
  color: var(--hud-efficiency);
}

.quality-bar.efficiency.warning .quality-icon {
  color: var(--hud-warning-orange);
  animation: hud-pulse 0.8s ease-in-out infinite alternate;
}

.quality-bar.efficiency.critical .quality-icon {
  color: var(--hud-warning);
  animation: hud-pulse 0.4s ease-in-out infinite alternate;
}

.quality-bar.efficiency.excellent .quality-icon {
  color: var(--hud-stability);
  text-shadow: 0 0 8px rgba(90, 255, 138, 0.6);
}

/* Stability icon colors */
.quality-bar.stability .quality-icon {
  color: var(--hud-stability);
}

.quality-bar.stability.warning .quality-icon {
  color: var(--hud-warning-orange);
  animation: hud-pulse 0.8s ease-in-out infinite alternate;
}

.quality-bar.stability.excellent .quality-icon {
  color: var(--hud-stability-dark);
  text-shadow: 0 0 8px rgba(90, 255, 90, 0.6);
}

/* Quality track (bar background) */
.quality-track {
  position: relative;
  flex: 1;
  height: 6px;
  background: rgba(40, 35, 50, 0.8);
  border-radius: 3px;
  overflow: visible;
}

/* Quality fill bars */
.quality-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease-out;
}

.quality-fill.efficiency-fill {
  background: linear-gradient(90deg, #ff6a5a, #ffaa5a, #5affff);
}

.quality-bar.efficiency.excellent .quality-fill.efficiency-fill {
  background: linear-gradient(90deg, #5affaa, #5aff8a);
  box-shadow: 0 0 8px rgba(90, 255, 138, 0.5);
}

.quality-fill.stability-fill {
  background: linear-gradient(90deg, #ff8a5a, #5aff8a);
}

.quality-bar.stability.excellent .quality-fill.stability-fill {
  background: #5aff5a;
  box-shadow: 0 0 8px rgba(90, 255, 90, 0.5);
}

/* Threshold marker (50% line where multiplier = 1.0x) */
.threshold-marker {
  position: absolute;
  left: 50%;
  top: -2px;
  bottom: -2px;
  width: 2px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 1px;
}

/* Multiplier indicator (arrows showing effect on prestige) */
.multiplier-indicator {
  font-size: 10px;
  width: 20px;
  text-align: center;
  transition: all var(--hud-t-normal) ease;
}

.multiplier-indicator.negative {
  color: #ff6a5a;
  animation: hud-shake 0.3s ease-in-out infinite;
}

.multiplier-indicator.positive {
  color: #5affaa;
}

.multiplier-indicator.excellent {
  color: var(--hud-stability-dark);
  text-shadow: 0 0 6px rgba(90, 255, 90, 0.6);
  animation: hud-pulse 1s ease-in-out infinite alternate;
}

/* Stability state indicator */
.stability-state {
  font-size: 12px;
  width: 16px;
  text-align: center;
  transition: all var(--hud-t-normal) ease;
}

.stability-state.unstable {
  color: #ff6a5a;
  animation: hud-pulse 0.5s ease-in-out infinite alternate;
}

.stability-state.stable {
  color: var(--hud-stability-dark);
  text-shadow: 0 0 6px rgba(90, 255, 90, 0.6);
}
</style>
