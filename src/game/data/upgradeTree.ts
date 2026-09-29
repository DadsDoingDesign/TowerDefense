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

/**
 * **Why every level past the first carries a cross-axis cost (M18).**
 *
 * The old tree was a calculator, not a decision: all nine levels were pure gains
 * except the three level-3s, and Onslaught simply paid best (+52% at level 3
 * against Tempo's +38% for the identical 315 gold), so the optimal play was
 * "buy Onslaught, then buy whatever is affordable". Nothing was ever given up.
 *
 * Two changes make it a choice:
 *
 *  1. **The three paths now converge on roughly the same raw throughput.** No
 *     path is the arithmetically correct answer, so which one is right depends on
 *     the tower: Onslaught wants big hits that are not overkill (armour), Tempo
 *     wants hits that carry something (burn / execute / stun / life-drain),
 *     Precision wants a build that already crits — it is near worthless on a
 *     5%-crit mystic and enormous on a Sharpshooter.
 *  2. **The paths interfere.** Onslaught buys damage with attack speed and Tempo
 *     buys attack speed with damage, so a tower that buys deep into both spends
 *     630 gold to partially cancel itself. *That* is the opportunity cost: gold
 *     spent here is a commitment to a shape, not a stat top-up.
 *
 * Costs are deliberately unchanged — the run economy is tuned elsewhere, and the
 * opportunity cost here is structural rather than a price hike.
 */
export const UPGRADE_PATHS: UpgradePath[] = [
  {
    id: 'power',
    name: 'Onslaught',
    blurb: 'Fewer, heavier blows.',
    levels: [
      { desc: '+15% damage', cost: 40, mods: { damageMult: 1.15 } },
      { desc: '+28% damage, −15% projectile speed', cost: 95, mods: { damageMult: 1.28, projSpeedMult: 0.85 }, downside: '−15% projectile speed' },
      { desc: '+50% damage, −12% attack speed', cost: 180, mods: { damageMult: 1.5, rateMult: 0.88 }, downside: '−12% attack speed' },
    ],
  },
  {
    id: 'tempo',
    name: 'Tempo',
    blurb: 'More blows, each one lighter.',
    levels: [
      { desc: '+12% attack speed', cost: 40, mods: { rateMult: 1.12 } },
      { desc: '+20% attack speed, +20% projectile speed, −6% damage', cost: 95, mods: { rateMult: 1.2, projSpeedMult: 1.2, damageMult: 0.94 }, downside: '−6% damage per hit' },
      { desc: '+28% attack speed, −14% damage', cost: 180, mods: { rateMult: 1.28, damageMult: 0.86 }, downside: '−14% damage per hit' },
    ],
  },
  {
    id: 'precision',
    name: 'Precision',
    blurb: 'Rarer blows that end things.',
    levels: [
      { desc: '+14% crit chance', cost: 40, mods: { critChanceAdd: 0.14 } },
      { desc: '+12% range, +50% crit damage, −5% attack speed', cost: 95, mods: { rangeMult: 1.12, critMultAdd: 0.5, rateMult: 0.95 }, downside: '−5% attack speed' },
      { desc: '+24% crit chance, +80% crit damage, −8% range', cost: 180, mods: { critChanceAdd: 0.24, critMultAdd: 0.8, rangeMult: 0.92 }, downside: '−8% range' },
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
