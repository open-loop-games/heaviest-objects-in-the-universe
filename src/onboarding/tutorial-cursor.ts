// Tutorial cursor animation - animated click hint
// Shows after inactivity to guide players

import { Graphics } from 'pixi.js'
import { gameState } from '../game/state'
import { isInPackageScope } from '../game/scope'
import { getCursorHintState } from './tutorial-state'

/**
 * Draw the tutorial cursor animation
 * Shows after 15s of inactivity on first click or second package scenarios
 */
export function drawTutorialCursor(
  graphics: Graphics,
  screenWidth: number,
  screenHeight: number,
  worldToScreen: (x: number, y: number) => { x: number; y: number }
): void {
  graphics.clear()

  // Don't show if in a package scope
  if (isInPackageScope()) return

  // Get root package position
  const rootPkg = gameState.rootId
    ? gameState.packages.get(gameState.rootId)
    : null
  if (!rootPkg) return

  // Check if cursor hint should show
  const hintState = getCursorHintState()
  if (!hintState || !hintState.show) return

  const { elapsed } = hintState
  const targetScreen = worldToScreen(rootPkg.position.x, rootPkg.position.y)

  // Animation cycle: 3 seconds total
  // 0-2s: cursor moves from start to target
  // 2-2.5s: click animation (cursor presses down)
  // 2.5-3s: pause, then loop
  const cycleMs = 3000
  const delayMs = 15000
  const cycleProgress = ((elapsed - delayMs) % cycleMs) / cycleMs

  // Start position: top-right area of screen
  const startX = screenWidth * 0.7
  const startY = screenHeight * 0.3

  let cursorX: number, cursorY: number
  let clickScale = 1
  let clickAlpha = 0

  if (cycleProgress < 0.67) {
    // Moving phase (0-2s)
    const moveProgress = cycleProgress / 0.67
    // Ease out cubic for smooth deceleration
    const eased = 1 - Math.pow(1 - moveProgress, 3)
    cursorX = startX + (targetScreen.x - startX) * eased
    cursorY = startY + (targetScreen.y - startY) * eased
  } else if (cycleProgress < 0.83) {
    // Click phase (2-2.5s)
    const clickProgress = (cycleProgress - 0.67) / 0.16
    cursorX = targetScreen.x
    cursorY = targetScreen.y
    // Press down effect
    clickScale = 1 - 0.15 * Math.sin(clickProgress * Math.PI)
    clickAlpha = Math.sin(clickProgress * Math.PI)
  } else {
    // Pause phase (2.5-3s)
    cursorX = targetScreen.x
    cursorY = targetScreen.y
  }

  // Draw cursor (clean pointer shape)
  const cursorSize = 28 * clickScale
  const cursorColor = 0xffffff
  const cursorAlpha = 0.95

  // Simple arrow pointer - tip at cursor position
  graphics.moveTo(cursorX, cursorY) // Tip
  graphics.lineTo(cursorX, cursorY + cursorSize) // Down left edge
  graphics.lineTo(cursorX + cursorSize * 0.35, cursorY + cursorSize * 0.7) // Angle in
  graphics.lineTo(cursorX + cursorSize * 0.7, cursorY + cursorSize * 0.7) // Right
  graphics.closePath()

  // Dark outline for visibility
  graphics.stroke({ color: 0x000000, width: 3, alpha: 0.6 })
  graphics.fill({ color: cursorColor, alpha: cursorAlpha })

  // Click ripple effect
  if (clickAlpha > 0) {
    const rippleRadius = 20 + clickAlpha * 30
    graphics.circle(targetScreen.x, targetScreen.y, rippleRadius)
    graphics.stroke({
      color: 0x4ade80,
      width: 3,
      alpha: clickAlpha * 0.6,
    })
  }
}
