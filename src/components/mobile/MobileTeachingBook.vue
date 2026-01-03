<script setup lang="ts">
/**
 * Mobile Teaching Book - Bottom Sheet Version
 *
 * Visual-only teaching interface with tabbed animations.
 * Follows MobileUpgradeSheet pattern for consistent mobile UX.
 *
 * ┌─────────────────────────────────────┐
 * │              ?              [×]     │
 * ├─────────────────────────────────────┤
 * │  [📦] [🔗] [⚡] [↘] [★] [◎]        │  ← Tab icons
 * ├─────────────────────────────────────┤
 * │                                     │
 * │         [Canvas Animation]          │
 * │                                     │
 * └─────────────────────────────────────┘
 */

import { ref, watch, onUnmounted, nextTick } from 'vue'
import {
  activeTab,
  unlockedTabsList,
  switchTab,
  closeBook,
  isTabViewed,
  isJourneyUnlocked,
  isJourneyOpen,
  openJourney,
  type TabId,
} from '../../onboarding'
import { BaseAnimation } from '../../onboarding/animations/base-animation'
import { InstallAnimation } from '../../onboarding/animations/install-animation'
import { DuplicatesAnimation } from '../../onboarding/animations/duplicates-animation'
import { ConflictsAnimation } from '../../onboarding/animations/conflicts-animation'
import { DivingAnimation } from '../../onboarding/animations/diving-animation'
import { ShipAnimation } from '../../onboarding/animations/ship-animation'
import { SurgeAnimation } from '../../onboarding/animations/surge-animation'

// ============================================
// PROPS & EMITS
// ============================================

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

// ============================================
// CANVAS & ANIMATION
// ============================================

const canvasRef = ref<HTMLCanvasElement | null>(null)
let currentAnimation: BaseAnimation | null = null

function createAnimationForTab(tab: TabId): BaseAnimation | null {
  switch (tab) {
    case 'install':
      return new InstallAnimation()
    case 'duplicates':
      return new DuplicatesAnimation()
    case 'conflicts':
      return new ConflictsAnimation()
    case 'diving':
      return new DivingAnimation()
    case 'ship':
      return new ShipAnimation()
    case 'surge':
      return new SurgeAnimation()
    default:
      return null
  }
}

async function initAnimation(tab: TabId) {
  // Clean up existing animation
  if (currentAnimation) {
    currentAnimation.destroy()
    currentAnimation = null
  }

  // Wait for canvas to be available
  await nextTick()

  if (!canvasRef.value) return

  // Create and initialize new animation
  const animation = createAnimationForTab(tab)
  if (animation) {
    await animation.init(canvasRef.value)
    animation.start()
    currentAnimation = animation
  }
}

// Watch for open/close
watch(
  () => props.open,
  async (open) => {
    if (open) {
      await initAnimation(activeTab.value)
    } else {
      if (currentAnimation) {
        currentAnimation.destroy()
        currentAnimation = null
      }
    }
  }
)

// Watch for tab changes
watch(activeTab, async (tab) => {
  if (props.open) {
    await initAnimation(tab)
  }
})

// Cleanup on unmount
onUnmounted(() => {
  if (currentAnimation) {
    currentAnimation.destroy()
    currentAnimation = null
  }
})

// ============================================
// ACTIONS
// ============================================

function handleTabClick(tabId: TabId) {
  switchTab(tabId)
}

function handleJourneyClick() {
  openJourney()
}

function handleClose() {
  closeBook()
  emit('close')
}

function handleBackdropClick(e: Event) {
  if (e.target === e.currentTarget) {
    handleClose()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="sheet-backdrop" @click="handleBackdropClick">
        <div class="sheet-container">
          <!-- Header -->
          <div class="sheet-header">
            <span class="sheet-title">?</span>
            <button class="close-btn" @click="handleClose">×</button>
          </div>

          <!-- Tab strip -->
          <div class="tab-strip">
            <div class="tab-icons">
              <button
                v-for="tab in unlockedTabsList"
                :key="tab.id"
                class="tab-btn"
                :class="{
                  active: activeTab === tab.id,
                  unviewed: !isTabViewed(tab.id),
                }"
                @click="handleTabClick(tab.id)"
              >
                <span class="tab-icon">{{ tab.icon }}</span>
              </button>
            </div>

            <!-- Spacer -->
            <div class="tab-spacer" />

            <!-- Journey button -->
            <button
              v-if="isJourneyUnlocked"
              class="journey-btn"
              :class="{ 'journey-open': isJourneyOpen }"
              @click="handleJourneyClick"
            >
              <span class="journey-icon">▶</span>
            </button>
          </div>

          <!-- Animation canvas area -->
          <div class="animation-area">
            <canvas ref="canvasRef" class="animation-canvas"></canvas>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ============================================
   BACKDROP & CONTAINER
   ============================================ */

.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet-container {
  width: 100%;
  max-width: 500px;
  background: rgba(25, 25, 40, 0.98);
  border-radius: 20px 20px 0 0;
  border: 1px solid rgba(90, 200, 255, 0.3);
  border-bottom: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ============================================
   HEADER
   ============================================ */

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(90, 200, 255, 0.2);
}

.sheet-title {
  font-size: 28px;
  font-weight: bold;
  color: #5affff;
  text-shadow: 0 0 8px rgba(90, 255, 255, 0.6);
}

.close-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(60, 60, 80, 0.8);
  border: 2px solid rgba(100, 100, 140, 0.3);
  color: #aaa;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.close-btn:active {
  background: rgba(80, 80, 100, 0.9);
  transform: scale(0.95);
}

/* ============================================
   TAB STRIP
   ============================================ */

.tab-strip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 16px;
  background: rgba(20, 15, 40, 0.5);
  border-bottom: 1px solid rgba(90, 200, 255, 0.15);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.tab-icons {
  display: flex;
  gap: 6px;
}

.tab-spacer {
  flex: 1;
}

.tab-btn {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: transparent;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  position: relative;
  flex-shrink: 0;
}

.tab-btn:active {
  transform: scale(0.95);
}

.tab-btn.active {
  background: rgba(90, 200, 255, 0.2);
  border-color: rgba(90, 200, 255, 0.5);
}

.tab-btn.active .tab-icon {
  color: #5affff;
  text-shadow: 0 0 8px rgba(90, 255, 255, 0.8);
  transform: scale(1.1);
}

.tab-btn.unviewed::after {
  content: '';
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff5a8a;
  box-shadow: 0 0 6px rgba(255, 90, 138, 0.8);
}

.tab-icon {
  font-size: 20px;
  color: #8a8aaa;
  transition: all 0.2s ease;
}

/* ============================================
   JOURNEY BUTTON
   ============================================ */

.journey-btn {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(255, 200, 90, 0.15);
  border: 2px solid rgba(255, 200, 90, 0.3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.journey-btn:active {
  transform: scale(0.95);
  background: rgba(255, 200, 90, 0.3);
}

.journey-btn.journey-open {
  background: rgba(255, 200, 90, 0.35);
  border-color: rgba(255, 200, 90, 0.7);
}

.journey-icon {
  font-size: 14px;
  color: #ffc85a;
  text-shadow: 0 0 4px rgba(255, 200, 90, 0.6);
}

/* ============================================
   ANIMATION AREA
   ============================================ */

.animation-area {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1428;
  padding: 16px;
}

.animation-canvas {
  width: 200px;
  height: 150px;
  flex-shrink: 0;
}

/* ============================================
   TRANSITIONS
   ============================================ */

.sheet-enter-active,
.sheet-leave-active {
  transition: all 0.3s ease;
}

.sheet-enter-active .sheet-container,
.sheet-leave-active .sheet-container {
  transition: transform 0.3s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  background: rgba(0, 0, 0, 0);
}

.sheet-enter-from .sheet-container,
.sheet-leave-to .sheet-container {
  transform: translateY(100%);
}
</style>
