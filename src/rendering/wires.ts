// Wire rendering with Pixi.js

import { Graphics, Container, type Application } from 'pixi.js';
import type { Wire, Package } from '../game/types';
import { Colors } from './colors';

export class WireRenderer {
  private app: Application;
  private container: Container;
  private wireGraphics: Map<string, Graphics> = new Map();

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

    // Offset from node centers
    const offset = 28;
    const startX = x1 + nx * offset;
    const startY = y1 + ny * offset;
    const endX = x2 - nx * offset;
    const endY = y2 - ny * offset;

    // Check for conflict (either end is in conflict state)
    const isConflictPath = from.state === 'conflict' || to.state === 'conflict';

    // Draw based on wire type
    switch (wire.wireType) {
      case 'symlink':
        // Symlink: glowing cyan dashed line
        this.drawGlowingLine(graphics, startX, startY, endX, endY, Colors.wireSymlink);
        this.drawDashedLine(graphics, startX, startY, endX, endY, Colors.wireSymlink, 2, 8, 4);
        break;

      case 'devDependency':
        // Dev dep: dotted line (short dashes)
        this.drawDashedLine(graphics, startX, startY, endX, endY,
          isConflictPath ? Colors.borderConflict : 0x6a6a8a, 1.5, 3, 5);
        break;

      case 'peerDependency':
        // Peer dep: long dashes
        this.drawDashedLine(graphics, startX, startY, endX, endY,
          isConflictPath ? Colors.borderConflict : 0x8a6a8a, 2, 12, 6);
        break;

      case 'dependency':
      default:
        // Regular: solid line
        if (isConflictPath) {
          // Conflict path: thicker red line
          graphics.moveTo(startX, startY);
          graphics.lineTo(endX, endY);
          graphics.stroke({ color: Colors.borderConflict, width: 3, alpha: 0.8 });
        } else {
          graphics.moveTo(startX, startY);
          graphics.lineTo(endX, endY);
          graphics.stroke({ color: Colors.wireDefault, width: 2 });
        }
        break;
    }

    // Flow particle (not for symlinks or conflict paths)
    if (wire.wireType !== 'symlink' && !isConflictPath) {
      this.drawFlowParticle(graphics, startX, startY, endX, endY, wire.flowProgress);
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
  }

  /**
   * Clear all wires
   */
  clear(): void {
    for (const graphics of this.wireGraphics.values()) {
      graphics.destroy();
    }
    this.wireGraphics.clear();
    this.container.removeChildren();
  }

  /**
   * Get the container for z-ordering
   */
  getContainer(): Container {
    return this.container;
  }
}
