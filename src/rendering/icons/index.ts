// Unified icon system for package visualization
//
// Icon resolution priority:
// 1. Semantic icons (hand-drawn, keyed by package name)
// 2. Devicon SVGs (external, keyed by iconKey)
// 3. Procedural fallback (hash-based shapes by archetype)

import { Graphics, ColorMatrixFilter } from 'pixi.js'
import { hasSemanticIcon, drawSemanticIcon, SEMANTIC_ICONS } from './semantic'
import { drawProceduralIcon, getIconColor } from './procedural'

// ============================================
// DEVICON SVG SYSTEM
// ============================================

// Cache for SVG content strings (keyed by iconKey)
const svgCache = new Map<string, string | null>()
const loadingPromises = new Map<string, Promise<string | null>>()
// Track SVGs that failed to parse
const parseFailures = new Set<string>()

// Light color to tint plain SVGs for visibility
const ICON_TINT_COLOR = '#c8d8c8'

function getDeviconPaths(iconKey: string): { original: string; plain: string } {
  // Icons are copied to public/icons by scripts/copy-devicons.js
  const base = `/icons/${iconKey}/${iconKey}`
  return {
    original: `${base}-original.svg`,
    plain: `${base}-plain.svg`,
  }
}

function tintSvgLight(svgText: string): string {
  let result = svgText
  result = result.replace(/fill="(?!none)[^"]*"/gi, `fill="${ICON_TINT_COLOR}"`)
  result = result.replace(
    /fill:\s*(?!none)[^;"}]*/gi,
    `fill:${ICON_TINT_COLOR}`
  )
  return result
}

async function fetchSvgContent(iconKey: string): Promise<string | null> {
  if (svgCache.has(iconKey)) {
    return svgCache.get(iconKey) || null
  }

  if (loadingPromises.has(iconKey)) {
    return loadingPromises.get(iconKey)!
  }

  const paths = getDeviconPaths(iconKey)

  const promise = (async () => {
    // Try -original first (has brand colors)
    try {
      const response = await fetch(paths.original)
      if (response.ok) {
        const svgText = await response.text()
        svgCache.set(iconKey, svgText)
        return svgText
      }
    } catch {
      // Fall through to try plain
    }

    // Fall back to -plain with light tinting
    try {
      const response = await fetch(paths.plain)
      if (response.ok) {
        const svgText = await response.text()
        const tintedSvg = tintSvgLight(svgText)
        svgCache.set(iconKey, tintedSvg)
        return tintedSvg
      }
    } catch {
      // Silent fail - will use fallback
    }

    svgCache.set(iconKey, null)
    return null
  })()

  loadingPromises.set(iconKey, promise)
  return promise
}

// ============================================
// ICON VARIANTS (for ecosystem packages)
// ============================================

interface IconVariant {
  baseIcon: string
  hueShift?: number
  saturate?: number
  brightness?: number
}

const ICON_VARIANTS: Record<string, IconVariant> = {
  // React ecosystem variants
  'react-dom': { baseIcon: 'react', hueShift: 30 },
  'react-native': { baseIcon: 'react', hueShift: 180 },
  'react-router': { baseIcon: 'react', hueShift: 270, saturate: 1.3 },
  'react-query': { baseIcon: 'react', hueShift: 320 },
  // Vue ecosystem variants
  'vue-router': { baseIcon: 'vuejs', hueShift: 60 },
  vuex: { baseIcon: 'vuejs', hueShift: 200, saturate: 0.8 },
  pinia: { baseIcon: 'vuejs', hueShift: 330 },
  // Node runtime packages now use procedural icons for better distinction
}

/**
 * Apply variant effects using Pixi's ColorMatrixFilter
 * This actually works, unlike CSS filters in SVG strings
 */
function applyVariantFilter(g: Graphics, variant: IconVariant): void {
  const filter = new ColorMatrixFilter()

  // Apply hue rotation (convert degrees to Pixi's rotation value)
  if (variant.hueShift) {
    filter.hue(variant.hueShift, false)
  }

  // Apply saturation adjustment
  if (variant.saturate && variant.saturate !== 1) {
    filter.saturate(variant.saturate - 1, false) // Pixi saturate is additive (-1 to 1)
  }

  // Apply brightness adjustment
  if (variant.brightness && variant.brightness !== 1) {
    filter.brightness(variant.brightness, false)
  }

  g.filters = [filter]
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Create a Graphics object with the appropriate icon for a package.
 * Tries semantic → devicon → procedural in order.
 *
 * @param packageName The actual package name (e.g., 'lodash', 'zod')
 * @param iconKey The devicon key (e.g., 'react', 'vuejs') - only used for devicon lookup
 * @param size Target size for the icon
 * @param archetype Package archetype for procedural fallback coloring
 * @returns Graphics object, or null if async loading (call again next frame)
 */
export function createPackageIcon(
  packageName: string,
  iconKey: string | undefined,
  size: number,
  archetype?: string
): Graphics | null {
  const g = new Graphics()

  // 1. Try semantic icon first (by package name)
  if (hasSemanticIcon(packageName)) {
    const hash = hashString(packageName)
    const hue = hash % 360
    const color = getIconColor(hue)

    drawSemanticIcon(g, packageName, size, color)
    return g
  }

  // 2. Try devicon (if iconKey provided and not 'npm')
  if (iconKey && iconKey !== 'npm') {
    const variant = ICON_VARIANTS[packageName]
    // For variants, use the base icon key for caching/fetching
    const actualIconKey = variant ? variant.baseIcon : iconKey
    const failureKey = variant ? `variant:${packageName}` : iconKey

    if (parseFailures.has(failureKey)) {
      // Known to fail, use procedural
      drawProceduralIcon(g, packageName, size, archetype)
      return g
    }

    const svgContent = svgCache.get(actualIconKey)
    if (svgContent === undefined) {
      fetchSvgContent(actualIconKey)
      return null // Loading
    }

    if (svgContent) {
      try {
        g.svg(svgContent)
        const svgSize = 128
        const scale = size / svgSize
        g.scale.set(scale)
        g.pivot.set(svgSize / 2, svgSize / 2)

        // Apply variant filter (hue shift, saturation, brightness) via Pixi
        if (variant) {
          applyVariantFilter(g, variant)
        }

        return g
      } catch {
        parseFailures.add(failureKey)
        // Create a fresh graphics object for procedural fallback
        // The failed SVG parse may have left drawing state in g
        const fallbackG = new Graphics()
        drawProceduralIcon(fallbackG, packageName, size, archetype)
        return fallbackG
      }
    }
  }

  // 3. Procedural fallback
  drawProceduralIcon(g, packageName, size, archetype)
  return g
}

/**
 * Check if an icon is ready to render (not loading)
 */
export function isIconReady(packageName: string, iconKey?: string): boolean {
  // Semantic icons are always ready
  if (hasSemanticIcon(packageName)) return true

  // Check devicon cache
  if (iconKey && iconKey !== 'npm') {
    const variant = ICON_VARIANTS[packageName]
    // For variants, check if the base icon is cached
    const actualIconKey = variant ? variant.baseIcon : iconKey
    return svgCache.has(actualIconKey)
  }

  // Procedural is always ready
  return true
}

/**
 * Preload devicon SVGs for faster rendering
 */
export async function preloadIcons(iconKeys: string[]): Promise<void> {
  await Promise.all(iconKeys.map(fetchSvgContent))
}

/**
 * Get the list of all semantic icon package names
 */
export function getSemanticIconNames(): string[] {
  return Object.keys(SEMANTIC_ICONS)
}

// Simple hash for color generation
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

// Re-export utilities that might be needed elsewhere
export {
  nameToHue,
  hslToHex,
  getIconColor,
  drawProceduralIcon,
} from './procedural'
export { hasSemanticIcon } from './semantic'
