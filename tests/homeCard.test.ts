import { describe, expect, it } from 'vitest'
import { COMPANY_IDS, companyById } from '../src/game/data/companies'
import { ENEMY_MODS } from '../src/game/data/enemies'
import { CURSED_DAMAGE_MULT } from '../src/game/data/hazards'
import { CURSED_DAMAGE_PCT, GROUND_EFFECTS, groundEffect, TERRAIN_RULE_IDS } from '../src/game/data/terrain'
import { CHARTER_FEE, charterDoor } from '../src/game/run/charter'
import { RANDOM_UNLOCK_SKILLS } from '../src/game/data/skills'
import { UNLOCK_ITEM_KINDS } from '../src/game/data/itemKinds'
import { CHARTER_ROWS, charterFacts, COMPANY_ROWS, companyFacts } from '../src/ui/shell/homeCard'
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
  it('every company, in every state, has the same four rows in the same order', () => {
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
              expect(facts.map((f) => f.label)).toEqual(['Ground', 'Raiders', 'Today', 'Next'])
              // One line each: short enough for the 375px card (it is also cut in place, never wrapped).
              for (const f of facts) expect(f.value.length, `${company} ${f.key}: ${f.value}`).toBeLessThanOrEqual(32)
            }
  })

  it('Today shows one condition, by priority, and "Usual terms" when none applies', () => {
    const at = (war: War, market = 1) => companyFacts({ company: 'silk', staged: false, open: true, war, market, next: null })[2]
    expect(at(null).value).toBe('Usual terms')
    expect(at(null).tone).toBe('quiet')
    expect(at(null, 1.3).value).toBe('Top price for silk ×1.3')
    // Desperate beats the market.
    expect(at({ desperate: true }, 1.3).value).toMatch(/^Desperate: raiders \+\d+%$/)
    expect(companyFacts({ company: 'spice', staged: true, open: true, war: null, market: 1, next: null })[2].value).toBe('Free escort · paid at every city')
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
  it('four rows, locked, open or short of the fee', () => {
    const states = [charterSlot(door(10, 8), 340), charterSlot(door(999, 999), CHARTER_FEE + 1), charterSlot(door(999, 999), CHARTER_FEE - 1240)]
    for (const s of states) {
      const facts = charterFacts(s)
      expect(facts.map((f) => f.key)).toEqual([...CHARTER_ROWS])
      expect(facts.length).toBe(COMPANY_ROWS.length)
    }
    expect(charterFacts(states[0])[2].value).toBe(`10/${RANDOM_UNLOCK_SKILLS.length} skills · 8/${UNLOCK_ITEM_KINDS.length} items`)
    expect(charterFacts(states[1])[2].value).toBe('Covers the fee')
    expect(charterFacts(states[2])[2]).toMatchObject({ value: '1,240 gold short', tone: 'bad' })
  })
})
