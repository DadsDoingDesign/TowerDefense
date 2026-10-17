/**
 * Which goblin art the field draws: the run's clan (`data/clans.ts`), set by
 * the battle canvas from the run (`run/clans.runClan`) the way it sets the
 * field's season. A presentation setting, never engine state: the engine
 * keeps its ids and the renderer swaps the strip it blits.
 *
 * A clan's strips are lazy (`sprites.isLazyRole`): {@link setEnemyClan} asks
 * for the clan's fifteen files the moment the clan is set (the battle's
 * setup), and until one has decoded that goblin draws in the plain art — a
 * goblin is never a gap.
 */
import { clanArtId, clanRolesOf, type ClanId } from '../data/clans'
import { ANIM_FRAMES } from './anim'
import { CLAN_ART } from './enemyClans.generated'
import { artFor, getSprite } from './sprites'

let active: ClanId | null = null

/** Dress the field's goblins as `clan` (null: the plain goblins). Cheap to call every frame. */
export function setEnemyClan(clan: ClanId | null): void {
  if (clan === active) return
  active = clan
  if (clan) preloadClan(clan)
}

export const activeEnemyClan = (): ClanId | null => active

/** Ask for a clan's strips now (`artFor` fetches a lazy family on first ask). */
export function preloadClan(clan: ClanId): void {
  for (const role of clanRolesOf(clan)) artFor(role)
}

/**
 * The role to draw art id `artId` with under `clan`: the clan's strip once it
 * has decoded, from the same pack as the plain art (a preview theme's own
 * goblin is never swapped for a Tiny Swords clan), else the plain art id.
 */
export function clanArtFor(artId: string, clan: ClanId | null = active): string {
  const role = clanArtId(clan, artId)
  if (role === artId) return artId
  const plain = artFor(artId)
  const src = artFor(role)
  if (!plain || !src || src.pack !== plain.pack) return artId
  const file = ANIM_FRAMES[`${role}_walk`] ? `${role}_walk` : role
  return getSprite(src.pack, file) ? role : artId
}

/**
 * Where a baked strip's art starts, as a fraction of its cell height — the
 * top of its tallest frame, so the HP bar clears a crest, a hat or horns.
 * Undefined for the plain art (which keeps its own rule in `drawEnemy`).
 */
export function clanArtTop(role: string): number | undefined {
  return (CLAN_ART[role] ?? CLAN_ART[`${role}_walk`])?.top
}
