// Base class for teaching book animations
// Uses Canvas2D instead of WebGL to avoid context conflicts with main game

import { Colors } from '../../rendering/colors'

// Standard dimensions for teaching animations
export const ANIMATION_WIDTH = 200
export const ANIMATION_HEIGHT = 150

// Common colors for teaching animations (converted to CSS strings)
export const TeachingColors = {
  background: '#1a1428',
  node: Colors.nodeReady,
  nodeInstalling: Colors.borderInstalling,
  wire: Colors.wireDefault,
  wireConflict: Colors.borderConflict,
  symlink: Colors.wireSymlink,
  cursor: 0xffffff,
  cursorGlow: 0x5affff,
  halo: 0x5affff,
  portal: Colors.borderOptimized,
  prestige: 0x7a5aff,
  // Resource hint colors (matching CausalParticles.vue)
  bandwidthCost: 0x7a7aff, // Blue-purple
  bandwidthGain: 0x5aff7a, // Green
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
 * Base class for teaching animations
 * Uses Canvas2D for simple graphics without WebGL context issues
 */
export abstract class BaseAnimation {
  protected canvas: HTMLCanvasElement | null = null
  protected ctx: CanvasRenderingContext2D | null = null
  protected isRunning = false
  protected animationTime = 0
  protected lastTime = 0
  protected animationFrameId: number | null = null

  // Subclasses define the loop duration
  protected abstract loopDuration: number

  constructor() {}

  /**
   * Initialize with a canvas element
   */
  async init(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    if (!this.ctx) {
      console.error('Failed to get 2D context')
      return
    }

    // Set canvas size with device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1
    canvas.width = ANIMATION_WIDTH * dpr
    canvas.height = ANIMATION_HEIGHT * dpr
    canvas.style.width = `${ANIMATION_WIDTH}px`
    canvas.style.height = `${ANIMATION_HEIGHT}px`
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
    this.ctx.fillStyle = TeachingColors.background
    this.ctx.fillRect(0, 0, ANIMATION_WIDTH, ANIMATION_HEIGHT)

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

  /**
   * Helper: Draw a simple node circle
   */
  protected drawNode(
    x: number,
    y: number,
    radius: number,
    fillColor: number,
    borderColor: number = fillColor,
    alpha: number = 0.6
  ): void {
    if (!this.ctx) return

    // Translate to center of canvas
    const cx = ANIMATION_WIDTH / 2 + x
    const cy = ANIMATION_HEIGHT / 2 + y

    // Fill
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(fillColor, alpha)
    this.ctx.fill()

    // Border
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(borderColor, 1)
    this.ctx.lineWidth = 2
    this.ctx.stroke()
  }

  /**
   * Helper: Draw a wire between two points
   */
  protected drawWire(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: number,
    width: number = 2,
    alpha: number = 1
  ): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2
    const cy = ANIMATION_HEIGHT / 2

    this.ctx.beginPath()
    this.ctx.moveTo(cx + x1, cy + y1)
    this.ctx.lineTo(cx + x2, cy + y2)
    this.ctx.strokeStyle = hexToCSS(color, alpha)
    this.ctx.lineWidth = width
    this.ctx.stroke()
  }

  /**
   * Helper: Draw a pulsing halo around a point
   */
  protected drawHalo(
    x: number,
    y: number,
    radius: number,
    color: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2 + x
    const cy = ANIMATION_HEIGHT / 2 + y

    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(color, alpha)
    this.ctx.lineWidth = 3
    this.ctx.stroke()
  }

  /**
   * Helper: Draw cursor (ghost hand pointer)
   */
  protected drawCursor(x: number, y: number, clicking: boolean = false): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2 + x
    const cy = ANIMATION_HEIGHT / 2 + y
    const scale = clicking ? 0.9 : 1

    // Cursor glow
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, 8 * scale, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(TeachingColors.cursorGlow, 0.3)
    this.ctx.fill()

    // Cursor point (simple triangle pointer)
    const size = 12 * scale
    this.ctx.beginPath()
    this.ctx.moveTo(cx, cy)
    this.ctx.lineTo(cx + size * 0.7, cy + size * 0.7)
    this.ctx.lineTo(cx + size * 0.2, cy + size * 0.7)
    this.ctx.lineTo(cx, cy + size)
    this.ctx.closePath()
    this.ctx.fillStyle = hexToCSS(TeachingColors.cursor, 0.9)
    this.ctx.fill()
    this.ctx.strokeStyle = hexToCSS(TeachingColors.cursorGlow, 0.6)
    this.ctx.lineWidth = 1
    this.ctx.stroke()
  }

  /**
   * Helper: Draw click ripple effect
   */
  protected drawClickRipple(
    x: number,
    y: number,
    progress: number,
    color: number = 0x4ade80
  ): void {
    if (!this.ctx || progress <= 0) return

    const cx = ANIMATION_WIDTH / 2 + x
    const cy = ANIMATION_HEIGHT / 2 + y
    const radius = 10 + progress * 30
    const alpha = (1 - progress) * 0.6

    this.ctx.beginPath()
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(color, alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()
  }

  /**
   * Helper: Ease function for smooth animations
   */
  protected easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  }

  /**
   * Helper: Linear interpolation
   */
  protected lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
  }

  /**
   * Helper: Draw a resource hint (floating icon like ↑ or ↓)
   * @param x Position relative to center
   * @param y Position relative to center
   * @param icon The unicode symbol to show
   * @param color Hex color
   * @param progress 0-1 for float-up animation
   */
  protected drawResourceHint(
    x: number,
    y: number,
    icon: string,
    color: number,
    progress: number
  ): void {
    if (!this.ctx || progress <= 0) return

    const cx = ANIMATION_WIDTH / 2 + x
    // Float upward as progress increases
    const floatOffset = progress * 20
    const cy = ANIMATION_HEIGHT / 2 + y - floatOffset

    // Fade in quickly, then fade out
    const fadeIn = Math.min(progress * 4, 1)
    const fadeOut = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1
    const alpha = fadeIn * fadeOut

    // Glow behind icon
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, 12, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(color, alpha * 0.3)
    this.ctx.fill()

    // Icon text
    this.ctx.font = 'bold 16px system-ui, sans-serif'
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillStyle = hexToCSS(color, alpha)
    this.ctx.shadowColor = hexToCSS(color, alpha * 0.8)
    this.ctx.shadowBlur = 8
    this.ctx.fillText(icon, cx, cy)
    this.ctx.shadowBlur = 0
  }
}
