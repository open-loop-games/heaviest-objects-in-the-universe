<script setup lang="ts">
import { computed, ref } from 'vue'
import { gameState, computed_ecosystemTier } from '../../game/state'
import {
  getUpgradeLevel,
  canPurchaseUpgrade,
  purchaseUpgrade,
  setPreviewedUpgrade,
} from '../../game/upgrades'
import { AUTO_RESOLVE_DRAIN, AUTO_HOIST_DRAIN } from '../../game/config'

// ============================================
// TIER & VISIBILITY
// ============================================

const tier = computed(() => computed_ecosystemTier.value)

// Show row when any automation is available
const showRow = computed(() => tier.value >= 2)

// ============================================
// TOGGLE STATES
// ============================================

type ToggleState = 'on' | 'off' | 'paused' | 'working'

function getToggleState(
  enabled: boolean,
  active: boolean,
  drain: number
): ToggleState {
  if (!enabled) return 'off'
  if (active) return 'working'
  if (gameState.resources.bandwidth < drain) return 'paused'
  return 'on'
}

const resolveState = computed<ToggleState>(() =>
  getToggleState(
    gameState.automation.resolveEnabled,
    gameState.automation.resolveActive,
    AUTO_RESOLVE_DRAIN
  )
)

const hoistState = computed<ToggleState>(() =>
  getToggleState(
    gameState.automation.hoistEnabled,
    gameState.automation.hoistActive,
    AUTO_HOIST_DRAIN
  )
)

// ============================================
// TOGGLE HANDLERS
// ============================================

function toggleResolve() {
  gameState.automation.resolveEnabled = !gameState.automation.resolveEnabled
}

function toggleHoist() {
  gameState.automation.hoistEnabled = !gameState.automation.hoistEnabled
}

// ============================================
// SPEED UPGRADE PIPS
// ============================================

// Note: These upgrades may not exist yet in upgrades.ts
// Using placeholder logic that will work once upgrades are added
const resolveSpeedLevel = computed(() => getUpgradeLevel('resolveSpeed') || 0)
const hoistSpeedLevel = computed(() => getUpgradeLevel('hoistSpeed') || 0)

const canAffordResolveSpeed = computed(() => canPurchaseUpgrade('resolveSpeed'))
const canAffordHoistSpeed = computed(() => canPurchaseUpgrade('hoistSpeed'))

const MAX_SPEED_LEVEL = 5

// Container handlers for resolve speed
const isHoveringResolve = ref(false)
function handleResolveSpeedClick() {
  if (canAffordResolveSpeed.value) {
    purchaseUpgrade('resolveSpeed')
  }
}
function handleResolveSpeedEnter() {
  isHoveringResolve.value = true
  setPreviewedUpgrade('resolveSpeed')
}
function handleResolveSpeedLeave() {
  isHoveringResolve.value = false
  setPreviewedUpgrade(null)
}

// Container handlers for hoist speed
const isHoveringHoist = ref(false)
function handleHoistSpeedClick() {
  if (canAffordHoistSpeed.value) {
    purchaseUpgrade('hoistSpeed')
  }
}
function handleHoistSpeedEnter() {
  isHoveringHoist.value = true
  setPreviewedUpgrade('hoistSpeed')
}
function handleHoistSpeedLeave() {
  isHoveringHoist.value = false
  setPreviewedUpgrade(null)
}
</script>

<template>
  <div v-if="showRow" class="resource-row automation-row">
    <!-- Auto-resolve (Tier 2+) -->
    <div v-if="tier >= 2" class="auto-group">
      <button class="auto-toggle" :class="resolveState" @click="toggleResolve">
        <span class="auto-icon">⚙</span>
        <span class="toggle-dot" :class="resolveState">●</span>
      </button>
      <div
        class="upgrade-pips-container"
        @mouseenter="handleResolveSpeedEnter"
        @mouseleave="handleResolveSpeedLeave"
        @click="handleResolveSpeedClick"
      >
        <div class="upgrade-pips mini">
          <span
            v-for="i in MAX_SPEED_LEVEL"
            :key="i"
            class="pip"
            :class="{
              filled: i <= resolveSpeedLevel,
              affordable: i === resolveSpeedLevel + 1 && canAffordResolveSpeed,
              'next-level': i === resolveSpeedLevel + 1,
            }"
          />
        </div>
      </div>
    </div>

    <!-- Auto-hoist (Tier 3+) -->
    <div v-if="tier >= 3" class="auto-group">
      <button class="auto-toggle" :class="hoistState" @click="toggleHoist">
        <span class="auto-icon">⤴</span>
        <span class="toggle-dot" :class="hoistState">●</span>
      </button>
      <div
        class="upgrade-pips-container"
        @mouseenter="handleHoistSpeedEnter"
        @mouseleave="handleHoistSpeedLeave"
        @click="handleHoistSpeedClick"
      >
        <div class="upgrade-pips mini">
          <span
            v-for="i in MAX_SPEED_LEVEL"
            :key="i"
            class="pip"
            :class="{
              filled: i <= hoistSpeedLevel,
              affordable: i === hoistSpeedLevel + 1 && canAffordHoistSpeed,
              'next-level': i === hoistSpeedLevel + 1,
            }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.resource-row {
  display: flex;
  align-items: center;
  gap: 16px;
  pointer-events: auto;
}

/* Automation group (toggle + pips) */
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

.auto-toggle.paused {
  border-color: #ffaa5a;
  background: rgba(60, 50, 40, 0.8);
}

/* Automation icon */
.auto-icon {
  font-size: 16px;
  color: #aaaacc;
  transition: all 0.15s ease;
}

.auto-toggle.on .auto-icon,
.auto-toggle.working .auto-icon {
  color: #5aff8a;
}

.auto-toggle.paused .auto-icon {
  color: #ffaa5a;
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

.toggle-dot.paused {
  color: #ffaa5a;
  animation: hud-pulse 0.8s ease-in-out infinite alternate;
}

.toggle-dot.working {
  color: #5aff5a;
  animation: hud-pulse 0.5s ease-in-out infinite;
}

/* Upgrade pips container */
.upgrade-pips-container {
  padding: 4px 6px;
  border-radius: 6px;
  transition: background var(--hud-t-fast) ease;
  cursor: pointer;
}

.upgrade-pips-container:hover {
  background: rgba(90, 255, 255, 0.1);
}

/* Mini upgrade pips */
.upgrade-pips.mini {
  display: flex;
  gap: 2px;
}

.upgrade-pips.mini .pip {
  width: 6px;
  height: 6px;
}

/* Upgrade pips */
.pip {
  width: 8px;
  height: 8px;
  background: #2a2a3a;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s;
}

.pip.filled {
  background: #5affff;
  box-shadow: 0 0 4px rgba(90, 255, 255, 0.4);
}

.pip.affordable {
  background: #2a3a3a;
  box-shadow: 0 0 6px #5affff;
  animation: pip-glow 1s infinite;
}

.pip:hover:not(.filled) {
  background: #3a3a4a;
  transform: scale(1.2);
}

.pip.affordable:hover {
  background: #3a5a5a;
  box-shadow: 0 0 10px #5affff;
}

.pip.next-level:not(.affordable) {
  background: #3a3a4a;
  border: 1px solid #5a5a6a;
}

@keyframes pip-glow {
  0%,
  100% {
    box-shadow: 0 0 4px #5affff;
  }
  50% {
    box-shadow: 0 0 8px #5affff;
  }
}
</style>
