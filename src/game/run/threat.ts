/**
 * Threat — the run's difficulty multiplier — and the node "worth" rules that
 * price a clear. Pure: no store, no React, no DOM. The store (`src/state/game/`)
 * and the balance harness both read these, so the game and its gate cannot drift.
 *
 * **Threat carries the run's slope; the wave table carries its shape.** A node
 * at depth d throws `waveBudget(d) × threat` worth of enemies, and that product
 * is the only thing the player feels.
 *
 * ---------------------------------------------------------------------------
 * Phase 3b — Threat follows the ROAD, not the player's choices
 * ---------------------------------------------------------------------------
 *
 * Until this pass Threat compounded on three things: every battle cleared
 * (×1.42, ×1.52 for an elite), every special stop visited (×1.13), and every
 * hire, pact or mutation the player ACCEPTED (`THREAT_PER_CHOICE`, ×1.05) — the
 * last one even when the player walked away from a shrine, since the visit was
 * billed. The review put the consequence plainly: *Threat punished getting
 * stronger.* Taking a recruit made every later wave 5% bigger; taking an elite
 * made every later wave 7% bigger than the battle beside it would have; the
 * boss was met anywhere from ×15 to ×30 depending on how greedy the route had
 * been. A decision whose honest answer is "decline the power" is not a
 * decision the genre wants to ask.
 *
 * Now Threat is a pure function of **how far down the road the company is**:
 * the layer it is standing on and the act that layer belongs to. Every stop —
 * a battle, a merchant, a campfire — moves the company one layer on, and the
 * next stop is fought at that layer's Threat whatever the route was. What a
 * node TYPE changes is the encounter (an elite fields a column from
 * `ELITE_BUDGET`, an act boss fields champions), not a multiplier that follows
 * the player home. Getting stronger now feels stronger.
 *
 * The one thing that still escalates on its own is the act: crossing an act
 * boss is a step up the road, and the curve says so with {@link ACT_JUMP}.
 */
import type { MapNode } from '../data/runmap'
import type { EncounterKind } from '../data/waves'

/** Three acts; each is three free layers and an act boss (layers 4, 8 and 12). */
export const ACTS = 3
export const ACT_LAYERS = 4
/** Layers on a run map: the start, then `ACTS × ACT_LAYERS`. The final boss sits on the last. */
export const RUN_LAYERS = 1 + ACTS * ACT_LAYERS

/** Which act a map layer belongs to (1-based). The start layer counts as act 1. */
export const actOf = (layer: number): number => Math.max(1, Math.min(ACTS, Math.ceil(Math.max(1, layer) / ACT_LAYERS)))
/** Whether an act boss (a mid-boss, or the final boss) holds this layer. */
export const isActBossLayer = (layer: number): boolean => layer > 0 && layer % ACT_LAYERS === 0

/**
 * The per-layer step inside each act, and the extra step for crossing into a
 * new one. Fitted, not picked — `balance/report.ts` §6 (Monte Carlo band
 * 45–60%, deaths spread over ≥3 depths, no node >60%) and §11 (a first run is
 * winnable on the good lines and still hard on the first-timer line) are both
 * read off this one curve, so it is the dial both bands share.
 *
 * The old campaign compounded ×1.42 per node over ten nodes. This one covers
 * twelve layers, and the wave table's own budget already climbs ×1.6–2.7 a
 * layer on top of it (`waves.ts`, `waveBudget`), so the per-layer steps are
 * much smaller. Act 3 climbs hardest: by then a company has stopped levelling
 * (L20 lands around depth 8), and a flat last act would make the final boss the
 * only fight in it that could end a run — the "every death on one node" shape
 * §6 forbids.
 */
export const ACT_STEPS: readonly [number, number, number] = [1.06, 1.1, 1.2]
export const ACT_JUMP = 1.05
/** Act 1's step, for copy that quotes "about ×N a layer". */
export const THREAT_STEP = ACT_STEPS[0]

/**
 * Threat for a fight at `layer` (1-based; the first layer is ×1).
 * `start` is the Vow's starting Threat (1 on every rung today).
 */
export function threatAtLayer(layer: number, start = 1): number {
  const l = Math.max(1, Math.floor(layer))
  let t = start
  for (let k = 2; k <= l; k++) {
    const act = actOf(k)
    t *= ACT_STEPS[act - 1]
    if (act > 1 && (k - 1) % ACT_LAYERS === 0) t *= ACT_JUMP
  }
  return t
}

/**
 * What a node's own TYPE adds on top of the road (Phase 3b): the third of the
 * three things difficulty now comes from, beside depth and act.
 *
 *  - an **elite** is a harder fight than the battle beside it — it always was
 *    by composition (`ELITE_BUDGET`, the modifiers); it is ×1.1 here so the
 *    elite's better purse and card luck have a price that stays on the node
 *    instead of following the player home, as the old ×1.52 compounding step
 *    did;
 *  - the **final boss** fights at ×0.75 of its layer: it fields all three
 *    champions, and a Colossus Keg leak (22) ends any Gate, so the Threat
 *    multiplier is not where its difficulty lives. Measured on §6, at ×1 it
 *    ended 82–86% of all lost runs by itself — one node doing the whole
 *    curve's job, which §6's "no node ends more than 60%" gate forbids.
 *
 * A Vow-made elite (Elite Watch) is priced as the node it replaced: a Vow
 * substitutes an encounter, never a node (M19-g).
 */
export const nodeThreatMult = (type: MapNode['type'] | undefined): number =>
  type === 'elite' ? 1.1 : type === 'boss' ? 0.55 : 1

/** The Threat a fight on this node is actually fought at. */
export const encounterThreat = (node: Pick<MapNode, 'type' | 'layer'>, start = 1): number =>
  threatAtLayer(node.layer, start) * nodeThreatMult(node.type)

/**
 * Threat after the company has consumed a node on `layer` — i.e. the Threat the
 * NEXT stop will be fought at. Every node type moves the road on equally.
 */
export const threatAfterLayer = (layer: number, start = 1): number => threatAtLayer(layer + 1, start)

/**
 * Endless has its own, gentler step (H7). An Endless round is one wave and one
 * room, so the world escalates per round rather than per layer.
 */
export const THREAT_PER_ROUND = 1.22

/** The one Vow (Banner) rule the encounter kind reads (see `metaStore.BannerRules`). */
export interface EncounterRules {
  allElite: boolean
}
const NO_RULES: EncounterRules = { allElite: false }

/**
 * What kind of encounter a node fields. An act boss — the mid-bosses on layers
 * 4 and 8, and the final boss — fields a `boss` wave at its own depth.
 */
export const nodeKind = (node: MapNode, banner: EncounterRules = NO_RULES): EncounterKind =>
  node.type === 'boss' || node.type === 'miniboss'
    ? 'boss'
    : node.type === 'elite' || banner.allElite
      ? 'elite'
      : 'normal'

/**
 * What this node is *worth* on the map — its **own** kind, never the
 * Vow-substituted one (M19-g): a Vow substitutes an encounter, not a node, so
 * the elite purse and card luck follow the map.
 */
export const mapKind = (node: MapNode): EncounterKind => nodeKind(node)

/**
 * The flat purse a cleared campaign node pays on top of kill gold. An act boss
 * pays less than the final one: the final purse lands on a won run's receipt.
 */
export const clearBonusGold = (node: MapNode): number =>
  node.type === 'boss' ? 100 : node.type === 'miniboss' ? 60 : node.type === 'elite' ? 25 : 0

/** Reward-card / boss-spoils luck for clearing a node — follows the map kind, like the purse. */
export const nodeClearLuck = (node: MapNode): number => {
  const base = node.type === 'boss' ? 0.35 : node.type === 'miniboss' ? 0.25 : node.type === 'elite' ? 0.15 : 0
  return base + node.layer * 0.025
}

/**
 * Threat after surviving an Endless round: every round compounds, an elite
 * round (each fifth) a little harder (H7). A LOST round does not advance it.
 */
export const threatAfterRound = (threat: number, isElite: boolean): number =>
  threat * (isElite ? THREAT_PER_ROUND * 1.08 : THREAT_PER_ROUND)
