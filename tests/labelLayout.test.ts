import { describe, expect, it } from 'vitest'
import { COMPANY_IDS, companyById, type CompanyId } from '../src/game/data/companies'
import { buildGeometry, roadViews, type Rect } from '../src/ui/attract/mapRules'
import { cellsUnder, hits, hubBoxes, placeCityLabels, placeSignposts, roadCells, segHitsBox, signPrio, type Box } from '../src/ui/attract/labelLayout'

/*
 * The home map's labels (October 2026): the signposts never move on a pick,
 * and the focused road's three cities hang beside it as annotations — never
 * on each other, a signpost, the road, an overlay or the screen's edge.
 *
 * The open areas, and the parts floating over them (the season panel under
 * the purse, the Buy Company slot over the dock's right end), are the running
 * app's boxes at each size (measured in Playwright); one map pixel is 2 CSS px
 * at every integer DPR.
 */
const box = (l: number, r: number, t: number, b: number): Box => ({ l, r, t, b })
const VIEWS: Record<string, { w: number; h: number; open: Rect; floats: Box[] }> = {
  '390×844': { w: 390, h: 844, open: { x: 0, y: 66, w: 390, h: 423 }, floats: [box(10, 148, 66, 110), box(310, 378, 409, 485)] },
  '375×667': { w: 375, h: 667, open: { x: 0, y: 66, w: 375, h: 318 }, floats: [box(10, 148, 66, 110), box(298, 363, 320, 380)] },
  '1280×800': { w: 1280, h: 800, open: { x: 0, y: 88, w: 1280, h: 476 }, floats: [box(29, 167, 88, 132), box(932, 1118, 496, 560)] },
}
const PX = 2
/** A city tag's size: the running app's (Inter at --fs-xs, 7px padding), a little over. */
const tag = (name: string, dest: boolean) => ({ w: Math.ceil(name.length * (dest ? 7 : 6.6) + 18), h: 19 })
const SIGN = { w: 48, h: 32 }

const SAVES: Record<string, Partial<Record<CompanyId, number>>> = {
  veteran: { spice: 7, art: 4, metals: 3, silk: 2, scrolls: 5 },
  early: { spice: 1 },
}

/** What floats over the map for a save: a veteran's season panel, or an early save's coach pill (full width under the bar); and the Buy Company slot. */
const floatsFor = (view: (typeof VIEWS)[string], save: string): Box[] =>
  save === 'early' ? [box(view.open.x + 12, view.open.x + view.open.w - 12, view.open.y, view.open.y + 44), view.floats[1]] : view.floats

function layout(view: (typeof VIEWS)[string], standing: Partial<Record<CompanyId, number>>, floats: Box[]) {
  const { open } = view
  const geo = buildGeometry(Math.ceil(view.w / PX), Math.ceil(view.h / PX), { x: open.x / PX, y: open.y / PX, w: open.w / PX, h: open.h / PX })
  const st = Object.fromEntries(COMPANY_IDS.map((c) => [c, standing[c] ?? 0])) as Record<CompanyId, number>
  const hiring = Object.fromEntries(COMPANY_IDS.map((c) => [c, c !== 'scrolls' || Object.values(st).some((s) => s >= 3)])) as Record<CompanyId, boolean>
  const roads = roadViews({ standing: st, hiring, firstRun: false, first: 'spice' })
  const signs = placeSignposts(
    geo.routes.map((r, i) => ({ id: r.company, x: r.towns[2][0] * PX, y: (r.towns[2][1] - 8) * PX, ...SIGN, prio: signPrio(roads[i], i) })),
    open,
    floats,
  )
  return { geo, signs, open }
}

describe('the home map’s labels', () => {
  for (const [name, view] of Object.entries(VIEWS)) {
    for (const [save, standing] of Object.entries(SAVES)) {
      it(`${name}, ${save}: signposts apart, inside the open area, and the same for every focus`, () => {
        const { signs, open } = layout(view, standing, floatsFor(view, save))
        for (const [i, a] of signs.entries()) {
          expect(a.box.l, a.id).toBeGreaterThanOrEqual(open.x)
          expect(a.box.r, a.id).toBeLessThanOrEqual(open.x + open.w)
          expect(a.box.t, a.id).toBeGreaterThanOrEqual(open.y)
          for (const b of signs.slice(i + 1)) expect(hits(a.box, b.box), `${a.id} × ${b.id}`).toBe(false)
          for (const f of floatsFor(view, save)) expect(hits(a.box, f), `${a.id} under a floating part`).toBe(false)
        }
        // No focus is an input: placing again (any focus) gives the same places.
        expect(layout(view, standing, floatsFor(view, save)).signs).toEqual(signs)
      })

      it(`${name}, ${save}: each road's cities clear each other, the signposts, their road and the edges`, () => {
        const { geo, signs, open } = layout(view, standing, floatsFor(view, save))
        // The signposts, and your own town (the keep and its banner).
        const blocked = signs.map((s) => s.box)
        const keep = hubBoxes(geo.hub, PX)
        // What floats over the map: keep off it too.
        const avoid = floatsFor(view, save)
        for (const c of COMPANY_IDS) {
          const lit = geo.routes.find((r) => r.company === c)!
          const px = (p: readonly [number, number]) => [p[0] * PX, p[1] * PX] as [number, number]
          const co = companyById(c)
          const towns = lit.towns.map(([x, y], i) => ({ x: x * PX, y: (y - 3) * PX, ...tag(co.towns[i], i === 2) }))
          const out = placeCityLabels({
            towns,
            hub: px(geo.hub),
            own: lit.chain.map(px),
            others: geo.routes.filter((r) => r !== lit).map((r) => r.chain.map(px)),
            blocked: [...blocked, ...avoid],
            keep,
            bounds: open,
            midX: geo.hub[0] * PX,
          })
          // Every name finds room.
          expect(out.every(Boolean), `${name} ${c}: a city left off`).toBe(true)
          const boxes = out.map((o) => o!.box)
          const own = roadCells([lit.chain.map(px)], 4)
          for (const [i, b] of boxes.entries()) {
            const who = `${name} ${c} ${co.towns[i]}`
            expect(b.l, who).toBeGreaterThanOrEqual(open.x)
            expect(b.r, who).toBeLessThanOrEqual(open.x + open.w)
            expect(b.t, who).toBeGreaterThanOrEqual(open.y)
            expect(b.b, who).toBeLessThanOrEqual(open.y + open.h)
            expect(cellsUnder(b, own), `${who} on its road`).toBe(0)
            for (const s of [...blocked, ...avoid, ...keep]) expect(hits(b, s), `${who} × a signpost, the keep or an overlay`).toBe(false)
            for (const o of boxes.slice(i + 1)) expect(hits(b, o), `${who} × another city`).toBe(false)
            // Its leader runs through no other label.
            for (const [j, o] of boxes.entries()) if (j !== i) expect(segHitsBox(out[i]!.line, o), `${who}'s leader`).toBe(false)
          }
          // One side of the road for all three: the leaders all meet the same edge.
          // The one exception is the shortest road on the shortest phone
          // (Peppercorn's at 375×667: three towns in 80px, between the keep and
          // the season row), where the names take two sides rather than overlap.
          const sides = new Set(out.map((o) => o!.edge)).size
          if (name === '375×667' && c === 'spice') expect(sides, `${name} ${c}`).toBeLessThanOrEqual(2)
          else expect(sides, `${name} ${c}: one side`).toBe(1)
        }
      })
    }
  }
})
