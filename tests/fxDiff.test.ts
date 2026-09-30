// `render/plaques.ts` (reached through `render/units.ts`) reads `import.meta.env`;
// the node test program does not include `src/vite-env.d.ts`, so say it here.
/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import { TICK, type GameEngine } from '../src/game/engine/engine'
import { ATTRITION_EPS, FxDiffer, burnToll, deathClass, isDiscreteDrop, soleProc, type FxSink } from '../src/game/render/fxDiff'

/*
 * The FX differ on synthetic engine snapshots: a plain object shaped like the
 * slice of `GameEngine` the differ reads, stepped by hand between
 * `snapBefore` and `diffAfter`. The sink records what the differ decided.
 */

type Call = { fn: keyof FxSink; args: unknown[] }
function recorder(): { sink: FxSink; calls: Call[]; names: () => string[] } {
  const calls: Call[] = []
  const sink = new Proxy({} as FxSink, {
    get: (_t, fn: string) => (...args: unknown[]) => void calls.push({ fn: fn as keyof FxSink, args }),
  })
  return { sink, calls, names: () => calls.map((c) => c.fn) }
}

interface FakeEnemy {
  id: string
  hp: number
  pos: { x: number; y: number }
  distance: number
  burnDps: number
  burnUntil: number
  burnType: 'physical' | 'magic'
  blockedBy: string | null
  type: { id: string; isBoss?: boolean; radius: number; color: string; physResist?: number; magResist?: number }
}
const enemy = (id: string, over: Partial<FakeEnemy> = {}): FakeEnemy => ({
  id,
  hp: 100,
  pos: { x: 100, y: 100 },
  distance: 50,
  burnDps: 0,
  burnUntil: 0,
  burnType: 'magic',
  blockedBy: null,
  type: { id: 'torch1', radius: 12, color: '#b05050' },
  ...over,
})

function fakeEngine(over: Record<string, unknown> = {}) {
  return {
    enemies: [] as FakeEnemy[],
    projectiles: [] as unknown[],
    sentinels: [] as unknown[],
    floaters: [] as { id: string; text: string; color: string; pos: { x: number; y: number } }[],
    traps: [] as unknown[],
    leakCount: 0,
    status: 'running',
    elapsed: 10,
    baseHp: 20,
    maxBaseHp: 20,
    map: { width: 960, height: 560, base: { x: 990, y: 520 }, path: [{ x: 0, y: 0 }, { x: 990, y: 520 }] },
    ...over,
  }
}
const asEngine = (e: ReturnType<typeof fakeEngine>) => e as unknown as GameEngine

describe('fx differ predicates', () => {
  it('burnToll is the engine arithmetic: dps × TICK, resisted by the burn type', () => {
    const e = { burnDps: 180, burnUntil: 12, burnType: 'physical' as const }
    // The multipliers are `engine.takenMult` — `1 - resist` with no aura or frost.
    expect(burnToll(e, 11, 1 - 0.55, 1 - 0.1)).toBe(180 * TICK * (1 - 0.55))
    expect(burnToll({ ...e, burnType: 'magic' }, 11, 1 - 0.55, 1 - 0.1)).toBe(180 * TICK * (1 - 0.1))
    // Expired on the clock the tick will run against.
    expect(burnToll(e, 12, 1 - 0.55, 1 - 0.1)).toBe(0)
    expect(burnToll({ ...e, burnDps: 0 }, 11, 1, 1)).toBe(0)
  })

  it('a drop equal to the exact attrition toll is NOT a hit; any more is (C1)', () => {
    const atr = 1.35
    expect(isDiscreteDrop(100, 100 - atr, atr)).toBe(false)
    expect(isDiscreteDrop(100, 100 - atr - ATTRITION_EPS / 10, atr)).toBe(false)
    expect(isDiscreteDrop(100, 100 - atr - 0.01, atr)).toBe(true)
    expect(isDiscreteDrop(100, 100, 0)).toBe(false)
    expect(isDiscreteDrop(100, 105, 0)).toBe(false)
    // Vanished: a kill or a leak, settled elsewhere — counts as damaged.
    expect(isDiscreteDrop(100, undefined, 5)).toBe(true)
  })

  it('soleProc names a proc only when the tower carries exactly one', () => {
    expect(soleProc({ burn: { dps: 1, dur: 1 } })).toBe('burn')
    expect(soleProc({ shock: { chains: 2, dmgFrac: 0.5 } } as never)).toBe('shock')
    expect(soleProc({ shock: { chains: 0, dmgFrac: 0.5 } } as never)).toBe(null)
    expect(soleProc({ burn: { dps: 1, dur: 1 }, execute: 0.1 } as never)).toBe(null)
    expect(soleProc({})).toBe(null)
  })

  it('deathClass follows the faction prefix', () => {
    expect(deathClass('torch3')).toBe('torch')
    expect(deathClass('tnt1')).toBe('tnt')
    expect(deathClass('barrel5')).toBe('barrel')
    expect(deathClass('wolf')).toBe('other')
  })
})

describe('FxDiffer on synthetic ticks', () => {
  it('a burning enemy losing exactly its burn toll pulses attrition, never a hit', () => {
    const eng = fakeEngine()
    const e = enemy('en1', { burnDps: 180, burnUntil: 99, burnType: 'physical', type: { id: 'torch2', radius: 12, color: '#fff', physResist: 0.55 } })
    eng.enemies.push(e)
    const r = recorder()
    const d = new FxDiffer(asEngine(eng), r.sink)
    d.snapBefore(asEngine(eng))
    e.hp -= 180 * TICK * (1 - 0.55)
    eng.elapsed += TICK
    d.diffAfter(asEngine(eng), 1)
    expect(r.names()).toContain('fxDotEnemy')
    expect(r.names()).not.toContain('fxHitEnemy')
    expect(r.names()).not.toContain('fxImpact')
  })

  it('a shot that lands on a burning enemy is still a hit (and not an attrition pulse)', () => {
    const eng = fakeEngine()
    const e = enemy('en1', { burnDps: 40, burnUntil: 99 })
    eng.enemies.push(e)
    eng.projectiles.push({
      id: 'p1', pos: { x: 90, y: 100 }, toPos: { x: 100, y: 100 }, isCrit: false, splashRadius: 0, srcId: 's1',
      targetId: 'en1', mods: {}, pierce: 0,
    })
    const r = recorder()
    const d = new FxDiffer(asEngine(eng), r.sink)
    d.snapBefore(asEngine(eng))
    eng.projectiles.length = 0 // arrived
    e.hp -= 40 * TICK + 12 // burn + the shot
    d.diffAfter(asEngine(eng), 1)
    expect(r.names()).toContain('fxHitEnemy')
    expect(r.names()).toContain('fxImpact')
    expect(r.names()).not.toContain('fxDotEnemy')
  })

  it('splits vanished enemies into leaks (furthest along) and kills by the leak head count', () => {
    const eng = fakeEngine()
    eng.enemies.push(enemy('near', { distance: 10 }), enemy('far', { distance: 900 }))
    const r = recorder()
    const d = new FxDiffer(asEngine(eng), r.sink)
    d.snapBefore(asEngine(eng))
    eng.enemies.length = 0
    eng.leakCount = 1
    eng.baseHp = 18
    d.diffAfter(asEngine(eng), 1)
    const kills = r.calls.filter((c) => c.fn === 'fxKill')
    expect(r.calls.filter((c) => c.fn === 'fxLeak')).toHaveLength(1)
    expect(kills).toHaveLength(1)
    expect(kills[0].args[0]).toBe('near')
    expect(r.calls.find((c) => c.fn === 'fxBaseFrac')?.args[0]).toBe(18 / 20)
  })

  it('reports a shot fired and the defeat once', () => {
    const eng = fakeEngine()
    const hero = {
      id: 's1', fireFlash: 0, procFlash: 0, pos: { x: 5, y: 5 }, aimAngle: 0.3, def: { accent: '#fff' },
      profile: { mods: {}, thorns: 0, damageType: 'physical' }, blockIds: [] as string[],
    }
    eng.sentinels.push(hero)
    const r = recorder()
    const d = new FxDiffer(asEngine(eng), r.sink)
    d.snapBefore(asEngine(eng))
    hero.fireFlash = 1
    eng.status = 'defeated'
    d.diffAfter(asEngine(eng), 1)
    expect(r.names()).toEqual(expect.arrayContaining(['fxMuzzle', 'fxDefeat']))
    // The next tick does not announce the same defeat again.
    d.snapBefore(asEngine(eng))
    d.diffAfter(asEngine(eng), 1)
    expect(r.names().filter((n) => n === 'fxDefeat')).toHaveLength(1)
  })

  it('each battle gets its own differ: nothing is shared between instances', () => {
    const a = fakeEngine()
    a.floaters.push({ id: 'f1', text: '12', color: '#fff', pos: { x: 0, y: 0 } })
    const ra = recorder()
    const da = new FxDiffer(asEngine(a), ra.sink)
    // Arming on an engine marks its existing floaters as seen…
    da.snapBefore(asEngine(a))
    da.diffAfter(asEngine(a), 1)
    expect(ra.names()).not.toContain('fxFloater')
    // …but a second differ on a different engine has its own memory.
    const b = fakeEngine()
    const rb = recorder()
    const db = new FxDiffer(asEngine(b), rb.sink)
    db.snapBefore(asEngine(b))
    b.floaters.push({ id: 'f1', text: '12', color: '#fff', pos: { x: 0, y: 0 } })
    db.diffAfter(asEngine(b), 1)
    expect(rb.names()).toContain('fxFloater')
  })
})

describe('unit animation helpers (render/units)', () => {
  it('the barrel roll only ever advances with distance, a quarter turn per 1.6r', async () => {
    const { rollPoseFor } = await import('../src/game/render/units')
    const r = 12
    let prev = rollPoseFor(0, r)
    let changes = 0
    for (let d = 0.5; d <= 400; d += 0.5) {
      const p = rollPoseFor(d, r)
      if (p !== prev) {
        expect(p).toBe((prev + 1) % 4)
        changes++
      }
      prev = p
    }
    expect(changes).toBe(Math.floor(400 / (r * 1.6)))
  })

  it('the walk cycle steps once per STRIDE of ground, phase-shifted per unit', async () => {
    const { walkFrameFor, idPhase } = await import('../src/game/render/units')
    const frames = 6
    const seq = (id: string) => Array.from({ length: 12 }, (_, i) => walkFrameFor(i * 13.5 + 0.01, id, frames))
    const a = seq('en1')
    for (let i = 1; i < a.length; i++) expect(a[i]).toBe((a[i - 1] + 1) % frames)
    expect(idPhase('en1')).toBe(idPhase('en1'))
    expect(new Set(['en1', 'en2', 'en3', 'en7', 'en9'].map((id) => walkFrameFor(0, id, frames))).size).toBeGreaterThan(1)
  })
})
