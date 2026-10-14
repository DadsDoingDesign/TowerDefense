import { beforeEach, describe, expect, it } from 'vitest'
import { COMPANY_IDS, type CompanyId } from '../src/game/data/companies'
import { kitPieceAt } from '../src/game/data/companyKits'
import { itemKindById, SOVEREIGN_LEVEL, UNLOCK_ITEM_KINDS } from '../src/game/data/itemKinds'
import { ALL_SKILLS, FEAT_SKILLS, isSignatureSkill, RANDOM_UNLOCK_SKILLS, SIGNATURE_SKILLS, skillById, STARTER_SKILLS } from '../src/game/data/skills'
import { ASK_STANDING, askStanding, askStandingFor } from '../src/game/run/asks'
import { charterDoor } from '../src/game/run/charter'
import { STAKES_OPEN_AT } from '../src/game/run/contracts'
import {
  legacyStandingCost,
  MAX_STANDING,
  migrateStandingXp,
  rollContractSkill,
  standingCost,
  standingFor,
  standingXpToReach,
} from '../src/game/run/standing'
import {
  canSignTerm,
  deliveriesTo,
  MAX_TERMS,
  nextTrackCard,
  nextTrackItem,
  payTrack,
  readTerm,
  SIGNATURE_LEVEL,
  sovereignKindOf,
  TERM_XP,
  termCap,
  trackLevel,
  trackPay,
  trackPlan,
  TRACK_PLAN,
  typicalDeliveryXp,
} from '../src/game/run/track'
import { lastProgress, META_VERSION, migrateMeta, useMetaStore } from '../src/state/metaStore'

const legacyReach = (s: number) => Array.from({ length: s }, (_, k) => legacyStandingCost(k)).reduce((a, b) => a + b, 0)
const legacyLevel = (xp: number) => {
  let s = 0
  while (s < MAX_STANDING && xp >= legacyReach(s + 1)) s++
  return s
}
const none = { skills: [] as string[], items: [] as string[] }

describe('the longer grind (Draft 4 · B)', () => {
  it('costs 1.75× the old curve: standing 10 at 2,975 XP, was 1,700', () => {
    expect(legacyReach(MAX_STANDING)).toBe(1700)
    expect(standingXpToReach(MAX_STANDING)).toBe(2975)
    for (let s = 0; s < MAX_STANDING; s++) expect(standingCost(s)).toBe(legacyStandingCost(s) * 1.75)
    expect(MAX_STANDING).toBe(10)
  })

  it('moves an old save onto the new curve at the same level and the same fraction of the way', () => {
    for (let xp = 0; xp <= 2000; xp += 7) {
      const now = migrateStandingXp(xp)
      const lv = legacyLevel(xp)
      expect(standingFor(now), `xp ${xp}`).toBe(lv)
      if (lv < MAX_STANDING) {
        const was = (xp - legacyReach(lv)) / legacyStandingCost(lv)
        const is = (now - standingXpToReach(lv)) / standingCost(lv)
        expect(Math.abs(was - is)).toBeLessThan(1 / standingCost(lv) + 1e-9)
      } else expect(now).toBe(TERM_XP)
    }
    // Exactly on a level's edge stays on it; one short stays short.
    expect(migrateStandingXp(legacyReach(4))).toBe(standingXpToReach(4))
    expect(standingFor(migrateStandingXp(legacyReach(4) - 1))).toBe(3)
  })

  it('migrates a v12 save to v13: every level kept, nothing paid, every company on its first term', () => {
    const old = { standing: { spice: 0, art: 130, metals: 900, silk: 1700, scrolls: 9999 }, skills: ['charge'], items: ['Axe'], bonusItems: [] }
    const m = migrateMeta(old, 12)
    for (const c of COMPANY_IDS) expect(standingFor(m.standing[c])).toBe(legacyLevel(old.standing[c]))
    expect(m.standing.silk).toBe(TERM_XP)
    expect(m.standing.scrolls).toBe(TERM_XP)
    expect(m.skills).toEqual(['charge'])
    expect(m.items).toEqual(['Axe'])
    expect(m.terms).toEqual({ spice: 1, art: 1, metals: 1, silk: 1, scrolls: 1 })
    // A current save is not moved again (merge runs migrateMeta on every load).
    expect(migrateMeta(m, META_VERSION).standing).toEqual(m.standing)
    expect(META_VERSION).toBe(13)
  })
})

describe('the track: every level names its reward', () => {
  it('is card · stakes · item · card · signature · item · card · item · card+Sovereign · term', () => {
    expect(TRACK_PLAN).toEqual(['card', 'stakes', 'item', 'card', 'signature', 'item', 'card', 'item', 'cardSovereign', 'term'])
    expect(TRACK_PLAN[STAKES_OPEN_AT - 1]).toBe('stakes')
    expect(TRACK_PLAN[SIGNATURE_LEVEL - 1]).toBe('signature')
  })

  it('pays a fresh militia exactly, company by company (the plan IS the settle)', () => {
    const rows = trackPlan('metals', { xp: 0, term: 1, ...none })
    expect(rows.map((r) => r.pay.card ?? r.pay.item ?? r.pay.signature ?? (r.pay.stakes ? 'stakes' : r.pay.secondTerm ? 'term' : r.pay.bonus))).toEqual([
      'hold_fast',
      'stakes',
      'Pavise',
      'shield_wall',
      'ore_sense',
      'Plate',
      'bulwark',
      'Greatsword',
      // Level 9's floor is 3 and Ironvein's one Level 3 card went at 7: its next card at any level.
      'cleave',
      'term',
    ])
    expect(rows[8].pay.named).toBe('Ironheart Plate')
    expect(rows[0].next).toBe(true)
    for (const r of rows) {
      expect(r.pay.flag).toEqual(kitPieceAt('metals', r.pay.level))
      expect(r.earned).toBe(false)
    }
  })

  it('a card is the company’s next locked one at the floor, then its own at any level, then anyone’s', () => {
    for (const c of COMPANY_IDS) {
      const first = nextTrackCard([], c, 1)!
      expect(skillById(first)!.company).toBe(c)
      expect(RANDOM_UNLOCK_SKILLS.filter((id) => skillById(id)!.company === c)[0]).toBe(first)
      expect(skillById(nextTrackCard([], c, 7)!)!.level).toBe(3)
    }
    const own = RANDOM_UNLOCK_SKILLS.filter((id) => skillById(id)!.company === 'art')
    expect(skillById(nextTrackCard(own, 'art', 1)!)!.company).not.toBe('art')
    expect(nextTrackCard([...RANDOM_UNLOCK_SKILLS], 'art', 1)).toBeNull()
    // A kind: the company's lowest level first, then anyone's.
    expect(nextTrackItem([], 'metals')).toBe('Pavise')
    expect(itemKindById(nextTrackItem(['Pavise', 'Plate', 'Greatsword', 'Warhammer'], 'metals')!)!.company).not.toBe('metals')
    expect(nextTrackItem([...UNLOCK_ITEM_KINDS], 'metals')).toBeNull()
  })

  it('names each company’s Sovereign item at level 9 without unlocking it', () => {
    for (const c of COMPANY_IDS) {
      const pay = trackPay(c, 1, 9, none)
      expect(itemKindById(pay.named!)!.level).toBe(SOVEREIGN_LEVEL)
      expect(itemKindById(pay.named!)!.company).toBe(c)
      expect(sovereignKindOf(c)).toBe(pay.named)
    }
    const s = payTrack({ gains: { art: TERM_XP }, xp: {}, terms: {}, ...none })
    expect(s.items.some((k) => itemKindById(k)!.level === SOVEREIGN_LEVEL)).toBe(false)
  })

  it('pays the Rare bonus item when nothing is left to unlock, and the same kind the plan named', () => {
    const all = { skills: [...RANDOM_UNLOCK_SKILLS, ...Object.values(SIGNATURE_SKILLS)], items: [...UNLOCK_ITEM_KINDS] }
    const rows = trackPlan('spice', { xp: 0, term: 1, ...all })
    for (const r of rows) {
      const step = TRACK_PLAN[r.pay.level - 1]
      expect(!!r.pay.bonus, `level ${r.pay.level}`).toBe(step !== 'stakes' && step !== 'term')
    }
    const s = payTrack({ gains: { spice: TERM_XP }, xp: {}, terms: {}, ...all })
    expect(s.pays.map((p) => p.bonus)).toEqual(rows.map((r) => r.pay.bonus))
  })

  it('estimates the pace from a typical delivery, honestly and simply', () => {
    expect(typicalDeliveryXp(1)).toBeGreaterThan(250)
    expect(typicalDeliveryXp(2) - typicalDeliveryXp(1)).toBe(ASK_STANDING)
    expect(deliveriesTo(0, 1, 1)).toBe(1)
    expect(deliveriesTo(standingXpToReach(3), 1, 3)).toBe(0)
    // The whole term: about ten deliveries with one company.
    expect(deliveriesTo(0, 1, 10)).toBeGreaterThanOrEqual(9)
    expect(deliveriesTo(0, 1, 10)).toBeLessThanOrEqual(12)
  })
})

describe('the signature skills', () => {
  it('are five Level 2 skills, one per company, never random, starters or feats', () => {
    const sig = ALL_SKILLS.filter((k) => k.signature)
    expect(sig).toHaveLength(5)
    expect(new Set(sig.map((k) => k.company))).toEqual(new Set(COMPANY_IDS))
    for (const k of sig) {
      expect(k.level).toBe(2)
      expect(SIGNATURE_SKILLS[k.company]).toBe(k.id)
      expect(isSignatureSkill(k.id)).toBe(true)
      expect(RANDOM_UNLOCK_SKILLS).not.toContain(k.id)
      expect(STARTER_SKILLS).not.toContain(k.id)
      expect(FEAT_SKILLS[k.id]).toBeUndefined()
      expect(k.desc).toMatch(/^[A-Z][^.]*(\.\d[^.]*)*\.$/)
    }
  })

  it('come only from the track: no card roll, no contract unlock, no card level of the track', () => {
    const have: string[] = []
    for (let i = 0; i < RANDOM_UNLOCK_SKILLS.length + 3; i++) {
      for (const c of COMPANY_IDS) {
        const got = rollContractSkill(have, c, 6, i)
        if (got) expect(isSignatureSkill(got)).toBe(false)
        const card = nextTrackCard(have, c, 9)
        if (card) expect(isSignatureSkill(card)).toBe(false)
      }
      const got = rollContractSkill(have, 'spice', 0, 'x', i)
      if (got) have.push(got)
    }
    for (const c of COMPANY_IDS) expect(trackPay(c, 1, SIGNATURE_LEVEL, none).signature).toBe(SIGNATURE_SKILLS[c])
  })

  it('do not gate the Sovereign Route: the door counts the random cards only', () => {
    expect(charterDoor({ skills: [...RANDOM_UNLOCK_SKILLS], items: [...UNLOCK_ITEM_KINDS] }).open).toBe(true)
  })

  it('a save keeps a signature skill it was paid, and a run deals it', () => {
    const m = migrateMeta({ skills: ['gilt_frame', 'charge', 'not_a_skill'] }, META_VERSION)
    expect(m.skills).toEqual(['gilt_frame', 'charge'])
  })
})

describe('in the store: the settle pays the track', () => {
  beforeEach(() => useMetaStore.getState().resetMeta())
  const settle = (company: CompanyId, kills = 400) =>
    useMetaStore.getState().settleContract({ depth: 12, kills, won: true, contract: { company, crates: 0, status: 'delivered' }, deposit: 0 })

  it('pays exactly what the track page showed, and reports each level', () => {
    const before = useMetaStore.getState()
    const plan = trackPlan('art', { xp: 0, term: 1, skills: before.skills, items: before.items })
    settle('art', 4000)
    const p = lastProgress.run!
    expect(p.standingAfter).toBeGreaterThan(2)
    expect(p.track.map((t) => t.level)).toEqual(Array.from({ length: p.standingAfter }, (_, i) => i + 1))
    expect(p.track).toEqual(plan.slice(0, p.standingAfter).map((r) => r.pay))
    const s = useMetaStore.getState()
    expect(p.standingCards).toEqual(p.track.flatMap((t) => [t.card, t.signature].filter(Boolean)))
    expect(p.standingItems).toEqual(p.track.flatMap((t) => (t.item ? [t.item] : [])))
    for (const id of p.standingCards) expect(s.skills).toContain(id)
    for (const id of p.standingItems) expect(s.items).toContain(id)
  })

  it('never pays a level twice: the levels a save already held pay nothing new', () => {
    useMetaStore.setState({ standing: { ...useMetaStore.getState().standing, metals: standingXpToReach(6) + 10 } })
    settle('metals')
    const p = lastProgress.run!
    expect(p.track.every((t) => t.level > 6)).toBe(true)
    // Across many settles, each level of the term is paid once.
    for (let i = 0; i < 30; i++) settle('metals', 900)
    const levels: number[] = []
    useMetaStore.getState().resetMeta()
    for (let i = 0; i < 30; i++) {
      settle('metals', 900)
      levels.push(...lastProgress.run!.track.map((t) => t.level))
    }
    expect(levels).toEqual(Array.from({ length: MAX_STANDING }, (_, i) => i + 1))
    expect(useMetaStore.getState().skills).toContain('ore_sense')
  })

  it('stops a term’s XP at its end until a second term is signed', () => {
    useMetaStore.setState({ standing: { ...useMetaStore.getState().standing, spice: TERM_XP - 5 } })
    settle('spice')
    expect(useMetaStore.getState().standing.spice).toBe(TERM_XP)
    settle('spice')
    expect(useMetaStore.getState().standing.spice).toBe(TERM_XP)
    expect(lastProgress.run!.track).toEqual([])
  })

  it('the Sovereign Route pays every company’s levels crossed, each its own', () => {
    useMetaStore.getState().settleContract({
      depth: 12,
      kills: 400,
      won: true,
      contract: { company: null, crates: 0, status: 'delivered', charter: true },
      deposit: 0,
      asks: [{ id: 'spice.burning', company: 'spice', target: 120, got: 130, met: true }],
    })
    const p = lastProgress.run!
    expect(new Set(p.track.map((t) => t.company))).toEqual(new Set(COMPANY_IDS))
    expect(p.spans).toHaveLength(COMPANY_IDS.length)
    for (const c of COMPANY_IDS) {
      const mine = p.track.filter((t) => t.company === c)
      const span = p.spans.find((s) => s.company === c)!
      expect(mine.map((t) => t.level)).toEqual(Array.from({ length: span.after - span.before }, (_, i) => span.before + 1 + i))
    }
    // Each company's level 1 paid its own first card.
    for (const c of COMPANY_IDS) expect(skillById(p.track.find((t) => t.company === c && t.level === 1)!.card!)!.company).toBe(c)
  })
})

describe('a second term', () => {
  beforeEach(() => useMetaStore.getState().resetMeta())

  it('is offered only at standing 10, once', () => {
    expect(canSignTerm(TERM_XP - 1, 1)).toBe(false)
    expect(canSignTerm(TERM_XP, 1)).toBe(true)
    expect(canSignTerm(TERM_XP * 2, 2)).toBe(false)
    expect(MAX_TERMS).toBe(2)
    expect(useMetaStore.getState().signTerm('art')).toBe(false)
    useMetaStore.setState({ standing: { ...useMetaStore.getState().standing, art: TERM_XP } })
    expect(useMetaStore.getState().signTerm('art')).toBe(true)
    expect(useMetaStore.getState().terms.art).toBe(2)
    expect(useMetaStore.getState().signTerm('art')).toBe(false)
    // You keep everything: standing (the stake cap, the flag kit) stays 10.
    expect(standingFor(useMetaStore.getState().standing.art)).toBe(MAX_STANDING)
    expect(trackLevel(useMetaStore.getState().standing.art, 2)).toBe(0)
  })

  it('validates a saved term against the XP: never a term not reached, never past the last', () => {
    expect(readTerm(2, TERM_XP)).toBe(2)
    expect(readTerm(2, TERM_XP - 1)).toBe(1)
    expect(readTerm(7, TERM_XP * 5)).toBe(MAX_TERMS)
    expect(readTerm('2', TERM_XP)).toBe(1)
    expect(readTerm(-1, 0)).toBe(1)
    const m = migrateMeta({ standing: { art: TERM_XP, metals: 10 }, terms: { art: 2, metals: 2, nope: 2 } }, META_VERSION)
    expect(m.terms).toEqual({ spice: 1, art: 2, metals: 1, silk: 1, scrolls: 1 })
  })

  it('restarts the track: its levels pay Rare bonus items, and level 5 catches up a missing signature', () => {
    const rows = trackPlan('silk', { xp: TERM_XP, term: 2, ...none })
    expect(rows[0].next).toBe(true)
    for (const r of rows) {
      expect(r.pay.card).toBeNull()
      expect(r.pay.item).toBeNull()
      expect(r.pay.flag).toBeNull()
      expect(r.pay.secondTerm).toBe(false)
      if (r.pay.level === SIGNATURE_LEVEL) expect(r.pay.signature).toBe('velvet_toll')
      else expect(r.pay.bonus).not.toBeNull()
    }
    expect(trackPay('silk', 2, SIGNATURE_LEVEL, { skills: ['velvet_toll'], items: [] }).bonus).not.toBeNull()
    expect(termCap(2)).toBe(TERM_XP * 2)
  })

  it('pays its company’s asks double, through the settle', () => {
    expect(askStandingFor(1)).toBe(ASK_STANDING)
    expect(askStandingFor(2)).toBe(ASK_STANDING * 2)
    const met = [{ id: 'metals.plated', company: 'metals' as const, target: 25, got: 30, met: true }]
    expect(askStanding(met, (c) => (c === 'metals' ? 2 : 1)).metals).toBe(2 * ASK_STANDING)
    useMetaStore.setState({ standing: { ...useMetaStore.getState().standing, metals: TERM_XP } })
    useMetaStore.getState().signTerm('metals')
    useMetaStore.getState().settleContract({ depth: 3, kills: 0, won: false, contract: { company: 'metals', crates: 0, status: 'lost' }, deposit: 0, asks: met })
    expect(useMetaStore.getState().standing.metals).toBe(TERM_XP + 3 * 15 + 2 * ASK_STANDING)
    expect(lastProgress.run!.askXp).toBe(2 * ASK_STANDING)
  })

  it('a Term II level crossed in the store owes its bonus item to the next contract', () => {
    useMetaStore.setState({ standing: { ...useMetaStore.getState().standing, scrolls: TERM_XP } })
    useMetaStore.getState().signTerm('scrolls')
    useMetaStore.getState().settleContract({ depth: 12, kills: 400, won: true, contract: { company: 'scrolls', crates: 0, status: 'delivered' }, deposit: 0 })
    const p = lastProgress.run!
    expect(p.track.length).toBeGreaterThan(0)
    expect(p.track.every((t) => t.term === 2 && !!t.bonus)).toBe(true)
    expect(useMetaStore.getState().bonusItems).toEqual(p.track.map((t) => t.bonus))
    expect(p.spans[0]).toMatchObject({ company: 'scrolls', term: 2, before: 0 })
  })
})
