/**
 * Company asks (Draft 4 · A) — how often a delivered escort meets each ask,
 * and the target that would make it land about half the time. Node-only, like
 * `tune.ts`; not a gate.
 *
 *   npx tsx balance/ask-rates.ts [n]
 *     n  runs per (company, company level) cell (default 240)
 *
 * Each company's escort is played on its own road (its ground, its armour
 * lean, its pieces weighted) on the adaptive route, at two company levels: the
 * zero-meta first contracts and the veteran's (`runsim.veteranRun`). Only
 * delivered runs are read — the asks are fitted to "a typical delivered run".
 * For every ask the line prints the met rate at its target among delivered
 * runs of each level and pooled, and the pooled median (the 50% target).
 */
import { spawn } from 'child_process'
import { cpus } from 'os'
import { fileURLToPath } from 'url'
import type { Archetype } from '../src/game/types'
import { COMPANY_IDS, type CompanyId } from '../src/game/data/companies'
import { ASKS, type AskStat } from '../src/game/run/asks'
import { homeGold } from '../src/game/run/hq'
import { CITY_COUNT } from '../src/game/run/contracts'
import { POLICIES, simulateRun, veteranRun, ZERO_META } from './runsim'

const N = Number(process.argv[2]) || 240
const ARCHES: Archetype[] = ['fighter', 'rogue', 'mystic']
const LEVELS = ['zero', 'vet'] as const
type Row = Record<AskStat, number>
type Cells = Record<string, Row[]>

function play(company: CompanyId, level: (typeof LEVELS)[number], i: number): Row | null {
  const adaptive = POLICIES.find((p) => p.id === 'adaptive')!
  const seed = 7001 + i * 29
  const o = level === 'zero'
    ? simulateRun(seed, ARCHES[i % 3], { meta: ZERO_META, policy: adaptive, contract: { company, crates: 0 } })
    : simulateRun(seed, ARCHES[i % 3], { ...veteranRun(0, company), policy: adaptive })
  if (!o.won || !o.askTally || !o.contract) return null
  const dest = o.contract.cities[CITY_COUNT - 1]
  if (!dest) return null
  return {
    ...o.askTally,
    earned: dest.earned,
    cargo: dest.cargo,
    roadGold: homeGold({ purse: o.contract.purse, earned: dest.earned, gold: dest.gold, advance: true }).road,
  }
}

const shard = process.env.ASK_SHARD
if (shard !== undefined) {
  const [k, of] = shard.split('/').map(Number)
  const res: Cells = {}
  for (const c of COMPANY_IDS)
    for (const lv of LEVELS) {
      const key = `${c}|${lv}`
      res[key] = []
      for (let i = k; i < N; i += of) {
        const r = play(c, lv, i)
        if (r) res[key].push(r)
      }
    }
  process.stdout.write(JSON.stringify(res))
} else {
  const K = Math.max(1, cpus().length)
  const self = fileURLToPath(import.meta.url)
  const t0 = Date.now()
  const parts = await Promise.all(
    Array.from({ length: K }, (_, k) =>
      new Promise<Cells>((resolve, reject) => {
        const child = spawn('npx', ['tsx', self, String(N)], { env: { ...process.env, ASK_SHARD: `${k}/${K}` } })
        let buf = ''
        child.stdout.on('data', (d) => (buf += d))
        child.stderr.on('data', (d) => process.stderr.write(d))
        child.on('close', (code) => (code === 0 ? resolve(JSON.parse(buf) as Cells) : reject(new Error(`shard ${k} exited ${code}`))))
      }),
    ),
  )
  const merged: Cells = {}
  for (const p of parts) for (const [key, v] of Object.entries(p)) (merged[key] ??= []).push(...v)
  const pct = (x: number) => `${(x * 100).toFixed(0)}%`
  const rate = (rows: Row[], stat: AskStat, target: number) => (rows.length ? rows.filter((r) => r[stat] >= target).length / rows.length : NaN)
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b)
    return s.length ? s[Math.floor(s.length / 2)] : NaN
  }
  console.log(`n=${N} runs a cell (${K} shards, ${((Date.now() - t0) / 1000).toFixed(0)}s); delivered: ${COMPANY_IDS.map((c) => `${c} ${merged[`${c}|zero`].length}+${merged[`${c}|vet`].length}`).join(', ')}`)
  for (const a of ASKS) {
    const zero = merged[`${a.company}|zero`]
    const vet = merged[`${a.company}|vet`]
    const all = [...zero, ...vet]
    const q = (p: number) => {
      const s = all.map((r) => r[a.stat]).sort((x, y) => x - y)
      return s.length ? s[Math.floor(p * (s.length - 1))] : NaN
    }
    // The pooled met rate at the targets around the median, to fit one by.
    const near = [...new Set([0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7].map(q))].filter((t) => t > 0)
    console.log(
      `${a.id.padEnd(16)} target ${String(a.target).padStart(4)}: zero ${pct(rate(zero, a.stat, a.target)).padStart(4)}  vet ${pct(rate(vet, a.stat, a.target)).padStart(4)}  pooled ${pct(rate(all, a.stat, a.target)).padStart(4)}  · median ${median(all.map((r) => r[a.stat]))} (p25 ${q(0.25)}, p75 ${q(0.75)}) · at ${near.map((t) => `${t}: ${pct(rate(all, a.stat, t))}`).join(', ')}`,
    )
  }
}
