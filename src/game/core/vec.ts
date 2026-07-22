/** 2D vector helpers. Plain objects keep the sim allocation-light and serializable. */
export interface Vec2 {
  x: number
  y: number
}

export const vec = (x: number, y: number): Vec2 => ({ x, y })

export const dist = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export const distSq = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

/** Move `from` toward `to` by at most `maxStep`; returns the new point and whether it arrived. */
export const moveToward = (
  from: Vec2,
  to: Vec2,
  maxStep: number,
): { pos: Vec2; arrived: boolean } => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const d = Math.sqrt(dx * dx + dy * dy)
  if (d <= maxStep || d === 0) return { pos: { x: to.x, y: to.y }, arrived: true }
  const t = maxStep / d
  return { pos: { x: from.x + dx * t, y: from.y + dy * t }, arrived: false }
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v
