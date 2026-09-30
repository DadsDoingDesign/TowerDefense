/**
 * LS3 — the first run's road, eased in. Pure: no zustand, no React, no RNG.
 *
 * The designer's goal is "easy to pick up", and a first run used to meet about
 * twenty ideas at once. Most of the staging is presentation (`state/staging.ts`
 * decides what is SHOWN), but four ideas are properties of the road itself and
 * can only be held back where the road is dealt:
 *
 *  - **Merchants from the second stop.** Layer 1 may roll one stop, and it can
 *    be a merchant — a shop before the player has seen an item. On a first run
 *    a layer-1 merchant becomes a fight, and if that was the map's only
 *    merchant one is placed on the nearest later layer that has room.
 *  - **Danger tiles and map challenges not before depth 3.** Cursed ground
 *    and its seeded boulders wait until the player has fought twice on plain
 *    ground (`calmGround`); the Flooded / Wildfire rules wait one depth more
 *    (`calmTerrain`), so depth 3 — where elites start too — does not
 *    introduce three new things in one fight.
 *  - **Relics at the first elite.** A plain battle's hand is items only until
 *    the run has cleared an elite (`battleRelicsWithheld`); the elite's own
 *    hand always carries a relic, so that is where relics are met.
 *
 * **Only a first run changes.** Every function here is the identity unless it
 * is told the run is a first run, and none of them draws from a stream: the map
 * is post-processed AFTER it has been dealt, the ground rules are the same
 * hashes answered `null`, and the relic rule rides on the reward hand's
 * existing `noBattleRelics` switch. So every other run — and the balance
 * harness, which never passes `firstRun` — deals exactly what it dealt before,
 * draw for draw (`tests/firstRun.test.ts` holds that).
 */
import type { MapNode, RunMap } from '../data/runmap'

/** The first depth a first run meets danger tiles (cursed ground) on. */
export const CALM_DEPTH = 3
/** The first depth a first run meets a map challenge on. */
export const CHALLENGE_DEPTH = 4

/** The first layer a first run may meet a merchant on. */
export const FIRST_MERCHANT_LAYER = 2

/** At most this many stops share a layer (mirrors `runmap.ts`). */
const MAX_STOPS_PER_LAYER = 2

const isFight = (n: MapNode): boolean => n.type === 'battle' || n.type === 'elite'

/**
 * True when a fight on `node` is laid without danger tiles (cursed ground and
 * its seeded boulders). Only ever true on a first run, below {@link CALM_DEPTH}.
 */
export const calmGround = (node: { layer: number }, firstRun: boolean): boolean => firstRun && node.layer < CALM_DEPTH

/** True when a fight on `node` carries no map challenge because it is a first run's. */
export const calmTerrain = (node: { layer: number }, firstRun: boolean): boolean => firstRun && node.layer < CHALLENGE_DEPTH

/**
 * The first run's map: no merchant before {@link FIRST_MERCHANT_LAYER}. A
 * merchant taken off layer 1 is put back on the nearest later layer with room
 * for a stop (so a road only loses one when no layer has room). Returns the
 * SAME object when nothing moves (or when this is not a first run), a new one
 * otherwise.
 */
export function stageFirstRunMap(map: RunMap, firstRun: boolean): RunMap {
  if (!firstRun) return map
  const early = map.nodes.filter((n) => n.type === 'merchant' && n.layer < FIRST_MERCHANT_LAYER)
  if (!early.length) return map
  const nodes = map.nodes.map((n) => ({ ...n }))
  const byId = new Map(nodes.map((n) => [n.id, n]))
  for (const m of early) byId.get(m.id)!.type = 'battle'

  // Put the moved merchants back on the road, nearest layer first, where a
  // layer has room for one more stop, holds no merchant already, and keeps a
  // fight beside it. Deterministic: rows are scanned in order.
  let owed = early.length
  const lastLayer = map.layers - 1
  for (let layer = FIRST_MERCHANT_LAYER; layer < lastLayer && owed > 0; layer++) {
    const row = nodes.filter((n) => n.layer === layer).sort((a, b) => a.row - b.row)
    if (row.some((n) => n.type === 'merchant' || n.type === 'miniboss')) continue
    const stops = row.filter((n) => !isFight(n) && n.type !== 'start').length
    if (stops >= MAX_STOPS_PER_LAYER) continue
    const battles = row.filter((n) => n.type === 'battle')
    // Never the layer's last fight.
    if (battles.length < 1 || row.filter(isFight).length < 2) continue
    battles[0].type = 'merchant'
    owed--
  }
  return { ...map, nodes }
}

/**
 * Whether a plain battle's reward hand holds its relics back: on a first run,
 * until an elite (or an act boss) has been cleared.
 */
export function battleRelicsWithheld(
  firstRun: boolean,
  runMap: { nodes: readonly Pick<MapNode, 'id' | 'type'>[] },
  clearedNodeIds: readonly string[],
): boolean {
  if (!firstRun) return false
  const cleared = new Set(clearedNodeIds)
  return !runMap.nodes.some((n) => cleared.has(n.id) && (n.type === 'elite' || n.type === 'miniboss'))
}
