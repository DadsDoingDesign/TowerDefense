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
import { ALL_NODES, getNode, type TreeNode } from '../src/game/data/archetypeTree'
import { leakCeiling } from '../src/game/data/enemies'
import type { CommandId } from '../src/game/data/commands'
import { ALL_MAPS, FIRST_MAP } from '../src/game/data/maps'
import { createSentinel } from '../src/game/data/sentinels'
import { generateItem, type RosterRef } from '../src/game/data/items'
import { startingKit, wearKit } from '../src/game/engine/kit'
import { recruitTargetLevel } from '../src/game/run/recruits'
import { generateEncounter, type EncounterKind } from '../src/game/data/waves'
import { pathLength } from '../src/game/data/maps'
import { computeCombat } from '../src/game/engine/combat'
import { GameEngine, type BehaviourStats, type EngineRules } from '../src/game/engine/engine'
import { applyXp, evolveInto } from '../src/game/engine/leveling'
import { perkChoices } from '../src/game/run/perks'
import { availableEvolutions } from '../src/game/run/unlocks'

/** The modelled player has earned no feats: feat-locked specs are closed (Phase 3b). */
const NO_FEATS = (): boolean => false
import { pendingPerkLevel } from '../src/game/run/perks'
import { perkModsOf } from '../src/game/data/perks'
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
  /** Spec perks to hold, by id (Phase 3b). Overrides `perkSeed`. */
  perks?: string[]
  /**
   * Take a random base perk at every milestone the build's level has reached,
   * off this seed — the depth-appropriate stand-in for the upgrade levels the
   * old `depthUpgrades` bought. Omitted: no perks (the §1–§5 benches measure a
   * spec as the tree defines it).
   */
  perkSeed?: number
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
  if (opts.perks) s = { ...s, perks: [...opts.perks] }
  else if (opts.perkSeed != null) s = randomPerks(s, new RNG(opts.perkSeed))
  if (opts.mutations) s = { ...s, mutations: opts.mutations }
  if (opts.equipment) s = { ...s, equipment: { ...s.equipment, ...opts.equipment } }
  return s
}

/** A single-affix test item: one enchantment, no base stats, so the affix is the variable. */
export function affixItem(id: string, ench: Item['enchantments'][number], slot: ItemSlot = 'oneHand'): Item {
  return { id: `t_${id}`, name: id, slot, rarity: 'epic', base: {}, enchantments: [ench] }
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
  /** The wave that was fought — the run layer re-prices its XP (Phase 3b). */
  wave: WaveDef
  /** What the behaviour kit, interactions and commands did (Phase 3a — REPORT §16). */
  stats: BehaviourStats
  /** Ticks (at the harness `dt`) at which each Watch Command fired. */
  commandTicks: number[]
}

/**
 * ---------------------------------------------------------------------------
 * The modelled player's in-battle inputs (Phase 3a)
 * ---------------------------------------------------------------------------
 *
 * A battle has inputs now — one Watch Command per sub-wave, one reposition per
 * breather, and a targeting order that can change — so a harness that fights
 * waves has to say who is pressing the buttons. Every policy is a pure
 * function of engine state, so a policy run is as reproducible as the seed.
 *
 *  - `command` — WHEN the charge is spent: `none` (never — every pre-3a
 *    number), `early` (the first tick of each sub-wave, before anything is in
 *    range — the button-masher), `surge` (when enough bodies are inside the
 *    company's reach, or the column is nearly through), `finish` (once the
 *    sub-wave is all out and only its last one or two bodies — usually the
 *    toughest, the ones that leak — are left).
 *  - `reposition` — at each breather: `none`, `sponge` (put a fighter on the
 *    first post the lane passes, where the bombers' lobs and the sappers
 *    land), `cover` (move the hero on the least-covered post to the
 *    best-covered free one), `uncover` (the reverse — the hardest-hitting hero
 *    to the worst free post).
 *
 * `PLAYER` is the default the whole-run sweeps (§6, §11–§13) play with: a
 * player who uses the Rally Horn sensibly and otherwise leaves the line alone.
 */
export interface PlayerPolicy {
  command: 'none' | 'early' | 'surge' | 'finish'
  /** Which of the company's commands to spend (default: the first it carries). */
  commandId?: CommandId
  reposition: 'none' | 'sponge' | 'cover' | 'uncover'
}
export const NO_INPUT: PlayerPolicy = { command: 'none', reposition: 'none' }

/**
 * **Bench mode** — the pre-3a battle shape, for the sweeps that grade an
 * ITEM's stat contribution on a pinned scenario: §4 affixes, §8 mutations,
 * §10 curses, §15 reward cards.
 *
 * Why those four and nothing else. Each grades a number on a gear piece or a
 * card against a scenario whose pressure was FITTED (`BENCH_PIN`, the card
 * pins) so the baseline sits where an affix can be resolved. Sub-waves, the
 * breather's mend and the enemy kit reshape every one of those scenarios at
 * once — measured on the first full-rules pass, `magic`'s baseline fell to
 * 10% (band 15–75%) and eleven item verdicts flipped on a bench that had
 * moved under them rather than on anything about the items. Those files are
 * also being re-tuned in parallel (RUN/META owns items, mutations and cards),
 * and moving their bench under that work is the shared-constant collision the
 * audit names as the one that broke convergence.
 *
 * So they keep grading the item on the shape they were fitted to, and the new
 * rules are graded where they belong: the kit, its counters, the commands and
 * the interactions in §16, and the campaign-level consequences in §6 and
 * §11–§13, which play with every rule on. §2 (supports), §5 (pressure) and §14
 * (variety) grade the ENCOUNTERS and so also run with every rule on.
 */
export const BENCH_RULES: Partial<EngineRules> = { behaviours: false, interactions: false, subWaves: false }
export const PLAYER: PlayerPolicy = { command: 'surge', reposition: 'none' }

/** Should the policy fire its command this tick? */
function wantsCommand(engine: GameEngine, policy: PlayerPolicy, id: CommandId): boolean {
  if (!engine.canUseCommand(id)) return false
  const len = engine.path.length
  let lead = 0
  for (const e of engine.enemies) if (e.distance > lead) lead = e.distance
  switch (policy.command) {
    case 'none':
      return false
    case 'early':
      return true
    case 'finish':
      // The sub-wave is all out and all but its last one or two are dead —
      // and the last ones standing are the ones that were hardest to kill.
      return engine.subWaveSpawned() && engine.enemies.length > 0 && engine.enemies.length <= 2
    case 'surge': {
      if (id === 'hold') return lead > len * 0.85
      if (id === 'flare') {
        if (lead < len * 0.5) return false
        const front = engine.enemies.reduce((a, e) => (e.distance > a.distance ? e : a))
        return engine.enemies.filter((e) => Math.hypot(e.pos.x - front.pos.x, e.pos.y - front.pos.y) <= 160).length >= 3
      }
      // Rally: when enough of the column is inside the company's reach.
      let engaged = 0
      for (const e of engine.enemies) {
        if (engine.sentinels.some((s) => !s.downed && Math.hypot(s.pos.x - e.pos.x, s.pos.y - e.pos.y) <= s.profile.range)) engaged++
      }
      return engaged >= 4 || (engaged >= 1 && lead > len * 0.6)
    }
  }
}

/** The breather's one move, per policy. */
function repositionAt(engine: GameEngine, policy: PlayerPolicy): void {
  if (policy.reposition === 'none') return
  // Posts in the order the lane reaches them.
  const order = [...engine.sentinels]
    .map((s) => ({ s, d: nearestPathDistance(engine, s.pos) }))
    .sort((a, b) => a.d - b.d)
  if (order.length < 2) return
  const first = order[0].s
  const fighter = order.find((o) => o.s.def.archetype === 'fighter')?.s
  if (policy.reposition === 'sponge') {
    if (fighter && first.def.archetype !== 'fighter') engine.moveHero(fighter.slotId, first.slotId)
    return
  }
  const cov = slotCoverage(engine.map)
  const free = engine.map.slots.filter((sl) => !engine.sentinelOnSlot(sl.id)).map((sl) => sl.id)
  if (!free.length) return
  free.sort((a, b) => cov[b] - cov[a] || a.localeCompare(b))
  if (policy.reposition === 'cover') {
    const worstHeld = [...engine.sentinels].sort((a, b) => cov[a.slotId] - cov[b.slotId])[0]
    if (cov[free[0]] > cov[worstHeld.slotId]) engine.moveHero(worstHeld.slotId, free[0])
  } else if (policy.reposition === 'uncover') {
    const ace = [...engine.sentinels].sort((a, b) => b.profile.dps - a.profile.dps)[0]
    engine.moveHero(ace.slotId, free[free.length - 1])
  }
}

function nearestPathDistance(engine: GameEngine, p: { x: number; y: number }): number {
  let best = Infinity
  let bd = 0
  for (let d = 0; d <= engine.path.length; d += 16) {
    const q = engine.path.pointAt(d)
    const dd = (q.x - p.x) ** 2 + (q.y - p.y) ** 2
    if (dd < best) {
      best = dd
      bd = d
    }
  }
  return bd
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
  /** Who presses the in-battle buttons (default {@link NO_INPUT}). */
  player?: PlayerPolicy
  /** Watch Commands the company carries (default: the engine's — Rally Horn). */
  commands?: readonly CommandId[]
  /** Counterfactual engine switches (REPORT §16 only). */
  rules?: Partial<EngineRules>
  /** `false`: generate the node as one continuous wave (the pre-3a shape; see `BENCH_RULES`). */
  subWaves?: boolean
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
      subWaves: opts.subWaves,
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
    commands: opts.commands,
    rules: opts.rules,
  })
  const player = opts.player ?? NO_INPUT
  const commandId = player.commandId ?? engine.commands[0]
  const commandTicks: number[] = []
  /*
   * `maxSeconds` is a cap PER SUB-WAVE (Phase 3a). Every cap in the suite was
   * sized for one continuous wave; a node cut into sub-waves fights them back
   * to back, so a whole-battle cap silently truncated the later sub-waves —
   * and a truncated wave leaks nothing, which reads as a stronger defence.
   * Measured on the first pass: §14c's depth-8 patrol "leaked" 0.14 base HP
   * against 7.39 before, because the 120s cap ended it during sub-wave 2.
   */
  let steps = 0
  let liveSub = engine.subWave
  while (engine.status === 'running' && steps < maxSteps) {
    // Inputs land between steps, exactly where a live tap lands.
    if (engine.breather) repositionAt(engine, player)
    else if (commandId && wantsCommand(engine, player, commandId) && engine.useCommand(commandId)) commandTicks.push(engine.tick)
    engine.step(dt)
    steps++
    if (engine.subWave !== liveSub) {
      liveSub = engine.subWave
      steps = 0
    }
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
    wave,
    perSentinel: res.perSentinel.map((p) => ({
      id: p.id,
      damage: p.damageDealt,
      kills: p.kills,
      xp: p.xpGained,
      downed: p.downed,
    })),
    stats: { ...engine.behaviourStats },
    commandTicks,
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
  // `leakCeiling` counts a splitter's pieces too (Phase 3a), or a wave whose
  // imps leaked could read as a negative stop rate.
  return wave.spawns.reduce((a, s) => a + leakCeiling(s.typeId), 0)
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
  opts: { enemyHpMult?: number; maxSeconds?: number; teamMods?: EffectMods[]; rules?: Partial<EngineRules> } = {},
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
          rules: opts.rules,
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
  opts?: { enemyHpMult?: number; rules?: Partial<EngineRules> },
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
 * The kit a brand-new run opens with — **the store's own function**
 * (`src/game/engine/kit.ts`), not a copy of it. This used to be a hand-kept
 * mirror of `gameStore.startingInventory`, and the two disagreed about the one
 * moment every run shares: the store dealt the kit roster-blind *before* the
 * hero was picked and left it in the pack, while this modelled it worn. Both
 * now call `startingKit` after the pick and `wearKit` onto the hero.
 */
export function startingItems(rng: RNG, archetype: Archetype, extra = 0, roster?: readonly RosterRef[]): Item[] {
  return startingKit(rng, archetype, { extra, roster })
}

/** A level-1 hero of the given archetype wearing the real opening kit. */
export function freshHero(archetype: Archetype, rng: RNG): Sentinel {
  return wearKit(createSentinel(archetype), startingKit(rng, archetype))
}

// ---- the shop and the map, as a real first run meets them -----------------
/**
 * The shop's prices, the hire cost and the roster cap — the game's own numbers
 * from `src/game/run/economy.ts` (pure, no zustand), re-exported so the run
 * model charges exactly what the store charges. They used to be mirrored here.
 */
export { ITEM_PRICE, MAX_ROSTER, RECRUIT_PRICE } from '../src/game/run/economy'

/**
 * The level a hire arrives at **with no meta unlocks**: the roster's median
 * level MINUS 3 (the `freeCompanies` unlock is what removes the −3). This is
 * the store's own rule (`src/game/run/recruits.recruitTargetLevel`), not a copy
 * of it. It matters more than any other number in the fresh-player model — the
 * old sweep handed the player a *level-1* body at a recruit node, which is not
 * what the game does and made "two free recruits" look worth 2 points.
 */
export function scaledRecruitLevel(roster: Sentinel[], trained = false): number {
  return recruitTargetLevel(roster, trained)
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
  return equipAndDisplace(s, item).hero
}

/**
 * {@link equipIfBetter}, also returning whatever the item unseated. The run
 * model keeps those in a **pack**, exactly as the store does, because a
 * mid-run hire arrives bare (`gameStore.scaledRecruit`) and dresses out of it.
 */
export function equipAndDisplace(s: Sentinel, item: Item): { hero: Sentinel; displaced: Item | null } {
  if (item.keepsake) return { hero: s, displaced: null }
  const now = heroDps(s)
  let best: { slot: HeroSlot; dps: number } | null = null
  for (const slot of slotsFor(item)) {
    const dps = heroDps(withItem(s, slot, item))
    if (dps > now && (!best || dps > best.dps)) best = { slot, dps }
  }
  return best
    ? { hero: withItem(s, best.slot, item), displaced: s.equipment[best.slot] ?? null }
    : { hero: s, displaced: null }
}

/** Auto-pick an evolution when one is owed (a real player always takes one). */
export function autoEvolve(s: Sentinel, rng: RNG): Sentinel {
  let out = s
  for (let guard = 0; guard < 4; guard++) {
    const owed =
      (out.level >= 10 && out.branchPath.length === 1) || (out.level >= 20 && out.branchPath.length === 2)
    if (!owed) break
    const options = availableEvolutions(out, NO_FEATS)
    if (!options.length) break
    out = evolveInto(out, rng.pick(options).id)
  }
  return out
}

/**
 * The "known answer" evolution: whichever child raises `heroDps` most. Draws
 * nothing from any RNG. The random pick above is what every gate reads; this
 * exists so the report can measure how *solved* the build layer is — the win
 * rate a spreadsheet player gets over a coin-flipper (Phase 3b).
 */
export function bestEvolve(s: Sentinel): Sentinel {
  let out = s
  for (let guard = 0; guard < 4; guard++) {
    const owed =
      (out.level >= 10 && out.branchPath.length === 1) || (out.level >= 20 && out.branchPath.length === 2)
    if (!owed) break
    const options = availableEvolutions(out, NO_FEATS)
    if (!options.length) break
    let best = options[0]
    let bestDps = -Infinity
    for (const o of options) {
      const d = heroDps(evolveInto(out, o.id))
      if (d > bestDps) { bestDps = d; best = o }
    }
    out = evolveInto(out, best.id)
  }
  return out
}

/**
 * An evolution with some picks pinned: `force[parentId]` names the child to
 * take at that node; anything unpinned is the usual coin flip. The oracle in
 * `meta-sweep.ts phase3b` pins each choice point in turn to find the picks a
 * run is measurably best off taking — the "known answer", measured rather than
 * guessed from a tooltip.
 */
export function forcedEvolve(s: Sentinel, force: Record<string, string>, rng: RNG): Sentinel {
  let out = s
  for (let guard = 0; guard < 4; guard++) {
    const owed =
      (out.level >= 10 && out.branchPath.length === 1) || (out.level >= 20 && out.branchPath.length === 2)
    if (!owed) break
    const parent = out.branchPath[out.branchPath.length - 1]
    const options = availableEvolutions(out, NO_FEATS)
    if (!options.length) break
    const pinned = force[parent]
    out = evolveInto(out, pinned && options.some((o) => o.id === pinned) ? pinned : rng.pick(options).id)
  }
  return out
}

/**
 * Take every perk a hero owes, at random among the base options (Phase 3b).
 * Draws one pick per owed milestone off `rng`.
 */
export function randomPerks(s: Sentinel, rng: RNG): Sentinel {
  let out = s
  for (let guard = 0; guard < 3 && pendingPerkLevel(out) !== null; guard++) {
    const opts = perkChoices(out)
    if (!opts.length) break
    out = { ...out, perks: [...(out.perks ?? []), rng.pick(opts).id] }
  }
  return out
}

/**
 * The "known answer" perk: whichever option raises `heroDps` most. `heroDps`
 * reads damage × rate × crit only, so it is blind to most rules (a ward, a
 * regen, a volley) — which is the point of measuring it: a perk set whose
 * greedy pick wins by a mile is a solved choice.
 */
export function bestPerks(s: Sentinel): Sentinel {
  let out = s
  for (let guard = 0; guard < 3 && pendingPerkLevel(out) !== null; guard++) {
    const opts = perkChoices(out)
    if (!opts.length) break
    let best = opts[0]
    let bestDps = -Infinity
    for (const o of opts) {
      const d = heroDps({ ...out, perks: [...(out.perks ?? []), o.id] })
      if (d > bestDps) { bestDps = d; best = o }
    }
    out = { ...out, perks: [...(out.perks ?? []), best.id] }
  }
  return out
}

/** Perks with some milestones pinned: `force['5:fighter']` names the pick there. */
export function forcedPerks(s: Sentinel, force: Record<string, string>, rng: RNG): Sentinel {
  let out = s
  for (let guard = 0; guard < 3; guard++) {
    const level = pendingPerkLevel(out)
    if (level === null) break
    const opts = perkChoices(out)
    if (!opts.length) break
    const pinned = force[`${level}:${out.branchPath[level === 5 ? 0 : 1]}`]
    const pick = pinned && opts.some((o) => o.id === pinned) ? pinned : rng.pick(opts).id
    out = { ...out, perks: [...(out.perks ?? []), pick] }
  }
  return out
}

/** Re-exported for the benches that grade a perk's mods directly. */
export { perkModsOf }

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
