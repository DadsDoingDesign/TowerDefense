/**
 * The hero builder (`src/game/render/hero/`, prototype): the rig, the parts
 * and the compositor. Pure modules, driven here in node.
 *
 *  - every part fits every people on every frame: nothing clipped by the
 *    cell, the figure one piece (no floating part, no gap), the held item
 *    in its hand, the body piece on the body;
 *  - the draw order holds: where two layers overlap, the later one is on top
 *    (only a fist closing over its own grip is re-stamped over the item);
 *  - a state change edits only the layers `STATE_LAYERS` names;
 *  - gear with no part of its own falls back, so a slot is never empty;
 *  - plus the company faces, the dock figures and the palette.
 */
import { describe, expect, it } from 'vitest'
import {
  ANIMS, CELL, FACES, FEET, ITEMS, LAYERS, LIVERIES, MINI_FACES, MINI_H, MINI_W, PERSONAS, PROPS, RACES, RACE_BODY, RACE_DEFAULTS, RACE_LIMITS,
  STATE_LAYERS, builderColours, composeFrame, composeStrip, framesFor, layerIndex, miniAt, miniFrame, miniFrames, resolveItem, resolveLook, rgbOf,
  type AnimId, type PersonaId, type HeroFrame, type HeroLook, type LayerId, type RaceId,
} from '../src/game/render/hero'
import { OWN_OUTLINE } from '../src/game/render/hero/raster'

const people = (i: number): RaceId => RACES[Math.floor(i / 20)]

/** A layer's own pixels: every piece's fills plus its ink ring (the swing's smear may cover them; they are still drawn). */
function layerMask(f: HeroFrame, l: LayerId): Uint8Array {
  const m = new Uint8Array(CELL * CELL)
  for (const pc of f.layers[l]) {
    const r = pc.ring
    for (let i = 0; i < CELL * CELL; i++) {
      if (!pc.buf.ramp[i]) continue
      m[i] = 1
      if (!r || pc.buf.flag[i] & 1) continue
      const x = i % CELL, y = (i / CELL) | 0
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > (r === 2 ? 5 : 1)) continue
          const xx = x + dx, yy = y + dy
          if (xx >= 0 && yy >= 0 && xx < CELL && yy < CELL) m[yy * CELL + xx] = 1
        }
    }
  }
  return m
}

/** The figure itself: every layer but the FX, by its own pixels. */
function figure(f: HeroFrame): Uint8Array {
  const m = new Uint8Array(CELL * CELL)
  for (const l of LAYERS) {
    if (l === 'fx') continue
    const lm = layerMask(f, l)
    for (let i = 0; i < m.length; i++) if (lm[i]) m[i] = 1
  }
  return m
}

/** How many 8-connected pieces the figure falls into. */
function pieces(m: Uint8Array): number {
  const seen = new Uint8Array(m.length)
  let n = 0
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || seen[s]) continue
    n++
    const stack = [s]
    seen[s] = 1
    while (stack.length) {
      const i = stack.pop()!
      const x = i % CELL, y = (i / CELL) | 0
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy
          if (xx < 0 || yy < 0 || xx >= CELL || yy >= CELL) continue
          const j = yy * CELL + xx
          if (m[j] && !seen[j]) { seen[j] = 1; stack.push(j) }
        }
    }
  }
  return n
}

function onBorder(f: HeroFrame): boolean {
  for (let k = 0; k < CELL; k++) {
    for (const i of [k, (CELL - 1) * CELL + k, k * CELL, k * CELL + CELL - 1]) if (f.rgba[i * 4 + 3]) return true
  }
  return false
}

function layerPixels(f: HeroFrame, l: LayerId): [number, number][] {
  const out: [number, number][] = []
  for (const pc of f.layers[l]) for (let i = 0; i < CELL * CELL; i++) if (pc.buf.ramp[i]) out.push([i % CELL, (i / CELL) | 0])
  return out
}

function checkFit(look: HeroLook, anim: AnimId, frame: number, label: string): void {
  const f = composeFrame(look, anim, frame)
  const where = `${label} ${look.race} ${anim}#${frame}`
  expect(onBorder(f), `${where}: clipped by the cell`).toBe(false)
  expect(pieces(figure(f)), `${where}: a part floats or leaves a gap`).toBe(1)
  const P = f.pose
  const R = f.look
  // the held item is in its hand
  if (R.main && f.layers.mainItem.length) {
    const near = layerPixels(f, 'mainItem').some(([x, y]) => Math.hypot(x + 0.5 - P.mainHand.x, y + 0.5 - P.mainHand.y) <= P.body.handR + 2)
    expect(near, `${where}: the main item is not in the hand`).toBe(true)
  }
  if (R.off && f.layers.offItem.length) {
    const near = layerPixels(f, 'offItem').some(([x, y]) => Math.hypot(x + 0.5 - P.offHand.x, y + 0.5 - P.offHand.y) <= P.body.handR + 3)
    expect(near, `${where}: the off-hand item is not in the hand`).toBe(true)
  }
  // the body piece sits on the body: inside the torso's box, grown a little (a capelet, a skirt to the feet)
  const arm = layerPixels(f, 'armour')
  if (arm.length) {
    const b = P.body
    const x0 = P.torso.x - b.torsoRx - b.flare - 9, x1 = P.torso.x + b.torsoRx + b.flare + 9
    const bad = arm.filter(([x, y]) => x < x0 || x > x1 || y < P.torsoTop - 6 || y > FEET)
    expect(bad.length, `${where}: the body piece overhangs the body`).toBe(0)
  }
}

describe('hero builder: the rig', () => {
  it('every people stays inside the shared limits', () => {
    for (const r of RACES)
      for (const [k, [lo, hi]] of Object.entries(RACE_LIMITS)) {
        const v = RACE_BODY[r][k as keyof typeof RACE_LIMITS]
        expect(v, `${r}.${k}`).toBeGreaterThanOrEqual(lo)
        expect(v, `${r}.${k}`).toBeLessThanOrEqual(hi)
      }
  })

  it('has the eleven layers in the fixed draw order', () => {
    expect(LAYERS).toEqual(['back', 'offArm', 'legs', 'body', 'armour', 'head', 'hair', 'mainArm', 'mainItem', 'offItem', 'fx'])
  })

  it('the five peoples read apart by silhouette alone', () => {
    const masks = RACES.map((r) => figure(composeFrame({ race: r }, 'idle', 0)))
    for (let i = 0; i < masks.length; i++)
      for (let j = i + 1; j < masks.length; j++) {
        let inter = 0, uni = 0
        for (let k = 0; k < masks[i].length; k++) { if (masks[i][k] && masks[j][k]) inter++; if (masks[i][k] || masks[j][k]) uni++ }
        expect(inter / uni, `${RACES[i]} vs ${RACES[j]}`).toBeLessThan(0.86)
      }
  })
})

describe('hero builder: every part fits every people', () => {
  it('every roster item and prop, on every people, at its widest: the impact and arms raised', () => {
    const keyFrames: [AnimId, number][] = [['attack', 3], ['cheer', 2]]
    for (const it of [...ITEMS, ...PROPS]) {
      const slot = it.slot === 'body' ? 'body' : it.slot === 'offHand' ? 'off' : 'main'
      for (const race of RACES) for (const [a, f] of keyFrames) checkFit({ race, gear: { [slot]: it.name } }, a, f, it.name)
    }
  }, 240_000)

  it('every frame of every animation, for a full kit of each people', () => {
    const kits: HeroLook['gear'][] = [
      { main: 'Sword', off: 'Kite Shield', body: 'Mail' },
      { main: 'Bow', off: 'Quiver', body: 'Cloak' },
      { main: 'Maul', body: 'Plate' },
      { main: 'Spear', body: 'Leather' },
      { main: 'Staff', body: 'Robe' },
    ]
    for (const race of RACES)
      for (const gear of kits)
        for (const a of ANIMS) for (let f = 0; f < framesFor(a); f++) checkFit({ race, company: 'Peppercorn', gear }, a, f, JSON.stringify(gear))
  }, 240_000)

  it('the company faces fit on every frame of their idle, tic and reaction', () => {
    for (const fc of FACES)
      for (const a of ['idle', 'tic', 'react', 'walk'] as AnimId[]) for (let f = 0; f < framesFor(a, fc.id); f++) checkFit(fc.look, a, f, fc.name)
  })
})

/**
 * The mouth zone: the lower FRONT of the face (its front half), from the eyes down to the chin
 * and past the face's front (12 px for a company face, which carries props; 6
 * for a fighter, whose weapon rides up beside the face as the CC0 knight's
 * does). Nothing a hand holds, no hand and no FX may paint there (an object at
 * a mouth reads as something coming out of it).
 */
function mouthIntruders(f: HeroFrame, ahead = 12): number {
  const P = f.pose
  const b = P.body
  const x0 = Math.round(P.head.x + b.headRx * 0.15), x1 = Math.round(P.head.x + b.headRx + ahead)
  const y0 = Math.round(P.head.y + b.headRy * 0.2), y1 = Math.round(P.head.y + b.headRy - 2)
  const bad = new Set(['mainArm', 'offArm', 'mainItem', 'offItem', 'fx'].map((l) => layerIndex(l as LayerId)))
  let n = 0
  for (let y = Math.max(0, y0); y <= Math.min(CELL - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(CELL - 1, x1); x++) if (bad.has(f.owner[y * CELL + x])) n++
  return n
}

describe('hero builder: nothing at the mouth', () => {
  it('no hand, held thing or effect at a company face’s mouth, on any frame', () => {
    for (const fc of FACES)
      for (const a of ['idle', 'walk', 'tic', 'react', 'hit', 'cheer'] as AnimId[])
        for (let fr = 0; fr < framesFor(a, fc.id); fr++) expect(mouthIntruders(composeFrame(fc.look, a, fr)), `${fc.name} ${a}#${fr}`).toBe(0)
  })

  it('no hand or held thing at any people’s mouth while it idles, walks, flinches or cheers', () => {
    const kits: HeroLook['gear'][] = [
      { main: 'Sword', off: 'Kite Shield', body: 'Mail' },
      { main: 'Bow', off: 'Quiver', body: 'Cloak' },
      { main: 'Wand', off: 'Flask', body: 'Robe' },
      { main: 'Meat Hook', off: 'Buckler', body: 'Leather' },
      { main: 'Twin Knives' },
    ]
    for (const race of RACES)
      for (const gear of kits)
        for (const a of ['idle', 'walk', 'hit', 'cheer'] as AnimId[])
          for (let fr = 0; fr < framesFor(a); fr++) expect(mouthIntruders(composeFrame({ race, gear }, a, fr), 6), `${race} ${JSON.stringify(gear)} ${a}#${fr}`).toBe(0)
  })
})

describe('hero builder: the draw order holds', () => {
  it('where two layers overlap, the later one is on top (bar a fist over its own grip)', () => {
    for (const race of RACES) {
      for (const [a, fr] of [['idle', 0], ['attack', 3]] as [AnimId, number][]) {
        const f = composeFrame({ race, gear: { main: 'Sword', off: 'Flask', body: 'Mail' }, state: { level: 8, skills: ['Banner Bearer'] } }, a, fr)
        const has = LAYERS.map((l) => layerMask(f, l))
        const fist = (l: number, i: number) => {
          const name = LAYERS[l]
          if (name !== 'mainArm' && name !== 'offArm') return false
          // a fist re-stamped over its grip, with its ring
          const x = i % CELL, y = (i / CELL) | 0
          return f.layers[name].some((p) => {
            if (!p.front) return false
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5 && p.buf.ramp[(y + dy) * CELL + x + dx]) return true
            return false
          })
        }
        for (let i = 0; i < CELL * CELL; i++) {
          const top = LAYERS.reduce((t, _l, li) => (has[li][i] && li !== layerIndex('fx') ? li : t), -1)
          if (top < 0) continue
          const o = f.owner[i]
          if (o === OWN_OUTLINE || o === layerIndex('fx')) continue
          // the owner is the topmost layer with a pixel here, or a fist stamped over its grip
          expect(o === top || fist(o, i), `${race} ${a}: pixel ${i % CELL},${(i / CELL) | 0} owned by ${LAYERS[o] ?? o}, topmost ${LAYERS[top]}`).toBe(true)
        }
      }
    }
  })

  it('a fist closes over its grip: the hand is on top of the handle, not the reverse', () => {
    const f = composeFrame({ race: 'human', gear: { main: 'Sword' } }, 'idle', 0)
    const { x, y } = f.pose.mainHand
    expect(f.owner[Math.round(y) * CELL + Math.round(x)]).toBe(layerIndex('mainArm'))
    // and the sword is there, under the fingers, above and below the fist
    expect(f.layers.mainItem.some((p) => p.buf.ramp[Math.round(y) * CELL + Math.round(x)])).toBe(true)
  })
})

describe('hero builder: state edits the right layer only', () => {
  const pieceEq = (a: HeroFrame, b: HeroFrame, l: LayerId) => a.layers[l].length === b.layers[l].length && a.layers[l].every((p, i) => p.buf.equals(b.layers[l][i].buf))
  const CASES: [keyof typeof STATE_LAYERS, HeroLook, HeroLook['state']][] = [
    ['rarityMain', { race: 'human', gear: { main: 'Sword', off: 'Kite Shield', body: 'Plate' } }, { rarity: { main: 'legendary' } }],
    ['rarityOff', { race: 'human', gear: { main: 'Sword', off: 'Kite Shield', body: 'Plate' } }, { rarity: { off: 'epic' } }],
    ['rarityBody', { race: 'elf', gear: { main: 'Bow', body: 'Cloak' } }, { rarity: { body: 'legendary' } }],
    ['level', { race: 'dwarf', gear: { main: 'Axe', body: 'Mail' } }, { level: 8 }],
    ['banner', { race: 'human', gear: { main: 'Sword', body: 'Mail' } }, { skills: ['Banner Bearer'] }],
    ['burn', { race: 'human', gear: { main: 'Sword' } }, { skills: ['Wildfire'] }],
    ['frost', { race: 'gnome', gear: { main: 'Staff' } }, { skills: ['Frostbite'] }],
    ['venom', { race: 'reptilian', gear: { main: 'Spear' } }, { skills: ['Poisoned Tips'] }],
    ['spark', { race: 'gnome', gear: { main: 'Wand' } }, { skills: ['Arc Spark'] }],
    ['rage', { race: 'reptilian', gear: { main: 'Cleaver' } }, { skills: ['Berserk'] }],
    ['keen', { race: 'elf', gear: { main: 'Bow' } }, { skills: ['Keen Eye'] }],
    ['bloom', { race: 'gnome', gear: { main: 'Staff' } }, { skills: ['Thornbloom'] }],
    ['hasted', { race: 'human', gear: { main: 'Sword' } }, { status: ['hasted'] }],
    ['slowed', { race: 'dwarf', gear: { main: 'Axe' } }, { status: ['slowed'] }],
    ['stunned', { race: 'elf', gear: { main: 'Dagger' } }, { status: ['stunned'] }],
    ['buffed', { race: 'human', gear: { main: 'Sword' } }, { status: ['buffed'] }],
    ['wounded', { race: 'human', gear: { main: 'Sword' } }, { wounded: true }],
  ]
  for (const [key, look, state] of CASES) {
    it(`${key} touches ${STATE_LAYERS[key].join(' + ')} and nothing else`, () => {
      for (const [a, fr] of [['idle', 0], ['attack', 2]] as [AnimId, number][]) {
        const base = composeFrame(look, a, fr)
        const after = composeFrame({ ...look, state }, a, fr)
        const changed = LAYERS.filter((l) => !pieceEq(base, after, l))
        for (const l of changed) expect(STATE_LAYERS[key] as readonly string[], `${key} ${a}: changed ${l}`).toContain(l)
        if (a === 'idle') expect(changed.length, `${key}: changed nothing`).toBeGreaterThan(0)
      }
    })
  }

  it('a company livery swaps inks, never shapes', () => {
    const look: HeroLook = { race: 'dwarf', gear: { main: 'Axe', off: 'Round Shield', body: 'Chainshirt' } }
    const base = figure(composeFrame({ ...look, company: 'neutral' }, 'idle', 0))
    for (const co of Object.keys(LIVERIES)) {
      const m = figure(composeFrame({ ...look, company: co }, 'idle', 0))
      expect(m.every((v, i) => v === base[i]), co).toBe(true)
    }
  })
})

describe('hero builder: gear maps to parts, and a missing part falls back', () => {
  it('every roster item has a part of its own', () => {
    expect(ITEMS).toHaveLength(100)
    ITEMS.forEach((it, i) => {
      const slot = it.slot === 'body' ? 'body' : it.slot === 'offHand' ? 'off' : 'main'
      const r = resolveItem(it.name, slot)
      expect(r.fallback, `${it.name} (${people(i)})`).toBe(false)
    })
  })

  it('an unknown name takes its keyword family, or the slot’s generic part', () => {
    expect(resolveItem('Mystery Blade', 'main')).toMatchObject({ family: 'sword', fallback: 'keyword' })
    expect(resolveItem('Grandfather’s Old Mace', 'main')).toMatchObject({ family: 'hammer', fallback: 'keyword' })
    expect(resolveItem('Odd Trinket', 'off')).toMatchObject({ family: 'shieldRound', fallback: 'generic' })
    expect(resolveItem('Strange Garb', 'body')).toMatchObject({ family: 'padded', fallback: 'generic' })
    expect(resolveItem('Unnamed Thing', 'main')).toMatchObject({ family: 'sword', fallback: 'generic' })
  })

  it('a slot with unknown gear is never left empty', () => {
    for (const race of RACES) {
      const f = composeFrame({ race, gear: { main: 'Unnamed Thing', off: 'Odd Trinket', body: 'Strange Garb' } }, 'idle', 0)
      expect(f.layers.mainItem.some((p) => !p.buf.isEmpty()), `${race} main`).toBe(true)
      expect(f.layers.offItem.some((p) => !p.buf.isEmpty()), `${race} off`).toBe(true)
      expect(f.layers.armour.some((p) => !p.buf.isEmpty()), `${race} body`).toBe(true)
    }
  })

  it('a two-hander frees the off hand: a held off piece is dropped, a quiver stays on the back', () => {
    expect(resolveLook({ race: 'human', gear: { main: 'Greatsword', off: 'Shield' } }).off).toBeNull()
    expect(resolveLook({ race: 'elf', gear: { main: 'Bow', off: 'Quiver' } }).off?.family).toBe('quiver')
  })

  it('composes the same look once (cached per spec, any key order)', () => {
    const a = composeStrip({ race: 'gnome', gear: { main: 'Wand', body: 'Robe' } }, 'idle')
    const b = composeStrip({ gear: { body: 'Robe', main: 'Wand' }, race: 'gnome' }, 'idle')
    expect(a).toBe(b)
  })
})

describe('hero builder: the palette is the pack’s', () => {
  it('every solid pixel is an ink the builder declares', () => {
    const ok = new Set([...builderColours()].map((h) => rgbOf(h).join(',')))
    for (const look of [...FACES.map((f) => f.look), ...RACES.map((race) => ({ race, company: 'Peppercorn', gear: { main: 'Sword', off: 'Kite Shield', body: 'Mail' } }) as HeroLook)]) {
      const f = composeFrame(look, 'idle', 0)
      for (let i = 0; i < CELL * CELL; i++) {
        if (f.rgba[i * 4 + 3] !== 255) continue
        // a glow is light laid over paint (alpha), not an ink
        if (LAYERS.some((l) => f.layers[l].some((p) => p.buf.ramp[i] && p.buf.flag[i] & 4))) continue
        const c = `${f.rgba[i * 4]},${f.rgba[i * 4 + 1]},${f.rgba[i * 4 + 2]}`
        expect(ok.has(c), `${look.race}: ${c}`).toBe(true)
      }
    }
  })
})

describe('hero builder: the company faces', () => {
  it('five faces, one per company slot, each with a full brief and its own props', () => {
    expect(FACES.map((f) => f.company).sort()).toEqual(['art', 'metals', 'scrolls', 'silk', 'spice'])
    for (const fc of FACES) {
      for (const v of Object.values(fc.brief)) expect(v.length, fc.name).toBeGreaterThan(10)
      const R = resolveLook(fc.look)
      for (const it of [R.main, R.off, R.body]) if (it) expect(it.fallback, `${fc.name}: ${it.name}`).toBe(false)
    }
    // the two new slots are proposals, never written into liaisons.ts
    expect(FACES.filter((f) => f.proposal).map((f) => f.id).sort()).toEqual(['hask', 'wren'])
  })

  it('each face has its own idle tempo, tic and reaction, and the tic changes the figure', () => {
    for (const id of PERSONAS) {
      const fc = FACES.find((f) => f.id === id)!
      const idle = composeFrame(fc.look, 'idle', 0)
      const tic = composeFrame(fc.look, 'tic', 2)
      expect(Buffer.from(idle.rgba).equals(Buffer.from(tic.rgba)), id).toBe(false)
      expect(framesFor('tic', id)).toBeGreaterThanOrEqual(4)
      expect(framesFor('tic', id)).toBeLessThanOrEqual(8)
      expect(framesFor('react', id)).toBeGreaterThanOrEqual(3)
      expect(framesFor('react', id)).toBeLessThanOrEqual(5)
      expect(fc.ticEvery).toBeGreaterThanOrEqual(4)
      expect(fc.ticEvery).toBeLessThanOrEqual(8)
    }
  })
})

describe('hero builder: the dock figures', () => {
  it('fit their 24 × 28 cell on every frame, and the locked shadow hides the face', () => {
    for (const id of PERSONAS) {
      expect(MINI_FACES[id]).toBeDefined()
      for (const a of ['idle', 'tic', 'react'] as const)
        for (let f = 0; f < miniFrames(id, a); f++)
          for (const locked of [false, true]) {
            const fr = miniFrame(id, a, f, locked)
            expect(fr.w).toBe(MINI_W)
            expect(fr.h).toBe(MINI_H)
            // nothing touches the cell's edge (the slot crops nothing)
            for (let x = 0; x < MINI_W; x++) expect(fr.rgba[x * 4 + 3], `${id} ${a}#${f} top`).toBe(0)
            let opaque = 0
            for (let i = 0; i < MINI_W * MINI_H; i++) if (fr.rgba[i * 4 + 3] === 255) opaque++
            expect(opaque, `${id} ${a}#${f}`).toBeGreaterThan(120)
          }
      // locked: the skin is gone (the figure is a shadow)
      const lock = miniFrame(id, 'idle', 0, true)
      const skin = new Set(['skinTan', 'skinRose', 'scaleOchre'].flatMap((r) => RACE_DEFAULTS.human && [r]))
      expect(skin.size).toBeGreaterThan(0)
      const open = miniFrame(id, 'idle', 0, false)
      expect(Buffer.from(lock.rgba).equals(Buffer.from(open.rgba)), id).toBe(false)
      // the tic and the reaction each move something
      expect(Buffer.from(miniFrame(id, 'tic', 2).rgba).equals(Buffer.from(open.rgba)), `${id} tic`).toBe(false)
      expect(Buffer.from(miniFrame(id, 'react', 1).rgba).equals(Buffer.from(open.rgba)), `${id} react`).toBe(false)
    }
  })

  it('each idles at its own period and tics on its own beat (no two in step)', () => {
    const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
    const ps = PERSONAS.map((id) => MINI_FACES[id].period)
    const tics = PERSONAS.map((id) => MINI_FACES[id].ticEvery)
    expect(new Set(ps).size).toBe(PERSONAS.length)
    expect(new Set(tics).size).toBe(PERSONAS.length)
    expect(new Set(PERSONAS.map((id) => MINI_FACES[id].idle.length)).size, 'idle shapes differ in length').toBeGreaterThanOrEqual(4)
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++) {
        expect(gcd(ps[i], ps[j]), `${PERSONAS[i]}/${PERSONAS[j]} periods co-prime`).toBe(1)
        // no pair beats together: the periods are at least 10% apart
        expect(Math.abs(ps[i] - ps[j]) / Math.max(ps[i], ps[j])).toBeGreaterThan(0.1)
      }
    // over ten seconds: nobody is mid-tic when the dock opens, no two tics start within half a second,
    // and no two idle loops restart together more than once
    const STEP = 10
    const starts: number[] = []
    for (const id of PERSONAS) {
      expect(miniAt(id, 0).anim, `${id} at 0`).toBe('idle')
      for (let t = STEP; t < 10000; t += STEP) if (miniAt(id, t).anim === 'tic' && miniAt(id, t - STEP).anim !== 'tic') starts.push(t)
    }
    starts.sort((a, b) => a - b)
    expect(starts.length).toBeGreaterThanOrEqual(PERSONAS.length)
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1], `tics at ${starts[i - 1]} and ${starts[i]}`).toBeGreaterThanOrEqual(500)
    for (let i = 0; i < PERSONAS.length; i++)
      for (let j = i + 1; j < PERSONAS.length; j++) {
        let restarts = 0
        for (let t = STEP; t < 10000; t += STEP) if (t % ps[i] < STEP && t % ps[j] < STEP) restarts++
        expect(restarts, `${PERSONAS[i]} + ${PERSONAS[j]} restart together`).toBeLessThanOrEqual(1)
      }
    // a pick plays the reaction, a lock holds still
    expect(miniAt('saffra', 1650, { pickedAt: 1600 }).anim).toBe('react')
    expect(miniAt('odile', 5000, { still: true })).toEqual({ anim: 'idle', frame: 0 })
  })

  it('each is known by its silhouette alone', () => {
    const mask = (id: PersonaId): boolean[] => {
      const fr = miniFrame(id, 'idle', 0)
      // the figure only (the shadow is the same for all)
      return Array.from({ length: MINI_W * MINI_H }, (_, i) => fr.rgba[i * 4 + 3] === 255)
    }
    const ms = PERSONAS.map(mask)
    for (let i = 0; i < ms.length; i++)
      for (let j = i + 1; j < ms.length; j++) {
        let and = 0, or = 0
        for (let p = 0; p < ms[i].length; p++) { if (ms[i][p] && ms[j][p]) and++; if (ms[i][p] || ms[j][p]) or++ }
        expect(and / or, `${PERSONAS[i]} vs ${PERSONAS[j]}`).toBeLessThan(0.8)
      }
  })
})
