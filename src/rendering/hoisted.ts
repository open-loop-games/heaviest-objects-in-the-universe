// Hoisted dependency rendering
// Renders the small orbit nodes around root that represent hoisted/shared dependencies

import { Graphics, Container, type Application } from 'pixi.js'
import type { HoistedDep } from '../game/types'
import { prefersReducedMotion } from './accessibility'
import { drawProceduralIcon } from './icons'
import { getHoistLayoutInfo } from '../game/hoisting'

interface HoistedContainer {
  container: Container
  shape: Graphics
}

interface HoistAnimation {
  startTime: number
  fromX: number
  fromY: number
  toX: number
  toY: number
  duration: number
}

export class HoistedRenderer {
  private app: Application
  private parentContainer: Container
  private hoistedContainers: Map<string, HoistedContainer> = new Map()
  private hoistAnimations: Map<string, HoistAnimation> = new Map()
  private dropZoneGraphics: Graphics | null = null
  private ephemeralLinesGraphics: Graphics | null = null
  private hoveredHoistedId: string | null = null

  constructor(app: Application, parentContainer: Container) {
    this.app = app
    this.parentContainer = parentContainer
  }

  /**
   * Start a hoist animation from source position to ring position
   */
  startHoistAnimation(
    hoistedId: string,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ): void {
    this.hoistAnimations.set(hoistedId, {
      startTime: Date.now(),
      fromX,
      fromY,
      toX,
      toY,
      duration: 400, // 400ms animation
    })
  }

  /**
   * Update or create graphics for a hoisted dep (small orbit around root)
   */
  updateHoistedDep(hoisted: HoistedDep): void {
    let data = this.hoistedContainers.get(hoisted.id)

    if (!data) {
      const container = new Container()
      container.label = `hoisted-${hoisted.id}`
      container.eventMode = 'static'
      container.cursor = 'pointer'

      const shape = new Graphics()
      shape.label = 'shape'
      container.addChild(shape)

      data = { container, shape }
      this.hoistedContainers.set(hoisted.id, data)
      this.parentContainer.addChild(container)
    }

    // Check for active animation
    const anim = this.hoistAnimations.get(hoisted.id)
    let animProgress = 1
    let currentX = hoisted.position.x
    let currentY = hoisted.position.y
    let animScale = 1

    if (anim) {
      const elapsed = Date.now() - anim.startTime
      const t = Math.min(1, elapsed / anim.duration)
      // Ease out cubic for smooth deceleration
      animProgress = 1 - Math.pow(1 - t, 3)

      // Interpolate position
      currentX = anim.fromX + (anim.toX - anim.fromX) * animProgress
      currentY = anim.fromY + (anim.toY - anim.fromY) * animProgress

      // Scale up during animation (pop effect)
      animScale = 0.3 + 0.7 * animProgress + 0.2 * Math.sin(animProgress * Math.PI)

      // Clean up completed animation
      if (t >= 1) {
        this.hoistAnimations.delete(hoisted.id)
      }
    }

    // Get layout scale (shrinks when many deps are hoisted)
    const layout = getHoistLayoutInfo()
    const finalScale = animScale * layout.scale

    this.drawHoistedDep(data.shape, hoisted, animProgress)
    data.container.x = currentX
    data.container.y = currentY
    data.container.scale.set(finalScale)
  }

  /**
   * Draw a hoisted dep's graphics (smaller, glowing, infrastructure feel)
   */
  private drawHoistedDep(
    graphics: Graphics,
    hoisted: HoistedDep,
    animProgress: number = 1
  ): void {
    graphics.clear()

    const radius = 18 // Smaller than regular packages
    const reducedMotion = prefersReducedMotion()
    const time = Date.now() * 0.002
    const breathe = reducedMotion ? 0.5 : (Math.sin(time) + 1) / 2

    // Extra glow during animation
    const animGlow = animProgress < 1 ? (1 - animProgress) * 0.5 : 0

    // Soft infrastructure glow
    const glowColor = 0x8b5cf6 // Purple for "hoisted/shared"
    const glowAlpha = 0.2 + breathe * 0.1 + animGlow
    const glowRadius = radius + 6 + animGlow * 10
    graphics.circle(0, 0, glowRadius)
    graphics.fill({ color: glowColor, alpha: glowAlpha })

    // Outer ring (shows "shared" status)
    graphics.circle(0, 0, radius + 3)
    graphics.stroke({
      color: glowColor,
      width: 2 + animGlow * 2,
      alpha: 0.5 + breathe * 0.2 + animGlow,
    })

    // Main circle (darker fill)
    graphics.circle(0, 0, radius)
    graphics.fill({ color: 0x1e1e3a })
    graphics.stroke({ color: glowColor, width: 2, alpha: 0.8 })

    // Inner icon placeholder (smaller procedural icon)
    drawProceduralIcon(
      graphics,
      hoisted.identity.name,
      radius * 1.2,
      hoisted.identity.archetype
    )

    // Source count indicator (small dots around edge) - only show when animation complete
    if (animProgress >= 1) {
      const sourceCount = hoisted.sourcePackages.length
      const dotRadius = 3
      for (let i = 0; i < Math.min(sourceCount, 6); i++) {
        const angle = (Math.PI * 2 * i) / Math.max(sourceCount, 3) - Math.PI / 2
        const x = Math.cos(angle) * (radius + 8)
        const y = Math.sin(angle) * (radius + 8)
        graphics.circle(x, y, dotRadius)
        graphics.fill({ color: 0x4ade80, alpha: 0.7 })
      }
    }
  }

  /**
   * Remove a hoisted dep's graphics
   */
  removeHoistedDep(id: string): void {
    const data = this.hoistedContainers.get(id)
    if (data) {
      this.parentContainer.removeChild(data.container)
      data.shape.destroy()
      data.container.destroy()
      this.hoistedContainers.delete(id)
    }
  }

  /**
   * Get hoisted dep container for hit testing
   */
  getHoistedDepGraphics(id: string): Container | undefined {
    return this.hoistedContainers.get(id)?.container
  }

  /**
   * Get all hoisted dep IDs (for cleanup)
   */
  getAllHoistedDepIds(): Set<string> {
    return new Set(this.hoistedContainers.keys())
  }

  /**
   * Set which hoisted dep is being hovered (for ephemeral lines)
   */
  setHoveredHoistedDep(hoistedId: string | null): void {
    this.hoveredHoistedId = hoistedId
  }

  /**
   * Get the currently hovered hoisted dep ID
   */
  getHoveredHoistedId(): string | null {
    return this.hoveredHoistedId
  }

  /**
   * Draw ephemeral lines from hovered hoisted dep to source packages
   */
  drawEphemeralLines(
    hoisted: HoistedDep | null,
    sourcePositions: { x: number; y: number }[]
  ): void {
    if (!this.ephemeralLinesGraphics) {
      this.ephemeralLinesGraphics = new Graphics()
      this.ephemeralLinesGraphics.label = 'ephemeral-lines'
      this.parentContainer.addChildAt(this.ephemeralLinesGraphics, 0) // Behind nodes
    }

    this.ephemeralLinesGraphics.clear()

    if (!hoisted || sourcePositions.length === 0) {
      return
    }

    const reducedMotion = prefersReducedMotion()
    const time = Date.now() * 0.003
    const pulse = reducedMotion ? 0.5 : (Math.sin(time) + 1) / 2

    const lineColor = 0x8b5cf6 // Purple
    const lineAlpha = 0.3 + pulse * 0.2

    // Draw dashed lines to each source
    for (const source of sourcePositions) {
      this.drawDashedLine(
        this.ephemeralLinesGraphics,
        hoisted.position.x,
        hoisted.position.y,
        source.x,
        source.y,
        lineColor,
        2,
        lineAlpha
      )

      // Small glow at source end
      this.ephemeralLinesGraphics.circle(source.x, source.y, 6)
      this.ephemeralLinesGraphics.fill({ color: lineColor, alpha: lineAlpha * 0.5 })
    }
  }

  /**
   * Draw a dashed line between two points
   */
  private drawDashedLine(
    graphics: Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: number,
    width: number,
    alpha: number
  ): void {
    const dx = x2 - x1
    const dy = y2 - y1
    const distance = Math.sqrt(dx * dx + dy * dy)
    const dashLength = 8
    const gapLength = 6
    const segmentLength = dashLength + gapLength
    const numSegments = Math.floor(distance / segmentLength)

    const ux = dx / distance
    const uy = dy / distance

    for (let i = 0; i < numSegments; i++) {
      const startX = x1 + ux * i * segmentLength
      const startY = y1 + uy * i * segmentLength
      const endX = startX + ux * dashLength
      const endY = startY + uy * dashLength

      graphics.moveTo(startX, startY)
      graphics.lineTo(endX, endY)
      graphics.stroke({ color, width, alpha })
    }

    // Draw remaining partial segment
    const remaining = distance - numSegments * segmentLength
    if (remaining > 0) {
      const startX = x1 + ux * numSegments * segmentLength
      const startY = y1 + uy * numSegments * segmentLength
      const endX = startX + ux * Math.min(remaining, dashLength)
      const endY = startY + uy * Math.min(remaining, dashLength)

      graphics.moveTo(startX, startY)
      graphics.lineTo(endX, endY)
      graphics.stroke({ color, width, alpha })
    }
  }

  // ============================================
  // DROP ZONE RENDERING
  // ============================================

  /**
   * Update drop zone visual (ring around root for hoisting)
   */
  updateDropZone(
    rootPosition: { x: number; y: number },
    active: boolean,
    proximity: number
  ): void {
    if (!this.dropZoneGraphics) {
      this.dropZoneGraphics = new Graphics()
      this.dropZoneGraphics.label = 'drop-zone'
      this.parentContainer.addChildAt(this.dropZoneGraphics, 0) // Behind nodes
    }

    this.dropZoneGraphics.clear()

    if (!active) {
      this.dropZoneGraphics.visible = false
      return
    }

    this.dropZoneGraphics.visible = true
    this.dropZoneGraphics.x = rootPosition.x
    this.dropZoneGraphics.y = rootPosition.y

    const reducedMotion = prefersReducedMotion()
    const time = Date.now() * 0.003
    const pulse = reducedMotion ? 0.5 : (Math.sin(time) + 1) / 2

    // Inner ring radius (where hoisted deps go)
    const innerRadius = 60
    // Outer ring radius (activation zone)
    const outerRadius = 100

    // Proximity affects visibility (closer = more visible)
    const proximityFactor = Math.max(0, 1 - proximity / outerRadius)
    const baseAlpha = 0.2 + proximityFactor * 0.4

    // Outer detection zone (faint ring)
    this.dropZoneGraphics.circle(0, 0, outerRadius)
    this.dropZoneGraphics.stroke({ color: 0x8b5cf6, width: 2, alpha: baseAlpha * 0.5 })

    // Inner target ring (where dep will land)
    const innerAlpha = baseAlpha + pulse * 0.2
    this.dropZoneGraphics.circle(0, 0, innerRadius)
    this.dropZoneGraphics.stroke({ color: 0x8b5cf6, width: 3, alpha: innerAlpha })

    // Pulsing fill for inner zone
    this.dropZoneGraphics.circle(0, 0, innerRadius)
    this.dropZoneGraphics.fill({ color: 0x8b5cf6, alpha: innerAlpha * 0.15 })

    // "Hoist" arrow indicators pointing inward
    const arrowCount = 4
    for (let i = 0; i < arrowCount; i++) {
      const angle = (Math.PI * 2 * i) / arrowCount
      const outerX = Math.cos(angle) * (outerRadius - 10)
      const outerY = Math.sin(angle) * (outerRadius - 10)
      const innerX = Math.cos(angle) * (innerRadius + 10)
      const innerY = Math.sin(angle) * (innerRadius + 10)

      // Arrow line
      this.dropZoneGraphics.moveTo(outerX, outerY)
      this.dropZoneGraphics.lineTo(innerX, innerY)
      this.dropZoneGraphics.stroke({ color: 0x8b5cf6, width: 2, alpha: baseAlpha })

      // Arrow head
      const headAngle = angle + Math.PI
      const headX1 = innerX + Math.cos(headAngle - 0.4) * 8
      const headY1 = innerY + Math.sin(headAngle - 0.4) * 8
      const headX2 = innerX + Math.cos(headAngle + 0.4) * 8
      const headY2 = innerY + Math.sin(headAngle + 0.4) * 8

      this.dropZoneGraphics.moveTo(innerX, innerY)
      this.dropZoneGraphics.lineTo(headX1, headY1)
      this.dropZoneGraphics.moveTo(innerX, innerY)
      this.dropZoneGraphics.lineTo(headX2, headY2)
      this.dropZoneGraphics.stroke({ color: 0x8b5cf6, width: 2, alpha: baseAlpha })
    }
  }

  /**
   * Hide drop zone
   */
  hideDropZone(): void {
    if (this.dropZoneGraphics) {
      this.dropZoneGraphics.visible = false
    }
  }

  /**
   * Clear all hoisted deps (for prestige)
   */
  clear(): void {
    for (const data of this.hoistedContainers.values()) {
      data.shape.destroy()
      data.container.destroy()
    }
    this.hoistedContainers.clear()
    this.hoistAnimations.clear()

    if (this.dropZoneGraphics) {
      this.dropZoneGraphics.destroy()
      this.dropZoneGraphics = null
    }

    if (this.ephemeralLinesGraphics) {
      this.ephemeralLinesGraphics.destroy()
      this.ephemeralLinesGraphics = null
    }
  }

  /**
   * Set visibility of all hoisted deps (hide when not at root scope)
   */
  setVisible(visible: boolean): void {
    for (const data of this.hoistedContainers.values()) {
      data.container.visible = visible
    }
  }
}
