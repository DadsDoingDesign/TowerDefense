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
import {
  creditPity,
  generateItem,
  newRarityPity,
  RARITY_ORDER,
  type RarityPity,
  type RosterRef,
} from '../src/game/data/items'
import { rollMutationChoices } from '../src/game/data/mutations'
import { generateRewardCards, type RewardGrant } from '../src/game/data/rewards'
import { generateRunMap, type MapNode, type MapOptions } from '../src/game/data/runmap'
import { rollShrine } from '../src/game/data/shrines'
import { pickBattleMap } from '../src/game/data/maps'
import { encounterSeed, type EncounterKind } from '../src/game/data/waves'
import { applyXp, xpToReach } from '../src/game/engine/leveling'
import { THREAT_PER_CHOICE, THREAT_PER_NODE } from '../src/state/gameStore'
import { bannerRules, useMetaStore, type BannerRules } from '../src/state/metaStore'
import type { Archetype, EffectMods, Item, Sentinel } from '../src/game/types'
import {
  autoEvolve,
  bestSlotGain,
  bestSlots,
  buyUpgrades,
  equipIfBetter,
  freshHero,
  heroDps,
  ITEM_PRICE,
  MAX_ROSTER,
  RECRUIT_PRICE,
  runBattle,
  scaledRecruitLevel,
  startingItems,
} from './harness'

/** The campaign is ten nodes deep on a default map; a wide map is longer. */
export const NODES = 10

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
}

export interface RoutePolicy {
  id: string
  label: string
  /** Pick one of the nodes reachable from where the company stands. */
  pick: (candidates: MapNode[], view: RunView) => MapNode
}

/** A policy that ranks node *types* on a fixed table — the shape §11 shipped. */
function prefPolicy(id: string, label: string, pref: Record<string, number>): RoutePolicy {
  return {
    id,
    label,
    pick: (cands) => cands.reduce((a, b) => ((pref[b.type] ?? 0) > (pref[a.type] ?? 0) ? b : a)),
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
    recruit: 5, merchant: 4, shrine: 3, battle: 2, elite: 1, boss: 9,
  }),
  prefPolicy('battles', 'battles-first', { battle: 5, recruit: 4, merchant: 3, shrine: 2, elite: 1, boss: 9 }),
  prefPolicy('recruits', 'recruits, else battles', {
    recruit: 6, battle: 5, merchant: 3, shrine: 2, elite: 1, boss: 9,
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
          case 'boss': return 9
          case 'recruit': return v.roster.length < MAX_ROSTER ? 8 : 0.5
          case 'merchant': return v.gold >= ITEM_PRICE.rare ? 4 : 0.5
          case 'battle': return 3
          case 'shrine': return v.baseHp > 8 ? 2 : 0.5
          case 'elite': return 1
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
  /** Override the special-node Threat step (§11's one fitted free parameter). */
  specialThreat?: number
  /**
   * Emulate a change to the `waves.ts` budget curve without editing it: an
   * extra HP multiplier per (depth, kind). Used only by `fit-curve.ts`, which
   * exists so a candidate curve can be measured against both gated models in
   * seconds rather than by editing constants and running the whole suite.
   */
  curve?: (depth: number, kind: EncounterKind) => number
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
}

const ARCHS: Archetype[] = ['fighter', 'rogue', 'mystic']
const rosterRefs = (roster: Sentinel[]): RosterRef[] => roster.map((s) => ({ archetype: s.archetype }))

function applyStatBonus(s: Sentinel, n: number): Sentinel {
  if (!n) return s
  return { ...s, stats: { str: s.stats.str + n, dex: s.stats.dex + n, int: s.stats.int + n } }
}

function applyGrant(roster: Sentinel[], g: RewardGrant, addMods: (m: EffectMods) => void): Sentinel[] {
  if (g.mods) addMods(g.mods)
  return roster.map((s) => ({
    ...s,
    stats: {
      str: s.stats.str + (g.stats?.str ?? 0),
      dex: s.stats.dex + (g.stats?.dex ?? 0),
      int: s.stats.int + (g.stats?.int ?? 0),
    },
    thorns: s.thorns + (g.thorns ?? 0),
    patience: s.patience + (g.patience ?? 0),
  }))
}

/**
 * Walk one campaign run: deal the map the hub and the Banner produce, route it
 * with `policy`, and fight / shop / hire the way the store does.
 */
export function simulateRun(seed: number, archetype: Archetype, o: SimOptions = {}): RunOutcome {
  const meta = o.meta ?? ZERO_META
  const banner = o.banner ?? bannerRules(0)
  const policy = o.policy ?? POLICIES[0]
  const special = o.specialThreat ?? THREAT_PER_NODE.special

  const rng = new RNG(seed)
  const map = generateRunMap(rng, mapOptionsFor(meta, banner))
  const byId = new Map(map.nodes.map((n) => [n.id, n]))
  // The battlefield this seed deals, exactly as `freshRunState` deals it (WS8).
  // Every §11/§12/§13 number is therefore an average over the field distribution
  // the game actually produces, rather than a measurement of one map.
  const field = pickBattleMap(seed)

  // ---- the company, as `newRun` + `pickStartingHero` deal it ----
  const kit = startingItems(rng, meta.extraItems)
  let roster: Sentinel[] = [applyStatBonus(freshHero(archetype, rng), meta.statBonus)]
  for (let i = 0; i < meta.extraSentinels; i++) {
    roster.push(applyStatBonus(freshHero(ARCHS[i % 3], rng), meta.statBonus))
  }
  // The three forced-rarity openers are already worn by the hero (`freshHero`);
  // anything Quartermaster adds is handed to whoever it improves.
  for (const item of kit.slice(3)) {
    let best = -Infinity
    let who = 0
    for (let h = 0; h < roster.length; h++) {
      const g = bestSlotGain(roster[h], item)
      if (g > best) { best = g; who = h }
    }
    if (best > 0) roster[who] = equipIfBetter(roster[who], item)
  }

  let gold = meta.startGold
  let baseHp = meta.maxBaseHp
  let threat = banner.startThreat
  let reached = 0
  let clearedCount = 0
  let battles = 0
  let bossThreat: number | null = null
  let runMods: EffectMods[] = []
  let forkDone = false
  let won = false
  const pity: RarityPity = newRarityPity()
  const half = Math.ceil((map.layers - 1) / 2)
  // Filled best-coverage-first on whichever field this run drew. This used to be
  // the literal `['s3','s4','s2','s5','s1']` — a Green Line fact hardcoded as a
  // constant, which on the second map names three of its five worst slots.
  const heroSlots = bestSlots(field)

  const hire = () => {
    const lvl = scaledRecruitLevel(roster, meta.extraRecruit)
    const base = applyStatBonus(freshHero(rng.pick(ARCHS), rng), meta.statBonus)
    roster = [...roster, autoEvolve(lvl <= 1 ? base : applyXp(base, xpToReach(lvl)), rng)]
    threat *= THREAT_PER_CHOICE
  }

  let cur = map.nodes.find((n) => n.type === 'start')!
  for (let guard = 0; guard < 40; guard++) {
    const nexts = map.edges.filter((e) => e.from === cur.id).map((e) => byId.get(e.to)!)
    if (!nexts.length) break
    const node = policy.pick(nexts, { roster, gold, baseHp, threat, layer: cur.layer, layers: map.layers })
    cur = node

    if (node.type === 'merchant') {
      // Four items rolled the way `selectNode` rolls them — with the roster's
      // damage-type demand and the run's drought luck — at the store's prices,
      // plus a hire at 80g.
      const luck = Math.min(0.4, node.layer * 0.04)
      const stock = Array.from({ length: 4 }, () =>
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
        roster[best.hero] = equipIfBetter(roster[best.hero], best.item)
        creditPity(pity, best.item.rarity) // `buyMerchantItem` charges the sale
      }
      if (roster.length < MAX_ROSTER && gold >= RECRUIT_PRICE && !banner.noRecruits) {
        gold -= RECRUIT_PRICE
        hire()
      }
      threat *= special
      clearedCount++
      reached = Math.max(reached, node.layer)
      continue
    }
    if (node.type === 'recruit') {
      if (roster.length < MAX_ROSTER) hire()
      threat *= special
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
        threat *= THREAT_PER_CHOICE
      }
      threat *= special
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
      node.type === 'boss' ? 'boss' : node.type === 'elite' || banner.allElite ? 'elite' : 'normal'
    const worth: EncounterKind = node.type === 'boss' ? 'boss' : node.type === 'elite' ? 'elite' : 'normal'
    if (kind === 'boss') bossThreat = threat
    battles++
    const m = runBattle({
      team: roster.slice(0, MAX_ROSTER).map((s, i) => ({ sentinel: s, slotId: heroSlots[i] })),
      depth: node.layer,
      kind,
      map: field,
      // The same key `gameStore.selectNode` uses, so a simulated run meets the
      // composition variants the shipped game would deal it (WS8).
      variantSeed: encounterSeed(seed, node.layer),
      variantSibling: node.row,
      enemyHpMult: threat * (o.curve?.(node.layer, kind) ?? 1),
      baseHp,
      teamMods: runMods,
      maxSeconds: 90,
      seed: seed * 131 + node.layer,
    })
    baseHp = m.baseHpLeft
    if (!m.cleared || baseHp <= 0) break
    clearedCount++
    reached = Math.max(reached, node.layer)
    if (kind === 'boss') { won = true; break }

    gold += m.goldEarned + (worth === 'elite' ? 25 : 0)
    const xpById = new Map(m.perSentinel.map((p) => [p.id, p.xp]))
    roster = roster.map((s) => autoEvolve(applyXp(s, xpById.get(s.id) ?? 0), rng))

    // The reward hand, dealt the way `finishBattle` deals it: the run's luck, the
    // Banner's card count, the roster's damage-type demand and the drought.
    const cards = generateRewardCards(rng, {
      luck: (worth === 'elite' ? 0.15 : 0) + node.layer * 0.03,
      count: banner.thinPickings ? 2 : 3,
      roster: rosterRefs(roster),
      pity,
    })
    let bestItem: { item: Item; gain: number; hero: number } | null = null
    for (const c of cards) {
      if (c.kind !== 'item' || !c.item) continue
      for (let h = 0; h < roster.length; h++) {
        const g = bestSlotGain(roster[h], c.item)
        if (!bestItem || g > bestItem.gain) bestItem = { item: c.item, gain: g, hero: h }
      }
    }
    if (bestItem && bestItem.gain > 0) {
      roster[bestItem.hero] = equipIfBetter(roster[bestItem.hero], bestItem.item)
      creditPity(pity, bestItem.item.rarity) // `chooseReward` charges the card taken
    } else {
      const grant = cards
        .filter((c) => c.grant)
        .sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity))[0]
      if (grant?.grant) roster = applyGrant(roster, grant.grant, (mm) => { runMods = [...runMods, mm] })
    }

    for (let i = 0; i < roster.length; i++) {
      const res = buyUpgrades(roster[i], gold)
      gold = res.gold
      roster[i] = res.hero
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
    if (!forkDone && node.layer >= half) {
      forkDone = true
      if (roster.length < MAX_ROSTER && !banner.noRecruits) {
        hire()
      } else if (roster.length) {
        const held = [...new Set(roster.flatMap((s) => (s.mutations ?? []).map((m) => m.key)))]
        const offer = rollMutationChoices(rng, held)
        if (offer.length) {
          const mutation = rng.pick(offer)
          // Aimed at the strongest carrier, which is the one thing about the
          // aim a player is reliably right about.
          let who = 0
          for (let h = 1; h < roster.length; h++) if (heroDps(roster[h]) > heroDps(roster[who])) who = h
          roster[who] = { ...roster[who], mutations: [...(roster[who].mutations ?? []), mutation] }
          threat *= THREAT_PER_CHOICE
        }
      }
    }
    threat *= THREAT_PER_NODE[worth]
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
