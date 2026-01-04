// Auto-Resolve Toggle Tooltip Animation
// Shows: Conflict wire with X button being automatically resolved
// Concept: Toggle enables automatic conflict resolution

import {
  TooltipAnimation,
  TooltipColors,
  hexToCSS,
  TOOLTIP_HEIGHT,
  TOOLTIP_WIDTH,
} from './tooltip-animation'

export class AutoResolveTooltip extends TooltipAnimation {
  protected loopDuration = 2000 // 2 second loop

  // Animation phases
  private static readonly PHASES = {
    showConflict: { start: 0, end: 0.3 }, // Show conflict wire with X
    resolve: { start: 0.3, end: 0.6 }, // Auto-resolve animation
    hold: { start: 0.6, end: 0.85 }, // Hold resolved state
    reset: { start: 0.85, end: 1.0 }, // Fade for loop
  }

  protected setup(): void {
    // Initial draw handled by update
  }

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = AutoResolveTooltip.PHASES

    // Is resolved?
    const isResolved = progress >= phases.resolve.end
    const resolveT = this.phaseProgress(progress, phases.resolve)

    // Fade for loop reset
    let alpha = 1
    if (progress >= phases.reset.start) {
      alpha = 1 - this.phaseProgress(progress, phases.reset)
    }

    // Layout - gear on left, wire with X button on right
    const gearX = 16
    const gearY = TOOLTIP_HEIGHT / 2
    const gearRadius = 9

    // Wire endpoints
    const wireX1 = 32
    const wireX2 = TOOLTIP_WIDTH - 8
    const wireY = TOOLTIP_HEIGHT / 2
    const wireMidX = (wireX1 + wireX2) / 2

    // Gear rotation (spins during resolve)
    const rotation = progress * Math.PI * 4
    const gearColor =
      resolveT > 0 || isResolved ? TooltipColors.resolve : 0x6a6a8a
    this.drawGear(gearX, gearY, gearRadius, gearColor, alpha, rotation)

    // Draw conflict wire (crackling red, or calm green when resolved)
    if (!isResolved) {
      this.drawConflictWire(wireX1, wireY, wireX2, wireY, progress, alpha)
    } else {
      // Resolved: calm green wire
      this.drawWire(
        wireX1,
        wireY,
        wireX2,
        wireY,
        TooltipColors.ready,
        alpha * 0.7
      )
    }

    // X button on wire - fades out during resolve
    if (!isResolved) {
      const xAlpha =
        resolveT > 0 ? (1 - this.easeInOut(resolveT)) * alpha : alpha
      const xScale = resolveT > 0 ? 1 - resolveT * 0.3 : 1
      this.drawXButton(wireMidX, wireY, xScale, xAlpha)
    }

    // Resolution burst effect
    if (resolveT > 0 && resolveT < 1) {
      const burstAlpha = Math.sin(resolveT * Math.PI) * 0.5 * alpha
      const burstRadius = 8 + resolveT * 15
      this.ctx.beginPath()
      this.ctx.arc(wireMidX, wireY, burstRadius, 0, Math.PI * 2)
      this.ctx.strokeStyle = hexToCSS(TooltipColors.ready, burstAlpha)
      this.ctx.lineWidth = 2
      this.ctx.stroke()
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
    this.ctx.lineWidth = 6
    this.ctx.stroke()

    // Crackling effect
    const segments = 4
    this.ctx.beginPath()
    this.ctx.moveTo(x1, y1)

    for (let i = 1; i < segments; i++) {
      const t = i / segments
      const x = this.lerp(x1, x2, t)
      const crackle = Math.sin(t * Math.PI * 3 + time * 0.03) * 3
      this.ctx.lineTo(x, y1 + crackle)
    }
    this.ctx.lineTo(x2, y2)
    this.ctx.strokeStyle = hexToCSS(TooltipColors.conflict, 0.9 * alpha)
    this.ctx.lineWidth = 2.5
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

    const size = 10 * scale

    // Dark red background
    this.ctx.beginPath()
    this.ctx.arc(x, y, size, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(0x4a2a2a, 0.95 * alpha)
    this.ctx.fill()

    // Red border with glow
    this.ctx.shadowColor = hexToCSS(TooltipColors.conflict, 0.5 * alpha)
    this.ctx.shadowBlur = 6
    this.ctx.strokeStyle = hexToCSS(TooltipColors.conflict, alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.stroke()
    this.ctx.shadowBlur = 0

    // X icon (~36% of button size)
    const iconSize = 3.5 * scale
    this.ctx.beginPath()
    this.ctx.moveTo(x - iconSize, y - iconSize)
    this.ctx.lineTo(x + iconSize, y + iconSize)
    this.ctx.moveTo(x + iconSize, y - iconSize)
    this.ctx.lineTo(x - iconSize, y + iconSize)
    this.ctx.strokeStyle = hexToCSS(0xffffff, 0.9 * alpha)
    this.ctx.lineWidth = 2
    this.ctx.lineCap = 'round'
    this.ctx.stroke()
    this.ctx.lineCap = 'butt'
  }
}
