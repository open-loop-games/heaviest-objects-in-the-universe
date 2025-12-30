// Legacy/deprecated package icons - the old guard
import { Graphics } from 'pixi.js'

export const LEGACY_ICONS: Record<
  string,
  (g: Graphics, s: number, color: number) => void
> = {
  // moment: Cracked clock (showing age)
  moment: (g, s, color) => {
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
  },

  // date-fns: Clean calendar grid
  'date-fns': (g, s, color) => {
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
  },

  // request: Arrows out and back (deprecated - X through)
  request: (g, s, color) => {
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
  },

  // underscore: Literal underscore character
  underscore: (g, s, color) => {
    // The iconic underscore _
    g.moveTo(-s * 0.8, s * 0.3)
    g.lineTo(s * 0.8, s * 0.3)
    g.stroke({ color, width: 4 })
    // Small decorative dots above
    g.circle(-s * 0.4, -s * 0.2, s * 0.12)
    g.circle(s * 0.4, -s * 0.2, s * 0.12)
    g.fill({ color, alpha: 0.5 })
  },

  // bluebird: Bird wing silhouette
  bluebird: (g, s, _color) => {
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
  },

  // async: Parallel flow arrows
  async: (g, s, color) => {
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
  },

  // q: The Q promise library - stylized Q
  q: (g, s, color) => {
    // Circle of Q
    g.circle(0, -s * 0.1, s * 0.6)
    g.stroke({ color, width: 3 })
    // Tail of Q
    g.moveTo(s * 0.3, s * 0.3)
    g.lineTo(s * 0.7, s * 0.8)
    g.stroke({ color, width: 3 })
  },

  // coffee-script: Coffee cup
  coffeescript: (g, s, color) => {
    // Cup body
    g.roundRect(-s * 0.5, -s * 0.3, s * 0.9, s * 1, s * 0.15)
    g.fill({ color, alpha: 0.8 })
    g.stroke({ color, width: 2 })
    // Handle
    g.arc(s * 0.4, s * 0.2, s * 0.3, -Math.PI / 2, Math.PI / 2, false)
    g.stroke({ color, width: 2 })
    // Steam
    g.moveTo(-s * 0.2, -s * 0.5)
    g.quadraticCurveTo(-s * 0.3, -s * 0.7, -s * 0.2, -s * 0.9)
    g.moveTo(s * 0.1, -s * 0.5)
    g.quadraticCurveTo(s * 0.2, -s * 0.7, s * 0.1, -s * 0.9)
    g.stroke({ color, width: 1.5, alpha: 0.6 })
  },

  // grunt: Boar/grunt face (simplified)
  grunt: (g, s, color) => {
    // Head
    g.ellipse(0, 0, s * 0.8, s * 0.7)
    g.fill({ color, alpha: 0.8 })
    // Snout
    g.ellipse(0, s * 0.3, s * 0.35, s * 0.25)
    g.fill({ color, alpha: 0.9 })
    // Nostrils
    g.circle(-s * 0.12, s * 0.3, s * 0.08)
    g.circle(s * 0.12, s * 0.3, s * 0.08)
    g.fill({ color: 0x1a1a2e, alpha: 0.7 })
    // Eyes
    g.circle(-s * 0.3, -s * 0.15, s * 0.1)
    g.circle(s * 0.3, -s * 0.15, s * 0.1)
    g.fill({ color: 0x1a1a2e, alpha: 0.8 })
  },
}
