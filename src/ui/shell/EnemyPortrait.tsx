import { useEffect, useRef } from 'react'
import { ANIM_FRAMES } from '../../game/render/anim'
import { pixmap } from '../../game/render/pixmap'
import { artFor, getSprite, onSpritesReady } from '../../game/render/sprites'
import { barrelCell } from '../../game/render/units'
import { QUEUE_CHIP } from './enemyQueue'

// Moved out of `WaveQueue.tsx` (Q10) so the enemy info card can draw the same
// portrait without a circular import.

const CHIP = QUEUE_CHIP

/**
 * One enemy, drawn the way the field draws it: the theme's own sprite for the
 * type's art id, baked by `pixmap` with the same contour-and-rim ring.
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
      const src = artFor(art)
      if (!src) return
      let img = getSprite(src.pack, art)
      let frames = 1
      if (!img) {
        // A pack that ships only the run cycle: its first frame.
        const f = ANIM_FRAMES[`${art}_walk`]
        const walk = f ? getSprite(src.pack, `${art}_walk`) : undefined
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
        cell: frames === 1 ? barrelCell(art, img) : undefined,
      })
      if (!pm) return
      const dx = Math.round((CHIP - pm.fw) / 2)
      // Taller than the chip: keep the head, lose the feet.
      const dy = pm.fh > CHIP ? 0 : Math.round((CHIP - pm.fh) / 2)
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
