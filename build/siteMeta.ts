import type { Plugin } from 'vite'

/**
 * Make the link-preview tags in index.html absolute (Phase 4).
 *
 * The Open Graph and Twitter card specs require an ABSOLUTE `og:image` URL,
 * and several crawlers ignore a relative one outright. The build does not know
 * where it will be served (`base: './'` — the same bundle runs at any path), so
 * index.html carries site-relative paths and this rewrites them when the site
 * URL is known at build time:
 *
 *  - `FW_SITE_URL` (e.g. `https://fieldwatch.example/`) — set it wherever the
 *    production build runs; it wins.
 *  - `VERCEL_PROJECT_PRODUCTION_URL` — a Vercel system variable (host only),
 *    exposed to builds by default, so a Vercel deploy works with no config.
 *
 * With neither, the tags stay relative (fine for local previews) and `og:url`
 * is dropped rather than guessed.
 */
export function siteMeta(): Plugin {
  const raw =
    process.env.FW_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  const site = raw ? raw.replace(/\/*$/, '/') : ''
  return {
    name: 'fieldwatch-site-meta',
    transformIndexHtml(html) {
      if (!site) return html.replace(/\s*<meta property="og:url"[^>]*>/, '')
      return html
        .replace(/(<meta (?:property|name)="(?:og:image|twitter:image)" content=")(?!https?:)([^"]+)"/g, (_, a, p) => `${a}${site}${p}"`)
        .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${site}"`)
    },
  }
}
