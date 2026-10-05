import { describe, expect, it } from 'vitest'
import { RNG } from '../src/game/core/rng'
import { generateItem } from '../src/game/data/items'
import { classicHero } from '../src/game/data/sentinels'
import { autoEquipEmpty, emptySlotGain, startingKit } from '../src/game/engine/kit'
import { freshHero } from '../balance/harness'
import type { Item, Sentinel } from '../src/game/types'

const bare = (h: Sentinel): Sentinel => ({ ...h, equipment: { mainHand: null, offHand: null, body: null } })

describe('starting kit — the Quartermaster rolls', () => {
  it('deals only the extra rolls (a picked hero arrives wearing its card’s gear)', () => {
    expect(startingKit(new RNG(1))).toEqual([])
    expect(startingKit(new RNG(1), { extra: 2 })).toHaveLength(2)
  })

  it('deals only from the run’s unlocked kinds', () => {
    const kinds = ['Sword', 'Bow', 'Wand', 'Shield', 'Mail']
    for (let seed = 1; seed <= 100; seed++) {
      for (const it of startingKit(new RNG(seed), { extra: 3, kinds })) expect(kinds.some((k) => it.name.includes(k))).toBe(true)
    }
  })
})

describe('autoEquipEmpty — strict upgrades into EMPTY slots only', () => {
  it('never replaces an equipped item', () => {
    const rng = new RNG(3)
    const worn = freshHero('rogue', rng)
    for (let i = 0; i < 100; i++) {
      const item = generateItem(rng, { rarity: 'mythic' })
      const r = autoEquipEmpty([worn], [item])
      expect(r.roster[0].equipment).toEqual(worn.equipment)
      expect(r.rest).toEqual([item])
    }
  })

  it('an off-hand weapon must carry the damage the hand already deals: a wand is refused beside a sword', () => {
    const rng = new RNG(11)
    const swordHand: Sentinel = { ...classicHero('fighter'), equipment: { ...classicHero('fighter').equipment, offHand: null } }
    const wand = generateItem(rng, { kind: 'Wand', rarity: 'rare', allowCurse: false })
    const dagger = generateItem(rng, { kind: 'Dagger', rarity: 'rare', allowCurse: false })
    expect(emptySlotGain(swordHand, wand)).toBeNull()
    const r = autoEquipEmpty([swordHand], [wand, dagger])
    expect(r.roster[0].equipment.offHand?.id).toBe(dagger.id)
    expect(r.rest.map((i: Item) => i.id)).toEqual([wand.id])
  })

  it('an empty main hand takes a weapon — and the weapon makes the hero what it is', () => {
    const rng = new RNG(12)
    const wand = generateItem(rng, { kind: 'Wand', rarity: 'rare', allowCurse: false })
    const r = autoEquipEmpty([bare(classicHero('fighter'))], [wand])
    expect(r.roster[0].equipment.mainHand?.id).toBe(wand.id)
  })

  it('a two-hander needs both hands free', () => {
    const rng = new RNG(5)
    const hero = bare(classicHero('fighter'))
    const shield = generateItem(rng, { slot: 'offHand', rarity: 'common' })
    const held = { ...hero, equipment: { ...hero.equipment, offHand: shield } }
    const great = generateItem(rng, { slot: 'twoHand', rarity: 'epic', damageType: 'physical', allowCurse: false })
    expect(emptySlotGain(held, great)).toBeNull()
    expect(emptySlotGain(hero, great)?.slot).toBe('mainHand')
  })

  it('never auto-equips a keepsake or a cursed item', () => {
    const b = bare(classicHero('fighter'))
    const rng = new RNG(8)
    for (let i = 0; i < 400; i++) {
      const it = generateItem(rng, { rarity: 'legendary' })
      const cursed = it.enchantments.some((e) => e.id.startsWith('cx_'))
      if (!it.keepsake && !cursed) continue
      expect(emptySlotGain(b, it)).toBeNull()
    }
  })
})
