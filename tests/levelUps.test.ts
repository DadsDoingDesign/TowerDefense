import { describe, expect, it } from 'vitest'
import { createSentinel } from '../src/game/data/sentinels'
import { applyXp, xpToReach } from '../src/game/engine/leveling'
import type { Sentinel } from '../src/game/types'
import { choiceOwed, levelUpOpen, rewardInPlace, settleLevelUps, type LevelUp } from '../src/ui/shell/levelUps'

/**
 * G3-2 — the reward picked under the field, and level-ups handled on the
 * roster. These are the rules the Selector, the Context panel and the two
 * modals all read, so they are pinned here rather than by screenshot alone.
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

describe('settleLevelUps', () => {
  it('badges a hero that levelled in a normal wave, remembering where it started', () => {
    const before = hero(3)
    const after = hero(4)
    const out = settleLevelUps({}, { h1: before }, [after], true)
    expect(out.h1).toMatchObject({ from: 3, seen: false })
    expect(out.h1.before).toBe(before)
  })

  it('does nothing for a hero that did not level', () => {
    expect(settleLevelUps({}, { h1: hero(3) }, [hero(3)], true)).toEqual({})
  })

  it('keeps the earliest start when an unseen level-up levels again', () => {
    const first: LevelUp = { from: 2, before: hero(2), seen: false }
    const out = settleLevelUps({ h1: first }, { h1: hero(3) }, [hero(4)], true)
    expect(out.h1.from).toBe(2)
  })

  it('hands an elite or endless level-up back to the modal', () => {
    const had: LevelUp = { from: 2, before: hero(2), seen: false }
    expect(settleLevelUps({ h1: had }, { h1: hero(4) }, [hero(5)], false)).toEqual({})
  })

  it('drops a hero who left the company', () => {
    const had: LevelUp = { from: 2, before: hero(2), seen: false }
    expect(settleLevelUps({ gone: had }, {}, [hero(3)], true)).toEqual({})
  })
})

describe('the badge', () => {
  it('stays until a plain level-up is seen', () => {
    const h = hero(4)
    expect(levelUpOpen({ from: 3, before: hero(3), seen: false }, h, [])).toBe(true)
    expect(levelUpOpen({ from: 3, before: hero(3), seen: true }, h, [])).toBe(false)
  })

  it('stays, seen or not, while a choice is owed', () => {
    const h = hero(5)
    expect(choiceOwed(h, [])).toBe('perk')
    expect(levelUpOpen({ from: 4, before: hero(4), seen: true }, h, [])).toBe(true)
    const e = hero(10)
    expect(choiceOwed(e, ['h1'])).toBe('evolve')
    expect(levelUpOpen({ from: 9, before: hero(9), seen: true }, e, ['h1'])).toBe(true)
  })

  it('never shows without an entry', () => {
    expect(levelUpOpen(undefined, hero(5), ['h1'])).toBe(false)
  })
})
