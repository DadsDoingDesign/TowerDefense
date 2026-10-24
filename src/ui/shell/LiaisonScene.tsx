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
 * It heads a city's page at the stops' 2×, the page's one title hung on it as
 * the city's sign (`liaisons.css`). (The home no longer shows a liaison: the
 * October 2026 map-first home keeps people to the road — cities and the
 * receipt.)
 *
 * The bubble always hangs beside the liaison's head, at the point the bake
 * found clear of the liaison in every frame (`talk`): the band is shorter
 * than a stop's, and the sign takes the sky.
 *
 * The art is decoration; the bubble — who, then the line — is read in place.
 */
export function LiaisonScene({ company, line, children }: { company: CompanyId; line: string; children?: ReactNode }) {
  return (
    <StopScene kind={liaisonScene(company)} line={line} who={liaisonPlate(company)} beside scale={2} className="lia-scene at-city">
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
  const a = SCENE_ANCHORS[kind]
  // The cameo: the post at 1×, framed on the liaison's head (hat to chin), as baked.
  const [cx, cy] = 'cameo' in a ? a.cameo : [a.speaker[0] - 26, a.speaker[1] - 12]
  const face: CSSProperties = {
    backgroundImage: `url(assets/scenes/${kind}.png)`,
    backgroundSize: `${SCENE_SIZE.w}px ${SCENE_SIZE.h}px`,
    backgroundPosition: `${-cx}px ${-cy}px`,
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
