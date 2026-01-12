// Tier 3 Tooltip Animation
// Shows: Package with portal rings → opens to reveal inner scope → golden package sparkles
// Concept: Deeper nesting + golden packages at depth 3+

import {
  TooltipAnimation,
  TooltipColors,
  hexToCSS,
  TOOLTIP_WIDTH,
  TOOLTIP_HEIGHT,
} from './tooltip-animation'

const TIER3_COLOR = 0x5affc8 // Cyan-green for tier 3
const PORTAL_COLOR = 0x7a5aff // Purple portal rings
const GOLDEN_COLOR = 0xffc85a // Golden package

export class Tier3Tooltip extends TooltipAnimation {
  protected loopDuration = 2800 // 2.8 second loop

  // Animation phases
  private static readonly PHASES = {
    showPackage: { start: 0, end: 0.15 }, // Show compressed package
    openPortal: { start: 0.15, end: 0.35 }, // Portal rings expand
    revealInner: { start: 0.35, end: 0.55 }, // Inner scope appears with depth rings
    goldenSpawn: { start: 0.55, end: 0.75 }, // Golden package appears
    hold: { start: 0.75, end: 0.9 }, // Hold state
    reset: { start: 0.9, end: 1.0 }, // Fade for loop
  }

  protected setup(): void {
    // Initial draw handled by update
  }

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = Tier3Tooltip.PHASES

    // Portal opening progress
    const portalT = this.easeInOut(
      this.phaseProgress(progress, phases.openPortal)
    )
    const isOpen = progress >= phases.openPortal.end

    // Inner scope reveal
    const innerT = this.easeInOut(
      this.phaseProgress(progress, phases.revealInner)
    )

    // Golden package spawn
    const goldenT = this.easeInOut(
      this.phaseProgress(progress, phases.goldenSpawn)
    )
    const showGolden = progress >= phases.goldenSpawn.start

    // Fade for loop reset
    let alpha = 1
    if (progress >= phases.reset.start) {
      alpha = 1 - this.phaseProgress(progress, phases.reset)
    }

    // Layout
    const centerX = TOOLTIP_WIDTH / 2
    const centerY = TOOLTIP_HEIGHT / 2 + 2
    const outerRadius = 16
    const innerRadius = 8

    // Draw outer package with portal rings
    if (!isOpen) {
      // Compressed package (before opening)
      this.drawCompressedPackage(centerX, centerY, outerRadius, portalT, alpha)
    } else {
      // Opened - show inner scope
      this.drawOpenedScope(
        centerX,
        centerY,
        outerRadius,
        innerRadius,
        innerT,
        alpha
      )

      // Golden package inside
      if (showGolden) {
        this.drawGoldenPackage(centerX + 8, centerY - 2, 6, goldenT, alpha)
      }
    }

    // Depth indicator (bottom) - shows depth increasing
    // When closed: show 3 dots at full alpha
    // When open: show 3 dots + 4th fading in with innerT
    this.drawDepthIndicator(
      centerX,
      TOOLTIP_HEIGHT - 8,
      isOpen ? 4 : 3,
      isOpen ? innerT : 1,
      alpha
    )
  }

  /**
   * Draw compressed package with portal rings
   */
  private drawCompressedPackage(
    x: number,
    y: number,
    radius: number,
    openT: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    // Portal rings (expanding outward as it opens)
    const ringScale = 1 + openT * 0.3
    for (let i = 0; i < 2; i++) {
      const ringRadius = (radius + 3 + i * 4) * ringScale
      const ringAlpha = (0.4 - i * 0.15) * alpha * (1 - openT * 0.5)
      this.ctx.beginPath()
      this.ctx.arc(x, y, ringRadius, 0, Math.PI * 2)
      this.ctx.strokeStyle = hexToCSS(PORTAL_COLOR, ringAlpha)
      this.ctx.lineWidth = 1.5
      this.ctx.stroke()
    }

    // Main package node
    const nodeScale = 1 - openT * 0.2
    this.drawNode(x, y, radius * nodeScale, 0x2a3a4a, TIER3_COLOR, alpha)

    // Inner portal hint (dark center)
    this.ctx.beginPath()
    this.ctx.arc(x, y, radius * 0.4, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(0x1a0a2a, 0.8 * alpha)
    this.ctx.fill()
  }

  /**
   * Draw opened scope with inner packages
   */
  private drawOpenedScope(
    x: number,
    y: number,
    outerRadius: number,
    innerRadius: number,
    revealT: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    // Outer scope ring (faded, showing it's "open")
    this.ctx.beginPath()
    this.ctx.arc(x, y, outerRadius + 4, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(PORTAL_COLOR, 0.25 * alpha)
    this.ctx.lineWidth = 1
    this.ctx.setLineDash([3, 3])
    this.ctx.stroke()
    this.ctx.setLineDash([])

    // Inner scope background
    this.ctx.beginPath()
    this.ctx.arc(x, y, outerRadius, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(0x1a1a2a, 0.5 * alpha * revealT)
    this.ctx.fill()

    // Inner packages appearing
    const innerAlpha = revealT * alpha

    // Center package
    this.drawNode(
      x - 6,
      y,
      innerRadius,
      0x2a3a4a,
      TooltipColors.ready,
      innerAlpha * 0.9
    )

    // Connected package
    if (revealT > 0.3) {
      const pkg2Alpha = ((revealT - 0.3) / 0.7) * alpha
      this.drawNode(
        x + 10,
        y + 4,
        innerRadius - 2,
        0x2a3a4a,
        TooltipColors.ready,
        pkg2Alpha * 0.8
      )
      // Wire
      this.drawWire(
        x - 6,
        y,
        x + 10,
        y + 4,
        TooltipColors.wire,
        pkg2Alpha * 0.5
      )
    }

    // Depth rings inside (showing we're deeper)
    for (let i = 0; i < 2; i++) {
      const depthRingRadius = outerRadius - 3 - i * 3
      const depthAlpha = (0.2 - i * 0.08) * innerAlpha
      this.ctx.beginPath()
      this.ctx.arc(x, y, depthRingRadius, 0, Math.PI * 2)
      this.ctx.strokeStyle = hexToCSS(TIER3_COLOR, depthAlpha)
      this.ctx.lineWidth = 1
      this.ctx.stroke()
    }
  }

  /**
   * Draw golden package with sparkle effect
   */
  private drawGoldenPackage(
    x: number,
    y: number,
    radius: number,
    spawnT: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const scale = this.easeInOut(Math.min(1, spawnT * 1.5))
    const glowPulse = Math.sin(spawnT * Math.PI * 4) * 0.3 + 0.7

    // Golden glow
    const glowRadius = radius + 4 + glowPulse * 2
    this.ctx.beginPath()
    this.ctx.arc(x, y, glowRadius * scale, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(GOLDEN_COLOR, 0.3 * alpha * scale)
    this.ctx.fill()

    // Golden node
    this.ctx.beginPath()
    this.ctx.arc(x, y, radius * scale, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(0x3a2a1a, 0.8 * alpha * scale)
    this.ctx.fill()
    this.ctx.strokeStyle = hexToCSS(GOLDEN_COLOR, alpha * scale)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Sparkles
    if (spawnT > 0.2) {
      const sparkleAlpha = Math.sin(((spawnT - 0.2) * Math.PI) / 0.8) * alpha
      this.drawSparkles(x, y, radius + 6, sparkleAlpha)
    }
  }

  /**
   * Draw sparkle effects
   */
  private drawSparkles(
    x: number,
    y: number,
    radius: number,
    alpha: number
  ): void {
    if (!this.ctx || alpha <= 0) return

    const sparkles = [
      { angle: -0.5, dist: 1.0 },
      { angle: 0.8, dist: 0.8 },
      { angle: 2.2, dist: 0.9 },
      { angle: 3.5, dist: 1.1 },
    ]

    for (const s of sparkles) {
      const sx = x + Math.cos(s.angle) * radius * s.dist
      const sy = y + Math.sin(s.angle) * radius * s.dist
      const size = 2

      this.ctx.beginPath()
      this.ctx.moveTo(sx - size, sy)
      this.ctx.lineTo(sx + size, sy)
      this.ctx.moveTo(sx, sy - size)
      this.ctx.lineTo(sx, sy + size)
      this.ctx.strokeStyle = hexToCSS(GOLDEN_COLOR, alpha * 0.8)
      this.ctx.lineWidth = 1.5
      this.ctx.stroke()
    }
  }

  /**
   * Draw depth indicator (dots showing current depth level)
   */
  private drawDepthIndicator(
    x: number,
    y: number,
    depth: number,
    transitionT: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const dotRadius = 2.5
    const dotSpacing = 8
    const totalWidth = (depth - 1) * dotSpacing
    const startX = x - totalWidth / 2

    for (let i = 0; i < depth; i++) {
      const dotX = startX + i * dotSpacing
      let dotAlpha = alpha

      // Last dot fades in during transition
      if (i === depth - 1) {
        dotAlpha = transitionT * alpha
      }

      this.ctx.beginPath()
      this.ctx.arc(dotX, y, dotRadius, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(TIER3_COLOR, dotAlpha * 0.9)
      this.ctx.fill()

      // Glow on newest dot
      if (i === depth - 1 && transitionT > 0.5) {
        this.ctx.beginPath()
        this.ctx.arc(dotX, y, dotRadius + 2, 0, Math.PI * 2)
        this.ctx.strokeStyle = hexToCSS(
          TIER3_COLOR,
          (transitionT - 0.5) * 2 * alpha * 0.5
        )
        this.ctx.lineWidth = 1
        this.ctx.stroke()
      }
    }
  }
}
