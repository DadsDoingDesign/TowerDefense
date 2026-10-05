/**
 * The run map as the run walks it: dealing it, its frontier, and the battle
 * field's slots. Pure — the map stream and the hub's unlocks arrive as
 * arguments.
 */
import type { RNG } from '../core/rng'
import { generateRunMap, type MapOptions, type RunMap } from '../data/runmap'
import { isMelee } from '../engine/melee'
import type { Post } from '../data/terrain'
import type { GameMap, Placement, Sentinel } from '../types'

/** The Banner rules the map shape reads (a subset of `metaStore.BannerRules`). */
export interface MapBannerRules {
  noMerchants: boolean
  noRecruits: boolean
}

export const neighborsOf = (map: RunMap, nodeId: string): string[] =>
  map.edges.filter((e) => e.from === nodeId).map((e) => e.to)

/** The frontier after standing on `nodeId`: its neighbours not yet cleared. */
export const frontierFrom = (map: RunMap, nodeId: string, cleared: readonly string[]): string[] =>
  neighborsOf(map, nodeId).filter((id) => !cleared.includes(id))

/**
 * The map shape a run is dealt, given what the hub has unlocked and which
 * Banner the run is flying. Unlocks widen it; Banners narrow it (H15 / H16).
 */
export function mapOptionsFor(banner: MapBannerRules, unlocked: (id: string) => boolean): MapOptions {
  return {
    wideMap: unlocked('cartographer'),
    extraRecruit: unlocked('freeCompanies'),
    standingOrders: unlocked('standingOrders'),
    noMerchants: banner.noMerchants,
    noRecruits: banner.noRecruits,
  }
}

/** Deal a run map off the map stream and stand the company on its start node. */
export function makeRun(mapRng: RNG, options: MapOptions) {
  const runMap = generateRunMap(mapRng, options)
  const start = runMap.nodes.find((n) => n.type === 'start')!
  return {
    runMap,
    currentNodeId: start.id,
    clearedNodeIds: [start.id],
    reachableNodeIds: neighborsOf(runMap, start.id),
  }
}

export function emptyPlacements(map: GameMap): Placement {
  const p: Placement = {}
  for (const s of map.slots) p[s.id] = null
  return p
}

/**
 * The company's posts carried onto `map` (G1-2). A placement is keyed by tile
 * id, and the next battle's terrain can block a tile the company stood on (a
 * lake, a fire): that hero goes back to the bench rather than standing in it.
 * Only open tiles are kept, each hero at most once, at most `cap` heroes.
 * `keep` filters hero ids (e.g. to the live roster).
 *
 * The clearance is NOT applied here (weapon clearance): a hero who took a
 * sword at the merchant, or a save from before the rule, may stand beside
 * someone now. Nobody is moved or benched behind the player's back — the
 * battle opens with that clearance CONFLICT drawn on the field, and Start
 * Wave waits until the player makes space (`run/clearance.ts`).
 */
export function carryPlacements(
  prev: Placement,
  map: GameMap,
  keep: (sentinelId: string) => boolean,
  cap: number,
): Placement {
  const next = emptyPlacements(map)
  const seen = new Set<string>()
  for (const [tileId, sentId] of Object.entries(prev ?? {})) {
    if (!sentId || typeof sentId !== 'string' || !Object.prototype.hasOwnProperty.call(next, tileId)) continue
    if (seen.has(sentId) || !keep(sentId)) continue
    if (seen.size >= cap) break
    next[tileId] = sentId
    seen.add(sentId)
  }
  return next
}

/** Which hero ids of `roster` swing (`melee.isMelee`); an unknown id does not. */
export function meleeOf(roster: readonly Sentinel[]): (sentinelId: string) => boolean {
  const melee = new Set(roster.filter(isMelee).map((h) => h.id))
  return (id) => melee.has(id)
}

/**
 * The heroes posted in `placements` as the spacing rule sees them, `except`
 * one hero (the one being moved) and any `exceptTile` (the tile it is about to
 * take, whose occupant goes back to the bench).
 */
export function postsOf(
  placements: Placement,
  melee: (sentinelId: string) => boolean,
  except?: string | null,
  exceptTile?: string,
): Post[] {
  const out: Post[] = []
  for (const [tile, id] of Object.entries(placements)) {
    if (!id || id === except || tile === exceptTile) continue
    out.push({ tile, melee: melee(id) })
  }
  return out
}

export function placedSentinels(
  roster: Sentinel[],
  placements: Placement,
): { sentinel: Sentinel; slotId: string }[] {
  const byId = new Map(roster.map((s) => [s.id, s]))
  const out: { sentinel: Sentinel; slotId: string }[] = []
  for (const [slotId, sentId] of Object.entries(placements)) {
    if (!sentId) continue
    const sentinel = byId.get(sentId)
    if (sentinel) out.push({ sentinel, slotId })
  }
  return out
}

/**
 * The node a wave is generated for. An act boss (`miniboss`) fields a `boss`
 * wave at its own depth — `waves.nodeEncounterSpec` knows the three fight
 * types it was written for, and this is the one place the fourth is mapped
 * onto them, so the store's `selectNode` and the map's preview agree.
 */
export const encounterNode = <T extends { type: string; layer: number; row: number }>(node: T): T =>
  node.type === 'miniboss' ? { ...node, type: 'boss' } : node

/**
 * The Crossroads — recruit OR mutate — fires on clearing each ACT BOSS
 * (Phase 3b): at the two act breaks, never on the final boss.
 *
 * It used to fire once, at the map's halfway layer, and the review found both
 * halves of that wanting: a run is three acts now and an act break is the
 * natural place for the company to change shape, and the one mutation a run
 * could ever take made the Mythic tier a single dice roll. `forkDone` is kept
 * for old saves (it records that the first fork has been dealt); the rule reads
 * the node, and `finishBattle` settles each node only once, so a fork cannot
 * fire a second time for the same boss.
 */
export function forkFires(node: { type: string }): boolean {
  return node.type === 'miniboss'
}
