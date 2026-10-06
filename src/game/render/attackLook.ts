/**
 * What a hero's attack LOOKS like — read off what it holds, the same way the
 * attack itself is (there is no class). Pure: no canvas, no DOM, no clock, so
 * `tests/attackLook.test.ts` pins every rule here.
 *
 * ## Why this exists
 *
 * The designer: "if a weapon is melee it shouldnt fire projectiles … the
 * projectiles should match the effects of the weapon and melee if it has
 * effects should show too". The engine delivers EVERY hit as a projectile — a
 * sword's blow is a 560 px/s shot that crosses its 96 px reach in a sixth of a
 * second and lands on arrival — and the renderer drew every one of them as the
 * same hue-tinted dot, so a swordsman visibly fired bullets.
 *
 * The engine is not touched (its damage timing is the balance; `npm run
 * balance` stays byte-identical). The PRESENTATION reads the delivery instead:
 *
 *   held                                   delivery   drawn as
 *   Sword, Axe, Greatsword, Warhammer      swing      a slash at the target, no projectile
 *   (or any hero a skill makes melee)
 *   Bow                                    arrow      a shafted arrow along its flight
 *   Dagger (a knife in either hand)        knife      a small spinning blade
 *   Wand, Rod, Sceptre, Staff, Grimoire    bolt       a glowing bolt, magic-violet
 *   nothing                                stone      a grey pebble
 *
 * and the shot's on-hit effects ({@link hitEffects}) colour its trail and its
 * impact from ONE palette ({@link EFFECT_INK}) whether it flew or was swung.
 */
import { itemNoun } from '../data/items'
import { heroStyle, styleWeapon } from '../data/gear'
import { isMelee, swingWeapon } from '../engine/melee'
import type { EffectMods, Sentinel } from '../types'

export type Delivery = 'swing' | 'arrow' | 'knife' | 'bolt' | 'stone'

/**
 * The delivery a hero's hits arrive by. Melee is decided by THE one rule
 * (`melee.isMelee` — a swinging weapon in either hand, or a skill that grants
 * it); everything else by the weapon that sets its style, main hand first.
 */
export function deliveryOf(hero: Sentinel, melee: boolean = isMelee(hero)): Delivery {
  if (melee) return 'swing'
  const style = heroStyle(hero)
  if (style === 'cast') return 'bolt'
  if (style === 'shoot') {
    // The weapon the style comes from (main hand first): a bow, or a knife.
    const w = styleWeapon(hero)
    return w && itemNoun(w) === 'Bow' ? 'arrow' : 'knife'
  }
  return 'stone'
}

/**
 * Memo for {@link deliveryOf}, keyed by the hero OBJECT. A `Sentinel` is never
 * mutated in place (the store replaces it on every equip), so an identity key
 * is exact, and the frame loop asks once per hero per frame — `isMelee` folds
 * the hero's whole combat profile when it holds no swinging weapon, which is
 * not something to do sixty times a second. A WeakMap holds nothing alive.
 */
const deliveryMemo = new WeakMap<Sentinel, Delivery>()
export function deliveryCached(hero: Sentinel): Delivery {
  let d = deliveryMemo.get(hero)
  if (d === undefined) deliveryMemo.set(hero, (d = deliveryOf(hero)))
  return d
}

/**
 * The delivery of a hero ON THE FIELD (an `RtSentinel`). The same rule, read
 * off what the battle already folded: a swinging weapon in either hand
 * (`melee.swingWeapon`) or `grantsMelee` on the combat profile the engine
 * built — so the frame loop never re-folds a profile. Memoised by the hero
 * object, which the engine holds unchanged for the whole battle.
 */
const rtMemo = new WeakMap<Sentinel, Delivery>()
export function deliveryOfRt(s: { def: Sentinel; profile: { mods: EffectMods } }): Delivery {
  let d = rtMemo.get(s.def)
  if (d === undefined) rtMemo.set(s.def, (d = deliveryOf(s.def, !!swingWeapon(s.def) || !!s.profile.mods.grantsMelee)))
  return d
}

/** Does this delivery travel as a drawn projectile? A swing never does. */
export const drawsProjectile = (d: Delivery): boolean => d !== 'swing'

/**
 * An on-hit effect a shot (or a blow) carries, in the order they claim the
 * lead colour: the elemental three first because they have the strongest
 * hues, then the siphon, then the two that are tells rather than elements.
 */
export type HitEffect = 'burn' | 'chill' | 'shock' | 'drain' | 'stun' | 'execute'
export const EFFECT_ORDER: readonly HitEffect[] = ['burn', 'chill', 'shock', 'drain', 'stun', 'execute']

/** The effects a hit with these mods applies, in {@link EFFECT_ORDER}. */
export function hitEffects(mods: EffectMods, lifedrain = mods.lifedrain ?? 0): HitEffect[] {
  const out: HitEffect[] = []
  if (mods.burn && mods.burn.dps > 0) out.push('burn')
  if (mods.chill && mods.chill.slow > 0) out.push('chill')
  if (mods.shock && mods.shock.chains > 0) out.push('shock')
  if (lifedrain > 0) out.push('drain')
  if (mods.stunChance && mods.stunChance > 0) out.push('stun')
  if (mods.execute && mods.execute > 0) out.push('execute')
  return out
}

/** The one effect that colours a shot's trail and its impact, or null. */
export function leadEffect(mods: EffectMods, lifedrain = mods.lifedrain ?? 0): HitEffect | null {
  return hitEffects(mods, lifedrain)[0] ?? null
}

/**
 * The effect palette — ONE table for the trail, the swing and the impact.
 *
 * `core` is the hot centre (a bolt's body, a slash's edge), `glow` the soft
 * outer stroke, `spark` the particles it throws. The four that were already on
 * the field keep their colours (`units.drawProcRing`, `fx.fxProc`): shock
 * `#bfe9ff`, burn `#ff8a3c`, execute `#ff5d5d`, stun `#ffe08a`. Chill is NOT
 * another pale blue beside shock — it is a cold teal with white frost, and it
 * has its own SHAPE (shards, not a crackle), because two blues at 13 CSS px are
 * one blue to a deuteranope. Every effect has a distinct geometry in `fx.ts`
 * for the same reason; colour is never the only channel.
 */
export interface EffectInk {
  core: string
  glow: string
  spark: string
}
export const EFFECT_INK: Readonly<Record<HitEffect, EffectInk>> = {
  burn: { core: '#ffd166', glow: '#ff8a3c', spark: '#ffb14a' },
  chill: { core: '#e8fbff', glow: '#5fd3e6', spark: '#b8f0ff' },
  shock: { core: '#fff6a8', glow: '#bfe9ff', spark: '#fff27a' },
  drain: { core: '#ffb3b8', glow: '#d0324a', spark: '#ff5d6c' },
  stun: { core: '#fff6c8', glow: '#ffe08a', spark: '#ffe08a' },
  execute: { core: '#ffd0d0', glow: '#ff5d5d', spark: '#ff5d5d' },
}

/** The plain inks, for a hit that carries no effect. */
export const STEEL_INK: EffectInk = { core: '#fffaf0', glow: '#d9e2ea', spark: '#fff3d6' }
export const MAGIC_INK: EffectInk = { core: '#f4e8ff', glow: '#a970ff', spark: '#d4b8ff' }
export const STONE_INK: EffectInk = { core: '#d8d2c4', glow: '#8a8170', spark: '#cfc6b4' }

/**
 * The ink a delivery is drawn in: its lead effect's when it has one, else the
 * plain ink of its kind — steel for a blade or an arrow, violet for magic.
 */
export function inkOf(delivery: Delivery, damageType: 'physical' | 'magic', effect: HitEffect | null): EffectInk {
  if (effect) return EFFECT_INK[effect]
  if (delivery === 'stone') return STONE_INK
  return damageType === 'magic' ? MAGIC_INK : STEEL_INK
}
