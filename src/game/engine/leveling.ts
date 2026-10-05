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

/**
 * The growth a hero's level-10 and level-15 skill milestones pay on top of the
 * level itself (SK1 tuning pass).
 *
 * Skills replaced the evolutions, and copied their EFFECTS — but an evolution
 * also paid a stat grant when it was chosen: +10–11 stats at level 10 (8 on the
 * class's main stat), +12–16 at level 20, plus thorns on the Fighter line. The
 * skills dropped it, and that was most of the power the skill build lost.
 * Paired A/B on the same seeds (`balance/tune.ts 240 fresh mc`): with no grant
 * §6 read 39.3% and the first-timer line 12.5% (adaptive 12.5%); with the old
 * evolution grants restored at 10 and 15 (+8 / +10 main, +2 off-stat, +5
 * thorns) 53.0% and 16.7%; at these numbers (about ×1.25 of them) 57.0% and
 * 19.6% (adaptive 24.2%) — §6 back inside its 45–60% band. The first-timer
 * line's last points came from fixing the dead and solved skills (`data/skills.ts`).
 *
 * It is paid with the LEVEL, not with the choice, so it is never a choice of its
 * own: the stat bump and the swap stay the only decision at a milestone, and the
 * level-up says the grant ("Lv 10 · +10 STR") and nothing new has to be learned.
 */
export const MILESTONE_GRANT: Readonly<Record<number, Readonly<Record<Archetype, { stats: Partial<CoreStats>; thorns: number }>>>> = {
  10: {
    fighter: { stats: { str: 10, dex: 3 }, thorns: 6 },
    rogue: { stats: { dex: 10, str: 3 }, thorns: 0 },
    mystic: { stats: { int: 10, dex: 3 }, thorns: 0 },
  },
  15: {
    fighter: { stats: { str: 13, dex: 4 }, thorns: 6 },
    rogue: { stats: { dex: 13, str: 4 }, thorns: 0 },
    mystic: { stats: { int: 13, dex: 4 }, thorns: 0 },
  },
}

/** What reaching `level` pays beyond the level's own growth, or null for a plain level. */
export function milestoneGrant(archetype: Archetype, level: number): { stats: Partial<CoreStats>; thorns: number } | null {
  return MILESTONE_GRANT[level]?.[archetype] ?? null
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
 * the level and stats (and pays the level-10/15 grant, `MILESTONE_GRANT`); a
 * skill milestone it crosses is OWED, and the level-up surfaces offer it
 * (`run/skills.pendingMilestone`).
 */
export function applyXp(sentinel: Sentinel, addedXp: number): Sentinel {
  const xp = sentinel.xp + addedXp
  const newLevel = levelForXp(xp)
  let stats = sentinel.stats
  let thorns = sentinel.thorns
  for (let l = sentinel.level + 1; l <= newLevel; l++) {
    stats = applyGrowth(stats, sentinel.archetype)
    const g = milestoneGrant(sentinel.archetype, l)
    if (g) {
      stats = { str: stats.str + (g.stats.str ?? 0), dex: stats.dex + (g.stats.dex ?? 0), int: stats.int + (g.stats.int ?? 0) }
      thorns += g.thorns
    }
  }
  return { ...sentinel, xp, level: newLevel, stats, thorns }
}

/** The hero's class name ("Fighter") — heroes no longer evolve (SK1). */
export function buildName(s: Pick<Sentinel, 'archetype'>): string {
  return getNode(s.archetype).name
}
