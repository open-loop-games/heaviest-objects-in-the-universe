// Reusable shape primitives for semantic icons
// Decomposed building blocks for consistent visual language

import { Graphics } from 'pixi.js'

/**
 * Draw a jagged crack line - for legacy/broken/deprecated packages
 */
export function drawCrackLine(
  g: Graphics,
  s: number,
  color: number,
  angle: number = 0
): void {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const transform = (x: number, y: number): [number, number] => [
    x * cos - y * sin,
    x * sin + y * cos,
  ]

  const [x1, y1] = transform(0, -s * 0.8)
  const [x2, y2] = transform(s * 0.15, -s * 0.3)
  const [x3, y3] = transform(-s * 0.1, 0)
  const [x4, y4] = transform(s * 0.2, s * 0.4)
  const [x5, y5] = transform(0, s * 0.8)

  g.moveTo(x1, y1)
  g.lineTo(x2, y2)
  g.lineTo(x3, y3)
  g.lineTo(x4, y4)
  g.lineTo(x5, y5)
  g.stroke({ color, width: 1.5, alpha: 0.7 })
}

/**
 * Draw a lightning bolt - for speed/power packages
 */
export function drawLightningShape(
  g: Graphics,
  s: number,
  color: number,
  filled: boolean = true
): void {
  g.poly(
    [
      s * 0.1,
      -s,
      -s * 0.5,
      s * 0.1,
      s * 0.1,
      s * 0.1,
      -s * 0.1,
      s,
      s * 0.5,
      -s * 0.1,
      -s * 0.1,
      -s * 0.1,
    ],
    true
  )
  if (filled) {
    g.fill({ color, alpha: 0.9 })
  }
  g.stroke({ color, width: 1.5 })
}

/**
 * Draw a checkmark - for validation/success packages
 */
export function drawCheckmarkShape(
  g: Graphics,
  s: number,
  color: number,
  thickness: number = 2.5
): void {
  g.moveTo(-s * 0.6, 0)
  g.lineTo(-s * 0.15, s * 0.5)
  g.lineTo(s * 0.6, -s * 0.4)
  g.stroke({ color, width: thickness })
}

/**
 * Draw an X mark - for rejection/error
 */
export function drawXMarkShape(
  g: Graphics,
  s: number,
  color: number,
  thickness: number = 2
): void {
  g.moveTo(-s * 0.5, -s * 0.5)
  g.lineTo(s * 0.5, s * 0.5)
  g.moveTo(s * 0.5, -s * 0.5)
  g.lineTo(-s * 0.5, s * 0.5)
  g.stroke({ color, width: thickness })
}

/**
 * Draw a question mark - for inquiry/prompt packages
 */
export function drawQuestionMarkShape(
  g: Graphics,
  s: number,
  color: number
): void {
  // Curved part of ?
  g.arc(0, -s * 0.35, s * 0.4, Math.PI, 0, false)
  g.arc(s * 0.15, -s * 0.1, s * 0.25, 0, Math.PI * 0.7, false)
  g.stroke({ color, width: 2.5 })
  // Dot
  g.circle(0, s * 0.5, s * 0.12)
  g.fill({ color, alpha: 0.9 })
}

/**
 * Draw a padlock body - for security/encryption packages
 */
export function drawPadlockShape(
  g: Graphics,
  s: number,
  color: number,
  locked: boolean = true
): void {
  // Lock body
  g.roundRect(-s * 0.5, -s * 0.1, s, s * 0.9, s * 0.1)
  g.fill({ color, alpha: 0.8 })
  g.stroke({ color, width: 2 })
  // Shackle
  if (locked) {
    g.arc(0, -s * 0.1, s * 0.35, Math.PI, 0, false)
  } else {
    g.arc(s * 0.2, -s * 0.1, s * 0.35, Math.PI, 0, false)
  }
  g.stroke({ color, width: 2.5 })
  // Keyhole
  g.circle(0, s * 0.25, s * 0.12)
  g.fill({ color: 0x1a1a2e, alpha: 0.8 })
  g.rect(-s * 0.06, s * 0.25, s * 0.12, s * 0.25)
  g.fill({ color: 0x1a1a2e, alpha: 0.8 })
}

/**
 * Draw a shield outline - for protection packages
 */
export function drawShieldOutline(
  g: Graphics,
  s: number,
  color: number,
  filled: boolean = false
): void {
  g.moveTo(0, -s)
  g.lineTo(s * 0.9, -s * 0.5)
  g.lineTo(s * 0.8, s * 0.5)
  g.lineTo(0, s)
  g.lineTo(-s * 0.8, s * 0.5)
  g.lineTo(-s * 0.9, -s * 0.5)
  g.closePath()
  if (filled) {
    g.fill({ color, alpha: 0.7 })
  }
  g.stroke({ color, width: 2 })
}

/**
 * Draw crossed arrows - for bidirectional/CORS packages
 */
export function drawCrossedArrows(g: Graphics, s: number, color: number): void {
  // Arrow 1: top-left to bottom-right
  g.moveTo(-s * 0.7, -s * 0.7)
  g.lineTo(s * 0.7, s * 0.7)
  g.stroke({ color, width: 2 })
  // Arrowhead 1
  g.poly([s * 0.7, s * 0.7, s * 0.3, s * 0.5, s * 0.5, s * 0.3], true)
  g.fill({ color, alpha: 0.9 })

  // Arrow 2: top-right to bottom-left
  g.moveTo(s * 0.7, -s * 0.7)
  g.lineTo(-s * 0.7, s * 0.7)
  g.stroke({ color, width: 2 })
  // Arrowhead 2
  g.poly([-s * 0.7, s * 0.7, -s * 0.3, s * 0.5, -s * 0.5, s * 0.3], true)
  g.fill({ color, alpha: 0.9 })
}

/**
 * Draw a speech/thought bubble outline
 */
export function drawBubbleOutline(g: Graphics, s: number, color: number): void {
  g.roundRect(-s * 0.8, -s * 0.7, s * 1.6, s * 1.1, s * 0.25)
  g.stroke({ color, width: 2 })
  // Tail
  g.poly([-s * 0.2, s * 0.4, 0, s * 0.9, s * 0.2, s * 0.4], true)
  g.fill({ color, alpha: 0.8 })
}

/**
 * Draw a simple arrow pointing right
 */
export function drawArrowShape(g: Graphics, s: number, color: number): void {
  // Arrow body
  g.roundRect(-s * 0.8, -s * 0.2, s * 1.2, s * 0.4, s * 0.1)
  g.fill({ color, alpha: 0.8 })

  // Arrow head
  g.poly([s * 0.4, -s * 0.5, s * 0.9, 0, s * 0.4, s * 0.5], true)
  g.fill({ color, alpha: 0.9 })
}

/**
 * Draw a database cylinder
 */
export function drawDatabaseCylinder(
  g: Graphics,
  s: number,
  color: number
): void {
  // Top ellipse
  g.ellipse(0, -s * 0.5, s * 0.7, s * 0.25)
  g.fill({ color, alpha: 0.9 })
  g.stroke({ color, width: 2 })

  // Body
  g.rect(-s * 0.7, -s * 0.5, s * 1.4, s * 1)
  g.fill({ color, alpha: 0.8 })

  // Bottom ellipse
  g.ellipse(0, s * 0.5, s * 0.7, s * 0.25)
  g.fill({ color, alpha: 0.7 })
  g.stroke({ color, width: 2 })
}
