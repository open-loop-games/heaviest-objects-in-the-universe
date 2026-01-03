// Tutorial cursor animation - animated ghost hand hints
// Shows after inactivity to guide players through game mechanics
// Supports both desktop (mouse cursor) and mobile (finger icon)

import { Graphics } from 'pixi.js'
import { getActiveGhostHint, type GhostHint } from './tutorial-state'
import { isMobileDevice } from '../input/touch-input'

// Animation timing constants
const HINT_DELAY = 10000 // Must match tutorial-state.ts

// Cursor colors
const CURSOR_COLOR = 0xffffff
const CURSOR_OUTLINE = 0x000000
const RIPPLE_COLOR = 0x4ade80

/**
 * Draw the tutorial cursor animation
 * Supports multiple hint types with different animations
 */
export function drawTutorialCursor(
  graphics: Graphics,
  screenWidth: number,
  screenHeight: number,
  worldToScreen: (x: number, y: number) => { x: number; y: number }
): void {
  graphics.clear()

  const hint = getActiveGhostHint()
  if (!hint || !hint.show) return

  // Convert world positions to screen positions (unless already screen-space)
  const screenTargets = hint.isScreenSpace
    ? hint.targets
    : hint.targets.map((t) => worldToScreen(t.x, t.y))

  // Calculate animation progress
  const cycleProgress = getCycleProgress(hint)

  const isMobile = isMobileDevice()

  // Draw based on hint type
  switch (hint.type) {
    case 'click-root':
    case 'click-package':
      // These require double-tap on mobile
      if (isMobile) {
        drawDoubleTapAnimation(
          graphics,
          screenWidth,
          screenHeight,
          screenTargets[0]!,
          cycleProgress
        )
      } else {
        drawClickAnimation(
          graphics,
          screenWidth,
          screenHeight,
          screenTargets[0]!,
          cycleProgress
        )
      }
      break
    case 'click-prestige':
    case 'click-ship':
    case 'click-conflict':
      // Single tap on both platforms
      drawClickAnimation(
        graphics,
        screenWidth,
        screenHeight,
        screenTargets[0]!,
        cycleProgress
      )
      break
    case 'drag-merge':
      drawDragAnimation(
        graphics,
        screenWidth,
        screenHeight,
        screenTargets[0]!,
        screenTargets[1]!,
        cycleProgress
      )
      break
  }
}

/**
 * Get cycle progress (0-1) for animation looping
 * Uses longer cycle for double-tap hints on mobile
 */
function getCycleProgress(hint: GhostHint): number {
  const isDoubleTapHint =
    isMobileDevice() &&
    (hint.type === 'click-root' || hint.type === 'click-package')

  // Longer cycle for double-tap to show both taps clearly
  const cycleMs = isDoubleTapHint ? 4000 : 3000
  return ((hint.elapsed - HINT_DELAY) % cycleMs) / cycleMs
}

/**
 * Draw a click animation - cursor moves to target and clicks
 */
function drawClickAnimation(
  graphics: Graphics,
  screenWidth: number,
  screenHeight: number,
  target: { x: number; y: number },
  cycleProgress: number
): void {
  // Animation phases:
  // 0-0.67: Move to target
  // 0.67-0.83: Click
  // 0.83-1: Pause

  // Start position: offset from target
  const startX = target.x + screenWidth * 0.15
  const startY = target.y - screenHeight * 0.15

  let cursorX: number, cursorY: number
  let clickScale = 1
  let clickAlpha = 0

  if (cycleProgress < 0.67) {
    // Moving phase
    const moveProgress = cycleProgress / 0.67
    const eased = easeOutCubic(moveProgress)
    cursorX = startX + (target.x - startX) * eased
    cursorY = startY + (target.y - startY) * eased
  } else if (cycleProgress < 0.83) {
    // Click phase
    const clickProgress = (cycleProgress - 0.67) / 0.16
    cursorX = target.x
    cursorY = target.y
    clickScale = 1 - 0.15 * Math.sin(clickProgress * Math.PI)
    clickAlpha = Math.sin(clickProgress * Math.PI)
  } else {
    // Pause phase
    cursorX = target.x
    cursorY = target.y
  }

  // Draw cursor
  drawCursor(graphics, cursorX, cursorY, clickScale)

  // Draw click ripple
  if (clickAlpha > 0) {
    drawClickRipple(graphics, target.x, target.y, clickAlpha)
  }
}

/**
 * Draw a double-tap animation (mobile) - finger taps twice on target
 * Used for actions that require double-tap on mobile (install, enter scope)
 */
function drawDoubleTapAnimation(
  graphics: Graphics,
  screenWidth: number,
  screenHeight: number,
  target: { x: number; y: number },
  cycleProgress: number
): void {
  // Animation phases (4 second cycle):
  // 0-0.3: Move to target
  // 0.3-0.4: First tap
  // 0.4-0.5: Lift (brief pause)
  // 0.5-0.6: Second tap
  // 0.6-1.0: Pause before reset

  // Start position: offset from target
  const startX = target.x + screenWidth * 0.15
  const startY = target.y - screenHeight * 0.15

  let cursorX: number, cursorY: number
  let clickScale = 1
  let tap1Alpha = 0
  let tap2Alpha = 0

  if (cycleProgress < 0.3) {
    // Moving phase
    const moveProgress = cycleProgress / 0.3
    const eased = easeOutCubic(moveProgress)
    cursorX = startX + (target.x - startX) * eased
    cursorY = startY + (target.y - startY) * eased
  } else if (cycleProgress < 0.4) {
    // First tap
    const tapProgress = (cycleProgress - 0.3) / 0.1
    cursorX = target.x
    cursorY = target.y
    clickScale = 1 - 0.15 * Math.sin(tapProgress * Math.PI)
    tap1Alpha = Math.sin(tapProgress * Math.PI)
  } else if (cycleProgress < 0.5) {
    // Brief pause between taps (finger slightly lifted)
    const liftProgress = (cycleProgress - 0.4) / 0.1
    cursorX = target.x
    // Slight upward movement to show lift
    cursorY = target.y - 4 * Math.sin(liftProgress * Math.PI)
  } else if (cycleProgress < 0.6) {
    // Second tap
    const tapProgress = (cycleProgress - 0.5) / 0.1
    cursorX = target.x
    cursorY = target.y
    clickScale = 1 - 0.15 * Math.sin(tapProgress * Math.PI)
    tap2Alpha = Math.sin(tapProgress * Math.PI)
  } else {
    // Pause phase
    cursorX = target.x
    cursorY = target.y
  }

  // Draw cursor (will use finger on mobile automatically)
  drawCursor(graphics, cursorX, cursorY, clickScale)

  // Draw first tap ripple
  if (tap1Alpha > 0) {
    drawClickRipple(graphics, target.x, target.y, tap1Alpha)
  }

  // Draw second tap ripple (slightly larger to emphasize sequence)
  if (tap2Alpha > 0) {
    drawClickRipple(graphics, target.x, target.y, tap2Alpha * 1.15)
  }
}

/**
 * Draw a drag animation - cursor drags from A to B
 */
function drawDragAnimation(
  graphics: Graphics,
  screenWidth: number,
  screenHeight: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  cycleProgress: number
): void {
  // Animation phases:
  // 0-0.25: Move to source
  // 0.25-0.35: Press down (start drag)
  // 0.35-0.75: Drag to target
  // 0.75-0.85: Release
  // 0.85-1: Pause

  // Start position: offset from source
  const startX = from.x + screenWidth * 0.12
  const startY = from.y - screenHeight * 0.12

  let cursorX: number, cursorY: number
  let clickScale = 1
  let isDragging = false
  let releaseAlpha = 0

  if (cycleProgress < 0.25) {
    // Move to source
    const moveProgress = cycleProgress / 0.25
    const eased = easeOutCubic(moveProgress)
    cursorX = startX + (from.x - startX) * eased
    cursorY = startY + (from.y - startY) * eased
  } else if (cycleProgress < 0.35) {
    // Press down
    const pressProgress = (cycleProgress - 0.25) / 0.1
    cursorX = from.x
    cursorY = from.y
    clickScale = 1 - 0.1 * Math.sin(pressProgress * Math.PI * 0.5)
    isDragging = pressProgress > 0.5
  } else if (cycleProgress < 0.75) {
    // Drag to target
    const dragProgress = (cycleProgress - 0.35) / 0.4
    const eased = easeInOutCubic(dragProgress)
    cursorX = from.x + (to.x - from.x) * eased
    cursorY = from.y + (to.y - from.y) * eased
    clickScale = 0.9 // Pressed down during drag
    isDragging = true
  } else if (cycleProgress < 0.85) {
    // Release
    const releaseProgress = (cycleProgress - 0.75) / 0.1
    cursorX = to.x
    cursorY = to.y
    clickScale = 0.9 + 0.1 * releaseProgress
    releaseAlpha = Math.sin(releaseProgress * Math.PI)
  } else {
    // Pause
    cursorX = to.x
    cursorY = to.y
  }

  // Draw drag trail when dragging
  if (isDragging) {
    drawDragTrail(graphics, from, { x: cursorX, y: cursorY })
  }

  // Draw cursor
  drawCursor(graphics, cursorX, cursorY, clickScale, isDragging)

  // Draw release ripple
  if (releaseAlpha > 0) {
    drawClickRipple(graphics, to.x, to.y, releaseAlpha)
  }
}

/**
 * Draw the appropriate cursor based on platform
 */
function drawCursor(
  graphics: Graphics,
  x: number,
  y: number,
  scale: number = 1,
  pressed: boolean = false
): void {
  if (isMobileDevice()) {
    drawFingerCursor(graphics, x, y, scale, pressed)
  } else {
    drawMouseCursor(graphics, x, y, scale, pressed)
  }
}

/**
 * Draw mouse pointer (desktop)
 */
function drawMouseCursor(
  graphics: Graphics,
  x: number,
  y: number,
  scale: number = 1,
  pressed: boolean = false
): void {
  const size = 28 * scale
  const alpha = pressed ? 0.85 : 0.95

  // Simple arrow pointer - tip at cursor position
  graphics.moveTo(x, y) // Tip
  graphics.lineTo(x, y + size) // Down left edge
  graphics.lineTo(x + size * 0.35, y + size * 0.7) // Angle in
  graphics.lineTo(x + size * 0.7, y + size * 0.7) // Right
  graphics.closePath()

  // Dark outline for visibility
  graphics.stroke({ color: CURSOR_OUTLINE, width: 3, alpha: 0.6 })
  graphics.fill({ color: CURSOR_COLOR, alpha })
}

/**
 * Draw finger/touch cursor (mobile)
 * Simple finger icon pointing down at the touch target
 */
function drawFingerCursor(
  graphics: Graphics,
  x: number,
  y: number,
  scale: number = 1,
  pressed: boolean = false
): void {
  const size = 28 * scale
  const alpha = pressed ? 0.85 : 0.95

  // Finger pointing down - tip at touch position
  const fingerWidth = size * 0.45
  const fingerHeight = size * 0.95
  const tipRadius = fingerWidth / 2

  // Finger body - rounded top, tip pointing down
  // Draw from tip upward
  const tipY = y
  const topY = y - fingerHeight

  // Left side of finger
  graphics.moveTo(x - fingerWidth / 2, tipY - tipRadius)
  graphics.lineTo(x - fingerWidth / 2, topY + tipRadius)
  // Rounded top
  graphics.arc(x, topY + tipRadius, fingerWidth / 2, Math.PI, 0, false)
  // Right side of finger
  graphics.lineTo(x + fingerWidth / 2, tipY - tipRadius)
  // Rounded tip
  graphics.arc(x, tipY - tipRadius, fingerWidth / 2, 0, Math.PI, false)
  graphics.closePath()

  // Dark outline for visibility
  graphics.stroke({ color: CURSOR_OUTLINE, width: 3, alpha: 0.6 })
  graphics.fill({ color: CURSOR_COLOR, alpha })

  // Fingernail detail at top
  const nailY = topY + tipRadius * 1.2
  const nailWidth = fingerWidth * 0.5
  const nailHeight = fingerWidth * 0.35
  graphics.roundRect(
    x - nailWidth / 2,
    nailY,
    nailWidth,
    nailHeight,
    nailHeight / 3
  )
  graphics.fill({ color: CURSOR_OUTLINE, alpha: 0.15 })
}

/**
 * Draw click ripple effect
 */
function drawClickRipple(
  graphics: Graphics,
  x: number,
  y: number,
  alpha: number
): void {
  const rippleRadius = 20 + alpha * 30
  graphics.circle(x, y, rippleRadius)
  graphics.stroke({
    color: RIPPLE_COLOR,
    width: 3,
    alpha: alpha * 0.6,
  })
}

/**
 * Draw drag trail line
 */
function drawDragTrail(
  graphics: Graphics,
  from: { x: number; y: number },
  to: { x: number; y: number }
): void {
  // Dashed line effect
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const dashLen = 8
  const gapLen = 6
  const segments = Math.floor(dist / (dashLen + gapLen))

  for (let i = 0; i < segments; i++) {
    const t1 = (i * (dashLen + gapLen)) / dist
    const t2 = (i * (dashLen + gapLen) + dashLen) / dist

    const x1 = from.x + dx * t1
    const y1 = from.y + dy * t1
    const x2 = from.x + dx * Math.min(t2, 1)
    const y2 = from.y + dy * Math.min(t2, 1)

    graphics.moveTo(x1, y1)
    graphics.lineTo(x2, y2)
  }

  graphics.stroke({
    color: CURSOR_COLOR,
    width: 2,
    alpha: 0.4,
  })
}

// Easing functions
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
