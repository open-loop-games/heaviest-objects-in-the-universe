// Color palette for the game (dark theme with neon accents)

export const Colors = {
  // Background
  background: 0x0a0a0f,
  backgroundGradientStart: 0x0a0a0f,
  backgroundGradientEnd: 0x1a1a2f,

  // Node states
  nodeDefault: 0x2a2a3a,
  nodeInstalling: 0x3a3a4a,
  nodeReady: 0x3a4a3a,
  nodeConflict: 0x4a2a2a,
  nodeOptimized: 0x2a4a4a,

  // Node borders
  borderDefault: 0x5a5a7a,
  borderInstalling: 0x7a7aff,
  borderReady: 0x5aff5a,
  borderConflict: 0xff5a5a,
  borderOptimized: 0x5affff,
  borderSelected: 0xffff5a,

  // Version shapes
  shapeCircle: 0x5aff5a,   // Stable - green
  shapeSquare: 0x5a5aff,   // v1.x - blue
  shapeTriangle: 0xffaa5a, // v2.x - orange
  shapeDiamond: 0xff5aff,  // v3.x - purple
  shapeStar: 0xffff5a,     // Rare - gold

  // Wires
  wireDefault: 0x4a4a6a,
  wireFlow: 0x7a7aff,
  wireSymlink: 0x5affff,

  // UI elements
  bandwidthBar: 0x5a5aff,
  bandwidthBarBg: 0x2a2a3a,
  heatBar: 0xff5a5a,
  heatBarBg: 0x2a2a3a,
  weightText: 0xaaaacc,

  // Effects
  particleInstall: 0x7a7aff,
  particleBurst: 0xffaa5a,
  gravityWarp: 0x2a1a3a,

  // Text (for HUD overlay)
  textPrimary: 0xeeeeff,
  textSecondary: 0xaaaacc,
  textWarning: 0xffaa5a,
  textDanger: 0xff5a5a,
} as const;

export type ColorKey = keyof typeof Colors;

// Get color for package state
export function getNodeColor(state: string): number {
  switch (state) {
    case 'installing': return Colors.nodeInstalling;
    case 'ready': return Colors.nodeReady;
    case 'conflict': return Colors.nodeConflict;
    case 'optimized': return Colors.nodeOptimized;
    default: return Colors.nodeDefault;
  }
}

export function getBorderColor(state: string): number {
  switch (state) {
    case 'installing': return Colors.borderInstalling;
    case 'ready': return Colors.borderReady;
    case 'conflict': return Colors.borderConflict;
    case 'optimized': return Colors.borderOptimized;
    default: return Colors.borderDefault;
  }
}

export function getShapeColor(version: string): number {
  switch (version) {
    case 'circle': return Colors.shapeCircle;
    case 'square': return Colors.shapeSquare;
    case 'triangle': return Colors.shapeTriangle;
    case 'diamond': return Colors.shapeDiamond;
    case 'star': return Colors.shapeStar;
    default: return Colors.shapeCircle;
  }
}
