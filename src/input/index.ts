/**
 * Platform-aware input handling
 *
 * Touch input uses a dedicated handler that emits events.
 * Mouse input is handled inline in GameCanvas.vue.
 */

export {
  TouchInputHandler,
  isTouchDevice,
  isMobileDevice,
  type ScreenToWorldFn,
} from './touch-input'

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
