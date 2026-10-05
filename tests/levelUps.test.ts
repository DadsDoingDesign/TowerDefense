import { describe, expect, it } from 'vitest'
import { createSentinel } from '../src/game/data/sentinels'
import { applyXp, xpToReach } from '../src/game/engine/leveling'
import type { Sentinel } from '../src/game/types'
import { choiceOwed, FLASH_MS, flashLive, grantWords, levelUpOpen, rewardInPlace, settleFlashes, waveLive } from '../src/ui/shell/levelUps'

/**
 * G3-2 / SK1 — the reward picked under the field, and level-ups handled on
 * the roster: a plain level flashes and is gone, a skill milestone wears a
 * badge until it is chosen — between rounds only. These are the rules the
 * Selector and the Context panel read, so they are pinned here.
 */

const hero = (level: number, id = 'h1'): Sentinel => {
  const s = createSentinel('fighter')
  return { ...applyXp({ ...s, xp: 0, level: 1 }, xpToReach(level)), id }
}

const nodes = [
  { id: 'n-battle', type: 'battle' as const, layer: 1, row: 0, nx: 0, ny: 0 },
  { id: 'n-elite', type: 'elite' as const, layer: 2, row: 0, nx: 0, ny: 0 },
  { id: 'n-mini', type: 'miniboss' as const, layer: 3, row: 0, nx: 0, ny: 0 },
]

const settled = (over: Record<string, unknown> = {}) =>
  ({
    screen: 'battle',
    mode: 'campaign',
    runPhase: 'active',
    reward: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
    lastResult: { status: 'cleared' },
    waveBeat: null,
    engine: null,
    crossroads: null,
    runMap: { nodes },
    currentNodeId: 'n-battle',
    ...over,
  }) as unknown as Parameters<typeof rewardInPlace>[0]

describe('rewardInPlace', () => {
  it('holds for a cleared normal campaign battle with its hand dealt', () => {
    expect(rewardInPlace(settled())).toBe(true)
  })

  it.each([
    ['an elite', { currentNodeId: 'n-elite' }],
    ['an act boss', { currentNodeId: 'n-mini' }],
    ['the wave-clear beat', { waveBeat: { status: 'cleared', startedAt: 0 } }],
    ['a loss', { lastResult: { status: 'defeated' } }],
    ['no hand', { reward: null }],
    ['endless', { mode: 'endless' }],
    ['the map (the page owns it there)', { screen: 'map' }],
    ['a fork pending', { crossroads: { recruits: [], mutations: [], mutationHeroId: null } }],
  ])('does not hold for %s', (_, over) => {
    expect(rewardInPlace(settled(over))).toBe(false)
  })
})

describe('settleFlashes (SK2: a plain level-up says so in passing)', () => {
  it('flashes every hero that levelled, from where it started', () => {
    const out = settleFlashes({ h1: hero(3) }, [hero(4)], 1000)
    expect(out.h1).toEqual({ from: 3, to: 4, at: 1000 })
  })

  it('does nothing for a hero that did not level, or one that just joined', () => {
    expect(settleFlashes({ h1: hero(3) }, [hero(3)], 0)).toEqual({})
    expect(settleFlashes({}, [hero(4)], 0)).toEqual({})
  })

  it('fades on its own', () => {
    const f = { from: 3, to: 4, at: 1000 }
    expect(flashLive(f, 1000 + FLASH_MS - 1)).toBe(true)
    expect(flashLive(f, 1000 + FLASH_MS)).toBe(false)
    expect(flashLive(undefined, 0)).toBe(false)
  })
})

describe('the badge (SK2: only a real choice wears one)', () => {
  it('shows exactly while a skill milestone is owed', () => {
    expect(levelUpOpen(hero(4))).toBe(false)
    expect(choiceOwed(hero(5))).toBe('skill')
    expect(levelUpOpen(hero(5))).toBe(true)
    expect(levelUpOpen({ ...hero(9), skillPicks: 1 })).toBe(false)
    expect(levelUpOpen({ ...hero(10), skillPicks: 1 })).toBe(true)
    expect(levelUpOpen({ ...hero(20), skillPicks: 3 })).toBe(false)
  })

  it('the choice waits for the wave: a live fight is not between rounds', () => {
    expect(waveLive({ engine: {} as never, battlePhase: 'battle' })).toBe(true)
    expect(waveLive({ engine: null, battlePhase: 'setup' })).toBe(false)
    expect(waveLive({ engine: {} as never, battlePhase: 'setup' })).toBe(false)
  })
})

describe('the level-10 and level-15 grant (SK1 tuning pass)', () => {
  it('is paid with the level, once, on top of the level growth', () => {
    const base = createSentinel('fighter')
    const at9 = applyXp(base, xpToReach(9))
    const at10 = applyXp(at9, xpToReach(10) - xpToReach(9))
    // A plain level is +2 STR / +1 DEX for a Fighter; level 10 adds +10 STR +3 DEX and +6 thorns.
    expect(at10.stats.str - at9.stats.str).toBe(2 + 10)
    expect(at10.stats.dex - at9.stats.dex).toBe(1 + 3)
    expect(at10.thorns - at9.thorns).toBe(6)
    // One jump across both milestones pays both, exactly as two steps would.
    const jump = applyXp(base, xpToReach(15))
    const steps = applyXp(applyXp(base, xpToReach(12)), xpToReach(15) - xpToReach(12))
    expect(jump.stats).toEqual(steps.stats)
    expect(jump.thorns).toBe(steps.thorns)
  })

  it('is said in the bump’s own words, main stat first', () => {
    expect(grantWords('fighter', 9, 10)).toBe('+10 STR +3 DEX')
    expect(grantWords('rogue', 14, 15)).toBe('+13 DEX +4 STR')
    expect(grantWords('mystic', 8, 16)).toBe('+23 INT +7 DEX')
    expect(grantWords('mystic', 10, 14)).toBeNull()
  })
})
