// Black hole and gravity effects renderer for prestige visualization

import { Graphics, Container, type Application } from 'pixi.js'
import { Colors } from './colors'
import {
  gameState,
  computed_gravity,
  startCollapse as startCollapseState,
  endCollapse as endCollapseState,
  collapseState,
} from '../game/state'
import { updateCollapsePhysics, getCollapseProgress } from '../game/physics'

// Gravity stages based on weight progress toward prestige
const GRAVITY_STAGES = {
  NONE: 0,
  WARP_START: 0.1, // 10% - subtle background warping
  DRIFT: 0.25, // 25% - nodes drift toward center
  PULL_VISIBLE: 0.5, // 50% - visible gravity field lines
  CORE_VISIBLE: 0.75, // 75% - black hole core appears
  PRESTIGE_NEAR: 0.8, // 80% - vignette and ambient particles toward prestige
  COLLAPSE_IMMINENT: 0.9, // 90% - intense effects, screen shake
}

interface GravityLine {
  angle: number
  speed: number
  offset: number
}

// Shockwave ring expanding from target
interface ShockwaveRing {
  progress: number // 0 to 1
  startTime: number
}

// Ambient particles streaming toward prestige panel
interface AmbientParticle {
  x: number
  y: number
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  progress: number
  speed: number
  color: number
  size: number
}

export class BlackHoleRenderer {
  private container: Container
  private backgroundContainer: Container
  private coreContainer: Container
  private overlayContainer: Container // Renders on top of everything

  private warpGraphics: Graphics
  private fieldGraphics: Graphics
  private coreGraphics: Graphics
  private collapseGraphics: Graphics
  private vignetteGraphics: Graphics
  private ambientGraphics: Graphics

  private gravityLines: GravityLine[] = []
  private phase = 0

  // Collapse animation state
  private isCollapsing = false
  private collapseProgress = 0
  private shockwaveRings: ShockwaveRing[] = []
  private onCollapseComplete: (() => void) | null = null

  // Burst phase (after collapse, before new root spawns)
  private isBursting = false
  private burstProgress = 0
  private burstStartTime = 0
  private readonly BURST_DURATION = 0.8 // seconds

  // Screen shake
  private shakeIntensity = 0
  private shakeOffset = { x: 0, y: 0 }

  // Prestige panel target position (screen coordinates)
  private prestigeTargetX = 0
  private prestigeTargetY = 0

  // Ambient particles streaming to prestige panel
  private ambientParticles: AmbientParticle[] = []
  private lastAmbientSpawn = 0

  // World to screen converter (set by renderer)
  private worldToScreen:
    | ((x: number, y: number) => { x: number; y: number })
    | null = null

  constructor(_app: Application) {
    this.container = new Container()
    this.container.label = 'blackhole'

    // Background effects (behind world)
    this.backgroundContainer = new Container()
    this.backgroundContainer.label = 'blackhole-bg'

    // Core effects (in front of world during collapse)
    this.coreContainer = new Container()
    this.coreContainer.label = 'blackhole-core'

    // Overlay effects (always on top - vignette, ambient particles)
    this.overlayContainer = new Container()
    this.overlayContainer.label = 'blackhole-overlay'

    this.warpGraphics = new Graphics()
    this.fieldGraphics = new Graphics()
    this.coreGraphics = new Graphics()
    this.collapseGraphics = new Graphics()
    this.vignetteGraphics = new Graphics()
    this.ambientGraphics = new Graphics()

    this.backgroundContainer.addChild(this.warpGraphics)
    this.backgroundContainer.addChild(this.fieldGraphics)
    this.coreContainer.addChild(this.coreGraphics)
    this.coreContainer.addChild(this.collapseGraphics)
    // Vignette and ambient particles in overlay (on top of everything)
    this.overlayContainer.addChild(this.vignetteGraphics)
    this.overlayContainer.addChild(this.ambientGraphics)

    this.container.addChild(this.backgroundContainer)
    this.container.addChild(this.coreContainer)
    this.container.addChild(this.overlayContainer)

    // Initialize gravity field lines (reduced from 24 to 12)
    for (let i = 0; i < 12; i++) {
      this.gravityLines.push({
        angle: (Math.PI * 2 * i) / 12,
        speed: 0.5 + Math.random() * 0.5,
        offset: Math.random() * 100,
      })
    }
  }

  /**
   * Get the current gravity progress (0-1) based on weight
   * Uses computed_gravity which has the correct dynamic threshold
   */
  private getGravityProgress(): number {
    return Math.min(1, computed_gravity.value)
  }

  /**
   * Update all black hole effects
   */
  update(deltaTime: number, screenWidth: number, screenHeight: number): void {
    this.phase += deltaTime
    const progress = this.getGravityProgress()

    // Clear all graphics
    this.warpGraphics.clear()
    this.fieldGraphics.clear()
    this.coreGraphics.clear()
    this.collapseGraphics.clear()
    this.vignetteGraphics.clear()
    this.ambientGraphics.clear()

    // Handle collapse animation
    if (this.isCollapsing) {
      this.updateCollapse(deltaTime, screenWidth, screenHeight)
      return
    }

    // Handle burst animation (after collapse)
    if (this.isBursting) {
      this.updateBurst(screenWidth, screenHeight)
      return
    }

    // Update screen shake
    if (progress >= GRAVITY_STAGES.COLLAPSE_IMMINENT) {
      this.shakeIntensity =
        (progress - GRAVITY_STAGES.COLLAPSE_IMMINENT) /
        (1 - GRAVITY_STAGES.COLLAPSE_IMMINENT)
      const shake = this.shakeIntensity * 2
      this.shakeOffset.x = (Math.random() - 0.5) * shake
      this.shakeOffset.y = (Math.random() - 0.5) * shake
    } else {
      this.shakeIntensity = 0
      this.shakeOffset.x = 0
      this.shakeOffset.y = 0
    }

    // Draw effects based on progress
    if (progress >= GRAVITY_STAGES.WARP_START) {
      this.drawBackgroundWarp(progress, screenWidth, screenHeight)
    }

    if (progress >= GRAVITY_STAGES.PULL_VISIBLE) {
      this.drawGravityField(progress, screenWidth, screenHeight)
    }

    // Removed center black hole core - collapse now targets prestige panel instead

    // Draw pulsing vignette as prestige approaches (starts at 80%, intensifies at 100%)
    if (progress >= GRAVITY_STAGES.PRESTIGE_NEAR) {
      this.drawPrestigeVignette(screenWidth, screenHeight, progress)
    }

    // Update and draw ambient particles streaming to prestige panel (starts at 80%)
    if (progress >= GRAVITY_STAGES.PRESTIGE_NEAR) {
      this.updateAmbientParticles(
        deltaTime,
        progress,
        screenWidth,
        screenHeight
      )
      this.drawAmbientParticles(screenWidth, screenHeight)
    }
  }

  /**
   * Draw subtle background warping effect
   */
  private drawBackgroundWarp(
    progress: number,
    _width: number,
    _height: number
  ): void {
    const intensity = Math.min(
      1,
      (progress - GRAVITY_STAGES.WARP_START) / (1 - GRAVITY_STAGES.WARP_START)
    )

    // Draw concentric distortion rings
    const numRings = 5
    for (let i = 0; i < numRings; i++) {
      const baseRadius = 150 + i * 80
      const wobble = Math.sin(this.phase * 2 + i * 0.5) * 10 * intensity
      const radius = baseRadius + wobble

      const alpha = 0.03 + intensity * 0.05 * (1 - i / numRings)

      this.warpGraphics.circle(0, 0, radius)
      this.warpGraphics.fill({ color: Colors.gravityWarp, alpha })
    }

    // Draw vignette effect toward edges
    const vignetteRadius = 400 - intensity * 100
    for (let r = 0; r < 5; r++) {
      const radius = vignetteRadius + r * 50
      const alpha = 0.02 + intensity * 0.03
      this.warpGraphics.circle(0, 0, radius)
      this.warpGraphics.stroke({ color: 0x1a0a2a, width: 30, alpha })
    }
  }

  /**
   * Draw gravity field lines being pulled toward prestige panel
   */
  private drawGravityField(
    progress: number,
    screenWidth: number,
    screenHeight: number
  ): void {
    const intensity =
      (progress - GRAVITY_STAGES.PULL_VISIBLE) /
      (1 - GRAVITY_STAGES.PULL_VISIBLE)

    // Calculate direction to prestige panel (bottom-left corner relative to screen center)
    const targetX = this.prestigeTargetX - screenWidth / 2
    const targetY = this.prestigeTargetY - screenHeight / 2
    const targetAngle = Math.atan2(targetY, targetX)

    for (const line of this.gravityLines) {
      // Animate lines flowing toward prestige panel
      const flowPos = (this.phase * line.speed + line.offset) % 1
      const startDist = 300 + flowPos * 200
      const endDist = 100 + flowPos * 150

      const startX = Math.cos(line.angle) * startDist
      const startY = Math.sin(line.angle) * startDist

      // Bend toward prestige panel as intensity increases
      const bendAmount = intensity * 0.6
      const bentAngle = line.angle + (targetAngle - line.angle) * bendAmount
      const endX = Math.cos(bentAngle) * endDist
      const endY = Math.sin(bentAngle) * endDist

      // Curve toward prestige panel direction
      const midDist = (startDist + endDist) / 2
      const midAngle =
        line.angle +
        (targetAngle - line.angle) * bendAmount * 0.5 +
        Math.sin(this.phase * 3 + line.offset) * 0.1
      const midX = Math.cos(midAngle) * midDist * 0.8
      const midY = Math.sin(midAngle) * midDist * 0.8

      const alpha = 0.05 + intensity * 0.15 * (1 - flowPos)
      const color = this.lerpColor(Colors.gravityWarp, 0x7a5aff, intensity)

      this.fieldGraphics.moveTo(startX, startY)
      this.fieldGraphics.quadraticCurveTo(midX, midY, endX, endY)
      this.fieldGraphics.stroke({ color, width: 1, alpha })
    }

    // Inner swirl pointing toward prestige panel (subtle)
    const swirlIntensity = intensity * 0.25
    for (let i = 0; i < 2; i++) {
      const swirlAngle = this.phase * (0.5 + i * 0.2) + (Math.PI * 2 * i) / 3
      const spiralPoints: { x: number; y: number }[] = []

      for (let t = 0; t < 20; t++) {
        const dist = 40 + t * 8
        // Spiral bends toward prestige panel
        const bendT = t / 20
        const angle =
          swirlAngle +
          t * 0.2 +
          (targetAngle - swirlAngle) * bendT * intensity * 0.3
        spiralPoints.push({
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
        })
      }

      if (spiralPoints.length > 1) {
        const first = spiralPoints[0]!
        this.fieldGraphics.moveTo(first.x, first.y)
        for (let j = 1; j < spiralPoints.length; j++) {
          const point = spiralPoints[j]!
          this.fieldGraphics.lineTo(point.x, point.y)
        }
        this.fieldGraphics.stroke({
          color: 0x5a3aaa,
          width: 2,
          alpha: swirlIntensity * (1 - i * 0.2),
        })
      }
    }
  }

  /**
   * Start the collapse animation - actual nodes get pulled toward center
   * Uses physics-based spaghettification for dramatic effect
   */
  startCollapse(onComplete: () => void): void {
    if (this.isCollapsing || this.isBursting) return

    this.isCollapsing = true
    this.collapseProgress = 0
    this.onCollapseComplete = onComplete
    this.shockwaveRings = []

    // Pull everything toward world origin (0, 0) - the center of the graph
    // This creates a more dramatic "everything collapses to a singularity" effect
    // The black hole visual is drawn at screen center which corresponds to world origin
    startCollapseState(0, 0)
  }

  /**
   * Update collapse animation - physics handles node movement,
   * this draws visual effects (vignette, black hole glow, screen shake)
   */
  private updateCollapse(
    deltaTime: number,
    screenWidth: number,
    screenHeight: number
  ): void {
    // Update physics-based collapse (moves actual nodes)
    const collapseComplete = updateCollapsePhysics(deltaTime)
    const progress = getCollapseProgress()
    this.collapseProgress = progress

    // Get absorbed count from physics state
    const totalPackages = gameState.packages.size
    const absorbedCount = collapseState.value.absorbedPackages.size
    const absorbedRatio = totalPackages > 0 ? absorbedCount / totalPackages : 0

    // Screen shake - intensifies as more packages are absorbed
    const shakeAmount = 2 + absorbedRatio * 8 + progress * 4
    this.shakeOffset.x = (Math.random() - 0.5) * shakeAmount
    this.shakeOffset.y = (Math.random() - 0.5) * shakeAmount

    // Target position is screen center (which is world origin 0,0)
    // Core container is positioned at screen center, so draw at (0,0) relative to it
    const targetX = 0
    const targetY = 0

    // Spawn shockwave rings periodically during collapse
    if (Math.random() < absorbedRatio * 0.1) {
      this.shockwaveRings.push({
        progress: 0,
        startTime: this.collapseProgress,
      })
    }

    // Update and draw shockwave rings
    for (let i = this.shockwaveRings.length - 1; i >= 0; i--) {
      const ring = this.shockwaveRings[i]!
      ring.progress += deltaTime * 1.5

      if (ring.progress >= 1) {
        this.shockwaveRings.splice(i, 1)
        continue
      }

      const ringRadius = 20 + ring.progress * 200
      const ringAlpha = 0.6 * (1 - ring.progress)
      const ringWidth = 3 * (1 - ring.progress * 0.5)

      this.collapseGraphics.circle(targetX, targetY, ringRadius)
      this.collapseGraphics.stroke({
        color: 0xaa7aff,
        width: ringWidth,
        alpha: ringAlpha,
      })

      const innerRingRadius = ringRadius * 0.7
      this.collapseGraphics.circle(targetX, targetY, innerRingRadius)
      this.collapseGraphics.stroke({
        color: 0x7a5aff,
        width: ringWidth * 0.6,
        alpha: ringAlpha * 0.5,
      })
    }

    // Small but growing black hole at center
    const holeSize = 12 + absorbedRatio * 60 // Smaller: starts at 12, grows to 72

    // Outer glow at target - pulses more intensely
    const glowPulse = 1 + Math.sin(this.phase * 6) * 0.15
    for (let i = 3; i >= 0; i--) {
      const radius = (holeSize + i * 20) * glowPulse
      this.collapseGraphics.circle(targetX, targetY, radius)
      this.collapseGraphics.fill({
        color: 0x3a1a5a,
        alpha: 0.25 * (1 - i / 4) * (0.8 + absorbedRatio * 0.2),
      })
    }

    // Core at target
    this.collapseGraphics.circle(targetX, targetY, holeSize)
    this.collapseGraphics.fill({ color: 0x000000, alpha: 0.98 })

    // Bright accretion disk ring
    this.collapseGraphics.circle(targetX, targetY, holeSize * 1.15)
    this.collapseGraphics.stroke({
      color: 0xaa7aff,
      width: 2 + absorbedRatio * 2,
      alpha: 0.8 + absorbedRatio * 0.2,
    })

    // Inner event horizon glow
    this.collapseGraphics.circle(targetX, targetY, holeSize * 0.6)
    this.collapseGraphics.stroke({
      color: 0xff7aff,
      width: 1.5,
      alpha: 0.5 + Math.sin(this.phase * 10) * 0.2,
    })

    // Draw intensifying vignette during collapse
    this.drawCollapseVignette(screenWidth, screenHeight, absorbedRatio)

    // Flash at the end
    if (progress > 0.85) {
      const flashProgress = (progress - 0.85) / 0.15
      const flashAlpha = Math.sin(flashProgress * Math.PI)

      this.collapseGraphics.rect(
        -screenWidth,
        -screenHeight,
        screenWidth * 2,
        screenHeight * 2
      )
      this.collapseGraphics.fill({ color: 0xffffff, alpha: flashAlpha * 0.8 })
    }

    // When collapse is done, transition to burst phase
    if (collapseComplete && !this.isBursting) {
      this.isCollapsing = false
      this.isBursting = true
      this.burstProgress = 0
      this.burstStartTime = Date.now()
      endCollapseState()
    }
  }

  /**
   * Update and draw the burst effect after collapse
   * Returns true when burst is complete
   */
  private updateBurst(screenWidth: number, screenHeight: number): void {
    const elapsed = (Date.now() - this.burstStartTime) / 1000
    this.burstProgress = Math.min(1, elapsed / this.BURST_DURATION)

    // Eased progress for smoother animation
    const eased = 1 - Math.pow(1 - this.burstProgress, 3) // ease-out cubic

    // Screen shake during burst (decreasing)
    const shakeAmount = 8 * (1 - this.burstProgress)
    this.shakeOffset.x = (Math.random() - 0.5) * shakeAmount
    this.shakeOffset.y = (Math.random() - 0.5) * shakeAmount

    // Draw at screen center (core container is positioned there)
    const centerX = 0
    const centerY = 0

    // Central flash - bright at start, fades
    const flashAlpha = 0.9 * (1 - eased)
    const flashSize = 20 + eased * 100
    this.collapseGraphics.circle(centerX, centerY, flashSize)
    this.collapseGraphics.fill({ color: 0xffffff, alpha: flashAlpha })

    // Expanding energy rings
    for (let i = 0; i < 4; i++) {
      const ringDelay = i * 0.1
      const ringProgress = Math.max(
        0,
        (this.burstProgress - ringDelay) / (1 - ringDelay)
      )
      if (ringProgress <= 0) continue

      const ringEased = 1 - Math.pow(1 - ringProgress, 2)
      const ringRadius = 30 + ringEased * 400
      const ringAlpha = 0.7 * (1 - ringProgress)
      const ringWidth = 4 * (1 - ringProgress * 0.5)

      // Purple energy ring
      this.collapseGraphics.circle(centerX, centerY, ringRadius)
      this.collapseGraphics.stroke({
        color: 0xaa7aff,
        width: ringWidth,
        alpha: ringAlpha,
      })

      // Inner cyan ring
      this.collapseGraphics.circle(centerX, centerY, ringRadius * 0.8)
      this.collapseGraphics.stroke({
        color: 0x5affff,
        width: ringWidth * 0.6,
        alpha: ringAlpha * 0.6,
      })
    }

    // Particle burst - rays shooting outward
    const numRays = 16
    for (let i = 0; i < numRays; i++) {
      const angle = (Math.PI * 2 * i) / numRays + this.burstProgress * 0.3
      const rayLength = 50 + eased * 350
      const rayAlpha = 0.6 * (1 - this.burstProgress)

      const innerRadius = 10 + eased * 30
      const outerRadius = innerRadius + rayLength * (0.3 + Math.random() * 0.7)

      const x1 = centerX + Math.cos(angle) * innerRadius
      const y1 = centerY + Math.sin(angle) * innerRadius
      const x2 = centerX + Math.cos(angle) * outerRadius
      const y2 = centerY + Math.sin(angle) * outerRadius

      this.collapseGraphics.moveTo(x1, y1)
      this.collapseGraphics.lineTo(x2, y2)
      this.collapseGraphics.stroke({
        color: i % 2 === 0 ? 0x7aff7a : 0xffff7a, // Alternating green/yellow
        width: 3 * (1 - this.burstProgress * 0.5),
        alpha: rayAlpha,
      })
    }

    // Fading vignette (inverse of collapse - lightening from edges)
    const vignetteAlpha = 0.3 * (1 - eased)
    this.collapseGraphics.rect(
      -screenWidth / 2,
      -screenHeight / 2,
      screenWidth,
      screenHeight
    )
    this.collapseGraphics.fill({ color: 0x000000, alpha: vignetteAlpha })

    // Complete burst
    if (this.burstProgress >= 1) {
      this.isBursting = false
      this.shockwaveRings = []
      if (this.onCollapseComplete) {
        this.onCollapseComplete()
        this.onCollapseComplete = null
      }
    }
  }

  /**
   * Draw intensifying vignette during collapse animation
   * Gets darker and more dramatic as more particles are absorbed
   */
  private drawCollapseVignette(
    screenWidth: number,
    screenHeight: number,
    intensity: number
  ): void {
    // Base vignette that intensifies during collapse
    const vignetteIntensity = 0.3 + intensity * 0.5

    // Multiple layers from edges
    for (let i = 0; i < 6; i++) {
      const layerProgress = i / 6
      const alpha = vignetteIntensity * (1 - layerProgress) * 0.6

      const inset = 20 + i * 60

      // Edge rectangles in screen coordinates (overlay is at 0,0)
      // Top
      this.vignetteGraphics.rect(0, 0, screenWidth, inset)
      this.vignetteGraphics.fill({ color: 0x1a0a20, alpha })

      // Bottom
      this.vignetteGraphics.rect(0, screenHeight - inset, screenWidth, inset)
      this.vignetteGraphics.fill({ color: 0x1a0a20, alpha })

      // Left
      this.vignetteGraphics.rect(0, inset, inset, screenHeight - inset * 2)
      this.vignetteGraphics.fill({ color: 0x1a0a20, alpha })

      // Right
      this.vignetteGraphics.rect(
        screenWidth - inset,
        inset,
        inset,
        screenHeight - inset * 2
      )
      this.vignetteGraphics.fill({ color: 0x1a0a20, alpha })
    }

    // Pulsing purple overlay that builds
    const pulseAlpha = intensity * 0.15 * (0.8 + Math.sin(this.phase * 4) * 0.2)
    this.vignetteGraphics.rect(0, 0, screenWidth, screenHeight)
    this.vignetteGraphics.fill({ color: 0x2a1040, alpha: pulseAlpha })
  }

  /**
   * Linear interpolate between two colors
   */
  private lerpColor(color1: number, color2: number, t: number): number {
    const r1 = (color1 >> 16) & 0xff
    const g1 = (color1 >> 8) & 0xff
    const b1 = color1 & 0xff

    const r2 = (color2 >> 16) & 0xff
    const g2 = (color2 >> 8) & 0xff
    const b2 = color2 & 0xff

    const r = Math.round(r1 + (r2 - r1) * t)
    const g = Math.round(g1 + (g2 - g1) * t)
    const b = Math.round(b1 + (b2 - b1) * t)

    return (r << 16) | (g << 8) | b
  }

  /**
   * Get screen shake offset for camera
   */
  getShakeOffset(): { x: number; y: number } {
    return this.shakeOffset
  }

  /**
   * Check if collapse animation is playing
   */
  isCollapseAnimating(): boolean {
    return this.isCollapsing
  }

  /**
   * Get the current gravity progress for external use
   */
  getGravityProgressValue(): number {
    return this.getGravityProgress()
  }

  getBackgroundContainer(): Container {
    return this.backgroundContainer
  }

  getCoreContainer(): Container {
    return this.coreContainer
  }

  getOverlayContainer(): Container {
    return this.overlayContainer
  }

  getContainer(): Container {
    return this.container
  }

  /**
   * Set the prestige panel target position (screen coordinates)
   */
  setPrestigeTarget(x: number, y: number): void {
    this.prestigeTargetX = x
    this.prestigeTargetY = y
  }

  /**
   * Set the world-to-screen coordinate converter
   */
  setWorldToScreen(
    converter: (x: number, y: number) => { x: number; y: number }
  ): void {
    this.worldToScreen = converter
  }

  /**
   * Draw pulsing vignette when prestige is ready
   * Creates urgency and draws attention toward prestige panel
   * Uses standard screen coordinates (0,0) to (screenWidth, screenHeight)
   */
  private drawPrestigeVignette(
    screenWidth: number,
    screenHeight: number,
    progress: number
  ): void {
    // Scale intensity based on progress (PRESTIGE_NEAR to 1.0 maps to 0.3 to 1.0 intensity)
    const nearThreshold = GRAVITY_STAGES.PRESTIGE_NEAR
    const progressIntensity =
      progress >= 1.0
        ? 1.0
        : ((progress - nearThreshold) / (1.0 - nearThreshold)) * 0.7 + 0.3

    // Pulsing intensity
    const pulseSpeed = 2.5
    const basePulse = 0.3 + 0.15 * Math.sin(this.phase * pulseSpeed)
    const pulseIntensity = basePulse * progressIntensity

    // Target position in standard screen coordinates
    const targetX = this.prestigeTargetX
    const targetY = this.prestigeTargetY

    // Multiple layers of vignette from screen edges
    for (let i = 0; i < 6; i++) {
      const layerProgress = i / 6
      const alpha = pulseIntensity * (1 - layerProgress) * 0.5

      // Inset from edges
      const inset = 30 + i * 50

      // Bias toward prestige panel (bottom-left)
      const biasX = ((targetX - screenWidth / 2) / screenWidth) * inset * 0.4
      const biasY = ((targetY - screenHeight / 2) / screenHeight) * inset * 0.4

      // Edge boundaries
      const top = inset + biasY
      const bottom = screenHeight - inset + biasY
      const left = inset + biasX
      const right = screenWidth - inset + biasX

      // Draw each edge as a rectangle
      // Top edge
      this.vignetteGraphics.rect(0, 0, screenWidth, top)
      this.vignetteGraphics.fill({ color: 0x2a1040, alpha })

      // Bottom edge
      this.vignetteGraphics.rect(0, bottom, screenWidth, screenHeight - bottom)
      this.vignetteGraphics.fill({ color: 0x2a1040, alpha })

      // Left edge
      this.vignetteGraphics.rect(0, top, left, bottom - top)
      this.vignetteGraphics.fill({ color: 0x2a1040, alpha })

      // Right edge
      this.vignetteGraphics.rect(right, top, screenWidth - right, bottom - top)
      this.vignetteGraphics.fill({ color: 0x2a1040, alpha })
    }

    // Removed corner guide lines - vignette alone provides enough visual cue
  }

  /**
   * Update ambient particles streaming from nodes to prestige panel
   */
  private updateAmbientParticles(
    deltaTime: number,
    progress: number,
    screenWidth: number,
    screenHeight: number
  ): void {
    // Spawn rate increases as progress increases
    const spawnRate = progress >= 1.0 ? 0.05 : 0.15 // Faster when prestige ready
    const now = Date.now()

    // Spawn new particles from random packages
    if (now - this.lastAmbientSpawn > spawnRate * 1000 && this.worldToScreen) {
      this.lastAmbientSpawn = now

      const packages = Array.from(gameState.packages.values())
      if (packages.length > 0) {
        // Pick a random package
        const pkg = packages[Math.floor(Math.random() * packages.length)]!
        const screenPos = this.worldToScreen(pkg.position.x, pkg.position.y)

        // Only spawn if package is on screen
        if (
          screenPos.x > -100 &&
          screenPos.x < screenWidth + 100 &&
          screenPos.y > -100 &&
          screenPos.y < screenHeight + 100
        ) {
          this.ambientParticles.push({
            x: screenPos.x,
            y: screenPos.y,
            sourceX: screenPos.x,
            sourceY: screenPos.y,
            targetX: this.prestigeTargetX,
            targetY: this.prestigeTargetY,
            progress: 0,
            speed: 0.3 + Math.random() * 0.4, // Variable speed
            color: pkg.state === 'conflict' ? 0xff6b6b : 0x7a5aff,
            size: 3 + Math.random() * 3,
          })
        }
      }
    }

    // Update existing particles
    for (let i = this.ambientParticles.length - 1; i >= 0; i--) {
      const particle = this.ambientParticles[i]!
      particle.progress += deltaTime * particle.speed

      if (particle.progress >= 1) {
        // Remove completed particles
        this.ambientParticles.splice(i, 1)
      } else {
        // Update position with slight curve
        const t = particle.progress
        const eased = t * t // Ease-in (accelerate toward target)

        const dx = particle.targetX - particle.sourceX
        const dy = particle.targetY - particle.sourceY

        // Add slight curve perpendicular to path
        const perpX = -dy * 0.1 * Math.sin(t * Math.PI)
        const perpY = dx * 0.1 * Math.sin(t * Math.PI)

        particle.x = particle.sourceX + dx * eased + perpX
        particle.y = particle.sourceY + dy * eased + perpY
      }
    }

    // Limit max particles
    if (this.ambientParticles.length > 50) {
      this.ambientParticles.splice(0, this.ambientParticles.length - 50)
    }
  }

  /**
   * Draw ambient particles in standard screen coordinates
   * Overlay container is at (0,0), so use screen coords directly
   */
  private drawAmbientParticles(
    _screenWidth: number,
    _screenHeight: number
  ): void {
    for (const particle of this.ambientParticles) {
      // Use screen coordinates directly (overlay container is at 0,0)
      const x = particle.x
      const y = particle.y

      const alpha = 0.8 * (1 - particle.progress * 0.5)
      const size = particle.size * (1 - particle.progress * 0.3)

      // Glowing particle
      this.ambientGraphics.circle(x, y, size)
      this.ambientGraphics.fill({ color: particle.color, alpha })

      // Outer glow
      this.ambientGraphics.circle(x, y, size * 2)
      this.ambientGraphics.fill({ color: particle.color, alpha: alpha * 0.3 })

      // Trail
      if (particle.progress > 0.1) {
        const dx = particle.targetX - particle.sourceX
        const dy = particle.targetY - particle.sourceY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 1) continue
        const nx = dx / dist
        const ny = dy / dist

        const trailLength = 20 * particle.progress
        const trailX = x - nx * trailLength
        const trailY = y - ny * trailLength

        this.ambientGraphics.moveTo(x, y)
        this.ambientGraphics.lineTo(trailX, trailY)
        this.ambientGraphics.stroke({
          color: particle.color,
          width: size * 0.6,
          alpha: alpha * 0.6,
        })
      }
    }
  }

  clear(): void {
    this.warpGraphics.clear()
    this.fieldGraphics.clear()
    this.coreGraphics.clear()
    this.collapseGraphics.clear()
    this.vignetteGraphics.clear()
    this.ambientGraphics.clear()
    this.isCollapsing = false
    this.ambientParticles = []
    this.shockwaveRings = []
  }
}
