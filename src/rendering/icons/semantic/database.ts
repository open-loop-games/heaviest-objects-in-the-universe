// Database and ORM package icons
import { Graphics } from 'pixi.js'
import { drawDatabaseCylinder } from '../primitives'

export const DATABASE_ICONS: Record<string, (g: Graphics, s: number, color: number) => void> = {
  // mongoose: Mongoose animal silhouette
  'mongoose': (g, s, color) => {
    // Body (elongated oval)
    g.ellipse(0, s * 0.1, s * 0.7, s * 0.35)
    g.fill({ color, alpha: 0.8 })

    // Head
    g.ellipse(-s * 0.6, -s * 0.15, s * 0.3, s * 0.25)
    g.fill({ color, alpha: 0.85 })

    // Snout
    g.ellipse(-s * 0.85, -s * 0.1, s * 0.15, s * 0.1)
    g.fill({ color, alpha: 0.9 })

    // Eye
    g.circle(-s * 0.55, -s * 0.25, s * 0.06)
    g.fill({ color: 0x1a1a2e, alpha: 0.9 })

    // Ear
    g.ellipse(-s * 0.45, -s * 0.4, s * 0.1, s * 0.12)
    g.fill({ color, alpha: 0.9 })

    // Tail (curved up)
    g.moveTo(s * 0.6, s * 0.1)
    g.quadraticCurveTo(s * 0.9, 0, s * 0.85, -s * 0.4)
    g.quadraticCurveTo(s * 0.8, -s * 0.6, s * 0.6, -s * 0.5)
    g.quadraticCurveTo(s * 0.7, -s * 0.3, s * 0.65, 0)
    g.closePath()
    g.fill({ color, alpha: 0.85 })

    // Legs (simplified)
    g.ellipse(-s * 0.3, s * 0.45, s * 0.1, s * 0.15)
    g.ellipse(s * 0.2, s * 0.45, s * 0.1, s * 0.15)
    g.fill({ color, alpha: 0.75 })
  },

  // knex: Database with query lines
  'knex': (g, s, color) => {
    drawDatabaseCylinder(g, s * 0.8, color)

    // Query lines coming out
    g.moveTo(s * 0.3, -s * 0.3)
    g.lineTo(s * 0.9, -s * 0.6)
    g.moveTo(s * 0.3, 0)
    g.lineTo(s * 0.9, 0)
    g.moveTo(s * 0.3, s * 0.3)
    g.lineTo(s * 0.9, s * 0.6)
    g.stroke({ color, width: 2 })
  },

  // typeorm: Type symbol + database
  'typeorm': (g, s, color) => {
    // Simplified database cylinder
    g.ellipse(0, -s * 0.3, s * 0.5, s * 0.2)
    g.fill({ color, alpha: 0.7 })
    g.rect(-s * 0.5, -s * 0.3, s, s * 0.6)
    g.fill({ color, alpha: 0.6 })
    g.ellipse(0, s * 0.3, s * 0.5, s * 0.2)
    g.fill({ color, alpha: 0.5 })
    g.stroke({ color, width: 1.5 })

    // "T" for Type overlaid
    g.moveTo(-s * 0.35, -s * 0.6)
    g.lineTo(s * 0.35, -s * 0.6)
    g.moveTo(0, -s * 0.6)
    g.lineTo(0, s * 0.1)
    g.stroke({ color: 0xffffff, width: 3 })
  },

  // pg / postgres: Elephant simplified
  'pg': (g, s, color) => {
    // Elephant head shape
    g.ellipse(0, 0, s * 0.7, s * 0.6)
    g.fill({ color, alpha: 0.8 })
    // Trunk
    g.moveTo(-s * 0.5, s * 0.2)
    g.quadraticCurveTo(-s * 0.8, s * 0.5, -s * 0.6, s * 0.8)
    g.quadraticCurveTo(-s * 0.4, s * 0.9, -s * 0.3, s * 0.6)
    g.quadraticCurveTo(-s * 0.4, s * 0.3, -s * 0.3, s * 0.2)
    g.fill({ color, alpha: 0.75 })
    // Ear
    g.ellipse(s * 0.4, -s * 0.1, s * 0.35, s * 0.45)
    g.fill({ color, alpha: 0.7 })
    // Eye
    g.circle(-s * 0.1, -s * 0.15, s * 0.12)
    g.fill({ color: 0x1a1a2e, alpha: 0.8 })
  },

  // redis: Diamond/gem shape
  'redis': (g, s, color) => {
    // Stacked diamond shape
    g.poly([0, -s * 0.9, s * 0.8, 0, 0, s * 0.9, -s * 0.8, 0], true)
    g.fill({ color, alpha: 0.8 })
    g.stroke({ color, width: 2 })
    // Internal facets
    g.moveTo(0, -s * 0.9)
    g.lineTo(0, s * 0.9)
    g.moveTo(-s * 0.8, 0)
    g.lineTo(s * 0.8, 0)
    g.stroke({ color: 0x1a1a2e, width: 1, alpha: 0.4 })
  },
}
