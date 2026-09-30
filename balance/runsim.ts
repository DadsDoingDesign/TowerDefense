/**
 * ---------------------------------------------------------------------------
 * One campaign run, simulated — with the hub, the Banner and the route as
 * parameters (M19-f).
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
import { ALL_NODES, childrenOf, getNode } from '../src/game/data/archetypeTree'
import { allPerkPoints } from '../src/game/data/perks'
import { specOpen } from '../src/game/run/unlocks'
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
import { afterFightRelics, cartularyRelic, diaryXp, handSize, hiresTrained, rewardHand, shelfSize, takeRelicOn, withRelicStats } from '../src/game/run/relics'
import { generateRunMap, type MapNode, type MapOptions } from '../src/game/data/runmap'
import { rollShrine } from '../src/game/data/shrines'
import { fieldFor, pickBattleMap } from '../src/game/data/maps'
import { nodeTerrainRule } from '../src/game/run/terrain'
import { encounterSeed, type EncounterKind } from '../src/game/data/waves'
import { applyXp, xpToReach } from '../src/game/engine/leveling'
import { ACT_LAYERS, RUN_LAYERS, nodeThreatMult, threatAfterLayer, threatAtLayer, clearBonusGold, nodeClearLuck } from '../src/game/run/threat'
import { hashSeed } from '../src/game/core/rng'
import { MAX_BASE_HP } from '../src/game/run/economy'
import { levelXpAwards, stopXp } from '../src/game/run/battle'
import { forkFires } from '../src/game/run/map'
import { GATE_REPAIR, repairGate } from '../src/game/run/economy'
import { canTrain, forageAtCampfire, restAtCampfire, restGain, trainAtCampfire } from '../src/game/run/campfire'
import { bannerRules, useMetaStore, type BannerRules } from '../src/state/metaStore'
import type { Archetype, FocusMode, Item, ItemRarity, Sentinel } from '../src/game/types'
import type { EngineRules } from '../src/game/engine/engine'
import { createSentinel } from '../src/game/data/sentinels'
import { autoEquipEmpty, recruitKit, wearKit } from '../src/game/engine/kit'
import {
  autoEvolve,
  bestEvolve,
  forcedEvolve,
  bestSlotGain,
  bestSlots,
  buildSpec,
  TIER2_NODES,
  bestPerks,
  forcedPerks,
  randomPerks,
  equipAndDisplace,
  heroDps,
  ITEM_PRICE,
  MAX_ROSTER,
  RECRUIT_PRICE,
  runBattle,
  scaledRecruitLevel,
  startingItems,
  PLAYER,
  type PlayerPolicy,
} from './harness'

/** The campaign is ten nodes deep on a default map; a wide map is longer. */
export const NODES = RUN_LAYERS - 1

// ---------------------------------------------------------------- hub state
/**
 * Everything the hub grants a run, read from the **real store** rather than
 * re-derived here: `bonuses()` for the ramp and `unlocked()` for the three
 * horizontal unlocks, exactly as `newRun` / `pickStartingHero` / `mapOptionsFor`
 * read them. A sweep that re-implements the hub cannot catch the hub drifting.
 */
export interface Loadout {
  label: string
  maxBaseHp: number
  startGold: number
  statBonus: number
  extraSentinels: number
  extraItems: number
  /**
   * Hub multiplier on the run's payout. Always 1 since the Chronicler line was
   * removed (a currency rebate is correct on every horizon and changes no run);
   * kept as a parameter so §13's ladder economy can be priced against a hub
   * that ever sells one again, and so the fit fails loudly if it does.
   */
  markMult: number
  wideMap: boolean
  extraRecruit: boolean
  standingOrders: boolean
  /** Field Kitchen (Phase 3b): campfires also offer a forage for gold. */
  fieldKitchen: boolean
  /** Relic Cartulary (Phase 3b): an act boss lays out one relic more. */
  cartulary: boolean
}

/** Build a {@link Loadout} by asking the live meta store what these levels buy. */
export function loadoutFor(label: string, upgrades: Record<string, number>): Loadout {
  const prev = useMetaStore.getState().upgrades
  useMetaStore.setState({ upgrades })
  const s = useMetaStore.getState()
  const b = s.bonuses()
  const out: Loadout = {
    label,
    maxBaseHp: b.maxBaseHp,
    startGold: b.startGold,
    statBonus: b.statBonus,
    extraSentinels: b.extraSentinels,
    extraItems: b.extraItems,
    markMult: 1,
    wideMap: s.unlocked('cartographer'),
    extraRecruit: s.unlocked('freeCompanies'),
    standingOrders: s.unlocked('standingOrders'),
    fieldKitchen: s.unlocked('fieldKitchen'),
    cartulary: s.unlocked('cartulary'),
  }
  useMetaStore.setState({ upgrades: prev })
  return out
}

export const ZERO_META: Loadout = loadoutFor('zero meta', {})

/** `mapOptionsFor` in `gameStore`, with the same four lines. */
export const mapOptionsFor = (m: Loadout, banner: BannerRules): MapOptions => ({
  wideMap: m.wideMap,
  extraRecruit: m.extraRecruit,
  standingOrders: m.standingOrders,
  noMerchants: banner.noMerchants,
  noRecruits: banner.noRecruits,
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

/** A policy that ranks node *types* on a fixed table — the shape §11 shipped. */
function prefPolicy(id: string, label: string, pref: Record<string, number>): RoutePolicy {
  // Even a fixed-table player can see that a full company cannot hire: a
  // recruit stop with no room for the recruit ranks below everything. Maps
  // carry more hiring stops since Phase 3b, and a model that walked into them
  // with a full roster measured `Free Companies` (a SECOND hiring stop) as a
  // −9pt trap on the recruits line — the purchase was not the defect.
  const rank = (n: MapNode, v: RunView) => (n.type === 'recruit' && v.roster.length >= MAX_ROSTER ? 0.5 : (pref[n.type] ?? 0))
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
  banner?: BannerRules
  policy?: RoutePolicy
  /**
   * Emulate a change to the `waves.ts` budget curve without editing it: an
   * extra HP multiplier per (depth, kind). Used only by `fit-curve.ts`, which
   * exists so a candidate curve can be measured against both gated models in
   * seconds rather than by editing constants and running the whole suite.
   */
  curve?: (depth: number, kind: EncounterKind) => number
  /**
   * How the modelled player answers a build choice (an evolution, and — where
   * the game offers one — a level-up perk). `random` is the default and what
   * every gate reads: it prices the *tier* rather than a player's read of it.
   * `best` takes whichever option raises `heroDps` most — the "known answer"
   * a spreadsheet player converges on. The gap between the two is the
   * evolution best-vs-random spread: the wider it is, the more solved the
   * build layer (Phase 3b review: 44% vs 28% before the perk rework).
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
  /** Watch Marks this run banks, by `grantRunRewards`'s own formula. */
  marks: number
  layers: number
  /** Which battlefield this run's seed dealt (WS8). */
  fieldId: string
  /** The starting hero's archetype. */
  starter: Archetype
  /** Nodes consumed that were fights (battle / elite / boss), and all nodes consumed. */
  fights: number
  nodes: number
  /** The leader's level after each layer it cleared, index = layer. */
  levelByLayer: number[]
}

const ARCHS: Archetype[] = ['fighter', 'rogue', 'mystic']

/**
 * Every build choice a run can be asked to make, keyed the way
 * `SimOptions.build.force` pins them: a tree node id → its children.
 */
export function buildChoicePoints(): { id: string; archetype: Archetype; options: string[] }[] {
  const evolutions = ALL_NODES.filter((n) => n.tier < 2).map((n) => ({
    id: n.id,
    archetype: n.archetype,
    // Feat-locked specs are not an option for a zero-feat player.
    options: childrenOf(n.id).filter((c) => specOpen(c.id, () => false)).map((c) => c.id),
  }))
  // Perk milestones (Phase 3b), keyed `5:fighter` / `15:marksman`. Only the
  // base options: a zero-meta run has no feats.
  const perks = allPerkPoints().map((pt) => ({
    id: pt.key,
    archetype: getNode(pt.line).archetype,
    options: pt.options.filter((x) => !x.unlock).map((x) => x.id),
  }))
  return [...evolutions, ...perks]
}

/** A body joining the company, carrying what the store hands it (`RECRUIT_KIT`). */
const recruitBody = (a: Archetype, rng: RNG): Sentinel => wearKit(createSentinel(a), recruitKit(rng, a))
const rosterRefs = (roster: Sentinel[]): RosterRef[] => roster.map((s) => ({ archetype: s.archetype }))

function applyStatBonus(s: Sentinel, n: number): Sentinel {
  if (!n) return s
  return { ...s, stats: { str: s.stats.str + n, dex: s.stats.dex + n, int: s.stats.int + n } }
}

/**
 * Walk one campaign run: deal the map the hub and the Banner produce, route it
 * with `policy`, and fight / shop / hire the way the store does.
 */
export function simulateRun(seed: number, archetype: Archetype, o: SimOptions = {}): RunOutcome {
  const meta = o.meta ?? ZERO_META
  const banner = o.banner ?? bannerRules(0)
  const policy = o.policy ?? POLICIES[0]

  const rng = new RNG(seed)
  const force = typeof o.build === 'object' ? o.build.force : null
  const evolveOnly = (s: Sentinel): Sentinel =>
    o.build === 'best' ? bestEvolve(s) : force ? forcedEvolve(s, force, rng) : autoEvolve(s, rng)
  // A level-up can owe an evolution AND a perk (the level-15 perk is chosen from
  // the line the level-10 evolution picked), so the branch comes first.
  const evolve = (s: Sentinel): Sentinel => {
    const e = evolveOnly(s)
    const p = o.build === 'best' ? bestPerks(e) : force ? forcedPerks(e, force, rng) : randomPerks(e, rng)
    return p.level >= 20 ? evolveOnly(p) : p
  }
  const levelByLayer: number[] = []
  let nodes = 0
  // The map rides its own stream, as it does in the game (`streams.mapRng`): a hub
  // unlock that reshapes the map must not re-deal every loot roll behind it, or
  // §12's "paired" cells are not paired at all (Phase 3b).
  const map = generateRunMap(new RNG(hashSeed(seed, 'map')), mapOptionsFor(meta, banner))
  const byId = new Map(map.nodes.map((n) => [n.id, n]))
  // The battlefield this seed deals, exactly as `freshRunState` deals it (WS8).
  // Every §11/§12/§13 number is therefore an average over the field distribution
  // the game actually produces, rather than a measurement of one map.
  const field = pickBattleMap(seed)

  // ---- the company, as `newRun` + `pickStartingHero` deal it ----
  // The kit is dealt AFTER the pick, for the company that exists, and the
  // leader wears its three core pieces — `pickStartingHero`, via the shared
  // `engine/kit.ts`. The hub's extra Sentinels arrive bare, as
  // `pickStartingHero` makes them; Quartermaster's extra rolls go to whoever
  // they improve, and anything they unseat goes to the pack.
  let roster: Sentinel[] = [applyStatBonus(createSentinel(archetype), meta.statBonus)]
  for (let i = 0; i < meta.extraSentinels; i++) {
    roster.push(applyStatBonus(recruitBody(ARCHS[i % 3], rng), meta.statBonus))
  }
  /**
   * What the company owns but is not wearing. The store has always had one
   * (`inventory`); this model used to throw every displaced item away and
   * hand every hire a freshly rolled kit, while the game hires a BARE body.
   * A hire now dresses out of the pack with the store's own empty-slot rule.
   */
  let pack: Item[] = []
  const equipOn = (h: number, item: Item) => {
    const r = equipAndDisplace(roster[h], item)
    roster[h] = r.hero
    if (r.displaced) pack.push(r.displaced)
  }
  const kit = startingItems(rng, archetype, meta.extraItems, rosterRefs(roster))
  roster[0] = wearKit(roster[0], kit)
  for (const item of kit.slice(3)) {
    let best = -Infinity
    let who = 0
    for (let h = 0; h < roster.length; h++) {
      const g = bestSlotGain(roster[h], item)
      if (g > best) { best = g; who = h }
    }
    if (best > 0) equipOn(who, item)
    else pack.push(item)
  }

  // A relic held from the first node has already landed its flat stats.
  for (const id of o.startRelics ?? []) roster = takeRelicOn(roster, id)
  let gold = meta.startGold
  let baseHp = meta.maxBaseHp
  let threat = banner.startThreat
  let reached = 0
  let clearedCount = 0
  let battles = 0
  let bossThreat: number | null = null
  /** Relics taken this run (Phase 3b) — the store's `relics`. */
  let relics: string[] = [...(o.startRelics ?? [])]
  let won = false
  const pity: RarityPity = newRarityPity()
  // Filled best-coverage-first on whichever field this run drew. This used to be
  // the literal `['s3','s4','s2','s5','s1']` — a Green Line fact hardcoded as a
  // constant, which on the second map names three of its five worst slots.
  const heroSlots = bestSlots(field)

  const hire = () => {
    const lvl = scaledRecruitLevel(roster, hiresTrained(meta.extraRecruit, relics))
    // A hire arrives bare (`scaledRecruit`) and dresses from the pack with the
    // store's empty-slot rule (`withRecruits` → `autoEquipEmpty`).
    const base = withRelicStats(applyStatBonus(recruitBody(rng.pick(ARCHS), rng), meta.statBonus), relics)
    const dressed = autoEquipEmpty([evolve(lvl <= 1 ? base : applyXp(base, xpToReach(lvl)))], pack)
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
      if (baseHp <= meta.maxBaseHp * 0.65 && gold >= GATE_REPAIR.price) {
        gold -= GATE_REPAIR.price
        baseHp = repairGate(baseHp, meta.maxBaseHp)
      }
      const stock = Array.from({ length: shelfSize(relics, banner.thinPickings) }, () =>
        generateItem(rng, { luck, roster: rosterRefs(roster), pity: { ...pity }, commitPity: false }),
      )
      for (let pass = 0; pass < 4; pass++) {
        let best: { item: Item; gain: number; hero: number } | null = null
        for (const it of stock) {
          if (ITEM_PRICE[it.rarity] > gold) continue
          for (let h = 0; h < roster.length; h++) {
            const g = bestSlotGain(roster[h], it)
            if (g > 0 && (!best || g > best.gain)) best = { item: it, gain: g, hero: h }
          }
        }
        if (!best) break
        gold -= ITEM_PRICE[best.item.rarity]
        stock.splice(stock.indexOf(best.item), 1)
        equipOn(best.hero, best.item)
        creditPity(pity, best.item.rarity) // `buyMerchantItem` charges the sale
      }
      if (roster.length < MAX_ROSTER && gold >= RECRUIT_PRICE && !banner.noRecruits) {
        gold -= RECRUIT_PRICE
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
      // With the Field Kitchen a healthy company forages only when training
      // would do nothing: measured, a level beats 40 gold at every point of the
      // run for this model, so a forage-when-broke rule read −1pt on §12.
      if (hurt) baseHp = restAtCampfire(baseHp, meta.maxBaseHp)
      else if (meta.fieldKitchen && who < 0) gold = forageAtCampfire(gold)
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
    // WAVE this node fields (a Banner may substitute an elite into it), `worth`
    // is what the NODE itself costs and pays (Threat step, elite gold, card
    // luck) and never moves with the Banner.
    const kind: EncounterKind =
      node.type === 'boss' || node.type === 'miniboss' ? 'boss' : node.type === 'elite' || banner.allElite ? 'elite' : 'normal'
    const worth: EncounterKind = node.type === 'boss' || node.type === 'miniboss' ? 'boss' : node.type === 'elite' ? 'elite' : 'normal'
    const final = node.type === 'boss'
    if (final) bossThreat = threat
    battles++
    // G1-2: the node's map challenge, exactly as `selectNode` deals it — the
    // company re-deploys best-first on whatever ground the terrain leaves.
    const rule = nodeTerrainRule(node, seed)
    const nodeField = rule ? (fieldFor(field.id, rule, 'landscape') ?? field) : field
    const nodeSlots = rule ? bestSlots(nodeField) : heroSlots
    const m = runBattle({
      team: roster.slice(0, MAX_ROSTER).map((s, i) => ({ sentinel: s, slotId: nodeSlots[i] })),
      // `gameStore.selectNode`: a Banner-made elite is drawn `eliteDepth`
      // deeper; a map-dealt one stays at its own depth.
      depth: node.layer + (kind === 'elite' && worth === 'normal' ? banner.eliteDepth : 0),
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
    })
    o.onFight?.({ layer: node.layer, type: node.type, hpBefore: baseHp, hpAfter: m.baseHpLeft, cleared: m.cleared, roster: roster.length, level: roster[0].level })
    baseHp = m.baseHpLeft
    if (!m.cleared || baseHp <= 0) break
    clearedCount++
    reached = Math.max(reached, node.layer)
    if (final) { won = true; break }

    gold += m.goldEarned + clearBonusGold(node)
    // Field Surgeon's Kit and the Tithe Box (`finishBattle` applies the same rule).
    ;({ baseHp, gold } = afterFightRelics(relics, { baseHp, maxBaseHp: meta.maxBaseHp, gold }))
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
      count: handSize({ thinPickings: banner.thinPickings }),
      noBattleRelics: banner.thinPickings,
      held: relics,
      roster: rosterRefs(roster),
      pity,
    })
    // The Relic Cartulary's extra card, off its own stream exactly as the store deals it.
    if (handKind === 'boss' && meta.cartulary) {
      const extra = cartularyRelic(new RNG(hashSeed(seed, 'cartulary', node.layer)), { luck: nodeClearLuck(node), held: relics, hand: cards })
      if (extra) cards.push(extra)
    }
    let bestItem: { item: Item; gain: number; hero: number; frac: number } | null = null
    for (const c of cards) {
      if (c.kind !== 'item' || !c.item) continue
      for (let h = 0; h < roster.length; h++) {
        const g = bestSlotGain(roster[h], c.item)
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
      if (roster.length < MAX_ROSTER && !banner.noRecruits) {
        hire()
      } else if (roster.length) {
        const held = [...new Set(roster.flatMap((s) => (s.mutations ?? []).map((m) => m.key)))]
        const offer = rollMutationChoices(rng, held, banner.thinPickings ? 2 : 3)
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
    layers: map.layers,
    fieldId: field.id,
    starter: archetype,
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
export function marksFor(cleared: number, won: boolean, banner: BannerRules, chronicler = 1): number {
  return Math.round((cleared * 8 + (won ? 120 : 0)) * chronicler * banner.markMult)
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
  const field = pickBattleMap(hashSeed(r, 'mc'))
  const slots = bestSlots(field)
  let baseHp = MAX_BASE_HP
  let reached = 0
  let died = 0
  let bossThreat: number | null = null
  let finalAttempt = false
  let finalKill = false
  let timeouts = 0
  for (let depth = 1; depth <= MC_LAYERS; depth++) {
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
    const rule = nodeTerrainRule({ id: `mc${depth}`, type: depth === MC_LAYERS || kind === 'boss' ? 'boss' : kind === 'elite' ? 'elite' : 'battle', layer: depth }, hashSeed(r, 'mc'))
    const m = runBattle({
      team,
      depth,
      kind,
      map: rule ? (fieldFor(field.id, rule, 'landscape') ?? field) : field,
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
