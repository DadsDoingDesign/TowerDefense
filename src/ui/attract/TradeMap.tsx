import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { companyById, type CompanyId } from '../../game/data/companies'
import type { BannerLook } from '../../game/data/banner'
import { Crest } from '../pixel'
import { useMedia } from '../pointer'
import { readJson, writeJson } from '../../state/storage'
import { bakeBase, bakePixels, bakeTerrain, brightenLayers, cachedTerrain, drawFrame, glowSprite, type BrightenLayers } from './paintMap'
import { BRIGHTEN_MS, brightenEase, buildGeometry, makeTraffic, MAP_FPS, STILL_T, type MapGeometry, type Rect, type RoadView } from './mapRules'

/**
 * The menu's background: the trade map (the mercenary company, build step 4).
 *
 * Your HQ town at night, the five company roads running out of it to their
 * destinations, each road lit by your standing with that company and carrying
 * traffic (`mapRules.ts` for the rules, `paintMap.ts` for the pixels). It
 * replaced the cinematic attract battle (Whales UI plan H1/Q12): the menu now
 * shows the player's own progress instead of a demo.
 *
 * ## Cost
 *
 *  - **One canvas**, at most {@link MAP_FPS} frames a second. A frame is one
 *    `drawImage` of the pre-lit base and a few dozen small fills; the terrain,
 *    the roads and the static light are baked once per size.
 *  - **Parked when unseen**: a hidden tab, the map scrolled or laid out of
 *    view, or a phone on its side under the rotate prompt stops the loop (no
 *    rAF at all). Starting a run unmounts the menu, and with it the loop.
 *  - **Reduced motion** (the OS setting or the in-game toggle): one still
 *    frame with the traffic spread along the roads, no loop, no brighten.
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
  const o = readJson<unknown>(SEEN_KEY)
  return o && typeof o === 'object' ? (o as Partial<Record<CompanyId, number>>) : null
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

export function TradeMap({
  roads,
  market,
  banner,
  open,
  motion,
  firstRun,
  onPick,
}: {
  roads: RoadView[]
  /** Today's market (the label carries "×1.3 today"), or null. */
  market: { company: CompanyId; mult: number } | null
  banner: BannerLook
  /** The part of the map the menu leaves open, CSS px from the map's top-left. */
  open: Rect | null
  /** False under reduced motion: one still frame. */
  motion: boolean
  firstRun: boolean
  /** Tap a road's label: open its company's contracts. */
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
    // Refused in private mode: the brighten just never plays.
    writeJson(SEEN_KEY, Object.fromEntries(roads.map((r) => [r.company, r.light])))
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
  const bannerKey = `${banner.shape}/${banner.tincture}/${banner.charge}`
  const pixels = useMemo(
    () => (geo && terrain?.geo === geo ? bakePixels(geo, terrain.canvas, roads, banner) : null),
    [geo, terrain, lightKey, bannerKey], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const traffic = useMemo(() => makeTraffic(roads), [lightKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const sprites = useMemo(() => new Map(roads.map((r) => [r.company, glowSprite(companyById(r.company).color, k)])), [k]) // eslint-disable-line react-hooks/exhaustive-deps

  const running = motion && pageShown && inView && !rotated
  // The brighten plays once per mount, with motion allowed; the clock starts on its first frame.
  const brightenDone = useRef(!motion || !rising)

  useEffect(() => {
    const cv = cvRef.current
    if (!cv || !geo || !pixels) return
    cv.width = geo.W * k
    cv.height = geo.H * k
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    const road = rising ? roads.find((r) => r.company === rising) : undefined
    const brightening = !brightenDone.current && running && road
    let base = bakeBase(pixels, geo, roads, k, brightening ? road.company : null)
    let layers: BrightenLayers | null = brightening ? brightenLayers(geo, road, k) : null
    // The glow the road had before: the old standing's share of the new one's.
    const from = road ? Math.max(0, road.light - 1) / Math.max(1, road.light) : 0
    let started = -1

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
      drawFrame(ctx, base, geo, traffic, sprites, k, t, b)
      if (import.meta.env.DEV) {
        perf.draws.push(performance.now() - t0)
        if (perf.draws.length > 600) perf.draws.shift()
        perf.frames++
      }
    }

    if (!running) {
      // A still frame: reduced motion, or the loop parked (the last frame is held).
      if (!motion) {
        base = bakeBase(pixels, geo, roads, k)
        layers = null
      }
      paint(performance.now(), STILL_T)
      return
    }
    let raf = 0
    let last = -Infinity
    const clock0 = performance.now()
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (now - last < 1000 / MAP_FPS - 2) return
      last = now
      paint(now, STILL_T + (now - clock0) / 1000)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, pixels, traffic, sprites, k, running, motion])

  return (
    <div className={`tm${open && open.h < 300 ? ' is-compact' : ''}`} ref={wrapRef}>
      <canvas
        ref={cvRef}
        className={`tm-canvas${pixels ? ' is-ready' : ''}`}
        aria-hidden="true"
        style={geo ? { width: (geo.W * k) / (size?.dpr ?? 1), height: (geo.H * k) / (size?.dpr ?? 1) } : undefined}
      />
      {geo && open && (
        <Labels geo={geo} roads={roads} market={market} cssPerPx={cssPerPx} open={open} firstRun={firstRun} onPick={onPick} />
      )}
    </div>
  )
}

/**
 * The roads' labels, as crisp HTML over the canvas: the company's crest, its
 * goods and your standing — and today's market on the road it names. A road
 * that hires is a button that opens its contracts; an uncharted one is a pin.
 */
function Labels({
  geo,
  roads,
  market,
  cssPerPx,
  open,
  firstRun,
  onPick,
}: {
  geo: MapGeometry
  roads: RoadView[]
  market: { company: CompanyId; mult: number } | null
  cssPerPx: number
  open: Rect
  firstRun: boolean
  onPick?: (company: CompanyId) => void
}) {
  const ref = useRef<HTMLUListElement>(null)
  // Keep every label inside the open area and off every other: measure, then
  // place them best road first, each nudged sideways (then up or down) to the
  // nearest free spot. A label's box is its visible face (the 44px hit area
  // is 6px taller top and bottom).
  useLayoutEffect(() => {
    const ul = ref.current
    if (!ul) return
    const lis = (Array.from(ul.children) as HTMLElement[]).sort((a, b) => Number(b.dataset.p) - Number(a.dataset.p))
    const placed: { l: number; r: number; t: number; b: number }[] = []
    const free = (q: { l: number; r: number; t: number; b: number }) => placed.every((p) => q.r + 4 <= p.l || q.l - 4 >= p.r || q.b + 2 <= p.t || q.t - 2 >= p.b)
    for (const li of lis) {
      const x0 = Number(li.dataset.x)
      const y0 = Number(li.dataset.y)
      const w = li.offsetWidth
      const h = Math.max(20, li.offsetHeight - 12)
      const lo = open.x + 6 + w / 2
      const hi = open.x + open.w - 6 - w / 2
      const clampX = (x: number) => (hi < lo ? open.x + open.w / 2 : Math.max(lo, Math.min(hi, x)))
      const box = (x: number, y: number) => ({ l: x - w / 2, r: x + w / 2, t: y - 6 - h, b: y - 6 })
      let at = { x: clampX(x0), y: y0 }
      search: for (const dy of [0, -(h + 4), h + 4]) {
        for (let d = 0; d <= 240; d += 8) {
          for (const s of d ? [1, -1] : [1]) {
            const x = clampX(x0 + s * d)
            if (free(box(x, y0 + dy))) {
              at = { x, y: y0 + dy }
              break search
            }
          }
        }
      }
      placed.push(box(at.x, at.y))
      li.style.left = `${Math.round(at.x)}px`
      li.style.top = `${Math.round(at.y)}px`
    }
  })
  return (
    <ul className="tm-labels" ref={ref} aria-label="Company roads">
      {geo.routes.map((r) => {
        const v = roads.find((q) => q.company === r.company)!
        const co = companyById(r.company)
        const [x, y] = r.towns[2]
        const left = x * cssPerPx
        const top = (y - 8) * cssPerPx
        const style = { left, top, '--co': co.color } as CSSProperties
        const hot = !firstRun && market?.company === r.company
        // Placement priority: the market's road, then by standing, the uncharted last.
        const prio = (hot ? 100 : 0) + (v.state === 'uncharted' ? 0 : 10 + v.standing)
        if (v.state === 'uncharted') {
          return (
            <li key={r.company} className={`tm-label is-pin${firstRun ? ' is-bare' : ''}`} data-x={left} data-y={top} data-p={prio} style={style}>
              <span className="tm-pill" role="img" aria-label="An uncharted road, not hiring yet">
                <Crest company={r.company} scale={1} locked />
                {!firstRun && <span className="tm-name">Uncharted</span>}
              </span>
            </li>
          )
        }
        const lv = v.state === 'lit' ? String(v.standing) : 'Hiring'
        const name = `${co.goods}, ${v.state === 'lit' ? `standing ${v.standing}` : 'hiring'}${hot ? `, pays ×${market!.mult} today` : ''}`
        return (
          <li key={r.company} className={`tm-label${v.state === 'lit' ? '' : ' is-new'}`} data-x={left} data-y={top} data-p={prio} style={style}>
            <button type="button" className="tm-pill" onClick={() => onPick?.(r.company)} aria-label={`${name}: see its contracts`} disabled={!onPick}>
              <Crest company={r.company} scale={1} />
              <span className="tm-name">{co.goods}</span>
              <span className="tm-lv">{lv}</span>
              {hot && <span className="tm-mkt">×{market!.mult} today</span>}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
