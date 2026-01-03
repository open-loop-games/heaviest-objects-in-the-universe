// Edge indicators renderer - draws arrows, vignettes, guide lines
// Logic for WHAT to show is in onboarding/tutorial-indicators.ts
// Visual style inspired by Alkahistorian's organic line system

import { Graphics, Container, type Application } from 'pixi.js'
import { prefersReducedMotion } from './accessibility'
import {
  getAllIndicators,
  type EdgeIndicator,
  type Vignette,
} from '../onboarding/tutorial-indicators'
import { drawTutorialCursor } from '../onboarding/tutorial-cursor'

// Persistent state for organic movement per indicator
interface IndicatorState {
  // Line endpoint drift (organic wobble)
  edgeDrawX: number
  edgeDrawY: number
  edgeDestX: number
  edgeDestY: number
  targetDrawX: number
  targetDrawY: number
  targetDestX: number
  targetDestY: number
  // Activity level (decays toward 0, spikes on changes)
  activity: number
  // Flow dot position along line (0-1)
  flowProgress: number
  flowDirection: number // 1 = toward target, -1 = toward edge
  // Last known positions for change detection
  lastEdgeX: number
  lastEdgeY: number
  lastTargetX: number
  lastTargetY: number
}

// Constants for organic movement
const DRIFT_RADIUS = 4 // Max pixels to drift from origin
const DRIFT_LERP = 0.012 // How fast to move toward destination (50% faster)
const ACTIVITY_DECAY = 0.97 // Exponential decay per frame
const ACTIVITY_MIN = 0.15 // Resting activity level
const FLOW_SPEED = 0.012 // How fast the dot travels

export class EdgeIndicatorRenderer {
  private container: Container
  private arrowGraphics: Graphics
  private vignetteGraphics: Graphics
  private cursorGraphics: Graphics

  // Persistent state for each indicator (keyed by id)
  private indicatorStates: Map<string, IndicatorState> = new Map()

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
   * Get or create persistent state for an indicator
   */
  private getOrCreateState(
    id: string,
    edgeX: number,
    edgeY: number,
    targetX: number,
    targetY: number
  ): IndicatorState {
    let state = this.indicatorStates.get(id)

    if (!state) {
      // Create new state with random initial drift destinations
      const edgeAngle = Math.random() * Math.PI * 2
      const targetAngle = Math.random() * Math.PI * 2

      state = {
        edgeDrawX: edgeX,
        edgeDrawY: edgeY,
        edgeDestX: edgeX + Math.cos(edgeAngle) * DRIFT_RADIUS,
        edgeDestY: edgeY + Math.sin(edgeAngle) * DRIFT_RADIUS,
        targetDrawX: targetX,
        targetDrawY: targetY,
        targetDestX: targetX + Math.cos(targetAngle) * DRIFT_RADIUS,
        targetDestY: targetY + Math.sin(targetAngle) * DRIFT_RADIUS,
        activity: 1.0, // Start fully active
        flowProgress: 0,
        flowDirection: 1,
        lastEdgeX: edgeX,
        lastEdgeY: edgeY,
        lastTargetX: targetX,
        lastTargetY: targetY,
      }
      this.indicatorStates.set(id, state)
    }

    return state
  }

  /**
   * Update organic state for an indicator
   */
  private updateIndicatorState(
    state: IndicatorState,
    edgeX: number,
    edgeY: number,
    targetX: number,
    targetY: number,
    reducedMotion: boolean
  ): void {
    // Detect position changes and boost activity
    const edgeMoved =
      Math.abs(edgeX - state.lastEdgeX) > 1 ||
      Math.abs(edgeY - state.lastEdgeY) > 1
    const targetMoved =
      Math.abs(targetX - state.lastTargetX) > 1 ||
      Math.abs(targetY - state.lastTargetY) > 1

    if (edgeMoved || targetMoved) {
      state.activity = Math.min(1.0, state.activity + 0.3)
    }

    state.lastEdgeX = edgeX
    state.lastEdgeY = edgeY
    state.lastTargetX = targetX
    state.lastTargetY = targetY

    if (reducedMotion) {
      // No animation - snap to positions
      state.edgeDrawX = edgeX
      state.edgeDrawY = edgeY
      state.targetDrawX = targetX
      state.targetDrawY = targetY
      state.activity = ACTIVITY_MIN
      return
    }

    // Update drift destinations when close
    const edgeDist = Math.hypot(
      state.edgeDestX - state.edgeDrawX,
      state.edgeDestY - state.edgeDrawY
    )
    if (edgeDist < 1) {
      const angle = Math.random() * Math.PI * 2
      state.edgeDestX = edgeX + Math.cos(angle) * DRIFT_RADIUS
      state.edgeDestY = edgeY + Math.sin(angle) * DRIFT_RADIUS
    }

    const targetDist = Math.hypot(
      state.targetDestX - state.targetDrawX,
      state.targetDestY - state.targetDrawY
    )
    if (targetDist < 1) {
      const angle = Math.random() * Math.PI * 2
      state.targetDestX = targetX + Math.cos(angle) * DRIFT_RADIUS
      state.targetDestY = targetY + Math.sin(angle) * DRIFT_RADIUS
    }

    // Calculate distance from actual positions - use faster lerp when far off
    const edgeDistFromActual = Math.hypot(
      state.edgeDrawX - edgeX,
      state.edgeDrawY - edgeY
    )
    const targetDistFromActual = Math.hypot(
      state.targetDrawX - targetX,
      state.targetDrawY - targetY
    )

    // Adaptive lerp: base speed + catchup factor based on distance
    const edgeCatchup = Math.min(1, edgeDistFromActual / 100)
    const targetCatchup = Math.min(1, targetDistFromActual / 100)
    const edgeLerp = DRIFT_LERP + edgeCatchup * 0.15
    const targetLerp = DRIFT_LERP + targetCatchup * 0.15

    // Lerp toward drift destinations
    state.edgeDrawX += (state.edgeDestX - state.edgeDrawX) * edgeLerp
    state.edgeDrawY += (state.edgeDestY - state.edgeDrawY) * edgeLerp
    state.targetDrawX += (state.targetDestX - state.targetDrawX) * targetLerp
    state.targetDrawY += (state.targetDestY - state.targetDrawY) * targetLerp

    // Also lerp destinations toward actual positions (so drift follows target)
    // Use same adaptive speed so destinations track quickly when needed
    state.edgeDestX += (edgeX - state.edgeDestX) * (0.03 + edgeCatchup * 0.2)
    state.edgeDestY += (edgeY - state.edgeDestY) * (0.03 + edgeCatchup * 0.2)
    state.targetDestX +=
      (targetX - state.targetDestX) * (0.03 + targetCatchup * 0.2)
    state.targetDestY +=
      (targetY - state.targetDestY) * (0.03 + targetCatchup * 0.2)

    // Decay activity toward minimum
    state.activity = Math.max(ACTIVITY_MIN, state.activity * ACTIVITY_DECAY)

    // Update flow dot position
    state.flowProgress += FLOW_SPEED * state.flowDirection
    if (state.flowProgress >= 1) {
      state.flowProgress = 1
      state.flowDirection = -1
    } else if (state.flowProgress <= 0) {
      state.flowProgress = 0
      state.flowDirection = 1
    }
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

    // Track which indicators are still active (for pruning old states)
    const activeIds = new Set<string>()

    // Draw vignettes
    this.drawVignettes(vignettes, screenWidth, screenHeight)

    // Draw indicators
    for (const indicator of indicators) {
      activeIds.add(indicator.id)
      this.drawEdgeArrow(indicator, screenWidth, screenHeight, now)
    }

    // Prune states for indicators that no longer exist
    for (const id of this.indicatorStates.keys()) {
      if (!activeIds.has(id)) {
        this.indicatorStates.delete(id)
      }
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
   *
   * Uses organic movement system inspired by Alkahistorian:
   * - Endpoints drift/wobble around their targets
   * - Activity decays exponentially (breathing effect)
   * - Flow dot travels along the line
   * - Logarithmic line width scaling
   * - Multi-layer glow effects
   */
  private drawEdgeArrow(
    indicator: EdgeIndicator,
    screenWidth: number,
    screenHeight: number,
    _now: number
  ): void {
    const reducedMotion = prefersReducedMotion()

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
      const stopRadius = indicator.targetRadius ?? 35
      const targetX = centerX - Math.cos(angle) * stopRadius
      const targetY = centerY - Math.sin(angle) * stopRadius

      // Get/create organic state for this indicator
      const state = this.getOrCreateState(
        indicator.id,
        edgeX,
        edgeY,
        targetX,
        targetY
      )
      this.updateIndicatorState(
        state,
        edgeX,
        edgeY,
        targetX,
        targetY,
        reducedMotion
      )

      // Use organic positions, but clamp edge to screen boundary
      // Determine which edge we're anchored to and only allow drift along it
      let drawEdgeX = state.edgeDrawX
      let drawEdgeY = state.edgeDrawY
      const drawTargetX = state.targetDrawX
      const drawTargetY = state.targetDrawY

      // Clamp to edge - keep tail connected to screen boundary
      if (edgeX <= 1) {
        // Left edge - lock X, allow Y drift
        drawEdgeX = 0
      } else if (edgeX >= screenWidth - 1) {
        // Right edge - lock X, allow Y drift
        drawEdgeX = screenWidth
      }
      if (edgeY <= 1) {
        // Top edge - lock Y, allow X drift
        drawEdgeY = 0
      } else if (edgeY >= screenHeight - 1) {
        // Bottom edge - lock Y, allow X drift
        drawEdgeY = screenHeight
      }

      // Calculate alpha and line width based on activity (logarithmic feel)
      const activity = state.activity
      const baseAlpha = 0.5 + activity * 0.4 // 0.5 at rest, 0.9 at full
      const baseWidth = 0.8 + Math.log10(1 + activity * 9) * 1.2 // ~0.8-2.0

      // Draw multi-layer glow (outer to inner)
      // Layer 1: Outer glow (very soft, wide)
      this.arrowGraphics.moveTo(drawEdgeX, drawEdgeY)
      this.arrowGraphics.lineTo(drawTargetX, drawTargetY)
      this.arrowGraphics.stroke({
        color: indicator.color,
        alpha: baseAlpha * 0.08,
        width: baseWidth * 8,
      })

      // Layer 2: Mid glow
      this.arrowGraphics.moveTo(drawEdgeX, drawEdgeY)
      this.arrowGraphics.lineTo(drawTargetX, drawTargetY)
      this.arrowGraphics.stroke({
        color: indicator.color,
        alpha: baseAlpha * 0.15,
        width: baseWidth * 4,
      })

      // Layer 3: Inner glow
      this.arrowGraphics.moveTo(drawEdgeX, drawEdgeY)
      this.arrowGraphics.lineTo(drawTargetX, drawTargetY)
      this.arrowGraphics.stroke({
        color: indicator.color,
        alpha: baseAlpha * 0.4,
        width: baseWidth * 2,
      })

      // Layer 4: Core line
      this.arrowGraphics.moveTo(drawEdgeX, drawEdgeY)
      this.arrowGraphics.lineTo(drawTargetX, drawTargetY)
      this.arrowGraphics.stroke({
        color: indicator.color,
        alpha: baseAlpha * 0.9,
        width: baseWidth,
      })

      // Draw traveling flow dot
      if (!reducedMotion) {
        const flowX = drawEdgeX + (drawTargetX - drawEdgeX) * state.flowProgress
        const flowY = drawEdgeY + (drawTargetY - drawEdgeY) * state.flowProgress
        const dotRadius = baseWidth * 1.5 + 1.5

        // Dot glow
        this.arrowGraphics.circle(flowX, flowY, dotRadius * 2)
        this.arrowGraphics.fill({
          color: indicator.color,
          alpha: baseAlpha * 0.3,
        })

        // Dot core
        this.arrowGraphics.circle(flowX, flowY, dotRadius)
        this.arrowGraphics.fill({
          color: indicator.color,
          alpha: baseAlpha * 0.9,
        })
      }

      // Arrow head at the target end
      const drawAngle = Math.atan2(
        drawTargetY - drawEdgeY,
        drawTargetX - drawEdgeX
      )
      const arrowSize = 24 + activity * 12 // 3x larger for visibility
      const arrowAngle = Math.PI / 6

      const tipX = drawTargetX
      const tipY = drawTargetY
      const leftX = tipX - arrowSize * Math.cos(drawAngle - arrowAngle)
      const leftY = tipY - arrowSize * Math.sin(drawAngle - arrowAngle)
      const rightX = tipX - arrowSize * Math.cos(drawAngle + arrowAngle)
      const rightY = tipY - arrowSize * Math.sin(drawAngle + arrowAngle)

      // Arrow glow
      this.arrowGraphics.moveTo(tipX, tipY)
      this.arrowGraphics.lineTo(leftX, leftY)
      this.arrowGraphics.lineTo(rightX, rightY)
      this.arrowGraphics.closePath()
      this.arrowGraphics.fill({
        color: indicator.color,
        alpha: baseAlpha * 0.3,
      })

      // Slightly smaller solid arrow
      const innerSize = arrowSize * 0.8
      const innerLeftX = tipX - innerSize * Math.cos(drawAngle - arrowAngle)
      const innerLeftY = tipY - innerSize * Math.sin(drawAngle - arrowAngle)
      const innerRightX = tipX - innerSize * Math.cos(drawAngle + arrowAngle)
      const innerRightY = tipY - innerSize * Math.sin(drawAngle + arrowAngle)

      this.arrowGraphics.moveTo(tipX, tipY)
      this.arrowGraphics.lineTo(innerLeftX, innerLeftY)
      this.arrowGraphics.lineTo(innerRightX, innerRightY)
      this.arrowGraphics.closePath()
      this.arrowGraphics.fill({
        color: indicator.color,
        alpha: baseAlpha * 0.9,
      })

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

    // Get/create organic state for edge arrows too
    const state = this.getOrCreateState(
      indicator.id,
      arrowX,
      arrowY,
      screenPos.x,
      screenPos.y
    )
    this.updateIndicatorState(
      state,
      arrowX,
      arrowY,
      screenPos.x,
      screenPos.y,
      reducedMotion
    )

    const drawArrowX = state.edgeDrawX
    const drawArrowY = state.edgeDrawY
    const activity = state.activity

    // Calculate angle from arrow position to target
    const angle = Math.atan2(
      state.targetDrawY - drawArrowY,
      state.targetDrawX - drawArrowX
    )
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    // Size scales slightly with activity
    const size = indicator.size * (0.9 + activity * 0.15)
    const alpha = 0.6 + activity * 0.35

    // Helper to rotate and translate a point
    const transform = (x: number, y: number) => ({
      x: drawArrowX + x * cos - y * sin,
      y: drawArrowY + x * sin + y * cos,
    })

    // Arrow shape vertices (pointing right, will be rotated)
    const tip = transform(size * 0.6, 0)
    const backTop = transform(-size * 0.4, -size * 0.5)
    const notch = transform(-size * 0.2, 0)
    const backBottom = transform(-size * 0.4, size * 0.5)

    // Outer glow
    this.arrowGraphics.circle(drawArrowX, drawArrowY, size * 1.2)
    this.arrowGraphics.fill({ color: indicator.color, alpha: alpha * 0.1 })

    // Inner glow
    this.arrowGraphics.circle(drawArrowX, drawArrowY, size * 0.8)
    this.arrowGraphics.fill({ color: indicator.color, alpha: alpha * 0.2 })

    // Draw arrow
    this.arrowGraphics.moveTo(tip.x, tip.y)
    this.arrowGraphics.lineTo(backTop.x, backTop.y)
    this.arrowGraphics.lineTo(notch.x, notch.y)
    this.arrowGraphics.lineTo(backBottom.x, backBottom.y)
    this.arrowGraphics.closePath()
    this.arrowGraphics.fill({ color: indicator.color, alpha })
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
