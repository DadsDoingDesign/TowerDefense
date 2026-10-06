import { describe, expect, it } from 'vitest'
import { idCounterState, RNG, streamRng } from '../src/game/core/rng'
import { FIRST_MAP, legacyPosts } from '../src/game/data/maps'
import { classicHero, nameCounterState, plainItem } from '../src/game/data/sentinels'
import { heroDoes, kitName, lookOf } from '../src/game/data/gear'
import { generateItem, heroStyle, ITEM_BASES, itemNoun } from '../src/game/data/items'
import { ALL_ITEM_KINDS, BASIC_ITEM_KINDS, ITEM_KINDS, itemPoolFor, UNLOCK_ITEM_KINDS } from '../src/game/data/itemKinds'
import { STARTER_SKILLS } from '../src/game/data/skills'
import { computeCombat, UNARMED } from '../src/game/engine/combat'
import { applyXp, xpToReach } from '../src/game/engine/leveling'
import { GameEngine, TICK } from '../src/game/engine/engine'
import { generateEncounter } from '../src/game/data/waves'
import { chosenHero, heroChoices, pickRarity, previewOf, resolvePick, rollRecruitBody } from '../src/game/run/heroes'
import { rollFromPool, rollItemUnlock, rollUnlock } from '../src/game/run/watch'
import { dealItems, migrateMeta } from '../src/state/metaStore'
import type { EffectMods, Item, Sentinel, WaveDef } from '../src/game/types'

const P = legacyPosts(FIRST_MAP.id)
const ALL_SKILL_POOL = STARTER_SKILLS
const nounOf = (i: Item | null) => (i ? itemNoun(i) : null)

describe('a hero is its gear: the role table', () => {
  const hero = (main: string | null, off: string | null = null): Sentinel => ({
    ...classicHero('rogue'),
    equipment: {
      mainHand: main ? plainItem('m', main, ITEM_BASES[main].slot) : null,
      offHand: off ? plainItem('o', off, ITEM_BASES[off].slot) : null,
      body: null,
    },
  })

  it('swords, axes, greatswords and warhammers swing; bows and daggers shoot; wands, rods, sceptres, staves and grimoires cast', () => {
    for (const k of ['Sword', 'Axe', 'Greatsword', 'Warhammer']) expect(heroStyle(hero(k))).toBe('swing')
    for (const k of ['Bow', 'Dagger']) expect(heroStyle(hero(k))).toBe('shoot')
    for (const k of ['Wand', 'Rod', 'Sceptre', 'Staff', 'Grimoire']) expect(heroStyle(hero(k))).toBe('cast')
    expect(heroStyle(hero(null))).toBeNull()
    // A light weapon in the off hand of an empty main hand counts as the hand.
    expect(heroStyle(hero(null, 'Wand'))).toBe('cast')
  })

  it('the style picks the attack: casting is magic and bursts, shooting reaches far, swinging is up close', () => {
    const cast = computeCombat(hero('Wand'))
    const shoot = computeCombat(hero('Bow'))
    const swing = computeCombat(hero('Sword'))
    expect(cast.damageType).toBe('magic')
    expect(cast.splashRadius).toBeGreaterThan(0)
    expect(shoot.range).toBeGreaterThan(swing.range)
    expect(swing.damageType).toBe('physical')
    expect(computeCombat(hero(null)).range).toBe(UNARMED.range)
  })

  it('the look comes from the weapon: armoured, hooded, robed', () => {
    expect(lookOf(hero('Axe'))).toBe('fighter')
    expect(lookOf(hero('Dagger'))).toBe('rogue')
    expect(lookOf(hero('Staff'))).toBe('mystic')
    // A Rogue-statted hero holding a sword is drawn armoured, not with a bow.
    expect(lookOf({ ...classicHero('rogue'), equipment: hero('Sword').equipment })).toBe('fighter')
    expect(lookOf(hero(null, 'Shield'))).toBe('fighter')
  })

  it('says what the gear does, and only that', () => {
    expect(heroDoes(hero('Sword', 'Shield'))).toBe('Swings a sword up close · holds 2 enemies with its shield')
    expect(heroDoes(hero('Sword', 'Buckler'))).toBe('Swings a sword up close · holds 1 enemy with its buckler')
    expect(heroDoes(hero('Bow'))).toBe('Shoots a bow from far away')
    expect(heroDoes(hero('Dagger', 'Pavise'))).toBe('Throws daggers from far away · holds 3 enemies with its pavise')
    expect(heroDoes(hero('Wand', 'Tome'))).toBe('Casts magic from a wand at a group')
    expect(heroDoes(hero(null))).toBe('Throws stones')
    expect(kitName(hero('Sword', 'Shield'))).toBe('Sword & Shield')
  })

  it('a level grows what the weapon-hand uses', () => {
    const grow = (main: string) => {
      const h = hero(main)
      const up = applyXp(h, xpToReach(2))
      return { str: up.stats.str - h.stats.str, dex: up.stats.dex - h.stats.dex, int: up.stats.int - h.stats.int }
    }
    expect(grow('Sword')).toEqual({ str: 2, dex: 1, int: 0 })
    expect(grow('Bow')).toEqual({ str: 1, dex: 2, int: 0 })
    expect(grow('Wand')).toEqual({ str: 0, dex: 1, int: 2 })
  })

  it('a classic hero rebuilt from gear fights exactly as its old class: the Fighter holds 2 with 8 thorns', () => {
    const f = computeCombat(classicHero('fighter'))
    expect(f.mods.block).toEqual({ count: 2, radius: 72 })
    expect(f.thorns).toBe(8)
    expect(computeCombat(classicHero('rogue')).mods.block).toBeUndefined()
  })
})

describe('item kinds and pools', () => {
  it('every kind the collection lists is a generated base; the basic five are a sword, a bow, a wand, a shield and mail', () => {
    for (const k of ITEM_KINDS) expect(ITEM_BASES[k.id]?.slot).toBe(k.slot)
    expect([...BASIC_ITEM_KINDS].sort()).toEqual(['Bow', 'Mail', 'Shield', 'Sword', 'Wand'])
    expect(UNLOCK_ITEM_KINDS.length + BASIC_ITEM_KINDS.length).toBe(ALL_ITEM_KINDS.length)
  })

  it('loot deals only unlocked kinds, one draw per pick — a forced kind takes the same draws', () => {
    const pool = itemPoolFor(['Axe'])
    const rng = new RNG(4)
    for (let i = 0; i < 400; i++) expect(pool).toContain(itemNoun(generateItem(rng, { kinds: pool })))
    const a = new RNG(9)
    const b = new RNG(9)
    generateItem(a, { slot: 'offHand', rarity: 'rare' })
    generateItem(b, { kind: 'Shield', rarity: 'rare' })
    expect(a.next()).toBe(b.next())
  })

  it('every Watch level and card-paying win can deal an item kind; the roll is generic and pure', () => {
    expect(rollItemUnlock([], 'level', 1, 1)).toBe(rollItemUnlock([], 'level', 1, 1))
    expect(rollItemUnlock(UNLOCK_ITEM_KINDS, 'x')).toBeNull()
    const all = dealItems([], 99, 'test')
    expect(new Set(all).size).toBe(UNLOCK_ITEM_KINDS.length)
    // Pluggable: narrow the pool or the tier without touching the roll.
    expect(rollFromPool({ pool: ['a', 'b', 'c'], have: ['a'], filter: (id) => id !== 'b', salt: ['t'] })).toBe('c')
    expect(rollFromPool({ pool: ['a', 'b'], have: [], tierOf: (id) => (id === 'a' ? 1 : 3), minTier: 2, salt: ['t'] })).toBe('b')
    // The skill roll still hashes as SK1's did.
    expect(rollUnlock([], 'level', 3, 2)).toBe(rollUnlock([], 'level', 3, 2))
  })

  it('an old meta save keeps its skill cards and is granted one item kind per Watch level past the first (v7)', () => {
    const v6 = { watchXp: 700, skills: ['charge'], stats: { runsCompleted: 6 } }
    const m = migrateMeta(v6, 6)
    expect(m.skills).toEqual(['charge'])
    expect(m.items.length).toBe(5) // 700 XP is Watch level 6
    for (const k of m.items) expect(UNLOCK_ITEM_KINDS).toContain(k)
    // A current save is left alone (no grant on every boot), and junk is dropped.
    expect(migrateMeta({ ...v6, items: ['Axe', 'Axe', 'Nope'] }, 7).items).toEqual(['Axe'])
    expect(migrateMeta({ watchXp: 0 }, 6).items).toEqual([])
  })
})

describe('the hero pick: three random heroes', () => {
  it('is a pure function of the seed and the pools, and previewing mints nothing', () => {
    const ids = idCounterState()
    const names = nameCounterState()
    const a = heroChoices(77, ALL_SKILL_POOL, BASIC_ITEM_KINDS)
    expect(heroChoices(77, ALL_SKILL_POOL, BASIC_ITEM_KINDS)).toEqual(a)
    expect(idCounterState()).toBe(ids)
    expect(nameCounterState()).toEqual(names)
    expect(a).toHaveLength(3)
    expect(new Set(a.map((c) => c.name)).size).toBe(3)
    expect(new Set(a.map((c) => c.skill)).size).toBe(3)
  })

  it('from the basic five (a first run, the Daily) deals a sword-hand, a bow-hand and a wand-hand, every seed', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const looks = heroChoices(seed, ALL_SKILL_POOL, BASIC_ITEM_KINDS).map((c) => lookOf(previewOf(c))).sort()
      expect(looks).toEqual(['fighter', 'mystic', 'rogue'])
    }
  })

  it('deals only unlocked kinds, at the pick rarities, never a curse; a two-hander leaves the off hand empty', () => {
    const pool = itemPoolFor(UNLOCK_ITEM_KINDS)
    let offs = 0
    for (let seed = 1; seed <= 150; seed++) {
      for (const c of heroChoices(seed, ALL_SKILL_POOL, pool)) {
        for (const piece of ['mainHand', 'offHand', 'body'] as const) {
          const it = c.equipment[piece]
          if (!it) continue
          expect(pool).toContain(itemNoun(it))
          expect(it.rarity).toBe(pickRarity(itemNoun(it)!, piece))
          expect(it.enchantments.some((e) => e.id.startsWith('cx_'))).toBe(false)
        }
        if (c.equipment.mainHand?.slot === 'twoHand') expect(c.equipment.offHand).toBeNull()
        if (c.equipment.offHand) offs++
      }
    }
    expect(offs).toBeGreaterThan(50)
  })

  it('the chosen hero is exactly the card: name, stats, gear and skill (fresh ids)', () => {
    const seed = 4242
    const card = heroChoices(seed, ALL_SKILL_POOL, BASIC_ITEM_KINDS)[1]
    const h = chosenHero(seed, ALL_SKILL_POOL, BASIC_ITEM_KINDS, 'pick-1', 2)!
    expect(h.name).toBe(card.name)
    expect(h.stats).toEqual({ str: card.stats.str + 2, dex: card.stats.dex + 2, int: card.stats.int + 2 })
    expect(h.skills).toEqual([card.skill])
    for (const piece of ['mainHand', 'offHand', 'body'] as const) expect(nounOf(h.equipment[piece])).toBe(nounOf(card.equipment[piece]))
    expect(chosenHero(seed, ALL_SKILL_POOL, BASIC_ITEM_KINDS, 'pick-9')).toBeNull()
    // The look-name shim (dev handles, scripts) names the dealt hero drawn that way.
    expect(lookOf(chosenHero(seed, ALL_SKILL_POOL, BASIC_ITEM_KINDS, resolvePick(seed, ALL_SKILL_POOL, BASIC_ITEM_KINDS, 'mystic'))!)).toBe('mystic')
  })

  it('base stats are modest rolls around what the weapon-hand trained', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const c of heroChoices(seed, ALL_SKILL_POOL, BASIC_ITEM_KINDS)) {
        const h = previewOf(c)
        const ref = classicHero(lookOf(h)).stats
        for (const k of ['str', 'dex', 'int'] as const) expect(Math.abs(h.stats[k] - ref[k])).toBeLessThanOrEqual(1)
      }
    }
  })

  it('a hire is a random hero from the run’s kinds, armed: a common weapon, maybe an off hand, no body', () => {
    const rng = streamRng(5, 'loot')
    for (let i = 0; i < 60; i++) {
      const h = rollRecruitBody(rng, BASIC_ITEM_KINDS)
      expect(BASIC_ITEM_KINDS).toContain(nounOf(h.equipment.mainHand))
      expect(h.equipment.mainHand?.rarity).toBe('common')
      expect(h.equipment.body).toBeNull()
    }
  })
})

describe('the combo skills, in the engine', () => {
  const run = (team: Sentinel[], wave: WaveDef, baseHp = 60) => {
    const posts = [P.s3, P.s2, P.s4]
    const e = new GameEngine({ map: FIRST_MAP, wave, placedSentinels: team.map((sentinel, i) => ({ sentinel, slotId: posts[i] })), baseHp, maxBaseHp: baseHp, seed: 5 })
    for (let i = 0; i < 60 * 240 && e.status === 'running'; i++) e.step(TICK)
    return e
  }
  const withMods = (s: Sentinel, mods: EffectMods): Sentinel => ({ ...s, mutations: [{ id: 'm', key: 'test', name: 'test', desc: '', rarity: 'mythic', downside: '', mods }] })
  const wave = () => generateEncounter(2, 'normal', { subWaves: false })
  /**
   * One goblin nobody here can kill: no overkill and no deaths, so both runs
   * fire the same shots at the same moments and "more damage" is exactly the
   * skill's share.
   */
  const tough = (): WaveDef => ({ index: 1, label: 't', isBoss: false, spawns: [{ typeId: 'torch1', at: 0, hpMult: 5000 }] })

  it('Bounty: each kill pays more gold', () => {
    const r = classicHero('rogue')
    const a = run([r], wave())
    const b = run([{ ...r, skills: ['bounty'] }], wave())
    expect(b.goldEarned - a.goldEarned).toBe(3 * b.sentinels[0].kills)
  })

  it('Pin Down and Cold Snap: hits land harder on held and on slowed enemies — and do nothing alone', () => {
    const fighter = withMods(classicHero('fighter'), { thornsMult: 0 })
    const lone = classicHero('rogue')
    const dealt = (e: GameEngine, i = 0) => e.sentinels[i].damageDealt
    expect(dealt(run([{ ...fighter, skills: ['pin_down'] }], tough()))).toBeGreaterThan(dealt(run([fighter], tough())))
    const frosty = withMods(lone, { chill: { slow: 0.3, dur: 2 } })
    expect(dealt(run([{ ...frosty, skills: ['cold_snap'] }], tough()))).toBeGreaterThan(dealt(run([frosty], tough())))
    expect(dealt(run([{ ...lone, skills: ['cold_snap'] }], tough()))).toBeCloseTo(dealt(run([lone], tough())), 6)
  })

  it('Firebrand: thorns set what it holds burning; Momentum: it fires faster while holding', () => {
    const f = classicHero('fighter')
    const burnt = run([withMods(f, { thornsBurn: { dps: 30, dur: 3 } })], tough())
    expect(burnt.sentinels[0].damageDealt).toBeGreaterThan(run([f], tough()).sentinels[0].damageDealt)
    expect(run([withMods(f, { rushPerHeld: 1 })], tough()).sentinels[0].shots).toBeGreaterThan(run([f], tough()).sentinels[0].shots)
  })

  it('Last Rites: every Nth kill mends the Gate, never past full', () => {
    const r = classicHero('rogue')
    const leaky: WaveDef = { index: 1, label: 't', isBoss: false, spawns: Array.from({ length: 30 }, (_, i) => ({ typeId: 'torch1', at: i * 0.25, hpMult: 1 })) }
    const a = run([r], leaky, 30)
    const b = run([withMods(r, { killMend: { every: 2, hp: 1 } })], leaky, 30)
    expect(b.baseHp).toBeGreaterThanOrEqual(a.baseHp)
    expect(b.baseHp).toBeLessThanOrEqual(30)
  })
})
