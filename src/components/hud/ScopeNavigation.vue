<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { gameState } from '../../game/state'
import { getScopeDepth } from '../../game/scope'
import { exitPackageScope, getInternalStats } from '../../game/packages'
import { setCameraTarget } from '../../game/loop'

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

// Depth levels for rendering (0, 1, 2 from bottom to top)
const depthLevels = computed(() => {
  const levels = []
  for (let i = 2; i >= 0; i--) {
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

// Cleanup on unmount
onUnmounted(() => {
  if (depthChangeTimeout) clearTimeout(depthChangeTimeout)
})
</script>

<template>
  <div class="hud-top-left">
    <button
      class="back-btn"
      :class="{
        stable: isScopeStable,
        unstable: scopePackageState === 'unstable',
      }"
      @click="handleBackClick"
    >
      <!-- Show arrows based on depth: ← for layer 1, ← ← for layer 2 -->
      <span class="back-icon" v-for="i in currentDepth" :key="i">←</span>
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

    <!-- Depth Totem (under back button) -->
    <div
      class="depth-totem"
      :class="{
        'stable-glow': isScopeStable,
        pulse: depthJustChanged,
      }"
    >
      <!-- Vertical connecting line -->
      <div
        class="totem-line"
        :style="{ height: currentDepth * 16 + 'px' }"
      ></div>

      <!-- Depth circles (from top to bottom: layer 2, layer 1, root) -->
      <div
        v-for="level in depthLevels"
        :key="level.level"
        class="totem-circle"
        :class="{
          filled: level.filled,
          deepest: level.isDeepest,
          'root-level': level.isRoot,
        }"
      >
        <span class="circle-icon">{{ level.filled ? '◉' : '○' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hud-top-left {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  pointer-events: auto;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
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

.back-icon {
  font-size: 28px;
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

/* ============================================
   DEPTH TOTEM
   ============================================ */

.depth-totem {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  background: rgba(30, 30, 50, 0.8);
  border: 2px solid var(--hud-border-dark);
  border-radius: 12px;
  position: relative;
  transition: all var(--hud-t-normal) ease;
}

/* Stable state - matches back button glow */
.depth-totem.stable-glow {
  border-color: #4ade80;
  box-shadow: 0 0 16px rgba(74, 222, 128, 0.4);
  animation: totem-stable-pulse 1.5s ease-in-out infinite;
}

/* Pulse on depth change */
.depth-totem.pulse {
  animation: totem-depth-change 0.5s ease-out;
}

/* Connecting line between circles */
.totem-line {
  position: absolute;
  width: 2px;
  background: linear-gradient(to bottom, #7a7aff, #4a4a6a);
  top: 50%;
  transform: translateY(-50%);
  transition: height 0.3s ease;
  z-index: 0;
}

/* Individual depth circles */
.totem-circle {
  position: relative;
  z-index: 1;
  transition: all 0.3s ease;
}

.circle-icon {
  font-size: 16px;
  color: #4a4a6a;
  transition: all 0.3s ease;
  display: block;
  line-height: 1;
}

/* Filled circles (active depth levels) */
.totem-circle.filled .circle-icon {
  color: #7a7aff;
  text-shadow: 0 0 8px rgba(122, 122, 255, 0.6);
}

/* Deepest level - subtle breathe animation */
.totem-circle.deepest .circle-icon {
  animation: totem-breathe 2s ease-in-out infinite;
}

/* Root level styling */
.totem-circle.root-level .circle-icon {
  color: #5a5a7a;
}

.totem-circle.root-level.filled .circle-icon {
  color: #7a7aff;
}

/* Stable state circle colors */
.depth-totem.stable-glow .totem-circle.filled .circle-icon {
  color: #4ade80;
  text-shadow: 0 0 8px rgba(74, 222, 128, 0.6);
}

/* Totem animations */
@keyframes totem-stable-pulse {
  0%,
  100% {
    box-shadow: 0 0 12px rgba(74, 222, 128, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(74, 222, 128, 0.5);
  }
}

@keyframes totem-depth-change {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes totem-breathe {
  0%,
  100% {
    text-shadow: 0 0 6px rgba(122, 122, 255, 0.4);
  }
  50% {
    text-shadow: 0 0 12px rgba(122, 122, 255, 0.8);
  }
}
</style>
