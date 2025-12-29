<script setup lang="ts">
import { computed } from 'vue';
import { gameState } from '../game/state';
import {
  computed_gravity,
  computed_prestigeReward,
  computed_canPrestige,
  triggerPrestigeWithAnimation,
} from '../game/state';
import { getEffectiveInstallCost } from '../game/upgrades';

// Bandwidth bar
const bandwidthPercent = computed(() => {
  return (gameState.resources.bandwidth / gameState.resources.maxBandwidth) * 100;
});

// Heat bar
const heatPercent = computed(() => {
  return (gameState.resources.heat / gameState.resources.maxHeat) * 100;
});

// Gravity toward collapse
const gravityPercent = computed(() => {
  return Math.min(100, computed_gravity.value * 100);
});

// Install cost and affordability
const installCost = computed(() => getEffectiveInstallCost());
const canAffordInstall = computed(() => {
  return gameState.resources.bandwidth >= installCost.value;
});

// Package count
const packageCount = computed(() => gameState.packages.size);

// Weight as raw number (no units)
const weightValue = computed(() => {
  const w = gameState.resources.weight * 1024; // Convert to bytes
  if (w < 1000) return Math.floor(w);
  if (w < 1000000) return Math.floor(w / 1000);
  if (w < 1000000000) return Math.floor(w / 1000000);
  return Math.floor(w / 1000000000);
});

// Weight scale indicator (which magnitude we're at)
const weightScale = computed(() => {
  const w = gameState.resources.weight * 1024;
  if (w < 1000) return 0;        // B
  if (w < 1000000) return 1;     // K
  if (w < 1000000000) return 2;  // M
  return 3;                       // G
});

// Efficiency as visual (0-1)
const efficiencyValue = computed(() => {
  return gameState.stats.currentEfficiency;
});

// Show prestige area when gravity is building
const showPrestigeArea = computed(() => {
  return gravityPercent.value > 30;
});

function handlePrestige() {
  if (computed_canPrestige.value) {
    triggerPrestigeWithAnimation();
  }
}
</script>

<template>
  <div class="hud">
    <!-- Top bar: Resources -->
    <div class="hud-top">
      <!-- Bandwidth -->
      <div class="resource-bar">
        <div class="bar-icon">↓</div>
        <div class="bar-container">
          <div
            class="bar-fill bandwidth"
            :style="{ width: bandwidthPercent + '%' }"
          ></div>
        </div>
        <div class="bar-value">{{ Math.floor(gameState.resources.bandwidth) }}</div>
      </div>

      <!-- Weight with scale indicator -->
      <div class="weight-display">
        <div class="weight-icon">◆</div>
        <div class="weight-value">{{ weightValue }}</div>
        <div class="weight-scale">
          <span class="scale-dot" :class="{ active: weightScale >= 0 }"></span>
          <span class="scale-dot" :class="{ active: weightScale >= 1 }"></span>
          <span class="scale-dot" :class="{ active: weightScale >= 2 }"></span>
          <span class="scale-dot" :class="{ active: weightScale >= 3 }"></span>
        </div>
      </div>

      <!-- Package Count -->
      <div class="resource-display">
        <div class="display-icon">□</div>
        <div class="display-value">{{ packageCount }}</div>
      </div>

      <!-- Heat -->
      <div class="resource-bar">
        <div class="bar-icon heat-icon" :class="{ hot: heatPercent > 50 }">●</div>
        <div class="bar-container small">
          <div
            class="bar-fill heat"
            :style="{ width: heatPercent + '%' }"
          ></div>
        </div>
      </div>

      <!-- Cache Tokens (meta) -->
      <div class="resource-display meta" v-if="gameState.meta.cacheTokens > 0">
        <div class="display-icon">⟲</div>
        <div class="display-value">{{ gameState.meta.cacheTokens }}</div>
      </div>
    </div>

    <!-- Bottom bar: Actions & Status -->
    <div class="hud-bottom">
      <!-- Install cost indicator -->
      <div class="action-cost" :class="{ affordable: canAffordInstall }">
        <span class="cost-icon">↓</span>
        <span class="cost-value">{{ installCost }}</span>
      </div>

      <!-- Efficiency indicator -->
      <div class="efficiency-display">
        <div class="efficiency-icon">⚡</div>
        <div class="efficiency-bar">
          <div
            class="efficiency-fill"
            :style="{ width: (efficiencyValue * 100) + '%' }"
            :class="{
              good: efficiencyValue > 0.8,
              warn: efficiencyValue <= 0.8 && efficiencyValue > 0.5,
              bad: efficiencyValue <= 0.5
            }"
          ></div>
        </div>
        <div class="efficiency-value">{{ Math.round(efficiencyValue * 100) }}</div>
      </div>

      <!-- Gravity / Collapse warning -->
      <Transition name="fade">
        <div class="gravity-area" v-if="showPrestigeArea">
          <div class="gravity-indicator">
            <div class="gravity-icon" :class="{ danger: gravityPercent > 70 }">◉</div>
            <div class="gravity-bar">
              <div
                class="gravity-fill"
                :style="{ width: gravityPercent + '%' }"
                :class="{ warning: gravityPercent > 50, danger: gravityPercent > 80 }"
              ></div>
            </div>
          </div>

          <!-- Prestige button -->
          <button
            class="prestige-btn"
            :class="{ ready: computed_canPrestige }"
            :disabled="!computed_canPrestige"
            @click="handlePrestige"
          >
            <span class="prestige-icon">★</span>
            <span class="prestige-reward" v-if="computed_prestigeReward > 0">
              +{{ computed_prestigeReward }}
            </span>
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  font-family: 'Courier New', monospace;
  color: #eeeeff;
}

.hud-top {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  display: flex;
  gap: 20px;
  align-items: center;
}

.hud-bottom {
  position: absolute;
  bottom: 16px;
  left: 16px;
  right: 16px;
  display: flex;
  gap: 20px;
  align-items: center;
}

/* Resource bars */
.resource-bar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bar-icon {
  font-size: 14px;
  width: 18px;
  text-align: center;
  color: #7a7aff;
}

.bar-icon.heat-icon {
  color: #888;
  transition: color 0.3s;
}

.bar-icon.heat-icon.hot {
  color: #ff7a5a;
}

.bar-container {
  width: 100px;
  height: 6px;
  background: #2a2a3a;
  border-radius: 3px;
  overflow: hidden;
}

.bar-container.small {
  width: 60px;
}

.bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.1s ease-out;
}

.bar-fill.bandwidth {
  background: linear-gradient(90deg, #5a5aff, #7a7aff);
}

.bar-fill.heat {
  background: linear-gradient(90deg, #ff5a5a, #ffaa5a);
}

.bar-value {
  font-size: 12px;
  min-width: 36px;
  color: #aaaacc;
}

/* Weight display */
.weight-display {
  display: flex;
  align-items: center;
  gap: 6px;
}

.weight-icon {
  font-size: 14px;
  color: #ffaa5a;
}

.weight-value {
  font-size: 14px;
  font-weight: bold;
  min-width: 40px;
}

.weight-scale {
  display: flex;
  gap: 2px;
  align-items: center;
}

.scale-dot {
  width: 4px;
  height: 4px;
  background: #2a2a3a;
  border-radius: 50%;
  transition: background 0.3s;
}

.scale-dot.active {
  background: #ffaa5a;
}

/* Resource displays */
.resource-display {
  display: flex;
  align-items: center;
  gap: 4px;
}

.resource-display.meta {
  margin-left: auto;
  color: #5affff;
}

.display-icon {
  font-size: 12px;
}

.display-value {
  font-size: 13px;
  font-weight: bold;
}

/* Action cost */
.action-cost {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #2a2a3a;
  border-radius: 4px;
  opacity: 0.4;
  pointer-events: auto;
  transition: opacity 0.15s, background 0.15s;
}

.action-cost.affordable {
  opacity: 1;
  background: #1a3a1a;
}

.cost-icon {
  font-size: 12px;
  color: #7a7aff;
}

.cost-value {
  font-size: 12px;
}

/* Efficiency display */
.efficiency-display {
  display: flex;
  align-items: center;
  gap: 6px;
}

.efficiency-icon {
  font-size: 12px;
  color: #7aff7a;
}

.efficiency-bar {
  width: 50px;
  height: 4px;
  background: #2a2a3a;
  border-radius: 2px;
  overflow: hidden;
}

.efficiency-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease-out;
}

.efficiency-fill.good {
  background: #5aff5a;
}

.efficiency-fill.warn {
  background: #ffaa5a;
}

.efficiency-fill.bad {
  background: #ff5a5a;
}

.efficiency-value {
  font-size: 11px;
  color: #aaaacc;
  min-width: 20px;
}

/* Gravity / Prestige area */
.gravity-area {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.gravity-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.gravity-icon {
  font-size: 14px;
  color: #7a5aff;
  transition: color 0.3s;
}

.gravity-icon.danger {
  color: #ff5a5a;
  animation: pulse 0.5s ease-in-out infinite alternate;
}

.gravity-bar {
  width: 80px;
  height: 5px;
  background: #2a2a3a;
  border-radius: 3px;
  overflow: hidden;
}

.gravity-fill {
  height: 100%;
  background: #7a5aff;
  border-radius: 3px;
  transition: width 0.3s ease-out;
}

.gravity-fill.warning {
  background: #ffaa5a;
}

.gravity-fill.danger {
  background: #ff5a5a;
  animation: pulse 0.5s ease-in-out infinite alternate;
}

@keyframes pulse {
  from { opacity: 0.7; }
  to { opacity: 1; }
}

/* Prestige button */
.prestige-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #2a2a3a;
  border: 1px solid #3a3a5a;
  border-radius: 6px;
  color: #888;
  font-family: inherit;
  font-size: 13px;
  cursor: not-allowed;
  pointer-events: auto;
  transition: all 0.2s;
}

.prestige-btn.ready {
  background: linear-gradient(135deg, #5a3a7a, #7a5aff);
  border-color: #7a5aff;
  color: #fff;
  cursor: pointer;
}

.prestige-btn.ready:hover {
  transform: scale(1.05);
  box-shadow: 0 0 12px rgba(122, 90, 255, 0.4);
}

.prestige-icon {
  font-size: 14px;
}

.prestige-reward {
  font-weight: bold;
  font-size: 12px;
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
