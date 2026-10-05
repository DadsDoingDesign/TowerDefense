import type { ItemSlot } from '../types'

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
  basic?: true  /**
   * The trade company whose pool this kind leans to — unassigned for now; a
   * later economy biases its unlock roll with it (`watch.rollFromPool`).
   */
  company?: string
}

export const ITEM_KINDS: readonly ItemKind[] = [
  // ---- weapons: what the hero does comes from these ------------------------
  { id: 'Sword', slot: 'oneHand', basic: true, does: 'One hand. Swings at enemies up close.' },
  { id: 'Bow', slot: 'twoHand', basic: true, does: 'Both hands. Shoots enemies from far away.' },
  { id: 'Wand', slot: 'oneHand', basic: true, does: 'One hand, or the off hand. Casts magic that bursts on a group.' },
  { id: 'Axe', slot: 'oneHand', does: 'One hand. Swings at enemies up close, a little slower than a sword.' },
  { id: 'Dagger', slot: 'oneHand', does: 'One hand, or the off hand. Throws quick strikes from far away.' },
  { id: 'Rod', slot: 'oneHand', does: 'One hand. Casts magic that bursts on a group.' },
  { id: 'Sceptre', slot: 'oneHand', does: 'One hand. Casts magic that bursts on a group, a little quicker than a rod.' },
  { id: 'Greatsword', slot: 'twoHand', does: 'Both hands. Swings up close, hits much harder, and swings a little slower.' },
  { id: 'Warhammer', slot: 'twoHand', does: 'Both hands. Swings up close, hits much harder, and swings slower.' },
  { id: 'Staff', slot: 'twoHand', does: 'Both hands. Casts magic that bursts on a group, and hits much harder.' },
  { id: 'Grimoire', slot: 'twoHand', does: 'Both hands. Casts magic that bursts on a group, hits much harder, and casts a little quicker.' },
  // ---- the off hand ----------------------------------------------------------
  { id: 'Shield', slot: 'offHand', basic: true, does: 'Off hand. Holds 2 enemies on the road, and adds attack speed and crit.' },
  { id: 'Buckler', slot: 'offHand', does: 'Off hand. Holds 1 enemy on the road, and adds attack speed and crit.' },
  { id: 'Pavise', slot: 'offHand', does: 'Off hand. Holds 3 enemies on the road, and adds attack speed and crit.' },
  { id: 'Tome', slot: 'offHand', does: 'Off hand. Adds attack speed and crit.' },
  { id: 'Quiver', slot: 'offHand', does: 'Off hand. Adds attack speed and crit.' },
  { id: 'Focus', slot: 'offHand', does: 'Off hand. Adds attack speed and crit.' },
  // ---- the body --------------------------------------------------------------
  { id: 'Mail', slot: 'body', basic: true, does: 'Body. Adds reach and a wider blast.' },
  { id: 'Plate', slot: 'body', does: 'Body. Adds reach and a wider blast.' },
  { id: 'Robe', slot: 'body', does: 'Body. Adds reach and a wider blast.' },
  { id: 'Cloak', slot: 'body', does: 'Body. Adds reach and a wider blast.' },
  { id: 'Aegis', slot: 'body', does: 'Body. Adds reach and a wider blast.' },
]

const BY_ID = new Map(ITEM_KINDS.map((k) => [k.id, k]))
export const itemKindById = (id: string): ItemKind | undefined => BY_ID.get(id)
export const isItemKind = (v: unknown): v is string => typeof v === 'string' && BY_ID.has(v)

/** The five kinds every player has from the first run: Sword, Bow, Wand, Shield, Mail. */
export const BASIC_ITEM_KINDS: readonly string[] = ITEM_KINDS.filter((k) => k.basic).map((k) => k.id)
/** The kinds the Watch track unlocks, one at a time, at random. */
export const UNLOCK_ITEM_KINDS: readonly string[] = ITEM_KINDS.filter((k) => !k.basic).map((k) => k.id)
/** Every kind — what a run saved before item unlocks keeps dealing. */
export const ALL_ITEM_KINDS: readonly string[] = ITEM_KINDS.map((k) => k.id)

/** The kinds a run deals: the basic set plus every unlocked kind, in collection order. */
export function itemPoolFor(unlocked: readonly string[]): string[] {
  const have = new Set([...BASIC_ITEM_KINDS, ...unlocked])
  return ITEM_KINDS.filter((k) => have.has(k.id)).map((k) => k.id)
}

/**
 * The Daily Watch's item pool: the basic set, for everyone — a Daily reads no
 * hub, so the same seed deals the same heroes and loot whatever a player has
 * unlocked (the skills' Daily pool is the starters, for the same reason).
 */
export const DAILY_ITEM_POOL: readonly string[] = BASIC_ITEM_KINDS
