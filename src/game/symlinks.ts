// Symlink detection and merge — scope-aware via graph + stack.

import { gameState, generateWireId, graph, stack } from './state'
import {
  getCurrentScopeRoot,
  getGraphAtPath,
  isCurrentScopeRoot,
  isInPackageScope,
  isRootPackage,
} from './scope'
import type { Package, Wire } from './types'
import { updateCrossPackageDuplicates } from './cross-package'
import { onSymlinkMerged } from './mutations'
import { emit } from './events'
import {
  HALO_COLORS,
  COMBO_MAX,
  COMBO_WEIGHT_RETENTION_MIN,
  COMBO_WEIGHT_RETENTION_MAX,
} from './config'
import { recordSymlink, checkAchievements } from './achievements'
import type { Graph } from '@open-loop/engine'

export interface DuplicateGroup {
  identityName: string
  packageIds: string[]
  haloColor: number
  haloColorIndex: number
}

const duplicateGroups: Map<string, DuplicateGroup> = new Map()

let duplicateGroupsDirty = true
let lastScopeStackLength = -1

export function markDuplicateGroupsDirty(): void {
  duplicateGroupsDirty = true
}

// ============================================
// COMBO WEIGHT RETENTION
// ============================================

function getComboWeightRetention(): number {
  const combo = gameState.stats.comboCount
  const t = combo / COMBO_MAX
  return (
    COMBO_WEIGHT_RETENTION_MIN +
    t * (COMBO_WEIGHT_RETENTION_MAX - COMBO_WEIGHT_RETENTION_MIN)
  )
}

// ============================================
// HELPERS
// ============================================

function currentScopeGraph(): Graph<Package, Wire> {
  return stack.current
}

function currentScopeOwnerId(): string | null {
  return stack.depth === 0 ? null : stack.path[stack.path.length - 1]!
}

/** Iterate user-visible packages in the current scope (skipping the shadow
 *  scope-owner when inside a scope). */
function* iterateScopePackages(): Generator<{ id: string; pkg: Package }> {
  const g = currentScopeGraph()
  const ownerId = currentScopeOwnerId()
  for (const [id, node] of g.nodes) {
    if (ownerId !== null && id === ownerId) continue
    yield { id, pkg: node.data }
  }
}

// ============================================
// DUPLICATE DETECTION
// ============================================

export function updateDuplicateGroups(): void {
  const currentScopeLength = stack.depth
  if (currentScopeLength !== lastScopeStackLength) {
    duplicateGroupsDirty = true
    lastScopeStackLength = currentScopeLength
  }

  if (!duplicateGroupsDirty) return
  duplicateGroupsDirty = false

  duplicateGroups.clear()

  const identityGroups = new Map<string, string[]>()

  for (const { id, pkg } of iterateScopePackages()) {
    if (!pkg.identity) continue
    if (pkg.isGhost) continue

    // At root scope, exclude root.
    if (!isInPackageScope() && isRootPackage(id)) continue

    // At root scope, exclude packages with non-empty internal scope (these
    // are top-level packages with portal rings — they can't be naively
    // merged because their internals carry meaningful state).
    if (!isInPackageScope()) {
      const child = graph.getChildGraph(id)
      // child has shadow-only when pristine; size > 1 means populated.
      if (child && child.nodes.size > 1) continue
    }

    const name = pkg.identity.name
    const group = identityGroups.get(name) || []
    group.push(id)
    identityGroups.set(name, group)
  }

  let colorIndex = 0
  for (const [name, ids] of identityGroups) {
    if (ids.length >= 2) {
      duplicateGroups.set(name, {
        identityName: name,
        packageIds: ids,
        haloColor: HALO_COLORS[colorIndex % HALO_COLORS.length]!,
        haloColorIndex: colorIndex % HALO_COLORS.length,
      })
      colorIndex++
    }
  }

  if (duplicateGroups.size > 0 && !gameState.onboarding.firstSymlinkSeen) {
    gameState.onboarding.firstSymlinkSeen = true
  }
}

export function getDuplicateGroup(packageId: string): DuplicateGroup | null {
  const g = currentScopeGraph()
  const node = g.getNode(packageId)
  if (!node?.data.identity) return null

  return duplicateGroups.get(node.data.identity.name) || null
}

export function hasDuplicates(packageId: string): boolean {
  return getDuplicateGroup(packageId) !== null
}

export function getAllDuplicateGroups(): DuplicateGroup[] {
  return Array.from(duplicateGroups.values())
}

export function getOtherDuplicates(packageId: string): Package[] {
  const group = getDuplicateGroup(packageId)
  if (!group) return []

  const g = currentScopeGraph()
  return group.packageIds
    .filter((id) => id !== packageId)
    .map((id) => g.getNode(id)?.data)
    .filter((pkg): pkg is Package => pkg !== undefined)
}

// ============================================
// SYMLINK OPERATIONS
// ============================================

export function canSymlink(sourceId: string, targetId: string): boolean {
  if (sourceId === targetId) return false
  if (isCurrentScopeRoot(sourceId)) return false

  const g = currentScopeGraph()
  const source = g.getNode(sourceId)?.data
  const target = g.getNode(targetId)?.data

  if (!source?.identity || !target?.identity) return false
  if (source.identity.name !== target.identity.name) return false

  return true
}

export function canAffordSymlinkMerge(): boolean {
  return true
}

export function getSymlinkMergeCost(): number {
  return 0
}

export interface MergeResult {
  weightSaved: number
  bandwidthRefund: number
}

function isCompressed(g: Graph<Package, Wire>, pkgId: string): boolean {
  return g.getChildGraph(pkgId) !== null
}

function shouldKeep(g: Graph<Package, Wire>, a: Package, b: Package): boolean {
  const aCompressed = isCompressed(g, a.id)
  const bCompressed = isCompressed(g, b.id)
  if (aCompressed !== bCompressed) {
    return aCompressed
  }

  if (a.depth !== b.depth) {
    return a.depth < b.depth
  }

  const distA = Math.sqrt(a.position.x ** 2 + a.position.y ** 2)
  const distB = Math.sqrt(b.position.x ** 2 + b.position.y ** 2)
  return distA < distB
}

/**
 * Perform a symlink merge in the current scope. The source vanishes; its
 * dependency edges are redirected to point at the target (modulo dedup).
 * Returns the weight saved (0 if the merge couldn't proceed).
 */
export function performSymlinkMerge(
  sourceId: string,
  targetId: string
): number {
  if (!canSymlink(sourceId, targetId)) return 0

  emit('player:action')

  const g = currentScopeGraph()
  const inScope = isInPackageScope()

  let source = g.getNode(sourceId)?.data
  let target = g.getNode(targetId)?.data
  if (!source || !target) return 0

  if (shouldKeep(g, source, target)) {
    ;[source, target] = [target, source]
    ;[sourceId, targetId] = [targetId, sourceId]
  }

  const retention = getComboWeightRetention()
  const weightRemoved = Math.floor(source.size * (1 - retention))
  const weightSaved = source.size - weightRemoved
  const mergePosition = { x: source.position.x, y: source.position.y }

  onSymlinkMerged(weightSaved, mergePosition)

  gameState.resources.weight -= weightRemoved

  if (inScope) {
    const scopePkg = getCurrentScopeRoot()
    if (scopePkg) {
      scopePkg.size -= weightRemoved
    }
  }

  // Plan edge redirections before we mutate the graph. At root scope, the
  // wires include the rootId→sourceId edge. At inner scope, they include
  // owner→sourceId and sourceId→subDep edges.
  type Plan = {
    drop: string[]
    add: Array<{ fromId: string; toId: string; data: Wire }>
    relocatedChildIds: string[]
  }
  const plan: Plan = { drop: [], add: [], relocatedChildIds: [] }

  for (const edge of g.edgesOf(sourceId)) {
    if (edge.toId === sourceId) {
      // Inbound edge — redirect to target unless the target already has the
      // same incoming endpoint or it would self-loop.
      if (edge.fromId === targetId) {
        plan.drop.push(edge.id)
        continue
      }
      if (hasEdgeBetween(g, edge.fromId, targetId)) {
        plan.drop.push(edge.id)
        continue
      }
      plan.drop.push(edge.id)
      plan.add.push({
        fromId: edge.fromId,
        toId: targetId,
        data: { ...edge.data, fromId: edge.fromId, toId: targetId },
      })
    } else if (edge.fromId === sourceId) {
      // Outbound edge — redirect from target.
      if (edge.toId === targetId) {
        plan.drop.push(edge.id)
        continue
      }
      if (hasEdgeBetween(g, targetId, edge.toId)) {
        plan.drop.push(edge.id)
        continue
      }
      plan.drop.push(edge.id)
      plan.add.push({
        fromId: targetId,
        toId: edge.toId,
        data: { ...edge.data, fromId: targetId, toId: edge.toId },
      })
      // Track sub-deps that are getting reparented for physics relocation.
      if (edge.data.wireType === 'dependency') {
        plan.relocatedChildIds.push(edge.toId)
      }
    }
  }

  for (const id of plan.drop) {
    g.removeEdge(id)
  }
  for (const { fromId, toId, data } of plan.add) {
    const id = generateWireId()
    g.addEdge(fromId, toId, { ...data, id }, { id })
  }

  // Remove the source node — this cascades to any remaining edges + child graph.
  g.removeNode(sourceId)

  gameState.stats.totalSymlinksCreated++
  if (!gameState.onboarding.firstSymlinkSeen) {
    gameState.onboarding.firstSymlinkSeen = true
  }

  recordSymlink()
  checkAchievements()

  // Physics relocation: at root scope, the merge collapses an entire subtree
  // (the source's child graph went away with it). At inner scope, sub-deps
  // got reparented to target, so we relocate their physics anchors.
  if (!inScope) {
    emit('physics:trigger-organize', { relocatedIds: [targetId] })
  } else if (plan.relocatedChildIds.length > 0) {
    plan.relocatedChildIds.push(targetId)
    emit('physics:trigger-organize', {
      relocatedIds: plan.relocatedChildIds,
    })
  }

  if (inScope) {
    gameState.cascade.guaranteedCrits++
    emit('scope:recalculate', { scopePath: [...stack.path] })
  }

  markDuplicateGroupsDirty()
  updateDuplicateGroups()
  updateCrossPackageDuplicates()

  emit('packages:changed')

  return weightSaved
}

function hasEdgeBetween(
  g: Graph<Package, Wire>,
  fromId: string,
  toId: string
): boolean {
  // Check both endpoints exist before iterating, to match graph contract.
  if (!g.getNode(fromId) || !g.getNode(toId)) return false
  for (const edge of g.edgesBetween(fromId, toId)) {
    if (edge.fromId === fromId && edge.toId === toId) return true
  }
  return false
}

// Lazy access to scope path graph for the cross-scope helpers below.
export function getScopeGraph(
  path: readonly string[]
): Graph<Package, Wire> | null {
  return getGraphAtPath(path)
}
