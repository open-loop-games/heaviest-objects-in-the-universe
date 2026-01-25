<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { on } from '../../game/events'
import {
  ACHIEVEMENTS,
  CATEGORY_COLORS,
  type AchievementCategory,
} from '../../game/achievements'
import { gameState } from '../../game/state'

// ============================================
// TYPES
// ============================================

interface ToastItem {
  id: string
  icon: string
  name: string
  category: AchievementCategory
  key: number // Unique key for Vue transitions
}

// ============================================
// STATE
// ============================================

const toastQueue = ref<ToastItem[]>([])
const currentToast = ref<ToastItem | null>(null)
let toastKey = 0
let dismissTimer: ReturnType<typeof setTimeout> | null = null

// ============================================
// TOAST MANAGEMENT
// ============================================

function showNextToast() {
  if (currentToast.value || toastQueue.value.length === 0) return

  currentToast.value = toastQueue.value.shift()!

  // Auto-dismiss after 2.5 seconds
  dismissTimer = setTimeout(() => {
    currentToast.value = null
    dismissTimer = null
    // Show next toast after a small delay
    setTimeout(showNextToast, 300)
  }, 2500)
}

function queueToast(achievementId: string, icon: string) {
  const achievement = ACHIEVEMENTS.find((a) => a.id === achievementId)
  if (!achievement) return

  toastQueue.value.push({
    id: achievement.id,
    icon: icon,
    name: achievement.name,
    category: achievement.category,
    key: ++toastKey,
  })

  // Try to show immediately if nothing is showing
  if (!currentToast.value) {
    showNextToast()
  }
}

// ============================================
// EVENT LISTENER
// ============================================

let unsubscribe: (() => void) | null = null

onMounted(() => {
  unsubscribe = on('achievement:earned', (data) => {
    queueToast(data.id, data.icon)
  })
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
  if (dismissTimer) clearTimeout(dismissTimer)
})

// ============================================
// COMPUTED HELPERS
// ============================================

function getCategoryColor(category: AchievementCategory): string {
  return CATEGORY_COLORS[category]
}

// Whether to show achievement name (after collapse)
function shouldShowName(): boolean {
  return gameState.meta.hasCollapsed
}
</script>

<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="toast-container">
      <div
        v-if="currentToast"
        :key="currentToast.key"
        class="achievement-toast"
        :style="{ '--category-color': getCategoryColor(currentToast.category) }"
      >
        <div class="toast-icon-wrapper">
          <span class="toast-icon">{{ currentToast.icon }}</span>
          <div class="toast-glow" />
        </div>
        <span v-if="shouldShowName()" class="toast-name">
          {{ currentToast.name }}
        </span>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.achievement-toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: rgba(25, 20, 40, 0.95);
  border: 2px solid var(--category-color, #ffc85a);
  border-radius: 16px;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.5),
    0 0 20px color-mix(in srgb, var(--category-color) 30%, transparent);
  animation: toast-enter 0.4s ease-out;
}

.toast-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-icon {
  font-size: 28px;
  animation: icon-pulse 0.6s ease-out;
  position: relative;
  z-index: 1;
}

.toast-glow {
  position: absolute;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--category-color) 40%, transparent) 0%,
    transparent 70%
  );
  animation: glow-pulse 1.5s ease-in-out infinite;
}

.toast-name {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: #eeeeff;
  font-weight: bold;
  white-space: nowrap;
}

/* Animations */
@keyframes toast-enter {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.9);
  }
  50% {
    transform: translateY(-5px) scale(1.02);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes icon-pulse {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  50% {
    transform: scale(1.3);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes glow-pulse {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

/* Transition classes */
.toast-enter-active {
  transition: all 0.4s ease-out;
}

.toast-leave-active {
  transition: all 0.3s ease-in;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(30px) scale(0.8);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.9);
}
</style>
