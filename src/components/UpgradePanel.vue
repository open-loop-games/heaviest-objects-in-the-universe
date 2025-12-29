<script setup lang="ts">
import { computed } from 'vue';
import {
  getUnlockedUpgrades,
  getNextLockedUpgrade,
  getUpgradeLevel,
  getUpgradeCost,
  canPurchaseUpgrade,
  purchaseUpgrade,
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

  // Find the previous unlock threshold
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

// Get visual effect value (normalized 0-1 for display)
function getEffectFill(upgrade: UpgradeDefinition): number {
  const level = getLevel(upgrade.id);
  if (level === 0) return 0;

  switch (upgrade.effectType) {
    case 'multiplier':
      // Show as percentage of max effect
      return level / upgrade.maxLevel;
    case 'rate':
      // Show as percentage of max rate
      return level / upgrade.maxLevel;
    case 'reduction':
      // Show inverted (more reduction = more fill)
      return level / upgrade.maxLevel;
    default:
      return level / upgrade.maxLevel;
  }
}

// Check if panel should be visible (at least one upgrade unlocked or close to unlock)
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
          >
            <!-- Icon -->
            <div class="upgrade-icon">{{ upgrade.icon }}</div>

            <!-- Level + Effect visualization -->
            <div class="upgrade-visual">
              <!-- Level pips -->
              <div class="level-pips">
                <span
                  v-for="i in upgrade.maxLevel"
                  :key="i"
                  class="pip"
                  :class="{ filled: i <= getLevel(upgrade.id) }"
                ></span>
              </div>

              <!-- Effect bar -->
              <div class="effect-bar">
                <div
                  class="effect-fill"
                  :class="upgrade.effectType"
                  :style="{ width: (getEffectFill(upgrade) * 100) + '%' }"
                ></div>
              </div>
            </div>

            <!-- Cost (numbers allowed) -->
            <div class="upgrade-cost" v-if="!isMaxed(upgrade)">
              <span class="cost-icon">↓</span>
              <span class="cost-value">{{ getCost(upgrade.id) }}</span>
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
        <div class="unlock-target">{{ nextUpgrade.unlockAt }}</div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.upgrade-panel {
  position: absolute;
  right: 16px;
  top: 60px;
  width: 160px;
  background: rgba(20, 20, 30, 0.9);
  border: 1px solid #3a3a5a;
  border-radius: 8px;
  padding: 8px;
  pointer-events: auto;
}

.upgrade-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.upgrade-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: #1a1a2a;
  border-radius: 6px;
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
  font-size: 14px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2a2a3a;
  border-radius: 4px;
  flex-shrink: 0;
}

.upgrade-visual {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.level-pips {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}

.pip {
  width: 4px;
  height: 4px;
  background: #2a2a3a;
  border-radius: 1px;
}

.pip.filled {
  background: #5aff5a;
}

.effect-bar {
  height: 3px;
  background: #2a2a3a;
  border-radius: 2px;
  overflow: hidden;
}

.effect-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.2s ease-out;
}

.effect-fill.multiplier {
  background: linear-gradient(90deg, #5a7aff, #7a9aff);
}

.effect-fill.rate {
  background: linear-gradient(90deg, #5aff7a, #7affaa);
}

.effect-fill.reduction {
  background: linear-gradient(90deg, #ff7a5a, #ffaa7a);
}

.upgrade-cost {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: #7a7aff;
  flex-shrink: 0;
}

.cost-icon {
  font-size: 10px;
}

.cost-value {
  font-family: 'Courier New', monospace;
}

.upgrade-maxed {
  color: #5aff5a;
  font-size: 12px;
  flex-shrink: 0;
}

/* Next unlock teaser */
.next-unlock {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #2a2a3a;
}

.unlock-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a2a;
  border-radius: 4px;
  font-size: 12px;
  color: #5a5a7a;
  position: relative;
}

.unlock-icon.locked {
  border: 1px dashed #3a3a5a;
}

.locked-icon-bg {
  opacity: 0.3;
  filter: grayscale(100%);
  font-size: 14px;
}

.lock-overlay {
  position: absolute;
  font-size: 8px;
  bottom: -2px;
  right: -2px;
}

.unlock-progress {
  flex: 1;
  height: 4px;
  background: #1a1a2a;
  border-radius: 2px;
  overflow: hidden;
}

.unlock-fill {
  height: 100%;
  background: linear-gradient(90deg, #3a3a5a, #5a5a7a);
  border-radius: 2px;
  transition: width 0.3s ease-out;
}

.unlock-target {
  font-size: 10px;
  color: #5a5a7a;
  font-family: 'Courier New', monospace;
}

/* Panel enter/leave transition */
.panel-fade-enter-active,
.panel-fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.panel-fade-enter-from,
.panel-fade-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* Upgrade reveal transition */
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
