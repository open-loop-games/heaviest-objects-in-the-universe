#!/usr/bin/env vite-node
/**
 * Headless simulation CLI for balance testing
 *
 * Usage:
 *   pnpm simulate                     # Run 10 simulations with defaults
 *   pnpm simulate --runs=100          # Run 100 simulations
 *   pnpm simulate --strategy=greedy   # Use greedy strategy
 *   pnpm simulate --seed=12345        # Fixed seed for reproducibility
 *   pnpm simulate --verbose           # Show detailed output
 */

import { runBatch, summarizeBatch } from '../src/simulation/engine'
import type { SimConfig } from '../src/simulation/types'

// ============================================
// CLI ARGUMENT PARSING
// ============================================

function parseArgs(): {
  runs: number
  strategy: SimConfig['strategyName']
  seed: number
  maxTicks: number
  verbose: boolean
} {
  const args = process.argv.slice(2)

  const getArg = (prefix: string): string | undefined => {
    const arg = args.find((a) => a.startsWith(prefix))
    return arg?.split('=')[1]
  }

  return {
    runs: parseInt(getArg('--runs=') ?? '10'),
    strategy: (getArg('--strategy=') as SimConfig['strategyName']) ?? 'optimal',
    seed: parseInt(getArg('--seed=') ?? String(Date.now())),
    maxTicks: parseInt(getArg('--max-ticks=') ?? '100000'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  }
}

// ============================================
// OUTPUT FORMATTING
// ============================================

function formatNumber(n: number, decimals: number = 2): string {
  return n.toFixed(decimals)
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

// ============================================
// MAIN
// ============================================

async function main() {
  const config = parseArgs()

  console.log('╔════════════════════════════════════════════════╗')
  console.log('║  Heaviest Objects in the Universe - Simulator  ║')
  console.log('╚════════════════════════════════════════════════╝')
  console.log()
  console.log(`Configuration:`)
  console.log(`  Runs:      ${config.runs}`)
  console.log(`  Strategy:  ${config.strategy}`)
  console.log(`  Base Seed: ${config.seed}`)
  console.log(`  Max Ticks: ${config.maxTicks}`)
  console.log()

  const startTime = Date.now()

  // Run batch
  console.log('Running simulations...')
  const results = runBatch(config.runs, {
    seed: config.seed,
    strategyName: config.strategy,
    maxTicks: config.maxTicks,
  })

  const elapsed = Date.now() - startTime

  // Summarize
  const summary = summarizeBatch(results)

  console.log()
  console.log('╔════════════════════════════════════════════════╗')
  console.log('║                    Results                     ║')
  console.log('╚════════════════════════════════════════════════╝')
  console.log()
  console.log(
    `Completed ${config.runs} simulations in ${formatDuration(elapsed)}`
  )
  console.log()
  console.log('Cache Tokens:')
  console.log(`  Mean:    ${formatNumber(summary.meanTokens)}`)
  console.log(`  Median:  ${formatNumber(summary.medianTokens)}`)
  console.log(`  Std Dev: ${formatNumber(summary.stdDevTokens)}`)
  console.log()
  console.log('Performance:')
  console.log(`  Mean Ships:        ${formatNumber(summary.meanShips)}`)
  console.log(
    `  Mean Efficiency:   ${formatNumber(summary.meanEfficiency * 100)}%`
  )
  console.log(
    `  Mean Ticks to T5:  ${formatNumber(summary.meanTicksToTier5, 0)}`
  )
  console.log()

  // Verbose output
  if (config.verbose) {
    console.log('Individual Results:')
    console.log('─'.repeat(60))
    console.log(
      'Seed'.padEnd(14) +
        'Tokens'.padEnd(10) +
        'Tier'.padEnd(6) +
        'Ships'.padEnd(8) +
        'Eff%'.padEnd(8) +
        'Ticks'
    )
    console.log('─'.repeat(60))

    for (const result of results) {
      const row = [
        String(result.seed).padEnd(14),
        String(result.finalState.cacheTokens).padEnd(10),
        String(result.finalState.ecosystemTier).padEnd(6),
        String(result.finalState.timesShipped).padEnd(8),
        formatNumber(result.metrics.averageEfficiency * 100).padEnd(8),
        String(result.ticks),
      ].join('')
      console.log(row)
    }
    console.log()
  }

  // End reasons breakdown
  const endReasons = {
    max_ticks: results.filter((r) => r.endReason === 'max_ticks').length,
    tier5: results.filter((r) => r.endReason === 'tier5').length,
    collapsed: results.filter((r) => r.endReason === 'collapsed').length,
  }

  console.log('End Reasons:')
  console.log(
    `  Max Ticks: ${endReasons.max_ticks} (${formatNumber((endReasons.max_ticks / config.runs) * 100)}%)`
  )
  console.log(
    `  Tier 5:    ${endReasons.tier5} (${formatNumber((endReasons.tier5 / config.runs) * 100)}%)`
  )
  console.log(
    `  Collapsed: ${endReasons.collapsed} (${formatNumber((endReasons.collapsed / config.runs) * 100)}%)`
  )
  console.log()
}

main().catch(console.error)
