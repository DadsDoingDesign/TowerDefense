/**
 * enemy-clans.ts — bake each goblin clan's strips from the CC0 Tiny Swords
 * goblins already in the pack (Oct 2026, `src/game/data/clans.ts`).
 *
 *   npx tsx scripts/enemy-clans.ts            bake, write the PNGs and the table
 *   npx tsx scripts/enemy-clans.ts --check    re-bake in memory; fail if any file differs
 *   npx tsx scripts/enemy-clans.ts --sheet <file.png>   also write a ×3 contact sheet
 *
 * For every clan × faction × tier it reads the plain goblin's file —
 * `tinyswords/torch<N>_walk.png`, `tnt<N>_walk.png` (6-frame run cycles) and
 * `barrel<N>.png` (the still the renderer rolls in quarter turns) — and writes
 * `tinyswords/<clan>_<same name>.png`:
 *
 *  1. **Room.** The canvas grows `PAD` px (headroom for crests, hats and horns;
 *     a barrel also grows at its sides), so a part never clips at the cell
 *     edge and the HP bar can sit over the tallest frame
 *     (`enemyClans.generated.ts`, read by `units.drawEnemy`).
 *  2. **Cuts.** What the clan replaces is cut, by its colours, inside a box
 *     that tracks the body frame by frame: the torch's flame (the clan's
 *     weapon head goes on the haft), the bomber's dynamite bundle and lit
 *     stick, the keg's fuse. The ink left without anything to outline goes
 *     with it.
 *  3. **Parts.** ORIGINAL pixel parts (`enemy-clans-art.ts`) are laid on, each
 *     auto-inked in the pack's outline colour. Every part is anchored to the
 *     body FRAME BY FRAME: the head is found in each frame by matching frame
 *     0's head pixels, the haft's top and the hand's stick by their colours, so
 *     the walk cycle carries every part. `under` parts (banners, mantles,
 *     packs) only fill transparent pixels — they sit behind the body.
 *  4. **Palette.** Every part colour is snapped to a colour the pack already
 *     ships (all four `tinyswords` folders), so the files pass
 *     `harvest-cc0.ts --check`'s palette test: nothing here carries a colour
 *     the old CC0 build does not contain. The keg keeps its 1 px halo
 *     convention (`#161C2E` @ 80) around the new outline.
 *
 * The tier hue — the robe, the bomber's pack, the keg's staves — is never
 * painted over by more than a part's edge, so the tier colour code still
 * reads; ornament (not size) climbs with the tier (`enemy-clans-art.ts`
 * `ladder`). Champions are baked from the same strips and drawn at the pack's
 * native density, so their parts show twice the detail.
 *
 * Provenance: the source goblins are the old CC0 build (`CC0-MANIFEST.md`);
 * the parts are drawn here. Runs offline: it reads only files in the repo.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp, { type OverlayOptions } from 'sharp'
import { CLAN_IDS, TIERS, type ClanId, type Faction } from '../src/game/data/clans'
import { INK, MASTER, recipeFor, type Part, type Recipe } from './enemy-clans-art'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PACK = join(ROOT, 'public', 'assets', 'sprites', 'tinyswords')
const GEN = join(ROOT, 'src', 'game', 'render', 'enemyClans.generated.ts')
const CHECK = process.argv.includes('--check')
const SHEET = process.argv.includes('--sheet') ? process.argv[process.argv.indexOf('--sheet') + 1] : null
/** `--proposals <dir>`: bake the proposal kits (`enemy-clans-proposals.ts`) into `dir` — review art, never shipped. */
const PROPOSALS = process.argv.includes('--proposals') ? process.argv[process.argv.indexOf('--proposals') + 1] : null

/** Headroom (and a keg's side room), in source px. */
export const PAD: Readonly<Record<Faction, { top: number; side: number }>> = {
  torch: { top: 18, side: 0 },
  tnt: { top: 18, side: 0 },
  barrel: { top: 10, side: 6 },
}
const FRAME_W: Readonly<Record<Faction, number>> = { torch: 115, tnt: 90, barrel: 52 }

interface Img {
  w: number
  h: number
  d: Uint8ClampedArray
}
type RGB = readonly [number, number, number]

async function load(file: string): Promise<Img> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { w: info.width, h: info.height, d: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) }
}
const encode = (img: Img): Promise<Buffer> =>
  sharp(Buffer.from(img.d.buffer, img.d.byteOffset, img.d.length), { raw: { width: img.w, height: img.h, channels: 4 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()

const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]
const key = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b
const INK_RGB = hex(INK)
const HALO_A = 80

// ── the pack's palette ──────────────────────────────────────────────────────
/** Every opaque colour the four `tinyswords` folders ship, clan files excluded. */
async function packPalette(): Promise<RGB[]> {
  const set = new Map<number, RGB>()
  const isClan = (f: string) => CLAN_IDS.some((c) => f.startsWith(`${c}_`))
  for (const dir of ['sprites/tinyswords', 'ui/tinyswords', 'fx/tinyswords', 'deco/tinyswords']) {
    const abs = join(ROOT, 'public', 'assets', dir)
    if (!existsSync(abs)) continue
    for (const f of readdirSync(abs).filter((f) => f.endsWith('.png') && !isClan(f))) {
      const im = await load(join(abs, f))
      for (let i = 0; i < im.d.length; i += 4) if (im.d[i + 3] > 200) set.set(key(im.d[i], im.d[i + 1], im.d[i + 2]), [im.d[i], im.d[i + 1], im.d[i + 2]])
    }
  }
  return [...set.values()]
}
/** Redmean distance: cheap and close enough to perceptual for snapping a part's hues. */
function nearest(pal: readonly RGB[], c: RGB): RGB {
  let best = pal[0]
  let bd = Infinity
  for (const p of pal) {
    const rm = (p[0] + c[0]) / 2
    const dr = p[0] - c[0]
    const dg = p[1] - c[1]
    const db = p[2] - c[2]
    const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db
    if (d < bd) {
      bd = d
      best = p
    }
  }
  return best
}

// ── pixels ──────────────────────────────────────────────────────────────────
const at = (im: Img, x: number, y: number) => (y * im.w + x) * 4
const inside = (im: Img, x: number, y: number) => x >= 0 && y >= 0 && x < im.w && y < im.h
const alpha = (im: Img, x: number, y: number) => (inside(im, x, y) ? im.d[at(im, x, y) + 3] : 0)
const solid = (im: Img, x: number, y: number) => alpha(im, x, y) > 200
const rgbAt = (im: Img, x: number, y: number): number => {
  const i = at(im, x, y)
  return key(im.d[i], im.d[i + 1], im.d[i + 2])
}
const isInk = (im: Img, x: number, y: number) => solid(im, x, y) && rgbAt(im, x, y) === key(...INK_RGB)
function put(im: Img, x: number, y: number, c: RGB, a = 255): void {
  if (!inside(im, x, y)) return
  const i = at(im, x, y)
  im.d[i] = c[0]
  im.d[i + 1] = c[1]
  im.d[i + 2] = c[2]
  im.d[i + 3] = a
}
const clear = (im: Img, x: number, y: number) => inside(im, x, y) && im.d.fill(0, at(im, x, y), at(im, x, y) + 4)

/** Grow the canvas: `top` rows above, `side` columns each side of every frame. */
function grow(src: Img, fw: number, top: number, side: number): { im: Img; fw: number } {
  const frames = src.w / fw
  const nfw = fw + side * 2
  const im: Img = { w: nfw * frames, h: src.h + top, d: new Uint8ClampedArray(nfw * frames * (src.h + top) * 4) }
  for (let f = 0; f < frames; f++)
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < fw; x++) {
        const s = at(src, f * fw + x, y)
        const o = at(im, f * nfw + side + x, y + top)
        im.d.set(src.d.subarray(s, s + 4), o)
      }
  return { im, fw: nfw }
}

/**
 * Where frame `f`'s head sits relative to frame 0's: the shift that makes the
 * most of frame 0's head pixels (inside `box`) land on the same colour.
 */
function track(im: Img, fw: number, f: number, box: readonly [number, number, number, number], reach = 12): { dx: number; dy: number } {
  const [x0, y0, x1, y1] = box
  let best = { dx: 0, dy: 0, n: -1 }
  for (let dy = -reach; dy <= reach; dy++)
    for (let dx = -reach; dx <= reach; dx++) {
      let n = 0
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          if (!solid(im, x, y)) continue
          const tx = f * fw + x + dx
          const ty = y + dy
          if (tx < f * fw || tx >= (f + 1) * fw || !solid(im, tx, ty)) continue
          if (rgbAt(im, x, y) === rgbAt(im, tx, ty)) n++
        }
      if (n > best.n || (n === best.n && Math.abs(dx) + Math.abs(dy) < Math.abs(best.dx) + Math.abs(best.dy))) best = { dx, dy, n }
    }
  return best
}

/** The topmost (then mean x) pixel of any of `cols` inside a box of frame `f`. */
function topOf(im: Img, fw: number, f: number, cols: ReadonlySet<number>, box: readonly [number, number, number, number]): { x: number; y: number } | null {
  const [x0, y0, x1, y1] = box
  for (let y = Math.max(0, y0); y <= Math.min(im.h - 1, y1); y++) {
    const xs: number[] = []
    for (let x = Math.max(0, x0); x <= Math.min(fw - 1, x1); x++) if (solid(im, f * fw + x, y) && cols.has(rgbAt(im, f * fw + x, y))) xs.push(x)
    if (xs.length) return { x: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length), y }
  }
  return null
}
/** The centre of any of `cols` inside a box of frame `f`. */
function centreOf(im: Img, fw: number, f: number, cols: ReadonlySet<number>, box: readonly [number, number, number, number]): { x: number; y: number } | null {
  const [x0, y0, x1, y1] = box
  let sx = 0
  let sy = 0
  let n = 0
  for (let y = Math.max(0, y0); y <= Math.min(im.h - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(fw - 1, x1); x++)
      if (solid(im, f * fw + x, y) && cols.has(rgbAt(im, f * fw + x, y))) {
        sx += x
        sy += y
        n++
      }
  return n ? { x: Math.round(sx / n), y: Math.round(sy / n) } : null
}

/** Cut every pixel of `cols` inside the box (frame-local), then the ink left outlining nothing. */
function cut(im: Img, fw: number, f: number, cols: ReadonlySet<number>, box: readonly [number, number, number, number]): void {
  const [x0, y0, x1, y1] = box
  const ox = f * fw
  const gone = new Set<number>()
  for (let y = Math.max(0, y0); y <= Math.min(im.h - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(fw - 1, x1); x++)
      if (solid(im, ox + x, y) && cols.has(rgbAt(im, ox + x, y))) {
        clear(im, ox + x, y)
        gone.add(y * fw + x)
      }
  /** Within two px of a pixel this cut took: only that ink outlined it. */
  const byCut = (x: number, y: number): boolean => {
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (gone.has((y + j) * fw + x + i)) return true
    return false
  }
  // Ink is an outline: once what it outlined is gone, it goes too (two passes
  // take a two-pixel-thick stroke). Only ink beside the cut: an arm drawn as a
  // bare ink line (the bomber's, swung down in frames 3–5) outlines nothing
  // either, and went with the stick until round 2 — the fist floated.
  for (let pass = 0; pass < 2; pass++) {
    const drop: [number, number][] = []
    for (let y = Math.max(0, y0 - 2); y <= Math.min(im.h - 1, y1 + 2); y++)
      for (let x = Math.max(0, x0 - 2); x <= Math.min(fw - 1, x1 + 2); x++) {
        if (!isInk(im, ox + x, y) || !byCut(x, y)) continue
        let keep = false
        for (let j = -1; j <= 1 && !keep; j++)
          for (let i = -1; i <= 1 && !keep; i++) {
            const nx = x + i
            if (nx < 0 || nx >= fw || (i === 0 && j === 0)) continue
            if (solid(im, ox + nx, y + j) && !isInk(im, ox + nx, y + j)) keep = true
          }
        if (!keep) drop.push([ox + x, y])
      }
    for (const [x, y] of drop) clear(im, x, y)
  }
  // Soft halo pixels left floating beside nothing.
  for (let y = Math.max(0, y0 - 2); y <= Math.min(im.h - 1, y1 + 2); y++)
    for (let x = Math.max(0, x0 - 2); x <= Math.min(fw - 1, x1 + 2); x++) {
      const a = alpha(im, ox + x, y)
      if (a === 0 || a > 200) continue
      let near = false
      for (let j = -1; j <= 1 && !near; j++) for (let i = -1; i <= 1 && !near; i++) if (solid(im, ox + x + i, y + j)) near = true
      if (!near && y < y1 + 2 && rgbAt(im, ox + x, y) === key(...INK_RGB)) clear(im, ox + x, y)
    }
}

/**
 * Mend the holes a cut left INSIDE a body. A hole is a run of empty pixels in
 * the box that does not reach the box's edge (so the air round the body is
 * never one — `sealTop` treats the box's top row as closed, for a lid whose
 * rim the box starts under); the ink that ringed what was cut goes with it, unless it also
 * borders the air (the body's own outline). The hole then closes from its rim
 * in, each pixel taking its painted neighbours' commonest colour.
 */
function mend(im: Img, fw: number, f: number, box: readonly [number, number, number, number], sealTop = false, sealAll = false): void {
  const [x0, y0, x1, y1] = [Math.max(0, box[0]), Math.max(0, box[1]), Math.min(fw - 1, box[2]), Math.min(im.h - 1, box[3])]
  const ox = f * fw
  const id = (x: number, y: number) => y * fw + x
  const seen = new Set<number>()
  const hole = new Set<number>()
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (solid(im, ox + x, y) || seen.has(id(x, y))) continue
      const run: number[] = []
      let open = false
      const stack = [[x, y]]
      seen.add(id(x, y))
      while (stack.length) {
        const [cx, cy] = stack.pop()!
        run.push(id(cx, cy))
        if (!sealAll && (cx === x0 || cx === x1 || (cy === y0 && !sealTop) || cy === y1)) open = true
        for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + i
          const ny = cy + j
          if (nx < x0 || nx > x1 || ny < y0 || ny > y1 || seen.has(id(nx, ny)) || solid(im, ox + nx, ny)) continue
          seen.add(id(nx, ny))
          stack.push([nx, ny])
        }
      }
      if (!open) for (const r of run) hole.add(r)
    }
  if (!hole.size) return
  // The cut thing's ink rim: ink next to the hole and not next to the air.
  const rim: number[] = []
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!isInk(im, ox + x, y)) continue
      let byHole = false
      let byAir = false
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const nx = x + i
          const ny = y + j
          if (nx < 0 || nx >= fw || ny < 0 || ny >= im.h || (i === 0 && j === 0)) continue
          if (hole.has(id(nx, ny))) byHole = true
          else if (!solid(im, ox + nx, ny)) byAir = true
        }
      if (byHole && !byAir) rim.push(id(x, y))
    }
  for (const r of rim) hole.add(r)
  for (let pass = 0; pass < 40 && hole.size; pass++) {
    const fills: [number, number][] = []
    for (const h of hole) {
      const x = h % fw
      const y = Math.floor(h / fw)
      const count = new Map<number, number>()
      for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + i
        const ny = y + j
        if (nx < 0 || nx >= fw || ny < 0 || ny >= im.h || hole.has(id(nx, ny)) || !solid(im, ox + nx, ny) || isInk(im, ox + nx, ny)) continue
        const c = rgbAt(im, ox + nx, ny)
        count.set(c, (count.get(c) ?? 0) + 1)
      }
      if (count.size) fills.push([h, [...count].sort((a, b) => b[1] - a[1])[0][0]])
    }
    if (!fills.length) break
    for (const [h, c] of fills) {
      put(im, ox + (h % fw), Math.floor(h / fw), [(c >> 16) & 255, (c >> 8) & 255, c & 255])
      hole.delete(h)
    }
  }
}

/**
 * Clear every opaque island of at most `max` px that does not touch the
 * frame's body (its largest island): crumbs a cut left (a fuse's last
 * pixel, a stick's outline) or a part's stray pixel. Round 2 of the asset
 * critique found 1–5 px crumbs beside every keg's lid and every bomber's hand.
 */
function despeckle(im: Img, fw: number, f: number, max: number): void {
  const ox = f * fw
  const seen = new Uint8Array(fw * im.h)
  const islands: number[][] = []
  for (let y = 0; y < im.h; y++)
    for (let x = 0; x < fw; x++) {
      if (seen[y * fw + x] || !solid(im, ox + x, y)) continue
      const run: number[] = []
      const stack = [y * fw + x]
      seen[y * fw + x] = 1
      while (stack.length) {
        const id = stack.pop()!
        run.push(id)
        const cx = id % fw
        const cy = Math.floor(id / fw)
        for (let j = -1; j <= 1; j++)
          for (let i = -1; i <= 1; i++) {
            const nx = cx + i
            const ny = cy + j
            if (nx < 0 || ny < 0 || nx >= fw || ny >= im.h || seen[ny * fw + nx] || !solid(im, ox + nx, ny)) continue
            seen[ny * fw + nx] = 1
            stack.push(ny * fw + nx)
          }
      }
      islands.push(run)
    }
  islands.sort((a, b) => b.length - a.length)
  for (const run of islands.slice(1))
    if (run.length <= max)
      for (const id of run) {
        const x = id % fw
        const y = Math.floor(id / fw)
        clear(im, ox + x, y)
        // its soft halo goes with it
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (x + i >= 0 && x + i < fw && alpha(im, ox + x + i, y + j) > 0 && alpha(im, ox + x + i, y + j) <= 200) clear(im, ox + x + i, y + j)
      }
}

/** Lay one part with its top-left at frame-local (px, py), inked, `under` filling only empty pixels. */
/** Returns the topmost row it painted (fill or ink), or Infinity. */
function lay(im: Img, fw: number, f: number, part: Part, px: number, py: number, pal: readonly RGB[], halo: boolean): number {
  const ox = f * fw
  const mask = new Set<number>()
  const rows = part.flip ? part.grid.map((r) => [...r].reverse().join('')) : part.grid
  const under = part.layer === 'under'
  let top = Infinity
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]
      if (ch === '.' || ch === ' ') continue
      const x = px + i
      const y = py + j
      if (x < 0 || x >= fw || y < 0 || y >= im.h) continue
      if (under && solid(im, ox + x, y)) continue
      const hexc = MASTER[ch]
      if (!hexc) throw new Error(`[enemy-clans] part '${part.name}': no colour for '${ch}'`)
      put(im, ox + x, y, nearest(pal, hex(hexc)))
      mask.add(y * fw + x)
      top = Math.min(top, y)
    }
  })
  if (part.ink === false) return top
  // Ink: every 4-neighbour of the part that is not the part (and, for an
  // under part, not the body), so the part reads as its own shape.
  const ink: [number, number][] = []
  for (const m of mask) {
    const x = m % fw
    const y = Math.floor(m / fw)
    for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + i
      const ny = y + j
      if (nx < 0 || nx >= fw || ny < 0 || ny >= im.h || mask.has(ny * fw + nx)) continue
      if (under && solid(im, ox + nx, ny)) continue
      if (!under && part.inkOver === false && solid(im, ox + nx, ny)) continue
      ink.push([nx, ny])
    }
  }
  for (const [x, y] of ink) {
    put(im, ox + x, y, INK_RGB)
    top = Math.min(top, y)
  }
  if (!halo) return top
  for (const [x, y] of ink)
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const nx = x + i
        if (nx < 0 || nx >= fw) continue
        if (alpha(im, ox + nx, y + j) === 0) put(im, ox + nx, y + j, INK_RGB, HALO_A)
      }
  return top
}

// ── the bake ────────────────────────────────────────────────────────────────
const set = (...h: string[]) => new Set(h.map((c) => key(...hex(c))))
/** The torch's flame, its sparks and the rag wrap it burns on (`torch1..5_walk`: the same in every tier). */
const FLAME = set('#d9945f', '#ffed44', '#ffffff', '#9e7466', '#d5b583', '#efe1ab')
/** The torch's wooden haft, under the wrap. */
const HAFT = set('#977b6b', '#685757')
/** The bomber's dynamite bundle: sticks and fuses. */
const STICKS = set('#f76666', '#ab6282', '#ffcfb4')
/** The bomber's lit stick in the hand: the stick, its fuse and its spark. */
const STICK = set('#9e7466', '#d9945f', '#ffcfb4', '#f4e341', '#ffffff', '#f76666', '#ab6282')
/** The stick itself: where the hand holds it. */
const STICK_BODY = set('#f76666', '#ab6282')
/** The keg's rope fuse. */
const FUSE = set('#efe1ab', '#d5b583', '#977b6b')

/** Frame 0's head (and the bomber's pack), in source coords of the tier-1 strip — what `track` matches. */
const HEAD_BOX: Readonly<Record<'torch' | 'tnt', readonly [number, number, number, number]>> = {
  torch: [56, 4, 110, 40],
  tnt: [24, 10, 64, 40],
}

export interface Baked {
  role: string
  png: Buffer
  /**
   * The head's top in its tallest frame — the body's and every part laid OVER
   * it (headgear, weapon), not the thin poles and cloths behind it — as a
   * fraction of the cell height: where the HP bar hangs.
   */
  top: number
  fw: number
  fh: number
}

async function bakeOne(clan: ClanId, faction: Faction, tier: number, pal: readonly RGB[], recipeOf: (f: Faction, t: number) => Recipe = (f, t) => recipeFor(clan, f, t)): Promise<Baked> {
  const still = faction === 'barrel'
  const srcName = still ? `barrel${tier}` : `${faction}${tier}_walk`
  const src = await load(join(PACK, `${srcName}.png`))
  const pad = PAD[faction]
  const { im, fw } = grow(src, FRAME_W[faction], pad.top, pad.side)
  const frames = im.w / fw
  const recipe = recipeOf(faction, tier)
  const T = pad.top
  const S = pad.side
  // Anchors first, all on the untouched strip (frame 0 is the reference).
  const anchors = Array.from({ length: frames }, (_, f) => {
    const head = still || f === 0 ? { dx: 0, dy: 0 } : track(im, fw, f, shift(HEAD_BOX[faction as 'torch' | 'tnt'], S, T))
    const tip = faction === 'torch' ? topOf(im, fw, f, HAFT, [20, 18 + T, 57, 50 + T]) : null
    const hand = faction === 'tnt' ? centreOf(im, fw, f, STICK_BODY, shift([63, 10, 89, 52], head.dx, head.dy + T)) : null
    return { head, tip, hand }
  })
  let top = im.h
  for (let f = 0; f < frames; f++) {
    const { head, tip, hand } = anchors[f]
    if (faction === 'torch' && recipe.cuts.includes('flame')) cut(im, fw, f, FLAME, [0, 0, 50, 30 + T])
    if (faction === 'tnt') {
      if (recipe.cuts.includes('sticks')) cut(im, fw, f, STICKS, shift([0, -6, 44, 32], head.dx, head.dy + T)) // to 44: the fuse tips over the head (round 2: a pink tick poked out of every hat)
      if (recipe.cuts.includes('stick')) cut(im, fw, f, STICK, shift([63, 0, 89, 68], head.dx, head.dy + T)) // to 68: the swung-down stick's butt (round 2: a pink stub dangled under the fist in frames 3–5)
    }
    if (faction === 'barrel' && recipe.cuts.includes('fuse')) {
      cut(im, fw, f, FUSE, [S + 18, T - 2, S + 34, T + 28])
      // The stencilled TNT goes too, under the clan's mark.
      cut(im, fw, f, set('#ffffff'), [S + 10, T + 47, S + 41, T + 57])
      // The stencil sits inside the staves: every gap it leaves is a hole to
      // close (round 1: the gaps touching the box's edge were left open, so
      // the grass showed through the keg).
      mend(im, fw, f, [S + 10, T + 47, S + 41, T + 57], false, true)
    }
    despeckle(im, fw, f, 6)
    // The body's own top, once the cuts are made (the plain flame is gone).
    for (let y = 0; y < Math.min(top, im.h); y++) {
      let row = false
      for (let x = 0; x < fw && !row; x++) row = solid(im, f * fw + x, y)
      if (row) {
        top = y
        break
      }
    }
    if (recipe.bands) {
      // The hoops' cream, in the clan's metal (or wood): the keg's colour
      // stays the tier's, its hardware becomes the clan's.
      const light = nearest(pal, hex(MASTER[recipe.bands.light]))
      const dark = nearest(pal, hex(MASTER[recipe.bands.dark]))
      // The hoops' white glints take the clan's `hi` (round 1: they stayed
      // white on soot and iron hoops — a glint brighter than the metal).
      const hi = nearest(pal, hex(MASTER[recipe.bands.hi ?? recipe.bands.light]))
      const from = new Map([
        [key(...hex('#efe1ab')), light],
        [key(...hex('#d5b583')), dark],
        [key(...hex('#ffffff')), hi],
      ])
      for (let y = 0; y < im.h; y++)
        for (let x = 0; x < fw; x++) {
          if (!solid(im, f * fw + x, y)) continue
          const to = from.get(rgbAt(im, f * fw + x, y))
          if (to) put(im, f * fw + x, y, to)
        }
    }
    for (const rc of recipe.recolor ?? []) {
      const [bx0, by0, bx1, by1] = shift(rc.box, S + head.dx, T + head.dy)
      const to = new Map(Object.entries(rc.map).map(([from, l]) => [key(...hex(from)), nearest(pal, hex(MASTER[l]))]))
      for (let y = Math.max(0, by0); y <= Math.min(im.h - 1, by1); y++)
        for (let x = Math.max(0, bx0); x <= Math.min(fw - 1, bx1); x++) {
          if (!solid(im, f * fw + x, y)) continue
          const c = to.get(rgbAt(im, f * fw + x, y))
          if (c) put(im, f * fw + x, y, c)
        }
    }
    for (const part of recipe.parts) {
      let px: number
      let py: number
      if (part.at === 'tip' || part.at === 'hand') {
        const a = part.at === 'tip' ? tip : hand
        if (!a) throw new Error(`[enemy-clans] ${clan} ${srcName} frame ${f}: no '${part.at}' anchor`)
        px = a.x + part.x
        py = a.y + part.y
      } else {
        px = S + part.x + head.dx
        py = T + part.y + head.dy
      }
      const t = lay(im, fw, f, part, px, py, pal, still)
      if (part.layer !== 'under') top = Math.min(top, t)
    }
    // The rope lay ON the lid: mend the lid where it was, from the staves
    // round it (the box starts under the lid's rim, so its top is sealed).
    if (faction === 'barrel' && recipe.cuts.includes('fuse')) mend(im, fw, f, [S + 16, T + 18, S + 36, T + 30], true)
    despeckle(im, fw, f, 2)
  }
  return { role: `${clan}_${srcName}`, png: await encode(im), top: +(top / im.h).toFixed(4), fw, fh: im.h }
}
const shift = (b: readonly [number, number, number, number], dx: number, dy: number) => [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy] as const

async function proposals(dir: string): Promise<void> {
  const pal = await packPalette()
  const { PROPOSAL_KITS } = await import('./enemy-clans-proposals')
  const { recipeFromKit } = await import('./enemy-clans-art')
  for (const [id, kit] of Object.entries(PROPOSAL_KITS))
    for (const faction of ['torch', 'tnt', 'barrel'] as const)
      for (const t of TIERS) {
        const b = await bakeOne(id as ClanId, faction, t, pal, (f, tier) => recipeFromKit(kit(), f, tier))
        writeFileSync(join(dir, `${b.role}.png`), b.png)
      }
  console.log(`[enemy-clans] proposals → ${dir}`)
}

async function main(): Promise<void> {
  if (PROPOSALS) return proposals(PROPOSALS)
  const pal = await packPalette()
  const out: Baked[] = []
  for (const clan of CLAN_IDS) for (const faction of ['torch', 'tnt', 'barrel'] as const) for (const t of TIERS) out.push(await bakeOne(clan, faction, t, pal))
  let differs = 0
  for (const b of out) {
    const file = join(PACK, `${b.role}.png`)
    if (CHECK) {
      if (!existsSync(file)) {
        differs++
        console.log(`  missing ${b.role}.png`)
        continue
      }
      // Compare decoded pixels, not bytes: the encoder may change under us.
      const a = await load(file)
      const c = await sharp(b.png).ensureAlpha().raw().toBuffer()
      if (Buffer.compare(Buffer.from(a.d), c) !== 0) {
        differs++
        console.log(`  stale ${b.role}.png`)
      }
    } else writeFileSync(file, b.png)
  }
  const table =
    `// Generated by \`npx tsx scripts/enemy-clans.ts\` — do not edit.\n` +
    `/**\n * Each baked clan strip's cell size (source px) and the first opaque row of its\n` +
    ` * tallest frame as a fraction of the cell height: where \`units.drawEnemy\`\n * hangs the HP bar so it clears a crest, a hat or horns.\n */\n` +
    `export const CLAN_ART: Readonly<Record<string, { fw: number; fh: number; top: number }>> = {\n` +
    out.map((b) => `  ${b.role}: { fw: ${b.fw}, fh: ${b.fh}, top: ${b.top} },`).join('\n') +
    `\n}\n`
  if (CHECK) {
    if (!existsSync(GEN) || readFileSync(GEN, 'utf8') !== table) {
      differs++
      console.log('  stale enemyClans.generated.ts')
    }
    if (differs) {
      console.error(`[enemy-clans] ${differs} file(s) out of date — run \`npx tsx scripts/enemy-clans.ts\``)
      process.exit(1)
    }
    console.log(`[enemy-clans] ${out.length} clan strips up to date`)
  } else {
    writeFileSync(GEN, table)
    const kb = out.reduce((a, b) => a + b.png.length, 0) / 1024
    console.log(`[enemy-clans] wrote ${out.length} strips (${kb.toFixed(1)} KB) + enemyClans.generated.ts`)
  }
  if (SHEET) await sheet(out)
}

/** A ×3 contact sheet on grass: plain goblin, then each clan, per faction × tier (frame 0). */
async function sheet(out: Baked[]): Promise<void> {
  const Z = 3
  const cellW = 130
  const cellH = 100
  const cols = 1 + CLAN_IDS.length
  const rows = 15
  const W = cols * cellW
  const H = rows * cellH
  const comp: OverlayOptions[] = []
  let r = 0
  for (const faction of ['torch', 'tnt', 'barrel'] as const)
    for (const t of TIERS) {
      const plain = faction === 'barrel' ? `barrel${t}` : `${faction}${t}_walk`
      const pfw = FRAME_W[faction]
      const items = [{ file: readFileSync(join(PACK, `${plain}.png`)), fw: pfw }, ...CLAN_IDS.map((c) => {
        const b = out.find((o) => o.role === `${c}_${plain}`)!
        return { file: b.png, fw: b.fw }
      })]
      for (let c = 0; c < items.length; c++) {
        const it = items[c]
        const meta = await sharp(it.file).metadata()
        const fr = await sharp(it.file).extract({ left: 0, top: 0, width: it.fw, height: meta.height! }).png().toBuffer()
        comp.push({ input: fr, left: c * cellW + Math.max(0, Math.floor((cellW - it.fw) / 2)), top: r * cellH + Math.max(0, cellH - meta.height!) })
      }
      r++
    }
  const base = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 90, g: 155, b: 67, alpha: 1 } } })
    .composite(comp)
    .png()
    .toBuffer()
  await sharp(base).resize(W * Z, H * Z, { kernel: 'nearest' }).png().toFile(SHEET!)
  console.log(`[enemy-clans] sheet → ${SHEET}`)
}

await main()
