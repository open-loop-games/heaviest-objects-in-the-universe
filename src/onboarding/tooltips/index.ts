// Tooltip Animations - Compact visual explanations for upgrades/automation/metrics

export {
  TooltipAnimation,
  TOOLTIP_WIDTH,
  TOOLTIP_HEIGHT,
} from './tooltip-animation'
export { AutoResolveTooltip } from './auto-resolve-tooltip'
export { QualityTooltip } from './quality-tooltip'
export { Tier2Tooltip } from './tier2-tooltip'
export { Tier3Tooltip } from './tier3-tooltip'
export { Tier4Tooltip } from './tier4-tooltip'
export { Tier5Tooltip } from './tier5-tooltip'
export { RewardTooltip } from './reward-tooltip'
export { FragmentTooltip } from './fragment-tooltip'

// Resource icon tooltips (explain core resources)
export { WeightIconTooltip } from './weight-icon-tooltip'

// Tooltip types for state management
export type TooltipType =
  | 'autoResolve'
  | 'quality'
  | 'tier2'
  | 'tier3'
  | 'tier4'
  | 'tier5'
  | 'reward'
  | 'fragment'
  | 'weightIcon'
  | null
