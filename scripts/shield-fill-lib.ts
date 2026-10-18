/**
 * The knight's body under its shield — rebuilt, frame by frame, at build time.
 *
 * The armoured Tiny Swords look paints a shield on its left arm, and the
 * shield covers part of the knight: the lower-left of the helmet, the side of
 * the tunic and its outline, the near arm, sometimes a leg and a bite of the
 * ground shadow. `gearMarks.cutOffHand` cuts the shield away whenever the hero
 * holds anything else in the off hand (or nothing); what it leaves is a HOLE
 * in the body — a knight sliced down one side. This rebuilds what the shield
 * hid, in the knight's own pixels, so the figure reads as the same knight with
 * the shield simply gone, whatever the off hand holds.
 *
 * It is a reflection, part by part, because the figure is near-symmetric
 * about the line through its helmet (the body faces the viewer; only the
 * visor and the sword arm break it):
 *
 *  - the AXIS of each frame is the median middle of the helmet's rows that
 *    the shield never touched;
 *  - the HELMET's hidden lower-left takes its extent from the mirror of its
 *    right edge, row by row, and its colours from its own left edge in the
 *    nearest untouched row (the brown shade band down the back of the head,
 *    not the lit cream of the face side), with that row's ink outline;
 *  - the TUNIC's hidden side is the mirror of its right side (shading,
 *    shoulder and sleeve) and of the outline beyond it;
 *  - the NEAR HAND is the mirror of the sword hand where that hand rests at
 *    the hip (the idle strip). Where the sword hand is up or out (the attack
 *    strip), the near hand is the idle one, mirrored, hung at the same place
 *    against this frame's rebuilt hem;
 *  - a LEG the shield hid (one leg showing where the frame has two) is the
 *    mirror of the one that shows;
 *  - the GROUND SHADOW's bite is closed by the mirror of its right half.
 *
 * Then the outline is closed (every new painted pixel that faces empty space
 * gets the pack's ink) and any ink the cut kept that now edges nothing goes.
 *
 * It only ever writes where the cut left the frame transparent or
 * translucent, or over an ink pixel the cut kept along its edge (that edge is
 * inside the knight now). Every other pixel of the art is untouched.
 *
 * `scripts/anchors.ts` runs it over the CC0 strips and writes the difference
 * as a per-frame patch (`shieldFill.generated.ts`); `anchors:check` fails if
 * the patch is stale or if a rebuilt frame has a hole, an open outline, a
 * stray island or a write outside that rule ({@link fillProblems}). The game
 * applies the patch after the cut (`gearMarks.unpaintedStrip`).
 */
import { cutAndFill, FILL_CODES, type StripFill } from '../src/game/render/gearMarks'
import { TUNIC_DARK, TUNIC_MID } from '../src/game/render/bodyLayer'
import { measureTorsos } from './anchors-lib'

/** RGBA strip pixels. */
type Px = Uint8Array

const INK = [22, 28, 46] as const
/** The colours the helmet (and the bare hands) are painted in: tan, its brown shade, cream, white, pale. */
const SKIN = new Set([0xd5b583, 0x977b6b, 0xefe1ab, 0xffffff, 0xede6ac])
const TUNIC = new Set([TUNIC_MID, TUNIC_DARK])

/** One frame as packed colours (`0xRRGGBBAA`), frame-local. */
class Frame {
  readonly c: Uint32Array
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.c = new Uint32Array(w * h)
  }
  static read(d: Px, sw: number, h: number, fx: number, cw: number): Frame {
    const f = new Frame(cw, h)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < cw; x++) {
        const o = (y * sw + fx + x) * 4
        f.c[y * cw + x] = ((d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]) >>> 0
      }
    return f
  }
  clone(): Frame {
    const f = new Frame(this.w, this.h)
    f.c.set(this.c)
    return f
  }
  in(x: number, y: number): boolean {
    return x >= 0 && x < this.w && y >= 0 && y < this.h
  }
  get(x: number, y: number): number {
    return this.in(x, y) ? this.c[y * this.w + x] : 0
  }
  set(x: number, y: number, v: number): void {
    if (this.in(x, y)) this.c[y * this.w + x] = v >>> 0
  }
  alpha(x: number, y: number): number {
    return this.get(x, y) & 255
  }
  opaque(x: number, y: number): boolean {
    return this.alpha(x, y) >= 128
  }
  rgb(x: number, y: number): number {
    return this.get(x, y) >>> 8
  }
  ink(x: number, y: number): boolean {
    return this.opaque(x, y) && isInkRgb(this.rgb(x, y))
  }
  skin(x: number, y: number): boolean {
    return this.opaque(x, y) && SKIN.has(this.rgb(x, y))
  }
  tunic(x: number, y: number): boolean {
    return this.opaque(x, y) && TUNIC.has(this.rgb(x, y))
  }
  /** Opaque and not outline: a painted pixel. */
  paint(x: number, y: number): boolean {
    return this.opaque(x, y) && !isInkRgb(this.rgb(x, y))
  }
}

const isInkRgb = (rgb: number): boolean => {
  const r = rgb >>> 16
  const g = (rgb >>> 8) & 255
  const b = rgb & 255
  return Math.abs(r - INK[0]) <= 2 && Math.abs(g - INK[1]) <= 2 && Math.abs(b - INK[2]) <= 2
}
const INK_PX = ((INK[0] << 24) | (INK[1] << 16) | (INK[2] << 8) | 255) >>> 0
const TUNIC_DARK_PX = ((TUNIC_DARK << 8) | 255) >>> 0

type Pt = [number, number]
const N4: Pt[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]
const N8: Pt[] = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]]

/** 4-connected components of pixels passing `ok`, as pixel-index lists. */
function components(f: Frame, ok: (x: number, y: number) => boolean): number[][] {
  const seen = new Uint8Array(f.w * f.h)
  const out: number[][] = []
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++) {
      const p = y * f.w + x
      if (seen[p] || !ok(x, y)) continue
      const comp: number[] = []
      const stack = [p]
      seen[p] = 1
      while (stack.length) {
        const q = stack.pop()!
        comp.push(q)
        const qx = q % f.w
        const qy = (q - qx) / f.w
        for (const [dx, dy] of N4) {
          const X = qx + dx
          const Y = qy + dy
          if (!f.in(X, Y)) continue
          const r = Y * f.w + X
          if (seen[r] || !ok(X, Y)) continue
          seen[r] = 1
          stack.push(r)
        }
      }
      out.push(comp)
    }
  return out
}

/** Row extents of a pixel list: y → [min x, max x]. */
function rows(list: Iterable<number>, w: number): Map<number, [number, number]> {
  const m = new Map<number, [number, number]>()
  for (const p of list) {
    const x = p % w
    const y = (p - x) / w
    const r = m.get(y)
    if (!r) m.set(y, [x, x])
    else {
      r[0] = Math.min(r[0], x)
      r[1] = Math.max(r[1], x)
    }
  }
  return m
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : NaN
}

/** A hand, mirrored to the near side: its pixels in its own box (0,0 top-left), packed colours. */
interface HandArt {
  px: { x: number; y: number; c: number }[]
  w: number
  h: number
}

/** What one frame's rebuild measured (for the tests and the review log). */
export interface FillInfo {
  /** The mirror line, in the cell's px. */
  axis: number
  helmet: number
  tunic: number
  hand: 'mirror' | 'template' | 'none'
  leg: boolean
  shadow: number
}

const BROWN = 0x977b6b

/**
 * Rebuild one frame. `orig` is the frame as painted, `cut` the same frame after
 * `cutOffHand`, `tunicSpans` the tunic measured on the cut frame. Returns the
 * rebuilt frame, what it did, and the frame's own near hand (the idle strip's
 * is the attack strip's template).
 */
function fillFrame(orig: Frame, cut: Frame, tunicSpans: readonly number[], template: HandArt | null): { out: Frame; info: FillInfo; hand: HandArt | null } {
  const { w, h } = cut
  const hole = (x: number, y: number) => orig.opaque(x, y) && cut.alpha(x, y) === 0
  const nearHole = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (hole(x + dx, y + dy)) return true
    return false
  }
  const writable = writableIn(orig, cut)
  const out = cut.clone()
  /** Body pixels the rebuild painted (paint or ink). */
  const claimed = new Set<number>()
  const put = (x: number, y: number, c: number) => {
    if (!writable(x, y)) return false
    out.set(x, y, c)
    claimed.add(y * w + x)
    return true
  }

  // ---- the parts: the tunic (measured on the CUT frame) and the helmet over it.
  const tunic = new Set<number>()
  for (let i = 0; i + 2 < tunicSpans.length; i += 3) for (let x = tunicSpans[i + 1]; x <= tunicSpans[i + 2]; x++) tunic.add(tunicSpans[i] * w + x)
  const tRows = rows(tunic, w)
  const ty0 = Math.min(...tRows.keys())
  const ty1 = Math.max(...tRows.keys())
  let tx0 = Infinity
  let tx1 = -Infinity
  for (const [, [a, b]] of tRows) {
    tx0 = Math.min(tx0, a)
    tx1 = Math.max(tx1, b)
  }
  const skins = components(cut, (x, y) => cut.skin(x, y))
  const scoreHelmet = (comp: number[]) => {
    let n = 0
    for (const p of comp) {
      const x = p % w
      const y = (p - x) / w
      if (y >= ty0 - 10 && y < ty0 + 2 && x >= tx0 && x <= tx1) n++
    }
    return n
  }
  const helmet = skins.reduce((a, b) => (scoreHelmet(b) > scoreHelmet(a) ? b : a))
  const helmetSet = new Set(helmet)
  const hRows = rows(helmet, w)
  const holeLeftOf = (y: number, x: number) => {
    for (let X = 0; X < x; X++) if (hole(X, y)) return true
    return false
  }
  const clean = [...hRows.entries()].filter(([y, [l]]) => !holeLeftOf(y - 1, l) && !holeLeftOf(y, l) && !holeLeftOf(y + 1, l))
  const axisX2 = median(clean.map(([, [l, r]]) => l + r)) // twice the axis: x mirrors to axisX2 − x
  const mirror = (x: number) => axisX2 - x

  // The helmet's rebuilt left edge, row by row: the mirror of its right edge.
  const helmetLeft = new Map<number, number>()
  for (const [y, [l, r]] of hRows) if (holeLeftOf(y, l)) helmetLeft.set(y, Math.min(l, mirror(r)))
  let headSide = Infinity
  for (const [y, [l]] of hRows) headSide = Math.min(headSide, helmetLeft.get(y) ?? l)

  // ---- 1 · the tunic's hidden side. It runs down under the helmet's side (3 px
  // in, as the idle knight's does) and curves as its right side curves; its
  // colours are its right side's, edge for edge, and so is its outline.
  let tunicN = 0
  let Rmax = -Infinity
  for (const [, [, r]] of tRows) Rmax = Math.max(Rmax, r)
  const tunicLeft = new Map<number, number>()
  for (const [y, [l, r]] of tRows) {
    if (!holeLeftOf(y, l + 1) && !nearHole(l - 1, y, 2)) continue
    const left = Math.min(l, headSide + 3 + (Rmax - r))
    tunicLeft.set(y, left)
    let ink = 0
    while (ink < 3 && cut.ink(r + 1 + ink, y)) ink++
    for (let x = left - Math.max(ink, 2); x < left; x++) put(x, y, INK_PX)
    for (let x = left; x < l; x++) {
      let c = 0
      for (let s = r - (x - left); !c && s >= l; s--) if (cut.tunic(s, y)) c = cut.get(s, y)
      if (put(x, y, c || TUNIC_DARK_PX)) tunicN++
    }
  }
  let sideX = Infinity
  for (const [y, [l]] of tRows) sideX = Math.min(sideX, tunicLeft.get(y) ?? l)

  // ---- 2 · the near hand: the sword hand mirrored, where it rests at the hip.
  const handComp = skins
    .filter((c) => c !== helmet && c.length >= 12 && c.length <= 200)
    .find((c) => {
      const r = rows(c, w)
      const ys = [...r.keys()]
      const x0 = Math.min(...[...r.values()].map((v) => v[0]))
      return Math.min(...ys) >= ty0 && Math.max(...ys) <= ty1 + 4 && x0 >= tx1 - 6 && x0 <= tx1 + 8
    })
  let hand: HandArt | null = null
  let handAt: Pt | null = null
  if (handComp) {
    // the hand and its ink ring, mirrored
    const seen = new Set<number>(handComp)
    const abs: { x: number; y: number; c: number }[] = []
    for (const p of handComp) {
      const x = p % w
      const y = (p - x) / w
      abs.push({ x: mirror(x), y, c: cut.get(x, y) })
      for (const [dx, dy] of N8) {
        const q = (y + dy) * w + x + dx
        if (seen.has(q) || !cut.ink(x + dx, y + dy)) continue
        seen.add(q)
        abs.push({ x: mirror(x + dx), y: y + dy, c: INK_PX })
      }
    }
    const bx = Math.min(...abs.map((p) => p.x))
    const by = Math.min(...abs.map((p) => p.y))
    hand = { px: abs.map((p) => ({ x: p.x - bx, y: p.y - by, c: p.c })), w: Math.max(...abs.map((p) => p.x)) - bx + 1, h: Math.max(...abs.map((p) => p.y)) - by + 1 }
    handAt = [bx, by]
  }
  const art = hand ?? template
  if (art && !handAt) handAt = [sideX + 1 - art.w, ty1 + 2 - art.h] // a fist at the side, its foot at the hem
  if (art && handAt) {
    // Held against the body: nudge it in until it touches the rebuilt side.
    const touches = (ox: number) =>
      art.px.some(({ x, y }) => N4.some(([dx, dy]) => out.opaque(ox + x + dx, handAt![1] + y + dy) && !hole(ox + x + dx, handAt![1] + y + dy)))
    let ox = handAt[0]
    for (let i = 0; i < 12 && !touches(ox); i++) ox++
    for (const { x, y, c } of art.px) put(ox + x, handAt[1] + y, c)
  }

  // ---- 3 · the helmet's hidden lower-left, in front of the tunic and the hand.
  // Its colours are its own left edge's in the nearest untouched row: the brown
  // shade down the back of the head, then the tan. The shade the art painted
  // along the shield's edge is inside the head now, so it takes the tan.
  let helmetN = 0
  const ref = clean.length ? clean.reduce((a, b) => (b[0] > a[0] ? b : a)) : null // the lowest clean row
  if (ref) {
    const [ry, [rl]] = ref
    let refInk = 0
    while (refInk < 3 && cut.ink(rl - 1 - refInk, ry)) refInk++
    let band = 0
    while (cut.rgb(rl + band, ry) === BROWN && helmetSet.has(ry * w + rl + band)) band++
    const tan = cut.get(rl + band, ry)
    const shade = cut.get(rl, ry)
    for (const [y, [l]] of hRows) {
      const target = helmetLeft.get(y)
      if (target === undefined) continue
      // A row where the art shows the body beside the chin: the head ends above it.
      let body = false
      for (let x = target; x < l; x++) if (cut.paint(x, y)) body = true
      if (body) continue
      for (let x = target; x < l + 9; x++) {
        const c = x - target < band ? shade : tan
        if (x >= l && !(cut.rgb(x, y) === BROWN && helmetSet.has(y * w + x))) continue
        if (x >= l) {
          out.set(x, y, c)
          claimed.add(y * w + x)
        } else if (!put(x, y, c)) continue
        helmetN++
      }
      for (let x = target - refInk; x < target; x++) put(x, y, INK_PX)
    }
  }

  // ---- 4 · the near leg, where the shield hid it (all of it, or its side or top):
  // the far leg's mirror, added to what shows.
  let leg = false
  const legPx = new Set<number>()
  const feet = (() => {
    for (let y = h - 1; y > ty1; y--) for (let x = tx0; x <= tx1; x++) if (cut.opaque(x, y)) return y
    return ty1
  })()
  {
    const y = feet - 2
    const runs: [number, number][] = []
    for (let x = 0; x < w; x++) {
      if (!cut.ink(x, y)) continue
      if (runs.length && runs[runs.length - 1][1] === x - 1) runs[runs.length - 1][1] = x
      else runs.push([x, x])
    }
    const [hl, hr] = tRows.get(ty1)!
    const legs = runs.filter(([a, b]) => b >= hl - 8 && a <= hr + 6 && b - a <= 12)
    const far = legs[legs.length - 1]
    // The far leg, mirrored, wherever the shield stood over the near one.
    let hidden = false
    if (far) for (let yy = ty1 + 1; yy <= feet && !hidden; yy++) for (let x = mirror(far[1]) - 1; x <= mirror(far[0]) + 1; x++) if (hole(x, yy)) hidden = true
    if (far && hidden) {
      leg = true
      for (let yy = ty1 + 1; yy <= feet; yy++)
        for (let x = far[0] - 1; x <= far[1] + 1; x++)
          if (cut.ink(x, yy) && put(mirror(x), yy, cut.get(x, yy))) legPx.add(yy * w + mirror(x))
    }
  }

  // ---- 5 · close the outline: new paint facing empty space gets ink, and a
  // one- or two-px gap between new body and old is inked shut.
  for (const p of [...claimed]) {
    const x = p % w
    const y = (p - x) / w
    if (!out.paint(x, y)) continue
    for (const [dx, dy] of N4) if (!out.opaque(x + dx, y + dy)) put(x + dx, y + dy, INK_PX)
  }
  for (let pass = 0; pass < 2; pass++) {
    const gaps: Pt[] = []
    for (let y = 0; y <= ty1 + 1; y++)
      for (let x = 0; x < w; x++) {
        if (out.opaque(x, y) || !writable(x, y)) continue
        const by = (dx: number, dy: number) => {
          for (let k = 1; k <= 2; k++) if (out.opaque(x + dx * k, y + dy * k)) return true
          return false
        }
        let near = false
        for (const [dx, dy] of N8) if (claimed.has((y + dy) * w + x + dx)) near = true
        if (near && ((by(1, 0) && by(-1, 0)) || (by(0, 1) && by(0, -1)))) gaps.push([x, y])
      }
    for (const [x, y] of gaps) put(x, y, INK_PX)
  }

  // ---- 6 · ink the cut kept, or the rebuild laid, that now edges nothing: gone.
  for (let y = 0; y <= ty1 + 1; y++)
    for (let x = 0; x < w; x++) {
      if (!out.ink(x, y) || !writable(x, y) || legPx.has(y * w + x)) continue
      let near = false
      for (let dy = -3; dy <= 3 && !near; dy++) for (let dx = -3; dx <= 3 && !near; dx++) if (out.paint(x + dx, y + dy)) near = true
      if (!near) {
        out.set(x, y, 0)
        claimed.delete(y * w + x)
      }
    }

  // ---- 7 · the ground shadow's bite: the mirror of its right half, wherever
  // the art had paint and the rebuilt frame has none.
  let shadowN = 0
  let shadowPx = 0
  for (let i = 0; i < cut.c.length && !shadowPx; i++) {
    const a = cut.c[i] & 255
    if (a > 0 && a < 128) shadowPx = cut.c[i]
  }
  // Its own axis: the middle of its lowest row (the far rim, which nothing stands on).
  let sAxis2 = NaN
  for (let y = h - 1; y > ty1 && Number.isNaN(sAxis2); y--) {
    let a = -1
    let b = -1
    for (let x = 0; x < w; x++)
      if (cut.c[y * w + x] === shadowPx) {
        if (a < 0) a = x
        b = x
      }
    if (a >= 0) sAxis2 = a + b
  }
  if (shadowPx && !Number.isNaN(sAxis2))
    for (let y = ty1; y < h; y++) {
      let rs = -1
      for (let x = w - 1; x >= 0 && rs < 0; x--) if (cut.c[y * w + x] === shadowPx) rs = x
      if (rs < 0) continue
      for (let x = Math.max(0, sAxis2 - rs); x < rs; x++) {
        if (out.alpha(x, y) !== 0 || !orig.opaque(x, y)) continue
        out.set(x, y, shadowPx)
        shadowN++
      }
    }

  return { out, info: { axis: axisX2 / 2, helmet: helmetN, tunic: tunicN, hand: hand ? 'mirror' : art ? 'template' : 'none', leg, shadow: shadowN }, hand }
}

/**
 * Where the rebuild may write in a frame: wherever the cut left it
 * transparent or translucent, and over the ink the cut kept along its edge
 * (within 6 px of the hole — that edge is inside the knight now). The
 * helmet's shade band along the shield's edge is also repainted (step 3);
 * {@link fillProblems} allows that one too: brown helmet pixels within 8 px.
 */
function writableIn(orig: Frame, cut: Frame): (x: number, y: number) => boolean {
  const hole = (x: number, y: number) => orig.opaque(x, y) && cut.alpha(x, y) === 0
  const memo = new Map<number, boolean>()
  return (x, y) => {
    if (!cut.in(x, y)) return false
    if (!cut.opaque(x, y)) return true
    if (!cut.ink(x, y)) return false
    const k = y * cut.w + x
    let v = memo.get(k)
    if (v === undefined) {
      v = false
      for (let dy = -6; dy <= 6 && !v; dy++) for (let dx = -6; dx <= 6 && !v; dx++) if (hole(x + dx, y + dy)) v = true
      memo.set(k, v)
    }
    return v
  }
}

/** The knight strips whose painted shield is cut, per pack, idle first (its sword hand is the attack strip's template). */
export const SHIELD_STRIPS: Readonly<Record<string, readonly string[]>> = {
  tinyswords: ['fighter_idle', 'fighter_atk'],
}

/** One strip as read off disk. */
export interface RawStrip {
  name: string
  data: Px
  w: number
  h: number
  frames: number
}

/** A strip's rebuild: the patch the game applies, and what each frame measured. */
export interface StripRebuild {
  fill: StripFill
  info: FillInfo[]
}

/**
 * Rebuild every frame of a pack's knight strips (idle first). Each frame's
 * patch is the difference between the cut frame and the rebuilt one.
 */
export function shieldFills(strips: readonly RawStrip[]): Record<string, StripRebuild> {
  const out: Record<string, StripRebuild> = {}
  let template: HandArt | null = null
  for (const s of strips) {
    const cut = new Uint8Array(s.data)
    cutAndFill(cut, s.w, s.h, s.frames, null)
    const { torsos } = measureTorsos(cut, s.w, s.h, s.frames)
    const cw = Math.round(s.w / s.frames)
    const palette: number[] = []
    const frames: (number | string)[][] = []
    const info: FillInfo[] = []
    for (let f = 0; f < s.frames; f++) {
      const fw = Math.min(cw, s.w - f * cw)
      const o = Frame.read(s.data, s.w, s.h, f * cw, fw)
      const c = Frame.read(cut, s.w, s.h, f * cw, fw)
      const r = fillFrame(o, c, torsos[f].spans, template)
      if (!template && r.hand) template = r.hand
      info.push(r.info)
      frames.push(diff(c, r.out, palette))
    }
    out[s.name] = { fill: { w: s.w, h: s.h, palette, frames }, info }
  }
  return out
}

/** The runs `y, x, codes` where `b` differs from `a`, with colours indexed into `palette` (grown as needed). */
function diff(a: Frame, b: Frame, palette: number[]): (number | string)[] {
  const runs: (number | string)[] = []
  const code = (c: number) => {
    let i = palette.indexOf(c)
    if (i < 0) {
      i = palette.length
      palette.push(c)
      if (i >= FILL_CODES.length) throw new Error('shield fill: palette overflow')
    }
    return FILL_CODES[i]
  }
  for (let y = 0; y < a.h; y++) {
    let x = 0
    while (x < a.w) {
      if (a.c[y * a.w + x] === b.c[y * a.w + x]) {
        x++
        continue
      }
      const x0 = x
      let codes = ''
      while (x < a.w && a.c[y * a.w + x] !== b.c[y * a.w + x]) codes += code(b.c[y * a.w + x++])
      runs.push(y, x0, codes)
    }
  }
  return runs
}

/**
 * What is wrong with a strip's rebuilt frames — empty when the rebuild is
 * sound. Run by `anchors:check` on the patch the game ships, and by the tests:
 *
 *  - every write is where the rebuild may write (the cut's empty and shadow
 *    pixels, its kept edge ink, the helmet's shade along the cut);
 *  - no HOLE: no transparent pixel the outside cannot reach;
 *  - the outline is CLOSED: no painted pixel written or bordered by the patch
 *    faces empty space without ink between;
 *  - no STRAY island: every opaque piece of the frame holds a pixel of the art;
 *  - only the knight's own colours.
 */
export function fillProblems(name: string, s: RawStrip, fill: StripFill): string[] {
  const problems: string[] = []
  const cut = new Uint8Array(s.data)
  cutAndFill(cut, s.w, s.h, s.frames, null)
  const bare = new Uint8Array(s.data)
  cutAndFill(bare, s.w, s.h, s.frames, fill)
  const cw = Math.round(s.w / s.frames)
  for (let f = 0; f < s.frames; f++) {
    const fw = Math.min(cw, s.w - f * cw)
    const o = Frame.read(s.data, s.w, s.h, f * cw, fw)
    const c = Frame.read(cut, s.w, s.h, f * cw, fw)
    const b = Frame.read(bare, s.w, s.h, f * cw, fw)
    const at = `${name} frame ${f}`
    const hole = (x: number, y: number) => o.opaque(x, y) && c.alpha(x, y) === 0
    const near = (x: number, y: number, r: number) => {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (hole(x + dx, y + dy)) return true
      return false
    }
    const colours = new Set<number>()
    for (let i = 0; i < c.c.length; i++) if (c.c[i] & 255) colours.add(c.c[i])
    let bad = 0
    let foreign = 0
    const written = new Set<number>()
    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < fw; x++) {
        const i = y * fw + x
        if (b.c[i] === c.c[i]) continue
        written.add(i)
        const ok = !c.opaque(x, y) || (c.ink(x, y) && near(x, y, 6)) || (c.rgb(x, y) === BROWN && near(x, y, 10))
        if (!ok) bad++
        if (b.c[i] & 255 && !colours.has(b.c[i])) foreign++
      }
    if (bad) problems.push(`${at}: ${bad} px written over the art the cut kept`)
    if (foreign) problems.push(`${at}: ${foreign} px in a colour the knight does not wear`)
    if (!written.size) problems.push(`${at}: nothing rebuilt`)
    // A hole: transparent, unreachable from the frame's edge through non-opaque px
    // (the art's own pockets — a curl of the plume — are the art's, so they are not counted).
    const pocket = pockets(o)
    let holes = 0
    for (const i of pockets(b)) if (!pocket.has(i)) holes++
    if (holes) problems.push(`${at}: ${holes} px of hole inside the body`)
    // The outline: painted px the patch wrote, or next to one, that face empty space.
    const open = new Set<number>()
    for (const i of written) {
      const x = i % fw
      const y = (i - x) / fw
      for (const [dx, dy] of [[0, 0], ...N4]) {
        const X = x + dx
        const Y = y + dy
        if (b.paint(X, Y) && N4.some(([ex, ey]) => !b.opaque(X + ex, Y + ey))) open.add(Y * fw + X)
      }
    }
    if (open.size) problems.push(`${at}: the outline is open at ${open.size} px`)
    // Islands: every 8-connected opaque piece holds a px the patch did not write.
    const seen = new Uint8Array(fw * s.h)
    let islands = 0
    for (let i = 0; i < seen.length; i++) {
      const x0 = i % fw
      const y0 = (i - x0) / fw
      if (seen[i] || !b.opaque(x0, y0)) continue
      let art = false
      const st = [i]
      seen[i] = 1
      while (st.length) {
        const p = st.pop()!
        if (!written.has(p)) art = true
        const x = p % fw
        const y = (p - x) / fw
        for (const [dx, dy] of N8) {
          const X = x + dx
          const Y = y + dy
          if (!b.in(X, Y) || seen[Y * fw + X] || !b.opaque(X, Y)) continue
          seen[Y * fw + X] = 1
          st.push(Y * fw + X)
        }
      }
      if (!art) islands++
    }
    if (islands) problems.push(`${at}: ${islands} stray island(s) of rebuilt px`)
  }
  return problems
}

/** The transparent px of a frame the outside cannot reach (4-connected, through non-opaque px). */
function pockets(f: Frame): Set<number> {
  const outside = new Uint8Array(f.w * f.h)
  const stack: number[] = []
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++)
      if ((x === 0 || y === 0 || x === f.w - 1 || y === f.h - 1) && !f.opaque(x, y)) {
        outside[y * f.w + x] = 1
        stack.push(y * f.w + x)
      }
  while (stack.length) {
    const p = stack.pop()!
    const x = p % f.w
    const y = (p - x) / f.w
    for (const [dx, dy] of N4) {
      const X = x + dx
      const Y = y + dy
      if (!f.in(X, Y) || outside[Y * f.w + X] || f.opaque(X, Y)) continue
      outside[Y * f.w + X] = 1
      stack.push(Y * f.w + X)
    }
  }
  const out = new Set<number>()
  for (let i = 0; i < outside.length; i++) if (!outside[i] && !f.opaque(i % f.w, Math.floor(i / f.w))) out.add(i)
  return out
}

/** The generated patch module, keyed by pack. */
export function renderShieldFill(packs: Record<string, Record<string, StripFill>>): string {
  const hex = (c: number) => `0x${c.toString(16).padStart(8, '0')}`
  const frame = (runs: readonly (number | string)[]) => {
    const rows: string[] = []
    for (let i = 0; i < runs.length; i += 3) rows.push(`${runs[i]}, ${runs[i + 1]}, '${runs[i + 2]}'`)
    return `        [${rows.join(', ')}],`
  }
  const strip = (n: string, s: StripFill) =>
    `    ${JSON.stringify(n)}: {\n      w: ${s.w},\n      h: ${s.h},\n      palette: [${s.palette.map(hex).join(', ')}],\n      frames: [\n${s.frames.map(frame).join('\n')}\n      ],\n    },`
  const pack = (p: string) =>
    `  ${JSON.stringify(p)}: {\n${Object.keys(packs[p])
      .sort()
      .map((n) => strip(n, packs[p][n]))
      .join('\n')}\n  },`
  const names = Object.keys(packs).sort()
  const body = names.length ? `{\n${names.map(pack).join('\n')}\n}` : '{}'
  return `/**
 * GENERATED — do not edit by hand.
 *
 * Written by \`npm run anchors\` (\`scripts/shield-fill-lib.shieldFills\`): the
 * knight's body under its painted shield, rebuilt from the CC0 strips frame
 * by frame — what \`gearMarks.cutAndFill\` writes after the shield is cut.
 * Per frame, runs \`y, x, codes\` in the frame's own px, one \`palette\` index
 * per pixel (\`gearMarks.FILL_CODES\`). \`npm run anchors:check\` fails the
 * build if this file and the PNGs disagree, or if a rebuilt frame has a hole,
 * an open outline, a stray island or a write over the art.
 */
import type { ShieldFills } from './gearMarks'

export const SHIELD_FILL: ShieldFills = ${body}
`
}
