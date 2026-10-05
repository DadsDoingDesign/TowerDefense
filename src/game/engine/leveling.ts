import { getNode } from '../data/archetypeTree'
import type { Archetype, CoreStats, Sentinel } from '../types'

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

const GROWTH: Record<Archetype, Partial<CoreStats>> = {
  fighter: { str: 2, dex: 1 },
  rogue: { dex: 2, str: 1 },
  mystic: { int: 2, dex: 1 },
}

function applyGrowth(stats: CoreStats, archetype: Archetype): CoreStats {
  const g = GROWTH[archetype]
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
  for (let l = sentinel.level + 1; l <= newLevel; l++) {
    stats = applyGrowth(stats, sentinel.archetype)
  }
  return { ...sentinel, xp, level: newLevel, stats }
}

/** The hero's class name ("Fighter") — heroes no longer evolve (SK1). */
export function buildName(s: Pick<Sentinel, 'archetype'>): string {
  return getNode(s.archetype).name
}
