import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { nodeMeta } from '../../game/data/runmap'
import { useGameStore } from '../../state/gameStore'

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
                stroke={active ? 'rgba(240,168,104,0.5)' : 'rgba(255,255,255,0.1)'}
                strokeWidth={active ? 2.5 : 1.5}
              />
            )
          })}
        </svg>

        {runMap.nodes.map((n) => {
          const p = nodePos.get(n.id)!
          const meta = nodeMeta(n.type)
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
          return (
            <button
              key={n.id}
              className={`map-node ${state} type-${n.type}`}
              style={{ left: p.x, top: p.y, borderColor: meta.color }}
              disabled={!isReachable}
              onClick={() => selectNode(n.id)}
              title={meta.label}
            >
              <span className="mn-glyph" style={{ color: meta.color }}>
                {meta.glyph}
              </span>
              <span className="mn-label">{meta.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
