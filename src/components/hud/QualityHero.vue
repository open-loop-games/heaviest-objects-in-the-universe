<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { gameState } from '../../game/state'
import { getEfficiencyTier, getEfficiencyTierRank } from '../../game/formulas'
import { onQualityEvent, type QualityEvent } from '../../game/mutations'
import { toRaw } from 'vue'
import type { Package } from '../../game/types'

// ============================================
// JUICE ANIMATION STATE
// ============================================

const efficiencyPulse = ref(false)
const stabilityPulse = ref(false)
const tierUpFlash = ref(false)
const recentlyFilledPip = ref<number | null>(null)

let unsubscribe: (() => void) | null = null

onMounted(() => {
  unsubscribe = onQualityEvent((event: QualityEvent) => {
    if (
      event.type === 'symlink-merge' ||
      event.type === 'efficiency-improved'
    ) {
      // Pulse efficiency bar on merge or improvement
      efficiencyPulse.value = true
      setTimeout(() => (efficiencyPulse.value = false), 400)
    }

    if (event.type === 'efficiency-tier-up') {
      // Flash the tier pips on tier-up
      tierUpFlash.value = true
      recentlyFilledPip.value = getEfficiencyTierRank(event.newTier) - 1
      setTimeout(() => {
        tierUpFlash.value = false
        recentlyFilledPip.value = null
      }, 800)
    }

    if (
      event.type === 'scope-stabilized' ||
      event.type === 'stability-improved'
    ) {
      // Pulse stability bar
      stabilityPulse.value = true
      setTimeout(() => (stabilityPulse.value = false), 400)
    }
  })
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})

// ============================================
// EFFICIENCY
// ============================================

const efficiencyValue = computed(() => gameState.stats.currentEfficiency)
const efficiencyTier = computed(() => getEfficiencyTier(efficiencyValue.value))
const efficiencyTierRank = computed(() =>
  getEfficiencyTierRank(efficiencyTier.value)
)

// Efficiency state for styling
const efficiencyState = computed(() => {
  if (efficiencyValue.value < 0.3) return 'critical'
  if (efficiencyValue.value < 0.5) return 'warning'
  if (efficiencyValue.value >= 0.85) return 'excellent'
  return 'normal'
})

// Multiplier indicator based on efficiency
// Below 50% = penalty, above 50% = bonus
const efficiencyMultiplierIndicator = computed(() => {
  if (efficiencyValue.value < 0.5) return 'penalty'
  if (efficiencyValue.value >= 0.85) return 'excellent'
  return 'bonus'
})

// ============================================
// STABILITY
// ============================================

const stabilityValue = computed(() => gameState.stats.currentStability)

// Count stable vs total entered scopes for dot display
const scopeStats = computed(() => {
  const packages = toRaw(gameState.packages)
  const entered = collectEnteredScopes(packages)
  const stable = entered.filter((p) => p.internalState === 'stable').length
  return { stable, total: entered.length }
})

// Collect all entered scopes (non-pristine internal states)
function collectEnteredScopes(packages: Map<string, Package>): Package[] {
  const result: Package[] = []
  for (const pkg of packages.values()) {
    if (pkg.internalState !== null && pkg.internalState !== 'pristine') {
      result.push(pkg)
    }
    const internal = pkg.internalPackages ? toRaw(pkg.internalPackages) : null
    if (internal && internal.size > 0) {
      result.push(...collectEnteredScopes(internal))
    }
  }
  return result
}

// Stability state for styling
const stabilityState = computed(() => {
  if (stabilityValue.value >= 1.0) return 'stable'
  if (stabilityValue.value < 0.5) return 'critical'
  if (stabilityValue.value < 0.7) return 'warning'
  return 'normal'
})

// Tier pip indices (0-4 for 5 tiers)
const tierPips = [0, 1, 2, 3, 4]
</script>

<template>
  <div class="quality-hero">
    <!-- Efficiency Section -->
    <div
      class="quality-section efficiency-section"
      :class="[efficiencyState, { 'tier-up-flash': tierUpFlash }]"
    >
      <div class="section-header">
        <span class="section-icon">⚡</span>
        <div class="section-bar-container">
          <div class="section-bar" :class="{ pulse: efficiencyPulse }">
            <div
              class="section-bar-fill efficiency-fill"
              :style="{ width: efficiencyValue * 100 + '%' }"
            />
            <!-- Threshold marker at 50% (neutral point) -->
            <div class="threshold-marker" />
          </div>
        </div>
        <span
          class="multiplier-indicator"
          :class="efficiencyMultiplierIndicator"
        >
          {{
            efficiencyMultiplierIndicator === 'penalty'
              ? '▼'
              : efficiencyMultiplierIndicator === 'excellent'
                ? '▲▲'
                : '▲'
          }}
        </span>
      </div>
      <!-- Tier pips -->
      <div class="tier-pips" :class="{ 'tier-up-flash': tierUpFlash }">
        <span
          v-for="i in tierPips"
          :key="i"
          class="tier-pip"
          :class="{
            filled: i < efficiencyTierRank,
            current: i === efficiencyTierRank,
            'tier-pristine': i === 4 && efficiencyTierRank >= 4,
            'just-filled': i === recentlyFilledPip,
          }"
        />
      </div>
    </div>

    <!-- Stability Section -->
    <div class="quality-section stability-section" :class="stabilityState">
      <div class="section-header">
        <span class="section-icon">✓</span>
        <div class="section-bar-container">
          <div class="section-bar" :class="{ pulse: stabilityPulse }">
            <div
              class="section-bar-fill stability-fill"
              :style="{ width: stabilityValue * 100 + '%' }"
            />
          </div>
        </div>
        <span
          class="stability-indicator"
          :class="[stabilityState, { pulse: stabilityPulse }]"
        >
          {{ stabilityValue >= 1.0 ? '●' : stabilityValue < 0.5 ? '!' : '○' }}
        </span>
      </div>
      <!-- Scope dots (show up to 6) -->
      <div v-if="scopeStats.total > 0" class="scope-dots">
        <span
          v-for="i in Math.min(scopeStats.total, 6)"
          :key="i"
          class="scope-dot"
          :class="{ stable: i <= scopeStats.stable }"
        />
        <span v-if="scopeStats.total > 6" class="scope-overflow">+</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quality-hero {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ============================================
   SECTION LAYOUT
   ============================================ */

.quality-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
  transition: all 0.3s ease;
}

/* ============================================
   EFFICIENCY STATES
   ============================================ */

.efficiency-section .section-icon {
  color: var(--hud-efficiency, #5affff);
}

.efficiency-section.warning .section-icon {
  color: var(--hud-warning-orange, #ffaa5a);
  animation: icon-pulse 0.8s ease-in-out infinite alternate;
}

.efficiency-section.critical .section-icon {
  color: var(--hud-warning, #ff6a5a);
  animation: icon-pulse 0.4s ease-in-out infinite alternate;
}

.efficiency-section.excellent .section-icon {
  color: var(--hud-stability, #5aff8a);
  text-shadow: 0 0 10px rgba(90, 255, 138, 0.8);
}

/* ============================================
   STABILITY STATES
   ============================================ */

.stability-section .section-icon {
  color: var(--hud-stability, #5aff8a);
}

.stability-section.warning .section-icon {
  color: var(--hud-warning-orange, #ffaa5a);
  animation: icon-pulse 0.8s ease-in-out infinite alternate;
}

.stability-section.critical .section-icon {
  color: var(--hud-warning, #ff6a5a);
  animation: icon-pulse 0.5s ease-in-out infinite alternate;
}

.stability-section.stable .section-icon {
  color: var(--hud-stability, #5aff8a);
  text-shadow: 0 0 8px rgba(90, 255, 138, 0.6);
}

/* ============================================
   PROGRESS BARS
   ============================================ */

.section-bar-container {
  flex: 1;
  min-width: 120px;
}

.section-bar {
  position: relative;
  height: 10px;
  background: rgba(40, 35, 55, 0.9);
  border-radius: 5px;
  overflow: visible;
}

.section-bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.3s ease-out;
}

/* Efficiency bar gradient: red → orange → cyan */
.efficiency-fill {
  background: linear-gradient(90deg, #ff5a5a 0%, #ffaa5a 40%, #5affff 100%);
  box-shadow: 0 0 6px rgba(90, 255, 255, 0.3);
}

.efficiency-section.excellent .efficiency-fill {
  background: linear-gradient(90deg, #5affaa, #5affff);
  box-shadow: 0 0 10px rgba(90, 255, 200, 0.5);
}

/* Stability bar gradient: orange → green */
.stability-fill {
  background: linear-gradient(90deg, #ff8a5a 0%, #5aff8a 100%);
  box-shadow: 0 0 6px rgba(90, 255, 138, 0.3);
}

.stability-section.stable .stability-fill {
  background: #5aff8a;
  box-shadow: 0 0 10px rgba(90, 255, 138, 0.5);
}

/* Threshold marker (50% line) */
.threshold-marker {
  position: absolute;
  left: 50%;
  top: -2px;
  bottom: -2px;
  width: 2px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 1px;
}

/* ============================================
   MULTIPLIER INDICATOR
   ============================================ */

.multiplier-indicator {
  font-size: 12px;
  width: 24px;
  text-align: center;
  font-weight: bold;
  transition: all 0.3s ease;
}

.multiplier-indicator.penalty {
  color: #ff6a5a;
  animation: shake 0.3s ease-in-out infinite;
}

.multiplier-indicator.bonus {
  color: #5affaa;
}

.multiplier-indicator.excellent {
  color: #5affff;
  text-shadow: 0 0 8px rgba(90, 255, 255, 0.8);
  animation: glow-pulse 1.5s ease-in-out infinite;
}

/* ============================================
   TIER PIPS
   ============================================ */

.tier-pips {
  display: flex;
  gap: 4px;
  padding-left: 28px; /* Align with bar */
}

.tier-pip {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: rgba(60, 55, 80, 0.8);
  border: 1px solid rgba(90, 90, 120, 0.4);
  transition: all 0.3s ease;
}

.tier-pip.filled {
  background: #5affaa;
  border-color: #5affaa;
  box-shadow: 0 0 4px rgba(90, 255, 170, 0.5);
}

.tier-pip.current {
  background: rgba(90, 255, 170, 0.3);
  border-color: #5affaa;
  animation: pip-pulse 1s ease-in-out infinite;
}

.tier-pip.tier-pristine {
  background: #5affff;
  border-color: #5affff;
  box-shadow: 0 0 8px rgba(90, 255, 255, 0.8);
  animation: pristine-glow 2s ease-in-out infinite;
}

/* ============================================
   STABILITY INDICATOR
   ============================================ */

.stability-indicator {
  font-size: 14px;
  width: 20px;
  text-align: center;
  transition: all 0.3s ease;
}

.stability-indicator.stable {
  color: #5aff8a;
  text-shadow: 0 0 8px rgba(90, 255, 138, 0.8);
}

.stability-indicator.warning {
  color: #ffaa5a;
}

.stability-indicator.critical {
  color: #ff6a5a;
  animation: icon-pulse 0.5s ease-in-out infinite alternate;
}

/* ============================================
   SCOPE DOTS
   ============================================ */

.scope-dots {
  display: flex;
  gap: 3px;
  padding-left: 28px; /* Align with bar */
  align-items: center;
}

.scope-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 138, 90, 0.4);
  border: 1px solid rgba(255, 138, 90, 0.6);
  transition: all 0.3s ease;
}

.scope-dot.stable {
  background: #5aff8a;
  border-color: #5aff8a;
  box-shadow: 0 0 4px rgba(90, 255, 138, 0.5);
}

.scope-overflow {
  font-size: 10px;
  color: rgba(200, 200, 220, 0.6);
  margin-left: 2px;
}

/* ============================================
   ANIMATIONS
   ============================================ */

@keyframes icon-pulse {
  0%,
  100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-1px);
  }
  75% {
    transform: translateX(1px);
  }
}

@keyframes glow-pulse {
  0%,
  100% {
    text-shadow: 0 0 6px rgba(90, 255, 255, 0.6);
  }
  50% {
    text-shadow: 0 0 12px rgba(90, 255, 255, 1);
  }
}

@keyframes pip-pulse {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

@keyframes pristine-glow {
  0%,
  100% {
    box-shadow: 0 0 6px rgba(90, 255, 255, 0.6);
  }
  50% {
    box-shadow: 0 0 12px rgba(90, 255, 255, 1);
  }
}

/* ============================================
   JUICE ANIMATIONS (Event-triggered)
   ============================================ */

/* Bar pulse on improvement */
.section-bar.pulse {
  animation: bar-pulse 0.4s ease-out;
}

@keyframes bar-pulse {
  0% {
    filter: brightness(1);
    box-shadow: none;
  }
  50% {
    filter: brightness(1.5);
    box-shadow: 0 0 16px rgba(90, 255, 255, 0.8);
  }
  100% {
    filter: brightness(1);
    box-shadow: none;
  }
}

/* Stability indicator pulse */
.stability-indicator.pulse {
  animation: indicator-pulse 0.4s ease-out;
}

@keyframes indicator-pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.4);
    text-shadow: 0 0 12px rgba(90, 255, 138, 1);
  }
  100% {
    transform: scale(1);
  }
}

/* Tier-up flash on the whole section */
.efficiency-section.tier-up-flash {
  animation: section-flash 0.8s ease-out;
}

@keyframes section-flash {
  0% {
    filter: brightness(1);
  }
  30% {
    filter: brightness(1.8);
  }
  100% {
    filter: brightness(1);
  }
}

/* Just-filled pip burst animation */
.tier-pip.just-filled {
  animation: pip-fill-burst 0.8s ease-out;
}

@keyframes pip-fill-burst {
  0% {
    transform: scale(0.5);
    opacity: 0.5;
    background: transparent;
  }
  40% {
    transform: scale(1.6);
    background: #5affff;
    box-shadow: 0 0 16px rgba(90, 255, 255, 1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
