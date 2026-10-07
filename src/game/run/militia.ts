/**
 * ---------------------------------------------------------------------------
 * Your militia: its name and its banner (the mercenary company, build step 4)
 * ---------------------------------------------------------------------------
 *
 * The name is PICKED, never typed: a generated name with a re-roll. Free text
 * would need moderation the moment it is shown to anyone else (a weekly
 * charter seed, a shared run), and a name built only from the fragments below
 * cannot say anything they do not.
 *
 * A name is "The <place> <company>" ("The Ashford Company"), "The <colour>
 * <company>" ("The Grey Lances") or "The <place> Free Company". A place is a
 * stem and an ending from two short lists, English-village style. Every word
 * is from a list here, so {@link isMilitiaName} can check a stored name by the
 * same grammar and drop anything a save could not have picked.
 *
 * Pure: no zustand, no React. The save's copy lives in the meta store
 * (`militia`), validated by {@link readMilitia}.
 */
import { hashSeed, RNG } from '../core/rng'
import { isBannerShape, isCharge, isTincture, type BannerLook } from '../data/banner'

const STEMS = [
  'Ash', 'Thorn', 'Oak', 'Grey', 'Iron', 'Raven', 'Wolf', 'Stone', 'Black', 'Red', 'Hollow', 'Bram',
  'Elder', 'Wind', 'Frost', 'Briar', 'Cold', 'Marsh', 'Hart', 'Kestrel', 'Bright', 'Hazel', 'Rook', 'Fen',
  'Wex', 'Alder', 'Copper', 'Mill', 'Hay', 'Barrow',
] as const
const ENDINGS = ['ford', 'wick', 'by', 'ton', 'mere', 'dale', 'holt', 'moor', 'field', 'wood', 'gate', 'stead', 'burn', 'ley', 'combe', 'well'] as const
const COLOURS = ['Grey', 'Black', 'Red', 'Iron', 'Ashen', 'Silver', 'Brass', 'Crimson', 'Green', 'Pale'] as const
const COMPANIES = ['Company', 'Lances', 'Blades', 'Watch', 'Guard', 'Wardens', 'Spears', 'Riders', 'Banners', 'Shields'] as const

export interface Militia extends BannerLook {
  /** The militia's name, from {@link militiaName}: "The Ashford Company". */
  name: string
}

/** One name, from a seed: the same seed is always the same name. */
export function militiaName(seed: number): string {
  const r = new RNG(hashSeed('militia-name', seed))
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r.next() * xs.length)]
  const form = r.next()
  if (form < 0.2) return `The ${pick(COLOURS)} ${pick(COMPANIES)}`
  const place = `${pick(STEMS)}${pick(ENDINGS)}`
  if (form < 0.32) return `The ${place} Free Company`
  return `The ${place} ${pick(COMPANIES)}`
}

/** A name for `seed` different from `not` (the re-roll never deals the name you already had). */
export function rerollName(seed: number, not: string | null): { name: string; seed: number } {
  for (let s = seed, i = 0; i < 16; s++, i++) {
    const name = militiaName(s)
    if (name !== not) return { name, seed: s }
  }
  return { name: militiaName(seed), seed }
}

const isPlace = (w: string): boolean => STEMS.some((s) => w.startsWith(s) && (ENDINGS as readonly string[]).includes(w.slice(s.length)))

/** Whether `name` is one the generator can deal — the only names a save may hold. */
export function isMilitiaName(name: unknown): name is string {
  if (typeof name !== 'string' || name.length > 40) return false
  const w = name.split(' ')
  if (w[0] !== 'The') return false
  if (w.length === 4) return isPlace(w[1]) && w[2] === 'Free' && w[3] === 'Company'
  if (w.length !== 3) return false
  return (isPlace(w[1]) || (COLOURS as readonly string[]).includes(w[1])) && (COMPANIES as readonly string[]).includes(w[2])
}

/** A stored militia, validated: a generated name and a known shape, tincture and charge — or null. */
export function readMilitia(raw: unknown): Militia | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!isMilitiaName(o.name) || !isBannerShape(o.shape) || !isTincture(o.tincture) || !isCharge(o.charge)) return null
  return { name: o.name, shape: o.shape, tincture: o.tincture, charge: o.charge }
}

/**
 * The line under the menu's name: "The Ashford Company · guard the road, bank the gold".
 * The tagline (Oct 2026) replaced "Sellswords for hire", which said "for hire" twice
 * and nothing about the job: guard a company's road, bring its gold home.
 */
export const TAGLINE = 'Guard the road, bank the gold'
export const militiaTagline = (m: Pick<Militia, 'name'> | null): string => (m ? `${m.name} · ${TAGLINE.toLowerCase()}` : TAGLINE)
