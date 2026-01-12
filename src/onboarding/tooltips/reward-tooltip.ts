// Reward Tooltip Animation
// Shows: Efficiency bar level → affects token brightness/quality
// Concept: Higher efficiency = better quality rewards

import {
  TooltipAnimation,
  hexToCSS,
  TOOLTIP_WIDTH,
  TOOLTIP_HEIGHT,
} from './tooltip-animation'

const TOKEN_COLOR = 0x5affff // Cyan tokens
const TOKEN_DIM = 0x3a6a6a // Dimmed token
const EFFICIENCY_HIGH = 0x5affff // Cyan (high efficiency)
const EFFICIENCY_LOW = 0xffaa5a // Orange (low efficiency)

export class RewardTooltip extends TooltipAnimation {
  protected loopDuration = 3000 // 3 second loop

  // Animation phases
  private static readonly PHASES = {
    showLow: { start: 0, end: 0.25 }, // Show low efficiency state
    transition: { start: 0.25, end: 0.45 }, // Bar fills up
    showHigh: { start: 0.45, end: 0.7 }, // Show high efficiency state
    celebrate: { start: 0.7, end: 0.85 }, // Tokens glow
    hold: { start: 0.85, end: 0.92 }, // Hold
    reset: { start: 0.92, end: 1.0 }, // Fade for loop
  }

  protected setup(): void {
    // Initial draw handled by update
  }

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = RewardTooltip.PHASES

    // Efficiency level (0.3 → 0.9)
    const transitionT = this.easeInOut(
      this.phaseProgress(progress, phases.transition)
    )
    const efficiency = 0.3 + transitionT * 0.6

    // Celebration
    const celebrateT = this.phaseProgress(progress, phases.celebrate)

    // Fade for loop reset
    let alpha = 1
    if (progress >= phases.reset.start) {
      alpha = 1 - this.phaseProgress(progress, phases.reset)
    }

    // Layout - compact to fit 80x56 with margins
    const barX = 12
    const barY = 8
    const barWidth = TOOLTIP_WIDTH - 24
    const barHeight = 8

    const tokenY = TOOLTIP_HEIGHT / 2 + 6
    const tokenSpacing = 14
    const numTokens = 3
    const tokenStartX = TOOLTIP_WIDTH / 2 - ((numTokens - 1) * tokenSpacing) / 2

    // Draw efficiency bar
    this.drawEfficiencyBar(barX, barY, barWidth, barHeight, efficiency, alpha)

    // Draw efficiency icon (⚡) - positioned inside left margin
    this.drawEfficiencyIcon(6, barY + barHeight / 2, efficiency, alpha)

    // Draw tokens with quality based on efficiency
    for (let i = 0; i < numTokens; i++) {
      const tokenX = tokenStartX + i * tokenSpacing
      const tokenQuality = efficiency // All tokens reflect current efficiency
      const celebrateOffset =
        celebrateT > 0 ? Math.sin((celebrateT + i * 0.2) * Math.PI) * 2 : 0

      this.drawRewardToken(
        tokenX,
        tokenY - celebrateOffset,
        tokenQuality,
        celebrateT,
        alpha
      )
    }

    // Arrow connecting bar to tokens
    this.drawConnectionArrow(
      TOOLTIP_WIDTH / 2,
      barY + barHeight + 6,
      efficiency,
      alpha
    )
  }

  /**
   * Draw efficiency bar with color gradient
   */
  private drawEfficiencyBar(
    x: number,
    y: number,
    width: number,
    height: number,
    efficiency: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    // Background
    this.ctx.beginPath()
    this.roundRect(x, y, width, height, 3)
    this.ctx.fillStyle = hexToCSS(0x2a2a3a, 0.8 * alpha)
    this.ctx.fill()

    // Fill with gradient based on efficiency
    if (efficiency > 0) {
      const fillWidth = width * efficiency
      const gradient = this.ctx.createLinearGradient(x, y, x + width, y)

      // Low efficiency = orange, high = cyan
      gradient.addColorStop(0, hexToCSS(EFFICIENCY_LOW, 0.9 * alpha))
      gradient.addColorStop(0.5, hexToCSS(0xaacc5a, 0.9 * alpha))
      gradient.addColorStop(1, hexToCSS(EFFICIENCY_HIGH, 0.9 * alpha))

      this.ctx.beginPath()
      this.roundRect(x, y, fillWidth, height, 3)
      this.ctx.fillStyle = gradient
      this.ctx.fill()

      // Glow when high
      if (efficiency > 0.7) {
        this.ctx.shadowColor = hexToCSS(EFFICIENCY_HIGH, 0.5)
        this.ctx.shadowBlur = 4
        this.ctx.fill()
        this.ctx.shadowBlur = 0
      }
    }

    // 50% marker
    const markerX = x + width * 0.5
    this.ctx.beginPath()
    this.ctx.moveTo(markerX, y - 1)
    this.ctx.lineTo(markerX, y + height + 1)
    this.ctx.strokeStyle = hexToCSS(0xffffff, 0.2 * alpha)
    this.ctx.lineWidth = 1
    this.ctx.stroke()
  }

  /**
   * Draw efficiency icon (⚡) - compact, centered on position
   */
  private drawEfficiencyIcon(
    x: number,
    y: number,
    efficiency: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const color = efficiency > 0.5 ? EFFICIENCY_HIGH : EFFICIENCY_LOW

    this.ctx.font = '10px sans-serif'
    this.ctx.fillStyle = hexToCSS(color, alpha * 0.9)
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText('⚡', x, y)
  }

  /**
   * Draw reward token (⟲ symbol) with quality styling
   */
  private drawRewardToken(
    x: number,
    y: number,
    quality: number,
    celebrateT: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    // Interpolate color based on quality
    const color = quality > 0.5 ? TOKEN_COLOR : TOKEN_DIM
    const glowIntensity = quality > 0.7 ? (quality - 0.7) / 0.3 : 0

    // Token glow (when high quality)
    if (glowIntensity > 0 || celebrateT > 0) {
      const glowAlpha = Math.max(glowIntensity, celebrateT) * 0.4 * alpha
      this.ctx.beginPath()
      this.ctx.arc(x, y, 8, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(TOKEN_COLOR, glowAlpha)
      this.ctx.fill()
    }

    // Token symbol
    this.ctx.font = 'bold 14px sans-serif'
    this.ctx.fillStyle = hexToCSS(color, alpha * (0.5 + quality * 0.5))
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText('⟲', x, y)

    // Extra glow text shadow when celebrating
    if (celebrateT > 0 && quality > 0.7) {
      this.ctx.shadowColor = hexToCSS(TOKEN_COLOR, celebrateT * 0.8)
      this.ctx.shadowBlur = 6
      this.ctx.fillText('⟲', x, y)
      this.ctx.shadowBlur = 0
    }
  }

  /**
   * Draw arrow connecting efficiency to tokens
   */
  private drawConnectionArrow(
    x: number,
    y: number,
    efficiency: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const color = efficiency > 0.5 ? EFFICIENCY_HIGH : EFFICIENCY_LOW

    // Small downward arrow
    this.ctx.beginPath()
    this.ctx.moveTo(x, y)
    this.ctx.lineTo(x, y + 6)
    this.ctx.moveTo(x - 3, y + 3)
    this.ctx.lineTo(x, y + 6)
    this.ctx.lineTo(x + 3, y + 3)
    this.ctx.strokeStyle = hexToCSS(color, alpha * 0.6)
    this.ctx.lineWidth = 1.5
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    this.ctx.stroke()
    this.ctx.lineCap = 'butt'
    this.ctx.lineJoin = 'miter'
  }
}
