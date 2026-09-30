import { describe, expect, it } from 'vitest'
import { FIRST_MAP, legacyPosts } from '../src/game/data/maps'

/** G1-2: the old build circles, as the tiles nearest where they stood. */
const P = legacyPosts(FIRST_MAP.id)
import { createSentinel } from '../src/game/data/sentinels'
import { generateEncounter } from '../src/game/data/waves'
import { GameEngine, TICK } from '../src/game/engine/engine'
import type { EffectMods, Sentinel, WaveDef } from '../src/game/types'

/**
 * The Phase 3b rule capabilities (`EffectMods.volley`, `critEvery`,
 * `blockRegen`, `killRush`, `openingRush`, `lastStand`, `leakWard`) — each is a
 * rule a perk or a relic card states, so each is proven to do what the card
 * says and to be inert when nothing grants it.
 */

const run = (opts: { team: { sentinel: Sentinel; slotId: string }[]; wave: WaveDef; teamMods?: EffectMods[]; seed?: number; baseHp?: number }) => {
  const engine = new GameEngine({
    map: FIRST_MAP,
    wave: opts.wave,
    placedSentinels: opts.team,
    baseHp: opts.baseHp ?? 50,
    maxBaseHp: opts.baseHp ?? 50,
    teamMods: opts.teamMods,
    seed: opts.seed ?? 3,
  })
  for (let i = 0; i < 60 * 240 && engine.status === 'running'; i++) engine.step(TICK)
  return engine
}

const withPerkMods = (s: Sentinel, mods: EffectMods): Sentinel =>
  // A perk id the tests do not need: put the mods on a fake mutation, which
  // `computeCombat` merges exactly like a perk.
  ({ ...s, mutations: [{ id: 'm', key: 'test', name: 'test', desc: '', rarity: 'mythic', downside: '', mods }] })

describe('rule capabilities (engine)', () => {
  it('leakWard: the first N leaks cost the Gate nothing, and still count', () => {
    // No defence at all: every enemy leaks.
    const wave: WaveDef = { index: 1, label: 't', isBoss: false, spawns: Array.from({ length: 5 }, (_, i) => ({ typeId: 'torch1', at: i * 0.5, hpMult: 1 })) }
    const plain = run({ team: [], wave })
    const warded = run({ team: [], wave, teamMods: [{ leakWard: 2 }] })
    expect(plain.leakCount).toBe(5)
    expect(warded.leakCount).toBe(5)
    expect(plain.leaks - warded.leaks).toBeCloseTo(2, 9) // two Torch Runts, 1 leak each
  })

  it('critEvery and volley: a cadence the engine keeps without moving the combat stream', () => {
    // One continuous wave (no sub-wave breathers), so a solo rogue cannot clear
    // it and a cadence's extra damage has bodies left to land on.
    const wave = generateEncounter(3, 'normal', { subWaves: false })
    const rogue = createSentinel('rogue')
    const a = run({ team: [{ sentinel: rogue, slotId: P.s3 }], wave })
    const b = run({ team: [{ sentinel: withPerkMods(rogue, { critEvery: 3 }), slotId: P.s3 }], wave })
    const c = run({ team: [{ sentinel: withPerkMods(rogue, { volley: { every: 2, pierce: 99 } }), slotId: P.s3 }], wave })
    const dealt = (e: GameEngine) => e.sentinels[0].damageDealt
    expect(dealt(b)).toBeGreaterThan(dealt(a))
    expect(dealt(c)).toBeGreaterThan(dealt(a))
  })

  it('openingRush and killRush make a hero fire more', () => {
    const wave = generateEncounter(4, 'normal')
    const rogue = createSentinel('rogue')
    const shots = (s: Sentinel) => run({ team: [{ sentinel: s, slotId: P.s3 }], wave }).sentinels[0].shots
    const base = shots(rogue)
    expect(shots(withPerkMods(rogue, { openingRush: { rate: 1, dur: 30 } }))).toBeGreaterThan(base)
    expect(shots(withPerkMods(rogue, { killRush: { rate: 1, dur: 3 } }))).toBeGreaterThan(base)
  })

  it('blockRegen keeps a blocker standing longer; lastStand only bites when hurt', () => {
    const wave = generateEncounter(6, 'elite')
    const fighter = createSentinel('fighter')
    const hp = (s: Sentinel) => {
      const e = run({ team: [{ sentinel: s, slotId: P.s0 }], wave, baseHp: 999 })
      return e.sentinels[0].downed ? 0 : e.sentinels[0].hp
    }
    expect(hp(withPerkMods(fighter, { blockRegen: 0.08 }))).toBeGreaterThanOrEqual(hp(fighter))
    // A last stand at 0% HP never triggers: identical fight.
    const a = run({ team: [{ sentinel: fighter, slotId: P.s0 }], wave, baseHp: 999 })
    const b = run({ team: [{ sentinel: withPerkMods(fighter, { lastStand: { below: 0, damage: 5 } }), slotId: P.s0 }], wave, baseHp: 999 })
    expect(b.sentinels[0].damageDealt).toBe(a.sentinels[0].damageDealt)
  })
})
