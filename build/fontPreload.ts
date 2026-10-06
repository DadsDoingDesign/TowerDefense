import type { Plugin } from 'vite'

/**
 * `<link rel="preload" as="font">` for the webfonts the FIRST screen draws
 * (Lane 4.3).
 *
 * The display face is declared in `global.css`, which lives in the bundle's
 * stylesheet, so the browser only learns the font exists once that stylesheet
 * has arrived and been matched against text — a second round trip after the
 * CSS on a slow link, and a late swap of the wordmark. A preload in the shell
 * starts it with the HTML instead.
 *
 * The font files are content-hashed by Vite (`crimson-text-700-<hash>.woff2`),
 * so the URL cannot be written into `index.html` by hand. This reads the final
 * name out of the bundle, in the same `transformIndexHtml` pass that writes the
 * entry tags. Dev serves the source files unhashed and needs no preload.
 *
 * Only the weights the first screen uses: the menu's wordmark and headings are
 * Crimson Text 700, and nothing on it sets 600 (measured: a cold load of the
 * menu requests the 700 file only). Preloading a weight the screen does not use
 * spends the slow link's bandwidth against the entry script.
 */
export function fontPreload(fonts: readonly string[] = ['crimson-text-700.woff2']): Plugin {
  return {
    name: 'fieldwatch-font-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return
        const wanted = new Set(fonts)
        const hrefs: string[] = []
        for (const out of Object.values(ctx.bundle)) {
          if (out.type !== 'asset') continue
          const names = [out.name, ...((out as { originalFileNames?: string[] }).originalFileNames ?? [])]
          if (names.some((n) => n && wanted.has(n.slice(n.lastIndexOf('/') + 1)))) hrefs.push(out.fileName)
        }
        if (hrefs.length !== wanted.size) {
          // A renamed or dropped font must not silently lose its preload (or
          // preload the wrong file); fail the build where the cause is obvious.
          throw new Error(
            `fieldwatch-font-preload: expected ${[...wanted].join(', ')} in the bundle, found ${hrefs.join(', ') || 'none'}. ` +
              'Update the list in vite.config.ts to the fonts the first screen uses.',
          )
        }
        // `base: './'` — relative, like the entry tags Vite writes.
        return hrefs.sort().map((f) => ({
          tag: 'link',
          attrs: { rel: 'preload', href: `./${f}`, as: 'font', type: 'font/woff2', crossorigin: '' },
          injectTo: 'head' as const,
        }))
      },
    },
  }
}
