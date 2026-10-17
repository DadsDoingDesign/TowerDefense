import { useEffect, useRef } from 'react'
import { ANIM_FRAMES } from '../../game/render/anim'
import { pixmap } from '../../game/render/pixmap'
import { artFor, getSprite, onSpritesReady } from '../../game/render/sprites'
import { barrelCell } from '../../game/render/units'
import { clanArtFor, clanArtTop } from '../../game/render/clanArt'
import { QUEUE_CHIP } from './enemyQueue'

// Moved out of `WaveQueue.tsx` (Q10) so the enemy info card can draw the same
// portrait without a circular import.

const CHIP = QUEUE_CHIP

/**
 * One enemy, drawn the way the field draws it: the theme's own sprite for the
 * type's art id (a clan's strip for a clan's art id, `clans.clanArtId`), baked by `pixmap` with the same contour-and-rim ring.
 *
 * Integer scale only. Tiny Swords is authored at twice the field's density
 * (`spriteScale: 0.5`, a line goblin ~76px), so a 32px chip takes the
 * renderer's ×½ bucket — the box-filtered bake — and draws it 1:1 into a 32×32
 * backing store; a pack authored at one density is drawn as it is. The browser
 * then enlarges the store by the device's own whole-number ratio (×2, ×3) with
 * `image-rendering: pixelated`. A goblin is ~38×41 at that density, so the chip
 * crops the feet and a sliver of each side, never the head — the same crop
 * `.sh-hero-art` makes for the heroes.
 *
 * Not the `tinyswords@half` files: the build refuses to ship a second copy of
 * the pack (`planPrecache`'s foreign-pack guard), and those carry a cold halo
 * the brand rules out. This bake is the same pipeline, run in the browser.
 */
export function EnemyPortrait({ art, className }: { art: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let live = true
    const draw = () => {
      const c = ref.current
      const ctx = c?.getContext('2d')
      if (!live || !c || !ctx) return
      ctx.clearRect(0, 0, c.width, c.height)
      // Through the one goblin-art helper: a clan role stays itself, a plain
      // art id draws in the field's clan — never the plain goblin.
      const role = clanArtFor(art)
      const src = artFor(role)
      if (!src) return
      let img = getSprite(src.pack, role)
      let frames = 1
      if (!img) {
        // A pack that ships only the run cycle: its first frame.
        const f = ANIM_FRAMES[`${role}_walk`]
        const walk = f ? getSprite(src.pack, `${role}_walk`) : undefined
        if (walk) {
          img = walk
          frames = f
        }
      }
      if (!img) return
      const pm = pixmap(img, {
        scale: src.spriteScale === 0.5 ? 0.5 : 1,
        frames,
        ring: true,
        cell: frames === 1 ? barrelCell(role, img) : undefined,
      })
      if (!pm) return
      const dx = Math.round((CHIP - pm.fw) / 2)
      // Taller than the chip: keep the head, lose the feet. A clan's strip
      // carries headroom for its crest or hat (`clanArt`): start at its art.
      const top = clanArtTop(role)
      const dy = pm.fh > CHIP ? (top ? -Math.max(0, Math.min(pm.fh - CHIP, Math.round(pm.fh * top) - 1)) : 0) : Math.round((CHIP - pm.fh) / 2)
      ctx.imageSmoothingEnabled = false
      if (pm.ring) ctx.drawImage(pm.ring, 0, 0, pm.fw, pm.fh, dx, dy, pm.fw, pm.fh)
      ctx.drawImage(pm.img, 0, 0, pm.fw, pm.fh, dx, dy, pm.fw, pm.fh)
    }
    draw()
    onSpritesReady(draw)
    return () => {
      live = false
    }
  }, [art])
  return <canvas ref={ref} className={className ?? 'sh-wq-art'} width={CHIP} height={CHIP} aria-hidden="true" />
}
