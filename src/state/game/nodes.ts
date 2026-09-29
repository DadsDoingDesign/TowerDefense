import { frontierFrom } from '../../game/run/map'
import { threatAfterSpecial } from '../../game/run/threat'
import { CLEAR_SHELL } from './fresh'
import type { GetState, SetState } from './types'

/**
 * Consume a non-battle node: mark it cleared, advance the map — and advance
 * Threat.
 *
 * Battle clears run through `finishBattle`, which charges `THREAT_PER_NODE.normal`
 * / `.elite`. This is the other half of the same rule: **every node the player
 * consumes advances Threat**, specials at the smaller `.special` step.
 *
 * The step is charged off the node's own type rather than assumed, and only
 * once — a node already in `clearedNodeIds` charges nothing — so neither a
 * future caller nor a replayed snapshot can double-bill a run.
 */
export function completeNode(get: GetState, set: SetState, nodeId: string): void {
  const { runMap, clearedNodeIds, threat } = get()
  const alreadyCleared = clearedNodeIds.includes(nodeId)
  const node = runMap.nodes.find((n) => n.id === nodeId)
  const type = node?.type
  // A node this map does not have, or one already consumed, is not a node to
  // march onto: answer the offer and leave the frontier exactly where it is
  // (F1). Advancing off it is the rewind — `currentNodeId` moves backwards and
  // `reachableNodeIds` is rebuilt from a branch the run never routed to.
  // `selectNode` makes a stale event unreachable in the first place; this is
  // the belt to that braces, for any route that still manufactures one.
  if (!node || alreadyCleared) {
    set({
      event: null,
      merchant: null,
      shrineOffer: null,
      recruitOptions: [],
      screen: 'map',
      ...CLEAR_SHELL,
    })
    return
  }
  const cleared = [...clearedNodeIds, nodeId]
  set({
    clearedNodeIds: cleared,
    currentNodeId: nodeId,
    reachableNodeIds: frontierFrom(runMap, nodeId, cleared),
    threat: threatAfterSpecial(threat, type),
    event: null,
    merchant: null,
    shrineOffer: null,
    recruitOptions: [],
    screen: 'map',
    ...CLEAR_SHELL,
  })
}
