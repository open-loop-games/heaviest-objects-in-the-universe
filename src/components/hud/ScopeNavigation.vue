<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { gameState } from '../../game/state'
import { getScopeDepth, exitPackageScope } from '../../game/scope'
import { getInternalStats } from '../../game/packages'
import { setCameraTarget } from '../../game/loop'
import { setBackButtonPos } from '../../onboarding/tutorial-state'

// Template ref for the back button
const backBtnRef = ref<HTMLElement | null>(null)

// ============================================
// SCOPE STATE
// ============================================

// Get the current scope package's internal state
const scopePackageState = computed(() => {
  const pkg = gameState.packages.get(gameState.currentScope)
  return pkg?.internalState || null
})

// Is the current scope stable (ready to exit with satisfaction)?
const isScopeStable = computed(() => scopePackageState.value === 'stable')

// Is this the first time exiting a stable scope? (heavy teaching)
const isFirstStableExit = computed(
  () => isScopeStable.value && !gameState.onboarding.firstScopeExited
)

// Internal stats for the current scope
const scopeStats = computed(() => {
  return getInternalStats(gameState.currentScope)
})

// ============================================
// DEPTH TOTEM
// ============================================

// Current scope depth (0 = root, 1 = layer 1, 2 = layer 2)
const currentDepth = computed(() => getScopeDepth())

// Track depth changes for pulse animation
const depthJustChanged = ref(false)
let depthChangeTimeout: ReturnType<typeof setTimeout> | null = null

watch(currentDepth, () => {
  depthJustChanged.value = true
  if (depthChangeTimeout) clearTimeout(depthChangeTimeout)
  depthChangeTimeout = setTimeout(() => {
    depthJustChanged.value = false
  }, 500)
})

// Max depth supported by the totem
const MAX_DEPTH = 5

// Depth levels for rendering (0 to MAX_DEPTH from bottom to top)
const depthLevels = computed(() => {
  const levels = []
  for (let i = MAX_DEPTH; i >= 0; i--) {
    levels.push({
      level: i,
      filled: i <= currentDepth.value && currentDepth.value > 0,
      isDeepest: i === currentDepth.value && currentDepth.value > 0,
      isRoot: i === 0,
    })
  }
  return levels
})

// ============================================
// HANDLERS
// ============================================

function handleBackClick() {
  // Get the current scope package position before exiting
  const scopePkg = gameState.packages.get(gameState.currentScope)
  const targetX = scopePkg?.position.x ?? 0
  const targetY = scopePkg?.position.y ?? 0

  // Exit the scope
  exitPackageScope()

  // Smooth camera transition to the package we just exited
  setCameraTarget(targetX, targetY)
}

// Report back button position for tutorial indicators
function updateBackButtonPos() {
  if (backBtnRef.value) {
    const rect = backBtnRef.value.getBoundingClientRect()
    setBackButtonPos({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
  }
}

onMounted(() => {
  // Initial position report (after layout settles)
  setTimeout(updateBackButtonPos, 50)
})

// Cleanup on unmount
onUnmounted(() => {
  if (depthChangeTimeout) clearTimeout(depthChangeTimeout)
  setBackButtonPos(null)
})
</script>

<template>
  <div class="hud-top-left">
    <button
      ref="backBtnRef"
      class="back-btn"
      :class="{
        stable: isScopeStable,
        unstable: scopePackageState === 'unstable',
        pulse: depthJustChanged,
        'first-exit-teaching': isFirstStableExit,
      }"
      @click="handleBackClick"
    >
      <!-- Single back arrow -->
      <span class="back-icon">←</span>

      <!-- Integrated depth totem -->
      <div class="depth-indicator">
        <div
          v-for="level in depthLevels.slice().reverse()"
          :key="level.level"
          class="depth-dot"
          :class="{
            filled: level.filled,
            deepest: level.isDeepest,
            'root-level': level.isRoot,
          }"
        ></div>
      </div>

      <!-- Show conflict/duplicate indicators if unstable -->
      <div class="scope-status" v-if="scopePackageState === 'unstable'">
        <span
          class="status-dot conflict"
          v-for="i in Math.min(scopeStats.conflicts, 3)"
          :key="'c' + i"
          >!</span
        >
        <span
          class="status-dot duplicate"
          v-for="i in Math.min(scopeStats.duplicates, 3)"
          :key="'d' + i"
          >◎</span
        >
      </div>
      <!-- Stable checkmark -->
      <span class="stable-check" v-if="isScopeStable">✓</span>
    </button>
  </div>
</template>

<style scoped>
.hud-top-left {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
  pointer-events: auto;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(30, 30, 50, 0.9);
  border: 2px solid var(--hud-border-subtle);
  border-radius: 12px;
  color: #aaaacc;
  font-family: inherit;
  font-size: 24px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-btn:hover {
  background: rgba(50, 50, 80, 0.95);
  border-color: #6a6a9a;
  transform: translateX(-2px);
}

.back-btn.pulse {
  animation: btn-pulse 0.4s ease-out;
}

.back-icon {
  font-size: 24px;
  transition: all 0.2s ease;
}

/* Unstable state - red/warning */
.back-btn.unstable {
  border-color: var(--hud-warning-soft);
  box-shadow: 0 0 12px rgba(255, 107, 107, 0.3);
}

.back-btn.unstable .back-icon {
  color: var(--hud-warning-soft);
}

/* Stable state - green/success */
.back-btn.stable {
  border-color: #4ade80;
  background: rgba(30, 50, 40, 0.9);
  box-shadow: 0 0 16px rgba(74, 222, 128, 0.4);
  animation: hud-breathe 1.5s ease-in-out infinite;
}

.back-btn.stable:hover {
  background: rgba(40, 70, 50, 0.95);
  box-shadow: 0 0 24px rgba(74, 222, 128, 0.6);
}

.back-btn.stable .back-icon {
  color: #4ade80;
}

/* First-time exit teaching - strong pulsing effect */
.back-btn.first-exit-teaching {
  animation: first-exit-pulse 0.8s ease-in-out infinite;
  box-shadow:
    0 0 20px rgba(74, 222, 128, 0.6),
    0 0 40px rgba(74, 222, 128, 0.3);
}

@keyframes first-exit-pulse {
  0%,
  100% {
    transform: scale(1);
    box-shadow:
      0 0 20px rgba(74, 222, 128, 0.6),
      0 0 40px rgba(74, 222, 128, 0.3);
  }
  50% {
    transform: scale(1.1);
    box-shadow:
      0 0 30px rgba(74, 222, 128, 0.8),
      0 0 60px rgba(74, 222, 128, 0.5);
  }
}

/* ============================================
   INTEGRATED DEPTH INDICATOR
   ============================================ */

.depth-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
}

.depth-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3a3a5a;
  border: 1px solid #4a4a6a;
  transition: all 0.3s ease;
}

.depth-dot.filled {
  background: #7a7aff;
  border-color: #9a9aff;
  box-shadow: 0 0 6px rgba(122, 122, 255, 0.5);
}

.depth-dot.deepest {
  animation: dot-breathe 2s ease-in-out infinite;
}

.depth-dot.root-level {
  width: 10px;
  height: 10px;
}

/* Stable state depth dots */
.back-btn.stable .depth-dot.filled {
  background: #4ade80;
  border-color: #6ee7a0;
  box-shadow: 0 0 6px rgba(74, 222, 128, 0.5);
}

/* Unstable state depth dots */
.back-btn.unstable .depth-dot.filled {
  background: #ff6b6b;
  border-color: #ff8a8a;
  box-shadow: 0 0 6px rgba(255, 107, 107, 0.5);
}

/* Scope status indicators */
.scope-status {
  display: flex;
  gap: 3px;
}

.status-dot {
  font-size: 12px;
  animation: hud-pulse 0.8s ease-in-out infinite alternate;
}

.status-dot.conflict {
  color: var(--hud-warning-soft);
}

.status-dot.duplicate {
  color: #f59e0b;
}

/* Stable checkmark */
.stable-check {
  font-size: 18px;
  color: #4ade80;
  animation: check-bounce 0.5s ease-out;
}

@keyframes check-bounce {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes btn-pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes dot-breathe {
  0%,
  100% {
    box-shadow: 0 0 4px rgba(122, 122, 255, 0.4);
  }
  50% {
    box-shadow: 0 0 10px rgba(122, 122, 255, 0.8);
  }
}
</style>
