/**
 * Pure reads over the store's state — safe to pass straight to
 * `useGameStore(selector)` or to call on a plain object in a test.
 */
import { RARITY } from '../../game/data/items'
import type { ItemRarity } from '../../game/types'
import { conflictsAmong, type ClearanceConflict, type Standing } from '../../game/run/clearance'
import { nodeThreatMult } from '../../game/run/threat'
import { legMult } from '../../game/run/watch'
import { contractRules } from '../../game/run/contracts'
import type { GameData } from './types'

/**
 * The exact fields `canStartWave` reads. `GameState` satisfies it structurally,
 * so `useGameStore(canStartWave)` works — and so does calling it on a plain
 * object in a test.
 */
export type StartWaveGate = Pick<
  GameData,
  'screen' | 'runPhase' | 'currentWave' | 'lastResult' | 'engine' | 'battlePhase' | 'activeNodeId' | 'clearedNodeIds'
>

/**
 * Exactly the conditions `startWave` honours — exported so the UI can never
 * render an enabled "Start Wave" that the store then refuses (M-3).
 *
 * `startWave` calls this and nothing else, so the two cannot drift. A renderer
 * may add its own STRICTER gate on top (both UIs also require at least one
 * deployed Sentinel); it must never relax one. The soft-lock this exists to
 * kill was precisely a screen whose only control was a button the store
 * refused, on a state where nothing else rendered either.
 *
 * Pure, and deliberately so: it reads state and touches nothing, which is what
 * lets the UI ask the question as often as it likes.
 */
export function canStartWave(s: StartWaveGate): boolean {
  if (s.screen !== 'battle') return false
  if (s.runPhase !== 'active') return false
  if (!s.currentWave) return false
  // A wave that has already resolved can never be fought again.
  if (s.lastResult) return false
  if (s.engine) return false
  if (s.battlePhase !== 'setup') return false
  // No node, no wave: there is nothing to pay out into.
  if (!s.activeNodeId) return false
  if (s.clearedNodeIds.includes(s.activeNodeId)) return false
  return true
}

/**
 * A run is worth saving only while it is live and outside the Watchtower. A
 * finished run (won/lost) has already been paid out, so keeping its snapshot
 * would offer a resume into a dead run.
 *
 * `runSettled` is the third condition and the one that closes M-1: a run that
 * has been paid out is dead even though `runPhase` still reads 'active' and
 * even if something puts `screen` back to a battle or the map. Without it,
 * settling a live run wrote it straight back out on the next autosave and the
 * next settle paid it all over again.
 */
export const isLiveRun = (s: Pick<GameData, 'runPhase' | 'screen' | 'runSettled'>): boolean =>
  s.runPhase === 'active' && s.screen !== 'hub' && s.screen !== 'contracts' && !s.runSettled

export const rarityColor = (r: ItemRarity) => RARITY[r].color

/**
 * The HP multiplier the current fight's enemies carry: the hub's (always 1
 * today), the run's Threat, and — on a campaign node — what the node's own type
 * adds (`nodeThreatMult`: the final boss ×0.42; an elite ×1), and the
 * stake's last leg (`watch.legMult`: act 3 of a staked road). `startWave`
 * spawns with it and `finishBattle` prices the wave's XP with it, so the two
 * read one number.
 */
export function battleHpMult(s: Pick<GameData, 'enemyHpMult' | 'threat' | 'activeNodeId' | 'runMap' | 'contract'>): number {
  const node = s.activeNodeId ? s.runMap.nodes.find((n) => n.id === s.activeNodeId) : undefined
  return s.enemyHpMult * s.threat * nodeThreatMult(node?.type) * (node ? legMult(contractRules(s.contract), node.layer) : 1)
}

/** What a raider who reaches the wagons steals in the current fight, ×: the stake's last leg and the muster. */
export function battleTheftMult(s: Pick<GameData, 'activeNodeId' | 'runMap' | 'contract'>): number {
  const node = s.activeNodeId ? s.runMap.nodes.find((n) => n.id === s.activeNodeId) : undefined
  const rules = contractRules(s.contract)
  return rules.leakMult * (node ? legMult(rules, node.layer) : 1)
}

/*
 * ---------------------------------------------------------------------------
 * Between rounds and during them (weapon clearance)
 * ---------------------------------------------------------------------------
 *
 * The designer: "items locked during rounds, and towers cannot be moved during
 * rounds. only between". A ROUND is a live sub-wave: the engine running and not
 * held. Between rounds is the setup before a wave and the breather between two
 * sub-waves; gear and posts change only there, so that is also the only place a
 * clearance conflict can stand (`run/clearance.ts`).
 */
export type FieldGate = Pick<GameData, 'screen' | 'engine' | 'battlePhase' | 'roster' | 'placements' | 'battleMap'>

/**
 * Gear is locked: a sub-wave is live (or its clear is being held on screen).
 * Equip, unequip and swap all refuse, wherever they come from. Merchants,
 * rewards and every other page between nodes are never in a battle, so never
 * locked.
 */
export const gearLocked = (s: Pick<GameData, 'screen' | 'engine'>): boolean =>
  s.screen === 'battle' && !!s.engine && !s.engine.breather

/** Is this the breather between two sub-waves? */
export const inBreather = (s: Pick<GameData, 'screen' | 'engine' | 'battlePhase'>): boolean =>
  s.screen === 'battle' && s.battlePhase === 'battle' && !!s.engine?.breather

/**
 * Who stands where on the field right now, between rounds: the setup posts, or
 * the held engine's heroes in the breather (as the engine has them — moved and
 * re-dressed). Empty during a live round and off the battle screen.
 */
export function fieldStanding(s: FieldGate): Standing[] {
  if (s.screen !== 'battle') return []
  if (s.engine) return inBreather(s) ? s.engine.sentinels.map((x) => ({ hero: x.def, tile: x.slotId })) : []
  if (s.battlePhase !== 'setup') return []
  const open = new Set(s.battleMap.slots.map((x) => x.id))
  const byId = new Map(s.roster.map((h) => [h.id, h]))
  const out: Standing[] = []
  for (const [tile, id] of Object.entries(s.placements)) {
    const hero = id ? byId.get(id) : undefined
    if (hero && open.has(tile)) out.push({ hero, tile })
  }
  return out
}

/**
 * The clearance conflicts standing on the field right now (between rounds).
 * Any one holds the next wave: `startWave` and `resumeSubWave` refuse, and the
 * wave strip says how to make space. Not part of `canStartWave` on purpose —
 * that predicate says whether this ground can be fought AT ALL (its "no" is
 * the stranded-battle exit); a conflict only says "not yet".
 */
export const fieldConflicts = (s: FieldGate): ClearanceConflict[] => conflictsAmong(fieldStanding(s))
