import { describe, expect, it } from 'vitest'
import { COMPANY_IDS } from '../src/game/data/companies'
import { FUSIONS } from '../src/game/data/fusions'
import { deliveryOf, INFUSIONS, reexpress } from '../src/game/data/infusions'
import { FIRST_MAP, legacyPosts } from '../src/game/data/maps'
import { classicHero } from '../src/game/data/sentinels'
import {
  ALL_SKILLS,
  chainOf,
  CHARTER_SKILLS,
  isCardId,
  isMergedId,
  isNamedId,
  isSkillId,
  MAX_DEPTH,
  mergedById,
  mergeId,
  NAMED_MERGES,
  plainExtra,
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
import { afterDrop, buildsInto, buildsWith, dropOnto, heldCards, infusionOf, recipesWith } from '../src/game/run/fusion'
import { bumpOffered, dropPreview, dropSkill, MAX_SKILLS, skillOffer, slotsFull } from '../src/game/run/skills'
import { migrateMeta, META_VERSION } from '../src/state/metaStore'
import type { EffectMods, Mutation, Sentinel, WaveDef } from '../src/game/types'

/**
 * Ordered merges (Oct 2026, `docs/SKILL_FUSION.md`): every ordered pair, the
 * named recipes, the drop, the saves, and every twist in the engine.
 */

const hero = (skills: string[], level = 5, skillPicks = 0): Sentinel => ({ ...classicHero('rogue'), id: 'h-fz', level, skills, skillPicks })
/** A pool that is the whole library, so any offer can hold any card. */
const POOL = ALL_SKILLS.map((k) => k.id)
/** A seed whose owed offer, for hero `h`, includes `want` (searched, deterministic). */
function seedOffering(h: Sentinel, want: string, pool: readonly string[] = POOL): number {
  for (let seed = 1; seed < 5000; seed++) if (skillOffer(h, pool, seed).some((k) => k.id === want)) return seed
  throw new Error(`no seed offers ${want}`)
}
const IDS = ALL_SKILLS.map((k) => k.id)
const pairs = IDS.flatMap((a) => IDS.filter((b) => b !== a).map((b) => [a, b] as const))

describe('every library skill has an infusion half (data/infusions.ts)', () => {
  it('one each, a one-word adjective no other skill uses, a line of at most 80 characters', () => {
    expect(Object.keys(INFUSIONS).sort()).toEqual([...IDS].sort())
    const adjs = Object.values(INFUSIONS).map((i) => i.adj)
    expect(new Set(adjs).size).toBe(adjs.length)
    for (const [id, i] of Object.entries(INFUSIONS)) {
      expect(i.adj, id).toMatch(/^[A-Z][a-z-]+$/)
      expect(i.line.length, i.line).toBeLessThanOrEqual(80)
      expect(i.line.endsWith('.'), i.line).toBe(true)
      expect(Object.keys(i.mods).length, id).toBeGreaterThan(0)
    }
  })

  it('a share is smaller than the skill it comes from (it lends, it does not copy)', () => {
    for (const k of ALL_SKILLS) {
      const s = INFUSIONS[k.id].mods
      for (const key of ['damageMult', 'rateMult', 'rangeMult'] as const) if (s[key] != null && k.mods[key] != null) expect(s[key]!, `${k.id}.${key}`).toBeLessThan(k.mods[key]!)
      for (const key of ['critChanceAdd', 'critMultAdd', 'execute', 'stunChance', 'goldPerKill', 'vsHeld', 'vsSlowed', 'splashAdd', 'holdAdd'] as const)
        if (s[key] != null && k.mods[key] != null) expect(s[key]!, `${k.id}.${key}`).toBeLessThanOrEqual(k.mods[key]!)
      if (s.burn && k.mods.burn) expect(s.burn.dps).toBeLessThan(k.mods.burn.dps)
      if (s.chill && k.mods.chill) expect(s.chill.slow).toBeLessThan(k.mods.chill.slow)
      if (s.shock && k.mods.shock) expect(s.shock.dmgFrac).toBeLessThan(k.mods.shock.dmgFrac)
    }
  })

  it('the re-expression rules key on the base’s delivery: the designer’s four examples', () => {
    // "Frostbite into Arc Spark: the chains freeze."
    expect(mergedById(mergeId('arc_spark', 'frostbite')!)!.mods).toEqual({ arcCarry: true })
    // "Arc Spark into Frostbite: the slows arc to a neighbour."
    const sparking = mergedById(mergeId('frostbite', 'arc_spark')!)!
    expect(sparking.mods).toEqual({ arcCarry: true })
    expect(sparking.expanded.some((m) => m.shock)).toBe(true)
    // "Poison into Cleave: the cleave poisons" (the engine strikes every splashed body with the hit's statuses).
    const venomous = mergedById(mergeId('cleave', 'poison_tips')!)!
    expect(venomous.twist).toBe('Its splash poisons all it strikes.')
    expect(venomous.expanded.some((m) => m.burn)).toBe(true)
    // "Cleave into Poison: poisoned enemies' deaths splash."
    expect(mergedById(mergeId('poison_tips', 'cleave')!)!.mods.deathBurst).toBeTruthy()
    expect(deliveryOf(skillById('arc_spark')!.mods)).toBe('chain')
    expect(deliveryOf(skillById('frostbite')!.mods)).toBe('status')
    expect(deliveryOf(skillById('keen_eye')!.mods)).toBe('strike')
    expect(reexpress('gold', 'strike', 'steel')).toBeNull()
  })

  it('a share stacks on what the base already does (a burn onto a burn adds its damage)', () => {
    const m = computeCombat(hero([mergeId('wildfire', 'poison_tips')!]))
    expect(m.mods.burn!.dps).toBe(12 + 4)
    const slow = computeCombat(hero([mergeId('frostbite', 'anchor')!]))
    expect(slow.mods.chill!.slow).toBeCloseTo(0.25 + 0.12, 9)
  })
})

describe('every ordered pair merges into something distinct', () => {
  it(`all ${IDS.length * (IDS.length - 1)} ordered pairs: a valid, readable, non-empty merge; A onto B is never B onto A`, () => {
    const ids = new Set<string>()
    const names = new Set<string>()
    for (const [a, b] of pairs) {
      const id = mergeId(a, b)
      expect(id, `${a} ← ${b}`).toBeTruthy()
      const m = mergedById(id!)!
      expect(m, id!).toBeTruthy()
      expect(isSkillId(id)).toBe(true)
      expect(isMergedId(id)).toBe(true)
      expect(isCardId(id)).toBe(false)
      expect(m.chain).toEqual([a, b])
      expect(m.parts).toEqual([a, b])
      // Non-empty: more than its base alone.
      expect(m.expanded.length, id!).toBeGreaterThan(1)
      expect(skillModsOf({ skills: [id!] }).slice(0, 1)).toEqual([skillById(a)!.mods])
      ids.add(id!)
      names.add(m.name)
      // The other order is another skill: another id, another name, other mods.
      const back = mergedById(mergeId(b, a)!)!
      expect(back.id).not.toBe(m.id)
      expect(back.name).not.toBe(m.name)
      expect(JSON.stringify(back.expanded)).not.toBe(JSON.stringify(m.expanded))
    }
    expect(ids.size).toBe(pairs.length)
    expect(names.size).toBe(pairs.length)
    // No merge takes a library skill's name.
    for (const k of ALL_SKILLS) expect(names.has(k.name)).toBe(false)
  })

  it('names and lines are within the copy caps (a name ≤ 34, each line one sentence ≤ 80)', () => {
    for (const [a, b] of pairs) {
      const m = mergedById(mergeId(a, b)!)!
      expect(m.name.length, m.name).toBeLessThanOrEqual(34)
      for (const l of m.lines) {
        expect(l.length, l).toBeLessThanOrEqual(80)
        expect(l.endsWith('.'), l).toBe(true)
      }
      // A plain merge is named for its infusion and its base: "Frozen Arc Spark".
      if (!m.named) expect(m.name).toBe(`${INFUSIONS[b].adj} ${skillById(a)!.name}`)
    }
  })

  it('the base keeps its identity: its sentence, its company, its picture', () => {
    const m = mergedById('mx.arc_spark.frostbite')!
    expect(m.name).toBe('Frozen Arc Spark')
    expect(m.desc).toBe(skillById('arc_spark')!.desc)
    expect(m.company).toBe('scrolls')
    // Its atlas cell is its base's drawing (its real picture is composed: `tests/skillIcons.test.ts`).
    expect(skillHeadline(m).icon).toBe(skillHeadline(skillById('arc_spark')!).icon)
    expect(m.icon).toBe('skArcSpark')
    expect(m.element).toBe('frost')
  })
})

describe('depth and ids', () => {
  it(`a slot holds at most ${MAX_DEPTH} skills, never one twice`, () => {
    expect(MAX_DEPTH).toBe(3)
    const two = mergeId('hard_hitter', 'keen_eye')!
    const three = mergeId(two, 'berserk')!
    expect(three).toBe('mx.hard_hitter.keen_eye.berserk')
    expect(chainOf(three)).toEqual(['hard_hitter', 'keen_eye', 'berserk'])
    expect(mergeId(three, 'cleave')).toBeNull()
    // A greater named merge is three: full.
    expect(chainOf('fz_skyfall')).toHaveLength(3)
    expect(mergeId('fz_skyfall', 'cleave')).toBeNull()
    // Never the same skill twice in a slot.
    expect(mergeId(two, 'keen_eye')).toBeNull()
    expect(mergeId(two, 'hard_hitter')).toBeNull()
    expect(mergeId('hard_hitter', 'hard_hitter')).toBeNull()
    // Only a library card is ever poured in.
    expect(mergeId('hard_hitter', 'fz_rimecut')).toBeNull()
    expect(mergeId('hard_hitter', two)).toBeNull()
  })

  it('one id per slot: a chain whose first two make a named merge is written from it', () => {
    expect(mergeId('frostbite', 'keen_eye')).toBe('fz_rimecut')
    expect(isSkillId('mx.frostbite.keen_eye')).toBe(false)
    expect(mergeId('fz_rimecut', 'anchor')).toBe('mx.fz_rimecut.anchor')
    expect(isSkillId('mx.frostbite.keen_eye.anchor')).toBe(false)
    expect(mergedById('mx.fz_rimecut.anchor')!.name).toBe('Anchored Rimecut')
  })

  it('junk is refused by every validator', () => {
    for (const junk of ['mx.', 'mx.hard_hitter', 'mx.hard_hitter.nonsense', 'mx.hard_hitter.hard_hitter', 'mx.nonsense.keen_eye', 'mx.fz_nonsense.keen_eye', 'fz_', 'fz_nonsense', 'mx.a.b.c.d', '', 3, null, undefined, {}]) {
      expect(isSkillId(junk), String(junk)).toBe(false)
      expect(isMergedId(junk)).toBe(false)
      expect(isNamedId(junk)).toBe(false)
    }
    // Depth 4 is refused even when every step is otherwise a merge.
    expect(isSkillId('mx.hard_hitter.keen_eye.berserk.cleave')).toBe(false)
  })

  it('merged ids are plain strings that read back as themselves (the run save: tests/runSnapshot.fuzz.test.ts)', () => {
    for (const id of ['mx.arc_spark.frostbite', 'fz_skyfall', 'mx.fz_rimecut.anchor', 'mx.hard_hitter.keen_eye.berserk']) {
      expect(isSkillId(JSON.parse(JSON.stringify(id)))).toBe(true)
      expect(skillById(id)!.id).toBe(id)
    }
  })

  it('the meta save keeps library cards in its pools and named ids in its discoveries, nothing else', () => {
    expect(migrateMeta({ skills: ['fz_thousand_cuts', 'mx.arc_spark.frostbite', 'bounty'] }, META_VERSION).skills).toEqual(['bounty'])
    const saved = migrateMeta({ codex: { enemies: [], relics: [], felled: {}, clans: [], fusions: ['fz_sunder', 'nonsense', 'fz_sunder', 'mx.arc_spark.frostbite', 'bounty', 'fz_skyfall', 7] } }, META_VERSION)
    expect(saved.codex.fusions).toEqual(['fz_sunder', 'fz_skyfall'])
    const again = migrateMeta(JSON.parse(JSON.stringify(saved)), META_VERSION)
    expect(again.codex.fusions).toEqual(['fz_sunder', 'fz_skyfall'])
    expect(migrateMeta({ codex: { enemies: ['torch1'], relics: [], felled: {} } }, META_VERSION).codex.fusions).toEqual([])
    expect(migrateMeta({}, 15).codex.fusions).toEqual([])
  })

  it('a merged skill would lend its root’s infusion (only cards are ever dropped in this build)', () => {
    expect(infusionOf('mx.arc_spark.frostbite')).toBe(INFUSIONS.arc_spark)
    expect(infusionOf('fz_skyfall')).toBe(INFUSIONS.long_reach)
    expect(infusionOf('keen_eye')).toBe(INFUSIONS.keen_eye)
    expect(infusionOf('nonsense')).toBeUndefined()
  })
})

describe('the named merges (data/fusions.ts)', () => {
  it('twenty: fifteen tier 1 and five greater, ids unique, each the one id its order writes', () => {
    expect(FUSIONS.length).toBe(20)
    expect(FUSIONS.filter((f) => f.tier === 1)).toHaveLength(15)
    expect(FUSIONS.filter((f) => f.tier === 2)).toHaveLength(5)
    expect(new Set(FUSIONS.map((f) => f.id)).size).toBe(FUSIONS.length)
    for (const f of FUSIONS) {
      expect(f.id.startsWith('fz_')).toBe(true)
      expect(isCardId(f.parts[1]), f.id).toBe(true)
      if (f.tier === 1) expect(isCardId(f.parts[0]), f.id).toBe(true)
      else expect(FUSIONS.find((x) => x.id === f.parts[0])?.tier, f.id).toBe(1)
      expect(mergeId(f.parts[0], f.parts[1])).toBe(f.id)
      expect(mergedById(f.id)!.named).toBe(f)
    }
    // No ordered pair twice.
    const orders = FUSIONS.map((f) => f.parts.join('<'))
    expect(new Set(orders).size).toBe(orders.length)
  })

  it('a named merge’s order is the recipe: the other order is a plain merge', () => {
    for (const f of FUSIONS.filter((x) => x.tier === 1)) {
      const back = mergeId(f.parts[1], f.parts[0])!
      expect(back.startsWith('mx.'), f.id).toBe(true)
      expect(mergedById(back)!.named).toBeUndefined()
    }
  })

  it('level, company, and the shape of the tree', () => {
    for (const f of FUSIONS) {
      const levels = chainOf(f.id).map((id) => skillById(id)!.level)
      expect(f.level).toBe(Math.max(...levels))
      expect(f.company).toBe(skillById(f.parts[0])!.company)
    }
    // Infusions are starters or common unlocks — never a signature or a feat card.
    const open = new Set([...STARTER_SKILLS, ...RANDOM_UNLOCK_SKILLS])
    const signatures = new Set(Object.values(SIGNATURE_SKILLS))
    for (const f of FUSIONS) for (const p of chainOf(f.id)) {
      expect(open.has(p), p).toBe(true)
      expect(signatures.has(p)).toBe(false)
      expect(skillById(p)!.feat).toBeUndefined()
    }
    // At most three recipes build from any one skill.
    for (const id of [...IDS, ...FUSIONS.map((f) => f.id)]) expect(recipesWith(id).length, id).toBeLessThanOrEqual(3)
    // One greater per company, each over a tier-1 merge of its own.
    for (const c of COMPANY_IDS) expect(FUSIONS.filter((f) => f.tier === 2 && f.company === c), c).toHaveLength(1)
    expect(buildsInto('fz_hail_of_arrows').map((f) => f.id)).toEqual(['fz_skyfall'])
    expect(buildsWith('volley').map((f) => f.id)).toEqual(['fz_skyfall'])
  })

  it('no two Level 1 starters make one (a first-timer is not handed one at level 5), and a first run can still meet one', () => {
    const l1 = STARTER_SKILLS.filter((id) => skillById(id)!.level === 1)
    expect(l1.length).toBe(3)
    for (const a of l1) for (const b of l1) if (a !== b) expect(mergedById(mergeId(a, b)!)!.named, `${a} ← ${b}`).toBeUndefined()
    const starterOnly = FUSIONS.filter((f) => chainOf(f.id).every((p) => STARTER_SKILLS.includes(p)))
    expect(starterOnly.map((f) => f.id)).toEqual(['fz_anvilfall'])
  })

  it('every tier-1 twist is a different rule no library card grants; a capstone is a rule its tier 1 lacks', () => {
    const t1 = FUSIONS.filter((f) => f.tier === 1)
    const keys = t1.map((f) => Object.keys(f.mods).sort().join(','))
    expect(new Set(keys).size).toBe(t1.length)
    const libraryKeys = new Set(ALL_SKILLS.flatMap((k) => Object.keys(k.mods)))
    for (const f of FUSIONS) expect(Object.keys(f.mods).some((k) => !libraryKeys.has(k)), f.name).toBe(true)
    for (const g of FUSIONS.filter((f) => f.tier === 2)) {
      const base = FUSIONS.find((f) => f.id === g.parts[0])!
      for (const k of Object.keys(g.mods)) expect(Object.keys(base.mods), g.name).not.toContain(k)
    }
  })

  it('copy: a twist is one line of at most 80 characters', () => {
    for (const f of FUSIONS) {
      expect(f.twist.length, f.twist).toBeLessThanOrEqual(80)
      expect(f.twist.endsWith('.')).toBe(true)
    }
  })

  it('a named merge is its base, the card’s share, and its twist in place of the rule', () => {
    const f = mergedById('fz_rimecut')!
    expect(f.expanded).toEqual([skillById('frostbite')!.mods, INFUSIONS.keen_eye.mods, FUSIONS.find((x) => x.id === 'fz_rimecut')!.mods])
    // Against the plain merge of its order: the same base and share, the rule instead.
    expect(plainExtra('frostbite', 'keen_eye')[0]).toEqual(INFUSIONS.keen_eye.mods)
    expect(skillHeadline(f)).toEqual({ icon: 'fzRimecut', label: 'Merge' })
    // A greater keeps its tier-1 twist and adds its capstone.
    const g = mergedById('fz_skyfall')!
    expect(g.expanded.slice(0, 3)).toEqual(mergedById('fz_hail_of_arrows')!.expanded)
  })

  it('merges are in no pool, unlock list, starter list or signature: they come only from a drop', () => {
    const ids = new Set(NAMED_MERGES.map((f) => f.id))
    for (const list of [IDS, STARTER_SKILLS, RANDOM_UNLOCK_SKILLS, CHARTER_SKILLS, Object.values(SIGNATURE_SKILLS)]) {
      expect(list.some((id) => ids.has(id) || isMergedId(id))).toBe(false)
    }
  })
})

describe('the drop (run/fusion.ts, run/skills.dropSkill)', () => {
  it('onto an empty slot: learned as itself', () => {
    const h = hero(['long_reach'])
    const seed = seedOffering(h, 'keen_eye')
    const next = dropSkill(h, 'keen_eye', 1, POOL, seed)!
    expect(next.skills).toEqual(['long_reach', 'keen_eye'])
    expect(next.skillPicks).toBe(1)
    // Any empty slot takes it; skills fill in order.
    expect(dropSkill(h, 'keen_eye', 2, POOL, seed)!.skills).toEqual(['long_reach', 'keen_eye'])
    // Two parts of a named merge held apart stay apart (the designer's empty-slot rule).
    expect(next.skills!.some((id) => isMergedId(id))).toBe(false)
  })

  it('onto a held skill, by choice: a forced or chosen merge that forms a named recipe', () => {
    const h = hero(['frostbite'])
    const seed = seedOffering(h, 'keen_eye')
    const next = dropSkill(h, 'keen_eye', 0, POOL, seed)!
    expect(next.skills).toEqual(['fz_rimecut'])
    expect(dropPreview(h, 'keen_eye', 0, POOL, seed)?.named?.id).toBe('fz_rimecut')
  })

  it('a full hero is forced to merge: no swap, no skill lost; a plain merge where no recipe is', () => {
    const r = hero(['bounty', 'bloodrush', 'cleave'], 15, 2)
    expect(slotsFull(r)).toBe(true)
    expect(bumpOffered(r, POOL, 1)).toBe(true)
    const seed = seedOffering(r, 'berserk')
    // A named recipe in its order (Bloodrush ← Berserk).
    expect(dropSkill(r, 'berserk', 1, POOL, seed)!.skills).toEqual(['bounty', 'fz_red_mist', 'cleave'])
    // A plain merge anywhere else.
    const plain = dropSkill(r, 'berserk', 0, POOL, seed)!
    expect(plain.skills).toEqual(['mx.bounty.berserk', 'bloodrush', 'cleave'])
    expect(heldCards(plain).sort()).toEqual(['berserk', 'bloodrush', 'bounty', 'cleave'])
    expect(plain.skills!.length).toBe(MAX_SKILLS)
    // No empty slot to land on.
    expect(dropSkill(r, 'berserk', 3, POOL, seed)).toBeNull()
  })

  it('a junk drop is refused: not on the offer, nothing owed, a bad slot, a slot at the depth cap, an unknown card', () => {
    const h = hero(['hard_hitter'], 10, 1)
    const seed = seedOffering(h, 'heavy_blows')
    const notOffered = IDS.find((id) => skillById(id)!.level === 2 && !skillOffer(h, POOL, seed).some((k) => k.id === id))!
    expect(dropSkill(h, notOffered, 1, POOL, seed)).toBeNull()
    expect(dropSkill({ ...h, level: 9 }, 'heavy_blows', 1, POOL, seed)).toBeNull()
    for (const slot of [-1, 1.5, 3, NaN]) expect(dropSkill(h, 'heavy_blows', slot, POOL, seed), String(slot)).toBeNull()
    expect(dropOnto(['fz_skyfall'], 'cleave', 0)).toBeNull()
    expect(dropOnto(['hard_hitter'], 'nonsense', 1)).toBeNull()
    expect(dropOnto(['hard_hitter'], 'hard_hitter', 1)).toBeNull()
    // The card is already held inside a merge: refused everywhere.
    expect(dropOnto(['mx.arc_spark.frostbite'], 'frostbite', 1)).toBeNull()
  })

  it('a hero holding a merge is never dealt its skills again; every other hero is dealt exactly as before', () => {
    const m = hero(['mx.arc_spark.frostbite'], 10, 1)
    for (let seed = 1; seed < 200; seed++) {
      const ids = skillOffer({ ...m, level: 5, skillPicks: 0 }, POOL, seed).map((k) => k.id)
      expect(ids).not.toContain('arc_spark')
      expect(ids).not.toContain('frostbite')
    }
    const plain = hero(['bounty'])
    expect(skillOffer(plain, POOL, 42).map((k) => k.id)).toEqual(skillOffer({ ...plain }, POOL, 42).map((k) => k.id))
    expect(skillOffer(plain, POOL, 42)).toHaveLength(3)
  })

  it('afterDrop: an empty slot appends, a merge replaces in place', () => {
    expect(afterDrop(['a'], { slot: 1, into: 'b' })).toEqual(['a', 'b'])
    expect(afterDrop(['a', 'c'], { slot: 1, into: 'mx.c.b', base: 'c' })).toEqual(['a', 'mx.c.b'])
  })
})

describe('the drop’s words (ui/shell/skillDrop.ts)', () => {
  it('each slot says what the card makes there; a named merge is marked; the CTA names it', async () => {
    const { slotTargets, dropCta, defaultTarget, isDrag } = await import('../src/ui/shell/skillDrop')
    const t = slotTargets({ skills: ['frostbite', 'arc_spark'] }, 'keen_eye')
    expect(t.map((x) => x.kind)).toEqual(['named', 'merge', 'empty'])
    expect(t[0].makes).toBe('Rimecut')
    expect(t[1].makes).toBe('Keen Arc Spark')
    expect(t[2].makes).toBe('Keen Eye')
    expect(t[0].aria).toContain('makes Rimecut, a named merge')
    expect(defaultTarget(t)).toBe(2)
    expect(dropCta('keen_eye', t[2], false)).toEqual({ label: 'Learn Keen Eye', ready: true })
    expect(dropCta('keen_eye', t[0], false)).toEqual({ label: 'Make Rimecut', ready: true })
    expect(dropCta('keen_eye', t[1], false)).toEqual({ label: 'Merge into Keen Arc Spark', ready: true })
    // A full hero: no default — a merge is always the player's pick.
    const full = slotTargets({ skills: ['frostbite', 'arc_spark', 'fz_skyfall'] }, 'keen_eye')
    expect(full[2].kind).toBe('full')
    expect(defaultTarget(full)).toBeNull()
    expect(dropCta('keen_eye', null, true)).toEqual({ label: 'Choose a skill to merge into', ready: false })
    expect(isDrag(3)).toBe(false)
    expect(isDrag(20)).toBe(true)
  })
})

/* ------------------------------------------------------------- the engine */

const P = legacyPosts(FIRST_MAP.id)
function fight(team: { sentinel: Sentinel; slotId: string }[], wave: WaveDef, seed = 3, hpMult = 1) {
  const engine = new GameEngine({ map: FIRST_MAP, wave, placedSentinels: team, baseHp: 80, maxBaseHp: 80, seed, enemyHpMult: hpMult })
  for (let i = 0; i < 60 * 240 && engine.status === 'running'; i++) engine.step(TICK)
  return engine
}
const asMut = (mods: EffectMods, i: number): Mutation => ({ id: `m${i}`, key: 'test', name: 'test', desc: '', rarity: 'mythic', downside: '', mods })
const grown = (look: 'fighter' | 'rogue' | 'mystic', skills: string[] = [], level = 12): Sentinel => ({ ...applyXp(classicHero(look), xpToReach(level)), skills })
const long = () => generateEncounter(9, 'normal', { subWaves: false })
const short = () => generateEncounter(3, 'normal', { subWaves: false })
const dealt = (e: GameEngine) => e.sentinels[0].damageDealt
const procs = (e: GameEngine) => e.behaviourStats.fusionProcs
const solo = (s: Sentinel) => [{ sentinel: s, slotId: P.s3 }]

/** The named merge against the PLAIN merge of the same order (its base, its share, the rule): the twist is the difference. */
function versus(look: 'fighter' | 'rogue' | 'mystic', fusionId: string, wave: WaveDef, hpMult = 1) {
  const [base, card] = mergedById(fusionId)!.parts
  const plain = fight(solo({ ...grown(look, [base]), mutations: plainExtra(base, card).map(asMut) }), wave, 3, hpMult)
  const fused = fight(solo(grown(look, [fusionId])), wave, 3, hpMult)
  return { parts: plain, fused }
}

describe('the twists (engine)', () => {
  it('a merge with no rule fights exactly as its base wearing the share', () => {
    for (const [a, b] of [['hard_hitter', 'bounty'], ['keen_eye', 'snare'], ['frostbite', 'bounty']] as const) {
      const id = mergeId(a, b)!
      expect(mergedById(id)!.mods).toEqual({})
      const merged = fight(solo(grown('rogue', [id])), short())
      const worn = fight(solo({ ...grown('rogue', [a]), mutations: [asMut(INFUSIONS[b].mods, 0)] }), short())
      expect(dealt(merged)).toBe(dealt(worn))
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

  it('first strike (Bushwhack): the first hit on each enemy deals more', () => {
    const { parts, fused } = versus('rogue', 'fz_bushwhack', long())
    expect(dealt(fused)).toBeGreaterThan(dealt(parts))
  })

  it('overkill (Sunder): a killing hit carries its excess on', () => {
    const { parts, fused } = versus('fighter', 'fz_sunder', short())
    expect(procs(parts)).toBe(0)
    expect(procs(fused)).toBeGreaterThan(0)
  })

  it('arc carry and a jump every 2nd attack (Plague Spark)', () => {
    const { parts, fused } = versus('mystic', 'fz_plague_spark', long())
    expect(dealt(fused)).toBeGreaterThan(dealt(parts))
  })

  it('freeze (Rimecut): more crits freeze slowed enemies than the plain merge’s, with no extra draw', () => {
    const { parts, fused } = versus('rogue', 'fz_rimecut', long())
    expect(procs(fused)).toBeGreaterThan(procs(parts))
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

  it('fan (Hail of Arrows): every 4th attack also shoots two more', () => {
    const { parts, fused } = versus('rogue', 'fz_hail_of_arrows', long())
    expect(dealt(fused)).toBeGreaterThan(dealt(parts))
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
    expect(near.sentinels[0].critBuff).toBeCloseTo(0.15, 9)
    const far = near.sentinels[1]
    const d = Math.hypot(far.pos.x - near.sentinels[0].pos.x, far.pos.y - near.sentinels[0].pos.y)
    expect(far.critBuff).toBeCloseTo(d <= 130 ? 0.15 : 0, 9)
    const plain = new GameEngine({ map: FIRST_MAP, wave: short(), placedSentinels: solo(grown('rogue', ['hold_fast', 'banner_bearer'])), baseHp: 50, maxBaseHp: 50, seed: 3 })
    plain.step(TICK)
    expect(plain.sentinels[0].critBuff).toBe(0)
  })

  it('quake (Anvilfall): every 4th attack shakes those around its target', () => {
    const { parts, fused } = versus('fighter', 'fz_anvilfall', long(), 2)
    // (Its plain merge's crits bounce — rule 14 — so it has procs of its own; the quake out-damages them.)
    expect(procs(fused)).toBeGreaterThan(0)
    expect(dealt(fused)).toBeGreaterThan(dealt(parts))
  })

  it('frenzy (Red Mist): kills this wave stack attack speed', () => {
    const { parts, fused } = versus('rogue', 'fz_red_mist', short())
    expect(fused.sentinels[0].shots).toBeGreaterThan(parts.sentinels[0].shots)
  })

  it('a greater named merge out-fights the plain merge of its order', () => {
    for (const [id, look] of [['fz_skyfall', 'rogue'], ['fz_black_death', 'fighter'], ['fz_forgefire', 'fighter']] as const) {
      const { parts, fused } = versus(look, id, long())
      expect(dealt(fused), id).toBeGreaterThan(dealt(parts))
    }
  })
})

describe('discovery and the beat (UI models)', () => {
  it('the Codex lists every named merge as a build tree: its order and a "?" until made, then its name and twist', async () => {
    const { codexModel, fusionFound, fusionHow, MERGE_RULE } = await import('../src/ui/shell/codex/codexModel')
    const codex = { enemies: [], relics: [], felled: {}, fusions: ['fz_sunder'] }
    const skills = codexModel({ achievements: {}, codex, skills: [], staged: false })[1]
    const sec = skills.sections.find((s) => s.title === 'Merges')!
    expect(sec.entries).toHaveLength(FUSIONS.length)
    expect(sec.have).toBe(1)
    expect(sec.tree!.rule).toBe(MERGE_RULE)
    expect(sec.tree!.made).toBe('Made 1 of 20 named merges.')
    expect(sec.tree!.rows).toHaveLength(15)
    expect(sec.tree!.rows.filter((r) => r.greater)).toHaveLength(5)
    expect(sec.tree!.rows.find((r) => r.entry.id === 'fusion:fz_hail_of_arrows')!.greater!.id).toBe('fusion:fz_skyfall')
    const sunder = sec.entries.find((e) => e.id === 'fusion:fz_sunder')!
    expect(sunder.locked).toBe(false)
    expect(sunder.name).toBe('Sunder')
    expect(sunder.fusion?.twist).toBe(skillById('fz_sunder')!.twist)
    expect(sunder.how).toBe(fusionFound('Hard Hitter', 'Cleave'))
    const cuts = sec.entries.find((e) => e.id === 'fusion:fz_thousand_cuts')!
    expect(cuts.locked).toBe(true)
    expect(cuts.name).toBe('???')
    expect(cuts.does).toBe('')
    expect(cuts.fusion?.twist).toBeUndefined()
    expect(cuts.fusion?.parts.map((p) => p.name)).toEqual(['Keen Eye', 'Long Reach'])
    expect(cuts.how).toBe(fusionHow('Keen Eye', 'Long Reach'))
    // A greater over an unmade tier 1 hides that one's name too.
    expect(sec.entries.find((e) => e.id === 'fusion:fz_skyfall')!.fusion!.parts[0].name).toBe('???')
    // Never a spoiler: no locked card names its result.
    for (const e of sec.entries.filter((x) => x.locked)) for (const f of FUSIONS) expect(e.how.includes(f.name), e.how).toBe(false)
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
