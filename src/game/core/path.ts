import type { Vec2 } from './vec'

/**
 * A polyline path enemies travel along, addressed by arc-length distance.
 * Precomputes cumulative segment lengths so `pointAt(distance)` is O(segments).
 */
export class GamePath {
  readonly points: Vec2[]
  readonly cumulative: number[]
  readonly length: number

  constructor(points: Vec2[]) {
    if (points.length < 2) throw new Error('A path needs at least two points')
    this.points = points
    this.cumulative = [0]
    let total = 0
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x
      const dy = points[i].y - points[i - 1].y
      total += Math.sqrt(dx * dx + dy * dy)
      this.cumulative.push(total)
    }
    this.length = total
  }

  /** World position at the given distance travelled from the start. */
  pointAt(distance: number): Vec2 {
    if (distance <= 0) return { ...this.points[0] }
    if (distance >= this.length) return { ...this.points[this.points.length - 1] }
    // Linear scan is fine — paths have a handful of segments.
    let seg = 1
    while (seg < this.cumulative.length && this.cumulative[seg] < distance) seg++
    const segStart = this.cumulative[seg - 1]
    const segLen = this.cumulative[seg] - segStart
    const t = segLen === 0 ? 0 : (distance - segStart) / segLen
    const a = this.points[seg - 1]
    const b = this.points[seg]
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  }
}
