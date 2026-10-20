import { describe, expect, it } from 'vitest'
import { COMPANY_IDS } from '../src/game/data/companies'
import { FUSIONS } from '../src/game/data/fusions'
import { FIRST_MAP, legacyPosts } from '../src/game/data/maps'
import { classicHero } from '../src/game/data/sentinels'
import {
  ALL_SKILLS,
  CHARTER_SKILLS,
  FUSED_SKILLS,
  isCardId,
  isFusedId,
  isSkillId,
  RANDOM_UNLOCK_SKILLS,
  SIGNATURE_SKILLS,
  skillById,
  skillHeadline,
  skillModsOf,
  STARTER_SKILLS,
} from '../src/game/data/skills'
import { generateEncounter } from '../src/game/data/waves'
import { computeCombat } from '../src/game/engine/combat'
import { GameEngine, TICK } from '../src/game/engine/engine'
import { applyXp, xpToReach } from '../src/game/engine/leveling'
import { cardFusions, fusedParts, heldFusions, recipeFor, recipesWith } from '../src/game/run/fusion'
import { fusionChoices, MAX_SKILLS, skillOffer, slotsFull, takeFusion, takeSkill } from '../src/game/run/skills'
import { migrateMeta, META_VERSION } from '../src/state/metaStore'
import type { EffectMods, Sentinel, WaveDef } from '../src/game/types'

/**
 * Skill fusion (Oct 2026, `docs/SKILL_FUSION.md`): the recipes, the rules a
 * milestone fuses by (both paths), the saves, and every twist in the engine.
 */

const hero = (skills: string[], level = 5, skillPicks = 0): Sentinel => ({ ...classicHero('rogue'), id: 'h-fz', level, skills, skillPicks })
/** A pool that is the whole library, so any offer can hold any card. */
const POOL = ALL_SKILLS.map((k) => k.id)
/** A seed whose level-5 offer, for a hero holding `held`, includes `want` (searched, deterministic). */
function seedOffering(h: Sentinel, want: string, pool: readonly string[] = POOL): number {
  for (let seed = 1; seed < 5000; seed++) if (skillOffer(h, pool, seed).some((k) => k.id === want)) return seed
  throw new Error(`no seed offers ${want}`)
}

describe('the recipes (data/fusions.ts)', () => {
  it('fifteen, each two distinct library cards, ids unique and never a library id', () => {
    expect(FUSIONS.length).toBe(15)
    expect(new Set(FUSIONS.map((f) => f.id)).size).toBe(FUSIONS.length)
    for (const f of FUSIONS) {
      expect(f.id.startsWith('fz_')).toBe(true)
      expect(isCardId(f.id)).toBe(false)
      expect(f.parts[0]).not.toBe(f.parts[1])
      for (const p of f.parts) expect(isCardId(p), `${f.name}: ${p}`).toBe(true)
    }
    // No pair twice.
    const pairs = FUSIONS.map((f) => [...f.parts].sort().join('+'))
    expect(new Set(pairs).size).toBe(pairs.length)
  })

  it('a fusion is its higher part’s level and one of its parts’ companies', () => {
    for (const f of FUSIONS) {
      const [a, b] = f.parts.map((id) => skillById(id)!)
      expect(f.level).toBe(Math.max(a.level, b.level))
      expect([a.company, b.company]).toContain(f.company)
    }
  })

  it('parts are starters or common unlocks — never a signature or a feat card — and each in at most three recipes', () => {
    const open = new Set([...STARTER_SKILLS, ...RANDOM_UNLOCK_SKILLS])
    const signatures = new Set(Object.values(SIGNATURE_SKILLS))
    for (const f of FUSIONS) {
      for (const p of f.parts) {
        expect(open.has(p), p).toBe(true)
        expect(signatures.has(p)).toBe(false)
        expect(skillById(p)!.feat).toBeUndefined()
      }
    }
    for (const k of ALL_SKILLS) expect(recipesWith(k.id).length, k.name).toBeLessThanOrEqual(3)
  })

  it('every company has three fusions', () => {
    for (const c of COMPANY_IDS) expect(FUSIONS.filter((f) => f.company === c).length, c).toBe(3)
  })

  it('the three Level 1 starters pair three ways: a first run meets a fusion at its first milestone', () => {
    const l1 = STARTER_SKILLS.filter((id) => skillById(id)!.level === 1)
    expect(l1.length).toBe(3)
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(recipeFor(l1[i], l1[j]), `${l1[i]} + ${l1[j]}`).toBeDefined()
  })

  it('every twist is a different rule (a fusion is a new skill type, not bigger numbers)', () => {
    const keys = FUSIONS.map((f) => Object.keys(f.mods).sort().join(','))
    expect(new Set(keys).size).toBe(FUSIONS.length)
    // And every twist has a rule no library card grants.
    const libraryKeys = new Set(ALL_SKILLS.flatMap((k) => Object.keys(k.mods)))
    for (const f of FUSIONS) expect(Object.keys(f.mods).some((k) => !libraryKeys.has(k)), f.name).toBe(true)
  })

  it('copy: the sentence and the twist are each one line of at most 80 characters', () => {
    for (const f of FUSIONS) {
      expect(f.desc.length, f.desc).toBeLessThanOrEqual(80)
      expect(f.twist.length, f.twist).toBeLessThanOrEqual(80)
      expect(f.desc.endsWith('.')).toBe(true)
      expect(f.twist.endsWith('.')).toBe(true)
    }
  })

  it('fusions are in no pool, unlock list, starter list or signature: they come only from fusing', () => {
    const ids = new Set(FUSIONS.map((f) => f.id))
    for (const list of [ALL_SKILLS.map((k) => k.id), STARTER_SKILLS, RANDOM_UNLOCK_SKILLS, CHARTER_SKILLS, Object.values(SIGNATURE_SKILLS)]) {
      expect(list.some((id) => ids.has(id))).toBe(false)
    }
  })
})

describe('recipe lookup (run/fusion.ts)', () => {
  it('finds a recipe in either order, and nothing else', () => {
    expect(recipeFor('quick_hands', 'keen_eye')?.id).toBe('fz_thousand_cuts')
    expect(recipeFor('keen_eye', 'quick_hands')?.id).toBe('fz_thousand_cuts')
    expect(recipeFor('quick_hands', 'quick_hands')).toBeUndefined()
    expect(recipeFor('quick_hands', 'bulwark')).toBeUndefined()
    expect(recipeFor('quick_hands', 'nonsense')).toBeUndefined()
  })

  it('no fusion of fusions: a fused skill is never a part', () => {
    for (const f of FUSED_SKILLS) {
      for (const k of [...ALL_SKILLS, ...FUSED_SKILLS]) expect(recipeFor(f.id, k.id)).toBeUndefined()
      expect(recipesWith(f.id)).toEqual([])
    }
    // A hero holding a fusion and a card is offered no fusion of the two.
    expect(heldFusions({ skills: ['fz_thousand_cuts', 'hard_hitter'] })).toEqual([])
    expect(cardFusions({ skills: ['fz_thousand_cuts'] }, [{ id: 'hard_hitter' }]).size).toBe(0)
  })

  it('a fused skill is its two parts and then its twist (skillModsOf)', () => {
    const f = FUSED_SKILLS.find((x) => x.id === 'fz_thousand_cuts')!
    expect(skillModsOf({ skills: [f.id] })).toEqual([skillById('quick_hands')!.mods, skillById('keen_eye')!.mods, f.mods])
    // So the hero's numbers are the parts' to the decimal.
    const parts = computeCombat(hero(['quick_hands', 'keen_eye']))
    const fused = computeCombat(hero([f.id]))
    expect(fused.dps).toBeCloseTo(parts.dps, 9)
    expect(fused.range).toBeCloseTo(parts.range, 9)
    expect(fused.mods.ricochet).toBe(0.6)
    // Pictured by its twist; labelled a fusion.
    expect(skillHeadline(f)).toEqual({ icon: 'crit', label: 'Fusion' })
  })
})

describe('the milestone (run/skills.ts)', () => {
  it('(a) annotates a card that fuses with a held skill, and leaves the offer dealt as it was', () => {
    const h = hero(['quick_hands'])
    const seed = seedOffering(h, 'keen_eye')
    const offer = skillOffer(h, POOL, seed)
    const notes = cardFusions(h, offer)
    expect(notes.get('keen_eye')).toEqual([{ with: 'quick_hands', into: skillById('fz_thousand_cuts') }])
    for (const k of offer) if (k.id !== 'keen_eye' && !recipeFor('quick_hands', k.id)) expect(notes.has(k.id)).toBe(false)
  })

  it('(a) taking a card that fuses fuses at once: the held slot becomes the fusion, the card takes none', () => {
    const h = hero(['quick_hands'])
    const seed = seedOffering(h, 'keen_eye')
    const next = takeSkill(h, 'keen_eye', POOL, seed)!
    expect(next.skills).toEqual(['fz_thousand_cuts'])
    expect(next.skillPicks).toBe(1)
  })

  it('(a) works when the slots are full: no swap, the drop is ignored', () => {
    // Three held, a fourth that fuses with the second.
    const h = hero(['bounty', 'quick_hands', 'cleave'], 15, 2)
    expect(slotsFull(h)).toBe(true)
    // Level 3 offer: Berserk fuses with Bloodrush — use a held pair that meets Level 3.
    const r = hero(['bounty', 'bloodrush', 'cleave'], 15, 2)
    const seed = seedOffering(r, 'berserk')
    const next = takeSkill(r, 'berserk', POOL, seed, 'bounty')!
    expect(next.skills).toEqual(['bounty', 'fz_red_mist', 'cleave'])
    expect(next.skills!.length).toBe(MAX_SKILLS)
    expect(h.skills!.length).toBe(MAX_SKILLS)
  })

  it('(a) a card that fuses with two held skills fuses with the partner chosen (the first by default)', () => {
    // Hard Hitter fuses with Quick Hands (Relentless) and with Cleave (Sunder).
    const h = hero(['quick_hands', 'cleave'], 5, 0)
    const seed = seedOffering(h, 'hard_hitter')
    expect(cardFusions(h, skillOffer(h, POOL, seed)).get('hard_hitter')!.map((w) => w.into.id)).toEqual(['fz_relentless', 'fz_sunder'])
    expect(takeSkill(h, 'hard_hitter', POOL, seed)!.skills).toEqual(['fz_relentless', 'cleave'])
    expect(takeSkill(h, 'hard_hitter', POOL, seed, null, 'cleave')!.skills).toEqual(['quick_hands', 'fz_sunder'])
    // An unknown partner falls back to the first.
    expect(takeSkill(h, 'hard_hitter', POOL, seed, null, 'bulwark')!.skills).toEqual(['fz_relentless', 'cleave'])
  })

  it('(b) a pair already held is offered as a fuse, which settles the milestone and frees a slot', () => {
    const h = hero(['poison_tips', 'venom_spit', 'bounty'], 15, 2)
    expect(fusionChoices(h).map((f) => f.into.id)).toEqual(['fz_plaguebearer'])
    const next = takeFusion(h, 'fz_plaguebearer')!
    expect(next.skills).toEqual(['fz_plaguebearer', 'bounty'])
    expect(next.skillPicks).toBe(3)
    expect(slotsFull(next)).toBe(false)
  })

  it('(b) is refused with no milestone owed, a pair not held, or a junk id', () => {
    expect(takeFusion(hero(['poison_tips', 'venom_spit'], 9, 1), 'fz_plaguebearer')).toBeNull()
    expect(takeFusion(hero(['poison_tips', 'bounty'], 10, 1), 'fz_plaguebearer')).toBeNull()
    expect(takeFusion(hero(['poison_tips', 'venom_spit'], 10, 1), 'nonsense')).toBeNull()
    expect(fusionChoices(hero(['poison_tips', 'venom_spit'], 9, 1))).toEqual([])
  })

  it('a hero holding a fusion is never dealt its parts again; every other hero is dealt exactly as before', () => {
    const fused = hero(['fz_thousand_cuts'], 10, 1)
    expect(fusedParts(fused)).toEqual(['quick_hands', 'keen_eye'])
    for (let seed = 1; seed < 200; seed++) {
      const ids = skillOffer({ ...fused, level: 5, skillPicks: 0 }, POOL, seed).map((k) => k.id)
      expect(ids).not.toContain('quick_hands')
      expect(ids).not.toContain('keen_eye')
    }
    // A plain hero's offer: the same as the hash always dealt (spot-check vs the raw draw).
    const plain = hero(['bounty'])
    const a = skillOffer(plain, POOL, 42).map((k) => k.id)
    const b = skillOffer({ ...plain }, POOL, 42).map((k) => k.id)
    expect(a).toEqual(b)
    expect(a.length).toBe(3)
  })

  it('a fused hero frees a slot that the next milestone fills', () => {
    const h = hero(['quick_hands'])
    const at5 = takeSkill(h, 'keen_eye', POOL, seedOffering(h, 'keen_eye'))!
    expect(at5.skills!.length).toBe(1)
    const at10 = { ...at5, level: 10 }
    const card = skillOffer(at10, POOL, 7).find((k) => !cardFusions(at10, [k]).size)!
    const after = takeSkill(at10, card.id, POOL, 7)!
    expect(after.skills).toEqual(['fz_thousand_cuts', card.id])
  })
})

describe('saves and validators', () => {
  it('fused ids pass isSkillId and skillById; pools and unlocks take library cards only; junk is refused', () => {
    for (const f of FUSED_SKILLS) {
      expect(isSkillId(f.id)).toBe(true)
      expect(isFusedId(f.id)).toBe(true)
      expect(isCardId(f.id)).toBe(false)
      expect(skillById(f.id)?.parts).toEqual(f.parts)
    }
    for (const junk of ['fz_', 'fz_nonsense', '', 3, null, undefined, {}]) {
      expect(isSkillId(junk)).toBe(false)
      expect(isFusedId(junk)).toBe(false)
    }
    // The meta save's unlocked cards never keep a fused id.
    expect(migrateMeta({ skills: ['fz_thousand_cuts', 'bounty'] }, META_VERSION).skills).toEqual(['bounty'])
  })

  it('discoveries round-trip through the meta save: known fused ids, each once, in the order found', () => {
    const saved = migrateMeta({ codex: { enemies: [], relics: [], felled: {}, clans: [], fusions: ['fz_sunder', 'nonsense', 'fz_sunder', 'bounty', 'fz_red_mist', 7] } }, META_VERSION)
    expect(saved.codex.fusions).toEqual(['fz_sunder', 'fz_red_mist'])
    const again = migrateMeta(JSON.parse(JSON.stringify(saved)), META_VERSION)
    expect(again.codex.fusions).toEqual(['fz_sunder', 'fz_red_mist'])
    // A save from before fusion: none found.
    expect(migrateMeta({ codex: { enemies: ['torch1'], relics: [], felled: {} } }, META_VERSION).codex.fusions).toEqual([])
    expect(migrateMeta({}, 15).codex.fusions).toEqual([])
  })
})

/* ------------------------------------------------------------- the engine */

const P = legacyPosts(FIRST_MAP.id)
function fight(team: { sentinel: Sentinel; slotId: string }[], wave: WaveDef, seed = 3, hpMult = 1) {
  const engine = new GameEngine({ map: FIRST_MAP, wave, placedSentinels: team, baseHp: 80, maxBaseHp: 80, seed, enemyHpMult: hpMult })
  for (let i = 0; i < 60 * 240 && engine.status === 'running'; i++) engine.step(TICK)
  return engine
}
const withMods = (s: Sentinel, mods: EffectMods): Sentinel => ({ ...s, mutations: [{ id: 'm', key: 'test', name: 'test', desc: '', rarity: 'mythic', downside: '', mods }] })
const grown = (look: 'fighter' | 'rogue' | 'mystic', skills: string[] = [], level = 12): Sentinel => ({ ...applyXp(classicHero(look), xpToReach(level)), skills })
const long = () => generateEncounter(9, 'normal', { subWaves: false })
const short = () => generateEncounter(3, 'normal', { subWaves: false })
const dealt = (e: GameEngine) => e.sentinels[0].damageDealt
const procs = (e: GameEngine) => e.behaviourStats.fusionProcs
const solo = (s: Sentinel) => [{ sentinel: s, slotId: P.s3 }]

/** The fused hero against the same hero holding both parts: same everything else. */
function versus(look: 'fighter' | 'rogue' | 'mystic', fusionId: string, wave: WaveDef, hpMult = 1) {
  const f = skillById(fusionId)!
  const parts = fight(solo(grown(look, [...f.parts!])), wave, 3, hpMult)
  const fused = fight(solo(grown(look, [fusionId])), wave, 3, hpMult)
  return { parts, fused }
}

describe('the twists (engine)', () => {
  it('a hero holding both parts fights exactly as a hero whose twist is switched off', () => {
    // The parts' mods are the fusion's minus its twist, so a fusion with no
    // twist is the pair, shot for shot.
    for (const f of FUSED_SKILLS) {
      const pair = grown('rogue', [...f.parts])
      const bare = fight(solo(pair), short())
      const again = fight(solo(withMods(grown('rogue', [...f.parts]), {})), short())
      expect(dealt(again)).toBe(dealt(bare))
    }
  })

  it('ricochet (Thousand Cuts): crits bounce on, for more damage', () => {
    const { parts, fused } = versus('rogue', 'fz_thousand_cuts', long())
    expect(procs(parts)).toBe(0)
    expect(procs(fused)).toBeGreaterThan(0)
    expect(dealt(fused)).toBeGreaterThan(dealt(parts))
  })

  it('focus (Relentless): hits in a row on one enemy land harder', () => {
    const { parts, fused } = versus('rogue', 'fz_relentless', long(), 3)
    expect(dealt(fused)).toBeGreaterThan(dealt(parts))
  })

  it('first strike (Bushwhack): the first hit on each enemy deals double', () => {
    const { parts, fused } = versus('rogue', 'fz_bushwhack', long())
    expect(dealt(fused)).toBeGreaterThan(dealt(parts))
  })

  it('overkill (Sunder): a killing hit carries its excess on', () => {
    const { parts, fused } = versus('fighter', 'fz_sunder', short())
    expect(procs(parts)).toBe(0)
    expect(procs(fused)).toBeGreaterThan(0)
  })

  it('arc carry (Plague Spark): its jumps poison what they hit', () => {
    const { parts, fused } = versus('mystic', 'fz_plague_spark', long())
    expect(dealt(fused)).toBeGreaterThan(dealt(parts))
  })

  it('freeze (Rimecut): crits stop slowed enemies, with no extra draw', () => {
    const { parts, fused } = versus('rogue', 'fz_rimecut', long())
    expect(procs(parts)).toBe(0)
    expect(procs(fused)).toBeGreaterThan(0)
  })

  it('held burst (Crushing Grip): a held enemy that dies bursts on those near it', () => {
    const { parts, fused } = versus('fighter', 'fz_crushing_grip', short())
    expect(procs(parts)).toBe(0)
    expect(procs(fused)).toBeGreaterThan(0)
  })

  it('contagion (Plaguebearer): its poison spreads from the dead', () => {
    const { parts, fused } = versus('rogue', 'fz_plaguebearer', short())
    expect(parts.behaviourStats.burnSpreads).toBe(0)
    expect(fused.behaviourStats.burnSpreads).toBeGreaterThan(0)
  })

  it('death burst (Cinderburst): enemies it set burning burst when they die', () => {
    const { parts, fused } = versus('fighter', 'fz_cinderburst', short())
    expect(procs(parts)).toBe(0)
    expect(procs(fused)).toBeGreaterThan(0)
  })

  it('fan (Hail of Arrows): every 3rd attack also shoots two more', () => {
    const { parts, fused } = versus('rogue', 'fz_hail_of_arrows', long())
    expect(dealt(fused)).toBeGreaterThan(dealt(parts))
    // The same attacks: the fan's shots are extra arrows, not extra attacks.
    expect(fused.sentinels[0].shots).toBeGreaterThan(0)
  })

  it('execute refund (Coup de Grâce): an execution readies the next attack', () => {
    const { parts, fused } = versus('rogue', 'fz_coup_de_grace', short(), 6)
    expect(fused.sentinels[0].shots).toBeGreaterThan(parts.sentinels[0].shots)
  })

  it('shatter (Shatterglass): hits on slowed enemies splinter to those near', () => {
    const { parts, fused } = versus('mystic', 'fz_shatterglass', long())
    expect(procs(parts)).toBe(0)
    expect(procs(fused)).toBeGreaterThan(0)
  })

  it('crit aura (Rallying Standard): heroes near it crit more; out of reach, nothing', () => {
    const near = new GameEngine({
      map: FIRST_MAP,
      wave: short(),
      placedSentinels: [
        { sentinel: grown('fighter', ['fz_rallying_standard']), slotId: P.s3 },
        { sentinel: { ...grown('rogue'), id: 'ally' }, slotId: P.s3 === P.s4 ? P.s2 : P.s4 },
      ],
      baseHp: 50,
      maxBaseHp: 50,
      seed: 3,
    })
    near.step(TICK)
    expect(near.sentinels[0].critBuff).toBeCloseTo(0.1, 9)
    const far = near.sentinels[1]
    const d = Math.hypot(far.pos.x - near.sentinels[0].pos.x, far.pos.y - near.sentinels[0].pos.y)
    expect(far.critBuff).toBeCloseTo(d <= 130 ? 0.1 : 0, 9)
    // A team with no aura has none.
    const plain = new GameEngine({ map: FIRST_MAP, wave: short(), placedSentinels: solo(grown('rogue', ['hold_fast', 'banner_bearer'])), baseHp: 50, maxBaseHp: 50, seed: 3 })
    plain.step(TICK)
    expect(plain.sentinels[0].critBuff).toBe(0)
  })

  it('quake (Anvilfall): every 4th attack shakes those around its target', () => {
    const { parts, fused } = versus('fighter', 'fz_anvilfall', long(), 2)
    expect(procs(parts)).toBe(0)
    expect(procs(fused)).toBeGreaterThan(0)
    expect(dealt(fused)).toBeGreaterThan(dealt(parts))
  })

  it('frenzy (Red Mist): kills this wave stack attack speed', () => {
    const { parts, fused } = versus('rogue', 'fz_red_mist', short())
    expect(fused.sentinels[0].shots).toBeGreaterThan(parts.sentinels[0].shots)
  })
})

describe('discovery and the beat (UI models)', () => {
  it('the Codex lists every recipe: its parts and a "?" until made, then its name and twist', async () => {
    const { codexModel, FUSION_FOUND, FUSION_HOW } = await import('../src/ui/shell/codex/codexModel')
    const codex = { enemies: [], relics: [], felled: {}, fusions: ['fz_sunder'] }
    const skills = codexModel({ achievements: {}, codex, skills: [], staged: false })[1]
    const sec = skills.sections.find((s) => s.title === 'Fusions')!
    expect(sec.entries).toHaveLength(FUSIONS.length)
    expect(sec.have).toBe(1)
    const sunder = sec.entries.find((e) => e.id === 'fusion:fz_sunder')!
    expect(sunder.locked).toBe(false)
    expect(sunder.name).toBe('Sunder')
    expect(sunder.fusion?.twist).toBe(skillById('fz_sunder')!.twist)
    const cuts = sec.entries.find((e) => e.id === 'fusion:fz_thousand_cuts')!
    expect(cuts.locked).toBe(true)
    expect(cuts.name).toBe('???')
    expect(cuts.does).toBe('')
    expect(cuts.fusion?.twist).toBeUndefined()
    expect(cuts.fusion?.parts.map((p) => p.name)).toEqual(['Quick Hands', 'Keen Eye'])
    expect(cuts.how).toBe(FUSION_HOW)
    expect(sunder.how).toBe(FUSION_FOUND)
    // Never a spoiler: no locked card names its result.
    for (const e of sec.entries.filter((x) => x.locked)) for (const f of FUSIONS) expect(e.how.includes(f.name)).toBe(false)
  })

  it('the fuse beat: about a second on Full, lighter on Light, and still under reduced motion', async () => {
    const { fuseBeatPlan } = await import('../src/ui/shell/fuseBeat')
    const full = fuseBeatPlan('full')
    const light = fuseBeatPlan('light')
    const off = fuseBeatPlan('off')
    expect(full.moves && light.moves).toBe(true)
    expect(full.flashMs).toBeGreaterThan(0)
    expect(light.flashMs).toBe(0)
    expect(light.slideMs).toBeLessThan(full.slideMs)
    expect(full.totalMs).toBeLessThanOrEqual(1000)
    expect(full.slideMs + full.flashMs + full.settleMs).toBeLessThanOrEqual(full.totalMs)
    expect(light.slideMs + light.settleMs).toBeLessThanOrEqual(light.totalMs)
    expect(off).toMatchObject({ moves: false, slideMs: 0, flashMs: 0, settleMs: 0 })
  })
})
