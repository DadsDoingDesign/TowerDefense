/**
 * The opening kit, and the "fill an empty slot" rule — one source of truth for
 * the store AND the balance harness.
 *
 * Since the classless rework the leader's kit is not dealt here: a picked hero
 * arrives WEARING the gear its card showed (`run/heroes.chosenHero` — the
 * old per-class kit table became `heroes.pickRarity`). What remains is the
 * Quartermaster's extra rolls and the empty-slot rule every new item meets.
 *
 * Why the rule exists. A first-time player who did not find the equip flow
 * fought the whole opening with bare hands while the balance harness modelled
 * the same kit as worn; the game and its own gate disagreed about the one
 * moment every run shares. Both now go through here.
 */
import type { RNG } from '../core/rng'
import { generateItem, heroDamageType, heroSlotsFor, type EquipRules, type RosterRef } from '../data/items'
import type { HeroSlot, Item, ItemRarity, ItemSlot, Sentinel } from '../types'
import { computeCombat } from './combat'

/** One kit piece: which slot it fills and at what forced rarity. */
export interface KitPiece {
  slot: ItemSlot
  rarity: ItemRarity
}

/**
 * The Quartermaster's `extra` roster-aware luck-0.1 rolls, from the run's
 * unlocked kinds. No pity is threaded on purpose: forced opening items are not
 * the drought the pity timer exists to end.
 */
export function startingKit(rng: RNG, opts: { extra?: number; roster?: readonly RosterRef[]; kinds?: readonly string[] } = {}): Item[] {
  const items: Item[] = []
  for (let i = 0; i < (opts.extra ?? 0); i++) items.push(generateItem(rng, { luck: 0.1, roster: opts.roster, kinds: opts.kinds }))
  return items
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

/**
 * The run's equip rules (whether the Twinblade Harness is held). Defined with
 * the grip table in `data/items.ts`; re-exported here for the callers that
 * import it beside the kit.
 */
export type { EquipRules }

const isCursed = (item: Item): boolean => item.enchantments.some((e) => e.id.startsWith('cx_'))

/**
 * The empty slot `item` would go into on `hero`, or null if it has none.
 * A two-hander needs BOTH hands free — taking it would otherwise unseat the
 * off-hand, and this rule never unseats anything.
 */
function emptySlotFor(hero: Sentinel, item: Item, opts: EquipRules = {}): HeroSlot | null {
  const eq = hero.equipment
  if (item.slot === 'twoHand') return !eq.mainHand && !eq.offHand ? 'mainHand' : null
  if (eq.mainHand?.slot === 'twoHand' && item.slot !== 'body') return null
  for (const slot of heroSlotsFor(item, hero, opts)) if (!eq[slot]) return slot
  return null
}

/**
 * How much `item` improves `hero` if dropped into an empty slot, or null if it
 * is not a **strict** upgrade there. Strict means it can only add:
 *
 *  - never a keepsake (where a team banner hangs is a positioning decision);
 *  - never a curse (a curse is a trade, and trades are the player's to make);
 *  - never lowers `computeCombat().dps` — the tooltip's own number;
 *  - a weapon must carry damage of the type its wearer deals WITH it on (the
 *    weapon in hand decides the type, `items.heroDamageType`) AND raise it: a
 *    wand in a swordsman's off hand reads zero, and parking it there would
 *    block the slot against the right one. Off-hands and bodies carry
 *    type-blind reach/area/speed, so "does no harm" is enough for them.
 */
export function emptySlotGain(hero: Sentinel, item: Item, opts: EquipRules = {}): { slot: HeroSlot; gain: number } | null {
  if (item.keepsake || isCursed(item)) return null
  const slot = emptySlotFor(hero, item, opts)
  if (!slot) return null
  const before = computeCombat(hero).dps
  const worn = { ...hero, equipment: { ...hero.equipment, [slot]: item } }
  const after = computeCombat(worn).dps
  const gain = after - before
  const weapon = item.slot === 'oneHand' || item.slot === 'twoHand'
  if (weapon) {
    const flat = heroDamageType(worn) === 'magic' ? item.base.magDamage : item.base.physDamage
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
export function autoEquipEmpty(roster: readonly Sentinel[], items: readonly Item[], opts: EquipRules = {}): AutoEquipResult {
  let next = [...roster]
  const rest: Item[] = []
  const placed: AutoEquipResult['placed'] = []
  for (const item of items) {
    let best: { idx: number; slot: HeroSlot; gain: number } | null = null
    next.forEach((hero, idx) => {
      const g = emptySlotGain(hero, item, opts)
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
