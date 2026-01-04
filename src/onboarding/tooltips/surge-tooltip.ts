// Surge Upgrade Tooltip Animation
// Shows: More segments = more packages cascade out with golden rings
// Concept: ◎ upgrade = unlock more surge segments = bigger cascades

import {
  TooltipAnimation,
  TooltipColors,
  hexToCSS,
  TOOLTIP_WIDTH,
} from './tooltip-animation'

// Golden node colors (matching real golden packages)
const GOLDEN_RING = 0xffd700

export class SurgeTooltip extends TooltipAnimation {
  protected loopDuration = 2200 // 2.2 second loop

  // Animation phases
  private static readonly PHASES = {
    showBar: { start: 0, end: 0.15 }, // Show surge bar
    chargeMore: { start: 0.15, end: 0.35 }, // More segments light up
    cascade: { start: 0.35, end: 0.7 }, // Packages cascade out
    hold: { start: 0.7, end: 0.85 }, // Hold state
    reset: { start: 0.85, end: 1.0 }, // Fade for loop
  }

  protected setup(): void {
    // Initial draw handled by update
  }

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = SurgeTooltip.PHASES

    // Calculate charge level (how many segments lit)
    let chargeLevel = 0.3 // Start with 30%
    if (progress >= phases.chargeMore.start) {
      const chargeT = this.easeInOut(
        this.phaseProgress(progress, phases.chargeMore)
      )
      chargeLevel = 0.3 + chargeT * 0.5 // Grows to 80%
    }
    if (progress >= phases.chargeMore.end) {
      chargeLevel = 0.8
    }

    // Cascade progress
    const cascadeT = this.phaseProgress(progress, phases.cascade)

    // Fade for loop reset
    let alpha = 1
    if (progress >= phases.reset.start) {
      alpha = 1 - this.phaseProgress(progress, phases.reset)
    }

    // Layout
    const barY = 6
    const barHeight = 10
    const barWidth = 50
    const barX = (TOOLTIP_WIDTH - barWidth) / 2

    const rootX = TOOLTIP_WIDTH / 2
    const rootY = 26
    const rootRadius = 7

    // Draw surge bar at top
    this.drawSurgeBar(barX, barY, barWidth, barHeight, chargeLevel, alpha)

    // Draw root node (center)
    this.drawNode(
      rootX,
      rootY,
      rootRadius,
      0x2a2a4a,
      TooltipColors.ready,
      alpha
    )

    // Draw two cascading nodes horizontally below (left and right)
    this.drawCascadeNodes(rootX, rootY, cascadeT, alpha)
  }

  /**
   * Draw surge bar with segments
   */
  private drawSurgeBar(
    x: number,
    y: number,
    width: number,
    height: number,
    fillPercent: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const segments = 5
    const gap = 2
    const segWidth = (width - gap * (segments - 1)) / segments

    for (let i = 0; i < segments; i++) {
      const sx = x + i * (segWidth + gap)
      const segmentFill = Math.max(0, Math.min(1, fillPercent * segments - i))

      // Background
      this.ctx.beginPath()
      this.roundRect(sx, y, segWidth, height, 2)
      this.ctx.fillStyle = hexToCSS(TooltipColors.surge, 0.15 * alpha)
      this.ctx.fill()

      // Fill
      if (segmentFill > 0) {
        const gradient = this.ctx.createLinearGradient(sx, y + height, sx, y)
        gradient.addColorStop(0, hexToCSS(0xc08020, 0.9 * alpha))
        gradient.addColorStop(1, hexToCSS(TooltipColors.surge, 0.9 * alpha))

        this.ctx.beginPath()
        this.roundRect(sx, y, segWidth * segmentFill, height, 2)
        this.ctx.fillStyle = gradient
        this.ctx.fill()

        // Glow for full segments
        if (segmentFill >= 1) {
          this.ctx.shadowColor = hexToCSS(TooltipColors.surge, 0.4)
          this.ctx.shadowBlur = 4
          this.ctx.beginPath()
          this.roundRect(sx, y, segWidth, height, 2)
          this.ctx.fill()
          this.ctx.shadowBlur = 0
        }
      }
    }
  }

  /**
   * Draw two cascading nodes with golden rings (horizontal layout)
   */
  private drawCascadeNodes(
    rootX: number,
    rootY: number,
    progress: number,
    alpha: number
  ): void {
    if (!this.ctx || progress <= 0) return

    // Two nodes - left and right horizontally
    const nodeY = 44 // Below root
    const spacing = 22 // Distance from center
    const nodeRadius = 9

    const nodes = [
      { x: rootX - spacing, delay: 0 },
      { x: rootX + spacing, delay: 0.15 },
    ]

    for (const node of nodes) {
      const localProgress = Math.max(
        0,
        (progress - node.delay) / (1 - node.delay)
      )
      if (localProgress <= 0) continue

      const spawnT = this.easeInOut(Math.min(1, localProgress * 1.3))
      const x = this.lerp(rootX, node.x, spawnT)
      const y = this.lerp(rootY, nodeY, spawnT)
      const radius = nodeRadius * spawnT

      if (radius < 2) continue

      // Wire from root
      this.drawWire(
        rootX,
        rootY,
        x,
        y,
        TooltipColors.surge,
        0.5 * spawnT * alpha
      )

      // Golden outer ring (like real golden packages)
      if (spawnT > 0.4) {
        const ringAlpha = ((spawnT - 0.4) / 0.6) * alpha * 0.8
        this.ctx.beginPath()
        this.ctx.arc(x, y, radius + 3, 0, Math.PI * 2)
        this.ctx.strokeStyle = hexToCSS(GOLDEN_RING, ringAlpha)
        this.ctx.lineWidth = 2
        this.ctx.stroke()
      }

      // Package node (green fill, green border)
      this.drawNode(x, y, radius, 0x2a2a4a, TooltipColors.ready, spawnT * alpha)
    }
  }
}
