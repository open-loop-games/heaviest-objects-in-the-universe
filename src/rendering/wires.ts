// Wire rendering with Pixi.js

import { Graphics, Container, type Application } from 'pixi.js';
import type { Wire, Package } from '../game/types';
import { Colors } from './colors';
import { prefersReducedMotion } from './accessibility';
import { getNodeRadius } from './nodes';

// Store wire endpoint positions for hit testing
export interface WireEndpoints {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  midX: number;
  midY: number;
}

export class WireRenderer {
  private app: Application;
  private container: Container;
  private wireGraphics: Map<string, Graphics> = new Map();
  private wireEndpoints: Map<string, WireEndpoints> = new Map();

  constructor(app: Application) {
    this.app = app;
    this.container = new Container();
    this.container.label = 'wires';
    this.app.stage.addChild(this.container);
  }

  /**
   * Update or create graphics for a wire
   */
  updateWire(wire: Wire, fromPkg: Package, toPkg: Package): void {
    let graphics = this.wireGraphics.get(wire.id);

    if (!graphics) {
      graphics = new Graphics();
      graphics.label = wire.id;
      this.wireGraphics.set(wire.id, graphics);
      this.container.addChild(graphics);
    }

    this.drawWire(graphics, wire, fromPkg, toPkg);

    // Store endpoints for hit testing
    const x1 = fromPkg.position.x;
    const y1 = fromPkg.position.y;
    const x2 = toPkg.position.x;
    const y2 = toPkg.position.y;
    this.wireEndpoints.set(wire.id, {
      x1, y1, x2, y2,
      midX: (x1 + x2) / 2,
      midY: (y1 + y2) / 2,
    });
  }

  /**
   * Draw a wire between two packages
   */
  private drawWire(graphics: Graphics, wire: Wire, from: Package, to: Package): void {
    graphics.clear();

    const x1 = from.position.x;
    const y1 = from.position.y;
    const x2 = to.position.x;
    const y2 = to.position.y;

    // Calculate direction
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1) return;

    // Normalize
    const nx = dx / dist;
    const ny = dy / dist;

    // Offset from node centers based on actual node radii
    const fromRadius = getNodeRadius(from);
    const toRadius = getNodeRadius(to);
    const startX = x1 + nx * fromRadius;
    const startY = y1 + ny * fromRadius;
    const endX = x2 - nx * toRadius;
    const endY = y2 - ny * toRadius;

    // Sibling wires (cross-package conflicts): curved arc above
    if (wire.wireType === 'sibling') {
      this.drawSiblingWire(graphics, startX, startY, endX, endY, wire.conflictTime);
      return;
    }

    // Use wire.conflicted for conflict detection
    const isConflicted = wire.conflicted;

    // Draw conflicted wires specially
    if (isConflicted) {
      this.drawConflictedWire(graphics, startX, startY, endX, endY, wire.conflictTime);
      return;
    }

    // Draw based on wire type
    if (wire.wireType === 'symlink') {
      // Symlink: glowing cyan dashed line
      this.drawGlowingLine(graphics, startX, startY, endX, endY, Colors.wireSymlink);
      this.drawDashedLine(graphics, startX, startY, endX, endY, Colors.wireSymlink, 2, 8, 4);
    } else {
      // Regular dependency: solid line
      graphics.moveTo(startX, startY);
      graphics.lineTo(endX, endY);
      graphics.stroke({ color: Colors.wireDefault, width: 2 });
    }

    // Flow particle (not for symlinks)
    if (wire.wireType !== 'symlink') {
      this.drawFlowParticle(graphics, startX, startY, endX, endY, wire.flowProgress);
    }
  }

  /**
   * Draw a sibling conflict wire (curved arc between two packages)
   * Uses a quadratic curve that arcs above the packages
   */
  private drawSiblingWire(
    graphics: Graphics,
    x1: number, y1: number,
    x2: number, y2: number,
    conflictTime: number
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1) return;

    // Control point: above the midpoint (curve upward)
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const arcHeight = Math.min(dist * 0.4, 80); // Arc proportional to distance
    const controlX = midX;
    const controlY = midY - arcHeight; // Curve upward (negative Y)

    const reducedMotion = prefersReducedMotion();
    const time = Date.now() - conflictTime;
    const pulsePhase = (time % 600) / 600;

    // Outer glow (pulsing)
    const glowAlpha = reducedMotion ? 0.25 : 0.15 + 0.15 * Math.sin(pulsePhase * Math.PI * 2);
    graphics.moveTo(x1, y1);
    graphics.quadraticCurveTo(controlX, controlY, x2, y2);
    graphics.stroke({ color: Colors.borderConflict, width: 10, alpha: glowAlpha });

    // Base arc
    graphics.moveTo(x1, y1);
    graphics.quadraticCurveTo(controlX, controlY, x2, y2);
    graphics.stroke({ color: Colors.borderConflict, width: 3, alpha: 0.8 });

    // Dashed overlay for sibling distinction
    if (!reducedMotion) {
      const dashOffset = (time % 1000) / 1000;
      this.drawDashedCurve(graphics, x1, y1, controlX, controlY, x2, y2, 0xffaa5a, 2, dashOffset);
    }

    // Warning indicator at midpoint of curve
    const curveT = 0.5;
    const indicatorX = (1 - curveT) * (1 - curveT) * x1 + 2 * (1 - curveT) * curveT * controlX + curveT * curveT * x2;
    const indicatorY = (1 - curveT) * (1 - curveT) * y1 + 2 * (1 - curveT) * curveT * controlY + curveT * curveT * y2;

    // Pulsing warning circle
    const indicatorScale = reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(pulsePhase * Math.PI * 2);
    graphics.circle(indicatorX, indicatorY, 8 * indicatorScale);
    graphics.fill({ color: Colors.borderConflict, alpha: 0.9 });
    graphics.circle(indicatorX, indicatorY, 4 * indicatorScale);
    graphics.fill({ color: 0xffff5a, alpha: 1 }); // Bright center
  }

  /**
   * Draw a dashed quadratic curve
   */
  private drawDashedCurve(
    graphics: Graphics,
    x1: number, y1: number,
    cx: number, cy: number,
    x2: number, y2: number,
    color: number,
    width: number,
    offset: number
  ): void {
    const segments = 12;
    const dashLength = 0.08;
    // gapLength = 0.08 (implicit, equal to dashLength)

    for (let i = 0; i < segments; i++) {
      const t1 = ((i / segments) + offset) % 1;
      const t2 = Math.min(t1 + dashLength, 1);

      if (t2 <= t1) continue;

      // Quadratic bezier formula
      const sx = (1 - t1) * (1 - t1) * x1 + 2 * (1 - t1) * t1 * cx + t1 * t1 * x2;
      const sy = (1 - t1) * (1 - t1) * y1 + 2 * (1 - t1) * t1 * cy + t1 * t1 * y2;
      const ex = (1 - t2) * (1 - t2) * x1 + 2 * (1 - t2) * t2 * cx + t2 * t2 * x2;
      const ey = (1 - t2) * (1 - t2) * y1 + 2 * (1 - t2) * t2 * cy + t2 * t2 * y2;

      graphics.moveTo(sx, sy);
      graphics.lineTo(ex, ey);
      graphics.stroke({ color, width, alpha: 0.7 });
    }
  }

  /**
   * Draw a conflicted wire with crackling electric effect
   */
  private drawConflictedWire(
    graphics: Graphics,
    x1: number, y1: number,
    x2: number, y2: number,
    conflictTime: number
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1) return;

    const reducedMotion = prefersReducedMotion();

    // For reduced motion: static red wire with glow, no animation
    if (reducedMotion) {
      // Static outer glow
      graphics.moveTo(x1, y1);
      graphics.lineTo(x2, y2);
      graphics.stroke({ color: Colors.borderConflict, width: 8, alpha: 0.3 });

      // Static base wire
      graphics.moveTo(x1, y1);
      graphics.lineTo(x2, y2);
      graphics.stroke({ color: Colors.borderConflict, width: 3.5, alpha: 0.9 });
      return;
    }

    // Normalized direction
    const nx = dx / dist;
    const ny = dy / dist;

    // Perpendicular for crackling offset
    const px = -ny;
    const py = nx;

    // Animation time
    const time = Date.now() - conflictTime;
    const pulsePhase = (time % 500) / 500; // 0-1 pulse over 500ms

    // Draw outer glow (pulsing)
    const glowAlpha = 0.2 + 0.15 * Math.sin(pulsePhase * Math.PI * 2);
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y2);
    graphics.stroke({ color: Colors.borderConflict, width: 8, alpha: glowAlpha });

    // Draw base wire (thicker, red/orange gradient)
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y2);
    graphics.stroke({ color: Colors.borderConflict, width: 3.5, alpha: 0.9 });

    // Draw crackling electric bolts along the wire
    const segments = Math.max(3, Math.floor(dist / 25));

    // Different crackle pattern based on time
    const crackleOffset = Math.floor(time / 100) % 3;

    for (let i = 0; i < segments; i++) {
      // Alternate which segments have crackle
      if ((i + crackleOffset) % 3 !== 0) continue;

      const t1 = i / segments;
      const t2 = (i + 1) / segments;

      const sx = x1 + dx * t1;
      const sy = y1 + dy * t1;
      const ex = x1 + dx * t2;
      const ey = y1 + dy * t2;

      // Mid-point with random perpendicular offset
      const midT = (t1 + t2) / 2;
      const crackleAmount = 8 + Math.sin(time * 0.01 + i) * 4;
      const crackleDir = ((i + Math.floor(time / 50)) % 2) * 2 - 1; // -1 or 1
      const mx = x1 + dx * midT + px * crackleAmount * crackleDir;
      const my = y1 + dy * midT + py * crackleAmount * crackleDir;

      // Draw crackling bolt
      graphics.moveTo(sx, sy);
      graphics.lineTo(mx, my);
      graphics.lineTo(ex, ey);
      graphics.stroke({ color: 0xffaa5a, width: 2, alpha: 0.8 }); // Orange crackling

      // Small spark at junction
      graphics.circle(mx, my, 2);
      graphics.fill({ color: 0xffff5a, alpha: 0.9 }); // Bright spark
    }
  }

  /**
   * Draw a glowing line effect (for symlinks)
   */
  private drawGlowingLine(
    graphics: Graphics,
    x1: number, y1: number,
    x2: number, y2: number,
    color: number
  ): void {
    // Outer glow
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y2);
    graphics.stroke({ color, width: 6, alpha: 0.2 });

    // Inner glow
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y2);
    graphics.stroke({ color, width: 4, alpha: 0.3 });
  }

  /**
   * Draw a dashed line with configurable dash/gap
   */
  private drawDashedLine(
    graphics: Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: number,
    width: number,
    dashLength: number = 8,
    gapLength: number = 4
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const totalLength = dashLength + gapLength;

    const nx = dx / dist;
    const ny = dy / dist;

    let currentDist = 0;

    while (currentDist < dist) {
      const dashEnd = Math.min(currentDist + dashLength, dist);

      graphics.moveTo(x1 + nx * currentDist, y1 + ny * currentDist);
      graphics.lineTo(x1 + nx * dashEnd, y1 + ny * dashEnd);
      graphics.stroke({ color, width });

      currentDist += totalLength;
    }
  }

  /**
   * Draw a flow particle along the wire
   */
  private drawFlowParticle(
    graphics: Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    progress: number
  ): void {
    const x = x1 + (x2 - x1) * progress;
    const y = y1 + (y2 - y1) * progress;

    graphics.circle(x, y, 3);
    graphics.fill({ color: Colors.wireFlow });

    // Glow effect
    graphics.circle(x, y, 5);
    graphics.fill({ color: Colors.wireFlow, alpha: 0.3 });
  }

  /**
   * Remove a wire's graphics
   */
  removeWire(id: string): void {
    const graphics = this.wireGraphics.get(id);
    if (graphics) {
      this.container.removeChild(graphics);
      graphics.destroy();
      this.wireGraphics.delete(id);
    }
    this.wireEndpoints.delete(id);
  }

  /**
   * Get all wire IDs for cleanup
   */
  getAllWireIds(): string[] {
    return Array.from(this.wireGraphics.keys());
  }

  /**
   * Clear all wires
   */
  clear(): void {
    for (const graphics of this.wireGraphics.values()) {
      graphics.destroy();
    }
    this.wireGraphics.clear();
    this.wireEndpoints.clear();
    this.container.removeChildren();
  }

  /**
   * Get the container for z-ordering
   */
  getContainer(): Container {
    return this.container;
  }

  /**
   * Find the wire ID at a given world position
   * Returns the wire ID if within threshold, null otherwise
   */
  findWireAtPosition(x: number, y: number, threshold: number = 15): string | null {
    for (const [wireId, endpoints] of this.wireEndpoints) {
      const dist = this.distanceToLineSegment(
        x, y,
        endpoints.x1, endpoints.y1,
        endpoints.x2, endpoints.y2
      );
      if (dist <= threshold) {
        return wireId;
      }
    }
    return null;
  }

  /**
   * Get endpoints for a wire (for drawing action buttons)
   */
  getWireEndpoints(wireId: string): WireEndpoints | undefined {
    return this.wireEndpoints.get(wireId);
  }

  /**
   * Calculate distance from point to line segment
   */
  private distanceToLineSegment(
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
      // Line segment is a point
      return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    }

    // Parameter t for projection onto line
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t)); // Clamp to segment

    // Closest point on segment
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;

    return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
  }
}
