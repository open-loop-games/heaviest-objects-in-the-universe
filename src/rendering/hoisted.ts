// Hoisted dependency rendering
// Renders the small orbit nodes around root that represent hoisted/shared dependencies

import { Graphics, Container } from 'pixi.js'
import type { HoistedDep } from '../game/types'
import { prefersReducedMotion } from './accessibility'
import { drawProceduralIcon } from './icons'
import { getHoistLayoutInfo } from '../game/hoisting'

interface HoistedContainer {
  container: Container
  shape: Graphics
  // Track target angle for redistribution animation
  targetAngle?: number
  currentAngle?: number
  angleAnimStartTime?: number
}

interface HoistAnimation {
  startTime: number
  fromX: number
  fromY: number
  toX: number
  toY: number
  duration: number
  delay: number // Stagger delay for batch hoists
  arcHeight: number // Height of the arc trajectory
}

interface LandingRipple {
  startTime: number
  x: number
  y: number
  duration: number
  color: number
}

// Store landing ripples for rendering
const landingRipples: LandingRipple[] = []
const RIPPLE_DURATION = 600

// Redistribution animation duration
const REDISTRIBUTE_DURATION = 300

export class HoistedRenderer {
  private parentContainer: Container
  private hoistedContainers: Map<string, HoistedContainer> = new Map()
  private hoistAnimations: Map<string, HoistAnimation> = new Map()
  private dropZoneGraphics: Graphics | null = null
  private ephemeralLinesGraphics: Graphics | null = null
  private rippleGraphics: Graphics | null = null
  private hoveredHoistedId: string | null = null

  constructor(parentContainer: Container) {
    this.parentContainer = parentContainer
  }

  /**
   * Start a hoist animation from source position to ring position
   * Supports staggered delays and arc trajectories
   */
  startHoistAnimation(
    hoistedId: string,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    delay: number = 0
  ): void {
    // Calculate arc height based on distance (more dramatic for longer distances)
    const dx = toX - fromX
    const dy = toY - fromY
    const distance = Math.sqrt(dx * dx + dy * dy)
    const arcHeight = Math.min(80, Math.max(40, distance * 0.3))

    this.hoistAnimations.set(hoistedId, {
      startTime: Date.now(),
      fromX,
      fromY,
      toX,
      toY,
      duration: 500, // 500ms animation (slightly longer for arc)
      delay,
      arcHeight,
    })
  }

  /**
   * Start batch hoist animations with staggered timing
   * Each source position gets its own arc animation converging on the target
   */
  startBatchHoistAnimation(
    hoistedId: string,
    sourcePositions: { x: number; y: number }[],
    targetX: number,
    targetY: number,
    baseDelay: number = 0
  ): void {
    // Use the first source position for the main animation
    // Additional sources could spawn particle trails (future enhancement)
    if (sourcePositions.length === 0) return

    // Calculate average source position for a more centered arc
    const avgX =
      sourcePositions.reduce((sum, p) => sum + p.x, 0) / sourcePositions.length
    const avgY =
      sourcePositions.reduce((sum, p) => sum + p.y, 0) / sourcePositions.length

    this.startHoistAnimation(hoistedId, avgX, avgY, targetX, targetY, baseDelay)
  }

  /**
   * Trigger redistribution animation for existing hoisted deps
   * Called when new deps are added and positions need to shuffle
   */
  triggerRedistributionAnimation(
    hoistedDeps: Map<string, { orbitAngle: number }>
  ): void {
    const now = Date.now()

    for (const [id, dep] of hoistedDeps) {
      const container = this.hoistedContainers.get(id)
      if (!container) continue

      // If this dep doesn't have an angle yet, initialize it
      if (container.currentAngle === undefined) {
        container.currentAngle = dep.orbitAngle
        container.targetAngle = dep.orbitAngle
      } else if (container.targetAngle !== dep.orbitAngle) {
        // Angle changed - start animation from current to new
        container.currentAngle = this.getAnimatedAngle(container, now)
        container.targetAngle = dep.orbitAngle
        container.angleAnimStartTime = now
      }
    }
  }

  /**
   * Get the current animated angle for a container
   */
  private getAnimatedAngle(container: HoistedContainer, now: number): number {
    if (
      container.angleAnimStartTime === undefined ||
      container.currentAngle === undefined ||
      container.targetAngle === undefined
    ) {
      return container.targetAngle ?? 0
    }

    const elapsed = now - container.angleAnimStartTime
    const t = Math.min(1, elapsed / REDISTRIBUTE_DURATION)
    // Ease out cubic
    const eased = 1 - Math.pow(1 - t, 3)

    // Handle angle wrapping (shortest path)
    let delta = container.targetAngle - container.currentAngle
    if (delta > Math.PI) delta -= Math.PI * 2
    if (delta < -Math.PI) delta += Math.PI * 2

    return container.currentAngle + delta * eased
  }

  /**
   * Spawn a landing ripple effect
   */
  spawnLandingRipple(x: number, y: number, color: number = 0x8b5cf6): void {
    landingRipples.push({
      startTime: Date.now(),
      x,
      y,
      duration: RIPPLE_DURATION,
      color,
    })
  }

  /**
   * Update and render landing ripples
   */
  private updateRipples(): void {
    if (!this.rippleGraphics) {
      this.rippleGraphics = new Graphics()
      this.rippleGraphics.label = 'landing-ripples'
      this.parentContainer.addChildAt(this.rippleGraphics, 0)
    }

    this.rippleGraphics.clear()

    const now = Date.now()
    const reducedMotion = prefersReducedMotion()

    // Update and draw active ripples
    for (let i = landingRipples.length - 1; i >= 0; i--) {
      const ripple = landingRipples[i]!
      const elapsed = now - ripple.startTime
      const progress = elapsed / ripple.duration

      if (progress >= 1) {
        landingRipples.splice(i, 1)
        continue
      }

      // Skip animation if reduced motion
      if (reducedMotion) continue

      // Expand outward, fade out
      const maxRadius = 50
      const radius = progress * maxRadius
      const alpha = (1 - progress) * 0.6

      // Main ripple ring
      this.rippleGraphics.circle(ripple.x, ripple.y, radius)
      this.rippleGraphics.stroke({
        color: ripple.color,
        width: 3 * (1 - progress),
        alpha,
      })

      // Inner flash (fades faster)
      if (progress < 0.3) {
        const flashAlpha = (1 - progress / 0.3) * 0.4
        this.rippleGraphics.circle(ripple.x, ripple.y, radius * 0.5)
        this.rippleGraphics.fill({ color: ripple.color, alpha: flashAlpha })
      }
    }
  }

  /**
   * Update or create graphics for a hoisted dep (small orbit around root)
   */
  updateHoistedDep(hoisted: HoistedDep): void {
    // Update ripples first (always runs)
    this.updateRipples()

    let data = this.hoistedContainers.get(hoisted.id)

    if (!data) {
      const container = new Container()
      container.label = `hoisted-${hoisted.id}`
      container.eventMode = 'static'
      container.cursor = 'pointer'

      const shape = new Graphics()
      shape.label = 'shape'
      container.addChild(shape)

      data = {
        container,
        shape,
        targetAngle: hoisted.orbitAngle,
        currentAngle: hoisted.orbitAngle,
      }
      this.hoistedContainers.set(hoisted.id, data)
      this.parentContainer.addChild(container)
    }

    // Update angle tracking for redistribution animation
    if (data.targetAngle !== hoisted.orbitAngle) {
      const now = Date.now()
      data.currentAngle = this.getAnimatedAngle(data, now)
      data.targetAngle = hoisted.orbitAngle
      data.angleAnimStartTime = now
    }

    // Check for active animation
    const anim = this.hoistAnimations.get(hoisted.id)
    let animProgress = 1
    let currentX = hoisted.position.x
    let currentY = hoisted.position.y
    let animScale = 1

    if (anim) {
      const now = Date.now()
      const timeSinceStart = now - anim.startTime

      // Handle stagger delay
      if (timeSinceStart < anim.delay) {
        // Still waiting - hide the container
        data.container.visible = false
        return
      }

      data.container.visible = true
      const elapsed = timeSinceStart - anim.delay
      const t = Math.min(1, elapsed / anim.duration)

      // Ease out cubic for smooth deceleration
      animProgress = 1 - Math.pow(1 - t, 3)

      // Calculate arc trajectory
      // Linear interpolation for X
      currentX = anim.fromX + (anim.toX - anim.fromX) * animProgress

      // Y follows a parabolic arc (rises then falls)
      const linearY = anim.fromY + (anim.toY - anim.fromY) * animProgress
      // Arc offset: sin curve peaks at t=0.5, creates upward bulge
      const arcOffset = -anim.arcHeight * Math.sin(animProgress * Math.PI)
      currentY = linearY + arcOffset

      // Scale up during animation (pop effect with slight overshoot)
      const scaleEase = 1 - Math.pow(1 - animProgress, 2)
      animScale =
        0.2 + 0.8 * scaleEase + 0.15 * Math.sin(animProgress * Math.PI)

      // Clean up completed animation and spawn landing ripple
      if (t >= 1) {
        this.hoistAnimations.delete(hoisted.id)
        // Spawn landing ripple at final position
        this.spawnLandingRipple(anim.toX, anim.toY)
      }
    } else {
      data.container.visible = true

      // Apply redistribution animation (slide around ring)
      const now = Date.now()
      if (
        data.angleAnimStartTime !== undefined &&
        data.currentAngle !== undefined &&
        data.targetAngle !== undefined
      ) {
        const animAngle = this.getAnimatedAngle(data, now)

        // Recalculate position using animated angle
        // We need to find the ring radius and root position
        const layout = getHoistLayoutInfo()
        const radius =
          hoisted.ringIndex === 0 ? layout.innerRadius : layout.outerRadius

        // Extract root position from the hoisted dep's position and angle
        // hoisted.position = root + (cos, sin) * radius at target angle
        // So root = hoisted.position - (cos, sin) * radius at target angle
        const rootX = hoisted.position.x - Math.cos(hoisted.orbitAngle) * radius
        const rootY = hoisted.position.y - Math.sin(hoisted.orbitAngle) * radius

        // Now calculate position at animated angle
        currentX = rootX + Math.cos(animAngle) * radius
        currentY = rootY + Math.sin(animAngle) * radius

        // Clear animation when complete
        const elapsed = now - data.angleAnimStartTime
        if (elapsed >= REDISTRIBUTE_DURATION) {
          data.currentAngle = data.targetAngle
          data.angleAnimStartTime = undefined
        }
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
      this.ephemeralLinesGraphics.fill({
        color: lineColor,
        alpha: lineAlpha * 0.5,
      })
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
    this.dropZoneGraphics.stroke({
      color: 0x8b5cf6,
      width: 2,
      alpha: baseAlpha * 0.5,
    })

    // Inner target ring (where dep will land)
    const innerAlpha = baseAlpha + pulse * 0.2
    this.dropZoneGraphics.circle(0, 0, innerRadius)
    this.dropZoneGraphics.stroke({
      color: 0x8b5cf6,
      width: 3,
      alpha: innerAlpha,
    })

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
      this.dropZoneGraphics.stroke({
        color: 0x8b5cf6,
        width: 2,
        alpha: baseAlpha,
      })

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
      this.dropZoneGraphics.stroke({
        color: 0x8b5cf6,
        width: 2,
        alpha: baseAlpha,
      })
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
    landingRipples.length = 0

    if (this.dropZoneGraphics) {
      this.dropZoneGraphics.destroy()
      this.dropZoneGraphics = null
    }

    if (this.rippleGraphics) {
      this.rippleGraphics.destroy()
      this.rippleGraphics = null
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
