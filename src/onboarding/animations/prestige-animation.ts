// Prestige Animation
// Demonstrates: Singularity with orbiting nodes → click → nodes collapse → tokens fly out
// Loop: ~5 seconds

import {
  BaseAnimation,
  hexToCSS,
  ANIMATION_WIDTH,
  ANIMATION_HEIGHT,
} from './base-animation'
import { Colors } from '../../rendering/colors'

export class PrestigeAnimation extends BaseAnimation {
  protected loopDuration = 5000 // 5 second loop

  // Animation phases
  private static readonly PHASES = {
    orbit: { start: 0, end: 0.25 }, // Show orbiting nodes
    cursorMove: { start: 0.25, end: 0.35 }, // Cursor moves to singularity
    click: { start: 0.35, end: 0.45 }, // Click animation
    collapse: { start: 0.45, end: 0.6 }, // Nodes collapse inward
    burst: { start: 0.6, end: 0.75 }, // Tokens fly out
    hold: { start: 0.75, end: 0.9 }, // Show tokens
    reset: { start: 0.9, end: 1.0 }, // Fade out
  }

  // Orbiting node data
  private readonly orbitNodes = [
    { angle: 0, radius: 45, size: 8 },
    { angle: Math.PI * 0.5, radius: 40, size: 6 },
    { angle: Math.PI, radius: 50, size: 7 },
    { angle: Math.PI * 1.5, radius: 42, size: 5 },
    { angle: Math.PI * 0.25, radius: 38, size: 6 },
  ]

  protected setup(): void {}

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = PrestigeAnimation.PHASES

    let alpha = 1
    if (progress >= phases.reset.start) {
      alpha =
        1 -
        (progress - phases.reset.start) /
          (phases.reset.end - phases.reset.start)
    }

    // Rotation speed (orbiting effect)
    const baseRotation = progress * Math.PI * 2

    // Calculate collapse state
    let collapseT = 0
    if (progress >= phases.collapse.start && progress < phases.collapse.end) {
      collapseT =
        (progress - phases.collapse.start) /
        (phases.collapse.end - phases.collapse.start)
    } else if (progress >= phases.collapse.end) {
      collapseT = 1
    }

    // Draw collapse effect (behind everything)
    if (progress >= phases.collapse.start && progress < phases.burst.start) {
      const effectT =
        (progress - phases.collapse.start) /
        (phases.burst.start - phases.collapse.start)
      this.drawCollapseEffect(effectT)
    }

    // Draw orbiting/collapsing nodes
    if (progress < phases.burst.start) {
      this.drawOrbitingNodes(baseRotation, collapseT, alpha)
    }

    // Draw singularity (always visible)
    this.drawSingularity(progress, alpha, collapseT)

    // Draw tokens flying out
    if (progress >= phases.burst.start && progress < phases.reset.start) {
      const burstT =
        progress < phases.hold.start
          ? (progress - phases.burst.start) /
            (phases.hold.start - phases.burst.start)
          : 1
      this.drawTokens(burstT, alpha)
    }

    // Cursor
    if (progress >= phases.cursorMove.start && progress < phases.collapse.end) {
      let cursorX: number, cursorY: number
      let clicking = false

      if (progress < phases.cursorMove.end) {
        // Moving to singularity
        const t =
          (progress - phases.cursorMove.start) /
          (phases.cursorMove.end - phases.cursorMove.start)
        const eased = this.easeInOut(t)
        cursorX = this.lerp(55, 0, eased)
        cursorY = this.lerp(-45, 0, eased)
      } else if (progress < phases.click.end) {
        // Clicking
        cursorX = 0
        cursorY = 0
        clicking = progress >= phases.click.start
      } else {
        // After click, cursor moves away
        const fadeT =
          (progress - phases.click.end) /
          (phases.collapse.end - phases.click.end)
        cursorX = fadeT * 30
        cursorY = -fadeT * 25
      }

      if (progress < phases.collapse.start) {
        this.drawCursor(cursorX, cursorY, clicking)
      }
    }
  }

  private drawSingularity(
    progress: number,
    alpha: number,
    collapseT: number
  ): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2
    const cy = ANIMATION_HEIGHT / 2

    // Pulsing effect
    const pulse = Math.sin(progress * Math.PI * 6) * 0.15 + 1

    // Base size grows during collapse as it absorbs nodes
    const baseRadius = 15 + collapseT * 5
    const radius = baseRadius * pulse

    // Gravity warp effect (outer rings)
    for (let i = 3; i > 0; i--) {
      const warpRadius = radius + i * 8
      const warpAlpha = (0.15 - i * 0.03) * alpha
      this.ctx.beginPath()
      this.ctx.arc(cx, cy, warpRadius, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(Colors.gravityWarp, warpAlpha)
      this.ctx.fill()
    }

    // Singularity glow
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(Colors.cacheFragment, 0.3 * alpha)
    this.ctx.fill()

    // Main singularity (dark center)
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(0x1a0a2a, alpha)
    this.ctx.fill()
    this.ctx.strokeStyle = hexToCSS(Colors.cacheFragment, alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Swirl effect inside
    const swirlAngle = progress * Math.PI * 4
    for (let i = 0; i < 3; i++) {
      const angle = swirlAngle + (i * Math.PI * 2) / 3
      const swirlRadius = radius * 0.6
      const x = cx + Math.cos(angle) * swirlRadius * 0.5
      const y = cy + Math.sin(angle) * swirlRadius * 0.5
      this.ctx.beginPath()
      this.ctx.arc(x, y, 3, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(Colors.cacheFragment, 0.5 * alpha)
      this.ctx.fill()
    }
  }

  private drawOrbitingNodes(
    baseRotation: number,
    collapseT: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2
    const cy = ANIMATION_HEIGHT / 2
    const easedCollapse = this.easeInOut(collapseT)

    for (let i = 0; i < this.orbitNodes.length; i++) {
      const node = this.orbitNodes[i]!
      const angle = node.angle + baseRotation + i * 0.2

      // Collapse toward center
      const radius = node.radius * (1 - easedCollapse * 0.95)
      const size = node.size * (1 - easedCollapse * 0.5)

      const x = cx + Math.cos(angle) * radius
      const y = cy + Math.sin(angle) * radius * 0.6 // Elliptical orbit

      // Node glow
      this.ctx.beginPath()
      this.ctx.arc(x, y, size + 2, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(Colors.borderReady, 0.2 * alpha)
      this.ctx.fill()

      // Node fill
      this.ctx.beginPath()
      this.ctx.arc(x, y, size - 1, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(Colors.nodeReady, 0.6 * alpha)
      this.ctx.fill()

      // Node border
      this.ctx.beginPath()
      this.ctx.arc(x, y, size, 0, Math.PI * 2)
      this.ctx.strokeStyle = hexToCSS(Colors.borderReady, alpha)
      this.ctx.lineWidth = 1.5
      this.ctx.stroke()
    }
  }

  private drawCollapseEffect(progress: number): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2
    const cy = ANIMATION_HEIGHT / 2

    // Inward spiral lines
    const numLines = 8
    const alpha = 1 - progress

    for (let i = 0; i < numLines; i++) {
      const angle = (i / numLines) * Math.PI * 2 + progress * Math.PI
      const innerRadius = 5 + progress * 10
      const outerRadius = 35 - progress * 20

      const cos = Math.cos(angle)
      const sin = Math.sin(angle)

      this.ctx.beginPath()
      this.ctx.moveTo(cx + cos * innerRadius, cy + sin * innerRadius * 0.6)
      this.ctx.lineTo(cx + cos * outerRadius, cy + sin * outerRadius * 0.6)
      this.ctx.strokeStyle = hexToCSS(Colors.cacheFragment, alpha * 0.6)
      this.ctx.lineWidth = 2
      this.ctx.stroke()
    }
  }

  private drawTokens(progress: number, alpha: number): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2
    const cy = ANIMATION_HEIGHT / 2

    // Cache tokens flying outward
    const numTokens = 6
    const easedProgress = this.easeInOut(Math.min(progress * 1.5, 1))

    for (let i = 0; i < numTokens; i++) {
      const angle = (i / numTokens) * Math.PI * 2 + Math.PI / 6
      const distance = 15 + easedProgress * 40
      const tokenAlpha = alpha * (1 - progress * 0.3)

      const x = cx + Math.cos(angle) * distance
      const y = cy + Math.sin(angle) * distance * 0.7

      // Token glow
      this.ctx.beginPath()
      this.ctx.arc(x, y, 8, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(Colors.cacheFragment, 0.2 * tokenAlpha)
      this.ctx.fill()

      // Token body (diamond shape)
      const size = 5
      this.ctx.beginPath()
      this.ctx.moveTo(x, y - size)
      this.ctx.lineTo(x + size, y)
      this.ctx.lineTo(x, y + size)
      this.ctx.lineTo(x - size, y)
      this.ctx.closePath()
      this.ctx.fillStyle = hexToCSS(Colors.cacheFragment, 0.8 * tokenAlpha)
      this.ctx.fill()
      this.ctx.strokeStyle = hexToCSS(0xffffff, 0.5 * tokenAlpha)
      this.ctx.lineWidth = 1
      this.ctx.stroke()

      // Sparkle trail
      if (progress < 0.7) {
        const trailDist = distance * 0.6
        const trailX = cx + Math.cos(angle) * trailDist
        const trailY = cy + Math.sin(angle) * trailDist * 0.7
        this.ctx.beginPath()
        this.ctx.arc(trailX, trailY, 2, 0, Math.PI * 2)
        this.ctx.fillStyle = hexToCSS(
          Colors.cacheFragment,
          0.4 * tokenAlpha * (1 - progress)
        )
        this.ctx.fill()
      }
    }
  }
}
