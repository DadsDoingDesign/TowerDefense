import { create } from 'zustand'
import { WATCH_COMMANDS, isCommandId } from '../game/data/commands'

/**
 * The Phase-3a combat moments a player must be TOLD about, not just shown:
 * a boss changing phase, a sub-wave held for the breather, a Watch Command
 * sounding. The shell's single polite live region (`Announcer`) listens to
 * `seq` and speaks `text`; nothing else reads this.
 *
 * Fed from the engine's `onEvent` (see `battleSlice.startWave`), which is a
 * listener the sim never reads back — so this can never influence a battle.
 * Presentation only: not snapshotted, reset with nothing, harmless when stale.
 */
interface CombatNotes {
  seq: number
  text: string
  /** When it was said (`Date.now()`): a voice mounted a moment later may still owe it. */
  at: number
  /**
   * Also shown, briefly, as the receipt toast (`ReceiptToast`) — visual only,
   * since this region already speaks it. Set for a one-tap commit whose
   * landing nothing else shows (a boon, a relic, a night at the campfire).
   */
  toast?: string
}

export const useCombatNotes = create<CombatNotes>(() => ({ seq: 0, text: '', at: 0 }))

const say = (text: string) => useCombatNotes.setState((s) => ({ seq: s.seq + 1, text, at: Date.now(), toast: undefined }))

/**
 * How long a note stays owed to a voice that mounts after it was said. A
 * one-tap commit on a page (the campfire) swaps the page shell for the
 * bands, which unmounts the Announcer that heard it before it could speak.
 */
export const NOTE_FRESH_MS = 1500

/**
 * A one-tap commit, said (October 2026). Outside combat, but through the
 * same single polite voice — the Announcer is mounted on every screen.
 */
export function announceCommit(text: string, toast?: string): void {
  useCombatNotes.setState((s) => ({ seq: s.seq + 1, text, at: Date.now(), toast }))
}

/**
 * A coach hint, said (October 2026). The hint pill over the Stage is not a
 * live region — it floats in and fades out on its own — so its words reach a
 * screen reader through this one polite voice instead.
 */
export function announceHint(text: string): void {
  say(text)
}

/** Map one engine event to a sentence, or to nothing (most events are silent here). */
export function noteEngineEvent(e: string, p?: { name?: string; phase?: number }): void {
  if (e === 'bossPhase') {
    say(`${p?.name ?? 'The champion'} changes — ${phaseWord(p?.name, p?.phase)}.`)
  } else if (e === 'subwave') {
    say('Sub-wave held. Move one hero if you want, then send the next.')
  } else if (e === 'subwaveStart') {
    say('Next sub-wave.')
  } else if (e.startsWith('command:')) {
    const id = e.slice('command:'.length)
    if (isCommandId(id)) say(`${WATCH_COMMANDS[id].name}!`)
  }
}

function phaseWord(name: string | undefined, phase: number | undefined): string {
  const n = name ?? ''
  if (n.includes('Grukk')) return 'war-cry, the column speeds up'
  if (n.includes('Powderkeg')) return 'enraged, throwing faster'
  if (n.includes('Colossus')) return 'split in two'
  return phase ? `phase ${phase + 1}` : 'a new phase'
}
