// Achievement System

import { reactive, computed } from 'vue'
import { gameState, stack } from './state'
import { emit } from './events'

// ============================================
// TYPES
// ============================================

export type AchievementCategory =
  | 'weight'
  | 'prestige'
  | 'symlink'
  | 'conflict'
  | 'depth'
  | 'style'
  | 'cumulative'

export interface Achievement {
  id: string
  icon: string // Fallback for toast/simple display
  iconData?:
    | { symbol: string; count: 1 | 2 | 3 | 4 | 5 } // Geometric arrangement
    | { layout: 'spaced'; symbols: [string, string] } // Two symbols with gap
    | { layout: 'sideBySide'; symbols: [string, string] } // Side by side, second scaled
    | { layout: 'triforceBelow'; symbols: [string]; below: string } // Triforce + symbol below
  name: string // Revealed after hasCollapsed
  category: AchievementCategory
  check: () => boolean
  rare?: boolean
}

export interface AchievementState {
  earned: Set<string>
  earnedAt: Map<string, number> // timestamp when earned
}

// ============================================
// CATEGORY COLORS (match game palette)
// ============================================

export const CATEGORY_COLORS: Record<AchievementCategory, string> = {
  weight: '#ffaa5a', // orange
  prestige: '#7a5aff', // purple
  symlink: '#5affff', // cyan
  conflict: '#ff5a5a', // red
  depth: '#5aff8a', // green
  style: '#ffc85a', // gold
  cumulative: '#ff5aff', // pink
}

// ============================================
// TRACKING STATE (for advanced achievements)
// ============================================

export interface AchievementTracking {
  // Speed/timing
  runStartTime: number // For speedrun achievement
  maxSymlinksInScope: number // For symlink surgeon (10 in one scope)
  currentScopeSymlinks: number
  maxCascadeSize: number // For chain reaction
  autoResolveCount: number // For automation achievement
  teachingBookTabsViewed: number // Count unique tabs viewed
}

export const tracking = reactive<AchievementTracking>({
  runStartTime: Date.now(),
  maxSymlinksInScope: 0,
  currentScopeSymlinks: 0,
  maxCascadeSize: 0,
  autoResolveCount: 0,
  teachingBookTabsViewed: 0,
})

// ============================================
// ACHIEVEMENT STATE
// ============================================

export const achievementState = reactive<AchievementState>({
  earned: new Set(),
  earnedAt: new Map(),
})

// ============================================
// ACHIEVEMENT DEFINITIONS
// ============================================

export const ACHIEVEMENTS: Achievement[] = [
  // ==========================================
  // WEIGHT MILESTONES (5)
  // ==========================================
  {
    id: 'weight-1',
    icon: '◆',
    iconData: { symbol: '◆', count: 1 },
    name: 'First Steps',
    category: 'weight',
    check: () => gameState.stats.maxWeightReached >= 1000,
  },
  {
    id: 'weight-2',
    icon: '◆◆',
    iconData: { symbol: '◆', count: 2 },
    name: 'Getting Heavy',
    category: 'weight',
    check: () => gameState.stats.maxWeightReached >= 5000,
  },
  {
    id: 'weight-3',
    icon: '◆◆◆',
    iconData: { symbol: '◆', count: 3 },
    name: 'Substantial',
    category: 'weight',
    check: () => gameState.stats.maxWeightReached >= 10000,
  },
  {
    id: 'weight-4',
    icon: '◆◆◆◆',
    iconData: { symbol: '◆', count: 4 },
    name: 'Absolute Unit',
    category: 'weight',
    check: () => gameState.stats.maxWeightReached >= 50000,
    rare: true,
  },
  {
    id: 'weight-5',
    icon: '◆◆◆◆◆',
    iconData: { symbol: '◆', count: 5 },
    name: 'Heavier Than a Black Hole',
    category: 'weight',
    check: () => gameState.stats.maxWeightReached >= 100000,
    rare: true,
  },

  // ==========================================
  // PRESTIGE MILESTONES (5) - Tier progression
  // ==========================================
  {
    id: 'prestige-1',
    icon: '⟲',
    iconData: { symbol: '⟲', count: 1 },
    name: 'rm -rf node_modules',
    category: 'prestige',
    check: () => gameState.meta.timesShipped >= 1,
  },
  {
    id: 'prestige-2',
    icon: '⟲⟲',
    iconData: { symbol: '⟲', count: 2 },
    name: 'Tier 2',
    category: 'prestige',
    check: () => gameState.meta.cacheTokens >= 9,
  },
  {
    id: 'prestige-3',
    icon: '⟲⟲⟲',
    iconData: { symbol: '⟲', count: 3 },
    name: 'Tier 3',
    category: 'prestige',
    check: () => gameState.meta.cacheTokens >= 21,
  },
  {
    id: 'prestige-4',
    icon: '⟲⟲⟲⟲',
    iconData: { symbol: '⟲', count: 4 },
    name: 'Tier 4',
    category: 'prestige',
    check: () => gameState.meta.cacheTokens >= 42,
  },
  {
    id: 'prestige-5',
    icon: '⟲⟲⟲⟲⟲',
    iconData: { symbol: '⟲', count: 5 },
    name: 'Tier 5',
    category: 'prestige',
    check: () => gameState.meta.cacheTokens >= 63,
    rare: true,
  },

  // ==========================================
  // SYMLINK MASTERY (4)
  // ==========================================
  {
    id: 'symlink-1',
    icon: '⚭',
    iconData: { symbol: '⚭', count: 1 },
    name: 'Dedupe Curious',
    category: 'symlink',
    check: () => gameState.stats.totalSymlinksCreated >= 1,
  },
  {
    id: 'symlink-2',
    icon: '⚭⚭⚭',
    iconData: { symbol: '⚭', count: 3 },
    name: 'Link in Bio',
    category: 'symlink',
    check: () => gameState.stats.totalSymlinksCreated >= 50,
  },
  {
    id: 'symlink-3',
    icon: '⚭★',
    iconData: { layout: 'spaced', symbols: ['⚭', '★'] },
    name: 'Symlink Surgeon',
    category: 'symlink',
    check: () => tracking.maxSymlinksInScope >= 10,
    rare: true,
  },

  // ==========================================
  // CONFLICT RESOLUTION (2)
  // ==========================================
  {
    id: 'conflict-1',
    icon: '✕→✓',
    name: 'Conflict Curious',
    category: 'conflict',
    check: () => gameState.stats.totalConflictsResolved >= 1,
  },
  {
    id: 'conflict-2',
    icon: '✕✕✕✓',
    iconData: { layout: 'triforceBelow', symbols: ['✕'], below: '✓' },
    name: 'npm audit passing',
    category: 'conflict',
    check: () => gameState.stats.totalConflictsResolved >= 50,
  },

  // ==========================================
  // DEPTH EXPLORATION (4)
  // ==========================================
  {
    id: 'depth-1',
    icon: '↓',
    iconData: { symbol: '↓', count: 1 },
    name: 'Down the Rabbit Hole',
    category: 'depth',
    check: () => stack.depth >= 1,
  },
  {
    id: 'depth-2',
    icon: '↓↓↓',
    iconData: { symbol: '↓', count: 3 },
    name: 'Inception',
    category: 'depth',
    check: () => stack.depth >= 3,
  },
  {
    id: 'depth-3',
    icon: '↓↓↓↓↓',
    iconData: { symbol: '↓', count: 5 },
    name: 'Turtles All the Way Down',
    category: 'depth',
    check: () => stack.depth >= 5,
    rare: true,
  },

  // ==========================================
  // SPEED & STYLE (4)
  // ==========================================
  {
    id: 'style-1',
    icon: '⟲⏱',
    name: 'Speedrun Any%',
    category: 'style',
    check: () => {
      // Check if prestige happened within 3 minutes of run start
      if (gameState.meta.timesShipped === 0) return false
      const runDuration = Date.now() - tracking.runStartTime
      return runDuration < 180000 // 3 minutes
    },
    rare: true,
  },
  {
    id: 'style-2',
    icon: '⊕💥',
    iconData: { layout: 'sideBySide', symbols: ['⊕', '💥'] },
    name: 'Chain Reaction',
    category: 'style',
    check: () => tracking.maxCascadeSize >= 30,
  },
  {
    id: 'style-4',
    icon: '🕳️',
    name: 'Mass Extinction',
    category: 'style',
    check: () => gameState.meta.hasCollapsed,
    rare: true,
  },

  // ==========================================
  // BEHAVIORAL / HIDDEN (2)
  // ==========================================
  {
    id: 'hidden-2',
    icon: '?',
    name: 'RTFM',
    category: 'cumulative',
    check: () => tracking.teachingBookTabsViewed >= 5,
  },
  {
    id: 'hidden-3',
    icon: '⚙',
    name: 'Let the Machine Work',
    category: 'cumulative',
    check: () => tracking.autoResolveCount >= 50,
  },

  // ==========================================
  // CUMULATIVE (4)
  // ==========================================
  {
    id: 'cumulative-1',
    icon: '⊕⊕⊕',
    iconData: { symbol: '⊕', count: 3 },
    name: 'Package Hoarder',
    category: 'cumulative',
    check: () => gameState.stats.totalPackagesInstalled >= 100,
  },
  {
    id: 'cumulative-2',
    icon: '🔁',
    name: 'New Game Plus',
    category: 'cumulative',
    // Player used Restart button after collapse - triggered externally
    check: () => false,
  },
  {
    id: 'cumulative-3',
    icon: '🔁★',
    name: 'Completionist',
    category: 'cumulative',
    check: () => achievementState.earned.size >= 20,
  },
  {
    id: 'cumulative-4',
    icon: '👑',
    name: 'Heaviest Object',
    category: 'cumulative',
    check: () => achievementState.earned.size >= ACHIEVEMENTS.length - 1, // All except this one
    rare: true,
  },
]

// ============================================
// FUNCTIONS
// ============================================

/**
 * Check if an achievement is earned
 */
export function isEarned(id: string): boolean {
  return achievementState.earned.has(id)
}

/**
 * Earn an achievement by ID
 */
export function earnAchievement(id: string): boolean {
  if (achievementState.earned.has(id)) return false

  const achievement = ACHIEVEMENTS.find((a) => a.id === id)
  if (!achievement) return false

  achievementState.earned.add(id)
  achievementState.earnedAt.set(id, Date.now())

  // Emit event for toast notification
  emit('achievement:earned', { id, icon: achievement.icon })

  // Check for meta-achievements (earning achievements unlocks more)
  checkAchievements()

  return true
}

/**
 * Manually trigger an achievement (for externally-checked ones)
 */
export function triggerAchievement(id: string): boolean {
  return earnAchievement(id)
}

/**
 * Check all achievements and earn any that are now met
 */
export function checkAchievements(): void {
  for (const achievement of ACHIEVEMENTS) {
    if (achievementState.earned.has(achievement.id)) continue

    try {
      if (achievement.check()) {
        earnAchievement(achievement.id)
      }
    } catch {
      // Ignore check errors (some checks may fail early in game)
    }
  }
}

/**
 * Get achievements by category
 */
export function getAchievementsByCategory(
  category: AchievementCategory
): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.category === category)
}

/**
 * Get total earned count
 */
export const earnedCount = computed(() => achievementState.earned.size)

/**
 * Get total achievement count
 */
export const totalCount = computed(() => ACHIEVEMENTS.length)

/**
 * Get completion percentage
 */
export const completionPercent = computed(
  () => (achievementState.earned.size / ACHIEVEMENTS.length) * 100
)

// ============================================
// TRACKING HELPERS
// ============================================

/**
 * Record a symlink creation
 */
export function recordSymlink(): void {
  tracking.currentScopeSymlinks++

  // Update max symlinks in scope
  if (tracking.currentScopeSymlinks > tracking.maxSymlinksInScope) {
    tracking.maxSymlinksInScope = tracking.currentScopeSymlinks
  }

  checkAchievements()
}

/**
 * Reset scope symlink counter (when entering new scope)
 */
export function resetScopeSymlinks(): void {
  tracking.currentScopeSymlinks = 0
}

/**
 * Record cascade size
 */
export function recordCascadeSize(size: number): void {
  if (size > tracking.maxCascadeSize) {
    tracking.maxCascadeSize = size
  }
  checkAchievements()
}

/**
 * Record auto-resolve completion
 */
export function recordAutoResolve(): void {
  tracking.autoResolveCount++
  checkAchievements()
}

/**
 * Record teaching book tab view
 */
export function recordTabView(uniqueCount: number): void {
  if (uniqueCount > tracking.teachingBookTabsViewed) {
    tracking.teachingBookTabsViewed = uniqueCount
    checkAchievements()
  }
}

/**
 * Reset run tracking (on prestige/restart)
 */
export function resetRunTracking(): void {
  tracking.runStartTime = Date.now()
  tracking.currentScopeSymlinks = 0
  // Note: maxSymlinksInScope and maxCascadeSize persist for achievement checks
}

// ============================================
// PERSISTENCE HELPERS
// ============================================

/**
 * Serialize achievement state for saving
 */
export function serializeAchievements(): {
  earned: string[]
  earnedAt: [string, number][]
  tracking: {
    maxSymlinksInScope: number
    maxCascadeSize: number
    autoResolveCount: number
    teachingBookTabsViewed: number
  }
} {
  return {
    earned: Array.from(achievementState.earned),
    earnedAt: Array.from(achievementState.earnedAt.entries()),
    tracking: {
      maxSymlinksInScope: tracking.maxSymlinksInScope,
      maxCascadeSize: tracking.maxCascadeSize,
      autoResolveCount: tracking.autoResolveCount,
      teachingBookTabsViewed: tracking.teachingBookTabsViewed,
    },
  }
}

/**
 * Deserialize achievement state from save
 */
export function deserializeAchievements(data: {
  earned?: string[]
  earnedAt?: [string, number][]
  tracking?: {
    maxSymlinksInScope?: number
    maxCascadeSize?: number
    autoResolveCount?: number
    teachingBookTabsViewed?: number
  }
}): void {
  // Clear and restore earned set
  achievementState.earned.clear()
  if (data.earned) {
    for (const id of data.earned) {
      achievementState.earned.add(id)
    }
  }

  // Clear and restore earnedAt map
  achievementState.earnedAt.clear()
  if (data.earnedAt) {
    for (const [id, time] of data.earnedAt) {
      achievementState.earnedAt.set(id, time)
    }
  }

  // Restore tracking data
  if (data.tracking) {
    tracking.maxSymlinksInScope = data.tracking.maxSymlinksInScope ?? 0
    tracking.maxCascadeSize = data.tracking.maxCascadeSize ?? 0
    tracking.autoResolveCount = data.tracking.autoResolveCount ?? 0
    tracking.teachingBookTabsViewed = data.tracking.teachingBookTabsViewed ?? 0
  }
}
