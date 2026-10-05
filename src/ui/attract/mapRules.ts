/**
 * The menu's trade map — the PURE half: geometry, how each road looks, and
 * the traffic on it. No DOM, no React: `tests/tradeMap.test.ts` drives it, and
 * the painter (`paintMap.ts`) and the component (`TradeMap.tsx`) only read it.
 *
 * The approved direction is the night-lantern map (`trade/r3/1-menu-*.png`,
 * prototype `trade/r3/lib.js`): your HQ town with the five company roads
 * running out of it to their destinations, each road lit by your standing with
 * that company and carrying little lights — and, at high standing, wagons.
 *
 * Everything here is in MAP pixels: one map pixel is drawn as a whole number
 * of device pixels (about 2 CSS px), so the map stays crisp at any size.
 */
import { RNG } from '../../game/core/rng'
import { COMPANY_IDS, type CompanyId } from '../../game/data/companies'

// ---------------------------------------------------------------------------
// The motion spec (`trade/NOTES.md` § Motion spec)
// ---------------------------------------------------------------------------

/** One canvas, at most this many frames a second. */
export const MAP_FPS = 30
/** A pulse takes 8–14 s from end to end. */
export const PULSE_SECONDS: readonly [number, number] = [8, 14]
/** From this standing, every third pulse on a road is a wagon. */
export const WAGON_STANDING = 7
/** A road brightens over this long when your standing with its company rises. */
export const BRIGHTEN_MS = 600
/** Share of the pulses that run outbound (hub → destination). */
export const OUTBOUND = 0.7
/** The time the still frame (reduced motion, screenshots) is drawn at. */
export const STILL_T = 3.3

/** Pulses on a road: 1 + 0.75 × standing (none on a road you have not worked). */
export const pulseCount = (standing: number): number => (standing <= 0 ? 0 : Math.round(1 + 0.75 * standing))
/** The road's glow: 4 + 1.2 × standing map px wide, 0.05 + 0.022 × standing strong. */
export const glowWidth = (standing: number): number => 4 + 1.2 * standing
export const glowAlpha = (standing: number): number => 0.05 + 0.022 * standing

// ---------------------------------------------------------------------------
// How each road reads
// ---------------------------------------------------------------------------

/**
 * - `lit` — you hold standing with the company: the road glows by it.
 * - `faint` — your first contract's road on a first launch: one faint light.
 * - `hiring` — the company hires, but you have not worked for it yet: a
 *   dotted road with its name.
 * - `uncharted` — not hiring yet: a dotted road to a "?".
 */
export type RoadState = 'lit' | 'faint' | 'hiring' | 'uncharted'

export interface RoadView {
  company: CompanyId
  state: RoadState
  /** Standing 0–10, the number the label shows. */
  standing: number
  /** The standing the LIGHT is drawn at: `standing`, or 1 for a faint road. */
  light: number
}

export function roadViews(o: {
  standing: Readonly<Record<CompanyId, number>>
  hiring: Readonly<Record<CompanyId, boolean>>
  /** A first launch: only the first contract's road is lit, faintly. */
  firstRun: boolean
  first: CompanyId
}): RoadView[] {
  return COMPANY_IDS.map((company) => {
    const s = Math.max(0, Math.min(10, Math.floor(o.standing[company] ?? 0)))
    if (o.firstRun) return company === o.first ? { company, state: 'faint', standing: 0, light: 1 } : { company, state: 'uncharted', standing: 0, light: 0 }
    if (s > 0) return { company, state: 'lit', standing: s, light: s }
    return { company, state: o.hiring[company] ? 'hiring' : 'uncharted', standing: 0, light: 0 }
  })
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Each road's heading out of the hub, in degrees (0 = east, −90 = north). */
const ANGLE: Record<CompanyId, number> = { spice: -52, art: -122, metals: -158, silk: -16, scrolls: -88 }
/** How far each destination lies, as a share of the fan's radius: a little variety in the skyline of labels. */
const REACH: Record<CompanyId, number> = { spice: 0.84, art: 0.9, metals: 0.86, silk: 0.6, scrolls: 1 }

export interface Route {
  company: CompanyId
  /** The road as a continuous 8-connected pixel chain, hub first. */
  chain: [number, number][]
  /** Its three towns (the act bosses' cities), the destination last. */
  towns: [number, number][]
}

export interface MapGeometry {
  W: number
  H: number
  hub: [number, number]
  routes: Route[]
  /** The sea: an ellipse in map px. */
  sea: { cx: number; cy: number; rx: number; ry: number }
  /** Whether this is the wide (desk) layout. */
  wide: boolean
}

/**
 * Lay the map out for a `W` × `H` map-pixel canvas whose open area — the part
 * of the screen the menu does not cover — is `open` (map px). The hub sits low
 * in the open area and the roads fan up and out to fill it, leaving room above
 * each destination for its label.
 */
export function buildGeometry(W: number, H: number, open: Rect): MapGeometry {
  const wide = open.w >= open.h
  const hx = Math.round(open.x + open.w * (wide ? 0.52 : 0.5))
  const hy = Math.round(open.y + open.h * (wide ? 0.68 : 0.86))
  // Room for a label (about 17 map px) above the highest destination.
  const ry = Math.max(24, hy - (open.y + (wide ? Math.max(30, open.h * 0.1) : 26)))
  const rx = Math.max(30, open.w * (wide ? 0.42 : 0.4))
  const R = new RNG(7)
  const routes = COMPANY_IDS.map((company): Route => {
    const a = (ANGLE[company] * Math.PI) / 180
    const reach = REACH[company]
    const ex = hx + Math.cos(a) * rx * reach
    const ey = hy + Math.sin(a) * ry * reach
    const ctrl: [number, number][] = [[hx, hy]]
    for (let k = 1; k <= 3; k++) {
      const t = k / 3
      const wob = k === 3 ? 0 : (k === 1 ? 1 : -1) * (0.08 + R.next() * 0.05)
      const px = hx + (ex - hx) * t
      const py = hy + (ey - hy) * t
      // Bend across the road's own heading.
      ctrl.push([px - (ey - hy) * wob * 0.5, py + (ex - hx) * wob * 0.5])
    }
    const chain = rasterise(catmullRom(ctrl))
    const towns = [1, 2, 3].map((k) => nearest(chain, ctrl[k]))
    return { company, chain, towns }
  })
  const sea = wide
    ? { cx: W * 1.0, cy: H * 0.06, rx: W * 0.2, ry: H * 0.24 }
    : { cx: W * 1.04, cy: open.y + open.h * 0.12, rx: W * 0.3, ry: Math.max(30, open.h * 0.22) }
  return { W, H, hub: [hx, hy], routes, sea, wide }
}

function catmullRom(ctrl: [number, number][]): [number, number][] {
  const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]]
  const pts: [number, number][] = []
  for (let s = 1; s < P.length - 2; s++) {
    const [p0, p1, p2, p3] = [P[s - 1], P[s], P[s + 1], P[s + 2]]
    for (let i = 0; i < 50; i++) {
      const t = i / 50
      const t2 = t * t
      const t3 = t2 * t
      const f = (j: 0 | 1) =>
        0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)
      pts.push([f(0), f(1)])
    }
  }
  pts.push(ctrl[ctrl.length - 1])
  return pts
}

/** A polyline as one continuous pixel chain (Bresenham between samples, no repeats). */
function rasterise(pts: [number, number][]): [number, number][] {
  const chain: [number, number][] = []
  const seen = new Set<number>()
  for (let k = 0; k < pts.length - 1; k++) {
    let x0 = Math.round(pts[k][0])
    let y0 = Math.round(pts[k][1])
    const x1 = Math.round(pts[k + 1][0])
    const y1 = Math.round(pts[k + 1][1])
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      const key = x0 * 100003 + y0
      if (!seen.has(key)) {
        seen.add(key)
        chain.push([x0, y0])
      }
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) {
        err += dy
        x0 += sx
      }
      if (e2 <= dx) {
        err += dx
        y0 += sy
      }
    }
  }
  return chain
}

function nearest(chain: [number, number][], p: [number, number]): [number, number] {
  let best = chain[0]
  let bd = Infinity
  for (const q of chain) {
    const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2
    if (d < bd) {
      bd = d
      best = q
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Traffic
// ---------------------------------------------------------------------------

export interface Pulse {
  company: CompanyId
  /** Where on the road it starts, 0–1. */
  phase: number
  /** Route-lengths a second (1/8 to 1/14). */
  speed: number
  /** +1 outbound (hub → destination), −1 inbound. */
  dir: 1 | -1
  /** A wagon instead of a light (every third pulse from {@link WAGON_STANDING}). */
  wagon: boolean
  /** A faint road's single light: smaller and dimmer. */
  faint: boolean
}

/** The pulses for every road, seeded so the same standing always shows the same traffic. */
export function makeTraffic(roads: readonly RoadView[], seed = 3): Pulse[] {
  const R = new RNG(seed)
  const out: Pulse[] = []
  for (const r of roads) {
    const n = pulseCount(r.light)
    for (let i = 0; i < n; i++) {
      const secs = PULSE_SECONDS[0] + R.next() * (PULSE_SECONDS[1] - PULSE_SECONDS[0])
      out.push({
        company: r.company,
        // Spread evenly along the road, jittered, so a still frame shows traffic all along it.
        phase: (i + R.next() * 0.6) / n,
        speed: 1 / secs,
        dir: R.next() < OUTBOUND ? 1 : -1,
        wagon: r.light >= WAGON_STANDING && i % 3 === 2,
        faint: r.state === 'faint' || r.light <= 1,
      })
    }
  }
  return out
}

/** Where a pulse is at time `t` (seconds): its index on the chain. */
export function pulseIndex(p: Pulse, chainLength: number, t: number): number {
  let u = (p.phase + t * p.speed) % 1
  if (p.dir < 0) u = 1 - u
  return Math.max(0, Math.min(chainLength - 1, Math.floor(u * (chainLength - 1))))
}

/** The brighten on a standing gain: 0 → 1 over {@link BRIGHTEN_MS}, ease-out (cubic). */
export const brightenEase = (ms: number): number => {
  const t = Math.max(0, Math.min(1, ms / BRIGHTEN_MS))
  return 1 - (1 - t) ** 3
}
