// Node rendering with Pixi.js

import { Graphics, Container, type Application } from 'pixi.js'
import type { Package, PendingSpawn } from '../game/types'
import { DEP_SPAWN_COST } from '../game/config'
import { Colors, getNodeColor, getBorderColor } from './colors'
import { createPackageIcon, isIconReady } from './icons'
import { prefersReducedMotion } from './accessibility'
import {
  getSpaghettification,
  isCollapseActive,
  isPackageAbsorbed,
} from '../game/physics'

const NODE_RADIUS = 25
const NODE_RADIUS_ROOT = 38 // Largest for root (package.json)
const NODE_RADIUS_TOP_LEVEL = 34 // Top-level packages with internal trees
const NODE_RADIUS_HUB = 32 // Larger for hub packages
const NODE_RADIUS_SMALL = 20 // Smaller for deep dependencies

export interface NodeEffects {
  pulseIntensity: number // 0-1 for root pulse
  shake: { x: number; y: number } // Offset for conflict shake
  wigglePhase?: number // 0-1 for wiggle animation (non-draggable feedback)
  showHint: boolean // Show click hint
  duplicateHalo?: {
    color: number
    pulsePhase: number // 0-1, synced across group
    canAfford: boolean // Whether symlink merge is affordable
    isHovered: boolean // Group is being hovered (boost intensity)
    isFirstDuplicate: boolean // First time seeing duplicates (heavy teaching)
  }
  isDragging?: boolean // Node is being dragged for symlink
  isDropTarget?: boolean // Node is a valid drop target
  dimAmount?: number // 0-1, dims the node for first conflict treatment
  // Internal state glow for top-level packages (scope system)
  internalState?: 'pristine' | 'unstable' | 'stable' | null
  // Ghost node rendering (cross-package symlink)
  isGhost?: boolean
  ghostTargetScope?: string | null // Package ID where real node lives
  // Depth rewards
  isGolden?: boolean // Golden package glow
  hasCacheFragment?: boolean // Cache fragment indicator
  // Celebration scale (for stable pop effect)
  celebrationScale?: number
  // Scope root stable indicator (checkmark badge when inside stable scope)
  isScopeRootStable?: boolean
}

/**
 * Get node radius based on package properties
 */
export function getNodeRadius(pkg: Package): number {
  // Root (package.json) is largest - the anchor point
  if (pkg.parentId === null) return NODE_RADIUS_ROOT

  // Top-level packages with internal trees are larger (visually distinct)
  if (pkg.internalPackages !== null) return NODE_RADIUS_TOP_LEVEL

  // Hub packages are larger
  if (pkg.identity?.isHub) return NODE_RADIUS_HUB

  // Deep dependencies are smaller
  if (pkg.depth >= 3) return NODE_RADIUS_SMALL

  return NODE_RADIUS
}

interface NodeContainer {
  container: Container
  shape: Graphics
  icon: Graphics | null
  lastIconKey: string | null
}

export class NodeRenderer {
  private app: Application
  private nodesLayer: Container
  private nodeContainers: Map<string, NodeContainer> = new Map()
  private queuedDepsGraphics: Graphics

  constructor(app: Application) {
    this.app = app
    this.nodesLayer = new Container()
    this.nodesLayer.label = 'nodes'
    this.app.stage.addChild(this.nodesLayer)

    // Graphics for rendering queued deps (awaiting bandwidth)
    this.queuedDepsGraphics = new Graphics()
    this.queuedDepsGraphics.label = 'queued-deps'
    this.nodesLayer.addChild(this.queuedDepsGraphics)
  }

  /**
   * Update or create graphics for a package
   */
  updateNode(pkg: Package, effects?: NodeEffects): void {
    let nodeData = this.nodeContainers.get(pkg.id)

    if (!nodeData) {
      const container = new Container()
      container.label = pkg.id
      container.eventMode = 'static'
      container.cursor = 'pointer'

      const shape = new Graphics()
      shape.label = 'shape'
      container.addChild(shape)

      nodeData = {
        container,
        shape,
        icon: null,
        lastIconKey: null,
      }

      this.nodeContainers.set(pkg.id, nodeData)
      this.nodesLayer.addChild(container)
    }

    const iconKey = pkg.identity?.iconKey || null
    const packageName = pkg.identity?.name || null
    const radius = getNodeRadius(pkg)
    const iconSize = radius * 1.4

    // Create a cache key that includes both package name and icon key
    // This ensures we re-render when either changes
    const iconCacheKey = `${packageName || ''}:${iconKey || ''}`

    // Check if icon is ready (handles semantic, devicon, and procedural)
    const iconReady = packageName
      ? isIconReady(packageName, iconKey || undefined)
      : iconKey
        ? isIconReady('', iconKey)
        : true

    // Update icon if cache key changed or icon just became ready
    if (
      iconCacheKey !== nodeData.lastIconKey ||
      (!nodeData.icon && iconReady)
    ) {
      // Remove old icon
      if (nodeData.icon) {
        nodeData.container.removeChild(nodeData.icon)
        nodeData.icon.destroy()
        nodeData.icon = null
      }

      // Create new icon using unified system
      // Handles: semantic → devicon → procedural fallback
      if (packageName || iconKey) {
        const iconGraphics = createPackageIcon(
          packageName || '',
          iconKey || undefined,
          iconSize,
          pkg.identity?.archetype
        )
        if (iconGraphics) {
          nodeData.icon = iconGraphics
          nodeData.icon.label = 'icon'
          nodeData.container.addChild(nodeData.icon)
        }
      }

      nodeData.lastIconKey = iconCacheKey
    }

    // Skip rendering if absorbed during collapse
    if (isCollapseActive() && isPackageAbsorbed(pkg.id)) {
      nodeData.container.visible = false
      return
    }
    nodeData.container.visible = true

    // Draw the shape (circle, border, effects)
    this.drawNode(nodeData.shape, pkg, effects)

    // Update position with shake offset and wiggle
    const shakeX = effects?.shake.x || 0
    const shakeY = effects?.shake.y || 0

    // Wiggle effect (horizontal back-and-forth)
    let wiggleX = 0
    if (effects?.wigglePhase && effects.wigglePhase !== 0) {
      // Fast horizontal oscillation that fades out
      wiggleX = effects.wigglePhase * 8 // 8px max amplitude
    }

    nodeData.container.x = pkg.position.x + shakeX + wiggleX
    nodeData.container.y = pkg.position.y + shakeY

    // Apply spaghettification during collapse
    if (isCollapseActive()) {
      const { stretch, width, angle } = getSpaghettification(pkg)
      // Rotate to point toward black hole, apply asymmetric scale
      nodeData.container.rotation = angle
      nodeData.container.scale.set(stretch, width)
    } else {
      // Reset transforms when not collapsing
      nodeData.container.rotation = 0
      // Apply celebration scale (pop effect when scope becomes stable)
      const scale = effects?.celebrationScale ?? 1
      nodeData.container.scale.set(scale, scale)
    }

    // Apply dimming for first conflict treatment
    const dimAmount = effects?.dimAmount || 0
    nodeData.container.alpha = 1 - dimAmount * 0.4 // Dim to 0.6 at max
  }

  /**
   * Draw a node's graphics (shape only, icon handled separately)
   */
  private drawNode(
    graphics: Graphics,
    pkg: Package,
    effects?: NodeEffects
  ): void {
    graphics.clear()

    const radius = getNodeRadius(pkg)
    const fillColor = getNodeColor(pkg.state)
    const borderColor = getBorderColor(pkg.state)
    const pulseIntensity = effects?.pulseIntensity || 0

    // Ghost nodes have special rendering (dashed, transparent)
    if (effects?.isGhost) {
      this.drawGhostNode(graphics, pkg, radius, effects)
      return
    }

    // Duplicate halo (draw first, behind everything)
    if (effects?.duplicateHalo) {
      this.drawDuplicateHalo(
        graphics,
        radius,
        effects.duplicateHalo.color,
        effects.duplicateHalo.pulsePhase,
        effects.duplicateHalo.canAfford,
        effects.duplicateHalo.isHovered,
        effects.duplicateHalo.isFirstDuplicate
      )
    }

    // Internal state glow for top-level packages (scope system)
    if (effects?.internalState) {
      this.drawInternalStateGlow(graphics, radius, effects.internalState)
    }

    // Drop target highlight (when dragging a duplicate over this)
    if (effects?.isDropTarget) {
      const dropRadius = radius + 12
      const dropAlpha = 0.4 + 0.2 * Math.sin(Date.now() * 0.01)
      graphics.circle(0, 0, dropRadius)
      graphics.fill({ color: 0x5affff, alpha: dropAlpha })
    }

    // Pulse glow for root node (onboarding)
    if (pulseIntensity > 0) {
      const pulseRadius = radius + 8 + pulseIntensity * 6
      const pulseAlpha = pulseIntensity * 0.4
      graphics.circle(0, 0, pulseRadius)
      graphics.fill({ color: Colors.borderInstalling, alpha: pulseAlpha })
    }

    // Outer glow for optimized nodes
    if (pkg.state === 'optimized') {
      graphics.circle(0, 0, radius + 4)
      graphics.fill({ color: Colors.borderOptimized, alpha: 0.3 })
    }

    // Root node (package.json) - distinctive anchor glow
    const isRoot = pkg.parentId === null
    if (isRoot) {
      // Outer golden ring - the anchor point
      graphics.circle(0, 0, radius + 6)
      graphics.stroke({ color: 0xffd700, width: 2, alpha: 0.6 })
      // Inner warm glow
      graphics.circle(0, 0, radius + 3)
      graphics.fill({ color: 0xffa500, alpha: 0.15 })
    }

    // Main circle
    graphics.circle(0, 0, radius)
    graphics.fill({ color: fillColor })

    // Border - thicker for root, thicker when pulsing
    const baseBorderWidth = isRoot ? 3 : 2
    const borderWidth =
      pulseIntensity > 0 ? baseBorderWidth + 1 : baseBorderWidth
    const borderAlpha = pulseIntensity > 0 ? 0.8 + pulseIntensity * 0.2 : 1
    graphics.stroke({
      color: borderColor,
      width: borderWidth,
      alpha: borderAlpha,
    })

    // Golden package interior tint (depth 3+ reward)
    // Drawn after main fill so it overlays as a tint effect
    if (effects?.isGolden) {
      this.drawGoldenGlow(graphics, radius)
    }

    // Portal rings for top-level packages (drawn on top of main circle)
    if (effects?.internalState) {
      this.drawPortalRings(graphics, radius, effects.internalState)
      // Drill-down badge with down arrow (only if not stable)
      if (effects.internalState !== 'stable') {
        this.drawDrillDownIndicator(graphics, radius, effects.internalState)
      }
    }

    // Installation progress ring
    if (pkg.state === 'installing' && pkg.installProgress < 1) {
      this.drawProgressRing(
        graphics,
        pkg.installProgress,
        Colors.borderInstalling,
        radius
      )
    }

    // Conflict progress ring (resolution in progress)
    if (pkg.state === 'conflict' && pkg.conflictProgress > 0) {
      this.drawProgressRing(
        graphics,
        pkg.conflictProgress,
        Colors.accentGreen,
        radius
      )
    }

    // Note: icon is handled separately as a child Graphics, fallback drawn in updateNode if needed

    // Conflict indicator - red outer ring
    if (pkg.state === 'conflict') {
      graphics.circle(0, 0, radius + 3)
      graphics.stroke({ color: Colors.borderConflict, width: 2, alpha: 0.7 })
    }

    // Cache fragment indicator - purple diamond pip at bottom
    if (effects?.hasCacheFragment) {
      this.drawCacheFragmentIndicator(graphics, radius)
    }

    // Stable scope root checkmark badge at bottom
    if (effects?.isScopeRootStable) {
      this.drawStableCheckmark(graphics, radius)
    }

    // Click hint for root (pulsing arrow or indicator)
    if (effects?.showHint && pulseIntensity > 0.5) {
      this.drawClickHint(graphics, pulseIntensity, radius)
    }
  }

  /**
   * Draw a ghost node (symlinked-away reference)
   * Visual: Semi-transparent, dashed border, symlink indicator
   */
  private drawGhostNode(
    graphics: Graphics,
    _pkg: Package,
    radius: number,
    _effects: NodeEffects
  ): void {
    const reducedMotion = prefersReducedMotion()
    const time = Date.now() * 0.002
    const breathe = reducedMotion ? 0.5 : (Math.sin(time) + 1) / 2

    // Ghost color - cyan/teal tint
    const ghostColor = Colors.borderOptimized
    const ghostAlpha = 0.3 + breathe * 0.15

    // Outer glow (subtle, pulsing)
    graphics.circle(0, 0, radius + 4)
    graphics.fill({ color: ghostColor, alpha: ghostAlpha * 0.3 })

    // Main circle (semi-transparent fill)
    graphics.circle(0, 0, radius)
    graphics.fill({ color: 0x1a2a3a, alpha: 0.5 })

    // Dashed border (draw segments manually)
    this.drawDashedCircle(graphics, radius, ghostColor, 2, ghostAlpha + 0.3)

    // Symlink arrow indicator (⤳) - draw as arrow pointing right
    const arrowSize = radius * 0.5
    const arrowX = 0
    const arrowY = 0

    // Arrow shaft
    graphics.moveTo(arrowX - arrowSize * 0.6, arrowY)
    graphics.lineTo(arrowX + arrowSize * 0.3, arrowY)
    graphics.stroke({ color: ghostColor, width: 2, alpha: 0.8 })

    // Arrow head
    graphics.moveTo(arrowX + arrowSize * 0.3, arrowY)
    graphics.lineTo(arrowX, arrowY - arrowSize * 0.3)
    graphics.moveTo(arrowX + arrowSize * 0.3, arrowY)
    graphics.lineTo(arrowX, arrowY + arrowSize * 0.3)
    graphics.stroke({ color: ghostColor, width: 2, alpha: 0.8 })

    // Curved tail (symlink indicator ⤳ style)
    graphics.moveTo(arrowX - arrowSize * 0.6, arrowY)
    graphics.quadraticCurveTo(
      arrowX - arrowSize * 0.8,
      arrowY - arrowSize * 0.4,
      arrowX - arrowSize * 0.5,
      arrowY - arrowSize * 0.5
    )
    graphics.stroke({ color: ghostColor, width: 2, alpha: 0.6 })
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
    const dashCount = 16
    const dashAngle = (Math.PI * 2) / dashCount
    const dashLength = dashAngle * 0.6
    // gapLength = dashAngle * 0.4 (implicit from dashLength)

    for (let i = 0; i < dashCount; i++) {
      const startAngle = i * dashAngle
      const endAngle = startAngle + dashLength

      graphics.arc(0, 0, radius, startAngle, endAngle)
      graphics.stroke({ color, width, alpha })
    }
  }

  /**
   * Draw click hint indicator
   */
  private drawClickHint(
    graphics: Graphics,
    intensity: number,
    radius: number
  ): void {
    const alpha = (intensity - 0.5) * 2 // Only show when pulse > 0.5
    const y = radius + 15

    // Small downward arrow
    graphics.moveTo(0, y - 5)
    graphics.lineTo(5, y)
    graphics.lineTo(0, y + 5)
    graphics.lineTo(-5, y)
    graphics.closePath()
    graphics.fill({ color: Colors.borderInstalling, alpha: alpha * 0.8 })
  }

  /**
   * Draw progress ring around node (prominent and visible)
   */
  private drawProgressRing(
    graphics: Graphics,
    progress: number,
    color: number,
    radius: number
  ): void {
    const ringRadius = radius + 8
    const startAngle = -Math.PI / 2
    const endAngle = startAngle + Math.PI * 2 * progress
    const reducedMotion = prefersReducedMotion()

    // Background track (shows full circle faintly)
    graphics.circle(0, 0, ringRadius)
    graphics.stroke({ color: 0x2a2a4a, width: 5, alpha: 0.6 })

    // Outer glow for the progress (pulsing)
    const glowPulse = reducedMotion
      ? 0.4
      : 0.3 + 0.2 * Math.sin(Date.now() * 0.005)
    graphics.arc(0, 0, ringRadius + 3, startAngle, endAngle)
    graphics.stroke({ color, width: 8, alpha: glowPulse })

    // Main progress arc (thick and bright)
    graphics.arc(0, 0, ringRadius, startAngle, endAngle)
    graphics.stroke({ color, width: 5, alpha: 1 })

    // Leading edge highlight (bright dot at progress front)
    if (progress > 0.02 && progress < 0.98) {
      const edgeX = Math.cos(endAngle) * ringRadius
      const edgeY = Math.sin(endAngle) * ringRadius
      graphics.circle(edgeX, edgeY, 4)
      graphics.fill({ color: 0xffffff, alpha: 0.9 })
    }
  }

  /**
   * Draw pulsing halo for duplicate packages
   * Shows gray when symlink merge is unaffordable
   * Boosted intensity when hovered or first duplicate (teaching)
   */
  private drawDuplicateHalo(
    graphics: Graphics,
    radius: number,
    color: number,
    pulsePhase: number,
    canAfford: boolean,
    isHovered: boolean = false,
    isFirstDuplicate: boolean = false
  ): void {
    // For reduced motion, use static values
    const reducedMotion = prefersReducedMotion()
    const effectivePhase = reducedMotion ? 0.5 : pulsePhase

    // Use gray when unaffordable
    const haloColor = canAfford ? color : 0x6a6a7a

    // Pulsing alpha based on phase (synced across group)
    // Hovered: slightly brighter, no pulsing
    // First duplicate: strong pulsing for attention
    // Slower, dimmer pulse when unaffordable
    let alpha: number
    if (isHovered) {
      // Slightly brighter when hovered (no pulsing)
      alpha = canAfford ? 0.35 : 0.25
    } else if (isFirstDuplicate) {
      // Heavy pulsing for first duplicate teaching
      const baseAlpha = canAfford ? 0.4 : 0.25
      const pulseScale = canAfford ? 0.3 : 0.15
      const pulseAlpha = reducedMotion
        ? 0
        : pulseScale * Math.sin(effectivePhase * Math.PI * 2)
      alpha = baseAlpha + pulseAlpha
    } else {
      // Normal pulsing
      const baseAlpha = canAfford ? 0.2 : 0.15
      const pulseScale = canAfford ? 0.15 : 0.08
      const pulseAlpha = reducedMotion
        ? 0
        : pulseScale * Math.sin(effectivePhase * Math.PI * 2)
      alpha = baseAlpha + pulseAlpha
    }

    // Outer halo ring
    // First duplicate: larger, thicker ring for teaching
    // Hovered: slightly larger but not as intense as teaching
    const expansionScale = isFirstDuplicate
      ? 6
      : isHovered
        ? 4
        : canAfford
          ? 3
          : 1.5
    const haloRadius =
      radius +
      (isFirstDuplicate ? 12 : isHovered ? 10 : 8) +
      (reducedMotion ? 1.5 : effectivePhase * expansionScale)
    const strokeWidth = isFirstDuplicate ? 5 : 3
    graphics.circle(0, 0, haloRadius)
    graphics.stroke({
      color: haloColor,
      width: strokeWidth,
      alpha: Math.min(1, alpha + 0.1),
    })

    // Inner glow (more intense when first duplicate teaching)
    const innerGlowRadius = radius + (isFirstDuplicate ? 6 : 4)
    graphics.circle(0, 0, innerGlowRadius)
    graphics.fill({
      color: haloColor,
      alpha: Math.min(1, alpha * (isFirstDuplicate ? 0.8 : 0.5)),
    })

    // Extra outer ring for first duplicate (attention grabber)
    if (isFirstDuplicate && !reducedMotion) {
      const outerRingPhase = (Date.now() % 1000) / 1000
      const outerRingRadius = haloRadius + 5 + outerRingPhase * 10
      const outerRingAlpha = 0.4 * (1 - outerRingPhase)
      graphics.circle(0, 0, outerRingRadius)
      graphics.stroke({ color: haloColor, width: 2, alpha: outerRingAlpha })
    }
  }

  /**
   * Draw drill-down indicator - cyan badge at bottom of node with downward arrow
   * Indicates this package has internal scope that can be explored
   */
  private drawDrillDownIndicator(
    graphics: Graphics,
    radius: number,
    state: 'pristine' | 'unstable'
  ): void {
    const reducedMotion = prefersReducedMotion()
    const time = Date.now() * 0.004
    const pulse = reducedMotion ? 0.5 : (Math.sin(time) + 1) / 2

    // Color based on internal state
    const color = state === 'pristine' ? 0x22d3ee : 0xff6b6b // Cyan or Red

    const badgeRadius = 8
    const badgeY = radius + 6 // Position below the node

    // Badge background circle with pulsing glow
    const glowAlpha = 0.3 + pulse * 0.2
    graphics.circle(0, badgeY, badgeRadius + 3)
    graphics.fill({ color, alpha: glowAlpha })

    // Badge circle
    graphics.circle(0, badgeY, badgeRadius)
    graphics.fill({ color: 0x1a1a2e })
    graphics.stroke({ color, width: 2, alpha: 0.9 })

    // Downward arrow inside badge
    const arrowSize = 4
    const arrowY = badgeY

    // Arrow stem
    graphics.moveTo(0, arrowY - arrowSize + 1)
    graphics.lineTo(0, arrowY + arrowSize - 2)
    graphics.stroke({ color, width: 2, alpha: 1 })

    // Arrow head (chevron pointing down)
    graphics.moveTo(-arrowSize + 1, arrowY + 1)
    graphics.lineTo(0, arrowY + arrowSize)
    graphics.lineTo(arrowSize - 1, arrowY + 1)
    graphics.stroke({ color, width: 2, alpha: 1 })
  }

  /**
   * Draw golden package ring
   * For rare packages that spawn at depth 3+ (4x weight)
   * Simple gold ring just inside the node's border
   */
  private drawGoldenGlow(graphics: Graphics, radius: number): void {
    // Gold ring just inside the border (border is ~2px at radius)
    graphics.circle(0, 0, radius - 4)
    graphics.stroke({ color: Colors.goldenGlow, width: 2, alpha: 0.8 })
  }

  /**
   * Draw cache fragment indicator - purple diamond pip at 9 o'clock (left side)
   * Click to collect bonus cache tokens on prestige
   */
  private drawCacheFragmentIndicator(graphics: Graphics, radius: number): void {
    const reducedMotion = prefersReducedMotion()
    const time = Date.now() * 0.004
    const pulse = reducedMotion ? 0.5 : (Math.sin(time * 1.5) + 1) / 2

    const color = Colors.cacheFragment
    const badgeRadius = 8
    const badgeX = -radius - 6 // Position to the left of node (9 o'clock)
    const badgeY = 0

    // Badge background circle with pulsing glow
    const glowAlpha = 0.3 + pulse * 0.25
    graphics.circle(badgeX, badgeY, badgeRadius + 3)
    graphics.fill({ color, alpha: glowAlpha })

    // Badge circle background
    graphics.circle(badgeX, badgeY, badgeRadius)
    graphics.fill({ color: 0x1a1a2e })
    graphics.stroke({ color, width: 2, alpha: 0.9 })

    // Diamond shape inside badge
    const size = 4
    graphics.moveTo(badgeX, badgeY - size)
    graphics.lineTo(badgeX + size, badgeY)
    graphics.lineTo(badgeX, badgeY + size)
    graphics.lineTo(badgeX - size, badgeY)
    graphics.closePath()
    graphics.fill({ color, alpha: 1 })

    // Inner diamond highlight
    const innerSize = 2
    graphics.moveTo(badgeX, badgeY - innerSize)
    graphics.lineTo(badgeX + innerSize, badgeY)
    graphics.lineTo(badgeX, badgeY + innerSize)
    graphics.lineTo(badgeX - innerSize, badgeY)
    graphics.closePath()
    graphics.fill({ color: 0xffffff, alpha: 0.5 })
  }

  /**
   * Draw stable checkmark badge at bottom of scope root
   * Green circle with checkmark indicating scope is complete
   */
  private drawStableCheckmark(graphics: Graphics, radius: number): void {
    const reducedMotion = prefersReducedMotion()
    const time = Date.now() * 0.003
    const pulse = reducedMotion ? 0.5 : (Math.sin(time) + 1) / 2

    const color = 0x4ade80 // Green (same as stable state)
    const badgeRadius = 10
    const badgeY = radius + 8 // Position below the node

    // Badge background circle with pulsing glow
    const glowAlpha = 0.35 + pulse * 0.25
    graphics.circle(0, badgeY, badgeRadius + 4)
    graphics.fill({ color, alpha: glowAlpha })

    // Badge circle background
    graphics.circle(0, badgeY, badgeRadius)
    graphics.fill({ color: 0x1a1a2e })
    graphics.stroke({ color, width: 2, alpha: 0.95 })

    // Checkmark inside badge
    const checkScale = 0.5
    const cx = 0
    const cy = badgeY

    // Draw checkmark stroke
    graphics.moveTo(cx - 4 * checkScale, cy)
    graphics.lineTo(cx - 1 * checkScale, cy + 3 * checkScale)
    graphics.lineTo(cx + 5 * checkScale, cy - 4 * checkScale)
    graphics.stroke({ color, width: 2.5, alpha: 1 })

    // White highlight on checkmark
    graphics.moveTo(cx - 4 * checkScale, cy)
    graphics.lineTo(cx - 1 * checkScale, cy + 3 * checkScale)
    graphics.lineTo(cx + 5 * checkScale, cy - 4 * checkScale)
    graphics.stroke({ color: 0xffffff, width: 1.5, alpha: 0.6 })
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
    const reducedMotion = prefersReducedMotion()
    const time = Date.now() * 0.003
    const pulse = reducedMotion ? 0.5 : (Math.sin(time) + 1) / 2

    let color: number
    let baseAlpha: number
    let pulseAlpha: number
    let glowRadius: number

    switch (state) {
      case 'pristine':
        // Inviting blue pulse - "click to explore"
        color = 0x22d3ee // Cyan
        baseAlpha = 0.15
        pulseAlpha = 0.2 * pulse
        glowRadius = radius + 6 + pulse * 4
        break

      case 'unstable':
        // Warning red/orange pulse - "needs attention"
        color = 0xff6b6b // Soft red
        baseAlpha = 0.2
        pulseAlpha = 0.25 * pulse
        glowRadius = radius + 5 + pulse * 3
        break

      case 'stable':
        // Steady green - "all resolved"
        color = 0x4ade80 // Green
        baseAlpha = 0.2
        pulseAlpha = reducedMotion ? 0 : 0.1 * pulse // Subtle pulse
        glowRadius = radius + 4
        break
    }

    // Outer glow ring
    graphics.circle(0, 0, glowRadius)
    graphics.stroke({ color, width: 3, alpha: baseAlpha + pulseAlpha })

    // Inner glow fill (behind the node)
    graphics.circle(0, 0, radius + 3)
    graphics.fill({ color, alpha: (baseAlpha + pulseAlpha) * 0.4 })
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
    const reducedMotion = prefersReducedMotion()
    const time = Date.now() * 0.003

    let color: number
    let baseAlpha: number

    switch (state) {
      case 'pristine':
        color = 0x22d3ee // Cyan
        baseAlpha = 0.4
        break
      case 'unstable':
        color = 0xff6b6b // Soft red
        baseAlpha = 0.45
        break
      case 'stable':
        color = 0x4ade80 // Green
        baseAlpha = 0.35
        break
    }

    // CONCENTRIC RINGS - "portal effect" showing there's a world inside
    // Draw 3 inner rings that pulse inward like a tunnel
    const ringCount = 3
    for (let i = 0; i < ringCount; i++) {
      // Stagger the pulse phase for each ring (creates wave effect)
      const ringPhase = reducedMotion ? 0.5 : (time * 0.5 + i * 0.33) % 1
      const ringPulse = (Math.sin(ringPhase * Math.PI * 2) + 1) / 2

      // Inner rings get progressively smaller and more transparent
      const ringRadius = radius * (0.75 - i * 0.2) + ringPulse * 2
      const ringAlpha = baseAlpha * (0.7 - i * 0.2)

      graphics.circle(0, 0, ringRadius)
      graphics.stroke({ color, width: 2, alpha: ringAlpha })
    }

    // Center glow dot - the "entrance point"
    const dotPulse = reducedMotion ? 0.5 : (Math.sin(time * 2) + 1) / 2
    const dotRadius = 4 + dotPulse * 3
    const dotAlpha = baseAlpha * 0.9
    graphics.circle(0, 0, dotRadius)
    graphics.fill({ color, alpha: dotAlpha })
  }

  /**
   * Remove a node's graphics
   */
  removeNode(id: string): void {
    const nodeData = this.nodeContainers.get(id)
    if (nodeData) {
      this.nodesLayer.removeChild(nodeData.container)
      if (nodeData.icon) {
        nodeData.icon.destroy()
      }
      nodeData.shape.destroy()
      nodeData.container.destroy()
      this.nodeContainers.delete(id)
    }
  }

  /**
   * Get container for hit testing
   */
  getNodeGraphics(id: string): Container | undefined {
    return this.nodeContainers.get(id)?.container
  }

  /**
   * Get all node containers
   */
  getAllNodeGraphics(): Map<string, Container> {
    const result = new Map<string, Container>()
    for (const [id, data] of this.nodeContainers) {
      result.set(id, data.container)
    }
    return result
  }

  /**
   * Clear all nodes
   */
  clear(): void {
    for (const nodeData of this.nodeContainers.values()) {
      if (nodeData.icon) {
        nodeData.icon.destroy()
      }
      nodeData.shape.destroy()
      nodeData.container.destroy()
    }
    this.nodeContainers.clear()
    this.queuedDepsGraphics.clear()
    this.nodesLayer.removeChildren()
    // Re-add the queued deps graphics after clearing
    this.nodesLayer.addChild(this.queuedDepsGraphics)
  }

  /**
   * Get the container for z-ordering
   */
  getContainer(): Container {
    return this.nodesLayer
  }

  // ============================================
  // QUEUED DEP RENDERING (Awaiting Bandwidth)
  // ============================================

  /**
   * Update rendering of queued deps that are awaiting bandwidth
   * Renders faded outlines with progress rings showing BW accumulation
   */
  updateQueuedDeps(
    pendingSpawns: PendingSpawn[],
    currentBandwidth: number
  ): void {
    this.queuedDepsGraphics.clear()

    const reducedMotion = prefersReducedMotion()
    const now = Date.now()

    // Only render spawns that are awaiting bandwidth
    const awaitingSpawns = pendingSpawns.filter((s) => s.awaitingBandwidth)

    for (const spawn of awaitingSpawns) {
      const x = spawn.position.x
      const y = spawn.position.y
      const size = 20 // Fixed size for queued dep outlines

      // Faded box outline
      this.queuedDepsGraphics.rect(x - size, y - size, size * 2, size * 2)
      this.queuedDepsGraphics.stroke({ color: 0x5a5a7a, width: 2, alpha: 0.3 })

      // Progress ring showing BW accumulation toward DEP_SPAWN_COST
      const progress = Math.min(1, currentBandwidth / DEP_SPAWN_COST)
      if (progress > 0) {
        const ringRadius = size + 5

        // Background ring (full circle, dim)
        this.queuedDepsGraphics.circle(x, y, ringRadius)
        this.queuedDepsGraphics.stroke({
          color: 0x3a3a4a,
          width: 3,
          alpha: 0.3,
        })

        // Progress arc
        const startAngle = -Math.PI / 2 // Start at top
        const endAngle = startAngle + progress * Math.PI * 2

        this.queuedDepsGraphics.arc(x, y, ringRadius, startAngle, endAngle)
        this.queuedDepsGraphics.stroke({
          color: 0x5a7aff,
          width: 3,
          alpha: 0.8,
        })
      }

      // Pulsing effect when close to affordable (optional, skip if reduced motion)
      if (!reducedMotion && progress > 0.8) {
        const pulsePhase = ((now % 800) / 800) * Math.PI * 2
        const pulseAlpha = 0.2 + 0.2 * Math.sin(pulsePhase)
        this.queuedDepsGraphics.circle(x, y, size + 8)
        this.queuedDepsGraphics.fill({ color: 0x5a7aff, alpha: pulseAlpha })
      }
    }
  }
}
