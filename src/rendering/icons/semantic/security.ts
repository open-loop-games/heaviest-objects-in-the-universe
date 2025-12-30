// Security and authentication package icons
import { Graphics } from 'pixi.js'
import { drawPadlockShape, drawCrossedArrows } from '../primitives'

export const SECURITY_ICONS: Record<string, (g: Graphics, s: number, color: number) => void> = {
  // helmet: Viking/safety helmet
  'helmet': (g, s, color) => {
    // Dome
    g.arc(0, 0, s * 0.7, Math.PI, 0, false)
    g.lineTo(s * 0.7, s * 0.3)
    g.lineTo(-s * 0.7, s * 0.3)
    g.closePath()
    g.fill({ color, alpha: 0.8 })
    g.stroke({ color, width: 2 })

    // Face guard / visor
    g.rect(-s * 0.5, s * 0.1, s, s * 0.35)
    g.fill({ color: 0x1a1a2e, alpha: 0.4 })

    // Horns
    g.moveTo(-s * 0.6, -s * 0.2)
    g.quadraticCurveTo(-s * 0.9, -s * 0.6, -s * 0.7, -s * 0.9)
    g.lineTo(-s * 0.5, -s * 0.5)
    g.closePath()
    g.fill({ color, alpha: 0.9 })

    g.moveTo(s * 0.6, -s * 0.2)
    g.quadraticCurveTo(s * 0.9, -s * 0.6, s * 0.7, -s * 0.9)
    g.lineTo(s * 0.5, -s * 0.5)
    g.closePath()
    g.fill({ color, alpha: 0.9 })
  },

  // passport: ID card / passport booklet
  'passport': (g, s, color) => {
    // Passport booklet
    g.roundRect(-s * 0.6, -s * 0.8, s * 1.2, s * 1.6, s * 0.1)
    g.fill({ color, alpha: 0.8 })
    g.stroke({ color, width: 2 })

    // Photo placeholder
    g.rect(-s * 0.35, -s * 0.55, s * 0.7, s * 0.6)
    g.fill({ color: 0x1a1a2e, alpha: 0.4 })

    // Person silhouette in photo
    g.circle(0, -s * 0.4, s * 0.15)
    g.fill({ color: 0x1a1a2e, alpha: 0.6 })
    g.ellipse(0, -s * 0.1, s * 0.2, s * 0.12)
    g.fill({ color: 0x1a1a2e, alpha: 0.6 })

    // Lines (text placeholder)
    g.rect(-s * 0.4, s * 0.2, s * 0.8, s * 0.08)
    g.rect(-s * 0.4, s * 0.4, s * 0.5, s * 0.08)
    g.fill({ color: 0x1a1a2e, alpha: 0.3 })
  },

  // bcrypt: Padlock (encryption)
  'bcrypt': (g, s, color) => {
    drawPadlockShape(g, s, color, true)
  },

  'bcryptjs': (g, s, color) => {
    drawPadlockShape(g, s, color, true)
  },

  // cors: Crossed arrows (Cross-Origin Resource Sharing)
  'cors': (g, s, color) => {
    // Circle representing "origin"
    g.circle(0, 0, s * 0.9)
    g.stroke({ color, width: 2 })
    // Crossed arrows inside
    drawCrossedArrows(g, s * 0.6, color)
  },

  // jwt/jsonwebtoken: Token badge with three parts
  'jsonwebtoken': (g, s, color) => {
    const segmentH = s * 0.5
    const gap = s * 0.08

    // Header (top) - red-ish
    g.roundRect(-s * 0.6, -s * 0.85, s * 1.2, segmentH, s * 0.1)
    g.fill({ color: 0xff6b6b, alpha: 0.8 })

    // Payload (middle) - purple-ish
    g.roundRect(-s * 0.6, -s * 0.85 + segmentH + gap, s * 1.2, segmentH, s * 0.1)
    g.fill({ color: 0xcc5de8, alpha: 0.8 })

    // Signature (bottom) - cyan-ish
    g.roundRect(-s * 0.6, -s * 0.85 + (segmentH + gap) * 2, s * 1.2, segmentH, s * 0.1)
    g.fill({ color: 0x22b8cf, alpha: 0.8 })

    // Dots between sections
    g.circle(0, -s * 0.85 + segmentH + gap / 2, s * 0.06)
    g.circle(0, -s * 0.85 + segmentH * 2 + gap * 1.5, s * 0.06)
    g.fill({ color, alpha: 0.9 })
  },

  'jwt': (g, s, color) => {
    const segmentH = s * 0.5
    const gap = s * 0.08
    g.roundRect(-s * 0.6, -s * 0.85, s * 1.2, segmentH, s * 0.1)
    g.fill({ color: 0xff6b6b, alpha: 0.8 })
    g.roundRect(-s * 0.6, -s * 0.85 + segmentH + gap, s * 1.2, segmentH, s * 0.1)
    g.fill({ color: 0xcc5de8, alpha: 0.8 })
    g.roundRect(-s * 0.6, -s * 0.85 + (segmentH + gap) * 2, s * 1.2, segmentH, s * 0.1)
    g.fill({ color: 0x22b8cf, alpha: 0.8 })
    g.circle(0, -s * 0.85 + segmentH + gap / 2, s * 0.06)
    g.circle(0, -s * 0.85 + segmentH * 2 + gap * 1.5, s * 0.06)
    g.fill({ color, alpha: 0.9 })
  },

  // crypto-js: Lock with binary
  'crypto-js': (g, s, color) => {
    drawPadlockShape(g, s * 0.8, color, true)
    // Binary bits around
    g.circle(-s * 0.7, -s * 0.3, s * 0.08)
    g.circle(-s * 0.7, s * 0.1, s * 0.08)
    g.circle(s * 0.7, -s * 0.3, s * 0.08)
    g.circle(s * 0.7, s * 0.1, s * 0.08)
    g.fill({ color, alpha: 0.5 })
  },
}
