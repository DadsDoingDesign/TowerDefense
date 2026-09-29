import { create } from 'zustand'
import { hashSeed, idCounterState, newRunSeed, restoreIdCounter, streamRng } from '../game/core/rng'
import { GameEngine, type BattleResult } from '../game/engine/engine'
import { applyXp, buildName, evolutionPending, evolveInto, xpToReach } from '../game/engine/leveling'
import { gameSfx, sfx, sfxRarity } from '../audio/audio'
import { effectiveUpgradeLevels, teamKeepsakeMods } from '../game/engine/combat'
import { pickBattleMap } from '../game/data/maps'
import { createSentinel, nameCounterState, startingRoster } from '../game/data/sentinels'
import {
  canUpgrade,
  creditPity,
  generateItem,
  HERO_SLOTS,
  heroSlotsFor,
  newRarityPity,
  RARITY,
  RARITY_ORDER,
  reforgeCost,
  reforgeDust,
  reforgeItem,
  upgradeCost,
  upgradeDust,
  upgradeRarity,
  type RarityPity,
  type RosterRef,
} from '../game/data/items'
import { generateRunMap, type MapNode, type MapOptions, type RunMap } from '../game/data/runmap'
import { generateRewardCards, type RewardCard } from '../game/data/rewards'
import { rollMutationChoices } from '../game/data/mutations'
import { getUpgradePath, milestoneForLevel } from '../game/data/upgradeTree'
import { rollShrine, type ShrineOffer } from '../game/data/shrines'
import { encounterSeed, generateEncounter, generateEndlessWave, type EncounterKind } from '../game/data/waves'
import type { Archetype, EffectMods, GameMap, HeroSlot, Item, ItemRarity, Mutation, Placement, Sentinel, Tactics, WaveDef } from '../game/types'
import { bannerRules, MAX_BANNER, useMetaStore, type BannerRules, type MetaBonuses } from './metaStore'
import { assistProfile, useSettingsStore, type AssistLevel } from './settingsStore'
import { onAppHidden } from './lifecycle'
import {
  captureRun,
  clearSnapshot,
  loadRunSnapshot,
  loadSnapshot,
  payoutFromRaw,
  saveSnapshot,
  snapshotBattleMap,
  snapshotShrine,
  type RunSnapshot,
  type StreamPositions,
} from './runSnapshot'

const DEFAULT_TACTICS: Tactics = { focus: 'first', holdFire: false }

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
 * `mutations` is the whole point of the shape. A mutation is Mythic, permanent,
 * unrepeatable per hero, and its measured value spans −17pt…+51pt depending on
 * the wave shape ahead — so the old `rollHeroMutation` (roll one, staple it to
 * the hero, show the player what they got) put the run's most consequential
 * commitment behind pure OUTPUT randomness. The offer is rolled once, from the
 * seeded run stream, at the moment the fork fires, and lives in run state:
 *
 *  - the player chooses from `MUTATION_OFFER_SIZE` known options, so the
 *    randomness sits BEFORE the decision;
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
export type EventKind = 'merchant' | 'shrine' | 'recruit'

export const MAX_BASE_HP = 20
export const START_GOLD = 60
export const MAX_ROSTER = 5

// Endless Watch starting pool + tuning.
export const ENDLESS_START_GOLD = 200
export const ENDLESS_START_DUST = 30
export const ENDLESS_LIVES = 3

const ITEM_PRICE: Record<ItemRarity, number> = { common: 30, rare: 60, epic: 110, legendary: 200, mythic: 340 }
/** Gold / dust recovered when dismantling an item, by rarity. */
const SCRAP_GOLD: Record<ItemRarity, number> = { common: 8, rare: 18, epic: 40, legendary: 75, mythic: 130 }
const SCRAP_DUST: Record<ItemRarity, number> = { common: 2, rare: 4, epic: 8, legendary: 14, mythic: 22 }
export const scrapGold = (item: Item): number => SCRAP_GOLD[item.rarity]
export const scrapDust = (item: Item): number => SCRAP_DUST[item.rarity]

/** Inventory sort: rarity (highest first), then kind, then name. */
function sortItems(items: Item[]): Item[] {
  const kindOrder = ['oneHand', 'twoHand', 'offHand', 'body']
  return [...items].sort((a, b) => {
    const r = RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity)
    if (r) return r
    const k = kindOrder.indexOf(a.slot) - kindOrder.indexOf(b.slot)
    if (k) return k
    return a.name.localeCompare(b.name)
  })
}
const RECRUIT_PRICE = 80

/*
 * Compounding difficulty: a campaign run is one continuous escalating defense.
 * Threat rises as you clear nodes and as you gain power (shrines / recruits),
 * so enemies get tougher to reflect your own compounding strength.
 *
 * **Threat carries the run's slope; the wave table carries its shape.** A node
 * at depth d throws `waveBudget(d) × threat` worth of enemies, and that product
 * is the only thing the player feels — so the split between the two is a free
 * choice, and it is made deliberately here. Putting most of the slope in Threat
 * keeps `generateEncounter(depth)` close to a *readable* wave (a depth-9 node
 * is ~52k of raw goblin, not ~150k), which matters because a wave table is
 * something a designer reads and a balance sweep instantiates directly, while
 * Threat is a single number the run shows the player.
 *
 * These went from ×1.12 / ×1.20 when the encounter generator was rebuilt around
 * an explicit budget (see `waves.ts`); the budget ratios came down by the same
 * factor, so a run's actual difficulty at every depth is unchanged by the move.
 */
/**
 * What one *consumed node* costs the rest of the run.
 *
 * `special` (merchant / shrine / recruit) is the fix for the map's central
 * decision. Until it existed, `completeNode` touched Threat not at all, so a
 * special node was free on the difficulty axis while still paying a reward —
 * which made "take the special" close to strictly correct on both axes at once
 * and quietly deleted the fork. A decision whose answer never changes with game
 * state is not a decision; it is a calculator.
 *
 * It is deliberately *smaller* than a battle step rather than equal to it, and
 * ×1.13 is fitted, not picked. Balance §11 measures the same model on the same
 * seeds across the whole dial (n=480, 1σ ≈ 1.8pt), and a realistic zero-meta
 * first run wins:
 *
 *     ×1.00 (the pre-fix game) 36%  ·  ×1.12 22%  ·  **×1.13 20%**
 *     ×1.14 18%  ·  ×1.42 (the full battle step) 6%
 *
 * The design target for that figure is 15–25%, so the full step overshoots it by
 * nine points and the pre-fix rule overshoots the other way by eleven; ×1.13
 * lands on the midpoint. The full step is also wrong on its own terms — at 6% the
 * map stops being a route and becomes a countdown, which replaces one non-decision
 * ("always take the special") with another. A partial step keeps the trade live
 * in both directions: a special is still the cheaper node, but it is no longer
 * free, so skipping the shop to bank the difficulty is a real line of play.
 *
 * `special` compounds with `THREAT_PER_CHOICE` when the player actually accepts
 * what the node offers, so the greed tax survives intact: visiting a shrine and
 * walking away costs ×{@link THREAT_PER_NODE}.special, taking the pact costs
 * that ×1.05.
 */
export const THREAT_PER_NODE = { normal: 1.42, elite: 1.52, special: 1.13, boss: 1 } as const
/**
 * Endless has its own, gentler step (H7).
 *
 * A campaign node is one battle plus everything the map hands you on the way to
 * the next one; an Endless round is one wave and one room. The player's power
 * grows more slowly per round than per node, so the world escalates more slowly
 * to match. It escalates all the same — before this, Endless compounded nothing
 * and the whole mode was a flat line dressed up as a ramp.
 */
export const THREAT_PER_ROUND = 1.22
export const THREAT_PER_CHOICE = 1.05

export type GameMode = 'campaign' | 'endless'
export type EndlessRoom = 'merchant' | 'forge' | 'shrine' | 'recruit'

/**
 * Per-system RNG streams, all derived from the run seed (C1).
 *
 * They are deliberately independent: rolling one more cosmetic number, or
 * offering one more merchant item, can never reshuffle the combat rolls or the
 * map. `rng` is the loot/event stream — the one most of the store draws from.
 * Combat is not here: the engine gets its own stream per battle (see startWave).
 */
let rng = streamRng(0, 'loot')
let mapRng = streamRng(0, 'map')

/** Re-seed every derived stream for a new run. Call before generating anything. */
function seedRunStreams(runSeed: number): void {
  rng = streamRng(runSeed, 'loot')
  mapRng = streamRng(runSeed, 'map')
}

/**
 * Where each stream currently sits, for the run snapshot (C3). Restoring these
 * is what makes a resumed run CONTINUE its seeded sequence instead of re-dealing
 * the loot it already handed out — a reload must not be a re-roll.
 *
 * `lootPity` rides along for exactly the same reason (M9). It is not a stream
 * POSITION but it is stream-shaped state: the drop the next roll produces is a
 * function of (loot stream position, dry counter), so restoring one without the
 * other resumes into a different sequence than the one that was interrupted —
 * measured at 8 of the next 29 drops changing. Anything that has to be restored
 * in lockstep with `rngLoot` belongs beside it.
 */
const streamPositions = (s: Pick<GameState, 'lootPity'>): StreamPositions => ({
  rngLoot: rng.saveState(),
  rngMap: mapRng.saveState(),
  lootPity: s.lootPity.dry,
  idCounter: idCounterState(),
  nameCounters: nameCounterState(),
})

/**
 * The combat seed for one battle. Deterministic in (run seed, node, wave), so a
 * replayed run replays its fights exactly, while two different nodes never share
 * a roll sequence.
 */
function combatSeed(runSeed: number, nodeKey: string, wave: number): number {
  return hashSeed(runSeed, 'combat', nodeKey, wave)
}

/**
 * The kit a run opens with. `roster` is the company it is being dealt FOR (M9):
 * a mono-mystic opening should not be handed a Greatsword whose whole damage
 * line reads 0 on everyone who could hold it. Omit it and the table is the
 * roster-blind one, byte for byte — which is what `newRun` wants, because there
 * the hero has not been picked yet.
 *
 * No pity is threaded here on purpose: these are forced-rarity/luck-0.1 opening
 * items, not the drought the pity timer exists to end, and starting a run with
 * the counter already spent would make the first real drop worse.
 */
function startingInventory(extra = 0, roster?: readonly RosterRef[]): Item[] {
  const items = [
    generateItem(rng, { slot: 'oneHand', rarity: 'common', roster }),
    generateItem(rng, { slot: 'body', rarity: 'common', roster }),
    generateItem(rng, { slot: 'offHand', rarity: 'rare', roster }),
  ]
  for (let i = 0; i < extra; i++) items.push(generateItem(rng, { luck: 0.1, roster }))
  return items
}

/**
 * A recruit who has actually been fighting a war (M17).
 *
 * Mid-run hires used to arrive at **level 1 with no gear** — no evolutions, no
 * upgrade milestones, a fraction of a real tower's stats — while costing the
 * run a ×1.05 Threat tax for the privilege. Past depth 6 that made every
 * recruit node a strictly bad deal: paying difficulty for a body that could not
 * hold a lane. A mercenary you hire at the front is a veteran of somewhere
 * else, so they arrive trained to just behind the company they are joining
 * (three levels back), and `Free Companies` closes that gap entirely.
 *
 * They arrive *un-evolved* even so: the branch choice belongs to the player,
 * which is why callers push a fresh recruit onto `evolutionQueue`.
 *
 * **Seasoned Recruits applies here too (M18).** `applyStatBonus` used to run in
 * `buildStartingRoster` and nowhere else, so a bought, permanent hub upgrade
 * covered three Sentinels at the start of the run and none of the ones the run
 * actually hired — its value decayed as the roster grew, silently, which is the
 * worst way for a paid upgrade to behave. Every mid-run body now comes through
 * this one funnel (crossroads, recruit node, merchant, endless room, and the
 * endless fallback hire), so applying it here covers all five sites at once and
 * cannot be forgotten by the next one that is added.
 */
function scaledRecruit(archetype: Archetype, roster: Sentinel[]): Sentinel {
  const bonus = useMetaStore.getState().bonuses().statBonus
  const base = applyStatBonus(createSentinel(archetype), bonus)
  if (!roster.length) return base
  const levels = roster.map((s) => s.level).sort((a, b) => a - b)
  const median = levels[Math.floor(levels.length / 2)]
  const trained = useMetaStore.getState().unlocked('freeCompanies')
  const target = Math.max(1, trained ? median : median - 3)
  return target <= 1 ? base : applyXp(base, xpToReach(target))
}

/** Add hires to the roster and queue any branch choice they arrive owing. */
function withRecruits(
  roster: Sentinel[],
  queue: string[],
  hires: Sentinel[],
): { roster: Sentinel[]; evolutionQueue: string[] } {
  return {
    roster: [...roster, ...hires],
    evolutionQueue: [...queue, ...hires.filter(evolutionPending).map((s) => s.id)],
  }
}

function applyStatBonus(s: Sentinel, n: number): Sentinel {
  if (!n) return s
  return { ...s, stats: { str: s.stats.str + n, dex: s.stats.dex + n, int: s.stats.int + n } }
}

/** Starting roster including any meta bonuses (extra Sentinels + flat stats). */
function buildStartingRoster(bonuses: MetaBonuses): Sentinel[] {
  const archs: Archetype[] = ['fighter', 'rogue', 'mystic']
  const extra: Sentinel[] = []
  for (let i = 0; i < bonuses.extraSentinels; i++) extra.push(createSentinel(archs[i % 3]))
  return [...startingRoster(), ...extra].map((s) => applyStatBonus(s, bonuses.statBonus))
}

interface HudSnapshot {
  baseHp: number
  maxBaseHp: number
  goldEarned: number
  enemiesAlive: number
  enemiesSpawned: number
  enemiesTotal: number
}

/**
 * The receipt a run leaves behind — win or loss (M14 / H23).
 *
 * Everything here was already known at the moment the run ended and was thrown
 * away: `lastResult` carried per-Sentinel kills, damage and downs, the run seed
 * carried reproducibility, and neither survived the transition to the end
 * screen. A death that tells you nothing teaches nothing.
 */
export interface RunRecap {
  won: boolean
  mode: GameMode
  /**
   * The deal this run was dealt from: map, loot, shrines, wave composition and
   * every combat roll. Seed a new run with it and you get the same deal.
   *
   * It is **not** on its own enough to reproduce the run, and the line above
   * used to claim it was (F6). The assist dial multiplies the damage a leak
   * does to the base, so the same seed at a different dial diverges the moment
   * anything gets through — and a wave that clears at Sure is a defeat at Off,
   * which forks the whole run from there. The pair to quote is
   * (`seed`, `assist`); both are on this receipt.
   */
  seed: number
  /**
   * The assist level the run was played at — the other half of `seed`.
   *
   * Recorded at the end of the run, which is the honest thing to record: the
   * dial is deliberately live (turning it on is meant to help the run you are
   * currently losing, as in Hades' God Mode), so a run whose dial moved
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
  /** Loot the boss dropped — held here rather than pushed into a dead run (M16). */
  spoils: Item[]
}

interface MerchantStock {
  items: { item: Item; price: number }[]
  recruit: { sentinel: Sentinel; price: number } | null
}

interface GameState {
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
   * paid a second time. Before this existed, `returnToHub` paid a live run and
   * then left every field of it intact — putting `screen` back to anything but
   * the hub made it live again and the next settle paid it all over again.
   *
   * Deliberately NOT part of the snapshot: a snapshot is only ever written for
   * an unsettled run, so anything that loads back is unsettled by construction.
   */
  runSettled: boolean
  /**
   * The Banner this run is flying, 0–5 (H16 / M29). Chosen at the hero-pick
   * screen, before the first node, out of the rungs the Watchtower has
   * unlocked — and it applies to THIS run only. Its predecessor, Dark
   * Sacrifice, was a permanent global ratchet that could not be turned off.
   */
  runBanner: number
  /**
   * The recap a finished campaign leaves behind (H23). A boss win used to
   * produce one "Bank and return" card and nothing else — no record of the run,
   * no reason to start another, and the boss's three loot drops landed in the
   * inventory of a run that was already over (M16). This is what the win screen
   * reads, and it is what a defeat screen gets too, so the receipt is real.
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
   * The wave-clear beat (H18).
   *
   * `checkEnd` flips the engine to 'cleared' on the frame the last projectile
   * resolves and the rAF loop called `finishBattle()` on that same frame, so the
   * win — the whole point of a game whose core verb is *watching* — was a state
   * transition: the field simply became a summary panel, with no moment in
   * between. This field is that moment. While it is set the settlement is
   * deliberately held: the engine is still mounted so the last frame of the
   * fight stays on screen, the sting is playing, and the banner is up.
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
  /** Team-wide mods granted by attribute rewards this run. */
  runMods: EffectMods[]
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
  detailId: string | null
  equipContext: { sentinelId: string; tab: HeroSlot | 'all' } | null
  /** Sentinel id whose tower-upgrade panel is open, or null. */
  upgradeTarget: string | null
  /** Whether the drag-and-drop inventory manager overlay is open. */
  inventoryOpen: boolean
  evolutionQueue: string[]

  // UI — Root Shell (behind the `shell` flag; unused by the legacy screens)
  /** The one thing currently filling the Context panel. */
  shellSelection: ShellSelection
  /** Which tab a selected hero shows in the Context panel. */
  heroTab: HeroTab
  /** Gear slot awaiting an item — the Pack column filters to what fits. */
  gearSlot: { sentinelId: string; slot: HeroSlot } | null

  // Actions — run/map
  newRun: () => void
  /**
   * Choose the Banner for the run being set up. Only legal on the hero-pick
   * screen — a Banner is a bet you place before the first node, never a switch
   * you flip mid-run — and it re-deals the map, because Banners 1 and 4 change
   * which stops exist on it.
   */
  setRunBanner: (tier: number) => void
  /** Start another run from the end screen, same Banner (M15). */
  runAgain: () => void
  pickStartingHero: (archetype: Archetype) => void
  returnToHub: () => void
  selectNode: (nodeId: string) => void
  /**
   * Put a persisted run back in play (C3). A mid-battle snapshot resumes at that
   * node's SETUP phase — a half-fought wave is not a save point.
   */
  resumeRun: (snap: RunSnapshot) => void
  /** Walk away from the persisted run without resuming it. */
  discardSavedRun: () => void
  // Actions — endless
  startEndless: () => void
  endlessOpenRoom: (room: EndlessRoom) => void
  endlessCloseRoom: () => void
  endlessBeginWave: () => void
  endlessBuyItem: (itemId: string) => void
  /** Hire a specific candidate from `recruitOptions` (defaults to the first). */
  endlessRecruit: (candidateId?: string) => void
  endlessForgeReforge: (itemId: string) => void
  endlessForgeUpgrade: (itemId: string) => void
  endlessShrineAccept: () => void
  // Actions — battle
  selectSentinel: (id: string | null) => void
  placeOnSlot: (slotId: string) => void
  clearSlot: (slotId: string) => void
  setSpeed: (s: Speed) => void
  setTactics: (t: Partial<Tactics>) => void
  startWave: () => void
  syncHud: () => void
  finishBattle: () => void
  /**
   * End the wave-clear hold right now and settle the wave.
   *
   * The doctrine's swift-retry rule applies to victories too: a beat you cannot
   * cut short is a cutscene. Any tap during the hold lands here, and so does
   * the tab going away.
   */
  skipWaveBeat: () => void
  chooseReward: (cardId: string) => void
  recruitTeammate: (sentinelId: string) => void
  /**
   * Aim the fork's mutation offer at a hero. Commits nothing and rolls nothing —
   * the three options were rolled when the fork fired, and stay the same
   * whichever hero is aimed at (see `Crossroads`).
   */
  aimHeroMutation: (heroId: string | null) => void
  /**
   * @deprecated Kept as the old name for `aimHeroMutation` while the shell
   * migrates. It no longer rolls: the choice is `chooseHeroMutation`.
   */
  rollHeroMutation: (heroId: string) => void
  /** Commit one of the offered mutations to a hero. Permanent, once per hero. */
  chooseHeroMutation: (heroId: string, mutationId: string) => void
  finishCrossroads: () => void
  continueAfterWave: () => void
  // Actions — events
  buyMerchantItem: (itemId: string) => void
  buyMerchantRecruit: () => void
  leaveEvent: () => void
  acceptShrine: () => void
  declineShrine: () => void
  acceptRecruit: (sentinelId: string) => void
  skipRecruit: () => void
  // Actions — items / detail / evolution
  openDetail: (id: string) => void
  closeDetail: () => void
  openEquip: (sentinelId: string, tab?: HeroSlot | 'all') => void
  closeEquip: () => void
  equipItem: (sentinelId: string, slot: HeroSlot, itemId: string) => void
  unequipItem: (sentinelId: string, slot: HeroSlot) => void
  sortInventory: () => void
  dismantleItem: (itemId: string) => void
  reforge: (itemId: string) => void
  upgradeItem: (itemId: string) => void
  chooseEvolution: (sentinelId: string, nodeId: string) => void
  // Actions — per-tower upgrade tree
  openUpgrade: (sentinelId: string) => void
  closeUpgrade: () => void
  buyTowerUpgrade: (sentinelId: string, pathId: string) => void
  openInventory: () => void
  closeInventory: () => void
  // Actions — Root Shell
  /** Tapping a deployed tower on the field. Drives both UIs. */
  focusTower: (sentinelId: string) => void
  shellSelect: (sel: ShellSelection) => void
  setHeroTab: (tab: HeroTab) => void
  activateGearSlot: (sentinelId: string, slot: HeroSlot) => void
  clearGearSlot: () => void
}

/** Cleared whenever the shell changes subject, so nothing leaks between contexts. */
const CLEAR_SHELL = {
  shellSelection: null as ShellSelection,
  heroTab: 'stats' as HeroTab,
  gearSlot: null,
} satisfies Partial<GameState>

function emptyPlacements(map: GameMap): Placement {
  const p: Placement = {}
  for (const s of map.slots) p[s.id] = null
  return p
}

export function placedSentinels(
  roster: Sentinel[],
  placements: Placement,
): { sentinel: Sentinel; slotId: string }[] {
  const byId = new Map(roster.map((s) => [s.id, s]))
  const out: { sentinel: Sentinel; slotId: string }[] = []
  for (const [slotId, sentId] of Object.entries(placements)) {
    if (!sentId) continue
    const sentinel = byId.get(sentId)
    if (sentinel) out.push({ sentinel, slotId })
  }
  return out
}

function findItem(state: GameState, itemId: string): { item: Item } | null {
  const inv = state.inventory.find((i) => i.id === itemId)
  if (inv) return { item: inv }
  for (const s of state.roster) {
    for (const slot of HERO_SLOTS) {
      const it = s.equipment[slot]
      if (it && it.id === itemId) return { item: it }
    }
  }
  return null
}

function replaceItem(
  get: () => GameState,
  set: (partial: Partial<GameState>) => void,
  itemId: string,
  next: Item,
): void {
  const { inventory, roster } = get()
  const nextInv = inventory.map((i) => (i.id === itemId ? next : i))
  const nextRoster = roster.map((s) => {
    let eq = s.equipment
    for (const slot of HERO_SLOTS) {
      if (eq[slot]?.id === itemId) eq = { ...eq, [slot]: next }
    }
    return eq === s.equipment ? s : { ...s, equipment: eq }
  })
  set({ inventory: nextInv, roster: nextRoster })
}

const neighborsOf = (map: RunMap, nodeId: string): string[] =>
  map.edges.filter((e) => e.from === nodeId).map((e) => e.to)

function freshHud(): HudSnapshot {
  return {
    baseHp: MAX_BASE_HP,
    maxBaseHp: MAX_BASE_HP,
    goldEarned: 0,
    enemiesAlive: 0,
    enemiesSpawned: 0,
    enemiesTotal: 0,
  }
}

/**
 * The map shape a run is dealt, given what the hub has unlocked and which
 * Banner the run is flying. Unlocks widen it; Banners narrow it (H15 / H16).
 */
function mapOptionsFor(banner: BannerRules): MapOptions {
  const meta = useMetaStore.getState()
  return {
    wideMap: meta.unlocked('cartographer'),
    extraRecruit: meta.unlocked('freeCompanies'),
    standingOrders: meta.unlocked('standingOrders'),
    noMerchants: banner.noMerchants,
    noRecruits: banner.noRecruits,
  }
}

function makeRun(banner: BannerRules = bannerRules(0)) {
  const runMap = generateRunMap(mapRng, mapOptionsFor(banner))
  const start = runMap.nodes.find((n) => n.type === 'start')!
  return {
    runMap,
    currentNodeId: start.id,
    clearedNodeIds: [start.id],
    reachableNodeIds: neighborsOf(runMap, start.id),
  }
}

/**
 * What kind of encounter a node fields. Banner 2 (Elite Watch) is a *rule*
 * change rather than a multiplier: every battle node resolves as an elite.
 *
 * The sentence that used to end this comment — *"so the whole run is armour
 * columns and champions instead of patrols"* — is the exact claim `metaStore.ts`
 * documents at length as **false** and had already corrected on the Banner card
 * itself (M7a): `pickVariant` rotates over `plated` / `warded` / `swift`, so two
 * thirds of an Elite Watch run is not armour at all, and `ELITE_CHAMPION_DEPTH`
 * is 6, so half the march fields no champion. It survived here because it is a
 * comment rather than copy, which makes it worse rather than better: it is the
 * obvious source for whoever writes the next card. `BANNER_RUNGS` in
 * `metaStore.ts` carries the wording that is true.
 */
const nodeKind = (node: MapNode, banner: BannerRules = bannerRules(0)): EncounterKind =>
  node.type === 'boss' ? 'boss' : node.type === 'elite' || banner.allElite ? 'elite' : 'normal'

/**
 * What this node is *worth* on the map — its **own** kind, never the
 * Banner-substituted one (M19-g).
 *
 * `nodeKind` answers a different question ("what wave does this field?"), and
 * three numbers were reading it that have nothing to do with the wave: the
 * Threat step, the elite gold bonus and the reward-card luck. **A Banner
 * substitutes an encounter, not a node.** Both halves of that were live defects
 * pointing in opposite directions:
 *
 *  - Banner 2 charged ×{@link THREAT_PER_NODE}.elite (1.52) on every battle node
 *    instead of 1.42 — over ten nodes, ×1.9 on every enemy's HP by the boss —
 *    a compounding surcharge stacked on top of the composition change, and
 *    nowhere in the rung's copy. This codebase has shipped copy describing a
 *    mechanic that did not exist four times; that is what it looks like.
 *  - It also paid +25 gold and +0.15 card luck on every one of those nodes. With
 *    the surcharge removed and the bonuses left in, §13 measured Banner 2 as
 *    *free money*: 34% win against Banner 1's 29%, i.e. a rung nobody would ever
 *    fly the one below. The pay has to follow the same rule as the price.
 *
 * An Elite the MAP dealt is unaffected: it is a route decision, so it still
 * costs the dearer step and still pays the elite bonus, which is what the node's
 * chip quotes and what makes the fork worth arguing about.
 */
const mapKind = (node: MapNode): EncounterKind => nodeKind(node)

/**
 * The flat purse a cleared campaign node pays on top of kill gold.
 *
 * One definition, because two things read it: the settlement that credits it,
 * and the coin the receipt sounds (F12). A cleared elite whose line held the
 * whole wave inside its blockers can finish with `goldEarned === 0` and still
 * bank 25 gold here — and the coin's old `goldEarned > 0` guard made exactly
 * that clear silent, which is the one kind of node where the purse is the
 * player's whole reward.
 */
const clearBonusGold = (node: MapNode): number => {
  const worth = mapKind(node)
  return worth === 'boss' ? 100 : worth === 'elite' ? 25 : 0
}

/**
 * Every run-scoped field at its start-of-run value (m-2).
 *
 * `newRun` and `startEndless` used to carry two hand-maintained reset lists,
 * and they had already drifted apart: `newRun` omitted `endlessRoom`, `dust`,
 * `wins`, `round`, `lives` and `endlessRecruitCost`, while `startEndless`
 * omitted the run map and `clearedNodeIds`. That is how a Forge room and 30
 * dust survived into a campaign run — and how the shell, which forks on
 * `endlessRoom` rather than on `mode`, then dispatched `endlessShrineAccept`
 * at a real campaign shrine node. One object spread by both entry points is
 * what makes the two lists incapable of drifting again.
 *
 * Call it AFTER `seedRunStreams`: it deals the run map off the map stream.
 *
 * `runSeed` is a parameter because the **battlefield** is now dealt here too
 * (WS8). It rides its own `field` stream rather than `mapRng`, so which field a
 * run is fought on is a pure function of the run seed alone: re-dealing the run
 * map — which `setRunBanner` does on every Banner change, from the same seed —
 * can never be used to reroll the battlefield, and a resumed run lands back on
 * the field its snapshot names.
 */
function freshRunState(runSeed: number) {
  // This nulls `waveBeat` below; the timer holding it goes with it (F6).
  clearBeatTimer()
  const battleMap = pickBattleMap(runSeed)
  return {
    runPhase: 'active' as RunPhase,
    runSettled: false,
    runBanner: 0,
    victory: null,
    ...makeRun(),
    event: null,
    battleMap,
    placements: emptyPlacements(battleMap),
    threat: 1,
    runKills: 0,
    runDowns: 0,
    marksEarned: 0,
    // A drought belongs to the run that suffered it (M9).
    lootPity: newRarityPity(),
    activeNodeId: null,
    currentWave: null,
    battlePhase: 'setup' as BattlePhase,
    speed: 1 as Speed,
    tactics: DEFAULT_TACTICS,
    engine: null,
    hud: freshHud(),
    lastResult: null,
    lastLoot: [],
    waveBeat: null,
    merchant: null,
    shrineOffer: null,
    recruitOptions: [],
    reward: null,
    runMods: [],
    crossroads: null,
    forkDone: false,
    dust: 0,
    lives: ENDLESS_LIVES,
    wins: 0,
    round: 1,
    endlessRecruitCost: 100,
    endlessRoom: null,
    selectedSentinelId: null,
    detailId: null,
    equipContext: null,
    upgradeTarget: null,
    inventoryOpen: false,
    evolutionQueue: [],
    ...CLEAR_SHELL,
  } satisfies Partial<GameState>
}

/**
 * Leave a battle that cannot be resolved, landing somewhere with a way out
 * (M-4). Used by the `finishBattle` guards, which used to bail without
 * clearing `engine` — so the rAF loop, which calls `finishBattle` on every
 * frame a finished engine is still mounted, called it forever.
 */
const abandonBattle = (mode: GameMode) => {
  // Same reason as `freshRunState`: the beat is dropped below, so is its timer.
  clearBeatTimer()
  return {
    engine: null,
    battlePhase: 'setup' as BattlePhase,
    activeNodeId: null,
    currentWave: null,
    lastResult: null,
    lastLoot: [],
    waveBeat: null,
    victory: null,
    screen: (mode === 'endless' ? 'endless' : 'map') as Screen,
    selectedSentinelId: null,
    ...CLEAR_SHELL,
  } satisfies Partial<GameState>
}

/**
 * The exact fields `canStartWave` reads. `GameState` satisfies it structurally,
 * so `useGameStore(canStartWave)` works — and so does calling it on a plain
 * object in a test.
 */
export type StartWaveGate = Pick<
  GameState,
  'screen' | 'runPhase' | 'mode' | 'currentWave' | 'lastResult' | 'engine' | 'battlePhase' | 'activeNodeId' | 'clearedNodeIds'
>

/**
 * Exactly the conditions `startWave` honours — exported so the UI can never
 * render an enabled "Start Wave" that the store then refuses (M-3).
 *
 * `startWave` calls this and nothing else, so the two cannot drift. A renderer
 * may add its own STRICTER gate on top (both UIs also require at least one
 * deployed Sentinel); it must never relax one. The soft-lock this exists to
 * kill was precisely a screen whose only control was a button the store
 * refused, on a state where nothing else rendered either.
 *
 * Pure, and deliberately so: it reads state and touches nothing, which is what
 * lets the UI ask the question as often as it likes.
 */
export function canStartWave(s: StartWaveGate): boolean {
  if (s.screen !== 'battle') return false
  if (s.runPhase !== 'active') return false
  if (!s.currentWave) return false
  // A wave that has already resolved can never be fought again.
  if (s.lastResult) return false
  if (s.engine) return false
  if (s.battlePhase !== 'setup') return false
  if (s.mode === 'campaign') {
    // No node, no campaign wave: there is nothing to pay out into.
    if (!s.activeNodeId) return false
    if (s.clearedNodeIds.includes(s.activeNodeId)) return false
  }
  return true
}

/** What a settle needs to know about the run it is retiring. */
interface SettleFacts {
  mode: GameMode
  depth: number
  kills: number
  downs: number
  wins: number
  /** The Banner the run flew — it scales the payout (H16). */
  banner: number
}

/**
 * A campaign run only counts as one you PLAYED (m-6).
 *
 * `grantRunRewards` increments `runsCompleted` unconditionally, so before this
 * every settle of a never-played run — four taps of "Start a Run" from the
 * hero-pick screen — added three completed runs to the record for zero marks.
 * A run that cleared nothing and killed nothing earns nothing either way, so
 * skipping the grant entirely costs the player no marks and stops the lie.
 */
const runWasPlayed = (f: SettleFacts): boolean => f.depth > 0 || f.kills > 0 || f.downs > 0

const settleFactsFromState = (s: GameState): SettleFacts => ({
  mode: s.mode,
  depth: Math.max(0, s.clearedNodeIds.length - 1),
  kills: s.runKills,
  downs: s.runDowns,
  wins: s.wins,
  banner: s.runBanner,
})

/*
 * There is no `settleFactsFromSnapshot` any more, on purpose. It only worked on
 * a payload `coherent()` had already accepted, which is what tied "we can put
 * you back in this run" to "this run earned something". `payoutFromRaw` reads
 * the same five numbers out of any payload, resumable or not, and a
 * `RunSnapshot` is one — so both paths go through it and cannot drift apart.
 */

function payOutRun(f: SettleFacts): void {
  const meta = useMetaStore.getState()
  if (f.mode === 'endless') {
    // Endless settles through the same ledger as the campaign (M13). The raw
    // `grantMarks(wins × 8)` this replaces skipped the Chronicler multiplier
    // entirely and never recorded a kill, a loss or a round in the lifetime
    // stats, so an abandoned Endless run left no trace at all.
    if (!runWasPlayed(f)) return
    meta.grantRunRewards({ mode: 'endless', depth: f.wins, won: false, kills: f.kills, downs: f.downs })
    return
  }
  if (!runWasPlayed(f)) return
  // The Banner a stored payload claims is validated against what this save has
  // opened, exactly as a resume is (F8). Nothing else stands between a
  // hand-edited `runBanner: 5` on a fresh Watchtower and a ×3.4 payout.
  const banner = Math.min(f.banner, meta.sacrificeTier)
  meta.grantRunRewards({ depth: f.depth, won: false, kills: f.kills, downs: f.downs, banner })
}

/**
 * End the current run: pay out whatever it earned, then RETIRE it (M-1 / M-2).
 *
 * Every path that destroys a run goes through here — `newRun`, `startEndless`,
 * `discardSavedRun` and `returnToHub` — because the alternative (overwriting
 * the storage key with a fresh `runSeed`) silently cost the player everything
 * they had earned on any route that did not pass the boot-time resume prompt.
 *
 * Paying TWICE is the opposite failure, and the old ordering here caused rather
 * than prevented it. It flushed first "to retire a run that had already ended",
 * but a flush of a LIVE run WRITES it, so the next two lines loaded that fresh
 * write and paid it — and since `returnToHub` left the run's fields intact,
 * putting `screen` back to a non-hub value made it live and payable again,
 * without limit. So the ordering is gone and the rule is explicit instead:
 *
 *  - Memory is authoritative for the run this session is holding. Storage may
 *    be a coalesced write behind, and flushing it is exactly the bug.
 *  - Storage is only consulted for a run this session never took up — a
 *    previous session's snapshot, identified by a `runSeed` that is not ours.
 *  - `runSettled` makes the whole thing idempotent: whatever was paid, the run
 *    is retired, which un-lives it. It cannot be re-saved, re-offered or
 *    re-paid, and a run whose marks `finishBattle` already granted (it sets the
 *    flag too) is never paid a second time here.
 */
function settleSavedRun(): void {
  const st = useGameStore.getState()
  const { snap, unresumable } = loadRunSnapshot()

  /*
   * Payability and resumability are separate questions (M-1).
   *
   * `coherent()` refuses a payload whose screen/node combination has no exit —
   * the right call for a RESUME, since restoring it would strand the player on
   * a screen whose only control the store refuses. But the settle facts are
   * plain numbers that were true of the run whatever screen it died on, and the
   * refusal used to take them with it: `loadSnapshot` deleted the key on the way
   * out, so on a fresh boot (or a resume-prompt peek) the settle found nothing
   * in storage AND no live run in memory, and paid zero. That is exactly the
   * loss C3 was written to stop — see `discardSavedRun` below.
   *
   * So an unresumable-but-readable payload settles here like any other foreign
   * run: paid once, then discarded rather than offered back.
   */
  const stored = snap ? payoutFromRaw(snap) : unresumable

  if (stored && stored.runSeed !== st.runSeed) {
    // Someone else's run — a previous session's, never resumed here. All we
    // know about it is what was written.
    payOutRun(stored)
  } else if (!st.runSettled && isLiveRun(st)) {
    // Our own run, still unpaid. Pay it from memory and destroy it in the same
    // breath — there is no window in which it is both paid and still live.
    payOutRun(settleFactsFromState(st))
  }

  /*
   * The clear is unconditional, and a `runSeed` guard on it would be dead code.
   *
   * The worry it would answer is two tabs: A settling while storage holds B's
   * LIVE run. But look at the branch above — a stored payload whose seed is not
   * ours is, by construction, the one this settle just PAID. There is no path
   * that reaches here having settled something other than what is in storage,
   * so "only clear a snapshot whose seed matches the run being settled" would
   * never once change the outcome.
   *
   * What two tabs can genuinely do is have A pay B's still-running run and B
   * pay it again later from its own memory. Storage is the only channel between
   * tabs, and it cannot distinguish "another tab is still playing this" from
   * "a previous session was killed mid-run" — which is the case C3 exists for
   * and must keep paying. Telling them apart needs a liveness lease or a ledger
   * of already-paid seeds, i.e. a real cross-tab protocol, and the window here
   * is one autosave wide (B rewrites its snapshot on its next state change).
   * Left documented rather than half-solved.
   */
  clearSnapshot()
  sessionOwnsRun = false
  useGameStore.setState({ runSettled: true })
}

/**
 * How long the wave-clear beat holds before the wave settles (H18).
 *
 * 900ms is a beat, not a cutscene: long enough for the sting to resolve and for
 * the banner to be read, short enough that a player taking three waves in a
 * two-minute session never feels it as a wait. It is skippable from the first
 * frame, and a LOSS gets less of it — a defeat wants the retry, not the dwell
 * (Sakurai, "Swift Retries").
 */
const WAVE_BEAT_MS = 900
const WAVE_BEAT_LOSS_MS = 550
/** The live hold's timer, and the one flag that lets a settlement through it. */
let beatTimer: ReturnType<typeof setTimeout> | null = null
let settlingBeat = false

/**
 * Drop the beat's timer (F6).
 *
 * `beatTimer` is a module singleton and `skipWaveBeat` used to be the only thing
 * that ever cleared it — but `abandonBattle`, `resumeRun` and `freshRunState`
 * all set `waveBeat: null` and left the handle live. That is harmless only
 * because the orphan then fires into `skipWaveBeat`'s `if (!get().waveBeat)
 * return`. It stops being harmless the moment a SECOND beat opens before the
 * orphan fires: `beatTimer` is overwritten, the old handle is unreachable, and
 * the orphan settles the new, live beat early — a wave-clear hold that ends
 * before its sting does, for reasons nothing on screen explains.
 *
 * The rule is now the obvious one: whoever drops the beat drops its timer, in
 * the same breath.
 */
function clearBeatTimer(): void {
  if (beatTimer !== null) {
    clearTimeout(beatTimer)
    beatTimer = null
  }
}

export const useGameStore = create<GameState>((set, get) => {
  const bootSeed = newRunSeed()
  seedRunStreams(bootSeed)
  // Both hoists below preserve the ORDER the object literal used to evaluate in
  // — fresh run state (which deals the map off `mapRng`), then the roster
  // (which spends entity ids), then the inventory (which spends the loot
  // stream). The roster only moves ahead of the inventory so the inventory can
  // be dealt FOR it; nothing else may move.
  const bootRun = freshRunState(bootSeed)
  const bootRoster = startingRoster()
  return {
    ...bootRun,
    mode: 'campaign',
    runSeed: bootSeed,
    screen: 'hub',
    roster: bootRoster,
    gold: START_GOLD,
    baseHp: MAX_BASE_HP,
    maxBaseHp: MAX_BASE_HP,
    enemyHpMult: 1,
    inventory: startingInventory(0, bootRoster),

    newRun: () => {
      // Starting a run destroys any saved one. Settle it first — the marks it
      // earned are the player's either way (M-2).
      settleSavedRun()
      const b = useMetaStore.getState().bonuses()
      // One fresh seed per run, then every stream (map/loot/combat) hangs off it.
      const runSeed = newRunSeed()
      seedRunStreams(runSeed)
      set({
        ...freshRunState(runSeed),
        mode: 'campaign',
        runSeed,
        screen: 'heroPick',
        roster: [],
        gold: b.startGold,
        baseHp: b.maxBaseHp,
        maxBaseHp: b.maxBaseHp,
        enemyHpMult: b.enemyHpMult,
        // No roster to weight the kit for: `roster` is [] here and the hero is
        // picked on the NEXT screen, so this deliberately stays the
        // roster-blind table rather than weighting against an empty company.
        inventory: startingInventory(b.extraItems),
      })
    },

    setRunBanner: (tier) => {
      const st = get()
      // A Banner is chosen before the march, never during it.
      if (st.screen !== 'heroPick' || st.mode !== 'campaign') return
      const unlocked = useMetaStore.getState().sacrificeTier
      const next = Math.max(0, Math.min(Math.min(MAX_BANNER, unlocked), Math.floor(tier)))
      if (next === st.runBanner) return
      const rules = bannerRules(next)
      // Re-deal the map from the SAME run seed: Banner 1 removes merchants and
      // Banner 4 removes recruiters, so the map is a function of the Banner. The
      // map stream is rewound rather than advanced, so switching Banners back and
      // forth cannot be used to reroll the map.
      mapRng = streamRng(st.runSeed, 'map')
      set({ runBanner: next, threat: rules.startThreat, ...makeRun(rules) })
      sfx('confirm')
    },

    runAgain: () => {
      // The end screen's second door (M15). Three taps through the hub is not a
      // "one more run" loop; this is. The Banner carries over, so a run you
      // just lost under Banner 2 is retried under Banner 2.
      const banner = get().runBanner
      get().newRun()
      if (banner > 0) get().setRunBanner(banner)
    },

    pickStartingHero: (archetype) => {
      const b = useMetaStore.getState().bonuses()
      const archs: Archetype[] = ['fighter', 'rogue', 'mystic']
      const extra: Sentinel[] = []
      for (let i = 0; i < b.extraSentinels; i++) extra.push(createSentinel(archs[i % 3]))
      const roster = [createSentinel(archetype), ...extra].map((s) => applyStatBonus(s, b.statBonus))
      set({ roster, screen: 'map' })
    },

    // Leaving for the Watchtower ends the run, so it settles like any other end.
    // This IS a mid-run quit — the shell's fallback escape offer dispatches it
    // (ui/shell/offers.ts) — so the run has to be destroyed here, not merely
    // paid. `settleSavedRun` retires it (M-1); the rest tears down the live
    // battle so nothing is left pointing at a run that no longer exists.
    returnToHub: () => {
      settleSavedRun()
      set({
        ...abandonBattle('campaign'),
        screen: 'hub',
        runPhase: 'active',
        event: null,
        merchant: null,
        shrineOffer: null,
        recruitOptions: [],
        reward: null,
        crossroads: null,
        endlessRoom: null,
      })
    },

    // ---- run snapshot (C3) ----
    resumeRun: (snap) => {
      // A resume replaces the whole run, `waveBeat` included, so any hold still
      // outstanding from the session's previous run goes with it (F6).
      clearBeatTimer()
      // Rebuild the seeded streams, then fast-forward each to where the run had
      // got to — a resume must not re-deal loot the player already saw.
      seedRunStreams(snap.runSeed)
      if (snap.rngLoot !== null) rng.loadState(snap.rngLoot)
      if (snap.rngMap !== null) mapRng.loadState(snap.rngMap)
      // The dry counter is restored WITH the loot stream, never without it: the
      // next drop is a function of both, so rewinding one alone resumes into a
      // sequence the interrupted run would never have dealt (M9).
      const lootPity: RarityPity = { dry: snap.lootPity }
      restoreIdCounter(snap.idCounter)

      const battleMap = snapshotBattleMap(snap)
      const placements: Placement = { ...emptyPlacements(battleMap) }
      const rosterIds = new Set(snap.roster.map((s) => s.id))
      for (const [slotId, sentId] of Object.entries(snap.placements ?? {})) {
        if (slotId in placements && sentId && rosterIds.has(sentId)) placements[slotId] = sentId
      }

      // Which side of the wave was the snapshot taken on? (C-1)
      //
      // `lastResult` is the only honest answer, and it is why it is now part of
      // the snapshot. A resolved wave has ALREADY moved the run on — the node is
      // in `clearedNodeIds`, threat compounded, gold and XP paid, a reward dealt
      // — so restoring that payload into a pre-battle setup screen offered the
      // cleared wave up to be fought again and granted every one of those a
      // second time. Restoring the result instead lands the player back on the
      // summary they were looking at, with the reward still theirs to take.
      const resolved = snap.lastResult !== null
      const enemiesTotal = snap.currentWave?.spawns.length ?? 0
      const hud = {
        ...freshHud(),
        baseHp: snap.baseHp,
        maxBaseHp: snap.maxBaseHp,
        enemiesTotal,
        // A resolved wave reads as finished, not as one still to be fought.
        enemiesSpawned: resolved ? enemiesTotal : 0,
        goldEarned: resolved ? (snap.lastResult?.goldEarned ?? 0) : 0,
      }

      set({
        mode: snap.mode,
        runSeed: snap.runSeed,
        screen: snap.screen,
        runPhase: snap.runPhase,
        // A snapshot only ever exists for a run that was NOT settled, so taking
        // one up un-retires this session (M-1).
        runSettled: false,
        runMap: snap.runMap,
        currentNodeId: snap.currentNodeId,
        clearedNodeIds: snap.clearedNodeIds,
        reachableNodeIds: snap.reachableNodeIds,
        event: snap.event,
        battleMap,
        roster: snap.roster,
        placements,
        gold: snap.gold,
        baseHp: snap.baseHp,
        maxBaseHp: snap.maxBaseHp,
        enemyHpMult: snap.enemyHpMult,
        threat: snap.threat,
        inventory: snap.inventory,
        runKills: snap.runKills,
        runDowns: snap.runDowns,
        marksEarned: snap.marksEarned,
        lootPity,
        activeNodeId: snap.activeNodeId,
        currentWave: snap.currentWave,
        tactics: snap.tactics,
        merchant: snap.merchant,
        shrineOffer: snapshotShrine(snap),
        recruitOptions: snap.recruitOptions,
        reward: snap.reward,
        runMods: snap.runMods,
        crossroads: snap.crossroads,
        forkDone: snap.forkDone,
        evolutionQueue: snap.evolutionQueue,
        dust: snap.dust,
        lives: snap.lives,
        wins: snap.wins,
        round: snap.round,
        endlessRecruitCost: snap.endlessRecruitCost,
        endlessRoom: snap.endlessRoom,
        // The engine is deliberately NOT restored: a wave interrupted MID-fight
        // resumes from its setup phase, fully re-fightable, rather than from a
        // half-simulated state that would be neither the player's win nor their
        // loss. A wave that had already RESOLVED is a different thing entirely
        // and must not be re-offered — see `resolved` above.
        engine: null,
        battlePhase: 'setup',
        speed: 1,
        hud,
        lastResult: snap.lastResult,
        lastLoot: snap.lastLoot,
        // A resumed run never lands mid-beat: the beat is presentation, it is
        // not snapshotted, and whatever it was holding was settled before the
        // snapshot was written (see `installRunPersistence`).
        waveBeat: null,
        // Clamped to the ladder by the migration, and clamped again HERE to what
        // this save has actually opened (F8). Nothing validated the two against
        // each other, so a Banner-5 payload resumed at Banner 5 on a Watchtower
        // that had unlocked none — the exact bypass `setRunBanner` refuses at
        // the start of a run, arriving through the back door instead. Downwards
        // only: a resume may never grant a rung, and it may never quietly raise
        // the difficulty of the run the player left.
        runBanner: Math.min(snap.runBanner, useMetaStore.getState().sacrificeTier),
        // A snapshot only ever exists for a LIVE run, so there is no recap to
        // restore — and leaving a stale one would show the last run's receipt
        // over this one's first node.
        victory: null,
        selectedSentinelId: null,
        detailId: null,
        equipContext: null,
        upgradeTarget: null,
        inventoryOpen: false,
        ...CLEAR_SHELL,
      })
    },

    // Walking away from an interrupted run still SETTLES it. Losing the run to
    // a backgrounded tab must not also cost the player the marks they earned —
    // that was the second half of C3, and it is why this pays out rather than
    // just deleting the key.
    discardSavedRun: () => {
      settleSavedRun()
      set({
        ...abandonBattle('campaign'),
        screen: 'hub',
        runPhase: 'active',
        event: null,
        merchant: null,
        shrineOffer: null,
        recruitOptions: [],
        reward: null,
        crossroads: null,
        endlessRoom: null,
      })
    },

    // ---- Endless Watch ----
    startEndless: () => {
      // Same contract as `newRun`: the saved run is settled, not dropped (M-2).
      settleSavedRun()
      const b = useMetaStore.getState().bonuses()
      const runSeed = newRunSeed()
      seedRunStreams(runSeed)
      // Same order-preserving hoist as the boot state: fresh run, then roster,
      // then the inventory dealt for that roster (M9).
      const fresh = freshRunState(runSeed)
      const roster = buildStartingRoster(b)
      set({
        // Same shared reset as `newRun` (m-2): the run map and `clearedNodeIds`
        // are cleared here for exactly the reason `endlessRoom` and `dust` are
        // cleared there — neither entry point may inherit the other's leftovers.
        ...fresh,
        mode: 'endless',
        runSeed,
        screen: 'endless',
        roster,
        gold: ENDLESS_START_GOLD,
        dust: ENDLESS_START_DUST,
        baseHp: b.maxBaseHp,
        maxBaseHp: b.maxBaseHp,
        enemyHpMult: b.enemyHpMult,
        inventory: startingInventory(b.extraItems, roster),
      })
    },

    /*
     * Every `endless*` action below is a no-op outside Endless Watch (m-2).
     *
     * The shell forks on `st.endlessRoom` rather than on `st.mode`, so a stale
     * room leaking out of an endless run turned a real campaign shrine into a
     * dispatch of `endlessShrineAccept` — gold spent, boon applied, but the node
     * never completed, the Threat tax never paid and the event left parked on
     * the board. `freshRunState` stops the leak; this stops the whole class,
     * whatever a future caller does. Mode is the only thing that decides which
     * half of the game an action belongs to.
     */
    endlessOpenRoom: (room) => {
      const { roster, mode, lootPity, merchant } = get()
      if (mode !== 'endless') return
      if (room === 'merchant') {
        // ---- one shelf per round, not one per tap (F5) --------------------
        //
        // `endlessCloseRoom` used to null `merchant` and this used to roll four
        // fresh items unconditionally, so opening and closing the room was a
        // free re-roll: spam it until a mythic shows up. Worse, each roll churned
        // the pity counter, so the spam also bought out the player's drought with
        // items they never saw. The stock now survives a close and is re-rolled
        // where a new shelf actually belongs — when the round advances (see
        // `finishBattle`). Buying removes the entry, so re-opening shows what is
        // left rather than what might have been.
        if (merchant) {
          set({ endlessRoom: 'merchant' })
          return
        }
        const luck = Math.min(0.4, get().round * 0.03)
        // An offer, so the drought's luck applies but the counter is not spent;
        // `endlessBuyItem` charges it on the sale (F4). The copy is defensive:
        // the store's object is never handed out to be mutated (M9).
        const items = Array.from({ length: 4 }, () => {
          const item = generateItem(rng, { luck, roster, pity: { ...lootPity }, commitPity: false })
          return { item, price: ITEM_PRICE[item.rarity] }
        })
        set({ endlessRoom: 'merchant', merchant: { items, recruit: null } })
      } else if (room === 'shrine') {
        set({ endlessRoom: 'shrine', shrineOffer: rollShrine(rng) })
      } else if (room === 'recruit') {
        const archs: Archetype[] = ['fighter', 'rogue', 'mystic']
        set({ endlessRoom: 'recruit', recruitOptions: roster.length < MAX_ROSTER ? archs.map((a) => scaledRecruit(a, roster)) : [] })
      } else {
        set({ endlessRoom: 'forge' })
      }
    },

    // The merchant's stock is deliberately NOT cleared here (F5): it belongs to
    // the round, not to the visit, and dropping it is what made re-opening the
    // room a free re-roll. The shrine offer and the recruit slate are cleared
    // because declining them IS the answer to them.
    endlessCloseRoom: () => set({ endlessRoom: null, shrineOffer: null, recruitOptions: [] }),

    endlessBeginWave: () => {
      if (get().mode !== 'endless') return
      const wave = generateEndlessWave(get().round, get().runSeed)
      const { baseHp, maxBaseHp } = get()
      set({
        currentWave: wave,
        battlePhase: 'setup',
        screen: 'battle',
        endlessRoom: null,
        selectedSentinelId: null,
        lastResult: null,
        lastLoot: [],
        hud: { ...freshHud(), baseHp, maxBaseHp, enemiesTotal: wave.spawns.length },
        ...CLEAR_SHELL,
      })
    },

    endlessBuyItem: (itemId) => {
      const { merchant, gold, inventory, mode, lootPity } = get()
      if (mode !== 'endless' || !merchant) return
      const entry = merchant.items.find((e) => e.item.id === itemId)
      if (!entry || gold < entry.price) return
      // The sale is the drop (F4) — see `buyMerchantItem`.
      const pity = { ...lootPity }
      creditPity(pity, entry.item.rarity)
      sfx('coin')
      sfxRarity(entry.item.rarity)
      set({
        gold: gold - entry.price,
        inventory: [...inventory, entry.item],
        lootPity: pity,
        merchant: { ...merchant, items: merchant.items.filter((e) => e.item.id !== itemId) },
      })
    },

    endlessRecruit: (candidateId) => {
      const { gold, roster, endlessRecruitCost, recruitOptions, mode } = get()
      if (mode !== 'endless') return
      if (roster.length >= MAX_ROSTER || gold < endlessRecruitCost) return
      // Hire the candidate the player actually tapped; only fall back to the
      // first when no id was supplied (legacy callers).
      const chosen = candidateId ? recruitOptions.find((s) => s.id === candidateId) : undefined
      if (candidateId && !chosen) return
      const pick = chosen ?? recruitOptions[0] ?? scaledRecruit(rng.pick(['fighter', 'rogue', 'mystic'] as Archetype[]), roster)
      set({
        gold: gold - endlessRecruitCost,
        ...withRecruits(roster, get().evolutionQueue, [pick]),
        endlessRecruitCost: Math.round(endlessRecruitCost * 1.6),
        endlessRoom: null,
        recruitOptions: [],
      })
    },

    endlessForgeReforge: (itemId) => {
      const { dust, mode } = get()
      if (mode !== 'endless') return
      const found = findItem(get(), itemId)
      if (!found) return
      const cost = reforgeDust(found.item)
      if (dust < cost) return
      replaceItem(get, set, itemId, reforgeItem(found.item, rng))
      set({ dust: dust - cost })
    },

    endlessForgeUpgrade: (itemId) => {
      const { dust, mode } = get()
      if (mode !== 'endless') return
      const found = findItem(get(), itemId)
      if (!found || !canUpgrade(found.item)) return
      const cost = upgradeDust(found.item)
      if (dust < cost) return
      replaceItem(get, set, itemId, upgradeRarity(found.item, rng))
      set({ dust: dust - cost })
    },

    endlessShrineAccept: () => {
      const { shrineOffer, roster, baseHp, gold, mode } = get()
      if (mode !== 'endless' || !shrineOffer) return
      const eff = shrineOffer.apply({ roster, baseHp, gold })
      // The Endless twin of the campaign shrine, and it was silent for the same
      // reason (F12).
      if ((eff.goldDelta ?? 0) > 0) sfx('coin')
      set({
        roster: eff.roster ?? roster,
        baseHp: Math.max(1, baseHp + (eff.baseHpDelta ?? 0)),
        gold: Math.max(0, gold + (eff.goldDelta ?? 0)),
        endlessRoom: null,
        shrineOffer: null,
      })
    },

    selectNode: (nodeId) => {
      const { reachableNodeIds, clearedNodeIds, runMap, roster, runBanner, lootPity, event } = get()
      const banner = bannerRules(runBanner)
      if (!reachableNodeIds.includes(nodeId)) return
      // A cleared node is done, whatever `reachableNodeIds` says. Reachability
      // is derived state and a bad snapshot can hand us a set that overlaps the
      // cleared list; entering a cleared battle node from there lands on a
      // battle screen whose only control — Start Wave — the store refuses (M-3).
      if (clearedNodeIds.includes(nodeId)) return
      const node = runMap.nodes.find((n) => n.id === nodeId)
      if (!node) return

      // ---- a parked event is never left live behind you (F1) ---------------
      //
      // Tapping a special sets `event` and leaves the player on the map, so a
      // second tap elsewhere used to succeed with the first node's offer still
      // standing. That event outlives the frontier: the player fights on, and a
      // later `leaveEvent` / `acceptRecruit` / `declineShrine` runs
      // `completeNode` on a node that is no longer where the company is. It
      // overwrites `currentNodeId`, rebuilds `reachableNodeIds` from THAT node's
      // neighbours — marching the marker backwards onto a branch the run never
      // routed to — and charges `THREAT_PER_NODE.special` a second time. One
      // march step consumed two nodes and Threat took an extra ×1.13.
      //
      // Same shape as the crossroads fork (F2), and the same answer: the guard
      // goes on the ACTION, not on the screen that happens to be covering it.
      // Re-tapping the node whose event is already open is a no-op — it must
      // never re-enter the branches below, which would re-roll the merchant's
      // stock for free. Tapping ANOTHER node forfeits the special: it is not
      // cleared, it charges nothing, and its offers die with it.
      if (event) {
        if (event.nodeId === nodeId) return
        set({ event: null, merchant: null, shrineOffer: null, recruitOptions: [] })
      }

      if (node.type === 'merchant') {
        const luck = Math.min(0.4, node.layer * 0.04)
        // The shelf is an OFFER: four items rolled with the drought's luck, and
        // the player pays for at most some of them. `commitPity: false` keeps
        // the counter where it is; `buyMerchantItem` charges it on the sale (F4).
        const items = Array.from({ length: 4 }, () => {
          // A copy even though `commitPity: false` cannot write to it — the
          // store's object is never handed out to be mutated (M9).
          const item = generateItem(rng, { luck, roster, pity: { ...lootPity }, commitPity: false })
          return { item, price: ITEM_PRICE[item.rarity] }
        })
        const recruit =
          roster.length < MAX_ROSTER && !banner.noRecruits
            ? { sentinel: scaledRecruit(rng.pick(['fighter', 'rogue', 'mystic'] as Archetype[]), roster), price: RECRUIT_PRICE }
            : null
        set({ event: { kind: 'merchant', nodeId }, merchant: { items, recruit } })
        return
      }
      if (node.type === 'shrine') {
        set({ event: { kind: 'shrine', nodeId }, shrineOffer: rollShrine(rng) })
        return
      }
      if (node.type === 'recruit') {
        const archs: Archetype[] = ['fighter', 'rogue', 'mystic']
        set({ event: { kind: 'recruit', nodeId }, recruitOptions: archs.map((a) => scaledRecruit(a, roster)) })
        return
      }

      // Battle / elite / boss.
      //
      // The composition variant is seeded on (run seed, layer, row), so the node
      // keeps the wave it was dealt across a save/resume, and two battle nodes
      // standing in the same layer are two different fights rather than one
      // fight offered twice (WS8).
      const wave = generateEncounter(node.layer, nodeKind(node, banner), {
        seed: encounterSeed(get().runSeed, node.layer),
        sibling: node.row,
      })
      const { baseHp, maxBaseHp } = get()
      set({
        activeNodeId: nodeId,
        currentWave: wave,
        battlePhase: 'setup',
        screen: 'battle',
        selectedSentinelId: null,
        lastResult: null,
        lastLoot: [],
        hud: { ...freshHud(), baseHp, maxBaseHp, enemiesTotal: wave.spawns.length },
        ...CLEAR_SHELL,
      })
    },

    selectSentinel: (id) => set({ selectedSentinelId: id }),

    placeOnSlot: (slotId) => {
      const { selectedSentinelId, placements, battlePhase, screen } = get()
      if (screen !== 'battle' || battlePhase !== 'setup' || !selectedSentinelId) return
      const next: Placement = { ...placements }
      for (const key of Object.keys(next)) if (next[key] === selectedSentinelId) next[key] = null
      next[slotId] = selectedSentinelId
      set({ placements: next, selectedSentinelId: null })
    },

    clearSlot: (slotId) => {
      const { placements, battlePhase } = get()
      if (battlePhase !== 'setup') return
      if (!placements[slotId]) return
      set({ placements: { ...placements, [slotId]: null } })
    },

    setSpeed: (s) => set({ speed: s }),
    setTactics: (t) => set({ tactics: { ...get().tactics, ...t } }),

    startWave: () => {
      const st = get()
      const { battleMap, roster, placements, baseHp, maxBaseHp, enemyHpMult, threat, mode, currentWave, tactics, runMods } = st
      // ---- the load-bearing invariant (C-1) --------------------------------
      // A wave that has already resolved can never be fought again, and a node
      // already in `clearedNodeIds` can never be re-fought. Both grants — gold,
      // XP, threat, the reward pick, the endless win/round — hang off finishing
      // a wave, so re-entering one is how everything gets paid twice.
      //
      // These are guards on the ACTION rather than on any one screen, on
      // purpose: the C-1 bug arrived through a snapshot shape, and the next one
      // would too. Whatever state a future save restores, it cannot get past
      // here. They live in `canStartWave` so the UI reads the same answer the
      // store will give — a control the store refuses must never render enabled.
      if (!canStartWave(st)) return
      if (!currentWave) return // narrowing only — `canStartWave` already rejected it
      // Both modes compound via Threat (H7). Endless used to escalate on wave
      // composition alone — `generateEndlessWave` walks `depth = round + 2` — but
      // the budget curve's per-depth step decays toward a floor, so a late
      // Endless round barely differed from the one before it. Compounding Threat
      // per round is what makes the Watch actually close in, and it is the same
      // number the campaign uses, so one difficulty model covers both modes.
      const effHpMult = enemyHpMult * threat
      // The battle's combat rolls are pinned to (run seed, node, wave) — replaying
      // the same run replays the same fight, and no two nodes share a sequence.
      // A campaign wave without a node no longer reaches this line at all: it
      // used to fall back to a made-up `'node'` key and then hang in
      // `finishBattle`, which has nothing to pay a nodeless clear into (M-4).
      const nodeKey = mode === 'endless' ? 'endless' : (st.activeNodeId ?? 'node')
      const waveIndex = mode === 'endless' ? st.round : st.clearedNodeIds.length
      const engine = new GameEngine({
        map: battleMap,
        wave: currentWave,
        placedSentinels: placedSentinels(roster, placements),
        baseHp,
        maxBaseHp,
        enemyHpMult: effHpMult,
        teamMods: [...teamKeepsakeMods(roster), ...runMods],
        tactics,
        seed: combatSeed(st.runSeed, nodeKey, waveIndex),
        // The assist dial is read HERE, not inside the sim (M34). The engine
        // stays a pure function of (seed, options), so the balance harness and
        // any replay are untouched by whatever this player has set.
        //
        // It is read live rather than pinned at run start, on purpose: assist
        // exists to help the run you are currently losing, so it has to bite the
        // next wave, not the next run. That makes the dial part of the run's
        // reproducibility contract rather than outside it, which is why the
        // recap now records it next to the seed (F6) — quoting the seed alone
        // reproduces the deal, not the outcome.
        baseDamageMul: assistProfile(useSettingsStore.getState().assist).baseDamageMul,
        onEvent: gameSfx,
      })
      sfx('wave')
      set({ engine, battlePhase: 'battle', selectedSentinelId: null, hud: engine.hudSnapshot() })
    },

    syncHud: () => {
      const { engine } = get()
      if (!engine) return
      const s = engine.hudSnapshot()
      set({
        hud: {
          baseHp: s.baseHp,
          maxBaseHp: s.maxBaseHp,
          goldEarned: s.goldEarned,
          enemiesAlive: s.enemiesAlive,
          enemiesSpawned: s.enemiesSpawned,
          enemiesTotal: s.enemiesTotal,
        },
      })
    },

    /**
     * The rAF loop calls this on every frame an engine that is no longer
     * `running` is still mounted. Phase 3 makes the FIRST such call open a short
     * hold instead of settling immediately (H18); every subsequent call during
     * the hold is a no-op, and the timer (or a tap, or the tab going away)
     * settles it.
     */
    /**
     * The rAF loop calls this on every frame an engine that is no longer
     * `running` is still mounted. Phase 3 makes the FIRST such call open a short
     * hold (H18) instead of settling on the spot; every call during the hold is
     * a no-op, and the timer — or a tap, or the tab going away — settles it.
     *
     * Everything below the beat is the settlement exactly as it was, in the
     * same place, with the same invariants: C-1's no-node-pays-twice, M-4's
     * never-bail-into-a-dead-battle, M-1's settle-once.
     */
    finishBattle: () => {
      const st = get()
      if (!st.engine) return
      if (st.waveBeat) {
        // Held. Only `skipWaveBeat` (the timer, a tap, or `pagehide`) may pass.
        if (!settlingBeat) return
      } else {
        /*
         * ---- the wave-clear beat (H18) ------------------------------------
         *
         * `checkEnd` flips to 'cleared' the frame the last projectile resolves,
         * and this used to settle on that same frame: the field simply became a
         * summary panel, with nothing in between. For a game whose core verb is
         * WATCHING, the win moment was a state transition.
         *
         * So: hold the last frame of the fight on screen (the engine stays
         * mounted, which is what keeps it drawn), play the sting, raise the
         * banner, and settle a beat later. The hold is short and it is
         * skippable — the audit's swift-retry doctrine applies to victories
         * too, and this game is played in one-to-three-minute bursts.
         *
         * The status is read off the engine rather than off `result()`, which
         * allocates the whole receipt; the settlement below builds that once.
         */
        const status = st.engine.status === 'defeated' ? 'defeated' : 'cleared'
        // A loss already has a voice — `leak` fired as the line broke — so the
        // beat for it is shorter and its sound is the run/wave ending below,
        // not a second thud on top of the one just heard.
        if (status === 'cleared') sfx('clear')
        set({ waveBeat: { status, startedAt: Date.now() } })
        beatTimer = setTimeout(
          () => {
            beatTimer = null
            get().skipWaveBeat()
          },
          status === 'cleared' ? WAVE_BEAT_MS : WAVE_BEAT_LOSS_MS,
        )
        return
      }
      // Past the hold: the wave settles now, so the beat is over.
      set({ waveBeat: null })
      // The other half of the C-1 invariant: no node can be paid out twice.
      // `startWave` should already have made this unreachable; it is repeated
      // here because this is the function that hands out the money.
      //
      // Bailing has to leave a state with a way out of it (M-4). Dropping the
      // engine but staying on the battle screen with an unresolvable wave is the
      // soft-lock in another costume: Start Wave is refused, the summary needs a
      // `lastResult` there isn't one of, and no band renders anything else.
      if (st.mode === 'campaign' && st.activeNodeId && st.clearedNodeIds.includes(st.activeNodeId)) {
        set(abandonBattle(st.mode))
        return
      }
      const result = st.engine.result()
      /*
       * ---- the payout lands here, so the coin does too (H17) ---------------
       *
       * `'coin'` was handled by `gameSfx` and emitted by nothing — a whole
       * sound with no event. The moment gold is actually credited to the run is
       * this one, at the end of the beat, alongside the summary appearing:
       * sting → hold → receipt, with the money on the receipt.
       *
       * The two loss cases are sounded at their own branches below rather than
       * here, because "this wave went badly" and "the run is over" are
       * different pieces of news and used to share one sound.
       */
      //
      // No `sfx('confirm')` here any more. That was the ENTIRE sound of a wave
      // ending back when nothing preceded it; now the `clear` sting has already
      // said "you won this" a beat ago, and a boss clear stacks `victory` on
      // top of it a moment later. Three overlapping announcements of one event
      // is mud, and the doctrine's own mixing rule (balance SFX by importance)
      // says the smallest of the three is the one to drop.
      // Sounds when ANY currency lands on the receipt, not just kill gold — see
      // `clearBonusGold` (F12).
      const settlingNode =
        st.mode === 'campaign' && st.activeNodeId
          ? st.runMap.nodes.find((n) => n.id === st.activeNodeId)
          : undefined
      const nodePurse = settlingNode ? clearBonusGold(settlingNode) : 0
      if (result.status === 'cleared' && (result.goldEarned > 0 || nodePurse > 0)) sfx('coin')
      const totalKills0 = st.runKills + result.enemiesKilled
      const totalDowns0 = st.runDowns + result.downed

      // XP + evolution apply in both modes and both outcomes.
      const xpById0 = new Map(result.perSentinel.map((p) => [p.id, p.xpGained]))
      const rosterXp = st.roster.map((s) => applyXp(s, xpById0.get(s.id) ?? 0))
      const evoQueue0 = rosterXp.filter(evolutionPending).map((s) => s.id)

      if (st.mode === 'endless') {
        if (result.status === 'cleared') {
          const isBoss = st.round % 10 === 0
          const isElite = !isBoss && st.round % 5 === 0
          const dustGain = 5 + (isElite ? 5 : 0) + (isBoss ? 15 : 0)
          const lootCount = isBoss ? 3 : isElite ? 2 : 1
          // Copy-spend-write-back: the counter is mutated in place (M9).
          const pity = { ...st.lootPity }
          const loot = Array.from({ length: lootCount }, () =>
            generateItem(rng, { luck: Math.min(0.45, st.round * 0.03), roster: rosterXp, pity }),
          )
          set({
            roster: rosterXp,
            lootPity: pity,
            gold: st.gold + result.goldEarned,
            dust: st.dust + dustGain,
            baseHp: st.maxBaseHp,
            // A new round is a new shelf. The stock survives closing the room
            // (F5) precisely so it cannot be re-rolled on demand; this is the
            // one place it is allowed to change.
            merchant: null,
            inventory: [...st.inventory, ...loot],
            lastResult: result,
            lastLoot: loot,
            evolutionQueue: evoQueue0,
            wins: st.wins + 1,
            round: st.round + 1,
            // The Watch closes in: every round survived compounds Threat, the
            // same way clearing a campaign node does (H7).
            threat: st.threat * (isElite ? THREAT_PER_ROUND * 1.08 : THREAT_PER_ROUND),
            engine: null,
            battlePhase: 'setup',
            runKills: totalKills0,
            runDowns: totalDowns0,
          })
        } else {
          const lives = st.lives - 1
          if (lives <= 0) {
            // Endless pays through the SAME ledger as a campaign run (M13). It
            // used to call `grantMarks` with a raw `wins × 8`, which skipped the
            // Chronicler multiplier and the heat bonus the player had paid for,
            // and never touched the lifetime record — so an Endless run left no
            // trace in the Watchtower at all.
            const marks = useMetaStore
              .getState()
              .grantRunRewards({ mode: 'endless', depth: st.wins, won: false, kills: totalKills0, downs: totalDowns0 })
            // The run is over. `sfx('defeat')` existed and was called from
            // nowhere (M32): losing was silent in both modes.
            sfx('defeat')
            set({
              roster: rosterXp,
              gold: st.gold + result.goldEarned,
              lives: 0,
              runPhase: 'lost',
              // Marks are granted right here, so the run is settled right here:
              // nothing downstream may pay it a second time (M-1).
              runSettled: true,
              lastResult: result,
              engine: null,
              battlePhase: 'setup',
              marksEarned: marks,
              runKills: totalKills0,
              runDowns: totalDowns0,
              evolutionQueue: evoQueue0,
            })
          } else {
            // A lost ROUND with lives still in hand is not the run ending, so
            // it does not get the run's jingle — it gets the sound of something
            // of yours falling, and the retry is one tap away.
            sfx('down')
            // A LOST round does not advance the Watch (H7). It used to: losing
            // burned a life AND pushed `round` forward, so the wave you failed
            // was replaced by a harder one and a bad run accelerated its own
            // difficulty. A life is a retry, not a skip.
            set({
              roster: rosterXp,
              gold: st.gold + result.goldEarned,
              baseHp: st.maxBaseHp,
              lives,
              lastResult: result,
              engine: null,
              battlePhase: 'setup',
              runKills: totalKills0,
              runDowns: totalDowns0,
              evolutionQueue: evoQueue0,
            })
          }
        }
        return
      }

      // ---- Campaign ----
      const { roster, gold, inventory, runMap, activeNodeId } = st
      // A campaign wave with no node has nothing to pay into and nothing to
      // advance. This used to `return` with the engine and the phase untouched,
      // so the rAF loop — which calls `finishBattle` on every frame an engine
      // that is no longer `running` is still mounted — called it forever: 180
      // dead calls in three seconds, no Start Wave, no Continue, no exit (M-4).
      // `startWave` now refuses this state outright; leaving the battle here is
      // the belt to that braces, for any route that still manufactures one.
      const node = activeNodeId ? runMap.nodes.find((n) => n.id === activeNodeId) : undefined
      if (!activeNodeId || !node) {
        set(abandonBattle(st.mode))
        return
      }
      const totalKills = totalKills0
      const totalDowns = totalDowns0

      if (result.status === 'defeated') {
        // The campaign has no lives: this wave loss IS the run loss (M32).
        sfx('defeat')
        const depth = get().clearedNodeIds.length - 1
        const marks = useMetaStore
          .getState()
          .grantRunRewards({ depth, won: false, kills: totalKills, downs: totalDowns, banner: st.runBanner })
        set({
          runPhase: 'lost',
          // `grantRunRewards` just paid this run out; settling it here is what
          // stops `returnToHub` off the defeat screen paying it again (M-1).
          runSettled: true,
          lastResult: result,
          // The receipt is built here, while everything it needs is still in
          // hand (M14). It used to be assembled — badly — on the end screen out
          // of two scalars, and per-hero kills, damage, downs, the leak count
          // and the run seed all went in the bin the moment the run ended.
          victory: buildRecap(st, result, { won: false, depth, marks, kills: totalKills, downs: totalDowns }),
          baseHp: 0,
          engine: null,
          battlePhase: 'setup',
          runKills: totalKills,
          runDowns: totalDowns,
          marksEarned: marks,
        })
        return
      }

      // XP + evolution.
      const xpById = new Map(result.perSentinel.map((p) => [p.id, p.xpGained]))
      const nextRoster = roster.map((s) => applyXp(s, xpById.get(s.id) ?? 0))
      const evolutionQueue = nextRoster.filter(evolutionPending).map((s) => s.id)

      // Advance the map.
      const banner = bannerRules(st.runBanner)
      const cleared = [...get().clearedNodeIds, activeNodeId]
      const reachable = neighborsOf(runMap, activeNodeId).filter((id) => !cleared.includes(id))
      const wonRun = node.type === 'boss'
      if (wonRun) sfx('victory')
      const marks = wonRun
        ? useMetaStore
            .getState()
            .grantRunRewards({ depth: cleared.length - 1, won: true, kills: totalKills, downs: totalDowns, banner: st.runBanner })
        : 0
      // What the NODE costs and what the NODE pays: both follow the kind the map
      // dealt, not the one the Banner substituted (see `mapKind`). The world
      // still escalates faster through a real Elite, and a real Elite still pays
      // the richer purse and the luckier hand.
      const worth = mapKind(node)
      const nextThreat = st.threat * THREAT_PER_NODE[worth]
      const bonusGold = clearBonusGold(node)
      const luck = (worth === 'boss' ? 0.35 : worth === 'elite' ? 0.15 : 0) + node.layer * 0.03

      // Non-boss clears offer a card pick (attribute buff or item). Banner 1 —
      // Thin Pickings — cuts the hand to two, which is a real constraint on
      // build direction rather than another multiplier.
      //
      // Copy-spend-write-back for the pity counter (M9). The two halves differ
      // in WHEN they spend it (F4): the boss's spoils go straight onto the
      // recap, so the player receives all three and they charge here; the reward
      // hand is an offer of which at most one card is taken, so it rolls with
      // the drought's luck and `chooseReward` charges the card actually picked.
      const pity = { ...st.lootPity }
      const reward = wonRun
        ? null
        : generateRewardCards(rng, { luck, count: banner.thinPickings ? 2 : 3, roster: rosterXp, pity })
      // The boss's spoils go on the RECAP, not into the inventory of a run that
      // has just ended (M16). Three legendary drops handed to a company that is
      // walking home was the clearest sign the win had nowhere to go.
      const bossLoot = wonRun
        ? Array.from({ length: 3 }, () => generateItem(rng, { luck, roster: rosterXp, pity }))
        : []

      // At the map's halfway point, fire the one-time fork: recruit or mutate.
      const half = Math.ceil((runMap.layers - 1) / 2)
      const fireFork = !st.forkDone && !wonRun && node.layer >= half
      // Both halves of the fork are dealt HERE, from the seeded run stream, and
      // then live in run state until the player answers (M8). Rolling the
      // mutation offer at fork time rather than at tap time is what makes it
      // survive a snapshot unchanged and what makes "aim at another hero"
      // stop being a reroll.
      const crossroads: Crossroads | null = fireFork
        ? {
            recruits:
              nextRoster.length < MAX_ROSTER && !banner.noRecruits
                ? (['fighter', 'rogue', 'mystic'] as Archetype[]).map((a) => scaledRecruit(a, nextRoster))
                : [],
            mutations: rollMutationChoices(
              rng,
              // Nothing already on the company's books — the offer must not
              // contain an option that is a no-op for the hero it lands on.
              [...new Set(nextRoster.flatMap((s) => (s.mutations ?? []).map((m) => m.key)))],
            ),
            mutationHeroId: null,
          }
        : null

      set({
        roster: nextRoster,
        gold: gold + result.goldEarned + bonusGold,
        baseHp: result.baseHpLeft,
        inventory: wonRun ? inventory : [...inventory, ...bossLoot],
        threat: nextThreat,
        lastResult: result,
        lastLoot: bossLoot,
        lootPity: pity,
        victory: wonRun
          ? buildRecap(st, result, { won: true, depth: cleared.length - 1, marks, kills: totalKills, downs: totalDowns, spoils: bossLoot, roster: nextRoster })
          : null,
        reward,
        crossroads,
        forkDone: st.forkDone || fireFork,
        evolutionQueue,
        clearedNodeIds: cleared,
        currentNodeId: activeNodeId,
        reachableNodeIds: reachable,
        runPhase: wonRun ? 'won' : 'active',
        // The boss clear is the only campaign win, and it pays on the spot.
        runSettled: wonRun,
        engine: null,
        // The wave is over, so the phase says so (C-1). Leaving it at 'battle'
        // was what made the persisted post-wave state describe a fight that was
        // still in progress — and what left the shell with no way out of a
        // cleared wave, since its "wave cleared" panel keys off exactly this.
        battlePhase: 'setup',
        runKills: totalKills,
        runDowns: totalDowns,
        marksEarned: marks,
      })
    },

    skipWaveBeat: () => {
      clearBeatTimer()
      if (!get().waveBeat) return
      // The one door through `finishBattle`'s hold. A flag rather than a second
      // copy of the settlement, so there is still exactly one place a wave pays
      // out and no invariant can be enforced in one copy and not the other.
      settlingBeat = true
      try {
        get().finishBattle()
      } finally {
        settlingBeat = false
      }
    },

    chooseReward: (cardId) => {
      const { reward, roster, inventory, runMods, lootPity } = get()
      if (!reward) return
      const card = reward.find((c) => c.id === cardId)
      if (!card) return
      /*
       * ---- ceremony (Phase 3) ----------------------------------------------
       *
       * Taking a reward is one of the two emotional peaks of a roguelite run
       * and it was a UI click sample over a state merge. It now gets the click
       * AND a sting whose length, brightness and reverb follow the rarity of
       * what was actually taken — a mythic must not sound like a common.
       *
       * Rarity is on the card in words, as a letter and as a pip count, so this
       * is a second channel for something already legible and never the only
       * one.
       */
      sfx('reward')
      if (card.kind === 'item' && card.item) sfxRarity(card.item.rarity)
      else sfx('upgrade')
      let nextRoster = roster
      let nextInv = inventory
      let nextMods = runMods
      // The hand was dealt with the drought's luck but did not spend it (F4):
      // a hand of three is one pick, and the two cards that go in the bin are
      // not drops. The counter moves here, for the card actually taken — and
      // only when that card is an item, since a stat card is not a drop either.
      let nextPity = lootPity
      if (card.kind === 'item' && card.item) {
        nextInv = [...inventory, card.item]
        nextPity = { ...lootPity }
        creditPity(nextPity, card.item.rarity)
      } else if (card.grant) {
        const g = card.grant
        nextRoster = roster.map((s) => ({
          ...s,
          stats: {
            ...s.stats,
            str: s.stats.str + (g.stats?.str ?? 0),
            dex: s.stats.dex + (g.stats?.dex ?? 0),
            int: s.stats.int + (g.stats?.int ?? 0),
          },
          thorns: s.thorns + (g.thorns ?? 0),
          patience: s.patience + (g.patience ?? 0),
        }))
        if (g.mods) nextMods = [...runMods, g.mods]
      }
      // Applying a reward returns to the map — or to the mid-map fork if it fired.
      set({
        roster: nextRoster,
        inventory: nextInv,
        runMods: nextMods,
        lootPity: nextPity,
        reward: null,
        screen: get().crossroads ? 'crossroads' : 'map',
        activeNodeId: null,
        currentWave: null,
        lastResult: null,
        lastLoot: [],
        battlePhase: 'setup',
        ...CLEAR_SHELL,
      })
    },

    recruitTeammate: (sentinelId) => {
      const { crossroads, roster } = get()
      if (!crossroads) return
      // ---- the fork is once-per-run and EXCLUSIVE (F2) ---------------------
      //
      // `chooseHeroMutation` deliberately leaves `crossroads` non-null so the
      // reveal can render, with `crossroads.recruits` still populated — so
      // without this line, mutating and then recruiting took BOTH branches of a
      // "recruit OR mutate" fork: roster 1 → 2 and two ×1.05 Threat taxes off
      // one crossroads. `aimHeroMutation` and `chooseHeroMutation` have carried
      // the `revealed` guard all along; this one was missed, and was held shut
      // only by both UIs early-returning on `cr.revealed`.
      //
      // The guard belongs on the ACTION, not on the screen — same rule as
      // `startWave` (see the C-1 note above): whatever a future screen or a
      // restored snapshot renders, the branch is closed once the fork is
      // answered. The mirror case needs no guard: `recruitTeammate` nulls
      // `crossroads`, which is what the mutation actions already refuse on.
      if (crossroads.revealed) return
      const hero = crossroads.recruits.find((s) => s.id === sentinelId)
      if (!hero || roster.length >= MAX_ROSTER) return
      set({
        ...withRecruits(roster, get().evolutionQueue, [hero]),
        crossroads: null,
        screen: 'map',
        threat: get().threat * THREAT_PER_CHOICE,
      })
    },

    aimHeroMutation: (heroId) => {
      const { crossroads, roster } = get()
      if (!crossroads || crossroads.revealed) return
      // Aiming at nobody is a legitimate "back out of the mutation branch".
      if (heroId !== null && !roster.some((s) => s.id === heroId)) return
      set({ crossroads: { ...crossroads, mutationHeroId: heroId } })
    },

    // The old name, pointed at the new behaviour so the shell keeps compiling
    // while it is rewired. It used to roll AND commit in one tap.
    rollHeroMutation: (heroId) => get().aimHeroMutation(heroId),

    chooseHeroMutation: (heroId, mutationId) => {
      const { crossroads, roster } = get()
      if (!crossroads || crossroads.revealed) return
      const hero = roster.find((s) => s.id === heroId)
      if (!hero) return
      // Only ever one of the options that were actually offered — a mutation id
      // from anywhere else would be a reroll by another name.
      const mutation = crossroads.mutations.find((m) => m.id === mutationId)
      if (!mutation) return
      // One of each key per hero: the offer excludes held keys already, but the
      // rule belongs on the commit, which is the thing that is irreversible.
      if ((hero.mutations ?? []).some((m) => m.key === mutation.key)) return
      const nextRoster = roster.map((s) =>
        s.id === heroId ? { ...s, mutations: [...(s.mutations ?? []), mutation] } : s,
      )
      set({
        roster: nextRoster,
        crossroads: { ...crossroads, mutationHeroId: heroId, revealed: { heroName: hero.name, mutation } },
        // The Threat tax is paid on the COMMITMENT, not on looking at the offer.
        threat: get().threat * THREAT_PER_CHOICE,
      })
    },

    finishCrossroads: () => set({ crossroads: null, screen: 'map' }),

    continueAfterWave: () => {
      // Endless returns to the Rooms screen; campaign returns to the node map.
      const st = get()
      const dest = st.mode === 'endless' ? 'endless' : 'map'
      // A reward that has not been taken is still owed. Leaving the summary is
      // "I've read this", not "I forfeit my pick" — the campaign's reward board
      // lives on the map screen, so it is waiting there. Clearing it here meant
      // that dismissing the summary silently threw the pick away.
      set({
        screen: dest,
        activeNodeId: null,
        currentWave: null,
        lastResult: null,
        lastLoot: [],
        reward: st.reward,
        battlePhase: 'setup',
        ...CLEAR_SHELL,
      })
    },

    // ---- events ----
    buyMerchantItem: (itemId) => {
      const { merchant, gold, inventory, lootPity } = get()
      if (!merchant) return
      const entry = merchant.items.find((e) => e.item.id === itemId)
      if (!entry || gold < entry.price) return
      // The sale is the drop, so the sale is what charges the pity counter (F4).
      // The three items the player walked past are not drops and cost nothing.
      const pity = { ...lootPity }
      creditPity(pity, entry.item.rarity)
      // Buying was entirely silent — the one moment in the game where gold
      // leaves and something is acquired. Coin first, then the tier's sting, so
      // it reads as "paid, and look what for".
      sfx('coin')
      sfxRarity(entry.item.rarity)
      set({
        gold: gold - entry.price,
        inventory: [...inventory, entry.item],
        lootPity: pity,
        merchant: { ...merchant, items: merchant.items.filter((e) => e.item.id !== itemId) },
      })
    },

    buyMerchantRecruit: () => {
      const { merchant, gold, roster } = get()
      if (!merchant?.recruit || gold < merchant.recruit.price || roster.length >= MAX_ROSTER) return
      set({
        gold: gold - merchant.recruit.price,
        ...withRecruits(roster, get().evolutionQueue, [merchant.recruit.sentinel]),
        merchant: { ...merchant, recruit: null },
        threat: get().threat * THREAT_PER_CHOICE,
      })
    },

    leaveEvent: () => {
      const { event } = get()
      if (event) completeNode(get, set, event.nodeId)
    },

    acceptShrine: () => {
      const { shrineOffer, roster, baseHp, gold, event } = get()
      if (!shrineOffer || !event) return
      const eff = shrineOffer.apply({ roster, baseHp, gold })
      const newBaseHp = Math.max(1, baseHp + (eff.baseHpDelta ?? 0))
      // A shrine that hands over coin was the one currency gain in the game with
      // no sound at all (F12). Only a GAIN sounds: a shrine that takes gold is
      // paying for something else, and that something has its own voice.
      if ((eff.goldDelta ?? 0) > 0) sfx('coin')
      set({
        roster: eff.roster ?? roster,
        baseHp: newBaseHp,
        gold: Math.max(0, gold + (eff.goldDelta ?? 0)),
        threat: get().threat * THREAT_PER_CHOICE, // a stronger team draws a stronger foe
      })
      completeNode(get, set, event.nodeId)
    },

    declineShrine: () => {
      const { event } = get()
      if (event) completeNode(get, set, event.nodeId)
    },

    acceptRecruit: (sentinelId) => {
      const { recruitOptions, roster, event } = get()
      if (!event) return
      const pick = recruitOptions.find((s) => s.id === sentinelId)
      if (pick && roster.length < MAX_ROSTER) {
        set({ ...withRecruits(roster, get().evolutionQueue, [pick]), threat: get().threat * THREAT_PER_CHOICE })
      }
      completeNode(get, set, event.nodeId)
    },

    skipRecruit: () => {
      const { event } = get()
      if (event) completeNode(get, set, event.nodeId)
    },

    // ---- items / detail / evolution ----
    openDetail: (id) => set({ detailId: id }),
    closeDetail: () => set({ detailId: null }),
    openEquip: (sentinelId, tab = 'all') => set({ equipContext: { sentinelId, tab } }),
    closeEquip: () => set({ equipContext: null }),

    equipItem: (sentinelId, slot, itemId) => {
      const { roster, inventory } = get()
      const item = inventory.find((i) => i.id === itemId)
      if (!item || !heroSlotsFor(item.slot).includes(slot)) return
      let nextInv = inventory.filter((i) => i.id !== itemId)
      const ret = (it: Item | null) => { if (it) nextInv = [...nextInv, it] }
      const nextRoster = roster.map((s) => {
        if (s.id !== sentinelId) return s
        const eq = { ...s.equipment }
        if (item.slot === 'twoHand') {
          // two-hander fills the main hand and clears the off hand
          ret(eq.mainHand); ret(eq.offHand)
          eq.mainHand = item; eq.offHand = null
        } else if (slot === 'offHand' && eq.mainHand?.slot === 'twoHand') {
          // putting something in the off hand frees the held two-hander
          ret(eq.mainHand); eq.mainHand = null
          ret(eq.offHand); eq.offHand = item
        } else {
          ret(eq[slot]); eq[slot] = item
        }
        return { ...s, equipment: eq }
      })
      set({ roster: nextRoster, inventory: nextInv })
      sfx('equip')
    },

    unequipItem: (sentinelId, slot) => {
      const { roster, inventory } = get()
      const s = roster.find((x) => x.id === sentinelId)
      const item = s?.equipment[slot]
      if (!item) return
      const nextRoster = roster.map((x) =>
        x.id === sentinelId ? { ...x, equipment: { ...x.equipment, [slot]: null } } : x,
      )
      set({ roster: nextRoster, inventory: [...inventory, item] })
    },

    sortInventory: () => set({ inventory: sortItems(get().inventory) }),

    dismantleItem: (itemId) => {
      const { inventory, gold, dust, mode } = get()
      const item = inventory.find((i) => i.id === itemId)
      if (!item) return
      set({
        inventory: inventory.filter((i) => i.id !== itemId),
        gold: gold + scrapGold(item),
        dust: mode === 'endless' ? dust + scrapDust(item) : dust,
      })
      sfx('coin')
    },

    reforge: (itemId) => {
      const { gold } = get()
      const found = findItem(get(), itemId)
      if (!found) return
      const cost = reforgeCost(found.item)
      if (gold < cost) return sfx('error')
      replaceItem(get, set, itemId, reforgeItem(found.item, rng))
      set({ gold: gold - cost })
    },

    upgradeItem: (itemId) => {
      const { gold } = get()
      const found = findItem(get(), itemId)
      if (!found || !canUpgrade(found.item)) return
      const cost = upgradeCost(found.item)
      if (gold < cost) return sfx('error')
      replaceItem(get, set, itemId, upgradeRarity(found.item, rng))
      set({ gold: gold - cost })
    },

    chooseEvolution: (sentinelId, nodeId) => {
      const { roster, evolutionQueue } = get()
      const nextRoster = roster.map((s) => (s.id === sentinelId ? evolveInto(s, nodeId) : s))
      set({ roster: nextRoster, evolutionQueue: evolutionQueue.filter((id) => id !== sentinelId) })
      // A permanent, irreversible branch on a hero you will carry to the end of
      // the run — the biggest single choice the run offers — used to share the
      // three-note blip that buying a tower upgrade gets. It has its own sound
      // now: a riser into a struck chord, so the moment has a before and after.
      sfx('evolve')
    },

    openUpgrade: (sentinelId) => set({ upgradeTarget: sentinelId }),
    closeUpgrade: () => set({ upgradeTarget: null }),
    openInventory: () => set({ inventoryOpen: true }),
    closeInventory: () => set({ inventoryOpen: false }),

    // ---- Root Shell ----
    // Tapping a placed tower on the field. The legacy UI opens its upgrade
    // modal off `upgradeTarget`; the shell puts the same hero in the Context
    // panel on its Upgrades tab. Deliberately leaves `selectedSentinelId`
    // alone — tapping a tower inspects it, it does not pick it up.
    focusTower: (sentinelId) =>
      set({
        upgradeTarget: sentinelId,
        shellSelection: { kind: 'hero', id: sentinelId },
        heroTab: 'upgrades',
        gearSlot: null,
      }),

    // Selecting a hero is also what arms it for placement, so the Selector's
    // one gesture both fills the Context panel and picks up the tower.
    shellSelect: (sel) => {
      const prev = get().shellSelection
      const same = prev && sel && prev.kind === sel.kind && prev.id === sel.id
      const next = same ? null : sel
      set({
        shellSelection: next,
        heroTab: next?.kind === 'hero' && prev?.kind === 'hero' && prev.id === next.id ? get().heroTab : 'stats',
        gearSlot: null,
        selectedSentinelId: next?.kind === 'hero' ? next.id : null,
      })
    },

    setHeroTab: (tab) => set({ heroTab: tab, gearSlot: null }),

    activateGearSlot: (sentinelId, slot) => set({ gearSlot: { sentinelId, slot } }),
    clearGearSlot: () => set({ gearSlot: null }),

    buyTowerUpgrade: (sentinelId, pathId) => {
      const { roster, gold } = get()
      const s = roster.find((x) => x.id === sentinelId)
      const path = getUpgradePath(pathId)
      if (!s || !path) return
      // Buy toward the next EFFECTIVE level (free grants from gear/mutations
      // already fill the lowest levels), so a granted L1 means your first
      // purchase is L2 at L2's price.
      const eff = effectiveUpgradeLevels(s)[pathId] ?? 0
      if (eff >= path.levels.length) return
      const nextLevel = eff + 1
      if (s.level < milestoneForLevel(nextLevel)) return sfx('error')
      const cost = path.levels[nextLevel - 1].cost
      if (gold < cost) return sfx('error')
      const bought = s.upgrades?.[pathId] ?? 0
      const nextRoster = roster.map((x) =>
        x.id === sentinelId ? { ...x, upgrades: { ...x.upgrades, [pathId]: bought + 1 } } : x,
      )
      set({ roster: nextRoster, gold: gold - cost })
      sfx('upgrade')
    },
  }
})

/**
 * Assemble the run receipt (M14 / H23).
 *
 * Built at the moment the run ends, from the state that is still live, because
 * every path out of a finished run tears that state down. `nextBanner` is what
 * turns a win into a reason to play again: beating the campaign under Banner N
 * is what earns the right to be *asked* about Banner N+1 — an NG+ that changes
 * the rules rather than a difficulty slider.
 */
function buildRecap(
  st: GameState,
  result: BattleResult,
  info: {
    won: boolean
    depth: number
    marks: number
    kills: number
    downs: number
    spoils?: Item[]
    roster?: Sentinel[]
  },
): RunRecap {
  const roster = info.roster ?? st.roster
  const byId = new Map(roster.map((s) => [s.id, s]))
  const heroes = result.perSentinel
    .map((p) => {
      const s = byId.get(p.id)
      return {
        id: p.id,
        name: s?.name ?? p.id,
        build: s ? buildName(s) : '—',
        level: s?.level ?? 1,
        kills: p.kills,
        damage: Math.round(p.damageDealt),
        downed: p.downed,
      }
    })
    .sort((a, b) => b.damage - a.damage)
  const unlockedBanners = useMetaStore.getState().sacrificeTier
  return {
    won: info.won,
    mode: st.mode,
    seed: st.runSeed,
    // The seed alone does not reproduce the run; the pair does (F6).
    assist: useSettingsStore.getState().assist,
    depth: info.depth,
    rounds: st.wins,
    banner: st.runBanner,
    marks: info.marks,
    kills: info.kills,
    downs: info.downs,
    goldLeft: st.gold,
    threat: st.threat,
    heroes,
    leaks: result.leakDamage,
    enemiesLeaked: result.enemiesLeaked,
    // Winning promotes you one rung, up to what the Watchtower has opened.
    nextBanner: info.won ? Math.min(unlockedBanners, Math.min(MAX_BANNER, st.runBanner + 1)) : st.runBanner,
    spoils: info.spoils ?? [],
  }
}

/**
 * Consume a non-battle node: mark it cleared, advance the map — and advance
 * Threat, which is the part that used to be missing.
 *
 * Battle clears run through `finishWave`, which charges `THREAT_PER_NODE.normal`
 * / `.elite`. This is the other half of the same rule: **every node the player
 * consumes advances Threat**, specials at the smaller `.special` step. Before
 * this, routing through a merchant / shrine / recruit skipped a difficulty step
 * outright, so the special node paid a reward *and* made the run cheaper.
 *
 * The step is charged off the node's own type rather than assumed, and only
 * once — a node already in `clearedNodeIds` charges nothing — so neither a
 * future caller nor a replayed snapshot can double-bill a run.
 */
function completeNode(
  get: () => GameState,
  set: (partial: Partial<GameState>) => void,
  nodeId: string,
): void {
  const { runMap, clearedNodeIds, threat } = get()
  const alreadyCleared = clearedNodeIds.includes(nodeId)
  const node = runMap.nodes.find((n) => n.id === nodeId)
  const type = node?.type
  // A node this map does not have, or one already consumed, is not a node to
  // march onto: answer the offer and leave the frontier exactly where it is
  // (F1). Advancing off it is the rewind — `currentNodeId` moves backwards and
  // `reachableNodeIds` is rebuilt from a branch the run never routed to.
  // `selectNode` now makes a stale event unreachable in the first place; this is
  // the belt to that braces, for any route that still manufactures one.
  if (!node || alreadyCleared) {
    set({
      event: null,
      merchant: null,
      shrineOffer: null,
      recruitOptions: [],
      screen: 'map',
      ...CLEAR_SHELL,
    })
    return
  }
  const charges = type === 'merchant' || type === 'shrine' || type === 'recruit'
  const cleared = alreadyCleared ? clearedNodeIds : [...clearedNodeIds, nodeId]
  set({
    clearedNodeIds: cleared,
    currentNodeId: nodeId,
    reachableNodeIds: neighborsOf(runMap, nodeId).filter((id) => !cleared.includes(id)),
    threat: charges ? threat * THREAT_PER_NODE.special : threat,
    event: null,
    merchant: null,
    shrineOffer: null,
    recruitOptions: [],
    screen: 'map',
    ...CLEAR_SHELL,
  })
}

export const rarityColor = (r: ItemRarity) => RARITY[r].color

// ---------------------------------------------------------------------------
// Run persistence (C3)
//
// Rather than sprinkle save() calls through thirty actions — where the one that
// gets forgotten is the one that loses a run — the snapshot is driven off the
// store itself: any change to a field that is part of the run schedules a write.
// A battle can't dirty this on a per-frame basis, because the loop only ever
// touches `hud`, which is not watched.
// ---------------------------------------------------------------------------

/** The state fields that constitute "the run". Changing any of them re-saves. */
const SNAPSHOT_FIELDS = [
  'mode',
  'runSeed',
  'screen',
  'runPhase',
  'runMap',
  'currentNodeId',
  'clearedNodeIds',
  'reachableNodeIds',
  'event',
  'battleMap',
  'roster',
  'placements',
  'gold',
  'baseHp',
  'maxBaseHp',
  'enemyHpMult',
  'threat',
  'runBanner',
  'inventory',
  'runKills',
  'runDowns',
  'marksEarned',
  // Persisted state, so a change to it has to be able to trigger a write (M9).
  // In practice it only ever moves alongside `inventory` / `reward` / `merchant`,
  // but a dirty-check that omits a snapshotted field is a latent stale save.
  'lootPity',
  'activeNodeId',
  'currentWave',
  'battlePhase',
  'tactics',
  // Run-material, not presentation (C-1): `lastResult` is what says the wave at
  // `activeNodeId` has already been fought and paid for. Leaving it out is what
  // let a post-battle snapshot come back as a pre-battle one.
  'lastResult',
  'lastLoot',
  'merchant',
  'shrineOffer',
  'recruitOptions',
  'reward',
  'runMods',
  'crossroads',
  'forkDone',
  'evolutionQueue',
  'dust',
  'lives',
  'wins',
  'round',
  'endlessRecruitCost',
  'endlessRoom',
] as const satisfies readonly (keyof GameState)[]

/**
 * A run is worth saving only while it is live and outside the Watchtower. A
 * finished run (won/lost) has already been paid out, so keeping its snapshot
 * would offer a resume into a dead run.
 *
 * `runSettled` is the third condition and the one that closes M-1: a run that
 * has been paid out is dead even though `runPhase` still reads 'active' and
 * even if something puts `screen` back to a battle or the map. Without it,
 * settling a live run wrote it straight back out on the next autosave and the
 * next settle paid it all over again.
 */
const isLiveRun = (s: GameState): boolean =>
  s.runPhase === 'active' && s.screen !== 'hub' && !s.runSettled

/**
 * Whether THIS session has a run of its own on the line.
 *
 * Without this, a boot that sits in the hub showing the resume prompt would
 * count as "no live run" and the first `pagehide` — which a plain reload
 * fires — would delete the very snapshot the player was being offered. A
 * snapshot is only ever cleared by the session that owns the run it belongs to,
 * or by an explicit discard.
 */
let sessionOwnsRun = false

/** Write (or clear) the run snapshot right now, synchronously. */
export function flushRunSnapshot(): void {
  const s = useGameStore.getState()
  if (isLiveRun(s)) {
    sessionOwnsRun = true
    saveSnapshot(captureRun(s, streamPositions(s)))
    return
  }
  // The run this session was playing has ended (won, lost, or abandoned to the
  // hub) — that, and only that, retires the snapshot.
  if (sessionOwnsRun) {
    sessionOwnsRun = false
    clearSnapshot()
  }
}

/** The persisted run, if there is a usable one. Null once it has been consumed. */
export function peekSavedRun(): RunSnapshot | null {
  return loadSnapshot()
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let lastFields: unknown[] = []

function scheduleSnapshot(s: GameState): void {
  const next = SNAPSHOT_FIELDS.map((k) => s[k])
  if (next.length === lastFields.length && next.every((v, i) => v === lastFields[i])) return
  lastFields = next
  if (saveTimer) return
  // Coalesce the burst of sets a single action fires into one write.
  saveTimer = setTimeout(() => {
    saveTimer = null
    flushRunSnapshot()
  }, 0)
}

let persistenceInstalled = false

/**
 * Start persisting the run. Called once from `main.tsx`; kept out of module
 * scope so the headless balance harness can import the store without ever
 * touching storage or the DOM.
 */
export function installRunPersistence(): void {
  if (persistenceInstalled) return
  persistenceInstalled = true
  lastFields = SNAPSHOT_FIELDS.map((k) => useGameStore.getState()[k])
  useGameStore.subscribe(scheduleSnapshot)
  // Backgrounding a tab on a phone is routine and can be the last thing that
  // happens before the OS reclaims it, so the write has to be synchronous here
  // rather than waiting on the coalescing timer.
  //
  // The beat is settled FIRST (H18). A snapshot taken mid-hold would describe a
  // battle that is still in progress and has in fact already resolved — the
  // exact incoherent-resume shape C-1 exists to prevent — and the hold's timer
  // may never fire again if the OS reclaims the tab. Settling is idempotent and
  // a no-op when no beat is running.
  onAppHidden(() => {
    useGameStore.getState().skipWaveBeat()
    flushRunSnapshot()
  })
}
