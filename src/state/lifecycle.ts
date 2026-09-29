/**
 * One place that knows when the app goes away and comes back.
 *
 * Two features need exactly this signal and it would be wasteful (and racy) to
 * bind it twice: the run snapshot must be flushed before a mobile OS evicts the
 * tab (C3), and the iOS AudioContext must be re-resumed after the page returns
 * from a phone call or a screen lock (M31).
 *
 * `pagehide` is the one iOS Safari actually fires on navigation away —
 * `beforeunload`/`unload` are unreliable there — and `visibilitychange` is what
 * fires when the user swipes to another app, which is the common case.
 */
type Handler = () => void

const hidden = new Set<Handler>()
const visible = new Set<Handler>()
let installed = false

function fire(set: Set<Handler>): void {
  for (const h of set) {
    try {
      h()
    } catch {
      /* one bad handler must not stop the others — this runs on the way out */
    }
  }
}

function install(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') fire(hidden)
    else fire(visible)
  })
  // Fires on iOS when the tab is discarded or navigated away from, where
  // visibilitychange alone can be too late.
  window.addEventListener('pagehide', () => fire(hidden))
  window.addEventListener('freeze', () => fire(hidden))
  window.addEventListener('resume', () => fire(visible))
}

/** Run `cb` when the page is being hidden or discarded. Returns an unsubscribe. */
export function onAppHidden(cb: Handler): () => void {
  install()
  hidden.add(cb)
  return () => hidden.delete(cb)
}

/** Run `cb` when the page becomes visible again. Returns an unsubscribe. */
export function onAppVisible(cb: Handler): () => void {
  install()
  visible.add(cb)
  return () => visible.delete(cb)
}
