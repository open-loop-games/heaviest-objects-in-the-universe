import {
  computed,
  onScopeDispose,
  shallowRef,
  triggerRef,
  type ComputedRef,
} from 'vue'
import type {
  GraphNode,
  ScopeStack,
  ScopeState,
  SpatialGraph,
} from 'open-loop-engine'

export interface UseScopeStackReturn<N, E> {
  path: ComputedRef<readonly string[]>
  depth: ComputedRef<number>
  current: ComputedRef<SpatialGraph<N, E>>
  currentNodeId: ComputedRef<string | null>
  breadcrumb: ComputedRef<readonly GraphNode<N>[]>
  stateAt: (path: readonly string[]) => ComputedRef<ScopeState | undefined>
}

/**
 * Vue reactive view over a plain-data ScopeStack. Subscribes to navigation
 * and recalculate events; exposes computed refs for the active path,
 * depth, current graph, and breadcrumb trail.
 *
 * `stateAt(path)` memoizes a ref per stringified path; entries are cleared
 * on scope dispose.
 */
export function useScopeStack<N, E>(
  stack: ScopeStack<N, E>
): UseScopeStackReturn<N, E> {
  const navVersion = shallowRef(0)
  const stateVersion = shallowRef(0)

  const stateCache = new Map<string, ComputedRef<ScopeState | undefined>>()

  const bumpNav = () => {
    navVersion.value++
    triggerRef(navVersion)
  }
  const bumpState = () => {
    stateVersion.value++
    triggerRef(stateVersion)
  }

  const off: Array<() => void> = [
    stack.on('scope:entered', bumpNav),
    stack.on('scope:exited', bumpNav),
    stack.on('scope:recalculated', bumpState),
  ]

  onScopeDispose(() => {
    for (const fn of off) fn()
    stateCache.clear()
  })

  const path = computed<readonly string[]>(() => {
    void navVersion.value
    return stack.path.slice()
  })

  const depth = computed(() => {
    void navVersion.value
    return stack.depth
  })

  const current = computed(() => {
    void navVersion.value
    return stack.current
  })

  const currentNodeId = computed(() => {
    void navVersion.value
    return stack.currentNodeId
  })

  const breadcrumb = computed<readonly GraphNode<N>[]>(() => {
    void navVersion.value
    return stack.breadcrumb.slice()
  })

  function stateAt(p: readonly string[]): ComputedRef<ScopeState | undefined> {
    const key = JSON.stringify(p)
    const existing = stateCache.get(key)
    if (existing) return existing
    const snapshot = p.slice()
    const ref = computed(() => {
      void stateVersion.value
      return stack.stateAt(snapshot)
    })
    stateCache.set(key, ref)
    return ref
  }

  return { path, depth, current, currentNodeId, breadcrumb, stateAt }
}
