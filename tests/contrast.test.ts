import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * Text-token contrast, held as a test (Whales UI plan R1, 2026-09-29).
 *
 * The shell's muted ramp has been tuned by hand twice (M27e, then R1), each
 * time after a real render showed 11px labels under AA. This pins the ramp
 * against every ground the shell paints — including the translucent parchment
 * washes composited over the panel they sit on, which is where the old
 * `--muted-2` fell to 3.56:1 — so the next palette tweak cannot quietly undo it.
 */

const ROOT = resolve(import.meta.dirname, '..')
const css = readFileSync(join(ROOT, 'src/styles/global.css'), 'utf8')

/** The first `:root { … }` block — the default palette. */
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('\n}', css.indexOf(':root {')))
const token = (name: string): string => {
  const m = rootBlock.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!m) throw new Error(`--${name} is not defined in the default :root`)
  return m[1].trim()
}

type RGB = [number, number, number]
const hex = (h: string): RGB => {
  const v = h.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as RGB
}
const rgba = (s: string): { rgb: RGB; a: number } => {
  const m = s.match(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/)
  if (!m) throw new Error(`not an rgba(): ${s}`)
  return { rgb: [+m[1], +m[2], +m[3]], a: +m[4] }
}
const over = (fg: { rgb: RGB; a: number }, bg: RGB): RGB =>
  fg.rgb.map((c, i) => Math.round(c * fg.a + bg[i] * (1 - fg.a))) as RGB
const lum = ([r, g, b]: RGB) => {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const ratio = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const panel = hex(token('panel'))
const panel2 = hex(token('panel-2'))
const grounds: Record<string, RGB> = {
  bg: hex(token('bg')),
  'bg-2': hex(token('bg-2')),
  panel,
  'panel-2': panel2,
  'panel-3': hex(token('panel-3')),
  'surface over panel': over(rgba(token('surface')), panel),
  'surface-strong over panel-2': over(rgba(token('surface-strong')), panel2),
  'surface twice over panel': over(rgba(token('surface')), over(rgba(token('surface')), panel)),
}

describe('text tokens clear WCAG AA on every ground the shell paints', () => {
  for (const name of ['text', 'muted', 'muted-2', 'accent']) {
    it(`--${name} >= 4.5:1`, () => {
      const fg = hex(token(name))
      for (const [g, bg] of Object.entries(grounds)) {
        expect(ratio(fg, bg), `--${name} on ${g}`).toBeGreaterThanOrEqual(4.5)
      }
    })
  }

  // The lower bands' gold and muted text, on the lightest wash measured there
  // (the wave strip, round-2 re-check).
  it('--accent-text and --muted clear 4.5:1 on the strongest wash', () => {
    for (const name of ['accent-text', 'muted']) {
      expect(ratio(hex(token(name)), grounds['surface-strong over panel-2']), `--${name}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('--dim (disabled, unaffordable) still reads at 4.5:1 on the rows it dims', () => {
    const dim = hex(token('dim'))
    for (const g of ['bg', 'panel', 'panel-2'] as const) {
      expect(ratio(dim, grounds[g]), `--dim on ${g}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  // Oct 2026 audit, 3.1: rarity as TEXT (an item's name, the rarity word, the
  // doll's letter) read the fill ramp and fell to 3.09-4.38:1. Every text step
  // must clear 5:1 on `--panel-3` (the selected card) and on the strongest
  // wash, in the default palette and in both colour-vision ramps.
  const RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic'] as const
  const STRONG = grounds['surface-strong over panel-2']
  /** The `--name` value inside a later `:root[data-…]` block that names `selector`. */
  const blockToken = (selector: string, name: string): string => {
    const at = css.indexOf(selector)
    if (at < 0) throw new Error(`${selector} not found in global.css`)
    const body = css.slice(at, css.indexOf('\n}', at))
    const m = body.match(new RegExp(`--${name}:\\s*([^;]+);`))
    if (!m) throw new Error(`--${name} is not defined under ${selector}`)
    return m[1].trim()
  }
  const palettes: Record<string, (name: string) => string> = {
    default: token,
    'deuter/protan': (n) => blockToken(":root[data-vision='protan'] {", n),
    tritan: (n) => blockToken(":root[data-vision='tritan'] {", n),
  }
  for (const [pal, read] of Object.entries(palettes)) {
    it(`--rarity-*-text clear 5:1 on --panel-3 and the strong wash (${pal})`, () => {
      for (const r of RARITIES) {
        const fg = hex(read(`rarity-${r}-text`))
        expect(ratio(fg, grounds['panel-3']), `--rarity-${r}-text on panel-3 (${pal})`).toBeGreaterThanOrEqual(5)
        expect(ratio(fg, STRONG), `--rarity-${r}-text on the strong wash (${pal})`).toBeGreaterThanOrEqual(5)
      }
    })
  }

  it('--teal-text clears 4.5:1 on --panel-3 and the strong wash; --teal (a fill) 3:1', () => {
    for (const g of [grounds['panel-3'], STRONG]) {
      expect(ratio(hex(token('teal-text')), g)).toBeGreaterThanOrEqual(4.5)
      expect(ratio(hex(token('teal')), g)).toBeGreaterThanOrEqual(3)
    }
  })

  // `--dim` marks a control that is not available now. WCAG 1.4.3 exempts an
  // inactive control's text, but the price on an unaffordable row is still
  // read to decide whether to save, so it holds AA on every opaque panel; on
  // the strongest wash (a disabled chip at most) the large-text 3:1 floor.
  it('--dim holds 4.5:1 on --panel-3 and 3:1 on the strong wash', () => {
    expect(ratio(hex(token('dim')), grounds['panel-3'])).toBeGreaterThanOrEqual(4.5)
    expect(ratio(hex(token('dim')), STRONG)).toBeGreaterThanOrEqual(3)
  })

  it('the muted ramp keeps its order: text > muted > muted-2 > dim', () => {
    const l = (n: string) => lum(hex(token(n)))
    expect(l('text')).toBeGreaterThan(l('muted'))
    expect(l('muted')).toBeGreaterThan(l('muted-2'))
    expect(l('muted-2')).toBeGreaterThan(l('dim'))
  })

  it('the primary button ink stays at 4.5:1 on its fill', () => {
    expect(ratio(hex(token('cta-ink')), hex(token('cta')))).toBeGreaterThanOrEqual(4.5)
  })

  // A1-2: the primary is a control, so its FILL must also separate from the
  // grounds it sits on (WCAG 1.4.11, 3:1). The old deep teal was 3.08 on --bg.
  it('the primary button fill stands off every ground at 4.5:1', () => {
    for (const g of ['bg', 'bg-2', 'panel', 'panel-2'] as const) {
      expect(ratio(hex(token('cta')), grounds[g]), `--cta on ${g}`).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('icon size tokens are whole multiples of the 16px sprite', () => {
  it.each(['icon-sm', 'icon-md', 'icon-lg'])('--%s', (name) => {
    const px = parseFloat(token(name))
    expect(px % 16).toBe(0)
  })
})

/*
 * The menu over the trade map (the mercenary company, build step 4). The map
 * moves, glows and differs with every save's standing, so the menu's text is
 * held against PURE WHITE under its panels and washes — the brightest ground
 * any frame of any map could put there — rather than against one render.
 */
describe('the menu over the trade map', () => {
  const menuCss = readFileSync(join(ROOT, 'src/styles/menu.css'), 'utf8')
  const WHITE: RGB = [255, 255, 255]
  const ruleBg = (selector: string): { rgb: RGB; a: number } => {
    const at = menuCss.indexOf(`${selector} {`)
    if (at < 0) throw new Error(`${selector} not found in menu.css`)
    const body = menuCss.slice(at, menuCss.indexOf('}', at))
    const m = body.match(/background:\s*(rgba\([^)]*\))/)
    if (!m) throw new Error(`${selector} has no rgba background`)
    return rgba(m[1])
  }

  it('the tiles clear 4.5:1 over pure white', () => {
    const tile = over(ruleBg('.mn-tile'), WHITE)
    for (const name of ['text', 'muted']) expect(ratio(hex(token(name)), tile), `--${name} on a tile`).toBeGreaterThanOrEqual(4.5)
  })

  it('the road labels clear 4.5:1 over pure white', () => {
    const pill = over(ruleBg('.tm-pill::after'), WHITE)
    for (const name of ['text', 'muted', 'accent-text']) expect(ratio(hex(token(name)), pill), `--${name} on a label`).toBeGreaterThanOrEqual(4.5)
  })

  it('the charter line clears 4.5:1 over pure white', () => {
    const line = over(ruleBg('.mn-charter'), WHITE)
    for (const name of ['text', 'muted']) expect(ratio(hex(token(name)), line), `--${name} on the charter line`).toBeGreaterThanOrEqual(4.5)
  })

  it('the tagline clears 4.5:1 and the wordmark 3:1 (large) under the head wash over pure white', () => {
    const m = menuCss.match(/\.mn-head \{[^}]*rgba\((\d+), (\d+), (\d+), ([\d.]+)\) (\d+)%/)
    if (!m) throw new Error('the head wash was not found')
    const wash = over({ rgb: [+m[1], +m[2], +m[3]], a: +m[4] }, WHITE)
    expect(ratio(hex(token('text')), wash)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(hex(token('accent')), wash)).toBeGreaterThanOrEqual(3)
    // The wash holds solid past the tagline (it ends ~95px into a ~150px head).
    expect(+m[5]).toBeGreaterThanOrEqual(64)
  })
})
