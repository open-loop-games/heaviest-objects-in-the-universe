<script setup lang="ts">
import { ref, provide, onMounted } from 'vue'
import GameCanvas from './components/GameCanvas.vue'
import CausalParticles from './components/CausalParticles.vue'

// Platform detection
import { detectPlatform } from './input'

// Desktop components
import HUD from './components/HUD.vue'

// Mobile components
import MobileHUD from './components/mobile/MobileHUD.vue'
import MobileUpgradeSheet from './components/mobile/MobileUpgradeSheet.vue'

// ============================================
// PLATFORM DETECTION
// ============================================

const platform = ref<'desktop' | 'mobile'>('desktop')

onMounted(() => {
  platform.value = detectPlatform()

  // Debug: allow forcing platform via URL param
  const params = new globalThis.URLSearchParams(window.location.search)
  const forcePlatform = params.get('platform')
  if (forcePlatform === 'mobile' || forcePlatform === 'desktop') {
    platform.value = forcePlatform
  }
})

// Provide platform to children
provide('platform', platform)

// ============================================
// MOBILE STATE
// ============================================

// Selection state for mobile action bar
const mobileSelectedNodeId = ref<string | null>(null)
const mobileSelectedWireId = ref<string | null>(null)

// Upgrade sheet state
const showUpgradeSheet = ref(false)

// Provide selection setters for GameCanvas to call
provide('setMobileSelection', {
  setNode: (id: string | null) => {
    mobileSelectedNodeId.value = id
    if (id) mobileSelectedWireId.value = null
  },
  setWire: (id: string | null) => {
    mobileSelectedWireId.value = id
    if (id) mobileSelectedNodeId.value = null
  },
  clear: () => {
    mobileSelectedNodeId.value = null
    mobileSelectedWireId.value = null
  },
})

// ============================================
// MOBILE EVENT HANDLERS
// ============================================

import { exitScope } from './game/scope'
import { gameState } from './game/state'
import { triggerPrestigeWithAnimation } from './game/prestige'

function handleMobileBack() {
  exitScope()
}

function handleMobileSettings() {
  // TODO: Show mobile settings sheet
  console.log('Settings requested')
}

function handleMobileUpgrades() {
  showUpgradeSheet.value = true
}

function handleMobilePrune() {
  gameCanvas.value?.handlePrune()
  // Clear selection after action
  mobileSelectedWireId.value = null
}

function handleMobileResolveInside() {
  gameCanvas.value?.handleResolveInside()
  // Clear selection after action
  mobileSelectedWireId.value = null
}

function handleMobileToggleAutomation() {
  gameState.automation.resolveEnabled = !gameState.automation.resolveEnabled
}

function handleMobilePrestige() {
  triggerPrestigeWithAnimation()
}

// ============================================
// GAME CANVAS REF
// ============================================

const gameCanvas = ref<InstanceType<typeof GameCanvas> | null>(null)
</script>

<template>
  <div class="app" :class="platform">
    <GameCanvas ref="gameCanvas" />

    <!-- Desktop HUD -->
    <HUD v-if="platform === 'desktop'" />

    <!-- Mobile HUD -->
    <template v-if="platform === 'mobile'">
      <MobileHUD
        :selected-node-id="mobileSelectedNodeId"
        :selected-wire-id="mobileSelectedWireId"
        @back="handleMobileBack"
        @settings="handleMobileSettings"
        @upgrades="handleMobileUpgrades"
        @prune="handleMobilePrune"
        @resolve-inside="handleMobileResolveInside"
        @toggle-automation="handleMobileToggleAutomation"
        @prestige="handleMobilePrestige"
      />
      <MobileUpgradeSheet
        :open="showUpgradeSheet"
        @close="showUpgradeSheet = false"
      />
    </template>

    <CausalParticles />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #0a0a0f;
}

#app {
  width: 100%;
  height: 100%;
}

.app {
  width: 100%;
  height: 100%;
  position: relative;
}

/* ============================================
   MOBILE-SPECIFIC STYLES
   ============================================ */

.app.mobile {
  /* Prevent text selection on mobile */
  -webkit-user-select: none;
  user-select: none;

  /* Prevent pull-to-refresh */
  overscroll-behavior: none;

  /* Prevent zoom on double-tap */
  touch-action: manipulation;
}

/* Ensure canvas doesn't trigger browser gestures */
.app.mobile canvas {
  touch-action: none;
}

/* Safe area insets for notched devices */
@supports (padding-top: env(safe-area-inset-top)) {
  .app.mobile {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
}
</style>
