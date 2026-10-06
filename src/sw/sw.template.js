/* Fieldwatch service worker (M24) — TEMPLATE.
 *
 * `build/pwa.ts` fills the __FW_*__ tokens after every build and writes the
 * result to `dist/sw.js`. Edit the behaviour here; edit the precache RULES in
 * build/pwa.ts. This file is plain browser JS that nothing imports, so neither
 * tsc nor Vite touches it. */
/* --------------------------------------------------------- the cache namespace
 * Cache storage is per-ORIGIN. A deploy is per-SCOPE. That gap is a bug unless
 * the name closes it: one origin routinely hosts more than one Fieldwatch —
 * `/fieldwatch/` beside `/fieldwatch-public-demo/`, prod beside staging, a PR
 * preview beside the live build — and every one of them generates the same
 * 'fieldwatch-<build>' names. The activate sweep below then deleted a SIBLING
 * deploy's live cache on every release. The victim never recovers on its own:
 * its worker is already activated, so it never re-installs, and its next cold
 * offline launch falls through cachedShell() → null → Response.error(), which
 * is a blank page — the exact failure the install handler goes to such lengths
 * to prevent.
 *
 * So every name carries a tag derived from THIS registration's scope. FNV-1a
 * is ample (this is a namespace, not a checksum) and its fixed width is the
 * actual requirement: an 8-char tag can never be a prefix or a suffix of
 * another scope's tag, which raw scope paths very much can be ('/' sits inside
 * '/beta/'). The build id stays a literal so `sw.js` remains greppable. */
const scopeTag = (s) => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
/* `registration.scope` is the truth (a host may widen it with
 * Service-Worker-Allowed); the worker's own directory is the same thing in
 * every normal deploy and is always readable. */
const SCOPE_SUFFIX = '@' + scopeTag(
  (self.registration && self.registration.scope) || new URL('./', self.location.href).href,
)
const CACHE_PREFIX = '__FW_CACHE_PREFIX__'
/* Every cache name this scope's Fieldwatch owns: prefix + build id + tag. */
const CACHE = '__FW_CACHE_PREFIX____FW_VERSION__' + SCOPE_SUFFIX
/* Shape of the tag, used to tell "another scope's cache" from "a cache written
 * before tags existed". */
const TAGGED = /@[0-9a-f]{8}$/
const SHELL = './index.html'
/* This build's entry-script URL and its index.html length. See "the offline
 * shell" below for what each one can and cannot tell us. */
const SHELL_MARK = __FW_SHELL_MARK__
const SHELL_LEN = __FW_SHELL_LEN__
/* Refuse to go live without these. */
const CRITICAL = __FW_CRITICAL__
/* Nice to have offline; a miss costs that file and nothing else. */
const OPTIONAL = __FW_OPTIONAL__

// ignoreVary is REQUIRED here, not a nicety: static hosts commonly answer
// assets with `Vary: Origin`, and Vite's entry tags carry `crossorigin`, so the
// page's requests send an Origin header while the precache entries (added from
// a plain URL) did not. A Vary-aware match misses every one of them and the app
// dies offline with the shell loaded but no script.
const MATCH = { ignoreVary: true }

/* ------------------------------------------------------------------- install
 * Pull the build down so the game is playable with no network — but a HALF
 * pulled build must never replace a whole one.
 *
 * This used to add every entry with `.catch(() => {})`, so the install
 * RESOLVED even when every asset had failed; `skipWaiting()` fired, activate
 * swept the previous build's complete cache, and a player who had a working
 * offline game was left with a shell whose scripts were never cached — a blank
 * page, cold, offline, with no way back. Content-hashing `sw.js` (right in
 * itself) widened that window from "releases that touch JS/CSS" to "every
 * release". So the critical set is all-or-nothing: one failure rejects the
 * install, this worker never activates, and the previous worker carries on
 * serving its intact cache until the network can actually deliver a build.
 *
 * ## A verified install WAITS
 *
 * It used to call `skipWaiting()` here, so a new build took over a page that
 * was still running the old one — and activate then swept the old build's
 * cache out from under it, mid-session, mid-run. The new worker now stays in
 * `waiting` until either every tab of the game has closed (the next launch
 * picks it up, which is the browser's own rule) or the page asks for it with
 * a 'skip-waiting' message. `src/pwa.ts` exposes that as an "update ready"
 * signal and only sends the message from a safe point (the Watchtower menu),
 * then reloads onto the new build. The very first install has no predecessor
 * to wait for and activates immediately, exactly as before.
 */
const install = async () => {
  const c = await caches.open(CACHE)
  await Promise.all(CRITICAL.map((u) => c.add(u)))

  // One more way to precache a useless build: a CDN edge still serving the
  // PREVIOUS release's index.html while sw.js is already the new one. Every
  // request above succeeds, and the shell points at chunks this cache will
  // never hold. Catch it here, where the cost is "no update yet", instead of
  // on the player's next flight-mode launch, where the cost is the game.
  //
  // Deliberately the MARK test and not the stricter isThisBuildsShell() the
  // navigate path uses. A host that injects its own snippet into index.html
  // would fail an exact-length test on every install forever, re-downloading
  // the whole critical set each time and never granting offline play at all —
  // a worse outcome than an offline shell carrying somebody's analytics tag.
  const shell = await c.match(SHELL, MATCH)
  const text = shell ? await shell.text() : ''
  if (!text.includes(SHELL_MARK)) throw new Error('precached shell is not this build')

  // The critical set, and only the critical set, decides whether this build
  // may go live. See warm() for why the optional set is not allowed a vote.
  // No skipWaiting() — see "A verified install WAITS" above.
  return c
}

/* Pull the OPTIONAL set down afterwards, a few requests at a time.
 *
 * Deliberately not awaited by the install. It used to be — one uncapped
 * `Promise.all` over all of them, sitting in front of the install's end — which
 * put every last sprite ahead of the update: on a slow link the finished,
 * verified new build waited on files it is defined as not needing, and a worker
 * killed anywhere in that long window threw away the whole install and started
 * again from nothing. Detaching it inverts that. A kill now costs only the
 * files the warm had not reached yet, and it does not cost those for long
 * either: the runtime handler below caches what it fetches, so an unwarmed
 * sprite is simply cached on first use instead of up front.
 *
 * The concurrency cap is the other half — a hundred-odd simultaneous requests
 * is not a precache, it is a stampede, and on a metered or congested link it competes
 * with the game that is already running. */
let warming = null
const warm = (c) => {
  if (warming) return warming
  let i = 0
  const next = async () => {
    while (i < OPTIONAL.length) await c.add(OPTIONAL[i++]).catch(() => {})
  }
  warming = Promise.all(Array.from({ length: Math.min(6, OPTIONAL.length) }, next))
  return warming
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    install().then(
      (c) => {
        warm(c) // detached on purpose — see warm()
      },
      (err) =>
        // Nothing can reach this half-filled cache — its name is unique to this
        // build and this scope, and this worker never activated — so drop it and
        // let the next update check start clean. If the delete is itself cut
        // short, the cache is still not stranded: a LATER build's activate
        // sweeps it (same scope tag, different build id), and a retry of THIS
        // build reopens it by name and tops up whatever is missing before the
        // shell check runs again.
        caches
          .delete(CACHE)
          .catch(() => {})
          .then(() => {
            throw err
          }),
    ),
  )
})

/* ------------------------------------------------------------------ activate
 * Drop the caches THIS SCOPE owns, except this build's.
 *
 * Not "this app's name" — that is what the namespace note at the top of this
 * file is about, and matching on the bare prefix is how a sibling deploy's
 * live cache used to get deleted on every release. A blanket sweep of
 * caches.keys() would be worse still: one origin can host a docs site, a
 * marketing page and three other apps, and none of their storage is this
 * worker's business.
 *
 * Names without a tag predate this scheme, so they carry no scope to compare —
 * but their CONTENTS do. SHELL is relative, so it resolves against this
 * worker's own scope, and only the deploy that owns that path ever put it in a
 * cache. A legacy cache holding it is this deploy's previous cache and is
 * collected; one holding some other deploy's shell is left exactly alone,
 * which is the whole point. */
const ownsShell = (k) =>
  caches
    .open(k)
    .then((c) => c.match(SHELL, MATCH))
    .then((hit) => !!hit)
    .catch(() => false)

const sweep = async () => {
  const keys = await caches.keys()
  await Promise.all(
    keys.map(async (k) => {
      if (k === CACHE || !k.startsWith(CACHE_PREFIX)) return
      if (!k.endsWith(SCOPE_SUFFIX)) {
        if (TAGGED.test(k)) return // another scope's, explicitly
        if (!(await ownsShell(k))) return // legacy, and not ours
      }
      await caches.delete(k).catch(() => {})
    }),
  )
}

self.addEventListener('activate', (e) => {
  // Collecting old caches is housekeeping; claiming the clients is the job. A
  // sweep that cannot read caches.keys() must not cost this build its clients.
  e.waitUntil(sweep().catch(() => {}).then(() => self.clients.claim()))
})

/* The page's "apply the update now" (src/pwa.ts applyUpdate). Only ever sent
 * to a WAITING worker, from a point where reloading costs the player nothing. */
self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting()
})

/* ----------------------------------------------------------- the offline shell
 * The cached `./index.html` is what a cold offline launch boots, so writing to
 * it is the single most dangerous thing this worker does. It used to store
 * EVERY navigation response unconditionally, which meant one captive-portal
 * page, one 502 from the CDN, one SSO redirect — served once, while online —
 * permanently became the app. Offline the game then booted "Sign in to use this
 * Wi-Fi" forever, and only clearing site data got it back.
 *
 * Status is not enough on its own: a captive portal answers 200 on the app's
 * own origin. So a navigation response has to be a plain, un-redirected,
 * same-origin 200 AND be this build's document before it goes near the shell.
 */
const looksLikeApp = (res) =>
  !!res && res.ok && res.status === 200 && !res.redirected && res.type === 'basic'

/* Write side — strict: only this build's own index.html may take the slot.
 *
 * Containing the entry-script URL is necessary but NOT sufficient, and the
 * comment that used to sit here ("no captive portal will ever contain that
 * exact URL") was only true of portals that REPLACE the page. One that WRAPS
 * it — "SIGN IN TO USE THIS WI-FI" prepended to the real document, which is
 * how transparent proxies actually behave — carries the URL along with
 * everything else and sailed straight through. Requiring the doctype at the
 * front and the exact byte length this build emitted costs nothing and closes
 * that shape.
 *
 * None of this is a security boundary, and it should not be sold as one:
 * anything able to rewrite the response can also pad it to length. What
 * actually stops a MITM is `res.type === 'basic'` plus TLS — over HTTPS no
 * intermediary can touch this response at all, and the wrap needs plain HTTP
 * or an installed root cert to exist in the first place. These checks are for
 * the mundane failures that happen on real networks without any attacker:
 * hotel portals, maintenance pages, SSO interstitials, and a CDN edge still
 * handing out the previous build's HTML.
 */
const isThisBuildsShell = (t) =>
  t.length === SHELL_LEN && /^\s*<!doctype html/i.test(t) && t.includes(SHELL_MARK)

/* Read side — deliberately looser than the write side.
 *
 * A cached shell that is not THIS build's is still, usually, the app: a stale
 * edge, or a shell an earlier worker cached. Deleting it (what this used to do
 * on any SHELL_MARK miss) and answering Response.error() stranded the client
 * for good — the second offline reload had no shell left at all and rendered
 * an empty document. So serve anything that is structurally this app, and keep
 * deletion for a document that genuinely is not (the portal page an older,
 * less careful worker admitted), where booting it is worse than failing.
 */
const isAppDocument = (t) =>
  /<div[^>]*id="root"/.test(t) && /<script[^>]+src="[^"]*assets\/[^"]+\.js"/.test(t)

const cachedShell = () =>
  caches
    .open(CACHE)
    .then((c) =>
      c.match(SHELL, MATCH).then((r) => {
        if (!r) return null
        return r
          .clone()
          .text()
          .then((t) => (isAppDocument(t) ? r : c.delete(SHELL, MATCH).then(() => null)))
          // Unreadable is not the same as hostile: neither serve nor destroy.
          .catch(() => null)
      }),
    )
    .catch(() => null)

/* ---------------------------------------------------- the navigation deadline
 * Network-first with no deadline meant a weak connection — one bar, a train,
 * a captive portal that never answers — held the launch on a blank page for as
 * long as the browser's own timeout, 30 s and more, while a whole working build
 * sat in this cache. Now the network gets NAV_TIMEOUT_MS; after that the cached
 * shell answers, if there is one. With none (a first visit), the page keeps
 * waiting on the network, exactly as before.
 *
 * The cached shell is THIS worker's build, so this never mixes builds and never
 * hurries an update: a newer build still installs in the background and waits
 * (src/pwa.ts). Its shell write above still runs when the slow answer lands. */
const NAV_TIMEOUT_MS = 4000

const navigationResponse = (network) =>
  new Promise((resolve) => {
    let done = false
    const settle = (r) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(r)
    }
    const timer = setTimeout(() => {
      cachedShell().then((r) => {
        if (r) settle(r) // else: no shell to fall back to — keep waiting
      })
    }, NAV_TIMEOUT_MS)
    network.then(settle, () => cachedShell().then((r) => settle(r || Response.error())))
  })

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Navigations fall back to the cached shell, which is what makes a cold
  // offline launch work at all.
  if (req.mode === 'navigate') {
    const network = fetch(req).then((res) => {
      if (looksLikeApp(res)) {
        const copy = res.clone()
        // Cloned first, checked second: the check consumes a clone, and the
        // response still has to reach the page intact either way.
        res
          .clone()
          .text()
          .then((t) => {
            if (isThisBuildsShell(t)) caches.open(CACHE).then((c) => c.put(SHELL, copy)).catch(() => {})
          })
          .catch(() => {})
      }
      return res
    })
    e.respondWith(navigationResponse(network))
    // A network answer that lost the race still refreshes the shell above;
    // keep the worker alive until it lands.
    e.waitUntil(network.catch(() => {}))
    return
  }

  // Everything else: cache-first, out of THIS build's cache only.
  //
  // Assets are content-hashed, so a hit is always the right bytes — but the
  // files copied from public/ are not, and a bare caches.match() searches every
  // cache on the origin. That let a non-hashed sprite or wav be served out of
  // an orphaned, half-filled cache: a crashed install's leftovers, or another
  // Fieldwatch deploy's. Naming the cache costs nothing and asks the question
  // that was meant all along.
  e.respondWith(
    caches
      .match(req, { ...MATCH, cacheName: CACHE })
      // A cacheName that does not exist yet REJECTS rather than missing.
      .catch(() => undefined)
      .then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok && res.type === 'basic') {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
            }
            return res
          }),
      ),
  )
})
