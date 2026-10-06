import type { CSSProperties } from 'react'
import { WATCH_COMMANDS } from '../../game/data/commands'
import { useGameStore } from '../../state/gameStore'
import { useSettingsStore } from '../../state/settingsStore'
import { AUTO_CONTINUE_MS, useAutoContinue } from './autoContinue'

/**
 * The live wave's command place (Phase 2 layout contract, Phase 3a content).
 *
 * ONE 44px `<button className="sh-command">`, in the live wave strip:
 *
 *  - during a sub-wave it fires the company's Watch Command (the first one it
 *    carries — a relic that grants another puts the chosen one first). One
 *    charge per sub-wave; the engine decides whether it can fire
 *    (`canUseCommand`) and logs the tick, so the button can never offer what
 *    the sim will refuse;
 *  - during the breather between sub-waves (the sim is paused) it is the
 *    Continue: "Next ▶". The move itself happens on the field — tap a hero,
 *    then a post — and the strip's left slot says so ("Held · move one hero",
 *    G2-2; it used to be a banner painted over the field).
 *
 * Oct 2026 (2.3): a hold counts down on Next — a ring that empties over
 * `AUTO_CONTINUE_MS` — and continues itself unless the player touches the
 * field or a hero (`autoContinue.ts`). Reduced motion keeps the count but
 * shows it as the seconds left instead of a moving ring.
 *
 * Its accessible name says what it does and whether the charge is spent. The
 * moments themselves are spoken by the shell's one live region (`Announcer`,
 * fed by `state/combatNotes.ts`).
 */
export function CommandSlot({ staged = false, hold }: { staged?: boolean; hold?: string }) {
  const engine = useGameStore((s) => s.engine)
  const hud = useGameStore((s) => s.hud)
  const useCommand = useGameStore((s) => s.useCommand)
  const resume = useGameStore((s) => s.resumeSubWave)
  const live = !!engine && engine.status === 'running'
  // The hold in front of the player, by its sub-wave: a new hold, a new count.
  const holdKey = live && hud.breather ? String(hud.subWave) : null
  const auto = useAutoContinue(holdKey, !!hold, resume)
  const still = useSettingsStore((s) => s.reducedMotion)
  if (!engine || !live) return null

  if (hud.breather) {
    const frac = auto.leftMs / AUTO_CONTINUE_MS
    // Weapon clearance: a hero swinging beside another holds the next
    // sub-wave (`hold` is the strip's reason); the store refuses it too.
    return (
      <button
        // `next`: while a sub-wave is held this is the ONE thing to do, so it
        // wears the primary treatment (Whales UI plan A1) — a Watch Command
        // beside it is an option, and keeps the quieter gold outline.
        className={`sh-command next ${hold ? 'spent' : 'ready'}${auto.running ? ' counting' : ''}`}
        disabled={!!hold}
        onClick={resume}
        aria-describedby={hold ? 'sh-make-space' : undefined}
        aria-label={`Sub-wave ${hud.subWave} of ${hud.subWaveCount} held. ${hold ? 'Waiting — make space first.' : 'Send the next sub-wave.'}${auto.running ? ' It goes in by itself in a moment unless you move a hero.' : ''}`}
      >
        {auto.running &&
          (still ? (
            <span className="sh-next-count" aria-hidden="true">
              {Math.max(1, Math.ceil(auto.leftMs / 1000))}
            </span>
          ) : (
            <svg className="sh-next-ring" viewBox="0 0 20 20" aria-hidden="true" style={{ '--frac': frac } as CSSProperties}>
              <circle cx="10" cy="10" r="8" pathLength="100" />
            </svg>
          ))}
        Next ▶
      </button>
    )
  }

  // LS3: the Watch Command arrives after the first battle (`state/staging.ts`).
  // The breather's "Next" above is not staged — it is how a breather ends.
  if (staged) return null

  // The engine's own list — the one `useCommand` is checked against.
  const id = engine.commands[0]
  if (!id) return null
  const c = WATCH_COMMANDS[id]
  const ready = engine.canUseCommand(id)
  return (
    <button
      className={`sh-command ${ready ? 'ready' : 'spent'}`}
      disabled={!ready}
      onClick={() => useCommand(id)}
      title={c.blurb}
      aria-label={`${c.name}: ${c.blurb}. ${hud.commandReady ? 'Ready this sub-wave' : 'Used — back next sub-wave'}.`}
    >
      {c.name}
    </button>
  )
}
