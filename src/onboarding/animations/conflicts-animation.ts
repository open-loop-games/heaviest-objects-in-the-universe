// Conflicts Animation
// Demonstrates: Red crackling wire → click wire → X button appears → click X → resolved
// Loop: ~4.5 seconds

import {
  BaseAnimation,
  TeachingColors,
  hexToCSS,
  ANIMATION_WIDTH,
  ANIMATION_HEIGHT,
} from './base-animation'
import { Colors } from '../../rendering/colors'

export class ConflictsAnimation extends BaseAnimation {
  protected loopDuration = 4500 // 4.5 second loop

  // Node positions
  private readonly nodeAPos = { x: -40, y: -20 }
  private readonly nodeBPos = { x: 40, y: 20 }

  // Animation phases
  private static readonly PHASES = {
    showConflict: { start: 0, end: 0.2 },
    cursorToWire: { start: 0.2, end: 0.35 },
    clickWire: { start: 0.35, end: 0.45 },
    cursorToX: { start: 0.45, end: 0.55 },
    clickX: { start: 0.55, end: 0.65 },
    resolve: { start: 0.65, end: 0.8 },
    hold: { start: 0.8, end: 0.92 },
    reset: { start: 0.92, end: 1.0 },
  }

  protected setup(): void {}

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = ConflictsAnimation.PHASES

    const isConflicted = progress < phases.clickX.end
    const isResolved = progress >= phases.resolve.start
    const showXButton =
      progress >= phases.clickWire.end && progress < phases.clickX.end

    let alpha = 1
    if (progress >= phases.reset.start) {
      alpha =
        1 -
        (progress - phases.reset.start) /
          (phases.reset.end - phases.reset.start)
    }

    const wireMid = {
      x: (this.nodeAPos.x + this.nodeBPos.x) / 2,
      y: (this.nodeAPos.y + this.nodeBPos.y) / 2,
    }

    // Draw wire
    if (isConflicted) {
      this.drawConflictWire(progress, alpha)
    } else if (isResolved) {
      this.drawResolvedWire(alpha)
    }

    // Draw nodes
    this.drawConflictNodeLocal(
      this.nodeAPos.x,
      this.nodeAPos.y,
      isConflicted,
      alpha
    )
    this.drawConflictNodeLocal(
      this.nodeBPos.x,
      this.nodeBPos.y,
      isConflicted,
      alpha
    )

    // Draw X button
    if (showXButton) {
      const xPulse =
        Math.sin((progress - phases.clickWire.end) * Math.PI * 8) * 0.1
      this.drawXButton(wireMid.x, wireMid.y - 20, 1 + xPulse)
    }

    // Resolution effect
    if (progress >= phases.resolve.start && progress < phases.hold.start) {
      const resolveT =
        (progress - phases.resolve.start) /
        (phases.hold.start - phases.resolve.start)
      this.drawResolveEffect(wireMid.x, wireMid.y, resolveT)
    }

    // Resource hint: show bandwidth gain after resolve
    if (progress >= phases.resolve.start && progress < phases.reset.start) {
      const hintProgress =
        (progress - phases.resolve.start) /
        (phases.reset.start - phases.resolve.start)
      this.drawResourceHint(
        wireMid.x,
        wireMid.y - 35,
        '↑',
        TeachingColors.bandwidthGain,
        hintProgress
      )
    }

    // Cursor
    if (
      progress >= phases.cursorToWire.start &&
      progress < phases.reset.start
    ) {
      let cursorX: number, cursorY: number
      let clicking = false

      if (progress < phases.cursorToWire.end) {
        const t =
          (progress - phases.cursorToWire.start) /
          (phases.cursorToWire.end - phases.cursorToWire.start)
        const eased = this.easeInOut(t)
        cursorX = this.lerp(60, wireMid.x, eased)
        cursorY = this.lerp(-40, wireMid.y, eased)
      } else if (progress < phases.clickWire.end) {
        cursorX = wireMid.x
        cursorY = wireMid.y
        clicking = progress >= phases.clickWire.start
      } else if (progress < phases.cursorToX.end) {
        const t =
          (progress - phases.clickWire.end) /
          (phases.cursorToX.end - phases.clickWire.end)
        const eased = this.easeInOut(t)
        cursorX = this.lerp(wireMid.x, wireMid.x, eased)
        cursorY = this.lerp(wireMid.y, wireMid.y - 20, eased)
      } else if (progress < phases.clickX.end) {
        cursorX = wireMid.x
        cursorY = wireMid.y - 20
        clicking = true
      } else {
        const fadeT =
          (progress - phases.clickX.end) /
          (phases.reset.start - phases.clickX.end)
        cursorX = wireMid.x + fadeT * 40
        cursorY = wireMid.y - 20 - fadeT * 30
      }

      if (progress < phases.hold.end) {
        this.drawCursor(cursorX, cursorY, clicking)
      }
    }
  }

  private drawConflictWire(progress: number, alpha: number): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2
    const cy = ANIMATION_HEIGHT / 2
    const crackle = Math.sin(progress * Math.PI * 20) * 2

    // Glow effect
    this.ctx.beginPath()
    this.ctx.moveTo(cx + this.nodeAPos.x, cy + this.nodeAPos.y)
    this.ctx.lineTo(cx + this.nodeBPos.x, cy + this.nodeBPos.y)
    this.ctx.strokeStyle = hexToCSS(Colors.borderConflict, alpha * 0.2)
    this.ctx.lineWidth = 6
    this.ctx.stroke()

    // Crackling wire
    this.ctx.beginPath()
    this.ctx.moveTo(cx + this.nodeAPos.x, cy + this.nodeAPos.y)

    const steps = 8
    for (let i = 1; i < steps; i++) {
      const t = i / steps
      const x = this.lerp(this.nodeAPos.x, this.nodeBPos.x, t)
      const y = this.lerp(this.nodeAPos.y, this.nodeBPos.y, t)
      const offset = Math.sin(t * Math.PI * 4 + progress * 30) * crackle
      const dx = this.nodeBPos.x - this.nodeAPos.x
      const dy = this.nodeBPos.y - this.nodeAPos.y
      const len = Math.sqrt(dx * dx + dy * dy)
      const nx = -dy / len
      const ny = dx / len
      this.ctx.lineTo(cx + x + nx * offset, cy + y + ny * offset)
    }

    this.ctx.lineTo(cx + this.nodeBPos.x, cy + this.nodeBPos.y)
    this.ctx.strokeStyle = hexToCSS(Colors.borderConflict, alpha * 0.9)
    this.ctx.lineWidth = 3
    this.ctx.stroke()
  }

  private drawResolvedWire(alpha: number): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2
    const cy = ANIMATION_HEIGHT / 2

    this.ctx.beginPath()
    this.ctx.moveTo(cx + this.nodeAPos.x, cy + this.nodeAPos.y)
    this.ctx.lineTo(cx + this.nodeBPos.x, cy + this.nodeBPos.y)
    this.ctx.strokeStyle = hexToCSS(Colors.wireDefault, alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()
  }

  private drawConflictNodeLocal(
    x: number,
    y: number,
    conflicted: boolean,
    alpha: number
  ): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2 + x
    const cy = ANIMATION_HEIGHT / 2 + y
    const radius = 14
    const borderColor = conflicted ? Colors.borderConflict : Colors.borderReady
    const fillColor = conflicted ? Colors.nodeConflict : Colors.nodeReady

    // Glow for conflict
    if (conflicted) {
      this.ctx.beginPath()
      this.ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(Colors.borderConflict, 0.2 * alpha)
      this.ctx.fill()
    }

    // Node fill
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(fillColor, 0.6 * alpha)
    this.ctx.fill()

    // Node border
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(borderColor, alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()
  }

  private drawXButton(x: number, y: number, scale: number): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2 + x
    const cy = ANIMATION_HEIGHT / 2 + y
    const size = 12 * scale

    // Button background
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, size, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(0x4a2a2a, 0.9)
    this.ctx.fill()
    this.ctx.strokeStyle = hexToCSS(Colors.borderConflict, 1)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // X icon
    const iconSize = 5 * scale
    this.ctx.beginPath()
    this.ctx.moveTo(cx - iconSize, cy - iconSize)
    this.ctx.lineTo(cx + iconSize, cy + iconSize)
    this.ctx.moveTo(cx + iconSize, cy - iconSize)
    this.ctx.lineTo(cx - iconSize, cy + iconSize)
    this.ctx.strokeStyle = hexToCSS(Colors.borderConflict, 1)
    this.ctx.lineWidth = 2.5
    this.ctx.stroke()
  }

  private drawResolveEffect(x: number, y: number, progress: number): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2 + x
    const cy = ANIMATION_HEIGHT / 2 + y
    const fadeAlpha = 1 - progress

    // Expanding ring
    const radius = 15 + progress * 35
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderReady, fadeAlpha * 0.6)
    this.ctx.lineWidth = 3
    this.ctx.stroke()

    // Checkmark
    if (progress < 0.5) {
      const checkAlpha = 1 - progress * 2
      const checkSize = 10
      this.ctx.beginPath()
      this.ctx.moveTo(cx - checkSize, cy)
      this.ctx.lineTo(cx - checkSize * 0.3, cy + checkSize * 0.6)
      this.ctx.lineTo(cx + checkSize, cy - checkSize * 0.5)
      this.ctx.strokeStyle = hexToCSS(Colors.borderReady, checkAlpha)
      this.ctx.lineWidth = 3
      this.ctx.stroke()
    }
  }
}
