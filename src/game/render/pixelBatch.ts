/**
 * Batched pixel rects for the particle layers (the battle's edge band and
 * weather, Oct 2026). A particle is a handful of 1–3 px rects; drawn one
 * `fillRect` at a time, a few dozen of them cost more in draw calls than in
 * pixels. Here every rect joins the path of its colour and (quantised)
 * alpha, and each path is filled once — a frame of weather is a dozen fills,
 * not hundreds.
 *
 * Use it like the context it stands in for: set `color` and `alpha`, call
 * `rect`, then `flush` onto the real context.
 */
export class PixelBatch {
  color = '#ffffff'
  alpha = 1
  private paths = new Map<string, number[]>()

  rect(x: number, y: number, w: number, h: number): void {
    const a = Math.round(Math.max(0, Math.min(1, this.alpha)) * 12)
    if (a <= 0 || w <= 0 || h <= 0) return
    const key = `${this.color}|${a}`
    let p = this.paths.get(key)
    if (!p) this.paths.set(key, (p = []))
    p.push(x, y, w, h)
  }

  /** Fill everything batched since the last flush onto `ctx`, then empty the batch. */
  flush(ctx: CanvasRenderingContext2D): void {
    const a0 = ctx.globalAlpha
    for (const [key, p] of this.paths) {
      const bar = key.indexOf('|')
      ctx.fillStyle = key.slice(0, bar)
      ctx.globalAlpha = a0 * (Number(key.slice(bar + 1)) / 12)
      ctx.beginPath()
      for (let i = 0; i < p.length; i += 4) ctx.rect(p[i], p[i + 1], p[i + 2], p[i + 3])
      ctx.fill()
    }
    ctx.globalAlpha = a0
    this.paths.clear()
  }
}
