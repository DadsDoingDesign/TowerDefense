import type { CSSProperties } from 'react'
import { companyById } from '../../../game/data/companies'
import { cargoPct, CITY_COUNT, cityPay, cratesLeftAfter } from '../../../game/run/contracts'
import { ACT_LAYERS, RUN_LAYERS } from '../../../game/run/threat'
import { useGameStore } from '../../../state/gameStore'
import { companyVar } from '../../channels'
import { Crate, Crest, Lantern } from '../../pixel'
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
      <div className="ct-road" aria-hidden="true">
        <span className="ct-road-track" />
        <span className="ct-road-lit" style={{ width: `${(layer / last) * 100}%` }} />
        {co.towns.map((t, i) => (
          <span key={t} className={`ct-road-city${i === CITY_COUNT - 1 ? ' end' : ''}${i < c.paid.length ? ' paid' : ''}`} style={{ left: `${(((i + 1) * ACT_LAYERS) / last) * 100}%` }}>
            <Lantern lit={i < c.paid.length} scale={2} />
            <small>{t}</small>
          </span>
        ))}
        <span className="ct-road-me" style={{ left: `${(layer / last) * 100}%` }}>
          <Crate color={co.color} scale={2} />
        </span>
      </div>
      <p className="ct-route-next">
        {lastPaid != null && (
          <span className="ok">
            ✓ {co.towns[lastPaid]} paid {c.paid[lastPaid]}
            {next != null ? ' · ' : ''}
          </span>
        )}
        {next != null && (
          <span>
            Next: {co.towns[next]} in {stopsToNext} stop{stopsToNext === 1 ? '' : 's'} pays <Gold n={nextPay} scale={1} />
          </span>
        )}
      </p>
    </div>
  )
}
