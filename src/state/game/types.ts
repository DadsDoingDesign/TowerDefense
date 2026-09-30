/**
 * The game store's shape. `GameState` is ONE zustand store (`useGameStore`)
 * assembled from slices — each slice file owns a group of actions, and this
 * file owns the data every slice reads. See `store.ts` for how they combine.
 */
import type { StateCreator } from 'zustand'
import type { BattleResult, GameEngine } from '../../game/engine/engine'
import type { RarityPity } from '../../game/data/items'
import type { RunMap } from '../../game/data/runmap'
import type { RewardCard } from '../../game/data/rewards'
import type { ShrineOffer } from '../../game/data/shrines'
import type { EffectMods, GameMap, HeroSlot, Item, Mutation, Placement, Sentinel, Tactics, TerrainKind, WaveDef } from '../../game/types'
import type { AssistLevel } from '../settingsStore'
import type { RunChallenge } from '../daily'
import type { RunFeats } from '../../game/run/settle'
import type { RunActions } from './runSlice'
import type { BattleActions } from './battleSlice'
import type { RosterActions } from './rosterSlice'
import type { EventActions } from './eventsSlice'
import type { EndlessActions } from './endlessSlice'
import type { ShellActions } from './shellSlice'

export type Screen = 'hub' | 'heroPick' | 'map' | 'crossroads' | 'battle' | 'endless'
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

export type RunPhase = 'active' | 'won' | 'lost'
export type Speed = 1 | 2 | 3
export type EventKind = 'merchant' | 'shrine' | 'recruit' | 'campfire'
export type GameMode = 'campaign' | 'endless'
export type EndlessRoom = 'merchant' | 'forge' | 'shrine' | 'recruit'

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
  mode: GameMode
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
  /** Endless only: rounds survived. */
  rounds: number
  banner: number
  marks: number
  kills: number
  downs: number
  goldLeft: number
  threat: number
  /** Per-Sentinel contribution, best first. */
  heroes: { id: string; name: string; build: string; level: number; kills: number; damage: number; downed: boolean }[]
  /** Base-HP DAMAGE the last wave cost — not a head count (F3). */
  leaks: number
  /** How many enemies reached the line in the last wave. The head count (F3). */
  enemiesLeaked: number
  /** The next Banner this run has earned the right to fly, if any. */
  nextBanner: number
  /** Daily Watch / custom seed — the receipt says which, beside the seed. */
  challenge: RunChallenge
  /** Loot the boss dropped — held here rather than pushed into a dead run (M16). */
  spoils: Item[]
}

export interface MerchantStock {
  items: { item: Item; price: number }[]
  recruit: { sentinel: Sentinel; price: number } | null
  /**
   * The Gate repair on this stall's counter (Phase 3b): null once bought, or
   * on a stall that does not sell one (an Endless merchant room).
   */
  repair?: { hp: number; price: number } | null
  /** How many times this stall's shelf has been rerolled (each costs more). */
  rerolls?: number
}

/** Every data field of the store. Actions live on the slice interfaces. */
export interface GameData {
  // Mode
  mode: GameMode
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
   * The Banner this run is flying, 0–5 (H16 / M29). Chosen at the hero-pick
   * screen, before the first node, out of the rungs the Watchtower has
   * unlocked — and it applies to THIS run only.
   */
  runBanner: number
  /** Daily Watch / custom seed / standard (Phase 1) — see `state/daily.ts`. */
  challenge: RunChallenge
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
  roster: Sentinel[]
  placements: Placement
  gold: number
  baseHp: number
  maxBaseHp: number
  enemyHpMult: number
  /** Compounding campaign difficulty multiplier (1 = start of run). */
  threat: number
  inventory: Item[]
  // Run tallies (for meta rewards)
  runKills: number
  runDowns: number
  marksEarned: number
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

  // Endless Watch
  dust: number
  lives: number
  wins: number
  round: number
  endlessRecruitCost: number
  endlessRoom: EndlessRoom | null

  // UI
  selectedSentinelId: string | null
  evolutionQueue: string[]

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
   */
  fieldNote: { tileId: string | null; kind: TerrainKind; at: number } | null
}

export interface GameState
  extends GameData,
    RunActions,
    EndlessActions,
    BattleActions,
    EventActions,
    RosterActions,
    ShellActions {}

/** A slice: a creator for one group of actions over the whole `GameState`. */
export type Slice<T> = StateCreator<GameState, [], [], T>

/** The store's `get` / `set`, for helpers that act on the store from inside a slice. */
export type GetState = () => GameState
export type SetState = (partial: Partial<GameState>) => void
