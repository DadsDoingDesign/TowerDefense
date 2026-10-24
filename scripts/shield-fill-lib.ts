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
 * The figure is drawn in 3/4 view facing right, so its left is its far,
 * receding side: nothing is mirrored across (round 1 did, and the head
 * swelled into a lopsided egg). Part by part, in the knight's own pixels:
 *
 *  - the HELMET's back goes on from its widest painted row above the shield
 *    in one rounded arc (a squircle quarter) into the chin where it shows
 *    again — never wider than the painted head. It wears the shade band of
 *    that row, as wide, thinning into the chin; the brown the art painted
 *    along the shield's edge is inside the head now and takes the tan. Its
 *    ink is redrawn at the art's depth;
 *  - the TUNIC's back is narrow: from under the chin straight down to the
 *    hem, which stands as far past the near leg as the art's hem stands past
 *    the far one, its shoulder and hem corner rounded, a shadow-ink rim and
 *    the row's own ink inside, behind the helmet;
 *  - NO NEAR HAND: that arm hangs behind the body once the shield is gone
 *    (a fist pasted at the hip read as a growth). Where an off-hand piece is
 *    held, `grips` says where, per frame: `cover`, the painted shield's edge
 *    against the body, where a shield-like piece stands in the shield's
 *    place; `hand`, at the tunic's side, for a second weapon;
 *  - the near LEG, where the shield hid it, is the far leg's mirror (the one
 *    mirror left: legs are drawn the same either side in this art);
 *  - the GROUND SHADOW's bite is closed by the mirror of its right half.
 *
 * Then the outline is closed, one-px notches are inked shut, ink that edges
 * nothing goes and a lone px takes its neighbours' colour.
 *
 * It only ever writes where the cut left the frame transparent or
 * translucent within 12 px of the hole, over an ink pixel the cut kept along
 * its edge (that edge is inside the knight now), and over the helmet's
 * shade along the cut. Every other pixel of the art is untouched.
 *
 * `scripts/anchors.ts` runs it over the CC0 strips and writes the difference
 * as a per-frame patch (`shieldFill.generated.ts`); `anchors:check` fails if
 * the patch is stale or if a rebuilt frame has a hole, an open or fat
 * outline, a lone px, a stray island, a swollen head or a write outside that
 * rule ({@link fillProblems}). The game applies the patch after the cut
 * (`gearMarks.unpaintedStrip`) and holds the off-hand piece at `grips`
 * (`gearMarks.drawOffHand`).
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

/** What one frame's rebuild measured (for the tests and the review log). */
export interface FillInfo {
  /** The mirror line, in the cell's px. */
  axis: number
  helmet: number
  tunic: number
  leg: boolean
  shadow: number
}

/** Where a held thing goes in one frame, in the cell's px: the hidden near hand (at the tunic's side), and the painted shield's edge against the body (its right edge, at its middle height). */
export interface FrameGrips {
  hand: Pt
  cover: Pt
}

const BROWN = 0x977b6b

/**
 * The quarter of a squircle (|x|^n + |y|^n = 1) from `p0`, where the contour
 * runs straight down, round to `p1`, where it runs flat: the back of the
 * head into its chin. `n` = 2 is an ellipse; a little more keeps the
 * corner full without swelling past either end.
 */
function squircle(p0: Pt, p1: Pt, n: number): Pt[] {
  const rx = p1[0] - p0[0]
  const ry = p1[1] - p0[1]
  const out: Pt[] = []
  const N = Math.max(16, Math.ceil((Math.abs(rx) + Math.abs(ry)) * 8))
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * (Math.PI / 2)
    out.push([p1[0] - rx * Math.cos(t) ** (2 / n), p0[1] + ry * Math.sin(t) ** (2 / n)])
  }
  return out
}

/** The leftmost x a curve reaches in each whole row it crosses. */
function leftEdge(curve: Pt[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const [x, y] of curve) {
    const Y = Math.round(y)
    const X = Math.round(x)
    m.set(Y, Math.min(m.get(Y) ?? Infinity, X))
  }
  return m
}

/**
 * Rebuild one frame. `orig` is the frame as painted, `cut` the same frame after
 * `cutOffHand`, `tunicSpans` the tunic measured on the cut frame. Returns the rebuilt frame, what it did and where a held
 * thing goes.
 */
function fillFrame(orig: Frame, cut: Frame, tunicSpans: readonly number[]): { out: Frame; info: FillInfo; grips: FrameGrips } {
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
  /**
   * Ink the contour round `region`, as the pack draws it: `th` px deep across
   * a side and `tv` px deep along a top or a bottom (a diagonal steps, so
   * each row and column of it stays that deep — never a fat wedge), on
   * writable px `ok` allows.
   */
  const outline = (region: Set<number>, th: number, tv: number, ok: (x: number, y: number) => boolean, from: Iterable<number> = region) => {
    for (const p of from) {
      const x = p % w
      const y = (p - x) / w
      const reach = (dx: number, dy: number, t: number) => {
        for (let k = 1; k <= t; k++) {
          const X = x + dx * k
          const Y = y + dy * k
          if (!cut.in(X, Y) || region.has(Y * w + X)) return
          if (ok(X, Y)) put(X, Y, INK_PX)
        }
      }
      reach(1, 0, th)
      reach(-1, 0, th)
      reach(0, 1, tv)
      reach(0, -1, tv)
    }
  }

  // The painted shield's footprint, and its middle: where a held piece covers it.
  let sx0 = Infinity
  let sx1 = -Infinity
  let sy0 = Infinity
  let sy1 = -Infinity
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (hole(x, y)) {
        sx0 = Math.min(sx0, x)
        sx1 = Math.max(sx1, x)
        sy0 = Math.min(sy0, y)
        sy1 = Math.max(sy1, y)
      }
  // its edge against the body (the right), at its middle height
  const cover: Pt = [sx1, Math.round((sy0 + sy1) / 2)]

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
  /** A row whose left edge the shield touched: a hole within 6 px of it. */
  const dirty = (y: number, l: number) => {
    for (let X = l - 6; X < l; X++) if (hole(X, y)) return true
    return false
  }
  const clean = [...hRows.entries()].filter(([y, [l]]) => !dirty(y - 1, l) && !dirty(y, l) && !dirty(y + 1, l))
  const axisX2 = median(clean.map(([, [l, r]]) => l + r)) // twice the axis: x mirrors to axisX2 − x
  const mirror = (x: number) => axisX2 - x
  /** The pack's contour depth, as the art has it on the helmet's back: its ink, counted from the paint. */
  const inkDepth = (x: number, y: number, dir: number) => {
    let n = 0
    while (n < 3 && cut.ink(x + dir * (n + 1), y)) n++
    return Math.max(2, n)
  }

  // ---- the near leg's place and the hem: what the tunic's back runs down to.
  const feet = (() => {
    for (let y = h - 1; y > ty1; y--) for (let x = tx0; x <= tx1; x++) if (cut.opaque(x, y)) return y
    return ty1
  })()
  const legRuns = (() => {
    const y = feet - 2
    const runs: [number, number][] = []
    for (let x = 0; x < w; x++) {
      if (!cut.ink(x, y)) continue
      if (runs.length && runs[runs.length - 1][1] === x - 1) runs[runs.length - 1][1] = x
      else runs.push([x, x])
    }
    const [hl, hr] = tRows.get(ty1)!
    return runs.filter(([a, b]) => b >= hl - 8 && a <= hr + 6 && b - a <= 12)
  })()
  const hemR = tRows.get(ty1)![1]
  const farLeg = legRuns[legRuns.length - 1]
  const nearLeg = legRuns.length >= 2 ? legRuns[0] : null
  const hemL = nearLeg && farLeg ? nearLeg[0] - Math.max(1, hemR - farLeg[1]) : mirror(hemR)

  const tunicNew = new Set<number>()

  // ---- 1 · the helmet's back, continued: from where its painted contour
  // goes behind the shield, one smooth arc into the chin where it shows again.
  // Never wider than the painted head: the arc leaves the last clean row on
  // its own heading, so the head does not swell past the art. In front of
  // the tunic.
  let helmetN = 0
  const helmetNew = new Set<number>()
  const dirtyRows = [...hRows.entries()].filter(([y, [l]]) => dirty(y, l)).map(([y]) => y)
  if (dirtyRows.length && clean.length) {
    const first = Math.min(...dirtyRows)
    const above = clean.filter(([y]) => y < first).map(([y]) => y)
    const l = (y: number) => hRows.get(y)![0]
    // The head's widest painted row just above the shield's edge (the lowest
    // of them): its contour is upright there, and the arc leaves it upright.
    const last = Math.max(...above)
    let y0 = last
    for (let y = last; y >= last - 6; y--) if (hRows.has(y) && l(y) <= l(y0)) y0 = y
    const x0 = l(y0)
    // The chin where it shows: the leftmost helmet column whose bottom is clear of the hole.
    const bottom = new Map<number, number>()
    for (const p of helmet) {
      const x = p % w
      const y = (p - x) / w
      bottom.set(x, Math.max(bottom.get(x) ?? -1, y))
    }
    const shown = [...bottom.entries()].filter(([x, y]) => x > x0 && y > y0 + 4 && !nearHole(x, y, 3)).sort((a, b) => a[0] - b[0])
    if (shown.length >= 3) {
      const [x1, y1] = shown[0]
      // A rounded corner (a squircle quarter) from the widest row down into the chin.
      const edge = leftEdge(squircle([x0, y0], [x1, y1], 2.5))
      let band = 0
      while (cut.rgb(x0 + band, y0) === BROWN && helmetSet.has(y0 * w + x0 + band)) band++
      const tan = cut.get(x0 + band, y0)
      const shade = cut.get(x0, y0)
      const depth = inkDepth(x0, y0, -1)
      for (let y = y0 + 1; y <= y1; y++) {
        const art = hRows.get(y)?.[0] ?? x1
        const xl = Math.min(edge.get(y) ?? art, art)
        // The shade band keeps the painted side's width, thinning into the chin.
        const k = (y - y0) / Math.max(1, y1 - y0)
        const bw = Math.round(band * (1 - k * k))
        // The ink the cut kept left of the new edge goes: the contour is redrawn at one depth.
        // (but not the ink that edges the art's own tunic or anything else of the body)
        const edgesArt = (x: number) => N4.some(([dx, dy]) => cut.paint(x + dx, y + dy) && !helmetSet.has((y + dy) * w + x + dx) && !hole(x + dx, y + dy))
        if (hRows.has(y)) for (let x = xl - 7; x < xl; x++) if (writable(x, y) && cut.ink(x, y) && !tunicNew.has(y * w + x) && !edgesArt(x)) out.set(x, y, 0)
        for (let x = xl; x < art + band + 3; x++) {
          const inHead = x < art ? writable(x, y) || tunicNew.has(y * w + x) : cut.rgb(x, y) === BROWN && helmetSet.has(y * w + x) && nearHole(x, y, 9)
          if (!inHead) continue
          out.set(x, y, x - xl < bw ? shade : tan)
          claimed.add(y * w + x)
          tunicNew.delete(y * w + x)
          helmetNew.add(y * w + x)
          helmetN++
        }
      }
      // The contour round the new back of the head: the art's depth across, two along the chin.
      const head = new Set<number>([...helmetSet, ...helmetNew])
      // From the new part, and from the art's own edge in the rows whose kept ink was cleared.
      const from = new Set(helmetNew)
      for (let y = y0 + 1; y <= y1; y++) {
        const art = hRows.get(y)?.[0]
        if (art !== undefined) for (let x = art; x < art + 3; x++) if (helmetSet.has(y * w + x)) from.add(y * w + x)
      }
      outline(head, depth, 2, (x, y) => writable(x, y) && !out.paint(x, y) && y <= y1 + 2 && !helmetSet.has(y * w + x), from)
      for (const p of [...tunicNew]) if (out.ink(p % w, Math.floor(p / w))) tunicNew.delete(p)
    }
  }

  // ---- 2 · the tunic's back. Behind the body in this 3/4 view, so it is
  // narrow: its side runs straight down from under the chin to the hem, the
  // hem standing as far past the near leg as the art's hem stands past the
  // far one (1 px of flare), its shoulder and its hem corner rounded. Its
  // rim wears the tunic's shadow ink, the side the art shades, and inside it
  // the art's own ink of that row runs on; then the pack's contour. Behind
  // the helmet and its contour.
  let tunicN = 0
  const topL = hemL + 1
  const behindHead = (x: number, y: number) => helmetSet.has(y * w + x) || helmetNew.has(y * w + x) || (claimed.has(y * w + x) && out.ink(x, y))
  let shoulder = -1
  for (const [y, [l]] of [...tRows.entries()].sort((p, q) => p[0] - q[0])) {
    if (!dirty(y, l + 1)) continue
    const k = (y - ty0) / Math.max(1, ty1 - ty0)
    let left = Math.round(topL + (hemL - topL) * k)
    if (shoulder < 0 && !behindHead(left, y) && !behindHead(left + 1, y)) shoulder = y
    if (shoulder >= 0) left += Math.max(0, 2 - (y - shoulder)) // the shoulder, rounded
    if (y === ty1) left += 1 // the hem's corner
    left = Math.min(l, left)
    if (left >= l) continue
    for (let x = l - 7; x < l; x++) if (writable(x, y) && cut.ink(x, y) && !behindHead(x, y)) out.set(x, y, 0)
    const inner = cut.tunic(l, y) ? cut.get(l, y) : TUNIC_DARK_PX
    for (let x = left; x < l; x++) {
      if (!writable(x, y) || behindHead(x, y)) continue
      out.set(x, y, x - left < 2 ? TUNIC_DARK_PX : inner)
      claimed.add(y * w + x)
      tunicNew.add(y * w + x)
      tunicN++
    }
  }
  // Its contour — but not on top, under the chin: the helmet's own contour is there.
  const underChin = (x: number, y: number) => [1, 2, 3].some((k) => out.ink(x, y - k) && claimed.has((y - k) * w + x) && !tunicNew.has((y - k + 1) * w + x))
  outline(tunicNew, 2, 2, (x, y) => writable(x, y) && !out.opaque(x, y) && !(underChin(x, y) && tunicNew.has((y + 1) * w + x)))

  // ---- 3 · the near hand. This is the far side of a 3/4 figure facing
  // right: with the shield gone its arm hangs behind the body, so no hand is
  // drawn (a fist pasted at the hip read as a growth). Where an off-hand
  // weapon is gripped (`Hold` 'hand'), the grip is that hidden hand's: at the
  // tunic's side, two thirds down, just inside its contour.
  const yc = Math.round(ty0 + (ty1 - ty0) * 0.62)
  let side = Infinity
  for (let y = yc - 1; y <= yc + 1; y++)
    for (let x = 0; x < w; x++)
      if (tunic.has(y * w + x) || tunicNew.has(y * w + x)) {
        side = Math.min(side, x)
        break
      }
  const hand: Pt = [side + 1, yc]

  // ---- 4 · the near leg, where the shield hid it (all of it, or its side or
  // top): the far leg's mirror, added to what shows.
  let leg = false
  const legPx = new Set<number>()
  if (farLeg) {
    let hidden = false
    for (let yy = ty1 + 1; yy <= feet && !hidden; yy++) for (let x = mirror(farLeg[1]) - 1; x <= mirror(farLeg[0]) + 1; x++) if (hole(x, yy)) hidden = true
    if (hidden) {
      leg = true
      for (let yy = ty1 + 1; yy <= feet; yy++)
        for (let x = farLeg[0] - 1; x <= farLeg[1] + 1; x++)
          if (cut.ink(x, yy) && !out.opaque(mirror(x), yy) && put(mirror(x), yy, cut.get(x, yy))) legPx.add(yy * w + mirror(x))
    }
  }

  // ---- 5 · close the outline: new paint facing empty space gets ink.
  for (const p of [...claimed]) {
    const x = p % w
    const y = (p - x) / w
    if (!out.paint(x, y)) continue
    for (const [dx, dy] of N4) if (!out.opaque(x + dx, y + dy)) put(x + dx, y + dy, INK_PX)
  }

  // ...and a one-px notch between new contour and old is inked shut.
  for (let pass = 0; pass < 2; pass++) {
    const gaps: Pt[] = []
    for (let y = 0; y <= ty1 + 1; y++)
      for (let x = 0; x < w; x++) {
        if (out.opaque(x, y) || !writable(x, y)) continue
        if (!N8.some(([dx, dy]) => claimed.has((y + dy) * w + x + dx))) continue
        const lr = out.opaque(x - 1, y) && out.opaque(x + 1, y)
        const ud = out.opaque(x, y - 1) && out.opaque(x, y + 1)
        let around = 0
        for (const [dx, dy] of N4) if (out.opaque(x + dx, y + dy)) around++
        if (lr || ud || around >= 3) gaps.push([x, y])
      }
    for (const [x, y] of gaps) put(x, y, INK_PX)
  }

  // ---- 6 · ink that edges nothing, and lone px: gone. An ink px of the cut's
  // edge, or the rebuild's, with no paint within 3 px; a new painted px that
  // no other px of its colour touches takes its neighbours' colour.
  for (let pass = 0; pass < 2; pass++)
    for (let y = 0; y <= ty1 + 1; y++)
      for (let x = 0; x < w; x++) {
        if (!out.ink(x, y) || !writable(x, y) || legPx.has(y * w + x)) continue
        let near = false
        for (let dy = -3; dy <= 3 && !near; dy++) for (let dx = -3; dx <= 3 && !near; dx++) if (out.paint(x + dx, y + dy)) near = true
        let inks = 0
        for (const [dx, dy] of N8) if (out.ink(x + dx, y + dy)) inks++
        if (!near || (inks === 0 && pass === 1)) {
          out.set(x, y, 0)
          claimed.delete(y * w + x)
        }
      }
  for (const p of [...claimed]) {
    const x = p % w
    const y = (p - x) / w
    if (!out.paint(x, y)) continue
    const c = out.get(x, y)
    if (N4.some(([dx, dy]) => out.get(x + dx, y + dy) === c)) continue
    const votes = new Map<number, number>()
    for (const [dx, dy] of N4) {
      const n = out.get(x + dx, y + dy)
      if (out.paint(x + dx, y + dy)) votes.set(n, (votes.get(n) ?? 0) + 1)
    }
    const best = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]
    if (best) out.set(x, y, best[0])
  }

  // ---- 7 · the ground shadow's bite: the mirror of its right half, about its
  // own middle, wherever the art had paint and the rebuilt frame has none.
  let shadowN = 0
  let shadowPx = 0
  for (let i = 0; i < cut.c.length && !shadowPx; i++) {
    const a = cut.c[i] & 255
    if (a > 0 && a < 128) shadowPx = cut.c[i]
  }
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

  return {
    out,
    info: { axis: axisX2 / 2, helmet: helmetN, tunic: tunicN, leg, shadow: shadowN },
    grips: { hand, cover },
  }
}

/**
 * Where the rebuild may write in a frame: wherever the cut left it
 * transparent or translucent within 12 px of the hole (the knight's side,
 * never the sword arm's), and over the ink the cut kept along its edge
 * (within 6 px of the hole — that edge is inside the knight now). The
 * helmet's shade band along the shield's edge is also repainted (step 3);
 * {@link fillProblems} allows that one too: brown helmet pixels within 8 px.
 */
function writableIn(orig: Frame, cut: Frame): (x: number, y: number) => boolean {
  const hole = (x: number, y: number) => orig.opaque(x, y) && cut.alpha(x, y) === 0
  const memo = new Map<number, boolean>()
  const near = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (hole(x + dx, y + dy)) return true
    return false
  }
  return (x, y) => {
    if (!cut.in(x, y)) return false
    const k = y * cut.w + x
    let v = memo.get(k)
    if (v === undefined) {
      v = cut.opaque(x, y) ? cut.ink(x, y) && near(x, y, 6) : near(x, y, 12)
      memo.set(k, v)
    }
    return v
  }
}

/** The knight strips whose painted shield is cut, per pack. */
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
  for (const s of strips) {
    const cut = new Uint8Array(s.data)
    cutAndFill(cut, s.w, s.h, s.frames, null)
    const { torsos } = measureTorsos(cut, s.w, s.h, s.frames)
    const cw = Math.round(s.w / s.frames)
    const palette: number[] = []
    const frames: (number | string)[][] = []
    const grips: [number, number, number, number][] = []
    const info: FillInfo[] = []
    for (let f = 0; f < s.frames; f++) {
      const fw = Math.min(cw, s.w - f * cw)
      const o = Frame.read(s.data, s.w, s.h, f * cw, fw)
      const c = Frame.read(cut, s.w, s.h, f * cw, fw)
      const r = fillFrame(o, c, torsos[f].spans)
      info.push(r.info)
      frames.push(diff(c, r.out, palette))
      // in logical px from the hero's origin: the cell's middle, feet at y = +8 (`drawSentinel`)
      const lx = (x: number) => x - fw / 2
      const ly = (y: number) => y - s.h + 8
      grips.push([lx(r.grips.hand[0]), ly(r.grips.hand[1]), lx(r.grips.cover[0]), ly(r.grips.cover[1])])
    }
    out[s.name] = { fill: { w: s.w, h: s.h, palette, frames, grips }, info }
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
        const ok = (!c.opaque(x, y) && near(x, y, 12)) || (c.ink(x, y) && near(x, y, 6)) || (c.rgb(x, y) === BROWN && near(x, y, 10))
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
    const where = (set: Iterable<number>) => [...set].slice(0, 4).map((i) => `${i % fw},${Math.floor(i / fw)}`).join(' ')
    if (open.size) problems.push(`${at}: the outline is open at ${open.size} px (${where(open)})`)
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
    // No lone px: every painted px the patch wrote touches another of its colour.
    let lone = 0
    for (const i of written) {
      const x = i % fw
      const y = (i - x) / fw
      if (b.paint(x, y) && !N4.some(([dx, dy]) => b.get(x + dx, y + dy) === b.get(x, y))) lone++
    }
    if (lone) problems.push(`${at}: ${lone} lone px`)
    // The head never swells past the painted one: no rebuilt skin px left of
    // the widest row the shield never came near (the near hand's rows aside).
    let headL = Infinity
    for (let y = 0; y < s.h; y++)
      for (let x = 1; x < fw; x++) {
        if (!o.skin(x, y) || hole(x, y) || !o.ink(x - 1, y)) continue
        let shielded = false
        for (let X = x - 7; X < x; X++) if (hole(X, y)) shielded = true
        if (!shielded) headL = Math.min(headL, x)
        break
      }
    const handY = fill.grips[f] ? fill.grips[f][1] + s.h - 8 : -99
    let swell = 0
    for (const i of written) {
      const x = i % fw
      const y = (i - x) / fw
      if (b.skin(x, y) && x < headL && Math.abs(y - handY) > 6) swell++
    }
    if (swell) problems.push(`${at}: the head swells ${swell} px past the painted one`)
    // The contour keeps the art's depth: from an outer ink px the patch wrote,
    // facing empty space on one side, paint lies at most 5 px in on the other
    // (the art's own contour runs 2–3 px, and 5 where the chin overhangs the tunic).
    const deep: string[] = []
    for (const i of written) {
      const x = i % fw
      const y = (i - x) / fw
      if (!b.ink(x, y)) continue
      // its depth: the shortest way in, from each side that faces empty space
      let best = 99
      for (const [dx, dy] of N4) {
        if (b.opaque(x - dx, y - dy)) continue // the empty side is behind (−d); look along +d
        let k = 1
        while (k <= 8 && b.ink(x + dx * k, y + dy * k)) k++
        if (k <= 8 && b.paint(x + dx * k, y + dy * k)) best = Math.min(best, k)
      }
      // a leg, or a foot, is ink across: no paint either side in its row
      const across = [1, -1].some((dx) => {
        let k = 1
        while (k <= 8 && b.ink(x + dx * k, y)) k++
        return b.paint(x + dx * k, y)
      })
      if (across && best > 6 && best < 99) deep.push(`${x},${y}`)
    }
    // (one corner px may run long where a flat edge turns: more than two is a fat contour)
    if (deep.length > 2) problems.push(`${at}: the contour is more than 5 px deep at ${deep.length} px (${deep.slice(0, 4).join(' ')})`)
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
    `    ${JSON.stringify(n)}: {\n      w: ${s.w},\n      h: ${s.h},\n      palette: [${s.palette.map(hex).join(', ')}],\n      grips: [${s.grips.map((g) => `[${g.join(', ')}]`).join(', ')}],\n      frames: [\n${s.frames.map(frame).join('\n')}\n      ],\n    },`
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
