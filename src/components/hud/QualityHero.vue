<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { gameState } from '../../game/state'
import { on } from '../../game/events'
import { getQualityTier } from '../../game/formulas'
import { setActiveTooltip } from '../../game/ui-state'

// q: the share of the board's problems resolved, what the ship reward is linear in.
const quality = computed(() => gameState.run.resolvedShare)

// Colour only, no motion: q sits low early in every run, while the board's problems spawn
// faster than they are resolved, so a warning would nag through the whole opening.
const qualityState = computed(() => {
  if (quality.value >= 1) return 'stable'
  const tier = getQualityTier(quality.value)
  if (tier === 'bloated') return 'critical'
  if (tier === 'messy') return 'warning'
  return 'normal'
})

const pulse = ref(false)
const unsubscribers: Array<() => void> = []

function flash() {
  pulse.value = true
  setTimeout(() => (pulse.value = false), 400)
}

onMounted(() => {
  unsubscribers.push(
    on('game:symlink-merged', flash),
    on('game:conflict-resolved', flash),
    on('game:scope-stabilized', flash)
  )
})

onUnmounted(() => {
  unsubscribers.forEach((unsub) => unsub())
})

const iconRef = ref<HTMLElement | null>(null)

function handleIconEnter() {
  setActiveTooltip('quality', iconRef.value ?? undefined)
}

function handleIconLeave() {
  setActiveTooltip(null)
}
</script>

<template>
  <div class="quality-hero">
    <div class="quality-section" :class="qualityState">
      <span
        ref="iconRef"
        class="section-icon tooltip-trigger"
        @mouseenter="handleIconEnter"
        @mouseleave="handleIconLeave"
        >✓</span
      >
      <div class="section-bar-container">
        <div class="section-bar" :class="{ pulse }">
          <div
            class="section-bar-fill quality-fill"
            :style="{ width: quality * 100 + '%' }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quality-hero {
  display: flex;
  flex-direction: column;
}

.quality-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
  color: var(--hud-quality);
  transition: color 0.3s ease;
}

.section-icon.tooltip-trigger {
  cursor: help;
  pointer-events: auto;
}

.section-icon.tooltip-trigger:hover {
  transform: scale(1.15);
}

.quality-section.warning .section-icon {
  color: var(--hud-warning-orange, #ffaa5a);
}

.quality-section.critical .section-icon {
  color: var(--hud-warning, #ff6a5a);
}

.quality-section.stable .section-icon {
  text-shadow: 0 0 8px rgba(90, 255, 138, 0.6);
}

.section-bar-container {
  flex: 1;
  min-width: 120px;
}

.section-bar {
  position: relative;
  height: 10px;
  background: rgba(40, 35, 55, 0.9);
  border-radius: 5px;
}

.section-bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.3s ease-out;
}

/* q gradient: orange → green; a fully resolved board glows solid */
.quality-fill {
  background: linear-gradient(90deg, #ff8a5a 0%, #5aff8a 100%);
  box-shadow: 0 0 6px rgba(90, 255, 138, 0.3);
}

.quality-section.stable .quality-fill {
  background: #5aff8a;
  box-shadow: 0 0 10px rgba(90, 255, 138, 0.5);
}

/* Bar pulse on a resolved problem */
.section-bar.pulse {
  animation: bar-pulse 0.4s ease-out;
}

@keyframes bar-pulse {
  0% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.5);
  }
  100% {
    filter: brightness(1);
  }
}
</style>
