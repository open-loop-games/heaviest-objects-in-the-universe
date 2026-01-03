// Diving Animation
// Demonstrates: Node with portal rings → click → zoom into internal scope → see inner nodes
// Loop: ~4 seconds

import {
  BaseAnimation,
  hexToCSS,
  ANIMATION_WIDTH,
  ANIMATION_HEIGHT,
} from './base-animation'
import { Colors } from '../../rendering/colors'

export class DivingAnimation extends BaseAnimation {
  protected loopDuration = 4000 // 4 second loop

  // Animation phases
  private static readonly PHASES = {
    showPortal: { start: 0, end: 0.2 }, // Show node with portal rings
    cursorMove: { start: 0.2, end: 0.35 }, // Cursor moves to node
    click: { start: 0.35, end: 0.45 }, // Click animation
    zoomIn: { start: 0.45, end: 0.65 }, // Zoom transition
    showInner: { start: 0.65, end: 0.85 }, // Show inner nodes
    reset: { start: 0.85, end: 1.0 }, // Zoom out / fade
  }

  protected setup(): void {}

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = DivingAnimation.PHASES

    // Calculate zoom level
    let zoom = 1
    let showOuter = true
    let showInner = false

    if (progress >= phases.zoomIn.start && progress < phases.zoomIn.end) {
      // Zooming in
      const zoomT =
        (progress - phases.zoomIn.start) /
        (phases.zoomIn.end - phases.zoomIn.start)
      zoom = 1 + this.easeInOut(zoomT) * 2 // Zoom to 3x
      showOuter = zoomT < 0.5
      showInner = zoomT > 0.3
    } else if (progress >= phases.zoomIn.end && progress < phases.reset.start) {
      // Fully zoomed in
      zoom = 3
      showOuter = false
      showInner = true
    } else if (progress >= phases.reset.start) {
      // Zooming out
      const resetT =
        (progress - phases.reset.start) /
        (phases.reset.end - phases.reset.start)
      zoom = 3 - this.easeInOut(resetT) * 2
      showOuter = resetT > 0.5
      showInner = resetT < 0.7
    }

    // Portal ring animation phase
    const portalPulse = (progress * 3) % 1

    // Draw outer node with portal
    if (showOuter) {
      const outerAlpha =
        progress >= phases.zoomIn.start && progress < phases.zoomIn.end
          ? 1 -
            ((progress - phases.zoomIn.start) /
              (phases.zoomIn.end - phases.zoomIn.start)) *
              2
          : progress >= phases.reset.start
            ? ((progress - phases.reset.start) /
                (phases.reset.end - phases.reset.start) -
                0.5) *
              2
            : 1
      const clampedAlpha = Math.max(0, Math.min(1, outerAlpha))

      this.drawOuterNode(clampedAlpha)
      this.drawPortalRings(portalPulse, clampedAlpha)
    }

    // Draw inner nodes (when zoomed in)
    if (showInner) {
      const innerAlpha =
        progress >= phases.zoomIn.start && progress < phases.zoomIn.end
          ? ((progress - phases.zoomIn.start) /
              (phases.zoomIn.end - phases.zoomIn.start) -
              0.3) /
            0.7
          : progress >= phases.reset.start
            ? 1 -
              (progress - phases.reset.start) /
                (phases.reset.end - phases.reset.start) /
                0.7
            : 1
      const clampedInnerAlpha = Math.max(0, Math.min(1, innerAlpha))

      this.drawInnerNodes(zoom, clampedInnerAlpha, progress)
    }

    // Zoom effect (radial lines during transition)
    if (progress >= phases.click.end && progress < phases.showInner.start) {
      const effectT =
        (progress - phases.click.end) /
        (phases.showInner.start - phases.click.end)
      this.drawZoomEffect(effectT)
    }

    // Cursor
    if (progress >= phases.cursorMove.start && progress < phases.zoomIn.start) {
      let cursorX: number, cursorY: number
      let clicking = false

      if (progress < phases.cursorMove.end) {
        // Moving to node
        const t =
          (progress - phases.cursorMove.start) /
          (phases.cursorMove.end - phases.cursorMove.start)
        const eased = this.easeInOut(t)
        cursorX = this.lerp(60, 0, eased)
        cursorY = this.lerp(-50, 0, eased)
      } else {
        // Clicking
        cursorX = 0
        cursorY = 0
        clicking = progress >= phases.click.start
      }

      this.drawCursor(cursorX, cursorY, clicking)
    }
  }

  private drawOuterNode(alpha: number): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2
    const cy = ANIMATION_HEIGHT / 2
    const radius = 25

    // Node glow
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(Colors.borderOptimized, 0.15 * alpha)
    this.ctx.fill()

    // Node fill
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(Colors.nodeOptimized, 0.5 * alpha)
    this.ctx.fill()

    // Node border
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderOptimized, alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Down arrow badge at bottom
    const badgeY = cy + radius + 8
    const badgeSize = 10

    // Badge background
    this.ctx.beginPath()
    this.ctx.arc(cx, badgeY, badgeSize, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(Colors.borderOptimized, 0.8 * alpha)
    this.ctx.fill()

    // Down arrow
    const arrowSize = 4
    this.ctx.beginPath()
    this.ctx.moveTo(cx, badgeY - arrowSize)
    this.ctx.lineTo(cx, badgeY + arrowSize)
    this.ctx.moveTo(cx - arrowSize, badgeY)
    this.ctx.lineTo(cx, badgeY + arrowSize)
    this.ctx.lineTo(cx + arrowSize, badgeY)
    this.ctx.strokeStyle = hexToCSS(0x1a1428, alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()
  }

  private drawPortalRings(pulse: number, alpha: number): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2
    const cy = ANIMATION_HEIGHT / 2
    const baseRadius = 15

    // Three concentric portal rings that pulse outward
    for (let i = 0; i < 3; i++) {
      const ringPhase = (pulse + i * 0.33) % 1
      const radius = baseRadius + ringPhase * 8
      const ringAlpha = (1 - ringPhase) * 0.5 * alpha

      this.ctx.beginPath()
      this.ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      this.ctx.strokeStyle = hexToCSS(Colors.borderOptimized, ringAlpha)
      this.ctx.lineWidth = 2
      this.ctx.stroke()
    }
  }

  private drawInnerNodes(zoom: number, alpha: number, progress: number): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2
    const cy = ANIMATION_HEIGHT / 2

    // Inner scope visualization - multiple smaller nodes
    const innerPositions = [
      { x: 0, y: -25 },
      { x: -30, y: 10 },
      { x: 30, y: 10 },
      { x: -15, y: 30 },
      { x: 15, y: 30 },
    ]

    // Scale positions based on zoom
    const scale = zoom / 3

    // Draw wires first
    for (let i = 1; i < innerPositions.length; i++) {
      const from = innerPositions[0]!
      const to = innerPositions[i]!
      this.ctx.beginPath()
      this.ctx.moveTo(cx + from.x * scale, cy + from.y * scale)
      this.ctx.lineTo(cx + to.x * scale, cy + to.y * scale)
      this.ctx.strokeStyle = hexToCSS(Colors.wireDefault, alpha * 0.6)
      this.ctx.lineWidth = 1.5
      this.ctx.stroke()
    }

    // Draw nodes
    for (let i = 0; i < innerPositions.length; i++) {
      const pos = innerPositions[i]!
      const radius = (i === 0 ? 10 : 7) * scale
      const x = cx + pos.x * scale
      const y = cy + pos.y * scale

      // Mini pulse animation for life
      const nodePulse = 1 + Math.sin(progress * Math.PI * 4 + i) * 0.05

      // Node fill
      this.ctx.beginPath()
      this.ctx.arc(x, y, (radius - 1) * nodePulse, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(Colors.nodeReady, 0.5 * alpha)
      this.ctx.fill()

      // Node border
      this.ctx.beginPath()
      this.ctx.arc(x, y, radius * nodePulse, 0, Math.PI * 2)
      this.ctx.strokeStyle = hexToCSS(Colors.borderReady, alpha)
      this.ctx.lineWidth = 1.5
      this.ctx.stroke()
    }

    // Scope boundary (faint circle showing we're inside)
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, 55 * scale, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderOptimized, alpha * 0.2)
    this.ctx.lineWidth = 1
    this.ctx.stroke()
  }

  private drawZoomEffect(progress: number): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2
    const cy = ANIMATION_HEIGHT / 2

    // Radial lines zooming inward
    const numLines = 12
    const innerRadius = 20 + progress * 30
    const outerRadius = 60 - progress * 20
    const alpha = (1 - progress) * 0.4

    for (let i = 0; i < numLines; i++) {
      const angle = (i / numLines) * Math.PI * 2
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)

      this.ctx.beginPath()
      this.ctx.moveTo(cx + cos * innerRadius, cy + sin * innerRadius)
      this.ctx.lineTo(cx + cos * outerRadius, cy + sin * outerRadius)
      this.ctx.strokeStyle = hexToCSS(Colors.borderOptimized, alpha)
      this.ctx.lineWidth = 2
      this.ctx.stroke()
    }
  }
}
