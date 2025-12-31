// CLI and terminal utility icons
import { Graphics } from 'pixi.js'
import { drawBubbleOutline, drawQuestionMarkShape } from '../primitives'

export const CLI_ICONS: Record<
  string,
  (g: Graphics, s: number, color: number) => void
> = {
  // commander: Military chevrons/stripes
  commander: (g, s, color) => {
    for (let i = 0; i < 3; i++) {
      const y = -s * 0.5 + i * s * 0.45
      g.moveTo(-s * 0.7, y)
      g.lineTo(0, y + s * 0.35)
      g.lineTo(s * 0.7, y)
      g.stroke({ color, width: 3 })
    }
  },

  // yargs: Pirate flag / Jolly Roger (yarrrgs!)
  yargs: (g, s, color) => {
    // Flag pole
    g.rect(-s * 0.8, -s, s * 0.1, s * 2)
    g.fill({ color, alpha: 0.7 })

    // Flag
    g.rect(-s * 0.7, -s, s * 1.4, s * 0.9)
    g.fill({ color, alpha: 0.8 })
    g.stroke({ color, width: 2 })

    // Skull (simplified)
    g.circle(0, -s * 0.55, s * 0.25)
    g.fill({ color: 0x1a1a2e, alpha: 0.9 })

    // Crossbones
    g.moveTo(-s * 0.35, -s * 0.2)
    g.lineTo(s * 0.35, -s * 0.5)
    g.moveTo(s * 0.35, -s * 0.2)
    g.lineTo(-s * 0.35, -s * 0.5)
    g.stroke({ color: 0x1a1a2e, width: 2 })
  },

  // inquirer/prompts: Question mark in speech bubble
  inquirer: (g, s, color) => {
    drawBubbleOutline(g, s, color)
    drawQuestionMarkShape(g, s * 0.5, color)
  },

  // prompts: Text input cursor/caret (lightweight prompts)
  prompts: (g, s, color) => {
    // Input field outline
    g.roundRect(-s * 0.9, -s * 0.35, s * 1.8, s * 0.7, s * 0.1)
    g.stroke({ color, width: 2 })

    // Typed text (dots representing characters)
    g.circle(-s * 0.55, 0, s * 0.08)
    g.circle(-s * 0.25, 0, s * 0.08)
    g.circle(s * 0.05, 0, s * 0.08)
    g.fill({ color, alpha: 0.6 })

    // Blinking cursor (tall line)
    g.rect(s * 0.35, -s * 0.25, s * 0.08, s * 0.5)
    g.fill({ color, alpha: 0.9 })

    // Prompt indicator (chevron)
    g.moveTo(-s * 0.85, -s * 0.65)
    g.lineTo(-s * 0.6, -s * 0.5)
    g.lineTo(-s * 0.85, -s * 0.35)
    g.stroke({ color, width: 2 })
  },

  // ora: Spinning circle/loading indicator
  ora: (g, s, color) => {
    // Partial circle (spinner)
    g.arc(0, 0, s * 0.7, 0, Math.PI * 1.5, false)
    g.stroke({ color, width: 3 })

    // Dots at intervals showing motion
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI) / 2
      const alpha = 0.3 + i * 0.3
      g.circle(Math.cos(angle) * s * 0.7, Math.sin(angle) * s * 0.7, s * 0.1)
      g.fill({ color, alpha })
    }

    // Main dot (brightest)
    g.circle(0, -s * 0.7, s * 0.15)
    g.fill({ color, alpha: 1 })
  },

  // dotenv: Dots in a pattern (environment variables)
  dotenv: (g, s, color) => {
    // Envelope/file shape
    g.roundRect(-s * 0.8, -s * 0.6, s * 1.6, s * 1.2, s * 0.1)
    g.stroke({ color, width: 2 })

    // Dots pattern inside
    const dotPositions: [number, number][] = [
      [-s * 0.45, -s * 0.25],
      [0, -s * 0.25],
      [s * 0.45, -s * 0.25],
      [-s * 0.45, s * 0.15],
      [0, s * 0.15],
      [s * 0.45, s * 0.15],
    ]
    for (const [x, y] of dotPositions) {
      g.circle(x, y, s * 0.12)
      g.fill({ color, alpha: 0.8 })
    }
  },

  // nanoid: Tiny unique snowflake (nano + unique id)
  nanoid: (g, s, color) => {
    // Small central hexagon
    const innerPoints: number[] = []
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3
      innerPoints.push(Math.cos(angle) * s * 0.25, Math.sin(angle) * s * 0.25)
    }
    g.poly(innerPoints, true)
    g.fill({ color, alpha: 0.9 })

    // Radiating lines with ticks
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3
      g.moveTo(Math.cos(angle) * s * 0.3, Math.sin(angle) * s * 0.3)
      g.lineTo(Math.cos(angle) * s * 0.8, Math.sin(angle) * s * 0.8)
      const perpAngle = angle + Math.PI / 2
      const midX = Math.cos(angle) * s * 0.55
      const midY = Math.sin(angle) * s * 0.55
      g.moveTo(
        midX + Math.cos(perpAngle) * s * 0.15,
        midY + Math.sin(perpAngle) * s * 0.15
      )
      g.lineTo(
        midX - Math.cos(perpAngle) * s * 0.15,
        midY - Math.sin(perpAngle) * s * 0.15
      )
    }
    g.stroke({ color, width: 1.5 })
  },

  // minimist: Minimal dashes (argument parsing)
  minimist: (g, s, color) => {
    // Two dashes (like --flag)
    g.moveTo(-s * 0.7, -s * 0.2)
    g.lineTo(-s * 0.1, -s * 0.2)
    g.moveTo(-s * 0.7, s * 0.2)
    g.lineTo(-s * 0.1, s * 0.2)
    g.stroke({ color, width: 3 })
    // Short content after
    g.roundRect(s * 0.1, -s * 0.35, s * 0.6, s * 0.7, s * 0.1)
    g.fill({ color, alpha: 0.6 })
  },
}
