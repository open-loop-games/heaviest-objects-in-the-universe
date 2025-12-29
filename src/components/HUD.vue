<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { gameState, computed_gravity, computed_prestigeReward, computed_canPrestige } from '../game/state';
import { isInPackageScope } from '../game/scope';
import { triggerPrestigeWithAnimation, softReset, hardReset } from '../game/mutations';
import { saveToLocalStorage } from '../game/persistence';
import { createRootPackage, exitPackageScope, getInternalStats } from '../game/packages';
import { setCameraTarget } from '../game/loop';
import { calculateStabilityRatio } from '../game/formulas';
import {
  getEffectiveInstallCost,
  previewedUpgradeId,
  getPreviewBandwidth,
  getPreviewEfficiency,
} from '../game/upgrades';

// Staged HUD visibility (progressive disclosure)
const showBandwidth = computed(() => gameState.onboarding.firstClickComplete);
const showWeight = computed(() => gameState.packages.size >= 8);
const showCacheTokens = computed(() => gameState.onboarding.firstPrestigeComplete || gameState.meta.cacheTokens > 0);

// ============================================
// SCOPE NAVIGATION
// ============================================

// Check if we're inside a package scope
const inPackageScope = computed(() => isInPackageScope());

// Get the current scope package's internal state
const scopePackageState = computed(() => {
  if (!inPackageScope.value) return null;
  const pkg = gameState.packages.get(gameState.currentScope);
  return pkg?.internalState || null;
});

// Is the current scope stable (ready to exit with satisfaction)?
const isScopeStable = computed(() => scopePackageState.value === 'stable');

// Internal stats for the current scope
const scopeStats = computed(() => {
  if (!inPackageScope.value) return { conflicts: 0, duplicates: 0 };
  return getInternalStats(gameState.currentScope);
});

function handleBackClick() {
  // Get the current scope package position before exiting
  const scopePkg = gameState.packages.get(gameState.currentScope);
  const targetX = scopePkg?.position.x ?? 0;
  const targetY = scopePkg?.position.y ?? 0;

  // Exit the scope
  exitPackageScope();

  // Smooth camera transition to the package we just exited
  setCameraTarget(targetX, targetY);
}

// Bandwidth bar
const bandwidthPercent = computed(() => {
  return (gameState.resources.bandwidth / gameState.resources.maxBandwidth) * 100;
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

// Cost as percentage of max bandwidth (for ghost segment)
const costPercent = computed(() => {
  return (installCost.value / gameState.resources.maxBandwidth) * 100;
});

// Weight scale indicator (which magnitude we're at)
const weightScale = computed(() => {
  const w = gameState.resources.weight * 1024;
  if (w < 1000) return 0;        // B
  if (w < 1000000) return 1;     // K
  if (w < 1000000000) return 2;  // M
  return 3;                       // G
});

// How far through current magnitude (0-1) for icon scaling
const weightFillPercent = computed(() => {
  const w = gameState.resources.weight * 1024;
  if (w < 1000) return w / 1000;
  if (w < 1000000) return (w - 1000) / (1000000 - 1000);
  if (w < 1000000000) return (w - 1000000) / (1000000000 - 1000000);
  return Math.min(1, (w - 1000000000) / 1000000000);
});

// Efficiency as visual (0-1)
const efficiencyValue = computed(() => {
  return gameState.stats.currentEfficiency;
});

// Show efficiency after enough packages (progressive disclosure)
const showEfficiency = computed(() => {
  return gameState.packages.size >= 8;
});

// ============================================
// THRESHOLD WARNINGS
// ============================================

// Bandwidth warning: can't afford next install
const bandwidthWarning = computed(() => {
  if (!canAffordInstall.value) return 'critical'; // Can't click
  if (bandwidthPercent.value < 30) return 'low';  // Getting low
  return null;
});

// Efficiency warning: too many duplicates
const efficiencyWarning = computed(() => {
  if (efficiencyValue.value <= 0.3) return 'critical';  // Very bad
  if (efficiencyValue.value <= 0.5) return 'low';       // Needs attention
  return null;
});

// Gravity ready: can prestige
const gravityReady = computed(() => computed_canPrestige.value);

// Weight milestone: approaching next magnitude
const weightMilestone = computed(() => {
  // Pulse when close to next magnitude threshold
  return weightFillPercent.value > 0.8;
});

// ============================================
// UPGRADE PREVIEW VISUALIZATIONS
// ============================================

// Check if a specific upgrade is being previewed
const isPreviewingBandwidth = computed(() => previewedUpgradeId.value === 'bandwidth');
const isPreviewingEfficiency = computed(() => previewedUpgradeId.value === 'efficiency');
const isPreviewingAny = computed(() => previewedUpgradeId.value !== null);

// Bandwidth preview: show ghost extension of the bar (capacity increase)
const bandwidthPreview = computed(() => {
  if (!isPreviewingBandwidth.value) return null;
  const preview = getPreviewBandwidth();
  // Calculate how much the bar would extend with new max
  const previewMaxPercent = (preview.currentValue / preview.previewValue) * 100;
  return {
    currentBarScaleX: previewMaxPercent / 100,
    extensionWidth: 100 - previewMaxPercent,
  };
});

// Efficiency preview: show smaller cost ghost segment
const efficiencyPreview = computed(() => {
  if (!isPreviewingEfficiency.value) return null;
  const preview = getPreviewEfficiency();
  const currentCostPercent = (preview.current / gameState.resources.maxBandwidth) * 100;
  const previewCostPercent = (preview.preview / gameState.resources.maxBandwidth) * 100;
  return {
    currentCostPercent,
    previewCostPercent,
    savings: currentCostPercent - previewCostPercent,
  };
});

// Show prestige area when gravity is building
const showPrestigeArea = computed(() => {
  return gravityPercent.value > 20;
});

// Orbital decay visualization - orbit shrinks and speeds up as weight grows
const orbitRadius = computed(() => {
  // Start at 40px, shrink to 8px as gravity approaches 100%
  const progress = gravityPercent.value / 100;
  return Math.max(8, 40 - progress * 32);
});

const orbitSpeed = computed(() => {
  // Start at 8s per rotation, speed up to 0.5s at max
  const progress = gravityPercent.value / 100;
  return Math.max(0.5, 8 - progress * 7.5);
});

const orbitCount = computed(() => {
  // More orbiters as weight grows (3-6 based on progress)
  const progress = gravityPercent.value / 100;
  return Math.min(6, Math.max(3, Math.floor(3 + progress * 3)));
});

// Prestige reward as visual dots (1-5 based on reward amount)
const prestigeRewardDots = computed(() => {
  const reward = computed_prestigeReward.value;
  if (reward <= 0) return 0;
  if (reward <= 1) return 1;
  if (reward <= 3) return 2;
  if (reward <= 5) return 3;
  if (reward <= 10) return 4;
  return 5;
});

// Stability ratio for prestige quality
const stabilityValue = computed(() => {
  return calculateStabilityRatio(gameState);
});

// Reward quality tier based on efficiency (for token styling)
const rewardQuality = computed(() => {
  const eff = efficiencyValue.value;
  if (eff >= 0.8) return 'excellent';  // Bright glow
  if (eff >= 0.5) return 'good';       // Normal
  if (eff >= 0.3) return 'poor';       // Faded
  return 'terrible';                    // Very faded, shaky
});

// Arc percentages for SVG (0-100 for stroke-dasharray)
const efficiencyArcPercent = computed(() => efficiencyValue.value * 100);
const stabilityArcPercent = computed(() => stabilityValue.value * 100);

// Show quality indicators after first conflict or symlink opportunity
const showQualityIndicators = computed(() => {
  return gameState.onboarding.firstConflictSeen ||
         gameState.stats.totalSymlinksCreated > 0 ||
         gameState.packages.size >= 10;
});

function handlePrestige() {
  if (computed_canPrestige.value) {
    triggerPrestigeWithAnimation();
  }
}

// Settings panel state
const showSettings = ref(false);
const showSaveFlash = ref(false);

// Hard reset hold state
const hardResetProgress = ref(0);
let hardResetInterval: ReturnType<typeof setInterval> | null = null;
const HARD_RESET_HOLD_DURATION = 2000; // 2 seconds to hard reset

function handleSave() {
  saveToLocalStorage();
  // Flash the save button to confirm
  showSaveFlash.value = true;
  setTimeout(() => {
    showSaveFlash.value = false;
  }, 500);
}

function toggleSettings() {
  showSettings.value = !showSettings.value;
  // Reset hard reset progress when closing
  if (!showSettings.value) {
    cancelHardReset();
  }
}

function handleSoftReset() {
  softReset();
  createRootPackage();
  showSettings.value = false;
}

function startHardReset() {
  if (hardResetInterval) return;

  const startTime = Date.now();
  hardResetInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    hardResetProgress.value = Math.min(1, elapsed / HARD_RESET_HOLD_DURATION);

    if (hardResetProgress.value >= 1) {
      cancelHardReset();
      hardReset();
      createRootPackage();
      showSettings.value = false;
    }
  }, 16);
}

function cancelHardReset() {
  if (hardResetInterval) {
    clearInterval(hardResetInterval);
    hardResetInterval = null;
  }
  hardResetProgress.value = 0;
}

// Cleanup on unmount
onUnmounted(() => {
  cancelHardReset();
});
</script>

<template>
  <div class="hud">
    <!-- Top left: Scope navigation (back button) -->
    <Transition name="scope-nav">
      <div class="hud-top-left" v-if="inPackageScope">
        <button
          class="back-btn"
          :class="{
            stable: isScopeStable,
            unstable: scopePackageState === 'unstable',
          }"
          @click="handleBackClick"
        >
          <span class="back-icon">←</span>
          <!-- Show conflict/duplicate indicators if unstable -->
          <div class="scope-status" v-if="scopePackageState === 'unstable'">
            <span class="status-dot conflict" v-for="i in Math.min(scopeStats.conflicts, 3)" :key="'c'+i">!</span>
            <span class="status-dot duplicate" v-for="i in Math.min(scopeStats.duplicates, 3)" :key="'d'+i">◎</span>
          </div>
          <!-- Stable checkmark -->
          <span class="stable-check" v-if="isScopeStable">✓</span>
        </button>
      </div>
    </Transition>

    <!-- Top bar: Resources (staged reveal) -->
    <div class="hud-top">
      <!-- Bandwidth with install cost ghost (reveals after first click) -->
      <Transition name="hud-reveal">
        <div class="resource-bar" v-if="showBandwidth" :class="{ 'preview-active': isPreviewingAny }">
          <div class="bar-icon" :class="{ 'bw-preview': isPreviewingBandwidth, 'warning-low': bandwidthWarning === 'low', 'warning-critical': bandwidthWarning === 'critical' }">↓</div>
          <div
            class="bar-container"
            :class="{ 'max-preview': isPreviewingBandwidth, 'warning-low': bandwidthWarning === 'low', 'warning-critical': bandwidthWarning === 'critical' }"
          >
            <div
              class="bar-fill bandwidth"
              :class="{ 'bw-preview': isPreviewingBandwidth }"
              :style="{ width: bandwidthPercent + '%' }"
            ></div>
            <!-- Normal cost ghost (hides during efficiency preview) -->
            <div
              v-if="!isPreviewingEfficiency"
              class="bar-ghost"
              :class="{ unaffordable: !canAffordInstall }"
              :style="{
                left: Math.max(0, bandwidthPercent - costPercent) + '%',
                width: Math.min(costPercent, bandwidthPercent) + '%'
              }"
            ></div>
            <!-- Efficiency preview: show current and smaller preview cost -->
            <template v-if="isPreviewingEfficiency && efficiencyPreview">
              <!-- Current cost (faded) -->
              <div
                class="bar-ghost cost-preview-current"
                :style="{
                  left: Math.max(0, bandwidthPercent - efficiencyPreview.currentCostPercent) + '%',
                  width: Math.min(efficiencyPreview.currentCostPercent, bandwidthPercent) + '%'
                }"
              ></div>
              <!-- Preview cost (brighter, smaller) -->
              <div
                class="bar-ghost cost-preview-new"
                :style="{
                  left: Math.max(0, bandwidthPercent - efficiencyPreview.previewCostPercent) + '%',
                  width: Math.min(efficiencyPreview.previewCostPercent, bandwidthPercent) + '%'
                }"
              ></div>
            </template>
            <!-- Bandwidth preview: ghost extension showing capacity increase -->
            <div
              v-if="isPreviewingBandwidth && bandwidthPreview"
              class="bar-extension-preview"
              :style="{ width: bandwidthPreview.extensionWidth + '%' }"
            ></div>
          </div>
          <!-- Bandwidth preview indicator (regen + capacity) -->
          <div v-if="isPreviewingBandwidth" class="regen-preview-indicator">
            <span class="regen-arrow">↓</span>
            <span class="regen-arrow delayed">↓</span>
          </div>
        </div>
      </Transition>

      <!-- Weight with scaling icon + magnitude dots (reveals at 8+ packages) -->
      <Transition name="hud-reveal">
        <div class="weight-display" :class="{ 'milestone-near': weightMilestone }" v-if="showWeight">
          <div
            class="weight-icon"
            :class="{ 'milestone-pulse': weightMilestone }"
            :style="{ transform: `scale(${1 + weightFillPercent * 0.5})` }"
          >◆</div>
          <div class="weight-scale">
            <span class="scale-dot" :class="{ active: weightScale >= 0 }"></span>
            <span class="scale-dot" :class="{ active: weightScale >= 1 }"></span>
            <span class="scale-dot" :class="{ active: weightScale >= 2 }"></span>
            <span class="scale-dot" :class="{ active: weightScale >= 3 }"></span>
          </div>
        </div>
      </Transition>

      <!-- Cache Tokens (meta) - reveals after first prestige -->
      <Transition name="hud-reveal">
        <div class="cache-display" v-if="showCacheTokens && gameState.meta.cacheTokens > 0">
          <span
            v-for="i in Math.min(gameState.meta.cacheTokens, 5)"
            :key="i"
            class="cache-token"
          >⟲</span>
          <span v-if="gameState.meta.cacheTokens > 5" class="cache-more">⋯</span>
        </div>
      </Transition>
    </div>

    <!-- Top right: Save & Settings -->
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
          <button
            class="reset-btn soft-reset"
            @click="handleSoftReset"
          >
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

    <!-- Bottom bar: Actions & Status -->
    <div class="hud-bottom">
      <!-- Install affordability indicator (icon only) -->
      <div
        class="install-indicator"
        :class="{
          affordable: canAffordInstall,
          'efficiency-preview': isPreviewingEfficiency,
        }"
      >
        <span class="install-icon">↓</span>
        <!-- Efficiency preview: show lightning bolt -->
        <span v-if="isPreviewingEfficiency" class="efficiency-preview-icon">⚡</span>
      </div>

      <!-- Efficiency indicator (progressive disclosure after 8+ packages) -->
      <Transition name="fade">
        <div class="efficiency-display" :class="{ 'efficiency-warning': efficiencyWarning === 'low', 'efficiency-critical': efficiencyWarning === 'critical' }" v-if="showEfficiency">
          <div class="efficiency-icon" :class="{ 'efficiency-warn-icon': efficiencyWarning }">⚡</div>
          <div class="efficiency-bar" :class="{ 'efficiency-warn-bar': efficiencyWarning }">
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
        </div>
      </Transition>

      <!-- Orbital Decay - Prestige Visualization -->
      <Transition name="fade">
        <div class="orbital-decay" :class="{ ready: gravityReady }" v-if="showPrestigeArea">
          <!-- Orbiting weight icons -->
          <div class="orbit-container" :class="{ collapsed: gravityReady }">
            <div
              class="orbit-ring"
              :style="{
                '--orbit-radius': orbitRadius + 'px',
                '--orbit-speed': orbitSpeed + 's'
              }"
            >
              <span
                v-for="i in orbitCount"
                :key="i"
                class="orbiter"
                :style="{ '--orbit-index': i }"
              >◆</span>
            </div>

            <!-- Quality arcs around singularity (Option B) -->
            <svg
              v-if="showQualityIndicators"
              class="quality-arcs"
              viewBox="0 0 100 100"
            >
              <!-- Efficiency arc (inner, cyan) -->
              <circle
                class="arc-track"
                cx="50" cy="50" r="38"
              />
              <circle
                class="arc-fill efficiency-arc"
                :class="{ low: efficiencyValue < 0.5 }"
                cx="50" cy="50" r="38"
                :stroke-dasharray="`${efficiencyArcPercent * 2.39} 239`"
              />
              <!-- Stability arc (outer, green) -->
              <circle
                class="arc-track"
                cx="50" cy="50" r="46"
              />
              <circle
                class="arc-fill stability-arc"
                :class="{ low: stabilityValue < 0.7 }"
                cx="50" cy="50" r="46"
                :stroke-dasharray="`${stabilityArcPercent * 2.89} 289`"
              />
            </svg>

            <!-- Central singularity -->
            <button
              class="singularity"
              :class="{ active: gravityReady, pulsing: gravityPercent > 70 }"
              :disabled="!gravityReady"
              @click="handlePrestige"
            >
              <span class="singularity-core">●</span>
              <span class="event-horizon" v-if="gravityReady"></span>
            </button>
          </div>

          <!-- Cache token reward preview (Option A - quality styling) -->
          <div
            class="reward-preview"
            :class="[rewardQuality, { visible: gravityReady && computed_prestigeReward > 0 }]"
            v-if="showPrestigeArea"
          >
            <span
              v-for="i in Math.min(prestigeRewardDots, 5)"
              :key="i"
              class="reward-token"
              :class="rewardQuality"
            >⟲</span>
            <!-- Empty slots to show potential -->
            <span
              v-for="i in Math.max(0, 5 - prestigeRewardDots)"
              :key="'empty-' + i"
              class="reward-token empty"
            >⟲</span>
          </div>
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
  top: 24px;
  left: 24px;
  right: 24px;
  display: flex;
  gap: 30px;
  align-items: center;
}

.hud-bottom {
  position: absolute;
  bottom: 24px;
  left: 24px;
  right: 24px;
  display: flex;
  gap: 30px;
  align-items: center;
}

/* Resource bars */
.resource-bar {
  display: flex;
  align-items: center;
  gap: 9px;
}

.bar-icon {
  font-size: 21px;
  width: 27px;
  text-align: center;
  color: #7a7aff;
}

.bar-container {
  position: relative;
  width: 150px;
  height: 9px;
  background: #2a2a3a;
  border-radius: 5px;
  overflow: hidden;
}

.bar-container.small {
  width: 90px;
}

.bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.1s ease-out;
}

.bar-fill.bandwidth {
  background: linear-gradient(90deg, #5a5aff, #7a7aff);
}

/* Ghost segment showing install cost */
.bar-ghost {
  position: absolute;
  top: 0;
  height: 100%;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 5px;
  transition: left 0.1s, width 0.1s;
}

.bar-ghost.unaffordable {
  background: rgba(255, 90, 90, 0.4);
}

/* Weight display */
.weight-display {
  display: flex;
  align-items: center;
  gap: 9px;
}

.weight-icon {
  font-size: 21px;
  color: #ffaa5a;
  transition: transform 0.3s ease-out;
}

.weight-scale {
  display: flex;
  gap: 3px;
  align-items: center;
}

.scale-dot {
  width: 6px;
  height: 6px;
  background: #2a2a3a;
  border-radius: 50%;
  transition: background 0.3s;
}

.scale-dot.active {
  background: #ffaa5a;
}

/* Cache tokens display */
.cache-display {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
}

.cache-token {
  font-size: 18px;
  color: #5affff;
}

.cache-more {
  font-size: 15px;
  color: #5affff;
  opacity: 0.6;
}

/* Install indicator */
.install-indicator {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  background: #2a2a3a;
  border-radius: 6px;
  opacity: 0.4;
  transition: opacity 0.15s, background 0.15s;
}

.install-indicator.affordable {
  opacity: 1;
  background: #1a3a1a;
}

.install-icon {
  font-size: 21px;
  color: #7a7aff;
}

/* Efficiency display */
.efficiency-display {
  display: flex;
  align-items: center;
  gap: 9px;
}

.efficiency-icon {
  font-size: 18px;
  color: #7aff7a;
}

.efficiency-bar {
  width: 75px;
  height: 6px;
  background: #2a2a3a;
  border-radius: 3px;
  overflow: hidden;
}

.efficiency-fill {
  height: 100%;
  border-radius: 3px;
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

/* Orbital Decay - Prestige Visualization */
.orbital-decay {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
  padding: 8px 16px;
  background: rgba(30, 20, 50, 0.6);
  border-radius: 12px;
  border: 1px solid rgba(122, 90, 255, 0.2);
}

.orbital-decay.ready {
  border-color: rgba(122, 90, 255, 0.6);
  box-shadow: 0 0 20px rgba(122, 90, 255, 0.3);
}

.orbit-container {
  position: relative;
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.orbit-ring {
  position: absolute;
  width: calc(var(--orbit-radius) * 2);
  height: calc(var(--orbit-radius) * 2);
  animation: orbit-spin var(--orbit-speed) linear infinite;
}

.orbiter {
  position: absolute;
  font-size: 14px;
  color: #7a5aff;
  text-shadow: 0 0 8px rgba(122, 90, 255, 0.8);
  /* Distribute orbiters evenly around the circle */
  --angle: calc(360deg / 6 * var(--orbit-index));
  left: 50%;
  top: 50%;
  transform:
    rotate(var(--angle))
    translateX(var(--orbit-radius))
    rotate(calc(-1 * var(--angle)));
}

.orbit-container.collapsed .orbiter {
  animation: collapse-in 0.5s ease-in forwards;
}

@keyframes orbit-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes collapse-in {
  to {
    transform: rotate(var(--angle)) translateX(0) rotate(calc(-1 * var(--angle)));
    opacity: 0;
  }
}

/* Central singularity (black hole / prestige button) */
.singularity {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: radial-gradient(circle, #1a1a2e 0%, #0a0a15 70%);
  border: 2px solid #3a3a5a;
  cursor: not-allowed;
  pointer-events: auto;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.singularity-core {
  font-size: 18px;
  color: #5a5a7a;
  transition: all 0.3s;
}

.singularity.pulsing {
  animation: singularity-pulse 0.8s ease-in-out infinite;
}

.singularity.pulsing .singularity-core {
  color: #ff7a5a;
}

.singularity.active {
  cursor: pointer;
  border-color: #7a5aff;
  box-shadow:
    0 0 20px rgba(122, 90, 255, 0.6),
    inset 0 0 15px rgba(122, 90, 255, 0.3);
}

.singularity.active .singularity-core {
  color: #fff;
  text-shadow: 0 0 10px #fff;
}

.singularity.active:hover {
  transform: scale(1.1);
  box-shadow:
    0 0 30px rgba(122, 90, 255, 0.8),
    inset 0 0 20px rgba(122, 90, 255, 0.5);
}

/* Event horizon ring effect when ready */
.event-horizon {
  position: absolute;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 2px solid rgba(122, 90, 255, 0.6);
  animation: event-horizon-pulse 1.5s ease-out infinite;
}

@keyframes singularity-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

@keyframes event-horizon-pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

/* ============================================
   QUALITY ARCS (Option B)
   ============================================ */
.quality-arcs {
  position: absolute;
  width: 100px;
  height: 100px;
  transform: rotate(-90deg); /* Start arcs from top */
  pointer-events: none;
}

.arc-track {
  fill: none;
  stroke: rgba(60, 60, 80, 0.4);
  stroke-width: 3;
}

.arc-fill {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dasharray 0.5s ease-out, stroke 0.3s ease;
}

/* Efficiency arc - cyan/blue */
.efficiency-arc {
  stroke: #5affff;
  filter: drop-shadow(0 0 4px rgba(90, 255, 255, 0.6));
}

.efficiency-arc.low {
  stroke: #ffaa5a;
  filter: drop-shadow(0 0 4px rgba(255, 170, 90, 0.6));
  animation: arc-warn-pulse 1s ease-in-out infinite;
}

/* Stability arc - green */
.stability-arc {
  stroke: #5aff8a;
  filter: drop-shadow(0 0 4px rgba(90, 255, 138, 0.6));
}

.stability-arc.low {
  stroke: #ff8a5a;
  filter: drop-shadow(0 0 4px rgba(255, 138, 90, 0.6));
}

@keyframes arc-warn-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* ============================================
   REWARD TOKEN QUALITY (Option A)
   ============================================ */
.reward-preview {
  display: flex;
  flex-direction: row;
  gap: 4px;
  align-items: center;
  min-height: 24px;
  opacity: 0.3;
  transition: opacity 0.3s ease;
}

.reward-preview.visible {
  opacity: 1;
}

.reward-token {
  font-size: 16px;
  color: #5affff;
  text-shadow: 0 0 6px rgba(90, 255, 255, 0.6);
  animation: reward-float 1s ease-in-out infinite alternate;
  transition: all 0.3s ease;
}

/* Empty token slots (potential rewards) */
.reward-token.empty {
  color: rgba(90, 255, 255, 0.15);
  text-shadow: none;
  animation: none;
}

/* Excellent quality - bright glow */
.reward-token.excellent {
  color: #5affff;
  text-shadow:
    0 0 8px rgba(90, 255, 255, 0.8),
    0 0 16px rgba(90, 255, 255, 0.4);
  animation: reward-float 1s ease-in-out infinite alternate,
             reward-glow 2s ease-in-out infinite;
}

/* Good quality - normal */
.reward-token.good {
  color: #5affff;
  text-shadow: 0 0 6px rgba(90, 255, 255, 0.6);
}

/* Poor quality - faded */
.reward-token.poor {
  color: rgba(90, 255, 255, 0.5);
  text-shadow: 0 0 3px rgba(90, 255, 255, 0.3);
}

/* Terrible quality - very faded, shaky */
.reward-token.terrible {
  color: rgba(255, 170, 90, 0.4);
  text-shadow: none;
  animation: reward-shake 0.1s linear infinite;
}

.reward-token:nth-child(2) { animation-delay: 0.1s; }
.reward-token:nth-child(3) { animation-delay: 0.2s; }
.reward-token:nth-child(4) { animation-delay: 0.3s; }
.reward-token:nth-child(5) { animation-delay: 0.4s; }

@keyframes reward-float {
  from { transform: translateY(0); }
  to { transform: translateY(-3px); }
}

@keyframes reward-glow {
  0%, 100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.3);
  }
}

@keyframes reward-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-1px); }
  75% { transform: translateX(1px); }
}

@keyframes pulse {
  from { opacity: 0.7; }
  to { opacity: 1; }
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

/* HUD reveal transition (staged disclosure) */
.hud-reveal-enter-active {
  transition: all 0.4s ease-out;
}

.hud-reveal-leave-active {
  transition: all 0.2s ease-in;
}

.hud-reveal-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.9);
}

.hud-reveal-leave-to {
  opacity: 0;
}

/* Top right: Save & Settings */
.hud-top-right {
  position: absolute;
  top: 24px;
  right: 24px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  pointer-events: auto;
  z-index: 200;
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

/* ============================================
   UPGRADE PREVIEW STYLES
   ============================================ */

/* General preview active state */
.preview-active {
  position: relative;
}

/* Max bandwidth preview: container expands to show new potential */
.bar-container.max-preview {
  position: relative;
  overflow: visible;
}

/* Ghost extension showing new max capacity */
.bar-extension-preview {
  position: absolute;
  top: 0;
  right: -2px;
  transform: translateX(100%);
  height: 100%;
  background: linear-gradient(90deg, rgba(90, 255, 150, 0.3), rgba(90, 255, 150, 0.1));
  border: 1px dashed rgba(90, 255, 150, 0.6);
  border-left: none;
  border-radius: 0 3px 3px 0;
  animation: preview-pulse 0.8s ease-in-out infinite alternate;
}

/* Cost reduction preview: current cost faded */
.cost-preview-current {
  background: rgba(255, 100, 100, 0.2) !important;
  border: 1px dashed rgba(255, 100, 100, 0.4);
}

/* Cost reduction preview: new smaller cost highlighted */
.cost-preview-new {
  background: rgba(90, 255, 150, 0.5) !important;
  border: 1px solid rgba(90, 255, 150, 0.8);
  animation: preview-pulse 0.6s ease-in-out infinite alternate;
  z-index: 2;
}

/* Bandwidth preview: icon pulses */
.bar-icon.bw-preview {
  animation: regen-pulse 0.3s ease-in-out infinite alternate;
  color: #5aff9a;
}

/* Bandwidth preview: bar shows flow effect */
.bar-fill.bandwidth.bw-preview {
  animation: regen-flow 0.5s ease-in-out infinite;
  box-shadow: 0 0 8px rgba(90, 255, 150, 0.4);
}

/* Regen preview indicator (extra arrows) */
.regen-preview-indicator {
  display: flex;
  flex-direction: column;
  margin-left: 6px;
  gap: 0;
}

.regen-arrow {
  font-size: 12px;
  color: #5aff9a;
  animation: arrow-fall 0.4s ease-in infinite;
  opacity: 0;
}

.regen-arrow.delayed {
  animation-delay: 0.2s;
}

/* Install indicator previews */
.install-indicator.efficiency-preview {
  background: rgba(90, 150, 255, 0.2);
  border: 1px solid rgba(90, 150, 255, 0.5);
}

.efficiency-preview-icon {
  font-size: 15px;
  color: #5a9aff;
  margin-left: 3px;
  animation: speed-flash 0.3s ease-in-out infinite alternate;
}

/* Preview animations */
@keyframes preview-pulse {
  from {
    opacity: 0.5;
  }
  to {
    opacity: 1;
  }
}

@keyframes regen-pulse {
  from {
    transform: scale(1);
    opacity: 0.7;
  }
  to {
    transform: scale(1.2);
    opacity: 1;
  }
}

@keyframes regen-flow {
  0%, 100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.3);
  }
}

@keyframes arrow-fall {
  0% {
    opacity: 0;
    transform: translateY(-4px);
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(4px);
  }
}

@keyframes speed-flash {
  from {
    opacity: 0.5;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1.1);
  }
}

/* ============================================
   THRESHOLD WARNING STYLES (Option B)
   ============================================ */

/* Bandwidth warnings */
.bar-icon.warning-low {
  color: #ffaa5a;
  animation: warning-pulse 1s ease-in-out infinite;
}

.bar-icon.warning-critical {
  color: #ff5a5a;
  animation: warning-pulse-fast 0.5s ease-in-out infinite;
}

.bar-container.warning-low {
  box-shadow: 0 0 8px rgba(255, 170, 90, 0.4);
}

.bar-container.warning-critical {
  box-shadow: 0 0 12px rgba(255, 90, 90, 0.6);
  animation: warning-glow 0.5s ease-in-out infinite alternate;
}

/* Weight milestone */
.weight-display.milestone-near {
  /* Container effect */
}

.weight-icon.milestone-pulse {
  animation: milestone-glow 1.2s ease-in-out infinite;
  text-shadow: 0 0 12px rgba(255, 170, 90, 0.6);
}

/* Efficiency warnings */
.efficiency-display.efficiency-warning {
  /* Low efficiency attention */
}

.efficiency-display.efficiency-critical {
  animation: efficiency-shake 0.4s ease-in-out infinite;
}

.efficiency-warn-icon {
  animation: efficiency-warn-pulse 0.8s ease-in-out infinite alternate;
}

.efficiency-display.efficiency-critical .efficiency-warn-icon {
  color: #ff5a5a;
  text-shadow: 0 0 6px rgba(255, 90, 90, 0.6);
}

.efficiency-warn-bar {
  box-shadow: 0 0 8px rgba(255, 90, 90, 0.4);
}

/* Warning animations */
@keyframes warning-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes warning-pulse-fast {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.1); }
}

@keyframes warning-glow {
  from { box-shadow: 0 0 8px rgba(255, 90, 90, 0.4); }
  to { box-shadow: 0 0 16px rgba(255, 90, 90, 0.8); }
}

@keyframes milestone-glow {
  0%, 100% {
    text-shadow: 0 0 8px rgba(255, 170, 90, 0.4);
    transform: scale(1);
  }
  50% {
    text-shadow: 0 0 16px rgba(255, 170, 90, 0.8);
    transform: scale(1.1);
  }
}

@keyframes efficiency-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-1px); }
  40% { transform: translateX(1px); }
  60% { transform: translateX(-1px); }
  80% { transform: translateX(1px); }
}

@keyframes efficiency-warn-pulse {
  from { opacity: 0.6; }
  to { opacity: 1; }
}

@keyframes gravity-ready-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

@keyframes gravity-icon-ready {
  from {
    transform: scale(1);
    text-shadow: 0 0 8px rgba(167, 139, 250, 0.6);
  }
  to {
    transform: scale(1.15);
    text-shadow: 0 0 16px rgba(167, 139, 250, 1);
  }
}

/* ============================================
   SCOPE NAVIGATION STYLES
   ============================================ */

.hud-top-left {
  position: absolute;
  top: 24px;
  left: 24px;
  pointer-events: auto;
  z-index: 200;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  background: rgba(30, 30, 50, 0.9);
  border: 2px solid #4a4a6a;
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
  border-color: #ff6b6b;
  box-shadow: 0 0 12px rgba(255, 107, 107, 0.3);
}

.back-btn.unstable .back-icon {
  color: #ff6b6b;
}

/* Stable state - green/success */
.back-btn.stable {
  border-color: #4ade80;
  background: rgba(30, 50, 40, 0.9);
  box-shadow: 0 0 16px rgba(74, 222, 128, 0.4);
  animation: stable-pulse 1.5s ease-in-out infinite;
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
  animation: status-pulse 0.8s ease-in-out infinite alternate;
}

.status-dot.conflict {
  color: #ff6b6b;
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

/* Scope navigation transition */
.scope-nav-enter-active {
  transition: all 0.3s ease-out;
}

.scope-nav-leave-active {
  transition: all 0.2s ease-in;
}

.scope-nav-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.scope-nav-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

@keyframes stable-pulse {
  0%, 100% {
    box-shadow: 0 0 12px rgba(74, 222, 128, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(74, 222, 128, 0.5);
  }
}

@keyframes status-pulse {
  from { opacity: 0.6; }
  to { opacity: 1; }
}

@keyframes check-bounce {
  0% { transform: scale(0); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
</style>
