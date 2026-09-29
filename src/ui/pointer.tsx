import { useEffect, useState } from 'react'

/**
 * Pointer-aware copy (Phase 4, desktop layout).
 *
 * Every instruction in the game said "Tap", which is wrong under a mouse. The
 * verb follows the PRIMARY input's capabilities — a hover-capable, fine
 * pointer says "Click" — never the user agent: a touch laptop with a mouse
 * attached is a mouse user, an iPad with a trackpad reports `hover: hover` and
 * `pointer: fine` and is one too, and a phone never is.
 *
 * Use `<Tap />` inside JSX (it re-renders when the input changes, e.g. a
 * trackpad attached to a tablet) and `tapWord()` where a plain string is
 * needed (an `aria-label`).
 */
export const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'

/** Subscribe to a media query. SSR / no-`matchMedia` safe (false). */
export function useMedia(query: string): boolean {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches
  const [on, setOn] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const cb = () => setOn(mq.matches)
    cb()
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
  }, [query])
  return on
}

/** True when the primary pointer is a mouse / trackpad (hover + fine). */
export const usePointerFine = (): boolean => useMedia(FINE_POINTER_QUERY)

/** The verb for "activate this", as a string, read now. */
export function tapWord(capital = true): string {
  const fine = typeof window !== 'undefined' && !!window.matchMedia?.(FINE_POINTER_QUERY).matches
  const w = fine ? 'click' : 'tap'
  return capital ? w[0].toUpperCase() + w.slice(1) : w
}

/** "Tap" / "Click" (or lower-case with `lower`), live. */
export function Tap({ lower = false }: { lower?: boolean }) {
  const fine = usePointerFine()
  const w = fine ? 'click' : 'tap'
  return <>{lower ? w : w[0].toUpperCase() + w.slice(1)}</>
}
