import type { EffectMods } from '../types'

/**
 * Per-tower upgrade tree (augments the 3→9→27 evolution identity). Every tower
 * has three purchasable paths; each path has three cumulative levels of
 * increasing benefit, and the harder-hitting third level of each path buys its
 * power with a real downside. Levels unlock at XP milestones (the tower must
 * reach a level threshold) and are bought with gold. Items and mutations can
 * grant free levels toward a path (see `grantUpgrade`).
 */
export interface UpgradeLevel {
  desc: string
  /** Gold cost to buy this level (levels are bought in order within a path). */
  cost: number
  mods: EffectMods
  /** One-line downside, if this level trades power for a cost. */
  downside?: string
}

export interface UpgradePath {
  id: string
  name: string
  blurb: string
  levels: [UpgradeLevel, UpgradeLevel, UpgradeLevel]
}

/** Tower level required to buy path level 1 / 2 / 3 (the XP milestones). */
export const UPGRADE_MILESTONES = [2, 8, 14] as const
export const MAX_PATH_LEVEL = 3

export const UPGRADE_PATHS: UpgradePath[] = [
  {
    id: 'power',
    name: 'Onslaught',
    blurb: 'Raw hitting power.',
    levels: [
      { desc: '+15% damage', cost: 40, mods: { damageMult: 1.15 } },
      { desc: '+25% damage', cost: 95, mods: { damageMult: 1.25 } },
      { desc: '+45% damage, −12% attack speed', cost: 180, mods: { damageMult: 1.45, rateMult: 0.88 }, downside: '−12% attack speed' },
    ],
  },
  {
    id: 'tempo',
    name: 'Tempo',
    blurb: 'Faster, relentless attacks.',
    levels: [
      { desc: '+12% attack speed', cost: 40, mods: { rateMult: 1.12 } },
      { desc: '+20% attack speed, +20% projectile speed', cost: 95, mods: { rateMult: 1.2, projSpeedMult: 1.2 } },
      { desc: '+35% attack speed, −10% damage', cost: 180, mods: { rateMult: 1.35, damageMult: 0.9 }, downside: '−10% damage per hit' },
    ],
  },
  {
    id: 'precision',
    name: 'Precision',
    blurb: 'Crits and reach.',
    levels: [
      { desc: '+8% crit chance', cost: 40, mods: { critChanceAdd: 0.08 } },
      { desc: '+12% range, +40% crit damage', cost: 95, mods: { rangeMult: 1.12, critMultAdd: 0.4 } },
      { desc: '+15% crit chance, +60% crit damage, −8% range', cost: 180, mods: { critChanceAdd: 0.15, critMultAdd: 0.6, rangeMult: 0.92 }, downside: '−8% range' },
    ],
  },
]

export const UPGRADE_PATH_BY_ID = new Map(UPGRADE_PATHS.map((p) => [p.id, p]))
export const getUpgradePath = (id: string): UpgradePath | undefined => UPGRADE_PATH_BY_ID.get(id)

/** The tower level required to buy the given path level (1-indexed). */
export function milestoneForLevel(level: number): number {
  return UPGRADE_MILESTONES[Math.max(0, Math.min(UPGRADE_MILESTONES.length - 1, level - 1))]
}

/** The merged EffectMods a path contributes up to (and including) `level`. */
export function pathModsUpTo(pathId: string, level: number): EffectMods[] {
  const path = UPGRADE_PATH_BY_ID.get(pathId)
  if (!path || level <= 0) return []
  return path.levels.slice(0, Math.min(MAX_PATH_LEVEL, level)).map((l) => l.mods)
}
