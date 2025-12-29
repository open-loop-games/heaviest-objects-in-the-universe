// Accessibility utilities for rendering

/**
 * Check if user prefers reduced motion
 * Returns true if the user has requested reduced motion in their OS settings
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get animation duration multiplier based on reduced motion preference
 * Returns 0 for reduced motion (instant), 1 for normal
 */
export function getAnimationMultiplier(): number {
  return prefersReducedMotion() ? 0 : 1;
}

/**
 * Get pulse phase for effects
 * Returns static value for reduced motion, animated value otherwise
 */
export function getPulsePhase(time: number, cycleMs: number = 1500): number {
  if (prefersReducedMotion()) {
    return 0.5; // Static middle value
  }
  return (time % cycleMs) / cycleMs;
}

/**
 * Get pulse intensity (0-1 oscillating)
 * Returns static value for reduced motion
 */
export function getPulseIntensity(phase: number): number {
  if (prefersReducedMotion()) {
    return 0.5; // Static middle value
  }
  return 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
}

/**
 * Get shake offset for conflict effects
 * Returns zero for reduced motion
 */
export function getShakeOffset(time: number, intensity: number = 2): { x: number; y: number } {
  if (prefersReducedMotion()) {
    return { x: 0, y: 0 };
  }
  return {
    x: Math.sin(time * 0.02) * intensity,
    y: 0,
  };
}
