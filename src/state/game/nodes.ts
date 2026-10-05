import { applyBattleXp, stopXp } from '../../game/run/battle'
import { frontierFrom } from '../../game/run/map'
import { threatAfterLayer } from '../../game/run/threat'
import { stakeRules } from '../../game/run/contracts'
import { CLEAR_SHELL } from './fresh'
import type { GetState, SetState } from './types'

/**
 * Consume a non-battle node: mark it cleared, advance the map — and move Threat
 * to the next layer's.
 *
 * Threat follows the road (Phase 3b, `run/threat.ts`): after ANY node on layer
 * L the next stop is fought at `threatAtLayer(L + 1)`, whatever the node was
 * and whatever the player took from it. Battle clears set the same value in
 * `finishBattle`. A node already in `clearedNodeIds` changes nothing, so a
 * replayed snapshot cannot move the run on twice.
 */
export function completeNode(get: GetState, set: SetState, nodeId: string): void {
  const { runMap, clearedNodeIds, contract } = get()
  const alreadyCleared = clearedNodeIds.includes(nodeId)
  const node = runMap.nodes.find((n) => n.id === nodeId)
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
  // A stop still drills the company (Phase 3b): every hero gains `stopXp` for
  // the layer, and a level that crosses a skill milestone owes its choice
  // exactly as a wave's XP does (SK1).
  const { roster } = get()
  const drilled = applyBattleXp(roster, roster.map((s) => ({ id: s.id, xpGained: stopXp(node.layer) })))
  set({
    roster: drilled.roster,
    clearedNodeIds: cleared,
    currentNodeId: nodeId,
    reachableNodeIds: frontierFrom(runMap, nodeId, cleared),
    threat: threatAfterLayer(node.layer, stakeRules(contract?.crates ?? 0).startThreat),
    event: null,
    merchant: null,
    shrineOffer: null,
    recruitOptions: [],
    screen: 'map',
    ...CLEAR_SHELL,
  })
}
