import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { planPrecache, renderWorker } from '../build/pwa'
import { packAssetPaths } from '../src/game/render/sprites'
import { DEFAULT_THEME, THEMES } from '../src/game/render/themes'

const ROOT = resolve(import.meta.dirname, '..')
const PUBLIC = join(ROOT, 'public')

const base = {
  bundleFiles: new Set(['assets/index-abc.js', 'assets/index-abc.css', 'assets/font-x.woff2']),
  activePack: 'tinyswords',
  packFiles: ['assets/sprites/tinyswords/fighter.png', 'assets/sprites/tinyswords/grass.png', 'assets/sprites/tinyswords/road.png'],
}
const files = [
  'index.html',
  'sw.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'licenses/OFL.txt',
  'assets/index-abc.js',
  'assets/index-abc.css',
  'assets/font-x.woff2',
  'assets/sprites/CREDITS.md',
  'assets/sprites/tinyswords/fighter.png',
  'assets/sprites/tinyswords/grass.png',
  'assets/sprites/tinyswords/unused.png',
  'assets/sprites/tinyswords@half/fighter.png',
  'assets/sprites/fieldwatch/fighter.png',
  'assets/audio/ui/click.wav',
  'assets/audio/ui/unused.wav',
  'assets/fx/tinyswords/fire.png',
  'assets/fx/tinyswords/water.png',
  'assets/deco/tinyswords/deco_01.png',
  'assets/ui/fw-icons.png',
]
// What a minified bundle actually looks like: runtime-built paths, quoted stems.
const haystack = [
  'const a="assets/sprites/"+e+"/"+t+".png";',
  'const S={click:"click"};const d="assets/audio/ui/";',
  'const F=["fire"];img.src=`assets/fx/tinyswords/${F[i]}.png`;',
  'function decode(){}', // "deco" inside a word is not a reference
  'url(/assets/ui/fw-icons.png) url(font-x.woff2)',
  'const hero=e=>`assets/sprites/tinyswords/${e}.png`',
].join('\n')

describe('planPrecache', () => {
  const plan = planPrecache({ ...base, files, haystack })

  it('makes the shell and every bundle chunk critical, and nothing else', () => {
    expect(plan.critical).toEqual(['assets/index-abc.css', 'assets/index-abc.js', 'index.html'])
  })

  it('precaches only the active pack’s declared sprites', () => {
    const sprites = plan.optional.filter((f) => f.startsWith('assets/sprites/'))
    expect(sprites).toEqual(['assets/sprites/tinyswords/fighter.png', 'assets/sprites/tinyswords/grass.png'])
    expect(plan.unreachable).toEqual(
      expect.arrayContaining([
        'assets/sprites/tinyswords/unused.png',
        'assets/sprites/tinyswords@half/fighter.png',
        'assets/sprites/fieldwatch/fighter.png',
      ]),
    )
  })

  it('precaches other assets only when the emitted code names them', () => {
    expect(plan.optional).toEqual(
      expect.arrayContaining([
        'assets/audio/ui/click.wav',
        'assets/fx/tinyswords/fire.png',
        'assets/ui/fw-icons.png',
        'assets/font-x.woff2',
        'manifest.webmanifest',
        'icons/icon-192.png',
      ]),
    )
    expect(plan.unreachable).toEqual(
      expect.arrayContaining([
        'assets/audio/ui/unused.wav',
        'assets/fx/tinyswords/water.png',
        'assets/deco/tinyswords/deco_01.png',
      ]),
    )
  })

  it('never precaches the worker or licence text', () => {
    const all = [...plan.critical, ...plan.optional, ...plan.unreachable]
    expect(all).not.toContain('sw.js')
    expect(all.some((f) => /\.(md|txt)$/.test(f))).toBe(false)
  })

  it('reports declared-but-missing pack files and foreign pack folders', () => {
    expect(plan.missingPackFiles).toEqual(['assets/sprites/tinyswords/road.png'])
    expect(plan.foreignPackDirs).toEqual([])
    const wired = planPrecache({ ...base, files, haystack: haystack + '"assets/sprites/tinyswords@half/x.png"' })
    expect(wired.foreignPackDirs).toEqual(['tinyswords@half'])
  })
})

describe('the service-worker template', () => {
  const template = readFileSync(join(ROOT, 'src/sw/sw.template.js'), 'utf8')

  it('fills every token', () => {
    const sw = renderWorker(template, {
      version: 'abc123',
      shellMark: './assets/index-abc.js',
      shellLen: 1234,
      critical: ['index.html'],
      optional: ['assets/x.png'],
    })
    expect(sw).not.toMatch(/__FW_[A-Z_]+__/)
    expect(sw).toContain("const CACHE = 'fieldwatch-abc123' + SCOPE_SUFFIX")
    expect(sw).toContain('"./assets/x.png"')
    // It must still parse as a script.
    expect(() => new Function(sw)).not.toThrow()
  })

  it('refuses a template with an unknown token', () => {
    expect(() =>
      renderWorker(template + '\n__FW_NOPE__', { version: 'v', shellMark: 'm', shellLen: 1, critical: [], optional: [] }),
    ).toThrow(/__FW_NOPE__/)
  })

  it('waits after install: skipWaiting only runs on the page’s request', () => {
    const code = template.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const calls = code.match(/self\.skipWaiting\(\)/g) ?? []
    expect(calls).toHaveLength(1)
    expect(code).toMatch(/if \(e\.data === 'skip-waiting'\) self\.skipWaiting\(\)/)
  })
})

describe('sprite packs on disk', () => {
  it('the default theme renders the pack the precache is built from', () => {
    expect(THEMES[DEFAULT_THEME].sprites?.pack).toBe('tinyswords')
  })

  it('every file the active pack declares exists in public/', () => {
    const missing = packAssetPaths('tinyswords').filter((f) => !existsSync(join(PUBLIC, f)))
    expect(missing).toEqual([])
  })

  it('ships no pack folder that no theme can select, except the art-pipeline ones', () => {
    const selectable = new Set(Object.values(THEMES).flatMap((t) => (t.sprites ? [t.sprites.pack] : [])))
    const dirs = readdirSync(join(PUBLIC, 'assets/sprites'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
    // tinyswords@half is the documented one-line swap (pixmap.ts).
    expect(dirs.filter((d) => !selectable.has(d) && d !== 'tinyswords@half')).toEqual([])
  })
})
