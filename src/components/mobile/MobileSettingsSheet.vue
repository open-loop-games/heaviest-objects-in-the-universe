<script setup lang="ts">
/**
 * Mobile Settings Sheet (No-Text Version)
 *
 * Visual-only settings with save and reset buttons.
 * Uses icons only - no text labels.
 *
 * ┌─────────────────────────────────────┐
 * │              ⚙              [×]     │
 * ├─────────────────────────────────────┤
 * │                                     │
 * │     [💾]  ────────────  [✓]        │  Save
 * │                                     │
 * │     [🗑]  ────────────  [⚠]        │  Reset (danger)
 * │                                     │
 * └─────────────────────────────────────┘
 */

import { ref } from 'vue'
import { saveToLocalStorage } from '../../game/persistence'
import { hardReset } from '../../game/prestige'
import { createRootPackage } from '../../game/packages'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

// ============================================
// STATE
// ============================================

// Confirmation state for dangerous actions
const confirmingReset = ref(false)
const saveSuccess = ref(false)

// ============================================
// ACTIONS
// ============================================

function handleSave() {
  const success = saveToLocalStorage()
  if (success) {
    saveSuccess.value = true
    // Reset after animation
    setTimeout(() => {
      saveSuccess.value = false
    }, 1500)
  }
}

function handleResetClick() {
  if (confirmingReset.value) {
    // Second tap - actually reset
    hardReset()
    createRootPackage()
    confirmingReset.value = false
    emit('close')
  } else {
    // First tap - enter confirmation mode
    confirmingReset.value = true
    // Auto-cancel after 3 seconds
    setTimeout(() => {
      confirmingReset.value = false
    }, 3000)
  }
}

function handleClose() {
  confirmingReset.value = false
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
            <span class="sheet-title">⚙</span>
            <button class="close-btn" @click="handleClose">×</button>
          </div>

          <!-- Settings list -->
          <div class="settings-list">
            <!-- Save button -->
            <button
              class="setting-row"
              :class="{ success: saveSuccess }"
              @click="handleSave"
            >
              <div class="setting-icon">💾</div>
              <div class="setting-indicator">
                <div class="indicator-track">
                  <div
                    class="indicator-fill"
                    :class="{ filled: saveSuccess }"
                  />
                </div>
              </div>
              <div class="setting-action" :class="{ success: saveSuccess }">
                {{ saveSuccess ? '✓' : '→' }}
              </div>
            </button>

            <!-- Reset button -->
            <button
              class="setting-row danger"
              :class="{ confirming: confirmingReset }"
              @click="handleResetClick"
            >
              <div class="setting-icon">🗑</div>
              <div class="setting-indicator">
                <div class="indicator-track danger">
                  <div
                    class="indicator-fill danger"
                    :class="{ filled: confirmingReset }"
                  />
                </div>
              </div>
              <div
                class="setting-action"
                :class="{ confirming: confirmingReset }"
              >
                {{ confirmingReset ? '!' : '→' }}
              </div>
            </button>
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
  border: 1px solid rgba(100, 100, 140, 0.3);
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
  border-bottom: 1px solid rgba(100, 100, 140, 0.2);
}

.sheet-title {
  font-size: 28px;
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
   SETTINGS LIST
   ============================================ */

.settings-list {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: rgba(40, 40, 60, 0.6);
  border: 2px solid rgba(80, 80, 100, 0.4);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  font-family: inherit;
}

.setting-row:active {
  transform: scale(0.98);
}

.setting-row.success {
  border-color: rgba(90, 255, 138, 0.5);
  background: rgba(40, 60, 50, 0.7);
}

.setting-row.danger {
  border-color: rgba(255, 100, 100, 0.3);
}

.setting-row.danger.confirming {
  border-color: rgba(255, 90, 90, 0.8);
  background: rgba(80, 30, 30, 0.7);
  animation: pulse-danger 0.5s ease infinite alternate;
}

@keyframes pulse-danger {
  from {
    box-shadow: 0 0 0 0 rgba(255, 90, 90, 0.4);
  }
  to {
    box-shadow: 0 0 12px 4px rgba(255, 90, 90, 0.3);
  }
}

/* ============================================
   SETTING ICON
   ============================================ */

.setting-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(60, 60, 80, 0.8);
  border-radius: 12px;
  font-size: 24px;
  flex-shrink: 0;
}

.setting-row.success .setting-icon {
  background: rgba(90, 255, 138, 0.15);
}

.setting-row.danger .setting-icon {
  background: rgba(255, 100, 100, 0.1);
}

.setting-row.danger.confirming .setting-icon {
  background: rgba(255, 90, 90, 0.25);
}

/* ============================================
   INDICATOR TRACK
   ============================================ */

.setting-indicator {
  flex: 1;
}

.indicator-track {
  height: 6px;
  background: rgba(60, 60, 80, 0.8);
  border-radius: 3px;
  overflow: hidden;
}

.indicator-fill {
  height: 100%;
  width: 0%;
  background: rgba(90, 255, 138, 0.6);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.indicator-fill.filled {
  width: 100%;
}

.indicator-fill.danger {
  background: rgba(255, 90, 90, 0.6);
}

/* ============================================
   ACTION BUTTON
   ============================================ */

.setting-action {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(60, 60, 80, 0.8);
  border: 2px solid rgba(100, 100, 140, 0.4);
  border-radius: 12px;
  font-size: 20px;
  font-weight: bold;
  color: #888;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.setting-action.success {
  background: rgba(40, 80, 50, 0.8);
  border-color: #5aff8a;
  color: #5aff8a;
}

.setting-action.confirming {
  background: rgba(100, 30, 30, 0.9);
  border-color: #ff5a5a;
  color: #ff5a5a;
  animation: shake 0.1s ease infinite;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-2px);
  }
  75% {
    transform: translateX(2px);
  }
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
