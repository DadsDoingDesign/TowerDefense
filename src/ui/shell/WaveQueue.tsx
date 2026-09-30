import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ANIM_FRAMES } from '../../game/render/anim'
import { pixmap } from '../../game/render/pixmap'
import { artFor, getSprite, onSpritesReady } from '../../game/render/sprites'
import { barrelCell } from '../../game/render/units'
import { Icon } from '../Icon'
import { chipsThatFit, lineUpWords, QUEUE_CHIP, type LineUpEntry } from './enemyQueue'

/**
 * The wave strip's enemy queue (G2-2): small portraits in spawn order, next one
 * first, each with its count. It sits where the kill-progress bar was and takes
 * exactly the bar's room — no new row, no new panel.
 *
 * Glance-only by design (not tappable in this build): the composition panel
 * one band up is where an enemy is read in full. The whole queue is ONE image
 * to assistive tech, named with every kind and count — including the kinds
 * that did not fit — so the "+N" is never the only statement of what is left.
 */

const CHIP = QUEUE_CHIP

export function WaveQueue({
  entries,
  lead,
  emptyText,
}: {
  entries: LineUpEntry[]
  /** What the accessible name opens with — "Still to come", "Next sub-wave"… */
  lead: string
  /** Shown when nothing is queued (every body is already on the field). */
  emptyText: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const total = entries.reduce((n, e) => n + e.count, 0)
  if (entries.length === 0) {
    return (
      <div ref={ref} className="sh-wq empty">
        <span className="sh-wq-empty">{emptyText}</span>
      </div>
    )
  }
  const shown = chipsThatFit(width, entries.length)
  const more = entries.length - shown
  return (
    <div ref={ref} className="sh-wq" role="img" aria-label={`${lead}: ${lineUpWords(entries)}.`}>
      {shown === 0 ? (
        // Narrower than one portrait: say it in words rather than clip a face.
        <span className="sh-wq-empty">{total} {total === 1 ? 'enemy' : 'enemies'}</span>
      ) : (
        <>
          {entries.slice(0, shown).map((e, i) => (
            <span className={`sh-wq-chip${i === 0 ? ' next' : ''}`} key={e.typeId} title={`${e.name} ×${e.count}`}>
              <EnemyPortrait art={e.art} />
              {e.boss && <Icon name="boss" className="sh-wq-boss" />}
              <b className="sh-wq-n">×{e.count}</b>
            </span>
          ))}
          {more > 0 && <span className="sh-wq-more">+{more}</span>}
        </>
      )}
    </div>
  )
}

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
function EnemyPortrait({ art }: { art: string }) {
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
  return <canvas ref={ref} className="sh-wq-art" width={CHIP} height={CHIP} aria-hidden="true" />
}
