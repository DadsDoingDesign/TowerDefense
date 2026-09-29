/**
 * Parallel paired sweep for tuning — Node-only, like `meta-sweep.ts`.
 *
 *   npx tsx balance/tune.ts [n] [what...]
 *     n     runs per cell (default 240)
 *     what  any of `fresh` (§11's four routing lines, zero meta), `carto`
 *           (§12's Cartographer's Table against zero meta, all four lines),
 *           `hub` (every §12 hub state), `banner` (§13's Vow ladder on the
 *           adaptive line), `mc` (§6's Monte Carlo, n = 300 unless given);
 *           default `fresh carto mc`
 *
 * Every cell uses §11/§12's own seeds (`9001 + i·17`, starter `i % 3`), so the
 * numbers are the report's numbers at a different `n`, and the run is sharded
 * across every core — a §11+§12 read at n=600 takes a few minutes instead of the
 * full suite's ten. Not a gate; the report stays the only gate.
 */
import { spawn } from 'child_process'
import { cpus } from 'os'
import { fileURLToPath } from 'url'
import type { Archetype } from '../src/game/types'
import { bannerRules, MAX_BANNER } from '../src/state/metaStore'
import { loadoutFor, monteCarloRun, POLICIES, simulateRun, ZERO_META } from './runsim'

const N = Number(process.argv[2]) || 240
const WHAT = process.argv.slice(3).length ? process.argv.slice(3) : ['fresh', 'carto', 'mc']
const ARCHES: Archetype[] = ['fighter', 'rogue', 'mystic']
const HUB: [string, Record<string, number>][] = [
  ["Cartographer's Table", { cartographer: 1 }],
  ['Free Companies', { freeCompanies: 1 }],
  ['Standing Orders', { standingOrders: 1 }],
  ['all three unlocks', { cartographer: 1, freeCompanies: 1, standingOrders: 1 }],
  ['Field Kitchen + Relic Cartulary', { fieldKitchen: 1, cartulary: 1 }],
  ['the full ramp', { base: 2, gold: 2, stats: 2, roster: 1, loot: 1 }],
  ['everything', { base: 2, gold: 2, stats: 2, roster: 1, loot: 1, cartographer: 1, freeCompanies: 1, standingOrders: 1, fieldKitchen: 1, cartulary: 1 }],
]

/** One cell's per-seed wins, keyed `state|policy`. */
type Cells = Record<string, number[]>

function cellsFor(): { key: string; run: (i: number) => number }[] {
  const out: { key: string; run: (i: number) => number }[] = []
  const states: [string, Record<string, number>][] = [['zero', {}]]
  if (WHAT.includes('carto')) states.push(HUB[0])
  if (WHAT.includes('hub')) for (const h of HUB) if (!states.includes(h)) states.push(h)
  if (WHAT.includes('fresh') || WHAT.includes('carto') || WHAT.includes('hub')) {
    for (const [label, up] of states) {
      const meta = label === 'zero' ? ZERO_META : loadoutFor(label, up)
      for (const p of POLICIES) {
        out.push({ key: `${label}|${p.id}`, run: (i) => (simulateRun(9001 + i * 17, ARCHES[i % 3], { meta, policy: p }).won ? 1 : 0) })
      }
    }
  }
  if (WHAT.includes('banner')) {
    const adaptive = POLICIES.find((p) => p.id === 'adaptive')!
    for (let t = 0; t <= MAX_BANNER; t++) {
      const banner = bannerRules(t)
      out.push({ key: `banner|B${t}`, run: (i) => (simulateRun(9001 + i * 17, ARCHES[i % 3], { banner, policy: adaptive }).won ? 1 : 0) })
    }
  }
  return out
}

const shard = process.env.TUNE_SHARD
if (shard !== undefined) {
  const [k, of] = shard.split('/').map(Number)
  const res: Cells = {}
  for (const c of cellsFor()) {
    res[c.key] = []
    for (let i = k; i < N; i += of) res[c.key].push(c.run(i))
  }
  if (WHAT.includes('mc')) {
    res['mc'] = []
    const mcN = Number(process.env.TUNE_MC) || 300
    for (let r = k; r < mcN; r += of) res['mc'].push(monteCarloRun(r).won ? 1 : 0)
  }
  process.stdout.write(JSON.stringify(res))
} else {
  const K = Math.max(1, cpus().length)
  const self = fileURLToPath(import.meta.url)
  const t0 = Date.now()
  const parts = await Promise.all(
    Array.from({ length: K }, (_, k) =>
      new Promise<Cells>((resolve, reject) => {
        const child = spawn('npx', ['tsx', self, String(N), ...WHAT], { env: { ...process.env, TUNE_SHARD: `${k}/${K}` } })
        let buf = ''
        child.stdout.on('data', (d) => (buf += d))
        child.stderr.on('data', (d) => process.stderr.write(d))
        child.on('close', (code) => (code === 0 ? resolve(JSON.parse(buf) as Cells) : reject(new Error(`shard ${k} exited ${code}`))))
      }),
    ),
  )
  const merged: Cells = {}
  for (const p of parts) for (const [key, v] of Object.entries(p)) (merged[key] ??= []).push(...v)
  const m = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`
  // Shards interleave seeds, so pair by re-sorting each shard's slice into seed order.
  const bySeed = (key: string): number[] => {
    const out: number[] = new Array(N)
    parts.forEach((p, k) => (p[key] ?? []).forEach((w, j) => (out[k + j * K] = w)))
    return out
  }
  console.log(`n=${N} (${K} shards, ${((Date.now() - t0) / 1000).toFixed(0)}s)`)
  if (merged['mc']) console.log(`§6 Monte Carlo: ${pct(m(merged['mc']))} (n=${merged['mc'].length})`)
  const bannerKeys = Object.keys(merged).filter((k) => k.startsWith('banner|')).sort()
  if (bannerKeys.length) {
    console.log(`Vow ladder (adaptive): ${bannerKeys.map((k, i) => {
      const w = m(merged[k])
      return `${k.split('|')[1]} ${pct(w)}${i ? ` (−${((m(merged[bannerKeys[i - 1]]) - w) * 100).toFixed(1)})` : ''}`
    }).join(' | ')}`)
  }
  const states = [...new Set(Object.keys(merged).filter((k) => k.includes('|') && !k.startsWith('banner|')).map((k) => k.split('|')[0]))]
  for (const st of states) {
    const row = POLICIES.map((p) => {
      const a = bySeed(`${st}|${p.id}`)
      if (st === 'zero') return `${p.id} ${pct(m(a))}`
      const z = bySeed(`zero|${p.id}`)
      const d = a.map((x, i) => x - z[i])
      const md = m(d)
      const se = Math.sqrt(m(d.map((x) => (x - md) ** 2)) * (d.length / (d.length - 1)) / d.length)
      return `${p.id} ${pct(m(a))} (${md >= 0 ? '+' : ''}${(md * 100).toFixed(1)} ±${(2 * se * 100).toFixed(1)})`
    })
    console.log(`${st.padEnd(32)} ${row.join(' | ')}`)
  }
}
