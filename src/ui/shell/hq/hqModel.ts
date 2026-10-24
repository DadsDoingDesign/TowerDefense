/**
 * The HQ page as data (the HQ pass, Oct 2026; the designer: "make the tabs and
 * upgrade options more simple and clear"). Pure — no store, no React — so the
 * page, its tests and the shots read the same words.
 *
 * Every upgrade is ONE card in one fixed form: its mark, its name, its level
 * as pips, what it does NOW and what the NEXT level does (the number and what
 * it touches, `docs/copy/COPY.md`), at most one quiet note, and one state that
 * says what the page's one CTA can do with it:
 *
 *  - `buy`: the bank covers the next level;
 *  - `short`: it does not (the CTA says how far off it is);
 *  - `max`: every level is bought;
 *  - `locked`: the staggered reveal has not opened it (company focus before
 *    the fifth finished contract) — `locked` says what opens it.
 *
 * Every number is read off `game/run/hq.ts`; nothing here moves a price, an
 * effect or a roll.
 */
import { companyById, type CompanyId } from '../../../game/data/companies'
import {
  castlePart,
  CASTLE_TIERS,
  castleTier,
  DEAL_STEPS,
  dealSummary,
  FOCUS_FROM_RUN,
  FOCUS_STEP,
  hqCost,
  hqLevel,
  hqMax,
  hqUpgrade,
  packSlots,
  scoutsAt,
  type CastlePartId,
  type CastleTierId,
  type HqId,
} from '../../../game/run/hq'
import type { IconKey } from '../../channels'

export type HqCardState = 'buy' | 'short' | 'max' | 'locked'

export interface HqCardView {
  id: HqId
  name: string
  /** Its picture: an atlas mark. */
  mark: IconKey
  /** The part of the castle it builds (`hq.CASTLE_PARTS`), lit on the picture while it is in focus. */
  part: CastlePartId
  /** That part's name ("Lookout"). */
  partName: string
  level: number
  max: number
  /** The next level's price, or null when maxed. */
  cost: number | null
  state: HqCardState
  /** Gold the bank is short of the next level (0 unless `short`). */
  short: number
  /** What it does now. */
  now: string
  /** What the next level does, or null when maxed. */
  next: string | null
  /** One quiet note of context, when the player needs it to choose. */
  note?: string
  /** What opens a locked card ("Opens after your 5th finished contract"). */
  locked?: string
}

/** The upgrades in the page's order: the first heroes, the cities, the pack, the dealing, the map. */
export const HQ_ORDER: readonly HqId[] = ['deal', 'hiring', 'pack', 'focus', 'scouting']

/** Each upgrade's picture (the atlas: a hero, two hires, a pack, an order, a map). */
export const HQ_MARK: Readonly<Record<HqId, IconKey>> = {
  deal: 'recruit',
  hiring: 'company',
  pack: 'coffer',
  focus: 'orders',
  scouting: 'map',
}

/** The home plate's mark for each castle tier (`scripts/fw-icons.ts`, redrawn for 16 px). */
export const TIER_MARK: Readonly<Record<CastleTierId, IconKey>> = {
  timber: 'hqTimber',
  stone: 'hqStone',
  fortified: 'hqFortified',
  grand: 'hqGrand',
}

/** The HQ's mark as it stands now: the home plate's picture, the castle's material. */
export const hqMark = (levels: Readonly<Record<string, number>> | undefined): IconKey => TIER_MARK[castleTier(levels).tier.id]

/** A tier's sheet (`scripts/hq-keep.ts`): the scene and every part at every level, native pixels drawn at 1×. */
export const castleSheet = (id: CastleTierId): string => `assets/scenes/hq-castle-${id}.png`

const list = (names: string[]): string => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)

/**
 * The next milestone, in one line: "Stone castle: raise Pack slots and Scouts
 * to level 1"; mixed marks name each ("Fortified castle: raise Opening deal
 * to 3 and Company focus to 2"); more than four, the first three and a
 * count. Before Grand, how many are left to max. At the last: "Every upgrade
 * bought".
 */
export function tierLine(levels: Readonly<Record<string, number>> | undefined): string {
  const t = castleTier(levels)
  if (!t.next) return 'Every upgrade bought'
  // The last tier asks for every level: say how many upgrades are still short of their max.
  if (t.next.id === CASTLE_TIERS[CASTLE_TIERS.length - 1].id && t.missing.length > 2)
    return `${t.next.name}: max the last ${t.missing.length} upgrades`
  const named = t.missing.map((m) => ({ name: hqUpgrade(m.id)!.name, need: m.need }))
  const shown = named.length > 4 ? named.slice(0, 3) : named
  const more = named.length - shown.length
  const same = named.every((n) => n.need === named[0].need)
  const body = same
    ? `${more ? `${shown.map((n) => n.name).join(', ')} and ${more} more` : list(shown.map((n) => n.name))} to level ${named[0].need}`
    : more
      ? `${shown.map((n) => `${n.name} to ${n.need}`).join(', ')} and ${more} more`
      : list(shown.map((n) => `${n.name} to ${n.need}`))
  return `${t.next.name}: raise ${body}`
}
export interface HqFacts {
  levels: Readonly<Record<string, number>> | undefined
  bank: number
  /** Finished contracts: company focus shows from {@link FOCUS_FROM_RUN}. */
  runs: number
  /** The company in focus, or null. */
  focus: CompanyId | null
}

const ordinal = (n: number): string => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`

/** What it does at a level: [now, next]. */
function lines(id: HqId, level: number, focus: CompanyId | null): [string, string | null] {
  const max = hqMax(id)
  const top = level >= max
  switch (id) {
    case 'deal':
      return [dealSummary(level), top ? null : DEAL_STEPS[level].line]
    case 'hiring':
      return level ? ['4 candidates per city, trained', null] : ['3 candidates per city', '4 per city, trained to your heroes’ level']
    case 'pack':
      return [`${packSlots(level)} slots`, top ? null : `${packSlots(level + 1)} slots`]
    case 'focus': {
      const who = focus ? companyById(focus).goods.split(' ')[0] : 'one company'
      return [level ? `+${FOCUS_STEP * level}% ${who}` : 'None', top ? null : `+${FOCUS_STEP * (level + 1)}% ${who}`]
    }
    case 'scouting': {
      const s = scoutsAt(level)
      const now = s.wideMap ? 'Ways round ambushes · 3–4 roads a layer' : s.standingOrders ? 'A way round every ambush' : 'None'
      return [now, top ? null : level === 0 ? 'A way round every ambush' : '3 or 4 roads every layer']
    }
  }
}

const NOTES: Partial<Record<HqId, string>> = {
  deal: 'Every contract starts with this deal.',
  pack: 'A full pack sells its cheapest piece.',
  focus: 'Its skills and items come up more. Switching is free.',
}

/** One upgrade's card. */
export function hqCard(id: HqId, f: HqFacts): HqCardView {
  const u = hqUpgrade(id)!
  const level = hqLevel(f.levels, id)
  const max = hqMax(id)
  const cost = hqCost(id, level)
  const [now, next] = lines(id, level, f.focus)
  const p = castlePart(id, level)
  const base = { id, name: u.name, mark: HQ_MARK[id], part: p.id, partName: p.name, level, max, cost, now, next, note: NOTES[id] }
  if (id === 'focus' && f.runs < FOCUS_FROM_RUN)
    return { ...base, state: 'locked', short: 0, locked: `Opens after your ${ordinal(FOCUS_FROM_RUN)} finished contract`, note: undefined }
  if (cost == null) return { ...base, state: 'max', short: 0 }
  const bank = Math.max(0, Math.floor(f.bank))
  return bank >= cost ? { ...base, state: 'buy', short: 0 } : { ...base, state: 'short', short: cost - bank }
}

/** Every upgrade's card, in the page's order. */
export const hqCards = (f: HqFacts): HqCardView[] => HQ_ORDER.map((id) => hqCard(id, f))

/** The card the page opens on: the first you can buy, else the first not maxed, else the first. */
export function firstFocus(cards: readonly HqCardView[]): HqId {
  return (cards.find((c) => c.state === 'buy') ?? cards.find((c) => c.state === 'short') ?? cards[0]).id
}

/** The CTA's words for a card (the price rides beside it). */
export function ctaWords(c: HqCardView): string {
  if (c.state === 'max') return 'Fully upgraded'
  if (c.state === 'locked') return `Opens after ${FOCUS_FROM_RUN} contracts`
  if (c.state === 'short') return 'Need'
  return c.max === 1 ? `Open the ${c.name}` : `Upgrade ${c.name}`
}
