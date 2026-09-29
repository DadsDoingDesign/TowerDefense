/**
 * High-`n` exploration for the hub and the Banner ladder — Node-only, like the
 * `FW_*` knobs in `report.ts`.
 *
 *   npx tsx balance/meta-sweep.ts [n] [what]
 *     n     runs per cell (default 120)
 *     what  `unlocks` | `banners` | `policies` | `map` | `all` (default all)
 *
 * `report.ts` runs the same cells at a smaller `n` as gates (§12 / §13). This
 * script exists so the multipliers and the unlock shapes can be *fitted* at a
 * noise floor the gate cannot afford, and so before/after tables can be quoted
 * with the sample size on them.
 */
import { RNG } from '../src/game/core/rng'
import { generateRunMap } from '../src/game/data/runmap'
import { BANNER_RUNGS, MAX_BANNER, bannerRules } from '../src/state/metaStore'
import type { Archetype } from '../src/game/types'
import { mean } from './harness'
import { buildChoicePoints } from './runsim'
import { loadoutFor, POLICIES, simulateRun, ZERO_META, type Loadout, type RoutePolicy } from './runsim'

const N = Number(process.argv[2]) || 120
const WHAT = process.argv[3] ?? 'all'
const ARCHES: Archetype[] = ['fighter', 'rogue', 'mystic']
const pct = (n: number) => `${(n * 100).toFixed(0)}%`

export interface Cell {
  wins: number[]
  marks: number[]
  cleared: number[]
  winRate: number
  marksPerRun: number
}

/** Identical seeds and starting heroes in every cell, so cells are paired. */
export function cell(n: number, meta: Loadout, bannerTier: number, policy: RoutePolicy): Cell {
  const banner = bannerRules(bannerTier)
  const wins: number[] = []
  const marks: number[] = []
  const cleared: number[] = []
  for (let i = 0; i < n; i++) {
    const r = simulateRun(9001 + i * 17, ARCHES[i % 3], { meta, banner, policy })
    wins.push(r.won ? 1 : 0)
    marks.push(r.marks)
    cleared.push(r.cleared)
  }
  return { wins, marks, cleared, winRate: mean(wins), marksPerRun: mean(marks) }
}

/**
 * Standard error of a PAIRED difference in win rate. Cells share seeds and
 * heroes, so most of the variance cancels and the gate can be tight without
 * being flaky.
 */
export function pairedSe(a: number[], b: number[]): number {
  const d = a.map((x, i) => x - b[i])
  const m = mean(d)
  if (d.length < 2) return 1
  const v = mean(d.map((x) => (x - m) ** 2)) * (d.length / (d.length - 1))
  return Math.sqrt(v / d.length)
}

const UNLOCK_CELLS: [string, Record<string, number>][] = [
  ['zero meta', {}],
  ["Cartographer's Table", { cartographer: 1 }],
  ['Free Companies', { freeCompanies: 1 }],
  ['Standing Orders', { standingOrders: 1 }],
  ['all three unlocks', { cartographer: 1, freeCompanies: 1, standingOrders: 1 }],
  ['full ramp', { base: 2, gold: 2, stats: 2, roster: 1, loot: 1 }],
  ['everything', { base: 2, gold: 2, stats: 2, roster: 1, loot: 1, cartographer: 1, freeCompanies: 1, standingOrders: 1 }],
]

if (WHAT === 'all' || WHAT === 'unlocks') {
  console.log(`\n=== hub states (n=${N}/cell, paired seeds) ===`)
  const header = ['unlock state', ...POLICIES.map((p) => p.id), 'best'].join(' | ')
  console.log(header)
  const zero: Record<string, Cell> = {}
  for (const p of POLICIES) zero[p.id] = cell(N, ZERO_META, 0, p)
  for (const [label, upgrades] of UNLOCK_CELLS) {
    const meta = loadoutFor(label, upgrades)
    const cells = POLICIES.map((p) => cell(N, meta, 0, p))
    const best = Math.max(...cells.map((c) => c.winRate))
    const deltas = cells.map((c, i) => {
      const z = zero[POLICIES[i].id]
      const d = c.winRate - z.winRate
      return `${pct(c.winRate)} (${d >= 0 ? '+' : ''}${(d * 100).toFixed(0)}±${(2 * pairedSe(c.wins, z.wins) * 100).toFixed(0)})`
    })
    console.log([label.padEnd(22), ...deltas, pct(best)].join(' | '))
  }
}

if (WHAT === 'all' || WHAT === 'banners') {
  console.log(`\n=== Banner ladder (n=${N}/cell, zero meta) ===`)
  console.log('banner | rule | mult | ' + POLICIES.map((p) => `${p.id} win/marks`).join(' | '))
  for (let t = 0; t <= MAX_BANNER; t++) {
    const cells = POLICIES.map((p) => cell(N, ZERO_META, t, p))
    const rung = t === 0 ? null : BANNER_RUNGS[t - 1]
    console.log(
      [
        String(t),
        (rung ? rung.name : '—').padEnd(14),
        `×${bannerRules(t).markMult}`,
        ...cells.map((c) => `${pct(c.winRate)}/${c.marksPerRun.toFixed(0)}`),
      ].join(' | '),
    )
  }
}

if (WHAT === 'all' || WHAT === 'policies') {
  console.log(`\n=== routing policies (n=${N}, zero meta, Banner 0) ===`)
  for (const p of POLICIES) {
    const c = cell(N, ZERO_META, 0, p)
    console.log(`${p.id.padEnd(10)} ${pct(c.winRate)}  marks/run ${c.marksPerRun.toFixed(0)}  nodes ${mean(c.cleared).toFixed(1)}`)
  }
}

if (WHAT === 'rules') {
  // Each Banner rule measured ALONE on top of Banner 0, so the ladder can be
  // ordered by what each rule actually costs instead of by how it reads.
  console.log(`\n=== single Banner rules (n=${N}/cell, zero meta) ===`)
  const base = bannerRules(0)
  const RULES: [string, Partial<typeof base>][] = [
    ['none', {}],
    ['thinPickings', { thinPickings: true }],
    ['noMerchants (bare road)', { noMerchants: true }],
    ['noRecruits', { noRecruits: true }],
    ['allElite', { allElite: true }],
    ['startThreat ×2', { startThreat: 2 }],
  ]
  console.log(['rule', ...POLICIES.map((p) => p.id)].join(' | '))
  for (const [label, patch] of RULES) {
    const banner = { ...base, ...patch }
    const cells = POLICIES.map((p) => {
      const wins: number[] = []
      const marks: number[] = []
      for (let i = 0; i < N; i++) {
        const r = simulateRun(9001 + i * 17, ARCHES[i % 3], { banner, policy: p })
        wins.push(r.won ? 1 : 0)
        marks.push(r.marks)
      }
      return `${pct(mean(wins))}/${mean(marks).toFixed(0)}`
    })
    console.log([label.padEnd(24), ...cells].join(' | '))
  }
}

if (WHAT === 'special') {
  // The one free parameter §11 is fitted on, swept across the policy set.
  console.log(`\n=== THREAT_PER_NODE.special (n=${N}, zero meta, Banner 0) ===`)
  console.log(['step', ...POLICIES.map((p) => p.id), 'best'].join(' | '))
  for (const s of [1.13, 1.18, 1.22, 1.26, 1.3, 1.35, 1.42]) {
    const cells = POLICIES.map((p) => {
      const wins: number[] = []
      for (let i = 0; i < N; i++) {
        wins.push(simulateRun(9001 + i * 17, ARCHES[i % 3], { policy: p, specialThreat: s }).won ? 1 : 0)
      }
      return mean(wins)
    })
    console.log([`×${s}`, ...cells.map(pct), pct(Math.max(...cells))].join(' | '))
  }
}

if (WHAT === 'all' || WHAT === 'map') {
  console.log(`\n=== map shape (500 maps) ===`)
  for (const [label, opts] of [
    ['default', {}],
    ['wide (Cartographer)', { wideMap: true }],
    ['full camp (Standing Orders)', { standingOrders: true }],
  ] as const) {
    let steps = 0
    let noChoice = 0
    let mixed = 0
    let layers = 0
    let specials = 0
    let elites = 0
    let forcedElites = 0
    for (let i = 0; i < 500; i++) {
      const m = generateRunMap(new RNG(i * 7 + 1), opts)
      layers += m.layers
      const byId = new Map(m.nodes.map((n) => [n.id, n]))
      const outDeg = new Map<string, number>()
      for (const e of m.edges) outDeg.set(e.from, (outDeg.get(e.from) ?? 0) + 1)
      const forced = new Set<string>()
      for (const e of m.edges) if (outDeg.get(e.from) === 1) forced.add(e.to)
      for (const n of m.nodes) {
        if (n.type === 'elite') { elites++; if (forced.has(n.id)) forcedElites++ }
        if (n.type === 'boss') continue
        const outs = m.edges.filter((e) => e.from === n.id).map((e) => byId.get(e.to)!)
        if (!outs.length) continue
        steps++
        if (outs.length === 1) noChoice++
        else if (new Set(outs.map((o) => o.type)).size > 1) mixed++
      }
      specials += m.nodes.filter((n) => ['merchant', 'shrine', 'recruit', 'elite'].includes(n.type)).length
    }
    console.log(
      `${label.padEnd(28)} layers ${(layers / 500).toFixed(1)}  no-choice steps ${pct(noChoice / steps)}  mixed forks ${pct(mixed / steps)}  specials/map ${(specials / 500).toFixed(1)}  forced elites ${pct(forcedElites / elites)}`,
    )
  }
}

/**
 * The Phase 3b scoreboard — every number the run/meta-depth pass is judged on,
 * from one simulator on paired seeds:
 *
 *  - fresh-player win rate by starter, per routing policy;
 *  - the route-policy spread (best line − worst line);
 *  - the build spread: `build: 'best'` (heroDps-greedy evolutions and perks)
 *    against `build: 'random'` on the best line — the narrower, the fewer
 *    solved picks;
 *  - how many consumed nodes are fights, and the leader's level by layer (the
 *    XP curve);
 *  - marks per run.
 */
if (WHAT === 'phase3b') {
  console.log(`\n=== phase 3b scoreboard (n=${N}/cell, paired seeds, zero meta) ===`)
  const rows = POLICIES.map((p) => {
    const outs = Array.from({ length: N }, (_, i) => simulateRun(9001 + i * 17, ARCHES[i % 3], { policy: p }))
    return { p, outs }
  })
  const byStarter = (outs: ReturnType<typeof simulateRun>[], a: Archetype) => {
    const xs = outs.filter((o) => o.starter === a)
    return mean(xs.map((o) => (o.won ? 1 : 0)))
  }
  console.log('route | win | fighter | rogue | mystic | fights/nodes | marks/run')
  for (const { p, outs } of rows) {
    const fights = mean(outs.map((o) => o.fights))
    const nodes = mean(outs.map((o) => o.nodes))
    console.log(
      `${p.id.padEnd(9)} | ${pct(mean(outs.map((o) => (o.won ? 1 : 0))))} | ${ARCHES.map((a) => pct(byStarter(outs, a))).join(' | ')} | ${fights.toFixed(1)}/${nodes.toFixed(1)} (${pct(fights / nodes)}) | ${mean(outs.map((o) => o.marks)).toFixed(1)}`,
    )
  }
  const rates = rows.map(({ outs }) => mean(outs.map((o) => (o.won ? 1 : 0))))
  console.log(`route spread: ${pct(Math.min(...rates))} – ${pct(Math.max(...rates))} (${((Math.max(...rates) - Math.min(...rates)) * 100).toFixed(1)}pt)`)
  const best = rows[rates.indexOf(Math.max(...rates))].p
  for (const p of [best, ...POLICIES.filter((q) => q !== best)].slice(0, 2)) {
    const greedy = mean(Array.from({ length: N }, (_, i) => (simulateRun(9001 + i * 17, ARCHES[i % 3], { policy: p, build: 'best' }).won ? 1 : 0)))
    const coin = rates[POLICIES.indexOf(p)]
    console.log(`build spread on ${p.id}: best ${pct(greedy)} vs random ${pct(coin)} (${((greedy - coin) * 100).toFixed(1)}pt)`)
  }
  // ---- the measured "known answer": pin each choice point, keep the best ----
  // Every build choice point (a parent node in the tree, and later a perk
  // level) is pinned to each of its options in turn, with every other choice
  // left to the coin; the option that wins most is the oracle's pick. Then the
  // oracle plays with every point pinned. best − random is the build spread.
  {
    const winsWith = (force: Record<string, string>, only?: Archetype) => {
      const xs: number[] = []
      for (let i = 0; i < N; i++) {
        const a = ARCHES[i % 3]
        if (only && a !== only) continue
        xs.push(simulateRun(9001 + i * 17, a, { policy: best, build: { force } }).won ? 1 : 0)
      }
      return mean(xs)
    }
    const oracle: Record<string, string> = {}
    const picks: string[] = []
    for (const point of buildChoicePoints()) {
      let top = { id: '', w: -1 }
      for (const opt of point.options) {
        const w = winsWith({ [point.id]: opt }, point.archetype)
        if (w > top.w) top = { id: opt, w }
      }
      oracle[point.id] = top.id
      picks.push(`${point.id}→${top.id} ${pct(top.w)}`)
    }
    const always = winsWith(oracle)
    const coin = rates[POLICIES.indexOf(best)]
    console.log(`oracle picks: ${picks.join(', ')}`)
    console.log(`BUILD SPREAD (oracle vs random, ${best.id}): ${pct(always)} vs ${pct(coin)} (${((always - coin) * 100).toFixed(1)}pt)`)
  }
  const outs = rows[rates.indexOf(Math.max(...rates))].outs
  const maxLayer = Math.max(...outs.map((o) => o.levelByLayer.length))
  const lv: string[] = []
  for (let l = 1; l < maxLayer; l++) {
    const xs = outs.map((o) => o.levelByLayer[l]).filter((x): x is number => typeof x === 'number')
    if (xs.length) lv.push(`d${l}:${mean(xs).toFixed(1)}`)
  }
  console.log(`leader level after each layer (best line, fights only): ${lv.join(' ')}`)
  let middle = 0
  let fightsOnMap = 0
  for (let i = 0; i < 300; i++) {
    const m = generateRunMap(new RNG(i * 7 + 1), {})
    for (const n of m.nodes) {
      if (n.type === 'start' || n.type === 'boss') continue
      middle++
      if (n.type === 'battle' || n.type === 'elite') fightsOnMap++
    }
  }
  console.log(`map: ${pct(fightsOnMap / middle)} of non-start/non-final nodes are fights (battle/elite)`)
}
