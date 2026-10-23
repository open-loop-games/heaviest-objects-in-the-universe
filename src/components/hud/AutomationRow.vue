<script setup lang="ts">
import { computed, ref } from 'vue'
import { gameState } from '../../game/state'
import { setActiveTooltip } from '../../game/ui-state'

type ToggleState = 'on' | 'off' | 'working'

const resolveState = computed<ToggleState>(() => {
  if (!gameState.automation.resolveEnabled) return 'off'
  if (gameState.automation.resolveActive) return 'working'
  return 'on'
})

function toggleResolve() {
  gameState.automation.resolveEnabled = !gameState.automation.resolveEnabled
}

const autoResolveToggleRef = ref<HTMLElement | null>(null)

function handleToggleEnter() {
  setActiveTooltip('autoResolve', autoResolveToggleRef.value ?? undefined)
}
function handleToggleLeave() {
  setActiveTooltip(null)
}
</script>

<template>
  <div class="resource-row automation-row">
    <!-- Row prefix: gear indicates automation section -->
    <span class="row-prefix">⚙</span>

    <div class="auto-group">
      <button
        ref="autoResolveToggleRef"
        class="auto-toggle"
        :class="resolveState"
        @click="toggleResolve"
        @mouseenter="handleToggleEnter"
        @mouseleave="handleToggleLeave"
      >
        <span class="auto-icon">✕</span>
        <span class="toggle-dot" :class="resolveState">●</span>
      </button>
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

/* Row prefix (gear icon) - matches other row icons */
.row-prefix {
  font-size: 18px;
  width: 24px;
  text-align: center;
  color: #6a6a8a;
  opacity: 0.7;
}

/* Automation group */
.auto-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Toggle button */
.auto-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: rgba(40, 40, 60, 0.8);
  border: 2px solid #4a4a6a;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.auto-toggle:hover {
  background: rgba(60, 60, 90, 0.9);
  border-color: #6a6a9a;
}

.auto-toggle.on,
.auto-toggle.working {
  border-color: #5aff5a;
  background: rgba(40, 60, 50, 0.8);
}

.auto-toggle.off {
  border-color: #4a4a6a;
}

/* Automation icon */
.auto-icon {
  font-size: 18px;
  color: #aaaacc;
  transition: all 0.15s ease;
}

.auto-toggle.on .auto-icon,
.auto-toggle.working .auto-icon {
  color: #5aff8a;
}

.auto-toggle.working .auto-icon {
  animation: hud-spin 0.6s linear infinite;
}

/* Toggle dot (state indicator) */
.toggle-dot {
  font-size: 12px;
  transition: all 0.15s ease;
}

.toggle-dot.on {
  color: #5aff5a;
}

.toggle-dot.off {
  color: #ff5a5a;
}

.toggle-dot.working {
  color: #5aff5a;
  animation: hud-pulse 0.5s ease-in-out infinite;
}
</style>
