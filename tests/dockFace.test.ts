import { describe, expect, it } from 'vitest'
import { COMPANY_IDS } from '../src/game/data/companies'
import { INK, RAMPS, rgbOf } from '../src/game/render/hero/palette'
import { MINI_FACES, miniFrame } from '../src/game/render/hero/mini'
import { PERSONAS } from '../src/game/render/hero/rig'
import { DOCK_FACE, dockFaceAt } from '../src/ui/shell/dockFaceModel'

/*
 * The home dock's company faces (October 2026): each slot shows its
 * company's liaison in place of the crest, on one clock (`DockFace.tsx`).
 */

const key = ([r, g, b]: ArrayLike<number> & Iterable<number>) => `${r},${g},${b}`

describe('the dock faces', () => {
  it('every company has its own face, from the five drawn for the dock', () => {
    for (const c of COMPANY_IDS) expect(MINI_FACES[DOCK_FACE[c]], c).toBeDefined()
    expect(new Set(COMPANY_IDS.map((c) => DOCK_FACE[c])).size).toBe(COMPANY_IDS.length)
    expect([...COMPANY_IDS.map((c) => DOCK_FACE[c])].sort()).toEqual([...PERSONAS].sort())
    // the three liaisons liaisons.ts voices, and the two proposals standing in for the slots being renamed
    expect(DOCK_FACE).toMatchObject({ spice: 'saffra', silk: 'odile', metals: 'brannoch', art: 'hask', scrolls: 'wren' })
  })

  it('a locked company draws the silhouette: still, in the shadow inks only, never reacting', () => {
    const shadow = new Set([key(rgbOf(INK)), key(rgbOf(RAMPS.navy[0])), key(rgbOf(RAMPS.navy[1]))])
    for (const c of COMPANY_IDS) {
      for (const t of [0, 1234, 5600, 9999]) {
        const s = dockFaceAt(c, t, { locked: true, level: 'full', pickedAt: t - 50 })
        expect(s, `${c} at ${t}`).toMatchObject({ anim: 'idle', frame: 0, locked: true })
      }
      const fr = miniFrame(DOCK_FACE[c], 'idle', 0, true)
      const open = miniFrame(DOCK_FACE[c], 'idle', 0, false)
      for (let i = 0; i < fr.rgba.length; i += 4) {
        if (fr.rgba[i + 3] !== 255) continue
        expect(shadow.has(key(fr.rgba.subarray(i, i + 3))), `${c} px ${i / 4}`).toBe(true)
      }
      // the same shape as the open figure: a shadow, not a blank
      let same = 0, solid = 0
      for (let i = 3; i < fr.rgba.length; i += 4) if (open.rgba[i] === 255) { solid++; if (fr.rgba[i] === 255) same++ }
      expect(same / solid, c).toBeGreaterThan(0.95)
    }
  })

  it('reacts when picked, holds still under reduced motion, and tics half as often on Light', () => {
    for (const c of COMPANY_IDS) {
      expect(dockFaceAt(c, 3050, { locked: false, level: 'full', pickedAt: 3000 }).anim, c).toBe('react')
      expect(dockFaceAt(c, 3050, { locked: false, level: 'off', pickedAt: 3000 }), c).toMatchObject({ anim: 'idle', frame: 0 })
      const starts = (level: 'full' | 'light') => {
        let n = 0
        for (let t = 20, was = false; t < 120000; t += 20) {
          const tic = dockFaceAt(c, t, { locked: false, level }).anim === 'tic'
          if (tic && !was) n++
          was = tic
        }
        return n
      }
      const full = starts('full'), light = starts('light')
      expect(full, c).toBeGreaterThan(10)
      expect(Math.abs(light - full / 2), `${c}: ${light} of ${full}`).toBeLessThanOrEqual(1)
    }
  })
})
