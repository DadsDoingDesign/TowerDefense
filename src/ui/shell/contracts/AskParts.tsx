import type { CSSProperties } from 'react'
import { companyById, type CompanyId } from '../../../game/data/companies'
import {
  askStandingFor,
  ASK_TIP,
  askById,
  askGot,
  askGotText,
  askProgressText,
  askText,
  type AskDef,
  type AskFacts,
  type AskResult,
  type AskStat,
  type RunAsk,
} from '../../../game/run/asks'
import { companyVar, SOVEREIGN_VAR, type IconKey } from '../../channels'
import { Icon } from '../../Icon'
import { Crest } from '../../pixel'
import { Gold } from './parts'
import { useMetaStore } from '../../../state/metaStore'

/**
 * What a company asks of the road (Draft 4 · A, `game/run/asks.ts`), in the
 * three places the asks are read: the terms (what is asked, and what each
 * pays), the run's route panel (each ask's count), and the receipt (what was
 * met). Each ask says what it wants and nothing else — never why, never the
 * combo it rewards.
 */

/**
 * What one ask pays when it is met: standing with its company — double once a
 * second term is signed with it (Draft 4 · B) — and the destination's tip.
 */
function AskPay({ company, tip = true }: { company: CompanyId; tip?: boolean }) {
  const standing = askStandingFor(useMetaStore((s) => s.terms?.[company] ?? 1))
  return (
    <span className="ask-pay" aria-label={`+${standing} standing${tip ? `, ${ASK_TIP} gold` : ''}`}>
      <b>+{standing} standing</b>
      {tip && <Gold n={ASK_TIP} />}
    </span>
  )
}

/**
 * "Ironvein asks" on the terms and "What Ironvein asked" on the receipt — or,
 * on the Sovereign Route, where each ask is another company's, "the companies".
 */
const whoAsks = (company: CompanyId | null, verb: 'asks' | 'asked'): string => {
  const who = company ? companyById(company).name : verb === 'asks' ? 'The companies' : 'the companies'
  return verb === 'asks' ? `${who} ${company ? 'asks' : 'ask'}` : `What ${who} asked`
}

/**
 * The terms' panel: the asks this contract will be dealt (`asks.dealAsks` on
 * the seed it will be signed with), each with what it pays.
 */
export function AskTerms({ company, asks }: { company: CompanyId; asks: readonly AskDef[] }) {
  if (!asks.length) return null
  return (
    <section className="ask-panel" style={{ '--co': companyVar(company) } as CSSProperties} aria-label={whoAsks(company, 'asks')}>
      <p className="ask-head">
        <Crest company={company} scale={1} />
        <span className="field-k">{whoAsks(company, 'asks')}</span>
      </p>
      <ul className="ask-rows">
        {asks.map((a) => (
          <li key={a.id} className="ask-row">
            <b className="ask-text">{a.text(a.target)}</b>
            <AskPay company={a.company} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Where one ask stands on the road: its count now, whether that met it, how far along. */
interface AskNow {
  ask: RunAsk
  def: AskDef
  got: number
  met: boolean
  frac: number
}

const askNow = (asks: readonly RunAsk[], facts: AskFacts, cargo: number): AskNow[] =>
  asks.flatMap((a) => {
    const def = askById(a.id)
    if (!def) return []
    const got = askGot(a, facts, cargo)
    return [{ ask: a, def, got, met: !def.atEnd && got >= a.target, frac: Math.max(0, Math.min(1, got / Math.max(1, a.target))) }]
  })

/** One ask as a sentence for a screen reader: "Win 7 fights without a leak: 0/7" — never cut to fit. */
const askSaid = ({ ask, def, got, met }: AskNow, dest: string): string =>
  `${askText(ask)}: ${met ? 'met' : askProgressText(ask, got)}${def.atEnd ? `, judged at ${dest}` : ''}`

/** Every ask as one sentence: the route panel's accessible name for its asks. */
export const asksSaid = (asks: readonly RunAsk[], facts: AskFacts, cargo: number, dest: string): string =>
  askNow(asks, facts, cargo)
    .map((n) => askSaid(n, dest))
    .join('; ')

/** Each stat's mark on its chip: the atlas cell the rest of the game draws that thing with. */
const ASK_ICON: Record<AskStat, IconKey> = {
  kills: 'battle',
  burnKills: 'burn',
  platedKills: 'plate',
  wardedKills: 'auraShield',
  cleanFights: 'block',
  cleanCities: 'boss',
  eliteWins: 'elite',
  wares: 'merchant',
  pacts: 'shrine',
  earned: 'gold',
  cargo: 'base',
  roadGold: 'coffer',
}

/** "1,480/3,900" is too long for a chip: gold counts shorten to "1.4k/3.9k". */
const short = (n: number): string => (n < 1000 ? String(n) : `${Math.floor(n / 100) / 10}k`)
const chipCount = (a: RunAsk, def: AskDef, got: number): string =>
  def.stat === 'roadGold' || def.stat === 'earned' ? `${short(Math.max(0, Math.floor(got)))}/${short(a.target)}` : askProgressText(a, got)

/**
 * The route panel's collapsed asks (the map-header pass, Oct 2026; the
 * designer: "the quests are cluttering space"): one small chip an ask — its
 * stat's mark, its count, and a two-pixel progress mark under it; ✓ once met.
 * Decorative: the panel's button says every ask in full (`asksSaid`), and the
 * full rows open under the road on a tap (`AskProgress`).
 */
export function AskChips({ asks, facts, cargo }: { asks: readonly RunAsk[]; facts: AskFacts; cargo: number }) {
  const now = askNow(asks, facts, cargo)
  if (!now.length) return null
  return (
    <span className="ask-chips" aria-hidden="true">
      {now.map(({ ask, def, got, met, frac }) => (
        <span key={ask.id} className={`ask-chip${met ? ' met' : ''}`} style={{ '--co': companyVar(def.company) } as CSSProperties}>
          <Icon name={ASK_ICON[def.stat]} />
          <b>{met ? '✓' : chipCount(ask, def, got)}</b>
          <span className="ask-chip-mark">
            <i style={{ width: `${frac * 100}%` }} />
          </span>
        </span>
      ))}
    </span>
  )
}

/**
 * The run's route panel, opened: each ask's count against its target — a bar,
 * the count, and a tick once it is met. An ask judged at the end shows where
 * it stands now (the cargo the wagons carry, the road's gold in hand).
 */
export function AskProgress({ asks, facts, cargo, charter, dest }: { asks: readonly RunAsk[]; facts: AskFacts; cargo: number; charter: boolean; dest: string }) {
  if (!asks.length) return null
  return (
    <ul className="ask-track" aria-label="What the road is asked">
      {askNow(asks, facts, cargo).map((n) => {
        const { ask: a, def, got, met, frac } = n
        return (
          <li
            key={a.id}
            className={`ask-track-row${met ? ' met' : ''}`}
            style={{ '--co': companyVar(def.company) } as CSSProperties}
            aria-label={askSaid(n, dest)}
          >
            {charter && <Crest company={def.company} scale={1} />}
            {/* An ask judged at the end says where: what it reads now is not yet met. */}
            <span className="ask-track-k">{def.atEnd ? `${def.label} at ${dest}` : def.label}</span>
            <span className="ask-bar" aria-hidden="true">
              <i style={{ width: `${frac * 100}%` }} />
            </span>
            <b className="ask-track-v" aria-hidden="true">
              {met ? '✓' : askProgressText(a, got)}
            </b>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The receipt's "What Ironvein asked": every ask, ✓ met or ✕ not, with what
 * the count reached and what a met one paid (its tip only on a delivery).
 */
export function AskReceipt({ company, results, delivered, unranked }: { company: CompanyId | null; results: readonly AskResult[]; delivered: boolean; unranked: boolean }) {
  if (!results.length) return null
  return (
    <section className="ask-panel" style={{ '--co': company ? companyVar(company) : SOVEREIGN_VAR } as CSSProperties} aria-label={whoAsks(company, 'asked')}>
      <p className="ask-head">
        {company && <Crest company={company} scale={1} />}
        <span className="field-k">{whoAsks(company, 'asked')}</span>
      </p>
      <ul className="ask-rows">
        {results.map((r) => (
          <li key={r.id} className={`ask-row${r.met ? ' met' : ' missed'}`}>
            <span className="ask-tick" aria-label={r.met ? 'Met' : 'Not met'}>
              {r.met ? '✓' : '✕'}
            </span>
            <span className="ask-what">
              <b className="ask-text">
                {!company && <Crest company={r.company} scale={1} />}
                {askText(r)}
              </b>
              <small>{askGotText(r, r.got)}</small>
            </span>
            {r.met && !unranked ? <AskPay company={r.company} tip={delivered} /> : <span className="ask-none" aria-hidden="true">—</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
