// Stability Tooltip Animation
// Shows: Conflict wire being resolved → scope stabilizes → bar fills
// Concept: Resolving conflicts improves stability

import {
  TooltipAnimation,
  TooltipColors,
  hexToCSS,
  TOOLTIP_WIDTH,
  TOOLTIP_HEIGHT,
} from './tooltip-animation'

export class StabilityTooltip extends TooltipAnimation {
  protected loopDuration = 2200 // 2.2 second loop

  // Animation phases
  private static readonly PHASES = {
    showConflict: { start: 0, end: 0.25 }, // Show conflict wire with X
    resolve: { start: 0.25, end: 0.5 }, // Resolve animation
    stabilize: { start: 0.5, end: 0.7 }, // Bar fills, scope stabilizes
    hold: { start: 0.7, end: 0.85 }, // Hold state
    reset: { start: 0.85, end: 1.0 }, // Fade for loop
  }

  protected setup(): void {
    // Initial draw handled by update
  }

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = StabilityTooltip.PHASES

    // Resolution progress
    const resolveT = this.phaseProgress(progress, phases.resolve)
    const isResolved = progress >= phases.resolve.end

    // Stabilization progress
    const stabilizeT = this.phaseProgress(progress, phases.stabilize)

    // Bar fill progress
    let barFill = 0.3 // Start at 30%
    if (progress >= phases.stabilize.start) {
      barFill = 0.3 + this.easeInOut(stabilizeT) * 0.7 // Grows to 100%
    }
    if (progress >= phases.stabilize.end) {
      barFill = 1.0
    }

    // Fade for loop reset
    let alpha = 1
    if (progress >= phases.reset.start) {
      alpha = 1 - this.phaseProgress(progress, phases.reset)
    }

    // Layout
    const barY = 6
    const barHeight = 8
    const barWidth = TOOLTIP_WIDTH - 16
    const barX = 8

    const nodeY = TOOLTIP_HEIGHT / 2 + 6
    const nodeRadius = 10

    // Wire endpoints
    const wireX1 = 14
    const wireX2 = TOOLTIP_WIDTH - 14
    const wireMidX = TOOLTIP_WIDTH / 2

    // Draw stability bar at top
    this.drawStabilityBar(barX, barY, barWidth, barHeight, barFill, alpha)

    // Draw wire (conflict → resolved)
    if (!isResolved) {
      this.drawConflictWire(wireX1, nodeY, wireX2, nodeY, progress, alpha)
    } else {
      // Resolved: calm green wire
      this.drawWire(
        wireX1,
        nodeY,
        wireX2,
        nodeY,
        TooltipColors.ready,
        alpha * 0.7
      )
    }

    // Draw nodes at wire ends
    const nodeColor = isResolved ? TooltipColors.ready : 0x7a7aaa
    this.drawNode(wireX1, nodeY, nodeRadius - 2, 0x2a2a4a, nodeColor, alpha)
    this.drawNode(wireX2, nodeY, nodeRadius - 2, 0x2a2a4a, nodeColor, alpha)

    // X button on wire - fades during resolve
    if (!isResolved) {
      const xAlpha = (1 - this.easeInOut(resolveT)) * alpha
      const xScale = 1 - resolveT * 0.3
      this.drawXButton(wireMidX, nodeY, xScale, xAlpha)
    }

    // Resolution burst effect
    if (resolveT > 0.3 && resolveT < 1) {
      const burstT = (resolveT - 0.3) / 0.7
      const burstAlpha = Math.sin(burstT * Math.PI) * 0.5 * alpha
      const burstRadius = 6 + burstT * 12
      this.ctx.beginPath()
      this.ctx.arc(wireMidX, nodeY, burstRadius, 0, Math.PI * 2)
      this.ctx.strokeStyle = hexToCSS(TooltipColors.ready, burstAlpha)
      this.ctx.lineWidth = 2
      this.ctx.stroke()
    }

    // Stability indicator (checkmark appears after stabilize)
    if (isResolved && stabilizeT > 0.5) {
      const checkAlpha = this.easeInOut((stabilizeT - 0.5) * 2) * alpha
      this.drawCheckmark(wireMidX, nodeY, checkAlpha)
    }
  }

  /**
   * Draw stability bar with gradient
   */
  private drawStabilityBar(
    x: number,
    y: number,
    width: number,
    height: number,
    fillPercent: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    // Background
    this.ctx.beginPath()
    this.roundRect(x, y, width, height, 3)
    this.ctx.fillStyle = hexToCSS(0x2a2a3a, 0.8 * alpha)
    this.ctx.fill()

    // Fill with gradient (orange → green)
    if (fillPercent > 0) {
      const fillWidth = width * fillPercent
      const gradient = this.ctx.createLinearGradient(x, y, x + width, y)
      gradient.addColorStop(0, hexToCSS(0xff8a5a, 0.9 * alpha))
      gradient.addColorStop(1, hexToCSS(TooltipColors.ready, 0.9 * alpha))

      this.ctx.beginPath()
      this.roundRect(x, y, fillWidth, height, 3)
      this.ctx.fillStyle = gradient
      this.ctx.fill()

      // Glow when full
      if (fillPercent >= 1) {
        this.ctx.shadowColor = hexToCSS(TooltipColors.ready, 0.5)
        this.ctx.shadowBlur = 6
        this.ctx.fill()
        this.ctx.shadowBlur = 0
      }
    }
  }

  /**
   * Draw crackling conflict wire
   */
  private drawConflictWire(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    progress: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const time = progress * this.loopDuration

    // Glow behind wire
    this.ctx.beginPath()
    this.ctx.moveTo(x1, y1)
    this.ctx.lineTo(x2, y2)
    this.ctx.strokeStyle = hexToCSS(TooltipColors.conflict, 0.25 * alpha)
    this.ctx.lineWidth = 5
    this.ctx.stroke()

    // Crackling effect
    const segments = 5
    this.ctx.beginPath()
    this.ctx.moveTo(x1, y1)

    for (let i = 1; i < segments; i++) {
      const t = i / segments
      const x = this.lerp(x1, x2, t)
      const crackle = Math.sin(t * Math.PI * 3 + time * 0.03) * 2.5
      this.ctx.lineTo(x, y1 + crackle)
    }
    this.ctx.lineTo(x2, y2)
    this.ctx.strokeStyle = hexToCSS(TooltipColors.conflict, 0.9 * alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()
  }

  /**
   * Draw X button on wire (matches production style)
   */
  private drawXButton(
    x: number,
    y: number,
    scale: number,
    alpha: number
  ): void {
    if (!this.ctx || alpha <= 0) return

    const size = 9 * scale

    // Dark red background
    this.ctx.beginPath()
    this.ctx.arc(x, y, size, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(0x4a2a2a, 0.95 * alpha)
    this.ctx.fill()

    // Red border with glow
    this.ctx.shadowColor = hexToCSS(TooltipColors.conflict, 0.4 * alpha)
    this.ctx.shadowBlur = 4
    this.ctx.strokeStyle = hexToCSS(TooltipColors.conflict, alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.stroke()
    this.ctx.shadowBlur = 0

    // X icon
    const iconSize = 3 * scale
    this.ctx.beginPath()
    this.ctx.moveTo(x - iconSize, y - iconSize)
    this.ctx.lineTo(x + iconSize, y + iconSize)
    this.ctx.moveTo(x + iconSize, y - iconSize)
    this.ctx.lineTo(x - iconSize, y + iconSize)
    this.ctx.strokeStyle = hexToCSS(0xffffff, 0.9 * alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.lineCap = 'round'
    this.ctx.stroke()
    this.ctx.lineCap = 'butt'
  }

  /**
   * Draw checkmark indicator
   */
  private drawCheckmark(x: number, y: number, alpha: number): void {
    if (!this.ctx || alpha <= 0) return

    const size = 5
    this.ctx.beginPath()
    this.ctx.moveTo(x - size, y)
    this.ctx.lineTo(x - size * 0.2, y + size * 0.6)
    this.ctx.lineTo(x + size, y - size * 0.5)
    this.ctx.strokeStyle = hexToCSS(TooltipColors.ready, alpha)
    this.ctx.lineWidth = 2
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    this.ctx.stroke()
    this.ctx.lineCap = 'butt'
    this.ctx.lineJoin = 'miter'
  }
}
