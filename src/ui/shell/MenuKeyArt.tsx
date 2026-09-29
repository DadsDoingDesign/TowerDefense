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
 * ## The seam for the attract-mode battle
 *
 * `children` replaces the still. A live attract battle should render into a
 * `KEYART.w × KEYART.h` box (it is positioned and cropped exactly like the
 * still), or fill the frame itself if it does its own fitting:
 *
 *     <MenuKeyArt><AttractBattle /></MenuKeyArt>
 *
 * Nothing else in the menu needs to change.
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
      <div className="pg-art-stage">{children ?? <KeyArtStill />}</div>
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
