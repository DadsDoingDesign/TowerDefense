import { describe, expect, it, vi } from 'vitest'

/**
 * The menu's attract-mode battle (Phase 4) must be invisible to the run: a
 * seeded run started after the demo has played has to be dealt exactly what
 * the same seed is dealt cold. The demo shares a process with the game, so the
 * danger is the process-global counters — entity ids, hero names — that a run
 * snapshot records and that seeded content is keyed off.
 */

type Sim = typeof import('../src/ui/attract/attractSim')

/** Play every scenario to its end, as the menu loop would. */
function playAll(sim: Sim): { status: string; secs: number }[] {
  return sim.ATTRACT_SCENARIOS.map((_, i) => {
    const e = sim.createAttractEngine(i, { preroll: true })
    let ticks = 0
    while (e.status === 'running' && ticks < 60 * 120) {
      sim.stepAttract(e, 2) // the loop's 30 fps cadence: two ticks per frame
      ticks += 2
    }
    return { status: e.status, secs: ticks / 60 }
  })
}

describe('attract-mode battle', () => {
  it('wins every scenario, in a watchable length of fight', async () => {
    const sim = await import('../src/ui/attract/attractSim')
    for (const r of playAll(sim)) {
      expect(r.status).toBe('cleared')
      expect(r.secs).toBeGreaterThan(8)
      expect(r.secs).toBeLessThan(90)
    }
  })

  it('is the same loop every time', async () => {
    const sim = await import('../src/ui/attract/attractSim')
    const once = (i: number) => {
      const e = sim.createAttractEngine(i)
      while (e.status === 'running') sim.stepAttract(e, 60)
      const { perSentinel, ...r } = e.result()
      return { ...r, elapsed: e.elapsed, baseHp: e.baseHp, perSentinel }
    }
    for (let i = 0; i < sim.ATTRACT_SCENARIOS.length; i++) expect(once(i)).toEqual(once(i))
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
