/**
 * Which battles carry a map challenge (G1-2) — pure, so the node preview, the
 * store's `selectNode` and the balance harness deal the same terrain for the
 * same node.
 *
 * A challenge is a terrain rule (`data/terrain.ts`): the battle is fought on the
 * run's field with the rule's pieces added — lakes for a Flooded meadow, fire
 * for a Wildfire. Terrain is FIXED for the battle: nothing spreads or dries up
 * between sub-waves.
 *
 * The draw is a hash of (run seed, node id), not a draw from any run stream,
 * so adding it cannot shift the loot, the map or a fight (RNG order is
 * behaviour). The same node always carries the same challenge, across a resume
 * and on either twin. A node id names the node's place on its map
 * (`n<layer>-<row>`, `data/runmap.ts`) — it used to come off the global entity
 * counter, so one seed (a Daily's included) dealt different ground depending on
 * how many ids the page had minted first (`tests/seededContent.test.ts`).
 *
 * Who gets one:
 *  - never the first fight of a run (depth 1): the grid is being learnt there;
 *  - never a boss or act boss: the boss is the challenge;
 *  - otherwise two battles in three, split evenly between the rules.
 */
import { hashSeed, RNG } from '../core/rng'
import { OPEN_GROUND } from '../data/companies'
import type { TerrainRuleId } from '../types'
import { calmGround, calmTerrain } from './firstRun'

/**
 * LS3: a first run fights its first two depths on plain ground and meets its
 * first map challenge at depth 4 (`firstRun.calmGround` / `calmTerrain`).
 * Omitted — as the balance harness always omits it — the answer is exactly
 * what it was.
 */
export interface GroundOpts {
  firstRun?: boolean
  /**
   * The route's ground (the mercenary company): the map challenges a battle on
   * this company's road may carry — Wildfire on Peppercorn's, Flooded canals on
   * Easel House's, and so on (`data/companies.ts`). The draw is the same hash;
   * only the list it picks from is the route's. Omitted: the open ground every
   * road used to share (Flooded meadow or Wildfire).
   */
  ground?: readonly TerrainRuleId[]
}

/** Share of eligible battles that carry a map challenge. */
export const CHALLENGE_SHARE = 2 / 3

/** Unit-interval draw from a hash, for a pure choice. */
const unit = (...parts: (string | number)[]): number => new RNG(hashSeed(...parts)).next()

/** The map challenge a campaign node is fought under, or null for plain ground. */
export function nodeTerrainRule(
  node: { id: string; type: string; layer: number },
  runSeed: number,
  opts: GroundOpts = {},
): TerrainRuleId | null {
  if (node.type !== 'battle' && node.type !== 'elite') return null
  if (node.layer <= 1) return null
  if (calmTerrain(node, !!opts.firstRun)) return null
  const u = unit(runSeed, 'terrain', node.id)
  if (u >= CHALLENGE_SHARE) return null
  const rules = opts.ground?.length ? opts.ground : OPEN_GROUND
  return rules[Math.floor((u / CHALLENGE_SHARE) * rules.length)] ?? null
}

/**
 * Q1: the seed a battle's danger ground and seeded obstacles are laid from
 * (`data/hazards.ts`) — or null for a node that is not a fight.
 *
 * EVERY fight gets one (the designer: "that's part of the seed"): the first,
 * the elites and the bosses too. Like the challenge draw above it is a HASH of
 * (run seed, node id), not a draw from a run stream, so it shifts no loot, no
 * map and no fight, and the same node always lays the same ground — across a
 * resume and on either twin.
 */
export function nodeHazardSeed(node: { id: string; type: string; layer?: number }, runSeed: number, opts: GroundOpts = {}): number | null {
  if (!FIGHTS.has(node.type)) return null
  if (node.layer != null && calmGround({ layer: node.layer }, !!opts.firstRun)) return null
  return hashSeed(runSeed, 'hazard', node.id)
}

const FIGHTS = new Set(['battle', 'elite', 'boss', 'miniboss'])

/** Endless rounds (removed with Endless in the next phase). */
export function endlessTerrainRule(round: number, runSeed: number): TerrainRuleId | null {
  if (round <= 2 || round % 10 === 0) return null
  const u = unit(runSeed, 'terrain', 'endless', round)
  if (u >= CHALLENGE_SHARE) return null
  return OPEN_GROUND[Math.floor((u / CHALLENGE_SHARE) * OPEN_GROUND.length)] ?? null
}

/** Endless rounds lay their ground from the round, on the same terms. */
export function endlessHazardSeed(round: number, runSeed: number): number {
  return hashSeed(runSeed, 'hazard', 'endless', round)
}
