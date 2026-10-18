/**
 * Proposals for the two planned companies (NOT shipped): Butcherblock
 * (reptilians: meat, hides and salt — to take Easel House's slot) and
 * Greenvial (gnomes: plant potions — to take Moonquill's). Drawn here only, as
 * review cards for the designer (`docs/ui-audit-2026-10/asset-critique/marks/`);
 * nothing in `src/` reads these rows.
 *
 * Each is a 16 × 16 logo in the shipped logos' language (the `#161c2e`
 * outline, light from the upper left, two- or three-step ramps, the company's
 * colour the biggest mass) and its standard, built by the shipping
 * `standardRowsFor` so it flies exactly as the five do.
 *
 * Colours, each ΔE2000 ≥ 15 from every reserved hue and company (rarity,
 * gold, CTA teal, danger red, good green, the Sovereign aqua):
 *  - Butcherblock `#c25b6b`, brine-cured meat (≥ 15.2 from danger red);
 *  - Greenvial `#2fa58a`, bottle-glass jade (≥ 15.8 from good green).
 */
import { createElement as h, type ReactNode } from 'react'
import { COMPANY_IDS, COMPANY_LOGOS, type CompanyId, type CompanyLogo } from '../src/game/data/companies'
import { DEFAULT_STANDARD, standardPaletteFor, standardRowsFor, type StandardLook } from '../src/game/data/companyStandard'
import { companyById } from '../src/game/data/companies'
import type { Palette, PixelRows } from '../src/game/data/pixelArt'

export interface Kit {
  blit: (rows: PixelRows, pal: Palette, k: number) => HTMLCanvasElement
  sec: (id: string, title: string, body: ReactNode) => ReactNode
  cell: (label: string, node: ReactNode, key?: string) => ReactNode
  ground: (kind: string, ...kids: ReactNode[]) => ReactNode
  canvasNode: (c: HTMLCanvasElement, key?: string) => ReactNode
}

const O = '#161c2e'

/** Butcherblock: a haunch on the bone — the meat its marsh smokehouses salt and sell. */
export const BUTCHERBLOCK: CompanyLogo & { color: string; name: string } = {
  name: 'Butcherblock',
  color: '#c25b6b',
  rows: [
    '................',
    '........ooooo...',
    '......oohhhhhoo.',
    '.....olhhhhhhhdo',
    '....olhhfhhhhhdo',
    '....ohhhhhhffhdo',
    '...olhhffhhhhddo',
    '...ohhhhhhhhhddo',
    '...ohhhhhhhhdddo',
    '...oddhhhhhdddo.',
    '..owoddddddddo..',
    '.owwWoooooooo...',
    'owwWo...........',
    'owwWWo..........',
    '.owoWo..........',
    '..o.o...........',
  ],
  palette: { o: O, h: '#c25b6b', l: '#e2868c', d: '#8a3a48', f: '#f3d0c0', w: '#ece0c8', W: '#c9b48c' },
}

/** Greenvial: a flask of plant potion, a sprout from its cork, spores glowing in it. */
export const GREENVIAL: CompanyLogo & { color: string; name: string } = {
  name: 'Greenvial',
  color: '#2fa58a',
  rows: [
    '.........oo.....',
    '.......oogGo....',
    '......ogGGoo....',
    '.....oocco......',
    '......oCco......',
    '......oqvo......',
    '.....oqvvqo.....',
    '....oqxvvvqo....',
    '...oqlhhhhhqo...',
    '..oqlhhhshhhdo..',
    '..olhhhhhhhhdo..',
    '..ohhshhhhhhdo..',
    '..ohhhhhhhshdo..',
    '...ohhhhhhhdo...',
    '....oddddddo....',
    '.....oooooo.....',
  ],
  palette: { o: O, G: '#276740', g: '#38b251', c: '#a38250', C: '#866353', q: '#d8efe6', v: '#24423c', h: '#2fa58a', l: '#7fe0c4', d: '#1d6e5c', s: '#d8ff7a', x: '#fffce7' },
}

/** How each would dress at standing 10 (a proposal for its kit's taste). */
const DRESSED: Record<'bb' | 'gv', StandardLook> = {
  // A hide stretched and cut ragged, barred like a smokehouse rack, edged in bronze.
  bb: { cut: 'wave', pattern: 'barry', tincture2: 'wine', charge: 'none', trim: 'bronze' },
  // A glasshouse's panes, a scalloped hem like leaves, edged in verdigris.
  gv: { cut: 'scallop', pattern: 'checky', tincture2: 'forest', charge: 'none', trim: 'verdigris' },
}

export function proposalSections(k: Kit): ReactNode[] {
  const out: ReactNode[] = []
  const logoCell = (label: string, logo: CompanyLogo, s: number, key: string) => k.cell(label, k.canvasNode(k.blit(logo.rows, logo.palette, s), key), key)
  const both = [
    ['bb', BUTCHERBLOCK],
    ['gv', GREENVIAL],
  ] as const
  for (const [id, p] of both) {
    out.push(
      k.sec(
        `proposal-${id}`,
        `${p.name} — proposed crest and standard`,
        h(
          'div',
          null,
          k.ground('wood', logoCell('1×', p, 1, `${id}1`), logoCell('2×', p, 2, `${id}2`), logoCell('4×', p, 4, `${id}4`), logoCell('8×', p, 8, `${id}8`)),
          k.ground('paper', logoCell('2×', p, 2, `${id}p2`)),
          k.ground(
            'grass',
            k.cell('standard 2 px', k.canvasNode(k.blit(standardRowsFor(p, DEFAULT_STANDARD), standardPaletteFor(p, p.color, DEFAULT_STANDARD), 2), `${id}s2`), `${id}s2`),
            k.cell('4×', k.canvasNode(k.blit(standardRowsFor(p, DEFAULT_STANDARD), standardPaletteFor(p, p.color, DEFAULT_STANDARD), 4), `${id}s4`), `${id}s4`),
            k.cell('dressed, 4×', k.canvasNode(k.blit(standardRowsFor(p, DRESSED[id]), standardPaletteFor(p, p.color, DRESSED[id]), 4), `${id}d4`), `${id}d4`),
          ),
        ),
      ),
    )
  }
  // The family as it would be: Butcherblock in Easel House's slot, Greenvial in Moonquill's.
  const family: (CompanyLogo & { color: string })[] = COMPANY_IDS.map((c: CompanyId) =>
    c === 'art' ? BUTCHERBLOCK : c === 'scrolls' ? GREENVIAL : { ...COMPANY_LOGOS[c], color: companyById(c).color },
  )
  out.push(
    k.sec(
      'proposal-family',
      'The five as they would be (Peppercorn, Butcherblock, Ironvein, Rosethread, Greenvial)',
      h(
        'div',
        null,
        ...[1, 2, 4].map((s) => k.ground('wood', ...family.map((f, i) => logoCell(`${s}×`, f, s, `f${s}${i}`)))),
        k.ground('grass', ...family.map((f, i) => k.cell('', k.canvasNode(k.blit(standardRowsFor(f, DEFAULT_STANDARD), standardPaletteFor(f, f.color, DEFAULT_STANDARD), 2), `fs${i}`), `fs${i}`))),
      ),
    ),
  )
  return out
}
