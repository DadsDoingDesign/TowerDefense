/**
 * The opening kit, and the "fill an empty slot" rule — one source of truth for
 * the store AND the balance harness.
 *
 * **Why this file exists.** Two defects sat on the first ten seconds of every
 * campaign run:
 *
 *  1. The kit was dealt in `newRun`, *before* the hero was picked, from the
 *     roster-blind table. Half of all opening one-handers were the wrong damage
 *     type for whoever ended up holding them — `computeCombat` reads only the
 *     flat damage that matches the wielder (`isPhys ? flatPhys : flatMag`), so a
 *     Sword in a Mystic's hand is worth exactly zero.
 *  2. It then sat **unequipped in the pack**. A first-time player who did not
 *     find the equip flow fought the whole opening with bare hands, while the
 *     balance harness modelled the same kit as worn. The game and its own gate
 *     disagreed about the one moment every run shares.
 *
 * Both now go through here. `gameStore.pickStartingHero` calls
 * {@link startingKit} after the pick and wears it with {@link wearKit};
 * `balance/harness.freshHero` calls the same two functions on the same stream.
 */
import type { RNG } from '../core/rng'
import { damageTypeOf, generateItem, heroSlotsFor, type RosterRef } from '../data/items'
import type { Archetype, HeroSlot, Item, ItemRarity, ItemSlot, Sentinel } from '../types'
import { computeCombat } from './combat'

/** One kit piece: which slot it fills and at what forced rarity. */
export interface KitPiece {
  slot: ItemSlot
  rarity: ItemRarity
}

/**
 * What each archetype walks out of the gate with: `[weapon, body, off-hand]`.
 *
 * The weapon always matches the leader's damage type. The table differs by
 * archetype on purpose: it is the one lever that touches the opening of a run
 * and NOTHING else — not recruits ({@link RECRUIT_KIT}), not the §1/§2/§4
 * benches (which build their own gear), not the Monte Carlo teams.
 *
 * **Why the Mystic opens with an Epic weapon.** A Mystic-led run won 12% of
 * the time against 35% for a Fighter or Rogue (adaptive route, n=200), and 43%
 * of its losses came at depths 4–5 — the first Elite, before any evolution.
 * The cause is the opening: a level-1 Mystic with the common kit deals ~39 DPS
 * against a Fighter's ~68 and a Rogue's ~115, because its whole damage line is
 * a 16-damage, 0.8/s splash bolt. Flat weapon damage is the only thing that
 * scales that bolt, so the weapon is the lever. Measured (n=400, seeds 20000+,
 * with the Phase-1 spec lifts): common 14% → rare 21% → **epic 33%**. The
 * tier-0 alternative (Mystic base 16 → 20 damage, 0.8 → 1.0 rate) reached 26%
 * but moved every Mystic in every bench: §6 went to 64% (band 45–60), §4's
 * `magic` bench saturated at 100%, and three cleric supports fell under their
 * filler. The kit moves the one run it is meant to.
 */
export const KIT: Record<Archetype, readonly [KitPiece, KitPiece, KitPiece]> = {
  fighter: [{ slot: 'oneHand', rarity: 'common' }, { slot: 'body', rarity: 'common' }, { slot: 'offHand', rarity: 'rare' }],
  rogue: [{ slot: 'oneHand', rarity: 'common' }, { slot: 'body', rarity: 'common' }, { slot: 'offHand', rarity: 'rare' }],
  mystic: [{ slot: 'oneHand', rarity: 'epic' }, { slot: 'body', rarity: 'common' }, { slot: 'offHand', rarity: 'rare' }],
}

/**
 * The opening kit for a company led by `archetype` ({@link KIT}), then one
 * roster-aware luck-0.1 roll per `extra` (Quartermaster).
 *
 * No pity is threaded on purpose: forced-rarity opening items are not the
 * drought the pity timer exists to end, and starting a run with the counter
 * already moved would make the first real drop worse.
 */
export function startingKit(
  rng: RNG,
  archetype: Archetype,
  opts: { extra?: number; roster?: readonly RosterRef[] } = {},
): Item[] {
  const roster = opts.roster && opts.roster.length ? opts.roster : [{ archetype }]
  const damageType = damageTypeOf(archetype)
  const items = KIT[archetype].map((p) => generateItem(rng, { slot: p.slot, rarity: p.rarity, roster, damageType, allowCurse: false }))
  for (let i = 0; i < (opts.extra ?? 0); i++) items.push(generateItem(rng, { luck: 0.1, roster }))
  return items
}

/**
 * What a Sentinel who joins mid-run (or from the hub) arrives carrying: a
 * common weapon of their own damage type. Their other slots are dressed from
 * the pack with {@link autoEquipEmpty}.
 *
 * Hires used to arrive with NOTHING in the store, while the balance harness
 * handed every hire a full freshly rolled opening kit — so every §11/§12/§13
 * number priced a recruit the game never delivered. Measured on the adaptive
 * route (n=400, seeds 20000+): a bare hire takes the starting-hero win rates to
 * Fighter 29% / Rogue 32%; a full kit to 34% / 41%; one common weapon to
 * 32% / 36%. A veteran "hired at the front" (M17) arrives armed, not dressed:
 * the weapon is the one piece that decides whether a body can hold a lane, and
 * the rest of the dressing is the pack's job — which is what makes the pack,
 * and the merchant, matter to a company that is growing.
 */
export const RECRUIT_KIT: KitPiece[] = [{ slot: 'oneHand', rarity: 'common' }]

/** A recruit's own kit ({@link RECRUIT_KIT}), weapon on their damage type. */
export function recruitKit(rng: RNG, archetype: Archetype): Item[] {
  const damageType = damageTypeOf(archetype)
  return RECRUIT_KIT.map((p) =>
    generateItem(rng, { slot: p.slot, rarity: p.rarity, roster: [{ archetype }], damageType, allowCurse: false }),
  )
}

/**
 * Wear the three core kit pieces on a bare hero, each in its natural empty
 * slot. A two-handed kit weapon takes the main hand, and an off-hand piece
 * that cannot be held beside it is simply not worn (it stays in the pack).
 */
export function wearKit(hero: Sentinel, kit: readonly Item[]): Sentinel {
  let out = hero
  for (const item of kit.slice(0, 3)) {
    const slot = emptySlotFor(out, item)
    if (slot) out = { ...out, equipment: { ...out.equipment, [slot]: item } }
  }
  return out
}

const isCursed = (item: Item): boolean => item.enchantments.some((e) => e.id.startsWith('cx_'))

/**
 * The empty slot `item` would go into on `hero`, or null if it has none.
 * A two-hander needs BOTH hands free — taking it would otherwise unseat the
 * off-hand, and this rule never unseats anything.
 */
function emptySlotFor(hero: Sentinel, item: Item): HeroSlot | null {
  const eq = hero.equipment
  if (item.slot === 'twoHand') return !eq.mainHand && !eq.offHand ? 'mainHand' : null
  if (eq.mainHand?.slot === 'twoHand' && item.slot !== 'body') return null
  for (const slot of heroSlotsFor(item.slot)) if (!eq[slot]) return slot
  return null
}

/**
 * How much `item` improves `hero` if dropped into an empty slot, or null if it
 * is not a **strict** upgrade there. Strict means it can only add:
 *
 *  - never a keepsake (where a team banner hangs is a positioning decision);
 *  - never a curse (a curse is a trade, and trades are the player's to make);
 *  - never lowers `computeCombat().dps` — the tooltip's own number;
 *  - a weapon must be of the wearer's damage type AND raise it: an off-type
 *    weapon's damage line reads zero on them, and parking it in the hand
 *    would block the slot against the right one. Off-hands and bodies carry
 *    archetype-blind reach/area/speed, so "does no harm" is enough for them.
 */
export function emptySlotGain(hero: Sentinel, item: Item): { slot: HeroSlot; gain: number } | null {
  if (item.keepsake || isCursed(item)) return null
  const slot = emptySlotFor(hero, item)
  if (!slot) return null
  const before = computeCombat(hero).dps
  const after = computeCombat({ ...hero, equipment: { ...hero.equipment, [slot]: item } }).dps
  const gain = after - before
  const weapon = item.slot === 'oneHand' || item.slot === 'twoHand'
  if (weapon) {
    const flat = damageTypeOf(hero.archetype) === 'magic' ? item.base.magDamage : item.base.physDamage
    if (!flat || gain <= 0) return null
  }
  if (gain < 0) return null
  return { slot, gain }
}

export interface AutoEquipResult {
  roster: Sentinel[]
  /** Items that found no empty slot they strictly improve — they go to the pack. */
  rest: Item[]
  /** What went where, so the UI can say so. */
  placed: { itemId: string; sentinelId: string; slot: HeroSlot }[]
}

/**
 * Drop each incoming item into the empty slot it improves most, across the
 * whole roster. Nothing already worn is ever replaced — a strict upgrade into
 * an EMPTY slot is the only move this makes on the player's behalf.
 */
export function autoEquipEmpty(roster: readonly Sentinel[], items: readonly Item[]): AutoEquipResult {
  let next = [...roster]
  const rest: Item[] = []
  const placed: AutoEquipResult['placed'] = []
  for (const item of items) {
    let best: { idx: number; slot: HeroSlot; gain: number } | null = null
    next.forEach((hero, idx) => {
      const g = emptySlotGain(hero, item)
      if (g && (!best || g.gain > best.gain)) best = { idx, ...g }
    })
    if (!best) {
      rest.push(item)
      continue
    }
    const { idx, slot } = best as { idx: number; slot: HeroSlot; gain: number }
    const hero = next[idx]
    next = next.map((h, i) => (i === idx ? { ...h, equipment: { ...h.equipment, [slot]: item } } : h))
    placed.push({ itemId: item.id, sentinelId: hero.id, slot })
  }
  return { roster: next, rest, placed }
}
