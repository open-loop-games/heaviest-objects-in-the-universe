// Unified icon system for package visualization
//
// Icon resolution priority:
// 1. Semantic icons (hand-drawn, keyed by package name)
// 2. Devicon SVGs (external, keyed by iconKey)
// 3. Procedural fallback (hash-based shapes by archetype)

import { Graphics } from 'pixi.js'
import { hasSemanticIcon, drawSemanticIcon, SEMANTIC_ICONS } from './semantic'
import { drawProceduralIcon, hslToHex } from './procedural'

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
  const base = `/node_modules/devicon/icons/${iconKey}/${iconKey}`
  return {
    original: `${base}-original.svg`,
    plain: `${base}-plain.svg`,
  }
}

function tintSvgLight(svgText: string): string {
  let result = svgText
  result = result.replace(/fill="(?!none)[^"]*"/gi, `fill="${ICON_TINT_COLOR}"`)
  result = result.replace(/fill:\s*(?!none)[^;"}]*/gi, `fill:${ICON_TINT_COLOR}`)
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
  'react-dom': { baseIcon: 'react', hueShift: 30 },
  'react-native': { baseIcon: 'react', hueShift: 180 },
  'react-router': { baseIcon: 'react', hueShift: 270, saturate: 1.3 },
  'react-query': { baseIcon: 'react', hueShift: 320 },
  'vue-router': { baseIcon: 'vuejs', hueShift: 60 },
  'vuex': { baseIcon: 'vuejs', hueShift: 200, saturate: 0.8 },
  'pinia': { baseIcon: 'vuejs', hueShift: 330 },
  'fs-extra': { baseIcon: 'nodejs', hueShift: 40 },
  'path': { baseIcon: 'nodejs', hueShift: 180, saturate: 0.7 },
  'buffer': { baseIcon: 'nodejs', hueShift: 270 },
  'process': { baseIcon: 'nodejs', hueShift: 60, brightness: 1.2 },
}

const variantSvgCache = new Map<string, string | null>()

function applyVariantToSvg(svgText: string, variant: IconVariant): string {
  const filters: string[] = []
  if (variant.hueShift) filters.push(`hue-rotate(${variant.hueShift}deg)`)
  if (variant.saturate && variant.saturate !== 1) filters.push(`saturate(${variant.saturate})`)
  if (variant.brightness && variant.brightness !== 1) filters.push(`brightness(${variant.brightness})`)

  if (filters.length === 0) return svgText

  const filterStyle = `filter: ${filters.join(' ')};`
  return svgText
    .replace(/(<svg[^>]*>)/i, `$1<g style="${filterStyle}">`)
    .replace(/<\/svg>/i, '</g></svg>')
}

async function fetchVariantSvg(packageName: string, iconKey: string): Promise<string | null> {
  const variant = ICON_VARIANTS[packageName]
  if (!variant) return fetchSvgContent(iconKey)

  if (variantSvgCache.has(packageName)) {
    return variantSvgCache.get(packageName) || null
  }

  const baseSvg = await fetchSvgContent(variant.baseIcon)
  if (!baseSvg) {
    variantSvgCache.set(packageName, null)
    return null
  }

  const variantSvg = applyVariantToSvg(baseSvg, variant)
  variantSvgCache.set(packageName, variantSvg)
  return variantSvg
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
    const color = hslToHex(hue, 70, 55)

    drawSemanticIcon(g, packageName, size, color)
    return g
  }

  // 2. Try devicon (if iconKey provided and not 'npm')
  if (iconKey && iconKey !== 'npm') {
    const variant = ICON_VARIANTS[packageName]
    const failureKey = variant ? `variant:${packageName}` : iconKey

    if (parseFailures.has(failureKey)) {
      // Known to fail, use procedural
      drawProceduralIcon(g, packageName, size, archetype)
      return g
    }

    let svgContent: string | null | undefined

    if (variant) {
      svgContent = variantSvgCache.get(packageName)
      if (svgContent === undefined) {
        fetchVariantSvg(packageName, iconKey)
        return null // Loading
      }
    } else {
      svgContent = svgCache.get(iconKey)
      if (svgContent === undefined) {
        fetchSvgContent(iconKey)
        return null // Loading
      }
    }

    if (svgContent) {
      try {
        g.svg(svgContent)
        const svgSize = 128
        const scale = size / svgSize
        g.scale.set(scale)
        g.pivot.set(svgSize / 2, svgSize / 2)
        return g
      } catch {
        parseFailures.add(failureKey)
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
    if (variant) {
      return variantSvgCache.has(packageName)
    }
    return svgCache.has(iconKey)
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
export { nameToHue, hslToHex, drawProceduralIcon } from './procedural'
export { hasSemanticIcon } from './semantic'
