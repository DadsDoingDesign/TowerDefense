/** Small canvas + colour helpers shared by every draw module, and the field palette. */
import type { Vec2 } from '../core/vec'

export const COLORS = {
  base: '#3d5a80',
  baseCore: '#98c1d9',
  // Cream, near-opaque: the idle slot ring has to read on sunlit grass (Wave 1).
  slot: 'rgba(255, 245, 220, 0.92)',
  slotFill: 'rgba(255,255,255,0.04)',
  slotHover: '#f0a868',
  // Solid warm gold for an armed slot — the brightest thing on a dimmed field.
  slotArmed: '#ffd166',
  slotSelected: '#98c1d9',
}

export function strokePolyline(ctx: CanvasRenderingContext2D, pts: Vec2[]): void {
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
}

// ---- small canvas helpers ----

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Blend two hex colors, t=0 → a, t=1 → b. Returns an rgb() string. */
export function mix(a: string, b: string, t: number): string {
  const pa = a.replace('#', '')
  const pb = b.replace('#', '')
  const ar = parseInt(pa.substring(0, 2), 16)
  const ag = parseInt(pa.substring(2, 4), 16)
  const ab = parseInt(pa.substring(4, 6), 16)
  const br = parseInt(pb.substring(0, 2), 16)
  const bg = parseInt(pb.substring(2, 4), 16)
  const bb = parseInt(pb.substring(4, 6), 16)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `rgb(${r},${g},${bl})`
}

// ---- theme shape + color helpers ----

/** Trace a shape path centered at the origin (caller fills/strokes). */
export function shapePath(ctx: CanvasRenderingContext2D, shape: string, r: number): void {
  ctx.beginPath()
  if (shape === 'square') {
    const rr = Math.min(3, r / 2)
    ctx.moveTo(-r + rr, -r)
    ctx.arcTo(r, -r, r, r, rr)
    ctx.arcTo(r, r, -r, r, rr)
    ctx.arcTo(-r, r, -r, -r, rr)
    ctx.arcTo(-r, -r, r, -r, rr)
    ctx.closePath()
  } else if (shape === 'gem') {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.closePath()
  } else {
    ctx.arc(0, 0, r, 0, Math.PI * 2)
  }
}

export function radialFill(ctx: CanvasRenderingContext2D, r: number, inner: string, outer: string): CanvasGradient {
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r)
  g.addColorStop(0, inner)
  g.addColorStop(1, outer)
  return g
}

export function toRgb(c: string): [number, number, number] {
  if (c.startsWith('#')) {
    const h = c.replace('#', '')
    return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)]
  }
  const m = c.match(/\d+/g)
  return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [128, 128, 128]
}
export function darken(c: string, t: number): string {
  const [r, g, b] = toRgb(c)
  return `rgb(${Math.round(r * (1 - t))},${Math.round(g * (1 - t))},${Math.round(b * (1 - t))})`
}
export function lighten(c: string, t: number): string {
  const [r, g, b] = toRgb(c)
  return `rgb(${Math.round(r + (255 - r) * t)},${Math.round(g + (255 - g) * t)},${Math.round(b + (255 - b) * t)})`
}
