import type { CSSProperties } from 'react'
import { companyById } from '../../../game/data/companies'
import { cargoPct, CITY_COUNT, cityPay, cratesLeftAfter } from '../../../game/run/contracts'
import { ACT_LAYERS, RUN_LAYERS } from '../../../game/run/threat'
import { useGameStore } from '../../../state/gameStore'
import { companyVar, SOVEREIGN_VAR } from '../../channels'
import { Crate, Crest, Lantern, SovereignCrest } from '../../pixel'
import { CHARTER_NAME, CHARTER_PAYOUT, CHARTER_TOWNS, SOVEREIGN_COLOR } from '../../../game/run/charter'
import { Gold } from './parts'

/**
 * The road on the run map (mockup `trade/r3/4-run.png`): which company's
 * road, how far along it the caravan is, the three cities as lanterns (lit
 * once reached), what the last one paid and what the next one will pay at the
 * cargo the wagons carry now. It sits above the node map, so "where am I on
 * the contract" is always one glance away.
 */
export function RoutePanel() {
  const c = useGameStore((s) => s.contract)
  const layer = useGameStore((s) => s.runMap.nodes.find((n) => n.id === s.currentNodeId)?.layer ?? 0)
  const baseHp = useGameStore((s) => s.baseHp)
  const maxBaseHp = useGameStore((s) => s.maxBaseHp)
  if (!c) return null
  if (!c.company) return <CharterRoute layer={layer} paid={c.paid.length} />
  const co = companyById(c.company)
  const last = RUN_LAYERS - 1
  const cargo = cargoPct(baseHp, maxBaseHp)
  const next = c.paid.length < CITY_COUNT ? c.paid.length : null
  const nextPay = next != null ? cityPay(c, next, cargo).total : 0
  const stopsToNext = next != null ? Math.max(0, (next + 1) * ACT_LAYERS - layer) : 0
  const onWagons = cratesLeftAfter(c.crates, c.paid.length)
  const lastPaid = c.paid.length ? c.paid.length - 1 : null
  return (
    <div className="ct-route" style={{ '--co': companyVar(c.company) } as CSSProperties} aria-label={`${co.name}: ${co.goods} road, depth ${layer} of ${last}`}>
      <div className="ct-route-top">
        <Crest company={c.company} scale={1} />
        <b>{co.goods} road</b>
        <span>
          · {c.crates ? `${c.crates} crate${c.crates === 1 ? '' : 's'}` : 'escort'} · depth {layer}/{last}
        </span>
        {c.crates > 0 && (
          <span className="ct-route-crates" aria-label={`${onWagons} of ${c.crates} crates still on the wagons`}>
            {Array.from({ length: c.crates }, (_, i) => (
              <Crate key={i} color={co.color} scale={1} ghost={i >= onWagons} />
            ))}
          </span>
        )}
      </div>
      <Road towns={co.towns} color={co.color} layer={layer} reached={c.paid.length} />
      <p className="ct-route-next">
        {lastPaid != null && (
          <span className="ok">
            ✓ {co.towns[lastPaid]} paid {c.paid[lastPaid]}
            {next != null ? ' · ' : ''}
          </span>
        )}
        {next != null && (
          <span>
            Next: {co.towns[next]}, {stopsToNext} stop{stopsToNext === 1 ? '' : 's'} · <Gold n={nextPay} scale={1} />
          </span>
        )}
      </p>
    </div>
  )
}

/** The road itself: a lit track, the three cities as lanterns (lit once reached), and the caravan. */
function Road({ towns, color, layer, reached }: { towns: readonly string[]; color: string; layer: number; reached: number }) {
  const last = RUN_LAYERS - 1
  return (
    <div className="ct-road" aria-hidden="true">
      <span className="ct-road-track" />
      <span className="ct-road-lit" style={{ width: `${(layer / last) * 100}%` }} />
      {towns.map((t, i) => (
        <span key={t} className={`ct-road-city${i === CITY_COUNT - 1 ? ' end' : ''}${i < reached ? ' paid' : ''}`} style={{ left: `${(((i + 1) * ACT_LAYERS) / last) * 100}%` }}>
          <Lantern lit={i < reached} scale={2} />
          <small>{t}</small>
        </span>
      ))}
      <span className="ct-road-me" style={{ left: `${(layer / last) * 100}%` }}>
        <Crate color={color} scale={2} />
      </span>
    </div>
  )
}

/**
 * The Sovereign Route on the run map (the endgame charter): the in-run marker.
 * The crown crest and the cyan rail say whose road this is — your own — and the
 * line under it says the one rule that matters on the road: the cities are
 * waypoints, the destination pays everything, a fall pays nothing.
 */
function CharterRoute({ layer, paid }: { layer: number; paid: number }) {
  const last = RUN_LAYERS - 1
  const next = paid < CITY_COUNT ? paid : null
  const stopsToNext = next != null ? Math.max(0, (next + 1) * ACT_LAYERS - layer) : 0
  const dest = CHARTER_TOWNS[CITY_COUNT - 1]
  return (
    <div className="ct-route sovereign" style={{ '--co': SOVEREIGN_VAR } as CSSProperties} aria-label={`${CHARTER_NAME}: all or nothing, depth ${layer} of ${last}`}>
      <div className="ct-route-top">
        <SovereignCrest scale={1} />
        <b>{CHARTER_NAME}</b>
        <span>· all or nothing · depth {layer}/{last}</span>
      </div>
      <Road towns={CHARTER_TOWNS} color={SOVEREIGN_COLOR} layer={layer} reached={paid} />
      <p className="ct-route-next">
        {next != null && next < CITY_COUNT - 1 ? (
          <span>
            {CHARTER_TOWNS[next]} in {stopsToNext} stop{stopsToNext === 1 ? '' : 's'} · only {dest} pays: <Gold n={CHARTER_PAYOUT} scale={1} />
          </span>
        ) : (
          <span>
            {dest}, {stopsToNext} stop{stopsToNext === 1 ? '' : 's'} · pays <Gold n={CHARTER_PAYOUT} scale={1} />
          </span>
        )}
      </p>
    </div>
  )
}
