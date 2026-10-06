import { nextId, RNG } from '../core/rng'
import type { Enchantment, HeroSlot, Item, ItemRarity, ItemSlot, Sentinel } from '../types'

export const RARITY_ORDER: ItemRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic']

/** The three equip slots on a hero, in display order. */
export const HERO_SLOTS: HeroSlot[] = ['mainHand', 'offHand', 'body']
export const HERO_SLOT_LABEL: Record<HeroSlot, string> = {
  mainHand: 'Main Hand',
  offHand: 'Off Hand',
  body: 'Body',
}
/*
 * ---------------------------------------------------------------------------
 * What each hand may hold (round 3, Q4 + Q5)
 * ---------------------------------------------------------------------------
 *
 * The designer's rule: "only off hand weapons or items can go in there so maybe
 * a knife or a shield or a wand, but not something big". So every item BASE —
 * the noun the generator names it by — carries a grip, and the grip, not the
 * item's damage kind, decides which hand takes it:
 *
 *   grip      hands                       bases
 *   main      main hand                   Sword, Axe, Rod, Sceptre
 *   either    main hand OR off hand       Dagger, Wand
 *   off       off hand                    Shield, Buckler, Tome, Quiver, Focus
 *   twoHand   main hand, empties the off  Greatsword, Warhammer, Bow, Staff, Grimoire
 *   body      body                        Plate, Mail, Robe, Cloak, Aegis (+ keepsakes)
 *
 * A knife or a wand in the OFF hand is a light second weapon: its damage and
 * attack speed count at {@link OFF_HAND_SHARE} there (`combat.gearOf`), in
 * full in the main hand.
 *
 * The one exception is the Twinblade Harness relic (`data/relics.ts`, Q4): a
 * hero with {@link DUAL_WIELD_DEX} DEX of their own may carry a `main` grip
 * one-hander in the off hand too, and it counts in full there — a real second
 * weapon, not a light one. Big things (`twoHand`) never go in the off hand.
 *
 * The noun is read out of the item's name ({@link itemNoun}) because that is
 * where it lives — the same single regex `renameFor` and the shell's icon table
 * read. A name with no noun this table knows (a hand-built item) falls back to
 * its kind's grip, and a noun only classifies an item of its own kind, so a
 * name can never move an item across kinds.
 */
export type Grip = 'main' | 'either' | 'off' | 'twoHand' | 'body'

/**
 * What a weapon makes its holder DO (the classless rework): `swing` up close,
 * `shoot` from range, or `cast` magic. A hero's style is its main hand's
 * (`heroStyle`); there is no class any more, so this table IS the role table.
 */
export type HeroStyle = 'swing' | 'shoot' | 'cast'

interface BaseInfo {
  slot: ItemSlot
  grip: Grip
  swings?: true
  /** The style a weapon gives its holder (weapons only). */
  style?: HeroStyle
  /** Enemies a shield holds on the road (off-hand shields only). */
  hold?: number
  /** Thorns a shield adds — the damage a second it grinds into what it holds. */
  thorns?: number
}

/** Every item base the game generates (or once did), with its kind and grip. */
export const ITEM_BASES: Readonly<Record<string, BaseInfo>> = {
  Sword: { slot: 'oneHand', grip: 'main', swings: true, style: 'swing' },
  Axe: { slot: 'oneHand', grip: 'main', swings: true, style: 'swing' },
  Rod: { slot: 'oneHand', grip: 'main', style: 'cast' },
  Sceptre: { slot: 'oneHand', grip: 'main', style: 'cast' },
  Scepter: { slot: 'oneHand', grip: 'main', style: 'cast' },
  Dagger: { slot: 'oneHand', grip: 'either', style: 'shoot' },
  Wand: { slot: 'oneHand', grip: 'either', style: 'cast' },
  Greatsword: { slot: 'twoHand', grip: 'twoHand', swings: true, style: 'swing' },
  Warhammer: { slot: 'twoHand', grip: 'twoHand', swings: true, style: 'swing' },
  Bow: { slot: 'twoHand', grip: 'twoHand', style: 'shoot' },
  Staff: { slot: 'twoHand', grip: 'twoHand', style: 'cast' },
  Grimoire: { slot: 'twoHand', grip: 'twoHand', style: 'cast' },
  // A shield in the off hand holds enemies on the road; a bigger one holds more.
  Buckler: { slot: 'offHand', grip: 'off', hold: 1, thorns: 3 },
  Shield: { slot: 'offHand', grip: 'off', hold: 2, thorns: 6 },
  Pavise: { slot: 'offHand', grip: 'off', hold: 3, thorns: 9 },
  Tome: { slot: 'offHand', grip: 'off' },
  Quiver: { slot: 'offHand', grip: 'off' },
  Focus: { slot: 'offHand', grip: 'off' },
  Plate: { slot: 'body', grip: 'body' },
  Mail: { slot: 'body', grip: 'body' },
  Robe: { slot: 'body', grip: 'body' },
  Cloak: { slot: 'body', grip: 'body' },
  Aegis: { slot: 'body', grip: 'body' },
  // The Sovereign tier (Level 4, `itemKinds.ts`): dealt only once owned.
  'Saffron Brand': { slot: 'oneHand', grip: 'main', swings: true, style: 'swing' },
  'Moonquill Codex': { slot: 'twoHand', grip: 'twoHand', style: 'cast' },
  'Gilded Easel': { slot: 'offHand', grip: 'off', hold: 4, thorns: 12 },
  'Ironheart Plate': { slot: 'body', grip: 'body' },
  'Silkwind Cloak': { slot: 'body', grip: 'body' },
  Banner: { slot: 'body', grip: 'body' },
  Standard: { slot: 'body', grip: 'body' },
  Relic: { slot: 'body', grip: 'body' },
  Beacon: { slot: 'body', grip: 'body' },
  Oath: { slot: 'body', grip: 'body' },
}

/** The base an item is, when its noun is known AND matches its kind. */
export function baseOf(item: Pick<Item, 'name' | 'slot'> | null | undefined): BaseInfo | undefined {
  if (!item) return undefined
  const noun = itemNoun(item)
  const base = noun ? ITEM_BASES[noun] : undefined
  return base && base.slot === item.slot ? base : undefined
}

/** The style a weapon gives its holder, or null for anything that is not one. */
export const itemStyle = (item: Pick<Item, 'name' | 'slot'> | null | undefined): HeroStyle | null => baseOf(item)?.style ?? null

/**
 * What a hero DOES — its main hand's style; with nothing there, a light weapon
 * in the off hand (a knife or a wand); otherwise null (unarmed: it throws
 * stones, `combat.UNARMED`).
 */
export function heroStyle(hero: Pick<Sentinel, 'equipment'>): HeroStyle | null {
  return itemStyle(hero.equipment.mainHand) ?? itemStyle(hero.equipment.offHand)
}

/** Physical for swords, axes, bows and knives; magic for wands, rods, staves and grimoires. */
export const styleDamageType = (style: HeroStyle | null): DamageType => (style === 'cast' ? 'magic' : 'physical')

/** The damage type a hero deals, read off what it holds. */
export const heroDamageType = (hero: Pick<Sentinel, 'equipment'>): DamageType => styleDamageType(heroStyle(hero))

/** How many enemies a shield holds (0 for anything else). */
export const shieldHold = (item: Pick<Item, 'name' | 'slot'> | null | undefined): number => baseOf(item)?.hold ?? 0
/** The thorns a shield adds (0 for anything else). */
export const shieldThorns = (item: Pick<Item, 'name' | 'slot'> | null | undefined): number => baseOf(item)?.thorns ?? 0

/**
 * Does this item SWING — is it a heavy blade or a hammer that a hero sweeps all
 * round itself? `swings` in {@link ITEM_BASES}: the physical weapons of the
 * `main` and `twoHand` grips (Sword, Axe, Greatsword, Warhammer). Not the
 * knife (a light, `either`-grip piece — thrown or stabbed, the Rogue's
 * long-range strike), not the bow, and not the casters' one- and two-handers
 * (Wand, Rod, Sceptre, Staff, Grimoire), which point rather than swing. A hero
 * holding one keeps a clearance (`engine/melee.isMelee`). Like
 * {@link gripOf}, a noun only classifies an item of its own kind, and a name
 * with no known noun does not swing.
 */
export function itemSwings(item: Pick<Item, 'name' | 'slot'> | null | undefined): boolean {
  if (!item) return false
  const noun = itemNoun(item)
  const base = noun ? ITEM_BASES[noun] : undefined
  return !!base && base.slot === item.slot && !!base.swings
}

/** A kind's grip when the name carries no known noun. */
const KIND_GRIP: Record<ItemSlot, Grip> = { oneHand: 'main', twoHand: 'twoHand', offHand: 'off', body: 'body' }

/**
 * The one noun regex. A single alternation matches leftmost-by-position, so the
 * noun EARLIEST in the name wins (`Banner of Focus` is a Banner), and branch
 * order only breaks ties at one position (`Greatsword` before `Sword`).
 */
export const ITEM_NOUN_RE =
  /(Saffron Brand|Moonquill Codex|Gilded Easel|Ironheart Plate|Silkwind Cloak|Greatsword|Sword|Axe|Dagger|Wand|Rod|Scepter|Sceptre|Warhammer|Bow|Staff|Grimoire|Shield|Buckler|Pavise|Tome|Quiver|Focus|Plate|Mail|Robe|Cloak|Aegis|Banner|Standard|Relic|Beacon|Oath)/

/** The base noun an item is named by, if the name carries one. */
export const itemNoun = (item: Pick<Item, 'name'>): string | undefined => ITEM_NOUN_RE.exec(item.name)?.[0]

/** Which hands an item's base fits (see the table above). */
export function gripOf(item: Pick<Item, 'name' | 'slot'>): Grip {
  const noun = itemNoun(item)
  const base = noun ? ITEM_BASES[noun] : undefined
  return base && base.slot === item.slot ? base.grip : KIND_GRIP[item.slot]
}

/**
 * The share of a light weapon's damage and attack speed that counts from the
 * OFF hand (a knife or a wand there is a second, lighter weapon). A `main`
 * grip one-hander carried there under the Twinblade Harness counts in full.
 */
export const OFF_HAND_SHARE = 0.5

/** How much of `item`'s weapon line counts when it is worn in the off hand. */
export const offHandShare = (item: Pick<Item, 'name' | 'slot'>): number =>
  item.slot === 'oneHand' && gripOf(item) === 'either' ? OFF_HAND_SHARE : 1

/**
 * The Twinblade Harness's stat check: DEX of the hero's OWN — level-ups,
 * evolutions, shrines, stat relics and cards, never gear. Gear is left out on
 * purpose: an item that qualified itself (a sword "of Precision") or a swap
 * that un-qualified a worn sword would make a legal hand illegal behind the
 * player's back. The hero's own DEX only ever rises, so a hero who passes once
 * passes for the rest of the run.
 *
 * 14 is a real bar, not a formality: nobody starts a run on it (a Rogue opens
 * at 12 and gains 2 a level, a Fighter opens at 6 and a Mystic at 5, each
 * gaining 1), so a Rogue qualifies at level 2, a Fighter around level 9 and a
 * Mystic around level 10 — sooner with DEX from shrines, Finesse or the
 * Drillmaster's Ledger.
 */
export const DUAL_WIELD_DEX = 14

/** The run's equip rules: whether the company holds the Twinblade Harness. */
export interface EquipRules {
  twinblade?: boolean
}

/** Where a hero stands on the Twinblade Harness's check. */
export interface DualWieldCheck {
  /** The run holds the relic. */
  relic: boolean
  /** The hero's own DEX (gear not counted). */
  dex: number
  need: number
  /** Relic held AND check passed: a main-hand one-hander fits the off hand. */
  ok: boolean
}

export function dualWieldCheck(hero: Pick<Sentinel, 'stats'>, rules: EquipRules = {}): DualWieldCheck {
  const dex = hero.stats.dex
  const relic = !!rules.twinblade
  return { relic, dex, need: DUAL_WIELD_DEX, ok: relic && dex >= DUAL_WIELD_DEX }
}

/**
 * Which hero slot(s) `item` may occupy on `hero`. Every equip path — the pack,
 * the item panel's plan, auto-equip on a drop, a hire dressing from the pack,
 * the opening kit, the load-time check and the balance model — asks here.
 * Without a hero (nobody to check), a main-hand one-hander is main hand only.
 */
export function heroSlotsFor(
  item: Pick<Item, 'name' | 'slot'>,
  hero?: Pick<Sentinel, 'stats'> | null,
  rules: EquipRules = {},
): HeroSlot[] {
  switch (gripOf(item)) {
    case 'main':
      return hero && dualWieldCheck(hero, rules).ok ? ['mainHand', 'offHand'] : ['mainHand']
    case 'either':
      return ['mainHand', 'offHand']
    case 'twoHand':
      return ['mainHand'] // and it empties the off hand while held
    case 'off':
      return ['offHand']
    case 'body':
      return ['body']
  }
}

/**
 * `dropWeight` is the share of an unforced roll (loot, a merchant's shelf) at
 * each rarity before luck bumps it. 56 / 28 / 11 / 4 / 1 → 46 / 32 / 15 / 5 / 2
 * (the tuning pass): a run that fights its way through gets dressed from what it
 * finds — §11's fight-first lines read 11.7 → 20.4% (battles) and 21.7 → 28.3%
 * (adaptive), the first-timer line 17.9 → 20.0%, n=240 — while the §6 Monte
 * Carlo, whose gear is forced by depth, cannot move. Forced rarities (the hero
 * pick, sealed crates, contract items) are untouched.
 */
export const RARITY: Record<
  ItemRarity,
  { label: string; budget: number; enchants: number; color: string; dropWeight: number }
> = {
  common: { label: 'Common', budget: 1.0, enchants: 0, color: '#c3b291', dropWeight: 46 },
  rare: { label: 'Rare', budget: 1.7, enchants: 1, color: '#5fb0c4', dropWeight: 32 },
  epic: { label: 'Epic', budget: 2.8, enchants: 2, color: '#c67ab0', dropWeight: 15 },
  legendary: { label: 'Legendary', budget: 3.7, enchants: 3, color: '#f0b868', dropWeight: 5 },
  mythic: { label: 'Mythic', budget: 5.0, enchants: 4, color: '#ef6a3a', dropWeight: 2 },
}

// ---- weapon subtypes give damage a physical/magic identity + a hand cost ----
interface WeaponType {
  name: string
  damageType: 'physical' | 'magic'
  hands: 'oneHand' | 'twoHand'
  speedBias: number
}

/**
 * The Sovereign tier's nouns (Level 4, `itemKinds.SOVEREIGN_ITEM_KINDS`). A
 * roll with no `kinds` pool never deals one — it deals exactly what it dealt
 * before the tier existed, draw for draw — and a roll with a pool deals one
 * only when the pool names it (an owned kind, `run/charter.sovereignPool`).
 */
export const SOVEREIGN_NOUNS: ReadonlySet<string> = new Set(['Saffron Brand', 'Moonquill Codex', 'Gilded Easel', 'Ironheart Plate', 'Silkwind Cloak'])

/**
 * What a Sovereign kind does beyond its slot's base: one fixed edge, added
 * after the name is composed (as a Mythic's edge is), labelled "Sovereign".
 * The Gilded Easel's is its grip (holds 4, `ITEM_BASES`), so it has none here.
 */
export const SOVEREIGN_EDGE: Readonly<Record<string, Enchantment>> = {
  'Saffron Brand': { id: 'sov_brand', label: 'Sovereign', mods: { burn: { dps: 20, dur: 3 } } },
  'Moonquill Codex': { id: 'sov_codex', label: 'Sovereign', mods: { shock: { chains: 2, dmgFrac: 0.5 } } },
  'Ironheart Plate': { id: 'sov_plate', label: 'Sovereign', mods: { damageMult: 1.15 } },
  'Silkwind Cloak': { id: 'sov_cloak', label: 'Sovereign', mods: { rateMult: 1.15 } },
}
const WEAPONS: WeaponType[] = [
  // one-hand: modest damage, can pair with an off-hand. Dagger and Wand are
  // light enough to BE the off-hand (at OFF_HAND_SHARE) — see `ITEM_BASES`.
  { name: 'Sword', damageType: 'physical', hands: 'oneHand', speedBias: 0.05 },
  { name: 'Axe', damageType: 'physical', hands: 'oneHand', speedBias: 0.02 },
  { name: 'Dagger', damageType: 'physical', hands: 'oneHand', speedBias: 0.12 },
  { name: 'Wand', damageType: 'magic', hands: 'oneHand', speedBias: 0.06 },
  { name: 'Rod', damageType: 'magic', hands: 'oneHand', speedBias: 0.03 },
  { name: 'Sceptre', damageType: 'magic', hands: 'oneHand', speedBias: 0.04 },
  // two-hand: bigger damage, but fills both hands
  { name: 'Greatsword', damageType: 'physical', hands: 'twoHand', speedBias: -0.05 },
  { name: 'Warhammer', damageType: 'physical', hands: 'twoHand', speedBias: -0.08 },
  { name: 'Bow', damageType: 'physical', hands: 'twoHand', speedBias: 0.04 },
  { name: 'Staff', damageType: 'magic', hands: 'twoHand', speedBias: 0 },
  { name: 'Grimoire', damageType: 'magic', hands: 'twoHand', speedBias: 0.02 },
  // The Sovereign tier: a sword's handling, a grimoire's.
  { name: 'Saffron Brand', damageType: 'physical', hands: 'oneHand', speedBias: 0.05 },
  { name: 'Moonquill Codex', damageType: 'magic', hands: 'twoHand', speedBias: 0.02 },
]
const OFFHANDS = ['Shield', 'Buckler', 'Tome', 'Quiver', 'Focus', 'Pavise', 'Gilded Easel']
const BODIES = ['Plate', 'Mail', 'Robe', 'Cloak', 'Aegis', 'Ironheart Plate', 'Silkwind Cloak']
const KEEPSAKES = ['Banner', 'Standard', 'Relic', 'Beacon', 'Oath']

/**
 * Every noun each generator pool can name an item by, per kind — read by the
 * tests that hold {@link ITEM_BASES} to the pools (a base the table did not
 * classify would silently fall back to its kind's grip).
 */
export const GENERATED_BASES: Readonly<Record<ItemSlot, readonly string[]>> = {
  oneHand: WEAPONS.filter((w) => w.hands === 'oneHand').map((w) => w.name),
  twoHand: WEAPONS.filter((w) => w.hands === 'twoHand').map((w) => w.name),
  offHand: OFFHANDS,
  body: [...BODIES, ...KEEPSAKES],
}

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
  // 6–12 → 10–20 per budget point (no-HP tuning pass): §4 read it at +1.8pt on
  // `phys`, under the +2.0pt floor, before and after the rule change. One draw
  // either way, so no roll downstream moves.
  { id: 'flaming', label: 'Flaming', roll: (r, b) => ({ mods: { burn: { dps: round(r.range(10, 20) * b), dur: 3 } } }) },
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
  // Focus: +30% damage, bought with the blast. It was ×1.85 damage for ×0.55
  // rate (net ×1.02) — a "burst" shape the engine cannot read, and §10 measured
  // it at −1.1pt at worst, a plain upgrade. Splash is an axis the engine does
  // read: a single-target carrier gains (+5.6pt phys), a splash mystic loses
  // most of its blast (−3.2pt magic).
  { id: 'cx_reckless', label: 'Reckless', roll: () => ({ mods: { damageMult: 1.3, splashAdd: -45 } }) },
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
  // ×1.6 → ×1.3 damage (the tuning pass): the classless knife-thrower crits
  // ~48% for ×2 (its crit factor ~1.48), so ×1.6 was +8% on the very build the
  // clause is meant to cost — §10 read +0.9 / +4.1pt on it, no downside
  // anywhere. Now −6.4pt there and +9.8pt on the low-crit wand.
  { id: 'cx_vengeful', label: 'Vengeful', roll: () => ({ mods: { damageMult: 1.3, critChanceAdd: -1 } }) },
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

/**
 * A caster's weapon carries this much more flat damage than a blade or a bow of
 * the same rarity (the tuning pass). A wand, rod, staff or grimoire fires a
 * splash bolt at 0.8 a second where a bow looses 2.1, so the same flat roll per
 * HIT was a third of the damage per second: a hire with a Common wand read 34
 * DPS on its card against a bow's ~110–135, and a Common caster drop was the
 * weakest weapon in every hand. ×1.6 lifts a Common wand's flat 6.5 → 10.4.
 * The hero pick's caster weapon drops Epic → Rare with it (`heroes.pickRarity`),
 * which lands within a point of the old Epic wand's damage.
 */
export const CASTER_HIT = 1.6

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
      : { magDamage: Math.round(dmg * CASTER_HIT), attackSpeed: atkSpeed }
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
 * physical tower and `might` on a mystic buys nothing at all (it used to buy
 * the hero-HP term, which went with hero HP).
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
export type RosterRef = Pick<Sentinel, 'equipment'>

/**
 * How rare an off-type roll gets, as a fraction of an on-type one.
 * At 0.45 an all-caster roster still sees a physical one-hander about a third
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

export type DamageType = 'physical' | 'magic'

/**
 * A weight in (0, 1] for each damage type, given who is on the field — each
 * hero's type read off what it holds (`heroDamageType`). Undefined/empty
 * roster ⇒ 1 for both ⇒ every pool below is left untouched.
 */
function typeDemand(roster: readonly RosterRef[] | undefined): Record<DamageType, number> {
  if (!roster || roster.length === 0) return { physical: 1, magic: 1 }
  let phys = 0
  for (const s of roster) if (heroDamageType(s) === 'physical') phys++
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
  might: 'physical', // STR: damage on a hero with a physical weapon, nothing on a caster (heroes have no HP)
  insight: 'magic', // INT: damage on a caster, nothing at all on anyone else
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
  /**
   * Force a weapon roll onto one damage type. Only the opening kit uses it
   * (`startingKit`): the kit is dealt FOR a hero who has already been picked,
   * and a physical one-hander in a Mystic's hand is a blank slot — roster
   * weighting alone still deals an off-type weapon ~31% of the time. Consumes
   * exactly the same stream draws as an unforced roll.
   */
  damageType?: DamageType
  /** `false` never rolls a curse (the opening kit — a trade is the player's to make). */
  allowCurse?: boolean
  /**
   * The item KINDS this roll may deal (the run's unlocked pool, `run/watch`'s
   * item track): every slot and noun pick is made from the kinds in it, so
   * loot, the merchant and rewards deal only what the player has unlocked.
   * Each pick still takes exactly one draw. Omitted: every kind.
   */
  kinds?: readonly string[]
  /**
   * Force the noun (a hero's rolled gear, a migration). Its slot is the kind's;
   * the noun draw is still TAKEN, so the stream moves exactly as an unforced
   * roll of that slot would.
   */
  kind?: string
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
  // Keepsakes became RELICS (Phase 3b, `data/relics.ts`): a company-wide buff
  // is a reward card now, not a body-slot item. The chance draw is still taken
  // so every item behind it rolls from the same stream position; it just
  // never lands unless a caller asks for one (the old saves' keepsakes still
  // work — `teamKeepsakeMods`).
  const forced = opts.kind && ITEM_BASES[opts.kind] ? opts.kind : undefined
  const kindSet = opts.kinds ? new Set(opts.kinds) : null
  const forcedSlot = forced ? ITEM_BASES[forced].slot : opts.slot
  const isKeepsake = forcedSlot === undefined && rng.chance(opts.keepsakeChance ?? 0)
  // Only slots the pool has a kind for (the basic set covers all four).
  const SLOT_DEAL: ItemSlot[] = ['oneHand', 'oneHand', 'twoHand', 'offHand', 'body', 'body']
  const dealable = kindSet ? SLOT_DEAL.filter((sl) => GENERATED_BASES[sl].some((n) => kindSet.has(n))) : SLOT_DEAL
  const slot: ItemSlot = forcedSlot ?? rng.pick(dealable.length ? dealable : SLOT_DEAL)

  if (isKeepsake) {
    const noun = rng.pick(KEEPSAKES)
    const ench = rollEnchantments(KEEPSAKE_ENCHANTS, Math.max(1, cfg.enchants), cfg.budget, rng)
    return {
      id: nextId('itm'),
      name: `${noun} ${ench[0]?.label ?? ''}`.trim(),
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
  // With no pool, the Sovereign tier is never dealt: every kind it lists
  // existed before the tier, so the draws are the ones they always were.
  const allowed = (noun: string) => (kindSet ? kindSet.has(noun) : !SOVEREIGN_NOUNS.has(noun))
  // A kind the pool holds more than once (a company's piece on its own route,
  // `run/contracts.weightPool`) is listed that many times, so the one pick
  // below deals it by weight. An unweighted pool lists each kind once.
  const kindCount = new Map<string, number>()
  for (const k of opts.kinds ?? []) kindCount.set(k, (kindCount.get(k) ?? 0) + 1)
  const times = (noun: string): number => (kindSet ? (kindCount.get(noun) ?? 0) : SOVEREIGN_NOUNS.has(noun) ? 0 : 1)
  const byWeight = <T,>(list: readonly T[], nameOf: (x: T) => string): T[] => list.flatMap((x) => Array<T>(times(nameOf(x))).fill(x))
  const typed = WEAPONS.filter((w) => w.hands === slot && (!opts.damageType || w.damageType === opts.damageType) && (kindSet || !SOVEREIGN_NOUNS.has(w.name)))
  const inPool = byWeight(typed, (w) => w.name)
  // A forced damage type the pool cannot meet falls back to any unlocked weapon.
  const handed = inPool.length ? inPool : WEAPONS.filter((w) => w.hands === slot && allowed(w.name))
  const handedList = handed.length ? handed : typed
  let weapon = isWeapon
    ? rng.pick(rosterAware ? weightedPool(handedList, (w) => demand[w.damageType]) : handedList)
    : undefined
  const pickNoun = (list: readonly string[]) => {
    const ok = byWeight(list, (n) => n)
    return rng.pick(ok.length ? ok : list)
  }
  let noun = isWeapon ? weapon!.name : slot === 'offHand' ? pickNoun(OFFHANDS) : pickNoun(BODIES)
  if (forced) {
    noun = forced
    if (isWeapon) weapon = WEAPONS.find((w) => w.name === forced) ?? weapon
  }
  const enchantPool = rosterAware
    ? weightedPool(ENCHANTS, (e) => {
        const affinity = ENCHANT_AFFINITY[e.id]
        return affinity ? demand[affinity] : 1
      })
    : ENCHANTS
  const ench = rollEnchantments(enchantPool, cfg.enchants, cfg.budget, rng)
  // Epic+ items can roll a rare "curse": a dramatic extra affix with a downside.
  const canCurse = rarity === 'epic' || rarity === 'legendary' || rarity === 'mythic'
  if (canCurse && opts.allowCurse !== false && rng.chance(CURSE_CHANCE)) {
    const c = rng.pick(CURSE_ENCHANTS)
    ench.push({ id: c.id, label: c.label, ...c.roll(rng, cfg.budget) })
  }
  const name = nameItem(cfg.label, noun, ench)
  // A Mythic carries a slot-themed edge. It used to be a free level of an
  // upgrade path (`grantUpgrade`); the paths are spec perks now (Phase 3b), so
  // the same level's value rides on the item as an enchantment instead.
  if (rarity === 'mythic') ench.push(mythicEdge(slot))
  // A Sovereign kind carries its own edge, whatever its rarity.
  if (SOVEREIGN_EDGE[noun]) ench.push({ ...SOVEREIGN_EDGE[noun], mods: { ...SOVEREIGN_EDGE[noun].mods } })
  return {
    id: nextId('itm'),
    name: name.trim(),
    slot,
    rarity,
    base: baseFor(slot, cfg.budget, rng, weapon),
    enchantments: ench,
  }
}

/**
 * The Mythic edge — the old upgrade-path level at the same value: a weapon's
 * Onslaught (+15% damage), a body's Tempo (+12% attack speed), an off-hand's
 * Precision (+14% crit). `runSnapshot` converts a v6 item's `grantUpgrade`
 * through the same table.
 */
export const MYTHIC_EDGE: Record<string, Enchantment> = {
  power: { id: 'mythic_power', label: 'Mythic Onslaught', mods: { damageMult: 1.15 } },
  tempo: { id: 'mythic_tempo', label: 'Mythic Tempo', mods: { rateMult: 1.12 } },
  precision: { id: 'mythic_precision', label: 'Mythic Precision', mods: { critChanceAdd: 0.14 } },
}
export const mythicEdge = (slot: ItemSlot): Enchantment =>
  ({ ...MYTHIC_EDGE[slot === 'body' ? 'tempo' : slot === 'offHand' ? 'precision' : 'power'] })

// ---- economy sinks ----
export function reforgeCost(item: Item): number {
  return { common: 20, rare: 35, epic: 60, legendary: 100, mythic: 160 }[item.rarity]
}
export function upgradeCost(item: Item): number {
  // Cost to reach the NEXT tier from this one (0 at the top tier).
  return { common: 50, rare: 90, epic: 150, legendary: 260, mythic: 0 }[item.rarity]
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
  // A Sovereign kind's edge is the kind's, not a roll: it survives a reforge.
  const edge = item.enchantments.filter((e) => e.id.startsWith('sov_'))
  return { ...item, enchantments: [...ench, ...edge], name: renameFor(item, ench) }
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
/**
 * `[prefix] Noun [of Suffix]` — and NOT the rarity word (Wave 1 copy pass).
 *
 * Names used to carry the rarity in the middle ("Heavy Rare Grimoire"), and every
 * surface that shows an item also shows its rarity beside it, so the screen read
 * "Heavy Rare Grimoire · Rare" and "Common Axe · Common". The rarity is a label,
 * a colour, a letter and a pip count already; it does not need to be a word in
 * the name too. `rarityLabel` stays in the signature so the call sites keep
 * reading as they did.
 */
function nameItem(_rarityLabel: string, noun: string, ench: Enchantment[]): string {
  const suffix = ench.find((e) => e.label.startsWith('of'))
  const prefix =
    ench.find((e) => e.id.startsWith('cx_')) ?? ench.find((e) => !e.label.startsWith('of'))
  return `${prefix ? prefix.label + ' ' : ''}${noun}${suffix ? ' ' + suffix.label : ''}`.trim()
}

function renameFor(item: Item, ench: Enchantment[]): Item['name'] {
  const cfg = RARITY[item.rarity]
  const noun = itemNoun(item) ?? 'Relic'
  if (item.keepsake) return `${noun} ${ench[0]?.label ?? ''}`.trim()
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
