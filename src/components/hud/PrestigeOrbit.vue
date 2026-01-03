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
import { TIER_THRESHOLDS, FRAGMENT_TO_TOKEN_RATIO } from '../../game/config'
import { on, emit } from '../../game/events'

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

// Mass visual state based on tier
const massState = computed(() => {
  const tier = ecosystemTier.value
  if (tier >= 5) return 'critical' // Unstable, ready for collapse
  if (tier >= 4) return 'warping' // Gravity distortion
  if (tier >= 3) return 'forming' // Dark core forming
  if (tier >= 2) return 'breathing' // Gentle pulse
  return 'dormant' // Static, inert
})

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

// Fractional progress toward next token (0-1)
const fragmentProgress = computed(() => {
  const fragments = gameState.resources.cacheFragments
  return (fragments % FRAGMENT_TO_TOKEN_RATIO) / FRAGMENT_TO_TOKEN_RATIO
})

// Whether to show fragment indicator (has any fragments)
const hasFragments = computed(() => gameState.resources.cacheFragments > 0)

// ============================================
// TIER PROGRESS ARCS
// ============================================

// Static tier metadata (never changes) - defined once at module level
const TIER_ARC_META = [
  { tier: 2, icon: '⚙', start: 0, end: TIER_THRESHOLDS[1] },
  { tier: 3, icon: '⟲', start: TIER_THRESHOLDS[1], end: TIER_THRESHOLDS[2] },
  { tier: 4, icon: '⚡', start: TIER_THRESHOLDS[2], end: TIER_THRESHOLDS[3] },
  { tier: 5, icon: '★', start: TIER_THRESHOLDS[3], end: TIER_THRESHOLDS[4] },
] as const

// Calculate progress within each tier segment (0-1)
// PERF: Reuses static metadata, only computes dynamic progress/complete
const tierArcProgress = computed(() => {
  const tokens = gameState.meta.cacheTokens

  return TIER_ARC_META.map((meta) => {
    const range = meta.end - meta.start
    const progress =
      tokens >= meta.start ? Math.min(1, (tokens - meta.start) / range) : 0
    return {
      ...meta,
      progress,
      complete: tokens >= meta.end,
    }
  })
})

// SVG arc calculations for tier rings
// During collapse hold, tiers drain in reverse order (5→4→3→2→1)
const tierArcPaths = computed(() => {
  const radii = [70, 78, 86, 94] as const
  const holdProgress = isHoldingCollapse.value ? collapseHoldProgress.value : 0

  return tierArcProgress.value.map((tier, i) => {
    const r = radii[i] ?? 70 // Fallback to first radius
    const circumference = 2 * Math.PI * r
    // Each arc is a quarter (90 degrees = 25% of circumference)
    const arcLength = circumference * 0.25

    // During hold, drain tiers in reverse order (tier 5 first, tier 2 last)
    // Each tier drains over 20% of the hold progress
    // Tier 5 (i=3): drains at 0-20%, Tier 4 (i=2): 20-40%, etc.
    let effectiveProgress = tier.progress
    if (holdProgress > 0 && tier.complete) {
      const reversedIndex = 3 - i // 3,2,1,0 for tiers 5,4,3,2
      const drainStart = reversedIndex * 0.2 // 0%, 20%, 40%, 60%
      const drainEnd = drainStart + 0.25 // 25%, 45%, 65%, 85%

      if (holdProgress >= drainEnd) {
        effectiveProgress = 0 // Fully drained
      } else if (holdProgress > drainStart) {
        // Partially drained
        const drainAmount =
          (holdProgress - drainStart) / (drainEnd - drainStart)
        effectiveProgress = tier.progress * (1 - drainAmount)
      }
    }

    const filledLength = arcLength * effectiveProgress

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
      draining: holdProgress > 0 && effectiveProgress < tier.progress,
    }
  })
})

// ============================================
// TIER DRAIN HELPERS (for collapse hold)
// ============================================

// Check if a tier (by index 0-3) is currently draining
function isTierDraining(index: number): boolean {
  if (!isHoldingCollapse.value) return false
  const holdProgress = collapseHoldProgress.value
  const reversedIndex = 3 - index // 3,2,1,0 for tiers 5,4,3,2
  const drainStart = reversedIndex * 0.2
  const drainEnd = drainStart + 0.25
  return holdProgress > drainStart && holdProgress < drainEnd
}

// Check if a tier (by index 0-3) has been fully drained
function isTierDrained(index: number): boolean {
  if (!isHoldingCollapse.value) return false
  const holdProgress = collapseHoldProgress.value
  const reversedIndex = 3 - index
  const drainEnd = reversedIndex * 0.2 + 0.25
  return holdProgress >= drainEnd
}

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
        <svg v-if="showCacheTokens" class="tier-arcs" viewBox="0 0 200 200">
          <!-- Tier arc tracks and fills (4 quarter-circle arcs) -->
          <g
            v-for="arc in tierArcPaths"
            :key="arc.tier"
            v-memo="[arc.progress, arc.complete, arc.dashArray, arc.draining]"
            class="tier-arc-group"
            :class="{
              complete: arc.complete && !arc.draining,
              active: arc.progress > 0 && !arc.complete,
              draining: arc.draining,
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
            v-for="(arc, i) in tierArcProgress"
            :key="'icon-' + arc.tier"
            class="tier-unlock-icon"
            :class="{
              complete: arc.complete && !isTierDraining(i),
              active: arc.progress > 0 && !arc.complete,
              draining: isTierDraining(i),
              drained: isTierDrained(i),
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

        <!-- Central npm mass (holdable at Tier 5 for collapse) -->
        <div
          class="npm-mass"
          :class="[
            massState,
            {
              ready: gravityReady,
              holdable: collapseReady,
              holding: isHoldingCollapse,
              locked: collapseHoldLocked,
              cancelled: collapseCancelled,
            },
          ]"
          :style="
            isHoldingCollapse ? { '--hold-progress': collapseHoldProgress } : {}
          "
          @mousedown="onMassHoldStart"
          @touchstart="onMassHoldStart"
        >
          <!-- Outer glow layers (tier 3+) -->
          <div v-if="ecosystemTier >= 3" class="mass-glow outer"></div>
          <div v-if="ecosystemTier >= 4" class="mass-glow inner"></div>

          <!-- Gravity warp rings (tier 4+) -->
          <svg v-if="ecosystemTier >= 4" class="warp-rings" viewBox="0 0 80 80">
            <circle class="warp-ring" cx="40" cy="40" r="32" />
            <circle class="warp-ring delayed" cx="40" cy="40" r="36" />
          </svg>

          <!-- npm hexagon shape -->
          <svg class="mass-shape" viewBox="0 0 40 40">
            <!-- Hexagon path -->
            <polygon
              class="mass-hex"
              points="20,2 36,11 36,29 20,38 4,29 4,11"
            />
            <!-- Inner dark core (tier 3+) -->
            <polygon
              v-if="ecosystemTier >= 3"
              class="mass-core"
              points="20,8 30,14 30,26 20,32 10,26 10,14"
            />
            <!-- npm-style notch/chunk (the signature npm look) -->
            <rect class="mass-notch" x="14" y="16" width="6" height="12" />
          </svg>

          <!-- Crackling effects (tier 5) -->
          <div v-if="ecosystemTier >= 5" class="mass-crackle">
            <span class="crack c1"></span>
            <span class="crack c2"></span>
            <span class="crack c3"></span>
          </div>
        </div>
      </div>

      <!-- Cache token reward preview (quality styling) -->
      <div
        class="reward-preview"
        :class="[
          rewardQuality,
          { visible: gravityReady && computed_prestigeReward > 0 },
        ]"
      >
        <!-- Base reward tokens -->
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

      <!-- Fragment bonus indicator (sliced icon) -->
      <div class="fragment-preview" :class="{ visible: hasFragments }">
        <!-- Full bonus tokens from fragments -->
        <span
          v-for="i in Math.min(fragmentBonusTokens, 3)"
          :key="'bonus-' + i"
          class="fragment-token filled"
          >✦</span
        >
        <!-- Partial fragment (sliced icon) -->
        <div v-if="fragmentProgress > 0" class="fragment-partial">
          <span class="fragment-token empty">✦</span>
          <span
            class="fragment-token filled slice"
            :style="{ '--fill-percent': fragmentProgress * 100 + '%' }"
            >✦</span
          >
        </div>
        <!-- Empty slot when no partial but has full tokens -->
        <span v-else-if="fragmentBonusTokens > 0" class="fragment-token empty"
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
   NPM MASS (Central Visual)
   ============================================ */
.npm-mass {
  position: relative;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  z-index: 5;
}

.mass-shape {
  width: 40px;
  height: 40px;
  position: relative;
  z-index: 2;
  overflow: visible;
}

.mass-hex {
  fill: #2a1a3a;
  stroke: #5a4a6a;
  stroke-width: 1.5;
  transition: all 0.5s ease;
}

.mass-notch {
  fill: #1a0a2a;
  transition: all 0.5s ease;
}

.mass-core {
  fill: #0a0010;
  opacity: 0;
  transition: all 0.5s ease;
}

/* Tier 1: Dormant - static, muted */
.npm-mass.dormant .mass-hex {
  fill: #1a1225;
  stroke: #3a3a4a;
}

/* Tier 2: Breathing - gentle pulse */
.npm-mass.breathing .mass-hex {
  fill: #2a1a3a;
  stroke: #6a5a7a;
  animation: mass-breathe 3s ease-in-out infinite;
}

.npm-mass.breathing .mass-notch {
  animation: mass-breathe 3s ease-in-out infinite 0.1s;
}

/* Tier 3: Forming - dark core visible */
.npm-mass.forming .mass-hex {
  fill: #3a2a4a;
  stroke: #7a5aff;
}

.npm-mass.forming .mass-core {
  opacity: 1;
  animation: core-pulse 2s ease-in-out infinite;
}

/* Tier 4: Warping - gravity distortion */
.npm-mass.warping .mass-hex {
  fill: #4a3a5a;
  stroke: #9a7aff;
  filter: drop-shadow(0 0 4px rgba(122, 90, 255, 0.5));
}

.npm-mass.warping .mass-core {
  opacity: 1;
  fill: #050008;
}

/* Tier 5: Critical - unstable, crackling */
.npm-mass.critical .mass-hex {
  fill: #5a4a6a;
  stroke: #ff7aff;
  filter: drop-shadow(0 0 8px rgba(255, 122, 255, 0.6));
  animation: mass-critical 0.5s ease-in-out infinite;
}

.npm-mass.critical .mass-core {
  opacity: 1;
  fill: #000;
  animation: core-critical 0.3s ease-in-out infinite;
}

/* Ready state (can ship) - add glow */
.npm-mass.ready .mass-hex {
  filter: drop-shadow(0 0 6px rgba(122, 90, 255, 0.8));
}

/* Holdable state (Tier 5 - can collapse) */
.npm-mass.holdable {
  cursor: pointer;
}

.npm-mass.holdable::after {
  content: '';
  position: absolute;
  inset: -4px;
  border: 2px dashed rgba(255, 122, 255, 0.4);
  border-radius: 50%;
  animation: holdable-hint 2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes holdable-hint {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.05);
  }
}

/* Holding state - active collapse charge */
.npm-mass.holding {
  transform: scale(1.1);
  transition: transform 0.2s ease;
}

.npm-mass.holding .mass-hex {
  stroke: #ff5aff;
  filter: drop-shadow(0 0 12px rgba(255, 90, 255, 0.8));
  animation: holding-pulse 0.3s ease-in-out infinite;
}

.npm-mass.holding::after {
  border-color: rgba(255, 90, 255, 0.8);
  border-style: solid;
  animation: holding-ring 0.5s linear infinite;
}

/* Progress ring during hold */
.npm-mass.holding::before {
  content: '';
  position: absolute;
  inset: -8px;
  border: 3px solid transparent;
  border-top-color: #ff5aff;
  border-radius: 50%;
  transform: rotate(calc(var(--hold-progress, 0) * 360deg));
  transition: transform 0.1s linear;
  pointer-events: none;
}

@keyframes holding-pulse {
  0%,
  100% {
    filter: drop-shadow(0 0 12px rgba(255, 90, 255, 0.8));
  }
  50% {
    filter: drop-shadow(0 0 20px rgba(255, 90, 255, 1));
  }
}

@keyframes holding-ring {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Locked state (>80% - point of no return) */
.npm-mass.locked .mass-hex {
  stroke: #ff0000;
  fill: #3a0a1a;
  animation: locked-shake 0.1s ease-in-out infinite;
}

.npm-mass.locked::after {
  border-color: #ff0000;
}

@keyframes locked-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-2px);
  }
  75% {
    transform: translateX(2px);
  }
}

/* Cancelled state - "exhale" relief animation */
.npm-mass.cancelled {
  animation: cancel-exhale 0.4s ease-out forwards;
}

.npm-mass.cancelled .mass-hex {
  animation: cancel-hex-relief 0.4s ease-out forwards;
}

.npm-mass.cancelled::after {
  animation: cancel-ring-fade 0.4s ease-out forwards;
}

@keyframes cancel-exhale {
  0% {
    transform: scale(1.1);
    filter: drop-shadow(0 0 20px rgba(255, 90, 255, 0.8));
  }
  40% {
    transform: scale(0.9);
  }
  100% {
    transform: scale(1);
    filter: drop-shadow(0 0 8px rgba(122, 90, 255, 0.4));
  }
}

@keyframes cancel-hex-relief {
  0% {
    fill: #3a0a2a;
    stroke: #ff5aff;
  }
  100% {
    fill: #1a0a2a;
    stroke: #7a5aff;
  }
}

@keyframes cancel-ring-fade {
  0% {
    opacity: 1;
    border-color: #ff5aff;
  }
  100% {
    opacity: 0;
    border-color: transparent;
  }
}

/* Glow layers */
.mass-glow {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  pointer-events: none;
}

.mass-glow.outer {
  background: radial-gradient(
    circle,
    rgba(122, 90, 255, 0.15) 0%,
    transparent 70%
  );
  transform: scale(1.8);
  animation: glow-pulse 3s ease-in-out infinite;
}

.mass-glow.inner {
  background: radial-gradient(
    circle,
    rgba(90, 60, 180, 0.2) 0%,
    transparent 60%
  );
  transform: scale(1.4);
  animation: glow-pulse 2s ease-in-out infinite 0.5s;
}

/* Warp rings (tier 4+) */
.warp-rings {
  position: absolute;
  width: 80px;
  height: 80px;
  pointer-events: none;
  z-index: 1;
}

.warp-ring {
  fill: none;
  stroke: rgba(122, 90, 255, 0.2);
  stroke-width: 1;
  animation: warp-rotate 8s linear infinite;
  transform-origin: center;
}

.warp-ring.delayed {
  animation-delay: -4s;
  stroke: rgba(90, 60, 180, 0.15);
}

/* Crackling effects (tier 5) */
.mass-crackle {
  position: absolute;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 3;
}

.crack {
  position: absolute;
  width: 2px;
  height: 8px;
  background: linear-gradient(to bottom, #ff7aff, transparent);
  border-radius: 1px;
}

.crack.c1 {
  top: 2px;
  left: 50%;
  transform: translateX(-50%) rotate(-15deg);
  animation: crack-flash 0.8s ease-in-out infinite;
}

.crack.c2 {
  bottom: 6px;
  right: 4px;
  transform: rotate(45deg);
  animation: crack-flash 0.6s ease-in-out infinite 0.2s;
}

.crack.c3 {
  bottom: 8px;
  left: 6px;
  transform: rotate(-30deg);
  animation: crack-flash 0.7s ease-in-out infinite 0.4s;
}

/* Animations */
@keyframes mass-breathe {
  0%,
  100% {
    opacity: 0.9;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.03);
  }
}

@keyframes core-pulse {
  0%,
  100% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
}

@keyframes mass-critical {
  0%,
  100% {
    transform: scale(1) rotate(0deg);
  }
  25% {
    transform: scale(1.02) rotate(0.5deg);
  }
  75% {
    transform: scale(0.98) rotate(-0.5deg);
  }
}

@keyframes core-critical {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes glow-pulse {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

@keyframes warp-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes crack-flash {
  0%,
  100% {
    opacity: 0;
    height: 6px;
  }
  50% {
    opacity: 1;
    height: 10px;
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

/* Draining tier arcs during collapse hold */
.tier-arc-group.draining .tier-arc-fill {
  animation: tier-arc-drain 0.3s ease-out infinite;
  filter: drop-shadow(0 0 8px rgba(255, 90, 255, 0.8));
}

.tier-arc-group.draining .tier-arc-fill.tier-2 {
  stroke: #ff5aff;
}

.tier-arc-group.draining .tier-arc-fill.tier-3 {
  stroke: #ff5aff;
}

.tier-arc-group.draining .tier-arc-fill.tier-4 {
  stroke: #ff5aff;
}

.tier-arc-group.draining .tier-arc-fill.tier-5 {
  stroke: #ff5aff;
}

@keyframes tier-arc-drain {
  0%,
  100% {
    opacity: 1;
    filter: drop-shadow(0 0 8px rgba(255, 90, 255, 0.8));
  }
  50% {
    opacity: 0.7;
    filter: drop-shadow(0 0 12px rgba(255, 90, 255, 1));
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
  font-size: 18px;
  transition: all 0.3s ease;
  opacity: 0.25;
  color: #6a6a8a;
}

/* Lightning bolt stays smaller */
.tier-unlock-icon.tier-4 {
  font-size: 14px;
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
  font-size: 21px;
}

/* Lightning bolt stays smaller when complete */
.tier-unlock-icon.complete.tier-4 {
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

/* Draining tier icons during collapse hold */
.tier-unlock-icon.draining {
  color: #ff5aff !important;
  text-shadow: 0 0 12px rgba(255, 90, 255, 1) !important;
  animation: tier-icon-drain 0.2s ease-in-out infinite !important;
}

@keyframes tier-icon-drain {
  0%,
  100% {
    transform: translateX(-50%) scale(1);
    opacity: 1;
  }
  50% {
    transform: translateX(-50%) scale(0.9);
    opacity: 0.7;
  }
}

/* Position-specific drain animations */
.tier-unlock-icon.draining.tier-2 {
  animation: tier-icon-drain-right 0.2s ease-in-out infinite !important;
}

.tier-unlock-icon.draining.tier-3 {
  animation: tier-icon-drain-bottom 0.2s ease-in-out infinite !important;
}

.tier-unlock-icon.draining.tier-4 {
  animation: tier-icon-drain-left 0.2s ease-in-out infinite !important;
}

.tier-unlock-icon.draining.tier-5 {
  animation: tier-icon-drain-top 0.2s ease-in-out infinite !important;
}

@keyframes tier-icon-drain-right {
  0%,
  100% {
    transform: translateY(-50%) scale(1);
    opacity: 1;
  }
  50% {
    transform: translateY(-50%) scale(0.9);
    opacity: 0.7;
  }
}

@keyframes tier-icon-drain-bottom {
  0%,
  100% {
    transform: translateX(-50%) scale(1);
    opacity: 1;
  }
  50% {
    transform: translateX(-50%) scale(0.9);
    opacity: 0.7;
  }
}

@keyframes tier-icon-drain-left {
  0%,
  100% {
    transform: translateY(-50%) scale(1);
    opacity: 1;
  }
  50% {
    transform: translateY(-50%) scale(0.9);
    opacity: 0.7;
  }
}

@keyframes tier-icon-drain-top {
  0%,
  100% {
    transform: translateX(-50%) scale(1);
    opacity: 1;
  }
  50% {
    transform: translateX(-50%) scale(0.9);
    opacity: 0.7;
  }
}

/* Drained (empty) tier icons */
.tier-unlock-icon.drained {
  opacity: 0.2 !important;
  color: #4a4a6a !important;
  text-shadow: none !important;
  animation: none !important;
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
  font-size: 16px;
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

/* ============================================
   FRAGMENT BONUS PREVIEW
   ============================================ */
.fragment-preview {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  opacity: 0;
  transition: opacity 0.3s ease;
  padding-left: 4px;
  border-left: 1px solid rgba(255, 200, 90, 0.2);
  margin-left: 4px;
}

.fragment-preview.visible {
  opacity: 1;
}

.fragment-token {
  font-size: 13px;
  line-height: 1;
  transition: all 0.3s ease;
}

.fragment-token.empty {
  color: rgba(255, 200, 90, 0.15);
  text-shadow: none;
}

.fragment-token.filled {
  color: #ffc85a;
  text-shadow: 0 0 6px rgba(255, 200, 90, 0.6);
  animation: fragment-glow 2s ease-in-out infinite;
}

/* Partial fragment container - stacks empty behind filled slice */
.fragment-partial {
  position: relative;
  width: 13px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fragment-partial .fragment-token {
  position: absolute;
}

/* Sliced icon - clips from bottom to show fill progress */
.fragment-token.slice {
  clip-path: inset(calc(100% - var(--fill-percent)) 0 0 0);
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
