/**
 * The part library — ORIGINAL pixel parts, drawn by shape in the pack's look
 * (`raster.ts` inks and shades them). A part is a function of the pose and
 * the resolved look; it draws one or more PIECES into its layer, each piece
 * inked by its own ring (so an ear is outlined against the face, a guard
 * against its blade).
 *
 * Nothing here places itself by hand: every coordinate is an anchor of the
 * pose (`rig.ts`) or the race's body box, so each part fits each people.
 * Items are drawn in their hand's local frame (−y up the item).
 *
 * Pure: no DOM.
 */
import type { RampId } from './palette'
import { CELL, FEET, F_FRONT, F_NOINK, F_ONLYON, F_SOFT, Pen, TONE_INK, TONE_LIGHT, TONE_MID, TONE_SHADE, TONE_SPEC, type MatResolver, type Pt } from './raster'
import type { Pose, RaceId } from './rig'
import type { HandSlot, ItemPart, LayerId, Rarity, Status, Tell } from './look'

// ── the context a part draws with ──────────────────────────────────────────

export interface PieceOpts {
  /** Ink ring width: 2 (default), 1 for small features, 0 for light. */
  ring?: 0 | 1 | 2
  /** Material overrides for this piece (an item's blade, trim, gem …). */
  mats?: MatResolver
  /** Re-stamp after the next item layer (a fist closing over a grip). */
  front?: boolean
}

export interface Resolved {
  race: RaceId
  head: string
  hair: string
  mats: MatResolver
  main: ItemPart | null
  off: ItemPart | null
  body: ItemPart | null
  rarity: Readonly<Record<HandSlot, Rarity>>
  tier: 0 | 1 | 2 | 3
  tells: ReadonlySet<Tell>
  status: ReadonlySet<Status>
  wounded: boolean
}

/** Points the item layers publish for the FX layer (the weapon's tip, its base). */
export interface Marks {
  mainTip?: Pt
  mainBase?: Pt
  mainLen?: number
}

export interface DrawCtx {
  P: Pose
  R: Resolved
  piece(o?: PieceOpts): Pen
  marks: Marks
  /** The opaque figure so far (FX only): 1 where layers 1–10 painted. */
  silhouette?: Uint8Array
  /** This layer's pieces so far, unioned (1 = painted). */
  layerMask?: () => Uint8Array
}

export type PartFn = (c: DrawCtx) => void

// ── shared geometry ────────────────────────────────────────────────────────

/**
 * The torso's outline this frame, grown by `g` px (armour sits on it) and
 * dropped `drop` px past the hips (a skirt, a hem).
 */
export function torsoOutline(P: Pose, g = 0, drop = 0, flareMore = 0): Pt[] {
  const b = P.body
  const cx = P.torso.x
  const top = P.torsoTop - g
  const bot = P.hips.y + drop
  const rx = b.torsoRx + g
  const fl = b.flare + flareMore + (drop > 0 ? drop * 0.25 : 0)
  const rc = Math.min(7, P.torsoH * 0.45)
  const pts: Pt[] = []
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI + (i / 6) * (Math.PI / 2)
    pts.push([cx - rx + rc + Math.cos(a) * rc, top + rc + Math.sin(a) * rc])
  }
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2)
    pts.push([cx + rx - rc + Math.cos(a) * rc, top + rc + Math.sin(a) * rc])
  }
  pts.push([cx + rx + fl, bot - 1], [cx + rx * 0.5 + fl, bot + 0.6], [cx, bot + 1], [cx - rx * 0.5 - fl, bot + 0.6], [cx - rx - fl, bot - 1])
  return pts
}

const torsoForm = (P: Pose, g = 0, drop = 0) => ({ cx: P.torso.x, cy: P.torsoTop + (P.torsoH + drop) * 0.5, rx: P.body.torsoRx + P.body.flare + g, ry: (P.torsoH + drop) * 0.62 + g })

/** The head's local pen (centre of the head, tilted with it). */
const headPen = (c: DrawCtx, o?: PieceOpts) => c.piece(o).at(c.P.head.x, c.P.head.y, c.P.head.angle)

/** Where the race's ear sits on the head (head-local), and how big a window the hair must leave. */
export function earOf(race: RaceId, rx: number, ry: number, variant: string): { pts: Pt[]; window: Pt[] } | { x: number; y: number; r: number } {
  if (race === 'elf') {
    const tip: Pt = variant === 'swept' ? [-rx - 12, -ry * 0.05] : [-rx - 9, -ry * 0.62]
    const pts: Pt[] = [[-rx * 0.42, -ry * 0.12], [-rx * 0.3, ry * 0.32], [-rx * 0.62, ry * 0.3], tip]
    const window: Pt[] = [[-rx * 0.36, -ry * 0.24], [-rx * 0.22, ry * 0.44], [-rx * 0.7, ry * 0.42], [tip[0] - 2, tip[1] - 1], [tip[0] - 1, tip[1] - 3]]
    return { pts, window }
  }
  if (race === 'gnome') {
    const tip: Pt = [-rx - 7, ry * 0.02]
    const pts: Pt[] = [[-rx * 0.6, ry * 0.08], [-rx * 0.56, ry * 0.5], [-rx * 0.9, ry * 0.46], tip]
    return { pts, window: [[-rx * 0.5, ry * 0.0], [-rx * 0.48, ry * 0.64], [-rx * 1.0, ry * 0.6], [tip[0] - 2, tip[1] - 1], [tip[0] - 1, tip[1] - 3]] }
  }
  return { x: -rx * 0.44, y: ry * 0.22, r: race === 'dwarf' ? 3.4 : 3.2 }
}

// ── the race bases: legs, body, head, hair ─────────────────────────────────

export const legs: PartFn = (c) => {
  const { P } = c
  const b = P.body
  const frosted = c.R.status.has('slowed')
  for (const [foot, side] of [[P.footBack, -1], [P.footFront, 1]] as const) {
    const pen = c.piece()
    const hx = P.hips.x + side * Math.max(2.5, b.stance - 2.5)
    if (b.legH > 2) pen.capsule(hx, P.hips.y - 2, foot.x + 0.5, foot.y - 2.5, b.legR, 'pants')
    else pen.capsule(hx, P.hips.y - 2, foot.x + 0.5, foot.y - 2.5, b.legR + 0.4, 'pants')
    const boot = frosted ? 'frost' : 'boots'
    pen.ellipse(foot.x + 1.4, foot.y - 0.6, b.footRx, 3, boot, { gloss: frosted })
    pen.rect(foot.x + 1.4 - b.footRx * 0.8, foot.y - 4.2, b.footRx * 1.6, 1.6, boot, { shade: TONE_LIGHT })
    if (frosted) {
      // ice clinging to the boot
      const ice = c.piece({ ring: 1 })
      ice.poly([[foot.x - b.footRx + 0.5, foot.y + 1.5], [foot.x - b.footRx + 2, foot.y - 4], [foot.x - b.footRx + 4, foot.y + 1.5]], 'frost', { gloss: true })
    }
  }
}

function tail(c: DrawCtx): void {
  const { P } = c
  const b = P.body
  const pen = c.piece()
  const x0 = P.torso.x - b.torsoRx * 0.4
  const pts: [number, number, number][] = [
    [x0, P.hips.y - 4, 5.2],
    [x0 - 7, P.hips.y + 1, 4.6],
    [x0 - 13, FEET - 4 - P.lift * 0.5, 3.6],
    [x0 - 19, FEET - 6 - P.lift * 0.3, 2.6],
    [x0 - 24, FEET - 11, 1.4],
  ]
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay, ar] = pts[i]
    const [bx, by, br] = pts[i + 1]
    for (let t = 0; t <= 1; t += 0.25) pen.circle(ax + (bx - ax) * t, ay + (by - ay) * t, ar + (br - ar) * t, 'skin', { shade: 'round', gloss: true })
  }
  // a row of scutes along the top
  pen.texture((x, y, tone) => (((x + y * 2) % 5 === 0 && tone >= TONE_MID) ? TONE_SHADE : null))
}

export const torso: PartFn = (c) => {
  const { P } = c
  if (c.R.race === 'reptilian') tail(c)
  const b = P.body
  const pen = c.piece()
  pen.poly(torsoOutline(P), 'cloth', { shade: 'round' }, torsoForm(P))
  // the belt: a dark band, a buckle on the facing side
  const by = P.hips.y - 4
  pen.rect(P.torso.x - b.torsoRx - b.flare - 2, by, (b.torsoRx + b.flare + 2) * 2, 2.2, 'leather', { shade: TONE_SHADE, flags: F_ONLYON })
  pen.line(P.torso.x - b.torsoRx - b.flare - 2, by - 1, P.torso.x + b.torsoRx + b.flare + 2, by - 1, 'ink', TONE_INK, F_ONLYON)
  pen.rect(P.torso.x + b.torsoRx * 0.3, by - 0.8, 3, 3.4, 'trim', { shade: TONE_LIGHT, flags: F_ONLYON })
  // the neckline the head sits in
  pen.ellipse(P.head.x - 1, P.torsoTop + 0.5, b.torsoRx * 0.55, 2.2, 'cloth', { shade: TONE_SHADE, flags: F_ONLYON })
}

/** Eyes on a head pen (head-local), by expression. */
function eyes(pen: Pen, e: { x: number; y: number }[], expr: string, size: 2 | 3 = 3): void {
  for (let k = 0; k < e.length; k++) {
    const { x, y } = e[k]
    const X = Math.round(x), Y = Math.round(y)
    if (expr === 'stun') {
      // a little spiral: ring with a centre gap
      for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]] as const) pen.px(X + dx - 1, Y + dy - 1, 'ink', TONE_INK)
      pen.px(X, Y, 'ink', TONE_INK)
      continue
    }
    if (expr === 'hurt') {
      const d = k === 0 ? 1 : -1
      pen.px(X - d, Y - 1, 'ink', TONE_INK).px(X, Y, 'ink', TONE_INK).px(X - d, Y + 1, 'ink', TONE_INK)
      continue
    }
    if (expr === 'happy' || (expr === 'wink' && k === 1)) {
      pen.px(X - 1, Y + 1, 'ink', TONE_INK).px(X, Y, 'ink', TONE_INK).px(X + 1, Y, 'ink', TONE_INK).px(X + 2, Y + 1, 'ink', TONE_INK)
      continue
    }
    if (expr === 'closed') {
      // eyes shut, savouring: a low arc
      pen.px(X - 1, Y, 'ink', TONE_INK).px(X, Y + 1, 'ink', TONE_INK).px(X + 1, Y + 1, 'ink', TONE_INK).px(X + 2, Y, 'ink', TONE_INK)
      continue
    }
    if (expr === 'smug') {
      // half-lidded: the lid's line over a low pupil
      pen.px(X - 1, Y - 1, 'ink', TONE_INK).px(X, Y - 1, 'ink', TONE_INK).px(X + 1, Y - 1, 'ink', TONE_INK).px(X + 2, Y - 1, 'ink', TONE_INK)
      pen.px(X, Y + 1, 'ink', TONE_INK).px(X + 1, Y + 1, 'ink', TONE_INK)
      continue
    }
    const h = expr === 'focus' ? 2 : size
    const y0 = expr === 'focus' ? Y : Y - (h === 3 ? 1 : 0)
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < 2; dx++) pen.px(X + dx, y0 + dy, 'ink', TONE_INK)
    if (expr !== 'focus') pen.px(X, y0, 'white', TONE_LIGHT)
    if (expr === 'focus') {
      // a brow, slanting down toward the nose
      const dir = k === 0 ? 1 : 1
      pen.px(X - 1, y0 - 2, 'ink', TONE_INK).px(X, y0 - 2 + (dir > 0 ? 0 : 1), 'ink', TONE_INK).px(X + 1, y0 - 1, 'ink', TONE_INK).px(X + 2, y0 - 1, 'ink', TONE_INK)
    }
  }
}

function mouth(pen: Pen, x: number, y: number, expr: string): void {
  const X = Math.round(x), Y = Math.round(y)
  if (expr === 'smug') pen.px(X, Y + 1, 'ink', TONE_INK).px(X + 1, Y + 1, 'ink', TONE_INK).px(X + 2, Y, 'ink', TONE_INK)
  else if (expr === 'happy' || expr === 'wink') pen.px(X - 1, Y, 'ink', TONE_INK).px(X, Y + 1, 'ink', TONE_INK).px(X + 1, Y + 1, 'ink', TONE_INK).px(X + 2, Y, 'ink', TONE_INK)
  else if (expr === 'hurt') pen.px(X, Y, 'ink', TONE_INK).px(X + 1, Y, 'ink', TONE_INK).px(X, Y + 1, 'ink', TONE_INK).px(X + 1, Y + 1, 'ink', TONE_INK)
}

const exprOf = (c: DrawCtx): string => (c.R.status.has('stunned') ? 'stun' : c.P.expression)

/** A wound: a plaster across the cheek (the face window is the one place the hair never covers). */
function bandage(pen: Pen, x: number, y: number): void {
  pen.poly([[x - 3, y - 1], [x + 3, y - 3], [x + 4, y], [x - 2, y + 2]], 'linen', { shade: 'top' })
  pen.px(Math.round(x), Math.round(y - 1), 'red', TONE_MID).px(Math.round(x) + 1, Math.round(y - 1), 'red', TONE_SHADE)
}

/**
 * The skull in 3/4 view, facing +x: the cranium bulges toward the back (−x)
 * and the face is the narrower, foreshortened front — never a symmetric ball.
 * The cheek fills the lower front; a nose bump breaks the front silhouette.
 */
function skull(pen: Pen, race: RaceId, rx: number, ry: number): void {
  const form = { cx: 0, cy: 0, rx, ry }
  pen.ellipse(-1.2, -0.8, rx, ry - 0.6, 'skin')
  if (race === 'elf') pen.poly([[-rx * 0.5, ry * 0.45], [rx * 0.86, ry * 0.36], [rx * 0.34, ry + 2.4]], 'skin', {}, form)
  else if (race !== 'reptilian') pen.ellipse(rx * 0.36, ry * 0.36, rx * 0.6, ry * 0.56, 'skin', {}, form)
  if (race === 'human' || race === 'elf') pen.ellipse(rx * 0.97, ry * 0.3, 1.8, 2, 'skin', {}, form)
}

export const head: PartFn = (c) => {
  const { P, R } = c
  const b = P.body
  const rx = b.headRx, ry = b.headRy
  const expr = exprOf(c)
  const ear = earOf(R.race, rx, ry, R.head)

  // what sits behind the head
  if (R.race === 'reptilian' && R.head === 'frill') {
    const fr = headPen(c)
    fr.ellipse(-rx * 0.5, -ry * 0.05, rx * 0.8, ry * 1.1, 'hair', { shade: 'round' })
    for (let k = -2; k <= 2; k++) {
      const a = (k * 32 - 180) * (Math.PI / 180)
      fr.line(-rx * 0.4, 0, -rx * 0.4 + Math.cos(a) * rx * 0.85, Math.sin(a) * ry * 1.05, 'hair', TONE_SHADE, F_ONLYON)
    }
  }

  const h = headPen(c)
  skull(h, R.race, rx, ry)
  if (R.race === 'dwarf' && R.hair === 'bald') h.px(-rx * 0.25, -ry * 0.78, 'skin', TONE_SPEC).px(-rx * 0.25 + 1, -ry * 0.8, 'skin', TONE_SPEC).px(-rx * 0.25 + 2, -ry * 0.8, 'skin', TONE_SPEC)
  if (R.race === 'human' && R.head === 'stubble') h.texture((x, y) => {
    const lx = x - P.head.x, ly = y - P.head.y
    return ly > ry * 0.5 && lx > -rx * 0.2 && (x + y) % 2 === 0 ? TONE_MID : null
  })
  if (R.race === 'reptilian') {
    h.texture((x, y, tone) => {
      const ly = y - P.head.y
      return ly < -ry * 0.2 && (x + (y % 4 < 2 ? 0 : 2)) % 4 === 0 && y % 2 === 0 && tone >= TONE_LIGHT ? TONE_MID : null
    })
  }

  // ears: a cupped ear (human, dwarf), a long leaf (elf), a short point (gnome)
  if ('pts' in ear) {
    const ep = headPen(c)
    ep.poly(ear.pts, 'skin', { shade: 'round' })
    ep.line(ear.pts[0][0] - 1, ear.pts[0][1] + 3, ear.pts[3][0] + 3, ear.pts[3][1] + 2, 'skin', TONE_SHADE, F_ONLYON)
  } else if (R.race !== 'reptilian') {
    headPen(c, { ring: 1 }).ellipse(ear.x, ear.y, ear.r - 0.4, ear.r + 0.6, 'skin').px(ear.x, ear.y, 'skin', TONE_SHADE).px(ear.x, ear.y + 1, 'skin', TONE_SHADE)
  }

  if (R.race === 'human' || R.race === 'elf') {
    const ey = R.race === 'elf' ? ry * 0.14 : ry * 0.18
    eyes(h, [{ x: rx * 0.3, y: ey }, { x: rx * 0.72, y: ey - 0.6 }], expr, 3)
    mouth(h, rx * 0.5, ry * 0.62, expr)
    if (R.wounded) bandage(headPen(c, { ring: 1 }), rx * 0.45, ry * 0.5)
  } else if (R.race === 'dwarf') {
    const beard = headPen(c)
    if (R.head === 'forked') {
      beard.ellipse(rx * 0.26, ry * 0.8, rx * 0.86, ry * 0.48, 'hair')
      beard.poly([[-rx * 0.3, ry * 0.9], [rx * 0.12, ry * 0.95], [-rx * 0.14, ry + 12]], 'hair')
      beard.poly([[rx * 0.28, ry * 0.92], [rx * 0.78, ry * 0.85], [rx * 0.52, ry + 12]], 'hair')
      beard.rect(-rx * 0.22 - 1.6, ry + 6, 3.4, 2.4, 'gold', { shade: TONE_LIGHT }).rect(rx * 0.52 - 1.8, ry + 6, 3.4, 2.4, 'gold', { shade: TONE_LIGHT })
    } else {
      beard.ellipse(rx * 0.26, ry * 0.8, rx * 0.9, ry * 0.5, 'hair')
      beard.poly([[-rx * 0.6, ry * 0.85], [rx * 1.0, ry * 0.75], [rx * 0.18, ry + 11]], 'hair', {}, { cx: rx * 0.2, cy: ry * 0.85, rx: rx * 0.9, ry: ry * 0.6 })
    }
    for (const k of [-0.2, 0.15, 0.5]) beard.line(rx * k, ry * 0.95, rx * (k - 0.04), ry + 6, 'hair', TONE_SHADE, F_ONLYON)
    eyes(h, [{ x: rx * 0.16, y: -ry * 0.04 }, { x: rx * 0.48, y: -ry * 0.08 }], expr, 2)
    // heavy brows in the beard's ink, on the skin
    h.rect(rx * 0.06, -ry * 0.3, rx * 0.56, 1.6, 'hair', { shade: TONE_MID })
    const mo = headPen(c, { ring: 1 })
    mo.ellipse(rx * 0.5, ry * 0.46, 4.6, 2.2, 'hair').ellipse(rx * 0.96, ry * 0.44, 3.4, 2, 'hair')
    headPen(c, { ring: 1 }).ellipse(rx * 0.8, ry * 0.2, 3.4, 3.2, 'skin', { gloss: true })
    if (R.wounded) bandage(headPen(c, { ring: 1 }), -rx * 0.05, -ry * 0.5)
  } else if (R.race === 'reptilian') {
    const long = R.head !== 'frill'
    const sn = headPen(c)
    sn.ellipse(rx * 0.62, ry * 0.3, long ? 10.5 : 8, long ? 6.4 : 6, 'skin', { gloss: true })
    sn.texture((_x, y) => (y - P.head.y > ry * 0.48 ? TONE_LIGHT : null))
    sn.line(rx * 0.12, ry * 0.58, rx * 0.62 + (long ? 9 : 6.5), ry * 0.44, 'ink', TONE_INK, F_ONLYON)
    sn.px(rx * 0.62 + (long ? 7.5 : 5), ry * 0.05, 'ink', TONE_INK).px(rx * 0.62 + (long ? 8.5 : 6), ry * 0.05, 'ink', TONE_INK)
    if (!long) headPen(c, { ring: 1 }).poly([[rx * 0.62 + 2, ry * 0.0], [rx * 0.62 + 6, ry * 0.02], [rx * 0.62 + 5, -ry * 0.5]], 'bone', { shade: 'round' })
    const ey = headPen(c, { ring: 1 })
    if (expr === 'stun' || expr === 'hurt' || expr === 'happy') {
      ey.ellipse(rx * 0.18, -ry * 0.12, 3.2, 2.8, 'skin')
      eyes(ey, [{ x: rx * 0.18 - 0.5, y: -ry * 0.12 }], expr)
    } else {
      ey.ellipse(rx * 0.18, -ry * 0.12, 3.4, expr === 'focus' ? 2.2 : 3, 'gold', { gloss: true })
      ey.line(rx * 0.18 + 0.5, -ry * 0.12 - 2, rx * 0.18 + 0.5, -ry * 0.12 + 2, 'ink', TONE_INK, F_ONLYON)
    }
    h.line(rx * 0.18 - 4, -ry * 0.12 - 4, rx * 0.18 + 4, -ry * 0.12 - 5, 'ink', TONE_INK, F_ONLYON)
    if (P.fx.tongue) {
      // a forked tongue tasting the air, out of the mouth's corner at the snout tip
      const tx = rx * 0.62 + (long ? 9.5 : 7), ty = ry * 0.45
      const len = P.fx.tongue === 2 ? 8 : 4
      const tg = headPen(c, { ring: 1 })
      tg.line(tx, ty, tx + len, ty + 1, 'red', TONE_LIGHT).line(tx, ty + 1, tx + len, ty + 2, 'red', TONE_MID)
      if (P.fx.tongue === 2) tg.line(tx + len, ty + 1, tx + len + 2, ty - 1, 'red', TONE_LIGHT).line(tx + len, ty + 2, tx + len + 2, ty + 4, 'red', TONE_MID)
    }
    if (R.wounded) bandage(headPen(c, { ring: 1 }), -rx * 0.25, ry * 0.2)
  } else {
    // gnome: small high eyes, a rosy cheek, a white mustache, the big nose over it
    eyes(h, [{ x: rx * 0.12, y: -ry * 0.12 }, { x: rx * 0.44, y: -ry * 0.16 }], expr, 2)
    h.px(rx * 0.12 - 1, ry * 0.2, 'rose', TONE_LIGHT).px(rx * 0.12, ry * 0.2, 'rose', TONE_LIGHT)
    const mo = headPen(c, { ring: 1 })
    mo.ellipse(rx * 0.5, ry * 0.55, 4.6, 2.6, 'hair').ellipse(rx * 0.92, ry * 0.52, 3.8, 2.4, 'hair')
    const nose = headPen(c, { ring: 1 })
    if (R.head === 'long') nose.poly([[rx * 0.52, ry * 0.0], [rx * 0.66, ry * 0.42], [rx + 7, ry * 0.34]], 'skin', { gloss: true }, { cx: rx * 0.72, cy: ry * 0.2, rx: 6, ry: 4 })
    else nose.ellipse(rx * 0.8, ry * 0.24, 4.2, 4, 'skin', { gloss: true })
    mouth(h, rx * 0.5, ry * 0.76, expr)
    if (R.wounded) bandage(headPen(c, { ring: 1 }), -rx * 0.15, -ry * 0.5)
  }
}

/** Cut the race's ear window out of a hair / hood pen (head-local). */
function earWindow(pen: Pen, c: DrawCtx): void {
  const b = c.P.body
  const ear = earOf(c.R.race, b.headRx, b.headRy, c.R.head)
  if ('pts' in ear) pen.cutPoly(ear.window)
  else pen.cutEllipse(ear.x, ear.y + 0.5, ear.r + 1.2, ear.r + 2)
}

export const hair: PartFn = (c) => {
  const { P, R } = c
  const b = P.body
  const rx = b.headRx, ry = b.headRy
  const v = R.hair
  if (R.race === 'reptilian') {
    const pen = headPen(c)
    if (v === 'spines') {
      for (let k = 0; k < 4; k++) {
        const a = (-150 + k * 22) * (Math.PI / 180)
        const bx = Math.cos(a) * rx * 0.92, by = Math.sin(a) * ry * 0.92
        pen.poly([[bx - 2.4, by + 1], [bx + 2.4, by + 1.5], [bx + Math.cos(a) * 6 - 1, by + Math.sin(a) * 6]], 'hair', { shade: 'round' })
      }
    } else {
      for (let k = 0; k < 3; k++) {
        const x = -rx * 0.55 + k * rx * 0.42
        const y = -ry * 0.82 + Math.abs(k - 0.6) * 1.5
        pen.poly([[x - 3.5, y + 4], [x + 3.5, y + 3], [x - 1.5 - k * 0.5, y - 7 + k]], 'hair', { shade: 'round' }, { cx: -rx * 0.1, cy: -ry, rx: rx * 0.8, ry: 6 })
      }
    }
    return
  }
  // a hood from the body piece takes the hair's place
  const hood = R.body && (R.body.family === 'hood' || (R.body.family === 'cloak' && R.body.p?.variant === 'hooded'))
  if (hood) {
    const pen = headPen(c, { mats: itemMats(c, R.body!, 'body') })
    pen.ellipse(-1.5, -ry * 0.12, rx + 3, ry + 2.5, 'field')
    pen.poly([[-rx - 2, -ry * 0.2], [-rx - 9, ry * 0.1], [-rx * 0.4, ry * 0.7]], 'field', {}, { cx: 0, cy: 0, rx: rx + 3, ry: ry + 2 })
    pen.cutEllipse(rx * 0.5, ry * 0.36, rx * 0.78, ry * 0.7)
    if (R.race === 'elf' || R.race === 'gnome') earWindow(pen, c)
    pen.texture((x, y) => {
      const lx = x - P.head.x, ly = y - P.head.y
      const d = ((lx - rx * 0.5) / (rx * 0.78 + 2)) ** 2 + ((ly - ry * 0.36) / (ry * 0.7 + 2)) ** 2
      return d < 1 ? TONE_SHADE : null
    })
    return
  }
  if (R.race === 'human' && v === 'scarf') {
    // a headscarf knotted at the back, its tail hanging; a lock of hair at the temple
    const f = P.frame % 6
    const tail = headPen(c)
    tail.poly([[-rx - 1, -ry * 0.05], [-rx - 4 - (f % 3), ry * 0.7], [-rx - 1 - (f % 3), ry * 1.05], [-rx + 3, ry * 0.4]], 'cloth', { shade: 'round' })
    const pen = headPen(c)
    pen.ellipse(-1.5, -ry * 0.22, rx + 2, ry * 0.86, 'cloth')
    pen.ellipse(-rx * 0.45, ry * 0.12, rx * 0.6, ry * 0.62, 'cloth')
    pen.cutEllipse(rx * 0.56, ry * 0.5, rx * 0.8, ry * 0.68)
    pen.texture((_x, y) => {
      const ly = y - P.head.y
      return ly > -ry * 0.62 && ly < -ry * 0.46 ? TONE_LIGHT : null
    }, 'trim')
    headPen(c, { ring: 1 }).circle(-rx * 0.95, -ry * 0.12, 4, 'cloth', { shade: 'round' })
    headPen(c, { ring: 1 }).ellipse(-rx * 0.06, -ry * 0.06, 2.6, 4, 'hair', { shade: 'round' })
    return
  }
  if (R.race === 'gnome' && (v === 'cap' || v === 'sproutcap')) {
    const pen = headPen(c)
    pen.poly([[-rx - 2, -ry * 0.12], [rx + 1, -ry * 0.22], [rx * 0.35, -ry * 0.95], [-rx * 0.3, -ry - 12], [-rx * 0.95, -ry - 18], [-rx * 0.62, -ry - 6], [-rx * 0.85, -ry * 0.65]], 'cloth', { shade: 'round' }, { cx: -rx * 0.1, cy: -ry * 0.8, rx: rx + 2, ry: ry * 0.9 })
    pen.cutEllipse(rx * 0.55, ry * 0.36, rx * 0.86, ry * 0.58)
    earWindow(pen, c)
    pen.texture((_x, y) => (y - P.head.y > -ry * 0.42 && y - P.head.y < -ry * 0.24 ? TONE_LIGHT : null), 'trim')
    headPen(c, { ring: 1 }).ellipse(-rx * 0.72, ry * 0.25, 4.2, 5.5, 'hair')
    if (v === 'sproutcap') {
      // a sprout growing out of the bent tip
      const sp = headPen(c, { ring: 1 })
      const tx = -rx * 0.95, ty = -ry - 18
      sp.line(tx, ty, tx - 1, ty - 5, 'leaf', TONE_MID)
      sp.ellipse(tx - 4, ty - 6, 3.4, 1.8, 'leaf', { shade: 'round' }).ellipse(tx + 2, ty - 7, 3.4, 1.8, 'leaf', { shade: 'round' })
    }
    return
  }
  if (R.race === 'gnome') {
    // two white puffs behind and above the ear (never over it)
    const pen = headPen(c)
    pen.ellipse(-rx * 0.62, -ry * 0.42, 6.5, 5, 'hair')
    pen.ellipse(-rx * 0.92, ry * 0.0, 4.2, 6, 'hair')
    pen.poly([[-rx * 0.4, -ry * 0.62], [-rx * 0.1, -ry * 0.9], [-rx * 0.2, -ry * 0.5]], 'hair')
    earWindow(pen, c)
    return
  }
  if (R.race === 'dwarf' && v === 'bald') {
    const pen = headPen(c)
    pen.ellipse(-rx * 0.66, ry * 0.12, rx * 0.4, ry * 0.5, 'hair')
    earWindow(pen, c)
    return
  }
  const pen = headPen(c)
  if (v === 'tail' || v === 'topknot') {
    const ex = headPen(c)
    if (v === 'tail') {
      ex.capsule(-rx * 0.75, -ry * 0.25, -rx - 6, ry * 0.55, 3.6, 'hair')
      ex.capsule(-rx - 6, ry * 0.55, -rx - 4, ry * 0.95, 2.6, 'hair')
    } else ex.circle(-rx * 0.22, -ry - 2.5, 5.5, 'hair')
  }
  if (R.race === 'elf' && v === 'long') {
    pen.poly([[-rx * 0.9, -ry * 0.3], [-rx - 3, ry * 0.6], [-rx - 1, ry + 9], [-rx * 0.35, ry + 7], [-rx * 0.15, ry * 0.2]], 'hair', { shade: 'round' }, { cx: -rx * 0.6, cy: ry * 0.4, rx: rx * 0.6, ry: ry })
  }
  const crown = R.race === 'dwarf' ? 0.7 : v === 'topknot' ? 0.62 : 0.74
  pen.ellipse(-2, -ry * 0.36, rx + 1.4, ry * crown, 'hair')
  pen.ellipse(-rx * 0.55, ry * 0.05, rx * 0.52, ry * 0.6, 'hair')
  // the face window, then one lock swept onto the brow
  pen.cutEllipse(rx * 0.56, ry * 0.44, rx * 0.8, ry * 0.76)
  pen.poly([[-rx * 0.05, -ry * 0.36], [rx * 0.5, -ry * 0.4], [rx * 0.16, -ry * 0.14]], 'hair')
  earWindow(pen, c)
}

// ── arms ───────────────────────────────────────────────────────────────────

const OFF_HIDES_HAND = new Set(['shieldRound', 'shieldKite', 'shieldHeater', 'buckler', 'pavise'])

function arm(c: DrawCtx, side: 'main' | 'off'): void {
  const { P, R } = c
  const b = P.body
  const sh = side === 'main' ? P.shoulderMain : P.shoulderOff
  const h = side === 'main' ? P.mainHand : P.offHand
  const plate = R.body?.family === 'plate'
  const robe = R.body?.family === 'robe'
  const mail = R.body?.family === 'mail'
  const sleeveMat = plate ? 'metal' : mail ? 'blade' : robe ? 'robeSleeve' : 'cloth'
  const dx = h.x - sh.x, dy = h.y - sh.y
  const d = Math.hypot(dx, dy) || 1
  const wrist = { x: h.x - (dx / d) * b.handR * 0.6, y: h.y - (dy / d) * b.handR * 0.6 }
  const sleeve = c.piece({ mats: R.body ? itemMats(c, R.body, 'body') : undefined })
  sleeve.capsule(sh.x, sh.y, wrist.x, wrist.y, b.armR, sleeveMat)
  // does this fist close over something?
  let front = false
  if (side === 'main') front = !!R.main
  else if (P.grip === 'two') front = true
  else if (P.grip === 'twin') front = true
  else if (P.grip === 'bow') front = false
  else if (R.off) front = !OFF_HIDES_HAND.has(R.off.family) && R.off.family !== 'quiver' && R.off.family !== 'javelins'
  const fist = c.piece({ front, mats: R.body ? itemMats(c, R.body, 'body') : undefined })
  fist.circle(h.x, h.y, b.handR, plate ? 'metal' : 'skin', { gloss: plate })
  // a knuckle line
  fist.line(h.x - b.handR * 0.3, h.y - b.handR * 0.2, h.x + b.handR * 0.4, h.y - b.handR * 0.2, plate ? 'metal' : 'skin', TONE_SHADE, F_ONLYON)
}
export const mainArm: PartFn = (c) => arm(c, 'main')
export const offArm: PartFn = (c) => arm(c, 'off')

// ── item inks: blade, haft, trim and gem by rarity, the field, the glow ────

const RARITY_RANK: Readonly<Record<Rarity, number>> = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 }
const RARITY_GEM: Readonly<Record<Rarity, RampId>> = { common: 'red', rare: 'aqua', epic: 'plum', legendary: 'red', mythic: 'ember' }

export const rankOf = (r: Rarity): number => RARITY_RANK[r]

/** An item's material resolver: its own knobs, then rarity, then skill tells, then the look. */
export function itemMats(c: DrawCtx, it: ItemPart, slot: HandSlot): MatResolver {
  const base = c.R.mats
  const rarity = c.R.rarity[slot]
  const rank = RARITY_RANK[rarity]
  const tell = slot === 'main' ? (c.R.tells.has('burn') ? 'ember' : c.R.tells.has('frost') ? 'frost' : c.R.tells.has('venom') ? 'venom' : null) : null
  const plain = it.p?.variant === 'plain'
  return (m: string): RampId => {
    switch (m) {
      case 'blade': return tell ?? it.p?.blade ?? base('metal')
      case 'head': return it.p?.blade ?? base('metal')
      case 'haft': return it.p?.haft ?? 'wood'
      case 'grip': return base('leather')
      case 'itemTrim': return plain ? 'iron' : rank >= 3 ? 'gold' : rank >= 1 ? 'steel' : it.p?.trim ?? 'iron'
      case 'gem': return RARITY_GEM[rarity]
      case 'field': return it.p?.cloth ?? base('cloth')
      case 'fieldTrim': return rank >= 3 ? 'gold' : rank >= 1 ? 'steel' : it.p?.trim ?? base('trim')
      case 'glowInk': return it.p?.glow ?? 'ember'
      case 'robeSleeve': return it.p?.cloth ?? base('cloth')
      default: return base(m)
    }
  }
}

/** Does this item show a gem (rare and up)? */
const gemmed = (c: DrawCtx, slot: HandSlot) => RARITY_RANK[c.R.rarity[slot]] >= 1

/** How far a pole's butt may reach before it meets the ground (local +y, px). */
function groundLen(_P: Pose, hand: { y: number; angle: number }, max: number): number {
  const cos = Math.cos((hand.angle * Math.PI) / 180)
  if (cos < 0.3) return max
  return Math.max(4, Math.min(max, (FEET - 1 - hand.y) / cos))
}

/** Items are drawn once at their own size and scaled to the body (the rig's px are 1.2× the first draft's). */
export const ITEM_SCALE = 1.2

// ── weapons (main hand) ────────────────────────────────────────────────────

type ItemFn = (c: DrawCtx, it: ItemPart, slot: HandSlot) => void

/**
 * A held item's pen: at the hand, turned to the hand's angle. `reach` (local
 * px, up the item) stops a swing at the ground: a blade that would bury its
 * tip below the feet is held at the angle where it meets them instead.
 */
function handPen(c: DrawCtx, it: ItemPart, slot: HandSlot, o: PieceOpts = {}, reach = 0): Pen {
  const h = slot === 'off' ? c.P.offHand : c.P.mainHand
  return c.piece({ ...o, mats: itemMats(c, it, slot) }).at(h.x, h.y, groundedAngle(h, reach), false, ITEM_SCALE)
}

/** The hand's angle, or the one where an item `reach` long touches the ground (FEET + 1). */
function groundedAngle(h: { x: number; y: number; angle: number }, reach: number): number {
  if (!reach) return h.angle
  const L = reach * ITEM_SCALE
  const down = -Math.cos((h.angle * Math.PI) / 180) * L
  const room = FEET + 1 - h.y
  if (h.y + down <= FEET + 1 || room >= L) return h.angle
  const a = (Math.acos(Math.max(-1, Math.min(1, -room / L))) * 180) / Math.PI
  return h.angle >= 0 ? Math.min(h.angle, a) : Math.max(h.angle, -a)
}

function publishTip(c: DrawCtx, pen: Pen, slot: HandSlot, tipY: number): void {
  if (slot !== 'main') return
  const [tx, ty] = pen.toWorld(0, tipY)
  const [bx, by] = pen.toWorld(0, 0)
  c.marks.mainTip = [tx, ty]
  c.marks.mainBase = [bx, by]
  c.marks.mainLen = Math.abs(tipY)
}

/** A straight or curved blade from y0 up `len`, half-width `w`; `curve` bends it toward +x. */
function bladePoly(y0: number, len: number, w: number, curve = 0, point = 4, widen = 0): Pt[] {
  const L: Pt[] = [], Rr: Pt[] = []
  const n = 8
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const cx = curve * t * t
    const ww = w + widen * t
    L.push([cx - ww, y0 - len * t])
    Rr.push([cx + ww, y0 - len * t])
  }
  const tip: Pt = [curve + (widen > 0 ? w * 0.6 : 0), y0 - len - point]
  return [...L, tip, ...Rr.reverse()]
}

const sword: ItemFn = (c, it, slot) => {
  const s = it.p?.size ?? 1
  const great = it.family === 'greatsword'
  const sabre = it.family === 'sabre'
  const falchion = it.family === 'falchion'
  const len = (great ? 34 : falchion ? 20 : 23) * s
  const w = (great ? 3.3 : 2.5) * s
  const reach = 5 + len + 6
  const blade = handPen(c, it, slot, {}, reach)
  blade.poly(bladePoly(-5, len, w, sabre ? 5 * s : 0, falchion ? 2 : great ? 5 : 4, falchion ? 2.2 : 0), 'blade', { shade: 'cyl', gloss: true }, { cx: 0, cy: -5 - len / 2, rx: w + 1, ry: len / 2 })
  // the edge's light line
  blade.line(sabre ? 1 : -0.5, -7, (sabre ? 5 * s : 0) - 0.5, -5 - len + 2, 'blade', TONE_SPEC, F_ONLYON)
  const guard = handPen(c, it, slot, {}, reach)
  const gw = (great ? 8.5 : it.p?.variant === 'arming' ? 7.5 : 6) * s
  if (it.p?.variant === 'arming') guard.poly([[-gw, -7.5], [-gw + 2, -5.5], [gw - 2, -5.5], [gw, -7.5], [gw, -4], [-gw, -4]], 'itemTrim', { shade: 'top' })
  else guard.rect(-gw, -6.5, gw * 2, 3, 'itemTrim', { shade: 'top', gloss: true })
  guard.rect(-1.7, -3.5, 3.4, great ? 15 : 7.5, 'grip', { shade: 'cyl' })
  guard.circle(0, great ? 12.5 : 5, great ? 2.8 : 2.4, 'itemTrim', { gloss: true })
  if (sabre) guard.line(gw - 1, -4, 3, 5, 'itemTrim', TONE_MID)
  if (gemmed(c, slot)) handPen(c, it, slot, { ring: 1 }, reach).circle(0, -5, 1.6, 'gem', { gloss: true })
  publishTip(c, blade, slot, -5 - len - 3)
}

const dagger: ItemFn = (c, it, slot) => {
  const s = it.p?.size ?? 1
  const len = 11 * s
  const v = it.p?.variant
  const blade = handPen(c, it, slot)
  if (v === 'fang') blade.poly(bladePoly(-4, len, 2.4, 3, 3, -1), 'blade', { shade: 'cyl', gloss: true })
  else blade.poly(bladePoly(-4, len, 2, v === 'curved' ? 4 : 0, 3), 'blade', { shade: 'cyl', gloss: true })
  blade.line(-0.4, -6, -0.4 + (v === 'curved' || v === 'fang' ? 2 : 0), -4 - len + 1, 'blade', TONE_SPEC, F_ONLYON)
  const g = handPen(c, it, slot)
  if (v !== 'fang') g.rect(-4, -5, 8, 2.4, 'itemTrim', { shade: 'top' })
  g.rect(-1.5, -3, 3, 6.5, 'grip', { shade: 'cyl' })
  g.circle(0, 4, 1.8, 'itemTrim')
  if (gemmed(c, slot)) handPen(c, it, slot, { ring: 1 }).circle(0, -3.6, 1.3, 'gem', { gloss: true })
  publishTip(c, blade, slot, -4 - len - 2)
}

/** A haft with a head: axes, hammers, picks, clubs, hooks. */
const hafted: ItemFn = (c, it, slot) => {
  const s = it.p?.size ?? 1
  const fam = it.family
  const two = fam === 'greataxe' || fam === 'maul'
  // a heavy two-hander is choked up into the blow: the hands slide up the haft at impact
  const slide = two && c.P.anim === 'attack' ? [0, 0, 6, 12, 10, 2][c.P.frame % 6] : 0
  const top = (two ? -32 : -21) * s + slide
  const butt = two ? (slide ? 10 + slide : groundLen(c.P, slot === 'off' ? c.P.offHand : c.P.mainHand, 14)) : 6
  const reach = -top + (two ? 9 : 6) * s + 4
  const hp = handPen(c, it, slot, {}, reach)
  if (fam === 'club') {
    hp.poly([[-1.8, 5], [1.8, 5], [4.6, top + 3], [-4.6, top + 3]], 'head', { shade: 'cyl' })
  } else hp.capsule(0, butt, 0, top + 2, two ? 2.1 : 1.8, 'haft')
  const head = handPen(c, it, slot, {}, reach)
  if (fam === 'axe' || fam === 'greataxe') {
    const bw = (two ? 11 : 9) * s, bh = (two ? 15 : 11) * s
    const beard = it.p?.variant === 'bearded'
    const y = top + 3
    head.poly([[0, y - bh * 0.3], [bw * 0.6, y - bh * 0.42], [bw, y - bh * 0.62], [bw + 1, y], [bw, y + bh * 0.42 + (beard ? 5 : 0)], [beard ? bw * 0.35 : bw * 0.6, y + bh * 0.4 + (beard ? 2 : 0)], [0, y + bh * 0.3]], 'blade', { shade: 'round', gloss: true })
    if (fam === 'greataxe') head.poly([[0, y - bh * 0.3], [-bw * 0.8, y - bh * 0.5], [-bw - 0.5, y], [-bw * 0.8, y + bh * 0.5], [0, y + bh * 0.3]], 'blade', { shade: 'round', gloss: true })
    else head.rect(-4, y - 2.5, 4, 5, 'blade', { shade: 'round' })
    head.line(bw + 0.5, y - bh * 0.5, bw + 0.5, y + bh * 0.35, 'blade', TONE_SPEC, F_ONLYON)
    publishTip(c, head, slot, y - bh * 0.62)
  } else if (fam === 'hammer' || fam === 'maul') {
    const hw = (two ? 9 : 6) * s, hh = (two ? 7 : 5) * s
    const y = top + 1
    if (it.p?.variant === 'bone') {
      head.ellipse(0, y, hw + 1, hh + 1.5, 'head', { gloss: true })
      head.circle(-hw, y - hh, 3, 'head').circle(hw, y - hh, 3, 'head')
    } else {
      head.rect(-hw, y - hh, hw * 2, hh * 2, 'head', { shade: 'round', gloss: true })
      head.rect(-hw - 1, y - hh - 1, 2.5, hh * 2 + 2, 'itemTrim', { shade: 'top' })
      head.rect(hw - 1.5, y - hh - 1, 2.5, hh * 2 + 2, 'itemTrim', { shade: 'top' })
      if (it.p?.variant === 'spike') head.poly([[-2.5, y - hh], [2.5, y - hh], [0, y - hh - 7]], 'head', { shade: 'round' })
    }
    publishTip(c, head, slot, y - hh)
  } else if (fam === 'pick') {
    const y = top + 2
    head.poly([[-10 * s, y + 4], [-4, y - 3.5], [4, y - 3.5], [11 * s, y + 3], [3, y + 0.5], [-3, y + 0.5]], 'head', { shade: 'round', gloss: true })
    publishTip(c, head, slot, y)
  } else if (fam === 'club') {
    head.ellipse(0, top + 1, 5.6 * s, 5 * s, 'head', { gloss: true })
    head.circle(-3.5, top + 5, 2, 'head').circle(4, top + 3, 2, 'head')
    publishTip(c, head, slot, top - 3)
  } else if (fam === 'hook') {
    const y = top + 6
    for (let a = 180; a <= 400; a += 18) {
      const r = (a * Math.PI) / 180
      head.circle(3.5 + Math.cos(r) * 4, y + Math.sin(r) * 4.5, 1.8, 'head', { shade: 'round', gloss: true })
    }
    head.poly([[6.5, y + 2], [8.5, y + 1], [7.6, y + 6]], 'head')
    publishTip(c, head, slot, y - 4)
  } else if (fam === 'cleaver') {
    const bw = 11 * s, bh = 15 * s
    head.poly([[-1, -2], [bw, -3], [bw + 0.5, -3 - bh], [-1, -1 - bh * 0.9]], 'blade', { shade: 'round', gloss: true })
    head.line(bw, -4, bw, -2 - bh, 'blade', TONE_SPEC, F_ONLYON)
    head.cutEllipse(2.5, -bh * 0.82, 1.6, 1.6)
    publishTip(c, head, slot, -bh)
  }
  if (fam === 'cleaver') {
    // a short grip under the blade
    const g = handPen(c, it, slot, {}, reach)
    g.rect(-1.6, -2, 3.2, 8, 'grip', { shade: 'cyl' })
    g.circle(0, 6.5, 1.6, 'itemTrim')
  }
  if (gemmed(c, slot)) handPen(c, it, slot, { ring: 1 }, reach).circle(0, top + (fam === 'cleaver' ? 6 : 4), 1.5, 'gem', { gloss: true })
}

/** Poles: spears, polearms, banners. */
const pole: ItemFn = (c, it, slot) => {
  const s = it.p?.size ?? 1
  const fam = it.family
  const hand = slot === 'off' ? c.P.offHand : c.P.mainHand
  // at the thrust the hands slide back along the shaft (the pole runs out ahead, its butt behind)
  const slide = c.P.anim === 'attack' && c.P.motion === 'thrust' ? [4, 6, 16, 16, 8, 0][c.P.frame % 6] : 0
  const top = -38 * s + slide
  const butt = slide ? 18 + slide : groundLen(c.P, hand, 18)
  const sh = handPen(c, it, slot)
  sh.capsule(0, butt, 0, top + 4, 1.6, 'haft')
  if (fam === 'harpoon') for (const y of [top + 9, top + 11, top + 13]) sh.line(-2, y, 2, y - 1, 'itemTrim', TONE_LIGHT)
  const head = handPen(c, it, slot)
  let tipY = top - 10
  if (fam === 'spear') {
    if (it.p?.variant === 'tooth') {
      head.poly([[-2.6, top + 2], [2.8, top + 2], [3.5, top - 6], [0.5, top - 13], [-1.5, top - 5]], 'blade', { shade: 'round', gloss: true })
      tipY = top - 13
    } else {
      head.poly([[0, top - 10], [3.4, top - 3], [2.2, top + 3], [-2.2, top + 3], [-3.4, top - 3]], 'blade', { shade: 'round', gloss: true })
    }
    head.rect(-2.2, top + 2.5, 4.4, 2.8, 'itemTrim', { shade: 'top' })
  } else if (fam === 'halberd') {
    head.poly([[0, top - 9], [2, top - 2], [-2, top - 2]], 'blade', { shade: 'round' })
    head.poly([[1, top - 1], [8, top - 4], [10, top + 3], [8, top + 9], [1, top + 6]], 'blade', { shade: 'round', gloss: true })
    head.poly([[-1, top + 1], [-6, top - 1], [-2, top + 4]], 'blade', { shade: 'round' })
    tipY = top - 9
  } else if (fam === 'glaive') {
    head.poly(bladePoly(top + 4, 15, 2.6, 4, 3, 1.2), 'blade', { shade: 'cyl', gloss: true })
    tipY = top - 14
  } else if (fam === 'harpoon') {
    head.poly([[0, top - 9], [3, top - 2], [5, top + 2], [1.2, top], [1.2, top + 4], [-1.2, top + 4], [-1.2, top], [-5, top + 2], [-3, top - 2]], 'blade', { shade: 'round', gloss: true })
    tipY = top - 9
  } else if (fam === 'banner') {
    head.poly([[0, top - 6], [2, top - 1], [-2, top - 1]], 'itemTrim', { shade: 'round', gloss: true })
    head.rect(-4, top + 1, 8, 2, 'itemTrim', { shade: 'top' })
    tipY = top - 6
    // the flag hangs from the crossbar, in the world (it falls, whatever the pole does)
    const [fx, fy] = sh.toWorld(0, top + 2)
    flag(c, it, slot, fx, fy, 15 * s, 16 * s, 1)
  }
  if (gemmed(c, slot)) handPen(c, it, slot, { ring: 1 }).circle(0, top + 6.5, 1.5, 'gem', { gloss: true })
  publishTip(c, head, slot, tipY)
}

/** A cloth flag from (x, y), `w` wide trailing toward `dir`, waving by frame. */
function flag(c: DrawCtx, it: ItemPart | null, slot: HandSlot, x: number, y: number, w: number, h: number, dir: 1 | -1): void {
  const pen = c.piece({ mats: it ? itemMats(c, it, slot) : c.R.mats })
  const f = c.P.frame
  const wave = (t: number) => Math.sin(t * 3.2 + f * 1.1) * 1.4 * t
  const pts: Pt[] = []
  const n = 6
  for (let i = 0; i <= n; i++) pts.push([x + dir * (w * i) / n, y + wave(i / n)])
  pts.push([x + dir * w, y + h * 0.82 + wave(1)], [x + dir * w * 0.78, y + h * 0.6 + wave(0.8)], [x + dir * w * 0.55, y + h + wave(0.55)], [x, y + h])
  pen.poly(pts, it ? 'field' : 'cloth', { shade: 'top' })
  // a trim band down the hoist and the charge
  pen.rect(dir > 0 ? x : x - 2.5, y, 2.5, h, it ? 'fieldTrim' : 'trim', { shade: TONE_LIGHT, flags: F_ONLYON })
  const em = it?.p?.emblem
  const ex = x + dir * w * 0.45, ey = y + h * 0.42
  if (em === 'chili') chili(pen, ex, ey)
  else if (em === 'star') star(pen, ex, ey, it ? 'fieldTrim' : 'trim')
  else pen.circle(ex, ey, 2.4, it ? 'fieldTrim' : 'trim', { shade: TONE_LIGHT, flags: F_ONLYON })
}

function chili(pen: Pen, x: number, y: number): void {
  pen.poly([[x - 3, y - 2], [x + 1, y - 1], [x + 3, y + 3], [x + 1, y + 2], [x - 2, y]], 'red', { shade: TONE_MID, flags: F_ONLYON })
  pen.px(x - 3, y - 3, 'leaf', TONE_MID, F_ONLYON).px(x - 4, y - 3, 'leaf', TONE_MID, F_ONLYON)
}
function star(pen: Pen, x: number, y: number, mat: string, flags = F_ONLYON): void {
  const X = Math.round(x), Y = Math.round(y)
  for (const [dx, dy] of [[0, -2], [0, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [0, 1], [-1, 2], [1, 2]] as const) pen.px(X + dx, Y + dy, mat, TONE_LIGHT, flags)
}

const bow: ItemFn = (c, it, slot) => {
  const s = it.p?.size ?? 1
  const R0 = 19 * s
  const B = 6 * s
  const pen = handPen(c, it, slot)
  const curl = it.p?.variant === 'recurve'
  const pts: Pt[] = []
  for (let i = 0; i <= 16; i++) {
    const t = -1 + (i / 16) * 2
    let x = B * (1 - t * t) - 1
    if (curl && Math.abs(t) > 0.8) x += (Math.abs(t) - 0.8) * 14
    pts.push([x, t * R0])
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const t = Math.abs(-1 + (i / 16) * 2)
    pen.capsule(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 2.1 - t * 0.7, 'haft')
  }
  pen.rect(B - 2.6, -3, 3.2, 6, 'itemTrim', { shade: 'top' })
  if (gemmed(c, slot)) handPen(c, it, slot, { ring: 1 }).circle(B - 1, -5.5, 1.4, 'gem', { gloss: true })
  // the string: light, unlined, tip to tip — or to the drawing hand
  const str = c.piece({ ring: 0, mats: itemMats(c, it, slot) })
  const [ax, ay] = pen.toWorld(pts[0][0] - 0.5, pts[0][1] + 1)
  const [bx, by] = pen.toWorld(pts[16][0] - 0.5, pts[16][1] - 1)
  const off = c.P.offHand
  if (c.P.drawn) {
    str.line(ax, ay, off.x, off.y, 'linen', TONE_LIGHT, F_NOINK).line(bx, by, off.x, off.y, 'linen', TONE_LIGHT, F_NOINK)
    // the nocked arrow, from the drawing hand past the bow
    const [gx, gy] = pen.toWorld(B + 4, 0)
    const ar = c.piece({ ring: 1 })
    ar.line(off.x, off.y, gx, gy, 'wood', TONE_LIGHT).line(off.x, off.y - 1, gx, gy - 1, 'wood', TONE_MID)
    ar.poly([[gx, gy - 2.5], [gx + 4, gy - 0.5], [gx, gy + 1.5]], 'steel', { shade: 'round' })
  } else str.line(ax, ay, bx, by, 'linen', TONE_LIGHT, F_NOINK)
  publishTip(c, pen, slot, -R0)
  if (slot === 'main') {
    const [gx, gy] = pen.toWorld(B + 4, 0)
    c.marks.mainTip = [gx, gy]
  }
}

/** Staffs, wands, sceptres. */
const rod: ItemFn = (c, it, slot) => {
  const s = it.p?.size ?? 1
  const fam = it.family
  const v = it.p?.variant
  const hand = slot === 'off' ? c.P.offHand : c.P.mainHand
  const staff = fam === 'staff'
  const top = (staff ? -32 : -18) * s
  const butt = staff ? groundLen(c.P, hand, 16) : 4
  const sh = handPen(c, it, slot)
  if (v === 'rod') sh.capsule(0, butt, 0, top + 1, 1.6, 'itemTrim')
  else sh.capsule(0, butt, 0, top + 2, staff ? 2 : 1.7, v === 'thorn' ? 'soot' : v === 'coil' ? 'brass' : 'haft')
  if (v === 'thorn') for (const y of [top + 4, top + 8, top + 12]) sh.px(2, y, 'soot', TONE_LIGHT).px(-2, y + 2, 'soot', TONE_LIGHT)
  if (v === 'coil') for (let y = top + 3; y < butt - 2; y += 2) sh.line(-1.5, y, 1.5, y + 1, 'brass', TONE_SPEC, F_ONLYON)
  const head = handPen(c, it, slot)
  let tipY = top - 4
  if (fam === 'sceptre') {
    head.poly([[-4, top + 2], [4, top + 2], [5, top - 3], [0, top - 1], [-5, top - 3]], 'itemTrim', { shade: 'round', gloss: true })
    head.circle(0, top - 4.5, 3, 'gem', { gloss: true })
    tipY = top - 7
  } else if (v === 'sprout' || v === 'bloom') {
    head.ellipse(-3.5, top + 1, 3.8, 1.8, 'leaf', { shade: 'round' }).ellipse(3.5, top - 1, 3.8, 1.8, 'leaf', { shade: 'round' })
    if (v === 'bloom') {
      for (let k = 0; k < 5; k++) {
        const a = (k * 72 - 90) * (Math.PI / 180)
        head.circle(Math.cos(a) * 4, top - 6 + Math.sin(a) * 4, 2.8, 'rose', { shade: 'round' })
      }
      head.circle(0, top - 6, 2.2, 'gold', { gloss: true })
      tipY = top - 11
    } else {
      head.ellipse(0, top - 3, 2.2, 3.2, 'leaf', { shade: 'round', gloss: true })
      tipY = top - 6
    }
  } else if (v === 'roots') {
    for (const [x, y] of [[-6, -4], [6, -5], [-4, -10], [5, -11]] as const) head.capsule(0, top + 2, x * s, top + y * s, 1.3, 'haft')
    head.circle(0, top - 6 * s, 4, 'glowInk', { gloss: true })
    tipY = top - 10 * s
  } else if (v === 'coil') {
    head.circle(0, top - 1, 2.6, 'glowInk', { gloss: true })
    tipY = top - 4
  } else if (staff) {
    head.poly([[-4, top + 3], [-5, top - 4], [-2, top - 1]], 'haft', { shade: 'round' }).poly([[4, top + 3], [5, top - 4], [2, top - 1]], 'haft', { shade: 'round' })
    head.ellipse(0, top - 4, 3.8, 5, 'gem', { gloss: true })
    tipY = top - 9
  } else {
    head.poly([[-3, top + 2], [3, top + 2], [0, top - 1]], 'itemTrim', { shade: 'round' })
    head.circle(0, top - 2.5, 3.2, 'gem', { gloss: true })
    tipY = top - 6
  }
  publishTip(c, head, slot, tipY)
}

const grimoire: ItemFn = (c, it, slot) => {
  const h = slot === 'off' ? c.P.offHand : c.P.mainHand
  const pen = c.piece({ mats: itemMats(c, it, slot) }).at(h.x, h.y, 0, false, ITEM_SCALE)
  const x = 3, y = -8
  pen.poly([[x - 10, y + 1], [x, y + 3], [x + 10, y + 1], [x + 10, y + 7], [x, y + 9], [x - 10, y + 7]], 'field', { shade: 'top' })
  const pg = c.piece({ ring: 1, mats: itemMats(c, it, slot) }).at(h.x, h.y, 0, false, ITEM_SCALE)
  pg.poly([[x - 9, y - 1], [x, y + 1.5], [x, y + 7], [x - 9, y + 4.5]], 'linen', { shade: 'top' })
  pg.poly([[x + 9, y - 1], [x, y + 1.5], [x, y + 7], [x + 9, y + 4.5]], 'linen', { shade: 'top' })
  for (let k = 0; k < 3; k++) pg.line(x - 7, y + 1 + k * 1.6, x - 2, y + 2.5 + k * 1.6, 'linen', TONE_SHADE, F_ONLYON).line(x + 2, y + 2.5 + k * 1.6, x + 7, y + 1 + k * 1.6, 'linen', TONE_SHADE, F_ONLYON)
  if (it.p?.emblem === 'leaf') pg.ellipse(x - 5, y + 3, 2, 1.3, 'leaf', { shade: TONE_MID, flags: F_ONLYON })
  if (slot === 'main') { c.marks.mainTip = pen.toWorld(x, y - 3); c.marks.mainBase = [h.x, h.y]; c.marks.mainLen = 12 }
}

// ── off-hand pieces ────────────────────────────────────────────────────────

function emblem(pen: Pen, em: string | undefined, x: number, y: number): void {
  if (!em) return
  const X = Math.round(x), Y = Math.round(y)
  if (em === 'star') star(pen, X, Y, 'fieldTrim')
  else if (em === 'chili') chili(pen, X, Y)
  else if (em === 'rune') {
    pen.line(X - 1, Y - 3, X - 1, Y + 3, 'glowInk', TONE_LIGHT, F_ONLYON).line(X - 1, Y - 3, X + 2, Y, 'glowInk', TONE_LIGHT, F_ONLYON).line(X + 2, Y, X - 1, Y + 1, 'glowInk', TONE_LIGHT, F_ONLYON)
  } else if (em === 'anvil') {
    pen.rect(X - 4, Y - 2, 8, 2.4, 'iron', { shade: TONE_SHADE, flags: F_ONLYON }).rect(X - 1.5, Y, 3, 2.5, 'iron', { shade: TONE_SHADE, flags: F_ONLYON }).rect(X - 3, Y + 2.5, 6, 1.5, 'iron', { shade: TONE_SHADE, flags: F_ONLYON })
  } else if (em === 'heart') {
    pen.circle(X - 1.4, Y - 0.5, 1.6, 'red', { shade: TONE_LIGHT, flags: F_ONLYON }).circle(X + 1.4, Y - 0.5, 1.6, 'red', { shade: TONE_LIGHT, flags: F_ONLYON }).poly([[X - 3, Y], [X + 3, Y], [X, Y + 3.5]], 'red', { shade: TONE_MID, flags: F_ONLYON })
  } else if (em === 'tooth') {
    for (let k = -2; k <= 2; k++) pen.poly([[X + k * 3 - 1.4, Y - 1], [X + k * 3 + 1.4, Y - 1], [X + k * 3, Y + 2.5]], 'bone', { shade: TONE_LIGHT, flags: F_ONLYON })
  } else if (em === 'moon') {
    pen.circle(X, Y, 2.8, 'hairSilver', { shade: TONE_LIGHT, flags: F_ONLYON })
    pen.circle(X + 1.4, Y - 0.8, 2.2, 'field', { shade: TONE_MID, flags: F_ONLYON })
  } else if (em === 'leaf') pen.ellipse(X, Y, 3, 1.6, 'leaf', { shade: TONE_LIGHT, flags: F_ONLYON })
}

const shield: ItemFn = (c, it, slot) => {
  const s = it.p?.size ?? 1
  const h = c.P.offHand
  const fam = it.family
  const pen = c.piece({ mats: itemMats(c, it, slot) }).at(h.x - 1, h.y - 1, 0, false, ITEM_SCALE)
  let outline: Pt[]
  let inner: Pt[]
  const ell = (rx: number, ry: number, n = 20): Pt[] => Array.from({ length: n }, (_, i) => [Math.cos((i / n) * Math.PI * 2) * rx, Math.sin((i / n) * Math.PI * 2) * ry] as Pt)
  if (fam === 'shieldKite') {
    const w = 8.5 * s, ht = 13 * s
    outline = [[-w, -ht * 0.55], [-w * 0.6, -ht * 0.95], [0, -ht * 1.05], [w * 0.6, -ht * 0.95], [w, -ht * 0.55], [w * 0.7, ht * 0.4], [0, ht * 1.25], [-w * 0.7, ht * 0.4]]
  } else if (fam === 'shieldHeater') {
    const w = 9 * s, ht = 11 * s
    outline = [[-w, -ht], [w, -ht], [w, 0], [w * 0.75, ht * 0.6], [0, ht * 1.15], [-w * 0.75, ht * 0.6], [-w, 0]]
  } else if (fam === 'pavise') {
    const w = 9.5 * s, ht = 16 * s
    outline = [[-w, -ht], [0, -ht - 2], [w, -ht], [w, ht * 0.9], [0, ht], [-w, ht * 0.9]]
  } else {
    const r = (fam === 'buckler' ? 7 : 11) * s
    outline = ell(r, r * 1.02)
  }
  inner = outline.map(([x, y]) => [x * 0.78, y * 0.8] as Pt)
  const rim = fam === 'shieldRound' && !it.p?.blade ? 'itemTrim' : fam === 'buckler' ? 'head' : 'fieldTrim'
  pen.poly(outline, rim === 'itemTrim' ? 'itemTrim' : rim, { shade: 'round', gloss: fam === 'buckler' })
  const plain = it.p?.variant === 'plain'
  const fieldMat = fam === 'shieldRound' ? (it.p?.blade ?? 'haft') : fam === 'buckler' ? 'head' : plain ? 'haft' : 'field'
  pen.poly(inner, fieldMat, { shade: 'round', gloss: fam === 'buckler' }, { cx: 0, cy: 0, rx: 10 * s, ry: 12 * s })
  if (fam === 'shieldRound' && !it.p?.blade) {
    // planks
    for (let x = -6; x <= 6; x += 4) pen.line(x * s, -9 * s, x * s, 9 * s, 'haft', TONE_SHADE, F_ONLYON)
  }
  if (it.p?.emblem === 'scale') pen.texture((x, y) => ((x + (Math.floor(y / 2) % 2) * 2) % 4 === 0 && y % 2 === 0 ? TONE_SHADE : null))
  if (fam === 'shieldHeater' && !plain && !it.p?.emblem) {
    // the pack knight's two-tone field, quartered
    pen.texture((x, y) => ((x - h.x > 0) !== (y - h.y > 0) ? TONE_LIGHT : null), 'fieldTrim')
  }
  if (fam === 'shieldRound' || fam === 'buckler') pen.circle(0, 0, (fam === 'buckler' ? 2.6 : 3.2) * s, 'head', { gloss: true })
  emblem(pen, it.p?.emblem === 'scale' ? undefined : it.p?.emblem, fam === 'shieldRound' ? 0 : 0, fam === 'shieldRound' ? -5.5 * s : fam === 'pavise' ? -4 : 0)
  if (gemmed(c, slot)) c.piece({ ring: 1, mats: itemMats(c, it, slot) }).at(h.x - 1, h.y - 1, 0, false, ITEM_SCALE).circle(0, fam === 'shieldRound' || fam === 'buckler' ? 0 : -6 * s, 1.7, 'gem', { gloss: true })
}

const heldSmall: ItemFn = (c, it, slot) => {
  const h = slot === 'off' ? c.P.offHand : c.P.mainHand
  const s = it.p?.size ?? 1
  const fam = it.family
  const m = itemMats(c, it, slot)
  const at = (o: PieceOpts = {}) => c.piece({ mats: m, ...o }).at(h.x, h.y, 0, false, ITEM_SCALE)
  if (fam === 'orb') {
    const glow = at({ ring: 0 })
    glow.circle(0, -9, 7.5, 'glowInk', { shade: TONE_LIGHT, flags: F_NOINK | F_SOFT })
    at().circle(0, -9, 5, 'glowInk', { gloss: true })
  } else if (fam === 'tome') {
    const p = at().at(-1, -4, -8)
    p.rect(-5.5, -6.5, 11, 13, 'field', { shade: 'round' })
    p.rect(3.5, -5.5, 2, 11, 'linen', { shade: TONE_LIGHT, flags: F_ONLYON })
    p.rect(-5.5, -1, 3, 2.4, 'itemTrim', { shade: TONE_LIGHT, flags: F_ONLYON })
    emblem(p, it.p?.emblem, 0, -1)
  } else if (fam === 'pouch') {
    const p = at()
    p.ellipse(0, 1, 5.5, 5, 'leather', { shade: 'round' })
    p.rect(-4, -4, 8, 2, 'itemTrim', { shade: TONE_MID })
    const lf = at({ ring: 1 })
    if (it.p?.variant === 'spice') lf.ellipse(0, -5, 4.2, 2.4, 'red', { shade: 'round', gloss: true }).px(-1, -7, 'ember', TONE_LIGHT).px(2, -6, 'ember', TONE_LIGHT)
    else lf.ellipse(-2, -6, 1.6, 3.2, 'leaf').ellipse(2, -6.5, 1.6, 3, 'leaf')
  } else if (fam === 'flask') {
    if (it.p?.variant === 'rack') {
      const r = at()
      r.rect(-8, -1, 16, 3, 'wood', { shade: 'top' })
      for (const [dx, liq] of [[-5, 'venom'], [0, 'ember'], [5, 'aqua']] as const) {
        const v = at({ ring: 1 })
        v.rect(dx - 1.8, -10, 3.6, 9, 'glass', { shade: 'cyl', gloss: true })
        v.rect(dx - 1.8, -6, 3.6, 5, liq, { shade: 'cyl', flags: F_ONLYON })
        v.rect(dx - 1.2, -12, 2.4, 2, 'wood', { shade: TONE_MID })
      }
    } else {
      if (it.p?.variant === 'glow') at({ ring: 0 }).circle(0, -2 - 5 * s, 9, 'glowInk', { shade: TONE_LIGHT, flags: F_NOINK | F_SOFT })
      const v = at()
      const r = 5 * s
      v.circle(0, -2 - r, r, 'glass', { gloss: true })
      v.rect(-1.6, -2 - r * 2 - 4, 3.2, 5, 'glass', { shade: 'cyl' })
      v.ellipse(0, -2 - r * 0.6, r * 0.95, r * 0.6, it.p?.glow ?? 'venom', { shade: 'round', flags: F_ONLYON })
      v.rect(-1.8, -2 - r * 2 - 6, 3.6, 2.6, 'wood', { shade: TONE_MID })
      if (it.p?.trim === 'gold') v.rect(-2.2, -2 - r * 2 - 1, 4.4, 1.6, 'gold', { shade: TONE_LIGHT })
    }
  }
  if (gemmed(c, slot) && fam !== 'orb') at({ ring: 1 }).circle(4, -3, 1.3, 'gem', { gloss: true })
}

// ── the company faces' trade props ─────────────────────────────────────────

/** A brass spice scale hanging from the fist: the beam rocks frame to frame. */
const balance: ItemFn = (c, it, slot) => {
  const h = slot === 'off' ? c.P.offHand : c.P.mainHand
  const m = itemMats(c, it, slot)
  const at = (o: PieceOpts = {}) => c.piece({ mats: m, ...o }).at(h.x, h.y, 0, false, ITEM_SCALE)
  const tilt = [0, 1, 1, 0, -1, -1][c.P.frame % 6] * 0.8
  const beam = at()
  beam.rect(-1, 2, 2, 4, 'itemTrim', { shade: 'cyl' })
  beam.poly([[-9, 6 + tilt], [9, 6 - tilt], [9, 7.6 - tilt], [-9, 7.6 + tilt]], 'itemTrim', { shade: 'top', gloss: true })
  beam.circle(0, 6.6, 1.6, 'itemTrim', { gloss: true })
  const str = at({ ring: 0 })
  str.line(-8.5, 7.5 + tilt, -10, 13 + tilt, 'linen', TONE_LIGHT, F_NOINK).line(-8.5, 7.5 + tilt, -6, 13 + tilt, 'linen', TONE_LIGHT, F_NOINK)
  str.line(8.5, 7.5 - tilt, 6, 13 - tilt, 'linen', TONE_LIGHT, F_NOINK).line(8.5, 7.5 - tilt, 11, 13 - tilt, 'linen', TONE_LIGHT, F_NOINK)
  const pans = at({ ring: 1 })
  pans.ellipse(-8, 14 + tilt, 4, 1.6, 'itemTrim', { gloss: true }).ellipse(8.5, 14 - tilt, 4, 1.6, 'itemTrim', { gloss: true })
  pans.ellipse(-8, 12.6 + tilt, 2.6, 1.6, 'red', { shade: 'round' })
}

/** A bolt of silk lying along the off forearm, a length of it trailing. */
const silkBolt: ItemFn = (c, it, slot) => {
  const h = slot === 'off' ? c.P.offHand : c.P.mainHand
  const m = itemMats(c, it, slot)
  const at = (o: PieceOpts = {}) => c.piece({ mats: m, ...o }).at(h.x, h.y, 0, false, ITEM_SCALE)
  const f = c.P.frame % 6
  const tail = at()
  tail.poly([[-7, -1], [-4, -1], [-6 - (f % 3) * 0.5, 9], [-10 - (f % 3) * 0.5, 12], [-9, 4]], 'field', { shade: 'round' })
  const roll = at()
  roll.capsule(-8, -2, 7, -6, 4.6, 'field', { gloss: true })
  roll.line(-6, -5, 6, -8.5, 'field', TONE_SPEC, F_ONLYON)
  const end = at({ ring: 1 })
  end.ellipse(7.5, -6, 2.6, 4.4, 'field', { shade: TONE_LIGHT })
  end.px(7.5, -6, 'field', TONE_SHADE).px(8, -7, 'field', TONE_SHADE)
}

/** A chalked tally slate in a wooden frame, held before the chest. */
const ledger: ItemFn = (c, it, slot) => {
  const h = slot === 'off' ? c.P.offHand : c.P.mainHand
  const m = itemMats(c, it, slot)
  const pen = c.piece({ mats: m }).at(h.x + 1, h.y - 6, -10, false, ITEM_SCALE)
  pen.rect(-7, -8, 14, 16, 'wood', { shade: 'top' })
  pen.rect(-5, -6, 10, 12, 'soot', { shade: TONE_MID, flags: F_ONLYON })
  for (const x of [-3.5, -1.5, 0.5, 2.5]) pen.line(x, -4, x, 1, 'white', TONE_LIGHT, F_ONLYON)
  pen.line(-4.5, 0, 3.5, -3.5, 'white', TONE_LIGHT, F_ONLYON)
  pen.line(-3.5, 3, 1, 3, 'white', TONE_MID, F_ONLYON)
}

/** A small sack of marsh salt, its mouth open. */
const saltSack: ItemFn = (c, it, slot) => {
  const h = slot === 'off' ? c.P.offHand : c.P.mainHand
  const m = itemMats(c, it, slot)
  const at = (o: PieceOpts = {}) => c.piece({ mats: m, ...o }).at(h.x, h.y, 0, false, ITEM_SCALE)
  const sack = at()
  sack.ellipse(0, 3, 6.5, 6, 'bone', { shade: 'round' })
  sack.rect(-3.5, -3, 7, 3, 'bone', { shade: TONE_MID })
  sack.line(-3.5, -1, 3.5, -1, 'leather', TONE_SHADE, F_ONLYON)
  const salt = at({ ring: 1 })
  salt.ellipse(0, -3.5, 3.6, 2, 'white', { shade: 'round', gloss: true })
  salt.px(4, -5, 'white', TONE_SPEC).px(-4, -6, 'white', TONE_SPEC)
}

// ── body pieces (armour layer) ─────────────────────────────────────────────

const bodyPiece: ItemFn = (c, it, slot) => {
  const { P } = c
  const b = P.body
  const fam = it.family
  const v = it.p?.variant
  const m = itemMats(c, it, slot)
  const cx = P.torso.x
  const pen = c.piece({ mats: m })
  const legRoom = FEET - 3 - P.hips.y
  if (fam === 'robe') {
    const drop = legRoom - 1
    pen.poly(torsoOutline(P, 1, drop, 3), 'field', { shade: 'round' }, torsoForm(P, 1, drop))
    pen.texture((_x, y) => (y >= FEET - 6 - P.lift && y <= FEET - 5 - P.lift ? TONE_LIGHT : null), 'fieldTrim')
    pen.rect(cx - b.torsoRx - 4, P.hips.y - 4, (b.torsoRx + 4) * 2, 2.4, 'fieldTrim', { shade: TONE_MID, flags: F_ONLYON })
    if (v === 'coat') {
      pen.poly([[cx + 1, P.torsoTop], [cx + 4, P.torsoTop], [cx + 6, FEET - 4], [cx + 2, FEET - 4]], 'linen', { shade: 'cyl', flags: F_ONLYON })
      pen.rect(cx - b.torsoRx * 0.7, P.hips.y + 1, 5, 4, 'field', { shade: TONE_SHADE, flags: F_ONLYON })
    }
    return
  }
  if (fam === 'apron') {
    const top = P.torsoTop + 3
    const bot = P.hips.y + Math.min(7, legRoom)
    pen.poly([[cx - b.torsoRx * 0.62, top], [cx + b.torsoRx * 0.75, top], [cx + b.torsoRx * 0.85 + 1, bot], [cx - b.torsoRx * 0.7, bot]], 'field', { shade: 'top' })
    const st = c.piece({ ring: 1, mats: m })
    st.line(cx - b.torsoRx * 0.55, top, cx - b.torsoRx * 0.3, P.torsoTop - 1, 'leather', TONE_SHADE).line(cx + b.torsoRx * 0.68, top, cx + b.torsoRx * 0.4, P.torsoTop - 1, 'leather', TONE_SHADE)
    pen.rect(cx - 3, top + P.torsoH * 0.45, 6, 4, 'field', { shade: TONE_SHADE, flags: F_ONLYON })
    if (it.p?.cloth === 'oxblood') pen.texture((x, y) => ((x * 7 + y * 3) % 11 === 0 ? TONE_SHADE : null))
    return
  }
  if (fam === 'belt') {
    const y = P.hips.y - 4
    pen.rect(cx - b.torsoRx - b.flare - 1, y - 0.5, (b.torsoRx + b.flare + 1) * 2, 3.5, 'leather', { shade: 'top' })
    for (const [dx, liq] of [[-0.6, 'venom'], [0.05, 'ember'], [0.65, 'aqua']] as const) {
      const vx = cx + b.torsoRx * dx
      const vi = c.piece({ ring: 1 })
      vi.rect(vx - 1.7, y + 2, 3.4, 6, 'glass', { shade: 'cyl', gloss: true })
      vi.rect(vx - 1.7, y + 4.5, 3.4, 3.5, liq, { shade: 'cyl', flags: F_ONLYON })
    }
    return
  }
  if (fam === 'cloak' || fam === 'hood') {
    // the capelet over the shoulders (the cape itself hangs on the back layer)
    const top = P.torsoTop - 2
    const bot = P.torsoTop + Math.max(7, P.torsoH * 0.5)
    pen.poly([[cx - b.torsoRx - 3, bot - 1], [cx - b.torsoRx * 0.6, top], [cx + b.torsoRx * 0.6, top], [cx + b.torsoRx + 3, bot - 1], [cx, bot + 2.5]], 'field', { shade: 'round' })
    const cl = c.piece({ ring: 1, mats: m })
    cl.circle(cx + b.torsoRx * 0.25, top + 3, 2.2, 'itemTrim', { gloss: true })
    if (it.p?.emblem === 'moon') emblem(pen, 'moon', cx - b.torsoRx * 0.35, top + 4.5)
    return
  }
  // torso cover: mail, padded, leather, brigandine, plate, vest, scale
  const drop = fam === 'mail' ? Math.min(5, legRoom) : fam === 'plate' ? Math.min(2, legRoom) : fam === 'padded' || fam === 'scale' ? Math.min(3, legRoom) : 0
  const g = fam === 'vest' ? 0.5 : 1
  const mat = fam === 'mail' ? 'blade' : fam === 'plate' ? 'blade' : fam === 'leather' ? (it.p?.cloth ?? 'leather') : fam === 'padded' ? (it.p?.cloth ?? (v === 'plain' ? 'leather' : 'linen')) : fam === 'scale' ? (it.p?.cloth ?? 'scaleOchre') : 'field'
  if (fam === 'plate' && (rankOf(c.R.rarity.body) >= 3 || it.p?.trim)) {
    pen.poly(torsoOutline(P, g, drop), 'fieldTrim', { shade: 'round', gloss: true }, torsoForm(P, g, drop))
    pen.poly(torsoOutline(P, g - 1.6, drop - 1.6), mat, { shade: 'round', gloss: true }, torsoForm(P, g, drop))
  } else pen.poly(torsoOutline(P, g, drop), mat, { shade: 'round', gloss: fam === 'plate' }, torsoForm(P, g, drop))
  if (fam === 'vest') {
    // open at the front: the tunic shows
    pen.cutPoly([[cx + b.torsoRx * 0.05, P.torsoTop - 2], [cx + b.torsoRx * 0.55, P.torsoTop - 2], [cx + b.torsoRx * 0.35, P.hips.y - 3]])
    if (v === 'wrap') pen.line(cx - b.torsoRx, P.torsoTop + 3, cx + b.torsoRx, P.hips.y - 2, 'fieldTrim', TONE_LIGHT, F_ONLYON).line(cx - b.torsoRx, P.torsoTop + 4, cx + b.torsoRx, P.hips.y - 1, 'fieldTrim', TONE_MID, F_ONLYON)
  }
  if (fam === 'mail') pen.texture((x, y, t) => {
    // rings: each 4 × 3 cell is a small arc, rows staggered — mail, not brick
    const row = Math.floor(y / 3), off = row % 2 ? 2 : 0
    const cx = (x + off) % 4, cy = y % 3
    const darker = t >= TONE_LIGHT ? TONE_MID : TONE_SHADE
    if (cy === 2 && (cx === 1 || cx === 2)) return darker
    if (cy === 1 && (cx === 0 || cx === 3)) return darker
    return null
  })
  // quilted rows (a padded coat), never a check
  if (fam === 'padded') pen.texture((_x, y, t) => ((((y - Math.round(P.torsoTop)) % 4) + 4) % 4 === 0 ? (t >= TONE_LIGHT ? TONE_MID : TONE_SHADE) : null))
  if (fam === 'scale') pen.texture((x, y) => ((x + (Math.floor(y / 3) % 2) * 2) % 4 === 0 && y % 3 === 0 ? TONE_SHADE : (x + (Math.floor(y / 3) % 2) * 2) % 4 === 1 && y % 3 === 1 ? TONE_LIGHT : null))
  if (fam === 'brigandine') {
    pen.texture((_x, _y, t) => (t >= TONE_LIGHT ? TONE_MID : TONE_SHADE), 'field')
    pen.texture((x, y) => (((x - Math.round(cx)) % 5 + 5) % 5 === 0 && (((y - Math.round(P.torsoTop)) % 5) + 5) % 5 === 2 ? TONE_LIGHT : null), 'brass')
  }
  if (fam === 'mail' || fam === 'padded' || fam === 'scale' || fam === 'leather' || fam === 'brigandine') {
    const by = P.hips.y - 4
    const belt = c.piece({ ring: 1, mats: m })
    belt.rect(cx - b.torsoRx - b.flare - 1, by, (b.torsoRx + b.flare + 1) * 2, 2.6, 'leather', { shade: 'top' })
    belt.rect(cx + b.torsoRx * 0.3, by - 0.6, 3.2, 3.8, 'brass', { shade: TONE_LIGHT })
  }
  if (fam === 'leather') {
    pen.line(cx - b.torsoRx * 0.8, P.torsoTop + 1, cx + b.torsoRx * 0.75, P.hips.y - 3, 'itemTrim', TONE_MID, F_ONLYON)
    pen.rect(cx + b.torsoRx * 0.05 - 1.5, P.torsoTop + P.torsoH * 0.45 - 1.5, 3.5, 3.5, 'itemTrim', { shade: TONE_LIGHT, flags: F_ONLYON })
  }
  if (fam === 'plate') {
    pen.line(cx + 1, P.torsoTop + 1, cx + 1, P.hips.y - 2, 'blade', TONE_SPEC, F_ONLYON)
    if (it.p?.glow) pen.line(cx - b.torsoRx * 0.6, P.torsoTop + P.torsoH * 0.55, cx + b.torsoRx * 0.7, P.torsoTop + P.torsoH * 0.5, 'glowInk', TONE_LIGHT, F_ONLYON)
    if (it.p?.emblem === 'heart') c.piece({ ring: 1, mats: m }).circle(cx + 1, P.torsoTop + P.torsoH * 0.42, 2.4, 'red', { gloss: true })
    const pauldrons = v === 'pauldrons' || v === 'heavy' || v === 'aegis'
    if (pauldrons) {
      const big = v === 'heavy' ? 1.25 : 1
      for (const sh of [P.shoulderOff, P.shoulderMain]) {
        const pp = c.piece({ mats: m })
        pp.ellipse(sh.x + (sh === P.shoulderOff ? -1 : 1), sh.y - 0.5, 6 * big, 4.5 * big, 'blade', { gloss: true })
        pp.line(sh.x - 5 * big, sh.y + 2 * big, sh.x + 5 * big, sh.y + 2 * big, 'fieldTrim', TONE_LIGHT, F_ONLYON)
      }
    }
  }
}

// ── back pieces ────────────────────────────────────────────────────────────

/** The cape: from the cloak, or the level's tier. Hangs behind, flutters with the frame. */
export const cape: PartFn = (c) => {
  const { P, R } = c
  const b = P.body
  const cloak = R.body && R.body.family === 'cloak' ? R.body : null
  const tier = R.tier
  if (!cloak && tier === 0) return
  const long = cloak ? cloak.p?.variant !== 'short' : tier >= 2
  const m = cloak ? itemMats(c, cloak, 'body') : c.R.mats
  const mat = cloak ? 'field' : 'cloth'
  const pen = c.piece({ mats: m })
  // it rides up over both shoulders (the collar shows above the arms) and sweeps out behind
  const top = P.torsoTop - 3
  const hem = long ? FEET - 3 - P.lift * 0.6 : P.hips.y + 3
  const f = [0, 1, 1, 2, 1, 0][P.frame % 6] + (P.anim === 'attack' || P.anim === 'walk' ? 2 : 0) + (cloak?.p?.variant === 'long' ? 3 : 0)
  const x0 = P.torso.x
  const reach = long ? 22 : 12
  const pts: Pt[] = [
    [x0 + b.torsoRx + 2, top + 3],
    [x0 + b.torsoRx * 0.4, top - 1],
    [x0 - b.torsoRx * 0.5, top - 1],
    [x0 - b.torsoRx - 4, top + 4],
    [x0 - b.torsoRx - reach * 0.45 - f * 0.5, (top + hem) / 2 - 2],
    [x0 - b.torsoRx - reach - f, hem - 6 - f],
    [x0 - b.torsoRx - reach * 0.4 - f * 0.6, hem + 1],
    [x0 - b.torsoRx * 0.2, hem],
    [x0 + b.torsoRx * 0.7, hem - 1],
    [x0 + b.torsoRx + 1, (top + hem) / 2],
  ]
  pen.poly(pts, mat, { shade: 'round' }, { cx: x0 - 4, cy: (top + hem) / 2, rx: b.torsoRx + reach, ry: (hem - top) / 2 + 2 })
  // folds, falling from the shoulders
  pen.line(x0 - b.torsoRx * 0.6, top + 5, x0 - b.torsoRx - reach * 0.7 - f, hem - 3, mat, TONE_SHADE, F_ONLYON)
  pen.line(x0 - b.torsoRx * 0.1, top + 6, x0 - b.torsoRx * 0.5 - f * 0.4, hem - 1, mat, TONE_SHADE, F_ONLYON)
  // the top tier (or a fine cloak): a trimmed hem
  if (tier >= 3 || (cloak && rankOf(R.rarity.body) >= 3)) pen.texture((_x, y) => (y >= hem - 3 ? TONE_LIGHT : null), cloak ? 'fieldTrim' : 'trim')
  if (!cloak && tier >= 2) c.piece({ ring: 1 }).circle(x0 + b.torsoRx * 0.55, top + 2, 2, tier >= 3 ? 'gold' : 'steel', { gloss: true })
}

const quiver: ItemFn = (c, it, slot) => {
  const { P } = c
  const m = itemMats(c, it, slot)
  const x = 0, y = 0
  const at = (o: PieceOpts = {}) => c.piece({ mats: m, ...o }).at(P.back.x - P.body.torsoRx * 0.55, P.torsoTop - 2, 0, false, ITEM_SCALE)
  const fl = at({ ring: 1 })
  const star = it.p?.emblem === 'star'
  for (const [dx, dy] of [[-2, -9], [1, -11], [4, -9.5]] as const) {
    fl.poly([[x + dx + 4, y + dy + 3], [x + dx + 1, y + dy - 1], [x + dx + 6, y + dy - 2]], star ? 'gold' : it.p?.variant === 'barbed' ? 'red' : 'linen', { shade: 'round' })
  }
  const q = at()
  q.capsule(x - 6, y + 14, x + 4, y - 4, 3.6, 'leather')
  q.line(x - 3, y + 11, x + 3.5, y + 12, 'itemTrim', TONE_LIGHT, F_ONLYON).line(x + 1, y - 1, x + 7, y, 'itemTrim', TONE_LIGHT, F_ONLYON)
  if (gemmed(c, slot)) at({ ring: 1 }).circle(x, y + 6, 1.4, 'gem', { gloss: true })
}

const javelins: ItemFn = (c, it, slot) => {
  const { P } = c
  const m = itemMats(c, it, slot)
  const x = 0, y = 0
  const at = (o: PieceOpts = {}) => c.piece({ mats: m, ...o }).at(P.back.x - 1, P.torsoTop, 0, false, ITEM_SCALE)
  for (const dx of [-4, 0, 4]) {
    const j = at({ ring: 1 })
    j.line(x + dx - 3, y + 16, x + dx + 3, y - 12, 'wood', TONE_MID).line(x + dx - 2, y + 16, x + dx + 4, y - 12, 'wood', TONE_LIGHT)
    j.poly([[x + dx + 2, y - 11], [x + dx + 5, y - 18], [x + dx + 6, y - 11]], 'blade', { shade: 'round', gloss: true })
  }
  const sl = at()
  sl.capsule(x - 6, y + 8, x + 6, y + 6, 2.6, 'leather')
}

/** Banner Bearer's tell: a pennant on a pole across the back, above the head. */
export const backBanner: PartFn = (c) => {
  const { P } = c
  const x = P.back.x - 5
  const top = P.head.y - P.body.headRy - 16
  const pole = c.piece({ ring: 1 })
  pole.capsule(x + 3, P.hips.y, x, top, 1.4, 'wood')
  pole.circle(x, top - 1, 2, 'gold', { gloss: true })
  flag(c, null, 'main', x - 1, top + 2, 12, 10, -1)
}

// ── the slot → part dispatch ───────────────────────────────────────────────

const WEAPON: Partial<Record<string, ItemFn>> = {
  sword, greatsword: sword, sabre: sword, falchion: sword, dagger,
  axe: hafted, greataxe: hafted, hammer: hafted, maul: hafted, pick: hafted, club: hafted, cleaver: hafted, hook: hafted,
  spear: pole, halberd: pole, glaive: pole, harpoon: pole, banner: pole,
  bow, staff: rod, wand: rod, sceptre: rod, grimoire,
  balance,
}
const OFFHAND: Partial<Record<string, ItemFn>> = {
  shieldRound: shield, shieldKite: shield, shieldHeater: shield, buckler: shield, pavise: shield,
  orb: heldSmall, tome: heldSmall, pouch: heldSmall, flask: heldSmall, dagger, offDagger: dagger, wand: rod,
  silkBolt, ledger, saltSack, balance,
}
/** Off-hand items worn on the back instead of held. */
const ON_BACK: Partial<Record<string, ItemFn>> = { quiver, javelins }

/** A mythic piece glows: a soft light round everything its layer drew (outside its ink). */
function mythicGlow(c: DrawCtx, slot: HandSlot): void {
  if (RARITY_RANK[c.R.rarity[slot]] < 4 || !c.layerMask) return
  const mask = c.layerMask()
  const glow = c.piece({ ring: 0 })
  for (let y = 3; y < CELL - 3; y++)
    for (let x = 3; x < CELL - 3; x++) {
      const i = y * CELL + x
      if (mask[i]) continue
      let d = 99
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (mask[(y + dy) * CELL + x + dx]) d = Math.min(d, dx * dx + dy * dy)
      if (d >= 5 && d <= 9) glow.px(x, y, 'ember', TONE_LIGHT, F_NOINK | F_SOFT)
    }
}

export const mainItem: PartFn = (c) => {
  const it = c.R.main
  if (!it) return
  ;(WEAPON[it.family] ?? sword)(c, it, 'main')
  mythicGlow(c, 'main')
}

export const offItem: PartFn = (c) => {
  const it = c.R.off
  if (!it || ON_BACK[it.family]) return
  if (c.P.grip === 'two' || c.P.grip === 'bow') return
  ;(OFFHAND[it.family] ?? WEAPON[it.family] ?? shield)(c, it, 'off')
  mythicGlow(c, 'off')
}

export const armour: PartFn = (c) => {
  const it = c.R.body
  if (it) bodyPiece(c, it, 'body')
}

export const back: PartFn = (c) => {
  cape(c)
  const off = c.R.off
  if (off && ON_BACK[off.family]) ON_BACK[off.family]!(c, off, 'off')
  if (c.R.tells.has('banner')) backBanner(c)
}

// ── FX: the attack's own marks, skill tells, status effects ────────────────

const MELEE = new Set(['sword', 'greatsword', 'sabre', 'falchion', 'dagger', 'axe', 'greataxe', 'hammer', 'maul', 'pick', 'club', 'cleaver', 'hook'])

function smear(c: DrawCtx, which: 1 | 2): void {
  const { P } = c
  const pen = c.piece({ ring: 0 })
  const sh = P.shoulderMain
  // the arc the blade's tip sweeps: from the shoulder to the real tip (scaled item and all)
  const tip = c.marks.mainTip
  const len = tip ? Math.hypot(tip[0] - sh.x, tip[1] - sh.y) : P.body.armLen + 14
  const [a0, a1] = which === 1 ? [-118, -38] : [-62, 30]
  const r0 = Math.max(6, len * 0.45), r1 = len + 2
  for (let y = 0; y < FEET + 2; y++)
    for (let x = 0; x < CELL; x++) {
      const dx = x + 0.5 - sh.x, dy = y + 0.5 - sh.y
      const d = Math.hypot(dx, dy)
      if (d < r0 || d > r1) continue
      const a = (Math.atan2(dy, dx) * 180) / Math.PI
      if (a < a0 || a > a1) continue
      // the trailing end thins: only the outer band survives
      const t = (a - a0) / (a1 - a0)
      const inner = r1 - (r1 - r0) * Math.min(1, t * 1.3)
      if (d < inner) continue
      pen.px(x, y, 'cream', d > r1 - 2 ? TONE_SPEC : t > 0.6 ? TONE_LIGHT : TONE_MID, F_NOINK)
    }
}

function sparkle(pen: Pen, x: number, y: number, mat: string, big = false): void {
  const X = Math.round(x), Y = Math.round(y)
  const k = big ? 3 : 2
  for (let i = -k; i <= k; i++) {
    pen.px(X + i, Y, mat, Math.abs(i) < 2 ? TONE_SPEC : TONE_LIGHT, F_NOINK)
    pen.px(X, Y + i, mat, Math.abs(i) < 2 ? TONE_SPEC : TONE_LIGHT, F_NOINK)
  }
}

export const fx: PartFn = (c) => {
  const { P, R } = c
  const tip = c.marks.mainTip
  const base = c.marks.mainBase
  const f = P.frame

  // the attack
  const fam = R.main?.family ?? 'sword'
  if (P.fx.smear && (MELEE.has(fam) || !R.main)) smear(c, P.fx.smear)
  if (P.fx.thrust && tip) {
    const pen = c.piece({ ring: 0 })
    for (const dy of [-3, 0, 3]) pen.line(tip[0] + 3, tip[1] + dy, tip[0] + 12 - Math.abs(dy), tip[1] + dy, 'cream', TONE_LIGHT, F_NOINK)
  }
  if (P.fx.loose && tip) {
    const ar = c.piece({ ring: 1 })
    ar.line(tip[0] + 6, tip[1], tip[0] + 18, tip[1], 'wood', TONE_LIGHT)
    ar.poly([[tip[0] + 18, tip[1] - 2], [tip[0] + 22, tip[1]], [tip[0] + 18, tip[1] + 2]], 'steel', { shade: 'round' })
    const ln = c.piece({ ring: 0 })
    ln.line(tip[0] - 2, tip[1] - 3, tip[0] + 5, tip[1] - 3, 'cream', TONE_LIGHT, F_NOINK).line(tip[0] - 1, tip[1] + 3, tip[0] + 5, tip[1] + 3, 'cream', TONE_LIGHT, F_NOINK)
  }
  const magic = R.main?.p?.glow ?? (R.main?.family === 'staff' || R.main?.family === 'wand' || R.main?.family === 'sceptre' || R.main?.family === 'grimoire' ? 'aqua' : 'gold')
  if (P.fx.charge && tip) {
    const pen = c.piece({ ring: 0 })
    for (let k = 0; k < 4; k++) {
      const a = (k * 90 + f * 25) * (Math.PI / 180)
      sparkle(pen, tip[0] + Math.cos(a) * 6, tip[1] + Math.sin(a) * 6, magic)
    }
  }
  if (P.fx.burst && tip) {
    const pen = c.piece({ ring: 0 })
    sparkle(pen, tip[0] + 3, tip[1], magic, true)
    pen.circle(tip[0] + 3, tip[1], 5, magic, { shade: TONE_LIGHT, flags: F_NOINK | F_SOFT })
    for (const [dx, dy] of [[9, -4], [11, 2], [7, 6]] as const) sparkle(pen, tip[0] + dx, tip[1] + dy, magic)
  }

  // a vial held up to the light
  if (P.fx.glint && R.off) {
    const pen = c.piece({ ring: 0 })
    sparkle(pen, P.offHand.x + 4, P.offHand.y - 13, 'white', true)
    sparkle(pen, P.offHand.x - 5, P.offHand.y - 8, 'venom')
  }

  // skill tells on the weapon
  if (tip && base && R.main) {
    const along = (t: number): Pt => [base[0] + (tip[0] - base[0]) * t, base[1] + (tip[1] - base[1]) * t]
    if (R.tells.has('burn')) {
      const pen = c.piece({ ring: 0 })
      for (const [k, t] of [[0, 0.55], [1, 0.75], [2, 0.95]] as const) {
        const [x, y] = along(t)
        const h = 3 + ((f + k) % 3)
        pen.poly([[x - 2, y], [x + 2, y], [x + ((f + k) % 2 ? 1 : -1), y - h - 2]], 'ember', { shade: TONE_LIGHT, flags: F_NOINK })
        pen.px(x, y - 1, 'ember', TONE_SPEC, F_NOINK)
      }
    }
    if (R.tells.has('frost')) {
      const pen = c.piece({ ring: 0 })
      for (const [k, t] of [[0, 0.5], [1, 0.8], [2, 1.0]] as const) {
        const [x, y] = along(t)
        sparkle(pen, x + (k % 2 ? 3 : -3), y - ((f + k) % 3), 'frost')
      }
    }
    if (R.tells.has('venom')) {
      const pen = c.piece({ ring: 1 })
      const [x, y] = along(0.92)
      const d = (f % 3) * 1.5
      pen.ellipse(x + 1, y + 3 + d, 1.4, 2, 'venom', { gloss: true })
    }
  }
  if (R.tells.has('spark') && tip) {
    const pen = c.piece({ ring: 0 })
    const o = f % 2 ? 1 : -1
    pen.line(tip[0] - 5, tip[1] - 2 * o, tip[0] - 2, tip[1] + 1 * o, 'gold', TONE_SPEC, F_NOINK).line(tip[0] - 2, tip[1] + o, tip[0] + 1, tip[1] - 3 * o, 'gold', TONE_LIGHT, F_NOINK)
    pen.line(tip[0] + 3, tip[1] + 2 * o, tip[0] + 6, tip[1] - o, 'aqua', TONE_LIGHT, F_NOINK)
  }
  const hx = P.head.x, hy = P.head.y, hr = P.body.headRy, hrx = P.body.headRx
  if (R.tells.has('rage')) {
    const pen = c.piece({ ring: 1 })
    const x = Math.round(hx + hrx * 0.55), y = Math.round(hy - hr - 2)
    for (const [dx, dy] of [[0, 0], [1, 1], [3, 0], [2, 1], [0, 3], [1, 2], [3, 3], [2, 2]] as const) pen.px(x + dx, y + dy, 'red', TONE_LIGHT)
  }
  if (R.tells.has('keen')) {
    // a gold-rimmed lens over the far eye, its chain down to the collar
    const ex = Math.round(hx + hrx * 0.72 + 1), ey = Math.round(hy + hr * 0.14)
    const lens = c.piece({ ring: 1 })
    lens.circle(ex, ey, 3.6, 'gold', { shade: TONE_LIGHT })
    lens.circle(ex, ey, 2.2, 'glass', { shade: TONE_LIGHT, flags: F_ONLYON }).px(ex - 1, ey - 1, 'white', TONE_SPEC, F_ONLYON)
    const ch = c.piece({ ring: 0 })
    ch.line(ex + 2, ey + 3, ex + 1, ey + 10, 'gold', TONE_MID, F_NOINK)
  }
  if (R.tells.has('bloom')) {
    const pen = c.piece({ ring: 1 })
    for (const [dx, col] of [[-14, 'rose'], [12, 'gold'], [-6, 'leaf']] as const) {
      const x = P.torso.x + dx, y = FEET - 1
      pen.ellipse(x, y - 3, 1.4, 3, 'leaf', { shade: 'round' })
      if (col !== 'leaf') pen.circle(x, y - 6 - (f % 2), 1.8, col, { gloss: true })
    }
  }

  // status effects
  if (R.status.has('hasted')) {
    const pen = c.piece({ ring: 0 })
    const x = P.torso.x - P.body.torsoRx - 6
    for (const [k, y] of [[0, P.torsoTop + 2], [1, P.torsoTop + P.torsoH * 0.6], [2, hy - 2]] as const) {
      const off = (f + k) % 3
      pen.line(x - 9 - off * 2, y, x - 2 - off, y, 'white', TONE_LIGHT, F_NOINK)
    }
    pen.ellipse(P.footBack.x - 6 - (f % 3), FEET - 2, 2.6, 1.6, 'cream', { shade: TONE_LIGHT, flags: F_NOINK | F_SOFT })
  }
  if (R.status.has('slowed')) {
    const pen = c.piece({ ring: 0 })
    for (const [dx, k] of [[-10, 0], [10, 1]] as const) sparkle(pen, P.torso.x + dx, FEET - 8 - ((f + k) % 3), 'frost')
  }
  if (R.status.has('stunned')) {
    const pen = c.piece({ ring: 1 })
    for (let k = 0; k < 3; k++) {
      const a = ((k * 120 + f * 40) * Math.PI) / 180
      star(pen, hx + Math.cos(a) * (hrx + 2), hy - hr - 3 + Math.sin(a) * 3, 'gold', 0)
    }
  }
  if (R.status.has('buffed') && c.silhouette) {
    const sil = c.silhouette
    const glow = c.piece({ ring: 0 })
    for (let y = 1; y < CELL - 1; y++)
      for (let x = 1; x < CELL - 1; x++) {
        const i = y * CELL + x
        if (sil[i]) continue
        let near = false
        for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++) if (dx * dx + dy * dy <= 5 && sil[(y + dy) * CELL + x + dx]) near = true
        if (near) glow.px(x, y, 'gold', TONE_LIGHT, F_NOINK | F_SOFT)
      }
    const ar = c.piece({ ring: 1 })
    for (const [dx, k] of [[hrx + 6, 0], [-hrx - 7, 1]] as const) {
      const x = hx + dx, y = hy - 2 - ((f + k) % 3)
      ar.poly([[x - 3, y + 1], [x, y - 3], [x + 3, y + 1]], 'gold', { shade: TONE_LIGHT }).rect(x - 1, y + 1, 2, 3, 'gold', { shade: TONE_MID })
    }
  }
  if (R.wounded) {
    const pen = c.piece({ ring: 1 })
    pen.ellipse(hx - hrx - 2, hy - 2 + (f % 3), 1.6, 2.4, 'aqua', { gloss: true })
  }
}

/** The part functions per layer, in the order they draw within it. */
export const LAYER_PARTS: Readonly<Record<LayerId, readonly PartFn[]>> = {
  back: [back],
  offArm: [offArm],
  legs: [legs],
  body: [torso],
  armour: [armour],
  head: [head],
  hair: [hair],
  mainArm: [mainArm],
  mainItem: [mainItem],
  offItem: [offItem],
  fx: [fx],
}

/** Shapes kept for tests: is a front-stamped fist this piece? */
export const FRONT_FLAG = F_FRONT
export const NOINK_FLAG = F_NOINK
