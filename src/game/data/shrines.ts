import type { RNG } from '../core/rng'
import type { Sentinel } from '../types'

export interface ShrineContext {
  roster: Sentinel[]
  baseHp: number
  gold: number
}

export interface ShrineEffect {
  roster?: Sentinel[]
  baseHpDelta?: number
  goldDelta?: number
}

export interface ShrineOffer {
  id: string
  title: string
  boon: string
  curse: string
  apply: (ctx: ShrineContext) => ShrineEffect
}

const bump = (roster: Sentinel[], fn: (s: Sentinel) => Sentinel): Sentinel[] => roster.map(fn)

const SHRINES: ShrineOffer[] = [
  {
    id: 'iron',
    title: 'Trial of Iron',
    boon: '+4 STR to every Sentinel',
    curse: 'The base takes 3 damage now',
    apply: ({ roster }) => ({
      roster: bump(roster, (s) => ({ ...s, stats: { ...s.stats, str: s.stats.str + 4 } })),
      baseHpDelta: -3,
    }),
  },
  {
    id: 'wind',
    title: 'Shrine of Wind',
    boon: '+4 DEX to every Sentinel',
    curse: 'Lose 40 gold',
    apply: ({ roster }) => ({
      roster: bump(roster, (s) => ({ ...s, stats: { ...s.stats, dex: s.stats.dex + 4 } })),
      goldDelta: -40,
    }),
  },
  {
    id: 'mind',
    title: 'Font of Mind',
    boon: '+4 INT to every Sentinel',
    curse: 'The base takes 3 damage now',
    apply: ({ roster }) => ({
      roster: bump(roster, (s) => ({ ...s, stats: { ...s.stats, int: s.stats.int + 4 } })),
      baseHpDelta: -3,
    }),
  },
  {
    id: 'thorn',
    title: 'Bramble Altar',
    boon: '+6 Thorns and +3 Patience to every Sentinel',
    curse: 'Lose 30 gold',
    apply: ({ roster }) => ({
      roster: bump(roster, (s) => ({ ...s, thorns: s.thorns + 6, patience: s.patience + 3 })),
      goldDelta: -30,
    }),
  },
  {
    id: 'blood',
    title: 'Blood Pact',
    boon: '+3 to ALL stats for every Sentinel',
    curse: 'The base takes 5 damage now',
    apply: ({ roster }) => ({
      roster: bump(roster, (s) => ({
        ...s,
        stats: { str: s.stats.str + 3, dex: s.stats.dex + 3, int: s.stats.int + 3 },
      })),
      baseHpDelta: -5,
    }),
  },
  {
    id: 'greed',
    title: "Miser's Bargain",
    boon: 'Gain 90 gold',
    curse: '−2 Patience to every Sentinel',
    apply: ({ roster }) => ({
      roster: bump(roster, (s) => ({ ...s, patience: Math.max(0, s.patience - 2) })),
      goldDelta: 90,
    }),
  },
]

export function rollShrine(rng: RNG): ShrineOffer {
  return rng.pick(SHRINES)
}
