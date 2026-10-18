/**
 * The home dock's company faces — the PURE half (October 2026; the designer,
 * on the review board: "Should the newest version have characters instead of
 * logos?" Yes). Each dock slot shows its company's liaison, the hand-drawn
 * 24 × 28 dock figure (`game/render/hero/mini.ts`), in place of the crest.
 * `DockFace.tsx` draws it; this file says WHO and WHICH FRAME, no DOM.
 *
 * Crests stay everywhere else (the card head, the track, the notices, the
 * livery): the face is the dock's alone.
 */
import type { CompanyId } from '../../game/data/companies'
import type { FxLevel } from '../../game/render/fxQuality'
import { miniAt, type MiniAnim } from '../../game/render/hero/mini'
import type { PersonaId } from '../../game/render/hero/rig'

/**
 * Who stands in each company's slot: the one table to edit to swap a face.
 *
 * NOTE — the faces lead the rename. `art` is still Easel House and `scrolls`
 * still Moonquill in `data/companies.ts` and `data/liaisons.ts`; their slots
 * already show the faces proposed for the companies they are becoming
 * (`docs/characters/README.md`): Hask, the Butcherblock salter, and Wren,
 * the Greenvial herbalist. Saffra, Odile and Brannoch are the liaisons
 * `liaisons.ts` already voices.
 */
export const DOCK_FACE: Readonly<Record<CompanyId, PersonaId>> = {
  spice: 'saffra',
  silk: 'odile',
  metals: 'brannoch',
  art: 'hask', // Easel House's slot (becoming Butcherblock)
  scrolls: 'wren', // Moonquill's slot (becoming Greenvial)
}

/** The figure's pixel scale in the slot: 2× (the crests' own) on a phone and a desk alike. */
export const DOCK_FACE_SCALE = 2

/** What a slot's figure shows now. */
export interface DockFaceState {
  persona: PersonaId
  anim: MiniAnim
  frame: number
  /** The company is not hiring yet: the figure is its shadow. */
  locked: boolean
}

/**
 * The frame a dock face shows `t` ms into the dock's clock. A locked company
 * is its still shadow (nobody is there yet, so nobody reacts); under reduced
 * motion (`off`) the still pose; on Light the tic plays half as often; the
 * reaction plays from `pickedAt`, the moment its slot was focused.
 */
export function dockFaceAt(company: CompanyId, t: number, o: { locked: boolean; level: FxLevel; pickedAt?: number }): DockFaceState {
  const persona = DOCK_FACE[company]
  const still = o.locked || o.level === 'off'
  const at = miniAt(persona, t, { still, pickedAt: still ? undefined : o.pickedAt, ticEach: o.level === 'light' ? 2 : 1 })
  return { persona, anim: at.anim, frame: at.frame, locked: o.locked }
}
