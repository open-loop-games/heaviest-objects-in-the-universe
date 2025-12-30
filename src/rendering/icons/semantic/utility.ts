// General utility package icons
import { Graphics } from 'pixi.js'
import { drawShieldOutline, drawLightningShape } from '../primitives'

export const UTILITY_ICONS: Record<
  string,
  (g: Graphics, s: number, color: number) => void
> = {
  // chalk: Crayon with color tip
  chalk: (g, s, color) => {
    // Crayon body (rectangle)
    g.roundRect(-s * 0.3, -s * 0.3, s * 1.2, s * 0.6, s * 0.1)
    g.fill({ color, alpha: 0.7 })
    g.stroke({ color, width: 2 })
    // Pointed tip
    g.poly([s * 0.9, -s * 0.3, s * 1.2, 0, s * 0.9, s * 0.3], true)
    g.fill({ color, alpha: 1 })
  },

  // debug: Bug silhouette
  debug: (g, s, color) => {
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
  },

  // semver: Three stacked dots (major.minor.patch)
  semver: (g, s, color) => {
    const dotR = s * 0.25
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
  },

  // uuid: Snowflake pattern (each one unique)
  uuid: (g, s, color) => {
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
  },

  // ms: Stopwatch / timer
  ms: (g, s, color) => {
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
  },

  // prettier: Aligned code bars
  prettier: (g, s, color) => {
    const barH = s * 0.18
    const gap = s * 0.35
    g.roundRect(-s * 0.8, -gap * 1.5, s * 1.4, barH, barH / 2)
    g.roundRect(-s * 0.8, -gap * 0.5, s * 1.0, barH, barH / 2)
    g.roundRect(-s * 0.8, gap * 0.5, s * 1.6, barH, barH / 2)
    g.roundRect(-s * 0.8, gap * 1.5, s * 0.8, barH, barH / 2)
    g.fill({ color, alpha: 0.8 })
  },

  // esbuild: Lightning bolt (speed)
  esbuild: (g, s, color) => {
    drawLightningShape(g, s, color, true)
  },

  // escape-html: Angle brackets </>
  'escape-html': (g, s, color) => {
    g.moveTo(-s * 0.2, -s * 0.7)
    g.lineTo(-s * 0.8, 0)
    g.lineTo(-s * 0.2, s * 0.7)
    g.moveTo(s * 0.2, -s * 0.7)
    g.lineTo(s * 0.8, 0)
    g.lineTo(s * 0.2, s * 0.7)
    g.moveTo(s * 0.15, -s * 0.5)
    g.lineTo(-s * 0.15, s * 0.5)
    g.stroke({ color, width: 2.5 })
  },

  // safe-buffer: Shield with block inside
  'safe-buffer': (g, s, color) => {
    drawShieldOutline(g, s, color)
    // Memory block inside
    g.rect(-s * 0.35, -s * 0.25, s * 0.7, s * 0.5)
    g.fill({ color, alpha: 0.6 })
  },

  // inherits: Nested squares (inheritance chain)
  inherits: (g, s, color) => {
    g.rect(-s * 0.9, -s * 0.9, s * 1.8, s * 1.8)
    g.stroke({ color, width: 2 })
    g.rect(-s * 0.55, -s * 0.55, s * 1.1, s * 1.1)
    g.stroke({ color, width: 2 })
    g.rect(-s * 0.25, -s * 0.25, s * 0.5, s * 0.5)
    g.fill({ color, alpha: 0.8 })
  },

  // color-name / supports-color: RGB overlapping circles
  'color-name': (g, s, _color) => {
    const r = s * 0.5
    const offset = s * 0.35
    g.circle(-offset, -offset * 0.5, r)
    g.fill({ color: 0xff6b6b, alpha: 0.6 })
    g.circle(offset, -offset * 0.5, r)
    g.fill({ color: 0x51cf66, alpha: 0.6 })
    g.circle(0, offset * 0.7, r)
    g.fill({ color: 0x339af0, alpha: 0.6 })
    g.circle(0, 0, r * 0.3)
    g.fill({ color: 0xffffff, alpha: 0.9 })
  },

  'supports-color': (g, s, _color) => {
    const r = s * 0.5
    const offset = s * 0.35
    g.circle(-offset, -offset * 0.5, r)
    g.fill({ color: 0xff6b6b, alpha: 0.6 })
    g.circle(offset, -offset * 0.5, r)
    g.fill({ color: 0x51cf66, alpha: 0.6 })
    g.circle(0, offset * 0.7, r)
    g.fill({ color: 0x339af0, alpha: 0.6 })
    g.circle(0, 0, r * 0.3)
    g.fill({ color: 0xffffff, alpha: 0.9 })
  },

  // has-flag: Flag shape
  'has-flag': (g, s, color) => {
    // Flagpole
    g.moveTo(-s * 0.7, -s)
    g.lineTo(-s * 0.7, s)
    g.stroke({ color, width: 2 })
    // Flag
    g.poly([-s * 0.7, -s, s * 0.7, -s * 0.5, -s * 0.7, 0], true)
    g.fill({ color, alpha: 0.8 })
  },

  // lodash: Underscore with extra (low-dash)
  lodash: (g, s, color) => {
    // Two underscores (double dash)
    g.moveTo(-s * 0.8, s * 0.2)
    g.lineTo(s * 0.8, s * 0.2)
    g.moveTo(-s * 0.8, s * 0.5)
    g.lineTo(s * 0.8, s * 0.5)
    g.stroke({ color, width: 3 })
    // Arrow pointing down (low)
    g.poly([0, -s * 0.6, s * 0.3, -s * 0.2, -s * 0.3, -s * 0.2], true)
    g.fill({ color, alpha: 0.7 })
  },

  // ramda: Lambda symbol
  ramda: (g, s, color) => {
    // Lambda λ shape
    g.moveTo(-s * 0.6, s * 0.8)
    g.lineTo(0, -s * 0.8)
    g.lineTo(s * 0.6, s * 0.8)
    g.stroke({ color, width: 3 })
    // Cross bar
    g.moveTo(-s * 0.45, s * 0.2)
    g.lineTo(s * 0.1, s * 0.2)
    g.stroke({ color, width: 3 })
  },

  // starter-kit: Gift box / present
  'starter-kit': (g, s, color) => {
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
  },
}
