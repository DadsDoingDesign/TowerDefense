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
import { restoreIdCounter } from '../game/core/rng'
import { ENEMY_TYPES } from '../game/data/enemies'
import { FIRST_MAP, mapById } from '../game/data/maps'
import { restoreNameCounters, type NameCounters } from '../game/data/sentinels'
import { shrineById, type ShrineOffer } from '../game/data/shrines'
import type { BattleResult } from '../game/engine/engine'
import type { RunMap } from '../game/data/runmap'
import type { RewardCard } from '../game/data/rewards'
import type {
  Archetype,
  EffectMods,
  GameMap,
  Item,
  ItemRarity,
  ItemSlot,
  Mutation,
  Placement,
  Sentinel,
  Tactics,
  WaveDef,
} from '../game/types'
import { MAX_BANNER } from './metaStore'
import { arr, bool, num, readJson, removeRaw, str, writeJson } from './storage'

export const RUN_SNAPSHOT_KEY = 'fieldwatch-run'

/**
 * A stored Banner tier, coerced onto the ladder (F8).
 *
 * `Math.max(0, num(...))` was the whole of it, with no ceiling, so a payload
 * saying `runBanner: 99` resumed as 99 and rode into `BANNER_RUNGS[98].name`.
 * One source of truth for the ceiling, shared with `bannerRules`.
 *
 * This clamps the value to something the ladder HAS. Whether the save has
 * unlocked it is a different question, asked where the answer is known — see
 * `resumeRun` in the game store.
 */
const clampBanner = (raw: unknown): number =>
  Math.max(0, Math.min(MAX_BANNER, Math.floor(num(raw, 0))))

/**
 * Snapshot schema version (M11). Bump on any shape change and extend `migrate`;
 * every numeric field is defensively defaulted on the way in so a save written
 * by an older build can never inject `undefined` into arithmetic.
 */
export const RUN_SNAPSHOT_VERSION = 5

type GameMode = 'campaign' | 'endless'
type Screen = 'hub' | 'heroPick' | 'map' | 'crossroads' | 'battle' | 'endless'
type RunPhase = 'active' | 'won' | 'lost'
type EventKind = 'merchant' | 'shrine' | 'recruit'
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

interface MerchantStock {
  items: { item: Item; price: number }[]
  recruit: { sentinel: Sentinel; price: number } | null
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
  roster: Sentinel[]
  placements: Placement
  gold: number
  baseHp: number
  maxBaseHp: number
  enemyHpMult: number
  threat: number
  /**
   * The Banner this run is flying (v3). It has to survive a reload for the
   * obvious reason — Banner 3 makes every node an elite, so a resumed run that
   * forgot it would quietly become an easier run than the one that was saved —
   * and for a less obvious one: the payout multiplier is read off it when the
   * run settles. A v1/v2 payload has no Banner and defaults to 0, which is
   * exactly right: nothing before v3 could have flown one.
   */
  runBanner: number
  inventory: Item[]
  runKills: number
  runDowns: number
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
  crossroads: CrossroadsSnap | null
  forkDone: boolean
  /** Heroes with an evolution choice still owed to the player. */
  evolutionQueue: string[]

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
   * Per-archetype name counters at save time. Another process-global that resets
   * on reload: without it a Sentinel recruited after a resume re-uses a name
   * already on the roster (m-4).
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
  runBanner: number
  inventory: Item[]
  runKills: number
  runDowns: number
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
  crossroads: CrossroadsSnap | null
  forkDone: boolean
  evolutionQueue: string[]
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
    battleMapId: s.battleMap?.id ?? FIRST_MAP.id,
    roster: s.roster,
    placements: s.placements,
    gold: s.gold,
    baseHp: s.baseHp,
    maxBaseHp: s.maxBaseHp,
    enemyHpMult: s.enemyHpMult,
    threat: s.threat,
    runBanner: s.runBanner,
    inventory: s.inventory,
    runKills: s.runKills,
    runDowns: s.runDowns,
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
    crossroads: s.crossroads,
    forkDone: s.forkDone,
    evolutionQueue: s.evolutionQueue,
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
  const map = mapById(snap.battleMapId)
  if (!map) throw new Error(`run snapshot names an unknown battle map: ${snap.battleMapId}`)
  return map
}

// ------------------------------------------------------------------ migrate

const ARCHETYPES: readonly Archetype[] = ['fighter', 'rogue', 'mystic']

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
  healAura: ['hps', 'radius'],
  buffAura: ['damageMult', 'radius'],
  dmgReductionAura: ['reduction', 'radius'],
  trap: ['dps', 'slow'],
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
} as const satisfies Partial<Record<keyof EffectMods, true>>
const MOD_KEYS: Record<keyof EffectMods, true> = {
  damageMult: true, rateMult: true, rangeMult: true, hpMult: true, projSpeedMult: true,
  physDefAdd: true, splashAdd: true, critChanceAdd: true, critMultAdd: true, pierce: true,
  burn: true, chill: true, shock: true, stunChance: true, stunDur: true, execute: true,
  block: true, thornsMult: true, thornsIgnite: true, healAura: true, buffAura: true,
  dmgReductionAura: true, lifedrain: true, selfSacrifice: true, trap: true,
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
      if (!isObj(v) || !struct.every((f) => isNum(v[f]))) return false
    } else if (k in MOD_BOOL_FIELDS) {
      if (typeof v !== 'boolean') return false
    } else if (k in MOD_KEYS && !isNum(v)) {
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
    (s) => isObj(s) && isStr(s.typeId) && !!ENEMY_TYPES[s.typeId] && isNum(s.at) && isNum(s.hpMult),
  )
}

/** An item the gear screens can render: a real slot, a real rarity, real affixes. */
function validItem(raw: unknown): raw is Item {
  if (!isObj(raw)) return false
  if (!isStr(raw.id) || !isStr(raw.name)) return false
  if (!ITEM_SLOTS.includes(raw.slot as ItemSlot)) return false
  if (!RARITIES.includes(raw.rarity as ItemRarity)) return false
  if (!isObj(raw.base)) return false
  if (!Array.isArray(raw.enchantments)) return false
  return raw.enchantments.every((e) => isObj(e) && isStr(e.id) && isStr(e.label))
}

const validStats = (raw: unknown): boolean =>
  isObj(raw) && isNum(raw.str) && isNum(raw.dex) && isNum(raw.int)

const validEquipSlot = (raw: unknown): boolean => raw === null || raw === undefined || validItem(raw)

/** A Sentinel `combat.ts` can build a profile from without hitting `undefined`. */
function validSentinel(raw: unknown): raw is Sentinel {
  if (!isObj(raw)) return false
  if (!isStr(raw.id) || !isStr(raw.name)) return false
  if (!ARCHETYPES.includes(raw.archetype as Archetype)) return false
  if (!Array.isArray(raw.branchPath) || !raw.branchPath.every(isStr)) return false
  if (!validStats(raw.stats)) return false
  if (!isNum(raw.thorns) || !isNum(raw.patience) || !isNum(raw.level) || !isNum(raw.xp)) return false
  if (!isStr(raw.color) || !isStr(raw.accent)) return false
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
  if (raw.kind === 'stat') return isObj(raw.grant)
  return false
}

/** A merchant shelf: priced items, and either no recruit or a real one. */
function validMerchant(raw: unknown): raw is MerchantStock {
  if (!isObj(raw)) return false
  if (!Array.isArray(raw.items)) return false
  if (!raw.items.every((e) => isObj(e) && validItem(e.item) && isNum(e.price))) return false
  const r = raw.recruit
  if (r === null || r === undefined) return true
  return isObj(r) && validSentinel(r.sentinel) && isNum(r.price)
}

/** Name counters, defensively defaulted — a bad one must not stall name issuance. */
function migrateNameCounters(raw: unknown): NameCounters {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out = { fighter: 0, rogue: 0, mystic: 0 } as NameCounters
  for (const a of ARCHETYPES) out[a] = Math.max(0, num(o[a], 0))
  return out
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
  const revealed = o.revealed as CrossroadsSnap['revealed'] | undefined
  return {
    recruits: arr<Sentinel>(o.recruits),
    mutations: arr<Mutation>(o.mutations).filter((m) => m && typeof m.id === 'string'),
    mutationHeroId: typeof o.mutationHeroId === 'string' ? o.mutationHeroId : null,
    ...(revealed && typeof revealed === 'object' && revealed.mutation ? { revealed } : {}),
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
    downed: Math.max(0, num(o.downed, 0)),
    enemiesKilled: Math.max(0, num(o.enemiesKilled, 0)),
    perSentinel: arr<Record<string, unknown>>(o.perSentinel)
      .filter((p) => p && typeof p.id === 'string')
      .map((p) => ({
        id: p.id as string,
        kills: Math.max(0, num(p.kills, 0)),
        damageDealt: Math.max(0, num(p.damageDealt, 0)),
        xpGained: Math.max(0, num(p.xpGained, 0)),
        downed: bool(p.downed, false),
      })),
  }
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

  const runMap = o.runMap as RunMap | undefined
  if (!runMap || !Array.isArray(runMap.nodes) || runMap.nodes.length === 0) return null
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

  const snap: RunSnapshot = {
    v: RUN_SNAPSHOT_VERSION,
    savedAt: num(o.savedAt, 0),
    mode: str<GameMode>(o.mode, 'campaign', MODES),
    runSeed: num(o.runSeed, 0),
    screen: str<Screen>(o.screen, 'map', SCREENS),
    runPhase: str<RunPhase>(o.runPhase, 'active', PHASES),
    runMap: { nodes: runMap.nodes, edges: arr(runMap.edges), layers: num(runMap.layers, 11) },
    currentNodeId,
    clearedNodeIds: arr<string>(o.clearedNodeIds),
    reachableNodeIds: arr<string>(o.reachableNodeIds),
    event: (o.event as RunSnapshot['event']) ?? null,
    battleMapId,
    roster,
    placements: (o.placements && typeof o.placements === 'object' ? o.placements : {}) as Placement,
    gold: Math.max(0, num(o.gold, 0)),
    baseHp: num(o.baseHp, 1),
    maxBaseHp: Math.max(1, num(o.maxBaseHp, 20)),
    enemyHpMult: num(o.enemyHpMult, 1),
    threat: num(o.threat, 1),
    // Clamped to the ladder on the way IN (F8). `bannerRules` clamps internally,
    // so a 99 in a hand-edited payload was survivable arithmetic — but it is not
    // survivable copy: the picker reads `BANNER_RUNGS[runBanner - 1].name` off
    // this number and a 99 indexes past the end of the array. Whether a value is
    // in range is a property of the value, not of who happens to read it.
    runBanner: clampBanner(o.runBanner),
    inventory,
    runKills: Math.max(0, num(o.runKills, 0)),
    runDowns: Math.max(0, num(o.runDowns, 0)),
    marksEarned: Math.max(0, num(o.marksEarned, 0)),
    activeNodeId: typeof o.activeNodeId === 'string' ? o.activeNodeId : null,
    currentWave,
    tactics: {
      focus: str(
        (o.tactics as Tactics | undefined)?.focus,
        'first',
        ['first', 'lowestHp', 'strongest', 'nearest'] as const,
      ),
      holdFire: bool((o.tactics as Tactics | undefined)?.holdFire, false),
    },
    lastResult: migrateResult(o.lastResult),
    lastLoot: arr<Item>(o.lastLoot),
    merchant: merchant as MerchantStock | null,
    shrineOfferId: typeof o.shrineOfferId === 'string' ? o.shrineOfferId : null,
    recruitOptions,
    reward,
    runMods,
    crossroads,
    forkDone: bool(o.forkDone, false),
    evolutionQueue: arr<string>(o.evolutionQueue),
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

  return coherent(snap, version)
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
  downs: number
  wins: number
  /** Banner the run was flying — it scales what the settle pays (H16). */
  banner: number
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
    banner: clampBanner(o.runBanner),
    depth: Math.max(0, cleared.size - 1),
    kills: Math.max(0, num(o.runKills, 0)),
    downs: Math.max(0, num(o.runDowns, 0)),
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
  const snap = migrateSnapshot(raw)
  if (!snap) return { snap: null, unresumable: payoutFromRaw(raw) }
  restoreIdCounter(snap.idCounter)
  restoreNameCounters(snap.nameCounters)
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
    return `Endless Watch · round ${snap.round} · ${snap.lives} ${snap.lives === 1 ? 'life' : 'lives'} · ${snap.roster.length} Sentinels`
  }
  const depth = Math.max(0, snap.clearedNodeIds.length - 1)
  return `Campaign · depth ${depth}/${Math.max(1, snap.runMap.layers - 1)} · ${snap.gold}g · ${snap.roster.length} Sentinels`
}
