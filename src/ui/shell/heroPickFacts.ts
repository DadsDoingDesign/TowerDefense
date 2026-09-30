/**
 * H3-2 — what the hero-pick VARIANTS say about each starting hero.
 *
 * The variants behind `?heropick=cards|compare|recommend` (HeroPickVariants.tsx)
 * are design explorations from the jobs-to-be-done pass in
 * `docs/JTBD-hero-pick.md`. The shipped screen (`heroPickOffers` in offers.ts)
 * is untouched; this module only reads.
 *
 * Same rule as the shipped screen (H11): nothing here is a hand-written number.
 * Every figure comes from `computeCombat` on the exact preview Sentinel
 * `pickStartingHero` will build (`previewHero` in offers.ts), from the tier-0
 * tree node, from the tier-1 children, or from the opening-kit table. The
 * plain-language lines are TEMPLATES over those numbers — if a Rogue stops
 * outranging a Mystic in `archetypeTree.ts`, the sentence that says so changes
 * with it. `tests/heroPickFacts.test.ts` pins the templates to the data.
 *
 * Pure: game data only, no React, no stores — so the test can run it.
 */
import { childrenOf, getNode } from '../../game/data/archetypeTree'
import { RARITY } from '../../game/data/items'
import { computeCombat } from '../../game/engine/combat'
import { KIT } from '../../game/engine/kit'
import type { Archetype, ItemRarity, Sentinel } from '../../game/types'

export const HERO_ORDER: readonly Archetype[] = ['fighter', 'rogue', 'mystic']

/** The directions a designer can try with `?heropick=`. */
export type HeroPickVariant = 'cards' | 'compare' | 'recommend'
const VARIANTS: readonly HeroPickVariant[] = ['cards', 'compare', 'recommend']

/** `?heropick=` → a direction, or null (today's screen) when absent or unknown. */
export function heroPickVariant(search: string = typeof location === 'undefined' ? '' : location.search): HeroPickVariant | null {
  const v = new URLSearchParams(search).get('heropick')
  return (VARIANTS as readonly string[]).includes(v ?? '') ? (v as HeroPickVariant) : null
}

export interface HeroFacts {
  archetype: Archetype
  /** Same ids as the shipped screen's offers, so a selection survives a variant switch. */
  id: string
  name: string
  /** The tier-0 node's one-line identity ("Frontline bruiser who holds the line."). */
  blurb: string
  /** The tier-0 node's ability sentence — the shipped screen's lead line. */
  ability: string
  /** One plain sentence on HOW it fights, built from the numbers below. */
  playStyle: string
  /** Where to post it on the first map, built from reach / block / splash. */
  place: string
  dps: number
  range: number
  hp: number
  rate: number
  critChance: number
  critMult: number
  damageType: 'physical' | 'magic'
  splash: number
  /** Enemies it stops in their tracks; 0 when it does not block. */
  block: number
  armour: number
  thorns: number
  /** The three tier-1 forms it can grow into at level 10. */
  grows: string[]
  /** The opening kit, dealt after the pick (`engine/kit.ts`), as rarity words. */
  kit: { weapon: string; body: string; offHand: string; weaponRarity: ItemRarity }
  /** The attack strip the battle renderer plays (`render/anim.ts`). */
  attackStrip: string
  idleStrip: string
}

/*
 * "path", not "road": in player copy the road is the run map ("Recruit more
 * along the road") and the enemies' route in a battle is the path (BRAND.md
 * § Glossary — one noun per concept). "circle" is the teaching word for a slot.
 */
/** Short reach: has to be posted next to the path to touch anything. */
const SHORT_REACH = 120
/** Long reach: can stand back from the path. */
const LONG_REACH = 150

const oneIn = (p: number) => Math.max(2, Math.round(1 / Math.max(p, 0.01)))
const critWord = (m: number) => (Math.abs(m - 2) < 0.05 ? 'double damage' : `×${m.toFixed(1)} damage`)
const paceWord = (rate: number) => (rate >= 1.5 ? 'Fast' : rate < 0.95 ? 'Slow' : 'Steady')

/**
 * How it fights, in one line a first-time player can picture. Branches on the
 * mechanic that most changes what you SEE in a battle: an enemy stopping at a
 * hero (block), a burst hitting a crowd (splash), or single shots (neither).
 */
export function playStyle(f: Pick<HeroFacts, 'block' | 'splash' | 'damageType' | 'rate' | 'range' | 'critChance' | 'critMult'>): string {
  const where = f.range < SHORT_REACH ? 'up close' : f.range >= LONG_REACH ? 'from far back' : 'from mid range'
  if (f.block > 0) return `Holds the path: stops up to ${f.block} enemies and hits them ${where}.`
  const pace = paceWord(f.rate)
  if (f.splash > 0) {
    // "magic ... bursts" (mass noun) / "shots ... burst" (plural).
    const [noun, verb] = f.damageType === 'magic' ? ['magic', 'bursts'] : ['shots', 'burst']
    return `${pace} ${noun} ${where} that ${verb} on every enemy near the target.`
  }
  if (f.critChance >= 0.15) {
    return `${pace} shots ${where}; about 1 hit in ${oneIn(f.critChance)} crits for ${critWord(f.critMult)}.`
  }
  return `${pace} single shots ${where}.`
}

/** Where to post it — the planning half of the job. */
export function placeHint(f: Pick<HeroFacts, 'block' | 'splash' | 'range'>): string {
  if (f.block > 0) return 'Post it on a circle right beside the path. Enemies stop at it, so they stay in its reach.'
  if (f.range < SHORT_REACH) return 'Post it on a circle right beside the path — its reach is short.'
  if (f.splash > 0) return 'Can stand back from the path. Best where enemies bunch up.'
  return 'Can stand back from the path and still reach it.'
}

const kitWord = (r: ItemRarity) => RARITY[r].label

/** Everything the variants print about one starting hero. */
export function heroFacts(hero: Sentinel): HeroFacts {
  const a = hero.archetype
  const node = getNode(a)
  const p = computeCombat(hero)
  const [weapon, body, offHand] = KIT[a]
  const core = {
    block: p.mods.block?.count ?? 0,
    splash: Math.round(p.splashRadius),
    damageType: p.damageType,
    rate: p.rate,
    range: Math.round(p.range),
    critChance: p.critChance,
    critMult: p.critMult,
  }
  return {
    archetype: a,
    id: `pick-${a}`,
    name: node.name,
    blurb: node.blurb,
    ability: node.ability,
    playStyle: playStyle(core),
    place: placeHint(core),
    ...core,
    dps: Math.round(p.dps),
    hp: Math.round(p.maxHp),
    armour: Math.round(p.physDef),
    thorns: Math.round(p.thorns),
    grows: childrenOf(a).map((c) => c.name),
    kit: { weapon: kitWord(weapon.rarity), body: kitWord(body.rarity), offHand: kitWord(offHand.rarity), weaponRarity: weapon.rarity },
    attackStrip: `assets/sprites/tinyswords/${a}_atk.png`,
    idleStrip: `assets/sprites/tinyswords/${a}_idle.png`,
  }
}

/**
 * The first-run suggestion, and the reason it is honest.
 *
 * NOT "the strongest": `balance/REPORT.md` §11 has the three starters within a
 * few tenths of a stop of each other on a zero-meta first run (9.4 / 9.2 / 9.6
 * nodes cleared), so a strength claim would be false. The claim made instead is
 * about FORGIVENESS — the hero whose reach covers the most road is the one
 * whose placement a first-timer can get wrong and still be fine. Ties go to
 * damage per second. Which rule to use is the designer's call (open question 2
 * in the JTBD doc); this is the default.
 */
export function recommendFirstRun(all: HeroFacts[]): { id: string; reason: string } {
  const best = [...all].sort((x, y) => y.range - x.range || y.dps - x.dps)[0]
  const topDps = all.every((f) => f.dps <= best.dps)
  const reach = `It reaches farthest of the three (${best.range})`
  const reason = topDps
    ? `${reach} and deals the most damage per second (${best.dps}), so where you post it matters least.`
    : `${reach}, so where you post it matters least.`
  return { id: best.id, reason }
}
