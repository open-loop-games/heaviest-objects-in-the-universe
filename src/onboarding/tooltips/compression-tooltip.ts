// Compression Upgrade Tooltip Animation
// Shows: Weight bar filling faster (speed lines, rapid fill)
// Concept: ◆↓ upgrade = weight accumulates faster = ship sooner

import {
  TooltipAnimation,
  TooltipColors,
  hexToCSS,
  TOOLTIP_WIDTH,
} from './tooltip-animation'

export class CompressionTooltip extends TooltipAnimation {
  protected loopDuration = 2200 // 2.2 second loop

  // Animation phases
  private static readonly PHASES = {
    fillSlow: { start: 0, end: 0.35 }, // Slow fill (before)
    speedUp: { start: 0.35, end: 0.45 }, // Transition with speed lines
    fillFast: { start: 0.45, end: 0.7 }, // Fast fill (after)
    hold: { start: 0.7, end: 0.85 }, // Hold full state
    reset: { start: 0.85, end: 1.0 }, // Fade for loop
  }

  protected setup(): void {
    // Initial draw handled by update
  }

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = CompressionTooltip.PHASES

    // Calculate fill progress
    let fillPercent = 0
    let isFastMode = false

    if (progress < phases.fillSlow.end) {
      // Slow fill: 0 -> 40%
      const t = this.phaseProgress(progress, phases.fillSlow)
      fillPercent = t * 0.4
    } else if (progress < phases.speedUp.end) {
      // Speed up transition
      fillPercent = 0.4
      isFastMode = true
    } else if (progress < phases.fillFast.end) {
      // Fast fill: 40% -> 100%
      const t = this.phaseProgress(progress, phases.fillFast)
      fillPercent = 0.4 + t * 0.6
      isFastMode = true
    } else if (progress < phases.reset.start) {
      fillPercent = 1
      isFastMode = true
    }

    // Fade for loop reset
    let alpha = 1
    if (progress >= phases.reset.start) {
      alpha = 1 - this.phaseProgress(progress, phases.reset)
      fillPercent = 1 - (1 - alpha) * 0.3 // Slight drain during fade
    }

    // Layout
    const barY = 22
    const barHeight = 14
    const barWidth = 60
    const barX = (TOOLTIP_WIDTH - barWidth) / 2

    // Label: ◆ icon at top (weight symbol)
    this.ctx.font = 'bold 12px system-ui, sans-serif'
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillStyle = hexToCSS(TooltipColors.weight, alpha)
    this.ctx.fillText('◆', TOOLTIP_WIDTH / 2, 10)

    // Draw speed lines during fast mode
    if (isFastMode && progress < phases.hold.start) {
      const speedProgress =
        progress < phases.speedUp.end
          ? this.phaseProgress(progress, phases.speedUp)
          : this.phaseProgress(progress, phases.fillFast)

      this.drawSpeedLines(
        barX - 5,
        barY - 3,
        barWidth + 10,
        barHeight + 6,
        TooltipColors.weight,
        speedProgress
      )
    }

    // Draw the weight bar
    const glowColor = isFastMode ? TooltipColors.weight : undefined
    this.drawBar(
      barX,
      barY,
      barWidth,
      barHeight,
      6,
      fillPercent,
      TooltipColors.weight,
      TooltipColors.weightDark,
      0x2a2a3a,
      glowColor
    )

    // Pulsing glow when filling fast
    if (isFastMode && fillPercent < 1) {
      const pulseAlpha =
        (Math.sin(progress * Math.PI * 12) * 0.5 + 0.5) * 0.3 * alpha
      this.ctx.shadowColor = hexToCSS(TooltipColors.weight, pulseAlpha)
      this.ctx.shadowBlur = 10
      this.ctx.beginPath()
      this.roundRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4, 4)
      this.ctx.strokeStyle = hexToCSS(TooltipColors.weight, pulseAlpha)
      this.ctx.lineWidth = 2
      this.ctx.stroke()
      this.ctx.shadowBlur = 0
    }

    // Streaming diamonds when fast (replacing ⚡)
    if (isFastMode && fillPercent < 1) {
      this.drawStreamingDiamonds(
        barX,
        barY,
        barWidth,
        barHeight,
        progress,
        alpha
      )
    }
  }

  /**
   * Draw streaming ◆ diamonds flying into the bar
   */
  private drawStreamingDiamonds(
    barX: number,
    barY: number,
    barWidth: number,
    barHeight: number,
    progress: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const numDiamonds = 4
    const barCenterY = barY + barHeight / 2

    for (let i = 0; i < numDiamonds; i++) {
      // Stagger the diamonds across time
      const diamondProgress = (progress * 3 + i * 0.25) % 1

      // Start from right side, fly into bar
      const startX = barX + barWidth + 15
      const endX = barX + barWidth * 0.7
      const x = this.lerp(startX, endX, this.easeInOut(diamondProgress))

      // Slight vertical wave
      const waveY = Math.sin(diamondProgress * Math.PI * 2) * 3
      const y = barCenterY + waveY + (i - 1.5) * 4

      // Fade in at start, fade out at end
      const fadeIn = Math.min(diamondProgress * 4, 1)
      const fadeOut =
        diamondProgress > 0.7 ? 1 - (diamondProgress - 0.7) / 0.3 : 1
      const diamondAlpha = fadeIn * fadeOut * alpha * 0.7

      if (diamondAlpha > 0.05) {
        // Draw small diamond ◆
        const size = 2.5
        this.ctx.beginPath()
        this.ctx.moveTo(x, y - size)
        this.ctx.lineTo(x + size, y)
        this.ctx.lineTo(x, y + size)
        this.ctx.lineTo(x - size, y)
        this.ctx.closePath()
        this.ctx.fillStyle = hexToCSS(TooltipColors.weight, diamondAlpha)
        this.ctx.fill()
      }
    }
  }
}
