/**
 * THE helper every picture of a goblin goes through (`units.drawEnemy`, the
 * corpses in `fx.ts`, `EnemyPortrait` — the card, the wave preview and queue,
 * the Codex — and the theme preview): {@link clanArtFor} turns an art id into
 * its clan's baked strip. No plain goblin is ever drawn (`sprites` ships no
 * plain goblin role; `tests/clans.test.ts` holds it).
 *
 * The field's clan is the run's (`run/clans.runClan`), set by the battle
 * canvas the way it sets the field's season — a presentation setting, never
 * engine state: the engine keeps its ids, the renderer picks the strip.
 * `DEFAULT_CLAN`'s strips ship with the boot (and the offline install); every
 * other clan's are lazy (`sprites.isLazyRole`), asked for the moment the clan
 * is set (the battle's setup) — until one has decoded, that goblin draws in
 * the default clan's dress, never the plain one and never a gap.
 */
import { clanArtId, clanRolesOf, DEFAULT_CLAN, type ClanId } from '../data/clans'
import { ANIM_FRAMES } from './anim'
import { CLAN_ART } from './enemyClans.generated'
import { artFor, getSprite } from './sprites'

let active: ClanId = DEFAULT_CLAN

/** Dress the field's goblins as `clan` (null: the default clan). Cheap to call every frame. */
export function setEnemyClan(clan: ClanId | null): void {
  const next = clan ?? DEFAULT_CLAN
  if (next === active) return
  active = next
  preloadClan(next)
}

export const activeEnemyClan = (): ClanId => active

/** Ask for a clan's strips now (`artFor` fetches a lazy family on first ask). */
export function preloadClan(clan: ClanId): void {
  for (const role of clanRolesOf(clan)) artFor(role)
}

const decoded = (role: string): boolean => {
  const src = artFor(role)
  return !!src && !!getSprite(src.pack, ANIM_FRAMES[`${role}_walk`] ? `${role}_walk` : role)
}

/**
 * The role to draw art id `artId` with under `clan` (default: the field's):
 * the clan's strip, or — while a lazy clan is still arriving — the default
 * clan's. An id that is already a clan role, or no goblin at all, comes back
 * as it is. Never a plain goblin role.
 */
export function clanArtFor(artId: string, clan: ClanId | null = active): string {
  const role = clanArtId(clan, artId)
  if (role === artId) return artId
  if (decoded(role)) return role
  const fallback = clanArtId(DEFAULT_CLAN, artId)
  return decoded(fallback) ? fallback : role
}

/**
 * Where a baked strip's art starts, as a fraction of its cell height — the
 * top of its tallest frame, so the HP bar clears a crest, a hat or horns.
 * Undefined for a role that is no clan strip.
 */
export function clanArtTop(role: string): number | undefined {
  return (CLAN_ART[role] ?? CLAN_ART[`${role}_walk`])?.top
}
