/**
 * ---------------------------------------------------------------------------
 * Rolling a hero (the classless rework)
 * ---------------------------------------------------------------------------
 *
 * The designer: "we dont have a set class, its just 3 options with items and
 * skills you have unlocked applied randomly … as you unlock more you get more
 * variety but its always random".
 *
 * A hero is rolled from the run's UNLOCKED item kinds: a main-hand weapon,
 * maybe an off-hand piece, maybe a body piece — then base stats a little
 * either side of what its weapon-hand trained (`sentinels.styleStats`), and
 * one Level 1 skill from the run's skill pool. What it does in a fight follows
 * from that gear (`data/gear.ts`); nothing else decides it.
 *
 * ---- randomness ----------------------------------------------------------
 *
 *  - The hero PICK is a pure function of the run seed and the two pools: a
 *    fresh generator hashed from `(runSeed, 'heroes')`, never a run stream,
 *    so the same seed or Daily deals the same three, a reload re-shows them,
 *    and previewing them moves nothing. The kit they show is the kit they
 *    get: the items are generated off that hashed generator too, under
 *    isolated ids for the preview and real ids when one is chosen.
 *  - A HIRE (recruit node, merchant, crossroads, Endless rooms, the hub's
 *    extra heroes) is rolled off the loot stream the caller passes, as hires
 *    always were, and its skill is the hashed `recruitSkill`.
 *
 * Every plan takes a FIXED number of draws whatever it deals (the off-hand
 * and body coins and their picks are always drawn), so what one hero rolls
 * never shifts the next one's stream position.
 */
import { hashSeed, RNG, withIsolatedIds } from '../core/rng'
import { generateItem, ITEM_BASES, type HeroStyle } from '../data/items'
import { lookOf } from '../data/gear'
import { BASE_PATIENCE, BASE_THORNS, createHero, HERO_NAMES, nextName, styleStats } from '../data/sentinels'
import { poolFor } from './skills'
import { BASE_DEAL, type DealRules } from './hq'
import type { CoreStats, Equipment, Item, ItemRarity, Sentinel } from '../types'

/** Which kinds a hero is dealt (nouns from the pool). */
export interface GearPlan {
  main: string
  off: string | null
  body: string | null
}

/** Chance a rolled hero carries an off-hand piece (when its weapon leaves a hand free). */
export const OFF_HAND_CHANCE = 0.7
/** Chance a rolled hero carries a body piece. */
export const BODY_CHANCE = 0.7
/** Chance a HIRE carries an off-hand piece (hires are armed, not dressed: no body). */
export const RECRUIT_OFF_CHANCE = 0.5

const STYLES: readonly HeroStyle[] = ['swing', 'shoot', 'cast']

const weaponsIn = (pool: readonly string[]) => pool.filter((k) => !!ITEM_BASES[k]?.style)
const offsIn = (pool: readonly string[]) => pool.filter((k) => ITEM_BASES[k]?.slot === 'offHand')
const bodiesIn = (pool: readonly string[]) => pool.filter((k) => ITEM_BASES[k]?.slot === 'body')

/**
 * Deal a gear plan from `pool`. The weapon is chosen STYLE first (uniform over
 * the styles the pool has a weapon for), then kind — so a pool with five
 * casters' weapons and two shooters' does not deal casters five times in
 * seven. `usedMains` steers away from kinds already dealt (the pick's three
 * differ whenever the pool allows). Fixed draws: style, kind, off coin, off
 * pick, body coin, body pick.
 */
export function rollGearPlan(
  rng: RNG,
  pool: readonly string[],
  o: { usedMains?: ReadonlySet<string>; offChance?: number; bodyChance?: number } = {},
): GearPlan {
  const used = o.usedMains ?? new Set<string>()
  let weapons = weaponsIn(pool)
  if (!weapons.length) weapons = ['Sword']
  const fresh = weapons.filter((k) => !used.has(k))
  const from = fresh.length ? fresh : weapons
  const styles = STYLES.filter((st) => from.some((k) => ITEM_BASES[k].style === st))
  const style = styles[Math.floor(rng.next() * styles.length)]
  const kinds = from.filter((k) => ITEM_BASES[k].style === style)
  const main = kinds[Math.floor(rng.next() * kinds.length)]
  const offs = offsIn(pool)
  const bodies = bodiesIn(pool)
  const offCoin = rng.next()
  const offPick = rng.next()
  const bodyCoin = rng.next()
  const bodyPick = rng.next()
  const handFree = ITEM_BASES[main].slot !== 'twoHand'
  const off = handFree && offs.length && offCoin < (o.offChance ?? OFF_HAND_CHANCE) ? offs[Math.floor(offPick * offs.length)] : null
  const body = bodies.length && bodyCoin < (o.bodyChance ?? BODY_CHANCE) ? bodies[Math.floor(bodyPick * bodies.length)] : null
  return { main, off, body }
}

/**
 * Base stats: what the hero's weapon-hand trained, each stat one either side,
 * plus thorns and patience a point either way. Fixed draws: five.
 */
export function rollBase(rng: RNG, style: HeroStyle | null): { stats: CoreStats; thorns: number; patience: number } {
  const b = styleStats(style)
  const stats = { str: Math.max(1, b.str + rng.int(-1, 1)), dex: Math.max(1, b.dex + rng.int(-1, 1)), int: Math.max(1, b.int + rng.int(-1, 1)) }
  return { stats, thorns: BASE_THORNS + rng.int(0, 1), patience: BASE_PATIENCE + rng.int(0, 1) }
}

/**
 * The rarity each piece of a PICKED hero arrives at — the old opening kit's
 * table, now by what the piece is: a common weapon, a rare off-hand, a common
 * body. A caster's weapon is Epic, for the reason the old Mystic's was (a
 * level-1 splash bolt is 16 damage at 0.8/s; flat weapon damage is the only
 * lever that lifts it — `engine/kit.ts` has the measurement).
 */
export function pickRarity(kind: string, piece: keyof Equipment, deal: Pick<DealRules, 'rareBody'> = BASE_DEAL): ItemRarity {
  if (piece === 'offHand') return 'rare'
  if (piece === 'body') return deal.rareBody ? 'rare' : 'common'
  return ITEM_BASES[kind]?.style === 'cast' ? 'epic' : 'common'
}

/** Generate the items of a plan off `rng`, at `rarity(kind, piece)`. No curses. */
export function dressPlan(rng: RNG, plan: GearPlan, rarity: (kind: string, piece: keyof Equipment) => ItemRarity, kinds?: readonly string[]): Equipment {
  const make = (kind: string | null, piece: keyof Equipment): Item | null =>
    kind ? generateItem(rng, { kind, rarity: rarity(kind, piece), allowCurse: false, kinds }) : null
  return { mainHand: make(plan.main, 'mainHand'), offHand: make(plan.off, 'offHand'), body: make(plan.body, 'body') }
}

// ---------------------------------------------------------------------------
// The hero pick
// ---------------------------------------------------------------------------

/** One of the three heroes the pick deals. */
export interface HeroChoice {
  /** Stable within a run: `pick-0` … `pick-2`. */
  id: string
  name: string
  stats: CoreStats
  thorns: number
  patience: number
  /** The gear it arrives wearing — preview ids; `chosenHero` re-mints them. */
  equipment: Equipment
  /** Its Level 1 skill (null only if the pool has none). */
  skill: string | null
  plan: GearPlan
}

/** Heroes on a new militia's pick. The HQ's Opening deal can add a fourth (`hq.DEAL_STEPS`). */
export const PICK_SIZE = 3
/** The most heroes a pick ever deals. */
export const MAX_PICK = 4

/**
 * The pick, dealt under the HQ's Opening deal (`hq.dealRules`). Level 0 is the
 * base deal, draw for draw. A deal is a pure function of the seed and its
 * level: a dressed deal spends the same off-hand and body coins (it always
 * passes them, so its extra pieces move the heroes after it), a fourth hero
 * is dealt after the first three, and the Level 2 skill is a second hashed
 * generator that moves nothing else.
 */
function dealChoices(runSeed: number, skillPool: readonly string[], itemPool: readonly string[], deal: DealRules = BASE_DEAL): HeroChoice[] {
  const rng = new RNG(hashSeed(runSeed, 'heroes'))
  const used = new Set<string>()
  const names = new Set<string>()
  const skills = new Set<string>()
  const out: HeroChoice[] = []
  const size = Math.max(1, Math.min(MAX_PICK, Math.floor(deal.pick) || PICK_SIZE))
  const chances = deal.dressed ? { offChance: 1, bodyChance: 1 } : {}
  for (let i = 0; i < size; i++) {
    const plan = rollGearPlan(rng, itemPool, { usedMains: used, ...chances })
    used.add(plan.main)
    const base = rollBase(rng, ITEM_BASES[plan.main].style ?? null)
    const freeNames = HERO_NAMES.filter((n) => !names.has(n))
    const name = freeNames[Math.floor(rng.next() * freeNames.length)]
    names.add(name)
    const l1 = poolFor(skillPool, 1)
    const fresh = l1.filter((k) => !skills.has(k.id))
    const from = fresh.length ? fresh : l1
    const k = from.length ? from[Math.floor(rng.next() * from.length)] : null
    if (k) skills.add(k.id)
    const equipment = dressPlan(rng, plan, (kind, piece) => pickRarity(kind, piece, deal), itemPool)
    out.push({ id: `pick-${i}`, name, ...base, equipment, skill: k?.id ?? null, plan })
  }
  // The Opening deal's Level 2 skill: one hero, chosen by a hash, swaps its
  // Level 1 skill for a Level 2 one from the run's pool (none held by another
  // hero of the pick). Off its own generator — the deal above is untouched.
  if (deal.skill2 && out.length) {
    const r2 = new RNG(hashSeed(runSeed, 'heroes', 'skill2'))
    const who = Math.floor(r2.next() * out.length)
    const l2 = poolFor(skillPool, 2).filter((x) => !out.some((c) => c.skill === x.id))
    if (l2.length) out[who] = { ...out[who], skill: l2[Math.floor(r2.next() * l2.length)].id }
  }
  return out
}

/**
 * The three heroes a run's hero pick deals — a pure function of the seed and
 * the two pools, so the same seed (a Daily, a typed seed) deals the same
 * three. Preview items carry isolated ids: calling this on every render mints
 * nothing.
 */
export function heroChoices(runSeed: number, skillPool: readonly string[], itemPool: readonly string[], deal: DealRules = BASE_DEAL): HeroChoice[] {
  return withIsolatedIds(() => dealChoices(runSeed, skillPool, itemPool, deal))
}

/**
 * The hero a choice becomes when it is chosen: the same name, stats, skill and
 * gear, re-dealt off the same hashed generator with real ids (so the items are
 * exactly the ones the card showed), under the same Opening deal.
 */
export function chosenHero(
  runSeed: number,
  skillPool: readonly string[],
  itemPool: readonly string[],
  id: string,
  statBonus = 0,
  deal: DealRules = BASE_DEAL,
): Sentinel | null {
  const idx = Number(/^pick-(\d)$/.exec(id)?.[1] ?? NaN)
  if (!Number.isInteger(idx) || idx < 0 || idx >= MAX_PICK) return null
  const c = dealChoices(runSeed, skillPool, itemPool, deal)[idx]
  return c ? previewOf(c, statBonus, createHero) : null
}

/** A choice as a Sentinel. `make` is `createHero` for a real hero; the default mints nothing. */
export function previewOf(c: HeroChoice, statBonus = 0, make: typeof createHero = previewHero): Sentinel {
  const hero = make({
    name: c.name,
    stats: { str: c.stats.str + statBonus, dex: c.stats.dex + statBonus, int: c.stats.int + statBonus },
    thorns: c.thorns,
    patience: c.patience,
    equipment: c.equipment,
  })
  return c.skill ? { ...hero, skills: [c.skill] } : hero
}

/** A Sentinel for showing, with a fixed id: never touches the id or name counters. */
function previewHero(spec: Parameters<typeof createHero>[0] = {}): Sentinel {
  return withIsolatedIds(() => ({ ...createHero({ ...spec, name: spec.name ?? 'Hero' }), id: `preview-${spec.name ?? 'hero'}` }))
}

// ---------------------------------------------------------------------------
// Hires
// ---------------------------------------------------------------------------

/**
 * A hire, rolled off `rng` (the loot stream) from the run's item pool: a
 * common weapon, maybe a common off-hand piece, no body (a hire arrives armed,
 * not dressed — the pack dresses it, `recruits.withRecruits`), and base stats
 * a little either side of its weapon-hand's. Named off the shared pool,
 * skipping anyone in `taken`.
 */
export function rollRecruitBody(rng: RNG, itemPool: readonly string[], taken: Iterable<string> = []): Sentinel {
  const plan = rollGearPlan(rng, itemPool, { offChance: RECRUIT_OFF_CHANCE, bodyChance: 0 })
  const base = rollBase(rng, ITEM_BASES[plan.main].style ?? null)
  const equipment = dressPlan(rng, plan, () => 'common', itemPool)
  return createHero({ ...base, equipment, name: nextName(taken) })
}

/**
 * The pick id a request names. A real id (`pick-0`) is itself; a LOOK name
 * (`'fighter'`, `'rogue'`, `'mystic'` — the old class names, now only the art a
 * weapon draws) is a compatibility shim for the dev handles, the screenshot
 * scripts and the store tests that picked "the Fighter": it names the first
 * dealt hero drawn that way, else the first hero. The UI never sends one.
 */
export function resolvePick(runSeed: number, skillPool: readonly string[], itemPool: readonly string[], idOrLook: string, deal: DealRules = BASE_DEAL): string {
  if (/^pick-\d$/.test(idOrLook)) return idOrLook
  const dealt = heroChoices(runSeed, skillPool, itemPool, deal)
  return (dealt.find((c) => lookOf(previewOf(c)) === idOrLook) ?? dealt[0]).id
}
