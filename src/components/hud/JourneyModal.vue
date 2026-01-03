<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick, computed } from 'vue'
import { isJourneyOpen, closeJourney } from '../../onboarding'
import { JourneyAnimation } from '../../onboarding/animations/journey-animation'

// Canvas ref for Journey animation
const canvasRef = ref<HTMLCanvasElement | null>(null)

// Current animation instance
let animation: JourneyAnimation | null = null

// Current phase (0-9 for 10 phases)
const currentPhase = ref(0)
const TOTAL_PHASES = 10

// Initialize animation when modal opens
async function initAnimation() {
  // Clean up existing animation
  if (animation) {
    animation.destroy()
    animation = null
  }

  await nextTick()

  if (!canvasRef.value) return

  animation = new JourneyAnimation()
  await animation.init(canvasRef.value)

  // Subscribe to phase changes
  animation.onPhaseChange = (phase: number) => {
    currentPhase.value = phase
  }

  animation.start()
}

// Watch for modal open/close
watch(isJourneyOpen, async (open) => {
  if (open) {
    await initAnimation()
  } else {
    if (animation) {
      animation.destroy()
      animation = null
    }
    currentPhase.value = 0
  }
})

// Cleanup on unmount
onUnmounted(() => {
  if (animation) {
    animation.destroy()
    animation = null
  }
})

function handleClose() {
  closeJourney()
}

// Phase dot array for rendering
const phaseDots = computed(() =>
  Array.from({ length: TOTAL_PHASES }, (_, i) => i)
)
</script>

<template>
  <Transition name="journey-modal">
    <div v-if="isJourneyOpen" class="journey-overlay" @click.self="handleClose">
      <div class="journey-modal">
        <!-- Close button -->
        <button class="close-btn" @click="handleClose">
          <span>×</span>
        </button>

        <!-- Animation canvas -->
        <div class="journey-canvas-area">
          <canvas ref="canvasRef" class="journey-canvas"></canvas>
        </div>

        <!-- Phase dots -->
        <div class="phase-dots">
          <span
            v-for="phase in phaseDots"
            :key="phase"
            class="phase-dot"
            :class="{
              active: phase === currentPhase,
              past: phase < currentPhase,
            }"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ============================================
   OVERLAY
   ============================================ */
.journey-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 5, 20, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  pointer-events: auto;
}

/* ============================================
   MODAL
   ============================================ */
.journey-modal {
  position: relative;
  background: rgba(30, 20, 50, 0.98);
  border: 2px solid rgba(255, 200, 90, 0.5);
  border-radius: 16px;
  padding: 16px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.6),
    0 0 24px rgba(255, 200, 90, 0.15);
}

/* ============================================
   CLOSE BUTTON
   ============================================ */
.close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(60, 50, 80, 0.8);
  border: 1px solid rgba(255, 200, 90, 0.3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #aaa;
  transition: all 0.2s ease;
  z-index: 10;
}

.close-btn:hover {
  background: rgba(255, 90, 90, 0.3);
  border-color: rgba(255, 90, 90, 0.5);
  color: #ff8a8a;
}

/* ============================================
   CANVAS AREA
   ============================================ */
.journey-canvas-area {
  min-width: 320px;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  overflow: hidden;
  background: #1a1428; /* Match TeachingColors.background */
}

.journey-canvas {
  /* Static positioning for flexbox centering */
  width: 320px;
  height: 220px;
  flex-shrink: 0;
}

/* ============================================
   PHASE DOTS
   ============================================ */
.phase-dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
}

.phase-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(100, 100, 120, 0.4);
  border: 1px solid rgba(100, 100, 120, 0.6);
  transition: all 0.3s ease;
}

.phase-dot.past {
  background: rgba(255, 200, 90, 0.3);
  border-color: rgba(255, 200, 90, 0.5);
}

.phase-dot.active {
  background: #ffc85a;
  border-color: #ffc85a;
  box-shadow: 0 0 8px rgba(255, 200, 90, 0.8);
  transform: scale(1.2);
}

/* ============================================
   TRANSITIONS
   ============================================ */
.journey-modal-enter-active,
.journey-modal-leave-active {
  transition: all 0.3s ease;
}

.journey-modal-enter-from,
.journey-modal-leave-to {
  opacity: 0;
}

.journey-modal-enter-from .journey-modal,
.journey-modal-leave-to .journey-modal {
  transform: scale(0.9);
}
</style>
