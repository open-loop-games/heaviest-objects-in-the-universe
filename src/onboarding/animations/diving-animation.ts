// Diving Animation
// Demonstrates: Top-level package with cyan badge (pristine) → click → zoom into scope with duplicates
// Shows: depth indicator (2→3), back button appears, duplicate pair with halos
// Loop: ~4 seconds

import {
  BaseAnimation,
  TeachingColors,
  hexToCSS,
  ANIMATION_WIDTH,
  ANIMATION_HEIGHT,
} from './base-animation'
import { Colors } from '../../rendering/colors'

// Badge colors matching nodes.ts
const BADGE_PRISTINE = 0x22d3ee // Cyan - "click to explore"
const BADGE_BACKGROUND = 0x1a1a2e // Dark badge background
const DEPTH_DOT_INACTIVE = 0x3a3a5a // Unfilled depth dot
const DEPTH_DOT_ACTIVE = 0x7a7aff // Filled depth dot (blue/purple)

export class DivingAnimation extends BaseAnimation {
  protected loopDuration = 4000 // 4 second loop

  // Animation phases
  private static readonly PHASES = {
    show: { start: 0, end: 0.15 }, // Show node with badge + depth at 2
    cursorToNode: { start: 0.15, end: 0.28 }, // Cursor moves to node
    clickNode: { start: 0.28, end: 0.36 }, // Click animation
    zoomIn: { start: 0.36, end: 0.52 }, // Zoom transition, depth 2→3
    showInner: { start: 0.52, end: 0.88 }, // Show inner scope with duplicates
    reset: { start: 0.88, end: 1.0 }, // Fade for loop
  }

  protected setup(): void {}

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = DivingAnimation.PHASES

    // Global alpha for reset fade
    let globalAlpha = 1
    if (progress >= phases.reset.start) {
      globalAlpha = 1 - this.getPhaseProgress(progress, phases.reset)
    }

    // Calculate zoom state
    const isZoomingIn =
      progress >= phases.zoomIn.start && progress < phases.zoomIn.end
    const isInsideScope = progress >= phases.zoomIn.end

    // Draw back button (always visible, like in the game)
    this.drawBackButton(globalAlpha)

    // Draw depth indicator (always visible, top-left area)
    // Animate from depth 2 to 3 during zoom
    const zoomT = isZoomingIn
      ? this.getPhaseProgress(progress, phases.zoomIn)
      : isInsideScope
        ? 1
        : 0
    this.drawDepthIndicator(globalAlpha, zoomT)

    // Draw outer node (visible before zoom completes)
    if (progress < phases.zoomIn.end) {
      let outerAlpha = globalAlpha
      if (isZoomingIn) {
        outerAlpha =
          (1 - this.getPhaseProgress(progress, phases.zoomIn)) * globalAlpha
      }
      this.drawOuterNode(outerAlpha)
    }

    // Draw inner scope (visible during and after zoom)
    if (progress >= phases.zoomIn.start && progress < phases.reset.start) {
      let innerAlpha = globalAlpha
      if (isZoomingIn) {
        innerAlpha =
          this.getPhaseProgress(progress, phases.zoomIn) * globalAlpha
      }
      this.drawInnerScope(innerAlpha, progress)
    }

    // Zoom effect (radial lines during transition)
    if (isZoomingIn) {
      const effectT = this.getPhaseProgress(progress, phases.zoomIn)
      this.drawZoomEffect(effectT)
    }

    // Cursor animation (only before zoom)
    if (
      progress >= phases.cursorToNode.start &&
      progress < phases.zoomIn.start
    ) {
      this.drawAnimatedCursor(progress)
    }
  }

  private getPhaseProgress(
    progress: number,
    phase: { start: number; end: number }
  ): number {
    if (progress < phase.start) return 0
    if (progress >= phase.end) return 1
    return (progress - phase.start) / (phase.end - phase.start)
  }

  /**
   * Draw compact back button with integrated depth dots
   * Only shows 4 pips (enough for depth 2→3 demo)
   */
  private drawBackButton(alpha: number): void {
    if (!this.ctx || alpha <= 0) return

    // Compact button in top-left
    const btnX = 10
    const btnY = 10
    const btnWidth = 48
    const btnHeight = 20
    const btnRadius = 6

    // Button background
    this.ctx.beginPath()
    this.roundRect(btnX, btnY, btnWidth, btnHeight, btnRadius)
    this.ctx.fillStyle = hexToCSS(0x1e1e32, 0.85 * alpha)
    this.ctx.fill()

    // Button border (subtle)
    this.ctx.strokeStyle = hexToCSS(0x4a4a6a, 0.5 * alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.stroke()

    // Back arrow (←) - compact
    const arrowX = btnX + 12
    const arrowY = btnY + btnHeight / 2
    const arrowSize = 4
    this.ctx.beginPath()
    this.ctx.moveTo(arrowX + arrowSize * 0.5, arrowY - arrowSize * 0.6)
    this.ctx.lineTo(arrowX - arrowSize * 0.2, arrowY)
    this.ctx.lineTo(arrowX + arrowSize * 0.5, arrowY + arrowSize * 0.6)
    this.ctx.strokeStyle = hexToCSS(0xaaaacc, alpha * 0.8)
    this.ctx.lineWidth = 2
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    this.ctx.stroke()
    this.ctx.lineCap = 'butt'
    this.ctx.lineJoin = 'miter'
  }

  /**
   * Draw depth indicator dots inside back button area
   * Shows 2 dots, animates from depth 1 to 2
   */
  private drawDepthIndicator(alpha: number, zoomT: number): void {
    if (!this.ctx || alpha <= 0) return

    // Position inside button, with spacing after arrow
    const startX = 35
    const y = 20
    const dotGap = 5
    const dotRadius = 3

    // 2 dots: depth 1 (filled) → depth 2 (fills during zoom)
    for (let i = 0; i < 2; i++) {
      const x = startX + i * (dotRadius * 2 + dotGap)

      // Dot 0 always filled, dot 1 animates
      const isFilled = i === 0 || zoomT > 0
      const fillAmount = i === 0 ? 1 : zoomT
      const isDeepest = (i === 0 && zoomT === 0) || (i === 1 && zoomT > 0)

      // Subtle glow for deepest
      if (isDeepest && isFilled) {
        this.ctx.beginPath()
        this.ctx.arc(x, y, dotRadius + 2, 0, Math.PI * 2)
        this.ctx.fillStyle = hexToCSS(
          DEPTH_DOT_ACTIVE,
          0.25 * alpha * fillAmount
        )
        this.ctx.fill()
      }

      // Dot fill
      this.ctx.beginPath()
      this.ctx.arc(x, y, dotRadius, 0, Math.PI * 2)
      if (isFilled) {
        this.ctx.fillStyle = hexToCSS(
          DEPTH_DOT_ACTIVE,
          (0.6 + 0.3 * fillAmount) * alpha
        )
      } else {
        this.ctx.fillStyle = hexToCSS(DEPTH_DOT_INACTIVE, 0.35 * alpha)
      }
      this.ctx.fill()

      // Dot border
      this.ctx.beginPath()
      this.ctx.arc(x, y, dotRadius, 0, Math.PI * 2)
      this.ctx.strokeStyle = hexToCSS(
        isFilled ? 0x9a9aff : 0x4a4a6a,
        alpha * (isFilled ? 0.7 : 0.4)
      )
      this.ctx.lineWidth = 1
      this.ctx.stroke()
    }
  }

  private roundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    if (!this.ctx) return
    this.ctx.moveTo(x + r, y)
    this.ctx.lineTo(x + w - r, y)
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    this.ctx.lineTo(x + w, y + h - r)
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    this.ctx.lineTo(x + r, y + h)
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    this.ctx.lineTo(x, y + r)
    this.ctx.quadraticCurveTo(x, y, x + r, y)
  }

  private drawOuterNode(alpha: number): void {
    if (!this.ctx || alpha <= 0) return

    const cx = ANIMATION_WIDTH / 2
    const cy = ANIMATION_HEIGHT / 2 + 10
    const radius = 22

    // Cyan glow indicates "has internal scope, click to explore"
    const time = Date.now() * 0.003
    const pulse = (Math.sin(time) + 1) / 2
    const glowRadius = radius + 6 + pulse * 4
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(BADGE_PRISTINE, (0.15 + 0.2 * pulse) * alpha)
    this.ctx.fill()

    // Node fill (GREEN - ready state)
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(Colors.nodeReady, 0.6 * alpha)
    this.ctx.fill()

    // Node border (GREEN - ready state)
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderReady, alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Cyan dashed portal ring (indicates internal scope)
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderOptimized, 0.5 * alpha)
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([4, 4])
    this.ctx.stroke()
    this.ctx.setLineDash([])

    // Badge at bottom (pristine = cyan with down arrow)
    this.drawPristineBadge(cx, cy + radius + 6, alpha, pulse)
  }

  private drawPristineBadge(
    x: number,
    y: number,
    alpha: number,
    pulse: number
  ): void {
    if (!this.ctx) return

    const badgeRadius = 8

    // Badge glow
    this.ctx.beginPath()
    this.ctx.arc(x, y, badgeRadius + 3, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(BADGE_PRISTINE, (0.3 + pulse * 0.2) * alpha)
    this.ctx.fill()

    // Badge background
    this.ctx.beginPath()
    this.ctx.arc(x, y, badgeRadius, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(BADGE_BACKGROUND, 0.95 * alpha)
    this.ctx.fill()

    // Badge border (cyan)
    this.ctx.strokeStyle = hexToCSS(BADGE_PRISTINE, 0.9 * alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Down arrow inside badge
    const arrowSize = 4
    this.ctx.beginPath()
    // Arrow stem
    this.ctx.moveTo(x, y - arrowSize + 1)
    this.ctx.lineTo(x, y + arrowSize - 2)
    this.ctx.strokeStyle = hexToCSS(BADGE_PRISTINE, alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Arrow head (chevron pointing down)
    this.ctx.beginPath()
    this.ctx.moveTo(x - arrowSize + 1, y + 1)
    this.ctx.lineTo(x, y + arrowSize)
    this.ctx.lineTo(x + arrowSize - 1, y + 1)
    this.ctx.strokeStyle = hexToCSS(BADGE_PRISTINE, alpha)
    this.ctx.lineWidth = 2
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    this.ctx.stroke()
    this.ctx.lineCap = 'butt'
    this.ctx.lineJoin = 'miter'
  }

  private drawInnerScope(alpha: number, progress: number): void {
    if (!this.ctx || alpha <= 0) return

    const cx = ANIMATION_WIDTH / 2
    const cy = ANIMATION_HEIGHT / 2 + 10

    // Inner nodes - includes a duplicate pair (nodes 1 and 2 are duplicates)
    const innerPositions = [
      { x: 0, y: -18, isDupe: false }, // Root dependency
      { x: -26, y: 10, isDupe: true }, // Duplicate A
      { x: 26, y: 10, isDupe: true }, // Duplicate B
      { x: 0, y: 26, isDupe: false }, // Normal node
    ]

    // Halo pulse for duplicates
    const haloPulse = Math.sin(progress * Math.PI * 6) * 0.3 + 0.7

    // Draw scope boundary (faint)
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, 45, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderOptimized, alpha * 0.15)
    this.ctx.lineWidth = 1
    this.ctx.stroke()

    // Draw wires from root to others
    const root = innerPositions[0]!
    for (let i = 1; i < innerPositions.length; i++) {
      const node = innerPositions[i]!
      this.ctx.beginPath()
      this.ctx.moveTo(cx + root.x, cy + root.y)
      this.ctx.lineTo(cx + node.x, cy + node.y)
      this.ctx.strokeStyle = hexToCSS(Colors.wireDefault, alpha * 0.5)
      this.ctx.lineWidth = 1.5
      this.ctx.stroke()
    }

    // Draw dashed line between duplicates (merge hint)
    const dupeA = innerPositions[1]!
    const dupeB = innerPositions[2]!
    this.ctx.beginPath()
    this.ctx.setLineDash([4, 4])
    this.ctx.moveTo(cx + dupeA.x, cy + dupeA.y)
    this.ctx.lineTo(cx + dupeB.x, cy + dupeB.y)
    this.ctx.strokeStyle = hexToCSS(
      TeachingColors.halo,
      alpha * haloPulse * 0.6
    )
    this.ctx.lineWidth = 2
    this.ctx.stroke()
    this.ctx.setLineDash([])

    // Draw nodes
    for (let i = 0; i < innerPositions.length; i++) {
      const node = innerPositions[i]!
      const x = cx + node.x
      const y = cy + node.y
      const radius = i === 0 ? 8 : 6

      // Halo ring for duplicates
      if (node.isDupe) {
        const haloRadius = radius + 4 + haloPulse * 3
        this.ctx.beginPath()
        this.ctx.arc(x, y, haloRadius, 0, Math.PI * 2)
        this.ctx.strokeStyle = hexToCSS(
          TeachingColors.halo,
          alpha * haloPulse * 0.5
        )
        this.ctx.lineWidth = 2
        this.ctx.stroke()
      }

      // Node fill
      this.ctx.beginPath()
      this.ctx.arc(x, y, radius - 1, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(Colors.nodeReady, 0.5 * alpha)
      this.ctx.fill()

      // Node border
      this.ctx.beginPath()
      this.ctx.arc(x, y, radius, 0, Math.PI * 2)
      this.ctx.strokeStyle = hexToCSS(Colors.borderReady, alpha)
      this.ctx.lineWidth = 1.5
      this.ctx.stroke()
    }
  }

  private drawZoomEffect(progress: number): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2
    const cy = ANIMATION_HEIGHT / 2 + 10

    // Radial lines for zoom transition
    const numLines = 10
    const alpha = Math.sin(progress * Math.PI) * 0.3
    if (alpha <= 0) return

    const innerRadius = 15 + progress * 25
    const outerRadius = 50 - progress * 15

    for (let i = 0; i < numLines; i++) {
      const angle = (i / numLines) * Math.PI * 2
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)

      this.ctx.beginPath()
      this.ctx.moveTo(cx + cos * innerRadius, cy + sin * innerRadius)
      this.ctx.lineTo(cx + cos * outerRadius, cy + sin * outerRadius)
      this.ctx.strokeStyle = hexToCSS(BADGE_PRISTINE, alpha)
      this.ctx.lineWidth = 2
      this.ctx.stroke()
    }
  }

  private drawAnimatedCursor(progress: number): void {
    const phases = DivingAnimation.PHASES

    let cursorX: number
    let cursorY: number
    let clicking = false

    const nodePos = { x: 0, y: 10 } // Center of outer node

    if (progress < phases.cursorToNode.end) {
      // Moving to outer node
      const t = this.getPhaseProgress(progress, phases.cursorToNode)
      const eased = this.easeInOut(t)
      cursorX = this.lerp(60, nodePos.x + 8, eased)
      cursorY = this.lerp(-40, nodePos.y + 5, eased)
    } else {
      // Clicking outer node
      cursorX = nodePos.x + 8
      cursorY = nodePos.y + 5
      clicking = progress >= phases.clickNode.start
    }

    this.drawCursor(cursorX, cursorY, clicking)

    // Click ripple
    if (progress >= phases.clickNode.start && progress < phases.clickNode.end) {
      const clickT = this.getPhaseProgress(progress, phases.clickNode)
      this.drawClickRipple(nodePos.x, nodePos.y, clickT, BADGE_PRISTINE)
    }
  }
}
