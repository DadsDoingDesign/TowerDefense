/**
 * Between-wave run snapshot (C3).
 *
 * A run is 10–25 minutes and, before this existed, lived only in memory: a tab
 * close, a refresh, or a mobile OS evicting a backgrounded tab destroyed it AND
 * paid zero Watch Marks, because marks are only granted inside `finishBattle`.
 * On a phone, backgrounding is routine — that turned an ordinary interruption
 * into a loss worse than dying.
 *
 * What is and isn't captured:
 *
 * - The run state is plain JSON (roster, inventory, gold, map, threat, seed…),
 *   so it round-trips exactly.
 * - The live `GameEngine` is NOT serialized. A snapshot taken mid-battle records
 *   the state the wave STARTED from and resumes at that node's setup phase. That
 *   is the honest behaviour: half a fought wave is not a save point, and quietly
 *   restoring one would either gift or steal progress.
 * - `lastResult` IS captured, and it is what tells a resume which side of the
 *   wave the snapshot was taken on. Without it a post-battle payload (node
 *   already cleared, threat/gold already advanced, reward pending) came back as
 *   a PRE-battle setup screen, so the cleared wave could be fought a second time
 *   and every grant applied twice (C-1).
 * - A `ShrineOffer` carries an `apply` closure, so only its id is stored; it is
 *   rehydrated through `shrineById` so a resumed run faces the same shrine and
 *   cannot re-roll it.
 * - The loot and map RNG stream positions ride along, so a resumed run CONTINUES
 *   its seeded streams instead of re-dealing from the top (WS1 determinism).
 * - The entity-id counter rides along too: it is a process-global that resets on
 *   reload, and without it a freshly generated item could collide with the id of
 *   a restored one.
 */
import { isSkillId, STARTER_SKILLS } from '../game/data/skills'
import { ALL_ITEM_KINDS, BASIC_ITEM_KINDS, DAILY_ITEM_POOL, isItemKind, itemPoolFor } from '../game/data/itemKinds'
import { gripOf, type HeroStyle } from '../game/data/items'
import { MAX_SKILLS, migrateGrowth, SKILL_MILESTONES } from '../game/run/skills'
import { clampStep, DAILY_SKILL_POOL } from '../game/run/watch'
import { MYTHIC_EDGE } from '../game/data/items'
import { LEGACY_RELIC_IDS } from '../game/data/relics'
import { settleOffHands } from '../game/run/inventory'
import { equipRules } from '../game/run/relics'
import { allMutations } from '../game/data/mutations'
import { ENEMY_TYPES } from '../game/data/enemies'
import { fieldFor, FIRST_MAP, fieldIdOf, legacyPostTile, mapById, orientationOf, type FieldOrientation } from '../game/data/maps'
import { fineFromCoarse, parseTileId, terrainRuleById } from '../game/data/terrain'
import type { NameCounters } from '../game/data/sentinels'
import { shrineById, type ShrineOffer } from '../game/data/shrines'
import type { BattleResult } from '../game/engine/engine'
import type { MapNode, RunMap } from '../game/data/runmap'
import type { RewardCard } from '../game/data/rewards'
import type {
  Archetype,
  EffectMods,
  GameMap,
  Enchantment,
  Item,
  ItemRarity,
  ItemSlot,
  Mutation,
  Placement,
  Sentinel,
  Tactics,
  TerrainRuleId,
  WaveDef,
} from '../game/types'
import type { RunFeats } from '../game/run/settle'
import { migrateChallenge, type RunChallenge } from './daily'
import { arr, bool, num, readJson, removeRaw, str, writeJson } from './storage'

export const RUN_SNAPSHOT_KEY = 'fieldwatch-run'

/**
 * A stored difficulty step, coerced onto the ladder (F8). A save written before
 * SK1 calls it `runBanner` — its Vow tier IS its difficulty step now.
 *
 * `Math.max(0, num(...))` was once the whole of it, with no ceiling, so a
 * payload saying 99 resumed as 99 and indexed past the end of the rung table.
 * One source of truth for the ceiling, shared with `difficultyRules`. Whether
 * the save has REACHED the step is a different question, asked where the answer
 * is known — see `resumeRun` in the game store.
 */
const stepOf = (o: Record<string, unknown>): number => clampStep(num(o.runDifficulty ?? o.runBanner, 0))

/**
 * Snapshot schema version (M11). Bump on any shape change and extend `migrate`;
 * every numeric field is defensively defaulted on the way in so a save written
 * by an older build can never inject `undefined` into arithmetic.
 */
export const RUN_SNAPSHOT_VERSION = 14

type GameMode = 'campaign' | 'endless'
type Screen = 'hub' | 'heroPick' | 'map' | 'crossroads' | 'battle' | 'endless'
type RunPhase = 'active' | 'won' | 'lost'
type EventKind = 'merchant' | 'shrine' | 'recruit' | 'campfire'
type EndlessRoom = 'merchant' | 'forge' | 'shrine' | 'recruit'

/**
 * The mid-map fork, as stored (v4).
 *
 * `mutations` is why the version moved. The fork's mutation offer is rolled
 * once, from the seeded run stream, when the fork fires — so it HAS to ride
 * along, or a resumed run would deal itself a different three (and the whole
 * point of rolling before the decision would be undone by a reload). A v1–v3
 * payload has no offer, which is exactly right for the build that wrote it: it
 * rolled at tap time, so there was never an offer outstanding to preserve. Such
 * a payload restores with an empty offer and keeps its recruits; a fork with
 * nothing left in either branch is dropped by `coherent()` rather than parked
 * on as a screen with no offer on it.
 */
interface CrossroadsSnap {
  recruits: Sentinel[]
  mutations: Mutation[]
  mutationHeroId: string | null
  revealed?: { heroName: string; mutation: Mutation }
}

const SCREENS: readonly Screen[] = ['hub', 'heroPick', 'map', 'crossroads', 'battle', 'endless']
const MODES: readonly GameMode[] = ['campaign', 'endless']
const PHASES: readonly RunPhase[] = ['active', 'won', 'lost']
const EVENT_KINDS: readonly EventKind[] = ['merchant', 'shrine', 'recruit', 'campfire']
const ORIENTATIONS: readonly FieldOrientation[] = ['landscape', 'portrait']

interface MerchantStock {
  items: { item: Item; price: number }[]
  recruit: { sentinel: Sentinel; price: number } | null
  /** v7: the Gate repair on the counter (null once bought). */
  repair?: { hp: number; price: number } | null
  /** v7: rerolls taken at this stall. */
  rerolls?: number
}

/** The persisted form. Everything here is plain JSON, by construction. */
export interface RunSnapshot {
  v: number
  savedAt: number

  mode: GameMode
  runSeed: number
  screen: Screen
  runPhase: RunPhase

  runMap: RunMap
  currentNodeId: string
  clearedNodeIds: string[]
  reachableNodeIds: string[]
  event: { kind: EventKind; nodeId: string } | null

  battleMapId: string
  /**
   * v9: which twin of `battleMapId` the current battle is fought on (Portrait
   * battlefields). `battleMapId` stays the seeded field's id; this is the
   * per-battle orientation chosen when its node was entered.
   */
  fieldOrientation: FieldOrientation
  /**
   * v10: the map challenge the current battle's field carries (G1-2), or null
   * for plain ground. `battleMapId` stays the seeded field's id.
   */
  terrainRule: TerrainRuleId | null
  /**
   * Q1: the seed the current battle's danger ground and seeded obstacles were
   * laid from (`data/hazards.ts`), or null for a field without them. Optional
   * on purpose — no version step: a save written before Q1 has none and
   * resumes onto exactly the ground it was fought on.
   */
  hazardSeed?: number | null
  roster: Sentinel[]
  /** v10: keyed by deployment TILE id (`c{col}r{row}`); ≤ v9 by circle id `s0`…`s5`. */
  placements: Placement
  gold: number
  baseHp: number
  maxBaseHp: number
  enemyHpMult: number
  threat: number
  /**
   * The difficulty step this run is played at (v13; `runBanner` v3–v12, the
   * Vow tier, which IS the step now). It has to survive a reload: the step's
   * starting Threat and extra elites are baked into the run, and the payout
   * multiplier is read off it when the run settles.
   */
  runDifficulty: number
  /**
   * SK1 (v13): the skill ids this run deals from. A v12 payload has none and
   * resumes on the starters (a Daily on its fixed pool) — the cards it could
   * have dealt are not knowable from the save.
   */
  skillPool: string[]
  /**
   * The classless rework (v14): the item kinds this run deals from. A v13
   * payload has none and resumes dealing EVERY kind — the run it was played
   * as — and a Daily on its fixed pool.
   */
  itemPool: string[]
  /** Daily Watch / custom seed (v6). A v1–v5 payload is a standard run. */
  challenge: RunChallenge
  /**
   * LS3: the run is the player's first, and staged. Optional on purpose — no
   * version step: a save written before staging existed has none and resumes
   * unstaged, which is what a returning player should get.
   */
  firstRun?: boolean
  inventory: Item[]
  runKills: number
  marksEarned: number

  activeNodeId: string | null
  currentWave: WaveDef | null
  tactics: Tactics
  /**
   * The result of the wave at `activeNodeId`, or null if it has not been fought
   * to a finish. This is the whole difference between "resume at setup, the wave
   * is still yours to fight" and "resume on the summary, the wave is already
   * paid for" — see the header note (C-1).
   */
  lastResult: BattleResult | null
  /** Loot dropped by that wave, for the summary the resume lands on. */
  lastLoot: Item[]

  merchant: MerchantStock | null
  /** Shrines carry a closure; only the id survives JSON. */
  shrineOfferId: string | null
  recruitOptions: Sentinel[]
  reward: RewardCard[] | null
  runMods: EffectMods[]
  /** v7: relics held, by id. An id this build does not know grants nothing. */
  relics: string[]
  /** v7: what the run has done that a feat may ask about. */
  feats: RunFeats
  /**
   * Set by a LOAD, never by `captureRun` (so never stored): the off-hand items
   * this load moved to the pack because the off hand no longer takes them
   * (round 3, Q5 — `inventory.settleOffHands`). `resumeRun` says so, once.
   */
  gearReturned?: { hero: string; item: string }[]
  crossroads: CrossroadsSnap | null
  forkDone: boolean

  dust: number
  lives: number
  wins: number
  round: number
  endlessRecruitCost: number
  endlessRoom: EndlessRoom | null

  /**
   * Stream positions, so the resumed run continues rather than re-deals.
   * `null` means "not recorded" — re-seed from the run seed instead of trusting
   * a 0, which is a legitimate stream position and would silently rewind loot.
   */
  rngLoot: number | null
  rngMap: number | null
  /**
   * Rarity-pity dry counter at save time (M9): unforced item rolls since the
   * last epic-or-better drop.
   *
   * It sits with the stream positions because it is read WITH `rngLoot` — the
   * next drop is a function of both, and restoring the stream while resetting
   * the counter resumes into a sequence the interrupted run would never have
   * dealt (measured: 8 of the next 29 drops change). Unlike a stream position it
   * defaults to a plain 0 rather than null: a payload written before this
   * existed had no pity accruing, so "absent" and "no drought yet" are the same
   * fact, and 0 is the honest reading of both.
   */
  lootPity: number
  /** Process-global entity-id counter at save time. */
  idCounter: number
  /**
   * The hero-name counter at save time. Another process-global that resets
   * on reload: without it a Sentinel recruited after a resume re-uses a name
   * already on the roster (m-4). (Per class before v14; summed on the way in.)
   */
  nameCounters: NameCounters
}

/**
 * The shape `captureRun` reads. `GameState` satisfies it structurally, which
 * keeps this module free of any runtime import from the store (no cycle).
 */
export interface RunStateSource {
  mode: GameMode
  runSeed: number
  screen: Screen
  runPhase: RunPhase
  runMap: RunMap
  currentNodeId: string
  clearedNodeIds: string[]
  reachableNodeIds: string[]
  event: { kind: EventKind; nodeId: string } | null
  battleMap: GameMap
  roster: Sentinel[]
  placements: Placement
  gold: number
  baseHp: number
  maxBaseHp: number
  enemyHpMult: number
  threat: number
  runDifficulty: number
  skillPool: string[]
  itemPool: string[]
  challenge: RunChallenge
  /** LS3 — optional so a source that predates staging still satisfies it. */
  firstRun?: boolean
  inventory: Item[]
  runKills: number
  marksEarned: number
  activeNodeId: string | null
  currentWave: WaveDef | null
  tactics: Tactics
  lastResult: BattleResult | null
  lastLoot: Item[]
  merchant: MerchantStock | null
  shrineOffer: ShrineOffer | null
  recruitOptions: Sentinel[]
  reward: RewardCard[] | null
  runMods: EffectMods[]
  relics: string[]
  feats: RunFeats
  crossroads: CrossroadsSnap | null
  forkDone: boolean
  dust: number
  lives: number
  wins: number
  round: number
  endlessRecruitCost: number
  endlessRoom: EndlessRoom | null
}

/** RNG stream positions, supplied by the store (it owns the stream objects). */
export interface StreamPositions {
  rngLoot: number
  rngMap: number
  /** Rarity-pity dry counter — restored in lockstep with `rngLoot` (M9). */
  lootPity: number
  idCounter: number
  nameCounters: NameCounters
}

export function captureRun(s: RunStateSource, streams: StreamPositions): RunSnapshot {
  return {
    v: RUN_SNAPSHOT_VERSION,
    savedAt: Date.now(),
    mode: s.mode,
    runSeed: s.runSeed,
    screen: s.screen,
    runPhase: s.runPhase,
    runMap: s.runMap,
    currentNodeId: s.currentNodeId,
    clearedNodeIds: s.clearedNodeIds,
    reachableNodeIds: s.reachableNodeIds,
    event: s.event,
    battleMapId: s.battleMap ? fieldIdOf(s.battleMap) : FIRST_MAP.id,
    fieldOrientation: s.battleMap ? orientationOf(s.battleMap) : 'landscape',
    terrainRule: s.battleMap?.terrainRule ?? null,
    hazardSeed: s.battleMap?.hazardSeed ?? null,
    roster: s.roster,
    placements: s.placements,
    gold: s.gold,
    baseHp: s.baseHp,
    maxBaseHp: s.maxBaseHp,
    enemyHpMult: s.enemyHpMult,
    threat: s.threat,
    runDifficulty: s.runDifficulty,
    skillPool: s.skillPool,
    itemPool: s.itemPool,
    challenge: s.challenge,
    firstRun: s.firstRun === true,
    inventory: s.inventory,
    runKills: s.runKills,
    marksEarned: s.marksEarned,
    activeNodeId: s.activeNodeId,
    currentWave: s.currentWave,
    tactics: s.tactics,
    lastResult: s.lastResult,
    lastLoot: s.lastLoot,
    merchant: s.merchant,
    shrineOfferId: s.shrineOffer?.id ?? null,
    recruitOptions: s.recruitOptions,
    reward: s.reward,
    runMods: s.runMods,
    relics: s.relics,
    feats: s.feats,
    crossroads: s.crossroads,
    forkDone: s.forkDone,
    dust: s.dust,
    lives: s.lives,
    wins: s.wins,
    round: s.round,
    endlessRecruitCost: s.endlessRecruitCost,
    endlessRoom: s.endlessRoom,
    rngLoot: streams.rngLoot,
    rngMap: streams.rngMap,
    lootPity: streams.lootPity,
    idCounter: streams.idCounter,
    nameCounters: streams.nameCounters,
  }
}

/** Rehydrate the shrine closure a snapshot could only store by id. */
export const snapshotShrine = (snap: RunSnapshot): ShrineOffer | null =>
  snap.shrineOfferId ? shrineById(snap.shrineOfferId) : null

/**
 * The battle map a snapshot names — a real lookup in the map registry (m-5).
 *
 * This used to be `id === FIRST_MAP.id ? FIRST_MAP : FIRST_MAP`, which would
 * have silently resumed onto the wrong field the moment a second map landed.
 * An unknown id is now a hard error rather than a quiet substitution; it is
 * unreachable in practice because `migrateSnapshot` rejects any payload naming
 * a map this build does not have, so a bad save is dropped at load time instead
 * of exploding on the resume tap.
 */
export function snapshotBattleMap(snap: RunSnapshot): GameMap {
  // The battle comes back on the twin it was saved on, whatever the viewport
  // is now: orientation is fixed for the duration of a battle — and so is its
  // map challenge (G1-2).
  const map = fieldFor(snap.battleMapId, snap.terrainRule ?? null, snap.fieldOrientation, snap.hazardSeed ?? null)
  if (!map) throw new Error(`run snapshot names an unknown battle map: ${snap.battleMapId}`)
  return map
}

// ------------------------------------------------------------------ migrate

const ARCHETYPES: readonly Archetype[] = ['fighter', 'rogue', 'mystic']
const STYLES: readonly HeroStyle[] = ['swing', 'shoot', 'cast']
/** What each old class fought with — a v13 feats ledger's starter becomes this. */
const CLASS_STYLE: Readonly<Record<Archetype, HeroStyle>> = { fighter: 'swing', rogue: 'shoot', mystic: 'cast' }

/*
 * ---- the vocabulary a stored payload is allowed to name (F2/F3) -----------
 *
 * `battleMapId` has always been checked against the map registry, and the
 * comment on `snapshotBattleMap` explains why: "a map this build does not have
 * is not something to silently substitute". Every OTHER structured field was a
 * bare cast — `currentWave`, `reward`, `merchant`, `recruitOptions`, `roster`,
 * `inventory` — so a payload could name anything at all and the crash landed
 * wherever the value was first dereferenced, several screens later.
 *
 * That stopped being theoretical in Phase 3. Enemy modifiers quadrupled the
 * keyspace a stored wave can name (15 base types → 60 with `_plated`/`_warded`/
 * `_swift`), so a save written by any build whose modifier list differs from
 * this one names spawns `ENEMY_TYPES` has no entry for. `engine.spawnDue` reads
 * `ENEMY_TYPES[s.typeId].baseHp` unguarded, and the resulting throw lands
 * INSIDE the battle loop, where the error boundary's primary button — "Return
 * to last checkpoint" — resumes the very same payload. A loop, not an error.
 *
 * Two rules, and the split is not arbitrary:
 *
 *  - **`currentWave` RESOLVES.** It is the one field on this list the game can
 *    rebuild on demand: the wave at a node is a pure function of the run seed,
 *    the depth and the kind, and `startWave` deals it fresh. So an unreadable
 *    wave is dropped and the run lands back at the map with the node still
 *    un-cleared — `coherent()`'s own "resolve it into the coherent state it was
 *    one step away from" — and the player fights that node for the first time,
 *    losing nothing.
 *
 *  - **Everything else REFUSES**, exactly as an unknown map does. A roster, an
 *    inventory, a pending reward, a merchant's shelf and a recruit offer are
 *    *earned contents*: none of them is re-derivable, and quietly dropping a
 *    malformed one would hand back a run with a hero, an item or an offer
 *    missing — a silent theft dressed as a recovery. A refused payload is not a
 *    destroyed one: `payoutFromRaw` still reads its settle facts and it is still
 *    paid its marks.
 *
 * These are PREDICATES, never rewriters. A healthy payload passes through by
 * reference with no field added, dropped or reordered, so it still round-trips
 * byte-identically.
 */

const isObj = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x)
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
/**
 * A number the combat layer can multiply without overflowing.
 *
 * `isNum` alone let `rateMult: 1e308` through, and the profile's product came
 * out `Infinity` — not NaN, but just as broken, and one `Infinity * 0` from a
 * NaN. No build has ever rolled a stat, affix or base value anywhere near a
 * million, so the bound is corruption detection, not balance: it leaves the
 * "shape, not range" rule below intact for every value a real save can hold.
 */
const MAX_MAGNITUDE = 1e6
const isStat = (x: unknown): x is number => isNum(x) && Math.abs(x) <= MAX_MAGNITUDE
const isStr = (x: unknown): x is string => typeof x === 'string'

const ITEM_SLOTS: readonly ItemSlot[] = ['oneHand', 'twoHand', 'offHand', 'body']
const RARITIES: readonly ItemRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic']

/**
 * Every `EffectMods` key, as a value, split by shape.
 *
 * Kept as exhaustive `Record<keyof EffectMods, …>` literals on purpose: the day
 * someone adds a mod to `types.ts` and forgets this file, the compiler fails
 * *here* rather than the validator silently waving the new field through.
 */
const MOD_STRUCT_FIELDS = {
  burn: ['dps', 'dur'],
  chill: ['slow', 'dur'],
  shock: ['chains', 'dmgFrac'],
  block: ['count', 'radius'],
  buffAura: ['damageMult', 'radius'],
  trap: ['dps', 'slow'],
  // Phase 3b rule capabilities: a cadence and two timed rushes, every field
  // of which reaches the engine's arithmetic.
  volley: ['every', 'pierce'],
  killRush: ['rate', 'dur'],
  openingRush: ['rate', 'dur'],
  // The classless rework's thorn burn and Gate mend.
  thornsBurn: ['dps', 'dur'],
  killMend: ['every', 'hp'],
} as const satisfies Partial<Record<keyof EffectMods, readonly string[]>>
/**
 * Mods that are a **capability** rather than a magnitude — booleans.
 *
 * Split out for the same reason the structured mods are: `validMods` checks the
 * shape a key is *declared* to have, and demanding `isNum` of a flag would
 * refuse every healthy payload that carries one.
 */
const MOD_BOOL_FIELDS = {
  thornsIgnite: true,
  burnSpreadOnDeath: true,
  // Weapon clearance: the hook a skill sets to make its hero swing.
  grantsMelee: true,
} as const satisfies Partial<Record<keyof EffectMods, true>>
const MOD_KEYS: Record<keyof EffectMods, true> = {
  damageMult: true, rateMult: true, rangeMult: true, projSpeedMult: true,
  splashAdd: true, critChanceAdd: true, critMultAdd: true, pierce: true,
  burn: true, chill: true, shock: true, stunChance: true, stunDur: true, execute: true,
  block: true, thornsMult: true, thornsIgnite: true, buffAura: true,
  lifedrain: true, trap: true,
  volley: true, critEvery: true, killRush: true, openingRush: true, leakWard: true,
  burnSpreadOnDeath: true, grantsMelee: true,
  holdAdd: true, holdRadius: true, goldPerKill: true, vsHeld: true, vsSlowed: true,
  thornsBurn: true, rushPerHeld: true, killMend: true,
}

/**
 * v10 → v11: heroes have no HP. The mods that only ever meant something to a
 * hero's HP are retired, and an older save's gear, mutations and run mods have
 * them dropped on the way in (`stripRetiredMods`). The engine would ignore
 * them anyway (`mergeMods` reads only keys it knows); dropping them keeps a
 * resumed run's tooltips from describing a rule that no longer exists.
 */
const RETIRED_MOD_KEYS = ['hpMult', 'physDefAdd', 'healAura', 'dmgReductionAura', 'selfSacrifice', 'blockRegen', 'lastStand'] as const
/**
 * Mutations cut with hero HP. `cornered` sold a below-half-HP damage spike and
 * nothing else, so a saved one is dropped rather than left as a bare −25%
 * attack speed. (`overcharge`, Stormcharged, was cut from the pool for a
 * different reason — it cost more than it gave — and still works as saved.)
 */
const RETIRED_MUTATIONS = new Set(['cornered'])
function stripMods(m: EffectMods | undefined): void {
  if (!m) return
  for (const k of RETIRED_MOD_KEYS) delete (m as Record<string, unknown>)[k]
}

/**
 * An `EffectMods` whose numbers are actually numbers (F1-B).
 *
 * `runMods` was checked with `isObj` alone, and the note beside its call site
 * said so honestly: *"this does not vouch for the numbers inside"*. That is a
 * real hole, because run mods are not decorative — `computeCombat` multiplies
 * `damageMult`, `rateMult` and `rangeMult` straight into every profile on the
 * field. A hand-edited `{"damageMult":"x"}` passes the object check, and
 * `damage * "x"` is **NaN**: NaN damage never kills anything, NaN range fails
 * every `<=` in the targeting loop so nothing is ever in range, and the run
 * resumes into a battle that cannot be won with nothing on screen to explain
 * why. Nothing throws — the failure is silent, which is the one kind this
 * module exists to convert into a refusal.
 *
 * Deliberately *shape-checked rather than range-checked*: a key this build
 * knows must hold a finite number, or — for the eight structured effects — an
 * object whose own fields are finite numbers. A key it does not know is allowed
 * through, because a payload written by a newer build may carry a mod this one
 * has never heard of, and refusing a whole earned run over a field nothing here
 * reads would be the silent-theft failure the header above warns about. What
 * this guarantees is the one thing the combat layer needs: nothing that reaches
 * arithmetic is a string, a null, an array or a NaN.
 *
 * Like every predicate here it never rewrites — a healthy payload passes through
 * by reference and still round-trips byte-identically.
 */
function validMods(raw: unknown): raw is EffectMods {
  if (!isObj(raw)) return false
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined) continue
    const struct = (MOD_STRUCT_FIELDS as Record<string, readonly string[] | undefined>)[k]
    if (struct) {
      if (!isObj(v) || !struct.every((f) => isStat(v[f]))) return false
    } else if (k in MOD_BOOL_FIELDS) {
      if (typeof v !== 'boolean') return false
    } else if (k in MOD_KEYS && !isStat(v)) {
      return false
    }
  }
  return true
}

/**
 * A wave this build can actually fight (F2).
 *
 * `spawns` must be non-empty — a wave of nothing clears the instant it starts
 * and pays a node out for free — and every `typeId` must be a key the enemy
 * registry HAS, which is the whole point: the modifier keyspace is the part
 * that moves between builds.
 */
function validWave(raw: unknown): raw is WaveDef {
  if (!isObj(raw)) return false
  if (!isNum(raw.index) || !isStr(raw.label) || typeof raw.isBoss !== 'boolean') return false
  if (!Array.isArray(raw.spawns) || raw.spawns.length === 0) return false
  return raw.spawns.every(
    (s) =>
      isObj(s) &&
      isStr(s.typeId) &&
      !!ENEMY_TYPES[s.typeId] &&
      isNum(s.at) &&
      isNum(s.hpMult) &&
      // v7: the sub-wave a spawn belongs to. Absent is group 0 (a v1–v6 wave
      // is one sub-wave, exactly as it was fought); present must be a small
      // non-negative integer — the engine sorts and indexes by it.
      (s.group === undefined || (Number.isInteger(s.group) && (s.group as number) >= 0 && (s.group as number) < 16)),
  )
}

/** Absent, or a finite number. JSON drops `undefined`, so `null` counts as absent. */
const optNum = (x: unknown): boolean => x === undefined || x === null || isStat(x)

/**
 * Every key of `Item['base']`. Exhaustive for the same reason `MOD_KEYS` is: a
 * new base stat that this file forgets fails the compile here.
 */
const ITEM_BASE_KEYS: Record<keyof Item['base'], true> = {
  physDamage: true, magDamage: true, attackSpeed: true, critChance: true, rangeMult: true, splashAdd: true,
}

/**
 * An item's flat base block whose numbers are numbers.
 *
 * `validItem` used to check only that `base` was an object. `gearOf` adds
 * `physDamage`, `attackSpeed`, `rangeMult` straight into the combat profile, so
 * `{"physDamage":"lots"}` loaded cleanly and resumed a hero whose damage was
 * the string concatenation `"0lots"` times a number — NaN — the silent failure
 * `validMods` exists to refuse. Unknown keys pass, as they do for mods.
 */
function validBase(raw: unknown): boolean {
  if (!isObj(raw)) return false
  for (const [k, v] of Object.entries(raw)) if (k in ITEM_BASE_KEYS && !optNum(v)) return false
  return true
}

/** Optional partial core stats: each present stat a finite number. */
const validPartialStats = (raw: unknown): boolean =>
  raw === undefined || raw === null || (isObj(raw) && optNum(raw.str) && optNum(raw.dex) && optNum(raw.int))

/**
 * The stat-granting shape an enchantment and a reward card's grant share:
 * optional stats, thorns, patience and mods, every number a number.
 */
const validGrantBlock = (raw: Record<string, unknown>): boolean =>
  validPartialStats(raw.stats) &&
  optNum(raw.thorns) &&
  optNum(raw.patience) &&
  (raw.mods === undefined || raw.mods === null || validMods(raw.mods))

function validEnchantment(raw: unknown): raw is Enchantment {
  return isObj(raw) && isStr(raw.id) && isStr(raw.label) && validGrantBlock(raw)
}

/** A free upgrade-path grant: absent, or a path id and a finite level count. */
const validUpgradeGrant = (raw: unknown): boolean =>
  raw === undefined || raw === null || (isObj(raw) && isStr(raw.path) && isStat(raw.levels))

/** An item the gear screens can render AND the combat layer can add up. */
function validItem(raw: unknown): raw is Item {
  if (!isObj(raw)) return false
  if (!isStr(raw.id) || !isStr(raw.name)) return false
  if (!ITEM_SLOTS.includes(raw.slot as ItemSlot)) return false
  if (!RARITIES.includes(raw.rarity as ItemRarity)) return false
  if (!validBase(raw.base)) return false
  if (raw.keepsake !== undefined && typeof raw.keepsake !== 'boolean') return false
  if (!validUpgradeGrant(raw.grantUpgrade)) return false
  if (!Array.isArray(raw.enchantments)) return false
  return raw.enchantments.every(validEnchantment)
}

/** A fork mutation: its mods are merged into combat, so they are held to `validMods`. */
function validMutation(raw: unknown): raw is Mutation {
  return isObj(raw) && isStr(raw.id) && validMods(raw.mods) && validUpgradeGrant(raw.grantUpgrade)
}

const validStats = (raw: unknown): boolean =>
  isObj(raw) && isStat(raw.str) && isStat(raw.dex) && isStat(raw.int)

const validEquipSlot = (raw: unknown): boolean => raw === null || raw === undefined || validItem(raw)

/** A Sentinel `combat.ts` can build a profile from without hitting `undefined`. */
function validSentinel(raw: unknown): raw is Sentinel {
  if (!isObj(raw)) return false
  if (!isStr(raw.id) || !isStr(raw.name)) return false
  // The classless rework (v14): a hero has no class. `computeCombat` reads
  // the attack off the weapon in hand, so nothing here needs a class, a tree
  // path or a hue; an older save's `archetype` / `branchPath` / `color` /
  // `accent` are read once by the v14 migration and dropped.
  if (raw.archetype !== undefined && !ARCHETYPES.includes(raw.archetype as Archetype)) return false
  if (!validStats(raw.stats)) return false
  if (!isStat(raw.thorns) || !isStat(raw.patience) || !isNum(raw.level) || !isNum(raw.xp)) return false
  if (raw.mutations !== undefined && !(Array.isArray(raw.mutations) && raw.mutations.every(validMutation))) return false
  if (raw.upgrades !== undefined && !(isObj(raw.upgrades) && Object.values(raw.upgrades).every(isStat))) return false
  // v7–v12: spec perks are ids — only the shape is checked; the v13 migration
  // maps them to skills and drops the field.
  if (raw.perks !== undefined && !(Array.isArray(raw.perks) && raw.perks.every(isStr))) return false
  // SK1: skills are ids, and the milestone count is arithmetic (it decides the
  // tier an offer deals). The shape is refused here; the values are normalised
  // by `normaliseSkills` (unknown ids, duplicates, off-class, over three).
  if (raw.skills !== undefined && !(Array.isArray(raw.skills) && raw.skills.every(isStr))) return false
  if (raw.skillPicks !== undefined && !isStat(raw.skillPicks)) return false
  const eq = raw.equipment
  if (!isObj(eq)) return false
  return validEquipSlot(eq.mainHand) && validEquipSlot(eq.offHand) && validEquipSlot(eq.body)
}

/**
 * A reward card the offer band can print.
 *
 * `rarity` is the field that proved it: the shell reads `RARITY[c.rarity].label`
 * with no guard, so a card missing it resumed cleanly and then took the map
 * screen down the moment the offer rendered. An item card must carry its item,
 * because taking it puts that item in the inventory.
 */
function validRewardCard(raw: unknown): raw is RewardCard {
  if (!isObj(raw)) return false
  if (!isStr(raw.id) || !isStr(raw.title) || !isStr(raw.desc)) return false
  if (!RARITIES.includes(raw.rarity as ItemRarity)) return false
  if (raw.kind === 'item') return validItem(raw.item)
  if (raw.kind === 'stat') return isObj(raw.grant) && validGrantBlock(raw.grant)
  // v7: a relic card names its relic; taking it adds that id to `relics`.
  if (raw.kind === 'relic') return isStr(raw.relic)
  return false
}

/** A merchant shelf: priced items, and either no recruit or a real one. */
function validMerchant(raw: unknown): raw is MerchantStock {
  if (!isObj(raw)) return false
  if (!Array.isArray(raw.items)) return false
  if (!raw.items.every((e) => isObj(e) && validItem(e.item) && isNum(e.price))) return false
  // v7: the repair heals the Gate and the reroll count prices the next reroll,
  // so both reach arithmetic and both are held to finite numbers.
  const rep = raw.repair
  if (rep !== undefined && rep !== null && !(isObj(rep) && isStat(rep.hp) && isStat(rep.price))) return false
  if (raw.rerolls !== undefined && !isStat(raw.rerolls)) return false
  const r = raw.recruit
  if (r === null || r === undefined) return true
  return isObj(r) && validSentinel(r.sentinel) && isNum(r.price)
}

/** The run's feats ledger (v7), every counter a non-negative finite number. */
function migrateFeats(raw: unknown): RunFeats {
  const o = (isObj(raw) ? raw : {}) as Record<string, unknown>
  const count = (x: unknown) => Math.max(0, Math.floor(num(x, 0)))
  return {
    // v14: the leader's STYLE (what it held), not a class. A v7–v13 class
    // maps to the style that class fought with.
    starter: STYLES.includes(o.starter as HeroStyle)
      ? (o.starter as HeroStyle)
      : ARCHETYPES.includes(o.starter as Archetype)
        ? CLASS_STYLE[o.starter as Archetype]
        : null,
    startSize: count(o.startSize),
    maxFielded: count(o.maxFielded),
    actBosses: count(o.actBosses),
    flawlessBosses: count(o.flawlessBosses),
    goldPeak: count(o.goldPeak),
  }
}

/**
 * The name counter, defensively defaulted — a bad one must not stall name
 * issuance. A v13 save kept one counter per class; their sum is how many
 * names it handed out.
 */
function migrateNameCounters(raw: unknown): NameCounters {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (o.heroes !== undefined) return { heroes: Math.max(0, Math.floor(num(o.heroes, 0))) }
  let n = 0
  for (const a of ARCHETYPES) n += Math.max(0, Math.floor(num(o[a], 0)))
  return { heroes: n }
}

/**
 * The stored fork (v3 → v4). Both branches are coerced to arrays and the aim is
 * coerced to a real id or null, so a v3 payload — which has neither field —
 * restores as "recruits only, nobody aimed at" instead of injecting `undefined`
 * into a `.find` on the resume tap.
 */
function migrateCrossroads(raw: unknown): CrossroadsSnap | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const revealed = o.revealed as CrossroadsSnap['revealed'] | undefined | null
  return {
    recruits: arr<Sentinel>(o.recruits),
    mutations: arr<unknown>(o.mutations).filter(validMutation),
    mutationHeroId: typeof o.mutationHeroId === 'string' ? o.mutationHeroId : null,
    ...(isObj(revealed) && isStr(revealed.heroName) && validMutation(revealed.mutation) ? { revealed } : {}),
  }
}

/**
 * A stored `BattleResult`. Every number is defaulted, because this one drives
 * both the summary the player reads and — via "was the wave resolved?" — where
 * the resume lands. A half-written result is worse than no result: it would
 * strand the run on a summary for a wave it can no longer fight.
 */
function migrateResult(raw: unknown): BattleResult | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const status = str<'cleared' | 'defeated'>(o.status, 'cleared', ['cleared', 'defeated'] as const)
  if (o.status !== 'cleared' && o.status !== 'defeated') return null
  // v4 → v5: `leakDamage` and `enemiesLeaked` (F3). `leaks` was the base-HP
  // damage all along and two Phase-2 readouts printed it as a head count, so
  // the two numbers are now separate fields with names that say which is which.
  // A v4 result has only `leaks`: it is the damage, so `leakDamage` takes it,
  // and the head count is genuinely unknown rather than zero — 0 is the honest
  // "not recorded" here, and it is only ever a line of summary copy.
  const leakDamage = Math.max(0, num(o.leakDamage, Math.max(0, num(o.leaks, 0))))
  return {
    status,
    goldEarned: Math.max(0, num(o.goldEarned, 0)),
    baseHpLeft: num(o.baseHpLeft, 0),
    leakDamage,
    leaks: leakDamage,
    enemiesLeaked: Math.max(0, num(o.enemiesLeaked, 0)),
    // v10 → v11: `downed` (and each hero's) went with hero HP; dropped here.
    enemiesKilled: Math.max(0, num(o.enemiesKilled, 0)),
    perSentinel: arr<Record<string, unknown>>(o.perSentinel)
      .filter((p) => p && typeof p.id === 'string')
      .map((p) => ({
        id: p.id as string,
        kills: Math.max(0, num(p.kills, 0)),
        damageDealt: Math.max(0, num(p.damageDealt, 0)),
        xpGained: Math.max(0, num(p.xpGained, 0)),
      })),
  }
}

// ------------------------------------------------------------------ v6 → v7
/**
 * What each level of the retired upgrade tree cost, per path, in order — kept
 * ONLY to refund a v6 save (Onslaught / Tempo / Precision all cost 40, 95, 180).
 */
const LEGACY_PATH_COSTS = [40, 95, 180] as const
/** The v6 tree's path ids, the keys `grantUpgrade` named. */
const LEGACY_PATHS: Record<string, keyof typeof MYTHIC_EDGE> = { power: 'power', tempo: 'tempo', precision: 'precision' }

/** Gold owed for every upgrade level a v6 roster bought. */
export function legacyUpgradeRefund(roster: readonly Sentinel[]): number {
  let gold = 0
  for (const s of roster) {
    for (const [path, lvl] of Object.entries(s.upgrades ?? {})) {
      if (!(path in LEGACY_PATHS)) continue
      const n = Math.max(0, Math.min(LEGACY_PATH_COSTS.length, Math.floor(num(lvl, 0))))
      for (let i = 0; i < n; i++) gold += LEGACY_PATH_COSTS[i]
    }
  }
  return gold
}

function legacyItem(item: Item): void {
  const g = item.grantUpgrade
  if (!g) return
  const edge = LEGACY_PATHS[g.path] ? MYTHIC_EDGE[LEGACY_PATHS[g.path]] : undefined
  if (edge && !item.enchantments.some((e) => e.id === edge.id)) item.enchantments.push({ ...edge })
  delete item.grantUpgrade
}

function legacyMutation(m: Mutation): void {
  if (!m.grantUpgrade) return
  const now = allMutations().find((t) => t.key === m.key)
  if (now) m.mods = now.mods
  delete m.grantUpgrade
}

function legacyStripSentinels(list: Sentinel[]): void {
  for (const s of list) {
    delete s.upgrades
    for (const slot of ['mainHand', 'offHand', 'body'] as const) if (s.equipment[slot]) legacyItem(s.equipment[slot]!)
    for (const m of s.mutations ?? []) legacyMutation(m)
  }
}
const legacyStripRoster = legacyStripSentinels

/** v10 → v11: drop the retired hero-HP mods from an item's enchantments (see {@link RETIRED_MOD_KEYS}). */
function stripItem(item: Item | null | undefined): void {
  if (item) for (const e of item.enchantments) stripMods(e.mods)
}
function stripSentinels(list: Sentinel[]): void {
  for (const s of list) {
    for (const slot of ['mainHand', 'offHand', 'body'] as const) stripItem(s.equipment[slot])
    if (s.mutations) s.mutations = s.mutations.filter((m) => !RETIRED_MUTATIONS.has(m.key))
    for (const m of s.mutations ?? []) stripMods(m.mods)
  }
}

/**
 * SK1 (v12 → v13): a hero's perks and evolutions become skills
 * (`run/skills.migrateGrowth` — the mapping is in `data/skills.ts`), and its
 * path is cut back to its class. Every version then has its skills normalised:
 * known ids only, each once, only ones its class may hold, at most three; and
 * its milestone count a whole number from 0 to 3.
 */
function migrateSkills(list: Sentinel[], version: number): void {
  for (const s of list) {
    const raw = s as LegacySentinel
    if (version < 13) {
      const archetype = ARCHETYPES.includes(raw.archetype as Archetype) ? (raw.archetype as Archetype) : 'fighter'
      const m = migrateGrowth({ archetype, level: s.level, branchPath: raw.branchPath, perks: raw.perks, skills: s.skills, skillPicks: s.skillPicks, stats: s.stats })
      s.skills = m.skills
      s.skillPicks = m.skillPicks
      s.stats = m.stats
    }
    delete raw.perks
    if (version < 14) migrateClassless(raw)
    normaliseSkills(s)
  }
}

/** A hero as an older build saved it: a class, a tree path and two hues. */
type LegacySentinel = Sentinel & { perks?: string[]; archetype?: string; branchPath?: string[]; color?: string; accent?: string }

/**
 * The classless rework (v13 → v14). A hero keeps its gear, skills, stats and
 * level; its class is dropped. Holding enemies comes from a shield in the off
 * hand now, so an old Fighter — whose hold was its class's — is handed a plain
 * common Shield IF its off hand is empty and its main hand leaves one free;
 * it holds 2, exactly as before. A Fighter whose off hand was full (or who
 * held a two-hander) keeps what it held and loses the hold. Every skill it
 * had stays: none is class-locked any more, and every old "holds N" skill is
 * now "holds that many more", so a Fighter with a Shield holds the same N.
 */
function migrateClassless(raw: LegacySentinel): void {
  if (raw.archetype === 'fighter' && isObj(raw.equipment) && !raw.equipment.offHand) {
    const main = raw.equipment.mainHand
    if (!main || (main.slot !== 'twoHand' && gripOf(main) !== 'twoHand')) {
      raw.equipment = { ...raw.equipment, offHand: legacyShield(raw.id) }
    }
  }
  delete raw.archetype
  delete raw.branchPath
  delete raw.color
  delete raw.accent
}

/** The plain Shield an old Fighter is handed (v14): a common one, the middle of the common roll. */
const legacyShield = (heroId: string): Item => ({
  id: `itm-v14-${heroId}`,
  name: 'Shield',
  slot: 'offHand',
  rarity: 'common',
  base: { attackSpeed: 0.06, critChance: 0.045 },
  enchantments: [],
})

function normaliseSkills(s: Sentinel): void {
  // Any hero may hold any skill (no classes): known ids, each once, at most three.
  const kept = [...new Set(s.skills ?? [])].filter((id) => isSkillId(id)).slice(0, MAX_SKILLS)
  if (kept.length) s.skills = kept
  else delete s.skills
  const picks = Math.max(0, Math.min(SKILL_MILESTONES.length, Math.floor(num(s.skillPicks, 0))))
  if (picks) s.skillPicks = picks
  else delete s.skillPicks
}

/**
 * The run's item pool (v14): known kinds, each once, always with the basic
 * five. A payload with none — a run saved before item unlocks — keeps dealing
 * every kind (what it was dealing), a Daily its fixed pool.
 */
function migrateItemPool(raw: unknown, challenge: RunChallenge): string[] {
  const ids = [...new Set(arr<unknown>(raw).filter(isItemKind))]
  if (ids.length) return itemPoolFor(ids.filter((k) => !BASIC_ITEM_KINDS.includes(k)))
  return [...(challenge.kind === 'daily' ? DAILY_ITEM_POOL : ALL_ITEM_KINDS)]
}

/** The run's skill pool: known ids, each once; a payload with none deals the starters. */
function migrateSkillPool(raw: unknown, challenge: RunChallenge): string[] {
  const ids = [...new Set(arr<unknown>(raw).filter(isSkillId))]
  if (ids.length) return ids
  return [...(challenge.kind === 'daily' ? DAILY_SKILL_POOL : STARTER_SKILLS)]
}

/**
 * Bring any stored payload up to the current schema, defaulting every numeric
 * field (M11). Returns null when the payload is too broken to trust — a missing
 * run is a far better outcome than a run full of NaN.
 */
export function migrateSnapshot(raw: unknown): RunSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const version = num(o.v, 0)
  if (version > RUN_SNAPSHOT_VERSION) return null // written by a newer build

  // v0 → v1: no shipped v0 exists; the coercion below IS the migration, and any
  // future step slots in here before it.
  //
  // v1 → v2: `lastResult`/`lastLoot`/`nameCounters` were added.
  //
  // v4 → v5: the stored `lastResult` gained `leakDamage` and `enemiesLeaked`
  // (F3). Handled in `migrateResult`; a v4 payload's `leaks` carries into
  // `leakDamage` unchanged, so a healthy v4 save resumes to the same run.
  //
  // The note that used to sit here claimed a v1 payload "can only be in the
  // pre-clear case", so defaulting `lastResult` to null was harmless. That was
  // simply wrong: the autosave writes on every run-field change, so a v1 save
  // could be taken at any instant — including the instant after a wave cleared,
  // which is the exact payload shape that caused C-1. Defaulting it to null
  // there produces a run whose node is already cleared but whose result is
  // gone: `startWave` refuses (the node is cleared) and the summary will not
  // render (there is no result), leaving an enabled button that does nothing
  // and no other control anywhere on the screen.
  //
  // A version tag cannot tell us what a payload means, so `coherent()` below
  // asks the payload itself instead, and every version goes through it.

  // Every node must be an object with a string id: `coherent()` maps over them
  // and a single `null` in the array used to throw out of the LOAD — which runs
  // inside every settle, so New Run crashed on every tap, forever. An edge
  // that is not a from/to pair is dropped: edges are only ever read to derive
  // reachability, and a missing one costs a route, not a run.
  const runMap = o.runMap as RunMap | undefined
  if (!isObj(runMap) || !Array.isArray(runMap.nodes) || runMap.nodes.length === 0) return null
  if (!runMap.nodes.every((n: unknown) => isObj(n) && isStr(n.id))) return null
  const edges = arr<unknown>(runMap.edges).filter(
    (e): e is RunMap['edges'][number] => isObj(e) && isStr(e.from) && isStr(e.to),
  )
  const roster = arr<Sentinel>(o.roster)
  const currentNodeId = typeof o.currentNodeId === 'string' ? o.currentNodeId : ''
  if (!currentNodeId) return null
  // A map this build does not have is not something to silently substitute (m-5).
  const battleMapId = typeof o.battleMapId === 'string' ? o.battleMapId : FIRST_MAP.id
  if (!mapById(battleMapId)) return null

  // ---- the earned contents, refused rather than quietly edited (F3) --------
  // See the note above `validWave`: none of these five is re-derivable, so a
  // malformed one means we cannot hand back the run that was saved. Refusing is
  // not discarding — `payoutFromRaw` still pays this payload its marks.
  const inventory = arr<Item>(o.inventory)
  const recruitOptions = arr<Sentinel>(o.recruitOptions)
  if (!roster.every(validSentinel)) return null
  if (!inventory.every(validItem)) return null
  if (!recruitOptions.every(validSentinel)) return null
  const reward = Array.isArray(o.reward) ? (o.reward as RewardCard[]) : null
  if (reward && !reward.every(validRewardCard)) return null
  const merchant = o.merchant ?? null
  if (merchant !== null && !validMerchant(merchant)) return null
  // The fork's recruit branch is `recruitOptions` under another name, and its
  // mutation branch was rolled from the seeded stream at fork time — both are
  // earned, neither is re-derivable, so they follow the same rule.
  const crossroads = migrateCrossroads(o.crossroads)
  if (crossroads && !crossroads.recruits.every(validSentinel)) return null
  // Run-wide effect mods are multiplied into every combat profile. A non-object
  // in here throws on property access; a `null` throws sooner; and a STRING in
  // a numeric slot does not throw at all — it silently makes the product NaN,
  // which is worse. `validMods` checks the contents, not just the wrapper.
  const runMods = arr<EffectMods>(o.runMods)
  if (!runMods.every(validMods)) return null
  // ---- and the wave, which resolves instead, because the game re-deals it ---
  const currentWave = validWave(o.currentWave) ? (o.currentWave as WaveDef) : null

  // ---- v9 → v10: the deployment grid (G1-2) -----------------------------
  // Placements were keyed by build-circle id (`s0`…`s5`); they are keyed by
  // tile id now. An old save's company is moved onto the tile nearest where
  // each circle stood on its field (`legacyPostTile`). Anything that is not a
  // tile id this grid has, or not a hero id, is dropped; a hero named twice
  // keeps its first post. `resumeRun` then keeps only the tiles the resumed
  // field actually has open. A v9 save has no map challenge: plain ground.
  const placements = migratePlacements(o.placements, battleMapId, version)
  const terrainRule = terrainRuleById(o.terrainRule)?.id ?? null
  // Q1: a hazard seed is a uint32 hash (`run/terrain.nodeHazardSeed`); anything
  // else — absent (a pre-Q1 save), a float, a string, out of range — resumes
  // onto plain ground rather than laying a layout no node could have dealt.
  const hazardSeed = Number.isInteger(o.hazardSeed) && (o.hazardSeed as number) >= 0 && (o.hazardSeed as number) <= 0xffffffff ? (o.hazardSeed as number) : null

  // ---- v8 → v9: portrait battlefields — nothing to rewrite ----------------
  // `fieldOrientation` was added (below). A v8 save has none and was fought on
  // the landscape field, which is exactly what the default restores.

  // ---- v7 → v8: sub-waves (Phase 3a) — nothing to rewrite ---------------
  // A stored wave's spawns may now carry `group` (its sub-wave; `validWave`
  // checks it), and `tactics.focus` may be 'threat'. A v7 wave has no groups
  // and resumes as ONE sub-wave — the wave it was when it was saved — and the
  // next node deals its cut from the seed like any other.

  // ---- v6 → v7: the skill tree became spec perks (Phase 3b) ----------------
  // A version STEP, so it rewrites — exactly like the v5 → v6 kit move below.
  // Every level a hero BOUGHT is refunded at the price it cost, so the gold
  // goes to the new sinks instead of vanishing; a Mythic item's free path level
  // becomes the same value as an enchantment (`MYTHIC_EDGE`); a mutation that
  // carried one takes its current mods, which fold that level in.
  const refund = version < 7 ? legacyUpgradeRefund(roster) : 0
  if (version < 7) {
    legacyStripRoster(roster)
    legacyStripSentinels(recruitOptions)
    for (const i of inventory) legacyItem(i)
    if (merchant && isObj(merchant)) {
      for (const e of (merchant as MerchantStock).items) legacyItem(e.item)
      if ((merchant as MerchantStock).recruit) legacyStripSentinels([(merchant as MerchantStock).recruit!.sentinel])
    }
    for (const c of reward ?? []) if (c.item) legacyItem(c.item)
    if (crossroads) {
      legacyStripSentinels(crossroads.recruits)
      for (const m of crossroads.mutations) legacyMutation(m)
    }
  }

  // ---- v10 → v11: heroes have no HP --------------------------------------
  // The retired HP mods are dropped from everything a save can carry them on,
  // and the run's `runDowns` counter is simply not read back (below).
  if (version < 11) {
    stripSentinels(roster)
    stripSentinels(recruitOptions)
    for (const i of inventory) stripItem(i)
    if (merchant && isObj(merchant)) {
      for (const e of (merchant as MerchantStock).items) stripItem(e.item)
      if ((merchant as MerchantStock).recruit) stripSentinels([(merchant as MerchantStock).recruit!.sentinel])
    }
    for (const c of reward ?? []) {
      stripItem(c.item)
      stripMods(c.grant?.mods)
    }
    if (crossroads) {
      stripSentinels(crossroads.recruits)
      crossroads.mutations = crossroads.mutations.filter((m) => !RETIRED_MUTATIONS.has(m.key))
      for (const m of crossroads.mutations) stripMods(m.mods)
    }
    for (const m of runMods) stripMods(m)
  }

  // ---- v12 → v13: perks and evolutions became skills (SK1) ----------------
  // Every hero a save can carry — the company, the candidates on offer, a
  // merchant's hire, the fork's recruits — is migrated and normalised.
  migrateSkills(roster, version)
  migrateSkills(recruitOptions, version)
  if (merchant && isObj(merchant) && (merchant as MerchantStock).recruit) migrateSkills([(merchant as MerchantStock).recruit!.sentinel], version)
  if (crossroads) migrateSkills(crossroads.recruits, version)
  const challenge = migrateChallenge(o.challenge)

  const snap: RunSnapshot = {
    v: RUN_SNAPSHOT_VERSION,
    savedAt: num(o.savedAt, 0),
    mode: str<GameMode>(o.mode, 'campaign', MODES),
    runSeed: num(o.runSeed, 0),
    screen: str<Screen>(o.screen, 'map', SCREENS),
    runPhase: str<RunPhase>(o.runPhase, 'active', PHASES),
    runMap: { nodes: runMap.nodes as MapNode[], edges, layers: num(runMap.layers, 11) },
    currentNodeId,
    clearedNodeIds: arr<string>(o.clearedNodeIds),
    reachableNodeIds: arr<string>(o.reachableNodeIds),
    // A parked event this build cannot open (an unknown kind, a missing node id)
    // is dropped: `coherent()` then lands the run on the map beside that node,
    // which is still un-cleared and can be entered again.
    event:
      isObj(o.event) && EVENT_KINDS.includes(o.event.kind as EventKind) && isStr(o.event.nodeId)
        ? (o.event as RunSnapshot['event'])
        : null,
    battleMapId,
    // v8 → v9: every older save was fought on the landscape field. A value this
    // build cannot name falls back to it too — the twins are isometric, so the
    // fallback changes how the battle is drawn, never how it plays.
    fieldOrientation: str<FieldOrientation>(o.fieldOrientation, 'landscape', ORIENTATIONS),
    terrainRule,
    hazardSeed,
    roster,
    placements,
    gold: Math.max(0, num(o.gold, 0)) + refund,
    baseHp: num(o.baseHp, 1),
    maxBaseHp: Math.max(1, num(o.maxBaseHp, 20)),
    enemyHpMult: num(o.enemyHpMult, 1),
    threat: num(o.threat, 1),
    // Clamped to the ladder on the way IN (F8): whether a value is in range is
    // a property of the value, not of who happens to read it. A Daily is
    // always step 0.
    runDifficulty: challenge.kind === 'daily' ? 0 : stepOf(o),
    skillPool: migrateSkillPool(o.skillPool, challenge),
    itemPool: migrateItemPool(o.itemPool, challenge),
    challenge,
    // LS3: only a literal `true` stages a run. Anything else — absent (a save
    // from before staging), a string, a number — resumes unstaged.
    firstRun: o.firstRun === true,
    // v5 → v6: the campaign kit used to be dealt into the pack at `newRun`,
    // before the hero was picked. It is dealt at the pick now, so a v5 payload
    // parked on hero-pick drops the old roster-blind kit instead of carrying
    // it beside the new one.
    inventory: version < 6 && o.screen === 'heroPick' && roster.length === 0 ? [] : inventory,
    runKills: Math.max(0, num(o.runKills, 0)),
    marksEarned: Math.max(0, num(o.marksEarned, 0)),
    activeNodeId: typeof o.activeNodeId === 'string' ? o.activeNodeId : null,
    currentWave,
    tactics: {
      focus: str(
        (o.tactics as Tactics | undefined)?.focus,
        'first',
        ['first', 'lowestHp', 'strongest', 'nearest', 'threat'] as const,
      ),
      // `holdFire` was cut (it cost stop rate in 7 of 8 measured cells); a
      // payload that still carries it has it dropped here, not restored.
    },
    lastResult: migrateResult(o.lastResult),
    // Display-only (the summary's loot line — the items themselves are already
    // in the inventory), so a malformed entry is dropped rather than refusing
    // the run over a line of copy.
    lastLoot: arr<unknown>(o.lastLoot).filter(validItem),
    merchant: merchant as MerchantStock | null,
    shrineOfferId: typeof o.shrineOfferId === 'string' ? o.shrineOfferId : null,
    recruitOptions,
    reward,
    runMods,
    // A relic list is earned content like the rest, but an entry is only an id:
    // a non-string is dropped (it could never have been dealt), a duplicate too.
    // An id a relic used to go by is read as the relic it is now
    // (`ambidextrous` → the Twinblade Harness, round 3).
    relics: [...new Set(arr<unknown>(o.relics).filter(isStr).map((id) => LEGACY_RELIC_IDS[id] ?? id))],
    // Counters, defaulted like every other number here: a payload from before
    // they existed simply has no feat progress, which is the honest reading.
    feats: migrateFeats(o.feats),
    crossroads,
    forkDone: bool(o.forkDone, false),
    // v12's `evolutionQueue` is not read back: an owed choice is read off the
    // hero now (SK1), and evolutions are skills.
    dust: Math.max(0, num(o.dust, 0)),
    lives: Math.max(0, num(o.lives, 3)),
    wins: Math.max(0, num(o.wins, 0)),
    round: Math.max(1, num(o.round, 1)),
    endlessRecruitCost: Math.max(0, num(o.endlessRecruitCost, 100)),
    endlessRoom: (o.endlessRoom as EndlessRoom | null) ?? null,
    // 0 is a real stream position, so "absent" has to be null, not 0.
    rngLoot: typeof o.rngLoot === 'number' && Number.isFinite(o.rngLoot) ? o.rngLoot : null,
    rngMap: typeof o.rngMap === 'number' && Number.isFinite(o.rngMap) ? o.rngMap : null,
    // A dry counter, unlike a stream position, has a meaningful zero: a payload
    // from before this field existed had no pity accruing, which IS 0 (M9).
    lootPity: Math.max(0, Math.floor(num(o.lootPity, 0))),
    idCounter: Math.max(0, num(o.idCounter, 0)),
    nameCounters: migrateNameCounters(o.nameCounters),
  }

  // A run with no roster and no hero pick left to make is unplayable; drop it.
  if (snap.roster.length === 0 && snap.screen !== 'heroPick') return null
  // The Watchtower is not a run. A payload claiming it is describes a run that
  // has already been left, and offering it back would resurrect a settled one.
  if (snap.screen === 'hub') return null

  const out = coherent(snap, version)
  if (!out) return null
  // ---- round 3 (Q5): the off hand takes off-hand things only -------------
  // Not a version step: the shape is unchanged, and the rule is a property of
  // the payload's CONTENTS, so every load asks it (an idempotent no-op on a
  // company that already obeys it). A save wearing something the off hand no
  // longer takes — a sword without the Twinblade Harness or the DEX for it,
  // or a two-hander from a hand-edited payload — gets it back in the pack.
  // Nothing is destroyed, and `gearReturned` tells the player once.
  const settled = settleOffHands(out.roster, out.inventory, equipRules(out.relics))
  if (settled.moved.length) {
    out.roster = settled.roster
    out.inventory = settled.inventory
    out.gearReturned = settled.moved
  }
  return out
}

/**
 * A stored placement map, reduced to what this build can post (G1-2): tile id
 * → hero id strings only, each hero at most once. A ≤ v9 payload's circle ids
 * (`s0`…`s5`) are moved onto their nearest open tile of the saved field. A
 * v10–v11 payload's ids name the 80px grid; grid-fit (v12) halved the tile,
 * so each is doubled onto the fine tile at the same place relative to the
 * road (`terrain.fineFromCoarse`).
 */
function migratePlacements(raw: unknown, fieldId: string, version: number): Placement {
  const out: Placement = {}
  if (!isObj(raw)) return out
  const seen = new Set<string>()
  for (const [key, val] of Object.entries(raw)) {
    if (!isStr(val) || !val || seen.has(val)) continue
    const tile = version >= 12 ? (parseTileId(key) ? key : null) : fineFromCoarse(key) ?? (version < 10 ? legacyPostTile(fieldId, key) : null)
    if (!tile || Object.prototype.hasOwnProperty.call(out, tile)) continue
    out[tile] = val
    seen.add(val)
  }
  return out
}

/**
 * Resolve a payload into a state that is playable, or refuse it (M-3).
 *
 * Field-by-field coercion cannot catch this class of damage, because every
 * individual field is well-formed: it is the COMBINATIONS that are impossible.
 * `activeNodeId` naming a node that is already in `clearedNodeIds` while
 * `lastResult` is null; `screen: 'battle'` with no wave to fight;
 * `screen: 'crossroads'` with no crossroads; a reachable set that overlaps the
 * cleared set. Each of them restores into a screen whose only control the store
 * refuses, with no second control in any band — an enabled button that does
 * nothing, and no way out but a reload, which the autosave has already rewritten
 * to offer the same trap again.
 *
 * So the rule is the one the unknown-map path already followed: never restore
 * into a state with no exit. Resolve it into the coherent state it was clearly
 * one step away from, or return null and let the caller drop the save.
 */
function coherent(snap: RunSnapshot, version: number): RunSnapshot | null {
  const known = new Set(snap.runMap.nodes.map((n) => n.id))
  // Ids the map does not have are noise from a partial write or an older map.
  snap.clearedNodeIds = [...new Set(snap.clearedNodeIds.filter((id) => known.has(id)))]
  const cleared = new Set(snap.clearedNodeIds)
  // A cleared node is not somewhere left to go, whatever the payload says.
  snap.reachableNodeIds = [
    ...new Set(snap.reachableNodeIds.filter((id) => known.has(id) && !cleared.has(id))),
  ]
  if (!known.has(snap.currentNodeId)) return null
  if (snap.activeNodeId && !known.has(snap.activeNodeId)) snap.activeNodeId = null
  // An event parked on a node that is already settled has already been answered.
  if (snap.event && (!known.has(snap.event.nodeId) || cleared.has(snap.event.nodeId))) {
    snap.event = null
    snap.merchant = null
    snap.shrineOfferId = null
    snap.recruitOptions = []
  }

  /** Back to the between-fights screen for this mode, with no fight in hand. */
  const leaveBattle = () => {
    snap.screen = snap.mode === 'endless' ? 'endless' : 'map'
    snap.activeNodeId = null
    snap.currentWave = null
    snap.lastResult = null
    snap.lastLoot = []
  }

  // A v1 endless payload cannot say which side of the wave it was taken on, and
  // endless has no `clearedNodeIds` to ask instead. The rooms screen is right
  // either way: `round` already counts the next wave to fight, so a resolved
  // wave resumes at the following one and an unresolved wave resumes at itself.
  if (version < RUN_SNAPSHOT_VERSION && snap.mode === 'endless' && snap.screen === 'battle') {
    leaveBattle()
  }

  if (snap.screen === 'battle') {
    const nodeIsSpent = !!snap.activeNodeId && cleared.has(snap.activeNodeId)
    if (snap.mode === 'campaign' && nodeIsSpent && !snap.lastResult) {
      // The wave was fought and paid for; only the summary is missing. Land on
      // the map, exactly where dismissing that summary would have landed — any
      // reward it dealt is still pending and the map is where it is offered.
      leaveBattle()
    } else if (snap.mode === 'campaign' && !snap.activeNodeId) {
      // No node means nothing to pay a clear into: `finishBattle` has no branch
      // for it and used to spin on the finished engine forever (M-4).
      leaveBattle()
    } else if (!snap.currentWave && !snap.lastResult) {
      // Neither a fight nor a result — the screen would render an encounter of
      // zero enemies and one inert button.
      leaveBattle()
    }
  }

  // A fork with nothing in either branch and nothing revealed is not a fork —
  // it is a page with no offers on it. That is now reachable honestly: a v3
  // payload carries no mutation offer, so a full roster (no recruits) leaves it
  // empty. Drop it rather than restore onto it.
  const cr = snap.crossroads
  if (cr && !cr.revealed && cr.recruits.length === 0 && cr.mutations.length === 0) {
    snap.crossroads = null
  }
  // The crossroads screen without a crossroads renders no board and no offers,
  // and the shell's escape row only reaches offer pages — so it is a dead end.
  if (snap.screen === 'crossroads' && !snap.crossroads) snap.screen = 'map'
  // Mode and screen have to agree, or the run is showing the other half of the
  // game's furniture.
  if (snap.mode === 'campaign' && snap.screen === 'endless') snap.screen = 'map'
  if (snap.mode === 'endless' && (snap.screen === 'map' || snap.screen === 'crossroads')) {
    snap.screen = 'endless'
    snap.crossroads = null
  }
  // Endless deals its whole watch up front, so it never has a hero left to pick.
  if (snap.mode === 'endless' && snap.screen === 'heroPick') {
    if (snap.roster.length === 0) return null
    snap.screen = 'endless'
  }
  if (snap.mode === 'campaign') snap.endlessRoom = null
  // Off the battle screen there is no active node, and leaving a spent one
  // behind is how a later `finishBattle` finds a node it must not pay again.
  if (snap.screen !== 'battle') {
    snap.activeNodeId = null
    snap.currentWave = null
  }

  if (snap.mode === 'campaign' && snap.screen === 'map') {
    // Nowhere to march and nothing to collect is a map you can only stare at.
    // Reachability is derived, so rebuild it from where the run stands before
    // giving up on the run.
    if (snap.reachableNodeIds.length === 0 && !snap.reward && !snap.event) {
      snap.reachableNodeIds = snap.runMap.edges
        .filter((e) => e.from === snap.currentNodeId)
        .map((e) => e.to)
        .filter((id) => known.has(id) && !cleared.has(id))
      if (snap.reachableNodeIds.length === 0) return null
    }
  }

  return snap
}

// ------------------------------------------------------------------- payout

/**
 * What a payload is WORTH, as opposed to whether it can be played (M-1).
 *
 * `migrateSnapshot`/`coherent` answer one question — can the player be put back
 * into this run? — and a "no" there used to be treated as a "no" to a second,
 * unrelated question: did this run earn anything? It is not the same question.
 * The settle facts below are five plain numbers that were true of the run
 * whatever screen it happened to be parked on when the tab died. A save whose
 * `currentNodeId` names a node its map no longer has is unRESUMABLE; the thirty
 * enemies it killed still happened.
 *
 * Conflating the two destroyed a refused snapshot with its marks unpaid, which
 * is precisely the failure C3 exists to prevent: losing the run to a
 * backgrounded tab must not also cost the player what they earned.
 *
 * `runSeed` rides along because the settle needs it to tell "a previous
 * session's run" from "the run this session is holding in memory" — memory
 * stays authoritative for our own run.
 */
export interface SnapshotPayout {
  runSeed: number
  mode: GameMode
  depth: number
  kills: number
  wins: number
  /** The difficulty step the run was played at — it scales what the settle pays. */
  difficulty: number
  /** Daily / custom-seed facts: a scored Daily records, a custom seed is unranked. */
  challenge: RunChallenge
}

/**
 * Read the settle facts out of ANY payload, coherent or not.
 *
 * Returns null only when there is genuinely nothing to read: a non-object
 * (unparseable JSON already arrives as null), or a payload written by a build
 * NEWER than this one. That last refusal is deliberate — a future schema is not
 * guaranteed to still mean `wins` by `wins`, and inventing a grant out of a
 * field we may be misreading is worse than granting nothing.
 *
 * Callers still apply their own "was this run actually played?" rule; this
 * function reports, it does not decide.
 */
export function payoutFromRaw(raw: unknown): SnapshotPayout | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (num(o.v, 0) > RUN_SNAPSHOT_VERSION) return null

  // Depth is counted exactly as `coherent()` would have counted it, so a
  // refused payload and its healthy twin pay the same: an id the map does not
  // have is noise from a partial write, and a duplicate is not a second node.
  const nodes = (o.runMap as RunMap | undefined)?.nodes
  const known = Array.isArray(nodes) ? new Set(nodes.map((n) => n?.id)) : null
  const cleared = new Set(
    arr<unknown>(o.clearedNodeIds).filter(
      (id): id is string => typeof id === 'string' && (!known || known.has(id)),
    ),
  )

  return {
    runSeed: num(o.runSeed, 0),
    mode: str<GameMode>(o.mode, 'campaign', MODES),
    difficulty: stepOf(o),
    challenge: migrateChallenge(o.challenge),
    depth: Math.max(0, cleared.size - 1),
    kills: Math.max(0, num(o.runKills, 0)),
    wins: Math.max(0, num(o.wins, 0)),
  }
}

// ------------------------------------------------------------------- storage

export function saveSnapshot(snap: RunSnapshot): boolean {
  return writeJson(RUN_SNAPSHOT_KEY, snap)
}

/** A load, split into the two answers a caller may need. */
export interface LoadedRun {
  /** The run to offer back, or null when it cannot be resumed. */
  snap: RunSnapshot | null
  /**
   * Set only when a payload WAS there and could not be resumed: what it earned,
   * so the caller can settle it before discarding it. Null both when storage is
   * empty and when the payload is too broken to read any facts out of — in
   * which case there is nothing to pay, not marks to withhold.
   */
  unresumable: SnapshotPayout | null
}

/**
 * Read the stored run.
 *
 * This deliberately does NOT delete an unusable payload any more. It used to,
 * with the reasoning "clear it so the player isn't offered a broken resume on
 * every single boot" — but the boot-time peek runs before anything settles, so
 * the delete ran first and `settleSavedRun` arrived to find an empty key and a
 * fresh session with no in-memory run to pay from. The marks went with it.
 *
 * Refusing to RESUME the run is enough to keep it off the boot prompt: `snap`
 * is null and nothing offers it. Discarding it is the settle's job, and the
 * settle discards it in the same breath as paying it out.
 */
export function loadRunSnapshot(): LoadedRun {
  const raw = readJson<unknown>(RUN_SNAPSHOT_KEY)
  if (raw === null) return { snap: null, unresumable: null }
  /*
   * A throw in here is not a bad save, it is a stuck game: this runs inside
   * every settle, so `newRun` and `returnToHub` would re-throw on every tap
   * while the payload that caused it sat in storage untouched. The validators
   * are fuzzed never to throw (tests/runSnapshot.fuzz.test.ts); this is the
   * backstop that keeps a missed case unresumable-but-payable instead.
   */
  let snap: RunSnapshot | null
  try {
    snap = migrateSnapshot(raw)
  } catch {
    snap = null
  }
  if (!snap) {
    let unresumable: SnapshotPayout | null = null
    try {
      unresumable = payoutFromRaw(raw)
    } catch {
      unresumable = null
    }
    return { snap: null, unresumable }
  }
  // Deliberately NO `restoreIdCounter` / `restoreNameCounters` here. Loading is
  // also how the boot prompt and every settle PEEK at the save, and bumping the
  // process-global counters on a peek advanced them for a run nobody resumed.
  // `resumeRun` restores both, at the moment the run actually comes back.
  return { snap, unresumable: null }
}

/** The stored run if it is playable — the answer every UI caller wants. */
export function loadSnapshot(): RunSnapshot | null {
  return loadRunSnapshot().snap
}

export function clearSnapshot(): void {
  removeRaw(RUN_SNAPSHOT_KEY)
}

/** How far the snapshotted run had got — for the resume prompt's one line of copy. */
export function describeSnapshot(snap: RunSnapshot): string {
  if (snap.mode === 'endless') {
    return `Endless Watch · round ${snap.round} · ${snap.lives} ${snap.lives === 1 ? 'life' : 'lives'} · ${snap.roster.length} ${snap.roster.length === 1 ? 'hero' : 'heroes'}`
  }
  const depth = Math.max(0, snap.clearedNodeIds.length - 1)
  return `Campaign · depth ${depth}/${Math.max(1, snap.runMap.layers - 1)} · ${snap.gold}g · ${snap.roster.length} ${snap.roster.length === 1 ? 'hero' : 'heroes'}`
}
