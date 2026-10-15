import { describe, expect, it } from 'vitest'
import { COMPANY_IDS, companyById } from '../src/game/data/companies'
import { ENEMY_MODS } from '../src/game/data/enemies'
import { CURSED_DAMAGE_MULT } from '../src/game/data/hazards'
import { CURSED_DAMAGE_PCT, GROUND_EFFECTS, groundEffect, TERRAIN_RULE_IDS } from '../src/game/data/terrain'
import { CHARTER_FEE, charterDoor } from '../src/game/run/charter'
import { RANDOM_UNLOCK_SKILLS } from '../src/game/data/skills'
import { UNLOCK_ITEM_KINDS } from '../src/game/data/itemKinds'
import { CHARTER_ROWS, charterFacts, COMPANY_ROWS, companyBadge, companyFacts } from '../src/ui/shell/homeCard'
import { charterSlot } from '../src/ui/shell/homeDock'

/*
 * The home card is a fixed form (October 2026, "no wiggle"): the same rows in
 * the same places for every company and every state — only the values change
 * — and the Buy Company card is the same number of rows in the same frame.
 */

type War = Parameters<typeof companyFacts>[0]['war']
const WARS: War[] = [
  null,
  { desperate: false },
  { desperate: true },
]

describe('the company card: a fixed form', () => {
  it('every company, in every state, has the same three rows in the same order', () => {
    for (const company of COMPANY_IDS)
      for (const war of WARS)
        for (const market of [1, 1.3])
          for (const [staged, open] of [
            [false, true],
            [false, false],
            [true, true],
          ] as const)
            for (const next of ['Gilt Frame at 5', null]) {
              const facts = companyFacts({ company, staged, open, war, market, next })
              expect(facts.map((f) => f.key)).toEqual([...COMPANY_ROWS])
              expect(facts.map((f) => f.label)).toEqual(['Ground', 'Raiders', 'Next'])
              // A one-off condition is a short badge in the head, never a row.
              const badge = companyBadge({ company, staged, open, war, market, next })
              if (badge) expect(badge.label.length, `${company}: ${badge.label}`).toBeLessThanOrEqual(16)
              // One line each: short enough for the 375px card (it is also cut in place, never wrapped).
              for (const f of facts) expect(f.value.length, `${company} ${f.key}: ${f.value}`).toBeLessThanOrEqual(32)
            }
  })

  it('the head badge shows one condition, by priority, and nothing on most days', () => {
    const at = (war: War, market = 1) => companyBadge({ company: 'silk', staged: false, open: true, war, market, next: null })
    expect(at(null)).toBeNull()
    expect(at({ desperate: false })).toBeNull()
    expect(at(null, 1.3)).toMatchObject({ label: 'Top price ×1.3', tone: 'market' })
    expect(at(null, 1.3)?.name).toContain('silk')
    // Desperate beats the market.
    expect(at({ desperate: true }, 1.3)).toMatchObject({ tone: 'bad' })
    expect(at({ desperate: true }, 1.3)?.label).toMatch(/^Desperate \+\d+%$/)
    // A first launch's CTA says "Take the free escort": no badge to say it again.
    expect(companyBadge({ company: 'spice', staged: true, open: true, war: null, market: 1.3, next: null })).toBeNull()
  })

  it('Ground says what the ground does, from the one table; Raiders says what gets through', () => {
    for (const c of COMPANY_IDS) {
      const co = companyById(c)
      const [ground, raiders] = companyFacts({ company: c, staged: false, open: true, war: null, market: 1, next: null })
      expect(ground.value).toBe(groundEffect(co.ground.rules).effect)
      expect(ground.value).not.toBe(co.ground.name)
      expect(ground.ground?.length).toBeGreaterThan(0)
      const mod = ENEMY_MODS.find((m) => m.id === co.armour)
      if (mod) {
        expect(raiders.armour).toBe(mod.id)
        // Plate shrugs off steel: bring magic; wards shrug off magic: bring steel.
        expect(raiders.value).toContain(mod.physResist > 0 ? 'bring magic' : 'bring steel')
      } else expect(raiders.value).toBe('Plate or wards, evenly')
    }
    // Rosethread's road deals lakes or fires: both, by name and mark.
    expect(groundEffect(companyById('silk').ground.rules)).toMatchObject({ effect: 'Lakes or fires block posts', marks: ['water', 'fire'] })
    expect(CURSED_DAMAGE_PCT).toBe(Math.round((1 - CURSED_DAMAGE_MULT) * 100))
    for (const id of TERRAIN_RULE_IDS) expect(GROUND_EFFECTS[id].effect.length).toBeLessThanOrEqual(30)
  })
})

describe('the Buy Company card: the same frame', () => {
  const door = (skills: number, items: number) => charterDoor({ skills: RANDOM_UNLOCK_SKILLS.slice(0, skills), items: UNLOCK_ITEM_KINDS.slice(0, items) })
  it('three rows, locked, open or short of the fee', () => {
    const states = [charterSlot(door(10, 8), 340), charterSlot(door(999, 999), CHARTER_FEE + 1), charterSlot(door(999, 999), CHARTER_FEE - 1240)]
    for (const s of states) {
      const facts = charterFacts(s)
      expect(facts.map((f) => f.key)).toEqual([...CHARTER_ROWS])
      expect(facts.length).toBe(COMPANY_ROWS.length)
    }
    expect(charterFacts(states[0])[1].value).toBe(`10/${RANDOM_UNLOCK_SKILLS.length} skills · 8/${UNLOCK_ITEM_KINDS.length} items`)
    expect(charterFacts(states[1])[1].value).toBe('Covers the fee')
    expect(charterFacts(states[2])[1]).toMatchObject({ value: '1,240 gold short', tone: 'bad' })
  })
})
