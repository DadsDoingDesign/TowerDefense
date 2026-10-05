/**
 * Clearance conflicts — a hero that starts swinging where it stands.
 *
 * The designer: "equiping a sword might make it unsafe to use a tower where it
 * is and require you to make space. show conflicts and block round start until
 * resolved". A hero only ever POSTS clear of the rule (the store and the
 * breather move refuse a crowding tile), so a conflict is what a GEAR change
 * leaves behind: a ranged hero takes a sword while someone stands beside it.
 * Gear changes only between rounds — the setup and the breather — so that is
 * the only place a conflict can stand, and the next wave (or sub-wave) waits
 * until it is gone. Nobody is moved for the player.
 *
 * **Never stuck.** Every conflict has a legal fix the player can always make:
 *  - in setup, moves are unlimited and a hero can be taken off the field;
 *  - in the breather (one move), taking the swinging weapon off always works.
 *    The breather opens conflict-free (a wave cannot start with one), its one
 *    move is checked against who swings at that moment, and a hero without a
 *    weapon swings only if a skill says so — which no breather can change.
 *    So with every weapon taken back off, the field is at most as crowded as
 *    a field that was legal. `tests/weaponClearance.test.ts` holds it.
 *
 * Pure: heroes and tiles in, conflicts and copy out.
 */
import { clearanceConflicts, crowdedBy, type Post } from '../data/terrain'
import { isMelee, meleeSource, swingsPhrase, weaponNoun } from '../engine/melee'
import type { Sentinel } from '../types'

/** A hero on the field, where it stands. */
export interface Standing {
  hero: Sentinel
  tile: string
}

/** One hero that swings, and whoever stands inside its clearance. */
export interface ClearanceConflict {
  hero: Sentinel
  tile: string
  crowding: Standing[]
}

type StandPost = Post & { s: Standing }

const postOf = (s: Standing): StandPost => ({ tile: s.tile, melee: isMelee(s.hero), s })

/** Every conflict on a field (see `terrain.clearanceConflicts`). */
export function conflictsAmong(standing: readonly Standing[]): ClearanceConflict[] {
  return clearanceConflicts(standing.map(postOf)).map((c) => ({
    hero: c.melee.s.hero,
    tile: c.melee.tile,
    crowding: c.crowding.map((p) => p.s),
  }))
}

/** Ids of every hero in a conflict — the swingers and the ones too close. */
export function conflictedIds(conflicts: readonly ClearanceConflict[]): Set<string> {
  const out = new Set<string>()
  for (const c of conflicts) {
    out.add(c.hero.id)
    for (const o of c.crowding) out.add(o.hero.id)
  }
  return out
}

const names = (xs: readonly string[]): string =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`

/** The weapon(s) the swingers could take off, in words: "the sword", "their weapons". */
function weaponsOff(conflicts: readonly ClearanceConflict[]): string | null {
  const nouns = new Set<string>()
  for (const c of conflicts) {
    const src = meleeSource(c.hero)
    if (src?.kind === 'weapon') nouns.add(weaponNoun(src.item))
  }
  if (!nouns.size) return null
  return nouns.size === 1 && new Set(conflicts.map((c) => c.hero.id)).size === 1 ? `the ${[...nouns][0]}` : 'the weapons'
}

/**
 * What the wave strip says while a conflict holds the wave: who swings (the
 * headline) and the fix (the instruction).
 *
 * - `moveLeft`: the player can still move a hero (always in setup; in the
 *   breather until its one move is spent).
 * - `breather`: the fix may also be taking the weapon back off.
 */
export function conflictCopy(
  conflicts: readonly ClearanceConflict[],
  opts: { moveLeft: boolean; breather: boolean },
): { head: string; fix: string; line: string } {
  const swingers = [...new Map(conflicts.map((c) => [c.hero.id, c.hero])).values()]
  const head = swingers.length === 1 ? swingsPhrase(swingers[0]) : `${names(swingers.map((h) => h.name))} swing`
  const zone = swingers.length === 1 ? 'the red zone' : 'the red zones'
  const off = weaponsOff(conflicts)
  let fix: string
  if (!opts.moveLeft) fix = off ? `Your move is spent — take ${off} off.` : `Your move is spent — change gear to make space.`
  else if (opts.breather && off) fix = `Move a hero out of ${zone}, or take ${off} off.`
  else fix = `Move a hero out of ${zone}.`
  return { head, fix, line: `Make space: ${head} — ${fix.charAt(0).toLowerCase()}${fix.slice(1)}` }
}

/**
 * The equip flow's warning, BEFORE the swap: would putting `after` (the hero
 * as it would stand in the new gear) where `hero` stands crowd anyone? Null
 * when it would not — the hero already swung, stops swinging, is not on the
 * field, or has room.
 */
export function equipWarning(
  hero: Sentinel,
  after: Sentinel,
  itemName: string,
  standing: readonly Standing[],
): { text: string; count: number } | null {
  const here = standing.find((s) => s.hero.id === hero.id)
  if (!here || isMelee(hero) || !isMelee(after)) return null
  const others = standing.filter((s) => s.hero.id !== hero.id)
  const close = others.filter((o) => crowdedBy(o.tile, false, [{ tile: here.tile, melee: true }]))
  if (!close.length) return null
  const n = close.length
  return {
    count: n,
    text: `Equipping ${itemName} makes ${hero.name} melee — ${n} hero${n === 1 ? ' is' : 'es are'} too close.`,
  }
}

/**
 * The coach line for a refused tile, naming the hero that swings and why:
 * "Too close — Bran swings a sword, so keep the tiles next to Bran clear."
 * `swinger` is the melee one of the two (the hero being posted, or the one
 * already standing there).
 */
export function roomLine(swinger: Sentinel): string {
  return `Too close — ${swingsPhrase(swinger)}, so keep the tiles next to ${swinger.name} clear.`
}
