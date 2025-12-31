#!/usr/bin/env node
// Copy devicon SVGs we use to public/icons for production builds
// Dynamically extracts icon keys from registry.ts

import { mkdirSync, copyFileSync, existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const registryPath = join(rootDir, 'src/game/registry.ts')
const srcDir = join(rootDir, 'node_modules/devicon/icons')
const destDir = join(rootDir, 'public/icons')

// Parse registry.ts to find all iconKey values
const registryContent = readFileSync(registryPath, 'utf-8')
const iconKeyMatches = registryContent.matchAll(/iconKey:\s*['"]([^'"]+)['"]/g)
const iconKeys = new Set()

for (const match of iconKeyMatches) {
  const key = match[1]
  // Skip 'npm' - it uses procedural fallback, not devicon
  if (key !== 'npm') {
    iconKeys.add(key)
  }
}

console.log(`Found ${iconKeys.size} unique devicon keys in registry.ts`)

// Ensure dest directory exists
mkdirSync(destDir, { recursive: true })

let copied = 0
let missing = 0

for (const icon of iconKeys) {
  const iconSrcDir = join(srcDir, icon)
  const iconDestDir = join(destDir, icon)

  if (!existsSync(iconSrcDir)) {
    console.warn(`Warning: ${icon} not found in devicon`)
    missing++
    continue
  }

  mkdirSync(iconDestDir, { recursive: true })

  // Copy both variants if they exist
  for (const variant of ['original', 'plain']) {
    const srcFile = join(iconSrcDir, `${icon}-${variant}.svg`)
    const destFile = join(iconDestDir, `${icon}-${variant}.svg`)

    if (existsSync(srcFile)) {
      copyFileSync(srcFile, destFile)
      copied++
    }
  }
}

console.log(`Copied ${copied} devicon SVGs to public/icons (${missing} icons not found)`)
