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
import { ENEMY_TYPES, leakCeiling } from '../src/game/data/enemies'
import { tileDamageMult } from '../src/game/data/hazards'
import { crowdedBy, parseTileId, withinClearance, type Post } from '../src/game/data/terrain'
import { isMelee } from '../src/game/engine/melee'
import type { CommandId } from '../src/game/data/commands'
import { ALL_MAPS, FIRST_MAP, legacyPosts } from '../src/game/data/maps'
import { CLASSIC_KIT, classicHero } from '../src/game/data/sentinels'
import { generateItem, heroSlotsFor, heroStyle, itemNoun, type HeroStyle, type RosterRef } from '../src/game/data/items'
import { lookOf } from '../src/game/data/gear'
import { startingKit, wearKit, type EquipRules } from '../src/game/engine/kit'
import { recruitTargetLevel } from '../src/game/run/recruits'
import { wearItem } from '../src/game/run/inventory'
import { generateEncounter, type EncounterKind } from '../src/game/data/waves'
import { pathLength } from '../src/game/data/maps'
import { computeCombat } from '../src/game/engine/combat'
import { GameEngine, type BehaviourStats, type EngineRules } from '../src/game/engine/engine'
import { applyXp } from '../src/game/engine/leveling'
import {
  ALL_SKILLS,
  BUMP_STATS,
  EVOLUTION_TO_SKILL,
  PERK_TO_SKILL,
  skillById,
  skillModsOf,
  STARTER_SKILLS,
  type BumpStat,
} from '../src/game/data/skills'
import { MAX_SKILLS, pendingMilestone, poolFor, SKILL_MILESTONES, skillOffer, slotsFull, takeBump, takeSkill } from '../src/game/run/skills'
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

/** Every skill in the library — a veteran's pool (the §1–§5 benches). */
export const FULL_SKILL_POOL: readonly string[] = ALL_SKILLS.map((k) => k.id)
/** The pool a zero-meta player deals from: the nine starters (SK1). */
export const STARTER_SKILL_POOL: readonly string[] = STARTER_SKILLS

export const TIER2_NODES: TreeNode[] = ALL_NODES.filter((n) => n.tier === 2)
/** Every open deployment tile on The Green Line (G1-2: tiles, not six circles). */
export const SLOT_IDS = FIRST_MAP.slots.map((s) => s.id)
/**
 * The fixed benches' posts (G1-2). Deployment is a tile grid now; the benches
 * that pinned a hero to a named circle (`s3`, "the third slot") pin it to the
 * Green Line tile nearest where that circle stood (`maps.legacyPostTile`), so
 * each bench still measures the same kind of post it always did.
 */
/**
 * The road each old circle saw at 150px on the pre-grid Green Line (REPORT
 * §14a as it stood before G1-2). A pinned bench is calibrated against how much
 * road its hero sees, not against a coordinate — s3 was the field's WORST
 * circle (384px), and the tile nearest it on the grid sees 520 — so each post
 * is the open tile within reach of where its circle stood whose coverage is
 * closest to the circle's, nearest first on a tie.
 */
const PRE_GRID_COVERAGE = { s0: 434, s1: 432, s2: 560, s3: 384, s4: 567, s5: 543 } as const
/**
 * Grid-fit: the fine (40px) tiles that stand where G1-2's 80px tiles stood
 * relative to the road — even column, even row (`terrain.fineFromCoarse`).
 * The pinned benches choose among these only, so every bench keeps the exact
 * post it had on the 80px grid and measures what it always measured; only the
 * modelled player's own deployment (`deployTeam`, `bestSlots`) uses the finer
 * grid's in-between tiles.
 */
const onCoarse = (id: string): boolean => {
  const p = parseTileId(id)
  return !!p && p.c % 2 === 0 && p.r % 2 === 0
}
function calibratedPosts(): Record<keyof typeof PRE_GRID_COVERAGE, string> {
  const near = legacyPosts(FIRST_MAP.id)
  const cov = slotCoverage(FIRST_MAP)
  const pos = new Map(FIRST_MAP.slots.map((s) => [s.id, s.pos]))
  const taken = new Set<string>()
  const out = {} as Record<keyof typeof PRE_GRID_COVERAGE, string>
  for (const id of Object.keys(PRE_GRID_COVERAGE) as (keyof typeof PRE_GRID_COVERAGE)[]) {
    const at = pos.get(near[id])!
    const d = (s: string) => Math.hypot(pos.get(s)!.x - at.x, pos.get(s)!.y - at.y)
    const pick = FIRST_MAP.slots
      .map((s) => s.id)
      .filter((s) => onCoarse(s) && !taken.has(s) && ![...taken].some((t) => withinClearance(t, s)) && d(s) <= 115)
      .sort((a, b) => Math.abs(cov[a] - PRE_GRID_COVERAGE[id]) - Math.abs(cov[b] - PRE_GRID_COVERAGE[id]) || d(a) - d(b) || a.localeCompare(b))[0]
    out[id] = pick ?? near[id]
    taken.add(out[id])
  }
  return out
}
export const POST = calibratedPosts()

/**
 * Roles used to interpret solo-offense numbers (supports read low on purpose).
 * A support is a spec whose value is an aura on OTHER heroes. Aegis, Bulwark and
 * Warden of Ash were here for a shield aura and a hold that ate the line's
 * melee; both went with hero HP (the no-HP pass), so they are graded as
 * offense/control in §1 now.
 */
export const SUPPORT_SPECS = new Set([
  'bannerman', // the one fighter aura
  'radiant', 'templar', 'oracle', // cleric
])
/** Same set, in a stable order, so table rows don't depend on Set iteration. */
export const SUPPORT_SPEC_IDS = ['bannerman', 'radiant', 'templar', 'oracle']

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

/** The largest aura radius any node in the tree grants (currently Radiant, 210). */
export const MAX_AURA_RADIUS = Math.max(...ALL_NODES.map((n) => n.mods?.buffAura?.radius ?? 0))

/**
 * The aura bench's triangle: the tiles nearest where the old s3/s2/s4 circles
 * stood — the support 113px from one ally and 80px from the other, both inside
 * every aura in the game (120–160). Before the grid (G1-2) this was the ONLY
 * such trio on the field (every other circle was 190px+ from its nearest
 * pair); on the grid any two neighbouring tiles are 80px apart, so auras reach
 * wherever the player stacks the company — which is itself a balance fact
 * REPORT §2 now reads rather than assumes.
 */
export const AURA_TRIO = auraTrio()
/**
 * The support at the s3 bench post; its allies are the two open tiles within
 * one tile (diagonal included, ≤ 113px — inside every aura) whose road
 * coverage is nearest the old s2/s4 circles' (~563px), so the carriers the
 * aura lands on see what they always saw.
 */
function auraTrio(): { support: string; allies: readonly [string, string] } {
  const cov = slotCoverage(FIRST_MAP)
  const at = FIRST_MAP.slots.find((s) => s.id === POST.s3)!.pos
  const d = (id: string) => {
    const p = FIRST_MAP.slots.find((s) => s.id === id)!.pos
    return Math.hypot(p.x - at.x, p.y - at.y)
  }
  const near = FIRST_MAP.slots
    .map((s) => s.id)
    .filter((id) => onCoarse(id) && id !== POST.s3 && d(id) <= 115)
    .sort((a, b) => Math.abs(cov[a] - 563) - Math.abs(cov[b] - 563) || d(a) - d(b) || a.localeCompare(b))
  return { support: POST.s3, allies: [near[0], near[1]] as const }
}

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
 *
 * Greedy — each next slot is the best one not beside a slot already taken —
 * and the crowded ones follow, best first, for anything that wants a full
 * ranking. The order is a property of the FIELD, not of a team, so it keeps a
 * clearance (`terrain.CLEARANCE`) between every pair of slots as if each were a
 * Fighter's: a pinned bench keeps the posts it was calibrated on, whoever it
 * stands there. The modelled player's own deployment (`deployTeam`) and its
 * breather move apply the real rule — only a melee hero keeps a clearance.
 */
export function bestSlots(map: Parameters<typeof slotCoverage>[0], range = 150): string[] {
  const cov = slotCoverage(map, range)
  const ranked = [...map.slots].map((s) => s.id).sort((a, b) => cov[b] - cov[a] || a.localeCompare(b))
  const spaced: string[] = []
  for (const id of ranked) if (!spaced.some((t) => withinClearance(t, id))) spaced.push(id)
  return [...spaced, ...ranked.filter((id) => !spaced.includes(id))]
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
  /**
   * Retired spec perks to fold in, by id — each becomes the skill it maps to
   * (`PERK_TO_SKILL`, SK1), while there is a slot for it.
   */
  perks?: string[]
  /**
   * Fill the build's free skill slot with one random Level 1 skill that fits
   * it, off this seed — the skill a hero is picked or hired with (SK1).
   * Omitted: only the skills the spec maps to.
   */
  perkSeed?: number
  /** Extra equipment overriding the generated set (used by the affix sweeps). */
  equipment?: Partial<Sentinel['equipment']>
  mutations?: Sentinel['mutations']
}

/**
 * Build a hero for a tier-2 spec at a target level (default 20). There are no
 * classes: the spec's old class is rebuilt from its gear (`classicHero` — a
 * sword and shield, a dagger, a wand, so it fights exactly as that class
 * did), and its growth is SK1's: as the
 * SKILLS that replaced that spec's evolutions (`EVOLUTION_TO_SKILL`): the
 * sub-archetype's at the level-10 milestone, the specialization's at the
 * level-15 one (the Level 3 skill). So "the Sharpshooter" on a bench is a Rogue
 * holding Long Shot and Long Shot's specialization skill, which is the build a
 * player who wanted that spec can make now. Every milestone its level has
 * passed counts as settled. (`bannerman` maps to Heavy Blows — there is no
 * Fighter aura any more, so §2 reads it as a damage hero, honestly.)
 */
export function buildSpec(specId: string, opts: BuildOptions = {}): Sentinel {
  const spec = getNode(specId)
  const rng = new RNG(opts.seed ?? 1)
  const level = opts.level ?? 20
  let s = classicHero(spec.archetype)
  s = applyXp(s, xpForLevelApprox(level))
  const skills: string[] = []
  const add = (id: string | undefined) => {
    const k = id ? skillById(id) : undefined
    if (k && !skills.includes(k.id) && skills.length < MAX_SKILLS) skills.push(k.id)
  }
  // With a seed, the two Level 1 skills a real hero holds by then: the one it
  // was picked with, and its level-5 milestone's.
  if (!opts.perks && opts.perkSeed != null) {
    const r = new RNG(opts.perkSeed)
    for (const _ of level >= 5 ? [0, 1] : [0]) {
      const l1 = poolFor(FULL_SKILL_POOL, 1, skills)
      if (l1.length) add(r.pick(l1).id)
    }
  }
  if (level >= 10) add(EVOLUTION_TO_SKILL[spec.parent!]) // the tier-1 evolution, as its skill
  if (level >= 15) {
    // The tier-2 evolution's skill arrives at the Level 3 milestone; a full
    // hero swaps its first Level 1 skill out for it.
    const k = skillById(EVOLUTION_TO_SKILL[specId] ?? '')
    if (k && skills.length >= MAX_SKILLS && !skills.includes(k.id)) skills.shift()
    add(k?.id)
  }
  for (const p of opts.perks ?? []) add(PERK_TO_SKILL[p])
  s = { ...s, skills, skillPicks: SKILL_MILESTONES.filter((l) => level >= l).length }
  if (opts.gearRarity) s = equipFullSet(s, opts.gearRarity, rng)
  if (opts.mutations) s = { ...s, mutations: opts.mutations }
  if (opts.equipment) s = { ...s, equipment: { ...s.equipment, ...opts.equipment } }
  return s
}


/**
 * A single-affix test item: one enchantment, no base stats, so the affix is the
 * variable. Named by `noun` when it replaces a weapon: since the classless
 * rework the weapon in hand decides how the hero fights, so a nameless piece in
 * the main hand would turn the bench hero into a stone-thrower.
 */
export function affixItem(id: string, ench: Item['enchantments'][number], slot: ItemSlot = 'oneHand', noun?: string): Item {
  return { id: `t_${id}`, name: noun ? `${noun} (${id})` : id, slot, rarity: 'epic', base: {}, enchantments: [ench] }
}

/** `hero` with `ench` on an affix piece in place of its main hand, keeping its weapon's kind. */
export function withMainAffix(hero: Sentinel, id: string, ench: Item['enchantments'][number]): Sentinel {
  const main = hero.equipment.mainHand
  const noun = main ? itemNoun(main) : undefined
  return { ...hero, equipment: { ...hero.equipment, mainHand: affixItem(id, ench, main?.slot ?? 'oneHand', noun) } }
}

function xpForLevelApprox(level: number): number {
  // Mirror leveling.xpToReach without importing it circularly.
  const l = Math.max(1, level) - 1
  return 40 * l + 8 * l * (l - 1)
}

/**
 * The off-hand piece a bench hero is dressed in when its kit has none: never
 * a shield, which would hand it a hold its old class never had.
 */
const BENCH_OFF: Record<string, string> = { fighter: 'Shield', rogue: 'Quiver', mystic: 'Tome' }

/**
 * A full set at `rarity`. The KINDS are the hero's own (its weapon keeps it
 * what it is — a random weapon would turn a sword-hand into a caster); each
 * forced kind still takes the noun draw, so the rolls behind it are where
 * they always were.
 */
export function equipFullSet(s: Sentinel, rarity: ItemRarity, rng: RNG): Sentinel {
  const equipment = { ...s.equipment }
  const look = lookOf(s)
  const kinds: Record<HeroSlot, ItemSlot> = { mainHand: 'oneHand', offHand: 'offHand', body: 'body' }
  const force: Record<HeroSlot, string | undefined> = {
    mainHand: (s.equipment.mainHand && itemNoun(s.equipment.mainHand)) || CLASSIC_KIT[look].main,
    offHand: (s.equipment.offHand && itemNoun(s.equipment.offHand)) || BENCH_OFF[look],
    body: undefined,
  }
  for (const slot of ['mainHand', 'offHand', 'body'] as HeroSlot[]) {
    equipment[slot] = generateItem(rng, { slot: kinds[slot], rarity, kind: force[slot] })
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
  perSentinel: { id: string; damage: number; kills: number; xp: number }[]
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
        if (engine.sentinels.some((s) => Math.hypot(s.pos.x - e.pos.x, s.pos.y - e.pos.y) <= s.profile.range)) engaged++
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
  // The sponge is whoever HOLDS the road (a shield, or a hold skill).
  const holder = order.find((o) => !!o.s.profile.mods.block)?.s
  if (policy.reposition === 'sponge') {
    if (holder && !first.profile.mods.block) engine.moveHero(holder.slotId, first.slotId)
    return
  }
  // Q1: cursed ground is worth what it leaves after the curse (see `deployTeam`).
  const raw = slotCoverage(engine.map)
  const cov: Record<string, number> = Object.fromEntries(Object.entries(raw).map(([id, c]) => [id, c * tileDamageMult(engine.map, id)]))
  // The tiles the moving hero could go to — open, and not too close to any
  // OTHER hero: nobody beside a Fighter (`terrain.CLEARANCE`), which the
  // engine's `moveHero` refuses anyway.
  const freeFor = (mover: string) => {
    const self = engine.sentinelOnSlot(mover)
    const melee = !!self && isMelee(self.def)
    const others: Post[] = engine.sentinels.filter((s) => s.slotId !== mover).map((s) => ({ tile: s.slotId, melee: isMelee(s.def) }))
    return engine.map.slots
      .filter((sl) => !engine.sentinelOnSlot(sl.id) && !crowdedBy(sl.id, melee, others))
      .map((sl) => sl.id)
      .sort((a, b) => cov[b] - cov[a] || a.localeCompare(b))
  }
  if (policy.reposition === 'cover') {
    const worstHeld = [...engine.sentinels].sort((a, b) => cov[a.slotId] - cov[b.slotId])[0]
    const free = freeFor(worstHeld.slotId)
    if (free.length && cov[free[0]] > cov[worstHeld.slotId]) engine.moveHero(worstHeld.slotId, free[0])
  } else if (policy.reposition === 'uncover') {
    const ace = [...engine.sentinels].sort((a, b) => b.profile.dps - a.profile.dps)[0]
    const free = freeFor(ace.slotId)
    if (free.length) engine.moveHero(ace.slotId, free[free.length - 1])
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
  /** The Sovereign Route's muster: every goblin clan from the first fight (`waves` `muster`). */
  muster?: boolean
  /**
   * G1-2: ignore the team's `slotId`s and post the company the way a competent
   * player does on the tile grid ({@link deployTeam}). Every "the modelled
   * player deploys" call site sets this; the fixed benches pin posts instead.
   */
  autoDeploy?: boolean
}

/**
 * How a competent player posts a company on the tile grid (G1-2).
 *
 * With six fixed circles, "fill the best-coverage slots in order" was a fine
 * model, because every circle hugged the lane. On a grid the tile that sees the
 * most road at a nominal 150px can sit 120px from every lane — useless to a
 * Fighter whose reach is 96 and whose hold is 72. So each hero picks for its
 * OWN reach: shortest reach first (the blockers have the fewest good tiles),
 * each taking the free tile that sees the most road within its range, ties by
 * tile id so the choice is stable (and identical on both twins).
 *
 * Q1: a tile of cursed ground is worth its coverage × `CURSED_DAMAGE_MULT` —
 * the player reads the curse as the damage it costs, and posts there only when
 * the view is still worth it after paying.
 */
const coverageCache = new Map<string, Record<string, number>>()
export function deployTeam(map: GameMap, team: readonly { sentinel: Sentinel; slotId: string }[]): { sentinel: Sentinel; slotId: string }[] {
  const ranged = team.map((m, i) => ({ i, sentinel: m.sentinel, range: Math.round(computeCombat(m.sentinel).range) }))
  ranged.sort((a, b) => a.range - b.range || a.i - b.i)
  const taken = new Set<string>()
  // A swinger's clearance (`terrain.CLEARANCE`; `melee.isMelee`: what it holds): nobody beside it;
  // ranged heroes may stand side by side.
  const posts: Post[] = []
  const out: { sentinel: Sentinel; slotId: string }[] = new Array(team.length)
  // Coverage depends on the path and a tile's centre only, never on which
  // tiles a battle blocks — so it is cached per field and orientation (every
  // Q1 hazard variant of a field shares one entry) over ALL its tiles.
  const geo = { path: map.path, slots: map.tiles ?? map.slots }
  for (const h of ranged) {
    const key = `${map.baseId ?? map.twinOf ?? map.id}:${map.orientation ?? 'landscape'}:${h.range}`
    let cov = coverageCache.get(key)
    if (!cov) {
      cov = slotCoverage(geo, h.range)
      coverageCache.set(key, cov)
    }
    const worth = (id: string) => cov![id] * tileDamageMult(map, id)
    const melee = isMelee(h.sentinel)
    let best: string | null = null
    for (const s of map.slots) {
      if (taken.has(s.id) || crowdedBy(s.id, melee, posts)) continue
      if (best === null || worth(s.id) > worth(best) || (worth(s.id) === worth(best) && s.id < best)) best = s.id
    }
    taken.add(best!)
    posts.push({ tile: best!, melee })
    out[h.i] = { sentinel: h.sentinel, slotId: best! }
  }
  return out
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
      muster: opts.muster,
    })
  if (opts.pressure != null && opts.pressure !== 1) wave = scaleWave(wave, opts.pressure, opts.pressureModel)
  const engine = new GameEngine({
    map: opts.map ?? FIRST_MAP,
    wave,
    placedSentinels: opts.autoDeploy ? deployTeam(opts.map ?? FIRST_MAP, opts.team) : opts.team,
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
    wave,
    perSentinel: res.perSentinel.map((p) => ({
      id: p.id,
      damage: p.damageDealt,
      kills: p.kills,
      xp: p.xpGained,
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
  // The Powderkeg King's TNT is a clock, not a count (no-HP rule change): it
  // is priced here as the throws an unhindered walk down The Green Line gives
  // him, so a bench that fields him cannot read below zero on his lobs alone.
  return wave.spawns.reduce((a, s) => {
    const t = ENEMY_TYPES[s.typeId]
    const king = t?.behaviours?.find((b) => b.kind === 'kingLob')
    const clock = king && king.kind === 'kingLob' ? Math.ceil((FIRST_MAP_LENGTH / t!.speed - king.first) / king.interval + 1) * king.gateDamage : 0
    return a + leakCeiling(s.typeId) + clock
  }, 0)
}
const FIRST_MAP_LENGTH = pathLength(FIRST_MAP.path)

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
): number => stopRate([{ sentinel: s, slotId: POST.s3 }], wave, seeds, opts)

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
    team: [{ sentinel: s, slotId: POST.s3 }],
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
export function startingItems(rng: RNG, extra = 0, roster?: readonly RosterRef[], kinds?: readonly string[]): Item[] {
  return startingKit(rng, { extra, roster, kinds })
}

/**
 * A level-1 hero of the old class `archetype` stood for, dressed the way a
 * PICKED hero arrives (`heroes.pickRarity`): a common weapon of its kind (Epic
 * for a caster), a rare off-hand piece, a common body.
 */
export function freshHero(archetype: Archetype, rng: RNG): Sentinel {
  const bare = classicHero(archetype)
  const kit = CLASSIC_KIT[archetype]
  const main = generateItem(rng, { kind: kit.main, rarity: archetype === 'mystic' ? 'epic' : 'common', allowCurse: false })
  const body = generateItem(rng, { slot: 'body', rarity: 'common', allowCurse: false })
  const off = generateItem(rng, { kind: kit.off ?? BENCH_OFF[archetype], rarity: 'rare', allowCurse: false })
  return wearKit({ ...bare, equipment: { mainHand: null, offHand: null, body: null } }, [main, body, off])
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

/**
 * The slots on a hero an item may occupy — the game's own rule
 * (`items.heroSlotsFor`): the item's grip (round 3, Q5 — a knife or wand fits
 * either hand, a sword the main hand, a two-hander the main hand only) and,
 * for a main-hand one-hander in the off hand, the Twinblade Harness plus the
 * hero's DEX (Q4).
 *
 * This model used to read a two-hander as "either hand, nothing cleared" —
 * a Greatsword in the off hand beside a sword. Q5 is "not something big", and
 * the model now wears items exactly as the store does ({@link withItem} is
 * `inventory.wearItem`): a two-hander empties the off hand.
 */
const slotsFor = (s: Sentinel, item: Item, rules: EquipRules = {}): HeroSlot[] => heroSlotsFor(item, s, rules)

/** Equip `item` into `slot` without mutating `s`, by the store's two-hand rules. */
const wear = (s: Sentinel, slot: HeroSlot, item: Item): { hero: Sentinel; displaced: Item[] } => {
  const r = wearItem(s.equipment, item, slot)
  return { hero: { ...s, equipment: r.equipment }, displaced: r.displaced }
}
const withItem = (s: Sentinel, slot: HeroSlot, item: Item): Sentinel => wear(s, slot, item).hero

/**
 * Does wearing this keep the hero's JOB? (The classless rework.) The weapon
 * now decides what a hero does, and {@link heroDps} reads damage × rate × crit
 * only — blind to range, splash and holding. Scored on it alone, the modelled
 * player traded every wand for a sword (a sword's base hit is bigger) and
 * turned its casters into 96-reach swingers, and dropped shields for quivers.
 * A player who drafted a caster keeps it casting, so a move counts only when
 * the hero's style is unchanged (an unarmed hero may take any weapon) and its
 * hold does not shrink.
 */
const keepsJob = (before: Sentinel, after: Sentinel): boolean => {
  const style = heroStyle(before)
  if (style && heroStyle(after) !== style) return false
  const a = computeCombat(after)
  const b = computeCombat(before)
  // Item identities (October audit): a Plate out-DPSes a Mail and a Grimoire a
  // Staff, because `dps` cannot see the blast or the reach they give up. The
  // modelled player reads the card: it never trades away a hold, a blast or a
  // reach it already has for DPS (the 1e-9 forgives float noise).
  return (a.mods.block?.count ?? 0) >= (b.mods.block?.count ?? 0) && a.splashRadius >= b.splashRadius - 1e-9 && a.range >= b.range - 1e-9
}

/**
 * How much DPS `item` adds to `s` in the best slot it can occupy — measured by
 * the engine's own `computeCombat`, so a physical weapon is worth nothing to a
 * mystic and an off-type stat line cannot masquerade as an upgrade.
 * Positive means it is an upgrade.
 */
export function bestSlotGain(s: Sentinel, item: Item, rules: EquipRules = {}): number {
  if (item.keepsake) return 0
  const now = heroDps(s)
  let gain = -Infinity
  for (const slot of slotsFor(s, item, rules)) {
    const after = withItem(s, slot, item)
    if (keepsJob(s, after)) gain = Math.max(gain, heroDps(after) - now)
  }
  return gain
}

/** Equip `item` if it raises the wielder's DPS; returns the (possibly) new hero. */
export function equipIfBetter(s: Sentinel, item: Item, rules: EquipRules = {}): Sentinel {
  return equipAndDisplace(s, item, rules).hero
}

/**
 * {@link equipIfBetter}, also returning whatever the item unseated. The run
 * model keeps those in a **pack**, exactly as the store does, because a
 * mid-run hire arrives bare (`gameStore.scaledRecruit`) and dresses out of it.
 */
export function equipAndDisplace(s: Sentinel, item: Item, rules: EquipRules = {}): { hero: Sentinel; displaced: Item[] } {
  if (item.keepsake) return { hero: s, displaced: [] }
  const now = heroDps(s)
  let best: { slot: HeroSlot; dps: number } | null = null
  for (const slot of slotsFor(s, item, rules)) {
    const after = withItem(s, slot, item)
    if (!keepsJob(s, after)) continue
    const dps = heroDps(after)
    if (dps > now && (!best || dps > best.dps)) best = { slot, dps }
  }
  return best ? wear(s, best.slot, item) : { hero: s, displaced: [] }
}

/** The stat a hero's damage reads, by what it holds — where the modelled player puts a bump. */
const MAIN_STAT: Record<HeroStyle, BumpStat> = { swing: 'str', shoot: 'dex', cast: 'int' }
const mainStat = (s: Sentinel): BumpStat => MAIN_STAT[heroStyle(s) ?? 'swing']

/**
 * Every way a hero can settle its owed milestone (SK1): each skill on its
 * offer (with each held skill as the one it replaces, when full), and each
 * stat bump when one is on the table. Exactly the choices the store accepts.
 */
function milestoneMoves(s: Sentinel, pool: readonly string[], seed: number): Sentinel[] {
  const out: Sentinel[] = []
  const offer = skillOffer(s, pool, seed)
  for (const k of offer) {
    if (slotsFull(s)) for (const d of s.skills ?? []) {
      const t = takeSkill(s, k.id, pool, seed, d)
      if (t) out.push(t)
    }
    else {
      const t = takeSkill(s, k.id, pool, seed)
      if (t) out.push(t)
    }
  }
  for (const st of BUMP_STATS) {
    const t = takeBump(s, st, pool, seed)
    if (t) out.push(t)
  }
  return out
}

/**
 * The coin-flipper (SK1): at every milestone it owes, a random skill from the
 * offer while it has a free slot; once full, half the time a random swap and
 * half the time the bump on its class's main stat. Every gate reads this — it
 * prices the skill LEVEL, not a player's read of it. `seed` is the run seed
 * the offers are hashed from (`run/skills.skillOffer`), `rng` the model's.
 */
export function randomSkills(s: Sentinel, rng: RNG, pool: readonly string[], seed: number): Sentinel {
  let out = s
  for (let guard = 0; guard < 3 && pendingMilestone(out); guard++) {
    const offer = skillOffer(out, pool, seed)
    let next: Sentinel | null = null
    if (offer.length && (!slotsFull(out) || rng.chance(0.5))) {
      next = takeSkill(out, rng.pick(offer).id, pool, seed, slotsFull(out) ? rng.pick(out.skills!) : null)
    }
    out = next ?? takeBump(out, mainStat(out), pool, seed) ?? out
  }
  return out
}

/**
 * The "known answer" (SK1): whichever move raises `heroDps` most — the
 * spreadsheet player. `heroDps` reads damage × rate × crit only, so it is
 * blind to holds, auras, burns and executes; the gap between this and the
 * coin-flipper is how solved the skill layer is.
 */
export function bestSkills(s: Sentinel, pool: readonly string[], seed: number): Sentinel {
  let out = s
  for (let guard = 0; guard < 3 && pendingMilestone(out); guard++) {
    const moves = milestoneMoves(out, pool, seed)
    if (!moves.length) break
    out = moves.reduce((a, b) => (heroDps(b) > heroDps(a) ? b : a))
  }
  return out
}

/**
 * Milestones with some picks pinned: `force['10:rogue']` names the skill a
 * hero with the hooded look (a bow or a dagger in hand, `gear.lookOf`) takes
 * at level 10 when its offer holds it (else the coin flip). The
 * oracle in `meta-sweep.ts phase3b` pins each point in turn.
 */
export function forcedSkills(s: Sentinel, force: Record<string, string>, rng: RNG, pool: readonly string[], seed: number): Sentinel {
  let out = s
  for (let guard = 0; guard < 3; guard++) {
    const m = pendingMilestone(out)
    if (!m) break
    const pinned = force[`${m.level}:${lookOf(out)}`]
    const offer = skillOffer(out, pool, seed)
    if (pinned && offer.some((k) => k.id === pinned)) {
      out = takeSkill(out, pinned, pool, seed, slotsFull(out) ? rng.pick(out.skills!) : null) ?? out
      continue
    }
    out = randomSkills(out, rng, pool, seed)
    break
  }
  return out
}

/** Re-exported for the benches that grade a skill's mods directly. */
export { skillModsOf }

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
