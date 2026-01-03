<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import {
  gameState,
  computed_gravity,
  computed_ecosystemTier,
  computed_canPrestige,
} from '../game/state'
import { isInPackageScope } from '../game/scope'

// Extracted HUD sub-components
import ScopeNavigation from './hud/ScopeNavigation.vue'
import SettingsPanel from './hud/SettingsPanel.vue'
import QualityHero from './hud/QualityHero.vue'
import PrestigeOrbit from './hud/PrestigeOrbit.vue'
import TeachingBook from './hud/TeachingBook.vue'
import JourneyModal from './hud/JourneyModal.vue'
import EndScreen from './hud/EndScreen.vue'

// Resource row components
import BandwidthRow from './hud/BandwidthRow.vue'
import WeightRow from './hud/WeightRow.vue'
import AutomationRow from './hud/AutomationRow.vue'
import SurgeRow from './hud/SurgeRow.vue'

// Teaching book state
import { unlockTab } from '../onboarding'

// ============================================
// STAGED HUD VISIBILITY
// ============================================

const showBandwidth = computed(() => gameState.onboarding.firstClickComplete)

// Track onboarding state changes with watchEffect (side effects, not computation)
watchEffect(() => {
  if (!gameState.onboarding.weightSeen && gameState.packages.size >= 2) {
    gameState.onboarding.weightSeen = true
  }
  if (!gameState.onboarding.efficiencySeen && gameState.packages.size >= 2) {
    gameState.onboarding.efficiencySeen = true
  }
})

// Teaching book tab unlock triggers (pulse only, no auto-open)
watchEffect(() => {
  if (gameState.onboarding.firstSymlinkSeen) {
    unlockTab('duplicates')
  }
  if (gameState.onboarding.firstConflictSeen) {
    unlockTab('conflicts')
  }
  if (gameState.onboarding.firstDivablePackageSeen) {
    unlockTab('diving')
  }
  if (
    computed_canPrestige.value ||
    gameState.onboarding.firstPrestigeComplete
  ) {
    unlockTab('ship')
  }
  // Surge unlocks after P2 (second prestige)
  if (gameState.meta.timesShipped >= 2) {
    unlockTab('surge')
  }
})

// Pure computeds - no mutations
const showWeight = computed(
  () => gameState.onboarding.weightSeen || gameState.packages.size >= 2
)

const showEfficiency = computed(
  () => gameState.onboarding.efficiencySeen || gameState.packages.size >= 2
)

const showAutomation = computed(() => computed_ecosystemTier.value >= 2)

// Surge unlocks after P2 (second prestige)
const showSurge = computed(() => gameState.meta.timesShipped >= 2)

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
        <!-- Quality Hero (PROMOTED - shows efficiency & stability prominently) -->
        <Transition name="fade">
          <QualityHero v-if="showEfficiency" />
        </Transition>

        <!-- Separator between quality and resources -->
        <div v-if="showEfficiency" class="hud-separator" />

        <!-- Bandwidth Row -->
        <BandwidthRow />

        <!-- Surge Row (P2+) -->
        <Transition name="fade">
          <SurgeRow v-if="showSurge" />
        </Transition>

        <!-- Weight Row (DEMOTED - secondary indicator) -->
        <Transition name="fade">
          <WeightRow v-if="showWeight" />
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

    <!-- Teaching Book (bottom-right) -->
    <TeachingBook />

    <!-- Journey Modal (full loop tutorial) -->
    <JourneyModal />

    <!-- End Screen Modal (collapse finale) -->
    <EndScreen />
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

.hud-separator {
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(90, 255, 255, 0.3) 20%,
    rgba(90, 255, 255, 0.3) 80%,
    transparent 100%
  );
  margin: 2px 0;
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
