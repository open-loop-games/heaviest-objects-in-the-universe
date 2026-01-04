// Resolve Speed Upgrade Tooltip Animation
// Shows: Gear spinning faster, conflict wire resolving quicker
// Concept: ⚙+ upgrade = faster auto-resolve + cheaper drain

import {
  TooltipAnimation,
  TooltipColors,
  hexToCSS,
  TOOLTIP_HEIGHT,
  TOOLTIP_WIDTH,
} from './tooltip-animation'

export class ResolveSpeedTooltip extends TooltipAnimation {
  protected loopDuration = 2000 // 2 second loop

  // Animation phases
  private static readonly PHASES = {
    slowResolve: { start: 0, end: 0.4 }, // Slow gear + slow X fade
    speedUp: { start: 0.4, end: 0.5 }, // Speed lines appear
    fastResolve: { start: 0.5, end: 0.85 }, // Fast gear + fast resolve
    reset: { start: 0.85, end: 1.0 }, // Fade for loop
  }

  protected setup(): void {
    // Initial draw handled by update
  }

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = ResolveSpeedTooltip.PHASES

    // Calculate speed mode
    const isFast = progress >= phases.speedUp.start

    // Gear rotation (faster when in fast mode)
    const slowSpeed = progress * Math.PI * 2 // 1 rotation per loop
    const fastSpeed = progress * Math.PI * 6 // 3 rotations per loop
    const rotation = isFast ? fastSpeed : slowSpeed

    // Conflict → Ready transition (X button fades out)
    let resolveProgress = 0
    if (progress < phases.slowResolve.end) {
      // Slow resolve: takes full phase
      resolveProgress = this.phaseProgress(progress, phases.slowResolve)
    } else if (progress < phases.fastResolve.end) {
      // Fast resolve: quick transition
      const fastT = this.phaseProgress(progress, phases.fastResolve)
      resolveProgress = fastT * 2 // Twice as fast
    }
    resolveProgress = Math.min(1, resolveProgress)

    const isResolved = resolveProgress >= 1

    // Fade for loop reset
    let alpha = 1
    if (progress >= phases.reset.start) {
      alpha = 1 - this.phaseProgress(progress, phases.reset)
    }

    // Layout - gear on left, wire with X button on right
    const gearX = 16
    const gearY = TOOLTIP_HEIGHT / 2
    const gearRadius = 9

    // Wire endpoints
    const wireX1 = 32
    const wireX2 = TOOLTIP_WIDTH - 8
    const wireY = TOOLTIP_HEIGHT / 2
    const wireMidX = (wireX1 + wireX2) / 2

    // Draw gear
    const gearColor = isFast ? TooltipColors.resolve : 0x7a7a9a
    this.drawGear(gearX, gearY, gearRadius, gearColor, alpha, rotation)

    // Speed lines around gear when fast
    if (isFast && progress < phases.reset.start) {
      const speedT =
        progress < phases.speedUp.end
          ? this.phaseProgress(progress, phases.speedUp)
          : ((progress - phases.speedUp.end) * 4) % 1

      this.drawGearSpeedLines(gearX, gearY, gearRadius + 4, speedT, alpha)
    }

    // Draw conflict wire or resolved wire
    if (!isResolved) {
      this.drawConflictWire(wireX1, wireY, wireX2, wireY, progress, alpha)
    } else {
      // Resolved: calm green wire
      this.drawWire(
        wireX1,
        wireY,
        wireX2,
        wireY,
        TooltipColors.ready,
        alpha * 0.7
      )
    }

    // X button on wire - fades out during resolve
    if (!isResolved) {
      const xAlpha = (1 - resolveProgress) * alpha
      const xScale = 1 - resolveProgress * 0.3
      this.drawXButton(wireMidX, wireY, xScale, xAlpha)
    }

    // Resolution burst effect when transitioning
    if (resolveProgress > 0.5 && resolveProgress < 1) {
      const burstT = (resolveProgress - 0.5) * 2
      const burstAlpha = Math.sin(burstT * Math.PI) * 0.4 * alpha
      const burstRadius = 8 + burstT * 12
      this.ctx.beginPath()
      this.ctx.arc(wireMidX, wireY, burstRadius, 0, Math.PI * 2)
      this.ctx.strokeStyle = hexToCSS(TooltipColors.ready, burstAlpha)
      this.ctx.lineWidth = 2
      this.ctx.stroke()
    }
  }

  /**
   * Draw crackling conflict wire
   */
  private drawConflictWire(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    progress: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const time = progress * this.loopDuration

    // Glow behind wire
    this.ctx.beginPath()
    this.ctx.moveTo(x1, y1)
    this.ctx.lineTo(x2, y2)
    this.ctx.strokeStyle = hexToCSS(TooltipColors.conflict, 0.25 * alpha)
    this.ctx.lineWidth = 6
    this.ctx.stroke()

    // Crackling effect
    const segments = 4
    this.ctx.beginPath()
    this.ctx.moveTo(x1, y1)

    for (let i = 1; i < segments; i++) {
      const t = i / segments
      const x = this.lerp(x1, x2, t)
      const crackle = Math.sin(t * Math.PI * 3 + time * 0.03) * 3
      this.ctx.lineTo(x, y1 + crackle)
    }
    this.ctx.lineTo(x2, y2)
    this.ctx.strokeStyle = hexToCSS(TooltipColors.conflict, 0.9 * alpha)
    this.ctx.lineWidth = 2.5
    this.ctx.stroke()
  }

  /**
   * Draw X button on wire (matches production style)
   */
  private drawXButton(
    x: number,
    y: number,
    scale: number,
    alpha: number
  ): void {
    if (!this.ctx || alpha <= 0) return

    const size = 10 * scale

    // Dark red background
    this.ctx.beginPath()
    this.ctx.arc(x, y, size, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(0x4a2a2a, 0.95 * alpha)
    this.ctx.fill()

    // Red border with glow
    this.ctx.shadowColor = hexToCSS(TooltipColors.conflict, 0.5 * alpha)
    this.ctx.shadowBlur = 6
    this.ctx.strokeStyle = hexToCSS(TooltipColors.conflict, alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.stroke()
    this.ctx.shadowBlur = 0

    // X icon (~36% of button size)
    const iconSize = 3.5 * scale
    this.ctx.beginPath()
    this.ctx.moveTo(x - iconSize, y - iconSize)
    this.ctx.lineTo(x + iconSize, y + iconSize)
    this.ctx.moveTo(x + iconSize, y - iconSize)
    this.ctx.lineTo(x - iconSize, y + iconSize)
    this.ctx.strokeStyle = hexToCSS(0xffffff, 0.9 * alpha)
    this.ctx.lineWidth = 2
    this.ctx.lineCap = 'round'
    this.ctx.stroke()
    this.ctx.lineCap = 'butt'
  }

  /**
   * Draw speed lines radiating from gear
   */
  private drawGearSpeedLines(
    x: number,
    y: number,
    radius: number,
    progress: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const numLines = 4
    const lineAlpha = Math.sin(progress * Math.PI * 2) * 0.4 + 0.2

    for (let i = 0; i < numLines; i++) {
      const angle = (i / numLines) * Math.PI * 2 + progress * Math.PI * 4
      const innerR = radius
      const outerR = radius + 6

      const x1 = x + Math.cos(angle) * innerR
      const y1 = y + Math.sin(angle) * innerR
      const x2 = x + Math.cos(angle) * outerR
      const y2 = y + Math.sin(angle) * outerR

      this.ctx.beginPath()
      this.ctx.moveTo(x1, y1)
      this.ctx.lineTo(x2, y2)
      this.ctx.strokeStyle = hexToCSS(TooltipColors.resolve, lineAlpha * alpha)
      this.ctx.lineWidth = 2
      this.ctx.lineCap = 'round'
      this.ctx.stroke()
      this.ctx.lineCap = 'butt'
    }
  }
}
