// Tier 2 Tooltip Animation
// Shows: Gear spinning → conflict wire auto-resolves
// Concept: Auto-resolve unlocked at Tier 2

import {
  TooltipAnimation,
  TooltipColors,
  hexToCSS,
  TOOLTIP_WIDTH,
  TOOLTIP_HEIGHT,
} from './tooltip-animation'

const GEAR_COLOR = 0x5aaaff // Blue for tier 2

export class Tier2Tooltip extends TooltipAnimation {
  protected loopDuration = 2200 // 2.2 second loop

  // Animation phases
  private static readonly PHASES = {
    showConflict: { start: 0, end: 0.2 }, // Show conflict wire
    gearSpin: { start: 0.2, end: 0.6 }, // Gear spins, processing
    resolve: { start: 0.6, end: 0.8 }, // Conflict resolves
    hold: { start: 0.8, end: 0.9 }, // Hold state
    reset: { start: 0.9, end: 1.0 }, // Fade for loop
  }

  protected setup(): void {
    // Initial draw handled by update
  }

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = Tier2Tooltip.PHASES

    // Gear rotation
    const gearT = this.phaseProgress(progress, phases.gearSpin)
    const gearRotation = gearT * Math.PI * 2

    // Resolution progress
    const resolveT = this.phaseProgress(progress, phases.resolve)
    const isResolved = progress >= phases.resolve.end

    // Fade for loop reset
    let alpha = 1
    if (progress >= phases.reset.start) {
      alpha = 1 - this.phaseProgress(progress, phases.reset)
    }

    // Layout
    const gearX = 18
    const gearY = TOOLTIP_HEIGHT / 2
    const gearRadius = 10

    const wireY = TOOLTIP_HEIGHT / 2
    const wireX1 = 35
    const wireX2 = TOOLTIP_WIDTH - 12
    const wireMidX = (wireX1 + wireX2) / 2

    const nodeRadius = 7

    // Draw gear (left side)
    const gearAlpha = progress >= phases.gearSpin.start ? 1 : 0.5
    this.drawGear(
      gearX,
      gearY,
      gearRadius,
      GEAR_COLOR,
      alpha * gearAlpha,
      gearRotation
    )

    // Processing glow around gear
    if (gearT > 0 && gearT < 1) {
      this.ctx.beginPath()
      this.ctx.arc(gearX, gearY, gearRadius + 4, 0, Math.PI * 2)
      this.ctx.strokeStyle = hexToCSS(
        GEAR_COLOR,
        0.3 * alpha * Math.sin(gearT * Math.PI)
      )
      this.ctx.lineWidth = 2
      this.ctx.stroke()
    }

    // Draw conflict wire (or resolved wire)
    if (!isResolved) {
      // Crackling conflict wire
      this.drawConflictWire(wireX1, wireY, wireX2, wireY, progress, alpha)
      // X button
      const xAlpha = (1 - this.easeInOut(resolveT)) * alpha
      if (xAlpha > 0.01) {
        this.drawXButton(wireMidX, wireY, 1 - resolveT * 0.3, xAlpha)
      }
    } else {
      // Resolved green wire
      this.drawWire(
        wireX1,
        wireY,
        wireX2,
        wireY,
        TooltipColors.ready,
        alpha * 0.7
      )
    }

    // Draw nodes at wire ends
    const nodeColor = isResolved ? TooltipColors.ready : 0x7a7aaa
    this.drawNode(wireX1, wireY, nodeRadius, 0x2a2a4a, nodeColor, alpha)
    this.drawNode(wireX2, wireY, nodeRadius, 0x2a2a4a, nodeColor, alpha)

    // Resolution burst
    if (resolveT > 0.3 && resolveT < 1) {
      const burstT = (resolveT - 0.3) / 0.7
      const burstAlpha = Math.sin(burstT * Math.PI) * 0.5 * alpha
      const burstRadius = 6 + burstT * 10
      this.ctx.beginPath()
      this.ctx.arc(wireMidX, wireY, burstRadius, 0, Math.PI * 2)
      this.ctx.strokeStyle = hexToCSS(TooltipColors.ready, burstAlpha)
      this.ctx.lineWidth = 2
      this.ctx.stroke()
    }

    // Checkmark after resolve
    if (isResolved) {
      this.drawCheckmark(wireMidX, wireY, alpha)
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
    this.ctx.strokeStyle = hexToCSS(TooltipColors.conflict, 0.2 * alpha)
    this.ctx.lineWidth = 4
    this.ctx.stroke()

    // Crackling effect
    const segments = 4
    this.ctx.beginPath()
    this.ctx.moveTo(x1, y1)

    for (let i = 1; i < segments; i++) {
      const t = i / segments
      const x = this.lerp(x1, x2, t)
      const crackle = Math.sin(t * Math.PI * 3 + time * 0.03) * 2
      this.ctx.lineTo(x, y1 + crackle)
    }
    this.ctx.lineTo(x2, y2)
    this.ctx.strokeStyle = hexToCSS(TooltipColors.conflict, 0.9 * alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()
  }

  /**
   * Draw X button on wire
   */
  private drawXButton(
    x: number,
    y: number,
    scale: number,
    alpha: number
  ): void {
    if (!this.ctx || alpha <= 0) return

    const size = 7 * scale

    // Dark red background
    this.ctx.beginPath()
    this.ctx.arc(x, y, size, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(0x4a2a2a, 0.95 * alpha)
    this.ctx.fill()

    // Red border
    this.ctx.strokeStyle = hexToCSS(TooltipColors.conflict, alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.stroke()

    // X icon
    const iconSize = 2.5 * scale
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
   * Draw checkmark
   */
  private drawCheckmark(x: number, y: number, alpha: number): void {
    if (!this.ctx) return

    const size = 4
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
