/**
 * Platform-aware input handling
 *
 * Exports the appropriate input handler based on device type.
 * Both handlers use a consistent callback interface so the game
 * logic doesn't need to know which input system is active.
 */

export { TouchInputHandler, isTouchDevice, isMobileDevice } from './touch-input'
export { MouseInputHandler } from './mouse-input'
export type { TouchInputCallbacks } from './touch-input'
export type { MouseInputCallbacks } from './mouse-input'

/**
 * Unified input callbacks that work for both touch and mouse
 */
export interface UnifiedInputCallbacks {
  // Selection (tap or click)
  onSelect: (worldPos: { x: number; y: number }) => void
  onDeselect: () => void

  // Primary action (double-tap or click on interactive element)
  onAction: (worldPos: { x: number; y: number }) => void

  // Wire interaction
  onWireTap: (worldPos: { x: number; y: number }) => void

  // Drag for symlink
  onDragStart: (worldPos: { x: number; y: number }) => void
  onDragMove: (worldPos: { x: number; y: number }) => void
  onDragEnd: (worldPos: { x: number; y: number }) => void
  onDragCancel: () => void

  // Hover (desktop only - no-op on mobile)
  onHover?: (worldPos: { x: number; y: number }) => void

  // Coordinate conversion
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number }
}

/**
 * Platform detection with caching
 */
let _platformCache: 'desktop' | 'mobile' | null = null

export function detectPlatform(): 'desktop' | 'mobile' {
  if (_platformCache) return _platformCache

  const isTouchPrimary =
    'ontouchstart' in window || navigator.maxTouchPoints > 0

  const isSmallScreen = window.innerWidth < 768

  // Mobile = touch device with small screen
  // Large touch screens (tablets, touch laptops) get desktop UI
  _platformCache = isTouchPrimary && isSmallScreen ? 'mobile' : 'desktop'

  return _platformCache
}

/**
 * Reset platform detection (useful for testing or orientation change)
 */
export function resetPlatformDetection(): void {
  _platformCache = null
}
