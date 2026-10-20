/**
 * merge-art-cards — the designer's cards for the merge art pass (Oct 2026),
 * each ≤ 700 px wide for a phone, every picture drawn by THE composer
 * (`game/data/skillIcons.ts`) inside the running app, at 1× and whole-pixel
 * multiples, beside the pack's own atlas icons:
 *
 *  - `library.png`: the 50 library skills, each its own drawing in its
 *    element's ramp, 4× and 1×, beside a row of the pack's icons;
 *  - `matrix.png`: the 6 × 6 ordered matrix (the row is the skill in the
 *    slot, the column the card dropped on it) — A→B is never B→A;
 *  - `named.png`: the twenty named merges, base ← card → the hand-drawn result;
 *  - `system.png`: how a plain merge is layered (drawing, ramp swap, rime,
 *    ink, motif) and the fifteen motifs and ramps;
 *  - `in-app.png`: the art where the player meets it, from `fusion-shots.mjs`;
 *  - `fuse-beat.webp`: the beat, the merge's picture making itself.
 *
 *   npx vite --port 5287 --strictPort &
 *   FRAMES=1 node scripts/fusion-shots.mjs <shots> p390
 *   node scripts/merge-art-cards.mjs <shots> [outDir]
 *
 * Env: SHOTS_BASE (default http://127.0.0.1:5287/), PW_CHROMIUM.
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const SHOTS = path.resolve(process.argv[2] ?? 'docs/ui-audit-2026-10/merge-art/shots')
const OUT = path.resolve(process.argv[3] ?? 'docs/ui-audit-2026-10/merge-art')
const BASE = process.env.SHOTS_BASE ?? 'http://127.0.0.1:5287/'
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright'))

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})
const ctx = await browser.newContext({ viewport: { width: 700, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
await page.goto(BASE)
await page.waitForFunction(() => !!window.__meta, null, { timeout: 30000 })
await page.waitForTimeout(800)

const STYLE = `
  body { margin: 0; background: var(--bg); color: var(--text); font-family: Inter, system-ui, sans-serif; }
  #root, .app { display: none !important; }
  .card { width: 700px; box-sizing: border-box; padding: 20px 22px 24px; background: var(--bg); }
  .card h1 { margin: 0 0 2px; font-family: var(--font-display); font-size: 28px; color: var(--accent-text); }
  .card .sub { margin: 0 0 12px; color: var(--muted); font-size: 12.5px; line-height: 1.4; }
  .lv { margin: 12px 0 6px; font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
  canvas.px { image-rendering: pixelated; display: block; }
  .pair { display: flex; align-items: flex-end; gap: 4px; }
  .grid { display: grid; gap: 6px; }
  .cell { background: var(--panel); border-radius: 6px; padding: 6px 4px 5px; display: grid; justify-items: center; gap: 3px; }
  .cell b { font-size: 10px; line-height: 1.15; text-align: center; color: var(--text); font-weight: 700; }
  .cell i { font-size: 9.5px; color: var(--muted); font-style: normal; }
  .pack { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; background: var(--panel-2); border-radius: 6px; }
  .pack .fw-i { margin: 0 1px; }
  table { border-collapse: separate; border-spacing: 3px; width: 100%; table-layout: fixed; }
  th { font-size: 10.5px; font-weight: 800; color: var(--muted); text-align: center; padding: 2px; vertical-align: bottom; }
  th canvas { margin: 0 auto 3px; }
  th.row { text-align: right; padding-right: 4px; width: 84px; }
  th.row .pair { justify-content: flex-end; }
  td { background: var(--panel); border-radius: 5px; padding: 5px 3px 4px; text-align: center; vertical-align: top; }
  td.self { background: transparent; border: 1px dashed var(--line); color: var(--muted); vertical-align: middle; }
  td.named { background: color-mix(in srgb, var(--gold-text) 16%, var(--panel)); }
  td .pair { justify-content: center; }
  td b { display: block; font-size: 9.5px; line-height: 1.15; margin-top: 3px; color: var(--text); }
  td.named b { color: var(--gold-text); }
  .legend { margin-top: 10px; font-size: 11.5px; color: var(--muted); line-height: 1.4; }
  .rec { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; }
  .rec .row { display: flex; align-items: center; gap: 6px; background: var(--panel); border-radius: 6px; padding: 6px 8px; }
  .rec .op { color: var(--muted); font-weight: 800; font-size: 12px; }
  .rec .nm { display: grid; gap: 1px; min-width: 0; }
  .rec .nm b { font-family: var(--font-display); font-size: 14px; color: var(--gold-text); }
  .rec .nm i { font-size: 10px; color: var(--muted); font-style: normal; }
  .steps { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .steps .cell { padding: 6px; }
  .flow { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; align-items: start; }
  .flow figure { margin: 0; }
  .flow img { width: 100%; display: block; border-radius: 8px; border: 1px solid var(--line-strong); }
  .flow figcaption { margin-top: 5px; font-size: 11.5px; line-height: 1.35; color: var(--muted); }
  .flow figcaption b { color: var(--text); display: block; font-size: 12.5px; }
  .flow .wide { grid-column: 1 / -1; }
`
await page.evaluate((style) => document.head.insertAdjacentHTML('beforeend', `<style>${style}</style>`), STYLE)

/** Helpers the cards share, installed in the page: a picture as a canvas at a whole-pixel scale. */
await page.evaluate(async () => {
  const ic = await import('/src/game/data/skillIcons.ts')
  const sk = await import('/src/game/data/skills.ts')
  const atlas = await import('/src/game/data/iconAtlas.ts')
  const fu = await import('/src/game/data/fusions.ts')
  const art = await import('/src/game/data/skillArt.ts')
  const inf = await import('/src/game/data/infusions.ts')
  const canvasOf = (px, s) => {
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 16
    const g = c.getContext('2d')
    const d = g.createImageData(16, 16)
    d.data.set(px)
    g.putImageData(d, 0, 0)
    c.className = 'px'
    c.style.width = `${16 * s}px`
    c.style.height = `${16 * s}px`
    return c.outerHTML.replace('<canvas', `<img src="${c.toDataURL()}"`).replace('</canvas>', '')
  }
  const pic = (id, s) => canvasOf(ic.skillIconPixels(id), s)
  const both = (id, big) => `<span class="pair">${pic(id, big)}${pic(id, 1)}</span>`
  const cell = (k) => {
    const { ix, iy } = atlas.iconCell(k)
    return `<span class="fw-i" style="--ix:${ix};--iy:${iy}"></span>`
  }
  window.__ma = { ic, sk, atlas, fu, art, inf, canvasOf, pic, both, cell }
})

/* ------------------------------------------------------------ library.png */
await page.evaluate(() => {
  const { sk, inf, both, cell } = window.__ma
  const pack = ['burn', 'chill', 'shock', 'crit', 'blade', 'axe', 'bow', 'shield', 'banner', 'gold', 'relic', 'forge', 'boss', 'crown']
  const lvl = (l) =>
    `<p class="lv">Level ${l}</p><div class="grid" style="grid-template-columns: repeat(7, 1fr)">${sk.ALL_SKILLS.filter((k) => k.level === l)
      .map((k) => `<div class="cell">${both(k.id, 4)}<b>${k.name}</b><i>${inf.INFUSIONS[k.id].tag}</i></div>`)
      .join('')}</div>`
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="card" id="library"><h1>Every skill, its own picture</h1><p class="sub">50 library skills, each a drawing whose silhouette names it, at 4× and 1×. The part that carries its element (the bolt, the crystal, the venom) is painted in key colours and takes its tag's ramp (named under it): in a merge, those keys take the card's.</p>
     <p class="lv">The pack's own icons, at 1× and 2× (for scale and hand)</p>
     <div class="pack">${pack.map(cell).join('')}<span style="width:12px"></span>${pack.map((k) => cell(k).replace('class="fw-i"', 'class="fw-i lg"')).join('')}</div>
     ${lvl(1)}${lvl(2)}${lvl(3)}</div>`,
  )
})
await page.waitForTimeout(400)
await page.locator('#library').screenshot({ path: path.join(OUT, 'library.png') })

/* ------------------------------------------------------------- matrix.png */
await page.evaluate(() => {
  document.getElementById('library')?.remove()
  const { sk, inf, both, pic } = window.__ma
  const six = ['hard_hitter', 'keen_eye', 'quick_hands', 'frostbite', 'arc_spark', 'poison_tips']
  const head = six.map((c) => `<th>${pic(c, 2)}${sk.skillById(c).name}<br><i style="font-weight:600">${inf.INFUSIONS[c].tag}</i></th>`).join('')
  const rows = six
    .map((b) => {
      const cells = six
        .map((c) => {
          if (b === c) return '<td class="self">—</td>'
          const id = sk.mergeId(b, c)
          const m = sk.skillById(id)
          return `<td class="${m.named ? 'named' : ''}">${both(id, 4)}<b>${m.name}${m.named ? ' ★' : ''}</b></td>`
        })
        .join('')
      return `<tr><th class="row"><span class="pair">${pic(b, 2)}</span>${sk.skillById(b).name}</th>${cells}</tr>`
    })
    .join('')
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="card" id="matrix"><h1>Order matters, in the picture too</h1><p class="sub">The row is the skill in the slot (the base: its drawing leads); the column is the card dropped on it (its colour pours over the base's key pixels, and its motif lands on its corner). So Frozen Arc Spark is a bolt gone ice-blue under rime, and Sparking Frostbite a fang whose crystal turns storm-yellow with a spark top left. At 4× and 1×.</p>
     <p class="lv" style="margin-left:90px">card dropped on it →</p>
     <table><tr><th class="row">in the slot ↓</th>${head}</tr>${rows}</table>
     <p class="legend">Gold ★: a named merge, hand-drawn (its gold bracket bottom right). Every other cell is composed at runtime from the base's drawing, the card's ramp and the card's motif.</p></div>`,
  )
})
await page.waitForTimeout(400)
await page.locator('#matrix').screenshot({ path: path.join(OUT, 'matrix.png') })

/* -------------------------------------------------------------- named.png */
await page.evaluate(() => {
  document.getElementById('matrix')?.remove()
  const { sk, fu, pic } = window.__ma
  const row = (f) => `<div class="row">${pic(f.parts[0], 2)}<span class="op">←</span>${pic(f.parts[1], 2)}<span class="op">→</span>${pic(f.id, 4)}${pic(f.id, 1)}
      <span class="nm"><b>${f.name} ★</b><i>${sk.skillById(f.parts[0]).name} ← ${sk.skillById(f.parts[1]).name}</i></span></div>`
  const t1 = fu.FUSIONS.filter((f) => f.tier === 1)
  const t2 = fu.FUSIONS.filter((f) => f.tier === 2)
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="card" id="named"><h1>The twenty named merges</h1><p class="sub">Each drawn by hand as ONE new object made of both parts: Rimecut is Frostbite's ice made into Keen Eye's crit blade, Plague Spark the fork run green with venom, Cinderburst Cleave's sweep bursting into Wildfire's embers, Hail of Arrows one shaft fanned into a volley. Base ← card → result (4× and 1×).</p>
     <p class="lv">Tier 1 · a gold bracket, bottom right</p><div class="rec">${t1.map(row).join('')}</div>
     <p class="lv">Greater · three skills in one slot: gold in the drawing, brackets on both bottom corners</p><div class="rec">${t2.map(row).join('')}</div></div>`,
  )
})
await page.waitForTimeout(400)
await page.locator('#named').screenshot({ path: path.join(OUT, 'named.png') })

/* ------------------------------------------------------------- system.png */
await page.evaluate(() => {
  document.getElementById('named')?.remove()
  const { ic, art, canvasOf } = window.__ma
  const id = 'mx.arc_spark.frostbite'
  const r = ic.iconRecipe(id)
  const own = ic.composeRecipe(r, { ramp: r.ownRamp, motifs: [] })
  const swapped = ic.composeRecipe(r, { motifs: [] })
  const layers = ic.mergeLayers(id)
  const step = (px, t) => `<div class="cell">${canvasOf(px, 4)}<i>${t}</i></div>`
  const arrow = '<span style="color:var(--muted);font-weight:800">→</span>'
  const deep = 'mx.arc_spark.frostbite.wildfire'
  const tags = Object.keys(art.TAG_RAMP)
  const sw = (h) => `<span style="display:inline-block;width:14px;height:14px;background:${h};border:1px solid #161c2e"></span>`
  const motifCell = (t) =>
    `<div class="cell">${canvasOf(ic.composeRecipe(ic.iconRecipe('hard_hitter'), { ramp: art.TAG_RAMP[t], motifs: [t] }), 3)}<span>${art.TAG_RAMP[t].map(sw).join('')}</span><i>${t} · ${art.MOTIFS[t].place}</i></div>`
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="card" id="system"><h1>How a merge is drawn</h1><p class="sub">The Stardew method, in the pack's hand: one drawing per skill on one grid, a key-colour swap for the element, and a motif layered on a fixed corner. Pure and deterministic: the same id always gives the same 256 pixels, so the atlas bakes the 70 fixed pictures and the app composes the 2,437 plain merges from the same code.</p>
     <p class="lv">Arc Spark ← Frostbite</p>
     <div class="steps">${step(own, 'the base, its own ramp')}${arrow}${step(swapped, 'keys take frost')}${arrow}${step(layers.fly, 'rime: frost’s motif')}${arrow}${step(ic.skillIconPixels(id), 'Frozen Arc Spark')}${arrow}${step(ic.skillIconPixels(deep), '+ Wildfire: a 3rd skill')}</div>
     <p class="lv">The fifteen tags: ramp (light · mid · dark) and motif, on Hard Hitter</p>
     <div class="grid" style="grid-template-columns: repeat(5, 1fr)">${tags.map(motifCell).join('')}</div>
     <p class="legend">Ramps turn in hue from light to dark (shadows cool or magenta), every colour from the harvested CC0 pack. Two cards of one tag pour the same colour and motif: the merge's name says which.</p></div>`,
  )
})
await page.waitForTimeout(400)
await page.locator('#system').screenshot({ path: path.join(OUT, 'system.png') })

/* ------------------------------------------------------------- in-app.png */
const shot = (n) => path.join(SHOTS, `${n}-p390.png`)
const have = ['02-drag-over-full', '04p-plain-chosen', '06-hero-card', '09-codex-tree', '05p-beat-b', '05p-beat-d'].every((n) => fs.existsSync(shot(n)))
if (have) {
  // Phone shots at 390 × 844 DPR 2: crop to the band that holds the art.
  const crop = async (n, top, height, width = 780) => (await sharp(shot(n)).extract({ left: 0, top, width, height }).png().toBuffer()).toString('base64')
  const imgs = {
    drag: await crop('02-drag-over-full', 900, 310),
    card: await crop('04p-plain-chosen', 860, 560),
    hero: await crop('06-hero-card', 1080, 460),
    codex: await crop('09-codex-tree', 500, 1000),
    beatB: await crop('05p-beat-b', 1180, 260, 500),
    beatD: await crop('05p-beat-d', 1180, 260, 500),
  }
  await page.evaluate((imgs) => {
    document.getElementById('system')?.remove()
    const im = (k) => `<img src="data:image/png;base64,${imgs[k]}">`
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div class="card" id="inapp"><h1>Where the player meets it</h1><p class="sub">The running app at 390 × 844 (DPR 2). Every skill a hero holds, previews or is offered is drawn by its own picture; a plain merge is composed once and kept.</p>
       <div class="flow">
        <figure>${im('drag')}<figcaption><b>1 · The drop preview</b>Mid-drag, each slot shows the RESULT's own picture beside its name: the held skill's drawing in the card's colours, the card's motif on its corner.</figcaption></figure>
        <figure>${im('card')}<figcaption><b>2 · The merge card</b>Its head is the merge's picture; the recipe row pictures both parts in order.</figcaption></figure>
        <figure>${im('hero')}<figcaption><b>3 · The hero card</b>The slot holds the composed merge, not its base's mark.</figcaption></figure>
        <figure>${im('codex')}<figcaption><b>4 · The Codex tree</b>Parts always pictured; an unmade result stays "?". Found ones show their hand-drawn picture and its gold bracket (two for a greater).</figcaption></figure>
        <figure>${im('beatB')}<figcaption><b>5 · The fuse beat, mid-flight</b>Frost's rime has flown onto Arc Spark's yellow bolt …</figcaption></figure>
        <figure>${im('beatD')}<figcaption><b>&nbsp;</b>… and the frost has poured over it: Frozen Arc Spark, exactly the picture its slot now holds.</figcaption></figure>
       </div></div>`,
    )
  }, imgs)
  await page.waitForTimeout(500)
  await page.locator('#inapp').screenshot({ path: path.join(OUT, 'in-app.png') })
} else console.log('in-app.png skipped: run fusion-shots.mjs first')

/* ---------------------------------------------------------- fuse-beat.webp */
const frames = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.png'))
        .sort()
        .map((f) => path.join(dir, f))
    : []
const plain = frames(path.join(SHOTS, 'frames-plain-p390'))
const named = frames(path.join(SHOTS, 'frames-p390'))
if (plain.length) {
  const all = [...plain, ...named]
  const meta = await sharp(all[0]).metadata()
  const W = Math.min(700, meta.width)
  const H = Math.round((meta.height * W) / meta.width)
  const bufs = await Promise.all(all.map((f) => sharp(f).resize(W, H, { fit: 'fill' }).png().toBuffer()))
  // Hold the last frame of each beat for a second so it can be read.
  const hold = (n) => Array(25).fill(n)
  const seq = [...bufs.slice(0, plain.length), ...hold(bufs[plain.length - 1]), ...(named.length ? [...bufs.slice(plain.length), ...hold(bufs[bufs.length - 1])] : [])]
  await sharp(seq, { join: { animated: true } })
    .webp({ delay: Array(seq.length).fill(40), loop: 0, quality: 80, effort: 6 })
    .toFile(path.join(OUT, 'fuse-beat.webp'))
  console.log('fuse-beat.webp', seq.length, 'frames')
} else console.log('fuse-beat.webp skipped: run FRAMES=1 fusion-shots.mjs first')

await browser.close()
console.log('cards ->', OUT)
