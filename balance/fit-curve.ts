/**
 * Difficulty-curve fitting rig — Node-only exploration, like `meta-sweep.ts`.
 *
 *   npx tsx balance/fit-curve.ts <BUDGET_BASE> <BUDGET_RATIO_TOP> <BOSS_STEP> [n]
 *
 * `waves.ts` owns three constants that shape the whole campaign — the depth-1
 * budget, the step between consecutive depths, and the boss's discount on the
 * node before it. Re-fitting them by editing the file and running the full
 * suite costs a minute a candidate, which is too slow to actually search.
 *
 * A budget change is, to first order, an enemy-HP change: `kindBudget` is
 * spent by `roster()` on a *designed* head count, so a budget ×k lands as an
 * `hpMult` ×k on the same bodies. This rig therefore replays both gated models
 * — §11's fresh run and §6's Monte Carlo — with the candidate curve applied as
 * a per-depth HP multiplier, and prints the four numbers the invariants read.
 * The winning candidate then goes into `waves.ts` as real constants and the
 * full suite confirms it.
 */
import { RNG } from '../src/game/core/rng'
import { MAX_BASE_HP, THREAT_PER_CHOICE, THREAT_PER_NODE } from '../src/state/gameStore'
import type { Archetype, ItemRarity } from '../src/game/types'
import { buildSpec, depthUpgrades, mean, runBattle, TIER2_NODES } from './harness'
import { POLICIES, simulateRun, ZERO_META } from './runsim'

// The shipped constants this rig perturbs (`waves.ts`).
const BASE = 170
const TOP = 2.7
const FLOOR = 1.3
const DECAY = 0.8
const BOSS = 0.78

const nBase = Number(process.argv[2]) || BASE
const nTop = Number(process.argv[3]) || TOP
const nFloor = Number(process.argv[4]) || FLOOR
const nBoss = Number(process.argv[5]) || BOSS
const N = Number(process.argv[6]) || 120

const step = (d: number, top: number, floor: number) => floor + (top - floor) * DECAY ** (d - 2)
function budget(depth: number, base: number, top: number, floor: number): number {
  let b = base
  for (let d = 2; d <= depth; d++) b *= step(d, top, floor)
  return b
}
/** Candidate ÷ shipped budget at this depth — the HP multiplier that emulates it. */
const ratio = (d: number) => budget(d, nBase, nTop, nFloor) / budget(d, BASE, TOP, FLOOR)
/** The boss is quoted off the node before it, times its own step. */
const bossRatio = (d: number) => ratio(Math.max(1, d - 1)) * (nBoss / BOSS)
const curve = (d: number, kind: string) => (kind === 'boss' ? bossRatio(d) : ratio(d))

const pct = (n: number) => `${(n * 100).toFixed(0)}%`
const ARCHES: Archetype[] = ['fighter', 'rogue', 'mystic']

console.log(
  `candidate: BUDGET_BASE ${nBase}, RATIO_TOP ${nTop}, RATIO_FLOOR ${nFloor}, BOSS_STEP ${nBoss}`,
)
console.log(
  '  budget by depth: ' +
    Array.from({ length: 10 }, (_, i) => `${i + 1}:${budget(i + 1, nBase, nTop, nFloor).toFixed(0)}(×${ratio(i + 1).toFixed(2)})`).join(' '),
)

// ---- §11: the fresh run, per policy ----------------------------------------
for (const p of POLICIES) {
  const rows = Array.from({ length: N }, (_, i) =>
    simulateRun(9001 + i * 17, ARCHES[i % 3], { meta: ZERO_META, policy: p, curve }),
  )
  const endings = new Array(12).fill(0)
  for (const r of rows) if (!r.won) endings[r.reached + 1]++
  const worst = Math.max(...endings)
  console.log(
    `  §11 ${p.id.padEnd(9)} win ${pct(mean(rows.map((r) => (r.won ? 1 : 0))))}  nodes ${mean(rows.map((r) => r.cleared)).toFixed(1)}  worst node depth ${endings.indexOf(worst)} ends ${pct(worst / rows.length)}`,
  )
}

// ---- §6: the Monte Carlo, same model as report.ts --------------------------
{
  const RUNS = Math.round(N * 0.8)
  const mcRng = new RNG(2024)
  const depthLevel = (d: number) => Math.min(20, 2 + d * 2)
  const depthRarity = (d: number): ItemRarity => (d < 3 ? 'common' : d < 6 ? 'rare' : d < 9 ? 'epic' : 'legendary')
  const slots = ['s3', 's0', 's5', 's1', 's4', 's2']
  let wins = 0
  let bossAttempts = 0
  let bossKills = 0
  const deathDepths: number[] = []
  for (let r = 0; r < RUNS; r++) {
    const teamSize = 3 + Math.floor(mcRng.next() * 3)
    const specIds = Array.from({ length: teamSize }, () => mcRng.pick(TIER2_NODES).id)
    let baseHp = MAX_BASE_HP
    let threat = 1
    let reached = 0
    for (let depth = 1; depth <= 10; depth++) {
      const team = specIds.map((id, i) => ({
        sentinel: buildSpec(id, {
          level: depthLevel(depth),
          gearRarity: depthRarity(depth),
          seed: r * 10 + i,
          upgrades: depthUpgrades(depth),
        }),
        slotId: slots[i],
      }))
      const kind = depth === 10 ? 'boss' : depth % 4 === 0 ? 'elite' : 'normal'
      if (kind === 'boss') bossAttempts++
      const m = runBattle({
        team,
        depth,
        kind,
        enemyHpMult: threat * curve(depth, kind),
        baseHp,
        maxSeconds: 70,
        seed: r * 100 + depth,
      })
      baseHp = m.baseHpLeft
      if (!m.cleared || baseHp <= 0) {
        deathDepths.push(depth)
        if (kind === 'boss') bossKills++
        break
      }
      reached = depth
      threat *= THREAT_PER_NODE[kind]
      if (kind !== 'boss' && mcRng.chance(0.3)) threat *= THREAT_PER_CHOICE
    }
    if (reached >= 10) wins++
  }
  const counts = new Map<number, number>()
  for (const d of deathDepths) counts.set(d, (counts.get(d) ?? 0) + 1)
  const worst = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [0, 0]
  console.log(
    `  §6  win ${pct(wins / RUNS)}  deaths on ${counts.size} depths  worst depth ${worst[0]} ${pct(worst[1] / Math.max(1, deathDepths.length))}  boss kills ${pct(bossKills / Math.max(1, bossAttempts))}`,
  )
}
