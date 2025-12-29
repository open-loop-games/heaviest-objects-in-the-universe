// Package icons using Devicon SVGs with Pixi.js Graphics.svg()
// Fetches SVG content and creates Graphics objects
// Includes procedural icon generation for packages without devicons

import { Graphics } from 'pixi.js';

/**
 * Hash a string to a number (for deterministic procedural generation)
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a unique hue (0-360) from a package name
 */
export function nameToHue(name: string): number {
  return hashString(name) % 360;
}

/**
 * Convert HSL to hex color
 */
function hslToHex(h: number, s: number, l: number): number {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color);
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

// Cache for SVG content strings
const svgCache = new Map<string, string | null>();
const loadingPromises = new Map<string, Promise<string | null>>();
// Track SVGs that failed to parse (valid fetch but Pixi can't render)
const parseFailures = new Set<string>();

// Build devicon file path from iconKey
// Use -plain variant to avoid gradient parsing warnings
function getDeviconPath(iconKey: string): string {
  return `/node_modules/devicon/icons/${iconKey}/${iconKey}-plain.svg`;
}

/**
 * Fetch and cache SVG content
 */
async function fetchSvgContent(iconKey: string): Promise<string | null> {
  // Check cache
  if (svgCache.has(iconKey)) {
    return svgCache.get(iconKey) || null;
  }

  // Check if already loading
  if (loadingPromises.has(iconKey)) {
    return loadingPromises.get(iconKey)!;
  }

  const url = getDeviconPath(iconKey);

  const promise = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const svgText = await response.text();
      svgCache.set(iconKey, svgText);
      return svgText;
    } catch (e) {
      // Silent fail - will use fallback
      svgCache.set(iconKey, null);
      return null;
    }
  })();

  loadingPromises.set(iconKey, promise);
  return promise;
}

/**
 * Create a Graphics object with the icon SVG
 * Returns null if SVG not loaded yet (triggers async load)
 */
export function createIconGraphics(iconKey: string, size: number): Graphics | null {
  // Already know this one can't be parsed
  if (parseFailures.has(iconKey)) {
    return null;
  }

  const svgContent = svgCache.get(iconKey);

  // Not in cache - start loading
  if (svgContent === undefined) {
    fetchSvgContent(iconKey);
    return null;
  }

  // Failed to load
  if (svgContent === null) {
    return null;
  }

  // Create Graphics from SVG
  const graphics = new Graphics();

  try {
    graphics.svg(svgContent);
  } catch {
    // Mark as unparseable so we don't retry every frame
    parseFailures.add(iconKey);
    return null;
  }

  // Scale to fit size (devicon SVGs are 128x128)
  const svgSize = 128;
  const scale = size / svgSize;
  graphics.scale.set(scale);

  // Center the icon (pivot at center of original SVG)
  graphics.pivot.set(svgSize / 2, svgSize / 2);

  return graphics;
}

/**
 * Check if icon SVG is loaded and ready to render
 */
export function isIconReady(iconKey: string): boolean {
  if (parseFailures.has(iconKey)) return false;
  const cached = svgCache.get(iconKey);
  return cached !== undefined && cached !== null;
}

/**
 * Check if icon is currently loading
 */
export function isIconLoading(iconKey: string): boolean {
  return loadingPromises.has(iconKey) && !svgCache.has(iconKey);
}

/**
 * Preload icons for faster rendering
 */
export async function preloadIcons(iconKeys: string[]): Promise<void> {
  await Promise.all(iconKeys.map(fetchSvgContent));
}

/**
 * Draw a simple fallback icon shape (for known icon keys)
 */
export function drawFallbackIcon(g: Graphics, iconKey: string, size: number, color: number): void {
  const s = size * 0.35;

  // Different shapes based on package type for visual variety
  if (iconKey === 'react') {
    drawAtom(g, s, color);
  } else if (iconKey === 'vuejs') {
    drawVShape(g, s, color);
  } else if (iconKey === 'angular') {
    drawShield(g, s, color);
  } else if (iconKey === 'typescript') {
    drawSquare(g, s, color);
  } else if (iconKey === 'nodejs') {
    drawHexagon(g, s, color);
  } else if (iconKey === 'webpack' || iconKey === 'rollup' || iconKey === 'vitejs') {
    drawCube(g, s, color);
  } else {
    drawBox(g, s, color);
  }
}

// ============================================
// ARCHETYPE-BASED SHAPE POOLS (Layer 3)
// ============================================
// Each archetype has a pool of semantically appropriate shapes.
// Hash picks which shape within the pool + unique color.

type ShapeDrawFn = (g: Graphics, s: number, color: number) => void;

// Utility shapes: rounded, friendly, simple
const UTILITY_SHAPES: ShapeDrawFn[] = [
  drawCircleDot,
  drawRing,
  drawPill,
  drawDoubleRing,
  drawCircleWithDot,
];

// Framework shapes: polygonal, substantial, architectural
const FRAMEWORK_SHAPES: ShapeDrawFn[] = [
  drawPentagon,
  drawHexagonFilled,
  drawOctagon,
  drawHeptagon,
  drawShieldFilled,
];

// Tooling shapes: angular, precise, mechanical
const TOOLING_SHAPES: ShapeDrawFn[] = [
  drawDiamond,
  drawSquareFilled,
  drawCross,
  drawGear,
  drawArrowUp,
  drawBowtie,
];

// Legacy shapes: warning-like, dated, distinct
const LEGACY_SHAPES: ShapeDrawFn[] = [
  drawTriangle,
  drawTriangleDown,
  drawHourglass,
  drawOctagonStop,
];

// Runtime shapes: Node-like, system-level
const RUNTIME_SHAPES: ShapeDrawFn[] = [
  drawHexagonFilled,
  drawRoundedSquare,
  drawCube,
  drawCircleWithDot,
];

// Map archetype to shape pool
const ARCHETYPE_SHAPES: Record<string, ShapeDrawFn[]> = {
  utility: UTILITY_SHAPES,
  framework: FRAMEWORK_SHAPES,
  tooling: TOOLING_SHAPES,
  legacy: LEGACY_SHAPES,
  runtime: RUNTIME_SHAPES,
};

// Fallback pool for unknown archetypes (all shapes)
const ALL_SHAPES: ShapeDrawFn[] = [
  ...UTILITY_SHAPES,
  ...FRAMEWORK_SHAPES,
  ...TOOLING_SHAPES,
  ...LEGACY_SHAPES,
];

/**
 * Create a procedurally generated icon based on package name and archetype.
 * Same name + archetype = same visual appearance (deterministic).
 * Archetype determines shape category, hash picks specific shape + color.
 */
export function drawProceduralIcon(
  g: Graphics,
  packageName: string,
  size: number,
  archetype?: string
): void {
  if (!packageName) return;

  const hash = hashString(packageName);
  const hue = hash % 360;
  const color = hslToHex(hue, 70, 55);
  const s = size * 0.35;

  // Get shape pool based on archetype (Layer 3: semantic assignment)
  const shapePool = archetype && ARCHETYPE_SHAPES[archetype]
    ? ARCHETYPE_SHAPES[archetype]
    : ALL_SHAPES;

  // Pick shape from pool based on hash (Layer 2: more shapes)
  const shapeIndex = Math.floor(hash / 360) % shapePool.length;
  const drawShape = shapePool[shapeIndex]!;

  drawShape(g, s, color);
}

// Additional shape helpers for procedural icons
// Use Pixi's poly() for cleaner path handling
function drawDiamond(g: Graphics, s: number, color: number): void {
  g.poly([0, -s, s, 0, 0, s, -s, 0], true);
  g.fill({ color, alpha: 0.8 });
  g.stroke({ color, width: 2 });
}

function drawTriangle(g: Graphics, s: number, color: number): void {
  g.poly([0, -s, s * 0.87, s * 0.5, -s * 0.87, s * 0.5], true);
  g.fill({ color, alpha: 0.8 });
  g.stroke({ color, width: 2 });
}

function drawPentagon(g: Graphics, s: number, color: number): void {
  const points: number[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
    points.push(Math.cos(angle) * s, Math.sin(angle) * s);
  }
  g.poly(points, true);
  g.fill({ color, alpha: 0.8 });
  g.stroke({ color, width: 2 });
}

function drawStar(g: Graphics, s: number, color: number): void {
  const innerR = s * 0.4;
  const points: number[] = [];
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i * 2 * Math.PI / 5) - Math.PI / 2;
    const innerAngle = outerAngle + Math.PI / 5;
    points.push(Math.cos(outerAngle) * s, Math.sin(outerAngle) * s);
    points.push(Math.cos(innerAngle) * innerR, Math.sin(innerAngle) * innerR);
  }
  g.poly(points, true);
  g.fill({ color, alpha: 0.8 });
  g.stroke({ color, width: 1.5 });
}

function drawCross(g: Graphics, s: number, color: number): void {
  const w = s * 0.35;
  g.poly([
    -w, -s, w, -s, w, -w, s, -w, s, w, w, w,
    w, s, -w, s, -w, w, -s, w, -s, -w, -w, -w
  ], true);
  g.fill({ color, alpha: 0.8 });
  g.stroke({ color, width: 2 });
}

function drawCircleDot(g: Graphics, s: number, color: number): void {
  g.circle(0, 0, s);
  g.fill({ color, alpha: 0.8 });
  g.stroke({ color, width: 2 });
}

// ============================================
// NEW SHAPES (Layer 2)
// ============================================

// Utility shapes
function drawRing(g: Graphics, s: number, color: number): void {
  g.circle(0, 0, s);
  g.stroke({ color, width: 3 });
  g.circle(0, 0, s * 0.5);
  g.stroke({ color, width: 2 });
}

function drawPill(g: Graphics, s: number, color: number): void {
  g.roundRect(-s * 1.2, -s * 0.5, s * 2.4, s, s * 0.5);
  g.fill({ color, alpha: 0.8 });
  g.stroke({ color, width: 2 });
}

function drawDoubleRing(g: Graphics, s: number, color: number): void {
  g.circle(0, 0, s);
  g.stroke({ color, width: 2 });
  g.circle(0, 0, s * 0.6);
  g.stroke({ color, width: 2 });
}

function drawCircleWithDot(g: Graphics, s: number, color: number): void {
  g.circle(0, 0, s);
  g.stroke({ color, width: 2 });
  g.circle(0, 0, s * 0.3);
  g.fill({ color, alpha: 0.9 });
}

// Framework shapes
function drawHexagonFilled(g: Graphics, s: number, color: number): void {
  const points: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI / 3) - Math.PI / 2;
    points.push(Math.cos(angle) * s, Math.sin(angle) * s);
  }
  g.poly(points, true);
  g.fill({ color, alpha: 0.8 });
  g.stroke({ color, width: 2 });
}

function drawOctagon(g: Graphics, s: number, color: number): void {
  const points: number[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI / 4) - Math.PI / 8;
    points.push(Math.cos(angle) * s, Math.sin(angle) * s);
  }
  g.poly(points, true);
  g.fill({ color, alpha: 0.8 });
  g.stroke({ color, width: 2 });
}

function drawHeptagon(g: Graphics, s: number, color: number): void {
  const points: number[] = [];
  for (let i = 0; i < 7; i++) {
    const angle = (i * 2 * Math.PI / 7) - Math.PI / 2;
    points.push(Math.cos(angle) * s, Math.sin(angle) * s);
  }
  g.poly(points, true);
  g.fill({ color, alpha: 0.8 });
  g.stroke({ color, width: 2 });
}

function drawShieldFilled(g: Graphics, s: number, color: number): void {
  g.moveTo(0, -s);
  g.lineTo(s, -s * 0.4);
  g.lineTo(s * 0.8, s * 0.5);
  g.lineTo(0, s);
  g.lineTo(-s * 0.8, s * 0.5);
  g.lineTo(-s, -s * 0.4);
  g.closePath();
  g.fill({ color, alpha: 0.8 });
  g.stroke({ color, width: 2 });
}

// Tooling shapes
function drawSquareFilled(g: Graphics, s: number, color: number): void {
  g.rect(-s * 0.85, -s * 0.85, s * 1.7, s * 1.7);
  g.fill({ color, alpha: 0.8 });
  g.stroke({ color, width: 2 });
}

function drawGear(g: Graphics, s: number, color: number): void {
  // Outer gear teeth
  const teeth = 8;
  const outerR = s;
  const innerR = s * 0.7;
  const points: number[] = [];
  for (let i = 0; i < teeth; i++) {
    const angle1 = (i * 2 * Math.PI / teeth);
    const angle2 = angle1 + Math.PI / teeth * 0.4;
    const angle3 = angle1 + Math.PI / teeth * 0.6;
    const angle4 = angle1 + Math.PI / teeth;
    points.push(Math.cos(angle1) * outerR, Math.sin(angle1) * outerR);
    points.push(Math.cos(angle2) * outerR, Math.sin(angle2) * outerR);
    points.push(Math.cos(angle3) * innerR, Math.sin(angle3) * innerR);
    points.push(Math.cos(angle4) * innerR, Math.sin(angle4) * innerR);
  }
  g.poly(points, true);
  g.fill({ color, alpha: 0.8 });
  g.stroke({ color, width: 1.5 });
  // Center hole
  g.circle(0, 0, s * 0.25);
  g.fill({ color: 0x1a1a2e, alpha: 1 });
}

function drawArrowUp(g: Graphics, s: number, color: number): void {
  const w = s * 0.4;
  g.poly([
    0, -s,           // top point
    s * 0.7, 0,      // right wing
    w, 0,            // right inner
    w, s,            // right bottom
    -w, s,           // left bottom
    -w, 0,           // left inner
    -s * 0.7, 0,     // left wing
  ], true);
  g.fill({ color, alpha: 0.8 });
  g.stroke({ color, width: 2 });
}

function drawBowtie(g: Graphics, s: number, color: number): void {
  g.poly([
    -s, -s * 0.7,
    0, 0,
    -s, s * 0.7,
    s, s * 0.7,
    0, 0,
    s, -s * 0.7,
  ], true);
  g.fill({ color, alpha: 0.8 });
  g.stroke({ color, width: 2 });
}

// Legacy shapes
function drawTriangleDown(g: Graphics, s: number, color: number): void {
  g.poly([0, s, s * 0.87, -s * 0.5, -s * 0.87, -s * 0.5], true);
  g.fill({ color, alpha: 0.8 });
  g.stroke({ color, width: 2 });
}

function drawHourglass(g: Graphics, s: number, color: number): void {
  g.poly([
    -s * 0.7, -s,
    s * 0.7, -s,
    0, 0,
    s * 0.7, s,
    -s * 0.7, s,
    0, 0,
  ], true);
  g.fill({ color, alpha: 0.8 });
  g.stroke({ color, width: 2 });
}

function drawOctagonStop(g: Graphics, s: number, color: number): void {
  // Stop sign style octagon (flatter top/bottom)
  const points: number[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI / 4);
    points.push(Math.cos(angle) * s, Math.sin(angle) * s);
  }
  g.poly(points, true);
  g.fill({ color, alpha: 0.8 });
  g.stroke({ color, width: 2 });
}

// Runtime shapes
function drawRoundedSquare(g: Graphics, s: number, color: number): void {
  g.roundRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6, s * 0.3);
  g.fill({ color, alpha: 0.8 });
  g.stroke({ color, width: 2 });
}

// ============================================
// Fallback shape helpers (for known icon keys)
// ============================================
function drawAtom(g: Graphics, s: number, color: number): void {
  g.ellipse(0, 0, s * 0.9, s * 0.35);
  g.stroke({ color, width: 1.5 });
  g.ellipse(0, 0, s * 0.35, s * 0.9);
  g.stroke({ color, width: 1.5 });
  g.circle(0, 0, s * 0.18);
  g.fill({ color });
}

function drawVShape(g: Graphics, s: number, color: number): void {
  g.moveTo(-s, -s * 0.8);
  g.lineTo(0, s * 0.8);
  g.lineTo(s, -s * 0.8);
  g.lineTo(s * 0.6, -s * 0.8);
  g.lineTo(0, s * 0.3);
  g.lineTo(-s * 0.6, -s * 0.8);
  g.closePath();
  g.fill({ color });
}

function drawShield(g: Graphics, s: number, color: number): void {
  g.moveTo(0, -s);
  g.lineTo(s, -s * 0.5);
  g.lineTo(s * 0.8, s * 0.6);
  g.lineTo(0, s);
  g.lineTo(-s * 0.8, s * 0.6);
  g.lineTo(-s, -s * 0.5);
  g.closePath();
  g.stroke({ color, width: 2 });
}

function drawSquare(g: Graphics, s: number, color: number): void {
  g.roundRect(-s, -s, s * 2, s * 2, s * 0.15);
  g.stroke({ color, width: 2 });
}

function drawHexagon(g: Graphics, s: number, color: number): void {
  g.moveTo(s, 0);
  for (let i = 1; i <= 6; i++) {
    const angle = (i * Math.PI) / 3;
    g.lineTo(Math.cos(angle) * s, Math.sin(angle) * s);
  }
  g.stroke({ color, width: 2 });
}

function drawCube(g: Graphics, s: number, color: number): void {
  g.moveTo(0, -s);
  g.lineTo(s * 0.87, -s * 0.5);
  g.lineTo(s * 0.87, s * 0.5);
  g.lineTo(0, s);
  g.lineTo(-s * 0.87, s * 0.5);
  g.lineTo(-s * 0.87, -s * 0.5);
  g.closePath();
  g.stroke({ color, width: 1.5 });
}

function drawBox(g: Graphics, s: number, color: number): void {
  g.roundRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6, 3);
  g.stroke({ color, width: 2 });
}

// Legacy exports for compatibility during transition
export function drawIcon(_g: Graphics, _iconKey: string, _size: number, _color: number): boolean {
  return false;
}

export function hasIcon(iconKey: string): boolean {
  return isIconReady(iconKey);
}
