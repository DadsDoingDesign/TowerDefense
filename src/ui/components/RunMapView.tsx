import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { nodeMeta, type MapNode } from '../../game/data/runmap'
import { useGameStore } from '../../state/gameStore'
import { encounterThreat } from '../../game/run/threat'
import { legMult, type DifficultyRules } from '../../game/run/watch'
import { cityOfLayer, contractRules } from '../../game/run/contracts'
import { openingNodeOf } from '../../game/run/map'
import { routeOf } from '../../game/run/charter'
import { NODE_ICON, strengthPct, strengthShort } from '../channels'
import { ArmourMark } from '../ArmourMark'
import { Icon } from '../Icon'
import { frontierScrollTop, MARCH_SETTLE_MS, openingFocus, useMapFocus } from '../shell/mapFocus'
import { nodeModFor } from '../shell/encounterPreview'

/**
 * The Threat a fight on this node is fought at (M5, re-based in Phase 3b).
 *
 * Threat multiplies the HP of every enemy in a wave, and it used to be a
 * compounding bill for the ROUTE — each battle, elite, visit and accepted offer
 * multiplied it for the rest of the run, so the chip quoted the step a node
 * would charge. Threat now follows the road alone (`run/threat.ts`): every node
 * on a layer is fought at the same Threat, whatever route reached it. So the
 * chip says the one number that matters on a fight — how hard it is — and
 * stops appearing on stops, which cost no Threat at all.
 */
const FIGHT_NODES = new Set(['battle', 'elite', 'miniboss', 'boss'])

const nodeThreat = (n: { type: MapNode['type']; layer: number }, rules: DifficultyRules): number | null =>
  FIGHT_NODES.has(n.type) ? Math.round(encounterThreat(n, rules.startThreat) * legMult(rules, n.layer) * 10) / 10 : null

const GAP = 104 // vertical px between layers
const PAD_X = 44
// 46 put the top row's centre 46px from the scroll box's top edge, and a node
// is ~58px tall with its threat chip — so the boss row's label sat under the
// header band's bottom border and read as clipped (Wave 1). 62 clears it.
const PAD_Y = 62

/** Slay-the-Spire style vertical node map. Start at the bottom, boss at the top. */
export function RunMapView() {
  const runMap = useGameStore((s) => s.runMap)
  const cleared = useGameStore((s) => s.clearedNodeIds)
  const reachable = useGameStore((s) => s.reachableNodeIds)
  const currentNodeId = useGameStore((s) => s.currentNodeId)
  const selectNode = useGameStore((s) => s.selectNode)
  const crates = useGameStore((s) => s.contract?.crates ?? 0)
  const charter = useGameStore((s) => !!s.contract?.charter)
  const contract = useGameStore((s) => s.contract)
  const runSeed = useGameStore((s) => s.runSeed)
  const rules = contractRules({ crates, charter })
  // The act bosses are the route's cities (the mercenary company): named on the map.
  const towns = useGameStore((s) => (s.contract ? routeOf(s.contract).towns : null))
  const focusedId = useMapFocus((s) => s.nodeId)
  const focus = useMapFocus((s) => s.focus)

  /*
   * Look first, march second (Wave 1). A tap used to call `selectNode`, which
   * commits the march, so a fork could only be read by walking into it. The
   * first tap (or keyboard focus) now fills the Context panel with what waits
   * there; tapping the same node again — after the settle window, so a
   * double-tap is still just a look — or the panel's "March" button commits.
   */
  const onNode = (id: string) => {
    const f = useMapFocus.getState()
    if (f.nodeId === id && !f.auto && Date.now() - f.at >= MARCH_SETTLE_MS) {
      focus(null)
      selectNode(id)
      return
    }
    // A tap on the stop the map opened on is the player's own look at it.
    if (f.nodeId !== id || f.auto) focus(id)
  }
  // The map opens on a stop you can march to (Oct 2026 review): the Context
  // panel says what is ahead, and the CTA names it, from the first frame. A
  // new map, a resumed run or a cleared stop (a new row of choices) re-offers.
  const reachKey = reachable.join(',')
  useEffect(() => {
    const id = openingFocus(reachable, cleared)
    if (id) useMapFocus.getState().offer(id)
    else focus(null)
  }, [runMap, reachKey, focus])

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

  /*
   * The opening fight IS the start (Oct 2026; the designer: "the start is what
   * the first battle is, and where it should stay"): the bare start node and
   * its one road are not drawn, and the opening fight is drawn as the Start,
   * on the bottom row. An older map (its first layer forked) draws as before.
   */
  const opening = openingNodeOf(runMap)
  const base = opening ? opening.layer : 0
  const shown = opening ? runMap.nodes.filter((n) => n.layer >= base) : runMap.nodes
  const shownIds = new Set(shown.map((n) => n.id))

  const layers = runMap.layers
  const height = (layers - 1 - base) * GAP + PAD_Y * 2

  const posOf = (layer: number, ny: number) => ({
    x: PAD_X + ny * (innerW - PAD_X * 2),
    y: PAD_Y + (layers - 1 - layer) * GAP,
  })
  const nodePos = new Map(runMap.nodes.map((n) => [n.id, posOf(n.layer, n.ny)]))

  /*
   * Cleared ground and the country ahead (the designer: "you are clearing out
   * an area first — show the row you select from, and below, as cleared, and
   * the area above as danger, not cleared yet"). The line sits halfway between
   * your row and the next.
   */
  const here = runMap.nodes.find((n) => n.id === currentNodeId)
  const frontierY = here ? Math.max(0, posOf(Math.max(here.layer, base), 0).y - GAP / 2) : null

  // The scroll box's own height: the Stage settles after the battle shell
  // hands it back, so the first measurement after a win can be stale.
  const [boxH, setBoxH] = useState(0)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setBoxH(el.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Auto-scroll so the reachable frontier is fully visible (3.7).
  useEffect(() => {
    const scroll = scrollRef.current
    const cur = runMap.nodes.find((n) => n.id === currentNodeId)
    if (!scroll || !cur || !boxH) return
    const reachYs = runMap.nodes.filter((n) => reachable.includes(n.id)).map((n) => posOf(n.layer, n.ny).y)
    scroll.scrollTo({ top: frontierScrollTop({ curY: posOf(cur.layer, cur.ny).y, reachYs, box: boxH }), behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNodeId, innerW, boxH, reachable])

  const clearedSet = new Set(cleared)
  const reachableSet = new Set(reachable)

  return (
    <div className="run-map-scroll" ref={scrollRef}>
      <div className="run-map-inner" ref={innerRef} style={{ height }}>
        {frontierY != null && frontierY > 0 && (
          <>
            <div className="rm-zone danger" style={{ height: frontierY }} aria-hidden="true" />
            <div className="rm-zone cleared" style={{ top: frontierY }} aria-hidden="true" />
            {/* Captions, not controls: written up the map's left margin, where
                no node stands, one rising from the line into the ground ahead,
                one falling from it into the ground behind. */}
            <span className="rm-zone-tag danger field-k" style={{ top: frontierY }}>
              Not cleared yet
            </span>
            <span className="rm-zone-tag cleared field-k" style={{ top: frontierY }}>
              Cleared
            </span>
          </>
        )}
        <svg className="run-map-edges" width={innerW} height={height}>
          {runMap.edges.filter((e) => shownIds.has(e.from) && shownIds.has(e.to)).map((e, i) => {
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
                /* Future roads were 12% cream — 1.3:1 on the ground, so the
                   shape of the map ahead was a guess. 38% keeps them clearly
                   behind the lit route while still reading (Wave 1). */
                stroke={active ? 'rgba(224,172,76,0.7)' : 'rgba(233,205,150,0.38)'}
                strokeWidth={active ? 3 : 2}
              />
            )
          })}
        </svg>

        {shown.map((n) => {
          const p = nodePos.get(n.id)!
          // Under Banner 2 a "battle" node IS an elite — same glyph, same hue,
          // same word, or the map is drawing a wave the run will not field.
          // The opening fight wears the start's look and name.
          const isOpening = n.id === opening?.id
          const meta = nodeMeta(isOpening ? 'start' : n.type)
          const city = towns ? cityOfLayer(n.layer) : null
          const town = city != null && (n.type === 'miniboss' || n.type === 'boss') ? towns![city] : null
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
          const threat = nodeThreat(n, rules)
          const isFocused = focusedId === n.id
          // What every goblin here wears (Plated, Warded, Swift), on every
          // fight still ahead, near or far: a road is planned from the map.
          const mod = isCleared || isCurrent ? null : nodeModFor({ runSeed, runMap, contract }, n)
          return (
            <button
              key={n.id}
              className={`map-node ${state} type-${isOpening ? 'start' : n.type} ${isFocused ? 'focused' : ''}`}
              style={{ left: p.x, top: p.y, borderColor: meta.color }}
              disabled={!isReachable}
              aria-pressed={isReachable ? isFocused : undefined}
              onClick={() => onNode(n.id)}
              onFocus={() => {
                if (isReachable && useMapFocus.getState().nodeId !== n.id) focus(n.id)
              }}
              /* `title` does not exist on a touch device, which is every device
                 this ships to — so the node's kind, its state and what it costs
                 the rest of the run all belong in the accessible name. */
              /* A special's chip is the cost of *visiting* it; accepting what it
                 offers composes another ×1.05 on top. The chip has no room to
                 say so, but the accessible name does, and the offer itself
                 spells it out. */
              aria-label={`${meta.label}${town ? `, ${town}` : ''}${mod ? `, ${mod.prefix}: ${mod.blurb}` : ''}${
                threat && strengthPct(threat) > 0
                  ? `, enemy strength ${strengthShort(threat)}`
                  : ''
              } — ${
                isCurrent
                  ? 'where you stand'
                  : isCleared
                    ? 'cleared'
                    : isReachable
                      ? isFocused
                        ? 'previewing — select again to march'
                        : 'you can march here — select to preview'
                      : 'out of reach'
              }`}
            >
              {/* The node's pixel mark (Wave 1). This was `meta.glyph` — ⚔ ◆ ☠
                  ♛ ⟡ ❖ ＋, system-font characters in whatever face the phone
                  had, and `⟡` doubled as the gold mark. */}
              <span className="mn-glyph">
                <Icon name={NODE_ICON[isOpening ? 'start' : n.type] ?? 'depth'} />
              </span>
              {/* The armour tab: the modifier's name, and the damage type this
                  fight's goblins shrug off, struck through (Swift: its speed).
                  The Context panel says the rest when the node is focused. */}
              {mod && (
                <span className={`mn-armour ${mod.id}`} aria-hidden>
                  <ArmourMark mod={mod.id} />
                  {mod.prefix}
                </span>
              )}
              <span className={`mn-label${town ? ' town' : ''}`}>{town ?? meta.label}</span>
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
              {/* No "+0%": enemies at their starting strength need no badge,
                  and a first map says nothing it has not introduced (LS3). */}
              {threat && isReachable && strengthPct(threat) > 0 && (
                <span className="mn-threat" aria-hidden>
                  <Icon name="threat" />{strengthShort(threat)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
