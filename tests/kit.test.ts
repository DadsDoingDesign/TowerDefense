import { describe, expect, it } from 'vitest'
import { RNG } from '../src/game/core/rng'
import { generateItem } from '../src/game/data/items'
import { createSentinel } from '../src/game/data/sentinels'
import { autoEquipEmpty, emptySlotGain, KIT, startingKit, wearKit } from '../src/game/engine/kit'
import { freshHero } from '../balance/harness'
import type { Archetype, Item } from '../src/game/types'

const ARCHS: Archetype[] = ['fighter', 'rogue', 'mystic']
const magic = (i: Item | null) => (i?.base.magDamage ?? 0) > 0
const phys = (i: Item | null) => (i?.base.physDamage ?? 0) > 0

describe('starting kit (one source of truth for the store and the harness)', () => {
  it('deals a weapon of the leader’s damage type, every seed', () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const a of ARCHS) {
        const [weapon] = startingKit(new RNG(seed), a)
        if (a === 'mystic') expect(magic(weapon)).toBe(true)
        else expect(phys(weapon)).toBe(true)
        expect(weapon.rarity).toBe(KIT[a][0].rarity)
        expect(weapon.enchantments.some((e) => e.id.startsWith('cx_'))).toBe(false)
      }
    }
  })

  it('is worn, not left in the pack', () => {
    const kit = startingKit(new RNG(7), 'mystic')
    const hero = wearKit(createSentinel('mystic'), kit)
    expect(hero.equipment.mainHand?.id).toBe(kit[0].id)
    expect(hero.equipment.body?.id).toBe(kit[1].id)
    expect(hero.equipment.offHand?.id).toBe(kit[2].id)
  })

  it('the harness hero wears exactly what the store would deal on the same stream', () => {
    for (const a of ARCHS) {
      const h = freshHero(a, new RNG(99))
      const kit = startingKit(new RNG(99), a)
      // Item ids come off a global counter; compare the rolls, not the ids.
      const strip = (i: Item | null) => (i ? { ...i, id: '' } : null)
      expect(strip(h.equipment.mainHand)).toEqual(strip(kit[0]))
      expect(strip(h.equipment.body)).toEqual(strip(kit[1]))
      expect(strip(h.equipment.offHand)).toEqual(strip(kit[2]))
    }
  })
})

describe('autoEquipEmpty — strict upgrades into EMPTY slots only', () => {
  it('never replaces an equipped item', () => {
    const rng = new RNG(3)
    const worn = wearKit(createSentinel('rogue'), startingKit(rng, 'rogue'))
    for (let i = 0; i < 100; i++) {
      const item = generateItem(rng, { rarity: 'mythic' })
      const r = autoEquipEmpty([worn], [item])
      expect(r.roster[0].equipment).toEqual(worn.equipment)
      expect(r.rest).toEqual([item])
    }
  })

  it('fills an empty slot with an on-type weapon, and refuses an off-type one', () => {
    const bare = createSentinel('mystic')
    const rng = new RNG(11)
    const wand = generateItem(rng, { slot: 'oneHand', rarity: 'rare', damageType: 'magic', allowCurse: false })
    const sword = generateItem(rng, { slot: 'oneHand', rarity: 'rare', damageType: 'physical', allowCurse: false })
    expect(emptySlotGain(bare, sword)).toBeNull()
    const r = autoEquipEmpty([bare], [sword, wand])
    expect(r.roster[0].equipment.mainHand?.id).toBe(wand.id)
    expect(r.rest.map((i) => i.id)).toEqual([sword.id])
  })

  it('a two-hander needs both hands free', () => {
    const rng = new RNG(5)
    const hero = { ...createSentinel('fighter') }
    const shield = generateItem(rng, { slot: 'offHand', rarity: 'common' })
    const held = { ...hero, equipment: { ...hero.equipment, offHand: shield } }
    const great = generateItem(rng, { slot: 'twoHand', rarity: 'epic', damageType: 'physical', allowCurse: false })
    expect(emptySlotGain(held, great)).toBeNull()
    expect(emptySlotGain(hero, great)?.slot).toBe('mainHand')
  })

  it('never auto-equips a keepsake or a cursed item', () => {
    const bare = createSentinel('fighter')
    const rng = new RNG(8)
    for (let i = 0; i < 400; i++) {
      const it = generateItem(rng, { rarity: 'legendary' })
      const cursed = it.enchantments.some((e) => e.id.startsWith('cx_'))
      if (!it.keepsake && !cursed) continue
      expect(emptySlotGain(bare, it)).toBeNull()
    }
  })
})
