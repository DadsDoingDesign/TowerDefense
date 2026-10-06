import { describe, expect, it } from 'vitest'
import { RNG } from '../src/game/core/rng'
import { describeBase, generateItem, gripOf, itemStyle, shieldHold, type HeroStyle } from '../src/game/data/items'
import { ITEM_KINDS, SOVEREIGN_ITEM_KINDS } from '../src/game/data/itemKinds'
import { computeCombat } from '../src/game/engine/combat'
import { classicHero } from '../src/game/data/sentinels'
import type { Item, ItemSlot } from '../src/game/types'

/**
 * Item identities (October audit, designer item 4a): every item KIND rolls one
 * clear stat identity, so two kinds in the same slot are never the same card
 * printed twice. Robe, Cloak, Plate and Aegis used to roll exactly Mail's
 * numbers, and Tome, Quiver and Focus exactly one another's.
 */
const KINDS = ITEM_KINDS.filter((k) => !SOVEREIGN_ITEM_KINDS.includes(k.id))
const roll = (kind: string, seed: number, rarity: Item['rarity'] = 'rare'): Item => generateItem(new RNG(seed), { kind, rarity, allowCurse: false })
/** The base stats a kind rolls (the keys with a non-zero value), over many rolls. */
function baseKeys(kind: string): string[] {
  const keys = new Set<string>()
  for (let s = 1; s <= 40; s++) for (const [k, v] of Object.entries(roll(kind, s).base)) if (v) keys.add(k)
  return [...keys].sort()
}
/** What a kind IS on the field: its base stats, its style, its grip and its hold. */
function signature(kind: string): string {
  const it = roll(kind, 1)
  const style: HeroStyle | null = itemStyle(it)
  return JSON.stringify({ keys: baseKeys(kind), style, grip: gripOf(it), hold: shieldHold(it) })
}

describe('item kinds: one identity each', () => {
  const slots: ItemSlot[] = ['oneHand', 'twoHand', 'offHand', 'body']

  it('no two kinds in a slot share a signature (base stats, style, grip, hold)', () => {
    for (const slot of slots) {
      const kinds = KINDS.filter((k) => k.slot === slot).map((k) => k.id)
      const seen = new Map<string, string>()
      for (const k of kinds) {
        const sig = signature(k)
        expect(seen.get(sig), `${k} rolls what ${seen.get(sig)} rolls in the ${slot} slot: ${sig}`).toBeUndefined()
        seen.set(sig, k)
      }
    }
  })

  it('no two kinds in a slot roll the same numbers off the same stream', () => {
    for (const slot of slots) {
      const kinds = KINDS.filter((k) => k.slot === slot).map((k) => k.id)
      for (let s = 1; s <= 10; s++) {
        const bases = kinds.map((k) => JSON.stringify(roll(k, s).base))
        expect(new Set(bases).size, `${slot} seed ${s}`).toBe(kinds.length)
      }
    }
  })

  it('every kind of a slot takes the same draws, so the stream behind an item never moves with its kind', () => {
    for (const slot of slots) {
      const kinds = KINDS.filter((k) => k.slot === slot).map((k) => k.id)
      for (const rarity of ['common', 'epic', 'mythic'] as const) {
        const after = kinds.map((k) => {
          const rng = new RNG(99)
          generateItem(rng, { kind: k, rarity })
          return rng.next()
        })
        expect(new Set(after).size, `${slot} ${rarity}: ${kinds.join(', ')}`).toBe(1)
      }
    }
  })

  it('the basic five roll exactly the classic numbers (a zero-meta run is untouched)', () => {
    // The classic formulas, written out. A forced kind at Common takes one draw
    // (the noun pick) before its base; then one draw for a weapon, two for an
    // off hand or a body.
    const round = (n: number) => Math.max(1, Math.round(n))
    const classic = (kind: string, seed: number): Item['base'] => {
      const rng = new RNG(seed)
      rng.next()
      if (kind === 'Sword') return { physDamage: round(rng.range(5, 8)), attackSpeed: 0.05 }
      // A caster's hit carries the tuning pass's ×1.6 (`items.CASTER_HIT`).
      if (kind === 'Wand') return { magDamage: Math.round(round(rng.range(5, 8)) * 1.6), attackSpeed: 0.06 }
      if (kind === 'Bow') return { physDamage: round(rng.range(9, 13)), attackSpeed: 0.04 }
      if (kind === 'Shield') return { attackSpeed: rng.range(0.04, 0.08), critChance: rng.range(0.03, 0.06) }
      return { rangeMult: rng.range(0.06, 0.12), splashAdd: round(rng.range(8, 16)) }
    }
    for (let s = 1; s <= 30; s++) {
      for (const kind of ['Sword', 'Wand', 'Bow', 'Shield', 'Mail']) {
        expect(generateItem(new RNG(s), { kind, rarity: 'common' }).base).toEqual(classic(kind, s))
      }
    }
  })

  it('an identity is a trade, not a free upgrade: no non-basic kind out-rolls its slot on every stat the basic kind has', () => {
    // A kind that gives up nothing would be a straight upgrade on the basic piece.
    const basicOf: Partial<Record<ItemSlot, string>> = { offHand: 'Shield', body: 'Mail' }
    for (const [slot, basic] of Object.entries(basicOf) as [ItemSlot, string][]) {
      const ref = baseKeys(basic)
      for (const k of KINDS.filter((x) => x.slot === slot && x.id !== basic)) {
        const keys = baseKeys(k.id)
        const hold = shieldHold(roll(k.id, 1))
        const superset = ref.every((x) => keys.includes(x)) && hold >= shieldHold(roll(basic, 1))
        if (superset) {
          // Same stats and at least the hold: it must roll less of something.
          let lessSomewhere = false
          for (let s = 1; s <= 10 && !lessSomewhere; s++) {
            const a = roll(k.id, s).base as Record<string, number>
            const b = roll(basic, s).base as Record<string, number>
            lessSomewhere = ref.some((x) => (a[x] ?? 0) < (b[x] ?? 0))
          }
          expect(lessSomewhere, `${k.id} rolls everything ${basic} rolls, and more`).toBe(true)
        }
      }
    }
  })

  it('a Tome and a Plate make every hit harder, whatever the damage type; the line says so', () => {
    for (const kind of ['Tome', 'Plate']) {
      const it = { ...roll(kind, 3), enchantments: [] }
      expect(it.base.damagePct).toBeGreaterThan(0)
      expect(describeBase(it).some((l) => /% Damage$/.test(l))).toBe(true)
      for (const look of ['fighter', 'mystic'] as const) {
        const h = classicHero(look)
        const slot = kind === 'Tome' ? 'offHand' : 'body'
        const bare = computeCombat({ ...h, equipment: { ...h.equipment, [slot]: null } })
        const worn = computeCombat({ ...h, equipment: { ...h.equipment, [slot]: it } })
        expect(worn.damage / bare.damage).toBeCloseTo(1 + it.base.damagePct!, 6)
      }
    }
  })

  it('each kind says only what it does — never how it mixes', () => {
    for (const k of KINDS) {
      expect(k.does).toMatch(/^(One hand|Both hands|Off hand|Body)/)
      expect(k.does).not.toMatch(/with|combo|pairs|together/i)
    }
    // No two kinds of a slot share a line.
    for (const slot of ['oneHand', 'twoHand', 'offHand', 'body'] as ItemSlot[]) {
      const lines = KINDS.filter((k) => k.slot === slot).map((k) => k.does)
      expect(new Set(lines).size).toBe(lines.length)
    }
  })

  it('an item saved before identities keeps the numbers it was rolled with', () => {
    // Base stats live ON the item: an old Cloak (reach and blast, the old body
    // roll) still fights with exactly those numbers.
    const old: Item = { id: 'old-cloak', name: 'Cloak', slot: 'body', rarity: 'rare', base: { rangeMult: 0.15, splashAdd: 20 }, enchantments: [] }
    const h = classicHero('mystic')
    const bare = computeCombat({ ...h, equipment: { ...h.equipment, body: null } })
    const worn = computeCombat({ ...h, equipment: { ...h.equipment, body: old } })
    expect(worn.splashRadius - bare.splashRadius).toBe(20)
    expect(worn.range / bare.range).toBeCloseTo(1.15, 6)
  })
})
