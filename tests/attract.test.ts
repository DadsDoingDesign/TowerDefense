import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { dailySeed } from '../src/state/daily'

/**
 * The menu's attract-mode battle (Phase 4, H1-2, Q12).
 *
 * It is a title sequence drawn from a seed — today's Daily Watch seed on the
 * menu — so these hold three things: every seed lands on a scene that gives
 * the directed beats (a sweep of dates), a seed always lands on the SAME scene
 * and loop, and the demo is invisible to the run: a seeded run started after
 * it has played has to be dealt exactly what the same seed is dealt cold.
 */

type Sim = typeof import('../src/ui/attract/attractSim')
type Script = ReturnType<Sim['directAttract']>

const ROOT = join(__dirname, '..')
const dateKey = (i: number) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10)
const TODAY = dailySeed('2026-10-01')

/**
 * Direct the scene and play two loops of it, as the menu would: the director's
 * headless play, then the engine rebuilt at the opening frame and stepped to
 * the end of the cut at the loop's 30 fps cadence (two ticks per frame).
 */
function playAll(sim: Sim, seed = TODAY) {
  const script = sim.directAttract(seed)
  const loops = [0, 1].map(() => {
    const e = sim.createAttractEngine(script.scene, script.startTick)
    for (let t = 0; t < script.lengthTicks; t += 2) sim.stepAttract(e, 2)
    return e
  })
  return { script, loops }
}

/** The beats every cut must have — the round-2 checks, per scene. */
function expectBeats(sim: Sim, s: Script, label: string) {
  const secs = s.lengthTicks / 60 + sim.ATTRACT_CUT.hitstop
  expect(secs, `${label}: loop length`).toBeGreaterThanOrEqual(16)
  expect(secs, `${label}: loop length`).toBeLessThan(24)
  // The big hit lands late in the cut, with a beat after it before the fade.
  const hitAt = (s.hitTick - s.startTick) / 60
  expect(hitAt, `${label}: the hit comes after the walk`).toBeGreaterThan(8)
  expect(secs - hitAt, `${label}: a beat after the hit`).toBeGreaterThan(sim.ATTRACT_CUT.fadeOut + 1)
  // An advert, not a warning: nothing reaches the Gate, no hero goes down.
  expect(s.leaks, `${label}: leaks`).toBe(0)
  expect(s.downed, `${label}: downed`).toBe(0)
  // He fell somewhere the camera can see: on the field, near the company.
  expect(Math.hypot(s.hitPos.x - s.focus.x, s.hitPos.y - s.focus.y), `${label}: fell on screen`).toBeLessThan(200)
  // The camera track covers the whole cut and never leaves the field.
  expect(s.cam.length).toBeGreaterThanOrEqual(Math.floor((s.lengthTicks / 60) * 10))
  for (let t = 0; t <= s.lengthTicks / 60; t += 0.25) {
    const p = sim.attractCamera(s, t)
    expect(p.x, `${label}: camera x at ${t}s`).toBeGreaterThan(-60)
    expect(p.x, `${label}: camera x at ${t}s`).toBeLessThan(s.map.width)
    expect(p.y, `${label}: camera y at ${t}s`).toBeGreaterThan(0)
    expect(p.y, `${label}: camera y at ${t}s`).toBeLessThan(s.map.height)
  }
}

describe('attract-mode battle', () => {
  it('every date lands on a directed title sequence (50-day sweep)', async () => {
    const sim = await import('../src/ui/attract/attractSim')
    const seen = new Set<string>()
    let fallbacks = 0
    for (let i = 0; i < 50; i++) {
      const date = dateKey(i)
      const s = sim.directAttract(dailySeed(date))
      expectBeats(sim, s, date)
      // A kept draw of the day's own seed, not the authored fallback.
      if (s.scene.take < 0) fallbacks++
      expect(s.scene.company.some((c) => c.archetype === 'fighter'), `${date}: a Fighter holds`).toBe(true)
      seen.add(JSON.stringify([s.scene.fieldId, s.scene.rule, s.scene.kind, s.scene.depth, s.scene.company]))
    }
    expect(fallbacks).toBe(0)
    // Fifty days, fifty different scenes.
    expect(seen.size).toBe(50)
  }, 60_000)

  it('the scene varies over the things the brief names: field, flavour, foe, company', async () => {
    const sim = await import('../src/ui/attract/attractSim')
    const scenes = Array.from({ length: 50 }, (_, i) => sim.directAttract(dailySeed(dateKey(i))).scene)
    expect(new Set(scenes.map((s) => s.fieldId)).size).toBe(2)
    expect(new Set(scenes.map((s) => s.rule)).size).toBe(3)
    expect(new Set(scenes.map((s) => s.kind)).size).toBe(2)
    expect(new Set(scenes.flatMap((s) => s.company.map((c) => c.branchPath.at(-1)))).size).toBeGreaterThan(8)
  }, 60_000)

  it('the authored fallback gives the beats too', async () => {
    const sim = await import('../src/ui/attract/attractSim')
    const s = sim.judgeScene(sim.FALLBACK_SCENE)
    expect(typeof s).not.toBe('string')
    expectBeats(sim, s as Script, 'fallback')
  })

  it('rejects draws that miss a beat, and re-rolls deterministically', async () => {
    const sim = await import('../src/ui/attract/attractSim')
    // Find a date whose first draw is rejected; the kept scene is a later take.
    let found = false
    for (let i = 0; i < 50 && !found; i++) {
      const seed = dailySeed(dateKey(i))
      const first = sim.judgeScene(sim.composeScene(seed, 0))
      if (typeof first !== 'string') continue
      found = true
      expect(['leak', 'downed', 'no-headliner', 'slow', 'quick', 'off-shot']).toContain(first)
      const s = sim.directAttract(seed)
      expect(s.scene.take).toBeGreaterThan(0)
      expect(s.rejected).toBe(s.scene.take)
      // Every draw before the kept one was rejected, and the kept one is the draw itself.
      for (let t = 0; t < s.scene.take; t++) expect(typeof sim.judgeScene(sim.composeScene(seed, t))).toBe('string')
      expect(s.scene).toEqual(sim.composeScene(seed, s.scene.take))
    }
    expect(found).toBe(true)
  }, 60_000)

  it('same seed → the same scene and the same loop, every time', async () => {
    const sim = await import('../src/ui/attract/attractSim')
    expect(sim.composeScene(TODAY, 0)).toEqual(sim.composeScene(TODAY, 0))
    expect(sim.directAttract(TODAY)).toEqual(sim.directAttract(TODAY))
    // The chunked director (the renderer's, one idle slice per chunk) cuts
    // the same scene as the straight-through one — on every date, including
    // the ones whose first draws are thrown away. (It did not while the sim
    // minted ids from the global counter per chunk: a goblin spawned a chunk
    // later could take the champion's id, and the menu played another scene.)
    for (let i = 0; i < 12; i++) {
      const seed = dailySeed(dateKey(i))
      const straight = sim.directAttract(seed)
      for (const chunk of [97, 240]) {
        const it = sim.directAttractSteps(seed, chunk)
        let r = it.next()
        while (!r.done) r = it.next()
        expect(r.value, `${dateKey(i)} in ${chunk}-tick chunks`).toEqual(straight)
      }
    }
    const { loops } = playAll(sim)
    const snap = (e: (typeof loops)[number]) => ({
      tick: e.tick,
      baseHp: e.baseHp,
      kills: e.killCount,
      enemies: e.enemies.map((x) => [x.type.id, x.hp, x.pos.x, x.pos.y]),
      heroes: e.sentinels.map((x) => [x.id, x.hp]),
    })
    expect(snap(loops[1])).toEqual(snap(loops[0]))
  })

  it('different dates → different scenes', async () => {
    const sim = await import('../src/ui/attract/attractSim')
    const a = sim.directAttract(dailySeed('2026-10-01'))
    const b = sim.directAttract(dailySeed('2026-10-02'))
    expect(a.scene).not.toEqual(b.scene)
  })

  it('spends no id and no name', async () => {
    const rng = await import('../src/game/core/rng')
    const names = await import('../src/game/data/sentinels')
    const sim = await import('../src/ui/attract/attractSim')
    const ids = rng.idCounterState()
    const nc = names.nameCounterState()
    playAll(sim)
    // A day whose first draw was rejected too: the throwaway fights mint nothing either.
    playAll(sim, dailySeed(dateKey(4)))
    expect(rng.idCounterState()).toBe(ids)
    expect(names.nameCounterState()).toEqual(nc)
  })

  it('stays sealed: the sim imports nothing from the store; only the gatekeeper reads the day', () => {
    const sim = readFileSync(join(ROOT, 'src/ui/attract/attractSim.ts'), 'utf8')
    const battle = readFileSync(join(ROOT, 'src/ui/attract/AttractBattle.tsx'), 'utf8')
    for (const src of [sim, battle]) expect(src).not.toMatch(/from '\.\.\/\.\.\/state\//)
    const gate = readFileSync(join(ROOT, 'src/ui/shell/AttractMode.tsx'), 'utf8')
    expect(gate).toMatch(/dailySeed\(utcDateKey\(\)\)/)
    expect(gate).not.toMatch(/gameStore|metaStore/)
  })

  it('leaves a seeded run started afterwards identical to the same run started cold', async () => {
    const SEED = 0xc0ffee
    /**
     * A fresh module graph — one page load. The store is evaluated at boot
     * (main.tsx) and the demo arrives later as a lazy chunk after idle, so that
     * is the order here too; the demo then plays its whole loop on the menu
     * before the player starts the run.
     */
    const dealRun = async (withAttract: boolean) => {
      vi.resetModules()
      // The store's initial state deals a placeholder run map from a fresh
      // entropy seed at import, which mints a random number of ids; pin the
      // entropy so both page loads start from the same counter.
      const pins = [
        vi.spyOn(Math, 'random').mockReturnValue(0.4242),
        vi.spyOn(Date, 'now').mockReturnValue(1_750_000_000_000),
        vi.spyOn(performance, 'now').mockReturnValue(1234.5),
      ]
      const { useGameStore } = await import('../src/state/gameStore')
      for (const p of pins) p.mockRestore()
      if (withAttract) playAll(await import('../src/ui/attract/attractSim'))
      const { STANDARD_RUN } = await import('../src/state/daily')
      const { idCounterState } = await import('../src/game/core/rng')
      const s = useGameStore.getState()
      s.beginCampaign(SEED, STANDARD_RUN)
      useGameStore.getState().pickStartingHero('rogue')
      const st = useGameStore.getState()
      return JSON.stringify({
        roster: st.roster,
        inventory: st.inventory,
        runMap: st.runMap,
        gold: st.gold,
        ids: idCounterState(),
      })
    }
    const cold = await dealRun(false)
    const afterDemo = await dealRun(true)
    expect(afterDemo).toBe(cold)
  })
})
