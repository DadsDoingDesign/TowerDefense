import type { Archetype } from '../types'

/**
 * The archetype glyph — the ONE table. The canvas (`game/render/units.ts`) and
 * every UI surface (through `src/ui/channels.ts`, which re-exports it) read
 * this; if two copies ever disagree, the same hero reads as one class on the
 * canvas and another on its roster card.
 *
 * `rogue` is `➶`, NOT `✦`. `✦` is Watch Marks and nothing else; it used to be
 * the rogue mark *and* the stun mark, so a single glyph carried three meanings
 * (DESIGN_SYSTEM §6).
 */
export const ARCHETYPE_GLYPH: Readonly<Record<Archetype, string>> = { fighter: '⚔', rogue: '➶', mystic: '❋' }
