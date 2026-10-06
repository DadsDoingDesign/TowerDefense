import { describe, expect, it } from 'vitest'
import {
  ALL_SKILLS,
  EVOLUTION_TO_SKILL,
  FEAT_SKILLS,
  PERK_TO_SKILL,
  RANDOM_UNLOCK_SKILLS,
  COMBO_SKILLS,
  skillById,
  STARTER_SKILLS,
} from '../src/game/data/skills'
import { ALL_NODES } from '../src/game/data/archetypeTree'
import {
  bumpOffered,
  migrateGrowth,
  nextMilestone,
  pendingMilestone,
  recruitSkill,
  skillOffer,
  takeBump,
  takeSkill,
} from '../src/game/run/skills'
import { difficultyRules, LAST_LEG, legMult, MAX_DIFFICULTY, rollUnlock, skillPoolFor, watchLevelFor, watchXpToReach } from '../src/game/run/watch'
import { standingXpFor } from '../src/game/run/standing'
import { classicHero } from '../src/game/data/sentinels'
import { applyXp, xpToReach } from '../src/game/engine/leveling'
import { computeCombat } from '../src/game/engine/combat'
import { isMelee } from '../src/game/engine/melee'
import type { Archetype, Sentinel } from '../src/game/types'

const ALL_POOL = ALL_SKILLS.map((k) => k.id)
const at = (a: Archetype, level: number, extra: Partial<Sentinel> = {}): Sentinel => ({ ...applyXp(classicHero(a), xpToReach(level)), ...extra })

describe('the skill library (SK1)', () => {
  it('is 14 / 15 / 11 across the three levels, every id unique', () => {
    const by = (l: number) => ALL_SKILLS.filter((k) => k.level === l).length
    expect([by(1), by(2), by(3)]).toEqual([14, 15, 11])
    expect(new Set(ALL_SKILLS.map((k) => k.id)).size).toBe(ALL_SKILLS.length)
  })

  it('starts everyone with three universal skills at each level', () => {
    for (const l of [1, 2, 3]) {
      const s = ALL_SKILLS.filter((k) => k.starter && k.level === l)
      expect(s).toHaveLength(3)
    }
    expect(STARTER_SKILLS).toHaveLength(9)
  })

  it('splits the rest into random cards and feat cards, with no overlap', () => {
    expect(RANDOM_UNLOCK_SKILLS.length + Object.keys(FEAT_SKILLS).length + STARTER_SKILLS.length).toBe(ALL_SKILLS.length)
    for (const id of RANDOM_UNLOCK_SKILLS) expect(FEAT_SKILLS[id]).toBeUndefined()
  })

  it('says each skill in one sentence that ends in a full stop, and names its source', () => {
    for (const k of ALL_SKILLS) {
      expect(k.desc).toMatch(/^[A-Z].*\.$/)
      expect(k.desc.split('. ').length).toBe(1)
      expect(k.from.length).toBeGreaterThan(5)
      expect(k.desc).not.toMatch(/\btowers?\b/i)
    }
  })

  it('is open to anyone: no skill decides who swings, whatever it holds', () => {
    for (const a of ['rogue', 'mystic'] as const) {
      for (const k of ALL_SKILLS) {
        const h = { ...classicHero(a), skills: [k.id] }
        expect(isMelee(h), k.id).toBe(false)
      }
    }
  })

  it('maps every retired perk and every evolution to a real skill', () => {
    for (const id of Object.values(PERK_TO_SKILL)) expect(skillById(id)).toBeDefined()
    expect(Object.keys(PERK_TO_SKILL)).toHaveLength(27)
    for (const n of ALL_NODES.filter((n) => n.tier > 0)) {
      const k = skillById(EVOLUTION_TO_SKILL[n.id])
      expect(k, n.id).toBeDefined()
    }
  })

  it('folds a skill into combat exactly by its mods', () => {
    const base = classicHero('rogue')
    const a = computeCombat(base)
    const b = computeCombat({ ...base, skills: ['quick_hands'] })
    expect(b.rate / a.rate).toBeCloseTo(1.15, 5)
    const c = computeCombat({ ...base, skills: ['hard_hitter'] })
    expect(c.damage / a.damage).toBeCloseTo(1.15, 5)
  })
})

describe('milestones and offers', () => {
  const seed = 4242

  it('owes Level 1 at 5, Level 2 at 10, Level 3 at 15, in order', () => {
    expect(pendingMilestone(at('fighter', 4))).toBeNull()
    expect(pendingMilestone(at('fighter', 5))).toMatchObject({ level: 5, tier: 1 })
    expect(pendingMilestone(at('fighter', 12))).toMatchObject({ level: 5, tier: 1 })
    expect(pendingMilestone(at('fighter', 12, { skillPicks: 1 }))).toMatchObject({ level: 10, tier: 2 })
    expect(pendingMilestone(at('fighter', 20, { skillPicks: 3 }))).toBeNull()
    expect(nextMilestone({ skillPicks: 2 })).toMatchObject({ level: 15, tier: 3 })
  })

  it('offers three distinct skills of the tier that are not held, to anyone', () => {
    for (const a of ['fighter', 'rogue', 'mystic'] as const) {
      for (const picks of [0, 1, 2]) {
        const h = at(a, 16, { skillPicks: picks, skills: ['quick_hands'] })
        const offer = skillOffer(h, ALL_POOL, seed)
        expect(offer).toHaveLength(3)
        expect(new Set(offer.map((k) => k.id)).size).toBe(3)
        for (const k of offer) {
          expect(k.level).toBe(picks + 1)
          expect(k.id).not.toBe('quick_hands')
        }
      }
    }
  })

  it('is a pure function of the seed, the hero and the pool', () => {
    const h = at('mystic', 10, { skillPicks: 1 })
    expect(skillOffer(h, ALL_POOL, seed).map((k) => k.id)).toEqual(skillOffer({ ...h }, ALL_POOL, seed).map((k) => k.id))
    const seen = new Set<string>()
    for (let s = 0; s < 40; s++) seen.add(skillOffer(h, ALL_POOL, s).map((k) => k.id).join())
    expect(seen.size).toBeGreaterThan(3)
  })

  it('pads a thin offer with the stat bump, and offers the bump to a full hero', () => {
    const fresh = at('rogue', 5, { skills: ['keen_eye'] })
    expect(skillOffer(fresh, STARTER_SKILLS, seed)).toHaveLength(2)
    expect(bumpOffered(fresh, STARTER_SKILLS, seed)).toBe(true)
    const roomy = at('rogue', 5, { skills: ['keen_eye'] })
    expect(bumpOffered(roomy, ALL_POOL, seed)).toBe(false)
    const full = at('rogue', 15, { skills: ['keen_eye', 'long_shot', 'deadeye'], skillPicks: 2 })
    expect(bumpOffered(full, ALL_POOL, seed)).toBe(true)
  })

  it('takes a skill into a free slot, and swaps one out when full', () => {
    const h = at('fighter', 5, { skills: ['quick_hands'] })
    const pick = skillOffer(h, ALL_POOL, seed)[0].id
    const t = takeSkill(h, pick, ALL_POOL, seed)!
    expect(t.skills).toEqual(['quick_hands', pick])
    expect(t.skillPicks).toBe(1)
    expect(takeSkill(h, 'berserk', ALL_POOL, seed)).toBeNull()

    const full = at('fighter', 15, { skills: ['quick_hands', 'hard_hitter', 'heavy_blows'], skillPicks: 2 })
    const l3 = skillOffer(full, ALL_POOL, seed)[0].id
    expect(takeSkill(full, l3, ALL_POOL, seed)).toBeNull()
    expect(takeSkill(full, l3, ALL_POOL, seed, 'not_held')).toBeNull()
    const sw = takeSkill(full, l3, ALL_POOL, seed, 'hard_hitter')!
    expect(sw.skills).toEqual(['quick_hands', l3, 'heavy_blows'])
    expect(sw.skillPicks).toBe(3)
  })

  it('pays the bump by the milestone level, on the stat chosen', () => {
    const full = at('mystic', 15, { skills: ['quick_hands', 'hard_hitter', 'heavy_blows'], skillPicks: 2 })
    const b = takeBump(full, 'int', ALL_POOL, seed)!
    expect(b.stats.int - full.stats.int).toBe(8)
    expect(b.skillPicks).toBe(3)
    expect(takeBump(at('mystic', 5, { skills: ['keen_eye'] }), 'int', ALL_POOL, seed)).toBeNull()
  })
})

describe('hires', () => {
  it('gives a hire a Level 1 skill from the pool, by hash', () => {
    for (let i = 0; i < 20; i++) {
      const id = recruitSkill(9, `sent${i}`, ALL_POOL)!
      expect(skillById(id)!.level).toBe(1)
      expect(recruitSkill(9, `sent${i}`, ALL_POOL)).toBe(id)
    }
  })
})

describe('the classless rework’s combo skills', () => {
  it('are seven, spread over all three levels, each one sentence about itself only', () => {
    expect(COMBO_SKILLS).toHaveLength(7)
    const levels = new Set(COMBO_SKILLS.map((id) => skillById(id)!.level))
    expect([...levels].sort()).toEqual([1, 2, 3])
    for (const id of COMBO_SKILLS) {
      const k = skillById(id)!
      expect(RANDOM_UNLOCK_SKILLS).toContain(id)
      // Self-contained: no sentence names another piece or hints at a mix.
      expect(k.desc).not.toMatch(/\b(shield|sword|bow|wand|staff|dagger|with a|while holding|pairs?|combo|best with|for each hero)\b/i)
    }
  })

  it('say exactly what they do', () => {
    const desc = (id: string) => skillById(id)!.desc
    expect(desc('bounty')).toBe('Each kill it makes pays 1 more gold.')
    expect(desc('pin_down')).toBe('Its hits deal 30% more to enemies that are being held.')
    expect(desc('cold_snap')).toBe('Its hits deal 25% more to slowed enemies.')
    expect(desc('firebrand')).toBe('Its thorns set what it holds burning for 12 a second, for 3 seconds.')
    expect(desc('split_shot')).toBe('Its attacks pass through 1 more enemy.')
    expect(desc('momentum')).toBe('Attacks 15% faster for each enemy it is holding.')
    expect(desc('last_rites')).toBe('Every 5th kill it makes wins back 5% of the cargo.')
  })

  it('reach the combat profile exactly by their mods', () => {
    const h = classicHero('rogue')
    expect(computeCombat({ ...h, skills: ['split_shot'] }).mods.pierce).toBe(1)
    expect(computeCombat({ ...h, skills: ['bounty'] }).mods.goldPerKill).toBe(1)
    expect(computeCombat({ ...h, skills: ['last_rites'] }).mods.killMend).toEqual({ every: 5, hp: 1 })
    expect(computeCombat({ ...h, skills: ['momentum'] }).mods.rushPerHeld).toBe(0.15)
  })
})

describe('old saves: perks and evolutions become skills', () => {
  const stats = { str: 20, dex: 10, int: 5 }

  it('maps a fully grown Fighter, and turns the overflow into stat bumps', () => {
    const m = migrateGrowth({ archetype: 'fighter', level: 20, branchPath: ['fighter', 'warrior', 'berserker'], perks: ['f5_second_wind', 'warrior_cleave'], stats })
    expect(m.skills).toEqual(['hold_fast', 'heavy_blows', 'cleave'])
    // Berserker (level 20) had no slot left: a Level 3 bump on STR.
    expect(m.stats.str).toBe(28)
    expect(m.skillPicks).toBe(3)
  })

  it('keeps a choice the old hero still owed', () => {
    const m = migrateGrowth({ archetype: 'rogue', level: 16, branchPath: ['rogue', 'marksman'], perks: ['r5_ambush'], stats })
    expect(m.skills).toEqual(['charge', 'long_shot'])
    expect(m.skillPicks).toBe(2)
    expect(pendingMilestone({ level: 16, skillPicks: m.skillPicks })).toMatchObject({ level: 15 })
  })

  it('dedupes two sources of one skill into a bump', () => {
    const m = migrateGrowth({ archetype: 'mystic', level: 20, branchPath: ['mystic', 'cleric', 'templar'], perks: ['m5_frostbite', 'cleric_blessing'], stats })
    expect(m.skills).toEqual(['frostbite', 'blessing', 'rally'])
    expect(m.stats.int).toBe(5 + 8)
  })

  it('leaves a hero with nothing to migrate alone', () => {
    expect(migrateGrowth({ archetype: 'fighter', level: 3, branchPath: ['fighter'], stats })).toEqual({ skills: [], skillPicks: 0, stats })
  })
})

describe('the unlock curve, cards and the stake’s difficulty', () => {
  it('prices a contract in standing XP (the Watch XP formula, paid to one company)', () => {
    expect(standingXpFor({ depth: 5, kills: 150, delivered: false })).toBe(75 + 15)
    expect(standingXpFor({ depth: 12, kills: 400, delivered: true })).toBe(180 + 40 + 60)
  })

  it('levels fast early and slower late', () => {
    expect(watchLevelFor(0)).toBe(1)
    expect(watchLevelFor(80)).toBe(2)
    expect(watchXpToReach(3) - watchXpToReach(2)).toBe(100)
    expect(watchXpToReach(21) - watchXpToReach(20)).toBe(460)
    expect(watchXpToReach(21)).toBe(5400)
  })

  it('rolls only locked random cards, deterministically, until there are none', () => {
    const got: string[] = []
    for (let i = 0; i < RANDOM_UNLOCK_SKILLS.length; i++) {
      const c = rollUnlock(got, 1, i)!
      expect(got).not.toContain(c)
      expect(RANDOM_UNLOCK_SKILLS).toContain(c)
      expect(rollUnlock(got, 1, i)).toBe(c)
      got.push(c)
    }
    expect(rollUnlock(got, 1, 99)).toBeNull()
  })

  it('pools the starters, the unlocked cards and the earned feat cards', () => {
    expect(skillPoolFor([], () => false)).toEqual([...STARTER_SKILLS].sort((a, b) => ALL_POOL.indexOf(a) - ALL_POOL.indexOf(b)))
    expect(skillPoolFor(['charge'], () => false)).toContain('charge')
    expect(skillPoolFor([], (f) => f === 'win_fighter')).toContain('warden_of_ash')
  })

  it('adds one elite an act and a stronger, greedier last leg per step', () => {
    expect(difficultyRules(0)).toEqual({ step: 0, startThreat: 1, leakMult: 1, lastLeg: 1, extraElites: 0 })
    expect(difficultyRules(3)).toMatchObject({ step: 3, startThreat: 1, leakMult: 1, extraElites: 3 })
    expect(difficultyRules(3).lastLeg).toBeCloseTo(1 + LAST_LEG[3], 6)
    expect(legMult(difficultyRules(3), 8)).toBe(1)
    expect(legMult(difficultyRules(3), 9)).toBeCloseTo(1 + LAST_LEG[3], 6)
    expect(difficultyRules(99).step).toBe(MAX_DIFFICULTY)
    expect(difficultyRules(-2).step).toBe(0)
  })
})

describe('the skill library view (Codex)', () => {
  it('is a Collection with two tabs; a locked card is a silhouette that says only how it opens', async () => {
    const { skillLibraryOffer, UNLOCK_BY_CHARTER, UNLOCK_BY_PLAYING } = await import('../src/ui/shell/codexOffers')
    const { ITEM_KINDS, BASIC_ITEM_KINDS } = await import('../src/game/data/itemKinds')
    const o = skillLibraryOffer({ achievements: {}, skills: ['charge'], items: ['Axe'], staged: false })
    expect(o.tabs!.map((t) => t.label)).toEqual(['Skills', 'Items'])
    const skillsTab = o.tabs![0]
    const itemsTab = o.tabs![1]
    expect(skillsTab.cards).toHaveLength(ALL_SKILLS.length)
    expect(itemsTab.cards).toHaveLength(ITEM_KINDS.length)
    // A pip per card ran 33 dots off a phone's row: the count rides in `sub`.
    expect(o.pips).toBeUndefined()
    expect(skillsTab.count).toBe(`${STARTER_SKILLS.length + 1}/${ALL_SKILLS.length}`)
    expect(itemsTab.count).toBe(`${BASIC_ITEM_KINDS.length + 1}/${ITEM_KINDS.length}`)
    // A locked kind says how it opens: by playing, or — the Sovereign tier — by a delivered Sovereign Route.
    for (const c of itemsTab.cards.filter((c) => c.locked)) {
      expect(c.name).toBe('Locked')
      expect(c.text).toBe(c.tier === 'sovereign' ? UNLOCK_BY_CHARTER : UNLOCK_BY_PLAYING)
    }
    expect(itemsTab.cards.filter((c) => c.tier === 'sovereign').map((c) => c.group)).toEqual(Array(5).fill('Sovereign'))
    const o2 = { cards: skillsTab.cards }
    const locked = o2.cards.filter((c) => c.locked)
    expect(locked).toHaveLength(ALL_SKILLS.length - STARTER_SKILLS.length - 1)
    for (const c of locked) {
      expect(c.name).toBe('Locked')
      expect(ALL_SKILLS.some((k) => c.text.includes(k.desc))).toBe(false)
    }
    expect(new Set(o2.cards.map((c) => c.group))).toEqual(new Set(['Level 1', 'Level 2', 'Level 3']))
  })

  it('stays locked until the first run is over', async () => {
    const { skillLibraryOffer } = await import('../src/ui/shell/codexOffers')
    const o = skillLibraryOffer({ achievements: {}, skills: [], staged: true })
    expect(o.tabs).toBeUndefined()
    expect(o.sub).toBe('Locked')
  })
})
