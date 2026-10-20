import type { CSSProperties } from 'react'
import { ICON_N, isBakedSkill, skillIconKey, skillIconPixels, type IconPixels } from '../game/data/skillIcons'
import { Icon } from './Icon'

/**
 * A skill's picture (Oct 2026, the merge art pass) — the one way the shell
 * draws a skill: a library card, a named merge or any of the 2,437 plain
 * merges.
 *
 * A library card or a named merge is a baked atlas cell (`<Icon>`, one sprite
 * sheet, byte-exact). A PLAIN merge is composed: `skillIcons.skillIconPixels`
 * builds its 16 × 16 from the base's drawing in the infusion's colours with
 * the infusion's motif on its corner, and it is drawn here ONCE per merge into
 * a 16 × 16 canvas and kept as a PNG data URL (memoised for the session: a
 * hero holds three, a slot row previews three, so a session draws a handful).
 * Shown at 16 or 32 CSS px with `image-rendering: pixelated`, like every atlas
 * cell — whole-pixel scales only, so a composed merge is exactly as crisp as a
 * baked one.
 *
 * Where there is no canvas (a test, a server render) it falls back to the
 * atlas cell of the merge's base — the right drawing in the base's colours,
 * never a blank. `aria-hidden` like `<Icon>`: the skill's name is always said
 * in text beside it.
 */
const URLS = new Map<string, string | null>()

function toDataUrl(px: IconPixels): string | null {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = ICON_N
  c.height = ICON_N
  const ctx = c.getContext('2d')
  if (!ctx) return null
  const img = ctx.createImageData(ICON_N, ICON_N)
  img.data.set(px)
  ctx.putImageData(img, 0, 0)
  try {
    return c.toDataURL('image/png')
  } catch {
    return null
  }
}

/** A composed picture's data URL, memoised; null where it cannot be drawn. */
export function composedSkillUrl(id: string): string | null {
  if (!URLS.has(id)) {
    const px = skillIconPixels(id)
    URLS.set(id, px ? toDataUrl(px) : null)
  }
  return URLS.get(id)!
}

/** Raw pixels as a data URL (the fuse beat's layers), memoised by `key`. */
export function pixelsUrl(key: string, px: () => IconPixels): string | null {
  if (!URLS.has(key)) URLS.set(key, toDataUrl(px()))
  return URLS.get(key)!
}

export function SkillIcon({ id, lg, className }: { id: string; lg?: boolean; className?: string }) {
  const url = isBakedSkill(id) ? null : composedSkillUrl(id)
  if (!url) return <Icon name={skillIconKey(id)} lg={lg} className={className} />
  return <PixelIcon url={url} lg={lg} className={className} id={id} />
}

/** One composed 16 × 16 at 16 or 32 CSS px, sized like `.fw-i` (it IS one: `.fw-i.sk-px`). */
export function PixelIcon({ url, lg, className, id, style }: { url: string; lg?: boolean; className?: string; id?: string; style?: CSSProperties }) {
  return (
    <span
      className={`fw-i sk-px${lg ? ' lg' : ''}${className ? ' ' + className : ''}`}
      style={{ backgroundImage: `url(${url})`, ...style }}
      aria-hidden="true"
      data-skill={id}
    />
  )
}
