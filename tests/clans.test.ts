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
import { isBenchField, roadClan, runClan, sovereignClan } from '../src/game/run/clans'
import { CLAN_ART } from '../src/game/render/enemyClans.generated'

const ROOT = resolve(import.meta.dirname, '..')
const PACK = join(ROOT, 'public', 'assets', 'sprites', 'tinyswords')
const GEN = 'gen.balanced.1744362757'

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
    expect(enemyName({ ...colossus, name: `${colossus.name} (half)` }, 'hexmoon')).toBe('The Lunar Vault (half)')
    expect(enemyName(ENEMY_TYPES.tnt2_warded, 'hexmoon')).toBe('Hex Bomber · Warded')
  })
})

describe('every surface names through enemyName', () => {
  it('the wave preview line-up and the enemy card name and dress a goblin as the road does', async () => {
    const { lineUp } = await import('../src/ui/shell/enemyQueue')
    const { enemyCardData } = await import('../src/ui/shell/enemyFacts')
    const q = [{ typeId: 'tnt2_warded', group: 0 }, { typeId: 'torch5', group: 0 }]
    expect(lineUp(q).map((e) => [e.name, e.art])).toEqual([
      ['Bomber · Warded', 'tnt2'],
      ['Warlord Grukk', 'torch5'],
    ])
    expect(lineUp(q, 'smudge').map((e) => [e.name, e.art])).toEqual([
      ['Paint Bomber · Warded', 'smudge_tnt2'],
      ['Old Gesso', 'smudge_torch5'],
    ])
    const knowledge = { kind: 'barrel3', level: 'met', felled: 1, need: 5 } as const
    expect(enemyCardData('barrel3_bearer', { wave: null, hpMult: 1, laneLength: 0, knowledge, clan: 'silkcut' })!.name).toBe('Veil Bearer')
    expect(enemyCardData('barrel3_bearer', { wave: null, hpMult: 1, laneLength: 0, knowledge })!.name).toBe('Shieldbearer')
  })

  it('an older save meets the clans of the roads it has ridden; a new one records the clan it fights', async () => {
    const { migrateMeta } = await import('../src/state/metaStore')
    expect(migrateMeta({ standing: { spice: 40, art: 0, metals: 9, silk: 0, scrolls: 0 }, codex: { enemies: ['torch1'] } }, 20).codex.clans).toEqual(['cinder', 'delve'])
    expect(migrateMeta({ codex: { enemies: [], clans: ['hexmoon', 'bogus', 'hexmoon'] } }, 20).codex.clans).toEqual(['hexmoon'])
  })
})

describe('which clan raids a road: a pure rule', () => {
  it('a company road deals its company’s clan in every act; a bench deals none', () => {
    for (const company of COMPANY_IDS)
      for (let act = 1; act <= 4; act++) expect(roadClan({ company }, 12345, act, `${GEN}~h1-tall`)).toBe(CLAN_OF_COMPANY[company])
    expect(roadClan({ company: 'spice' }, 1, 1, 'greenline')).toBeNull()
    expect(roadClan({ company: 'spice' }, 1, 1, 'kilnroad-tall')).toBeNull()
    expect(roadClan(null, 1, 1, GEN)).toBeNull()
    expect(isBenchField('greenline')).toBe(true)
    expect(isBenchField(GEN)).toBe(false)
  })

  it('the Sovereign Route mixes clans by act: a hash of (seed, act), never the act before’s', () => {
    const seen = new Set<string>()
    for (let seed = 1; seed < 400; seed++) {
      let prev: string | null = null
      for (let act = 1; act <= 4; act++) {
        const c = sovereignClan(seed * 7919, act)
        // Pure: the same inputs, the same clan — and the road helper agrees.
        expect(sovereignClan(seed * 7919, act)).toBe(c)
        expect(roadClan({ company: null, charter: true }, seed * 7919, act, GEN)).toBe(c)
        expect(c).not.toBe(prev)
        prev = c
        seen.add(c)
      }
    }
    expect([...seen].sort()).toEqual([...CLAN_IDS].sort())
  })

  it('reads the run’s act and field, nothing else (no run stream is touched)', () => {
    const st = { contract: { company: null, charter: true }, runSeed: 99, fieldAct: 3, battleMap: { id: GEN } }
    expect(runClan(st)).toBe(sovereignClan(99, 3))
    expect(runClan({ ...st, contract: { company: 'metals' } })).toBe('delve')
    expect(runClan({ ...st, battleMap: { id: 'greenline' } })).toBeNull()
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
    expect(clanArtId(null, 'torch3')).toBe('torch3')
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
