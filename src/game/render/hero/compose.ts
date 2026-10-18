/**
 * The compositor: `HeroLook` (data) → frames (pixels). Pure, and cached per
 * (look, animation): the same look asked twice is two map lookups.
 *
 *   resolveLook(look)  → which part fills each slot, the inks, the state
 *   poseFor(…)         → the anchors this frame (`rig.ts`)
 *   each layer, in LAYERS order, draws its pieces (`parts.ts`)
 *   composite          → shadow · back … offItem (each piece ringed in ink) ·
 *                        the fists that close over a grip · the outer line · fx
 *
 * Nothing in the shipped game imports this yet (see `docs/characters/`).
 */
import { RAMPS, isRampId, type RampId } from './palette'
import {
  CELL, CX, FEET, LayerBuf, OWN_SHADOW, Pen, newComposite, outerLine, shadow, stamp,
  type Composite, type MatResolver,
} from './raster'
import { ANIMS, FRAME_COUNT, poseFor, type AnimId, type Pose, type RaceId } from './rig'
import {
  LAYERS, LIVERIES, capeTier, gripOf, layerIndex, lookKey, motionOf, resolveItem, takesBothHands, tellsOf,
  type HeroLook, type ItemPart, type LayerId, type Rarity, type Status,
} from './look'
import { LAYER_PARTS, type DrawCtx, type Marks, type PieceOpts, type Resolved } from './parts'

// ── the peoples' defaults and variants ─────────────────────────────────────

export interface RaceDefaults {
  skin: RampId
  hair: RampId
  /** Head (race face) variants; the first is the default. */
  heads: readonly string[]
  /** Hair / headgear variants; the first is the default. */
  hairs: readonly string[]
  /** Other skins and hair inks a hire of this people may come in. */
  skins: readonly RampId[]
  hairInks: readonly RampId[]
}

export const RACE_DEFAULTS: Readonly<Record<RaceId, RaceDefaults>> = {
  human: { skin: 'skinTan', hair: 'hairBrown', heads: ['plain', 'stubble'], hairs: ['crop', 'tail'], skins: ['skinTan', 'skinUmber', 'skinRose'], hairInks: ['hairBrown', 'hairBlack', 'hairGinger', 'hairBlond'] },
  elf: { skin: 'skinRose', hair: 'hairBlond', heads: ['long', 'swept'], hairs: ['long', 'topknot'], skins: ['skinRose', 'skinPale', 'skinUmber'], hairInks: ['hairBlond', 'hairSilver', 'hairBlack'] },
  dwarf: { skin: 'skinTan', hair: 'hairBrown', heads: ['full', 'forked'], hairs: ['crop', 'bald'], skins: ['skinTan', 'skinRuddy', 'skinUmber'], hairInks: ['hairBrown', 'hairGinger', 'hairWhite', 'hairBlack'] },
  reptilian: { skin: 'scaleTeal', hair: 'red', heads: ['snout', 'frill'], hairs: ['crest', 'spines'], skins: ['scaleTeal', 'scaleOchre', 'moss'], hairInks: ['red', 'gold', 'plum'] },
  gnome: { skin: 'skinRose', hair: 'hairWhite', heads: ['round', 'long'], hairs: ['tufts', 'cap'], skins: ['skinRose', 'skinTan', 'skinUmber'], hairInks: ['hairWhite', 'hairGinger', 'hairSilver'] },
}

export interface ResolvedLook extends Resolved {
  motion: ReturnType<typeof motionOf>
  grip: ReturnType<typeof gripOf>
}

/** Which part fills each slot, which inks, which state. */
export function resolveLook(look: HeroLook): ResolvedLook {
  const d = RACE_DEFAULTS[look.race]
  const liv = LIVERIES[look.company ?? 'neutral'] ?? LIVERIES.neutral
  const pal = look.palette ?? {}
  const skin = look.skin ?? d.skin
  const hairInk = look.hairInk ?? d.hair
  const mats: MatResolver = (m) => {
    if (isRampId(m)) return m
    switch (m) {
      case 'skin': return skin
      case 'hair': return hairInk
      case 'cloth': return pal.cloth ?? liv.cloth
      case 'trim': return pal.trim ?? liv.trim
      case 'metal': return pal.metal ?? 'steel'
      case 'leather': case 'boots': return pal.leather ?? 'leather'
      case 'pants': return pal.pants ?? 'navy'
      default: return 'cream'
    }
  }
  const g = look.gear ?? {}
  let main: ItemPart | null = g.main ? resolveItem(g.main, 'main') : null
  let off: ItemPart | null = g.off ? resolveItem(g.off, 'off') : null
  const body: ItemPart | null = g.body ? resolveItem(g.body, 'body') : null
  // an off-hand dagger is an off dagger; a two-hander leaves no hand for a held off piece (a quiver rides the back)
  if (off && off.family === 'dagger') off = { ...off, family: 'offDagger' }
  if (main && takesBothHands(main) && off && off.family !== 'quiver' && off.family !== 'javelins') off = null
  if (main?.p?.variant === 'twin' && !off) off = { ...main, family: 'offDagger' }
  const st = look.state ?? {}
  const rarity: Record<'main' | 'off' | 'body', Rarity> = { main: st.rarity?.main ?? 'common', off: st.rarity?.off ?? 'common', body: st.rarity?.body ?? 'common' }
  return {
    race: look.race,
    head: look.head && d.heads.includes(look.head) ? look.head : d.heads[0],
    hair: look.hair && d.hairs.includes(look.hair) ? look.hair : d.hairs[0],
    mats,
    main,
    off,
    body,
    rarity,
    tier: capeTier(st.level),
    tells: tellsOf(st),
    status: new Set<Status>(st.status ?? []),
    wounded: !!st.wounded,
    motion: motionOf(main),
    grip: gripOf(main, off),
  }
}

// ── one frame ──────────────────────────────────────────────────────────────

export interface Piece {
  buf: LayerBuf
  ring: 0 | 1 | 2
  front: boolean
}

export interface HeroFrame {
  w: number
  h: number
  rgba: Uint8ClampedArray
  /** Per pixel: the layer index on top (or `OWN_*`). */
  owner: Int8Array
  /** Each layer's pieces, as drawn (before compositing). */
  layers: Readonly<Record<LayerId, readonly Piece[]>>
  pose: Pose
  look: ResolvedLook
}

/** Compose one frame of one animation. */
export function composeFrame(look: HeroLook, anim: AnimId, frame: number): HeroFrame {
  const R = resolveLook(look)
  return composeResolved(R, anim, frame)
}

function composeResolved(R: ResolvedLook, anim: AnimId, frame: number): HeroFrame {
  const P = poseFor(R.race, anim, frame, R.motion, R.grip)
  const marks: Marks = {}
  const layers = {} as Record<LayerId, Piece[]>
  const out: Composite = newComposite()

  const ctxFor = (layer: LayerId, silhouette?: Uint8Array): DrawCtx => {
    const pieces: Piece[] = (layers[layer] = [])
    return {
      P,
      R,
      marks,
      silhouette,
      piece(o: PieceOpts = {}): Pen {
        const buf = new LayerBuf()
        pieces.push({ buf, ring: o.ring ?? 2, front: !!o.front })
        return new Pen(buf, o.mats ?? R.mats)
      },
    }
  }

  // the ground shadow (stays on the ground through a jump)
  shadow(out, CX, FEET - 1, 12 + P.body.stance + P.body.torsoRx * 0.25 - P.lift * 0.5, 4.2)

  const front: Record<'mainArm' | 'offArm', Piece[]> = { mainArm: [], offArm: [] }
  for (const layer of LAYERS) {
    if (layer === 'fx') continue
    const c = ctxFor(layer)
    for (const part of LAYER_PARTS[layer]) part(c)
    const li = layerIndex(layer)
    for (const pc of layers[layer]) stamp(out, pc.buf, li, undefined, pc.ring)
    if (layer === 'mainArm' || layer === 'offArm') front[layer] = layers[layer].filter((p) => p.front)
    // a fist closes over what it holds: re-stamped over the item
    if (layer === 'mainItem') for (const pc of front.mainArm) stamp(out, pc.buf, layerIndex('mainArm'), undefined, pc.ring)
    if (layer === 'offItem') for (const pc of front.offArm) stamp(out, pc.buf, layerIndex('offArm'), undefined, pc.ring)
  }
  outerLine(out)

  const sil = new Uint8Array(CELL * CELL)
  for (let i = 0; i < CELL * CELL; i++) sil[i] = out.rgba[i * 4 + 3] === 255 && out.owner[i] !== OWN_SHADOW ? 1 : 0
  const fc = ctxFor('fx', sil)
  for (const part of LAYER_PARTS.fx) part(fc)
  const fi = layerIndex('fx')
  for (const pc of layers.fx) stamp(out, pc.buf, fi, undefined, pc.ring)

  return { w: CELL, h: CELL, rgba: out.rgba, owner: out.owner, layers, pose: P, look: R }
}

// ── strips, cached per spec ────────────────────────────────────────────────

const CACHE = new Map<string, HeroFrame[]>()
const CACHE_MAX = 400

/** Every frame of one animation for a look, cached by the look's key. */
export function composeStrip(look: HeroLook, anim: AnimId): HeroFrame[] {
  const key = `${lookKey(look)}|${anim}`
  const hit = CACHE.get(key)
  if (hit) return hit
  const R = resolveLook(look)
  const frames = Array.from({ length: FRAME_COUNT[anim] }, (_, f) => composeResolved(R, anim, f))
  if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value!)
  CACHE.set(key, frames)
  return frames
}

export const clearHeroCache = (): void => CACHE.clear()
export const heroCacheSize = (): number => CACHE.size

export { ANIMS, FRAME_COUNT, RAMPS }
