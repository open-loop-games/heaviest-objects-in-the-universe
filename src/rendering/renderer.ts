// Main renderer coordinating all rendering components

import { Application, Container, Graphics } from 'pixi.js';
import { toRaw } from 'vue';
import { NodeRenderer } from './nodes';
import { WireRenderer } from './wires';
import { EffectsRenderer } from './effects';
import { BlackHoleRenderer } from './blackhole';
import { EdgeIndicatorRenderer } from './edge-indicators';
import { Colors } from './colors';
import { gameState } from '../game/state';
import { getCurrentScopePackages, getCurrentScopeWires, isInPackageScope } from '../game/scope';
import { onTick } from '../game/loop';
import { updateDuplicateGroups, getDuplicateGroup, getAllDuplicateGroups } from '../game/symlinks';
import { updateCrossPackageConflicts, updateCrossPackageDuplicates, getSiblingWires, getCrossPackageDuplicateInfo, getCrossPackageDuplicates } from '../game/cross-package';
import { getCleanliness, isOrganizing } from '../game/physics';

export class GameRenderer {
  private app: Application;
  private worldContainer: Container;
  private nodeRenderer!: NodeRenderer;
  private wireRenderer!: WireRenderer;
  private effectsRenderer!: EffectsRenderer;
  private blackHoleRenderer!: BlackHoleRenderer;
  private edgeIndicatorRenderer!: EdgeIndicatorRenderer;
  private ghostLinesGraphics!: Graphics;

  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };

  // Symlink drag state (managed externally via setSymlinkDragState)
  private symlinkDragSource: string | null = null;
  private symlinkDragTarget: string | null = null;

  constructor() {
    this.app = new Application();
    this.worldContainer = new Container();
    this.worldContainer.label = 'world';
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
    });

    // Create black hole renderer (needs to be split between bg and foreground)
    this.blackHoleRenderer = new BlackHoleRenderer(this.app);

    // Add world container with proper z-ordering
    // Background effects (gravity warp) -> behind world
    this.app.stage.addChild(this.blackHoleRenderer.getBackgroundContainer());
    this.app.stage.addChild(this.worldContainer);
    // Core effects (black hole, collapse) -> in front during collapse
    this.app.stage.addChild(this.blackHoleRenderer.getCoreContainer());

    // Create sub-renderers (order matters for z-index)
    this.wireRenderer = new WireRenderer(this.app);
    this.worldContainer.addChild(this.wireRenderer.getContainer());

    // Ghost lines for duplicate hints (between wires and nodes)
    this.ghostLinesGraphics = new Graphics();
    this.ghostLinesGraphics.label = 'ghost-lines';
    this.worldContainer.addChild(this.ghostLinesGraphics);

    this.nodeRenderer = new NodeRenderer(this.app);
    this.worldContainer.addChild(this.nodeRenderer.getContainer());

    this.effectsRenderer = new EffectsRenderer(this.app);
    this.worldContainer.addChild(this.effectsRenderer.getContainer());

    // Edge indicators (screen-space, on top of everything)
    this.edgeIndicatorRenderer = new EdgeIndicatorRenderer(this.app);
    this.app.stage.addChild(this.edgeIndicatorRenderer.getContainer());
    this.edgeIndicatorRenderer.setWorldToScreen((x, y) => this.worldToScreen(x, y));

    // Center world
    this.worldContainer.x = this.app.screen.width / 2;
    this.worldContainer.y = this.app.screen.height / 2;

    // Set up input handlers
    this.setupInput(canvas);

    // Register tick callback
    onTick((deltaTime) => this.render(deltaTime));
  }

  /**
   * Set up input handlers for pan/zoom
   */
  private setupInput(canvas: HTMLCanvasElement): void {
    // Pan with middle mouse or drag
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        this.isDragging = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.lastMousePos.x;
        const dy = e.clientY - this.lastMousePos.y;

        gameState.camera.x += dx / gameState.camera.zoom;
        gameState.camera.y += dy / gameState.camera.zoom;

        this.lastMousePos = { x: e.clientX, y: e.clientY };
      }
    });

    canvas.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    canvas.addEventListener('mouseleave', () => {
      this.isDragging = false;
    });

    // Zoom with scroll wheel
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(5, gameState.camera.zoom * zoomFactor));

      // Zoom toward mouse position
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - this.app.screen.width / 2;
      const mouseY = e.clientY - rect.top - this.app.screen.height / 2;

      // Adjust camera to zoom toward mouse
      const worldMouseX = (mouseX / gameState.camera.zoom) - gameState.camera.x;
      const worldMouseY = (mouseY / gameState.camera.zoom) - gameState.camera.y;

      gameState.camera.zoom = newZoom;

      const newWorldMouseX = (mouseX / newZoom) - gameState.camera.x;
      const newWorldMouseY = (mouseY / newZoom) - gameState.camera.y;

      gameState.camera.x += newWorldMouseX - worldMouseX;
      gameState.camera.y += newWorldMouseY - worldMouseY;
    }, { passive: false });
  }

  /**
   * Main render function called each frame
   */
  render(deltaTime: number = 0.016): void {
    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;

    // Update background color based on cleanliness
    this.updateBackgroundColor();

    // Update black hole effects
    this.blackHoleRenderer.update(deltaTime, screenWidth, screenHeight);

    // Get shake offset from black hole
    const shake = this.blackHoleRenderer.getShakeOffset();

    // Update camera with shake
    this.worldContainer.x = screenWidth / 2 + gameState.camera.x * gameState.camera.zoom + shake.x;
    this.worldContainer.y = screenHeight / 2 + gameState.camera.y * gameState.camera.zoom + shake.y;
    this.worldContainer.scale.set(gameState.camera.zoom);

    // Position black hole containers at screen center
    this.blackHoleRenderer.getBackgroundContainer().x = screenWidth / 2;
    this.blackHoleRenderer.getBackgroundContainer().y = screenHeight / 2;
    this.blackHoleRenderer.getCoreContainer().x = screenWidth / 2;
    this.blackHoleRenderer.getCoreContainer().y = screenHeight / 2;

    // Update effects
    this.effectsRenderer.update(deltaTime);

    // Update edge indicators (screen-space)
    this.edgeIndicatorRenderer.update(screenWidth, screenHeight);

    // Update duplicate groups for symlink detection (scope-aware)
    updateDuplicateGroups();

    // Update cross-package systems (sibling conflicts, cross-package duplicates)
    updateCrossPackageConflicts();
    updateCrossPackageDuplicates();

    // Use toRaw() to avoid Vue reactivity tracking in render loop
    // Use scope-aware getters for packages and wires
    const inScope = isInPackageScope();
    const scopePackages = toRaw(getCurrentScopePackages());
    const scopeWires = toRaw(getCurrentScopeWires());

    // When in package scope, we also need to render the scope root (parent package)
    // Create a combined package map for rendering
    const rawPackages: Map<string, typeof gameState.packages extends Map<string, infer V> ? V : never> = new Map(scopePackages);
    let scopeRootPkg: ReturnType<typeof gameState.packages.get> | null = null;

    if (inScope) {
      // Get the scope root package from the main packages map
      scopeRootPkg = gameState.packages.get(gameState.currentScope) || null;
      if (scopeRootPkg) {
        // Add scope root to our rendering map (it acts as local root at position 0,0)
        const scopeRootForRender = {
          ...toRaw(scopeRootPkg),
          // Override position to (0,0) for internal view
          position: { x: 0, y: 0 },
          // Treat as root within scope (no parent in this context)
          parentId: null,
        };
        rawPackages.set(scopeRootPkg.id, scopeRootForRender);
      }
    }

    const rawWires = scopeWires;

    // Update wires first (behind nodes)
    for (const wire of rawWires.values()) {
      const fromPkg = rawPackages.get(wire.fromId);
      const toPkg = rawPackages.get(wire.toId);

      if (fromPkg && toPkg) {
        this.wireRenderer.updateWire(wire, fromPkg, toPkg);
      }
    }

    // Render sibling wires at root scope (cross-package conflicts)
    if (!inScope) {
      const siblingWires = getSiblingWires();
      for (const wire of siblingWires.values()) {
        const fromPkg = rawPackages.get(wire.fromId);
        const toPkg = rawPackages.get(wire.toId);

        if (fromPkg && toPkg) {
          this.wireRenderer.updateWire(wire, fromPkg, toPkg);
        }
      }
    }

    // Draw ghost lines between duplicates
    this.drawGhostLines();

    // Update nodes with effects context
    const rootPulse = this.effectsRenderer.getRootPulseIntensity();
    const showHint = this.effectsRenderer.shouldShowClickHint();

    // Calculate synced pulse phase for duplicates (1.5s cycle)
    const pulsePhase = (Date.now() % 1500) / 1500;

    // Get first conflict dimming intensity
    const firstConflictDim = this.edgeIndicatorRenderer.getFirstConflictDimming();

    // Check which packages are involved in conflicts (don't dim them)
    const conflictPackageIds = new Set<string>();
    for (const wire of rawWires.values()) {
      if (wire.conflicted) {
        conflictPackageIds.add(wire.fromId);
        conflictPackageIds.add(wire.toId);
      }
    }

    for (const pkg of rawPackages.values()) {
      const isRoot = pkg.parentId === null;
      const pulseIntensity = isRoot ? rootPulse : 0;
      const shakeOffset = pkg.state === 'conflict' ? this.effectsRenderer.getConflictShake(pkg.conflictProgress) : { x: 0, y: 0 };

      // Is this a top-level package (direct child of root)?
      const isTopLevel = !inScope && pkg.parentId === gameState.rootId;

      // Get duplicate halo info if applicable (getDuplicateGroup is scope-aware)
      let duplicateHalo: { color: number; pulsePhase: number } | undefined;
      const group = getDuplicateGroup(pkg.id);
      if (group) {
        duplicateHalo = {
          color: group.haloColor,
          pulsePhase: pulsePhase,
        };
      }

      // At root scope, also check for cross-package duplicates (packages sharing internal deps)
      if (!inScope && isTopLevel) {
        const crossDupInfo = getCrossPackageDuplicateInfo(pkg.id);
        if (crossDupInfo && !duplicateHalo) {
          duplicateHalo = {
            color: crossDupInfo.haloColor,
            pulsePhase: pulsePhase,
          };
        }
      }

      // Check if this node is involved in drag operation
      const isDragging = this.symlinkDragSource === pkg.id;
      const isDropTarget = this.symlinkDragTarget === pkg.id;

      // Dim non-conflict nodes during first conflict treatment
      const dimAmount = conflictPackageIds.has(pkg.id) ? 0 : firstConflictDim;

      // Internal state glow for top-level packages
      const internalState = isTopLevel ? pkg.internalState : null;

      // Ghost node rendering (cross-package symlink)
      const isGhost = pkg.isGhost || false;
      const ghostTargetScope = pkg.ghostTargetScope || null;

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
      });
    }

    // Clean up nodes that no longer exist in current scope
    // Protect the current scope's root (global root at root scope, or scope package when inside)
    const currentPackageIds = new Set(rawPackages.keys());
    const protectedRootId = inScope ? gameState.currentScope : gameState.rootId;
    for (const [nodeId] of this.nodeRenderer.getAllNodeGraphics()) {
      if (!currentPackageIds.has(nodeId) && nodeId !== protectedRootId) {
        this.nodeRenderer.removeNode(nodeId);
      }
    }

    // Clean up wires that no longer exist
    // Include both regular wires and sibling wires
    const currentWireIds = new Set(rawWires.keys());
    const siblingWires = !inScope ? getSiblingWires() : new Map();
    for (const siblingId of siblingWires.keys()) {
      currentWireIds.add(siblingId);
    }

    for (const wireId of this.wireRenderer.getAllWireIds()) {
      if (!currentWireIds.has(wireId)) {
        this.wireRenderer.removeWire(wireId);
      }
    }
  }

  /**
   * Draw ghost lines between duplicates with drag hint arrows
   * SCOPE-AWARE: Works for both root scope and inside package scopes
   */
  private drawGhostLines(): void {
    this.ghostLinesGraphics.clear();

    const inScope = isInPackageScope();
    const groups = getAllDuplicateGroups(); // Already scope-aware
    const pulsePhase = (Date.now() % 1500) / 1500;

    // Get packages from current scope
    const scopePackages = inScope
      ? toRaw(getCurrentScopePackages())
      : toRaw(gameState.packages);

    // Check if this is the first time seeing duplicates (teaching moment)
    const isFirstDuplicates = !gameState.onboarding.firstSymlinkSeen && groups.length > 0;

    for (const group of groups) {
      // Draw lines between all pairs in the group
      const ids = group.packageIds;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const pkgA = scopePackages.get(ids[i]!);
          const pkgB = scopePackages.get(ids[j]!);

          if (pkgA && pkgB) {
            this.drawGhostLineWithHint(
              pkgA.position.x, pkgA.position.y,
              pkgB.position.x, pkgB.position.y,
              group.haloColor,
              pulsePhase,
              isFirstDuplicates
            );
          }
        }
      }
    }

    // Cross-package duplicates only apply at root scope
    if (!inScope) {
      const crossDups = getCrossPackageDuplicates();
      const drawnPairs = new Set<string>(); // Avoid duplicate lines for same pair

      for (const dup of crossDups) {
        const pairKey = [dup.packageAId, dup.packageBId].sort().join(':');
        if (drawnPairs.has(pairKey)) continue;
        drawnPairs.add(pairKey);

        const pkgA = scopePackages.get(dup.packageAId);
        const pkgB = scopePackages.get(dup.packageBId);

        if (pkgA && pkgB) {
          this.drawGhostLineWithHint(
            pkgA.position.x, pkgA.position.y,
            pkgB.position.x, pkgB.position.y,
            dup.haloColor,
            pulsePhase,
            isFirstDuplicates
          );
        }
      }
    }
  }

  /**
   * Update background color based on cleanliness
   * Chaotic = warm tint, Clean = cool/neutral, Organizing = cyan pulse
   */
  private updateBackgroundColor(): void {
    const cleanliness = getCleanliness();
    const organizing = isOrganizing();

    // Base colors (RGB components)
    // Chaotic: warmer, slightly reddish #181420
    // Clean: cooler, neutral blue #0e0e18
    // Organizing: brief cyan pulse #0a1820

    const chaoticR = 0x18, chaoticG = 0x14, chaoticB = 0x20;
    const cleanR = 0x0e, cleanG = 0x0e, cleanB = 0x18;
    const organizeR = 0x0a, organizeG = 0x18, organizeB = 0x20;

    let r, g, b;

    if (organizing) {
      // During organize boost, pulse toward cyan tint
      const pulse = 0.3 + 0.2 * Math.sin(Date.now() * 0.01);
      r = Math.floor(cleanR + (organizeR - cleanR) * pulse);
      g = Math.floor(cleanG + (organizeG - cleanG) * pulse);
      b = Math.floor(cleanB + (organizeB - cleanB) * pulse);
    } else {
      // Interpolate between chaotic and clean based on cleanliness
      r = Math.floor(chaoticR + (cleanR - chaoticR) * cleanliness);
      g = Math.floor(chaoticG + (cleanG - chaoticG) * cleanliness);
      b = Math.floor(chaoticB + (cleanB - chaoticB) * cleanliness);
    }

    const bgColor = (r << 16) | (g << 8) | b;
    this.app.renderer.background.color = bgColor;
  }

  /**
   * Draw a ghost line with drag hint between two duplicate packages
   */
  private drawGhostLineWithHint(
    x1: number, y1: number,
    x2: number, y2: number,
    color: number,
    pulsePhase: number,
    isFirstDuplicate: boolean
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 60) return; // Too close, don't draw

    // Normalize
    const nx = dx / dist;
    const ny = dy / dist;

    // Offset from node centers
    const offset = 40;
    const startX = x1 + nx * offset;
    const startY = y1 + ny * offset;
    const endX = x2 - nx * offset;
    const endY = y2 - ny * offset;

    // Midpoint for merge indicator
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    // Enhanced visibility for first duplicate (teaching moment)
    const emphasisMultiplier = isFirstDuplicate ? 2.0 : 1.0;

    // Pulsing alpha - stronger for first duplicate
    const baseAlpha = isFirstDuplicate ? 0.35 : 0.15;
    const alpha = (baseAlpha + 0.15 * Math.sin(pulsePhase * Math.PI * 2)) * emphasisMultiplier;

    // Draw dotted line
    const dashLength = 6;
    const gapLength = 8;
    const totalLength = dashLength + gapLength;
    const lineWidth = isFirstDuplicate ? 2.5 : 1.5;

    let currentDist = 0;
    const lineDist = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);

    while (currentDist < lineDist) {
      const dashEnd = Math.min(currentDist + dashLength, lineDist);
      const t1 = currentDist / lineDist;
      const t2 = dashEnd / lineDist;

      this.ghostLinesGraphics.moveTo(
        startX + (endX - startX) * t1,
        startY + (endY - startY) * t1
      );
      this.ghostLinesGraphics.lineTo(
        startX + (endX - startX) * t2,
        startY + (endY - startY) * t2
      );
      this.ghostLinesGraphics.stroke({ color, width: lineWidth, alpha: Math.min(1, alpha) });

      currentDist += totalLength;
    }

    // Draw animated merge arrows pointing toward center (drag hint)
    const arrowSize = isFirstDuplicate ? 10 : 7;
    const arrowAlpha = Math.min(1, alpha * 1.5);

    // Animated position - arrows move toward center
    const animOffset = ((Date.now() % 2000) / 2000); // 0-1 cycle over 2 seconds

    // Arrow from start toward middle
    const arrow1T = 0.2 + animOffset * 0.25;
    const arrow1X = startX + (midX - startX) * arrow1T * 2;
    const arrow1Y = startY + (midY - startY) * arrow1T * 2;

    // Arrow from end toward middle
    const arrow2T = 0.2 + animOffset * 0.25;
    const arrow2X = endX + (midX - endX) * arrow2T * 2;
    const arrow2Y = endY + (midY - endY) * arrow2T * 2;

    // Draw chevron arrows pointing toward midpoint
    this.drawChevronArrow(arrow1X, arrow1Y, nx, ny, arrowSize, color, arrowAlpha);
    this.drawChevronArrow(arrow2X, arrow2Y, -nx, -ny, arrowSize, color, arrowAlpha);

    // Draw merge icon at midpoint (pulsing circle)
    if (isFirstDuplicate) {
      const mergeIconSize = 8 + 3 * Math.sin(pulsePhase * Math.PI * 2);
      this.ghostLinesGraphics.circle(midX, midY, mergeIconSize);
      this.ghostLinesGraphics.stroke({ color, width: 2, alpha: arrowAlpha });
    }
  }

  /**
   * Draw a chevron arrow pointing in direction (nx, ny)
   */
  private drawChevronArrow(
    x: number, y: number,
    nx: number, ny: number,
    size: number,
    color: number,
    alpha: number
  ): void {
    // Perpendicular vector
    const px = -ny;
    const py = nx;

    // Arrow tip
    const tipX = x + nx * size;
    const tipY = y + ny * size;

    // Arrow wings
    const wing1X = x - nx * size * 0.3 + px * size * 0.5;
    const wing1Y = y - ny * size * 0.3 + py * size * 0.5;
    const wing2X = x - nx * size * 0.3 - px * size * 0.5;
    const wing2Y = y - ny * size * 0.3 - py * size * 0.5;

    // Draw chevron
    this.ghostLinesGraphics.moveTo(wing1X, wing1Y);
    this.ghostLinesGraphics.lineTo(tipX, tipY);
    this.ghostLinesGraphics.lineTo(wing2X, wing2Y);
    this.ghostLinesGraphics.stroke({ color, width: 2, alpha });
  }

  /**
   * Set symlink drag state (called from GameCanvas)
   */
  setSymlinkDragState(sourceId: string | null, targetId: string | null): void {
    this.symlinkDragSource = sourceId;
    this.symlinkDragTarget = targetId;
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const centerX = this.app.screen.width / 2;
    const centerY = this.app.screen.height / 2;

    return {
      x: (screenX - centerX) / gameState.camera.zoom - gameState.camera.x,
      y: (screenY - centerY) / gameState.camera.zoom - gameState.camera.y,
    };
  }

  /**
   * Get the Pixi application
   */
  getApp(): Application {
    return this.app;
  }

  /**
   * Get node renderer for click handling
   */
  getNodeRenderer(): NodeRenderer {
    return this.nodeRenderer;
  }

  /**
   * Get effects renderer for spawning effects
   */
  getEffectsRenderer(): EffectsRenderer {
    return this.effectsRenderer;
  }

  /**
   * Get black hole renderer for prestige animation
   */
  getBlackHoleRenderer(): BlackHoleRenderer {
    return this.blackHoleRenderer;
  }

  /**
   * Get wire renderer for wire interaction
   */
  getWireRenderer(): WireRenderer {
    return this.wireRenderer;
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const centerX = this.app.screen.width / 2;
    const centerY = this.app.screen.height / 2;

    return {
      x: centerX + (worldX + gameState.camera.x) * gameState.camera.zoom,
      y: centerY + (worldY + gameState.camera.y) * gameState.camera.zoom,
    };
  }

  /**
   * Resize handler
   */
  resize(): void {
    this.app.resize();
  }

  /**
   * Get edge indicator renderer for prestige reset
   */
  getEdgeIndicatorRenderer(): EdgeIndicatorRenderer {
    return this.edgeIndicatorRenderer;
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.nodeRenderer.clear();
    this.wireRenderer.clear();
    this.effectsRenderer.clear();
    this.blackHoleRenderer.clear();
    this.edgeIndicatorRenderer.clear();
    this.app.destroy(true);
  }
}

// Singleton instance
let rendererInstance: GameRenderer | null = null;

export function getRenderer(): GameRenderer {
  if (!rendererInstance) {
    rendererInstance = new GameRenderer();
  }
  return rendererInstance;
}

export function destroyRenderer(): void {
  if (rendererInstance) {
    rendererInstance.destroy();
    rendererInstance = null;
  }
}
