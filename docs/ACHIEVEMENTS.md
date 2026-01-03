# Achievements System

## Core Concept

Achievements maintain the no-text constraint throughout the main game. Players see icon-only badges that hint at accomplishments through visual language. Text names and descriptions are revealed only at **endgame/win condition**, creating a satisfying "reveal moment" where players finally read what they accomplished.

**NG+ Integration:** After reaching endgame, players can restart with New Game Plus. Some achievements require cumulative progress across runs or NG+ specific conditions. Achievement progress persists across all runs.

---

## Visual Language

| Element | Meaning |
|---------|---------|
| Dark silhouette | Locked |
| Full color | Earned |
| Pulsing glow | Just earned (toast) |
| Golden border | Rare/hard |
| Stacked icons | Tiered progression (e.g., ◆ → ◆◆ → ◆◆◆) |

**Grid Layout:** Trophy case grid (5-7 rows), always visible in endgame UI. During main game, accessible via a small trophy icon that opens the grid overlay.

---

## Achievement List (28)

### Weight Milestones

| Icon | Name | Trigger |
|------|------|---------|
| ◆ | "First Steps" | Reach 100 weight |
| ◆◆ | "Getting Heavy" | Reach 1,000 weight |
| ◆◆◆ | "Substantial" | Reach 10,000 weight |
| ◆◆◆◆ | "Absolute Unit" | Reach 100,000 weight |
| ◆◆◆◆◆ | "Heavier Than a Black Hole" | Reach 1,000,000 weight |

### Prestige Milestones

| Icon | Name | Trigger |
|------|------|---------|
| 🌀 | "rm -rf node_modules" | First prestige |
| 🌀🌀 | "Here We Go Again" | 5 prestiges |
| 🌀🌀🌀 | "Eternal Recurrence" | 25 prestiges |
| 🌀⭐ | "Cache Money" | Earn 100 cache tokens total |
| 🌀👑 | "Mass Extinction Event" | Prestige at 10× the threshold |

### Symlink Mastery

| Icon | Name | Trigger |
|------|------|---------|
| 🔗 | "Dedupe Curious" | Create first symlink |
| 🔗🔗🔗 | "Link in Bio" | Create 50 symlinks (cumulative) |
| 🔗⭐ | "Symlink Surgeon" | Create 10 symlinks in one scope |
| 🔗💨 | "Speed Linker" | Create 5 symlinks in 3 seconds |

### Conflict Resolution

| Icon | Name | Trigger |
|------|------|---------|
| ⚡→✓ | "Conflict Curious" | Resolve first conflict |
| ⚡⚡⚡→✓ | "npm audit passing" | Resolve 100 conflicts (cumulative) |
| 💥💥💥 | "Chaos Monkey" | Have 15+ active conflicts simultaneously |
| ⚡🧹 | "Clean Sweep" | Clear all conflicts in a scope with 10+ packages |

### Depth Exploration

| Icon | Name | Trigger |
|------|------|---------|
| ↓ | "Down the Rabbit Hole" | Enter first nested scope |
| ↓↓↓ | "Inception" | Reach depth 3 |
| ↓↓↓↓↓ | "Turtles All the Way Down" | Reach depth 5 |
| ↓🏠↓ | "Déjà Vu" | Find same package name at two different depths |

### Speed & Style

| Icon | Name | Trigger |
|------|------|---------|
| 🌀⏱ | "Speedrun Any%" | Prestige in under 3 minutes |
| 📦💥 | "Chain Reaction" | Single click cascades 30+ packages |
| ✨🎯 | "First Try" | Resolve conflict within 1 second of appearing |

### Behavioral / Hidden

| Icon | Name | Trigger |
|------|------|---------|
| 🐢 | "Patience" | Don't click for 30 seconds after a cascade starts |
| 📖 | "RTFM" | Open teaching book on 5 different tabs |
| 🤖 | "Let the Machine Work" | Auto-resolve 50 conflicts without manual input |

### NG+ / Cumulative

| Icon | Name | Trigger |
|------|------|---------|
| 📦📦📦 | "Package Hoarder" | Install 1,000 packages total (across all runs) |
| 🔁 | "New Game Plus" | Start a NG+ run |
| 🔁⭐ | "Completionist" | Earn 20 other achievements |
| 👑 | "Heaviest Object" | Earn all achievements |

---

## Grid Visualization

```
┌──────────────────────────────────────────┐
│  ◆    ◆◆   ◆◆◆   ◆◆◆◆   ◆◆◆◆◆  │  Weight
│  🌀   🌀🌀  🌀🌀🌀  🌀⭐   🌀👑   │  Prestige
│  🔗   🔗🔗🔗  🔗⭐   🔗💨         │  Symlinks
│ ⚡→✓  ⚡⚡⚡  💥💥💥  ⚡🧹         │  Conflicts
│  ↓    ↓↓↓  ↓↓↓↓↓  ↓🏠↓          │  Depth
│ 🌀⏱   📦💥   ✨🎯   🐢   📖   🤖  │  Style + Hidden
│ 📦📦📦  🔁   🔁⭐    👑           │  Cumulative
└──────────────────────────────────────────┘
```

---

## The Reveal Moment

When player reaches endgame/win condition:

1. Achievement panel expands to full screen
2. Icons remain in place
3. Text fades in beside each earned achievement
4. Locked achievements show "???" names
5. Player experiences "oh THAT'S what that meant" satisfaction

This creates narrative payoff for the no-text constraint - suddenly the game "speaks" to you.

---

## Endgame / Win Condition

**Trigger:** TBD - possibilities include:
- Reach Tier 5 and prestige X times
- Accumulate Y total cache tokens
- Achieve a specific weight milestone (1M?)
- Complete a "final boss" package tree

**What Unlocks:**
- Text throughout the game (achievement names, stats, tooltips)
- NG+ mode available
- Stats page (total packages, conflicts, symlinks, time played)
- Achievement gallery with full descriptions

---

## NG+ Mechanics

After endgame unlock:
- **Persists:** Achievements, total stats, cosmetic unlocks
- **Resets:** Weight, packages, tier progress, cache tokens (or partial carry?)
- **New:** NG+ exclusive achievements, harder scaling, cosmetic rewards

NG+ gives completionists a reason to replay with full knowledge, hunting remaining achievements and optimizing runs.

---

## Implementation Notes

**Storage:** Achievement state saved in persistence alongside game state. Separate from prestige resets.

**Tracking:** Most achievements need simple counters or flags:
- `weightsReached: number[]`
- `totalPrestiges: number`
- `totalSymlinks: number`
- `totalConflictsResolved: number`
- `maxActiveConflicts: number`
- `maxDepthReached: number`
- `fastestPrestige: number` (ms)
- `totalPackagesInstalled: number`
- `endgameUnlocked: boolean`
- `ngPlusRuns: number`

**Toast System:** When achievement earned, show icon with golden pulse animation. No text, just the icon celebrating itself.

**Grid UI:** Simple CSS grid or Pixi-rendered trophy case. Grayscale filter on locked icons. Click does nothing until endgame (then shows name/description).
