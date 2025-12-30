<script setup lang="ts">
import { computed } from 'vue'
import {
  gameState,
  computed_gravity,
  computed_ecosystemTier,
} from '../game/state'
import { isInPackageScope } from '../game/scope'

// Extracted HUD sub-components
import ScopeNavigation from './hud/ScopeNavigation.vue'
import SettingsPanel from './hud/SettingsPanel.vue'
import QualityMetrics from './hud/QualityMetrics.vue'
import PrestigeOrbit from './hud/PrestigeOrbit.vue'

// New Phase 5 components
import BandwidthRow from './hud/BandwidthRow.vue'
import WeightRow from './hud/WeightRow.vue'
import AutomationRow from './hud/AutomationRow.vue'

// ============================================
// STAGED HUD VISIBILITY
// ============================================

const showBandwidth = computed(() => gameState.onboarding.firstClickComplete)

const showWeight = computed(() => {
  if (gameState.onboarding.weightSeen) return true
  if (gameState.packages.size >= 8) {
    gameState.onboarding.weightSeen = true
    return true
  }
  return false
})

const showEfficiency = computed(() => {
  if (gameState.onboarding.efficiencySeen) return true
  if (gameState.packages.size >= 8) {
    gameState.onboarding.efficiencySeen = true
    return true
  }
  return false
})

const showAutomation = computed(() => computed_ecosystemTier.value >= 2)

// Check if we're inside a package scope
const inPackageScope = computed(() => isInPackageScope())

// Gravity progress
const gravityPercent = computed(() =>
  Math.min(100, computed_gravity.value * 100)
)

// Prestige progress
const prestigeProgress = computed(() => Math.min(1, computed_gravity.value))

// Show prestige area
const showPrestigeArea = computed(() => {
  if (
    gameState.onboarding.firstPrestigeComplete ||
    gameState.meta.cacheTokens > 0
  ) {
    return true
  }
  return gravityPercent.value > 20
})
</script>

<template>
  <div class="hud">
    <!-- Top right: Save & Settings (absolutely positioned) -->
    <div class="hud-settings">
      <SettingsPanel />
    </div>

    <!-- Left stack: Resource panel + Scope navigation -->
    <div class="hud-left-stack">
      <!-- Unified resource panel -->
      <div
        v-if="showBandwidth"
        class="hud-panel"
        :class="{ 'prestige-ready': prestigeProgress >= 1 }"
      >
        <!-- Bandwidth Row -->
        <BandwidthRow />

        <!-- Weight Row -->
        <Transition name="fade">
          <WeightRow v-if="showWeight" />
        </Transition>

        <!-- Quality Metrics -->
        <Transition name="fade">
          <QualityMetrics v-if="showEfficiency" />
        </Transition>

        <!-- Automation Row -->
        <Transition name="fade">
          <AutomationRow v-if="showAutomation" />
        </Transition>
      </div>

      <!-- Scope Navigation (back button + depth totem) - below resource panel -->
      <Transition name="scope-nav">
        <ScopeNavigation v-if="inPackageScope" />
      </Transition>
    </div>

    <!-- Bottom bar: Prestige Area -->
    <div class="hud-bottom">
      <Transition name="fade">
        <PrestigeOrbit v-if="showPrestigeArea" />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  font-family: 'Courier New', monospace;
  color: #eeeeff;
}

.hud-settings {
  position: absolute;
  top: 24px;
  right: 24px;
}

.hud-left-stack {
  position: absolute;
  top: 24px;
  left: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hud-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: var(--hud-bg-solid);
  border-radius: 12px;
  border: 2px solid var(--hud-border);
  transition: all var(--hud-t-normal) ease;
}

.hud-panel.prestige-ready {
  border-color: rgba(122, 90, 255, 0.7);
  box-shadow:
    0 0 20px rgba(122, 90, 255, 0.4),
    inset 0 0 30px rgba(122, 90, 255, 0.1);
  animation: prestige-panel-pulse 1.5s ease-in-out infinite;
}

@keyframes prestige-panel-pulse {
  0%,
  100% {
    box-shadow:
      0 0 16px rgba(122, 90, 255, 0.3),
      inset 0 0 20px rgba(122, 90, 255, 0.1);
  }
  50% {
    box-shadow:
      0 0 28px rgba(122, 90, 255, 0.5),
      inset 0 0 40px rgba(122, 90, 255, 0.15);
  }
}

.hud-bottom {
  position: absolute;
  bottom: 24px;
  left: 24px;
  display: flex;
  align-items: flex-end;
}

/* ============================================
   TRANSITIONS
   ============================================ */

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* HUD reveal transition (staged disclosure) */
.hud-reveal-enter-active {
  transition: all 0.4s ease-out;
}

.hud-reveal-leave-active {
  transition: all 0.2s ease-in;
}

.hud-reveal-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.9);
}

.hud-reveal-leave-to {
  opacity: 0;
}

/* Scope navigation transition */
.scope-nav-enter-active {
  transition: all 0.3s ease-out;
}

.scope-nav-leave-active {
  transition: all 0.2s ease-in;
}

.scope-nav-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.scope-nav-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
