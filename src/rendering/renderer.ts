// Main renderer coordinating all rendering components

import { Application, Container, Graphics, BlurFilter } from 'pixi.js'
import { toRaw } from 'vue'
import { NodeRenderer } from './nodes'
import { WireRenderer } from './wires'
import { EffectsRenderer } from './effects'
import { BlackHoleRenderer } from './blackhole'
import { EdgeIndicatorRenderer } from './edge-indicators'
import { Colors } from './colors'
import { gameState } from '../game/state'
import {
  getCurrentScopePackages,
  getCurrentScopeWires,
  getCurrentScopeRoot,
  isInPackageScope,
  getScopeDepth,
  getPackageAtPath,
} from '../game/scope'
import { onTick } from '../game/loop'
import {
  updateDuplicateGroups,
  getDuplicateGroup,
  getAllDuplicateGroups,
} from '../game/symlinks'
import {
  updateCrossPackageConflicts,
  updateCrossPackageDuplicates,
  getSiblingWires,
  getCrossPackageDuplicateInfo,
} from '../game/cross-package'
import { getCleanliness, isOrganizing } from '../game/physics'
import { getHoistedDeps, updateHoistedPositions, findSharedDeps } from '../game/hoisting'
import { getAllPendingSpawns, isCascadeActive } from '../game/cascade'
import { canAffordConflictResolve } from '../game/mutations'
import { canAffordSymlinkMerge } from '../game/symlinks'

export class GameRenderer {
  private app: Application
  private worldContainer: Container
  private nodeRenderer!: NodeRenderer
  private wireRenderer!: WireRenderer
  private effectsRenderer!: EffectsRenderer
  private blackHoleRenderer!: BlackHoleRenderer
  private edgeIndicatorRenderer!: EdgeIndicatorRenderer
  private ghostLinesGraphics!: Graphics

  // Background layer containers for inception effect
  private backgroundLayerContainer!: Container
  private midgroundLayerContainer!: Container
  private backgroundNodeRenderer!: NodeRenderer
  private backgroundWireRenderer!: WireRenderer
  private midgroundNodeRenderer!: NodeRenderer
  private midgroundWireRenderer!: WireRenderer

  private isDragging = false
  private lastMousePos = { x: 0, y: 0 }

  // Symlink drag state (managed externally via setSymlinkDragState)
  private symlinkDragSource: string | null = null
  private symlinkDragTarget: string | null = null

  // Hovered hoistable package (for showing prominent guide)
  private hoveredHoistableId: string | null = null

  // Track previous scope depth for transition animations
  private previousScopeDepth = 0

  constructor() {
    this.app = new Application()
    this.worldContainer = new Container()
    this.worldContainer.label = 'world'
  }

  /**
   * Initialize the renderer
   */
  async init(canvas: HTMLCanvasElement): Promise<void> {
    await this.app.init({
      canvas,
      resizeTo: canvas.parentElement || window,
      backgroundColor: Colors.background,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    // Create black hole renderer (needs to be split between bg and foreground)
    this.blackHoleRenderer = new BlackHoleRenderer(this.app)

    // Set up black hole renderer with world-to-screen converter
    this.blackHoleRenderer.setWorldToScreen((x, y) => this.worldToScreen(x, y))

    // Add world container with proper z-ordering
    // Background effects (gravity warp) -> behind world
    this.app.stage.addChild(this.blackHoleRenderer.getBackgroundContainer())
    this.app.stage.addChild(this.worldContainer)
    // Core effects (black hole, collapse) -> in front during collapse
    this.app.stage.addChild(this.blackHoleRenderer.getCoreContainer())
    // Overlay effects (vignette, ambient particles) -> always on top
    this.app.stage.addChild(this.blackHoleRenderer.getOverlayContainer())

    // ============================================
    // BACKGROUND LAYER (grandparent scope - faint, blurred, zoomed in)
    // ============================================
    this.backgroundLayerContainer = new Container()
    this.backgroundLayerContainer.label = 'background-layer'
    this.backgroundLayerContainer.alpha = 0.12
    this.backgroundLayerContainer.filters = [
      new BlurFilter({ strength: 4, quality: 2 }),
    ]
    this.backgroundLayerContainer.visible = false
    this.worldContainer.addChild(this.backgroundLayerContainer)

    this.backgroundWireRenderer = new WireRenderer(this.app)
    this.backgroundLayerContainer.addChild(
      this.backgroundWireRenderer.getContainer()
    )
    this.backgroundNodeRenderer = new NodeRenderer(this.app)
    this.backgroundLayerContainer.addChild(
      this.backgroundNodeRenderer.getContainer()
    )

    // ============================================
    // MIDGROUND LAYER (parent scope - dimmed, blurred, zoomed in)
    // ============================================
    this.midgroundLayerContainer = new Container()
    this.midgroundLayerContainer.label = 'midground-layer'
    this.midgroundLayerContainer.alpha = 0.2
    this.midgroundLayerContainer.filters = [
      new BlurFilter({ strength: 2, quality: 2 }),
    ]
    this.midgroundLayerContainer.visible = false
    this.worldContainer.addChild(this.midgroundLayerContainer)

    this.midgroundWireRenderer = new WireRenderer(this.app)
    this.midgroundLayerContainer.addChild(
      this.midgroundWireRenderer.getContainer()
    )
    this.midgroundNodeRenderer = new NodeRenderer(this.app)
    this.midgroundLayerContainer.addChild(
      this.midgroundNodeRenderer.getContainer()
    )

    // ============================================
    // FOREGROUND LAYER (current active scope - 100% alpha)
    // ============================================
    // Create sub-renderers (order matters for z-index)
    this.wireRenderer = new WireRenderer(this.app)
    this.worldContainer.addChild(this.wireRenderer.getContainer())

    // Ghost lines for duplicate hints (between wires and nodes)
    this.ghostLinesGraphics = new Graphics()
    this.ghostLinesGraphics.label = 'ghost-lines'
    this.worldContainer.addChild(this.ghostLinesGraphics)

    this.nodeRenderer = new NodeRenderer(this.app)
    this.worldContainer.addChild(this.nodeRenderer.getContainer())

    this.effectsRenderer = new EffectsRenderer(this.app)
    this.worldContainer.addChild(this.effectsRenderer.getContainer())

    // Edge indicators (screen-space, on top of everything)
    this.edgeIndicatorRenderer = new EdgeIndicatorRenderer(this.app)
    this.app.stage.addChild(this.edgeIndicatorRenderer.getContainer())
    this.edgeIndicatorRenderer.setWorldToScreen((x, y) =>
      this.worldToScreen(x, y)
    )

    // Center world
    this.worldContainer.x = this.app.screen.width / 2
    this.worldContainer.y = this.app.screen.height / 2

    // Set up input handlers
    this.setupInput(canvas)

    // Register tick callback
    onTick((deltaTime) => this.render(deltaTime))
  }

  /**
   * Set up input handlers for pan/zoom
   */
  private setupInput(canvas: HTMLCanvasElement): void {
    // Pan with middle mouse or drag
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        this.isDragging = true
        this.lastMousePos = { x: e.clientX, y: e.clientY }
        e.preventDefault()
      }
    })

    canvas.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.lastMousePos.x
        const dy = e.clientY - this.lastMousePos.y

        gameState.camera.x += dx / gameState.camera.zoom
        gameState.camera.y += dy / gameState.camera.zoom

        this.lastMousePos = { x: e.clientX, y: e.clientY }
      }
    })

    canvas.addEventListener('mouseup', () => {
      this.isDragging = false
    })

    canvas.addEventListener('mouseleave', () => {
      this.isDragging = false
    })

    // Zoom with scroll wheel
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()

        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
        const newZoom = Math.max(
          0.1,
          Math.min(5, gameState.camera.zoom * zoomFactor)
        )

        // Zoom toward mouse position
        const rect = canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left - this.app.screen.width / 2
        const mouseY = e.clientY - rect.top - this.app.screen.height / 2

        // Adjust camera to zoom toward mouse
        const worldMouseX = mouseX / gameState.camera.zoom - gameState.camera.x
        const worldMouseY = mouseY / gameState.camera.zoom - gameState.camera.y

        gameState.camera.zoom = newZoom

        const newWorldMouseX = mouseX / newZoom - gameState.camera.x
        const newWorldMouseY = mouseY / newZoom - gameState.camera.y

        gameState.camera.x += newWorldMouseX - worldMouseX
        gameState.camera.y += newWorldMouseY - worldMouseY
      },
      { passive: false }
    )
  }

  /**
   * Main render function called each frame
   */
  render(deltaTime: number = 0.016): void {
    const screenWidth = this.app.screen.width
    const screenHeight = this.app.screen.height

    // Update background color based on cleanliness
    this.updateBackgroundColor()

    // Update black hole effects
    this.blackHoleRenderer.update(deltaTime, screenWidth, screenHeight)

    // Get shake offset from black hole
    const shake = this.blackHoleRenderer.getShakeOffset()

    // Update camera with shake
    this.worldContainer.x =
      screenWidth / 2 + gameState.camera.x * gameState.camera.zoom + shake.x
    this.worldContainer.y =
      screenHeight / 2 + gameState.camera.y * gameState.camera.zoom + shake.y
    this.worldContainer.scale.set(gameState.camera.zoom)

    // Position black hole containers at screen center
    this.blackHoleRenderer.getBackgroundContainer().x = screenWidth / 2
    this.blackHoleRenderer.getBackgroundContainer().y = screenHeight / 2
    this.blackHoleRenderer.getCoreContainer().x = screenWidth / 2
    this.blackHoleRenderer.getCoreContainer().y = screenHeight / 2
    // Overlay container stays at (0,0) - uses standard screen coordinates like EdgeIndicatorRenderer

    // Update effects
    this.effectsRenderer.update(deltaTime)

    // Update edge indicators (screen-space)
    this.edgeIndicatorRenderer.update(screenWidth, screenHeight)

    // ============================================
    // UPDATE BACKGROUND LAYERS (Inception effect)
    // ============================================
    const scopeDepth = getScopeDepth()
    this.updateBackgroundLayers(scopeDepth)

    // Update duplicate groups for symlink detection (scope-aware)
    updateDuplicateGroups()

    // Update cross-package systems (sibling conflicts, cross-package duplicates)
    updateCrossPackageConflicts()
    updateCrossPackageDuplicates()

    // Use toRaw() to avoid Vue reactivity tracking in render loop
    // Use scope-aware getters for packages and wires
    const inScope = isInPackageScope()
    const scopePackages = toRaw(getCurrentScopePackages())
    const scopeWires = toRaw(getCurrentScopeWires())

    // When in package scope, we also need to render the scope root (parent package)
    // Create a combined package map for rendering
    const rawPackages: Map<
      string,
      typeof gameState.packages extends Map<string, infer V> ? V : never
    > = new Map(scopePackages)
    let scopeRootPkg: ReturnType<typeof gameState.packages.get> | null = null

    if (inScope) {
      // Get the scope root package (works for both layer 1 and layer 2)
      scopeRootPkg = getCurrentScopeRoot()
      if (scopeRootPkg) {
        // Add scope root to our rendering map (it acts as local root at position 0,0)
        const scopeRootForRender = {
          ...toRaw(scopeRootPkg),
          // Override position to (0,0) for internal view
          position: { x: 0, y: 0 },
          // Treat as root within scope (no parent in this context)
          parentId: null,
        }
        rawPackages.set(scopeRootPkg.id, scopeRootForRender)
      }
    }

    const rawWires = scopeWires

    // Check affordability for conflict resolution (cached for this frame)
    const canAffordResolve = canAffordConflictResolve()

    // Update wires first (behind nodes)
    for (const wire of rawWires.values()) {
      const fromPkg = rawPackages.get(wire.fromId)
      const toPkg = rawPackages.get(wire.toId)

      if (fromPkg && toPkg) {
        this.wireRenderer.updateWire(wire, fromPkg, toPkg, canAffordResolve)
      }
    }

    // Render sibling wires at root scope (cross-package conflicts)
    if (!inScope) {
      const siblingWires = getSiblingWires()
      for (const wire of siblingWires.values()) {
        const fromPkg = rawPackages.get(wire.fromId)
        const toPkg = rawPackages.get(wire.toId)

        if (fromPkg && toPkg) {
          this.wireRenderer.updateWire(wire, fromPkg, toPkg, canAffordResolve)
        }
      }
    }

    // Draw ghost lines between duplicates
    this.drawGhostLines()

    // Update nodes with effects context
    const rootPulse = this.effectsRenderer.getRootPulseIntensity()
    const showHint = this.effectsRenderer.shouldShowClickHint()

    // Calculate synced pulse phase for duplicates (1.5s cycle)
    const pulsePhase = (Date.now() % 1500) / 1500

    // Get first conflict dimming intensity
    const firstConflictDim =
      this.edgeIndicatorRenderer.getFirstConflictDimming()

    // Check which packages are involved in conflicts (don't dim them)
    const conflictPackageIds = new Set<string>()
    for (const wire of rawWires.values()) {
      if (wire.conflicted) {
        conflictPackageIds.add(wire.fromId)
        conflictPackageIds.add(wire.toId)
      }
    }

    // Find hoistable packages (at root scope only)
    const hoistablePackageIds = new Set<string>()
    if (!inScope) {
      const sharedDeps = findSharedDeps()
      for (const [, sourcePackageIds] of sharedDeps) {
        for (const pkgId of sourcePackageIds) {
          hoistablePackageIds.add(pkgId)
        }
      }
    }

    for (const pkg of rawPackages.values()) {
      const isRoot = pkg.parentId === null
      const pulseIntensity = isRoot ? rootPulse : 0
      const shakeOffset =
        pkg.state === 'conflict'
          ? this.effectsRenderer.getConflictShake(pkg.conflictProgress)
          : { x: 0, y: 0 }

      // Is this a top-level package (direct child of root)?
      const isTopLevel = !inScope && pkg.parentId === gameState.rootId

      // Get duplicate halo info if applicable (getDuplicateGroup is scope-aware)
      // Check affordability once for all duplicates this frame
      const canAffordMerge = canAffordSymlinkMerge()
      let duplicateHalo: { color: number; pulsePhase: number; canAfford: boolean } | undefined
      const group = getDuplicateGroup(pkg.id)
      if (group) {
        duplicateHalo = {
          color: group.haloColor,
          pulsePhase: pulsePhase,
          canAfford: canAffordMerge,
        }
      }

      // At root scope, also check for cross-package duplicates (packages sharing internal deps)
      if (!inScope && isTopLevel) {
        const crossDupInfo = getCrossPackageDuplicateInfo(pkg.id)
        if (crossDupInfo && !duplicateHalo) {
          duplicateHalo = {
            color: crossDupInfo.haloColor,
            pulsePhase: pulsePhase,
            canAfford: canAffordMerge,
          }
        }
      }

      // Check if this node is involved in drag operation
      const isDragging = this.symlinkDragSource === pkg.id
      const isDropTarget = this.symlinkDragTarget === pkg.id

      // Dim non-conflict nodes during first conflict treatment
      const dimAmount = conflictPackageIds.has(pkg.id) ? 0 : firstConflictDim

      // Internal state glow for packages with internal scope
      // - At root: top-level packages
      // - Inside scope: compressed internal deps (have internalPackages)
      const isCompressed = pkg.internalPackages !== null && pkg.internalWires !== null
      const internalState = (isTopLevel || (inScope && isCompressed)) ? pkg.internalState : null

      // Ghost node rendering (cross-package symlink)
      const isGhost = pkg.isGhost || false
      const ghostTargetScope = pkg.ghostTargetScope || null

      // Hoistable indicator (only for top-level packages with shared deps)
      const isHoistable = isTopLevel && hoistablePackageIds.has(pkg.id)

      this.nodeRenderer.updateNode(pkg, {
        pulseIntensity,
        shake: shakeOffset,
        showHint: isRoot && showHint,
        duplicateHalo,
        isDragging,
        isDropTarget,
        dimAmount,
        internalState,
        isGhost,
        ghostTargetScope,
        isHoistable,
      })
    }

    // ============================================
    // RENDER HOISTED DEPS (at root scope only)
    // ============================================
    // Toggle visibility based on scope
    this.nodeRenderer.setHoistedDepsVisible(!inScope)

    if (!inScope) {
      // Update hoisted dep positions (they orbit root)
      updateHoistedPositions()

      // Render each hoisted dep
      const hoistedDeps = getHoistedDeps()
      const hoistedIds = new Set<string>()

      for (const hoisted of hoistedDeps) {
        this.nodeRenderer.updateHoistedDep(hoisted)
        hoistedIds.add(hoisted.id)
      }

      // Draw ephemeral lines for hovered hoisted dep
      const hoveredId = this.nodeRenderer.getHoveredHoistedId()
      if (hoveredId) {
        const hoveredDep = hoistedDeps.find(h => h.id === hoveredId)
        if (hoveredDep) {
          // Get source package positions
          const sourcePositions: { x: number; y: number }[] = []
          for (const pkgId of hoveredDep.sourcePackages) {
            const pkg = rawPackages.get(pkgId)
            if (pkg) {
              sourcePositions.push(pkg.position)
            }
          }
          this.nodeRenderer.drawEphemeralLines(hoveredDep, sourcePositions)
        }
      } else {
        // Clear ephemeral lines when not hovering
        this.nodeRenderer.drawEphemeralLines(null, [])
      }

    }

    // ============================================
    // RENDER QUEUED DEPS (Awaiting Bandwidth)
    // ============================================
    // Only render when inside a scope and cascade is active
    if (inScope && isCascadeActive()) {
      const pendingSpawns = getAllPendingSpawns()
      this.nodeRenderer.updateQueuedDeps(pendingSpawns, gameState.resources.bandwidth)
    } else {
      // Clear queued deps when not in cascade
      this.nodeRenderer.updateQueuedDeps([], 0)
    }

    // Clean up nodes that no longer exist in current scope
    // Protect the current scope's root (global root at root scope, or scope package when inside)
    const currentPackageIds = new Set(rawPackages.keys())
    const protectedRootId = inScope ? gameState.currentScope : gameState.rootId
    for (const [nodeId] of this.nodeRenderer.getAllNodeGraphics()) {
      if (!currentPackageIds.has(nodeId) && nodeId !== protectedRootId) {
        this.nodeRenderer.removeNode(nodeId)
      }
    }

    // Clean up wires that no longer exist
    // Include both regular wires and sibling wires
    const currentWireIds = new Set(rawWires.keys())
    const siblingWires = !inScope ? getSiblingWires() : new Map()
    for (const siblingId of siblingWires.keys()) {
      currentWireIds.add(siblingId)
    }

    for (const wireId of this.wireRenderer.getAllWireIds()) {
      if (!currentWireIds.has(wireId)) {
        this.wireRenderer.removeWire(wireId)
      }
    }
  }

  /**
   * Draw ghost lines between duplicates with drag hint arrows
   * SCOPE-AWARE: Works for both root scope and inside package scopes
   */
  private drawGhostLines(): void {
    this.ghostLinesGraphics.clear()

    const inScope = isInPackageScope()
    const groups = getAllDuplicateGroups() // Already scope-aware
    const pulsePhase = (Date.now() % 1500) / 1500

    // Get packages from current scope
    const scopePackages = inScope
      ? toRaw(getCurrentScopePackages())
      : toRaw(gameState.packages)

    // Check if this is the first time seeing duplicates (teaching moment)
    const isFirstDuplicates =
      !gameState.onboarding.firstSymlinkSeen && groups.length > 0

    for (const group of groups) {
      // Draw lines between all pairs in the group
      const ids = group.packageIds
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const pkgA = scopePackages.get(ids[i]!)
          const pkgB = scopePackages.get(ids[j]!)

          if (pkgA && pkgB) {
            this.drawGhostLineWithHint(
              pkgA.position.x,
              pkgA.position.y,
              pkgB.position.x,
              pkgB.position.y,
              group.haloColor,
              pulsePhase,
              isFirstDuplicates
            )
          }
        }
      }
    }

    // Draw hoist guide lines: packages with shared deps → root
    // Teaches player to drag hoistable packages toward root
    if (!inScope && gameState.rootId) {
      const root = scopePackages.get(gameState.rootId)
      if (root) {
        const sharedDeps = findSharedDeps()
        const drawnPackages = new Set<string>() // Avoid duplicate lines

        // For each shared dep, draw lines from source packages to root
        for (const [, sourcePackageIds] of sharedDeps) {
          for (const pkgId of sourcePackageIds) {
            if (drawnPackages.has(pkgId)) continue
            drawnPackages.add(pkgId)

            const pkg = scopePackages.get(pkgId)
            if (pkg) {
              // Check if this package is being hovered - show prominent guide
              const isHovered = pkgId === this.hoveredHoistableId

              // Draw guide line (more prominent if hovered)
              this.drawHoistGuideLine(
                pkg.position.x,
                pkg.position.y,
                root.position.x,
                root.position.y,
                0x8b5cf6, // Purple for hoisting
                pulsePhase,
                isHovered // Use hover state for emphasis instead of just first duplicate
              )
            }
          }
        }
      }
    }
  }

  /**
   * Update background color based on cleanliness
   * Chaotic = warm tint, Clean = cool/neutral, Organizing = cyan pulse
   */
  private updateBackgroundColor(): void {
    const cleanliness = getCleanliness()
    const organizing = isOrganizing()

    // Base colors (RGB components)
    // Chaotic: warmer, slightly reddish #181420
    // Clean: cooler, neutral blue #0e0e18
    // Organizing: brief cyan pulse #0a1820

    const chaoticR = 0x18,
      chaoticG = 0x14,
      chaoticB = 0x20
    const cleanR = 0x0e,
      cleanG = 0x0e,
      cleanB = 0x18
    const organizeR = 0x0a,
      organizeG = 0x18,
      organizeB = 0x20

    let r, g, b

    if (organizing) {
      // During organize boost, pulse toward cyan tint
      const pulse = 0.3 + 0.2 * Math.sin(Date.now() * 0.01)
      r = Math.floor(cleanR + (organizeR - cleanR) * pulse)
      g = Math.floor(cleanG + (organizeG - cleanG) * pulse)
      b = Math.floor(cleanB + (organizeB - cleanB) * pulse)
    } else {
      // Interpolate between chaotic and clean based on cleanliness
      r = Math.floor(chaoticR + (cleanR - chaoticR) * cleanliness)
      g = Math.floor(chaoticG + (cleanG - chaoticG) * cleanliness)
      b = Math.floor(chaoticB + (cleanB - chaoticB) * cleanliness)
    }

    const bgColor = (r << 16) | (g << 8) | b
    this.app.renderer.background.color = bgColor
  }

  /**
   * Update background layers for inception effect
   * Shows parent scope(s) zoomed in and centered on the package we entered
   */
  private updateBackgroundLayers(scopeDepth: number): void {
    // Hide all background layers at root scope
    if (scopeDepth === 0) {
      this.backgroundLayerContainer.visible = false
      this.midgroundLayerContainer.visible = false
      // Clear any cached nodes/wires
      if (this.previousScopeDepth > 0) {
        this.backgroundNodeRenderer.clear()
        this.backgroundWireRenderer.clear()
        this.midgroundNodeRenderer.clear()
        this.midgroundWireRenderer.clear()
      }
      this.previousScopeDepth = 0
      return
    }

    // Generic approach for arbitrary depth:
    // - Midground: shows parent scope (scopeDepth - 1)
    // - Background: shows grandparent scope (scopeDepth - 2), if exists

    // Get current scope's package (for centering parent layers)
    const currentScopePath = [...gameState.scopeStack]
    const currentPkg = getPackageAtPath(currentScopePath)

    // Parent scope (one level up)
    const parentPath = currentScopePath.slice(0, -1)
    const parentPkg = parentPath.length > 0 ? getPackageAtPath(parentPath) : null

    // Grandparent scope (two levels up)
    const grandparentPath = currentScopePath.slice(0, -2)

    // Calculate blur/alpha based on depth - gets progressively stronger at deeper levels
    const baseBlur = 2
    const baseAlpha = 0.2
    const blurPerDepth = 1.5
    const alphaDecay = 0.85

    // Midground: always shows parent scope when in any package scope
    this.midgroundLayerContainer.visible = true
    const midgroundBlur = baseBlur + (scopeDepth - 1) * blurPerDepth
    const midgroundAlpha = baseAlpha * Math.pow(alphaDecay, scopeDepth - 1)
    this.midgroundLayerContainer.alpha = midgroundAlpha + 0.05 // Slightly more visible
    this.midgroundLayerContainer.filters = [
      new BlurFilter({ strength: midgroundBlur, quality: 2 }),
    ]

    // Center midground on the package we entered (current scope's position in parent)
    if (currentPkg) {
      this.midgroundLayerContainer.x = -currentPkg.position.x
      this.midgroundLayerContainer.y = -currentPkg.position.y
      // Progressive zoom as we go deeper
      const midgroundScale = 1.5 + (scopeDepth - 1) * 0.3
      this.midgroundLayerContainer.scale.set(midgroundScale)
    }

    // Render parent scope to midground
    if (parentPath.length === 0) {
      // Parent is root - render root scope
      this.renderScopeToLayer(
        toRaw(gameState.packages),
        toRaw(gameState.wires),
        this.midgroundNodeRenderer,
        this.midgroundWireRenderer,
        gameState.rootId
      )
    } else if (parentPkg?.internalPackages && parentPkg?.internalWires) {
      // Parent is a nested package - render its internals
      const parentId = parentPath[parentPath.length - 1]!
      const parentPackages = new Map(toRaw(parentPkg.internalPackages))
      parentPackages.set(parentId, {
        ...toRaw(parentPkg),
        position: { x: 0, y: 0 },
        parentId: null,
      } as typeof parentPkg)

      this.renderScopeToLayer(
        parentPackages,
        toRaw(parentPkg.internalWires),
        this.midgroundNodeRenderer,
        this.midgroundWireRenderer,
        parentId
      )
    }

    // Background: shows grandparent scope if we're at depth 2+
    if (scopeDepth >= 2) {
      this.backgroundLayerContainer.visible = true
      const backgroundBlur = baseBlur + scopeDepth * blurPerDepth
      const backgroundAlpha = baseAlpha * Math.pow(alphaDecay, scopeDepth)
      this.backgroundLayerContainer.alpha = backgroundAlpha
      this.backgroundLayerContainer.filters = [
        new BlurFilter({ strength: backgroundBlur, quality: 2 }),
      ]

      // Center background on the parent package's position (in grandparent space)
      if (parentPkg) {
        this.backgroundLayerContainer.x = -parentPkg.position.x
        this.backgroundLayerContainer.y = -parentPkg.position.y
        const backgroundScale = 2.5 + (scopeDepth - 2) * 0.5
        this.backgroundLayerContainer.scale.set(backgroundScale)
      }

      // Render grandparent scope to background
      if (grandparentPath.length === 0) {
        // Grandparent is root
        this.renderScopeToLayer(
          toRaw(gameState.packages),
          toRaw(gameState.wires),
          this.backgroundNodeRenderer,
          this.backgroundWireRenderer,
          gameState.rootId
        )
      } else {
        const grandparentPkg = getPackageAtPath(grandparentPath)
        if (grandparentPkg?.internalPackages && grandparentPkg?.internalWires) {
          const grandparentId = grandparentPath[grandparentPath.length - 1]!
          const grandparentPackages = new Map(toRaw(grandparentPkg.internalPackages))
          grandparentPackages.set(grandparentId, {
            ...toRaw(grandparentPkg),
            position: { x: 0, y: 0 },
            parentId: null,
          } as typeof grandparentPkg)

          this.renderScopeToLayer(
            grandparentPackages,
            toRaw(grandparentPkg.internalWires),
            this.backgroundNodeRenderer,
            this.backgroundWireRenderer,
            grandparentId
          )
        }
      }
    } else {
      // Clear background layer when at depth 1
      this.backgroundLayerContainer.visible = false
      this.backgroundNodeRenderer.clear()
      this.backgroundWireRenderer.clear()
    }

    this.previousScopeDepth = scopeDepth
  }

  /**
   * Render a scope's packages and wires to a specific layer
   */
  private renderScopeToLayer(
    packages: Map<string, ReturnType<typeof gameState.packages.get>>,
    wires: Map<string, ReturnType<typeof gameState.wires.get>>,
    nodeRenderer: NodeRenderer,
    wireRenderer: WireRenderer,
    _rootId: string | null // Currently unused but kept for potential future use
  ): void {
    // Track which nodes we've rendered
    const renderedNodeIds = new Set<string>()

    // Render wires (use current affordability state)
    const canAffordResolve = canAffordConflictResolve()
    for (const wire of wires.values()) {
      if (!wire) continue
      const fromPkg = packages.get(wire.fromId)
      const toPkg = packages.get(wire.toId)
      if (fromPkg && toPkg) {
        wireRenderer.updateWire(wire, fromPkg, toPkg, canAffordResolve)
      }
    }

    // Render nodes (simplified - no effects, no halos)
    for (const pkg of packages.values()) {
      if (!pkg) continue
      renderedNodeIds.add(pkg.id)

      nodeRenderer.updateNode(pkg, {
        pulseIntensity: 0,
        shake: { x: 0, y: 0 },
        showHint: false,
        duplicateHalo: undefined,
        isDragging: false,
        isDropTarget: false,
        dimAmount: 0,
        internalState: null,
        isGhost: pkg.isGhost || false,
        ghostTargetScope: pkg.ghostTargetScope || null,
      })
    }

    // Clean up nodes that are no longer in this scope
    for (const [nodeId] of nodeRenderer.getAllNodeGraphics()) {
      if (!renderedNodeIds.has(nodeId)) {
        nodeRenderer.removeNode(nodeId)
      }
    }

    // Clean up wires that are no longer in this scope
    const currentWireIds = new Set(wires.keys())
    for (const wireId of wireRenderer.getAllWireIds()) {
      if (!currentWireIds.has(wireId)) {
        wireRenderer.removeWire(wireId)
      }
    }
  }

  /**
   * Configuration for drawing animated guide lines
   */
  private drawAnimatedGuideLine(config: {
    startX: number
    startY: number
    endX: number
    endY: number
    color: number
    pulsePhase: number
    emphasized: boolean
    // Visual style
    dashLength?: number
    gapLength?: number
    baseAlpha?: number
    emphasisMult?: number
    lineWidthNormal?: number
    lineWidthEmph?: number
    // Arrow config
    arrowSizeNormal?: number
    arrowSizeEmph?: number
    arrowAnimCycle?: number
    arrowStartT?: number
    arrowRangeT?: number
    // Optional: bidirectional arrows (for merge hints)
    bidirectional?: boolean
    // Optional: endpoint icon
    endIcon?: { sizeNormal: number; sizeEmph: number }
    // Optional: midpoint icon (for merge)
    midIcon?: boolean
  }): void {
    const {
      startX, startY, endX, endY, color, pulsePhase, emphasized,
      dashLength = 6, gapLength = 8,
      baseAlpha = 0.15, emphasisMult = 2.0,
      lineWidthNormal = 1.5, lineWidthEmph = 2.5,
      arrowSizeNormal = 7, arrowSizeEmph = 10,
      arrowAnimCycle = 2000, arrowStartT = 0.2, arrowRangeT = 0.25,
      bidirectional = false, endIcon, midIcon = false
    } = config

    const dx = endX - startX
    const dy = endY - startY
    const lineDist = Math.sqrt(dx * dx + dy * dy)
    if (lineDist < 20) return

    const nx = dx / lineDist
    const ny = dy / lineDist
    const midX = (startX + endX) / 2
    const midY = (startY + endY) / 2

    const emphMult = emphasized ? emphasisMult : 1.0
    const actualBaseAlpha = emphasized ? baseAlpha * 2.3 : baseAlpha
    const alpha = (actualBaseAlpha + 0.15 * Math.sin(pulsePhase * Math.PI * 2)) * emphMult
    const lineWidth = emphasized ? lineWidthEmph : lineWidthNormal

    // Draw dotted line
    const totalLength = dashLength + gapLength
    let currentDist = 0
    while (currentDist < lineDist) {
      const dashEnd = Math.min(currentDist + dashLength, lineDist)
      const t1 = currentDist / lineDist
      const t2 = dashEnd / lineDist
      this.ghostLinesGraphics.moveTo(startX + dx * t1, startY + dy * t1)
      this.ghostLinesGraphics.lineTo(startX + dx * t2, startY + dy * t2)
      this.ghostLinesGraphics.stroke({ color, width: lineWidth, alpha: Math.min(1, alpha) })
      currentDist += totalLength
    }

    // Draw animated arrow(s)
    const arrowSize = emphasized ? arrowSizeEmph : arrowSizeNormal
    const arrowAlpha = Math.min(1, alpha * 1.5)
    const animOffset = (Date.now() % arrowAnimCycle) / arrowAnimCycle

    if (bidirectional) {
      // Two arrows moving toward center
      const arrowT = arrowStartT + animOffset * arrowRangeT
      const arrow1X = startX + (midX - startX) * arrowT * 2
      const arrow1Y = startY + (midY - startY) * arrowT * 2
      const arrow2X = endX + (midX - endX) * arrowT * 2
      const arrow2Y = endY + (midY - endY) * arrowT * 2
      this.drawChevronArrow(arrow1X, arrow1Y, nx, ny, arrowSize, color, arrowAlpha)
      this.drawChevronArrow(arrow2X, arrow2Y, -nx, -ny, arrowSize, color, arrowAlpha)
    } else {
      // Single arrow moving toward end
      const arrowT = arrowStartT + animOffset * arrowRangeT
      const arrowX = startX + dx * arrowT
      const arrowY = startY + dy * arrowT
      this.drawChevronArrow(arrowX, arrowY, nx, ny, arrowSize, color, arrowAlpha)
    }

    // Optional midpoint icon (merge indicator)
    if (midIcon && emphasized) {
      const iconSize = 8 + 3 * Math.sin(pulsePhase * Math.PI * 2)
      this.ghostLinesGraphics.circle(midX, midY, iconSize)
      this.ghostLinesGraphics.stroke({ color, width: 2, alpha: arrowAlpha })
    }

    // Optional endpoint icon (drop zone)
    if (endIcon) {
      const iconX = endX + nx * 15
      const iconY = endY + ny * 15
      const iconSize = emphasized
        ? endIcon.sizeEmph + 2 * Math.sin(pulsePhase * Math.PI * 2)
        : endIcon.sizeNormal + 1.5 * Math.sin(pulsePhase * Math.PI * 2)
      this.ghostLinesGraphics.circle(iconX, iconY, iconSize)
      this.ghostLinesGraphics.stroke({ color, width: emphasized ? 2.5 : 2, alpha: arrowAlpha })
    }
  }

  /**
   * Draw a ghost line with drag hint between two duplicate packages
   */
  private drawGhostLineWithHint(
    x1: number, y1: number, x2: number, y2: number,
    color: number, pulsePhase: number, isFirstDuplicate: boolean
  ): void {
    const dx = x2 - x1
    const dy = y2 - y1
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 60) return

    const nx = dx / dist
    const ny = dy / dist
    const offset = 40

    this.drawAnimatedGuideLine({
      startX: x1 + nx * offset, startY: y1 + ny * offset,
      endX: x2 - nx * offset, endY: y2 - ny * offset,
      color, pulsePhase, emphasized: isFirstDuplicate,
      bidirectional: true, midIcon: true,
    })
  }

  /**
   * Draw a chevron arrow pointing in direction (nx, ny)
   */
  private drawChevronArrow(
    x: number, y: number, nx: number, ny: number,
    size: number, color: number, alpha: number
  ): void {
    const px = -ny, py = nx
    const tipX = x + nx * size, tipY = y + ny * size
    const wing1X = x - nx * size * 0.3 + px * size * 0.5
    const wing1Y = y - ny * size * 0.3 + py * size * 0.5
    const wing2X = x - nx * size * 0.3 - px * size * 0.5
    const wing2Y = y - ny * size * 0.3 - py * size * 0.5

    this.ghostLinesGraphics.moveTo(wing1X, wing1Y)
    this.ghostLinesGraphics.lineTo(tipX, tipY)
    this.ghostLinesGraphics.lineTo(wing2X, wing2Y)
    this.ghostLinesGraphics.stroke({ color, width: 2, alpha })
  }

  /**
   * Draw a hoist guide line from package toward root
   */
  private drawHoistGuideLine(
    pkgX: number, pkgY: number, rootX: number, rootY: number,
    color: number, pulsePhase: number, isHovered: boolean
  ): void {
    const dx = rootX - pkgX
    const dy = rootY - pkgY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 80) return

    const nx = dx / dist
    const ny = dy / dist

    this.drawAnimatedGuideLine({
      startX: pkgX + nx * 45, startY: pkgY + ny * 45,
      endX: rootX - nx * 55, endY: rootY - ny * 55,
      color, pulsePhase, emphasized: isHovered,
      dashLength: 8, gapLength: 10,
      baseAlpha: 0.35, emphasisMult: 1.5,
      lineWidthNormal: 2, lineWidthEmph: 3,
      arrowSizeNormal: 8, arrowSizeEmph: 12,
      arrowAnimCycle: 1500, arrowStartT: 0.4, arrowRangeT: 0.4,
      endIcon: { sizeNormal: 5, sizeEmph: 7 },
    })
  }

  /**
   * Set symlink drag state (called from GameCanvas)
   */
  setSymlinkDragState(sourceId: string | null, targetId: string | null): void {
    this.symlinkDragSource = sourceId
    this.symlinkDragTarget = targetId
  }

  /**
   * Set hovered hoisted dep (for ephemeral lines)
   */
  setHoveredHoistedDep(hoistedId: string | null): void {
    this.nodeRenderer.setHoveredHoistedDep(hoistedId)
  }

  /**
   * Set hovered hoistable package (for prominent guide line)
   */
  setHoveredHoistable(packageId: string | null): void {
    this.hoveredHoistableId = packageId
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const centerX = this.app.screen.width / 2
    const centerY = this.app.screen.height / 2

    return {
      x: (screenX - centerX) / gameState.camera.zoom - gameState.camera.x,
      y: (screenY - centerY) / gameState.camera.zoom - gameState.camera.y,
    }
  }

  /**
   * Get the Pixi application
   */
  getApp(): Application {
    return this.app
  }

  /**
   * Get node renderer for click handling
   */
  getNodeRenderer(): NodeRenderer {
    return this.nodeRenderer
  }

  /**
   * Get effects renderer for spawning effects
   */
  getEffectsRenderer(): EffectsRenderer {
    return this.effectsRenderer
  }

  /**
   * Get black hole renderer for prestige animation
   */
  getBlackHoleRenderer(): BlackHoleRenderer {
    return this.blackHoleRenderer
  }

  /**
   * Set the prestige panel target position for gravity effects
   * Call this when the prestige panel position is known/changes
   */
  setPrestigeTarget(screenX: number, screenY: number): void {
    this.blackHoleRenderer.setPrestigeTarget(screenX, screenY)
  }

  /**
   * Get wire renderer for wire interaction
   */
  getWireRenderer(): WireRenderer {
    return this.wireRenderer
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const centerX = this.app.screen.width / 2
    const centerY = this.app.screen.height / 2

    return {
      x: centerX + (worldX + gameState.camera.x) * gameState.camera.zoom,
      y: centerY + (worldY + gameState.camera.y) * gameState.camera.zoom,
    }
  }

  /**
   * Resize handler
   */
  resize(): void {
    this.app.resize()
  }

  /**
   * Get edge indicator renderer for prestige reset
   */
  getEdgeIndicatorRenderer(): EdgeIndicatorRenderer {
    return this.edgeIndicatorRenderer
  }

  /**
   * Clear all hoisted deps (call after prestige)
   */
  clearHoistedDeps(): void {
    this.nodeRenderer.clearHoistedDeps()
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.nodeRenderer.clear()
    this.wireRenderer.clear()
    this.effectsRenderer.clear()
    this.blackHoleRenderer.clear()
    this.edgeIndicatorRenderer.clear()
    // Clean up background layer renderers
    this.backgroundNodeRenderer.clear()
    this.backgroundWireRenderer.clear()
    this.midgroundNodeRenderer.clear()
    this.midgroundWireRenderer.clear()
    this.app.destroy(true)
  }
}

// Singleton instance
let rendererInstance: GameRenderer | null = null

export function getRenderer(): GameRenderer {
  if (!rendererInstance) {
    rendererInstance = new GameRenderer()
  }
  return rendererInstance
}

export function destroyRenderer(): void {
  if (rendererInstance) {
    rendererInstance.destroy()
    rendererInstance = null
  }
}
