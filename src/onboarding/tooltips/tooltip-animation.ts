// Base class for upgrade tooltip animations
// Smaller, simpler Canvas2D animations shown on hover

import { Colors } from '../../rendering/colors'

// Compact dimensions for tooltips
export const TOOLTIP_WIDTH = 80
export const TOOLTIP_HEIGHT = 56

// Colors for tooltip animations
export const TooltipColors = {
  background: '#1a1428',
  bandwidth: Colors.borderInstalling, // Blue
  bandwidthDark: 0x4a4aaa,
  weight: 0xffaa5a, // Orange
  weightDark: 0xc08040,
  surge: 0xf0a040, // Amber
  surgeBright: 0xffcc44,
  resolve: 0x5affff, // Cyan
  conflict: Colors.borderConflict, // Red
  ready: Colors.borderReady, // Green
  wire: Colors.wireDefault,
  speedLine: 0x5affff,
}

// Convert hex number to CSS color string
export function hexToCSS(hex: number, alpha: number = 1): string {
  const r = (hex >> 16) & 255
  const g = (hex >> 8) & 255
  const b = hex & 255
  return alpha < 1
    ? `rgba(${r}, ${g}, ${b}, ${alpha})`
    : `rgb(${r}, ${g}, ${b})`
}

/**
 * Base class for tooltip animations
 * Compact Canvas2D graphics for upgrade explanations
 */
export abstract class TooltipAnimation {
  protected canvas: HTMLCanvasElement | null = null
  protected ctx: CanvasRenderingContext2D | null = null
  protected isRunning = false
  protected animationTime = 0
  protected lastTime = 0
  protected animationFrameId: number | null = null

  // Subclasses define the loop duration (typically 1.5-2.5s)
  protected abstract loopDuration: number

  constructor() {}

  /**
   * Initialize with a canvas element
   */
  async init(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    if (!this.ctx) {
      console.error('Failed to get 2D context for tooltip')
      return
    }

    // Set canvas size with device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1
    canvas.width = TOOLTIP_WIDTH * dpr
    canvas.height = TOOLTIP_HEIGHT * dpr
    canvas.style.width = `${TOOLTIP_WIDTH}px`
    canvas.style.height = `${TOOLTIP_HEIGHT}px`
    this.ctx.scale(dpr, dpr)

    // Set up initial scene
    this.setup()
  }

  /**
   * Subclasses implement this to set up initial state
   */
  protected abstract setup(): void

  /**
   * Subclasses implement this to update animation based on time
   * @param progress 0-1 representing position in the animation loop
   */
  protected abstract update(progress: number): void

  /**
   * Start the animation loop
   */
  start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.animationTime = 0
    this.lastTime = performance.now()
    this.tick()
  }

  /**
   * Stop the animation loop
   */
  stop(): void {
    this.isRunning = false
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  /**
   * Animation tick - called each frame
   */
  private tick = (): void => {
    if (!this.isRunning || !this.ctx || !this.canvas) return

    const now = performance.now()
    const delta = now - this.lastTime
    this.lastTime = now

    // Update animation time and wrap around for looping
    this.animationTime += delta
    if (this.animationTime >= this.loopDuration) {
      this.animationTime = this.animationTime % this.loopDuration
    }

    // Calculate progress (0-1)
    const progress = this.animationTime / this.loopDuration

    // Clear and redraw
    this.ctx.fillStyle = TooltipColors.background
    this.ctx.fillRect(0, 0, TOOLTIP_WIDTH, TOOLTIP_HEIGHT)

    // Update the animation
    this.update(progress)

    // Continue loop
    this.animationFrameId = requestAnimationFrame(this.tick)
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stop()
    this.canvas = null
    this.ctx = null
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Calculate phase progress (0-1) within a phase
   */
  protected phaseProgress(
    progress: number,
    phase: { start: number; end: number }
  ): number {
    if (progress < phase.start) return 0
    if (progress >= phase.end) return 1
    return (progress - phase.start) / (phase.end - phase.start)
  }

  /**
   * Ease in-out function for smooth animations
   */
  protected easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  }

  /**
   * Linear interpolation
   */
  protected lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
  }

  /**
   * Draw a segmented bar (horizontal)
   */
  protected drawBar(
    x: number,
    y: number,
    width: number,
    height: number,
    segments: number,
    fillPercent: number,
    fillColor: number,
    fillColorDark: number,
    emptyColor: number = 0x2a2a3a,
    glowColor?: number
  ): void {
    if (!this.ctx) return

    const gap = 2
    const segWidth = (width - gap * (segments - 1)) / segments

    for (let i = 0; i < segments; i++) {
      const sx = x + i * (segWidth + gap)
      const segmentFill = Math.max(0, Math.min(1, fillPercent * segments - i))

      // Background
      this.ctx.fillStyle = hexToCSS(emptyColor, 0.4)
      this.roundRect(sx, y, segWidth, height, 2)
      this.ctx.fill()

      // Fill
      if (segmentFill > 0) {
        const gradient = this.ctx.createLinearGradient(sx, y + height, sx, y)
        gradient.addColorStop(0, hexToCSS(fillColorDark, 0.9))
        gradient.addColorStop(1, hexToCSS(fillColor, 0.9))

        this.ctx.fillStyle = gradient
        this.roundRect(sx, y, segWidth * segmentFill, height, 2)
        this.ctx.fill()

        // Glow for filled segments
        if (glowColor && segmentFill >= 1) {
          this.ctx.shadowColor = hexToCSS(glowColor, 0.5)
          this.ctx.shadowBlur = 4
          this.roundRect(sx, y, segWidth, height, 2)
          this.ctx.fill()
          this.ctx.shadowBlur = 0
        }
      }
    }
  }

  /**
   * Draw a simple node/circle
   */
  protected drawNode(
    x: number,
    y: number,
    radius: number,
    fillColor: number,
    borderColor: number,
    alpha: number = 1
  ): void {
    if (!this.ctx) return

    // Fill
    this.ctx.beginPath()
    this.ctx.arc(x, y, Math.max(1, radius - 1), 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(fillColor, 0.6 * alpha)
    this.ctx.fill()

    // Border
    this.ctx.beginPath()
    this.ctx.arc(x, y, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(borderColor, alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.stroke()
  }

  /**
   * Draw a wire/line between two points
   */
  protected drawWire(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: number,
    alpha: number = 1,
    lineWidth: number = 1.5
  ): void {
    if (!this.ctx) return

    this.ctx.beginPath()
    this.ctx.moveTo(x1, y1)
    this.ctx.lineTo(x2, y2)
    this.ctx.strokeStyle = hexToCSS(color, alpha)
    this.ctx.lineWidth = lineWidth
    this.ctx.stroke()
  }

  /**
   * Draw speed lines (diagonal streaks indicating "faster")
   */
  protected drawSpeedLines(
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    progress: number
  ): void {
    if (!this.ctx) return

    const numLines = 3
    const lineAlpha = Math.sin(progress * Math.PI) * 0.6

    if (lineAlpha <= 0) return

    for (let i = 0; i < numLines; i++) {
      const offset = (i / numLines) * width
      const lineProgress = (progress * 2 + i * 0.2) % 1
      const lx = x + offset + lineProgress * (width * 0.3)
      const ly = y + lineProgress * height

      this.ctx.beginPath()
      this.ctx.moveTo(lx, ly)
      this.ctx.lineTo(lx + 8, ly - 6)
      this.ctx.strokeStyle = hexToCSS(color, lineAlpha * (1 - lineProgress))
      this.ctx.lineWidth = 1.5
      this.ctx.stroke()
    }
  }

  /**
   * Draw an arrow (→)
   */
  protected drawArrow(
    x: number,
    y: number,
    size: number,
    color: number,
    alpha: number = 1
  ): void {
    if (!this.ctx) return

    this.ctx.beginPath()
    this.ctx.moveTo(x - size, y)
    this.ctx.lineTo(x + size, y)
    this.ctx.moveTo(x + size * 0.3, y - size * 0.5)
    this.ctx.lineTo(x + size, y)
    this.ctx.lineTo(x + size * 0.3, y + size * 0.5)
    this.ctx.strokeStyle = hexToCSS(color, alpha)
    this.ctx.lineWidth = 2
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    this.ctx.stroke()
    this.ctx.lineCap = 'butt'
    this.ctx.lineJoin = 'miter'
  }

  /**
   * Draw a gear icon
   */
  protected drawGear(
    x: number,
    y: number,
    radius: number,
    color: number,
    alpha: number = 1,
    rotation: number = 0
  ): void {
    if (!this.ctx) return

    const teeth = 6
    const innerRadius = radius * 0.5
    const outerRadius = radius

    this.ctx.save()
    this.ctx.translate(x, y)
    this.ctx.rotate(rotation)

    this.ctx.beginPath()
    for (let i = 0; i < teeth * 2; i++) {
      const angle = (i / (teeth * 2)) * Math.PI * 2
      const r = i % 2 === 0 ? outerRadius : innerRadius
      const px = Math.cos(angle) * r
      const py = Math.sin(angle) * r
      if (i === 0) {
        this.ctx.moveTo(px, py)
      } else {
        this.ctx.lineTo(px, py)
      }
    }
    this.ctx.closePath()
    this.ctx.fillStyle = hexToCSS(color, alpha * 0.8)
    this.ctx.fill()
    this.ctx.strokeStyle = hexToCSS(color, alpha)
    this.ctx.lineWidth = 1
    this.ctx.stroke()

    // Center hole
    this.ctx.beginPath()
    this.ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(0x1a1428, 1)
    this.ctx.fill()

    this.ctx.restore()
  }

  /**
   * Helper to draw rounded rectangles
   */
  protected roundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    if (!this.ctx) return
    this.ctx.beginPath()
    this.ctx.moveTo(x + r, y)
    this.ctx.lineTo(x + w - r, y)
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    this.ctx.lineTo(x + w, y + h - r)
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    this.ctx.lineTo(x + r, y + h)
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    this.ctx.lineTo(x, y + r)
    this.ctx.quadraticCurveTo(x, y, x + r, y)
    this.ctx.closePath()
  }
}
