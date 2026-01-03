// Install Animation
// Demonstrates: Click root → package spawns
// Loop: ~3 seconds

import {
  BaseAnimation,
  TeachingColors,
  hexToCSS,
  ANIMATION_WIDTH,
  ANIMATION_HEIGHT,
} from './base-animation'
import { Colors } from '../../rendering/colors'

export class InstallAnimation extends BaseAnimation {
  protected loopDuration = 3000 // 3 second loop

  // Animation phases (as fractions of loop duration)
  private static readonly PHASES = {
    cursorMove: { start: 0, end: 0.25 }, // Cursor moves to root
    click: { start: 0.25, end: 0.35 }, // Click animation
    spawn: { start: 0.35, end: 0.5 }, // Package spawns
    settle: { start: 0.5, end: 0.7 }, // Package settles into place
    hold: { start: 0.7, end: 0.9 }, // Hold state
    reset: { start: 0.9, end: 1.0 }, // Fade out for loop
  }

  protected setup(): void {
    // Initial draw handled by update
  }

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = InstallAnimation.PHASES

    // Root node (always visible, pulses during cursor approach)
    const rootPulse =
      progress < phases.click.end
        ? 1 + Math.sin(progress * Math.PI * 8) * 0.05
        : 1
    this.drawRoot(rootPulse)

    // Spawned package
    if (progress >= phases.spawn.start && progress < phases.reset.end) {
      const spawnPos = { x: 50, y: 30 } // Spawn position (relative to center)

      if (progress < phases.spawn.end) {
        // Spawning - grow from center
        const t =
          (progress - phases.spawn.start) /
          (phases.spawn.end - phases.spawn.start)
        const eased = this.easeInOut(t)

        // Start from root, move to spawn position
        const x = this.lerp(0, spawnPos.x, eased)
        const y = this.lerp(0, spawnPos.y, eased)
        const scale = eased

        // Wire first (behind nodes)
        this.drawWire(0, 0, x, y, Colors.wireDefault, 2, eased)
        this.drawSpawnedPackage(x, y, scale)

        // Ripple effect during spawn
        if (t < 0.5) {
          this.drawClickRipple(0, 0, t * 2, Colors.borderInstalling)
        }
      } else if (progress < phases.reset.start) {
        // Settled
        this.drawWire(0, 0, spawnPos.x, spawnPos.y, Colors.wireDefault)
        this.drawSpawnedPackage(spawnPos.x, spawnPos.y, 1)
      } else {
        // Fading out for loop
        const fadeT =
          (progress - phases.reset.start) /
          (phases.reset.end - phases.reset.start)
        const alpha = 1 - fadeT
        this.drawWire(
          0,
          0,
          spawnPos.x,
          spawnPos.y,
          Colors.wireDefault,
          2,
          alpha
        )
        this.drawSpawnedPackage(spawnPos.x, spawnPos.y, 1, alpha)
      }
    }

    // Resource hint: show bandwidth cost after click
    if (progress >= phases.spawn.start && progress < phases.settle.end) {
      const hintProgress =
        (progress - phases.spawn.start) /
        (phases.settle.end - phases.spawn.start)
      this.drawResourceHint(
        0,
        -30,
        '↓',
        TeachingColors.bandwidthCost,
        hintProgress
      )
    }

    // Cursor movement (drawn last, on top)
    if (progress < phases.reset.start) {
      const cursorStart = { x: 60, y: -50 } // Start from top-right
      const cursorEnd = { x: 0, y: 0 } // Move to root center

      let cursorX: number, cursorY: number
      let clicking = false

      if (progress < phases.cursorMove.end) {
        // Moving to root
        const t = this.easeInOut(progress / phases.cursorMove.end)
        cursorX = this.lerp(cursorStart.x, cursorEnd.x, t)
        cursorY = this.lerp(cursorStart.y, cursorEnd.y, t)
      } else if (progress < phases.click.end) {
        // Clicking
        cursorX = cursorEnd.x
        cursorY = cursorEnd.y
        clicking = true
      } else {
        // After click, cursor fades out by moving away
        const fadeProgress =
          (progress - phases.click.end) /
          (phases.reset.start - phases.click.end)
        cursorX = cursorEnd.x + fadeProgress * 40
        cursorY = cursorEnd.y - fadeProgress * 30
      }

      // Only show cursor before hold end
      if (progress < phases.hold.end) {
        this.drawCursor(cursorX, cursorY, clicking)
      }
    }
  }

  private drawRoot(pulse: number): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2
    const cy = ANIMATION_HEIGHT / 2
    const radius = 20 * pulse

    // Outer golden ring (root anchor indicator)
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(0xffd700, 0.6)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Inner warm glow
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(0xffa500, 0.15)
    this.ctx.fill()

    // Main circle fill (green/ready)
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(Colors.nodeReady, 0.6)
    this.ctx.fill()

    // Main circle border (green/ready, thicker for root)
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderReady, 1)
    this.ctx.lineWidth = 3
    this.ctx.stroke()

    // Center icon (package box)
    const boxW = 12
    const boxH = 8
    this.ctx.fillStyle = hexToCSS(Colors.borderReady, 0.8)
    this.ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH)
    this.ctx.strokeStyle = hexToCSS(Colors.borderReady, 1)
    this.ctx.lineWidth = 1.5
    this.ctx.strokeRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH)
  }

  private drawSpawnedPackage(
    x: number,
    y: number,
    scale: number,
    alpha: number = 1
  ): void {
    if (!this.ctx || scale <= 0) return

    const cx = ANIMATION_WIDTH / 2 + x
    const cy = ANIMATION_HEIGHT / 2 + y
    const radius = 15 * scale

    // Glow
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(Colors.borderReady, 0.15 * alpha)
    this.ctx.fill()

    // Main circle fill (ensure radius is positive)
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, Math.max(1, radius - 2), 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(Colors.nodeReady, 0.6 * alpha)
    this.ctx.fill()

    // Main circle border (green)
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderReady, alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Cyan dashed portal ring (indicates internal scope)
    if (scale > 0.5) {
      this.ctx.beginPath()
      this.ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2)
      this.ctx.strokeStyle = hexToCSS(Colors.borderOptimized, 0.5 * alpha)
      this.ctx.lineWidth = 2
      this.ctx.setLineDash([4, 4])
      this.ctx.stroke()
      this.ctx.setLineDash([])

      // Cyan dive badge (down arrow)
      this.drawDiveBadge(cx, cy, radius, alpha)
    }
  }

  /**
   * Draw cyan dive badge (arrow down) below a node
   */
  private drawDiveBadge(
    x: number,
    y: number,
    nodeRadius: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const badgeRadius = 6
    const badgeY = y + nodeRadius + 8

    // Cyan circle
    this.ctx.beginPath()
    this.ctx.arc(x, badgeY, badgeRadius, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(0x22d3ee, 0.9 * alpha)
    this.ctx.fill()

    // Down arrow
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`
    this.ctx.lineWidth = 1.5
    this.ctx.beginPath()
    this.ctx.moveTo(x, badgeY - 3)
    this.ctx.lineTo(x, badgeY + 2)
    this.ctx.moveTo(x - 2.5, badgeY)
    this.ctx.lineTo(x, badgeY + 3)
    this.ctx.lineTo(x + 2.5, badgeY)
    this.ctx.stroke()
  }
}
