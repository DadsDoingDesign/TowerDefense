/**
 * The five company liaisons as the designer APPROVED them (Oct 2026), in one
 * table: each one's final pixel-map module under `scripts/designs/`, drawn by
 * that design's own stamping kit (`<name>-lib.ts`). Nothing here redraws
 * them: a figure is the final's own render, pixel for pixel, at the pack's
 * scale (the scale the liaisons' posts are baked at).
 *
 *   Peppercorn Co. (spice)  Saffra, the Field Burner     saffra-d03-props.ts  B1 (her own body, the Ember Pot)
 *   Butcherblock   (art)    Hask, the Salt-Barge Poleman hask-d03.ts          D03 (the reed cone centred)
 *   Ironvein       (metals) Brannoch, the Mason Elder    brannoch-d07.ts      D07 (his boots showing)
 *   Rosethread     (silk)   Odile, the Ford Toll-Keeper  odile-d04-a-final.ts D04_A_FINAL
 *   Greenvial      (scrolls) Wren, the Flowerpot Potter  wren-d09-E-smock-final.ts D09_E_SMOCK_FINAL
 *
 * Read by `scripts/stop-scenes.ts` (the posts) and the review cards. The dock
 * figures (`src/game/render/hero/mini.ts`) are hand-drawn small versions of
 * these, never a downscale.
 */
import type { CompanyId } from '../src/game/data/companies'
import type { PersonaId } from '../src/game/render/hero/rig'
import * as SaffraKit from './designs/saffra-lib'
import * as HaskKit from './designs/hask-lib'
import * as BrannochKit from './designs/brannoch-lib'
import * as OdileKit from './designs/odile-lib'
import * as WrenKit from './designs/wren-lib'
import { B1 as SAFFRA } from './designs/saffra-d03-props'
import { D03 as HASK } from './designs/hask-d03'
import { D07 as BRANNOCH } from './designs/brannoch-d07'
import { D04_A_FINAL as ODILE } from './designs/odile-d04-a-final'
import { D09_E_SMOCK_FINAL as WREN } from './designs/wren-d09-E-smock-final'

/** One frame: the design canvas (100 × 100), straight RGBA. */
export interface FinalFrame {
  w: number
  h: number
  data: Uint8ClampedArray
}

export interface LiaisonFinal {
  persona: PersonaId
  company: CompanyId
  /** Who and which final, for the cards. */
  title: string
  /** Each frame of the idle, then the tic, by the design's own kit. */
  idle: () => FinalFrame[]
  tic: () => FinalFrame[]
  idleMs: readonly number[]
  ticMs: readonly number[]
  /** One part alone, in the still (to measure where the face, the feet and the shadow are). */
  part: (id: string) => FinalFrame
  /** The parts the measures read: the face (the bubble's tail and the receipt's cameo), the feet, the ground shadow. */
  face: string
  feet: readonly string[]
  /** The head mass (hat, pot, pad, dome …): what the receipt's cameo frames. */
  head: readonly string[]
}

type Kit = { render: (d: never, f?: never) => FinalFrame }
type AnyDesign = { parts: readonly { id: string; group: string }[]; idle: readonly unknown[]; tic: readonly unknown[]; idleMs: readonly number[]; ticMs: readonly number[] }

function final(persona: PersonaId, company: CompanyId, title: string, kit: Kit, d: AnyDesign, face: string, feet: string[]): LiaisonFinal {
  const r = kit.render as unknown as (d: AnyDesign, f?: unknown) => FinalFrame
  return {
    persona,
    company,
    title,
    idle: () => d.idle.map((f) => r(d, f)),
    tic: () => d.tic.map((f) => r(d, f)),
    idleMs: d.idleMs,
    ticMs: d.ticMs,
    part: (id) => r({ ...d, parts: d.parts.filter((p) => p.id === id) }, d.idle[0]),
    face,
    feet,
    head: d.parts.filter((p) => p.group === 'head').map((p) => p.id),
  }
}

export const LIAISON_FINALS: Readonly<Record<PersonaId, LiaisonFinal>> = {
  saffra: final('saffra', 'spice', 'Saffra, the Field Burner (d03, her own body, the Ember Pot)', SaffraKit, SAFFRA, 'mask', ['boots']),
  hask: final('hask', 'art', 'Hask, the Salt-Barge Poleman (d03, the hat centred)', HaskKit, HASK, 'snout', ['feet']),
  brannoch: final('brannoch', 'metals', 'Brannoch, the Mason Guild Elder (d07, his boots)', BrannochKit, BRANNOCH, 'nose', ['bootB', 'bootF']),
  odile: final('odile', 'silk', 'Odile, the Ford Toll-Keeper (d04-A, final)', OdileKit, ODILE, 'face', ['boots']),
  wren: final('wren', 'scrolls', 'Wren, the Flowerpot Potter (d09-E, the smock, final)', WrenKit, WREN, 'nose', ['boots']),
}

/** The bounding box of a frame's opaque pixels. */
export function boxOf(f: FinalFrame): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = f.w, y0 = f.h, x1 = -1, y1 = -1
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++)
      if (f.data[(y * f.w + x) * 4 + 3]) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  return { x0, y0, x1, y1 }
}

/** Where a liaison stands and looks, in the design canvas: measured off the still's own pixels. */
export interface FinalMeasure {
  /** The ground shadow's centre: where the figure is placed on its post. */
  cx: number
  /** The row under the boots (the feet line). */
  feet: number
  /** The face's centre (the bubble's tail points here). */
  face: [number, number]
  /** The head mass's box (hat to chin). */
  head: { x0: number; y0: number; x1: number; y1: number }
}

export function measureFinal(l: LiaisonFinal): FinalMeasure {
  const sh = boxOf(l.part('shadow'))
  const feet = Math.max(...l.feet.map((id) => boxOf(l.part(id)).y1)) + 1
  const fb = boxOf(l.part(l.face))
  const hb = l.head.map((id) => boxOf(l.part(id))).filter((b) => b.x1 >= 0)
  return {
    cx: Math.round((sh.x0 + sh.x1 + 1) / 2),
    feet,
    face: [Math.round((fb.x0 + fb.x1 + 1) / 2), Math.round((fb.y0 + fb.y1 + 1) / 2)],
    head: { x0: Math.min(...hb.map((b) => b.x0)), y0: Math.min(...hb.map((b) => b.y0)), x1: Math.max(...hb.map((b) => b.x1)), y1: Math.max(...hb.map((b) => b.y1)) },
  }
}
