// Journey Animation
// Shows the complete game loop: spawn → dive → cascade → resolve → merge → stable → exit → fill → ship → tier
// Demonstrates resource interplay: Bandwidth, Weight, Efficiency, Stability, Cache Tokens
// Larger canvas (320×220), 16 second loop

import { TeachingColors, hexToCSS } from './base-animation'
import { Colors } from '../../rendering/colors'

// Journey-specific dimensions (larger than standard animations)
const JOURNEY_WIDTH = 320
const JOURNEY_HEIGHT = 220

// Phase definitions (~16.25 second loop)
const PHASES = {
  spawn: { start: 0, end: 0.089, index: 0 }, // 1.45s - click root, bandwidth depletes, weight +
  dive: { start: 0.089, end: 0.148, index: 1 }, // 1s - enter scope
  cascade: { start: 0.148, end: 0.276, index: 2 }, // 2s - deps spawn, problems appear, efficiency drops
  resolve: { start: 0.276, end: 0.374, index: 3 }, // 1.6s - click conflict, bandwidth gains
  merge: { start: 0.374, end: 0.463, index: 4 }, // 1.45s - drag duplicate, bandwidth gains, efficiency recovers
  stable: { start: 0.463, end: 0.522, index: 5 }, // 1s - scope stable, badge turns green
  exit: { start: 0.522, end: 0.581, index: 6 }, // 1s - exit scope
  fill: { start: 0.581, end: 0.65, index: 7 }, // 1.1s - weight fills quickly
  ship: { start: 0.65, end: 0.823, index: 8 }, // 2.8s - ship, show reward comparison (+250ms hold)
  tier: { start: 0.823, end: 1.0, index: 9 }, // 2.9s - tokens → tier arc → depth increases
} as const

type PhaseKey = keyof typeof PHASES

/**
 * Journey Animation - Full game loop demonstration
 * Shows all resources: Bandwidth, Weight, Efficiency, Stability, Cache Tokens
 */
export class JourneyAnimation {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private isRunning = false
  private animationTime = 0
  private lastTime = 0
  private animationFrameId: number | null = null
  private currentPhaseIndex = 0

  // Callback for phase changes
  public onPhaseChange: ((phase: number) => void) | null = null

  // Animation state - Resources
  private bandwidthFill = 0.8 // 0-1 (depletes on actions, regenerates)
  private weightBarFill = 0.2 // 0-1 (fills toward prestige)
  private efficiencyFill = 1.0 // 0-1 (affected by problems)
  private scopeStableCount = 0 // stable scopes
  private scopeTotalCount = 0 // total entered scopes

  // Animation state - Scene
  private isInScope = false
  private hasConflict = false
  private hasDuplicates = false
  private scopeStable = false
  private shipButtonVisible = false
  private showReward = false
  private rewardTokens = 0

  // Animation state - Cascade spawning (phase 3)
  private cascadeNodesVisible = 0 // 0-3: how many internal nodes are visible
  private cascadeSpawnProgress = 0 // 0-1: current node spawn animation

  // Animation state - Merge (phase 5)
  private mergeProgress = 0 // 0-1: node3 animating into node2
  private node3Merged = false // true after merge complete

  // Animation state - Badge (phase 6/7)
  private badgeState: 'none' | 'red' | 'green' = 'none'

  // Animation state - Tier phase (phase 10)
  private tierArcProgress = 0 // 0-1: how filled the arc segment is
  private depthValue = 2 // 2 or 3: current depth indicator (starts at 2, unlocks 3)
  private tokenFlyProgress = 0 // 0-1: tokens flying to arc
  private depthPulseTime = 0 // for depth change pulse effect

  protected loopDuration = 16250 // 16.25 second loop (+250ms hold after efficiency teaching)

  async init(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    if (!this.ctx) {
      console.error('Failed to get 2D context')
      return
    }

    // Set canvas size with device pixel ratio
    const dpr = window.devicePixelRatio || 1
    canvas.width = JOURNEY_WIDTH * dpr
    canvas.height = JOURNEY_HEIGHT * dpr
    canvas.style.width = `${JOURNEY_WIDTH}px`
    canvas.style.height = `${JOURNEY_HEIGHT}px`
    this.ctx.scale(dpr, dpr)

    this.setup()
  }

  private setup(): void {
    // Reset animation state - Resources
    this.bandwidthFill = 0.8
    this.weightBarFill = 0.2
    this.efficiencyFill = 1.0
    this.scopeStableCount = 0
    this.scopeTotalCount = 0

    // Reset animation state - Scene
    this.isInScope = false
    this.hasConflict = false
    this.hasDuplicates = false
    this.scopeStable = false
    this.shipButtonVisible = false
    this.showReward = false
    this.rewardTokens = 0
    this.currentPhaseIndex = 0

    // Reset cascade/merge/badge state
    this.cascadeNodesVisible = 0
    this.cascadeSpawnProgress = 0
    this.mergeProgress = 0
    this.node3Merged = false
    this.badgeState = 'none'

    // Reset tier phase state
    this.tierArcProgress = 0
    this.depthValue = 2 // Starts at 2, unlocks 3
    this.tokenFlyProgress = 0
    this.depthPulseTime = 0
  }

  start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.lastTime = performance.now()
    this.tick()
  }

  stop(): void {
    this.isRunning = false
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  destroy(): void {
    this.stop()
    this.canvas = null
    this.ctx = null
    this.onPhaseChange = null
  }

  private tick = (): void => {
    if (!this.isRunning || !this.ctx || !this.canvas) return

    const now = performance.now()
    const delta = now - this.lastTime
    this.lastTime = now

    this.animationTime += delta
    if (this.animationTime >= this.loopDuration) {
      this.animationTime = this.animationTime % this.loopDuration
      this.setup() // Reset state on loop
    }

    const progress = this.animationTime / this.loopDuration

    // Determine current phase and notify if changed
    const newPhaseIndex = this.getPhaseIndex(progress)
    if (newPhaseIndex !== this.currentPhaseIndex) {
      this.currentPhaseIndex = newPhaseIndex
      this.onPhaseChange?.(newPhaseIndex)
    }

    // Clear and draw
    this.ctx.fillStyle = TeachingColors.background
    this.ctx.fillRect(0, 0, JOURNEY_WIDTH, JOURNEY_HEIGHT)

    this.update(progress)

    this.animationFrameId = requestAnimationFrame(this.tick)
  }

  private getPhaseIndex(progress: number): number {
    for (const [, phase] of Object.entries(PHASES)) {
      if (progress >= phase.start && progress < phase.end) {
        return phase.index
      }
    }
    return 9 // Default to last phase (tier)
  }

  private getPhaseProgress(progress: number, phase: PhaseKey): number {
    const p = PHASES[phase]
    if (progress < p.start) return 0
    if (progress >= p.end) return 1
    return (progress - p.start) / (p.end - p.start)
  }

  private update(progress: number): void {
    // Update animation state based on progress
    this.updateState(progress)

    // Draw UI elements (top area - matching actual HUD layout)
    this.drawBandwidthBar()
    this.drawWeightBar()
    this.drawEfficiencyBar()
    this.drawStabilityBar()

    // Draw main scene
    this.drawMainScene(progress)

    // Draw cursor (foreground)
    this.drawCursorForPhase(progress)

    // Draw reward overlay during ship phase (not during tier phase)
    if (this.showReward && progress < PHASES.tier.start) {
      this.drawRewardOverlay(progress)
    }

    // Draw tier phase overlay
    if (progress >= PHASES.tier.start) {
      this.drawTierPhase(progress)
    }
  }

  private updateState(progress: number): void {
    // Passive bandwidth regen (throughout animation)
    const baseRegen = 0.002 // per frame roughly

    // ============================================
    // PHASE 1: SPAWN - Click root, bandwidth depletes, package appears, weight +
    // ============================================
    if (progress >= PHASES.spawn.start && progress < PHASES.spawn.end) {
      const t = this.getPhaseProgress(progress, 'spawn')
      if (t < 0.4) {
        // Cursor moving to root
        this.bandwidthFill = Math.min(1, this.bandwidthFill + baseRegen)
      } else if (t < 0.5) {
        // Click! Bandwidth depletes (install cost)
        this.bandwidthFill = 0.5 // -30% cost
      } else {
        // Package spawns, weight increases
        this.weightBarFill = 0.2 + (t - 0.5) * 0.2 // 0.2 → 0.3
        this.bandwidthFill = Math.min(1, 0.5 + (t - 0.5) * baseRegen * 50) // slow regen
      }
    }

    // ============================================
    // PHASE 2: DIVE - Click package to enter scope
    // ============================================
    if (progress >= PHASES.dive.start && progress < PHASES.dive.end) {
      const t = this.getPhaseProgress(progress, 'dive')
      if (t > 0.5) {
        this.isInScope = true
        this.scopeTotalCount = 1 // Entered 1 scope
        this.scopeStableCount = 0 // Not stable yet
      }
      this.bandwidthFill = Math.min(1, this.bandwidthFill + baseRegen)
    }

    // ============================================
    // PHASE 3: CASCADE - Deps spawn in sequence, then problems appear
    // ============================================
    if (progress >= PHASES.cascade.start && progress < PHASES.cascade.end) {
      const t = this.getPhaseProgress(progress, 'cascade')

      // Badge shows red (unstable) once we enter scope with cascade
      this.badgeState = 'red'

      // Spawn nodes progressively: 0-20% node1, 20-40% node2, 40-60% node3
      if (t < 0.2) {
        this.cascadeNodesVisible = 0
        this.cascadeSpawnProgress = t / 0.2 // Spawning node 1
      } else if (t < 0.4) {
        this.cascadeNodesVisible = 1
        this.cascadeSpawnProgress = (t - 0.2) / 0.2 // Spawning node 2
        this.weightBarFill = 0.3 + 0.08 // First node adds weight
      } else if (t < 0.6) {
        this.cascadeNodesVisible = 2
        this.cascadeSpawnProgress = (t - 0.4) / 0.2 // Spawning node 3
        this.weightBarFill = 0.38 + 0.08 // Second node adds weight
      } else {
        this.cascadeNodesVisible = 3
        this.cascadeSpawnProgress = 1
        this.weightBarFill = 0.46 + 0.09 // Third node adds weight
      }

      // Problems appear AFTER all nodes spawned (60-100%)
      if (t > 0.65) {
        this.hasConflict = true
        this.efficiencyFill = 0.7 // Conflict drops efficiency
      }
      if (t > 0.8) {
        this.hasDuplicates = true
        this.efficiencyFill = 0.4 // Duplicates drop it more
      }

      // Bandwidth slowly drains during cascade
      this.bandwidthFill = Math.max(0.2, this.bandwidthFill - 0.002)
    }

    // ============================================
    // PHASE 4: RESOLVE - Click conflict, bandwidth GAINS, efficiency recovers
    // ============================================
    if (progress >= PHASES.resolve.start && progress < PHASES.resolve.end) {
      const t = this.getPhaseProgress(progress, 'resolve')

      if (t < 0.5) {
        // Cursor moving to conflict
      } else if (t < 0.6) {
        // Click! Conflict resolved, bandwidth GAINS
        this.hasConflict = false
        this.bandwidthFill = Math.min(1, this.bandwidthFill + 0.15) // +15 momentum
        this.efficiencyFill = 0.55 // Partially recovers (was 0.4)
      } else {
        // Continue with slight regen
        this.bandwidthFill = Math.min(1, this.bandwidthFill + baseRegen)
      }
    }

    // ============================================
    // PHASE 5: MERGE - Drag node3 into node2, node3 disappears
    // ============================================
    if (progress >= PHASES.merge.start && progress < PHASES.merge.end) {
      const t = this.getPhaseProgress(progress, 'merge')

      if (t < 0.6) {
        // Dragging node3 toward node2
        this.mergeProgress = t / 0.6 // 0→1 as node3 moves to node2
      } else if (t < 0.7) {
        // Merge complete! Node3 absorbed
        this.mergeProgress = 1
        this.node3Merged = true
        this.hasDuplicates = false
        this.bandwidthFill = Math.min(1, this.bandwidthFill + 0.2) // +20 momentum
        this.weightBarFill = Math.max(0.2, this.weightBarFill - 0.08) // Weight saved
        this.efficiencyFill = 0.85 // Major recovery
      } else {
        this.bandwidthFill = Math.min(1, this.bandwidthFill + baseRegen)
      }
    }

    // ============================================
    // PHASE 6: STABLE - Scope has 0 problems → badge turns green, bandwidth burst
    // ============================================
    if (progress >= PHASES.stable.start && progress < PHASES.stable.end) {
      const t = this.getPhaseProgress(progress, 'stable')

      if (t > 0.3 && !this.scopeStable) {
        this.scopeStable = true
        this.scopeStableCount = 1 // 1 stable scope
        this.badgeState = 'green' // Badge transitions red → green
        this.bandwidthFill = Math.min(1, this.bandwidthFill + 0.3) // +50 burst (big!)
        this.efficiencyFill = 0.95 // Fully clean
      }
    }

    // ============================================
    // PHASE 7: EXIT - Leave scope, stability persists
    // ============================================
    if (progress >= PHASES.exit.start && progress < PHASES.exit.end) {
      const t = this.getPhaseProgress(progress, 'exit')
      if (t > 0.5) {
        this.isInScope = false
      }
      this.bandwidthFill = Math.min(1, this.bandwidthFill + baseRegen)
    }

    // ============================================
    // PHASE 8: FILL - Weight fills to threshold, ship button appears
    // ============================================
    if (progress >= PHASES.fill.start && progress < PHASES.fill.end) {
      const t = this.getPhaseProgress(progress, 'fill')

      // Weight fills to threshold quickly
      this.weightBarFill = Math.min(1.0, 0.47 + t * 0.55) // Fill to ~100%

      // Ship button appears when weight reaches threshold
      this.shipButtonVisible = this.weightBarFill >= 0.9

      this.bandwidthFill = Math.min(1, this.bandwidthFill + baseRegen)
    }

    // ============================================
    // PHASE 9: SHIP - Show reward calculation and tokens
    // ============================================
    if (progress >= PHASES.ship.start && progress < PHASES.ship.end) {
      const t = this.getPhaseProgress(progress, 'ship')
      this.shipButtonVisible = true

      if (t > 0.3 && !this.showReward) {
        // Calculate reward: base × efficiency (0.5-1.5) × stability (0.7-1.0)
        const effMult = 0.5 + this.efficiencyFill // 0.5 + 0.95 = 1.45
        const stabMult =
          0.7 +
          (this.scopeStableCount / Math.max(1, this.scopeTotalCount)) * 0.3 // 1.0
        this.rewardTokens = Math.floor(3 * effMult * stabMult) // ~4 tokens
        this.showReward = true
      }
    }

    // ============================================
    // PHASE 10: TIER - Tokens fly to arc, arc fills, depth increases
    // ============================================
    if (progress >= PHASES.tier.start) {
      const t = this.getPhaseProgress(progress, 'tier')

      // Tokens fly toward tier arc (0-40%)
      if (t < 0.4) {
        this.tokenFlyProgress = t / 0.4
      } else {
        this.tokenFlyProgress = 1
      }

      // Arc fills as tokens arrive (20-70%)
      if (t >= 0.2 && t < 0.7) {
        this.tierArcProgress = (t - 0.2) / 0.5 // 0→1 over 50% of phase
      } else if (t >= 0.7) {
        this.tierArcProgress = 1
      }

      // Depth changes from 2 to 3 at 70%
      if (t >= 0.7 && this.depthValue === 2) {
        this.depthValue = 3
        this.depthPulseTime = Date.now()
      }
    }
  }

  // ============================================
  // UI ELEMENTS (Mini HUD matching actual game)
  // ============================================

  private drawBandwidthBar(): void {
    if (!this.ctx) return

    const x = 10
    const y = 8
    const segmentWidth = 6
    const segmentHeight = 14
    const gap = 2
    const segments = 8

    // Icon
    this.ctx.font = '14px system-ui'
    this.ctx.fillStyle = hexToCSS(0x7a7aff, 0.9)
    this.ctx.fillText('↓', x, y + segmentHeight - 2)

    // Segmented bar
    const barX = x + 18
    for (let i = 0; i < segments; i++) {
      const segX = barX + i * (segmentWidth + gap)
      const isFilled = i < Math.floor(this.bandwidthFill * segments)
      const isPartial =
        i === Math.floor(this.bandwidthFill * segments) &&
        (this.bandwidthFill * segments) % 1 > 0

      // Track
      this.ctx.fillStyle = 'rgba(122, 122, 255, 0.15)'
      this.ctx.fillRect(segX, y, segmentWidth, segmentHeight)

      // Fill
      if (isFilled) {
        this.ctx.fillStyle = hexToCSS(0x7a7aff, 0.9)
        this.ctx.fillRect(segX, y, segmentWidth, segmentHeight)
      } else if (isPartial) {
        const partialHeight =
          segmentHeight * ((this.bandwidthFill * segments) % 1)
        this.ctx.fillStyle = hexToCSS(0x7a7aff, 0.9)
        this.ctx.fillRect(
          segX,
          y + segmentHeight - partialHeight,
          segmentWidth,
          partialHeight
        )
      }
    }
  }

  private drawWeightBar(): void {
    if (!this.ctx) return

    const x = 10
    const y = 28
    const segmentWidth = 6
    const segmentHeight = 14
    const gap = 2
    const segments = 8

    // Icon
    this.ctx.font = '14px system-ui'
    this.ctx.fillStyle = hexToCSS(Colors.accentOrange, 0.9)
    this.ctx.fillText('◆', x, y + segmentHeight - 2)

    // Segmented bar
    const barX = x + 18
    for (let i = 0; i < segments; i++) {
      const segX = barX + i * (segmentWidth + gap)
      const isFilled = i < Math.floor(this.weightBarFill * segments)
      const isPartial =
        i === Math.floor(this.weightBarFill * segments) &&
        (this.weightBarFill * segments) % 1 > 0
      const isLast = i === segments - 1

      // Track
      this.ctx.fillStyle = 'rgba(255, 170, 90, 0.15)'
      this.ctx.fillRect(segX, y, segmentWidth, segmentHeight)

      // Fill
      if (isFilled) {
        // Last segment glows purple when full (prestige ready)
        const fillColor =
          isLast && this.weightBarFill >= 0.95
            ? TeachingColors.prestige
            : Colors.accentOrange
        this.ctx.fillStyle = hexToCSS(fillColor, 0.9)
        this.ctx.fillRect(segX, y, segmentWidth, segmentHeight)
      } else if (isPartial) {
        const partialHeight =
          segmentHeight * ((this.weightBarFill * segments) % 1)
        this.ctx.fillStyle = hexToCSS(Colors.accentOrange, 0.9)
        this.ctx.fillRect(
          segX,
          y + segmentHeight - partialHeight,
          segmentWidth,
          partialHeight
        )
      }

      // Last segment border (prestige threshold marker)
      if (isLast) {
        this.ctx.strokeStyle = hexToCSS(TeachingColors.prestige, 0.5)
        this.ctx.lineWidth = 1
        this.ctx.strokeRect(segX, y, segmentWidth, segmentHeight)
      }
    }
  }

  private drawEfficiencyBar(): void {
    if (!this.ctx) return

    const x = JOURNEY_WIDTH - 75
    const y = 8
    const barWidth = 45
    const barHeight = 10

    // Icon
    this.ctx.font = '14px system-ui'
    const iconColor =
      this.efficiencyFill < 0.5
        ? Colors.borderConflict
        : this.efficiencyFill < 0.85
          ? Colors.accentOrange
          : 0x5aff8a
    this.ctx.fillStyle = hexToCSS(iconColor, 0.9)
    this.ctx.fillText('⚡', x - 16, y + barHeight)

    // Bar track
    this.ctx.fillStyle = 'rgba(40, 35, 55, 0.9)'
    this.ctx.fillRect(x, y, barWidth, barHeight)

    // Bar fill (gradient: red → orange → cyan)
    const fillWidth = barWidth * this.efficiencyFill
    if (fillWidth > 0) {
      const gradient = this.ctx.createLinearGradient(x, y, x + barWidth, y)
      gradient.addColorStop(0, '#ff5a5a')
      gradient.addColorStop(0.4, '#ffaa5a')
      gradient.addColorStop(1, '#5affff')
      this.ctx.fillStyle = gradient
      this.ctx.fillRect(x, y, fillWidth, barHeight)
    }

    // 50% threshold marker
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    this.ctx.fillRect(x + barWidth * 0.5 - 1, y - 1, 2, barHeight + 2)

    // Multiplier indicator (▼ penalty, ▲ bonus, ▲▲ excellent)
    const multX = x + barWidth + 4
    this.ctx.font = 'bold 11px system-ui'
    if (this.efficiencyFill < 0.5) {
      // Penalty
      this.ctx.fillStyle = '#ff5a5a'
      this.ctx.fillText('▼', multX, y + barHeight - 1)
    } else if (this.efficiencyFill < 0.85) {
      // Bonus
      this.ctx.fillStyle = '#5affaa'
      this.ctx.fillText('▲', multX, y + barHeight - 1)
    } else {
      // Excellent
      this.ctx.fillStyle = '#5affff'
      this.ctx.fillText('▲▲', multX, y + barHeight - 1)
    }
  }

  private drawStabilityBar(): void {
    if (!this.ctx) return

    const x = JOURNEY_WIDTH - 75
    const y = 24
    const barWidth = 45
    const barHeight = 10

    // Icon
    this.ctx.font = '14px system-ui'
    const isStable =
      this.scopeTotalCount > 0 && this.scopeStableCount === this.scopeTotalCount
    const iconColor = isStable ? 0x5aff8a : 0x8a8aaa
    this.ctx.fillStyle = hexToCSS(iconColor, 0.9)
    this.ctx.fillText('✓', x - 16, y + barHeight)

    // Bar track
    this.ctx.fillStyle = 'rgba(40, 35, 55, 0.9)'
    this.ctx.fillRect(x, y, barWidth, barHeight)

    // Bar fill
    const stabilityRatio =
      this.scopeTotalCount > 0
        ? this.scopeStableCount / this.scopeTotalCount
        : 1
    const fillWidth = barWidth * stabilityRatio
    if (fillWidth > 0) {
      const gradient = this.ctx.createLinearGradient(x, y, x + barWidth, y)
      gradient.addColorStop(0, '#ff8a5a')
      gradient.addColorStop(1, '#5aff8a')
      this.ctx.fillStyle = gradient
      this.ctx.fillRect(x, y, fillWidth, barHeight)
    }

    // Scope dots (below bar)
    if (this.scopeTotalCount > 0) {
      const dotY = y + barHeight + 6
      const dotSize = 5
      const dotGap = 3

      for (let i = 0; i < this.scopeTotalCount; i++) {
        const dotX = x + i * (dotSize + dotGap)
        this.ctx.beginPath()
        this.ctx.arc(dotX + dotSize / 2, dotY, dotSize / 2, 0, Math.PI * 2)

        if (i < this.scopeStableCount) {
          // Stable scope = green
          this.ctx.fillStyle = '#5aff8a'
        } else {
          // Unstable scope = orange
          this.ctx.fillStyle = 'rgba(255, 138, 90, 0.6)'
        }
        this.ctx.fill()
      }
    }
  }

  /**
   * Draw reward comparison: two scenarios side-by-side (no text, visual only)
   * Left: Low efficiency → fewer tokens
   * Right: High efficiency → more tokens
   */
  private drawRewardOverlay(progress: number): void {
    if (!this.ctx) return

    const t = this.getPhaseProgress(progress, 'ship')
    const fadeIn = Math.min(1, (t - 0.3) / 0.2)

    // Semi-transparent overlay
    this.ctx.fillStyle = `rgba(20, 10, 40, ${0.75 * fadeIn})`
    this.ctx.fillRect(0, 0, JOURNEY_WIDTH, JOURNEY_HEIGHT)

    const leftX = JOURNEY_WIDTH * 0.28
    const rightX = JOURNEY_WIDTH * 0.72
    const barY = JOURNEY_HEIGHT / 2 - 25
    const tokenY = JOURNEY_HEIGHT / 2 + 20

    // Left side: Low efficiency scenario (dimmed)
    this.drawEfficiencyComparison(leftX, barY, tokenY, 0.3, 2, fadeIn * 0.6)

    // Right side: High efficiency scenario (bright, current state)
    this.drawEfficiencyComparison(
      rightX,
      barY,
      tokenY,
      this.efficiencyFill,
      this.rewardTokens,
      fadeIn
    )

    // Arrow from left to right showing "this is better"
    if (t > 0.6) {
      const arrowFade = Math.min(1, (t - 0.6) / 0.2)
      this.drawComparisonArrow(JOURNEY_WIDTH / 2, barY + 15, arrowFade)
    }
  }

  /**
   * Draw a single efficiency → tokens comparison
   */
  private drawEfficiencyComparison(
    x: number,
    barY: number,
    tokenY: number,
    efficiency: number,
    tokens: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const barWidth = 50
    const barHeight = 12

    // Efficiency icon
    this.ctx.font = '16px system-ui'
    this.ctx.textAlign = 'center'
    const effColor =
      efficiency < 0.5 ? 0xff5a5a : efficiency < 0.85 ? 0xffaa5a : 0x5affff
    this.ctx.fillStyle = hexToCSS(effColor, alpha)
    this.ctx.fillText('⚡', x, barY - 5)

    // Efficiency bar
    const barX = x - barWidth / 2
    this.ctx.fillStyle = `rgba(40, 35, 55, ${0.9 * alpha})`
    this.ctx.fillRect(barX, barY, barWidth, barHeight)

    // Bar fill
    const fillWidth = barWidth * efficiency
    if (fillWidth > 0) {
      const gradient = this.ctx.createLinearGradient(
        barX,
        barY,
        barX + barWidth,
        barY
      )
      gradient.addColorStop(0, `rgba(255, 90, 90, ${alpha})`)
      gradient.addColorStop(0.4, `rgba(255, 170, 90, ${alpha})`)
      gradient.addColorStop(1, `rgba(90, 255, 255, ${alpha})`)
      this.ctx.fillStyle = gradient
      this.ctx.fillRect(barX, barY, fillWidth, barHeight)
    }

    // Multiplier indicator
    this.ctx.font = 'bold 12px system-ui'
    if (efficiency < 0.5) {
      this.ctx.fillStyle = hexToCSS(0xff5a5a, alpha)
      this.ctx.fillText('▼', x + barWidth / 2 + 10, barY + barHeight - 2)
    } else {
      this.ctx.fillStyle = hexToCSS(0x5affff, alpha)
      this.ctx.fillText('▲', x + barWidth / 2 + 10, barY + barHeight - 2)
    }

    // Down arrow to tokens
    this.ctx.strokeStyle = `rgba(150, 150, 170, ${alpha * 0.6})`
    this.ctx.lineWidth = 2
    this.ctx.beginPath()
    this.ctx.moveTo(x, barY + barHeight + 8)
    this.ctx.lineTo(x, tokenY - 15)
    this.ctx.stroke()
    // Arrow head
    this.ctx.beginPath()
    this.ctx.moveTo(x - 4, tokenY - 20)
    this.ctx.lineTo(x, tokenY - 14)
    this.ctx.lineTo(x + 4, tokenY - 20)
    this.ctx.stroke()

    // Tokens
    this.ctx.font = 'bold 20px system-ui'
    this.ctx.fillStyle = hexToCSS(0x5affff, alpha)
    const tokenSpacing = 18
    const tokenStartX = x - ((tokens - 1) * tokenSpacing) / 2
    for (let i = 0; i < tokens; i++) {
      this.ctx.fillText('⟲', tokenStartX + i * tokenSpacing, tokenY + 5)
    }
  }

  /**
   * Draw arrow between comparisons showing "better"
   */
  private drawComparisonArrow(x: number, y: number, alpha: number): void {
    if (!this.ctx) return

    // Curved arrow from left to right
    this.ctx.strokeStyle = hexToCSS(0x5aff8a, alpha * 0.8)
    this.ctx.lineWidth = 2

    // Arrow body
    this.ctx.beginPath()
    this.ctx.moveTo(x - 30, y)
    this.ctx.lineTo(x + 25, y)
    this.ctx.stroke()

    // Arrow head pointing right
    this.ctx.beginPath()
    this.ctx.moveTo(x + 20, y - 5)
    this.ctx.lineTo(x + 28, y)
    this.ctx.lineTo(x + 20, y + 5)
    this.ctx.stroke()
  }

  /**
   * Draw Phase 10: Tier arc filling + depth indicator changing
   * Shows tokens → tier arc → depth increase (1→2)
   */
  private drawTierPhase(progress: number): void {
    if (!this.ctx) return

    const t = this.getPhaseProgress(progress, 'tier')
    const fadeIn = Math.min(1, t / 0.15)

    // Semi-transparent overlay
    this.ctx.fillStyle = `rgba(20, 10, 40, ${0.8 * fadeIn})`
    this.ctx.fillRect(0, 0, JOURNEY_WIDTH, JOURNEY_HEIGHT)

    const cx = JOURNEY_WIDTH / 2
    const cy = JOURNEY_HEIGHT / 2

    // Draw tier arc (simplified version of PrestigeOrbit arc)
    this.drawTierArc(cx, cy - 10, fadeIn)

    // Draw tokens flying to arc
    this.drawFlyingTokens(cx, cy - 10, fadeIn)

    // Draw depth indicator below
    this.drawDepthIndicator(cx, cy + 60, fadeIn)
  }

  /**
   * Draw the tier arc segment (single quadrant)
   */
  private drawTierArc(cx: number, cy: number, alpha: number): void {
    if (!this.ctx) return

    const radius = 50
    const lineWidth = 6

    // Arc track (unfilled background)
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius, -Math.PI / 2, 0) // Top-right quadrant
    this.ctx.strokeStyle = `rgba(60, 60, 80, ${0.4 * alpha})`
    this.ctx.lineWidth = lineWidth
    this.ctx.stroke()

    // Arc fill (animated progress)
    if (this.tierArcProgress > 0) {
      const endAngle = -Math.PI / 2 + (Math.PI / 2) * this.tierArcProgress
      this.ctx.beginPath()
      this.ctx.arc(cx, cy, radius, -Math.PI / 2, endAngle)

      // Gradient color based on progress
      const gradient = this.ctx.createLinearGradient(
        cx,
        cy - radius,
        cx + radius,
        cy
      )
      gradient.addColorStop(0, `rgba(90, 170, 255, ${alpha})`) // Tier 2 blue
      gradient.addColorStop(1, `rgba(90, 255, 200, ${alpha})`) // Tier 3 cyan-green

      this.ctx.strokeStyle = gradient
      this.ctx.lineWidth = lineWidth
      this.ctx.lineCap = 'round'
      this.ctx.stroke()
      this.ctx.lineCap = 'butt'

      // Glow effect when nearly full
      if (this.tierArcProgress > 0.8) {
        const glowAlpha = (this.tierArcProgress - 0.8) / 0.2
        this.ctx.shadowColor = `rgba(90, 255, 200, ${glowAlpha * alpha})`
        this.ctx.shadowBlur = 12
        this.ctx.stroke()
        this.ctx.shadowBlur = 0
      }
    }

    // Tier icon at end of arc (right side)
    const iconX = cx + radius + 12
    const iconY = cy
    this.ctx.font = 'bold 16px system-ui'
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'

    // Icon brightness based on arc progress
    const iconBrightness =
      this.tierArcProgress >= 1 ? 1 : 0.3 + this.tierArcProgress * 0.4
    this.ctx.fillStyle = hexToCSS(0x5affc8, iconBrightness * alpha)
    if (this.tierArcProgress >= 1) {
      this.ctx.shadowColor = 'rgba(90, 255, 200, 0.8)'
      this.ctx.shadowBlur = 8
    }
    this.ctx.fillText('⟲', iconX, iconY)
    this.ctx.shadowBlur = 0
    this.ctx.textAlign = 'left'
    this.ctx.textBaseline = 'alphabetic'
  }

  /**
   * Draw tokens flying toward the tier arc
   */
  private drawFlyingTokens(cx: number, cy: number, alpha: number): void {
    if (!this.ctx) return

    const tokenCount = 3
    const startY = cy + 80 // Start from bottom
    const radius = 50

    // Target position (arc center point)
    const targetX = cx + radius * Math.cos(-Math.PI / 4) // 45° into the arc
    const targetY = cy + radius * Math.sin(-Math.PI / 4)

    for (let i = 0; i < tokenCount; i++) {
      // Stagger each token's progress
      const delay = i * 0.15
      const tokenProgress = Math.max(
        0,
        Math.min(1, (this.tokenFlyProgress - delay) / (1 - delay * 2))
      )

      if (tokenProgress <= 0) continue

      // Calculate position along path
      const startX = cx - 30 + i * 30
      const x = this.lerp(startX, targetX, this.easeInOut(tokenProgress))
      const y = this.lerp(startY, targetY, this.easeInOut(tokenProgress))

      // Fade out as approaching target
      const tokenAlpha = tokenProgress < 0.8 ? 1 : (1 - tokenProgress) / 0.2

      // Scale down as approaching
      const scale =
        tokenProgress < 0.7 ? 1 : 1 - ((tokenProgress - 0.7) / 0.3) * 0.5

      if (tokenAlpha > 0) {
        this.ctx.font = `bold ${18 * scale}px system-ui`
        this.ctx.textAlign = 'center'
        this.ctx.fillStyle = hexToCSS(0x5affff, tokenAlpha * alpha)
        this.ctx.shadowColor = 'rgba(90, 255, 255, 0.6)'
        this.ctx.shadowBlur = 6 * scale
        this.ctx.fillText('⟲', x, y)
        this.ctx.shadowBlur = 0
        this.ctx.textAlign = 'left'
      }
    }
  }

  /**
   * Draw depth indicator (2 → 3)
   */
  private drawDepthIndicator(cx: number, cy: number, alpha: number): void {
    if (!this.ctx) return

    // Background panel
    const panelWidth = 90
    const panelHeight = 36
    this.ctx.fillStyle = `rgba(30, 25, 50, ${0.8 * alpha})`
    this.ctx.beginPath()
    this.ctx.roundRect(
      cx - panelWidth / 2,
      cy - panelHeight / 2,
      panelWidth,
      panelHeight,
      8
    )
    this.ctx.fill()
    this.ctx.strokeStyle = `rgba(90, 255, 200, ${0.3 * alpha})`
    this.ctx.lineWidth = 1
    this.ctx.stroke()

    // Depth label icon (↙ for depth)
    this.ctx.font = '14px system-ui'
    this.ctx.textAlign = 'center'
    this.ctx.fillStyle = `rgba(150, 150, 180, ${0.7 * alpha})`
    this.ctx.fillText('↙', cx - 30, cy + 5)

    // Depth value as dots (shows 3 slots, fills based on depthValue)
    const dotRadius = 5
    const dotGap = 6
    const totalDots = 3
    const dotsWidth = totalDots * dotRadius * 2 + (totalDots - 1) * dotGap
    const dotsStartX = cx - dotsWidth / 2 + dotRadius + 8

    // Pulse effect on change
    let pulse = 1
    if (this.depthPulseTime > 0) {
      const timeSinceChange = (Date.now() - this.depthPulseTime) / 1000
      if (timeSinceChange < 0.5) {
        pulse =
          1 +
          Math.sin(timeSinceChange * Math.PI * 4) *
            0.3 *
            (1 - timeSinceChange * 2)
      }
    }

    for (let i = 0; i < totalDots; i++) {
      const dotX = dotsStartX + i * (dotRadius * 2 + dotGap)
      const isFilled = i < this.depthValue
      const isNewDot = i === 2 && this.depthValue === 3

      this.ctx.beginPath()
      this.ctx.arc(dotX, cy, dotRadius * (isNewDot ? pulse : 1), 0, Math.PI * 2)

      if (isFilled) {
        // Filled dot - bright
        this.ctx.fillStyle = hexToCSS(0x5affc8, alpha)
        this.ctx.fill()

        // Glow for newly added dot (third dot when depth becomes 3)
        if (isNewDot) {
          this.ctx.shadowColor = 'rgba(90, 255, 200, 0.8)'
          this.ctx.shadowBlur = 10
          this.ctx.fill()
          this.ctx.shadowBlur = 0
        }
      } else {
        // Empty dot - dim outline
        this.ctx.strokeStyle = `rgba(90, 255, 200, ${0.3 * alpha})`
        this.ctx.lineWidth = 2
        this.ctx.stroke()
      }
    }

    this.ctx.textAlign = 'left'
  }

  // ============================================
  // MAIN SCENE
  // ============================================

  private drawMainScene(progress: number): void {
    if (!this.ctx) return

    const cx = JOURNEY_WIDTH / 2
    const cy = JOURNEY_HEIGHT / 2 + 20

    if (this.isInScope) {
      // Inside scope view
      this.drawScopeView(cx, cy, progress)
    } else {
      // Root view
      this.drawRootView(cx, cy, progress)
    }
  }

  private drawRootView(cx: number, cy: number, progress: number): void {
    if (!this.ctx) return

    // During ship animation, drawShipAnimation handles everything
    if (progress >= PHASES.ship.start) {
      // Ship button (bottom)
      this.drawShipButton(cx, cy + 60, progress)
      const t = this.getPhaseProgress(progress, 'ship')
      this.drawShipAnimation(cx, cy, t)
      return
    }

    // Root package (always green/ready)
    this.drawPackageNode(
      cx - 40,
      cy - 10,
      22,
      Colors.nodeReady,
      Colors.borderReady
    )

    // Spawned top-level package (after spawn phase)
    if (progress >= PHASES.spawn.end || progress >= PHASES.spawn.start) {
      const spawnT = this.getPhaseProgress(progress, 'spawn')
      const pkgX = cx + 30
      const pkgY = cy - 20

      if (progress < PHASES.spawn.end) {
        // Spawning animation - GREEN node with cyan portal ring + dive badge
        const eased = this.easeInOut(spawnT)
        const startX = cx - 40
        const startY = cy - 10
        const animX = this.lerp(startX, pkgX, eased)
        const animY = this.lerp(startY, pkgY, eased)
        const scale = eased

        if (scale > 0.1) {
          this.drawWire(
            cx - 40,
            cy - 10,
            animX,
            animY,
            Colors.wireDefault,
            2,
            eased
          )
          this.drawPackageNode(
            animX,
            animY,
            18 * scale,
            Colors.nodeReady,
            Colors.borderReady, // GREEN node
            eased
          )
          // Show cyan portal ring and dive badge once spawned enough
          if (scale > 0.6) {
            this.drawPortalRing(animX, animY, 22 * scale, false) // Dashed cyan ring
            this.drawDiveBadge(animX, animY, 18 * scale, eased)
          }
        }
      } else if (progress < PHASES.dive.end) {
        // Before/during dive - GREEN node with cyan portal ring + dive badge
        this.drawWire(cx - 40, cy - 10, pkgX, pkgY, Colors.wireDefault)
        this.drawPackageNode(
          pkgX,
          pkgY,
          18,
          Colors.nodeReady,
          Colors.borderReady
        ) // GREEN node
        this.drawPortalRing(pkgX, pkgY, 22, false) // Dashed cyan ring
        this.drawDiveBadge(pkgX, pkgY, 18, 1)
      } else if (this.isInScope) {
        // Inside scope - don't show packages in root view (scope view handles this)
      } else {
        // Exited scope: show root + 3 stabilized packages immediately
        const pkg1 = { x: cx + 30, y: cy - 30 }
        const pkg2 = { x: cx + 50, y: cy + 10 }
        const pkg3 = { x: cx - 10, y: cy + 25 }

        // Wires from root to all packages
        this.drawWire(
          cx - 40,
          cy - 10,
          pkg1.x,
          pkg1.y,
          Colors.wireDefault,
          2,
          0.6
        )
        this.drawWire(
          cx - 40,
          cy - 10,
          pkg2.x,
          pkg2.y,
          Colors.wireDefault,
          2,
          0.6
        )
        this.drawWire(
          cx - 40,
          cy - 10,
          pkg3.x,
          pkg3.y,
          Colors.wireDefault,
          2,
          0.6
        )

        // Package 1 - green (stable), no portal ring
        this.drawPackageNode(
          pkg1.x,
          pkg1.y,
          16,
          Colors.nodeReady,
          Colors.borderReady
        )
        this.drawStabilityBadge(pkg1.x, pkg1.y, 16, 1)

        // Package 2 - green (stable), no portal ring
        this.drawPackageNode(
          pkg2.x,
          pkg2.y,
          14,
          Colors.nodeReady,
          Colors.borderReady
        )
        this.drawStabilityBadge(pkg2.x, pkg2.y, 14, 1)

        // Package 3 - green (stable), no portal ring
        this.drawPackageNode(
          pkg3.x,
          pkg3.y,
          14,
          Colors.nodeReady,
          Colors.borderReady
        )
        this.drawStabilityBadge(pkg3.x, pkg3.y, 14, 1)
      }
    }

    // Ship button (bottom)
    if (this.shipButtonVisible || progress >= PHASES.fill.end) {
      this.drawShipButton(cx, cy + 60, progress)
    }
  }

  /**
   * Draw cyan dive badge (arrow down) below a node - indicates "click to explore"
   */
  private drawDiveBadge(
    x: number,
    y: number,
    nodeRadius: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const badgeRadius = 6
    const badgeY = y + nodeRadius + 5

    // Cyan circle
    this.ctx.beginPath()
    this.ctx.arc(x, badgeY, badgeRadius, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(0x22d3ee, 0.9 * alpha) // Cyan pristine color

    this.ctx.fill()

    // Down arrow
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`
    this.ctx.lineWidth = 1.5
    this.ctx.beginPath()
    this.ctx.moveTo(x, badgeY - 3)
    this.ctx.lineTo(x, badgeY + 2)
    this.ctx.moveTo(x - 2.5, badgeY)
    this.ctx.lineTo(x, badgeY + 3)
    this.ctx.lineTo(x + 2.5, badgeY)
    this.ctx.stroke()
  }

  private drawScopeView(cx: number, cy: number, _progress: number): void {
    if (!this.ctx) return

    // Scope background tint
    this.ctx.fillStyle = 'rgba(30, 25, 50, 0.3)'
    this.ctx.fillRect(0, 40, JOURNEY_WIDTH, JOURNEY_HEIGHT - 40)

    // Back button hint
    this.ctx.font = '16px system-ui'
    this.ctx.fillStyle = 'rgba(90, 200, 255, 0.6)'
    this.ctx.fillText('←', 20, JOURNEY_HEIGHT - 20)

    // Parent node (scope root) with badge - GREEN node
    const parentY = cy - 35
    this.drawPackageNode(
      cx,
      parentY,
      16,
      Colors.nodeReady,
      Colors.borderReady,
      0.5
    )
    this.drawScopeBadge(cx, parentY, 16)

    // Node positions
    const node1 = { x: cx - 40, y: cy + 15 }
    const node2 = { x: cx + 40, y: cy + 15 }
    const node3Base = { x: cx, y: cy + 50 }

    // Calculate node3 position (animates toward node2 during merge)
    const node3 = {
      x: this.lerp(node3Base.x, node2.x, this.easeInOut(this.mergeProgress)),
      y: this.lerp(node3Base.y, node2.y, this.easeInOut(this.mergeProgress)),
    }
    const node3Scale = 1 - this.mergeProgress * 0.8 // Shrinks as it merges
    const node3Alpha = 1 - this.mergeProgress // Fades as it merges

    // Draw wires first (behind nodes)
    // Wire: parent → node1 (spawns with node1)
    if (this.cascadeNodesVisible >= 1 || this.cascadeSpawnProgress > 0) {
      const alpha =
        this.cascadeNodesVisible >= 1 ? 0.6 : this.cascadeSpawnProgress * 0.6
      this.drawWire(
        cx,
        parentY,
        node1.x,
        node1.y,
        Colors.wireDefault,
        1.5,
        alpha
      )
    }

    // Wire: parent → node2 (spawns with node2)
    if (
      this.cascadeNodesVisible >= 2 ||
      (this.cascadeNodesVisible === 1 && this.cascadeSpawnProgress > 0)
    ) {
      const alpha =
        this.cascadeNodesVisible >= 2 ? 0.6 : this.cascadeSpawnProgress * 0.6
      this.drawWire(
        cx,
        parentY,
        node2.x,
        node2.y,
        Colors.wireDefault,
        1.5,
        alpha
      )
    }

    // Wire: node1 → node3 (conflict wire or normal)
    if (this.cascadeNodesVisible >= 3 && !this.node3Merged) {
      if (this.hasConflict) {
        this.drawWire(
          node1.x,
          node1.y,
          node3.x,
          node3.y,
          Colors.borderConflict,
          2,
          node3Alpha
        )
        this.drawConflictIcon(
          this.lerp(node1.x, node3.x, 0.5),
          this.lerp(node1.y, node3.y, 0.5),
          node3Alpha
        )
      } else {
        this.drawWire(
          node1.x,
          node1.y,
          node3.x,
          node3.y,
          Colors.wireDefault,
          1.5,
          0.6 * node3Alpha
        )
      }
    }

    // Draw node1 (first to spawn)
    if (this.cascadeNodesVisible >= 1) {
      this.drawPackageNode(
        node1.x,
        node1.y,
        14,
        Colors.nodeReady,
        Colors.borderReady
      )
    } else if (this.cascadeSpawnProgress > 0) {
      // Spawning animation for node1
      const scale = this.easeInOut(this.cascadeSpawnProgress)
      this.drawPackageNode(
        node1.x,
        node1.y,
        14 * scale,
        Colors.nodeReady,
        Colors.borderReady,
        scale
      )
    }

    // Draw node2 (second to spawn) - gets glow after merge
    if (this.cascadeNodesVisible >= 2) {
      if (this.hasDuplicates && !this.node3Merged) {
        this.drawDuplicateHalo(node2.x, node2.y, 20)
      }
      // Slightly larger after absorbing node3 (stays green, not cyan)
      const node2Radius = this.node3Merged ? 16 : 14
      this.drawPackageNode(
        node2.x,
        node2.y,
        node2Radius,
        Colors.nodeReady,
        Colors.borderReady
      )
    } else if (
      this.cascadeNodesVisible === 1 &&
      this.cascadeSpawnProgress > 0
    ) {
      const scale = this.easeInOut(this.cascadeSpawnProgress)
      this.drawPackageNode(
        node2.x,
        node2.y,
        14 * scale,
        Colors.nodeReady,
        Colors.borderReady,
        scale
      )
    }

    // Draw node3 (third to spawn, disappears on merge)
    if (!this.node3Merged) {
      if (this.cascadeNodesVisible >= 3) {
        if (this.hasDuplicates) {
          this.drawDuplicateHalo(node3.x, node3.y, 20 * node3Scale, node3Alpha)
        }
        this.drawPackageNode(
          node3.x,
          node3.y,
          14 * node3Scale,
          Colors.nodeReady,
          Colors.borderReady,
          node3Alpha
        )
      } else if (
        this.cascadeNodesVisible === 2 &&
        this.cascadeSpawnProgress > 0
      ) {
        const scale = this.easeInOut(this.cascadeSpawnProgress)
        this.drawPackageNode(
          node3Base.x,
          node3Base.y,
          14 * scale,
          Colors.nodeReady,
          Colors.borderReady,
          scale
        )
      }
    }
  }

  /**
   * Draw scope badge (red = unstable, green = stable with checkmark)
   */
  private drawScopeBadge(x: number, y: number, nodeRadius: number): void {
    if (!this.ctx || this.badgeState === 'none') return

    const badgeRadius = 7
    const badgeY = y + nodeRadius + 5

    if (this.badgeState === 'red') {
      // Red badge with down arrow (unstable)
      this.ctx.beginPath()
      this.ctx.arc(x, badgeY, badgeRadius, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(0xff6b6b, 0.9)
      this.ctx.fill()

      // Down arrow
      this.ctx.strokeStyle = '#fff'
      this.ctx.lineWidth = 2
      this.ctx.beginPath()
      this.ctx.moveTo(x, badgeY - 3)
      this.ctx.lineTo(x, badgeY + 2)
      this.ctx.moveTo(x - 3, badgeY)
      this.ctx.lineTo(x, badgeY + 3)
      this.ctx.lineTo(x + 3, badgeY)
      this.ctx.stroke()
    } else if (this.badgeState === 'green') {
      // Green badge with checkmark (stable)
      this.ctx.beginPath()
      this.ctx.arc(x, badgeY, badgeRadius, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(0x4ade80, 0.9)
      this.ctx.fill()

      // Checkmark
      this.ctx.strokeStyle = '#fff'
      this.ctx.lineWidth = 2
      this.ctx.beginPath()
      this.ctx.moveTo(x - 3, badgeY)
      this.ctx.lineTo(x - 1, badgeY + 3)
      this.ctx.lineTo(x + 4, badgeY - 3)
      this.ctx.stroke()
    }
  }

  // ============================================
  // DRAWING HELPERS
  // ============================================

  private drawPackageNode(
    x: number,
    y: number,
    radius: number,
    fill: number,
    border: number,
    alpha: number = 1
  ): void {
    if (!this.ctx || radius <= 0) return

    // Glow
    this.ctx.beginPath()
    this.ctx.arc(x, y, radius + 3, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(border, 0.15 * alpha)
    this.ctx.fill()

    // Fill
    this.ctx.beginPath()
    this.ctx.arc(x, y, Math.max(1, radius - 2), 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(fill, 0.6 * alpha)
    this.ctx.fill()

    // Border
    this.ctx.beginPath()
    this.ctx.arc(x, y, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(border, alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()
  }

  /**
   * Draw dashed portal ring - only for packages that need diving (cyan)
   * Stable packages don't have portal rings
   */
  private drawPortalRing(
    x: number,
    y: number,
    radius: number,
    _stable: boolean
  ): void {
    if (!this.ctx) return

    // Portal ring is always cyan - indicates "has internal scope, click to explore"
    this.ctx.beginPath()
    this.ctx.arc(x, y, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderOptimized, 0.5) // Cyan
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([4, 4])
    this.ctx.stroke()
    this.ctx.setLineDash([])
  }

  private drawWire(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: number,
    width: number = 2,
    alpha: number = 1
  ): void {
    if (!this.ctx) return

    this.ctx.beginPath()
    this.ctx.moveTo(x1, y1)
    this.ctx.lineTo(x2, y2)
    this.ctx.strokeStyle = hexToCSS(color, alpha)
    this.ctx.lineWidth = width
    this.ctx.stroke()
  }

  private drawConflictIcon(x: number, y: number, alpha: number = 1): void {
    if (!this.ctx) return

    // Background
    this.ctx.beginPath()
    this.ctx.arc(x, y, 10, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(Colors.borderConflict, 0.8 * alpha)
    this.ctx.fill()

    // X
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`
    this.ctx.lineWidth = 2
    this.ctx.beginPath()
    this.ctx.moveTo(x - 4, y - 4)
    this.ctx.lineTo(x + 4, y + 4)
    this.ctx.moveTo(x + 4, y - 4)
    this.ctx.lineTo(x - 4, y + 4)
    this.ctx.stroke()
  }

  private drawDuplicateHalo(
    x: number,
    y: number,
    radius: number,
    alpha: number = 1
  ): void {
    if (!this.ctx) return

    const pulseAlpha = (0.3 + Math.sin(Date.now() * 0.005) * 0.2) * alpha
    this.ctx.beginPath()
    this.ctx.arc(x, y, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.wireSymlink, pulseAlpha)
    this.ctx.lineWidth = 3
    this.ctx.stroke()
  }

  private drawShipButton(x: number, y: number, _progress: number): void {
    if (!this.ctx) return

    const isReady = this.weightBarFill >= 0.95
    const glowAlpha = isReady ? 0.4 + Math.sin(Date.now() * 0.004) * 0.2 : 0.1

    // Button background
    this.ctx.beginPath()
    this.ctx.roundRect(x - 30, y - 15, 60, 30, 8)
    this.ctx.fillStyle = hexToCSS(TeachingColors.prestige, 0.3)
    this.ctx.fill()
    this.ctx.strokeStyle = hexToCSS(
      TeachingColors.prestige,
      isReady ? 0.8 : 0.3
    )
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Glow if ready
    if (isReady) {
      this.ctx.shadowColor = hexToCSS(TeachingColors.prestige, glowAlpha)
      this.ctx.shadowBlur = 12
      this.ctx.stroke()
      this.ctx.shadowBlur = 0
    }

    // Package ship icon (box with arrow)
    this.ctx.strokeStyle = hexToCSS(0xffffff, isReady ? 0.9 : 0.4)
    this.ctx.lineWidth = 2

    // Box base
    const boxSize = 14
    this.ctx.strokeRect(x - boxSize / 2, y - 2, boxSize, boxSize * 0.6)

    // Box flap (open top)
    this.ctx.beginPath()
    this.ctx.moveTo(x - boxSize / 2, y - 2)
    this.ctx.lineTo(x - boxSize / 2 - 3, y - 6)
    this.ctx.moveTo(x + boxSize / 2, y - 2)
    this.ctx.lineTo(x + boxSize / 2 + 3, y - 6)
    this.ctx.stroke()

    // Arrow up (inside box)
    this.ctx.beginPath()
    this.ctx.moveTo(x, y + 4)
    this.ctx.lineTo(x, y - 6)
    this.ctx.moveTo(x - 4, y - 3)
    this.ctx.lineTo(x, y - 8)
    this.ctx.lineTo(x + 4, y - 3)
    this.ctx.stroke()
  }

  private drawShipAnimation(cx: number, cy: number, t: number): void {
    if (!this.ctx) return

    // All packages (root + 3 top-level) fly to ship button
    const shipTarget = { x: cx, y: cy + 60 }
    const root = { x: cx - 40, y: cy - 10, radius: 20 }
    const pkg1 = { x: cx + 30, y: cy - 30, radius: 16 }
    const pkg2 = { x: cx + 50, y: cy + 10, radius: 14 }
    const pkg3 = { x: cx - 10, y: cy + 25, radius: 14 }

    // Packages compress and fly to ship button
    if (t < 0.6) {
      const flyT = t / 0.6

      // Helper to get node position during flight
      const getNodePos = (
        node: { x: number; y: number },
        delay: number
      ): { x: number; y: number; t: number } => {
        const nodeT = Math.max(0, Math.min(1, (flyT - delay) / (1 - delay * 4)))
        const nodeEased = this.easeInOut(nodeT)
        return {
          x: this.lerp(node.x, shipTarget.x, nodeEased),
          y: this.lerp(node.y, shipTarget.y, nodeEased),
          t: nodeT,
        }
      }

      // Get animated positions
      const rootPos = getNodePos(root, 0)
      const pkg1Pos = getNodePos(pkg1, 0.08)
      const pkg2Pos = getNodePos(pkg2, 0.16)
      const pkg3Pos = getNodePos(pkg3, 0.24)

      // Draw wires that pull in with the nodes
      const wireAlpha = Math.max(0, 1 - flyT * 1.5) * 0.6
      if (wireAlpha > 0) {
        this.drawWire(
          rootPos.x,
          rootPos.y,
          pkg1Pos.x,
          pkg1Pos.y,
          Colors.wireDefault,
          2,
          wireAlpha
        )
        this.drawWire(
          rootPos.x,
          rootPos.y,
          pkg2Pos.x,
          pkg2Pos.y,
          Colors.wireDefault,
          2,
          wireAlpha
        )
        this.drawWire(
          rootPos.x,
          rootPos.y,
          pkg3Pos.x,
          pkg3Pos.y,
          Colors.wireDefault,
          2,
          wireAlpha
        )
      }

      // Helper to draw a flying node
      const drawFlyingNode = (
        pos: { x: number; y: number; t: number },
        radius: number,
        showBadge: boolean
      ) => {
        const scale = 1 - pos.t * 0.6
        const alpha = 1 - pos.t * 0.8

        if (alpha > 0.1) {
          this.drawPackageNode(
            pos.x,
            pos.y,
            radius * scale,
            Colors.nodeReady,
            Colors.borderReady,
            alpha
          )
          if (showBadge && scale > 0.5) {
            this.drawStabilityBadge(pos.x, pos.y, radius * scale, alpha)
          }
        }
      }

      // Draw each node
      drawFlyingNode(rootPos, root.radius, false)
      drawFlyingNode(pkg1Pos, pkg1.radius, true)
      drawFlyingNode(pkg2Pos, pkg2.radius, true)
      drawFlyingNode(pkg3Pos, pkg3.radius, true)
    }

    // Absorb flash at ship button
    if (t >= 0.5 && t < 0.7) {
      const flashT = (t - 0.5) / 0.2
      const flashAlpha = flashT < 0.5 ? flashT * 2 : (1 - flashT) * 2
      this.ctx.beginPath()
      this.ctx.arc(shipTarget.x, shipTarget.y, 25 + flashT * 10, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(TeachingColors.prestige, flashAlpha * 0.4)
      this.ctx.fill()
    }

    // Token reward
    if (t > 0.65) {
      const tokenT = (t - 0.65) / 0.35
      const tokenY = cy + 60 - tokenT * 35
      const alpha =
        tokenT < 0.3 ? tokenT / 0.3 : Math.max(0, 1 - (tokenT - 0.7) / 0.3)

      if (alpha > 0) {
        this.ctx.font = 'bold 18px system-ui'
        this.ctx.fillStyle = hexToCSS(0x5affff, alpha)
        this.ctx.textAlign = 'center'
        // Show multiple tokens (one per stable package)
        this.ctx.fillText('⟲', cx - 20, tokenY)
        this.ctx.fillText('⟲', cx, tokenY - 8)
        this.ctx.fillText('⟲', cx + 20, tokenY)
        this.ctx.textAlign = 'left'
      }
    }
  }

  /**
   * Draw green stability badge (checkmark) below a node
   */
  private drawStabilityBadge(
    x: number,
    y: number,
    nodeRadius: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const badgeRadius = 5
    const badgeY = y + nodeRadius + 4

    // Green circle
    this.ctx.beginPath()
    this.ctx.arc(x, badgeY, badgeRadius, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(0x4ade80, 0.9 * alpha)
    this.ctx.fill()

    // Checkmark
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`
    this.ctx.lineWidth = 1.5
    this.ctx.beginPath()
    this.ctx.moveTo(x - 2, badgeY)
    this.ctx.lineTo(x - 0.5, badgeY + 2)
    this.ctx.lineTo(x + 3, badgeY - 2)
    this.ctx.stroke()
  }

  private drawCursorForPhase(progress: number): void {
    if (!this.ctx) return

    const cx = JOURNEY_WIDTH / 2
    const cy = JOURNEY_HEIGHT / 2 + 20

    let cursorX = 0
    let cursorY = 0
    let visible = false
    let clicking = false

    // Phase 1: Spawn - cursor clicks root
    if (progress >= PHASES.spawn.start && progress < PHASES.spawn.end) {
      const t = this.getPhaseProgress(progress, 'spawn')
      if (t < 0.3) {
        cursorX = this.lerp(cx + 60, cx - 40, t / 0.3)
        cursorY = cy - 10
        visible = true
      } else if (t < 0.5) {
        cursorX = cx - 40
        cursorY = cy - 10
        clicking = true
        visible = true
      }
    }

    // Phase 2: Dive - cursor clicks spawned package
    if (progress >= PHASES.dive.start && progress < PHASES.dive.end) {
      const t = this.getPhaseProgress(progress, 'dive')
      if (t < 0.4) {
        cursorX = this.lerp(cx - 40, cx + 30, t / 0.4)
        cursorY = cy - 20
        visible = true
      } else if (t < 0.6) {
        cursorX = cx + 30
        cursorY = cy - 20
        clicking = true
        visible = true
      }
    }

    // Phase 4: Resolve - cursor clicks conflict
    if (progress >= PHASES.resolve.start && progress < PHASES.resolve.end) {
      const t = this.getPhaseProgress(progress, 'resolve')
      const conflictX = (cx - 35 + cx) / 2
      const conflictY = (cy + 20 + cy + 50) / 2

      if (t < 0.3) {
        cursorX = this.lerp(cx + 50, conflictX, t / 0.3)
        cursorY = this.lerp(cy - 20, conflictY, t / 0.3)
        visible = true
      } else if (t < 0.5) {
        cursorX = conflictX
        cursorY = conflictY
        clicking = true
        visible = true
      }
    }

    // Phase 5: Merge - drag gesture
    if (progress >= PHASES.merge.start && progress < PHASES.merge.end) {
      const t = this.getPhaseProgress(progress, 'merge')
      const node2 = { x: cx + 35, y: cy + 20 }
      const node3 = { x: cx, y: cy + 50 }

      if (t < 0.6) {
        const dragT = t / 0.6
        cursorX = this.lerp(node3.x, node2.x, this.easeInOut(dragT))
        cursorY = this.lerp(node3.y, node2.y, this.easeInOut(dragT))
        clicking = dragT > 0.1 && dragT < 0.9
        visible = true
      }
    }

    // Phase 7: Exit - cursor clicks back
    if (progress >= PHASES.exit.start && progress < PHASES.exit.end) {
      const t = this.getPhaseProgress(progress, 'exit')
      if (t < 0.3) {
        cursorX = this.lerp(cx, 20, t / 0.3)
        cursorY = this.lerp(cy, JOURNEY_HEIGHT - 20, t / 0.3)
        visible = true
      } else if (t < 0.5) {
        cursorX = 20
        cursorY = JOURNEY_HEIGHT - 20
        clicking = true
        visible = true
      }
    }

    // Phase 9: Ship - cursor clicks ship button
    if (progress >= PHASES.ship.start && progress < PHASES.ship.end) {
      const t = this.getPhaseProgress(progress, 'ship')
      if (t < 0.2) {
        cursorX = this.lerp(cx + 60, cx, t / 0.2)
        cursorY = cy + 60
        visible = true
      } else if (t < 0.4) {
        cursorX = cx
        cursorY = cy + 60
        clicking = true
        visible = true
      }
    }

    if (visible) {
      this.drawCursor(cursorX, cursorY, clicking)
    }
  }

  private drawCursor(x: number, y: number, clicking: boolean): void {
    if (!this.ctx) return

    const scale = clicking ? 0.9 : 1

    // Glow
    this.ctx.beginPath()
    this.ctx.arc(x, y, 8 * scale, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(TeachingColors.cursorGlow, 0.3)
    this.ctx.fill()

    // Pointer
    const size = 12 * scale
    this.ctx.beginPath()
    this.ctx.moveTo(x, y)
    this.ctx.lineTo(x + size * 0.7, y + size * 0.7)
    this.ctx.lineTo(x + size * 0.2, y + size * 0.7)
    this.ctx.lineTo(x, y + size)
    this.ctx.closePath()
    this.ctx.fillStyle = hexToCSS(TeachingColors.cursor, 0.9)
    this.ctx.fill()
    this.ctx.strokeStyle = hexToCSS(TeachingColors.cursorGlow, 0.6)
    this.ctx.lineWidth = 1
    this.ctx.stroke()
  }

  // ============================================
  // UTILITIES
  // ============================================

  private easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
  }
}
