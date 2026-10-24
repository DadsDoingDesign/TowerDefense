/**
 * ---------------------------------------------------------------------------
 * The peoples' item kinds (Oct 2026) — the world bible's rosters, in the game
 * ---------------------------------------------------------------------------
 *
 * The source of truth is `docs/peoples/roster.json`: five peoples, one per
 * trade company, each with twenty item kinds of Levels 1–4. The kinds marked
 * "kept" were already in the game (`itemKinds.ts` keeps them where they were,
 * re-filed to their people's company); every "new" one is HERE, as one row
 * that says everything the game needs about it:
 *
 *  - what it is (`slot`, `grip`, `style`, and a shield's `hold` / `thorns`)
 *    — folded into `items.ITEM_BASES`;
 *  - what it rolls: a weapon's flat damage, handling and edge off its ONE
 *    draw (`weapon`, like `items.WEAPONS`), an off-hand or body piece's base
 *    off its slot's TWO draws (`roll`, like `items.OFFHAND_ROLL`) — so the
 *    stream behind an item never moves with its kind;
 *  - its identity: a fixed {@link PeopleKind.edge}, added after the name is
 *    composed exactly as a Sovereign kind's edge is (`items.KIND_EDGE`), so
 *    no draw is taken for it and rarity never scales it;
 *  - who deals it (`company`), how far up the track (`level`), and its line
 *    (`does`, `itemKinds.ItemKind`).
 *
 * Every effect is built from mechanics the engine already had where one fits
 * (burn — the game's poison and bleed too, as `Poisoned Tips` always was —
 * chill, stun, holds, reach, crit, speed, the damage aura, splash, thorns,
 * pierce, a volley, execute, the kill rushes, bounty and the Gate mend); the
 * handful that needed a rule of their own got one small `EffectMods` field,
 * read in one place in `engine.ts` (`rateAura`, `vsPlated` / `vsWarded`,
 * `critBurn`, `doubleEvery`, `killReady`, `root`).
 *
 * The art is the reviewed draft (`scripts/peoples-art/`), baked into the icon
 * atlas by `scripts/fw-icons.ts`; {@link peopleIconKey} names each cell.
 *
 * Pure data: no DOM, no RNG.
 */
import type { CompanyId } from './companies'
import type { EffectMods, Item, ItemSlot } from '../types'
import type { Grip, HeroStyle } from './items'

/** The weapon half of a kind: what its ONE draw rolls (see `items.WEAPONS`). */
export interface PeopleWeapon {
  damageType: 'physical' | 'magic'
  /** Attack speed: a positive bias scales with rarity, a negative one is a fixed handling cost (L9c). */
  speedBias: number
  /** Flat damage per budget point, low–high (default 5–8 one-handed, 9–13 two-handed). */
  dmg?: readonly [number, number]
  /** Per budget point, low–high, read off the same draw as the damage. */
  edge?: Partial<Record<'splashAdd' | 'rangeMult' | 'critChance', readonly [number, number]>>
  /** A fixed reach cost (a shortbow, a harpoon): never scaled by rarity, never deepened by a raise. */
  rangeBias?: number
}

/** The fixed identity a kind carries on top of its rolled base. */
export interface PeopleEdge {
  mods?: EffectMods
  /** Flat thorns (the grind a held enemy takes). */
  thorns?: number
}

export interface PeopleKind {
  /** The noun — the kind id and the word in every item name. */
  id: string
  /** Which people's roster it is (`docs/peoples/roster.json`). */
  people: 'humans' | 'elves' | 'dwarves' | 'reptilians' | 'gnomes'
  slot: ItemSlot
  grip: Grip
  style?: HeroStyle
  swings?: true
  /** A bow: its holder looses arrows (the delivery, `attackLook.deliveryOf`). */
  bow?: true
  hold?: number
  thorns?: number
  level: 1 | 2 | 3 | 4
  company: CompanyId
  does: string
  weapon?: PeopleWeapon
  /** An off-hand or body piece's base off its slot's two draws `a`, `b` and the rarity budget `k`. */
  roll?: (a: number, b: number, k: number) => Item['base']
  edge?: PeopleEdge
}

const lerp = (lo: number, hi: number, t: number) => lo + t * (hi - lo)
const round = (n: number) => Math.max(1, Math.round(n))

const spice: CompanyId = 'spice'
const silk: CompanyId = 'silk'
const metals: CompanyId = 'metals'
const art: CompanyId = 'art'
const scrolls: CompanyId = 'scrolls'

/** Physical weapons that swing all round their holder (they keep a clearance). */
const swing = { style: 'swing' as const, swings: true as const }
const phys = (speedBias: number, dmg?: readonly [number, number], edge?: PeopleWeapon['edge'], rangeBias?: number): PeopleWeapon => ({ damageType: 'physical', speedBias, dmg, edge, rangeBias })
const magic = (speedBias: number, dmg?: readonly [number, number], edge?: PeopleWeapon['edge']): PeopleWeapon => ({ damageType: 'magic', speedBias, dmg, edge })

/** An aura's reach: the Blessing's 130. */
const AURA_R = 130

export const PEOPLE_KINDS: readonly PeopleKind[] = [
  // ======================= Humans — Peppercorn ==============================
  { id: 'Arming Sword', people: 'humans', slot: 'oneHand', grip: 'main', ...swing, level: 1, company: spice, does: 'One hand. Swings up close; hits a little harder.', weapon: phys(0, [6, 9]) },
  { id: 'Kite Shield', people: 'humans', slot: 'offHand', grip: 'off', hold: 2, thorns: 6, level: 1, company: spice, does: 'Off hand. Holds 2 enemies; its hits slow 15%.', roll: (a, _b, k) => ({ attackSpeed: lerp(0.02, 0.05, a) * k }), edge: { mods: { chill: { slow: 0.15, dur: 1.5 } } } },
  { id: 'Gambeson', people: 'humans', slot: 'body', grip: 'body', level: 1, company: spice, does: 'Body. Holds 1 more enemy; a little attack speed.', roll: (a, _b, k) => ({ attackSpeed: lerp(0.02, 0.04, a) * k }), edge: { mods: { holdAdd: 1 } } },
  { id: 'Falchion', people: 'humans', slot: 'oneHand', grip: 'main', ...swing, level: 2, company: spice, does: 'One hand. A wide swing that strikes enemies beside.', weapon: phys(0.03, [5, 8], { splashAdd: [10, 16] }) },
  { id: 'Spiced Blade', people: 'humans', slot: 'oneHand', grip: 'main', ...swing, level: 2, company: spice, does: 'One hand. Swings up close; every hit burns 8/s for 2s.', weapon: phys(0, [5, 8]), edge: { mods: { burn: { dps: 8, dur: 2 } } } },
  { id: 'Halberd', people: 'humans', slot: 'twoHand', grip: 'twoHand', ...swing, level: 2, company: spice, does: 'Both hands. Reaches farther; every hit strikes 2 in a line.', weapon: phys(-0.08, [9, 13], { rangeMult: [0.14, 0.22] }), edge: { mods: { pierce: 1 } } },
  { id: 'Banner Pole', people: 'humans', slot: 'twoHand', grip: 'twoHand', ...swing, level: 2, company: spice, does: 'Both hands. Swings up close; heroes near it hit 10% harder.', weapon: phys(0, [7, 10]), edge: { mods: { buffAura: { damageMult: 1.1, radius: AURA_R } } } },
  { id: 'Heater Shield', people: 'humans', slot: 'offHand', grip: 'off', hold: 3, thorns: 7, level: 2, company: spice, does: 'Off hand. Holds 3 enemies; attacks a little slower.', roll: (_a, b, k) => ({ attackSpeed: -0.1, critChance: lerp(0.02, 0.04, b) * k }) },
  { id: 'Brigandine', people: 'humans', slot: 'body', grip: 'body', level: 2, company: spice, does: 'Body. Every hit harder; a little attack speed.', roll: (a, b, k) => ({ damagePct: lerp(0.04, 0.08, a) * k, attackSpeed: lerp(0.02, 0.04, b) * k }) },
  { id: 'Pepperport Sabre', people: 'humans', slot: 'oneHand', grip: 'main', ...swing, level: 3, company: spice, does: 'One hand. Swings much faster; its crits burn 12/s for 3s.', weapon: phys(0.12, [5, 8]), edge: { mods: { critBurn: { dps: 12, dur: 3 } } } },
  { id: "Captain's Shield", people: 'humans', slot: 'offHand', grip: 'off', hold: 3, thorns: 8, level: 3, company: spice, does: 'Off hand. Holds 3 enemies; heroes near it attack 10% faster.', roll: (a, _b, k) => ({ attackSpeed: lerp(0.03, 0.06, a) * k }), edge: { mods: { rateAura: { rateMult: 1.1, radius: AURA_R } } } },
  { id: "Sergeant's Cuirass", people: 'humans', slot: 'body', grip: 'body', level: 3, company: spice, does: 'Body. Reach; every hit harder.', roll: (a, b, k) => ({ rangeMult: lerp(0.08, 0.14, a) * k, damagePct: lerp(0.04, 0.08, b) * k }) },
  { id: 'Pepperport Standard', people: 'humans', slot: 'twoHand', grip: 'twoHand', ...swing, level: 4, company: spice, does: 'Both hands. Heroes near it hit 20% harder; its hits burn 10/s.', weapon: phys(0, [9, 13]), edge: { mods: { buffAura: { damageMult: 1.2, radius: 140 }, burn: { dps: 10, dur: 3 } } } },
  { id: 'Saltmarsh Warplate', people: 'humans', slot: 'body', grip: 'body', level: 4, company: spice, does: 'Body. Holds 1 more enemy; every hit harder; thorns burn 12/s.', roll: (a, _b, k) => ({ damagePct: lerp(0.05, 0.1, a) * k }), edge: { mods: { holdAdd: 1, thornsBurn: { dps: 12, dur: 3 } } } },

  // ======================= Elves — Rosethread ===============================
  { id: 'Shortbow', people: 'elves', slot: 'twoHand', grip: 'twoHand', style: 'shoot', bow: true, level: 1, company: silk, does: 'Both hands. Shoots faster, not as far.', weapon: phys(0.14, [8, 12], undefined, -0.15) },
  { id: 'Silk Wrap', people: 'elves', slot: 'body', grip: 'body', level: 1, company: silk, does: 'Body. Crit chance.', roll: (a, _b, k) => ({ critChance: lerp(0.04, 0.08, a) * k }) },
  { id: 'Longbow', people: 'elves', slot: 'twoHand', grip: 'twoHand', style: 'shoot', bow: true, level: 2, company: silk, does: 'Both hands. Shoots farthest; a little slower.', weapon: phys(-0.06, [10, 14], { rangeMult: [0.18, 0.28] }) },
  { id: 'Twin Knives', people: 'elves', slot: 'oneHand', grip: 'either', style: 'shoot', level: 2, company: silk, does: 'One hand, or the off hand. Every 3rd strike hits twice.', weapon: phys(0.12, [3, 6]), edge: { mods: { doubleEvery: 3 } } },
  { id: 'Barbed Quiver', people: 'elves', slot: 'offHand', grip: 'off', level: 2, company: silk, does: 'Off hand. Shots pierce 1 more enemy; a little attack speed.', roll: (a, _b, k) => ({ attackSpeed: lerp(0.04, 0.08, a) * k }), edge: { mods: { pierce: 1 } } },
  { id: 'Woven Vest', people: 'elves', slot: 'body', grip: 'body', level: 2, company: silk, does: 'Body. Reach and crit chance.', roll: (a, b, k) => ({ rangeMult: lerp(0.1, 0.18, a) * k, critChance: lerp(0.03, 0.06, b) * k }) },
  { id: 'Thornweave Hood', people: 'elves', slot: 'body', grip: 'body', level: 2, company: silk, does: 'Body. Hits slow 15%; a little reach.', roll: (a, _b, k) => ({ rangeMult: lerp(0.05, 0.1, a) * k }), edge: { mods: { chill: { slow: 0.15, dur: 1.5 } } } },
  { id: 'Recurve Bow', people: 'elves', slot: 'twoHand', grip: 'twoHand', style: 'shoot', bow: true, level: 3, company: silk, does: 'Both hands. Shoots from far away; every 4th shot crits.', weapon: phys(0.06, [9, 13]), edge: { mods: { critEvery: 4 } } },
  { id: 'Loomwarden Bow', people: 'elves', slot: 'twoHand', grip: 'twoHand', style: 'shoot', bow: true, level: 3, company: silk, does: 'Both hands. Every shot splits to a 2nd enemy for 50%.', weapon: phys(0.02, [8, 12]), edge: { mods: { shock: { chains: 1, dmgFrac: 0.5 } } } },
  { id: "Ranger's Dirk", people: 'elves', slot: 'oneHand', grip: 'either', style: 'shoot', level: 3, company: silk, does: 'One hand, or the off hand. Crits hit 50% harder.', weapon: phys(0.1, [4, 7], { critChance: [0.04, 0.08] }), edge: { mods: { critMultAdd: 0.5 } } },
  { id: 'Starfeather Quiver', people: 'elves', slot: 'offHand', grip: 'off', level: 3, company: silk, does: 'Off hand. Attack speed and reach.', roll: (a, b, k) => ({ attackSpeed: lerp(0.08, 0.15, a) * k, rangeMult: lerp(0.06, 0.12, b) * k }) },
  { id: 'Moonsilk Mantle', people: 'elves', slot: 'body', grip: 'body', level: 3, company: silk, does: 'Body. Reach and attack speed.', roll: (a, b, k) => ({ rangeMult: lerp(0.12, 0.2, a) * k, attackSpeed: lerp(0.05, 0.09, b) * k }) },
  { id: 'Starstring Longbow', people: 'elves', slot: 'twoHand', grip: 'twoHand', style: 'shoot', bow: true, level: 4, company: silk, does: 'Both hands. Every shot pierces its whole path; +10% crit.', weapon: phys(0, [10, 14], { rangeMult: [0.1, 0.16] }), edge: { mods: { pierce: 99, critChanceAdd: 0.1 } } },
  { id: 'Whisperfang', people: 'elves', slot: 'oneHand', grip: 'either', style: 'shoot', level: 4, company: silk, does: 'One hand, or the off hand. Each kill readies its next strike.', weapon: phys(0.15, [5, 8]), edge: { mods: { killReady: true } } },

  // ======================= Dwarves — Ironvein ===============================
  { id: 'Hand Hammer', people: 'dwarves', slot: 'oneHand', grip: 'main', ...swing, level: 1, company: metals, does: 'One hand. Swings up close, hard; 8% stun chance.', weapon: phys(-0.05, [6, 9]), edge: { mods: { stunChance: 0.08, stunDur: 0.5 } } },
  { id: "Miner's Pick", people: 'dwarves', slot: 'oneHand', grip: 'main', ...swing, level: 1, company: metals, does: 'One hand. Swings up close; hits plated enemies 25% harder.', weapon: phys(-0.03, [5, 8]), edge: { mods: { vsPlated: 0.25 } } },
  { id: 'Round Shield', people: 'dwarves', slot: 'offHand', grip: 'off', hold: 2, thorns: 9, level: 1, company: metals, does: 'Off hand. Holds 2 enemies; more thorns; a little crit.', roll: (_a, b, k) => ({ critChance: lerp(0.03, 0.06, b) * k }) },
  { id: 'Chainshirt', people: 'dwarves', slot: 'body', grip: 'body', level: 1, company: metals, does: 'Body. Holds 1 more enemy; a little wider blast.', roll: (_a, b, k) => ({ splashAdd: round(lerp(4, 8, b) * k) }), edge: { mods: { holdAdd: 1 } } },
  { id: 'Forge Apron', people: 'dwarves', slot: 'body', grip: 'body', level: 1, company: metals, does: 'Body. +8 thorns; every hit a little harder.', roll: (a, _b, k) => ({ damagePct: lerp(0.02, 0.04, a) * k }), edge: { thorns: 8 } },
  { id: 'Bearded Axe', people: 'dwarves', slot: 'oneHand', grip: 'main', ...swing, level: 2, company: metals, does: 'One hand. Cleaves a wider circle; a little slower.', weapon: phys(-0.04, [4, 7], { splashAdd: [12, 20] }) },
  { id: 'Maul', people: 'dwarves', slot: 'twoHand', grip: 'twoHand', ...swing, level: 2, company: metals, does: 'Both hands. Slow, very hard hits that splash.', weapon: phys(-0.15, [12, 16], { splashAdd: [6, 12] }) },
  { id: 'Rune Shield', people: 'dwarves', slot: 'offHand', grip: 'off', hold: 2, thorns: 6, level: 2, company: metals, does: 'Off hand. Holds 2 enemies; hits warded enemies 25% harder.', roll: (a, _b, k) => ({ damagePct: lerp(0.03, 0.06, a) * k }), edge: { mods: { vsWarded: 0.25 } } },
  { id: 'Stoneskin Mail', people: 'dwarves', slot: 'body', grip: 'body', level: 2, company: metals, does: 'Body. Holds 1 more enemy; +6 thorns.', roll: (a, b, k) => ({ rangeMult: lerp(0.04, 0.08, a) * k, splashAdd: round(lerp(4, 8, b) * k) }), edge: { mods: { holdAdd: 1 }, thorns: 6 } },
  { id: 'Greataxe', people: 'dwarves', slot: 'twoHand', grip: 'twoHand', ...swing, level: 3, company: metals, does: 'Both hands. Cleaves everything around it.', weapon: phys(0, [9, 13], { splashAdd: [16, 26] }) },
  { id: 'Quarry Breaker', people: 'dwarves', slot: 'twoHand', grip: 'twoHand', ...swing, level: 3, company: metals, does: 'Both hands. Hits armoured enemies 30% harder and slow 20%.', weapon: phys(-0.1, [10, 14]), edge: { mods: { vsPlated: 0.3, vsWarded: 0.3, chill: { slow: 0.2, dur: 1.5 } } } },
  { id: 'Anvil Shield', people: 'dwarves', slot: 'offHand', grip: 'off', hold: 4, thorns: 10, level: 3, company: metals, does: 'Off hand. Holds 4 enemies; 12% stun chance; attacks slower.', roll: () => ({ attackSpeed: -0.15 }), edge: { mods: { stunChance: 0.12, stunDur: 0.6 } } },
  { id: 'Deepforge Plate', people: 'dwarves', slot: 'body', grip: 'body', level: 3, company: metals, does: 'Body. Every hit harder; a wider blast.', roll: (a, b, k) => ({ damagePct: lerp(0.06, 0.1, a) * k, splashAdd: round(lerp(6, 12, b) * k) }) },
  { id: 'Mountainbreaker', people: 'dwarves', slot: 'twoHand', grip: 'twoHand', ...swing, level: 4, company: metals, does: 'Both hands. Every hit splashes; 25% stun chance.', weapon: phys(-0.12, [12, 17], { splashAdd: [8, 14] }), edge: { mods: { stunChance: 0.25, stunDur: 0.6 } } },
  { id: "Thane's Bulwark", people: 'dwarves', slot: 'offHand', grip: 'off', hold: 5, thorns: 12, level: 4, company: metals, does: 'Off hand. Holds 5 enemies; thorns ×2.', roll: (_a, b, k) => ({ critChance: lerp(0.02, 0.04, b) * k }), edge: { mods: { thornsMult: 2 } } },

  // ======================= Reptilians — Butcherblock ========================
  { id: 'Spear', people: 'reptilians', slot: 'twoHand', grip: 'twoHand', ...swing, level: 1, company: art, does: 'Both hands. Strikes up close; pierces the enemy behind.', weapon: phys(0.02, [8, 12], { rangeMult: [0.04, 0.08] }), edge: { mods: { pierce: 1 } } },
  { id: 'Fang Knife', people: 'reptilians', slot: 'oneHand', grip: 'either', style: 'shoot', level: 1, company: art, does: 'One hand, or the off hand. Every hit poisons 6/s for 3s.', weapon: phys(0.1, [4, 7]), edge: { mods: { burn: { dps: 6, dur: 3 } } } },
  { id: 'Bone Club', people: 'reptilians', slot: 'oneHand', grip: 'main', ...swing, level: 1, company: art, does: 'One hand. Swings up close, hard; 10% stun chance.', weapon: phys(0, [6, 10]), edge: { mods: { stunChance: 0.1, stunDur: 0.5 } } },
  { id: 'Leather', people: 'reptilians', slot: 'body', grip: 'body', level: 1, company: art, does: 'Body. Attack speed; a little reach.', roll: (a, _b, k) => ({ attackSpeed: lerp(0.05, 0.1, a) * k }), edge: { mods: { rangeMult: 1.05 } } },
  { id: 'Hide Wrap', people: 'reptilians', slot: 'body', grip: 'body', level: 1, company: art, does: 'Body. +6 thorns; a little reach.', roll: (a, _b, k) => ({ rangeMult: lerp(0.03, 0.06, a) * k }), edge: { thorns: 6 } },
  { id: 'Cleaver', people: 'reptilians', slot: 'oneHand', grip: 'main', ...swing, level: 2, company: art, does: 'One hand. Swings up close; every hit bleeds 10/s for 3s.', weapon: phys(-0.04, [5, 8]), edge: { mods: { burn: { dps: 10, dur: 3 } } } },
  { id: 'Meat Hook', people: 'reptilians', slot: 'oneHand', grip: 'main', ...swing, level: 2, company: art, does: 'One hand. Swings up close; hits held enemies 30% harder.', weapon: phys(0.03, [5, 8]), edge: { mods: { vsHeld: 0.3 } } },
  { id: 'Harpoon', people: 'reptilians', slot: 'twoHand', grip: 'twoHand', style: 'shoot', level: 2, company: art, does: 'Both hands. Throws from mid range; hits slow 30%.', weapon: phys(0, [9, 13], undefined, -0.25), edge: { mods: { chill: { slow: 0.3, dur: 1.5 } } } },
  { id: 'Gator Buckler', people: 'reptilians', slot: 'offHand', grip: 'off', hold: 2, thorns: 10, level: 2, company: art, does: 'Off hand. Holds 2 enemies; more thorns; attack speed.', roll: (a, _b, k) => ({ attackSpeed: lerp(0.04, 0.07, a) * k }) },
  { id: 'Javelin Sling', people: 'reptilians', slot: 'offHand', grip: 'off', level: 2, company: art, does: 'Off hand. Every 4th attack throws a javelin that pierces 3.', roll: (a, b, k) => ({ attackSpeed: lerp(0.03, 0.06, a) * k, damagePct: lerp(0.03, 0.05, b) * k }), edge: { mods: { volley: { every: 4, pierce: 3 } } } },
  { id: 'Scale Hide', people: 'reptilians', slot: 'body', grip: 'body', level: 2, company: art, does: 'Body. +6 thorns; holds 1 more enemy.', roll: (a, _b, k) => ({ attackSpeed: lerp(0.03, 0.06, a) * k }), edge: { mods: { holdAdd: 1 }, thorns: 6 } },
  { id: 'Glaive', people: 'reptilians', slot: 'twoHand', grip: 'twoHand', ...swing, level: 3, company: art, does: 'Both hands. A wide sweep; every hit bleeds 10/s for 3s.', weapon: phys(0, [9, 13], { splashAdd: [10, 16] }), edge: { mods: { burn: { dps: 10, dur: 3 } } } },
  { id: 'Bonecrusher', people: 'reptilians', slot: 'twoHand', grip: 'twoHand', ...swing, level: 3, company: art, does: 'Both hands. The hardest swing; kills enemies under 15% outright.', weapon: phys(-0.15, [13, 18]), edge: { mods: { execute: 0.15 } } },
  { id: 'Venom Fang', people: 'reptilians', slot: 'oneHand', grip: 'either', style: 'shoot', level: 3, company: art, does: 'One hand, or the off hand. Every hit poisons 14/s; crits more.', weapon: phys(0.12, [4, 7], { critChance: [0.03, 0.06] }), edge: { mods: { burn: { dps: 14, dur: 3 } } } },
  { id: 'Stalker Leathers', people: 'reptilians', slot: 'body', grip: 'body', level: 3, company: art, does: 'Body. Crit chance; each kill: +30% attack speed for 2s.', roll: (_a, b, k) => ({ critChance: lerp(0.03, 0.05, b) * k }), edge: { mods: { killRush: { rate: 0.3, dur: 2 } } } },
  { id: 'Smokehouse Apron', people: 'reptilians', slot: 'body', grip: 'body', level: 3, company: art, does: 'Body. Each kill pays 2 more gold; every hit a little harder.', roll: (a, _b, k) => ({ damagePct: lerp(0.03, 0.05, a) * k }), edge: { mods: { goldPerKill: 2 } } },
  { id: 'Wyrmtooth Spear', people: 'reptilians', slot: 'twoHand', grip: 'twoHand', ...swing, level: 4, company: art, does: 'Both hands. Every strike pierces its whole path and poisons 12/s.', weapon: phys(0, [10, 14], { rangeMult: [0.06, 0.1] }), edge: { mods: { pierce: 99, burn: { dps: 12, dur: 3 } } } },
  { id: "Butcher-King's Cleaver", people: 'reptilians', slot: 'oneHand', grip: 'main', ...swing, level: 4, company: art, does: 'One hand. Each kill: +40% attack speed for 3s.', weapon: phys(0.05, [6, 9]), edge: { mods: { killRush: { rate: 0.4, dur: 3 } } } },

  // ======================= Gnomes — Greenvial ===============================
  { id: 'Sprout Wand', people: 'gnomes', slot: 'oneHand', grip: 'main', style: 'cast', level: 1, company: scrolls, does: 'One hand. Casts a burst at a group that slows 15%.', weapon: magic(0, [5, 8]), edge: { mods: { chill: { slow: 0.15, dur: 1.5 } } } },
  { id: 'Herb Pouch', people: 'gnomes', slot: 'offHand', grip: 'off', level: 1, company: scrolls, does: 'Off hand. Every 10th kill wins back 1% cargo; hits a little harder.', roll: (a, _b, k) => ({ damagePct: lerp(0.03, 0.06, a) * k }), edge: { mods: { killMend: { every: 10, hp: 0.2 } } } },
  { id: 'Thornrod', people: 'gnomes', slot: 'oneHand', grip: 'main', style: 'cast', level: 2, company: scrolls, does: 'One hand. Casts a burst that poisons 8/s for 3s; reaches farther.', weapon: magic(0, [5, 8], { rangeMult: [0.04, 0.08] }), edge: { mods: { burn: { dps: 8, dur: 3 } } } },
  { id: 'Spark Coil', people: 'gnomes', slot: 'oneHand', grip: 'either', style: 'cast', level: 2, company: scrolls, does: 'One hand, or the off hand. Bursts jump to 1 more enemy for 45%.', weapon: magic(0.04, [4, 7]), edge: { mods: { shock: { chains: 1, dmgFrac: 0.45 } } } },
  { id: 'Flask', people: 'gnomes', slot: 'offHand', grip: 'off', level: 2, company: scrolls, does: 'Off hand. Hits splash a brew that slows 20%.', roll: (_a, b, k) => ({ splashAdd: round(lerp(4, 8, b) * k) }), edge: { mods: { chill: { slow: 0.2, dur: 1.5 } } } },
  { id: 'Mossweave Robe', people: 'gnomes', slot: 'body', grip: 'body', level: 2, company: scrolls, does: 'Body. A wider blast that slows 20%.', roll: (_a, b, k) => ({ splashAdd: round(lerp(8, 16, b) * k) }), edge: { mods: { chill: { slow: 0.2, dur: 1.5 } } } },
  { id: 'Brew Belt', people: 'gnomes', slot: 'body', grip: 'body', level: 2, company: scrolls, does: 'Body. Heroes near it attack 10% faster.', roll: (a, _b, k) => ({ attackSpeed: lerp(0.02, 0.05, a) * k }), edge: { mods: { rateAura: { rateMult: 1.1, radius: AURA_R } } } },
  { id: 'Bloomstaff', people: 'gnomes', slot: 'twoHand', grip: 'twoHand', style: 'cast', level: 3, company: scrolls, does: 'Both hands. Bursts sprout roots that hold 2 enemies for 0.8s.', weapon: magic(0, [8, 12], { splashAdd: [4, 8] }), edge: { mods: { root: { count: 2, dur: 0.8 } } } },
  { id: 'Philter Rack', people: 'gnomes', slot: 'offHand', grip: 'off', level: 3, company: scrolls, does: 'Off hand. Heroes near it hit 15% harder.', roll: (_a, b, k) => ({ critChance: lerp(0.02, 0.04, b) * k }), edge: { mods: { buffAura: { damageMult: 1.15, radius: AURA_R } } } },
  { id: "Alchemist's Coat", people: 'gnomes', slot: 'body', grip: 'body', level: 3, company: scrolls, does: 'Body. Blasts burn 8/s and slow 15%.', roll: (_a, b, k) => ({ splashAdd: round(lerp(6, 12, b) * k) }), edge: { mods: { burn: { dps: 8, dur: 3 }, chill: { slow: 0.15, dur: 1.5 } } } },
  { id: 'Worldroot Staff', people: 'gnomes', slot: 'twoHand', grip: 'twoHand', style: 'cast', level: 4, company: scrolls, does: 'Both hands. Every burst roots what it hits for 1s.', weapon: magic(0, [9, 13], { splashAdd: [5, 10] }), edge: { mods: { root: { count: 99, dur: 1 } } } },
  { id: 'Elixir of Plenty', people: 'gnomes', slot: 'offHand', grip: 'off', level: 4, company: scrolls, does: 'Off hand. Every 5th kill wins back 2% cargo; heroes near it attack 15% faster.', roll: (a, _b, k) => ({ attackSpeed: lerp(0.04, 0.08, a) * k }), edge: { mods: { killMend: { every: 5, hp: 0.4 }, rateAura: { rateMult: 1.15, radius: 140 } } } },
]

/**
 * The two kinds the roster RENAMED (Oct 2026): a save's old name is the new
 * kind. Applied wherever a kind id is read back from storage (`metaStore`,
 * `runSnapshot`) and to the names of saved items.
 */
export const KIND_RENAMES: Readonly<Record<string, string>> = {
  'Gilded Easel': 'Kingscale Shield',
  'Moonquill Codex': 'Greenvial Herbal',
}
/** The kind a stored id means today (a renamed kind's new name; anything else as it is). */
export const canonicalKind = (id: string): string => KIND_RENAMES[id] ?? id
/** An item name with a renamed kind's old noun replaced by its new one. */
export function renamedItemName(name: string): string {
  for (const [from, to] of Object.entries(KIND_RENAMES)) if (name.includes(from)) return name.replace(from, to)
  return name
}

/**
 * The atlas cell a peoples' kind is drawn by: its name in camelCase
 * ("Captain's Shield" → `captainsShield`). `iconAtlas.ICON_ORDER` lists each
 * literally and `scripts/fw-icons.ts` bakes each from the reviewed draft.
 */
export function peopleIconKey(name: string): string {
  const words = name.replace(/[’']/g, '').split(/[^A-Za-z]+/).filter(Boolean)
  return words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('')
}
