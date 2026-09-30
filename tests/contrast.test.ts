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

  it('--dim (disabled, unaffordable) still reads at 4.5:1 on the rows it dims', () => {
    const dim = hex(token('dim'))
    for (const g of ['bg', 'panel', 'panel-2'] as const) {
      expect(ratio(dim, grounds[g]), `--dim on ${g}`).toBeGreaterThanOrEqual(4.5)
    }
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
