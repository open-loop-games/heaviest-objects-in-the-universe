// Visual effects system for feedback and onboarding

import { Graphics, Container, type Application } from 'pixi.js'
import { Colors } from './colors'
import { gameState } from '../game/state'
import { prefersReducedMotion } from './accessibility'

interface RippleEffect {
  x: number
  y: number
  startTime: number
  duration: number
  color: number
}

interface FlashEffect {
  x: number
  y: number
  startTime: number
  duration: number
  color: number
  radius: number
}

interface ParticleBurst {
  x: number
  y: number
  startTime: number
  count: number
  color: number
  particles: { x: number; y: number; vx: number; vy: number; alpha: number }[]
}

interface AutoCompleteEffect {
  x: number
  y: number
  startTime: number
  duration: number
  type: 'resolve' | 'dedup'
  color: number
  particles: { angle: number; distance: number; size: number }[]
}

interface CritEffect {
  startTime: number
  duration: number
  count: number
}

export class EffectsRenderer {
  private container: Container
  private ripples: RippleEffect[] = []
  private bursts: ParticleBurst[] = []
  private flashes: FlashEffect[] = []
  private autoCompletes: AutoCompleteEffect[] = []
  private crits: CritEffect[] = []
  private rippleGraphics: Graphics
  private particleGraphics: Graphics
  private flashGraphics: Graphics
  private autoCompleteGraphics: Graphics
  private critGraphics: Graphics

  // Pulse state for root node
  private pulsePhase = 0

  constructor(_app: Application) {
    this.container = new Container()
    this.container.label = 'effects'

    this.rippleGraphics = new Graphics()
    this.particleGraphics = new Graphics()
    this.flashGraphics = new Graphics()
    this.autoCompleteGraphics = new Graphics()
    this.critGraphics = new Graphics()

    this.container.addChild(this.flashGraphics) // Behind others
    this.container.addChild(this.rippleGraphics)
    this.container.addChild(this.particleGraphics)
    this.container.addChild(this.autoCompleteGraphics)
    this.container.addChild(this.critGraphics) // On top for visibility
  }

  /**
   * Update all effects each frame
   */
  update(deltaTime: number): void {
    const now = Date.now()

    // Update pulse phase
    this.pulsePhase += deltaTime * 3

    // Clear graphics for redraw
    this.rippleGraphics.clear()
    this.particleGraphics.clear()
    this.flashGraphics.clear()
    this.autoCompleteGraphics.clear()
    this.critGraphics.clear()

    // Update and draw flashes
    this.flashes = this.flashes.filter((flash) => {
      const elapsed = now - flash.startTime
      const progress = elapsed / flash.duration

      if (progress >= 1) return false

      // Flash starts bright then fades
      const alpha = (1 - progress) * 0.6
      const radius = flash.radius * (1 + progress * 0.5)

      this.flashGraphics.circle(flash.x, flash.y, radius)
      this.flashGraphics.fill({ color: flash.color, alpha })

      return true
    })

    // Update and draw ripples
    this.ripples = this.ripples.filter((ripple) => {
      const elapsed = now - ripple.startTime
      const progress = elapsed / ripple.duration

      if (progress >= 1) return false

      const radius = 30 + progress * 60
      const alpha = 1 - progress

      this.rippleGraphics.circle(ripple.x, ripple.y, radius)
      this.rippleGraphics.stroke({
        color: ripple.color,
        width: 2,
        alpha: alpha * 0.6,
      })

      return true
    })

    // Update and draw particle bursts
    this.bursts = this.bursts.filter((burst) => {
      const elapsed = now - burst.startTime
      const progress = elapsed / 500 // 500ms duration

      if (progress >= 1) return false

      for (const p of burst.particles) {
        // Update position
        p.x += p.vx * deltaTime * 60
        p.y += p.vy * deltaTime * 60
        p.vy += 0.1 // gravity
        p.alpha = 1 - progress

        // Draw particle
        this.particleGraphics.circle(p.x, p.y, 3)
        this.particleGraphics.fill({ color: burst.color, alpha: p.alpha })
      }

      return true
    })

    // Update and draw auto-complete effects (radial burst)
    this.autoCompletes = this.autoCompletes.filter((effect) => {
      const elapsed = now - effect.startTime
      const progress = elapsed / effect.duration

      if (progress >= 1) return false

      // Eased progress for smooth animation
      const easedProgress = 1 - Math.pow(1 - progress, 3) // ease-out cubic

      // Draw expanding ring
      const ringRadius = 20 + easedProgress * 40
      const ringAlpha = (1 - progress) * 0.5
      this.autoCompleteGraphics.circle(effect.x, effect.y, ringRadius)
      this.autoCompleteGraphics.stroke({
        color: effect.color,
        width: 3 - progress * 2,
        alpha: ringAlpha,
      })

      // Draw second ring (delayed)
      if (progress > 0.15) {
        const ring2Progress = (progress - 0.15) / 0.85
        const ring2Radius = 15 + ring2Progress * 50
        const ring2Alpha = (1 - ring2Progress) * 0.3
        this.autoCompleteGraphics.circle(effect.x, effect.y, ring2Radius)
        this.autoCompleteGraphics.stroke({
          color: effect.color,
          width: 2 - ring2Progress * 1.5,
          alpha: ring2Alpha,
        })
      }

      // Draw radial particles
      for (const p of effect.particles) {
        const particleDistance = p.distance * easedProgress
        const px = effect.x + Math.cos(p.angle) * particleDistance
        const py = effect.y + Math.sin(p.angle) * particleDistance
        const particleAlpha = (1 - progress) * 0.8
        const particleSize = p.size * (1 - progress * 0.5)

        this.autoCompleteGraphics.circle(px, py, particleSize)
        this.autoCompleteGraphics.fill({
          color: effect.color,
          alpha: particleAlpha,
        })
      }

      // Draw central flash (bright at start, fades quickly)
      if (progress < 0.3) {
        const flashProgress = progress / 0.3
        const flashRadius = 8 + flashProgress * 12
        const flashAlpha = (1 - flashProgress) * 0.7
        this.autoCompleteGraphics.circle(effect.x, effect.y, flashRadius)
        this.autoCompleteGraphics.fill({ color: 0xffffff, alpha: flashAlpha })
      }

      return true
    })

    // Update and draw crit effects (screen-centered burst)
    this.crits = this.crits.filter((crit) => {
      const elapsed = now - crit.startTime
      const progress = elapsed / crit.duration

      if (progress >= 1) return false

      // Golden/yellow color for crit
      const critColor = 0xffd700

      // Multiple expanding rings from center (0,0 in world space)
      const ringCount = 3
      for (let i = 0; i < ringCount; i++) {
        const ringDelay = i * 0.1
        const ringProgress = Math.max(
          0,
          (progress - ringDelay) / (1 - ringDelay)
        )
        if (ringProgress <= 0 || ringProgress >= 1) continue

        const easedProgress = 1 - Math.pow(1 - ringProgress, 2)
        const ringRadius = 30 + easedProgress * 150
        const ringAlpha = (1 - ringProgress) * 0.6

        this.critGraphics.circle(0, 0, ringRadius)
        this.critGraphics.stroke({
          color: critColor,
          width: 4 - ringProgress * 3,
          alpha: ringAlpha,
        })
      }

      // Central starburst
      if (progress < 0.4) {
        const burstProgress = progress / 0.4
        const rays = 8
        for (let i = 0; i < rays; i++) {
          const angle = (Math.PI * 2 * i) / rays
          const rayLength = 20 + burstProgress * 60
          const rayAlpha = (1 - burstProgress) * 0.8

          this.critGraphics.moveTo(0, 0)
          this.critGraphics.lineTo(
            Math.cos(angle) * rayLength,
            Math.sin(angle) * rayLength
          )
          this.critGraphics.stroke({
            color: 0xffffff,
            width: 3 - burstProgress * 2,
            alpha: rayAlpha,
          })
        }
      }

      // Central flash
      if (progress < 0.2) {
        const flashProgress = progress / 0.2
        const flashRadius = 15 + flashProgress * 25
        const flashAlpha = (1 - flashProgress) * 0.9
        this.critGraphics.circle(0, 0, flashRadius)
        this.critGraphics.fill({ color: 0xffffff, alpha: flashAlpha })
      }

      return true
    })
  }

  /**
   * Get pulse intensity for root node (0-1 oscillating)
   */
  getRootPulseIntensity(): number {
    // Only pulse if root is the only node or game just started
    if (gameState.packages.size > 1) {
      return 0
    }
    // Smooth sine wave pulse
    return (Math.sin(this.pulsePhase) + 1) / 2
  }

  /**
   * Check if we should show "click me" hint on root
   */
  shouldShowClickHint(): boolean {
    return (
      gameState.packages.size === 1 &&
      gameState.stats.totalPackagesInstalled < 3
    )
  }

  /**
   * Spawn a ripple effect at position
   */
  spawnRipple(
    x: number,
    y: number,
    color: number = Colors.borderInstalling
  ): void {
    this.ripples.push({
      x,
      y,
      startTime: Date.now(),
      duration: 400,
      color,
    })
  }

  /**
   * Spawn a conflict flash (red burst when conflict appears)
   */
  spawnConflictFlash(x: number, y: number): void {
    this.flashes.push({
      x,
      y,
      startTime: Date.now(),
      duration: 300,
      color: Colors.borderConflict,
      radius: 35,
    })

    // Also spawn a ripple for extra impact
    this.spawnRipple(x, y, Colors.borderConflict)
  }

  /**
   * Spawn a particle burst for install success
   */
  spawnBurst(x: number, y: number, color: number = Colors.borderReady): void {
    const particles: ParticleBurst['particles'] = []
    const count = 8

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3
      const speed = 2 + Math.random() * 2
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        alpha: 1,
      })
    }

    this.bursts.push({
      x,
      y,
      startTime: Date.now(),
      count,
      color,
      particles,
    })
  }

  /**
   * Spawn an automation completion effect (radial burst)
   * Used when auto-resolve or auto-dedup completes
   */
  spawnAutoCompleteEffect(
    x: number,
    y: number,
    type: 'resolve' | 'dedup'
  ): void {
    const color = type === 'resolve' ? Colors.autoResolve : Colors.autoDedup
    const particles: AutoCompleteEffect['particles'] = []

    // Create radial particles
    const particleCount = 12
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.2
      particles.push({
        angle,
        distance: 35 + Math.random() * 25,
        size: 2 + Math.random() * 2,
      })
    }

    this.autoCompletes.push({
      x,
      y,
      startTime: Date.now(),
      duration: 500,
      type,
      color,
      particles,
    })

    // Also spawn a ripple for extra feedback
    this.spawnRipple(x, y, color)
  }

  /**
   * Spawn a crit effect (golden burst when cascade doubles)
   */
  spawnCrit(count: number): void {
    this.crits.push({
      startTime: Date.now(),
      duration: 600,
      count,
    })
  }

  /**
   * Get shake offset for a conflicting node
   */
  getConflictShake(conflictProgress: number): { x: number; y: number } {
    // No shake for reduced motion
    if (prefersReducedMotion()) {
      return { x: 0, y: 0 }
    }

    if (conflictProgress <= 0) {
      // Idle conflict shake
      const shake = Math.sin(Date.now() * 0.02) * 2
      return { x: shake, y: 0 }
    }
    // No shake during resolution
    return { x: 0, y: 0 }
  }

  getContainer(): Container {
    return this.container
  }

  clear(): void {
    this.ripples = []
    this.bursts = []
    this.flashes = []
    this.autoCompletes = []
    this.crits = []
    this.rippleGraphics.clear()
    this.particleGraphics.clear()
    this.flashGraphics.clear()
    this.autoCompleteGraphics.clear()
    this.critGraphics.clear()
  }
}
