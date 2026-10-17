import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/*
 * Every hero portrait is cut from the battlefield figure (`render/heroPortrait`)
 * through ONE function, `offers.heroLookArt`, so a portrait cannot drift from
 * the figure: it shows the real weapon, off hand and body piece. The painted
 * still (`heroArt`) is only that function's fallback while the art loads, and
 * the HQ's hiring-deal illustration (look silhouettes, not heroes).
 */

const UI = join(__dirname, '..', 'src', 'ui')
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|ts)$/.test(n) ? [p] : []
  })

describe('hero portraits come from the figure', () => {
  it('heroLookArt is the portrait cut from the figure, the still only its fallback', () => {
    const src = readFileSync(join(UI, 'shell', 'offers.ts'), 'utf8')
    expect(src).toMatch(/export const heroLookArt = \(h: Pick<Sentinel, 'equipment'>\): string => heroPortraitUrl\(h\) \?\? heroArt\(lookOf\(h\)\)/)
  })

  it('no hero image anywhere reads the painted still directly', () => {
    const allowed = new Set(['shell/offers.ts', 'shell/hq/HqScreen.tsx'])
    const offenders = files(UI)
      .filter((f) => /\bheroArt\(|sprites\/tinyswords\/(fighter|rogue|mystic)/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(UI, f))
      .filter((f) => !allowed.has(f))
    expect(offenders).toEqual([])
  })

  it('the shell re-renders when a portrait becomes drawable', () => {
    const src = readFileSync(join(UI, 'shell', 'RootShell.tsx'), 'utf8')
    expect(src).toContain('useSyncExternalStore(onPortraitChange, portraitVersion)')
  })
})
