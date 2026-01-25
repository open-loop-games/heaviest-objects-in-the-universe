<script setup lang="ts">
/**
 * Mobile Achievement Sheet
 *
 * Bottom sheet showing achievements in a 4-column grid.
 * Long-press to reveal name (after hasCollapsed).
 *
 * ┌─────────────────────────────────────┐
 * │              🏆 12/28       [×]     │
 * ├─────────────────────────────────────┤
 * │                                     │
 * │   ◆  ◆◆  ◆◆◆  ◆◆◆◆                │
 * │   ⟲  ⟲⟲  ⟲⟲⟲  ⟲★                  │
 * │   ⚭  ⚭⚭⚭ ⚭★  ⚭💨                 │
 * │   ...                              │
 * │                                     │
 * └─────────────────────────────────────┘
 */

import { ref, computed } from 'vue'
import { gameState } from '../../game/state'
import {
  ACHIEVEMENTS,
  achievementState,
  isEarned,
  CATEGORY_COLORS,
} from '../../game/achievements'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

// ============================================
// STATE
// ============================================

// Long-press tooltip
const tooltipVisible = ref(false)
const tooltipText = ref('')
const tooltipPosition = ref({ x: 0, y: 0 })
let longPressTimer: ReturnType<typeof setTimeout> | null = null

// ============================================
// COMPUTED
// ============================================

const earnedCount = computed(() => achievementState.earned.size)
const totalCount = computed(() => ACHIEVEMENTS.length)

// Whether text names are revealed (after collapse)
const showNames = computed(() => gameState.meta.hasCollapsed)

// ============================================
// HANDLERS
// ============================================

function handleClose() {
  emit('close')
}

function handleBackdropClick(e: Event) {
  if (e.target === e.currentTarget) {
    handleClose()
  }
}

function handleTouchStart(
  e: TouchEvent,
  achievement: (typeof ACHIEVEMENTS)[0]
) {
  if (!showNames.value || !isEarned(achievement.id)) return

  const touch = e.touches[0]
  if (!touch) return

  // Start long-press timer
  longPressTimer = setTimeout(() => {
    tooltipText.value = achievement.name
    tooltipPosition.value = { x: touch.clientX, y: touch.clientY - 60 }
    tooltipVisible.value = true
  }, 500) // 500ms for long-press
}

function handleTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  tooltipVisible.value = false
}

function handleTouchMove() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div
        v-if="open"
        class="sheet-backdrop"
        @click="handleBackdropClick"
        @touchend="handleTouchEnd"
        @touchmove="handleTouchMove"
      >
        <div class="sheet-container">
          <!-- Header -->
          <div class="sheet-header">
            <span class="sheet-title">🏆</span>
            <span class="sheet-count">{{ earnedCount }}/{{ totalCount }}</span>
            <div class="header-spacer" />
            <button class="close-btn" @click="handleClose">×</button>
          </div>

          <!-- Achievement grid -->
          <div class="achievement-grid">
            <div
              v-for="achievement in ACHIEVEMENTS"
              :key="achievement.id"
              class="achievement-cell"
              :class="{
                earned: isEarned(achievement.id),
                rare: achievement.rare,
              }"
              :style="{
                '--category-color': CATEGORY_COLORS[achievement.category],
              }"
              @touchstart="(e) => handleTouchStart(e, achievement)"
              @touchend="handleTouchEnd"
              @touchmove="handleTouchMove"
            >
              <span class="achievement-icon">{{ achievement.icon }}</span>
            </div>
          </div>
        </div>

        <!-- Long-press tooltip -->
        <Transition name="tooltip">
          <div
            v-if="tooltipVisible"
            class="tooltip"
            :style="{
              left: tooltipPosition.x + 'px',
              top: tooltipPosition.y + 'px',
            }"
          >
            {{ tooltipText }}
          </div>
        </Transition>
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
  max-height: 70vh;
  background: rgba(25, 25, 40, 0.98);
  border-radius: 20px 20px 0 0;
  border: 1px solid rgba(255, 200, 90, 0.3);
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
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(100, 100, 140, 0.2);
}

.sheet-title {
  font-size: 28px;
}

.sheet-count {
  font-size: 16px;
  color: rgba(255, 200, 90, 0.8);
  font-family: 'Courier New', monospace;
}

.header-spacer {
  flex: 1;
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
   ACHIEVEMENT GRID (4 columns)
   ============================================ */

.achievement-grid {
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  overflow-y: auto;
  flex: 1;
}

.achievement-cell {
  aspect-ratio: 1;
  border-radius: 12px;
  background: rgba(40, 35, 55, 0.8);
  border: 2px solid rgba(60, 55, 75, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  cursor: default;

  /* Locked state */
  filter: grayscale(1);
  opacity: 0.4;
}

.achievement-cell.earned {
  filter: none;
  opacity: 1;
  border-color: var(--category-color, rgba(150, 150, 200, 0.5));
  box-shadow: 0 0 8px color-mix(in srgb, var(--category-color) 40%, transparent);
}

.achievement-cell.earned:active {
  transform: scale(0.95);
}

.achievement-cell.rare.earned {
  border-color: #ffc85a;
  box-shadow:
    0 0 8px rgba(255, 200, 90, 0.4),
    inset 0 0 8px rgba(255, 200, 90, 0.1);
}

.achievement-icon {
  font-size: 22px;
  line-height: 1;
}

/* ============================================
   TOOLTIP
   ============================================ */

.tooltip {
  position: fixed;
  padding: 8px 12px;
  background: rgba(30, 25, 45, 0.98);
  border: 1px solid rgba(255, 200, 90, 0.5);
  border-radius: 8px;
  color: #eeeeff;
  font-size: 14px;
  font-family: 'Courier New', monospace;
  white-space: nowrap;
  transform: translateX(-50%);
  z-index: 1001;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.tooltip-enter-active,
.tooltip-leave-active {
  transition: all 0.15s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
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

/* Scrollbar styling */
.achievement-grid::-webkit-scrollbar {
  width: 6px;
}

.achievement-grid::-webkit-scrollbar-track {
  background: rgba(30, 25, 45, 0.5);
  border-radius: 3px;
}

.achievement-grid::-webkit-scrollbar-thumb {
  background: rgba(100, 90, 130, 0.5);
  border-radius: 3px;
}
</style>
