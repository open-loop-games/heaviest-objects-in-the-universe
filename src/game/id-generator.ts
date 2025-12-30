// Centralized ID generation for packages and wires

import { gameState } from './state'

let nextId = 0

export function generateId(): string {
  return `pkg_${nextId++}`
}

export function generateWireId(): string {
  return `wire_${nextId++}`
}

/**
 * Initialize ID counter based on existing packages/wires
 * MUST be called after loading a saved game to prevent ID collisions
 */
export function initIdCounterFromState(): void {
  let maxId = 0

  // Check all package IDs (including internal packages)
  function scanPackageIds(packages: Map<string, unknown>): void {
    for (const id of packages.keys()) {
      const match = id.match(/^pkg_(\d+)$/)
      if (match) {
        maxId = Math.max(maxId, parseInt(match[1]!, 10) + 1)
      }
    }
  }

  // Check all wire IDs (including internal wires)
  function scanWireIds(wires: Map<string, unknown>): void {
    for (const id of wires.keys()) {
      const match = id.match(/^wire_(\d+)$/)
      if (match) {
        maxId = Math.max(maxId, parseInt(match[1]!, 10) + 1)
      }
    }
  }

  // Scan main packages and wires
  scanPackageIds(gameState.packages as Map<string, unknown>)
  scanWireIds(gameState.wires as Map<string, unknown>)

  // Scan internal packages and wires
  for (const pkg of gameState.packages.values()) {
    if (pkg.internalPackages) {
      scanPackageIds(pkg.internalPackages as Map<string, unknown>)
    }
    if (pkg.internalWires) {
      scanWireIds(pkg.internalWires as Map<string, unknown>)
    }
  }

  nextId = maxId
}

/**
 * Reset ID counter (for testing or hard reset)
 */
export function resetIdCounter(): void {
  nextId = 0
}
