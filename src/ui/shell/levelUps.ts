import { useEffect } from 'react'
import { create } from 'zustand'
import { pendingPerkLevel } from '../../game/run/perks'
import type { Sentinel } from '../../game/types'
import { useGameStore } from '../../state/gameStore'
import type { GameState } from '../../state/game/types'

/**
 * G3-2 — the reward and the level-ups are handled where the wave was fought.
 *
 * A normal campaign wave used to end in three hops: the "Wave cleared" receipt,
 * a Continue, then a separate Spoils page, with a level-up choice arriving as a
 * blocking modal on top of whichever of those happened to be showing. Now:
 *
 *  - the reward hand fills the Selector row under the dimmed field, the first
 *    card preselected so its detail is already in the Context panel, and
 *    "Take it" is the one primary action (`rewardInPlace`);
 *  - a hero who levelled glows on the roster with a "Lv 5 ↑" badge, and a tap
 *    opens its level-up (evolution, perk, or just what grew) in the Context
 *    panel instead of a modal. The badge stays — onto the run map and into the
 *    next battle — until the player has dealt with it.
 *
 * Elite and boss spoils keep their standalone page, and the level-ups they pay
 * keep the modal (`EvolutionModal` / `PerkPicker`): those skip only the heroes
 * this module has taken over (`deferredToRoster`).
 *
 * View state, like `mapFocus`: never snapshotted, never read by the engine. A
 * resumed run starts with nothing here, and any choice still owed falls back to
 * the modal — the old contract — rather than being lost.
 */
export interface LevelUp {
  /** Level before the wave (the earliest unseen one, if it levelled twice). */
  from: number
  /** The hero as the wave found it — for "what grew" and the DPS delta. */
  before: Sentinel
  /** The player has opened it. A choice still owed keeps it open regardless. */
  seen: boolean
}

interface LevelUpState {
  runSeed: number | null
  /** The roster as each wave began, by hero id. */
  waveStart: Record<string, Sentinel>
  /** Heroes whose level-up is handled on the roster, by id. */
  heroes: Record<string, LevelUp>
  /** The last reward card looked at, so a finished level-up can hand back to it. */
  lastReward: string | null
}

export const useLevelUps = create<LevelUpState>(() => ({
  runSeed: null,
  waveStart: {},
  heroes: {},
  lastReward: null,
}))

type RewardFacts = Pick<
  GameState,
  'screen' | 'mode' | 'runPhase' | 'reward' | 'lastResult' | 'waveBeat' | 'engine' | 'crossroads' | 'runMap' | 'currentNodeId'
>

/**
 * The reward is picked in place, under the field — a cleared NORMAL campaign
 * battle with its hand dealt. Elites, act bosses (their hand is three relics and
 * the Crossroads follows) and the final boss keep the standalone spoils page.
 *
 * The node kind is the one the MAP dealt (`node.type`), the same fact
 * `finishBattle` reads to choose the hand, so the page and the hand agree.
 */
export function rewardInPlace(s: RewardFacts): boolean {
  if (s.screen !== 'battle' || s.mode !== 'campaign' || s.runPhase !== 'active') return false
  if (s.waveBeat || s.engine || s.crossroads) return false
  if (!s.reward || s.reward.length === 0) return false
  if (!s.lastResult || s.lastResult.status !== 'cleared') return false
  return s.runMap.nodes.find((n) => n.id === s.currentNodeId)?.type === 'battle'
}

/** The hero owes a permanent choice: an evolution, or a spec perk. */
export function choiceOwed(hero: Sentinel, evolutionQueue: readonly string[]): 'evolve' | 'perk' | null {
  if (evolutionQueue.includes(hero.id)) return 'evolve'
  if (pendingPerkLevel(hero) !== null) return 'perk'
  return null
}

/** Whether the hero's badge shows (and its tap opens the level-up panel). */
export function levelUpOpen(entry: LevelUp | undefined, hero: Sentinel, evolutionQueue: readonly string[]): boolean {
  if (!entry) return false
  return !entry.seen || choiceOwed(hero, evolutionQueue) !== null
}

/**
 * Fold one settled wave into the roster's level-ups. Pure — the tracker below
 * and the tests both call it.
 *
 * `inPlace` waves (normal campaign clears) add or extend an entry for every
 * hero that levelled. Any other wave — elite, boss, endless, a loss — hands its
 * level-ups to the modal as before, so an entry for a hero that levelled there
 * is dropped: one hero's choice is never owned by both surfaces.
 */
export function settleLevelUps(
  heroes: Record<string, LevelUp>,
  waveStart: Record<string, Sentinel>,
  roster: readonly Sentinel[],
  inPlace: boolean,
): Record<string, LevelUp> {
  const next = { ...heroes }
  for (const h of roster) {
    const before = waveStart[h.id]
    if (!before || h.level <= before.level) continue
    if (!inPlace) {
      delete next[h.id]
      continue
    }
    const had = next[h.id]
    next[h.id] = had && !had.seen ? { ...had, seen: false } : { from: before.level, before, seen: false }
  }
  // A hero who left the company takes its badge with it.
  for (const id of Object.keys(next)) if (!roster.some((h) => h.id === id)) delete next[id]
  return next
}

/** The modal skips these heroes: their choice is waiting on the roster. */
export function deferredToRoster(id: string): boolean {
  return !!useLevelUps.getState().heroes[id]
}

/**
 * The player has dealt with a hero's level-up: seen it, and made any choice it
 * owed. An entry with a choice still owed stays (and stays badged).
 */
export function ackLevelUp(hero: Sentinel, evolutionQueue: readonly string[]): void {
  const heroes = { ...useLevelUps.getState().heroes }
  const entry = heroes[hero.id]
  if (!entry) return
  if (choiceOwed(hero, evolutionQueue) === null) delete heroes[hero.id]
  else heroes[hero.id] = { ...entry, seen: true }
  useLevelUps.setState({ heroes })
}

/**
 * Watches the run: snapshots the roster as a wave starts and folds each settled
 * wave's level-ups in. Mounted once, by `RootShell`.
 *
 * A store subscription, not a render effect: `finishBattle` writes the roster,
 * the evolution queue and the result in ONE `set`, and the entry has to exist
 * before `EvolutionModal` renders that queue — or the modal would flash open
 * for a choice that belongs on the roster. Zustand calls subscribers inside
 * `set`, before React renders anything.
 */
export function useLevelUpTracker(): void {
  useEffect(() => {
    let prev = useGameStore.getState()
    return useGameStore.subscribe((s) => {
      const lu = useLevelUps.getState()
      // A new run starts clean — hero ids are not promised unique across runs.
      if (lu.runSeed !== s.runSeed) {
        useLevelUps.setState({ runSeed: s.runSeed, waveStart: {}, heroes: {}, lastReward: null })
      }
      if (!prev.engine && s.engine && s.screen === 'battle') {
        useLevelUps.setState({ waveStart: Object.fromEntries(s.roster.map((h) => [h.id, h])) })
      }
      if (!prev.lastResult && s.lastResult && s.screen === 'battle') {
        const { heroes, waveStart } = useLevelUps.getState()
        useLevelUps.setState({ heroes: settleLevelUps(heroes, waveStart, s.roster, rewardInPlace(s)), waveStart: {} })
      }
      prev = s
    })
  }, [])
}
