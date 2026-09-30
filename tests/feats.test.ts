import { beforeEach, describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, LOCKED_SPECS, newlyEarned, type RunFacts } from '../src/game/data/achievements'
import { mutationOfferSize, MUTATION_OFFER_SIZE } from '../src/game/data/mutations'
import { createSentinel } from '../src/game/data/sentinels'
import { RNG } from '../src/game/core/rng'
import { generateRunMap } from '../src/game/data/runmap'
import { applyXp, xpToReach } from '../src/game/engine/leveling'
import { CAMPFIRE_FORAGE, campfireChoices, forageAtCampfire } from '../src/game/run/campfire'
import { cartularyRelic, handSize, rewardHand } from '../src/game/run/relics'
import { freshFeats, goblinKinds, runFacts } from '../src/game/run/settle'
import { availableEvolutions, lockedEvolutions, specOpen } from '../src/game/run/unlocks'
import { bannerRules, endlessMarks, lastFeats, migrateMeta, useMetaStore } from '../src/state/metaStore'
import type { Sentinel } from '../src/game/types'

const facts = (over: Partial<RunFacts> = {}): RunFacts => ({
  mode: 'campaign',
  won: false,
  starter: 'fighter',
  hires: 1,
  maxFielded: 2,
  act: 1,
  flawlessBosses: 0,
  actBosses: 0,
  mutated: false,
  goldPeak: 0,
  banner: 0,
  rounds: 0,
  daily: false,
  goblinsSeen: 0,
  ...over,
})

describe('feats (data/achievements)', () => {
  it('a run that did nothing earns nothing', () => {
    expect(newlyEarned(facts(), {})).toEqual([])
  })

  it('a fighter win earns the win feats, and a feat already held is never earned twice', () => {
    const f = facts({ won: true, starter: 'fighter', actBosses: 2, act: 3 })
    const ids = newlyEarned(f, {}).map((a) => a.id)
    expect(ids).toEqual(expect.arrayContaining(['act_two', 'first_light', 'win_fighter']))
    expect(ids).not.toContain('win_rogue')
    expect(newlyEarned(f, { act_two: 1, first_light: 1, win_fighter: 1 }).map((a) => a.id)).toEqual([])
  })

  it('Lone Wolf needs act 3 AND no hires; Endless Ten reads rounds, not depth', () => {
    expect(newlyEarned(facts({ act: 3, hires: 0 }), {}).map((a) => a.id)).toContain('lone_wolf')
    expect(newlyEarned(facts({ act: 3, hires: 1 }), {}).map((a) => a.id)).not.toContain('lone_wolf')
    expect(newlyEarned(facts({ mode: 'endless', rounds: 10 }), {}).map((a) => a.id)).toContain('endless_ten')
    expect(newlyEarned(facts({ mode: 'campaign', rounds: 10 }), {}).map((a) => a.id)).not.toContain('endless_ten')
  })

  it('every feat has a purse, and ids are unique', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
    for (const a of ACHIEVEMENTS) expect(a.marks).toBeGreaterThan(0)
  })

  it('runFacts reads hires off the starting size, the act off the deepest layer, and a mutation off the roster', () => {
    const feats = { ...freshFeats(), starter: 'rogue' as const, startSize: 2, maxFielded: 4, actBosses: 1 }
    const f = runFacts({
      mode: 'campaign', won: false, feats, deepestLayer: 9, banner: 1, wins: 0, dailyScored: false, goblinsSeen: 4,
      roster: [{ mutations: [] }, { mutations: [{ key: 'x' } as never] }, { mutations: [] }],
    })
    expect(f.hires).toBe(1)
    expect(f.act).toBe(3)
    expect(f.mutated).toBe(true)
    expect(f.starter).toBe('rogue')
  })

  it('a Codex counts goblin KINDS: a modded sighting is the same goblin', () => {
    expect(goblinKinds(['torch1', 'torch1_warded', 'tnt2'])).toBe(2)
  })
})

describe('feat-locked content (game/run/unlocks)', () => {
  const at20 = (base: Sentinel, path: string[]): Sentinel => ({ ...applyXp(base, xpToReach(20)), branchPath: path })

  it('a locked spec stays out of the offer until its feat, and every branch keeps two open paths', () => {
    expect(specOpen('warden_of_ash', () => false)).toBe(false)
    expect(specOpen('warden_of_ash', (id) => id === 'win_fighter')).toBe(true)
    const guard = at20(createSentinel('fighter'), ['fighter', 'guard'])
    const open = availableEvolutions(guard, () => false).map((n) => n.id)
    expect(open).not.toContain('warden_of_ash')
    expect(open.length).toBeGreaterThanOrEqual(2)
    expect(lockedEvolutions(guard, () => false).map((n) => n.id)).toEqual(['warden_of_ash'])
    expect(availableEvolutions(guard, () => true).map((n) => n.id)).toContain('warden_of_ash')
  })

  it('every locked spec names a real feat', () => {
    for (const feat of Object.values(LOCKED_SPECS)) expect(ACHIEVEMENTS.some((a) => a.id === feat)).toBe(true)
  })
})

describe('horizontal services (campfire forage, relic cartulary, strange growth)', () => {
  it('the Field Kitchen adds a third campfire choice worth CAMPFIRE_FORAGE gold', () => {
    expect(campfireChoices(false)).toEqual(['rest', 'train'])
    expect(campfireChoices(true)).toEqual(['rest', 'train', 'forage'])
    expect(forageAtCampfire(12)).toBe(12 + CAMPFIRE_FORAGE)
    expect(forageAtCampfire(-5)).toBe(CAMPFIRE_FORAGE)
  })

  it('the Relic Cartulary adds one relic to an act boss hand, off its own stream, never a duplicate', () => {
    expect(handSize({ thinPickings: false })).toBe(3)
    expect(handSize({ thinPickings: true })).toBe(2)
    const rng = new RNG(3)
    const hand = rewardHand(rng, { kind: 'boss', luck: 0.3, count: handSize({ thinPickings: false }), held: [] })
    const after = rng.next()
    const extra = cartularyRelic(new RNG(99), { luck: 0.3, held: [], hand })
    expect(extra?.kind).toBe('relic')
    expect(hand.map((c) => c.relic)).not.toContain(extra!.relic)
    // The main stream is untouched: the same hand rolled again leaves it where it was.
    const rng2 = new RNG(3)
    rewardHand(rng2, { kind: 'boss', luck: 0.3, count: 3, held: [] })
    expect(rng2.next()).toBe(after)
  })

  it('Strange Growth offers one more mutation, on either Vow', () => {
    expect(mutationOfferSize(false, false)).toBe(MUTATION_OFFER_SIZE)
    expect(mutationOfferSize(false, true)).toBe(MUTATION_OFFER_SIZE + 1)
    expect(mutationOfferSize(true, true)).toBe(3)
  })

  it("a wide map keeps its fights: the Cartographer's layers are no more stop-heavy than a plain map's", () => {
    const share = (wide: boolean) => {
      let fights = 0
      let free = 0
      for (let i = 0; i < 120; i++) {
        const m = generateRunMap(new RNG(500 + i), { wideMap: wide })
        for (const n of m.nodes) {
          if (n.type === 'start' || n.type === 'boss' || n.type === 'miniboss') continue
          free++
          if (n.type === 'battle' || n.type === 'elite') fights++
        }
      }
      return fights / free
    }
    expect(share(true)).toBeGreaterThanOrEqual(share(false))
  })
})

describe('Watch Marks for feats and Endless (state/metaStore)', () => {
  beforeEach(() => useMetaStore.getState().resetMeta())

  it('a feat pays its purse once, on top of the run, and lands in the ledger', () => {
    const f = facts({ actBosses: 1, act: 2 })
    const before = useMetaStore.getState().watchMarks
    useMetaStore.getState().grantRunRewards({ depth: 5, won: false, kills: 0, downs: 0, facts: f })
    const purse = ACHIEVEMENTS.find((a) => a.id === 'act_two')!.marks
    expect(useMetaStore.getState().watchMarks - before).toBe(5 * 8 + purse)
    expect(lastFeats.ids).toEqual(['act_two'])
    expect(useMetaStore.getState().achieved('act_two')).toBe(true)
    const mid = useMetaStore.getState().watchMarks
    useMetaStore.getState().grantRunRewards({ depth: 5, won: false, kills: 0, downs: 0, facts: f })
    expect(useMetaStore.getState().watchMarks - mid).toBe(5 * 8)
    expect(lastFeats.ids).toEqual([])
  })

  it('a feat-locked service cannot be bought before its feat, and can after', () => {
    useMetaStore.setState({ watchMarks: 1000 })
    expect(useMetaStore.getState().purchasable('fieldKitchen')).toBe(false)
    useMetaStore.getState().buyUpgrade('fieldKitchen')
    expect(useMetaStore.getState().unlocked('fieldKitchen')).toBe(false)
    useMetaStore.setState({ achievements: { act_two: 1 } })
    useMetaStore.getState().buyUpgrade('fieldKitchen')
    expect(useMetaStore.getState().unlocked('fieldKitchen')).toBe(true)
  })

  it('Endless pays per round, a bonus every fifth, multiplied by the Vow won', () => {
    expect(endlessMarks(0, 0)).toBe(0)
    expect(endlessMarks(4, 0)).toBe(32)
    expect(endlessMarks(5, 0)).toBe(60)
    expect(endlessMarks(10, 2)).toBe(Math.round(120 * bannerRules(2).markMult))
    expect(endlessMarks(Number.NaN, 1)).toBe(0)
  })

  it('the Vow multiplier reaches Endless only once Ten Rounds is earned', () => {
    useMetaStore.setState({ stats: { ...useMetaStore.getState().stats, bestBanner: 2 } })
    const pay = () => {
      const a = useMetaStore.getState().watchMarks
      useMetaStore.getState().grantRunRewards({ depth: 5, won: false, kills: 0, downs: 0, mode: 'endless' })
      return useMetaStore.getState().watchMarks - a
    }
    expect(pay()).toBe(endlessMarks(5, 0))
    useMetaStore.setState({ achievements: { endless_ten: 1 } })
    expect(pay()).toBe(endlessMarks(5, 2))
  })

  it('v3 saves migrate to v4 with an empty ledger and Codex; junk is scrubbed', () => {
    const m = migrateMeta({ watchMarks: 90, upgrades: { base: 1 }, sacrificeTier: 1, stats: {} }, 3)
    expect(m.watchMarks).toBe(90)
    expect(m.achievements).toEqual({})
    expect(m.codex).toEqual({ enemies: [], relics: [], specs: [], perks: [], felled: {} })
    const junk = migrateMeta({ achievements: { act_two: 'x', nope: 1, first_light: -4 }, codex: { enemies: ['a', 'a', 3], relics: 'no' } }, 4)
    expect(junk.achievements).toEqual({ act_two: 1, first_light: 1 })
    expect(junk.codex.enemies).toEqual(['a'])
    expect(junk.codex.relics).toEqual([])
  })

  it('the Codex deduplicates and keeps first-sighting order', () => {
    useMetaStore.getState().recordCodex({ enemies: ['torch1', 'tnt1'] })
    useMetaStore.getState().recordCodex({ enemies: ['tnt1', 'barrel1'], relics: ['ledger'] })
    expect(useMetaStore.getState().codex.enemies).toEqual(['torch1', 'tnt1', 'barrel1'])
    expect(useMetaStore.getState().codex.relics).toEqual(['ledger'])
  })
})
