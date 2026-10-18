/**
 * The DRAFT tells and goblin marks of the Peoples & Trades proposal — the
 * parts of a skill's look the game has no draw for yet (`scripts/peoples-art.ts`
 * `Tell`, `Hit.mark`). Everything the game already draws (the glint, the held
 * arc, the aura, the snare, every hit burst, chain, proc ring and floater) is
 * NOT here: `harness/peoples.ts` calls the real code for those.
 *
 * Drawn in the pack's look: pixel-doubled like the gear the hero holds
 * (`gearMarks.GEAR_SCALE`), the `#161C2E` outline round every mark, the atlas
 * palette. Coordinates are the hero's (feet at y = +8, facing right), so a
 * tell stays inside the hero's own tile.
 */
import { drawAura } from '../src/game/render/overlays'
import { OUTLINE, type PipShape, type Tell } from '../scripts/peoples-art'

type Ctx = CanvasRenderingContext2D

/** 5 × 5 pip sprites (1 = ink, 2 = light, 3 = dark). */
const PIPS: Record<PipShape, string[]> = {
  dot: ['.111.', '12111', '11111', '11111', '.111.'],
  chili: ['...3.', '..33.', '.111.', '1211.', '11...'],
  coin: ['.111.', '12221', '12321', '12221', '.111.'],
  drop: ['..1..', '.111.', '11211', '11111', '.111.'],
  star: ['..1..', '.111.', '11211', '.111.', '1...1'],
  leaf: ['...11', '.1121', '1121.', '121..', '3....'],
  skull: ['.111.', '12121', '11111', '.1.1.', '.....'],
  fang: ['11111', '.121.', '.121.', '..1..', '..1..'],
  spark: ['..1..', '.1.1.', '1.2.1', '.1.1.', '..1..'],
  flake: ['1.1.1', '.111.', '11211', '.111.', '1.1.1'],
  arrow: ['...11', '..111', '.121.', '1.1..', '1....'],
  rune: ['1111.', '1..1.', '1111.', '1.1..', '1..1.'],
  gear: ['.1.1.', '11111', '.121.', '11111', '.1.1.'],
}

const shade = (hex: string, k: number): string => {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))))
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`
}

/** The tells' pixel size in logical px — the held gear's (`gearMarks.GEAR_SCALE`). */
export const K = 2

/** A tiny pixel sprite with its top-left at (x, y), pixel-doubled, outlined like an atlas icon. */
export function pixelSprite(ctx: Ctx, rows: readonly string[], x: number, y: number, ink: string, k = K): void {
  const X = Math.round(x)
  const Y = Math.round(y)
  const on = (i: number, j: number) => j >= 0 && j < rows.length && i >= 0 && i < rows[j].length && rows[j][i] !== '.'
  ctx.fillStyle = OUTLINE
  for (let j = -1; j <= rows.length; j++)
    for (let i = -1; i <= rows[0].length; i++) if (!on(i, j) && (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1))) ctx.fillRect(X + i * k, Y + j * k, k, k)
  rows.forEach((r, j) =>
    [...r].forEach((ch, i) => {
      if (ch === '.') return
      ctx.fillStyle = ch === '2' ? shade(ink, 0.55) : ch === '3' ? (ink === '#f76666' ? '#38b251' : shade(ink, -0.4)) : ink
      ctx.fillRect(X + i * k, Y + j * k, k, k)
    }),
  )
}

const px = (ctx: Ctx, x: number, y: number, w: number, h: number, ink: string) => {
  ctx.fillStyle = ink
  ctx.fillRect(Math.round(x), Math.round(y), w * K, h * K)
}

/** An outlined pixel line (Bresenham on the doubled grid), `ink` on a `#161C2E` ring. */
function pixLine(ctx: Ctx, pts: readonly [number, number][], ink: string): void {
  const cells: [number, number][] = []
  for (let k = 0; k + 1 < pts.length; k++) {
    let [x0, y0] = pts[k].map((v) => Math.round(v / K)) as [number, number]
    const [x1, y1] = pts[k + 1].map((v) => Math.round(v / K)) as [number, number]
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      cells.push([x0, y0])
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
  const set = new Set(cells.map(([x, y]) => `${x},${y}`))
  ctx.fillStyle = OUTLINE
  for (const [x, y] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!set.has(`${x + dx},${y + dy}`)) ctx.fillRect((x + dx) * K, (y + dy) * K, K, K)
  ctx.fillStyle = ink
  for (const [x, y] of cells) ctx.fillRect(x * K, y * K, K, K)
}

/** A ground ellipse at the feet, outlined. */
function groundRing(ctx: Ctx, rx: number, ink: string, dash = 0, lw = 2): void {
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(0, 13, rx, rx * 0.36, 0, 0, Math.PI * 2)
  if (dash) ctx.setLineDash([dash * 2, dash])
  ctx.lineWidth = lw + 2
  ctx.strokeStyle = OUTLINE
  ctx.stroke()
  ctx.lineWidth = lw
  ctx.strokeStyle = ink
  ctx.stroke()
  ctx.restore()
}

/** Tells that sit UNDER the figure (on the ground, or behind its back). */
export function drawTellUnder(ctx: Ctx, t: Tell, now: number): void {
  switch (t.kind) {
    case 'ring':
      groundRing(ctx, t.r ?? 17, t.ink, t.dash ?? 0, 2.4)
      if (t.double) groundRing(ctx, (t.r ?? 17) - 6, t.ink, 0, 1.4)
      return
    case 'aura':
      // The real support aura (faint by design), and its ring solid at the
      // feet so it reads in a still frame.
      drawAura(ctx, { x: 0, y: 2 }, t.r, t.ink, now)
      groundRing(ctx, 13, t.ink, 0, 2)
      groundRing(ctx, 19, t.ink, 0, 1.4)
      return
    case 'roots':
      pixLine(ctx, [[-22, 16], [-18, 10], [-12, 14], [-8, 8]], t.ink)
      pixLine(ctx, [[22, 16], [18, 10], [12, 14], [8, 8]], t.ink)
      if (t.bloom) for (const [x, y] of [[-20, 4], [16, 4]] as const) pixelSprite(ctx, ['.1.', '121', '.1.'], x, y, t.bloom)
      return
    case 'thorns':
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * 0.05 + (i / 8) * Math.PI * 0.9
        const x = Math.cos(a) * 18
        const y = 14 + Math.sin(a) * 6
        pixLine(ctx, [[x, y], [x, y - 6]], t.ink)
        if (t.ember && i % 2 === 0) px(ctx, x, y - 8, 1, 1, t.ember)
      }
      return
    case 'chain': {
      // From the off fist down to an anchor sunk by the back foot.
      pixLine(ctx, [[-26, -16], [-28, -6], [-28, 2]], t.ink)
      pixelSprite(ctx, ['..1..', '.111.', '..1..', '1.1.1', '.111.'], -33, 2, t.ink)
      return
    }
    default:
      return
  }
}

/** The pip column: down the hero's back, clear of the face, the weapon and the lane. */
const PIP_AT = (i: number) => ({ x: -28, y: -54 + i * 13 })

/** Tells that sit OVER the figure. */
export function drawTellOver(ctx: Ctx, t: Tell, fist: { x: number; y: number }, offFist: { x: number; y: number }): void {
  switch (t.kind) {
    case 'pips':
      for (let i = 0; i < t.n; i++) {
        const p = PIP_AT(i)
        pixelSprite(ctx, PIPS[t.shape], p.x, p.y, t.ink)
      }
      return
    case 'pennant': {
      // A short staff at the back shoulder, the flag streaming back (left),
      // over the figure so the plume cannot hide it, and under the head's top.
      pixLine(ctx, [[-14, -14], [-14, -62]], '#866353')
      const rows = t.tail ? ['1111111', '1211111', '111111.', '11111..', '111111.', '1111111'] : ['1111111', '1211111', '1111111', '111111.', '11111..']
      pixelSprite(ctx, rows, -28, -62, t.ink)
      if (t.emblem) pixelSprite(ctx, ['1.', '.1', '1.'], -24, -58, t.emblem, 2)
      return
    }
    case 'shields':
      for (let i = 0; i < t.n; i++) {
        const k = t.n === 1 ? 0 : i / (t.n - 1) - 0.5
        pixelSprite(ctx, ['11111', '12221', '11211', '.111.', '..1..'], -5 + k * 30, 12, t.ink)
      }
      return
    case 'streaks':
      for (let i = 0; i < (t.n ?? 3); i++) {
        const y = -40 + i * 12
        const len = 12 - (i % 2) * 4
        pixLine(ctx, [[-30, y], [-30 + len, y]], t.ink)
      }
      return
    case 'halo': {
      ctx.save()
      ctx.globalAlpha = 0.55
      ctx.fillStyle = t.ink
      ctx.beginPath()
      ctx.arc(fist.x - 1, fist.y - 6, 9, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      if (t.core) for (const [dx, dy] of [[-12, -20], [-14, -4]] as const) pixelSprite(ctx, ['.1.', '121', '.1.'], fist.x + dx, fist.y + dy, t.ink)
      return
    }
    case 'sight':
      pixelSprite(ctx, ['..1..', '..1..', '11.11', '..1..', '..1..'], 6, -74, t.ink)
      return
    case 'motes': {
      const at = t.at === 'off' ? { x: offFist.x - 4, y: offFist.y - 18 } : t.at === 'main' ? { x: fist.x - 2, y: fist.y - 26 } : { x: -8, y: -4 }
      const offs = t.at === 'feet' ? [[-16, 4], [12, -2], [-4, -12]] : [[0, 6], [8, -6], [-6, -14]]
      for (const [dx, dy] of offs) pixelSprite(ctx, t.shape ? PIPS[t.shape] : ['11', '12'], at.x + dx, at.y + dy, t.ink)
      return
    }
    case 'orbit':
      for (let i = 0; i < t.n; i++) {
        const a = (i / t.n) * Math.PI * 2 + 0.6
        pixelSprite(ctx, PIPS[t.shape], Math.cos(a) * 17 - 9, -14 + Math.sin(a) * 7 - 5, t.ink)
      }
      return
    default:
      return
  }
}

/** A drafted mark ON the struck goblin (its feet at (0, 0)). Never above its head: the HP bar is there. */
export function drawMark(ctx: Ctx, mark: string, ink?: string): void {
  switch (mark) {
    case 'poison':
      for (const [x, y] of [[-12, -22], [4, -30], [6, -14]] as const) pixelSprite(ctx, ['.11.', '1211', '1111', '.11.'], x, y, ink ?? '#95d562')
      return
    case 'bleed':
      for (const [x, y] of [[-12, -20], [6, -26], [0, -10]] as const) pixelSprite(ctx, PIPS.drop, x, y, '#f76666')
      return
    case 'roots':
      pixLine(ctx, [[-16, 6], [-12, -6], [-6, 2], [-4, -10]], '#38b251')
      pixLine(ctx, [[16, 6], [12, -6], [6, 2], [4, -10]], '#38b251')
      return
    case 'coin':
      pixelSprite(ctx, PIPS.coin, 12, -30, '#ffed44')
      return
    case 'thorns':
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * 1.1 + (i / 4) * Math.PI * 0.8
        pixLine(ctx, [[Math.cos(a) * 12, -10 + Math.sin(a) * 10], [Math.cos(a) * 20, -10 + Math.sin(a) * 16]], '#bac1c8')
      }
      return
    case 'crack':
      pixLine(ctx, [[-4, -30], [0, -20], [-6, -12], [-2, -4]], '#fffce7')
      return
    case 'brew':
      ctx.save()
      ctx.fillStyle = OUTLINE
      ctx.beginPath()
      ctx.ellipse(0, 3, 19, 7, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = ink ?? '#47aba9'
      ctx.beginPath()
      ctx.ellipse(0, 3, 17, 5.4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      for (const [x, y] of [[-10, 0], [6, 2]] as const) px(ctx, x, y, 2, 1, '#8cc3c4')
      return
    case 'skull':
      pixelSprite(ctx, PIPS.skull, 12, -28, '#e1d4bd')
      return
    case 'star':
      pixelSprite(ctx, PIPS.star, -22, -28, '#ffed44')
      return
    case 'pin':
      // Two arrows stuck in it, fletched.
      for (const [x, y] of [[-14, -22], [-8, -10]] as const) {
        pixLine(ctx, [[x - 10, y - 4], [x, y]], '#e1d4bd')
        px(ctx, x - 12, y - 6, 2, 1, '#95d562')
      }
      return
    default:
      return
  }
}
