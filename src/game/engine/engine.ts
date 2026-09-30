import { GamePath } from '../core/path'
import { hashSeed, nextId, RNG } from '../core/rng'
import { dist, distSq, moveToward, type Vec2 } from '../core/vec'
import { mergeMods } from '../data/archetypeTree'
import { behaviourOf, RESIST_CAP } from '../data/behaviours'
import { DEFAULT_COMMANDS, FLARE, HOLD, RALLY, type CommandId } from '../data/commands'
import { ENEMY_MODS, ENEMY_TYPES, modKey } from '../data/enemies'
import { tileDamageMult } from '../data/hazards'
import type { EffectMods, EnemyBehaviour, EnemyType, FocusMode, GameMap, Sentinel, Tactics, WaveDef } from '../types'

type Behaviour<K extends EnemyBehaviour['kind']> = Extract<EnemyBehaviour, { kind: K }>
import { computeCombat, type CombatProfile } from './combat'

/**
 * The one true simulation tick (seconds). The sim only ever advances in whole
 * TICKs; play speed multiplies how MANY ticks run per frame, never their size,
 * so a battle resolves identically at 1×/2×/3× and at any framerate (C2).
 */
export const TICK = 1 / 60
/** Ceiling on accumulator catch-up steps per frame — avoids a spiral of death after a tab-out. */
export const MAX_STEPS_PER_FRAME = 6

const PATIENCE_INTERVAL = 3 // seconds per stack
const PATIENCE_PER_STACK = 0.04
const TRAP_RADIUS = 34
/** How often a Sentinel re-scores its target against the active focus tactic (H4). */
const RETARGET_INTERVAL = 0.45
/**
 * Life-drain scale: the mod value is a *rate coefficient*, not a share of the
 * hit — 0.5 life-drain heals the base for 1% of damage dealt. describe.ts states
 * this same number; keep the two in step (H5).
 */
const LIFEDRAIN_SCALE = 0.02

// ---- status interactions (Phase 3a) -----------------------------------------
/**
 * BRITTLE: a FROST-chilled enemy takes this much more physical damage. Frost
 * means a `chill` status from a hit (`mods.chill`) — NOT a trap's drag, which
 * writes the same slow fields, because a rogue trap is physical and would
 * otherwise buff its own damage with its own slow.
 */
export const BRITTLE_MULT = 1.25
/** SHATTER: a shock arc (or a shock shot) meeting a frosted enemy bursts it for this share of the hit, and thaws it. */
export const SHATTER_FRAC = 0.6
/** Burn SPREAD: a burning body that dies lights up to this many neighbours… */
export const SPREAD_COUNT = 2
/** …within this radius, for what was left of the burn (at least `SPREAD_MIN_DUR` s). */
export const SPREAD_RADIUS = 70
const SPREAD_MIN_DUR = 1
// ---- sub-waves ----------------------------------------------------------------
/** How far up the road from the Gate a charge aimed at it is drawn (see `gateMark`). */
const GATE_MARK_INSET = 64
/** Split pieces and boss halves are placed this far apart along the lane, so they read as separate bodies. */
const SPLIT_SPACING = 14

/** One recorded player input, stamped with the tick it took effect after. */
export type BattleInput =
  | { tick: number; kind: 'command'; id: CommandId }
  | { tick: number; kind: 'move'; from: string; to: string }
  | { tick: number; kind: 'focus'; focus: FocusMode }
  | { tick: number; kind: 'resume' }

/** A transient, sim-timed marker the renderer draws (`render/telegraphs.ts`). */
export type TelegraphKind =
  | 'lob'
  | 'kingLob'
  | 'blast'
  | 'heal'
  | 'warcry'
  | 'leap'
  | 'split'
  | 'flare'
  | 'shatter'
  | 'spread'
  | 'phase'
export interface Telegraph {
  id: number
  kind: TelegraphKind
  x: number
  y: number
  r: number
  /** Sim time it appeared / it resolves (engine clock, `engine.elapsed`). */
  t0: number
  t1: number
  /** The enemy that owns it — a lob's mark vanishes if its thrower dies first. */
  srcId?: string
  /** Second point (a leap's landing spot). */
  x2?: number
  y2?: number
}

/**
 * What the behaviour kit, the interactions, the commands and the sub-waves
 * actually DID this battle. Every counter here is one a balance-report sweep
 * reads, so a behaviour that silently stops firing shows up as a zero.
 */
export interface BehaviourStats {
  healPulses: number
  hpHealed: number
  enrages: number
  /** Sappers that went off — held at the wall, or at the Gate. */
  sapperBlasts: number
  /** Sapper blasts that went off on their blocker (harmless; paid as that hero's kill). */
  sapperHeld: number
  /** Extra Gate damage sappers dealt by reaching it (on top of their leak). */
  sapperDamage: number
  lobsStarted: number
  lobsLanded: number
  lobsCancelled: number
  /** Gate damage bombers' charges dealt. */
  lobDamage: number
  splits: number
  splitSpawned: number
  /** Leaks, attributed: a split piece, an enraged berserker, a leaper that vaulted. */
  splitLeaks: number
  enragedLeaks: number
  leapLeaks: number
  shieldedPrevented: number
  leaps: number
  warCries: number
  hasteApplied: number
  kingLobs: number
  /** Gate damage the Powderkeg King's TNT dealt. */
  kingDamage: number
  bossSplits: number
  bossPhases: number
  shatters: number
  shatterDamage: number
  burnSpreads: number
  brittleBonus: number
  /** Everything the kit dealt to the GATE beyond plain leaks (blasts, lobs, the King). */
  gateDamage: number
  commandsUsed: number
  holdBlocked: number
  breathers: number
  repositions: number
}

const emptyStats = (): BehaviourStats => ({
  healPulses: 0,
  hpHealed: 0,
  enrages: 0,
  sapperBlasts: 0,
  sapperHeld: 0,
  sapperDamage: 0,
  lobsStarted: 0,
  lobsLanded: 0,
  lobsCancelled: 0,
  lobDamage: 0,
  splits: 0,
  splitSpawned: 0,
  splitLeaks: 0,
  enragedLeaks: 0,
  leapLeaks: 0,
  shieldedPrevented: 0,
  leaps: 0,
  warCries: 0,
  hasteApplied: 0,
  kingLobs: 0,
  kingDamage: 0,
  bossSplits: 0,
  bossPhases: 0,
  shatters: 0,
  shatterDamage: 0,
  burnSpreads: 0,
  brittleBonus: 0,
  gateDamage: 0,
  commandsUsed: 0,
  holdBlocked: 0,
  breathers: 0,
  repositions: 0,
})

/**
 * Switches for counterfactual measurement ONLY. The game ships with every
 * rule on; the balance harness turns one off to measure what it is worth on
 * identical seeds (REPORT §16). Nothing under `src/state` passes this.
 */
export interface EngineRules {
  /** The enemy behaviour kit and boss phases. */
  behaviours: boolean
  /** Brittle / shatter / burn spread. */
  interactions: boolean
  /** Sub-waves: `false` fights every group as one continuous wave, the pre-3a shape. */
  subWaves: boolean
}
const ALL_RULES: EngineRules = { behaviours: true, interactions: true, subWaves: true }

/**
 * The share of incoming damage of `type` an enemy actually takes: its
 * resistance (plus any shield-bearer aura, capped), times brittle for physical
 * damage on a frosted body.
 *
 * ONE function, exported, because the tick differ (`render/fxDiff.ts`) has to
 * re-run this exact arithmetic to tell a burn tick from a hit — the audit's
 * lesson is that a predicate re-deriving the engine's resist by hand drifts
 * the moment the engine's rule changes. `shield` and `brittle` are frozen per
 * tick (written at the END of `step`), so the differ's pre-tick snapshot and
 * the tick it describes agree exactly. With no shield and no frost this is
 * `1 - resist` to the ulp, i.e. the pre-3a arithmetic.
 */
export function takenMult(e: Pick<RtEnemy, 'type' | 'shield' | 'brittle'>, type: 'physical' | 'magic'): number {
  const base = type === 'physical' ? (e.type.physResist ?? 0) : (e.type.magResist ?? 0)
  // The bearer HARDENS armour; it cannot create it. Only a type the body
  // already resists gets the aura, so an elite modifier's open damage type
  // (Plated's magic, Warded's steel) stays open — the modifiers' one promise.
  const resist = e.shield > 0 && base > 0 ? Math.min(RESIST_CAP, base + e.shield) : base
  return type === 'physical' && e.brittle ? (1 - resist) * BRITTLE_MULT : 1 - resist
}

/**
 * The Phase-3a half of a fresh `RtEnemy`, at rest: no statuses, no behaviour
 * state in progress. Exported for the few places outside the engine that build
 * an enemy to DRAW it (the slice harness, the fx-differ tests).
 */
export function enemyBehaviourState(key: string, reward: number) {
  return {
    key,
    reward,
    frostUntil: 0,
    brittle: false,
    shield: 0,
    flareSlow: 0,
    flareUntil: 0,
    hasteMult: 1,
    hasteUntil: 0,
    enraged: false,
    lobCharges: 0,
    lobUntil: 0,
    lobX: 0,
    lobY: 0,
    kingNextAt: 0,
    kingUntil: 0,
    kingX: 0,
    kingY: 0,
    phase: 0,
    warCryUntil: 0,
    leapt: false,
    leapOver: null as string | null,
    healNextAt: 0,
    healReadyAt: 0,
    healed: 0,
    piece: false,
  }
}

export interface RtSentinel {
  id: string
  def: Sentinel
  pos: Vec2
  slotId: string
  profile: CombatProfile
  cooldown: number
  targetId: string | null
  aimAngle: number
  fireFlash: number
  patienceTime: number
  patienceStacks: number
  patienceMax: number
  blockIds: string[]
  buffMult: number
  kills: number
  damageDealt: number
  procFlash: number // pulses when an on-hit effect fires (visual feedback, M7)
  /** Seconds until this Sentinel re-scores its target against the focus tactic. */
  retargetIn: number
  /** Shots fired this wave — the cadence `volley` / `critEvery` count on (Phase 3b). */
  shots: number
  /** `elapsed` until which a `killRush` is running (Phase 3b). */
  rushUntil: number
  /**
   * Q1: the damage multiplier the ground under it imposes — `CURSED_DAMAGE_MULT`
   * on cursed ground, 1 anywhere else. Re-read on every move (`placeAt`).
   */
  groundMult: number
}

export interface RtEnemy {
  id: string
  type: EnemyType
  hp: number
  maxHp: number
  distance: number
  pos: Vec2
  hitFlash: number
  burnDps: number
  burnUntil: number
  /** Who owns the burn — so DoT kills award kill credit and XP (H3). */
  burnSrcId: string | undefined
  /** Burn inherits the applying tower's damage type, so resists apply honestly (M25). */
  burnType: 'physical' | 'magic'
  chillSlow: number
  chillUntil: number
  stunUntil: number
  blockedBy: string | null
  // ---- Phase 3a: behaviours, interactions, commands ------------------------
  /** The registry key it spawned under (`barrel4_plated`) — a split's pieces inherit its modifier. */
  key: string
  /** Gold on kill. The type's reward, except for split pieces and boss halves. */
  reward: number
  /** Sim time a FROST chill (a hit's `mods.chill`, not a trap) lasts until — brittle and shatter read this. */
  frostUntil: number
  /** Frozen per tick at the end of `step`: frosted right now (see {@link takenMult}). */
  brittle: boolean
  /** Frozen per tick: the shield-bearer resist covering this body (0 = none). */
  shield: number
  /** Command: Flare's slow. */
  flareSlow: number
  flareUntil: number
  /** Grukk's war-cry haste. */
  hasteMult: number
  hasteUntil: number
  /** Berserker: below its threshold, for good. */
  enraged: boolean
  /** Bomber: throws left; while `lobUntil > 0` it is planted and winding up, aimed at the Gate (`lobX`, `lobY`). */
  lobCharges: number
  lobUntil: number
  lobX: number
  lobY: number
  /** Powderkeg King: next throw, and the throw in flight (aimed at the Gate). */
  kingNextAt: number
  kingUntil: number
  kingX: number
  kingY: number
  /** Boss phase counter (war-cry thresholds passed / King rage / Colossus split). */
  phase: number
  /** Grukk: sim time the war-cry in progress resolves (0 = none). */
  warCryUntil: number
  /** Leaper: has vaulted, and over whom (that blocker can never hold it). */
  leapt: boolean
  leapOver: string | null
  /** Shaman: next pulse. Everyone: earliest time a pulse may heal it again. */
  healNextAt: number
  healReadyAt: number
  /** HP a heal added THIS tick — the tick differ subtracts it so a heal cannot hide a hit. */
  healed: number
  /** Born from a splitter's death (its leak is booked as `splitLeaks`). */
  piece: boolean
}

/**
 * What an engine event tells the mixer, beyond its name. `x` is the field
 * position mapped to −1 (left edge) … 1 (right edge).
 */
export interface EngineEventPayload {
  arch?: string
  x?: number
  faction?: string
  tier?: number
  boss?: boolean
  /** Phase 3a: the enemy's display name (behaviour / boss-phase events). */
  name?: string
  /** Phase 3a: the boss phase just entered (1-based count of phases passed). */
  phase?: number
  /** Phase 3a: which Watch Command fired (`command`, `command:<id>`). */
  command?: string
}

/** 'tnt3' → { faction: 'tnt', tier: 3 } (elites share their base id). */
function enemyTag(t: EnemyType): { faction: string; tier: number; boss: boolean } {
  const m = /^(torch|tnt|barrel)(\d)/.exec(t.id)
  return { faction: m ? m[1] : 'torch', tier: m ? Number(m[2]) : 1, boss: !!t.isBoss }
}

export interface RtProjectile {
  id: string
  pos: Vec2
  toPos: Vec2
  targetId: string | null
  srcId: string
  damage: number
  damageType: 'physical' | 'magic'
  isCrit: boolean
  speed: number
  splashRadius: number
  pierce: number
  color: string
  mods: EffectMods
  lifedrain: number
}

export interface RtTrap {
  id: string
  pos: Vec2
  dps: number
  slow: number
  /** The Sentinel that laid it — trap kills credit their owner (H3). */
  srcId: string
  /**
   * The owner's damage type, carried on the trap.
   *
   * `updateTraps` used to pass a hardcoded `'physical'`. That is correct today
   * only by coincidence — every `trap` grant in `archetypeTree.ts` sits on the
   * rogue branch — and it would silently misresist the moment one landed on a
   * mystic, or on an item/mutation that can roll onto one. A burn already
   * carries its owner's type for exactly this reason (M25); a trap is the same
   * argument with the same answer.
   */
  damageType: 'physical' | 'magic'
}

export interface FloatingText {
  id: string
  pos: Vec2
  text: string
  color: string
  life: number
  maxLife: number
  vy: number
}

export type BattleStatus = 'running' | 'cleared' | 'defeated'

export interface BattleResult {
  status: 'cleared' | 'defeated'
  goldEarned: number
  /**
   * Base HP left, in WHOLE points, and the number the campaign carries forward.
   *
   * It reconciles with {@link leakDamage} by construction: with no lifedrain in
   * play it is exactly `baseHp at wave start − leakDamage`, so a summary that
   * prints "N left (−D)" against a starting base of S always satisfies
   * N = S − D. It used to be the raw simulated float, which under the assist
   * dial handed the campaign a fractional base for the rest of the run and made
   * the receipt disagree with itself by a point (F3).
   */
  baseHpLeft: number
  /**
   * Base-HP DAMAGE the line took, in whole points — **not** a head count.
   *
   * An enemy's `leak` value is how many points it costs, and the tough ones
   * cost several, so this is always ≥ the number that got through. Render it
   * next to "left"; render {@link enemiesLeaked} when you mean "how many
   * reached the line" (F3).
   */
  leakDamage: number
  /** @deprecated Kept as the historical name for {@link leakDamage}; identical value. */
  leaks: number
  /** How many enemies actually reached the line. A head count, not damage (F3). */
  enemiesLeaked: number
  enemiesKilled: number
  perSentinel: { id: string; kills: number; damageDealt: number; xpGained: number }[]
}

/** The public state of the sub-wave machine, for the HUD. */
export interface SubWaveState {
  /** 0-based index of the sub-wave being fought (or about to be, during a breather). */
  index: number
  count: number
  /** True while the sim is paused between sub-waves. */
  breather: boolean
  /** True once the one allowed reposition of this breather has been spent. */
  moved: boolean
}

export class GameEngine {
  readonly map: GameMap
  readonly path: GamePath
  readonly wave: WaveDef

  sentinels: RtSentinel[] = []
  enemies: RtEnemy[] = []
  projectiles: RtProjectile[] = []
  traps: RtTrap[] = []
  floaters: FloatingText[] = []

  baseHp: number
  maxBaseHp: number
  goldEarned = 0
  /** Base-HP damage taken from leaks, as simulated (fractional under assist). */
  leaks = 0
  /** How many enemies reached the line. A head count — `leaks` is the damage (F3). */
  leakCount = 0
  /** `baseHp` the wave started from, so the result can reconcile against it (F3). */
  private readonly startBaseHp: number
  /**
   * Optional sound/event hook (app supplies audio; the headless harness omits it).
   *
   * The vocabulary: `'shoot'` (a Sentinel fires), `'hit'` / `'crit'` (a
   * projectile lands — one per impact, not per enemy touched), `'kill'` (an
   * enemy dies), `'leak'` (something reaches the line), `'boss'` (a champion
   * spawns), `'melee'` (a blocker is grinding what it holds this tick — the
   * mixer throttles it into discrete thuds).
   *
   * Each call may carry an {@link EngineEventPayload} — who fired, which goblin,
   * where on the field — so the mixer can give each its own sound and pan it
   * (Phase-2 audio). The payload is a plain object literal built from state
   * the sim already holds; it is only built when a listener exists (the
   * optional call short-circuits its arguments), reads nothing it could
   * change, and consumes no RNG.
   *
   * It is a plain callback and nothing here ever reads a result from it,
   * which is what keeps the sim headless-safe and deterministic: the listener
   * cannot influence a roll, cannot consume the RNG, and does not exist at all
   * in `balance/harness.ts`.
   */
  private onEvent?: (e: string, p?: EngineEventPayload) => void
  killCount = 0
  /**
   * Q10 — kills by registry key (`barrel3_plated`), for the Codex's felled
   * tally (the enemy info card's knowledge rule). Write-only inside the sim:
   * nothing here reads it, so it cannot move a roll or a result.
   */
  readonly killsByKey = new Map<string, number>()
  status: BattleStatus = 'running'
  elapsed = 0
  /** Whole steps simulated. Player inputs are stamped with it (`inputLog`). */
  tick = 0

  // ---- Phase 3a ----------------------------------------------------------
  /** Transient markers for the renderer (`render/telegraphs.ts`). Sim state, never read back by the sim. */
  telegraphs: Telegraph[] = []
  /** What the behaviour kit / interactions / commands did — the harness reads it. */
  readonly behaviourStats: BehaviourStats = emptyStats()
  /** Every player input this battle, stamped with its tick. Replaying it reproduces the battle. */
  readonly inputLog: BattleInput[] = []
  /** The Watch Commands this company carries; all share ONE charge per sub-wave. */
  readonly commands: readonly CommandId[]
  /** The per-sub-wave charge. Refilled when a sub-wave begins. */
  commandReady = true
  /** Rally Horn is sounding until this sim time. */
  rallyUntil = 0
  /** Hold the Line: leaks the Gate still ignores this sub-wave. */
  holdLeaks = 0
  /** Which sub-wave is live, and the machine's pause state. */
  subWave = 0
  readonly subWaveCount: number
  /** True while the sim is paused between two sub-waves. */
  breather = false
  private movedThisBreather = false
  private groupStart = 0
  private readonly breatherMode: 'pause' | 'auto'
  private readonly rules: EngineRules
  private readonly script: readonly BattleInput[]
  private scriptIndex = 0
  private pendingSpawns: RtEnemy[] = []
  private pendingBurns: { e: RtEnemy; dps: number; dur: number; src: string | undefined; type: 'physical' | 'magic' }[] = []
  private telegraphSeq = 0

  private spawnQueue: { typeId: string; at: number; hpMult: number; g: number }[]
  private spawnIndex = 0
  /** Combat stream: every roll that changes the outcome (crits, stuns, cooldown offsets). */
  private rng: RNG
  /** Cosmetic stream: floater jitter and friends, kept off the combat stream (C1). */
  private cosmeticRng: RNG
  private teamMods: EffectMods[]
  private enemyHpMult: number
  /**
   * Multiplier on the damage the base takes from a leak — the assist dial (M34).
   *
   * It is an *option*, not a store read, on purpose. The engine has to stay
   * reproducible from `(seed, options)` alone: the balance harness constructs it
   * directly in Node where `useSettingsStore` means nothing, and a replay must
   * reproduce the run it is replaying rather than the settings of whoever is
   * watching. So the caller that owns the settings (`gameStore.startWave`) reads
   * the dial and passes the number in; everything else gets 1 and is unaffected.
   */
  private baseDamageMul: number
  private tactics: Tactics
  private xpGained = new Map<string, number>()
  /** Set when an enemy spawns, so every Sentinel re-scores its target that tick (H4). */
  private retargetDirty = false

  constructor(opts: {
    map: GameMap
    wave: WaveDef
    placedSentinels: { sentinel: Sentinel; slotId: string }[]
    baseHp: number
    maxBaseHp: number
    teamMods?: EffectMods[]
    enemyHpMult?: number
    tactics?: Tactics
    seed?: number
    /** Assist dial: multiplier on base damage per leak (default 1 = shipped difficulty). */
    baseDamageMul?: number
    onEvent?: (e: string, p?: EngineEventPayload) => void
    /**
     * What the engine does when a sub-wave is cleared and another is queued.
     *
     *  - `'pause'` (the game): the sim stops (`breather` is true, `step` is a
     *    no-op) until {@link resume} — the player may make ONE {@link moveHero}.
     *  - `'auto'` (default — the harness, tests, replays): the breather is
     *    entered and left on the next `step` with no player, after applying any
     *    scripted inputs stamped for it. The two modes run the identical
     *    battle when the player simply taps Continue.
     */
    breathers?: 'pause' | 'auto'
    /** Watch Commands available (default: {@link DEFAULT_COMMANDS}). */
    commands?: readonly CommandId[]
    /** A recorded input log to replay (see {@link inputLog}). */
    script?: readonly BattleInput[]
    /** Counterfactual switches for the balance harness only (default: all on). */
    rules?: Partial<EngineRules>
  }) {
    this.onEvent = opts.onEvent
    this.breatherMode = opts.breathers ?? 'auto'
    this.commands = [...(opts.commands ?? DEFAULT_COMMANDS)]
    this.rules = { ...ALL_RULES, ...opts.rules }
    this.script = [...(opts.script ?? [])].sort((a, b) => a.tick - b.tick)
    this.map = opts.map
    this.path = new GamePath(opts.map.path)
    this.wave = opts.wave
    this.baseHp = opts.baseHp
    this.startBaseHp = opts.baseHp
    this.maxBaseHp = opts.maxBaseHp
    this.teamMods = opts.teamMods ?? []
    this.enemyHpMult = opts.enemyHpMult ?? 1
    // Guarded rather than trusted: a NaN or a negative here would either destroy
    // the base instantly or make it unkillable, and both are silent. ZERO is
    // rejected for exactly the reason the sentence above gives and used to be
    // let through anyway (F6): at 0 no leak costs anything, the base can never
    // fall, and `checkEnd` can only ever return 'cleared' — an unlosable game
    // that still hands out every reward. There is no assist level that means
    // "invulnerable", so a 0 here is a caller bug, and it takes the default.
    this.baseDamageMul =
      Number.isFinite(opts.baseDamageMul) && (opts.baseDamageMul as number) > 0
        ? (opts.baseDamageMul as number)
        : 1
    this.tactics = opts.tactics ?? { focus: 'first' }
    this.rng = new RNG(opts.seed)
    // Derived, not shared: cosmetic draws can never shift a combat roll.
    this.cosmeticRng = new RNG(hashSeed(opts.seed ?? 0, 'cosmetic'))

    const slotById = new Map(opts.map.slots.map((s) => [s.id, s]))
    let placeIndex = 0
    for (const { sentinel, slotId } of opts.placedSentinels) {
      const slot = slotById.get(slotId)!
      const profile = computeCombat(sentinel, { teamMods: this.teamMods, patienceMult: 1 })
      const rt: RtSentinel = {
        id: sentinel.id,
        def: sentinel,
        pos: { ...slot.pos },
        slotId,
        profile,
        cooldown: this.rng.range(0, 0.3),
        targetId: null,
        aimAngle: 0,
        fireFlash: 0,
        patienceTime: 0,
        patienceStacks: 0,
        // Gear "of Patience" counts toward the stack ceiling, not just the raw stat (H10).
        patienceMax: 3 + Math.floor(profile.patience / 5),
        blockIds: [],
        buffMult: 1,
        kills: 0,
        damageDealt: 0,
        procFlash: 0,
        // Stagger re-targeting deterministically so a big team never re-scores in one tick.
        retargetIn: (placeIndex % 4) * (RETARGET_INTERVAL / 4),
        shots: 0,
        rushUntil: 0,
        groundMult: tileDamageMult(opts.map, slotId),
      }
      placeIndex++
      this.sentinels.push(rt)
      // Traps are laid at wave start near the Sentinel's nearest path point.
      if (profile.mods.trap) {
        this.traps.push({
          id: nextId('t'),
          pos: this.nearestPathPoint(slot.pos),
          dps: profile.mods.trap.dps,
          slow: profile.mods.trap.slow,
          srcId: sentinel.id,
          damageType: profile.damageType,
        })
      }
    }

    /*
     * Sub-waves (Phase 3a). Group numbers are normalised to 0..n-1 in order, so
     * a wave whose groups skip a number still runs every group. With
     * `rules.subWaves` off, every group is laid end to end on ONE clock — the
     * counterfactual the harness prices the breathers against.
     */
    const groups = [...new Set(opts.wave.spawns.map((s) => s.group ?? 0))].sort((a, b) => a - b)
    const gIndex = new Map(groups.map((g, i) => [g, i]))
    const flat = !this.rules.subWaves && groups.length > 1
    let offset = 0
    const offsets: number[] = []
    if (flat) {
      for (const g of groups) {
        offsets.push(offset)
        const last = Math.max(...opts.wave.spawns.filter((s) => (s.group ?? 0) === g).map((s) => s.at))
        offset += last
      }
    }
    this.spawnQueue = opts.wave.spawns
      .map((s) => {
        const g = gIndex.get(s.group ?? 0)!
        return flat
          ? { typeId: s.typeId, at: s.at + offsets[g], hpMult: s.hpMult, g: 0 }
          : { typeId: s.typeId, at: s.at, hpMult: s.hpMult, g }
      })
      // Stable, and for a one-group wave exactly the old `a.at - b.at` order.
      .sort((a, b) => a.g - b.g || a.at - b.at)
    this.subWaveCount = flat ? 1 : Math.max(1, groups.length)
    // A team ward (a relic) is read off the team's mods once, not per hero.
    const team = mergeMods(this.teamMods)
    this.leakWardLeft = Math.max(0, Math.floor(team.leakWard ?? 0))
    // Burn spread is a granted capability (the Ember Urn relic), read the same way.
    this.spreadOnDeath = !!team.burnSpreadOnDeath
  }

  /** Leaks this wave the Gate still shrugs off (`EffectMods.leakWard`, Phase 3b). */
  private leakWardLeft = 0
  /** The team carries `burnSpreadOnDeath` (Phase 3a capability; the Ember Urn relic). */
  private spreadOnDeath = false

  private nearestPathPoint(p: Vec2): Vec2 {
    // Sample the path coarsely to find the closest point.
    let best = this.path.pointAt(0)
    let bestD = Infinity
    for (let d = 0; d <= this.path.length; d += 12) {
      const pt = this.path.pointAt(d)
      const dd = distSq(p, pt)
      if (dd < bestD) {
        bestD = dd
        best = pt
      }
    }
    return best
  }

  get enemiesAlive(): number {
    return this.enemies.length
  }

  step(dt: number): void {
    if (this.status !== 'running') return
    // Scripted inputs stamped with the tick just completed land first — the
    // same moment a live input between two frames lands.
    this.applyScript()
    if (this.breather) {
      if (this.breatherMode === 'pause') return
      this.resume()
    }
    this.tick++
    this.elapsed += dt
    for (const e of this.enemies) e.healed = 0

    this.spawnDue()
    this.updatePatience(dt)
    this.updateAuras()
    this.assignBlocking()
    this.updateBehaviours()
    this.updateSentinels(dt)
    this.updateEnemies(dt)
    this.updateProjectiles(dt)
    this.updateTraps(dt)
    // Everything a tick deferred — split pieces, boss halves, spread burns —
    // lands here, after every loop over `this.enemies` has finished. Adding a
    // body to the list mid-`updateEnemies` would be dropped by its
    // `this.enemies = survivors` (the F1 shape, from the other side).
    this.flushPending()
    this.refreshEnemyState()
    this.updateFloaters(dt)
    this.checkEnd()
  }

  // ------------------------------------------------------------ player inputs

  private applyScript(): void {
    while (this.scriptIndex < this.script.length && this.script[this.scriptIndex].tick <= this.tick) {
      const input = this.script[this.scriptIndex++]
      if (input.tick < this.tick) continue // stale — never re-time an input
      switch (input.kind) {
        case 'command':
          this.useCommand(input.id)
          break
        case 'move':
          this.moveHero(input.from, input.to)
          break
        case 'focus':
          this.setFocus(input.focus)
          break
        case 'resume':
          this.resume()
          break
      }
    }
  }

  /** Can a Watch Command fire right now? (The UI reads the same answer the engine gives.) */
  canUseCommand(id: CommandId): boolean {
    if (this.status !== 'running' || this.breather || !this.commandReady) return false
    if (!this.commands.includes(id)) return false
    // A Flare with nothing to aim at would spend the charge on the grass.
    if (id === 'flare' && this.enemies.length === 0) return false
    return true
  }

  /**
   * Fire a Watch Command. Returns whether it fired. One charge per sub-wave,
   * shared by every command the company carries; logged with its tick.
   */
  useCommand(id: CommandId): boolean {
    if (!this.canUseCommand(id)) return false
    this.commandReady = false
    this.inputLog.push({ tick: this.tick, kind: 'command', id })
    this.behaviourStats.commandsUsed++
    if (id === 'rally') {
      this.rallyUntil = this.elapsed + RALLY.dur
      for (const s of this.sentinels) this.spawnFloater(s.pos, 'RALLY', '#f5c542', false)
    } else if (id === 'flare') {
      // Auto-aimed at the front of the column (see `commands.ts`).
      let lead = this.enemies[0]
      for (const e of this.enemies) if (e.distance > lead.distance) lead = e
      const r2 = FLARE.radius * FLARE.radius
      for (const e of this.enemies) {
        if (distSq(e.pos, lead.pos) > r2) continue
        e.flareSlow = FLARE.slow
        e.flareUntil = this.elapsed + FLARE.dur
      }
      this.addTelegraph('flare', lead.pos.x, lead.pos.y, FLARE.radius, FLARE.dur)
    } else if (id === 'hold') {
      this.holdLeaks = HOLD.leaks
    }
    this.onEvent?.('command', { command: id })
    this.onEvent?.(`command:${id}`, { command: id })
    return true
  }

  /** Change the whole watch's targeting order mid-battle (logged). */
  setFocus(focus: FocusMode): void {
    if (this.status !== 'running' || this.tactics.focus === focus) return
    this.tactics = { ...this.tactics, focus }
    this.retargetDirty = true
    this.inputLog.push({ tick: this.tick, kind: 'focus', focus })
  }

  /** The sub-wave machine's state, for the HUD. */
  subWaveState(): SubWaveState {
    return { index: this.subWave, count: this.subWaveCount, breather: this.breather, moved: this.movedThisBreather }
  }

  /** Has the live sub-wave spawned every body it has? */
  subWaveSpawned(): boolean {
    return this.spawnIndex >= this.spawnQueue.length || this.spawnQueue[this.spawnIndex].g !== this.subWave
  }

  /** Which Sentinel stands on a slot (for the breather's move UI). */
  sentinelOnSlot(slotId: string): RtSentinel | undefined {
    return this.sentinels.find((s) => s.slotId === slotId)
  }

  /**
   * The breather's one reposition: move the hero on `from` to `to`, swapping
   * with whoever stands there. Only during a breather, once per breather.
   */
  moveHero(from: string, to: string): boolean {
    if (!this.breather || this.movedThisBreather || from === to) return false
    const slotTo = this.map.slots.find((s) => s.id === to)
    const a = this.sentinelOnSlot(from)
    if (!slotTo || !a) return false
    const b = this.sentinelOnSlot(to)
    const slotFrom = this.map.slots.find((s) => s.id === from)!
    this.placeAt(a, slotTo.id, slotTo.pos)
    if (b) this.placeAt(b, slotFrom.id, slotFrom.pos)
    this.movedThisBreather = true
    this.behaviourStats.repositions++
    this.inputLog.push({ tick: this.tick, kind: 'move', from, to })
    this.onEvent?.('reposition')
    return true
  }

  private placeAt(s: RtSentinel, slotId: string, pos: Vec2): void {
    s.slotId = slotId
    s.pos = { ...pos }
    // Q1: stepping onto (or off) cursed ground changes what it deals from now on.
    s.groundMult = tileDamageMult(this.map, slotId)
    s.targetId = null
    // Its trap is laid where it stands, so it moves with it.
    for (const t of this.traps) if (t.srcId === s.id) t.pos = this.nearestPathPoint(pos)
  }

  /** End the breather and start the next sub-wave. Logged; a no-op outside a breather. */
  resume(): void {
    if (!this.breather) return
    this.breather = false
    this.movedThisBreather = false
    this.groupStart = this.elapsed
    this.commandReady = true
    this.inputLog.push({ tick: this.tick, kind: 'resume' })
    this.onEvent?.('subwaveStart')
  }

  /**
   * A sub-wave is clear and another is queued: pause. Everything timed to the
   * sub-wave just fought — Rally Horn, Hold the Line, the markers on the field
   * — ends with it.
   */
  private enterBreather(): void {
    this.subWave++
    this.breather = true
    this.movedThisBreather = false
    this.behaviourStats.breathers++
    this.rallyUntil = 0
    this.holdLeaks = 0
    this.telegraphs = []
    for (const s of this.sentinels) s.targetId = null
    this.onEvent?.('subwave')
  }

  private addTelegraph(kind: TelegraphKind, x: number, y: number, r: number, dur: number, srcId?: string, x2?: number, y2?: number): void {
    this.telegraphs.push({ id: ++this.telegraphSeq, kind, x, y, r, t0: this.elapsed, t1: this.elapsed + dur, srcId, x2, y2 })
  }

  private spawnDue(): void {
    while (
      this.spawnIndex < this.spawnQueue.length &&
      this.spawnQueue[this.spawnIndex].g === this.subWave &&
      this.groupStart + this.spawnQueue[this.spawnIndex].at <= this.elapsed
    ) {
      const s = this.spawnQueue[this.spawnIndex]
      const type = ENEMY_TYPES[s.typeId]
      /*
       * A spawn naming a type this build has no entry for (F2).
       *
       * `runSnapshot.migrateSnapshot` is the real gate — it drops a stored wave
       * whose `typeId` the registry lacks, so nothing the boot path offers can
       * get here. This is the belt to that brace, and it earns its two lines:
       * the throw it replaces (`type.baseHp` on `undefined`) lands INSIDE the
       * rAF battle loop, where the error boundary's primary button is "Return
       * to last checkpoint" — which restores the same payload and throws again.
       * A crash that re-arms itself is worse than a wave one body short.
       *
       * Skipping keeps the wave finishable: `checkEnd` counts spawns actually
       * queued, so the encounter still resolves and still pays.
       */
      if (!type) {
        this.spawnIndex++
        continue
      }
      const maxHp = Math.round(type.baseHp * s.hpMult * this.enemyHpMult)
      this.enemies.push(this.makeEnemy(type, s.typeId, maxHp, 0, type.reward))
      this.retargetDirty = true // a new arrival may outrank everyone's current pick
      if (type.isBoss) this.onEvent?.('boss', { ...enemyTag(type), x: this.fieldX(this.enemies[this.enemies.length - 1].pos.x) })
      this.spawnIndex++
    }
  }

  /** One fresh runtime enemy. The single place an `RtEnemy` literal is written. */
  private makeEnemy(type: EnemyType, key: string, maxHp: number, distance: number, reward: number): RtEnemy {
    const lob = behaviourOf(type, 'lob')
    const heal = behaviourOf(type, 'healPulse')
    const king = behaviourOf(type, 'kingLob')
    return {
      id: nextId('en'),
      type,
      hp: maxHp,
      maxHp,
      distance,
      pos: this.path.pointAt(distance),
      hitFlash: 0,
      burnDps: 0,
      burnUntil: 0,
      burnSrcId: undefined,
      burnType: 'magic',
      chillSlow: 0,
      chillUntil: 0,
      stunUntil: 0,
      blockedBy: null,
      ...enemyBehaviourState(key, reward),
      lobCharges: lob?.charges ?? 0,
      kingNextAt: king ? this.elapsed + king.first : 0,
      // First pulse half an interval in, so a shaman does something before it
      // reaches the first tower rather than exactly one interval after spawning.
      healNextAt: heal ? this.elapsed + heal.interval / 2 : 0,
    }
  }

  private updatePatience(dt: number): void {
    for (const s of this.sentinels) {
      s.patienceTime += dt
      const stacks = Math.min(s.patienceMax, Math.floor(s.patienceTime / PATIENCE_INTERVAL))
      if (stacks !== s.patienceStacks) {
        s.patienceStacks = stacks
        s.profile = computeCombat(s.def, {
          teamMods: this.teamMods,
          patienceMult: 1 + stacks * PATIENCE_PER_STACK,
        })
      }
    }
  }

  /** Resolve damage-buff auras onto each Sentinel this step. */
  private updateAuras(): void {
    for (const s of this.sentinels) {
      let buff = 1
      for (const src of this.sentinels) {
        const m = src.profile.mods
        if (m.buffAura && dist(s.pos, src.pos) <= m.buffAura.radius) buff *= m.buffAura.damageMult
      }
      s.buffMult = buff
    }
  }

  /** Halt enemies inside blockers' radius (up to their capacity). */
  private assignBlocking(): void {
    for (const s of this.sentinels) s.blockIds = []
    for (const e of this.enemies) e.blockedBy = null
    for (const s of this.sentinels) {
      const block = s.profile.mods.block
      if (!block) continue
      const r2 = block.radius * block.radius
      const inRange = this.enemies
        .filter((e) => !e.blockedBy && e.leapOver !== s.id && distSq(s.pos, e.pos) <= r2)
        .sort((a, b) => b.distance - a.distance)
      // `slice(0, count)` as before, except that a leaper vaults instead of
      // being held and so does not use up a place in the hold.
      let held = 0
      for (const e of inRange) {
        if (held >= block.count) break
        if (this.rules.behaviours && !e.leapt) {
          const leap = behaviourOf(e.type, 'leap')
          if (leap) {
            this.vault(e, s, leap.distance)
            continue
          }
        }
        e.blockedBy = s.id
        s.blockIds.push(e.id)
        held++
      }
    }
  }

  /** The leaper's one vault over the blocker that tried to hold it. */
  private vault(e: RtEnemy, over: RtSentinel, distance: number): void {
    const from = e.pos
    e.leapt = true
    e.leapOver = over.id
    e.distance = Math.min(this.path.length, e.distance + distance)
    e.pos = this.path.pointAt(e.distance)
    this.behaviourStats.leaps++
    this.addTelegraph('leap', from.x, from.y, e.type.radius, 0.45, e.id, e.pos.x, e.pos.y)
    this.onEvent?.('behaviour:leap', this.tagOf(e))
  }

  // ---------------------------------------------------------- the behaviour kit

  /**
   * Resolve every enemy behaviour for this tick. Runs after blocking (a sapper
   * reads whether it is held) and before the Sentinels act (a disabled post
   * does not shoot this tick). Walks a SNAPSHOT: a sapper removes itself.
   */
  private updateBehaviours(): void {
    if (!this.rules.behaviours) return
    for (const e of this.enemies.slice()) {
      if (e.hp <= 0) continue
      const bs = e.type.behaviours
      if (!bs) continue
      for (const b of bs) {
        if (e.hp <= 0) break
        switch (b.kind) {
          case 'healPulse':
            if (this.elapsed >= e.healNextAt) {
              e.healNextAt += b.interval
              this.healPulse(e, b.radius, b.heal, b.interval)
            }
            break
          case 'enrage':
            if (!e.enraged && e.hp / e.maxHp < b.below) {
              e.enraged = true
              this.behaviourStats.enrages++
              this.spawnFloater(e.pos, 'ENRAGE', '#ff6b3d', true)
              this.onEvent?.('behaviour:enrage', this.tagOf(e))
            }
            break
          case 'sapper':
            // Held at the wall, it goes off there, harmlessly. Unheld, it walks
            // on to the Gate and blows there (`updateEnemies`, the leak branch).
            if (e.blockedBy) this.detonateHeld(e, b.radius, e.blockedBy)
            break
          case 'lob':
            this.updateLob(e, b)
            break
          case 'warCry':
            this.updateWarCry(e, b)
            break
          case 'kingLob':
            this.updateKingLob(e, b)
            break
          // 'split', 'bossSplit' resolve on damage/death; 'shieldAura' in
          // `refreshEnemyState`; 'leap' in `assignBlocking`.
        }
      }
    }
  }

  private healPulse(src: RtEnemy, radius: number, heal: number, interval: number): void {
    const r2 = radius * radius
    let healedAny = 0
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.hp >= e.maxHp || this.elapsed < e.healReadyAt) continue
      if (distSq(e.pos, src.pos) > r2) continue
      const amt = Math.min(e.maxHp - e.hp, e.maxHp * heal)
      e.hp += amt
      e.healed += amt
      // Pulses do not stack: one heal per body per interval, whoever casts it.
      e.healReadyAt = this.elapsed + interval
      healedAny += amt
    }
    this.behaviourStats.healPulses++
    this.behaviourStats.hpHealed += healedAny
    this.addTelegraph('heal', src.pos.x, src.pos.y, radius, 0.6, src.id)
    if (healedAny > 0) this.onEvent?.('behaviour:healPulse', this.tagOf(src))
  }

  /**
   * A sapper held by a blocker goes off at the wall: it hurts nobody, and it
   * counts as that hero's kill — bounty and XP. Holding it is the answer; one
   * that is never held walks on and blows at the Gate (see `updateEnemies`).
   */
  private detonateHeld(e: RtEnemy, radius: number, blocker: string): void {
    this.behaviourStats.sapperBlasts++
    this.behaviourStats.sapperHeld++
    this.addTelegraph('blast', e.pos.x, e.pos.y, radius, 0.5, e.id)
    this.spawnFloater(e.pos, 'BOOM', '#ff9f43', true)
    this.onEvent?.('behaviour:sapper', this.tagOf(e))
    e.hp = 0
    this.killEnemy(e, blocker)
  }

  /**
   * Blast damage to the Gate (a bomber's charge, the King's TNT). It is Gate
   * damage like a leak — booked into `leaks`, so the receipt still reconciles —
   * but it is not a head through the line.
   */
  /**
   * Where a charge aimed at the Gate is drawn: on the road just short of it.
   * The Gate itself sits on the field's edge, so a mark centred on it was half
   * off the canvas and read as nothing (seen on the phone capture).
   */
  private gateMark(): Vec2 {
    return this.path.pointAt(Math.max(0, this.path.length - GATE_MARK_INSET))
  }

  private blastGate(amount: number): number {
    const dmg = amount * this.baseDamageMul
    this.baseHp -= dmg
    this.leaks += dmg
    this.behaviourStats.gateDamage += dmg
    return dmg
  }

  private dropTelegraphsOf(id: string): void {
    this.telegraphs = this.telegraphs.filter((t) => t.srcId !== id || (t.kind !== 'lob' && t.kind !== 'kingLob'))
  }

  /**
   * A bomber within `range` of the Gate (measured along the road) plants its
   * feet and winds up a charge at the Gate; when it lands the Gate takes
   * `gateDamage`. Killing it in the wind-up cancels the throw. One charge in
   * the air at a time: a bomber that finds a live mark walks on.
   */
  private updateLob(e: RtEnemy, b: Behaviour<'lob'>): void {
    if (e.lobUntil > 0) {
      if (this.elapsed < e.lobUntil) return
      e.lobUntil = 0
      e.lobCharges--
      const dealt = this.blastGate(b.gateDamage)
      this.behaviourStats.lobsLanded++
      this.behaviourStats.lobDamage += dealt
      this.addTelegraph('blast', e.lobX, e.lobY, b.radius, 0.45)
      this.spawnFloater({ x: e.lobX, y: e.lobY }, 'BOOM', '#ff9f43', true)
      this.onEvent?.('behaviour:lob', this.tagOf(e))
      return
    }
    if (e.lobCharges <= 0 || e.blockedBy) return
    if (this.path.length - e.distance > b.range) return
    if (this.telegraphs.some((t) => t.kind === 'lob' || t.kind === 'kingLob')) return
    e.lobUntil = this.elapsed + b.windup
    const at = this.gateMark()
    e.lobX = at.x
    e.lobY = at.y
    this.behaviourStats.lobsStarted++
    this.addTelegraph('lob', e.lobX, e.lobY, b.radius, b.windup, e.id, e.pos.x, e.pos.y)
    this.onEvent?.('behaviour:lobWindup', this.tagOf(e))
  }

  private updateWarCry(e: RtEnemy, b: Behaviour<'warCry'>): void {
    if (e.warCryUntil > 0) {
      if (this.elapsed < e.warCryUntil) return
      e.warCryUntil = 0
      const r2 = b.radius * b.radius
      let n = 0
      for (const a of this.enemies) {
        if (a.hp <= 0 || distSq(a.pos, e.pos) > r2) continue
        a.hasteMult = b.speedMult
        a.hasteUntil = this.elapsed + b.dur
        n++
      }
      this.behaviourStats.warCries++
      this.behaviourStats.hasteApplied += n
      this.spawnFloater(e.pos, 'WAR-CRY', '#ff5d5d', true)
      this.onEvent?.('behaviour:warCry', this.tagOf(e))
      return
    }
    const next = b.at[e.phase]
    if (next === undefined || e.hp / e.maxHp > next) return
    e.phase++
    e.warCryUntil = this.elapsed + b.windup
    this.bossPhase(e)
    this.addTelegraph('warcry', e.pos.x, e.pos.y, b.radius, b.windup, e.id)
  }

  /**
   * The Powderkeg King throws TNT at the Gate on a clock, from wherever he is:
   * a wind-up, then `gateDamage` to the Gate. Below `rageAt` of his health the
   * clock runs faster. The answer is to race him down.
   */
  private updateKingLob(e: RtEnemy, b: Behaviour<'kingLob'>): void {
    if (e.phase === 0 && e.hp / e.maxHp <= b.rageAt) {
      e.phase = 1
      this.bossPhase(e)
      this.spawnFloater(e.pos, 'ENRAGED', '#ff5d5d', true)
      // The next throw comes on the rage clock, not the calm one.
      if (e.kingUntil === 0) e.kingNextAt = Math.min(e.kingNextAt, this.elapsed + b.rageInterval)
    }
    if (e.kingUntil > 0) {
      if (this.elapsed < e.kingUntil) return
      e.kingUntil = 0
      const dealt = this.blastGate(b.gateDamage)
      this.behaviourStats.kingLobs++
      this.behaviourStats.kingDamage += dealt
      this.addTelegraph('blast', e.kingX, e.kingY, b.radius, 0.5)
      this.spawnFloater({ x: e.kingX, y: e.kingY }, 'BOOM', '#ff9f43', true)
      this.onEvent?.('behaviour:kingLob', this.tagOf(e))
      return
    }
    if (this.elapsed < e.kingNextAt) return
    e.kingUntil = this.elapsed + b.windup
    const at = this.gateMark()
    e.kingX = at.x
    e.kingY = at.y
    e.kingNextAt = this.elapsed + (e.phase > 0 ? b.rageInterval : b.interval)
    this.addTelegraph('kingLob', e.kingX, e.kingY, b.radius, b.windup, e.id, e.pos.x, e.pos.y)
    this.onEvent?.('behaviour:kingLobWindup', this.tagOf(e))
  }

  private bossPhase(e: RtEnemy): void {
    this.behaviourStats.bossPhases++
    this.addTelegraph('phase', e.pos.x, e.pos.y, e.type.radius * 2.2, 0.7, e.id)
    this.onEvent?.('bossPhase', { ...this.tagOf(e), phase: e.phase })
  }

  private updateSentinels(dt: number): void {
    for (const s of this.sentinels) {
      if (s.cooldown > 0) s.cooldown -= dt
      if (s.fireFlash > 0) s.fireFlash = Math.max(0, s.fireFlash - dt * 5)
      if (s.procFlash > 0) s.procFlash = Math.max(0, s.procFlash - dt * 3)

      const rangeSq = s.profile.range * s.profile.range
      s.retargetIn -= dt
      const target0 = s.targetId ? this.enemies.find((e) => e.id === s.targetId) : undefined
      // A target is stale when it died or left range; otherwise we still
      // re-score on a cadence (and on any spawn)
      // so lowestHp/nearest/strongest actually steer the fight, not just the
      // moment of acquisition (H4).
      const stale = !target0 || distSq(s.pos, target0.pos) > rangeSq
      let target = target0
      if (stale || this.retargetDirty || s.retargetIn <= 0) {
        target = this.acquireTarget(s, rangeSq)
        s.targetId = target?.id ?? null
        s.retargetIn = RETARGET_INTERVAL
      }
      if (target) {
        s.aimAngle = Math.atan2(target.pos.y - s.pos.y, target.pos.x - s.pos.x)
        if (s.cooldown <= 0) this.fire(s, target)
      }

      // Heroes are never hurt: what a blocker holds simply stands still and
      // grinds on its thorns.
      if (s.blockIds.length > 0) {
        let grinding = false
        for (const id of s.blockIds) {
          const e = this.enemies.find((x) => x.id === id)
          if (!e) continue
          grinding = true
          if (s.profile.thorns > 0) this.damageEnemy(e, s.profile.thorns * dt, s.id, false, s.profile.damageType, true)
          if (e.hp > 0) this.igniteFromThorns(s, e)
        }
        if (grinding) this.onEvent?.('melee', { arch: s.def.archetype, x: this.fieldX(s.pos.x) })
      }
    }
    this.retargetDirty = false
  }

  /**
   * How urgently the 'threat' order wants this enemy dead, 0–4. A bomber or the
   * King mid-wind-up first (killing it cancels the throw), then the casters
   * whose value is to OTHER goblins, then an unspent sapper, then anything else
   * with a behaviour. Plain walkers score 0 and fall back to first-in-lane.
   */
  static threatRank(e: RtEnemy): number {
    if (e.lobUntil > 0 || e.kingUntil > 0) return 4
    const bs = e.type.behaviours
    if (!bs) return 0
    let r = 1
    for (const b of bs) {
      if (b.kind === 'healPulse' || b.kind === 'shieldAura') r = Math.max(r, 3)
      else if (b.kind === 'sapper' || (b.kind === 'lob' && e.lobCharges > 0)) r = Math.max(r, 2)
    }
    return r
  }

  /** Score an in-range enemy per the active focus tactic (higher = preferred). */
  private focusScore(s: RtSentinel, e: RtEnemy): number {
    switch (this.tactics.focus) {
      case 'threat':
        // Rank dominates; distance down the lane breaks ties (≤ ~2300 px).
        return GameEngine.threatRank(e) * 1e5 + e.distance
      case 'lowestHp':
        return -e.hp
      case 'strongest':
        return e.maxHp
      case 'nearest':
        return -distSq(s.pos, e.pos)
      case 'first':
      default:
        return e.distance
    }
  }

  private acquireTarget(s: RtSentinel, rangeSq: number): RtEnemy | undefined {
    let best: RtEnemy | undefined
    let bestScore = -Infinity
    for (const e of this.enemies) {
      if (distSq(s.pos, e.pos) > rangeSq) continue
      const score = this.focusScore(s, e)
      if (!best || score > bestScore) {
        best = e
        bestScore = score
      }
    }
    return best
  }

  private fire(s: RtSentinel, target: RtEnemy): void {
    const m = s.profile.mods
    s.shots++
    // ---- rule capabilities (Phase 3b) — each is inert unless granted ------
    // A rush multiplies the rate of THIS shot's reload; nothing else moves.
    let rate = s.profile.rate
    if (m.openingRush && this.elapsed < m.openingRush.dur) rate *= 1 + m.openingRush.rate
    if (m.killRush && this.elapsed < s.rushUntil) rate *= 1 + m.killRush.rate
    // Rally Horn (Phase 3a) is an attack-SPEED buff: it shortens this reload and nothing else.
    if (this.elapsed < this.rallyUntil) rate *= RALLY.rateMult
    s.cooldown = 1 / rate
    s.fireFlash = 1
    this.onEvent?.('shoot', { arch: s.def.archetype, x: this.fieldX(s.pos.x) })
    // The crit roll is ALWAYS drawn, so a cadence crit never shifts the combat
    // stream for anything that fires after it.
    const rolled = this.rng.chance(s.profile.critChance)
    const isCrit = rolled || (!!m.critEvery && s.shots % m.critEvery === 0)
    const damage = s.profile.damage * (isCrit ? s.profile.critMult : 1) * s.buffMult
    const volley = m.volley && s.shots % m.volley.every === 0 ? m.volley.pierce : 0
    this.projectiles.push({
      id: nextId('p'),
      pos: { ...s.pos },
      toPos: { ...target.pos },
      targetId: target.id,
      srcId: s.id,
      damage,
      damageType: s.profile.damageType,
      isCrit,
      speed: s.profile.projectileSpeed,
      splashRadius: s.profile.splashRadius,
      pierce: (s.profile.mods.pierce ?? 0) + volley,
      color: s.def.accent,
      mods: s.profile.mods,
      lifedrain: s.profile.mods.lifedrain ?? 0,
    })
  }

  /**
   * ---- walk a SNAPSHOT, never the live list (F1) ---------------------------
   *
   * `damageEnemy → killEnemy` splices `this.enemies`, and this loop used to be a
   * `for..of` over that same array. Every burn kill therefore advanced the
   * iterator past the body standing behind the one that died — that body was
   * never pushed to `survivors`, and `this.enemies = survivors` then deleted it.
   *
   * It did not die and it did not leak: it EVAPORATED. No kill credit, no gold,
   * no XP, no corpse — and, when it had already walked past the line, no leak
   * damage either, which is a hit the base simply never took. Measured across
   * 720 real waves: 17.2% of waves lost at least one body.
   *
   * Iterating a copy costs one array per tick and makes the loop's contract the
   * obvious one: every enemy that was alive at the top of the tick is either
   * killed, leaked, or carried forward — exactly once.
   */
  private updateEnemies(dt: number): void {
    const survivors: RtEnemy[] = []
    for (const e of this.enemies.slice()) {
      // Already removed by something earlier in this same tick.
      if (e.hp <= 0) continue
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt * 4)

      // Burn DoT — credited to whoever lit it, and typed by their damage type,
      // so burn builds earn XP (H3) and physical burns aren't magic-resisted (M25).
      if (e.burnDps > 0) {
        if (this.elapsed < e.burnUntil) {
          this.damageEnemy(e, e.burnDps * dt, e.burnSrcId, false, e.burnType, true)
          if (e.hp <= 0) continue
        } else {
          // Expired: drop the stack rather than leave it standing (m-3). Nothing
          // else reads it while it is lapsed, but leaving it set is what let a
          // later, weaker burn inherit this one's dps.
          e.burnDps = 0
          e.burnSrcId = undefined
        }
      }

      const stunned = this.elapsed < e.stunUntil
      const chill = this.elapsed < e.chillUntil ? e.chillSlow : 0
      // A bomber plants its feet to throw — that stillness IS the window.
      const planted = e.lobUntil > 0
      if (!stunned && !e.blockedBy && !planted) {
        e.distance += e.type.speed * (1 - chill) * this.paceMult(e) * dt
      }

      if (e.distance >= this.path.length) {
        // The assist dial lands here and nowhere else (M34): what gets through
        // still gets through, and the wave, the loot and the marks are the same
        // ones — only the bite the line takes is smaller. `leaks` is the number
        // the summary prints next to "left", so it reports the damage ACTUALLY
        // taken; reporting the un-assisted figure would make the receipt lie.
        // The head count is tracked separately from the damage, because they are
        // different numbers and two readouts printed one as the other (F3).
        this.leakCount++
        if (e.piece) this.behaviourStats.splitLeaks++
        if (e.enraged) this.behaviourStats.enragedLeaks++
        if (e.leapt) this.behaviourStats.leapLeaks++
        if (this.holdLeaks > 0) {
          // Hold the Line (a Watch Command, Phase 3a): it reached the Gate and
          // the Gate held. It still counts as having got through, and costs nothing.
          this.holdLeaks--
          this.behaviourStats.holdBlocked++
          this.onEvent?.('hold', { ...enemyTag(e.type), x: this.fieldX(e.pos.x) })
          continue
        }
        // Phase 3b: a team ward turns the first leaks of the wave aside. The
        // body still reached the line — it counts — it just costs the Gate nothing.
        const warded = this.leakWardLeft > 0
        if (warded) this.leakWardLeft--
        // A sapper that reaches the Gate blows there: its blast is extra Gate
        // damage on top of its leak (a ward turns both aside).
        const sapper = this.rules.behaviours ? behaviourOf(e.type, 'sapper') : undefined
        const blast = sapper && !warded ? sapper.gateDamage * this.baseDamageMul : 0
        const dmg = (warded ? 0 : e.type.leak * this.baseDamageMul) + blast
        this.baseHp -= dmg
        this.leaks += dmg
        if (sapper) {
          this.behaviourStats.sapperBlasts++
          this.behaviourStats.sapperDamage += blast
          this.behaviourStats.gateDamage += blast
          const at = this.gateMark()
          this.addTelegraph('blast', at.x, at.y, sapper.radius, 0.5)
          this.spawnFloater(at, 'BOOM', '#ff9f43', true)
          this.onEvent?.('behaviour:sapper', this.tagOf(e))
        }
        this.onEvent?.('leak', { ...enemyTag(e.type), x: this.fieldX(e.pos.x) })
        continue
      }
      e.pos = this.path.pointAt(e.distance)
      survivors.push(e)
    }
    this.enemies = survivors
  }

  /**
   * Every multiplier on an enemy's walking pace except chill (which the old
   * line already applied): Flare, the berserker's rage, Grukk's war-cry. 1 for
   * a plain walker, so the pre-3a arithmetic is `speed * (1 - chill) * 1`.
   */
  private paceMult(e: RtEnemy): number {
    let m = 1
    if (this.elapsed < e.flareUntil) m *= 1 - e.flareSlow
    if (e.enraged) m *= behaviourOf(e.type, 'enrage')?.speedMult ?? 1
    if (this.elapsed < e.hasteUntil) m *= e.hasteMult
    return m
  }

  private updateProjectiles(dt: number): void {
    const alive: RtProjectile[] = []
    for (const p of this.projectiles) {
      const target = p.targetId ? this.enemies.find((e) => e.id === p.targetId) : undefined
      if (target) p.toPos = target.pos
      const { pos, arrived } = moveToward(p.pos, p.toPos, p.speed * dt)
      p.pos = pos
      if (arrived) {
        this.impact(p, target)
        continue
      }
      alive.push(p)
    }
    this.projectiles = alive
  }

  /**
   * How far a pierce splinter reaches from the impact point (L9b).
   *
   * Pierce is modelled as a splinter rather than a swept line, and it applies
   * even when the primary died mid-flight — a piercing shot is never wasted,
   * which is exactly what the enchant promises.
   */
  private static readonly PIERCE_RADIUS = 60

  /**
   * Resolve an impact into the set of enemies it touches.
   *
   * ---- splash and pierce COMPOSE; neither cancels the other (F10) ----------
   *
   * This used to be `if (splash) {...} else { primary; if (pierce) {...} }`, so
   * `p.pierce` was unreachable the instant a Sentinel carried any splash at all
   * — and every body item rolls `splashAdd` (9–16px at COMMON, and the fresh
   * player's starting kit contains a common body). The practical result was that
   * pierce did nothing for essentially every hero in every real run: the whole
   * Marksman branch, the `piercing` enchant and the Piercing Volley mutation
   * were all switched off by ordinary armour, while `describeMods` went on
   * printing "pierces N extra enemies" and the body advertised its splash as
   * pure upside. A build that a piece of gear silently deletes is the
   * unwinnable-combination trap this project's doctrine forbids, and it is
   * worse than dead copy because the player is told the opposite.
   *
   * The rule now: the impact touches the blast, and then the shot punches on
   * through up to `pierce` MORE enemies it has not already hit. Each mechanic
   * keeps exactly the semantics it had on its own — the blast is still
   * everything within `splashRadius`, pierce is still up to N within the
   * splinter radius — so a single-target weapon's hit list is byte-identical to
   * before, and no shot ever hits the same enemy twice. A blast wider than the
   * splinter naturally leaves pierce nothing to add, which is correct rather
   * than a loss: splash already damages every one of those targets in full.
   */
  private impact(p: RtProjectile, primary: RtEnemy | undefined): void {
    const hitList: RtEnemy[] = []
    if (p.splashRadius > 0) {
      const r2 = p.splashRadius * p.splashRadius
      // Single pass over a list with no duplicates, so no dedupe is needed here.
      for (const e of this.enemies) if (distSq(e.pos, p.pos) <= r2) hitList.push(e)
    } else if (primary) {
      hitList.push(primary)
    }
    if (p.pierce > 0) {
      const already = new Set(hitList)
      const r2 = GameEngine.PIERCE_RADIUS * GameEngine.PIERCE_RADIUS
      // Same order and same cutoff the `filter(...).slice(0, pierce)` above had,
      // so a no-splash shot resolves to the identical hit list it always did.
      for (const e of this.enemies) {
        if (hitList.length >= already.size + p.pierce) break
        if (e === primary || already.has(e)) continue
        if (distSq(e.pos, p.pos) <= r2) hitList.push(e)
      }
    }

    /*
     * The most frequent meaningful event in the game, and it made no sound at
     * all (H17): `gameSfx` has handled `'hit'` all along and nothing ever
     * emitted it, so every projectile impact in every wave was silent.
     *
     * ONE event per impact, not one per enemy touched — a splash that lands on
     * six enemies is one impact and should sound like one, or a wide blast
     * turns into a burst of six identical clicks.
     *
     * Crits are their own event rather than a louder `'hit'`. The roll already
     * exists on the projectile (`p.isCrit`, decided in `fire()` from the combat
     * stream), so this costs nothing and gives the mix a channel it was
     * throwing away: a crit that sounds identical to a normal hit tells the
     * player nothing.
     *
     * A shot that arrives with nothing to hit (its target died mid-flight, no
     * splash, no pierce) stays silent, which is correct — nothing was struck.
     */
    if (hitList.length > 0) this.onEvent?.(p.isCrit ? 'crit' : 'hit', this.hitPayload(p))

    // Frost standing BEFORE this shot lands — a shock shot's own chill (if it
    // carries one) must not shatter the body it is chilling in the same hit.
    const frostedBefore =
      p.mods.shock && this.rules.interactions ? new Set(this.enemies.filter((e) => this.elapsed < e.frostUntil)) : null

    for (const e of hitList) this.applyHit(e, p)

    // Chain lightning: arc to nearby enemies for a fraction of the hit.
    if (p.mods.shock && hitList.length > 0) {
      const origin = hitList[0]
      const chained = this.enemies
        .filter((e) => !hitList.includes(e))
        .sort((a, b) => distSq(origin.pos, a.pos) - distSq(origin.pos, b.pos))
        .slice(0, p.mods.shock.chains)
      const src = this.sentinels.find((x) => x.id === p.srcId)
      if (src) src.procFlash = 1
      for (const e of chained) {
        this.damageEnemy(e, p.damage * p.mods.shock.dmgFrac, p.srcId, false, p.damageType, false)
      }
      // SHATTER (Phase 3a): lightning meeting ice. Every body this shot touched
      // — struck or arced to — that is frost-chilled bursts for a share of the
      // hit, and is thawed by it, so one frost application buys one shatter.
      if (frostedBefore && frostedBefore.size) {
        for (const e of [...hitList, ...chained]) {
          if (e.hp <= 0 || !frostedBefore.has(e) || this.elapsed >= e.frostUntil) continue
          e.frostUntil = 0
          const burst = this.damageEnemy(e, p.damage * SHATTER_FRAC, p.srcId, false, p.damageType, true)
          this.behaviourStats.shatters++
          this.behaviourStats.shatterDamage += burst
          this.addTelegraph('shatter', e.pos.x, e.pos.y, e.type.radius + 10, 0.35)
          this.spawnFloater(e.pos, 'SHATTER', '#bfe6ff', true)
          this.onEvent?.('shatter', this.tagOf(e))
        }
      }
    }
  }

  private applyHit(e: RtEnemy, p: RtProjectile): void {
    /*
     * ---- execute does not go through `damageEnemy`, so no resist applies ----
     *
     * Raised as a possible skeleton key: an Executioner would be a free answer
     * to the 55%-plated columns the Phase-3 elites are built around, because
     * the last `execute` share of every body is removed rather than ground
     * through the armour. INTENDED, and measured, for two reasons:
     *
     *  1. **Arithmetically it is not differential.** Removing a body of `maxHp`
     *     H at resistance r costs H/(1−r) damage; with an execute threshold x it
     *     costs H(1−x)/(1−r). The ratio is (1−x) — independent of r. Execute
     *     saves the same FRACTION of the grind at 0% resist as at 55%. The
     *     absolute saving is larger against armour only because the whole fight
     *     is larger against armour, which is what armour is for.
     *
     *  2. **Measured, it is smaller against plate, not larger.** One 18-body
     *     column at ×6 HP, one physical 3-tower line, execute 0.28 (Reaper, the
     *     largest threshold on the tree), mean clear time with vs without:
     *
     *       barrel4_warded    0% phys resist   34.30s → 31.01s   −9.6%
     *       barrel4_swift    15%               35.62s → 28.61s  −19.7%
     *       barrel4          30%               44.06s → 35.76s  −18.8%
     *       barrel4_plated   55%               50.90s → 48.48s   −4.7%
     *
     *     The plated column gains the LEAST from an execute build, because a
     *     modifier that also slows the column (`plated` is speedMult 0.9) puts
     *     more of the clear into walking time, which no threshold shortens.
     *
     * The mechanic is a threshold, not a damage source: there is no damage for a
     * resistance to multiply. Making it resist-aware would mean inventing a rule
     * ("armour resists being removed") that the card could not state. Left as
     * is, written down here so the next reader does not have to re-derive it.
     */
    if (p.mods.execute && e.hp / e.maxHp <= p.mods.execute) {
      this.spawnFloater(e.pos, 'EXECUTE', '#ff5d5d', true)
      const src = this.sentinels.find((x) => x.id === p.srcId)
      if (src) {
        src.procFlash = 1
        // Book the executed remainder, or per-Sentinel damage under-reports every
        // execute the build lands (L9).
        src.damageDealt += Math.max(0, e.hp)
      }
      this.killEnemy(e, p.srcId)
      return
    }
    const dealt = this.damageEnemy(e, p.damage, p.srcId, p.isCrit, p.damageType, false)

    // On-hit statuses (only if the enemy is still alive).
    if (e.hp > 0) {
      const src = p.srcId ? this.sentinels.find((x) => x.id === p.srcId) : undefined
      if (p.mods.burn) {
        if (this.writeBurn(e, p.mods.burn, p.srcId, p.damageType) && src) src.procFlash = 1
      }
      if (p.mods.chill) {
        e.chillSlow = Math.max(e.chillSlow, p.mods.chill.slow)
        e.chillUntil = Math.max(e.chillUntil, this.elapsed + p.mods.chill.dur)
        // Frost — the only chill brittle and shatter answer to (see BRITTLE_MULT).
        e.frostUntil = Math.max(e.frostUntil, this.elapsed + p.mods.chill.dur)
      }
      if (p.mods.stunChance && this.rng.chance(p.mods.stunChance)) {
        e.stunUntil = Math.max(e.stunUntil, this.elapsed + (p.mods.stunDur ?? 0.5))
        this.spawnFloater(e.pos, 'STUN', '#ffe08a', true)
        if (src) src.procFlash = 1
      }
    }

    /*
     * Life-drain heals the base (see LIFEDRAIN_SCALE — describe.ts quotes the
     * same number).
     *
     * On the damage ACTUALLY DEALT, not the damage rolled. This used to read
     * `p.damage`, the pre-resist figure, while the card says "per 100 damage
     * dealt" and `damageEnemy` uses `applied` — the post-resist, non-overkilled
     * amount — for every other meaning of that phrase, including the per-Sentinel
     * `damageDealt` on the run summary. Two definitions of "damage dealt" in one
     * engine, and the tooltip quoted the one the code did not use: a shot that
     * scratched a 55%-plated column for 45 healed as if it had hit for 100.
     */
    if (p.lifedrain > 0 && this.baseHp < this.maxBaseHp) {
      this.baseHp = Math.min(this.maxBaseHp, this.baseHp + dealt * p.lifedrain * LIFEDRAIN_SCALE)
    }
  }

  /**
   * Write a burn onto an enemy, and report whether it is a FRESH ignition.
   *
   * The strongest burn owns the stack — including its owner and damage type, so
   * the credit and the resist both follow the real source.
   *
   * An EXPIRED burn owns nothing (m-3). `burnDps` was never reset on expiry, so
   * a weak burn re-igniting a lapsed stronger one inherited the strong dps
   * through the `Math.max` while stamping its own srcId and damage type —
   * over-damaging, crediting the wrong Sentinel and applying the wrong resist. A
   * fresh burn is written outright, not maxed.
   *
   * Extracted so the two things that can light an enemy — a projectile impact
   * and a {@link igniteFromThorns} grind — write the stack the same way rather
   * than through two copies of this rule.
   */
  private writeBurn(
    e: RtEnemy,
    burn: { dps: number; dur: number },
    srcId: string | undefined,
    type: 'physical' | 'magic',
  ): boolean {
    const fresh = this.elapsed >= e.burnUntil
    if (fresh || burn.dps >= e.burnDps) {
      e.burnDps = burn.dps
      e.burnSrcId = srcId
      e.burnType = type
    }
    e.burnUntil = Math.max(e.burnUntil, this.elapsed + burn.dur)
    return fresh
  }

  /**
   * ---- thorns that burn (C2) -----------------------------------------------
   *
   * `Warden of Ash` is a level-20, irreversible pick whose whole card is
   * *"Everything it holds burns on its thorns."* It could not do that. Thorns go
   * through {@link damageEnemy}, which applies resist and books kill credit and
   * writes **no statuses**; burn was written only in {@link applyHit}, reachable
   * only from {@link impact}, i.e. only from a projectile. And a Fighter fires
   * one projectile at one target with `splashRadius 0` and `pierce 0` while burn
   * does not stack, so of the four enemies the Warden holds, at most **one** was
   * ever lit — never four, and never by the thorns.
   *
   * The mechanic is what moved, not the card. `thornsIgnite` makes the grind a
   * strike for the purposes of one status: whatever burn this Sentinel carries
   * is applied to everything it is holding, every tick it is holding it.
   *
   * **What it is worth, measured, because a fix nobody priced is the defect one
   * layer down.** Held bodies actually alight, mean over the hold, Warden of Ash
   * with Epic gear:
   *
   *   bench                        held   burning BEFORE   burning AFTER
   *   20 Siege Barrels, ×10, gap 4  2.44       2.44 (100%)     2.44 (100%)
   *   24 Siege Barrels, ×8, gap 0.4 3.65       3.09  (85%)     3.65 (100%)
   *   24 Plated, ×8, gap 0.4        3.48       3.22  (93%)     3.48 (100%)
   *   60 Torch Berserkers, ×14      3.63       2.29  (63%)     3.63 (100%)
   *
   * Solo stop rate moves by **+0.0pt** on all four and by at most **+1.7pt**
   * anywhere on a six-rung siege ladder, because the burn is 26/s against thorns
   * of 144/s — 18% of what the same body is already taking. So this is a
   * correctness fix, not a re-cost, and it is worth saying why the gap was
   * smaller than it looks: the Warden *shoots while it blocks*, `RETARGET_INTERVAL`
   * re-scores every 0.45s, and a 3s burn outlives several shots, so the projectile
   * path was incidentally lighting most of the queue anyway. What it could not do
   * is light **all** of it, and it was never the thorns doing it.
   *
   * **Why the flag, rather than "every blocker's thorns apply its burn".** The
   * universal rule is the more elegant sentence and it was measured before this
   * one was written. It fails for a reason that has nothing to do with the
   * Warden: `block` starts on the **tier-0 Fighter** (`count: 2`), so every
   * fighter in the game blocks — including the Weaponmaster §8 grades every
   * mutation on. Under the universal rule the Incendiary mutation (burn 180/s)
   * lights both bodies that Weaponmaster holds, continuously and for free, and
   * §8's row for it goes
   *
   *   swarm −7.8 → **+52.2**,  armour +12.5 → +33.3,  line +23.0 → +39.2 pt
   *
   * — which deletes Incendiary's only measurable cost and turns a priced
   * tradeoff into the largest pure upside in the table. That is a re-costing of
   * the Mythic tier smuggled in as a fix to one tier-2 node.
   *
   * So the capability is real and reusable — any node, affix or mutation may
   * declare it — but it is *declared*, and today exactly one node declares it.
   *
   * Chill and stun deliberately do NOT ride along. A blocked enemy is already
   * stopped, so chill on it is nearly inert; and a stun stops it swinging, so a
   * blocker that stun-locked what it holds would take no melee at all — which is
   * the same "a tower is damageable only while blocking" loophole the Guard line
   * was rebuilt to close (see `archetypeTree.ts`).
   */
  private igniteFromThorns(s: RtSentinel, e: RtEnemy): void {
    const burn = s.profile.mods.burn
    if (!s.profile.mods.thornsIgnite || !burn) return
    if (this.writeBurn(e, burn, s.id, s.profile.damageType)) s.procFlash = 1
  }

  /**
   * Apply damage, and return what was ACTUALLY dealt — post-resist, capped at
   * the target's remaining HP. That figure is what `damageDealt` books and what
   * the run summary prints, so anything else scaling off "damage dealt" (life
   * drain) reads it here rather than re-deriving its own.
   */
  private damageEnemy(
    e: RtEnemy,
    amount: number,
    srcId: string | undefined,
    isCrit: boolean,
    type: 'physical' | 'magic',
    quiet: boolean,
  ): number {
    // `takenMult` is resist, the shield-bearer's aura and brittle in one number,
    // and it is the SAME function the tick differ re-runs (see its note).
    // Q1: a hero on cursed ground deals less — ALL of its damage (shots,
    // splash, the burns it lit, its traps, thorns), read where it stands NOW.
    const src = srcId ? this.sentinels.find((x) => x.id === srcId) : undefined
    if (src && src.groundMult !== 1) amount *= src.groundMult
    const mult = takenMult(e, type)
    const dealt = amount * mult
    const applied = Math.min(e.hp, dealt)
    if (e.shield > 0 || e.brittle) this.bookModifiers(e, amount, type, applied)
    e.hp -= dealt
    e.hitFlash = 1
    if (src) src.damageDealt += applied
    if (!quiet) {
      this.spawnFloater(e.pos, Math.round(dealt).toString(), isCrit ? '#ffd166' : '#ffffff', isCrit)
    }
    if (e.hp <= 0) this.killEnemy(e, srcId)
    else if (this.rules.behaviours && e.phase === 0) this.maybeBossSplit(e)
    return applied
  }

  /**
   * Book what the shield took off and what brittle added, for the harness
   * (§16). Pure accounting: it reads the hit, it never changes it.
   */
  private bookModifiers(e: RtEnemy, amount: number, type: 'physical' | 'magic', applied: number): void {
    const plain = amount * takenMult({ type: e.type, shield: 0, brittle: e.brittle }, type)
    if (e.shield > 0) this.behaviourStats.shieldedPrevented += Math.max(0, Math.min(e.hp, plain) - applied)
    if (e.brittle && type === 'physical') this.behaviourStats.brittleBonus += applied - applied / BRITTLE_MULT
  }

  /**
   * The Colossus Keg breaks in two at half health. The body that was hit
   * BECOMES the first half (so no loop that is holding a reference to it ever
   * sees it vanish), and the others are queued behind it — added to the field
   * at the end of the tick with everything else a tick defers.
   */
  private maybeBossSplit(e: RtEnemy): void {
    const b = behaviourOf(e.type, 'bossSplit')
    if (!b || e.hp / e.maxHp > b.at) return
    e.phase = 1
    const halfType: EnemyType = {
      ...e.type,
      name: `${e.type.name} (half)`,
      radius: b.radius,
      speed: Math.round(e.type.speed * b.speedMult),
      leak: Math.ceil(e.type.leak / b.count),
      reward: Math.floor(e.type.reward / b.count),
      behaviours: (e.type.behaviours ?? []).filter((x) => x.kind !== 'bossSplit'),
    }
    const hp = e.hp * b.hpShare
    const maxHp = e.maxHp * b.at * b.hpShare
    const reward = Math.floor(e.reward / b.count)
    e.type = halfType
    e.hp = hp
    e.maxHp = maxHp
    e.reward = reward
    e.blockedBy = null
    for (let i = 1; i < b.count; i++) {
      const half = this.makeEnemy(halfType, e.key, maxHp, Math.max(0, e.distance - SPLIT_SPACING * i), reward)
      half.hp = hp
      half.phase = 1
      this.pendingSpawns.push(half)
    }
    this.behaviourStats.bossSplits++
    this.addTelegraph('split', e.pos.x, e.pos.y, b.radius * 2, 0.6, e.id)
    this.spawnFloater(e.pos, 'SPLIT!', '#ffd166', true)
    this.bossPhase(e)
  }

  private killEnemy(e: RtEnemy, srcId: string | undefined): void {
    const idx = this.enemies.indexOf(e)
    if (idx === -1) return
    this.enemies.splice(idx, 1)
    this.killCount++
    this.killsByKey.set(e.key, (this.killsByKey.get(e.key) ?? 0) + 1) // Q10
    this.goldEarned += e.reward
    this.onEvent?.('kill', { ...enemyTag(e.type), x: this.fieldX(e.pos.x) })
    if (srcId) {
      const s = this.sentinels.find((x) => x.id === srcId)
      if (s) {
        s.kills++
        if (s.profile.mods.killRush) s.rushUntil = this.elapsed + s.profile.mods.killRush.dur
        const xp = Math.round(e.maxHp * 0.2) + e.reward
        this.xpGained.set(srcId, (this.xpGained.get(srcId) ?? 0) + xp)
      }
    }
    this.onDeath(e)
  }

  /**
   * What a death sets off (Phase 3a). Everything here is DEFERRED to the end
   * of the tick (`flushPending`): `killEnemy` is reached from inside loops over
   * `this.enemies`, and the audit's hardest lesson is what happens when one of
   * those loops sees the list change under it.
   */
  private onDeath(e: RtEnemy): void {
    if (e.lobUntil > 0 || e.kingUntil > 0) {
      // Killed mid-wind-up: the throw never happens. This is the dodge.
      if (e.lobUntil > 0) this.behaviourStats.lobsCancelled++
      e.lobUntil = 0
      e.kingUntil = 0
      this.onEvent?.('behaviour:lobCancel', this.tagOf(e))
    }
    this.dropTelegraphsOf(e.id)
    if (this.rules.behaviours) {
      const split = behaviourOf(e.type, 'split')
      if (split) this.splitOnDeath(e, split)
    }
    // Burn SPREAD: a burning body that dies lights its nearest neighbours — a
    // capability the team must carry (`burnSpreadOnDeath`, the Ember Urn).
    if (this.rules.interactions && this.spreadOnDeath && e.burnDps > 0 && this.elapsed < e.burnUntil) {
      const r2 = SPREAD_RADIUS * SPREAD_RADIUS
      const near = this.enemies
        .filter((x) => x.hp > 0 && distSq(x.pos, e.pos) <= r2)
        .sort((a, b) => distSq(a.pos, e.pos) - distSq(b.pos, e.pos))
        .slice(0, SPREAD_COUNT)
      const dur = Math.max(SPREAD_MIN_DUR, e.burnUntil - this.elapsed)
      for (const x of near) this.pendingBurns.push({ e: x, dps: e.burnDps, dur, src: e.burnSrcId, type: e.burnType })
      if (near.length) {
        this.behaviourStats.burnSpreads += near.length
        this.addTelegraph('spread', e.pos.x, e.pos.y, SPREAD_RADIUS, 0.4)
        this.onEvent?.('burnSpread', this.tagOf(e))
      }
    }
  }

  private splitOnDeath(e: RtEnemy, b: Behaviour<'split'>): void {
    // The pieces wear the parent's modifier: a Plated splitter breaks into Plated imps.
    const mod = ENEMY_MODS.find((m) => e.key.endsWith(`_${m.id}`))
    const key = modKey(b.into, mod?.id ?? null)
    const type = ENEMY_TYPES[key] ?? ENEMY_TYPES[b.into]
    if (!type) return
    const maxHp = Math.max(1, Math.round(e.maxHp * b.hpFrac))
    const reward = Math.floor(type.reward / 2)
    // The pieces share the barrel's leak: a split never puts more through the
    // Gate than the barrel would have (`enemies.leakCeiling` states the same).
    const leak = Math.max(1, Math.min(type.leak, Math.floor(e.type.leak / b.count)))
    const pieceType: EnemyType = leak === type.leak ? type : { ...type, leak }
    for (let i = 0; i < b.count; i++) {
      const offset = (i - (b.count - 1) / 2) * SPLIT_SPACING
      const piece = this.makeEnemy(pieceType, key, maxHp, Math.min(this.path.length - 1, Math.max(0, e.distance + offset)), reward)
      piece.piece = true
      this.pendingSpawns.push(piece)
    }
    this.behaviourStats.splits++
    this.behaviourStats.splitSpawned += b.count
    this.addTelegraph('split', e.pos.x, e.pos.y, e.type.radius * 2, 0.5)
    this.onEvent?.('behaviour:split', this.tagOf(e))
  }

  /** Land everything a tick deferred (see `step`). */
  private flushPending(): void {
    if (this.pendingSpawns.length) {
      for (const e of this.pendingSpawns) this.enemies.push(e)
      this.pendingSpawns = []
      this.retargetDirty = true
    }
    if (this.pendingBurns.length) {
      for (const b of this.pendingBurns) {
        if (b.e.hp <= 0) continue
        this.writeBurn(b.e, { dps: b.dps, dur: b.dur }, b.src, b.type)
      }
      this.pendingBurns = []
    }
  }

  /**
   * Freeze the per-tick modifiers the NEXT tick's damage reads — the
   * shield-bearer's cover and brittle — and expire finished markers. Written
   * at the end of a tick so the tick differ's pre-tick snapshot holds exactly
   * the values the whole next tick will use (see {@link takenMult}).
   */
  private refreshEnemyState(): void {
    const interactions = this.rules.interactions
    const behaviours = this.rules.behaviours
    for (const e of this.enemies) {
      e.brittle = interactions && this.elapsed < e.frostUntil
      e.shield = 0
    }
    if (behaviours) {
      for (const b of this.enemies) {
        const aura = behaviourOf(b.type, 'shieldAura')
        if (!aura) continue
        const r2 = aura.radius * aura.radius
        for (const e of this.enemies) {
          if (e === b || distSq(e.pos, b.pos) > r2) continue
          if (aura.resist > e.shield) e.shield = aura.resist
        }
      }
    }
    if (this.telegraphs.length) this.telegraphs = this.telegraphs.filter((t) => t.t1 > this.elapsed)
  }

  /**
   * Same splice-during-iteration shape as `updateEnemies` (F1), with a milder
   * symptom: nothing is dropped here — `this.enemies` is not reassigned — but a
   * trap that killed mid-sweep skipped the next enemy in the pan, so that enemy
   * took no trap damage and no chill for that tick. The snapshot is taken per
   * trap, so a body a previous trap already killed is genuinely gone by the time
   * the next one sweeps.
   */
  private updateTraps(dt: number): void {
    for (const t of this.traps) {
      const r2 = TRAP_RADIUS * TRAP_RADIUS
      for (const e of this.enemies.slice()) {
        if (e.hp <= 0) continue
        if (distSq(e.pos, t.pos) > r2) continue
        // Credit the Sentinel that laid the trap, so trap kills award XP (H3),
        // and resist it as that Sentinel's damage rather than as `'physical'`
        // by assumption — see `RtTrap.damageType`.
        this.damageEnemy(e, t.dps * dt, t.srcId, false, t.damageType, true)
        if (e.hp > 0 && t.slow > 0) {
          e.chillSlow = Math.max(e.chillSlow, t.slow)
          e.chillUntil = Math.max(e.chillUntil, this.elapsed + 0.4)
        }
      }
    }
  }

  /** An enemy's tag for a Phase-3a behaviour / boss-phase event. */
  private tagOf(e: RtEnemy): EngineEventPayload {
    return { ...enemyTag(e.type), x: this.fieldX(e.pos.x), name: e.type.name }
  }

  /** Field x → −1…1, for the mixer's pan. */
  private fieldX(x: number): number {
    const w = this.map.width
    return w > 0 ? Math.max(-1, Math.min(1, (x / w) * 2 - 1)) : 0
  }

  /** Who struck and where, for a hit's sound. Reads only. */
  private hitPayload(p: RtProjectile): EngineEventPayload {
    const src = this.sentinels.find((x) => x.id === p.srcId)
    return { arch: src?.def.archetype, x: this.fieldX(p.pos.x) }
  }

  private spawnFloater(pos: Vec2, text: string, color: string, big: boolean): void {
    if (this.floaters.length > 70) this.floaters.shift()
    this.floaters.push({
      id: nextId('f'),
      // Cosmetic stream only — jitter must never perturb a combat roll (C1).
      pos: { x: pos.x + this.cosmeticRng.range(-6, 6), y: pos.y - 6 },
      text,
      color,
      life: big ? 0.9 : 0.6,
      maxLife: big ? 0.9 : 0.6,
      vy: big ? -46 : -34,
    })
  }

  private updateFloaters(dt: number): void {
    const alive: FloatingText[] = []
    for (const f of this.floaters) {
      f.life -= dt
      f.pos = { x: f.pos.x, y: f.pos.y + f.vy * dt }
      if (f.life > 0) alive.push(f)
    }
    this.floaters = alive
  }

  private checkEnd(): void {
    if (this.baseHp <= 0) {
      this.baseHp = 0
      this.status = 'defeated'
      return
    }
    // The live sub-wave has spawned everything it has…
    const groupSpawned = this.subWaveSpawned()
    // …and nothing of it is left on the field or in the air.
    const groupDone =
      groupSpawned && this.enemies.length === 0 && this.projectiles.length === 0 && this.pendingSpawns.length === 0
    if (!groupDone) return
    if (this.spawnIndex >= this.spawnQueue.length) this.status = 'cleared'
    else this.enterBreather()
  }

  hudSnapshot() {
    return {
      baseHp: this.baseHp,
      maxBaseHp: this.maxBaseHp,
      goldEarned: this.goldEarned,
      status: this.status,
      enemiesAlive: this.enemies.length,
      enemiesSpawned: this.spawnIndex,
      enemiesTotal: this.spawnQueue.length,
      elapsed: this.elapsed,
      subWave: this.subWave,
      subWaveCount: this.subWaveCount,
      breather: this.breather,
      commandReady: this.commandReady,
    }
  }

  result(): BattleResult {
    const defeated = this.status === 'defeated'
    // ---- one rounding rule, applied once, so the receipt adds up (F3) -------
    //
    // The SIM stays fractional: `baseDamageMul` below 1 and lifedrain both make
    // fractions, and rounding them per tick would change what the simulation
    // does. The REPORT is whole points, and it is derived rather than rounded
    // field-by-field — `leaks` used to be `Math.round`ed while the base was left
    // raw for the UI to `Math.ceil`, so an assisted receipt could read
    // "19 left (−2)" against a base of 20, and `finishBattle` then carried the
    // raw fraction into the rest of the run.
    const leakDamage = Math.round(this.leaks)
    // Whatever moved the base that leaks did not: lifedrain. Reported as its own
    // whole number so the subtraction below is the only arithmetic there is.
    const healed = Math.round(this.baseHp - (this.startBaseHp - this.leaks))
    // A cleared wave means the line held, so it holds at least one point — the
    // rounding above must never hand the campaign a base of 0 it can still play.
    const left = this.startBaseHp - leakDamage + healed
    return {
      status: defeated ? 'defeated' : 'cleared',
      goldEarned: this.goldEarned,
      baseHpLeft: defeated ? 0 : Math.min(this.maxBaseHp, Math.max(1, left)),
      leakDamage,
      leaks: leakDamage,
      enemiesLeaked: this.leakCount,
      enemiesKilled: this.killCount,
      perSentinel: this.sentinels.map((s) => ({
        id: s.id,
        kills: s.kills,
        damageDealt: Math.round(s.damageDealt),
        xpGained: this.xpGained.get(s.id) ?? 0,
      })),
    }
  }

  static enemyHpFrac(e: RtEnemy): number {
    return Math.max(0, e.hp) / e.maxHp
  }
}
