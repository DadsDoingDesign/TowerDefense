import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { planPrecache, renderWorker } from '../build/pwa'
import {
  ALL_ROLES,
  artFamily,
  packAssetPaths,
  packRoles,
  themeArtPacks,
  themeArtPlan,
  themeAssetPaths,
} from '../src/game/render/sprites'
import { artOverride, DEFAULT_THEME, packDensity, THEMES } from '../src/game/render/themes'

const ROOT = resolve(import.meta.dirname, '..')
const PUBLIC = join(ROOT, 'public')

const base = {
  bundleFiles: new Set(['assets/index-abc.js', 'assets/index-abc.css', 'assets/font-x.woff2']),
  activePacks: ['tinyswords'],
  packFiles: ['assets/sprites/tinyswords/fighter.png', 'assets/sprites/tinyswords/grass.png', 'assets/sprites/tinyswords/road.png'],
}
const files = [
  'index.html',
  'sw.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'social/og-image.png',
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

  it('ships the link-preview card but never precaches it', () => {
    expect(plan.unreachable).toContain('social/og-image.png')
    expect(plan.optional).not.toContain('social/og-image.png')
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

/** Width × height from a PNG's IHDR — enough to measure drawn sizes without a decoder. */
function pngSize(file: string): { w: number; h: number } {
  const b = readFileSync(file)
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
}

describe('the per-role fallback chain (HANDOFF §6.4)', () => {
  const fw = THEMES.fieldwatch
  const plan = themeArtPlan(fw)

  it('leaves the default theme exactly as it was: its whole pack, nothing else', () => {
    expect(themeAssetPaths(THEMES[DEFAULT_THEME]).sort()).toEqual(packAssetPaths(DEFAULT_THEME).sort())
    expect(themeArtPacks(THEMES[DEFAULT_THEME])).toEqual([DEFAULT_THEME])
  })

  it('draws each role from the first pack in the chain that ships its family', () => {
    for (const role of ['fighter', 'fighter_idle', 'fighter_atk', 'torch1', 'torch1_walk', 'grass', 'tree1', 'gear_sword']) {
      expect(plan.get(role), role).toBe('fieldwatch')
    }
    for (const role of ['rogue', 'rogue_idle', 'mystic_atk', 'torch2_walk', 'tnt5', 'barrel3', 'tree2', 'rock1', 'bush2']) {
      expect(plan.get(role), role).toBe('tinyswords')
    }
    // Nobody ships a road: it stays procedural, under either theme.
    expect(plan.has('road')).toBe(false)
    expect(themeArtPacks(fw)).toEqual(['fieldwatch', 'tinyswords'])
  })

  it('keeps a family in ONE pack — no idle strip from one artist and an attack from another', () => {
    const byFamily = new Map<string, Set<string>>()
    for (const [role, pack] of plan) byFamily.set(artFamily(role), (byFamily.get(artFamily(role)) ?? new Set()).add(pack))
    for (const [fam, packs] of byFamily) expect([...packs], fam).toHaveLength(1)
  })

  it('preloads and precaches exactly what is drawn: no shadowed file, nothing twice', () => {
    const files = themeAssetPaths(fw)
    expect(new Set(files).size).toBe(files.length)
    expect(new Set(files.map((f) => f.slice(f.lastIndexOf('/') + 1))).size).toBe(files.length)
    for (const shadowed of ['fighter', 'fighter_idle', 'fighter_atk', 'torch1', 'torch1_walk', 'grass', 'tree1']) {
      expect(files).not.toContain(`assets/sprites/tinyswords/${shadowed}.png`)
      expect(files).toContain(`assets/sprites/fieldwatch/${shadowed}.png`)
    }
    expect(files.filter((f) => !existsSync(join(PUBLIC, f)))).toEqual([])
  })

  it('planPrecache takes every pack the theme draws from, and only the drawn files of each', () => {
    const packFiles = themeAssetPaths(fw)
    const shipped = [...packAssetPaths('fieldwatch'), ...packAssetPaths('tinyswords')]
    const p = planPrecache({
      files: ['index.html', 'assets/index-abc.js', ...shipped, 'assets/sprites/tinyswords@half/fighter.png'],
      bundleFiles: base.bundleFiles,
      haystack: haystack + '"assets/sprites/fieldwatch/x.png"',
      activePacks: themeArtPacks(fw),
      packFiles,
    })
    const cached = p.optional.filter((f) => f.startsWith('assets/sprites/'))
    expect(cached.sort()).toEqual([...packFiles].sort())
    expect(p.unreachable).toContain('assets/sprites/tinyswords/fighter.png')
    expect(p.unreachable).toContain('assets/sprites/tinyswords@half/fighter.png')
    expect(p.missingPackFiles).toEqual([])
    // Naming a pack in the chain literally is not "foreign".
    expect(p.foreignPackDirs).toEqual([])
  })

  it('draws every role at its OWN pack’s density, so no fallback tree trips DECO_CEIL', () => {
    expect(packDensity('fieldwatch')).toBe(1)
    expect(packDensity('tinyswords')).toBe(0.5)
    // terrain.ts DECO_CEIL: a decoration drawn taller than this is dropped
    // from the pool silently (HANDOFF §5.1) — the vanished-trees trap.
    const DECO_CEIL = 96
    for (const role of ['tree1', 'tree2', 'tree3', 'tree4', 'rock1', 'rock2', 'rock3', 'rock4', 'bush1', 'bush2']) {
      const pack = plan.get(role)!
      const drawn = Math.ceil(pngSize(join(PUBLIC, 'assets/sprites', pack, `${role}.png`)).h * packDensity(pack))
      expect(drawn, `${pack}/${role}`).toBeLessThanOrEqual(DECO_CEIL)
    }
  })

  it('declares every pack truthfully: each declared file exists, each runtime file is declared', () => {
    const runtime = new Set(ALL_ROLES)
    for (const pack of ['tinyswords', 'fieldwatch']) {
      const missing = packAssetPaths(pack).filter((f) => !existsSync(join(PUBLIC, f)))
      expect(missing, pack).toEqual([])
      const onDisk = readdirSync(join(PUBLIC, 'assets/sprites', pack))
        .filter((f) => f.endsWith('.png'))
        .map((f) => f.slice(0, -4))
        .filter((r) => runtime.has(r))
      const undeclared = onDisk.filter((r) => !packRoles(pack).includes(r))
      expect(undeclared, `${pack}: authored but never drawn — add it to PACK_ROLES`).toEqual([])
    }
  })

  it('the ?art= preview switch accepts sprite themes only', () => {
    expect(artOverride('?art=fieldwatch')).toBe('fieldwatch')
    expect(artOverride('?x=1&art=tinyswords')).toBe('tinyswords')
    expect(artOverride('?art=tactical')).toBeNull()
    expect(artOverride('?art=nope')).toBeNull()
    expect(artOverride('')).toBeNull()
  })
})
