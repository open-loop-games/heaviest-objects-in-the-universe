// Meme package icons - the legends of npm culture
// These packages have earned their place in dev history

import { Graphics } from 'pixi.js'

export const MEME_ICONS: Record<string, (g: Graphics, s: number, color: number) => void> = {
  // left-pad: The 11-liner that broke npm - a padded rectangle
  'left-pad': (g, s, color) => {
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
  },

  // is-odd: Uneven split - the odd one out
  'is-odd': (g, s, color) => {
    g.circle(0, 0, s)
    g.stroke({ color, width: 2 })
    // Off-center divider line
    g.moveTo(s * 0.3, -s)
    g.lineTo(s * 0.3, s)
    g.stroke({ color, width: 2 })
    // Dot on the smaller side
    g.circle(s * 0.6, 0, s * 0.2)
    g.fill({ color, alpha: 0.9 })
  },

  // is-even: Perfect symmetry - balanced
  'is-even': (g, s, color) => {
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
  },

  // is-number: Tally marks / hash symbol
  'is-number': (g, s, color) => {
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
  },

  // zod: "KNEEL BEFORE ZOD!" - General Zod kneeling silhouette
  'zod': (g, s, color) => {
    // Head
    g.circle(0, -s * 0.65, s * 0.25)
    g.fill({ color, alpha: 0.9 })

    // Cape flowing back (the drama!)
    g.moveTo(-s * 0.15, -s * 0.45)
    g.quadraticCurveTo(-s * 0.8, -s * 0.2, -s * 0.9, s * 0.4)
    g.lineTo(-s * 0.5, s * 0.3)
    g.quadraticCurveTo(-s * 0.5, 0, -s * 0.15, -s * 0.2)
    g.closePath()
    g.fill({ color, alpha: 0.7 })

    // Torso
    g.moveTo(-s * 0.2, -s * 0.4)
    g.lineTo(s * 0.2, -s * 0.4)
    g.lineTo(s * 0.25, s * 0.1)
    g.lineTo(-s * 0.2, s * 0.1)
    g.closePath()
    g.fill({ color, alpha: 0.9 })

    // Kneeling leg (front)
    g.moveTo(-s * 0.2, s * 0.1)
    g.lineTo(s * 0.3, s * 0.1)
    g.lineTo(s * 0.5, s * 0.5)
    g.lineTo(s * 0.2, s * 0.8)
    g.lineTo(-s * 0.1, s * 0.5)
    g.closePath()
    g.fill({ color, alpha: 0.85 })

    // Back leg (kneeling)
    g.ellipse(-s * 0.3, s * 0.6, s * 0.25, s * 0.15)
    g.fill({ color, alpha: 0.8 })

    // Arm extended forward (commanding!)
    g.moveTo(s * 0.2, -s * 0.3)
    g.lineTo(s * 0.8, -s * 0.5)
    g.lineTo(s * 0.85, -s * 0.35)
    g.lineTo(s * 0.25, -s * 0.15)
    g.closePath()
    g.fill({ color, alpha: 0.9 })

    // Fist at end of arm
    g.circle(s * 0.85, -s * 0.42, s * 0.12)
    g.fill({ color, alpha: 0.9 })
  },
}
