import { nextId, RNG } from '../core/rng'
import type { Archetype, Enchantment, HeroSlot, Item, ItemRarity, ItemSlot } from '../types'
import { getNode } from './archetypeTree'

export const RARITY_ORDER: ItemRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic']

/** The three equip slots on a hero, in display order. */
export const HERO_SLOTS: HeroSlot[] = ['mainHand', 'offHand', 'body']
export const HERO_SLOT_LABEL: Record<HeroSlot, string> = {
  mainHand: 'Main Hand',
  offHand: 'Off Hand',
  body: 'Body',
}
export const KIND_LABEL: Record<ItemSlot, string> = {
  oneHand: '1-Hand',
  twoHand: '2-Hand',
  offHand: 'Off-Hand',
  body: 'Body',
}
/** Which hero slot(s) an item of this kind may occupy. */
export function heroSlotsFor(kind: ItemSlot): HeroSlot[] {
  switch (kind) {
    case 'oneHand': return ['mainHand', 'offHand']
    case 'twoHand': return ['mainHand'] // also blocks offHand while equipped
    case 'offHand': return ['offHand']
    case 'body': return ['body']
  }
}

export const RARITY: Record<
  ItemRarity,
  { label: string; budget: number; enchants: number; color: string; dropWeight: number }
> = {
  common: { label: 'Common', budget: 1.0, enchants: 0, color: '#c3b291', dropWeight: 56 },
  rare: { label: 'Rare', budget: 1.7, enchants: 1, color: '#5fb0c4', dropWeight: 28 },
  epic: { label: 'Epic', budget: 2.8, enchants: 2, color: '#c67ab0', dropWeight: 11 },
  legendary: { label: 'Legendary', budget: 3.7, enchants: 3, color: '#f0b868', dropWeight: 4 },
  mythic: { label: 'Mythic', budget: 5.0, enchants: 4, color: '#ef6a3a', dropWeight: 1 },
}

// ---- weapon subtypes give damage a physical/magic identity + a hand cost ----
interface WeaponType {
  name: string
  damageType: 'physical' | 'magic'
  hands: 'oneHand' | 'twoHand'
  speedBias: number
}
const WEAPONS: WeaponType[] = [
  // one-hand: modest damage, can pair with an off-hand
  { name: 'Sword', damageType: 'physical', hands: 'oneHand', speedBias: 0.05 },
  { name: 'Axe', damageType: 'physical', hands: 'oneHand', speedBias: 0.02 },
  { name: 'Dagger', damageType: 'physical', hands: 'oneHand', speedBias: 0.12 },
  { name: 'Wand', damageType: 'magic', hands: 'oneHand', speedBias: 0.06 },
  { name: 'Rod', damageType: 'magic', hands: 'oneHand', speedBias: 0.03 },
  { name: 'Scepter', damageType: 'magic', hands: 'oneHand', speedBias: 0.04 },
  // two-hand: bigger damage, but fills both hands
  { name: 'Greatsword', damageType: 'physical', hands: 'twoHand', speedBias: -0.05 },
  { name: 'Warhammer', damageType: 'physical', hands: 'twoHand', speedBias: -0.08 },
  { name: 'Bow', damageType: 'physical', hands: 'twoHand', speedBias: 0.04 },
  { name: 'Staff', damageType: 'magic', hands: 'twoHand', speedBias: 0 },
  { name: 'Grimoire', damageType: 'magic', hands: 'twoHand', speedBias: 0.02 },
]
const OFFHANDS = ['Shield', 'Buckler', 'Tome', 'Quiver', 'Focus']
const BODIES = ['Plate', 'Mail', 'Robe', 'Cloak', 'Aegis']
const KEEPSAKES = ['Banner', 'Standard', 'Relic', 'Beacon', 'Oath']

// ---- enchantment pool (per-item) ----
interface EnchantTemplate {
  id: string
  label: string
  roll: (rng: RNG, budget: number) => Omit<Enchantment, 'id' | 'label'>
}

const round = (n: number) => Math.max(1, Math.round(n))

const ENCHANTS: EnchantTemplate[] = [
  { id: 'might', label: 'of Might', roll: (r, b) => ({ stats: { str: round(r.range(3, 6) * b) } }) },
  { id: 'precision', label: 'of Precision', roll: (r, b) => ({ stats: { dex: round(r.range(3, 6) * b) } }) },
  { id: 'insight', label: 'of Insight', roll: (r, b) => ({ stats: { int: round(r.range(3, 6) * b) } }) },
  /*
   * ---- left at `range(0.05, 0.1)`, and the reason is measured (F1-B) -------
   *
   * This band IS partly inert and that is a real finding, not a suspicion. Swept
   * against §4's three benches, the bench where range is the binding constraint
   * (`endure` — a blocking Weaponmaster whose 96px reach sees about 4% of a
   * 2290px lane) reads, in points over 12 seeds: +0.4 at ×1.05, +0.8 at ×1.10,
   * +0.8 at ×1.15, then +2.5 flat from ×1.20 to ×1.35, +3.3 at ×1.40, +4.6 at
   * ×1.50. A legendary roll spans ×1.18–×1.36, so its bottom third does nothing
   * anyone can measure, and a common roll (×1.05–×1.10) does nothing at all.
   *
   * Raising it to `range(0.07, 0.13)` was tried and REVERTED, because the cost
   * lands somewhere the affix table cannot see. Range is worth most against
   * whatever spends longest walking through it, so a stronger `reach` on every
   * generated item is a targeted discount on the *slowest* wave shape: on the
   * §14c bench it cut the depth-8 Column's leak from 6.96 to 4.37 while barely
   * moving the Swarm's (5.15 → 5.25), and the unadapted spread that gate exists
   * to bound went ×1.53 → **×1.88** against its ×2.00 ceiling. Buying an affix
   * fix by spending three quarters of a fairness margin somewhere else is the
   * trade this suite is supposed to refuse.
   *
   * So the affix keeps its shipped magnitude and is graded where it can be
   * graded (`AFFIX_HOME.reach` = `endure`, §4). Fixing the inert lower half
   * properly means making range non-linear in what it buys — coverage of the
   * *path*, not radius — which is an engine change, not a roll-table one.
   */
  { id: 'reach', label: 'of Reach', roll: (r, b) => ({ mods: { rangeMult: 1 + r.range(0.05, 0.1) * b } }) },
  { id: 'patience', label: 'of Patience', roll: (r, b) => ({ patience: round(r.range(2, 4) * b) }) },
  { id: 'cruelty', label: 'Cruel', roll: (r, b) => ({ mods: { critChanceAdd: r.range(0.04, 0.08) * b } }) },
  { id: 'ruin', label: 'Ruinous', roll: (r, b) => ({ mods: { critMultAdd: r.range(0.15, 0.3) * b } }) },
  { id: 'bursting', label: 'Bursting', roll: (r, b) => ({ mods: { splashAdd: round(r.range(6, 12) * b) } }) },
  { id: 'heavy', label: 'Heavy', roll: (r, b) => ({ mods: { damageMult: 1 + r.range(0.06, 0.12) * b } }) },
  { id: 'swift', label: 'Swift', roll: (r, b) => ({ mods: { rateMult: 1 + r.range(0.05, 0.1) * b } }) },
  { id: 'flaming', label: 'Flaming', roll: (r, b) => ({ mods: { burn: { dps: round(r.range(6, 12) * b), dur: 3 } } }) },
  /*
   * ---- a clamp is not a ladder (m-2) ---------------------------------------
   *
   * This rolled `range(0.15, 0.3) * budget` against a 0.6 cap, and the budget
   * ladder runs 1.0 / 1.7 / 2.5 / 3.6 / 5.0 — so from Epic upward the *cap* was
   * the roll. Measured over 6,000 generated items per tier:
   *
   *   rarity      rare    epic    legendary   mythic
   *   at the cap   0.0%   39.3%     87.9%     100.0%
   *   median      0.378   0.558     0.600     0.600
   *
   * A Legendary Frost was 0.600 nine times in ten and a Mythic one *always* was,
   * which means the top two tiers of the rarity ladder bought nothing at all on
   * this affix — and §4 scores `frost` at the highest uplift of any enchantment
   * in the game, at a value it rolls almost every time. This is the same defect
   * class as the `cx_vengeful` crit clamp (see the curse pool below): a number
   * whose stated range the engine silently collapses onto one point.
   *
   * Re-based, the ladder has room under the cap for its whole length:
   *
   *   rarity      rare    epic    legendary   mythic
   *   at the cap   0.0%    0.0%      0.0%     100.0%
   *   median      0.237   0.391     0.515      0.600
   *
   * Mythic is *supposed* to reach it — a cap that binds nowhere is not a cap —
   * and it is the tier with a drop weight of 1 against Common's 56. What was
   * wrong was the cap deciding the value three tiers down. §4's new
   * clamped-affix ladder invariant is what keeps it there, and it gates the
   * median rather than the pin share for exactly this reason.
   *
   * `executioner` below had the same defect, worse, and is re-based the same way.
   *
   * ---- and the epic/legendary BUDGETS were compensated, on purpose ----------
   *
   * This is a real difficulty change, so it was measured rather than assumed.
   * The two clamps were quietly paying the Epic tier a Legendary value on both
   * affixes — Epic frost was 0.558 against a 0.6 ceiling and Epic execute was
   * 0.25, *the cap itself*, 68.6% of the time — and the campaign's own
   * difficulty curve had been fitted with that inflation in place. Removing it
   * takes 6 points off §6's Monte Carlo win rate:
   *
   *   frost     executioner    §6 win rate
   *   shipped   shipped            48%
   *   shipped   re-based           47%
   *   re-based  shipped            46%
   *   re-based  re-based        ** 42% **   (design band 45–60%)
   *
   * — and the loss is concentrated at Epic, which is exactly where §6 runs die
   * (`depthRarity` hands out Epic at depths 6–8). So the compensation goes where
   * the inflation was: `RARITY.epic.budget` 2.5 → 2.8 and `legendary` 3.6 → 3.7,
   * which restores the tier's real power to what the clamps had been delivering
   * by accident and returns §6 to **48%** — the number it read before any of
   * this. The ladder is still monotone (1.0 / 1.7 / 2.8 / 3.7 / 5.0) and §3
   * checks that it is.
   */
  { id: 'frost', label: 'Frost', roll: (r, b) => ({ mods: { chill: { slow: Math.min(0.6, r.range(0.12, 0.16) * b), dur: 1.5 } } }) },
  { id: 'shocking', label: 'Shocking', roll: (r) => ({ mods: { shock: { chains: r.int(1, 2), dmgFrac: 0.5 } } }) },
  { id: 'piercing', label: 'Piercing', roll: (r) => ({ mods: { pierce: r.int(1, 2) } }) },
  { id: 'vampiric', label: 'Vampiric', roll: (r, b) => ({ mods: { lifedrain: r.range(0.1, 0.2) * b } }) },
  // Was `range(0.08, 0.14) * budget` against the 0.25 cap: **100%** of Legendary
  // and Mythic rolls came out at exactly 0.25, and 68.6% of Epic ones — so from
  // Epic up, every Executioner in the game was the same item. Re-based (medians
  // 0.098 / 0.162 / 0.212 / 0.250, nothing pinned below Mythic). See `frost`
  // above for the measurement and for the budget compensation that pays for it.
  { id: 'executioner', label: 'Executioner', roll: (r, b) => ({ mods: { execute: Math.min(0.25, r.range(0.05, 0.065) * b) } }) },
]

// ---- curse pool: dramatic tradeoffs (a big upside bought with a real downside).
// Rolled rarely on epic+ items as an extra affix; flat magnitudes (not budget-
// scaled) so the gamble reads the same on every high-rarity item.
//
// **What was wrong (M7).** Four of the five were straight upgrades wearing a
// curse label — balance §10 measured Vengeful at +25.9pt in its *worst* scenario,
// Reckless +16.8, Frenzied +11.8, Wild +6.5. Two failure modes produced all four:
//
//  1. *The downside was smaller than the upside on the same axis.* `cx_frenzied`
//     was ×1.7 rate for ×0.72 damage — arithmetically **+22% DPS for free**.
//  2. *The downside clamped away.* `cx_vengeful` paid +55% damage for −15% crit
//     chance, and `computeCombat` clamps crit to `[0, 0.95]`, so on any low-crit
//     build the cost was exactly zero.
//
// The rule now: what a curse sells is a *shape* — burst vs flurry, crit vs area
// — and it must be a genuinely bad pick on the builds that shape fights. Where a
// curse costs crit, it removes crit outright rather than shaving a percentage
// that a mystic never had.
//
// **The corollary the first pass got wrong (M19-g).** "Cancel on raw throughput"
// is not enough on its own, and for `cx_frenzied` it was actively the bug: a
// pair that cancels arithmetically and trades on an axis the engine cannot read
// is an affix that does nothing, which the two-sided §10 floor now catches. Every
// curse below is therefore priced on an axis `computeCombat` and the battle loop
// actually branch on — crit, splash radius, per-hit procs — and §10 measures
// each of them at ≥+2pt somewhere and ≥2pt of cost somewhere. ----
const CURSE_ENCHANTS: EnchantTemplate[] = [
  // Burst: net ×1.02 throughput, all of it front-loaded into single huge hits.
  // Wasted on anything that dies to a normal hit; lethal against armour.
  { id: 'cx_reckless', label: 'Reckless', roll: () => ({ mods: { damageMult: 1.85, rateMult: 0.55 } }) },
  // Flurry: ×1.9 rate for ×0.6 damage, and it never crits.
  //
  // **Why the crit clause is here (M19-g).** The first version of this was a
  // pure shape trade — ×1.9 rate for ×0.5 damage, throughput ×0.95 — and §10
  // measured it at −0.6pt / +13.6pt: a plain upgrade wearing a curse label,
  // because the *shape* it sold does not exist. The engine has no mechanic that
  // distinguishes many small hits from few big ones: resists are fractional,
  // there is no flat armour, and no threshold anywhere turns a halved hit into
  // a wasted one. Sweeping the rate/damage pair from ×1.9/×0.5 out to ×4.0/×0.3
  // never produced a stable cost on the single-target bench — the phys column
  // wandered −5.2, −1.7, +3.5, +3.1, +5.8, −0.7, −2.0pt with no trend, which is
  // noise, not a tradeoff.
  //
  // What the engine *does* read is crit, the only per-hit spike it has — so
  // that is the axis a hit-size trade can be priced against, and Frenzied and
  // `cx_vengeful` now sit on opposite sides of it. Vengeful buys raw damage
  // with its crit and wants FEWER, bigger hits; Frenzied buys attack speed with
  // its crit and wants MANY, cheaper ones — each hit re-rolls splash, shock
  // chains, burn refreshes and every on-hit proc, none of which care how big it
  // was. Priced at ×1.9/×0.6 (+14% raw throughput) the crit clause takes ~25%
  // of a crit carrier's damage and all of its burst: §10 measures −9.9pt on the
  // Sharpshooter and +22.4pt on the low-crit Stormcaller, and the whole
  // neighbourhood (rate 1.8–2.2 × damage 0.60–0.70) holds the same two signs.
  { id: 'cx_frenzied', label: 'Frenzied', roll: () => ({ mods: { rateMult: 2, damageMult: 0.65, critChanceAdd: -1 } }) },
  // Crit for area: enormous on a crit carrier, catastrophic on a splash mystic
  // (a −70 splash add zeroes a Stormcaller's 83px blast), and it still costs
  // every build a quarter of its rate.
  { id: 'cx_wild', label: 'Wild', roll: () => ({ mods: { critChanceAdd: 0.25, critMultAdd: 0.9, rateMult: 0.75, splashAdd: -70 } }) },
  // Area for damage — the one curse that was already a real tradeoff.
  { id: 'cx_erratic', label: 'Erratic', roll: () => ({ mods: { splashAdd: 34, damageMult: 0.82 } }) },
  // Damage for crit, priced so the clamp can never hide it: −100% crit chance
  // means *never crits*, which costs a Sharpshooter ~46% of its damage and a
  // low-crit mystic ~5%. Now it is a real question of who wears it.
  { id: 'cx_vengeful', label: 'Vengeful', roll: () => ({ mods: { damageMult: 1.6, critChanceAdd: -1 } }) },
]
const CURSE_CHANCE = 0.2

// ---- keepsake pool (team-wide global mods) ----
const KEEPSAKE_ENCHANTS: EnchantTemplate[] = [
  { id: 'k_rally', label: 'of Rallying', roll: (r, b) => ({ mods: { damageMult: 1 + r.range(0.05, 0.1) * b } }) },
  { id: 'k_quicken', label: 'of Haste', roll: (r, b) => ({ mods: { rateMult: 1 + r.range(0.05, 0.09) * b } }) },
  { id: 'k_focus', label: 'of Focus', roll: (r, b) => ({ mods: { critChanceAdd: r.range(0.03, 0.06) * b } }) },
  { id: 'k_reach', label: 'of the Hunt', roll: (r, b) => ({ mods: { rangeMult: 1 + r.range(0.06, 0.12) * b } }) },
  { id: 'k_ruin', label: 'of Ruin', roll: (r, b) => ({ mods: { critMultAdd: r.range(0.2, 0.4) * b } }) },
]

function rollEnchantments(pool: readonly EnchantTemplate[], count: number, budget: number, rng: RNG): Enchantment[] {
  const chosen: Enchantment[] = []
  const used = new Set<string>()
  let guard = 0
  while (chosen.length < count && guard++ < 40) {
    const t = rng.pick(pool)
    if (used.has(t.id)) continue
    used.add(t.id)
    chosen.push({ id: t.id, label: t.label, ...t.roll(rng, budget) })
  }
  return chosen
}

function baseFor(slot: ItemSlot, budget: number, rng: RNG, weapon?: WeaponType): Item['base'] {
  if (slot === 'oneHand' || slot === 'twoHand') {
    const w = weapon!
    // two-handers hit noticeably harder in exchange for the off-hand slot
    const dmg = round(rng.range(slot === 'twoHand' ? 9 : 5, slot === 'twoHand' ? 13 : 8) * budget)
    // L9c: `speedBias * budget` scaled the *penalty* on two-handers, so a Mythic
    // Warhammer (−0.08 × 5.0 = −40% attack speed) swung slower than a Common one
    // (−0.08 × 1.0 = −8%). Rarity is a budget, and a budget may only buy upside:
    // a positive bias scales with rarity, a negative one is the weapon class's
    // fixed handling cost and never grows.
    const atkSpeed = w.speedBias >= 0 ? w.speedBias * budget : w.speedBias
    return w.damageType === 'physical'
      ? { physDamage: dmg, attackSpeed: atkSpeed }
      : { magDamage: dmg, attackSpeed: atkSpeed }
  }
  if (slot === 'offHand') {
    // "Precision" slot — attack speed + crit, useful on every tower
    return {
      attackSpeed: rng.range(0.04, 0.08) * budget,
      critChance: rng.range(0.03, 0.06) * budget,
    }
  }
  // body — the "Amplifier" slot: reach + area, useful on every tower
  return {
    rangeMult: rng.range(0.06, 0.12) * budget,
    splashAdd: round(rng.range(8, 16) * budget),
  }
}

const pickRarity = (rng: RNG): ItemRarity => {
  const total = RARITY_ORDER.reduce((s, r) => s + RARITY[r].dropWeight, 0)
  let roll = rng.range(0, total)
  for (const r of RARITY_ORDER) {
    roll -= RARITY[r].dropWeight
    if (roll <= 0) return r
  }
  return 'common'
}

// ---------------------------------------------------------------------------
// Roster-aware offers (M9)
// ---------------------------------------------------------------------------
/**
 * **Half of every weapon offer used to be dead on arrival.**
 *
 * `computeCombat` reads exactly ONE flat damage pool per tower —
 * `flat = isPhys ? gear.flatPhys : gear.flatMag` — so a Staff's `magDamage`
 * contributes **0** on a fighter or a rogue, and a Greatsword's `physDamage`
 * contributes 0 on a mystic. Only `attackSpeed` (the weapon's `speedBias`)
 * survives the mismatch. The same cut runs through two enchants: the damage stat
 * is `isPhys ? str : int`, so `insight` is worth *literally nothing* on a
 * physical tower and `might` on a mystic buys only the HP term in
 * `70 + str * 9`.
 *
 * Nothing weighted drops by the team that actually exists, and `generateItem`
 * was called roster-blind from every source. On a mono-archetype roster — which
 * is where a lot of runs start and where the fresh-player cell lives — that made
 * roughly half of all weapon cards a non-offer, spent out of the scarcest
 * resource a roguelite has: the reward moment.
 *
 * **What this does NOT do** is solve the loot table. Off-archetype items stay
 * common (see OFF_TYPE_FLOOR): a magic weapon on a fighter line is still a real
 * find once a mystic joins, gear is tradeable across the roster, and a table
 * that only ever offers what you already use has no texture. The goal is fewer
 * dead offers, not a guaranteed one.
 *
 * Off-hands, bodies and keepsakes are deliberately untouched: `attackSpeed`,
 * `critChance`, `rangeMult` and `splashAdd` are archetype-blind in the engine,
 * so those slots have no dead half to weight away.
 */
export interface RosterRef {
  archetype: Archetype
}

/**
 * How rare an off-archetype roll gets, as a fraction of an on-archetype one.
 * At 0.45 a mono-mystic roster still sees a physical one-hander about a third
 * of the time (3 × 0.45 against 3 × 1.0) instead of half. A roster split evenly
 * between the two damage types resolves to equal weights, i.e. exactly today's
 * table — mixed teams are not "corrected" at all.
 */
const OFF_TYPE_FLOOR = 0.45
/**
 * Weights are applied by repeating entries in the pool and then using the
 * ordinary `rng.pick`, so a weighted draw consumes exactly one `next()` — the
 * same as an unweighted one. That keeps a seeded stream's POSITION independent
 * of the roster, which is what lets a resumed run continue rather than diverge.
 */
const WEIGHT_RES = 8

/** Damage type per archetype, read from the tree so there is one authority. */
const damageTypeOf = (a: Archetype): 'physical' | 'magic' => getNode(a).base?.damageType ?? 'physical'

type DamageType = 'physical' | 'magic'

/**
 * A weight in (0, 1] for each damage type, given who is on the field.
 * Undefined/empty roster ⇒ 1 for both ⇒ every pool below is left untouched and
 * the generator behaves exactly as it did before this change.
 */
function typeDemand(roster: readonly RosterRef[] | undefined): Record<DamageType, number> {
  if (!roster || roster.length === 0) return { physical: 1, magic: 1 }
  let phys = 0
  for (const s of roster) if (damageTypeOf(s.archetype) === 'physical') phys++
  const share = phys / roster.length
  return {
    physical: OFF_TYPE_FLOOR + (1 - OFF_TYPE_FLOOR) * share,
    magic: OFF_TYPE_FLOOR + (1 - OFF_TYPE_FLOOR) * (1 - share),
  }
}

/** Repeat each entry ~`weight × WEIGHT_RES` times. Every entry keeps ≥1 copy. */
function weightedPool<T>(items: readonly T[], weight: (item: T) => number): readonly T[] {
  const out: T[] = []
  for (const item of items) {
    const copies = Math.max(1, Math.round(weight(item) * WEIGHT_RES))
    for (let i = 0; i < copies; i++) out.push(item)
  }
  return out
}

/**
 * The two enchants whose worth is gated on the wearer's damage type. Everything
 * else in ENCHANTS is archetype-blind: `precision` feeds rate and crit, which
 * every tower uses, and the `mods`-based affixes are read by the engine the same
 * way whoever wears them.
 */
const ENCHANT_AFFINITY: Record<string, DamageType> = {
  might: 'physical', // STR: damage on a fighter/rogue, HP only on a mystic
  insight: 'magic', // INT: damage on a mystic, nothing at all on anyone else
}

// ---------------------------------------------------------------------------
// Rarity pity (M9)
// ---------------------------------------------------------------------------
/**
 * **The game had no pity timer anywhere.** Item rarity, reward-card kind and
 * shrine identity were all raw iid rolls, so a 16% epic-or-better rate means a
 * one-in-five chance of going nine drops without one, and that player's run just
 * quietly has no gear in it. Streaks are what iid rolls are for; a roguelite
 * reward loop is not the place for them.
 *
 * This is deliberately the smallest possible version: a dry counter that buys
 * ordinary `luck`, which is the mechanism the generator already had for elite
 * and boss drops. Nothing new can happen — the ceiling is the same tier bump
 * that a boss node hands out — it just stops arriving never.
 *
 * The counter is STATE, not randomness, so it belongs to the run and must be
 * snapshotted with it. Pass the same object every roll; `generateItem` advances
 * it in place.
 */
export interface RarityPity {
  /** Unforced rolls the player has RECEIVED since the last epic-or-better drop. */
  dry: number
}
export const newRarityPity = (): RarityPity => ({ dry: 0 })

/**
 * Drops this deep into a drought cost nothing — most droughts end on their own,
 * and buying out the short ones is what would actually move the economy. Measured
 * over 200k unforced rolls at luck 0: droughts of 15+ fall 2299 -> 524 and 20+
 * fall 962 -> 26, for +2.0pt on the epic-or-better rate (16.1% -> 18.1%).
 */
const PITY_GRACE = 6
/** Extra luck per dry roll past the grace period. */
const PITY_STEP = 0.12
/** At 1.0 the tier bump stops being a coin flip and becomes a guarantee. */
const PITY_MAX = 1
/** What ends a drought. */
const PITY_TIER: ItemRarity = 'epic'

/** The luck a drought has earned. 0 with no pity state, so callers opt in. */
export const pityLuck = (p: RarityPity | undefined): number =>
  p ? Math.min(PITY_MAX, PITY_STEP * Math.max(0, p.dry - PITY_GRACE)) : 0

export interface GenerateOpts {
  slot?: ItemSlot
  rarity?: ItemRarity
  keepsakeChance?: number
  /** Shift rarity odds upward, e.g. elite/boss loot. 0 = normal. */
  luck?: number
  /**
   * Who the drop is for (M9). Optional, and omitting it reproduces the previous
   * roster-blind table exactly — including the RNG stream position, so no
   * existing caller, sweep or seeded replay moves.
   */
  roster?: readonly RosterRef[]
  /**
   * Run-scoped rarity pity (M9). The drought it records buys luck on this roll.
   * Omit it and no pity is applied and none accrues.
   */
  pity?: RarityPity
  /**
   * Whether this roll spends the counter, i.e. whether the player is receiving
   * the item (default true).
   *
   * Pass `false` for a roll that is only an OFFER — a reward card in a hand of
   * three, a merchant's shelf — and call {@link creditPity} at the moment the
   * player actually takes one. The unit is documented as "unforced rolls since
   * the last epic-or-better **drop**", and it was being spent, and *reset*, by
   * cards that went in the bin: a hand of [item, stat, item] moved the counter
   * by two while the player took the stat card, and a discarded epic ended a
   * drought with a drop nobody ever saw (F4).
   */
  commitPity?: boolean
}

/**
 * Charge the pity counter for an item the player has actually RECEIVED.
 *
 * The counterpart to `commitPity: false`: the roll applies the drought's luck,
 * this spends it. Same rule the generator used to apply inline — an
 * epic-or-better ends the drought, anything else lengthens it — just moved to
 * the moment of receipt (F4).
 */
export function creditPity(pity: RarityPity, rarity: ItemRarity): void {
  pity.dry = RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf(PITY_TIER) ? 0 : pity.dry + 1
}

/** Generate a random item. */
export function generateItem(rng: RNG, opts: GenerateOpts = {}): Item {
  let rarity = opts.rarity ?? pickRarity(rng)
  // Luck: chance to bump rarity up a tier. Whole units of luck (only reachable
  // through pity) are guaranteed bumps; the fraction is the same single coin
  // flip this has always been, taken only when there is a tier left to win —
  // preserving both the result and the stream position for every luck < 1.
  if (opts.rarity === undefined) {
    const luck = (opts.luck ?? 0) + pityLuck(opts.pity)
    if (luck > 0) {
      let bumps = Math.floor(luck)
      if (RARITY_ORDER.indexOf(rarity) < RARITY_ORDER.length - 1 && rng.chance(luck - bumps)) bumps++
      for (let i = 0; i < bumps; i++) {
        const idx = RARITY_ORDER.indexOf(rarity)
        if (idx >= RARITY_ORDER.length - 1) break
        rarity = RARITY_ORDER[idx + 1]
      }
    }
    // Only a roll the player is RECEIVING spends the counter (F4). An offer
    // rolls with the drought's luck and leaves the counter where it was; the
    // receipt site calls `creditPity` with the rarity actually taken.
    if (opts.pity && opts.commitPity !== false) creditPity(opts.pity, rarity)
  }
  const cfg = RARITY[rarity]
  const demand = typeDemand(opts.roster)
  // Keepsakes only appear on unforced (random-slot) drops. They wear on the body
  // slot but buff the whole team instead of the holder.
  const isKeepsake = opts.slot === undefined && rng.chance(opts.keepsakeChance ?? 0.12)
  const slot: ItemSlot = opts.slot ?? rng.pick(['oneHand', 'oneHand', 'twoHand', 'offHand', 'body', 'body'] as ItemSlot[])

  if (isKeepsake) {
    const noun = rng.pick(KEEPSAKES)
    const ench = rollEnchantments(KEEPSAKE_ENCHANTS, Math.max(1, cfg.enchants), cfg.budget, rng)
    return {
      id: nextId('itm'),
      name: `${cfg.label} ${noun} ${ench[0]?.label ?? ''}`.trim(),
      slot: 'body',
      rarity,
      base: {},
      enchantments: ench,
      keepsake: true,
    }
  }

  const isWeapon = slot === 'oneHand' || slot === 'twoHand'
  // With no roster the pools are the literal arrays, so the draw is byte-for-byte
  // the one this generator has always made.
  const rosterAware = !!opts.roster && opts.roster.length > 0
  const weapon = isWeapon
    ? rng.pick(
        rosterAware
          ? weightedPool(
              WEAPONS.filter((w) => w.hands === slot),
              (w) => demand[w.damageType],
            )
          : WEAPONS.filter((w) => w.hands === slot),
      )
    : undefined
  const noun = isWeapon ? weapon!.name : slot === 'offHand' ? rng.pick(OFFHANDS) : rng.pick(BODIES)
  const enchantPool = rosterAware
    ? weightedPool(ENCHANTS, (e) => {
        const affinity = ENCHANT_AFFINITY[e.id]
        return affinity ? demand[affinity] : 1
      })
    : ENCHANTS
  const ench = rollEnchantments(enchantPool, cfg.enchants, cfg.budget, rng)
  // Epic+ items can roll a rare "curse": a dramatic extra affix with a downside.
  const canCurse = rarity === 'epic' || rarity === 'legendary' || rarity === 'mythic'
  if (canCurse && rng.chance(CURSE_CHANCE)) {
    const c = rng.pick(CURSE_ENCHANTS)
    ench.push({ id: c.id, label: c.label, ...c.roll(rng, cfg.budget) })
  }
  const name = nameItem(cfg.label, noun, ench)
  // Mythic items grant a free level toward a slot-themed upgrade path.
  const grantUpgrade =
    rarity === 'mythic'
      ? { path: slot === 'body' ? 'tempo' : slot === 'offHand' ? 'precision' : 'power', levels: 1 }
      : undefined
  return {
    id: nextId('itm'),
    name: name.trim(),
    slot,
    rarity,
    base: baseFor(slot, cfg.budget, rng, weapon),
    enchantments: ench,
    ...(grantUpgrade ? { grantUpgrade } : {}),
  }
}

// ---- economy sinks ----
export function reforgeCost(item: Item): number {
  return { common: 20, rare: 35, epic: 60, legendary: 100, mythic: 160 }[item.rarity]
}
export function upgradeCost(item: Item): number {
  // Cost to reach the NEXT tier from this one (0 at the top tier).
  return { common: 50, rare: 90, epic: 150, legendary: 260, mythic: 0 }[item.rarity]
}
/** Dust costs used by the Endless Watch Forge. */
export function reforgeDust(item: Item): number {
  return { common: 4, rare: 7, epic: 12, legendary: 20, mythic: 32 }[item.rarity]
}
export function upgradeDust(item: Item): number {
  return { common: 8, rare: 14, epic: 24, legendary: 40, mythic: 0 }[item.rarity]
}
export function canUpgrade(item: Item): boolean {
  return RARITY_ORDER.indexOf(item.rarity) < RARITY_ORDER.length - 1
}

/** Reroll an item's enchantments (same slot count for its rarity). */
export function reforgeItem(item: Item, rng: RNG): Item {
  const cfg = RARITY[item.rarity]
  const pool = item.keepsake ? KEEPSAKE_ENCHANTS : ENCHANTS
  const count = item.keepsake ? Math.max(1, cfg.enchants) : cfg.enchants
  const ench = rollEnchantments(pool, count, cfg.budget, rng)
  return { ...item, enchantments: ench, name: renameFor(item, ench) }
}

/** Upgrade an item's rarity one tier: more base budget + an extra enchant slot. */
export function upgradeRarity(item: Item, rng: RNG): Item {
  if (!canUpgrade(item)) return item
  const next = RARITY_ORDER[RARITY_ORDER.indexOf(item.rarity) + 1]
  const cfg = RARITY[next]
  const scale = cfg.budget / RARITY[item.rarity].budget
  const floatKeys = new Set(['attackSpeed', 'critChance', 'rangeMult'])
  const base: Item['base'] = { ...item.base }
  for (const k of Object.keys(base) as (keyof Item['base'])[]) {
    if (base[k] == null) continue
    // Never scale a negative field: upgrading a two-hander's rarity must not
    // deepen its handling penalty (L9c, same rule as `baseFor`).
    if (base[k]! < 0) continue
    base[k] = floatKeys.has(k) ? base[k]! * scale : Math.round(base[k]! * scale)
  }
  // Keep existing enchantments, add new ones to reach the higher slot count.
  const pool = item.keepsake ? KEEPSAKE_ENCHANTS : ENCHANTS
  const target = item.keepsake ? Math.max(1, cfg.enchants) : cfg.enchants
  const used = new Set(item.enchantments.map((e) => e.id))
  const extra: Enchantment[] = []
  let guard = 0
  while (item.enchantments.length + extra.length < target && guard++ < 40) {
    const t = rng.pick(pool)
    if (used.has(t.id)) continue
    used.add(t.id)
    extra.push({ id: t.id, label: t.label, ...t.roll(rng, cfg.budget) })
  }
  const enchantments = [...item.enchantments, ...extra]
  return { ...item, rarity: next, base, enchantments, name: renameFor({ ...item, rarity: next }, enchantments) }
}

/** Compose an item name: [prefix] Rarity Noun [of Suffix]. A curse wins the prefix. */
function nameItem(rarityLabel: string, noun: string, ench: Enchantment[]): string {
  const suffix = ench.find((e) => e.label.startsWith('of'))
  const prefix =
    ench.find((e) => e.id.startsWith('cx_')) ?? ench.find((e) => !e.label.startsWith('of'))
  return `${prefix ? prefix.label + ' ' : ''}${rarityLabel} ${noun}${suffix ? ' ' + suffix.label : ''}`.trim()
}

function renameFor(item: Item, ench: Enchantment[]): Item['name'] {
  const cfg = RARITY[item.rarity]
  const nounMatch = item.name.match(/(Greatsword|Sword|Axe|Dagger|Wand|Rod|Scepter|Warhammer|Bow|Staff|Grimoire|Shield|Buckler|Tome|Quiver|Focus|Plate|Mail|Robe|Cloak|Aegis|Banner|Standard|Relic|Beacon|Oath)/)
  const noun = nounMatch?.[0] ?? 'Relic'
  if (item.keepsake) return `${cfg.label} ${noun} ${ench[0]?.label ?? ''}`.trim()
  return nameItem(cfg.label, noun, ench)
}

/** Human-readable base-stat lines for tooltips. */
export function describeBase(item: Item): string[] {
  const b = item.base
  const out: string[] = []
  const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
  if (b.physDamage) out.push(`+${b.physDamage} Physical Damage`)
  if (b.magDamage) out.push(`+${b.magDamage} Magic Damage`)
  if (b.attackSpeed) out.push(`${signed(Math.round(b.attackSpeed * 100))}% Attack Speed`)
  if (b.critChance) out.push(`+${Math.round(b.critChance * 100)}% Crit Chance`)
  if (b.rangeMult) out.push(`+${Math.round(b.rangeMult * 100)}% Range`)
  if (b.splashAdd) out.push(`+${b.splashAdd} Splash Radius`)
  return out
}
