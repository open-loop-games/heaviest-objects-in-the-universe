// Efficiency Tooltip Animation
// Shows: Duplicates with halos merging into symlink → efficiency bar fills
// Concept: Merging duplicates improves efficiency

import {
  TooltipAnimation,
  TooltipColors,
  hexToCSS,
  TOOLTIP_WIDTH,
  TOOLTIP_HEIGHT,
} from './tooltip-animation'

// Colors matching production
const SYMLINK_COLOR = 0x5affff // Cyan for symlink
const HALO_COLOR = 0x5affff // Cyan halo for duplicates
const NODE_FILL = 0x2a4a3a // Dark green fill
const NODE_BORDER = TooltipColors.ready // Green border

export class EfficiencyTooltip extends TooltipAnimation {
  protected loopDuration = 2500 // 2.5 second loop

  // Animation phases
  private static readonly PHASES = {
    showDuplicates: { start: 0, end: 0.2 }, // Show two duplicate nodes with halos
    merge: { start: 0.2, end: 0.5 }, // Nodes merge together
    symlink: { start: 0.5, end: 0.7 }, // Symlink forms, bar fills
    hold: { start: 0.7, end: 0.85 }, // Hold state
    reset: { start: 0.85, end: 1.0 }, // Fade for loop
  }

  protected setup(): void {
    // Initial draw handled by update
  }

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = EfficiencyTooltip.PHASES

    // Calculate merge progress
    const mergeT = this.easeInOut(this.phaseProgress(progress, phases.merge))
    const isMerged = progress >= phases.merge.end

    // Symlink progress after merge
    const symlinkT = this.phaseProgress(progress, phases.symlink)

    // Bar fill progress
    let barFill = 0.4 // Start at 40%
    if (progress >= phases.symlink.start) {
      barFill = 0.4 + this.easeInOut(symlinkT) * 0.4 // Grows to 80%
    }
    if (progress >= phases.symlink.end) {
      barFill = 0.8
    }

    // Fade for loop reset
    let alpha = 1
    if (progress >= phases.reset.start) {
      alpha = 1 - this.phaseProgress(progress, phases.reset)
    }

    // Halo pulse
    const haloPulse = Math.sin(progress * Math.PI * 6) * 0.5 + 0.5

    // Layout
    const barY = 6
    const barHeight = 8
    const barWidth = TOOLTIP_WIDTH - 16
    const barX = 8

    const nodeY = TOOLTIP_HEIGHT / 2 + 6
    const nodeRadius = 9

    // Node positions (merge from sides to center)
    const startSpacing = 22
    const endSpacing = 0
    const spacing = this.lerp(startSpacing, endSpacing, mergeT)
    const centerX = TOOLTIP_WIDTH / 2

    const leftX = centerX - spacing
    const rightX = centerX + spacing

    // Draw efficiency bar at top
    this.drawEfficiencyBar(barX, barY, barWidth, barHeight, barFill, alpha)

    // Draw connection line with merge icon (before merge)
    if (!isMerged) {
      this.drawConnectionLine(leftX, nodeY, rightX, nodeY, haloPulse, alpha)
    }

    // Draw halos around duplicate nodes (before merge)
    if (!isMerged) {
      this.drawHaloRing(leftX, nodeY, nodeRadius, haloPulse, alpha)
      this.drawHaloRing(rightX, nodeY, nodeRadius, haloPulse, alpha)
    }

    // Draw the two nodes (green, matching production)
    if (!isMerged) {
      this.drawDuplicateNode(leftX, nodeY, nodeRadius, alpha)
      this.drawDuplicateNode(rightX, nodeY, nodeRadius, alpha)
    } else {
      // Merged node with symlink glow
      this.drawMergedNode(centerX, nodeY, nodeRadius + 2, symlinkT, alpha)
    }

    // Merge burst effect
    if (isMerged && symlinkT < 1) {
      this.drawMergeEffect(centerX, nodeY, symlinkT, alpha)
    }
  }

  /**
   * Draw efficiency bar with gradient
   */
  private drawEfficiencyBar(
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

    // Fill with gradient (red → orange → cyan)
    if (fillPercent > 0) {
      const fillWidth = width * fillPercent
      const gradient = this.ctx.createLinearGradient(x, y, x + width, y)
      gradient.addColorStop(0, hexToCSS(0xff5a5a, 0.9 * alpha))
      gradient.addColorStop(0.4, hexToCSS(0xffaa5a, 0.9 * alpha))
      gradient.addColorStop(1, hexToCSS(SYMLINK_COLOR, 0.9 * alpha))

      this.ctx.beginPath()
      this.roundRect(x, y, fillWidth, height, 3)
      this.ctx.fillStyle = gradient
      this.ctx.fill()
    }

    // 50% threshold marker
    const markerX = x + width * 0.5
    this.ctx.beginPath()
    this.ctx.moveTo(markerX, y - 1)
    this.ctx.lineTo(markerX, y + height + 1)
    this.ctx.strokeStyle = hexToCSS(0xffffff, 0.25 * alpha)
    this.ctx.lineWidth = 1
    this.ctx.stroke()
  }

  /**
   * Draw connection line between duplicates with merge arrows
   */
  private drawConnectionLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    pulse: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    // Dashed connection line
    this.ctx.beginPath()
    this.ctx.moveTo(x1, y1)
    this.ctx.lineTo(x2, y2)
    this.ctx.strokeStyle = hexToCSS(HALO_COLOR, (0.3 + pulse * 0.3) * alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.setLineDash([4, 3])
    this.ctx.stroke()
    this.ctx.setLineDash([])

    // Center merge icon (arrows pointing inward)
    const midX = (x1 + x2) / 2
    const midY = y1
    const iconSize = 4

    this.ctx.beginPath()
    // Left arrow →
    this.ctx.moveTo(midX - iconSize - 2, midY)
    this.ctx.lineTo(midX - 2, midY)
    // Right arrow ←
    this.ctx.moveTo(midX + iconSize + 2, midY)
    this.ctx.lineTo(midX + 2, midY)
    this.ctx.strokeStyle = hexToCSS(HALO_COLOR, (0.5 + pulse * 0.3) * alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.stroke()
  }

  /**
   * Draw pulsing halo ring around duplicate node
   */
  private drawHaloRing(
    x: number,
    y: number,
    nodeRadius: number,
    pulse: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const haloRadius = nodeRadius + 4 + pulse * 3

    // Inner glow
    this.ctx.beginPath()
    this.ctx.arc(x, y, nodeRadius + 2, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(HALO_COLOR, 0.1 * alpha)
    this.ctx.fill()

    // Halo ring
    this.ctx.beginPath()
    this.ctx.arc(x, y, haloRadius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(HALO_COLOR, (0.4 + pulse * 0.3) * alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()
  }

  /**
   * Draw green duplicate node (matching production style)
   */
  private drawDuplicateNode(
    x: number,
    y: number,
    radius: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    // Node fill (dark green)
    this.ctx.beginPath()
    this.ctx.arc(x, y, radius - 1, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(NODE_FILL, 0.7 * alpha)
    this.ctx.fill()

    // Node border (green)
    this.ctx.beginPath()
    this.ctx.arc(x, y, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(NODE_BORDER, alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.stroke()
  }

  /**
   * Draw merged node with symlink glow
   */
  private drawMergedNode(
    x: number,
    y: number,
    radius: number,
    symlinkT: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    // Symlink glow (cyan)
    const glowAlpha = this.easeInOut(symlinkT) * 0.3 * alpha
    this.ctx.beginPath()
    this.ctx.arc(x, y, radius + 4, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(SYMLINK_COLOR, glowAlpha)
    this.ctx.fill()

    // Node fill (green)
    this.ctx.beginPath()
    this.ctx.arc(x, y, radius - 1, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(NODE_FILL, 0.7 * alpha)
    this.ctx.fill()

    // Node border (green)
    this.ctx.beginPath()
    this.ctx.arc(x, y, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(NODE_BORDER, alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.stroke()
  }

  /**
   * Draw merge burst effect (expanding cyan rings)
   */
  private drawMergeEffect(
    x: number,
    y: number,
    progress: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const fadeAlpha = (1 - progress) * alpha

    // Expanding ring 1
    const ring1Radius = 10 + progress * 15
    this.ctx.beginPath()
    this.ctx.arc(x, y, ring1Radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(SYMLINK_COLOR, fadeAlpha * 0.6)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Expanding ring 2
    const ring2Radius = 6 + progress * 12
    this.ctx.beginPath()
    this.ctx.arc(x, y, ring2Radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(SYMLINK_COLOR, fadeAlpha * 0.4)
    this.ctx.lineWidth = 1.5
    this.ctx.stroke()
  }
}
