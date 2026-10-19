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
  DEAL_STEPS,
  dealSummary,
  FOCUS_FROM_RUN,
  FOCUS_STEP,
  HQ_LEVELS_MAX,
  hqCost,
  hqLevel,
  hqMax,
  hqStage,
  hqUpgrade,
  packSlots,
  scoutsAt,
  type HqId,
  type HqStageId,
} from '../../../game/run/hq'
import type { IconKey } from '../../channels'

export type HqCardState = 'buy' | 'short' | 'max' | 'locked'

export interface HqCardView {
  id: HqId
  name: string
  /** Its picture: an atlas mark. */
  mark: IconKey
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

/** The home plate's mark for each castle stage (`scripts/fw-icons.ts`, redrawn for 16 px). */
export const STAGE_MARK: Readonly<Record<HqStageId, IconKey>> = {
  lodge: 'hqLodge',
  watchtower: 'hqTower',
  castle: 'hqCastle',
  stronghold: 'hqStronghold',
}

/** The HQ's mark as it stands now: the home plate's picture. */
export const hqMark = (levels: Readonly<Record<string, number>> | undefined): IconKey => STAGE_MARK[hqStage(levels).stage.id]

/** The page's castle picture for a stage (`scripts/hq-keep.ts`, native pixels drawn at 1×). */
export const stageArt = (id: HqStageId): string => `assets/scenes/hq-${id}.png`
/** The baked scene's size, in native pixels: a phone sees its middle. */
export const HQ_SCENE = { w: 400, h: 232 } as const

/** "Castle in 3 upgrades" — the stage line under the picture. */
export function stageLine(levels: Readonly<Record<string, number>> | undefined): string {
  const s = hqStage(levels)
  if (!s.next) return s.bought >= HQ_LEVELS_MAX ? 'Every upgrade bought' : `${s.bought} of ${HQ_LEVELS_MAX} upgrades`
  return `${s.next.name} in ${s.toNext} upgrade${s.toNext === 1 ? '' : 's'}`
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
  const base = { id, name: u.name, mark: HQ_MARK[id], level, max, cost, now, next, note: NOTES[id] }
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
