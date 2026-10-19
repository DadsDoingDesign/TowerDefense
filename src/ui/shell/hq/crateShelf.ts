import { PULL_PRICE } from '../../../game/run/hq'

/**
 * How many sealed crates the bank buys (Oct 2026, the crates pass) — the
 * count on the big crate, the most one tap opens, and the count badge on the
 * home bar's Crates plate. Crates are not held: each is bought with bank gold
 * and opened at once (`metaStore.openCrate`), so "how many" is what the bank
 * buys. Pure.
 */

/** The most crates one Open opens (each is still its own crate, opened in turn). */
export const OPEN_MAX = 5
/** The badge stops counting here ("9+"). */
export const BADGE_MAX = 9

export function crateShelf(bank: number): { buys: number; max: number } {
  const buys = Math.max(0, Math.floor((Number.isFinite(bank) ? bank : 0) / PULL_PRICE))
  return { buys, max: Math.min(OPEN_MAX, buys) }
}

/** The home plate's badge: how many the bank buys, or none (a locked plate, an empty bank). */
export function crateBadge(bank: number, open: boolean): string | null {
  const { buys } = crateShelf(bank)
  if (!open || buys < 1) return null
  return buys > BADGE_MAX ? `${BADGE_MAX}+` : String(buys)
}
