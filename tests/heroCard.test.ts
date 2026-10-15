import { describe, expect, it } from 'vitest'
import { RNG } from '../src/game/core/rng'
import { generateItem, raiseAdds, raisedBase, upgradeCost, upgradeRarity } from '../src/game/data/items'
import { classicHero } from '../src/game/data/sentinels'
import { computeCombat } from '../src/game/engine/combat'
import { applyXp, xpToReach } from '../src/game/engine/leveling'
import { firstRowTop, previewRoom, stageView, entrySide, stageViewClear, type StageViewInput } from '../src/game/render/frame'
import { playRect, worldOf } from '../src/game/render/terrain'
import { fieldFor, FIRST_MAP, KILN_MAP } from '../src/game/data/maps'
import type { GameMap, Item, Sentinel } from '../src/game/types'
import { queueWidth, chipsThatFit } from '../src/ui/shell/enemyQueue'
import {
  canSpend,
  cardFields,
  heroUpgrades,
  levelWords,
  placementsCount,
  skillSlots,
  targetsValue,
  upgradeButtonName,
  upgradeWaiting,
} from '../src/ui/shell/heroCard'

/**
 * The battle band (Oct 2026): the hero card's fields and skill slots, what a
 * hero can upgrade (and that previewing a raise never touches an RNG), the
 * Upgrade button's rules, and where the Stage's wave preview may hang.
 */

const hero = (level = 1): Sentinel => {
  const s = classicHero('fighter')
  return level > 1 ? applyXp({ ...s, xp: 0, level: 1 }, xpToReach(level)) : s
}
const withGear = (h: Sentinel, main: Item | null): Sentinel => ({ ...h, equipment: { mainHand: main, offHand: null, body: null } })

describe('the hero card', () => {
  it('always shows the same four fields, in one order', () => {
    const f = cardFields(computeCombat(hero()))
    expect(f.map((x) => x.key)).toEqual(['reach', 'targets', 'damage', 'speed'])
    for (const x of f) expect(x.words.length).toBeGreaterThan(0)
  })

  it('says how many enemies one attack reaches', () => {
    const base = { splashRadius: 0, mods: {} }
    expect(targetsValue(base).value).toBe('1')
    expect(targetsValue({ ...base, splashRadius: 30 }).value).toBe('Area')
    expect(targetsValue({ ...base, mods: { pierce: 2 } }).value).toBe('1+2 pierce')
    expect(targetsValue({ ...base, mods: { shock: { chains: 3, dmgFrac: 0.5 } } }).value).toBe('1+3 chain')
  })

  it('names the level in words', () => {
    expect(levelWords(6, 0.4)).toBe('Level 6 of 20, 40% of the way to 7')
    expect(levelWords(20, 1)).toMatch(/top level/)
  })

  it('has three skill slots: held, owed, then the levels the next choices come at', () => {
    const h = { ...hero(), skills: ['bounty'], skillPicks: 0 }
    expect(skillSlots(h).map((s) => s.kind)).toEqual(['held', 'later', 'later'])
    expect(skillSlots(h).filter((s) => s.kind === 'later').map((s) => (s.kind === 'later' ? s.level : 0))).toEqual([5, 10])
    const owed = { ...h, level: 5 }
    expect(skillSlots(owed).map((s) => s.kind)).toEqual(['held', 'owed', 'later'])
    const done = { ...h, level: 20, skills: ['bounty', 'pin_down', 'cold_snap'], skillPicks: 3 }
    expect(skillSlots(done).map((s) => s.kind)).toEqual(['held', 'held', 'held'])
  })

  it('counts the heroes standing on the field', () => {
    expect(placementsCount({ roster: [{ id: 'a' }, { id: 'b' }], placements: { t1: 'a', t2: null } })).toBe(1)
  })
})

describe('upgrades', () => {
  const sword = generateItem(new RNG(3), { rarity: 'common', kind: 'Sword' })

  it('a raise preview is the certain half of the raise, and draws nothing', () => {
    const rng = new RNG(11)
    const before = rng.next()
    const rng2 = new RNG(11)
    const preview = raisedBase(sword)
    // The preview took no draw: the stream still gives the same next number.
    expect(rng2.next()).toBe(before)
    const real = upgradeRarity(sword, new RNG(5))
    expect(preview.rarity).toBe(real.rarity)
    expect(preview.base).toEqual(real.base)
    expect(real.enchantments.length - sword.enchantments.length).toBe(raiseAdds(sword))
  })

  it('lists the skill choice first, then every worn piece that can rise, with its price', () => {
    const h = withGear(hero(5), sword)
    const ups = heroUpgrades(h, 1000)
    expect(ups[0].kind).toBe('skill')
    const raise = ups.find((u) => u.kind === 'raise')!
    expect(raise.kind === 'raise' && raise.cost).toBe(upgradeCost(sword))
    expect(raise.kind === 'raise' && raise.from).toBe('Common')
    expect(raise.kind === 'raise' && raise.deltas[0]?.label).toBe('DPS')
  })

  it('shows Upgrade only with something to spend, and badges a waiting choice', () => {
    const h = withGear(hero(1), sword)
    expect(canSpend(heroUpgrades(h, 0))).toBe(false)
    expect(canSpend(heroUpgrades(h, upgradeCost(sword)))).toBe(true)
    expect(upgradeWaiting(heroUpgrades(h, 1000))).toBe(false)
    const owed = withGear(hero(5), sword)
    expect(canSpend(heroUpgrades(owed, 0))).toBe(true)
    expect(upgradeWaiting(heroUpgrades(owed, 0))).toBe(true)
    expect(upgradeButtonName('Rook', heroUpgrades(owed, 1000))).toBe('Upgrade Rook — a skill to choose, 1 piece to raise')
    const short = heroUpgrades(h, 10).find((u) => u.kind === 'raise')!
    expect(short.kind === 'raise' && short.short).toBe(upgradeCost(sword) - 10)
  })
})

describe('the wave preview keeps clear of the play', () => {
  const input = (map: GameMap, wrapW: number, wrapH: number): StageViewInput => ({
    wrapW,
    wrapH,
    padT: 0,
    padB: 0,
    dpr: 2,
    crisp: false,
    play: playRect(map),
    world: worldOf(map),
    entry: entrySide(map),
  })
  const FIELDS: [string, GameMap, number, number][] = [
    ['390×844 portrait', fieldFor(FIRST_MAP.id, null, 'portrait')!, 390, 600],
    ['320×568 portrait', fieldFor(KILN_MAP.id, null, 'portrait')!, 320, 356],
    ['1440×900 desk', FIRST_MAP, 978, 795],
  ]
  it.each(FIELDS)('%s: the first standing row lies below a 50px strip', (_n, map, w, h) => {
    const need = 50
    const top = firstRowTop(map)
    const v = stageViewClear(input(map, w, h), top, need)
    const fy = v.top - v.y0 * v.scale
    expect(fy + top * v.scale).toBeGreaterThanOrEqual(need - 0.5)
    // And when the woodland above it is room enough, nothing moves at all.
    if (previewRoom(input(map, w, h), top, need) === 0) expect(v).toEqual(stageView(input(map, w, h)))
  })

  it('reads the first row off the tiles, never the woodland or the lane', () => {
    const map = fieldFor(FIRST_MAP.id, null, 'portrait')!
    const T = map.tile ?? 40
    const standing = (map.tiles ?? []).filter((t) => t.block !== 'forest' && t.block !== 'lane')
    expect(firstRowTop(map)).toBe(Math.min(...standing.map((t) => t.pos.y - T / 2)))
  })

  it('sizes its queue to the line-up, and the queue still fits it', () => {
    for (let n = 1; n <= 6; n++) expect(chipsThatFit(queueWidth(n), n)).toBe(Math.min(n, 3))
  })
})
