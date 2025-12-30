<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import {
  gameState,
  computed_gravity,
  computed_prestigeReward,
  computed_canPrestige,
} from '../game/state'
import { isInPackageScope, getScopeDepth } from '../game/scope'
import {
  triggerPrestigeWithAnimation,
  softReset,
  hardReset,
} from '../game/mutations'
import { saveToLocalStorage } from '../game/persistence'
import {
  createRootPackage,
  exitPackageScope,
  getInternalStats,
} from '../game/packages'
import { setCameraTarget } from '../game/loop'
import { calculateStabilityRatio } from '../game/formulas'
import {
  getEffectiveInstallCost,
  previewedUpgradeId,
  getPreviewBandwidth,
  getPreviewEfficiency,
} from '../game/upgrades'
import {
  isAutomationProcessing,
  getAutomationProcessingType,
  getAutomationProgress,
} from '../game/automation'
import { computed_ecosystemTier } from '../game/state'
import { TIER_THRESHOLDS } from '../game/config'

// ============================================
// UNIFIED CACHE/TIER DISPLAY
// ============================================

// Max tokens shown in the display (tier 5 threshold)
const MAX_DISPLAY_TOKENS = TIER_THRESHOLDS[4] // 63

// Tier milestone data with unlock icons
const tierMilestones = computed(() => [
  { tier: 2, tokens: TIER_THRESHOLDS[1], icon: '⚙', unlockName: 'auto-resolve' },
  { tier: 3, tokens: TIER_THRESHOLDS[2], icon: '⟲', unlockName: 'auto-dedup' },
  { tier: 4, tokens: TIER_THRESHOLDS[3], icon: '⚡', unlockName: 'faster' },
  { tier: 5, tokens: TIER_THRESHOLDS[4], icon: '★', unlockName: 'maximum' },
])

// Generate token slots grouped by tier segments
const cacheTokenSlots = computed(() => {
  const owned = gameState.meta.cacheTokens
  const slots: Array<{
    index: number
    owned: boolean
    isMilestone: boolean
    milestoneIcon: string | null
    tierNumber: number | null
    isUnlocked: boolean
  }>[] = []

  // Create segments between milestones
  let prevThreshold = 0
  for (let tierIdx = 1; tierIdx <= 4; tierIdx++) {
    const threshold = TIER_THRESHOLDS[tierIdx]
    const segment: typeof slots[0] = []

    for (let i = prevThreshold; i < threshold; i++) {
      const isLast = i === threshold - 1
      segment.push({
        index: i,
        owned: i < owned,
        isMilestone: isLast,
        milestoneIcon: isLast ? tierMilestones.value[tierIdx - 1].icon : null,
        tierNumber: isLast ? tierIdx + 1 : null,
        isUnlocked: owned >= threshold,
      })
    }

    slots.push(segment)
    prevThreshold = threshold
  }

  return slots
})

// Summary for compact view
const cacheTokenSummary = computed(() => {
  const owned = gameState.meta.cacheTokens
  const nextTier = computed_ecosystemTier.value + 1
  const nextThreshold = nextTier <= 5 ? TIER_THRESHOLDS[nextTier - 1] : null
  const tokensToNext = nextThreshold ? nextThreshold - owned : 0

  return {
    owned,
    currentTier: computed_ecosystemTier.value,
    nextTier: nextTier <= 5 ? nextTier : null,
    tokensToNext: tokensToNext > 0 ? tokensToNext : 0,
    nextMilestone: nextThreshold,
    progressToNext: nextThreshold ? owned / nextThreshold : 1,
  }
})

// Staged HUD visibility (progressive disclosure - sticky after first reveal)
const showBandwidth = computed(() => gameState.onboarding.firstClickComplete)
const showWeight = computed(() => {
  // Show if we've seen it before OR if we have enough packages
  if (gameState.onboarding.weightSeen) return true
  if (gameState.packages.size >= 8) {
    // Mark as seen (sticky)
    gameState.onboarding.weightSeen = true
    return true
  }
  return false
})
const showCacheTokens = computed(
  () =>
    gameState.onboarding.firstPrestigeComplete || gameState.meta.cacheTokens > 0
)

// ============================================
// SCOPE NAVIGATION
// ============================================

// Check if we're inside a package scope
const inPackageScope = computed(() => isInPackageScope())

// Get the current scope package's internal state
const scopePackageState = computed(() => {
  if (!inPackageScope.value) return null
  const pkg = gameState.packages.get(gameState.currentScope)
  return pkg?.internalState || null
})

// Is the current scope stable (ready to exit with satisfaction)?
const isScopeStable = computed(() => scopePackageState.value === 'stable')

// Internal stats for the current scope
const scopeStats = computed(() => {
  if (!inPackageScope.value) return { conflicts: 0, duplicates: 0 }
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

// Bandwidth bar
const bandwidthPercent = computed(() => {
  return (
    (gameState.resources.bandwidth / gameState.resources.maxBandwidth) * 100
  )
})

// Segmented bandwidth bar (10 segments)
const BANDWIDTH_SEGMENTS = 10
const bandwidthSegments = computed(() => {
  const percent = bandwidthPercent.value / 100
  const filledSegments = Math.floor(percent * BANDWIDTH_SEGMENTS)
  const partialFill = (percent * BANDWIDTH_SEGMENTS) % 1

  // Calculate which segments the install cost would consume
  const costSegments = Math.ceil((costPercent.value / 100) * BANDWIDTH_SEGMENTS)
  const costStartSegment = Math.max(0, filledSegments - costSegments + (partialFill > 0 ? 1 : 0))

  return Array.from({ length: BANDWIDTH_SEGMENTS }, (_, i) => ({
    index: i,
    filled: i < filledSegments,
    partial: i === filledSegments ? partialFill : 0,
    // Mark segments that would be consumed by install cost
    isCost: i >= costStartSegment && i < filledSegments + (partialFill > 0 ? 1 : 0),
    isAffordable: i < costStartSegment || i >= filledSegments,
  }))
})

// Gravity toward collapse
const gravityPercent = computed(() => {
  return Math.min(100, computed_gravity.value * 100)
})

// Install cost and affordability
const installCost = computed(() => getEffectiveInstallCost())
const canAffordInstall = computed(() => {
  return gameState.resources.bandwidth >= installCost.value
})

// Cost as percentage of max bandwidth (for ghost segment)
const costPercent = computed(() => {
  return (installCost.value / gameState.resources.maxBandwidth) * 100
})

// Weight scale indicator (which magnitude we're at)
const weightScale = computed(() => {
  const w = gameState.resources.weight * 1024
  if (w < 1000) return 0 // B
  if (w < 1000000) return 1 // K
  if (w < 1000000000) return 2 // M
  return 3 // G
})

// How far through current magnitude (0-1) for icon scaling
const weightFillPercent = computed(() => {
  const w = gameState.resources.weight * 1024
  if (w < 1000) return w / 1000
  if (w < 1000000) return (w - 1000) / (1000000 - 1000)
  if (w < 1000000000) return (w - 1000000) / (1000000000 - 1000000)
  return Math.min(1, (w - 1000000000) / 1000000000)
})

// Progress toward prestige threshold (0-1, capped)
// computed_gravity is already imported and gives weight/threshold
const prestigeProgress = computed(() => {
  return Math.min(1, computed_gravity.value)
})

// Segmented weight bar (12 segments for granularity)
const WEIGHT_SEGMENTS = 12
const weightSegments = computed(() => {
  const progress = prestigeProgress.value
  const filledSegments = Math.floor(progress * WEIGHT_SEGMENTS)
  const partialFill = (progress * WEIGHT_SEGMENTS) % 1

  return Array.from({ length: WEIGHT_SEGMENTS }, (_, i) => ({
    index: i,
    filled: i < filledSegments,
    partial: i === filledSegments ? partialFill : 0,
    isLast: i === WEIGHT_SEGMENTS - 1,
  }))
})

// Efficiency as visual (0-1)
const efficiencyValue = computed(() => {
  return gameState.stats.currentEfficiency
})

// Show efficiency after enough packages (progressive disclosure - sticky)
const showEfficiency = computed(() => {
  if (gameState.onboarding.efficiencySeen) return true
  if (gameState.packages.size >= 8) {
    gameState.onboarding.efficiencySeen = true
    return true
  }
  return false
})

// ============================================
// THRESHOLD WARNINGS
// ============================================

// Bandwidth warning: can't afford next install
const bandwidthWarning = computed(() => {
  if (!canAffordInstall.value) return 'critical' // Can't click
  if (bandwidthPercent.value < 30) return 'low' // Getting low
  return null
})

// Efficiency warning: too many duplicates
const efficiencyWarning = computed(() => {
  if (efficiencyValue.value <= 0.3) return 'critical' // Very bad
  if (efficiencyValue.value <= 0.5) return 'low' // Needs attention
  return null
})

// Gravity ready: can prestige
const gravityReady = computed(() => computed_canPrestige.value)

// Weight milestone: approaching next magnitude
const weightMilestone = computed(() => {
  // Pulse when close to next magnitude threshold
  return weightFillPercent.value > 0.8
})

// ============================================
// UPGRADE PREVIEW VISUALIZATIONS
// ============================================

// Check if a specific upgrade is being previewed
const isPreviewingBandwidth = computed(
  () => previewedUpgradeId.value === 'bandwidth'
)
const isPreviewingEfficiency = computed(
  () => previewedUpgradeId.value === 'efficiency'
)
const isPreviewingAny = computed(() => previewedUpgradeId.value !== null)

// Bandwidth preview: show ghost extension of the bar (capacity increase)
const bandwidthPreview = computed(() => {
  if (!isPreviewingBandwidth.value) return null
  const preview = getPreviewBandwidth()
  // Calculate how much the bar would extend with new max
  const previewMaxPercent = (preview.currentValue / preview.previewValue) * 100
  return {
    currentBarScaleX: previewMaxPercent / 100,
    extensionWidth: 100 - previewMaxPercent,
  }
})

// Efficiency preview: show smaller cost ghost segment
const efficiencyPreview = computed(() => {
  if (!isPreviewingEfficiency.value) return null
  const preview = getPreviewEfficiency()
  const currentCostPercent =
    (preview.current / gameState.resources.maxBandwidth) * 100
  const previewCostPercent =
    (preview.preview / gameState.resources.maxBandwidth) * 100
  return {
    currentCostPercent,
    previewCostPercent,
    savings: currentCostPercent - previewCostPercent,
  }
})

// Show prestige area once unlocked (stays visible after first prestige)
const showPrestigeArea = computed(() => {
  // Once you've prestiged or have cache tokens, always show
  if (gameState.onboarding.firstPrestigeComplete || gameState.meta.cacheTokens > 0) {
    return true
  }
  // Otherwise show when gravity is building toward first prestige
  return gravityPercent.value > 20
})

// Orbital decay visualization - orbit shrinks and speeds up as weight grows
const orbitRadius = computed(() => {
  // Start at 40px, shrink to 8px as gravity approaches 100%
  const progress = gravityPercent.value / 100
  return Math.max(8, 40 - progress * 32)
})

const orbitSpeed = computed(() => {
  // Start at 8s per rotation, speed up to 0.5s at max
  const progress = gravityPercent.value / 100
  return Math.max(0.5, 8 - progress * 7.5)
})

const orbitCount = computed(() => {
  // More orbiters as weight grows (3-6 based on progress)
  const progress = gravityPercent.value / 100
  return Math.min(6, Math.max(3, Math.floor(3 + progress * 3)))
})

// Prestige reward as visual dots (1-5 based on reward amount)
const prestigeRewardDots = computed(() => {
  const reward = computed_prestigeReward.value
  if (reward <= 0) return 0
  if (reward <= 1) return 1
  if (reward <= 3) return 2
  if (reward <= 5) return 3
  if (reward <= 10) return 4
  return 5
})

// Stability ratio for prestige quality
const stabilityValue = computed(() => {
  return calculateStabilityRatio(gameState)
})

// Reward quality tier based on efficiency (for token styling)
const rewardQuality = computed(() => {
  const eff = efficiencyValue.value
  if (eff >= 0.8) return 'excellent' // Bright glow
  if (eff >= 0.5) return 'good' // Normal
  if (eff >= 0.3) return 'poor' // Faded
  return 'terrible' // Very faded, shaky
})

// Arc percentages for SVG (0-100 for stroke-dasharray)
const efficiencyArcPercent = computed(() => efficiencyValue.value * 100)
const stabilityArcPercent = computed(() => stabilityValue.value * 100)

// ============================================
// TIER PROGRESS ARCS
// ============================================

// Calculate progress within each tier segment (0-1)
const tierArcProgress = computed(() => {
  const tokens = gameState.meta.cacheTokens

  return [
    // Tier 2: 0 → 9 tokens
    {
      tier: 2,
      icon: '⚙',
      start: 0,
      end: TIER_THRESHOLDS[1],
      progress: Math.min(1, tokens / TIER_THRESHOLDS[1]),
      complete: tokens >= TIER_THRESHOLDS[1],
    },
    // Tier 3: 9 → 21 tokens
    {
      tier: 3,
      icon: '⟲',
      start: TIER_THRESHOLDS[1],
      end: TIER_THRESHOLDS[2],
      progress: tokens >= TIER_THRESHOLDS[1]
        ? Math.min(1, (tokens - TIER_THRESHOLDS[1]) / (TIER_THRESHOLDS[2] - TIER_THRESHOLDS[1]))
        : 0,
      complete: tokens >= TIER_THRESHOLDS[2],
    },
    // Tier 4: 21 → 42 tokens
    {
      tier: 4,
      icon: '⚡',
      start: TIER_THRESHOLDS[2],
      end: TIER_THRESHOLDS[3],
      progress: tokens >= TIER_THRESHOLDS[2]
        ? Math.min(1, (tokens - TIER_THRESHOLDS[2]) / (TIER_THRESHOLDS[3] - TIER_THRESHOLDS[2]))
        : 0,
      complete: tokens >= TIER_THRESHOLDS[3],
    },
    // Tier 5: 42 → 63 tokens
    {
      tier: 5,
      icon: '★',
      start: TIER_THRESHOLDS[3],
      end: TIER_THRESHOLDS[4],
      progress: tokens >= TIER_THRESHOLDS[3]
        ? Math.min(1, (tokens - TIER_THRESHOLDS[3]) / (TIER_THRESHOLDS[4] - TIER_THRESHOLDS[3]))
        : 0,
      complete: tokens >= TIER_THRESHOLDS[4],
    },
  ]
})

// SVG arc calculations for tier rings
// Each tier arc is a quarter circle (90 degrees) positioned in different quadrants
const tierArcPaths = computed(() => {
  // Radii for the 4 tier arcs - pushed further out to avoid overlap with quality arcs
  // Quality arcs use r=38 and r=46 scaled to ~50px container
  // Tier arcs use larger container (200px) so we need radii > 60 to clear
  const radii = [70, 78, 86, 94]

  return tierArcProgress.value.map((tier, i) => {
    const r = radii[i]
    const circumference = 2 * Math.PI * r
    // Each arc is a quarter (90 degrees = 25% of circumference)
    const arcLength = circumference * 0.25
    const filledLength = arcLength * tier.progress

    // Starting rotation for each quadrant (in degrees from top)
    // Arc 0: top-right (0°), Arc 1: right-bottom (90°), etc.
    const startAngle = i * 90 - 90 // Start from top

    return {
      ...tier,
      r,
      circumference,
      arcLength,
      dashArray: `${filledLength} ${circumference}`,
      trackDashArray: `${arcLength} ${circumference}`,
      rotation: startAngle,
    }
  })
})

// Show quality indicators after first conflict or symlink opportunity
const showQualityIndicators = computed(() => {
  return (
    gameState.onboarding.firstConflictSeen ||
    gameState.stats.totalSymlinksCreated > 0 ||
    gameState.packages.size >= 10
  )
})

// ============================================
// TIER INDICATOR
// ============================================

// Current tier (1-5)
const currentTier = computed(() => computed_ecosystemTier.value)

// Show tier indicator after first prestige or when tier > 1
const showTierIndicator = computed(() => {
  return (
    gameState.onboarding.firstPrestigeComplete ||
    gameState.meta.cacheTokens > 0 ||
    currentTier.value > 1
  )
})

// Tier pips array (5 pips, filled based on current tier)
const tierPips = computed(() => {
  return Array.from({ length: 5 }, (_, i) => ({
    index: i + 1,
    filled: i + 1 <= currentTier.value,
    isCurrent: i + 1 === currentTier.value,
  }))
})

// Track tier changes for celebration effect
const previousTier = ref(1)
const showTierUpCelebration = ref(false)
let tierCelebrationTimeout: ReturnType<typeof setTimeout> | null = null

// Watch for tier increases
watch(currentTier, (newTier, oldTier) => {
  if (newTier > oldTier) {
    // Tier up! Trigger celebration
    showTierUpCelebration.value = true
    previousTier.value = newTier
    if (tierCelebrationTimeout) clearTimeout(tierCelebrationTimeout)
    tierCelebrationTimeout = setTimeout(() => {
      showTierUpCelebration.value = false
    }, 1500) // Celebration lasts 1.5s
  }
})

// ============================================
// AUTOMATION INDICATOR
// ============================================

// Show automation indicator at tier 2+
const showAutomation = computed(() => computed_ecosystemTier.value >= 2)

// Automation processing state (reactive via polling)
const automationActive = computed(() => isAutomationProcessing())
const automationType = computed(() => getAutomationProcessingType())
const automationProgress = computed(() => getAutomationProgress())

// Flash state for completion effect
const showAutomationFlash = ref(false)
let automationFlashTimeout: ReturnType<typeof setTimeout> | null = null

// Watch for automation completion to trigger flash
watch(automationActive, (active, wasActive) => {
  if (wasActive && !active) {
    // Just completed - show flash
    showAutomationFlash.value = true
    if (automationFlashTimeout) clearTimeout(automationFlashTimeout)
    automationFlashTimeout = setTimeout(() => {
      showAutomationFlash.value = false
    }, 300)
  }
})

function handlePrestige() {
  if (computed_canPrestige.value) {
    triggerPrestigeWithAnimation()
  }
}

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
  if (depthChangeTimeout) clearTimeout(depthChangeTimeout)
  if (automationFlashTimeout) clearTimeout(automationFlashTimeout)
  if (tierCelebrationTimeout) clearTimeout(tierCelebrationTimeout)
})
</script>

<template>
  <div class="hud">
    <!-- Top left: Scope navigation (back button + depth totem) -->
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
    </Transition>

    <!-- Top bar: Resources (staged reveal) -->
    <div class="hud-top">
      <!-- Bandwidth with install cost ghost (reveals after first click) -->
      <!-- Bandwidth: Segmented bar like weight -->
      <Transition name="hud-reveal">
        <div
          class="bandwidth-display"
          v-if="showBandwidth"
          :class="{
            'warning-low': bandwidthWarning === 'low',
            'warning-critical': bandwidthWarning === 'critical',
            'preview-active': isPreviewingAny,
          }"
        >
          <div
            class="bandwidth-icon"
            :class="{
              'bw-preview': isPreviewingBandwidth,
              'warning-low': bandwidthWarning === 'low',
              'warning-critical': bandwidthWarning === 'critical',
            }"
          >
            ↓
          </div>
          <!-- Segmented bandwidth bar -->
          <div class="bandwidth-bar">
            <div
              v-for="seg in bandwidthSegments"
              :key="seg.index"
              class="bandwidth-segment"
              :class="{
                filled: seg.filled,
                partial: seg.partial > 0 && !seg.filled,
                'is-cost': seg.isCost && !isPreviewingEfficiency,
                unaffordable: seg.isCost && !canAffordInstall,
              }"
            >
              <div
                v-if="seg.partial > 0 && !seg.filled"
                class="segment-fill"
                :style="{ height: seg.partial * 100 + '%' }"
              ></div>
            </div>
          </div>
          <!-- Regen indicator (shows bandwidth recovering) -->
          <div v-if="isPreviewingBandwidth" class="regen-preview-indicator">
            <span class="regen-arrow">↓</span>
            <span class="regen-arrow delayed">↓</span>
          </div>
        </div>
      </Transition>

      <!-- Prestige Readiness Cluster: Weight + Quality Metrics -->
      <Transition name="hud-reveal">
        <div
          class="prestige-cluster"
          :class="{ 'prestige-ready': prestigeProgress >= 1 }"
          v-if="showWeight"
        >
          <!-- Weight Progress (main bar) -->
          <div
            class="weight-display"
            :class="{ 'milestone-near': weightMilestone }"
          >
            <div
              class="weight-icon"
              :class="{ 'milestone-pulse': weightMilestone }"
            >
              ◆
            </div>
            <!-- Segmented progress bar -->
            <div class="weight-bar">
              <div
                v-for="seg in weightSegments"
                :key="seg.index"
                class="weight-segment"
                :class="{
                  filled: seg.filled,
                  partial: seg.partial > 0 && !seg.filled,
                  'milestone-segment': seg.isLast,
                }"
              >
                <div
                  v-if="seg.partial > 0 && !seg.filled"
                  class="segment-fill"
                  :style="{ height: seg.partial * 100 + '%' }"
                ></div>
              </div>
            </div>
            <!-- Magnitude indicator -->
            <div class="weight-magnitude">
              <span
                class="magnitude-dot"
                :class="{ active: weightScale >= 0 }"
              ></span>
              <span
                class="magnitude-dot"
                :class="{ active: weightScale >= 1 }"
              ></span>
              <span
                class="magnitude-dot"
                :class="{ active: weightScale >= 2 }"
              ></span>
              <span
                class="magnitude-dot"
                :class="{ active: weightScale >= 3 }"
              ></span>
            </div>
          </div>

          <!-- Quality Metrics (efficiency + stability) - shows multiplier effect on prestige -->
          <Transition name="fade">
            <div class="quality-metrics" v-if="showEfficiency">
              <!-- Efficiency Bar (⚡ - deduplication quality) -->
              <div
                class="quality-bar efficiency"
                :class="{
                  warning: efficiencyWarning === 'low',
                  critical: efficiencyWarning === 'critical',
                  excellent: efficiencyValue >= 0.8,
                }"
              >
                <span class="quality-icon">⚡</span>
                <div class="quality-track">
                  <div
                    class="quality-fill efficiency-fill"
                    :style="{ width: efficiencyValue * 100 + '%' }"
                  ></div>
                  <!-- Threshold marker at 50% (where multiplier = 1.0) -->
                  <div class="threshold-marker"></div>
                </div>
                <!-- Multiplier indicator: < or > based on efficiency -->
                <span
                  class="multiplier-indicator"
                  :class="{
                    negative: efficiencyValue < 0.5,
                    positive: efficiencyValue >= 0.5,
                    excellent: efficiencyValue >= 0.8,
                  }"
                >
                  {{ efficiencyValue < 0.5 ? '▼' : efficiencyValue >= 0.8 ? '▲▲' : '▲' }}
                </span>
              </div>

              <!-- Stability Bar (✓ - conflict resolution) -->
              <div
                class="quality-bar stability"
                :class="{
                  warning: stabilityValue < 0.7,
                  excellent: stabilityValue >= 1.0,
                }"
              >
                <span class="quality-icon">✓</span>
                <div class="quality-track">
                  <div
                    class="quality-fill stability-fill"
                    :style="{ width: stabilityValue * 100 + '%' }"
                  ></div>
                </div>
                <!-- Stability state indicator -->
                <span
                  class="stability-state"
                  :class="{
                    unstable: stabilityValue < 0.7,
                    stable: stabilityValue >= 1.0,
                  }"
                >
                  {{ stabilityValue >= 1.0 ? '●' : stabilityValue < 0.7 ? '!' : '○' }}
                </span>
              </div>
            </div>
          </Transition>
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

    <!-- Bottom bar: Prestige Area (centered) -->
    <div class="hud-bottom">
      <!-- Orbital Decay - Prestige Visualization -->
      <Transition name="fade">
        <div
          class="orbital-decay"
          :class="{ ready: gravityReady }"
          v-if="showPrestigeArea"
        >
          <!-- Inner container for horizontal orbit + reward layout -->
          <div class="orbital-decay-inner">
            <!-- Orbiting weight icons -->
            <div class="orbit-container" :class="{ collapsed: gravityReady, 'has-tier-arcs': showCacheTokens }">
              <div
                class="orbit-ring"
                :style="{
                  '--orbit-radius': orbitRadius + 'px',
                  '--orbit-speed': orbitSpeed + 's',
                }"
              >
                <span
                  v-for="i in orbitCount"
                  :key="i"
                  class="orbiter"
                  :style="{ '--orbit-index': i }"
                  >◆</span
                >
              </div>

              <!-- Tier progress arcs (outer rings) - reveals after first prestige -->
              <svg
                v-if="showCacheTokens"
                class="tier-arcs"
                viewBox="0 0 200 200"
              >
                <!-- Tier arc tracks and fills (4 quarter-circle arcs) -->
                <g
                  v-for="arc in tierArcPaths"
                  :key="arc.tier"
                  class="tier-arc-group"
                  :class="{ complete: arc.complete, active: arc.progress > 0 && !arc.complete }"
                  :style="{ '--arc-rotation': arc.rotation + 'deg' }"
                >
                  <!-- Track (unfilled) -->
                  <circle
                    class="tier-arc-track"
                    cx="100"
                    cy="100"
                    :r="arc.r"
                    :stroke-dasharray="arc.trackDashArray"
                  />
                  <!-- Fill (progress) -->
                  <circle
                    class="tier-arc-fill"
                    :class="'tier-' + arc.tier"
                    cx="100"
                    cy="100"
                    :r="arc.r"
                    :stroke-dasharray="arc.dashArray"
                  />
                </g>
              </svg>

              <!-- Tier unlock icons (positioned at arc endpoints) -->
              <!-- Tier unlock icons - animate when their automation is active -->
              <div v-if="showCacheTokens" class="tier-unlock-icons">
                <span
                  v-for="arc in tierArcProgress"
                  :key="'icon-' + arc.tier"
                  class="tier-unlock-icon"
                  :class="{
                    complete: arc.complete,
                    active: arc.progress > 0 && !arc.complete,
                    ['tier-' + arc.tier]: true,
                    'auto-active': (arc.tier === 2 && automationActive && automationType === 'resolve') ||
                                   (arc.tier === 3 && automationActive && automationType === 'dedup'),
                    'auto-flash': (arc.tier === 2 && showAutomationFlash && automationType === 'resolve') ||
                                  (arc.tier === 3 && showAutomationFlash && automationType === 'dedup'),
                  }"
                >{{ arc.icon }}</span>
              </div>

              <!-- Quality arcs around singularity (Option B) -->
              <svg
                v-if="showQualityIndicators"
                class="quality-arcs"
                viewBox="0 0 100 100"
              >
                <!-- Efficiency arc (inner, cyan) -->
                <circle class="arc-track" cx="50" cy="50" r="38" />
                <circle
                  class="arc-fill efficiency-arc"
                  :class="{ low: efficiencyValue < 0.5 }"
                  cx="50"
                  cy="50"
                  r="38"
                  :stroke-dasharray="`${efficiencyArcPercent * 2.39} 239`"
                />
                <!-- Stability arc (outer, green) -->
                <circle class="arc-track" cx="50" cy="50" r="46" />
                <circle
                  class="arc-fill stability-arc"
                  :class="{ low: stabilityValue < 0.7 }"
                  cx="50"
                  cy="50"
                  r="46"
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
              :class="[
                rewardQuality,
                { visible: gravityReady && computed_prestigeReward > 0 },
              ]"
              v-if="showPrestigeArea"
            >
              <span
                v-for="i in Math.min(prestigeRewardDots, 5)"
                :key="i"
                class="reward-token"
                :class="rewardQuality"
                >⟲</span
              >
              <!-- Empty slots to show potential -->
              <span
                v-for="i in Math.max(0, 5 - prestigeRewardDots)"
                :key="'empty-' + i"
                class="reward-token empty"
                >⟲</span
              >
            </div>
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
  display: flex;
  align-items: flex-end;
}

/* ============================================
   BANDWIDTH DISPLAY (Segmented)
   ============================================ */

.bandwidth-display {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(30, 25, 40, 0.6);
  border-radius: 8px;
  border: 1px solid rgba(122, 122, 255, 0.2);
  transition: all 0.3s ease;
}

.bandwidth-display.warning-low {
  border-color: rgba(255, 170, 90, 0.4);
}

.bandwidth-display.warning-critical {
  border-color: rgba(255, 90, 90, 0.5);
  animation: bandwidth-warning-pulse 0.5s ease-in-out infinite alternate;
}

@keyframes bandwidth-warning-pulse {
  from { box-shadow: 0 0 8px rgba(255, 90, 90, 0.2); }
  to { box-shadow: 0 0 16px rgba(255, 90, 90, 0.4); }
}

.bandwidth-icon {
  font-size: 18px;
  color: #7a7aff;
  text-shadow: 0 0 8px rgba(122, 122, 255, 0.4);
  transition: all 0.3s ease;
}

.bandwidth-icon.warning-low {
  color: #ffaa5a;
  text-shadow: 0 0 8px rgba(255, 170, 90, 0.5);
}

.bandwidth-icon.warning-critical {
  color: #ff5a5a;
  text-shadow: 0 0 8px rgba(255, 90, 90, 0.6);
  animation: icon-shake 0.2s linear infinite;
}

@keyframes icon-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-1px); }
  75% { transform: translateX(1px); }
}

.bandwidth-bar {
  display: flex;
  gap: 3px;
  height: 20px;
  align-items: flex-end;
}

.bandwidth-segment {
  position: relative;
  width: 8px;
  height: 100%;
  background: rgba(122, 122, 255, 0.15);
  border-radius: 2px;
  transition: all 0.15s ease-out;
}

.bandwidth-segment.filled {
  background: linear-gradient(to top, #5a5aff, #7a7aff);
  box-shadow: 0 0 4px rgba(122, 122, 255, 0.4);
}

.bandwidth-segment.partial {
  background: rgba(122, 122, 255, 0.15);
}

.bandwidth-segment .segment-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, #5a5aff, #7a7aff);
  border-radius: 2px;
  box-shadow: 0 0 4px rgba(122, 122, 255, 0.3);
}

/* Cost indicator - segments that will be consumed */
.bandwidth-segment.is-cost.filled {
  background: linear-gradient(to top, #4a4aaa, #6a6acc);
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.2);
  opacity: 0.7;
}

.bandwidth-segment.is-cost.filled::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 2px,
    rgba(255, 255, 255, 0.1) 2px,
    rgba(255, 255, 255, 0.1) 4px
  );
  border-radius: 2px;
}

/* Can't afford - cost segments turn red */
.bandwidth-segment.unaffordable.filled {
  background: linear-gradient(to top, #aa4a4a, #cc6a6a);
  box-shadow: 0 0 6px rgba(255, 90, 90, 0.4);
  opacity: 1;
}

/* Regen preview indicator */
.regen-preview-indicator {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: 4px;
}

.regen-arrow {
  font-size: 10px;
  color: #5aff8a;
  animation: regen-bounce 0.6s ease-in-out infinite;
}

.regen-arrow.delayed {
  animation-delay: 0.3s;
}

@keyframes regen-bounce {
  0%, 100% { transform: translateY(0); opacity: 0.5; }
  50% { transform: translateY(-2px); opacity: 1; }
}

/* ============================================
   PRESTIGE CLUSTER (Weight + Quality Metrics)
   ============================================ */

.prestige-cluster {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px;
  background: rgba(25, 22, 30, 0.85);
  border-radius: 12px;
  border: 2px solid rgba(100, 80, 140, 0.3);
  transition: all 0.3s ease;
}

.prestige-cluster.prestige-ready {
  border-color: rgba(122, 90, 255, 0.7);
  box-shadow:
    0 0 20px rgba(122, 90, 255, 0.4),
    inset 0 0 30px rgba(122, 90, 255, 0.1);
  animation: prestige-cluster-ready 1.5s ease-in-out infinite;
}

@keyframes prestige-cluster-ready {
  0%, 100% {
    box-shadow: 0 0 16px rgba(122, 90, 255, 0.3), inset 0 0 20px rgba(122, 90, 255, 0.1);
  }
  50% {
    box-shadow: 0 0 28px rgba(122, 90, 255, 0.5), inset 0 0 40px rgba(122, 90, 255, 0.15);
  }
}

/* Weight display */
.weight-display {
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.3s ease;
}

.weight-display.milestone-near {
  /* Subtle glow when approaching threshold */
}

.weight-icon {
  font-size: 18px;
  color: #ffaa5a;
  transition: all 0.3s ease-out;
}

/* Segmented progress bar */
.weight-bar {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 24px;
  padding: 2px;
  background: rgba(20, 18, 15, 0.8);
  border-radius: 4px;
}

.weight-segment {
  position: relative;
  width: 8px;
  height: 100%;
  background: rgba(255, 170, 90, 0.15);
  border-radius: 2px;
  overflow: hidden;
  transition: all 0.15s ease;
}

.weight-segment.filled {
  background: linear-gradient(to top, #ff8a3a, #ffaa5a);
  box-shadow: 0 0 4px rgba(255, 170, 90, 0.4);
}

.weight-segment.partial {
  background: rgba(255, 170, 90, 0.15);
}

.segment-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, #ff8a3a, #ffaa5a);
  border-radius: 2px;
  transition: height 0.1s ease-out;
}

/* Last segment (milestone) styling */
.weight-segment.milestone-segment {
  border: 1px solid rgba(122, 90, 255, 0.4);
}

.weight-segment.milestone-segment.filled {
  background: linear-gradient(to top, #7a5aff, #9a7aff);
  box-shadow: 0 0 8px rgba(122, 90, 255, 0.6);
  animation: milestone-segment-glow 1s ease-in-out infinite alternate;
}

@keyframes milestone-segment-glow {
  from { box-shadow: 0 0 6px rgba(122, 90, 255, 0.5); }
  to { box-shadow: 0 0 12px rgba(122, 90, 255, 0.8); }
}

/* Magnitude dots (B, K, M, G) */
.weight-magnitude {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
}

.magnitude-dot {
  width: 5px;
  height: 5px;
  background: rgba(255, 170, 90, 0.2);
  border-radius: 50%;
  transition: all 0.3s ease;
}

.magnitude-dot.active {
  background: #ffaa5a;
  box-shadow: 0 0 4px rgba(255, 170, 90, 0.6);
}

/* ============================================
   QUALITY METRICS (Efficiency + Stability)
   ============================================ */

.quality-metrics {
  display: flex;
  gap: 12px;
  padding-top: 4px;
  border-top: 1px solid rgba(100, 80, 140, 0.2);
}

.quality-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.quality-icon {
  font-size: 14px;
  width: 18px;
  text-align: center;
  transition: all 0.3s ease;
}

/* Efficiency icon colors */
.quality-bar.efficiency .quality-icon {
  color: #5affff;
}

.quality-bar.efficiency.warning .quality-icon {
  color: #ffaa5a;
  animation: quality-warn-pulse 0.8s ease-in-out infinite alternate;
}

.quality-bar.efficiency.critical .quality-icon {
  color: #ff5a5a;
  animation: quality-warn-pulse 0.4s ease-in-out infinite alternate;
}

.quality-bar.efficiency.excellent .quality-icon {
  color: #5aff8a;
  text-shadow: 0 0 8px rgba(90, 255, 138, 0.6);
}

/* Stability icon colors */
.quality-bar.stability .quality-icon {
  color: #5aff8a;
}

.quality-bar.stability.warning .quality-icon {
  color: #ffaa5a;
  animation: quality-warn-pulse 0.8s ease-in-out infinite alternate;
}

.quality-bar.stability.excellent .quality-icon {
  color: #5aff5a;
  text-shadow: 0 0 8px rgba(90, 255, 90, 0.6);
}

/* Quality track (bar background) */
.quality-track {
  position: relative;
  flex: 1;
  height: 6px;
  background: rgba(40, 35, 50, 0.8);
  border-radius: 3px;
  overflow: visible;
}

/* Quality fill bars */
.quality-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease-out;
}

.quality-fill.efficiency-fill {
  background: linear-gradient(90deg, #ff6a5a, #ffaa5a, #5affff);
}

.quality-bar.efficiency.excellent .quality-fill.efficiency-fill {
  background: linear-gradient(90deg, #5affaa, #5aff8a);
  box-shadow: 0 0 8px rgba(90, 255, 138, 0.5);
}

.quality-fill.stability-fill {
  background: linear-gradient(90deg, #ff8a5a, #5aff8a);
}

.quality-bar.stability.excellent .quality-fill.stability-fill {
  background: #5aff5a;
  box-shadow: 0 0 8px rgba(90, 255, 90, 0.5);
}

/* Threshold marker (50% line where multiplier = 1.0x) */
.threshold-marker {
  position: absolute;
  left: 50%;
  top: -2px;
  bottom: -2px;
  width: 2px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 1px;
}

/* Multiplier indicator (arrows showing effect on prestige) */
.multiplier-indicator {
  font-size: 10px;
  width: 20px;
  text-align: center;
  transition: all 0.3s ease;
}

.multiplier-indicator.negative {
  color: #ff6a5a;
  animation: multiplier-shake 0.3s ease-in-out infinite;
}

.multiplier-indicator.positive {
  color: #5affaa;
}

.multiplier-indicator.excellent {
  color: #5aff5a;
  text-shadow: 0 0 6px rgba(90, 255, 90, 0.6);
  animation: multiplier-glow 1s ease-in-out infinite alternate;
}

/* Stability state indicator */
.stability-state {
  font-size: 12px;
  width: 16px;
  text-align: center;
  transition: all 0.3s ease;
}

.stability-state.unstable {
  color: #ff6a5a;
  animation: stability-warn 0.5s ease-in-out infinite alternate;
}

.stability-state.stable {
  color: #5aff5a;
  text-shadow: 0 0 6px rgba(90, 255, 90, 0.6);
}

/* Quality animations */
@keyframes quality-warn-pulse {
  from { opacity: 0.6; transform: scale(1); }
  to { opacity: 1; transform: scale(1.1); }
}

@keyframes multiplier-shake {
  0%, 100% { transform: translateY(0); }
  25% { transform: translateY(-1px); }
  75% { transform: translateY(1px); }
}

@keyframes multiplier-glow {
  from { text-shadow: 0 0 4px rgba(90, 255, 90, 0.4); }
  to { text-shadow: 0 0 10px rgba(90, 255, 90, 0.8); }
}

@keyframes stability-warn {
  from { opacity: 0.6; }
  to { opacity: 1; }
}

/* Install indicator */
.install-indicator {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  background: #2a2a3a;
  border-radius: 6px;
  opacity: 0.4;
  transition:
    opacity 0.15s,
    background 0.15s;
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
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  padding: 12px 16px;
  background: rgba(30, 20, 50, 0.6);
  border-radius: 12px;
  border: 1px solid rgba(122, 90, 255, 0.2);
}

.orbital-decay-inner {
  display: flex;
  align-items: center;
  gap: 12px;
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
  transform: rotate(var(--angle)) translateX(var(--orbit-radius))
    rotate(calc(-1 * var(--angle)));
}

.orbit-container.collapsed .orbiter {
  animation: collapse-in 0.5s ease-in forwards;
}

@keyframes orbit-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes collapse-in {
  to {
    transform: rotate(var(--angle)) translateX(0)
      rotate(calc(-1 * var(--angle)));
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
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
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
  transition:
    stroke-dasharray 0.5s ease-out,
    stroke 0.3s ease;
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
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

/* ============================================
   TIER PROGRESS ARCS
   ============================================ */

/* Larger orbit container when tier arcs are visible */
.orbit-container.has-tier-arcs {
  width: 200px;
  height: 200px;
}

.tier-arcs {
  position: absolute;
  width: 200px;
  height: 200px;
  pointer-events: none;
}

.tier-arc-group {
  transform-origin: 100px 100px;
  transform: rotate(var(--arc-rotation, 0deg));
}

.tier-arc-track {
  fill: none;
  stroke: rgba(60, 60, 80, 0.25);
  stroke-width: 4;
  stroke-linecap: round;
}

.tier-arc-fill {
  fill: none;
  stroke-width: 4;
  stroke-linecap: round;
  transition: stroke-dasharray 0.4s ease-out;
  transform-origin: 100px 100px;
  transform: rotate(-90deg); /* Start from top of quadrant */
}

/* Tier-specific colors */
.tier-arc-fill.tier-2 {
  stroke: rgba(90, 170, 255, 0.6);
}

.tier-arc-fill.tier-3 {
  stroke: rgba(90, 255, 200, 0.6);
}

.tier-arc-fill.tier-4 {
  stroke: rgba(255, 200, 90, 0.6);
}

.tier-arc-fill.tier-5 {
  stroke: rgba(255, 140, 200, 0.6);
}

/* Complete tier arcs glow */
.tier-arc-group.complete .tier-arc-fill.tier-2 {
  stroke: #5aaaff;
  filter: drop-shadow(0 0 4px rgba(90, 170, 255, 0.8));
}

.tier-arc-group.complete .tier-arc-fill.tier-3 {
  stroke: #5affc8;
  filter: drop-shadow(0 0 4px rgba(90, 255, 200, 0.8));
}

.tier-arc-group.complete .tier-arc-fill.tier-4 {
  stroke: #ffc85a;
  filter: drop-shadow(0 0 4px rgba(255, 200, 90, 0.8));
}

.tier-arc-group.complete .tier-arc-fill.tier-5 {
  stroke: #ff8cc8;
  filter: drop-shadow(0 0 4px rgba(255, 140, 200, 0.8));
}

/* Active (in-progress) tier arcs pulse gently */
.tier-arc-group.active .tier-arc-fill {
  animation: tier-arc-pulse 2s ease-in-out infinite;
}

@keyframes tier-arc-pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

/* Tier unlock icons container */
.tier-unlock-icons {
  position: absolute;
  width: 200px;
  height: 200px;
  pointer-events: none;
}

/* Individual tier unlock icons */
.tier-unlock-icon {
  position: absolute;
  font-size: 14px;
  transition: all 0.3s ease;
  opacity: 0.25;
  color: #6a6a8a;
}

/* Position icons at the end of each arc quadrant */
/* Tier 2 (top-right quadrant end = right side) */
.tier-unlock-icon.tier-2 {
  top: 50%;
  right: -8px;
  transform: translateY(-50%);
}

/* Tier 3 (right-bottom quadrant end = bottom) */
.tier-unlock-icon.tier-3 {
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
}

/* Tier 4 (bottom-left quadrant end = left side) */
.tier-unlock-icon.tier-4 {
  top: 50%;
  left: -8px;
  transform: translateY(-50%);
}

/* Tier 5 (left-top quadrant end = top) */
.tier-unlock-icon.tier-5 {
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
}

/* Active icons (in progress) */
.tier-unlock-icon.active {
  opacity: 0.6;
  animation: tier-icon-pulse 2s ease-in-out infinite;
}

.tier-unlock-icon.active.tier-2 { color: #5aaaff; }
.tier-unlock-icon.active.tier-3 { color: #5affc8; }
.tier-unlock-icon.active.tier-4 { color: #ffc85a; }
.tier-unlock-icon.active.tier-5 { color: #ff8cc8; }

/* Complete icons - bright with glow */
.tier-unlock-icon.complete {
  opacity: 1;
  font-size: 16px;
}

.tier-unlock-icon.complete.tier-2 {
  color: #5aaaff;
  text-shadow: 0 0 8px rgba(90, 170, 255, 0.8);
}

.tier-unlock-icon.complete.tier-3 {
  color: #5affc8;
  text-shadow: 0 0 8px rgba(90, 255, 200, 0.8);
}

.tier-unlock-icon.complete.tier-4 {
  color: #ffc85a;
  text-shadow: 0 0 8px rgba(255, 200, 90, 0.8);
}

.tier-unlock-icon.complete.tier-5 {
  color: #ff8cc8;
  text-shadow: 0 0 8px rgba(255, 140, 200, 0.8);
  animation: tier-5-complete 1.5s ease-in-out infinite;
}

@keyframes tier-icon-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.8; }
}

@keyframes tier-5-complete {
  0%, 100% {
    transform: translateX(-50%) scale(1);
    text-shadow: 0 0 8px rgba(255, 140, 200, 0.8);
  }
  50% {
    transform: translateX(-50%) scale(1.2);
    text-shadow: 0 0 16px rgba(255, 140, 200, 1);
  }
}

/* Automation active states for tier icons */
.tier-unlock-icon.auto-active.tier-2 {
  color: #5aff8a !important;
  text-shadow: 0 0 12px rgba(90, 255, 138, 1) !important;
  animation: tier-auto-spin-right 0.6s linear infinite;
}

.tier-unlock-icon.auto-active.tier-3 {
  color: #5affff !important;
  text-shadow: 0 0 12px rgba(90, 255, 255, 1) !important;
  animation: tier-auto-spin-bottom 0.6s linear infinite;
}

.tier-unlock-icon.auto-flash {
  animation: tier-auto-flash 0.3s ease-out;
}

@keyframes tier-auto-spin-right {
  from { transform: translateY(-50%) rotate(0deg); }
  to { transform: translateY(-50%) rotate(360deg); }
}

@keyframes tier-auto-spin-bottom {
  from { transform: translateX(-50%) rotate(0deg); }
  to { transform: translateX(-50%) rotate(360deg); }
}

@keyframes tier-auto-flash {
  0% { transform: scale(1); }
  50% { transform: scale(1.5); filter: brightness(2); }
  100% { transform: scale(1); }
}

/* ============================================
   REWARD TOKEN QUALITY (Option A)
   ============================================ */
.reward-preview {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  opacity: 0.3;
  transition: opacity 0.3s ease;
}

.reward-preview.visible {
  opacity: 1;
}

.reward-token {
  font-size: 12px;
  color: #5affff;
  text-shadow: 0 0 6px rgba(90, 255, 255, 0.6);
  animation: reward-float 1s ease-in-out infinite alternate;
  transition: all 0.3s ease;
  line-height: 1;
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
  animation:
    reward-float 1s ease-in-out infinite alternate,
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

.reward-token:nth-child(2) {
  animation-delay: 0.1s;
}
.reward-token:nth-child(3) {
  animation-delay: 0.2s;
}
.reward-token:nth-child(4) {
  animation-delay: 0.3s;
}
.reward-token:nth-child(5) {
  animation-delay: 0.4s;
}

@keyframes reward-float {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-3px);
  }
}

@keyframes reward-glow {
  0%,
  100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.3);
  }
}

@keyframes reward-shake {
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

@keyframes pulse {
  from {
    opacity: 0.7;
  }
  to {
    opacity: 1;
  }
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
  background: linear-gradient(
    90deg,
    rgba(90, 255, 150, 0.3),
    rgba(90, 255, 150, 0.1)
  );
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
  0%,
  100% {
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
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

@keyframes warning-pulse-fast {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
}

@keyframes warning-glow {
  from {
    box-shadow: 0 0 8px rgba(255, 90, 90, 0.4);
  }
  to {
    box-shadow: 0 0 16px rgba(255, 90, 90, 0.8);
  }
}

@keyframes milestone-glow {
  0%,
  100% {
    text-shadow: 0 0 8px rgba(255, 170, 90, 0.4);
    transform: scale(1);
  }
  50% {
    text-shadow: 0 0 16px rgba(255, 170, 90, 0.8);
    transform: scale(1.1);
  }
}

@keyframes efficiency-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  20% {
    transform: translateX(-1px);
  }
  40% {
    transform: translateX(1px);
  }
  60% {
    transform: translateX(-1px);
  }
  80% {
    transform: translateX(1px);
  }
}

@keyframes efficiency-warn-pulse {
  from {
    opacity: 0.6;
  }
  to {
    opacity: 1;
  }
}

@keyframes gravity-ready-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
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
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
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
  0%,
  100% {
    box-shadow: 0 0 12px rgba(74, 222, 128, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(74, 222, 128, 0.5);
  }
}

@keyframes status-pulse {
  from {
    opacity: 0.6;
  }
  to {
    opacity: 1;
  }
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
  border: 2px solid #3a3a5a;
  border-radius: 12px;
  position: relative;
  transition: all 0.3s ease;
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
    opacity: 0.8;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

/* ============================================
   AUTOMATION INDICATOR
   ============================================ */

.automation-indicator {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  background: rgba(40, 40, 60, 0.8);
  border: 2px solid #4a4a6a;
  border-radius: 10px;
  transition: all 0.2s ease;
}

/* Idle state - dimmed */
.automation-indicator .automation-gear {
  font-size: 24px;
  color: #6a6a8a;
  transition: all 0.2s ease;
}

/* Processing state */
.automation-indicator.processing {
  border-color: #7a7aff;
  background: rgba(60, 60, 100, 0.9);
}

.automation-indicator.processing .automation-gear {
  color: #aaaaff;
}

/* Spinning animation */
.automation-gear.spinning {
  animation: gear-spin 0.4s linear infinite;
}

@keyframes gear-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Type-specific colors */
.automation-indicator.type-resolve.processing {
  border-color: #5aff8a;
}

.automation-indicator.type-resolve.processing .automation-gear {
  color: #5aff8a;
}

.automation-indicator.type-dedup.processing {
  border-color: #5affff;
}

.automation-indicator.type-dedup.processing .automation-gear {
  color: #5affff;
}

/* Progress ring */
.automation-progress {
  position: absolute;
  top: -3px;
  left: -3px;
  width: calc(100% + 6px);
  height: calc(100% + 6px);
  transform: rotate(-90deg);
  pointer-events: none;
}

.automation-progress-ring {
  fill: none;
  stroke: #7a7aff;
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dasharray 0.1s ease;
}

.automation-progress-ring.ring-resolve {
  stroke: #5aff8a;
}

.automation-progress-ring.ring-dedup {
  stroke: #5affff;
}

/* Completion flash effect */
.automation-flash {
  position: absolute;
  inset: -6px;
  border-radius: 14px;
  background: radial-gradient(
    circle,
    rgba(90, 255, 200, 0.7) 0%,
    rgba(90, 255, 200, 0) 70%
  );
  animation: automation-flash-anim 0.3s ease-out forwards;
  pointer-events: none;
}

.automation-indicator.type-resolve .automation-flash {
  background: radial-gradient(
    circle,
    rgba(90, 255, 138, 0.7) 0%,
    rgba(90, 255, 138, 0) 70%
  );
}

.automation-indicator.type-dedup .automation-flash {
  background: radial-gradient(
    circle,
    rgba(90, 255, 255, 0.7) 0%,
    rgba(90, 255, 255, 0) 70%
  );
}

@keyframes automation-flash-anim {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

/* Flash state on indicator itself */
.automation-indicator.flash {
  box-shadow: 0 0 20px rgba(90, 255, 200, 0.6);
}

.automation-indicator.flash.type-resolve {
  box-shadow: 0 0 20px rgba(90, 255, 138, 0.6);
}

.automation-indicator.flash.type-dedup {
  box-shadow: 0 0 20px rgba(90, 255, 255, 0.6);
}

/* ============================================
   TIER INDICATOR (●●●○○ pips)
   ============================================ */

.tier-indicator {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: rgba(40, 40, 60, 0.8);
  border: 2px solid #4a4a6a;
  border-radius: 10px;
  transition: all 0.3s ease;
}

.tier-pip {
  font-size: 12px;
  color: #4a4a6a;
  transition: all 0.3s ease;
  line-height: 1;
}

.tier-pip.filled {
  color: #5affff;
  text-shadow: 0 0 6px rgba(90, 255, 255, 0.5);
}

.tier-pip.current {
  color: #5affff;
  text-shadow: 0 0 8px rgba(90, 255, 255, 0.7);
  animation: tier-pip-pulse 2s ease-in-out infinite;
}

/* Tier-up celebration state */
.tier-indicator.celebrating {
  border-color: #5affff;
  box-shadow: 0 0 20px rgba(90, 255, 255, 0.5);
  animation: tier-celebration-shake 0.5s ease-out;
}

.tier-pip.new-tier {
  animation: tier-pip-new 0.5s ease-out;
  color: #ffffff;
  text-shadow:
    0 0 12px rgba(90, 255, 255, 1),
    0 0 24px rgba(90, 255, 255, 0.6);
}

/* Celebration flash overlay */
.tier-celebration-flash {
  position: absolute;
  inset: -8px;
  border-radius: 14px;
  background: radial-gradient(
    circle,
    rgba(90, 255, 255, 0.6) 0%,
    rgba(90, 255, 255, 0) 70%
  );
  animation: tier-flash-anim 0.5s ease-out forwards;
  pointer-events: none;
}

/* Tier animations */
@keyframes tier-pip-pulse {
  0%,
  100% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
}

@keyframes tier-pip-new {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.8);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes tier-celebration-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  10%,
  30%,
  50%,
  70%,
  90% {
    transform: translateX(-2px);
  }
  20%,
  40%,
  60%,
  80% {
    transform: translateX(2px);
  }
}

@keyframes tier-flash-anim {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.8);
  }
}
</style>
