// Edge indicators renderer - draws arrows, vignettes, guide lines
// Logic for WHAT to show is in onboarding/tutorial-indicators.ts

import { Graphics, Container, type Application } from 'pixi.js'
import { prefersReducedMotion } from './accessibility'
import {
  getAllIndicators,
  type EdgeIndicator,
  type Vignette,
} from '../onboarding/tutorial-indicators'
import { drawTutorialCursor } from '../onboarding/tutorial-cursor'

export class EdgeIndicatorRenderer {
  private container: Container
  private arrowGraphics: Graphics
  private vignetteGraphics: Graphics
  private cursorGraphics: Graphics

  // World-to-screen conversion function (set by renderer)
  private worldToScreen:
    | ((x: number, y: number) => { x: number; y: number })
    | null = null

  constructor(_app: Application) {
    this.container = new Container()
    this.container.label = 'edge-indicators'

    // Vignette behind arrows
    this.vignetteGraphics = new Graphics()
    this.vignetteGraphics.label = 'vignette'
    this.container.addChild(this.vignetteGraphics)

    this.arrowGraphics = new Graphics()
    this.arrowGraphics.label = 'arrows'
    this.container.addChild(this.arrowGraphics)

    // Cursor for first-click tutorial
    this.cursorGraphics = new Graphics()
    this.cursorGraphics.label = 'tutorial-cursor'
    this.container.addChild(this.cursorGraphics)
  }

  /**
   * Set coordinate conversion function (called by main renderer)
   */
  setWorldToScreen(
    worldToScreen: (x: number, y: number) => { x: number; y: number }
  ): void {
    this.worldToScreen = worldToScreen
  }

  /**
   * Update edge indicators each frame
   */
  update(screenWidth: number, screenHeight: number): void {
    if (!this.worldToScreen) return

    this.arrowGraphics.clear()
    this.vignetteGraphics.clear()

    const now = Date.now()

    // Get all indicators and vignettes from tutorial logic
    const { indicators, vignettes } = getAllIndicators(
      screenWidth,
      screenHeight,
      this.worldToScreen,
      now
    )

    // Draw vignettes
    this.drawVignettes(vignettes, screenWidth, screenHeight)

    // Draw indicators
    for (const indicator of indicators) {
      this.drawEdgeArrow(indicator, screenWidth, screenHeight, now)
    }

    // Draw tutorial cursor
    drawTutorialCursor(
      this.cursorGraphics,
      screenWidth,
      screenHeight,
      this.worldToScreen
    )
  }

  /**
   * Draw an edge indicator - either an arrow or a guide line
   * If screenX/screenY/pointTowardX/pointTowardY are set, draw a guide LINE from edge to target
   * Otherwise draw an arrow at the edge pointing toward off-screen target
   */
  private drawEdgeArrow(
    indicator: EdgeIndicator,
    screenWidth: number,
    screenHeight: number,
    now: number
  ): void {
    // Pulsing effect (static for reduced motion)
    const reducedMotion = prefersReducedMotion()
    const pulsePhase = reducedMotion
      ? 0.5
      : ((now * indicator.pulseRate) / 1000) % 1
    const pulse = reducedMotion
      ? 0.8
      : 0.6 + 0.4 * Math.sin(pulsePhase * Math.PI * 2)
    const alpha = reducedMotion ? 0.85 : 0.7 + 0.3 * pulse

    // Check if this is a guide line (from edge to on-screen target)
    if (
      indicator.screenX !== undefined &&
      indicator.pointTowardX !== undefined
    ) {
      const edgeX = indicator.screenX
      const edgeY = indicator.screenY!
      const centerX = indicator.pointTowardX
      const centerY = indicator.pointTowardY!

      // Calculate line end point - stop at node edge, not center
      const angle = Math.atan2(centerY - edgeY, centerX - edgeX)
      const stopRadius = indicator.targetRadius ?? 35 // Default node radius
      const targetX = centerX - Math.cos(angle) * stopRadius
      const targetY = centerY - Math.sin(angle) * stopRadius

      // Draw guide line from edge to node edge (no pulse, thin line)
      const lineWidth = 1.5

      // Main line
      this.arrowGraphics.moveTo(edgeX, edgeY)
      this.arrowGraphics.lineTo(targetX, targetY)
      this.arrowGraphics.stroke({
        color: indicator.color,
        alpha: 0.7,
        width: lineWidth,
      })

      // Subtle glow line
      this.arrowGraphics.moveTo(edgeX, edgeY)
      this.arrowGraphics.lineTo(targetX, targetY)
      this.arrowGraphics.stroke({
        color: indicator.color,
        alpha: 0.2,
        width: lineWidth * 4,
      })

      // Arrow head at the target end
      const arrowSize = 10
      const arrowAngle = Math.PI / 6 // 30 degrees

      const tipX = targetX
      const tipY = targetY
      const leftX = tipX - arrowSize * Math.cos(angle - arrowAngle)
      const leftY = tipY - arrowSize * Math.sin(angle - arrowAngle)
      const rightX = tipX - arrowSize * Math.cos(angle + arrowAngle)
      const rightY = tipY - arrowSize * Math.sin(angle + arrowAngle)

      this.arrowGraphics.moveTo(tipX, tipY)
      this.arrowGraphics.lineTo(leftX, leftY)
      this.arrowGraphics.lineTo(rightX, rightY)
      this.arrowGraphics.closePath()
      this.arrowGraphics.fill({ color: indicator.color, alpha })

      return
    }

    // Normal arrow at edge pointing toward off-screen target
    if (!this.worldToScreen) return

    const screenPos = this.worldToScreen(indicator.worldX, indicator.worldY)
    const padding = 20

    // Clamp position to screen edge
    const arrowX = Math.max(
      padding,
      Math.min(screenWidth - padding, screenPos.x)
    )
    const arrowY = Math.max(
      padding,
      Math.min(screenHeight - padding, screenPos.y)
    )
    const targetX = screenPos.x
    const targetY = screenPos.y

    // Calculate angle from arrow position to target
    const angle = Math.atan2(targetY - arrowY, targetX - arrowX)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    const size = indicator.size * (reducedMotion ? 1 : 0.9 + 0.1 * pulse)

    // Helper to rotate and translate a point
    const transform = (x: number, y: number) => ({
      x: arrowX + x * cos - y * sin,
      y: arrowY + x * sin + y * cos,
    })

    // Arrow shape vertices (pointing right, will be rotated)
    const tip = transform(size * 0.6, 0)
    const backTop = transform(-size * 0.4, -size * 0.5)
    const notch = transform(-size * 0.2, 0)
    const backBottom = transform(-size * 0.4, size * 0.5)

    // Draw arrow
    this.arrowGraphics.moveTo(tip.x, tip.y)
    this.arrowGraphics.lineTo(backTop.x, backTop.y)
    this.arrowGraphics.lineTo(notch.x, notch.y)
    this.arrowGraphics.lineTo(backBottom.x, backBottom.y)
    this.arrowGraphics.closePath()
    this.arrowGraphics.fill({ color: indicator.color, alpha })

    // Glow effect
    this.arrowGraphics.circle(arrowX, arrowY, size * 0.8)
    this.arrowGraphics.fill({ color: indicator.color, alpha: alpha * 0.2 })
  }

  /**
   * Draw edge vignettes
   */
  private drawVignettes(
    vignettes: Vignette[],
    screenWidth: number,
    screenHeight: number
  ): void {
    const vignetteSize = 60

    for (const vignette of vignettes) {
      for (const edge of vignette.edges) {
        switch (edge) {
          case 'top':
            this.drawGradientRect(
              0,
              0,
              screenWidth,
              vignetteSize,
              vignette.color,
              vignette.alpha,
              'down'
            )
            break
          case 'bottom':
            this.drawGradientRect(
              0,
              screenHeight - vignetteSize,
              screenWidth,
              vignetteSize,
              vignette.color,
              vignette.alpha,
              'up'
            )
            break
          case 'left':
            this.drawGradientRect(
              0,
              0,
              vignetteSize,
              screenHeight,
              vignette.color,
              vignette.alpha,
              'right'
            )
            break
          case 'right':
            this.drawGradientRect(
              screenWidth - vignetteSize,
              0,
              vignetteSize,
              screenHeight,
              vignette.color,
              vignette.alpha,
              'left'
            )
            break
        }
      }
    }
  }

  /**
   * Draw a gradient rectangle for vignette effect
   */
  private drawGradientRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    alpha: number,
    direction: 'up' | 'down' | 'left' | 'right'
  ): void {
    // Draw multiple semi-transparent rectangles to simulate gradient
    const steps = 8

    for (let i = 0; i < steps; i++) {
      const t = i / steps
      const stepAlpha = alpha * (1 - t)

      let sx = x,
        sy = y,
        sw = width,
        sh = height

      switch (direction) {
        case 'down':
          sy = y + height * t
          sh = height / steps
          break
        case 'up':
          sy = y + height * (1 - 1 / steps - t)
          sh = height / steps
          break
        case 'right':
          sx = x + width * t
          sw = width / steps
          break
        case 'left':
          sx = x + width * (1 - 1 / steps - t)
          sw = width / steps
          break
      }

      this.vignetteGraphics.rect(sx, sy, sw, sh)
      this.vignetteGraphics.fill({ color, alpha: stepAlpha })
    }
  }

  getContainer(): Container {
    return this.container
  }

  clear(): void {
    this.arrowGraphics.clear()
    this.vignetteGraphics.clear()
    this.cursorGraphics.clear()
  }
}
