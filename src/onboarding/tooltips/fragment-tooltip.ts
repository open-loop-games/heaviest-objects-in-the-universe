// Fragment Tooltip Animation
// Shows: Golden package → fragment star lights up
// Concept: Collect golden packages at depth 3+, each one fills a fragment star

import {
  TooltipAnimation,
  hexToCSS,
  TOOLTIP_WIDTH,
  TOOLTIP_HEIGHT,
} from './tooltip-animation'

const GOLDEN_COLOR = 0xffc85a // Golden package color

export class FragmentTooltip extends TooltipAnimation {
  protected loopDuration = 2400 // 2.4 second loop

  // Animation phases
  private static readonly PHASES = {
    showPackage: { start: 0, end: 0.15 }, // Show golden package
    collect: { start: 0.15, end: 0.45 }, // Package pulses, fragment flies out
    fillStar: { start: 0.45, end: 0.65 }, // Star lights up
    celebrate: { start: 0.65, end: 0.8 }, // Star glows bright
    hold: { start: 0.8, end: 0.9 }, // Hold state
    reset: { start: 0.9, end: 1.0 }, // Fade for loop
  }

  protected setup(): void {
    // Initial draw handled by update
  }

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = FragmentTooltip.PHASES

    // Phase progress values
    const collectT = this.easeInOut(
      this.phaseProgress(progress, phases.collect)
    )
    const fillStarT = this.easeInOut(
      this.phaseProgress(progress, phases.fillStar)
    )
    const celebrateT = this.phaseProgress(progress, phases.celebrate)

    // Fade for loop reset
    let alpha = 1
    if (progress >= phases.reset.start) {
      alpha = 1 - this.phaseProgress(progress, phases.reset)
    }

    // Layout
    const packageX = 20
    const packageY = TOOLTIP_HEIGHT / 2
    const starsX = TOOLTIP_WIDTH - 20
    const starsStartY = 10

    // Draw golden package (left side)
    const packagePulse =
      collectT > 0 && collectT < 1 ? Math.sin(collectT * Math.PI * 4) * 0.15 : 0
    const packageScale = 1 + packagePulse
    const packageAlpha = (1 - collectT * 0.3) * alpha
    this.drawGoldenPackage(packageX, packageY, 12 * packageScale, packageAlpha)

    // Draw fragment flying from package to first star
    if (collectT > 0.2 && collectT < 1) {
      const flyT = Math.min(1, (collectT - 0.2) / 0.6)
      const fragX = this.lerp(packageX, starsX, this.easeInOut(flyT))
      const fragY = this.lerp(packageY, starsStartY + 8, this.easeInOut(flyT))
      const fragAlpha = (1 - flyT * 0.5) * alpha

      this.drawFragment(fragX, fragY, fragAlpha)
    }

    // Draw 5 fragment stars (right side, vertical)
    const starSpacing = 10
    for (let i = 0; i < 5; i++) {
      const starY = starsStartY + i * starSpacing
      const isFilled = i === 0 && fillStarT > 0
      const glowAmount = i === 0 && celebrateT > 0 ? celebrateT : 0

      this.drawFragmentStar(
        starsX,
        starY,
        isFilled,
        fillStarT,
        glowAmount,
        alpha
      )
    }

    // Arrow showing flow
    this.drawFlowArrow(TOOLTIP_WIDTH / 2, packageY, alpha * 0.5)
  }

  /**
   * Draw golden package with glow
   */
  private drawGoldenPackage(
    x: number,
    y: number,
    radius: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    // Outer glow
    this.ctx.beginPath()
    this.ctx.arc(x, y, radius + 4, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(GOLDEN_COLOR, 0.25 * alpha)
    this.ctx.fill()

    // Package body
    this.ctx.beginPath()
    this.ctx.arc(x, y, radius, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(0x3a2a1a, 0.9 * alpha)
    this.ctx.fill()
    this.ctx.strokeStyle = hexToCSS(GOLDEN_COLOR, alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Sparkle highlight
    this.ctx.beginPath()
    this.ctx.arc(
      x - radius * 0.3,
      y - radius * 0.3,
      radius * 0.25,
      0,
      Math.PI * 2
    )
    this.ctx.fillStyle = hexToCSS(0xffffff, 0.5 * alpha)
    this.ctx.fill()
  }

  /**
   * Draw flying fragment (small diamond)
   */
  private drawFragment(x: number, y: number, alpha: number): void {
    if (!this.ctx) return

    const size = 4
    this.ctx.beginPath()
    this.ctx.moveTo(x, y - size)
    this.ctx.lineTo(x + size * 0.7, y)
    this.ctx.lineTo(x, y + size)
    this.ctx.lineTo(x - size * 0.7, y)
    this.ctx.closePath()
    this.ctx.fillStyle = hexToCSS(GOLDEN_COLOR, alpha)
    this.ctx.fill()

    // Trail
    this.ctx.beginPath()
    this.ctx.moveTo(x - size * 0.7, y)
    this.ctx.lineTo(x - size * 3, y)
    this.ctx.strokeStyle = hexToCSS(GOLDEN_COLOR, alpha * 0.3)
    this.ctx.lineWidth = 2
    this.ctx.lineCap = 'round'
    this.ctx.stroke()
    this.ctx.lineCap = 'butt'
  }

  /**
   * Draw a fragment star (✦)
   */
  private drawFragmentStar(
    x: number,
    y: number,
    isFilled: boolean,
    fillT: number,
    glowAmount: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const size = 10

    // Glow when celebrating
    if (glowAmount > 0) {
      this.ctx.beginPath()
      this.ctx.arc(x, y, 8, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(GOLDEN_COLOR, glowAmount * 0.4 * alpha)
      this.ctx.fill()
    }

    // Star symbol
    this.ctx.font = `${size}px sans-serif`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'

    if (isFilled) {
      // Filled star
      const brightness = 0.5 + fillT * 0.5
      this.ctx.fillStyle = hexToCSS(GOLDEN_COLOR, brightness * alpha)
      if (glowAmount > 0) {
        this.ctx.shadowColor = hexToCSS(GOLDEN_COLOR, glowAmount * 0.8)
        this.ctx.shadowBlur = 6
      }
    } else {
      // Empty star
      this.ctx.fillStyle = hexToCSS(GOLDEN_COLOR, 0.15 * alpha)
    }

    this.ctx.fillText('✦', x, y)
    this.ctx.shadowBlur = 0
  }

  /**
   * Draw arrow showing collection flow
   */
  private drawFlowArrow(x: number, y: number, alpha: number): void {
    if (!this.ctx) return

    const arrowLen = 12
    this.ctx.beginPath()
    this.ctx.moveTo(x - arrowLen / 2, y)
    this.ctx.lineTo(x + arrowLen / 2, y)
    this.ctx.moveTo(x + arrowLen / 2 - 4, y - 3)
    this.ctx.lineTo(x + arrowLen / 2, y)
    this.ctx.lineTo(x + arrowLen / 2 - 4, y + 3)
    this.ctx.strokeStyle = hexToCSS(0x8a8aaa, alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    this.ctx.stroke()
    this.ctx.lineCap = 'butt'
    this.ctx.lineJoin = 'miter'
  }
}
