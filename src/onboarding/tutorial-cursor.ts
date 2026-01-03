// Tutorial cursor animation - animated ghost hand hints
// Shows after inactivity to guide players through game mechanics

import { Graphics } from 'pixi.js'
import { getActiveGhostHint, type GhostHint } from './tutorial-state'

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

  // Convert world positions to screen positions
  const screenTargets = hint.targets.map((t) => worldToScreen(t.x, t.y))

  // Calculate animation progress
  const cycleProgress = getCycleProgress(hint)

  // Draw based on hint type
  switch (hint.type) {
    case 'click-root':
    case 'click-package':
    case 'click-prestige':
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
    case 'click-conflict':
      drawClickAnimation(
        graphics,
        screenWidth,
        screenHeight,
        screenTargets[0]!,
        cycleProgress
      )
      break
  }
}

/**
 * Get cycle progress (0-1) for animation looping
 */
function getCycleProgress(hint: GhostHint): number {
  const cycleMs = 3000
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
 * Draw the cursor pointer
 */
function drawCursor(
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
