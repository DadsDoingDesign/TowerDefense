import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { companyById, type CompanyId } from '../../game/data/companies'
import { bannerKey, type BannerLook } from '../../game/data/banner'
import { Crest, Lock } from '../pixel'
import { useMedia } from '../pointer'
import { bakeBase, bakePixels, bakeTerrain, brightenLayers, cachedTerrain, drawFrame, glowSprite, type BrightenLayers } from './paintMap'
import { BRIGHTEN_MS, brightenEase, buildGeometry, FOCUS_FADE_MS, litBy, makeTraffic, MAP_FPS, STILL_T, type MapFocus, type MapGeometry, type Rect, type RoadView } from './mapRules'
import { boxOf, hubBoxes, placeCityLabels, placeSignposts, signPrio } from './labelLayout'

/**
 * The home's map, and since October 2026 the whole of the home: the trade map
 * fills the screen edge to edge and the home's few controls float over it
 * (`MenuScreen`). The map is the readout.
 *
 * Your HQ town at night, the five company roads running out of it to their
 * destinations — fanned west to east in the dock's order — each road lit by
 * your standing with that company and carrying traffic (`mapRules.ts` for the
 * rules, `paintMap.ts` for the pixels). The FOCUSED road (a dock slot or a
 * signpost picked it) burns in its colour while the rest of the map sinks, its
 * signpost is lit, and its three cities are named along it.
 *
 * ## Cost
 *
 *  - **One canvas**, at most {@link MAP_FPS} frames a second. A frame is one
 *    `drawImage` of the pre-lit base and a few dozen small fills; the terrain,
 *    the roads and the static light are baked once per size (and the light
 *    once per focus — a focus change re-lights the base and crossfades to it
 *    over {@link FOCUS_FADE_MS}).
 *  - **Parked when unseen**: a hidden tab, the map scrolled or laid out of
 *    view, or a phone on its side under the rotate prompt stops the loop (no
 *    rAF at all). Starting a run unmounts the menu, and with it the loop.
 *  - **Reduced motion** (the OS setting or the in-game toggle): one still
 *    frame with the traffic spread along the roads, no loop, no brighten, and
 *    a focus change is a cut.
 *
 * ## Pixel-perfect
 *
 * One map pixel is `k` WHOLE device pixels (`k = round(2 × dpr)`, so about two
 * CSS px), and the canvas's backing store is its own device-pixel box, so the
 * browser never resamples it.
 *
 * ## The brighten
 *
 * The map remembers the standing it last showed (`fieldwatch-map-seen`, a UI
 * note, not the save). When a road's standing has risen since — a contract
 * just paid it — that road brightens once over {@link BRIGHTEN_MS}: its glow
 * eases up from the old standing's to the new one's, with a flash on top.
 */
const SEEN_KEY = 'fieldwatch-map-seen'

function readSeen(): Partial<Record<CompanyId, number>> | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    const o = raw ? (JSON.parse(raw) as unknown) : null
    return o && typeof o === 'object' ? (o as Partial<Record<CompanyId, number>>) : null
  } catch {
    return null
  }
}

/** Frame timings, for the performance check (dev builds only: `window.__tradeMapPerf()`). */
const perf = { draws: [] as number[], frames: 0, since: 0, bakeMs: 0, bakes: 0, brighten: [] as number[] }
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as Window & { __tradeMapPerf?: () => unknown }).__tradeMapPerf = () => {
    const d = [...perf.draws].sort((a, b) => a - b)
    const secs = (performance.now() - perf.since) / 1000
    return {
      frames: perf.frames,
      fps: secs > 0 ? +(perf.frames / secs).toFixed(1) : 0,
      avgMs: d.length ? +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(3) : 0,
      p95Ms: d.length ? +d[Math.floor(d.length * 0.95)].toFixed(3) : 0,
      maxMs: d.length ? +d[d.length - 1].toFixed(3) : 0,
      bakeMs: +perf.bakeMs.toFixed(1),
      bakes: perf.bakes,
      brighten: perf.brighten,
    }
  }
  ;(window as Window & { __tradeMapPerfReset?: () => void }).__tradeMapPerfReset = () => {
    perf.draws = []
    perf.frames = 0
    perf.since = performance.now()
  }
}

const NO_RECTS: readonly Rect[] = []

export function TradeMap({
  roads,
  banner,
  open,
  avoid = NO_RECTS,
  motion,
  firstRun,
  focused = null,
  onPick,
}: {
  roads: RoadView[]
  banner: BannerLook
  /**
   * The part of the map the home's bar and foot leave open, CSS px from the
   * map's top-left: the roads fan out to fill it. It must depend on the
   * viewport only — never on the focus — or a pick re-frames the map and
   * re-bakes its terrain (October 2026).
   */
  open: Rect | null
  /** Overlays floating on the open area (the update notice, a coach pill): labels keep off them. */
  avoid?: readonly Rect[]
  /** False under reduced motion: one still frame. */
  motion: boolean
  firstRun: boolean
  /**
   * The road in focus: it burns in its colour, its signpost is lit and its
   * cities are named. `'all'` (the Buy Company slot) lights every road and
   * every signpost, and names no cities.
   */
  focused?: MapFocus
  /** Tap a road's signpost: focus it (the dock and the card follow). Never signs. */
  onPick?: (company: CompanyId) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const cvRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState<{ w: number; h: number; dpr: number } | null>(null)
  const [pageShown, setPageShown] = useState(() => typeof document === 'undefined' || !document.hidden)
  const [inView, setInView] = useState(true)
  // Same query as BattleCanvas / overlays.css: the rotate prompt covers the page.
  const rotated = useMedia('(orientation: landscape) and (max-height: 500px) and (max-width: 950px) and (pointer: coarse)')

  // Which road (if any) brightens: read once per mount, against what the map last showed.
  const [rising] = useState<CompanyId | null>(() => {
    const seen = readSeen()
    if (!seen) return null
    let best: { c: CompanyId; gain: number } | null = null
    for (const r of roads) {
      const gain = r.light - Math.max(0, Number(seen[r.company]) || 0)
      if (r.state === 'lit' && gain > 0 && (!best || gain > best.gain)) best = { c: r.company, gain }
    }
    return best?.c ?? null
  })
  const lightKey = roads.map((r) => `${r.company}:${r.light}`).join(',')
  useEffect(() => {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(Object.fromEntries(roads.map((r) => [r.company, r.light]))))
    } catch {
      /* private mode: the brighten just never plays */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightKey])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setSize((s) => {
        const dpr = window.devicePixelRatio || 1
        const w = Math.round(r.width)
        const h = Math.round(r.height)
        return s && s.w === w && s.h === h && s.dpr === dpr ? s : { w, h, dpr }
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onVis = () => setPageShown(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) setInView(e.isIntersecting)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // The scale: k whole device px per map px, about 2 CSS px.
  const k = size ? Math.max(1, Math.round(2 * size.dpr)) : 2
  const cssPerPx = size ? k / size.dpr : 2
  const openKey = open ? `${Math.round(open.x)},${Math.round(open.y)},${Math.round(open.w)},${Math.round(open.h)}` : ''
  const geo = useMemo<MapGeometry | null>(() => {
    if (!size || !open || size.w < 40 || size.h < 40) return null
    const W = Math.ceil(size.w / cssPerPx)
    const H = Math.ceil(size.h / cssPerPx)
    const o = { x: open.x / cssPerPx, y: open.y / cssPerPx, w: open.w / cssPerPx, h: open.h / cssPerPx }
    return buildGeometry(W, H, o)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, openKey, cssPerPx])

  // The terrain bakes in slices off the critical path (cached per layout).
  const [terrain, setTerrain] = useState<{ geo: MapGeometry; canvas: HTMLCanvasElement } | null>(null)
  useEffect(() => {
    if (!geo) return
    const hit = cachedTerrain(geo)
    if (hit) return setTerrain({ geo, canvas: hit })
    let live = true
    const t0 = performance.now()
    void bakeTerrain(geo, 6, () => !live).then((canvas) => {
      if (!live || !canvas) return
      if (import.meta.env.DEV) {
        perf.bakeMs = performance.now() - t0
        perf.bakes++
      }
      setTerrain({ geo, canvas })
    })
    return () => {
      live = false
    }
  }, [geo])
  // Dev builds only: what the map is framed to and the terrain it baked, so a
  // harness can prove a pick never re-frames or re-bakes it (`window.__tradeMapFrame()`).
  useEffect(() => {
    if (!import.meta.env.DEV || !geo || !terrain) return
    const w = window as Window & { __tradeMapFrame?: () => unknown }
    w.__tradeMapFrame = () => {
      const data = terrain.canvas.getContext('2d')!.getImageData(0, 0, terrain.canvas.width, terrain.canvas.height).data
      let h = 2166136261
      for (let i = 0; i < data.length; i += 4) h = Math.imul(h ^ (data[i] | (data[i + 1] << 8) | (data[i + 2] << 16)), 16777619)
      return { W: geo.W, H: geo.H, hub: geo.hub, towns: geo.routes.map((r) => r.towns), terrain: h >>> 0, canvas: terrain.canvas === cachedTerrain(geo) }
    }
  }, [geo, terrain])
  const flagKey = bannerKey(banner)
  const pixels = useMemo(
    () => (geo && terrain?.geo === geo ? bakePixels(geo, terrain.canvas, roads, banner) : null),
    [geo, terrain, lightKey, flagKey], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const traffic = useMemo(() => makeTraffic(roads), [lightKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const sprites = useMemo(() => new Map(roads.map((r) => [r.company, glowSprite(companyById(r.company).color, k)])), [k]) // eslint-disable-line react-hooks/exhaustive-deps

  const running = motion && pageShown && inView && !rotated
  // The brighten plays once per mount, with motion allowed; the clock starts on its first frame.
  const brightenDone = useRef(!motion || !rising)
  // The traffic's clock runs from mount, so a focus change never jumps it.
  const clock0 = useRef(performance.now())
  // The last base drawn, so a focus change can crossfade out of it.
  const lastBase = useRef<{ pixels: HTMLCanvasElement; canvas: HTMLCanvasElement } | null>(null)

  useEffect(() => {
    const cv = cvRef.current
    if (!cv || !geo || !pixels) return
    if (cv.width !== geo.W * k) cv.width = geo.W * k
    if (cv.height !== geo.H * k) cv.height = geo.H * k
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    const road = rising ? roads.find((r) => r.company === rising) : undefined
    const brightening = !brightenDone.current && running && road
    let base = bakeBase(pixels, geo, roads, k, brightening ? road.company : null, focused)
    let layers: BrightenLayers | null = brightening ? brightenLayers(geo, road, k) : null
    // The glow the road had before: the old standing's share of the new one's.
    const from = road ? Math.max(0, road.light - 1) / Math.max(1, road.light) : 0
    let started = -1
    // A focus change on the same map crossfades (motion allowed); anything else is a cut.
    const prev = lastBase.current?.pixels === pixels ? lastBase.current.canvas : null
    let fadeFrom = running && prev ? prev : null
    let fadeStart = -1

    const paint = (now: number, t: number) => {
      const t0 = performance.now()
      let b: (BrightenLayers & { glowA: number; flashA: number }) | null = null
      if (layers) {
        if (started < 0) started = now
        const ms = now - started
        const e = brightenEase(ms)
        b = { ...layers, glowA: from + (1 - from) * e, flashA: Math.sin(Math.PI * e) }
        if (import.meta.env.DEV) perf.brighten.push(Math.round(ms))
        if (ms >= BRIGHTEN_MS) {
          // Settle: the road's glow joins the base, and the layers go.
          const g = base.getContext('2d')!
          g.globalCompositeOperation = 'lighter'
          g.drawImage(layers.glow, layers.x, layers.y)
          g.globalCompositeOperation = 'source-over'
          layers = null
          b = null
          brightenDone.current = true
        }
      }
      let fading: { base: HTMLCanvasElement; a: number } | null = null
      if (fadeFrom) {
        if (fadeStart < 0) fadeStart = now
        const a = 1 - (now - fadeStart) / FOCUS_FADE_MS
        if (a > 0) fading = { base: fadeFrom, a }
        else fadeFrom = null
      }
      drawFrame(ctx, base, geo, traffic, sprites, k, t, b, { fading, focus: focused })
      if (import.meta.env.DEV) {
        perf.draws.push(performance.now() - t0)
        if (perf.draws.length > 600) perf.draws.shift()
        perf.frames++
      }
    }

    if (!running) {
      // A still frame: reduced motion, or the loop parked (the last frame is held).
      if (!motion) {
        base = bakeBase(pixels, geo, roads, k, null, focused)
        layers = null
      }
      lastBase.current = { pixels, canvas: base }
      paint(performance.now(), motion ? STILL_T + (performance.now() - clock0.current) / 1000 : STILL_T)
      return
    }
    lastBase.current = { pixels, canvas: base }
    let raf = 0
    let last = -Infinity
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (now - last < 1000 / MAP_FPS - 2) return
      last = now
      paint(now, STILL_T + (now - clock0.current) / 1000)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, pixels, traffic, sprites, k, running, motion, focused])

  return (
    <div className={`tm${open && open.h < 300 ? ' is-compact' : ''}${focused ? ' has-focus' : ''}`} ref={wrapRef}>
      <canvas
        ref={cvRef}
        className={`tm-canvas${pixels ? ' is-ready' : ''}`}
        aria-hidden="true"
        style={geo ? { width: (geo.W * k) / (size?.dpr ?? 1), height: (geo.H * k) / (size?.dpr ?? 1) } : undefined}
      />
      {geo && open && <Labels geo={geo} roads={roads} cssPerPx={cssPerPx} open={open} avoid={avoid} firstRun={firstRun} focused={focused} onPick={onPick} />}
    </div>
  )
}

/**
 * The roads' signposts (Figma "B2 · Road Signpost"), and the focused road's
 * cities, as crisp HTML over the canvas. Where each goes is
 * `labelLayout.ts`'s (pure, tested); this measures and places.
 *
 * A signpost is a wooden plate at a road's end with its company's logo (a
 * padlock on a road not hiring yet): a tap focuses that road, and never
 * signs. The plate says nothing else — the dock under the map carries the
 * standing, the share, the war's leader and the day's marks, once. The
 * focused road's plate is lit; the plates never MOVE on a pick (their places
 * do not depend on the focus). The focused road's three cities hang in a line
 * beside the road, each joined to its town by a thin leader line, the
 * destination's in bold. A first launch's uncharted roads are bare pins:
 * there is only the one road to take.
 */
function Labels({
  geo,
  roads,
  cssPerPx,
  open,
  avoid,
  firstRun,
  focused,
  onPick,
}: {
  geo: MapGeometry
  roads: RoadView[]
  cssPerPx: number
  open: Rect
  avoid: readonly Rect[]
  firstRun: boolean
  focused: MapFocus
  onPick?: (company: CompanyId) => void
}) {
  const ref = useRef<HTMLUListElement>(null)
  const townsRef = useRef<HTMLOListElement>(null)
  const leadersRef = useRef<SVGSVGElement>(null)
  useLayoutEffect(() => {
    const ul = ref.current
    if (!ul) return
    const blocked = avoid.map(boxOf)
    // The signposts: a signpost's box is its visible face (the 44px hit area is 6px taller top and bottom).
    const lis = Array.from(ul.children) as HTMLElement[]
    const signs = placeSignposts(
      lis.map((li, i) => ({ id: String(i), x: Number(li.dataset.x), y: Number(li.dataset.y), w: li.offsetWidth, h: Math.max(20, li.offsetHeight - 12), prio: Number(li.dataset.p) })),
      open,
      blocked,
    )
    signs.forEach((s, i) => {
      lis[i].style.left = `${Math.round(s.x)}px`
      lis[i].style.top = `${Math.round(s.y)}px`
    })
    const ol = townsRef.current
    const svg = leadersRef.current
    if (!ol || !svg) return
    const lit = geo.routes.find((r) => r.company === focused)
    if (!lit) return
    const px = (p: readonly [number, number]) => [p[0] * cssPerPx, p[1] * cssPerPx] as [number, number]
    const items = Array.from(ol.children) as HTMLElement[]
    const placed = placeCityLabels({
      towns: items.map((li) => ({ x: Number(li.dataset.x), y: Number(li.dataset.y), w: li.offsetWidth, h: li.offsetHeight })),
      hub: px(geo.hub),
      own: lit.chain.map(px),
      others: geo.routes.filter((r) => r !== lit).map((r) => r.chain.map(px)),
      blocked: [...signs.map((s) => s.box), ...blocked],
      keep: hubBoxes(geo.hub, cssPerPx),
      bounds: open,
      midX: geo.hub[0] * cssPerPx,
    })
    // The road itself, for the company world's ambient layer (`fxEngine`): its
    // embers and sparks crowd round the focused road. CSS px in the svg's box.
    svg.dataset.road = lit.chain
      .filter((_, i) => i % 6 === 0)
      .map((p) => px(p).map(Math.round).join(','))
      .join(' ')
    const lines = Array.from(svg.querySelectorAll('g')) as SVGGElement[]
    placed.forEach((c, i) => {
      const li = items[i]
      // No room: the name stays in the list for a screen reader, off the map, rather than over another.
      li.classList.toggle('is-hidden', !c)
      lines[i]?.classList.toggle('is-hidden', !c)
      if (!c) return
      li.style.left = `${Math.round(c.box.l)}px`
      li.style.top = `${Math.round(c.box.t)}px`
      li.dataset.edge = c.edge
      const line = lines[i]?.querySelector('line')
      const dot = lines[i]?.querySelector('rect')
      if (line) {
        line.setAttribute('x1', c.line.x1.toFixed(1))
        line.setAttribute('y1', c.line.y1.toFixed(1))
        line.setAttribute('x2', c.line.x2.toFixed(1))
        line.setAttribute('y2', c.line.y2.toFixed(1))
      }
      if (dot) {
        dot.setAttribute('x', String(Math.round(Number(li.dataset.x)) - 2))
        dot.setAttribute('y', String(Math.round(Number(li.dataset.y)) - 2))
      }
    })
  })
  // The cities are named for one road at a time: every road lit names none.
  const lit = focused && focused !== 'all' ? geo.routes.find((r) => r.company === focused) : undefined
  const litCo = lit ? companyById(lit.company) : null
  return (
    <>
      <ul className="tm-labels" ref={ref} aria-label="Company roads">
        {geo.routes.map((r, i) => {
          const v = roads.find((q) => q.company === r.company)!
          const co = companyById(r.company)
          const [x, y] = r.towns[2]
          const left = x * cssPerPx
          const top = (y - 8) * cssPerPx
          const style = { left, top, '--co': co.color } as CSSProperties
          const on = litBy(focused, r.company)
          const locked = v.state === 'uncharted'
          // Placement order: by standing, the uncharted last, then west to east — never the focus.
          const prio = signPrio(v, i)
          if (locked && firstRun) {
            return (
              <li key={r.company} className="tm-label is-pin is-bare" data-x={left} data-y={top} data-p={prio} style={style}>
                <span className="tm-pill" role="img" aria-label="An uncharted road, not hiring yet">
                  <Lock scale={2} />
                </span>
              </li>
            )
          }
          const name = locked ? `${co.name}: not hiring yet` : `${co.name}, the ${co.goods.toLowerCase()} road`
          return (
            <li
              key={r.company}
              className={`tm-label${locked ? ' is-pin' : v.state === 'lit' ? '' : ' is-new'}${on ? ' is-on' : ''}`}
              data-x={left}
              data-y={top}
              data-p={prio}
              style={style}
            >
              <button type="button" className="tm-pill" onClick={() => onPick?.(r.company)} aria-label={name} aria-pressed={on} disabled={!onPick} tabIndex={-1}>
                {locked ? <Lock scale={2} /> : <Crest company={r.company} scale={2} />}
              </button>
            </li>
          )
        })}
      </ul>
      {lit && litCo && (
        <>
          <svg className="tm-leaders" ref={leadersRef} aria-hidden="true" style={{ '--co': litCo.color } as CSSProperties}>
            {lit.towns.map((_, i) => (
              <g key={`${litCo.id}-${i}`}>
                <line />
                <rect width={4} height={4} />
              </g>
            ))}
          </svg>
          <ol className="tm-towns" ref={townsRef} aria-label={`${litCo.name}’s road`} style={{ '--co': litCo.color } as CSSProperties}>
            {lit.towns.map(([x, y], i) => (
              <li key={litCo.towns[i]} className={`tm-town${i === 2 ? ' is-dest' : ''}`} data-x={x * cssPerPx} data-y={(y - 3) * cssPerPx}>
                {litCo.towns[i]}
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  )
}
