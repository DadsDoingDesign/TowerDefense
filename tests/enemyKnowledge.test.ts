import { beforeEach, describe, expect, it } from 'vitest'
import { ENEMY_TYPES } from '../src/game/data/enemies'
import {
  addFelled,
  enemyKind,
  FELLED_CAP,
  knowledgeOf,
  sanitizeFelled,
  STUDY_KILLS,
  STUDY_KILLS_BOSS,
} from '../src/game/data/enemyKnowledge'
import { FIRST_MAP, legacyPosts } from '../src/game/data/maps'
import { createSentinel } from '../src/game/data/sentinels'
import { GameEngine, TICK } from '../src/game/engine/engine'
import type { WaveDef } from '../src/game/types'
import { migrateMeta, useMetaStore } from '../src/state/metaStore'
import { enemyCardData, learnLine, paceWord } from '../src/ui/shell/enemyFacts'

/**
 * Q10 — the enemy info card's knowledge rule: never faced → name only; faced
 * (or felled once) → HP and pace; felled STUDY_KILLS (1 for a champion) →
 * tricks and Gate cost. Armour and an elite's modifier are on every wave's
 * scouting report, so the card always shows them.
 */

const facts = (enemies: string[] = [], felled: Record<string, number> = {}) => ({ enemies, felled })

describe('enemy knowledge (Q10)', () => {
  it('a kind is the key without its elite modifier; a specialist is its own kind', () => {
    expect(enemyKind('barrel3')).toBe('barrel3')
    expect(enemyKind('barrel3_plated')).toBe('barrel3')
    expect(enemyKind('torch3_shaman')).toBe('torch3_shaman')
    expect(enemyKind('torch3_shaman_swift')).toBe('torch3_shaman')
    // Every registered key resolves to a registered kind.
    for (const key of Object.keys(ENEMY_TYPES)) expect(ENEMY_TYPES[enemyKind(key)]).toBeDefined()
  })

  it('new → met → known, on what the Codex already records plus the felled tally', () => {
    expect(knowledgeOf('tnt2', facts()).level).toBe('new')
    // Met in a wave (the Codex records the modded key; it still counts).
    expect(knowledgeOf('tnt2', facts(['tnt2_warded'])).level).toBe('met')
    // Felled once without a Codex sighting (an old save) is met too.
    expect(knowledgeOf('tnt2', facts([], { tnt2: 1 })).level).toBe('met')
    expect(knowledgeOf('tnt2', facts(['tnt2'], { tnt2: STUDY_KILLS - 1 })).level).toBe('met')
    expect(knowledgeOf('tnt2', facts(['tnt2'], { tnt2: STUDY_KILLS }))).toEqual({
      level: 'known',
      kind: 'tnt2',
      felled: STUDY_KILLS,
      need: STUDY_KILLS,
    })
    // Knowledge is shared across an elite's modifiers.
    expect(knowledgeOf('tnt2_plated', facts([], { tnt2: STUDY_KILLS })).level).toBe('known')
    // …but not with a different kind in the same faction.
    expect(knowledgeOf('tnt3', facts(['tnt2'], { tnt2: 50 })).level).toBe('new')
  })

  it('a champion is known after one kill', () => {
    expect(STUDY_KILLS_BOSS).toBe(1)
    expect(knowledgeOf('torch5', facts(['torch5'])).level).toBe('met')
    expect(knowledgeOf('torch5', facts(['torch5'], { torch5: 1 })).level).toBe('known')
    expect(knowledgeOf('torch5_swift', facts([], { torch5: 1 })).need).toBe(1)
  })

  it('the live wave’s own kills count before the wave settles', () => {
    const k = knowledgeOf('torch1', facts(['torch1'], { torch1: 3 }), { felled: 2 })
    expect(k.felled).toBe(5)
    expect(k.level).toBe('known')
  })

  it('a kind this wave introduced stays unmet until one spawns (the Codex notes the line-up at wave start)', () => {
    expect(knowledgeOf('torch3', facts(['torch3']), { notYetSeen: true }).level).toBe('new')
    // …but a kill always counts.
    expect(knowledgeOf('torch3', facts(['torch3']), { notYetSeen: true, felled: 1 }).level).toBe('met')
  })

  it('addFelled folds kills-by-key into kinds and drops junk', () => {
    const next = addFelled({ torch1: 2 }, [
      ['torch1', 1],
      ['torch1_plated', 2],
      ['tnt2_warded', 1],
      ['nope', 5],
      ['barrel1', 0],
      ['barrel2', -3],
    ])
    expect(next).toEqual({ torch1: 5, tnt2: 1 })
    // Nothing to add: no new object (so the store does not write).
    expect(addFelled({ torch1: 2 }, [['nope', 1]])).toBeNull()
    expect(addFelled({ torch1: FELLED_CAP }, [['torch1', 5]])).toEqual({ torch1: FELLED_CAP })
  })

  it('sanitizeFelled keeps only known kinds with whole positive counts', () => {
    expect(
      sanitizeFelled({ torch1: 3.7, tnt2: -1, barrel1: 'x', nope: 4, torch1_plated: 2, torch3_shaman: 2, barrel2: Infinity, barrel3: 1e12 }),
    ).toEqual({ torch1: 3, torch3_shaman: 2, barrel3: FELLED_CAP })
    expect(sanitizeFelled(null)).toEqual({})
    expect(sanitizeFelled([1, 2])).toEqual({})
    expect(sanitizeFelled('torch1')).toEqual({})
  })
})

describe('felled tally in the meta save (Q10)', () => {
  beforeEach(() => useMetaStore.getState().resetMeta())

  it('an older save migrates with an empty tally; a corrupt one is scrubbed', () => {
    expect(migrateMeta({ codex: { enemies: ['torch1'] } }, 4).codex.felled).toEqual({})
    expect(migrateMeta({ codex: { felled: { torch1: 2, bogus: 9, tnt1: -2 } } }, 4).codex.felled).toEqual({ torch1: 2 })
    expect(migrateMeta({ codex: { felled: 'lots' } }, 4).codex.felled).toEqual({})
  })

  it('recordFelled adds to the tally by kind and leaves the rest of the Codex alone', () => {
    const s = useMetaStore.getState()
    s.recordCodex({ enemies: ['torch1'] })
    s.recordFelled(new Map([['torch1', 2], ['torch1_swift', 1]]))
    s.recordFelled([['torch1', 1]])
    const c = useMetaStore.getState().codex
    expect(c.felled).toEqual({ torch1: 4 })
    expect(c.enemies).toEqual(['torch1'])
    // A later sighting keeps the tally.
    s.recordCodex({ enemies: ['tnt1'] })
    expect(useMetaStore.getState().codex.felled).toEqual({ torch1: 4 })
  })
})

describe('the engine’s kill tally (Q10)', () => {
  it('counts every kill by registry key, and adds up to the kill count', () => {
    const P = legacyPosts(FIRST_MAP.id)
    const wave: WaveDef = {
      index: 1,
      label: 't',
      isBoss: false,
      spawns: [
        { typeId: 'torch1', at: 0, hpMult: 0.3 },
        { typeId: 'torch1_swift', at: 0.5, hpMult: 0.3 },
        { typeId: 'torch2', at: 1, hpMult: 0.3 },
        { typeId: 'torch1', at: 1.5, hpMult: 0.3 },
      ],
    }
    const engine = new GameEngine({
      map: FIRST_MAP,
      wave,
      placedSentinels: [
        { sentinel: createSentinel('rogue'), slotId: P.s1 },
        { sentinel: createSentinel('mystic'), slotId: P.s2 },
        { sentinel: createSentinel('fighter'), slotId: P.s3 },
      ],
      baseHp: 200,
      maxBaseHp: 200,
      seed: 7,
    })
    for (let i = 0; i < 60 * 300 && engine.status === 'running'; i++) engine.step(TICK)
    expect(engine.killCount).toBeGreaterThan(0)
    const sum = [...engine.killsByKey.values()].reduce((a, b) => a + b, 0)
    expect(sum).toBe(engine.killCount)
    for (const key of engine.killsByKey.keys()) expect(wave.spawns.map((s) => s.typeId)).toContain(key)
  })
})

describe('the card’s contents (Q10)', () => {
  const wave: WaveDef = {
    index: 1,
    label: 't',
    isBoss: false,
    spawns: [
      { typeId: 'tnt2', at: 0, hpMult: 1.5 },
      { typeId: 'tnt2', at: 1, hpMult: 2, group: 1 },
      { typeId: 'barrel3_plated', at: 2, hpMult: 1 },
    ],
  }
  const ctx = (level: 'new' | 'met' | 'known') => ({
    wave,
    hpMult: 1.42,
    laneLength: 2290,
    knowledge: { level, kind: 'x', felled: level === 'known' ? 5 : level === 'met' ? 2 : 0, need: 5 },
  })

  it('a new enemy shows only its name, armour and modifier; the rest is unknown', () => {
    const d = enemyCardData('barrel3_plated', ctx('new'))!
    expect(d.name).toBe('Ironbarrel · Plated')
    expect(d.hp).toBeNull()
    expect(d.pace).toBeNull()
    expect(d.tricks).toBeNull()
    expect(d.gate).toBeNull()
    // Scouting-report facts are always shown.
    expect(d.armour).toEqual([`Physical ${Math.round(ENEMY_TYPES.barrel3_plated.physResist! * 100)}%`])
    expect(d.mod).toMatch(/physical damage bounces/)
    expect(learnLine(d)).toMatch(/Not met yet/)
  })

  it('a met enemy adds the real HP this wave fields (Threat in) and its pace', () => {
    const d = enemyCardData('tnt2', ctx('met'))!
    // baseHp 60 × the spawns' hpMult (1.5, 2) × the battle's 1.42, rounded as the engine does.
    expect(d.hp).toEqual([Math.round(60 * 1.5 * 1.42), Math.round(60 * 2 * 1.42)])
    expect(d.pace).toEqual({ word: paceWord(98), seconds: Math.round(2290 / 98) })
    expect(d.armour).toEqual(['Magic 15%'])
    expect(d.tricks).toBeNull()
    expect(d.gate).toBeNull()
    expect(learnLine(d)).toBe('Felled 2. Fell 3 more to learn its tricks.')
  })

  it('a known enemy adds its tricks, the counter, and its Gate cost', () => {
    const d = enemyCardData('tnt2', ctx('known'))!
    expect(d.tricks).toEqual([{ label: 'Lobs a charge at a hero post', counter: expect.stringMatching(/wind-up/) }])
    expect(d.gate).toBe(2)
    expect(enemyCardData('torch1', ctx('known'))!.tricks).toEqual([])
    expect(enemyCardData('nope', ctx('known'))).toBeNull()
  })
})
