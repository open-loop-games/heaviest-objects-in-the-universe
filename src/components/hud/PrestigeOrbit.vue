<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import {
  gameState,
  computed_gravity,
  computed_prestigeReward,
  computed_canPrestige,
} from '../../game/state'
import { triggerPrestigeWithAnimation } from '../../game/mutations'
import { calculateStabilityRatio } from '../../game/formulas'
import {
  isAutomationProcessing,
  getAutomationProcessingType,
} from '../../game/automation'
import { TIER_THRESHOLDS } from '../../game/config'

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

// Show quality indicators after first conflict or symlink opportunity
const showQualityIndicators = computed(() => {
  return (
    gameState.onboarding.firstConflictSeen ||
    gameState.stats.totalSymlinksCreated > 0 ||
    gameState.packages.size >= 10
  )
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
// TIER PROGRESS ARCS
// ============================================

// Calculate progress within each tier segment (0-1)
const tierArcProgress = computed(() => {
  const tokens = gameState.meta.cacheTokens

  return [
    // Tier 2: 0 → 9 tokens
    {
      tier: 2,
      icon: '⚙',
      start: 0,
      end: TIER_THRESHOLDS[1],
      progress: Math.min(1, tokens / TIER_THRESHOLDS[1]),
      complete: tokens >= TIER_THRESHOLDS[1],
    },
    // Tier 3: 9 → 21 tokens
    {
      tier: 3,
      icon: '⟲',
      start: TIER_THRESHOLDS[1],
      end: TIER_THRESHOLDS[2],
      progress:
        tokens >= TIER_THRESHOLDS[1]
          ? Math.min(
              1,
              (tokens - TIER_THRESHOLDS[1]) /
                (TIER_THRESHOLDS[2] - TIER_THRESHOLDS[1])
            )
          : 0,
      complete: tokens >= TIER_THRESHOLDS[2],
    },
    // Tier 4: 21 → 42 tokens
    {
      tier: 4,
      icon: '⚡',
      start: TIER_THRESHOLDS[2],
      end: TIER_THRESHOLDS[3],
      progress:
        tokens >= TIER_THRESHOLDS[2]
          ? Math.min(
              1,
              (tokens - TIER_THRESHOLDS[2]) /
                (TIER_THRESHOLDS[3] - TIER_THRESHOLDS[2])
            )
          : 0,
      complete: tokens >= TIER_THRESHOLDS[3],
    },
    // Tier 5: 42 → 63 tokens
    {
      tier: 5,
      icon: '★',
      start: TIER_THRESHOLDS[3],
      end: TIER_THRESHOLDS[4],
      progress:
        tokens >= TIER_THRESHOLDS[3]
          ? Math.min(
              1,
              (tokens - TIER_THRESHOLDS[3]) /
                (TIER_THRESHOLDS[4] - TIER_THRESHOLDS[3])
            )
          : 0,
      complete: tokens >= TIER_THRESHOLDS[4],
    },
  ]
})

// SVG arc calculations for tier rings
const tierArcPaths = computed(() => {
  const radii = [70, 78, 86, 94] as const

  return tierArcProgress.value.map((tier, i) => {
    const r = radii[i] ?? 70 // Fallback to first radius
    const circumference = 2 * Math.PI * r
    // Each arc is a quarter (90 degrees = 25% of circumference)
    const arcLength = circumference * 0.25
    const filledLength = arcLength * tier.progress

    // Starting rotation for each quadrant (in degrees from top)
    const startAngle = i * 90 - 90 // Start from top

    return {
      ...tier,
      r,
      circumference,
      arcLength,
      dashArray: `${filledLength} ${circumference}`,
      trackDashArray: `${arcLength} ${circumference}`,
      rotation: startAngle,
    }
  })
})

// ============================================
// AUTOMATION INDICATOR
// ============================================

// Automation processing state
const automationActive = computed(() => isAutomationProcessing())
const automationType = computed(() => getAutomationProcessingType())

// Flash state for completion effect
const showAutomationFlash = ref(false)
let automationFlashTimeout: ReturnType<typeof setTimeout> | null = null

// Watch for automation completion to trigger flash
watch(automationActive, (active, wasActive) => {
  if (wasActive && !active) {
    // Just completed - show flash
    showAutomationFlash.value = true
    if (automationFlashTimeout) clearTimeout(automationFlashTimeout)
    automationFlashTimeout = setTimeout(() => {
      showAutomationFlash.value = false
    }, 300)
  }
})

// ============================================
// HANDLERS
// ============================================

function handlePrestige() {
  if (computed_canPrestige.value) {
    triggerPrestigeWithAnimation()
  }
}

// Cleanup on unmount
onUnmounted(() => {
  if (automationFlashTimeout) clearTimeout(automationFlashTimeout)
})
</script>

<template>
  <div class="orbital-decay" :class="{ ready: gravityReady }">
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
        <svg v-if="showCacheTokens" class="tier-arcs" viewBox="0 0 200 200">
          <!-- Tier arc tracks and fills (4 quarter-circle arcs) -->
          <g
            v-for="arc in tierArcPaths"
            :key="arc.tier"
            v-memo="[arc.progress, arc.complete, arc.dashArray]"
            class="tier-arc-group"
            :class="{
              complete: arc.complete,
              active: arc.progress > 0 && !arc.complete,
            }"
            :style="{ '--arc-rotation': arc.rotation + 'deg' }"
          >
            <!-- Track (unfilled) -->
            <circle
              class="tier-arc-track"
              cx="100"
              cy="100"
              :r="arc.r"
              :stroke-dasharray="arc.trackDashArray"
            />
            <!-- Fill (progress) -->
            <circle
              class="tier-arc-fill"
              :class="'tier-' + arc.tier"
              cx="100"
              cy="100"
              :r="arc.r"
              :stroke-dasharray="arc.dashArray"
            />
          </g>
        </svg>

        <!-- Tier unlock icons (positioned at arc endpoints) -->
        <div v-if="showCacheTokens" class="tier-unlock-icons">
          <span
            v-for="arc in tierArcProgress"
            :key="'icon-' + arc.tier"
            class="tier-unlock-icon"
            :class="{
              complete: arc.complete,
              active: arc.progress > 0 && !arc.complete,
              ['tier-' + arc.tier]: true,
              'auto-active':
                arc.tier === 2 &&
                automationActive &&
                automationType === 'resolve',
              'auto-flash':
                arc.tier === 2 &&
                showAutomationFlash &&
                automationType === 'resolve',
            }"
            >{{ arc.icon }}</span
          >
        </div>

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

        <!-- Central singularity -->
        <button
          class="singularity"
          :class="{ active: gravityReady, pulsing: gravityPercent > 70 }"
          :disabled="!gravityReady"
          @click="handlePrestige"
        >
          <span class="singularity-core">●</span>
          <span class="event-horizon" v-if="gravityReady"></span>
        </button>
      </div>

      <!-- Cache token reward preview (quality styling) -->
      <div
        class="reward-preview"
        :class="[
          rewardQuality,
          { visible: gravityReady && computed_prestigeReward > 0 },
        ]"
      >
        <span
          v-for="i in Math.min(prestigeRewardDots, 5)"
          :key="i"
          class="reward-token"
          :class="rewardQuality"
          >⟲</span
        >
        <!-- Empty slots to show potential -->
        <span
          v-for="i in Math.max(0, 5 - prestigeRewardDots)"
          :key="'empty-' + i"
          class="reward-token empty"
          >⟲</span
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
}

.orbital-decay-inner {
  display: flex;
  align-items: center;
  gap: 12px;
}

.orbital-decay.ready {
  border-color: rgba(122, 90, 255, 0.6);
  box-shadow: 0 0 20px rgba(122, 90, 255, 0.3);
}

.orbit-container {
  position: relative;
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
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

.orbit-container.collapsed .orbiter {
  animation: collapse-in 0.5s ease-in forwards;
}

@keyframes orbit-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes collapse-in {
  to {
    transform: rotate(var(--angle)) translateX(0)
      rotate(calc(-1 * var(--angle)));
    opacity: 0;
  }
}

/* Central singularity (black hole / prestige button) */
.singularity {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: radial-gradient(circle, #1a1a2e 0%, #0a0a15 70%);
  border: 2px solid #3a3a5a;
  cursor: not-allowed;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.singularity-core {
  font-size: 18px;
  color: #5a5a7a;
  transition: all 0.3s;
}

.singularity.pulsing {
  animation: singularity-pulse 0.8s ease-in-out infinite;
}

.singularity.pulsing .singularity-core {
  color: #ff7a5a;
}

.singularity.active {
  cursor: pointer;
  border-color: #7a5aff;
  box-shadow:
    0 0 20px rgba(122, 90, 255, 0.6),
    inset 0 0 15px rgba(122, 90, 255, 0.3);
}

.singularity.active .singularity-core {
  color: #fff;
  text-shadow: 0 0 10px #fff;
}

.singularity.active:hover {
  transform: scale(1.1);
  box-shadow:
    0 0 30px rgba(122, 90, 255, 0.8),
    inset 0 0 20px rgba(122, 90, 255, 0.5);
}

/* Event horizon ring effect when ready */
.event-horizon {
  position: absolute;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 2px solid rgba(122, 90, 255, 0.6);
  animation: event-horizon-pulse 1.5s ease-out infinite;
}

@keyframes singularity-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

@keyframes event-horizon-pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(2);
    opacity: 0;
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
   TIER PROGRESS ARCS
   ============================================ */

.tier-arcs {
  position: absolute;
  width: 200px;
  height: 200px;
  pointer-events: none;
}

.tier-arc-group {
  transform-origin: 100px 100px;
  transform: rotate(var(--arc-rotation, 0deg));
}

.tier-arc-track {
  fill: none;
  stroke: rgba(60, 60, 80, 0.25);
  stroke-width: 4;
  stroke-linecap: round;
}

.tier-arc-fill {
  fill: none;
  stroke-width: 4;
  stroke-linecap: round;
  transition: stroke-dasharray 0.4s ease-out;
  transform-origin: 100px 100px;
  transform: rotate(-90deg); /* Start from top of quadrant */
}

/* Tier-specific colors */
.tier-arc-fill.tier-2 {
  stroke: rgba(90, 170, 255, 0.6);
}

.tier-arc-fill.tier-3 {
  stroke: rgba(90, 255, 200, 0.6);
}

.tier-arc-fill.tier-4 {
  stroke: rgba(255, 200, 90, 0.6);
}

.tier-arc-fill.tier-5 {
  stroke: rgba(255, 140, 200, 0.6);
}

/* Complete tier arcs glow */
.tier-arc-group.complete .tier-arc-fill.tier-2 {
  stroke: #5aaaff;
  filter: drop-shadow(0 0 4px rgba(90, 170, 255, 0.8));
}

.tier-arc-group.complete .tier-arc-fill.tier-3 {
  stroke: #5affc8;
  filter: drop-shadow(0 0 4px rgba(90, 255, 200, 0.8));
}

.tier-arc-group.complete .tier-arc-fill.tier-4 {
  stroke: #ffc85a;
  filter: drop-shadow(0 0 4px rgba(255, 200, 90, 0.8));
}

.tier-arc-group.complete .tier-arc-fill.tier-5 {
  stroke: #ff8cc8;
  filter: drop-shadow(0 0 4px rgba(255, 140, 200, 0.8));
}

/* Active (in-progress) tier arcs pulse gently */
.tier-arc-group.active .tier-arc-fill {
  animation: tier-arc-pulse 2s ease-in-out infinite;
}

@keyframes tier-arc-pulse {
  0%,
  100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

/* Tier unlock icons container */
.tier-unlock-icons {
  position: absolute;
  width: 200px;
  height: 200px;
  pointer-events: none;
}

/* Individual tier unlock icons */
.tier-unlock-icon {
  position: absolute;
  font-size: 14px;
  transition: all 0.3s ease;
  opacity: 0.25;
  color: #6a6a8a;
}

/* Position icons at the end of each arc quadrant */
.tier-unlock-icon.tier-2 {
  top: 50%;
  right: -8px;
  transform: translateY(-50%);
}

.tier-unlock-icon.tier-3 {
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
}

.tier-unlock-icon.tier-4 {
  top: 50%;
  left: -8px;
  transform: translateY(-50%);
}

.tier-unlock-icon.tier-5 {
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
}

/* Active icons (in progress) */
.tier-unlock-icon.active {
  opacity: 0.6;
  animation: tier-icon-pulse 2s ease-in-out infinite;
}

.tier-unlock-icon.active.tier-2 {
  color: #5aaaff;
}
.tier-unlock-icon.active.tier-3 {
  color: #5affc8;
}
.tier-unlock-icon.active.tier-4 {
  color: #ffc85a;
}
.tier-unlock-icon.active.tier-5 {
  color: #ff8cc8;
}

/* Complete icons - bright with glow */
.tier-unlock-icon.complete {
  opacity: 1;
  font-size: 16px;
}

.tier-unlock-icon.complete.tier-2 {
  color: #5aaaff;
  text-shadow: 0 0 8px rgba(90, 170, 255, 0.8);
}

.tier-unlock-icon.complete.tier-3 {
  color: #5affc8;
  text-shadow: 0 0 8px rgba(90, 255, 200, 0.8);
}

.tier-unlock-icon.complete.tier-4 {
  color: #ffc85a;
  text-shadow: 0 0 8px rgba(255, 200, 90, 0.8);
}

.tier-unlock-icon.complete.tier-5 {
  color: #ff8cc8;
  text-shadow: 0 0 8px rgba(255, 140, 200, 0.8);
  animation: tier-5-complete 1.5s ease-in-out infinite;
}

@keyframes tier-icon-pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 0.8;
  }
}

@keyframes tier-5-complete {
  0%,
  100% {
    transform: translateX(-50%) scale(1);
    text-shadow: 0 0 8px rgba(255, 140, 200, 0.8);
  }
  50% {
    transform: translateX(-50%) scale(1.2);
    text-shadow: 0 0 16px rgba(255, 140, 200, 1);
  }
}

/* Automation active states for tier icons */
.tier-unlock-icon.auto-active.tier-2 {
  color: #5aff8a !important;
  text-shadow: 0 0 12px rgba(90, 255, 138, 1) !important;
  animation: tier-auto-spin-right 0.6s linear infinite;
}

.tier-unlock-icon.auto-active.tier-3 {
  color: #5affff !important;
  text-shadow: 0 0 12px rgba(90, 255, 255, 1) !important;
  animation: tier-auto-spin-bottom 0.6s linear infinite;
}

.tier-unlock-icon.auto-flash {
  animation: tier-auto-flash 0.3s ease-out;
}

@keyframes tier-auto-spin-right {
  from {
    transform: translateY(-50%) rotate(0deg);
  }
  to {
    transform: translateY(-50%) rotate(360deg);
  }
}

@keyframes tier-auto-spin-bottom {
  from {
    transform: translateX(-50%) rotate(0deg);
  }
  to {
    transform: translateX(-50%) rotate(360deg);
  }
}

@keyframes tier-auto-flash {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.5);
    filter: brightness(2);
  }
  100% {
    transform: scale(1);
  }
}

/* ============================================
   REWARD TOKEN QUALITY
   ============================================ */
.reward-preview {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  opacity: 0.3;
  transition: opacity 0.3s ease;
}

.reward-preview.visible {
  opacity: 1;
}

.reward-token {
  font-size: 12px;
  color: #5affff;
  text-shadow: 0 0 6px rgba(90, 255, 255, 0.6);
  animation: reward-float 1s ease-in-out infinite alternate;
  transition: all 0.3s ease;
  line-height: 1;
}

/* Empty token slots (potential rewards) */
.reward-token.empty {
  color: rgba(90, 255, 255, 0.15);
  text-shadow: none;
  animation: none;
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

.reward-token:nth-child(2) {
  animation-delay: 0.1s;
}
.reward-token:nth-child(3) {
  animation-delay: 0.2s;
}
.reward-token:nth-child(4) {
  animation-delay: 0.3s;
}
.reward-token:nth-child(5) {
  animation-delay: 0.4s;
}

@keyframes reward-float {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-3px);
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
</style>
