/**
 * motion-cards — before/after review cards of the company worlds' motion, for
 * the designer's phone (Oct 2026, the calm pass:
 * `docs/ui-audit-2026-10/motion-calm/`).
 *
 *   node scripts/motion-cards.mjs <before audit dir> <after audit dir> <out dir>
 *
 * Reads two runs of `scripts/motion-audit.mjs` (with `AUDIT_CARDS=1`, phone):
 * for each company, its `card-home-<id>` capture (the switch-in, the ambient,
 * a press, 3.5 s) and its `battle-<id>` capture (3.5 s mid-wave), and writes
 * one looped animated WebP per company per screen: BEFORE on top, AFTER below,
 * each a 1:1 crop of the phone (crisp pixels), labelled, with the measured
 * numbers in its header; plus `manifest.json`
 * (`{ id, group: "Effects", people, title, caption, file }`).
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const [BEFORE, AFTER, OUT] = process.argv.slice(2).map((p) => path.resolve(p))
if (!OUT) {
  console.error('usage: node scripts/motion-cards.mjs <before dir> <after dir> <out dir>')
  process.exit(1)
}
fs.mkdirSync(OUT, { recursive: true })

const W = 600
const FPS = 12
const SECS = 3.5
const NAMES = { spice: 'Peppercorn Co.', art: 'Butcherblock', metals: 'Ironvein', silk: 'Rosethread', scrolls: 'Greenvial' }
/** What changed, one line per company and screen (the caption). */
const CAPTIONS = {
  home: {
    spice: 'A quarter of the embers, one pixel and slow; a low flame line; frames and crest still',
    art: 'Small splats and flecks in place of big blobs; faint washes; frames still',
    metals: 'A third of the sparks in low slow arcs; the anvils glow, never flash; frames still',
    silk: 'Two in five petals, falling at half speed; fainter, slower ribbons; frames still',
    scrolls: 'Fewer, slower stars and runes; a still, fainter beam; frames still',
  },
  battle: {
    spice: 'Dust, fluff and leaves at under half the count and two thirds the strength',
    art: 'Petals at under half the count, slower; the road and slots clearer',
    metals: 'Rain at 40%, a narrower, fainter sheet at the edges; fainter clouds; a rarer flash',
    silk: 'Fog half as thick in four banks; dew at under half the count',
    scrolls: 'Snow at under half the count; a narrower, fainter sheet at the edges',
  },
}
const SHOTS = {
  home: { capture: (id) => `card-home-${id}`, metric: (id) => `home-${id}`, crop: { left: 0, top: 300, width: 390, height: 544 } },
  battle: { capture: (id) => `battle-${id}`, metric: (id) => `battle-${id}`, crop: null },
}

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const metricsB = readJson(path.join(BEFORE, 'metrics.json'))
const metricsA = readJson(path.join(AFTER, 'metrics.json'))

function frameList(dir, name) {
  const d = path.join(dir, 'frames', name)
  const meta = readJson(path.join(d, 'meta.json'))
  const files = fs.readdirSync(d).filter((f) => f.endsWith('.png')).sort()
  return { files: files.map((f) => path.join(d, f)), times: meta.times.map((t) => t / 1000 - meta.times[0] / 1000), regions: meta.regions }
}
const nearest = (times, t) => {
  let best = 0
  for (let i = 1; i < times.length; i++) if (Math.abs(times[i] - t) < Math.abs(times[best] - t)) best = i
  return best
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

function numbers(kind, id) {
  const b = metricsB[SHOTS[kind].metric(id)] ?? {}
  const a = metricsA[SHOTS[kind].metric(id)] ?? {}
  const parts = []
  if (kind === 'home' && b.particles != null) parts.push(`particles ${b.particles} → ${a.particles}`)
  if (kind === 'battle' && b.live?.weather) parts.push(`weather ${b.live.weather.w} → ${a.live?.weather?.w ?? '?'} · edge ${b.live.weather.e} → ${a.live?.weather?.e ?? '?'}`)
  if (b.movPct != null) parts.push(`moving ${b.movPct}% → ${a.movPct}%`)
  if (b.contrast) parts.push(`peak ΔY ${b.contrast.peak} → ${a.contrast?.peak}`)
  return parts.join(' · ')
}

const manifest = []
for (const kind of ['home', 'battle']) {
  for (const id of Object.keys(NAMES)) {
    const name = SHOTS[kind].capture(id)
    let fb
    let fa
    try {
      fb = frameList(BEFORE, name)
      fa = frameList(AFTER, name)
    } catch (e) {
      console.log(`skip ${name}: ${e.message}`)
      continue
    }
    const stage = fb.regions.stage?.[0]
    const crop = SHOTS[kind].crop ?? { left: 0, top: Math.max(0, Math.round(stage?.[1] ?? 49)), width: 390, height: Math.round(stage?.[3] ?? 600) }
    const HEAD = 64
    const LABEL = 30
    const H = HEAD + 2 * (LABEL + crop.height) + 8
    const x0 = Math.round((W - crop.width) / 2)
    const yB = HEAD + LABEL
    const yA = HEAD + LABEL + crop.height + 8 + LABEL
    const title = `${NAMES[id]} · ${kind === 'home' ? 'Home' : 'Battle'}`
    const chrome = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <rect width="${W}" height="${H}" fill="#16120e"/>
      <text x="16" y="28" font-family="Inter" font-weight="700" font-size="20" fill="#f3e7cf">${esc(title)}</text>
      <text x="16" y="50" font-family="Inter" font-size="13" fill="#b9ab90">${esc(numbers(kind, id))}</text>
      <text x="${x0}" y="${HEAD + 21}" font-family="Inter" font-weight="700" font-size="14" letter-spacing="1.5" fill="#9a8c74">BEFORE</text>
      <text x="${x0}" y="${HEAD + LABEL + crop.height + 8 + 21}" font-family="Inter" font-weight="700" font-size="14" letter-spacing="1.5" fill="#e8c46a">AFTER · CALM PASS</text>
    </svg>`)
    const base = await sharp(chrome).png().toBuffer()
    const n = Math.round(SECS * FPS)
    const frames = []
    for (let i = 0; i < n; i++) {
      const t = i / FPS
      const [b, a] = await Promise.all(
        [
          [fb, nearest(fb.times, t)],
          [fa, nearest(fa.times, t)],
        ].map(([f, k]) => sharp(f.files[k]).extract(crop).png().toBuffer()),
      )
      frames.push(
        await sharp(base)
          .composite([
            { input: b, left: x0, top: yB },
            { input: a, left: x0, top: yA },
          ])
          .png()
          .toBuffer(),
      )
    }
    const file = `${kind}-${id}.webp`
    // Under ~1.5 MB a card: the quality steps down until it fits.
    let kb = Infinity
    for (const quality of [72, 62, 52, 44, 36]) {
      await sharp(frames, { join: { animated: true } })
        .webp({ quality, effort: 6, loop: 0, delay: Array(n).fill(Math.round(1000 / FPS)), smartSubsample: true })
        .toFile(path.join(OUT, file))
      kb = Math.round(fs.statSync(path.join(OUT, file)).size / 1024)
      if (kb <= 1400) break
    }
    console.log(`${file}: ${W}×${H}, ${n} frames, ${kb} KB`)
    manifest.push({ id: `${kind}-${id}`, group: 'Effects', people: NAMES[id], title, caption: CAPTIONS[kind][id], file })
  }
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`manifest: ${manifest.length} cards`)
