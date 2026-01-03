// Visual effects system for feedback and onboarding

import { Graphics, Container, type Application } from 'pixi.js'
import { Colors } from './colors'
import { gameState } from '../game/state'
import { prefersReducedMotion } from './accessibility'
import { getPackageAtPath } from '../game/scope'
import { isCascadeActive } from '../game/cascade'

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

interface StableCelebration {
  startTime: number
  duration: number
}

interface ShipAnimation {
  startTime: number
  duration: number // Total animation duration
  packageDelays: Map<string, number> // Per-package stagger delay (0-1)
  onComplete: () => void
}

export class EffectsRenderer {
  private container: Container
  private ripples: RippleEffect[] = []
  private bursts: ParticleBurst[] = []
  private flashes: FlashEffect[] = []
  private autoCompletes: AutoCompleteEffect[] = []
  private crits: CritEffect[] = []
  private stableCelebration: StableCelebration | null = null
  private shipAnimation: ShipAnimation | null = null
  private rippleGraphics: Graphics
  private particleGraphics: Graphics
  private flashGraphics: Graphics
  private autoCompleteGraphics: Graphics
  private critGraphics: Graphics
  private celebrationGraphics: Graphics

  // Pulse state for root node
  private pulsePhase = 0

  // Track scope state for celebration detection
  private prevScopeState: string | null = null
  // Track scope session for proper celebration timing
  private watchedScopePath: string | null = null
  private framesInUnstable = 0 // Count frames spent in unstable state with cascade done

  constructor(_app: Application) {
    this.container = new Container()
    this.container.label = 'effects'

    this.rippleGraphics = new Graphics()
    this.particleGraphics = new Graphics()
    this.flashGraphics = new Graphics()
    this.autoCompleteGraphics = new Graphics()
    this.critGraphics = new Graphics()
    this.celebrationGraphics = new Graphics()

    this.container.addChild(this.flashGraphics) // Behind others
    this.container.addChild(this.rippleGraphics)
    this.container.addChild(this.particleGraphics)
    this.container.addChild(this.autoCompleteGraphics)
    this.container.addChild(this.critGraphics)
    this.container.addChild(this.celebrationGraphics) // On top for visibility
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
    this.celebrationGraphics.clear()

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

    // Update and draw stable celebration (scope cleared)
    if (this.stableCelebration) {
      const elapsed = now - this.stableCelebration.startTime
      const progress = elapsed / this.stableCelebration.duration

      if (progress >= 1) {
        this.stableCelebration = null
      } else {
        // Green color for stable
        const celebrationColor = Colors.accentGreen

        // Multiple expanding rings from center (0,0 in scope space)
        const ringCount = 3
        for (let i = 0; i < ringCount; i++) {
          const ringDelay = i * 0.12
          const ringProgress = Math.max(
            0,
            (progress - ringDelay) / (1 - ringDelay)
          )
          if (ringProgress <= 0 || ringProgress >= 1) continue

          const easedProgress = 1 - Math.pow(1 - ringProgress, 2)
          const ringRadius = 40 + easedProgress * 120
          const ringAlpha = (1 - ringProgress) * 0.7

          this.celebrationGraphics.circle(0, 0, ringRadius)
          this.celebrationGraphics.stroke({
            color: celebrationColor,
            width: 4 - ringProgress * 3,
            alpha: ringAlpha,
          })
        }

        // Central flash (bright at start)
        if (progress < 0.25) {
          const flashProgress = progress / 0.25
          const flashRadius = 20 + flashProgress * 30
          const flashAlpha = (1 - flashProgress) * 0.6
          this.celebrationGraphics.circle(0, 0, flashRadius)
          this.celebrationGraphics.fill({ color: 0xffffff, alpha: flashAlpha })
        }
      }
    }

    // Observe scope state for celebration (rendering watches game state)
    if (gameState.scopeStack.length > 0) {
      const currentScopePath = gameState.scopeStack.join('/')
      const pkg = getPackageAtPath(gameState.scopeStack)
      const currentState = pkg?.internalState ?? null
      const cascadeActive = isCascadeActive()

      // Reset tracking when scope changes
      if (this.watchedScopePath !== currentScopePath) {
        this.watchedScopePath = currentScopePath
        this.framesInUnstable = 0
        this.prevScopeState = null
      }

      // Count frames where cascade is done but state is still unstable
      // This means player has work to do and is actively in this scope
      if (!cascadeActive && currentState === 'unstable') {
        this.framesInUnstable++
      }

      // Only celebrate when:
      // 1. Cascade is done
      // 2. We transition unstable→stable
      // 3. We've been in "workable unstable" state for at least 30 frames (~0.5s)
      //    This prevents celebrating on quick state transitions during load/cascade settling
      if (
        !cascadeActive &&
        this.prevScopeState === 'unstable' &&
        currentState === 'stable' &&
        this.framesInUnstable >= 30
      ) {
        this.spawnStableCelebration()
      }

      this.prevScopeState = currentState
    } else {
      this.prevScopeState = null
      this.framesInUnstable = 0
      this.watchedScopePath = null
    }
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
   * Spawn a stable celebration effect (scope fully cleared)
   */
  spawnStableCelebration(): void {
    // Prevent multiple overlapping celebrations
    if (this.stableCelebration) return

    this.stableCelebration = {
      startTime: Date.now(),
      duration: 600,
    }
  }

  /**
   * Get the current celebration scale multiplier (for node pop effect)
   * Returns 1.0 normally, > 1.0 during celebration pop
   */
  getCelebrationScale(): number {
    if (!this.stableCelebration) return 1.0

    const elapsed = Date.now() - this.stableCelebration.startTime
    const progress = elapsed / this.stableCelebration.duration

    if (progress >= 1) return 1.0

    // Quick pop up then settle back: peak at ~0.15 progress
    const popPeak = 0.15
    if (progress < popPeak) {
      // Rising: ease out
      const riseProgress = progress / popPeak
      const eased = 1 - Math.pow(1 - riseProgress, 2)
      return 1.0 + eased * 0.25 // Max scale 1.25
    } else {
      // Falling: ease in
      const fallProgress = (progress - popPeak) / (1 - popPeak)
      const eased = 1 - Math.pow(1 - fallProgress, 3)
      return 1.25 - eased * 0.25
    }
  }

  /**
   * Start ship animation - compresses all packages with staggered timing
   * Packages pop in reverse-cascade order (furthest from center first)
   */
  startShipAnimation(
    packages: Map<
      string,
      { position: { x: number; y: number }; depth: number }
    >,
    onComplete: () => void
  ): void {
    if (this.shipAnimation) return // Already animating

    // Sort packages by distance from center (furthest first for reverse cascade)
    const packagesArray = Array.from(packages.entries())
    packagesArray.sort((a, b) => {
      const distA = Math.sqrt(a[1].position.x ** 2 + a[1].position.y ** 2)
      const distB = Math.sqrt(b[1].position.x ** 2 + b[1].position.y ** 2)
      return distB - distA // Furthest first
    })

    // Assign staggered delays (0 to 0.5, leaving 0.5 for the compress animation)
    const delays = new Map<string, number>()
    const staggerRange = 0.5 // Total stagger time as fraction of duration
    packagesArray.forEach(([id], index) => {
      const delay =
        (index / Math.max(1, packagesArray.length - 1)) * staggerRange
      delays.set(id, delay)
    })

    this.shipAnimation = {
      startTime: Date.now(),
      duration: 1400, // 1.4 seconds total
      packageDelays: delays,
      onComplete,
    }
  }

  /**
   * Check if ship animation is active
   */
  isShipAnimating(): boolean {
    return this.shipAnimation !== null
  }

  /**
   * Get ship animation scale for a specific package
   * Returns 1.0 normally, shrinks to 0 during ship, then pops before removal
   */
  getShipScale(pkgId: string): number {
    if (!this.shipAnimation) return 1.0

    const elapsed = Date.now() - this.shipAnimation.startTime
    const overallProgress = elapsed / this.shipAnimation.duration

    // Animation complete - trigger callback and clean up
    if (overallProgress >= 1) {
      const callback = this.shipAnimation.onComplete
      this.shipAnimation = null
      // Defer callback to avoid state issues during render
      setTimeout(callback, 0)
      return 0
    }

    const delay = this.shipAnimation.packageDelays.get(pkgId) ?? 0
    const compressDuration = 0.5 // Compress takes 50% of remaining time after delay

    // Package hasn't started yet
    if (overallProgress < delay) return 1.0

    // Calculate package-specific progress
    const pkgProgress = (overallProgress - delay) / compressDuration

    if (pkgProgress >= 1) {
      // Fully compressed - spawn pop effect on first frame at 0
      return 0
    }

    // Compress with ease-in (accelerating)
    const eased = pkgProgress * pkgProgress
    return 1.0 - eased
  }

  // Ship animation pop effects are handled by the sudden scale=0 transition
  // Future enhancement: track positions and spawn burst particles here

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
    this.stableCelebration = null
    this.shipAnimation = null
    this.rippleGraphics.clear()
    this.particleGraphics.clear()
    this.flashGraphics.clear()
    this.autoCompleteGraphics.clear()
    this.critGraphics.clear()
    this.celebrationGraphics.clear()
  }
}
