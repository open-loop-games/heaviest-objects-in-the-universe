// Save/Load persistence layer

import type { Package, Wire } from './types'
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
 * Deserialize a package's internal Maps when loading
 */
function deserializePackageFromSave(data: Record<string, unknown>): Package {
  // Cast through unknown to satisfy TypeScript
  const pkg = data as unknown as Package

  // Restore internal packages recursively
  if (data.internalPackages && Array.isArray(data.internalPackages)) {
    pkg.internalPackages = new Map(
      (data.internalPackages as [string, Record<string, unknown>][]).map(
        ([id, innerData]) => [id, deserializePackageFromSave(innerData)]
      )
    )
  }

  // Restore internal wires
  if (data.internalWires && Array.isArray(data.internalWires)) {
    pkg.internalWires = new Map(data.internalWires as [string, Wire][])
  }

  return pkg
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
    hoistedDeps: Array.from(gameState.hoistedDeps.entries()),
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

    // Restore packages with internal Maps
    data.packages = new Map(
      (data.packages as [string, Record<string, unknown>][]).map(
        ([id, pkgData]) => [id, deserializePackageFromSave(pkgData)]
      )
    )

    // Restore wires
    data.wires = new Map(data.wires)

    // Restore hoistedDeps (or create empty Map if not present in save)
    if (data.hoistedDeps && Array.isArray(data.hoistedDeps)) {
      data.hoistedDeps = new Map(data.hoistedDeps)
      // Migration: add ringIndex if missing (old saves)
      for (const [, dep] of data.hoistedDeps) {
        if (dep.ringIndex === undefined) {
          dep.ringIndex = 0
        }
      }
    } else {
      data.hoistedDeps = new Map()
    }

    // Remove version from data before assigning (not part of GameState)
    delete data.version

    Object.assign(gameState, data)

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
