import { describe, expect, it } from 'vitest'
import { RNG } from '../src/game/core/rng'
import {
  DUAL_WIELD_DEX,
  GENERATED_BASES,
  ITEM_BASES,
  OFF_HAND_SHARE,
  heroDamageType,
  dualWieldCheck,
  generateItem,
  gripOf,
  heroSlotsFor,
  offHandShare,
} from '../src/game/data/items'
import { LEGACY_RELIC_IDS, RELICS, relicPool } from '../src/game/data/relics'
import { classicHero } from '../src/game/data/sentinels'
import { computeCombat } from '../src/game/engine/combat'
import { autoEquipEmpty, emptySlotGain } from '../src/game/engine/kit'
import { equipFromPack, gearReturnedText, offHandAllowed, settleOffHands, wearItem } from '../src/game/run/inventory'
import { receiveItems, withRecruits } from '../src/game/run/recruits'
import { equipRules } from '../src/game/run/relics'
import { bestSlotGain, equipAndDisplace, freshHero } from '../balance/harness'
import type { Archetype, Item, ItemSlot, Sentinel } from '../src/game/types'

/** A hand-built item named by a real base noun, so its grip is the base's. */
const mk = (id: string, noun: string, slot: ItemSlot, base: Item['base'] = {}): Item => ({
  id,
  name: noun,
  slot,
  rarity: 'common',
  base,
  enchantments: [],
})
const sword = (id = 'sword', dmg = 7) => mk(id, 'Sword', 'oneHand', { physDamage: dmg, attackSpeed: 0.05 })
const axe = (id = 'axe') => mk(id, 'Axe', 'oneHand', { physDamage: 7 })
const dagger = (id = 'dagger', dmg = 6) => mk(id, 'Dagger', 'oneHand', { physDamage: dmg, attackSpeed: 0.12 })
const wand = (id = 'wand') => mk(id, 'Wand', 'oneHand', { magDamage: 6, attackSpeed: 0.06 })
const shield = (id = 'shield') => mk(id, 'Shield', 'offHand', { attackSpeed: 0.06, critChance: 0.04 })
const greatsword = (id = 'gs') => mk(id, 'Greatsword', 'twoHand', { physDamage: 11 })

/** A hero with a given OWN DEX, a sword in the main hand and nothing else. */
const withDex = (a: Archetype, dex: number, main: Item | null = sword('main', 6)): Sentinel => {
  const h = classicHero(a)
  return { ...h, stats: { ...h.stats, dex }, equipment: { mainHand: main, offHand: null, body: null } }
}

const TWIN = equipRules(['twinblade'])

describe('the off-hand item class (round 3, Q5)', () => {
  it('classifies every base the generator can name, under its own kind', () => {
    for (const [slot, nouns] of Object.entries(GENERATED_BASES) as [ItemSlot, readonly string[]][]) {
      for (const noun of nouns) {
        expect(ITEM_BASES[noun], noun).toBeDefined()
        expect(ITEM_BASES[noun].slot, noun).toBe(slot)
      }
    }
  })

  it('is the table the designer asked for: small things fit the off hand, big things never', () => {
    const grip = (n: string) => ITEM_BASES[n].grip
    // knives and wands: either hand
    expect(['Dagger', 'Wand'].map(grip)).toEqual(['either', 'either'])
    // shields, bucklers, tomes, quivers, foci: the off hand
    for (const n of ['Shield', 'Buckler', 'Tome', 'Quiver', 'Focus']) expect(grip(n)).toBe('off')
    // one-handed main-hand weapons
    for (const n of ['Sword', 'Axe', 'Rod', 'Sceptre']) expect(grip(n)).toBe('main')
    // big: two hands, never the off hand
    for (const n of ['Greatsword', 'Warhammer', 'Bow', 'Staff', 'Grimoire']) {
      expect(grip(n)).toBe('twoHand')
      const big = mk('b', n, 'twoHand')
      expect(heroSlotsFor(big, withDex('rogue', 40), TWIN)).toEqual(['mainHand'])
    }
  })

  it('reads the noun out of a real generated name, prefix and suffix included', () => {
    const rng = new RNG(7)
    let seen = 0
    for (let i = 0; i < 400; i++) {
      const it = generateItem(rng, { rarity: 'epic' })
      if (it.keepsake) continue
      const noun = Object.keys(ITEM_BASES).find((n) => new RegExp(`\\b${n}\\b`).test(it.name))
      expect(noun, it.name).toBeDefined()
      expect(gripOf(it)).toBe(ITEM_BASES[noun!].grip)
      seen++
    }
    expect(seen).toBeGreaterThan(300)
    // a keepsake whose suffix names an off-hand noun is still a body piece
    expect(gripOf(mk('k', 'Banner of Focus', 'body'))).toBe('body')
  })

  it('never lets a name move an item across kinds, and falls back to the kind', () => {
    // "Sword" on a body item is still body armour
    expect(gripOf(mk('x', 'Sword', 'body'))).toBe('body')
    // no known noun: a one-hander is main hand, an off-hand piece is off hand
    expect(gripOf(mk('x', 'second', 'oneHand'))).toBe('main')
    expect(gripOf(mk('x', 'thing', 'offHand'))).toBe('off')
    expect(gripOf(mk('x', 'thing', 'twoHand'))).toBe('twoHand')
  })

  it('without the relic, the off hand takes knives, wands and off-hand pieces only', () => {
    const hero = withDex('rogue', 99)
    expect(heroSlotsFor(dagger(), hero)).toEqual(['mainHand', 'offHand'])
    expect(heroSlotsFor(wand(), hero)).toEqual(['mainHand', 'offHand'])
    expect(heroSlotsFor(shield(), hero)).toEqual(['offHand'])
    expect(heroSlotsFor(sword(), hero)).toEqual(['mainHand'])
    expect(heroSlotsFor(axe(), hero)).toEqual(['mainHand'])
    expect(heroSlotsFor(greatsword(), hero)).toEqual(['mainHand'])
  })

  it('every archetype finds a sensible off-hand in the loot and merchant pools', () => {
    for (const a of ['fighter', 'rogue', 'mystic'] as const) {
      const rng = new RNG(100 + a.length)
      const hero = { ...withDex(a, 1, null), equipment: { mainHand: null, offHand: null, body: null } }
      let offPieces = 0
      let ownTypeLight = 0
      for (let i = 0; i < 600; i++) {
        const it = generateItem(rng, { roster: [classicHero(a)] })
        if (it.keepsake || !heroSlotsFor(it, hero).includes('offHand')) continue
        const g = gripOf(it)
        if (g === 'off') offPieces++
        if (g === 'either') {
          const dt = it.base.physDamage ? 'physical' : 'magic'
          if (dt === heroDamageType(classicHero(a))) ownTypeLight++
        }
      }
      // archetype-blind off-hand pieces for everyone…
      expect(offPieces, a).toBeGreaterThan(40)
      // …and a light weapon of the hero's own damage type (a knife for the
      // physical two, a wand for the Mystic)
      expect(ownTypeLight, a).toBeGreaterThan(20)
    }
  })
})

describe('the Twinblade Harness and its DEX check (round 3, Q4)', () => {
  it('is a rare rule relic with an object name, in the pool from the start', () => {
    const r = RELICS.find((x) => x.id === 'twinblade')!
    expect(r.name).toBe('Twinblade Harness')
    expect(r.rarity).toBe('rare')
    expect(r.kind).toBe('rule')
    expect(r.rule).toBe('twinblade')
    expect(r.desc).toContain(`${DUAL_WIELD_DEX} DEX`)
    expect(relicPool().some((x) => x.id === 'twinblade')).toBe(true)
    expect(RELICS.some((x) => x.id === 'ambidextrous')).toBe(false)
    expect(LEGACY_RELIC_IDS.ambidextrous).toBe('twinblade')
    expect(equipRules([])).toEqual({ twinblade: false })
    expect(TWIN).toEqual({ twinblade: true })
  })

  it('is a real bar: nobody starts a run on it', () => {
    for (const a of ['fighter', 'rogue', 'mystic'] as const) {
      expect(dualWieldCheck(classicHero(a), TWIN).ok, a).toBe(false)
    }
  })

  it('passes at the bar and not a point under, and never without the relic', () => {
    expect(dualWieldCheck(withDex('fighter', DUAL_WIELD_DEX - 1), TWIN)).toMatchObject({ relic: true, ok: false, dex: 13, need: 14 })
    expect(dualWieldCheck(withDex('fighter', DUAL_WIELD_DEX), TWIN).ok).toBe(true)
    expect(dualWieldCheck(withDex('fighter', 40), {}).ok).toBe(false)
  })

  it("counts the hero's own DEX, never gear", () => {
    const hero = withDex('fighter', 10)
    const precise: Item = { ...mk('b', 'Plate', 'body'), enchantments: [{ id: 'precision', label: 'of Precision', stats: { dex: 20 } }] }
    const geared = { ...hero, equipment: { ...hero.equipment, body: precise } }
    expect(dualWieldCheck(geared, TWIN).ok).toBe(false)
  })

  it('opens the off hand to a main-hand one-hander — and only that — for a hero who passes', () => {
    const pass = withDex('rogue', DUAL_WIELD_DEX)
    const fail = withDex('mystic', DUAL_WIELD_DEX - 1)
    expect(heroSlotsFor(sword(), pass, TWIN)).toEqual(['mainHand', 'offHand'])
    expect(heroSlotsFor(axe(), pass, TWIN)).toEqual(['mainHand', 'offHand'])
    expect(heroSlotsFor(sword(), fail, TWIN)).toEqual(['mainHand'])
    expect(heroSlotsFor(sword(), null, TWIN)).toEqual(['mainHand'])
    // nothing else moves
    for (const it of [dagger(), wand(), shield(), greatsword(), mk('p', 'Plate', 'body')]) {
      expect(heroSlotsFor(it, pass, TWIN)).toEqual(heroSlotsFor(it, pass))
    }
  })
})

describe('what an off-hand weapon is worth (combat.gearOf)', () => {
  it('a knife or wand in the off hand counts at OFF_HAND_SHARE; in the main hand in full', () => {
    expect(OFF_HAND_SHARE).toBe(0.5)
    expect(offHandShare(dagger())).toBe(0.5)
    expect(offHandShare(wand())).toBe(0.5)
    expect(offHandShare(sword())).toBe(1)
    expect(offHandShare(shield())).toBe(1)
    const hero = withDex('fighter', 6, sword('main', 6))
    const withOff = { ...hero, equipment: { ...hero.equipment, offHand: dagger('d', 8) } }
    const asMain = { ...hero, equipment: { ...hero.equipment, mainHand: mk('m', 'Sword', 'oneHand', { physDamage: 6 + 4, attackSpeed: 0.05 + 0.06 }) } }
    // 6 + 8×½ flat, 0.05 + 0.12×½ speed == one sword of 10 and 0.11
    expect(computeCombat(withOff).damage).toBeCloseTo(computeCombat(asMain).damage, 6)
    expect(computeCombat(withOff).rate).toBeCloseTo(computeCombat(asMain).rate, 6)
  })

  it("a Twinblade wielder's off-hand sword counts at 100%, as the relic card says", () => {
    const hero = withDex('rogue', DUAL_WIELD_DEX, sword('main', 6))
    const dual = { ...hero, equipment: { ...hero.equipment, offHand: sword('second', 7) } }
    const one = { ...hero, equipment: { ...hero.equipment, mainHand: mk('m', 'Sword', 'oneHand', { physDamage: 13, attackSpeed: 0.1 }) } }
    expect(computeCombat(dual).damage).toBeCloseTo(computeCombat(one).damage, 6)
    expect(computeCombat(dual).rate).toBeCloseTo(computeCombat(one).rate, 6)
  })

  it("an off-hand knife's affixes count in full", () => {
    const hero = withDex('fighter', 6, null)
    const heavy: Item = { ...dagger('h'), base: {}, enchantments: [{ id: 'heavy', label: 'Heavy', mods: { damageMult: 1.2 } }] }
    const off = computeCombat({ ...hero, equipment: { ...hero.equipment, offHand: heavy } }).damage
    const main = computeCombat({ ...hero, equipment: { ...hero.equipment, mainHand: heavy } }).damage
    expect(off).toBeCloseTo(main, 6)
  })
})

describe('every equip path respects the off-hand rule', () => {
  it('the pack (equipFromPack): knives and shields yes, a sword only with the relic and the DEX', () => {
    const low = withDex('fighter', 6)
    const high = withDex('rogue', DUAL_WIELD_DEX)
    const pack = [dagger(), shield(), sword('s2'), greatsword()]
    expect(equipFromPack([low], pack, low.id, 'offHand', 'dagger')!.roster[0].equipment.offHand?.id).toBe('dagger')
    expect(equipFromPack([low], pack, low.id, 'offHand', 'shield')!.roster[0].equipment.offHand?.id).toBe('shield')
    expect(equipFromPack([low], pack, low.id, 'offHand', 's2')).toBeNull()
    expect(equipFromPack([low], pack, low.id, 'offHand', 's2', TWIN)).toBeNull()
    expect(equipFromPack([high], pack, high.id, 'offHand', 's2')).toBeNull()
    const got = equipFromPack([high], pack, high.id, 'offHand', 's2', TWIN)!
    expect(got.roster[0].equipment.offHand?.id).toBe('s2')
    expect(got.roster[0].equipment.mainHand?.id).toBe('main')
    expect(equipFromPack([high], pack, high.id, 'offHand', 'gs', TWIN)).toBeNull()
    // an unknown hero is refused, not equipped on nobody
    expect(equipFromPack([high], pack, 'nobody', 'mainHand', 'dagger')).toBeNull()
  })

  it('the two-hand rules live in one place (wearItem)', () => {
    const hero = { ...withDex('fighter', 6), equipment: { mainHand: sword('m'), offHand: shield('o'), body: null } }
    const two = wearItem(hero.equipment, greatsword(), 'mainHand')
    expect(two.equipment).toMatchObject({ mainHand: { id: 'gs' }, offHand: null })
    expect(two.displaced.map((i) => i.id)).toEqual(['m', 'o'])
    const back = wearItem(two.equipment, dagger('k'), 'offHand')
    expect(back.equipment).toMatchObject({ mainHand: null, offHand: { id: 'k' } })
    expect(back.displaced.map((i) => i.id)).toEqual(['gs'])
  })

  it('auto-equip on a drop (receiveItems): a knife lands in an empty off hand; a sword only for a Twinblade wielder', () => {
    const low = withDex('fighter', 6)
    const high = withDex('rogue', DUAL_WIELD_DEX)
    expect(receiveItems([low], [], [dagger('drop')]).roster[0].equipment.offHand?.id).toBe('drop')
    expect(receiveItems([low], [], [sword('drop')]).roster[0].equipment.offHand).toBeNull()
    expect(receiveItems([low], [], [sword('drop')], ['twinblade']).roster[0].equipment.offHand).toBeNull()
    expect(receiveItems([high], [], [sword('drop')]).roster[0].equipment.offHand).toBeNull()
    expect(receiveItems([high], [], [sword('drop')], ['twinblade']).roster[0].equipment.offHand?.id).toBe('drop')
    // a two-hander never takes an off hand, relic or not
    expect(emptySlotGain(high, greatsword(), TWIN)).toBeNull()
  })

  it('a hire dressing from the pack (withRecruits) obeys it per hire', () => {
    const lead = withDex('fighter', 6)
    const lowHire = withDex('mystic', 5, mk('rod', 'Rod', 'oneHand', { magDamage: 6 }))
    const out = withRecruits([lead], [lowHire], [mk('rod2', 'Rod', 'oneHand', { magDamage: 9 })], ['twinblade'])
    expect(out.roster[1].equipment.offHand).toBeNull()
    expect(out.inventory.map((i) => i.id)).toEqual(['rod2'])
    const highHire = withDex('mystic', DUAL_WIELD_DEX, mk('rod', 'Rod', 'oneHand', { magDamage: 6 }))
    const out2 = withRecruits([lead], [highHire], [mk('rod2', 'Rod', 'oneHand', { magDamage: 9 })], ['twinblade'])
    expect(out2.roster[1].equipment.offHand?.id).toBe('rod2')
  })

  it("the opening kit: the off-hand piece is an off-hand item, and it is worn there", () => {
    for (const a of ['fighter', 'rogue', 'mystic'] as const) {
      const hero = freshHero(a, new RNG(3))
      expect(gripOf(hero.equipment.offHand!)).toBe('off')
      expect(offHandAllowed(hero)).toBe(true)
    }
  })

  it('auto-equip across a roster puts a sword in the Twinblade wielder, not the first hero', () => {
    const low = withDex('fighter', 6)
    const high = withDex('rogue', DUAL_WIELD_DEX)
    const r = autoEquipEmpty([low, high], [sword('drop', 9)], TWIN)
    expect(r.placed).toEqual([{ itemId: 'drop', sentinelId: high.id, slot: 'offHand' }])
  })

  it('the balance model (bestSlotGain / equipAndDisplace) reads the same rule', () => {
    const low = withDex('fighter', 6)
    const high = withDex('rogue', DUAL_WIELD_DEX)
    // a second sword is worth nothing to a hero who cannot carry it off-hand
    // (it could only replace the main-hand sword it equals)…
    expect(equipAndDisplace(low, sword('s2', 6), TWIN).hero.equipment.offHand).toBeNull()
    // …and a real second weapon to one who can
    expect(equipAndDisplace(high, sword('s2', 6), TWIN).hero.equipment.offHand?.id).toBe('s2')
    expect(bestSlotGain(high, sword('s2', 6), TWIN)).toBeGreaterThan(0)
    // a two-hander goes in the main hand and empties the off hand
    const dressed = { ...high, equipment: { ...high.equipment, offHand: shield() } }
    const r = equipAndDisplace(dressed, mk('gs', 'Greatsword', 'twoHand', { physDamage: 60 }), TWIN)
    expect(r.hero.equipment.mainHand?.id).toBe('gs')
    expect(r.hero.equipment.offHand).toBeNull()
    expect(r.displaced.map((i) => i.id).sort()).toEqual(['main', 'shield'])
  })
})

describe('legacy saves: an off hand the rule no longer allows (settleOffHands)', () => {
  const wearing = (h: Sentinel, off: Item): Sentinel => ({ ...h, equipment: { ...h.equipment, offHand: off } })

  it('moves a sword to the pack without the relic, keeps knives and shields, destroys nothing', () => {
    const a = wearing(withDex('fighter', 6), sword('s'))
    const b = wearing(withDex('rogue', 12), dagger('k'))
    const c = wearing(withDex('mystic', 5), shield('sh'))
    const pack = [wand('w')]
    const out = settleOffHands([a, b, c], pack)
    expect(out.moved).toEqual([{ hero: a.name, item: 'Sword' }])
    expect(out.roster[0].equipment.offHand).toBeNull()
    expect(out.roster[0].equipment.mainHand?.id).toBe('main')
    expect(out.roster[1].equipment.offHand?.id).toBe('k')
    expect(out.roster[2].equipment.offHand?.id).toBe('sh')
    expect(out.inventory.map((i) => i.id)).toEqual(['w', 's'])
  })

  it('keeps a Twinblade wielder’s sword, moves one a hero is short of the DEX for', () => {
    const pass = wearing(withDex('rogue', DUAL_WIELD_DEX), sword('s1'))
    const fail = wearing(withDex('fighter', 9), sword('s2'))
    const out = settleOffHands([pass, fail], [], TWIN)
    expect(out.roster[0].equipment.offHand?.id).toBe('s1')
    expect(out.roster[1].equipment.offHand).toBeNull()
    expect(out.inventory.map((i) => i.id)).toEqual(['s2'])
  })

  it('moves a two-hander out of the off hand whatever the relics', () => {
    const out = settleOffHands([wearing(withDex('rogue', 40), greatsword())], [], TWIN)
    expect(out.roster[0].equipment.offHand).toBeNull()
    expect(out.inventory).toHaveLength(1)
  })

  it('is idempotent and returns the same arrays when nothing moves', () => {
    const roster = [wearing(withDex('rogue', 12), dagger())]
    const inv: Item[] = []
    const out = settleOffHands(roster, inv)
    expect(out.roster).toBe(roster)
    expect(out.inventory).toBe(inv)
    expect(out.moved).toEqual([])
    const once = settleOffHands([wearing(withDex('fighter', 6), sword())], [])
    const twice = settleOffHands(once.roster, once.inventory)
    expect(twice.moved).toEqual([])
    expect(twice.roster).toBe(once.roster)
  })

  it('says what moved in one line', () => {
    expect(gearReturnedText([{ hero: 'Doyle', item: 'Heavy Sword' }])).toMatch(/^Doyle's Heavy Sword is back in the pack — /)
    expect(gearReturnedText([{ hero: 'A', item: 'x' }, { hero: 'B', item: 'y' }])).toMatch(/^2 off-hand items are back in the pack/)
  })
})
