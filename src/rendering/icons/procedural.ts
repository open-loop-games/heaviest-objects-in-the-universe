// Procedural icon generation for packages without semantic icons
// Uses hash-based deterministic shape selection from archetype pools

import { Graphics } from 'pixi.js'

/**
 * Hash a string to a number (for deterministic procedural generation)
 */
export function hashString(str: string): number {
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
export function hslToHex(h: number, s: number, l: number): number {
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

// Shape draw function type with variant parameter
type ShapeDrawFn = (g: Graphics, s: number, color: number, variant: number) => void

// ============================================
// ARCHETYPE-BASED SHAPE POOLS
// ============================================

// Utility shapes: rounded, friendly, simple
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

// Framework shapes: polygonal, substantial, architectural
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

// Tooling shapes: angular, precise, mechanical
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

// Legacy shapes: warning-like, dated, distinct
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

// Runtime shapes: Node-like, system-level
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

// Fallback pool for unknown archetypes
const ALL_SHAPES: ShapeDrawFn[] = [
  ...UTILITY_SHAPES,
  ...FRAMEWORK_SHAPES,
  ...TOOLING_SHAPES,
  ...LEGACY_SHAPES,
  ...RUNTIME_SHAPES,
]

/**
 * Draw a procedural icon based on package name and archetype.
 * Same name + archetype = same visual appearance (deterministic).
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

  // Get shape pool based on archetype
  const shapePool =
    archetype && ARCHETYPE_SHAPES[archetype]
      ? ARCHETYPE_SHAPES[archetype]
      : ALL_SHAPES

  // Pick shape from pool based on hash
  const shapeIndex = Math.floor(hash / 360) % shapePool.length
  const drawShape = shapePool[shapeIndex]!

  // Variant bits for inner detail variations (0-7)
  const variant = Math.floor(hash / 1000) % 8

  drawShape(g, s, color, variant)
}

// ============================================
// SHAPE IMPLEMENTATIONS
// ============================================

// Utility shapes
function drawCircleDot(g: Graphics, s: number, color: number, variant: number): void {
  g.circle(0, 0, s)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  if (variant % 3 === 1) {
    g.circle(0, 0, s * 0.4)
    g.stroke({ color: 0x1a1a2e, width: 2 })
  } else if (variant % 3 === 2) {
    g.circle(0, 0, s * 0.3)
    g.fill({ color: 0x1a1a2e, alpha: 0.6 })
  }
}

function drawRing(g: Graphics, s: number, color: number, variant: number): void {
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

function drawPill(g: Graphics, s: number, color: number, variant: number): void {
  g.roundRect(-s * 1.2, -s * 0.5, s * 2.4, s, s * 0.5)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  if (variant % 2 === 1) {
    g.moveTo(0, -s * 0.3)
    g.lineTo(0, s * 0.3)
    g.stroke({ color: 0x1a1a2e, width: 2 })
  }
}

function drawDoubleRing(g: Graphics, s: number, color: number, _variant: number): void {
  g.circle(0, 0, s)
  g.stroke({ color, width: 2 })
  g.circle(0, 0, s * 0.6)
  g.stroke({ color, width: 2 })
}

function drawCircleWithDot(g: Graphics, s: number, color: number, _variant: number): void {
  g.circle(0, 0, s)
  g.stroke({ color, width: 2 })
  g.circle(0, 0, s * 0.3)
  g.fill({ color, alpha: 0.9 })
}

function drawCapsule(g: Graphics, s: number, color: number, variant: number): void {
  g.roundRect(-s * 0.5, -s * 1.2, s, s * 2.4, s * 0.5)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  if (variant % 2 === 1) {
    g.moveTo(-s * 0.3, 0)
    g.lineTo(s * 0.3, 0)
    g.stroke({ color: 0x1a1a2e, width: 2 })
  }
}

function drawEllipse(g: Graphics, s: number, color: number, variant: number): void {
  g.ellipse(0, 0, s, s * 0.6)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  if (variant % 2 === 1) {
    g.ellipse(0, 0, s * 0.4, s * 0.24)
    g.fill({ color: 0x1a1a2e, alpha: 0.6 })
  }
}

function drawCircleSlash(g: Graphics, s: number, color: number, variant: number): void {
  g.circle(0, 0, s)
  g.stroke({ color, width: 2 })
  const angle = variant % 2 === 0 ? Math.PI / 4 : -Math.PI / 4
  g.moveTo(Math.cos(angle) * s * 0.7, Math.sin(angle) * s * 0.7)
  g.lineTo(-Math.cos(angle) * s * 0.7, -Math.sin(angle) * s * 0.7)
  g.stroke({ color, width: 2 })
}

function drawTargetRing(g: Graphics, s: number, color: number, _variant: number): void {
  g.circle(0, 0, s)
  g.stroke({ color, width: 2 })
  g.circle(0, 0, s * 0.65)
  g.stroke({ color, width: 1.5 })
  g.circle(0, 0, s * 0.3)
  g.fill({ color, alpha: 0.9 })
}

function drawSplitCircle(g: Graphics, s: number, color: number, variant: number): void {
  g.circle(0, 0, s)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  if (variant % 2 === 0) {
    g.moveTo(0, -s)
    g.lineTo(0, s)
  } else {
    g.moveTo(-s, 0)
    g.lineTo(s, 0)
  }
  g.stroke({ color: 0x1a1a2e, width: 2 })
}

function drawConcentricDots(g: Graphics, s: number, color: number, variant: number): void {
  g.circle(0, 0, s)
  g.stroke({ color, width: 2 })
  const dotR = s * 0.2
  const offset = variant % 2 === 0 ? 0 : Math.PI / 6
  for (let i = 0; i < 3; i++) {
    const angle = (i * 2 * Math.PI) / 3 - Math.PI / 2 + offset
    g.circle(Math.cos(angle) * s * 0.5, Math.sin(angle) * s * 0.5, dotR)
    g.fill({ color, alpha: 0.9 })
  }
}

function drawOrbit(g: Graphics, s: number, color: number, _variant: number): void {
  g.circle(0, 0, s * 0.8)
  g.stroke({ color, width: 2 })
  g.circle(0, 0, s * 0.25)
  g.fill({ color, alpha: 0.9 })
  g.circle(s * 0.8, 0, s * 0.15)
  g.fill({ color, alpha: 0.9 })
}

// Framework shapes
function drawPentagon(g: Graphics, s: number, color: number, variant: number): void {
  const points: number[] = []
  for (let i = 0; i < 5; i++) {
    const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2
    points.push(Math.cos(angle) * s, Math.sin(angle) * s)
  }
  g.poly(points, true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
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

function drawHexagonFilled(g: Graphics, s: number, color: number, variant: number): void {
  const points: number[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 2
    points.push(Math.cos(angle) * s, Math.sin(angle) * s)
  }
  g.poly(points, true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  if (variant % 4 === 1) {
    const innerPoints: number[] = []
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 2
      innerPoints.push(Math.cos(angle) * s * 0.45, Math.sin(angle) * s * 0.45)
    }
    g.poly(innerPoints, true)
    g.fill({ color: 0x1a1a2e, alpha: 0.6 })
  } else if (variant % 4 === 2) {
    g.circle(0, 0, s * 0.25)
    g.fill({ color: 0x1a1a2e, alpha: 0.7 })
  } else if (variant % 4 === 3) {
    g.moveTo(0, -s * 0.6)
    g.lineTo(0, s * 0.6)
    g.moveTo(-s * 0.5, 0)
    g.lineTo(s * 0.5, 0)
    g.stroke({ color: 0x1a1a2e, width: 2 })
  }
}

function drawOctagon(g: Graphics, s: number, color: number, variant: number): void {
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

function drawHeptagon(g: Graphics, s: number, color: number, variant: number): void {
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

function drawShieldFilled(g: Graphics, s: number, color: number, variant: number): void {
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
    g.moveTo(0, -s * 0.5)
    g.lineTo(0, s * 0.5)
    g.stroke({ color: 0x1a1a2e, width: 2 })
  }
}

function drawHexagonHollow(g: Graphics, s: number, color: number, _variant: number): void {
  const points: number[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 2
    points.push(Math.cos(angle) * s, Math.sin(angle) * s)
  }
  g.poly(points, true)
  g.stroke({ color, width: 3 })
}

function drawPentagonHollow(g: Graphics, s: number, color: number, _variant: number): void {
  const points: number[] = []
  for (let i = 0; i < 5; i++) {
    const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2
    points.push(Math.cos(angle) * s, Math.sin(angle) * s)
  }
  g.poly(points, true)
  g.stroke({ color, width: 3 })
}

function drawNestedHex(g: Graphics, s: number, color: number, _variant: number): void {
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

function drawHexWithDot(g: Graphics, s: number, color: number, _variant: number): void {
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

function drawChevron(g: Graphics, s: number, color: number, _variant: number): void {
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

function drawBadge(g: Graphics, s: number, color: number, variant: number): void {
  g.roundRect(-s * 0.9, -s * 0.7, s * 1.8, s * 1.4, s * 0.3)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  if (variant % 2 === 1) {
    g.circle(0, 0, s * 0.3)
    g.fill({ color: 0x1a1a2e, alpha: 0.6 })
  }
}

function drawCrest(g: Graphics, s: number, color: number, _variant: number): void {
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
function drawDiamond(g: Graphics, s: number, color: number, variant: number): void {
  g.poly([0, -s, s, 0, 0, s, -s, 0], true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  if (variant % 2 === 1) {
    g.circle(0, 0, s * 0.25)
    g.fill({ color: 0x1a1a2e, alpha: 0.8 })
  }
}

function drawSquareFilled(g: Graphics, s: number, color: number, variant: number): void {
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

function drawCross(g: Graphics, s: number, color: number, variant: number): void {
  const w = s * 0.35
  g.poly([
    -w, -s, w, -s, w, -w, s, -w, s, w, w, w,
    w, s, -w, s, -w, w, -s, w, -s, -w, -w, -w,
  ], true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  if (variant % 2 === 1) {
    g.circle(0, 0, s * 0.2)
    g.fill({ color: 0x1a1a2e, alpha: 0.8 })
  }
}

function drawGear(g: Graphics, s: number, color: number, _variant: number): void {
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
  g.circle(0, 0, s * 0.25)
  g.fill({ color: 0x1a1a2e, alpha: 1 })
}

function drawArrowUp(g: Graphics, s: number, color: number, _variant: number): void {
  const w = s * 0.4
  g.poly([
    0, -s, s * 0.7, 0, w, 0, w, s, -w, s, -w, 0, -s * 0.7, 0,
  ], true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
}

function drawBowtie(g: Graphics, s: number, color: number, _variant: number): void {
  g.poly([-s, -s * 0.7, 0, 0, -s, s * 0.7, s, s * 0.7, 0, 0, s, -s * 0.7], true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
}

function drawWrench(g: Graphics, s: number, color: number, _variant: number): void {
  g.arc(0, -s * 0.4, s * 0.5, Math.PI, 0, false)
  g.lineTo(s * 0.2, s * 0.8)
  g.lineTo(-s * 0.2, s * 0.8)
  g.closePath()
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  g.rect(-s * 0.15, -s * 0.7, s * 0.3, s * 0.35)
  g.fill({ color: 0x1a1a2e, alpha: 0.8 })
}

function drawBolt(g: Graphics, s: number, color: number, _variant: number): void {
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

function drawCog(g: Graphics, s: number, color: number, _variant: number): void {
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

function drawSquareStack(g: Graphics, s: number, color: number, _variant: number): void {
  g.rect(-s * 0.7, -s * 0.7, s * 1.1, s * 1.1)
  g.fill({ color, alpha: 0.6 })
  g.stroke({ color, width: 2 })
  g.rect(-s * 0.4, -s * 0.4, s * 1.1, s * 1.1)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
}

function drawDiamondHollow(g: Graphics, s: number, color: number, _variant: number): void {
  g.poly([0, -s, s, 0, 0, s, -s, 0], true)
  g.stroke({ color, width: 3 })
}

function drawPlusSquare(g: Graphics, s: number, color: number, _variant: number): void {
  g.rect(-s * 0.85, -s * 0.85, s * 1.7, s * 1.7)
  g.stroke({ color, width: 2 })
  g.moveTo(0, -s * 0.5)
  g.lineTo(0, s * 0.5)
  g.moveTo(-s * 0.5, 0)
  g.lineTo(s * 0.5, 0)
  g.stroke({ color, width: 2.5 })
}

// Legacy shapes
function drawTriangle(g: Graphics, s: number, color: number, variant: number): void {
  g.poly([0, -s, s * 0.87, s * 0.5, -s * 0.87, s * 0.5], true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  if (variant % 3 === 1) {
    g.poly([0, -s * 0.4, s * 0.35, s * 0.2, -s * 0.35, s * 0.2], true)
    g.fill({ color: 0x1a1a2e, alpha: 0.6 })
  } else if (variant % 3 === 2) {
    g.circle(0, s * 0.1, s * 0.2)
    g.fill({ color: 0x1a1a2e, alpha: 0.6 })
  }
}

function drawTriangleDown(g: Graphics, s: number, color: number, _variant: number): void {
  g.poly([0, s, s * 0.87, -s * 0.5, -s * 0.87, -s * 0.5], true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
}

function drawHourglass(g: Graphics, s: number, color: number, _variant: number): void {
  g.poly([-s * 0.7, -s, s * 0.7, -s, 0, 0, s * 0.7, s, -s * 0.7, s, 0, 0], true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
}

function drawOctagonStop(g: Graphics, s: number, color: number, _variant: number): void {
  const points: number[] = []
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4
    points.push(Math.cos(angle) * s, Math.sin(angle) * s)
  }
  g.poly(points, true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
}

function drawWarningTriangle(g: Graphics, s: number, color: number, _variant: number): void {
  g.poly([0, -s, s * 0.87, s * 0.5, -s * 0.87, s * 0.5], true)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  g.rect(-s * 0.08, -s * 0.4, s * 0.16, s * 0.5)
  g.fill({ color: 0x1a1a2e, alpha: 0.9 })
  g.circle(0, s * 0.25, s * 0.1)
  g.fill({ color: 0x1a1a2e, alpha: 0.9 })
}

function drawBrokenCircle(g: Graphics, s: number, color: number, _variant: number): void {
  g.arc(0, 0, s, Math.PI * 0.2, Math.PI * 1.8, false)
  g.stroke({ color, width: 3 })
}

function drawDeprecated(g: Graphics, s: number, color: number, _variant: number): void {
  g.circle(0, 0, s)
  g.stroke({ color, width: 2 })
  g.moveTo(-s * 0.6, -s * 0.6)
  g.lineTo(s * 0.6, s * 0.6)
  g.moveTo(s * 0.6, -s * 0.6)
  g.lineTo(-s * 0.6, s * 0.6)
  g.stroke({ color, width: 2 })
}

function drawCrackedSquare(g: Graphics, s: number, color: number, _variant: number): void {
  g.rect(-s * 0.85, -s * 0.85, s * 1.7, s * 1.7)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  g.moveTo(-s * 0.4, -s * 0.85)
  g.lineTo(0, 0)
  g.lineTo(s * 0.3, s * 0.85)
  g.stroke({ color: 0x1a1a2e, width: 1.5 })
}

// Runtime shapes
function drawRoundedSquare(g: Graphics, s: number, color: number, variant: number): void {
  g.roundRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6, s * 0.3)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  if (variant % 2 === 1) {
    g.circle(0, 0, s * 0.3)
    g.fill({ color: 0x1a1a2e, alpha: 0.6 })
  }
}

function drawCube(g: Graphics, s: number, color: number, _variant: number): void {
  g.moveTo(0, -s)
  g.lineTo(s * 0.87, -s * 0.5)
  g.lineTo(s * 0.87, s * 0.5)
  g.lineTo(0, s)
  g.lineTo(-s * 0.87, s * 0.5)
  g.lineTo(-s * 0.87, -s * 0.5)
  g.closePath()
  g.stroke({ color, width: 1.5 })
}

function drawStack(g: Graphics, s: number, color: number, _variant: number): void {
  for (let i = 0; i < 3; i++) {
    const y = -s * 0.6 + i * s * 0.5
    g.roundRect(-s * 0.7, y, s * 1.4, s * 0.4, s * 0.1)
    g.fill({ color, alpha: 0.6 + i * 0.15 })
    g.stroke({ color, width: 1.5 })
  }
}

function drawModule(g: Graphics, s: number, color: number, _variant: number): void {
  g.roundRect(-s * 0.8, -s * 0.6, s * 1.6, s * 1.2, s * 0.15)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  g.rect(-s * 0.25, -s * 0.85, s * 0.5, s * 0.3)
  g.fill({ color, alpha: 0.9 })
  g.stroke({ color, width: 2 })
}

function drawContainer(g: Graphics, s: number, color: number, _variant: number): void {
  g.rect(-s * 0.8, -s * 0.3, s * 1.6, s * 1.1)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  g.rect(-s * 0.9, -s * 0.55, s * 1.8, s * 0.3)
  g.fill({ color, alpha: 0.9 })
  g.stroke({ color, width: 2 })
}

function drawProcess(g: Graphics, s: number, color: number, _variant: number): void {
  g.roundRect(-s * 0.85, -s * 0.6, s * 1.7, s * 1.2, s * 0.2)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  g.poly([-s * 0.2, -s * 0.3, s * 0.4, 0, -s * 0.2, s * 0.3], true)
  g.fill({ color: 0x1a1a2e, alpha: 0.7 })
}

function drawChip(g: Graphics, s: number, color: number, _variant: number): void {
  g.rect(-s * 0.6, -s * 0.6, s * 1.2, s * 1.2)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  for (let i = -1; i <= 1; i++) {
    g.rect(i * s * 0.35 - s * 0.08, -s * 0.9, s * 0.16, s * 0.35)
    g.rect(i * s * 0.35 - s * 0.08, s * 0.55, s * 0.16, s * 0.35)
    g.fill({ color, alpha: 0.9 })
  }
}

function drawTerminal(g: Graphics, s: number, color: number, _variant: number): void {
  g.roundRect(-s * 0.9, -s * 0.7, s * 1.8, s * 1.4, s * 0.15)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  g.moveTo(-s * 0.5, 0)
  g.lineTo(-s * 0.2, s * 0.2)
  g.lineTo(-s * 0.5, s * 0.4)
  g.stroke({ color: 0x1a1a2e, width: 2 })
  g.rect(s * 0.1, s * 0.1, s * 0.4, s * 0.25)
  g.fill({ color: 0x1a1a2e, alpha: 0.6 })
}
