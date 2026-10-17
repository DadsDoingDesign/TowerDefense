import type { CSSProperties } from 'react'
import { skillById, skillLevelLabel } from '../../game/data/skills'
import { itemKindById, kindEffect, kindSlot } from '../../game/data/itemKinds'
import { companyById, type CompanyId } from '../../game/data/companies'
import { kitPieceLabel, kitPiecesBetween } from '../../game/data/companyKits'
import { contractFloor, MAX_STANDING } from '../../game/run/standing'
import { crateCap, STAKES_OPEN_AT } from '../../game/run/contracts'
import { MAX_TERMS, termName, trackProgress, type TrackPay } from '../../game/run/track'
import type { RunProgress } from '../../state/metaStore'
import { useGameStore } from '../../state/gameStore'
import { useTrackLink } from './company/trackLink'
import { useMetaStore } from '../../state/metaStore'
import { companyVar } from '../channels'
import { Crest } from '../pixel'
import { SkillCard } from './SkillCards'
import { uiTheme } from '../theme/companyThemes'

/**
 * What a finished contract did for the long game, on its receipt: every skill
 * card and item kind it unlocked — each as the card itself, labelled by what
 * paid for it (the contract, a stake milestone, a standing level) — and the
 * standing it earned with the company. Each card says only what IT does.
 *
 * October 2026: a standing level past the card pool pays a Rare bonus item for
 * the next contract, shown here as its own card, and the Sovereign Route's
 * standing is shown for all five companies.
 *
 * Draft 4 · B: the standing levels' rewards are the company's loyalty track
 * (`run/track.ts`) — each level's card, signature skill, kind, bonus item or
 * Sovereign item named, listed under the company's name (one block per
 * company on the Sovereign Route). The standing card opens that track.
 */

export function UnlocksEarned({ progress: p, crates }: { progress: RunProgress; crates: number }) {
  const skills = p.contractCards
    .map((id, i) => ({ id, kicker: i === 0 ? 'Contract' : 'Stake milestone' }))
    .map((x) => ({ ...x, k: skillById(x.id) }))
    .filter((x) => !!x.k)
  const kinds = p.items.map((id, i) => ({ id, kicker: i === 0 ? 'Contract' : 'Item chance', k: itemKindById(id) })).filter((x) => !!x.k)
  // Draft 4 · B: what each track level crossed paid, company by company.
  const track = (p.track ?? []).filter((t) => t.card || t.signature || t.item || t.bonus || t.named || t.theme)
  const n = skills.length + kinds.length
  if (!n && !track.length) return null
  const floor = contractFloor(crates)
  const names = [...skills.map((x) => x.k!.name), ...kinds.map((x) => x.id), ...track.flatMap(trackNames)]
  const companies = [...new Set(track.map((t) => t.company))]
  return (
    <section className="pg-unlocks" aria-label={`${names.length} new unlock${names.length === 1 ? '' : 's'}: ${names.join(', ')}`}>
      {kinds.length > 0 && <p className="ct-eyebrow left">{kinds.length === 1 ? 'New item unlocked' : `${kinds.length} items unlocked`}</p>}
      {kinds.map((x) => (
        <SkillCard key={x.id} kicker={x.kicker} skill={{ name: x.id, level: `${kindSlot(x.k!)} · Level ${x.k!.level}`, text: kindEffect(x.k!) }} />
      ))}
      {kinds.length > 0 && floor > 1 && (
        <p className="pg-unlocks-note">
          Your {crates} crates raised the floor: Level {floor} and up, while any are left.
        </p>
      )}
      {skills.length > 0 && <p className="ct-eyebrow left">{skills.length === 1 ? 'New skill unlocked' : `${skills.length} skills unlocked`}</p>}
      {skills.map((x) => (
        <SkillCard key={`${x.kicker}-${x.id}`} kicker={x.kicker} skill={{ name: x.k!.name, level: skillLevelLabel(x.k!.level), text: x.k!.desc }} />
      ))}
      {companies.map((c) => (
        <TrackEarned key={c} company={c} pays={track.filter((t) => t.company === c)} />
      ))}
      {(n > 0 || track.some((t) => t.card || t.signature || t.item)) && <p className="pg-unlocks-note">Your next heroes, loot and offers can include them.</p>}
    </section>
  )
}

/** A track level as its kicker says it: "Standing 4", "Term II · 3". */
const levelWord = (t: TrackPay) => (t.term > 1 ? `${termName(t.term)} · ${t.level}` : `Standing ${t.level}`)

const trackNames = (t: TrackPay): string[] =>
  [
    t.card && skillById(t.card)?.name,
    t.signature && skillById(t.signature)?.name,
    t.item,
    t.bonus && `a Rare ${t.bonus} for your next contract`,
    t.named && `${t.named} named`,
    t.theme && `the ${uiTheme(t.company).name} theme`,
  ].filter((x): x is string => !!x)

/**
 * One company's track levels on the receipt (Draft 4 · B): under its name,
 * each level's reward as its card, kicked by the level that paid it — the
 * card, the signature skill, the kind, the Rare bonus item owed to the next
 * contract, and the Sovereign item a level 9 names. On the Sovereign Route
 * each company that moved gets its own.
 */
function TrackEarned({ company, pays }: { company: CompanyId; pays: TrackPay[] }) {
  const co = companyById(company)
  return (
    <>
      <p className="ct-eyebrow left" style={{ '--co': companyVar(company) } as CSSProperties}>
        {co.name}’s track
      </p>
      {pays.flatMap((t) => {
        const out = []
        const kicker = levelWord(t)
        for (const id of [t.card, t.signature]) {
          const k = id ? skillById(id) : undefined
          if (k)
            out.push(
              <SkillCard key={`${t.level}-${k.id}`} kicker={k.signature ? `${kicker} · signature` : kicker} skill={{ name: k.name, level: skillLevelLabel(k.level), text: k.desc }} />,
            )
        }
        const kind = t.item ? itemKindById(t.item) : undefined
        if (kind) out.push(<SkillCard key={`${t.level}-${kind.id}`} kicker={kicker} skill={{ name: kind.id, level: `${kindSlot(kind)} · Level ${kind.level}`, text: kindEffect(kind) }} />)
        const bonus = t.bonus ? itemKindById(t.bonus) : undefined
        if (bonus)
          out.push(
            <SkillCard
              key={`${t.level}-bonus`}
              kicker={kicker}
              skill={{ name: `Rare ${bonus.id}`, level: `${kindSlot(bonus)} · Rare bonus item`, text: `A Rare ${bonus.id} rides with your next contract.` }}
            />,
          )
        const named = t.named ? itemKindById(t.named) : undefined
        if (named)
          out.push(
            <SkillCard
              key={`${t.level}-named`}
              kicker={`${kicker} · named`}
              skill={{ name: named.id, level: `${kindSlot(named)} · Sovereign`, text: `${kindEffect(named)} Unlocks with a delivered Sovereign Route.` }}
            />,
          )
        // The company's UI theme for your militia's own road (`run/militiaTheme.ts`).
        if (t.theme)
          out.push(
            <SkillCard
              key={`${t.level}-theme`}
              kicker={`${kicker} · theme`}
              skill={{ name: uiTheme(company).name, level: 'UI theme', text: `${co.name}’s colours for your militia’s road. Pick it in the flag builder.` }}
            />,
          )
        return out
      })}
    </>
  )
}

/** The company's standing after the settle: the crest, the level, and what the next one opens — a tap from its track. */
export function StandingEarned({ progress: p }: { progress: RunProgress }) {
  const xp = useMetaStore((s) => (p.company ? (s.standing[p.company] ?? 0) : 0))
  const returnToHub = useGameStore((s) => s.returnToHub)
  if (p.standingAll?.length) return <StandingAllEarned progress={p} />
  if (!p.company) return null
  const company = p.company
  const co = companyById(company)
  const span = (p.spans ?? []).find((s) => s.company === company)
  const term = span?.term ?? 1
  const before = span ? span.before : p.standingBefore
  const after = span ? span.after : p.standingAfter
  const prog = trackProgress(xp, term)
  const up = after > before
  const lv = term > 1 ? `${termName(term)} · ${after}` : `Standing ${after}`
  // The level is said once, by the big number (which also shows a move,
  // "2→3"): the head names what it counts.
  const counts = term > 1 ? termName(term) : 'Standing'
  // The asks met paid their part of it (Draft 4 · A).
  const gained = `+${p.xp} standing XP${p.askXp ? `, ${p.askXp} from ${(p.asks ?? []).filter((a) => a.met).length === 1 ? 'its ask' : 'its asks'}` : ''}`
  const line = p.unranked
    ? 'A custom seed earns no standing.'
    : prog.max
      ? term < MAX_TERMS
        ? `${gained}. Standing 10: a second term is offered.`
        : `${gained}. ${termName(term)} is complete.`
      : up && term === 1 && after < STAKES_OPEN_AT
        ? `${gained}. Stakes open at Standing ${STAKES_OPEN_AT}.`
        : up && term === 1 && before < STAKES_OPEN_AT
          ? `${gained}. Stakes are open on its road: up to ${crateCap(after)} crates.`
          : `${gained} · ${(prog.need - prog.into).toLocaleString('en')} to ${term > 1 ? 'level' : 'Standing'} ${Math.min(MAX_STANDING, prog.standing + 1)}`
  const openTrack = () => {
    useTrackLink.getState().open(company)
    returnToHub()
  }
  return (
    <>
      <button type="button" className="ct-stand ct-stand-btn" style={{ '--co': companyVar(company) } as CSSProperties} onClick={openTrack} aria-label={`${co.name} · ${lv}. ${line} Open its track`}>
        <Crest company={company} />
        <span className="ct-stand-text" aria-hidden="true">
          <b>
            {co.name} · {counts}
          </b>
          <span>{line}</span>
        </span>
        <span className="ct-stand-lv" aria-hidden="true">
          {up ? `${before}→${after}` : after}
        </span>
        <span className="ct-stand-go" aria-hidden="true">
          ›
        </span>
      </button>
      <FlagEarned gains={[{ company, before: p.standingBefore, after: p.standingAfter }]} />
    </>
  )
}

/**
 * The flag pieces a settle's standing levels earned (Draft 4 § C): one line
 * per company, "Ironvein flag · Cobalt, Battled cut" — the piece is waiting
 * in its livery (and, once the Sovereign Route opens, in your militia's
 * builder). A line, never a modal.
 */
export function FlagEarned({ gains }: { gains: { company: CompanyId; before: number; after: number }[] }) {
  const lines = gains.map((g) => ({ company: g.company, pieces: kitPiecesBetween(g.company, g.before, g.after) })).filter((l) => l.pieces.length > 0)
  if (!lines.length) return null
  return (
    <div className="ct-flag-earned">
      {lines.map((l) => {
        const co = companyById(l.company)
        const what = l.pieces.map((x) => kitPieceLabel(x.piece)).join(', ')
        return (
          <p key={l.company} className="ct-flag-line" style={{ '--co': companyVar(l.company) } as CSSProperties} aria-label={`${co.name} flag: ${what}`}>
            <span className="field-k" aria-hidden="true">
              {co.name.replace(/ Co\.$/, '')} flag
            </span>
            <span className="field-v" aria-hidden="true">
              {what}
            </span>
          </p>
        )
      })}
    </div>
  )
}

/**
 * The Sovereign Route's standing (October 2026): the road is every company's,
 * so it earns the same XP with all five — one line, then each company's level.
 */
function StandingAllEarned({ progress: p }: { progress: RunProgress }) {
  const all = p.standingAll ?? []
  const returnToHub = useGameStore((s) => s.returnToHub)
  const openTrack = (c: CompanyId) => {
    useTrackLink.getState().open(c)
    returnToHub()
  }
  return (
    <section className="ct-stand-all" aria-label={`+${p.xp} standing XP with all five companies`}>
      <p className="ct-eyebrow left">+{p.xp} standing XP with all five companies</p>
      <div className="ct-stand-five">
        {all.map((s) => {
          const co = companyById(s.company)
          const up = s.after > s.before
          return (
            <button
              type="button"
              key={s.company}
              className={`ct-stand-chip${up ? ' up' : ''}`}
              style={{ '--co': companyVar(s.company) } as CSSProperties}
              onClick={() => openTrack(s.company)}
              aria-label={`${up ? `${co.name}: Standing ${s.before} to ${s.after}` : `${co.name}: Standing ${s.after}`}. Open its track`}
            >
              <Crest company={s.company} scale={1} />
              <b aria-hidden="true">{up ? `${s.before}→${s.after}` : s.after}</b>
            </button>
          )
        })}
      </div>
      <FlagEarned gains={all} />
    </section>
  )
}
