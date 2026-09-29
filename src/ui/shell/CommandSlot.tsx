import { WATCH_COMMANDS } from '../../game/data/commands'
import { useGameStore } from '../../state/gameStore'

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
 *    then a post — and the canvas draws the prompt (`render/telegraphs.ts`).
 *
 * Its accessible name says what it does and whether the charge is spent. The
 * moments themselves are spoken by the shell's one live region (`Announcer`,
 * fed by `state/combatNotes.ts`).
 */
export function CommandSlot() {
  const engine = useGameStore((s) => s.engine)
  const hud = useGameStore((s) => s.hud)
  const useCommand = useGameStore((s) => s.useCommand)
  const resume = useGameStore((s) => s.resumeSubWave)
  if (!engine || engine.status !== 'running') return null

  if (hud.breather) {
    return (
      <button
        className="sh-command ready"
        onClick={resume}
        aria-label={`Sub-wave ${hud.subWave} of ${hud.subWaveCount} held. Send the next sub-wave.`}
      >
        Next ▶
      </button>
    )
  }

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
