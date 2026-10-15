/**
 * The home's card (October 2026, the map-first home) — the PURE half: a FIXED
 * FORM. The designer, picking from company to company: "this pushes the other
 * label out so then it wraps another line … keep UI sections responsive but
 * also not wiggling around between every selection". The card used to be a
 * row of chips, as many as the company had facts, so it wrapped and changed
 * height on every pick, and the dock and the map moved with it.
 *
 * Now every company's card is the same four rows, in the same places — only
 * the values change — and the Buy Company card is four rows in the same frame:
 *
 *  - **Ground** — what the road's ground DOES to the field, with its marks
 *    (`terrain.GROUND_EFFECTS`), not its place-name;
 *  - **Raiders** — the armour its armoured fights lean to and the damage that
 *    goes through it, or "Plate or wards, evenly";
 *  - **Today** — ONE reserved slot for the condition that matters most now
 *    (desperate terms, the market of the day; the free escort
 *    on a first launch), and "Usual terms" when none does — the row is always
 *    there. The dock's slot marks carry the rest, and every one is in the
 *    slot's name;
 *  - **Next** — what the track pays next (the way into the track).
 *
 * Each row is one line (`.field-k` / `.field-v`), shortened in place at a
 * narrow width, never wrapped. `tests/homeCard.test.ts` pins the form.
 */
import { companyById, type CompanyId } from '../../game/data/companies'
import { ENEMY_MODS } from '../../game/data/enemies'
import { GROUND_EFFECTS, groundEffect, type GroundMark } from '../../game/data/terrain'
import { CHARTER_PAYOUT } from '../../game/run/charter'
import { DESPERATE_STRENGTH } from '../../game/run/tradeWar'
import type { IconKey } from '../channels'
import type { CharterSlot } from './homeDock'

/** How a value reads: plain, quiet (nothing special), or in a condition's colour. */
export type FactTone = 'plain' | 'quiet' | 'market' | 'bad' | 'free'

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

/** The four rows every company card has, in order. */
export const COMPANY_ROWS = ['ground', 'raiders', 'today', 'next'] as const
/** The Buy Company card's four rows, in the same frame. */
export const CHARTER_ROWS = ['road', 'ground', 'door', 'pays'] as const

/** What a damage-type mod's goblins let through: the other damage type. */
const answer = (mod: (typeof ENEMY_MODS)[number]): string => (mod.physResist > 0 ? 'magic' : 'steel')

export function companyFacts(o: {
  company: CompanyId
  /** A first launch (LS3): the free escort. */
  staged: boolean
  /** It hires you. */
  open: boolean
  /** Its place in the trade war this season, or null while the war is not shown. */
  war: { desperate: boolean } | null
  /** The market's multiplier on its goods today (1: not its day, or the market is not shown). */
  market: number
  /** What its track pays next, by name (`track.nextRewardWord`), or null when all is earned. */
  next: string | null
}): CardFact[] {
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
  return [
    { key: 'ground', label: 'Ground', value: g.effect, name: `Ground: ${g.line}`, tone: 'plain', ground: g.marks },
    raiders,
    todayFact(o, co.noun),
    nextFact(o),
  ]
}

/** The Today row: the one condition that matters most now, or "Usual terms". */
function todayFact(o: Parameters<typeof companyFacts>[0], noun: string): CardFact {
  const at = (value: string, tone: FactTone, icon: IconKey | undefined, name = value): CardFact => ({ key: 'today', label: 'Today', value, name: `Today: ${name}`, tone, icon })
  if (o.staged) return at('Free escort · paid at every city', 'free', 'gold')
  const w = o.war
  if (w?.desperate) {
    const pct = Math.round((DESPERATE_STRENGTH - 1) * 100)
    return at(`Desperate: raiders +${pct}%`, 'bad', 'warn', `desperate terms this season: its raiders are ${pct}% stronger`)
  }
  if (o.market > 1) return at(`Top price for ${noun} ×${o.market}`, 'market', 'gold', `the market pays ×${o.market} for ${noun} today`)
  return at('Usual terms', 'quiet', undefined, 'usual terms, nothing special')
}

function nextFact(o: Parameters<typeof companyFacts>[0]): CardFact {
  if (!o.open && !o.staged) return { key: 'next', label: 'Next', value: 'Not hiring yet', name: 'Next: its track opens once it hires you', tone: 'quiet' }
  const v = o.next ?? 'All earned'
  return { key: 'next', label: 'Next', value: v, name: `Next on its track: ${v}`, tone: o.next ? 'plain' : 'quiet' }
}

const n = (x: number) => x.toLocaleString('en')

/** The Buy Company card's four rows: what the road is, its ground, the door (or the bank), what it pays. */
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
    { key: 'road', label: 'Road', value: 'Every company’s goods', name: 'Road: your own, carrying every company’s goods', tone: 'plain' },
    { key: 'ground', label: 'Ground', value: g.effect, name: `Ground: ${g.line}`, tone: 'plain', ground: g.marks },
    door,
    { key: 'pays', label: 'Pays', value: 'on delivery', name: `Pays ${n(CHARTER_PAYOUT)} gold on delivery`, tone: 'plain', gold: CHARTER_PAYOUT },
  ]
}
