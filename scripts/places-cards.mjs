/**
 * places-cards — the phone review cards for the PLACES asset critique (Oct
 * 2026, `docs/ui-audit-2026-10/asset-critique/places/`): one ~600 px card a
 * place, BEFORE over AFTER as the app draws it on a 390 phone, a 2× crop of the
 * scene, the scores before → after; and the two proposal posts.
 *
 *   SHOTS_DPR=1.5 node scripts/places-shots.mjs <before> p390   # on the old art
 *   SHOTS_DPR=1.5 node scripts/places-shots.mjs <after> p390    # on the new
 *   (the proposals were baked by `stop-scenes.ts --proposals`, gone since the
 *   two posts shipped in the liaisons pass: keep the round's <proposals> dir)
 *   node scripts/places-cards.mjs <before> <after> <proposals> [outDir]
 *
 * The cameo card also reads the old posts from `<before>/scenes/` (copied out
 * of git from the revision before the change).
 *
 * Writes `<outDir>/<id>.png` (palette-compressed) and `manifest.json`
 * (`[{ id, group, people, title, caption, file }]`). The scores are the
 * scorecard's (`SCORECARD.md`), round 0 → round 3.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('sharp')
const [BEFORE, AFTER, PROPOSALS] = process.argv.slice(2, 5).map((p) => path.resolve(p))
const OUT = path.resolve(process.argv[5] ?? 'docs/ui-audit-2026-10/asset-critique/places/cards')
const ROOT = path.resolve(import.meta.dirname, '..')
const SCENES = path.join(ROOT, 'public/assets/scenes')
const DPR = 1.5
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright'))

const boxes = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'boxes-p390.json'), 'utf8'))
const B0 = boxes(BEFORE)
const B1 = boxes(AFTER)
const url = (f) => 'file://' + f

/** The scene's band of a phone shot, at the shot's pixels. */
const band = (dir, bx, shot) => {
  const s = bx[shot].scene
  return { src: url(path.join(dir, `${shot}-p390.png`)), x: s[0] * DPR, y: s[1] * DPR, w: s[2] * DPR, h: s[3] * DPR }
}
const img = ({ src, x, y, w, h }) => `<div class="im" style="width:${w}px;height:${h}px;background:url('${src}') ${-x}px ${-y}px / auto no-repeat"></div>`
/** A region of a baked scene (art pixels), drawn at k× crisp. */
const art = (file, x, y, w, h, k = 2) =>
  `<div class="im px" style="width:${w * k}px;height:${h * k}px;background:url('${url(file)}') ${-x * k}px ${-y * k}px / ${400 * k}px ${150 * k}px no-repeat"></div>`

const S = (a, b, j) => ({ a, b, j })
/** Every card: its scores round 0 → round 3 (the scorecard's), what changed, the caption. */
const CARDS = [
  { id: 'places-merchant', title: 'The merchant’s stall', people: '', shot: 'merchant', scene: 'merchant', crop: [40, 40, 280, 110], from: S(3, 3, 3), to: S(4, 4, 4), what: 'A kit stall on trodden earth: a rack of blades, a helm, a shield; the ware in the raised hands; the counter in view on a phone.', caption: 'The merchant’s stall: does it read as a road trader selling arms, with the ware held up?' },
  { id: 'places-campfire', title: 'The campfire', people: '', shot: 'campfire', scene: 'campfire', crop: [30, 30, 280, 120], from: S(3, 4, 4), to: S(4, 4, 4), what: 'The fire stands on a stone hearth; the pot hangs on a spit; the tent, the bedroll and the clearing are no longer hidden or square.', caption: 'The campfire: is the hearth a place you would sit, with nothing hidden behind people?' },
  { id: 'places-shrine', title: 'The shrine', people: '', shot: 'shrine', scene: 'shrine', crop: [50, 30, 270, 120], from: S(4, 4, 4), to: S(5, 4, 4), what: 'Worn flagstones and stepping stones under the stones; the keeper steps off the altar; the meadow’s repeat broken by patches.', caption: 'The shrine: do the stones sit on worn ground now, the keeper beside them?' },
  { id: 'places-hiring-yard', title: 'A city’s hiring yard', people: '', shot: 'recruit', scene: 'recruit', crop: [40, 30, 280, 120], from: S(3, 4, 2), to: S(4, 4, 4), what: 'A drill yard: a rack of arms, a straw man, a hire at practice. The bubble hangs beside the sergeant’s face, inside the scene. The flag went: the sign is the pennant.', caption: 'The hiring yard: does it read as a drill yard, and does the sergeant’s line stay inside the scene?' },
  { id: 'places-post-spice', title: 'Peppercorn’s post', people: 'Peppercorn Co.', shot: 'liaison-spice', scene: 'liaison-spice', crop: [40, 30, 280, 120], from: S(3, 4, 3), to: S(4, 5, 4), what: 'The stall at the edge of its chili fields, a strip where the burn ran, the brazier and the standard in view on a phone.', caption: 'Peppercorn’s post: farmland and spice that burns, at a glance?' },
  { id: 'places-post-metals', title: 'Ironvein’s post', people: 'Ironvein', shot: 'liaison-metals', scene: 'liaison-metals', crop: [40, 30, 280, 120], from: S(3, 3, 3), to: S(4, 5, 4), what: 'At the foot of its quarry: the cut cliff, a timbered adit, a cart of ore on its rails, a forge for the glow. The knights’ tower went.', caption: 'Ironvein’s post: a mountain quarry and a forge, at a glance?' },
  { id: 'places-post-silk', title: 'Rosethread’s post', people: 'Rosethread', shot: 'liaison-silk', scene: 'liaison-silk', crop: [40, 30, 280, 120], from: S(3, 3, 3), to: S(4, 4, 4), what: 'By the ford: the river behind with its stones, reeds on the bank, a loom. The sheep (wool, not silk) went.', caption: 'Rosethread’s post: a river forest and a loom, at a glance?' },
  { id: 'places-post-art', title: 'Easel House’s post (as is)', people: 'Butcherblock', shot: 'liaison-art', scene: 'liaison-art', crop: [40, 30, 280, 120], from: S(3, 2, 3), to: S(4, 2, 4), what: 'Ground, shadows and the standard fixed; the post is still Easel House’s gallery. Its slot becomes Butcherblock’s: see the proposal.', caption: 'The art slot’s post as shipped: tidied, but still a painter’s; the smokehouse proposal is its own card.' },
  { id: 'places-post-scrolls', title: 'Moonquill’s post (as is)', people: 'Greenvial', shot: 'liaison-scrolls', scene: 'liaison-scrolls', crop: [40, 30, 280, 120], from: S(4, 2, 3), to: S(4, 2, 4), what: 'The standard in view and the rack grounded; still Moonquill’s scriptorium. Its slot becomes Greenvial’s: see the proposal.', caption: 'The scrolls slot’s post as shipped: tidied, but still a scriptorium; the glasshouse proposal is its own card.' },
  { id: 'places-signs', title: 'The place signs', people: '', kind: 'signs', from: S(4, 3, 4), to: S(4, 4, 4), what: 'The shop’s sign is the city’s sign now: one wood from the sign tokens, so a company theme reaches it. Fire, stone and pennant stay their own materials.', caption: 'The signs: one wooden sign for shop and city, three materials for fire, shrine and yard?' },
  { id: 'places-bubble', title: 'The speech bubble', people: '', kind: 'bubble', from: S(4, 4, 2), to: S(4, 4, 4), what: 'Anchors point at faces, not plume tips; a tall speaker is marked in the bake, so the bubble hangs beside the face and never runs off the scene.', caption: 'The keeper’s bubble: three lines of the sergeant’s, inside the scene and clear of the sign?' },
  { id: 'places-shopfront', title: 'The shop front', people: '', kind: 'shop', from: S(4, 4, 3), to: S(4, 4, 4), what: 'An out-of-stock service reads on its paper tag (it was cream on cream); the shelf’s and the counter’s washes are tokens, so themes reach them.', caption: 'The shelf and counter: can you read “Cargo is whole” now?' },
  { id: 'places-cameo', title: 'The receipt cameo', people: '', kind: 'cameo', from: S(3, 3, 3), to: S(3, 4, 3), what: 'The face is cut from the post, so the land behind it is the company’s now (quarry stone, chili rows, the ford). The face itself waits on the new character rig.', caption: 'The receipt’s liaison cameo: the land behind each face; the faces are the character agent’s.' },
  { id: 'places-proposal-butcherblock', title: 'Proposal: Butcherblock’s smokehouse', people: 'Butcherblock', kind: 'proposal', scene: 'proposal-butcherblock', current: 'liaison-art', from: S(3, 2, 3), to: S(4, 4, 4), what: 'Not shipped. Salt marsh: a reed channel and its jetty, a plank smokehouse breathing smoke, meat on hooks, salt sacks, a butcher’s block for a counter.', caption: 'Proposal, not shipped: is this Butcherblock’s salt-marsh smokehouse? The dashed boxes are the sign and the bubble.' },
  { id: 'places-proposal-greenvial', title: 'Proposal: Greenvial’s glasshouse', people: 'Greenvial', kind: 'proposal', scene: 'proposal-greenvial', current: 'liaison-scrolls', from: S(4, 2, 3), to: S(4, 5, 4), what: 'Not shipped. A hidden garden at dusk: a glasshouse, vines up the posts, potions on the counter, mushrooms in the hollow, spores glowing.', caption: 'Proposal, not shipped: is this Greenvial’s glasshouse garden? The dashed boxes are the sign and the bubble.' },
]

const FONT = (w) => `@font-face{font-family:Crimson;font-weight:${w};src:url('${url(path.join(ROOT, `src/assets/fonts/crimson-text-${w}.woff2`))}')}`
const css = `${FONT(600)}${FONT(700)}
body{margin:0;background:#120c08}
.card{width:600px;box-sizing:border-box;padding:18px 7px 16px;background:#201711;color:#f3e7d0;font:14px/1.35 system-ui,sans-serif}
.hd{padding:0 9px}
h1{margin:0;font:700 28px/1.1 Crimson,serif}
.who{margin:2px 0 0;color:#b89e7e;font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:700}
.sc{display:flex;gap:6px;margin:10px 0 4px}
.chip{padding:4px 9px;border-radius:4px;background:#3a2c1c;font-weight:700;font-size:13px}
.chip b{color:#e0ac4c}
.what{margin:8px 0 0;color:#e8d9bd}
.lab{margin:14px 9px 5px;color:#b89e7e;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;font-weight:800}
.lab.after{color:#6fce88}
.im{margin:0 auto;border:1px solid #46331f}
.px{image-rendering:pixelated}
.row{display:flex;gap:8px;justify-content:center;align-items:flex-start}
.mock{position:relative;margin:0 auto}
.box{position:absolute;border:2px dashed #f3e7d0;border-radius:4px;color:#f3e7d0;font-weight:800;font-size:12px;letter-spacing:.1em;text-transform:uppercase;display:grid;place-items:center;background:rgba(32,23,17,.35)}
.note{margin:4px 9px 0;color:#8a7458;font-size:12px;font-style:italic}`

const scores = (c) =>
  `<div class="sc">${[['Aesthetics', 'a'], ['Brand', 'b'], ['Job', 'j']].map(([n, k]) => `<span class="chip">${n} ${c.from[k]} → <b>${c.to[k]}</b></span>`).join('')}</div>`

function body(c) {
  if (c.kind === 'signs') {
    const sign = (dir, bx, shot) => {
      const s = bx[shot].sign
      return img({ src: url(path.join(dir, `${shot}-p390.png`)), x: (s[0] - 8) * DPR, y: (s[1] - 8) * DPR, w: (s[2] + 16) * DPR, h: (s[3] + 16) * DPR })
    }
    const row = (dir, bx) => `<div class="row">${['merchant', 'liaison-metals'].map((s) => sign(dir, bx, s)).join('')}</div><div class="row" style="margin-top:8px">${['campfire', 'shrine', 'recruit'].map((s) => sign(dir, bx, s)).join('')}</div>`
    return `<p class="lab">Before · the shop and a city, then the fire, the shrine, the yard</p>${row(BEFORE, B0)}<p class="lab after">After</p>${row(AFTER, B1)}`
  }
  if (c.kind === 'bubble')
    return `<p class="lab">Before · the hiring yard, a three-line line</p>${img(band(BEFORE, B0, 'recruit'))}<p class="lab after">After</p>${img(band(AFTER, B1, 'recruit'))}<p class="lab">After · a liaison’s, with who speaks</p>${img(band(AFTER, B1, 'liaison-silk'))}`
  if (c.kind === 'shop') {
    const shelf = (dir) => img({ src: url(path.join(dir, 'merchant-p390.png')), x: 0, y: 250 * DPR, w: 390 * DPR, h: 205 * DPR })
    return `<p class="lab">Before · the shelf and the counter</p>${shelf(BEFORE)}<p class="lab after">After</p>${shelf(AFTER)}`
  }
  if (c.kind === 'cameo') {
    const faces = (dir) =>
      `<div class="row">${['spice', 'art', 'metals', 'silk', 'scrolls'].map((co) => art(path.join(dir, `liaison-${co}.png`), 154, 59, 52, 52, 2)).join('')}</div>`
    return `<p class="lab">Before · 2×, as the receipt cuts them (52 px)</p>${faces(path.join(BEFORE, 'scenes'))}<p class="lab after">After</p>${faces(SCENES)}<p class="note">Peppercorn · Easel House · Ironvein · Rosethread · Moonquill</p>`
  }
  if (c.kind === 'proposal') {
    // The phone’s window on a liaison’s post (art x 102–298 of the 400, rows 36–134) at the
    // phone's 3 device pixels, with the sign's and the bubble's room marked.
    const k = 3
    const win = art(path.join(PROPOSALS, `${c.scene}.png`), 102, 36, 196, 98, k)
    const mock = `<div class="mock" style="width:${196 * k}px;height:${98 * k}px">${win}<span class="box" style="left:${(16 / 2) * k}px;top:${(14 / 2) * k}px;width:${(130 / 2) * k}px;height:${(38 / 2) * k}px">Sign</span><span class="box" style="left:${(173 / 2) * k}px;top:${(17 / 2) * k}px;width:${(196 / 2) * k}px;height:${(75 / 2) * k}px">Bubble</span></div>`
    return `<p class="lab">Now · the slot’s post as it ships</p>${img(band(AFTER, B1, c.current))}<p class="lab after">Proposed · at a phone’s width, not shipped</p>${mock}<p class="lab">2× crop</p>${art(path.join(PROPOSALS, `${c.scene}.png`), 40, 30, 280, 120, 2)}`
  }
  const [x, y, w, h] = c.crop
  return `<p class="lab">Before · on a 390 phone</p>${img(band(BEFORE, B0, c.shot))}<p class="lab after">After</p>${img(band(AFTER, B1, c.shot))}<p class="lab">After · 2× crop of the scene</p>${art(path.join(SCENES, `${c.scene}.png`), x, y, w, h, 2)}`
}

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})
const page = await browser.newPage({ viewport: { width: 600, height: 800 }, deviceScaleFactor: 1 })
const manifest = []
for (const c of CARDS) {
  const html = `<!doctype html><meta charset="utf-8"><style>${css}</style><div class="card"><div class="hd"><h1>${c.title}</h1>${c.people ? `<p class="who">${c.people}</p>` : ''}${scores(c)}<p class="what">${c.what}</p></div>${body(c)}</div>`
  const file = path.join(OUT, `.${c.id}.html`)
  fs.writeFileSync(file, html)
  await page.goto(url(file))
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(150)
  const raw = await page.locator('.card').screenshot()
  fs.rmSync(file)
  await sharp(raw).png({ palette: true, colours: 256, compressionLevel: 9 }).toFile(path.join(OUT, `${c.id}.png`))
  manifest.push({ id: c.id, group: 'Places', people: c.people, title: c.title, caption: c.caption, file: `${c.id}.png` })
  console.log(`  card ${c.id}`)
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
await browser.close()
