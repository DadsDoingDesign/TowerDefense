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
 * boss is a step up the road: each act climbs faster per layer than the last
 * ({@link ACT_STEPS}; the separate {@link ACT_JUMP} is ×1 since the no-HP refit).
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
 *
 * ---- refitted after heroes lost their HP (the no-HP pass) ------------------
 *
 * [1.06, 1.1, 1.2] with a ×1.05 jump put §6 at 74% before the change and 83%
 * after it (a blocker that can no longer fall holds far more), with §11's
 * first-timer line at 35% (gate ≤35%). Hazards could not close it: the harshest
 * danger ground swept (four ×0-damage cursed tiles and twelve boulders) moved
 * §6 by 4.6pt. Swept with `hazard-sweep.ts` (§6 n=300, §11 n=300, §13 n=600;
 * the elite column is `nodeThreatMult('elite')` below):
 *
 *   steps × jump, elite         §6 win  §11 first / adaptive  §13 B0→B1
 *   [1.12, 1.15, 1.20] ×1.05 1.1  67.7%     19.7 / 29.3%          —
 *   [1.15, 1.18, 1.22] ×1.08 1.1  56.0%     13.3 / 19.0%        1.9pt
 *   [1.12, 1.15, 1.31] ×1.08 1.1  55.0%     12.7 / 21.0%        1.5pt
 *   [1.12, 1.17, 1.23] ×1.08 1.1  60.0%     16.0 / 27.7%        4.7pt
 *   [1.12, 1.20, 1.28] ×1   1.0   58.0%     15.0 / 24.3%       −1.5pt
 *   [1.12, 1.20, 1.29] ×1   1.0   57.0%     14.5 / 23.3%        0.8pt   (Swarm budget 1.0);
 *                                  the full report read 57% · 13 / 20% · 4pt
 *   [1.12, 1.20, 1.23] ×1   1.0   61%       17 / 20%            —     (October audit, first try)
 *   [1.12, 1.20, 1.25] ×1   1.0     —        —                    —     ← shipped (October audit 1.6)
 *
 * October audit 1.6: act 3 had become the whole run — adaptive survival fell
 * 79% at depth 8 to 65 / 39 / 25 / 16% over the last act, a zero-meta escort
 * delivered 14–18% and the first-timer gate failed (14% vs a 15% floor). Act
 * 3's step is eased. ×1.23 (the act-3 value of the [1.12, 1.17, 1.23] row)
 * lifted the first-timer line to 17% but put §6 at 61%, a point over its band,
 * and left the final boss under its kill target; ×1.25 splits the two. Act 2
 * is left at ×1.20 so the depth-6 elite stays the wall §11 measures; the
 * regenerated REPORT is the measurement.
 *
 * ---- re-anchored on contract delivery (October audit, designer item 1) -----
 *
 * §6's 45–60% band was retired as a gate (it models a specialist team the
 * contract game never fields); the run-level gates read contract delivery
 * (REPORT §13): a zero-meta escort 20–30%, a veteran's escort 35–55%, its max
 * stake 10–20%. On [1.12, 1.2, 1.25] a zero-meta escort delivered 19.8% and
 * the veteran 26% (n=400, the fields-per-act harness). The road is eased and
 * the final boss made the run's real last fight — the "boss kills ≥ 10% of
 * arrivals" gate is kept, and an easier road alone took it to 7.5%:
 *
 *   steps                boss   §6 MC  boss kills  zero esc  veteran  vet 8c  (n=400, stake 0.15–0.19)
 *   [1.12, 1.2, 1.25]    0.55   50%    9.6%        19.8%     26.0%    10.8%
 *   [1.10, 1.17, 1.22]   0.55   61%    7.5%        19.8%     31.8%    17.3%
 *   [1.08, 1.15, 1.20]   0.62   67%    7.4%        25.8%     35.8%    18.0%
 *   [1.06, 1.13, 1.18]   0.80   68%   12.0%        28.7%     40.5%    18.5%
 *   [1.06, 1.13, 1.18]   0.85   68%   12.4%        26.7%     43.5%    16.0%   ← shipped (n=600)
 *
 * Two things decided the shape. §11's strict floor (one hero, every layer a
 * battle) walks into a wall at the depth-6 elite: with the ×1.08 act jump and a
 * ×1.1 elite, 43–44% of those runs ended there against a 40% gate, so the act
 * jump is folded into act 2's step and the elite pays in composition only
 * (37.5–39% there now). And §13's ≥3pt gate on Thin Pickings could not choose:
 * after the no-HP change that rung costs −1.5 to +5pt depending on details of
 * the curve that have nothing to do with it (and the full report reads it off
 * a different id state than the sweep — ~0pt on the ×1.08 curve the sweep put
 * at 4.7pt), i.e. it sits on its own noise floor; see REPORT §13. Layer 8
 * lands at ×2.91 (§5's standard team, graded at `threatAtLayer(8)`, clears ×2.2
 * siege pressure there — it cleared ×3.4 at the old ×1.83 — and holds ×2.2 up
 * to a layer-8 Threat of ×3.3).
 */
/*
 * ---- refitted in the tuning pass (the mercenary company) -------------------
 *
 * The run-side levers that pass shipped first (caster weapons ×1.6, richer
 * loot, Rare-weapon hires, the deployment fix) lifted the first runs and left
 * §6 at 63.7% (band 45–60). Act 3 is where §6 loses and where the first run
 * fights least (it walks stops and meets the bosses), so the act-3 step is the
 * dial; the final boss gives back most of what the steeper act would add to it,
 * because its HP is a stall risk, not a difficulty: at ×1.40 and a ×0.55 boss,
 * three §6 final bosses ran past the 600s cap (healed or held, never killed).
 * Measured with `tune.ts 240 fresh mc` (§6 n=300; timeouts over §6's 300 runs):
 *
 *   act 3, boss          §6 win  first-timer / adaptive  timeouts
 *   1.29, ×0.55          63.7%     25.4 / 32.9%             0
 *   1.34, ×0.55          59.7%     24.2 / 34.6%             —
 *   1.40, ×0.55          53.3%     22.9 / 27.1%             3 (final boss)
 *   1.40, ×0.40          59.0%     26.3 / 31.3%             —
 *   1.42, ×0.43          56.0%     23.3 / 27.1%             1 (a held depth-11 wave a shaman out-healed)
 *   1.36, ×0.50, elite ×1.15  59.3%  26.3 / 34.6%          1 (same)
 *   1.40, ×0.45          57.7%     25.4 / 31.3%             0
 *
 * …and after the variant refit (`waves.ts` budget scales) ×0.45 put one §6
 * final boss back over the cap (a Colossus held by a Warden of Ash for 13
 * minutes): a held champion with a weak team is a slog, not a loss, so the
 * final boss's HP is the dial, and ×1.38–1.40 with ×0.42–0.45 is chaotic in
 * which of 300 seeds slogs (×1.38/×0.45: run 257; ×1.38 act 2 ×1.21/×0.42:
 * runs 108 and 257; heavier danger ground on top: run 112):
 *
 *   1.40, ×0.42          58.0%     24.2 / 33.3%             0
 *
 * …and at ×0.42 the final boss killed only 9% of the teams that reached it
 * (§6's design floor is 10%), while every multiplier that killed more
 * slogged a seed past 600s. Those slogs were real fights that ran 13–19
 * minutes, so the harness cap went 600 → 1800s (`balance/runsim.BATTLE_CAP`)
 * and the boss went back up (paired ids, 600 → 1800s cap):
 *
 *   1.40, ×0.44          57.3%     25.4 / 34.2%             0   ← shipped
 *                        boss kills 20 of 192 arrivals (10.4%)
 *
 * (The skill levers of the same pass — Anchor, Keen Eye, Finisher — are in
 * every row from 1.40/×0.55 down.) §11's strict floor ends 36% of its runs at
 * depth 6 on this curve (gate 40%; 43% before the pass).
 */
/*
 * ---- refitted in the merged tuning pass (main's model, the October gates) --
 *
 * The merge kept main's curve ([1.12, 1.2, 1.4], final boss ×0.44) and the
 * October branch's gates (REPORT §13 / §13c): a zero-meta escort delivers
 * 20–30%, a veteran's 35–55%. On the merged game (item identities, a field
 * per act) the zero-meta escort read 32.8% and the final boss killed 7.9% of
 * arrivals (gate ≥ 10%), with one §6 battle on the cap (run 257's depth-11
 * wave). The veteran's lead is ~10pt and does not move with the curve's
 * shape, so the window is narrow: both escorts clear their band by 1σ only
 * with the zero-meta one at ~26–28%. Each row is 600 paired runs (§6 n=300;
 * the content levers of the same pass — Blessing, Rally, Stormcaller,
 * Bloodletting — are in the rows from ×1.17 down):
 *
 *   steps                boss   §6 MC  boss kills  timeouts  zero esc  veteran
 *   [1.12, 1.2,  1.4 ]   0.44   46.7%    7.9%        1        32.8%     43.2%
 *   [1.12, 1.2,  1.4 ]   0.50   44.3%   12.5%        1        30.5%     42.5%
 *   [1.12, 1.2,  1.44]   0.44   43.0%   13.4%        1        30.7%     41.8%
 *   [1.16, 1.2,  1.4 ]   0.48   40.7%   12.2%        0        29.0%     38.2%
 *   [1.18, 1.2,  1.4 ]   0.48   38.0%   15.6%        0        25.8%     37.3%
 *   [1.17, 1.2,  1.4 ]   0.44   44.0%    9.0%        0        27.7%     36.2%
 *   [1.2,  1.2,  1.34]   0.5    41.3%   13.9%        0        26.7%     37.0%
 *   [1.19, 1.2,  1.36]   0.48   42.0%   12.5%        0        27.0%     38.2%   ← shipped
 *
 * Act 1 is the dial: it is where a zero-meta company dies and a veteran's
 * (the Opening deal's second hero) does not, and act 3 eases to hand the
 * veteran back what act 1's compounding took. §16d's Rally Horn value (gate
 * 0.05–3 base HP) is noise-level and curve-chaotic: −0.34 to +0.77 across the
 * curves tried; +0.66 on the shipped one. §11's strict floor ends 33% of its
 * runs at depth 6 here (gate 40%; 40.4% on the merge).
 */
export const ACT_STEPS: readonly [number, number, number] = [1.19, 1.2, 1.36]
export const ACT_JUMP = 1
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
 *  - an **elite** is a harder fight than the battle beside it — by
 *    composition (`ELITE_BUDGET`, the modifiers). It carried an extra ×1.1
 *    here too until the no-HP refit, which steepened act 2 and piled a lone
 *    first-run hero's deaths onto the depth-6 elite: 43% of §11's strict-floor
 *    runs ended there (gate 40%), 41% at ×1.05, 37.5% at ×1. Its better purse
 *    and card luck are paid for by the composition alone now;
 *  - the **final boss** fights at ×0.48 of its layer (×0.55 before the tuning pass, ×0.44 before the merged one): it fields all three
 *    champions, and a Colossus Keg leak (22) ends any Gate, so the Threat
 *    multiplier is not where its difficulty lives. Measured on §6, at ×1 it
 *    ended 82–86% of all lost runs by itself — one node doing the whole
 *    curve's job, which §6's "no node ends more than 60%" gate forbids.
 *
 * A Vow-made elite (Elite Watch) is priced as the node it replaced: a Vow
 * substitutes an encounter, never a node (M19-g).
 */
export const nodeThreatMult = (type: MapNode['type'] | undefined): number =>
  // ×0.55 → ×0.44 with the steeper act 3 (the tuning pass, see ACT_STEPS): the
  // final boss's Threat is ×4.9 where it was ×4.4, not ×6.2. ×0.44 → ×0.48 in
  // the merged tuning pass (its kills of arrivals 7.9% → 12.5%; see ACT_STEPS).
  type === 'boss' ? 0.48 : 1

/** The Threat a fight on this node is actually fought at. */
export const encounterThreat = (node: Pick<MapNode, 'type' | 'layer'>, start = 1): number =>
  threatAtLayer(node.layer, start) * nodeThreatMult(node.type)

/**
 * Threat after the company has consumed a node on `layer` — i.e. the Threat the
 * NEXT stop will be fought at. Every node type moves the road on equally.
 */
export const threatAfterLayer = (layer: number, start = 1): number => threatAtLayer(layer + 1, start)

/** The one Vow (Banner) rule the encounter kind reads (see `metaStore.DifficultyRules`). */
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

