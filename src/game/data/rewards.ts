import { nextId, type RNG } from '../core/rng'
import type { CoreStats, EffectMods, Item } from '../types'
import { generateItem } from './items'

/** A team-wide buff a stat reward applies for the rest of the run. */
export interface RewardGrant {
  stats?: Partial<CoreStats>
  thorns?: number
  patience?: number
  mods?: EffectMods
}

/** One of the three cards offered after a cleared wave. Pick exactly one. */
export interface RewardCard {
  id: string
  kind: 'stat' | 'item'
  title: string
  desc: string
  item?: Item
  grant?: RewardGrant
}

interface StatTemplate { title: string; desc: string; grant: RewardGrant }
const STAT_CARDS: StatTemplate[] = [
  { title: 'Might', desc: '+2 STR to the whole team', grant: { stats: { str: 2 } } },
  { title: 'Finesse', desc: '+2 DEX to the whole team', grant: { stats: { dex: 2 } } },
  { title: 'Insight', desc: '+2 INT to the whole team', grant: { stats: { int: 2 } } },
  { title: 'Ferocity', desc: '+6% crit chance for the team', grant: { mods: { critChanceAdd: 0.06 } } },
  { title: 'Haste', desc: '+6% attack rate for the team', grant: { mods: { rateMult: 1.06 } } },
  { title: 'Power', desc: '+8% damage for the team', grant: { mods: { damageMult: 1.08 } } },
  { title: 'Reach', desc: '+8% range for the team', grant: { mods: { rangeMult: 1.08 } } },
  { title: 'Ruin', desc: '+25% crit damage for the team', grant: { mods: { critMultAdd: 0.25 } } },
  { title: 'Resolve', desc: '+3 patience to the whole team', grant: { patience: 3 } },
]

/**
 * Three reward cards for a cleared wave — a mix of team attribute buffs and
 * items (items go to the inventory to equip later). Always at least one of each.
 */
export function generateRewardCards(rng: RNG, opts: { luck?: number; count?: number } = {}): RewardCard[] {
  const count = opts.count ?? 3
  const kinds: ('stat' | 'item')[] = []
  for (let i = 0; i < count; i++) kinds.push(rng.chance(0.5) ? 'stat' : 'item')
  if (!kinds.includes('item')) kinds[0] = 'item'
  if (!kinds.includes('stat')) kinds[kinds.length - 1] = 'stat'

  const usedStats = new Set<string>()
  return kinds.map((k) => {
    if (k === 'item') {
      const item = generateItem(rng, { luck: opts.luck })
      return { id: nextId('rw'), kind: 'item', title: item.name, desc: '', item }
    }
    let t = rng.pick(STAT_CARDS)
    let guard = 0
    while (usedStats.has(t.title) && guard++ < 20) t = rng.pick(STAT_CARDS)
    usedStats.add(t.title)
    return { id: nextId('rw'), kind: 'stat', title: t.title, desc: t.desc, grant: t.grant }
  })
}
