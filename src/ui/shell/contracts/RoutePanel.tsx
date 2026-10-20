import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { companyById } from '../../../game/data/companies'
import { cargoPct, CITY_COUNT, cityPay, cratesLeftAfter } from '../../../game/run/contracts'
import type { RunAsk } from '../../../game/run/asks'
import { ACT_LAYERS, RUN_LAYERS } from '../../../game/run/threat'
import { useGameStore } from '../../../state/gameStore'
import { companyVar, SOVEREIGN_VAR } from '../../channels'
import { Crate, Crest, Lantern, SovereignCrest } from '../../pixel'
import { CHARTER_NAME, CHARTER_PAYOUT, CHARTER_TOWNS, routeOf, SOVEREIGN_COLOR } from '../../../game/run/charter'
import { useMapFocus } from '../mapFocus'
import { Gold } from './parts'
import { AskChips, AskProgress, asksSaid } from './AskParts'

/**
 * The road on the run map (mockup `trade/r3/4-run.png`): which company's
 * road, how far along it the caravan is, the three cities as lanterns (lit
 * once reached) — under each city what it paid, under the next one how many
 * stops away it is and what it will pay at the cargo the wagons carry now —
 * and the contract's asks as small chips. It sits above the node map, so
 * "where am I on the contract" is always one glance away.
 *
 * Quiet context, not the subject (the map-header pass, Oct 2026; the
 * designer: "the top info pulls more attention than the current selection
 * info"): two lines — the road's name with the asks' chips, then the road —
 * in muted ink, and the focused node's preview in the Context panel leads.
 * The depth is the HUD's, the next town is the road's own label, so neither
 * is said again. A tap anywhere on it opens the asks' full rows under the
 * road; the panel then grows OVER the map (its slot keeps the closed height,
 * so the map never moves) and closes on a second tap, Escape, a tap outside
 * or a new focus on the map.
 */
export function RoutePanel() {
  const c = useGameStore((s) => s.contract)
  const layer = useGameStore((s) => s.runMap.nodes.find((n) => n.id === s.currentNodeId)?.layer ?? 0)
  const baseHp = useGameStore((s) => s.baseHp)
  const maxBaseHp = useGameStore((s) => s.maxBaseHp)
  const gold = useGameStore((s) => s.gold)
  if (!c) return null
  const last = RUN_LAYERS - 1
  const cargo = cargoPct(baseHp, maxBaseHp)
  const facts = { contract: c, gold }
  const asks: RouteAsks | null = c.asks?.length ? { list: c.asks, facts, cargo, dest: routeOf(c).towns[CITY_COUNT - 1], charter: !!c.charter } : null
  const next = c.paid.length < CITY_COUNT ? c.paid.length : null
  const stopsToNext = next != null ? Math.max(0, (next + 1) * ACT_LAYERS - layer) : 0

  if (!c.company) {
    const dest = CHARTER_TOWNS[CITY_COUNT - 1]
    // Only the destination pays (all or nothing): a waypoint's note is its
    // distance, the destination's its payout.
    const notes = CHARTER_TOWNS.map((_, i) =>
      i === CITY_COUNT - 1 ? (
        <>
          {i === next && <Stops n={stopsToNext} />}
          <Gold n={CHARTER_PAYOUT} scale={1} />
        </>
      ) : i === next ? (
        <Stops n={stopsToNext} />
      ) : null,
    )
    return (
      <RouteFrame
        className="sovereign"
        co={SOVEREIGN_VAR}
        label={`${CHARTER_NAME}: all or nothing, only ${dest} pays ${CHARTER_PAYOUT} gold. Depth ${layer} of ${last}`}
        head={
          // The HUD's Sovereign marker names the road; the head says its rule.
          <>
            <SovereignCrest scale={1} />
            <b className="ct-route-name">All or nothing</b>
          </>
        }
        road={<Road towns={CHARTER_TOWNS} color={SOVEREIGN_COLOR} layer={layer} reached={c.paid.length} notes={notes} />}
        asks={asks}
      />
    )
  }

  const co = companyById(c.company)
  const nextPay = next != null ? cityPay(c, next, cargo).total : 0
  const onWagons = cratesLeftAfter(c.crates, c.paid.length)
  const notes = co.towns.map((_, i) =>
    i < c.paid.length ? (
      <span className="ok">
        ✓ <Gold n={c.paid[i]} scale={1} />
      </span>
    ) : i === next ? (
      <>
        <Stops n={stopsToNext} />
        <Gold n={nextPay} scale={1} />
      </>
    ) : null,
  )
  const stake = c.crates ? `${c.crates} crate${c.crates === 1 ? '' : 's'}, ${onWagons} still on the wagons` : 'escort'
  const paidSaid = c.paid.map((p, i) => `${co.towns[i]} paid ${p}`)
  const nextSaid = next != null ? `next ${co.towns[next]} in ${stopsToNext} stop${stopsToNext === 1 ? '' : 's'}, pays ${nextPay}` : null
  return (
    <RouteFrame
      co={companyVar(c.company)}
      label={[`${co.name}: ${co.goods} road to ${co.towns[CITY_COUNT - 1]}, ${stake}`, `depth ${layer} of ${last}`, ...paidSaid, nextSaid].filter(Boolean).join(', ')}
      head={
        <>
          <Crest company={c.company} scale={1} />
          <b className="ct-route-name">{co.goods} road</b>
          {c.crates > 0 ? (
            // The crates ARE the stake: one mark each, ghosted once delivered.
            <span className="ct-route-crates">
              {Array.from({ length: c.crates }, (_, i) => (
                <Crate key={i} color={co.color} scale={1} ghost={i >= onWagons} />
              ))}
            </span>
          ) : (
            <span className="ct-route-stake">· escort</span>
          )}
        </>
      }
      road={<Road towns={co.towns} color={co.color} layer={layer} reached={c.paid.length} notes={notes} />}
      asks={asks}
    />
  )
}

interface RouteAsks {
  list: readonly RunAsk[]
  facts: Parameters<typeof AskProgress>[0]['facts']
  cargo: number
  dest: string
  charter: boolean
}

/** "4 stops" under the next city: how far the caravan has to go. */
const Stops = ({ n }: { n: number }) => (n > 0 ? <span>{`${n} stop${n === 1 ? '' : 's'}`}</span> : null)

/**
 * The panel's frame and its one control: the head and the road, as one button
 * when the contract has asks (its name says the road and every ask in full),
 * and the asks' rows under it while it is open.
 */
function RouteFrame({ co, className, label, head, road, asks }: { co: string; className?: string; label: string; head: ReactNode; road: ReactNode; asks: RouteAsks | null }) {
  const slot = useRef<HTMLDivElement>(null)
  const drawer = useId()
  // The closed panel's height while open: the slot holds it, so the map under
  // the panel keeps its box and the open panel lies over the map.
  const [held, setHeld] = useState<number | null>(null)
  const open = held != null
  const close = () => setHeld(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    const onDown = (e: PointerEvent) => !slot.current?.contains(e.target as Node) && close()
    // A new focus on the map is the player reading something else.
    const unfocus = useMapFocus.subscribe((s, was) => s.nodeId !== was.nodeId && close())
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown, true)
      unfocus()
    }
  }, [open])

  const body = (
    <>
      <span className="ct-route-top">
        {head}
        {asks && (
          <span className="ct-route-asks">
            <AskChips asks={asks.list} facts={asks.facts} cargo={asks.cargo} />
            <span className="ct-route-more" aria-hidden="true">
              {open ? '▴' : '▾'}
            </span>
          </span>
        )}
      </span>
      {road}
    </>
  )
  return (
    <div className="ct-route-slot" ref={slot} style={open ? { height: held } : undefined}>
      <div className={`ct-route${className ? ` ${className}` : ''}${open ? ' open' : ''}`} style={{ '--co': co } as CSSProperties} role="group" aria-label={label}>
        {asks ? (
          <button
            type="button"
            className="ct-route-btn"
            aria-expanded={open}
            aria-controls={drawer}
            aria-label={`Asks: ${asksSaid(asks.list, asks.facts, asks.cargo, asks.dest)}`}
            onClick={() => setHeld(open ? null : (slot.current?.offsetHeight ?? null))}
          >
            {body}
          </button>
        ) : (
          <div className="ct-route-btn">{body}</div>
        )}
        {asks && (
          <div id={drawer} className="ct-route-drawer" hidden={!open}>
            {open && <AskProgress asks={asks.list} facts={asks.facts} cargo={asks.cargo} charter={asks.charter} dest={asks.dest} />}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * The road itself: a lit track, the three cities as lanterns (lit once
 * reached) with a small note under each name (`notes`: what it paid, or how
 * far the next one is and what it pays), and the caravan.
 */
function Road({ towns, color, layer, reached, notes }: { towns: readonly string[]; color: string; layer: number; reached: number; notes: readonly ReactNode[] }) {
  const last = RUN_LAYERS - 1
  return (
    <span className="ct-road" data-next={reached} aria-hidden="true">
      <span className="ct-road-track" />
      <span className="ct-road-lit" style={{ width: `${(layer / last) * 100}%` }} />
      {towns.map((t, i) => (
        <span
          key={t}
          className={`ct-road-city${i === CITY_COUNT - 1 ? ' end' : i !== reached ? ' aside' : ''}${i < reached ? ' paid' : ''}${i === reached ? ' next' : ''}`}
          style={{ left: `${(((i + 1) * ACT_LAYERS) / last) * 100}%` }}
        >
          <Lantern lit={i < reached} scale={2} />
          <small>{t}</small>
          {notes[i] && <span className="ct-road-note">{notes[i]}</span>}
        </span>
      ))}
      <span className="ct-road-me" style={{ left: `${(layer / last) * 100}%` }}>
        <Crate color={color} scale={1} />
      </span>
    </span>
  )
}
