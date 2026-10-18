/**
 * A hero's portrait, cut from its battlefield figure.
 *
 * Every hero portrait in the shell — the party bar's tokens, the hero card,
 * the Upgrade button, the Pack strip, the hero pick and a city's hire, the
 * campfire's rows — used to be the look's painted still (`fighter.png`: the
 * knight's bust with its sword AND its shield, whatever the hero held). The
 * designer: a hero's look must "always reflect what they have equipped, not
 * set classes".
 *
 * So the portrait is not drawn here at all: it is the field's own figure
 * (`units.heroFigure` — the cuts, the body piece, the bake and its ring —
 * plus `units.drawHeldGear`, the weapon and off-hand marks), idle frame 0,
 * held still, cropped to a bust (the head down to just under the tunic, with
 * whatever the fists hold) and squared. One composition, two consumers, so a
 * portrait can never drift from the figure.
 *
 * Cached per (pack, look, kit) as a PNG data URL, so an `<img>` keeps every
 * box, `object-fit` and `image-rendering` rule it had. A kit change is a new
 * key (the store replaces `equipment` on every equip), so equipping from the
 * Pack changes the portrait on the next render. Until the strips and the icon
 * atlas have decoded it returns null and the caller shows the painted still;
 * {@link onPortraitChange} says when to ask again.
 */
import { lookOf } from '../data/gear'
import type { Archetype, Sentinel } from '../types'
import { torsosFor } from './bodyLayer'
import { blitPixmap } from './blit'
import { gearAtlasReady, heroGearCached, type HeroGear } from './gearMarks'
import { artFor, onSpritesReady } from './sprites'
import { onThemeChange } from './themes'
import { drawHeldGear, heroFigure } from './units'

/** The scratch the figure is composed on: wide enough for a held greatsword. */
const BOX = { w: 200, h: 176, ox: 100, oy: 150 }
/** Rows of the body piece kept under the tunic's hem (a skirt's top, a tasset). */
const UNDER_HEM = 6
const CACHE_MAX = 48

const urls = new Map<string, string>()
let version = 0
const listeners = new Set<() => void>()
let waiting = false
let askedSprites = false

function bump(): void {
  waiting = false
  version++
  for (const l of [...listeners]) l()
}

onThemeChange(() => {
  urls.clear()
  bump()
})

/** Moves whenever a portrait asked for earlier may now be drawn, or drawn differently. */
export const portraitVersion = (): number => version
/** Subscribe to {@link portraitVersion} (`useSyncExternalStore`). */
export function onPortraitChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

const kitKey = (pack: string, look: Archetype, g: HeroGear) => `${pack}|${look}|${g.main ?? '-'}|${g.off ?? '-'}|${g.body ?? '-'}|${g.glint ?? '-'}`

/**
 * The bust of a hero of `look` in `gear`, on a fresh square canvas at the
 * field's density, or null while its art is still loading.
 */
export function heroPortraitCanvas(look: Archetype, gear: HeroGear): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const art = artFor(look)
  if (!art) return null
  const fig = heroFigure(art.pack, art.spriteScale, look, gear, false)
  const marks = (gear.main && gear.main !== fig?.rig.paintedMain) || (gear.off && gear.off !== fig?.rig.paintedOff)
  if (!fig || (marks && !gearAtlasReady(wake))) {
    if (!fig && !askedSprites) {
      askedSprites = true
      onSpritesReady(() => {
        askedSprites = false
        wake()
      })
    }
    return null
  }
  const c = document.createElement('canvas')
  c.width = BOX.w
  c.height = BOX.h
  const g = c.getContext('2d', { willReadFrequently: true })
  if (!g) return null
  g.imageSmoothingEnabled = false
  g.translate(BOX.ox, BOX.oy)
  blitPixmap(g, fig.pm, 0, 0, 8)
  drawHeldGear(g, fig.rig, gear, 0, 0, 0, true, false, fig.grips?.[0])
  g.setTransform(1, 0, 0, 1, 0, 0)

  // The bust: from the top of whatever is drawn down to just under the tunic.
  const top = BOX.oy + 8 - fig.pm.fh
  const torso = torsosFor(art.pack, `${look}_idle`)?.[0]
  const bottom = Math.min(BOX.h - 1, top + (torso ? torso.y1 + UNDER_HEM : Math.round(fig.pm.fh * 0.8)))
  const px = g.getImageData(0, 0, BOX.w, bottom + 1).data
  let x0 = BOX.w
  let x1 = -1
  let y0 = bottom
  for (let y = 0; y <= bottom; y++)
    for (let x = 0; x < BOX.w; x++)
      if (px[(y * BOX.w + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
      }
  if (x1 < 0) return null
  const w = x1 - x0 + 1
  const h = bottom - y0 + 1
  const side = Math.max(w, h) + 2
  const out = document.createElement('canvas')
  out.width = side
  out.height = side
  const o = out.getContext('2d')
  if (!o) return null
  o.imageSmoothingEnabled = false
  // Centred across, standing on the frame's foot (the bust's cut is its bottom edge).
  o.drawImage(c, x0, y0, w, h, Math.floor((side - w) / 2), side - h, w, h)
  return out
}

function wake(): void {
  if (waiting) return
  waiting = true
  // After the image's own load handlers (the sprite generation) have run.
  setTimeout(bump, 0)
}

/**
 * The portrait of this hero in what it wears now, as a data URL, or null while
 * the art loads (show the look's still, and re-ask on {@link onPortraitChange}).
 */
export function heroPortraitUrl(hero: Pick<Sentinel, 'equipment'>): string | null {
  const look = lookOf(hero)
  const art = typeof document === 'undefined' ? undefined : artFor(look)
  if (!art) return null
  const gear = heroGearCached(hero)
  const key = kitKey(art.pack, look, gear)
  const hit = urls.get(key)
  if (hit) {
    urls.delete(key)
    urls.set(key, hit)
    return hit
  }
  const c = heroPortraitCanvas(look, gear)
  if (!c) return null
  const url = c.toDataURL('image/png')
  while (urls.size >= CACHE_MAX) {
    const oldest = urls.keys().next().value
    if (oldest === undefined) break
    urls.delete(oldest)
  }
  urls.set(key, url)
  return url
}
