import { shade, type Palette, type PixelRows } from '../../../game/data/pixelArt'
import { COIN, COIN_PALETTE } from '../../../game/data/pixelArt'
import { CRATE_BODY, CRATE_LID, CRATE_PALETTE } from './crateArt'
import { burstCoins, burstParticles, dustPuffs, revealParticles, shakeAmp, SHAKE_MS, type CrateFx, type CrateTier } from './crateSequence'

/**
 * The sealed crate's stage (Oct 2026): the canvas half of the opening
 * (`CrateOpening.tsx` draws the cards and words in the DOM over it). A small
 * canvas — one effect pixel is {@link stagePx} CSS px, upscaled with
 * `image-rendering: pixelated` — so every particle, ray and ring is a whole
 * pixel in the pack's chunky language, and a frame costs a few hundred
 * fills: it holds 60 fps on a phone.
 *
 * Art: the crate is `crateArt.ts` (drawn at two effect pixels a crate pixel),
 * the coins are the trade layer's coin, and the burst is the pack's own
 * explosion strip (`fx/tinyswords/explosions.png`, old CC0 Tiny Swords —
 * `CC0-MANIFEST.md`), baked at half size the way the battle bakes it. The rays,
 * glow, cracks, dust, sparks and the gold ring are procedural.
 *
 * Nothing here decides anything: the component tells it what happened (a
 * landing, a tap, the burst, a flip) and it plays the effect, sized by
 * `crateSequence` for the effects level.
 */

/** Effect pixels per crate pixel. */
export const CRATE_SCALE = 2
const CW = CRATE_LID[0].length
const LID_H = CRATE_LID.length
const BODY_H = CRATE_BODY.length
const GOLD = '#f0c03a'
const GOLD_LIGHT = '#fff1a8'
const CREAM = '#fff6dc'
const DUST = ['#c9b79a', '#a8967a', '#e2d6bf']
const WOOD = ['#d6975a', '#b0763e', '#8a5a30']
const SEAL = ['#c8372d', '#f27a62', '#7e1f1c']

/** One effect pixel in CSS px: a phone draws at 3, a desk at 4. */
export function stagePx(cssW: number, cssH: number): number {
  return Math.min(cssW, cssH * 0.62) >= 480 ? 4 : 3
}

interface Bit {
  x: number
  y: number
  vx: number
  vy: number
  g: number
  life: number
  age: number
  size: number
  color: string
  /** A spark twinkles: a plus, not a square. */
  spark?: boolean
}
interface Coin {
  x: number
  y: number
  vx: number
  vy: number
  spin: number
  age: number
  life: number
  bounced: boolean
}
interface Puff {
  x: number
  y: number
  vx: number
  r: number
  age: number
  life: number
}
interface Ring {
  x: number
  y: number
  age: number
  life: number
  to: number
  color: string
}
interface Crack {
  pts: Array<[number, number]>
}

const bake = (rows: PixelRows, pal: Palette, s: number): HTMLCanvasElement => {
  const c = document.createElement('canvas')
  c.width = rows[0].length * s
  c.height = rows.length * s
  const g = c.getContext('2d')!
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '.' || !pal[ch]) continue
      g.fillStyle = pal[ch]
      g.fillRect(x * s, y * s, s, s)
    }
  })
  return c
}
/** The silhouette of the whole crate in one colour (its glow), grown by one effect pixel. */
const silhouette = (color: string): HTMLCanvasElement => {
  const rows = [...CRATE_LID, ...CRATE_BODY]
  const s = CRATE_SCALE
  const c = document.createElement('canvas')
  c.width = CW * s + 4
  c.height = rows.length * s + 4
  const g = c.getContext('2d')!
  g.fillStyle = color
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] !== '.') g.fillRect(x * s, y * s, s + 4, s + 4)
  })
  return c
}

/**
 * The body with its seal broken: the hasp strap and the wax seal (the middle
 * columns) become the plank each row is, so the burst leaves bare wood.
 */
function openBody(): string[] {
  const SEALED = new Set(['o', 'h', 'm', 'r', 'R', 's'])
  return CRATE_BODY.map((row, y) => {
    if (y === CRATE_BODY.length - 1) return row
    const plank = row[8]
    return [...row].map((ch, x) => (x >= 12 && x <= 19 && SEALED.has(ch) && y < CRATE_BODY.length - 2 ? plank : ch)).join('')
  })
}

/** A light colour of a level's hue: its cracks and sparks. */
const light = (hex: string) => shade(hex, 0.55)
/** Eighth-step alpha, the worlds' rule: a fade in whole steps, never a smear. */
const step8 = (a: number) => Math.max(0, Math.min(1, Math.round(a * 8) / 8))

let explosionImg: HTMLImageElement | null = null
let explosionHalf: HTMLCanvasElement | null = null
/** The pack's explosion strip, fetched once and baked at half size (9 frames of 96²). */
function explosion(): HTMLCanvasElement | null {
  if (explosionHalf) return explosionHalf
  if (typeof document === 'undefined') return null
  if (!explosionImg) {
    explosionImg = new Image()
    explosionImg.src = 'assets/fx/tinyswords/explosions.png'
    // Bake it as soon as it decodes, not on the burst's frame.
    explosionImg.onload = () => void explosion()
  }
  if (!explosionImg.complete || !explosionImg.naturalWidth) return null
  const c = document.createElement('canvas')
  c.width = explosionImg.naturalWidth / 2
  c.height = explosionImg.naturalHeight / 2
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  g.drawImage(explosionImg, 0, 0, c.width, c.height)
  explosionHalf = c
  return c
}
/** Start fetching the strip before the burst needs it. */
export const preloadCrateArt = (): void => void explosion()

export interface StageView {
  /** The crate's glow: the level it has climbed to. */
  glow: CrateTier
  /** Taps so far while ready (its wobble and cracks). */
  taps: number
  /** The lid is still on. */
  sealed: boolean
  /** The crate is on screen (it is gone in the summary). */
  crate: boolean
  /** Rays behind a card building up or shown: its level, or none. */
  rays: CrateTier | 0
  /** How far the card's build-up is (0–1): the rays and sparks grow with it. */
  build: number
}

export class CrateStage {
  private ctx: CanvasRenderingContext2D
  w = 0
  h = 0
  px = 3
  private body: HTMLCanvasElement
  /** The body once the seal is broken: no hasp, no seal, bare planks. */
  private bodyOpen: HTMLCanvasElement
  private lid: HTMLCanvasElement
  private coin: HTMLCanvasElement
  private glows: Record<string, HTMLCanvasElement> = {}
  private bits: Bit[] = []
  private coins: Coin[] = []
  private puffs: Puff[] = []
  private rings: Ring[] = []
  private cracks: Crack[] = []
  private last = 0
  private t = 0
  /** The crate's fall: from `dropT0` until it lands, then the squash. */
  private dropT0 = -1
  private landAt = 0
  private dropMs = 0
  private shakeT0 = -1
  private shakeA = 0
  private lidFly: { x: number; y: number; vx: number; vy: number; rot: number; vr: number } | null = null
  private boomT0 = -1
  private flashT0 = -1
  private flashA = 0
  private flashColor = CREAM
  private rand: () => number

  constructor(
    private canvas: HTMLCanvasElement,
    private hue: Readonly<Record<CrateTier, string>>,
    private fx: () => CrateFx,
    /** The chest's look (`crateArt.CRATE_LOOKS`): the opening starts from the chest on the screen. */
    palette: Palette = CRATE_PALETTE,
  ) {
    this.ctx = canvas.getContext('2d')!
    this.body = bake(CRATE_BODY, palette, CRATE_SCALE)
    this.bodyOpen = bake(openBody(), palette, CRATE_SCALE)
    this.lid = bake(CRATE_LID, palette, CRATE_SCALE)
    this.coin = bake(COIN, COIN_PALETTE, 1)
    // Every glow baked up front: a bake mid-sequence is a dropped frame.
    for (const t of [1, 2, 3] as const) this.glows[hue[t]] = silhouette(hue[t])
    // A small fixed generator: scenery only, never a game stream.
    let s = 0x2f6b1d
    this.rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
    preloadCrateArt()
  }

  resize(cssW: number, cssH: number): void {
    this.px = stagePx(cssW, cssH)
    this.w = Math.ceil(cssW / this.px)
    this.h = Math.ceil(cssH / this.px)
    this.canvas.width = this.w
    this.canvas.height = this.h
  }

  /** The crate's floor (its bottom edge) and the card's centre, in effect px. */
  get floorY(): number {
    return Math.round(this.h * 0.84)
  }
  get cardY(): number {
    return Math.round(this.h * 0.4)
  }
  get midX(): number {
    return Math.round(this.w / 2)
  }
  private get crateW(): number {
    return CW * CRATE_SCALE
  }
  private get crateH(): number {
    return (LID_H + BODY_H) * CRATE_SCALE
  }

  // ------------------------------------------------------------ events
  drop(now: number, landMs: number, dropMs: number): void {
    this.dropT0 = now
    this.landAt = now + landMs
    this.dropMs = dropMs
  }
  land(): void {
    const n = dustPuffs(this.fx())
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1
      this.puffs.push({
        x: this.midX + side * (this.crateW / 2 - 4 + this.rand() * 8),
        y: this.floorY - 1 - this.rand() * 3,
        vx: side * (12 + this.rand() * 26),
        r: 1.5 + this.rand() * 2,
        age: 0,
        life: 0.5 + this.rand() * 0.45,
      })
    }
    this.shake(1.4)
  }
  tap(taps: number, glow: CrateTier): void {
    this.shake(shakeAmp(taps))
    // A crack of light across the body: a jagged line from the seal outward.
    const sx = this.midX
    const sy = this.floorY - BODY_H * CRATE_SCALE + 10
    const dir = taps % 2 ? 1 : -1
    const pts: Array<[number, number]> = [[sx + dir * 5, sy]]
    let x = sx + dir * 5
    let y = sy
    for (let k = 0; k < 6; k++) {
      x += dir * (2 + Math.floor(this.rand() * 3))
      y += Math.floor(this.rand() * 5) - 2 + (taps === 2 ? 1 : 0)
      pts.push([x, y])
    }
    this.cracks.push({ pts })
    const n = Math.round(6 * (this.fx() === 'light' ? 0.5 : 1) * taps)
    for (let i = 0; i < n; i++) this.spark(x, y, light(this.hue[glow]), 30, 0.4)
  }
  burst(best: CrateTier): void {
    const fx = this.fx()
    const top = this.floorY - BODY_H * CRATE_SCALE
    const side = this.rand() < 0.5 ? -1 : 1
    this.lidFly = { x: this.midX, y: top - (LID_H * CRATE_SCALE) / 2, vx: side * (95 + this.rand() * 40), vy: -250, rot: 0, vr: side * (5 + this.rand() * 3) }
    this.boomT0 = this.t
    this.flash(fx === 'full' ? 0.85 : 0.55, CREAM)
    this.shake(4)
    this.cracks = []
    const n = burstParticles(best, fx)
    const hue = this.hue[best]
    const cols = [hue, light(hue), GOLD, GOLD_LIGHT, CREAM]
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (this.rand() - 0.5) * Math.PI * 1.25
      const v = 50 + this.rand() * 120
      this.bits.push({ x: this.midX + (this.rand() - 0.5) * 20, y: top, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 140, life: 0.6 + this.rand() * 0.7, age: 0, size: this.rand() < 0.3 ? 2 : 1, color: cols[i % cols.length], spark: i % 7 === 0 })
    }
    // Splinters of the lid and crumbs of the seal.
    for (let i = 0; i < Math.round(n / 3); i++) {
      const a = -Math.PI / 2 + (this.rand() - 0.5) * Math.PI
      const v = 40 + this.rand() * 80
      const seal = i % 3 === 0
      this.bits.push({ x: this.midX + (this.rand() - 0.5) * 30, y: top + 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 220, life: 0.7 + this.rand() * 0.5, age: 0, size: 2, color: (seal ? SEAL : WOOD)[i % 3] })
    }
    for (let i = 0; i < burstCoins(fx); i++) {
      const a = -Math.PI / 2 + (this.rand() - 0.5) * 1.6
      const v = 110 + this.rand() * 70
      this.coins.push({ x: this.midX + (this.rand() - 0.5) * 16, y: top, vx: Math.cos(a) * v, vy: Math.sin(a) * v, spin: this.rand() * 6, age: 0, life: 1.6 + this.rand() * 0.6, bounced: false })
    }
    this.ring(this.midX, top + 2, 46, light(hue), 0.5)
  }
  /** A card flips face up: its burst, and Level 3's ring. */
  flip(tier: CrateTier, ring: boolean): void {
    const fx = this.fx()
    const hue = this.hue[tier]
    const cols = [hue, light(hue), CREAM, ...(tier === 3 ? [GOLD, GOLD_LIGHT] : [])]
    const n = revealParticles(tier, fx)
    for (let i = 0; i < n; i++) {
      const a = this.rand() * Math.PI * 2
      const v = 30 + this.rand() * (40 + tier * 30)
      this.bits.push({ x: this.midX, y: this.cardY, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 50, life: 0.5 + this.rand() * 0.5 + tier * 0.12, age: 0, size: this.rand() < 0.25 ? 2 : 1, color: cols[i % cols.length], spark: i % 5 === 0 })
    }
    if (tier >= 2) this.flash(tier === 3 ? (fx === 'full' ? 0.7 : 0.45) : 0.25, tier === 3 ? GOLD_LIGHT : CREAM)
    if (ring) {
      this.ring(this.midX, this.cardY, Math.max(this.w, this.h) * 0.42, GOLD, 0.75)
      this.ring(this.midX, this.cardY, Math.max(this.w, this.h) * 0.28, GOLD_LIGHT, 0.55)
    }
  }
  /** Everything on the stage stops (the summary). */
  clearAll(): void {
    this.bits = []
    this.coins = []
    this.puffs = []
    this.rings = []
    this.cracks = []
    this.lidFly = null
  }

  private spark(x: number, y: number, color: string, v: number, life: number): void {
    const a = this.rand() * Math.PI * 2
    this.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, g: 30, life: life * (0.6 + this.rand() * 0.6), age: 0, size: 1, color, spark: true })
  }
  private shake(a: number): void {
    this.shakeT0 = this.t
    this.shakeA = a
  }
  private flash(a: number, color: string): void {
    this.flashT0 = this.t
    this.flashA = a
    this.flashColor = color
  }
  private ring(x: number, y: number, to: number, color: string, life: number): void {
    this.rings.push({ x, y, age: 0, life, to, color })
  }

  // ------------------------------------------------------------ draw
  draw(nowMs: number, v: StageView): void {
    const now = nowMs / 1000
    const dt = this.last ? Math.min(0.05, Math.max(0, now - this.last)) : 0
    this.last = now
    this.t = now
    const g = this.ctx
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.imageSmoothingEnabled = false
    g.clearRect(0, 0, this.w, this.h)
    const fx = this.fx()
    const hue = this.hue[v.glow]

    // Rays behind a card building up (its level), or behind the open crate.
    if (v.rays) this.drawRays(this.midX, this.cardY, this.hue[v.rays], v.rays, v.build)
    else if (!v.sealed && v.crate) this.drawRays(this.midX, this.floorY - BODY_H * CRATE_SCALE, hue, v.glow, 0.3)

    // The open crate's light: a column from its mouth up to where the cards rise.
    if (v.crate && !v.sealed) this.drawBeam(hue, v.rays ? 0.12 + 0.06 * v.rays : 0.22)
    if (v.crate) this.drawCrate(nowMs, v, hue)

    // The pack's explosion over the crate's mouth: 9 frames in 0.54 s.
    if (this.boomT0 >= 0) {
      const sheet = explosion()
      const f = Math.floor((now - this.boomT0) / 0.06)
      if (sheet && f < 9) {
        const fw = sheet.width / 9
        g.drawImage(sheet, f * fw, 0, fw, sheet.height, Math.round(this.midX - fw / 2), Math.round(this.floorY - BODY_H * CRATE_SCALE - sheet.height / 2 - 4), fw, sheet.height)
      } else if (f >= 9) this.boomT0 = -1
    }
    if (this.lidFly) {
      const l = this.lidFly
      l.vy += 420 * dt
      l.x += l.vx * dt
      l.y += l.vy * dt
      l.rot += l.vr * dt
      g.save()
      g.translate(Math.round(l.x), Math.round(l.y))
      g.rotate(Math.round(l.rot * 8) / 8)
      g.drawImage(this.lid, -this.lid.width / 2, -this.lid.height / 2)
      g.restore()
      if (l.y - this.lid.height > this.h) this.lidFly = null
    }

    // Dust, coins, bits, rings.
    for (const p of this.puffs) {
      p.age += dt
      p.x += p.vx * dt
      p.vx *= 1 - 2.2 * dt
      const k = p.age / p.life
      g.globalAlpha = step8(0.7 * (1 - k))
      g.fillStyle = DUST[Math.floor(p.r) % DUST.length]
      const r = Math.round(p.r + k * 3)
      g.fillRect(Math.round(p.x - r), Math.round(p.y - r), r * 2, r * 2 - 1)
    }
    this.puffs = this.puffs.filter((p) => p.age < p.life)
    g.globalAlpha = 1
    for (const c of this.coins) {
      c.age += dt
      c.vy += 380 * dt
      c.x += c.vx * dt
      c.y += c.vy * dt
      c.spin += dt * 9
      if (!c.bounced && c.y > this.floorY + 6 && c.vy > 0) {
        c.vy *= -0.38
        c.vx *= 0.6
        c.bounced = true
      }
      const k = c.age / c.life
      g.globalAlpha = step8(k < 0.75 ? 1 : (1 - k) * 4)
      const sx = Math.max(0.25, Math.abs(Math.cos(c.spin)))
      const cw = Math.max(2, Math.round(8 * sx))
      g.drawImage(this.coin, Math.round(c.x - cw / 2), Math.round(c.y - 4), cw, 8)
    }
    this.coins = this.coins.filter((c) => c.age < c.life && c.y < this.h + 10)
    for (const b of this.bits) {
      b.age += dt
      b.vy += b.g * dt
      b.vx *= 1 - 0.8 * dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      const k = b.age / b.life
      g.globalAlpha = step8(k < 0.6 ? 1 : (1 - k) * 2.5)
      g.fillStyle = b.color
      const x = Math.round(b.x)
      const y = Math.round(b.y)
      if (b.spark && fx === 'full') {
        g.fillRect(x - 1, y, 3, 1)
        g.fillRect(x, y - 1, 1, 3)
      } else g.fillRect(x, y, b.size, b.size)
    }
    this.bits = this.bits.filter((b) => b.age < b.life)
    for (const r of this.rings) {
      r.age += dt
      const k = Math.min(1, r.age / r.life)
      const rad = Math.round(4 + (r.to - 4) * (1 - (1 - k) ** 3))
      g.globalAlpha = step8(1 - k)
      g.fillStyle = r.color
      this.circle(r.x, r.y, rad, k < 0.5 ? 2 : 1)
    }
    this.rings = this.rings.filter((r) => r.age < r.life)
    g.globalAlpha = 1

    // The flash: the whole stage, a few frames.
    if (this.flashT0 >= 0) {
      const k = (now - this.flashT0) / 0.24
      if (k < 1) {
        g.globalAlpha = step8(this.flashA * (1 - k))
        g.fillStyle = this.flashColor
        g.fillRect(0, 0, this.w, this.h)
        g.globalAlpha = 1
      } else this.flashT0 = -1
    }
  }

  /** The tap's shake on the crate, in effect px (decays over {@link SHAKE_MS}). */
  private shakeOffset(): number {
    if (this.shakeT0 < 0) return 0
    const k = (this.t - this.shakeT0) / (SHAKE_MS / 1000)
    if (k >= 1) return 0
    return Math.round(Math.sin(k * Math.PI * 7) * this.shakeA * (1 - k))
  }

  private drawCrate(nowMs: number, v: StageView, hue: string): void {
    const g = this.ctx
    const now = nowMs / 1000
    const cw = this.crateW
    const ch = this.crateH
    let y = this.floorY
    let sx = 1
    let sy = 1
    // The fall: eased in from above the stage (gravity), then a squash on landing.
    if (this.dropT0 >= 0) {
      const t = nowMs - this.dropT0
      const land = this.landAt - this.dropT0
      if (t < land) {
        const k = t / land
        y = this.floorY - (1 - k * k) * (this.floorY + ch)
        sy = 1.08
        sx = 0.94
      } else if (t < this.dropMs) {
        const k = (t - land) / (this.dropMs - land)
        // Squash, then a small overshoot back: 0.72 → 1.08 → 1.
        const s = k < 0.35 ? 1 - 0.28 * Math.sin((k / 0.35) * (Math.PI / 2)) : 0.72 + 0.36 * Math.sin(((k - 0.35) / 0.65) * Math.PI) + 0.28 * ((k - 0.35) / 0.65)
        sy = Math.min(1.1, s)
        sx = 1 + (1 - sy) * 0.8
      } else this.dropT0 = -1
    }
    // Anticipation while ready: a small breath, and a wobble that grows with each tap.
    let rot = 0
    if (v.sealed && this.dropT0 < 0) {
      const breath = Math.sin(now * 3.2)
      sy *= 1 + 0.025 * breath
      sx *= 1 - 0.02 * breath
      const wob = [0.035, 0.06, 0.09][Math.min(2, v.taps)]
      rot = Math.sin(now * 9) * wob * Math.max(0, Math.sin(now * 1.7)) ** 2
    }
    const off = this.shakeOffset()
    const ground = this.floorY
    // The shadow on the floor (and the glow pooled round it).
    const shadowW = Math.round(cw * 0.55 * (this.dropT0 >= 0 && y < ground ? Math.max(0.3, 1 - (ground - y) / this.h) : 1))
    g.globalAlpha = 0.5
    g.fillStyle = '#0b0705'
    g.fillRect(this.midX - shadowW, ground - 2, shadowW * 2, 4)
    g.fillRect(this.midX - shadowW + 3, ground + 2, shadowW * 2 - 6, 1)
    g.globalAlpha = 1
    const pulse = 0.5 + 0.5 * Math.sin(now * 4)
    if (this.dropT0 < 0) {
      g.globalAlpha = step8((v.sealed ? 0.18 + 0.1 * v.taps : 0.3) + 0.08 * pulse)
      g.fillStyle = hue
      const gw = Math.round(cw * 0.9)
      g.fillRect(this.midX - gw, ground - 1, gw * 2, 3)
      g.fillRect(this.midX - gw + 6, ground + 2, gw * 2 - 12, 2)
      g.globalAlpha = 1
    }

    g.save()
    g.translate(this.midX + off, Math.round(y))
    if (rot) g.rotate(rot)
    g.scale(sx, sy)
    // The glow: the silhouette in the level's colour, behind, breathing.
    if (this.dropT0 < 0 && v.sealed) {
      const sil = (this.glows[hue] ??= silhouette(hue))
      g.globalAlpha = step8(0.35 + 0.15 * v.taps + 0.2 * pulse)
      g.drawImage(sil, -cw / 2 - 2, -ch - 2)
      g.globalAlpha = 1
    }
    const bodyTop = -BODY_H * CRATE_SCALE
    g.drawImage(v.sealed ? this.body : this.bodyOpen, -cw / 2, bodyTop)
    if (v.sealed) g.drawImage(this.lid, -cw / 2, -ch)
    else {
      // Open: the dark of the inside, lit from within.
      g.fillStyle = '#1a0f08'
      g.fillRect(-cw / 2 + 2, bodyTop, cw - 4, 4)
      g.globalAlpha = step8(0.55 + 0.25 * pulse)
      g.fillStyle = light(hue)
      g.fillRect(-cw / 2 + 6, bodyTop + 1, cw - 12, 2)
      g.globalAlpha = 1
    }
    // The cracks of light, flickering.
    if (v.sealed && this.cracks.length) {
      const lc = light(hue)
      for (const c of this.cracks) {
        g.globalAlpha = step8(0.75 + 0.25 * Math.sin(now * 30 + c.pts[0][0]))
        g.fillStyle = lc
        for (let i = 1; i < c.pts.length; i++) {
          const [ax, ay] = c.pts[i - 1]
          const [bx, by] = c.pts[i]
          const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay))
          for (let s = 0; s <= n; s++) {
            const x = Math.round(ax + ((bx - ax) * s) / (n || 1)) - this.midX
            const yy = Math.round(ay + ((by - ay) * s) / (n || 1)) - ground
            g.fillRect(x, yy, 2, 1)
          }
        }
      }
      // Light leaking at the lid's seam, brighter with every tap.
      g.globalAlpha = step8(0.25 * this.cracks.length + 0.2 * pulse)
      g.fillStyle = light(hue)
      g.fillRect(-cw / 2 + 2, -ch + LID_H * CRATE_SCALE - 2, cw - 4, 1)
      g.globalAlpha = 1
    }
    g.restore()
  }

  /** A stepped column of light from the crate's mouth to the card's middle. */
  private drawBeam(color: string, a: number): void {
    const g = this.ctx
    const top = this.cardY
    const mouth = this.floorY - BODY_H * CRATE_SCALE + 1
    const w = this.crateW - 12
    const flick = 0.85 + 0.15 * Math.sin(this.t * 11)
    // Four bands up the column, each fainter than the one under it: the light
    // thins as it rises instead of stopping at a hard edge.
    const bands = 4
    const bh = Math.max(1, Math.ceil((mouth - top) / bands))
    for (let b = 0; b < bands; b++) {
      const y0 = mouth - (b + 1) * bh
      const fade = 1 - b / bands
      for (let k = 0; k < 3; k++) {
        g.globalAlpha = step8(a * flick * (k + 1) * 0.5 * fade)
        g.fillStyle = k === 2 ? CREAM : light(color)
        const ww = Math.round(w * (1 - k * 0.3) * (1 - b * 0.08))
        g.fillRect(this.midX - (ww >> 1), Math.max(top - bh, y0), ww, bh)
      }
    }
    g.globalAlpha = 1
  }

  /** Rays from a point: wedges turning slowly, longer and brighter as `build` rises. */
  private drawRays(cx: number, cy: number, color: string, tier: CrateTier, build: number): void {
    const g = this.ctx
    const n = tier === 3 ? 14 : tier === 2 ? 10 : 8
    const len = Math.max(this.w, this.h) * (0.35 + 0.35 * build + 0.08 * tier)
    const spin = this.t * (0.25 + 0.1 * tier)
    const a = step8((0.1 + 0.08 * tier) * (0.5 + 0.5 * build))
    g.globalAlpha = a
    g.fillStyle = color
    for (let i = 0; i < n; i++) {
      const th = spin + (i / n) * Math.PI * 2
      const half = Math.PI / n / 2.2
      g.beginPath()
      g.moveTo(cx, cy)
      g.lineTo(cx + Math.cos(th - half) * len, cy + Math.sin(th - half) * len)
      g.lineTo(cx + Math.cos(th + half) * len, cy + Math.sin(th + half) * len)
      g.closePath()
      g.fill()
    }
    // A soft core: three stepped discs.
    for (let k = 3; k >= 1; k--) {
      g.globalAlpha = step8((0.1 + 0.05 * tier) * (1 + build))
      this.disc(cx, cy, Math.round((6 + 5 * tier) * k * (0.6 + 0.4 * build)))
    }
    // Rising sparks while a Level 2 or 3 builds up.
    if (tier >= 2 && build > 0 && build < 1 && this.rand() < 0.35 * tier * (this.fx() === 'light' ? 0.5 : 1)) {
      this.spark(cx + (this.rand() - 0.5) * 40, cy + 10 + this.rand() * 20, tier === 3 ? GOLD_LIGHT : light(color), 14, 0.7)
    }
    g.globalAlpha = 1
  }

  private disc(cx: number, cy: number, r: number): void {
    const g = this.ctx
    for (let y = -r; y <= r; y++) {
      const hw = Math.round(Math.sqrt(r * r - y * y))
      g.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2, 1)
    }
  }
  /** A pixel circle's outline, `t` px thick. */
  private circle(cx: number, cy: number, r: number, t: number): void {
    const g = this.ctx
    for (let y = -r; y <= r; y++) {
      const o = Math.sqrt(Math.max(0, r * r - y * y))
      const ri = r - t
      const i = Math.abs(y) <= ri ? Math.sqrt(ri * ri - y * y) : 0
      const x0 = Math.round(o)
      const x1 = Math.round(i)
      const w = Math.max(1, x0 - x1)
      g.fillRect(Math.round(cx - x0), Math.round(cy + y), w, 1)
      g.fillRect(Math.round(cx + x0 - w), Math.round(cy + y), w, 1)
    }
  }
}
