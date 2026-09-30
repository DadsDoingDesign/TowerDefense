import type { CSSProperties, ReactNode } from 'react'
import { KEYART } from '../../assets/brand/keyart'

/**
 * The Watchtower menu's key-art frame (Phase 4).
 *
 * ## What it shows today
 *
 * A still diorama rendered offline by `scripts/brand.ts` from the game's own
 * CC0 sprites: dusk, the road, a goblin column with torches, three heroes on
 * their circles, and the mark itself standing on the ridge (the watchtower in
 * front of the setting sun). One art pixel is one CSS pixel, placed on whole
 * pixels, so it scales by exactly the device pixel ratio and never blurs.
 *
 * The frame is flexible and the art is not: the 488×272 scene is CROPPED to
 * whatever the menu can spare (358×266 on a 390×844 phone, ~343×175 on a
 * 375×667 one), centred horizontally and weighted toward its focal band
 * vertically. The composition keeps the subject in the middle 328×150 and
 * puts only trees and brush in the margins that get cropped.
 *
 * ## Where it shows (Whales UI plan H1-2)
 *
 * Under reduced motion only. When motion is allowed the menu draws the live
 * attract battle behind the whole screen instead (`MenuBackdrop` below), and
 * this frame is not rendered. `children` is still honoured as a layer over the
 * still, filling the frame, should anything want to lay one there.
 *
 * ## Ambience
 *
 * CSS-only: the lamp breathes, the torches flicker, a few stars twinkle — each
 * an absolutely positioned span over the coordinates the renderer reported
 * (`keyart.ts`). All of it stops under reduced motion (the OS setting or the
 * in-game toggle), leaving the still exactly as rendered.
 */
export function MenuKeyArt({ children }: { children?: ReactNode }) {
  return (
    <div className="pg-art" aria-hidden>
      <div className="pg-art-stage">
        <KeyArtStill />
      </div>
      {children}
    </div>
  )
}

/**
 * The Watchtower menu's cinematic backdrop (Whales UI plan H1-2): the live
 * attract battle (`children`, i.e. `<AttractMode />`) filling the whole screen
 * BEHIND the menu, under a shade — a vignette, a wash behind the title and a
 * bottom-up gradient behind the rows — so the menu overlays the art and stays
 * readable over its brightest frame.
 *
 * Until the battle's first frame (before idle, or offline without its chunk)
 * this is the page ground under the same shade, and the battle fades up out of
 * it. Decorative: hidden from assistive tech, takes no pointer.
 */
export function MenuBackdrop({ children }: { children?: ReactNode }) {
  return (
    <div className="pg-cine-bg" aria-hidden>
      {children}
      <div className="pg-cine-shade" />
    </div>
  )
}

const at = (x: number, y: number, extra?: CSSProperties): CSSProperties => ({ left: x, top: y, ...extra })

function KeyArtStill() {
  const [lx, ly, lw, lh] = KEYART.lamp
  return (
    <>
      <img
        className="pg-art-img"
        src={KEYART.src}
        width={KEYART.w}
        height={KEYART.h}
        alt=""
        decoding="async"
        draggable={false}
      />
      <span className="pg-art-fx pg-art-lamp" style={at(lx + lw / 2, ly + lh / 2)} />
      {KEYART.torches.map(([x, y], i) => (
        <span
          key={`t${i}`}
          className="pg-art-fx pg-art-torch"
          style={at(x, y, { animationDelay: `${-0.37 * i}s` })}
        />
      ))}
      {KEYART.stars.map(([x, y], i) => (
        <span
          key={`s${i}`}
          className="pg-art-fx pg-art-star"
          style={at(x, y, { animationDelay: `${-1.3 * i}s` })}
        />
      ))}
    </>
  )
}
