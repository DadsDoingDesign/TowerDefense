// `render/plaques.ts` (reached through `render/renderer.ts`) reads `import.meta.env`;
// the node test program does not include `src/vite-env.d.ts`, so say it here.
/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import {
  deliveryOf,
  deliveryOfRt,
  drawsProjectile,
  EFFECT_INK,
  EFFECT_ORDER,
  hitEffects,
  inkOf,
  leadEffect,
  MAGIC_INK,
  STEEL_INK,
  type Delivery,
} from '../src/game/render/attackLook'
import { heroGear, rigFor, unpaints } from '../src/game/render/gearMarks'
import { drawProjectile, swingSide, swingSpan } from '../src/game/render/projectiles'
import { drawShots } from '../src/game/render/renderer'
import { isMelee } from '../src/game/engine/melee'
import { createHero } from '../src/game/data/sentinels'
import type { RtProjectile, RtSentinel } from '../src/game/engine/engine'
import type { EffectMods, Item, Sentinel } from '../src/game/types'

/*
 * What a hit LOOKS like (the designer: "if a weapon is melee it shouldnt fire
 * projectiles … the projectiles should match the effects of the weapon"). The
 * engine is untouched; these pin the presentation rules that read it.
 */

let n = 0
const item = (name: string, slot: Item['slot'], mods?: EffectMods): Item => ({
  id: `t${n++}`,
  name,
  slot,
  rarity: 'rare',
  base: {},
  enchantments: mods ? [{ id: 'x', label: 'x', mods }] : [],
})
const hero = (main: Item | null, off: Item | null = null): Sentinel => createHero({ equipment: { mainHand: main, offHand: off, body: null } })

const SWINGERS: [string, Item['slot']][] = [
  ['Sword', 'oneHand'],
  ['Axe', 'oneHand'],
  ['Greatsword', 'twoHand'],
  ['Warhammer', 'twoHand'],
  ['Saffron Brand', 'oneHand'],
]

describe('delivery — what a weapon throws', () => {
  it('every swinging weapon is a swing, exactly when the clearance rule says melee', () => {
    for (const [name, slot] of SWINGERS) {
      const h = hero(item(name, slot))
      expect(isMelee(h)).toBe(true)
      expect(deliveryOf(h)).toBe('swing')
      expect(drawsProjectile(deliveryOf(h))).toBe(false)
    }
  })

  it('a bow fires arrows, a knife flies as a knife, casters bolt, bare hands throw stones', () => {
    expect(deliveryOf(hero(item('Bow', 'twoHand')))).toBe('arrow')
    expect(deliveryOf(hero(item('Dagger', 'oneHand')))).toBe('knife')
    // A knife in the off hand with nothing in the main is still the weapon.
    expect(deliveryOf(hero(null, item('Dagger', 'oneHand')))).toBe('knife')
    for (const [name, slot] of [['Wand', 'oneHand'], ['Rod', 'oneHand'], ['Sceptre', 'oneHand'], ['Staff', 'twoHand'], ['Grimoire', 'twoHand']] as const) {
      expect(deliveryOf(hero(item(name, slot)))).toBe('bolt')
    }
    expect(deliveryOf(hero(null))).toBe('stone')
    expect(deliveryOf(hero(null, item('Shield', 'offHand')))).toBe('stone')
    for (const d of ['arrow', 'knife', 'bolt', 'stone'] as Delivery[]) expect(drawsProjectile(d)).toBe(true)
  })

  it('a sword in the off hand (the Twinblade Harness) still swings', () => {
    expect(deliveryOf(hero(item('Wand', 'oneHand'), item('Sword', 'oneHand')))).toBe('swing')
  })

  it('on the field, a skill that grants melee makes any weapon a swing', () => {
    const bow = hero(item('Bow', 'twoHand'))
    expect(deliveryOfRt({ def: bow, profile: { mods: {} } })).toBe('arrow')
    expect(deliveryOfRt({ def: hero(item('Bow', 'twoHand')), profile: { mods: { grantsMelee: true } } })).toBe('swing')
  })
})

describe('the effect palette', () => {
  it('reads every on-hit effect off the mods, in one fixed order', () => {
    const all: EffectMods = {
      execute: 0.1,
      stunChance: 0.2,
      lifedrain: 0.1,
      shock: { chains: 2, dmgFrac: 0.5 },
      chill: { slow: 0.2, dur: 1 },
      burn: { dps: 10, dur: 3 },
    }
    expect(hitEffects(all)).toEqual(EFFECT_ORDER)
    expect(leadEffect(all)).toBe('burn')
    expect(leadEffect({ chill: { slow: 0.2, dur: 1 } })).toBe('chill')
    expect(leadEffect({ shock: { chains: 1, dmgFrac: 0.5 } })).toBe('shock')
    expect(leadEffect({}, 0.15)).toBe('drain')
    // Inert values are no effect.
    expect(leadEffect({ shock: { chains: 0, dmgFrac: 0.5 }, burn: { dps: 0, dur: 3 } })).toBe(null)
    expect(hitEffects({})).toEqual([])
  })

  it('gives every effect its own glow, and keeps the proc-ring hues it already had', () => {
    const glows = EFFECT_ORDER.map((e) => EFFECT_INK[e].glow)
    expect(new Set(glows).size).toBe(glows.length)
    // `units.drawProcRing` / `fx.fxProc` colours, unchanged.
    expect(EFFECT_INK.burn.glow).toBe('#ff8a3c')
    expect(EFFECT_INK.shock.glow).toBe('#bfe9ff')
    expect(EFFECT_INK.execute.glow).toBe('#ff5d5d')
    expect(EFFECT_INK.stun.glow).toBe('#ffe08a')
  })

  it('an effect inks a hit however it arrived; without one, steel or magic violet', () => {
    for (const d of ['swing', 'arrow', 'bolt', 'knife'] as Delivery[]) expect(inkOf(d, 'physical', 'chill')).toBe(EFFECT_INK.chill)
    expect(inkOf('swing', 'physical', null)).toBe(STEEL_INK)
    expect(inkOf('arrow', 'physical', null)).toBe(STEEL_INK)
    expect(inkOf('bolt', 'magic', null)).toBe(MAGIC_INK)
  })
})

describe('gear on the figure', () => {
  it('carries the real weapon and off-hand, and the weapon wears its own enchantment', () => {
    const g = heroGear(hero(item('Flaming Axe', 'oneHand', { burn: { dps: 12, dur: 3 } }), item('Shield', 'offHand')).equipment)
    expect(g).toEqual({ main: 'axe', off: 'shield', glint: 'burn' })
    expect(heroGear(hero(item('Frost Wand', 'oneHand', { chill: { slow: 0.2, dur: 1 } }), item('Tome', 'offHand')).equipment)).toEqual({ main: 'wand', off: 'grimoire', glint: 'chill' })
    expect(heroGear(hero(null).equipment)).toEqual({ main: null, off: null, glint: null })
  })

  it("cuts the art's painted weapon out exactly when the hero holds something else", () => {
    const fighter = rigFor('tinyswords', 'fighter')
    expect(unpaints(fighter, heroGear(hero(item('Sword', 'oneHand')).equipment))).toBe(false)
    expect(unpaints(fighter, heroGear(hero(item('Axe', 'oneHand')).equipment))).toBe(true)
    // A shield and no weapon: no sword either.
    expect(unpaints(fighter, heroGear(hero(null, item('Shield', 'offHand')).equipment))).toBe(true)
    const rogue = rigFor('tinyswords', 'rogue')
    expect(unpaints(rogue, heroGear(hero(item('Bow', 'twoHand')).equipment))).toBe(false)
    expect(unpaints(rogue, heroGear(hero(item('Dagger', 'oneHand')).equipment))).toBe(true)
    // The robed look paints no weapon; an unmeasured pack is never cut.
    expect(unpaints(rigFor('tinyswords', 'mystic'), heroGear(hero(item('Wand', 'oneHand')).equipment))).toBe(false)
    expect(unpaints(rigFor('fieldwatch', 'fighter'), heroGear(hero(item('Axe', 'oneHand')).equipment))).toBe(false)
  })
})

/* ---- the render rule, on a recording context ------------------------------ */

type Op = { fn: string; args: number[] }
function recordingCtx(): { ctx: CanvasRenderingContext2D; ops: Op[] } {
  const ops: Op[] = []
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k: string) => (k in t ? t[k] : (...args: unknown[]) => void ops.push({ fn: k, args: args.filter((a): a is number => typeof a === 'number') })),
    set: (t, k: string, v) => ((t[k] = v), true),
  })
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops }
}

const rtHero = (def: Sentinel, x: number, y: number): RtSentinel => ({ id: def.id, def, pos: { x, y }, profile: { mods: {} } }) as unknown as RtSentinel
const shot = (srcId: string, x: number, y: number, mods: EffectMods = {}): RtProjectile => ({
  id: 'p1',
  pos: { x, y },
  toPos: { x: x + 20, y },
  targetId: 'e1',
  srcId,
  damage: 10,
  damageType: 'physical',
  isCrit: false,
  speed: 560,
  splashRadius: 0,
  pierce: 0,
  color: '#fff',
  mods,
  lifedrain: mods.lifedrain ?? 0,
})
/** Did anything get drawn within `r` px of (x, y)? */
const drawnNear = (ops: Op[], x: number, y: number, r: number) =>
  ops.some((o) => ['arc', 'moveTo', 'lineTo'].includes(o.fn) && o.args.length >= 2 && Math.hypot(o.args[0] - x, o.args[1] - y) <= r)

describe('a melee source never yields a projectile draw', () => {
  it('a swing draws nothing where its engine projectile is — only the blade arc at the target', () => {
    for (const [name, slot] of SWINGERS) {
      const def = hero(item(name, slot, { burn: { dps: 10, dur: 3 } }))
      const { ctx, ops } = recordingCtx()
      // The hero 100 px left of the shot's position; the target 20 px past it.
      drawShots(ctx, { sentinels: [rtHero(def, 400, 500)], projectiles: [shot(def.id, 500, 500, { burn: { dps: 10, dur: 3 } })] }, 1, false)
      expect(ops.length).toBeGreaterThan(0) // the arc was drawn…
      expect(drawnNear(ops, 500, 500, 6)).toBe(false) // …and no shot, no trail, at the projectile
    }
  })

  it('a ranged weapon does draw its shot there', () => {
    for (const [name, slot] of [['Bow', 'twoHand'], ['Wand', 'oneHand'], ['Dagger', 'oneHand']] as const) {
      const def = hero(item(name, slot))
      const { ctx, ops } = recordingCtx()
      drawShots(ctx, { sentinels: [rtHero(def, 400, 500)], projectiles: [shot(def.id, 500, 500)] }, 1, false)
      expect(drawnNear(ops, 500, 500, 14)).toBe(true)
    }
  })

  it('drawProjectile itself refuses a swing', () => {
    const { ctx, ops } = recordingCtx()
    drawProjectile(ctx, shot('x', 500, 500), { delivery: 'swing', now: 0, still: false })
    expect(ops.filter((o) => ['arc', 'moveTo', 'lineTo', 'fill', 'stroke'].includes(o.fn))).toEqual([])
  })

  it('swing geometry: alternating sides, a bounded span', () => {
    expect(swingSide('p1')).not.toBe(swingSide('p2'))
    expect(swingSpan(20)).toBeLessThanOrEqual(1.6)
    expect(swingSpan(96) * 96).toBeCloseTo(52)
  })
})
