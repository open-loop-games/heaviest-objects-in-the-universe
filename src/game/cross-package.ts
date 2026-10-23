// Cross-package conflict and duplicate detection (Phase 4-5)
// Detects relationships BETWEEN top-level packages by inspecting their
// child graphs (internal scopes).

import { gameState, graph, rootIdRef, stack } from './state'
import type { Package, Wire } from './types'
import { areIncompatible } from './registry'
import { CROSS_PACKAGE_MIN_TIER, HALO_COLORS } from './config'
import { countResolved } from './mutations'
import type { GraphNode, Graph } from '@open-loop/engine'

// ============================================
// CROSS-PACKAGE CONFLICTS
// ============================================

export interface CrossPackageConflict {
  packageAId: string
  packageBId: string
  conflictingDepA: string
  conflictingDepB: string
}

let crossPackageConflicts: CrossPackageConflict[] = []
const siblingWires: Map<string, Wire> = new Map()

const previouslyConflictedPackages: Set<string> = new Set()

function* iterateInnerNodes(
  child: Graph<Package, Wire>,
  ownerId: string
): Generator<GraphNode<Package>> {
  for (const [id, node] of child.nodes) {
    if (id === ownerId) continue
    yield node
  }
}

/**
 * Detect conflicts between top-level packages based on their internal deps.
 * Only runs at root scope, on a board of CROSS_PACKAGE_MIN_TIER or above.
 */
export function updateCrossPackageConflicts(): void {
  if (stack.depth !== 0) return
  if (gameState.board.tier < CROSS_PACKAGE_MIN_TIER) return

  crossPackageConflicts = []
  siblingWires.clear()

  // Track top-level scopes whose conflict state changed this pass; we need
  // to recalculate their cached scope-state at the end so portal rings /
  // stability ratio stay in sync with the per-frame conflict mutation.
  const dirtyTopLevels = new Set<string>()

  // Clear stale conflict states from previously marked inner packages.
  for (const innerId of previouslyConflictedPackages) {
    for (const [topLevelId, topLevelNode] of graph.nodes) {
      if (topLevelId === rootIdRef.value) continue
      const child = graph.getChildGraph(topLevelId)
      if (!child) continue
      const innerNode = child.getNode(innerId)
      if (innerNode && innerNode.data.state === 'conflict') {
        innerNode.data.state = 'ready'
        dirtyTopLevels.add(topLevelId)
        for (const edge of child.edges.values()) {
          if (edge.toId === innerId) {
            edge.data.conflicted = false
            edge.data.conflictTime = 0
          }
        }
      }
      void topLevelNode
    }
  }
  previouslyConflictedPackages.clear()

  const topLevelEntries: Array<{
    id: string
    pkg: Package
    child: Graph<Package, Wire>
  }> = []

  for (const [id, node] of graph.nodes) {
    if (id === rootIdRef.value) continue
    const child = graph.getChildGraph(id)
    if (!child) continue
    topLevelEntries.push({ id, pkg: node.data, child })
  }

  for (let i = 0; i < topLevelEntries.length; i++) {
    for (let j = i + 1; j < topLevelEntries.length; j++) {
      const a = topLevelEntries[i]!
      const b = topLevelEntries[j]!

      for (const innerA of iterateInnerNodes(a.child, a.id)) {
        if (!innerA.data.identity || innerA.data.isGhost) continue

        for (const innerB of iterateInnerNodes(b.child, b.id)) {
          if (!innerB.data.identity || innerB.data.isGhost) continue

          if (
            areIncompatible(
              innerA.data.identity.name,
              innerB.data.identity.name
            )
          ) {
            crossPackageConflicts.push({
              packageAId: a.id,
              packageBId: b.id,
              conflictingDepA: innerA.data.identity.name,
              conflictingDepB: innerB.data.identity.name,
            })

            innerA.data.state = 'conflict'
            innerB.data.state = 'conflict'
            previouslyConflictedPackages.add(innerA.id)
            previouslyConflictedPackages.add(innerB.id)
            dirtyTopLevels.add(a.id)
            dirtyTopLevels.add(b.id)

            for (const edge of a.child.edges.values()) {
              if (edge.toId === innerA.id) {
                edge.data.conflicted = true
                if (!edge.data.conflictTime) edge.data.conflictTime = Date.now()
              }
            }
            for (const edge of b.child.edges.values()) {
              if (edge.toId === innerB.id) {
                edge.data.conflicted = true
                if (!edge.data.conflictTime) edge.data.conflictTime = Date.now()
              }
            }

            const wireId = `sibling_${a.id}_${b.id}`
            if (!siblingWires.has(wireId)) {
              siblingWires.set(wireId, {
                id: wireId,
                fromId: a.id,
                toId: b.id,
                wireType: 'sibling',
                flowProgress: 0,
                conflicted: true,
                conflictTime: Date.now(),
              })
            }
          }
        }
      }
    }
  }

  // Recalculate cached scope state for any top-level package whose inner
  // conflict set changed this pass — without this, portal rings and the
  // stability ratio diverge from the in-graph conflict flags.
  for (const id of dirtyTopLevels) {
    stack.recalculateAt([id])
  }
}

/** Drop all cached cross-package state. Call on ship / prestige / load so
 *  IDs from the previous run don't linger in the previously-conflicted set. */
export function resetCrossPackageState(): void {
  crossPackageConflicts = []
  siblingWires.clear()
  previouslyConflictedPackages.clear()
  crossPackageDuplicates = []
}

export function getCrossPackageConflicts(): CrossPackageConflict[] {
  return crossPackageConflicts
}

export function getSiblingWires(): Map<string, Wire> {
  return siblingWires
}

export function hasCrossPackageConflict(packageId: string): boolean {
  return crossPackageConflicts.some(
    (c) => c.packageAId === packageId || c.packageBId === packageId
  )
}

export function getConflictingInternalDep(packageId: string): string | null {
  for (const conflict of crossPackageConflicts) {
    if (conflict.packageAId === packageId) return conflict.conflictingDepA
    if (conflict.packageBId === packageId) return conflict.conflictingDepB
  }
  return null
}

// ============================================
// CROSS-PACKAGE DUPLICATES
// ============================================

export interface CrossPackageDuplicate {
  packageAId: string
  packageBId: string
  identityName: string
  haloColor: number
}

let crossPackageDuplicates: CrossPackageDuplicate[] = []

export function updateCrossPackageDuplicates(): void {
  crossPackageDuplicates = []

  if (stack.depth !== 0) return

  const identityToPackages = new Map<
    string,
    { packageId: string; internalId: string }[]
  >()

  for (const [topLevelId] of graph.nodes) {
    if (topLevelId === rootIdRef.value) continue
    const child = graph.getChildGraph(topLevelId)
    if (!child) continue

    for (const innerNode of iterateInnerNodes(child, topLevelId)) {
      if (!innerNode.data.identity || innerNode.data.isGhost) continue

      const name = innerNode.data.identity.name
      const list = identityToPackages.get(name) || []
      list.push({ packageId: topLevelId, internalId: innerNode.id })
      identityToPackages.set(name, list)
    }
  }

  let colorIndex = 0
  for (const [identityName, locations] of identityToPackages) {
    const uniquePackageIds = [...new Set(locations.map((l) => l.packageId))]

    if (uniquePackageIds.length >= 2) {
      for (let i = 0; i < uniquePackageIds.length; i++) {
        for (let j = i + 1; j < uniquePackageIds.length; j++) {
          crossPackageDuplicates.push({
            packageAId: uniquePackageIds[i]!,
            packageBId: uniquePackageIds[j]!,
            identityName,
            haloColor: HALO_COLORS[colorIndex % HALO_COLORS.length]!,
          })
        }
      }
      colorIndex++
    }
  }
}

export function getCrossPackageDuplicates(): CrossPackageDuplicate[] {
  return crossPackageDuplicates
}

export function hasCrossPackageDuplicate(packageId: string): boolean {
  return crossPackageDuplicates.some(
    (d) => d.packageAId === packageId || d.packageBId === packageId
  )
}

export function getCrossPackageDuplicateInfo(
  packageId: string
): { haloColor: number; identityName: string } | null {
  const dup = crossPackageDuplicates.find(
    (d) => d.packageAId === packageId || d.packageBId === packageId
  )
  if (!dup) return null
  return { haloColor: dup.haloColor, identityName: dup.identityName }
}

// ============================================
// CROSS-PACKAGE SYMLINK
// ============================================

export function canCrossPackageSymlink(
  sourceId: string,
  targetId: string
): string | null {
  if (sourceId === targetId) return null

  const sourceNode = graph.getNode(sourceId)
  const targetNode = graph.getNode(targetId)

  if (!sourceNode || !targetNode) return null
  if (sourceId === rootIdRef.value || targetId === rootIdRef.value) return null

  const sourceChild = graph.getChildGraph(sourceId)
  const targetChild = graph.getChildGraph(targetId)
  if (!sourceChild || !targetChild) return null

  for (const innerSource of iterateInnerNodes(sourceChild, sourceId)) {
    if (!innerSource.data.identity || innerSource.data.isGhost) continue

    for (const innerTarget of iterateInnerNodes(targetChild, targetId)) {
      if (!innerTarget.data.identity || innerTarget.data.isGhost) continue

      if (innerSource.data.identity.name === innerTarget.data.identity.name) {
        return innerSource.data.identity.name
      }
    }
  }

  return null
}

export function getSharedInternalDeps(
  pkgAId: string,
  pkgBId: string
): string[] {
  const childA = graph.getChildGraph(pkgAId)
  const childB = graph.getChildGraph(pkgBId)
  if (!childA || !childB) return []

  const shared: string[] = []
  const namesInA = new Set<string>()

  for (const inner of iterateInnerNodes(childA, pkgAId)) {
    if (inner.data.identity && !inner.data.isGhost) {
      namesInA.add(inner.data.identity.name)
    }
  }

  for (const inner of iterateInnerNodes(childB, pkgBId)) {
    if (
      inner.data.identity &&
      !inner.data.isGhost &&
      namesInA.has(inner.data.identity.name)
    ) {
      shared.push(inner.data.identity.name)
    }
  }

  return shared
}

/**
 * Cross-package symlink: source's matching internal dep becomes a ghost.
 * The smaller of (source, target) loses its real instance.
 */
export function performCrossPackageSymlink(
  sourcePackageId: string,
  targetPackageId: string,
  identityName: string
): number {
  const source = graph.getNode(sourcePackageId)?.data
  const target = graph.getNode(targetPackageId)?.data
  const sourceChild = graph.getChildGraph(sourcePackageId)
  const targetChild = graph.getChildGraph(targetPackageId)

  if (!source || !target || !sourceChild || !targetChild) return 0

  let sourceInner: Package | null = null
  let sourceInnerId: string | null = null
  for (const inner of iterateInnerNodes(sourceChild, sourcePackageId)) {
    if (inner.data.identity?.name === identityName && !inner.data.isGhost) {
      sourceInner = inner.data
      sourceInnerId = inner.id
      break
    }
  }

  let targetInner: Package | null = null
  let targetInnerId: string | null = null
  for (const inner of iterateInnerNodes(targetChild, targetPackageId)) {
    if (inner.data.identity?.name === identityName && !inner.data.isGhost) {
      targetInner = inner.data
      targetInnerId = inner.id
      break
    }
  }

  if (!sourceInner || !targetInner || !sourceInnerId || !targetInnerId) return 0

  let ghostPkg: Package
  let ghostPkgId: string
  let realPkg: Package
  let ghostOwner: Package
  let ghostOwnerChild: Graph<Package, Wire>
  let realOwner: Package

  if (source.size <= target.size) {
    ghostPkg = sourceInner
    ghostPkgId = sourceInnerId
    realPkg = targetInner
    ghostOwner = source
    ghostOwnerChild = sourceChild
    realOwner = target
  } else {
    ghostPkg = targetInner
    ghostPkgId = targetInnerId
    realPkg = sourceInner
    ghostOwner = target
    ghostOwnerChild = targetChild
    realOwner = source
  }

  const weightSaved = ghostPkg.size

  ghostPkg.isGhost = true
  ghostPkg.ghostTargetId = realPkg.id
  ghostPkg.ghostTargetScope = realOwner.id
  ghostPkg.state = 'optimized'

  ghostOwner.size -= weightSaved

  for (const edge of ghostOwnerChild.edges.values()) {
    if (edge.toId === ghostPkgId) {
      if (edge.data.conflicted) countResolved()
      edge.data.conflicted = false
      edge.data.conflictTime = 0
    }
  }

  realPkg.state = 'optimized'

  gameState.resources.weight -= weightSaved
  gameState.stats.totalSymlinksCreated++

  if (!gameState.onboarding.firstSymlinkSeen) {
    gameState.onboarding.firstSymlinkSeen = true
  }

  // Both owner scopes had inner conflict flags flipped — refresh their
  // cached scope state so portal rings stop showing 'unstable'.
  stack.recalculateAt([ghostOwner.id])
  stack.recalculateAt([realOwner.id])

  return weightSaved
}
