// Bandwidth Icon Tooltip Animation
// Shows: Activity generates bandwidth - packages resolve → BW fills up
// Concept: ↓ = bandwidth, earned through activity (momentum system)

import {
  TooltipAnimation,
  TooltipColors,
  hexToCSS,
  TOOLTIP_WIDTH,
  TOOLTIP_HEIGHT,
} from './tooltip-animation'

export class BandwidthIconTooltip extends TooltipAnimation {
  protected loopDuration = 2400 // 2.4 second loop

  // Animation phases
  private static readonly PHASES = {
    showEmpty: { start: 0, end: 0.1 }, // Show low bar
    activity: { start: 0.1, end: 0.6 }, // Packages resolve, BW fills
    full: { start: 0.6, end: 0.85 }, // Show full bar
    reset: { start: 0.85, end: 1.0 }, // Fade for loop
  }

  protected setup(): void {
    // Initial draw handled by update
  }

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = BandwidthIconTooltip.PHASES

    // Calculate bar fill based on activity
    let barFill = 0.2 // Start at 20%
    if (progress >= phases.activity.start && progress < phases.activity.end) {
      const activityT = this.phaseProgress(progress, phases.activity)
      barFill = 0.2 + this.easeInOut(activityT) * 0.7 // Grows to 90%
    } else if (
      progress >= phases.activity.end &&
      progress < phases.reset.start
    ) {
      barFill = 0.9
    }

    // Fade for loop reset
    let alpha = 1
    if (progress >= phases.reset.start) {
      alpha = 1 - this.phaseProgress(progress, phases.reset)
    }

    // Layout
    const barX = 8
    const barY = TOOLTIP_HEIGHT - 14
    const barWidth = TOOLTIP_WIDTH - 16
    const barHeight = 10

    // Package activity area
    const centerX = TOOLTIP_WIDTH / 2
    const centerY = 22

    // Draw bandwidth icon at top
    this.ctx.font = 'bold 14px system-ui, sans-serif'
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillStyle = hexToCSS(TooltipColors.bandwidth, alpha)
    this.ctx.fillText('↓', centerX, 8)

    // Draw resolving packages that generate BW
    if (progress >= phases.activity.start && progress < phases.activity.end) {
      const activityT = this.phaseProgress(progress, phases.activity)
      this.drawActivityPackages(centerX, centerY, activityT, alpha)
    }

    // Draw the bandwidth bar (segmented)
    this.drawBar(
      barX,
      barY,
      barWidth,
      barHeight,
      6,
      barFill,
      TooltipColors.bandwidth,
      TooltipColors.bandwidthDark,
      0x2a2a4a,
      barFill > 0.5 ? TooltipColors.bandwidth : undefined
    )

    // Draw "+BW" indicators flying to bar during activity
    if (progress >= phases.activity.start && progress < phases.activity.end) {
      const activityT = this.phaseProgress(progress, phases.activity)
      this.drawBandwidthGain(centerX, centerY, barY, activityT, alpha)
    }
  }

  /**
   * Draw packages completing installation (green checkmarks appear)
   */
  private drawActivityPackages(
    centerX: number,
    centerY: number,
    progress: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const nodes = [
      { x: centerX - 18, y: centerY, delay: 0 },
      { x: centerX, y: centerY - 8, delay: 0.2 },
      { x: centerX + 18, y: centerY, delay: 0.4 },
    ]

    for (const node of nodes) {
      const localProgress = Math.max(0, (progress - node.delay) / 0.4)
      if (localProgress <= 0) continue

      const nodeRadius = 8
      const resolveT = Math.min(1, localProgress)

      // Installing state (blue) → Ready state (green)
      const isResolving = resolveT < 0.5
      const borderColor = isResolving
        ? TooltipColors.bandwidth
        : TooltipColors.ready
      const nodeAlpha = alpha * Math.min(1, localProgress * 2)

      // Node
      this.drawNode(
        node.x,
        node.y,
        nodeRadius,
        0x2a2a4a,
        borderColor,
        nodeAlpha
      )

      // Progress ring during install
      if (isResolving) {
        const ringProgress = resolveT * 2
        this.ctx.beginPath()
        this.ctx.arc(
          node.x,
          node.y,
          nodeRadius + 2,
          -Math.PI / 2,
          -Math.PI / 2 + ringProgress * Math.PI * 2
        )
        this.ctx.strokeStyle = hexToCSS(
          TooltipColors.bandwidth,
          0.6 * nodeAlpha
        )
        this.ctx.lineWidth = 2
        this.ctx.stroke()
      }

      // Checkmark when resolved
      if (!isResolving && resolveT > 0.6) {
        const checkAlpha = ((resolveT - 0.6) / 0.4) * alpha
        this.drawCheckmark(node.x, node.y, checkAlpha)
      }
    }
  }

  /**
   * Draw +↓ indicators flying from packages to the bar
   */
  private drawBandwidthGain(
    sourceX: number,
    sourceY: number,
    targetY: number,
    progress: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const numParticles = 3
    for (let i = 0; i < numParticles; i++) {
      const particleDelay = i * 0.25
      const particleProgress = Math.max(0, (progress - particleDelay) / 0.5)
      if (particleProgress <= 0 || particleProgress > 1) continue

      const t = this.easeInOut(particleProgress)
      const x = sourceX + (i - 1) * 12
      const y = this.lerp(sourceY + 12, targetY - 4, t)

      // Fade in and out
      const fadeIn = Math.min(particleProgress * 3, 1)
      const fadeOut =
        particleProgress > 0.7 ? 1 - (particleProgress - 0.7) / 0.3 : 1
      const particleAlpha = fadeIn * fadeOut * alpha * 0.8

      if (particleAlpha > 0.05) {
        this.ctx.font = 'bold 10px system-ui, sans-serif'
        this.ctx.textAlign = 'center'
        this.ctx.textBaseline = 'middle'
        this.ctx.fillStyle = hexToCSS(TooltipColors.bandwidth, particleAlpha)
        this.ctx.fillText('↓', x, y)
      }
    }
  }

  /**
   * Draw a small checkmark
   */
  private drawCheckmark(x: number, y: number, alpha: number): void {
    if (!this.ctx || alpha <= 0) return

    const size = 3
    this.ctx.beginPath()
    this.ctx.moveTo(x - size, y)
    this.ctx.lineTo(x - size * 0.2, y + size * 0.5)
    this.ctx.lineTo(x + size, y - size * 0.4)
    this.ctx.strokeStyle = hexToCSS(TooltipColors.ready, alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    this.ctx.stroke()
    this.ctx.lineCap = 'butt'
    this.ctx.lineJoin = 'miter'
  }
}
