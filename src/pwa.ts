/**
 * Service-worker registration (M24) and the "update ready" signal.
 *
 * The worker itself is generated at build time from the finished `dist/` (see
 * `build/pwa.ts` and the template `src/sw/sw.template.js`). Registration is
 * production-only: in dev a cache-first worker would serve stale modules over
 * Vite's HMR.
 *
 * ## Updates wait for a safe moment
 *
 * A new build's worker installs in the background and then WAITS — it never
 * takes over a page that is running the old build (that used to sweep the old
 * cache out from under a live run). It becomes active on its own the next time
 * the game is launched with no tab open, or immediately when the app calls
 * {@link applyUpdate}, which it should only do where a reload costs nothing
 * (the menu, never mid-wave). {@link isUpdateReady} / {@link onUpdateReady}
 * are the signal the UI reads to offer that.
 *
 * ## Looking for one
 *
 * The browser checks `sw.js` on a navigation, and an installed game is rarely
 * navigated: a standalone window is opened once and then switched to and from
 * for days. So the page also asks (`reg.update()`) whenever it comes back into
 * view, at most once per {@link UPDATE_CHECK_MS}. Asking only finds and
 * installs the new build — it still WAITS, exactly as above.
 */

import { onAppVisible } from './state/lifecycle'
import { isNativeApp } from './native'

/** The least time between two update checks the page asks for. */
export const UPDATE_CHECK_MS = 30 * 60 * 1000

let waiting: ServiceWorker | null = null
const listeners = new Set<() => void>()

function setWaiting(w: ServiceWorker | null): void {
  if (w === waiting) return
  waiting = w
  for (const cb of listeners) cb()
}

/** True once a new build is installed and waiting to take over. */
export const isUpdateReady = (): boolean => waiting !== null

/**
 * Subscribe to changes of {@link isUpdateReady}. Returns the unsubscribe
 * function — the exact shape `useSyncExternalStore` takes.
 */
export function onUpdateReady(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/**
 * Hand over to the waiting build now and reload onto it. No-op when nothing
 * is waiting. Call it only from a point where a reload loses nothing.
 */
export function applyUpdate(): void {
  const w = waiting
  if (!w || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
  w.postMessage('skip-waiting')
}

/**
 * Track a registration's waiting worker. Only a worker that is waiting BEHIND
 * an active one is an update: the very first install has no controller to
 * replace and activates on its own.
 */
function watch(reg: ServiceWorkerRegistration): void {
  const check = () => {
    if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting)
  }
  check()
  reg.addEventListener('updatefound', () => {
    const w = reg.installing
    if (!w) return
    w.addEventListener('statechange', () => {
      if (w.state === 'installed') check()
      // Another tab applied it, or the install was superseded.
      if (w.state === 'activated' || w.state === 'redundant') {
        if (waiting === w) setWaiting(null)
      }
    })
  })
}

/**
 * A throttled update check: returns the function to call whenever the page
 * becomes visible. Pure over its inputs so the throttle is unit-testable.
 * Never throws; a failed check (offline, a 404 on sw.js) is retried at the next
 * visible after the interval, like any other.
 */
export function updateChecker(
  reg: Pick<ServiceWorkerRegistration, 'update'>,
  now: () => number = Date.now,
  every = UPDATE_CHECK_MS,
): () => void {
  // Registering has just checked, so the first ask is one interval out.
  let last = now()
  return () => {
    const t = now()
    if (t - last < every) return
    last = t
    try {
      void Promise.resolve(reg.update()).catch(() => {})
    } catch {
      /* an invalid-state registration: nothing to update */
    }
  }
}

export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  // The iOS app ships its files inside the bundle and updates through the App
  // Store; a caching worker would only serve a stale build after an update.
  if (isNativeApp()) return

  if (!import.meta.env.PROD) {
    // Returning early is not enough. `vite preview` serves the built app — sw
    // and all — and it defaults to the same host and port range as `vite dev`,
    // so previewing once installs a cache-first worker that then owns the dev
    // origin. Dev afterwards is served stale modules by a worker no dev-mode
    // code ever registered and no dev-mode code was removing, and no amount of
    // reloading fixes it: it takes a manual trip through devtools. So dev
    // actively clears what it finds instead of merely declining to add more.
    void navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .then((cleared) => {
        if (cleared.length) console.info(`Unregistered ${cleared.length} service worker(s) left over from a preview build.`)
      })
      .catch(() => {
        /* nothing registered, or the browser refused — dev is unaffected */
      })
    return
  }

  // `base: './'` means the app can be served from a subdirectory, so the worker
  // URL is resolved against the document rather than the origin root.
  const url = new URL('sw.js', document.baseURI).href
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(url)
      .then((reg) => {
        watch(reg)
        onAppVisible(updateChecker(reg))
      })
      .catch((err) => {
        // A refused registration (file:// , no HTTPS, storage blocked) costs the
        // offline mode and nothing else — the game still runs.
        console.warn('Service worker registration failed:', err)
      })
  })
}
