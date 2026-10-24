import { describe, expect, it } from 'vitest'
import { COMPANY_IDS, companyById } from '../src/game/data/companies'
import { LIAISONS } from '../src/game/data/liaisons'
import { asksOf, freshAsks, type AskFacts, type RunAsk } from '../src/game/run/asks'
import { CITY_COUNT } from '../src/game/run/contracts'
import { cityLine, cityLines, endLine, fillLine, LIAISON_MAX_LINE, liaisonPlate } from '../src/game/run/liaison'
import { SCENE_ANCHORS, SCENE_SIZE } from '../src/ui/shell/stopScenes.generated'
import { liaisonScene } from '../src/ui/shell/stopSceneModel'

/** Every line a liaison has, raw. */
const everyLine = (c: (typeof COMPANY_IDS)[number]): string[] => {
  const l = LIAISONS[c]
  return [
    ...l.city.good,
    ...l.city.fair,
    ...l.city.rough,
    ...Object.values(l.asks).flatMap((a) => (a.met ? [a.open, a.met] : [a.open])),
    ...l.delivered.all,
    ...l.delivered.some,
    ...l.delivered.none,
    ...l.delivered.plain,
    ...l.cashedOut,
    ...l.fallen,
  ]
}

/** Facts for a contract whose count asks have all reached `got`. */
const facts = (asks: RunAsk[]): AskFacts => ({
  contract: { asks, earned: 0, cargoAt: [], purse: 0, advance: true, status: 'open' },
  gold: 0,
})

describe('the liaisons (Draft 4 · D)', () => {
  it('every company has one, with a name, a role and lines for every moment', () => {
    for (const c of COMPANY_IDS) {
      const l = LIAISONS[c]
      expect(l.company).toBe(c)
      expect(l.name).toMatch(/^[A-Z][a-z]+$/)
      expect(l.role).toMatch(/^[a-z]+$/)
      for (const pool of [l.city.good, l.city.fair, l.city.rough, l.delivered.all, l.delivered.some, l.delivered.none, l.delivered.plain, l.cashedOut, l.fallen])
        expect(pool.length).toBeGreaterThan(0)
    }
    expect(new Set(COMPANY_IDS.map((c) => LIAISONS[c].name)).size).toBe(COMPANY_IDS.length)
  })

  it('has words for each of its own company’s asks, and none for another’s', () => {
    for (const c of COMPANY_IDS) {
      const own = asksOf(c).map((a) => a.id)
      expect(Object.keys(LIAISONS[c].asks).sort()).toEqual([...own].sort())
      // An ask judged at the end is never met mid-road, so it has no "met" line.
      for (const a of asksOf(c)) if (a.atEnd) expect(LIAISONS[c].asks[a.id].met).toBeUndefined()
    }
  })

  it('every line, filled in for any city and quoted, fits the bubble', () => {
    const long: string[] = []
    for (const c of COMPANY_IDS)
      for (const raw of everyLine(c))
        for (let city = 0; city < CITY_COUNT; city++) {
          const line = fillLine(c, raw, city)
          expect(line.startsWith('“') && line.endsWith('”')).toBe(true)
          expect(line, `${c}: ${line}`).not.toMatch(/\{|\}/)
          if (line.length > LIAISON_MAX_LINE) long.push(`${line.length} ${line}`)
        }
    expect([...new Set(long)]).toEqual([])
  })

  it('never says a retired name, and never promises more than the rules pay', () => {
    for (const c of COMPANY_IDS)
      for (const raw of everyLine(c)) {
        expect(raw).not.toMatch(/\b([Tt]he|[Yy]our) company\b|\btowers?\b|\bSentinels?\b|\bMarks?\b/)
        // A tip is paid by the destination on a delivery, per ask met — never doubled, never a sum.
        expect(raw.replace(/\{\w+\}/g, '')).not.toMatch(/doubl|\d/)
      }
  })

  it('names who is speaking: "Brannoch · Ironvein’s factor"', () => {
    expect(liaisonPlate('metals')).toBe('Brannoch · Ironvein’s factor')
    expect(liaisonPlate('spice')).toBe('Saffra · Peppercorn’s broker')
    for (const c of COMPANY_IDS) expect(liaisonPlate(c)).toContain(LIAISONS[c].name)
  })

  it('at a city: deterministic in (seed, city), reacting to the cargo and the asks', () => {
    for (const c of COMPANY_IDS) {
      const asks = freshAsks(1234, c)
      const m = { seed: 1234, city: 0, arrived: 100, asks, facts: facts(asks) }
      expect(cityLine(c, m)).toBe(cityLine(c, { ...m }))
      // A good haul: the cargo line, and one nudge per ask still open.
      const lines = cityLines(c, m)
      expect(lines).toHaveLength(1 + asks.length)
      expect(LIAISONS[c].city.good).toContain(lines[0])
      for (const [i, a] of asks.entries()) expect(lines[1 + i]).toBe(LIAISONS[c].asks[a.id].open)
      // A rough arrival is all they talk about.
      expect(cityLines(c, { ...m, arrived: 40 })).toEqual([expect.stringMatching(/./)])
      expect(LIAISONS[c].city.rough).toContain(cityLines(c, { ...m, arrived: 40 })[0])
      expect(LIAISONS[c].city.fair).toContain(cityLines(c, { ...m, arrived: 75 })[0])
      // An ask met mid-road is said as met (a count ask only).
      const met = asks.map((a) => ({ ...a, got: a.target }))
      const metLines = cityLines(c, { ...m, asks: met, facts: facts(met) })
      for (const [i, a] of met.entries()) {
        const w = LIAISONS[c].asks[a.id]
        expect(metLines[1 + i]).toBe(w.met && !asksOf(c).find((d) => d.id === a.id)?.atEnd ? w.met : w.open)
      }
      // A first contract asks nothing: only the cargo.
      expect(cityLines(c, { seed: 1, city: 1, arrived: 95 })).toHaveLength(1)
    }
  })

  it('at a city: different runs say different things', () => {
    const asks = freshAsks(7, 'metals')
    const said = new Set(Array.from({ length: 80 }, (_, s) => cityLine('metals', { seed: s, city: 0, arrived: 100, asks, facts: facts(asks) })))
    expect(said.size).toBeGreaterThan(2)
  })

  it('at the end: delivered by asks met, cashed out, fallen — fixed for the run', () => {
    for (const c of COMPANY_IDS) {
      const l = LIAISONS[c]
      const q = (pool: readonly string[], city = CITY_COUNT - 1) => pool.map((s) => fillLine(c, s, city))
      expect(q(l.delivered.all)).toContain(endLine(c, 'delivered', 9, [{ met: true }, { met: true }]))
      expect(q(l.delivered.some)).toContain(endLine(c, 'delivered', 9, [{ met: true }, { met: false }]))
      expect(q(l.delivered.none)).toContain(endLine(c, 'delivered', 9, [{ met: false }, { met: false }]))
      expect(q(l.delivered.plain)).toContain(endLine(c, 'delivered', 9, []))
      expect(q(l.cashedOut, 1)).toContain(endLine(c, 'cashedOut', 9, [], 1))
      expect(q(l.fallen)).toContain(endLine(c, 'lost', 9))
      expect(endLine(c, 'lost', 9)).toBe(endLine(c, 'lost', 9))
    }
  })
})

describe('each liaison’s post (the baked scene)', () => {
  it('every company has its scene, its speaker inside it', () => {
    for (const c of COMPANY_IDS) {
      const key = liaisonScene(c)
      const a = SCENE_ANCHORS[key] as { speaker: readonly [number, number] }
      expect(a, key).toBeDefined()
      const [x, y] = a.speaker
      expect(x).toBeGreaterThan(0)
      expect(x).toBeLessThan(SCENE_SIZE.w)
      expect(y).toBeGreaterThan(0)
      expect(y).toBeLessThan(SCENE_SIZE.h)
    }
    // Five distinct posts, five distinct speakers.
    expect(new Set(COMPANY_IDS.map((c) => liaisonScene(c))).size).toBe(COMPANY_IDS.length)
    expect(companyById('metals').towns[0]).toBe('Slagpit')
  })
})
