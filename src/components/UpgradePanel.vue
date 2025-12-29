<script setup lang="ts">
import { computed } from 'vue';
import {
  getUnlockedUpgrades,
  getNextLockedUpgrade,
  getUpgradeLevel,
  getUpgradeCost,
  canPurchaseUpgrade,
  purchaseUpgrade,
  setPreviewedUpgrade,
  type UpgradeDefinition,
} from '../game/upgrades';
import { gameState } from '../game/state';

const unlockedUpgrades = computed(() => getUnlockedUpgrades());
const nextUpgrade = computed(() => getNextLockedUpgrade());
const packageCount = computed(() => gameState.packages.size);

// Progress toward next unlock (0-1)
const unlockProgress = computed(() => {
  const next = nextUpgrade.value;
  if (!next) return 1;

  const unlocked = unlockedUpgrades.value;
  const lastUnlocked = unlocked[unlocked.length - 1];
  const prevThreshold = lastUnlocked ? lastUnlocked.unlockAt : 0;

  const current = packageCount.value;
  const range = next.unlockAt - prevThreshold;
  const progress = (current - prevThreshold) / range;
  return Math.min(1, Math.max(0, progress));
});

function getLevel(id: string): number {
  return getUpgradeLevel(id);
}

function getCost(id: string): number {
  return getUpgradeCost(id);
}

function canBuy(id: string): boolean {
  return canPurchaseUpgrade(id);
}

function isMaxed(upgrade: UpgradeDefinition): boolean {
  return getLevel(upgrade.id) >= upgrade.maxLevel;
}

function buy(id: string): void {
  purchaseUpgrade(id);
}

// Panel visible when at least one upgrade unlocked or close to first unlock
const isPanelVisible = computed(() => {
  return unlockedUpgrades.value.length > 0 || unlockProgress.value > 0.5;
});
</script>

<template>
  <Transition name="panel-fade">
    <div class="upgrade-panel" v-if="isPanelVisible">
      <!-- Unlocked upgrades -->
      <div class="upgrade-list">
        <TransitionGroup name="upgrade-reveal">
          <div
            v-for="upgrade in unlockedUpgrades"
            :key="upgrade.id"
            class="upgrade-item"
            :class="{
              affordable: canBuy(upgrade.id),
              maxed: isMaxed(upgrade),
            }"
            @click="buy(upgrade.id)"
            @mouseenter="!isMaxed(upgrade) && setPreviewedUpgrade(upgrade.id)"
            @mouseleave="setPreviewedUpgrade(null)"
          >
            <!-- Icon -->
            <div class="upgrade-icon">{{ upgrade.icon }}</div>

            <!-- Level pips -->
            <div class="upgrade-pips">
              <span
                v-for="i in upgrade.maxLevel"
                :key="i"
                class="pip"
                :class="{ filled: i <= getLevel(upgrade.id) }"
              ></span>
            </div>

            <!-- Cost bar (visual only) -->
            <div class="upgrade-cost" v-if="!isMaxed(upgrade)">
              <div class="cost-bar">
                <div
                  class="cost-fill"
                  :style="{ width: Math.min(100, (gameState.resources.bandwidth / getCost(upgrade.id)) * 100) + '%' }"
                ></div>
              </div>
            </div>

            <!-- Maxed indicator -->
            <div class="upgrade-maxed" v-else>✓</div>
          </div>
        </TransitionGroup>
      </div>

      <!-- Next unlock teaser -->
      <div class="next-unlock" v-if="nextUpgrade">
        <div class="unlock-icon locked">
          <span class="locked-icon-bg">{{ nextUpgrade.icon }}</span>
          <span class="lock-overlay">🔒</span>
        </div>
        <div class="unlock-progress">
          <div
            class="unlock-fill"
            :style="{ width: (unlockProgress * 100) + '%' }"
          ></div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.upgrade-panel {
  position: absolute;
  right: 24px;
  top: 100px;
  width: 200px;
  background: rgba(20, 20, 30, 0.9);
  border: 2px solid #3a3a5a;
  border-radius: 12px;
  padding: 12px;
  pointer-events: auto;
}

.upgrade-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.upgrade-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #1a1a2a;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s, opacity 0.15s;
  opacity: 0.4;
}

.upgrade-item.affordable {
  opacity: 1;
  background: #1a2a1a;
}

.upgrade-item.affordable:hover {
  background: #2a3a2a;
  transform: scale(1.02);
}

.upgrade-item.maxed {
  opacity: 0.6;
  cursor: default;
  background: #1a1a2a;
}

.upgrade-item.maxed:hover {
  transform: none;
}

.upgrade-icon {
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2a2a3a;
  border-radius: 8px;
  flex-shrink: 0;
}

.upgrade-pips {
  flex: 1;
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

.pip {
  width: 8px;
  height: 8px;
  background: #2a2a3a;
  border-radius: 2px;
}

.pip.filled {
  background: #5aff5a;
}

.upgrade-cost {
  flex-shrink: 0;
  width: 40px;
}

.cost-bar {
  height: 8px;
  background: #1a1a2a;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #3a3a5a;
}

.cost-fill {
  height: 100%;
  background: linear-gradient(90deg, #5a7aff, #7a9aff);
  border-radius: 3px;
  transition: width 0.15s ease-out;
}

.upgrade-maxed {
  color: #5aff5a;
  font-size: 18px;
  flex-shrink: 0;
}

/* Next unlock teaser */
.next-unlock {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #2a2a3a;
}

.unlock-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a2a;
  border-radius: 8px;
  font-size: 20px;
  color: #5a5a7a;
  position: relative;
}

.unlock-icon.locked {
  border: 2px dashed #3a3a5a;
}

.locked-icon-bg {
  opacity: 0.3;
  filter: grayscale(100%);
  font-size: 24px;
}

.lock-overlay {
  position: absolute;
  font-size: 12px;
  bottom: -3px;
  right: -3px;
}

.unlock-progress {
  flex: 1;
  height: 8px;
  background: #1a1a2a;
  border-radius: 4px;
  overflow: hidden;
}

.unlock-fill {
  height: 100%;
  background: linear-gradient(90deg, #3a3a5a, #5a5a7a);
  border-radius: 4px;
  transition: width 0.3s ease-out;
}

/* Transitions */
.panel-fade-enter-active,
.panel-fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.panel-fade-enter-from,
.panel-fade-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.upgrade-reveal-enter-active {
  transition: all 0.4s ease-out;
}

.upgrade-reveal-enter-from {
  opacity: 0;
  transform: translateX(20px) scale(0.9);
}

.upgrade-reveal-move {
  transition: transform 0.3s ease-out;
}
</style>
