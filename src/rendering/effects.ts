// Visual effects system for feedback and onboarding

import { Graphics, Container, type Application } from 'pixi.js';
import { Colors } from './colors';
import { gameState } from '../game/state';

interface RippleEffect {
  x: number;
  y: number;
  startTime: number;
  duration: number;
  color: number;
}

interface FlashEffect {
  x: number;
  y: number;
  startTime: number;
  duration: number;
  color: number;
  radius: number;
}

interface ParticleBurst {
  x: number;
  y: number;
  startTime: number;
  count: number;
  color: number;
  particles: { x: number; y: number; vx: number; vy: number; alpha: number }[];
}

export class EffectsRenderer {
  private container: Container;
  private ripples: RippleEffect[] = [];
  private bursts: ParticleBurst[] = [];
  private flashes: FlashEffect[] = [];
  private rippleGraphics: Graphics;
  private particleGraphics: Graphics;
  private flashGraphics: Graphics;

  // Pulse state for root node
  private pulsePhase = 0;

  constructor(_app: Application) {
    this.container = new Container();
    this.container.label = 'effects';

    this.rippleGraphics = new Graphics();
    this.particleGraphics = new Graphics();
    this.flashGraphics = new Graphics();

    this.container.addChild(this.flashGraphics); // Behind others
    this.container.addChild(this.rippleGraphics);
    this.container.addChild(this.particleGraphics);
  }

  /**
   * Update all effects each frame
   */
  update(deltaTime: number): void {
    const now = Date.now();

    // Update pulse phase
    this.pulsePhase += deltaTime * 3;

    // Clear graphics for redraw
    this.rippleGraphics.clear();
    this.particleGraphics.clear();
    this.flashGraphics.clear();

    // Update and draw flashes
    this.flashes = this.flashes.filter(flash => {
      const elapsed = now - flash.startTime;
      const progress = elapsed / flash.duration;

      if (progress >= 1) return false;

      // Flash starts bright then fades
      const alpha = (1 - progress) * 0.6;
      const radius = flash.radius * (1 + progress * 0.5);

      this.flashGraphics.circle(flash.x, flash.y, radius);
      this.flashGraphics.fill({ color: flash.color, alpha });

      return true;
    });

    // Update and draw ripples
    this.ripples = this.ripples.filter(ripple => {
      const elapsed = now - ripple.startTime;
      const progress = elapsed / ripple.duration;

      if (progress >= 1) return false;

      const radius = 30 + progress * 60;
      const alpha = 1 - progress;

      this.rippleGraphics.circle(ripple.x, ripple.y, radius);
      this.rippleGraphics.stroke({ color: ripple.color, width: 2, alpha: alpha * 0.6 });

      return true;
    });

    // Update and draw particle bursts
    this.bursts = this.bursts.filter(burst => {
      const elapsed = now - burst.startTime;
      const progress = elapsed / 500; // 500ms duration

      if (progress >= 1) return false;

      for (const p of burst.particles) {
        // Update position
        p.x += p.vx * deltaTime * 60;
        p.y += p.vy * deltaTime * 60;
        p.vy += 0.1; // gravity
        p.alpha = 1 - progress;

        // Draw particle
        this.particleGraphics.circle(p.x, p.y, 3);
        this.particleGraphics.fill({ color: burst.color, alpha: p.alpha });
      }

      return true;
    });
  }

  /**
   * Get pulse intensity for root node (0-1 oscillating)
   */
  getRootPulseIntensity(): number {
    // Only pulse if root is the only node or game just started
    if (gameState.packages.size > 1) {
      return 0;
    }
    // Smooth sine wave pulse
    return (Math.sin(this.pulsePhase) + 1) / 2;
  }

  /**
   * Check if we should show "click me" hint on root
   */
  shouldShowClickHint(): boolean {
    return gameState.packages.size === 1 && gameState.stats.totalPackagesInstalled < 3;
  }

  /**
   * Spawn a ripple effect at position
   */
  spawnRipple(x: number, y: number, color: number = Colors.borderInstalling): void {
    this.ripples.push({
      x,
      y,
      startTime: Date.now(),
      duration: 400,
      color,
    });
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
    });

    // Also spawn a ripple for extra impact
    this.spawnRipple(x, y, Colors.borderConflict);
  }

  /**
   * Spawn a particle burst for install success
   */
  spawnBurst(x: number, y: number, color: number = Colors.borderReady): void {
    const particles: ParticleBurst['particles'] = [];
    const count = 8;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 2 + Math.random() * 2;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        alpha: 1,
      });
    }

    this.bursts.push({
      x,
      y,
      startTime: Date.now(),
      count,
      color,
      particles,
    });
  }

  /**
   * Get shake offset for a conflicting node
   */
  getConflictShake(conflictProgress: number): { x: number; y: number } {
    if (conflictProgress <= 0) {
      // Idle conflict shake
      const shake = Math.sin(Date.now() * 0.02) * 2;
      return { x: shake, y: 0 };
    }
    // No shake during resolution
    return { x: 0, y: 0 };
  }

  getContainer(): Container {
    return this.container;
  }

  clear(): void {
    this.ripples = [];
    this.bursts = [];
    this.flashes = [];
    this.rippleGraphics.clear();
    this.particleGraphics.clear();
    this.flashGraphics.clear();
  }
}
