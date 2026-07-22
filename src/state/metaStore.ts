import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface MetaUpgrade {
  id: string
  name: string
  desc: string
  maxLevel: number
  baseCost: number
  step: number
}

export const UPGRADES: MetaUpgrade[] = [
  { id: 'base', name: 'Reinforced Base', desc: '+5 max Base integrity', maxLevel: 5, baseCost: 60, step: 40 },
  { id: 'gold', name: 'War Chest', desc: '+25 starting gold', maxLevel: 5, baseCost: 50, step: 30 },
  { id: 'stats', name: 'Seasoned Recruits', desc: '+1 to all stats on starting Sentinels', maxLevel: 6, baseCost: 80, step: 50 },
  { id: 'roster', name: 'Standing Company', desc: 'Begin each run with an extra Sentinel', maxLevel: 2, baseCost: 150, step: 150 },
  { id: 'loot', name: 'Quartermaster', desc: 'Begin each run with an extra item', maxLevel: 2, baseCost: 70, step: 60 },
  { id: 'marks', name: 'Chronicler', desc: '+15% Watch Marks earned', maxLevel: 4, baseCost: 100, step: 80 },
]
const UPGRADE_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]))

export const SACRIFICE_BASE_COST = 200
export const SACRIFICE_STEP = 150

export interface MetaStats {
  bestDepth: number
  totalKills: number
  sentinelsLost: number
  runsCompleted: number
  runsWon: number
}

/** Bonuses the meta layer grants to each new run. */
export interface MetaBonuses {
  maxBaseHp: number
  startGold: number
  statBonus: number
  extraSentinels: number
  extraItems: number
  markMult: number
  enemyHpMult: number
}

interface MetaState {
  watchMarks: number
  upgrades: Record<string, number>
  sacrificeTier: number
  stats: MetaStats
  // actions
  upgradeCost: (id: string) => number
  buyUpgrade: (id: string) => void
  sacrificeCost: () => number
  doSacrifice: () => void
  grantMarks: (n: number) => void
  grantRunRewards: (info: { depth: number; won: boolean; kills: number; downs: number }) => number
  bonuses: () => MetaBonuses
  resetMeta: () => void
}

const BASE_MAX_HP = 20
const BASE_GOLD = 60

const freshStats = (): MetaStats => ({
  bestDepth: 0,
  totalKills: 0,
  sentinelsLost: 0,
  runsCompleted: 0,
  runsWon: 0,
})

export const useMetaStore = create<MetaState>()(
  persist(
    (set, get) => ({
      watchMarks: 0,
      upgrades: {},
      sacrificeTier: 0,
      stats: freshStats(),

      upgradeCost: (id) => {
        const u = UPGRADE_BY_ID.get(id)!
        const level = get().upgrades[id] ?? 0
        return u.baseCost + u.step * level
      },

      buyUpgrade: (id) => {
        const u = UPGRADE_BY_ID.get(id)
        if (!u) return
        const { watchMarks, upgrades } = get()
        const level = upgrades[id] ?? 0
        if (level >= u.maxLevel) return
        const cost = get().upgradeCost(id)
        if (watchMarks < cost) return
        set({ watchMarks: watchMarks - cost, upgrades: { ...upgrades, [id]: level + 1 } })
      },

      sacrificeCost: () => SACRIFICE_BASE_COST + SACRIFICE_STEP * get().sacrificeTier,

      doSacrifice: () => {
        const { watchMarks, sacrificeTier } = get()
        const cost = get().sacrificeCost()
        if (watchMarks < cost) return
        set({ watchMarks: watchMarks - cost, sacrificeTier: sacrificeTier + 1 })
      },

      grantMarks: (n: number) => set({ watchMarks: get().watchMarks + Math.max(0, Math.round(n)) }),

      grantRunRewards: ({ depth, won, kills, downs }) => {
        const { watchMarks, stats, upgrades, sacrificeTier } = get()
        const markMult = (1 + (upgrades.marks ?? 0) * 0.15) * (1 + sacrificeTier * 0.1)
        const earned = Math.round((depth * 8 + (won ? 120 : 0)) * markMult)
        set({
          watchMarks: watchMarks + earned,
          stats: {
            bestDepth: Math.max(stats.bestDepth, depth),
            totalKills: stats.totalKills + kills,
            sentinelsLost: stats.sentinelsLost + downs,
            runsCompleted: stats.runsCompleted + 1,
            runsWon: stats.runsWon + (won ? 1 : 0),
          },
        })
        return earned
      },

      bonuses: () => {
        const { upgrades, sacrificeTier } = get()
        const lvl = (id: string) => upgrades[id] ?? 0
        return {
          maxBaseHp: BASE_MAX_HP + lvl('base') * 5,
          startGold: BASE_GOLD + lvl('gold') * 25,
          statBonus: lvl('stats') + sacrificeTier,
          extraSentinels: lvl('roster'),
          extraItems: lvl('loot'),
          markMult: (1 + lvl('marks') * 0.15) * (1 + sacrificeTier * 0.1),
          enemyHpMult: 1 + sacrificeTier * 0.15,
        }
      },

      resetMeta: () => set({ watchMarks: 0, upgrades: {}, sacrificeTier: 0, stats: freshStats() }),
    }),
    {
      name: 'fieldwatch-meta',
      partialize: (s) => ({
        watchMarks: s.watchMarks,
        upgrades: s.upgrades,
        sacrificeTier: s.sacrificeTier,
        stats: s.stats,
      }),
    },
  ),
)
