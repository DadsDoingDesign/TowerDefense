import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { nodeMeta, type NodeType } from '../src/game/data/runmap'
import { NODE_TEXT } from '../src/ui/channels'
import { highContrast, parseColor, THEME_IDS, UI_THEMES, type ThemeToken } from '../src/ui/theme/companyThemes'

/*
 * The map preview's head names the focused node in a colour (`NODE_TEXT`,
 * else the node's mark colour). The designer, Oct 2026: "The red font on brown
 * doesn't seem accessible" — the act boss's red was 2.5:1. Every node's name
 * must clear 4.5:1 on every ground the shell paints, in every theme and in
 * high contrast.
 */

const ROOT = resolve(import.meta.dirname, '..')
const css = readFileSync(join(ROOT, 'src/styles/global.css'), 'utf8')
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('\n}', css.indexOf(':root {')))
const rootToken = (name: string): string => {
  const m = rootBlock.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!m) throw new Error(`--${name} is not defined in the default :root`)
  return m[1].trim()
}

type RGB = [number, number, number]
const rgb = (c: string): RGB => {
  const x = parseColor(c)
  return [x.r, x.g, x.b]
}
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

const TYPES: NodeType[] = ['start', 'battle', 'elite', 'merchant', 'shrine', 'campfire', 'miniboss', 'boss']
const GROUNDS = ['bg', 'bg-2', 'panel', 'panel-2', 'panel-3'] as const

/** A colour as a theme resolves it: a `var(--x)` reads the theme's token, else the house :root's. */
const resolveIn = (c: string, tokens: Partial<Record<ThemeToken, string>>): string => {
  const m = c.match(/^var\(--([a-z0-9-]+)\)$/)
  if (!m) return c
  return (tokens as Record<string, string>)[m[1]] ?? rootToken(m[1])
}

describe('the map preview names every node legibly', () => {
  for (const [label, hc] of [
    ['', false],
    [' (high contrast)', true],
  ] as const) {
    for (const id of THEME_IDS) {
      it(`${id}${label}: every node's name clears 4.5:1 on every ground`, () => {
        const t = UI_THEMES[id]
        const tokens = hc ? { ...t.tokens, ...highContrast(t) } : t.tokens
        for (const type of TYPES) {
          const fg = rgb(resolveIn(NODE_TEXT[type] ?? nodeMeta(type).color, tokens))
          for (const g of GROUNDS)
            expect(ratio(fg, rgb(tokens[g] as string)), `${id} ${type} on --${g}`).toBeGreaterThanOrEqual(4.5)
        }
      })
    }
  }
})
