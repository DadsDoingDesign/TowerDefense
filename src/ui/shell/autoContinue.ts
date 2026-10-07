import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../state/gameStore'
import { useSettingsStore } from '../../state/settingsStore'

/**
 * Held sub-waves continue themselves (Oct 2026 audit, 2.3).
 *
 * Between sub-waves the fight holds for the player's one move (`breathers:
 * 'pause'`). With one or two heroes that move is usually pointless, so every
 * hold cost a dead tap on "Next" — about thirty a run. Now a hold counts down
 * on Next (a ring, `AUTO_CONTINUE_MS`) and sends the next sub-wave itself when
 * it runs out, unless the player touches the field or a hero — then it is
 * theirs, and Next waits for them as it always did.
 *
 * It never touches the battle's determinism: the countdown ends by calling the
 * same `resumeSubWave` the button does, and a resume only releases the pause
 * (`engine.resume`); the sim's ticks do not run while it is held, so WHEN the
 * hold ends changes nothing the replay records.
 *
 * It never runs:
 *  - with the setting off (Settings → "Held waves continue");
 *  - before the sub-wave tip has been taught — the first hold of a first run
 *    is where the coach teaches the move, so it waits for the player;
 *  - while a clearance conflict holds Next (the store would refuse it);
 *  - while the tab is hidden (it pauses, and picks up where it was).
 */

/** How long a held sub-wave waits before it continues itself. */
export const AUTO_CONTINUE_MS = 4000

/** Everything the countdown's go/no-go reads — pure, so it is unit-tested. */
export interface AutoContinueFacts {
  /** The setting (default on). */
  enabled: boolean
  /** The sub-wave tip has been taught (or skipped). */
  taught: boolean
  /** The engine is held between sub-waves. */
  breather: boolean
  /** Next is waiting on a clearance conflict. */
  held: boolean
  /** The player touched the field or a hero during this hold. */
  touched: boolean
}

/** Whether the countdown may run right now (the tab being visible aside). */
export const autoContinueArmed = (f: AutoContinueFacts): boolean => f.enabled && f.taught && f.breather && !f.held && !f.touched

/**
 * The countdown for the hold in front of the player. `key` names the hold (the
 * sub-wave index): a new hold starts a fresh countdown and forgets the last
 * one's touch. Returns whether it is running and the time left (the ring, and
 * the whole seconds the reduced-motion readout shows).
 */
export function useAutoContinue(key: string | null, held: boolean, onFire: () => void): { running: boolean; leftMs: number } {
  const enabled = useSettingsStore((s) => s.autoContinue)
  const taught = useSettingsStore((s) => s.taught.subwave)
  const [touched, setTouched] = useState<string | null>(null)
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  const [leftMs, setLeftMs] = useState(AUTO_CONTINUE_MS)
  const remaining = useRef(AUTO_CONTINUE_MS)
  const fire = useRef(onFire)
  fire.current = onFire

  // Read as the hold BEGINS: the hold the sub-wave tip is teaching stays the
  // player's even after "Got it" (or the lesson performed) marks it taught.
  const taughtAt = useRef<{ key: string | null; taught: boolean }>({ key: null, taught })
  if (taughtAt.current.key !== key) taughtAt.current = { key, taught }
  const armed = autoContinueArmed({ enabled, taught: taughtAt.current.taught, breather: key != null, held, touched: touched === key && key != null })
  const running = armed && !hidden

  // A new hold: the full countdown again.
  useEffect(() => {
    remaining.current = AUTO_CONTINUE_MS
    setLeftMs(AUTO_CONTINUE_MS)
  }, [key])

  // The tab going away pauses the count; coming back resumes it.
  useEffect(() => {
    const onVis = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Any touch on the field, a hero picked up or selected: the hold is the
  // player's now. Read off the store so the keyboard path counts as a touch too.
  useEffect(() => {
    if (key == null) return
    const mine = () => setTouched(key)
    const onDown = (e: Event) => {
      const t = e.target as Element | null
      if (t?.closest?.('.sh-stage, .sh-hero, .sh-mate')) mine()
    }
    document.addEventListener('pointerdown', onDown, { capture: true })
    document.addEventListener('focusin', onDown)
    const off = useGameStore.subscribe((s, p) => {
      if ((s.breatherPick && !p.breatherPick) || (s.shellSelection && s.shellSelection !== p.shellSelection)) mine()
    })
    return () => {
      document.removeEventListener('pointerdown', onDown, { capture: true })
      document.removeEventListener('focusin', onDown)
      off()
    }
  }, [key])

  // The count itself. Wall time, paused by `running` going false; it ends by
  // pressing the same action Next does.
  useEffect(() => {
    if (!running) return
    const startedAt = Date.now()
    const startLeft = remaining.current
    const tick = setInterval(() => setLeftMs(Math.max(0, startLeft - (Date.now() - startedAt))), 100)
    const done = setTimeout(() => {
      remaining.current = 0
      fire.current()
    }, startLeft)
    return () => {
      clearInterval(tick)
      clearTimeout(done)
      remaining.current = Math.max(0, startLeft - (Date.now() - startedAt))
    }
  }, [running])

  return { running, leftMs }
}
