// Tier 5 Tooltip Animation
// Shows: Pulsing star → finale ready glow
// Concept: Ultimate tier reached, something special awaits

import {
  TooltipAnimation,
  hexToCSS,
  TOOLTIP_WIDTH,
  TOOLTIP_HEIGHT,
} from './tooltip-animation'

const TIER5_COLOR = 0xff8cc8 // Pink/magenta for tier 5
const STAR_INNER = 0xffaadd
const STAR_GLOW = 0xff5aff

export class Tier5Tooltip extends TooltipAnimation {
  protected loopDuration = 2600 // 2.6 second loop

  // Animation phases
  private static readonly PHASES = {
    appear: { start: 0, end: 0.15 }, // Star fades in
    pulse1: { start: 0.15, end: 0.35 }, // First pulse
    pulse2: { start: 0.35, end: 0.55 }, // Second pulse (bigger)
    radiate: { start: 0.55, end: 0.8 }, // Radiating energy
    hold: { start: 0.8, end: 0.9 }, // Hold state
    reset: { start: 0.9, end: 1.0 }, // Fade for loop
  }

  protected setup(): void {
    // Initial draw handled by update
  }

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = Tier5Tooltip.PHASES

    // Appear fade in
    const appearT = this.easeInOut(this.phaseProgress(progress, phases.appear))

    // Pulse animations
    const pulse1T = this.phaseProgress(progress, phases.pulse1)
    const pulse2T = this.phaseProgress(progress, phases.pulse2)
    const pulseIntensity =
      Math.sin(pulse1T * Math.PI) * 0.3 + Math.sin(pulse2T * Math.PI) * 0.5

    // Radiate
    const radiateT = this.phaseProgress(progress, phases.radiate)

    // Fade for loop reset
    let alpha = appearT
    if (progress >= phases.reset.start) {
      alpha = 1 - this.phaseProgress(progress, phases.reset)
    }

    // Layout
    const centerX = TOOLTIP_WIDTH / 2
    const centerY = TOOLTIP_HEIGHT / 2

    // Background glow (pulsing)
    this.drawBackgroundGlow(centerX, centerY, pulseIntensity, alpha)

    // Radiating rings
    if (radiateT > 0) {
      this.drawRadiatingRings(centerX, centerY, radiateT, alpha)
    }

    // Central star
    const starScale = 1 + pulseIntensity * 0.2
    this.drawStar(centerX, centerY, 14 * starScale, alpha)

    // Depth totem at max (5 dots at bottom)
    this.drawMaxDepth(centerX, TOOLTIP_HEIGHT - 8, alpha)
  }

  /**
   * Draw pulsing background glow
   */
  private drawBackgroundGlow(
    x: number,
    y: number,
    intensity: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    // Outer glow
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, 35)
    gradient.addColorStop(
      0,
      hexToCSS(STAR_GLOW, 0.2 * alpha * (0.5 + intensity))
    )
    gradient.addColorStop(
      0.5,
      hexToCSS(TIER5_COLOR, 0.1 * alpha * (0.3 + intensity))
    )
    gradient.addColorStop(1, hexToCSS(TIER5_COLOR, 0))

    this.ctx.beginPath()
    this.ctx.arc(x, y, 35, 0, Math.PI * 2)
    this.ctx.fillStyle = gradient
    this.ctx.fill()
  }

  /**
   * Draw radiating energy rings
   */
  private drawRadiatingRings(
    x: number,
    y: number,
    progress: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const numRings = 3
    for (let i = 0; i < numRings; i++) {
      const ringProgress = (progress + i * 0.3) % 1
      const ringRadius = 10 + ringProgress * 25
      const ringAlpha = (1 - ringProgress) * 0.4 * alpha

      if (ringAlpha <= 0.01) continue

      this.ctx.beginPath()
      this.ctx.arc(x, y, ringRadius, 0, Math.PI * 2)
      this.ctx.strokeStyle = hexToCSS(TIER5_COLOR, ringAlpha)
      this.ctx.lineWidth = 1.5
      this.ctx.stroke()
    }
  }

  /**
   * Draw 5-pointed star
   */
  private drawStar(x: number, y: number, size: number, alpha: number): void {
    if (!this.ctx) return

    const points = 5
    const outerRadius = size
    const innerRadius = size * 0.4

    // Star glow
    this.ctx.beginPath()
    this.ctx.arc(x, y, outerRadius + 4, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(STAR_GLOW, 0.25 * alpha)
    this.ctx.fill()

    // Star shape
    this.ctx.beginPath()
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius
      const angle = (i * Math.PI) / points - Math.PI / 2
      const px = x + Math.cos(angle) * radius
      const py = y + Math.sin(angle) * radius

      if (i === 0) {
        this.ctx.moveTo(px, py)
      } else {
        this.ctx.lineTo(px, py)
      }
    }
    this.ctx.closePath()

    // Fill with gradient
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, outerRadius)
    gradient.addColorStop(0, hexToCSS(STAR_INNER, 0.95 * alpha))
    gradient.addColorStop(0.5, hexToCSS(TIER5_COLOR, 0.9 * alpha))
    gradient.addColorStop(1, hexToCSS(STAR_GLOW, 0.8 * alpha))

    this.ctx.fillStyle = gradient
    this.ctx.fill()

    // Border
    this.ctx.strokeStyle = hexToCSS(0xffffff, 0.5 * alpha)
    this.ctx.lineWidth = 1
    this.ctx.stroke()
  }

  /**
   * Draw max depth indicator (5 dots)
   */
  private drawMaxDepth(x: number, y: number, alpha: number): void {
    if (!this.ctx) return

    const dots = 5
    const dotRadius = 2
    const dotSpacing = 7
    const totalWidth = (dots - 1) * dotSpacing
    const startX = x - totalWidth / 2

    for (let i = 0; i < dots; i++) {
      const dotX = startX + i * dotSpacing

      this.ctx.beginPath()
      this.ctx.arc(dotX, y, dotRadius, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(TIER5_COLOR, alpha * 0.9)
      this.ctx.fill()
    }

    // Glow under all dots
    this.ctx.beginPath()
    this.ctx.ellipse(x, y, totalWidth / 2 + 4, 4, 0, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(TIER5_COLOR, 0.15 * alpha)
    this.ctx.fill()
  }
}
