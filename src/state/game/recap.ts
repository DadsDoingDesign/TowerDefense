import type { BattleResult } from '../../game/engine/engine'
import { buildName } from '../../game/engine/leveling'
import type { Item, Sentinel } from '../../game/types'
import { lastProgress } from '../metaStore'
import { useSettingsStore } from '../settingsStore'
import type { GameData, RunRecap } from './types'

/**
 * Assemble the run receipt (M14 / H23).
 *
 * Built at the moment the run ends, from the state that is still live, because
 * every path out of a finished run tears that state down. `progress` is what
 * turns a run into a reason to play again (SK1): the Watch XP it earned, the
 * skill cards it unlocked, and — for a win — the difficulty step it climbed.
 * It is read off the settle that ran just before this (`grantRunRewards`).
 */
export function buildRecap(
  st: GameData,
  result: BattleResult,
  info: {
    won: boolean
    depth: number
    marks: number
    kills: number
    spoils?: Item[]
    roster?: Sentinel[]
  },
): RunRecap {
  const roster = info.roster ?? st.roster
  const byId = new Map(roster.map((s) => [s.id, s]))
  const heroes = result.perSentinel
    .map((p) => {
      const s = byId.get(p.id)
      return {
        id: p.id,
        name: s?.name ?? p.id,
        build: s ? buildName(s) : '—',
        level: s?.level ?? 1,
        kills: p.kills,
        damage: Math.round(p.damageDealt),
      }
    })
    .sort((a, b) => b.damage - a.damage)
  return {
    won: info.won,
    mode: st.mode,
    seed: st.runSeed,
    challenge: st.challenge,
    // The seed alone does not reproduce the run; the pair does (F6).
    assist: useSettingsStore.getState().assist,
    depth: info.depth,
    rounds: st.wins,
    difficulty: st.runDifficulty,
    marks: info.marks,
    kills: info.kills,
    goldLeft: st.gold,
    threat: st.threat,
    heroes,
    leaks: result.leakDamage,
    enemiesLeaked: result.enemiesLeaked,
    progress: lastProgress.run,
    spoils: info.spoils ?? [],
  }
}
