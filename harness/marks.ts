/**
 * Marks and flags — the review harness behind the marks critique
 * (`docs/ui-audit-2026-10/asset-critique/marks/`).
 *
 * Run:  npx vite --port 5254  →  http://localhost:5254/harness/marks.html
 *
 * Every picture is the game's own: the shell's pixel marks are the real React
 * parts (`ui/pixel.tsx`, `CompanyFlag`), the canvases blit the same pixel rows
 * (`companies.COMPANY_LOGOS`, `companyStandard`, `banner`) at whole-number
 * scales, and the brand files are the shipped ones. Each `section[data-shot]`
 * is one element screenshot; `?proposal=1` adds the unshipped proposals
 * (`harness/marksProposals.ts`).
 */
import '../src/styles/global.css'
import '../src/styles/shell.css'
import '../src/styles/contracts.css'
import { createElement as h, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { COMPANIES, COMPANY_IDS, COMPANY_LOGOS, type CompanyId } from '../src/game/data/companies'
import { COIN, COIN_PALETTE, pixelRuns, type Palette, type PixelRows } from '../src/game/data/pixelArt'
import { companyStandardPalette, companyStandardRows, DEFAULT_STANDARD, type StandardLook } from '../src/game/data/companyStandard'
import { COMPANY_KITS } from '../src/game/data/companyKits'
import { ALL_BANNER_SHAPES, ALL_CHARGE_IDS, CHARGES, soldierPalette, soldierRows, SOLDIER_KINDS, type BannerLook } from '../src/game/data/banner'
import { Coin, Crest, Crown, Lantern, Lock, Scroll, SovereignCrest, Sword, Crate, Banner, Pixel } from '../src/ui/pixel'
import { CompanyFlag } from '../src/ui/shell/contracts/parts'
import { Icon } from '../src/ui/Icon'
import markSvg from '../src/assets/brand/mark.svg'
import markMono from '../src/assets/brand/mark-mono.svg'
import mark16 from '../src/assets/brand/mark-16.png'

const out = document.getElementById('out')!
const params = new URLSearchParams(location.search)

/** Rows blitted to a canvas at `k` px a cell. */
function blit(rows: PixelRows, pal: Palette, k: number): HTMLCanvasElement {
  const w = rows[0]?.length ?? 0
  const c = document.createElement('canvas')
  c.width = w * k
  c.height = rows.length * k
  const g = c.getContext('2d')!
  for (const r of pixelRuns(rows, pal)) {
    g.fillStyle = r.fill
    g.fillRect(r.x * k, r.y * k, r.w * k, k)
  }
  return c
}

const sec = (id: string, title: string, body: ReactNode) => h('section', { 'data-shot': id, key: id }, h('h2', null, title), body)
const cell = (label: string, node: ReactNode, key?: string) => h('div', { className: 'cell', key: key ?? label }, node, h('small', null, label))
const ground = (kind: string, ...kids: ReactNode[]) => h('div', { className: `g ${kind}` }, ...kids)
const canvasNode = (c: HTMLCanvasElement, key?: string) => h('span', { key, ref: (el: HTMLSpanElement | null) => el && !el.firstChild && el.appendChild(c) })

const NAMES: Record<CompanyId, string> = Object.fromEntries(COMPANIES.map((c) => [c.id, c.name])) as Record<CompanyId, string>

/** One mark at 1×, 2× and 4× on the three grounds it sits on. */
const scales = (node: (s: number) => ReactNode) =>
  h(
    'div',
    { className: 'row' },
    ...['wood', 'panel', 'paper', 'map'].map((g) => ground(g, ...[1, 2, 4].map((s) => cell(`${s}×`, node(s), `${g}${s}`)))),
  )

const sections: ReactNode[] = []

// The family: the five crests side by side at real sizes.
sections.push(
  sec(
    'crest-family',
    'Company crests — the family',
    h(
      'div',
      null,
      ...[1, 2, 4].map((s) =>
        ground('wood', ...COMPANY_IDS.map((c) => cell(s === 4 ? NAMES[c] : `${s}×`, h(Crest, { company: c, scale: s }), c + s)), cell('locked', h(Crest, { company: 'spice', scale: s, locked: true }), 'l' + s)),
      ),
      ground('paper', ...COMPANY_IDS.map((c) => cell('2×', h(Crest, { company: c, scale: 2 }), 'p' + c))),
    ),
  ),
)
for (const c of COMPANY_IDS) sections.push(sec(`crest-${c}`, NAMES[c], scales((s) => h(Crest, { company: c, scale: s }))))
sections.push(sec('crest-sovereign', 'Sovereign crest', scales((s) => h(SovereignCrest, { scale: s }))))
sections.push(sec('crown', 'Crown', scales((s) => h(Crown, { scale: s }))))
sections.push(sec('lock', 'Lock', scales((s) => h(Lock, { scale: s }))))
sections.push(sec('coin', 'Coin (shell) and the atlas gold (run HUD)', h('div', { className: 'row' }, ...['wood', 'panel', 'paper', 'map'].map((g) => ground(g, cell('1×', h(Coin, { scale: 1 }), g + 'c1'), cell('2×', h(Coin, { scale: 2 }), g + 'c2'), cell('4×', h(Coin, { scale: 4 }), g + 'c4'), cell('atlas', h(Icon, { name: 'gold' }), g + 'a1'), cell('atlas lg', h(Icon, { name: 'gold', lg: true }), g + 'a2'))))))
sections.push(sec('small-marks', 'Crate, lantern, sword, scroll', scales((s) => h('span', { style: { display: 'flex', gap: 6, alignItems: 'flex-end' } }, h(Crate, { color: '#c6e05a', scale: s }), h(Crate, { ghost: true, scale: s }), h(Lantern, { lit: true, scale: s }), h(Lantern, { lit: false, scale: s }), h(Sword, { scale: s }), h(Scroll, { scale: s })))))

// The standards: plain, then fully dressed with the kit's last piece of each kind.
const dressed = (c: CompanyId): StandardLook => {
  const kit = COMPANY_KITS[c]
  const last = <K extends string>(k: K) => [...kit].reverse().find((p) => p.kind === k)?.id ?? null
  return { cut: (last('cut') as StandardLook['cut']) ?? 'gonfalon', pattern: (kit.find((p) => p.kind === 'pattern')?.id as StandardLook['pattern']) ?? 'plain', tincture2: (kit.find((p) => p.kind === 'colour')?.id as StandardLook['tincture2']) ?? null, charge: (kit.find((p) => p.kind === 'emblem')?.id as StandardLook['charge']) ?? 'none', trim: (last('trim') as StandardLook['trim']) ?? null }
}
sections.push(
  sec(
    'standards',
    'Company standards — plain (wagon size, 2 px a cell) and dressed',
    h(
      'div',
      null,
      ground('grass', ...COMPANY_IDS.map((c) => cell(NAMES[c], canvasNode(blit(companyStandardRows(c, DEFAULT_STANDARD), companyStandardPalette(c, DEFAULT_STANDARD), 2)), c))),
      ground('grass', ...COMPANY_IDS.map((c) => cell('dressed', canvasNode(blit(companyStandardRows(c, dressed(c)), companyStandardPalette(c, dressed(c)), 2)), 'd' + c))),
      ground('panel', ...COMPANY_IDS.map((c) => cell('card flag', h(CompanyFlag, { company: c }), 'f' + c)), cell('locked', h(CompanyFlag, { company: 'spice', locked: true }), 'fl')),
    ),
  ),
)
for (const c of COMPANY_IDS)
  sections.push(sec(`standard-${c}`, `${NAMES[c]} standard, 4×`, ground('grass', canvasNode(blit(companyStandardRows(c, DEFAULT_STANDARD), companyStandardPalette(c, DEFAULT_STANDARD), 4)), canvasNode(blit(companyStandardRows(c, dressed(c)), companyStandardPalette(c, dressed(c)), 4)))))

// Every kit, piece by piece, on its own standard.
for (const c of COMPANY_IDS) {
  const kit = COMPANY_KITS[c]
  sections.push(
    sec(
      `kit-${c}`,
      `${NAMES[c]} kit — one piece at a time (standing 1–10)`,
      ground(
        'grass',
        ...kit.map((p, i) => {
          const look: StandardLook = { ...DEFAULT_STANDARD }
          if (p.kind === 'cut') look.cut = p.id
          if (p.kind === 'pattern') look.pattern = p.id
          if (p.kind === 'colour') {
            look.pattern = 'bend'
            look.tincture2 = p.id
          }
          if (p.kind === 'emblem') look.charge = p.id
          if (p.kind === 'trim') look.trim = p.id
          return cell(`${i + 1} ${p.id}`, canvasNode(blit(companyStandardRows(c, look), companyStandardPalette(c, look), 2)), `${c}${i}`)
        }),
      ),
    ),
  )
}

// The militia builder's parts.
const base: BannerLook = { shape: 'swallow', tincture: 'crimson', charge: 'keep', pattern: 'plain', tincture2: 'sable', metal: 'gold' }
sections.push(sec('banner-shapes', 'Militia banner — every cut (3×)', ground('grass', ...ALL_BANNER_SHAPES.map((s) => cell(s, h(Banner, { look: { ...base, shape: s, charge: 'none' }, scale: 3 }), s)))))
sections.push(sec('banner-charges', 'Militia banner — every emblem (3×)', h('div', null, ground('grass', ...ALL_CHARGE_IDS.slice(0, 16).map((ch) => cell(ch, h(Banner, { look: { ...base, charge: ch }, scale: 3 }), ch))), ground('grass', ...ALL_CHARGE_IDS.slice(16).map((ch) => cell(ch, h(Banner, { look: { ...base, charge: ch }, scale: 3 }), ch))))))
sections.push(sec('charges-alone', 'Emblems alone (5 × 5, 6×)', ground('wood', ...ALL_CHARGE_IDS.filter((c) => c !== 'none').map((ch) => cell(ch, canvasNode(blit(CHARGES[ch], { p: '#e0ac4c' }, 6)), ch)))))
sections.push(sec('soldiers', 'Builder soldiers (3×)', ground('grass', ...SOLDIER_KINDS.map((k) => cell(k, canvasNode(blit(soldierRows(base, k), soldierPalette(base), 3)), k)), ...SOLDIER_KINDS.map((k) => cell(k, canvasNode(blit(soldierRows({ ...base, tincture: 'navy', pattern: 'quarterly', tincture2: 'ochre', metal: 'silver', charge: 'star' }, k), soldierPalette({ ...base, tincture: 'navy', pattern: 'quarterly', tincture2: 'ochre', metal: 'silver', charge: 'star' }), 3)), 'b' + k)))))

// The brand.
const img = (src: string, w: number, key: string) => h('img', { src, width: w, key, style: { imageRendering: w < 40 ? 'pixelated' : 'auto' } })
sections.push(
  sec(
    'brand',
    'The Dripping Seal — vector, mono and the pixel mark',
    h(
      'div',
      { className: 'row' },
      ground('wood', cell('40', img(markSvg, 40, 'a')), cell('96', img(markSvg, 96, 'b')), cell('px 16', img(mark16, 16, 'c')), cell('px 32', img(mark16, 32, 'd')), cell('px 64', img(mark16, 64, 'e'))),
      ground('paper', cell('mono 40', img(markMono, 40, 'f')), cell('mono 96', img(markMono, 96, 'g')), cell('full 96', img(markSvg, 96, 'h'))),
    ),
  ),
)

// Coin on its own, row-blitted (for the 8× zoom of the cards).
sections.push(sec('coin-8x', 'Coin 8×', ground('wood', canvasNode(blit(COIN, COIN_PALETTE, 8)))))
// Each logo alone at 8× for the zoom panels.
for (const c of [...COMPANY_IDS, 'locked' as const]) sections.push(sec(`logo8-${c}`, `${c} 8×`, ground('wood', canvasNode(blit(COMPANY_LOGOS[c].rows, COMPANY_LOGOS[c].palette, 8)))))

if (params.get('proposal')) {
  const { proposalSections } = await import('./marksProposals')
  sections.push(...proposalSections({ blit, sec, cell, ground, canvasNode }))
}

void Pixel
createRoot(out).render(h('div', null, ...sections))
