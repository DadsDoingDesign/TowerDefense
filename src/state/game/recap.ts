import type { BattleResult } from '../../game/engine/engine'
import { kitName } from '../../game/data/gear'
import { cargoPct } from '../../game/run/contracts'
import { homeGold, roadShareFor } from '../../game/run/hq'
import type { Item, Sentinel } from '../../game/types'
import { lastProgress } from '../metaStore'
import { useSettingsStore } from '../settingsStore'
import type { GameData, RunRecap } from './types'

/**
 * Assemble the run receipt (M14 / H23).
 *
 * Built at the moment the run ends, from the state that is still live, because
 * every path out of a finished run tears that state down. `progress` is what
 * turns a run into a reason to play again: the standing it earned with the
 * company, and the skill cards and item kinds it unlocked. It is read off the
 * settle that ran just before this (`settleContract`).
 *
 * `result` is the last wave's receipt — null for a cash-out, which ends the
 * run at a city rather than on a field.
 */
export function buildRecap(
  st: GameData,
  result: BattleResult | null,
  info: {
    outcome: RunRecap['outcome']
    depth: number
    kills: number
    /** Gold the settle banked. */
    deposit: number
    spoils?: Item[]
    roster?: Sentinel[]
    /** The wagons' condition at the end (defaults to the run's). */
    baseHp?: number
  },
): RunRecap {
  const roster = info.roster ?? st.roster
  const byId = new Map(roster.map((s) => [s.id, s]))
  const heroes = (result?.perSentinel ?? [])
    .map((p) => {
      const s = byId.get(p.id)
      return {
        id: p.id,
        name: s?.name ?? p.id,
        build: s ? kitName(s) : '—',
        level: s?.level ?? 1,
        kills: p.kills,
        damage: Math.round(p.damageDealt),
      }
    })
    .sort((a, b) => b.damage - a.damage)
  return {
    won: info.outcome === 'delivered',
    outcome: info.outcome,
    contract: st.contract,
    cargo: cargoPct(info.baseHp ?? st.baseHp, st.maxBaseHp),
    deposit: info.deposit,
    seed: st.runSeed,
    challenge: st.challenge,
    // The seed alone does not reproduce the run; the pair does (F6).
    assist: useSettingsStore.getState().assist,
    depth: info.depth,
    kills: info.kills,
    goldLeft: st.gold,
    // The purse's split (the road-gold share): what was left of the purse, and
    // the road's gold and the share of it banked — the settle's own numbers.
    home: st.contract?.signed ? homeGold({ purse: st.contract.purse, earned: st.contract.earned, gold: st.gold }, roadShareFor(info.outcome)) : null,
    interest: lastProgress.run?.interest ?? 0,
    threat: st.threat,
    heroes,
    leaks: result?.leakDamage ?? 0,
    enemiesLeaked: result?.enemiesLeaked ?? 0,
    progress: lastProgress.run,
    spoils: info.spoils ?? [],
  }
}
