/**
 * ---------------------------------------------------------------------------
 * What a hero is, read off what it holds (the classless rework)
 * ---------------------------------------------------------------------------
 *
 * The designer: "we dont have a set class, its just 3 options with items and
 * skills you have unlocked applied randomly" … "both skills and items — they
 * just apply their effects and things will happen basically".
 *
 * So a hero is a name, modest base stats, its ITEMS and its SKILLS. There is
 * no class. Everything a class used to decide is derived here from the gear:
 *
 *   main hand                         style    look       damage
 *   Sword, Axe, Greatsword, Warhammer swing    armoured   physical  (needs clearance)
 *   Bow, Dagger                       shoot    hooded     physical
 *   Wand, Rod, Sceptre, Staff, Grimoire cast   robed      magic (bursts on a group)
 *   nothing (a knife/wand in the off hand counts as the main)  → stones, hooded
 *
 *   off hand: Buckler holds 1 · Shield holds 2 · Pavise holds 3 (and adds thorns)
 *
 * The three sprites stay, picked by the weapon (`lookOf`): the art key is the
 * one place the old class names survive, as file names (`fighter_idle.png`).
 */
import { heroStyle, itemNoun, shieldHold, type HeroStyle } from './items'
import type { Archetype, Item, Sentinel } from '../types'

export type { HeroStyle }
export { heroStyle }

/**
 * The art key a style is drawn with — the sprite family (`fighter_*.png` is
 * the armoured look, `rogue_*` the hooded one, `mystic_*` the robed one) and
 * the hue token (`--fighter`, …). It is ONLY art: no rule reads it.
 */
export const STYLE_LOOK: Readonly<Record<HeroStyle, Archetype>> = { swing: 'fighter', shoot: 'rogue', cast: 'mystic' }

/** How a hero is drawn: by its weapon; an unarmed hero with a shield looks armoured, else hooded. */
export function lookOf(hero: Pick<Sentinel, 'equipment'>): Archetype {
  const style = heroStyle(hero)
  if (style) return STYLE_LOOK[style]
  return shieldHold(hero.equipment.offHand) > 0 ? 'fighter' : 'rogue'
}

/** The weapon a hero's style comes from (main hand first), or null. */
export function styleWeapon(hero: Pick<Sentinel, 'equipment'>): Item | null {
  const { mainHand, offHand } = hero.equipment
  if (mainHand && heroStyle({ equipment: { mainHand, offHand: null, body: null } })) return mainHand
  if (offHand && heroStyle({ equipment: { mainHand: null, offHand, body: null } })) return offHand
  return null
}

const article = (noun: string) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`
const nounOf = (item: Item): string => (itemNoun(item) ?? 'weapon').toLowerCase()

/**
 * What the hero's WEAPON makes it do, in plain words: "Swings a sword up
 * close", "Shoots a bow from far away", "Casts magic from a wand".
 */
export function weaponDoes(hero: Pick<Sentinel, 'equipment'>): string {
  const w = styleWeapon(hero)
  const style = heroStyle(hero)
  if (!w || !style) return 'Throws stones'
  const n = nounOf(w)
  if (style === 'swing') return `Swings ${article(n)} up close`
  if (style === 'shoot') return n === 'bow' ? 'Shoots a bow from far away' : 'Throws daggers from far away'
  return `Casts magic from ${article(n)} at a group`
}

/** "holds 2 enemies with its shield", or null when the off hand holds nothing. */
export function shieldDoes(hero: Pick<Sentinel, 'equipment'>): string | null {
  const off = hero.equipment.offHand
  const n = shieldHold(off)
  if (!off || !n) return null
  return `holds ${n} ${n === 1 ? 'enemy' : 'enemies'} with its ${nounOf(off)}`
}

/**
 * The hero's job, said by its gear alone: "Swings a sword up close · holds 2
 * enemies with its shield". Only what each piece does — never how pieces or
 * skills will combine (the designer: "dont say how it will mix").
 */
export function heroDoes(hero: Pick<Sentinel, 'equipment'>): string {
  const hold = shieldDoes(hero)
  return hold ? `${weaponDoes(hero)} · ${hold}` : weaponDoes(hero)
}

/**
 * A hero's kit in a word or two, where a class name used to sit (the run
 * receipt's table, a hire's row): "Sword & Shield", "Bow", "Unarmed".
 */
export function kitName(hero: Pick<Sentinel, 'equipment'>): string {
  const { mainHand, offHand } = hero.equipment
  const parts = [mainHand, offHand].filter((i): i is Item => !!i).map((i) => itemNoun(i) ?? 'Gear')
  return parts.length ? parts.join(' & ') : 'Unarmed'
}
