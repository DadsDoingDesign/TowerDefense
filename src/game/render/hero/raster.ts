/**
 * The hero builder's pixel core — pure (typed arrays, no DOM), so the tests
 * run it in node and the harness only copies its bytes into an ImageData.
 *
 * A part draws SHAPES (ellipse, polygon, capsule, line, pixel) with a
 * MATERIAL slot and a SHADING model through a {@link Pen}. The pen writes
 * into its layer's {@link LayerBuf}: per pixel a ramp, a tone (1 shade …
 * 4 specular, 0 ink) and flags. Shading is solved per pixel from the shape's
 * form and one light (the pack's: from the top, a little toward the facing
 * side), quantised to the pack's three tones plus specular, with a faint
 * horizontal streak so the bands read hand-laid rather than computed.
 *
 * {@link composite} then stacks the layers in draw order the Tiny Swords way:
 * every layer is inked by its OWN 2 px ring before its fills land, so a part
 * on top is outlined against whatever is under it (the shield over the body,
 * the head over the tunic), and the whole silhouette gets one more px of ink
 * outside (the pack's outer line is 2–3 px, its inner lines 2).
 */
import { INK, RAMPS, RAMP_IDS, SHADOW_ALPHA, rgbOf, type RampId } from './palette'

/** The cell every hero frame is drawn in (px). Feet stand on {@link FEET}. */
export const CELL = 176
export const FEET = 138
export const CX = 88

// ── per-pixel flags ────────────────────────────────────────────────────────
/** Not part of its layer's ink ring (glows, sparks, light). */
export const F_NOINK = 1
/** Re-stamped after the next item layer (a fist closing over a grip). */
export const F_FRONT = 2
/** Drawn at partial alpha (a glow). */
export const F_SOFT = 4
/** Masked out where the holding fist is (the grip under the fingers). */
export const F_UNDERHAND = 8
/** Pen-only (never stored): draw only on pixels this piece already has (seams, trims). */
export const F_ONLYON = 16

export const TONE_INK = 0
export const TONE_SHADE = 1
export const TONE_MID = 2
export const TONE_LIGHT = 3
export const TONE_SPEC = 4

const RAMP_INDEX = new Map<RampId, number>(RAMP_IDS.map((r, i) => [r, i + 1]))
const RAMP_BY_INDEX: (RampId | null)[] = [null, ...RAMP_IDS]

export class LayerBuf {
  readonly ramp = new Uint8Array(CELL * CELL)
  readonly tone = new Uint8Array(CELL * CELL)
  readonly flag = new Uint8Array(CELL * CELL)
  /** The box anything was ever painted in (inclusive; empty when x1 < x0). */
  bx0 = CELL
  by0 = CELL
  bx1 = -1
  by1 = -1
  touch(x: number, y: number): void {
    if (x < this.bx0) this.bx0 = x
    if (x > this.bx1) this.bx1 = x
    if (y < this.by0) this.by0 = y
    if (y > this.by1) this.by1 = y
  }
  /** 0 = empty. */
  has(i: number): boolean {
    return this.ramp[i] !== 0
  }
  isEmpty(): boolean {
    for (let i = 0; i < this.ramp.length; i++) if (this.ramp[i]) return false
    return true
  }
  count(): number {
    let n = 0
    for (let i = 0; i < this.ramp.length; i++) if (this.ramp[i]) n++
    return n
  }
  /** Same pixels, same inks, same flags. */
  equals(o: LayerBuf): boolean {
    for (let i = 0; i < this.ramp.length; i++) {
      if (this.ramp[i] !== o.ramp[i] || this.tone[i] !== o.tone[i] || this.flag[i] !== o.flag[i]) return false
    }
    return true
  }
  /** [x0, y0, x1, y1] inclusive, or null. */
  bbox(): [number, number, number, number] | null {
    let x0 = CELL, y0 = CELL, x1 = -1, y1 = -1
    for (let y = 0; y < CELL; y++)
      for (let x = 0; x < CELL; x++)
        if (this.ramp[y * CELL + x]) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
    return x1 < 0 ? null : [x0, y0, x1, y1]
  }
}

// ── shading ────────────────────────────────────────────────────────────────

/** The pack's light: from above, a little toward the facing (+x) side, a little in front. */
const LIGHT = (() => {
  const v = [0.3, -0.6, 0.74]
  const n = Math.hypot(v[0], v[1], v[2])
  return [v[0] / n, v[1] / n, v[2] / n] as const
})()

/**
 * How a shape takes the light:
 *  - `round`: a dome over its bounding ellipse (heads, fists, shields);
 *  - `cyl`: a cylinder along the shape's local y (limbs, shafts, blades);
 *  - `flat`: the mid tone, no form (inner panels; detail goes on with lines);
 *  - `top`: a panel lit along its top edge and shaded along its bottom;
 *  - a tone number: exactly that tone.
 */
export type Shade = 'round' | 'cyl' | 'flat' | 'top' | 0 | 1 | 2 | 3 | 4

/** Small deterministic hash in [0, 1). */
function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function toneOf(d: number, gloss: boolean, wx: number, wy: number, streak: number): number {
  // a streak: the threshold wobbles along short horizontal runs (3 px), like the pack's laid bands
  const j = (hash2(Math.floor(wx / 3), wy) - 0.5) * streak
  const v = d + j
  if (gloss && v > 0.88) return TONE_SPEC
  if (v > 0.38) return TONE_LIGHT
  if (v > -0.02) return TONE_MID
  return TONE_SHADE
}

// ── the pen ────────────────────────────────────────────────────────────────

export type Pt = readonly [number, number]

export interface ShapeOpts {
  shade?: Shade
  /** Specular dashes on the brightest pixels (metal, glass, glossy scales). */
  gloss?: boolean
  flags?: number
  /** Streak strength (0 = clean bands). */
  streak?: number
}

/** Resolves a part's material slot (`'cloth'`, `'metal'` …) or a ramp id to a ramp. */
export type MatResolver = (mat: string) => RampId

/** An affine map local → world: x' = a·x + c·y + e, y' = b·x + d·y + f. */
interface Xf {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}
const IDENT: Xf = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

/**
 * Draws into one layer. A pen may be moved to an anchor and turned
 * (`pen.at(x, y, deg)`): shapes are then given in that local frame, where −y
 * is "up the item" (a blade's point, a staff's head) — so one item's
 * geometry serves every frame and every race; only the anchor moves.
 */
export class Pen {
  constructor(
    readonly buf: LayerBuf,
    readonly mat: MatResolver,
    private readonly xf: Xf = IDENT,
    /** Pixels the holding fist covers (for `F_UNDERHAND`). */
    readonly handMask: Uint8Array | null = null,
  ) {}

  /**
   * A pen whose origin is (x, y) in this pen's frame, turned `deg` clockwise,
   * scaled `sc` (an item drawn once at its own size); `flip` mirrors local x.
   */
  at(x: number, y: number, deg = 0, flip = false, sc = 1): Pen {
    const r = (deg * Math.PI) / 180
    const cs = Math.cos(r) * sc, sn = Math.sin(r) * sc
    const k = flip ? -1 : 1
    // local child: R(deg)·S(k·sc, sc), then translate (x, y), then this.xf
    const la = cs * k, lb = sn * k, lc = -sn, ld = cs
    const m = this.xf
    const xf: Xf = {
      a: m.a * la + m.c * lb,
      b: m.b * la + m.d * lb,
      c: m.a * lc + m.c * ld,
      d: m.b * lc + m.d * ld,
      e: m.a * x + m.c * y + m.e,
      f: m.b * x + m.d * y + m.f,
    }
    return new Pen(this.buf, this.mat, xf, this.handMask)
  }

  withHand(mask: Uint8Array | null): Pen {
    return new Pen(this.buf, this.mat, this.xf, mask)
  }

  toWorld(x: number, y: number): [number, number] {
    const m = this.xf
    return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]
  }
  private toLocal(wx: number, wy: number): [number, number] {
    const m = this.xf
    const det = m.a * m.d - m.b * m.c
    const dx = wx - m.e, dy = wy - m.f
    return [(m.d * dx - m.c * dy) / det, (-m.b * dx + m.a * dy) / det]
  }
  /** A local direction → world (unit length kept for a rotation / mirror). */
  private dirWorld(x: number, y: number): [number, number] {
    const m = this.xf
    return [m.a * x + m.c * y, m.b * x + m.d * y]
  }

  private worldBox(pts: readonly Pt[], pad: number): [number, number, number, number] {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const [x, y] of pts) {
      const [wx, wy] = this.toWorld(x, y)
      x0 = Math.min(x0, wx); y0 = Math.min(y0, wy); x1 = Math.max(x1, wx); y1 = Math.max(y1, wy)
    }
    return [Math.max(0, Math.floor(x0 - pad)), Math.max(0, Math.floor(y0 - pad)), Math.min(CELL - 1, Math.ceil(x1 + pad)), Math.min(CELL - 1, Math.ceil(y1 + pad))]
  }

  /**
   * The core fill: every pixel whose centre the local `inside` test accepts.
   * `box` is the shape's local bounds (for its form shading).
   */
  private fill(
    localBounds: readonly Pt[],
    inside: (lx: number, ly: number) => boolean,
    mat: string,
    o: ShapeOpts,
    form: { cx: number; cy: number; rx: number; ry: number },
  ): void {
    const ramp = RAMP_INDEX.get(this.mat(mat))!
    const shade = o.shade ?? 'round'
    const flags = o.flags ?? 0
    const streak = o.streak ?? 0.07
    const [x0, y0, x1, y1] = this.worldBox(localBounds, 1)
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const [lx, ly] = this.toLocal(x + 0.5, y + 0.5)
        if (!inside(lx, ly)) continue
        const i = y * CELL + x
        if (flags & F_UNDERHAND && this.handMask && this.handMask[i]) continue
        if (flags & F_ONLYON && !this.buf.ramp[i]) continue
        let tone: number
        if (typeof shade === 'number') tone = shade
        else if (shade === 'flat') tone = TONE_MID
        else {
          const u = form.rx ? (lx - form.cx) / form.rx : 0
          const v = form.ry ? (ly - form.cy) / form.ry : 0
          let nx = 0, ny = 0, nz = 1
          if (shade === 'round') {
            const q = Math.min(1, u * u + v * v)
            nx = u; ny = v; nz = Math.sqrt(1 - q)
          } else if (shade === 'cyl') {
            const uu = Math.max(-1, Math.min(1, u))
            nx = uu; ny = 0; nz = Math.sqrt(1 - uu * uu)
          } else {
            // top: a panel facing the viewer, its top edge catching light
            nx = 0; ny = Math.max(-1, Math.min(1, v)) * 0.9; nz = Math.sqrt(1 - ny * ny)
          }
          const [wx0, wy0] = this.dirWorld(nx, ny)
          const sc = Math.sqrt(Math.abs(this.xf.a * this.xf.d - this.xf.b * this.xf.c)) || 1
          const wx = wx0 / sc, wy = wy0 / sc
          const d = wx * LIGHT[0] + wy * LIGHT[1] + nz * LIGHT[2]
          tone = toneOf(d, !!o.gloss, x, y, streak)
        }
        this.buf.ramp[i] = ramp
        this.buf.tone[i] = tone
        this.buf.flag[i] = flags & ~F_ONLYON
        this.buf.touch(x, y)
      }
  }

  /** An ellipse. `form` shades it as part of a bigger shape (a cheek on a skull). */
  ellipse(cx: number, cy: number, rx: number, ry: number, mat: string, o: ShapeOpts = {}, form?: { cx: number; cy: number; rx: number; ry: number }): this {
    const b: Pt[] = [[cx - rx, cy - ry], [cx + rx, cy - ry], [cx - rx, cy + ry], [cx + rx, cy + ry]]
    this.fill(b, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, mat, o, form ?? { cx, cy, rx, ry })
    return this
  }

  circle(cx: number, cy: number, r: number, mat: string, o: ShapeOpts = {}): this {
    return this.ellipse(cx, cy, r, r, mat, o)
  }

  /** A polygon (even-odd). Its form is its bounding ellipse unless `form` says otherwise. */
  poly(pts: readonly Pt[], mat: string, o: ShapeOpts = {}, form?: { cx: number; cy: number; rx: number; ry: number }): this {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
    const f = form ?? { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: (x1 - x0) / 2 || 1, ry: (y1 - y0) / 2 || 1 }
    this.fill(pts, (x, y) => inPoly(pts, x, y), mat, o, f)
    return this
  }

  rect(x: number, y: number, w: number, h: number, mat: string, o: ShapeOpts = {}): this {
    return this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], mat, o)
  }

  /** A round-ended bar from a to b, radius r (limbs, shafts, sleeves). Shaded across its width. */
  capsule(ax: number, ay: number, bx: number, by: number, r: number, mat: string, o: ShapeOpts = {}): this {
    const len = Math.hypot(bx - ax, by - ay) || 1e-6
    const ux = (bx - ax) / len, uy = (by - ay) / len
    const b: Pt[] = [[ax - r, ay - r], [ax + r, ay + r], [bx - r, by - r], [bx + r, by + r]]
    const shade = o.shade ?? 'cyl'
    // cylinder shading across the bar: express the form in a frame along the bar
    if (shade === 'cyl') {
      const deg = (Math.atan2(uy, ux) * 180) / Math.PI - 90
      const p = this.at(ax, ay, deg)
      p.fill(
        [[-r, -r], [r, -r], [-r, len + r], [r, len + r]],
        (x, y) => (y < 0 ? x * x + y * y <= r * r : y > len ? x * x + (y - len) ** 2 <= r * r : Math.abs(x) <= r),
        mat,
        o,
        { cx: 0, cy: len / 2, rx: r, ry: len / 2 + r },
      )
      return this
    }
    this.fill(b, (x, y) => segDist(x, y, ax, ay, bx, by) <= r, mat, o, { cx: (ax + bx) / 2, cy: (ay + by) / 2, rx: Math.abs(bx - ax) / 2 + r, ry: Math.abs(by - ay) / 2 + r })
    return this
  }

  /** A crisp 1 px line (Bresenham, in world px) — seams, eyes, strings. `mat` 'ink' paints the outline colour. */
  line(ax: number, ay: number, bx: number, by: number, mat: string, tone: number = TONE_INK, flags = 0): this {
    const [x0w, y0w] = this.toWorld(ax, ay)
    const [x1w, y1w] = this.toWorld(bx, by)
    let x0 = Math.floor(x0w), y0 = Math.floor(y0w)
    const x1 = Math.floor(x1w), y1 = Math.floor(y1w)
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      this.setPx(x0, y0, mat, tone, flags)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x0 += sx }
      if (e2 <= dx) { err += dx; y0 += sy }
    }
    return this
  }

  /** One pixel, local coords. */
  px(x: number, y: number, mat: string, tone: number, flags = 0): this {
    const [wx, wy] = this.toWorld(x, y)
    this.setPx(Math.floor(wx), Math.floor(wy), mat, tone, flags)
    return this
  }

  private setPx(x: number, y: number, mat: string, tone: number, flags: number): void {
    if (x < 0 || y < 0 || x >= CELL || y >= CELL) return
    const i = y * CELL + x
    if (flags & F_ONLYON) {
      if (!this.buf.ramp[i]) return
      flags &= ~F_ONLYON
    }
    this.buf.touch(x, y)
    if (mat === 'ink') {
      // ink is drawn on the layer's own pixels as tone 0 (needs a ramp so it counts as filled)
      this.buf.ramp[i] = this.buf.ramp[i] || RAMP_INDEX.get('cream')!
      this.buf.tone[i] = TONE_INK
      this.buf.flag[i] = flags || this.buf.flag[i]
      return
    }
    this.buf.ramp[i] = RAMP_INDEX.get(this.mat(mat))!
    this.buf.tone[i] = tone
    this.buf.flag[i] = flags
  }

  /** Erase this layer's pixels inside an ellipse (revealing the layers below). */
  cutEllipse(cx: number, cy: number, rx: number, ry: number): this {
    const b: Pt[] = [[cx - rx, cy - ry], [cx + rx, cy + ry]]
    const [x0, y0, x1, y1] = this.worldBox(b, 1)
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const [lx, ly] = this.toLocal(x + 0.5, y + 0.5)
        if (((lx - cx) / rx) ** 2 + ((ly - cy) / ry) ** 2 <= 1) {
          const i = y * CELL + x
          this.buf.ramp[i] = 0; this.buf.tone[i] = 0; this.buf.flag[i] = 0
        }
      }
    return this
  }

  cutPoly(pts: readonly Pt[]): this {
    const [x0, y0, x1, y1] = this.worldBox(pts, 1)
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const [lx, ly] = this.toLocal(x + 0.5, y + 0.5)
        if (inPoly(pts, lx, ly)) {
          const i = y * CELL + x
          this.buf.ramp[i] = 0; this.buf.tone[i] = 0; this.buf.flag[i] = 0
        }
      }
    return this
  }

  /**
   * Re-tone this piece's own pixels by a rule over world px (a quilt, mail
   * links, scales): `fn` returns the new tone, or null to keep it.
   */
  texture(fn: (x: number, y: number, tone: number) => number | null, ramp?: string): this {
    const r = ramp ? RAMP_INDEX.get(this.mat(ramp))! : 0
    const b = this.buf
    for (let y = Math.max(0, b.by0); y <= b.by1; y++)
      for (let x = Math.max(0, b.bx0); x <= b.bx1; x++) {
        const i = y * CELL + x
        if (!this.buf.ramp[i] || this.buf.tone[i] === TONE_INK) continue
        const t = fn(x, y, this.buf.tone[i])
        if (t == null) continue
        this.buf.tone[i] = t
        if (r && t !== TONE_INK) this.buf.ramp[i] = r
      }
    return this
  }

  /** Re-tone this layer's existing pixels inside an ellipse (a cast shadow on a part, a lit rim). */
  toneEllipse(cx: number, cy: number, rx: number, ry: number, tone: number): this {
    const b: Pt[] = [[cx - rx, cy - ry], [cx + rx, cy + ry]]
    const [x0, y0, x1, y1] = this.worldBox(b, 1)
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const [lx, ly] = this.toLocal(x + 0.5, y + 0.5)
        const i = y * CELL + x
        if (this.buf.ramp[i] && this.buf.tone[i] !== TONE_INK && ((lx - cx) / rx) ** 2 + ((ly - cy) / ry) ** 2 <= 1) this.buf.tone[i] = tone
      }
    return this
  }
}

function inPoly(pts: readonly Pt[], x: number, y: number): boolean {
  let c = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax, vy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)))
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy))
}

// ── compositing ────────────────────────────────────────────────────────────

/** Who painted a composite pixel last: a layer index, or one of these. */
export const OWN_NONE = -1
export const OWN_SHADOW = -2
export const OWN_OUTLINE = -3

export interface Composite {
  rgba: Uint8ClampedArray
  /** Per pixel: the layer whose ink or fill is on top (`OWN_*` otherwise). */
  owner: Int8Array
}

/** The 2 px ink ring's kernel: a disc of radius 2 (rounded corners, like the pack's line). */
const RING2: Pt[] = []
for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if ((dx || dy) && dx * dx + dy * dy <= 5) RING2.push([dx, dy])
const RING1: Pt[] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

const INK_RGB = rgbOf(INK)
const RGB_CACHE = new Map<string, [number, number, number]>()
const rgbC = (hex: string) => {
  let v = RGB_CACHE.get(hex)
  if (!v) RGB_CACHE.set(hex, (v = rgbOf(hex)))
  return v
}

function put(out: Composite, i: number, rgb: readonly number[], a: number, owner: number): void {
  const o = i * 4
  if (a >= 255 || out.rgba[o + 3] === 0) {
    out.rgba[o] = rgb[0]; out.rgba[o + 1] = rgb[1]; out.rgba[o + 2] = rgb[2]; out.rgba[o + 3] = a
  } else {
    // alpha over (soft light onto paint)
    const t = a / 255
    out.rgba[o] = Math.round(rgb[0] * t + out.rgba[o] * (1 - t))
    out.rgba[o + 1] = Math.round(rgb[1] * t + out.rgba[o + 1] * (1 - t))
    out.rgba[o + 2] = Math.round(rgb[2] * t + out.rgba[o + 2] * (1 - t))
    out.rgba[o + 3] = Math.max(out.rgba[o + 3], a)
  }
  out.owner[i] = owner
}

export function colourOf(buf: LayerBuf, i: number): string {
  const t = buf.tone[i]
  if (t === TONE_INK) return INK
  return RAMPS[RAMP_BY_INDEX[buf.ramp[i]]!][t - 1]
}

/**
 * Stamp one layer (or the part of it `pick` accepts): its own ink ring, then
 * its fills. `ring` 0 skips the ring (light, glows).
 */
export function stamp(out: Composite, buf: LayerBuf, owner: number, pick?: (i: number) => boolean, ring = 2): void {
  if (buf.bx1 < buf.bx0) return
  const inked = new Uint8Array(CELL * CELL)
  const sel = (i: number) => buf.ramp[i] !== 0 && (!pick || pick(i))
  const X0 = buf.bx0, X1 = buf.bx1, Y0 = buf.by0, Y1 = buf.by1
  if (ring > 0) {
    const k = ring >= 2 ? RING2 : RING1
    for (let y = Y0; y <= Y1; y++)
      for (let x = X0; x <= X1; x++) {
        const i = y * CELL + x
        if (!sel(i) || buf.flag[i] & F_NOINK) continue
        for (const [dx, dy] of k) {
          const xx = x + dx, yy = y + dy
          if (xx < 0 || yy < 0 || xx >= CELL || yy >= CELL) continue
          const j = yy * CELL + xx
          if (sel(j) || inked[j]) continue
          inked[j] = 1
          put(out, j, INK_RGB, 255, owner)
        }
      }
  }
  for (let y = Y0; y <= Y1; y++)
    for (let x = X0; x <= X1; x++) {
      const i = y * CELL + x
      if (!sel(i)) continue
      const a = buf.flag[i] & F_SOFT ? 150 : 255
      put(out, i, buf.tone[i] === TONE_INK ? INK_RGB : rgbC(colourOf(buf, i)), a, owner)
    }
}

export function newComposite(): Composite {
  return { rgba: new Uint8ClampedArray(CELL * CELL * 4), owner: new Int8Array(CELL * CELL).fill(OWN_NONE) }
}

/** The pack's ground shadow: an ink ellipse at alpha 80 under the feet. */
export function shadow(out: Composite, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (x < 0 || y < 0 || x >= CELL || y >= CELL) continue
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 > 1) continue
      put(out, y * CELL + x, INK_RGB, SHADOW_ALPHA, OWN_SHADOW)
    }
}

/** One more px of ink round the whole opaque figure (the pack's heavier outer line). */
export function outerLine(out: Composite): void {
  const solid = (i: number) => out.rgba[i * 4 + 3] === 255 && out.owner[i] !== OWN_SHADOW
  const add: number[] = []
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++) {
      const i = y * CELL + x
      if (solid(i)) continue
      for (const [dx, dy] of RING1) {
        const xx = x + dx, yy = y + dy
        if (xx < 0 || yy < 0 || xx >= CELL || yy >= CELL) continue
        if (solid(yy * CELL + xx) && rgbIsInk(out, yy * CELL + xx)) { add.push(i); break }
      }
    }
  for (const i of add) put(out, i, INK_RGB, 255, OWN_OUTLINE)
}

function rgbIsInk(out: Composite, i: number): boolean {
  const o = i * 4
  return out.rgba[o] === INK_RGB[0] && out.rgba[o + 1] === INK_RGB[1] && out.rgba[o + 2] === INK_RGB[2]
}
