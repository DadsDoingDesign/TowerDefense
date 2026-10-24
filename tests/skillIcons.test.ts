import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { FUSIONS } from '../src/game/data/fusions'
import { ICON_ORDER, iconCell } from '../src/game/data/iconAtlas'
import { INFUSIONS } from '../src/game/data/infusions'
import { INK, MOTIFS, SKILL_ART, SKILL_PALETTE, skillArtKey, TAG_RAMP } from '../src/game/data/skillArt'
import { NAMED_ART } from '../src/game/data/skillArtNamed'
import { composeRecipe, ICON_N, iconRecipe, mergeLayers, skillIconKey, skillIconPixels } from '../src/game/data/skillIcons'
import { ALL_SKILLS, mergeId, skillById } from '../src/game/data/skills'

/**
 * The skill art (Oct 2026, the merge art pass): every library skill's own
 * picture, the composer that makes the 2,450 plain merges from them, and the
 * twenty hand-drawn named merges.
 */
const ROOT = join(__dirname, '..')
const N = ICON_N
const LIB = ALL_SKILLS.map((k) => k.id)
/** Every ordered pair of library skills: [base, card, what the drop makes]. */
const ORDERS: [string, string, string][] = LIB.flatMap((a) => LIB.filter((b) => b !== a).map((b) => [a, b, mergeId(a, b)!] as [string, string, string]))
/** The plain merges among them (13 orders are tier-1 named merges, drawn by hand). */
const PAIRS = ORDERS.filter((o) => o[2].startsWith('mx.'))

const px = (id: string) => {
  const p = skillIconPixels(id)
  if (!p) throw new Error(`no picture for ${id}`)
  return p
}
/** How many of the 256 pixels two pictures disagree on. */
const differing = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
  let n = 0
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) n++
  return n
}
const hexOf = (p: Uint8ClampedArray, i: number) => '#' + [p[i], p[i + 1], p[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')
const MARK = new Set(['#ffed44', '#d08c41'])
const isCorner = (x: number, y: number) => y >= N - 3 && (x <= 2 || x >= N - 3)

describe('the library pictures', () => {
  it('draws every library skill, and only them, on a 16 × 16 grid with a free border', () => {
    expect(Object.keys(SKILL_ART).sort()).toEqual([...LIB].sort())
    for (const [id, art] of Object.entries(SKILL_ART)) {
      expect(art, id).toHaveLength(N)
      art.forEach((row, y) => {
        expect(row, `${id} row ${y}`).toHaveLength(N)
        ;[...row].forEach((c, x) => {
          if (c === '.') return
          expect('123'.includes(c) || !!SKILL_PALETTE[c], `${id} (${x},${y}) '${c}'`).toBe(true)
          expect(x > 0 && y > 0 && x < N - 1 && y < N - 1, `${id} (${x},${y}) touches the border`).toBe(true)
        })
      })
      // The element is IN the drawing: its key pixels are a real part of it, so a merge's swap shows.
      const keyed = art.join('').split('').filter((c) => '123'.includes(c)).length
      expect(keyed, id).toBeGreaterThanOrEqual(8)
    }
  })

  it('gives every library skill a picture of its own (no two share one, none is a near copy)', () => {
    for (let a = 0; a < LIB.length; a++)
      for (let b = a + 1; b < LIB.length; b++) expect(differing(px(LIB[a]), px(LIB[b])), `${LIB[a]} ~ ${LIB[b]}`).toBeGreaterThanOrEqual(40)
  })

  it('bakes each into its own atlas cell, pixel for pixel the composer’s', async () => {
    const { data, info } = await sharp(readFileSync(join(ROOT, 'public/assets/ui/fw-icons.png'))).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (const id of [...LIB, ...FUSIONS.map((f) => f.id)]) {
      const key = skillArtKey(id)
      expect(ICON_ORDER as readonly string[], id).toContain(key)
      expect(skillIconKey(id), id).toBe(key)
      const { ix, iy } = iconCell(key as (typeof ICON_ORDER)[number])
      const cell = new Uint8ClampedArray(N * N * 4)
      for (let y = 0; y < N; y++) for (let x = 0; x < N * 4; x++) cell[y * N * 4 + x] = data[((iy * N + y) * info.width + ix * N) * 4 + x]
      expect(differing(cell, px(id)), id).toBe(0)
    }
  })
})

describe('the composer', () => {
  it('is deterministic: the same id always gives the same pixels', () => {
    for (const [, , id] of PAIRS.slice(0, 200)) expect(differing(composeRecipe(iconRecipe(id)!), px(id)), id).toBe(0)
    expect(differing(composeRecipe(iconRecipe('arc_spark')!), composeRecipe(iconRecipe('arc_spark')!))).toBe(0)
  })

  it('composes every one of the 2,450 ordered pairs, unlike its base, its card and its reverse', () => {
    expect(ORDERS).toHaveLength(2450)
    for (const [, , id] of ORDERS) expect(skillIconPixels(id), id).not.toBeNull()
    expect(PAIRS).toHaveLength(2450 - FUSIONS.filter((f) => f.tier === 1).length)
    const seen = new Map<string, string>()
    let least = 256
    for (const [a, b, id] of PAIRS) {
      const m = px(id)
      // The base still leads, but the merge is visibly not the base …
      expect(differing(m, px(a)), `${id} vs its base`).toBeGreaterThanOrEqual(4)
      // … and A onto B is never B onto A: another drawing AND another motif.
      const d = differing(m, px(mergeId(b, a)!))
      expect(differing(m, px(b)), `${id} vs its card`).toBeGreaterThanOrEqual(24)
      least = Math.min(least, d)
      expect(d, `${id} vs its reverse`).toBeGreaterThanOrEqual(24)
      const r = iconRecipe(id)!
      expect(r.art, id).toBe(SKILL_ART[a])
      expect(r.ramp, id).toBe(TAG_RAMP[INFUSIONS[b].tag])
      expect(r.motifs, id).toEqual([INFUSIONS[b].tag])
      seen.set(Buffer.from(m).toString('base64'), id)
    }
    expect(least).toBeGreaterThanOrEqual(24)
    // Two cards of one tag pour the same colour and motif: the name says which (the weak spot, measured).
    expect(seen.size).toBeGreaterThan(LIB.length * 14)
  })

  it('keeps the one navy ink closed round every picture (library, named, every merge)', () => {
    const ids = [...LIB, ...FUSIONS.map((f) => f.id), ...PAIRS.map((p) => p[2])]
    for (const id of ids) {
      const p = px(id)
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const i = (y * N + x) * 4
          if (!p[i + 3]) continue
          const hex = hexOf(p, i)
          if (hex === INK || (isCorner(x, y) && MARK.has(hex))) continue
          // A coloured pixel never meets the empty: the ink always comes between.
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue
            expect(p[(ny * N + nx) * 4 + 3], `${id} (${x},${y}) is not inked`).toBe(255)
          }
        }
    }
  })

  it('lays each motif on its fixed place, inside the cell', () => {
    for (const [tag, m] of Object.entries(MOTIFS)) {
      if (m.place === 'rim') continue
      const lit = m.art.join('').split('').filter((c) => c !== '.').length
      expect(lit, tag).toBeGreaterThanOrEqual(4)
      expect(lit, tag).toBeLessThanOrEqual(10)
      m.art.forEach((row, dy) => [...row].forEach((c, dx) => c !== '.' && expect(m.at[0] + dx >= 1 && m.at[0] + dx <= N - 2 && m.at[1] + dy >= 1 && m.at[1] + dy <= N - 2, tag).toBe(true)))
    }
  })

  it('composes deeper slots: the root’s drawing, the first card’s colour, each card’s motif', () => {
    const id = mergeId('mx.arc_spark.frostbite', 'wildfire')!
    const r = iconRecipe(id)!
    expect(r.art).toBe(SKILL_ART.arc_spark)
    expect(r.ramp).toBe(TAG_RAMP.frost)
    expect(r.motifs).toEqual(['frost', 'fire'])
    expect(differing(px(id), px('mx.arc_spark.frostbite'))).toBeGreaterThan(0)
    // Onto a named base: its own drawing, unmarked, and the card's motif.
    const on = mergeId('fz_rimecut', 'anchor')!
    expect(iconRecipe(on)!.art).toBe(NAMED_ART.fz_rimecut.art)
    expect(iconRecipe(on)!.named).toBeUndefined()
    expect(skillIconKey(on)).toBe('fzRimecut')
  })

  it('splits a merge into the fuse beat’s layers, which add up to its picture exactly', () => {
    for (const [a, , id] of PAIRS.filter((_, i) => i % 7 === 0)) {
      const l = mergeLayers(id)!
      expect(l.named).toBe(false)
      expect(differing(l.from, px(a))).toBe(0)
      const top = new Uint8ClampedArray(l.to)
      for (let i = 0; i < top.length; i += 4) if (l.fly[i + 3]) top.set(l.fly.subarray(i, i + 4), i)
      expect(differing(top, px(id)), id).toBe(0)
    }
    const f = mergeLayers('fz_rimecut')!
    expect(f.named).toBe(true)
    expect(differing(f.to, px('fz_rimecut'))).toBe(0)
    expect(differing(f.fly, px('keen_eye'))).toBe(0)
  })
})

describe('the named merges', () => {
  it('draws each of the twenty by hand, unlike any library picture, any merge of its order and each other', () => {
    expect(Object.keys(NAMED_ART).sort()).toEqual(FUSIONS.map((f) => f.id).sort())
    const all = FUSIONS.map((f) => f.id)
    for (const id of all) {
      for (const k of LIB) expect(differing(px(id), px(k)), `${id} ~ ${k}`).toBeGreaterThanOrEqual(40)
      for (const o of all) if (o !== id) expect(differing(px(id), px(o)), `${id} ~ ${o}`).toBeGreaterThanOrEqual(40)
      const [a, b] = FUSIONS.find((f) => f.id === id)!.parts
      if (skillById(a) && !a.startsWith('fz_')) expect(differing(px(id), composeRecipe(iconRecipe(`mx.${a}.${b}`) ?? iconRecipe(a)!)), id).toBeGreaterThanOrEqual(40)
    }
  })

  it('marks a named merge (gold brackets: bottom-right; a greater both bottom corners) and never a plain one', () => {
    const corner = (p: Uint8ClampedArray, x: number, y: number) => hexOf(p, (y * N + x) * 4)
    for (const f of FUSIONS) {
      const p = px(f.id)
      expect(corner(p, N - 1, N - 1), f.id).toBe('#ffed44')
      expect(corner(p, N - 2, N - 1), f.id).toBe('#ffed44')
      expect(MARK.has(corner(p, 0, N - 1)), f.id).toBe(f.tier === 2)
      expect(MARK.has(corner(p, N - 3, N - 1)), f.id).toBe(f.tier === 2)
    }
    for (const [, , id] of PAIRS) expect(MARK.has(corner(px(id), N - 1, N - 1)), id).toBe(false)
    for (const k of LIB) expect(MARK.has(corner(px(k), N - 1, N - 1)), k).toBe(false)
  })
})

describe('the colours', () => {
  it('turns every ramp in hue from light to dark, and darkens it', () => {
    const hsl = (h: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      const mx = Math.max(r, g, b)
      const mn = Math.min(r, g, b)
      const l = (mx + mn) / 2
      const d = mx - mn
      const H = d === 0 ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
      return { h: H * 60, l }
    }
    for (const [tag, ramp] of Object.entries(TAG_RAMP)) {
      const [lt, , dk] = ramp.map(hsl)
      const turn = Math.min(Math.abs(lt.h - dk.h), 360 - Math.abs(lt.h - dk.h))
      expect(turn, `${tag} turns`).toBeGreaterThanOrEqual(8)
      expect(dk.l, `${tag} darkens`).toBeLessThan(lt.l)
    }
  })

  it('uses only colours the harvested CC0 pack has (no invented hue)', async () => {
    const files: string[] = []
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (p.endsWith('.png')) files.push(p)
      }
    }
    walk(join(ROOT, 'public/assets/ui/tinyswords'))
    walk(join(ROOT, 'public/assets/sprites/tinyswords'))
    walk(join(ROOT, 'public/assets/deco'))
    walk(join(ROOT, 'public/assets/fx'))
    const pack = new Set<string>()
    for (const f of files) {
      const { data } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 250) pack.add(hexOf(data as unknown as Uint8ClampedArray, i))
    }
    // The atlas's own palette is `fw-icons.ts`'s (checked there); every colour
    // this pass ADDED — the ramps and the new fixed letters — is the pack's.
    const atlas = new Set(Object.entries(SKILL_PALETTE).filter(([k]) => 'KWSsdPpqGghTtuRrnLloEefVv'.includes(k)).map(([, h]) => h.toLowerCase()))
    const added = new Set([...Object.values(SKILL_PALETTE), ...Object.values(TAG_RAMP).flat()].map((h) => h.toLowerCase()).filter((h) => !atlas.has(h)))
    expect(added.size).toBeGreaterThan(15)
    for (const h of added) expect(pack.has(h), h).toBe(true)
  }, 30000)
})
