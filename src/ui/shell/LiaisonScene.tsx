import type { CSSProperties, ReactNode } from 'react'
import { companyById, type CompanyId } from '../../game/data/companies'
import { liaisonPlate } from '../../game/run/liaison'
import { StopScene } from './StopScene'
import { liaisonScene } from './stopScene'
import { SCENE_ANCHORS, SCENE_SIZE } from './stopScenes.generated'

/**
 * A company's liaison at the company's post (Draft 4 · D, "someone to talk
 * to"; mockups 5a / 5b): the post baked from the CC0 pack
 * (`scripts/stop-scenes.ts`, `liaison-<company>`), the liaison behind its
 * counter saying one line in a bubble — exactly as a stop's keeper does
 * (`StopScene`) — the bubble headed with who speaks ("Brannoch ·
 * Ironvein’s factor"), as the receipt's line is.
 *
 *  - **`notice`**: a short band at the top of the home's road notice, the
 *    whole post at 1× (as the mockup framed it). The bubble is the notice's
 *    letter now (the company talking), so the notice says it once.
 *  - **`city`**: the head of a city's page at the stops' 2×, the page's one
 *    title hung on it as the city's sign (`liaisons.css`).
 *
 * The bubble always hangs beside the liaison's head: both bands are shorter
 * than a stop's, and the sign takes the sky.
 *
 * The art is decoration; the bubble — who, then the line — is read in place.
 */
export function LiaisonScene({ company, line, at, children }: { company: CompanyId; line: string; at: 'notice' | 'city'; children?: ReactNode }) {
  return (
    <StopScene kind={liaisonScene(company)} line={line} who={liaisonPlate(company)} beside scale={at === 'notice' ? 1 : 2} className={`lia-scene at-${at}`}>
      {children}
    </StopScene>
  )
}

/**
 * One line from the liaison on the receipt (delivered, cashed out, fallen):
 * small, their face cut from their post beside it, their name, the line.
 */
export function LiaisonSays({ company, line }: { company: CompanyId; line: string }) {
  const kind = liaisonScene(company)
  const [sx, sy] = SCENE_ANCHORS[kind].speaker
  // The cameo: the post at 1×, as the notice draws it, framed on the liaison over the counter.
  const face: CSSProperties = {
    backgroundImage: `url(assets/scenes/${kind}.png)`,
    backgroundSize: `${SCENE_SIZE.w}px ${SCENE_SIZE.h}px`,
    backgroundPosition: `${-(sx - 26)}px ${-(sy - 12)}px`,
    '--co': companyById(company).color,
  } as CSSProperties
  return (
    <div className="lia-says">
      <span className="lia-face" style={face} aria-hidden="true" />
      <p className="lia-says-line">
        <b className="lia-says-who">{liaisonPlate(company)}</b>
        <span className="lia-says-q">{line}</span>
      </p>
    </div>
  )
}
