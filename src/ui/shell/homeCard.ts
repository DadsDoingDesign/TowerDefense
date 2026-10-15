/**
 * The home's card (October 2026, the map-first home) — the PURE half: a FIXED
 * FORM. The designer, picking from company to company: "this pushes the other
 * label out so then it wraps another line … keep UI sections responsive but
 * also not wiggling around between every selection". The card used to be a
 * row of chips, as many as the company had facts, so it wrapped and changed
 * height on every pick, and the dock and the map moved with it.
 *
 * Now every company's card is the same three rows, in the same places — only
 * the values change — and the Buy Company card is three rows in the same frame:
 *
 *  - **Ground** — what the road's ground DOES to the field, with its marks
 *    (`terrain.GROUND_EFFECTS`), not its place-name;
 *  - **Raiders** — the armour its armoured fights lean to and the damage that
 *    goes through it, or "Plate or wards, evenly";
 *  - **Rep N** — what the loyalty track pays at the next level, by kind
 *    ("Skill · Gilt Frame"), with its mark (the way into the track).
 *
 * A one-off condition — desperate terms, the market of the day — is not a row: most days no company has one, and
 * a row that read "Usual terms" on nearly every card was a row with no job
 * (the designer, Oct 2026: "the terms is a one off so most won't have
 * anything"). It is a badge at the right of the card's head (`companyBadge`),
 * there only when it applies; the head's height does not change with it.
 *
 * Each row is one line (`.field-k` / `.field-v`), shortened in place at a
 * narrow width, never wrapped. `tests/homeCard.test.ts` pins the form.
 */
import { companyById, type CompanyId } from '../../game/data/companies'
import { ENEMY_MODS } from '../../game/data/enemies'
import { GROUND_EFFECTS, groundEffect, type GroundMark } from '../../game/data/terrain'
import { CHARTER_PAYOUT } from '../../game/run/charter'
import { DESPERATE_PAY } from '../../game/run/contracts'
import type { NextReward } from '../../game/run/track'
import { DESPERATE_STRENGTH } from '../../game/run/tradeWar'
import { itemKindIcon, skillIcon, type IconKey } from '../channels'
import type { CharterSlot } from './homeDock'

/** How a value reads: plain, quiet (nothing special), or in a condition's colour. */
export type FactTone = 'plain' | 'quiet' | 'market' | 'bad'

export interface CardFact {
  /** The row's key (stable: a React key and the test's handle). */
  key: string
  /** Its `.field-k` label. */
  label: string
  /** Its `.field-v` value, one line. */
  value: string
  /** The whole fact in words, for the row's accessible name and tooltip. */
  name: string
  tone: FactTone
  /** The ground's marks (the Ground row). */
  ground?: readonly GroundMark[]
  /** The armour struck mark (the Raiders row): `plated` / `warded`. */
  armour?: string
  /** An atlas mark for the value. */
  icon?: IconKey
  /** An amount of gold, drawn with the coin before the value. */
  gold?: number
}

/** The three rows every company card has, in order. */
export const COMPANY_ROWS = ['ground', 'raiders', 'next'] as const
/** The Buy Company card's three rows, in the same frame. */
export const CHARTER_ROWS = ['ground', 'door', 'pays'] as const
/** The Buy Company card's kicker, where a company's says its goods: what its road carries. */
export const CHARTER_KICKER = 'Every company’s goods'

/** A one-off condition, as a badge at the right of the card's head. */
export interface CardBadge {
  /** Short: it shares the head with the company's name. */
  label: string
  /** The condition in words, for its accessible name and tooltip. */
  name: string
  tone: Exclude<FactTone, 'plain' | 'quiet'>
  icon: IconKey
}

/** What a damage-type mod's goblins let through: the other damage type. */
const answer = (mod: (typeof ENEMY_MODS)[number]): string => (mod.physResist > 0 ? 'magic' : 'steel')

type CardState = {
  company: CompanyId
  /** A first launch (LS3): the free escort. */
  staged: boolean
  /** It hires you. */
  open: boolean
  /** Its place in the trade war this season, or null while the war is not shown. */
  war: { desperate: boolean } | null
  /** The market's multiplier on its goods today (1: not its day, or the market is not shown). */
  market: number
  /** What its track pays next (`track.nextReward`), or null when all is earned. */
  next: NextReward | null
}

export function companyFacts(o: CardState): CardFact[] {
  const co = companyById(o.company)
  const g = groundEffect(co.ground.rules)
  const mod = co.armour ? ENEMY_MODS.find((m) => m.id === co.armour) : undefined
  const raiders: CardFact = mod
    ? {
        key: 'raiders',
        label: 'Raiders',
        value: `Some ${mod.prefix.toLowerCase()} · bring ${answer(mod)}`,
        name: `Raiders: its armoured fights are mostly ${mod.prefix}: ${mod.blurb}`,
        tone: 'plain',
        armour: mod.id,
      }
    : {
        key: 'raiders',
        label: 'Raiders',
        value: 'Plate or wards, evenly',
        name: 'Raiders: its armoured fights are Plated or Warded, evenly',
        tone: 'quiet',
      }
  // Desperate terms make its raiders stronger: said on the Raiders row, where
  // raiders are, and the pay half (the dock's ×1.5) on the head's badge.
  if (o.war?.desperate && !o.staged) {
    const pct = Math.round((DESPERATE_STRENGTH - 1) * 100)
    raiders.value = `+${pct}% · ${raiders.value}`
    raiders.name = `${raiders.name}. Desperate terms: its raiders are ${pct}% stronger`
    raiders.tone = 'bad'
  }
  return [
    { key: 'ground', label: 'Ground', value: g.effect, name: `Ground: ${g.line}`, tone: 'plain', ground: g.marks },
    raiders,
    nextFact(o),
  ]
}

/** The one condition that matters most now, by priority, or null — most days, for most companies. */
export function companyBadge(o: CardState): CardBadge | null {
  // A first launch's CTA already says it: "Take the free escort".
  if (o.staged) return null
  // The badge carries the dock mark's own number, so the two read as one fact.
  if (o.war?.desperate) {
    const pct = Math.round((DESPERATE_STRENGTH - 1) * 100)
    return { label: `Desperate · pays ×${DESPERATE_PAY}`, name: `Desperate terms this season: it pays ×${DESPERATE_PAY}, and its raiders are ${pct}% stronger`, tone: 'bad', icon: 'warn' }
  }
  if (o.market > 1) {
    const noun = companyById(o.company).noun
    return { label: `Market · pays ×${o.market}`, name: `Market day: ${noun} sells for ×${o.market} today`, tone: 'market', icon: 'gold' }
  }
  return null
}

/**
 * What its loyalty track pays at the next standing level, named by kind —
 * "Rep 5 · Skill · Gilt Frame" — with the reward's own mark. The label is the
 * level (the dock says the level you are at), so the row reads as "at Rep 5
 * you get this"; the row opens the track.
 */
function nextFact(o: CardState): CardFact {
  if (!o.open && !o.staged) return { key: 'next', label: 'Track', value: 'Opens once it hires you', name: 'Its loyalty track opens once it hires you', tone: 'quiet' }
  const r = o.next
  if (!r) return { key: 'next', label: 'Track', value: 'All earned', name: 'Its loyalty track: every level earned', tone: 'quiet' }
  const [value, icon]: [string, IconKey] =
    r.kind === 'skill'
      ? [`Skill · ${r.name}`, skillIcon(r.id!)]
      : r.kind === 'item'
        ? [`Item · ${r.name}`, itemKindIcon(r.id!)]
        : r.kind === 'bonus'
          ? [`Rare item · ${r.name}`, itemKindIcon(r.id!)]
          : r.kind === 'stakes'
            ? ['Stakes open', 'coffer']
            : ['A second term', 'crown']
  return { key: 'next', label: `Rep ${r.level}`, value, name: `At Rep ${r.level}, its loyalty track pays: ${value}`, tone: 'plain', icon }
}

const n = (x: number) => x.toLocaleString('en')

/** The Buy Company card's three rows: its ground, the door (or the bank), what it pays. */
export function charterFacts(s: CharterSlot): CardFact[] {
  const g = GROUND_EFFECTS.sovereign
  const door: CardFact = !s.open
    ? {
        key: 'door',
        label: 'Have',
        value: `${s.skills.have}/${s.skills.need} skills · ${s.items.have}/${s.items.need} items`,
        name: `Unlocked so far: ${s.skills.have} of ${s.skills.need} skills and ${s.items.have} of ${s.items.need} items. It opens when every one is unlocked`,
        tone: 'plain',
      }
    : s.short > 0
      ? { key: 'door', label: 'Bank', value: `${n(s.short)} gold short`, name: `Bank: ${n(s.short)} gold short of the ${n(s.fee)} fee`, tone: 'bad' }
      : { key: 'door', label: 'Bank', value: 'Covers the fee', name: `Bank: covers the ${n(s.fee)} fee`, tone: 'plain' }
  return [
    { key: 'ground', label: 'Ground', value: g.effect, name: `Ground: ${g.line}`, tone: 'plain', ground: g.marks },
    door,
    { key: 'pays', label: 'Pays', value: 'on delivery', name: `Pays ${n(CHARTER_PAYOUT)} gold on delivery`, tone: 'plain', gold: CHARTER_PAYOUT },
  ]
}
