// Force-directed graph physics for node positioning

import { gameState, gameConfig } from './state';
import type { Package } from './types';

/**
 * Update physics simulation for all packages
 * Uses force-directed layout: nodes repel, wires attract
 */
export function updatePhysics(deltaTime: number): void {
  const packages = Array.from(gameState.packages.values());

  for (const pkg of packages) {
    // Skip root - it stays at origin
    if (pkg.parentId === null) continue;

    const forces = calculateForces(pkg, packages);

    // Apply forces to velocity
    pkg.velocity.vx += forces.fx * deltaTime;
    pkg.velocity.vy += forces.fy * deltaTime;

    // Apply damping
    pkg.velocity.vx *= gameConfig.damping;
    pkg.velocity.vy *= gameConfig.damping;

    // Update position
    pkg.position.x += pkg.velocity.vx;
    pkg.position.y += pkg.velocity.vy;
  }
}

/**
 * Calculate net force on a package from repulsion and attraction
 */
function calculateForces(pkg: Package, allPackages: Package[]): { fx: number; fy: number } {
  let fx = 0;
  let fy = 0;

  // Repulsion from other nodes
  for (const other of allPackages) {
    if (other.id === pkg.id) continue;

    const dx = pkg.position.x - other.position.x;
    const dy = pkg.position.y - other.position.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);

    // Skip if too close (avoid division issues) or too far (optimization)
    if (dist < 1 || dist > 200) continue;

    const force = gameConfig.nodeRepulsion / distSq;
    fx += (dx / dist) * force;
    fy += (dy / dist) * force;
  }

  // Attraction to parent (via wire)
  const parent = gameState.packages.get(pkg.parentId!);
  if (parent) {
    const dx = parent.position.x - pkg.position.x;
    const dy = parent.position.y - pkg.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      const targetDist = 80 + pkg.depth * 10;
      const force = (dist - targetDist) * gameConfig.wireAttraction;

      fx += (dx / dist) * force;
      fy += (dy / dist) * force;
    }
  }

  return { fx, fy };
}

/**
 * Future: Apply gravity pull toward center (for black hole effect)
 * Called when weight exceeds threshold
 */
export function applyGravityEffect(_deltaTime: number, _gravityStrength: number): void {
  // TODO: Implement gravity pull for prestige mechanic
  // Nodes should drift toward center as gravity increases
}
