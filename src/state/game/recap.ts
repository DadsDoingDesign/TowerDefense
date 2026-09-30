import type { BattleResult } from '../../game/engine/engine'
import { buildName } from '../../game/engine/leveling'
import type { Item, Sentinel } from '../../game/types'
import { MAX_BANNER, useMetaStore } from '../metaStore'
import { useSettingsStore } from '../settingsStore'
import type { GameData, RunRecap } from './types'

/**
 * Assemble the run receipt (M14 / H23).
 *
 * Built at the moment the run ends, from the state that is still live, because
 * every path out of a finished run tears that state down. `nextBanner` is what
 * turns a win into a reason to play again: beating the campaign under Banner N
 * is what earns the right to be *asked* about Banner N+1 — an NG+ that changes
 * the rules rather than a difficulty slider.
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
  const unlockedBanners = useMetaStore.getState().sacrificeTier
  return {
    won: info.won,
    mode: st.mode,
    seed: st.runSeed,
    challenge: st.challenge,
    // The seed alone does not reproduce the run; the pair does (F6).
    assist: useSettingsStore.getState().assist,
    depth: info.depth,
    rounds: st.wins,
    banner: st.runBanner,
    marks: info.marks,
    kills: info.kills,
    goldLeft: st.gold,
    threat: st.threat,
    heroes,
    leaks: result.leakDamage,
    enemiesLeaked: result.enemiesLeaked,
    // Winning promotes you one rung, up to what the Watchtower has opened.
    nextBanner: info.won ? Math.min(unlockedBanners, Math.min(MAX_BANNER, st.runBanner + 1)) : st.runBanner,
    spoils: info.spoils ?? [],
  }
}
