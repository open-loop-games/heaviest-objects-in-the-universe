// Weight Icon Tooltip Animation
// Shows: Packages install → weight accumulates → bar fills → ship threshold
// Concept: ◆ = weight (node_modules size), accumulates toward prestige

import {
  TooltipAnimation,
  TooltipColors,
  hexToCSS,
  TOOLTIP_WIDTH,
  TOOLTIP_HEIGHT,
} from './tooltip-animation'

// Ship/prestige colors
const SHIP_GLOW = 0x7a5aff // Purple glow when ready to ship

export class WeightIconTooltip extends TooltipAnimation {
  protected loopDuration = 2600 // 2.6 second loop

  // Animation phases
  private static readonly PHASES = {
    accumulate: { start: 0, end: 0.5 }, // Weight bar fills as packages install
    threshold: { start: 0.5, end: 0.65 }, // Threshold reached, glow
    ship: { start: 0.65, end: 0.85 }, // Ship animation
    reset: { start: 0.85, end: 1.0 }, // Fade for loop
  }

  protected setup(): void {
    // Initial draw handled by update
  }

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = WeightIconTooltip.PHASES

    // Calculate bar fill
    let barFill = 0.15 // Start at 15%
    if (progress < phases.accumulate.end) {
      const t = this.phaseProgress(progress, phases.accumulate)
      barFill = 0.15 + this.easeInOut(t) * 0.85 // Grows to 100%
    } else if (progress < phases.reset.start) {
      barFill = 1.0
    }

    // Ship animation progress
    const shipT = this.phaseProgress(progress, phases.ship)
    const isShipping =
      progress >= phases.ship.start && progress < phases.ship.end

    // Threshold reached glow
    const atThreshold =
      progress >= phases.threshold.start && progress < phases.reset.start

    // Fade for loop reset
    let alpha = 1
    if (progress >= phases.reset.start) {
      alpha = 1 - this.phaseProgress(progress, phases.reset)
      barFill = 1 - (1 - alpha) * 0.8 // Drain during fade
    }

    // Layout
    const barX = 8
    const barY = TOOLTIP_HEIGHT - 14
    const barWidth = TOOLTIP_WIDTH - 16
    const barHeight = 10

    const centerX = TOOLTIP_WIDTH / 2
    const nodeAreaY = 20

    // Draw weight icon at top
    this.ctx.font = 'bold 12px system-ui, sans-serif'
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillStyle = hexToCSS(TooltipColors.weight, alpha)
    this.ctx.fillText('◆', centerX, 8)

    // Draw packages accumulating weight
    if (progress < phases.threshold.start) {
      const accumT = this.phaseProgress(progress, phases.accumulate)
      this.drawAccumulatingPackages(centerX, nodeAreaY, accumT, alpha)
    }

    // Draw ship indicator when at threshold
    if (atThreshold && !isShipping) {
      this.drawShipIndicator(centerX, nodeAreaY, progress, alpha)
    }

    // Draw ship burst when shipping
    if (isShipping) {
      this.drawShipBurst(centerX, nodeAreaY, shipT, alpha)
    }

    // Draw the weight bar
    this.drawWeightBar(
      barX,
      barY,
      barWidth,
      barHeight,
      barFill,
      atThreshold,
      alpha
    )

    // Draw threshold marker
    this.drawThresholdMarker(barX, barY, barWidth, barHeight, alpha)

    // Draw diamonds flying to bar during accumulation
    if (progress < phases.threshold.start) {
      const accumT = this.phaseProgress(progress, phases.accumulate)
      this.drawWeightGain(centerX, nodeAreaY + 8, barY, accumT, alpha)
    }
  }

  /**
   * Draw packages that contribute weight
   */
  private drawAccumulatingPackages(
    centerX: number,
    centerY: number,
    progress: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    // Show 2-3 packages appearing and adding weight
    const nodes = [
      { x: centerX - 14, y: centerY, delay: 0 },
      { x: centerX + 14, y: centerY, delay: 0.3 },
    ]

    for (const node of nodes) {
      const localProgress = Math.max(0, (progress - node.delay) / 0.5)
      if (localProgress <= 0) continue

      const nodeRadius = 7
      const spawnT = this.easeInOut(Math.min(1, localProgress))
      const nodeAlpha = alpha * spawnT

      // Node (green = ready)
      this.drawNode(
        node.x,
        node.y,
        nodeRadius * spawnT,
        0x2a2a4a,
        TooltipColors.ready,
        nodeAlpha
      )
    }
  }

  /**
   * Draw ship-ready indicator (pulsing ship icon)
   */
  private drawShipIndicator(
    x: number,
    y: number,
    progress: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const pulse = Math.sin(progress * Math.PI * 12) * 0.5 + 0.5

    // Pulsing glow
    this.ctx.beginPath()
    this.ctx.arc(x, y, 12 + pulse * 4, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(SHIP_GLOW, 0.2 * alpha * pulse)
    this.ctx.fill()

    // Ship box icon
    const boxSize = 8
    this.ctx.fillStyle = hexToCSS(SHIP_GLOW, 0.9 * alpha)
    this.ctx.fillRect(x - boxSize / 2, y - boxSize / 2, boxSize, boxSize * 0.7)
    this.ctx.strokeStyle = hexToCSS(SHIP_GLOW, alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.strokeRect(
      x - boxSize / 2,
      y - boxSize / 2,
      boxSize,
      boxSize * 0.7
    )

    // Up arrow above box
    this.ctx.beginPath()
    this.ctx.moveTo(x, y - boxSize)
    this.ctx.lineTo(x - 4, y - boxSize / 2 - 1)
    this.ctx.moveTo(x, y - boxSize)
    this.ctx.lineTo(x + 4, y - boxSize / 2 - 1)
    this.ctx.stroke()
  }

  /**
   * Draw ship burst effect
   */
  private drawShipBurst(
    x: number,
    y: number,
    progress: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const burstAlpha = (1 - progress) * alpha

    // Expanding rings
    for (let i = 0; i < 2; i++) {
      const ringProgress = Math.min(1, progress * 1.5 + i * 0.2)
      const radius = 8 + ringProgress * 20
      const ringAlpha = (1 - ringProgress) * burstAlpha * 0.6

      if (ringAlpha > 0.05) {
        this.ctx.beginPath()
        this.ctx.arc(x, y, radius, 0, Math.PI * 2)
        this.ctx.strokeStyle = hexToCSS(SHIP_GLOW, ringAlpha)
        this.ctx.lineWidth = 2
        this.ctx.stroke()
      }
    }

    // Central flash
    if (progress < 0.3) {
      const flashAlpha = (1 - progress / 0.3) * alpha
      this.ctx.beginPath()
      this.ctx.arc(x, y, 6, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(0xffffff, flashAlpha * 0.8)
      this.ctx.fill()
    }
  }

  /**
   * Draw weight bar with threshold indicator
   */
  private drawWeightBar(
    x: number,
    y: number,
    width: number,
    height: number,
    fillPercent: number,
    atThreshold: boolean,
    alpha: number
  ): void {
    if (!this.ctx) return

    // Background
    this.ctx.beginPath()
    this.roundRect(x, y, width, height, 3)
    this.ctx.fillStyle = hexToCSS(0x2a2a3a, 0.8 * alpha)
    this.ctx.fill()

    // Fill with gradient
    if (fillPercent > 0) {
      const fillWidth = width * fillPercent
      const gradient = this.ctx.createLinearGradient(x, y, x + width, y)
      gradient.addColorStop(0, hexToCSS(TooltipColors.weightDark, 0.9 * alpha))
      gradient.addColorStop(0.7, hexToCSS(TooltipColors.weight, 0.9 * alpha))
      gradient.addColorStop(1, hexToCSS(SHIP_GLOW, 0.9 * alpha))

      this.ctx.beginPath()
      this.roundRect(x, y, fillWidth, height, 3)
      this.ctx.fillStyle = gradient
      this.ctx.fill()

      // Glow when at threshold
      if (atThreshold) {
        this.ctx.shadowColor = hexToCSS(SHIP_GLOW, 0.6)
        this.ctx.shadowBlur = 8
        this.ctx.fill()
        this.ctx.shadowBlur = 0
      }
    }
  }

  /**
   * Draw threshold marker on bar
   */
  private drawThresholdMarker(
    barX: number,
    barY: number,
    barWidth: number,
    barHeight: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    // Threshold line at end of bar
    const markerX = barX + barWidth - 1
    this.ctx.beginPath()
    this.ctx.moveTo(markerX, barY - 2)
    this.ctx.lineTo(markerX, barY + barHeight + 2)
    this.ctx.strokeStyle = hexToCSS(SHIP_GLOW, 0.5 * alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()
  }

  /**
   * Draw ◆ diamonds flying from packages to the bar
   */
  private drawWeightGain(
    sourceX: number,
    sourceY: number,
    targetY: number,
    progress: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const numDiamonds = 4
    for (let i = 0; i < numDiamonds; i++) {
      const diamondDelay = i * 0.2
      const diamondProgress = Math.max(0, (progress - diamondDelay) / 0.4)
      if (diamondProgress <= 0 || diamondProgress > 1) continue

      const t = this.easeInOut(diamondProgress)
      const x = sourceX + (i - 1.5) * 8
      const y = this.lerp(sourceY, targetY - 4, t)

      // Fade in and out
      const fadeIn = Math.min(diamondProgress * 3, 1)
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
