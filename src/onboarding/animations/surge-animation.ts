// Surge Animation
// Demonstrates: At depth 2+, charge surge → enter package → golden spawns with fragment → collect → 5 fragments = 1 token
// Shows depth totem to indicate when golden becomes available (depth 3 effective)
// Loop: ~5.5 seconds

import {
  BaseAnimation,
  hexToCSS,
  ANIMATION_WIDTH,
  ANIMATION_HEIGHT,
} from './base-animation'
import { Colors } from '../../rendering/colors'

// Surge-specific colors
const SURGE_COLOR = 0xf0a040 // Orange/amber
const SURGE_CHARGED = 0xffcc44 // Bright gold when charged
const GOLDEN_COLOR = 0xffd700 // Golden package
const FRAGMENT_COLOR = Colors.cacheFragment // Gold fragments
const TOKEN_COLOR = 0x7a5aff // Purple cache token

// Badge/depth colors (matching diving-animation.ts)
const BADGE_PRISTINE = 0x22d3ee // Cyan - "click to explore"
const BADGE_BACKGROUND = 0x1a1a2e // Dark badge background
const DEPTH_DOT_INACTIVE = 0x3a3a5a // Unfilled depth dot
const DEPTH_DOT_ACTIVE = 0x7a7aff // Filled depth dot (blue/purple)
const GOLDEN_ANCHOR = 0xffd700 // Root node golden ring

export class SurgeAnimation extends BaseAnimation {
  protected loopDuration = 5500 // 5.5 second loop

  // Animation phases
  private static readonly PHASES = {
    show: { start: 0, end: 0.08 }, // Show scene with depth totem
    cursorToBar: { start: 0.08, end: 0.14 }, // Cursor moves to surge bar
    chargeBar: { start: 0.14, end: 0.24 }, // Charging segments
    cursorToNode: { start: 0.24, end: 0.3 }, // Cursor moves to package
    clickNode: { start: 0.3, end: 0.36 }, // Click triggers dive + cascade
    zoomIn: { start: 0.36, end: 0.44 }, // Zoom into package, depth 2→3
    cascade: { start: 0.44, end: 0.54 }, // Boosted cascade spawns with golden
    cursorToFragment: { start: 0.54, end: 0.6 }, // Cursor moves to fragment
    clickFragment: { start: 0.6, end: 0.66 }, // Click collects fragment
    fragmentFloat: { start: 0.66, end: 0.74 }, // Fragment floats to collection area
    fragmentsConvert: { start: 0.74, end: 0.9 }, // 5 fragments → 1 token
    hold: { start: 0.9, end: 0.96 }, // Hold state
    reset: { start: 0.96, end: 1.0 }, // Fade for loop
  }

  protected setup(): void {
    // Initial draw handled by update
  }

  protected update(progress: number): void {
    if (!this.ctx) return

    const phases = SurgeAnimation.PHASES

    // Global alpha for fade
    let globalAlpha = 1
    if (progress >= phases.reset.start) {
      globalAlpha = 1 - this.phaseProgress(progress, phases.reset)
    }

    // Calculate zoom state
    const isZoomingIn =
      progress >= phases.zoomIn.start && progress < phases.zoomIn.end
    const isInsideScope = progress >= phases.zoomIn.end
    const zoomT = isZoomingIn
      ? this.phaseProgress(progress, phases.zoomIn)
      : isInsideScope
        ? 1
        : 0

    // Draw surge bar (top area)
    const chargeLevel = this.getChargeLevel(progress)
    this.drawSurgeBar(chargeLevel, globalAlpha)

    // Draw depth totem (shows depth 2 → 3 during zoom)
    this.drawDepthTotem(zoomT, globalAlpha)

    // Draw outer scene (root + top-level package) before zoom
    if (progress < phases.zoomIn.end) {
      const outerAlpha = isZoomingIn
        ? (1 - this.phaseProgress(progress, phases.zoomIn)) * globalAlpha
        : globalAlpha
      this.drawOuterScene(outerAlpha)
    }

    // Draw inner scope (cascade with golden package) during/after zoom
    if (progress >= phases.zoomIn.start && progress < phases.reset.start) {
      const innerAlpha = isZoomingIn
        ? this.phaseProgress(progress, phases.zoomIn) * globalAlpha
        : globalAlpha
      const cascadeProgress = this.phaseProgress(progress, phases.cascade)
      const fragmentCollected = progress >= phases.clickFragment.end
      this.drawInnerScope(innerAlpha, cascadeProgress, fragmentCollected)
    }

    // Zoom effect
    if (isZoomingIn) {
      this.drawZoomEffect(this.phaseProgress(progress, phases.zoomIn))
    }

    // Draw fragment collection animation
    if (
      progress >= phases.clickFragment.end &&
      progress < phases.fragmentsConvert.start
    ) {
      const floatProgress = this.phaseProgress(progress, phases.fragmentFloat)
      this.drawFloatingFragment(floatProgress, globalAlpha)
    }

    // Draw fragments → token conversion
    if (
      progress >= phases.fragmentsConvert.start &&
      progress < phases.reset.start
    ) {
      const convertProgress = this.phaseProgress(
        progress,
        phases.fragmentsConvert
      )
      this.drawFragmentConversion(convertProgress, globalAlpha)
    }

    // Draw cursor
    this.drawAnimatedCursor(progress, globalAlpha)
  }

  private phaseProgress(
    progress: number,
    phase: { start: number; end: number }
  ): number {
    if (progress < phase.start) return 0
    if (progress >= phase.end) return 1
    return (progress - phase.start) / (phase.end - phase.start)
  }

  private getChargeLevel(progress: number): number {
    const phases = SurgeAnimation.PHASES

    if (progress < phases.chargeBar.start) return 0
    if (progress < phases.chargeBar.end) {
      const t = this.phaseProgress(progress, phases.chargeBar)
      return this.easeInOut(t)
    }
    if (progress < phases.cascade.start) return 1
    // Drain during cascade
    if (progress < phases.cascade.end) {
      const t = this.phaseProgress(progress, phases.cascade)
      return 1 - this.easeInOut(t)
    }
    return 0
  }

  private drawSurgeBar(chargeLevel: number, alpha: number): void {
    if (!this.ctx) return

    const barWidth = 80
    const barHeight = 12
    const segments = 5
    const segmentGap = 2
    const segmentWidth = (barWidth - segmentGap * (segments - 1)) / segments
    const segmentRadius = 2

    const startX = ANIMATION_WIDTH / 2 - barWidth / 2 + 8
    const startY = 12

    // Draw concentric circles icon (left of bar)
    this.drawSurgeIcon(startX - 14, startY + barHeight / 2, chargeLevel, alpha)

    // Draw segments with rounded corners
    for (let i = 0; i < segments; i++) {
      const x = startX + i * (segmentWidth + segmentGap)
      const segmentFill = Math.max(0, Math.min(1, chargeLevel * segments - i))

      // Background (unlocked style)
      this.ctx.beginPath()
      this.roundRect(x, startY, segmentWidth, barHeight, segmentRadius)
      this.ctx.fillStyle = hexToCSS(SURGE_COLOR, 0.15 * alpha)
      this.ctx.fill()

      // Filled portion with gradient
      if (segmentFill > 0) {
        const gradient = this.ctx.createLinearGradient(
          x,
          startY + barHeight,
          x,
          startY
        )
        gradient.addColorStop(0, hexToCSS(0xc08020, 0.95 * alpha))
        gradient.addColorStop(1, hexToCSS(SURGE_COLOR, 0.9 * alpha))

        this.ctx.beginPath()
        this.roundRect(
          x,
          startY,
          segmentWidth * segmentFill,
          barHeight,
          segmentRadius
        )
        this.ctx.fillStyle = gradient
        this.ctx.fill()

        // Glow for fully charged segments
        if (segmentFill >= 1) {
          this.ctx.shadowColor = hexToCSS(SURGE_COLOR, 0.5)
          this.ctx.shadowBlur = 6
          this.ctx.beginPath()
          this.roundRect(x, startY, segmentWidth, barHeight, segmentRadius)
          this.ctx.fill()
          this.ctx.shadowBlur = 0
        }
      }
    }
  }

  private drawSurgeIcon(
    x: number,
    y: number,
    chargeLevel: number,
    alpha: number
  ): void {
    if (!this.ctx) return

    const isCharged = chargeLevel > 0
    const color = isCharged ? SURGE_CHARGED : SURGE_COLOR

    // Center dot
    this.ctx.beginPath()
    this.ctx.arc(x, y, 2, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(color, (isCharged ? 0.95 : 0.5) * alpha)
    this.ctx.fill()

    // Inner ring
    this.ctx.beginPath()
    this.ctx.arc(x, y, 4, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(color, (isCharged ? 0.8 : 0.3) * alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.stroke()

    // Outer ring
    this.ctx.beginPath()
    this.ctx.arc(x, y, 7, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(
      color,
      (chargeLevel >= 1 ? 0.5 : 0.15) * alpha
    )
    this.ctx.lineWidth = 1.5
    this.ctx.stroke()
  }

  /**
   * Draw back button container with depth dots inside (matches dive animation)
   * Shows 3 dots: depth 2 filled at start, depth 3 fills during zoom (golden)
   */
  private drawDepthTotem(zoomT: number, alpha: number): void {
    if (!this.ctx || alpha <= 0) return

    // Button container (matches diving-animation.ts)
    const btnX = 8
    const btnY = 8
    const btnWidth = 52
    const btnHeight = 18
    const btnRadius = 5

    // Button background
    this.ctx.beginPath()
    this.roundRect(btnX, btnY, btnWidth, btnHeight, btnRadius)
    this.ctx.fillStyle = hexToCSS(0x1e1e32, 0.85 * alpha)
    this.ctx.fill()

    // Button border
    this.ctx.strokeStyle = hexToCSS(0x4a4a6a, 0.5 * alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.stroke()

    // Back arrow (←)
    const arrowX = btnX + 10
    const arrowY = btnY + btnHeight / 2
    const arrowSize = 3.5
    this.ctx.beginPath()
    this.ctx.moveTo(arrowX + arrowSize * 0.5, arrowY - arrowSize * 0.6)
    this.ctx.lineTo(arrowX - arrowSize * 0.2, arrowY)
    this.ctx.lineTo(arrowX + arrowSize * 0.5, arrowY + arrowSize * 0.6)
    this.ctx.strokeStyle = hexToCSS(0xaaaacc, alpha * 0.8)
    this.ctx.lineWidth = 1.5
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    this.ctx.stroke()
    this.ctx.lineCap = 'butt'
    this.ctx.lineJoin = 'miter'

    // Depth dots inside button
    const dotStartX = btnX + 22
    const dotY = btnY + btnHeight / 2
    const dotGap = 4
    const dotRadius = 2.5
    const numDots = 3

    // Current depth: 2 before zoom, 3 after zoom
    const currentDepth = zoomT > 0 ? 2 + zoomT : 2

    for (let i = 0; i < numDots; i++) {
      const x = dotStartX + i * (dotRadius * 2 + dotGap)
      const depthForDot = i + 1

      // Fill amount based on current depth
      const isFilled = depthForDot <= currentDepth
      const fillAmount =
        depthForDot < currentDepth
          ? 1
          : depthForDot === Math.ceil(currentDepth)
            ? currentDepth % 1 || 1
            : 0
      const isDeepest = depthForDot === Math.ceil(currentDepth)

      // Golden glow for depth 3 (where golden packages spawn)
      const isGoldenDepth = depthForDot === 3
      if (isGoldenDepth && isFilled && fillAmount > 0.5) {
        this.ctx.beginPath()
        this.ctx.arc(x, dotY, dotRadius + 2.5, 0, Math.PI * 2)
        this.ctx.fillStyle = hexToCSS(GOLDEN_COLOR, 0.35 * alpha * fillAmount)
        this.ctx.fill()
      }

      // Subtle glow for deepest (non-golden)
      if (isDeepest && isFilled && !isGoldenDepth) {
        this.ctx.beginPath()
        this.ctx.arc(x, dotY, dotRadius + 2, 0, Math.PI * 2)
        this.ctx.fillStyle = hexToCSS(
          DEPTH_DOT_ACTIVE,
          0.25 * alpha * fillAmount
        )
        this.ctx.fill()
      }

      // Dot fill
      this.ctx.beginPath()
      this.ctx.arc(x, dotY, dotRadius, 0, Math.PI * 2)
      if (isFilled) {
        const dotColor =
          isGoldenDepth && fillAmount > 0.5 ? GOLDEN_COLOR : DEPTH_DOT_ACTIVE
        this.ctx.fillStyle = hexToCSS(
          dotColor,
          (0.6 + 0.3 * fillAmount) * alpha
        )
      } else {
        this.ctx.fillStyle = hexToCSS(DEPTH_DOT_INACTIVE, 0.35 * alpha)
      }
      this.ctx.fill()

      // Dot border
      this.ctx.beginPath()
      this.ctx.arc(x, dotY, dotRadius, 0, Math.PI * 2)
      const borderColor =
        isGoldenDepth && isFilled && fillAmount > 0.5
          ? GOLDEN_COLOR
          : isFilled
            ? 0x9a9aff
            : 0x4a4a6a
      this.ctx.strokeStyle = hexToCSS(
        borderColor,
        alpha * (isFilled ? 0.7 : 0.4)
      )
      this.ctx.lineWidth = 1
      this.ctx.stroke()
    }
  }

  /**
   * Draw outer scene: root node with golden ring + top-level package with pristine badge
   */
  private drawOuterScene(alpha: number): void {
    if (!this.ctx || alpha <= 0) return

    const rootX = ANIMATION_WIDTH / 2 - 35
    const rootY = ANIMATION_HEIGHT / 2 + 20
    const rootRadius = 16

    // Root node - golden anchor ring
    // Outer golden ring (anchor point)
    this.ctx.beginPath()
    this.ctx.arc(rootX, rootY, rootRadius + 4, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(GOLDEN_ANCHOR, 0.6 * alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Inner warm glow
    this.ctx.beginPath()
    this.ctx.arc(rootX, rootY, rootRadius + 2, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(0xffa500, 0.15 * alpha)
    this.ctx.fill()

    // Root fill
    this.ctx.beginPath()
    this.ctx.arc(rootX, rootY, rootRadius - 2, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(Colors.nodeReady, 0.6 * alpha)
    this.ctx.fill()

    // Root border
    this.ctx.beginPath()
    this.ctx.arc(rootX, rootY, rootRadius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderReady, alpha)
    this.ctx.lineWidth = 3
    this.ctx.stroke()

    // Top-level package (with pristine badge - has internal scope)
    const pkgX = ANIMATION_WIDTH / 2 + 20
    const pkgY = ANIMATION_HEIGHT / 2 + 15
    const pkgRadius = 18

    // Wire from root to package
    this.ctx.beginPath()
    this.ctx.moveTo(rootX + rootRadius, rootY)
    this.ctx.lineTo(pkgX - pkgRadius - 4, pkgY)
    this.ctx.strokeStyle = hexToCSS(Colors.wireDefault, 0.6 * alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Cyan glow (pristine internal state)
    const time = Date.now() * 0.003
    const pulse = (Math.sin(time) + 1) / 2
    const glowRadius = pkgRadius + 5 + pulse * 3
    this.ctx.beginPath()
    this.ctx.arc(pkgX, pkgY, glowRadius, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(BADGE_PRISTINE, (0.15 + 0.15 * pulse) * alpha)
    this.ctx.fill()

    // Package fill
    this.ctx.beginPath()
    this.ctx.arc(pkgX, pkgY, pkgRadius - 2, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(Colors.nodeReady, 0.6 * alpha)
    this.ctx.fill()

    // Package border
    this.ctx.beginPath()
    this.ctx.arc(pkgX, pkgY, pkgRadius, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderReady, alpha)
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Pristine badge at bottom
    this.drawPristineBadge(pkgX, pkgY + pkgRadius + 5, alpha, pulse)
  }

  private drawPristineBadge(
    x: number,
    y: number,
    alpha: number,
    pulse: number
  ): void {
    if (!this.ctx) return

    const badgeRadius = 7

    // Badge glow
    this.ctx.beginPath()
    this.ctx.arc(x, y, badgeRadius + 2, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(BADGE_PRISTINE, (0.3 + pulse * 0.2) * alpha)
    this.ctx.fill()

    // Badge background
    this.ctx.beginPath()
    this.ctx.arc(x, y, badgeRadius, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(BADGE_BACKGROUND, 0.95 * alpha)
    this.ctx.fill()

    // Badge border
    this.ctx.strokeStyle = hexToCSS(BADGE_PRISTINE, 0.9 * alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.stroke()

    // Down arrow
    const arrowSize = 3
    this.ctx.beginPath()
    this.ctx.moveTo(x, y - arrowSize + 1)
    this.ctx.lineTo(x, y + arrowSize - 2)
    this.ctx.strokeStyle = hexToCSS(BADGE_PRISTINE, alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.stroke()

    this.ctx.beginPath()
    this.ctx.moveTo(x - arrowSize + 1, y)
    this.ctx.lineTo(x, y + arrowSize - 1)
    this.ctx.lineTo(x + arrowSize - 1, y)
    this.ctx.strokeStyle = hexToCSS(BADGE_PRISTINE, alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    this.ctx.stroke()
    this.ctx.lineCap = 'butt'
    this.ctx.lineJoin = 'miter'
  }

  /**
   * Draw inner scope with cascade spawning golden package
   */
  private drawInnerScope(
    alpha: number,
    cascadeProgress: number,
    fragmentCollected: boolean
  ): void {
    if (!this.ctx || alpha <= 0) return

    const cx = ANIMATION_WIDTH / 2
    const cy = ANIMATION_HEIGHT / 2 + 15

    // Scope boundary
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, 42, 0, Math.PI * 2)
    this.ctx.strokeStyle = hexToCSS(Colors.borderOptimized, alpha * 0.15)
    this.ctx.lineWidth = 1
    this.ctx.stroke()

    // Spawn positions relative to center
    const spawns = [
      { x: -25, y: -12, delay: 0.15, isGolden: false },
      { x: 30, y: -8, delay: 0, isGolden: true }, // Golden package
      { x: 0, y: 22, delay: 0.3, isGolden: false },
    ]

    for (const spawn of spawns) {
      const localProgress = Math.max(
        0,
        (cascadeProgress - spawn.delay) / (1 - spawn.delay)
      )
      if (localProgress <= 0) continue

      const spawnEased = this.easeInOut(Math.min(1, localProgress * 1.5))
      const x = cx + spawn.x * spawnEased
      const y = cy + spawn.y * spawnEased
      const radius = (spawn.isGolden ? 12 : 10) * spawnEased

      if (radius < 1) continue

      // Wire from center
      this.ctx.beginPath()
      this.ctx.moveTo(cx, cy)
      this.ctx.lineTo(x, y)
      this.ctx.strokeStyle = hexToCSS(
        Colors.wireDefault,
        0.5 * spawnEased * alpha
      )
      this.ctx.lineWidth = 1.5
      this.ctx.stroke()

      if (spawn.isGolden) {
        // Golden glow
        this.ctx.beginPath()
        this.ctx.arc(x, y, radius + 5, 0, Math.PI * 2)
        this.ctx.fillStyle = hexToCSS(GOLDEN_COLOR, 0.3 * spawnEased * alpha)
        this.ctx.fill()

        // Golden ring
        this.ctx.beginPath()
        this.ctx.arc(x, y, radius + 2, 0, Math.PI * 2)
        this.ctx.strokeStyle = hexToCSS(GOLDEN_COLOR, 0.8 * spawnEased * alpha)
        this.ctx.lineWidth = 2
        this.ctx.stroke()
      }

      // Package fill
      this.ctx.beginPath()
      this.ctx.arc(x, y, Math.max(1, radius - 2), 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(Colors.nodeReady, 0.6 * spawnEased * alpha)
      this.ctx.fill()

      // Package border
      this.ctx.beginPath()
      this.ctx.arc(x, y, radius, 0, Math.PI * 2)
      this.ctx.strokeStyle = hexToCSS(Colors.borderReady, spawnEased * alpha)
      this.ctx.lineWidth = 1.5
      this.ctx.stroke()

      // Fragment pip on golden package
      if (spawn.isGolden && !fragmentCollected && spawnEased > 0.5) {
        const pipAlpha = (spawnEased - 0.5) * 2 * alpha
        this.drawFragmentPip(x - radius - 5, y, pipAlpha)
      }
    }
  }

  private drawFragmentPip(x: number, y: number, alpha: number): void {
    if (!this.ctx) return

    const badgeRadius = 6
    const pulse = (Math.sin(Date.now() * 0.006) + 1) / 2

    // Pulsing glow
    this.ctx.beginPath()
    this.ctx.arc(x, y, badgeRadius + 2, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(FRAGMENT_COLOR, (0.3 + pulse * 0.25) * alpha)
    this.ctx.fill()

    // Badge background
    this.ctx.beginPath()
    this.ctx.arc(x, y, badgeRadius, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(BADGE_BACKGROUND, alpha)
    this.ctx.fill()
    this.ctx.strokeStyle = hexToCSS(FRAGMENT_COLOR, 0.9 * alpha)
    this.ctx.lineWidth = 1.5
    this.ctx.stroke()

    // Diamond shape
    const size = 3
    this.ctx.beginPath()
    this.ctx.moveTo(x, y - size)
    this.ctx.lineTo(x + size, y)
    this.ctx.lineTo(x, y + size)
    this.ctx.lineTo(x - size, y)
    this.ctx.closePath()
    this.ctx.fillStyle = hexToCSS(FRAGMENT_COLOR, alpha)
    this.ctx.fill()
  }

  private drawZoomEffect(progress: number): void {
    if (!this.ctx) return

    const cx = ANIMATION_WIDTH / 2 + 20
    const cy = ANIMATION_HEIGHT / 2 + 15

    const numLines = 8
    const alpha = Math.sin(progress * Math.PI) * 0.3
    if (alpha <= 0) return

    const innerRadius = 12 + progress * 20
    const outerRadius = 40 - progress * 10

    for (let i = 0; i < numLines; i++) {
      const angle = (i / numLines) * Math.PI * 2
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)

      this.ctx.beginPath()
      this.ctx.moveTo(cx + cos * innerRadius, cy + sin * innerRadius)
      this.ctx.lineTo(cx + cos * outerRadius, cy + sin * outerRadius)
      this.ctx.strokeStyle = hexToCSS(BADGE_PRISTINE, alpha)
      this.ctx.lineWidth = 2
      this.ctx.stroke()
    }
  }

  private drawFloatingFragment(progress: number, alpha: number): void {
    if (!this.ctx) return

    // Start from golden package fragment pip
    const startX = ANIMATION_WIDTH / 2 + 30 - 12 - 5
    const startY = ANIMATION_HEIGHT / 2 + 15 - 8

    // End at collection area
    const endX = ANIMATION_WIDTH - 30
    const endY = 50

    const eased = this.easeInOut(progress)
    const x = this.lerp(startX, endX, eased)
    const y = this.lerp(startY, endY, eased)

    const scale = this.lerp(1, 0.7, eased)
    const fragAlpha = (1 - progress * 0.3) * alpha

    this.ctx.save()
    this.ctx.translate(x, y)
    this.ctx.scale(scale, scale)

    // Glow trail
    this.ctx.beginPath()
    this.ctx.arc(0, 0, 8, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(FRAGMENT_COLOR, 0.3 * fragAlpha)
    this.ctx.fill()

    // Diamond
    const size = 5
    this.ctx.beginPath()
    this.ctx.moveTo(0, -size)
    this.ctx.lineTo(size, 0)
    this.ctx.lineTo(0, size)
    this.ctx.lineTo(-size, 0)
    this.ctx.closePath()
    this.ctx.fillStyle = hexToCSS(FRAGMENT_COLOR, fragAlpha)
    this.ctx.fill()

    this.ctx.restore()
  }

  private drawFragmentConversion(progress: number, alpha: number): void {
    if (!this.ctx) return

    const centerX = ANIMATION_WIDTH - 30
    const centerY = 50
    const numFragments = 5

    if (progress < 0.3) {
      // Fragments appearing
      const appearProgress = progress / 0.3
      const visibleCount = Math.ceil(appearProgress * numFragments)

      for (let i = 0; i < visibleCount; i++) {
        const fragmentAlpha =
          (i < visibleCount - 1 ? 1 : (appearProgress * numFragments) % 1) *
          alpha
        const angle = (i / numFragments) * Math.PI * 2 - Math.PI / 2
        const x = centerX + Math.cos(angle) * 15
        const y = centerY + Math.sin(angle) * 15

        this.drawSmallFragment(x, y, fragmentAlpha)
      }
    } else if (progress < 0.6) {
      // Fragments converging
      const convergeProgress = (progress - 0.3) / 0.3
      const eased = this.easeInOut(convergeProgress)

      for (let i = 0; i < numFragments; i++) {
        const angle = (i / numFragments) * Math.PI * 2 - Math.PI / 2
        const startX = centerX + Math.cos(angle) * 15
        const startY = centerY + Math.sin(angle) * 15
        const x = this.lerp(startX, centerX, eased)
        const y = this.lerp(startY, centerY, eased)

        this.drawSmallFragment(x, y, alpha)
      }
    } else {
      // Transform to token
      const transformProgress = (progress - 0.6) / 0.4
      const eased = this.easeInOut(transformProgress)

      // Flash
      if (transformProgress < 0.3) {
        const flashAlpha = ((0.3 - transformProgress) / 0.3) * alpha
        this.ctx.beginPath()
        this.ctx.arc(centerX, centerY, 18, 0, Math.PI * 2)
        this.ctx.fillStyle = hexToCSS(FRAGMENT_COLOR, flashAlpha * 0.5)
        this.ctx.fill()
      }

      // Token
      const tokenAlpha = eased * alpha
      const tokenScale = 0.5 + eased * 0.5

      this.ctx.beginPath()
      this.ctx.arc(centerX, centerY, 10 * tokenScale, 0, Math.PI * 2)
      this.ctx.fillStyle = hexToCSS(TOKEN_COLOR, 0.3 * tokenAlpha)
      this.ctx.fill()

      this.ctx.font = `bold ${16 * tokenScale}px sans-serif`
      this.ctx.textAlign = 'center'
      this.ctx.textBaseline = 'middle'
      this.ctx.fillStyle = hexToCSS(TOKEN_COLOR, tokenAlpha)
      this.ctx.shadowColor = hexToCSS(TOKEN_COLOR, tokenAlpha * 0.6)
      this.ctx.shadowBlur = 6
      this.ctx.fillText('⟲', centerX, centerY)
      this.ctx.shadowBlur = 0
    }
  }

  private drawSmallFragment(x: number, y: number, alpha: number): void {
    if (!this.ctx) return

    const size = 3.5

    this.ctx.beginPath()
    this.ctx.arc(x, y, 5, 0, Math.PI * 2)
    this.ctx.fillStyle = hexToCSS(FRAGMENT_COLOR, 0.2 * alpha)
    this.ctx.fill()

    this.ctx.beginPath()
    this.ctx.moveTo(x, y - size)
    this.ctx.lineTo(x + size, y)
    this.ctx.lineTo(x, y + size)
    this.ctx.lineTo(x - size, y)
    this.ctx.closePath()
    this.ctx.fillStyle = hexToCSS(FRAGMENT_COLOR, alpha)
    this.ctx.fill()
  }

  private drawAnimatedCursor(progress: number, _alpha: number): void {
    if (!this.ctx) return

    const phases = SurgeAnimation.PHASES

    // Positions (canvas coords, not center-relative)
    const barCenter = { x: ANIMATION_WIDTH / 2, y: 18 }
    const pkgPos = { x: ANIMATION_WIDTH / 2 + 20, y: ANIMATION_HEIGHT / 2 + 15 }
    const startPos = { x: ANIMATION_WIDTH - 20, y: 30 }
    // Fragment pip on golden package
    const fragmentPos = { x: pkgPos.x + 30 - 12 - 5, y: pkgPos.y - 8 }

    let cursorX: number
    let cursorY: number
    let clicking = false

    if (progress < phases.cursorToBar.end) {
      const t = this.easeInOut(this.phaseProgress(progress, phases.cursorToBar))
      cursorX = this.lerp(startPos.x, barCenter.x - 35, t)
      cursorY = this.lerp(startPos.y, barCenter.y, t)
    } else if (progress < phases.chargeBar.end) {
      const t = this.phaseProgress(progress, phases.chargeBar)
      cursorX = this.lerp(barCenter.x - 35, barCenter.x + 35, t)
      cursorY = barCenter.y
      clicking = true
    } else if (progress < phases.cursorToNode.end) {
      const t = this.easeInOut(
        this.phaseProgress(progress, phases.cursorToNode)
      )
      cursorX = this.lerp(barCenter.x + 35, pkgPos.x + 8, t)
      cursorY = this.lerp(barCenter.y, pkgPos.y + 5, t)
    } else if (progress < phases.clickNode.end) {
      cursorX = pkgPos.x + 8
      cursorY = pkgPos.y + 5
      clicking = true
    } else if (progress < phases.cascade.end) {
      // Hide during zoom/cascade
      return
    } else if (progress < phases.cursorToFragment.end) {
      const t = this.easeInOut(
        this.phaseProgress(progress, phases.cursorToFragment)
      )
      cursorX = this.lerp(pkgPos.x + 8, fragmentPos.x + 5, t)
      cursorY = this.lerp(pkgPos.y + 5, fragmentPos.y + 5, t)
    } else if (progress < phases.clickFragment.end) {
      cursorX = fragmentPos.x + 5
      cursorY = fragmentPos.y + 5
      clicking = true
    } else if (progress < phases.hold.end) {
      const t =
        (progress - phases.clickFragment.end) /
        (phases.hold.end - phases.clickFragment.end)
      cursorX = fragmentPos.x + 5 + t * 40
      cursorY = fragmentPos.y + 5 - t * 25
    } else {
      return
    }

    // Convert to center-relative for drawCursor
    this.drawCursor(
      cursorX - ANIMATION_WIDTH / 2,
      cursorY - ANIMATION_HEIGHT / 2,
      clicking
    )

    // Click ripples
    if (
      progress >= phases.clickFragment.start &&
      progress < phases.fragmentFloat.start
    ) {
      const rippleProgress = this.phaseProgress(progress, phases.clickFragment)
      this.drawClickRipple(
        fragmentPos.x - ANIMATION_WIDTH / 2,
        fragmentPos.y - ANIMATION_HEIGHT / 2,
        rippleProgress,
        FRAGMENT_COLOR
      )
    }
  }

  private roundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    if (!this.ctx) return
    this.ctx.moveTo(x + r, y)
    this.ctx.lineTo(x + w - r, y)
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    this.ctx.lineTo(x + w, y + h - r)
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    this.ctx.lineTo(x + r, y + h)
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    this.ctx.lineTo(x, y + r)
    this.ctx.quadraticCurveTo(x, y, x + r, y)
  }
}
