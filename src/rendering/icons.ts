// Package icons using Devicon SVGs with Pixi.js Graphics.svg()
// Fetches SVG content and creates Graphics objects
// Includes procedural icon generation for packages without devicons

import { Graphics } from 'pixi.js'

/**
 * Hash a string to a number (for deterministic procedural generation)
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Generate a unique hue (0-360) from a package name
 */
export function nameToHue(name: string): number {
  return hashString(name) % 360
}

/**
 * Convert HSL to hex color
 */
function hslToHex(h: number, s: number, l: number): number {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color)
  }
  return (f(0) << 16) | (f(8) << 8) | f(4)
}

// Cache for SVG content strings
const svgCache = new Map<string, string | null>()
const loadingPromises = new Map<string, Promise<string | null>>()
// Track SVGs that failed to parse (valid fetch but Pixi can't render)
const parseFailures = new Set<string>()

// Build devicon file path from iconKey
// Use -plain variant to avoid gradient parsing warnings
function getDeviconPath(iconKey: string): string {
  return `/node_modules/devicon/icons/${iconKey}/${iconKey}-plain.svg`
}

/**
 * Fetch and cache SVG content
 */
async function fetchSvgContent(iconKey: string): Promise<string | null> {
  // Check cache
  if (svgCache.has(iconKey)) {
    return svgCache.get(iconKey) || null
  }

  // Check if already loading
  if (loadingPromises.has(iconKey)) {
    return loadingPromises.get(iconKey)!
  }

  const url = getDeviconPath(iconKey)

  const promise = (async () => {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const svgText = await response.text()
      svgCache.set(iconKey, svgText)
      return svgText
    } catch {
      // Silent fail - will use fallback
      svgCache.set(iconKey, null)
      return null
    }
  })()

  loadingPromises.set(iconKey, promise)
  return promise
}

/**
 * Create a Graphics object with the icon SVG
 * Returns null if SVG not loaded yet (triggers async load)
 */
export function createIconGraphics(
  iconKey: string,
  size: number
): Graphics | null {
  // Already know this one can't be parsed
  if (parseFailures.has(iconKey)) {
    return null
  }

  const svgContent = svgCache.get(iconKey)

  // Not in cache - start loading
  if (svgContent === undefined) {
    fetchSvgContent(iconKey)
    return null
  }

  // Failed to load
  if (svgContent === null) {
    return null
  }

  // Create Graphics from SVG
  const graphics = new Graphics()

  try {
    graphics.svg(svgContent)
  } catch {
    // Mark as unparseable so we don't retry every frame
    parseFailures.add(iconKey)
    return null
  }

  // Scale to fit size (devicon SVGs are 128x128)
  const svgSize = 128
  const scale = size / svgSize
  graphics.scale.set(scale)

  // Center the icon (pivot at center of original SVG)
  graphics.pivot.set(svgSize / 2, svgSize / 2)

  return graphics
}

/**
 * Check if icon SVG is loaded and ready to render
 */
export function isIconReady(iconKey: string): boolean {
  if (parseFailures.has(iconKey)) return false
  const cached = svgCache.get(iconKey)
  return cached !== undefined && cached !== null
}

/**
 * Check if icon is currently loading
 */
export function isIconLoading(iconKey: string): boolean {
  return loadingPromises.has(iconKey) && !svgCache.has(iconKey)
}

/**
 * Preload icons for faster rendering
 */
export async function preloadIcons(iconKeys: string[]): Promise<void> {
  await Promise.all(iconKeys.map(fetchSvgContent))
}

/**
 * Draw a simple fallback icon shape (for known icon keys)
 * Falls back to procedural icons for unknown keys to avoid grey boxes
 * @param packageName - The actual package name (used for procedural generation when iconKey has no fallback)
 */
export function drawFallbackIcon(
  g: Graphics,
  iconKey: string,
  size: number,
  color: number,
  archetype?: string,
  packageName?: string
): void {
  const s = size * 0.35

  // Different shapes based on package type for visual variety
  if (iconKey === 'react') {
    drawAtom(g, s, color)
  } else if (iconKey === 'vuejs') {
    drawVShape(g, s, color)
  } else if (iconKey === 'angular') {
    drawShield(g, s, color)
  } else if (iconKey === 'typescript') {
    drawSquare(g, s, color)
  } else if (iconKey === 'nodejs') {
    drawHexagon(g, s, color)
  } else if (
    iconKey === 'webpack' ||
    iconKey === 'rollup' ||
    iconKey === 'vitejs'
  ) {
    drawCube(g, s, color)
  } else {
    // Use procedural icon system for unknown icon keys
    // Use actual package name (not iconKey) for unique icons per package
    drawProceduralIcon(g, packageName || iconKey, size, archetype)
  }
}

// ============================================
// ARCHETYPE-BASED SHAPE POOLS (Layer 3)
// ============================================
// Each archetype has a pool of semantically appropriate shapes.
// Hash picks which shape within the pool + unique color.
// Inner details vary based on secondary hash bits for more distinction.

type ShapeDrawFn = (g: Graphics, s: number, color: number, variant: number) => void

// Utility shapes: rounded, friendly, simple (12 shapes)
const UTILITY_SHAPES: ShapeDrawFn[] = [
  drawCircleDot,
  drawRing,
  drawPill,
  drawDoubleRing,
  drawCircleWithDot,
  drawCapsule,
  drawEllipse,
  drawCircleSlash,
  drawTargetRing,
  drawSplitCircle,
  drawConcentricDots,
  drawOrbit,
]

// Framework shapes: polygonal, substantial, architectural (12 shapes)
const FRAMEWORK_SHAPES: ShapeDrawFn[] = [
  drawPentagon,
  drawHexagonFilled,
  drawOctagon,
  drawHeptagon,
  drawShieldFilled,
  drawHexagonHollow,
  drawPentagonHollow,
  drawNestedHex,
  drawHexWithDot,
  drawChevron,
  drawBadge,
  drawCrest,
]

// Tooling shapes: angular, precise, mechanical (12 shapes)
const TOOLING_SHAPES: ShapeDrawFn[] = [
  drawDiamond,
  drawSquareFilled,
  drawCross,
  drawGear,
  drawArrowUp,
  drawBowtie,
  drawWrench,
  drawBolt,
  drawCog,
  drawSquareStack,
  drawDiamondHollow,
  drawPlusSquare,
]

// Legacy shapes: warning-like, dated, distinct (8 shapes)
const LEGACY_SHAPES: ShapeDrawFn[] = [
  drawTriangle,
  drawTriangleDown,
  drawHourglass,
  drawOctagonStop,
  drawWarningTriangle,
  drawBrokenCircle,
  drawDeprecated,
  drawCrackedSquare,
]

// Runtime shapes: Node-like, system-level (8 shapes)
const RUNTIME_SHAPES: ShapeDrawFn[] = [
  drawRoundedSquare,
  drawCube,
  drawStack,
  drawModule,
  drawContainer,
  drawProcess,
  drawChip,
  drawTerminal,
]

// Map archetype to shape pool
const ARCHETYPE_SHAPES: Record<string, ShapeDrawFn[]> = {
  utility: UTILITY_SHAPES,
  framework: FRAMEWORK_SHAPES,
  tooling: TOOLING_SHAPES,
  legacy: LEGACY_SHAPES,
  runtime: RUNTIME_SHAPES,
}

// Fallback pool for unknown archetypes (all shapes)
const ALL_SHAPES: ShapeDrawFn[] = [
  ...UTILITY_SHAPES,
  ...FRAMEWORK_SHAPES,
  ...TOOLING_SHAPES,
  ...LEGACY_SHAPES,
  ...RUNTIME_SHAPES,
]

/**
 * Create a procedurally generated icon based on package name and archetype.
 * Same name + archetype = same visual appearance (deterministic).
 *
 * Priority:
 * 1. Famous packages get hand-crafted semantic shapes
 * 2. Archetype determines shape category, hash picks specific shape + color
 * 3. Variant bits add inner detail variations for more visual distinction
 */
export function drawProceduralIcon(
  g: Graphics,
  packageName: string,
  size: number,
  archetype?: string
): void {
  if (!packageName) return

  const hash = hashString(packageName)
  const hue = hash % 360
  const color = hslToHex(hue, 70, 55)
  const s = size * 0.35

  // Try semantic shape first (famous/notable packages)
  if (drawSemanticIcon(g, packageName, s, color)) {
    return
  }

  // Get shape pool based on archetype (Layer 3: semantic assignment)
  const shapePool =
    archetype && ARCHETYPE_SHAPES[archetype]
      ? ARCHETYPE_SHAPES[archetype]
      : ALL_SHAPES

  // Pick shape from pool based on hash (Layer 2: more shapes)
  const shapeIndex = Math.floor(hash / 360) % shapePool.length
  const drawShape = shapePool[shapeIndex]!

  // Variant bits for inner detail variations (0-7)
  const variant = Math.floor(hash / 1000) % 8

  drawShape(g, s, color, variant)
}

// Additional shape helpers for procedural icons
// Use Pixi's poly() for cleaner path handling
// All shapes accept variant param for inner detail variations

function drawDiamond(g: Graphics, s: number, color: number, variant: number = 0): void {
  g.poly([0, -s, s, 0, 0, s, -s, 0], true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  // Variant: add inner detail
  if (variant % 2 === 1) {
    g.circle(0, 0, s * 0.25)
    g.fill({ color: 0x1a1a2e, alpha: 0.8 })
  }
}

function drawTriangle(g: Graphics, s: number, color: number, variant: number = 0): void {
  g.poly([0, -s, s * 0.87, s * 0.5, -s * 0.87, s * 0.5], true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  // Variant: inner triangle or dot
  if (variant % 3 === 1) {
    g.poly([0, -s * 0.4, s * 0.35, s * 0.2, -s * 0.35, s * 0.2], true)
    g.fill({ color: 0x1a1a2e, alpha: 0.6 })
  } else if (variant % 3 === 2) {
    g.circle(0, s * 0.1, s * 0.2)
    g.fill({ color: 0x1a1a2e, alpha: 0.6 })
  }
}

function drawPentagon(g: Graphics, s: number, color: number, variant: number = 0): void {
  const points: number[] = []
  for (let i = 0; i < 5; i++) {
    const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2
    points.push(Math.cos(angle) * s, Math.sin(angle) * s)
  }
  g.poly(points, true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  // Variant: inner pentagon or dot
  if (variant % 2 === 1) {
    const innerPoints: number[] = []
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2
      innerPoints.push(Math.cos(angle) * s * 0.4, Math.sin(angle) * s * 0.4)
    }
    g.poly(innerPoints, true)
    g.fill({ color: 0x1a1a2e, alpha: 0.6 })
  }
}

// Star shape - reserved for future use (e.g., special package indicators)
// function drawStar(g: Graphics, s: number, color: number): void {
//   const innerR = s * 0.4;
//   const points: number[] = [];
//   for (let i = 0; i < 5; i++) {
//     const outerAngle = (i * 2 * Math.PI / 5) - Math.PI / 2;
//     const innerAngle = outerAngle + Math.PI / 5;
//     points.push(Math.cos(outerAngle) * s, Math.sin(outerAngle) * s);
//     points.push(Math.cos(innerAngle) * innerR, Math.sin(innerAngle) * innerR);
//   }
//   g.poly(points, true);
//   g.fill({ color, alpha: 0.8 });
//   g.stroke({ color, width: 1.5 });
// }

function drawCross(g: Graphics, s: number, color: number, variant: number = 0): void {
  const w = s * 0.35
  g.poly(
    [
      -w,
      -s,
      w,
      -s,
      w,
      -w,
      s,
      -w,
      s,
      w,
      w,
      w,
      w,
      s,
      -w,
      s,
      -w,
      w,
      -s,
      w,
      -s,
      -w,
      -w,
      -w,
    ],
    true
  )
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  // Variant: center hole
  if (variant % 2 === 1) {
    g.circle(0, 0, s * 0.2)
    g.fill({ color: 0x1a1a2e, alpha: 0.8 })
  }
}

function drawCircleDot(g: Graphics, s: number, color: number, variant: number = 0): void {
  g.circle(0, 0, s)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  // Variant: add inner ring or dots
  if (variant % 3 === 1) {
    g.circle(0, 0, s * 0.4)
    g.stroke({ color: 0x1a1a2e, width: 2 })
  } else if (variant % 3 === 2) {
    g.circle(0, 0, s * 0.3)
    g.fill({ color: 0x1a1a2e, alpha: 0.6 })
  }
}

// ============================================
// SHAPE IMPLEMENTATIONS (Layer 2)
// ============================================
// All shapes accept variant param for inner detail variations

// Utility shapes
function drawRing(g: Graphics, s: number, color: number, variant: number = 0): void {
  g.circle(0, 0, s)
  g.stroke({ color, width: 3 })
  if (variant % 2 === 0) {
    g.circle(0, 0, s * 0.5)
    g.stroke({ color, width: 2 })
  } else {
    g.circle(0, 0, s * 0.3)
    g.fill({ color, alpha: 0.6 })
  }
}

function drawPill(g: Graphics, s: number, color: number, variant: number = 0): void {
  g.roundRect(-s * 1.2, -s * 0.5, s * 2.4, s, s * 0.5)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  if (variant % 2 === 1) {
    g.moveTo(0, -s * 0.3)
    g.lineTo(0, s * 0.3)
    g.stroke({ color: 0x1a1a2e, width: 2 })
  }
}

function drawDoubleRing(g: Graphics, s: number, color: number, _variant: number = 0): void {
  g.circle(0, 0, s)
  g.stroke({ color, width: 2 })
  g.circle(0, 0, s * 0.6)
  g.stroke({ color, width: 2 })
}

function drawCircleWithDot(g: Graphics, s: number, color: number, _variant: number = 0): void {
  g.circle(0, 0, s)
  g.stroke({ color, width: 2 })
  g.circle(0, 0, s * 0.3)
  g.fill({ color, alpha: 0.9 })
}

function drawCapsule(g: Graphics, s: number, color: number, variant: number = 0): void {
  // Vertical pill
  g.roundRect(-s * 0.5, -s * 1.2, s, s * 2.4, s * 0.5)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  if (variant % 2 === 1) {
    g.moveTo(-s * 0.3, 0)
    g.lineTo(s * 0.3, 0)
    g.stroke({ color: 0x1a1a2e, width: 2 })
  }
}

function drawEllipse(g: Graphics, s: number, color: number, variant: number = 0): void {
  g.ellipse(0, 0, s, s * 0.6)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  if (variant % 2 === 1) {
    g.ellipse(0, 0, s * 0.4, s * 0.24)
    g.fill({ color: 0x1a1a2e, alpha: 0.6 })
  }
}

function drawCircleSlash(g: Graphics, s: number, color: number, variant: number = 0): void {
  g.circle(0, 0, s)
  g.stroke({ color, width: 2 })
  const angle = variant % 2 === 0 ? Math.PI / 4 : -Math.PI / 4
  g.moveTo(Math.cos(angle) * s * 0.7, Math.sin(angle) * s * 0.7)
  g.lineTo(-Math.cos(angle) * s * 0.7, -Math.sin(angle) * s * 0.7)
  g.stroke({ color, width: 2 })
}

function drawTargetRing(g: Graphics, s: number, color: number, _variant: number = 0): void {
  g.circle(0, 0, s)
  g.stroke({ color, width: 2 })
  g.circle(0, 0, s * 0.65)
  g.stroke({ color, width: 1.5 })
  g.circle(0, 0, s * 0.3)
  g.fill({ color, alpha: 0.9 })
}

function drawSplitCircle(g: Graphics, s: number, color: number, variant: number = 0): void {
  g.circle(0, 0, s)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  // Split line
  if (variant % 2 === 0) {
    g.moveTo(0, -s)
    g.lineTo(0, s)
  } else {
    g.moveTo(-s, 0)
    g.lineTo(s, 0)
  }
  g.stroke({ color: 0x1a1a2e, width: 2 })
}

function drawConcentricDots(g: Graphics, s: number, color: number, variant: number = 0): void {
  // Outer ring
  g.circle(0, 0, s)
  g.stroke({ color, width: 2 })
  // Three dots in triangle pattern
  const dotR = s * 0.2
  const offset = variant % 2 === 0 ? 0 : Math.PI / 6
  for (let i = 0; i < 3; i++) {
    const angle = (i * 2 * Math.PI) / 3 - Math.PI / 2 + offset
    g.circle(Math.cos(angle) * s * 0.5, Math.sin(angle) * s * 0.5, dotR)
    g.fill({ color, alpha: 0.9 })
  }
}

function drawOrbit(g: Graphics, s: number, color: number, _variant: number = 0): void {
  // Orbit ring
  g.circle(0, 0, s * 0.8)
  g.stroke({ color, width: 2 })
  // Center dot
  g.circle(0, 0, s * 0.25)
  g.fill({ color, alpha: 0.9 })
  // Orbiting dot
  g.circle(s * 0.8, 0, s * 0.15)
  g.fill({ color, alpha: 0.9 })
}

// Framework shapes
function drawHexagonFilled(g: Graphics, s: number, color: number, variant: number = 0): void {
  const points: number[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 2
    points.push(Math.cos(angle) * s, Math.sin(angle) * s)
  }
  g.poly(points, true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  // Variants: inner shapes for distinction
  if (variant % 4 === 1) {
    // Inner hexagon
    const innerPoints: number[] = []
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 2
      innerPoints.push(Math.cos(angle) * s * 0.45, Math.sin(angle) * s * 0.45)
    }
    g.poly(innerPoints, true)
    g.fill({ color: 0x1a1a2e, alpha: 0.6 })
  } else if (variant % 4 === 2) {
    // Center dot
    g.circle(0, 0, s * 0.25)
    g.fill({ color: 0x1a1a2e, alpha: 0.7 })
  } else if (variant % 4 === 3) {
    // Cross lines
    g.moveTo(0, -s * 0.6)
    g.lineTo(0, s * 0.6)
    g.moveTo(-s * 0.5, 0)
    g.lineTo(s * 0.5, 0)
    g.stroke({ color: 0x1a1a2e, width: 2 })
  }
}

function drawOctagon(g: Graphics, s: number, color: number, variant: number = 0): void {
  const points: number[] = []
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 8
    points.push(Math.cos(angle) * s, Math.sin(angle) * s)
  }
  g.poly(points, true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  if (variant % 2 === 1) {
    g.circle(0, 0, s * 0.35)
    g.fill({ color: 0x1a1a2e, alpha: 0.6 })
  }
}

function drawHeptagon(g: Graphics, s: number, color: number, variant: number = 0): void {
  const points: number[] = []
  for (let i = 0; i < 7; i++) {
    const angle = (i * 2 * Math.PI) / 7 - Math.PI / 2
    points.push(Math.cos(angle) * s, Math.sin(angle) * s)
  }
  g.poly(points, true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  if (variant % 2 === 1) {
    g.circle(0, 0, s * 0.3)
    g.fill({ color: 0x1a1a2e, alpha: 0.6 })
  }
}

function drawShieldFilled(g: Graphics, s: number, color: number, variant: number = 0): void {
  g.moveTo(0, -s)
  g.lineTo(s, -s * 0.4)
  g.lineTo(s * 0.8, s * 0.5)
  g.lineTo(0, s)
  g.lineTo(-s * 0.8, s * 0.5)
  g.lineTo(-s, -s * 0.4)
  g.closePath()
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  if (variant % 2 === 1) {
    // Inner line
    g.moveTo(0, -s * 0.5)
    g.lineTo(0, s * 0.5)
    g.stroke({ color: 0x1a1a2e, width: 2 })
  }
}

function drawHexagonHollow(g: Graphics, s: number, color: number, _variant: number = 0): void {
  const points: number[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 2
    points.push(Math.cos(angle) * s, Math.sin(angle) * s)
  }
  g.poly(points, true)
  g.stroke({ color, width: 3 })
}

function drawPentagonHollow(g: Graphics, s: number, color: number, _variant: number = 0): void {
  const points: number[] = []
  for (let i = 0; i < 5; i++) {
    const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2
    points.push(Math.cos(angle) * s, Math.sin(angle) * s)
  }
  g.poly(points, true)
  g.stroke({ color, width: 3 })
}

function drawNestedHex(g: Graphics, s: number, color: number, _variant: number = 0): void {
  // Outer hex
  for (const scale of [1, 0.6]) {
    const points: number[] = []
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 2
      points.push(Math.cos(angle) * s * scale, Math.sin(angle) * s * scale)
    }
    g.poly(points, true)
    g.stroke({ color, width: 2 })
  }
}

function drawHexWithDot(g: Graphics, s: number, color: number, _variant: number = 0): void {
  const points: number[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 2
    points.push(Math.cos(angle) * s, Math.sin(angle) * s)
  }
  g.poly(points, true)
  g.stroke({ color, width: 2 })
  g.circle(0, 0, s * 0.35)
  g.fill({ color, alpha: 0.9 })
}

function drawChevron(g: Graphics, s: number, color: number, _variant: number = 0): void {
  g.poly([
    -s, s * 0.3,
    0, -s,
    s, s * 0.3,
    s * 0.6, s * 0.3,
    0, -s * 0.4,
    -s * 0.6, s * 0.3
  ], true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
}

function drawBadge(g: Graphics, s: number, color: number, variant: number = 0): void {
  // Rounded badge shape
  g.roundRect(-s * 0.9, -s * 0.7, s * 1.8, s * 1.4, s * 0.3)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  if (variant % 2 === 1) {
    g.circle(0, 0, s * 0.3)
    g.fill({ color: 0x1a1a2e, alpha: 0.6 })
  }
}

function drawCrest(g: Graphics, s: number, color: number, _variant: number = 0): void {
  // Shield with pointed bottom
  g.moveTo(0, -s)
  g.lineTo(s * 0.9, -s * 0.6)
  g.lineTo(s * 0.9, s * 0.2)
  g.lineTo(0, s)
  g.lineTo(-s * 0.9, s * 0.2)
  g.lineTo(-s * 0.9, -s * 0.6)
  g.closePath()
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
}

// Tooling shapes
function drawSquareFilled(g: Graphics, s: number, color: number, variant: number = 0): void {
  g.rect(-s * 0.85, -s * 0.85, s * 1.7, s * 1.7)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  if (variant % 3 === 1) {
    g.rect(-s * 0.4, -s * 0.4, s * 0.8, s * 0.8)
    g.fill({ color: 0x1a1a2e, alpha: 0.6 })
  } else if (variant % 3 === 2) {
    g.moveTo(-s * 0.5, -s * 0.5)
    g.lineTo(s * 0.5, s * 0.5)
    g.moveTo(s * 0.5, -s * 0.5)
    g.lineTo(-s * 0.5, s * 0.5)
    g.stroke({ color: 0x1a1a2e, width: 2 })
  }
}

function drawGear(g: Graphics, s: number, color: number, _variant: number = 0): void {
  // Outer gear teeth
  const teeth = 8
  const outerR = s
  const innerR = s * 0.7
  const points: number[] = []
  for (let i = 0; i < teeth; i++) {
    const angle1 = (i * 2 * Math.PI) / teeth
    const angle2 = angle1 + (Math.PI / teeth) * 0.4
    const angle3 = angle1 + (Math.PI / teeth) * 0.6
    const angle4 = angle1 + Math.PI / teeth
    points.push(Math.cos(angle1) * outerR, Math.sin(angle1) * outerR)
    points.push(Math.cos(angle2) * outerR, Math.sin(angle2) * outerR)
    points.push(Math.cos(angle3) * innerR, Math.sin(angle3) * innerR)
    points.push(Math.cos(angle4) * innerR, Math.sin(angle4) * innerR)
  }
  g.poly(points, true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 1.5 })
  // Center hole
  g.circle(0, 0, s * 0.25)
  g.fill({ color: 0x1a1a2e, alpha: 1 })
}

function drawArrowUp(g: Graphics, s: number, color: number, _variant: number = 0): void {
  const w = s * 0.4
  g.poly(
    [
      0,
      -s, // top point
      s * 0.7,
      0, // right wing
      w,
      0, // right inner
      w,
      s, // right bottom
      -w,
      s, // left bottom
      -w,
      0, // left inner
      -s * 0.7,
      0, // left wing
    ],
    true
  )
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
}

function drawBowtie(g: Graphics, s: number, color: number, _variant: number = 0): void {
  g.poly([-s, -s * 0.7, 0, 0, -s, s * 0.7, s, s * 0.7, 0, 0, s, -s * 0.7], true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
}

function drawWrench(g: Graphics, s: number, color: number, _variant: number = 0): void {
  // Wrench head
  g.arc(0, -s * 0.4, s * 0.5, Math.PI, 0, false)
  g.lineTo(s * 0.2, s * 0.8)
  g.lineTo(-s * 0.2, s * 0.8)
  g.closePath()
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  // Notch
  g.rect(-s * 0.15, -s * 0.7, s * 0.3, s * 0.35)
  g.fill({ color: 0x1a1a2e, alpha: 0.8 })
}

function drawBolt(g: Graphics, s: number, color: number, _variant: number = 0): void {
  // Lightning bolt
  g.poly([
    s * 0.2, -s,
    -s * 0.3, -s * 0.1,
    s * 0.1, -s * 0.1,
    -s * 0.2, s,
    s * 0.3, s * 0.1,
    -s * 0.1, s * 0.1
  ], true)
  g.fill({ color, alpha: 0.9 })
  g.stroke({ color, width: 2 })
}

function drawCog(g: Graphics, s: number, color: number, _variant: number = 0): void {
  // Simpler cog with fewer teeth
  const teeth = 6
  const outerR = s
  const innerR = s * 0.65
  const points: number[] = []
  for (let i = 0; i < teeth; i++) {
    const angle1 = (i * 2 * Math.PI) / teeth
    const angle2 = angle1 + (Math.PI / teeth) * 0.5
    const angle3 = angle1 + Math.PI / teeth
    points.push(Math.cos(angle1) * outerR, Math.sin(angle1) * outerR)
    points.push(Math.cos(angle2) * innerR, Math.sin(angle2) * innerR)
    points.push(Math.cos(angle3) * outerR, Math.sin(angle3) * outerR)
  }
  g.poly(points, true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 1.5 })
}

function drawSquareStack(g: Graphics, s: number, color: number, _variant: number = 0): void {
  // Two overlapping squares
  g.rect(-s * 0.7, -s * 0.7, s * 1.1, s * 1.1)
  g.fill({ color, alpha: 0.6 })
  g.stroke({ color, width: 2 })
  g.rect(-s * 0.4, -s * 0.4, s * 1.1, s * 1.1)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
}

function drawDiamondHollow(g: Graphics, s: number, color: number, _variant: number = 0): void {
  g.poly([0, -s, s, 0, 0, s, -s, 0], true)
  g.stroke({ color, width: 3 })
}

function drawPlusSquare(g: Graphics, s: number, color: number, _variant: number = 0): void {
  g.rect(-s * 0.85, -s * 0.85, s * 1.7, s * 1.7)
  g.stroke({ color, width: 2 })
  // Plus inside
  g.moveTo(0, -s * 0.5)
  g.lineTo(0, s * 0.5)
  g.moveTo(-s * 0.5, 0)
  g.lineTo(s * 0.5, 0)
  g.stroke({ color, width: 2.5 })
}

// Legacy shapes
function drawTriangleDown(g: Graphics, s: number, color: number, _variant: number = 0): void {
  g.poly([0, s, s * 0.87, -s * 0.5, -s * 0.87, -s * 0.5], true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
}

function drawHourglass(g: Graphics, s: number, color: number, _variant: number = 0): void {
  g.poly([-s * 0.7, -s, s * 0.7, -s, 0, 0, s * 0.7, s, -s * 0.7, s, 0, 0], true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
}

function drawOctagonStop(g: Graphics, s: number, color: number, _variant: number = 0): void {
  // Stop sign style octagon (flatter top/bottom)
  const points: number[] = []
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4
    points.push(Math.cos(angle) * s, Math.sin(angle) * s)
  }
  g.poly(points, true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
}

function drawWarningTriangle(g: Graphics, s: number, color: number, _variant: number = 0): void {
  g.poly([0, -s, s * 0.87, s * 0.5, -s * 0.87, s * 0.5], true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  // Exclamation
  g.rect(-s * 0.08, -s * 0.4, s * 0.16, s * 0.5)
  g.fill({ color: 0x1a1a2e, alpha: 0.9 })
  g.circle(0, s * 0.25, s * 0.1)
  g.fill({ color: 0x1a1a2e, alpha: 0.9 })
}

function drawBrokenCircle(g: Graphics, s: number, color: number, _variant: number = 0): void {
  // Circle with gap
  g.arc(0, 0, s, Math.PI * 0.2, Math.PI * 1.8, false)
  g.stroke({ color, width: 3 })
}

function drawDeprecated(g: Graphics, s: number, color: number, _variant: number = 0): void {
  // Circle with X through it
  g.circle(0, 0, s)
  g.stroke({ color, width: 2 })
  g.moveTo(-s * 0.6, -s * 0.6)
  g.lineTo(s * 0.6, s * 0.6)
  g.moveTo(s * 0.6, -s * 0.6)
  g.lineTo(-s * 0.6, s * 0.6)
  g.stroke({ color, width: 2 })
}

function drawCrackedSquare(g: Graphics, s: number, color: number, _variant: number = 0): void {
  g.rect(-s * 0.85, -s * 0.85, s * 1.7, s * 1.7)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  // Crack
  g.moveTo(-s * 0.4, -s * 0.85)
  g.lineTo(0, 0)
  g.lineTo(s * 0.3, s * 0.85)
  g.stroke({ color: 0x1a1a2e, width: 1.5 })
}

// Runtime shapes
function drawRoundedSquare(g: Graphics, s: number, color: number, variant: number = 0): void {
  g.roundRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6, s * 0.3)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  if (variant % 2 === 1) {
    g.circle(0, 0, s * 0.3)
    g.fill({ color: 0x1a1a2e, alpha: 0.6 })
  }
}

function drawStack(g: Graphics, s: number, color: number, _variant: number = 0): void {
  // Three stacked rectangles
  for (let i = 0; i < 3; i++) {
    const y = -s * 0.6 + i * s * 0.5
    g.roundRect(-s * 0.7, y, s * 1.4, s * 0.4, s * 0.1)
    g.fill({ color, alpha: 0.6 + i * 0.15 })
    g.stroke({ color, width: 1.5 })
  }
}

function drawModule(g: Graphics, s: number, color: number, _variant: number = 0): void {
  // Rectangle with notch
  g.roundRect(-s * 0.8, -s * 0.6, s * 1.6, s * 1.2, s * 0.15)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  // Connection notch
  g.rect(-s * 0.25, -s * 0.85, s * 0.5, s * 0.3)
  g.fill({ color, alpha: 0.9 })
  g.stroke({ color, width: 2 })
}

function drawContainer(g: Graphics, s: number, color: number, _variant: number = 0): void {
  // Box with lid
  g.rect(-s * 0.8, -s * 0.3, s * 1.6, s * 1.1)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  g.rect(-s * 0.9, -s * 0.55, s * 1.8, s * 0.3)
  g.fill({ color, alpha: 0.9 })
  g.stroke({ color, width: 2 })
}

function drawProcess(g: Graphics, s: number, color: number, _variant: number = 0): void {
  // Rounded rectangle with play arrow
  g.roundRect(-s * 0.85, -s * 0.6, s * 1.7, s * 1.2, s * 0.2)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  // Play arrow
  g.poly([
    -s * 0.2, -s * 0.3,
    s * 0.4, 0,
    -s * 0.2, s * 0.3
  ], true)
  g.fill({ color: 0x1a1a2e, alpha: 0.7 })
}

function drawChip(g: Graphics, s: number, color: number, _variant: number = 0): void {
  // CPU chip
  g.rect(-s * 0.6, -s * 0.6, s * 1.2, s * 1.2)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  // Pins
  for (let i = -1; i <= 1; i++) {
    g.rect(i * s * 0.35 - s * 0.08, -s * 0.9, s * 0.16, s * 0.35)
    g.rect(i * s * 0.35 - s * 0.08, s * 0.55, s * 0.16, s * 0.35)
    g.fill({ color, alpha: 0.9 })
  }
}

function drawTerminal(g: Graphics, s: number, color: number, _variant: number = 0): void {
  // Terminal window
  g.roundRect(-s * 0.9, -s * 0.7, s * 1.8, s * 1.4, s * 0.15)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  // Prompt >
  g.moveTo(-s * 0.5, 0)
  g.lineTo(-s * 0.2, s * 0.2)
  g.lineTo(-s * 0.5, s * 0.4)
  g.stroke({ color: 0x1a1a2e, width: 2 })
  // Cursor
  g.rect(s * 0.1, s * 0.1, s * 0.4, s * 0.25)
  g.fill({ color: 0x1a1a2e, alpha: 0.6 })
}

// ============================================
// Fallback shape helpers (for known icon keys)
// ============================================
function drawAtom(g: Graphics, s: number, color: number): void {
  g.ellipse(0, 0, s * 0.9, s * 0.35)
  g.stroke({ color, width: 1.5 })
  g.ellipse(0, 0, s * 0.35, s * 0.9)
  g.stroke({ color, width: 1.5 })
  g.circle(0, 0, s * 0.18)
  g.fill({ color })
}

function drawVShape(g: Graphics, s: number, color: number): void {
  g.moveTo(-s, -s * 0.8)
  g.lineTo(0, s * 0.8)
  g.lineTo(s, -s * 0.8)
  g.lineTo(s * 0.6, -s * 0.8)
  g.lineTo(0, s * 0.3)
  g.lineTo(-s * 0.6, -s * 0.8)
  g.closePath()
  g.fill({ color })
}

function drawShield(g: Graphics, s: number, color: number): void {
  g.moveTo(0, -s)
  g.lineTo(s, -s * 0.5)
  g.lineTo(s * 0.8, s * 0.6)
  g.lineTo(0, s)
  g.lineTo(-s * 0.8, s * 0.6)
  g.lineTo(-s, -s * 0.5)
  g.closePath()
  g.stroke({ color, width: 2 })
}

function drawSquare(g: Graphics, s: number, color: number): void {
  g.roundRect(-s, -s, s * 2, s * 2, s * 0.15)
  g.stroke({ color, width: 2 })
}

function drawHexagon(g: Graphics, s: number, color: number): void {
  g.moveTo(s, 0)
  for (let i = 1; i <= 6; i++) {
    const angle = (i * Math.PI) / 3
    g.lineTo(Math.cos(angle) * s, Math.sin(angle) * s)
  }
  g.stroke({ color, width: 2 })
}

function drawCube(g: Graphics, s: number, color: number): void {
  g.moveTo(0, -s)
  g.lineTo(s * 0.87, -s * 0.5)
  g.lineTo(s * 0.87, s * 0.5)
  g.lineTo(0, s)
  g.lineTo(-s * 0.87, s * 0.5)
  g.lineTo(-s * 0.87, -s * 0.5)
  g.closePath()
  g.stroke({ color, width: 1.5 })
}

function drawBox(g: Graphics, s: number, color: number): void {
  g.roundRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6, 3)
  g.stroke({ color, width: 2 })
}

// Legacy exports for compatibility during transition
export function drawIcon(
  _g: Graphics,
  _iconKey: string,
  _size: number,
  _color: number
): boolean {
  return false
}

export function hasIcon(iconKey: string): boolean {
  return isIconReady(iconKey)
}

// ============================================
// SEMANTIC ICONS - Famous npm packages
// ============================================
// Hand-crafted shapes for notable packages that deserve
// more than procedural generation. These are the dev culture icons.

/**
 * Draw a semantic icon for a famous package. Returns true if handled.
 */
function drawSemanticIcon(
  g: Graphics,
  name: string,
  s: number,
  color: number
): boolean {
  switch (name) {
    // === THE MEME PACKAGES ===
    case 'left-pad':
      drawLeftPad(g, s, color)
      return true
    case 'is-odd':
      drawIsOdd(g, s, color)
      return true
    case 'is-even':
      drawIsEven(g, s, color)
      return true
    case 'is-number':
      drawIsNumber(g, s, color)
      return true

    // === UTILITIES ===
    case 'chalk':
      drawChalk(g, s, color)
      return true
    case 'debug':
      drawDebug(g, s, color)
      return true
    case 'semver':
      drawSemver(g, s, color)
      return true
    case 'uuid':
      drawUuid(g, s, color)
      return true
    case 'ms':
      drawMs(g, s, color)
      return true
    case 'prettier':
      drawPrettier(g, s, color)
      return true
    case 'esbuild':
      drawEsbuild(g, s, color)
      return true
    case 'escape-html':
      drawEscapeHtml(g, s, color)
      return true
    case 'safe-buffer':
      drawSafeBuffer(g, s, color)
      return true
    case 'inherits':
      drawInherits(g, s, color)
      return true
    case 'color-name':
    case 'supports-color':
      drawColorSupport(g, s)
      return true
    case 'has-flag':
      drawHasFlag(g, s, color)
      return true

    // === LEGACY ===
    case 'moment':
      drawMoment(g, s, color)
      return true
    case 'date-fns':
      drawDateFns(g, s, color)
      return true
    case 'request':
      drawRequest(g, s, color)
      return true
    case 'underscore':
      drawUnderscore(g, s, color)
      return true
    case 'bluebird':
      drawBluebird(g, s)
      return true
    case 'async':
      drawAsync(g, s, color)
      return true

    // === SPECIAL ===
    case 'starter-kit':
      drawStarterKit(g, s, color)
      return true

    default:
      return false
  }
}

// === MEME PACKAGE SHAPES ===

// left-pad: The 11-liner that broke npm - a padded rectangle
function drawLeftPad(g: Graphics, s: number, color: number): void {
  // Main content block (right side)
  g.rect(s * 0.1, -s * 0.6, s * 0.8, s * 1.2)
  g.fill({ color, alpha: 0.8 })
  // Padding lines on the left (the "left pad")
  g.moveTo(-s * 0.7, -s * 0.4)
  g.lineTo(-s * 0.2, -s * 0.4)
  g.moveTo(-s * 0.7, 0)
  g.lineTo(-s * 0.2, 0)
  g.moveTo(-s * 0.7, s * 0.4)
  g.lineTo(-s * 0.2, s * 0.4)
  g.stroke({ color, width: 2 })
}

// is-odd: Uneven split - the odd one out
function drawIsOdd(g: Graphics, s: number, color: number): void {
  // Circle split unevenly
  g.circle(0, 0, s)
  g.stroke({ color, width: 2 })
  // Off-center divider line
  g.moveTo(s * 0.3, -s)
  g.lineTo(s * 0.3, s)
  g.stroke({ color, width: 2 })
  // Dot on the smaller side
  g.circle(s * 0.6, 0, s * 0.2)
  g.fill({ color, alpha: 0.9 })
}

// is-even: Perfect symmetry - balanced
function drawIsEven(g: Graphics, s: number, color: number): void {
  // Two equal halves
  g.circle(0, 0, s)
  g.stroke({ color, width: 2 })
  // Center divider
  g.moveTo(0, -s)
  g.lineTo(0, s)
  g.stroke({ color, width: 2 })
  // Equal dots on each side
  g.circle(-s * 0.5, 0, s * 0.2)
  g.circle(s * 0.5, 0, s * 0.2)
  g.fill({ color, alpha: 0.9 })
}

// is-number: Tally marks / hash symbol
function drawIsNumber(g: Graphics, s: number, color: number): void {
  // # shape (hash/number sign)
  const o = s * 0.3
  // Vertical bars
  g.moveTo(-o, -s * 0.8)
  g.lineTo(-o, s * 0.8)
  g.moveTo(o, -s * 0.8)
  g.lineTo(o, s * 0.8)
  // Horizontal bars
  g.moveTo(-s * 0.8, -o)
  g.lineTo(s * 0.8, -o)
  g.moveTo(-s * 0.8, o)
  g.lineTo(s * 0.8, o)
  g.stroke({ color, width: 2.5 })
}

// === UTILITY SHAPES ===

// chalk: Crayon with color tip
function drawChalk(g: Graphics, s: number, color: number): void {
  // Crayon body (rectangle)
  g.roundRect(-s * 0.3, -s * 0.3, s * 1.2, s * 0.6, s * 0.1)
  g.fill({ color, alpha: 0.7 })
  g.stroke({ color, width: 2 })
  // Pointed tip
  g.poly([s * 0.9, -s * 0.3, s * 1.2, 0, s * 0.9, s * 0.3], true)
  g.fill({ color, alpha: 1 })
}

// debug: Bug silhouette
function drawDebug(g: Graphics, s: number, color: number): void {
  // Bug body (oval)
  g.ellipse(0, s * 0.1, s * 0.5, s * 0.6)
  g.fill({ color, alpha: 0.8 })
  // Bug head
  g.circle(0, -s * 0.6, s * 0.3)
  g.fill({ color, alpha: 0.8 })
  // Antennae
  g.moveTo(-s * 0.2, -s * 0.8)
  g.lineTo(-s * 0.4, -s)
  g.moveTo(s * 0.2, -s * 0.8)
  g.lineTo(s * 0.4, -s)
  // Legs
  g.moveTo(-s * 0.5, -s * 0.1)
  g.lineTo(-s * 0.9, -s * 0.3)
  g.moveTo(s * 0.5, -s * 0.1)
  g.lineTo(s * 0.9, -s * 0.3)
  g.moveTo(-s * 0.5, s * 0.3)
  g.lineTo(-s * 0.9, s * 0.5)
  g.moveTo(s * 0.5, s * 0.3)
  g.lineTo(s * 0.9, s * 0.5)
  g.stroke({ color, width: 1.5 })
}

// semver: Three stacked dots (major.minor.patch)
function drawSemver(g: Graphics, s: number, color: number): void {
  const dotR = s * 0.25
  // Three dots vertically
  g.circle(0, -s * 0.6, dotR)
  g.circle(0, 0, dotR)
  g.circle(0, s * 0.6, dotR)
  g.fill({ color, alpha: 0.9 })
  // Connecting lines
  g.moveTo(0, -s * 0.35)
  g.lineTo(0, -s * 0.25)
  g.moveTo(0, s * 0.25)
  g.lineTo(0, s * 0.35)
  g.stroke({ color, width: 2 })
}

// uuid: Snowflake pattern (each one unique)
function drawUuid(g: Graphics, s: number, color: number): void {
  // Six-pointed star pattern
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3
    g.moveTo(0, 0)
    g.lineTo(Math.cos(angle) * s, Math.sin(angle) * s)
    // Small branches
    const bx = Math.cos(angle) * s * 0.6
    const by = Math.sin(angle) * s * 0.6
    const perpAngle = angle + Math.PI / 2
    g.moveTo(bx, by)
    g.lineTo(
      bx + Math.cos(perpAngle) * s * 0.25,
      by + Math.sin(perpAngle) * s * 0.25
    )
    g.moveTo(bx, by)
    g.lineTo(
      bx - Math.cos(perpAngle) * s * 0.25,
      by - Math.sin(perpAngle) * s * 0.25
    )
  }
  g.stroke({ color, width: 1.5 })
  g.circle(0, 0, s * 0.15)
  g.fill({ color, alpha: 0.9 })
}

// ms: Stopwatch / timer
function drawMs(g: Graphics, s: number, color: number): void {
  // Clock face
  g.circle(0, s * 0.1, s * 0.8)
  g.stroke({ color, width: 2 })
  // Top button
  g.rect(-s * 0.1, -s * 0.9, s * 0.2, s * 0.2)
  g.fill({ color, alpha: 0.8 })
  // Clock hands
  g.moveTo(0, s * 0.1)
  g.lineTo(0, -s * 0.4)
  g.moveTo(0, s * 0.1)
  g.lineTo(s * 0.3, s * 0.3)
  g.stroke({ color, width: 2 })
}

// prettier: Aligned code bars
function drawPrettier(g: Graphics, s: number, color: number): void {
  const barH = s * 0.18
  const gap = s * 0.35
  // Four aligned bars of varying width
  g.roundRect(-s * 0.8, -gap * 1.5, s * 1.4, barH, barH / 2)
  g.roundRect(-s * 0.8, -gap * 0.5, s * 1.0, barH, barH / 2)
  g.roundRect(-s * 0.8, gap * 0.5, s * 1.6, barH, barH / 2)
  g.roundRect(-s * 0.8, gap * 1.5, s * 0.8, barH, barH / 2)
  g.fill({ color, alpha: 0.8 })
}

// esbuild: Lightning bolt (speed)
function drawEsbuild(g: Graphics, s: number, color: number): void {
  g.poly(
    [
      s * 0.1,
      -s,
      -s * 0.5,
      s * 0.1,
      s * 0.1,
      s * 0.1,
      -s * 0.1,
      s,
      s * 0.5,
      -s * 0.1,
      -s * 0.1,
      -s * 0.1,
    ],
    true
  )
  g.fill({ color, alpha: 0.9 })
  g.stroke({ color, width: 1.5 })
}

// escape-html: Angle brackets </>
function drawEscapeHtml(g: Graphics, s: number, color: number): void {
  // Left bracket <
  g.moveTo(-s * 0.2, -s * 0.7)
  g.lineTo(-s * 0.8, 0)
  g.lineTo(-s * 0.2, s * 0.7)
  // Right bracket >
  g.moveTo(s * 0.2, -s * 0.7)
  g.lineTo(s * 0.8, 0)
  g.lineTo(s * 0.2, s * 0.7)
  // Slash /
  g.moveTo(s * 0.15, -s * 0.5)
  g.lineTo(-s * 0.15, s * 0.5)
  g.stroke({ color, width: 2.5 })
}

// safe-buffer: Shield with block inside
function drawSafeBuffer(g: Graphics, s: number, color: number): void {
  // Shield outline
  g.moveTo(0, -s)
  g.lineTo(s * 0.9, -s * 0.5)
  g.lineTo(s * 0.8, s * 0.5)
  g.lineTo(0, s)
  g.lineTo(-s * 0.8, s * 0.5)
  g.lineTo(-s * 0.9, -s * 0.5)
  g.closePath()
  g.stroke({ color, width: 2 })
  // Memory block inside
  g.rect(-s * 0.35, -s * 0.25, s * 0.7, s * 0.5)
  g.fill({ color, alpha: 0.6 })
}

// inherits: Nested squares (inheritance chain)
function drawInherits(g: Graphics, s: number, color: number): void {
  // Outer square (parent)
  g.rect(-s * 0.9, -s * 0.9, s * 1.8, s * 1.8)
  g.stroke({ color, width: 2 })
  // Middle square
  g.rect(-s * 0.55, -s * 0.55, s * 1.1, s * 1.1)
  g.stroke({ color, width: 2 })
  // Inner square (child)
  g.rect(-s * 0.25, -s * 0.25, s * 0.5, s * 0.5)
  g.fill({ color, alpha: 0.8 })
}

// color-name / supports-color: RGB overlapping circles
function drawColorSupport(g: Graphics, s: number): void {
  const r = s * 0.5
  const offset = s * 0.35
  // Three overlapping circles (RGB style)
  g.circle(-offset, -offset * 0.5, r)
  g.fill({ color: 0xff6b6b, alpha: 0.6 })
  g.circle(offset, -offset * 0.5, r)
  g.fill({ color: 0x51cf66, alpha: 0.6 })
  g.circle(0, offset * 0.7, r)
  g.fill({ color: 0x339af0, alpha: 0.6 })
  // Center blend
  g.circle(0, 0, r * 0.3)
  g.fill({ color: 0xffffff, alpha: 0.9 })
}

// has-flag: Flag shape
function drawHasFlag(g: Graphics, s: number, color: number): void {
  // Flagpole
  g.moveTo(-s * 0.7, -s)
  g.lineTo(-s * 0.7, s)
  g.stroke({ color, width: 2 })
  // Flag
  g.poly([-s * 0.7, -s, s * 0.7, -s * 0.5, -s * 0.7, 0], true)
  g.fill({ color, alpha: 0.8 })
}

// === LEGACY SHAPES ===

// moment: Cracked clock (showing age)
function drawMoment(g: Graphics, s: number, color: number): void {
  // Clock face
  g.circle(0, 0, s)
  g.stroke({ color, width: 2 })
  // Clock hands
  g.moveTo(0, 0)
  g.lineTo(0, -s * 0.6)
  g.moveTo(0, 0)
  g.lineTo(s * 0.4, s * 0.2)
  g.stroke({ color, width: 2 })
  // Crack lines (it's old/legacy)
  g.moveTo(s * 0.3, -s * 0.8)
  g.lineTo(s * 0.1, -s * 0.3)
  g.lineTo(s * 0.4, 0)
  g.stroke({ color, width: 1, alpha: 0.6 })
}

// date-fns: Clean calendar grid
function drawDateFns(g: Graphics, s: number, color: number): void {
  // Calendar outline
  g.roundRect(-s * 0.8, -s * 0.6, s * 1.6, s * 1.4, s * 0.1)
  g.stroke({ color, width: 2 })
  // Header bar
  g.rect(-s * 0.8, -s * 0.6, s * 1.6, s * 0.35)
  g.fill({ color, alpha: 0.4 })
  // Grid dots (days)
  const dotR = s * 0.1
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      g.circle(-s * 0.45 + col * s * 0.45, s * 0.1 + row * s * 0.4, dotR)
    }
  }
  g.fill({ color, alpha: 0.8 })
}

// request: Arrows out and back (deprecated - dashed feel)
function drawRequest(g: Graphics, s: number, color: number): void {
  // Outgoing arrow
  g.moveTo(-s * 0.8, -s * 0.3)
  g.lineTo(s * 0.3, -s * 0.3)
  g.lineTo(s * 0.3, -s * 0.6)
  g.lineTo(s * 0.8, 0)
  // Return arrow
  g.moveTo(s * 0.8, 0)
  g.lineTo(s * 0.3, s * 0.6)
  g.lineTo(s * 0.3, s * 0.3)
  g.lineTo(-s * 0.8, s * 0.3)
  g.stroke({ color, width: 2 })
  // X through it (deprecated)
  g.moveTo(-s * 0.4, -s * 0.5)
  g.lineTo(s * 0.4, s * 0.5)
  g.stroke({ color, width: 1.5, alpha: 0.5 })
}

// underscore: Literal underscore character
function drawUnderscore(g: Graphics, s: number, color: number): void {
  // The iconic underscore _
  g.moveTo(-s * 0.8, s * 0.3)
  g.lineTo(s * 0.8, s * 0.3)
  g.stroke({ color, width: 4 })
  // Small decorative dots above
  g.circle(-s * 0.4, -s * 0.2, s * 0.12)
  g.circle(s * 0.4, -s * 0.2, s * 0.12)
  g.fill({ color, alpha: 0.5 })
}

// bluebird: Bird wing silhouette
function drawBluebird(g: Graphics, s: number): void {
  // Use blue tint regardless of hash color
  const blue = 0x4dabf7
  // Bird body
  g.ellipse(0, 0, s * 0.5, s * 0.35)
  g.fill({ color: blue, alpha: 0.8 })
  // Wing
  g.moveTo(-s * 0.2, -s * 0.1)
  g.quadraticCurveTo(-s * 0.8, -s * 0.8, -s * 0.3, -s * 0.5)
  g.quadraticCurveTo(0, -s * 0.3, s * 0.2, -s * 0.1)
  g.fill({ color: blue, alpha: 0.9 })
  // Beak
  g.poly([s * 0.5, 0, s * 0.9, s * 0.1, s * 0.5, s * 0.15], true)
  g.fill({ color: blue, alpha: 1 })
  // Eye
  g.circle(s * 0.3, -s * 0.05, s * 0.08)
  g.fill({ color: 0xffffff, alpha: 0.9 })
}

// async: Parallel flow arrows
function drawAsync(g: Graphics, s: number, color: number): void {
  // Three parallel arrows flowing right
  const y1 = -s * 0.5
  const y2 = 0
  const y3 = s * 0.5
  // Lines
  g.moveTo(-s * 0.8, y1)
  g.lineTo(s * 0.4, y1)
  g.moveTo(-s * 0.8, y2)
  g.lineTo(s * 0.4, y2)
  g.moveTo(-s * 0.8, y3)
  g.lineTo(s * 0.4, y3)
  g.stroke({ color, width: 2 })
  // Arrowheads
  for (const y of [y1, y2, y3]) {
    g.poly([s * 0.4, y - s * 0.15, s * 0.8, y, s * 0.4, y + s * 0.15], true)
    g.fill({ color, alpha: 0.8 })
  }
}

// === SPECIAL ===

// starter-kit: Gift box / present
function drawStarterKit(g: Graphics, s: number, color: number): void {
  // Box body
  g.rect(-s * 0.7, -s * 0.2, s * 1.4, s * 1)
  g.fill({ color, alpha: 0.7 })
  g.stroke({ color, width: 2 })
  // Lid
  g.rect(-s * 0.8, -s * 0.5, s * 1.6, s * 0.35)
  g.fill({ color, alpha: 0.9 })
  g.stroke({ color, width: 2 })
  // Ribbon vertical
  g.rect(-s * 0.1, -s * 0.5, s * 0.2, s * 1.3)
  g.fill({ color: 0xffffff, alpha: 0.4 })
  // Ribbon horizontal
  g.rect(-s * 0.8, s * 0.1, s * 1.6, s * 0.2)
  g.fill({ color: 0xffffff, alpha: 0.4 })
  // Bow
  g.circle(-s * 0.25, -s * 0.7, s * 0.2)
  g.circle(s * 0.25, -s * 0.7, s * 0.2)
  g.fill({ color, alpha: 0.9 })
}
