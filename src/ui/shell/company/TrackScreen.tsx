import { useMemo, useState, type CSSProperties } from 'react'
import { COMPANY_IDS, companyById, type CompanyId } from '../../../game/data/companies'
import { kitPieceLabel } from '../../../game/data/companyKits'
import type { IconKey } from '../../../game/data/iconAtlas'
import { SIGNATURE_SKILLS, skillById } from '../../../game/data/skills'
import { askStandingFor } from '../../../game/run/asks'
import { crateCap } from '../../../game/run/contracts'
import { companyOpen } from '../../../game/run/standing'
import {
  canSignTerm,
  deliveriesTo,
  deliveriesWord,
  MAX_TERMS,
  shortCompany,
  SIGNATURE_LEVEL,
  termName,
  trackLevel,
  trackPlan,
  trackProgress,
  TRACK_PLAN,
  type TrackPay,
  type TrackRow,
} from '../../../game/run/track'
import { MAX_STANDING } from '../../../game/run/standing'
import { useGameStore } from '../../../state/gameStore'
import { useMetaStore } from '../../../state/metaStore'
import { companyVar, itemKindIcon, skillIcon } from '../../channels'
import { Icon } from '../../Icon'
import { Crest, Lock } from '../../pixel'
import { CodexCard, CodexSheet } from '../codex/CodexScreen'
import { previewEntry, type CodexEntry } from '../codex/codexModel'
import { CompanyFlag, ContractPage } from '../contracts/parts'
import '../../../styles/track.css'

/**
 * A company's loyalty track (Draft 4 · B, mockups B1/B3; the designer: "a
 * visible loyalty track per company … today's random skill per level becomes
 * something you can see coming").
 *
 * One page per company: the five companies as chips across the top (each its
 * crest and your level with it) to switch; the company's dressed standard,
 * its level and a bar; then the ten levels of the term as rows. A row names
 * what that level pays — the card's or item's real name with its icon, the
 * flag piece — as `.field-k` / `.field-v` pairs; an earned row is dimmed with
 * ✓, the next is lit with how far it is ("about 2 deliveries away"). A part
 * that names a card or an item opens its Codex card. The one CTA reads the
 * company's terms — or, at standing 10, signs a second term (a confirm view,
 * mockup B3), with the terms a quiet second button.
 *
 * Everything shown is `run/track.trackPlan`: what the settle will pay.
 */
export function TrackScreen({ company: first, onBack }: { company: CompanyId; onBack: () => void }) {
  const [company, setCompany] = useState<CompanyId>(first)
  const [signing, setSigning] = useState(false)
  const [detail, setDetail] = useState<CodexEntry | null>(null)
  const standing = useMetaStore((s) => s.standing)
  const terms = useMetaStore((s) => s.terms)
  const skills = useMetaStore((s) => s.skills)
  const items = useMetaStore((s) => s.items)
  const look = useMetaStore((s) => s.liveries[company] ?? null)
  const signTerm = useMetaStore((s) => s.signTerm)
  const openContracts = useGameStore((s) => s.openContracts)

  const co = companyById(company)
  const xp = standing[company] ?? 0
  const term = terms?.[company] ?? 1
  const rows = useMemo(() => trackPlan(company, { xp, term, skills, items: items ?? [] }), [company, xp, term, skills, items])
  const prog = trackProgress(xp, term)
  const open = companyOpen(company, standing)
  const sign = canSignTerm(xp, term)
  const name = shortCompany(company)
  const readTerms = () => openContracts({ company })

  if (signing && sign) {
    return (
      <SignTerm
        company={company}
        onBack={() => setSigning(false)}
        onSign={() => {
          if (signTerm(company)) setSigning(false)
        }}
      />
    )
  }

  const sub = !open
    ? `Opens at Standing ${co.opensAt ?? 1} with any company`
    : prog.max
      ? term < MAX_TERMS
        ? 'Standing 10 · a second term is offered'
        : `${termName(term)} complete`
      : term > 1
        ? `${(prog.need - prog.into).toLocaleString('en')} standing to level ${prog.standing + 1}`
        : `${co.goods} road · ${(prog.need - prog.into).toLocaleString('en')} standing to ${prog.standing + 1}`

  return (
    <ContractPage
      className="tk"
      label={`Standing with ${co.name}`}
      head={
        <div className="ct-hdr tk-head">
          <button className="ct-back" onClick={onBack} aria-label="Back to the menu">
            <Icon name="back" />
          </button>
          <h1 className="ct-title" tabIndex={-1}>
            Standing
          </h1>
        </div>
      }
      cta={
        sign
          ? { label: 'Sign a second term', run: () => setSigning(true), heavy: true }
          : open
            ? { label: `Read ${name}’s terms`, run: readTerms, heavy: true }
            : { label: `Opens at Standing ${co.opensAt ?? 1}`, run: () => {}, disabled: true }
      }
      foot={
        sign ? (
          <div className="pg-dual">
            <button className="pg-dual-btn" onClick={readTerms}>
              Read {name}’s terms
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="tk-chips" role="group" aria-label="Companies">
        {COMPANY_IDS.map((c) => {
          const cOpen = companyOpen(c, standing)
          const t = terms?.[c] ?? 1
          const lv = trackLevel(standing[c] ?? 0, t)
          return (
            <button
              key={c}
              type="button"
              className={`tk-chip${c === company ? ' on' : ''}`}
              style={{ '--co': companyVar(c) } as CSSProperties}
              aria-pressed={c === company}
              aria-label={`${companyById(c).name}: ${cOpen ? `${t > 1 ? `${termName(t)}, level` : 'standing'} ${lv}` : 'not hiring yet'}`}
              onClick={() => (setCompany(c), setDetail(null))}
            >
              <Crest company={c} scale={1} locked={!cOpen} />
              <b aria-hidden="true">{cOpen ? lv : <Lock scale={1} />}</b>
            </button>
          )
        })}
      </div>

      <section className="tk-card" style={{ '--co': companyVar(company) } as CSSProperties} aria-label={`${co.name}: ${sub}`}>
        <CompanyFlag company={company} look={look} locked={!open} />
        <span className="tk-card-id">
          <h2 className="tk-card-name">{co.name}</h2>
          <span className="tk-card-sub">{sub}</span>
        </span>
        <span className="tk-card-lv" aria-hidden="true">
          {term > 1 && <small>{termName(term)}</small>}
          {prog.standing}
        </span>
        <span className="tk-bar" aria-hidden="true">
          <i style={{ width: `${prog.max ? 100 : (prog.into / prog.need) * 100}%` }} />
        </span>
      </section>

      <ol className="tk-rows" aria-label={`${co.name}’s track${term > 1 ? `, ${termName(term)}` : ''}`}>
        {rows.map((r) => (
          <Row key={`${company}-${term}-${r.pay.level}`} row={r} open={open} xp={xp} owned={skills} onOpen={setDetail} />
        ))}
      </ol>

      {detail && (
        <CodexSheet label={detail.name} onClose={() => setDetail(null)}>
          <CodexCard e={detail} entries={[detail]} onStep={() => {}} onClose={() => setDetail(null)} />
        </CodexSheet>
      )}
    </ContractPage>
  )
}

/** One part of a row: what it is (`.field-k`) and its name (`.field-v`), a tap from its card when it has one. */
interface Part {
  icon: IconKey
  k: string
  v?: string
  open?: CodexEntry | null
}

function Row({ row, open, xp, owned, onOpen }: { row: TrackRow; open: boolean; xp: number; owned: readonly string[]; onOpen: (e: CodexEntry) => void }) {
  const { pay, earned, next } = row
  const parts = partsOf(pay, earned, owned)
  const away = next && open ? deliveriesTo(xp, pay.term, pay.level) : 0
  const said = parts.map((p) => (p.v ? `${p.k}: ${p.v}` : p.k)).join('; ')
  return (
    <li
      className={`tk-row${earned ? ' earned' : ''}${next ? ' next' : ''}`}
      aria-label={`Level ${pay.level}${earned ? ', earned' : next ? ', next' : ''}. ${said}${away ? `. ${deliveriesWord(away)}` : ''}`}
    >
      <span className="tk-lv" aria-hidden="true">
        {pay.level}
      </span>
      <span className="tk-parts">
        {parts.map((p) =>
          p.open ? (
            <button key={p.k} type="button" className="tk-part is-open" onClick={() => onOpen(p.open!)} aria-label={`${p.k}: ${p.v}. Open its card`}>
              <Icon name={p.icon} />
              <span className="field-k">{p.k}</span>
              {p.v && <span className="field-v">{p.v}</span>}
            </button>
          ) : (
            <span key={p.k} className="tk-part" aria-hidden="true">
              <Icon name={p.icon} />
              <span className="field-k">{p.k}</span>
              {p.v && <span className="field-v">{p.v}</span>}
            </span>
          ),
        )}
        {next && open && (
          <span className="tk-next" aria-hidden="true">
            Next · {deliveriesWord(away)}
          </span>
        )}
      </span>
      {earned && (
        <span className="tk-check" aria-hidden="true">
          ✓
        </span>
      )}
    </li>
  )
}


/**
 * What a row says. A level still ahead names exactly what it will pay; an
 * earned one names its fixed parts (the flag piece, the signature skill, the
 * Sovereign item named) and, for a card or a kind, only what kind of reward
 * its place on the track pays — what an earned level paid is not kept.
 */
function partsOf(pay: TrackPay, earned: boolean, owned: readonly string[]): Part[] {
  const co = companyById(pay.company)
  const at = `${pay.term > 1 ? `${termName(pay.term)} level` : 'Standing'} ${pay.level} with ${co.name}`
  const skill = (id: string) => previewEntry('skill', id, owned.includes(id) ? 'Yours.' : `${at} unlocks it.`)
  const out: Part[] = []
  if (earned) {
    const sig = SIGNATURE_SKILLS[pay.company]
    const step = pay.term > 1 ? 'bonus' : TRACK_PLAN[pay.level - 1]
    if (step === 'card' || step === 'cardSovereign') out.push({ icon: 'boon', k: 'Skill card' })
    if (step === 'signature')
      out.push(owned.includes(sig) ? { icon: skillIcon(sig), k: 'Signature skill', v: skillById(sig)?.name, open: skill(sig) } : { icon: 'boon', k: 'Skill card' })
    if (step === 'item') out.push({ icon: 'equip', k: 'Item' })
    if (step === 'bonus') out.push({ icon: 'loot', k: 'Rare bonus item' })
  } else {
    if (pay.card) out.push({ icon: skillIcon(pay.card), k: 'Skill card', v: skillById(pay.card)?.name, open: skill(pay.card) })
    if (pay.signature) out.push({ icon: skillIcon(pay.signature), k: 'Signature skill', v: skillById(pay.signature)?.name, open: skill(pay.signature) })
    if (pay.item) out.push({ icon: itemKindIcon(pay.item), k: 'Item', v: pay.item, open: previewEntry('item', pay.item, `${at} unlocks it.`) })
    if (pay.bonus)
      out.push({ icon: itemKindIcon(pay.bonus), k: 'Rare bonus item', v: pay.bonus, open: previewEntry('item', pay.bonus, `${at} pays a Rare one for the next contract.`) })
  }
  if (pay.stakes) out.push({ icon: 'coffer', k: 'Stakes', v: 'Open on its road' })
  if (pay.secondTerm) out.push({ icon: 'crown', k: 'Second term', v: 'Asks pay double' })
  if (pay.named)
    out.push({
      icon: itemKindIcon(pay.named),
      k: 'Sovereign item',
      v: pay.named,
      open: previewEntry('item', pay.named, `Named at ${at}. A delivered Sovereign Route unlocks it.`),
    })
  if (pay.flag) out.push({ icon: 'banner', k: 'Flag', v: kitPieceLabel(pay.flag) })
  return out
}

/**
 * Signing a second term (mockup B3): what starts again, what is kept, and the
 * consequence on the crest. Back changes nothing; the CTA signs.
 */
function SignTerm({ company, onBack, onSign }: { company: CompanyId; onBack: () => void; onSign: () => void }) {
  const co = companyById(company)
  const name = shortCompany(company)
  const skills = useMetaStore((s) => s.skills)
  const signature = SIGNATURE_SKILLS[company]
  const sig = skillById(signature)
  const hasSig = skills.includes(signature)
  return (
    <ContractPage
      className="tk tk-sign"
      label="A second term"
      head={
        <div className="ct-hdr tk-head">
          <button className="ct-back" onClick={onBack} aria-label="Back, without signing">
            <Icon name="back" />
          </button>
          <h1 className="ct-title" tabIndex={-1}>
            A second term
          </h1>
        </div>
      }
      cta={{ label: 'Sign the second term', run: onSign, heavy: true }}
    >
      <div className="tk-sign-crest" style={{ '--co': companyVar(company) } as CSSProperties} aria-hidden="true">
        <Crest company={company} scale={6} />
      </div>
      <section className="tk-list" aria-label="Starts again">
        <span className="field-k">Starts again</span>
        <p>
          <Icon name="crown" /> The track, 1 to 10, a Rare bonus item at every level
        </p>
        {sig && !hasSig && (
          <p>
            <Icon name={skillIcon(signature)} /> Its signature skill, {sig.name}, at level {SIGNATURE_LEVEL}
          </p>
        )}
        <p>
          <Icon name="company" /> {name}’s asks pay double standing: +{askStandingFor(2)} each
        </p>
      </section>
      <section className="tk-list" aria-label="You keep">
        <span className="field-k">You keep</span>
        {sig && hasSig && (
          <p>
            <Icon name={skillIcon(signature)} /> {sig.name}, its signature skill
          </p>
        )}
        <p>
          <Icon name="coffer" /> Stakes up to {crateCap(MAX_STANDING)} crates on its road
        </p>
        <p>
          <Icon name="banner" /> Every piece of its flag, as you dressed it
        </p>
      </section>
      <p className="tk-note">Signing puts a gold rim on {co.name}’s crest.</p>
    </ContractPage>
  )
}
