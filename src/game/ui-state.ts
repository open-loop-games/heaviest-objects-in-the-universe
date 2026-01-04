// UI-specific state management
// Separated from core game state for cleaner separation of concerns

import { ref } from 'vue'

// ============================================
// ACTION COST PREVIEW (for HUD bandwidth bar)
// ============================================

// Track action being previewed (conflict resolve, symlink merge)
export type ActionPreviewType = 'conflict' | 'symlink' | null
export const previewedActionType = ref<ActionPreviewType>(null)

export function setActionPreview(type: ActionPreviewType): void {
  previewedActionType.value = type
}

// ============================================
// COLLAPSE STATE (for prestige spaghettification)
// ============================================

export interface CollapseState {
  active: boolean
  progress: number // 0-1 overall collapse progress
  targetX: number // Black hole position in world coordinates
  targetY: number // Black hole position in world coordinates
  startTime: number // When collapse started
  absorbedPackages: Set<string> // Packages that have been consumed
}

export const collapseState = ref<CollapseState>({
  active: false,
  progress: 0,
  targetX: 0,
  targetY: 0,
  startTime: 0,
  absorbedPackages: new Set(),
})

export function startCollapse(targetX: number, targetY: number): void {
  collapseState.value = {
    active: true,
    progress: 0,
    targetX,
    targetY,
    startTime: Date.now(),
    absorbedPackages: new Set(),
  }
}

export function endCollapse(): void {
  collapseState.value = {
    active: false,
    progress: 0,
    targetX: 0,
    targetY: 0,
    startTime: 0,
    absorbedPackages: new Set(),
  }
}

export function markPackageAbsorbed(pkgId: string): void {
  collapseState.value.absorbedPackages.add(pkgId)
}

// ============================================
// DRAG STATE (for physics freeze during drag)
// ============================================

export interface DragState {
  packageId: string | null // Package being dragged (null = no drag)
  isInternalScope: boolean // Whether drag is in an internal scope
}

export const dragState = ref<DragState>({
  packageId: null,
  isInternalScope: false,
})

export function startDrag(packageId: string, isInternalScope: boolean): void {
  dragState.value = { packageId, isInternalScope }
}

export function endDrag(): void {
  dragState.value = { packageId: null, isInternalScope: false }
}

// ============================================
// WIGGLE STATE (for non-draggable nodes)
// ============================================

/** Duration of wiggle animation in ms */
const WIGGLE_DURATION = 400

/** Wiggle oscillation frequency */
const WIGGLE_FREQUENCY = 0.05

// Maps packageId -> wiggle end time (Date.now() timestamp)
export const wiggleState = ref<Map<string, number>>(new Map())

export function triggerWiggle(packageId: string): void {
  wiggleState.value.set(packageId, Date.now() + WIGGLE_DURATION)
}

export function isWiggling(packageId: string): boolean {
  const endTime = wiggleState.value.get(packageId)
  if (!endTime) return false
  if (Date.now() > endTime) {
    wiggleState.value.delete(packageId)
    return false
  }
  return true
}

export function getWigglePhase(packageId: string): number {
  const endTime = wiggleState.value.get(packageId)
  if (!endTime) return 0
  const remaining = endTime - Date.now()
  if (remaining <= 0) return 0
  // Phase oscillates during wiggle duration
  return (
    Math.sin((WIGGLE_DURATION - remaining) * WIGGLE_FREQUENCY) *
    (remaining / WIGGLE_DURATION)
  )
}

// ============================================
// CASCADE STARVED STATE
// ============================================

// True when cascade is waiting on bandwidth to spawn more packages
export const cascadeStarved = ref(false)

export function setCascadeStarved(starved: boolean): void {
  cascadeStarved.value = starved
}

// ============================================
// WORK HIGHLIGHT STATE (guide player to next action)
// ============================================

/** Interval for periodic work highlight wiggles (ms) */
const WORK_HIGHLIGHT_INTERVAL = 3000

/** Last time we triggered work highlight wiggles */
let lastWorkHighlightTime = 0

/** Track if back button should be highlighted (scope is stable) */
export const backButtonHighlight = ref(false)

export function setBackButtonHighlight(highlight: boolean): void {
  backButtonHighlight.value = highlight
}

/**
 * Trigger work highlight wiggles on duplicate packages.
 * Called periodically from renderer when duplicates exist.
 * Rate-limited to avoid spamming.
 */
export function triggerDuplicateHighlights(duplicateIds: string[]): void {
  const now = Date.now()
  if (now - lastWorkHighlightTime < WORK_HIGHLIGHT_INTERVAL) return
  lastWorkHighlightTime = now

  // Wiggle all duplicate packages to draw attention
  for (const id of duplicateIds) {
    triggerWiggle(id)
  }
}

// ============================================
// UPGRADE TOOLTIP STATE
// ============================================

export type TooltipType =
  | 'bandwidth'
  | 'compression'
  | 'resolveSpeed'
  | 'surge'
  | 'autoResolve'
  | 'efficiency'
  | 'stability'
  | 'tier2'
  | 'tier3'
  | 'tier4'
  | 'tier5'
  | 'reward'
  | 'fragment'
  | 'bandwidthIcon'
  | 'weightIcon'
  | 'surgeIcon'
  | null

export interface TooltipAnchor {
  right: number // Right edge of the anchor element (for positioning tooltip to the right)
  top: number // Top of the anchor element
}

export const activeTooltip = ref<TooltipType>(null)
export const tooltipAnchor = ref<TooltipAnchor>({ right: 0, top: 0 })

export function setActiveTooltip(
  type: TooltipType,
  anchorEl?: HTMLElement
): void {
  activeTooltip.value = type
  if (anchorEl && type) {
    const rect = anchorEl.getBoundingClientRect()
    tooltipAnchor.value = {
      right: rect.right,
      top: rect.top,
    }
  }
}

export function clearTooltip(): void {
  activeTooltip.value = null
}
