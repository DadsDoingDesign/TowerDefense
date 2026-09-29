/**
 * Threat — the run's compounding difficulty — and the node "worth" rules that
 * price it. Pure: no store, no React, no DOM. The store (`src/state/game/`) and
 * the balance harness both read these, so the game and its gate cannot drift.
 *
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
import type { MapNode } from '../data/runmap'
import type { EncounterKind } from '../data/waves'

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
/** The greed tax: accepting a hire, a pact or a mutation compounds Threat by this. */
export const THREAT_PER_CHOICE = 1.05

/** The one Banner rule the encounter kind reads (see `metaStore.BannerRules`). */
export interface EncounterRules {
  allElite: boolean
}
const NO_RULES: EncounterRules = { allElite: false }

/**
 * What kind of encounter a node fields. Banner 2 (Elite Watch) is a *rule*
 * change rather than a multiplier: every battle node resolves as an elite.
 *
 * Do not describe Elite Watch as "all armour columns and champions" — that
 * claim is false (`pickVariant` rotates plated / warded / swift, and
 * `ELITE_CHAMPION_DEPTH` is 6). `BANNER_RUNGS` in `metaStore.ts` carries the
 * wording that is true; see docs/AUDIT_2026-08-20.md (M7a).
 */
export const nodeKind = (node: MapNode, banner: EncounterRules = NO_RULES): EncounterKind =>
  node.type === 'boss' ? 'boss' : node.type === 'elite' || banner.allElite ? 'elite' : 'normal'

/**
 * What this node is *worth* on the map — its **own** kind, never the
 * Banner-substituted one (M19-g).
 *
 * `nodeKind` answers a different question ("what wave does this field?"), and
 * three numbers must NOT read it: the Threat step, the elite gold bonus and the
 * reward-card luck. **A Banner substitutes an encounter, not a node.** Reading
 * the substituted kind both surcharged Banner 2 (×1.52 on every battle node)
 * and paid it the elite purse and luck on every node — measured as free money
 * (§13). The pay follows the same rule as the price.
 *
 * An Elite the MAP dealt is unaffected: it is a route decision, so it still
 * costs the dearer step and still pays the elite bonus, which is what the node's
 * chip quotes and what makes the fork worth arguing about.
 */
export const mapKind = (node: MapNode): EncounterKind => nodeKind(node)

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
export const clearBonusGold = (node: MapNode): number => {
  const worth = mapKind(node)
  return worth === 'boss' ? 100 : worth === 'elite' ? 25 : 0
}

/** Reward-card / boss-spoils luck for clearing a node — follows `mapKind`, like the price. */
export const nodeClearLuck = (node: MapNode): number => {
  const worth = mapKind(node)
  return (worth === 'boss' ? 0.35 : worth === 'elite' ? 0.15 : 0) + node.layer * 0.03
}

/** Threat after clearing a battle node: the step its MAP kind charges. */
export const threatAfterClear = (threat: number, node: MapNode): number => threat * THREAT_PER_NODE[mapKind(node)]

/** Whether consuming a node of this type charges the (smaller) special step. */
export const chargesSpecialStep = (type: MapNode['type'] | undefined): boolean =>
  type === 'merchant' || type === 'shrine' || type === 'recruit'

/**
 * Threat after consuming a non-battle node. Only specials charge, and only at
 * `THREAT_PER_NODE.special` — every node the player consumes advances Threat.
 */
export const threatAfterSpecial = (threat: number, type: MapNode['type'] | undefined): number =>
  chargesSpecialStep(type) ? threat * THREAT_PER_NODE.special : threat

/** Threat after accepting what a node offers (a hire, a pact, a mutation). */
export const threatAfterChoice = (threat: number): number => threat * THREAT_PER_CHOICE

/**
 * Threat after surviving an Endless round: every round compounds, an elite
 * round (each fifth) a little harder (H7). A LOST round does not advance it.
 */
export const threatAfterRound = (threat: number, isElite: boolean): number =>
  threat * (isElite ? THREAT_PER_ROUND * 1.08 : THREAT_PER_ROUND)
