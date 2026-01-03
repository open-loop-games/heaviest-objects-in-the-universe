<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { on } from '../../game/events'
import { enterEndlessMode } from '../../game/collapse'
import type { EndScreenStats } from '../../game/events'

// ============================================
// STATE
// ============================================

const isVisible = ref(false)
const stats = ref<EndScreenStats | null>(null)

// Random joke for the punchline
const JOKES = [
  'You fed npm until it ate Earth.',
  'The node_modules won.',
  "This is why we can't have nice dependencies.",
  'npm install --save universe',
]

const joke = computed(() => {
  if (!stats.value) return JOKES[0]
  // Use timesShipped as seed for consistent joke per playthrough
  return JOKES[stats.value.timesShipped % JOKES.length]
})

// Format large numbers (1234567 → 1.2M)
function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

// Format percentage (0.94 → 94%)
function formatPercent(n: number): string {
  return Math.round(n * 100) + '%'
}

// ============================================
// EVENT HANDLING
// ============================================

let unsubEndShow: (() => void) | null = null

onMounted(() => {
  unsubEndShow = on('end:show', ({ stats: endStats }) => {
    stats.value = endStats
    isVisible.value = true
  })
})

onUnmounted(() => {
  unsubEndShow?.()
})

// ============================================
// ACTIONS
// ============================================

function handleEndless() {
  enterEndlessMode()
  isVisible.value = false
}

function handleTheEnd() {
  // For now, just close and let them continue
  // Could navigate to title screen in future
  isVisible.value = false
}
</script>

<template>
  <Transition name="end-screen">
    <div v-if="isVisible" class="end-screen-overlay">
      <div class="end-screen-modal">
        <!-- Title -->
        <h1 class="end-title">
          <span class="title-line">THE HEAVIEST OBJECT IN</span>
          <span class="title-line emphasis">THE UNIVERSE</span>
        </h1>

        <!-- Animated mini black hole -->
        <div class="black-hole-container">
          <div class="black-hole">
            <div class="event-horizon"></div>
            <div class="accretion-disk"></div>
            <div class="accretion-disk delayed"></div>
            <div class="singularity"></div>
          </div>
        </div>

        <!-- Stats grid -->
        <div v-if="stats" class="stats-grid">
          <div class="stat-row">
            <span class="stat-label">Packages Installed</span>
            <span class="stat-value">{{
              formatNumber(stats.totalPackagesInstalled)
            }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Conflicts Resolved</span>
            <span class="stat-value">{{
              formatNumber(stats.totalConflictsResolved)
            }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Symlinks Created</span>
            <span class="stat-value">{{
              formatNumber(stats.totalSymlinksCreated)
            }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Peak Efficiency</span>
            <span class="stat-value">{{
              formatPercent(stats.peakEfficiency)
            }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Total Weight</span>
            <span class="stat-value weight">{{
              formatNumber(stats.totalWeight)
            }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Times Shipped</span>
            <span class="stat-value">{{ stats.timesShipped }}</span>
          </div>
        </div>

        <!-- The joke / punchline -->
        <p class="joke">"{{ joke }}"</p>

        <!-- Action buttons -->
        <div class="button-row">
          <button class="end-button endless" @click="handleEndless">
            <span class="button-icon">∞</span>
            <span class="button-label">Endless</span>
          </button>
          <button class="end-button the-end" @click="handleTheEnd">
            <span class="button-icon">✓</span>
            <span class="button-label">The End</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ============================================
   OVERLAY & MODAL
   ============================================ */
.end-screen-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.9);
  z-index: 1000;
  pointer-events: auto;
}

.end-screen-modal {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 40px 60px;
  background: linear-gradient(
    180deg,
    rgba(20, 10, 40, 0.95) 0%,
    rgba(10, 5, 25, 0.98) 100%
  );
  border: 2px solid rgba(122, 90, 255, 0.4);
  border-radius: 16px;
  box-shadow:
    0 0 60px rgba(122, 90, 255, 0.3),
    inset 0 0 40px rgba(122, 90, 255, 0.05);
  max-width: 500px;
  width: 90%;
}

/* ============================================
   TITLE
   ============================================ */
.end-title {
  text-align: center;
  margin: 0;
  font-family: 'Courier New', monospace;
  font-weight: normal;
  line-height: 1.3;
}

.title-line {
  display: block;
  font-size: 18px;
  color: rgba(200, 180, 255, 0.7);
  letter-spacing: 4px;
}

.title-line.emphasis {
  font-size: 28px;
  color: #fff;
  text-shadow:
    0 0 20px rgba(200, 160, 255, 0.8),
    0 0 40px rgba(122, 90, 255, 0.5);
  letter-spacing: 6px;
}

/* ============================================
   ANIMATED BLACK HOLE
   ============================================ */
.black-hole-container {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.black-hole {
  position: relative;
  width: 80px;
  height: 80px;
}

.singularity {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  background: #000;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow:
    0 0 20px 10px rgba(0, 0, 0, 1),
    0 0 40px 20px rgba(20, 0, 40, 0.8);
  z-index: 3;
}

.event-horizon {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40px;
  height: 40px;
  background: radial-gradient(
    circle,
    #000 0%,
    #000 40%,
    rgba(60, 20, 100, 0.8) 70%,
    transparent 100%
  );
  border-radius: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  animation: horizon-pulse 2s ease-in-out infinite;
}

.accretion-disk {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 80px;
  height: 80px;
  border: 3px solid transparent;
  border-top-color: rgba(255, 140, 200, 0.8);
  border-right-color: rgba(200, 100, 255, 0.6);
  border-radius: 50%;
  transform: translate(-50%, -50%) rotateX(70deg);
  animation: disk-spin 3s linear infinite;
  z-index: 1;
}

.accretion-disk.delayed {
  width: 100px;
  height: 100px;
  border-width: 2px;
  border-top-color: rgba(122, 90, 255, 0.5);
  border-right-color: rgba(90, 60, 200, 0.3);
  animation-duration: 5s;
  animation-direction: reverse;
}

@keyframes horizon-pulse {
  0%,
  100% {
    box-shadow: 0 0 20px 5px rgba(122, 90, 255, 0.3);
  }
  50% {
    box-shadow: 0 0 30px 10px rgba(122, 90, 255, 0.5);
  }
}

@keyframes disk-spin {
  from {
    transform: translate(-50%, -50%) rotateX(70deg) rotateZ(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotateX(70deg) rotateZ(360deg);
  }
}

/* ============================================
   STATS GRID
   ============================================ */
.stats-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  border: 1px solid rgba(122, 90, 255, 0.2);
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'Courier New', monospace;
}

.stat-label {
  font-size: 14px;
  color: rgba(180, 170, 200, 0.8);
}

.stat-value {
  font-size: 16px;
  color: #fff;
  font-weight: bold;
  text-shadow: 0 0 8px rgba(200, 180, 255, 0.5);
}

.stat-value.weight {
  color: #ff8cc8;
  text-shadow: 0 0 10px rgba(255, 140, 200, 0.6);
}

/* ============================================
   JOKE
   ============================================ */
.joke {
  font-family: 'Courier New', monospace;
  font-size: 16px;
  font-style: italic;
  color: rgba(200, 180, 255, 0.9);
  text-align: center;
  margin: 8px 0;
  text-shadow: 0 0 10px rgba(122, 90, 255, 0.4);
}

/* ============================================
   BUTTONS
   ============================================ */
.button-row {
  display: flex;
  gap: 20px;
  margin-top: 8px;
}

.end-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  font-family: 'Courier New', monospace;
  font-size: 16px;
  border: 2px solid;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.end-button .button-icon {
  font-size: 20px;
}

.end-button.endless {
  background: rgba(90, 60, 180, 0.3);
  border-color: rgba(122, 90, 255, 0.6);
  color: #c0a0ff;
}

.end-button.endless:hover {
  background: rgba(90, 60, 180, 0.5);
  border-color: rgba(122, 90, 255, 0.9);
  box-shadow: 0 0 20px rgba(122, 90, 255, 0.4);
  transform: translateY(-2px);
}

.end-button.the-end {
  background: rgba(40, 80, 60, 0.3);
  border-color: rgba(90, 200, 140, 0.6);
  color: #90ffb0;
}

.end-button.the-end:hover {
  background: rgba(40, 80, 60, 0.5);
  border-color: rgba(90, 200, 140, 0.9);
  box-shadow: 0 0 20px rgba(90, 200, 140, 0.4);
  transform: translateY(-2px);
}

.end-button:active {
  transform: translateY(0) scale(0.98);
}

/* ============================================
   TRANSITIONS
   ============================================ */
.end-screen-enter-active {
  transition: all 0.5s ease-out;
}

.end-screen-leave-active {
  transition: all 0.3s ease-in;
}

.end-screen-enter-from {
  opacity: 0;
}

.end-screen-enter-from .end-screen-modal {
  transform: scale(0.8);
  opacity: 0;
}

.end-screen-leave-to {
  opacity: 0;
}

.end-screen-leave-to .end-screen-modal {
  transform: scale(1.1);
  opacity: 0;
}

/* Staggered entrance for modal contents */
.end-screen-enter-active .end-title {
  transition: all 0.4s ease-out 0.2s;
}

.end-screen-enter-active .black-hole-container {
  transition: all 0.4s ease-out 0.3s;
}

.end-screen-enter-active .stats-grid {
  transition: all 0.4s ease-out 0.4s;
}

.end-screen-enter-active .joke {
  transition: all 0.4s ease-out 0.5s;
}

.end-screen-enter-active .button-row {
  transition: all 0.4s ease-out 0.6s;
}

.end-screen-enter-from .end-title,
.end-screen-enter-from .black-hole-container,
.end-screen-enter-from .stats-grid,
.end-screen-enter-from .joke,
.end-screen-enter-from .button-row {
  opacity: 0;
  transform: translateY(20px);
}
</style>
