/**
 * Which battlefield each act of a run is fought on — "the road changes country
 * at every city" (October 2026, designer decision on audit §4 item 7).
 *
 * One field for the whole run meant the company's posts carried over from the
 * first fight to the last, and every fight after the first collapsed to
 * Start / Next / Take: ~1–2 meaningful decisions a minute against the 5–10 of
 * the genre's best. So each act is fought on its OWN field, and the company
 * comes off its posts when the caravan reaches it (`selectNode`): the first
 * fight of an act is a placement puzzle again. Within an act the posts still
 * carry from fight to fight (`map.carryPlacements`).
 *
 * The rules, all pure:
 *
 *  - **Act 1 is the field the run was always dealt** (`maps.pickBattleMap`, the
 *    `field` stream), so every act-1 fight, every determinism golden and every
 *    act-1 balance number is exactly what it was.
 *  - **A later act is a fresh hash of (run seed, act)** — never a draw on a run
 *    stream, so dealing it cannot move the loot, the map or the fights (RNG
 *    draw order is behaviour).
 *  - **It never repeats the act before it** while another field exists. With
 *    two fields the road alternates; with more, the hash picks among the rest.
 *  - **Only the field changes.** The node's map challenge is still the route's
 *    own ground (the company's — wildfire, quarry, flooded…) and its danger
 *    ground is still seeded per node (`run/terrain`), now laid on the new field.
 *    The orientation (portrait twin on a phone) is still chosen at the node.
 *
 * The store, the run map's preview, the city page and the balance harness all
 * read these, so the harness measures the field the game deals.
 */
import { hashSeed, RNG } from '../core/rng'
import { ALL_MAPS, mapById, pickBattleMap } from '../data/maps'
import { actOf, ACTS } from './threat'

/**
 * The field id act `act` is fought on, given the field the act before it was
 * fought on (`prevFieldId`; derived from the seed when omitted, which is what
 * every run dealt under this rule has). Passing the field actually in use lets
 * a save from before the rule — which may still stand on any field — move on
 * without repeating it.
 */
export function actFieldId(runSeed: number, act: number, prevFieldId?: string | null): string {
  if (!(act > 1)) return pickBattleMap(runSeed).id
  const prev = prevFieldId ?? actFieldId(runSeed, act - 1)
  const others = ALL_MAPS.filter((m) => m.id !== prev)
  const pool = others.length ? others : ALL_MAPS
  return new RNG(hashSeed(runSeed, 'act-field', act)).pick(pool).id
}

/** Every act's field id for a run dealt under this rule, act 1 first. */
export function actFieldIds(runSeed: number): string[] {
  const out: string[] = []
  for (let act = 1; act <= ACTS; act++) out.push(actFieldId(runSeed, act, out[act - 2]))
  return out
}

/** Where the run's battlefield stands: the field id and the act it belongs to. */
export interface FieldState {
  fieldId: string
  /** The act whose field `fieldId` is (1…ACTS). */
  fieldAct: number
}

/**
 * The field a FIGHT on `layer` is fought on, from where the run's field stands.
 * `fresh` is true when the fight opens a new act's ground — the company starts
 * it on the bench. A stop (merchant, shrine…) never moves the field: the first
 * FIGHT of an act does, so posts are only cleared where they are used.
 */
export function groundFor(runSeed: number, cur: FieldState, layer: number): FieldState & { fresh: boolean } {
  const act = actOf(layer)
  if (!(act > cur.fieldAct)) return { fieldId: cur.fieldId, fieldAct: cur.fieldAct, fresh: false }
  return { fieldId: actFieldId(runSeed, act, cur.fieldId), fieldAct: act, fresh: true }
}

/**
 * The act a saved run's field belongs to when the save does not say (a save
 * from before this rule): the act of the node it stands on — the battle being
 * fought, else the last node cleared. Its field is honoured for the rest of
 * that act and changes at the next one.
 */
export function inferredFieldAct(layer: unknown): number {
  const l = typeof layer === 'number' && Number.isFinite(layer) ? layer : 0
  return actOf(l)
}

/** A stored `fieldAct`, if it is one this build can hold (an integer act). */
export function validFieldAct(v: unknown): number | null {
  return Number.isInteger(v) && (v as number) >= 1 && (v as number) <= ACTS ? (v as number) : null
}

/** A field's display name ("The Kiln Road"), or the id if the build lacks it. */
export const fieldName = (fieldId: string): string => mapById(fieldId)?.name ?? fieldId
