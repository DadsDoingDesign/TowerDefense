/**
 * Where each hand IS, frame by frame — measured off the real strips at build
 * time, so a held mark (`gearMarks.drawMainHand` / `drawOffHand`) moves with
 * the fist that holds it instead of hanging still while the body breathes.
 *
 * The designer (Oct 2026): "When an item is equipped the animation on the map
 * doesn't move the item, it stays still while the character moves which looks
 * odd." The Tiny Swords strips ship no anchor layer (HANDOFF §6.4), and the
 * rig's fists (`gearMarks.Rig.fistR` / `fistL`) are one point per look,
 * measured on idle frame 0. So the fist itself is tracked:
 *
 *  1. **the template** is the fist on idle frame 0 at the rig's point: its
 *     skin (the non-ink pixels flooded from the point, within a 11 × 11 box)
 *     and the ink ring round it, colour for colour. A point that is not on a
 *     fist (the knight's left "fist" is inside its painted shield) gives no
 *     template, and that hand follows the body (step 3);
 *  2. **the match**: in every frame of every strip a mark is drawn over, the
 *     template is laid at each whole px within `IDLE_REACH` (idle) or
 *     `ATK_REACH` (the attack strip, whose arms swing far) of the hand's last
 *     place, and kept only where it fits near-exactly (≤ `MAX_MISS` of its
 *     pixels off — the pack redraws the fist identically, so a true match is
 *     0); the best fit wins, and a tie goes to the place nearest the last;
 *  3. **a hidden hand follows the body**: where nothing fits (the archer's
 *     near hand is behind it through the whole draw), the hand moves by the
 *     tunic's own measured motion (`measureTorsos`: its box's side and hem)
 *     from the last place it was seen — so a quiver at the archer's back
 *     turns with the archer.
 *  4. **no jitter**: an idle track that only flips between two places a px
 *     apart, while the tunic does not move, is the match's noise, not the
 *     hand's — it is replaced by the tunic's motion.
 *
 * Points are in logical px from the hero's draw origin (feet at y = +8, the
 * cell centred: `blit.blitPixmap`), whole px. A pack that ships marker layers
 * (`*_anchors.png`, `anchors-lib.scan`) has its hands read from the markers
 * instead — the artist's own grip, per frame.
 */
import type { Torso } from '../src/game/render/bodyLayer'
import type { HeldGrip, HeldGrips, HeldStrip } from '../src/game/render/gearMarks'
import type { Anchor } from './anchors-lib'

export interface RawStrip {
  name: string
  data: Uint8Array
  w: number
  h: number
  frames: number
}

/** How far a fist may move between two frames of an idle strip, and of an attack strip. */
export const IDLE_REACH = 4
export const ATK_REACH = 18
/** The share of a template's pixels that may be off and still be the fist (a px or two of overlap). */
export const MAX_MISS = 0.12
/** The fist's box round its point: a fist is ~7 px across. */
const BOX = 5

/** The strip cell's px → the hero origin's logical px (`blitPixmap`: centred, feet at +8). */
export function cellOrigin(s: Pick<RawStrip, 'w' | 'h' | 'frames'>): { cw: number; ox: number; oy: number } {
  const cw = Math.round(s.w / s.frames)
  return { cw, ox: Math.round(-cw / 2), oy: 8 - s.h }
}

const isInk = (d: ArrayLike<number>, o: number): boolean =>
  d[o + 3] >= 128 && Math.abs(d[o] - 22) <= 2 && Math.abs(d[o + 1] - 28) <= 2 && Math.abs(d[o + 2] - 46) <= 2

interface Template {
  /** Offsets from the fist's point, with the pixel there (RGBA). */
  px: { dx: number; dy: number; c: [number, number, number, number] }[]
}

/**
 * The fist on frame `f` of `s` at cell px (x, y): its skin and ink ring, or
 * null when the point is not on a fist (no skin there, or a region too big to
 * be one — a shield's face).
 */
export function fistTemplate(s: RawStrip, f: number, x: number, y: number): Template | null {
  const { cw } = cellOrigin(s)
  const x0 = f * cw
  const at = (cx: number, cy: number) => (cy * s.w + x0 + cx) * 4
  const inBox = (cx: number, cy: number) => Math.abs(cx - x) <= BOX && Math.abs(cy - y) <= BOX && cx >= 0 && cx < cw && cy >= 0 && cy < s.h
  const skin = (cx: number, cy: number) => inBox(cx, cy) && s.data[at(cx, cy) + 3] >= 128 && !isInk(s.data, at(cx, cy))
  let seed: [number, number] | null = null
  for (let r = 0; r <= 2 && !seed; r++)
    for (let dy = -r; dy <= r && !seed; dy++)
      for (let dx = -r; dx <= r && !seed; dx++) if (skin(x + dx, y + dy)) seed = [x + dx, y + dy]
  if (!seed) return null
  const key = (cx: number, cy: number) => `${cx},${cy}`
  const region = new Map<string, [number, number]>([[key(...seed), seed]])
  const stack = [seed]
  let touchesBox = false
  while (stack.length) {
    const [cx, cy] = stack.pop()!
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx
      const ny = cy + dy
      if (Math.abs(nx - x) > BOX || Math.abs(ny - y) > BOX) {
        if (s.data[at(nx, ny) + 3] >= 128 && !isInk(s.data, at(nx, ny))) touchesBox = true
        continue
      }
      if (!region.has(key(nx, ny)) && skin(nx, ny)) {
        region.set(key(nx, ny), [nx, ny])
        stack.push([nx, ny])
      }
    }
  }
  // A fist is ringed by ink inside its box; skin running out of the box is not a fist.
  if (touchesBox || region.size < 8) return null
  const mask = new Map(region)
  for (const [cx, cy] of region.values())
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx
        const ny = cy + dy
        if (nx >= 0 && nx < cw && ny >= 0 && ny < s.h && isInk(s.data, at(nx, ny))) mask.set(key(nx, ny), [nx, ny])
      }
  const px = [...mask.values()]
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])
    .map(([cx, cy]) => {
      const o = at(cx, cy)
      return { dx: cx - x, dy: cy - y, c: [s.data[o], s.data[o + 1], s.data[o + 2], s.data[o + 3]] as [number, number, number, number] }
    })
  return { px }
}

/**
 * The whole 11 × 11 box round (x, y) on frame `f`, clear pixels too: the
 * template where the hand is not a ringed fist (the knight's sword hand runs
 * into its arm; its left "hand" is the painted shield's face) — the box moves
 * as the hand does, or does not fit at all.
 */
export function patchTemplate(s: RawStrip, f: number, x: number, y: number): Template {
  const { cw } = cellOrigin(s)
  const px: Template['px'] = []
  for (let dy = -BOX; dy <= BOX; dy++)
    for (let dx = -BOX; dx <= BOX; dx++) {
      const cx = x + dx
      const cy = y + dy
      if (cx < 0 || cx >= cw || cy < 0 || cy >= s.h) continue
      const o = (cy * s.w + f * cw + cx) * 4
      px.push({ dx, dy, c: [s.data[o], s.data[o + 1], s.data[o + 2], s.data[o + 3]] })
    }
  return { px }
}

/** The share of the template's pixels that frame `f` of `s` does not repeat with its point at (x, y). */
export function missAt(s: RawStrip, f: number, t: Template, x: number, y: number): number {
  const { cw } = cellOrigin(s)
  let miss = 0
  for (const p of t.px) {
    const cx = x + p.dx
    const cy = y + p.dy
    if (cx < 0 || cx >= cw || cy < 0 || cy >= s.h) {
      miss++
      continue
    }
    const o = (cy * s.w + f * cw + cx) * 4
    const d = s.data
    const solid = d[o + 3] >= 128
    if (solid !== p.c[3] >= 128 || (solid && (Math.abs(d[o] - p.c[0]) > 16 || Math.abs(d[o + 1] - p.c[1]) > 16 || Math.abs(d[o + 2] - p.c[2]) > 16))) miss++
  }
  return miss / t.px.length
}

/** The best near-exact fit of `t` in frame `f` within `reach` of (x, y), in cell px, or null. */
export function matchFist(s: RawStrip, f: number, t: Template, x: number, y: number, reach: number): [number, number] | null {
  let best: { x: number; y: number; miss: number; d: number } | null = null
  for (let dy = -reach; dy <= reach; dy++)
    for (let dx = -reach; dx <= reach; dx++) {
      const miss = missAt(s, f, t, x + dx, y + dy)
      if (miss > MAX_MISS) continue
      const d = dx * dx + dy * dy
      if (!best || miss < best.miss - 1e-9 || (Math.abs(miss - best.miss) <= 1e-9 && d < best.d)) best = { x: x + dx, y: y + dy, miss, d }
    }
  return best ? [best.x, best.y] : null
}

/** The tunic's place on a frame, per side: the hand on that side moves as this does. */
function bodyPoint(t: Torso | undefined, side: 'r' | 'l', o: { ox: number; oy: number }): [number, number] | null {
  if (!t) return null
  return [(side === 'r' ? t.x1 : t.x0) + o.ox, t.y1 + o.oy]
}

/**
 * One hand through one strip, in origin px. `ref` is the hand's place on idle
 * frame 0 (the rig's fist), `template` its fist there (null: follow the body),
 * `refBody` the tunic's point on idle frame 0.
 */
export function trackHand(
  s: RawStrip,
  side: 'r' | 'l',
  ref: [number, number],
  template: Template | null,
  torsos: readonly Torso[],
  refBody: [number, number] | null,
  reach: number,
): { pts: HeldGrip[]; seen: boolean[] } {
  const o = cellOrigin(s)
  const pts: HeldGrip[] = []
  const seen: boolean[] = []
  // The last place the hand was, and the tunic's point then.
  let last: [number, number] = ref
  let lastBody = refBody
  for (let f = 0; f < s.frames; f++) {
    const hit = template ? matchFist(s, f, template, last[0] - o.ox, last[1] - o.oy, reach) : null
    const body = bodyPoint(torsos[f], side, o)
    let p: [number, number]
    if (hit) p = [hit[0] + o.ox, hit[1] + o.oy]
    else if (body && lastBody) p = [last[0] + body[0] - lastBody[0], last[1] + body[1] - lastBody[1]]
    else p = last
    pts.push([p[0], p[1]])
    seen.push(!!hit)
    last = p
    lastBody = body ?? lastBody
  }
  return { pts, seen }
}

/**
 * Step 4: an idle track whose every move is a 1 px flip while the tunic holds
 * still is noise — the tunic's own motion is used instead.
 */
export function steady(track: { pts: HeldGrip[]; seen: boolean[] }, bodyTrack: HeldGrip[]): HeldGrip[] {
  const pts = track.pts
  const moves = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]])
  const flips = moves.filter(([dx, dy]) => dx || dy)
  const tiny = flips.length > 0 && flips.every(([dx, dy]) => Math.abs(dx) + Math.abs(dy) === 1)
  const set = new Set(pts.map((p) => `${p[0]},${p[1]}`))
  const bodyStill = bodyTrack.every((p) => p[0] === bodyTrack[0][0] && p[1] === bodyTrack[0][1])
  return tiny && set.size === 2 && bodyStill ? bodyTrack : pts
}

/** The looks whose fists are tracked off the art, per pack (no marker layer), and the strips each draws a mark over. */
export const HELD_PACKS: Readonly<Record<string, readonly string[]>> = {
  tinyswords: ['fighter', 'rogue', 'mystic'],
}

export interface LookStrips {
  look: string
  idle: RawStrip
  /** The strips the marks are drawn over, idle included. */
  strips: RawStrip[]
  /** The rig's fists, origin px, on idle frame 0. */
  fistR: [number, number]
  fistL: [number, number]
  torsos: Readonly<Record<string, readonly Torso[]>>
}

/** Every hand of a look through each of its strips. */
export function measureLook(l: LookStrips): { grips: Record<string, HeldStrip>; problems: string[] } {
  const io = cellOrigin(l.idle)
  const idleTorsos = l.torsos[l.idle.name] ?? []
  const grips: Record<string, HeldStrip> = {}
  const problems: string[] = []
  for (const s of l.strips) {
    const reach = s.name === l.idle.name ? IDLE_REACH : ATK_REACH
    const torsos = l.torsos[s.name] ?? []
    const out = {} as Record<'r' | 'l', HeldGrip[]>
    for (const side of ['r', 'l'] as const) {
      const ref = side === 'r' ? l.fistR : l.fistL
      const t = fistTemplate(l.idle, 0, ref[0] - io.ox, ref[1] - io.oy) ?? patchTemplate(l.idle, 0, ref[0] - io.ox, ref[1] - io.oy)
      const refBody = bodyPoint(idleTorsos[0], side, io)
      const track = trackHand(s, side, ref, t, torsos, refBody, reach)
      // The body's motion alone, for the steadiness check.
      const bodyOnly = trackHand(s, side, ref, null, torsos, refBody, reach).pts
      out[side] = s.name === l.idle.name ? steady(track, bodyOnly) : track.pts
      if (s.name === l.idle.name && t && !track.seen.every(Boolean)) problems.push(`${s.name}: the ${side === 'r' ? 'right' : 'left'} fist is lost on idle frame ${track.seen.indexOf(false)}`)
      if (s.name === l.idle.name && (out[side][0][0] !== ref[0] || out[side][0][1] !== ref[1])) problems.push(`${s.name}: idle frame 0 is not the rig's ${side} fist`)
    }
    grips[s.name] = { r: out.r, l: out.l }
  }
  return { grips, problems }
}

/** A marker-layer pack's hands (`anchors-lib.scan`: magenta main, cyan off), in origin px. */
export function fromMarkers(anchors: readonly Anchor[], s: Pick<RawStrip, 'w' | 'h' | 'frames'>): HeldStrip {
  const o = cellOrigin(s)
  return {
    r: anchors.map((a) => [a.mx + o.ox, a.my + o.oy] as const),
    l: anchors.map((a) => [a.ox + o.ox, a.oy + o.oy] as const),
  }
}

/** Problems with a table: a strip without a point per frame, a point off its cell. */
export function heldProblems(table: HeldGrips, sizes: Readonly<Record<string, Readonly<Record<string, Pick<RawStrip, 'w' | 'h' | 'frames'>>>>>): string[] {
  const out: string[] = []
  for (const [pack, strips] of Object.entries(table))
    for (const [name, h] of Object.entries(strips)) {
      const s = sizes[pack]?.[name]
      if (!s) continue
      const o = cellOrigin(s)
      for (const side of ['r', 'l'] as const) {
        if (h[side].length !== s.frames) out.push(`${pack}/${name}: ${h[side].length} ${side} points for ${s.frames} frames`)
        h[side].forEach(([x, y], f) => {
          if (!Number.isInteger(x) || !Number.isInteger(y)) out.push(`${pack}/${name}: frame ${f} ${side} is not on a whole px`)
          if (x < o.ox || x >= o.ox + o.cw || y < o.oy || y >= o.oy + s.h) out.push(`${pack}/${name}: frame ${f} ${side} (${x}, ${y}) is off the cell`)
        })
      }
    }
  return out
}

export function renderHeldGrips(table: HeldGrips): string {
  const row = (pts: readonly HeldGrip[]) => `[${pts.map(([x, y]) => `[${x}, ${y}]`).join(', ')}]`
  const packs = Object.keys(table)
    .sort()
    .map((pack) => {
      const strips = Object.keys(table[pack])
        .sort()
        .map((name) => `    ${JSON.stringify(name)}: {\n      r: ${row(table[pack][name].r)},\n      l: ${row(table[pack][name].l)},\n    },`)
        .join('\n')
      return `  ${JSON.stringify(pack)}: {\n${strips}\n  },`
    })
    .join('\n')
  return `/**
 * GENERATED — do not edit by hand.
 *
 * Written by \`npm run anchors\` (\`scripts/held-grips-lib.ts\`): where each
 * hand is on every frame of every hero strip a held mark is drawn over, in
 * logical px from the hero's origin (feet at y = +8) — the fist tracked off
 * the Tiny Swords art, frame by frame (a hand hidden behind the body follows
 * the tunic), and a marker-layer pack's own grips. \`r\` is the weapon hand,
 * \`l\` the off hand; \`gearMarks.drawMainHand\` / \`drawOffHand\` hold the
 * mark there. \`npm run anchors:check\` fails the build if this file and the
 * PNGs disagree.
 */
import type { HeldGrips } from './gearMarks'

export const HELD_GRIPS: HeldGrips = {
${packs}
}
`
}
