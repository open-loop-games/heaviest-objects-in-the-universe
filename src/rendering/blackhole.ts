// Black hole and gravity effects renderer for prestige visualization

import { Graphics, Container, type Application } from 'pixi.js';
import { Colors } from './colors';
import { gameState, gameConfig } from '../game/state';

// Gravity stages based on weight progress toward prestige
const GRAVITY_STAGES = {
  NONE: 0,
  WARP_START: 0.1,      // 10% - subtle background warping
  DRIFT: 0.25,          // 25% - nodes drift toward center
  PULL_VISIBLE: 0.5,    // 50% - visible gravity field lines
  CORE_VISIBLE: 0.75,   // 75% - black hole core appears
  COLLAPSE_IMMINENT: 0.9, // 90% - intense effects, screen shake
};

interface GravityLine {
  angle: number;
  speed: number;
  offset: number;
}

interface CollapseParticle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  delay: number;
  color: number;
}

export class BlackHoleRenderer {
  private container: Container;
  private backgroundContainer: Container;
  private coreContainer: Container;

  private warpGraphics: Graphics;
  private fieldGraphics: Graphics;
  private coreGraphics: Graphics;
  private collapseGraphics: Graphics;

  private gravityLines: GravityLine[] = [];
  private phase = 0;

  // Collapse animation state
  private isCollapsing = false;
  private collapseProgress = 0;
  private collapseParticles: CollapseParticle[] = [];
  private onCollapseComplete: (() => void) | null = null;

  // Screen shake
  private shakeIntensity = 0;
  private shakeOffset = { x: 0, y: 0 };

  constructor(_app: Application) {
    this.container = new Container();
    this.container.label = 'blackhole';

    // Background effects (behind world)
    this.backgroundContainer = new Container();
    this.backgroundContainer.label = 'blackhole-bg';

    // Core effects (in front of world during collapse)
    this.coreContainer = new Container();
    this.coreContainer.label = 'blackhole-core';

    this.warpGraphics = new Graphics();
    this.fieldGraphics = new Graphics();
    this.coreGraphics = new Graphics();
    this.collapseGraphics = new Graphics();

    this.backgroundContainer.addChild(this.warpGraphics);
    this.backgroundContainer.addChild(this.fieldGraphics);
    this.coreContainer.addChild(this.coreGraphics);
    this.coreContainer.addChild(this.collapseGraphics);

    this.container.addChild(this.backgroundContainer);
    this.container.addChild(this.coreContainer);

    // Initialize gravity field lines
    for (let i = 0; i < 24; i++) {
      this.gravityLines.push({
        angle: (Math.PI * 2 * i) / 24,
        speed: 0.5 + Math.random() * 0.5,
        offset: Math.random() * 100,
      });
    }
  }

  /**
   * Get the current gravity progress (0-1) based on weight
   */
  private getGravityProgress(): number {
    const threshold = gameConfig.prestigeWeightThreshold;
    return Math.min(1, gameState.resources.weight / threshold);
  }

  /**
   * Update all black hole effects
   */
  update(deltaTime: number, screenWidth: number, screenHeight: number): void {
    this.phase += deltaTime;
    const progress = this.getGravityProgress();

    // Clear all graphics
    this.warpGraphics.clear();
    this.fieldGraphics.clear();
    this.coreGraphics.clear();
    this.collapseGraphics.clear();

    // Handle collapse animation
    if (this.isCollapsing) {
      this.updateCollapse(deltaTime, screenWidth, screenHeight);
      return;
    }

    // Update screen shake
    if (progress >= GRAVITY_STAGES.COLLAPSE_IMMINENT) {
      this.shakeIntensity = (progress - GRAVITY_STAGES.COLLAPSE_IMMINENT) / (1 - GRAVITY_STAGES.COLLAPSE_IMMINENT);
      const shake = this.shakeIntensity * 4;
      this.shakeOffset.x = (Math.random() - 0.5) * shake;
      this.shakeOffset.y = (Math.random() - 0.5) * shake;
    } else {
      this.shakeIntensity = 0;
      this.shakeOffset.x = 0;
      this.shakeOffset.y = 0;
    }

    // Draw effects based on progress
    if (progress >= GRAVITY_STAGES.WARP_START) {
      this.drawBackgroundWarp(progress, screenWidth, screenHeight);
    }

    if (progress >= GRAVITY_STAGES.PULL_VISIBLE) {
      this.drawGravityField(progress);
    }

    if (progress >= GRAVITY_STAGES.CORE_VISIBLE) {
      this.drawCore(progress);
    }
  }

  /**
   * Draw subtle background warping effect
   */
  private drawBackgroundWarp(progress: number, _width: number, _height: number): void {
    const intensity = Math.min(1, (progress - GRAVITY_STAGES.WARP_START) / (1 - GRAVITY_STAGES.WARP_START));

    // Draw concentric distortion rings
    const numRings = 5;
    for (let i = 0; i < numRings; i++) {
      const baseRadius = 150 + i * 80;
      const wobble = Math.sin(this.phase * 2 + i * 0.5) * 10 * intensity;
      const radius = baseRadius + wobble;

      const alpha = 0.03 + intensity * 0.05 * (1 - i / numRings);

      this.warpGraphics.circle(0, 0, radius);
      this.warpGraphics.fill({ color: Colors.gravityWarp, alpha });
    }

    // Draw vignette effect toward edges
    const vignetteRadius = 400 - intensity * 100;
    for (let r = 0; r < 5; r++) {
      const radius = vignetteRadius + r * 50;
      const alpha = 0.02 + intensity * 0.03;
      this.warpGraphics.circle(0, 0, radius);
      this.warpGraphics.stroke({ color: 0x1a0a2a, width: 30, alpha });
    }
  }

  /**
   * Draw gravity field lines being pulled toward center
   */
  private drawGravityField(progress: number): void {
    const intensity = (progress - GRAVITY_STAGES.PULL_VISIBLE) / (1 - GRAVITY_STAGES.PULL_VISIBLE);

    for (const line of this.gravityLines) {
      // Animate lines flowing inward
      const flowPos = ((this.phase * line.speed + line.offset) % 1);
      const startDist = 300 + flowPos * 200;
      const endDist = 100 + flowPos * 150;

      const startX = Math.cos(line.angle) * startDist;
      const startY = Math.sin(line.angle) * startDist;
      const endX = Math.cos(line.angle) * endDist;
      const endY = Math.sin(line.angle) * endDist;

      // Curve toward center
      const midDist = (startDist + endDist) / 2;
      const midAngle = line.angle + Math.sin(this.phase * 3 + line.offset) * 0.1;
      const midX = Math.cos(midAngle) * midDist * 0.8;
      const midY = Math.sin(midAngle) * midDist * 0.8;

      const alpha = 0.1 + intensity * 0.3 * (1 - flowPos);
      const color = this.lerpColor(Colors.gravityWarp, 0x7a5aff, intensity);

      this.fieldGraphics.moveTo(startX, startY);
      this.fieldGraphics.quadraticCurveTo(midX, midY, endX, endY);
      this.fieldGraphics.stroke({ color, width: 1 + intensity, alpha });
    }

    // Inner swirl
    const swirlIntensity = intensity * 0.5;
    for (let i = 0; i < 3; i++) {
      const swirlAngle = this.phase * (0.5 + i * 0.2) + (Math.PI * 2 * i) / 3;
      const spiralPoints: { x: number; y: number }[] = [];

      for (let t = 0; t < 20; t++) {
        const dist = 40 + t * 8;
        const angle = swirlAngle + t * 0.2;
        spiralPoints.push({
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
        });
      }

      if (spiralPoints.length > 1) {
        const first = spiralPoints[0]!;
        this.fieldGraphics.moveTo(first.x, first.y);
        for (let j = 1; j < spiralPoints.length; j++) {
          const point = spiralPoints[j]!;
          this.fieldGraphics.lineTo(point.x, point.y);
        }
        this.fieldGraphics.stroke({
          color: 0x5a3aaa,
          width: 2,
          alpha: swirlIntensity * (1 - i * 0.2)
        });
      }
    }
  }

  /**
   * Draw the black hole core
   */
  private drawCore(progress: number): void {
    const intensity = (progress - GRAVITY_STAGES.CORE_VISIBLE) / (1 - GRAVITY_STAGES.CORE_VISIBLE);

    // Event horizon (black center)
    const coreRadius = 20 + intensity * 30;
    const pulseRadius = coreRadius + Math.sin(this.phase * 4) * 5 * intensity;

    // Outer glow rings
    for (let i = 4; i >= 0; i--) {
      const glowRadius = pulseRadius + i * 15;
      const glowAlpha = 0.1 + intensity * 0.15 * (1 - i / 5);
      const color = this.lerpColor(0x3a1a5a, 0x7a5aff, i / 5);

      this.coreGraphics.circle(0, 0, glowRadius);
      this.coreGraphics.fill({ color, alpha: glowAlpha });
    }

    // Accretion disk effect
    const diskOuter = pulseRadius + 60;
    const diskInner = pulseRadius + 10;

    this.coreGraphics.ellipse(0, 0, diskOuter, diskOuter * 0.3);
    this.coreGraphics.stroke({
      color: 0xaa7aff,
      width: 3,
      alpha: 0.3 + intensity * 0.3
    });

    // Inner bright ring
    this.coreGraphics.circle(0, 0, diskInner);
    this.coreGraphics.stroke({
      color: 0xffaaff,
      width: 2,
      alpha: 0.4 + intensity * 0.4
    });

    // Black core
    this.coreGraphics.circle(0, 0, pulseRadius * 0.7);
    this.coreGraphics.fill({ color: 0x000000, alpha: 0.9 });

    // Singularity point
    this.coreGraphics.circle(0, 0, 3);
    this.coreGraphics.fill({ color: 0xffffff, alpha: 0.3 + Math.sin(this.phase * 8) * 0.2 });
  }

  /**
   * Start the collapse animation
   */
  startCollapse(onComplete: () => void): void {
    if (this.isCollapsing) return;

    this.isCollapsing = true;
    this.collapseProgress = 0;
    this.onCollapseComplete = onComplete;
    this.collapseParticles = [];

    // Create particles from all packages
    for (const pkg of gameState.packages.values()) {
      this.collapseParticles.push({
        x: pkg.position.x,
        y: pkg.position.y,
        targetX: 0,
        targetY: 0,
        delay: Math.random() * 0.3,
        color: pkg.state === 'conflict' ? Colors.borderConflict : Colors.borderReady,
      });
    }
  }

  /**
   * Update collapse animation
   */
  private updateCollapse(deltaTime: number, screenWidth: number, screenHeight: number): void {
    this.collapseProgress += deltaTime * 0.7; // ~1.4 second collapse

    // Screen shake during collapse
    const shakeAmount = Math.max(0, 1 - this.collapseProgress) * 8;
    this.shakeOffset.x = (Math.random() - 0.5) * shakeAmount;
    this.shakeOffset.y = (Math.random() - 0.5) * shakeAmount;

    // Draw collapsing particles
    for (const particle of this.collapseParticles) {
      const t = Math.max(0, Math.min(1, (this.collapseProgress - particle.delay) / 0.7));

      // Ease-in for acceleration toward center
      const eased = t * t * t;

      // Spiral path toward center
      const spiralAngle = Math.atan2(particle.y, particle.x) + eased * Math.PI * 2;
      const dist = Math.sqrt(particle.x * particle.x + particle.y * particle.y);
      const currentDist = dist * (1 - eased);

      const x = Math.cos(spiralAngle) * currentDist;
      const y = Math.sin(spiralAngle) * currentDist;

      const size = 8 * (1 - eased * 0.5);
      const alpha = 1 - eased * 0.3;

      this.collapseGraphics.circle(x, y, size);
      this.collapseGraphics.fill({ color: particle.color, alpha });

      // Trail
      if (t > 0.1) {
        const trailDist = currentDist + 20;
        const trailX = Math.cos(spiralAngle - 0.2) * trailDist;
        const trailY = Math.sin(spiralAngle - 0.2) * trailDist;

        this.collapseGraphics.moveTo(x, y);
        this.collapseGraphics.lineTo(trailX, trailY);
        this.collapseGraphics.stroke({ color: particle.color, width: 2, alpha: alpha * 0.5 });
      }
    }

    // Growing black hole during collapse
    const holeSize = 20 + this.collapseProgress * 150;

    // Outer glow
    for (let i = 3; i >= 0; i--) {
      const radius = holeSize + i * 30;
      this.collapseGraphics.circle(0, 0, radius);
      this.collapseGraphics.fill({
        color: 0x3a1a5a,
        alpha: 0.2 * (1 - i / 4)
      });
    }

    // Core
    this.collapseGraphics.circle(0, 0, holeSize);
    this.collapseGraphics.fill({ color: 0x000000, alpha: 0.95 });

    // Bright ring
    this.collapseGraphics.circle(0, 0, holeSize * 0.9);
    this.collapseGraphics.stroke({ color: 0xaa7aff, width: 3, alpha: 0.7 });

    // Flash at the end
    if (this.collapseProgress > 0.85) {
      const flashProgress = (this.collapseProgress - 0.85) / 0.15;
      const flashAlpha = Math.sin(flashProgress * Math.PI);

      this.collapseGraphics.rect(-screenWidth, -screenHeight, screenWidth * 2, screenHeight * 2);
      this.collapseGraphics.fill({ color: 0xffffff, alpha: flashAlpha * 0.8 });
    }

    // Complete
    if (this.collapseProgress >= 1) {
      this.isCollapsing = false;
      this.collapseParticles = [];
      if (this.onCollapseComplete) {
        this.onCollapseComplete();
        this.onCollapseComplete = null;
      }
    }
  }

  /**
   * Linear interpolate between two colors
   */
  private lerpColor(color1: number, color2: number, t: number): number {
    const r1 = (color1 >> 16) & 0xff;
    const g1 = (color1 >> 8) & 0xff;
    const b1 = color1 & 0xff;

    const r2 = (color2 >> 16) & 0xff;
    const g2 = (color2 >> 8) & 0xff;
    const b2 = color2 & 0xff;

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return (r << 16) | (g << 8) | b;
  }

  /**
   * Get screen shake offset for camera
   */
  getShakeOffset(): { x: number; y: number } {
    return this.shakeOffset;
  }

  /**
   * Check if collapse animation is playing
   */
  isCollapseAnimating(): boolean {
    return this.isCollapsing;
  }

  /**
   * Get the current gravity progress for external use
   */
  getGravityProgressValue(): number {
    return this.getGravityProgress();
  }

  getBackgroundContainer(): Container {
    return this.backgroundContainer;
  }

  getCoreContainer(): Container {
    return this.coreContainer;
  }

  getContainer(): Container {
    return this.container;
  }

  clear(): void {
    this.warpGraphics.clear();
    this.fieldGraphics.clear();
    this.coreGraphics.clear();
    this.collapseGraphics.clear();
    this.isCollapsing = false;
    this.collapseParticles = [];
  }
}
