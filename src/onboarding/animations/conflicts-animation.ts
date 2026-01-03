// Conflicts Animation
// Demonstrates: Root node with conflict package connected via red wire → click wire → X appears → click X → resolved
// Loop: ~4 seconds

import {
  BaseAnimation,
  TeachingColors,
  hexToCSS,
  ANIMATION_WIDTH,
  ANIMATION_HEIGHT,
} from './base-animation'
import { Colors } from '../../rendering/colors'

export class ConflictsAnimation extends BaseAnimation {
  protected loopDuration = 4000 // 4 second loop

  // Node positions (relative to center)
  private readonly rootPos = { x: -30, y: 0 } // Root node (left)
  private readonly conflictPos = { x: 45, y: 0 } // Conflict package (right)

  // Animation phases
  private static readonly PHASES = {
    show: { start: 0, end: 0.12 }, // Show conflict setup
    cursorToNode: { start: 0.12, end: 0.25 }, // Cursor moves to root node
    clickNode: { start: 0.25, end: 0.35 }, // Click node, X button appears on wire
    cursorToX: { start: 0.35, end: 0.48 }, // Cursor moves to X button
    clickX: { start: 0.48, end: 0.58 }, // Click X
    resolve: { start: 0.58, end: 0.75 }, // Conflict fades away
    hold: { start: 0.75, end: 0.92 }, // Hold resolved state
    reset: { start: 0.92, end: 1.0 }, // Fade out
  }

  protected setup(): void {}

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = ConflictsAnimation.PHASES

    // Global alpha for reset fade
    let alpha = 1
    if (progress >= phases.reset.start) {
      alpha = 1 - this.getPhaseProgress(progress, phases.reset)
    }

    // Wire midpoint (for X button placement)
    const wireMid = {
      x: (this.rootPos.x + this.conflictPos.x) / 2,
      y: (this.rootPos.y + this.conflictPos.y) / 2,
    }

    // X button visible after clicking node, until resolve
    const showXButton =
      progress >= phases.clickNode.end && progress < phases.resolve.start

    // Conflict package fades during resolve
    const resolveT = this.getPhaseProgress(progress, phases.resolve)
    const conflictAlpha =
      progress < phases.resolve.start ? alpha : (1 - resolveT) * alpha

    // Draw wire (red crackling while conflict exists)
    if (conflictAlpha > 0) {
      this.drawConflictWire(progress, conflictAlpha)
    }

    // Badge turns green after resolve
    const badgeIsGreen = progress >= phases.resolve.start && resolveT > 0.3

    // Draw root node with badge (always visible)
    this.drawRootNode(alpha, badgeIsGreen, resolveT)

    // Draw conflict package (fades during resolve)
    if (conflictAlpha > 0) {
      this.drawConflictPackage(conflictAlpha, progress)
    }

    // Draw X button on wire
    if (showXButton) {
      const xPulse =
        1 + Math.sin((progress - phases.clickNode.end) * Math.PI * 10) * 0.1
      this.drawXButton(wireMid.x, wireMid.y, xPulse, alpha)
    }

    // Resolve burst effect
    if (progress >= phases.resolve.start && progress < phases.hold.start) {
      this.drawResolveEffect(wireMid.x, wireMid.y, resolveT)
    }

    // Resource hint: show bandwidth gain after resolve
    if (progress >= phases.resolve.start && progress < phases.reset.start) {
      const hintProgress =
        (progress - phases.resolve.start) /
        (phases.reset.start - phases.resolve.start)
      this.drawResourceHint(
        wireMid.x,
        wireMid.y - 30,
        '↑',
        TeachingColors.bandwidthGain,
        hintProgress
      )
    }

    // Cursor
    this.drawAnimatedCursor(progress, alpha, wireMid, showXButton)
  }

  private getPhaseProgress(
    progress: number,
    phase: { start: number; end: number }
  ): number {
    if (progress < phase.start) return 0
    if (progress >= phase.end) return 1
    return (progress - phase.start) / (phase.end - phase.start)
  }

  private drawRootNode(
    alpha: number,
    badgeIsGreen: boolean,
    resolveT: number
  ): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2 + this.rootPos.x
    const cy = ANIMATION_HEIGHT / 2 + this.rootPos.y
    const radius = 22

    // Node glow (green/ready)
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(Colors.borderReady, 0.15 * alpha)
    this.ctx.fill()

    // Node fill (green/ready)
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(Colors.nodeReady, 0.6 * alpha)
    this.ctx.fill()

    // Node border (green/ready)
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderReady, alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Badge at bottom of node (shows internal state)
    const badgeX = cx
    const badgeY = cy + radius + 8
    const badgeRadius = 8

    // Badge color: red when conflict exists, green when resolved
    const badgeColor = badgeIsGreen ? Colors.borderReady : Colors.borderConflict

    // Badge glow during transition
    if (resolveT > 0 && resolveT < 0.6) {
      const pulseAlpha = Math.sin(resolveT * Math.PI * 2) * 0.5
      this.ctx.beginPath()
      this.ctx.arc(badgeX, badgeY, badgeRadius + 4, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(badgeColor, pulseAlpha * alpha)
      this.ctx.fill()
    }

    // Badge background
    this.ctx.beginPath()
    this.ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(badgeColor, 0.9 * alpha)
    this.ctx.fill()

    // Badge icon
    if (badgeIsGreen) {
      // Checkmark for stable
      const checkSize = 4
      this.ctx.beginPath()
      this.ctx.moveTo(badgeX - checkSize, badgeY)
      this.ctx.lineTo(badgeX - checkSize * 0.2, badgeY + checkSize * 0.6)
      this.ctx.lineTo(badgeX + checkSize, badgeY - checkSize * 0.4)
      this.ctx.strokeStyle = hexToCSS(0x1a1428, alpha)
      this.ctx.lineWidth = 2
      this.ctx.lineCap = 'round'
      this.ctx.stroke()
      this.ctx.lineCap = 'butt'
    } else {
      // Down arrow for "has internal content" / unstable
      const arrowSize = 4
      this.ctx.beginPath()
      this.ctx.moveTo(badgeX, badgeY - arrowSize)
      this.ctx.lineTo(badgeX, badgeY + arrowSize * 0.5)
      this.ctx.moveTo(badgeX - arrowSize * 0.6, badgeY)
      this.ctx.lineTo(badgeX, badgeY + arrowSize * 0.5)
      this.ctx.lineTo(badgeX + arrowSize * 0.6, badgeY)
      this.ctx.strokeStyle = hexToCSS(0x1a1428, alpha)
      this.ctx.lineWidth = 2
      this.ctx.lineCap = 'round'
      this.ctx.stroke()
      this.ctx.lineCap = 'butt'
    }
  }

  private drawConflictPackage(alpha: number, progress: number): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2 + this.conflictPos.x
    const cy = ANIMATION_HEIGHT / 2 + this.conflictPos.y
    const radius = 16

    // Pulsing red glow
    const pulse = Math.sin(progress * Math.PI * 8) * 0.2 + 0.8

    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(Colors.borderConflict, 0.2 * alpha * pulse)
    this.ctx.fill()

    // Node fill (red)
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(Colors.nodeConflict, 0.6 * alpha)
    this.ctx.fill()

    // Node border (red)
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderConflict, alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()
  }

  private drawConflictWire(progress: number, alpha: number): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2
    const cy = ANIMATION_HEIGHT / 2

    const x1 = this.rootPos.x
    const y1 = this.rootPos.y
    const x2 = this.conflictPos.x
    const y2 = this.conflictPos.y

    // Crackling effect amplitude
    const crackle = Math.sin(progress * Math.PI * 20) * 3

    // Glow behind wire
    this.ctx.beginPath()
    this.ctx.moveTo(cx + x1, cy + y1)
    this.ctx.lineTo(cx + x2, cy + y2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderConflict, 0.25 * alpha)
    this.ctx.lineWidth = 8
    this.ctx.stroke()

    // Crackling wire path
    this.ctx.beginPath()
    this.ctx.moveTo(cx + x1, cy + y1)

    const steps = 6
    for (let i = 1; i < steps; i++) {
      const t = i / steps
      const x = this.lerp(x1, x2, t)
      const y = this.lerp(y1, y2, t)
      const offset = Math.sin(t * Math.PI * 3 + progress * 30) * crackle
      // Perpendicular offset
      const dx = x2 - x1
      const dy = y2 - y1
      const len = Math.sqrt(dx * dx + dy * dy)
      const nx = -dy / len
      const ny = dx / len
      this.ctx.lineTo(cx + x + nx * offset, cy + y + ny * offset)
    }

    this.ctx.lineTo(cx + x2, cy + y2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderConflict, 0.9 * alpha)
    this.ctx.lineWidth = 3
    this.ctx.stroke()
  }

  private drawXButton(
    x: number,
    y: number,
    scale: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2 + x
    const cy = ANIMATION_HEIGHT / 2 + y
    const size = 14 * scale

    // Button background (dark red)
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, size, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(0x4a2a2a, 0.95 * alpha)
    this.ctx.fill()

    // Button border (red, glowing)
    this.ctx.strokeStyle = hexToCSS(Colors.borderConflict, alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Glow effect
    this.ctx.shadowColor = hexToCSS(Colors.borderConflict, 0.6)
    this.ctx.shadowBlur = 8
    this.ctx.stroke()
    this.ctx.shadowBlur = 0

    // X icon
    const iconSize = 5 * scale
    this.ctx.beginPath()
    this.ctx.moveTo(cx - iconSize, cy - iconSize)
    this.ctx.lineTo(cx + iconSize, cy + iconSize)
    this.ctx.moveTo(cx + iconSize, cy - iconSize)
    this.ctx.lineTo(cx - iconSize, cy + iconSize)
    this.ctx.strokeStyle = hexToCSS(0xffffff, 0.9 * alpha)
    this.ctx.lineWidth = 2.5
    this.ctx.lineCap = 'round'
    this.ctx.stroke()
    this.ctx.lineCap = 'butt'
  }

  private drawResolveEffect(x: number, y: number, resolveT: number): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2 + x
    const cy = ANIMATION_HEIGHT / 2 + y
    const fadeAlpha = (1 - resolveT) * 0.7

    // Expanding green ring
    const radius = 10 + resolveT * 35
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderReady, fadeAlpha)
    this.ctx.lineWidth = 3
    this.ctx.stroke()

    // Inner ring
    const radius2 = 5 + resolveT * 25
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius2, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderReady, fadeAlpha * 0.6)
    this.ctx.lineWidth = 2
    this.ctx.stroke()
  }

  private drawAnimatedCursor(
    progress: number,
    _alpha: number,
    wireMid: { x: number; y: number },
    _showXButton: boolean
  ): void {
    const phases = ConflictsAnimation.PHASES

    // Don't show cursor during hold/reset
    if (progress >= phases.hold.start) return

    let cursorX: number
    let cursorY: number
    let clicking = false

    // Conflict node position for cursor targeting (click the red conflict node)
    const conflictX = this.conflictPos.x + 8
    const conflictY = this.conflictPos.y + 5

    if (progress < phases.cursorToNode.start) {
      // Before animation starts - cursor off screen
      return
    } else if (progress < phases.cursorToNode.end) {
      // Moving to conflict node
      const t = this.getPhaseProgress(progress, phases.cursorToNode)
      const eased = this.easeInOut(t)
      cursorX = this.lerp(70, conflictX, eased)
      cursorY = this.lerp(-45, conflictY, eased)
    } else if (progress < phases.clickNode.end) {
      // Clicking conflict node
      cursorX = conflictX
      cursorY = conflictY
      clicking = progress >= phases.clickNode.start
    } else if (progress < phases.cursorToX.end) {
      // Moving from conflict node to X button on wire
      const t = this.getPhaseProgress(progress, phases.cursorToX)
      const eased = this.easeInOut(t)
      cursorX = this.lerp(conflictX, wireMid.x + 8, eased)
      cursorY = this.lerp(conflictY, wireMid.y + 8, eased)
    } else if (progress < phases.clickX.end) {
      // Clicking X button
      cursorX = wireMid.x + 8
      cursorY = wireMid.y + 8
      clicking = true
    } else {
      // Move away after clicking X
      const t = this.getPhaseProgress(progress, phases.resolve)
      cursorX = wireMid.x + 8 + t * 35
      cursorY = wireMid.y + 8 - t * 30
    }

    this.drawCursor(cursorX, cursorY, clicking)

    // Click ripple on conflict node click
    if (progress >= phases.clickNode.start && progress < phases.clickNode.end) {
      const clickT = this.getPhaseProgress(progress, phases.clickNode)
      this.drawClickRipple(
        this.conflictPos.x,
        this.conflictPos.y,
        clickT,
        Colors.borderConflict
      )
    }

    // Click ripple on X button click
    if (progress >= phases.clickX.start && progress < phases.clickX.end) {
      const clickT = this.getPhaseProgress(progress, phases.clickX)
      this.drawClickRipple(wireMid.x, wireMid.y, clickT, Colors.borderReady)
    }
  }
}
