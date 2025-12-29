// Main renderer coordinating all rendering components

import { Application, Container } from 'pixi.js';
import { NodeRenderer } from './nodes';
import { WireRenderer } from './wires';
import { EffectsRenderer } from './effects';
import { BlackHoleRenderer } from './blackhole';
import { Colors } from './colors';
import { gameState } from '../game/state';
import { onTick } from '../game/loop';

export class GameRenderer {
  private app: Application;
  private worldContainer: Container;
  private nodeRenderer!: NodeRenderer;
  private wireRenderer!: WireRenderer;
  private effectsRenderer!: EffectsRenderer;
  private blackHoleRenderer!: BlackHoleRenderer;

  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };

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

    this.nodeRenderer = new NodeRenderer(this.app);
    this.worldContainer.addChild(this.nodeRenderer.getContainer());

    this.effectsRenderer = new EffectsRenderer(this.app);
    this.worldContainer.addChild(this.effectsRenderer.getContainer());

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

    // Update wires first (behind nodes)
    for (const wire of gameState.wires.values()) {
      const fromPkg = gameState.packages.get(wire.fromId);
      const toPkg = gameState.packages.get(wire.toId);

      if (fromPkg && toPkg) {
        this.wireRenderer.updateWire(wire, fromPkg, toPkg);
      }
    }

    // Update nodes with effects context
    const rootPulse = this.effectsRenderer.getRootPulseIntensity();
    const showHint = this.effectsRenderer.shouldShowClickHint();

    for (const pkg of gameState.packages.values()) {
      const isRoot = pkg.parentId === null;
      const pulseIntensity = isRoot ? rootPulse : 0;
      const shake = pkg.state === 'conflict' ? this.effectsRenderer.getConflictShake(pkg.conflictProgress) : { x: 0, y: 0 };

      this.nodeRenderer.updateNode(pkg, { pulseIntensity, shake, showHint: isRoot && showHint });
    }
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
   * Resize handler
   */
  resize(): void {
    this.app.resize();
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.nodeRenderer.clear();
    this.wireRenderer.clear();
    this.effectsRenderer.clear();
    this.blackHoleRenderer.clear();
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
