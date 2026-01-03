// Duplicates Animation
// Demonstrates: Two matching nodes with halos → drag one → merge into symlink
// Loop: ~4 seconds

import {
  BaseAnimation,
  TeachingColors,
  hexToCSS,
  ANIMATION_WIDTH,
  ANIMATION_HEIGHT,
} from './base-animation'
import { Colors } from '../../rendering/colors'

export class DuplicatesAnimation extends BaseAnimation {
  protected loopDuration = 4000 // 4 second loop

  // Node positions
  private readonly nodeAStart = { x: -45, y: -15 }
  private readonly nodeBPos = { x: 45, y: 15 }

  // Animation phases
  private static readonly PHASES = {
    show: { start: 0, end: 0.15 },
    cursorMove: { start: 0.15, end: 0.3 },
    drag: { start: 0.3, end: 0.6 },
    merge: { start: 0.6, end: 0.75 },
    hold: { start: 0.75, end: 0.9 },
    reset: { start: 0.9, end: 1.0 },
  }

  protected setup(): void {}

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = DuplicatesAnimation.PHASES

    // Calculate node A position (moves during drag)
    let nodeAPos = { ...this.nodeAStart }
    let merged = false
    let alpha = 1

    if (progress >= phases.drag.start && progress < phases.merge.start) {
      const dragT =
        (progress - phases.drag.start) /
        (phases.merge.start - phases.drag.start)
      const eased = this.easeInOut(dragT)
      nodeAPos.x = this.lerp(this.nodeAStart.x, this.nodeBPos.x, eased)
      nodeAPos.y = this.lerp(this.nodeAStart.y, this.nodeBPos.y, eased)
    } else if (progress >= phases.merge.start) {
      nodeAPos = { ...this.nodeBPos }
      merged = true
    }

    if (progress >= phases.reset.start) {
      alpha =
        1 -
        (progress - phases.reset.start) /
          (phases.reset.end - phases.reset.start)
    }

    // Halo pulse phase
    const haloPulse = Math.sin(progress * Math.PI * 6) * 0.5 + 0.5

    // Draw connection line (before merge)
    if (!merged && progress < phases.reset.start) {
      this.drawConnectionLine(nodeAPos, this.nodeBPos, haloPulse, alpha)
    }

    // Draw halos
    if (!merged) {
      this.drawHaloRing(nodeAPos.x, nodeAPos.y, haloPulse, alpha)
      this.drawHaloRing(this.nodeBPos.x, this.nodeBPos.y, haloPulse, alpha)
    }

    // Draw nodes
    if (!merged) {
      this.drawDuplicateNode(nodeAPos.x, nodeAPos.y, alpha)
      this.drawDuplicateNode(this.nodeBPos.x, this.nodeBPos.y, alpha)
    } else {
      this.drawMergedNode(this.nodeBPos.x, this.nodeBPos.y, alpha)

      // Merge burst effect
      if (progress < phases.hold.start) {
        const mergeT =
          (progress - phases.merge.start) /
          (phases.hold.start - phases.merge.start)
        this.drawMergeEffect(this.nodeBPos.x, this.nodeBPos.y, mergeT)
      }
    }

    // Resource hint: show bandwidth gain after merge
    if (progress >= phases.merge.start && progress < phases.reset.start) {
      const hintProgress =
        (progress - phases.merge.start) /
        (phases.reset.start - phases.merge.start)
      this.drawResourceHint(
        this.nodeBPos.x,
        this.nodeBPos.y - 25,
        '↑',
        TeachingColors.bandwidthGain,
        hintProgress
      )
    }

    // Cursor
    if (progress >= phases.cursorMove.start && progress < phases.reset.start) {
      let cursorX: number, cursorY: number
      let clicking = false

      if (progress < phases.cursorMove.end) {
        const t =
          (progress - phases.cursorMove.start) /
          (phases.cursorMove.end - phases.cursorMove.start)
        const eased = this.easeInOut(t)
        cursorX = this.lerp(60, nodeAPos.x, eased)
        cursorY = this.lerp(-40, nodeAPos.y, eased)
      } else if (progress < phases.drag.start) {
        cursorX = nodeAPos.x
        cursorY = nodeAPos.y
        clicking = true
      } else if (progress < phases.merge.start) {
        cursorX = nodeAPos.x
        cursorY = nodeAPos.y
        clicking = true
      } else if (progress < phases.hold.end) {
        cursorX = this.nodeBPos.x + 20
        cursorY = this.nodeBPos.y - 20
      } else {
        cursorX = this.nodeBPos.x + 40
        cursorY = this.nodeBPos.y - 40
      }

      this.drawCursor(cursorX, cursorY, clicking)
    }
  }

  private drawConnectionLine(
    posA: { x: number; y: number },
    posB: { x: number; y: number },
    pulse: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2
    const cy = ANIMATION_HEIGHT / 2

    // Dashed connection line
    this.ctx.beginPath()
    this.ctx.moveTo(cx + posA.x, cy + posA.y)
    this.ctx.lineTo(cx + posB.x, cy + posB.y)
    this.ctx.strokeStyle = hexToCSS(
      TeachingColors.halo,
      (0.3 + pulse * 0.3) * alpha
    )
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Center merge icon
    const midX = cx + (posA.x + posB.x) / 2
    const midY = cy + (posA.y + posB.y) / 2
    const iconSize = 6

    this.ctx.beginPath()
    // Left arrow
    this.ctx.moveTo(midX - iconSize, midY)
    this.ctx.lineTo(midX - 2, midY)
    // Right arrow
    this.ctx.moveTo(midX + iconSize, midY)
    this.ctx.lineTo(midX + 2, midY)
    this.ctx.strokeStyle = hexToCSS(
      TeachingColors.halo,
      (0.5 + pulse * 0.3) * alpha
    )
    this.ctx.stroke()
  }

  private drawHaloRing(
    x: number,
    y: number,
    pulse: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2 + x
    const cy = ANIMATION_HEIGHT / 2 + y
    const radius = 22 + pulse * 4

    // Inner glow
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, 18, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(TeachingColors.halo, 0.15 * alpha)
    this.ctx.fill()

    // Halo ring
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(
      TeachingColors.halo,
      (0.4 + pulse * 0.3) * alpha
    )
    this.ctx.lineWidth = 3
    this.ctx.stroke()
  }

  private drawDuplicateNode(x: number, y: number, alpha: number): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2 + x
    const cy = ANIMATION_HEIGHT / 2 + y
    const radius = 14

    // Node fill
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(Colors.nodeReady, 0.6 * alpha)
    this.ctx.fill()

    // Node border
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderReady, alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Icon (square)
    const iconSize = 5
    this.ctx.beginPath()
    this.ctx.rect(cx - iconSize, cy - iconSize, iconSize * 2, iconSize * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderReady, 0.8 * alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.stroke()
  }

  private drawMergedNode(x: number, y: number, alpha: number): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2 + x
    const cy = ANIMATION_HEIGHT / 2 + y
    const radius = 16

    // Symlink glow
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(Colors.wireSymlink, 0.2 * alpha)
    this.ctx.fill()

    // Node fill
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(Colors.nodeOptimized, 0.6 * alpha)
    this.ctx.fill()

    // Node border
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderOptimized, alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()
  }

  private drawMergeEffect(x: number, y: number, progress: number): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2 + x
    const cy = ANIMATION_HEIGHT / 2 + y
    const fadeAlpha = 1 - progress

    // Expanding rings
    const ring1Radius = 20 + progress * 30
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, ring1Radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.wireSymlink, fadeAlpha * 0.6)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    const ring2Radius = 15 + progress * 25
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, ring2Radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.wireSymlink, fadeAlpha * 0.4)
    this.ctx.lineWidth = 3
    this.ctx.stroke()
  }
}
