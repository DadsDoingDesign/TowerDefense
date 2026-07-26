/** Generates docs/ui-audit/INDEX.md from whatever the audit run produced. */
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve('docs/ui-audit')

const TITLES = {
  '01-hub-and-menus': ['Hub & menus', 'Entry point. Main menu → perks → settings.'],
  '02-run-start': ['Run start', 'Hero pick → run map → crossroads.'],
  '03-battle-setup': ['Battle — setup phase', 'Placement, tabs, and every roster-card state.'],
  '04-battle-live': ['Battle — live & result', 'Wave in progress and the two result overlays.'],
  '06-modals': ['Modals & overlays', 'Every dialog, drawer, and full-screen overlay.'],
  '07-endless': ['Endless Watch', 'The endless-mode hub and its four rooms.'],
  '05-components/equip': ['Equip drawer', 'Slots, item rows, inspect state.'],
  '05-components/event': ['Event modals', 'Merchant, shrine, recruit, run-end.'],
  '05-components/hero-pick-card': ['Hero pick card', 'Archetype choice card.'],
  '05-components/hud': ['Battle HUD', 'Top bar, tabs, tactics, wave preview, controls.'],
  '05-components/inventory': ['Inventory manager', 'Grid, equipment slots, detail panel.'],
  '05-components/item-card': ['Item card', 'One per rarity, plus cursed and keepsake.'],
  '05-components/map': ['Run map chrome', 'Header and roster strip.'],
  '05-components/sentinel-card': ['Sentinel card', 'Every interactive state of the tower card.'],
  '05-components/upgrade': ['Tower upgrade', 'Upgrade modal and path states.'],
}

const walk = (dir, base = '') => {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = base ? `${base}/${e.name}` : e.name
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel))
    else if (e.name.endsWith('.png')) out.push(rel)
  }
  return out
}

const files = walk(OUT)
// group: folder -> stem -> {desktop, mobile}
const groups = new Map()
for (const f of files) {
  const dir = path.dirname(f)
  const bn = path.basename(f)
  const m = bn.match(/^(.*)\.(desktop|mobile)\.png$/)
  if (!m) continue
  if (!groups.has(dir)) groups.set(dir, new Map())
  const g = groups.get(dir)
  if (!g.has(m[1])) g.set(m[1], {})
  g.get(m[1])[m[2]] = f
}

const order = [
  '01-hub-and-menus', '02-run-start', '03-battle-setup', '04-battle-live',
  '06-modals', '07-endless',
  ...[...groups.keys()].filter((k) => k.startsWith('05-components')).sort(),
]
const seen = new Set()
let md = `# Fieldwatch — UI audit

${files.length} screenshots of every screen, modal, and component state, captured
from the real app (no mocks) at two viewports:

- **desktop** — 1440×900
- **mobile** — 390×844 @2x, touch + coarse pointer

Regenerate: \`npx vite --port 5188 --strictPort &\` then \`node scripts/ui-audit.mjs\`
(index: \`node scripts/ui-audit-index.mjs\`).

Design-token analysis of these states: [\`docs/DESIGN_SYSTEM.md\`](../DESIGN_SYSTEM.md).

---

## Flows

`
const section = (dir) => {
  if (seen.has(dir) || !groups.has(dir)) return ''
  seen.add(dir)
  const [title, blurb] = TITLES[dir] ?? [dir, '']
  let s = `### ${title}\n\`${dir}/\` — ${blurb}\n\n| Step | Desktop | Mobile |\n|---|---|---|\n`
  for (const [stem, v] of groups.get(dir)) {
    const d = v.desktop ? `[png](${v.desktop})` : '—'
    const m = v.mobile ? `[png](${v.mobile})` : '—'
    s += `| \`${stem}\` | ${d} | ${m} |\n`
  }
  return s + '\n'
}

for (const dir of order.filter((d) => !d.startsWith('05-components'))) md += section(dir)
md += '---\n\n## Components\n\nElement-clipped shots — each is the component alone, at both viewports.\n\n'
for (const dir of order.filter((d) => d.startsWith('05-components'))) md += section(dir)

md += `---

## Coverage notes

- \`02-setup-tactics-tab\` / \`03-setup-wave-tab\` are **mobile only** by design —
  desktop shows all three HUD panels at once, so the tab bar does not render.
- Item cards are captured through the merchant list, which is the real
  \`ItemCard\` render path (not an isolated harness).
- Every state is driven through the live Zustand store, so these are true
  renders of production code.
`

fs.writeFileSync(path.join(OUT, 'INDEX.md'), md)
console.log(`INDEX.md written — ${files.length} images, ${groups.size} groups.`)
