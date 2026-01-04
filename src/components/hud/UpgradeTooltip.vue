<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick, computed } from 'vue'
import {
  activeTooltip,
  tooltipAnchor,
  type TooltipType,
} from '../../game/ui-state'
import {
  TOOLTIP_WIDTH,
  TOOLTIP_HEIGHT,
  BandwidthTooltip,
  CompressionTooltip,
  ResolveSpeedTooltip,
  SurgeTooltip,
  AutoResolveTooltip,
  EfficiencyTooltip,
  StabilityTooltip,
  Tier2Tooltip,
  Tier3Tooltip,
  Tier4Tooltip,
  Tier5Tooltip,
  RewardTooltip,
  FragmentTooltip,
  BandwidthIconTooltip,
  WeightIconTooltip,
  SurgeIconTooltip,
  type TooltipAnimation,
} from '../../onboarding/tooltips'

// Canvas ref
const canvasRef = ref<HTMLCanvasElement | null>(null)

// Current animation instance
let currentAnimation: TooltipAnimation | null = null

// Visible state (for transitions)
const isVisible = ref(false)

// Dynamic position based on anchor element
const tooltipStyle = computed(() => ({
  left: `${tooltipAnchor.value.right + 12}px`,
  top: `${tooltipAnchor.value.top}px`,
}))

/**
 * Create the appropriate animation for the tooltip type
 */
function createAnimation(type: TooltipType): TooltipAnimation | null {
  switch (type) {
    case 'bandwidth':
      return new BandwidthTooltip()
    case 'compression':
      return new CompressionTooltip()
    case 'resolveSpeed':
      return new ResolveSpeedTooltip()
    case 'surge':
      return new SurgeTooltip()
    case 'autoResolve':
      return new AutoResolveTooltip()
    case 'efficiency':
      return new EfficiencyTooltip()
    case 'stability':
      return new StabilityTooltip()
    case 'tier2':
      return new Tier2Tooltip()
    case 'tier3':
      return new Tier3Tooltip()
    case 'tier4':
      return new Tier4Tooltip()
    case 'tier5':
      return new Tier5Tooltip()
    case 'reward':
      return new RewardTooltip()
    case 'fragment':
      return new FragmentTooltip()
    case 'bandwidthIcon':
      return new BandwidthIconTooltip()
    case 'weightIcon':
      return new WeightIconTooltip()
    case 'surgeIcon':
      return new SurgeIconTooltip()
    default:
      return null
  }
}

/**
 * Start the tooltip animation
 */
async function startTooltip(type: TooltipType) {
  if (!type) return

  // Create the animation
  currentAnimation = createAnimation(type)
  if (!currentAnimation) return

  // Show the container
  isVisible.value = true

  // Wait for DOM update
  await nextTick()

  // Initialize and start
  if (canvasRef.value && currentAnimation) {
    await currentAnimation.init(canvasRef.value)
    currentAnimation.start()
  }
}

/**
 * Stop the tooltip animation
 */
function stopTooltip() {
  if (currentAnimation) {
    currentAnimation.destroy()
    currentAnimation = null
  }
  isVisible.value = false
}

// Watch for tooltip changes
watch(
  activeTooltip,
  (newType, oldType) => {
    if (newType !== oldType) {
      // Stop any existing animation
      stopTooltip()

      // Start new one if type is set
      if (newType) {
        startTooltip(newType)
      }
    }
  },
  { immediate: true }
)

// Cleanup on unmount
onUnmounted(() => {
  stopTooltip()
})
</script>

<template>
  <Transition name="tooltip">
    <div v-if="isVisible" class="upgrade-tooltip" :style="tooltipStyle">
      <canvas
        ref="canvasRef"
        :width="TOOLTIP_WIDTH"
        :height="TOOLTIP_HEIGHT"
        class="tooltip-canvas"
      />
    </div>
  </Transition>
</template>

<style scoped>
.upgrade-tooltip {
  position: fixed;
  pointer-events: none;
  z-index: 100;
}

.tooltip-canvas {
  display: block;
  border-radius: 8px;
  border: 1px solid rgba(90, 255, 255, 0.3);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.4),
    0 0 12px rgba(90, 255, 255, 0.15);
}

/* Tooltip enter/leave transitions */
.tooltip-enter-active {
  transition: all 0.2s ease-out;
}

.tooltip-leave-active {
  transition: all 0.15s ease-in;
}

.tooltip-enter-from {
  opacity: 0;
  transform: translateX(-10px) scale(0.95);
}

.tooltip-leave-to {
  opacity: 0;
  transform: translateX(-5px) scale(0.98);
}
</style>
