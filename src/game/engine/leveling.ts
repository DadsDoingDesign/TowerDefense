import { childrenOf, getNode, type TreeNode } from '../data/archetypeTree'
import type { Archetype, CoreStats, Sentinel } from '../types'

export const MAX_LEVEL = 20
export const TIER1_LEVEL = 10
export const TIER2_LEVEL = 20

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
 * Given XP added, return a new Sentinel with levels applied. Does NOT auto-pick
 * evolutions — it only raises the level and stats; the store surfaces the
 * evolution choice when `evolutionPending` is true.
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

/** Is this Sentinel currently owed an evolution choice? */
export function evolutionPending(s: Sentinel): boolean {
  if (s.level >= TIER1_LEVEL && s.branchPath.length === 1) return true
  if (s.level >= TIER2_LEVEL && s.branchPath.length === 2) return true
  return false
}

/** The evolution options for a Sentinel that is owed a choice (else empty). */
export function evolutionOptions(s: Sentinel): TreeNode[] {
  if (!evolutionPending(s)) return []
  return childrenOf(s.branchPath[s.branchPath.length - 1])
}

/** Apply a chosen evolution node: extend the branch and grant its stats. */
export function evolveInto(s: Sentinel, nodeId: string): Sentinel {
  const node = getNode(nodeId)
  const grant = node.grant ?? {}
  return {
    ...s,
    branchPath: [...s.branchPath, nodeId],
    stats: {
      str: s.stats.str + (grant.stats?.str ?? 0),
      dex: s.stats.dex + (grant.stats?.dex ?? 0),
      int: s.stats.int + (grant.stats?.int ?? 0),
    },
    thorns: s.thorns + (grant.thorns ?? 0),
    patience: s.patience + (grant.patience ?? 0),
  }
}

/** Readable branch history, e.g. "Fighter → Knight → Bulwark". */
export function branchLabel(s: Sentinel): string {
  return s.branchPath.map((id) => getNode(id).name).join(' → ')
}

/** The current build's display name (deepest node). */
export function buildName(s: Sentinel): string {
  return getNode(s.branchPath[s.branchPath.length - 1]).name
}
