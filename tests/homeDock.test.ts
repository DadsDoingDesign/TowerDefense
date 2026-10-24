import { describe, expect, it } from 'vitest'
import { COMPANY_IDS, type CompanyId } from '../src/game/data/companies'
import { MAX_STANDING, standingXpToReach } from '../src/game/run/standing'
import { TERM_XP } from '../src/game/run/track'
import { DESPERATE_PAY, freshSeason, type Season } from '../src/game/run/tradeWar'
import { CHARTER_FEE, charterDoor } from '../src/game/run/charter'
import { CHARTER_SKILLS } from '../src/game/data/skills'
import { CHARTER_ITEM_KINDS } from '../src/game/data/itemKinds'
import { buildGeometry, FAN_ANGLES, litBy } from '../src/ui/attract/mapRules'
import { charterCta, charterSlot, charterSlotName, dockSlots, markText, SLOT_MARKS, slotName } from '../src/ui/shell/homeDock'

/*
 * The home's company dock (October 2026, the map-first home): five fixed
 * slots in `COMPANY_IDS` order, the order the map fans its roads.
 */

const xp = (s: Partial<Record<CompanyId, number>>) => Object.fromEntries(COMPANY_IDS.map((c) => [c, standingXpToReach(s[c] ?? 0)])) as Record<CompanyId, number>
const war = (o: Partial<Season> = {}): Season => ({ ...freshSeason(), ...o })

describe('the company dock', () => {
  it('always exactly five slots, in COMPANY_IDS order, whatever the save — Buy Company is not one of them', () => {
    for (const save of [xp({}), xp({ scrolls: 9, spice: 1 }), xp({ metals: 10, art: 4 })]) {
      const slots = dockSlots({ xp: save, war: null, market: null })
      expect(slots).toHaveLength(5)
      expect(slots.map((s) => s.company)).toEqual([...COMPANY_IDS])
    }
  })

  it('a pick never re-frames the map: the same open area gives the same geometry, whatever is focused', () => {
    // The focus is not an input to the geometry at all; the open area depends on the viewport only (MenuScreen).
    const open = { x: 0, y: 33, w: 195, h: 190 }
    expect(buildGeometry(195, 422, open)).toEqual(buildGeometry(195, 422, open))
  })

  it('the roads fan west to east in the same order, so the dock is the map’s legend', () => {
    expect([...FAN_ANGLES].sort((a, b) => a - b)).toEqual([...FAN_ANGLES])
    for (const open of [{ x: 0, y: 30, w: 195, h: 240 }, { x: 0, y: 40, w: 720, h: 260 }]) {
      const g = buildGeometry(open.w, open.y + open.h + 120, open)
      const xs = g.routes.map((r) => r.towns[2][0])
      expect(g.routes.map((r) => r.company)).toEqual([...COMPANY_IDS])
      expect([...xs].sort((a, b) => a - b)).toEqual(xs)
    }
  })

  it('says your standing ("Rep 4"), or the term and level on a second term ("II · 3")', () => {
    const save = { ...xp({ art: 4 }), metals: TERM_XP + standingXpToReach(3) }
    const slots = dockSlots({ xp: save, terms: { metals: 2 }, war: null, market: null })
    expect(slots.find((s) => s.company === 'art')!.rep).toBe('Rep 4')
    const metals = slots.find((s) => s.company === 'metals')!
    expect(metals.rep).toBe('II · 3')
    expect(slotName(metals, 1.3)).toContain('Term II, level 3')
  })

  it('a company not hiring yet: locked, with the standing that opens it', () => {
    const scrolls = dockSlots({ xp: xp({ spice: 1 }), war: null, market: null }).find((s) => s.company === 'scrolls')!
    expect(scrolls.open).toBe(false)
    expect(scrolls.opensAt).toBe(3)
    expect(slotName(scrolls, 1.3)).toMatch(/not hiring yet, opens at Standing 3/)
    expect(dockSlots({ xp: xp({ spice: 3 }), war: null, market: null }).find((s) => s.company === 'scrolls')!.open).toBe(true)
  })

  it('the day’s marks only once they show; the number on the slot, all of them in its name', () => {
    const quiet = dockSlots({ xp: xp({ spice: 2 }), war: null, market: null })
    expect(quiet.every((s) => s.marks.length === 0 && !s.leads)).toBe(true)

    const season = war({ shares: { spice: 27, art: 14, metals: 32, silk: 11, scrolls: 16 }, desperate: 'silk' })
    const slots = dockSlots({ xp: xp({ spice: 7, art: 4, metals: 3, silk: 2, scrolls: 5 }), war: season, market: { company: 'silk', mult: 1.3 } })
    const by = (c: CompanyId) => slots.find((s) => s.company === c)!
    expect(slots.filter((s) => s.leads).map((s) => s.company)).toEqual(['metals'])
    expect(by('metals').marks).toEqual([])
    expect(by('scrolls').marks).toEqual([])
    expect(by('silk').marks).toEqual(['desperate', 'market'])
    expect(by('silk').marks.length).toBeLessThanOrEqual(SLOT_MARKS)
    expect(markText('desperate', 1.3)).toBe(`×${DESPERATE_PAY}`)
    expect(markText('market', 1.3)).toBe('×1.3')
    expect(slotName(by('silk'), 1.3)).toBe(`Rosethread: standing 2, ${Math.floor(by('silk').progress * 100)}% to the next, desperate, pays ×1.5, its goods sell ×1.3 today`)
    expect(slotName(by('metals'), 1.3)).toContain('leads the trade war')
  })

  it('the bar says how far to the next Rep, not the trade’s share (the designer: "show an xp bar instead")', () => {
    const at = (n: number) => dockSlots({ xp: { spice: n }, war: null, market: null }).find((s) => s.company === 'spice')!
    const reach1 = standingXpToReach(1)
    expect(at(0).progress).toBe(0)
    expect(at(Math.floor(reach1 / 2)).progress).toBeCloseTo(Math.floor(reach1 / 2) / reach1, 5)
    expect(at(reach1).standing).toBe(1)
    expect(at(reach1).progress).toBe(0)
    expect(at(standingXpToReach(MAX_STANDING)).progress).toBe(1)
    expect(slotName(at(standingXpToReach(MAX_STANDING)), 1)).toContain('top level')
    expect(slotName(at(Math.floor(reach1 / 2)), 1)).toMatch(/\d+% to the next/)
  })

  it('an even season crowns nobody, and nor does a tie at the top', () => {
    const slots = dockSlots({ xp: xp({ spice: 2 }), war: freshSeason(), market: null })
    expect(slots.some((s) => s.leads)).toBe(false)
    const tie = dockSlots({ xp: xp({ spice: 2 }), war: war({ shares: { spice: 30, art: 10, metals: 30, silk: 14, scrolls: 16 } }), market: null })
    expect(tie.some((s) => s.leads)).toBe(false)
  })
})

describe('the Buy Company plaque (the Sovereign Route), on the dock’s shoulder', () => {
  const door = (skills: number, items: number) =>
    charterDoor({ skills: CHARTER_SKILLS.slice(0, skills), items: CHARTER_ITEM_KINDS.slice(0, items) })
  const ALL_SKILLS = CHARTER_SKILLS.length
  const ALL_ITEMS = CHARTER_ITEM_KINDS.length

  it('locked: the progress toward the door, and the CTA says what is missing', () => {
    const s = charterSlot(door(10, 8), 50_000)
    expect(s.open).toBe(false)
    expect(s.missing).toBe(ALL_SKILLS - 10 + ALL_ITEMS - 8)
    expect(s.pct).toBe(Math.floor((18 / (ALL_SKILLS + ALL_ITEMS)) * 100))
    expect(s.skills).toEqual({ have: 10, need: ALL_SKILLS })
    expect(s.items).toEqual({ have: 8, need: ALL_ITEMS })
    expect(charterCta(s)).toEqual({ label: `Unlock ${s.missing} more`, fee: null, enabled: false })
    expect(charterSlotName(s)).toMatch(/^Buy Company: locked, \d+% unlocked/)
  })

  it('one unlock short never reads 100%', () => {
    const s = charterSlot(door(ALL_SKILLS, ALL_ITEMS - 1), 0)
    expect(s.open).toBe(false)
    expect(s.pct).toBeLessThan(100)
    expect(charterCta(s).label).toBe('Unlock 1 more')
  })

  it('open: "Buy Company" with the fee, disabled while the bank is short', () => {
    const rich = charterSlot(door(ALL_SKILLS, ALL_ITEMS), CHARTER_FEE + 1)
    expect(rich).toMatchObject({ open: true, pct: 100, missing: 0, short: 0 })
    expect(charterCta(rich)).toEqual({ label: 'Buy Company', fee: CHARTER_FEE, enabled: true })
    expect(charterSlotName(rich)).toBe(`Buy Company: open, ${CHARTER_FEE.toLocaleString('en')} gold`)

    const poor = charterSlot(door(ALL_SKILLS, ALL_ITEMS), CHARTER_FEE - 1240)
    expect(poor.short).toBe(1240)
    expect(charterCta(poor)).toEqual({ label: 'Buy Company', fee: CHARTER_FEE, enabled: false })
    expect(charterSlotName(poor)).toContain('Your bank is 1,240 short')
  })

  it('selecting it lights every road; a company’s slot lights its own', () => {
    for (const c of COMPANY_IDS) {
      expect(litBy('all', c)).toBe(true)
      expect(litBy('metals', c)).toBe(c === 'metals')
      expect(litBy(null, c)).toBe(false)
    }
  })
})
