/**
 * The game store's shape. `GameState` is ONE zustand store (`useGameStore`)
 * assembled from slices — each slice file owns a group of actions, and this
 * file owns the data every slice reads. See `store.ts` for how they combine.
 */
import type { HomeGold } from '../../game/run/hq'
import type { StateCreator } from 'zustand'
import type { BattleResult, GameEngine } from '../../game/engine/engine'
import type { RarityPity } from '../../game/data/items'
import type { RunMap } from '../../game/data/runmap'
import type { RewardCard } from '../../game/data/rewards'
import type { ShrineOffer } from '../../game/data/shrines'
import type { DangerKind, EffectMods, GameMap, HeroSlot, Item, Mutation, Placement, Sentinel, Tactics, TerrainKind, WaveDef } from '../../game/types'
import type { AssistLevel } from '../settingsStore'
import type { RunChallenge } from '../seeds'
import type { RunProgress } from '../metaStore'
import type { RunFeats } from '../../game/run/settle'
import type { RunContract } from '../../game/run/contracts'
import type { CompanyId } from '../../game/data/companies'
import type { RunActions } from './runSlice'
import type { BattleActions } from './battleSlice'
import type { RosterActions } from './rosterSlice'
import type { EventActions } from './eventsSlice'
import type { ContractActions } from './contractSlice'
import type { ShellActions } from './shellSlice'

export type { RunContract }

/**
 * `contracts` is the contract board and its terms (the mercenary company): a
 * page before a run, like the hub, and never a live run.
 */
export type Screen = 'hub' | 'contracts' | 'heroPick' | 'map' | 'crossroads' | 'battle'
export type BattlePhase = 'setup' | 'battle'

/**
 * Root Shell selection. One selection drives the Context panel for every kind
 * of thing you can tap — heroes, items, offers — so the interaction is learned
 * once. See docs/FIGMA.md § The Root Shell.
 */
export type HeroTab = 'stats' | 'upgrades' | 'tactics'
export type ShellSelection =
  | { kind: 'hero'; id: string }
  | { kind: 'item'; id: string }
  | { kind: 'offer'; id: string }
  | null

/**
 * The mid-map fork, once per run: take a body, or take a mutation (M8).
 *
 * A mutation is the run's most consequential commitment, so its randomness sits
 * BEFORE the decision: the offer is rolled once, from the seeded run stream, at
 * the moment the fork fires, and lives in run state:
 *
 *  - the player chooses from `MUTATION_OFFER_SIZE` known options;
 *  - it is snapshotted, so a resume faces the same three and cannot re-roll;
 *  - it is rolled ONCE for the fork rather than per hero, so aiming at a
 *    different hero is not a back-door reroll.
 *
 * `mutationHeroId` is only which hero the player is currently aiming at — it
 * commits nothing. `revealed` is set after `chooseHeroMutation` lands.
 */
export interface Crossroads {
  recruits: Sentinel[]
  /** The rolled offer: distinct mutations, drawn from the seeded run RNG. */
  mutations: Mutation[]
  /** Which hero the player has aimed the mutation at, if any. Not a commitment. */
  mutationHeroId: string | null
  revealed?: { heroName: string; mutation: Mutation }
}

/**
 * `won` — the contract was delivered; `lost` — the wagons fell; `cashedOut` —
 * the militia sold the last crates at a city and headed home.
 */
export type RunPhase = 'active' | 'won' | 'lost' | 'cashedOut'
export type Speed = 1 | 2 | 3
export type EventKind = 'merchant' | 'shrine' | 'recruit' | 'campfire'

/**
 * A company's terms while they are open (the `contracts` screen): which
 * company, and the stake being set. Presentation — never snapshotted, and gone
 * the moment a contract is signed. Since the home became the board (Oct 2026,
 * Figma "B2"), the company is chosen on the menu's map and this is the terms
 * page alone.
 */
export interface ContractBoard {
  /** The board's own seed: each company's contract deals its run seed from it. */
  seed: number
  company: CompanyId
  crates: number
}

export interface HudSnapshot {
  baseHp: number
  maxBaseHp: number
  goldEarned: number
  enemiesAlive: number
  enemiesSpawned: number
  enemiesTotal: number
  /** Sub-waves (Phase 3a): which one is live (0-based), of how many, and whether the sim is in a breather. */
  subWave: number
  subWaveCount: number
  breather: boolean
  /** The Watch Command's per-sub-wave charge is available. */
  commandReady: boolean
}

/**
 * The receipt a run leaves behind — win or loss (M14 / H23). Built at the
 * moment the run ends, from facts that every path out of a finished run would
 * otherwise throw away. A death that tells you nothing teaches nothing.
 */
export interface RunRecap {
  won: boolean
  /** How the contract ended. */
  outcome: 'delivered' | 'cashedOut' | 'lost'
  /** The contract this run carried (null only for a run saved before contracts). */
  contract: RunContract | null
  /** Cargo, as a percentage, when the run ended. */
  cargo: number
  /** Gold this settle put in the bank: the road's share, every city's pay (and an older save's purse). */
  deposit: number
  /**
   * The deal this run was dealt from: map, loot, shrines, wave composition and
   * every combat roll. Seed a new run with it and you get the same deal.
   *
   * It is **not** on its own enough to reproduce the run (F6): the assist dial
   * multiplies the damage a leak does to the base, so the same seed at a
   * different dial diverges the moment anything gets through. The pair to quote
   * is (`seed`, `assist`); both are on this receipt.
   */
  seed: number
  /**
   * The assist level the run was played at — the other half of `seed`.
   *
   * Recorded at the end of the run: the dial is deliberately live (it is meant
   * to help the run you are currently losing), so a run whose dial moved
   * mid-march is reported at the setting it finished under.
   */
  assist: AssistLevel
  depth: number
  kills: number
  goldLeft: number
  /** What the run's purse put back in the bank (`hq.homeGold`); null for a run with no signed contract. */
  home: HomeGold | null
  /** Interest the bank earned on this contract (0 when lost). */
  interest: number
  threat: number
  /** Per-Sentinel contribution, best first. */
  heroes: { id: string; name: string; build: string; level: number; kills: number; damage: number }[]
  /** Base-HP DAMAGE the last wave cost — not a head count (F3). */
  leaks: number
  /** How many enemies reached the line in the last wave. The head count (F3). */
  enemiesLeaked: number
  /**
   * What the settle did for the long game — standing earned with the company,
   * the skill cards and item kinds it unlocked. Null when the run was not paid
   * out on this path.
   */
  progress: RunProgress | null
  /** A custom seed says so on the receipt, beside the seed. */
  challenge: RunChallenge
  /** Loot the boss dropped — held here rather than pushed into a dead run (M16). */
  spoils: Item[]
}

export interface MerchantStock {
  items: { item: Item; price: number }[]
  recruit: { sentinel: Sentinel; price: number } | null
  /** The wagon repair on this stall's counter (Phase 3b): null once bought. */
  repair?: { hp: number; price: number } | null
  /** How many times this stall's shelf has been rerolled (each costs more). */
  rerolls?: number
}

/** Every data field of the store. Actions live on the slice interfaces. */
export interface GameData {
  /**
   * The seed this run was dealt from. Every random thing in the run — map, loot,
   * shrines, each battle's combat rolls — derives from it, so quoting this one
   * number reproduces the run exactly (and a reload can no longer re-deal loot).
   */
  runSeed: number
  // Run structure
  screen: Screen
  runPhase: RunPhase
  /**
   * True once this run has been PAID OUT and retired (M-1).
   *
   * Settling is a one-way door: a settled run is no longer a live run, so it is
   * never written back to storage, never offered as a resume, and can never be
   * paid a second time.
   *
   * Deliberately NOT part of the snapshot: a snapshot is only ever written for
   * an unsettled run, so anything that loads back is unsettled by construction.
   */
  runSettled: boolean
  /**
   * The contract this run is (the mercenary company): its company, stake,
   * purse, market, and what its cities have paid. Null only on the hub and
   * the board. The stake's crates are the run's difficulty step
   * (`contracts.stakeRules`).
   */
  contract: RunContract | null
  /** The contract board, while it is open (presentation, not snapshotted). */
  board: ContractBoard | null
  /**
   * The road focused on the menu's map (presentation, not snapshotted): its
   * signpost is lit and the notice under the map is its company's. Null: the
   * default (`contractSlice.homeCompany`). Any company, a locked one too.
   */
  homeFocus: CompanyId | null
  /** A typed seed or the board's (Phase 1) — see `state/seeds.ts`. */
  challenge: RunChallenge
  /**
   * LS3: this is the player's first run, and it is staged — new ideas arrive
   * when they matter (`state/staging.ts`) and the road holds a few back
   * (`game/run/firstRun.ts`). Decided once, when the run begins, from the meta
   * save (no finished run yet) and the "Show everything" setting; a resumed
   * run keeps what it began with.
   */
  firstRun: boolean
  /**
   * The recap a finished campaign leaves behind (H23) — what the win screen
   * reads, and what a defeat screen gets too, so the receipt is real.
   */
  victory: RunRecap | null
  runMap: RunMap
  currentNodeId: string
  clearedNodeIds: string[]
  reachableNodeIds: string[]
  event: { kind: EventKind; nodeId: string } | null

  // Persistent run resources
  battleMap: GameMap
  /**
   * The act whose field `battleMap` is (`run/fields`): each act is fought on
   * its own field, dealt when the first fight of the act is entered, and the
   * company starts that fight on the bench. Snapshotted.
   */
  fieldAct: number
  roster: Sentinel[]
  placements: Placement
  gold: number
  baseHp: number
  maxBaseHp: number
  enemyHpMult: number
  /** Compounding campaign difficulty multiplier (1 = start of run). */
  threat: number
  inventory: Item[]
  // Run tallies (for the settle)
  runKills: number
  /**
   * Rarity pity for this run's loot (M9): unforced item rolls since the last
   * epic-or-better drop. It is run state, not RNG — the loot stream is seeded
   * and replayable, this counter is the memory of what that stream has actually
   * paid out — so it lives here, resets with the run, and is snapshotted beside
   * the stream position it is read with.
   *
   * `generateItem` advances it IN PLACE, so every call site copies it, passes
   * the copy, and writes the copy back through `set` — a store field is not a
   * mutable scratch buffer.
   */
  lootPity: RarityPity

  // Active battle
  activeNodeId: string | null
  currentWave: WaveDef | null
  battlePhase: BattlePhase
  speed: Speed
  tactics: Tactics
  engine: GameEngine | null
  hud: HudSnapshot
  lastResult: BattleResult | null
  lastLoot: Item[]
  /**
   * The wave-clear beat (H18): the held moment between the last enemy falling
   * and the wave settling. While it is set the settlement is deliberately held:
   * the engine is still mounted so the last frame of the fight stays on screen,
   * the sting is playing, and the banner is up.
   *
   * It is presentation, not run material — it is not snapshotted, and anything
   * that ends the session (a hidden tab, a skip tap) settles it immediately.
   */
  waveBeat: { status: 'cleared' | 'defeated'; startedAt: number } | null

  // Event payloads
  merchant: MerchantStock | null
  shrineOffer: ShrineOffer | null
  recruitOptions: Sentinel[]
  /** Post-wave: three cards to choose one of (attribute buff or item). */
  reward: RewardCard[] | null
  /**
   * LEGACY team-wide mods from the stat cards relics replaced. A run saved with
   * some still applies them; nothing new is added here.
   */
  runMods: EffectMods[]
  /** Relics held this run, by id, in the order taken (Phase 3b, `data/relics.ts`). */
  relics: string[]
  /** What this run has done that a feat may ask about (Phase 3b). */
  feats: RunFeats
  /**
   * Breather UI (Phase 3a): the slot whose hero the player has picked up to
   * move (one move per breather). Presentation — not snapshotted.
   */
  breatherPick: string | null
  /** Mid-map fork (once per run): recruit a teammate or take an attack mutation. */
  crossroads: Crossroads | null
  forkDone: boolean

  /**
   * SK1: the skill ids this run deals from — heroes on offer, hires, and every
   * milestone offer. Fixed when the run begins (the player's unlocked cards)
   * and snapshotted, so a resume deals the same. A DEALING pool: the route's
   * company's cards appear twice (`contracts.weightPool`).
   */
  skillPool: string[]
  /**
   * The classless rework: the item KINDS this run deals from — rolled heroes,
   * hires, loot, the merchant and rewards. Fixed when the run begins (the
   * basic five plus the player's unlocks), weighted to the route's company
   * like the skill pool, and snapshotted.
   */
  itemPool: string[]

  // UI
  selectedSentinelId: string | null

  // UI — Root Shell
  /** The one thing currently filling the Context panel. */
  shellSelection: ShellSelection
  /** Which tab a selected hero shows in the Context panel. */
  heroTab: HeroTab
  /** Gear slot awaiting an item — the Pack column filters to what fits. */
  gearSlot: { sentinelId: string; slot: HeroSlot } | null
  /**
   * Portrait battlefields: on a portrait field the setup layout collapses the
   * Detail band like a live wave does, so the tall Stage is the field's; the
   * wave strip's Details toggle (or tapping a posted hero) opens it again.
   * Reset with the rest of the shell on every node entry.
   */
  detailOpen: boolean
  /**
   * G1-2: the blocked tile the player last tapped, so the coach strip can say
   * why nothing happened ("Rock: nothing can stand here"). Presentation — not
   * snapshotted, cleared with the rest of the shell.
   *
   * Q1: or the CURSED tile an armed hero is over / was just posted on, so the
   * strip says what standing there costs (`kind: 'cursed'`).
   *
   * Weapon clearance: `'crowded'` — too close to a hero that swings, with
   * `line` naming who and with what; `'held'` — a posted hero tapped while a
   * sub-wave is live, when posts cannot change.
   */
  fieldNote: { tileId: string | null; kind: TerrainKind | DangerKind | 'crowded' | 'held'; at: number; line?: string } | null
  /**
   * Round 3 (Q5): what a resumed save had in an off hand that no longer takes
   * it, now back in the pack (`runSnapshot.gearReturned`). The receipt toast
   * says it once. Presentation — not snapshotted, cleared with the shell.
   * Also the slot for any one-off notice: `tone: 'warn'` marks a problem the
   * player should know about (a refused save, `state/saveHealth.ts`).
   */
  gearNotice: { text: string; at: number; tone?: 'warn' } | null
  /**
   * The arrival note for the first fight on a new act's field — the field's
   * name ("New ground: The Kiln Road — post your heroes"). Set by `selectNode`
   * when the ground changes; gone once a hero is posted, on "Got it", or with
   * the rest of the shell. Presentation — not snapshotted.
   */
  newGround: string | null
}

export interface GameState
  extends GameData,
    RunActions,
    ContractActions,
    BattleActions,
    EventActions,
    RosterActions,
    ShellActions {}

/** A slice: a creator for one group of actions over the whole `GameState`. */
export type Slice<T> = StateCreator<GameState, [], [], T>

/** The store's `get` / `set`, for helpers that act on the store from inside a slice. */
export type GetState = () => GameState
export type SetState = (partial: Partial<GameState>) => void
