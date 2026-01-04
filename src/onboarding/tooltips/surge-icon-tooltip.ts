// Surge Icon Tooltip Animation
// Shows: Reserve bandwidth → charge segments → release on cascade → boosted spawn
// Concept: Surge reserves BW for cascade size/golden/fragment boosts

import {
  TooltipAnimation,
  TooltipColors,
  hexToCSS,
  TOOLTIP_WIDTH,
} from './tooltip-animation'

// Golden ring color for boosted packages
const GOLDEN_RING = 0xffd700

export class SurgeIconTooltip extends TooltipAnimation {
  protected loopDuration = 2800 // 2.8 second loop

  // Animation phases
  private static readonly PHASES = {
    showBars: { start: 0, end: 0.1 }, // Show empty state
    charge: { start: 0.1, end: 0.35 }, // BW drains, surge charges
    hold: { start: 0.35, end: 0.45 }, // Hold charged state
    cascade: { start: 0.45, end: 0.75 }, // Release into cascade
    showResult: { start: 0.75, end: 0.85 }, // Show boosted packages
    reset: { start: 0.85, end: 1.0 }, // Fade for loop
  }

  protected setup(): void {
    // Initial draw handled by update
  }

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = SurgeIconTooltip.PHASES

    // Calculate charge level
    let chargeLevel = 0
    let bwLevel = 0.8 // Start with 80% BW

    if (progress < phases.charge.start) {
      chargeLevel = 0
      bwLevel = 0.8
    } else if (progress < phases.charge.end) {
      const chargeT = this.easeInOut(
        this.phaseProgress(progress, phases.charge)
      )
      chargeLevel = chargeT * 0.6 // Charge to 60% (3 segments)
      bwLevel = 0.8 - chargeT * 0.3 // BW drops to 50%
    } else if (progress < phases.cascade.start) {
      chargeLevel = 0.6
      bwLevel = 0.5
    } else if (progress < phases.cascade.end) {
      // Surge consumed during cascade
      const cascadeT = this.phaseProgress(progress, phases.cascade)
      chargeLevel = 0.6 * (1 - this.easeInOut(cascadeT))
      bwLevel = 0.5
    } else {
      chargeLevel = 0
      bwLevel = 0.5
    }

    // Cascade progress
    const isCascading =
      progress >= phases.cascade.start && progress < phases.showResult.start

    // Fade for loop reset
    let alpha = 1
    if (progress >= phases.reset.start) {
      alpha = 1 - this.phaseProgress(progress, phases.reset)
    }

    // Layout
    const bwBarX = 4
    const bwBarY = 6
    const bwBarWidth = 28
    const bwBarHeight = 8

    const surgeBarX = TOOLTIP_WIDTH - 32
    const surgeBarY = 6
    const surgeBarWidth = 28
    const surgeBarHeight = 8

    const centerX = TOOLTIP_WIDTH / 2
    const nodeAreaY = 36

    // Draw bandwidth bar (left)
    this.ctx.font = 'bold 8px system-ui, sans-serif'
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillStyle = hexToCSS(TooltipColors.bandwidth, 0.7 * alpha)
    this.ctx.fillText('↓', bwBarX + bwBarWidth / 2, bwBarY - 1)

    this.drawMiniBar(
      bwBarX,
      bwBarY + 4,
      bwBarWidth,
      bwBarHeight,
      bwLevel,
      TooltipColors.bandwidth,
      alpha
    )

    // Draw surge bar (right)
    this.ctx.fillStyle = hexToCSS(TooltipColors.surge, 0.7 * alpha)
    this.ctx.fillText('◎', surgeBarX + surgeBarWidth / 2, surgeBarY - 1)

    this.drawSurgeBar(
      surgeBarX,
      surgeBarY + 4,
      surgeBarWidth,
      surgeBarHeight,
      chargeLevel,
      alpha
    )

    // Draw arrow from BW to Surge during charge
    if (progress >= phases.charge.start && progress < phases.cascade.start) {
      const arrowT = this.phaseProgress(progress, phases.charge)
      this.drawTransferArrow(
        bwBarX + bwBarWidth + 2,
        bwBarY + 8,
        surgeBarX - 2,
        surgeBarY + 8,
        arrowT,
        alpha
      )
    }

    // Draw cascade effect
    if (isCascading) {
      const cascadeT = this.phaseProgress(progress, phases.cascade)
      this.drawCascadeEffect(centerX, nodeAreaY, cascadeT, alpha)
    }

    // Draw result packages (boosted with golden rings)
    if (progress >= phases.showResult.start && progress < phases.reset.start) {
      const showT = this.phaseProgress(progress, phases.showResult)
      this.drawBoostedPackages(centerX, nodeAreaY, showT, alpha)
    }
  }

  /**
   * Draw a mini resource bar
   */
  private drawMiniBar(
    x: number,
    y: number,
    width: number,
    height: number,
    fill: number,
    color: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    // Background
    this.ctx.beginPath()
    this.roundRect(x, y, width, height, 2)
    this.ctx.fillStyle = hexToCSS(0x2a2a4a, 0.6 * alpha)
    this.ctx.fill()

    // Fill
    if (fill > 0) {
      this.ctx.beginPath()
      this.roundRect(x, y, width * fill, height, 2)
      this.ctx.fillStyle = hexToCSS(color, 0.8 * alpha)
      this.ctx.fill()
    }
  }

  /**
   * Draw surge bar with segments
   */
  private drawSurgeBar(
    x: number,
    y: number,
    width: number,
    height: number,
    fill: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const segments = 5
    const gap = 1.5
    const segWidth = (width - gap * (segments - 1)) / segments

    for (let i = 0; i < segments; i++) {
      const sx = x + i * (segWidth + gap)
      const segmentFill = Math.max(0, Math.min(1, fill * segments - i))

      // Background
      this.ctx.beginPath()
      this.roundRect(sx, y, segWidth, height, 1)
      this.ctx.fillStyle = hexToCSS(TooltipColors.surge, 0.15 * alpha)
      this.ctx.fill()

      // Fill
      if (segmentFill > 0) {
        this.ctx.beginPath()
        this.roundRect(sx, y, segWidth * segmentFill, height, 1)
        this.ctx.fillStyle = hexToCSS(TooltipColors.surge, 0.85 * alpha)
        this.ctx.fill()

        // Glow for full segments
        if (segmentFill >= 1) {
          this.ctx.shadowColor = hexToCSS(TooltipColors.surge, 0.4)
          this.ctx.shadowBlur = 3
          this.ctx.fill()
          this.ctx.shadowBlur = 0
        }
      }
    }
  }

  /**
   * Draw transfer arrow from BW to Surge
   */
  private drawTransferArrow(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    progress: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const arrowAlpha = Math.sin(progress * Math.PI) * 0.6 * alpha

    // Flowing dots
    const numDots = 3
    for (let i = 0; i < numDots; i++) {
      const dotProgress = (progress * 2 + i * 0.3) % 1
      const x = this.lerp(x1, x2, dotProgress)
      const y = this.lerp(y1, y2, dotProgress)
      const dotAlpha = Math.sin(dotProgress * Math.PI) * arrowAlpha

      if (dotAlpha > 0.05) {
        this.ctx.beginPath()
        this.ctx.arc(x, y, 2, 0, Math.PI * 2)
        this.ctx.fillStyle = hexToCSS(TooltipColors.surge, dotAlpha)
        this.ctx.fill()
      }
    }
  }

  /**
   * Draw cascade burst effect
   */
  private drawCascadeEffect(
    x: number,
    y: number,
    progress: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    // Central burst
    const burstRadius = 6 + progress * 15
    const burstAlpha = (1 - progress) * 0.5 * alpha

    this.ctx.beginPath()
    this.ctx.arc(x, y, burstRadius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(TooltipColors.surge, burstAlpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Radiating particles
    const numParticles = 4
    for (let i = 0; i < numParticles; i++) {
      const angle = (i / numParticles) * Math.PI * 2 - Math.PI / 2
      const dist = 8 + progress * 20
      const px = x + Math.cos(angle) * dist
      const py = y + Math.sin(angle) * dist
      const particleAlpha = (1 - progress) * 0.6 * alpha

      if (particleAlpha > 0.05) {
        this.ctx.beginPath()
        this.ctx.arc(px, py, 3 * (1 - progress * 0.5), 0, Math.PI * 2)
        this.ctx.fillStyle = hexToCSS(TooltipColors.surgeBright, particleAlpha)
        this.ctx.fill()
      }
    }
  }

  /**
   * Draw boosted packages with golden rings
   */
  private drawBoostedPackages(
    centerX: number,
    centerY: number,
    progress: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const spawnT = this.easeInOut(Math.min(1, progress * 2))

    // Three packages in a row
    const positions = [
      { x: centerX - 20, y: centerY },
      { x: centerX, y: centerY },
      { x: centerX + 20, y: centerY },
    ]

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i]
      if (!pos) continue
      const nodeDelay = i * 0.15
      const localProgress = Math.max(
        0,
        (progress - nodeDelay) / (1 - nodeDelay)
      )
      if (localProgress <= 0) continue

      const nodeT = this.easeInOut(Math.min(1, localProgress * 1.5))
      const radius = 6 * nodeT

      // Golden outer ring (boost indicator)
      if (nodeT > 0.3) {
        const ringAlpha = ((nodeT - 0.3) / 0.7) * alpha * 0.8
        this.ctx.beginPath()
        this.ctx.arc(pos.x, pos.y, radius + 3, 0, Math.PI * 2)
        this.ctx.strokeStyle = hexToCSS(GOLDEN_RING, ringAlpha)
        this.ctx.lineWidth = 1.5
        this.ctx.stroke()
      }

      // Package node
      this.drawNode(
        pos.x,
        pos.y,
        radius,
        0x2a2a4a,
        TooltipColors.ready,
        nodeT * alpha
      )
    }

    // "+boost" text indicator
    if (spawnT > 0.5) {
      const textAlpha = (spawnT - 0.5) * 2 * alpha * 0.7
      this.ctx.font = 'bold 8px system-ui, sans-serif'
      this.ctx.textAlign = 'center'
      this.ctx.textBaseline = 'middle'
      this.ctx.fillStyle = hexToCSS(GOLDEN_RING, textAlpha)
      this.ctx.fillText('+', centerX, centerY + 14)
    }
  }
}
