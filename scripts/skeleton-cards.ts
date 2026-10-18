/**
 * skeleton-cards — the designer's phone cards for round 4 of the company
 * faces ("Characters rebuilt"): each face's skeleton over its art, the art
 * beside the CC0 knight and pawn at the same scale, the line-up, and every
 * liaison post as the game shows it.
 *
 *   npx vite --port 5253 --strictPort &
 *   SHOTS_DPR=1.5 node scripts/places-shots.mjs <shots> p390
 *   npx tsx scripts/stop-scenes.ts --proposals <proposals>
 *   npx tsx scripts/skeleton-cards.ts <shots> <proposals>
 *
 * Writes `docs/characters/cards/skeleton-r4/*.png` (~600 px wide) and its
 * `manifest.json` (`[{ id, group, people, title, caption, file }]`). Every
 * face pixel is `postFrame` (the draw code the posts bake with) and every
 * overlay `skeletonOverlay`; the knight, archer, pawn and goblin are the CC0
 * pack's own cells from the verified cache `harvest-cc0.ts` keeps. Only the
 * cards are magnified, by whole numbers (nearest neighbour).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { POST_H, POST_W, postFeetOf, postFrame, postFrames, postJoints2, postPose } from '../src/game/render/hero/post'
import { skeletonOf, skeletonOverlay } from '../src/game/render/hero/skeleton'
import type { PersonaId } from '../src/game/render/hero/rig'
import { SCENE_ANCHORS, SCENE_SIZE } from '../src/ui/shell/stopScenes.generated'

const ROOT = resolve(import.meta.dirname, '..')
const OUT = join(ROOT, 'docs/characters/cards/skeleton-r4')
const CACHE = join(ROOT, 'node_modules/.cache/cc0-pack')
const SHOTS = process.argv[2] ? resolve(process.argv[2]) : null
const PROPOSALS = process.argv[3] ? resolve(process.argv[3]) : null
const W = 600

type Img = { w: number; h: number; rgba: Uint8ClampedArray }
const img = (w: number, h: number, bg: readonly number[] = [28, 24, 21]): Img => {
  const rgba = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) rgba.set([bg[0], bg[1], bg[2], 255], i * 4)
  return { w, h, rgba }
}
/** Blit `src`'s (sx, sy, sw, sh) at (x0, y0), `k`× (a whole number), alpha over. */
function blit(dst: Img, src: Img, x0: number, y0: number, k = 1, sx = 0, sy = 0, sw = src.w, sh = src.h): void {
  for (let y = 0; y < sh * k; y++)
    for (let x = 0; x < sw * k; x++) {
      const s = ((sy + Math.floor(y / k)) * src.w + (sx + Math.floor(x / k))) * 4
      const a = src.rgba[s + 3] / 255
      if (!a) continue
      const dx = x0 + x, dy = y0 + y
      if (dx < 0 || dy < 0 || dx >= dst.w || dy >= dst.h) continue
      const d = (dy * dst.w + dx) * 4
      for (let c = 0; c < 3; c++) dst.rgba[d + c] = src.rgba[s + c] * a + dst.rgba[d + c] * (1 - a)
    }
}
async function load(file: string): Promise<Img> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { w: info.width, h: info.height, rgba: new Uint8ClampedArray(data) }
}
const face = (id: PersonaId, anim: 'idle' | 'tic' | 'react' = 'idle', f = 0): Img => postFrame(id, anim, f)

// the pack: frame 0 of each unit's 192 cell, and the grass tile
const cc = async (rel: string) => load(join(CACHE, rel))
const PAWN = await cc('Factions/Knights/Troops/Pawn/Blue/Pawn_Blue.png')
const KNIGHT = await cc('Factions/Knights/Troops/Warrior/Blue/Warrior_Blue.png')
const ARCHER = await cc('Factions/Knights/Troops/Archer/Blue/Archer_Blue.png')
const TORCH = await cc('Factions/Goblins/Troops/Torch/Red/Torch_Red.png')
const FLAT = await cc('Terrain/Ground/Tilemap_Flat.png')
/** Each CC0 unit: its cell's x window and the row its soles stand on (measured off frame 0). */
const PACK = {
  pawn: { im: PAWN, x: 66, w: 60, sole: 121 },
  knight: { im: KNIGHT, x: 60, w: 84, sole: 130 },
  archer: { im: ARCHER, x: 64, w: 70, sole: 131 },
  torch: { im: TORCH, x: 50, w: 80, sole: 127 },
} as const
/** Stand a pack unit with its soles at (x, y), k×. */
const packAt = (dst: Img, u: keyof typeof PACK, x: number, y: number, k: number) => blit(dst, PACK[u].im, x, y - PACK[u].sole * k, k, PACK[u].x, 0, PACK[u].w, PACK[u].sole + 8)
/** Stand a face with the middle of its feet at (x, y), k×. */
const faceAt = (dst: Img, id: PersonaId, x: number, y: number, k: number, fr: Img = face(id)) => {
  const ft = postFeetOf(id)
  blit(dst, fr, Math.round(x - ft.x * k), Math.round(y - (ft.y - 1) * k), k)
}
/** The pack's grass, tiled at k×, over a band of the card. */
function grass(dst: Img, y0: number, h: number, k: number): void {
  const t = { ...FLAT }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < dst.w; x++) {
      const s = ((64 + (Math.floor(y / k) % 64)) * t.w + (64 + (Math.floor(x / k) % 64))) * 4
      dst.rgba.set([t.rgba[s], t.rgba[s + 1], t.rgba[s + 2], 255], ((y0 + y) * dst.w + x) * 4)
    }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
type Label = [x: number, y: number, text: string, size?: number, anchor?: 'start' | 'middle' | 'end']
async function save(name: string, im: Img, labels: Label[] = []): Promise<void> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${im.w}" height="${im.h}">${labels
    .map(([x, y, t, s = 15, a = 'start']) => `<text x="${x}" y="${y}" font-family="DejaVu Sans, sans-serif" font-size="${s}" font-weight="700" fill="#efe6d6" stroke="#161c2e" stroke-width="3" paint-order="stroke" text-anchor="${a}">${esc(t)}</text>`)
    .join('')}</svg>`
  await sharp(Buffer.from(im.rgba), { raw: { width: im.w, height: im.h, channels: 4 } })
    .composite([{ input: Buffer.from(svg) }])
    .png({ palette: true, colours: 256, dither: 0, compressionLevel: 9, effort: 10 })
    .toFile(join(OUT, name))
}

interface Card { id: string; group: string; people: string; title: string; caption: string; file: string }
const cards: Card[] = []
const card = (c: Omit<Card, 'group' | 'file'>) => cards.push({ ...c, group: 'Characters rebuilt', file: `${c.id}.png` })

const ORDER: PersonaId[] = ['saffra', 'odile', 'brannoch', 'hask', 'wren']
const WHO: Record<PersonaId, { name: string; people: string; company: string }> = {
  saffra: { name: 'Saffra', people: 'human', company: 'Peppercorn Co.' },
  odile: { name: 'Odile', people: 'elf', company: 'Rosethread' },
  brannoch: { name: 'Brannoch', people: 'dwarf', company: 'Ironvein' },
  hask: { name: 'Hask', people: 'reptilian', company: 'Butcherblock (proposal)' },
  wren: { name: 'Wren', people: 'gnome', company: 'Greenvial (proposal)' },
}

mkdirSync(OUT, { recursive: true })
for (const f of readdirSync(OUT)) rmSync(join(OUT, f))

// ── per face: the skeleton over the art, then the frames with their bones ──
for (const id of ORDER) {
  const k = 4
  const im = img(W, 540)
  const art = face(id)
  const ov = skeletonOverlay(id, art, postPose(id, 'idle', 0), k)
  // the cell's empty margins cropped: the figure's columns 8..56
  const cx0 = 8, cw = 56 - 8
  grass(im, 34, POST_H * k, k)
  blit(im, ov, 20, 34, 1, cx0 * k, 0, cw * k, POST_H * k)
  blit(im, art, 20 + cw * k + 24, 34, k, cx0, 0, cw, POST_H)
  // the frames: the idle, two of the tic's keys, the reaction's key, each with its bones (3×)
  const keys: ['idle' | 'tic' | 'react', number][] = [['idle', 0], ['tic', 2], ['tic', Math.min(4, postFrames(id, 'tic') - 1)], ['react', 1]]
  keys.forEach(([a, f], i) => {
    const o = skeletonOverlay(id, face(id, a, f), postPose(id, a, f), 3)
    blit(im, o, 12 + i * 147, 34 + POST_H * k + 28, 1, 8 * 3, 4 * 3, 48 * 3, 56 * 3)
  })
  const p = skeletonOf(id).plan
  await save(`skeleton-${id}.png`, im, [
    [20, 24, `${WHO[id].name}: the skeleton, the 3D masses, then the pixels`, 15],
    [20 + (cw * k) / 2, 34 + POST_H * k + 20, 'bones + masses, 4×', 13, 'middle'],
    [20 + cw * k + 24 + (cw * k) / 2, 34 + POST_H * k + 20, 'the art, 4×', 13, 'middle'],
    [20, 532, `${p.height} px tall · head ${p.headH} · arm ${p.upperArm}+${p.forearm} · leg ${p.thigh}+${p.shin}${p.hock ? `+${p.hock}` : ''}   (idle, tic, tic, picked: 3×)`, 13],
  ])
  card({ id: `skeleton-${id}`, people: WHO[id].people, title: `${WHO[id].name} — skeleton first`, caption: 'Bones (near orange, far blue) and masses over the art, and across four frames: judge that joints sit where a body bends and every limb keeps its length.' })
}

// ── per face: beside the CC0 knight and pawn, at the same scale ──
for (const id of ORDER) {
  const im = img(W, 400)
  grass(im, 0, 300, 3)
  packAt(im, 'pawn', 6, 280, 3)
  packAt(im, 'knight', 186, 284, 3)
  faceAt(im, id, 500, 280, 3)
  grass(im, 300, 100, 1)
  packAt(im, 'pawn', 150, 384, 1)
  packAt(im, 'knight', 220, 388, 1)
  packAt(im, 'archer', 300, 389, 1)
  faceAt(im, id, 420, 384, 1)
  await save(`peers-${id}.png`, im, [[10, 22, `${WHO[id].name} beside the CC0 pawn and knight, 3× (1× below)`, 15]])
  card({ id: `peers-${id}`, people: WHO[id].people, title: `${WHO[id].name} beside the knight and pawn`, caption: 'The face and the CC0 pawn and knight at one scale, 3× and 1×: judge that they read as one set, not a finer or chunkier one.' })
}

// ── the line-up ──
{
  const im = img(W, 470)
  grass(im, 0, 110, 1)
  packAt(im, 'pawn', 0, 96, 1)
  packAt(im, 'knight', 50, 100, 1)
  packAt(im, 'archer', 126, 101, 1)
  ORDER.forEach((id, i) => faceAt(im, id, 222 + i * 52, 96, 1))
  packAt(im, 'torch', 492, 98, 1)
  grass(im, 112, 358, 2)
  ORDER.forEach((id, i) => faceAt(im, id, 62 + i * 118, 236, 2))
  packAt(im, 'pawn', 0, 450, 2)
  packAt(im, 'knight', 120, 456, 2)
  packAt(im, 'torch', 296, 452, 2)
  ORDER.forEach((id, i) => i < 2 && faceAt(im, id, 500 + i * 60, 440, 2))
  await save('lineup.png', im, [[8, 18, '1×: pawn, knight, archer · the five · goblin', 13], [8, 130, '2×', 13]])
  card({ id: 'lineup', people: 'all', title: 'The five beside the CC0 figures', caption: 'All five at the pack’s scale with the pawn, knight, archer and goblin, 1× and 2×: judge each people by its shape alone, and that they belong.' })
}

// ── the posts, as the game shows them ──
const POSTS: [string, string, PersonaId | null][] = [
  ['spice', 'Peppercorn Co.', 'saffra'],
  ['silk', 'Rosethread', 'odile'],
  ['metals', 'Ironvein', 'brannoch'],
  ['art', 'Easel House', null],
  ['scrolls', 'Moonquill', null],
]
if (SHOTS)
  for (const [co, name, id] of POSTS) {
    const file = join(SHOTS, `liaison-${co}-p390.png`)
    if (!existsSync(file)) continue
    const boxes = JSON.parse(readFileSync(join(SHOTS, 'boxes-p390.json'), 'utf8'))
    const [x, y, w, h] = boxes[`liaison-${co}`].scene as number[]
    const shot = await load(file)
    const dpr = shot.w / 390
    const im = img(W, Math.round(h * dpr) + 8)
    blit(im, shot, Math.round((W - w * dpr) / 2), 4, 1, Math.round(x * dpr), Math.round(y * dpr), Math.round(w * dpr), Math.round(h * dpr))
    await save(`post-${co}.png`, im)
    card({
      id: `post-${co}`,
      people: id ? WHO[id].people : 'human',
      title: `${name}’s post, in the game`,
      caption: id
        ? `The city page on a phone (the running app): judge that ${WHO[id].name} stands at the pack’s scale in front of a stall made of the pack’s own house, planks and stumps.`
        : 'The city page on a phone (the running app); its liaison is still the CC0 pawn: judge the stall alone.',
    })
  }
if (PROPOSALS)
  for (const [kind, id, name] of [['proposal-butcherblock', 'hask', 'Butcherblock'], ['proposal-greenvial', 'wren', 'Greenvial']] as const) {
    const file = join(PROPOSALS, `${kind}.png`)
    if (!existsSync(file)) continue
    const sc = await load(file)
    // what a phone sees of a city's band: the middle 194 × 98 of the scene, at the page's 2× (3× here for the card)
    const im = img(W, 98 * 3 + 8)
    blit(im, sc, (W - 194 * 3) / 2, 4, 3, 103, 36, 194, 98)
    await save(`post-${id}.png`, im)
    card({ id: `post-${id}`, people: WHO[id].people, title: `${name}’s post (proposal)`, caption: `The proposed post as a phone’s band crops it (baked, not yet in the game): judge ${WHO[id].name} in front of the stall, and the place.` })
  }

// ── the receipt's cameo: the post cropped round the speaker, as `LiaisonSays` does (52 × 52 at 1×) ──
{
  const im = img(W, 240)
  let i = 0
  for (const [co, , id] of POSTS) {
    const kind = `liaison-${co}` as keyof typeof SCENE_ANCHORS
    const sc = await load(join(ROOT, 'public/assets/scenes', `${kind}.png`))
    const [sx, sy] = SCENE_ANCHORS[kind].speaker
    blit(im, sc, 14 + i * 118, 40, 2, sx - 26, sy - 12, 52, 52)
    blit(im, sc, 14 + i * 118 + 30, 160, 1, sx - 26, sy - 12, 52, 52)
    void id
    void SCENE_SIZE
    i++
  }
  await save('receipt-faces.png', im, [[10, 26, 'The receipt’s face: each post cut round its speaker (2×; 1× below)', 14]])
  card({ id: 'receipt-faces', people: 'all', title: 'The receipt’s liaison faces', caption: 'Each post cut round its speaker as the receipt shows it: judge that every face is in its frame, not a counter or a sky.' })
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(cards, null, 2) + '\n')
console.log(`${cards.length} cards → ${OUT.replace(ROOT + '/', '')}`)
void POST_W
void postJoints2
