/**
 * Service-worker registration (M24).
 *
 * The worker itself is generated at build time from the finished `dist/` (see
 * the `pwa()` plugin in vite.config.ts). Registration is production-only: in
 * dev a cache-first worker would serve stale modules over Vite's HMR.
 */
export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

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
    navigator.serviceWorker.register(url).catch((err) => {
      // A refused registration (file:// , no HTTPS, storage blocked) costs the
      // offline mode and nothing else — the game still runs.
      console.warn('Service worker registration failed:', err)
    })
  })
}
