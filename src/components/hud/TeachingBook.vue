<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick, computed } from 'vue'
import {
  isBookOpen,
  activeTab,
  unlockedTabsList,
  hasUnviewedTabs,
  toggleBook,
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

// Canvas ref for Pixi animations
const canvasRef = ref<HTMLCanvasElement | null>(null)

// Track drawer transition state to avoid button appearing during close animation
const isDrawerTransitioning = ref(false)

// Current animation instance
let currentAnimation: BaseAnimation | null = null

// Create animation for a given tab
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

// Initialize animation when canvas is available
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

// Watch for book open/close
watch(isBookOpen, async (open) => {
  if (open) {
    await initAnimation(activeTab.value)
  } else {
    // Stop and clean up animation when closing
    if (currentAnimation) {
      currentAnimation.destroy()
      currentAnimation = null
    }
  }
})

// Watch for tab changes
watch(activeTab, async (tab) => {
  if (isBookOpen.value) {
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

function handleTabClick(tabId: TabId) {
  switchTab(tabId)
}

function handleBookClick() {
  toggleBook()
}

function handleJourneyClick() {
  openJourney()
}

// Transition hooks
function onDrawerLeave() {
  isDrawerTransitioning.value = true
}

function onDrawerAfterLeave() {
  isDrawerTransitioning.value = false
}

// Show Journey button when unlocked
const showJourneyButton = computed(() => isJourneyUnlocked.value)
</script>

<template>
  <div class="teaching-book" :class="{ open: isBookOpen }">
    <!-- Closed state: Book icon button (hidden during drawer close transition) -->
    <button
      v-if="!isBookOpen && !isDrawerTransitioning"
      class="book-button"
      :class="{ 'has-unviewed': hasUnviewedTabs }"
      @click="handleBookClick"
    >
      <span class="book-icon">?</span>
      <span v-if="hasUnviewedTabs" class="unviewed-dot"></span>
    </button>

    <!-- Open state: Drawer panel -->
    <Transition
      name="drawer"
      @leave="onDrawerLeave"
      @after-leave="onDrawerAfterLeave"
    >
      <div v-if="isBookOpen" class="drawer">
        <!-- Icon strip (horizontal) -->
        <div class="icon-strip">
          <!-- Tab icons -->
          <div class="tab-icons">
            <button
              v-for="tab in unlockedTabsList"
              :key="tab.id"
              class="tab-icon-btn"
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
          <div class="strip-spacer" />

          <!-- Journey button -->
          <button
            v-if="showJourneyButton"
            class="journey-btn"
            :class="{ 'journey-open': isJourneyOpen }"
            @click="handleJourneyClick"
          >
            <span class="journey-icon">▶</span>
          </button>

          <!-- Close button -->
          <button class="close-btn" @click="closeBook">
            <span>×</span>
          </button>
        </div>

        <!-- Animation canvas area -->
        <div class="animation-area">
          <canvas ref="canvasRef" class="animation-canvas"></canvas>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.teaching-book {
  position: absolute;
  bottom: 24px;
  right: 24px;
  z-index: 150;
  pointer-events: auto;
}

/* ============================================
   BOOK BUTTON (Closed State)
   ============================================ */
.book-button {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(30, 20, 50, 0.9);
  border: 2px solid rgba(90, 200, 255, 0.3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.2s ease;
}

.book-button:hover {
  border-color: rgba(90, 200, 255, 0.6);
  box-shadow: 0 0 12px rgba(90, 200, 255, 0.3);
  transform: scale(1.05);
}

.book-button.has-unviewed {
  animation: book-pulse 2s ease-in-out infinite;
}

.book-icon {
  font-size: 24px;
  color: #5affff;
  text-shadow: 0 0 8px rgba(90, 255, 255, 0.6);
}

.unviewed-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ff5a8a;
  box-shadow: 0 0 8px rgba(255, 90, 138, 0.8);
  animation: dot-pulse 1s ease-in-out infinite;
}

@keyframes book-pulse {
  0%,
  100% {
    box-shadow: 0 0 8px rgba(90, 200, 255, 0.2);
  }
  50% {
    box-shadow: 0 0 16px rgba(90, 200, 255, 0.5);
  }
}

@keyframes dot-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
}

/* ============================================
   DRAWER (Open State)
   ============================================ */
.drawer {
  display: flex;
  flex-direction: column;
  background: rgba(30, 20, 50, 0.95);
  border: 2px solid rgba(90, 200, 255, 0.4);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
}

/* Drawer transition */
.drawer-enter-active,
.drawer-leave-active {
  transition: all 0.3s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
  transform: translateX(20px) scale(0.95);
}

/* ============================================
   ICON STRIP (Horizontal)
   ============================================ */
.icon-strip {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  background: rgba(20, 15, 40, 0.5);
  border-bottom: 1px solid rgba(90, 200, 255, 0.2);
}

.tab-icons {
  display: flex;
  gap: 2px;
}

.strip-spacer {
  flex: 1;
}

.tab-icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  position: relative;
}

.tab-icon-btn:hover {
  background: rgba(90, 200, 255, 0.15);
}

.tab-icon-btn.active {
  background: rgba(90, 200, 255, 0.25);
}

.tab-icon-btn.active .tab-icon {
  color: #5affff;
  text-shadow: 0 0 8px rgba(90, 255, 255, 0.8);
  transform: scale(1.1);
}

.tab-icon-btn.unviewed::after {
  content: '';
  position: absolute;
  top: 2px;
  right: 2px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #ff5a8a;
  box-shadow: 0 0 4px rgba(255, 90, 138, 0.8);
}

.tab-icon {
  font-size: 16px;
  color: #8a8aaa;
  transition: all 0.2s ease;
}

.tab-icon-btn:hover .tab-icon {
  color: #aaffff;
}

/* ============================================
   JOURNEY BUTTON
   ============================================ */
.journey-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(255, 200, 90, 0.15);
  border: 1px solid rgba(255, 200, 90, 0.3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  margin-right: 4px;
}

.journey-btn:hover {
  background: rgba(255, 200, 90, 0.3);
  border-color: rgba(255, 200, 90, 0.6);
  box-shadow: 0 0 8px rgba(255, 200, 90, 0.3);
}

.journey-btn.journey-open {
  background: rgba(255, 200, 90, 0.4);
  border-color: rgba(255, 200, 90, 0.8);
}

.journey-icon {
  font-size: 12px;
  color: #ffc85a;
  text-shadow: 0 0 4px rgba(255, 200, 90, 0.6);
}

/* ============================================
   CLOSE BUTTON
   ============================================ */
.close-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #6a6a8a;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 90, 90, 0.2);
  color: #ff8a8a;
}

/* ============================================
   ANIMATION AREA
   ============================================ */
.animation-area {
  min-width: 200px;
  height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1428; /* Match TeachingColors.background */
}

.animation-canvas {
  /* Static positioning for flexbox centering */
  width: 200px;
  height: 150px;
  flex-shrink: 0;
}
</style>
