/**
 * Small pixel shapes for the trade layer — crates, the coin, a lantern, the
 * sealed skill scroll and the caravan's wagon — as rows of palette letters
 * (`.` is clear). Drawn by the UI as crisp SVG (`ui/pixel.tsx`) and by the
 * battle canvas (`render/caravan.ts`), so both agree on every pixel.
 *
 * Original art in the Tiny Swords style (the approved night-lantern mockups,
 * `trade/r3/lib.js`): flat fills inside the 1px `#161c2e` outline every Tiny
 * Swords sprite carries. Nothing here is imported from any pack.
 */
export type PixelRows = readonly string[]
export type Palette = Readonly<Record<string, string>>

/** The Tiny Swords silhouette ink. */
export const OUTLINE = '#161c2e'

/** A cargo crate, 14 × 11: a wooden box banded in its company's colour. */
export const CRATE: PixelRows = [
  '.oooooooooooo.',
  'owwwwwwwwwwwwo',
  'owbwwwwwwwwbwo',
  'owwbwwwwwwbwwo',
  'occccccccccccо'.replace('о', 'o'),
  'oCCCCCCCCCCCCo',
  'owwwwbwwbwwwwo',
  'owwwwwbbwwwwwo',
  'owwwwbwwbwwwwo',
  'oWWWWWWWWWWWWo',
  '.oooooooooooo.',
]

/** Darken (t < 0) or lighten (t > 0) a hex colour toward black / white. */
export function shade(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t))
  return `#${ch.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`
}

export const cratePalette = (band: string): Palette => ({ o: OUTLINE, w: '#a8703a', b: '#6b4526', c: band, C: shade(band, -0.3), W: '#7d5230' })
/** An empty crate slot: the outline only, in the ladder's muted wood. */
export const GHOST_CRATE: Palette = { o: '#6a5738', b: '#6a5738' }

/** The coin — gold is the only currency. 7 × 7. */
export const COIN: PixelRows = ['.ooooo.', 'oyyyyyo', 'oywyyYo', 'oyyyyYo', 'oyyyyYo', 'oyYYYYo', '.ooooo.']
export const COIN_PALETTE: Palette = { o: OUTLINE, y: '#f0c03a', Y: '#c48a1e', w: '#fff3b0' }

/** A city lantern on the route rail: lit once the city is reached. 6 × 6. */
export const LANTERN: PixelRows = ['..oo..', '.oooo.', 'oyyyyo', 'oywyyo', 'oyyyyo', '.oooo.']
export const lanternPalette = (lit: boolean): Palette => ({ o: OUTLINE, y: lit ? '#f5c451' : '#4a3a26', w: lit ? '#fff3c0' : '#5a4830' })

/** A padlock: something that opens later (a crate past the standing cap, a company not hiring yet). 8 × 9. */
export const LOCK: PixelRows = ['..oooo..', '.oo..oo.', '.o....o.', 'oooooooo', 'occcccco', 'occoocco', 'occoocco', 'occcccco', 'oooooooo']
export const LOCK_PALETTE: Palette = { o: OUTLINE, c: '#c9b48c' }

/** A short sword — an item chance on a receipt. 10 × 10. */
export const SWORD: PixelRows = ['........oo', '.......oso', '......oso.', '.....oso..', '.o..oso...', '.oooso....', '..oho.....', '.ohoo.....', 'oho.o.....', 'oo........']
export const SWORD_PALETTE: Palette = { o: OUTLINE, s: '#d8dce6', h: '#a8703a' }

/** A sealed scroll: a skill not yet shown. 12 × 12. */
export const SCROLL: PixelRows = [
  '.oooooooooo.',
  'osssssssssso',
  '.oppppppppo.',
  '.oppppppppo.',
  '.opphhhhppo.',
  '.oppppppppo.',
  '.opphhhpppo.',
  '.oppppppppo.',
  '.oppprrpppo.',
  'osssrrrssso',
  '.oooorroooo.',
  '.....oo.....',
]
export const SCROLL_PALETTE: Palette = { o: OUTLINE, s: '#a8703a', p: '#ece0c8', h: '#8a7656', r: '#c25a3a' }
/** The same scroll as a flat silhouette (a locked unlock). */
export const silhouette = (c: string): Palette => ({ o: c, s: c, p: c, h: c, r: c })

/**
 * The caravan's wagon, 30 × 13: a wooden bed on two wheels with a hitch, no
 * load. The battle draws crates on top of it (one per filled cargo share).
 */
export const WAGON: PixelRows = [
  '......oooooooooooooooooooooooo',
  '......owwwwwwwwwwwwwwwwwwwwwwo',
  'ooooooobbbbbbbbbbbbbbbbbbbbbbo',
  '......oooooooooooooooooooooooo',
  '.........ooooo........ooooo...',
  '........otttttto.....otttttto.',
  '........ottoootto....ottoootto',
  '........otoaaaoto....otoaaaoto',
  '........ottoootto....ottoootto',
  '........otttttto.....otttttto.',
  '.........ooooo........ooooo...',
  '..............................',
  '..............................',
]
export const WAGON_PALETTE: Palette = { o: OUTLINE, w: '#a8703a', b: '#6b4526', t: '#7d5230', a: '#c9b48c' }

/** Each filled cell of `rows`, merged into horizontal runs (for SVG or a canvas). */
export function pixelRuns(rows: PixelRows, pal: Palette): { x: number; y: number; w: number; fill: string }[] {
  const out: { x: number; y: number; w: number; fill: string }[] = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      const fill = pal[ch]
      if (ch === '.' || !fill) {
        x++
        continue
      }
      let x2 = x
      while (x2 < row.length && row[x2] === ch) x2++
      out.push({ x, y, w: x2 - x, fill })
      x = x2
    }
  })
  return out
}
