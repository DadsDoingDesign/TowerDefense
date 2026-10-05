import { heroStyle, type HeroStyle } from '../data/items'
import type { CoreStats, Sentinel } from '../types'

export const MAX_LEVEL = 20

/** Cumulative XP required to *reach* a given level (level 1 = 0). */
export function xpToReach(level: number): number {
  const l = Math.max(1, level) - 1
  return 40 * l + 8 * l * (l - 1)
}

/** The level a given cumulative XP total corresponds to (capped at MAX_LEVEL). */
export function levelForXp(xp: number): number {
  let level = 1
  while (level < MAX_LEVEL && xp >= xpToReach(level + 1)) level++
  return level
}

/** Progress toward the next level, 0..1 (1 at max level). */
export function levelProgress(sentinel: Sentinel): number {
  if (sentinel.level >= MAX_LEVEL) return 1
  const cur = xpToReach(sentinel.level)
  const next = xpToReach(sentinel.level + 1)
  return Math.max(0, Math.min(1, (sentinel.xp - cur) / (next - cur)))
}

/**
 * What a level adds, by what the hero is fighting WITH when it levels (there
 * is no class): a sword-hand grows strong, a bow- or knife-hand quick, a
 * caster clever — the three old class growths. Bare hands grow evenly.
 */
const GROWTH: Record<HeroStyle | 'none', Partial<CoreStats>> = {
  swing: { str: 2, dex: 1 },
  shoot: { dex: 2, str: 1 },
  cast: { int: 2, dex: 1 },
  none: { str: 1, dex: 1, int: 1 },
}

function applyGrowth(stats: CoreStats, style: HeroStyle | null): CoreStats {
  const g = GROWTH[style ?? 'none']
  return {
    str: stats.str + (g.str ?? 0),
    dex: stats.dex + (g.dex ?? 0),
    int: stats.int + (g.int ?? 0),
  }
}

/**
 * Given XP added, return a new Sentinel with levels applied. It only raises
 * the level and stats; a skill milestone it crosses is OWED, and the level-up
 * surfaces offer it (`run/skills.pendingMilestone`).
 */
export function applyXp(sentinel: Sentinel, addedXp: number): Sentinel {
  const xp = sentinel.xp + addedXp
  const newLevel = levelForXp(xp)
  let stats = sentinel.stats
  const style = heroStyle(sentinel)
  for (let l = sentinel.level + 1; l <= newLevel; l++) {
    stats = applyGrowth(stats, style)
  }
  return { ...sentinel, xp, level: newLevel, stats }
}
