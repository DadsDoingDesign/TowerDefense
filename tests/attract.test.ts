import { describe, expect, it, vi } from 'vitest'

/**
 * The menu's attract-mode battle (Phase 4) must be invisible to the run: a
 * seeded run started after the demo has played has to be dealt exactly what
 * the same seed is dealt cold. The demo shares a process with the game, so the
 * danger is the process-global counters — entity ids, hero names — that a run
 * snapshot records and that seeded content is keyed off.
 */

type Sim = typeof import('../src/ui/attract/attractSim')

/**
 * Direct the scene and play two loops of it, as the menu would: the director's
 * headless play, then the engine rebuilt at the opening frame and stepped to
 * the end of the cut at the loop's 30 fps cadence (two ticks per frame).
 */
function playAll(sim: Sim) {
  const script = sim.directAttract()
  const loops = [0, 1].map(() => {
    const e = sim.createAttractEngine(script.startTick)
    for (let t = 0; t < script.lengthTicks; t += 2) sim.stepAttract(e, 2)
    return e
  })
  return { script, loops }
}

describe('attract-mode battle', () => {
  it('is a directed title sequence: the champion falls in the shot, the knights hold, ~20 s', async () => {
    const sim = await import('../src/ui/attract/attractSim')
    const s = sim.directAttract()
    const secs = s.lengthTicks / 60 + sim.ATTRACT_CUT.hitstop
    expect(secs).toBeGreaterThan(16)
    expect(secs).toBeLessThan(24)
    // The big hit lands late in the cut, with a beat after it before the fade.
    const hitAt = (s.hitTick - s.startTick) / 60
    expect(hitAt).toBeGreaterThan(8)
    expect(secs - hitAt).toBeGreaterThan(sim.ATTRACT_CUT.fadeOut + 1)
    // An advert, not a warning: nothing reaches the Gate, no knight goes down.
    expect(s.leaks).toBe(0)
    expect(s.downed).toBe(0)
    // He fell somewhere the camera can see: on the field, near the company.
    const c = sim.attractFocus()
    expect(Math.hypot(s.hitPos.x - c.x, s.hitPos.y - c.y)).toBeLessThan(200)
    // The camera track covers the whole cut and never leaves the field.
    expect(s.cam.length).toBeGreaterThanOrEqual(Math.floor((s.lengthTicks / 60) * 10))
    for (let t = 0; t <= s.lengthTicks / 60; t += 0.25) {
      const p = sim.attractCamera(s, t)
      expect(p.x).toBeGreaterThan(-60)
      expect(p.x).toBeLessThan(sim.ATTRACT_MAP.width)
      expect(p.y).toBeGreaterThan(0)
      expect(p.y).toBeLessThan(sim.ATTRACT_MAP.height)
    }
  })

  it('is the same loop every time', async () => {
    const sim = await import('../src/ui/attract/attractSim')
    expect(sim.directAttract()).toEqual(sim.directAttract())
    // The chunked director (the renderer's, one idle slice per chunk) cuts
    // the same scene as the straight-through one.
    const it = sim.directAttractSteps(97)
    let r = it.next()
    while (!r.done) r = it.next()
    expect(r.value).toEqual(sim.directAttract())
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

  it('spends no id and no name', async () => {
    const rng = await import('../src/game/core/rng')
    const names = await import('../src/game/data/sentinels')
    const sim = await import('../src/ui/attract/attractSim')
    const ids = rng.idCounterState()
    const nc = names.nameCounterState()
    playAll(sim)
    expect(rng.idCounterState()).toBe(ids)
    expect(names.nameCounterState()).toEqual(nc)
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
