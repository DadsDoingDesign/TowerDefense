import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { allArt, artRGBA, isArt, PEOPLES } from '../scripts/peoples-art'
import { BODY_KEYS, dressFrame, isBodyStyle, type BodyKey, type BodyStyle } from '../src/game/render/bodyLayer'
import { BODY_TORSOS } from '../src/game/render/bodyAnchors.generated'
import { ANIM_FRAMES } from '../src/game/render/anim'
import { heroGear } from '../src/game/render/gearMarks'
import { iconCell, type IconKey } from '../src/game/data/iconAtlas'
import { TORSO_PACKS } from '../scripts/anchors-lib'
import { createHero } from '../src/game/data/sentinels'
import type { Item } from '../src/game/types'

/*
 * The Peoples & Trades DRAFT art (`scripts/peoples-art.ts`, the proposal's
 * contact sheets in `docs/peoples/`). Nothing here ships; these hold the
 * proposal to its own brief: every grid is a valid atlas cell, no two icons
 * are the same picture, every drafted body piece fits the real strips and
 * changes the figure, no two body pieces dress it alike — and the seams the
 * drafts enter by (`HeroGear.art`, `HeroGear.bodyStyle`) are never set by the
 * game itself.
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

async function atlasCell(): Promise<(k: IconKey) => Uint8Array> {
  const { data, info } = await sharp(readFileSync(join(ROOT, 'public/assets/ui/fw-icons.png'))).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return (k) => {
    const { ix, iy } = iconCell(k)
    const out = new Uint8Array(16 * 16 * 4)
    for (let y = 0; y < 16; y++) out.set(data.subarray(((iy * 16 + y) * info.width + ix * 16) * 4, ((iy * 16 + y) * info.width + ix * 16 + 16) * 4), y * 64)
    return out
  }
}

const differing = (a: Uint8Array, b: Uint8Array) => {
  let n = 0
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) n++
  return n
}

const drafted = PEOPLES.flatMap((p) => p.items.filter((i) => i.slot === 'body' && isBodyStyle(i.body)).map((i) => ({ who: `${p.id}/${i.name}`, style: i.body as BodyStyle })))

describe('the Peoples & Trades roster', () => {
  it('is five peoples of 20 items (levels 1–4) and 10 skills, one signature each', () => {
    expect(PEOPLES).toHaveLength(5)
    for (const p of PEOPLES) {
      expect(p.items, p.id).toHaveLength(20)
      expect(p.skills, p.id).toHaveLength(10)
      expect(p.skills.filter((s) => s.signature), p.id).toHaveLength(1)
      for (const l of [1, 2, 3, 4]) expect(p.items.some((i) => i.level === l), `${p.id} L${l}`).toBe(true)
      // Every kit item the skill frames hold is one of the people's own.
      expect(p.items.some((i) => i.name === p.kit.main)).toBe(true)
    }
  })

  it('draws every new and renamed item, and keeps a kept one on its shipped cell', () => {
    for (const p of PEOPLES)
      for (const i of p.items) expect(isArt(i.icon), `${p.id}/${i.name}`).toBe(i.status !== 'kept')
  })
})

describe('the draft icons', () => {
  it('are valid 16 × 16 atlas cells with a free border (`fw-icons.ts` rules)', () => {
    expect(() => allArt()).not.toThrow()
    expect(allArt()).toHaveLength(125)
  })

  it('are 150 different pictures: no two items or skills share an icon', async () => {
    const cell = await atlasCell()
    const icons = PEOPLES.flatMap((p) => [
      ...p.items.map((i) => ({ who: `${p.id}/${i.name}`, px: isArt(i.icon) ? new Uint8Array(artRGBA(i.icon)) : cell(i.icon) })),
      ...p.skills.map((s) => ({ who: `${p.id}/skill/${s.name}`, px: new Uint8Array(artRGBA(s.icon)) })),
    ])
    expect(icons).toHaveLength(150)
    for (let a = 0; a < icons.length; a++)
      for (let b = a + 1; b < icons.length; b++) expect(differing(icons[a].px, icons[b].px), `${icons[a].who} ~ ${icons[b].who}`).toBeGreaterThanOrEqual(24)
  })
})

describe('the draft body pieces', () => {
  it('fit every frame of every look and change each one', async () => {
    expect(drafted).toHaveLength(20)
    for (const name of STRIPS) {
      const s = await rawStrip(name)
      const cw = s.w / s.frames
      for (const { who, style } of drafted)
        for (let f = 0; f < s.frames; f++) {
          const px = new Uint8Array(s.px)
          const r = dressFrame(px, s.w, s.h, f * cw, cw, BODY_TORSOS.tinyswords[name][f], style, f, s.frames)
          expect(r.overflow, `${who} on ${name} ${f}`).toBe(0)
          expect(r.changed, `${who} on ${name} ${f}`).toBeGreaterThanOrEqual(60)
        }
    }
  })

  it('dress the figure unlike each other and unlike the seven shipped pieces', async () => {
    const s = await rawStrip('fighter_idle')
    const cw = s.w / s.frames
    const dress = (k: BodyKey | BodyStyle) => {
      const px = new Uint8Array(s.px)
      dressFrame(px, s.w, s.h, 0, cw, BODY_TORSOS.tinyswords.fighter_idle[0], k, 0, s.frames)
      return px
    }
    const all = [...BODY_KEYS.map((k) => ({ who: k as string, px: dress(k) })), ...drafted.map((d) => ({ who: d.who, px: dress(d.style) }))]
    expect(new Set(drafted.map((d) => d.style.id)).size).toBe(drafted.length)
    for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) expect(differing(all[a].px, all[b].px), `${all[a].who} ~ ${all[b].who}`).toBeGreaterThanOrEqual(40)
  })
})

describe('the seams the drafts enter by', () => {
  it('are never set by the game: a hero in real kit carries no draft art or style', () => {
    const it = (name: string, slot: Item['slot']): Item => ({ id: name, name, slot, rarity: 'rare', base: {}, enchantments: [] })
    const g = heroGear(createHero({ equipment: { mainHand: it('Sword', 'oneHand'), offHand: it('Shield', 'offHand'), body: it('Plate', 'body') } }).equipment)
    expect(g.art).toBeUndefined()
    expect(g.bodyStyle).toBeUndefined()
  })
})
