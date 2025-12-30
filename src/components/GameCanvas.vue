<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, toRaw, inject } from 'vue'
import { getRenderer, destroyRenderer } from '../rendering/renderer'
import {
  startGameLoop,
  stopGameLoop,
  onTick,
  setCameraTarget,
} from '../game/loop'
import { gameState, setActionPreview } from '../game/state'
import { isInPackageScope, getCurrentScopeWires, getCurrentScopeRoot, isPackageCompressed, exitScope } from '../game/scope'
import {
  removePackageWithSubtree,
  removeWire,
  setPrestigeAnimationCallback,
  canAffordConflictResolve,
  getConflictResolveCost,
} from '../game/mutations'
import {
  loadFromLocalStorage,
  saveToLocalStorage,
  startAutoSave,
  stopAutoSave,
} from '../game/persistence'
import {
  createRootPackage,
  installPackage,
  findPackageAtPosition,
  initIdCounterFromState,
  enterPackageScope,
  enterInternalPackageScope,
  recalculateStateAtPath,
  setStableCelebrationCallback,
} from '../game/packages'
import { setSpawnEffectCallback, setCritEffectCallback } from '../game/cascade'
import { getUpgradePath, findIdentityByName } from '../game/registry'
import { getEffectiveInstallCost } from '../game/upgrades'
import {
  hasDuplicates,
  canSymlink,
  performSymlinkMerge,
  getOtherDuplicates,
} from '../game/symlinks'
import {
  getSiblingWires,
  getCrossPackageConflicts,
  canCrossPackageSymlink,
  performCrossPackageSymlink,
  getSharedInternalDeps,
} from '../game/cross-package'
import {
  canHoist,
  isInDropZone,
  getDropZoneDistance,
  hoistDep,
  getHoistedDepForGhost,
  getHoistedDeps,
} from '../game/hoisting'
import {
  setAutoResolveCallback,
  setAutoDedupCallback,
} from '../game/automation'
import type { Package } from '../game/types'
import { Colors } from '../rendering/colors'
import type { ParticleType } from './CausalParticles.vue'

// Inject causal particle spawner from App.vue
const spawnCausalParticle = inject<
  (type: ParticleType, x: number, y: number) => void
>('spawnCausalParticle')

const canvasRef = ref<HTMLCanvasElement | null>(null)
const renderer = getRenderer()

// Track packages for install success detection
let previousPackageStates = new Map<string, string>()

// Conflict resolution state (legacy hold-to-resolve for non-wire conflicts)
let holdingPackage: Package | null = null
let holdStartTime = 0
const HOLD_DURATION = 1500 // 1.5 seconds to resolve

// Wire conflict UI state
const selectedWireId = ref<string | null>(null)
const wireActionPosition = ref<{ x: number; y: number } | null>(null)

// Symlink drag state
let symlinkDragSource: Package | null = null
let symlinkDragStartPos: { x: number; y: number } | null = null
let symlinkDropTarget: Package | null = null
let isDraggingSymlink = false

// Hoist drag state
let hoistDragSource: Package | null = null
let hoistDragStartPos: { x: number; y: number } | null = null
let isInHoistZone = false
let hoistableDepName: string | null = null

// Computed: selected wire data (scope-aware, including sibling wires)
const selectedWire = computed(() => {
  if (!selectedWireId.value) return null
  // Get wire from current scope (outer wires or internal wires)
  const wires = getCurrentScopeWires()
  let wire = wires.get(selectedWireId.value)
  if (wire) return wire

  // Also check sibling wires at root scope
  if (!isInPackageScope()) {
    const siblingWires = getSiblingWires()
    wire = siblingWires.get(selectedWireId.value)
    if (wire) return wire
  }

  return null
})

// Computed: is the selected wire a sibling wire (cross-package conflict)?
const isSiblingWire = computed(() => {
  return selectedWire.value?.wireType === 'sibling'
})

// Computed: can afford prune (conflict resolution)
const canAffordPrune = computed(() => {
  return canAffordConflictResolve()
})

// Computed: can afford upgrade
const canAffordUpgrade = computed(() => {
  return gameState.resources.bandwidth >= getEffectiveInstallCost() * 2
})

// Computed: has upgrade path
const hasUpgradePath = computed(() => {
  if (!selectedWire.value) return false
  const toPkg = gameState.packages.get(selectedWire.value.toId)
  if (!toPkg?.identity) return false
  return !!getUpgradePath(toPkg.identity.name)
})

/**
 * Play first-launch intro animation
 * t=0s: Black canvas
 * t=1s: Subtle ripple at center
 * t=2s: Root node materializes
 * t=3s: Mark intro complete, pulse begins (handled by renderer)
 */
function playIntroAnimation(): void {
  const effects = renderer.getEffectsRenderer()

  // t=1s: Center ripple
  setTimeout(() => {
    effects.spawnRipple(0, 0, Colors.borderInstalling)
  }, 1000)

  // t=2s: Create root package (will have scale animation from renderer)
  setTimeout(() => {
    createRootPackage()
    // Spawn burst at root position
    effects.spawnBurst(0, 0, Colors.borderInstalling)
  }, 2000)

  // t=3s: Mark intro complete (enables root pulse in renderer)
  setTimeout(() => {
    gameState.onboarding.introAnimationComplete = true
  }, 3000)
}

onMounted(async () => {
  if (canvasRef.value) {
    await renderer.init(canvasRef.value)

    // Try to load saved game
    const loaded = loadFromLocalStorage()

    if (!loaded || !gameState.rootId) {
      // Fresh game - play intro animation before creating root
      playIntroAnimation()
    } else {
      // Loaded save - initialize ID counter to prevent collisions
      // This MUST happen before any user interaction can create new packages
      initIdCounterFromState()
      // Mark intro as complete
      gameState.onboarding.introAnimationComplete = true
    }

    // Start game loop and auto-save
    startGameLoop()
    startAutoSave()

    // Set up prestige animation callback
    setPrestigeAnimationCallback(
      // Animation start: trigger black hole collapse
      (onComplete) => {
        renderer.getBlackHoleRenderer().startCollapse(onComplete)
      },
      // After prestige: clear visuals and create new root package
      () => {
        renderer.clearHoistedDeps()
        createRootPackage()
        previousPackageStates.clear()
      }
    )

    // Set up stable celebration callback
    setStableCelebrationCallback((packageId) => {
      const pkg = gameState.packages.get(packageId)
      if (!pkg) return

      const effects = renderer.getEffectsRenderer()
      // Particle burst at package location (green for stable)
      effects.spawnBurst(pkg.position.x, pkg.position.y, Colors.borderReady)
      // Extra celebration ripple
      effects.spawnRipple(pkg.position.x, pkg.position.y, 0x4ade80)

      // If we're inside this package, also spawn particles at center
      if (gameState.currentScope === packageId) {
        effects.spawnBurst(0, 0, 0x4ade80)
        effects.spawnRipple(0, 0, 0x4ade80)
      }
    })

    // Set up cascade spawn effect callback (for staggered spawning)
    setSpawnEffectCallback((position, isConflict) => {
      const effects = renderer.getEffectsRenderer()
      if (isConflict) {
        effects.spawnConflictFlash(position.x, position.y)
      } else {
        effects.spawnBurst(position.x, position.y, Colors.borderInstalling)
        effects.spawnRipple(position.x, position.y, Colors.borderInstalling)
      }
    })

    // Set up crit effect callback (when cascade doubles)
    setCritEffectCallback((count) => {
      const effects = renderer.getEffectsRenderer()
      effects.spawnCrit(count)
    })

    // Set up automation effect callbacks (for auto-resolve and auto-dedup)
    setAutoResolveCallback((_scopePath, position) => {
      const effects = renderer.getEffectsRenderer()
      effects.spawnAutoCompleteEffect(position.x, position.y, 'resolve')
    })

    setAutoDedupCallback((_scopePath, position) => {
      const effects = renderer.getEffectsRenderer()
      effects.spawnAutoCompleteEffect(position.x, position.y, 'dedup')
    })

    // Save on page unload
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Track install completions for particle effects
    onTick(() => {
      const effects = renderer.getEffectsRenderer()
      // Use toRaw() to avoid Vue reactivity tracking in tick callback
      const rawPackages = toRaw(gameState.packages)

      for (const pkg of rawPackages.values()) {
        const prevState = previousPackageStates.get(pkg.id)

        // Detect new package spawning as conflict (no previous state + conflict)
        if (prevState === undefined && pkg.state === 'conflict') {
          effects.spawnConflictFlash(pkg.position.x, pkg.position.y)
        }

        // Detect installing -> ready transition
        if (prevState === 'installing' && pkg.state === 'ready') {
          effects.spawnBurst(pkg.position.x, pkg.position.y, Colors.borderReady)
        }

        // Detect conflict -> ready transition (resolution success)
        if (prevState === 'conflict' && pkg.state === 'ready') {
          effects.spawnBurst(pkg.position.x, pkg.position.y, Colors.shapeCircle)
        }

        previousPackageStates.set(pkg.id, pkg.state)
      }

      // Clean up old entries
      for (const id of previousPackageStates.keys()) {
        if (!rawPackages.has(id)) {
          previousPackageStates.delete(id)
        }
      }
    })

    // Handle mouse interactions
    canvasRef.value.addEventListener('mousedown', handleMouseDown)
    canvasRef.value.addEventListener('mousemove', handleMouseMove)
    canvasRef.value.addEventListener('mouseup', handleMouseUp)
    canvasRef.value.addEventListener('mouseleave', handleMouseUp)

    // Handle resize
    window.addEventListener('resize', handleResize)
  }
})

onUnmounted(() => {
  stopGameLoop()
  stopAutoSave()
  saveToLocalStorage() // Final save on unmount
  destroyRenderer()
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

function handleBeforeUnload() {
  saveToLocalStorage()
}

function getWorldPos(event: MouseEvent): { x: number; y: number } | null {
  if (!canvasRef.value) return null
  const rect = canvasRef.value.getBoundingClientRect()
  const screenX = event.clientX - rect.left
  const screenY = event.clientY - rect.top
  return renderer.screenToWorld(screenX, screenY)
}

function handleMouseDown(event: MouseEvent) {
  // Ignore if shift is held (panning)
  if (event.shiftKey) return
  if (event.button !== 0) return

  const worldPos = getWorldPos(event)
  if (!worldPos) return

  // First check if we clicked on a conflicted wire
  const wireRenderer = renderer.getWireRenderer()
  const clickedWireId = wireRenderer.findWireAtPosition(
    worldPos.x,
    worldPos.y,
    20 / gameState.camera.zoom
  )

  if (clickedWireId) {
    // Get wire from current scope (scope-aware) or sibling wires
    const wires = getCurrentScopeWires()
    let wire = wires.get(clickedWireId)

    // Also check sibling wires at root scope
    if (!wire && !isInPackageScope()) {
      const siblingWires = getSiblingWires()
      wire = siblingWires.get(clickedWireId)
    }

    if (wire && wire.conflicted) {
      // Toggle selection on this wire
      if (selectedWireId.value === clickedWireId) {
        clearWireSelection()
      } else {
        selectConflictedWire(clickedWireId)
      }
      return
    }
  }

  // Clicked elsewhere - clear wire selection
  if (selectedWireId.value) {
    clearWireSelection()
    return
  }

  // Check for package click
  const clickedPkg = findPackageAtPosition(worldPos, 30 / gameState.camera.zoom)

  if (clickedPkg) {
    // Spawn click ripple effect at the visual position
    // When inside a scope, the scope root is rendered at (0,0)
    const effects = renderer.getEffectsRenderer()
    const isClickedScopeRoot =
      isInPackageScope() && clickedPkg.id === gameState.currentScope
    const rippleX = isClickedScopeRoot ? 0 : clickedPkg.position.x
    const rippleY = isClickedScopeRoot ? 0 : clickedPkg.position.y
    effects.spawnRipple(rippleX, rippleY, Colors.borderInstalling)

    if (clickedPkg.state === 'conflict') {
      // Check if this conflict is from a wire (scope-aware)
      const scopeWires = getCurrentScopeWires()
      const conflictedWire = Array.from(toRaw(scopeWires).values()).find(
        (w) =>
          w.conflicted &&
          (w.fromId === clickedPkg.id || w.toId === clickedPkg.id)
      )

      if (conflictedWire) {
        // Select the conflicted wire to show action buttons
        selectConflictedWire(conflictedWire.id)
      } else {
        // Legacy hold-to-resolve for non-wire conflicts
        holdingPackage = clickedPkg
        holdStartTime = Date.now()
        clickedPkg.conflictProgress = 0.01
        updateHoldProgress()
      }
    } else if (clickedPkg.state === 'ready') {
      // Check if this is a duplicate package - start drag for symlink
      if (hasDuplicates(clickedPkg.id)) {
        symlinkDragSource = clickedPkg
        symlinkDragStartPos = { x: worldPos.x, y: worldPos.y }
        isDraggingSymlink = false // Will become true after threshold
        renderer.setSymlinkDragState(clickedPkg.id, null)
        return // Don't install on click for duplicates
      }

      // At root scope: Check if clicking a top-level package
      if (!isInPackageScope() && clickedPkg.parentId === gameState.rootId) {
        // Check if this package can be hoisted (has shared deps across packages)
        // Hoisting replaces the old cross-package symlink system
        const hoistCheck = canHoist(clickedPkg.id)
        if (hoistCheck.canHoist && hoistCheck.depName) {
          hoistDragSource = clickedPkg
          hoistDragStartPos = { x: worldPos.x, y: worldPos.y }
          hoistableDepName = hoistCheck.depName
          isInHoistZone = false
          // Return here - don't enter scope on click
          // Scope entry happens on mouseUp if not dragged to hoist zone
          return
        }

        // Enter this package's internal scope (only if not hoistable)
        if (enterPackageScope(clickedPkg.id)) {
          // Smooth camera transition to center
          setCameraTarget(0, 0)
          return
        }
      }

      // Inside any scope: Check if clicking a compressed internal package to go deeper
      if (isInPackageScope() && isPackageCompressed(clickedPkg)) {
        if (enterInternalPackageScope(clickedPkg.id)) {
          // Smooth camera transition to center
          setCameraTarget(0, 0)
          return
        }
      }

      // When inside a scope, clicking the scope root does nothing
      // (inner scope is for cleanup, not installing)
      if (isInPackageScope() && clickedPkg.id === gameState.currentScope) {
        return // No installing inside packages - that's not how npm works!
      }

      // Only allow installing from root node (package.json) at root scope
      const isRoot = clickedPkg.parentId === null
      if (!isRoot) {
        return // Can only install from root package.json
      }

      // Install new package
      const newPkg = installPackage(clickedPkg.id)
      if (newPkg) {
        // Ripple on the new package spawn point
        effects.spawnRipple(
          newPkg.position.x,
          newPkg.position.y,
          Colors.borderInstalling
        )

        // Spawn causal particles to show what's happening
        if (spawnCausalParticle) {
          // Convert world position to screen position for particles
          const screenPos = renderer.worldToScreen(
            clickedPkg.position.x,
            clickedPkg.position.y
          )

          // Bandwidth cost particle (flies to bandwidth bar)
          spawnCausalParticle('bandwidth-cost', screenPos.x, screenPos.y)

          // Weight gain particle (flies to weight display) - slight delay
          setTimeout(() => {
            spawnCausalParticle('weight-gain', screenPos.x, screenPos.y)
          }, 100)
        }
      }
    }
  } else {
    // Clicked on blank space - go up a layer if in a scope
    if (isInPackageScope()) {
      exitScope()
    }
  }
}

function selectConflictedWire(wireId: string) {
  selectedWireId.value = wireId

  // Get wire midpoint for action buttons
  const endpoints = renderer.getWireRenderer().getWireEndpoints(wireId)
  if (endpoints) {
    // Convert world to screen coords for UI overlay
    const screenPos = renderer.worldToScreen(endpoints.midX, endpoints.midY)
    wireActionPosition.value = screenPos
  }
}

function clearWireSelection() {
  selectedWireId.value = null
  wireActionPosition.value = null
}

/**
 * Recursively remove an internal package and all its descendants
 */
function removeInternalPackageWithSubtree(
  scopePkg: Package,
  packageId: string
): void {
  if (!scopePkg.internalPackages || !scopePkg.internalWires) return

  const pkg = scopePkg.internalPackages.get(packageId)
  if (!pkg) return

  // Recursively remove all children first
  for (const childId of [...pkg.children]) {
    removeInternalPackageWithSubtree(scopePkg, childId)
  }

  // Remove from parent's children list
  if (pkg.parentId && pkg.parentId !== gameState.currentScope) {
    const parent = scopePkg.internalPackages.get(pkg.parentId)
    if (parent) {
      parent.children = parent.children.filter((cid) => cid !== packageId)
    }
  }

  // Remove associated internal wires
  for (const [wireId, wire] of scopePkg.internalWires) {
    if (wire.fromId === packageId || wire.toId === packageId) {
      scopePkg.internalWires.delete(wireId)
    }
  }

  // Remove weight from parent scope and global
  scopePkg.size -= pkg.size
  gameState.resources.weight -= pkg.size

  // Remove the package itself
  scopePkg.internalPackages.delete(packageId)
}

function handlePrune() {
  if (!selectedWire.value) return
  if (!canAffordPrune.value) return

  const wire = selectedWire.value
  const inScope = isInPackageScope()

  // Deduct bandwidth cost for conflict resolution
  gameState.resources.bandwidth -= getConflictResolveCost()

  if (inScope) {
    // Pruning inside a package scope (works at any depth)
    const scopePkg = getCurrentScopeRoot()
    if (!scopePkg?.internalPackages || !scopePkg.internalWires) return

    const childPkg = scopePkg.internalPackages.get(wire.toId)
    if (childPkg) {
      // Visual feedback
      const effects = renderer.getEffectsRenderer()
      effects.spawnBurst(
        childPkg.position.x,
        childPkg.position.y,
        Colors.borderConflict
      )

      // Recursively remove the internal package and all descendants
      removeInternalPackageWithSubtree(scopePkg, wire.toId)
    }

    // Remove the wire itself (in case it wasn't caught by the subtree removal)
    scopePkg.internalWires.delete(wire.id)

    // Recalculate internal state using full scope path
    recalculateStateAtPath([...gameState.scopeStack])
  } else {
    // Pruning at root scope (existing behavior)
    const childPkg = gameState.packages.get(wire.toId)
    if (childPkg) {
      const effects = renderer.getEffectsRenderer()
      effects.spawnBurst(
        childPkg.position.x,
        childPkg.position.y,
        Colors.borderConflict
      )
      removePackageWithSubtree(wire.toId)
    }
    removeWire(wire.id)
  }

  // Update stats
  gameState.stats.totalConflictsResolved++

  // Spawn stability-up particle to show conflict resolved
  if (spawnCausalParticle && wireActionPosition.value) {
    spawnCausalParticle('stability-up', wireActionPosition.value.x, wireActionPosition.value.y)
  }

  clearWireSelection()
}

function handleUpgrade() {
  if (!selectedWire.value) return
  if (!canAffordUpgrade.value) return

  const wire = selectedWire.value
  const inScope = isInPackageScope()

  // Get the child package from current scope (works at any depth)
  let childPkg: Package | undefined
  if (inScope) {
    const scopePkg = getCurrentScopeRoot()
    childPkg = scopePkg?.internalPackages?.get(wire.toId)
  } else {
    childPkg = gameState.packages.get(wire.toId)
  }

  if (!childPkg?.identity) return

  const upgradeName = getUpgradePath(childPkg.identity.name)
  if (!upgradeName) return

  const newIdentity = findIdentityByName(upgradeName)
  if (!newIdentity) return

  // Spend bandwidth (2x install cost)
  const cost = getEffectiveInstallCost() * 2
  gameState.resources.bandwidth -= cost

  // Visual feedback
  const effects = renderer.getEffectsRenderer()
  effects.spawnBurst(
    childPkg.position.x,
    childPkg.position.y,
    Colors.borderOptimized
  )

  // Transform the package
  childPkg.identity = newIdentity
  childPkg.state = 'ready'

  // Mark wire as no longer conflicted
  wire.conflicted = false
  wire.conflictTime = 0

  // Recalculate internal state if in scope using full path
  if (inScope) {
    recalculateStateAtPath([...gameState.scopeStack])
  }

  // Update stats
  gameState.stats.totalConflictsResolved++

  // Spawn stability-up particle to show conflict resolved
  if (spawnCausalParticle && wireActionPosition.value) {
    spawnCausalParticle('stability-up', wireActionPosition.value.x, wireActionPosition.value.y)
  }

  clearWireSelection()
}

/**
 * Handle "Resolve Inside" action for sibling conflict wires
 * Enters one of the packages involved in the cross-package conflict
 */
function handleResolveInside() {
  if (!selectedWire.value || !isSiblingWire.value) return

  const wire = selectedWire.value

  // Find which conflict this sibling wire represents
  const conflicts = getCrossPackageConflicts()
  const conflict = conflicts.find(
    (c) =>
      (c.packageAId === wire.fromId && c.packageBId === wire.toId) ||
      (c.packageAId === wire.toId && c.packageBId === wire.fromId)
  )

  if (!conflict) return

  // Decide which package to enter (prefer the one with the "fixable" conflict)
  // If one has an upgrade path, prefer that one
  const pkgA = gameState.packages.get(conflict.packageAId)
  const pkgB = gameState.packages.get(conflict.packageBId)

  if (!pkgA || !pkgB) return

  // Check upgrade paths
  const upgradePathA = getUpgradePath(conflict.conflictingDepA)
  const upgradePathB = getUpgradePath(conflict.conflictingDepB)

  // Prefer package with upgrade path, otherwise first package
  let targetPackageId: string
  if (upgradePathB && !upgradePathA) {
    targetPackageId = conflict.packageBId
  } else {
    targetPackageId = conflict.packageAId
  }

  // Clear selection before entering
  clearWireSelection()

  // Enter the package scope
  if (enterPackageScope(targetPackageId)) {
    // Smooth camera transition to center
    setCameraTarget(0, 0)

    // Visual feedback
    const effects = renderer.getEffectsRenderer()
    effects.spawnRipple(0, 0, Colors.borderInstalling)
  }
}

function handleMouseMove(event: MouseEvent) {
  const worldPos = getWorldPos(event)
  if (!worldPos) return

  // Handle hoist drag
  if (hoistDragSource && hoistDragStartPos) {
    // Check drag threshold (10 pixels in world space)
    const dx = worldPos.x - hoistDragStartPos.x
    const dy = worldPos.y - hoistDragStartPos.y
    const dragDist = Math.sqrt(dx * dx + dy * dy)

    if (dragDist > 10 / gameState.camera.zoom) {
      // Check if we're in the drop zone (near root)
      isInHoistZone = isInDropZone(worldPos.x, worldPos.y)

      // Get root for drop zone rendering
      const root = gameState.rootId ? gameState.packages.get(gameState.rootId) : null
      if (root) {
        const distance = getDropZoneDistance(worldPos.x, worldPos.y)
        renderer.getNodeRenderer().updateDropZone(root.position, true, distance)
      }

      // Update cursor
      if (canvasRef.value) {
        canvasRef.value.style.cursor = isInHoistZone ? 'copy' : 'grabbing'
      }
    }
    return
  }

  // Handle symlink drag
  if (symlinkDragSource && symlinkDragStartPos) {
    // Check drag threshold (10 pixels in world space)
    const dx = worldPos.x - symlinkDragStartPos.x
    const dy = worldPos.y - symlinkDragStartPos.y
    const dragDist = Math.sqrt(dx * dx + dy * dy)

    if (dragDist > 10 / gameState.camera.zoom) {
      isDraggingSymlink = true
    }

    if (isDraggingSymlink) {
      symlinkDropTarget = null

      // Check if this is a cross-package drag (top-level packages at root scope)
      const isCrossPackageDrag =
        !isInPackageScope() && symlinkDragSource.parentId === gameState.rootId

      if (isCrossPackageDrag) {
        // Find other top-level packages with shared internal deps
        const rawPackages = toRaw(gameState.packages)
        for (const pkg of rawPackages.values()) {
          if (pkg.id === symlinkDragSource.id) continue
          if (pkg.parentId !== gameState.rootId) continue

          const distX = worldPos.x - pkg.position.x
          const distY = worldPos.y - pkg.position.y
          const dist = Math.sqrt(distX * distX + distY * distY)

          if (
            dist < 40 / gameState.camera.zoom &&
            canCrossPackageSymlink(symlinkDragSource.id, pkg.id)
          ) {
            symlinkDropTarget = pkg
            break
          }
        }
      } else {
        // Regular same-scope duplicate drag
        const otherDuplicates = getOtherDuplicates(symlinkDragSource.id)

        for (const dup of otherDuplicates) {
          const distX = worldPos.x - dup.position.x
          const distY = worldPos.y - dup.position.y
          const dist = Math.sqrt(distX * distX + distY * distY)

          if (
            dist < 40 / gameState.camera.zoom &&
            canSymlink(symlinkDragSource.id, dup.id)
          ) {
            symlinkDropTarget = dup
            break
          }
        }
      }

      // Update renderer with drag state
      renderer.setSymlinkDragState(
        symlinkDragSource.id,
        symlinkDropTarget ? symlinkDropTarget.id : null
      )

      // Update cursor during drag
      if (canvasRef.value) {
        canvasRef.value.style.cursor = symlinkDropTarget ? 'copy' : 'grabbing'
      }
    }
    return
  }

  // Update cursor based on what we're hovering over
  // Also set action preview for bandwidth bar cost visualization
  if (canvasRef.value) {
    const hoveredPkg = findPackageAtPosition(
      worldPos,
      35 / gameState.camera.zoom
    )

    // Check for wire hover (for conflict action preview)
    const wireRenderer = renderer.getWireRenderer()
    const hoveredWireId = wireRenderer.findWireAtPosition(
      worldPos.x,
      worldPos.y,
      15 / gameState.camera.zoom
    )
    let hoveredWire = null
    if (hoveredWireId) {
      const wires = getCurrentScopeWires()
      hoveredWire = wires.get(hoveredWireId)
      // Also check sibling wires
      if (!hoveredWire && !isInPackageScope()) {
        const siblingWires = getSiblingWires()
        hoveredWire = siblingWires.get(hoveredWireId)
      }
    }

    if (
      hoveredPkg &&
      hoveredPkg.state === 'ready' &&
      hasDuplicates(hoveredPkg.id)
    ) {
      // Duplicate package - show grab cursor to indicate draggable
      canvasRef.value.style.cursor = 'grab'
      renderer.setHoveredHoistable(null)
      setActionPreview('symlink') // Show symlink cost on bandwidth bar
    } else if (
      hoveredPkg &&
      hoveredPkg.state === 'ready' &&
      !isInPackageScope() &&
      hoveredPkg.parentId === gameState.rootId &&
      canHoist(hoveredPkg.id).canHoist
    ) {
      // Top-level package with hoistable shared deps - show grab cursor and highlight guide
      canvasRef.value.style.cursor = 'grab'
      renderer.setHoveredHoistable(hoveredPkg.id)
      setActionPreview(null)
    } else if (hoveredWire && hoveredWire.conflicted) {
      // Hovering over conflict wire - show conflict cost on bandwidth bar
      canvasRef.value.style.cursor = 'pointer'
      renderer.setHoveredHoistable(null)
      setActionPreview('conflict')
    } else if (hoveredPkg && hoveredPkg.state === 'conflict') {
      // Conflict - show pointer for resolution
      canvasRef.value.style.cursor = 'pointer'
      renderer.setHoveredHoistable(null)
      setActionPreview('conflict') // Show conflict cost on bandwidth bar
    } else if (
      hoveredPkg &&
      hoveredPkg.state === 'ready' &&
      hoveredPkg.parentId === null
    ) {
      // Root node - show pointer for installing
      canvasRef.value.style.cursor = 'pointer'
      renderer.setHoveredHoistable(null)
      setActionPreview(null)
    } else {
      canvasRef.value.style.cursor = 'default'
      renderer.setHoveredHoistable(null)
      setActionPreview(null)
    }
  }

  // Check for hoisted dep hover (for ephemeral lines)
  if (!isInPackageScope()) {
    const hoistedDeps = getHoistedDeps()
    let foundHoveredHoisted = false

    for (const hoisted of hoistedDeps) {
      const dx = worldPos.x - hoisted.position.x
      const dy = worldPos.y - hoisted.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < 25 / gameState.camera.zoom) {
        renderer.setHoveredHoistedDep(hoisted.id)
        foundHoveredHoisted = true
        if (canvasRef.value) {
          canvasRef.value.style.cursor = 'pointer'
        }
        break
      }
    }

    if (!foundHoveredHoisted) {
      renderer.setHoveredHoistedDep(null)
    }
  }
}

function handleMouseUp(event?: MouseEvent) {
  // Handle hoist drag completion
  if (hoistDragSource) {
    // Check if we actually dragged (mouse moved from start position)
    let actuallyDragged = false
    if (event && hoistDragStartPos) {
      const worldPos = renderer.screenToWorld(event.clientX, event.clientY)
      if (worldPos) {
        const dx = worldPos.x - hoistDragStartPos.x
        const dy = worldPos.y - hoistDragStartPos.y
        const dragDist = Math.sqrt(dx * dx + dy * dy)
        actuallyDragged = dragDist > 10 / gameState.camera.zoom
      }
    }

    if (isInHoistZone && hoistableDepName) {
      // Execute hoist! (drop zone was reached)
      const effects = renderer.getEffectsRenderer()
      const sourceX = hoistDragSource.position.x
      const sourceY = hoistDragSource.position.y
      const hoistedId = hoistDep(hoistableDepName)

      if (hoistedId) {
        // Get the hoisted dep's final position for animation
        const hoistedDep = getHoistedDepForGhost(hoistedId)
        if (hoistedDep) {
          // Start the rising animation from source to ring
          renderer.getNodeRenderer().startHoistAnimation(
            hoistedId,
            sourceX,
            sourceY,
            hoistedDep.position.x,
            hoistedDep.position.y
          )
        }

        // Success feedback
        const root = gameState.rootId ? gameState.packages.get(gameState.rootId) : null
        if (root) {
          effects.spawnBurst(root.position.x, root.position.y, 0x8b5cf6) // Purple burst
          effects.spawnRipple(root.position.x, root.position.y, 0x8b5cf6)
        }

        // Feedback at source package
        effects.spawnBurst(sourceX, sourceY, 0x8b5cf6)

        // Spawn causal particles
        if (spawnCausalParticle) {
          const screenPos = renderer.worldToScreen(sourceX, sourceY)
          spawnCausalParticle('bandwidth-gain', screenPos.x, screenPos.y)
          // Hoisting improves efficiency by deduplication
          spawnCausalParticle('efficiency-up', screenPos.x, screenPos.y)
          // Weight is saved
          spawnCausalParticle('weight-loss', screenPos.x, screenPos.y)
        }
      }
    } else if (!actuallyDragged) {
      // Was just a click, not a drag - enter the package scope
      if (enterPackageScope(hoistDragSource.id)) {
        setCameraTarget(0, 0)
        const effects = renderer.getEffectsRenderer()
        effects.spawnRipple(0, 0, Colors.borderInstalling)
      }
    }
    // If dragged but not to hoist zone, just cancel (don't enter scope)

    // Clear hoist drag state
    renderer.getNodeRenderer().hideDropZone()
    hoistDragSource = null
    hoistDragStartPos = null
    hoistableDepName = null
    isInHoistZone = false

    // Reset cursor
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'default'
    }
    return
  }

  // Handle symlink drag completion
  if (symlinkDragSource) {
    if (isDraggingSymlink && symlinkDropTarget) {
      const sourceId = symlinkDragSource.id
      const targetId = symlinkDropTarget.id
      const effects = renderer.getEffectsRenderer()
      const sourcePos = symlinkDragSource.position
      const targetPos = symlinkDropTarget.position

      // Check if this is a cross-package symlink (top-level packages at root scope)
      const isCrossPackage =
        !isInPackageScope() &&
        symlinkDragSource.parentId === gameState.rootId &&
        symlinkDropTarget.parentId === gameState.rootId

      if (isCrossPackage) {
        // Cross-package symlink: find ALL shared internal deps and symlink them
        const sharedDeps = getSharedInternalDeps(sourceId, targetId)
        if (sharedDeps.length > 0) {
          // Visual feedback at both positions
          effects.spawnBurst(sourcePos.x, sourcePos.y, Colors.wireSymlink)
          effects.spawnBurst(targetPos.x, targetPos.y, Colors.wireSymlink)

          // Symlink ALL shared deps in one operation
          let totalWeightSaved = 0
          for (const depName of sharedDeps) {
            const weightSaved = performCrossPackageSymlink(
              sourceId,
              targetId,
              depName
            )
            totalWeightSaved += weightSaved
          }

          if (totalWeightSaved > 0) {
            // Success feedback
            effects.spawnBurst(targetPos.x, targetPos.y, Colors.borderOptimized)

            // Spawn causal particles
            if (spawnCausalParticle) {
              const screenPos = renderer.worldToScreen(targetPos.x, targetPos.y)
              spawnCausalParticle('bandwidth-gain', screenPos.x, screenPos.y)
              // Efficiency improved by deduplication
              spawnCausalParticle('efficiency-up', screenPos.x, screenPos.y)
              // Weight saved
              spawnCausalParticle('weight-loss', screenPos.x, screenPos.y)
            }
          }
        }
      } else {
        // Regular same-scope symlink merge
        // Visual feedback at both positions
        effects.spawnBurst(sourcePos.x, sourcePos.y, Colors.wireSymlink)
        effects.spawnBurst(targetPos.x, targetPos.y, Colors.wireSymlink)

        // Execute merge (source gets merged into target)
        const weightSaved = performSymlinkMerge(sourceId, targetId)

        if (weightSaved > 0) {
          // Success feedback at target
          effects.spawnBurst(targetPos.x, targetPos.y, Colors.borderOptimized)

          // Spawn causal particles to show rewards flowing back
          if (spawnCausalParticle) {
            const screenPos = renderer.worldToScreen(targetPos.x, targetPos.y)
            // Bandwidth refund particle (flies to bandwidth bar)
            spawnCausalParticle('bandwidth-gain', screenPos.x, screenPos.y)
            // Efficiency improved by deduplication
            spawnCausalParticle('efficiency-up', screenPos.x, screenPos.y)
            // Weight saved
            spawnCausalParticle('weight-loss', screenPos.x, screenPos.y)
          }
        }
      }
    } else if (!isDraggingSymlink) {
      // Was just a click, not a drag - handle based on what was clicked
      if (symlinkDragSource.parentId === null) {
        // Click on root node: install new package
        const newPkg = installPackage(symlinkDragSource.id)
        if (newPkg) {
          const effects = renderer.getEffectsRenderer()
          effects.spawnRipple(
            newPkg.position.x,
            newPkg.position.y,
            Colors.borderInstalling
          )
        }
      } else if (
        !isInPackageScope() &&
        symlinkDragSource.parentId === gameState.rootId
      ) {
        // Click on top-level package at root scope: enter its scope
        if (enterPackageScope(symlinkDragSource.id)) {
          setCameraTarget(0, 0)
          const effects = renderer.getEffectsRenderer()
          effects.spawnRipple(0, 0, Colors.borderInstalling)
        }
      }
    }

    // Clear drag state
    renderer.setSymlinkDragState(null, null)
    symlinkDragSource = null
    symlinkDragStartPos = null
    symlinkDropTarget = null
    isDraggingSymlink = false

    // Reset cursor
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'default'
    }
  }

  if (holdingPackage) {
    // Cancel if not held long enough
    if (holdingPackage.state === 'conflict') {
      holdingPackage.conflictProgress = 0
    }
    holdingPackage = null
  }
}

function updateHoldProgress() {
  if (!holdingPackage || holdingPackage.state !== 'conflict') {
    holdingPackage = null
    return
  }

  const elapsed = Date.now() - holdStartTime
  const progress = Math.min(1, elapsed / HOLD_DURATION)
  holdingPackage.conflictProgress = progress

  if (progress >= 1) {
    // Resolve conflict
    holdingPackage.state = 'ready'
    holdingPackage.conflictProgress = 0
    gameState.stats.totalConflictsResolved++
    holdingPackage = null
  } else {
    requestAnimationFrame(updateHoldProgress)
  }
}

function handleResize() {
  renderer.resize()
}
</script>

<template>
  <div class="canvas-container">
    <canvas ref="canvasRef" class="game-canvas"></canvas>

    <!-- Wire Action Buttons Overlay -->
    <Transition name="fade">
      <div
        v-if="selectedWireId && wireActionPosition"
        class="wire-actions"
        :style="{
          left: wireActionPosition.x + 'px',
          top: wireActionPosition.y + 'px',
        }"
      >
        <!-- Sibling wire: Resolve Inside button -->
        <template v-if="isSiblingWire">
          <button
            class="action-btn resolve-inside"
            @click="handleResolveInside"
            title="Resolve Inside (enter package)"
          >
            ↘
          </button>
        </template>

        <!-- Regular conflict wire: Prune/Upgrade buttons -->
        <template v-else>
          <button
            class="action-btn prune"
            :class="{ disabled: !canAffordPrune }"
            :disabled="!canAffordPrune"
            @click="handlePrune"
            title="Prune (remove package)"
          >
            ✕
          </button>
          <button
            v-if="hasUpgradePath"
            class="action-btn upgrade"
            :class="{ disabled: !canAffordUpgrade }"
            :disabled="!canAffordUpgrade"
            @click="handleUpgrade"
            title="Upgrade (transform to compatible)"
          >
            ↻
          </button>
        </template>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.game-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

/* Wire action buttons */
.wire-actions {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  gap: 8px;
  z-index: 100;
  pointer-events: auto;
}

.action-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn.prune {
  background: rgba(60, 20, 20, 0.9);
  border-color: #ff5a5a;
  color: #ff5a5a;
}

.action-btn.prune:hover {
  background: rgba(100, 30, 30, 0.95);
  transform: scale(1.1);
  box-shadow: 0 0 12px rgba(255, 90, 90, 0.5);
}

.action-btn.upgrade {
  background: rgba(20, 60, 40, 0.9);
  border-color: #5aff5a;
  color: #5aff5a;
}

.action-btn.upgrade:hover:not(.disabled) {
  background: rgba(30, 80, 50, 0.95);
  transform: scale(1.1);
  box-shadow: 0 0 12px rgba(90, 255, 90, 0.5);
}

.action-btn.upgrade.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  border-color: #666;
  color: #666;
}

.action-btn.resolve-inside {
  background: rgba(40, 40, 80, 0.9);
  border-color: #7a7aff;
  color: #7a7aff;
  width: 44px;
  height: 44px;
  font-size: 22px;
}

.action-btn.resolve-inside:hover {
  background: rgba(60, 60, 100, 0.95);
  transform: scale(1.1);
  box-shadow: 0 0 16px rgba(122, 122, 255, 0.6);
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.8);
}
</style>
