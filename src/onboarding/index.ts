// Onboarding system exports (teaching book + ghost hand hints)

export {
  type TabId,
  type TabMeta,
  TABS,
  isBookOpen,
  activeTab,
  unlockedTabsList,
  unviewedCount,
  hasUnviewedTabs,
  openBook,
  closeBook,
  toggleBook,
  switchTab,
  unlockTab,
  markTabViewed,
  isTabUnlocked,
  isTabViewed,
  triggerAutoOpen,
  resetBookState,
} from './book-state'
