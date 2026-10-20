import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { ANIM_FRAMES } from '../src/game/render/anim'
import { ANCHORS } from '../src/game/render/anchors.generated'
import { BODY_TORSOS } from '../src/game/render/bodyAnchors.generated'
import { drawMainHand, handsAt, heldGripsFor, rigFor, type HeroGear } from '../src/game/render/gearMarks'
import { HELD_GRIPS } from '../src/game/render/heldGrips.generated'
import { cellOrigin, fistTemplate, fromMarkers, HELD_PACKS, MAX_MISS, measureLook, missAt, steady, type RawStrip } from '../scripts/held-grips-lib'
import type { Archetype } from '../src/game/types'

/*
 * The designer: "When an item is equipped the animation on the map doesn't
 * move the item, it stays still while the character moves which looks odd."
 * A held mark is drawn in this frame's fist (`heldGrips.generated.ts`, tracked
 * off the art by `npm run anchors`), so it moves with the hand that holds it.
 */

const LOOKS: Archetype[] = ['fighter', 'rogue', 'mystic']

async function strip(pack: string, name: string): Promise<RawStrip> {
  const file = join(__dirname, '..', 'public/assets/sprites', pack, `${name}.png`)
  const { data, info } = await sharp(readFileSync(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { name, data: new Uint8Array(data), w: info.width, h: info.height, frames: ANIM_FRAMES[name] }
}

describe('held marks follow the hand', () => {
  it('covers every strip a mark is drawn over: both strips of every look, a point per frame, on whole px', () => {
    for (const look of HELD_PACKS.tinyswords as Archetype[])
      for (const anim of ['idle', 'atk']) {
        const name = `${look}_${anim}`
        const h = heldGripsFor('tinyswords', name)
        expect(h, name).not.toBeNull()
        for (const side of ['r', 'l'] as const) {
          expect(h![side].length, `${name} ${side}`).toBe(ANIM_FRAMES[name])
          for (const [x, y] of h![side]) expect(Number.isInteger(x) && Number.isInteger(y), `${name} ${side}`).toBe(true)
        }
      }
    // A marker pack's hero strips read their markers.
    for (const [pack, table] of Object.entries(ANCHORS))
      for (const name of Object.keys(table).filter((n) => !n.startsWith('gear_') && !n.startsWith('body_'))) expect(heldGripsFor(pack, name), `${pack}/${name}`).not.toBeNull()
  })

  it('ships what the strips on disk make (`npm run anchors`)', async () => {
    for (const look of LOOKS) {
      const rig = rigFor('tinyswords', look)
      const idle = await strip('tinyswords', `${look}_idle`)
      const atk = await strip('tinyswords', `${look}_atk`)
      const { grips, problems } = measureLook({ look, idle, strips: [idle, atk], fistR: [rig.fistR.x, rig.fistR.y], fistL: [rig.fistL.x, rig.fistL.y], torsos: BODY_TORSOS.tinyswords })
      expect(problems, look).toEqual([])
      expect(grips[idle.name]).toEqual(HELD_GRIPS.tinyswords[idle.name])
      expect(grips[atk.name]).toEqual(HELD_GRIPS.tinyswords[atk.name])
    }
    const fw = await strip('fieldwatch', 'fighter_idle')
    expect(fromMarkers(ANCHORS.fieldwatch.fighter_idle, fw)).toEqual(HELD_GRIPS.fieldwatch.fighter_idle)
  })

  it('idle frame 0 is the rig’s own fist, so every still frame (the portraits) is what it was', () => {
    for (const look of LOOKS) {
      const rig = rigFor('tinyswords', look)
      const h = heldGripsFor('tinyswords', `${look}_idle`)
      expect(handsAt(rig, h, 0), look).toEqual({ r: rig.fistR, l: rig.fistL })
    }
  })

  it('moves with the strip: the robed and hooded fists are not all in one place through the idle loop', () => {
    for (const look of ['rogue', 'mystic'] as const)
      for (const side of ['r', 'l'] as const) {
        const pts = HELD_GRIPS.tinyswords[`${look}_idle`][side]
        expect(new Set(pts.map((p) => p.join(','))).size, `${look} ${side}`).toBeGreaterThan(1)
      }
  })

  it('reads as HELD: every idle point is the fist itself, found near-exactly, and the loop moves smoothly', async () => {
    for (const look of ['rogue', 'mystic'] as const) {
      const rig = rigFor('tinyswords', look)
      const idle = await strip('tinyswords', `${look}_idle`)
      const o = cellOrigin(idle)
      for (const side of ['r', 'l'] as const) {
        const ref = side === 'r' ? rig.fistR : rig.fistL
        const t = fistTemplate(idle, 0, ref.x - o.ox, ref.y - o.oy)
        expect(t, `${look} ${side}`).not.toBeNull()
        const pts = HELD_GRIPS.tinyswords[`${look}_idle`][side]
        pts.forEach(([x, y], f) => expect(missAt(idle, f, t!, x - o.ox, y - o.oy), `${look} ${side} frame ${f}`).toBeLessThanOrEqual(MAX_MISS))
        // No jump: each step (the loop’s wrap too) is at most 3 px a side — the art’s own (the archer’s near fist swings 3 px back on frame 5).
        pts.forEach(([x, y], f) => {
          const [nx, ny] = pts[(f + 1) % pts.length]
          expect(Math.max(Math.abs(nx - x), Math.abs(ny - y)), `${look} ${side} ${f}→${f + 1}`).toBeLessThanOrEqual(3)
        })
      }
    }
  })

  it('a match that only flips between two places a px apart, while the tunic holds still, is noise: the body’s bob wins', () => {
    const flip = { pts: [[0, 0], [1, 0], [0, 0], [1, 0], [0, 0], [1, 0]] as [number, number][], seen: Array(6).fill(true) }
    const still = Array(6).fill([0, 0]) as [number, number][]
    expect(steady(flip, still)).toEqual(still)
    // A real bob (the tunic moves too) is kept.
    const bob = [[0, 0], [0, 1], [0, 1], [0, 0], [0, 0], [0, 0]] as [number, number][]
    expect(steady(flip, bob)).toEqual(flip.pts)
  })

  it('the robed look’s caster’s fists are tracked in its attack strip too (the off hand swings with the hammer)', () => {
    const l = HELD_GRIPS.tinyswords.mystic_atk.l
    expect(Math.min(...l.map((p) => p[0]))).toBeLessThan(rigFor('tinyswords', 'mystic').fistL.x - 10)
  })

  it('handsAt falls back to the rig’s fixed fists where nothing was measured', () => {
    const rig = rigFor('elsewhere', 'mystic')
    expect(handsAt(rig, heldGripsFor('elsewhere', 'mystic_idle'), 3)).toEqual({ r: rig.fistR, l: rig.fistL })
    expect(handsAt(rig, null, 0)).toEqual({ r: rig.fistR, l: rig.fistL })
  })

  it('the painted weapon’s enchantment glint rides the fist too', () => {
    const rig = rigFor('tinyswords', 'fighter')
    const gear: HeroGear = { main: 'blade', off: null, body: null, glint: 'chill' }
    const at = (hand?: { x: number; y: number }) => {
      const ops: { fn: string; args: number[] }[] = []
      const ctx = new Proxy({} as Record<string, unknown>, {
        get: (t, k: string) => (k in t ? t[k] : (...a: unknown[]) => void ops.push({ fn: k, args: a.filter((v): v is number => typeof v === 'number') })),
        set: (t, k: string, v) => ((t[k] = v), true),
      }) as unknown as CanvasRenderingContext2D
      drawMainHand(ctx, rig, gear, 0, 0, 0, true, false, hand)
      return ops.find((o) => o.fn === 'arc')!.args.slice(0, 2)
    }
    const still = at()
    expect(at({ x: rig.fistR.x + 1, y: rig.fistR.y + 2 })).toEqual([still[0] + 1, still[1] + 2])
  })
})
