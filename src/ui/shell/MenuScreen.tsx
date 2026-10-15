import { useMilitia } from './useMilitia'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { COMPANY_IDS, companyById, FIRST_COMPANY, type CompanyId } from '../../game/data/companies'
import { CHARGES, DEFAULT_BANNER } from '../../game/data/banner'
import type { StandardLook } from '../../game/data/companyStandard'
import { MARKET_MULT, marketOfDay, utcDateKey } from '../../game/run/contracts'
import { companyOpen, standingOf } from '../../game/run/standing'
import { nextRewardWord, trackPlan } from '../../game/run/track'
import { CHARTER_NAME, charterDoor } from '../../game/run/charter'
import { contractsLeft, seasonBars, type SeasonBar } from '../../game/run/tradeWar'
import { useGameStore, type HomeFocus } from '../../state/gameStore'
import { homeCompany } from '../../state/game/contractSlice'
import { useMetaStore } from '../../state/metaStore'
import { useSettingsStore } from '../../state/settingsStore'
import { Icon } from '../Icon'
import { ArmourMark } from '../ArmourMark'
import { GroundMarks } from '../GroundMark'
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
import { charterCta, charterSlot, charterSlotName, dockSlots, markText, SLOT_MARKS, slotName, type CharterSlot, type DockSlot } from './homeDock'
import { charterFacts, companyFacts, type CardFact } from './homeCard'
import { barKind, seasonPanelName } from './homeSeason'
import { companyVar } from '../channels'

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
 *  - **the bar** across the top: the purse — one small plaque holding the
 *    seal (the screen's title, spoken; written beside it on a desk) and the
 *    bank — your militia's banner once it is founded, and one carved plate
 *    per place — the HQ, the sealed crates, the Codex, Settings — its mark
 *    and its name (a locked one charred, with its padlock, saying what opens
 *    it); under the purse, while the trade war is on, the season panel (its
 *    seven bars; it opens the standings);
 *  - **the foot**: the company dock — five fixed slots, one per company,
 *    always in `COMPANY_IDS` order, the order the map fans its roads west to
 *    east — with Buy Company floating over its right end, a slot's size,
 *    locked until every skill and item is; and the card. Picking a slot (or
 *    a signpost) FOCUSES a road (`homeFocus` in the store): the map lights it
 *    in its colour and its season, the rest sinks, its cities are named
 *    beside it. Nothing signs;
 *  - **the card**: a fixed form (`homeCard.ts`) — the focused company's
 *    flag (the way into its livery) and name, four rows (Ground, Raiders,
 *    Today, Next) and the one CTA, which opens its terms. With Buy Company in
 *    focus it is that card, in the same frame.
 *
 * ## No wiggle
 *
 * A view you click around keeps its geometry (`DESIGN_SYSTEM.md` § 8): every
 * pick changes values, never boxes. The card is the same rows whatever the
 * company; the season panel, the notes (the update notice, a coach pill) and
 * the Buy Company slot float over the map instead of pushing it (the map
 * keeps its labels off them).
 * `scripts/home-stability.mjs` proves it in the running app.
 * So the open area between the bar and the foot — what the map's roads fan
 * out to fill — depends on the viewport alone, and a pick never re-frames
 * the map or re-bakes its terrain.
 *
 * A first-timer (LS3) sees one road, its card and "Take the free escort": no
 * dock, no bank, no war.
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
  /** Open a company's loyalty track (Draft 4 · B): the card's Next row is the way in. */
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
  const own = useMemo(() => charterSlot(charterDoor({ skills, items: items ?? [] }), bank), [skills, items, bank])
  // The focused road: the one picked, else the default the terms would open on.
  // `'charter'` is the Buy Company slot: every road lit, its own card.
  const focus: HomeFocus = staged ? FIRST_COMPANY : (homeFocus ?? homeCompany({ standing: xp, stats: { runsCompleted: runs } }))
  const company = focus === 'charter' ? null : focus
  const open = staged || (company != null && hiring[company])
  // Reading the terms reads the home's tips: the market's, once it shows,
  // and then the trade war's (one at a time, so each is read where it shows).
  const readTerms = () => {
    if (staged) return primary?.action?.run()
    if (market) useSettingsStore.getState().markTaught('market')
    if (war && taught.market) useSettingsStore.getState().markTaught('war')
    if (company) openContracts({ company })
  }

  // The open area the map's roads fill: the `.mn-window` box between the bar
  // and the foot, in the map's coordinates. Neither moves on a pick (see
  // "No wiggle" above); the notes float, so the map only keeps its labels off them.
  const pageRef = useRef<HTMLDivElement>(null)
  const winRef = useRef<HTMLDivElement>(null)
  const underRef = useRef<HTMLDivElement>(null)
  const footRef = useRef<HTMLDivElement>(null)
  const [win, setWin] = useState<Rect | null>(null)
  const [floats, setFloats] = useState<Rect[]>([])
  useEffect(() => {
    const page = pageRef.current
    const w = winRef.current
    const n = underRef.current
    const f = footRef.current
    if (!page || !w || !n || !f) return
    const near = (a: Rect, b: Rect) => Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.w - b.w) < 1 && Math.abs(a.h - b.h) < 1
    const measure = () => {
      const p = page.getBoundingClientRect()
      const rect = (el: Element): Rect => {
        const r = el.getBoundingClientRect()
        return { x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height }
      }
      const next = rect(w)
      setWin((o) => (o && near(o, next) ? o : next))
      // What floats over the map: the season panel, the notes, and the Buy Company slot.
      const floating = [...n.querySelectorAll(':scope > .mn-season, :scope > .mn-notes > *'), ...f.querySelectorAll('.mn-own')]
      const boxes = floating.map(rect).filter((r) => r.w > 0 && r.h > 0)
      setFloats((o) => (o.length === boxes.length && o.every((r, i) => near(r, boxes[i])) ? o : boxes))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(page)
    ro.observe(w)
    ro.observe(n)
    ro.observe(f)
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
  const bars = war ? seasonBars(war) : []

  return (
    <div className={`pg mn${staged ? ' is-first' : ''}`} ref={pageRef}>
      <div className="mn-map">
        <TradeMap
          roads={roads}
          banner={militia ?? DEFAULT_BANNER}
          open={win}
          avoid={floats}
          motion={motion}
          firstRun={staged}
          focused={focus === 'charter' ? 'all' : focus}
          onPick={staged ? undefined : focusRoad}
        />
      </div>
      <div className="mn-shade" aria-hidden="true" />

      <header className="mn-bar">
        {/* The purse: the brand (the Dripping Seal) and the bank, one small
            plaque. The name is the screen's one title, live text a screen
            reader and a translator can use; a phone shows only the seal, a
            desk the seal and the name. The bank is named after the first
            contract (LS3/LS4). */}
        <div className="mn-purse">
          <img className="mn-mark" src={markUrl} alt="" width={40} height={40} aria-hidden="true" />
          <h1 className="mn-title" tabIndex={-1}>
            Merchant Mercenaries
          </h1>
          {!staged && (
            <span className="mn-bank" role="img" aria-label={`${bank} gold in the bank`}>
              <Gold n={bank} />
            </span>
          )}
        </div>
        {/* Your militia: its flag, a tap from its builder. */}
        {militia && (
          <button type="button" className="mn-militia" onClick={onMilitia} aria-label={`${militia.name}: edit your militia`} title={militia.name}>
            <Banner look={militia} scale={1} />
            <span className="mn-militia-name">{militia.name}</span>
          </button>
        )}
        <nav className="mn-places" aria-label="Places">
          {places.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`mn-place${o.locked ? ' is-locked' : ''}`}
              aria-disabled={o.locked ? 'true' : undefined}
              aria-label={o.locked ? `${o.title}: locked. ${o.locked}` : o.title}
              title={o.locked ? `${o.title} — ${o.locked}` : o.title}
              onClick={() => (o.locked ? undefined : o.action?.run())}
            >
              <span className="mn-place-mark" aria-hidden="true">
                {o.icon && <Icon name={o.icon} lg />}
                {o.locked && (
                  <span className="mn-place-lock">
                    <Lock scale={1} />
                  </span>
                )}
              </span>
              <span className="mn-place-name" aria-hidden="true">
                <span className="mn-place-short">{o.short ?? o.title}</span>
                <span className="mn-place-full">{o.title}</span>
              </span>
            </button>
          ))}
        </nav>
        {/* Under the bar, floating over the map (they never push it): the
            season panel under the purse, then the notes. */}
        <div className="mn-under" ref={underRef}>
          {war && onWar && (
            <button type="button" className="mn-season" onClick={onWar} aria-label={seasonPanelName(war.n, left, lead, bars)}>
              <span className="mn-season-head" aria-hidden="true">
                <span className="mn-season-n">Season {war.n}</span>
                <span className="mn-season-left">
                  {left} left <i>›</i>
                </span>
              </span>
              <span className="mn-season-bars" aria-hidden="true">
                {bars.map((b: SeasonBar, i) => (
                  <i key={i} className={`is-${barKind(b)}`} style={b && b !== 'miss' ? ({ '--co': companyVar(b) } as CSSProperties) : undefined} />
                ))}
              </span>
            </button>
          )}
          <div className="mn-notes">
            <UpdateNotice />
            {tip && (
              <p className="mn-coach" role="note">
                {tip}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="mn-window" ref={winRef} aria-hidden="true" />

      <div className="mn-foot" ref={footRef}>
        {/* The dock, with Buy Company floating over its right end. */}
        {!staged && (
          <div className="mn-docked">
            <BuySlot slot={own} on={focus === 'charter'} onPick={() => focusRoad('charter')} />
            <Dock slots={slots} focus={focus} mult={market?.mult ?? MARKET_MULT} onPick={focusRoad} />
          </div>
        )}
        {company == null ? (
          <CharterCard slot={own} onBuy={onCharter} />
        ) : (
          <CompanyCard
            company={company}
            open={open}
            staged={staged}
            xp={xp[company] ?? 0}
            market={market?.company === company ? market.mult : 1}
            term={terms?.[company] ?? 1}
            skills={skills}
            items={items ?? []}
            look={liveries[company] ?? null}
            war={war ? { desperate: war.desperate === company } : null}
            onLivery={!staged && open && onLivery ? () => onLivery(company) : undefined}
            onTrack={!staged && open && onTrack ? () => onTrack(company) : undefined}
            cta={
              <button type="button" className="pg-cta mn-cta" onClick={readTerms} disabled={!open || !primary?.action}>
                {staged ? 'Take the free escort' : open ? `Read ${shortName(companyById(company).name)}’s terms` : `Opens at Standing ${companyById(company).opensAt ?? 1}`}
              </button>
            }
          />
        )}
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
 * market "×1.3". A company not hiring yet shows its
 * padlock and the standing that opens it. A tap focuses the road.
 */
function Dock({ slots, focus, mult, onPick }: { slots: DockSlot[]; focus: HomeFocus; mult: number; onPick: (f: HomeFocus) => void }) {
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
              {s.open ? s.rep : `at ${s.opensAt}`}
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
 * Buy Company (the Sovereign Route): a slot like a company's, floating over
 * the dock's right end, in its rightmost column (October 2026; the designer:
 * "should be like one of the other company cards but locked, floating
 * above"). It is no company's road, so it wears no company's frame: a carved
 * (double) cyan rim and the Sovereign crest. Locked: the crest in shadow
 * under a padlock, the share of the catalogue unlocked ("40%") and a thin
 * bar. Open: the crest in colour, "Buy", a soft glow. A desk writes its name.
 * A tap focuses it like a road: every road lights, and the card turns into
 * Buy Company.
 */
function BuySlot({ slot, on, onPick }: { slot: CharterSlot; on: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      className={`mn-slot mn-own${on ? ' is-on' : ''}${slot.open ? ' is-open' : ' is-locked'}`}
      aria-pressed={on}
      aria-label={charterSlotName(slot)}
      onClick={onPick}
    >
      <span className="mn-slot-crest" aria-hidden="true">
        <SovereignCrest scale={2} />
        {!slot.open && (
          <span className="mn-own-lock">
            <Lock scale={2} />
          </span>
        )}
      </span>
      <span className="mn-own-text" aria-hidden="true">
        <span className="mn-own-name">Buy Company</span>
        {slot.open ? (
          <span className="mn-slot-rep mn-own-buy">Buy</span>
        ) : (
          <>
            <span className="mn-slot-rep">{slot.pct}%</span>
            <span className="mn-own-bar">
              <i style={{ width: `${Math.max(4, slot.pct)}%` }} />
            </span>
          </>
        )}
      </span>
    </button>
  )
}

/**
 * One row of the card's fixed form: its `.field-k` label, its mark and its
 * `.field-v` value on one line, shortened in place (never wrapped). The whole
 * fact, in words, is its accessible name and its tooltip. The Next row is the
 * way into the track when there is one.
 */
function FactRow({ fact: f, onOpen }: { fact: CardFact; onOpen?: () => void }) {
  const body = (
    <>
      <span className="field-k">{f.label}</span>
      {/* The marks sit in their own column, so every row's value starts at one edge. */}
      <span className="mn-fact-m">
        {f.ground && <GroundMarks marks={f.ground} />}
        {f.armour && <ArmourMark mod={f.armour} />}
        {f.icon && <Icon name={f.icon} />}
      </span>
      <span className="mn-fact-v">
        {f.gold != null && <Gold n={f.gold} className="mn-fact-gold" />}
        <span className="field-v">{f.value}</span>
      </span>
    </>
  )
  const cls = `mn-fact is-${f.key} is-${f.tone}`
  return onOpen ? (
    <button type="button" className={`${cls} is-link`} onClick={onOpen} aria-label={`${f.name}. Open its track`} title={f.name}>
      {body}
      <span className="mn-fact-go" aria-hidden="true">
        ›
      </span>
    </button>
  ) : (
    <div className={cls} role="img" aria-label={f.name} title={f.name}>
      {body}
    </div>
  )
}

/**
 * The Buy Company card (its slot in focus), in the company card's frame:
 * the Sovereign crest (padlocked while locked), "Sovereign Route" over the
 * title, the same four-row form — the road, its ground, the door (how much is
 * unlocked; once open, whether the bank covers the fee), what delivery pays —
 * and the CTA: locked, it says how many unlocks are missing; open, "Buy
 * Company" with the fee on it, which opens the charter page (the militia's
 * founding first, if none), waiting while the bank is short.
 */
function CharterCard({ slot, onBuy }: { slot: CharterSlot; onBuy: () => void }) {
  const cta = charterCta(slot)
  return (
    <section className={`mn-card mn-own-card${slot.open ? ' is-open' : ' is-locked'}`} aria-labelledby="mn-card-name" aria-live="polite">
      <div className="mn-card-head">
        <span className="mn-livery is-still mn-own-crest" aria-hidden="true">
          <SovereignCrest scale={2} />
          {!slot.open && (
            <span className="mn-own-lock">
              <Lock scale={2} />
            </span>
          )}
        </span>
        <span className="mn-card-id">
          <span className="mn-kicker">{CHARTER_NAME}</span>
          <h2 className="mn-card-name" id="mn-card-name">
            Buy Company
          </h2>
        </span>
      </div>
      <div className="mn-facts">
        {charterFacts(slot).map((f) => (
          <FactRow key={f.key} fact={f} />
        ))}
      </div>
      <button type="button" className="pg-cta mn-cta" onClick={onBuy} disabled={!cta.enabled}>
        {cta.label}
        {cta.fee != null && (
          <>
            {' · '}
            <Gold n={cta.fee} className="mn-cta-fee" />
          </>
        )}
      </button>
    </section>
  )
}

/**
 * The focused company's card, under the dock: its flag (the way into its
 * livery), the road's goods and the company's name, then the fixed form —
 * Ground, Raiders, Today, Next (`homeCard.companyFacts`) — and the one CTA.
 * The dock already says your standing and the share, and the map names the
 * cities, so the card does not.
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
  /** Its place in the trade war this season: on desperate terms or not. */
  war?: { desperate: boolean } | null
  onLivery?: () => void
  onTrack?: () => void
  cta: ReactNode
}) {
  const co = companyById(company)
  // What the track's next level pays, by name (Draft 4 · B).
  const next = nextRewardWord(trackPlan(company, { xp, term, skills, items }))
  const facts = companyFacts({ company, staged, open, war: war ?? null, market, next })
  return (
    <section className="mn-card" style={{ '--co': co.color } as CSSProperties} aria-labelledby="mn-card-name" aria-live="polite">
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
      <div className="mn-facts">
        {facts.map((f) => (
          <FactRow key={f.key} fact={f} onOpen={f.key === 'next' ? onTrack : undefined} />
        ))}
      </div>
      {cta}
    </section>
  )
}

/** The livery's mark on the card's flag: a brush, in ink. */
const BRUSH_MARK = { p: '#2a1e14' }
