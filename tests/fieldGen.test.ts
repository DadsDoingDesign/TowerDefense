import { describe, expect, it } from 'vitest'
import { FIELD_PROFILES, generateField, scoreField, withinBands } from '../src/game/data/fieldGen'
import { FIRST_MAP, KILN_MAP } from '../src/game/data/maps'
import { CARAVAN_BOX, caravanLayout } from '../src/game/render/caravan'

/*
 * Procedural battlefields (data/fieldGen.ts): every road the generator deals
 * is as long as a hand-made one, crosses nothing, bends only after a real run,
 * sits inside its weights' bands, leaves room for the wagon, and is the same
 * road every time its seed is dealt.
 */
const SEEDS = Array.from({ length: 30 }, (_, i) => i * 13 + 5)

describe('procedural battlefields', () => {
  for (const [key, { weights }] of Object.entries(FIELD_PROFILES)) {
    it(`${key}: every seed deals a fair, sound road inside its bands`, () => {
      for (const seed of SEEDS) {
        const g = generateField(seed, weights)
        expect(g, `${key} seed ${seed}`).not.toBeNull()
        const { map, score } = g!
        // As long as the shipped fields: enemy speeds are tuned as crossing times.
        expect([2220, 2300]).toContain(score.length)
        expect(withinBands(score, weights)).toBe(true)
        // In from the left, out to the right; every leg axis-aligned on tile centres.
        const path = map.path
        expect(path[0].x).toBe(-30)
        expect(path[path.length - 1].x).toBe(990)
        for (let i = 0; i < path.length - 1; i++) {
          const a = path[i]
          const b = path[i + 1]
          expect(a.x === b.x || a.y === b.y).toBe(true)
          if (i > 0) expect((a.x - 20) % 40).toBe(0)
          expect((a.y - 20) % 40).toBe(0)
          // Every inner leg is at least `minRun` lattice steps long.
          if (i > 0 && i < path.length - 2) expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThanOrEqual(80 * weights.minRun)
        }
        // It crosses nothing: no road tile is visited twice (sampled per tile).
        const seen = new Set<string>()
        for (let i = 0; i < path.length - 1; i++) {
          const a = path[i]
          const b = path[i + 1]
          const n = Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 40)
          for (let k = i === 0 ? 0 : 1; k <= n; k++) {
            const x = a.x + ((b.x - a.x) * k) / n
            const y = a.y + ((b.y - a.y) * k) / n
            if (x < 0 || x > 960) continue
            const key2 = `${Math.round(x)},${Math.round(y)}`
            expect(seen.has(key2), `${key} seed ${seed} crosses at ${key2}`).toBe(false)
            seen.add(key2)
          }
        }
        // The wagon finds a spot on the field.
        const at = caravanLayout(map)
        expect(at.x + CARAVAN_BOX.left).toBeGreaterThanOrEqual(0)
        expect(at.x + CARAVAN_BOX.right).toBeLessThanOrEqual(map.width)
        expect(at.y + CARAVAN_BOX.bottom).toBeLessThanOrEqual(map.height)
      }
    })
  }

  it('the same seed deals the same road', () => {
    const w = FIELD_PROFILES.balanced.weights
    expect(generateField(42, w)!.map.path).toEqual(generateField(42, w)!.map.path)
    expect(generateField(42, w)!.map.path).not.toEqual(generateField(43, w)!.map.path)
  })

  it('the score reads the hand-made fields the way the bands were set from', () => {
    const green = scoreField(FIRST_MAP)
    const kiln = scoreField(KILN_MAP)
    expect(green.length).toBe(2220)
    expect(kiln.length).toBe(2300)
    expect(green.chokes).toBeGreaterThan(30)
    expect(kiln.chokes).toBeGreaterThan(green.chokes)
    expect(kiln.tight).toBe(0)
  })
})
