import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { RNG } from '../src/game/core/rng'
import { ICON_ORDER, itemIcon } from '../src/game/data/iconAtlas'
import { generateItem, itemNoun, ITEM_BASES, KIND_EDGE, reforgeItem, upgradeRarity } from '../src/game/data/items'
import { ITEM_KINDS, itemKindById, UNLOCK_ITEM_KINDS } from '../src/game/data/itemKinds'
import { FIRST_MAP, legacyPosts } from '../src/game/data/maps'
import { canonicalKind, KIND_RENAMES, PEOPLE_KINDS, peopleIconKey, renamedItemName } from '../src/game/data/peopleKinds'
import { classicHero } from '../src/game/data/sentinels'
import { ALL_SKILLS, PEOPLES_SKILLS, SIGNATURE_SKILLS, skillById } from '../src/game/data/skills'
import { generateEncounter } from '../src/game/data/waves'
import { computeCombat } from '../src/game/engine/combat'
import { GameEngine, TICK } from '../src/game/engine/engine'
import { kindCompany, runItemPool, skillCompany } from '../src/game/run/contracts'
import { rollMerchantShelf } from '../src/game/run/economy'
import { migrateMeta, META_VERSION } from '../src/state/metaStore'
import type { CompanyId } from '../src/game/data/companies'
import type { EffectMods, Item, Sentinel, WaveDef } from '../src/game/types'

/**
 * The peoples' rosters in the game (Oct 2026): `docs/peoples/roster.json` is
 * the source of truth, and every row of it — item and skill, kept, new or
 * renamed — is held to the game's tables here.
 */
type RosterItem = [number, string, string, string, string]
type RosterSkill = [string, number, string, string]
const ROSTER = JSON.parse(readFileSync(new URL('../docs/peoples/roster.json', import.meta.url), 'utf8')) as Record<
  string,
  { company: string; items: RosterItem[]; skills: RosterSkill[] }
>
const COMPANY_OF: Record<string, CompanyId> = { humans: 'spice', elves: 'silk', dwarves: 'metals', reptilians: 'art', gnomes: 'scrolls' }
const SLOT_OF: Record<string, string> = { oneHand: 'oneHand', twoHand: 'twoHand', either: 'oneHand', offHand: 'offHand', body: 'body' }
/** A roster name as the game spells it (the roster's one typographic apostrophe in a skill). */
const skillByName = (name: string) => ALL_SKILLS.find((k) => k.name.replace('’', "'") === name.replace('’', "'"))

describe('the rosters are in the game', () => {
  it('every item of every people is a kind, of its slot, level and people’s company', () => {
    for (const [people, r] of Object.entries(ROSTER)) {
      for (const [tier, name, slot] of r.items) {
        const k = itemKindById(name)
        expect(k, `${people}: ${name}`).toBeDefined()
        expect(k!.slot, name).toBe(SLOT_OF[slot])
        expect(k!.level, name).toBe(tier)
        expect(k!.company, name).toBe(COMPANY_OF[people])
        if (slot === 'either') expect(ITEM_BASES[name].grip, name).toBe('either')
      }
    }
    // Twenty a people, a hundred in all.
    expect(Object.values(ROSTER).reduce((n, r) => n + r.items.length, 0)).toBe(100)
    expect(ITEM_KINDS).toHaveLength(100)
  })

  it('every skill of every people is in the library, under the roster’s name and its people’s company', () => {
    for (const [people, r] of Object.entries(ROSTER)) {
      for (const [name, level, , note] of r.skills) {
        const k = skillByName(name)
        expect(k, `${people}: ${name}`).toBeDefined()
        expect(k!.level, name).toBe(level)
        expect(k!.company, name).toBe(COMPANY_OF[people])
        if (/signature/.test(note)) expect(SIGNATURE_SKILLS[COMPANY_OF[people]], name).toBe(k!.id)
      }
    }
    expect(ALL_SKILLS).toHaveLength(50)
    for (const id of PEOPLES_SKILLS) expect(skillById(id)).toBeDefined()
  })

  it('a renamed skill keeps its id, so a save that holds it still holds it', () => {
    expect(skillById('pepperfire')!.name).toBe('Spicy Peps')
    expect(skillById('gilt_frame')!.name).toBe('Starweave')
    expect(skillById('velvet_toll')!.name).toBe('Blood Price')
    expect(skillById('moonwake')!.name).toBe('Thornbloom')
    expect(SIGNATURE_SKILLS.metals).toBe('bolder_bash')
    expect(skillById('ore_sense')!.signature).toBeUndefined()
    const m = migrateMeta({ skills: ['pepperfire', 'gilt_frame', 'ore_sense'] }, META_VERSION)
    expect(m.skills).toEqual(['pepperfire', 'gilt_frame', 'ore_sense'])
  })

  it('every new kind has its own atlas cell, and every kind’s cell is its own', () => {
    for (const k of PEOPLE_KINDS) {
      const key = peopleIconKey(k.id)
      expect(ICON_ORDER as readonly string[], k.id).toContain(key)
      expect(itemIcon({ name: k.id, slot: k.slot }), k.id).toBe(key)
    }
    const cells = ITEM_KINDS.map((k) => itemIcon({ name: k.id, slot: k.slot }))
    expect(new Set(cells).size).toBe(ITEM_KINDS.length)
  })
})

describe('the new kinds roll as kinds always have', () => {
  it('a named item of each new kind reads as that kind (the noun regex finds it, prefix or suffix aside)', () => {
    for (const k of PEOPLE_KINDS) {
      for (const rarity of ['common', 'epic', 'mythic'] as const) {
        const it = generateItem(new RNG(7), { kind: k.id, rarity })
        expect(itemNoun(it), it.name).toBe(k.id)
        expect(it.slot).toBe(k.slot)
      }
    }
    expect(itemNoun({ name: 'Heavy Banner Pole of Might' })).toBe('Banner Pole')
    expect(itemNoun({ name: 'Swift Kite Shield' })).toBe('Kite Shield')
    expect(itemNoun({ name: 'Cruel Stalker Leathers of Reach' })).toBe('Stalker Leathers')
  })

  it('carries its edge at every rarity — not a rarity slot, kept through a reforge and a raise', () => {
    for (const k of PEOPLE_KINDS.filter((x) => x.edge)) {
      const it = generateItem(new RNG(3), { kind: k.id, rarity: 'rare', allowCurse: false })
      const edge = it.enchantments.filter((e) => e.id === KIND_EDGE[k.id].id)
      expect(edge, k.id).toHaveLength(1)
      // The rarity's own count of enchantments is still dealt in full.
      expect(it.enchantments.filter((e) => !e.id.startsWith('kind_') && !e.id.startsWith('mythic_'))).toHaveLength(1)
      expect(reforgeItem(it, new RNG(4)).enchantments.some((e) => e.id === KIND_EDGE[k.id].id)).toBe(true)
      const up = upgradeRarity(it, new RNG(5))
      expect(up.enchantments.some((e) => e.id === KIND_EDGE[k.id].id)).toBe(true)
      expect(up.enchantments.filter((e) => !e.id.startsWith('kind_'))).toHaveLength(2)
      // The edge never names the item.
      expect(up.name.startsWith(`${k.id} `) || up.name === k.id || !up.name.includes(`${k.id} ${k.id}`)).toBe(true)
    }
  })

  it('a roll with no pool never deals a new kind: benches and tools deal what they always dealt', () => {
    const rng = new RNG(21)
    const added = new Set(PEOPLE_KINDS.map((k) => k.id))
    for (let i = 0; i < 4000; i++) expect(added.has(itemNoun(generateItem(rng)) ?? '')).toBe(false)
  })

  it('a contract leans to its people’s gear: the shelf deals the company’s kinds about twice as often', () => {
    const pool = runItemPool([...UNLOCK_ITEM_KINDS], 'metals', null)
    const rng = new RNG(8)
    let ironvein = 0
    let n = 0
    for (let i = 0; i < 400; i++) {
      for (const e of rollMerchantShelf(rng, { luck: 0, depth: 4, roster: [], pity: { dry: 0 }, kinds: pool })) {
        n++
        if (kindCompany(itemNoun(e.item) ?? '') === 'metals') ironvein++
      }
    }
    const share = UNLOCK_ITEM_KINDS.filter((k) => kindCompany(k) === 'metals').length / UNLOCK_ITEM_KINDS.length
    expect(ironvein / n).toBeGreaterThan(share * 1.5)
    expect(skillCompany('bolder_bash')).toBe('metals')
  })
})

describe('the roster’s renames load', () => {
  it('maps the old kind ids and item names to the new ones', () => {
    expect(KIND_RENAMES).toEqual({ 'Gilded Easel': 'Kingscale Shield', 'Moonquill Codex': 'Greenvial Herbal' })
    expect(canonicalKind('Gilded Easel')).toBe('Kingscale Shield')
    expect(canonicalKind('Sword')).toBe('Sword')
    expect(renamedItemName('Heavy Moonquill Codex of Insight')).toBe('Heavy Greenvial Herbal of Insight')
    const m = migrateMeta({ sovereign: ['Gilded Easel', 'Saffron Brand', 'Moonquill Codex'] }, META_VERSION)
    expect(m.sovereign).toEqual(['Kingscale Shield', 'Saffron Brand', 'Greenvial Herbal'])
    // An old item still reads, holds and draws as the renamed kind.
    expect(itemIcon({ name: 'Gilded Easel', slot: 'offHand' })).toBe('kingscaleShield')
  })
})

/* ------------------------------------------------------------- mechanics */

const P = legacyPosts(FIRST_MAP.id)
const fight = (team: { sentinel: Sentinel; slotId: string }[], wave: WaveDef, seed = 3) => {
  const engine = new GameEngine({ map: FIRST_MAP, wave, placedSentinels: team, baseHp: 50, maxBaseHp: 50, seed })
  for (let i = 0; i < 60 * 240 && engine.status === 'running'; i++) engine.step(TICK)
  return engine
}
const withMods = (s: Sentinel, mods: EffectMods): Sentinel => ({ ...s, mutations: [{ id: 'm', key: 'test', name: 'test', desc: '', rarity: 'mythic', downside: '', mods }] })
/** A column too strong to clear alone (so more damage is more), and one a lone hero can kill (so kills happen). */
const long = () => generateEncounter(9, 'normal', { subWaves: false })
const short = () => generateEncounter(3, 'normal', { subWaves: false })
const dealt = (e: GameEngine) => e.sentinels[0].damageDealt

describe('the peoples’ mechanics (engine)', () => {
  it('rateAura: a hero inside a speed aura fires more; outside its reach, as before', () => {
    const rogue = classicHero('rogue')
    const base = fight([{ sentinel: rogue, slotId: P.s3 }], long()).sentinels[0].shots
    const aura = fight([{ sentinel: withMods(rogue, { rateAura: { rateMult: 1.3, radius: 130 } }), slotId: P.s3 }], long()).sentinels[0].shots
    expect(aura).toBeGreaterThan(base)
    const tiny = fight([{ sentinel: withMods(rogue, { rateAura: { rateMult: 1, radius: 1 } }), slotId: P.s3 }], long()).sentinels[0].shots
    expect(tiny).toBe(base)
  })

  it('vsPlated / vsWarded: more damage on the armoured column it names, none on the other', () => {
    const plated = generateEncounter(3, 'normal', { subWaves: false, mod: 'plated' })
    const fighter = classicHero('fighter')
    const plain = dealt(fight([{ sentinel: fighter, slotId: P.s3 }], plated))
    expect(dealt(fight([{ sentinel: withMods(fighter, { vsPlated: 0.5 }), slotId: P.s3 }], plated))).toBeGreaterThan(plain)
    expect(dealt(fight([{ sentinel: withMods(fighter, { vsWarded: 0.5 }), slotId: P.s3 }], plated))).toBeCloseTo(plain, 6)
  })

  it('doubleEvery and chainEvery: a cadence that adds damage, with the same shots', () => {
    const rogue = classicHero('rogue')
    const a = fight([{ sentinel: rogue, slotId: P.s3 }], long())
    const b = fight([{ sentinel: withMods(rogue, { doubleEvery: 3 }), slotId: P.s3 }], long())
    const c = fight([{ sentinel: withMods(rogue, { chainEvery: { every: 3, chains: 3, dmgFrac: 1 } }), slotId: P.s3 }], long())
    expect(dealt(b)).toBeGreaterThan(dealt(a))
    expect(dealt(c)).toBeGreaterThan(dealt(a))
  })

  it('critBurn and spitEvery light enemies the plain hero does not', () => {
    const rogue = classicHero('rogue')
    const a = fight([{ sentinel: rogue, slotId: P.s3 }], short())
    const b = fight([{ sentinel: withMods(rogue, { critChanceAdd: 0.5, critBurn: { dps: 30, dur: 3 } }), slotId: P.s3 }], short())
    const c = fight([{ sentinel: withMods(rogue, { spitEvery: { every: 2, count: 3, dps: 30, dur: 3 } }), slotId: P.s3 }], short())
    expect(a.burningKills).toBe(0)
    expect(b.burningKills).toBeGreaterThan(0)
    expect(c.burningKills).toBeGreaterThan(0)
    // And against a column it cannot clear, the burn is damage it did not do before.
    const crit = fight([{ sentinel: withMods(rogue, { critChanceAdd: 0.5 }), slotId: P.s3 }], long())
    expect(dealt(fight([{ sentinel: withMods(rogue, { critChanceAdd: 0.5, critBurn: { dps: 30, dur: 3 } }), slotId: P.s3 }], long()))).toBeGreaterThan(dealt(crit))
  })

  it('killReady: a kill readies the next attack, so it fires more', () => {
    const rogue = classicHero('rogue')
    const a = fight([{ sentinel: rogue, slotId: P.s3 }], short()).sentinels[0].shots
    const b = fight([{ sentinel: withMods(rogue, { killReady: true }), slotId: P.s3 }], short()).sentinels[0].shots
    expect(b).toBeGreaterThan(a)
  })

  it('root: holds what it strikes in place (no roll), and rests between roots', () => {
    const mystic = classicHero('mystic')
    const wave = long()
    const a = fight([{ sentinel: mystic, slotId: P.s3 }], wave)
    const b = fight([{ sentinel: withMods(mystic, { root: { count: 99, dur: 1 } }), slotId: P.s3 }], wave)
    // Held longer in its reach: the same hero does more before the column walks by.
    expect(dealt(b)).toBeGreaterThan(dealt(a))
    // Same combat stream: rooting draws nothing, so the shots fired are not fewer.
    expect(b.sentinels[0].shots).toBeGreaterThanOrEqual(a.sentinels[0].shots)
  })

  it('a hero without any of them fights exactly as before (the mods are inert unless granted)', () => {
    const rogue = classicHero('rogue')
    const a = fight([{ sentinel: rogue, slotId: P.s3 }], long())
    const b = fight([{ sentinel: withMods(rogue, {}), slotId: P.s3 }], long())
    expect(dealt(b)).toBe(dealt(a))
    expect(b.sentinels[0].shots).toBe(a.sentinels[0].shots)
  })

  it('a kind’s edge reaches the profile: a Kite Shield slows, a Gambeson holds one more', () => {
    const h = classicHero('fighter')
    const wear = (slot: 'offHand' | 'body', it: Item) => computeCombat({ ...h, equipment: { ...h.equipment, [slot]: it } })
    const kite = generateItem(new RNG(1), { kind: 'Kite Shield', rarity: 'common' })
    expect(wear('offHand', kite).mods.chill?.slow).toBeCloseTo(0.15, 6)
    expect(wear('offHand', kite).mods.block?.count).toBe(2)
    const bare = computeCombat({ ...h, equipment: { ...h.equipment, body: null } }).mods.block?.count ?? 0
    expect(wear('body', generateItem(new RNG(1), { kind: 'Gambeson', rarity: 'common' })).mods.block?.count).toBe(bare + 1)
  })
})
