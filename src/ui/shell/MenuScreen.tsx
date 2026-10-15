import { useMilitia } from './useMilitia'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { COMPANY_IDS, companyById, FIRST_COMPANY, type CompanyId } from '../../game/data/companies'
import { CHARGES, DEFAULT_BANNER } from '../../game/data/banner'
import type { StandardLook } from '../../game/data/companyStandard'
import { MARKET_MULT, marketOfDay, utcDateKey } from '../../game/run/contracts'
import { companyOpen, standingOf } from '../../game/run/standing'
import { nextRewardWord, trackPlan } from '../../game/run/track'
import { CHARTER_FEE, CHARTER_NAME, charterDoor } from '../../game/run/charter'
import { contractsLeft, DESPERATE_STRENGTH, exclusiveXpMult, isCold, seasonCrateCap } from '../../game/run/tradeWar'
import { useGameStore } from '../../state/gameStore'
import { homeCompany } from '../../state/game/contractSlice'
import { useMetaStore } from '../../state/metaStore'
import { useSettingsStore } from '../../state/settingsStore'
import { Icon } from '../Icon'
import { ArmourMark } from '../ArmourMark'
import { ENEMY_MODS } from '../../game/data/enemies'
import { Banner, Crest, Crown, Lock, Pixel, SovereignCrest } from '../pixel'
import { Tap, useMedia } from '../pointer'
import { UpdateNotice } from '../UpdateNotice'
import markUrl from '../../assets/brand/mark.svg'
import { TradeMap } from '../attract/TradeMap'
import { roadViews, type Rect } from '../attract/mapRules'
import { CompanyFlag, Gold } from './contracts/parts'
import { useMenuStaged, useReveal } from './staging'
import type { Offer } from './offers'
import { useWar } from './war/WarParts'
import { dockSlots, markText, SLOT_MARKS, slotName, type DockSlot } from './homeDock'

/**
 * May the menu move? False under the OS setting or the in-game toggle: the
 * trade map then draws one still frame.
 */
export function useMenuMotion(): boolean {
  const reducedSetting = useSettingsStore((s) => s.reducedMotion)
  const osReduced = useMedia('(prefers-reduced-motion: reduce)')
  return !(reducedSetting || osReduced)
}

/**
 * The home (October 2026, the map-first home; the designer: "the map front
 * and center … minimize UI and overlay the map where UI is needed"). The
 * trade map (`ui/attract/TradeMap.tsx`) fills the screen edge to edge, and
 * the home is three slim layers over it:
 *
 *  - **the bar** across the top: the seal (the screen's title, spoken), the
 *    bank, and one icon button per place — the HQ, the sealed crates, the
 *    Codex, Settings (a locked one keeps its padlock and says what opens it)
 *    — with your militia's banner once it is founded;
 *  - **the company dock** at the foot: five fixed slots, one per company,
 *    always in `COMPANY_IDS` order — the order the map fans its roads, west
 *    to east. A slot says your standing, its share of the trade while the war
 *    is on, and the day's marks. Picking a slot (or a signpost) FOCUSES that
 *    road (`homeFocus` in the store): the map lights it in its colour, the
 *    rest sinks, and its cities are named along it. Nothing signs;
 *  - **the card** under the dock: the focused company — its flag (the way
 *    into its livery), its name, the facts that tell its road apart, the way
 *    into its track — and the one CTA, which opens its terms.
 *
 * The season and the Sovereign Route, when they show, are two small pills on
 * the dock's shoulders. A first-timer (LS3) sees one road, its card and "Take
 * the free escort": no dock, no bank, no war.
 *
 * The map is told where it is seen through: the `.mn-window` box, measured,
 * is the open area its roads fan out to fill.
 */
export function MenuScreen({
  offers,
  onMilitia,
  onCharter,
  onLivery,
  onWar,
  onTrack,
}: {
  offers: Offer[]
  onMilitia: () => void
  onCharter: () => void
  /** Open the livery panel for a company's standard (Draft 4 § C). */
  onLivery?: (company: CompanyId) => void
  /** Open the trade war's standings (Draft 4 § D). */
  onWar?: () => void
  /** Open a company's loyalty track (Draft 4 · B): the card's track chip is the way in. */
  onTrack?: (company: CompanyId) => void
}) {
  const primary = offers.find((o) => o.id === 'run')
  const places = offers.filter((o) => o.id !== 'run')
  const xp = useMetaStore((s) => s.standing)
  const bank = useMetaStore((s) => s.bank)
  const skills = useMetaStore((s) => s.skills)
  const items = useMetaStore((s) => s.items)
  const militia = useMilitia()
  const liveries = useMetaStore((s) => s.liveries)
  const terms = useMetaStore((s) => s.terms)
  const runs = useMetaStore((s) => s.stats.runsCompleted)
  const openContracts = useGameStore((s) => s.openContracts)
  const focusRoad = useGameStore((s) => s.focusRoad)
  const homeFocus = useGameStore((s) => s.homeFocus)
  const taught = useSettingsStore((s) => s.taught)
  const staged = useMenuStaged()
  const reveal = useReveal()
  const motion = useMenuMotion()
  // The trade war (Draft 4 § D): opens with the market; a first launch never sees it.
  const { open: warShown, season } = useWar()
  const war = !staged && warShown ? season : null

  const standing = useMemo(() => Object.fromEntries(COMPANY_IDS.map((c) => [c, standingOf(xp, c)])) as Record<CompanyId, number>, [xp])
  const hiring = useMemo(() => Object.fromEntries(COMPANY_IDS.map((c) => [c, companyOpen(c, xp)])) as Record<CompanyId, boolean>, [xp])
  const roads = useMemo(() => roadViews({ standing, hiring, firstRun: staged, first: FIRST_COMPANY }), [standing, hiring, staged])
  // Read once per mount: a menu left open past midnight keeps its day.
  const [day] = useState(utcDateKey)
  const hot = marketOfDay(day)
  const market = staged || !reveal.market ? null : { company: hot, mult: MARKET_MULT }
  const slots = useMemo(() => dockSlots({ xp, terms, war, market }), [xp, terms, war, market?.company]) // eslint-disable-line react-hooks/exhaustive-deps
  const charter = useMemo(() => charterDoor({ skills, items: items ?? [] }), [skills, items])
  // The focused road: the one picked, else the default the terms would open on.
  const focus: CompanyId = staged ? FIRST_COMPANY : (homeFocus ?? homeCompany({ standing: xp, stats: { runsCompleted: runs } }))
  const open = staged || hiring[focus]
  // Reading the terms reads the home's tips: the market's, once it shows,
  // and then the trade war's (one at a time, so each is read where it shows).
  const readTerms = () => {
    if (staged) return primary?.action?.run()
    if (market) useSettingsStore.getState().markTaught('market')
    if (war && taught.market) useSettingsStore.getState().markTaught('war')
    openContracts({ company: focus })
  }

  // The open area the map's roads fill: the `.mn-window` box, in the map's coordinates.
  const pageRef = useRef<HTMLDivElement>(null)
  const winRef = useRef<HTMLDivElement>(null)
  const [win, setWin] = useState<Rect | null>(null)
  useEffect(() => {
    const page = pageRef.current
    const w = winRef.current
    if (!page || !w) return
    const measure = () => {
      const p = page.getBoundingClientRect()
      const r = w.getBoundingClientRect()
      const next = { x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height }
      setWin((o) => (o && Math.abs(o.x - next.x) < 1 && Math.abs(o.y - next.y) < 1 && Math.abs(o.w - next.w) < 1 && Math.abs(o.h - next.h) < 1 ? o : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(page)
    ro.observe(w)
    return () => ro.disconnect()
  }, [])

  // One coach pill at a time, the most pressing first: the dock, the market, the war.
  const tip = staged ? null : !taught.board ? (
    <>
      Each company pays your militia to guard its road. <Tap /> one to light it up.
    </>
  ) : market && !taught.market ? (
    <>
      <b>New: the market of the day.</b> One company’s goods sell for ×{MARKET_MULT} today.
    </>
  ) : war && !taught.war ? (
    <>
      <b>New: the trade war.</b> Every delivery takes share for its company.
    </>
  ) : null

  const lead = slots.find((s) => s.leads)?.company ?? null
  const left = war ? contractsLeft(war) : 0

  return (
    <div className={`pg mn${staged ? ' is-first' : ''}`} ref={pageRef}>
      <div className="mn-map">
        <TradeMap
          roads={roads}
          banner={militia ?? DEFAULT_BANNER}
          open={win}
          motion={motion}
          firstRun={staged}
          focused={focus}
          onPick={staged ? undefined : focusRoad}
        />
      </div>
      <div className="mn-shade" aria-hidden="true" />

      <header className="mn-bar">
        {/* The brand (Oct 2026): the Dripping Seal. The name is the screen's
            one title, live text a screen reader and a translator can use; a
            phone shows only the seal, a desk the seal and the name. */}
        <img className="mn-mark" src={markUrl} alt="" width={40} height={40} aria-hidden="true" />
        <h1 className="mn-title" tabIndex={-1}>
          Merchant Mercenaries
        </h1>
        {/* Your militia: its flag, a tap from its builder. */}
        {militia && (
          <button type="button" className="mn-militia" onClick={onMilitia} aria-label={`${militia.name}: edit your militia`} title={militia.name}>
            <Banner look={militia} scale={1} />
            <span className="mn-militia-name">{militia.name}</span>
          </button>
        )}
        {/* The bank is named after the first contract (LS3/LS4). */}
        {!staged && (
          <span className="mn-bank" role="img" aria-label={`${bank} gold in the bank`}>
            <Gold n={bank} />
          </span>
        )}
        <nav className="mn-places" aria-label="Places">
          {places.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`mn-place${o.locked ? ' is-locked' : ''}`}
              aria-disabled={o.locked ? 'true' : undefined}
              aria-label={o.locked ? `${o.title}: ${o.locked}` : o.title}
              title={o.locked ? `${o.title} — ${o.locked}` : o.title}
              onClick={() => (o.locked ? undefined : o.action?.run())}
            >
              {o.icon && <Icon name={o.icon} lg />}
              <span className="mn-place-name" aria-hidden="true">
                {o.title}
              </span>
              {o.locked && <Lock scale={1} />}
            </button>
          ))}
        </nav>
      </header>
      <div className="mn-notes">
        <UpdateNotice />
        {tip && (
          <p className="mn-coach" role="note">
            {tip}
          </p>
        )}
      </div>

      <div className="mn-window" ref={winRef} aria-hidden="true" />

      <div className="mn-foot">
        {(war || (!staged && charter.open)) && (
          <div className="mn-shoulders">
            {/* The season: who leads, what is left; the standings are a tap away. */}
            {war && onWar && (
              <button
                type="button"
                className="mn-pill mn-season"
                onClick={onWar}
                aria-label={`Trade war, season ${war.n}: ${left} contract${left === 1 ? '' : 's'} left${lead ? `, ${companyById(lead).name} leads` : ''}. Open the standings.`}
              >
                <span aria-hidden="true">
                  Season {war.n} · {left} <span className="mn-pill-more">contract{left === 1 ? '' : 's'} </span>left
                </span>
                <i aria-hidden="true">›</i>
              </button>
            )}
            {/* The Sovereign Route (build step 5), once its door is open: the way to its contract. */}
            {!staged && charter.open && (
              <button type="button" className="mn-pill mn-charter" onClick={onCharter} aria-label={`${CHARTER_NAME}: open. Charter it for ${CHARTER_FEE} gold.`}>
                <SovereignCrest scale={1} />
                <span aria-hidden="true">{CHARTER_NAME}</span>
                <i aria-hidden="true">›</i>
              </button>
            )}
          </div>
        )}
        {!staged && <Dock slots={slots} focus={focus} mult={market?.mult ?? MARKET_MULT} onPick={focusRoad} />}
        <CompanyCard
          company={focus}
          open={open}
          staged={staged}
          xp={xp[focus] ?? 0}
          market={market?.company === focus ? market.mult : 1}
          term={terms?.[focus] ?? 1}
          skills={skills}
          items={items ?? []}
          look={liveries[focus] ?? null}
          war={
            war
              ? {
                  cold: isCold(war, focus) && war.exclusive ? { with: war.exclusive, cap: seasonCrateCap(war, focus, standing[focus]) } : null,
                  desperate: war.desperate === focus,
                  exclusive: war.exclusive === focus ? exclusiveXpMult(war, focus) : null,
                }
              : null
          }
          onLivery={!staged && open && onLivery ? () => onLivery(focus) : undefined}
          onTrack={!staged && open && onTrack ? () => onTrack(focus) : undefined}
          cta={
            <button type="button" className="pg-cta mn-cta" onClick={readTerms} disabled={!open || !primary?.action}>
              {staged ? 'Take the free escort' : open ? `Read ${shortName(companyById(focus).name)}’s terms` : `Opens at Standing ${companyById(focus).opensAt ?? 1}`}
            </button>
          }
        />
      </div>
    </div>
  )
}

/** "Peppercorn Co." → "Peppercorn", for a CTA that names the company. */
const shortName = (name: string) => name.replace(/ Co\.$/, '')

/**
 * The company dock: five fixed slots, evenly spaced, in `COMPANY_IDS` order —
 * the order the map's roads fan west to east. A slot is its company's logo,
 * your standing with it ("Rep 4", or "II · 3" on a second term, the crest
 * rimmed in gold), its share of the trade while the war is on (the leader's
 * crowned), and up to two marks on its top edge: desperate terms "×1.5", the
 * market "×1.3", your exclusive, cold. A company not hiring yet shows its
 * padlock and the standing that opens it. A tap focuses the road.
 */
function Dock({ slots, focus, mult, onPick }: { slots: DockSlot[]; focus: CompanyId; mult: number; onPick: (c: CompanyId) => void }) {
  return (
    <div className="mn-dock" role="group" aria-label="Companies">
      {slots.map((s) => {
        const co = companyById(s.company)
        const on = s.company === focus
        return (
          <button
            key={s.company}
            type="button"
            className={`mn-slot${on ? ' is-on' : ''}${s.open ? '' : ' is-locked'}`}
            style={{ '--co': co.color } as CSSProperties}
            aria-pressed={on}
            aria-label={slotName(s, mult)}
            onClick={() => onPick(s.company)}
          >
            {s.marks.length > 0 && (
              <span className="mn-marks" aria-hidden="true">
                {s.marks.slice(0, SLOT_MARKS).map((m) => (
                  <span key={m} className={`mn-mark-tag is-${m}`}>
                    {markText(m, mult)}
                  </span>
                ))}
              </span>
            )}
            <span className="mn-slot-crest" aria-hidden="true">
              <Crest company={s.company} locked={!s.open} scale={2} />
              {s.leads && (
                <span className="mn-slot-crown">
                  <Crown scale={2} />
                </span>
              )}
            </span>
            <span className="mn-slot-rep" aria-hidden="true">
              {s.open ? (
                s.rep
              ) : (
                `at ${s.opensAt}`
              )}
            </span>
            {s.share != null && (
              <span className="mn-slot-share" aria-hidden="true">
                {s.share}%
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * The focused company's card, under the dock: its flag (the way into its
 * livery), the road's goods and the company's name, then the chips that tell
 * its road apart — what the dock's marks mean (the market's goods, desperate
 * terms' stronger raiders, your exclusive's standing, a cold company's stake
 * cap), its ground, the armour its raiders lean to — and the way into its
 * track by the reward it pays next. The dock already says your standing and
 * the share, and the map names the cities, so the card does not. The one CTA
 * closes it.
 */
function CompanyCard({
  company,
  open,
  staged,
  xp,
  market,
  term,
  skills,
  items,
  look,
  war,
  onLivery,
  onTrack,
  cta,
}: {
  company: CompanyId
  open: boolean
  staged: boolean
  xp: number
  market: number
  /** The term signed with it, and what is unlocked: what its track's next level pays. */
  term: number
  skills: readonly string[]
  items: readonly string[]
  /** How you dressed its standard. */
  look: StandardLook | null
  /** Its place in the trade war this season: cold (your exclusive is with its rival), desperate, your exclusive (its standing multiplier). */
  war?: { cold: { with: CompanyId; cap: number } | null; desperate: boolean; exclusive: number | null } | null
  onLivery?: () => void
  onTrack?: () => void
  cta: ReactNode
}) {
  const co = companyById(company)
  const armour = co.armour ? ENEMY_MODS.find((m) => m.id === co.armour) : undefined
  // What the track's next level pays, by name (Draft 4 · B).
  const next = nextRewardWord(trackPlan(company, { xp, term, skills, items }))
  return (
    <section className={`mn-card${war?.cold ? ' is-cold' : ''}`} style={{ '--co': co.color } as CSSProperties} aria-labelledby="mn-card-name" aria-live="polite">
      <div className="mn-card-head">
        {onLivery ? (
          <button type="button" className="mn-livery" onClick={onLivery} aria-label={`Dress ${co.name}’s standard`}>
            <CompanyFlag company={company} look={look} />
            <span className="mn-livery-mark" aria-hidden="true">
              <Pixel rows={CHARGES.brush} palette={BRUSH_MARK} scale={2} />
            </span>
          </button>
        ) : (
          <span className="mn-livery is-still">
            <CompanyFlag company={company} locked={!open} look={look} />
          </span>
        )}
        <span className="mn-card-id">
          <span className="mn-kicker">{co.goods} road</span>
          <h2 className="mn-card-name" id="mn-card-name">
            {co.name}
          </h2>
        </span>
      </div>
      <div className="mn-chips">
        {staged && (
          <span className="mn-chip is-free">
            <b>Free</b> · paid at every city
          </span>
        )}
        {war?.desperate && <span className="mn-chip is-desperate">Desperate: raiders +{Math.round((DESPERATE_STRENGTH - 1) * 100)}%</span>}
        {war?.exclusive != null && <span className="mn-chip is-exclusive">Exclusive: standing ×{war.exclusive}</span>}
        {war?.cold && (
          <span className="mn-chip is-cold" aria-label={`Cold: your exclusive is with ${companyById(war.cold.with).name}, so stakes stop at ${war.cold.cap} crates`}>
            Stakes stop at {war.cold.cap}
          </span>
        )}
        {market > 1 && <span className="mn-chip is-market">Top price for {co.noun} today</span>}
        <span className="mn-chip is-ground" style={{ '--gr': co.ground.swatch } as CSSProperties}>
          {co.ground.name}
        </span>
        {/* The armour its road's goblins lean to (`Company.armour`): a road fact, like its ground. */}
        {armour && (
          <span className="mn-chip is-armour" aria-label={`${armour.prefix} raiders: ${armour.blurb}`}>
            <ArmourMark mod={armour.id} />
            {armour.prefix} raiders
          </span>
        )}
        {open && onTrack && (
          <button type="button" className="mn-chip is-track" onClick={onTrack} aria-label={`${co.name}’s track: next, ${next ?? 'nothing left to earn'}. Open it`}>
            <span className="field-k">Next</span> <span className="field-v">{next ?? 'all earned'}</span> <span aria-hidden="true">›</span>
          </button>
        )}
      </div>
      {cta}
    </section>
  )
}

/** The livery's mark on the card's flag: a brush, in ink. */
const BRUSH_MARK = { p: '#2a1e14' }
