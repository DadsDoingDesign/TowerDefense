/**
 * ---------------------------------------------------------------------------
 * One campaign run, simulated — with the hub, the difficulty step and the
 * route as parameters (M19-f).
 * ---------------------------------------------------------------------------
 *
 * §11's "realistic first run" used to be a private function inside `report.ts`
 * that hardcoded three things it should never have owned:
 *
 *  1. **zero meta** — so nothing could ask what a hub purchase was worth, and a
 *     120-mark unlock that took the campaign from ~20% winnable to ~2% shipped
 *     green;
 *  2. **one routing policy** — `NODE_PREF`, specials-first, which measurement
 *     now shows is the *worst* line available. The 15–35% gate was being
 *     satisfied by a badly-played run;
 *  3. **a loot table the game does not ship** — `generateItem` / -
 *     `generateRewardCards` were called with `{ luck }` alone while every live
 *     call site passes `roster` (type-aware offers) and `pity` (the drought
 *     timer) as well.
 *
 * All three are arguments here. The run itself is the same model — a real
 * `generateRunMap`, the store's real prices, `scaledRecruit`'s real level, the
 * real shrine roll, the real reward hand, real Threat on every node consumed —
 * so §11 measures what it always did, and §12 / §13 can now measure the hub and
 * the Banner ladder *with the same simulator*, which is what makes their
 * numbers comparable to §11's rather than a second opinion.
 */
import { RNG } from '../src/game/core/rng'
import { ALL_SKILLS } from '../src/game/data/skills'
import { recruitSkill, SKILL_MILESTONES, withFirstSkill } from '../src/game/run/skills'
import { chosenHero, resolvePick, rollRecruitBody } from '../src/game/run/heroes'
import { BASIC_ITEM_KINDS } from '../src/game/data/itemKinds'
import { lookOf } from '../src/game/data/gear'
import {
  creditPity,
  generateItem,
  newRarityPity,
  RARITY_ORDER,
  type RarityPity,
  type RosterRef,
} from '../src/game/data/items'
import { rollMutationChoices } from '../src/game/data/mutations'
import type { RewardCard } from '../src/game/data/rewards'
import { relicTeamMods } from '../src/game/data/relics'
import { afterFightRelics, diaryXp, handSize, hiresTrained, equipRules, rewardHand, shelfSize, takeRelicOn, withRelicStats } from '../src/game/run/relics'
import { generateRunMap, type MapNode, type MapOptions } from '../src/game/data/runmap'
import { rollShrine } from '../src/game/data/shrines'
import { fieldFor, mapById } from '../src/game/data/maps'
import { actFieldId, groundFor, type FieldState } from '../src/game/run/fields'
import type { GameMap } from '../src/game/types'
import { nodeHazardSeed, nodeTerrainRule } from '../src/game/run/terrain'
import { encounterSeed, type EncounterKind } from '../src/game/data/waves'
import { applyXp, xpToReach } from '../src/game/engine/leveling'
import { ACT_LAYERS, RUN_LAYERS, nodeThreatMult, threatAfterLayer, threatAtLayer, clearBonusGold, nodeClearLuck } from '../src/game/run/threat'
import { hashSeed } from '../src/game/core/rng'
import { MAX_BASE_HP } from '../src/game/run/economy'
import { cargoPct, cashOutValue, CITY_COUNT, cityOfLayer, cityPay, contractStake, DEFAULT_PURSE, kindCompany, skillCompany, stakeRules, weightPool } from '../src/game/run/contracts'
import { routePrice, sovereignPool } from '../src/game/run/charter'
import { companyById, type CompanyId } from '../src/game/data/companies'
import { levelXpAwards, stopXp } from '../src/game/run/battle'
import { addDifficultyElites, forkFires } from '../src/game/run/map'
import { GATE_REPAIR, repairGate } from '../src/game/run/economy'
import { canTrain, restAtCampfire, restGain, trainAtCampfire } from '../src/game/run/campfire'
import { BASE_DEAL, homeGold, homeTotal, NO_ORDERS, ROAD_SHARE, roadShareFor, type DealRules, type HqOrders } from '../src/game/run/hq'
import { stow } from '../src/game/run/inventory'
import { useMetaStore } from '../src/state/metaStore'
import { difficultyRules, type DifficultyRules } from '../src/game/run/watch'
import type { Archetype, FocusMode, Item, ItemRarity, Sentinel } from '../src/game/types'
import type { EngineRules } from '../src/game/engine/engine'
import { autoEquipEmpty, type EquipRules } from '../src/game/engine/kit'
import {
  bestSkills,
  forcedSkills,
  randomSkills,
  STARTER_SKILL_POOL,
  bestSlotGain,
  bestSlots,
  buildSpec,
  TIER2_NODES,
  equipAndDisplace,
  heroDps,
  ITEM_PRICE,
  MAX_ROSTER,
  RECRUIT_PRICE,
  runBattle,
  scaledRecruitLevel,
  PLAYER,
  type PlayerPolicy,
} from './harness'

/** The campaign is ten nodes deep on a default map; a wide map is longer. */
export const NODES = RUN_LAYERS - 1

// ---------------------------------------------------------------- hub state
/**
 * Everything the HQ grants a run, read from the **real store** rather than
 * re-derived here: `bonuses()` for the Opening deal, `runHq()` for the run's
 * terms (pack slots, cleared boulders, focus) and `unlocked()` for the map and
 * hire services, exactly as `beginCampaign` / `pickStartingHero` /
 * `mapOptionsFor` read them. A sweep that re-implements the HQ cannot catch
 * the HQ drifting.
 */
export interface Loadout {
  label: string
  maxBaseHp: number
  /** The purse the run sets out with. */
  startGold: number
  extraSentinels: number
  /** HR's Opening deal. */
  deal: DealRules
  /** Pack slots (Operations). */
  pack: number
  /** Seeded boulders cleared from every field (Operations). */
  rocks: number
  /** Company focus (Operations): the company and its boost in points. */
  focus: { company: CompanyId | null; boost: number } | null
  /**
   * Hub multiplier on the run's payout. Always 1 since the Chronicler line was
   * removed; kept as a parameter so a payout multiplier fails loudly if one is
   * ever sold again.
   */
  markMult: number
  wideMap: boolean
  extraRecruit: boolean
  standingOrders: boolean
}

/** An HQ state for a sweep: levels bought, the company in focus, and the orders paid. */
export interface HqState {
  upgrades: Record<string, number>
  focus?: CompanyId | null
  orders?: Partial<HqOrders>
}

/** Build a {@link Loadout} by asking the live meta store what this HQ state buys. */
export function loadoutFor(label: string, hq: HqState | Record<string, number>): Loadout {
  const st: HqState = 'upgrades' in hq && typeof hq.upgrades === 'object' ? (hq as HqState) : { upgrades: hq as Record<string, number> }
  const prev = useMetaStore.getState()
  const keep = { upgrades: prev.upgrades, focus: prev.focus, orders: prev.orders }
  useMetaStore.setState({ upgrades: st.upgrades, focus: st.focus ?? null, orders: { ...NO_ORDERS, ...st.orders } })
  const s = useMetaStore.getState()
  const b = s.bonuses()
  const hqRun = s.runHq()
  const out: Loadout = {
    label,
    maxBaseHp: b.maxBaseHp,
    startGold: DEFAULT_PURSE,
    extraSentinels: b.extraSentinels,
    deal: b.deal,
    pack: hqRun.pack,
    rocks: hqRun.rocks,
    focus: hqRun.focus ? { company: hqRun.focus, boost: hqRun.boost } : null,
    markMult: 1,
    wideMap: s.unlocked('cartographer'),
    extraRecruit: s.unlocked('freeCompanies'),
    standingOrders: s.unlocked('standingOrders'),
  }
  useMetaStore.setState(keep)
  return out
}

/**
 * The HQ states the sweeps measure (§12, `meta-sweep`, `tune`). The modelled
 * player's choices are the sensible ones: each office alone at its top level,
 * then everything — orders paid, and the focus on Ironvein (the shield and
 * mail company: the pieces a first militia leans on).
 */
export const HQ_STATES: [string, HqState][] = [
  ['zero HQ', { upgrades: {} }],
  ['Opening deal 3 (dressed, Rare body, pick 1 of 4)', { upgrades: { deal: 3 } }],
  ['Opening deal 5 (+ Level 2 skill, a second hero)', { upgrades: { deal: 5 } }],
  ['Hiring Hall', { upgrades: { hiring: 1 } }],
  ['Scouts 2', { upgrades: { scouting: 2 } }],
  ['Pack slots 10', { upgrades: { pack: 4 } }],
  ['Fewer boulders 3 + clear order', { upgrades: { rocks: 3 }, orders: { rocks: true } }],
  ['Focus Ironvein +60%', { upgrades: { focus: 3 }, focus: 'metals', orders: { focus: true } }],
  [
    'everything the HQ sells',
    { upgrades: { deal: 5, hiring: 1, rate: 3, pack: 4, rocks: 3, focus: 3, scouting: 2 }, focus: 'metals', orders: { rocks: true, focus: true } },
  ],
]

export const ZERO_META: Loadout = loadoutFor('zero meta', { upgrades: {} })

/** `run/map.mapOptionsFor`, read off a loadout instead of the live hub. */
export const mapOptionsFor = (m: Loadout): MapOptions => ({
  wideMap: m.wideMap,
  extraRecruit: m.extraRecruit,
  standingOrders: m.standingOrders,
})

// ------------------------------------------------------------ route policies
/** What a policy is allowed to look at when it picks the next node. */
export interface RunView {
  roster: Sentinel[]
  gold: number
  baseHp: number
  threat: number
  layer: number
  layers: number
  maxBaseHp: number
}

export interface RoutePolicy {
  id: string
  label: string
  /** Pick one of the nodes reachable from where the company stands. */
  pick: (candidates: MapNode[], view: RunView) => MapNode
}

/** The share of the Gate at or below which every modelled player heads for a campfire. */
const GATE_HURT = 0.6

/** A policy that ranks node *types* on a fixed table — the shape §11 shipped. */
function prefPolicy(id: string, label: string, pref: Record<string, number>): RoutePolicy {
  // Even a fixed-table player can see that a full company cannot hire: a
  // recruit stop with no room for the recruit ranks below everything. Maps
  // carry more hiring stops since Phase 3b, and a model that walked into them
  // with a full roster measured `Free Companies` (a SECOND hiring stop) as a
  // −9pt trap on the recruits line — the purchase was not the defect.
  //
  // …and that a hurt Gate needs the fire. The Gate bar is on screen for the
  // whole run and a campfire's first offer is its repair, so a player of ANY
  // table who is down to 60% of the Gate walks to the fire when the road offers
  // one (the same line the adaptive policy and the store's rest rule use). A
  // model that marched into its fourth act-3 battle on 5 Gate HP with a
  // campfire beside it measured the wide map's extra fights as a −3.5pt trap
  // on the battles-first line: the purchase was not the defect, the blindness was.
  const rank = (n: MapNode, v: RunView) =>
    n.type === 'recruit' && v.roster.length >= MAX_ROSTER
      ? 0.5
      : n.type === 'campfire' && v.baseHp <= v.maxBaseHp * GATE_HURT
        ? 8
        : n.type === 'merchant' && v.baseHp <= v.maxBaseHp * GATE_HURT && v.gold >= GATE_REPAIR.price
          ? 7
          : (pref[n.type] ?? 0)
  return {
    id,
    label,
    pick: (cands, v) => cands.reduce((a, b) => (rank(b, v) > rank(a, v) ? b : a)),
  }
}

/**
 * The four lines §11 grades. They exist because a single hardcoded policy makes
 * the win-rate gate a measurement of *that policy* — and the one §11 shipped
 * turns out to be the worst of the four, so the band was being satisfied by a
 * badly-played run while the best line sat several points higher.
 */
export const POLICIES: RoutePolicy[] = [
  // The line §11 used to hardcode: every special beats every battle.
  prefPolicy('specials', 'specials-first (the shipped heuristic)', {
    recruit: 5, campfire: 4.5, merchant: 4, shrine: 3, battle: 2, elite: 1, miniboss: 9, boss: 9,
  }),
  // An elite always pays a relic since Phase 3b, so the fight-first lines rank
  // it as a fight — just under a plain battle — rather than last.
  prefPolicy('battles', 'battles-first', { battle: 5, elite: 4.8, recruit: 4, merchant: 3, campfire: 2.5, shrine: 2, miniboss: 9, boss: 9 }),
  prefPolicy('recruits', 'recruits, else battles', {
    recruit: 6, battle: 5, elite: 4.5, campfire: 3.5, merchant: 3, shrine: 2, miniboss: 9, boss: 9,
  }),
  {
    id: 'adaptive',
    label: 'adaptive (reads the run state)',
    /**
     * The one policy that answers "is this stop worth a Threat step *to me,
     * now*". A recruit is worth taking only while there is a slot for it; a
     * merchant only with gold to spend; a shrine is a coin flip and an elite is
     * a harder fight for a better card, so both sit under a plain battle.
     */
    pick: (cands, v) => {
      const score = (n: MapNode): number => {
        switch (n.type) {
          case 'boss':
          case 'miniboss': return 9
          case 'recruit': return v.roster.length < MAX_ROSTER ? 8 : 0.5
          // The fire is worth a stop when the Gate needs it, or before a boss.
          case 'campfire': return v.baseHp <= v.maxBaseHp * 0.6 ? 7 : 2.5
          case 'merchant': return v.gold >= ITEM_PRICE.rare ? 4 : 0.5
          case 'battle': return 3
          case 'shrine': return v.baseHp > 8 ? 2 : 0.5
          // A healthy company takes the elite's relic; a hurt one walks around it.
          case 'elite': return v.baseHp > v.maxBaseHp * 0.7 ? 3.5 : 1
          default: return 0
        }
      }
      return cands.reduce((a, b) => (score(b) > score(a) ? b : a))
    },
  },
]
export const policyById = (id: string): RoutePolicy => POLICIES.find((p) => p.id === id)!
/**
 * The line §11's gate is read off. The doctrine question — "can a zero-meta run
 * be won, and does the campaign notice whether the player brought a team" — is
 * a question about the ceiling of play, not about how a first-timer stumbles, so
 * the gate follows the best line the policy set finds and the rest are reported
 * as the spread around it.
 */
export const GATE_POLICY = 'best'

// -------------------------------------------------------------- the run
export interface SimOptions {
  meta?: Loadout
  /** The difficulty step the run is played at (SK1; was the Banner). Default step 0. A contract's stake sets it. */
  difficulty?: DifficultyRules
  /**
   * The contract the run is (the mercenary company): its company's route ground
   * and pool weighting, and its stake — the stake's crates ARE the difficulty
   * step (`contracts.stakeRules`), and override `difficulty`. The cities'
   * pay is recorded on the outcome (`RunOutcome.contract`) so a cash-out
   * policy can be priced after the fact (`contractNet`). Omitted: the open
   * road every route used to share, unweighted — exactly the run this model
   * always played.
   */
  contract?: { company: CompanyId | null; crates: number; charter?: boolean }
  /**
   * The Sovereign Route's trade-offs, one switch each (all on by default on a
   * charter): its ground on every fight, the merchants' double prices, and
   * the muster of every goblin clan. §18 turns them off one at a time to
   * price each.
   */
  charterParts?: { ground?: boolean; prices?: boolean; muster?: boolean }
  /**
   * The skill pool the run deals from (SK1). Default: the nine starters — a
   * zero-meta player has unlocked nothing.
   */
  skillPool?: readonly string[]
  /**
   * The item kinds the run deals from (the classless rework): rolled heroes,
   * hires and every drop. Default: the basic five — a zero-meta player has
   * unlocked nothing.
   */
  itemPool?: readonly string[]
  policy?: RoutePolicy
  /**
   * Emulate a change to the `waves.ts` budget curve without editing it: an
   * extra HP multiplier per (depth, kind). Used only by `fit-curve.ts`, which
   * exists so a candidate curve can be measured against both gated models in
   * seconds rather than by editing constants and running the whole suite.
   */
  curve?: (depth: number, kind: EncounterKind) => number
  /**
   * How the modelled player answers a skill milestone (SK1 — levels 5, 10,
   * 15). `random` is the default and what every gate reads: it prices the
   * skill LEVEL rather than a player's read of it. `best` takes whichever move
   * raises `heroDps` most — the "known answer" a spreadsheet player converges
   * on. The gap between the two is how solved the skill layer is. `force` pins
   * picks by `${level}:${look}` (the look its weapon gives it, `gear.lookOf`).
   */
  build?: 'random' | 'best' | { force: Record<string, string> }
  /** Relics held from the first node (§15 grades the run-rule half this way). */
  startRelics?: string[]
  /**
   * Who presses the in-battle buttons (Phase 3a). Default {@link PLAYER}: the
   * Rally Horn spent when the fight is on, no repositioning, first-in-lane.
   */
  player?: PlayerPolicy
  /** Targeting order the company fights under (default first-in-lane). */
  focus?: FocusMode
  /** Counterfactual engine switches (REPORT §16 only). */
  rules?: Partial<EngineRules>
  /** `false`: every node as one continuous wave (the pre-3a shape; counterfactuals only). */
  subWaves?: boolean
  /** Per-sub-wave safety cap (default 600s; counterfactuals only). */
  maxSeconds?: number
  /** Diagnostics: told about every fight the run takes (never changes the run). */
  onFight?: (f: { layer: number; type: string; hpBefore: number; hpAfter: number; cleared: boolean; roster: number; level: number }) => void
}

export interface RunOutcome {
  /** Layer of the deepest node cleared — comparable across map lengths. */
  reached: number
  /** Nodes consumed, the number `grantRunRewards` is paid on (`depth`). */
  cleared: number
  won: boolean
  battles: number
  roster: number
  bossThreat: number | null
  /** The old Watch Marks formula for this run (kept for the meta sweeps' old columns). */
  marks: number
  /**
   * The contract's ledger, when the run was one: what each city reached paid
   * (at the cargo it arrived with), the purse's gold at that moment, and the
   * gold left when the run ended. `contractNet` turns it into the bank's net.
   */
  contract: null | {
    company: CompanyId | null
    crates: number
    charter?: boolean
    purse: number
    cities: { pay: number; cargo: number; gold: number; earned: number }[]
    goldEnd: number
    /** Gold the road paid into the purse by the end (the road-gold share is taken on it). */
    earned: number
  }
  layers: number
  /** Which battlefield this run's seed dealt for act 1 (WS8); later acts deal their own (`run/fields`). */
  fieldId: string
  /** The leader's LOOK — the old class its weapon draws it as (a sword-hand is `fighter`). */
  starter: Archetype
  /** Nodes consumed that were fights (battle / elite / boss), and all nodes consumed. */
  fights: number
  nodes: number
  /** The leader's level after each layer it cleared, index = layer. */
  levelByLayer: number[]
}


/**
 * Every skill choice a run can be asked to make, keyed the way
 * `SimOptions.build.force` pins them: `${milestone level}:${class}` → the
 * skills of that level the class may hold (SK1). From the full library, so
 * the oracle can pin a card a zero-meta pool does not deal — the pin simply
 * does not fire when the offer lacks it.
 */
export function buildChoicePoints(): { id: string; archetype: Archetype; options: string[] }[] {
  const out: { id: string; archetype: Archetype; options: string[] }[] = []
  for (const archetype of ['fighter', 'rogue', 'mystic'] as const) {
    SKILL_MILESTONES.forEach((level, i) => {
      // Any hero may hold any skill (no classes); the point is keyed by look.
      out.push({ id: `${level}:${archetype}`, archetype, options: ALL_SKILLS.filter((k) => k.level === i + 1).map((k) => k.id) })
    })
  }
  return out
}

const rosterRefs = (roster: Sentinel[]): RosterRef[] => roster



/**
 * Walk one campaign run: deal the map the hub and the difficulty step produce,
 * route it with `policy`, and fight / shop / hire the way the store does.
 */
/**
 * Which of the three dealt heroes the modelled player takes (the classless
 * rework): the first whose LOOK — the old class its weapon draws it as — is
 * `prefer`, else the first dealt. On a zero-meta deal (the basic five kinds)
 * the three always hold a sword, a bow and a wand, one each, so the callers
 * that rotate `prefer` through the three looks still play every kind of
 * leader a third of the time, and §11's per-leader rows keep their meaning.
 */
export function modelledPick(seed: number, skillPool: readonly string[], itemPool: readonly string[], prefer: Archetype, deal: DealRules = BASE_DEAL): string {
  return resolvePick(seed, skillPool, itemPool, prefer, deal)
}

/** Best-coverage-first posts on a base field, worked out once per field. */
const slotsByField = new Map<string, string[]>()
export function slotsOn(m: GameMap): string[] {
  let out = slotsByField.get(m.id)
  if (!out) slotsByField.set(m.id, (out = bestSlots(m)))
  return out
}

export function simulateRun(seed: number, archetype: Archetype, o: SimOptions = {}): RunOutcome {
  const meta = o.meta ?? ZERO_META
  const k = o.contract ?? null
  const charter = !!k?.charter
  const parts = { ground: true, prices: true, muster: true, ...o.charterParts }
  const banner = k ? stakeRules(charter ? 0 : k.crates) : (o.difficulty ?? difficultyRules(0))
  const policy = o.policy ?? POLICIES[0]
  // A contract weights its company's pieces on its own road (`weightPool`), as
  // the store does; the Sovereign Route deals for no company and no focus, and
  // any owned Sovereign kind at its low weight (`contracts.runItemPool`).
  const focus = charter ? null : meta.focus
  const pool = weightPool(o.skillPool ?? STARTER_SKILL_POOL, k?.company, skillCompany, focus)
  const items = sovereignPool(weightPool(o.itemPool ?? BASIC_ITEM_KINDS, k?.company, kindCompany, focus))
  const ground = charter ? (parts.ground ? { charter: true } : {}) : k?.company ? { ground: companyById(k.company).ground.rules } : {}
  // Rosethread's trade-off: every merchant price doubles on the Sovereign Route.
  const price = (n: number) => (charter && parts.prices ? routePrice(n, { company: null, charter: true }) : n)
  const muster = charter && parts.muster
  const cities: { pay: number; cargo: number; gold: number; earned: number }[] = []
  /** A body joining the company: a random hire from the run's kinds, named apart. */
  const recruitBody = (rng: RNG, taken: Sentinel[]): Sentinel => rollRecruitBody(rng, items, taken.map((h) => h.name))

  const rng = new RNG(seed)
  const force = typeof o.build === 'object' ? o.build.force : null
  // SK1: every owed skill milestone is settled where XP lands, as the store
  // offers it (the run seed and the hero's id hash the offer).
  const evolve = (s: Sentinel): Sentinel =>
    o.build === 'best' ? bestSkills(s, pool, seed) : force ? forcedSkills(s, force, rng, pool, seed) : randomSkills(s, rng, pool, seed)
  /** A body's first skill, dealt as `recruitSkill` deals it — a hash, no draw. */
  const firstSkill = (s: Sentinel): Sentinel => withFirstSkill(s, recruitSkill(seed, s.id, pool))
  const levelByLayer: number[] = []
  let nodes = 0
  // The map rides its own stream, as it does in the game (`streams.mapRng`): a hub
  // unlock that reshapes the map must not re-deal every loot roll behind it, or
  // §12's "paired" cells are not paired at all (Phase 3b).
  // SK1: the step's extra elites, on the map, as `dealRunMap` adds them.
  const map = addDifficultyElites(generateRunMap(new RNG(hashSeed(seed, 'map')), mapOptionsFor(meta)), banner.extraElites, seed, meta.standingOrders)
  const byId = new Map(map.nodes.map((n) => [n.id, n]))
  // The battlefield this seed deals, exactly as `freshRunState` deals it (WS8),
  // and — the road changes country at every city — each later act's own field,
  // dealt by the store's own rule (`run/fields.groundFor`) at the act's first
  // fight. Every §11/§12/§13 number is therefore an average over the fields
  // the game actually produces, rather than a measurement of one map.
  let road: FieldState = { fieldId: actFieldId(seed, 1), fieldAct: 1 }
  const field = mapById(road.fieldId)!

  // ---- the company, as `newRun` + `pickStartingHero` deal it ----
  // The kit is dealt AFTER the pick, for the company that exists, and the
  // leader wears its three core pieces — `pickStartingHero`, via the shared
  // `engine/kit.ts`. The hub's extra Sentinels arrive bare, as
  // `pickStartingHero` makes them; Quartermaster's extra rolls go to whoever
  // they improve, and anything they unseat goes to the pack.
  // The classless rework: the leader is one of the hero pick's three random
  // heroes (`modelledPick`), with exactly the gear and skill its card shows —
  // `chosenHero`, the store's own function.
  const leader = chosenHero(seed, pool, items, modelledPick(seed, pool, items, archetype, meta.deal), 0, meta.deal)!
  const starterLook = lookOf(leader)
  let roster: Sentinel[] = [leader]
  for (let i = 0; i < meta.extraSentinels; i++) {
    roster.push(firstSkill(recruitBody(rng, roster)))
  }
  /**
   * What the company owns but is not wearing. The store has always had one
   * (`inventory`); this model used to throw every displaced item away and
   * hand every hire a freshly rolled kit, while the game hires a BARE body.
   * A hire now dresses out of the pack with the store's own empty-slot rule.
   */
  let pack: Item[] = []
  let gold = meta.startGold
  /** Relics taken this run (Phase 3b) — the store's `relics`. Declared here,
   *  before the kit is dressed, because the equip rule reads it (R3-2). */
  let relics: string[] = [...(o.startRelics ?? [])]
  /** The run's equip rules: whether the Twinblade Harness is held (the DEX check is per hero). */
  const rules = (): EquipRules => equipRules(relics)
  /** Gold the road paid into the purse (`contract.earned`): the road-gold share is taken on it. */
  let earned = 0
  /**
   * The new piece goes on, and what it unseats goes to the pack — a full pack
   * (the HQ's pack slots) sells its cheapest pieces into the purse, as
   * `inventory.stow` does in the store.
   */
  const equipOn = (h: number, item: Item) => {
    const r = equipAndDisplace(roster[h], item, rules())
    roster[h] = r.hero
    const st = stow(pack, r.displaced, meta.pack)
    pack = st.inventory
    gold += st.gold
    earned += st.gold
  }

  // A relic held from the first node has already landed its flat stats.
  for (const id of o.startRelics ?? []) roster = takeRelicOn(roster, id)
  let baseHp = meta.maxBaseHp
  let threat = banner.startThreat
  let reached = 0
  let clearedCount = 0
  let battles = 0
  let bossThreat: number | null = null
  let won = false
  const pity: RarityPity = newRarityPity()
  // Filled best-coverage-first on whichever field the act is fought on. This
  // used to be the literal `['s3','s4','s2','s5','s1']` — a Green Line fact
  // hardcoded as a constant, which on the second map names three of its five
  // worst slots. The modelled company re-posts best-first on every field.
  const heroSlots = slotsOn(field)

  const hire = () => {
    const lvl = scaledRecruitLevel(roster, hiresTrained(meta.extraRecruit, relics))
    // A hire arrives bare (`scaledRecruit`) and dresses from the pack with the
    // store's empty-slot rule (`withRecruits` → `autoEquipEmpty`).
    const base = withRelicStats(firstSkill(recruitBody(rng, roster)), relics)
    const dressed = autoEquipEmpty([evolve(lvl <= 1 ? base : applyXp(base, xpToReach(lvl)))], pack, rules())
    pack = dressed.rest
    roster = [...roster, dressed.roster[0]]
  }

  let cur = map.nodes.find((n) => n.type === 'start')!
  for (let guard = 0; guard < 40; guard++) {
    const nexts = map.edges.filter((e) => e.from === cur.id).map((e) => byId.get(e.to)!)
    if (!nexts.length) break
    const node = policy.pick(nexts, { roster, gold, baseHp, threat, layer: cur.layer, layers: map.layers, maxBaseHp: meta.maxBaseHp })
    cur = node
    nodes++

    if (node.type === 'merchant') {
      // Four items rolled the way `selectNode` rolls them — with the roster's
      // damage-type demand and the run's drought luck — at the store's prices,
      // plus a hire at 80g.
      const luck = Math.min(0.4, node.layer * 0.04)
      // The counter's Gate repair, bought when the Gate is hurting (Phase 3b).
      if (baseHp <= meta.maxBaseHp * 0.65 && gold >= price(GATE_REPAIR.price)) {
        gold -= price(GATE_REPAIR.price)
        baseHp = repairGate(baseHp, meta.maxBaseHp)
      }
      const stock = Array.from({ length: shelfSize(relics) }, () =>
        generateItem(rng, { luck, roster: rosterRefs(roster), pity: { ...pity }, commitPity: false, kinds: items }),
      )
      for (let pass = 0; pass < 4; pass++) {
        let best: { item: Item; gain: number; hero: number } | null = null
        for (const it of stock) {
          if (price(ITEM_PRICE[it.rarity]) > gold) continue
          for (let h = 0; h < roster.length; h++) {
            const g = bestSlotGain(roster[h], it, rules())
            if (g > 0 && (!best || g > best.gain)) best = { item: it, gain: g, hero: h }
          }
        }
        if (!best) break
        gold -= price(ITEM_PRICE[best.item.rarity])
        stock.splice(stock.indexOf(best.item), 1)
        equipOn(best.hero, best.item)
        creditPity(pity, best.item.rarity) // `buyMerchantItem` charges the sale
      }
      if (roster.length < MAX_ROSTER && gold >= price(RECRUIT_PRICE)) {
        gold -= price(RECRUIT_PRICE)
        hire()
      }
      // A stop still drills the company: a share of a fight's XP (Phase 3b).
      roster = roster.map((h) => evolve(applyXp(h, stopXp(node.layer))))
      threat = threatAfterLayer(node.layer, banner.startThreat)
      clearedCount++
      reached = Math.max(reached, node.layer)
      continue
    }
    if (node.type === 'recruit') {
      if (roster.length < MAX_ROSTER) hire()
      // A stop still drills the company: a share of a fight's XP (Phase 3b).
      roster = roster.map((h) => evolve(applyXp(h, stopXp(node.layer))))
      threat = threatAfterLayer(node.layer, banner.startThreat)
      clearedCount++
      reached = Math.max(reached, node.layer)
      continue
    }
    if (node.type === 'shrine') {
      const offer = rollShrine(rng)
      const eff = offer.apply({ roster, baseHp, gold })
      // A player takes the pact unless the bill would leave the base on the edge.
      if (-(eff.baseHpDelta ?? 0) < baseHp - 4 && -(eff.goldDelta ?? 0) <= gold) {
        roster = eff.roster ?? roster
        baseHp = Math.max(1, baseHp + (eff.baseHpDelta ?? 0))
        gold = Math.max(0, gold + (eff.goldDelta ?? 0))
        earned += Math.max(0, eff.goldDelta ?? 0)
      }
      // A stop still drills the company: a share of a fight's XP (Phase 3b).
      roster = roster.map((h) => evolve(applyXp(h, stopXp(node.layer))))
      threat = threatAfterLayer(node.layer, banner.startThreat)
      clearedCount++
      reached = Math.max(reached, node.layer)
      continue
    }
    if (node.type === 'campfire') {
      // Rest when the Gate is down more than a rest's worth; otherwise train the
      // hero who carries the most damage (a player trains their carry).
      const hurt = restGain(baseHp, meta.maxBaseHp) >= 5 || baseHp <= meta.maxBaseHp * 0.6
      let who = -1
      for (let h = 0; h < roster.length; h++) {
        if (!canTrain(roster[h])) continue
        if (who < 0 || heroDps(roster[h]) > heroDps(roster[who])) who = h
      }
      if (hurt) baseHp = restAtCampfire(baseHp, meta.maxBaseHp)
      else if (who < 0) baseHp = restAtCampfire(baseHp, meta.maxBaseHp)
      else roster[who] = evolve(trainAtCampfire(roster[who]))
      // A stop still drills the company: a share of a fight's XP (Phase 3b).
      roster = roster.map((h) => evolve(applyXp(h, stopXp(node.layer))))
      threat = threatAfterLayer(node.layer, banner.startThreat)
      clearedCount++
      reached = Math.max(reached, node.layer)
      continue
    }

    // ---- battle / elite / boss ----
    // Two kinds, exactly as `finishBattle` reads them (M19-g): `kind` is the
    // WAVE this node fields, `worth` what the NODE itself costs and pays. Since
    // SK1 a difficulty step's elites are elite NODES, so the two agree.
    const kind: EncounterKind =
      node.type === 'boss' || node.type === 'miniboss' ? 'boss' : node.type === 'elite' ? 'elite' : 'normal'
    const worth: EncounterKind = node.type === 'boss' || node.type === 'miniboss' ? 'boss' : node.type === 'elite' ? 'elite' : 'normal'
    const final = node.type === 'boss'
    if (final) bossThreat = threat
    battles++
    // G1-2: the node's map challenge, exactly as `selectNode` deals it — the
    // company re-deploys best-first on whatever ground the terrain leaves.
    const rule = nodeTerrainRule(node, seed, ground)
    // Q1: and its danger ground + seeded obstacles, from the same node hash.
    const hazard = nodeHazardSeed(node, seed, ground)
    // The act's field (`run/fields`): new ground at each act's first fight.
    road = groundFor(seed, road, node.layer)
    const actField = mapById(road.fieldId) ?? field
    const nodeField = rule || hazard != null ? (fieldFor(actField.id, rule, 'landscape', hazard, meta.rocks) ?? actField) : actField
    const nodeSlots = rule || hazard != null ? bestSlots(nodeField) : actField === field ? heroSlots : slotsOn(actField)
    const m = runBattle({
      team: roster.slice(0, MAX_ROSTER).map((s, i) => ({ sentinel: s, slotId: nodeSlots[i] })),
      depth: node.layer,
      kind,
      map: nodeField,
      autoDeploy: true,
      // The same key `gameStore.selectNode` uses, so a simulated run meets the
      // composition variants the shipped game would deal it (WS8).
      variantSeed: encounterSeed(seed, node.layer),
      variantSibling: node.row,
      enemyHpMult: threat * nodeThreatMult(node.type) * (o.curve?.(node.layer, kind) ?? 1),
      baseHp,
      teamMods: relicTeamMods(relics),
      // A cap, not a clock: the game has no timeout, and sub-waves (Phase 3a)
      // run their groups back to back, so a node now takes longer end to end.
      // Set far above any real clear so a timeout can never be the thing that
      // ends a run (the M19 lesson — every loss was once the clock).
      maxSeconds: o.maxSeconds ?? 600,
      seed: seed * 131 + node.layer,
      player: o.player ?? PLAYER,
      tactics: o.focus ? { focus: o.focus } : undefined,
      rules: o.rules,
      subWaves: o.subWaves,
      muster,
    })
    o.onFight?.({ layer: node.layer, type: node.type, hpBefore: baseHp, hpAfter: m.baseHpLeft, cleared: m.cleared, roster: roster.length, level: roster[0].level })
    baseHp = m.baseHpLeft
    if (!m.cleared || baseHp <= 0) break
    clearedCount++
    reached = Math.max(reached, node.layer)
    // A city (the mercenary company): it pays for the cargo that arrives, as
    // `finishBattle` does — before the after-fight relics mend anything.
    const city = cityOfLayer(node.layer)
    if (k && city != null && (node.type === 'miniboss' || node.type === 'boss')) {
      const cargo = cargoPct(baseHp, meta.maxBaseHp)
      const fight = m.goldEarned + clearBonusGold(node)
      cities.push({ pay: cityPay({ company: k.company, crates: k.crates, market: 1, charter }, city, cargo).total, cargo, gold: gold + fight, earned: earned + fight })
    }
    if (final) { won = true; break }

    const before = gold
    gold += m.goldEarned + clearBonusGold(node)
    // Field Surgeon's Kit and the Tithe Box (`finishBattle` applies the same rule).
    ;({ baseHp, gold } = afterFightRelics(relics, { baseHp, maxBaseHp: meta.maxBaseHp, gold }))
    earned += gold - before
    // Levels are a resource (Phase 3b): the store re-prices a wave's raw XP
    // with `levelXpAwards`, and so does this.
    const awards = levelXpAwards(
      m.perSentinel.map((p) => ({ id: p.id, xpGained: p.xp })),
      { wave: m.wave, hpMult: threat * nodeThreatMult(node.type) * (o.curve?.(node.layer, kind) ?? 1), depth: node.layer, kind: worth },
    )
    const xpById = new Map(diaryXp(awards, roster, relics).map((p) => [p.id, p.xpGained]))
    roster = roster.map((s) => evolve(applyXp(s, xpById.get(s.id) ?? 0)))
    levelByLayer[node.layer] = roster[0].level

    // The reward hand, dealt the way `finishBattle` deals it (Phase 3b): items
    // and relics, an elite always offering a relic, an act boss three.
    const handKind = node.type === 'miniboss' ? 'boss' : node.type === 'elite' ? 'elite' : 'battle'
    const cards = rewardHand(rng, {
      kind: handKind,
      luck: nodeClearLuck(node),
      count: handSize({ thinPickings: false }),
      noBattleRelics: false,
      held: relics,
      roster: rosterRefs(roster),
      pity,
      kinds: items,
    })
    let bestItem: { item: Item; gain: number; hero: number; frac: number } | null = null
    for (const c of cards) {
      if (c.kind !== 'item' || !c.item) continue
      for (let h = 0; h < roster.length; h++) {
        const g = bestSlotGain(roster[h], c.item, rules())
        if (!bestItem || g > bestItem.gain) bestItem = { item: c.item, gain: g, hero: h, frac: g / Math.max(1, heroDps(roster[h])) }
      }
    }
    // The modelled player takes a relic — the best tier on offer, a pact (a
    // relic with a stated downside) counted one tier lower, because it is a bet
    // on the build rather than a gift — unless an item is a big upgrade (≥15% on
    // its wearer); a relic's value is mostly a rule `heroDps` cannot read, so
    // the model does not try to price it.
    const relicRank = (c: RewardCard) => RARITY_ORDER.indexOf(c.rarity) - (c.downside ? 1.5 : 0)
    const relic = cards
      .filter((c) => c.kind === 'relic' && c.relic)
      .sort((a, b) => relicRank(b) - relicRank(a))[0]
    if (bestItem && bestItem.gain > 0 && (!relic || bestItem.frac >= 0.15)) {
      equipOn(bestItem.hero, bestItem.item)
      creditPity(pity, bestItem.item.rarity) // `chooseReward` charges the card taken
    } else if (relic?.relic && !relics.includes(relic.relic)) {
      relics = [...relics, relic.relic]
      roster = takeRelicOn(roster, relic.relic)
    }

    /*
     * ---- the one-time Crossroads, BOTH halves of it (M5) ------------------
     *
     * This used to read "take the free body" and nothing else, so a run that
     * could not hire — a full roster, or Banner 3's `noRecruits` — answered the
     * fork by doing nothing at all. The consequence was larger than the fork:
     * `runsim` is what §11, §12 and §13 are built on, so **no simulated run in
     * the suite ever carried a mutation**, and the Mythic tier — the single most
     * consequential permanent choice the game offers, spanning −21…+52pt of stop
     * rate (§8) — was priced into no win rate anywhere. §8 grades the cards; it
     * cannot tell you what having one does to a campaign.
     *
     * `gameStore.recruitTeammate` / `chooseHeroMutation` are exclusive and both
     * charge `THREAT_PER_CHOICE`, so the model is: take the body if there is
     * room for one, otherwise take a mutation, and pay the same tax either way.
     *
     * The **pick inside the offer is uniform**, deliberately. Every other choice
     * in this simulator is made with `heroDps` — `computeCombat`'s own number,
     * which is what the tooltip shows — and that would be exactly the wrong
     * instrument here: it reads `damage × rate × crit` and is blind to burn,
     * splash, chains, execute and life-drain, i.e. to eight of the eleven cards.
     * A `heroDps` player would take Heavy Ordnance every time and never take
     * Incendiary, and the win rate would be a measurement of that one card. The
     * fork is a read of the run ahead, this model does not attempt that read,
     * and a uniform draw is the honest way to say so — it prices the *tier*.
     */
    if (forkFires(node)) {
      if (roster.length < MAX_ROSTER) {
        hire()
      } else if (roster.length) {
        const held = [...new Set(roster.flatMap((s) => (s.mutations ?? []).map((m) => m.key)))]
        const offer = rollMutationChoices(rng, held, 3)
        if (offer.length) {
          const mutation = rng.pick(offer)
          // Aimed at the strongest carrier, which is the one thing about the
          // aim a player is reliably right about.
          let who = 0
          for (let h = 1; h < roster.length; h++) if (heroDps(roster[h]) > heroDps(roster[who])) who = h
          roster[who] = { ...roster[who], mutations: [...(roster[who].mutations ?? []), mutation] }
        }
      }
    }
    threat = threatAfterLayer(node.layer, banner.startThreat)
  }

  return {
    reached,
    cleared: clearedCount,
    won,
    battles,
    roster: roster.length,
    bossThreat,
    marks: marksFor(clearedCount, won, banner, meta.markMult),
    contract: k ? { company: k.company, crates: charter ? 0 : k.crates, ...(charter ? { charter } : {}), purse: meta.startGold, cities, goldEnd: gold, earned } : null,
    layers: map.layers,
    fieldId: field.id,
    starter: starterLook,
    fights: battles,
    nodes,
    levelByLayer,
  }
}

/**
 * `metaStore.grantRunRewards`'s own formula, for a run that banked `cleared`
 * nodes. Kept in one place so §13's ladder economy is priced with the payout the
 * game actually pays rather than a second copy of it.
 */
export function marksFor(cleared: number, won: boolean, banner: DifficultyRules, chronicler = 1): number {
  return Math.round((cleared * 8 + (won ? 120 : 0)) * chronicler * (1 + 0.25 * banner.step))
}

/**
 * The modelled player's cash-out policy (the mercenary company): at city 1 or
 * 2, head home when the wagons arrive with less than `below` percent of the
 * cargo — a caravan that has lost half its load sells the rest and goes home
 * rather than gambling it. `pressOn`: never cash out.
 */
export interface CashOutPolicy { id: string; label: string; below: number }
export const PRESS_ON: CashOutPolicy = { id: 'press-on', label: 'always press on', below: 0 }
export const CASH_OUT_HALF: CashOutPolicy = { id: 'cash-half', label: 'cash out under 50% cargo', below: 50 }

/**
 * What a contract run did to the bank, net: everything banked (the cities'
 * pay, a cash-out sale, the purse's rest and the road-gold share,
 * `hq.homeGold`) less the stake and the purse it set out with. Under `policy` the run stops at the first city it cashes out at —
 * priced from the same simulated road, so press-on and cash-out lines are
 * paired by construction.
 */
export function contractNet(out: RunOutcome, policy: CashOutPolicy = PRESS_ON): { net: number; pay: number; delivered: boolean; cashedOut: boolean } {
  const c = out.contract
  if (!c) return { net: 0, pay: 0, delivered: out.won, cashedOut: false }
  // What signing cost the bank: the stake, or the Sovereign Route's fee.
  const stake = contractStake(c)
  const outlay = stake + c.purse
  // What the purse brings home: its rest in full, a share of the road's gold.
  // A fall banks less of the road's gold than a finished contract (`hq.roadShareFor`).
  const home = (gold: number, earned: number, share = ROAD_SHARE) => homeTotal(homeGold({ purse: c.purse, earned, gold }, share))
  let paid = 0
  for (let i = 0; i < c.cities.length; i++) {
    const city = c.cities[i]
    paid += city.pay
    const last = i === CITY_COUNT - 1
    // The Sovereign Route cannot be cashed out: all or nothing.
    if (!last && city.cargo < policy.below && !c.charter) {
      const sale = cashOutValue({ company: c.company, crates: c.crates, market: 1 }, i + 1, city.cargo)
      return { net: paid + sale + home(city.gold, city.earned) - outlay, pay: paid + sale - stake, delivered: false, cashedOut: true }
    }
  }
  return { net: paid + home(c.goldEnd, c.earned, roadShareFor(out.won ? 'delivered' : 'lost')) - outlay, pay: paid - stake, delivered: out.won, cashedOut: false }
}

// ---------------------------------------------------------------- §6's model
/**
 * One §6 Monte Carlo run: a random 3–5 spec company, rebuilt at depth-scaled
 * power before every layer, fighting every layer of the three acts on the
 * real Threat curve — act bosses on layers 4 and 8, the final boss on 12, and
 * an elite mid-way through acts 2 and 3. Lives here rather than inline in
 * `report.ts` so the report and `fit-curve.ts` play the SAME model.
 *
 * Power by depth follows the level curve the run layer now pays
 * (`levelXpAwards`): about 2.5 levels a layer, L10 at the first act boss and
 * L20 by depth 8.
 */
export const MC_LAYERS = RUN_LAYERS - 1
export const mcKind = (depth: number): EncounterKind =>
  depth % ACT_LAYERS === 0 ? 'boss' : depth === 6 || depth === 10 ? 'elite' : 'normal'
export const mcLevel = (d: number): number => Math.max(1, Math.min(20, Math.round(2.5 * d)))
/**
 * How much of its eventual 3–5 spec company the model fields at a depth: two
 * heroes in act 1, a third in act 2, the rest in act 3. A company is recruited
 * on the road — the old model fielded all of it, at full rarity, from the first
 * node, which made §6 a measurement of a company no run has at depth 2.
 */
export const mcCompany = (d: number, full: number): number => Math.min(full, 2 + Math.floor((d - 1) / ACT_LAYERS))
export const mcRarity = (d: number): ItemRarity => (d < 4 ? 'common' : d < 10 ? 'rare' : 'epic')

export interface McOutcome {
  reached: number
  died: number
  won: boolean
  bossThreat: number | null
  fieldId: string
  /** Did the run reach the final boss, and did the final boss end it? */
  finalAttempt: boolean
  finalKill: boolean
  /** Battles that ended on the harness cap rather than a win or a loss (must be 0). */
  timeouts: number
}

export function monteCarloRun(
  r: number,
  o: { curve?: (depth: number, kind: EncounterKind) => number; player?: PlayerPolicy; rules?: Partial<EngineRules> } = {},
): McOutcome {
  const runRng = new RNG(hashSeed(r, 'mcteam'))
  const teamSize = 3 + Math.floor(runRng.next() * 3) // 3..5
  const specIds = Array.from({ length: teamSize }, () => runRng.pick(TIER2_NODES).id)
  // Act 1's field, then each act's own, by the store's rule (`run/fields`).
  const mcSeed = hashSeed(r, 'mc')
  let ground: FieldState = { fieldId: actFieldId(mcSeed, 1), fieldAct: 1 }
  const field = mapById(ground.fieldId)!
  let baseHp = MAX_BASE_HP
  let reached = 0
  let died = 0
  let bossThreat: number | null = null
  let finalAttempt = false
  let finalKill = false
  let timeouts = 0
  for (let depth = 1; depth <= MC_LAYERS; depth++) {
    ground = groundFor(mcSeed, ground, depth)
    const actField = mapById(ground.fieldId) ?? field
    const slots = slotsOn(actField)
    const team = specIds.slice(0, mcCompany(depth, specIds.length)).map((id, i) => ({
      sentinel: buildSpec(id, {
        level: mcLevel(depth),
        gearRarity: mcRarity(depth),
        seed: r * 10 + i,
        perkSeed: r * 10 + i,
      }),
      slotId: slots[i],
    }))
    const kind = mcKind(depth)
    const threat = threatAtLayer(depth) * nodeThreatMult(depth === MC_LAYERS ? 'boss' : kind === 'elite' ? 'elite' : 'battle')
    if (depth === MC_LAYERS) { finalAttempt = true; bossThreat = threat }
    // G1-2: map challenges on the same terms the campaign deals them.
    const mcNode = { id: `mc${depth}`, type: depth === MC_LAYERS || kind === 'boss' ? 'boss' : kind === 'elite' ? 'elite' : 'battle', layer: depth }
    const rule = nodeTerrainRule(mcNode, hashSeed(r, 'mc'))
    // Q1: every fight lays danger ground and seeded obstacles from its node.
    const hazard = nodeHazardSeed(mcNode, hashSeed(r, 'mc'))
    const m = runBattle({
      team,
      depth,
      kind,
      map: fieldFor(actField.id, rule, 'landscape', hazard) ?? actField,
      autoDeploy: true,
      variantSeed: encounterSeed(hashSeed(r, 'mc'), depth),
      enemyHpMult: threat * (o.curve?.(depth, kind) ?? 1),
      baseHp,
      // A cap, not a clock (Phase 3a). This was 70s and a capped battle was a
      // LOSS: re-measured with no cap, most "boss kills" were the clock — the
      // champions had simply not arrived. The game has no timeout; the cap is
      // now a per-sub-wave safety net and REPORT §6 gates on it firing never.
      maxSeconds: 600,
      seed: r * 100 + depth,
      // The modelled player spends the Rally Horn when the fight is on.
      player: o.player ?? PLAYER,
      rules: o.rules,
    })
    if (!m.cleared && !m.defeated) timeouts++
    baseHp = m.baseHpLeft
    if (!m.cleared || baseHp <= 0) {
      died = depth
      if (depth === MC_LAYERS) finalKill = true
      break
    }
    reached = depth
  }
  return { reached, died, won: reached >= MC_LAYERS, bossThreat, fieldId: field.id, finalAttempt, finalKill, timeouts }
}
