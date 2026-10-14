import { useMilitia } from './useMilitia'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { COMPANY_IDS, companyById, FIRST_COMPANY, type CompanyId } from '../../game/data/companies'
import { CHARGES, DEFAULT_BANNER } from '../../game/data/banner'
import type { StandardLook } from '../../game/data/companyStandard'
import { RANDOM_UNLOCK_SKILLS } from '../../game/data/skills'
import { CITY_COUNT, MARKET_MULT, marketOfDay, utcDateKey } from '../../game/run/contracts'
import { boardLine } from '../../game/run/liaison'
import { companyOpen, standingOf, standingProgress } from '../../game/run/standing'
import { CHARTER_FEE, CHARTER_NAME, charterDoor } from '../../game/run/charter'
import { useGameStore } from '../../state/gameStore'
import { homeCompany } from '../../state/game/contractSlice'
import { useMetaStore } from '../../state/metaStore'
import { useSettingsStore } from '../../state/settingsStore'
import { Icon } from '../Icon'
import { ArmourMark } from '../ArmourMark'
import { ENEMY_MODS } from '../../game/data/enemies'
import { Banner, Lock, Pixel, SovereignCrest } from '../pixel'
import { Tap, useMedia } from '../pointer'
import { UpdateNotice } from '../UpdateNotice'
import markUrl from '../../assets/brand/mark.svg'
import { TradeMap } from '../attract/TradeMap'
import { roadViews, type Rect } from '../attract/mapRules'
import { CompanyFlag, Gold } from './contracts/parts'
import { LiaisonScene } from './LiaisonScene'
import { useMenuStaged, useReveal } from './staging'
import type { Offer } from './offers'
import { isCold, isDesperate, seasonCrateCap, seasonLeader } from '../../game/run/tradeWar'
import { DesperateChip, useWar, WarStrip } from './war/WarParts'

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
 * The menu (the mercenary company, build step 4) — and, since October 2026
 * (Figma "Proposal · Home cleanup", B2), the contract board too: the TRADE MAP
 * (`ui/attract/TradeMap.tsx`) is the picker. Each company road ends at a
 * wooden signpost — its logo, your standing ("Rep 2"), today's market as a
 * gold "×1.3", a padlock on a road not hiring yet. A tap FOCUSES that road
 * (`homeFocus` in the store) and never signs; the parchment notice under the
 * map is the focused road's: its liaison at the company's post saying the
 * day's line (Draft 4 · D), the company's flag, the road and its three cities, and chips for the market, the ground and your
 * standing (or what opens it). The CTA names the company and opens its terms
 * straight away; there is no separate board.
 *
 * Phone: the seal and the name on one line with the militia's name under it
 * and the bank beside them, the map in the open middle, then the notice, the
 * secondary places as one row of tiles, and the CTA. Desk (the rules at the
 * foot of `menu.css`): the same blocks in a left-hand column; the map, the
 * picker, takes the rest.
 *
 * The map is told where it is seen through: the `.mn-window` box, measured,
 * is the open area its roads fan out to fill.
 *
 * The staggered reveal (`state/staging.revealOf`): the market shows from the
 * fifth finished contract; a first launch (LS3) shows the one road that hires
 * and its notice, and the CTA is the free escort.
 */
export function MenuScreen({
  offers,
  onMilitia,
  onCharter,
  onLivery,
  onWar,
}: {
  offers: Offer[]
  onMilitia: () => void
  onCharter: () => void
  /** Open the livery panel for a company's standard (Draft 4 § C). */
  onLivery?: (company: CompanyId) => void
  /** Open the trade war's standings (Draft 4 § D). */
  onWar?: () => void
}) {
  const primary = offers.find((o) => o.id === 'run')
  const tiles = offers.filter((o) => o.id !== 'run')
  const xp = useMetaStore((s) => s.standing)
  const bank = useMetaStore((s) => s.bank)
  const skills = useMetaStore((s) => s.skills)
  const items = useMetaStore((s) => s.items)
  const militia = useMilitia()
  const liveries = useMetaStore((s) => s.liveries)
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
  const charter = useMemo(() => charterDoor({ skills, items: items ?? [] }), [skills, items])
  // The focused road: the one tapped, else the default the terms would open on.
  const focus: CompanyId = staged ? FIRST_COMPANY : (homeFocus ?? homeCompany({ standing: xp, stats: { runsCompleted: runs } }))
  const open = staged || hiring[focus]
  // Reading the terms reads the board's tips: the market's, once it shows,
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

  // One coach line at a time, the most pressing first: the board, the market.
  // (The company is founded before the menu is ever shown, so it needs no tip.)
  const tip =
    staged ? null : !taught.board ? (
      <p className="mn-coach" role="note">
        Each company pays your militia to guard its road. <Tap /> a signpost to read its notice.
      </p>
    ) : market && !taught.market ? (
      <p className="mn-coach" role="note">
        <b>New: the market of the day.</b> One company’s goods sell for ×{MARKET_MULT} today — its crates and its completion bonus.
      </p>
    ) : war && !taught.war ? (
      <p className="mn-coach" role="note">
        <b>New: the trade war.</b> Every delivery takes share for its company. When the season ends, the leader pays its top militia.
      </p>
    ) : null

  // The Sovereign Route (build step 5), once its door is open: the way to its contract.
  const charterLine =
    !staged && charter.open ? (
      <button type="button" className="mn-charter mn-charter-btn is-open" onClick={onCharter} aria-label={`${CHARTER_NAME}: open. Charter it for ${CHARTER_FEE} gold.`}>
        <SovereignCrest scale={1} />
        <b aria-hidden="true">{CHARTER_NAME}</b>
        <span className="mn-charter-v" aria-hidden="true">
          Open · <Gold n={CHARTER_FEE} scale={1} />
        </span>
      </button>
    ) : null

  return (
    <div className={`pg mn${staged ? ' is-first' : ''}`} ref={pageRef}>
      <div className="mn-map">
        <TradeMap
          roads={roads}
          market={market}
          banner={militia ?? DEFAULT_BANNER}
          open={win}
          motion={motion}
          firstRun={staged}
          focused={focus}
          leader={war ? seasonLeader(war) : null}
          onPick={staged ? undefined : focusRoad}
        />
      </div>
      <div className="mn-shade" aria-hidden="true" />

      <header className="mn-head">
        {/* The brand (Oct 2026): the Dripping Seal beside the name, the
            militia's name under it. The name stays live text (an h1 a screen
            reader and a translator can use); the seal is decoration. */}
        <img className="mn-mark" src={markUrl} alt="" width={44} height={44} aria-hidden="true" />
        <div className="mn-names">
          <h1 className="t-title" tabIndex={-1}>
            Merchant Mercenaries
          </h1>
          {/* Your militia: its flag and name, a tap from its builder. */}
          {militia && (
            <button type="button" className="mn-militia" onClick={onMilitia} aria-label={`${militia.name}: edit your militia`}>
              <Banner look={militia} scale={1} />
              <span>{militia.name}</span>
            </button>
          )}
        </div>
        {!staged && <p className="mn-pick">Pick a road — <Tap lower /> a signpost</p>}
        {/* The bank is named after the first contract (LS3/LS4). */}
        {!staged && (
          <span className="mn-bank" role="img" aria-label={`${bank} gold in the bank`}>
            <Gold n={bank} />
          </span>
        )}
        <UpdateNotice />
      </header>

      <div className="mn-window" ref={winRef} aria-hidden="true" />

      <div className="mn-sheet">
        {tip}
        {war && onWar && <WarStrip season={war} onOpen={onWar} />}
        {charterLine}
        <ContractNotice
          company={focus}
          open={open}
          staged={staged}
          day={day}
          standing={standing[focus]}
          xp={xp[focus] ?? 0}
          market={market?.company === focus ? market.mult : 1}
          skillsLeft={RANDOM_UNLOCK_SKILLS.some((id) => !skills.includes(id))}
          look={liveries[focus] ?? null}
          war={
            war
              ? {
                  cold: isCold(war, focus) && war.exclusive ? { with: war.exclusive, cap: seasonCrateCap(war, focus, standing[focus]) } : null,
                  desperate: isDesperate(war, focus),
                  exclusive: war.exclusive === focus,
                }
              : null
          }
          onLivery={!staged && open && onLivery ? () => onLivery(focus) : undefined}
          onStep={staged ? undefined : (d) => focusRoad(COMPANY_IDS[(COMPANY_IDS.indexOf(focus) + d + COMPANY_IDS.length) % COMPANY_IDS.length])}
        />
        <div className="mn-tiles">
          {tiles.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`mn-tile${o.locked ? ' is-locked' : ''}`}
              aria-disabled={o.locked ? 'true' : undefined}
              aria-label={o.locked ? `${o.title}: ${o.locked}` : undefined}
              title={o.locked}
              onClick={() => (o.locked ? undefined : o.action?.run())}
            >
              {o.icon && <Icon name={o.icon} lg />}
              <span>{o.title}</span>
              {o.locked && <Lock scale={1} />}
            </button>
          ))}
        </div>
        <button type="button" className="pg-cta mn-cta" onClick={readTerms} disabled={!open || !primary?.action}>
          {staged ? 'Take the free escort' : open ? `Read ${shortName(companyById(focus).name)}’s terms` : `Opens at Standing ${companyById(focus).opensAt ?? 1}`}
        </button>
      </div>
    </div>
  )
}

/** "Peppercorn Co." → "Peppercorn", for a CTA that names the company. */
const shortName = (name: string) => name.replace(/ Co\.$/, '')

/**
 * The focused road's notice (Figma "B2 · Contract Notice"): a parchment sheet
 * pinned under the map, sealed in its company's colour with its logo. The
 * kicker names the road and its cities, the pager steps the roads the way the
 * signposts do. Over it the company's liaison stands at its post and says the
 * day's line (`LiaisonScene`, `run/liaison.boardLine`: a hash of the day, so it
 * holds still while you look) — the company's own words, said once: it
 * replaced the notice's quoted letter. The chips are the facts that tell one
 * road from another: today's market, its ground, your standing — or, on a road
 * not hiring yet, what opens it.
 */
function ContractNotice({
  company,
  open,
  staged,
  day,
  standing,
  xp,
  market,
  skillsLeft,
  look,
  war,
  onLivery,
  onStep,
}: {
  company: CompanyId
  open: boolean
  staged: boolean
  day: string
  standing: number
  xp: number
  market: number
  skillsLeft: boolean
  /** How you dressed its standard. */
  look: StandardLook | null
  /**
   * Its place in the trade war this season (Draft 4 § D): cold while your
   * exclusive is with its rival (mockup 4b), desperate terms, your exclusive.
   */
  war?: { cold: { with: CompanyId; cap: number } | null; desperate: boolean; exclusive: boolean } | null
  /** Opens its livery: the flag is the way in (Draft 4 § C). */
  onLivery?: () => void
  onStep?: (delta: number) => void
}) {
  const co = companyById(company)
  const armour = co.armour ? ENEMY_MODS.find((m) => m.id === co.armour) : undefined
  const prog = standingProgress(xp)
  const next = prog.max ? 'the highest there is' : skillsLeft ? `a skill at ${prog.standing + 1}` : `a Rare item at ${prog.standing + 1}`
  const i = COMPANY_IDS.indexOf(company)
  return (
    <section
      className={`mn-notice${war?.cold ? ' is-cold' : ''}`}
      style={{ '--co': co.color } as CSSProperties}
      aria-label={`Notice: ${co.name}${war?.cold ? ', cold to you this season' : ''}`}
      aria-live="polite"
    >
      {/* Cold (the trade war): your exclusive is with its rival — the paper
          pales and wears a stamp until the season ends. */}
      {war?.cold && (
        <span className="mn-cold-stamp" aria-hidden="true">
          Cold
        </span>
      )}
      {/* The company's liaison, at its post, saying the day's line (Draft 4 · D). */}
      <LiaisonScene at="notice" company={company} line={boardLine(company, day, open)} />
      {/* The company's flag on the LEFT, beside its name (the designer: the
          trader's icon belongs on the left when a road is opened, as a flag). */}
      <div className="mn-notice-head">
        {onLivery ? (
          <button type="button" className="mn-livery" onClick={onLivery} aria-label={`Dress ${co.name}’s standard`}>
            <CompanyFlag company={company} look={look} />
            <span className="mn-livery-mark" aria-hidden="true">
              <Pixel rows={CHARGES.brush} palette={BRUSH_MARK} scale={2} />
            </span>
          </button>
        ) : (
          <CompanyFlag company={company} locked={!open} look={look} />
        )}
        <span className="mn-notice-id">
          <span className="mn-kicker">
            Notice · {co.goods} road · {CITY_COUNT} cities
          </span>
          <h2 className="mn-notice-t">{co.name}</h2>
        </span>
        {onStep && (
          <span className="mn-pager">
            <button type="button" className="mn-step" aria-label="Previous road" onClick={() => onStep(-1)}>
              ‹
            </button>
            <span aria-label={`Road ${i + 1} of ${COMPANY_IDS.length}`}>
              {i + 1}/{COMPANY_IDS.length}
            </span>
            <button type="button" className="mn-step" aria-label="Next road" onClick={() => onStep(1)}>
              ›
            </button>
          </span>
        )}
      </div>
      <p className="mn-route">
        {co.towns.map((t, n) => (
          <span key={t}>
            {n > 0 && <i aria-hidden="true">◆</i>}
            {t}
          </span>
        ))}
      </p>
      <div className="mn-chips">
        {war?.desperate && <DesperateChip />}
        {war?.exclusive && <span className="mn-chip is-exclusive">Your exclusive</span>}
        {war?.cold && (
          <span className="mn-chip is-cold" aria-label={`Your exclusive is with ${companyById(war.cold.with).name}: stakes stop at ${war.cold.cap} crates`}>
            Stakes stop at {war.cold.cap}
          </span>
        )}
        {market > 1 && (
          <span className="mn-chip is-market">
            <b>×{market} today</b> {co.noun} sells high
          </span>
        )}
        <span className="mn-chip is-ground" style={{ '--gr': co.ground.swatch } as CSSProperties}>
          {co.ground.name}
        </span>
        {/* The armour its road's goblins lean to (`Company.armour`): most of
            its armoured fights wear it, so it is a road fact like the ground. */}
        {armour && (
          <span className="mn-chip is-armour" aria-label={`${armour.prefix} raiders: ${armour.blurb}`}>
            <ArmourMark mod={armour.id} />
            {armour.prefix} raiders
          </span>
        )}
        {staged ? (
          <span className="mn-chip is-rep">
            <b>Free</b> · paid at every city
          </span>
        ) : open ? (
          <span className="mn-chip is-rep" aria-label={`Standing ${standing} with ${co.name}: next, ${next}`}>
            <b>Rep {standing}</b> · {next}
          </span>
        ) : (
          <span className="mn-chip is-locked">
            <Lock scale={1} /> Opens at Standing {co.opensAt ?? 1}
          </span>
        )}
      </div>
    </section>
  )
}

/** The livery's mark on the notice's flag: a brush, in ink. */
const BRUSH_MARK = { p: '#2a1e14' }
