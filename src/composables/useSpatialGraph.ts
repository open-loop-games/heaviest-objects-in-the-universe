import {
  computed,
  onScopeDispose,
  shallowRef,
  triggerRef,
  type ComputedRef,
} from 'vue'
import type { GraphEdge, GraphNode, SpatialGraph } from 'open-loop-engine'

export interface UseSpatialGraphReturn<N, E> {
  nodes: ComputedRef<readonly GraphNode<N>[]>
  edges: ComputedRef<readonly GraphEdge<E>[]>
  node: (id: string) => ComputedRef<GraphNode<N> | undefined>
  neighbors: (id: string) => ComputedRef<readonly GraphNode<N>[]>
}

/**
 * Vue reactive view over a plain-data SpatialGraph. The graph remains
 * authoritative; this composable subscribes to its events and exposes
 * computed refs that invalidate when nodes or edges change.
 *
 * `node(id)` and `neighbors(id)` memoize refs per id. Memo entries are
 * cleared on scope dispose; do not retain returned refs beyond the
 * consuming component's lifetime.
 *
 * Nested child graphs are not walked — wrap each child graph in its own
 * `useSpatialGraph` when binding UI to a descendant scope.
 */
export function useSpatialGraph<N, E>(
  graph: SpatialGraph<N, E>
): UseSpatialGraphReturn<N, E> {
  const nodeVersion = shallowRef(0)
  const edgeVersion = shallowRef(0)

  const nodeCache = new Map<string, ComputedRef<GraphNode<N> | undefined>>()
  const neighborCache = new Map<string, ComputedRef<readonly GraphNode<N>[]>>()

  const bumpNodes = () => {
    nodeVersion.value++
    triggerRef(nodeVersion)
  }
  const bumpEdges = () => {
    edgeVersion.value++
    triggerRef(edgeVersion)
  }

  const off: Array<() => void> = [
    graph.on('nodeAdded', bumpNodes),
    graph.on('nodeRemoved', bumpNodes),
    graph.on('edgeAdded', bumpEdges),
    graph.on('edgeRemoved', bumpEdges),
  ]

  onScopeDispose(() => {
    for (const fn of off) fn()
    nodeCache.clear()
    neighborCache.clear()
  })

  const nodes = computed<readonly GraphNode<N>[]>(() => {
    void nodeVersion.value
    return Array.from(graph.nodes.values())
  })

  const edges = computed<readonly GraphEdge<E>[]>(() => {
    void edgeVersion.value
    return Array.from(graph.edges.values())
  })

  function node(id: string): ComputedRef<GraphNode<N> | undefined> {
    const existing = nodeCache.get(id)
    if (existing) return existing
    const ref = computed(() => {
      void nodeVersion.value
      return graph.getNode(id)
    })
    nodeCache.set(id, ref)
    return ref
  }

  function neighbors(id: string): ComputedRef<readonly GraphNode<N>[]> {
    const existing = neighborCache.get(id)
    if (existing) return existing
    const ref = computed<readonly GraphNode<N>[]>(() => {
      void nodeVersion.value
      void edgeVersion.value
      if (!graph.getNode(id)) return []
      return Array.from(graph.neighbors(id))
    })
    neighborCache.set(id, ref)
    return ref
  }

  return { nodes, edges, node, neighbors }
}
