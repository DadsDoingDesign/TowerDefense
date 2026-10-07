import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type MouseEvent, type PointerEvent } from 'react'
import { announceCommit } from '../../state/combatNotes'
import { useSettingsStore } from '../../state/settingsStore'
import { Tap, usePointerFine } from '../pointer'
import { classifyPress, HOLD_MS, SLOP_PX, travelOf, type Press } from './press'
import { lineText, type Offer } from './offers'

/**
 * One-tap commits (October 2026; the designer's call on audit §4 item 8).
 *
 * Shell rule one is select-then-confirm: tap a card, read its detail in the
 * Context panel, then commit. For the campfire's rest and train — cheap and
 * frequent — that doubled the taps, so they commit on the tap itself. (Reward
 * cards did too, until the designer moved their commit back to the CTA: the
 * tap a player made to compare an item's stats took it.)
 *
 *  - **tap / click / Enter / Space** on an option commits it;
 *  - **hold** (touch, `HOLD_MS`) shows its detail, and letting go does not
 *    commit; **hover** (a fine pointer) and **keyboard focus** show it too.
 *    Rule one's "see the detail first" is still there, just no longer forced.
 *
 * The press rules (tap vs hold vs drag vs too soon) are `press.ts`, pure and
 * unit-tested. This file only gathers the numbers from real events.
 *
 * Everything else — the rewards, the merchant, the shrine, a recruit, the
 * hero pick, skill picks, the city's cash-out — stays select-then-confirm. An offer opts in with `Offer.oneTap`.
 */

export type InspectHow = 'hold' | 'hover' | 'focus' | 'refused'

interface Live {
  id: string
  pointerId: number
  touch: boolean
  x: number
  y: number
  downAt: number
  travel: number
  cancelled: boolean
  upAt: number | null
  held: boolean
}

const now = () => performance.now()

/**
 * How long a mouse must rest on an option before its detail replaces the one
 * on show. Without it, moving from the third card to the Context panel under
 * the first swept the panel to whichever card the pointer crossed last.
 */
export const HOVER_DWELL_MS = 120

export interface OneTapProps {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void
  onPointerMove: (e: PointerEvent<HTMLElement>) => void
  onPointerUp: (e: PointerEvent<HTMLElement>) => void
  onPointerCancel: (e: PointerEvent<HTMLElement>) => void
  onPointerEnter: (e: PointerEvent<HTMLElement>) => void
  onPointerLeave: (e: PointerEvent<HTMLElement>) => void
  onFocus: (e: FocusEvent<HTMLElement>) => void
  onContextMenu: (e: MouseEvent<HTMLElement>) => void
  onClick: (e: MouseEvent<HTMLElement>) => void
}

/**
 * Wire one-tap options. `surface` names the set of options on screen; when it
 * changes the arrival clock restarts (a press in the first `ARRIVAL_MS` is
 * ignored) and the surface may commit once more. `pressing` is the option a
 * finger is on right now (before the hold lands), for the press feedback.
 */
export function useOneTap(o: {
  surface: string
  commit: (id: string) => void
  inspect: (id: string, how: InspectHow) => void
  /** An option that cannot be taken: a tap on it shows its detail instead. */
  disabled?: (id: string) => boolean
}): { bind: (id: string) => OneTapProps; pressing: string | null } {
  const cb = useRef(o)
  cb.current = o
  const shownAt = useRef(now())
  const done = useRef(false)
  const live = useRef<Live | null>(null)
  const timer = useRef<number | null>(null)
  const hover = useRef<number | null>(null)
  const [pressing, setPressing] = useState<string | null>(null)

  useLayoutEffect(() => {
    shownAt.current = now()
    done.current = false
    live.current = null
  }, [o.surface])

  const stopTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }
  const stopHover = () => {
    if (hover.current !== null) window.clearTimeout(hover.current)
    hover.current = null
  }
  useEffect(
    () => () => {
      stopTimer()
      stopHover()
    },
    [],
  )

  const bind = useCallback((id: string): OneTapProps => {
    const mine = (e: PointerEvent<HTMLElement>) => live.current?.id === id && live.current.pointerId === e.pointerId
    return {
      onPointerDown: (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        stopTimer()
        const touch = e.pointerType !== 'mouse'
        live.current = { id, pointerId: e.pointerId, touch, x: e.clientX, y: e.clientY, downAt: now(), travel: 0, cancelled: false, upAt: null, held: false }
        if (!touch) return
        setPressing(id)
        // The hold: shown while the finger is still down, so the detail is
        // already there when it lifts.
        timer.current = window.setTimeout(() => {
          timer.current = null
          const l = live.current
          if (!l || l.id !== id || l.cancelled || l.upAt !== null || l.travel > SLOP_PX) return
          l.held = true
          setPressing(null)
          cb.current.inspect(id, 'hold')
        }, HOLD_MS)
      },
      onPointerMove: (e) => {
        const l = live.current
        if (!l || !mine(e)) return
        l.travel = Math.max(l.travel, travelOf(l, { x: e.clientX, y: e.clientY }))
        if (l.travel > SLOP_PX) {
          stopTimer()
          setPressing(null)
        }
      },
      onPointerUp: (e) => {
        if (!mine(e)) return
        live.current!.upAt = now()
        stopTimer()
        setPressing(null)
      },
      onPointerCancel: (e) => {
        // The browser took the gesture (a scroll): never a commit.
        if (!mine(e)) return
        live.current!.cancelled = true
        live.current!.upAt = now()
        stopTimer()
        setPressing(null)
      },
      onPointerEnter: (e) => {
        if (e.pointerType !== 'mouse') return
        stopHover()
        hover.current = window.setTimeout(() => {
          hover.current = null
          cb.current.inspect(id, 'hover')
        }, HOVER_DWELL_MS)
      },
      onPointerLeave: (e) => {
        if (e.pointerType === 'mouse') stopHover()
      },
      onFocus: (e) => {
        // Keyboard focus only: a tap focuses the button too, and that must
        // not swap the detail under a finger that is about to commit.
        if (e.currentTarget.matches(':focus-visible')) cb.current.inspect(id, 'focus')
      },
      onContextMenu: (e) => {
        // A long press is a look, not a request for the browser's menu.
        if (live.current?.touch) e.preventDefault()
      },
      onClick: () => {
        const t = now()
        const l = live.current
        live.current = null
        // A click that followed a press we watched is judged by that press;
        // anything else (Enter, Space, an assistive click) started when it
        // landed, so only the arrival guard applies.
        const p: Press =
          l && l.id === id && l.upAt !== null && t - l.upAt < 1000
            ? // A mouse looks by hovering, so a slow click is still a click.
              { shownAt: shownAt.current, downAt: l.downAt, upAt: l.touch ? l.upAt : l.downAt, travel: l.travel, cancelled: l.cancelled }
            : { shownAt: shownAt.current, downAt: t, upAt: t, travel: 0 }
        if (classifyPress(p) !== 'tap' || done.current) return
        if (cb.current.disabled?.(id)) return cb.current.inspect(id, 'refused')
        done.current = true
        cb.current.commit(id)
      },
    }
  }, [])

  return { bind, pressing }
}

/**
 * Run a one-tap offer: the deed, the lesson learnt (the hint is spent by
 * doing it), and the sentence the offer carries.
 */
export function commitOneTap(offer: Offer): void {
  if (!offer.action || offer.action.disabled) return
  offer.action.run()
  useSettingsStore.getState().markTaught('oneTap')
  if (offer.oneTap?.said) announceCommit(offer.oneTap.said, offer.oneTap.said)
}

/**
 * A one-tap option's detail as one sentence — its `aria-description`, so a
 * screen reader gets what a hold shows the eye on reaching the option
 * (focus), without the option having to be activated or the Context panel
 * found.
 */
export const describeOneTap = (o: Offer): string =>
  [o.warn, ...o.body.map(lineText)]
    .filter((l): l is string => !!l)
    // Stat lines carry no stop ("+17% Range"); give each one, so they are read as a list.
    .map((l) => (/[.!?]$/.test(l) ? l : `${l}.`))
    .join(' ')

/** True until the first one-tap commit: the hint shows while this holds. */
export const useOneTapUntaught = (): boolean => useSettingsStore((s) => !s.taught.oneTap)

/**
 * "Tap to take · hold to look" — the one-time hint. The verbs follow the
 * pointer: a mouse clicks and hovers.
 */
export function OneTapHint({ verb, className }: { verb: string; className?: string }) {
  const fine = usePointerFine()
  return (
    <p className={`onetap-hint${className ? ` ${className}` : ''}`}>
      <b>
        <Tap /> to {verb}
      </b>
      <span aria-hidden="true"> · </span>
      <span>{fine ? 'hover' : 'hold'} to look</span>
    </p>
  )
}
