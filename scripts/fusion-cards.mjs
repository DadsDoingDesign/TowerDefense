/**
 * fusion-cards — the designer's cards for ordered merges (Oct 2026), drawn in
 * the running app's own CSS and icon atlas, each ≤ 700 px wide for a phone:
 *
 *  - `recipes.png`: the named merges as a build tree — base ← card → named,
 *    and the greater one each builds into ← its Level 3 card — with each
 *    twist in one line (from `data/fusions.ts`, so it never drifts);
 *  - `matrix.png`: a 6 × 6 of ordered pairs (the row is the skill in the
 *    slot, the column the card dropped on it): every cell a different skill,
 *    a named merge in gold;
 *  - `fusion.png`: the flow, from the shots `fusion-shots.mjs` took.
 *
 *   npx vite --port 5287 --strictPort &
 *   node scripts/fusion-shots.mjs <shots> p390
 *   node scripts/fusion-cards.mjs <shots> [outDir]
 *
 * Env: SHOTS_BASE (default http://127.0.0.1:5287/), PW_CHROMIUM.
 */
import fs from 'node:fs'
import path from 'node:path'

const SHOTS = path.resolve(process.argv[2] ?? 'docs/ui-audit-2026-10/fusion/shots')
const OUT = path.resolve(process.argv[3] ?? 'docs/ui-audit-2026-10/fusion')
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
  .card { width: 700px; box-sizing: border-box; padding: 22px 24px 26px; background: var(--bg); }
  .card h1 { margin: 0 0 2px; font-family: var(--font-display); font-size: 30px; color: var(--accent-text); }
  .card .sub { margin: 0 0 14px; color: var(--muted); font-size: 13px; line-height: 1.4; }
  .lv { margin: 14px 0 6px; font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
  .part { display: inline-flex; align-items: center; gap: 4px; color: var(--text); white-space: nowrap; }
  .op { color: var(--muted); font-weight: 800; }
  .into { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--text); white-space: nowrap; }
  .gold { color: var(--gold-text); }
  /* the tree */
  .branch { display: grid; grid-template-columns: 1fr 26px 1fr; align-items: stretch; margin: 0 0 8px; }
  .node { padding: 8px 10px 8px 12px; border-radius: 6px; background: var(--panel); border-left: 3px solid var(--fz); display: grid; gap: 3px; }
  .node .eq { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; font-size: 13px; }
  .node .tw { font-size: 12px; font-weight: 700; line-height: 1.3; }
  .node .co { font-size: 10.5px; color: var(--muted); }
  .link { position: relative; }
  .link::before { content: ''; position: absolute; left: 3px; right: 7px; top: 50%; height: 2px; background: var(--line-strong); }
  .link::after { content: ''; position: absolute; right: 2px; top: calc(50% - 4px); border: 5px solid transparent; border-left-color: var(--line-strong); border-right: 0; }
  .leaves { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  /* the matrix */
  table { border-collapse: separate; border-spacing: 3px; width: 100%; table-layout: fixed; }
  th { font-size: 11px; font-weight: 800; color: var(--muted); text-align: center; padding: 2px; }
  th.row { text-align: right; padding-right: 6px; width: 92px; }
  th .fw-i { display: block; margin: 0 auto 2px; }
  td { background: var(--panel); border-radius: 5px; padding: 5px 5px 6px; vertical-align: top; font-size: 10.5px; line-height: 1.25; height: 74px; border-top: 2px solid var(--fz); }
  td.self { background: transparent; border: 1px dashed var(--line); text-align: center; vertical-align: middle; color: var(--muted); }
  td b { display: block; font-size: 11.5px; color: var(--text); margin-bottom: 2px; }
  td.named { background: color-mix(in srgb, var(--gold-text) 14%, var(--panel)); }
  td.named b { color: var(--gold-text); }
  td i { color: var(--muted); font-style: normal; }
  .axis { font-size: 11px; color: var(--muted); margin: 0 0 4px 98px; }
  .legend { margin-top: 10px; font-size: 12px; color: var(--muted); line-height: 1.4; }
  /* the flow */
  .flow { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; align-items: start; }
  .flow figure { margin: 0; }
  .flow img { width: 100%; display: block; border-radius: 8px; border: 1px solid var(--line-strong); }
  .flow figcaption { margin-top: 6px; font-size: 12px; line-height: 1.35; color: var(--muted); }
  .flow figcaption b { color: var(--text); display: block; font-size: 13px; }
`
await page.evaluate((style) => document.head.insertAdjacentHTML('beforeend', `<style>${style}</style>`), STYLE)

/* ------------------------------------------------------------ recipes.png */
await page.evaluate(async () => {
  const { FUSIONS, ELEMENT_TOKEN } = await import('/src/game/data/fusions.ts')
  const { skillById, skillHeadline } = await import('/src/game/data/skills.ts')
  const { iconCell } = await import('/src/game/data/iconAtlas.ts')
  const { companyById } = await import('/src/game/data/companies.ts')
  const icon = (k, lg) => {
    const { ix, iy } = iconCell(k)
    return `<span class="fw-i${lg ? ' lg' : ''}" style="--ix:${ix};--iy:${iy}"></span>`
  }
  const part = (id) => {
    const k = skillById(id)
    return `<span class="part">${icon(skillHeadline(k).icon)}${k.name}</span>`
  }
  const node = (f) => `<div class="node" style="--fz: var(${ELEMENT_TOKEN[f.element]})">
      <div class="eq">${part(f.parts[0])}<span class="op">←</span>${part(f.parts[1])}</div>
      <div class="into">${icon(f.icon, true)}${f.name} <span class="gold">★</span></div>
      <div class="tw">${f.twist}</div>
      <div class="co">${companyById(f.company).name} · Level ${f.level}</div></div>`
  const t1 = FUSIONS.filter((f) => f.tier === 1)
  const branches = t1
    .map((f) => [f, FUSIONS.find((g) => g.parts[0] === f.id)])
    .filter(([, g]) => g)
    .map(([f, g]) => `<div class="branch">${node(f)}<span class="link"></span>${node(g)}</div>`)
    .join('')
  const leaves = t1.filter((f) => !FUSIONS.some((g) => g.parts[0] === f.id)).map(node).join('')
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="card" id="recipes"><h1>Named merges</h1><p class="sub">Any card dropped on any held skill merges in; these ${FUSIONS.length} ordered pairs are the specials. The skill in the slot comes first (base ← card). The other order is a plain merge. A greater one is a tier-1 named merge with a Level 3 card poured in: three skills in one slot.</p>
     <p class="lv">Builds into a greater merge (one per company)</p>${branches}
     <p class="lv">Tier 1</p><div class="leaves">${leaves}</div></div>`,
  )
})
await page.waitForTimeout(500)
await page.locator('#recipes').screenshot({ path: path.join(OUT, 'recipes.png') })

/* ------------------------------------------------------------- matrix.png */
await page.evaluate(async () => {
  document.getElementById('recipes')?.remove()
  const { ELEMENT_TOKEN } = await import('/src/game/data/fusions.ts')
  const { mergeId, mergedById, skillById, skillHeadline } = await import('/src/game/data/skills.ts')
  const { iconCell } = await import('/src/game/data/iconAtlas.ts')
  const icon = (k) => {
    const { ix, iy } = iconCell(k)
    return `<span class="fw-i" style="--ix:${ix};--iy:${iy}"></span>`
  }
  // Starters and the common Level 1 cards: the merges a run meets first.
  const ids = ['hard_hitter', 'keen_eye', 'quick_hands', 'frostbite', 'arc_spark', 'poison_tips']
  const head = ids.map((id) => `<th>${icon(skillHeadline(skillById(id)).icon)}${skillById(id).name}</th>`).join('')
  const rows = ids
    .map((a) => {
      const cells = ids
        .map((b) => {
          if (a === b) return `<td class="self">—</td>`
          const m = mergedById(mergeId(a, b))
          const rule = m.twist || m.lines[m.lines.length - 1]
          return `<td class="${m.named ? 'named' : ''}" style="--fz: var(${ELEMENT_TOKEN[m.element]})"><b>${m.name}${m.named ? ' ★' : ''}</b>${m.twist ? rule : `<i>${rule}</i>`}</td>`
        })
        .join('')
      return `<tr><th class="row">${skillById(a).name}</th>${cells}</tr>`
    })
    .join('')
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="card" id="matrix"><h1>Order matters</h1><p class="sub">The row is the skill in the slot (the base: it keeps its name and its numbers); the column is the card dropped on it (it lends a share and the rule in the cell). Thirty pairs, thirty different skills.</p>
     <p class="axis">card dropped on it →</p>
     <table><thead><tr><th class="row">in the slot ↓</th>${head}</tr></thead><tbody>${rows}</tbody></table>
     <p class="legend">Gold ★: a named merge (its own twist). Grey: no rule applies there, so the share alone is the merge (the line shown is the share). Each cell's colour is the element the card lends.</p></div>`,
  )
})
await page.waitForTimeout(500)
await page.locator('#matrix').screenshot({ path: path.join(OUT, 'matrix.png') })

/* ------------------------------------------------------------- fusion.png */
/** A shot, or its `-crop` (the panel that matters, cut from the phone shot) when there is one. */
const img = (f) => {
  const crop = path.join(SHOTS, f.replace('-p390.png', '-crop.png'))
  const p = fs.existsSync(crop) ? crop : path.join(SHOTS, f)
  return fs.existsSync(p) ? `data:image/png;base64,${fs.readFileSync(p).toString('base64')}` : ''
}
const steps = [
  ['01-offer-builds-p390.png', '1 · The slots are the targets', 'Level 5, holding Frostbite. Each slot says what the card makes there: onto an empty one it stays itself; onto Frostbite it makes Rimecut ★.'],
  ['02-drag-over-full-p390.png', '2 · Full: drag to merge', 'At level 15 all three slots hold a skill. A card dragged over one shows what that slot would become. No swap: nothing is lost.'],
  ['03-drop-chosen-p390.png', '3 · Read, then commit', 'Let go (or tap a slot): the card reads the merge — the base, what the card lends, the rule — and the CTA names it.'],
  ['05-beat-d-p390.png', '4 · The fuse beat', 'Base and card slam together in the element’s colour. Under a second; still under reduced motion.'],
  ['06-hero-card-p390.png', '5 · One slot', 'The merge sits in one slot; its read line is the order and the twist.'],
  ['07-greater-p390.png', '6 · A greater merge', 'Volley dropped on Hail of Arrows: Skyfall, three skills in one slot, its tier-1 twist kept and a capstone added.'],
  ['09-codex-tree-p390.png', '7 · The Codex tree', 'The rule once, how many are made, then the named merges: branches into a greater, then the rest. “?” until made.'],
  ['11-codex-found-p390.png', '8 · Found', 'A found merge’s card: its order, what it lends, its twist.'],
]
await page.evaluate((steps) => {
  document.getElementById('matrix')?.remove()
  const figs = steps.map(([src, t, c]) => `<figure>${src ? `<img src="${src}">` : ''}<figcaption><b>${t}</b>${c}</figcaption></figure>`).join('')
  document.body.insertAdjacentHTML('beforeend', `<div class="card" id="flow"><h1>Merging</h1><p class="sub">“If into an empty slot then it’s kept as is, but if all slots are full you are forced to merge in” — and “order does matter and affects what’s made.”</p><div class="flow">${figs}</div></div>`)
}, steps.map(([f, t, c]) => [img(f), t, c]))
await page.waitForTimeout(600)
await page.locator('#flow').screenshot({ path: path.join(OUT, 'fusion.png') })
await browser.close()
console.log('cards →', OUT)
