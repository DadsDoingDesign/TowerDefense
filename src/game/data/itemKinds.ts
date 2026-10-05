import type { ItemSlot } from '../types'
import type { CompanyId } from './companies'

/**
 * ---------------------------------------------------------------------------
 * Item KINDS — the nouns the generator deals, as things a player unlocks
 * ---------------------------------------------------------------------------
 *
 * The designer: "think of games like balatro that give you more variety as you
 * play more … you get new skills and unlock new items and then its gives more
 * and more combos". So an item KIND (Sword, Bow, Pavise) is a card in the
 * collection, exactly like a skill: a player starts with the five BASIC kinds,
 * and the rest join the pool one at a time on the same Watch track as the
 * skill cards (`run/watch.ts` — a Watch level or a ranked win deals one skill
 * card AND one item kind while both remain). Loot, the merchant, rewards and
 * every rolled hero draw only from the unlocked kinds; rarity and enchantments
 * work as ever on whatever kind is dealt.
 *
 * Every `does` is one sentence about THAT kind and nothing else (the designer:
 * "thats the fun of it dont say how it will mix") — no pairing hints.
 */
export interface ItemKind {
  /** The noun — the same string `items.ITEM_BASES` and every item name carry. */
  id: string
  slot: ItemSlot
  /** One plain sentence: which hand, and what it makes its holder do. */
  does: string
  /** In everyone's pool from the first run. */
  basic?: true
  /**
   * How far up the unlock track this kind sits, 1–3 — the item half of a
   * skill's Level. A contract's unlock roll has a floor that rises with the
   * stake (`run/standing.contractFloor`), so a big stake opens the heavier
   * kinds first. Say it as "Level N", as a skill does.
   *
   * **Level 4 is the Sovereign tier** (the endgame charter, build step 5): a
   * kind that only a delivered Sovereign Route unlocks (`run/charter.ts`),
   * never a contract, a standing level or a sealed crate. Shown in cyan
   * (`SOVEREIGN_COLOR`) with the initial "S".
   */
  level: 1 | 2 | 3 | 4
  /**
   * The trade company whose pool this kind belongs to (`data/companies.ts`):
   * dealt more often on its routes (`run/contracts.weightPool`). Every kind
   * names one.
   */
  company: CompanyId
}

export const ITEM_KINDS: readonly ItemKind[] = [
  // ---- weapons: what the hero does comes from these ------------------------
  { id: 'Sword', slot: 'oneHand', level: 1, company: 'spice', basic: true, does: 'One hand. Swings at enemies up close.' },
  { id: 'Bow', slot: 'twoHand', level: 1, company: 'art', basic: true, does: 'Both hands. Shoots enemies from far away.' },
  { id: 'Wand', slot: 'oneHand', level: 1, company: 'scrolls', basic: true, does: 'One hand, or the off hand. Casts magic that bursts on a group.' },
  { id: 'Axe', slot: 'oneHand', level: 1, company: 'spice', does: 'One hand. Swings at enemies up close, a little slower than a sword.' },
  { id: 'Dagger', slot: 'oneHand', level: 1, company: 'spice', does: 'One hand, or the off hand. Throws quick strikes from far away.' },
  { id: 'Rod', slot: 'oneHand', level: 1, company: 'silk', does: 'One hand. Casts magic that bursts on a group.' },
  { id: 'Sceptre', slot: 'oneHand', level: 2, company: 'scrolls', does: 'One hand. Casts magic that bursts on a group, a little quicker than a rod.' },
  { id: 'Greatsword', slot: 'twoHand', level: 3, company: 'metals', does: 'Both hands. Swings up close, hits much harder, and swings a little slower.' },
  { id: 'Warhammer', slot: 'twoHand', level: 3, company: 'metals', does: 'Both hands. Swings up close, hits much harder, and swings slower.' },
  { id: 'Staff', slot: 'twoHand', level: 3, company: 'scrolls', does: 'Both hands. Casts magic that bursts on a group, and hits much harder.' },
  { id: 'Grimoire', slot: 'twoHand', level: 3, company: 'scrolls', does: 'Both hands. Casts magic that bursts on a group, hits much harder, and casts a little quicker.' },
  // ---- the off hand ----------------------------------------------------------
  { id: 'Shield', slot: 'offHand', level: 1, company: 'metals', basic: true, does: 'Off hand. Holds 2 enemies on the road, and adds attack speed and crit.' },
  { id: 'Buckler', slot: 'offHand', level: 1, company: 'art', does: 'Off hand. Holds 1 enemy on the road, and adds attack speed and crit.' },
  { id: 'Pavise', slot: 'offHand', level: 2, company: 'metals', does: 'Off hand. Holds 3 enemies on the road, and adds attack speed and crit.' },
  { id: 'Tome', slot: 'offHand', level: 1, company: 'scrolls', does: 'Off hand. Adds attack speed and crit.' },
  { id: 'Quiver', slot: 'offHand', level: 1, company: 'spice', does: 'Off hand. Adds attack speed and crit.' },
  { id: 'Focus', slot: 'offHand', level: 2, company: 'art', does: 'Off hand. Adds attack speed and crit.' },
  // ---- the body --------------------------------------------------------------
  { id: 'Mail', slot: 'body', level: 1, company: 'metals', basic: true, does: 'Body. Adds reach and a wider blast.' },
  { id: 'Plate', slot: 'body', level: 2, company: 'metals', does: 'Body. Adds reach and a wider blast.' },
  { id: 'Robe', slot: 'body', level: 1, company: 'silk', does: 'Body. Adds reach and a wider blast.' },
  { id: 'Cloak', slot: 'body', level: 1, company: 'art', does: 'Body. Adds reach and a wider blast.' },
  { id: 'Aegis', slot: 'body', level: 3, company: 'silk', does: 'Body. Adds reach and a wider blast.' },
  // ---- the Sovereign tier (Level 4): one per company, a delivered charter each --
  { id: 'Saffron Brand', slot: 'oneHand', level: 4, company: 'spice', does: 'One hand. Swings up close, and every hit burns for 20 a second for 3 seconds.' },
  { id: 'Gilded Easel', slot: 'offHand', level: 4, company: 'art', does: 'Off hand. Holds 4 enemies on the road, and adds attack speed and crit.' },
  { id: 'Ironheart Plate', slot: 'body', level: 4, company: 'metals', does: 'Body. Adds reach, a wider blast, and 15% damage.' },
  { id: 'Silkwind Cloak', slot: 'body', level: 4, company: 'silk', does: 'Body. Adds reach, a wider blast, and 15% attack speed.' },
  { id: 'Moonquill Codex', slot: 'twoHand', level: 4, company: 'scrolls', does: 'Both hands. Casts magic that bursts on a group, hits much harder, and jumps to 2 more enemies.' },
]

const BY_ID = new Map(ITEM_KINDS.map((k) => [k.id, k]))
export const itemKindById = (id: string): ItemKind | undefined => BY_ID.get(id)
export const isItemKind = (v: unknown): v is string => typeof v === 'string' && BY_ID.has(v)

/** The top tier: Level 4 kinds, dealt only once a delivered Sovereign Route has unlocked them. */
export const SOVEREIGN_LEVEL = 4
/** Whether a kind is of the Sovereign tier. */
export const isSovereignKind = (id: string): boolean => BY_ID.get(id)?.level === SOVEREIGN_LEVEL

/** The five kinds every player has from the first run: Sword, Bow, Wand, Shield, Mail. */
export const BASIC_ITEM_KINDS: readonly string[] = ITEM_KINDS.filter((k) => k.basic).map((k) => k.id)
/**
 * The kinds contracts, standing and sealed crates unlock, one at a time, at
 * random: Levels 1–3. Never the Sovereign tier.
 */
export const UNLOCK_ITEM_KINDS: readonly string[] = ITEM_KINDS.filter((k) => !k.basic && k.level < SOVEREIGN_LEVEL).map((k) => k.id)
/** The Sovereign tier, in collection order: each opens with one delivered Sovereign Route. */
export const SOVEREIGN_ITEM_KINDS: readonly string[] = ITEM_KINDS.filter((k) => k.level === SOVEREIGN_LEVEL).map((k) => k.id)
/**
 * Every kind of Levels 1–3 — what a run saved before item unlocks keeps
 * dealing. Never the Sovereign tier: those deal only once owned.
 */
export const ALL_ITEM_KINDS: readonly string[] = ITEM_KINDS.filter((k) => k.level < SOVEREIGN_LEVEL).map((k) => k.id)

/**
 * The kinds a run deals: the basic set plus every unlocked kind, in collection
 * order. A Sovereign kind is in it only when `unlocked` names it.
 */
export function itemPoolFor(unlocked: readonly string[]): string[] {
  const have = new Set([...BASIC_ITEM_KINDS, ...unlocked])
  return ITEM_KINDS.filter((k) => have.has(k.id)).map((k) => k.id)
}

