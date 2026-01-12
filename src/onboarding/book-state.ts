// Teaching Book State Management
// Controls the teaching book UI state: open/closed, active tab, unlocked tabs

import { reactive, computed, ref } from 'vue'
import { gameState } from '../game/state'

// Tab identifiers
export type TabId =
  | 'install'
  | 'duplicates'
  | 'conflicts'
  | 'diving'
  | 'ship'
  | 'surge'

// Tab metadata (icons are Unicode symbols to comply with no-text rule)
export interface TabMeta {
  id: TabId
  icon: string // Unicode symbol
  order: number // Display order
}

export const TABS: TabMeta[] = [
  { id: 'install', icon: '⊕', order: 0 },
  { id: 'duplicates', icon: '⚭', order: 1 },
  { id: 'conflicts', icon: '✕', order: 2 },
  { id: 'diving', icon: '⤵', order: 3 },
  { id: 'ship', icon: '⟲', order: 4 }, // Cycle = ship and repeat
  { id: 'surge', icon: '◎', order: 5 }, // Concentric circles = power burst
]

// Auto-close delay in ms (15 seconds to let animation loop)
const AUTO_CLOSE_DELAY = 15000

// Book state
interface BookState {
  isOpen: boolean
  activeTab: TabId
  unlockedTabs: Set<TabId>
  viewedTabs: Set<TabId>
  autoOpenedTabs: Set<TabId> // Track which tabs have auto-opened (to not re-trigger)
  isAutoOpen: boolean // Whether current open was automatic
}

// Reactive state (module singleton)
const state = reactive<BookState>({
  isOpen: false,
  activeTab: 'install',
  unlockedTabs: new Set(['install']), // Install tab always unlocked
  viewedTabs: new Set(),
  autoOpenedTabs: new Set(),
  isAutoOpen: false,
})

// Auto-close timer handle
let autoCloseTimer: ReturnType<typeof setTimeout> | null = null

// ============================================
// COMPUTED
// ============================================

export const isBookOpen = computed(() => state.isOpen)
export const activeTab = computed(() => state.activeTab)

export const unlockedTabsList = computed(() =>
  TABS.filter((tab) => state.unlockedTabs.has(tab.id)).sort(
    (a, b) => a.order - b.order
  )
)

export const unviewedCount = computed(
  () =>
    [...state.unlockedTabs].filter((tabId) => !state.viewedTabs.has(tabId))
      .length
)

export const hasUnviewedTabs = computed(() => unviewedCount.value > 0)

// ============================================
// ACTIONS
// ============================================

/**
 * Open the book to a specific tab (or current tab if not specified)
 */
export function openBook(tab?: TabId): void {
  if (tab && state.unlockedTabs.has(tab)) {
    state.activeTab = tab
  }
  state.isOpen = true
  state.isAutoOpen = false

  // Mark current tab as viewed
  markTabViewed(state.activeTab)

  // Clear any pending auto-close
  clearAutoCloseTimer()
}

/**
 * Close the book
 */
export function closeBook(): void {
  state.isOpen = false
  state.isAutoOpen = false
  clearAutoCloseTimer()
}

/**
 * Toggle the book open/closed
 */
export function toggleBook(): void {
  if (state.isOpen) {
    closeBook()
  } else {
    openBook()
  }
}

/**
 * Switch to a specific tab
 */
export function switchTab(tab: TabId): void {
  if (state.unlockedTabs.has(tab)) {
    state.activeTab = tab
    markTabViewed(tab)

    // If auto-opened and user interacts, cancel auto-close
    if (state.isAutoOpen) {
      state.isAutoOpen = false
      clearAutoCloseTimer()
    }
  }
}

/**
 * Unlock a tab (makes it visible in the tab bar)
 */
export function unlockTab(tab: TabId): void {
  state.unlockedTabs.add(tab)
}

/**
 * Mark a tab as viewed (removes the "new" indicator)
 */
export function markTabViewed(tab: TabId): void {
  state.viewedTabs.add(tab)
}

/**
 * Check if a tab is unlocked
 */
export function isTabUnlocked(tab: TabId): boolean {
  return state.unlockedTabs.has(tab)
}

/**
 * Check if a tab has been viewed
 */
export function isTabViewed(tab: TabId): boolean {
  return state.viewedTabs.has(tab)
}

/**
 * Trigger auto-open for a newly unlocked tab
 * Only auto-opens once per tab
 */
export function triggerAutoOpen(tab: TabId): void {
  // Don't auto-open if already open or if this tab already triggered auto-open
  if (state.isOpen || state.autoOpenedTabs.has(tab)) {
    return
  }

  // Unlock the tab if not already
  unlockTab(tab)

  // Mark this tab as having auto-opened
  state.autoOpenedTabs.add(tab)

  // Open to this tab
  state.activeTab = tab
  state.isOpen = true
  state.isAutoOpen = true

  // Mark as viewed
  markTabViewed(tab)

  // Start auto-close timer
  startAutoCloseTimer()
}

/**
 * Reset book state (for testing or prestige)
 */
export function resetBookState(): void {
  state.isOpen = false
  state.activeTab = 'install'
  state.unlockedTabs = new Set(['install'])
  state.viewedTabs = new Set()
  state.autoOpenedTabs = new Set()
  state.isAutoOpen = false
  clearAutoCloseTimer()
}

// ============================================
// INTERNAL
// ============================================

function startAutoCloseTimer(): void {
  clearAutoCloseTimer()
  autoCloseTimer = setTimeout(() => {
    if (state.isAutoOpen) {
      closeBook()
    }
  }, AUTO_CLOSE_DELAY)
}

function clearAutoCloseTimer(): void {
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer)
    autoCloseTimer = null
  }
}

// ============================================
// JOURNEY MODAL STATE
// ============================================

// Journey modal open state
const journeyOpen = ref(false)

/**
 * Whether Journey is unlocked (after first ship)
 */
export const isJourneyUnlocked = computed(
  () => gameState.meta.timesShipped >= 1
)

/**
 * Whether Journey modal is currently open
 */
export const isJourneyOpen = computed(() => journeyOpen.value)

/**
 * Open the Journey modal
 */
export function openJourney(): void {
  if (isJourneyUnlocked.value) {
    journeyOpen.value = true
  }
}

/**
 * Close the Journey modal
 */
export function closeJourney(): void {
  journeyOpen.value = false
}
