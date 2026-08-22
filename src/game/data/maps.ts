import { streamRng } from '../core/rng'
import type { Vec2 } from '../core/vec'
import type { GameMap } from '../types'

/**
 * The battlefields. Logical coordinates are 960x560 on every one of them; the
 * renderer composes at exactly that size and blits down, so the field
 * dimensions are a fixed contract, not a per-map choice.
 *
 * ---------------------------------------------------------------------------
 * Why there is more than one (WS8)
 * ---------------------------------------------------------------------------
 *
 * `ALL_MAPS = [FIRST_MAP]` was the last untouched finding of the audit. One
 * battlefield, one path, six build slots, for every run forever, means the only
 * thing that varied below the map layer was a single scalar (Threat) and the
 * team — so **placement was solved once and became a calculator**. The genre
 * doctrine is specific about which half of the loop randomness belongs in:
 * before the decision (a varied setup the player has to solve), never after it.
 * A different battlefield is input randomness done right — it makes the player
 * re-solve rather than re-execute.
 *
 * The two fields are deliberately opposite in the one axis that decides tower
 * placement, **how many lanes a slot can see**:
 *
 *  - *The Green Line* is a wide snake. Its slots sit in one cluster (s2/s3/s4
 *    within 95–130px) where auras reach and coverage overlaps, and the answer is
 *    to stack the cluster.
 *  - *The Kiln Road* folds three near-parallel lanes 130px apart across the
 *    middle of the field and hangs one slot (`s4`) where three of them converge.
 *    Only ONE pair of its slots is inside aura range, and its best slot is out
 *    of a Fighter's 96px reach of two of the three lanes it overlooks — so the
 *    same company placed the same way covers a different amount of road, and a
 *    support that was the obvious third body on the Green Line is a worse buy
 *    than a long-range carrier here.
 *
 * Both are ~2290–2300px end to end on purpose. Enemy speeds in `enemies.ts` are
 * tuned as *crossing times* against that length, and time-in-range is the one
 * difficulty axis Threat does not multiply — a field 20% longer would be a 20%
 * easier game on every dial in the balance suite at once.
 */
export const FIELD_W = 960
export const FIELD_H = 560

/** Total walking distance along a path, in field px — a map's crossing budget. */
export function pathLength(path: readonly Vec2[]): number {
  let n = 0
  for (let i = 1; i < path.length; i++) n += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
  return n
}

const GREEN_PATH = [
  { x: -30, y: 90 },
  { x: 250, y: 90 },
  { x: 250, y: 300 },
  { x: 500, y: 300 },
  { x: 500, y: 120 },
  { x: 720, y: 120 },
  { x: 720, y: 440 },
  { x: 480, y: 440 },
  { x: 480, y: 520 },
  { x: 990, y: 520 },
]

export const FIRST_MAP: GameMap = {
  id: 'greenline',
  name: 'The Green Line',
  width: FIELD_W,
  height: FIELD_H,
  path: GREEN_PATH,
  base: GREEN_PATH[GREEN_PATH.length - 1],
  // Positions verified to sit 35–65px from the path so even short-range
  // Fighters can reach a lane. Each slot covers a different bend.
  slots: [
    { id: 's0', pos: { x: 185, y: 200 } },
    { id: 's1', pos: { x: 430, y: 345 } },
    { id: 's2', pos: { x: 610, y: 180 } },
    { id: 's3', pos: { x: 660, y: 300 } },
    { id: 's4', pos: { x: 655, y: 395 } },
    { id: 's5', pos: { x: 560, y: 485 } },
  ],
}

/**
 * The Kiln Road — three stacked lanes and one crossroads slot.
 *
 * The horde enters bottom-left, climbs the left edge, runs the length of the
 * top (y=120), drops one shelf and runs *back* west (y=250), drops again and
 * runs east to the base (y=380). The three lanes are 130px apart, which is
 * inside every tower's range from the shelf between them and inside exactly one
 * aura hop (s2→s3), and the eastern end is where all three converge:
 *
 *  - `s4` (660,250) is 40px from the middle lane, 136px from the top lane's
 *    corner and 130px from the bottom lane. A Rogue (168) or a Mystic (150)
 *    posted there covers **three** lanes; a Fighter (96) covers one. That is a
 *    real placement question — the best slot on the field is not the best slot
 *    for the body you happen to have.
 *  - `s0` (95,300) sees only the entry climb. It is the cheap early-chip slot
 *    and the first thing a player learns to leave empty.
 *  - `s5` (870,300) sees only the final approach — the last-chance slot, and
 *    the only one that answers a leaker that got past the middle.
 *
 * Slot spacing is 130px minimum (Green Line's is 95.1), so the canvas's
 * screen-space hit floor — a radius capped at 80 logical px, nearest-wins —
 * still resolves every tap to the slot the finger was closest to at the
 * smallest supported viewport.
 *
 * Path length 2300px against the Green Line's 2290 (+0.4%).
 */
const KILN_PATH = [
  { x: -30, y: 500 },
  { x: 170, y: 500 },
  { x: 170, y: 120 },
  { x: 620, y: 120 },
  { x: 620, y: 250 },
  { x: 300, y: 250 },
  { x: 300, y: 380 },
  { x: 800, y: 380 },
  { x: 990, y: 380 },
]

export const KILN_MAP: GameMap = {
  id: 'kilnroad',
  name: 'The Kiln Road',
  width: FIELD_W,
  height: FIELD_H,
  path: KILN_PATH,
  base: KILN_PATH[KILN_PATH.length - 1],
  slots: [
    { id: 's0', pos: { x: 95, y: 300 } },
    { id: 's1', pos: { x: 250, y: 60 } },
    { id: 's2', pos: { x: 450, y: 185 } },
    { id: 's3', pos: { x: 450, y: 315 } },
    { id: 's4', pos: { x: 660, y: 250 } },
    { id: 's5', pos: { x: 870, y: 300 } },
  ],
}

/**
 * Every battle map this build ships. The run snapshot stores a map *id*, so this
 * registry is what turns one back into a field — add a map here and a save that
 * names it resumes onto the right one, instead of onto whatever happens to be
 * first (m-5).
 *
 * **Slot ids are shared across every map on purpose.** `Placement` is keyed by
 * slot id and rides in the run snapshot; a company deployed to `s3` resumes to
 * `s3` whatever field it is standing on. It also means the balance harness can
 * swap the map under a fixed team without re-writing the placement table — what
 * changes between maps is what a slot *sees*, never what it is called.
 */
export const ALL_MAPS: readonly GameMap[] = [FIRST_MAP, KILN_MAP]

/** The map with this id, or null if this build has never heard of it. */
export const mapById = (id: string): GameMap | null => ALL_MAPS.find((m) => m.id === id) ?? null

/**
 * Which battlefield a run is fought on — drawn from the run seed, once.
 *
 * It rides its own derived stream (`field`) rather than the map stream, for the
 * same reason every other stream is separate (C1): dealing one more number here
 * must never reshuffle the run map, the loot or the fights. Because it is a
 * pure function of the seed and the choice is stored in the snapshot as an id,
 * a resumed run lands on the field it was interrupted on, and a Banner switch —
 * which re-deals the run map from the same seed — cannot be used to reroll the
 * battlefield.
 */
export function pickBattleMap(runSeed: number): GameMap {
  return streamRng(runSeed, 'field').pick(ALL_MAPS)
}
