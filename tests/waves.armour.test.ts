import { describe, expect, it } from 'vitest'
import { ARMOUR_CHANCE, ARMOUR_DEPTH, ARMOUR_LEAN, generateEncounter, nodeArmour } from '../src/game/data/waves'
import { encounterRulesOf } from '../src/game/run/charter'
import { ARMOUR_CAP, RESIST_CAP } from '../src/game/data/behaviours'
import { ENEMY_MODS, ENEMY_TYPES } from '../src/game/data/enemies'

/** Armoured ordinary fights (Oct 2026): `waves.nodeArmour` and the road's lean. */
describe('armoured ordinary fights', () => {
  const nodes = (type: string) =>
    Array.from({ length: 4000 }, (_, i) => ({ type, layer: ARMOUR_DEPTH + (i % 8), row: i % 4, seed: 1000 + Math.floor(i / 4) }))

  it('only ordinary battles from ARMOUR_DEPTH, never elites, bosses or stops', () => {
    for (const t of ['elite', 'boss', 'miniboss', 'merchant', 'start']) for (const n of nodes(t).slice(0, 400)) expect(nodeArmour(n, n.seed)).toBeNull()
    for (let layer = 0; layer < ARMOUR_DEPTH; layer++) for (let s = 0; s < 400; s++) expect(nodeArmour({ type: 'battle', layer, row: 0 }, s)).toBeNull()
    // A Vow's all-elite rule turns battles into elites, which wear their own.
    for (const n of nodes('battle').slice(0, 400)) expect(nodeArmour(n, n.seed, { allElite: true, eliteDepth: 1 })).toBeNull()
  })

  it('arms about ARMOUR_CHANCE of them, evenly on a road with no lean', () => {
    const got = nodes('battle').map((n) => nodeArmour(n, n.seed))
    const armed = got.filter(Boolean)
    expect(armed.length / got.length).toBeCloseTo(ARMOUR_CHANCE, 1)
    expect(armed.filter((m) => m === 'plated').length / armed.length).toBeCloseTo(0.5, 1)
  })

  it('leans to the road: Ironvein plate, Greenvial wards, the rest even', () => {
    const share = (company: 'metals' | 'scrolls' | 'spice', mod: string) => {
      const rules = encounterRulesOf({ company })
      const armed = nodes('battle').map((n) => nodeArmour(n, n.seed, rules)).filter(Boolean)
      return armed.filter((m) => m === mod).length / armed.length
    }
    expect(share('metals', 'plated')).toBeCloseTo(ARMOUR_LEAN, 1)
    expect(share('scrolls', 'warded')).toBeCloseTo(ARMOUR_LEAN, 1)
    expect(share('spice', 'plated')).toBeCloseTo(0.5, 1)
    expect(encounterRulesOf({ company: 'spice' })).toBeUndefined()
  })

  it('dresses every goblin in an ordinary column, names it, and leaves an elite its own', () => {
    const w = generateEncounter(6, 'normal', { seed: 77, mod: 'warded' })
    expect(w.spawns.every((s) => s.typeId.endsWith('_warded'))).toBe(true)
    expect(w.label).toMatch(/Warded/)
    const elite = generateEncounter(6, 'elite', { variantId: 'plated', mod: 'warded' })
    expect(elite.spawns.every((s) => s.typeId.endsWith('_plated'))).toBe(true)
  })

  it('armour stops at ARMOUR_CAP and leaves the other damage type open', () => {
    for (const [key, t] of Object.entries(ENEMY_TYPES)) {
      expect(t.physResist ?? 0, key).toBeLessThanOrEqual(ARMOUR_CAP + 1e-9)
      expect(t.magResist ?? 0, key).toBeLessThanOrEqual(ARMOUR_CAP + 1e-9)
      const mod = ENEMY_MODS.find((m) => key.endsWith(`_${m.id}`))
      if (mod?.id === 'plated') expect(t.magResist ?? 0, key).toBe(0)
      if (mod?.id === 'warded') expect(t.physResist ?? 0, key).toBe(0)
      // A goblin without armour stays at the plain cap.
      if (!mod || mod.id === 'swift') {
        expect(t.physResist ?? 0, key).toBeLessThanOrEqual(RESIST_CAP + 1e-9)
        expect(t.magResist ?? 0, key).toBeLessThanOrEqual(RESIST_CAP + 1e-9)
      }
    }
  })
})
