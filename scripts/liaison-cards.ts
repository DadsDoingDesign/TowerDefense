/**
 * liaison-cards — the review cards of the liaisons pass (Oct 2026): the five
 * approved finals put in the game. Two phone cards, 600 px wide, from shots
 * of the RUNNING app (taken before and after with the same seeded flows):
 *
 *   - posts-before-after.png: each company's post heading its first city at
 *     390 px (`scripts/places-shots.mjs`), before | after, and the receipt's
 *     five cameos as baked;
 *   - dock-before-after.png: the home dock at 390 px (`scripts/dock-shots.mjs`):
 *     before, option (b) the full final at 1× (a mock), and option (a) the
 *     hand-drawn small versions as shipped, then its frames at 3×.
 *
 *   SHOTS_DPR=2 node scripts/places-shots.mjs <before>/places p390   (on the old build)
 *   node scripts/dock-shots.mjs <before>/dock before                  (on the old build)
 *   node scripts/dock-shots.mjs <after>/dock optb --full
 *   SHOTS_DPR=2 node scripts/places-shots.mjs <after>/places p390
 *   node scripts/dock-shots.mjs <after>/dock after
 *   npx tsx scripts/liaison-cards.ts <before> <after>
 */
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { MINI_FACES, MINI_H, MINI_W, miniFrame, miniFrames } from '../src/game/render/hero/mini'
import type { PersonaId } from '../src/game/render/hero/rig'
import { SCENE_ANCHORS } from '../src/ui/shell/stopScenes.generated'

const [BEFORE, AFTER] = process.argv.slice(2).map((p) => resolve(p))
const OUT = join(resolve(import.meta.dirname, '..'), 'docs', 'characters', 'cards', 'liaisons')
mkdirSync(OUT, { recursive: true })
const W = 600
const BG = '#1a1f2b'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const text = (s: string, x: number, y: number, size = 15, fill = '#e8e2d2', weight = 600) =>
  `<text x="${x}" y="${y}" fill="${fill}" font-family="sans-serif" font-weight="${weight}" font-size="${size}">${esc(s)}</text>`
type Layer = { input: Buffer; left: number; top: number }
async function card(file: string, h: number, layers: Layer[], svg: string) {
  await sharp({ create: { width: W, height: h, channels: 4, background: BG } })
    .composite([...layers, { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}">${svg}</svg>`), left: 0, top: 0 }])
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, file))
  console.log('  wrote', join('docs/characters/cards/liaisons', file))
}
/** The top of a 2× phone shot (the city's scene band), scaled to `w`. */
const band = async (f: string, w: number) => sharp(f).extract({ left: 0, top: 0, width: 780, height: 392 }).resize(w, Math.round((392 * w) / 780), { kernel: 'lanczos3' }).png().toBuffer()

// ---- the posts
{
  const COS = [['spice', 'Peppercorn Co. · Saffra'], ['art', 'Butcherblock · Hask (was Easel House’s tent)'], ['metals', 'Ironvein · Brannoch'], ['silk', 'Rosethread · Odile'], ['scrolls', 'Greenvial · Wren (was Moonquill’s scriptorium)']]
  const half = (W - 36) / 2
  const rowH = Math.round((392 * half) / 780)
  const layers: Layer[] = []
  let svg = text('Liaison posts · before | after', 14, 30, 21, '#ffffff', 700) + text('A city’s head at 390 px, the running app. Left: today. Right: the approved finals.', 14, 52, 13, '#c9cbbf', 400)
  let y = 70
  for (const [co, name] of COS) {
    svg += text(name, 14, y + 14, 14, '#ffe46b')
    y += 22
    layers.push({ input: await band(join(BEFORE, 'places', `liaison-${co}-p390.png`), half), left: 12, top: y })
    layers.push({ input: await band(join(AFTER, 'places', `liaison-${co}-p390.png`), half), left: 24 + half, top: y })
    y += rowH + 12
  }
  // the receipt's cameos, as baked (52 px at 1×, shown at 2×)
  svg += text('The receipt’s cameo of each, cut from its post (2×)', 14, y + 14, 14, '#ffe46b')
  y += 24
  for (const [i, [co]] of COS.entries()) {
    const a = SCENE_ANCHORS[`liaison-${co}` as keyof typeof SCENE_ANCHORS] as unknown as { cameo: readonly number[] }
    const img = await sharp(`public/assets/scenes/liaison-${co}.png`).extract({ left: a.cameo[0], top: a.cameo[1], width: 52, height: 52 }).resize(104, 104, { kernel: 'nearest' }).png().toBuffer()
    layers.push({ input: img, left: 12 + i * 116, top: y })
  }
  y += 116
  await card('posts-before-after.png', y, layers, svg)
}

// ---- the dock
{
  const strip = async (f: string) => {
    const m = await sharp(f).metadata()
    return sharp(f).resize(W - 24, Math.round((m.height! * (W - 24)) / m.width!), { kernel: 'lanczos3' }).png().toBuffer()
  }
  const layers: Layer[] = []
  let svg = text('Home dock · before | options', 14, 30, 21, '#ffffff', 700) + text('390 px, the running app, reduced motion (each face its still); Greenvial still locked.', 14, 52, 13, '#c9cbbf', 400)
  let y = 66
  for (const [f, label] of [
    [join(BEFORE, 'dock', 'dock-before-p390-strip.png'), 'Before: the older dock figures'],
    [join(AFTER, 'dock', 'dock-optb-full-p390-strip.png'), 'Option (b), a mock: each full final at 1× (overflows the slot, half the UI’s pixel scale)'],
    [join(AFTER, 'dock', 'dock-after-p390-strip.png'), 'Option (a), shipped: a hand-drawn small version of each final, at 2×'],
  ] as const) {
    svg += text(label, 14, y + 14, 13.5, '#ffe46b')
    y += 22
    const b = await strip(f)
    const m = await sharp(b).metadata()
    layers.push({ input: b, left: 12, top: y })
    y += m.height! + 12
  }
  // every frame of (a), 4×: idle, tic, react, locked
  svg += text('(a) frame by frame at 3×: idle, tic, reaction (the first frames of each row)', 14, y + 14, 13.5, '#ffe46b')
  y += 24
  const S = 3
  for (const id of Object.keys(MINI_FACES) as PersonaId[]) {
    let x = 12
    const frames: ['idle' | 'tic' | 'react', number, boolean][] = []
    for (const a of ['idle', 'tic', 'react'] as const) for (let f = 0; f < miniFrames(id, a); f++) frames.push([a, f, false])
    frames.push(['idle', 0, true])
    // an idle that repeats its loop shows once
    const seen = new Set<string>()
    for (const [a, f, locked] of frames) {
      const fr = miniFrame(id, a, f, locked)
      const key = Buffer.from(fr.rgba).toString('base64') + a
      if (seen.has(key)) continue
      seen.add(key)
      if (x + MINI_W * S > W - 12) break
      const img = await sharp(Buffer.from(fr.rgba), { raw: { width: MINI_W, height: MINI_H, channels: 4 } }).resize(MINI_W * S, MINI_H * S, { kernel: 'nearest' }).png().toBuffer()
      layers.push({ input: await sharp({ create: { width: MINI_W * S, height: MINI_H * S, channels: 4, background: '#2c3a4a' } }).composite([{ input: img, left: 0, top: 0 }]).png().toBuffer(), left: x, top: y })
      x += MINI_W * S + 2
    }
    y += MINI_H * S + 6
  }
  await card('dock-before-after.png', y + 6, layers, svg)
}
