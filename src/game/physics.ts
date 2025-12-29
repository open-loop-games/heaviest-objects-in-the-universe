// Force-directed graph physics for node positioning
// Enhanced with tree-organizing forces for cleaner layouts

import { toRaw } from 'vue';
import { gameState, gameConfig } from './state';
import type { Package } from './types';
import { getAllDuplicateGroups } from './symlinks';

// Radial layout configuration
const RADIAL_CONFIG = {
  baseRadius: 120,          // Radius for depth 1
  radiusPerDepth: 100,      // Additional radius per depth level
  minAngularSpread: 0.15,   // Minimum radians per node (prevents cramping)
  anchorStrength: 0.12,     // Spring force toward anchor (higher = snappier)
  anchorBoostStrength: 0.4, // Anchor strength during organize boost (strong!)
  repulsionRange: 70,       // Reduced - anchors handle positioning now
  hardPushDistance: 35,     // Below this, extra push
  hardPushMultiplier: 2.5,  // Close-range repulsion multiplier
  phasingDuration: 2.0,     // Seconds of phasing after reparent
  phasingRepulsionMult: 0.05, // Very low repulsion while phasing
  organizeBoostDuration: 2.5, // Seconds of boosted anchor pull after merge
  chaosJitter: 5,           // Minimal - anchors provide structure
};

// Track organize boost state
let organizeBoostTimer = 0;
let lastCleanliness = 1;

// Track packages that recently changed parents (for "phasing" through crowds)
// Maps packageId -> remaining phasing time in seconds
const phasingPackages = new Map<string, number>();

// Anchor positions for radial layout
// Maps packageId -> { x, y } target position
const anchorPositions = new Map<string, { x: number; y: number }>();

/**
 * Calculate subtree size (number of descendants + 1)
 */
function getSubtreeSize(pkgId: string, packages: Map<string, Package>): number {
  const pkg = packages.get(pkgId);
  if (!pkg) return 0;

  let size = 1;
  for (const childId of pkg.children) {
    size += getSubtreeSize(childId, packages);
  }
  return size;
}

/**
 * Compute radial anchor positions for all packages
 * Root at center, children in rings, subtrees get angular slices
 */
function computeRadialAnchors(packages: Map<string, Package>, rootId: string | null): void {
  anchorPositions.clear();

  if (!rootId) return;

  const root = packages.get(rootId);
  if (!root) return;

  // Root anchors at center
  anchorPositions.set(rootId, { x: 0, y: 0 });

  // Recursively assign anchors to children
  assignChildAnchors(rootId, 0, Math.PI * 2, packages);
}

/**
 * Recursively assign anchor positions to children
 * @param parentId - Parent package ID
 * @param startAngle - Start of angular slice (radians)
 * @param angleSpan - Total angle available for this subtree (radians)
 * @param packages - All packages
 */
function assignChildAnchors(
  parentId: string,
  startAngle: number,
  angleSpan: number,
  packages: Map<string, Package>
): void {
  const parent = packages.get(parentId);
  if (!parent || parent.children.length === 0) return;

  const childDepth = parent.depth + 1;
  const radius = RADIAL_CONFIG.baseRadius + (childDepth - 1) * RADIAL_CONFIG.radiusPerDepth;

  // Calculate subtree sizes for proportional angle distribution
  const childSizes: { id: string; size: number }[] = [];
  let totalSize = 0;

  for (const childId of parent.children) {
    const size = Math.max(1, getSubtreeSize(childId, packages));
    childSizes.push({ id: childId, size });
    totalSize += size;
  }

  // Distribute angles proportionally to subtree size
  let currentAngle = startAngle;

  for (const { id: childId, size } of childSizes) {
    // Angle for this subtree (proportional to size, with minimum)
    const proportion = size / totalSize;
    const childAngleSpan = Math.max(
      RADIAL_CONFIG.minAngularSpread,
      angleSpan * proportion
    );

    // Place child at center of its angular slice
    const childAngle = currentAngle + childAngleSpan / 2;

    // Calculate position (relative to CENTER, not parent)
    // This creates proper rings around root
    const x = Math.cos(childAngle) * radius;
    const y = Math.sin(childAngle) * radius;

    anchorPositions.set(childId, { x, y });

    // Recursively assign to this child's children
    assignChildAnchors(childId, currentAngle, childAngleSpan, packages);

    currentAngle += childAngleSpan;
  }
}

/**
 * Get anchor position for a package
 */
export function getAnchorPosition(pkgId: string): { x: number; y: number } | null {
  return anchorPositions.get(pkgId) || null;
}

/**
 * Mark a package as relocated (needs to phase through other nodes)
 * Call this when a package's parent changes (e.g., after symlink merge)
 *
 * Also performs a partial teleport toward the new anchor to avoid
 * long crossing wires during reorganization.
 */
export function markPackageRelocated(packageId: string): void {
  phasingPackages.set(packageId, RADIAL_CONFIG.phasingDuration);

  // Recompute anchors to get the new target position
  const rawPackages = toRaw(gameState.packages);
  computeRadialAnchors(rawPackages, gameState.rootId);

  // Partial teleport: immediately move 60% toward new anchor
  // This prevents ugly long wires during reorganization
  const pkg = gameState.packages.get(packageId);
  const anchor = anchorPositions.get(packageId);

  if (pkg && anchor) {
    const teleportFactor = 0.6; // Move 60% of the way instantly
    pkg.position.x = pkg.position.x + (anchor.x - pkg.position.x) * teleportFactor;
    pkg.position.y = pkg.position.y + (anchor.y - pkg.position.y) * teleportFactor;
    // Give it velocity toward anchor to continue smoothly
    pkg.velocity.vx = (anchor.x - pkg.position.x) * 0.1;
    pkg.velocity.vy = (anchor.y - pkg.position.y) * 0.1;
  }
}

/**
 * Check if a package is currently phasing (reduced repulsion)
 */
function isPhasing(packageId: string): boolean {
  return phasingPackages.has(packageId);
}

/**
 * Calculate cleanliness score (0-1)
 * 1 = no duplicates (perfect)
 * 0 = many duplicates (chaotic)
 */
export function calculateCleanliness(): number {
  const duplicateGroups = getAllDuplicateGroups();
  const totalPackages = gameState.packages.size;

  if (totalPackages <= 1) return 1;

  // Count total duplicate packages (packages that share identity with others)
  let duplicateCount = 0;
  for (const group of duplicateGroups) {
    // Each group has N packages, N-1 are "extra" duplicates
    duplicateCount += group.packageIds.length - 1;
  }

  // Cleanliness = 1 - (duplicates / total)
  // Clamp to reasonable range
  const rawCleanliness = 1 - (duplicateCount / totalPackages);
  return Math.max(0.1, Math.min(1, rawCleanliness));
}

/**
 * Trigger organize boost (call after merge)
 */
export function triggerOrganizeBoost(): void {
  organizeBoostTimer = RADIAL_CONFIG.organizeBoostDuration;
}

/**
 * Get anchor spring strength (boosted after merge)
 */
function getAnchorStrength(): number {
  return organizeBoostTimer > 0
    ? RADIAL_CONFIG.anchorBoostStrength
    : RADIAL_CONFIG.anchorStrength;
}

/**
 * Update physics simulation for all packages
 * Uses radial anchor layout with spring forces
 */
export function updatePhysics(deltaTime: number): void {
  // Update organize boost timer
  if (organizeBoostTimer > 0) {
    organizeBoostTimer = Math.max(0, organizeBoostTimer - deltaTime);
  }

  // Update phasing timers (for relocated packages)
  for (const [pkgId, timeLeft] of phasingPackages) {
    const newTime = timeLeft - deltaTime;
    if (newTime <= 0) {
      phasingPackages.delete(pkgId);
    } else {
      phasingPackages.set(pkgId, newTime);
    }
  }

  // Calculate current cleanliness
  const cleanliness = calculateCleanliness();
  lastCleanliness = cleanliness;

  // Use toRaw() to avoid Vue reactivity tracking in physics loop
  const rawPackages = toRaw(gameState.packages);
  const packages = Array.from(rawPackages.values());

  // Recompute radial anchor positions
  computeRadialAnchors(rawPackages, gameState.rootId);

  // Get anchor spring strength
  const anchorStrength = getAnchorStrength();
  const chaosAmount = 1 - cleanliness;

  for (const pkg of packages) {
    // Root stays anchored at origin
    if (pkg.parentId === null) {
      pkg.position.x = 0;
      pkg.position.y = 0;
      pkg.velocity.vx = 0;
      pkg.velocity.vy = 0;
      continue;
    }

    const forces = calculateForces(pkg, packages, anchorStrength, chaosAmount);

    // Apply forces to velocity
    pkg.velocity.vx += forces.fx * deltaTime;
    pkg.velocity.vy += forces.fy * deltaTime;

    // Apply damping
    const dampingFactor = gameConfig.damping;
    pkg.velocity.vx *= dampingFactor;
    pkg.velocity.vy *= dampingFactor;

    // Clamp velocity to prevent crazy speeds (safety limit)
    const maxSpeed = organizeBoostTimer > 0 ? 300 : 200;  // Allow faster during boost
    const speed = Math.sqrt(pkg.velocity.vx ** 2 + pkg.velocity.vy ** 2);
    if (speed > maxSpeed) {
      pkg.velocity.vx = (pkg.velocity.vx / speed) * maxSpeed;
      pkg.velocity.vy = (pkg.velocity.vy / speed) * maxSpeed;
    }

    // Update position
    pkg.position.x += pkg.velocity.vx;
    pkg.position.y += pkg.velocity.vy;
  }
}

/**
 * Calculate net force on a package using radial anchor system
 */
function calculateForces(
  pkg: Package,
  allPackages: Package[],
  anchorStrength: number,
  chaosAmount: number
): { fx: number; fy: number } {
  let fx = 0;
  let fy = 0;

  const pkgIsPhasing = isPhasing(pkg.id);

  // === SPRING FORCE TOWARD ANCHOR ===
  // This is the primary organizing force - pulls node toward its ideal radial position
  const anchor = anchorPositions.get(pkg.id);
  if (anchor) {
    const dx = anchor.x - pkg.position.x;
    const dy = anchor.y - pkg.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
      // Phasing packages get stronger anchor pull (rush to new position)
      const phasingMult = pkgIsPhasing ? 3.0 : 1.0;
      const force = anchorStrength * phasingMult;

      fx += dx * force;
      fy += dy * force;
    }
  }

  // === REPULSION FROM OTHER NODES ===
  // Light repulsion to prevent overlap - anchors do most positioning work
  const repulsionMult = pkgIsPhasing ? RADIAL_CONFIG.phasingRepulsionMult : 1.0;

  for (const other of allPackages) {
    if (other.id === pkg.id) continue;

    const dx = pkg.position.x - other.position.x;
    const dy = pkg.position.y - other.position.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);

    if (dist < 1 || dist > RADIAL_CONFIG.repulsionRange) continue;

    // If EITHER node is phasing, reduce repulsion
    const otherIsPhasing = isPhasing(other.id);
    const effectiveMult = (pkgIsPhasing || otherIsPhasing) ? RADIAL_CONFIG.phasingRepulsionMult : repulsionMult;

    // Hard push when very close
    const closeRangeMult = dist < RADIAL_CONFIG.hardPushDistance
      ? RADIAL_CONFIG.hardPushMultiplier
      : 1.0;

    const force = (gameConfig.nodeRepulsion / distSq) * effectiveMult * closeRangeMult;
    fx += (dx / dist) * force;
    fy += (dy / dist) * force;
  }

  // === CHAOS JITTER ===
  // Slight random movement when system is chaotic (many duplicates)
  if (chaosAmount > 0.3) {
    const jitterStrength = chaosAmount * RADIAL_CONFIG.chaosJitter;
    fx += (Math.random() - 0.5) * jitterStrength * 0.1;
    fy += (Math.random() - 0.5) * jitterStrength * 0.1;
  }

  return { fx, fy };
}

/**
 * Get last calculated cleanliness (for UI display)
 */
export function getCleanliness(): number {
  return lastCleanliness;
}

/**
 * Check if currently in organize boost
 */
export function isOrganizing(): boolean {
  return organizeBoostTimer > 0;
}

/**
 * Apply gravity pull toward center (for black hole effect)
 */
export function applyGravityEffect(_deltaTime: number, _gravityStrength: number): void {
  // TODO: Implement gravity pull for prestige mechanic
  // Nodes should drift toward center as gravity increases
}

// Internal scope anchor positions (separate from outer scope)
const internalAnchorPositions = new Map<string, { x: number; y: number }>();

// Internal scope physics configuration
const INTERNAL_CONFIG = {
  spacingPerNode: 70,        // Circumference space per node (scales with count)
  minRadius: 100,            // Minimum ring radius
  radiusPerDepth: 70,        // Additional radius per depth level
  minAngularSpread: 0.2,     // Minimum radians per node
  anchorStrength: 0.18,      // Slightly stronger than outer (snappier feel)
  repulsionRange: 60,        // Repulsion distance
  hardPushDistance: 30,      // Extra push when very close
  hardPushMultiplier: 3.0,   // Close-range multiplier
};

/**
 * Compute radial anchors for internal packages (tree-aware)
 * Similar to outer computeRadialAnchors but operates on internal package map
 */
function computeInternalAnchors(
  internalPackages: Map<string, Package>,
  scopeRootId: string
): void {
  internalAnchorPositions.clear();

  // Scope root is at center
  internalAnchorPositions.set(scopeRootId, { x: 0, y: 0 });

  // Find first-level packages (direct children of scope root)
  const firstLevel: Package[] = [];
  for (const pkg of internalPackages.values()) {
    if (pkg.parentId === scopeRootId) {
      firstLevel.push(pkg);
    }
  }

  if (firstLevel.length === 0) return;

  // Calculate radius based on count (scales dynamically)
  const circumferenceNeeded = firstLevel.length * INTERNAL_CONFIG.spacingPerNode;
  const calculatedRadius = circumferenceNeeded / (2 * Math.PI);
  const firstLevelRadius = Math.max(INTERNAL_CONFIG.minRadius, calculatedRadius);

  // Calculate subtree sizes for proportional angle distribution
  const subtreeSizes: { pkg: Package; size: number }[] = [];
  let totalSize = 0;

  for (const pkg of firstLevel) {
    const size = getInternalSubtreeSize(pkg.id, internalPackages);
    subtreeSizes.push({ pkg, size });
    totalSize += size;
  }

  // Distribute first-level packages around the ring
  let currentAngle = -Math.PI / 2; // Start from top

  for (const { pkg, size } of subtreeSizes) {
    // Angle span proportional to subtree size
    const proportion = size / totalSize;
    const angleSpan = Math.max(
      INTERNAL_CONFIG.minAngularSpread,
      (Math.PI * 2) * proportion
    );

    // Place at center of angular slice
    const pkgAngle = currentAngle + angleSpan / 2;
    const x = Math.cos(pkgAngle) * firstLevelRadius;
    const y = Math.sin(pkgAngle) * firstLevelRadius;

    internalAnchorPositions.set(pkg.id, { x, y });

    // Recursively assign anchors to children (sub-deps)
    assignInternalChildAnchors(
      pkg.id,
      pkgAngle,
      angleSpan,
      firstLevelRadius,
      2, // depth 2
      internalPackages
    );

    currentAngle += angleSpan;
  }
}

/**
 * Recursively assign anchor positions to internal children
 */
function assignInternalChildAnchors(
  parentId: string,
  parentAngle: number,
  angleSpan: number,
  parentRadius: number,
  depth: number,
  internalPackages: Map<string, Package>
): void {
  // Find children of this parent
  const children: Package[] = [];
  for (const pkg of internalPackages.values()) {
    if (pkg.parentId === parentId) {
      children.push(pkg);
    }
  }

  if (children.length === 0) return;

  // Children go in outer ring
  const childRadius = parentRadius + INTERNAL_CONFIG.radiusPerDepth;

  // Distribute children within parent's angular slice
  const angleStep = angleSpan / (children.length + 1);
  const startAngle = parentAngle - angleSpan / 2;

  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    const childAngle = startAngle + angleStep * (i + 1);

    const x = Math.cos(childAngle) * childRadius;
    const y = Math.sin(childAngle) * childRadius;

    internalAnchorPositions.set(child.id, { x, y });

    // Recurse for deeper levels (if any)
    assignInternalChildAnchors(
      child.id,
      childAngle,
      angleStep,
      childRadius,
      depth + 1,
      internalPackages
    );
  }
}

/**
 * Get subtree size for internal package
 */
function getInternalSubtreeSize(pkgId: string, internalPackages: Map<string, Package>): number {
  let size = 1;
  for (const pkg of internalPackages.values()) {
    if (pkg.parentId === pkgId) {
      size += getInternalSubtreeSize(pkg.id, internalPackages);
    }
  }
  return size;
}

/**
 * Update physics for internal packages of a specific scope
 * Uses proper tree-aware radial anchors (same approach as outer physics)
 */
export function updateInternalPhysics(scopePackageId: string, deltaTime: number): void {
  const scopePkg = gameState.packages.get(scopePackageId);
  if (!scopePkg || !scopePkg.internalPackages) return;

  const internalPackages = scopePkg.internalPackages;
  const packages = Array.from(internalPackages.values());
  if (packages.length === 0) return;

  // Compute tree-aware anchor positions (scales with count and depth)
  computeInternalAnchors(internalPackages, scopePackageId);

  for (const pkg of packages) {
    let fx = 0;
    let fy = 0;

    // === SPRING FORCE TOWARD ANCHOR ===
    const anchor = internalAnchorPositions.get(pkg.id);
    if (anchor) {
      const dx = anchor.x - pkg.position.x;
      const dy = anchor.y - pkg.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1) {
        fx += dx * INTERNAL_CONFIG.anchorStrength;
        fy += dy * INTERNAL_CONFIG.anchorStrength;
      }
    }

    // === REPULSION FROM OTHER NODES ===
    for (const other of packages) {
      if (other.id === pkg.id) continue;

      const rdx = pkg.position.x - other.position.x;
      const rdy = pkg.position.y - other.position.y;
      const distSq = rdx * rdx + rdy * rdy;
      const rDist = Math.sqrt(distSq);

      if (rDist < 1 || rDist > INTERNAL_CONFIG.repulsionRange) continue;

      // Hard push when very close
      const closeMult = rDist < INTERNAL_CONFIG.hardPushDistance
        ? INTERNAL_CONFIG.hardPushMultiplier
        : 1.0;

      const force = (150 / distSq) * closeMult;
      fx += (rdx / rDist) * force;
      fy += (rdy / rDist) * force;
    }

    // Apply forces
    pkg.velocity.vx += fx * deltaTime;
    pkg.velocity.vy += fy * deltaTime;

    // Damping
    const damping = 0.92;
    pkg.velocity.vx *= damping;
    pkg.velocity.vy *= damping;

    // Clamp velocity
    const maxSpeed = 150;
    const speed = Math.sqrt(pkg.velocity.vx ** 2 + pkg.velocity.vy ** 2);
    if (speed > maxSpeed) {
      pkg.velocity.vx = (pkg.velocity.vx / speed) * maxSpeed;
      pkg.velocity.vy = (pkg.velocity.vy / speed) * maxSpeed;
    }

    // Update position
    pkg.position.x += pkg.velocity.vx;
    pkg.position.y += pkg.velocity.vy;
  }
}
