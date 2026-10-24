/**
 * rename-cards — the phone-board cards for the companies' rename (Oct 2026:
 * Easel House → Butcherblock, Moonquill → Greenvial).
 *
 *   npx vite --port 5291 --strictPort &
 *   node scripts/rename-shots.mjs <shots>
 *   npx tsx scripts/rename-cards.ts <shots> <before> [outDir]
 *
 * `<shots>` is `rename-shots.mjs`'s output; `<before>` holds the clan strips
 * as they were (`clans/<clan>_<strip>.png`), copied before the re-bake. Writes ~600 px PNGs and `manifest.json` into
 * outDir (default docs/ui-audit-2026-10/rename).
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp, { type OverlayOptions } from 'sharp'
import { COMPANY_LOGOS, companyById, type CompanyLogo } from '../src/game/data/companies'
import { companyStandardPalette, companyStandardRows, standardPaletteFor, standardRowsFor, DEFAULT_STANDARD } from '../src/game/data/companyStandard'

const [SHOTS, BEFORE, OUTARG] = process.argv.slice(2)
if (!SHOTS || !BEFORE) throw new Error('usage: rename-cards.ts <shots> <before> [outDir]')
const OUT = path.resolve(OUTARG ?? 'docs/ui-audit-2026-10/rename')
const PACK = path.resolve('public/assets/sprites/tinyswords')
fs.mkdirSync(OUT, { recursive: true })

const W = 600
const HEAD = 70
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
/** The card's chrome: the group, the title, and a line or two of caption at its foot. */
const chrome = (h: number, title: string, lines: string[]) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}"><rect width="100%" height="100%" fill="#16120e"/>
  <text x="18" y="24" fill="#e3b64f" font-family="sans-serif" font-weight="700" font-size="13" letter-spacing="1.5">RENAME</text>
  <text x="18" y="54" fill="#f2e8d8" font-family="Georgia, serif" font-weight="700" font-size="24">${esc(title)}</text>
  ${lines.map((l, i) => `<text x="18" y="${h - 16 - (lines.length - 1 - i) * 22}" fill="#b3a48c" font-family="sans-serif" font-size="16">${esc(l)}</text>`).join('')}</svg>`)
const label = (w: number, h: number, text: string, color = '#d9ccb4', size = 15) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="0" y="${h - 5}" fill="${color}" font-family="sans-serif" font-weight="700" font-size="${size}">${esc(text)}</text></svg>`)
const png = (b: Buffer) => sharp(b).png({ palette: true, colours: 256, dither: 0, compressionLevel: 9 }).toBuffer()

type Manifest = { id: string; group: string; people: string; title: string; caption: string; file: string }
const manifest: Manifest[] = []
async function card(id: string, people: string, title: string, caption: string, body: OverlayOptions[], bodyH: number, lines: string[]) {
  const foot = 18 + lines.length * 22
  const h = HEAD + bodyH + foot
  const out = await sharp(chrome(h, title, lines))
    .composite(body.map((o) => ({ ...o, top: (o.top ?? 0) + HEAD })))
    .png()
    .toBuffer()
  const file = `${id}.png`
  fs.writeFileSync(path.join(OUT, file), await png(out))
  manifest.push({ id, group: 'Rename', people, title, caption, file })
  console.log('wrote', file)
}

/** A screenshot fitted into the card's width (or a given width), pixels kept crisp when shrunk by a whole step. */
async function fit(file: string, w: number, crop?: { left: number; top: number; width: number; height: number }) {
  let img = sharp(file)
  if (crop) img = sharp(await img.extract(crop).toBuffer())
  const meta = await img.metadata()
  const buf = await img.resize({ width: w }).png().toBuffer()
  return { buf, h: Math.round((meta.height! * w) / meta.width!) }
}

/** Pixel rows blitted at `k` px a cell. */
function blit(rows: readonly string[], pal: Readonly<Record<string, string>>, k: number) {
  const w = rows[0].length
  const h = rows.length
  const d = Buffer.alloc(w * k * h * k * 4)
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      const c = pal[ch]
      if (!c) return
      const [R, G, B] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
      for (let j = 0; j < k; j++)
        for (let i = 0; i < k; i++) {
          const o = ((y * k + j) * w * k + (x * k + i)) * 4
          d[o] = R
          d[o + 1] = G
          d[o + 2] = B
          d[o + 3] = 255
        }
    }),
  )
  return sharp(d, { raw: { width: w * k, height: h * k, channels: 4 } }).png().toBuffer()
}

// The marks as they shipped before the rename (October 2026), for the strip.
const OLD: Record<'art' | 'scrolls', CompanyLogo & { color: string; name: string }> = {
  art: {
    name: 'Easel House',
    color: '#c6a4ff',
    rows: ['.......oo.......', '......owWo......', '.oooooooooooooo.', '.owwwwwwwwwwwwo.', '.owhhhhhhhyyhWo.', '.owhhhhhhyyyyWo.', '.owhhhhhhhyyhWo.', '.owhhhgggghhhWo.', '.owhhggggggghWo.', '.owgGGgggGGGgWo.', '.owWWWWWWWWWWWo.', '.oooooooooooooo.', '...owo.oo.owo...', '...owo.oo.owo...', '..owo..oo..owo..', '..ooo..oo..ooo..'],
    palette: { G: '#276740', W: '#866353', g: '#38b251', h: '#c6a4ff', o: '#161c2e', w: '#a38250', y: '#ffed44' },
  },
  scrolls: {
    name: 'Moonquill',
    color: '#e4e8f2',
    rows: ['..........ooooo.', '.....ooooolllddo', '...oommolollddo.', '..ommMollllddho.', '.ommMoollldhhho.', '.omMololldhhho..', 'omMoollldhhhho..', 'omMoollddhhoo...', 'omMoolldhhho....', 'omMooldhhho.....', '.omMooddhho.....', '.ommodhoo.......', '..ooodo.........', '...odo..........', '...odo..........', '....o...........'],
    palette: { M: '#d08c41', d: '#a9b0c4', h: '#e4e8f2', l: '#fffce7', m: '#ffed44', o: '#161c2e' },
  },
}

const S = (f: string) => path.join(SHOTS, f)

// ---- the homes, each focused
for (const [co, face] of [['art', 'Hask'], ['scrolls', 'Wren']] as const) {
  const name = companyById(co).name
  const phone = await fit(S(`home-${co}-phone.png`), 300)
  const desk = await fit(S(`home-${co}-desk.png`), 264)
  await card(
    `rename-home-${name.toLowerCase()}`,
    face,
    `${name} on the home`,
    `The home with ${name} focused, phone and desk: its road (${companyById(co).goods}), its cities, its mark, its world. Judge it reads as ${name}, not the old house.`,
    [
      { input: phone.buf, left: 18, top: 0 },
      { input: desk.buf, left: 318, top: 0 },
      { input: label(264, 22, 'desk, 1280 × 800'), left: 318, top: desk.h + 6 },
    ],
    phone.h,
    [`Phone 390 × 844 and desk 1280 × 800, ${name} focused.`, 'Judge: road, cities, mark and world all say the new company.'],
  )
}

// ---- the terms
for (const [co, face] of [['art', 'Hask'], ['scrolls', 'Wren']] as const) {
  const name = companyById(co).name
  const phone = await fit(S(`terms-${co}-phone.png`), 330)
  await card(
    `rename-terms-${name.toLowerCase()}`,
    face,
    `${name}'s terms`,
    `${name}'s terms page on a phone: the head, its asks, the three cities and its world's frames and CTA strip. Judge the words and the world.`,
    [{ input: phone.buf, left: (W - 330) / 2, top: 0 }],
    phone.h,
    [`${name}'s terms at 390 wide: the road, its asks, its cities.`, 'Judge the copy and the frames: quiet, one deep.'],
  )
}

// ---- the liaisons speaking (their words; the posts are a separate pass)
{
  const crops = []
  for (const co of ['art', 'scrolls'] as const) crops.push(await fit(S(`city-${co}-phone.png`), W - 36, { left: 0, top: 0, width: 780, height: 390 }))
  const y2 = crops[0].h + 12
  await card(
    'rename-liaisons',
    'Hask, Wren',
    'Hask and Wren speak',
    'Each slot\u2019s first city on a phone with its liaison\u2019s new line: Hask the salter, Wren the herbalist. The posts behind them are still the old houses\u2019 (a separate pass); judge the words.',
    [
      { input: crops[0].buf, left: 18, top: 0 },
      { input: crops[1].buf, left: 18, top: y2 },
    ],
    y2 + crops[1].h,
    ['The first cities on a phone: the new words over the old posts.', 'Judge the voice: Hask dry and menacing, Wren quiet and ominous.'],
  )
}

// ---- the crests, before → after
{
  const k = 6
  const parts: OverlayOptions[] = []
  let y = 0
  for (const co of ['art', 'scrolls'] as const) {
    const old = OLD[co]
    const now = COMPANY_LOGOS[co]
    const c = companyById(co)
    parts.push({ input: label(560, 24, `${old.name} → ${c.name}`, '#f2e8d8', 17), left: 18, top: y })
    y += 30
    parts.push({ input: await blit(old.rows, old.palette, k), left: 18, top: y })
    parts.push({ input: await blit(standardRowsFor(old, DEFAULT_STANDARD), standardPaletteFor(old, old.color, DEFAULT_STANDARD), 3), left: 130, top: y + 6 })
    parts.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="96"><text x="10" y="58" fill="#e3b64f" font-family="sans-serif" font-size="34">→</text></svg>`), left: 218, top: y })
    parts.push({ input: await blit(now.rows, now.palette, k), left: 290, top: y })
    parts.push({ input: await blit(companyStandardRows(co), companyStandardPalette(co), 3), left: 402, top: y + 6 })
    parts.push({ input: await blit(now.rows, now.palette, 2), left: 500, top: y + 30 })
    parts.push({ input: await blit(now.rows, now.palette, 1), left: 548, top: y + 38 })
    y += 16 * k + 22
  }
  await card(
    'rename-crests',
    'Butcherblock, Greenvial',
    'The crests, before → after',
    'The old marks and standards (an easel, a quill on a moon) beside the new: Butcherblock’s haunch on the bone, Greenvial’s sprouting flask, at 6×, on the standard, at 2× and 1×.',
    parts,
    y,
    ['Old mark and standard → new mark, standard, 2× and 1×.', 'Judge: meat and a potion at a glance, in the pack’s pixel language.'],
  )
}

// ---- the goblin clans, before → after (frame 0 of each line's tier 3, and the Codex)
{
  const parts: OverlayOptions[] = []
  let y = 0
  const strips = [
    ['torch3_walk', 115 + 0],
    ['tnt3_walk', 90],
    ['barrel3', 64],
  ] as const
  for (const [clan, oldName, newName] of [
    ['smudge', 'Smudge Gang', 'Gnawbone Pack'],
    ['hexmoon', 'Hexmoon Coven', 'Sporecap Rot'],
  ] as const) {
    parts.push({ input: label(560, 24, `${oldName} → ${newName}`, '#f2e8d8', 17), left: 18, top: y })
    y += 30
    let x = 18
    for (const when of ['before', 'after'] as const) {
      for (const [strip] of strips) {
        const file = when === 'before' ? path.join(BEFORE, 'clans', `${clan}_${strip}.png`) : path.join(PACK, `${clan}_${strip}.png`)
        const meta = await sharp(file).metadata()
        const fw = strip.startsWith('torch') ? 115 : strip.startsWith('tnt') ? 90 : meta.width!
        const fr = await sharp(file).extract({ left: 0, top: 0, width: Math.min(fw, meta.width!), height: meta.height! }).png().toBuffer().then((b) => sharp(b).trim().toBuffer())
        const m2 = await sharp(fr).metadata()
        const z = 1
        const buf = await sharp(fr).resize(Math.round(m2.width! * z), null, { kernel: 'nearest' }).png().toBuffer()
        parts.push({ input: buf, left: x, top: y + Math.max(0, 100 - Math.round(m2.height! * z)) })
        x += Math.round(m2.width! * z) + 6
      }
      if (when === 'before') {
        parts.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="80"><text x="6" y="50" fill="#e3b64f" font-family="sans-serif" font-size="28">→</text></svg>`), left: x, top: y })
        x += 40
      }
    }
    y += 112
  }
  const codex = await fit(S('codex-gnawbone-phone.png'), 270, { left: 0, top: 1250, width: 780, height: 250 })
  const codex2 = await fit(S('codex-sporecap-phone.png'), 270, { left: 0, top: 1005, width: 780, height: 250 })
  parts.push({ input: label(560, 22, 'In the Codex (phone):'), left: 18, top: y })
  parts.push({ input: codex.buf, left: 18, top: y + 28 })
  parts.push({ input: codex2.buf, left: 312, top: y + 28 })
  y += 28 + codex.h
  await card(
    'rename-clans',
    'Gnawbone Pack, Sporecap Rot',
    'The goblin clans, before → after',
    'The two clans re-dressed (a look and a name only): tier 3 of each line, paint and moon before, skulls and hooks / caps and rot after, and their Codex sections.',
    parts,
    y,
    ['Tier 3 torch, bomber, keg: before → after; then the Codex.', 'Judge: each reads as its road’s raiders; nothing else changed.'],
  )
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n')
console.log(`${manifest.length} cards → ${OUT}`)
