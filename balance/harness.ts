/**
 * Balance-testing harness for Fieldwatch.
 *
 * Drives the real GameEngine headlessly with a seeded RNG so results are
 * reproducible. Provides builders for any of the 27 specializations, gear
 * generation, and a battle runner that returns comparable metrics. The sweeps
 * and the report live in report.ts.
 */
import { RNG } from '../src/game/core/rng'
import { ALL_NODES, getNode, type TreeNode } from '../src/game/data/archetypeTree'
import { FIRST_MAP } from '../src/game/data/maps'
import { createSentinel } from '../src/game/data/sentinels'
import { generateItem } from '../src/game/data/items'
import { generateEncounter, type EncounterKind } from '../src/game/data/waves'
import { GameEngine } from '../src/game/engine/engine'
import { applyXp, evolveInto } from '../src/game/engine/leveling'
import type { HeroSlot, ItemRarity, ItemSlot, Sentinel, Tactics } from '../src/game/types'

export const TIER2_NODES: TreeNode[] = ALL_NODES.filter((n) => n.tier === 2)
export const SLOT_IDS = FIRST_MAP.slots.map((s) => s.id)

/** Roles used to interpret solo-offense numbers (supports read low on purpose). */
export const SUPPORT_SPECS = new Set([
  'aegis', 'bulwark', 'bannerman', 'warden_of_ash', // guard/knight support-ish
  'radiant', 'templar', 'oracle', // cleric
])

export interface BuildOptions {
  level?: number
  gearRarity?: ItemRarity
  seed?: number
}

/**
 * Build a Sentinel for a tier-2 spec at a target level (default 20). It gains the
 * tier-1 branch at level 10 and the tier-2 spec at level 20, mirroring real play,
 * so a level-12 build has only its sub-archetype, etc.
 */
export function buildSpec(specId: string, opts: BuildOptions = {}): Sentinel {
  const spec = getNode(specId)
  const rng = new RNG(opts.seed ?? 1)
  const level = opts.level ?? 20
  let s = createSentinel(spec.archetype)
  s = applyXp(s, xpForLevelApprox(level))
  if (level >= 10) s = evolveInto(s, spec.parent!) // tier 1
  if (level >= 20) s = evolveInto(s, specId) // tier 2
  if (opts.gearRarity) s = equipFullSet(s, opts.gearRarity, rng)
  return s
}

function xpForLevelApprox(level: number): number {
  // Mirror leveling.xpToReach without importing it circularly.
  const l = Math.max(1, level) - 1
  return 40 * l + 8 * l * (l - 1)
}

export function equipFullSet(s: Sentinel, rarity: ItemRarity, rng: RNG): Sentinel {
  const equipment = { ...s.equipment }
  const kinds: Record<HeroSlot, ItemSlot> = { mainHand: 'oneHand', offHand: 'offHand', body: 'body' }
  for (const slot of ['mainHand', 'offHand', 'body'] as HeroSlot[]) {
    equipment[slot] = generateItem(rng, { slot: kinds[slot], rarity })
  }
  return { ...s, equipment }
}

export interface BattleMetrics {
  cleared: boolean
  timeSec: number
  baseHpLeft: number
  killCount: number
  totalDamage: number
  downs: number
  perSentinel: { id: string; damage: number; kills: number; downed: boolean }[]
}

export interface RunBattleOptions {
  team: { sentinel: Sentinel; slotId: string }[]
  depth: number
  kind?: EncounterKind
  baseHp?: number
  enemyHpMult?: number
  tactics?: Tactics
  maxSeconds?: number
  seed?: number
  dt?: number
}

/** Run one wave to completion (or timeout) and return comparable metrics. */
export function runBattle(opts: RunBattleOptions): BattleMetrics {
  const dt = opts.dt ?? 1 / 30
  const maxSteps = Math.round((opts.maxSeconds ?? 120) / dt)
  const engine = new GameEngine({
    map: FIRST_MAP,
    wave: generateEncounter(opts.depth, opts.kind ?? 'normal'),
    placedSentinels: opts.team,
    baseHp: opts.baseHp ?? 30,
    maxBaseHp: opts.baseHp ?? 30,
    enemyHpMult: opts.enemyHpMult ?? 1,
    tactics: opts.tactics,
    seed: opts.seed ?? 42,
  })
  let steps = 0
  while (engine.status === 'running' && steps < maxSteps) {
    engine.step(dt)
    steps++
  }
  const res = engine.result()
  return {
    cleared: engine.status === 'cleared',
    timeSec: engine.elapsed,
    baseHpLeft: engine.baseHp,
    killCount: res.enemiesKilled,
    totalDamage: res.perSentinel.reduce((a, p) => a + p.damageDealt, 0),
    downs: res.downed,
    perSentinel: res.perSentinel.map((p) => ({ id: p.id, damage: p.damageDealt, kills: p.kills, downed: p.downed })),
  }
}

/** Solo-offense benchmark: one build vs a fixed tanky wave; measures throughput. */
export function soloOffense(specId: string, opts: BuildOptions = {}): BattleMetrics {
  const s = buildSpec(specId, opts)
  return runBattle({
    team: [{ sentinel: s, slotId: 's3' }],
    depth: 6,
    enemyHpMult: 1.8, // tanky enough to reflect sustained DPS + procs
    baseHp: 999, // isolate offense from leaks
    maxSeconds: 90,
    seed: 4242,
  })
}

// ---- small stats helpers ----
export const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
export const std = (xs: number[]): number => {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}
export const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  const n = s.length
  return n === 0 ? 0 : n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}
