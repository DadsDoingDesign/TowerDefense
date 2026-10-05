import { useEffect } from 'react'
import { create } from 'zustand'
import { BUMP_LABEL, type BumpStat } from '../../game/data/skills'
import { milestoneGrant } from '../../game/engine/leveling'
import { pendingMilestone } from '../../game/run/skills'
import type { Archetype, Sentinel } from '../../game/types'
import { useGameStore } from '../../state/gameStore'
import type { GameState } from '../../state/game/types'

/**
 * G3-2 / SK1 — level-ups, handled where the wave was fought.
 *
 * A normal campaign wave ends with its reward hand filling the Selector row
 * under the dimmed field (`rewardInPlace`). Level-ups ride beside it:
 *
 *  - **A plain level** (nothing to choose) shows "+1 level" on the hero's card
 *    for a moment and is gone — no badge to clear (SK2). The stats it grew are
 *    on the hero's Stats tab like any other number.
 *  - **A skill milestone** (levels 5, 10, 15 — `run/skills.pendingMilestone`)
 *    is a real choice, so the hero's card wears a badge until it is made, on
 *    the battle screen, on the run map and into the next battle. A tap opens
 *    the choice in the Context panel (`LevelUpPanel`).
 *
 * **Between rounds only.** The designer: gear and heroes are locked while a
 * wave is live. A hero who crosses a milestone during a fight is owed its
 * choice when XP lands — when the wave settles — and if the badge is still up
 * when the next wave starts, the choice waits: the panel says so and its
 * commit is disabled until that wave (and its sub-waves) is over. The store's
 * `chooseSkill` refuses a live wave too.
 *
 * The owed choice is read off the hero, never stored here, so a resumed run
 * shows every badge it should. What lives here is view state, like
 * `mapFocus`: the flashes, the "Later" a player tapped, and the reward card to
 * hand back to — never snapshotted, never read by the engine.
 */
export interface LevelFlash {
  /** The level before the wave, and after. */
  from: number
  to: number
  /** When it was shown (ms, `Date.now()`), so it can fade on its own. */
  at: number
}

/** How long "+1 level" stays on a card. */
export const FLASH_MS = 3200

interface LevelUpState {
  runSeed: number | null
  /** The roster as each wave began, by hero id. */
  waveStart: Record<string, Sentinel>
  /** Heroes that levelled in the wave that just settled, for the passing "+N level". */
  flash: Record<string, LevelFlash>
  /**
   * Heroes whose owed choice the player put off ("Later"): tapping them opens
   * their ordinary panel until the next wave settles. The badge stays.
   */
  later: Record<string, true>
  /** The last reward card looked at, so a finished choice can hand back to it. */
  lastReward: string | null
}

export const useLevelUps = create<LevelUpState>(() => ({
  runSeed: null,
  waveStart: {},
  flash: {},
  later: {},
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

/** The hero owes a skill choice (SK1): its badge shows, and a tap opens it. */
export function choiceOwed(hero: Pick<Sentinel, 'level' | 'skillPicks'>): 'skill' | null {
  return pendingMilestone(hero) ? 'skill' : null
}

/** A wave is being fought right now — the choice waits until it is over. */
export const waveLive = (s: Pick<GameState, 'engine' | 'battlePhase'>): boolean => !!s.engine && s.battlePhase === 'battle'

/** Whether the hero's badge shows. */
export function levelUpOpen(hero: Pick<Sentinel, 'level' | 'skillPicks'>): boolean {
  return choiceOwed(hero) !== null
}

/**
 * Fold one settled wave into the passing "+N level" flashes. Pure — the
 * tracker below and the tests both call it. Every hero that gained a level
 * flashes; a hero that ALSO owes a choice wears its badge besides (derived).
 */
export function settleFlashes(
  waveStart: Record<string, Sentinel>,
  roster: readonly Sentinel[],
  now: number,
): Record<string, LevelFlash> {
  const out: Record<string, LevelFlash> = {}
  for (const h of roster) {
    const before = waveStart[h.id]
    if (before && h.level > before.level) out[h.id] = { from: before.level, to: h.level, at: now }
  }
  return out
}

/**
 * The stats a level-up paid beyond the level itself — the level-10 and
 * level-15 grant (`engine/leveling.MILESTONE_GRANT`) — in the bump's own words,
 * the class's main stat first: "+10 STR +3 DEX". Null when the levels between
 * `from` (exclusive) and `to` crossed no grant. Thorns ride along unsaid, like
 * every secondary number (they are on the Stats tab).
 */
export function grantWords(archetype: Archetype, from: number, to: number): string | null {
  const sum = new Map<BumpStat, number>()
  for (let l = from + 1; l <= to; l++) {
    const g = milestoneGrant(archetype, l)
    if (!g) continue
    for (const [k, v] of Object.entries(g.stats) as [BumpStat, number][]) if (v) sum.set(k, (sum.get(k) ?? 0) + v)
  }
  return sum.size ? [...sum].map(([k, v]) => `+${v} ${BUMP_LABEL[k]}`).join(' ') : null
}

/** A flash still on screen at `now`. */
export const flashLive = (f: LevelFlash | undefined, now: number): boolean => !!f && now - f.at < FLASH_MS

/** The player put the choice off: the hero's own panel opens on a tap, until the next wave settles. */
export function putOff(heroId: string): void {
  useLevelUps.setState({ later: { ...useLevelUps.getState().later, [heroId]: true } })
}

/** Open the choice again (the Skills tab's "Choose now"). */
export function takeUp(heroId: string): void {
  const later = { ...useLevelUps.getState().later }
  delete later[heroId]
  useLevelUps.setState({ later })
}

/**
 * Watches the run: snapshots the roster as a wave starts and turns each
 * settled wave's level-ups into flashes. Mounted once, by `RootShell`.
 */
export function useLevelUpTracker(): void {
  useEffect(() => {
    let prev = useGameStore.getState()
    return useGameStore.subscribe((s) => {
      const lu = useLevelUps.getState()
      // A new run starts clean — hero ids are not promised unique across runs.
      if (lu.runSeed !== s.runSeed) {
        useLevelUps.setState({ runSeed: s.runSeed, waveStart: {}, flash: {}, later: {}, lastReward: null })
      }
      if (!prev.engine && s.engine && s.screen === 'battle') {
        useLevelUps.setState({ waveStart: Object.fromEntries(s.roster.map((h) => [h.id, h])) })
      }
      if (!prev.lastResult && s.lastResult && s.screen === 'battle') {
        const { waveStart } = useLevelUps.getState()
        // A new settle re-opens any choice the player put off.
        useLevelUps.setState({ flash: settleFlashes(waveStart, s.roster, Date.now()), waveStart: {}, later: {} })
      }
      prev = s
    })
  }, [])
}
