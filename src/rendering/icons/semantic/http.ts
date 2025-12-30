// HTTP client and networking package icons
import { Graphics } from 'pixi.js'
import { drawLightningShape } from '../primitives'

export const HTTP_ICONS: Record<string, (g: Graphics, s: number, color: number) => void> = {
  // got: Simple arrow pointing right (go get it!)
  'got': (g, s, color) => {
    // Arrow body
    g.roundRect(-s * 0.8, -s * 0.2, s * 1.2, s * 0.4, s * 0.1)
    g.fill({ color, alpha: 0.8 })

    // Arrow head
    g.poly([s * 0.4, -s * 0.5, s * 0.9, 0, s * 0.4, s * 0.5], true)
    g.fill({ color, alpha: 0.9 })
  },

  // node-fetch/cross-fetch: Download arrow from cloud
  'node-fetch': (g, s, color) => {
    // Cloud shape
    g.arc(-s * 0.3, -s * 0.4, s * 0.35, Math.PI, 0, false)
    g.arc(s * 0.2, -s * 0.35, s * 0.4, Math.PI * 1.3, Math.PI * 0.1, false)
    g.arc(s * 0.5, -s * 0.15, s * 0.25, Math.PI * 1.5, Math.PI * 0.5, false)
    g.lineTo(s * 0.5, 0)
    g.lineTo(-s * 0.6, 0)
    g.closePath()
    g.fill({ color, alpha: 0.6 })
    g.stroke({ color, width: 1.5 })

    // Download arrow
    g.moveTo(0, -s * 0.1)
    g.lineTo(0, s * 0.6)
    g.stroke({ color, width: 2.5 })

    g.poly([-s * 0.3, s * 0.4, 0, s * 0.8, s * 0.3, s * 0.4], true)
    g.fill({ color, alpha: 0.9 })
  },

  'cross-fetch': (g, s, color) => {
    // Same as node-fetch
    g.arc(-s * 0.3, -s * 0.4, s * 0.35, Math.PI, 0, false)
    g.arc(s * 0.2, -s * 0.35, s * 0.4, Math.PI * 1.3, Math.PI * 0.1, false)
    g.arc(s * 0.5, -s * 0.15, s * 0.25, Math.PI * 1.5, Math.PI * 0.5, false)
    g.lineTo(s * 0.5, 0)
    g.lineTo(-s * 0.6, 0)
    g.closePath()
    g.fill({ color, alpha: 0.6 })
    g.stroke({ color, width: 1.5 })
    g.moveTo(0, -s * 0.1)
    g.lineTo(0, s * 0.6)
    g.stroke({ color, width: 2.5 })
    g.poly([-s * 0.3, s * 0.4, 0, s * 0.8, s * 0.3, s * 0.4], true)
    g.fill({ color, alpha: 0.9 })
  },

  // superagent: Superhero cape / agent badge
  'superagent': (g, s, color) => {
    // Shield badge
    g.moveTo(0, -s * 0.9)
    g.lineTo(s * 0.7, -s * 0.5)
    g.lineTo(s * 0.6, s * 0.5)
    g.lineTo(0, s * 0.9)
    g.lineTo(-s * 0.6, s * 0.5)
    g.lineTo(-s * 0.7, -s * 0.5)
    g.closePath()
    g.fill({ color, alpha: 0.8 })
    g.stroke({ color, width: 2 })

    // "S" for Super (simplified as lightning bolt)
    drawLightningShape(g, s * 0.4, 0xffffff, true)
  },

  // ky: Simple K shape
  'ky': (g, s, color) => {
    // K letter shape
    g.moveTo(-s * 0.4, -s * 0.8)
    g.lineTo(-s * 0.4, s * 0.8)
    g.stroke({ color, width: 3 })
    g.moveTo(-s * 0.4, 0)
    g.lineTo(s * 0.5, -s * 0.8)
    g.moveTo(-s * 0.4, 0)
    g.lineTo(s * 0.5, s * 0.8)
    g.stroke({ color, width: 3 })
  },

  // undici: Eleven lines (undici = 11 in Italian)
  'undici': (g, s, color) => {
    // Two vertical bars (like Roman numeral II for 11)
    g.rect(-s * 0.5, -s * 0.8, s * 0.3, s * 1.6)
    g.rect(s * 0.2, -s * 0.8, s * 0.3, s * 1.6)
    g.fill({ color, alpha: 0.8 })
    g.stroke({ color, width: 2 })
  },
}
