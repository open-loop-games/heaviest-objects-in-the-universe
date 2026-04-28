// ID generation re-exports — the actual counters live in state.ts so the
// SpatialGraph can be constructed with the same generator and IDs stay
// stable across save/load.

export {
  generateId,
  generateWireId,
  resetIdCounters,
  syncIdCountersFromGraph as initIdCounterFromState,
} from './state'
