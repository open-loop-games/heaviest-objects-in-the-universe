// Node rendering with Pixi.js

import { Graphics, Container, type Application } from 'pixi.js';
import type { Package, VersionShape } from '../game/types';
import { Colors, getNodeColor, getBorderColor, getShapeColor } from './colors';
import { drawIcon, hasIcon } from './icons';

const NODE_RADIUS = 25;
const NODE_RADIUS_HUB = 32; // Larger for hub packages
const NODE_RADIUS_SMALL = 20; // Smaller for deep dependencies
const SHAPE_SIZE = 12;

export interface NodeEffects {
  pulseIntensity: number;  // 0-1 for root pulse
  shake: { x: number; y: number };  // Offset for conflict shake
  showHint: boolean;  // Show click hint
}

/**
 * Get node radius based on package properties
 */
function getNodeRadius(pkg: Package): number {
  // Root is always normal size
  if (pkg.parentId === null) return NODE_RADIUS;

  // Hub packages are larger
  if (pkg.identity?.isHub) return NODE_RADIUS_HUB;

  // Deep dependencies are smaller
  if (pkg.depth >= 3) return NODE_RADIUS_SMALL;

  return NODE_RADIUS;
}

export class NodeRenderer {
  private app: Application;
  private container: Container;
  private nodeGraphics: Map<string, Graphics> = new Map();

  constructor(app: Application) {
    this.app = app;
    this.container = new Container();
    this.container.label = 'nodes';
    this.app.stage.addChild(this.container);
  }

  /**
   * Update or create graphics for a package
   */
  updateNode(pkg: Package, effects?: NodeEffects): void {
    let graphics = this.nodeGraphics.get(pkg.id);

    if (!graphics) {
      graphics = new Graphics();
      graphics.label = pkg.id;
      graphics.eventMode = 'static';
      graphics.cursor = 'pointer';
      this.nodeGraphics.set(pkg.id, graphics);
      this.container.addChild(graphics);
    }

    this.drawNode(graphics, pkg, effects);

    // Update position with shake offset
    const shakeX = effects?.shake.x || 0;
    const shakeY = effects?.shake.y || 0;
    graphics.x = pkg.position.x + shakeX;
    graphics.y = pkg.position.y + shakeY;
  }

  /**
   * Draw a node's graphics
   */
  private drawNode(graphics: Graphics, pkg: Package, effects?: NodeEffects): void {
    graphics.clear();

    const radius = getNodeRadius(pkg);
    const fillColor = getNodeColor(pkg.state);
    const borderColor = getBorderColor(pkg.state);
    const shapeColor = getShapeColor(pkg.version);
    const pulseIntensity = effects?.pulseIntensity || 0;

    // Scale shape size based on node radius
    const shapeScale = radius / NODE_RADIUS;

    // Check if package has an icon
    const iconKey = pkg.identity?.iconKey;
    const hasPackageIcon = iconKey && hasIcon(iconKey);

    // Pulse glow for root node (onboarding)
    if (pulseIntensity > 0) {
      const pulseRadius = radius + 8 + pulseIntensity * 6;
      const pulseAlpha = pulseIntensity * 0.4;
      graphics.circle(0, 0, pulseRadius);
      graphics.fill({ color: Colors.borderInstalling, alpha: pulseAlpha });
    }

    // Outer glow for optimized nodes
    if (pkg.state === 'optimized') {
      graphics.circle(0, 0, radius + 4);
      graphics.fill({ color: Colors.borderOptimized, alpha: 0.3 });
    }

    // Main circle
    graphics.circle(0, 0, radius);
    graphics.fill({ color: fillColor });

    // Heat fill (rises from bottom like thermometer)
    if (pkg.heat > 0) {
      this.drawHeatFill(graphics, pkg.heat, radius);
    }

    // Border - thicker and brighter when pulsing
    const borderWidth = pulseIntensity > 0 ? 3 : 2;
    const borderAlpha = pulseIntensity > 0 ? 0.8 + pulseIntensity * 0.2 : 1;
    graphics.stroke({ color: borderColor, width: borderWidth, alpha: borderAlpha });

    // Installation progress ring
    if (pkg.state === 'installing' && pkg.installProgress < 1) {
      this.drawProgressRing(graphics, pkg.installProgress, Colors.borderInstalling, radius);
    }

    // Conflict progress ring (resolution in progress)
    if (pkg.state === 'conflict' && pkg.conflictProgress > 0) {
      this.drawProgressRing(graphics, pkg.conflictProgress, Colors.shapeCircle, radius);
    }

    // Draw icon or version shape in center
    if (hasPackageIcon && iconKey) {
      // Draw package icon with state-based color
      const iconColor = this.getIconColor(pkg.state);
      const iconSize = radius * 1.4;
      drawIcon(graphics, iconKey, iconSize, iconColor);

      // Draw version shape as small badge in corner (for conflict mechanics)
      this.drawVersionBadge(graphics, pkg.version, shapeColor, radius);
    } else {
      // No icon - draw version shape centered
      this.drawVersionShape(graphics, pkg.version, shapeColor, shapeScale);
    }

    // Conflict indicator - red outer ring
    if (pkg.state === 'conflict') {
      graphics.circle(0, 0, radius + 3);
      graphics.stroke({ color: Colors.borderConflict, width: 2, alpha: 0.7 });
    }

    // Click hint for root (pulsing arrow or indicator)
    if (effects?.showHint && pulseIntensity > 0.5) {
      this.drawClickHint(graphics, pulseIntensity, radius);
    }
  }

  /**
   * Get icon color based on package state
   */
  private getIconColor(state: string): number {
    switch (state) {
      case 'installing':
        return 0x6a6a8a; // Dimmed gray-blue
      case 'ready':
        return 0xccccee; // Bright white-blue
      case 'conflict':
        return 0xff8888; // Red tint
      case 'optimized':
        return 0x88ffcc; // Cyan/green tint
      default:
        return 0xaaaacc; // Neutral
    }
  }

  /**
   * Draw version shape as small badge in corner
   */
  private drawVersionBadge(graphics: Graphics, version: VersionShape, color: number, nodeRadius: number): void {
    const badgeX = nodeRadius * 0.55;
    const badgeY = nodeRadius * 0.55;
    const badgeSize = 6;

    // Background circle for badge
    graphics.circle(badgeX, badgeY, badgeSize + 2);
    graphics.fill({ color: 0x1a1a2a, alpha: 0.9 });

    // Draw mini version shape
    switch (version) {
      case 'circle':
        graphics.circle(badgeX, badgeY, badgeSize * 0.6);
        graphics.fill({ color });
        break;
      case 'square':
        graphics.rect(badgeX - badgeSize * 0.5, badgeY - badgeSize * 0.5, badgeSize, badgeSize);
        graphics.fill({ color });
        break;
      case 'triangle':
        graphics.moveTo(badgeX, badgeY - badgeSize * 0.6);
        graphics.lineTo(badgeX + badgeSize * 0.5, badgeY + badgeSize * 0.4);
        graphics.lineTo(badgeX - badgeSize * 0.5, badgeY + badgeSize * 0.4);
        graphics.closePath();
        graphics.fill({ color });
        break;
      case 'diamond':
        graphics.moveTo(badgeX, badgeY - badgeSize * 0.6);
        graphics.lineTo(badgeX + badgeSize * 0.5, badgeY);
        graphics.lineTo(badgeX, badgeY + badgeSize * 0.6);
        graphics.lineTo(badgeX - badgeSize * 0.5, badgeY);
        graphics.closePath();
        graphics.fill({ color });
        break;
      case 'star':
        // Simple star
        graphics.circle(badgeX, badgeY, badgeSize * 0.5);
        graphics.fill({ color });
        graphics.circle(badgeX, badgeY, badgeSize * 0.3);
        graphics.fill({ color: 0xffffff, alpha: 0.5 });
        break;
    }
  }

  /**
   * Draw click hint indicator
   */
  private drawClickHint(graphics: Graphics, intensity: number, radius: number): void {
    const alpha = (intensity - 0.5) * 2; // Only show when pulse > 0.5
    const y = radius + 15;

    // Small downward arrow
    graphics.moveTo(0, y - 5);
    graphics.lineTo(5, y);
    graphics.lineTo(0, y + 5);
    graphics.lineTo(-5, y);
    graphics.closePath();
    graphics.fill({ color: Colors.borderInstalling, alpha: alpha * 0.8 });
  }

  /**
   * Draw heat fill rising from bottom (thermometer style)
   */
  private drawHeatFill(graphics: Graphics, heat: number, radius: number): void {
    const normalizedHeat = Math.min(1, heat / 100); // Assume max heat 100
    if (normalizedHeat <= 0) return;

    const fillHeight = radius * 2 * normalizedHeat;
    const bottomY = radius;
    const topY = bottomY - fillHeight;

    // Color gradient based on heat level
    let heatColor: number;
    if (normalizedHeat < 0.3) {
      heatColor = Colors.shapeTriangle; // Orange-ish
    } else if (normalizedHeat < 0.6) {
      heatColor = 0xff7a3a; // Deeper orange
    } else {
      heatColor = Colors.borderConflict; // Red
    }

    // Draw clipped fill (circle intersection with rect)
    // Use a semicircle arc from bottom
    const clipRadius = radius - 2;

    graphics.beginPath();
    // Start from left edge at fill level
    const startAngle = Math.acos(Math.max(-1, Math.min(1, topY / clipRadius)));
    const endAngle = Math.PI - startAngle;

    if (normalizedHeat >= 1) {
      // Full circle
      graphics.circle(0, 0, clipRadius);
    } else {
      // Partial arc
      graphics.arc(0, 0, clipRadius, startAngle, endAngle);
    }
    graphics.closePath();
    graphics.fill({ color: heatColor, alpha: 0.4 });
  }

  /**
   * Draw progress ring around node
   */
  private drawProgressRing(graphics: Graphics, progress: number, color: number, radius: number): void {
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (Math.PI * 2 * progress);

    graphics.arc(0, 0, radius + 5, startAngle, endAngle);
    graphics.stroke({ color, width: 3 });
  }

  /**
   * Draw version shape in center of node
   */
  private drawVersionShape(graphics: Graphics, version: VersionShape, color: number, scale: number = 1): void {
    const size = SHAPE_SIZE * scale;

    switch (version) {
      case 'circle':
        graphics.circle(0, 0, size / 2);
        graphics.fill({ color });
        break;

      case 'square':
        graphics.rect(-size / 2, -size / 2, size, size);
        graphics.fill({ color });
        break;

      case 'triangle':
        graphics.moveTo(0, -size / 2);
        graphics.lineTo(size / 2, size / 2);
        graphics.lineTo(-size / 2, size / 2);
        graphics.closePath();
        graphics.fill({ color });
        break;

      case 'diamond':
        graphics.moveTo(0, -size / 2);
        graphics.lineTo(size / 2, 0);
        graphics.lineTo(0, size / 2);
        graphics.lineTo(-size / 2, 0);
        graphics.closePath();
        graphics.fill({ color });
        break;

      case 'star':
        this.drawStar(graphics, 0, 0, 5, size / 2, size / 4, color);
        break;
    }
  }

  /**
   * Draw a star shape
   */
  private drawStar(
    graphics: Graphics,
    cx: number,
    cy: number,
    points: number,
    outerRadius: number,
    innerRadius: number,
    color: number
  ): void {
    const step = Math.PI / points;

    graphics.moveTo(cx, cy - outerRadius);

    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = -Math.PI / 2 + step * i;
      graphics.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }

    graphics.closePath();
    graphics.fill({ color });
  }

  /**
   * Remove a node's graphics
   */
  removeNode(id: string): void {
    const graphics = this.nodeGraphics.get(id);
    if (graphics) {
      this.container.removeChild(graphics);
      graphics.destroy();
      this.nodeGraphics.delete(id);
    }
  }

  /**
   * Get graphics for hit testing
   */
  getNodeGraphics(id: string): Graphics | undefined {
    return this.nodeGraphics.get(id);
  }

  /**
   * Get all node graphics
   */
  getAllNodeGraphics(): Map<string, Graphics> {
    return this.nodeGraphics;
  }

  /**
   * Clear all nodes
   */
  clear(): void {
    for (const graphics of this.nodeGraphics.values()) {
      graphics.destroy();
    }
    this.nodeGraphics.clear();
    this.container.removeChildren();
  }

  /**
   * Get the container for z-ordering
   */
  getContainer(): Container {
    return this.container;
  }
}
