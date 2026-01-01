/**
 * Touch input handler for mobile devices
 *
 * Gesture model (reworked for responsiveness):
 * - Touch node → immediate drag (move node / symlink)
 * - Touch empty → immediate camera pan
 * - Touch wire → select wire (show action bar)
 * - Tap (lift without moving) → select / double-tap for action
 * - Two-finger → pinch zoom + pan
 */

import { gameState } from '../game/state'
import { emit } from '../game/events'

// Gesture configuration
const CONFIG = {
  // Distance thresholds (pixels)
  tapMaxDistance: 12, // Movement under this = tap, not drag
  doubleTapMaxGap: 300, // ms between taps for double-tap

  // Zoom limits
  minZoom: 0.3,
  maxZoom: 3,
}

// What's under the touch point
export type HitTestResult =
  | { type: 'node'; id: string; isDuplicate: boolean }
  | { type: 'wire'; id: string; isConflicted: boolean }
  | { type: 'empty' }

// Coordinate conversion function type
export type ScreenToWorldFn = (
  screenX: number,
  screenY: number
) => { x: number; y: number }

// Hit test function type
export type HitTestFn = (worldX: number, worldY: number) => HitTestResult

// Touch state tracking
interface TouchState {
  startTime: number
  startPos: { x: number; y: number }
  currentPos: { x: number; y: number }
  identifier: number
}

// What we're doing with the current touch
type DragMode = 'none' | 'node' | 'pan'

interface PinchState {
  active: boolean
  initialDistance: number
  initialZoom: number
}

interface DoubleTapState {
  lastTapTime: number
  lastTapPos: { x: number; y: number } | null
}

export class TouchInputHandler {
  private canvas: HTMLCanvasElement
  private screenToWorld: ScreenToWorldFn
  private hitTest: HitTestFn

  // Touch tracking
  private primaryTouch: TouchState | null = null
  private secondaryTouch: TouchState | null = null

  // Current drag mode
  private dragMode: DragMode = 'none'
  private hasMoved = false

  // Pinch zoom state
  private pinchState: PinchState = {
    active: false,
    initialDistance: 0,
    initialZoom: 1,
  }

  // Two-finger pan
  private lastPanCenter = { x: 0, y: 0 }

  // Double-tap detection
  private doubleTapState: DoubleTapState = {
    lastTapTime: 0,
    lastTapPos: null,
  }

  constructor(
    canvas: HTMLCanvasElement,
    screenToWorld: ScreenToWorldFn,
    hitTest: HitTestFn
  ) {
    this.canvas = canvas
    this.screenToWorld = screenToWorld
    this.hitTest = hitTest
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('touchstart', this.handleTouchStart, {
      passive: false,
    })
    this.canvas.addEventListener('touchmove', this.handleTouchMove, {
      passive: false,
    })
    this.canvas.addEventListener('touchend', this.handleTouchEnd, {
      passive: false,
    })
    this.canvas.addEventListener('touchcancel', this.handleTouchCancel, {
      passive: false,
    })

    // Prevent context menu on long press
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  private handleTouchStart = (e: TouchEvent): void => {
    e.preventDefault()

    const touches = e.changedTouches

    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i]!
      const pos = this.getTouchPos(touch)

      if (!this.primaryTouch) {
        // First finger down
        this.primaryTouch = {
          startTime: Date.now(),
          startPos: { ...pos },
          currentPos: { ...pos },
          identifier: touch.identifier,
        }
        this.hasMoved = false

        // Immediately determine what we're touching
        const worldPos = this.screenToWorld(pos.x, pos.y)
        const hit = this.hitTest(worldPos.x, worldPos.y)

        if (hit.type === 'node') {
          // Start node drag immediately
          this.dragMode = 'node'
          emit('input:drag-start', {
            worldX: worldPos.x,
            worldY: worldPos.y,
            nodeId: hit.id,
          })
        } else if (hit.type === 'wire') {
          // Wire tap - select it, don't drag
          this.dragMode = 'none'
          emit('input:wire-tap', {
            worldX: worldPos.x,
            worldY: worldPos.y,
            wireId: hit.id,
          })
        } else {
          // Empty space - start camera pan
          this.dragMode = 'pan'
        }
      } else if (!this.secondaryTouch) {
        // Second finger down - switch to pinch/pan mode
        this.secondaryTouch = {
          startTime: Date.now(),
          startPos: { ...pos },
          currentPos: { ...pos },
          identifier: touch.identifier,
        }

        // Cancel any node drag
        if (this.dragMode === 'node') {
          emit('input:drag-cancel')
        }
        this.dragMode = 'none'

        // Initialize pinch state
        const distance = this.getDistance(
          this.primaryTouch.currentPos,
          this.secondaryTouch.currentPos
        )
        const center = this.getCenter(
          this.primaryTouch.currentPos,
          this.secondaryTouch.currentPos
        )

        this.pinchState = {
          active: true,
          initialDistance: distance,
          initialZoom: gameState.camera.zoom,
        }
        this.lastPanCenter = center
      }
    }
  }

  private handleTouchMove = (e: TouchEvent): void => {
    e.preventDefault()

    const touches = e.changedTouches

    // Update touch positions
    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i]!
      const pos = this.getTouchPos(touch)

      if (
        this.primaryTouch &&
        touch.identifier === this.primaryTouch.identifier
      ) {
        this.primaryTouch.currentPos = pos
      }
      if (
        this.secondaryTouch &&
        touch.identifier === this.secondaryTouch.identifier
      ) {
        this.secondaryTouch.currentPos = pos
      }
    }

    // Two-finger gesture (pinch/pan)
    if (this.primaryTouch && this.secondaryTouch && this.pinchState.active) {
      this.handlePinchMove()
      return
    }

    // Single finger
    if (this.primaryTouch && !this.secondaryTouch) {
      const dx = this.primaryTouch.currentPos.x - this.primaryTouch.startPos.x
      const dy = this.primaryTouch.currentPos.y - this.primaryTouch.startPos.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Check if we've moved enough to not be a tap
      if (distance > CONFIG.tapMaxDistance) {
        this.hasMoved = true
      }

      if (this.dragMode === 'node') {
        // Dragging a node
        const worldPos = this.screenToWorld(
          this.primaryTouch.currentPos.x,
          this.primaryTouch.currentPos.y
        )
        emit('input:drag-move', { worldX: worldPos.x, worldY: worldPos.y })
      } else if (this.dragMode === 'pan' && this.hasMoved) {
        // Panning camera
        const dx = this.primaryTouch.currentPos.x - this.primaryTouch.startPos.x
        const dy = this.primaryTouch.currentPos.y - this.primaryTouch.startPos.y

        // Incremental pan for smooth feel
        gameState.camera.x += dx / gameState.camera.zoom
        gameState.camera.y += dy / gameState.camera.zoom

        // Update start pos for next frame (incremental)
        this.primaryTouch.startPos = { ...this.primaryTouch.currentPos }
      }
    }
  }

  private handlePinchMove(): void {
    if (!this.primaryTouch || !this.secondaryTouch) return

    const currentDistance = this.getDistance(
      this.primaryTouch.currentPos,
      this.secondaryTouch.currentPos
    )
    const currentCenter = this.getCenter(
      this.primaryTouch.currentPos,
      this.secondaryTouch.currentPos
    )

    // Pinch zoom
    const scale = currentDistance / this.pinchState.initialDistance
    const newZoom = Math.max(
      CONFIG.minZoom,
      Math.min(CONFIG.maxZoom, this.pinchState.initialZoom * scale)
    )

    // Zoom toward pinch center
    const rect = this.canvas.getBoundingClientRect()
    const centerX = currentCenter.x - rect.width / 2
    const centerY = currentCenter.y - rect.height / 2

    const worldCenterX = centerX / gameState.camera.zoom - gameState.camera.x
    const worldCenterY = centerY / gameState.camera.zoom - gameState.camera.y

    gameState.camera.zoom = newZoom

    const newWorldCenterX = centerX / newZoom - gameState.camera.x
    const newWorldCenterY = centerY / newZoom - gameState.camera.y

    gameState.camera.x += newWorldCenterX - worldCenterX
    gameState.camera.y += newWorldCenterY - worldCenterY

    // Two-finger pan
    const panDx = currentCenter.x - this.lastPanCenter.x
    const panDy = currentCenter.y - this.lastPanCenter.y

    gameState.camera.x += panDx / gameState.camera.zoom
    gameState.camera.y += panDy / gameState.camera.zoom

    this.lastPanCenter = currentCenter
  }

  private handleTouchEnd = (e: TouchEvent): void => {
    e.preventDefault()

    const touches = e.changedTouches

    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i]!

      if (
        this.primaryTouch &&
        touch.identifier === this.primaryTouch.identifier
      ) {
        const worldPos = this.screenToWorld(
          this.primaryTouch.currentPos.x,
          this.primaryTouch.currentPos.y
        )

        if (this.dragMode === 'node') {
          if (this.hasMoved) {
            // End node drag
            emit('input:drag-end', { worldX: worldPos.x, worldY: worldPos.y })
          } else {
            // Didn't move - cancel drag, treat as tap
            emit('input:drag-cancel')
            this.handleTap(this.primaryTouch.currentPos)
          }
        } else if (this.dragMode === 'pan') {
          if (!this.hasMoved) {
            // Didn't move - treat as tap on empty space
            this.handleTap(this.primaryTouch.currentPos)
          }
          // If moved, pan already happened, nothing to do
        } else if (this.dragMode === 'none') {
          // Wire was tapped, already handled in touchstart
          // But check for tap in case it was a quick touch
          if (!this.hasMoved) {
            this.handleTap(this.primaryTouch.currentPos)
          }
        }

        this.primaryTouch = null
        this.dragMode = 'none'
        this.hasMoved = false
      }

      if (
        this.secondaryTouch &&
        touch.identifier === this.secondaryTouch.identifier
      ) {
        this.secondaryTouch = null
        this.pinchState.active = false
      }
    }
  }

  private handleTouchCancel = (e: TouchEvent): void => {
    e.preventDefault()

    if (this.dragMode === 'node') {
      emit('input:drag-cancel')
    }

    this.primaryTouch = null
    this.secondaryTouch = null
    this.dragMode = 'none'
    this.hasMoved = false
    this.pinchState.active = false
  }

  private handleTap(screenPos: { x: number; y: number }): void {
    const now = Date.now()
    const worldPos = this.screenToWorld(screenPos.x, screenPos.y)

    // Check for double-tap
    if (this.doubleTapState.lastTapPos) {
      const timeSinceLastTap = now - this.doubleTapState.lastTapTime
      const dx = screenPos.x - this.doubleTapState.lastTapPos.x
      const dy = screenPos.y - this.doubleTapState.lastTapPos.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (
        timeSinceLastTap < CONFIG.doubleTapMaxGap &&
        distance < CONFIG.tapMaxDistance * 2
      ) {
        // Double-tap detected - trigger action
        emit('input:action', { worldX: worldPos.x, worldY: worldPos.y })
        this.doubleTapState.lastTapTime = 0
        this.doubleTapState.lastTapPos = null
        return
      }
    }

    // Single tap - record for potential double-tap
    this.doubleTapState.lastTapTime = now
    this.doubleTapState.lastTapPos = { ...screenPos }

    // Emit select event (GameCanvas handles the logic)
    emit('input:select', { worldX: worldPos.x, worldY: worldPos.y })
  }

  private getTouchPos(touch: Touch): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    }
  }

  private getDistance(
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ): number {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  private getCenter(
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ): { x: number; y: number } {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    }
  }

  destroy(): void {
    this.canvas.removeEventListener('touchstart', this.handleTouchStart)
    this.canvas.removeEventListener('touchmove', this.handleTouchMove)
    this.canvas.removeEventListener('touchend', this.handleTouchEnd)
    this.canvas.removeEventListener('touchcancel', this.handleTouchCancel)
  }
}

/**
 * Platform detection utility
 */
export function isTouchDevice(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error - msMaxTouchPoints is IE/Edge specific
    navigator.msMaxTouchPoints > 0
  )
}

/**
 * Check if device is likely mobile (touch + small screen)
 */
export function isMobileDevice(): boolean {
  return isTouchDevice() && window.innerWidth < 768
}
