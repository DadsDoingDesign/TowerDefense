import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { themeArtPacks, themeAssetPaths } from '../src/game/render/sprites'
import { DEFAULT_THEME, THEMES } from '../src/game/render/themes'

/**
 * Hand-rolled PWA service worker (M24).
 *
 * No dependency: `vite-plugin-pwa` pulls in Workbox and a build-time toolchain
 * for a ~1MB single-page game that needs one cache and one fetch handler.
 * This walks the finished `dist/` — which is the only moment the hashed asset
 * names and the copied `public/` files are BOTH known — and fills the worker
 * template (`src/sw/sw.template.js`) with that exact file list as its precache.
 *
 * The worker's BEHAVIOUR (install/activate/fetch, the captive-portal and
 * stale-edge defences, the scope-tagged cache names) lives, and is documented,
 * in the template. The precache RULES live here, in {@link planPrecache}, a
 * pure function so they can be unit-tested (`tests/pwa.precache.test.ts`).
 */

/**
 * Cache-name namespace, the build-time half of it.
 *
 * This alone does NOT identify a deploy — one origin can host several
 * Fieldwatches — so the worker appends a tag derived from its own
 * registration scope at runtime. See the namespace note in the worker.
 */
const PREFIX = 'fieldwatch-'

/** Never precached: the worker itself. */
const SKIP = new Set(['sw.js'])
/**
 * Attribution and licence text ship in `dist/` because they ship in
 * `public/`, but nothing in the running game ever fetches them. Precaching
 * them only spends an install request and a slice of the origin's storage
 * quota on every player, so they are excluded by extension rather than by
 * name — the next `CREDITS.md` should not need this list edited again.
 */
const NON_RUNTIME = /\.(md|txt|map)$/i

const TEMPLATE = resolve(dirname(fileURLToPath(import.meta.url)), '../src/sw/sw.template.js')

export interface PrecacheInput {
  /** Every file in `dist/`, `/`-separated and relative to it. */
  files: readonly string[]
  /** What ROLLUP emitted, as opposed to everything copied from `public/`. */
  bundleFiles: ReadonlySet<string>
  /** The emitted JS/CSS/HTML/manifest text, concatenated. */
  haystack: string
  /**
   * The packs the default theme draws from — its primary pack and whichever
   * fallback packs supply a role (`themeArtPacks`). Empty for a procedural
   * theme.
   */
  activePacks: readonly string[]
  /** `themeAssetPaths(theme)` — exactly the files the sprite loader requests. */
  packFiles: readonly string[]
}

export interface PrecachePlan {
  /** Refuse to go live without these: the shell and every bundle chunk. */
  critical: string[]
  /** Nice to have offline; a miss costs that file and nothing else. */
  optional: string[]
  /** Ships in `dist/`, still fetchable, but nothing at runtime asks for it. */
  unreachable: string[]
  /** Declared by the active pack but absent from `dist/` — a runtime 404. */
  missingPackFiles: string[]
  /** Sprite folders the emitted code names literally that are NOT an active pack. */
  foreignPackDirs: string[]
}

/**
 * Decide what the worker precaches.
 *
 * ## CRITICAL vs OPTIONAL
 *
 * Two lists, because "some of the build" is worse than either all of it or
 * none of it. CRITICAL is what a cold offline launch cannot boot without: the
 * shell plus every chunk and stylesheet rollup emitted. If any of these is
 * missing the install is refused outright, which leaves the PREVIOUS worker
 * active with its complete cache instead of replacing a working offline game
 * with a blank page. Everything else is OPTIONAL and added one file at a time:
 * a sprite that 404s costs that sprite, not a release.
 *
 * ## Reachability — derived from what the game REQUESTS, not from folders
 *
 * This used to precache every file under `assets/sprites/` and `assets/audio/`
 * because those paths are built from variables at runtime and the directory
 * was the only literal. That rule shipped ~420 KB nobody could reach: five
 * retired sprite packs, the inactive `fieldwatch` placeholder pack, and a lazy
 * chunk for a UI no player could open. Now:
 *
 *  - **Sprites** (`assets/sprites/**`) are precached iff the default theme
 *    DRAWS them: `themeAssetPaths` in `sprites.ts` walks the theme's per-role
 *    fallback chain and names, for each role, the one file of the one pack it
 *    resolves to — the same list the loader fetches at boot, so the two cannot
 *    drift. A shadowed file (the tinyswords copy of a role fieldwatch ships),
 *    every pack outside the chain and `tinyswords@half` stay on disk and out
 *    of the offline set.
 *  - **Everything else under `assets/`** is precached iff the emitted code
 *    names it: its basename occurs literally (every `border-image`, the icon
 *    atlas, the fonts), or its extensionless stem occurs as a QUOTED string —
 *    how the runtime-built paths appear (`fx.ts`'s `['explosions', 'fire']`,
 *    the UI sample names in `audio.ts`). Quoted, so a stem that merely occurs
 *    inside an identifier or a longer word (`deco` in "decode") does not count.
 *  - **Outside `assets/`** (index.html, the web manifest, its icons) is always
 *    precached — except `social/`, the link-preview card only crawlers fetch.
 *
 * The haystack is the emitted code, not the source: a path that survives only
 * in a comment is not a reference, and comments are gone by this point.
 */
export function planPrecache(input: PrecacheInput): PrecachePlan {
  const files = input.files.filter((f) => !SKIP.has(f) && !NON_RUNTIME.test(f)).slice().sort()
  const isBundleCode = (f: string): boolean => input.bundleFiles.has(f) && /\.(js|css)$/i.test(f)
  // Fallback for the (unreachable in a normal build) case where the rollup
  // hook never ran: assume the flat top level of assets/ is bundle output.
  const anyCode = files.some(isBundleCode)
  const critical = files.filter(
    (f) => f === 'index.html' || (anyCode ? isBundleCode(f) : /^assets\/[^/]+\.(js|css)$/i.test(f)),
  )
  const criticalSet = new Set(critical)
  const packSet = new Set(input.packFiles)

  const base = (f: string): string => f.slice(f.lastIndexOf('/') + 1)
  const stem = (f: string): string => base(f).replace(/\.[^.]+$/, '')
  const quoted = (s: string): boolean =>
    input.haystack.includes(`"${s}"`) || input.haystack.includes(`'${s}'`) || input.haystack.includes('`' + s + '`')

  const reachable = (f: string): boolean => {
    // Link-preview art (the og:image card) is fetched by other sites' crawlers,
    // never by the game; it stays in dist/ and out of every player's offline set.
    if (f.startsWith('social/')) return false
    if (!f.startsWith('assets/')) return true
    if (f.startsWith('assets/sprites/')) return packSet.has(f)
    return input.haystack.includes(base(f)) || quoted(stem(f))
  }

  const unreachable = files.filter((f) => !criticalSet.has(f) && !reachable(f))
  const optional = files.filter((f) => !criticalSet.has(f) && reachable(f))
  const present = new Set(files)
  const missingPackFiles = input.packFiles.filter((f) => !present.has(f))

  /*
   * A guard, not a comment. If code names another pack's folder literally
   * (`assets/sprites/tinyswords@half/…`, `assets/sprites/fieldwatch/…`), that
   * art is needed but was left out of the offline set by the rule above. The
   * build stops instead of shipping a game whose offline install is quietly
   * missing it. Dynamic loads (`assets/sprites/${pack}/`) never trip this: the
   * minifier leaves no pack name in the literal.
   */
  const dirs = new Set<string>()
  for (const m of input.haystack.matchAll(/assets\/sprites\/([A-Za-z0-9_@.-]+)\//g)) dirs.add(m[1])
  const foreignPackDirs = [...dirs].filter((d) => !input.activePacks.includes(d)).sort()

  return { critical, optional, unreachable, missingPackFiles, foreignPackDirs }
}

/** Fill the template's `__FW_*__` tokens. Throws if any token is left over. */
export function renderWorker(
  template: string,
  v: { version: string; shellMark: string; shellLen: number; critical: string[]; optional: string[] },
): string {
  const url = (f: string): string => './' + f
  const tokens: Record<string, string> = {
    __FW_CACHE_PREFIX__: PREFIX,
    __FW_VERSION__: v.version,
    __FW_SHELL_MARK__: JSON.stringify(v.shellMark),
    __FW_SHELL_LEN__: String(v.shellLen),
    __FW_CRITICAL__: JSON.stringify(v.critical.map(url), null, 2),
    __FW_OPTIONAL__: JSON.stringify(v.optional.map(url), null, 2),
  }
  let out = template
  for (const [k, val] of Object.entries(tokens)) out = out.split(k).join(val)
  const left = out.match(/__FW_[A-Z_]+__/g)
  if (left) throw new Error(`fieldwatch-pwa: unfilled worker template token(s): ${[...new Set(left)].join(', ')}`)
  return out
}

const walk = (dir: string, root: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, root, out)
    else out.push(relative(root, full).split(sep).join(posix.sep))
  }
  return out
}

export function pwa(): Plugin {
  let outDir = 'dist'
  /**
   * Everything ROLLUP emitted, as opposed to everything that ends up in
   * `dist/`. The difference matters: `public/` is copied in wholesale, and it
   * lands under `assets/` too (assets/sprites, assets/audio), so the output
   * path cannot tell a bundle chunk apart from a copied sprite. This set can,
   * and it is what decides which files the install refuses to go live without.
   */
  const bundleFiles = new Set<string>()
  return {
    name: 'fieldwatch-pwa',
    apply: 'build',
    configResolved(cfg) {
      outDir = cfg.build.outDir
    },
    generateBundle(_options, bundle) {
      for (const name of Object.keys(bundle)) bundleFiles.add(name)
    },
    closeBundle() {
      const root = resolve(process.cwd(), outDir)
      let files: string[]
      try {
        files = walk(root, root)
      } catch {
        return // no build output (e.g. a dry run) — nothing to precache
      }

      const haystack = files
        .filter((f) => /\.(js|css|html|webmanifest|json)$/i.test(f) && f !== 'sw.js')
        .map((f) => readFileSync(join(root, f), 'utf8'))
        .join('\n')
      const theme = THEMES[DEFAULT_THEME]
      const activePacks = theme ? themeArtPacks(theme) : []
      const activePack = activePacks.join(' + ') || 'none'
      const plan = planPrecache({
        files,
        bundleFiles,
        haystack,
        activePacks,
        packFiles: theme ? themeAssetPaths(theme) : [],
      })

      if (plan.foreignPackDirs.length) {
        throw new Error(
          `fieldwatch-pwa: the build names sprite folder(s) ${plan.foreignPackDirs.map((d) => `assets/sprites/${d}/`).join(', ')}, ` +
            `but only the active pack(s) (${activePack}) are precached. Load that art through the active ` +
            'theme (sprites.ts PACK_ROLES), or extend planPrecache in build/pwa.ts — otherwise the offline install ships without it.',
        )
      }
      if (plan.missingPackFiles.length) {
        console.warn(
          `fieldwatch-pwa: ${plan.missingPackFiles.length} file(s) the ${activePack} pack declares are missing from dist/ ` +
            `(runtime 404s): ${plan.missingPackFiles.slice(0, 6).join(', ')}${plan.missingPackFiles.length > 6 ? ', …' : ''}`,
        )
      }

      /*
       * The cache name has to change whenever any BYTE does, or an installed
       * player keeps the old build forever.
       *
       * Hashing the file-NAME list does not do that. JS and CSS survive it by
       * accident because Vite content-hashes their filenames, but everything
       * copied from `public/` — every sprite, all the wavs, the icons and the
       * web manifest — keeps a fixed name. Change one of those and the old
       * digest came out identical, `sw.js` was byte-for-byte the same file, the
       * browser's byte-comparison update check found nothing to install, and
       * the worker never reinstalled: the new release was invisible to everyone
       * who already had the game. So hash the contents.
       *
       * Sizes are not a substitute — two different 4 KB sprites collide.
       *
       * Over the PRECACHED set only. Hashing files the worker never stores means
       * editing an unwired PNG evicts every installed player's cache and
       * re-downloads a build whose stored bytes are identical — an invalidation
       * with no content behind it. The template is hashed too, so a behaviour
       * change to the worker always reaches installed players.
       */
      const template = readFileSync(TEMPLATE, 'utf8')
      const precached = [...plan.critical, ...plan.optional]
      const digest = createHash('sha256').update(template).update('\0')
      let bytes = 0
      for (const f of precached) {
        const body = readFileSync(join(root, f))
        bytes += body.length
        digest.update(f).update('\0').update(body).update('\0')
      }
      const version = digest.digest('hex').slice(0, 12)
      const droppedBytes = plan.unreachable.reduce((n, f) => n + statSync(join(root, f)).size, 0)

      /*
       * A fingerprint of THIS build's shell, used by the worker to tell the
       * app's own document apart from anything else the origin might answer a
       * navigation with: Vite always emits a content-hashed entry script, so
       * the URL is unique to this build. Its exact character length rides
       * along, because presence of the URL alone only rules out a page that
       * REPLACES the app (see the worker's own notes on the shell).
       */
      const html = readFileSync(join(root, 'index.html'), 'utf8')
      const shellMark = /<script[^>]+src="([^"]*assets\/[^"]+\.js)"/.exec(html)?.[1]
      /*
       * No fallback, on purpose.
       *
       * This used to fall back to `'id="root"'`, which every build shipped and
       * which is not a fingerprint of anything: a stale CDN edge's index.html,
       * the previous release's index.html, any document with a root div all
       * contain it. So on the day the pattern above stopped matching, the
       * install-time stale-edge check and the shell write-side check would
       * both have gone on passing — silently, everywhere, with nothing in the
       * build output to say the worker's only build-identity signal had been
       * swapped for a constant. A build that cannot produce the mark has to be
       * fixed, not shipped.
       */
      if (!shellMark) {
        throw new Error(
          'fieldwatch-pwa: no content-hashed entry script found in dist/index.html, so ' +
            "there is no fingerprint for this build's shell. The service worker's " +
            'stale-edge and shell-write checks are built on it. Fix the entry-script ' +
            'pattern in build/pwa.ts (or the html transform that dropped the tag) ' +
            'before shipping — there is deliberately no fallback.',
        )
      }

      const sw = renderWorker(template, {
        version,
        shellMark,
        shellLen: html.length,
        critical: plan.critical,
        optional: plan.optional,
      })
      writeFileSync(join(root, 'sw.js'), sw)
      const kb = Math.round(bytes / 1024)
      console.log(
        `fieldwatch-pwa: sw.js precaches ${precached.length} files (${kb} KB), ` +
          `${plan.critical.length} critical, active pack ${activePack ?? '(none)'}, cache ${PREFIX}${version}@<scope> ` +
          `(the scope tag is computed by the worker at runtime)`,
      )
      if (plan.unreachable.length) {
        console.log(
          `fieldwatch-pwa: ${plan.unreachable.length} unrequested file(s) left OUT of the precache ` +
            `(${Math.round(droppedBytes / 1024)} KB). They still ship and are still fetchable; ` +
            'they are just not part of the offline set.',
        )
      }
    },
  }
}
