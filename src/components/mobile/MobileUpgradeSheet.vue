<script setup lang="ts">
/**
 * Mobile Upgrade Sheet (No-Text Version)
 *
 * Visual-only upgrade interface using icons, pips, and bars.
 *
 * ┌─────────────────────────────────────┐
 * │              +              [×]     │
 * ├─────────────────────────────────────┤
 * │ [↓]  ●●●●●○○○○○         [██░ ↓]    │
 * │ [⚡] ●●●○○○○○○○         [███ ↓]    │
 * │ [◆]  ●●○○○○○○○○         [█░░ ↓]    │
 * ├─────────────────────────────────────┤
 * │      ↓ [████████░░░░░░]             │
 * └─────────────────────────────────────┘
 */

import { computed } from 'vue'
import { gameState } from '../../game/state'
import {
  UPGRADES,
  getUpgradeLevel,
  getUpgradeCost,
  canPurchaseUpgrade,
  purchaseUpgrade,
  getUnlockedUpgrades,
} from '../../game/upgrades'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

// ============================================
// UPGRADE DATA
// ============================================

const unlockedUpgrades = computed(() => getUnlockedUpgrades())

// Get display info for each upgrade
function getUpgradeInfo(upgradeId: string) {
  const def = UPGRADES[upgradeId]
  if (!def) return null

  const level = getUpgradeLevel(upgradeId)
  const cost = getUpgradeCost(upgradeId)
  const canBuy = canPurchaseUpgrade(upgradeId)
  const isMaxed = level >= def.maxLevel

  // Cost as fraction of current bandwidth (for visual indicator)
  const costRatio = Math.min(
    1,
    cost / Math.max(1, gameState.resources.bandwidth)
  )

  return {
    id: upgradeId,
    icon: def.icon,
    level,
    maxLevel: def.maxLevel,
    cost,
    costRatio,
    canBuy,
    isMaxed,
  }
}

// Generate pip indices for an upgrade
function getPips(upgradeId: string): { filled: boolean }[] {
  const info = getUpgradeInfo(upgradeId)
  if (!info) return []

  const pips = []
  for (let i = 0; i < info.maxLevel; i++) {
    pips.push({ filled: i < info.level })
  }
  return pips
}

// ============================================
// ACTIONS
// ============================================

function handleBuy(upgradeId: string) {
  purchaseUpgrade(upgradeId)
}

function handleClose() {
  emit('close')
}

function handleBackdropClick(e: Event) {
  if (e.target === e.currentTarget) {
    handleClose()
  }
}

// ============================================
// BANDWIDTH BAR
// ============================================

const bandwidthPercent = computed(
  () => gameState.resources.bandwidth / gameState.resources.maxBandwidth
)
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="sheet-backdrop" @click="handleBackdropClick">
        <div class="sheet-container">
          <!-- Header -->
          <div class="sheet-header">
            <span class="sheet-title">+</span>
            <button class="close-btn" @click="handleClose">×</button>
          </div>

          <!-- Upgrade list -->
          <div class="upgrade-list">
            <div
              v-for="upgrade in unlockedUpgrades"
              :key="upgrade.id"
              class="upgrade-card"
              :class="{
                maxed: getUpgradeInfo(upgrade.id)?.isMaxed,
                affordable: getUpgradeInfo(upgrade.id)?.canBuy,
              }"
            >
              <!-- Icon -->
              <div class="upgrade-icon">
                {{ upgrade.icon }}
              </div>

              <!-- Level pips -->
              <div class="upgrade-pips">
                <span
                  v-for="(pip, i) in getPips(upgrade.id)"
                  :key="i"
                  class="pip"
                  :class="{ filled: pip.filled }"
                />
              </div>

              <!-- Buy button -->
              <button
                class="buy-btn"
                :class="{
                  affordable: getUpgradeInfo(upgrade.id)?.canBuy,
                  maxed: getUpgradeInfo(upgrade.id)?.isMaxed,
                }"
                :disabled="
                  !getUpgradeInfo(upgrade.id)?.canBuy ||
                  getUpgradeInfo(upgrade.id)?.isMaxed
                "
                @click="handleBuy(upgrade.id)"
              >
                <template v-if="getUpgradeInfo(upgrade.id)?.isMaxed">
                  <span class="buy-icon">✓</span>
                </template>
                <template v-else>
                  <!-- Cost bar indicator -->
                  <div class="cost-bar">
                    <div
                      class="cost-fill"
                      :style="{
                        width:
                          (getUpgradeInfo(upgrade.id)?.costRatio ?? 1) * 100 +
                          '%',
                      }"
                    />
                  </div>
                  <span class="buy-icon">↓</span>
                </template>
              </button>
            </div>

            <!-- Empty state -->
            <div v-if="unlockedUpgrades.length === 0" class="empty-state">
              <span class="empty-icon">🔒</span>
            </div>
          </div>

          <!-- Current bandwidth bar -->
          <div class="bandwidth-footer">
            <span class="bandwidth-icon">↓</span>
            <div class="bandwidth-bar">
              <div
                class="bandwidth-fill"
                :style="{ width: bandwidthPercent * 100 + '%' }"
              />
            </div>
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
  max-height: 70vh;
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
  font-weight: bold;
  color: #5affff;
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
   UPGRADE LIST
   ============================================ */

.upgrade-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.upgrade-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: rgba(40, 40, 60, 0.6);
  border: 2px solid rgba(80, 80, 100, 0.4);
  border-radius: 14px;
  transition: all 0.2s ease;
}

.upgrade-card.affordable {
  border-color: rgba(90, 255, 255, 0.4);
  background: rgba(40, 50, 60, 0.7);
}

.upgrade-card.maxed {
  opacity: 0.6;
  border-color: rgba(90, 255, 138, 0.3);
}

/* ============================================
   UPGRADE ICON
   ============================================ */

.upgrade-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(60, 60, 80, 0.8);
  border-radius: 12px;
  font-size: 22px;
  color: #888;
  flex-shrink: 0;
}

.upgrade-card.affordable .upgrade-icon {
  color: #5affff;
  background: rgba(90, 255, 255, 0.1);
}

.upgrade-card.maxed .upgrade-icon {
  color: #5aff8a;
  background: rgba(90, 255, 138, 0.1);
}

/* ============================================
   LEVEL PIPS
   ============================================ */

.upgrade-pips {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.pip {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(60, 60, 80, 0.8);
  border: 1px solid rgba(100, 100, 140, 0.3);
  transition: all 0.2s ease;
}

.pip.filled {
  background: linear-gradient(135deg, #5a8aff, #5affff);
  border-color: #5affff;
  box-shadow: 0 0 4px rgba(90, 255, 255, 0.4);
}

.upgrade-card.maxed .pip.filled {
  background: #5aff8a;
  border-color: #5aff8a;
  box-shadow: 0 0 4px rgba(90, 255, 138, 0.4);
}

/* ============================================
   BUY BUTTON
   ============================================ */

.buy-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 56px;
  height: 56px;
  padding: 8px;
  background: rgba(60, 60, 80, 0.8);
  border: 2px solid rgba(80, 80, 100, 0.5);
  border-radius: 12px;
  color: #555;
  font-family: inherit;
  cursor: not-allowed;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.buy-btn.affordable {
  background: rgba(40, 80, 80, 0.8);
  border-color: #5affff;
  color: #5affff;
  cursor: pointer;
}

.buy-btn.affordable:active {
  transform: scale(0.95);
  background: rgba(90, 255, 255, 0.2);
}

.buy-btn.maxed {
  background: rgba(40, 60, 50, 0.6);
  border-color: rgba(90, 255, 138, 0.4);
  color: #5aff8a;
  cursor: default;
}

/* Cost bar inside buy button */
.cost-bar {
  width: 32px;
  height: 6px;
  background: rgba(40, 40, 60, 0.8);
  border-radius: 3px;
  overflow: hidden;
}

.cost-fill {
  height: 100%;
  background: rgba(90, 255, 255, 0.6);
  border-radius: 3px;
  transition: width 0.2s ease;
}

.buy-btn:not(.affordable) .cost-fill {
  background: rgba(255, 90, 90, 0.6);
}

.buy-icon {
  font-size: 18px;
  font-weight: bold;
}

.buy-btn.maxed .buy-icon {
  font-size: 22px;
}

/* ============================================
   EMPTY STATE
   ============================================ */

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 40px;
  opacity: 0.4;
}

/* ============================================
   BANDWIDTH FOOTER
   ============================================ */

.bandwidth-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  background: rgba(30, 30, 50, 0.9);
  border-top: 1px solid rgba(100, 100, 140, 0.2);
}

.bandwidth-icon {
  font-size: 18px;
  color: #7a7aff;
}

.bandwidth-bar {
  flex: 1;
  height: 8px;
  background: rgba(60, 60, 80, 0.8);
  border-radius: 4px;
  overflow: hidden;
}

.bandwidth-fill {
  height: 100%;
  background: linear-gradient(to right, #5a5aff, #7a7aff);
  border-radius: 4px;
  transition: width 0.3s ease;
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
