// Validation library icons - schema enforcers
import { Graphics } from 'pixi.js'
import { drawShieldOutline, drawCheckmarkShape } from '../primitives'

export const VALIDATION_ICONS: Record<
  string,
  (g: Graphics, s: number, color: number) => void
> = {
  // yup: Thumbs up gesture - validation approved!
  yup: (g, s, color) => {
    // Thumb (pointing up)
    g.roundRect(-s * 0.15, -s * 0.9, s * 0.3, s * 0.7, s * 0.1)
    g.fill({ color, alpha: 0.9 })

    // Fist/palm base
    g.roundRect(-s * 0.5, -s * 0.25, s * 1, s * 0.6, s * 0.15)
    g.fill({ color, alpha: 0.85 })

    // Knuckle lines
    g.moveTo(-s * 0.25, -s * 0.1)
    g.lineTo(-s * 0.25, s * 0.2)
    g.moveTo(s * 0.05, -s * 0.1)
    g.lineTo(s * 0.05, s * 0.2)
    g.moveTo(s * 0.3, -s * 0.1)
    g.lineTo(s * 0.3, s * 0.2)
    g.stroke({ color: 0x1a1a2e, width: 1.5, alpha: 0.5 })

    // Wrist
    g.roundRect(-s * 0.35, s * 0.35, s * 0.7, s * 0.4, s * 0.1)
    g.fill({ color, alpha: 0.8 })
  },

  // joi: Smiley face - the JOI of validation
  joi: (g, s, color) => {
    // Face circle
    g.circle(0, 0, s * 0.9)
    g.fill({ color, alpha: 0.8 })
    g.stroke({ color, width: 2 })

    // Eyes
    g.circle(-s * 0.35, -s * 0.2, s * 0.15)
    g.circle(s * 0.35, -s * 0.2, s * 0.15)
    g.fill({ color: 0x1a1a2e, alpha: 0.9 })

    // Smile
    g.arc(0, s * 0.1, s * 0.45, 0.2, Math.PI - 0.2, false)
    g.stroke({ color: 0x1a1a2e, width: 2.5 })
  },

  // ajv: Shield with checkmark - Another JSON Validator
  ajv: (g, s, color) => {
    drawShieldOutline(g, s, color, true)
    drawCheckmarkShape(g, s * 0.6, 0x1a1a2e, 3)
  },

  // superstruct: Stacked blocks (structure)
  superstruct: (g, s, color) => {
    // Three stacked rectangles
    g.roundRect(-s * 0.6, -s * 0.8, s * 1.2, s * 0.45, s * 0.08)
    g.fill({ color, alpha: 0.9 })
    g.roundRect(-s * 0.6, -s * 0.25, s * 1.2, s * 0.45, s * 0.08)
    g.fill({ color, alpha: 0.75 })
    g.roundRect(-s * 0.6, s * 0.3, s * 1.2, s * 0.45, s * 0.08)
    g.fill({ color, alpha: 0.6 })
    g.stroke({ color, width: 1.5 })
  },
}
