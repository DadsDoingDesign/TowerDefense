import { beforeEach, describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, newlyEarned, type RunFacts } from '../src/game/data/achievements'
import { FEAT_SKILLS, skillById } from '../src/game/data/skills'
import { skillPoolFor } from '../src/game/run/watch'
import { mutationOfferSize, MUTATION_OFFER_SIZE } from '../src/game/data/mutations'
import { RNG } from '../src/game/core/rng'
import { generateRunMap } from '../src/game/data/runmap'
import { handSize, rewardHand } from '../src/game/run/relics'
import { freshFeats, goblinKinds, runFacts } from '../src/game/run/settle'
import { lastFeats, migrateMeta, NEW_BANK, useMetaStore } from '../src/state/metaStore'

const facts = (over: Partial<RunFacts> = {}): RunFacts => ({
  won: false,
  starter: 'swing',
  hires: 1,
  maxFielded: 2,
  act: 1,
  flawlessBosses: 0,
  actBosses: 0,
  mutated: false,
  goldPeak: 0,
  crates: 0,
  goblinsSeen: 0,
  ...over,
})

describe('feats (data/achievements)', () => {
  it('a run that did nothing earns nothing', () => {
    expect(newlyEarned(facts(), {})).toEqual([])
  })

  it('a sword-hand win earns the win feats, and a feat already held is never earned twice', () => {
    const f = facts({ won: true, starter: 'swing', actBosses: 2, act: 3 })
    const ids = newlyEarned(f, {}).map((a) => a.id)
    expect(ids).toEqual(expect.arrayContaining(['act_two', 'first_light', 'win_fighter']))
    expect(ids).not.toContain('win_rogue')
    expect(newlyEarned(f, { act_two: 1, first_light: 1, win_fighter: 1 }).map((a) => a.id)).toEqual([])
  })

  it('Lone Wolf needs act 3 AND no hires; the stake feats read crates delivered', () => {
    expect(newlyEarned(facts({ act: 3, hires: 0 }), {}).map((a) => a.id)).toContain('lone_wolf')
    expect(newlyEarned(facts({ act: 3, hires: 1 }), {}).map((a) => a.id)).not.toContain('lone_wolf')
    expect(newlyEarned(facts({ won: true, crates: 3 }), {}).map((a) => a.id)).toEqual(expect.arrayContaining(['vow_one', 'vow_three']))
    expect(newlyEarned(facts({ won: false, crates: 3 }), {}).map((a) => a.id)).not.toContain('vow_one')
  })

  it('every feat has a purse of gold, and ids are unique', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
    for (const a of ACHIEVEMENTS) expect(a.gold).toBeGreaterThan(0)
  })

  it('runFacts reads hires off the starting size, the act off the deepest layer, and a mutation off the roster', () => {
    const feats = { ...freshFeats(), starter: 'shoot' as const, startSize: 2, maxFielded: 4, actBosses: 1 }
    const f = runFacts({
      won: false, feats, deepestLayer: 9, crates: 1, goblinsSeen: 4,
      roster: [{ mutations: [] }, { mutations: [{ key: 'x' } as never] }, { mutations: [] }],
    })
    expect(f.hires).toBe(1)
    expect(f.act).toBe(3)
    expect(f.mutated).toBe(true)
    expect(f.starter).toBe('shoot')
  })

  it('a Codex counts goblin KINDS: a modded sighting is the same goblin', () => {
    expect(goblinKinds(['torch1', 'torch1_warded', 'tnt2'])).toBe(2)
  })
})

describe('feat-locked skill cards (SK1)', () => {
  it('a feat card stays out of the pool until its feat', () => {
    expect(skillPoolFor([], () => false)).not.toContain('warden_of_ash')
    expect(skillPoolFor([], (id) => id === 'win_fighter')).toContain('warden_of_ash')
  })

  it('every feat card names a real feat, and that feat says it opens the card', () => {
    for (const [skill, feat] of Object.entries(FEAT_SKILLS)) {
      const a = ACHIEVEMENTS.find((x) => x.id === feat)
      expect(a, skill).toBeDefined()
      expect(a!.opens).toContain(skillById(skill)!.name)
    }
  })
})

describe('horizontal services (strange growth, the wide map)', () => {
  it('an act boss lays out a hand of three relics', () => {
    expect(handSize({ thinPickings: false })).toBe(3)
    expect(handSize({ thinPickings: true })).toBe(2)
    const hand = rewardHand(new RNG(3), { kind: 'boss', luck: 0.3, count: handSize({ thinPickings: false }), held: [] })
    expect(hand.filter((c) => c.kind === 'relic').length).toBe(3)
  })

  it('Strange Growth offers one more mutation', () => {
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

describe('feats pay gold into the bank (state/metaStore)', () => {
  beforeEach(() => useMetaStore.getState().resetMeta())

  it('a feat pays its purse once, on top of the run, and lands in the ledger', () => {
    const f = facts({ actBosses: 1, act: 2 })
    const settle = () => useMetaStore.getState().settleContract({ depth: 5, won: false, kills: 0, contract: { company: 'art', crates: 0, status: 'lost' }, deposit: 40, facts: f })
    const before = useMetaStore.getState().bank
    settle()
    const purse = ACHIEVEMENTS.find((a) => a.id === 'act_two')!.gold
    expect(useMetaStore.getState().bank - before).toBe(40 + purse)
    expect(lastFeats.ids).toEqual(['act_two'])
    expect(useMetaStore.getState().achieved('act_two')).toBe(true)
    const mid = useMetaStore.getState().bank
    settle()
    expect(useMetaStore.getState().bank - mid).toBe(40)
    expect(lastFeats.ids).toEqual([])
  })

  it('the retired services cannot be bought and are never open', () => {
    useMetaStore.setState({ bank: 1000, achievements: { act_two: 1, first_light: 1 } })
    expect(useMetaStore.getState().buyUpgrade('fieldKitchen')).toBe(false)
    expect(useMetaStore.getState().buyUpgrade('cartulary')).toBe(false)
    expect(useMetaStore.getState().unlocked('fieldKitchen')).toBe(false)
    expect(useMetaStore.getState().unlocked('cartulary')).toBe(false)
    expect(useMetaStore.getState().bank).toBe(1000)
  })

  it('v3 saves migrate with an empty ledger and Codex; junk is scrubbed', () => {
    const m = migrateMeta({ watchMarks: 190, upgrades: { base: 1 }, topDifficulty: 1, stats: {} }, 3)
    // 190 marks as gold, and (v9) the Reinforced Wagons level refunded: 60.
    expect(m.bank).toBe(190 + 60)
    expect(migrateMeta({ watchMarks: 90 }, 3).bank).toBe(NEW_BANK)
    expect(m.achievements).toEqual({})
    expect(m.codex).toEqual({ enemies: [], relics: [], felled: {} })
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
