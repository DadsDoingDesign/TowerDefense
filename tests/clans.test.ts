/**
 * The goblin clans (Oct 2026, `src/game/data/clans.ts`, `run/clans.ts`,
 * `scripts/enemy-clans.ts`): one clan per company's road, a LOOK and a NAME
 * only — every stat, behaviour and wave stays the faction's own.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { SPECIALISTS } from '../src/game/data/behaviours'
import {
  baseOf,
  CLAN_IDS,
  CLAN_OF_COMPANY,
  CLAN_STILL_ROLES,
  CLAN_WALK_ROLES,
  DEFAULT_CLAN,
  PLAIN_GOBLIN_ROLES,
  clanArtId,
  clanById,
  clanLookId,
  clanRolesOf,
  CLANS,
  clanUnitName,
  enemyName,
  FACTIONS,
  isClanRole,
  TIERS,
} from '../src/game/data/clans'
import { COMPANY_IDS } from '../src/game/data/companies'
import { ENEMY_MODS, ENEMY_TYPES } from '../src/game/data/enemies'
import { roadClan, runClan, sovereignClan } from '../src/game/run/clans'
import { CLAN_ART } from '../src/game/render/enemyClans.generated'

const ROOT = resolve(import.meta.dirname, '..')
const PACK = join(ROOT, 'public', 'assets', 'sprites', 'tinyswords')

describe('one clan per company road, each dressed and named apart', () => {
  it('maps every company to its own clan', () => {
    expect(COMPANY_IDS.map((c) => CLAN_OF_COMPANY[c])).toEqual([...CLAN_IDS])
    expect(new Set(CLANS.map((c) => c.company)).size).toBe(COMPANY_IDS.length)
    for (const c of CLANS) expect(CLAN_OF_COMPANY[c.company]).toBe(c.id)
  })

  it('gives every (company, faction, tier) a distinct look id and its own name', () => {
    const looks = new Set<string>()
    const names = new Set<string>()
    for (const company of COMPANY_IDS)
      for (const f of FACTIONS)
        for (const t of TIERS) {
          const clan = CLAN_OF_COMPANY[company]
          const look = clanLookId(clan, f, t)
          const name = clanUnitName(clan, f, t)
          expect(look).toBe(`${clan}.${f}${t}`)
          expect(name.trim().length, look).toBeGreaterThan(0)
          looks.add(look)
          names.add(name)
          // Never the bench goblin's name: a clan's units are its own.
          expect(name, look).not.toBe(ENEMY_TYPES[`${f}${t}`].name)
        }
    expect(looks.size).toBe(COMPANY_IDS.length * FACTIONS.length * TIERS.length)
    expect(names.size).toBe(looks.size)
    // The plain bench look is its own id too.
    expect(clanLookId(null, 'torch', 3)).toBe('plain.torch3')
  })

  it('names the casters for every clan, apart from each other and from the bench', () => {
    const all = CLANS.flatMap((c) => Object.values(c.specialists))
    expect(new Set(all).size).toBe(all.length)
    for (const sp of SPECIALISTS) for (const c of CLANS) expect(c.specialists[sp.suffix as 'shaman' | 'bearer']).toBeTruthy()
  })
})

describe('enemyName: the one name helper every surface uses', () => {
  it('is the engine name on a bench (no clan), so the balance report reads as before', () => {
    for (const t of Object.values(ENEMY_TYPES)) expect(enemyName(t, null)).toBe(t.name)
  })

  it('names every registry key on every clan road — base, caster, elite, champion half', () => {
    for (const clan of CLAN_IDS)
      for (const [key, t] of Object.entries(ENEMY_TYPES)) {
        const n = enemyName(t, clan)
        const base = baseOf(t.id)!
        const mod = ENEMY_MODS.find((m) => key.endsWith(`_${m.id}`))
        const sp = SPECIALISTS.find((s) => key.includes(`_${s.suffix}`))
        const unit = sp ? clanById(clan).specialists[sp.suffix as 'shaman' | 'bearer'] : clanUnitName(clan, base.faction, base.tier)
        expect(n, `${clan} ${key}`).toBe(mod ? `${unit} · ${mod.prefix}` : unit)
      }
    const colossus = ENEMY_TYPES.barrel5
    expect(enemyName({ ...colossus, name: `${colossus.name} (half)` }, 'hexmoon')).toBe('The Rot Vat (half)')
    expect(enemyName(ENEMY_TYPES.tnt2_warded, 'hexmoon')).toBe('Spore Bomber · Warded')
  })
})

describe('every surface names through enemyName', () => {
  it('the wave preview line-up and the enemy card name and dress a goblin as the road does', async () => {
    const { lineUp } = await import('../src/ui/shell/enemyQueue')
    const { enemyCardData } = await import('../src/ui/shell/enemyFacts')
    const q = [{ typeId: 'tnt2_warded', group: 0 }, { typeId: 'torch5', group: 0 }]
    // No clan given: the default clan's — never the plain goblin's name or art.
    expect(lineUp(q).map((e) => [e.name, e.art])).toEqual([
      ['Firepot Bomber · Warded', 'cinder_tnt2'],
      ['Chief Scorchgut', 'cinder_torch5'],
    ])
    expect(lineUp(q, 'smudge').map((e) => [e.name, e.art])).toEqual([
      ['Brine Bomber · Warded', 'smudge_tnt2'],
      ['Chief Gristle', 'smudge_torch5'],
    ])
    const knowledge = { kind: 'barrel3', level: 'met', felled: 1, need: 5 } as const
    expect(enemyCardData('barrel3_bearer', { wave: null, hpMult: 1, laneLength: 0, knowledge, clan: 'silkcut' })!.name).toBe('Veil Bearer')
    expect(enemyCardData('barrel3_bearer', { wave: null, hpMult: 1, laneLength: 0, knowledge })!.name).toBe('Hearth Bearer')
  })

  it('an older save meets the clans of the roads it has ridden; a new one records the clan it fights', async () => {
    const { migrateMeta } = await import('../src/state/metaStore')
    expect(migrateMeta({ standing: { spice: 40, art: 0, metals: 9, silk: 0, scrolls: 0 }, codex: { enemies: ['torch1'] } }, 20).codex.clans).toEqual(['cinder', 'delve'])
    expect(migrateMeta({ codex: { enemies: [], clans: ['hexmoon', 'bogus', 'hexmoon'] } }, 20).codex.clans).toEqual(['hexmoon'])
  })
})

describe('which clan raids a road: a pure rule', () => {
  it('the clan follows the run: a company’s clan in every act, on any field; no run deals the default clan', () => {
    for (const company of COMPANY_IDS) for (let act = 1; act <= 4; act++) expect(roadClan({ company }, 12345, act)).toBe(CLAN_OF_COMPANY[company])
    expect(roadClan(null, 1, 1)).toBe(DEFAULT_CLAN)
    expect(DEFAULT_CLAN).toBe(CLAN_OF_COMPANY.spice)
  })

  it('the Sovereign Route mixes clans by act: a hash of (seed, act), never the act before’s', () => {
    const seen = new Set<string>()
    for (let seed = 1; seed < 400; seed++) {
      let prev: string | null = null
      for (let act = 1; act <= 4; act++) {
        const c = sovereignClan(seed * 7919, act)
        // Pure: the same inputs, the same clan — and the road helper agrees.
        expect(sovereignClan(seed * 7919, act)).toBe(c)
        expect(roadClan({ company: null, charter: true }, seed * 7919, act)).toBe(c)
        expect(c).not.toBe(prev)
        prev = c
        seen.add(c)
      }
    }
    expect([...seen].sort()).toEqual([...CLAN_IDS].sort())
  })

  it('reads the run’s act and field, nothing else (no run stream is touched)', () => {
    const st = { contract: { company: null, charter: true }, runSeed: 99, fieldAct: 3 }
    expect(runClan(st)).toBe(sovereignClan(99, 3))
    expect(runClan({ ...st, contract: { company: 'metals' } })).toBe('delve')
    expect(runClan({ ...st, contract: null })).toBe(DEFAULT_CLAN)
  })
})

describe('the stats are untouched: a clan is a look and a name', () => {
  it('every enemy type (base, caster, elite) and every modifier match the snapshot taken before the clans', () => {
    const snap = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'enemyStats.snapshot.json'), 'utf8')) as {
      types: Record<string, unknown>
      mods: unknown
    }
    const now = Object.fromEntries(Object.keys(ENEMY_TYPES).sort().map((k) => [k, JSON.parse(JSON.stringify(ENEMY_TYPES[k]))]))
    expect(now).toEqual(snap.types)
    expect(JSON.parse(JSON.stringify(ENEMY_MODS))).toEqual(snap.mods)
  })
})

describe('the baked clan strips', () => {
  const roles = [...CLAN_WALK_ROLES, ...CLAN_STILL_ROLES]

  it('ships every strip, and records each one’s cell and art top', () => {
    expect(roles).toHaveLength(75)
    for (const r of roles) {
      expect(existsSync(join(PACK, `${r}.png`)), r).toBe(true)
      expect(isClanRole(r)).toBe(true)
      const meta = CLAN_ART[r]
      expect(meta, r).toBeTruthy()
      expect(meta.top, r).toBeGreaterThanOrEqual(0)
      expect(meta.top, r).toBeLessThan(0.5)
    }
    for (const c of CLAN_IDS) expect(clanRolesOf(c)).toHaveLength(15)
    expect(clanArtId('cinder', 'torch3')).toBe('cinder_torch3')
    expect(clanArtId(null, 'torch3')).toBe(`${DEFAULT_CLAN}_torch3`)
    expect(clanArtId('delve', 'smudge_torch3')).toBe('smudge_torch3')
    expect(clanArtId('cinder', 'fighter')).toBe('fighter')
  })

  it('keeps the plain strip’s frame count, so the walk cycle carries the parts frame by frame', async () => {
    for (const r of CLAN_WALK_ROLES) {
      const plain = r.replace(/^[a-z]+_/, '')
      const a = await sharp(join(PACK, `${plain}.png`)).metadata()
      const b = await sharp(join(PACK, `${r}.png`)).metadata()
      expect(b.width, r).toBe(a.width)
      expect(b.height! - a.height!, r).toBe(18)
    }
  })

  it('uses only colours the pack already ships (the CC0 palette test, offline)', async () => {
    const opaque = async (file: string) => {
      const { data } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      const out = new Set<number>()
      for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 200) out.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2])
      return out
    }
    const pack = new Set<number>()
    for (const dir of ['sprites/tinyswords', 'ui/tinyswords', 'fx/tinyswords', 'deco/tinyswords']) {
      const abs = join(ROOT, 'public', 'assets', dir)
      if (!existsSync(abs)) continue
      for (const f of readdirSync(abs).filter((f) => f.endsWith('.png') && !isClanRole(f.slice(0, -4)))) for (const c of await opaque(join(abs, f))) pack.add(c)
    }
    for (const r of roles) {
      const alien = [...(await opaque(join(PACK, `${r}.png`)))].filter((c) => !pack.has(c))
      expect(alien.map((c) => '#' + c.toString(16).padStart(6, '0')), r).toEqual([])
    }
  })
})

describe('no drawing path reaches a plain goblin strip', () => {
  const SRC = join(ROOT, 'src')
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.(tsx?|css|html)$/.test(e.name) ? [join(dir, e.name)] : []))

  it('ships no plain goblin as a runtime role, so nothing can fetch, precache or draw one', async () => {
    const { ALL_ROLES, packRoles, themeAssetPaths } = await import('../src/game/render/sprites')
    const { ANIM_FRAMES } = await import('../src/game/render/anim')
    const { THEMES, DEFAULT_THEME } = await import('../src/game/render/themes')
    for (const r of PLAIN_GOBLIN_ROLES) {
      expect(ALL_ROLES, r).not.toContain(r)
      expect(ANIM_FRAMES[r], r).toBeUndefined()
      for (const pack of ['tinyswords', 'fieldwatch']) expect(packRoles(pack), `${pack}/${r}`).not.toContain(r)
      for (const t of Object.values(THEMES)) expect(themeAssetPaths(t).some((f) => f.endsWith(`/${r}.png`)), `${t.id}: ${r}`).toBe(false)
    }
    // The default clan ships with the boot (and the offline install); the rest load per run.
    const boot = themeAssetPaths(THEMES[DEFAULT_THEME])
    for (const r of clanRolesOf(DEFAULT_CLAN)) expect(boot, r).toContain(`assets/sprites/tinyswords/${r}.png`)
    for (const c of CLAN_IDS.filter((c) => c !== DEFAULT_CLAN)) for (const r of clanRolesOf(c)) expect(boot, r).not.toContain(`assets/sprites/tinyswords/${r}.png`)
  })

  it('turns every goblin art id into a clan role (the one helper, clanArt.clanArtFor)', async () => {
    const { clanArtFor } = await import('../src/game/render/clanArt')
    for (const key of Object.keys(ENEMY_TYPES)) {
      const id = ENEMY_TYPES[key].id
      for (const clan of [null, ...CLAN_IDS]) {
        const role = clanArtFor(id, clan)
        expect(isClanRole(role), `${key} under ${clan}: ${role}`).toBe(true)
        expect(PLAIN_GOBLIN_ROLES, role).not.toContain(role)
      }
    }
  })

  it('names no plain goblin file and asks for no plain goblin role anywhere in the app', () => {
    const plain = new RegExp(`(?:sprites/tinyswords/|['"\`])(?:${PLAIN_GOBLIN_ROLES.join('|')})(?:\\.png)?['"\`]`)
    const offenders: string[] = []
    for (const f of files(SRC)) {
      const text = readFileSync(f, 'utf8')
      // Drawing calls with a literal goblin role.
      for (const m of text.matchAll(/(?:getSprite|spriteFor|artFor)\(([^)]*)\)/g)) if (plain.test(m[1])) offenders.push(`${f}: ${m[0]}`)
      if (/assets\/sprites\/tinyswords\/(?:torch|tnt|barrel)\d/.test(text)) offenders.push(`${f}: a plain goblin file path`)
    }
    expect(offenders).toEqual([])
  })

  it('reads the plain goblin files only to bake them (and to harvest them from the CC0 build)', () => {
    const SCRIPTS = join(ROOT, 'scripts')
    const readers = readdirSync(SCRIPTS)
      .filter((f) => /\.(ts|mjs)$/.test(f))
      .filter((f) => {
        const text = readFileSync(join(SCRIPTS, f), 'utf8')
        // A plain goblin file named literally, or a goblin role read straight off the pack folder.
        return /(?<![a-z]_)\b(?:torch|tnt|barrel)[1-5](?:_walk)?\.png|\$\{(?:SPR|PACK)\}\/(?:torch|tnt|barrel)|join\(PACK, `\$\{srcName\}\.png`\)/.test(text)
      })
    // (gen-placeholder-pack.ts WRITES the fieldwatch blocking pass's torch1, which no role declares.)
    for (const f of readers) expect(['enemy-clans.ts', 'harvest-cc0.ts', 'gen-placeholder-pack.ts'], f).toContain(f)
    expect(readers).toContain('enemy-clans.ts')
    // The brand scene's goblin column is a clan's (`brand.ts` `SCENE_CLAN`).
    expect(readFileSync(join(SCRIPTS, 'brand.ts'), 'utf8')).toMatch(/\$\{SPR\}\/\$\{SCENE_CLAN\}_\$\{id\}_walk\.png/)
  })
})
