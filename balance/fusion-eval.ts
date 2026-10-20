/**
 * Skill fusion's bench (Oct 2026, `docs/SKILL_FUSION.md` § 7) — what a fused
 * skill is worth against the same hero holding both its parts.
 *
 *   npx tsx balance/fusion-eval.ts [seeds] [fusion-id,…]
 *
 * The report's §7b runs the same function (`fusionBench`). A fusion holds both
 * parts' effects exactly (`skills.skillModsOf`), so the only thing it adds in
 * a fight is its twist: this measures the twist.
 *
 * **How.** On §7's benches for the fusion's level (a `swarm`, an `armour`
 * column, a `line`; depth 4 / 6 / 8, a hero of level 9 / 14 / 19, no gear) and
 * on each kit (sword and shield, dagger, wand), the waves' HP is raised until
 * a hero holding BOTH PARTS stops half of what it faces (its break pressure,
 * where a stop rate is most sensitive). Around there (a band of pressures,
 * `BAND`, so one step of a stop rate cannot decide it) the fused hero's stop
 * rate is read, and turned into a number a player can feel: the **damage-equivalent**
 * — how much harder the parts' hero would have to hit to stop as much
 * (`+20%`: the twist is worth hitting 20% harder). It reads a control twist
 * (a freeze, a burst on a held body) on the same scale as a damage one. The
 * stop rate the fusion adds is quoted beside it, in pt, as §7 quotes a skill.
 *
 * A bench where doubling the parts' damage moves the stop rate by less than
 * `BLIND_PT` cannot price anything in damage (a held swarm that walks past, a
 * bench at its ceiling): it is left out, and a fusion's figure is the MEDIAN
 * over the kit × bench cells that price it — robust to the one bench a twist
 * owns outright (a fan into a swarm), which is capped at `EQ_CAP`.
 *
 * An aura fusion (Rallying Standard) is graded beside a second hero inside its
 * reach, as §7 grades Blessing.
 */
import { generateEncounter } from '../src/game/data/waves'
import { applyXp, xpToReach } from '../src/game/engine/leveling'
import { classicHero } from '../src/game/data/sentinels'
import { FUSED_SKILLS, type FusedSkill } from '../src/game/data/skills'
import type { Archetype, Sentinel, WaveDef } from '../src/game/types'
import { AURA_TRIO, BENCH_RULES, makeWave, mean, POST, SEEDS, stopRate } from './harness'

export const FUSION_BENCH_KEYS = ['swarm', 'armour', 'line'] as const
export type FusionBenchKey = (typeof FUSION_BENCH_KEYS)[number]
export const FUSION_KITS: readonly Archetype[] = ['fighter', 'rogue', 'mystic']
export const KIT_NAME: Record<Archetype, string> = { fighter: 'Sword & Shield', rogue: 'Dagger', mystic: 'Wand' }

/** Doubling the parts' damage must move a bench this much, or it cannot price the twist in damage. */
export const BLIND_PT = 0.05
/** The damage-equivalent's ceiling: past ×3 the twist is not a damage number. */
export const EQ_CAP = 2
/** The pressures each bench is read at, as multiples of the parts' break pressure. */
export const BAND = [0.6, 0.8, 1, 1.25, 1.6]

export interface FusionRow {
  id: string
  name: string
  parts: readonly [string, string]
  kit: Archetype
  /** Per bench: the twist's damage-equivalent (0.2 = worth hitting 20% harder); null where the bench is damage-blind. */
  eq: Record<FusionBenchKey, number | null>
  /** Per bench: the stop rate the fusion adds at the parts' break pressure. */
  stop: Record<FusionBenchKey, number>
}

export const benchWaves = (depth: number): Record<FusionBenchKey, WaveDef> => ({
  swarm: makeWave([{ typeId: 'torch1', count: 40 + depth * 5, hpMult: 1 + depth * 0.4, gap: 0.3 }], 'swarm'),
  armour: generateEncounter(depth, 'elite', { variantId: 'plated', subWaves: false }),
  line: generateEncounter(depth, 'normal', { subWaves: false }),
})

const hasAura = (f: FusedSkill) => !!f.mods.critAura

function team(hero: Sentinel, aura: boolean, level: number): { sentinel: Sentinel; slotId: string }[] {
  if (!aura) return [{ sentinel: hero, slotId: POST.s3 }]
  return [
    { sentinel: hero, slotId: AURA_TRIO.support },
    { sentinel: { ...applyXp(classicHero('rogue'), xpToReach(level)), id: 'fz-ally' }, slotId: AURA_TRIO.allies[0] },
  ]
}

/** The HP multiplier at which `t` stops half of `wave`, searched in log space between `lo` and `hi`. */
function breakPressure(t: { sentinel: Sentinel; slotId: string }[], wave: WaveDef, seeds: number[], lo: number, hi: number, steps: number): number {
  for (let i = 0; i < steps; i++) {
    const mid = Math.sqrt(lo * hi)
    if (stopRate(t, wave, seeds, { enemyHpMult: mid, rules: BENCH_RULES }) > 0.5) lo = mid
    else hi = mid
  }
  return Math.sqrt(lo * hi)
}

export function fusionBench(opts: { seeds?: number[]; only?: readonly string[] } = {}): FusionRow[] {
  const seeds = opts.seeds ?? SEEDS.slice(0, 5)
  const rows: FusionRow[] = []
  for (const f of FUSED_SKILLS) {
    if (opts.only && !opts.only.includes(f.id)) continue
    const level = f.level === 1 ? 9 : f.level === 2 ? 14 : 19
    const waves = benchWaves(f.level === 1 ? 4 : f.level === 2 ? 6 : 8)
    const aura = hasAura(f)
    for (const kit of FUSION_KITS) {
      const base = applyXp(classicHero(kit), xpToReach(level))
      const fused = team({ ...base, skills: [f.id] }, aura, level)
      /** The parts' hero, hitting ×m harder (m = 1: the parts as they are). */
      const parts = (m = 1) =>
        team(
          {
            ...base,
            skills: [...f.parts],
            ...(m !== 1 ? { mutations: [{ id: 'fz-eq', key: 'eq', name: 'eq', desc: '', rarity: 'mythic' as const, downside: '', mods: { damageMult: m } }] } : {}),
          },
          aura,
          level,
        )
      const eq = {} as Record<FusionBenchKey, number | null>
      const stop = {} as Record<FusionBenchKey, number>
      for (const k of FUSION_BENCH_KEYS) {
        const p = breakPressure(parts(), waves[k], seeds, 0.02, 80, 10)
        // The stop rate over a band of pressures around the break point, not
        // at it alone: one pressure's stop rate is a step function of damage.
        const band = (t: { sentinel: Sentinel; slotId: string }[]) => mean(BAND.map((x) => stopRate(t, waves[k], seeds, { enemyHpMult: p * x, rules: BENCH_RULES })))
        const sp = band(parts())
        const sf = band(fused)
        stop[k] = sf - sp
        if (band(parts(2)) - sp < BLIND_PT) {
          eq[k] = null
          continue
        }
        // The m at which the harder-hitting parts stop what the fusion stops.
        let lo = 0.7
        let hi = 1 + EQ_CAP
        if (band(parts(hi)) < sf) {
          eq[k] = EQ_CAP
          continue
        }
        for (let i = 0; i < 10; i++) {
          const mid = Math.sqrt(lo * hi)
          if (band(parts(mid)) >= sf) hi = mid
          else lo = mid
        }
        eq[k] = Math.sqrt(lo * hi) - 1
      }
      rows.push({ id: f.id, name: f.name, parts: f.parts, kit, eq, stop })
    }
  }
  return rows
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN
}
/** The cells of a set of rows that price the twist (the damage-blind ones left out). */
const cells = (rows: FusionRow[]): number[] => rows.flatMap((r) => FUSION_BENCH_KEYS.map((k) => r.eq[k]).filter((x): x is number => x != null))

/** A kit's figure: the median over its benches that price the twist (NaN: none does). */
export const kitEq = (r: FusionRow): number => median(cells([r]))

export interface FusionSummary {
  id: string
  name: string
  /** The median damage-equivalent over every kit × bench that prices it. */
  median: number
  /** The best kit's own median, and which kit. */
  best: number
  bestKit: Archetype
  /** How many of the nine cells priced it. */
  cells: number
  /** The mean stop rate it adds over all nine cells, in pt. */
  stop: number
}

export function fusionSummary(rows: FusionRow[]): FusionSummary[] {
  const ids = [...new Set(rows.map((r) => r.id))]
  return ids.map((id) => {
    const of = rows.filter((r) => r.id === id)
    const scored = of.filter((r) => Number.isFinite(kitEq(r)))
    const best = scored.length ? scored.reduce((a, b) => (kitEq(b) > kitEq(a) ? b : a)) : of[0]
    return {
      id,
      name: of[0].name,
      median: median(cells(of)),
      best: kitEq(best),
      bestKit: best.kit,
      cells: cells(of).length,
      stop: mean(of.flatMap((r) => FUSION_BENCH_KEYS.map((k) => r.stop[k]))),
    }
  })
}

if (process.argv[1]?.endsWith('fusion-eval.ts')) {
  const n = Number(process.argv[2] ?? 5)
  const only = process.argv[3]?.split(',')
  const t0 = Date.now()
  const rows = fusionBench({ seeds: SEEDS.slice(0, n), only })
  const pc = (x: number | null) => (x == null || !Number.isFinite(x) ? '—' : `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(0)}%${x >= EQ_CAP ? '+' : ''}`)
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(18)} ${KIT_NAME[r.kit].padEnd(15)} eq ${FUSION_BENCH_KEYS.map((k) => pc(r.eq[k]).padStart(6)).join(' ')}   stop ${FUSION_BENCH_KEYS.map((k) => `${(r.stop[k] * 100).toFixed(1)}`.padStart(6)).join(' ')}`,
    )
  }
  console.log('')
  for (const s of fusionSummary(rows)) {
    console.log(`${s.name.padEnd(18)} median ${pc(s.median).padStart(6)}  best kit ${pc(s.best).padStart(6)} (${KIT_NAME[s.bestKit]})  cells ${s.cells}  stop +${(s.stop * 100).toFixed(1)}pt`)
  }
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`)
}
