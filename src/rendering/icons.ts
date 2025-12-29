// Simplified package icons drawn with Pixi.js Graphics
// Based on Devicon/Simple Icons designs, simplified for small rendering

import { Graphics } from 'pixi.js';

// Icon draw functions - each draws centered at (0,0) within a given size
export type IconDrawFn = (g: Graphics, size: number, color: number) => void;

// React - simplified atom with orbits
const drawReact: IconDrawFn = (g, size, color) => {
  const r = size * 0.4;

  // Draw three elliptical orbits at different rotations
  // Orbit 1: horizontal
  drawEllipse(g, 0, 0, r, r * 0.35, 0, color);
  // Orbit 2: rotated 60 degrees
  drawEllipse(g, 0, 0, r, r * 0.35, Math.PI / 3, color);
  // Orbit 3: rotated -60 degrees
  drawEllipse(g, 0, 0, r, r * 0.35, -Math.PI / 3, color);

  // Center dot
  g.circle(0, 0, size * 0.1);
  g.fill({ color });
};

// Helper to draw a rotated ellipse
function drawEllipse(g: Graphics, cx: number, cy: number, rx: number, ry: number, rotation: number, color: number) {
  const points = 24;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const x = Math.cos(angle) * rx;
    const y = Math.sin(angle) * ry;
    // Rotate point
    const rx2 = x * cos - y * sin + cx;
    const ry2 = x * sin + y * cos + cy;

    if (i === 0) {
      g.moveTo(rx2, ry2);
    } else {
      g.lineTo(rx2, ry2);
    }
  }
  g.stroke({ color, width: 1.5 });
}

// Vue - V shape
const drawVue: IconDrawFn = (g, size, color) => {
  const h = size * 0.4;
  const w = size * 0.35;

  // Outer V
  g.moveTo(-w, -h);
  g.lineTo(0, h * 0.7);
  g.lineTo(w, -h);
  g.lineTo(w * 0.6, -h);
  g.lineTo(0, h * 0.2);
  g.lineTo(-w * 0.6, -h);
  g.closePath();
  g.fill({ color });
};

// Node.js - hexagon with N
const drawNode: IconDrawFn = (g, size, color) => {
  const r = size * 0.38;

  // Hexagon
  g.moveTo(r, 0);
  for (let i = 1; i <= 6; i++) {
    const angle = (i * Math.PI) / 3;
    g.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  g.stroke({ color, width: 1.5 });

  // N letter
  const nw = size * 0.15;
  const nh = size * 0.2;
  g.moveTo(-nw, nh);
  g.lineTo(-nw, -nh);
  g.lineTo(nw, nh);
  g.lineTo(nw, -nh);
  g.stroke({ color, width: 1.5 });
};

// TypeScript - TS in rounded square
const drawTypeScript: IconDrawFn = (g, size, color) => {
  const s = size * 0.35;
  const r = size * 0.06;

  // Rounded rectangle
  g.roundRect(-s, -s, s * 2, s * 2, r);
  g.stroke({ color, width: 1.5 });

  // T shape (simplified)
  g.moveTo(-s * 0.5, -s * 0.4);
  g.lineTo(s * 0.1, -s * 0.4);
  g.stroke({ color, width: 1.5 });
  g.moveTo(-s * 0.2, -s * 0.4);
  g.lineTo(-s * 0.2, s * 0.5);
  g.stroke({ color, width: 1.5 });

  // S curve (simplified)
  g.moveTo(s * 0.5, -s * 0.3);
  g.lineTo(s * 0.2, -s * 0.3);
  g.lineTo(s * 0.2, 0);
  g.lineTo(s * 0.5, 0);
  g.lineTo(s * 0.5, s * 0.4);
  g.lineTo(s * 0.15, s * 0.4);
  g.stroke({ color, width: 1.2 });
};

// Webpack - cube/crystal
const drawWebpack: IconDrawFn = (g, size, color) => {
  const s = size * 0.35;

  // Hexagonal crystal shape
  g.moveTo(0, -s);
  g.lineTo(s * 0.9, -s * 0.4);
  g.lineTo(s * 0.9, s * 0.4);
  g.lineTo(0, s);
  g.lineTo(-s * 0.9, s * 0.4);
  g.lineTo(-s * 0.9, -s * 0.4);
  g.closePath();
  g.stroke({ color, width: 1.5 });

  // Inner lines (W shape)
  g.moveTo(0, -s * 0.4);
  g.lineTo(0, s * 0.5);
  g.moveTo(-s * 0.5, -s * 0.1);
  g.lineTo(0, s * 0.2);
  g.lineTo(s * 0.5, -s * 0.1);
  g.stroke({ color, width: 1 });
};

// Babel - book/scroll
const drawBabel: IconDrawFn = (g, size, color) => {
  const w = size * 0.3;
  const h = size * 0.35;

  // Book shape
  g.moveTo(-w, -h);
  g.lineTo(w, -h);
  g.lineTo(w, h);
  g.lineTo(-w, h);
  g.lineTo(-w, -h);
  g.moveTo(0, -h);
  g.lineTo(0, h);
  g.stroke({ color, width: 1.5 });

  // Lines on pages
  g.moveTo(-w * 0.7, -h * 0.3);
  g.lineTo(-w * 0.2, -h * 0.3);
  g.moveTo(-w * 0.7, 0);
  g.lineTo(-w * 0.2, 0);
  g.moveTo(w * 0.2, -h * 0.3);
  g.lineTo(w * 0.7, -h * 0.3);
  g.stroke({ color, width: 1 });
};

// ESLint - bracket with dot
const drawEslint: IconDrawFn = (g, size, color) => {
  const s = size * 0.35;

  // Hexagon shape
  const sides = 6;
  g.moveTo(s, 0);
  for (let i = 1; i <= sides; i++) {
    const angle = (i * 2 * Math.PI) / sides - Math.PI / 6;
    g.lineTo(Math.cos(angle) * s, Math.sin(angle) * s);
  }
  g.stroke({ color, width: 1.5 });

  // Inner checkmark
  g.moveTo(-s * 0.3, 0);
  g.lineTo(-s * 0.05, s * 0.25);
  g.lineTo(s * 0.35, -s * 0.25);
  g.stroke({ color, width: 1.5 });
};

// Jest - jester hat shape
const drawJest: IconDrawFn = (g, size, color) => {
  const s = size * 0.35;

  // J shape
  g.moveTo(-s * 0.3, -s * 0.8);
  g.lineTo(s * 0.5, -s * 0.8);
  g.moveTo(s * 0.1, -s * 0.8);
  g.lineTo(s * 0.1, s * 0.4);
  g.quadraticCurveTo(s * 0.1, s * 0.8, -s * 0.3, s * 0.8);
  g.quadraticCurveTo(-s * 0.6, s * 0.8, -s * 0.6, s * 0.4);
  g.stroke({ color, width: 1.5 });
};

// Vite - lightning bolt
const drawVite: IconDrawFn = (g, size, color) => {
  const s = size * 0.38;

  // Lightning bolt
  g.moveTo(s * 0.3, -s);
  g.lineTo(-s * 0.4, s * 0.1);
  g.lineTo(0, s * 0.1);
  g.lineTo(-s * 0.3, s);
  g.lineTo(s * 0.4, -s * 0.1);
  g.lineTo(0, -s * 0.1);
  g.closePath();
  g.fill({ color });
};

// Svelte - S curve
const drawSvelte: IconDrawFn = (g, size, color) => {
  const s = size * 0.35;

  // S shape
  g.moveTo(s * 0.4, -s * 0.7);
  g.quadraticCurveTo(-s * 0.2, -s * 0.7, -s * 0.4, -s * 0.3);
  g.quadraticCurveTo(-s * 0.5, 0, 0, 0);
  g.quadraticCurveTo(s * 0.5, 0, s * 0.4, s * 0.3);
  g.quadraticCurveTo(s * 0.2, s * 0.7, -s * 0.4, s * 0.7);
  g.stroke({ color, width: 2 });
};

// Rollup - scroll/roll
const drawRollup: IconDrawFn = (g, size, color) => {
  const s = size * 0.35;

  // Rolled paper
  g.circle(0, 0, s * 0.6);
  g.stroke({ color, width: 1.5 });
  g.circle(0, 0, s * 0.3);
  g.stroke({ color, width: 1 });
};

// Next.js - N in circle
const drawNext: IconDrawFn = (g, size, color) => {
  const s = size * 0.38;

  // Circle
  g.circle(0, 0, s);
  g.stroke({ color, width: 1.5 });

  // N
  const nw = s * 0.35;
  const nh = s * 0.5;
  g.moveTo(-nw, nh);
  g.lineTo(-nw, -nh);
  g.lineTo(nw, nh);
  g.lineTo(nw, -nh);
  g.stroke({ color, width: 1.5 });
};

// Express - E
const drawExpress: IconDrawFn = (g, size, color) => {
  const w = size * 0.25;
  const h = size * 0.35;

  // E shape
  g.moveTo(w, -h);
  g.lineTo(-w, -h);
  g.lineTo(-w, h);
  g.lineTo(w, h);
  g.moveTo(-w, 0);
  g.lineTo(w * 0.5, 0);
  g.stroke({ color, width: 2 });
};

// Angular - A shield
const drawAngular: IconDrawFn = (g, size, color) => {
  const s = size * 0.38;

  // Shield shape
  g.moveTo(0, -s);
  g.lineTo(s, -s * 0.5);
  g.lineTo(s * 0.8, s * 0.6);
  g.lineTo(0, s);
  g.lineTo(-s * 0.8, s * 0.6);
  g.lineTo(-s, -s * 0.5);
  g.closePath();
  g.stroke({ color, width: 1.5 });

  // A
  g.moveTo(0, -s * 0.4);
  g.lineTo(-s * 0.3, s * 0.4);
  g.moveTo(0, -s * 0.4);
  g.lineTo(s * 0.3, s * 0.4);
  g.moveTo(-s * 0.15, s * 0.1);
  g.lineTo(s * 0.15, s * 0.1);
  g.stroke({ color, width: 1.2 });
};

// Lodash - underscore
const drawLodash: IconDrawFn = (g, size, color) => {
  const w = size * 0.35;

  // Underscore
  g.moveTo(-w, size * 0.1);
  g.lineTo(w, size * 0.1);
  g.stroke({ color, width: 3 });
};

// NPM - cube
const drawNpm: IconDrawFn = (g, size, color) => {
  const s = size * 0.32;

  // Square
  g.rect(-s, -s, s * 2, s * 2);
  g.stroke({ color, width: 1.5 });

  // n shape inside
  g.moveTo(-s * 0.6, s * 0.6);
  g.lineTo(-s * 0.6, -s * 0.3);
  g.lineTo(-s * 0.1, s * 0.6);
  g.lineTo(-s * 0.1, -s * 0.3);
  g.moveTo(s * 0.2, s * 0.6);
  g.lineTo(s * 0.2, -s * 0.3);
  g.stroke({ color, width: 1.2 });
};

// Vitest - checkmark in circle
const drawVitest: IconDrawFn = (g, size, color) => {
  const s = size * 0.35;

  // Lightning V
  g.moveTo(-s * 0.6, -s * 0.4);
  g.lineTo(0, s * 0.6);
  g.lineTo(s * 0.6, -s * 0.6);
  g.stroke({ color, width: 2 });
};

// Map of icon keys to draw functions
export const ICON_REGISTRY: Record<string, IconDrawFn> = {
  'react': drawReact,
  'vuejs': drawVue,
  'nodejs': drawNode,
  'typescript': drawTypeScript,
  'webpack': drawWebpack,
  'babel': drawBabel,
  'eslint': drawEslint,
  'jest': drawJest,
  'vitejs': drawVite,
  'svelte': drawSvelte,
  'rollup': drawRollup,
  'nextjs': drawNext,
  'express': drawExpress,
  'angularjs': drawAngular,
  'lodash': drawLodash,
  'npm': drawNpm,
  'vitest': drawVitest,
};

/**
 * Draw an icon if it exists, returns true if drawn
 */
export function drawIcon(g: Graphics, iconKey: string, size: number, color: number): boolean {
  const drawFn = ICON_REGISTRY[iconKey];
  if (drawFn) {
    drawFn(g, size, color);
    return true;
  }
  return false;
}

/**
 * Check if an icon exists for the given key
 */
export function hasIcon(iconKey: string): boolean {
  return iconKey in ICON_REGISTRY;
}
