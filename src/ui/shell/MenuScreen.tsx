import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { COMPANY_IDS, companyById, FIRST_COMPANY, type CompanyId } from '../../game/data/companies'
import { DEFAULT_BANNER } from '../../game/data/banner'
import { MARKET_FROM_RUN, MARKET_MULT, marketOfDay, utcDateKey } from '../../game/run/contracts'
import { companyOpen, standingOf } from '../../game/run/standing'
import { CHARTER_FEE, CHARTER_NAME, charterDoor } from '../../game/run/charter'
import { militiaTagline } from '../../game/run/militia'
import { useGameStore } from '../../state/gameStore'
import { useMetaStore } from '../../state/metaStore'
import { useSettingsStore } from '../../state/settingsStore'
import { Icon } from '../Icon'
import { Banner, Crest, Lock, SovereignCrest } from '../pixel'
import { useMedia } from '../pointer'
import { UpdateNotice } from '../UpdateNotice'
import { TradeMap } from '../attract/TradeMap'
import { roadViews, type Rect } from '../attract/mapRules'
import { Gold } from './contracts/parts'
import { useMenuStaged, useReveal } from './staging'
import type { Offer } from './offers'

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
 * The menu (the mercenary company, build step 4): the menu floats over the
 * TRADE MAP (`ui/attract/TradeMap.tsx`) — your HQ and the five company roads,
 * lit by your standing — as in the approved mockups `trade/r3/1-menu-*.png`.
 *
 * Phone: the wordmark and your militia's name on top, the map in the open
 * middle, and a sheet at the bottom: today's market, the charter's progress,
 * the secondary places as one row of tiles, one line of why, and the CTA.
 * Desk (`shell-wide.css`): the same blocks in a left-hand column with your
 * standing with each company under them; the map takes the rest.
 *
 * The map is told where it is seen through: the `.mn-window` box, measured,
 * is the open area its roads fan out to fill.
 *
 * Reads only existing selectors: standing (`metaStore.standing`), the market
 * of the day (`contracts.marketOfDay`), the charter's progress
 * (`charter.charterDoor`: the Sovereign Route's meter, or its open door) and the
 * militia (`metaStore.militia`). The rows are the menu offers (`offers.ts`),
 * whatever they are, drawn as tiles.
 *
 * The staggered reveal (October 2026, `state/staging.revealOf`): the market of
 * the day shows from the fifth finished contract — until then its line is
 * locked and counts the contracts to go — and a locked tile (the HQ, the
 * crates) says on its own line what opens it.
 */
export function MenuScreen({ offers, onMilitia, onCharter }: { offers: Offer[]; onMilitia: () => void; onCharter: () => void }) {
  const primary = offers.find((o) => o.id === 'run')
  const tiles = offers.filter((o) => o.id !== 'run')
  const xp = useMetaStore((s) => s.standing)
  const bank = useMetaStore((s) => s.bank)
  const skills = useMetaStore((s) => s.skills)
  const items = useMetaStore((s) => s.items)
  const militia = useMetaStore((s) => s.militia)
  const openContracts = useGameStore((s) => s.openContracts)
  const staged = useMenuStaged()
  const reveal = useReveal()
  const runs = useMetaStore((s) => s.stats.runsCompleted)
  const motion = useMenuMotion()

  const standing = useMemo(() => Object.fromEntries(COMPANY_IDS.map((c) => [c, standingOf(xp, c)])) as Record<CompanyId, number>, [xp])
  const hiring = useMemo(() => Object.fromEntries(COMPANY_IDS.map((c) => [c, companyOpen(c, xp)])) as Record<CompanyId, boolean>, [xp])
  const roads = useMemo(() => roadViews({ standing, hiring, firstRun: staged, first: FIRST_COMPANY }), [standing, hiring, staged])
  // Read once per mount: a menu left open past midnight keeps its day.
  const [hot] = useState<CompanyId>(() => marketOfDay(utcDateKey()))
  const charter = useMemo(() => charterDoor({ skills, items: items ?? [] }), [skills, items])
  const hiringCount = COMPANY_IDS.filter((c) => hiring[c]).length
  const allLit = COMPANY_IDS.every((c) => standing[c] > 0)
  // A road's label: the free escort on a first launch, that company's contracts after.
  const pick = (company: CompanyId) => (staged ? primary?.action?.run() : openContracts({ company }))

  // The open area the map's roads fill: the `.mn-window` box, in the map's coordinates.
  const pageRef = useRef<HTMLDivElement>(null)
  const winRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<Rect | null>(null)
  useEffect(() => {
    const page = pageRef.current
    const win = winRef.current
    if (!page || !win) return
    const measure = () => {
      const p = page.getBoundingClientRect()
      const w = win.getBoundingClientRect()
      const next = { x: w.left - p.left, y: w.top - p.top, w: w.width, h: w.height }
      setOpen((o) => (o && Math.abs(o.x - next.x) < 1 && Math.abs(o.y - next.y) < 1 && Math.abs(o.w - next.w) < 1 && Math.abs(o.h - next.h) < 1 ? o : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(page)
    ro.observe(win)
    return () => ro.disconnect()
  }, [])

  const hotCo = companyById(hot)
  const today = !staged && !reveal.market ? (
    <div className="mn-today is-locked" role="note" aria-label={`Market of the day: opens after ${MARKET_FROM_RUN} finished contracts. ${Math.min(runs, MARKET_FROM_RUN)} of ${MARKET_FROM_RUN} so far.`}>
      <Lock scale={2} />
      <span aria-hidden="true">
        <b>Market of the day</b> · after {MARKET_FROM_RUN} contracts
      </span>
      <span className="mn-today-r" aria-hidden="true">
        {Math.min(runs, MARKET_FROM_RUN)}/{MARKET_FROM_RUN}
      </span>
    </div>
  ) : staged ? (
    <div className="mn-today">
      <Crest company={FIRST_COMPANY} scale={1} />
      <span>
        <b>{companyById(FIRST_COMPANY).name} is hiring</b> for its {companyById(FIRST_COMPANY).noun} road
      </span>
    </div>
  ) : (
    <button
      type="button"
      className="mn-today"
      onClick={() => openContracts({ company: hot })}
      disabled={!hiring[hot]}
      aria-label={`${hotCo.goods} pays ×${MARKET_MULT} today. ${hiring[hot] ? `See ${hotCo.name}'s contracts` : `${hotCo.name} is not hiring yet`}`}
    >
      <Crest company={hot} scale={1} locked={!hiring[hot]} />
      <b>
        {hotCo.goods} pays ×{MARKET_MULT} today
      </b>
      <span className="mn-today-r">
        {!hiring[hot] ? 'Not hiring yet' : allLit ? 'All five roads lit' : standing[hot] > 0 ? `Standing ${standing[hot]}` : 'Hiring'}
      </span>
    </button>
  )
  // The charter (build step 5): locked, its meter and what opens it, so the
  // goal reads as a goal; open, the way to its contract. Either way it leads
  // to the charter's page.
  const pct = Math.floor(charter.progress * 100)
  const charterLine = staged ? null : charter.open ? (
    <button type="button" className="mn-charter mn-charter-btn is-open" onClick={onCharter} aria-label={`${CHARTER_NAME}: open. Charter it for ${CHARTER_FEE} gold.`}>
      <SovereignCrest scale={1} />
      <b aria-hidden="true">{CHARTER_NAME}</b>
      <span className="mn-charter-v" aria-hidden="true">
        Open · <Gold n={CHARTER_FEE} scale={1} />
      </span>
    </button>
  ) : (
    <button
      type="button"
      className="mn-charter mn-charter-btn"
      onClick={onCharter}
      aria-label={`${CHARTER_NAME}: ${pct}% unlocked. It opens when every skill and item is unlocked.`}
    >
      <Lock scale={2} />
      <b aria-hidden="true">{CHARTER_NAME}</b>
      <span className="mn-meter" aria-hidden="true">
        <i style={{ width: `${Math.max(2, pct)}%` }} />
      </span>
      <span className="mn-charter-v" aria-hidden="true">
        {pct}%
      </span>
      <span className="mn-charter-why" aria-hidden="true">
        Opens when every skill and item is unlocked
      </span>
    </button>
  )
  const locked = tiles.filter((o) => o.locked)
  const why = staged ? (
    <p className="mn-why">
      Free: <b>you’re paid at every city you reach</b>
    </p>
  ) : (
    <p className="mn-why">
      <b>
        {hiringCount} {hiringCount === 1 ? 'company' : 'companies'} hiring
      </b>{' '}
      · the free escort is always on offer
    </p>
  )

  return (
    <div className={`pg mn${staged ? ' is-first' : ''}`} ref={pageRef}>
      <div className="mn-map">
        <TradeMap
          roads={roads}
          market={staged || !reveal.market ? null : { company: hot, mult: MARKET_MULT }}
          banner={militia ?? DEFAULT_BANNER}
          open={open}
          motion={motion}
          firstRun={staged}
          onPick={pick}
        />
      </div>
      <div className="mn-shade" aria-hidden="true" />

      <header className="mn-head">
        <h1 className="t-title" tabIndex={-1}>
          {/* Stacked at every size: on one line the name runs into the bank
              chip from 430px phones up through tablets. */}
          <span className="mn-title-line">Merchant</span> <span className="mn-title-line">Mercenaries</span>
        </h1>
        <p className="t-sub">{militiaTagline(militia)}</p>
        {/* The bank is named after the first contract (LS3/LS4). */}
        {!staged && (
          <span className="mn-bank" role="img" aria-label={`${bank} gold in the bank`}>
            <Gold n={bank} />
            <span className="mn-bank-word" aria-hidden="true">
              in the bank
            </span>
          </span>
        )}
        <UpdateNotice />
      </header>

      <div className="mn-window" ref={winRef} aria-hidden="true" />

      <div className="mn-sheet">
        {!staged && !militia && (
          // The one coach tip for the banner: after the first finished contract, until it is raised.
          <div className="mn-tip" role="note">
            <Banner look={DEFAULT_BANNER} scale={2} />
            <p>
              <b>Your militia has earned a name.</b> Pick one and raise your banner: it flies over your wagons.
            </p>
            <button type="button" className="mn-tip-go" onClick={onMilitia}>
              Raise it
            </button>
          </div>
        )}
        {today}
        {charterLine}
        <div className="mn-tiles">
          {tiles.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`mn-tile${o.locked ? ' is-locked' : ''}`}
              aria-disabled={o.locked ? 'true' : undefined}
              aria-label={o.locked ? `${o.title}: ${o.locked}` : undefined}
              onClick={() => (o.locked ? undefined : o.action?.run())}
            >
              {o.icon && <Icon name={o.icon} lg />}
              <span>{o.title}</span>
            </button>
          ))}
        </div>
        {/* One line per locked tile: each says what opens it (the staggered reveal). */}
        {locked.map((o) => (
          <p key={o.id} className="mn-why mn-locked">{`${o.title}: ${o.locked!.charAt(0).toLowerCase()}${o.locked!.slice(1)}`}</p>
        ))}
        {why}
        <button type="button" className="pg-cta mn-cta" onClick={() => primary?.action?.run()} disabled={!primary?.action}>
          {staged ? 'Take the free escort' : 'Choose a Contract'}
        </button>
      </div>

      {!staged && (
        <section className="mn-standings" aria-label="Standing with the companies">
          <p className="mn-eyebrow">Standing with the companies</p>
          {COMPANY_IDS.map((c) => {
            const co = companyById(c)
            const s = standing[c]
            const lit = s > 0
            return (
              <div key={c} className={`mn-st${hiring[c] ? '' : ' is-locked'}`} style={{ '--co': co.color } as CSSProperties}>
                <Crest company={c} scale={2} locked={!hiring[c]} />
                <div>
                  <div className="mn-st-name">{hiring[c] ? `${co.name} · ${co.goods}` : 'Uncharted road'}</div>
                  <div className="mn-st-bar" aria-hidden="true">
                    <i style={{ width: `${s * 10}%` }} />
                  </div>
                </div>
                <span className="mn-st-n">{lit ? s : hiring[c] ? 'Hiring' : '—'}</span>
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}
