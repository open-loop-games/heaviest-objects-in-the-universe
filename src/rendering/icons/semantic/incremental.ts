// Incremental game package icons - meta packages for the incremental game genre
// These are the tools of the trade for building idle/incremental games

import { Graphics } from 'pixi.js'

export const INCREMENTAL_ICONS: Record<
  string,
  (g: Graphics, s: number, color: number) => void
> = {
  // break_infinity: A broken infinity symbol - numbers so big they shatter
  break_infinity: (g, s, color) => {
    // Left loop of infinity (intact)
    g.moveTo(-s * 0.3, 0)
    g.bezierCurveTo(-s * 0.3, -s * 0.5, -s * 0.9, -s * 0.5, -s * 0.9, 0)
    g.bezierCurveTo(-s * 0.9, s * 0.5, -s * 0.3, s * 0.5, -s * 0.3, 0)
    g.stroke({ color, width: 2.5 })

    // Right loop (broken/shattered into fragments)
    // Main arc with break
    g.moveTo(s * 0.1, -s * 0.15)
    g.bezierCurveTo(s * 0.3, -s * 0.5, s * 0.7, -s * 0.5, s * 0.85, -s * 0.2)
    g.stroke({ color, width: 2.5 })

    // Floating fragments (the "break")
    g.moveTo(s * 0.9, s * 0.1)
    g.lineTo(s * 0.95, s * 0.25)
    g.stroke({ color, width: 2 })

    g.moveTo(s * 0.7, s * 0.35)
    g.lineTo(s * 0.6, s * 0.5)
    g.stroke({ color, width: 2 })

    g.moveTo(s * 0.35, s * 0.25)
    g.lineTo(s * 0.2, s * 0.15)
    g.stroke({ color, width: 2 })

    // Sparkle at break point (power escaping)
    g.star(s * 0.75, 0, 4, s * 0.12, s * 0.06)
    g.fill({ color, alpha: 0.9 })
  },

  // break_eternity: Double infinity breaking apart - even bigger numbers
  break_eternity: (g, s, color) => {
    // First infinity (smaller, background) - faded
    g.moveTo(-s * 0.5, -s * 0.35)
    g.bezierCurveTo(-s * 0.5, -s * 0.6, -s * 0.9, -s * 0.6, -s * 0.9, -s * 0.35)
    g.bezierCurveTo(-s * 0.9, -s * 0.1, -s * 0.5, -s * 0.1, -s * 0.5, -s * 0.35)
    g.stroke({ color, width: 1.5, alpha: 0.5 })

    g.moveTo(s * 0.5, -s * 0.35)
    g.bezierCurveTo(s * 0.5, -s * 0.6, s * 0.9, -s * 0.6, s * 0.9, -s * 0.35)
    g.bezierCurveTo(s * 0.9, -s * 0.1, s * 0.5, -s * 0.1, s * 0.5, -s * 0.35)
    g.stroke({ color, width: 1.5, alpha: 0.5 })

    // Second infinity (main, foreground) - shattering more dramatically
    // Left intact
    g.moveTo(-s * 0.3, s * 0.25)
    g.bezierCurveTo(-s * 0.3, 0, -s * 0.7, 0, -s * 0.7, s * 0.25)
    g.bezierCurveTo(-s * 0.7, s * 0.5, -s * 0.3, s * 0.5, -s * 0.3, s * 0.25)
    g.stroke({ color, width: 2.5 })

    // Right completely shattered
    g.moveTo(s * 0.1, s * 0.15)
    g.lineTo(s * 0.25, s * 0.05)
    g.stroke({ color, width: 2 })

    g.moveTo(s * 0.35, s * 0.0)
    g.lineTo(s * 0.5, -s * 0.1)
    g.stroke({ color, width: 2 })

    g.moveTo(s * 0.55, s * 0.2)
    g.lineTo(s * 0.7, s * 0.35)
    g.stroke({ color, width: 2 })

    g.moveTo(s * 0.4, s * 0.45)
    g.lineTo(s * 0.25, s * 0.55)
    g.stroke({ color, width: 2 })

    // Multiple sparkles (more power escaping)
    g.star(s * 0.45, s * 0.15, 4, s * 0.1, s * 0.05)
    g.fill({ color, alpha: 0.9 })
    g.star(s * 0.65, s * 0.05, 4, s * 0.08, s * 0.04)
    g.fill({ color, alpha: 0.7 })
  },

  // decimal.js: Precise decimal point with radiating precision lines
  'decimal.js': (g, s, color) => {
    // Central decimal point (the core)
    g.circle(0, 0, s * 0.25)
    g.fill({ color, alpha: 0.9 })

    // Precision rings (arbitrary precision)
    g.circle(0, 0, s * 0.5)
    g.stroke({ color, width: 1.5, alpha: 0.7 })
    g.circle(0, 0, s * 0.75)
    g.stroke({ color, width: 1, alpha: 0.5 })
    g.circle(0, 0, s)
    g.stroke({ color, width: 0.5, alpha: 0.3 })

    // Tick marks at cardinal points (precision markers)
    const ticks = 8
    for (let i = 0; i < ticks; i++) {
      const angle = (Math.PI * 2 * i) / ticks
      const inner = s * 0.85
      const outer = s * 1.0
      g.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
      g.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
      g.stroke({ color, width: 1.5, alpha: 0.6 })
    }
  },

  // profectus: A layered tree structure (incremental framework)
  profectus: (g, s, color) => {
    // Tree trunk (the core framework)
    g.rect(-s * 0.1, s * 0.1, s * 0.2, s * 0.7)
    g.fill({ color, alpha: 0.8 })

    // Layered branches (the layer system)
    // Bottom layer (widest)
    g.moveTo(-s * 0.8, s * 0.3)
    g.lineTo(0, -s * 0.1)
    g.lineTo(s * 0.8, s * 0.3)
    g.closePath()
    g.fill({ color, alpha: 0.6 })

    // Middle layer
    g.moveTo(-s * 0.6, s * 0.0)
    g.lineTo(0, -s * 0.35)
    g.lineTo(s * 0.6, s * 0.0)
    g.closePath()
    g.fill({ color, alpha: 0.75 })

    // Top layer (narrowest)
    g.moveTo(-s * 0.4, -s * 0.25)
    g.lineTo(0, -s * 0.6)
    g.lineTo(s * 0.4, -s * 0.25)
    g.closePath()
    g.fill({ color, alpha: 0.9 })

    // Star at top (prestige/achievement)
    g.star(0, -s * 0.75, 5, s * 0.15, s * 0.07)
    g.fill({ color, alpha: 1 })
  },

  // modding-tree: Branching tree with modification nodes
  'modding-tree': (g, s, color) => {
    // Central trunk
    g.moveTo(0, s * 0.8)
    g.lineTo(0, 0)
    g.stroke({ color, width: 3 })

    // Branch to left
    g.moveTo(0, 0)
    g.quadraticCurveTo(-s * 0.3, -s * 0.2, -s * 0.6, -s * 0.4)
    g.stroke({ color, width: 2.5 })

    // Branch to right
    g.moveTo(0, 0)
    g.quadraticCurveTo(s * 0.3, -s * 0.2, s * 0.6, -s * 0.4)
    g.stroke({ color, width: 2.5 })

    // Sub-branches
    g.moveTo(-s * 0.6, -s * 0.4)
    g.lineTo(-s * 0.8, -s * 0.7)
    g.stroke({ color, width: 2 })

    g.moveTo(-s * 0.6, -s * 0.4)
    g.lineTo(-s * 0.4, -s * 0.75)
    g.stroke({ color, width: 2 })

    g.moveTo(s * 0.6, -s * 0.4)
    g.lineTo(s * 0.8, -s * 0.7)
    g.stroke({ color, width: 2 })

    g.moveTo(s * 0.6, -s * 0.4)
    g.lineTo(s * 0.4, -s * 0.75)
    g.stroke({ color, width: 2 })

    // Upgrade nodes (the "mods")
    g.circle(0, 0, s * 0.15)
    g.fill({ color, alpha: 0.9 })

    g.circle(-s * 0.6, -s * 0.4, s * 0.12)
    g.fill({ color, alpha: 0.8 })

    g.circle(s * 0.6, -s * 0.4, s * 0.12)
    g.fill({ color, alpha: 0.8 })

    // Leaf nodes
    g.circle(-s * 0.8, -s * 0.7, s * 0.08)
    g.fill({ color, alpha: 0.7 })
    g.circle(-s * 0.4, -s * 0.75, s * 0.08)
    g.fill({ color, alpha: 0.7 })
    g.circle(s * 0.8, -s * 0.7, s * 0.08)
    g.fill({ color, alpha: 0.7 })
    g.circle(s * 0.4, -s * 0.75, s * 0.08)
    g.fill({ color, alpha: 0.7 })
  },

  // pixi.js: Pixelated/blocky P shape (the Pixi logo essence)
  'pixi.js': (g, s, color) => {
    // Stylized pixel grid forming a "spark" or star pattern
    // This evokes the Pixi.js logo's energetic feel
    const px = s * 0.2 // pixel size

    // Center cross
    g.rect(-px * 0.5, -px * 2.5, px, px * 5)
    g.fill({ color, alpha: 0.9 })
    g.rect(-px * 2.5, -px * 0.5, px * 5, px)
    g.fill({ color, alpha: 0.9 })

    // Diagonal pixels (spark effect)
    g.rect(-px * 1.5, -px * 1.5, px, px)
    g.fill({ color, alpha: 0.8 })
    g.rect(px * 0.5, -px * 1.5, px, px)
    g.fill({ color, alpha: 0.8 })
    g.rect(-px * 1.5, px * 0.5, px, px)
    g.fill({ color, alpha: 0.8 })
    g.rect(px * 0.5, px * 0.5, px, px)
    g.fill({ color, alpha: 0.8 })

    // Outer glow pixels
    g.rect(-px * 2.5, -px * 2.5, px, px)
    g.fill({ color, alpha: 0.5 })
    g.rect(px * 1.5, -px * 2.5, px, px)
    g.fill({ color, alpha: 0.5 })
    g.rect(-px * 2.5, px * 1.5, px, px)
    g.fill({ color, alpha: 0.5 })
    g.rect(px * 1.5, px * 1.5, px, px)
    g.fill({ color, alpha: 0.5 })
  },

  // phaser: A shooting star / comet (game framework speed)
  phaser: (g, s, color) => {
    // Comet head
    g.circle(s * 0.4, -s * 0.3, s * 0.3)
    g.fill({ color, alpha: 0.9 })

    // Comet tail (trailing lines)
    g.moveTo(s * 0.2, -s * 0.15)
    g.quadraticCurveTo(-s * 0.2, s * 0.1, -s * 0.9, s * 0.6)
    g.stroke({ color, width: 3, alpha: 0.8 })

    g.moveTo(s * 0.15, -s * 0.35)
    g.quadraticCurveTo(-s * 0.3, 0, -s * 0.7, s * 0.4)
    g.stroke({ color, width: 2, alpha: 0.6 })

    g.moveTo(s * 0.35, -s * 0.55)
    g.quadraticCurveTo(0, -s * 0.2, -s * 0.5, s * 0.2)
    g.stroke({ color, width: 1.5, alpha: 0.4 })

    // Speed lines
    g.moveTo(s * 0.7, -s * 0.5)
    g.lineTo(s * 0.9, -s * 0.7)
    g.stroke({ color, width: 1.5, alpha: 0.6 })

    g.moveTo(s * 0.6, -s * 0.1)
    g.lineTo(s * 0.85, -s * 0.15)
    g.stroke({ color, width: 1.5, alpha: 0.5 })
  },

  // three: 3D cube wireframe (three.js)
  three: (g, s, color) => {
    const d = s * 0.5 // half-size
    const o = s * 0.25 // offset for 3D effect

    // Back face
    g.moveTo(-d + o, -d - o)
    g.lineTo(d + o, -d - o)
    g.lineTo(d + o, d - o)
    g.lineTo(-d + o, d - o)
    g.closePath()
    g.stroke({ color, width: 1.5, alpha: 0.5 })

    // Front face
    g.moveTo(-d, -d)
    g.lineTo(d, -d)
    g.lineTo(d, d)
    g.lineTo(-d, d)
    g.closePath()
    g.stroke({ color, width: 2 })

    // Connecting edges
    g.moveTo(-d, -d)
    g.lineTo(-d + o, -d - o)
    g.stroke({ color, width: 1.5, alpha: 0.7 })

    g.moveTo(d, -d)
    g.lineTo(d + o, -d - o)
    g.stroke({ color, width: 1.5, alpha: 0.7 })

    g.moveTo(d, d)
    g.lineTo(d + o, d - o)
    g.stroke({ color, width: 1.5, alpha: 0.7 })

    g.moveTo(-d, d)
    g.lineTo(-d + o, d - o)
    g.stroke({ color, width: 1.5, alpha: 0.7 })
  },
}
