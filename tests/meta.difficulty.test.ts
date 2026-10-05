import { beforeEach, describe, expect, it } from 'vitest'
import { RANDOM_UNLOCK_SKILLS, STARTER_SKILLS } from '../src/game/data/skills'
import { watchLevelFor, watchXpFor, winScore } from '../src/game/run/watch'
import { lastProgress, legacyBannerRefund, MAX_DIFFICULTY, META_VERSION, migrateMeta, retroWatchXp, useMetaStore } from '../src/state/metaStore'

/** SK1 — the difficulty climb that replaced the Vow ladder, and the skill cards it pays. */
describe('difficulty steps — climbed by winning', () => {
  beforeEach(() => useMetaStore.getState().resetMeta())

  const win = (difficulty: number, extra: { ranked?: boolean; mode?: 'campaign' | 'endless'; kills?: number; daily?: string | null } = {}) =>
    useMetaStore.getState().grantRunRewards({ depth: 12, won: true, kills: extra.kills ?? 300, difficulty, ...extra })

  it('a win at the top step raises it one step and unlocks a card', () => {
    expect(useMetaStore.getState().topDifficulty).toBe(0)
    win(0)
    expect(useMetaStore.getState().topDifficulty).toBe(1)
    expect(lastProgress.run?.win).toMatchObject({ step: 0, card: true, stepUp: true })
    win(1)
    win(2)
    expect(useMetaStore.getState().topDifficulty).toBe(3)
    expect(useMetaStore.getState().stats.bestDifficulty).toBe(2)
  })

  it('stops at the top of the climb, where a win still pays a card', () => {
    useMetaStore.setState({ topDifficulty: MAX_DIFFICULTY })
    win(MAX_DIFFICULTY)
    expect(useMetaStore.getState().topDifficulty).toBe(MAX_DIFFICULTY)
    expect(lastProgress.run?.win).toMatchObject({ card: true, stepUp: false })
  })

  it('a win below the top pays a card only for a new best score at that step', () => {
    useMetaStore.setState({ topDifficulty: 3 })
    win(1, { kills: 300 })
    expect(lastProgress.run?.win).toMatchObject({ card: true, newBest: true, stepUp: false })
    expect(useMetaStore.getState().difficultyBest['1']).toBe(winScore(12, 300))
    const cards = useMetaStore.getState().skills.length
    win(1, { kills: 250 })
    expect(lastProgress.run?.win).toMatchObject({ card: false, newBest: false })
    // Watch levels may still pay their own cards; the WIN paid none.
    expect(useMetaStore.getState().topDifficulty).toBe(3)
    win(1, { kills: 400 })
    expect(lastProgress.run?.win).toMatchObject({ card: true, newBest: true })
    expect(useMetaStore.getState().skills.length).toBeGreaterThan(cards)
  })

  it('a loss, an Endless run, a custom seed or a Daily climbs nothing', () => {
    useMetaStore.getState().grantRunRewards({ depth: 9, won: false, kills: 0, difficulty: 0 })
    win(0, { mode: 'endless' })
    win(0, { ranked: false })
    win(0, { daily: '2026-09-30' })
    expect(useMetaStore.getState().topDifficulty).toBe(0)
  })

  it('a step the save has not reached cannot be claimed, or paid for', () => {
    win(5) // a hand-edited payload playing a step this save never reached
    expect(useMetaStore.getState().topDifficulty).toBe(1)
    expect(useMetaStore.getState().stats.bestDifficulty).toBe(0)
  })

  it('pays more Marks the higher the step', () => {
    useMetaStore.setState({ topDifficulty: 4 })
    const pay = (d: number) => {
      const a = useMetaStore.getState().watchMarks
      useMetaStore.getState().grantRunRewards({ depth: 6, won: false, kills: 0, difficulty: d })
      return useMetaStore.getState().watchMarks - a
    }
    expect(pay(4)).toBeGreaterThan(pay(2))
    expect(pay(2)).toBeGreaterThan(pay(0))
  })
})

describe('Watch XP and skill cards', () => {
  beforeEach(() => useMetaStore.getState().resetMeta())

  it('every run earns Watch XP, and each Watch level reached unlocks one random card', () => {
    useMetaStore.getState().grantRunRewards({ depth: 6, won: false, kills: 200, difficulty: 0 })
    const xp = watchXpFor({ depth: 6, kills: 200, won: false })
    expect(useMetaStore.getState().watchXp).toBe(xp)
    const levels = watchLevelFor(xp) - 1
    expect(useMetaStore.getState().skills).toHaveLength(levels)
    expect(lastProgress.run).toMatchObject({ xp, levelBefore: 1, levelAfter: 1 + levels })
    for (const id of useMetaStore.getState().skills) {
      expect(RANDOM_UNLOCK_SKILLS).toContain(id)
      expect(STARTER_SKILLS).not.toContain(id)
    }
  })

  it('never unlocks a card twice, and stops when every random card is open', () => {
    useMetaStore.setState({ watchXp: 0 })
    for (let i = 0; i < 80; i++) useMetaStore.getState().grantRunRewards({ depth: 12, won: false, kills: 900, difficulty: 0 })
    const got = useMetaStore.getState().skills
    expect(new Set(got).size).toBe(got.length)
    expect(got.length).toBe(RANDOM_UNLOCK_SKILLS.length)
  })
})

describe('save migration v5 → v6 (SK1)', () => {
  it('the highest unlocked Vow becomes the top difficulty step, and the best Vow won the best difficulty', () => {
    const m = migrateMeta({ watchMarks: 40, sacrificeTier: 2, upgrades: {}, stats: { bestBanner: 1, runsCompleted: 0 } }, 5)
    expect(m.topDifficulty).toBe(2)
    expect(m.stats.bestDifficulty).toBe(1)
    expect(m.watchMarks).toBe(40)
  })

  it('a save that has played is credited Watch XP and the cards its levels buy', () => {
    const stats = { totalKills: 2000, runsWon: 2, runsCompleted: 10 }
    const m = migrateMeta({ stats }, 5)
    expect(m.watchXp).toBe(retroWatchXp({ totalKills: 2000, runsWon: 2, runsCompleted: 10 }))
    expect(m.skills).toHaveLength(watchLevelFor(m.watchXp) - 1)
    // Only on the real step: a current save is never credited twice.
    const again = migrateMeta({ ...m }, META_VERSION)
    expect(again.watchXp).toBe(m.watchXp)
    expect(again.skills).toEqual(m.skills)
  })

  it('scrubs what it cannot trust: unknown cards, duplicates, out-of-range steps and bests', () => {
    const m = migrateMeta(
      { skills: ['charge', 'charge', 'quick_hands', 'nope', 7], topDifficulty: 99, difficultyBest: { 1: 2400, 99: 5, x: 3, 2: 'no' }, watchXp: -5 },
      META_VERSION,
    )
    expect(m.skills).toEqual(['charge'])
    expect(m.topDifficulty).toBe(MAX_DIFFICULTY)
    expect(m.difficultyBest).toEqual({ '1': 2400 })
    expect(m.watchXp).toBe(0)
  })

  it('v2 saves still get every mark they spent on rungs back (the v3 refund), once', () => {
    expect(legacyBannerRefund(0)).toBe(0)
    expect(legacyBannerRefund(3)).toBe(200 + 350 + 500)
    const m = migrateMeta({ watchMarks: 40, sacrificeTier: 2, upgrades: {}, stats: {} }, 2)
    expect(m.watchMarks).toBe(40 + 550)
    expect(m.topDifficulty).toBe(2)
    expect(migrateMeta({ watchMarks: 40, topDifficulty: 2 }, META_VERSION).watchMarks).toBe(40)
  })
})
