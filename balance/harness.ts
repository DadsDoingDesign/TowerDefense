/**
 * Balance-testing harness for Fieldwatch.
 *
 * Drives the real GameEngine headlessly with a seeded RNG so results are
 * reproducible. Provides builders for any of the 27 specializations, gear
 * generation, and a battle runner that returns comparable metrics. The sweeps
 * and the report live in report.ts.
 *
 * Design rules this file exists to enforce (WS10):
 *  - **Adjacency is physical.** Auras only reach allies inside their radius, and
 *    the map's slots are 95–425px apart while the biggest aura is 160. Any sweep
 *    that wants an aura to land must use `AURA_TRIO` (or check `slotDist`).
 *  - **A scenario needs a failure mode.** `baseHp: 999` deletes leaks, heals,
 *    shields and slows from the measurement. Use `pressureBattle` when the thing
 *    under test only pays off when the team is *losing*.
 *  - **One seed is not a measurement.** Use `multi()` and report mean ± spread.
 */
import { RNG } from '../src/game/core/rng'
import { ALL_NODES, childrenOf, getNode, type TreeNode } from '../src/game/data/archetypeTree'
import { ENEMY_TYPES } from '../src/game/data/enemies'
import { ALL_MAPS, FIRST_MAP } from '../src/game/data/maps'
import { createSentinel } from '../src/game/data/sentinels'
import { generateItem } from '../src/game/data/items'
import { generateEncounter, type EncounterKind } from '../src/game/data/waves'
import { pathLength } from '../src/game/data/maps'
import { computeCombat } from '../src/game/engine/combat'
import { GameEngine } from '../src/game/engine/engine'
import { applyXp, evolveInto } from '../src/game/engine/leveling'
import { MAX_PATH_LEVEL, UPGRADE_MILESTONES, UPGRADE_PATHS } from '../src/game/data/upgradeTree'
import type {
  Archetype,
  EffectMods,
  GameMap,
  HeroSlot,
  Item,
  ItemRarity,
  ItemSlot,
  Sentinel,
  SpawnEvent,
  Tactics,
  WaveDef,
} from '../src/game/types'

export const TIER2_NODES: TreeNode[] = ALL_NODES.filter((n) => n.tier === 2)
export const SLOT_IDS = FIRST_MAP.slots.map((s) => s.id)

/** Roles used to interpret solo-offense numbers (supports read low on purpose). */
export const SUPPORT_SPECS = new Set([
  'aegis', 'bulwark', 'bannerman', 'warden_of_ash', // guard/knight support-ish
  'radiant', 'templar', 'oracle', // cleric
])
/** Same set, in a stable order, so table rows don't depend on Set iteration. */
export const SUPPORT_SPEC_IDS = [
  'aegis', 'bulwark', 'bannerman', 'warden_of_ash', 'radiant', 'templar', 'oracle',
]

// ------------------------------------------------------------------ geometry
export const SLOT_POS: Record<string, { x: number; y: number }> = Object.fromEntries(
  FIRST_MAP.slots.map((s) => [s.id, s.pos]),
)

/** Centre-to-centre distance between two tower slots, in field pixels. */
export function slotDist(a: string, b: string): number {
  const p = SLOT_POS[a]
  const q = SLOT_POS[b]
  return Math.hypot(p.x - q.x, p.y - q.y)
}

/** The largest aura radius any node in the tree grants (currently Radiant, 160). */
export const MAX_AURA_RADIUS = Math.max(
  ...ALL_NODES.flatMap((n) => [
    n.mods?.healAura?.radius ?? 0,
    n.mods?.buffAura?.radius ?? 0,
    n.mods?.dmgReductionAura?.radius ?? 0,
  ]),
)

/**
 * The only slot triangle on The Green Line where auras actually reach: s3 is
 * 130.0px from s2 and 95.1px from s4, both inside every aura in the game
 * (120–160). Every other trio is 190px+ apart — which is why the old §2 sweep
 * (support at s5, allies at s1/s3, 191–210px) measured exactly nothing.
 */
export const AURA_TRIO = { support: 's3', allies: ['s2', 's4'] as const }

// ------------------------------------------------------- per-map slot value
/**
 * How much road a slot can see, in path px, at a nominal tower range (WS8).
 *
 * There is more than one battlefield now, and the placement order §11/§12/§13
 * used to hardcode — `['s3','s4','s2','s5','s1']` — was a *Green Line* fact
 * written as a constant. On The Kiln Road it names three of the five worst
 * slots on the field, which would have made every hub and Banner number a
 * measurement of a badly-deployed company on half the seeds.
 *
 * So coverage is computed instead of asserted: walk the path at 8px intervals
 * and count the samples inside `range` of the slot. It is a crude proxy for
 * time-in-range (it ignores enemy speed, which varies by faction) and that is
 * fine — it only has to *rank* slots the way a competent player would, and it
 * generalises to any map added later, which a hardcoded list cannot.
 */
export function slotCoverage(map: { path: readonly { x: number; y: number }[]; slots: readonly { id: string; pos: { x: number; y: number } }[] }, range = 150): Record<string, number> {
  const step = 8
  const out: Record<string, number> = {}
  for (const slot of map.slots) {
    let seen = 0
    for (let i = 1; i < map.path.length; i++) {
      const a = map.path[i - 1]
      const b = map.path[i]
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      const n = Math.max(1, Math.round(len / step))
      for (let k = 0; k <= n; k++) {
        const t = k / n
        const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
        if (Math.hypot(p.x - slot.pos.x, p.y - slot.pos.y) <= range) seen += len / n
      }
    }
    out[slot.id] = Math.round(seen)
  }
  return out
}

/**
 * The slots a competent player fills, best first. Ties break on slot id so the
 * order is stable across runs and platforms.
 */
export function bestSlots(map: Parameters<typeof slotCoverage>[0], range = 150): string[] {
  const cov = slotCoverage(map, range)
  return [...map.slots].map((s) => s.id).sort((a, b) => cov[b] - cov[a] || a.localeCompare(b))
}

/** Every shipped battlefield, with the two numbers a balance run cares about. */
export const MAP_FACTS = ALL_MAPS.map((m) => ({
  id: m.id,
  name: m.name,
  length: Math.round(pathLength(m.path)),
  coverage: slotCoverage(m),
  order: bestSlots(m),
  minSlotGap: Math.round(
    Math.min(
      ...m.slots.flatMap((a, i) => m.slots.slice(i + 1).map((b) => Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y))),
    ),
  ),
}))

export interface BuildOptions {
  level?: number
  gearRarity?: ItemRarity
  seed?: number
  /** Purchased tower-upgrade levels per path (power/tempo/precision), 0–3 each. */
  upgrades?: Record<string, number>
  /** Extra equipment overriding the generated set (used by the affix sweeps). */
  equipment?: Partial<Sentinel['equipment']>
  mutations?: Sentinel['mutations']
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
  if (opts.upgrades) s = { ...s, upgrades: { ...opts.upgrades } }
  if (opts.mutations) s = { ...s, mutations: opts.mutations }
  if (opts.equipment) s = { ...s, equipment: { ...s.equipment, ...opts.equipment } }
  return s
}

/** A single-affix test item: one enchantment, no base stats, so the affix is the variable. */
export function affixItem(id: string, ench: Item['enchantments'][number], slot: ItemSlot = 'oneHand'): Item {
  return { id: `t_${id}`, name: id, slot, rarity: 'epic', base: {}, enchantments: [ench] }
}

/**
 * A depth-appropriate spread of purchased upgrade levels — models a player
 * spending gold on the tower upgrade tree as a run progresses. Gold is scarce
 * (≈945 to fully max one tower's three paths), so a realistic player focuses:
 * max one path, then dabble in a second — not max everything on everyone.
 */
export function depthUpgrades(depth: number): Record<string, number> {
  let total = Math.min(6, Math.floor(Math.max(0, depth) * 0.6))
  const per = [0, 0, 0]
  for (let pi = 0; pi < 3 && total > 0; pi++) {
    const add = Math.min(3, total)
    per[pi] = add
    total -= add
  }
  return { power: per[0], tempo: per[1], precision: per[2] }
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
  defeated: boolean
  timeSec: number
  baseHpLeft: number
  /** Base HP the wave took off the clock — the honest "did this leak" number. */
  baseHpLost: number
  leaks: number
  killCount: number
  totalDamage: number
  goldEarned: number
  downs: number
  perSentinel: { id: string; damage: number; kills: number; xp: number; downed: boolean }[]
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
  teamMods?: EffectMods[]
  /** Replace the generated encounter outright. */
  wave?: WaveDef
  /** Scale the encounter's *pressure*: count, spawn rate AND hp (see `scaleWave`). */
  pressure?: number
  /** Which pressure model `pressure` uses (default: swarm). */
  pressureModel?: PressureModel
  /**
   * Which battlefield to fight on. Defaults to The Green Line so every bench
   * that predates the second map measures exactly what it always did; §11–§13
   * pass the map the run seed actually dealt.
   */
  map?: GameMap
  /**
   * Composition-variant seed for the generated encounter. Omitted → the
   * canonical shape, which is what keeps the pinned §4 benches pinned.
   */
  variantSeed?: number
  /** The node's row in its map layer — rotates the variant draw (see `pickVariant`). */
  variantSibling?: number
  /** Force one composition variant by id (the §14 variety bench only). */
  variantId?: string
}

/** Run one wave to completion (or timeout) and return comparable metrics. */
export function runBattle(opts: RunBattleOptions): BattleMetrics {
  const dt = opts.dt ?? 1 / 30
  const maxSteps = Math.round((opts.maxSeconds ?? 120) / dt)
  const baseHp = opts.baseHp ?? 30
  let wave =
    opts.wave ??
    generateEncounter(opts.depth, opts.kind ?? 'normal', {
      seed: opts.variantSeed,
      sibling: opts.variantSibling,
      variantId: opts.variantId,
    })
  if (opts.pressure != null && opts.pressure !== 1) wave = scaleWave(wave, opts.pressure, opts.pressureModel)
  const engine = new GameEngine({
    map: opts.map ?? FIRST_MAP,
    wave,
    placedSentinels: opts.team,
    baseHp,
    maxBaseHp: baseHp,
    enemyHpMult: opts.enemyHpMult ?? 1,
    tactics: opts.tactics,
    teamMods: opts.teamMods,
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
    defeated: engine.status === 'defeated',
    timeSec: engine.elapsed,
    baseHpLeft: engine.baseHp,
    baseHpLost: baseHp - engine.baseHp,
    leaks: res.leaks,
    killCount: res.enemiesKilled,
    totalDamage: res.perSentinel.reduce((a, p) => a + p.damageDealt, 0),
    goldEarned: res.goldEarned,
    downs: res.downed,
    perSentinel: res.perSentinel.map((p) => ({
      id: p.id,
      damage: p.damageDealt,
      kills: p.kills,
      xp: p.xpGained,
      downed: p.downed,
    })),
  }
}

// ------------------------------------------------------------ wave pressure
/**
 * How a pressure scalar `p` is spent across the three axes a wave actually has.
 * The old §5 sweep scaled enemy HP alone and was censored at ×8 without ever
 * breaking; these models exist so a sweep can find a *real* break point.
 */
export interface PressureModel {
  name: string
  /** Per-enemy HP multiplier. */
  hp: (p: number) => number
  /** How many times the wave's roster is repeated. */
  copies: (p: number) => number
  /** Arrival-time multiplier (<1 compresses the wave). */
  time: (p: number) => number
}

/**
 * **Swarm pressure** — bodies first. Count scales linearly with `p`, arrival
 * compresses by √p, HP grows only half as fast. This is what overwhelms a
 * *blocking* line (a fighter holds `block.count` enemies and no more), which is
 * why §2's support scenario uses it.
 */
export const SWARM_PRESSURE: PressureModel = {
  name: 'swarm',
  hp: (p) => 1 + (p - 1) * 0.5,
  copies: (p) => Math.max(1, Math.round(p)),
  time: (p) => 1 / Math.sqrt(p),
}

/**
 * **Siege pressure** — toughness first. HP scales with `p` while the head-count
 * grows only as p^0.35.
 *
 * Why not just pile on bodies: `engine.impact` applies splash to *every* enemy
 * inside the radius with no target cap, so packing more enemies into the same
 * space makes a splash tower stronger, not weaker. A count-led ladder therefore
 * never breaks a splash line — which is precisely how the old threat sweep came
 * to be "informational". §5 uses this model so the break point is real.
 */
export const SIEGE_PRESSURE: PressureModel = {
  name: 'siege',
  hp: (p) => p,
  copies: (p) => Math.max(1, Math.round(p ** 0.35)),
  time: (p) => 1 / p ** 0.35,
}

/** Apply a pressure model to a wave. `p <= 1` returns the wave untouched. */
export function scaleWave(wave: WaveDef, p: number, model: PressureModel = SWARM_PRESSURE): WaveDef {
  if (p <= 1) return wave
  const copies = model.copies(p)
  const timeScale = model.time(p)
  const hpScale = model.hp(p)
  const spawns: SpawnEvent[] = []
  for (let c = 0; c < copies; c++) {
    for (const s of wave.spawns) {
      // Offset each copy by a fraction of a spawn gap so ranks interleave
      // instead of arriving as one simultaneous blob.
      spawns.push({ ...s, at: s.at * timeScale + c * 0.13, hpMult: s.hpMult * hpScale })
    }
  }
  spawns.sort((a, b) => a.at - b.at)
  return { ...wave, spawns, label: `${wave.label} ×${p.toFixed(2)} ${model.name}` }
}

/** Total enemy count and HP-multiplier pool a wave throws, for sanity checks. */
export function waveSize(wave: WaveDef): { count: number; hp: number } {
  return { count: wave.spawns.length, hp: wave.spawns.reduce((a, s) => a + s.hpMult, 0) }
}

/** Build an explicit wave (used where a generated encounter is too coarse). */
export function makeWave(
  parts: { typeId: string; count: number; hpMult: number; gap: number; delay?: number }[],
  label = 'custom',
): WaveDef {
  const spawns: SpawnEvent[] = []
  let t = 0
  for (const p of parts) {
    t += p.delay ?? 0
    for (let i = 0; i < p.count; i++) {
      spawns.push({ typeId: p.typeId, at: t, hpMult: p.hpMult })
      t += p.gap
    }
  }
  spawns.sort((a, b) => a.at - b.at)
  return { index: 0, label, spawns, isBoss: false }
}

/** Base HP this wave removes if literally nothing stops it. */
export function maxLeak(wave: WaveDef): number {
  return wave.spawns.reduce((a, s) => a + ENEMY_TYPES[s.typeId].leak, 0)
}

/**
 * **Stop rate** — the fraction of a wave's leak damage the defence prevented,
 * from 0 (everything walked through) to 1 (nothing did.)
 *
 * This is the metric the affix, curse and mutation sweeps grade on, because it
 * is the only one immune to the three ways the old sweeps lied:
 *  - it is read off base HP, not per-Sentinel damage attribution (which the
 *    engine dropped entirely for burn and traps, so DoT builds scored negative);
 *  - it has a real failure mode, unlike a `baseHp: 999` scenario;
 *  - it is not spawn-bound the way clear time is, so a third body or a faster
 *    wave cannot fake an improvement.
 *
 * The base is set to exactly `maxLeak + 2`, so the battle always runs to the end
 * *and* base-healing effects (life-drain) are capped the way they are in a real
 * run instead of healing against a fake 999-HP pool.
 */
export function stopRate(
  sentinels: { sentinel: Sentinel; slotId: string }[],
  wave: WaveDef,
  seeds: number[] = SEEDS.slice(0, 4),
  opts: { enemyHpMult?: number; maxSeconds?: number; teamMods?: EffectMods[] } = {},
): number {
  const ml = maxLeak(wave)
  if (ml <= 0) return 1
  const lost = mean(
    seeds.map(
      (seed) =>
        runBattle({
          team: sentinels,
          depth: wave.index || 6,
          wave,
          baseHp: ml + 2,
          enemyHpMult: opts.enemyHpMult ?? 1,
          maxSeconds: opts.maxSeconds ?? 200,
          teamMods: opts.teamMods,
          seed,
        }).baseHpLost,
    ),
  )
  return 1 - lost / ml
}

/** Stop rate for a single tower — the affix/mutation/curse workhorse. */
export const soloStopRate = (
  s: Sentinel,
  wave: WaveDef,
  seeds?: number[],
  opts?: { enemyHpMult?: number },
): number => stopRate([{ sentinel: s, slotId: 's3' }], wave, seeds, opts)

/** Solo-offense benchmark: one build vs a fixed tanky wave; measures throughput. */
export function soloOffense(specId: string, opts: BuildOptions = {}, battleSeed = 4242): BattleMetrics {
  return soloBattle(buildSpec(specId, opts), battleSeed)
}

/**
 * The §1/§4/§7 throughput scenario: one tower, one tanky wave, no leak pressure.
 * Deliberately isolates offense — never use it to judge a heal, shield or slow.
 */
export function soloBattle(s: Sentinel, seed = 4242): BattleMetrics {
  return runBattle({
    team: [{ sentinel: s, slotId: 's3' }],
    depth: 6,
    enemyHpMult: 1.8, // tanky enough to reflect sustained DPS + procs
    baseHp: 999, // isolate offense from leaks
    maxSeconds: 90,
    seed,
  })
}

/**
 * Clear time is the one throughput metric that cannot mis-sign: it is read off
 * the wall clock, not off per-Sentinel damage attribution (which the engine can
 * and did drop for burn, traps and executes). A wave that never clears scores
 * the timeout plus a penalty per survivor, so "slower" and "couldn't finish"
 * stay on one monotone scale.
 */
export function clearScore(m: BattleMetrics, maxSeconds = 90): number {
  return m.cleared ? m.timeSec : maxSeconds + m.baseHpLost * 2
}

/** Fractional improvement in clear time (positive = faster than the baseline). */
export const speedUplift = (baseScore: number, score: number): number =>
  baseScore > 0 ? (baseScore - score) / baseScore : 0

// ---- multi-seed cells -----------------------------------------------------
export interface Stat {
  mean: number
  std: number
  min: number
  max: number
  n: number
  values: number[]
}

export function stat(xs: number[]): Stat {
  return {
    mean: mean(xs),
    std: std(xs),
    min: xs.length ? Math.min(...xs) : 0,
    max: xs.length ? Math.max(...xs) : 0,
    n: xs.length,
    values: xs,
  }
}

/** Run `fn` once per seed and summarise one scalar. The cure for single-seed cells. */
export function multi(seeds: number[], fn: (seed: number) => number): Stat {
  return stat(seeds.map(fn))
}

/** Run `fn` once per seed and summarise several scalars at once. */
export function multiMetrics<K extends string>(
  seeds: number[],
  fn: (seed: number) => Record<K, number>,
): Record<K, Stat> {
  const rows = seeds.map(fn)
  const keys = Object.keys(rows[0] ?? {}) as K[]
  const out = {} as Record<K, Stat>
  for (const k of keys) out[k] = stat(rows.map((r) => r[k]))
  return out
}

export const SEEDS = [11, 137, 409, 1013, 2411, 5171, 7919]

// ---- fresh-player modelling ----------------------------------------------
/**
 * The three items a brand-new run actually starts with
 * (`gameStore.startingInventory`): a common one-hand, a common body, a rare
 * off-hand. Reproduced here rather than imported because the store pulls in
 * zustand + the audio module.
 */
export function startingItems(rng: RNG, extra = 0): Item[] {
  const items = [
    generateItem(rng, { slot: 'oneHand', rarity: 'common' }),
    generateItem(rng, { slot: 'body', rarity: 'common' }),
    generateItem(rng, { slot: 'offHand', rarity: 'rare' }),
  ]
  // `Quartermaster` (hub, `loot`): the same extra rolls the store deals, at the
  // same luck. Roster-blind on purpose — `newRun` deals the kit before the hero
  // is picked, so `startingInventory` is called with no roster there either.
  for (let i = 0; i < extra; i++) items.push(generateItem(rng, { luck: 0.1 }))
  return items
}

/** A level-1 hero of the given archetype with the real starting kit equipped. */
export function freshHero(archetype: Archetype, rng: RNG): Sentinel {
  const s = createSentinel(archetype)
  const [oneHand, body, offHand] = startingItems(rng)
  return { ...s, equipment: { mainHand: oneHand, offHand, body } }
}

// ---- the shop and the map, as a real first run meets them -----------------
/**
 * `gameStore`'s merchant prices and hire cost, mirrored here for the same reason
 * {@link startingItems} is: importing the store pulls in zustand and the audio
 * module. Keep these three in step with `gameStore.ITEM_PRICE` / `RECRUIT_PRICE`
 * / `MAX_ROSTER`.
 */
export const ITEM_PRICE: Record<ItemRarity, number> = { common: 30, rare: 60, epic: 110, legendary: 200, mythic: 340 }
export const RECRUIT_PRICE = 80
export const MAX_ROSTER = 5

/**
 * `gameStore.scaledRecruit` **with no meta unlocks**: a hire arrives at the
 * roster's median level MINUS 3 (the `freeCompanies` unlock is what removes the
 * −3). This matters more than any other number in the fresh-player model — the
 * old sweep handed the player a *level-1* body at a recruit node, which is not
 * what the game does and made "two free recruits" look worth 2 points.
 */
export function scaledRecruitLevel(roster: Sentinel[], trained = false): number {
  if (!roster.length) return 1
  const levels = roster.map((s) => s.level).sort((a, b) => a - b)
  const median = levels[Math.floor(levels.length / 2)]
  return Math.max(1, trained ? median : median - 3)
}

/**
 * ---------------------------------------------------------------------------
 * How the modelled player shops (M19-f).
 * ---------------------------------------------------------------------------
 *
 * This used to be a hand-rolled `itemScore` that summed `physDamage +
 * magDamage`. `computeCombat` reads **only the one that matches the wielder's
 * `damageType`** (`combat.ts`: `const flat = isPhys ? gear.flatPhys :
 * gear.flatMag`), so every point of magic damage on a Greatsword scored as an
 * upgrade for a Weaponmaster's *mystic* neighbour and vice versa. The modelled
 * player therefore bought, equipped and carried gear the engine scored at zero,
 * and every sweep downstream of it — merchant value, reward-card value, the
 * whole fresh-run win rate — was measuring a player who cannot read.
 *
 * It also mis-priced the enchantments (a flat +6 per affix regardless of what
 * the affix did) and ignored `damageMult` / `rateMult` / crit entirely, which
 * are the three things gear moves most.
 *
 * The fix is to stop modelling the scoring at all and **ask the engine**:
 * {@link heroDps} is `computeCombat(s).dps`, the same function the tooltip and
 * the battle use. An item is an upgrade for a hero exactly when equipping it
 * raises that number.
 */
export const heroDps = (s: Sentinel): number => computeCombat(s).dps

/** The slots on a hero an item of this kind may occupy. */
const slotsFor = (item: Item): HeroSlot[] =>
  item.slot === 'offHand' ? ['offHand'] : item.slot === 'body' ? ['body'] : ['mainHand', 'offHand']

/** Equip `item` into `slot` without mutating `s`. */
const withItem = (s: Sentinel, slot: HeroSlot, item: Item): Sentinel => ({
  ...s,
  equipment: { ...s.equipment, [slot]: item },
})

/**
 * How much DPS `item` adds to `s` in the best slot it can occupy — measured by
 * the engine's own `computeCombat`, so a physical weapon is worth nothing to a
 * mystic and an off-type stat line cannot masquerade as an upgrade.
 * Positive means it is an upgrade.
 */
export function bestSlotGain(s: Sentinel, item: Item): number {
  if (item.keepsake) return 0
  const now = heroDps(s)
  let gain = -Infinity
  for (const slot of slotsFor(item)) gain = Math.max(gain, heroDps(withItem(s, slot, item)) - now)
  return gain
}

/** Equip `item` if it raises the wielder's DPS; returns the (possibly) new hero. */
export function equipIfBetter(s: Sentinel, item: Item): Sentinel {
  if (item.keepsake) return s
  const now = heroDps(s)
  let best: { slot: HeroSlot; dps: number } | null = null
  for (const slot of slotsFor(item)) {
    const dps = heroDps(withItem(s, slot, item))
    if (dps > now && (!best || dps > best.dps)) best = { slot, dps }
  }
  return best ? withItem(s, best.slot, item) : s
}

/** Auto-pick an evolution when one is owed (a real player always takes one). */
export function autoEvolve(s: Sentinel, rng: RNG): Sentinel {
  let out = s
  for (let guard = 0; guard < 4; guard++) {
    const owed =
      (out.level >= 10 && out.branchPath.length === 1) || (out.level >= 20 && out.branchPath.length === 2)
    if (!owed) break
    const options = childrenOf(out.branchPath[out.branchPath.length - 1])
    if (!options.length) break
    out = evolveInto(out, rng.pick(options).id)
  }
  return out
}

/**
 * Spend gold on tower upgrades the way an income-constrained player does: buy the
 * cheapest affordable next level, respecting the XP milestones (level 2 / 8 / 14),
 * focusing one path before dabbling in a second.
 */
export function buyUpgrades(s: Sentinel, gold: number): { hero: Sentinel; gold: number } {
  const upgrades = { ...(s.upgrades ?? {}) }
  let purse = gold
  for (let guard = 0; guard < 9; guard++) {
    let bought = false
    for (const path of UPGRADE_PATHS) {
      const lvl = upgrades[path.id] ?? 0
      if (lvl >= MAX_PATH_LEVEL) continue
      if (s.level < UPGRADE_MILESTONES[lvl]) continue
      const cost = path.levels[lvl].cost
      if (purse < cost) continue
      upgrades[path.id] = lvl + 1
      purse -= cost
      bought = true
      break // one purchase per pass → focuses the cheapest path first
    }
    if (!bought) break
  }
  return { hero: { ...s, upgrades }, gold: purse }
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
