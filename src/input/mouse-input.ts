/**
 * Mouse input handler for desktop
 *
 * Extracted from renderer.ts and GameCanvas.vue for clean separation.
 * Uses same callback interface as touch-input.ts for consistency.
 */

import { gameState } from '../game/state'

const CONFIG = {
  // Zoom limits
  minZoom: 0.1,
  maxZoom: 5,

  // Zoom speed
  zoomFactor: 0.1,
}

export interface MouseInputCallbacks {
  // Click actions
  onClick: (worldPos: { x: number; y: number }, event: MouseEvent) => void

  // Drag operations
  onDragStart: (worldPos: { x: number; y: number }) => void
  onDragMove: (worldPos: { x: number; y: number }) => void
  onDragEnd: (worldPos: { x: number; y: number }) => void

  // Hover (for previews, cursor changes)
  onHover: (worldPos: { x: number; y: number }) => void

  // Coordinate conversion
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number }
}

export class MouseInputHandler {
  private canvas: HTMLCanvasElement
  private callbacks: MouseInputCallbacks

  // Pan state
  private isPanning = false
  private lastPanPos = { x: 0, y: 0 }

  // Drag state (for symlink, etc.)
  private isDragging = false
  private dragStartPos: { x: number; y: number } | null = null

  constructor(canvas: HTMLCanvasElement, callbacks: MouseInputCallbacks) {
    this.canvas = canvas
    this.callbacks = callbacks
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('mousedown', this.handleMouseDown)
    this.canvas.addEventListener('mousemove', this.handleMouseMove)
    this.canvas.addEventListener('mouseup', this.handleMouseUp)
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave)
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false })
  }

  private handleMouseDown = (e: MouseEvent): void => {
    const screenPos = this.getMousePos(e)
    const worldPos = this.callbacks.screenToWorld(screenPos.x, screenPos.y)

    // Middle mouse or shift+left = pan
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      this.isPanning = true
      this.lastPanPos = { x: e.clientX, y: e.clientY }
      e.preventDefault()
      return
    }

    // Left click
    if (e.button === 0) {
      this.dragStartPos = worldPos
      this.callbacks.onClick(worldPos, e)
    }
  }

  private handleMouseMove = (e: MouseEvent): void => {
    const screenPos = this.getMousePos(e)
    const worldPos = this.callbacks.screenToWorld(screenPos.x, screenPos.y)

    // Handle panning
    if (this.isPanning) {
      const dx = e.clientX - this.lastPanPos.x
      const dy = e.clientY - this.lastPanPos.y

      gameState.camera.x += dx / gameState.camera.zoom
      gameState.camera.y += dy / gameState.camera.zoom

      this.lastPanPos = { x: e.clientX, y: e.clientY }
      return
    }

    // Handle dragging
    if (this.dragStartPos && e.buttons === 1) {
      const dx = worldPos.x - this.dragStartPos.x
      const dy = worldPos.y - this.dragStartPos.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (!this.isDragging && distance > 10 / gameState.camera.zoom) {
        this.isDragging = true
        this.callbacks.onDragStart(this.dragStartPos)
      }

      if (this.isDragging) {
        this.callbacks.onDragMove(worldPos)
      }
    }

    // Always report hover for cursor/preview updates
    this.callbacks.onHover(worldPos)
  }

  private handleMouseUp = (e: MouseEvent): void => {
    const screenPos = this.getMousePos(e)
    const worldPos = this.callbacks.screenToWorld(screenPos.x, screenPos.y)

    if (this.isPanning) {
      this.isPanning = false
    }

    if (this.isDragging) {
      this.callbacks.onDragEnd(worldPos)
      this.isDragging = false
    }

    this.dragStartPos = null
  }

  private handleMouseLeave = (): void => {
    this.isPanning = false

    if (this.isDragging) {
      // Cancel drag on mouse leave
      this.isDragging = false
    }

    this.dragStartPos = null
  }

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault()

    const zoomFactor =
      e.deltaY > 0 ? 1 - CONFIG.zoomFactor : 1 + CONFIG.zoomFactor
    const newZoom = Math.max(
      CONFIG.minZoom,
      Math.min(CONFIG.maxZoom, gameState.camera.zoom * zoomFactor)
    )

    // Zoom toward mouse position
    const rect = this.canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left - rect.width / 2
    const mouseY = e.clientY - rect.top - rect.height / 2

    // Calculate world position under mouse
    const worldMouseX = mouseX / gameState.camera.zoom - gameState.camera.x
    const worldMouseY = mouseY / gameState.camera.zoom - gameState.camera.y

    gameState.camera.zoom = newZoom

    // Adjust camera to keep world position under mouse
    const newWorldMouseX = mouseX / newZoom - gameState.camera.x
    const newWorldMouseY = mouseY / newZoom - gameState.camera.y

    gameState.camera.x += newWorldMouseX - worldMouseX
    gameState.camera.y += newWorldMouseY - worldMouseY
  }

  private getMousePos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  /**
   * Update cursor style
   */
  setCursor(cursor: string): void {
    this.canvas.style.cursor = cursor
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown)
    this.canvas.removeEventListener('mousemove', this.handleMouseMove)
    this.canvas.removeEventListener('mouseup', this.handleMouseUp)
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave)
    this.canvas.removeEventListener('wheel', this.handleWheel)
  }
}
