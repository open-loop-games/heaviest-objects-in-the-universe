// Save/Load persistence layer

import type { Package, Wire, PackageState, InternalState } from './types'
import { SAVE_VERSION } from './config'
import { gameState, syncEcosystemTier, userSettings } from './state'

const STORAGE_KEY = 'heaviest-objects-save'
const SETTINGS_KEY = 'heaviest-objects-settings'
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

  // Check if this package is a compressed package (has internal scope)
  // A package with internalState set OR with internal arrays in save data is compressed
  const isCompressedPackage =
    pkg.internalState !== null ||
    Array.isArray(data.internalPackages) ||
    Array.isArray(data.internalWires)

  // Restore internal packages recursively
  const internalMap = new Map<string, Package>()
  if (data.internalPackages && Array.isArray(data.internalPackages)) {
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
  }

  // Restore internal wires with validation
  const wireMap = new Map<string, Wire>()
  if (data.internalWires && Array.isArray(data.internalWires)) {
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
  }

  // Preserve empty Maps for compressed packages (pristine state before first entry)
  // Only set to null for non-compressed packages (leaf nodes)
  if (isCompressedPackage) {
    pkg.internalPackages = internalMap
    pkg.internalWires = wireMap
    // Ensure internalState is set for compressed packages
    if (!pkg.internalState) {
      pkg.internalState = internalMap.size > 0 ? 'stable' : 'pristine'
    }
  } else {
    pkg.internalPackages = null
    pkg.internalWires = null
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
 * Reset transient state that shouldn't persist across sessions.
 * Cascades and active automation are in-progress operations that
 * can't meaningfully resume after a load.
 */
function resetTransientState(): void {
  // Reset cascade state - can't resume mid-cascade after load
  // (compressedIndices is a Set which doesn't serialize, and timing would be wrong)
  gameState.cascade = {
    active: false,
    scopePackageId: null,
    pendingSpawns: [],
    lastSpawnTime: 0,
    spawnInterval: 100,
    guaranteedCrits: gameState.cascade.guaranteedCrits ?? 0, // Preserve earned crits
    scopePath: null,
    subDepQueue: null,
    compressedIndices: null,
    surgeGoldenBoost: 0,
    surgeFragmentBoost: 0,
    // Tutorial pacing fields
    isStarterKit: false,
    isSecondPackage: false,
    isThirdPackage: false,
    isReactDom: false,
    deferConflicts: false,
    breathPhase: false,
    breathStartTime: 0,
  }

  // Reset active automation state (preserve toggle settings)
  gameState.automation.resolveActive = false
  gameState.automation.resolveTargetWireId = null
  gameState.automation.resolveTargetScope = null
  gameState.automation.processStartTime = 0
}

/**
 * Validate and fix scope state to prevent softlocks.
 * Ensures scopeStack only references packages that exist.
 */
function validateScopeState(): void {
  // Ensure scopeStack is an array
  if (!Array.isArray(gameState.scopeStack)) {
    gameState.scopeStack = []
    gameState.currentScope = 'root'
    return
  }

  // Validate each scope in the stack exists and has internal maps
  const validatedStack: string[] = []
  for (const scopeId of gameState.scopeStack) {
    if (typeof scopeId !== 'string') break

    // First level: check top-level packages
    if (validatedStack.length === 0) {
      const pkg = gameState.packages.get(scopeId)
      if (!pkg || !pkg.internalPackages || !pkg.internalWires) break
      validatedStack.push(scopeId)
    } else {
      // Deeper levels: traverse into internal packages
      let current = gameState.packages.get(validatedStack[0]!)
      for (let i = 1; i < validatedStack.length && current; i++) {
        current = current.internalPackages?.get(validatedStack[i]!) ?? undefined
      }
      const innerPkg = current?.internalPackages?.get(scopeId)
      if (!innerPkg || !innerPkg.internalPackages || !innerPkg.internalWires)
        break
      validatedStack.push(scopeId)
    }
  }

  // Update scope state
  gameState.scopeStack = validatedStack
  gameState.currentScope =
    validatedStack.length > 0
      ? validatedStack[validatedStack.length - 1]!
      : 'root'
}

/**
 * Fix interrupted cascade states.
 * If a scope is 'unstable' but empty/nearly empty (cascade was interrupted),
 * reset to 'pristine' so re-entering triggers a fresh cascade.
 */
function fixInterruptedCascades(pkg: Package): void {
  if (!pkg.internalPackages || !pkg.internalWires) return

  // If unstable but empty, reset to pristine
  if (pkg.internalState === 'unstable' && pkg.internalPackages.size === 0) {
    pkg.internalState = 'pristine'
  }

  // Recursively check nested compressed packages
  for (const innerPkg of pkg.internalPackages.values()) {
    if (innerPkg.internalPackages) {
      fixInterruptedCascades(innerPkg)
    }
  }
}

/**
 * Fix all interrupted cascades in the game state.
 */
function fixAllInterruptedCascades(): void {
  for (const pkg of gameState.packages.values()) {
    if (pkg.internalPackages) {
      fixInterruptedCascades(pkg)
    }
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

    // Reset transient state that can't persist (cascades, active automation)
    resetTransientState()

    // Fix interrupted cascades (empty unstable scopes -> pristine)
    fixAllInterruptedCascades()

    // Validate scope references to prevent softlocks
    validateScopeState()

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
    saveSettings()
    return true
  } catch (e) {
    console.warn('Failed to save game:', e)
    return false
  }
}

export function loadFromLocalStorage(): boolean {
  try {
    loadSettings()
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

// ============================================
// USER SETTINGS PERSISTENCE
// ============================================

export function saveSettings(): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings.value))
  } catch (e) {
    console.warn('Failed to save settings:', e)
  }
}

export function loadSettings(): void {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      userSettings.value = { ...userSettings.value, ...parsed }
    }
  } catch (e) {
    // Ignore invalid settings
  }
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
