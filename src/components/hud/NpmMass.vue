<script setup lang="ts">
/**
 * NpmMass - Central hexagonal mass visualization
 *
 * Visual states based on ecosystem tier:
 * - Tier 1: dormant (static, muted)
 * - Tier 2: breathing (gentle pulse)
 * - Tier 3: forming (dark core visible)
 * - Tier 4: warping (gravity distortion rings)
 * - Tier 5: critical (unstable, crackling)
 *
 * Collapse hold mechanic (Tier 5):
 * - User holds to charge collapse
 * - Progress ring fills as hold continues
 * - Locks at 80% (point of no return)
 * - Cancel animation if released early
 */
import { computed } from 'vue'

const props = defineProps<{
  /** Current ecosystem tier (1-5) */
  tier: number
  /** Whether gravity threshold reached (can ship) */
  ready: boolean
  /** Whether collapse is available (tier 5) */
  holdable: boolean
  /** Whether user is currently holding */
  holding: boolean
  /** Hold progress (0-1) */
  holdProgress: number
  /** Whether hold has passed point of no return */
  locked: boolean
  /** Whether hold was just cancelled (triggers relief animation) */
  cancelled: boolean
  /** Whether in endless mode (after first collapse) */
  endless: boolean
}>()

const emit = defineEmits<{
  holdStart: [e: MouseEvent | TouchEvent]
}>()

// Mass visual state based on tier
const massState = computed(() => {
  if (props.tier >= 5) return 'critical'
  if (props.tier >= 4) return 'warping'
  if (props.tier >= 3) return 'forming'
  if (props.tier >= 2) return 'breathing'
  return 'dormant'
})

function onHoldStart(e: MouseEvent | TouchEvent) {
  if (!props.holdable) return
  e.preventDefault()
  emit('holdStart', e)
}
</script>

<template>
  <div
    class="npm-mass"
    :class="[
      massState,
      {
        ready: ready,
        holdable: holdable,
        holding: holding,
        locked: locked,
        cancelled: cancelled,
        endless: endless,
      },
    ]"
    :style="holding ? { '--hold-progress': holdProgress } : {}"
    @mousedown="onHoldStart"
    @touchstart="onHoldStart"
  >
    <!-- Outer glow layers (tier 3+) -->
    <div v-if="tier >= 3" class="mass-glow outer"></div>
    <div v-if="tier >= 4" class="mass-glow inner"></div>

    <!-- Gravity warp rings (tier 4+) -->
    <svg v-if="tier >= 4" class="warp-rings" viewBox="0 0 80 80">
      <circle class="warp-ring" cx="40" cy="40" r="32" />
      <circle class="warp-ring delayed" cx="40" cy="40" r="36" />
    </svg>

    <!-- npm hexagon shape -->
    <svg class="mass-shape" viewBox="0 0 40 40">
      <!-- Hexagon path -->
      <polygon class="mass-hex" points="20,2 36,11 36,29 20,38 4,29 4,11" />
      <!-- Inner dark core (tier 3+) -->
      <polygon
        v-if="tier >= 3"
        class="mass-core"
        points="20,8 30,14 30,26 20,32 10,26 10,14"
      />
      <!-- npm-style notch/chunk (the signature npm look) -->
      <rect class="mass-notch" x="14" y="16" width="6" height="12" />
    </svg>

    <!-- Crackling effects (tier 5) -->
    <div v-if="tier >= 5" class="mass-crackle">
      <span class="crack c1"></span>
      <span class="crack c2"></span>
      <span class="crack c3"></span>
    </div>

    <!-- Endless mode indicator -->
    <div v-if="endless" class="endless-indicator">∞</div>
  </div>
</template>

<style scoped>
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

/* Endless mode indicator */
.endless-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 18px;
  font-weight: bold;
  color: #5affff;
  text-shadow:
    0 0 8px rgba(90, 255, 255, 0.9),
    0 0 16px rgba(90, 255, 255, 0.6),
    0 0 24px rgba(90, 255, 255, 0.3);
  z-index: 10;
  pointer-events: none;
  animation: endless-pulse 2s ease-in-out infinite;
}

@keyframes endless-pulse {
  0%,
  100% {
    opacity: 0.8;
    text-shadow:
      0 0 8px rgba(90, 255, 255, 0.9),
      0 0 16px rgba(90, 255, 255, 0.6),
      0 0 24px rgba(90, 255, 255, 0.3);
  }
  50% {
    opacity: 1;
    text-shadow:
      0 0 12px rgba(90, 255, 255, 1),
      0 0 24px rgba(90, 255, 255, 0.8),
      0 0 36px rgba(90, 255, 255, 0.5);
  }
}
</style>
