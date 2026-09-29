import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { nodeMeta } from '../../game/data/runmap'
import { THREAT_PER_NODE, useGameStore } from '../../state/gameStore'
import { bannerRules } from '../../state/metaStore'
import { Icon } from '../Icon'

/**
 * What marching through this node costs the rest of the run (M5).
 *
 * Threat multiplies the HP of every enemy in every wave that follows, so route
 * choice is a compounding decision — six normal nodes and six elites are not
 * the same run — and none of it was visible on the map, which made the fork
 * that matters most the one picked blind.
 *
 * **Every node the player consumes charges a step now.** `completeNode` used to
 * advance the map and nothing else, so routing through a merchant / shrine /
 * recruit skipped a difficulty step outright: the special paid a reward *and*
 * made the run cheaper, which made "take the special" close to strictly correct
 * and the map's central choice a calculator with one answer. Specials charge
 * `.special` (×1.13) for the visit, deliberately smaller than a battle step, so
 * a special is still the cheaper node without being a free one.
 *
 * This function therefore covers three of the four rows of `THREAT_PER_NODE`.
 * The fourth is the boss (×1, there is nothing after it), and `start` is not a
 * node anyone chooses.
 *
 * `THREAT_PER_CHOICE` (×1.05) is a *separate*, composing step charged only when
 * the player accepts what a special offers — it belongs to the offer, not to
 * the route, and is disclosed there (`THREAT_TAX_VISIT` in `ui/shell/offers.ts`
 * quotes both halves and their product).
 */
const SPECIAL_NODES = new Set(['merchant', 'shrine', 'recruit'])

const nodeThreat = (type: string): number | null =>
  // The step follows the node's OWN kind, which is what `completeNode` charges
  // (`threatKind` in `gameStore`). Banner 2 substitutes an elite *encounter*
  // into every battle node — the glyph below says so — but that is a rule about
  // what you fight, not a surcharge on the march, so the chip still quotes
  // ×1.42 there and it is still the truth.
  type === 'elite'
    ? THREAT_PER_NODE.elite
    : type === 'battle'
      ? THREAT_PER_NODE.normal
      : SPECIAL_NODES.has(type)
        ? THREAT_PER_NODE.special
        : null

const GAP = 104 // vertical px between layers
const PAD_X = 44
const PAD_Y = 46

/** Slay-the-Spire style vertical node map. Start at the bottom, boss at the top. */
export function RunMapView() {
  const runMap = useGameStore((s) => s.runMap)
  const cleared = useGameStore((s) => s.clearedNodeIds)
  const reachable = useGameStore((s) => s.reachableNodeIds)
  const currentNodeId = useGameStore((s) => s.currentNodeId)
  const selectNode = useGameStore((s) => s.selectNode)
  const allElite = useGameStore((s) => bannerRules(s.runBanner).allElite)

  const innerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [innerW, setInnerW] = useState(340)

  useLayoutEffect(() => {
    const el = innerRef.current
    if (!el) return
    const measure = () => setInnerW(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const layers = runMap.layers
  const height = (layers - 1) * GAP + PAD_Y * 2

  const posOf = (layer: number, ny: number) => ({
    x: PAD_X + ny * (innerW - PAD_X * 2),
    y: PAD_Y + (layers - 1 - layer) * GAP,
  })
  const nodePos = new Map(runMap.nodes.map((n) => [n.id, posOf(n.layer, n.ny)]))

  // Auto-scroll so the reachable frontier is visible.
  useEffect(() => {
    const scroll = scrollRef.current
    const cur = runMap.nodes.find((n) => n.id === currentNodeId)
    if (!scroll || !cur) return
    const y = posOf(cur.layer, cur.ny).y
    scroll.scrollTo({ top: Math.max(0, y - scroll.clientHeight * 0.65), behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNodeId, innerW])

  const clearedSet = new Set(cleared)
  const reachableSet = new Set(reachable)

  return (
    <div className="run-map-scroll" ref={scrollRef}>
      <div className="run-map-inner" ref={innerRef} style={{ height }}>
        <svg className="run-map-edges" width={innerW} height={height}>
          {runMap.edges.map((e, i) => {
            const a = nodePos.get(e.from)!
            const b = nodePos.get(e.to)!
            const active = clearedSet.has(e.from) && (clearedSet.has(e.to) || reachableSet.has(e.to))
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={active ? 'rgba(224,172,76,0.55)' : 'rgba(233,205,150,0.12)'}
                strokeWidth={active ? 2.5 : 1.5}
              />
            )
          })}
        </svg>

        {runMap.nodes.map((n) => {
          const p = nodePos.get(n.id)!
          // Under Banner 2 a "battle" node IS an elite — same glyph, same hue,
          // same word, or the map is drawing a wave the run will not field.
          const meta = nodeMeta(allElite && n.type === 'battle' ? 'elite' : n.type)
          const isCleared = clearedSet.has(n.id)
          const isReachable = reachableSet.has(n.id)
          const isCurrent = n.id === currentNodeId
          const state = isCurrent
            ? 'current'
            : isCleared
              ? 'cleared'
              : isReachable
                ? 'reachable'
                : 'locked'
          const threat = nodeThreat(n.type)
          return (
            <button
              key={n.id}
              className={`map-node ${state} type-${n.type}`}
              style={{ left: p.x, top: p.y, borderColor: meta.color }}
              disabled={!isReachable}
              onClick={() => selectNode(n.id)}
              /* `title` does not exist on a touch device, which is every device
                 this ships to — so the node's kind, its state and what it costs
                 the rest of the run all belong in the accessible name. */
              /* A special's chip is the cost of *visiting* it; accepting what it
                 offers composes another ×1.05 on top. The chip has no room to
                 say so, but the accessible name does, and the offer itself
                 spells it out. */
              aria-label={`${meta.label}${
                threat
                  ? `, raises Threat ×${threat}${SPECIAL_NODES.has(n.type) ? ' just to visit, and ×1.05 more if you take what it offers' : ''}`
                  : ''
              } — ${
                isCurrent ? 'where you stand' : isCleared ? 'cleared' : isReachable ? 'you can march here' : 'out of reach'
              }`}
            >
              <span className="mn-glyph" style={{ color: meta.color }}>
                {meta.glyph}
              </span>
              <span className="mn-label">{meta.label}</span>
              {/* Only on nodes you can actually choose between: the cost is
                  information for the fork in front of you, not decoration on
                  the twenty nodes behind and above it. */}
              {/* `⚡` before (M11). This view is rendered by the SHELL's Stage
                  band, and the shell's own Threat chip has been three climbing
                  bars since P3 — so the header said Threat with one mark and
                  the map nodes said it with another, a thumb's width apart on
                  the same screen. Same sprite, same meaning. The accessible
                  name above already spells "raises Threat ×1.05", which is why
                  this stays `aria-hidden`. */}
              {threat && isReachable && (
                <span className="mn-threat" aria-hidden>
                  <Icon name="threat" />×{threat}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
