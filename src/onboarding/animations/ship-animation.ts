// Ship Animation
// Demonstrates: Weight accumulates → ship button ready → click → package flies to npm mass → tokens gained
// Loop: ~4 seconds

import {
  BaseAnimation,
  hexToCSS,
  ANIMATION_WIDTH,
  ANIMATION_HEIGHT,
} from './base-animation'
import { Colors } from '../../rendering/colors'

export class ShipAnimation extends BaseAnimation {
  protected loopDuration = 4000 // 4 second loop

  // Animation phases
  private static readonly PHASES = {
    accumulate: { start: 0, end: 0.2 }, // Weight bar fills
    buttonReady: { start: 0.2, end: 0.3 }, // Ship button appears
    cursorMove: { start: 0.3, end: 0.4 }, // Cursor moves to button
    click: { start: 0.4, end: 0.5 }, // Click animation
    compress: { start: 0.5, end: 0.6 }, // Nodes compress to package
    fly: { start: 0.6, end: 0.75 }, // Package flies to mass
    absorb: { start: 0.75, end: 0.85 }, // Mass absorbs, tokens appear
    hold: { start: 0.85, end: 0.95 }, // Show result
    reset: { start: 0.95, end: 1.0 }, // Fade out
  }

  // Scattered nodes that will compress (centered more to right side of canvas)
  private readonly nodes = [
    { x: 20, y: -25, size: 6 },
    { x: 55, y: -15, size: 5 },
    { x: 10, y: 10, size: 7 },
    { x: 60, y: 5, size: 5 },
    { x: 25, y: 25, size: 6 },
    { x: 50, y: 20, size: 5 },
  ]

  protected setup(): void {}

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = ShipAnimation.PHASES

    // Global fade
    let alpha = 1
    if (progress >= phases.reset.start) {
      alpha =
        1 -
        (progress - phases.reset.start) /
          (phases.reset.end - phases.reset.start)
    }

    // Calculate phase states
    const accumT = this.phaseProgress(progress, phases.accumulate)
    const buttonT = this.phaseProgress(progress, phases.buttonReady)
    const compressT = this.phaseProgress(progress, phases.compress)
    const flyT = this.phaseProgress(progress, phases.fly)
    const absorbT = this.phaseProgress(progress, phases.absorb)

    // Draw npm mass (always visible, top-right area)
    this.drawNpmMass(absorbT, alpha)

    // Draw weight bar (left side)
    this.drawWeightBar(accumT, buttonT, alpha)

    // Draw scattered/compressing nodes
    if (progress < phases.absorb.start) {
      this.drawNodes(compressT, flyT, alpha)
    }

    // Draw flying package
    if (progress >= phases.compress.end && progress < phases.absorb.end) {
      this.drawFlyingPackage(flyT, absorbT, alpha)
    }

    // Draw ship button
    if (progress >= phases.buttonReady.start && progress < phases.fly.start) {
      const buttonVisible = progress < phases.click.end ? 1 : 1 - flyT * 2
      this.drawShipButton(buttonT, buttonVisible * alpha)
    }

    // Draw cursor
    if (
      progress >= phases.cursorMove.start &&
      progress < phases.compress.start
    ) {
      this.drawCursorForShip(progress, alpha)
    }

    // Draw token reward
    if (progress >= phases.absorb.start && progress < phases.reset.start) {
      this.drawTokenReward(absorbT, alpha)
    }
  }

  private phaseProgress(
    progress: number,
    phase: { start: number; end: number }
  ): number {
    if (progress < phase.start) return 0
    if (progress >= phase.end) return 1
    return (progress - phase.start) / (phase.end - phase.start)
  }

  private drawNpmMass(absorbT: number, alpha: number): void {
    if (!this.ctx) return

    // Position in bottom-left area (like PrestigeOrbit)
    const x = 50
    const y = ANIMATION_HEIGHT - 40

    // Base size, grows slightly when absorbing
    const baseSize = 16
    const size = baseSize + absorbT * 4
    const pulse = Math.sin(absorbT * Math.PI * 4) * 2 * absorbT

    // Outer glow
    this.ctx.beginPath()
    this.ctx.arc(x, y, size + 8 + pulse, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(0x7a5aff, 0.15 * alpha)
    this.ctx.fill()

    // Inner glow
    this.ctx.beginPath()
    this.ctx.arc(x, y, size + 4, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(0x5a3a9a, 0.3 * alpha)
    this.ctx.fill()

    // npm hexagon shape
    this.drawHexagon(x, y, size, alpha)

    // Absorption flash
    if (absorbT > 0 && absorbT < 0.5) {
      const flashAlpha = (0.5 - absorbT) * 2 * alpha
      this.ctx.beginPath()
      this.ctx.arc(x, y, size + 12, 0, Math.PI * 2)
      this.ctx.strokeStyle = hexToCSS(0xffffff, flashAlpha * 0.6)
      this.ctx.lineWidth = 2
      this.ctx.stroke()
    }
  }

  private drawHexagon(x: number, y: number, size: number, alpha: number): void {
    if (!this.ctx) return

    // Draw hexagon
    this.ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2
      const hx = x + Math.cos(angle) * size
      const hy = y + Math.sin(angle) * size
      if (i === 0) {
        this.ctx.moveTo(hx, hy)
      } else {
        this.ctx.lineTo(hx, hy)
      }
    }
    this.ctx.closePath()

    // Fill
    this.ctx.fillStyle = hexToCSS(0x2a1a3a, alpha)
    this.ctx.fill()

    // Border
    this.ctx.strokeStyle = hexToCSS(0x7a5aff, alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // npm-style notch
    const notchSize = size * 0.3
    this.ctx.fillStyle = hexToCSS(0x1a0a2a, alpha)
    this.ctx.fillRect(
      x - notchSize / 2,
      y - notchSize / 2,
      notchSize,
      notchSize * 1.5
    )
  }

  private drawWeightBar(
    accumT: number,
    buttonReadyT: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    // Horizontal segmented bar (matching WeightRow.vue)
    const barX = 24
    const barY = 12
    const segments = 8 // Fewer segments for animation clarity
    const segmentWidth = 8
    const segmentHeight = 14
    const gap = 2
    const totalWidth = segments * segmentWidth + (segments - 1) * gap

    // Weight icon
    this.ctx.fillStyle = hexToCSS(0xffaa5a, alpha)
    this.ctx.font = '14px system-ui'
    this.ctx.textAlign = 'left'
    this.ctx.fillText('◆', barX - 18, barY + segmentHeight - 2)

    // Bar background container
    this.ctx.fillStyle = hexToCSS(0x14120f, 0.8 * alpha)
    this.ctx.beginPath()
    this.ctx.roundRect(barX - 3, barY - 3, totalWidth + 6, segmentHeight + 6, 4)
    this.ctx.fill()

    // Calculate filled segments
    const fillProgress = this.easeInOut(accumT)
    const filledSegments = Math.floor(fillProgress * segments)
    const partialFill = (fillProgress * segments) % 1

    // Draw segments
    for (let i = 0; i < segments; i++) {
      const segX = barX + i * (segmentWidth + gap)
      const isLast = i === segments - 1
      const isFilled = i < filledSegments
      const isPartial = i === filledSegments && partialFill > 0

      // Segment track
      this.ctx.fillStyle = hexToCSS(0xffaa5a, 0.15 * alpha)
      this.ctx.fillRect(segX, barY, segmentWidth, segmentHeight)

      // Segment fill
      if (isFilled) {
        // Last segment turns purple when bar is full
        if (isLast && buttonReadyT > 0) {
          const gradient = this.ctx.createLinearGradient(
            segX,
            barY + segmentHeight,
            segX,
            barY
          )
          gradient.addColorStop(0, hexToCSS(0x7a5aff, alpha))
          gradient.addColorStop(1, hexToCSS(0x9a7aff, alpha))
          this.ctx.fillStyle = gradient
          // Glow effect
          this.ctx.shadowColor = hexToCSS(0x7a5aff, 0.6)
          this.ctx.shadowBlur = 6
        } else {
          const gradient = this.ctx.createLinearGradient(
            segX,
            barY + segmentHeight,
            segX,
            barY
          )
          gradient.addColorStop(0, hexToCSS(0xcc8040, alpha))
          gradient.addColorStop(1, hexToCSS(0xffaa5a, alpha))
          this.ctx.fillStyle = gradient
        }
        this.ctx.fillRect(segX, barY, segmentWidth, segmentHeight)
        this.ctx.shadowBlur = 0
      } else if (isPartial) {
        // Partial fill from bottom
        const fillHeight = segmentHeight * partialFill
        const gradient = this.ctx.createLinearGradient(
          segX,
          barY + segmentHeight,
          segX,
          barY
        )
        gradient.addColorStop(0, hexToCSS(0xcc8040, alpha))
        gradient.addColorStop(1, hexToCSS(0xffaa5a, alpha))
        this.ctx.fillStyle = gradient
        this.ctx.fillRect(
          segX,
          barY + segmentHeight - fillHeight,
          segmentWidth,
          fillHeight
        )
      }

      // Last segment border (milestone marker)
      if (isLast) {
        this.ctx.strokeStyle = hexToCSS(0x7a5aff, 0.4 * alpha)
        this.ctx.lineWidth = 1
        this.ctx.strokeRect(segX, barY, segmentWidth, segmentHeight)
      }
    }
  }

  private drawNodes(compressT: number, _flyT: number, alpha: number): void {
    if (!this.ctx) return

    // Nodes centered in right portion of canvas
    const cx = ANIMATION_WIDTH / 2 + 20
    const cy = ANIMATION_HEIGHT / 2

    const eased = this.easeInOut(compressT)

    for (const node of this.nodes) {
      // Interpolate from scattered position to package center
      const x = cx + node.x * (1 - eased)
      const y = cy + node.y * (1 - eased)

      // Size shrinks as they compress
      const size = node.size * (1 - eased * 0.7)

      // Skip if too small
      if (size < 1) continue

      // Node glow
      this.ctx.beginPath()
      this.ctx.arc(x, y, size + 2, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(Colors.borderReady, 0.2 * alpha)
      this.ctx.fill()

      // Node fill
      this.ctx.beginPath()
      this.ctx.arc(x, y, size, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(Colors.nodeReady, 0.7 * alpha)
      this.ctx.fill()

      // Node border
      this.ctx.strokeStyle = hexToCSS(Colors.borderReady, alpha)
      this.ctx.lineWidth = 1.5
      this.ctx.stroke()
    }
  }

  private drawFlyingPackage(
    flyT: number,
    absorbT: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    // Start from nodes area (right side of canvas)
    const cx = ANIMATION_WIDTH / 2 + 20
    const cy = ANIMATION_HEIGHT / 2

    // Target is npm mass (bottom-left)
    const targetX = 50
    const targetY = ANIMATION_HEIGHT - 40

    // Flying from center to target
    const eased = this.easeInOut(flyT)
    const x = this.lerp(cx, targetX, eased)
    const y = this.lerp(cy, targetY, eased)

    // Size shrinks as it approaches
    const size = this.lerp(12, 6, eased)

    // Skip if absorbed
    if (absorbT > 0.3) return

    // Package glow trail
    if (flyT > 0) {
      const trailAlpha = (1 - flyT) * 0.4 * alpha
      this.ctx.beginPath()
      this.ctx.arc(cx + (x - cx) * 0.5, cy + (y - cy) * 0.5, 4, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(0x7a5aff, trailAlpha)
      this.ctx.fill()
    }

    // Package body (box shape)
    this.ctx.save()
    this.ctx.translate(x, y)
    this.ctx.rotate(flyT * Math.PI * 2) // Spin while flying

    // Box base
    this.ctx.fillStyle = hexToCSS(0x5a8aff, alpha)
    this.ctx.fillRect(-size / 2, -size / 3, size, size * 0.6)

    // Box top
    this.ctx.beginPath()
    this.ctx.moveTo(-size / 2, -size / 3)
    this.ctx.lineTo(0, -size / 2 - 3)
    this.ctx.lineTo(size / 2, -size / 3)
    this.ctx.closePath()
    this.ctx.fillStyle = hexToCSS(0x7a9aff, alpha)
    this.ctx.fill()

    // Box outline
    this.ctx.strokeStyle = hexToCSS(0xffffff, 0.5 * alpha)
    this.ctx.lineWidth = 1
    this.ctx.strokeRect(-size / 2, -size / 3, size, size * 0.6)

    this.ctx.restore()
  }

  private drawShipButton(readyT: number, alpha: number): void {
    if (!this.ctx) return

    // Position above the npm mass
    const x = 50
    const y = ANIMATION_HEIGHT - 75
    const width = 50
    const height = 22

    // Button background
    const bgAlpha = this.easeInOut(readyT) * alpha
    this.ctx.fillStyle = hexToCSS(0x3a2a5a, bgAlpha * 0.8)
    this.ctx.beginPath()
    this.ctx.roundRect(x - width / 2, y - height / 2, width, height, 6)
    this.ctx.fill()

    // Button border (glowing when ready)
    const glowIntensity = 0.5 + Math.sin(Date.now() / 150) * 0.3
    this.ctx.strokeStyle = hexToCSS(0x7a5aff, bgAlpha * glowIntensity)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Glow effect
    this.ctx.shadowColor = hexToCSS(0x7a5aff, 0.5)
    this.ctx.shadowBlur = 8 * glowIntensity
    this.ctx.stroke()
    this.ctx.shadowBlur = 0

    // Upload icon (box with arrow)
    this.ctx.strokeStyle = hexToCSS(0xc0a0ff, bgAlpha)
    this.ctx.lineWidth = 1.5

    // Box base
    const boxSize = 10
    this.ctx.strokeRect(x - boxSize / 2, y - 2, boxSize, boxSize * 0.7)

    // Arrow up
    this.ctx.beginPath()
    this.ctx.moveTo(x, y + 3)
    this.ctx.lineTo(x, y - 4)
    this.ctx.moveTo(x - 3, y - 1)
    this.ctx.lineTo(x, y - 5)
    this.ctx.lineTo(x + 3, y - 1)
    this.ctx.stroke()
  }

  private drawCursorForShip(progress: number, _alpha: number): void {
    if (!this.ctx) return

    const phases = ShipAnimation.PHASES
    // Ship button position (matching drawShipButton)
    const buttonX = 50
    const buttonY = ANIMATION_HEIGHT - 75

    let cursorX: number, cursorY: number
    let clicking = false

    if (progress < phases.cursorMove.end) {
      // Moving from nodes area to button
      const t = this.phaseProgress(progress, phases.cursorMove)
      const eased = this.easeInOut(t)
      cursorX = this.lerp(ANIMATION_WIDTH / 2 + 40, buttonX + 15, eased)
      cursorY = this.lerp(ANIMATION_HEIGHT / 2, buttonY + 5, eased)
    } else {
      // At button, clicking
      cursorX = buttonX + 15
      cursorY = buttonY + 5
      clicking = progress >= phases.click.start && progress < phases.click.end
    }

    this.drawCursor(
      cursorX - ANIMATION_WIDTH / 2,
      cursorY - ANIMATION_HEIGHT / 2,
      clicking
    )

    // Click ripple (use center-relative coords like drawCursor)
    if (clicking) {
      const clickT = this.phaseProgress(progress, phases.click)
      this.drawClickRipple(
        buttonX - ANIMATION_WIDTH / 2,
        buttonY - ANIMATION_HEIGHT / 2,
        clickT
      )
    }
  }

  private drawTokenReward(absorbT: number, alpha: number): void {
    if (!this.ctx) return

    // npm mass position (matching drawNpmMass)
    const massX = 50
    const massY = ANIMATION_HEIGHT - 40

    // Tokens emerging from mass (spreading to the right)
    const numTokens = 3
    const eased = this.easeInOut(absorbT)

    for (let i = 0; i < numTokens; i++) {
      const angle = -Math.PI / 4 + (i * Math.PI) / 8 // Spread upward-right
      const distance = 28 + eased * 18
      const tokenAlpha = alpha * Math.min(1, absorbT * 2) * (1 - absorbT * 0.3)

      const x = massX + Math.cos(angle) * distance
      const y = massY + Math.sin(angle) * distance

      // Token glow
      this.ctx.beginPath()
      this.ctx.arc(x, y, 6, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(Colors.cacheFragment, 0.2 * tokenAlpha)
      this.ctx.fill()

      // Token (cycle symbol)
      this.ctx.fillStyle = hexToCSS(Colors.cacheFragment, 0.9 * tokenAlpha)
      this.ctx.font = '12px sans-serif'
      this.ctx.textAlign = 'center'
      this.ctx.textBaseline = 'middle'
      this.ctx.fillText('⟲', x, y)
    }
  }
}
