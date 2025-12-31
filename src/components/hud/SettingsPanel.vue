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
    <!-- Settings gear with integrated save -->
    <button
      class="icon-btn settings-btn"
      :class="{ active: showSettings, flash: showSaveFlash }"
      @click="toggleSettings"
    >
      <!-- Gear + floppy disk combined icon -->
      <svg class="gear-save-icon" viewBox="0 0 32 32" fill="none">
        <!-- Gear (top-right portion) -->
        <g class="gear-part">
          <!-- Gear teeth -->
          <path
            d="M20 4 L22 4 L22 6.5 Q24 7 25.5 8.5 L28 7.5 L29 9.2 L27 11 Q27.5 12.5 27.5 14 L30 14.5 L30 16.5 L27.5 17 Q27 18.5 26 20 L28 22 L26.5 23.5 L24.5 21.5 Q23 22.5 21 23 L21 26 L19 26 L19 23 Q17 22.5 15.5 21.5"
            stroke="currentColor"
            stroke-width="1.8"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <!-- Gear center circle -->
          <circle
            cx="22"
            cy="14"
            r="3.5"
            stroke="currentColor"
            stroke-width="1.8"
            fill="none"
          />
        </g>
        <!-- Floppy disk (bottom-left) -->
        <g class="floppy-part">
          <!-- Disk body -->
          <rect
            x="3"
            y="14"
            width="14"
            height="14"
            rx="1.5"
            stroke="currentColor"
            stroke-width="1.8"
            fill="none"
          />
          <!-- Metal slider -->
          <rect
            x="6"
            y="14"
            width="8"
            height="4"
            stroke="currentColor"
            stroke-width="1.2"
            fill="none"
          />
          <!-- Label area -->
          <rect
            x="5"
            y="21"
            width="10"
            height="5"
            rx="0.5"
            stroke="currentColor"
            stroke-width="1"
            fill="none"
            opacity="0.6"
          />
        </g>
      </svg>
    </button>

    <!-- Settings panel -->
    <Transition name="settings-panel">
      <div v-if="showSettings" class="settings-panel">
        <!-- Manual save button -->
        <button
          class="panel-btn save-panel-btn"
          :class="{ flash: showSaveFlash }"
          @click="handleSave"
        >
          <svg viewBox="0 0 32 32" fill="none">
            <!-- Floppy disk -->
            <rect
              x="4"
              y="4"
              width="24"
              height="24"
              rx="2"
              stroke="currentColor"
              stroke-width="2"
              fill="none"
            />
            <!-- Metal slider -->
            <rect
              x="10"
              y="4"
              width="12"
              height="7"
              stroke="currentColor"
              stroke-width="1.5"
              fill="none"
            />
            <rect
              x="18"
              y="6"
              width="2"
              height="3"
              fill="currentColor"
              opacity="0.6"
            />
            <!-- Label area -->
            <rect
              x="7"
              y="16"
              width="18"
              height="9"
              rx="1"
              stroke="currentColor"
              stroke-width="1.2"
              fill="none"
            />
          </svg>
          <!-- Checkmark overlay on flash -->
          <svg v-if="showSaveFlash" class="save-check" viewBox="0 0 32 32">
            <path
              d="M8 16 L14 22 L24 10"
              stroke="#5aff5a"
              stroke-width="3"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <!-- Soft reset: recycle symbol + intact floppy (save preserved) -->
        <button class="reset-btn soft-reset" @click="handleSoftReset">
          <svg viewBox="0 0 48 32" fill="none">
            <!-- Left: Bootstrap recycle icon (scaled 1.25x, centered) -->
            <g transform="translate(2, 6) scale(1.25)" fill="currentColor">
              <path
                d="M9.302 1.256a1.5 1.5 0 0 0-2.604 0l-1.704 2.98a.5.5 0 0 0 .869.497l1.703-2.981a.5.5 0 0 1 .868 0l2.54 4.444-1.256-.337a.5.5 0 1 0-.26.966l2.415.647a.5.5 0 0 0 .613-.353l.647-2.415a.5.5 0 1 0-.966-.259l-.333 1.242zM2.973 7.773l-1.255.337a.5.5 0 1 1-.26-.966l2.416-.647a.5.5 0 0 1 .612.353l.647 2.415a.5.5 0 0 1-.966.259l-.333-1.242-2.545 4.454a.5.5 0 0 0 .434.748H5a.5.5 0 0 1 0 1H1.723A1.5 1.5 0 0 1 .421 12.24zm10.89 1.463a.5.5 0 1 0-.868.496l1.716 3.004a.5.5 0 0 1-.434.748h-5.57l.647-.646a.5.5 0 1 0-.708-.707l-1.5 1.5a.5.5 0 0 0 0 .707l1.5 1.5a.5.5 0 1 0 .708-.707l-.647-.647h5.57a1.5 1.5 0 0 0 1.302-2.244z"
              />
            </g>
            <!-- Right: Intact floppy disk (save is safe) -->
            <g transform="translate(26, 4)">
              <rect
                x="2"
                y="2"
                width="18"
                height="20"
                rx="1"
                stroke="currentColor"
                stroke-width="1.8"
                fill="none"
              />
              <!-- Metal slider -->
              <rect
                x="6"
                y="2"
                width="8"
                height="5"
                stroke="currentColor"
                stroke-width="1.2"
                fill="none"
              />
              <!-- Label area -->
              <rect
                x="5"
                y="12"
                width="12"
                height="7"
                rx="0.5"
                stroke="currentColor"
                stroke-width="1"
                fill="none"
                opacity="0.6"
              />
            </g>
          </svg>
        </button>

        <!-- Hard reset: trash can + floppy going in -->
        <button
          class="reset-btn hard-reset"
          @mousedown="startHardReset"
          @mouseup="cancelHardReset"
          @mouseleave="cancelHardReset"
          @touchstart.prevent="startHardReset"
          @touchend="cancelHardReset"
          @touchcancel="cancelHardReset"
        >
          <svg viewBox="0 0 48 32" fill="none">
            <!-- Trash can (left side) -->
            <g transform="translate(2, 2)">
              <!-- Trash lid -->
              <path
                d="M2 6 L18 6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
              <path
                d="M7 6 L7 3 L13 3 L13 6"
                stroke="currentColor"
                stroke-width="1.8"
                fill="none"
              />
              <!-- Trash body -->
              <path
                d="M3 6 L5 26 L15 26 L17 6"
                stroke="currentColor"
                stroke-width="2"
                fill="none"
                stroke-linejoin="round"
              />
              <!-- Trash lines -->
              <path
                d="M7 10 L7.5 22 M10 10 L10 22 M13 10 L12.5 22"
                stroke="currentColor"
                stroke-width="1.2"
                opacity="0.5"
              />
            </g>
            <!-- Floppy tilted going into trash -->
            <g transform="translate(28, 6) rotate(15)">
              <rect
                x="0"
                y="0"
                width="16"
                height="16"
                rx="1"
                stroke="currentColor"
                stroke-width="1.5"
                fill="none"
              />
              <!-- Metal slider -->
              <rect
                x="4"
                y="0"
                width="8"
                height="3"
                stroke="currentColor"
                stroke-width="1"
                fill="none"
              />
              <!-- Label area -->
              <rect
                x="3"
                y="8"
                width="10"
                height="5"
                rx="0.5"
                stroke="currentColor"
                stroke-width="0.8"
                fill="none"
                opacity="0.5"
              />
            </g>
            <!-- Arrow showing floppy going into trash -->
            <path
              d="M30 22 L22 18"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              opacity="0.6"
            />
            <path
              d="M22 18 L24 21 M22 18 L25 16"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              opacity="0.6"
            />
          </svg>
          <!-- Progress ring for hold-to-activate -->
          <svg
            v-if="hardResetProgress > 0"
            class="hold-progress"
            viewBox="0 0 100 70"
            preserveAspectRatio="none"
          >
            <rect
              class="hold-progress-ring"
              x="2"
              y="2"
              width="96"
              height="66"
              rx="12"
              stroke-dashoffset="-160"
              :stroke-dasharray="`${hardResetProgress * 320}, 320`"
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
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
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

.icon-btn.flash {
  background: rgba(90, 255, 90, 0.3);
  border-color: #5aff5a;
}

.gear-save-icon {
  width: 100%;
  height: 100%;
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

/* Panel buttons base */
.panel-btn {
  position: relative;
  width: 66px;
  height: 44px;
  border-radius: 10px;
  border: 2px solid;
  background: rgba(30, 30, 40, 0.9);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
}

.panel-btn svg {
  width: 100%;
  height: 100%;
}

/* Save button in panel */
.save-panel-btn {
  border-color: #5a9a5a;
  color: #5aaa5a;
}

.save-panel-btn:hover {
  background: rgba(90, 170, 90, 0.2);
  border-color: #7aca7a;
  color: #7aca7a;
}

.save-panel-btn.flash {
  background: rgba(90, 255, 90, 0.3);
  border-color: #5aff5a;
  color: #5aff5a;
}

.save-check {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* Reset buttons */
.reset-btn {
  position: relative;
  width: 100px;
  height: 52px;
  border-radius: 12px;
  border: 3px solid;
  background: rgba(30, 30, 40, 0.9);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
}

.reset-btn svg {
  width: 100%;
  height: 100%;
}

/* Soft reset (orange/amber) */
.soft-reset {
  border-color: #ffaa5a;
  color: #ffaa5a;
}

.soft-reset:hover {
  background: rgba(255, 170, 90, 0.2);
  box-shadow: 0 0 12px rgba(255, 170, 90, 0.3);
  border-color: #ffcc7a;
  color: #ffcc7a;
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

/* Hold progress ring (rectangular for wider button) */
.hold-progress {
  position: absolute;
  top: -3px;
  left: -3px;
  width: calc(100% + 6px);
  height: calc(100% + 6px);
  pointer-events: none;
}

.hold-progress-ring {
  fill: none;
  stroke: #ff5a5a;
  stroke-width: 4;
  stroke-linecap: round;
}
</style>
