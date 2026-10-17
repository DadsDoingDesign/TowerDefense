/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { BODY_INK, BODY_KEYS, dressFrame, dressedStrip, isBodyKey, torsosFor, TUNIC_DARK, TUNIC_MID, type BodyKey } from '../src/game/render/bodyLayer'
import { BODY_TORSOS } from '../src/game/render/bodyAnchors.generated'
import { heroGear } from '../src/game/render/gearMarks'
import { iconCell } from '../src/game/data/iconAtlas'
import { ANIM_FRAMES } from '../src/game/render/anim'
import { bodyFitProblems, measureTorsos, TORSO_PACKS } from '../scripts/anchors-lib'
import { createHero } from '../src/game/data/sentinels'
import { ITEM_KINDS } from '../src/game/data/itemKinds'
import type { Item } from '../src/game/types'

/*
 * The body piece, worn on the field (`bodyLayer.ts`). Like `attackLook.test`,
 * these read the REAL Tiny Swords strips: every piece must change the figure
 * on every frame of every look, an empty slot must change nothing, and
 * nothing may be drawn outside the hero's own cell.
 */

const ROOT = join(__dirname, '..')
const STRIPS = TORSO_PACKS.tinyswords

async function rawStrip(name: string) {
  const { data, info } = await sharp(readFileSync(join(ROOT, 'public/assets/sprites/tinyswords', `${name}.png`)))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { px: new Uint8Array(data), w: info.width, h: info.height, frames: ANIM_FRAMES[name] }
}

let n = 0
const item = (name: string, slot: Item['slot']): Item => ({ id: `b${n++}`, name, slot, rarity: 'rare', base: {}, enchantments: [] })
const BODIES = ITEM_KINDS.filter((k) => k.slot === 'body').map((k) => k.id)

describe('the body piece a hero wears', () => {
  it('names every body kind the game deals, each its own icon cell', () => {
    expect(BODIES).toHaveLength(7)
    const keys = BODIES.map((kind) => heroGear(createHero({ equipment: { mainHand: null, offHand: null, body: item(kind, 'body') } }).equipment).body)
    expect(keys.every(isBodyKey)).toBe(true)
    expect(new Set(keys).size).toBe(7)
    expect([...keys].sort()).toEqual([...BODY_KEYS].sort())
    expect(heroGear(createHero({ equipment: { mainHand: null, offHand: null, body: null } }).equipment).body).toBe(null)
  })

  it('an empty body slot leaves the strip itself — the very object, so the bake is what it was', () => {
    const src = { width: 504, height: 95 } as unknown as HTMLCanvasElement
    expect(dressedStrip(src, 'tinyswords', 'fighter_idle', 6, null)).toBe(src)
    // An unmeasured pack is never dressed either.
    expect(torsosFor('fieldwatch', 'fighter_idle')).toBe(null)
    expect(dressedStrip(src, 'fieldwatch', 'fighter_idle', 6, 'plate')).toBe(src)
  })

  it('wears only colours its own icon cell uses, so the tile and the figure agree', async () => {
    const { data, info } = await sharp(readFileSync(join(ROOT, 'public/assets/ui/fw-icons.png'))).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (const key of BODY_KEYS) {
      const { ix, iy } = iconCell(key)
      const cell = new Set<string>()
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const o = ((iy * 16 + y) * info.width + ix * 16 + x) * 4
          if (data[o + 3] > 0) cell.add('#' + [data[o], data[o + 1], data[o + 2]].map((v) => v.toString(16).padStart(2, '0')).join(''))
        }
      for (const [role, hex] of Object.entries(BODY_INK[key])) expect(cell.has(hex), `${key}.${role} ${hex}`).toBe(true)
    }
  })
})

describe('the torso, measured off the art', () => {
  it('is generated from the strips on disk (`npm run anchors`)', async () => {
    for (const name of STRIPS) {
      const s = await rawStrip(name)
      const { torsos, errors } = measureTorsos(s.px, s.w, s.h, s.frames)
      expect(errors, name).toEqual([])
      expect(torsos, name).toEqual(BODY_TORSOS.tinyswords[name])
    }
  })

  it('finds the tunic: its inks, under the head, above the feet, in every frame', async () => {
    for (const name of STRIPS) {
      const s = await rawStrip(name)
      const cw = s.w / s.frames
      BODY_TORSOS.tinyswords[name].forEach((t, f) => {
        let tunic = 0
        for (let i = 0; i < t.spans.length; i += 3)
          for (let x = t.spans[i + 1]; x <= t.spans[i + 2]; x++) {
            const o = (t.spans[i] * s.w + f * cw + x) * 4
            const c = (s.px[o] << 16) | (s.px[o + 1] << 8) | s.px[o + 2]
            if (c === TUNIC_MID || c === TUNIC_DARK) tunic++
          }
        expect(tunic, `${name} ${f}`).toBeGreaterThanOrEqual(100)
        expect(t.y0, `${name} ${f}`).toBeGreaterThan(s.h * 0.35)
        expect(t.feet, `${name} ${f}`).toBeGreaterThan(t.y1)
      })
    }
  })
})

describe('dressing the real strips', () => {
  it('every piece changes every frame of every look, and paints nothing outside the cell', async () => {
    for (const name of STRIPS) {
      const s = await rawStrip(name)
      const cw = s.w / s.frames
      expect(bodyFitProblems(name, s.px, s.w, s.h, BODY_TORSOS.tinyswords[name])).toEqual([])
      for (const key of BODY_KEYS) {
        for (let f = 0; f < s.frames; f++) {
          const px = new Uint8Array(s.px)
          const r = dressFrame(px, s.w, s.h, f * cw, cw, BODY_TORSOS.tinyswords[name][f], key, f, s.frames)
          expect(r.overflow, `${key} on ${name} ${f}`).toBe(0)
          expect(r.changed, `${key} on ${name} ${f}`).toBeGreaterThanOrEqual(80)
          // Not a pixel of any other frame moved.
          let outside = 0
          for (let y = 0; y < s.h; y++)
            for (let x = 0; x < s.w; x++) {
              if (x >= f * cw && x < (f + 1) * cw) continue
              const o = (y * s.w + x) * 4
              if (px[o] !== s.px[o] || px[o + 1] !== s.px[o + 1] || px[o + 2] !== s.px[o + 2] || px[o + 3] !== s.px[o + 3]) outside++
            }
          expect(outside, `${key} on ${name} ${f}`).toBe(0)
        }
      }
    }
  })

  it('keeps the outline the art drew round the tunic', async () => {
    for (const name of STRIPS) {
      const s = await rawStrip(name)
      const cw = s.w / s.frames
      const t = BODY_TORSOS.tinyswords[name][0]
      for (const key of BODY_KEYS) {
        const px = new Uint8Array(s.px)
        dressFrame(px, s.w, s.h, 0, cw, t, key, 0, s.frames)
        for (let i = 0; i < t.spans.length; i += 3)
          for (let x = t.spans[i + 1]; x <= t.spans[i + 2]; x++) {
            const o = (t.spans[i] * s.w + x) * 4
            const ink = s.px[o] === 0x16 && s.px[o + 1] === 0x1c && s.px[o + 2] === 0x2e
            if (ink) expect([px[o], px[o + 1], px[o + 2]], `${key} on ${name}`).toEqual([0x16, 0x1c, 0x2e])
          }
      }
    }
  })

  it('no two pieces dress a figure alike', async () => {
    for (const name of STRIPS) {
      const s = await rawStrip(name)
      const cw = s.w / s.frames
      const looks = new Map<string, BodyKey>()
      for (const key of BODY_KEYS) {
        const px = new Uint8Array(s.px)
        dressFrame(px, s.w, s.h, 0, cw, BODY_TORSOS.tinyswords[name][0], key, 0, s.frames)
        const sig = Buffer.from(px).toString('base64')
        expect(looks.get(sig), `${key} looks like ${looks.get(sig)} on ${name}`).toBeUndefined()
        looks.set(sig, key)
      }
    }
  })
})
