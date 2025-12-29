// Edge indicators for off-screen events (conflicts, symlinks, prestige)

import { Graphics, Container, type Application } from 'pixi.js';
import { gameState } from '../game/state';
import { isInPackageScope } from '../game/scope';
import { getAllDuplicateGroups } from '../game/symlinks';
import { Colors } from './colors';
import { prefersReducedMotion } from './accessibility';

interface EdgeIndicator {
  worldX: number;
  worldY: number;
  color: number;
  size: number;
  pulseRate: number; // cycles per second
  persistent: boolean;
  id: string; // for deduplication
}

interface Vignette {
  color: number;
  alpha: number;
  edges: ('top' | 'bottom' | 'left' | 'right')[];
}

export class EdgeIndicatorRenderer {
  private container: Container;
  private arrowGraphics: Graphics;
  private vignetteGraphics: Graphics;

  // Track first conflict for special treatment
  private hasSeenFirstConflict = false;
  private firstConflictTime = 0;
  private hasActiveConflict = false;

  // World-to-screen conversion function (set by renderer)
  private worldToScreen: ((x: number, y: number) => { x: number; y: number }) | null = null;

  constructor(_app: Application) {
    this.container = new Container();
    this.container.label = 'edge-indicators';

    // Vignette behind arrows
    this.vignetteGraphics = new Graphics();
    this.vignetteGraphics.label = 'vignette';
    this.container.addChild(this.vignetteGraphics);

    this.arrowGraphics = new Graphics();
    this.arrowGraphics.label = 'arrows';
    this.container.addChild(this.arrowGraphics);
  }

  /**
   * Set coordinate conversion function (called by main renderer)
   */
  setWorldToScreen(
    worldToScreen: (x: number, y: number) => { x: number; y: number }
  ): void {
    this.worldToScreen = worldToScreen;
  }

  /**
   * Update edge indicators each frame
   */
  update(screenWidth: number, screenHeight: number): void {
    if (!this.worldToScreen) return;

    this.arrowGraphics.clear();
    this.vignetteGraphics.clear();

    // Edge indicators only work at root scope for now
    if (isInPackageScope()) return;

    const indicators: EdgeIndicator[] = [];
    const vignettes: Vignette[] = [];
    const margin = 40; // Viewport margin for "on-screen" detection
    const now = Date.now();

    // Track if any conflicts exist
    this.hasActiveConflict = false;

    // Check for conflicts (both on-screen and off-screen)
    for (const wire of gameState.wires.values()) {
      if (!wire.conflicted) continue;

      // Track that we have at least one active conflict
      this.hasActiveConflict = true;

      const fromPkg = gameState.packages.get(wire.fromId);
      const toPkg = gameState.packages.get(wire.toId);
      if (!fromPkg || !toPkg) continue;

      // Track first conflict (regardless of on/off screen)
      if (!this.hasSeenFirstConflict) {
        this.hasSeenFirstConflict = true;
        this.firstConflictTime = now;
      }

      // Use wire midpoint as indicator position
      const midX = (fromPkg.position.x + toPkg.position.x) / 2;
      const midY = (fromPkg.position.y + toPkg.position.y) / 2;
      const screenPos = this.worldToScreen(midX, midY);

      // Only show edge indicator if off-screen
      if (this.isOffScreen(screenPos.x, screenPos.y, screenWidth, screenHeight, margin)) {
        indicators.push({
          worldX: midX,
          worldY: midY,
          color: Colors.borderConflict,
          size: 20,
          pulseRate: 3, // Fast pulse
          persistent: true,
          id: `conflict-${wire.id}`,
        });

        // Add vignette for conflicts
        const edge = this.getClosestEdge(screenPos.x, screenPos.y, screenWidth, screenHeight);
        if (edge && !vignettes.some(v => v.edges.includes(edge))) {
          vignettes.push({
            color: Colors.borderConflict,
            alpha: 0.15,
            edges: [edge],
          });
        }
      }
    }

    // Check for off-screen symlink opportunities
    const duplicateGroups = getAllDuplicateGroups();
    for (const group of duplicateGroups) {
      if (group.packageIds.length < 2) continue;

      // Check if any duplicates are off-screen while others are on-screen
      let hasOnScreen = false;
      let offScreenPos: { x: number; y: number } | null = null;

      for (const pkgId of group.packageIds) {
        const pkg = gameState.packages.get(pkgId);
        if (!pkg) continue;

        const screenPos = this.worldToScreen(pkg.position.x, pkg.position.y);
        if (this.isOffScreen(screenPos.x, screenPos.y, screenWidth, screenHeight, margin)) {
          if (!offScreenPos) {
            offScreenPos = { x: pkg.position.x, y: pkg.position.y };
          }
        } else {
          hasOnScreen = true;
        }
      }

      // Only show indicator if some are on-screen and some off-screen
      if (hasOnScreen && offScreenPos) {
        indicators.push({
          worldX: offScreenPos.x,
          worldY: offScreenPos.y,
          color: group.haloColor,
          size: 12,
          pulseRate: 1.5,
          persistent: false, // Fades after 5s
          id: `symlink-${group.identityName}`,
        });
      }
    }

    // Check for prestige ready (off-screen root with high weight)
    if (gameState.resources.weight >= 100000) {
      const rootPkg = gameState.rootId ? gameState.packages.get(gameState.rootId) : null;
      if (rootPkg) {
        const screenPos = this.worldToScreen(rootPkg.position.x, rootPkg.position.y);
        if (this.isOffScreen(screenPos.x, screenPos.y, screenWidth, screenHeight, margin)) {
          indicators.push({
            worldX: rootPkg.position.x,
            worldY: rootPkg.position.y,
            color: 0xa78bfa, // Purple
            size: 24,
            pulseRate: 1,
            persistent: true,
            id: 'prestige',
          });

          // Subtle purple vignette
          vignettes.push({
            color: 0xa78bfa,
            alpha: 0.1,
            edges: ['top', 'bottom', 'left', 'right'],
          });
        }
      }
    }

    // First conflict special treatment - full edge vignette
    if (this.hasSeenFirstConflict && now - this.firstConflictTime < 500) {
      const flashProgress = (now - this.firstConflictTime) / 500;
      const flashAlpha = 0.2 * (1 - flashProgress);
      vignettes.push({
        color: Colors.borderConflict,
        alpha: flashAlpha,
        edges: ['top', 'bottom', 'left', 'right'],
      });
    }

    // Draw vignettes
    this.drawVignettes(vignettes, screenWidth, screenHeight);

    // Draw indicators
    for (const indicator of indicators) {
      this.drawEdgeArrow(indicator, screenWidth, screenHeight, now);
    }
  }

  /**
   * Check if a screen position is off-screen
   */
  private isOffScreen(
    x: number,
    y: number,
    screenWidth: number,
    screenHeight: number,
    margin: number
  ): boolean {
    return x < margin || x > screenWidth - margin || y < margin || y > screenHeight - margin;
  }

  /**
   * Get the closest screen edge for a position
   */
  private getClosestEdge(
    x: number,
    y: number,
    screenWidth: number,
    screenHeight: number
  ): 'top' | 'bottom' | 'left' | 'right' | null {
    const distances = {
      left: x,
      right: screenWidth - x,
      top: y,
      bottom: screenHeight - y,
    };

    let closest: 'top' | 'bottom' | 'left' | 'right' = 'left';
    let minDist = Infinity;

    for (const [edge, dist] of Object.entries(distances)) {
      if (dist < minDist) {
        minDist = dist;
        closest = edge as typeof closest;
      }
    }

    return closest;
  }

  /**
   * Draw an arrow at the screen edge pointing toward a world position
   */
  private drawEdgeArrow(
    indicator: EdgeIndicator,
    screenWidth: number,
    screenHeight: number,
    now: number
  ): void {
    if (!this.worldToScreen) return;

    const screenPos = this.worldToScreen(indicator.worldX, indicator.worldY);
    const padding = 20;

    // Clamp position to screen edge
    const clampedX = Math.max(padding, Math.min(screenWidth - padding, screenPos.x));
    const clampedY = Math.max(padding, Math.min(screenHeight - padding, screenPos.y));

    // Calculate angle from edge to target
    const angle = Math.atan2(screenPos.y - clampedY, screenPos.x - clampedX);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Pulsing effect (static for reduced motion)
    const reducedMotion = prefersReducedMotion();
    const pulsePhase = reducedMotion ? 0.5 : (now * indicator.pulseRate / 1000) % 1;
    const pulse = reducedMotion ? 0.8 : 0.6 + 0.4 * Math.sin(pulsePhase * Math.PI * 2);
    const size = indicator.size * (reducedMotion ? 1 : (0.9 + 0.1 * pulse));
    const alpha = reducedMotion ? 0.85 : 0.7 + 0.3 * pulse;

    // Helper to rotate and translate a point
    const transform = (x: number, y: number) => ({
      x: clampedX + x * cos - y * sin,
      y: clampedY + x * sin + y * cos,
    });

    // Arrow shape vertices (pointing right, will be rotated)
    const tip = transform(size * 0.6, 0);
    const backTop = transform(-size * 0.4, -size * 0.5);
    const notch = transform(-size * 0.2, 0);
    const backBottom = transform(-size * 0.4, size * 0.5);

    // Draw arrow
    this.arrowGraphics.moveTo(tip.x, tip.y);
    this.arrowGraphics.lineTo(backTop.x, backTop.y);
    this.arrowGraphics.lineTo(notch.x, notch.y);
    this.arrowGraphics.lineTo(backBottom.x, backBottom.y);
    this.arrowGraphics.closePath();
    this.arrowGraphics.fill({ color: indicator.color, alpha });

    // Glow effect
    this.arrowGraphics.circle(clampedX, clampedY, size * 0.8);
    this.arrowGraphics.fill({ color: indicator.color, alpha: alpha * 0.2 });
  }

  /**
   * Draw edge vignettes
   */
  private drawVignettes(
    vignettes: Vignette[],
    screenWidth: number,
    screenHeight: number
  ): void {
    const vignetteSize = 60;

    for (const vignette of vignettes) {
      for (const edge of vignette.edges) {
        switch (edge) {
          case 'top':
            this.drawGradientRect(
              0, 0, screenWidth, vignetteSize,
              vignette.color, vignette.alpha, 'down'
            );
            break;
          case 'bottom':
            this.drawGradientRect(
              0, screenHeight - vignetteSize, screenWidth, vignetteSize,
              vignette.color, vignette.alpha, 'up'
            );
            break;
          case 'left':
            this.drawGradientRect(
              0, 0, vignetteSize, screenHeight,
              vignette.color, vignette.alpha, 'right'
            );
            break;
          case 'right':
            this.drawGradientRect(
              screenWidth - vignetteSize, 0, vignetteSize, screenHeight,
              vignette.color, vignette.alpha, 'left'
            );
            break;
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
    const steps = 8;

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const stepAlpha = alpha * (1 - t);

      let sx = x, sy = y, sw = width, sh = height;

      switch (direction) {
        case 'down':
          sy = y + (height * t);
          sh = height / steps;
          break;
        case 'up':
          sy = y + height - (height * (t + 1) / steps);
          sh = height / steps;
          break;
        case 'right':
          sx = x + (width * t);
          sw = width / steps;
          break;
        case 'left':
          sx = x + width - (width * (t + 1) / steps);
          sw = width / steps;
          break;
      }

      this.vignetteGraphics.rect(sx, sy, sw, sh);
      this.vignetteGraphics.fill({ color, alpha: stepAlpha });
    }
  }

  /**
   * Reset first conflict tracking (for new game/prestige)
   */
  resetFirstConflict(): void {
    this.hasSeenFirstConflict = false;
    this.firstConflictTime = 0;
    this.hasActiveConflict = false;
  }

  /**
   * Check if we're in the first conflict treatment window (first 2 seconds)
   * Returns a value 0-1 for dimming intensity (1 = full dim, fades to 0)
   */
  getFirstConflictDimming(): number {
    if (!this.hasSeenFirstConflict || !this.hasActiveConflict) return 0;

    const now = Date.now();
    const elapsed = now - this.firstConflictTime;
    const treatmentDuration = 2000; // 2 seconds of dimming

    if (elapsed >= treatmentDuration) return 0;

    // Fade out the dimming effect over the treatment duration
    return 1 - (elapsed / treatmentDuration);
  }

  /**
   * Get extra pulse intensity for conflict wires during first conflict
   * Returns 0-1 where 1 = extra bright
   */
  getFirstConflictWirePulse(): number {
    if (!this.hasSeenFirstConflict) return 0;

    const now = Date.now();
    const elapsed = now - this.firstConflictTime;

    // 3 pulses over 1.5 seconds
    if (elapsed >= 1500) return 0;

    // Pulse 3 times with increasing brightness
    const pulsePhase = (elapsed / 500) % 1; // 3 pulses in 1.5s
    const pulseNumber = Math.floor(elapsed / 500); // 0, 1, 2
    const baseIntensity = 0.3 + (pulseNumber * 0.2); // 0.3, 0.5, 0.7

    return baseIntensity * Math.sin(pulsePhase * Math.PI);
  }

  getContainer(): Container {
    return this.container;
  }

  clear(): void {
    this.arrowGraphics.clear();
    this.vignetteGraphics.clear();
  }
}
