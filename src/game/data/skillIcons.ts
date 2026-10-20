import type { IconKey } from './iconAtlas'
import { INFUSIONS, type InfusionTag } from './infusions'
import { MOTIFS, SKILL_ART, SKILL_PALETTE, skillArtKey, TAG_RAMP, INK, type Ramp, type SkillArt } from './skillArt'
import { NAMED_ART } from './skillArtNamed'
import { isCardId, isNamedId, mergedById, namedById } from './skills'

/**
 * ---------------------------------------------------------------------------
 * The skill-icon composer (Oct 2026) — (base drawing, infusion) → 16 × 16
 * ---------------------------------------------------------------------------
 *
 * Every skill's picture is composed here, from the layers in `skillArt.ts`
 * (the library) and `skillArtNamed.ts` (the twenty named merges). Pure and
 * deterministic: no canvas, no DOM, no clock, no RNG — the same id gives the
 * same 1,024 bytes everywhere, which is what lets the atlas BAKE the 70 fixed
 * pictures from it (`scripts/fw-icons.ts`, checked by `fw-icons:check`) and
 * the UI COMPOSE the 2,437 plain merges at runtime from the very same code
 * (`ui/SkillIcon.tsx`, one memoised canvas each, drawn only when shown).
 *
 * How a plain merge is made (the Stardew layering, `character-design` § 4c):
 *
 *  1. **The base's drawing**, so its silhouette leads: the root library
 *     skill's (`mx.arc_spark.frostbite` is Arc Spark's bolt), or a named
 *     base's own (`mx.fz_rimecut.anchor` is Rimecut's blade).
 *  2. **A key-colour swap.** The drawing's key pixels (its element: the bolt)
 *     take the FIRST infusion's ramp instead of the base's own — Arc Spark's
 *     bolt goes ice-blue. A named base keeps its own colours.
 *  3. **Frost's rime**, when frost is poured in: every top edge goes white.
 *  4. **The navy ink**, 1 px round every filled pixel (`fw-icons.ts` outline).
 *  5. **Each infusion's motif**, in order, on its fixed corner or edge, ringed
 *     in the same ink (`skillArt.MOTIFS`).
 *
 * So A onto B is B's drawing in A's colour with A's motif, and B onto A the
 * other way round: a different silhouette AND a different motif
 * (`tests/skillIcons.test.ts` holds all 2,437 to it). A named merge is its own
 * drawing with the named marker — gold brackets on its bottom corners, one
 * for tier 1, two longer ones for a greater merge — which no plain merge
 * carries.
 */

export const ICON_N = 16

/** RGBA, 16 × 16, row-major. */
export type IconPixels = Uint8ClampedArray

/** The fixed parts of a picture, before the ink: one hex (or null) per pixel. */
type Grid = (string | null)[]

const hexRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

/** A drawing's pixels through a ramp: the keys `1`/`2`/`3` take it, every letter its fixed colour. */
function paint(art: SkillArt, ramp: Ramp): Grid {
  const g: Grid = new Array(ICON_N * ICON_N).fill(null)
  for (let y = 0; y < ICON_N; y++)
    for (let x = 0; x < ICON_N; x++) {
      const c = art[y][x]
      if (c === '.') continue
      g[y * ICON_N + x] = c === '1' || c === '2' || c === '3' ? ramp[Number(c) - 1] : SKILL_PALETTE[c]
    }
  return g
}

const filled = (g: Grid, x: number, y: number) => x >= 0 && y >= 0 && x < ICON_N && y < ICON_N && g[y * ICON_N + x] != null

/** Frost's rime: every pixel with nothing above it frosts white. */
function rime(g: Grid): Grid {
  const out = g.slice()
  for (let y = 0; y < ICON_N; y++)
    for (let x = 0; x < ICON_N; x++) if (filled(g, x, y) && !filled(g, x, y - 1)) out[y * ICON_N + x] = SKILL_PALETTE.W
  return out
}

/** The pack's ink, 1 px round every filled pixel (4-adjacent), exactly as `fw-icons.ts` rings the atlas. */
function ink(g: Grid): Grid {
  const out = g.slice()
  for (let y = 0; y < ICON_N; y++)
    for (let x = 0; x < ICON_N; x++) {
      if (filled(g, x, y)) continue
      if (filled(g, x - 1, y) || filled(g, x + 1, y) || filled(g, x, y - 1) || filled(g, x, y + 1)) out[y * ICON_N + x] = INK
    }
  return out
}

/** A motif's own pixels in its tag's ramp, at its fixed place (absolute coordinates). */
function motifPixels(tag: InfusionTag): { x: number; y: number; hex: string }[] {
  const m = MOTIFS[tag]
  const ramp = TAG_RAMP[tag]
  const out: { x: number; y: number; hex: string }[] = []
  m.art.forEach((row, dy) =>
    [...row].forEach((c, dx) => {
      if (c === '.') return
      out.push({ x: m.at[0] + dx, y: m.at[1] + dy, hex: c === '1' || c === '2' || c === '3' ? ramp[Number(c) - 1] : SKILL_PALETTE[c] })
    }),
  )
  return out
}

/** Stamp a motif over an inked picture: its ink ring first, then its pixels (a layer on the grid). */
function stamp(g: Grid, tag: InfusionTag): Grid {
  const px = motifPixels(tag)
  if (!px.length) return g
  const out = g.slice()
  const own = new Set(px.map((p) => p.y * ICON_N + p.x))
  for (const p of px)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = p.x + dx
      const y = p.y + dy
      if (x < 0 || y < 0 || x >= ICON_N || y >= ICON_N) continue
      const i = y * ICON_N + x
      if (!own.has(i)) out[i] = INK
    }
  for (const p of px) out[p.y * ICON_N + p.x] = p.hex
  return out
}

/**
 * The named marker: gold corner brackets on the cell's bottom edge — a tier-1
 * merge's in the bottom-right corner, a greater merge's longer and in both
 * bottom corners, like a gilt base plate. On the bottom because every tile
 * that shows a skill keeps its top corners for its own badges (the Codex's
 * level badge sits over the top-left, the company crest over the top-right).
 */
const MARK_GOLD = '#ffed44'
const MARK_DEEP = '#d08c41'
function mark(g: Grid, tier: 1 | 2): Grid {
  const out = g.slice()
  const e = ICON_N - 1
  const put = (x: number, y: number, hex: string) => (out[y * ICON_N + x] = hex)
  const bracket = (x: number, dx: number, long: boolean) => {
    put(x, e, MARK_GOLD)
    put(x + dx, e, MARK_GOLD)
    put(x, e - 1, MARK_DEEP)
    if (long) {
      put(x + 2 * dx, e, MARK_DEEP)
      put(x, e - 2, MARK_DEEP)
    }
  }
  bracket(e, -1, tier === 2)
  if (tier === 2) bracket(0, 1, true)
  return out
}

function toRgba(g: Grid): IconPixels {
  const out = new Uint8ClampedArray(ICON_N * ICON_N * 4)
  g.forEach((hex, i) => {
    if (!hex) return
    const [r, gr, b] = hexRgb(hex)
    out[i * 4] = r
    out[i * 4 + 1] = gr
    out[i * 4 + 2] = b
    out[i * 4 + 3] = 255
  })
  return out
}

/**
 * A picture's recipe: the drawing, its ramp, the motifs on it and the named
 * marker — what `composeRecipe` paints and the fuse beat animates (the base's
 * own colours, then the swap, then the motif landing).
 */
export interface IconRecipe {
  art: SkillArt
  /** The ramp the drawing's keys take. */
  ramp: Ramp
  /** The base's own ramp (before the infusion's swap): what the beat starts from. */
  ownRamp: Ramp
  /** The infusions' tags, in the order they were poured in (each stamps its motif; frost also rimes). */
  motifs: readonly InfusionTag[]
  /** A named merge's marker tier, if it is one. */
  named?: 1 | 2
}

const tagOf = (cardId: string): InfusionTag | undefined => INFUSIONS[cardId]?.tag

/** The recipe of any skill a hero may hold, or null for an id this build cannot read. */
export function iconRecipe(id: string): IconRecipe | null {
  if (isCardId(id)) {
    const art = SKILL_ART[id]
    const tag = tagOf(id)
    if (!art || !tag) return null
    return { art, ramp: TAG_RAMP[tag], ownRamp: TAG_RAMP[tag], motifs: [] }
  }
  if (isNamedId(id)) {
    const f = namedById(id)
    const a = NAMED_ART[id]
    if (!f || !a) return null
    return { art: a.art, ramp: TAG_RAMP[a.ramp], ownRamp: TAG_RAMP[a.ramp], motifs: [], named: f.tier }
  }
  const m = mergedById(id)
  if (!m) return null
  const [baseId, cardId] = m.parts
  const base = iconRecipe(baseId)
  const tag = tagOf(cardId)
  if (!base || !tag) return null
  // A named base keeps its own colours and loses its marker (this is not it any more);
  // a library base takes the first infusion's ramp, and a deeper one keeps that.
  const swaps = isCardId(baseId)
  return {
    art: base.art,
    ramp: swaps ? TAG_RAMP[tag] : base.ramp,
    ownRamp: base.ownRamp,
    motifs: [...base.motifs, tag],
  }
}

/** Paint a recipe (optionally only some of its layers — the fuse beat's frames). */
export function composeRecipe(r: IconRecipe, opts: { ramp?: Ramp; motifs?: readonly InfusionTag[] } = {}): IconPixels {
  const motifs = opts.motifs ?? r.motifs
  let g = paint(r.art, opts.ramp ?? r.ramp)
  if (motifs.includes('frost')) g = rime(g)
  g = ink(g)
  for (const t of motifs) g = stamp(g, t)
  if (r.named) g = mark(g, r.named)
  return toRgba(g)
}

const MEMO = new Map<string, IconPixels | null>()

/** A skill's picture (library, named or plain merge), memoised; null for an unknown id. */
export function skillIconPixels(id: string): IconPixels | null {
  if (!MEMO.has(id)) {
    const r = iconRecipe(id)
    MEMO.set(id, r ? composeRecipe(r) : null)
  }
  return MEMO.get(id)!
}

/** Whether a skill's picture is a baked atlas cell (a library card or a named merge) rather than composed. */
export const isBakedSkill = (id: string): boolean => isCardId(id) || isNamedId(id)

/**
 * The atlas cell nearest a skill's picture: its own for a library card or a
 * named merge; for a plain merge, its base's drawing in the base's colours
 * (the fallback where a picture must be one atlas cell — a text line, or no
 * canvas). Every value is in `ICON_ORDER` (`tests/skillIcons.test.ts`).
 */
export function skillIconKey(id: string): IconKey {
  if (isBakedSkill(id)) return skillArtKey(id) as IconKey
  const m = mergedById(id)
  return m ? skillIconKey(m.parts[0]) : 'boon'
}

/**
 * The fuse beat's layers (`ui/shell/FuseBeat.tsx`): how a merge's picture is
 * made, as three pictures that animate into it.
 *
 *  - `from`: the base as the player held it (its picture before the drop);
 *  - `to`: what the base becomes — for a plain merge the base's drawing with
 *    the infusion's colours swapped in (and the rime) but not yet its motif;
 *    for a named merge, the named picture itself;
 *  - `fly`: what flies onto it — for a plain merge the motif alone (exactly
 *    the pixels the motif changes, so `to` with `fly` over it IS the merge's
 *    picture, pixel for pixel); for a named merge, the card's own picture.
 */
export interface MergeLayers {
  from: IconPixels
  to: IconPixels
  fly: IconPixels
  named: boolean
}

export function mergeLayers(id: string): MergeLayers | null {
  const m = mergedById(id)
  const r = iconRecipe(id)
  const result = skillIconPixels(id)
  if (!m || !r || !result) return null
  const from = skillIconPixels(m.parts[0])
  if (!from) return null
  if (r.named) {
    const card = skillIconPixels(m.parts[1])
    return card ? { from, to: result, fly: card, named: true } : null
  }
  const to = composeRecipe(r, { motifs: r.motifs.slice(0, -1) })
  const fly = new Uint8ClampedArray(result.length)
  for (let i = 0; i < result.length; i += 4) {
    if (result[i] === to[i] && result[i + 1] === to[i + 1] && result[i + 2] === to[i + 2] && result[i + 3] === to[i + 3]) continue
    fly.set(result.subarray(i, i + 4), i)
  }
  return { from, to, fly, named: false }
}
