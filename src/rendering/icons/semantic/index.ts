// Semantic icon registry - maps package names to hand-drawn icons
// Priority lookup: if a package is here, it gets a custom icon
import { Graphics } from 'pixi.js'

import { MEME_ICONS } from './meme'
import { VALIDATION_ICONS } from './validation'
import { CLI_ICONS } from './cli'
import { SECURITY_ICONS } from './security'
import { DATABASE_ICONS } from './database'
import { HTTP_ICONS } from './http'
import { LEGACY_ICONS } from './legacy'
import { UTILITY_ICONS } from './utility'

// Combined registry of all semantic icons
export const SEMANTIC_ICONS: Record<string, (g: Graphics, s: number, color: number) => void> = {
  ...MEME_ICONS,
  ...VALIDATION_ICONS,
  ...CLI_ICONS,
  ...SECURITY_ICONS,
  ...DATABASE_ICONS,
  ...HTTP_ICONS,
  ...LEGACY_ICONS,
  ...UTILITY_ICONS,
}

/**
 * Check if a package has a semantic icon
 */
export function hasSemanticIcon(packageName: string): boolean {
  return packageName in SEMANTIC_ICONS
}

/**
 * Draw a semantic icon for a package
 * Returns true if an icon was drawn, false if no semantic icon exists
 */
export function drawSemanticIcon(
  g: Graphics,
  packageName: string,
  size: number,
  color: number
): boolean {
  const drawFn = SEMANTIC_ICONS[packageName]
  if (!drawFn) return false

  const s = size * 0.35
  drawFn(g, s, color)
  return true
}

// Export individual categories for direct access if needed
export { MEME_ICONS } from './meme'
export { VALIDATION_ICONS } from './validation'
export { CLI_ICONS } from './cli'
export { SECURITY_ICONS } from './security'
export { DATABASE_ICONS } from './database'
export { HTTP_ICONS } from './http'
export { LEGACY_ICONS } from './legacy'
export { UTILITY_ICONS } from './utility'
