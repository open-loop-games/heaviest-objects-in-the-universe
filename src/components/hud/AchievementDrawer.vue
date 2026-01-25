<script setup lang="ts">
import { ref, computed } from 'vue'
import { gameState } from '../../game/state'
import {
  ACHIEVEMENTS,
  achievementState,
  isEarned,
  CATEGORY_COLORS,
  type AchievementCategory,
} from '../../game/achievements'
import AchievementIcon from './AchievementIcon.vue'

// ============================================
// STATE
// ============================================

const isOpen = ref(false)

// Track drawer transition state
const isDrawerTransitioning = ref(false)

// Track if there are new (unviewed) achievements
const lastViewedCount = ref(0)

// Hovered achievement for tooltip display
const hoveredAchievement = ref<(typeof ACHIEVEMENTS)[number] | null>(null)

// ============================================
// COMPUTED
// ============================================

const earnedCount = computed(() => achievementState.earned.size)

// Check for new achievements since last open
const hasNewAchievements = computed(
  () => earnedCount.value > lastViewedCount.value
)

// Whether text names are revealed (after collapse)
const showNames = computed(() => gameState.meta.hasCollapsed)

// Categories in display order
const categories: AchievementCategory[] = [
  'weight',
  'prestige',
  'symlink',
  'conflict',
  'depth',
  'style',
  'cumulative',
]

// Group achievements by category
const achievementsByCategory = computed(() => {
  const grouped = new Map<AchievementCategory, typeof ACHIEVEMENTS>()
  for (const cat of categories) {
    grouped.set(
      cat,
      ACHIEVEMENTS.filter((a) => a.category === cat)
    )
  }
  return grouped
})

// ============================================
// ACTIONS
// ============================================

function toggleDrawer() {
  if (isOpen.value) {
    isOpen.value = false
  } else {
    isOpen.value = true
    // Mark all as viewed
    lastViewedCount.value = earnedCount.value
  }
}

function closeDrawer() {
  isOpen.value = false
}

// Transition hooks
function onDrawerLeave() {
  isDrawerTransitioning.value = true
}

function onDrawerAfterLeave() {
  isDrawerTransitioning.value = false
}

// Get category icon
function getCategoryIcon(category: AchievementCategory): string {
  switch (category) {
    case 'weight':
      return '◆'
    case 'prestige':
      return '⟲'
    case 'symlink':
      return '⚭'
    case 'conflict':
      return '✕'
    case 'depth':
      return '↓'
    case 'style':
      return '★'
    case 'cumulative':
      return '⊕'
  }
}

// Hover handlers for tooltip
function onAchievementEnter(achievement: (typeof ACHIEVEMENTS)[number]) {
  if (showNames.value) {
    hoveredAchievement.value = achievement
  }
}

function onAchievementLeave() {
  hoveredAchievement.value = null
}
</script>

<template>
  <div class="achievement-drawer" :class="{ open: isOpen }">
    <!-- Closed state: Trophy button -->
    <button
      v-if="!isOpen && !isDrawerTransitioning"
      class="trophy-button"
      :class="{ 'has-new': hasNewAchievements }"
      @click="toggleDrawer"
    >
      <span class="trophy-icon">🏆</span>
      <span v-if="hasNewAchievements" class="new-dot"></span>
    </button>

    <!-- Open state: Drawer panel -->
    <Transition
      name="drawer"
      @leave="onDrawerLeave"
      @after-leave="onDrawerAfterLeave"
    >
      <div v-if="isOpen" class="drawer">
        <!-- Header -->
        <div class="drawer-header">
          <span class="header-icon">🏆</span>
          <div class="header-spacer" />
          <button class="close-btn" @click="closeDrawer">×</button>
        </div>

        <!-- Achievement grid by category -->
        <div class="achievement-grid">
          <template v-for="category in categories" :key="category">
            <div class="category-section">
              <div
                class="category-header"
                :style="{ color: CATEGORY_COLORS[category] }"
              >
                {{ getCategoryIcon(category) }}
              </div>
              <div class="category-achievements">
                <div
                  v-for="achievement in achievementsByCategory.get(category)"
                  :key="achievement.id"
                  class="achievement-cell"
                  :class="{
                    earned: isEarned(achievement.id),
                    rare: achievement.rare,
                  }"
                  :style="{
                    '--category-color': CATEGORY_COLORS[achievement.category],
                  }"
                  @mouseenter="onAchievementEnter(achievement)"
                  @mouseleave="onAchievementLeave"
                >
                  <!-- Geometric layout -->
                  <AchievementIcon
                    v-if="
                      achievement.iconData && 'count' in achievement.iconData
                    "
                    :symbol="achievement.iconData.symbol"
                    :count="achievement.iconData.count"
                  />
                  <!-- Compound layouts -->
                  <AchievementIcon
                    v-else-if="
                      achievement.iconData && 'layout' in achievement.iconData
                    "
                    :layout="achievement.iconData.layout"
                    :symbols="achievement.iconData.symbols"
                    :below="
                      'below' in achievement.iconData
                        ? achievement.iconData.below
                        : undefined
                    "
                  />
                  <!-- Fallback to plain text -->
                  <span v-else class="achievement-icon">{{
                    achievement.icon
                  }}</span>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Tooltip bar (shows hovered achievement name after collapse) -->
        <div
          v-if="showNames"
          class="tooltip-bar"
          :class="{ visible: hoveredAchievement }"
          :style="
            hoveredAchievement
              ? {
                  '--category-color':
                    CATEGORY_COLORS[hoveredAchievement.category],
                }
              : {}
          "
        >
          <span v-if="hoveredAchievement" class="tooltip-name">
            {{ hoveredAchievement.name }}
          </span>
          <span v-else class="tooltip-placeholder">&nbsp;</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.achievement-drawer {
  position: absolute;
  top: 24px;
  right: 90px; /* Left of settings panel */
  z-index: 150;
  pointer-events: auto;
}

/* ============================================
   TROPHY BUTTON (Closed State)
   ============================================ */
.trophy-button {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(30, 20, 50, 0.9);
  border: 2px solid rgba(255, 200, 90, 0.3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.2s ease;
}

.trophy-button:hover {
  border-color: rgba(255, 200, 90, 0.6);
  box-shadow: 0 0 12px rgba(255, 200, 90, 0.3);
  transform: scale(1.05);
}

.trophy-button.has-new {
  animation: trophy-pulse 2s ease-in-out infinite;
}

.trophy-icon {
  font-size: 24px;
}

.new-dot {
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

@keyframes trophy-pulse {
  0%,
  100% {
    box-shadow: 0 0 8px rgba(255, 200, 90, 0.2);
  }
  50% {
    box-shadow: 0 0 16px rgba(255, 200, 90, 0.5);
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
  border: 2px solid rgba(255, 200, 90, 0.4);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
  width: 280px;
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
   HEADER
   ============================================ */
.drawer-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(20, 15, 40, 0.5);
  border-bottom: 1px solid rgba(255, 200, 90, 0.2);
}

.header-icon {
  font-size: 20px;
}

.header-spacer {
  flex: 1;
}

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
   ACHIEVEMENT GRID
   ============================================ */
.achievement-grid {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.category-section {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.category-header {
  width: 20px;
  font-size: 14px;
  text-align: center;
  padding-top: 4px;
  opacity: 0.7;
}

.category-achievements {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
}

.achievement-cell {
  width: 36px;
  height: 36px;
  border-radius: 8px;
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

.achievement-cell.earned:hover {
  transform: scale(1.1);
  box-shadow: 0 0 12px
    color-mix(in srgb, var(--category-color) 60%, transparent);
}

.achievement-cell.rare.earned {
  border-color: #ffc85a;
  box-shadow:
    0 0 8px rgba(255, 200, 90, 0.4),
    inset 0 0 8px rgba(255, 200, 90, 0.1);
}

.achievement-icon {
  font-size: 16px;
  line-height: 1;
}

/* Tooltip bar at bottom of drawer */
.tooltip-bar {
  padding: 8px 12px;
  background: rgba(20, 15, 40, 0.8);
  border-top: 1px solid rgba(100, 80, 140, 0.3);
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.tooltip-bar.visible {
  border-top-color: var(--category-color, rgba(150, 150, 200, 0.5));
  background: rgba(30, 20, 50, 0.9);
}

.tooltip-name {
  font-size: 12px;
  font-family: 'Courier New', monospace;
  color: #eeeeff;
  text-align: center;
  text-shadow: 0 0 8px var(--category-color, rgba(150, 150, 200, 0.5));
}

.tooltip-placeholder {
  font-size: 12px;
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

.achievement-grid::-webkit-scrollbar-thumb:hover {
  background: rgba(120, 110, 150, 0.6);
}
</style>
