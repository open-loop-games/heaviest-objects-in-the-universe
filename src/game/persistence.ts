// Save/Load persistence layer

import type { Package, Wire, PackageState, InternalState } from './types'
import { SAVE_VERSION } from './config'
import { gameState, syncEcosystemTier } from './state'

const STORAGE_KEY = 'heaviest-objects-save'
const AUTO_SAVE_INTERVAL = 30000 // 30 seconds

let autoSaveIntervalId: ReturnType<typeof setInterval> | null = null

/**
 * Serialize a package's internal Maps for saving
 */
function serializePackageForSave(pkg: Package): Record<string, unknown> {
  const serialized: Record<string, unknown> = { ...pkg }

  // Serialize internal packages recursively
  if (pkg.internalPackages) {
    serialized.internalPackages = Array.from(
      pkg.internalPackages.entries()
    ).map(([id, innerPkg]) => [id, serializePackageForSave(innerPkg)])
  }

  // Serialize internal wires
  if (pkg.internalWires) {
    serialized.internalWires = Array.from(pkg.internalWires.entries())
  }

  return serialized
}

/**
 * Validate and provide defaults for a package loaded from save.
 * Returns null if the data is too corrupted to recover.
 */
function validatePackage(data: Record<string, unknown>): Package | null {
  // Required fields that must exist
  if (typeof data.id !== 'string' || data.id === '') {
    console.warn('Package missing required id field')
    return null
  }

  // Build a validated package with defaults for missing optional fields
  const pkg: Package = {
    // Required fields
    id: data.id,

    // Fields with sensible defaults
    parentId: typeof data.parentId === 'string' ? data.parentId : null,
    position: isValidPosition(data.position)
      ? (data.position as Package['position'])
      : { x: 0, y: 0 },
    velocity: isValidVelocity(data.velocity)
      ? (data.velocity as Package['velocity'])
      : { vx: 0, vy: 0 },
    state: isValidPackageState(data.state)
      ? (data.state as PackageState)
      : 'ready',
    size: typeof data.size === 'number' && data.size >= 0 ? data.size : 10,
    depth: typeof data.depth === 'number' && data.depth >= 0 ? data.depth : 0,
    children: Array.isArray(data.children)
      ? data.children.filter((c): c is string => typeof c === 'string')
      : [],
    installProgress:
      typeof data.installProgress === 'number' ? data.installProgress : 1,
    conflictProgress:
      typeof data.conflictProgress === 'number' ? data.conflictProgress : 0,
    identity: data.identity as Package['identity'], // PackageIdentity or undefined

    // Scope system fields (null for inner deps)
    internalPackages: null, // Restored separately
    internalWires: null, // Restored separately
    internalState: isValidInternalState(data.internalState)
      ? (data.internalState as InternalState)
      : null,

    // Ghost status
    isGhost: typeof data.isGhost === 'boolean' ? data.isGhost : false,
    ghostTargetId:
      typeof data.ghostTargetId === 'string' ? data.ghostTargetId : null,
    ghostTargetScope:
      typeof data.ghostTargetScope === 'string' ? data.ghostTargetScope : null,

    // Depth rewards
    isGolden: typeof data.isGolden === 'boolean' ? data.isGolden : false,
    hasCacheFragment:
      typeof data.hasCacheFragment === 'boolean'
        ? data.hasCacheFragment
        : false,
  }

  return pkg
}

function isValidPosition(pos: unknown): boolean {
  return (
    typeof pos === 'object' &&
    pos !== null &&
    typeof (pos as Record<string, unknown>).x === 'number' &&
    typeof (pos as Record<string, unknown>).y === 'number'
  )
}

function isValidVelocity(vel: unknown): boolean {
  return (
    typeof vel === 'object' &&
    vel !== null &&
    typeof (vel as Record<string, unknown>).vx === 'number' &&
    typeof (vel as Record<string, unknown>).vy === 'number'
  )
}

function isValidPackageState(state: unknown): boolean {
  return (
    state === 'installing' ||
    state === 'ready' ||
    state === 'conflict' ||
    state === 'optimized'
  )
}

function isValidInternalState(state: unknown): boolean {
  return (
    state === null ||
    state === 'pristine' ||
    state === 'unstable' ||
    state === 'stable'
  )
}

/**
 * Deserialize a package's internal Maps when loading.
 * Validates all fields and provides defaults for missing ones.
 */
function deserializePackageFromSave(
  data: Record<string, unknown>
): Package | null {
  // Validate and build the package with defaults
  const pkg = validatePackage(data)
  if (!pkg) {
    return null
  }

  // Restore internal packages recursively
  if (data.internalPackages && Array.isArray(data.internalPackages)) {
    const internalMap = new Map<string, Package>()
    for (const entry of data.internalPackages) {
      if (!Array.isArray(entry) || entry.length !== 2) continue
      const [id, innerData] = entry as [unknown, unknown]
      if (typeof id !== 'string') continue
      if (typeof innerData !== 'object' || innerData === null) continue

      const innerPkg = deserializePackageFromSave(
        innerData as Record<string, unknown>
      )
      if (innerPkg) {
        internalMap.set(id, innerPkg)
      }
    }
    pkg.internalPackages = internalMap.size > 0 ? internalMap : null
  }

  // Restore internal wires with validation
  if (data.internalWires && Array.isArray(data.internalWires)) {
    const wireMap = new Map<string, Wire>()
    for (const entry of data.internalWires) {
      if (!Array.isArray(entry) || entry.length !== 2) continue
      const [id, wireData] = entry as [unknown, unknown]
      if (typeof id !== 'string') continue
      if (typeof wireData !== 'object' || wireData === null) continue

      const wire = validateWire(wireData as Record<string, unknown>)
      if (wire) {
        wireMap.set(id, wire)
      }
    }
    pkg.internalWires = wireMap.size > 0 ? wireMap : null
  }

  // If we have internal packages, ensure internalState is set
  if (pkg.internalPackages && pkg.internalPackages.size > 0) {
    if (!pkg.internalState) {
      pkg.internalState = 'stable' // Default to stable for loaded scopes
    }
  }

  return pkg
}

/**
 * Validate a wire loaded from save
 */
function validateWire(data: Record<string, unknown>): Wire | null {
  if (typeof data.id !== 'string' || data.id === '') return null
  if (typeof data.fromId !== 'string') return null
  if (typeof data.toId !== 'string') return null

  return {
    id: data.id,
    fromId: data.fromId,
    toId: data.toId,
    wireType:
      data.wireType === 'dependency' ||
      data.wireType === 'symlink' ||
      data.wireType === 'sibling'
        ? data.wireType
        : 'dependency',
    flowProgress: typeof data.flowProgress === 'number' ? data.flowProgress : 0,
    conflicted: typeof data.conflicted === 'boolean' ? data.conflicted : false,
    conflictTime: typeof data.conflictTime === 'number' ? data.conflictTime : 0,
  }
}

/**
 * Migrate game state to ensure all required fields exist
 * Called after loading a save to handle backwards compatibility
 */
function migrateGameState(): void {
  // Ensure surge upgrade level exists
  if (gameState.upgrades.surgeLevel === undefined) {
    gameState.upgrades.surgeLevel = 0
  }

  // Ensure surge state exists
  if (!gameState.surge) {
    ;(gameState as Record<string, unknown>).surge = {
      chargedSegments: 0,
      unlockedSegments: 1 + gameState.upgrades.surgeLevel,
    }
  }

  // Ensure surge state has all fields
  if (gameState.surge.chargedSegments === undefined) {
    gameState.surge.chargedSegments = 0
  }
  if (gameState.surge.unlockedSegments === undefined) {
    gameState.surge.unlockedSegments = 1 + gameState.upgrades.surgeLevel
  }
}

export function saveGame(): string {
  const saveData = {
    version: SAVE_VERSION,
    ...gameState,
    packages: Array.from(gameState.packages.entries()).map(([id, pkg]) => [
      id,
      serializePackageForSave(pkg),
    ]),
    wires: Array.from(gameState.wires.entries()),
  }
  return JSON.stringify(saveData)
}

export function loadGame(saveString: string): boolean {
  try {
    const data = JSON.parse(saveString)

    // Check save version - force reset if incompatible
    if (!data.version || data.version < SAVE_VERSION) {
      console.warn(
        `Save version ${data.version || 'unknown'} is incompatible with current version ${SAVE_VERSION}. Resetting.`
      )
      return false
    }

    // Validate packages array exists
    if (!Array.isArray(data.packages)) {
      console.warn('Save data missing packages array')
      return false
    }

    // Restore packages with internal Maps, filtering out invalid ones
    const packageMap = new Map<string, Package>()
    let skippedPackages = 0

    for (const entry of data.packages) {
      if (!Array.isArray(entry) || entry.length !== 2) {
        skippedPackages++
        continue
      }
      const [id, pkgData] = entry as [unknown, unknown]
      if (typeof id !== 'string') {
        skippedPackages++
        continue
      }
      if (typeof pkgData !== 'object' || pkgData === null) {
        skippedPackages++
        continue
      }

      const pkg = deserializePackageFromSave(pkgData as Record<string, unknown>)
      if (pkg) {
        packageMap.set(id, pkg)
      } else {
        skippedPackages++
      }
    }

    if (skippedPackages > 0) {
      console.warn(`Skipped ${skippedPackages} invalid packages during load`)
    }

    data.packages = packageMap

    // Validate and restore wires, filtering out invalid ones
    if (Array.isArray(data.wires)) {
      const wireMap = new Map<string, Wire>()
      for (const entry of data.wires) {
        if (!Array.isArray(entry) || entry.length !== 2) continue
        const [id, wireData] = entry as [unknown, unknown]
        if (typeof id !== 'string') continue
        if (typeof wireData !== 'object' || wireData === null) continue

        const wire = validateWire(wireData as Record<string, unknown>)
        if (wire) {
          wireMap.set(id, wire)
        }
      }
      data.wires = wireMap
    } else {
      data.wires = new Map()
    }

    // Remove version from data before assigning (not part of GameState)
    delete data.version

    Object.assign(gameState, data)

    // Migrate missing fields for backwards compatibility
    migrateGameState()

    // Sync derived values after loading
    syncEcosystemTier()

    return true
  } catch (e) {
    console.warn('Failed to parse save data:', e)
    return false
  }
}

// localStorage wrappers
export function saveToLocalStorage(): boolean {
  try {
    const saveString = saveGame()
    localStorage.setItem(STORAGE_KEY, saveString)
    return true
  } catch (e) {
    console.warn('Failed to save game:', e)
    return false
  }
}

export function loadFromLocalStorage(): boolean {
  try {
    const saveString = localStorage.getItem(STORAGE_KEY)
    if (!saveString) return false
    return loadGame(saveString)
  } catch (e) {
    console.warn('Failed to load game:', e)
    return false
  }
}

export function hasSavedGame(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null
}

export function clearSavedGame(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function startAutoSave(): void {
  if (autoSaveIntervalId) return
  autoSaveIntervalId = setInterval(() => {
    saveToLocalStorage()
  }, AUTO_SAVE_INTERVAL)
}

export function stopAutoSave(): void {
  if (autoSaveIntervalId) {
    clearInterval(autoSaveIntervalId)
    autoSaveIntervalId = null
  }
}
