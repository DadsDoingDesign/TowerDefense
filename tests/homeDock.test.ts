import { describe, expect, it } from 'vitest'
import { COMPANY_IDS, type CompanyId } from '../src/game/data/companies'
import { standingXpToReach } from '../src/game/run/standing'
import { TERM_XP } from '../src/game/run/track'
import { DESPERATE_PAY, freshSeason, type Season } from '../src/game/run/tradeWar'
import { CHARTER_FEE, charterDoor } from '../src/game/run/charter'
import { RANDOM_UNLOCK_SKILLS } from '../src/game/data/skills'
import { UNLOCK_ITEM_KINDS } from '../src/game/data/itemKinds'
import { buildGeometry, FAN_ANGLES, litBy } from '../src/ui/attract/mapRules'
import { charterCta, charterSlot, charterSlotName, dockSlots, markText, SLOT_MARKS, slotName } from '../src/ui/shell/homeDock'

/*
 * The home's company dock (October 2026, the map-first home): five fixed
 * slots in `COMPANY_IDS` order, the order the map fans its roads.
 */

const xp = (s: Partial<Record<CompanyId, number>>) => Object.fromEntries(COMPANY_IDS.map((c) => [c, standingXpToReach(s[c] ?? 0)])) as Record<CompanyId, number>
const war = (o: Partial<Season> = {}): Season => ({ ...freshSeason(), ...o })

describe('the company dock', () => {
  it('always five slots, in COMPANY_IDS order, whatever the save', () => {
    for (const save of [xp({}), xp({ scrolls: 9, spice: 1 }), xp({ metals: 10, art: 4 })]) {
      expect(dockSlots({ xp: save, war: null, market: null }).map((s) => s.company)).toEqual([...COMPANY_IDS])
    }
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

  it('the share and the day’s marks only once they show; the number on the slot, all of them in its name', () => {
    const quiet = dockSlots({ xp: xp({ spice: 2 }), war: null, market: null })
    expect(quiet.every((s) => s.share == null && s.marks.length === 0 && !s.leads)).toBe(true)

    const season = war({ shares: { spice: 27, art: 14, metals: 32, silk: 11, scrolls: 16 }, exclusive: 'metals', desperate: 'silk' })
    const slots = dockSlots({ xp: xp({ spice: 7, art: 4, metals: 3, silk: 2, scrolls: 5 }), war: season, market: { company: 'silk', mult: 1.3 } })
    const by = (c: CompanyId) => slots.find((s) => s.company === c)!
    expect(slots.map((s) => s.share)).toEqual([27, 14, 32, 11, 16])
    expect(slots.filter((s) => s.leads).map((s) => s.company)).toEqual(['metals'])
    expect(by('metals').marks).toEqual(['exclusive'])
    // Ironvein's rival is Moonquill: cold while the exclusive is Ironvein's.
    expect(by('scrolls').marks).toEqual(['cold'])
    expect(by('silk').marks).toEqual(['desperate', 'market'])
    expect(by('silk').marks.length).toBeLessThanOrEqual(SLOT_MARKS)
    expect(markText('desperate', 1.3)).toBe(`×${DESPERATE_PAY}`)
    expect(markText('market', 1.3)).toBe('×1.3')
    expect(slotName(by('silk'), 1.3)).toBe('Rosethread: standing 2, 11% of the trade, desperate, pays ×1.5, its goods sell ×1.3 today')
    expect(slotName(by('metals'), 1.3)).toContain('leads the trade war')
  })

  it('an even season crowns nobody', () => {
    const slots = dockSlots({ xp: xp({ spice: 2 }), war: freshSeason(), market: null })
    expect(slots.some((s) => s.leads)).toBe(false)
  })
})

describe('the sixth slot: Buy Company (the Sovereign Route)', () => {
  const door = (skills: number, items: number) =>
    charterDoor({ skills: RANDOM_UNLOCK_SKILLS.slice(0, skills), items: UNLOCK_ITEM_KINDS.slice(0, items) })
  const ALL_SKILLS = RANDOM_UNLOCK_SKILLS.length
  const ALL_ITEMS = UNLOCK_ITEM_KINDS.length

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
