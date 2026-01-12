// Tier 4 Tooltip Animation
// Shows: Depth indicator increasing (3 → 4 dots horizontally)
// Concept: Deeper nesting unlocked, faster automation

import {
  TooltipAnimation,
  hexToCSS,
  TOOLTIP_WIDTH,
  TOOLTIP_HEIGHT,
} from './tooltip-animation'

const TIER4_COLOR = 0xffc85a // Amber/gold for tier 4
const DEPTH_DOT_FILLED = 0x7a7aff // Purple - matches ScopeNavigation depth dots

export class Tier4Tooltip extends TooltipAnimation {
  protected loopDuration = 2400 // 2.4 second loop

  // Animation phases
  private static readonly PHASES = {
    showDepth: { start: 0, end: 0.15 }, // Show depth at 3
    pulse: { start: 0.15, end: 0.35 }, // Dots pulse
    addDot: { start: 0.35, end: 0.6 }, // Fourth dot expands in
    glow: { start: 0.6, end: 0.8 }, // Glow celebration
    hold: { start: 0.8, end: 0.9 }, // Hold state
    reset: { start: 0.9, end: 1.0 }, // Fade for loop
  }

  protected setup(): void {
    // Initial draw handled by update
  }

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = Tier4Tooltip.PHASES

    // Pulse before new dot
    const pulseT = this.phaseProgress(progress, phases.pulse)
    const pulseScale = 1 + Math.sin(pulseT * Math.PI * 3) * 0.1

    // New dot expansion
    const addDotT = this.easeInOut(this.phaseProgress(progress, phases.addDot))
    const hasNewDot = progress >= phases.addDot.start

    // Celebration glow
    const glowT = this.phaseProgress(progress, phases.glow)

    // Fade for loop reset
    let alpha = 1
    if (progress >= phases.reset.start) {
      alpha = 1 - this.phaseProgress(progress, phases.reset)
    }

    // Layout - horizontal depth dots
    const centerY = TOOLTIP_HEIGHT / 2 + 4
    const dotRadius = 5
    const dotSpacing = 12
    const totalDots = 5
    const startX = TOOLTIP_WIDTH / 2 - ((totalDots - 1) * dotSpacing) / 2

    // Draw connecting line behind dots (matches ScopeNavigation background)
    this.ctx.beginPath()
    this.ctx.moveTo(startX - 4, centerY)
    this.ctx.lineTo(startX + (totalDots - 1) * dotSpacing + 4, centerY)
    this.ctx.strokeStyle = hexToCSS(0x4a4a6a, 0.4 * alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Draw depth dots (left to right)
    for (let i = 0; i < totalDots; i++) {
      const dotX = startX + i * dotSpacing
      let dotAlpha = alpha
      let dotScale = pulseScale

      if (i === 4) {
        // Fifth dot (new one)
        if (!hasNewDot) continue
        dotAlpha = addDotT * alpha
        dotScale = addDotT
      }

      const isNew = i === 4
      const glowAmount = isNew && glowT > 0 ? glowT : i < 4 ? 0.2 : 0

      this.drawDepthDot(
        dotX,
        centerY,
        dotRadius * dotScale,
        dotAlpha,
        glowAmount
      )
    }

    // Arrow showing progression (→)
    const arrowX = TOOLTIP_WIDTH / 2
    const arrowY = 12
    this.drawArrowIcon(arrowX, arrowY, alpha * 0.7)

    // Lightning bolt icon (small, bottom)
    this.drawLightningBolt(
      TOOLTIP_WIDTH / 2,
      TOOLTIP_HEIGHT - 10,
      10,
      TIER4_COLOR,
      alpha * 0.8
    )

    // Speed lines around lightning when celebrating
    if (glowT > 0) {
      this.drawSpeedBurst(TOOLTIP_WIDTH / 2, TOOLTIP_HEIGHT - 10, glowT, alpha)
    }
  }

  /**
   * Draw a single depth dot matching ScopeNavigation style
   */
  private drawDepthDot(
    x: number,
    y: number,
    radius: number,
    alpha: number,
    glowIntensity: number = 0
  ): void {
    if (!this.ctx) return

    // Glow (purple, matching ScopeNavigation)
    if (glowIntensity > 0) {
      this.ctx.beginPath()
      this.ctx.arc(x, y, radius + 3, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(
        DEPTH_DOT_FILLED,
        glowIntensity * 0.5 * alpha
      )
      this.ctx.fill()
    }

    // Dot fill (purple when filled)
    this.ctx.beginPath()
    this.ctx.arc(x, y, radius, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(DEPTH_DOT_FILLED, 0.9 * alpha)
    this.ctx.fill()

    // Dot border (lighter purple)
    this.ctx.strokeStyle = hexToCSS(0x9a9aff, alpha)
    this.ctx.lineWidth = 1
    this.ctx.stroke()
  }

  /**
   * Draw right arrow icon (purple to match depth dots)
   */
  private drawArrowIcon(x: number, y: number, alpha: number): void {
    if (!this.ctx) return

    const size = 6
    this.ctx.beginPath()
    this.ctx.moveTo(x - size, y)
    this.ctx.lineTo(x + size, y)
    this.ctx.moveTo(x + size - 3, y - 3)
    this.ctx.lineTo(x + size, y)
    this.ctx.lineTo(x + size - 3, y + 3)
    this.ctx.strokeStyle = hexToCSS(DEPTH_DOT_FILLED, alpha)
    this.ctx.lineWidth = 2
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    this.ctx.stroke()
    this.ctx.lineCap = 'butt'
    this.ctx.lineJoin = 'miter'
  }

  /**
   * Draw speed burst lines around a point
   */
  private drawSpeedBurst(
    x: number,
    y: number,
    intensity: number,
    alpha: number
  ): void {
    if (!this.ctx || intensity <= 0) return

    const lines = [
      { angle: -2.5, len: 6 },
      { angle: -0.7, len: 8 },
      { angle: 0.7, len: 8 },
      { angle: 2.5, len: 6 },
    ]

    for (const line of lines) {
      const startDist = 8
      const sx = x + Math.cos(line.angle) * startDist
      const sy = y + Math.sin(line.angle) * startDist
      const ex = x + Math.cos(line.angle) * (startDist + line.len)
      const ey = y + Math.sin(line.angle) * (startDist + line.len)

      this.ctx.beginPath()
      this.ctx.moveTo(sx, sy)
      this.ctx.lineTo(ex, ey)
      this.ctx.strokeStyle = hexToCSS(TIER4_COLOR, intensity * alpha * 0.6)
      this.ctx.lineWidth = 1.5
      this.ctx.lineCap = 'round'
      this.ctx.stroke()
      this.ctx.lineCap = 'butt'
    }
  }

  /**
   * Draw lightning bolt icon
   */
  private drawLightningBolt(
    x: number,
    y: number,
    size: number,
    color: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const halfSize = size / 2

    this.ctx.beginPath()
    this.ctx.moveTo(x + halfSize * 0.2, y - halfSize)
    this.ctx.lineTo(x - halfSize * 0.3, y)
    this.ctx.lineTo(x + halfSize * 0.1, y)
    this.ctx.lineTo(x - halfSize * 0.2, y + halfSize)
    this.ctx.lineTo(x + halfSize * 0.5, y - halfSize * 0.2)
    this.ctx.lineTo(x, y - halfSize * 0.2)
    this.ctx.closePath()

    this.ctx.fillStyle = hexToCSS(color, alpha)
    this.ctx.fill()
  }
}
