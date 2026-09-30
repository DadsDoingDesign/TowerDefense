/**
 * Q1 exploration CLI: the danger-ground levers (`src/game/data/hazards.ts`)
 * against the three run-level gates they can move — §6's Monte Carlo win rate,
 * §11's fresh-run gates, and §13's Banner ladder. Not a gate; it exists so a
 * lever setting can be tried in-process, on the report's own paired seeds,
 * without editing the shipped values.
 *
 *   npx tsx balance/hazard-sweep.ts [what] [n] [levers]
 *     what    any of `mc`, `fresh`, `banner` joined (e.g. `mc+banner`; default mc)
 *     n       runs per cell (default 300; the report runs §6 at 300, §11 at
 *             120, §13 at 600)
 *     levers  `mult,dangerTiles,dangerPool,obstacles,obstaclePool`, e.g.
 *             `0.75,1,3,3,10` (default: the shipped values). `1,0,0,0,0` is
 *             the field without any hazards — the control.
 *
 * Like every `FW_*` knob, the override lives here and never in `src/`: nothing
 * under `src/` may read `process`.
 */
import * as H from '../src/game/data/hazards'
import { bannerRules, MAX_BANNER } from '../src/state/metaStore'
import type { Archetype } from '../src/game/types'
import { mean } from './harness'
import { monteCarloRun, POLICIES, simulateRun, ZERO_META } from './runsim'

const WHAT = process.argv[2] ?? 'mc'
const N = Number(process.argv[3]) || 300
if (process.argv[4]) {
  const [a, b, c, d, e] = process.argv[4].split(',').map(Number)
  Object.assign(H.HAZARD_LEVERS, { cursedDamageMult: a, dangerTiles: b, dangerPool: c, obstacles: d, obstaclePool: e })
}
const ARCHES: Archetype[] = ['fighter', 'rogue', 'mystic']
const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const t0 = Date.now()
const secs = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`
console.log(`levers ${JSON.stringify(H.HAZARD_LEVERS)}`)

if (WHAT.includes('mc')) {
  const outs = Array.from({ length: N }, (_, r) => monteCarloRun(r))
  const deaths = new Map<number, number>()
  for (const o of outs) if (o.died) deaths.set(o.died, (deaths.get(o.died) ?? 0) + 1)
  const lost = outs.filter((o) => !o.won).length
  const worst = [...deaths.entries()].sort((a, b) => b[1] - a[1])[0] ?? [0, 0]
  const att = outs.filter((o) => o.finalAttempt).length
  console.log(
    `§6 MC n=${N}: win ${pct(outs.filter((o) => o.won).length / N)} | deaths ${[...deaths.entries()].sort((a, b) => a[0] - b[0]).map(([d, c]) => `${d}:${c}`).join(' ')} | worst node ${pct(worst[1] / Math.max(1, lost))} of losses | boss kills ${pct(outs.filter((o) => o.finalKill).length / Math.max(1, att))} (${secs()})`,
  )
}
if (WHAT.includes('fresh')) {
  for (const id of ['specials', 'adaptive']) {
    const p = POLICIES.find((x) => x.id === id)!
    const w = Array.from({ length: N }, (_, i) => (simulateRun(9001 + i * 17, ARCHES[i % 3], { policy: p }).won ? 1 : 0))
    console.log(`§11 fresh (${id}) n=${N}: ${pct(mean(w))} (${secs()})`)
  }
}
if (WHAT.includes('banner')) {
  const p = POLICIES.find((x) => x.id === 'adaptive')!
  const rows: string[] = []
  for (let t = 0; t <= MAX_BANNER; t++) {
    const w: number[] = []
    const m: number[] = []
    for (let i = 0; i < N; i++) {
      const r = simulateRun(9001 + i * 17, ARCHES[i % 3], { meta: ZERO_META, banner: bannerRules(t), policy: p })
      w.push(r.won ? 1 : 0)
      m.push(r.marks)
    }
    rows.push(`B${t} ${pct(mean(w))} / ${mean(m).toFixed(1)} marks`)
  }
  console.log(`§13 Banner ladder n=${N}: ${rows.join(' | ')} (${secs()})`)
}
