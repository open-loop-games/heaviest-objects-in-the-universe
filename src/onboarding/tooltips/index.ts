// Tooltip Animations - Compact visual explanations for upgrades/automation/metrics

export {
  TooltipAnimation,
  TOOLTIP_WIDTH,
  TOOLTIP_HEIGHT,
} from './tooltip-animation'
export { BandwidthTooltip } from './bandwidth-tooltip'
export { CompressionTooltip } from './compression-tooltip'
export { ResolveSpeedTooltip } from './resolve-speed-tooltip'
export { SurgeTooltip } from './surge-tooltip'
export { AutoResolveTooltip } from './auto-resolve-tooltip'
export { EfficiencyTooltip } from './efficiency-tooltip'
export { StabilityTooltip } from './stability-tooltip'
export { Tier2Tooltip } from './tier2-tooltip'
export { Tier3Tooltip } from './tier3-tooltip'
export { Tier4Tooltip } from './tier4-tooltip'
export { Tier5Tooltip } from './tier5-tooltip'
export { RewardTooltip } from './reward-tooltip'
export { FragmentTooltip } from './fragment-tooltip'

// Resource icon tooltips (explain core resources)
export { BandwidthIconTooltip } from './bandwidth-icon-tooltip'
export { WeightIconTooltip } from './weight-icon-tooltip'
export { SurgeIconTooltip } from './surge-icon-tooltip'

// Tooltip types for state management
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
