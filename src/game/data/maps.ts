import { streamRng } from '../core/rng'
import type { Vec2 } from '../core/vec'
import type { GameMap } from '../types'

/**
 * The battlefields. Every landscape field is 960x560 logical px; the renderer
 * composes at exactly the map's own size and blits down, so the field
 * dimensions are a fixed contract, not a per-map choice. Each one also has a
 * 620x960 portrait twin a phone fights on (see § Portrait battlefields below).
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
 * ---------------------------------------------------------------------------
 * Portrait battlefields
 * ---------------------------------------------------------------------------
 *
 * A 960×560 landscape field on a portrait phone is width-bound: at 390×844 in
 * a live wave the Stage is 390×573 and the field used 390×228 of it, with ~170
 * px of decorative forest above and below (more on a 430×932). The lane is the
 * subject of the game and it was 40% of the screen it had.
 *
 * So every field ships a PORTRAIT TWIN, drawn tall, and a phone fights on it.
 *
 * **The twin is the landscape field under an isometry**, not a redrawn map: the
 * transpose `(x, y) → (y + PORTRAIT_PAD, x)`, a reflection across the diagonal
 * plus a shift. Rather than authoring a second path by hand and then tuning it
 * until it measures "close", the twin is exactly as long (±0 px), has the same
 * six slots, and every slot sees exactly the same road at every range, every
 * aura pair is the same distance apart, and the order in which the column meets
 * each slot is unchanged. Balance does not *transfer*, it is identical by
 * construction — and `balance/report.ts` §17 proves it on the live engine (a
 * geometry check plus a stop-rate / Gate-HP battery at several depths), so any
 * future axis-dependent rule in the sim (a lob that falls "down", a spawn edge
 * that assumes x) fails the gate instead of quietly making phones easier.
 *
 * That matters more than it looks: the **Daily Watch deals one seed to every
 * player**, on whatever device they own. A portrait twin that was "within 3%"
 * would make the daily a different puzzle on a phone than on a desk. An
 * isometric one makes it the same puzzle turned on its side.
 *
 * The transpose sends the landscape's left edge to the top: the column enters
 * at the top of a phone screen and walks down toward the Gate at the bottom,
 * which is where the party row and the wave strip are — the fight moves toward
 * the player's thumb. `PORTRAIT_PAD` widens the field by 30 px either side so
 * the meadow fills a 390-wide Stage (the field is height-bound there: 573/960
 * = 0.597, so it can be up to 653 wide before width starts to bind).
 *
 * Scale at the live Stage (CSS px per field px), landscape → portrait:
 * 390×844 0.406 → 0.597 · 375×667 0.391 → 0.435 · 320×568 0.333 → 0.344 ·
 * 430×932 0.448 → 0.689. Units draw at the field's own density, so a goblin
 * that was ~24 CSS px on a 390 phone is ~35 on the portrait field.
 */
export const PORTRAIT_PAD = 30

export type FieldOrientation = 'landscape' | 'portrait'

/** The portrait twin of a landscape field — see the note above. */
function portraitTwin(m: GameMap): GameMap {
  const t = (p: Vec2): Vec2 => ({ x: p.y + PORTRAIT_PAD, y: p.x })
  const path = m.path.map(t)
  return {
    id: `${m.id}-tall`,
    name: m.name,
    width: m.height + PORTRAIT_PAD * 2,
    height: m.width,
    path,
    base: path[path.length - 1],
    slots: m.slots.map((s) => ({ id: s.id, pos: t(s.pos) })),
    orientation: 'portrait',
    twinOf: m.id,
  }
}

/** Every portrait twin, in `ALL_MAPS` order. Never dealt by `pickBattleMap`. */
export const PORTRAIT_MAPS: readonly GameMap[] = ALL_MAPS.map(portraitTwin)

/**
 * The run's field identity for any map, landscape or twin — what the seed
 * dealt, what the snapshot stores, what the music cue keys on.
 */
export const fieldIdOf = (m: GameMap): string => m.twinOf ?? m.id

/** Which way up a map is drawn. */
export const orientationOf = (m: GameMap): FieldOrientation => m.orientation ?? 'landscape'

/**
 * The field `map` stands for, drawn `orientation` up. Idempotent, and a pure
 * lookup: the field identity never changes, only the twin that is fought on.
 */
export function orientField(map: GameMap, orientation: FieldOrientation): GameMap {
  const id = fieldIdOf(map)
  const land = mapById(id) ?? map
  if (orientation === 'landscape') return land
  return PORTRAIT_MAPS.find((m) => m.twinOf === id) ?? land
}

/**
 * Which orientation a battle is fought in, from the viewport at the moment the
 * battle starts (entering its node).
 *
 * Portrait exactly when the shell is the phone column (`< 700` wide, the
 * `shell-wide.css` break — tablets and desks re-flow into a side-by-side
 * layout whose Stage is landscape) AND the window is clearly tall (h ≥ 1.3 w),
 * which every portrait phone is (1.75–2.2) and a near-square narrow desktop
 * window is not. A landscape phone gets the rotate prompt; a short landscape
 * window gets the landscape field.
 *
 * **Fixed for the battle.** The choice is made once, when the node is entered,
 * and stored with the run: a rotation or window resize mid-battle re-fits the
 * same field (letterboxed in the apron) rather than swapping geometry under a
 * placed company, and a resumed battle comes back on the field it was saved
 * on. The next node chooses again. Because the twins are isometric this is a
 * presentation decision with zero balance consequence either way — which is
 * what makes "per battle, from the layout" safe rather than exploitable.
 */
export function chooseFieldOrientation(viewportW: number, viewportH: number): FieldOrientation {
  if (!(viewportW > 0) || !(viewportH > 0)) return 'landscape'
  return viewportW < 700 && viewportH >= viewportW * 1.3 ? 'portrait' : 'landscape'
}

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
