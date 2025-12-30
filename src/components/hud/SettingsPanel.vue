<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { softReset, hardReset } from '../../game/mutations'
import { saveToLocalStorage } from '../../game/persistence'
import { createRootPackage } from '../../game/packages'

// Settings panel state
const showSettings = ref(false)
const showSaveFlash = ref(false)

// Hard reset hold state
const hardResetProgress = ref(0)
let hardResetInterval: ReturnType<typeof setInterval> | null = null
const HARD_RESET_HOLD_DURATION = 2000 // 2 seconds to hard reset

function handleSave() {
  saveToLocalStorage()
  // Flash the save button to confirm
  showSaveFlash.value = true
  setTimeout(() => {
    showSaveFlash.value = false
  }, 500)
}

function toggleSettings() {
  showSettings.value = !showSettings.value
  // Reset hard reset progress when closing
  if (!showSettings.value) {
    cancelHardReset()
  }
}

function handleSoftReset() {
  softReset()
  createRootPackage()
  showSettings.value = false
}

function startHardReset() {
  if (hardResetInterval) return

  const startTime = Date.now()
  hardResetInterval = setInterval(() => {
    const elapsed = Date.now() - startTime
    hardResetProgress.value = Math.min(1, elapsed / HARD_RESET_HOLD_DURATION)

    if (hardResetProgress.value >= 1) {
      cancelHardReset()
      hardReset()
      createRootPackage()
      showSettings.value = false
    }
  }, 16)
}

function cancelHardReset() {
  if (hardResetInterval) {
    clearInterval(hardResetInterval)
    hardResetInterval = null
  }
  hardResetProgress.value = 0
}

// Cleanup on unmount
onUnmounted(() => {
  cancelHardReset()
})
</script>

<template>
  <div class="hud-top-right">
    <!-- Save button (floppy disk) -->
    <button
      class="icon-btn save-btn"
      :class="{ flash: showSaveFlash }"
      @click="handleSave"
    >
      <span class="btn-icon">💾</span>
    </button>

    <!-- Settings gear -->
    <button
      class="icon-btn settings-btn"
      :class="{ active: showSettings }"
      @click="toggleSettings"
    >
      <span class="btn-icon">⚙</span>
    </button>

    <!-- Settings panel -->
    <Transition name="settings-panel">
      <div v-if="showSettings" class="settings-panel">
        <!-- Soft reset (yellow) -->
        <button class="reset-btn soft-reset" @click="handleSoftReset">
          <span class="reset-icon">↺</span>
        </button>

        <!-- Hard reset (red, hold to activate) -->
        <button
          class="reset-btn hard-reset"
          @mousedown="startHardReset"
          @mouseup="cancelHardReset"
          @mouseleave="cancelHardReset"
          @touchstart.prevent="startHardReset"
          @touchend="cancelHardReset"
          @touchcancel="cancelHardReset"
        >
          <span class="reset-icon">⚠✕</span>
          <!-- Progress ring for hold-to-activate -->
          <svg
            v-if="hardResetProgress > 0"
            class="hold-progress"
            viewBox="0 0 36 36"
          >
            <circle
              class="hold-progress-ring"
              :stroke-dasharray="`${hardResetProgress * 100}, 100`"
              cx="18"
              cy="18"
              r="16"
            />
          </svg>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.hud-top-right {
  display: flex;
  gap: 12px;
  position: relative;
  pointer-events: auto;
}

.icon-btn {
  width: 54px;
  height: 54px;
  border-radius: 12px;
  border: 2px solid #3a3a5a;
  background: rgba(30, 30, 40, 0.8);
  color: #aaa;
  font-size: 24px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover {
  background: rgba(50, 50, 70, 0.9);
  border-color: #5a5a8a;
  color: #eee;
}

.icon-btn.active {
  background: rgba(60, 60, 90, 0.9);
  border-color: #7a7aff;
}

.btn-icon {
  font-size: 27px;
}

/* Save button flash effect */
.save-btn.flash {
  background: rgba(90, 255, 90, 0.3);
  border-color: #5aff5a;
}

/* Settings panel */
.settings-panel {
  position: absolute;
  top: 66px;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: rgba(30, 30, 40, 0.95);
  border: 2px solid #3a3a5a;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
  z-index: 201;
}

/* Settings panel transition */
.settings-panel-enter-active {
  transition: all 0.2s ease-out;
}

.settings-panel-leave-active {
  transition: all 0.15s ease-in;
}

.settings-panel-enter-from,
.settings-panel-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

/* Reset buttons */
.reset-btn {
  position: relative;
  width: 66px;
  height: 66px;
  border-radius: 12px;
  border: 3px solid;
  background: rgba(30, 30, 40, 0.9);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reset-icon {
  font-size: 27px;
  z-index: 1;
}

/* Soft reset (yellow/orange) */
.soft-reset {
  border-color: #ffaa5a;
  color: #ffaa5a;
}

.soft-reset:hover {
  background: rgba(255, 170, 90, 0.2);
  box-shadow: 0 0 12px rgba(255, 170, 90, 0.3);
}

/* Hard reset (red) */
.hard-reset {
  border-color: #ff5a5a;
  color: #ff5a5a;
}

.hard-reset:hover {
  background: rgba(255, 90, 90, 0.2);
}

.hard-reset:active {
  background: rgba(255, 90, 90, 0.3);
  box-shadow: 0 0 16px rgba(255, 90, 90, 0.4);
}

/* Hold progress ring */
.hold-progress {
  position: absolute;
  top: -3px;
  left: -3px;
  width: calc(100% + 6px);
  height: calc(100% + 6px);
  transform: rotate(-90deg);
  pointer-events: none;
}

.hold-progress-ring {
  fill: none;
  stroke: #ff5a5a;
  stroke-width: 3;
  stroke-linecap: round;
}
</style>
