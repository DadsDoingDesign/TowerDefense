import { useEffect } from 'react'
import { useGameStore } from '../../state/gameStore'
import { useMetaStore } from '../../state/metaStore'
import { useSettingsStore } from '../../state/settingsStore'
import { ideaShown, menuStaged, metaIdeas, presentIdeas, revealOf, type IdeaId, type Reveal, type RevealFacts } from '../../state/staging'
import type { GameState } from '../../state/game/types'

/**
 * LS3 — the shell's side of first-run staging: three hooks every surface asks,
 * and the recorder that latches what the player has met. The rules themselves
 * are pure and live in `state/staging.ts`.
 */

/** True while the run in front of the player is staged (a first run). */
export function useStaged(): boolean {
  const firstRun = useGameStore((s) => s.firstRun)
  const showEverything = useSettingsStore((s) => s.showEverything)
  return firstRun && !showEverything
}

/** Whether `id` may be on screen yet. Always true outside a staged run. */
export function useShown(id: IdeaId): boolean {
  const staged = useStaged()
  const met = useMetaStore((s) => s.met)
  const present = useGameStore((s) => staged && presentIdeas(s as GameState).has(id))
  return ideaShown(id, staged, met, present ? new Set([id]) : new Set())
}

/** True while the Watchtower menu is staged: difficulty, Daily and Endless locked. */
export function useMenuStaged(): boolean {
  const runs = useMetaStore((s) => s.stats.runsCompleted)
  const showEverything = useSettingsStore((s) => s.showEverything)
  return menuStaged({ runsCompleted: runs }, showEverything)
}

/** What the meta save has to say to the staggered reveal. */
export function revealFacts(meta: ReturnType<typeof useMetaStore.getState>): RevealFacts {
  return {
    runsCompleted: meta.stats.runsCompleted,
    runsWon: meta.stats.runsWon,
    bank: meta.bank,
    standing: meta.standing,
    met: meta.met,
    hqOwned: Object.values(meta.upgrades ?? {}).some((n) => n > 0),
  }
}

/** The staggered reveal (`state/staging.revealOf`): what the menu, HQ and contract pages may show yet. */
export function useReveal(): Reveal {
  const runsCompleted = useMetaStore((s) => s.stats.runsCompleted)
  const runsWon = useMetaStore((s) => s.stats.runsWon)
  const bank = useMetaStore((s) => s.bank)
  const met = useMetaStore((s) => s.met)
  const hqOwned = useMetaStore((s) => Object.values(s.upgrades ?? {}).some((n) => n > 0))
  const showEverything = useSettingsStore((s) => s.showEverything)
  return revealOf({ runsCompleted, runsWon, bank, met, hqOwned }, showEverything)
}

/**
 * The latch: every idea the run (or the meta save) has brought to the table is
 * written to `met`, once. Mounted once, at the shell's root, so it runs on
 * every screen — the recording must not depend on which band is showing.
 */
export function useStagingRecorder(): void {
  useEffect(() => {
    const record = () => {
      const g = useGameStore.getState()
      const meta = useMetaStore.getState()
      const seen = [...metaIdeas(revealFacts(meta)), ...(g.runPhase === 'active' && g.screen !== 'hub' ? presentIdeas(g) : [])]
      if (seen.some((id) => !meta.met.includes(id))) meta.recordMet(seen)
    }
    record()
    // The live wave writes the store every frame; only the fields staging reads
    // can change what has been met, so skip the rest.
    const offGame = useGameStore.subscribe((s, p) => {
      if (
        s.screen !== p.screen ||
        s.runPhase !== p.runPhase ||
        s.clearedNodeIds !== p.clearedNodeIds ||
        s.reachableNodeIds !== p.reachableNodeIds ||
        s.activeNodeId !== p.activeNodeId ||
        s.event !== p.event ||
        s.threat !== p.threat ||
        s.battlePhase !== p.battlePhase ||
        s.hud.breather !== p.hud.breather ||
        s.hud.subWave !== p.hud.subWave ||
        s.roster !== p.roster ||
        s.reward !== p.reward ||
        s.relics !== p.relics ||
        s.battleMap !== p.battleMap
      )
        record()
    })
    const offMeta = useMetaStore.subscribe((s, prev) => {
      // The bank and standing open the HQ and the stakes (the staggered reveal).
      if (s.stats !== prev.stats || s.bank !== prev.bank || s.standing !== prev.standing || s.upgrades !== prev.upgrades) record()
    })
    return () => {
      offGame()
      offMeta()
    }
  }, [])
}
