<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
  onWatcherCleanup,
} from 'vue'
import { setShipButtonPos } from '../../onboarding/tutorial-state'
import {
  gameState,
  computed_gravity,
  computed_prestigeReward,
  computed_canPrestige,
} from '../../game/state'
import { triggerShipWithAnimation } from '../../game/ship'
import { calculateStabilityRatio } from '../../game/formulas'
import {
  isAutomationProcessing,
  getAutomationProcessingType,
} from '../../game/automation'
import { FRAGMENT_TO_TOKEN_RATIO } from '../../game/config'
import { on, emit } from '../../game/events'
import { setActiveTooltip } from '../../game/ui-state'
import NpmMass from './NpmMass.vue'
import TierArcs from './TierArcs.vue'

// ============================================
// PRESTIGE STATE
// ============================================

// Gravity toward collapse
const gravityPercent = computed(() => {
  return Math.min(100, computed_gravity.value * 100)
})

// Gravity ready: can prestige
const gravityReady = computed(() => computed_canPrestige.value)

// Show cache tokens after first prestige
const showCacheTokens = computed(
  () =>
    gameState.onboarding.firstPrestigeComplete || gameState.meta.cacheTokens > 0
)

// Show gravity pull effect only when ship is fully ready
// Draws attention without being too noisy during approach
const showGravityPull = computed(() => gravityReady.value)

// Show quality indicators after first conflict or symlink opportunity
const showQualityIndicators = computed(() => {
  return (
    gameState.onboarding.firstConflictSeen ||
    gameState.stats.totalSymlinksCreated > 0 ||
    gameState.packages.size >= 10
  )
})

// Current ecosystem tier (1-5) for central mass visual
const ecosystemTier = computed(() => gameState.meta.ecosystemTier)

// ============================================
// COLLAPSE HOLD STATE
// ============================================

// Can collapse at Tier 5
const collapseReady = computed(() => ecosystemTier.value >= 5)

// Reactive collapse hold state (updated via events)
const collapseHoldProgress = ref(0)
const collapseHoldLocked = ref(false)
const collapseHoldDrainedTiers = ref(0)
const isHoldingCollapse = ref(false)
const collapseCancelled = ref(false)

// Hold gesture handlers
function onMassHoldStart(e: MouseEvent | TouchEvent) {
  if (!collapseReady.value) return
  e.preventDefault()
  isHoldingCollapse.value = true
  emit('collapse:begin-hold')
}

function onMassHoldEnd() {
  if (!isHoldingCollapse.value) return
  isHoldingCollapse.value = false
  emit('collapse:end-hold')
}

// Subscribe to collapse events
let unsubProgress: (() => void) | null = null
let unsubLocked: (() => void) | null = null
let unsubCancel: (() => void) | null = null
let unsubComplete: (() => void) | null = null

onMounted(() => {
  unsubProgress = on('collapse:hold-progress', ({ progress, drainedTiers }) => {
    collapseHoldProgress.value = progress
    collapseHoldDrainedTiers.value = drainedTiers
  })

  unsubLocked = on('collapse:locked', () => {
    collapseHoldLocked.value = true
  })

  unsubCancel = on('collapse:hold-cancel', () => {
    // Trigger cancel animation before resetting
    collapseCancelled.value = true
    isHoldingCollapse.value = false

    // Animate refill over 400ms then reset
    setTimeout(() => {
      collapseHoldProgress.value = 0
      collapseHoldLocked.value = false
      collapseHoldDrainedTiers.value = 0
      collapseCancelled.value = false
    }, 400)
  })

  unsubComplete = on('collapse:complete', () => {
    collapseHoldProgress.value = 0
    collapseHoldLocked.value = false
    collapseHoldDrainedTiers.value = 0
    isHoldingCollapse.value = false
  })

  // Handle mouse/touch release anywhere (in case they drag off)
  window.addEventListener('mouseup', onMassHoldEnd)
  window.addEventListener('touchend', onMassHoldEnd)
  window.addEventListener('touchcancel', onMassHoldEnd)

  // Subscribe to ship reward for token collection celebration
  unsubShipReward = on('ship:reward', ({ tierBefore, tierAfter }) => {
    // Trigger collecting animation
    isCollectingTokens.value = true
    setTimeout(() => {
      isCollectingTokens.value = false
    }, 1000)

    // Tier up celebration
    if (tierAfter > tierBefore) {
      tierUpCelebration.value = true
      setTimeout(() => {
        tierUpCelebration.value = false
      }, 1500)
    }
  })
})

onUnmounted(() => {
  unsubProgress?.()
  unsubLocked?.()
  unsubCancel?.()
  unsubComplete?.()
  unsubShipReward?.()
  setShipButtonPos(null)
  if (gravityParticleInterval) {
    clearInterval(gravityParticleInterval)
  }
  window.removeEventListener('mouseup', onMassHoldEnd)
  window.removeEventListener('touchend', onMassHoldEnd)
  window.removeEventListener('touchcancel', onMassHoldEnd)
})

// ============================================
// ORBITAL VISUALIZATION
// ============================================

// Orbital decay visualization - orbit shrinks and speeds up as weight grows
const orbitRadius = computed(() => {
  // Start at 40px, shrink to 8px as gravity approaches 100%
  const progress = gravityPercent.value / 100
  return Math.max(8, 40 - progress * 32)
})

const orbitSpeed = computed(() => {
  // Start at 8s per rotation, speed up to 0.5s at max
  const progress = gravityPercent.value / 100
  return Math.max(0.5, 8 - progress * 7.5)
})

// Fixed orbiter count (always 6, visibility controlled by CSS)
const MAX_ORBITERS = 6

// How many orbiters should be visible (3-6 based on progress)
const visibleOrbiterCount = computed(() => {
  const progress = gravityPercent.value / 100
  return Math.min(6, Math.max(3, Math.floor(3 + progress * 3)))
})

// ============================================
// QUALITY METRICS
// ============================================

const efficiencyValue = computed(() => gameState.stats.currentEfficiency)
const stabilityValue = computed(() => calculateStabilityRatio(gameState))

// Arc percentages for SVG (0-100 for stroke-dasharray)
const efficiencyArcPercent = computed(() => efficiencyValue.value * 100)
const stabilityArcPercent = computed(() => stabilityValue.value * 100)

// ============================================
// PRESTIGE REWARD
// ============================================

// Prestige reward as visual dots (1-5 based on reward amount)
const prestigeRewardDots = computed(() => {
  const reward = computed_prestigeReward.value
  if (reward <= 0) return 0
  if (reward <= 1) return 1
  if (reward <= 3) return 2
  if (reward <= 5) return 3
  if (reward <= 10) return 4
  return 5
})

// Reward quality tier based on efficiency (for token styling)
const rewardQuality = computed(() => {
  const eff = efficiencyValue.value
  if (eff >= 0.8) return 'excellent' // Bright glow
  if (eff >= 0.5) return 'good' // Normal
  if (eff >= 0.3) return 'poor' // Faded
  return 'terrible' // Very faded, shaky
})

// ============================================
// CACHE FRAGMENT DISPLAY
// ============================================

// Full tokens from fragments (bonus on prestige)
const fragmentBonusTokens = computed(() => {
  return Math.floor(
    gameState.resources.cacheFragments / FRAGMENT_TO_TOKEN_RATIO
  )
})

// Number of filled fragment stars (0-4, 5th triggers rollover)
const filledFragmentStars = computed(() => {
  return gameState.resources.cacheFragments % FRAGMENT_TO_TOKEN_RATIO
})

// Whether to show fragment indicator (has any fragments)
const hasFragments = computed(() => gameState.resources.cacheFragments > 0)

// ============================================
// UNIFIED TOKEN DISPLAY
// ============================================

// Total pending tokens on ship = base reward + fragment bonus
const totalPendingTokens = computed(() => {
  return prestigeRewardDots.value + fragmentBonusTokens.value
})

// Max tokens per row before overflow
const TOKENS_PER_ROW = 5

// First row tokens (up to 5)
const firstRowTokens = computed(() => {
  return Math.min(totalPendingTokens.value, TOKENS_PER_ROW)
})

// Second row tokens (overflow, up to 5 more)
const secondRowTokens = computed(() => {
  const overflow = totalPendingTokens.value - TOKENS_PER_ROW
  return Math.max(0, Math.min(overflow, TOKENS_PER_ROW))
})

// Show "..." indicator for very high counts (>10)
const showTokenOverflow = computed(() => {
  return totalPendingTokens.value > TOKENS_PER_ROW * 2
})

// ============================================
// AUTOMATION INDICATOR
// ============================================

// Automation processing state
const automationActive = computed(() => isAutomationProcessing())
const automationType = computed(() => getAutomationProcessingType())

// Flash state for completion effect
const showAutomationFlash = ref(false)

// Token collection celebration state
const isCollectingTokens = ref(false)
const tierUpCelebration = ref(false)
let unsubShipReward: (() => void) | null = null

// Gravity pull particle interval
let gravityParticleInterval: ReturnType<typeof setInterval> | null = null

// Ship button ref for position tracking
const shipButtonRef = ref<HTMLButtonElement | null>(null)

// Update ship button position for ghost hand hints
function updateShipButtonPosition() {
  if (!shipButtonRef.value) {
    setShipButtonPos(null)
    return
  }

  const rect = shipButtonRef.value.getBoundingClientRect()
  // Center of the button
  setShipButtonPos({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  })
}

// Watch for automation completion to trigger flash
// Uses onWatcherCleanup for automatic timeout cleanup
watch(automationActive, (active, wasActive) => {
  if (wasActive && !active) {
    // Just completed - show flash
    showAutomationFlash.value = true
    const timeout = setTimeout(() => {
      showAutomationFlash.value = false
    }, 300)
    // Auto-cleanup on next watch trigger or component unmount
    onWatcherCleanup(() => clearTimeout(timeout))
  }
})

// Update ship button position when gravity becomes ready
watch(
  gravityReady,
  (ready) => {
    if (ready) {
      // Delay slightly for button animation to complete
      setTimeout(updateShipButtonPosition, 350)
    } else {
      setShipButtonPos(null)
    }
  },
  { immediate: true }
)

// Gravity pull particles - request from visible packages when ship is ready
watch(
  showGravityPull,
  (active) => {
    if (active) {
      // Steady rate of ~2 particles/sec when ship is ready
      gravityParticleInterval = setInterval(() => {
        emit('gravity:pull-particle')
      }, 500)
    } else {
      if (gravityParticleInterval) {
        clearInterval(gravityParticleInterval)
        gravityParticleInterval = null
      }
    }
  },
  { immediate: true }
)

// ============================================
// TOOLTIP REFS AND HANDLERS
// ============================================

const rewardPreviewRef = ref<HTMLElement | null>(null)
const fragmentPreviewRef = ref<HTMLElement | null>(null)

// Tier tooltip types indexed by tier number (2-5)
const TIER_TOOLTIP_TYPES = {
  2: 'tier2',
  3: 'tier3',
  4: 'tier4',
  5: 'tier5',
} as const

function handleTierIconEnter(payload: {
  index: number
  tier: number
  el: HTMLElement
}) {
  const tooltipType =
    TIER_TOOLTIP_TYPES[payload.tier as keyof typeof TIER_TOOLTIP_TYPES]
  if (tooltipType) {
    setActiveTooltip(tooltipType, payload.el)
  }
}

function handleTierIconLeave() {
  setActiveTooltip(null)
}

function handleRewardEnter() {
  if (rewardPreviewRef.value) {
    setActiveTooltip('reward', rewardPreviewRef.value)
  }
}

function handleRewardLeave() {
  setActiveTooltip(null)
}

function handleFragmentEnter() {
  if (fragmentPreviewRef.value) {
    setActiveTooltip('fragment', fragmentPreviewRef.value)
  }
}

function handleFragmentLeave() {
  setActiveTooltip(null)
}

// ============================================
// HANDLERS
// ============================================

function handlePrestige() {
  if (computed_canPrestige.value) {
    triggerShipWithAnimation()
  }
}
</script>

<template>
  <div
    class="orbital-decay"
    :class="{
      ready: gravityReady,
      collecting: isCollectingTokens,
      'tier-up': tierUpCelebration,
      'gravity-pull': showGravityPull,
    }"
  >
    <!-- Ship button - appears when ready to ship -->
    <button
      ref="shipButtonRef"
      class="ship-button"
      :class="{ visible: gravityReady, pulsing: gravityReady }"
      :disabled="!gravityReady"
      @click="handlePrestige"
    >
      <svg class="ship-icon" viewBox="0 0 24 24">
        <!-- Box base -->
        <rect x="4" y="10" width="16" height="10" rx="2" class="box-base" />
        <!-- Box lid (open when ready) -->
        <path
          class="box-lid"
          :d="gravityReady ? 'M4 10 L12 4 L20 10' : 'M4 10 L12 8 L20 10'"
        />
        <!-- Upload arrow (visible when ready) -->
        <g class="upload-arrow" :class="{ visible: gravityReady }">
          <line x1="12" y1="14" x2="12" y2="6" />
          <polyline points="8,9 12,5 16,9" />
        </g>
      </svg>
    </button>

    <!-- Inner container for horizontal orbit + reward layout -->
    <div class="orbital-decay-inner">
      <!-- Orbiting weight icons -->
      <div
        class="orbit-container"
        :class="{ collapsed: gravityReady, 'has-tier-arcs': showCacheTokens }"
      >
        <div
          class="orbit-ring"
          :style="{
            '--orbit-radius': orbitRadius + 'px',
            '--orbit-speed': orbitSpeed + 's',
          }"
        >
          <!-- Always render all 6 orbiters to prevent animation reset -->
          <span
            v-for="i in MAX_ORBITERS"
            :key="i"
            v-memo="[i > visibleOrbiterCount]"
            class="orbiter"
            :class="{ hidden: i > visibleOrbiterCount }"
            :style="{ '--orbit-index': i }"
            >◆</span
          >
        </div>

        <!-- Tier progress arcs (outer rings) - reveals after first prestige -->
        <TierArcs
          v-if="showCacheTokens"
          :cache-tokens="gameState.meta.cacheTokens"
          :is-holding="isHoldingCollapse"
          :hold-progress="collapseHoldProgress"
          :automation-active="automationActive"
          :automation-type="automationType"
          :show-automation-flash="showAutomationFlash"
          @icon-enter="handleTierIconEnter"
          @icon-leave="handleTierIconLeave"
        />

        <!-- Quality arcs around singularity -->
        <svg
          v-if="showQualityIndicators"
          class="quality-arcs"
          viewBox="0 0 100 100"
        >
          <!-- Efficiency arc (inner, cyan) -->
          <circle class="arc-track" cx="50" cy="50" r="38" />
          <circle
            class="arc-fill efficiency-arc"
            :class="{ low: efficiencyValue < 0.5 }"
            cx="50"
            cy="50"
            r="38"
            :stroke-dasharray="`${efficiencyArcPercent * 2.39} 239`"
          />
          <!-- Stability arc (outer, green) -->
          <circle class="arc-track" cx="50" cy="50" r="46" />
          <circle
            class="arc-fill stability-arc"
            :class="{ low: stabilityValue < 0.7 }"
            cx="50"
            cy="50"
            r="46"
            :stroke-dasharray="`${stabilityArcPercent * 2.89} 289`"
          />
        </svg>

        <!-- Central npm mass (holdable at Tier 5 for collapse) -->
        <NpmMass
          :tier="ecosystemTier"
          :ready="gravityReady"
          :holdable="collapseReady"
          :holding="isHoldingCollapse"
          :hold-progress="collapseHoldProgress"
          :locked="collapseHoldLocked"
          :cancelled="collapseCancelled"
          @hold-start="onMassHoldStart"
        />
      </div>

      <!-- Unified token reward preview (base + fragment bonus combined) -->
      <div
        ref="rewardPreviewRef"
        class="reward-preview tooltip-trigger"
        :class="[
          rewardQuality,
          { visible: gravityReady && totalPendingTokens > 0 },
        ]"
        @mouseenter="handleRewardEnter"
        @mouseleave="handleRewardLeave"
      >
        <!-- First row of tokens -->
        <div class="token-row">
          <span
            v-for="i in firstRowTokens"
            :key="'t1-' + i"
            class="reward-token"
            :class="rewardQuality"
            >⟲</span
          >
        </div>
        <!-- Second row (overflow) -->
        <div v-if="secondRowTokens > 0" class="token-row">
          <span
            v-for="i in secondRowTokens"
            :key="'t2-' + i"
            class="reward-token"
            :class="rewardQuality"
            >⟲</span
          >
        </div>
        <!-- Overflow indicator for very high counts -->
        <span v-if="showTokenOverflow" class="token-overflow">···</span>
      </div>

      <!-- Fragment progress indicator (5 discrete stars) -->
      <div
        ref="fragmentPreviewRef"
        class="fragment-preview tooltip-trigger"
        :class="{ visible: hasFragments }"
        @mouseenter="handleFragmentEnter"
        @mouseleave="handleFragmentLeave"
      >
        <!-- 5 fragment stars showing progress toward next token -->
        <span
          v-for="i in 5"
          :key="'frag-' + i"
          class="fragment-star"
          :class="{ filled: i <= filledFragmentStars }"
          >✦</span
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Orbital Decay - Prestige Visualization */
.orbital-decay {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  padding: 12px 16px;
  background: rgba(30, 20, 50, 0.6);
  border-radius: 12px;
  border: 1px solid rgba(122, 90, 255, 0.2);
  pointer-events: auto;
  overflow: visible;
}

.orbital-decay-inner {
  display: flex;
  align-items: center;
  gap: 12px;
  overflow: visible;
}

.orbital-decay.ready {
  border-color: rgba(122, 90, 255, 0.6);
  box-shadow: 0 0 20px rgba(122, 90, 255, 0.3);
}

/* Token collection celebration */
.orbital-decay.collecting {
  animation: collect-pulse 0.3s ease-out;
}

.orbital-decay.collecting::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 16px;
  border: 2px solid rgba(90, 255, 255, 0.8);
  animation: collect-ring 0.8s ease-out forwards;
  pointer-events: none;
}

@keyframes collect-pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 30px rgba(90, 255, 255, 0.6);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes collect-ring {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.3);
  }
}

/* Tier up celebration */
.orbital-decay.tier-up {
  animation: tier-up-flash 0.5s ease-out;
}

.orbital-decay.tier-up::before {
  content: '★';
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 24px;
  color: #ffff5a;
  text-shadow:
    0 0 16px rgba(255, 255, 90, 1),
    0 0 32px rgba(255, 200, 90, 0.8);
  animation: tier-up-star 1.5s ease-out forwards;
  pointer-events: none;
  z-index: 10;
}

@keyframes tier-up-flash {
  0% {
    box-shadow: 0 0 20px rgba(122, 90, 255, 0.3);
  }
  30% {
    box-shadow:
      0 0 40px rgba(255, 255, 90, 0.8),
      0 0 60px rgba(255, 200, 90, 0.5);
  }
  100% {
    box-shadow: 0 0 20px rgba(122, 90, 255, 0.3);
  }
}

@keyframes tier-up-star {
  0% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
  50% {
    opacity: 1;
    transform: translateX(-50%) translateY(-10px) scale(1.5);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-30px) scale(0.8);
  }
}

/* Gravity pull effect for experienced players when ship ready */
.orbital-decay.gravity-pull {
  animation: gravity-pull-glow 2s ease-in-out infinite;
}

.orbital-decay.gravity-pull::before {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 16px;
  background: radial-gradient(
    ellipse at center,
    rgba(167, 139, 250, 0.15) 0%,
    transparent 70%
  );
  animation: gravity-pull-pulse 1.5s ease-in-out infinite;
  pointer-events: none;
  z-index: -1;
}

@keyframes gravity-pull-glow {
  0%,
  100% {
    box-shadow:
      0 0 20px rgba(122, 90, 255, 0.3),
      inset 0 0 20px rgba(122, 90, 255, 0.05);
  }
  50% {
    box-shadow:
      0 0 35px rgba(122, 90, 255, 0.5),
      inset 0 0 30px rgba(122, 90, 255, 0.1);
  }
}

@keyframes gravity-pull-pulse {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

/* ============================================
   SHIP BUTTON
   ============================================ */
.ship-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 0;
  padding: 0;
  margin-bottom: 0;
  overflow: hidden;
  background: rgba(40, 30, 60, 0.6);
  border: 2px solid rgba(90, 70, 140, 0.3);
  border-radius: 8px;
  cursor: not-allowed;
  opacity: 0;
  transform: translateY(-8px);
  transition:
    opacity 0.3s ease,
    transform 0.3s ease,
    height 0.3s ease,
    margin 0.3s ease,
    padding 0.3s ease,
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  pointer-events: none;
}

.ship-button.visible {
  height: 40px;
  margin-bottom: 8px;
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
  cursor: pointer;
  background: rgba(60, 40, 100, 0.8);
  border-color: rgba(122, 90, 255, 0.6);
}

.ship-button.visible:hover {
  background: rgba(80, 50, 130, 0.9);
  border-color: rgba(122, 90, 255, 0.9);
  box-shadow: 0 0 16px rgba(122, 90, 255, 0.4);
}

.ship-button.visible:active {
  transform: scale(0.96);
}

.ship-button.pulsing {
  animation: ship-button-pulse 1.5s ease-in-out infinite;
}

@keyframes ship-button-pulse {
  0%,
  100% {
    box-shadow: 0 0 8px rgba(122, 90, 255, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(122, 90, 255, 0.6);
  }
}

.ship-icon {
  width: 28px;
  height: 28px;
  fill: none;
  stroke: rgba(180, 160, 220, 0.5);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition:
    stroke 0.3s ease,
    filter 0.3s ease;
}

.ship-button.visible .ship-icon {
  stroke: #c0a0ff;
  filter: drop-shadow(0 0 4px rgba(180, 140, 255, 0.5));
}

.ship-button.visible:hover .ship-icon {
  stroke: #e0c0ff;
  filter: drop-shadow(0 0 8px rgba(200, 160, 255, 0.8));
}

.ship-icon .box-base {
  fill: rgba(90, 70, 140, 0.3);
  stroke: inherit;
}

.ship-button.visible .ship-icon .box-base {
  fill: rgba(122, 90, 255, 0.2);
}

.ship-icon .box-lid {
  fill: none;
  stroke: inherit;
  transition: d 0.3s ease;
}

.ship-icon .upload-arrow {
  opacity: 0;
  transform: translateY(4px);
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.ship-icon .upload-arrow.visible {
  opacity: 1;
  transform: translateY(0);
}

.ship-button.visible .ship-icon .upload-arrow {
  animation: arrow-float 1s ease-in-out infinite;
}

@keyframes arrow-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
}

.orbit-container {
  position: relative;
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

/* Larger orbit container when tier arcs are visible */
.orbit-container.has-tier-arcs {
  width: 200px;
  height: 200px;
}

.orbit-ring {
  position: absolute;
  width: calc(var(--orbit-radius) * 2);
  height: calc(var(--orbit-radius) * 2);
  animation: orbit-spin var(--orbit-speed) linear infinite;
  z-index: 10;
}

.orbiter {
  position: absolute;
  font-size: 14px;
  color: #7a5aff;
  text-shadow: 0 0 8px rgba(122, 90, 255, 0.8);
  /* Distribute orbiters evenly around the circle */
  --angle: calc(360deg / 6 * var(--orbit-index));
  left: 50%;
  top: 50%;
  transform: rotate(var(--angle)) translateX(var(--orbit-radius))
    rotate(calc(-1 * var(--angle)));
  transition: opacity 0.3s ease;
}

.orbiter.hidden {
  opacity: 0;
  pointer-events: none;
}

@keyframes orbit-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* ============================================
   QUALITY ARCS
   ============================================ */
.quality-arcs {
  position: absolute;
  width: 100px;
  height: 100px;
  transform: rotate(-90deg); /* Start arcs from top */
  pointer-events: none;
}

.arc-track {
  fill: none;
  stroke: rgba(60, 60, 80, 0.4);
  stroke-width: 3;
}

.arc-fill {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  transition:
    stroke-dasharray 0.5s ease-out,
    stroke 0.3s ease;
}

/* Efficiency arc - cyan/blue */
.efficiency-arc {
  stroke: #5affff;
  filter: drop-shadow(0 0 4px rgba(90, 255, 255, 0.6));
}

.efficiency-arc.low {
  stroke: #ffaa5a;
  filter: drop-shadow(0 0 4px rgba(255, 170, 90, 0.6));
  animation: arc-warn-pulse 1s ease-in-out infinite;
}

/* Stability arc - green */
.stability-arc {
  stroke: #5aff8a;
  filter: drop-shadow(0 0 4px rgba(90, 255, 138, 0.6));
}

.stability-arc.low {
  stroke: #ff8a5a;
  filter: drop-shadow(0 0 4px rgba(255, 138, 90, 0.6));
}

@keyframes arc-warn-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

/* ============================================
   REWARD TOKEN PREVIEW (Unified)
   ============================================ */
.reward-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  opacity: 0.3;
  transition: opacity 0.3s ease;
}

.reward-preview.visible {
  opacity: 1;
}

.reward-preview.tooltip-trigger {
  cursor: help;
}

.token-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
}

.reward-token {
  font-size: 16px;
  color: #5affff;
  text-shadow: 0 0 6px rgba(90, 255, 255, 0.6);
  animation: reward-float 1s ease-in-out infinite alternate;
  transition: all 0.3s ease;
  line-height: 1;
}

/* Excellent quality - bright glow */
.reward-token.excellent {
  color: #5affff;
  text-shadow:
    0 0 8px rgba(90, 255, 255, 0.8),
    0 0 16px rgba(90, 255, 255, 0.4);
  animation:
    reward-float 1s ease-in-out infinite alternate,
    reward-glow 2s ease-in-out infinite;
}

/* Good quality - normal */
.reward-token.good {
  color: #5affff;
  text-shadow: 0 0 6px rgba(90, 255, 255, 0.6);
}

/* Poor quality - faded */
.reward-token.poor {
  color: rgba(90, 255, 255, 0.5);
  text-shadow: 0 0 3px rgba(90, 255, 255, 0.3);
}

/* Terrible quality - very faded, shaky */
.reward-token.terrible {
  color: rgba(255, 170, 90, 0.4);
  text-shadow: none;
  animation: reward-shake 0.1s linear infinite;
}

/* Staggered animation delays */
.token-row:first-child .reward-token:nth-child(2) {
  animation-delay: 0.1s;
}
.token-row:first-child .reward-token:nth-child(3) {
  animation-delay: 0.2s;
}
.token-row:first-child .reward-token:nth-child(4) {
  animation-delay: 0.3s;
}
.token-row:first-child .reward-token:nth-child(5) {
  animation-delay: 0.4s;
}
.token-row:nth-child(2) .reward-token:nth-child(1) {
  animation-delay: 0.5s;
}
.token-row:nth-child(2) .reward-token:nth-child(2) {
  animation-delay: 0.6s;
}
.token-row:nth-child(2) .reward-token:nth-child(3) {
  animation-delay: 0.7s;
}
.token-row:nth-child(2) .reward-token:nth-child(4) {
  animation-delay: 0.8s;
}
.token-row:nth-child(2) .reward-token:nth-child(5) {
  animation-delay: 0.9s;
}

.token-overflow {
  font-size: 12px;
  color: rgba(90, 255, 255, 0.5);
  line-height: 1;
  letter-spacing: 2px;
}

@keyframes reward-float {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-2px);
  }
}

@keyframes reward-glow {
  0%,
  100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.3);
  }
}

@keyframes reward-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-1px);
  }
  75% {
    transform: translateX(1px);
  }
}

/* ============================================
   FRAGMENT PROGRESS (5 Stars)
   ============================================ */
.fragment-preview {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  opacity: 0;
  transition: opacity 0.3s ease;
  padding-left: 6px;
  border-left: 1px solid rgba(255, 200, 90, 0.2);
  margin-left: 6px;
}

.fragment-preview.visible {
  opacity: 1;
}

.fragment-preview.tooltip-trigger {
  cursor: help;
}

.fragment-star {
  font-size: 11px;
  line-height: 1;
  transition: all 0.3s ease;
  color: rgba(255, 200, 90, 0.15);
  text-shadow: none;
}

.fragment-star.filled {
  color: #ffc85a;
  text-shadow: 0 0 6px rgba(255, 200, 90, 0.6);
  animation: fragment-glow 2s ease-in-out infinite;
}

/* Staggered glow animation */
.fragment-star:nth-child(2) {
  animation-delay: 0.2s;
}
.fragment-star:nth-child(3) {
  animation-delay: 0.4s;
}
.fragment-star:nth-child(4) {
  animation-delay: 0.6s;
}
.fragment-star:nth-child(5) {
  animation-delay: 0.8s;
}

@keyframes fragment-glow {
  0%,
  100% {
    filter: brightness(1);
    text-shadow: 0 0 6px rgba(255, 200, 90, 0.6);
  }
  50% {
    filter: brightness(1.2);
    text-shadow: 0 0 10px rgba(255, 200, 90, 0.9);
  }
}
</style>
