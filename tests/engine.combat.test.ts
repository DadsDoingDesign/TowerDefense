import { describe, expect, it } from 'vitest'
import { FIRST_MAP, legacyPosts } from '../src/game/data/maps'
import { withinClearance } from '../src/game/data/terrain'

/** G1-2: the old build circles, as the tiles nearest where they stood. */
const P = legacyPosts(FIRST_MAP.id)
/**
 * The open tile nearest where a Bomber plants its feet — a little inside its
 * range of the Gate, measured along the road — so a hero there can reach it
 * during the wind-up.
 */
const NEAR_GATE = (() => {
  const road = new GamePath(FIRST_MAP.path)
  const lob = BOMBER_LOB.range
  const plant = road.pointAt(road.length - lob + 20)
  return [...FIRST_MAP.slots].sort((a, b) => Math.hypot(a.pos.x - plant.x, a.pos.y - plant.y) - Math.hypot(b.pos.x - plant.x, b.pos.y - plant.y))[0].id
})()
import { ENEMY_TYPES, leakCeiling } from '../src/game/data/enemies'
import { createSentinel } from '../src/game/data/sentinels'
import { generateEncounter, nodeEncounter, subWaveCount } from '../src/game/data/waves'
import { commandsFor, HOLD, RALLY } from '../src/game/data/commands'
import { relicById, relicCommands, relicSupported, relicTeamMods } from '../src/game/data/relics'
import { BOMBER_LOB, COLOSSUS_SPLIT } from '../src/game/data/behaviours'
import { GamePath } from '../src/game/core/path'
import {
  BRITTLE_MULT,
  GameEngine,
  MAX_STEPS_PER_FRAME,
  TICK,
  takenMult,
  type BattleInput,
  type EngineRules,
  type RtEnemy,
} from '../src/game/engine/engine'
import type { Archetype, EffectMods, SpawnEvent, WaveDef } from '../src/game/types'

/*
 * Phase 3a — combat depth: the behaviour kit, boss phases, sub-waves and the
 * breather, Watch Commands, and the status interactions. Every mechanic gets a
 * scenario that proves it FIRES and one that proves its counter WORKS, and the
 * whole lot is replayed from its input log at 1×/2×/3×.
 */

const wave = (spawns: SpawnEvent[], isBoss = false): WaveDef => ({ index: 1, label: 't', spawns, isBoss })
const at = (typeId: string, t: number, hpMult = 1, group?: number): SpawnEvent => ({ typeId, at: t, hpMult, group })

function engineFor(
  spawns: SpawnEvent[],
  team: [Archetype, string][],
  opts: {
    teamMods?: EffectMods[]
    rules?: Partial<EngineRules>
    breathers?: 'pause' | 'auto'
    script?: BattleInput[]
    baseHp?: number
    commands?: ('rally' | 'flare' | 'hold')[]
    focus?: 'first' | 'threat'
  } = {},
): GameEngine {
  return new GameEngine({
    map: FIRST_MAP,
    wave: wave(spawns),
    placedSentinels: team.map(([a, slotId]) => ({ sentinel: createSentinel(a), slotId })),
    baseHp: opts.baseHp ?? 200,
    maxBaseHp: opts.baseHp ?? 200,
    teamMods: opts.teamMods,
    rules: opts.rules,
    breathers: opts.breathers,
    script: opts.script,
    commands: opts.commands,
    tactics: { focus: opts.focus ?? 'first' },
    seed: 99,
  })
}

function runOut(e: GameEngine, maxTicks = 60 * 400, each?: (e: GameEngine) => void): GameEngine {
  for (let i = 0; i < maxTicks && e.status === 'running'; i++) {
    each?.(e)
    e.step(TICK)
  }
  return e
}

/** A dummy "enemy" for the pure `takenMult` checks. */
const fake = (typeId: string, shield = 0, brittle = false) =>
  ({ type: ENEMY_TYPES[typeId], shield, brittle }) as Pick<RtEnemy, 'type' | 'shield' | 'brittle'>

describe('the behaviour kit (Phase 3a)', () => {
  it('a shaman heals its neighbours, and focusing it first cuts the healing', () => {
    // A column of raiders with two shamans walking in it, against three heroes.
    const spawns = [
      ...Array.from({ length: 8 }, (_, i) => at('torch3', i * 0.5, 2.5)),
      at('torch3_shaman', 1.2, 2.5),
      at('torch3_shaman', 2.7, 2.5),
    ]
    const team: [Archetype, string][] = [['rogue', P.s1], ['mystic', P.s2], ['rogue', P.s3]]
    const first = runOut(engineFor(spawns, team, { focus: 'first' }))
    const threat = runOut(engineFor(spawns, team, { focus: 'threat' }))
    expect(first.behaviourStats.healPulses).toBeGreaterThan(0)
    expect(first.behaviourStats.hpHealed).toBeGreaterThan(0)
    // The counter: kill the healer first → fewer pulses, less healed, no more leaks.
    expect(threat.behaviourStats.healPulses).toBeLessThan(first.behaviourStats.healPulses)
    expect(threat.behaviourStats.hpHealed).toBeLessThan(first.behaviourStats.hpHealed)
    expect(threat.leaks).toBeLessThanOrEqual(first.leaks)
  })

  it('a berserker enrages below its threshold and walks faster for it', () => {
    const e = engineFor([at('torch4', 0, 1)], [])
    runOut(e, 30)
    const b = e.enemies[0]
    const d0 = b.distance
    for (let i = 0; i < 60; i++) e.step(TICK)
    const calm = b.distance - d0
    b.hp = b.maxHp * 0.3
    const d1 = b.distance
    for (let i = 0; i < 60; i++) e.step(TICK)
    expect(b.enraged).toBe(true)
    expect(e.behaviourStats.enrages).toBe(1)
    expect(b.distance - d1).toBeGreaterThan(calm * 1.4)
  })

  it('a sapper walks past the heroes and blows at the Gate: its leak plus its blast', () => {
    // A rogue beside the lane does not set it off — heroes are never hurt.
    const e = runOut(engineFor([at('tnt4', 0, 40)], [['rogue', P.s5]], { rules: {} }))
    const sapper = ENEMY_TYPES.tnt4.behaviours!.find((b) => b.kind === 'sapper')!
    const blast = sapper.kind === 'sapper' ? sapper.gateDamage : 0
    expect(e.behaviourStats.sapperBlasts).toBe(1)
    expect(e.behaviourStats.sapperDamage).toBe(blast)
    expect(e.leakCount).toBe(1)
    expect(e.baseHp).toBe(200 - ENEMY_TYPES.tnt4.leak - blast)
    expect(e.status).toBe('cleared')
    // The card's Gate figure counts the blast.
    expect(leakCeiling('tnt4')).toBe(ENEMY_TYPES.tnt4.leak + blast)
  })

  it('a sapper held by a fighter goes off harmlessly at the wall — and is that blocker\'s kill', () => {
    const e = runOut(engineFor([at('tnt4', 0, 40)], [['fighter', P.s1]]))
    expect(e.behaviourStats.sapperBlasts).toBe(1)
    expect(e.behaviourStats.sapperHeld).toBe(1)
    expect(e.behaviourStats.sapperDamage).toBe(0)
    expect(e.baseHp).toBe(200)
    expect(e.goldEarned).toBeGreaterThan(0)
    expect(e.sentinels[0].kills).toBe(1)
  })

  it('a bomber near the Gate winds up and lands its charge on it; killing it in the wind-up cancels the throw', () => {
    const e = runOut(engineFor([at('tnt2', 0, 30)], [['rogue', NEAR_GATE]]))
    expect(e.behaviourStats.lobsStarted).toBeGreaterThan(0)
    expect(e.behaviourStats.lobsLanded).toBe(1)
    expect(e.behaviourStats.lobDamage).toBeGreaterThan(0)
    expect(e.baseHp).toBeLessThan(200)
    // Now kill it the moment it plants its feet.
    const k = engineFor([at('tnt2', 0, 30)], [['rogue', NEAR_GATE]])
    runOut(k, 60 * 60, (eng) => {
      const b = eng.enemies[0]
      if (b && b.lobUntil > 0) b.hp = 0.01 // the next shot finishes it
    })
    expect(k.behaviourStats.lobsCancelled + k.behaviourStats.lobsLanded).toBeGreaterThan(0)
    expect(k.behaviourStats.lobsCancelled).toBe(1)
    expect(k.behaviourStats.lobDamage).toBe(0)
  })

  it('a splitter breaks into imps on death, and they carry its modifier', () => {
    const e = runOut(engineFor([at('barrel4_plated', 0, 0.5)], [['mystic', P.s1], ['mystic', P.s2], ['mystic', P.s3]]))
    expect(e.behaviourStats.splits).toBe(1)
    expect(e.behaviourStats.splitSpawned).toBe(2)
    expect(e.killCount + e.leakCount).toBe(3)
    // The pieces share the barrel's leak: a split never puts more through the Gate.
    expect(leakCeiling('barrel4')).toBe(ENEMY_TYPES.barrel4.leak)
  })

  it('a shield-bearer covers its neighbours, capped, and not itself', () => {
    const e = engineFor([at('barrel3', 0, 20), at('barrel3_bearer', 0.2, 20)], [])
    runOut(e, 90)
    const [plain, bearer] = e.enemies
    expect(plain.shield).toBeGreaterThan(0)
    expect(bearer.shield).toBe(0)
    expect(takenMult(plain, 'physical')).toBeLessThan(takenMult({ ...plain, shield: 0 }, 'physical'))
    // The cap: nothing is ever more than 55% resistant.
    expect(takenMult(fake('barrel5_plated', 0.2), 'physical')).toBeCloseTo(0.45, 10)
    // No aura, no frost: exactly the pre-3a arithmetic.
    expect(takenMult(fake('barrel3'), 'physical')).toBe(1 - (ENEMY_TYPES.barrel3.physResist ?? 0))
  })

  it('a leaper vaults the first blocker, and a second blocker downstream holds it', () => {
    const one = engineFor([at('barrel2', 0, 60)], [['fighter', P.s1]])
    runOut(one, 60 * 40)
    expect(one.behaviourStats.leaps).toBe(1)
    // Two fighters: it vaults the first and the second holds it.
    const two = engineFor([at('barrel2', 0, 60)], [['fighter', P.s1], ['fighter', P.s2]])
    let heldBySecond = false
    runOut(two, 60 * 40, (eng) => {
      const b = eng.enemies[0]
      if (b && b.blockedBy === eng.sentinels[1].id) heldBySecond = true
    })
    expect(two.behaviourStats.leaps).toBe(1)
    expect(heldBySecond).toBe(true)
  })

  it('every behaviour switches off with the counterfactual rule', () => {
    const e = runOut(engineFor([at('tnt4', 0, 40), at('barrel2', 0.5, 5)], [['fighter', P.s1]], { rules: { behaviours: false } }))
    expect(e.behaviourStats.sapperBlasts).toBe(0)
    expect(e.behaviourStats.leaps).toBe(0)
  })
})

describe('boss phases (Phase 3a)', () => {
  it('Grukk war-cries at two-thirds and one-third, hasting the column', () => {
    const events: string[] = []
    const e = new GameEngine({
      map: FIRST_MAP,
      wave: wave([at('torch5', 0, 1), ...Array.from({ length: 4 }, (_, i) => at('torch1', 0.2 + i * 0.2, 20))], true),
      placedSentinels: [],
      baseHp: 999,
      maxBaseHp: 999,
      onEvent: (x) => events.push(x),
    })
    runOut(e, 30)
    const g = e.enemies.find((x) => x.type.id === 'torch5')!
    g.hp = g.maxHp * 0.6
    runOut(e, 90)
    g.hp = g.maxHp * 0.3
    runOut(e, 90)
    expect(e.behaviourStats.warCries).toBe(2)
    expect(e.behaviourStats.hasteApplied).toBeGreaterThan(2)
    expect(events.filter((x) => x === 'bossPhase').length).toBe(2)
  })

  it('the Powderkeg King lobs TNT at the Gate on a clock', () => {
    const e = runOut(engineFor([at('tnt5', 0, 3)], [['fighter', P.s1], ['rogue', P.s2]], { baseHp: 999 }))
    expect(e.behaviourStats.kingLobs).toBeGreaterThan(0)
    expect(e.behaviourStats.kingDamage).toBeGreaterThan(0)
    expect(e.behaviourStats.gateDamage).toBeGreaterThanOrEqual(e.behaviourStats.kingDamage)
  })

  it('the Colossus Keg splits into two halves at half health', () => {
    const e = engineFor([at('barrel5', 0, 1)], [], { baseHp: 999 })
    runOut(e, 30)
    const c = e.enemies[0]
    const fullHp = c.maxHp
    ;(e as unknown as { damageEnemy: (...a: unknown[]) => void }).damageEnemy(c, c.maxHp * 0.7, undefined, false, 'magic', true)
    const hpAtSplit = fullHp - fullHp * 0.7 * (1 - (ENEMY_TYPES.barrel5.magResist ?? 0))
    e.step(TICK)
    expect(e.behaviourStats.bossSplits).toBe(1)
    expect(e.enemies.length).toBe(2)
    expect(e.enemies.every((x) => x.type.name.includes('(half)'))).toBe(true)
    // Each half carries `hpShare` of what was left — a second act, not a relabel.
    for (const h of e.enemies) expect(h.hp).toBeCloseTo(hpAtSplit * COLOSSUS_SPLIT.hpShare, 6)
  })
})

describe('status interactions (Phase 3a)', () => {
  it('BRITTLE: a frosted body takes +25% physical, not magic', () => {
    expect(takenMult(fake('torch1', 0, true), 'physical')).toBe(BRITTLE_MULT)
    expect(takenMult(fake('torch1', 0, true), 'magic')).toBe(1)
    // …and a resisted type multiplies through its resistance.
    expect(takenMult(fake('barrel3', 0, true), 'physical')).toBe((1 - 0.25) * BRITTLE_MULT)
  })

  it('SHATTER: a shock shot on a frosted body bursts it; without frost it never fires', () => {
    const spawns = Array.from({ length: 8 }, (_, i) => at('torch2', i * 0.4, 12))
    const both = runOut(
      engineFor(spawns, [['mystic', P.s1], ['rogue', P.s2]], { teamMods: [{ chill: { slow: 0.2, dur: 2 }, shock: { chains: 2, dmgFrac: 0.4 } }] }),
    )
    const shockOnly = runOut(engineFor(spawns, [['mystic', P.s1], ['rogue', P.s2]], { teamMods: [{ shock: { chains: 2, dmgFrac: 0.4 } }] }))
    const off = runOut(
      engineFor(spawns, [['mystic', P.s1], ['rogue', P.s2]], {
        teamMods: [{ chill: { slow: 0.2, dur: 2 }, shock: { chains: 2, dmgFrac: 0.4 } }],
        rules: { interactions: false },
      }),
    )
    expect(both.behaviourStats.shatters).toBeGreaterThan(0)
    expect(shockOnly.behaviourStats.shatters).toBe(0)
    expect(off.behaviourStats.shatters).toBe(0)
  })

  it('SPREAD: a burning body that dies lights its neighbours', () => {
    const spawns = Array.from({ length: 10 }, (_, i) => at('torch1', i * 0.15, 3))
    // A granted capability: the Ember Urn relic hands the team the flag.
    const urn = relicTeamMods(['ember_urn'])
    const e = runOut(engineFor(spawns, [['mystic', P.s1]], { teamMods: [{ burn: { dps: 20, dur: 4 } }, ...urn] }))
    const noUrn = runOut(engineFor(spawns, [['mystic', P.s1]], { teamMods: [{ burn: { dps: 20, dur: 4 } }] }))
    const off = runOut(engineFor(spawns, [['mystic', P.s1]], { teamMods: [{ burn: { dps: 20, dur: 4 } }, ...urn], rules: { interactions: false } }))
    expect(e.behaviourStats.burnSpreads).toBeGreaterThan(0)
    expect(noUrn.behaviourStats.burnSpreads).toBe(0)
    expect(off.behaviourStats.burnSpreads).toBe(0)
  })

  it('the relic wiring: Ember Urn and Signal Flare are offered, and do what their cards say', () => {
    const ember = relicById('ember_urn')!
    const flare = relicById('signal_flare')!
    expect(relicSupported(ember)).toBe(true)
    expect(relicSupported(flare)).toBe(true)
    expect(commandsFor(relicCommands([]))).toEqual(['rally'])
    // "Your Rally Horn becomes Flare": the grant REPLACES the default.
    expect(commandsFor(relicCommands(['signal_flare']))).toEqual(['flare'])
  })
})

describe('sub-waves and the breather (Phase 3a)', () => {
  it('generateEncounter cuts a node into 2–3 sub-waves without changing its totals', () => {
    for (const [depth, kind] of [[1, 'normal'], [4, 'normal'], [8, 'elite'], [10, 'boss']] as const) {
      const w = generateEncounter(depth, kind, { seed: 1234 })
      const groups = new Set(w.spawns.map((s) => s.group))
      expect(groups.size).toBe(subWaveCount(depth, kind))
      expect(groups.size).toBeGreaterThanOrEqual(2)
      expect(groups.size).toBeLessThanOrEqual(3)
      // Every group starts at its own t=0.
      for (const g of groups) expect(Math.min(...w.spawns.filter((s) => s.group === g).map((s) => s.at))).toBe(0)
    }
    // A boss is cut at its champions: each tier-5 LEADS a sub-wave.
    const boss = generateEncounter(10, 'boss', { seed: 99 })
    for (const g of [1, 2]) {
      const lead = boss.spawns.filter((s) => s.group === g).sort((a, b) => a.at - b.at)[0]
      expect(ENEMY_TYPES[lead.typeId].isBoss).toBe(true)
    }
  })

  it('the preview and the fight are one derivation (nodeEncounter carries the groups)', () => {
    const node = { type: 'battle', layer: 5, row: 1 }
    const a = nodeEncounter(node, 777, { allElite: false, eliteDepth: 0 })!
    const b = nodeEncounter(node, 777, { allElite: false, eliteDepth: 0 })!
    expect(a).toEqual(b)
    expect(new Set(a.spawns.map((s) => s.group)).size).toBeGreaterThan(1)
  })

  it("'pause' stops the sim at a breather until resume; one move is allowed", () => {
    const spawns = [at('torch1', 0, 0.5, 0), at('torch1', 0, 0.5, 1)]
    const e = engineFor(spawns, [['rogue', P.s1], ['fighter', P.s2]], { breathers: 'pause' })
    runOut(e, 60 * 60)
    expect(e.status).toBe('running')
    expect(e.breather).toBe(true)
    const tick = e.tick
    e.step(TICK)
    e.step(TICK)
    expect(e.tick).toBe(tick) // frozen
    // A swinger's clearance: no move onto a tile beside a hero with a sword.
    // (The Fighter here is unarmed; it takes a sword in the breather — a gear
    // change, not the move.)
    const f = e.sentinelOnSlot(P.s2)!
    expect(e.regear({ ...f.def, equipment: { ...f.def.equipment, mainHand: { id: 'sw', name: 'Plain Sword', slot: 'oneHand', rarity: 'common', base: {}, enchantments: [] } } })).toBe(true)
    const beside = FIRST_MAP.slots.find((s) => s.id !== P.s1 && withinClearance(s.id, P.s2) && !withinClearance(s.id, P.s1))!
    expect(e.moveHero(P.s1, beside.id)).toBe(false)
    expect(e.moveHero(P.s1, P.s4)).toBe(true)
    expect(e.moveHero(P.s2, P.s5)).toBe(false) // one move per breather
    expect(e.sentinelOnSlot(P.s4)?.def.archetype).toBe('rogue')
    e.resume()
    runOut(e)
    expect(e.status).toBe('cleared')
    expect(e.behaviourStats.breathers).toBe(1)
    expect(e.inputLog.map((i) => i.kind)).toEqual(['gear', 'move', 'resume'])
  })

  it('heroes are never hurt: a blocker holding a column takes nothing and keeps fighting', () => {
    const e = runOut(engineFor([at('barrel3', 0, 8), at('barrel3', 0.5, 8), at('torch4', 1, 8)], [['fighter', P.s1]], { baseHp: 999 }))
    const s = e.sentinels[0] as unknown as Record<string, unknown>
    expect(s.hp).toBeUndefined()
    expect(s.downed).toBeUndefined()
    expect(e.sentinels[0].kills).toBeGreaterThan(0)
  })
})

describe('Watch Commands (Phase 3a)', () => {
  it('one charge per sub-wave, refilled when the next begins', () => {
    const spawns = [at('torch1', 0, 3, 0), at('torch1', 0, 3, 1)]
    const e = engineFor(spawns, [['rogue', P.s1]], { breathers: 'pause' })
    e.step(TICK)
    expect(e.useCommand('rally')).toBe(true)
    expect(e.useCommand('rally')).toBe(false)
    expect(e.rallyUntil).toBeCloseTo(e.elapsed + RALLY.dur, 10)
    runOut(e, 60 * 120)
    expect(e.breather).toBe(true)
    expect(e.useCommand('rally')).toBe(false) // not during the breather
    e.resume()
    expect(e.useCommand('rally')).toBe(true)
  })

  it('a command the company does not carry cannot fire', () => {
    const e = engineFor([at('torch1', 0)], [['rogue', P.s1]])
    e.step(TICK)
    expect(e.useCommand('hold')).toBe(false)
  })

  it('Rally Horn shortens every cooldown by its rate multiplier', () => {
    const e = engineFor(Array.from({ length: 30 }, (_, i) => at('torch2', i * 0.3, 20)), [['rogue', P.s1]])
    const shots = (eng: GameEngine, rally: boolean) => {
      let n = 0
      const count = (ev: string) => void (ev === 'shoot' && n++)
      ;(eng as unknown as { onEvent: (ev: string) => void }).onEvent = count
      runOut(eng, 60 * 6, (x) => void (rally && x.tick === 60 * 3 && x.useCommand('rally')))
      return n
    }
    const plain = shots(e, false)
    const rallied = shots(engineFor(Array.from({ length: 30 }, (_, i) => at('torch2', i * 0.3, 20)), [['rogue', P.s1]]), true)
    expect(rallied).toBeGreaterThan(plain)
  })

  it('Hold the Line swallows the next three leaks, then the Gate takes damage again', () => {
    const e = engineFor(Array.from({ length: 5 }, (_, i) => at('torch1', i * 0.2)), [], { commands: ['hold'], baseHp: 50 })
    e.step(TICK)
    expect(e.useCommand('hold')).toBe(true)
    runOut(e)
    expect(e.behaviourStats.holdBlocked).toBe(HOLD.leaks)
    expect(e.leakCount).toBe(5)
    expect(e.baseHp).toBe(50 - 2 * ENEMY_TYPES.torch1.leak)
  })

  it('Flare slows the front of the column', () => {
    const mk = () => engineFor(Array.from({ length: 4 }, (_, i) => at('torch1', i * 0.1, 50)), [], { commands: ['flare'] })
    const a = mk()
    const b = mk()
    runOut(a, 120)
    runOut(b, 120)
    expect(b.useCommand('flare')).toBe(true)
    runOut(a, 60)
    runOut(b, 60)
    expect(b.enemies[0].distance).toBeLessThan(a.enemies[0].distance)
  })
})

describe('determinism with inputs (Phase 3a)', () => {
  /** A live battle with a player: Rally at a fixed tick, one move + Continue at each breather. */
  function live(ticksPerFrame: number) {
    const w = generateEncounter(6, 'normal', { seed: 4242 })
    const team: [Archetype, string][] = [['fighter', P.s1], ['rogue', P.s2], ['mystic', P.s3]]
    const e = new GameEngine({
      map: FIRST_MAP,
      wave: w,
      placedSentinels: team.map(([a, slotId]) => ({ sentinel: createSentinel(a), slotId })),
      baseHp: 200,
      maxBaseHp: 200,
      enemyHpMult: 2,
      seed: 5,
      breathers: 'pause',
      commands: ['rally', 'flare'],
    })
    let moves = 0
    for (let frame = 0; frame < 100_000 && e.status === 'running'; frame++) {
      if (e.breather) {
        // The player taps between frames.
        e.moveHero(moves % 2 ? P.s2 : P.s1, P.s4)
        moves++
        e.resume()
      } else if (e.enemies.length >= 3 && e.commandReady) {
        e.useCommand(e.subWave % 2 ? 'flare' : 'rally')
      }
      for (let t = 0; t < ticksPerFrame && e.status === 'running'; t++) e.step(TICK)
    }
    return e
  }
  const fingerprint = (e: GameEngine) => {
    const r = e.result()
    return { elapsed: e.elapsed, baseHp: e.baseHp, stats: e.behaviourStats, ...r, perSentinel: r.perSentinel.map(({ id: _id, ...x }) => x) }
  }

  it('is identical at 1×, 2× and 3×, inputs included', () => {
    const a = live(1)
    const b = live(2)
    const c = live(MAX_STEPS_PER_FRAME / 2)
    expect(a.inputLog.length).toBeGreaterThan(2)
    expect(a.inputLog.some((i) => i.kind === 'command')).toBe(true)
    expect(fingerprint(b)).toEqual(fingerprint(a))
    expect(fingerprint(c)).toEqual(fingerprint(a))
  })

  it('replays its own input log to the identical battle', () => {
    const a = live(1)
    const w = generateEncounter(6, 'normal', { seed: 4242 })
    const team: [Archetype, string][] = [['fighter', P.s1], ['rogue', P.s2], ['mystic', P.s3]]
    const replay = new GameEngine({
      map: FIRST_MAP,
      wave: w,
      placedSentinels: team.map(([arch, slotId]) => ({ sentinel: createSentinel(arch), slotId })),
      baseHp: 200,
      maxBaseHp: 200,
      enemyHpMult: 2,
      seed: 5,
      commands: ['rally', 'flare'],
      script: a.inputLog,
    })
    runOut(replay, 200_000)
    expect(fingerprint(replay)).toEqual(fingerprint(a))
    expect(replay.inputLog).toEqual(a.inputLog)
  })
})
