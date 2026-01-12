<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { gameState } from '../../game/state'
import { on } from '../../game/events'
import { setActiveTooltip } from '../../game/ui-state'

// ============================================
// JUICE ANIMATION STATE
// ============================================

const efficiencyPulse = ref(false)
const stabilityPulse = ref(false)

const unsubscribers: Array<() => void> = []

onMounted(() => {
  // Pulse efficiency bar on merge or improvement
  unsubscribers.push(
    on('game:symlink-merged', () => {
      efficiencyPulse.value = true
      setTimeout(() => (efficiencyPulse.value = false), 400)
    }),
    on('quality:efficiency-improved', () => {
      efficiencyPulse.value = true
      setTimeout(() => (efficiencyPulse.value = false), 400)
    }),
    // Pulse stability bar on scope stabilization or stability improvement
    on('game:scope-stabilized', () => {
      stabilityPulse.value = true
      setTimeout(() => (stabilityPulse.value = false), 400)
    }),
    on('quality:stability-improved', () => {
      stabilityPulse.value = true
      setTimeout(() => (stabilityPulse.value = false), 400)
    })
  )
})

onUnmounted(() => {
  unsubscribers.forEach((unsub) => unsub())
})

// ============================================
// EFFICIENCY
// ============================================

const efficiencyValue = computed(() => gameState.stats.currentEfficiency)

// Efficiency state for styling
const efficiencyState = computed(() => {
  if (efficiencyValue.value < 0.3) return 'critical'
  if (efficiencyValue.value < 0.5) return 'warning'
  if (efficiencyValue.value >= 0.85) return 'excellent'
  return 'normal'
})

// ============================================
// STABILITY
// ============================================

const stabilityValue = computed(() => gameState.stats.currentStability)

// Stability state for styling
const stabilityState = computed(() => {
  if (stabilityValue.value >= 1.0) return 'stable'
  if (stabilityValue.value < 0.5) return 'critical'
  if (stabilityValue.value < 0.7) return 'warning'
  return 'normal'
})

// ============================================
// TOOLTIP HANDLERS
// ============================================

const efficiencyIconRef = ref<HTMLElement | null>(null)
const stabilityIconRef = ref<HTMLElement | null>(null)

function handleEfficiencyEnter() {
  setActiveTooltip('efficiency', efficiencyIconRef.value ?? undefined)
}

function handleEfficiencyLeave() {
  setActiveTooltip(null)
}

function handleStabilityEnter() {
  setActiveTooltip('stability', stabilityIconRef.value ?? undefined)
}

function handleStabilityLeave() {
  setActiveTooltip(null)
}
</script>

<template>
  <div class="quality-hero">
    <!-- Efficiency Section -->
    <div class="quality-section efficiency-section" :class="efficiencyState">
      <div class="section-header">
        <span
          ref="efficiencyIconRef"
          class="section-icon tooltip-trigger"
          @mouseenter="handleEfficiencyEnter"
          @mouseleave="handleEfficiencyLeave"
          >⚡</span
        >
        <div class="section-bar-container">
          <div class="section-bar" :class="{ pulse: efficiencyPulse }">
            <div
              class="section-bar-fill efficiency-fill"
              :style="{ width: efficiencyValue * 100 + '%' }"
            />
            <!-- Threshold marker at 50% (neutral point) -->
            <div class="threshold-marker" />
          </div>
        </div>
      </div>
    </div>

    <!-- Stability Section -->
    <div class="quality-section stability-section" :class="stabilityState">
      <div class="section-header">
        <span
          ref="stabilityIconRef"
          class="section-icon tooltip-trigger"
          @mouseenter="handleStabilityEnter"
          @mouseleave="handleStabilityLeave"
          >✓</span
        >
        <div class="section-bar-container">
          <div class="section-bar" :class="{ pulse: stabilityPulse }">
            <div
              class="section-bar-fill stability-fill"
              :style="{ width: stabilityValue * 100 + '%' }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quality-hero {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ============================================
   SECTION LAYOUT
   ============================================ */

.quality-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
  transition: all 0.3s ease;
}

.section-icon.tooltip-trigger {
  cursor: help;
  pointer-events: auto;
}

.section-icon.tooltip-trigger:hover {
  transform: scale(1.15);
}

/* ============================================
   EFFICIENCY STATES
   ============================================ */

.efficiency-section .section-icon {
  color: var(--hud-efficiency, #5affff);
}

.efficiency-section.warning .section-icon {
  color: var(--hud-warning-orange, #ffaa5a);
  animation: icon-pulse 0.8s ease-in-out infinite alternate;
}

.efficiency-section.critical .section-icon {
  color: var(--hud-warning, #ff6a5a);
  animation: icon-pulse 0.4s ease-in-out infinite alternate;
}

.efficiency-section.excellent .section-icon {
  color: var(--hud-stability, #5aff8a);
  text-shadow: 0 0 10px rgba(90, 255, 138, 0.8);
}

/* ============================================
   STABILITY STATES
   ============================================ */

.stability-section .section-icon {
  color: var(--hud-stability, #5aff8a);
}

.stability-section.warning .section-icon {
  color: var(--hud-warning-orange, #ffaa5a);
  animation: icon-pulse 0.8s ease-in-out infinite alternate;
}

.stability-section.critical .section-icon {
  color: var(--hud-warning, #ff6a5a);
  animation: icon-pulse 0.5s ease-in-out infinite alternate;
}

.stability-section.stable .section-icon {
  color: var(--hud-stability, #5aff8a);
  text-shadow: 0 0 8px rgba(90, 255, 138, 0.6);
}

/* ============================================
   PROGRESS BARS
   ============================================ */

.section-bar-container {
  flex: 1;
  min-width: 120px;
}

.section-bar {
  position: relative;
  height: 10px;
  background: rgba(40, 35, 55, 0.9);
  border-radius: 5px;
  overflow: visible;
}

.section-bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.3s ease-out;
}

/* Efficiency bar gradient: red → orange → cyan */
.efficiency-fill {
  background: linear-gradient(90deg, #ff5a5a 0%, #ffaa5a 40%, #5affff 100%);
  box-shadow: 0 0 6px rgba(90, 255, 255, 0.3);
}

.efficiency-section.excellent .efficiency-fill {
  background: linear-gradient(90deg, #5affaa, #5affff);
  box-shadow: 0 0 10px rgba(90, 255, 200, 0.5);
}

/* Stability bar gradient: orange → green */
.stability-fill {
  background: linear-gradient(90deg, #ff8a5a 0%, #5aff8a 100%);
  box-shadow: 0 0 6px rgba(90, 255, 138, 0.3);
}

.stability-section.stable .stability-fill {
  background: #5aff8a;
  box-shadow: 0 0 10px rgba(90, 255, 138, 0.5);
}

/* Threshold marker (50% line) */
.threshold-marker {
  position: absolute;
  left: 50%;
  top: -2px;
  bottom: -2px;
  width: 2px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 1px;
}

/* ============================================
   ANIMATIONS
   ============================================ */

@keyframes icon-pulse {
  0%,
  100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

/* ============================================
   JUICE ANIMATIONS (Event-triggered)
   ============================================ */

/* Bar pulse on improvement */
.section-bar.pulse {
  animation: bar-pulse 0.4s ease-out;
}

@keyframes bar-pulse {
  0% {
    filter: brightness(1);
    box-shadow: none;
  }
  50% {
    filter: brightness(1.5);
    box-shadow: 0 0 16px rgba(90, 255, 255, 0.8);
  }
  100% {
    filter: brightness(1);
    box-shadow: none;
  }
}
</style>
