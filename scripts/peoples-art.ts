/**
 * Peoples & Trades — DRAFT art for the world-rework proposal (Oct 2026).
 *
 * The designer: "show each item's and each skill's unique visual assets
 * (icon, on a tower, etc)". Five peoples, one per trade company, each with 20
 * item kinds (levels 1–4) and 10 skills. This module is the proposal's art,
 * as data, and NOTHING here ships: the atlas (`fw-icons.ts` →
 * `public/assets/ui/fw-icons.png`), the item and skill tables and every
 * gameplay number are untouched. It is read only by the review harness
 * (`harness/peoples.ts`, `harness/peoples.html`) and the sheet script
 * (`scripts/peoples-sheets.mjs`), which render the contact sheets in
 * `docs/peoples/`.
 *
 *  - **Icons** are 16 × 16 rows of the atlas's own palette letters, interior
 *    only, in rows/cols 1..14; the `#161C2E` ring is added by the same rule
 *    as `fw-icons.ts` (`outline`). A kept item names its atlas cell instead
 *    (`icon: 'blade'`); the two renamed ones are redrawn.
 *  - **On the hero**: a weapon or off-hand is held through the real
 *    `gearMarks` fists (`HeroGear.art`, with its grip here); a body piece is
 *    worn through the real `bodyLayer` dresser as a {@link BodyStyle}; a kept
 *    piece is its shipped `BodyKey`.
 *  - **Skills** have an icon and a TELL — a small persistent mark on the
 *    hero ({@link Tell}) — and an on-hit frame ({@link Hit}) that uses the
 *    real FX (`fx.fxImpact`, `fxArc`, `fxProc`, `fxFloater`, the enemy's own
 *    burn / chill / stun states) wherever the effect already exists, and a
 *    drafted mark in the pack's look where it does not (poison, bleed, roots,
 *    gold).
 *
 * Pure: no DOM, no Node. Original pixel art, drawn here.
 */
export * from './peoples-art/core'
import { assertArt, isArt, type Art, type People } from './peoples-art/core'
import { HUMANS } from './peoples-art/humans'
import { ELVES } from './peoples-art/elves'
import { DWARVES } from './peoples-art/dwarves'
import { REPTILIANS } from './peoples-art/reptilians'
import { GNOMES } from './peoples-art/gnomes'

export const PEOPLES: readonly People[] = [HUMANS, ELVES, DWARVES, REPTILIANS, GNOMES]

/** Every drafted grid, keyed `<people>/<item or skill>`, checked. */
export function allArt(): { key: string; art: Art }[] {
  const out: { key: string; art: Art }[] = []
  for (const p of PEOPLES) {
    for (const it of p.items) if (isArt(it.icon)) out.push({ key: `${p.id}/${it.name}`, art: it.icon })
    for (const sk of p.skills) out.push({ key: `${p.id}/skill/${sk.name}`, art: sk.icon })
  }
  for (const a of out) assertArt(a.key, a.art)
  return out
}
