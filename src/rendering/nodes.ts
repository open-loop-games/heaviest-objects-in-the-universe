// Node rendering with Pixi.js

import { Graphics, Container, type Application } from 'pixi.js';
import type { Package } from '../game/types';
import { Colors, getNodeColor, getBorderColor } from './colors';
import { createIconGraphics, isIconReady, drawFallbackIcon, drawProceduralIcon } from './icons';
import { prefersReducedMotion } from './accessibility';

const NODE_RADIUS = 25;
const NODE_RADIUS_ROOT = 38; // Largest for root (package.json)
const NODE_RADIUS_TOP_LEVEL = 34; // Top-level packages with internal trees
const NODE_RADIUS_HUB = 32; // Larger for hub packages
const NODE_RADIUS_SMALL = 20; // Smaller for deep dependencies

export interface NodeEffects {
  pulseIntensity: number;  // 0-1 for root pulse
  shake: { x: number; y: number };  // Offset for conflict shake
  showHint: boolean;  // Show click hint
  duplicateHalo?: {
    color: number;
    pulsePhase: number; // 0-1, synced across group
  };
  isDragging?: boolean; // Node is being dragged for symlink
  isDropTarget?: boolean; // Node is a valid drop target
  dimAmount?: number; // 0-1, dims the node for first conflict treatment
  // Internal state glow for top-level packages (scope system)
  internalState?: 'pristine' | 'unstable' | 'stable' | null;
  // Ghost node rendering (cross-package symlink)
  isGhost?: boolean;
  ghostTargetScope?: string | null; // Package ID where real node lives
}

/**
 * Get node radius based on package properties
 */
export function getNodeRadius(pkg: Package): number {
  // Root (package.json) is largest - the anchor point
  if (pkg.parentId === null) return NODE_RADIUS_ROOT;

  // Top-level packages with internal trees are larger (visually distinct)
  if (pkg.internalPackages !== null) return NODE_RADIUS_TOP_LEVEL;

  // Hub packages are larger
  if (pkg.identity?.isHub) return NODE_RADIUS_HUB;

  // Deep dependencies are smaller
  if (pkg.depth >= 3) return NODE_RADIUS_SMALL;

  return NODE_RADIUS;
}

interface NodeContainer {
  container: Container;
  shape: Graphics;
  icon: Graphics | null;
  lastIconKey: string | null;
}

export class NodeRenderer {
  private app: Application;
  private nodesLayer: Container;
  private nodeContainers: Map<string, NodeContainer> = new Map();

  constructor(app: Application) {
    this.app = app;
    this.nodesLayer = new Container();
    this.nodesLayer.label = 'nodes';
    this.app.stage.addChild(this.nodesLayer);
  }

  /**
   * Update or create graphics for a package
   */
  updateNode(pkg: Package, effects?: NodeEffects): void {
    let nodeData = this.nodeContainers.get(pkg.id);

    if (!nodeData) {
      const container = new Container();
      container.label = pkg.id;
      container.eventMode = 'static';
      container.cursor = 'pointer';

      const shape = new Graphics();
      shape.label = 'shape';
      container.addChild(shape);

      nodeData = {
        container,
        shape,
        icon: null,
        lastIconKey: null
      };

      this.nodeContainers.set(pkg.id, nodeData);
      this.nodesLayer.addChild(container);
    }

    const iconKey = pkg.identity?.iconKey || null;
    const radius = getNodeRadius(pkg);
    const iconSize = radius * 1.4;

    // For "npm" iconKey, always use procedural icons (don't load the generic npm SVG)
    const useProceduralIcon = iconKey === 'npm' && pkg.identity?.name;
    const effectiveIconKey = useProceduralIcon ? null : iconKey;

    // Update icon if iconKey changed or icon just became ready
    if (effectiveIconKey !== nodeData.lastIconKey || (effectiveIconKey && !nodeData.icon && isIconReady(effectiveIconKey))) {
      // Remove old icon
      if (nodeData.icon) {
        nodeData.container.removeChild(nodeData.icon);
        nodeData.icon.destroy();
        nodeData.icon = null;
      }

      // Try to create new icon (skip for npm - use procedural instead)
      if (effectiveIconKey) {
        const iconGraphics = createIconGraphics(effectiveIconKey, iconSize);
        if (iconGraphics) {
          nodeData.icon = iconGraphics;
          nodeData.icon.label = 'icon';
          nodeData.container.addChild(nodeData.icon);
        }
      }

      nodeData.lastIconKey = effectiveIconKey;
    }

    // Draw the shape (circle, border, effects)
    this.drawNode(nodeData.shape, pkg, effects);

    // Draw procedural icon for npm packages (unique per package name + archetype)
    if (useProceduralIcon) {
      drawProceduralIcon(nodeData.shape, pkg.identity!.name, iconSize, pkg.identity!.archetype);
    }
    // Draw fallback icon if no SVG icon loaded for other packages
    else if (effectiveIconKey && !nodeData.icon) {
      const iconColor = this.getIconColor(pkg.state);
      drawFallbackIcon(nodeData.shape, effectiveIconKey, iconSize, iconColor);
    }

    // Update position with shake offset
    const shakeX = effects?.shake.x || 0;
    const shakeY = effects?.shake.y || 0;
    nodeData.container.x = pkg.position.x + shakeX;
    nodeData.container.y = pkg.position.y + shakeY;

    // Apply dimming for first conflict treatment
    const dimAmount = effects?.dimAmount || 0;
    nodeData.container.alpha = 1 - (dimAmount * 0.4); // Dim to 0.6 at max
  }

  /**
   * Draw a node's graphics (shape only, icon handled separately)
   */
  private drawNode(graphics: Graphics, pkg: Package, effects?: NodeEffects): void {
    graphics.clear();

    const radius = getNodeRadius(pkg);
    const fillColor = getNodeColor(pkg.state);
    const borderColor = getBorderColor(pkg.state);
    const pulseIntensity = effects?.pulseIntensity || 0;

    // Ghost nodes have special rendering (dashed, transparent)
    if (effects?.isGhost) {
      this.drawGhostNode(graphics, pkg, radius, effects);
      return;
    }

    // Duplicate halo (draw first, behind everything)
    if (effects?.duplicateHalo) {
      this.drawDuplicateHalo(graphics, radius, effects.duplicateHalo.color, effects.duplicateHalo.pulsePhase);
    }

    // Internal state glow for top-level packages (scope system)
    if (effects?.internalState) {
      this.drawInternalStateGlow(graphics, radius, effects.internalState);
    }

    // Drop target highlight (when dragging a duplicate over this)
    if (effects?.isDropTarget) {
      const dropRadius = radius + 12;
      const dropAlpha = 0.4 + 0.2 * Math.sin(Date.now() * 0.01);
      graphics.circle(0, 0, dropRadius);
      graphics.fill({ color: 0x5affff, alpha: dropAlpha });
    }

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

    // Root node (package.json) - distinctive anchor glow
    const isRoot = pkg.parentId === null;
    if (isRoot) {
      // Outer golden ring - the anchor point
      graphics.circle(0, 0, radius + 6);
      graphics.stroke({ color: 0xffd700, width: 2, alpha: 0.6 });
      // Inner warm glow
      graphics.circle(0, 0, radius + 3);
      graphics.fill({ color: 0xffa500, alpha: 0.15 });
    }

    // Main circle
    graphics.circle(0, 0, radius);
    graphics.fill({ color: fillColor });

    // Border - thicker for root, thicker when pulsing
    const baseBorderWidth = isRoot ? 3 : 2;
    const borderWidth = pulseIntensity > 0 ? baseBorderWidth + 1 : baseBorderWidth;
    const borderAlpha = pulseIntensity > 0 ? 0.8 + pulseIntensity * 0.2 : 1;
    graphics.stroke({ color: borderColor, width: borderWidth, alpha: borderAlpha });

    // Portal rings for top-level packages (drawn on top of main circle)
    if (effects?.internalState) {
      this.drawPortalRings(graphics, radius, effects.internalState);
    }

    // Installation progress ring
    if (pkg.state === 'installing' && pkg.installProgress < 1) {
      this.drawProgressRing(graphics, pkg.installProgress, Colors.borderInstalling, radius);
    }

    // Conflict progress ring (resolution in progress)
    if (pkg.state === 'conflict' && pkg.conflictProgress > 0) {
      this.drawProgressRing(graphics, pkg.conflictProgress, Colors.shapeCircle, radius);
    }

    // Note: icon is handled separately as a child Graphics, fallback drawn in updateNode if needed

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
   * Draw a ghost node (symlinked-away reference)
   * Visual: Semi-transparent, dashed border, symlink indicator
   */
  private drawGhostNode(graphics: Graphics, _pkg: Package, radius: number, _effects: NodeEffects): void {
    const reducedMotion = prefersReducedMotion();
    const time = Date.now() * 0.002;
    const breathe = reducedMotion ? 0.5 : (Math.sin(time) + 1) / 2;

    // Ghost color - cyan/teal tint
    const ghostColor = Colors.borderOptimized;
    const ghostAlpha = 0.3 + breathe * 0.15;

    // Outer glow (subtle, pulsing)
    graphics.circle(0, 0, radius + 4);
    graphics.fill({ color: ghostColor, alpha: ghostAlpha * 0.3 });

    // Main circle (semi-transparent fill)
    graphics.circle(0, 0, radius);
    graphics.fill({ color: 0x1a2a3a, alpha: 0.5 });

    // Dashed border (draw segments manually)
    this.drawDashedCircle(graphics, radius, ghostColor, 2, ghostAlpha + 0.3);

    // Symlink arrow indicator (⤳) - draw as arrow pointing right
    const arrowSize = radius * 0.5;
    const arrowX = 0;
    const arrowY = 0;

    // Arrow shaft
    graphics.moveTo(arrowX - arrowSize * 0.6, arrowY);
    graphics.lineTo(arrowX + arrowSize * 0.3, arrowY);
    graphics.stroke({ color: ghostColor, width: 2, alpha: 0.8 });

    // Arrow head
    graphics.moveTo(arrowX + arrowSize * 0.3, arrowY);
    graphics.lineTo(arrowX, arrowY - arrowSize * 0.3);
    graphics.moveTo(arrowX + arrowSize * 0.3, arrowY);
    graphics.lineTo(arrowX, arrowY + arrowSize * 0.3);
    graphics.stroke({ color: ghostColor, width: 2, alpha: 0.8 });

    // Curved tail (symlink indicator ⤳ style)
    graphics.moveTo(arrowX - arrowSize * 0.6, arrowY);
    graphics.quadraticCurveTo(
      arrowX - arrowSize * 0.8, arrowY - arrowSize * 0.4,
      arrowX - arrowSize * 0.5, arrowY - arrowSize * 0.5
    );
    graphics.stroke({ color: ghostColor, width: 2, alpha: 0.6 });
  }

  /**
   * Draw a dashed circle
   */
  private drawDashedCircle(
    graphics: Graphics,
    radius: number,
    color: number,
    width: number,
    alpha: number
  ): void {
    const dashCount = 16;
    const dashAngle = (Math.PI * 2) / dashCount;
    const dashLength = dashAngle * 0.6;
    // gapLength = dashAngle * 0.4 (implicit from dashLength)

    for (let i = 0; i < dashCount; i++) {
      const startAngle = i * dashAngle;
      const endAngle = startAngle + dashLength;

      graphics.arc(0, 0, radius, startAngle, endAngle);
      graphics.stroke({ color, width, alpha });
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
   * Draw progress ring around node (prominent and visible)
   */
  private drawProgressRing(graphics: Graphics, progress: number, color: number, radius: number): void {
    const ringRadius = radius + 8;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (Math.PI * 2 * progress);
    const reducedMotion = prefersReducedMotion();

    // Background track (shows full circle faintly)
    graphics.circle(0, 0, ringRadius);
    graphics.stroke({ color: 0x2a2a4a, width: 5, alpha: 0.6 });

    // Outer glow for the progress (pulsing)
    const glowPulse = reducedMotion ? 0.4 : 0.3 + 0.2 * Math.sin(Date.now() * 0.005);
    graphics.arc(0, 0, ringRadius + 3, startAngle, endAngle);
    graphics.stroke({ color, width: 8, alpha: glowPulse });

    // Main progress arc (thick and bright)
    graphics.arc(0, 0, ringRadius, startAngle, endAngle);
    graphics.stroke({ color, width: 5, alpha: 1 });

    // Leading edge highlight (bright dot at progress front)
    if (progress > 0.02 && progress < 0.98) {
      const edgeX = Math.cos(endAngle) * ringRadius;
      const edgeY = Math.sin(endAngle) * ringRadius;
      graphics.circle(edgeX, edgeY, 4);
      graphics.fill({ color: 0xffffff, alpha: 0.9 });
    }
  }

  /**
   * Draw pulsing halo for duplicate packages
   */
  private drawDuplicateHalo(graphics: Graphics, radius: number, color: number, pulsePhase: number): void {
    // For reduced motion, use static values
    const reducedMotion = prefersReducedMotion();
    const effectivePhase = reducedMotion ? 0.5 : pulsePhase;

    // Pulsing alpha based on phase (synced across group)
    const baseAlpha = 0.2;
    const pulseAlpha = reducedMotion ? 0 : 0.15 * Math.sin(effectivePhase * Math.PI * 2);
    const alpha = baseAlpha + pulseAlpha;

    // Outer halo ring (static size for reduced motion)
    const haloRadius = radius + 8 + (reducedMotion ? 1.5 : effectivePhase * 3);
    graphics.circle(0, 0, haloRadius);
    graphics.stroke({ color, width: 3, alpha: alpha + 0.1 });

    // Inner glow
    graphics.circle(0, 0, radius + 4);
    graphics.fill({ color, alpha: alpha * 0.5 });
  }

  /**
   * Draw internal state glow for top-level packages (scope system)
   * - pristine: pulsing blue (invites entry)
   * - unstable: red/orange pulse (needs attention)
   * - stable: steady green/cyan (resolved)
   *
   * Includes concentric rings to show "there's a world inside"
   */
  private drawInternalStateGlow(
    graphics: Graphics,
    radius: number,
    state: 'pristine' | 'unstable' | 'stable'
  ): void {
    const reducedMotion = prefersReducedMotion();
    const time = Date.now() * 0.003;
    const pulse = reducedMotion ? 0.5 : (Math.sin(time) + 1) / 2;

    let color: number;
    let baseAlpha: number;
    let pulseAlpha: number;
    let glowRadius: number;

    switch (state) {
      case 'pristine':
        // Inviting blue pulse - "click to explore"
        color = 0x22d3ee; // Cyan
        baseAlpha = 0.15;
        pulseAlpha = 0.2 * pulse;
        glowRadius = radius + 6 + pulse * 4;
        break;

      case 'unstable':
        // Warning red/orange pulse - "needs attention"
        color = 0xff6b6b; // Soft red
        baseAlpha = 0.2;
        pulseAlpha = 0.25 * pulse;
        glowRadius = radius + 5 + pulse * 3;
        break;

      case 'stable':
        // Steady green - "all resolved"
        color = 0x4ade80; // Green
        baseAlpha = 0.2;
        pulseAlpha = reducedMotion ? 0 : 0.1 * pulse; // Subtle pulse
        glowRadius = radius + 4;
        break;
    }

    // Outer glow ring
    graphics.circle(0, 0, glowRadius);
    graphics.stroke({ color, width: 3, alpha: baseAlpha + pulseAlpha });

    // Inner glow fill (behind the node)
    graphics.circle(0, 0, radius + 3);
    graphics.fill({ color, alpha: (baseAlpha + pulseAlpha) * 0.4 });
  }

  /**
   * Draw the inner portal rings on top of the node (called after main circle)
   * Creates concentric rings that pulse inward like a tunnel entrance
   */
  private drawPortalRings(
    graphics: Graphics,
    radius: number,
    state: 'pristine' | 'unstable' | 'stable'
  ): void {
    const reducedMotion = prefersReducedMotion();
    const time = Date.now() * 0.003;

    let color: number;
    let baseAlpha: number;

    switch (state) {
      case 'pristine':
        color = 0x22d3ee; // Cyan
        baseAlpha = 0.4;
        break;
      case 'unstable':
        color = 0xff6b6b; // Soft red
        baseAlpha = 0.45;
        break;
      case 'stable':
        color = 0x4ade80; // Green
        baseAlpha = 0.35;
        break;
    }

    // CONCENTRIC RINGS - "portal effect" showing there's a world inside
    // Draw 3 inner rings that pulse inward like a tunnel
    const ringCount = 3;
    for (let i = 0; i < ringCount; i++) {
      // Stagger the pulse phase for each ring (creates wave effect)
      const ringPhase = reducedMotion ? 0.5 : ((time * 0.5 + i * 0.33) % 1);
      const ringPulse = (Math.sin(ringPhase * Math.PI * 2) + 1) / 2;

      // Inner rings get progressively smaller and more transparent
      const ringRadius = radius * (0.75 - i * 0.2) + ringPulse * 2;
      const ringAlpha = baseAlpha * (0.7 - i * 0.2);

      graphics.circle(0, 0, ringRadius);
      graphics.stroke({ color, width: 2, alpha: ringAlpha });
    }

    // Center glow dot - the "entrance point"
    const dotPulse = reducedMotion ? 0.5 : (Math.sin(time * 2) + 1) / 2;
    const dotRadius = 4 + dotPulse * 3;
    const dotAlpha = baseAlpha * 0.9;
    graphics.circle(0, 0, dotRadius);
    graphics.fill({ color, alpha: dotAlpha });
  }

  /**
   * Remove a node's graphics
   */
  removeNode(id: string): void {
    const nodeData = this.nodeContainers.get(id);
    if (nodeData) {
      this.nodesLayer.removeChild(nodeData.container);
      if (nodeData.icon) {
        nodeData.icon.destroy();
      }
      nodeData.shape.destroy();
      nodeData.container.destroy();
      this.nodeContainers.delete(id);
    }
  }

  /**
   * Get container for hit testing
   */
  getNodeGraphics(id: string): Container | undefined {
    return this.nodeContainers.get(id)?.container;
  }

  /**
   * Get all node containers
   */
  getAllNodeGraphics(): Map<string, Container> {
    const result = new Map<string, Container>();
    for (const [id, data] of this.nodeContainers) {
      result.set(id, data.container);
    }
    return result;
  }

  /**
   * Clear all nodes
   */
  clear(): void {
    for (const nodeData of this.nodeContainers.values()) {
      if (nodeData.icon) {
        nodeData.icon.destroy();
      }
      nodeData.shape.destroy();
      nodeData.container.destroy();
    }
    this.nodeContainers.clear();
    this.nodesLayer.removeChildren();
  }

  /**
   * Get the container for z-ordering
   */
  getContainer(): Container {
    return this.nodesLayer;
  }
}
