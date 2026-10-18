/**
 * The company faces at FIELD / POST size (round 4, Oct 2026): the pack's own
 * unit scale and its DENSITY. Measured off the old CC0 build: the pawn stands
 * 53 px (58 wide) in its 192 cell, the archer 62 without its plume, the
 * knight 70; their outline is 2–3 px outside and 2 px inside, the smallest
 * shape is 2 px, each material is three tones plus a white dash, and a
 * figure has 7–9 colours. Round 3's 72 cells stood their people at the same
 * height, but drew them at twice the pack's density (1 px rings between
 * every part, 1 px hair strands, 13–17 colours) round a head two thirds of
 * the figure — so they read rough and chunky beside the knight.
 *
 * So: a 64 cell, the sole on row {@link POST_FEET}; people 42 (the dwarf)
 * to 57 px (the elf) tall; one px of ink between parts and two round the
 * whole figure; nothing under 2 px but an eye; three tones a material, lit
 * from the upper left.
 *
 * Every figure is BUILT ON ITS SKELETON (`skeleton.ts`): the arms and legs
 * are drawn along the projected bones each frame (so an elbow is where the
 * elbow is, and a forearm is always as long as the other forearm), the head,
 * the torso, the boots and the props are hand-drawn pixel rows PINNED to
 * their joints, and a held thing's grip sits on its wrist with the fist
 * drawn over it. A frame is a pose (where the hands go, how the body
 * lifts), solved by IK so no bone stretches.
 *
 * They move by the dock's clock ({@link spriteAt}): the same idle period, tic
 * interval and hashed phase as the face's dock figure, so the five never
 * move in step. Pure: no DOM.
 */
import { INK, RAMPS, SHADOW_ALPHA, rgbOf } from './palette'
import type { PersonaId } from './rig'
import { MINI_FACES, spriteAt, type MiniAnim, type MiniFace, type MiniFrame } from './mini'
import { depthOf, poseJoints2, poseJoints3, skeletonOf, type JointId, type Pose } from './skeleton'
import { POST_FACES, type Eye, type EyeMode, type Key, type Part, type PostFace, type Tone } from './postArt'

export { POST_FACES, type PostFace } from './postArt'

export const POST_W = 64
export const POST_H = 64
/** The row the soles stand on (the shadow is the rows round it). */
export const POST_FEET = 57

// ── the painter ──────────────────────────────────────────────────────────────

const INK_RGB = rgbOf(INK)

const keysOf = (face: PostFace, anim: MiniAnim): readonly Key[] => (anim === 'idle' ? face.idle : anim === 'tic' ? face.tic : face.react)
const keyOf = (face: PostFace, anim: MiniAnim, frame: number): Key => {
  const ks = keysOf(face, anim)
  return ks[((frame % ks.length) + ks.length) % ks.length] ?? {}
}

/** The pose a frame shows (the skeleton's input). */
export const postPose = (id: PersonaId, anim: MiniAnim, frame: number): Pose => keyOf(POST_FACES[id], anim, frame).pose ?? {}

/** Distance from a point to a segment. */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): [number, number] {
  const dx = bx - ax, dy = by - ay
  const l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0
  return [Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), t]
}

interface Drawn { px: Map<number, string>; band: readonly [number, number]; far: boolean }

/** A part's pixels this frame: cell index → ink letter. */
function rasterise(part: Part, j: Partial<Record<JointId, [number, number]>>, key: Key): Drawn | null {
  const px = new Map<number, string>()
  const set = (x: number, y: number, ch: string) => { if (x >= 0 && y >= 0 && x < POST_W && y < POST_H) px.set(y * POST_W + x, ch) }
  if (part.kind === 'rows') {
    const at = j[part.at]
    if (!at) return null
    const nd = key.nudge?.[part.id] ?? [0, 0]
    const x0 = Math.round(at[0]) + part.off[0] + nd[0], y0 = Math.round(at[1]) + part.off[1] + nd[1]
    const rows = key.swap?.[part.id] ?? part.rows
    rows.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch !== '.') set(x0 + rx, y0 + ry, ch) }))
    return { px, band: part.band ?? [1, 1], far: false }
  }
  if (part.kind === 'limb') {
    const pts = part.chain.map((c) => j[c])
    if (pts.some((p) => !p)) return null
    const sh = part.shift ?? [0, 0]
    const ps = (pts as [number, number][]).map(([x, y]) => [x + sh[0], y + sh[1]] as [number, number])
    let x0 = 99, y0 = 99, x1 = -1, y1 = -1
    for (const [x, y] of ps) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
    const rMax = Math.max(...part.r)
    for (let y = Math.floor(y0 - rMax - 1); y <= Math.ceil(y1 + rMax + 1); y++)
      for (let x = Math.floor(x0 - rMax - 1); x <= Math.ceil(x1 + rMax + 1); x++) {
        let best = Infinity, bestSeg = -1
        for (let s = 0; s + 1 < ps.length; s++) {
          const [d, t] = segDist(x, y, ps[s][0], ps[s][1], ps[s + 1][0], ps[s + 1][1])
          const r = part.r[s] + (part.r[s + 1] - part.r[s]) * t
          const m = d - r
          if (m < best) { best = m; bestSeg = s }
        }
        if (best <= 0.05) set(x, y, part.inks[Math.min(bestSeg, part.inks.length - 1)])
      }
    return { px, band: [1, 1], far: !!part.far }
  }
  const w = j[part.at], e = j[part.from]
  if (!w || !e) return null
  const dx = w[0] - e[0], dy = w[1] - e[1]
  const l = Math.hypot(dx, dy) || 1
  const cx = w[0] + (dx / l) * (part.reach ?? 1.2), cy = w[1] + (dy / l) * (part.reach ?? 1.2)
  for (let y = Math.floor(cy - part.r - 1); y <= Math.ceil(cy + part.r + 1); y++)
    for (let x = Math.floor(cx - part.r - 1); x <= Math.ceil(cx + part.r + 1); x++)
      if (Math.hypot(x - cx, y - cy) <= part.r + 0.05) set(x, y, part.ink)
  return { px, band: [1, 1], far: !!part.far }
}

export interface PostOpts {
  locked?: boolean
  /** Leave out the arms and what they hold (the mouth test's reference). */
  bare?: boolean
}

/** One frame at field / post size. `locked`: the figure as a shadow (the company not open yet). */
export function postFrame(id: PersonaId, anim: MiniAnim, frame: number, lockedOrOpts: boolean | PostOpts = false): MiniFrame {
  const o: PostOpts = typeof lockedOrOpts === 'boolean' ? { locked: lockedOrOpts } : lockedOrOpts
  const face = POST_FACES[id]
  const key = keyOf(face, anim, frame)
  const pose = key.pose ?? {}
  const j = poseJoints2(id, pose)
  const W = POST_W, H = POST_H
  const rgba = new Uint8ClampedArray(W * H * 4)
  const sk = skeletonOf(id)
  // the ground shadow: on the ground under the feet (a hop shrinks it a little)
  const lift = Math.max(0, (pose.all?.[1] ?? 0))
  const scx = sk.root[0] + 0.5, scy = POST_FEET + 0.6
  const rx = face.shadowRx - lift * 0.5, ry = 2.2
  for (let y = POST_FEET - 2; y <= POST_FEET + 3; y++)
    for (let x = Math.floor(scx - rx - 1); x <= Math.ceil(scx + rx + 1); x++)
      if (((x + 0.5 - scx) / rx) ** 2 + ((y + 0.5 - scy) / ry) ** 2 <= 1 && x >= 0 && x < W) rgba.set([...INK_RGB, SHADOW_ALPHA], (y * W + x) * 4)
  const colour = (ch: string, tone: Tone): [number, number, number] => {
    const ink = face.inks[ch]
    if (!ink) return INK_RGB
    if (o.locked) return rgbOf(RAMPS.navy[tone >= 2 ? 1 : 0])
    return rgbOf(RAMPS[ink[0]][tone])
  }
  const put = (i: number, rgb: readonly number[]) => rgba.set([rgb[0], rgb[1], rgb[2], 255], i * 4)
  const isInk = (i: number) => rgba[i * 4 + 3] === 255 && rgba[i * 4] === INK_RGB[0] && rgba[i * 4 + 1] === INK_RGB[1] && rgba[i * 4 + 2] === INK_RGB[2]
  for (const part of face.parts) {
    if (o.bare && (part.group === 'armN' || part.group === 'armF' || part.group === 'prop')) continue
    const shown = part.hidden ? key.show?.includes(part.id) : !key.hide?.includes(part.id)
    if (!shown) continue
    const d = rasterise(part, j, key)
    if (!d) continue
    const own = d.px
    if (part.ring !== 0)
      for (const i of own.keys()) {
        const x = i % W, y = (i / W) | 0
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const xx = x + ox, yy = y + oy
          if (xx < 0 || yy < 0 || xx >= W || yy >= H || own.has(yy * W + xx)) continue
          put(yy * W + xx, INK_RGB)
        }
      }
    const run = (i: number, dx: number, dy: number, max: number) => {
      let n = 0, x = i % W, y = (i / W) | 0
      while (n < max) { x += dx; y += dy; if (x < 0 || y < 0 || x >= W || y >= H || !own.has(y * W + x)) break; n++ }
      return n
    }
    for (const [i, ch] of own) {
      const ink = face.inks[ch]
      let tone: Tone
      if (!ink || ink[1] !== 'a') tone = (ink?.[1] as Tone) ?? 1
      else {
        const lt = Math.min(run(i, -1, 0, 4), run(i, 0, -1, 4))
        const sh = Math.min(run(i, 1, 0, 4), run(i, 0, 1, 4))
        tone = sh < d.band[1] ? 0 : lt < d.band[0] ? 2 : 1
      }
      if (d.far) tone = Math.max(0, tone - 1) as Tone
      put(i, ch === 'k' ? INK_RGB : colour(ch, tone))
    }
  }
  // the pack's outer line: one more px of ink round the whole figure, so it is 2 px outside and 1 px between parts
  const add: number[] = []
  for (let i = 0; i < W * H; i++) {
    if (rgba[i * 4 + 3] === 255) continue
    const x = i % W, y = (i / W) | 0
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const xx = x + ox, yy = y + oy
      if (xx >= 0 && yy >= 0 && xx < W && yy < H && isInk(yy * W + xx)) { add.push(i); break }
    }
  }
  for (const i of add) put(i, INK_RGB)
  if (!o.locked) {
    const hj = j.head
    if (hj) {
      const hx = Math.round(hj[0]), hy = Math.round(hj[1])
      const mode = key.eyes ?? 'open'
      const skin = colour(face.skin, 1)
      const plot = (x: number, y: number, c: readonly number[]) => { if (x >= 0 && y >= 0 && x < W && y < H) put(y * W + x, c) }
      const [lx, ly] = key.look ?? [0, 0]
      face.eyes.forEach((e, i) => {
        // a glance: the eye's own place is skin, the eye drawn where it looks
        if (lx || ly) for (let yy = 0; yy < e.h; yy++) for (let xx = 0; xx < e.w; xx++) plot(hx + e.dx + xx, hy + e.dy + yy, skin)
        const m: EyeMode = mode === 'wink' ? (i === 0 ? 'closed' : 'open') : mode
        eye(plot, hx + e.dx + lx, hy + e.dy + ly, e, m, !!face.slit, skin)
      })
      for (const [ex, ey, ch] of key.extra ?? []) { const x = hx + ex, y = hy + ey; if (x >= 0 && y >= 0 && x < W && y < H) put(y * W + x, colour(ch, typeof face.inks[ch]?.[1] === 'number' ? (face.inks[ch][1] as Tone) : 1)) }
    }
  }
  return { w: W, h: H, rgba }
}

/** An eye by expression: open, a w × h ink mark; shut, its lower lid; happy, an arc up; smug, a lid over a low pupil. A reptile's is gold with a slit. */
function eye(put: (x: number, y: number, rgb: readonly number[]) => void, x: number, y: number, e: Eye, mode: EyeMode, slit: boolean, skin: readonly number[]): void {
  const box = (rgb: readonly number[], x0: number, y0: number, w: number, h: number) => { for (let yy = y0; yy < y0 + h; yy++) for (let xx = x0; xx < x0 + w; xx++) put(xx, yy, rgb) }
  box(skin, x, y, e.w, e.h)
  if (slit) {
    if (mode === 'closed' || mode === 'happy') { box(INK_RGB, x, y + e.h - 1, e.w, 1); return }
    box(rgbOf(RAMPS.gold[2]), x, y, e.w, e.h)
    box(INK_RGB, x + (e.w >> 1), y, 1, e.h)
    if (mode === 'smug') box(INK_RGB, x, y, e.w, 1)
    return
  }
  if (mode === 'open') return box(INK_RGB, x, y, e.w, e.h)
  if (mode === 'closed') return box(INK_RGB, x, y + e.h - 1, e.w, 1)
  if (mode === 'happy') { box(INK_RGB, x, y, e.w, 1); if (e.w === 1) put(x, y, INK_RGB); return }
  // smug: the lid, then the pupil low
  box(INK_RGB, x, y, e.w, 1)
  box(INK_RGB, x, y + e.h - 1, Math.max(1, e.w - 1), 1)
}

export const postFrames = (id: PersonaId, anim: MiniAnim): number => keysOf(POST_FACES[id], anim).length

/** Per-frame hold times (ms) at this size, by the dock's clock for the idle. */
export function postMs(id: PersonaId, anim: MiniAnim): number[] {
  const f = POST_FACES[id]
  const clock = MINI_FACES[id]
  const sum = (ms: readonly number[]) => ms.reduce((a, b) => a + b, 0)
  // this size's own holds, scaled to the dock's lengths (the clock plays them so)
  const fit = (own: readonly number[], len: number) => own.map((m) => (m * len) / sum(own))
  if (anim === 'idle') return fit(f.idleMs ?? f.idle.map(() => 1), clock.period)
  return anim === 'tic' ? fit(f.ticMs, sum(clock.ticMs)) : fit(f.reactMs, sum(clock.reactMs))
}

/** Where a face stands in its cell: the middle of its feet (its shadow's centre) and the ground row. */
export const postFeetOf = (id: PersonaId): { x: number; y: number } => ({ x: skeletonOf(id).root[0] + 0.5, y: POST_FEET + 1 })

/** The 3D joints of a frame (for the skeleton's checks). */
export const postJoints3 = (id: PersonaId, anim: MiniAnim, frame: number) => poseJoints3(id, postPose(id, anim, frame))
/** The cell joints of a frame. */
export const postJoints2 = (id: PersonaId, anim: MiniAnim, frame: number) => poseJoints2(id, postPose(id, anim, frame))
/** Which of a frame's arms is in front of the body (the near one, unless a pose swings the far hand forward of the chest). */
export const nearerHand = (id: PersonaId, anim: MiniAnim, frame: number): 'N' | 'F' => {
  const j = postJoints3(id, anim, frame)
  return depthOf(j.wristN ?? [0, 0, 0]) >= depthOf(j.wristF ?? [0, 0, 0]) ? 'N' : 'F'
}

/** The clock's view of this size's frames (counts and holds), for {@link spriteAt}. */
function clockFace(id: PersonaId): MiniFace {
  const f = POST_FACES[id]
  return { ...MINI_FACES[id], idle: f.idle.map(() => ({})), idleMs: f.idleMs, tic: f.tic.map(() => ({})), ticMs: f.ticMs, react: f.react.map(() => ({})), reactMs: f.reactMs }
}

/** What the figure shows at time `t` (ms): the dock's clock, this size's frames. */
export function postAt(id: PersonaId, t: number, o: { pickedAt?: number; still?: boolean } = {}): { anim: MiniAnim; frame: number } {
  return spriteAt(id, clockFace(id), t, o)
}
