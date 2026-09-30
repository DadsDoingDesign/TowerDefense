import { useEffect, useRef, useState, type ComponentType } from 'react'
import { onSpritesReady } from '../../game/render/sprites'
import { dailySeed, utcDateKey } from '../../state/daily'
import { useSettingsStore } from '../../state/settingsStore'
import { useMedia } from '../pointer'

/**
 * May the menu move? False under the OS setting or the in-game toggle.
 * `MenuScreen` picks its layout on it (Whales UI plan H1-2): the battle behind
 * the whole menu when motion is allowed, the framed still key art when not.
 */
export function useMenuMotion(): boolean {
  const reducedSetting = useSettingsStore((s) => s.reducedMotion)
  const osReduced = useMedia('(prefers-reduced-motion: reduce)')
  return !(reducedSetting || osReduced)
}

/**
 * The menu's live backdrop: gatekeeper for the attract-mode battle.
 *
 * Rendered as `<MenuBackdrop><AttractMode /></MenuBackdrop>`, behind the whole
 * Watchtower menu (H1-2). It decides WHETHER and WHEN the demo runs; the demo
 * itself is `src/ui/attract/` (sim + renderer).
 *
 *  - **Never under reduced motion** — the OS setting or the in-game toggle.
 *    The menu shows the still key-art frame instead; this renders nothing at
 *    all and nothing is even fetched.
 *  - **Never before idle.** The chunk is imported from `requestIdleCallback`
 *    (a timer where that is missing) and only once the boot sprites have
 *    decoded, so the menu's first paint and first tap never wait on it, and it
 *    never draws a frame of procedural placeholder circles. Until then the
 *    backdrop is the page ground under its vignette, and the battle fades up
 *    out of it — the opening of the title sequence.
 *  - **Parked when unseen** — a hidden tab, a frame laid out of view, or a
 *    phone on its side (under the rotate prompt) stops the loop outright (no
 *    rAF), holding the last frame.
 *
 * It owns no run state and writes nothing: the sim is sealed off from the
 * store and from the global id/name counters (see `attractSim.ts`). The one
 * thing it reads is the day's seed — `dailySeed(utcDateKey())`, a pure hash of
 * the date — which it hands to the sim, so the sim still imports no `state/`.
 */
export function AttractMode() {
  const reduced = !useMenuMotion()

  const [Battle, setBattle] = useState<ComponentType<{ running: boolean; seed: number }> | null>(null)
  // Q12: the scene is drawn from today's Daily Watch seed (the UTC day), read
  // once per mount — everyone sees the same cinematic today, a new one
  // tomorrow, and a menu left open past midnight keeps the scene it opened on.
  const [seed] = useState(() => dailySeed(utcDateKey()))
  const [inView, setInView] = useState(true)
  // A phone on its side is covered by the rotate prompt (the shell is only
  // visibility-hidden, so the observer still sees the frame): park there too.
  // Same query as BattleCanvas / overlays.css / shell.css.
  const rotated = useMedia('(orientation: landscape) and (max-height: 500px) and (max-width: 950px) and (pointer: coarse)')
  const [pageShown, setPageShown] = useState(() => typeof document === 'undefined' || !document.hidden)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduced || Battle) return
    let cancelled = false
    const load = () =>
      onSpritesReady(() => {
        if (cancelled) return
        import('../attract/AttractBattle')
          .then((m) => {
            if (!cancelled) setBattle(() => m.default)
          })
          .catch(() => {
            /* offline without the chunk: the still stays, which is fine */
          })
      })
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(load, { timeout: 4000 })
      return () => {
        cancelled = true
        w.cancelIdleCallback?.(id)
      }
    }
    const id = window.setTimeout(load, 1500)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [reduced, Battle])

  useEffect(() => {
    const onVis = () => setPageShown(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) setInView(e.isIntersecting)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [reduced])

  if (reduced) return null
  return (
    <div className="pg-art-livewrap" ref={wrapRef}>
      {Battle && <Battle running={inView && pageShown && !rotated} seed={seed} />}
    </div>
  )
}
