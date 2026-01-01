/**
 * Touch input handler for mobile devices
 *
 * Gesture model:
 * - Tap = Select (node or wire)
 * - Double-tap = Action (enter scope, install from root)
 * - Long-press (300ms) + drag = Symlink merge
 * - Two-finger pan = Camera pan
 * - Pinch = Camera zoom
 * - Tap empty space = Deselect / exit scope
 */

import { gameState } from '../game/state'
import { emit } from '../game/events'

// Gesture configuration
const CONFIG = {
  // Timing (ms)
  tapMaxDuration: 200,
  doubleTapMaxGap: 300,
  longPressThreshold: 300,

  // Distance thresholds (pixels)
  tapMaxDistance: 10,
  dragThreshold: 15,

  // Touch targets (minimum interactive size)
  minTouchTarget: 44,

  // Zoom limits
  minZoom: 0.3,
  maxZoom: 3,
}

// Touch state tracking
interface TouchState {
  // Single touch tracking
  startTime: number
  startPos: { x: number; y: number }
  currentPos: { x: number; y: number }
  identifier: number

  // Gesture detection
  isLongPress: boolean
  isDragging: boolean
  longPressTimer: ReturnType<typeof setTimeout> | null
}

interface PinchState {
  active: boolean
  initialDistance: number
  initialZoom: number
  centerX: number
  centerY: number
}

interface DoubleTapState {
  lastTapTime: number
  lastTapPos: { x: number; y: number } | null
}

// Coordinate conversion function type
export type ScreenToWorldFn = (
  screenX: number,
  screenY: number
) => { x: number; y: number }

export class TouchInputHandler {
  private canvas: HTMLCanvasElement
  private screenToWorld: ScreenToWorldFn

  // Touch tracking
  private primaryTouch: TouchState | null = null
  private secondaryTouch: TouchState | null = null
  private pinchState: PinchState = {
    active: false,
    initialDistance: 0,
    initialZoom: 1,
    centerX: 0,
    centerY: 0,
  }
  private doubleTapState: DoubleTapState = {
    lastTapTime: 0,
    lastTapPos: null,
  }

  // Pan tracking (for two-finger pan)
  private isPanning = false
  private lastPanCenter = { x: 0, y: 0 }

  constructor(canvas: HTMLCanvasElement, screenToWorld: ScreenToWorldFn) {
    this.canvas = canvas
    this.screenToWorld = screenToWorld
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    // Prevent default touch behaviors (scrolling, zooming page)
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
          isLongPress: false,
          isDragging: false,
          longPressTimer: null,
        }

        // Start long-press detection
        this.primaryTouch.longPressTimer = setTimeout(() => {
          if (this.primaryTouch && !this.primaryTouch.isDragging) {
            this.primaryTouch.isLongPress = true
            // Trigger drag start for symlink
            const worldPos = this.screenToWorld(
              this.primaryTouch.currentPos.x,
              this.primaryTouch.currentPos.y
            )
            emit('input:drag-start', { worldX: worldPos.x, worldY: worldPos.y })
          }
        }, CONFIG.longPressThreshold)
      } else if (!this.secondaryTouch) {
        // Second finger down - cancel long press, start pinch/pan
        this.cancelLongPress()

        this.secondaryTouch = {
          startTime: Date.now(),
          startPos: { ...pos },
          currentPos: { ...pos },
          identifier: touch.identifier,
          isLongPress: false,
          isDragging: false,
          longPressTimer: null,
        }

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
          centerX: center.x,
          centerY: center.y,
        }

        this.isPanning = true
        this.lastPanCenter = center

        // Cancel any ongoing drag
        if (this.primaryTouch.isDragging) {
          emit('input:drag-cancel')
          this.primaryTouch.isDragging = false
        }
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
      if (this.isPanning) {
        const dx = currentCenter.x - this.lastPanCenter.x
        const dy = currentCenter.y - this.lastPanCenter.y

        gameState.camera.x += dx / gameState.camera.zoom
        gameState.camera.y += dy / gameState.camera.zoom

        this.lastPanCenter = currentCenter
      }

      return
    }

    // Single finger drag
    if (this.primaryTouch && !this.secondaryTouch) {
      const dx = this.primaryTouch.currentPos.x - this.primaryTouch.startPos.x
      const dy = this.primaryTouch.currentPos.y - this.primaryTouch.startPos.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Check if we've moved enough to be considered a drag
      if (distance > CONFIG.dragThreshold) {
        this.cancelLongPress()

        if (this.primaryTouch.isLongPress) {
          // Long-press drag (symlink)
          this.primaryTouch.isDragging = true
          const worldPos = this.screenToWorld(
            this.primaryTouch.currentPos.x,
            this.primaryTouch.currentPos.y
          )
          emit('input:drag-move', { worldX: worldPos.x, worldY: worldPos.y })
        }
        // Note: Regular drag without long-press doesn't pan on single finger
        // This prevents accidental camera movement when trying to tap
      }
    }
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
        this.cancelLongPress()

        const elapsed = Date.now() - this.primaryTouch.startTime
        const dx = this.primaryTouch.currentPos.x - this.primaryTouch.startPos.x
        const dy = this.primaryTouch.currentPos.y - this.primaryTouch.startPos.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (this.primaryTouch.isDragging) {
          // End symlink drag
          const worldPos = this.screenToWorld(
            this.primaryTouch.currentPos.x,
            this.primaryTouch.currentPos.y
          )
          emit('input:drag-end', { worldX: worldPos.x, worldY: worldPos.y })
        } else if (
          elapsed < CONFIG.tapMaxDuration &&
          distance < CONFIG.tapMaxDistance
        ) {
          // This was a tap
          this.handleTap(this.primaryTouch.currentPos)
        }

        this.primaryTouch = null
      }

      if (
        this.secondaryTouch &&
        touch.identifier === this.secondaryTouch.identifier
      ) {
        this.secondaryTouch = null
        this.pinchState.active = false
        this.isPanning = false
      }
    }
  }

  private handleTouchCancel = (e: TouchEvent): void => {
    e.preventDefault()

    // Cancel any ongoing operations
    this.cancelLongPress()

    if (this.primaryTouch?.isDragging) {
      emit('input:drag-cancel')
    }

    this.primaryTouch = null
    this.secondaryTouch = null
    this.pinchState.active = false
    this.isPanning = false
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

    // Single tap - select or deselect
    this.doubleTapState.lastTapTime = now
    this.doubleTapState.lastTapPos = { ...screenPos }

    // First check for wire tap
    emit('input:wire-tap', { worldX: worldPos.x, worldY: worldPos.y })

    // Then check for node selection (callback decides what to do)
    emit('input:select', { worldX: worldPos.x, worldY: worldPos.y })
  }

  private cancelLongPress(): void {
    if (this.primaryTouch?.longPressTimer) {
      clearTimeout(this.primaryTouch.longPressTimer)
      this.primaryTouch.longPressTimer = null
    }
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

  /**
   * Clean up event listeners
   */
  destroy(): void {
    this.canvas.removeEventListener('touchstart', this.handleTouchStart)
    this.canvas.removeEventListener('touchmove', this.handleTouchMove)
    this.canvas.removeEventListener('touchend', this.handleTouchEnd)
    this.canvas.removeEventListener('touchcancel', this.handleTouchCancel)

    this.cancelLongPress()
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
