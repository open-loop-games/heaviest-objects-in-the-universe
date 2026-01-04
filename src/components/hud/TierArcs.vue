<script setup lang="ts">
/**
 * TierArcs - Quarter-circle progress arcs showing tier progression
 *
 * Each arc represents progress toward the next tier:
 * - Tier 2 (right): ⚙ Automation
 * - Tier 3 (bottom): ⟲ Symlinks
 * - Tier 4 (left): ⚡ Speed
 * - Tier 5 (top): ★ Collapse
 *
 * During collapse hold, arcs drain in reverse order (tier 5 first).
 */
import { computed } from 'vue'
import { TIER_THRESHOLDS } from '../../game/config'

const props = defineProps<{
  /** Current cache token count */
  cacheTokens: number
  /** Whether user is holding for collapse */
  isHolding: boolean
  /** Collapse hold progress (0-1) */
  holdProgress: number
  /** Whether automation is currently processing */
  automationActive: boolean
  /** Type of automation processing */
  automationType: string | null
  /** Whether to show automation completion flash */
  showAutomationFlash: boolean
}>()

const emit = defineEmits<{
  /** Emitted when mouse enters a tier icon */
  iconEnter: [payload: { index: number; tier: number; el: HTMLElement }]
  /** Emitted when mouse leaves a tier icon */
  iconLeave: []
}>()

function handleIconEnter(index: number, tier: number, event: MouseEvent) {
  emit('iconEnter', {
    index,
    tier,
    el: event.currentTarget as HTMLElement,
  })
}

function handleIconLeave() {
  emit('iconLeave')
}

// Static tier metadata (never changes)
const TIER_ARC_META = [
  { tier: 2, icon: '⚙', start: 0, end: TIER_THRESHOLDS[1] },
  { tier: 3, icon: '⟲', start: TIER_THRESHOLDS[1], end: TIER_THRESHOLDS[2] },
  { tier: 4, icon: '⚡', start: TIER_THRESHOLDS[2], end: TIER_THRESHOLDS[3] },
  { tier: 5, icon: '★', start: TIER_THRESHOLDS[3], end: TIER_THRESHOLDS[4] },
] as const

// Calculate progress within each tier segment (0-1)
const tierArcProgress = computed(() => {
  const tokens = props.cacheTokens

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
  const holdProg = props.isHolding ? props.holdProgress : 0

  return tierArcProgress.value.map((tier, i) => {
    const r = radii[i] ?? 70
    const circumference = 2 * Math.PI * r
    // Each arc is a quarter (90 degrees = 25% of circumference)
    const arcLength = circumference * 0.25

    // During hold, drain tiers in reverse order (tier 5 first, tier 2 last)
    // Each tier drains over 20% of the hold progress
    // Tier 5 (i=3): drains at 0-20%, Tier 4 (i=2): 20-40%, etc.
    let effectiveProgress = tier.progress
    if (holdProg > 0 && tier.complete) {
      const reversedIndex = 3 - i // 3,2,1,0 for tiers 5,4,3,2
      const drainStart = reversedIndex * 0.2 // 0%, 20%, 40%, 60%
      const drainEnd = drainStart + 0.25 // 25%, 45%, 65%, 85%

      if (holdProg >= drainEnd) {
        effectiveProgress = 0 // Fully drained
      } else if (holdProg > drainStart) {
        // Partially drained
        const drainAmount = (holdProg - drainStart) / (drainEnd - drainStart)
        effectiveProgress = tier.progress * (1 - drainAmount)
      }
    }

    const filledLength = arcLength * effectiveProgress

    // Starting rotation for each quadrant (arc ends align with icons)
    // Tier 2 ends at right (gear), Tier 3 at bottom, Tier 4 at left, Tier 5 at top
    const startAngle = i * 90

    return {
      ...tier,
      r,
      circumference,
      arcLength,
      dashArray: `${filledLength} ${circumference}`,
      trackDashArray: `${arcLength} ${circumference}`,
      rotation: startAngle,
      draining: holdProg > 0 && effectiveProgress < tier.progress,
    }
  })
})

// Check if a tier (by index 0-3) is currently draining
function isTierDraining(index: number): boolean {
  if (!props.isHolding) return false
  const holdProg = props.holdProgress
  const reversedIndex = 3 - index // 3,2,1,0 for tiers 5,4,3,2
  const drainStart = reversedIndex * 0.2
  const drainEnd = drainStart + 0.25
  return holdProg > drainStart && holdProg < drainEnd
}

// Check if a tier (by index 0-3) has been fully drained
function isTierDrained(index: number): boolean {
  if (!props.isHolding) return false
  const holdProg = props.holdProgress
  const reversedIndex = 3 - index
  const drainEnd = reversedIndex * 0.2 + 0.25
  return holdProg >= drainEnd
}
</script>

<template>
  <!-- Tier progress arcs (outer rings) -->
  <svg class="tier-arcs" viewBox="0 0 200 200">
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
  <div class="tier-unlock-icons">
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
          arc.tier === 2 && automationActive && automationType === 'resolve',
        'auto-flash':
          arc.tier === 2 && showAutomationFlash && automationType === 'resolve',
      }"
      @mouseenter="handleIconEnter(i, arc.tier, $event)"
      @mouseleave="handleIconLeave"
      >{{ arc.icon }}</span
    >
  </div>
</template>

<style scoped>
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
  pointer-events: auto;
  cursor: help;
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
</style>
