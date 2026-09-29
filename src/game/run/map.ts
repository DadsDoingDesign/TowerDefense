/**
 * The run map as the run walks it: dealing it, its frontier, and the battle
 * field's slots. Pure — the map stream and the hub's unlocks arrive as
 * arguments.
 */
import type { RNG } from '../core/rng'
import { generateRunMap, type MapOptions, type RunMap } from '../data/runmap'
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
 * At the map's halfway point the one-time fork fires: recruit or mutate. Never
 * on the boss clear, never twice.
 */
export function forkFires(runMap: Pick<RunMap, 'layers'>, layer: number, forkDone: boolean, wonRun: boolean): boolean {
  const half = Math.ceil((runMap.layers - 1) / 2)
  return !forkDone && !wonRun && layer >= half
}
