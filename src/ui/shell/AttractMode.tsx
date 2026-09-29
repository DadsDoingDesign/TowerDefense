import { useEffect, useRef, useState, type ComponentType } from 'react'
import { onSpritesReady } from '../../game/render/sprites'
import { useSettingsStore } from '../../state/settingsStore'

/**
 * The menu's live key art: gatekeeper for the attract-mode battle (Phase 4).
 *
 * Rendered as `<MenuKeyArt><AttractMode /></MenuKeyArt>`. It decides WHETHER and
 * WHEN the demo runs; the demo itself is `src/ui/attract/` (sim + renderer).
 *
 *  - **Never under reduced motion** — the OS setting or the in-game toggle. The
 *    still diorama underneath is the complete picture on its own, so this
 *    renders nothing at all and nothing is even fetched.
 *  - **Never before idle.** The chunk is imported from `requestIdleCallback`
 *    (a timer where that is missing) and only once the boot sprites have
 *    decoded, so the menu's first paint and first tap never wait on it, and it
 *    never draws a frame of procedural placeholder circles.
 *  - **Parked when unseen** — a hidden tab or a frame scrolled/laid out of view
 *    stops the loop outright (no rAF), holding the last frame.
 *
 * It owns no run state and writes nothing: the sim is sealed off from the
 * store and from the global id/name counters (see `attractSim.ts`).
 */
export function AttractMode() {
  const reducedSetting = useSettingsStore((s) => s.reducedMotion)
  const osReduced = useMedia('(prefers-reduced-motion: reduce)')
  const reduced = reducedSetting || osReduced

  const [Battle, setBattle] = useState<ComponentType<{ running: boolean }> | null>(null)
  const [inView, setInView] = useState(true)
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
      {Battle && <Battle running={inView && pageShown} />}
    </div>
  )
}

function useMedia(query: string): boolean {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches
  const [on, setOn] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const cb = () => setOn(mq.matches)
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
  }, [query])
  return on
}
