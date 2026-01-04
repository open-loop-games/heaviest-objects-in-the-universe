// Bandwidth Upgrade Tooltip Animation
// Shows: Bar capacity expanding (more segments light up)
// Concept: ↓ upgrade = bigger bar = more headroom

import {
  TooltipAnimation,
  TooltipColors,
  hexToCSS,
  TOOLTIP_WIDTH,
} from './tooltip-animation'

export class BandwidthTooltip extends TooltipAnimation {
  protected loopDuration = 2000 // 2 second loop

  // Animation phases
  private static readonly PHASES = {
    showBefore: { start: 0, end: 0.3 }, // Show "before" state
    expand: { start: 0.3, end: 0.5 }, // Bar expands
    showAfter: { start: 0.5, end: 0.85 }, // Show "after" state
    reset: { start: 0.85, end: 1.0 }, // Fade for loop
  }

  protected setup(): void {
    // Initial draw handled by update
  }

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = BandwidthTooltip.PHASES

    // Calculate expansion progress
    let expandT = 0
    if (progress >= phases.expand.start && progress < phases.expand.end) {
      expandT = this.easeInOut(this.phaseProgress(progress, phases.expand))
    } else if (progress >= phases.expand.end && progress < phases.reset.start) {
      expandT = 1
    }

    // Fade for loop reset
    let alpha = 1
    if (progress >= phases.reset.start) {
      alpha = 1 - this.phaseProgress(progress, phases.reset)
    }

    // Layout
    const barY = 20
    const barHeight = 14
    const beforeWidth = 50
    const afterWidth = 70
    const barWidth = this.lerp(beforeWidth, afterWidth, expandT)
    const barX = (TOOLTIP_WIDTH - barWidth) / 2

    // Label: ↓ icon at top
    this.ctx.font = 'bold 14px system-ui, sans-serif'
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillStyle = hexToCSS(TooltipColors.bandwidth, alpha)
    this.ctx.fillText('↓', TOOLTIP_WIDTH / 2, 10)

    // Draw the bar (5 segments before, grows to show more)
    const beforeSegments = 5
    const afterSegments = 7
    const segments = Math.round(
      this.lerp(beforeSegments, afterSegments, expandT)
    )

    // Current fill (stays constant, but bar grows around it)
    const fillPercent = 0.6 // 60% filled

    this.drawBar(
      barX,
      barY,
      barWidth,
      barHeight,
      segments,
      fillPercent,
      TooltipColors.bandwidth,
      TooltipColors.bandwidthDark,
      0x2a2a4a,
      TooltipColors.bandwidth
    )

    // Draw expanding glow during expansion
    if (expandT > 0 && expandT < 1) {
      const glowAlpha = Math.sin(expandT * Math.PI) * 0.4
      this.ctx.shadowColor = hexToCSS(0x5aff5a, glowAlpha)
      this.ctx.shadowBlur = 8
      this.ctx.beginPath()
      this.roundRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4, 4)
      this.ctx.strokeStyle = hexToCSS(0x5aff5a, glowAlpha)
      this.ctx.lineWidth = 2
      this.ctx.stroke()
      this.ctx.shadowBlur = 0
    }

    // "Headroom gained" indicator (new segments glow green)
    if (expandT > 0) {
      const newSegmentStart = barX + beforeWidth * 0.9
      const newSegmentWidth = (barWidth - beforeWidth * 0.9) * expandT
      if (newSegmentWidth > 2) {
        this.ctx.fillStyle = hexToCSS(0x5aff5a, 0.3 * alpha * expandT)
        this.roundRect(newSegmentStart, barY, newSegmentWidth, barHeight, 2)
        this.ctx.fill()
      }
    }

    // Expanding rings below bar to show "growth"
    if (expandT > 0 && expandT < 1) {
      const ringY = barY + barHeight + 12
      const ringAlpha = Math.sin(expandT * Math.PI) * 0.4 * alpha

      // Draw 2 expanding rings
      for (let i = 0; i < 2; i++) {
        const ringProgress = (expandT + i * 0.3) % 1
        const ringRadius = 4 + ringProgress * 12
        const ringFade = (1 - ringProgress) * ringAlpha

        if (ringFade > 0.05) {
          this.ctx.beginPath()
          this.ctx.arc(TOOLTIP_WIDTH / 2, ringY, ringRadius, 0, Math.PI * 2)
          this.ctx.strokeStyle = hexToCSS(0x5aff5a, ringFade)
          this.ctx.lineWidth = 1.5
          this.ctx.stroke()
        }
      }
    }
  }
}
