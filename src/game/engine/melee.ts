/**
 * ---------------------------------------------------------------------------
 * Who swings — the one melee rule (weapon clearance)
 * ---------------------------------------------------------------------------
 *
 * The designer: "skills and weapon type affect your hero. like equiping a sword
 * might make it unsafe to use a tower where it is and require you to make
 * space". So a hero is melee — keeps the 3 × 3 clearance on the grid
 * (`terrain.CLEARANCE`) — because of what it HOLDS, not its class:
 *
 *  - **a swinging weapon in either hand**: a Sword, Axe, Greatsword or
 *    Warhammer (`items.itemSwings`, the `swings` mark on `ITEM_BASES`). Knives,
 *    bows, wands, rods, sceptres, staves and grimoires do not swing. The off
 *    hand counts too: only the Twinblade Harness puts a sword there, and a
 *    sword in the off hand is still a sword being swung;
 *  - **or a skill that says so**: `EffectMods.grantsMelee` on the hero's own
 *    derived combat mods (`computeCombat(hero).mods` — path, mutations, perks
 *    or the skills that replace them, gear; never the team's relics). Nothing
 *    grants it today; a skill plugs in by setting the flag.
 *
 * An unarmed hero and a shield-only hero have nothing to swing: not melee.
 * That is also what makes a clearance conflict always fixable — taking the
 * weapon off is a legal move whenever gear is (see `run/clearance.ts`).
 *
 * Holding enemies (`mods.block`) is a separate thing: it comes from a SHIELD
 * in the off hand (the classless rework, `items.shieldHold`) or a hold skill,
 * and never makes a hero swing — a wand-hand with a shield holds the road and
 * keeps no clearance. This is only the placement rule.
 *
 * EVERY caller asks {@link isMelee}: the store's posting and breather move,
 * the engine's `moveHero`, `carryPlacements`, the balance harness's modelled
 * player, the menu cinematic, the canvas overlay, the keyboard tile names and
 * the coach line.
 */
import { itemNoun, itemSwings } from '../data/items'
import type { Item, Sentinel } from '../types'
import { computeCombat } from './combat'

/** The swinging weapon a hero holds (main hand first), or null. */
export function swingWeapon(hero: Pick<Sentinel, 'equipment'>): Item | null {
  const { mainHand, offHand } = hero.equipment
  if (itemSwings(mainHand)) return mainHand
  if (itemSwings(offHand)) return offHand
  return null
}

/** Does a skill (or any of the hero's own mods) make it swing whatever it holds? */
export const skillMelee = (hero: Sentinel): boolean => !!computeCombat(hero).mods.grantsMelee

/**
 * Is this hero melee — does it keep a clearance? A swinging weapon in either
 * hand, or a skill that grants it ({@link skillMelee}).
 */
export function isMelee(hero: Sentinel): boolean {
  return !!swingWeapon(hero) || skillMelee(hero)
}

/** Why a hero swings, for the copy: the weapon, a skill, or null when it does not. */
export function meleeSource(hero: Sentinel): { kind: 'weapon'; item: Item } | { kind: 'skill' } | null {
  const item = swingWeapon(hero)
  if (item) return { kind: 'weapon', item }
  return skillMelee(hero) ? { kind: 'skill' } : null
}

/** The weapon's kind in plain words: "sword", "greatsword". */
export const weaponNoun = (item: Item): string => (itemNoun(item) ?? 'weapon').toLowerCase()

/** The weapon's kind with its article: "a sword", "an axe". */
export function weaponWord(item: Item): string {
  const noun = weaponNoun(item)
  return `${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`
}

/** "Doyle swings a sword" / "Doyle swings" — the reason, in a phrase. */
export function swingsPhrase(hero: Sentinel): string {
  const src = meleeSource(hero)
  return src?.kind === 'weapon' ? `${hero.name} swings ${weaponWord(src.item)}` : `${hero.name} swings`
}

/** The hero panel's / party card's plain line for a melee hero. */
export const MELEE_LINE = 'Swings — needs clearance'
