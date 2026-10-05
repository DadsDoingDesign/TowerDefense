import { describe, expect, it } from 'vitest'
import {
  ALL_SKILLS,
  EVOLUTION_TO_SKILL,
  FEAT_SKILLS,
  PERK_TO_SKILL,
  RANDOM_UNLOCK_SKILLS,
  skillById,
  skillFits,
  STARTER_SKILLS,
} from '../src/game/data/skills'
import { ALL_NODES } from '../src/game/data/archetypeTree'
import {
  bumpOffered,
  heroChoices,
  migrateGrowth,
  nextMilestone,
  pendingMilestone,
  recruitSkill,
  skillOffer,
  takeBump,
  takeSkill,
} from '../src/game/run/skills'
import {
  DAILY_SKILL_POOL,
  difficultyRules,
  MAX_DIFFICULTY,
  rollUnlock,
  skillPoolFor,
  watchLevelFor,
  watchXpFor,
  watchXpToReach,
  winReward,
} from '../src/game/run/watch'
import { createSentinel } from '../src/game/data/sentinels'
import { applyXp, xpToReach } from '../src/game/engine/leveling'
import { computeCombat } from '../src/game/engine/combat'
import { isMelee } from '../src/game/engine/melee'
import type { Archetype, Sentinel } from '../src/game/types'

const ALL_POOL = ALL_SKILLS.map((k) => k.id)
const at = (a: Archetype, level: number, extra: Partial<Sentinel> = {}): Sentinel => ({ ...applyXp(createSentinel(a), xpToReach(level)), ...extra })

describe('the skill library (SK1)', () => {
  it('is 12 / 12 / 9 across the three levels, every id unique', () => {
    const by = (l: number) => ALL_SKILLS.filter((k) => k.level === l).length
    expect([by(1), by(2), by(3)]).toEqual([12, 12, 9])
    expect(new Set(ALL_SKILLS.map((k) => k.id)).size).toBe(ALL_SKILLS.length)
  })

  it('starts everyone with three universal skills at each level', () => {
    for (const l of [1, 2, 3]) {
      const s = ALL_SKILLS.filter((k) => k.starter && k.level === l)
      expect(s).toHaveLength(3)
      expect(s.every((k) => !k.class)).toBe(true)
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

  it('keeps holding enemies on the Fighter: no skill makes a Rogue or Mystic melee', () => {
    for (const k of ALL_SKILLS) if (k.mods.block || k.mods.thornsMult) expect(k.class).toBe('fighter')
    for (const a of ['rogue', 'mystic'] as const) {
      const h = { ...createSentinel(a), skills: ALL_SKILLS.filter((k) => skillFits(k, a)).map((k) => k.id) }
      expect(computeCombat(h).mods.block).toBeUndefined()
      expect(isMelee(h)).toBe(false)
    }
  })

  it('maps every retired perk and every evolution to a real skill', () => {
    for (const id of Object.values(PERK_TO_SKILL)) expect(skillById(id)).toBeDefined()
    expect(Object.keys(PERK_TO_SKILL)).toHaveLength(27)
    for (const n of ALL_NODES.filter((n) => n.tier > 0)) {
      const k = skillById(EVOLUTION_TO_SKILL[n.id])
      expect(k, n.id).toBeDefined()
      expect(skillFits(k!, n.archetype), n.id).toBe(true)
    }
  })

  it('folds a skill into combat exactly by its mods', () => {
    const base = createSentinel('rogue')
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

  it('offers three distinct skills of the tier that fit the class and are not held', () => {
    for (const a of ['fighter', 'rogue', 'mystic'] as const) {
      for (const picks of [0, 1, 2]) {
        const h = at(a, 16, { skillPicks: picks, skills: ['quick_hands'] })
        const offer = skillOffer(h, ALL_POOL, seed)
        expect(offer).toHaveLength(3)
        expect(new Set(offer.map((k) => k.id)).size).toBe(3)
        for (const k of offer) {
          expect(k.level).toBe(picks + 1)
          expect(skillFits(k, a)).toBe(true)
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

describe('the hero pick and hires', () => {
  it('offers one of each class, each with a distinct Level 1 skill, the same for the same seed', () => {
    const a = heroChoices(77, STARTER_SKILLS)
    expect(a.map((c) => c.archetype)).toEqual(['fighter', 'rogue', 'mystic'])
    expect(new Set(a.map((c) => c.skill)).size).toBe(3)
    for (const c of a) expect(skillById(c.skill!)!.level).toBe(1)
    expect(heroChoices(77, STARTER_SKILLS)).toEqual(a)
    const seen = new Set<string>()
    for (let s = 0; s < 30; s++) seen.add(heroChoices(s, ALL_POOL).map((c) => c.skill).join())
    expect(seen.size).toBeGreaterThan(10)
  })

  it('gives a hire a Level 1 skill that fits its class', () => {
    for (let i = 0; i < 20; i++) {
      const id = recruitSkill(9, `sent${i}`, 'mystic', ALL_POOL)!
      expect(skillById(id)!.level).toBe(1)
      expect(skillFits(skillById(id)!, 'mystic')).toBe(true)
    }
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
    expect(m.branchPath).toEqual(['fighter'])
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
    expect(migrateGrowth({ archetype: 'fighter', level: 3, branchPath: ['fighter'], stats })).toEqual({ skills: [], skillPicks: 0, stats, branchPath: ['fighter'] })
  })
})

describe('Watch levels, cards and difficulty', () => {
  it('prices a run in Watch XP', () => {
    expect(watchXpFor({ depth: 5, kills: 150, won: false })).toBe(75 + 15)
    expect(watchXpFor({ depth: 12, kills: 400, won: true })).toBe(180 + 40 + 60)
    expect(watchXpFor({ mode: 'endless', depth: 8, kills: 0, won: false })).toBe(80)
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
    expect(DAILY_SKILL_POOL).toEqual(STARTER_SKILLS)
  })

  it('adds 8% enemy strength and one elite an act per step', () => {
    expect(difficultyRules(0)).toEqual({ step: 0, startThreat: 1, extraElites: 0, markMult: 1 })
    expect(difficultyRules(3)).toMatchObject({ step: 3, startThreat: 1.24, extraElites: 3 })
    expect(difficultyRules(99).step).toBe(MAX_DIFFICULTY)
    expect(difficultyRules(-2).step).toBe(0)
    for (let s = 1; s <= MAX_DIFFICULTY; s++) expect(difficultyRules(s).markMult).toBeGreaterThan(difficultyRules(s - 1).markMult)
  })

  it('pays a card for a win at the top step, or for a new best below it', () => {
    expect(winReward({ step: 2, top: 2, score: 1, best: 5000 })).toMatchObject({ card: true, stepUp: true })
    expect(winReward({ step: 1, top: 2, score: 2400, best: 2500 })).toMatchObject({ card: false, stepUp: false })
    expect(winReward({ step: 1, top: 2, score: 2600, best: 2500 })).toMatchObject({ card: true, stepUp: false, newBest: true })
    expect(winReward({ step: MAX_DIFFICULTY, top: MAX_DIFFICULTY, score: 1, best: 9 })).toMatchObject({ card: true, stepUp: false })
  })
})

describe('the skill library view (Codex)', () => {
  it('lists every card by level; a locked card is a silhouette that says only how it opens', async () => {
    const { skillLibraryOffer } = await import('../src/ui/shell/codexOffers')
    const o = skillLibraryOffer({ achievements: {}, skills: ['charge'], watchXp: 100, staged: false })
    expect(o.cards).toHaveLength(ALL_SKILLS.length)
    // A pip per card ran 33 dots off a phone's row: the count rides in `sub`.
    expect(o.pips).toBeUndefined()
    expect(o.sub).toBe(`${STARTER_SKILLS.length + 1}/${ALL_SKILLS.length}`)
    const locked = o.cards!.filter((c) => c.locked)
    expect(locked).toHaveLength(ALL_SKILLS.length - STARTER_SKILLS.length - 1)
    for (const c of locked) {
      expect(c.name).toBe('Locked')
      expect(ALL_SKILLS.some((k) => c.text.includes(k.desc))).toBe(false)
    }
    expect(new Set(o.cards!.map((c) => c.group))).toEqual(new Set(['Level 1', 'Level 2', 'Level 3']))
  })

  it('stays locked until the first run is over', async () => {
    const { skillLibraryOffer } = await import('../src/ui/shell/codexOffers')
    const o = skillLibraryOffer({ achievements: {}, skills: [], watchXp: 0, staged: true })
    expect(o.cards).toBeUndefined()
    expect(o.sub).toBe('Locked')
  })
})
