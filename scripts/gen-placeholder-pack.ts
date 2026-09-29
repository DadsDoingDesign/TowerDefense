/**
 * Generate a PLACEHOLDER `fieldwatch` sprite pack.
 *
 * This is not art. It is flat blocking at the exact dimensions
 * `docs/ART-PLAN.md` §1.4 specifies, so the pipeline — bake, ring, anchors,
 * compositor, harness — can be exercised end to end before a single real pixel
 * exists, and so the artist has a correctly-sized template to draw over.
 *
 * Everything it emits obeys the rules the real art has to obey:
 *   - authored at true on-field size (the pack is `spriteScale: 1`)
 *   - even cell dimensions
 *   - feet on the cell's bottom row in every frame
 *   - top 10% left transparent for the tier plaque
 *   - no baked outline, rim light or drop shadow (the engine adds the ring)
 *   - decorations under DECO_CEIL (96 drawn px)
 *
 * Delete the whole directory and re-run to reset:
 *   npm run placeholder-pack
 */
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const OUT = join('public', 'assets', 'sprites', 'fieldwatch')

// ---- a tiny pixel canvas -------------------------------------------------

class Px {
  readonly buf: Buffer
  constructor(readonly w: number, readonly h: number) {
    this.buf = Buffer.alloc(w * h * 4)
  }
  set(x: number, y: number, c: readonly number[]): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const o = (y * this.w + x) * 4
    this.buf[o] = c[0]; this.buf[o + 1] = c[1]; this.buf[o + 2] = c[2]; this.buf[o + 3] = c[3] ?? 255
  }
  rect(x: number, y: number, w: number, h: number, c: readonly number[]): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c)
  }
  /** Bresenham, thickened by `t`. Used for placeholder weapon shafts. */
  line(x0: number, y0: number, x1: number, y1: number, c: readonly number[], t = 1): void {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
    let err = dx - dy, x = x0, y = y0
    for (;;) {
      this.rect(x - ((t / 2) | 0), y - ((t / 2) | 0), t, t, c)
      if (x === x1 && y === y1) break
      const e2 = 2 * err
      if (e2 > -dy) { err -= dy; x += sx }
      if (e2 < dx) { err += dx; y += sy }
    }
  }
  save(file: string): Promise<unknown> {
    return sharp(this.buf, { raw: { width: this.w, height: this.h, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toFile(join(OUT, file))
  }
}

// ---- palette (BRAND.md tokens; warm, no cool blue-grey) ------------------

const SKIN = [214, 168, 122, 255]
const CLOTH = [87, 162, 182, 255]   // --teal, the knights' colour
const CLOTH_D = [56, 108, 124, 255]
const LEATHER = [107, 69, 38, 255]  // --wood
const LEATHER_D = [74, 45, 24, 255]
const METAL = [198, 190, 172, 255]
const METAL_D = [132, 126, 112, 255]
const GOLD = [224, 172, 76, 255]
const GOBLIN = [122, 150, 74, 255]
const GOBLIN_D = [82, 104, 48, 255]
const LEAF = [74, 112, 58, 255]
const LEAF_D = [52, 82, 40, 255]
const GRASS = [104, 150, 74, 255]
const GRASS_2 = [96, 140, 68, 255]

const MAIN = [255, 0, 255, 255]
const OFF = [0, 255, 255, 255]
const TIP = [255, 255, 0, 255]

// ---- the hero -----------------------------------------------------------

/**
 * Draw a 2.5-head chibi block into `p` with its feet on `baseY` and centred on
 * `cx`. `lift` raises the upper body only — the feet stay planted, which is
 * the anchoring rule every frame of every strip has to keep.
 *
 * Returns the hand positions so the anchor layer and the body agree by
 * construction rather than by a number typed twice.
 */
function hero(p: Px, cx: number, baseY: number, lift: number, reach: number) {
  const H = 64 // figure height; the cell is taller to leave plaque headroom
  const top = baseY - H
  const headR = 11
  const headY = top + lift

  // legs (planted)
  p.rect(cx - 9, baseY - 16, 7, 16, LEATHER_D)
  p.rect(cx + 2, baseY - 16, 7, 16, LEATHER_D)
  p.rect(cx - 10, baseY - 4, 9, 4, LEATHER)
  p.rect(cx + 1, baseY - 4, 9, 4, LEATHER)

  // torso — wide and heavy: the fighter is the widest silhouette
  p.rect(cx - 13, headY + headR * 2 - 2, 26, 26 + (baseY - 16 - (headY + headR * 2 - 2 + 26)), CLOTH)
  p.rect(cx - 13, headY + headR * 2 - 2, 6, 26, CLOTH_D) // shadow side, light top-left
  // belt
  p.rect(cx - 13, headY + headR * 2 + 18, 26, 4, LEATHER)

  // head
  p.rect(cx - headR, headY, headR * 2, headR * 2, SKIN)
  p.rect(cx - headR, headY, 5, headR * 2, [188, 143, 100, 255])
  // helmet brow
  p.rect(cx - headR - 1, headY - 1, headR * 2 + 2, 6, METAL)
  p.rect(cx - headR - 1, headY - 1, 5, 6, METAL_D)

  // arms — main hand reaches by `reach`
  const shoulderY = headY + headR * 2 + 2
  const mainX = cx + 13 + reach
  const mainY = shoulderY + 12 - (reach >> 1)
  const offX = cx - 15
  const offY = shoulderY + 12
  p.line(cx + 10, shoulderY + 2, mainX, mainY, CLOTH, 5)
  p.line(cx - 10, shoulderY + 2, offX, offY, CLOTH_D, 5)
  p.rect(mainX - 3, mainY - 3, 6, 6, SKIN)
  p.rect(offX - 3, offY - 3, 6, 6, SKIN)

  return { mainX, mainY, offX, offY }
}

/** Idle: 6 frames of a 1px breathing lift. Cell 64×72. */
async function fighterIdle(): Promise<void> {
  const F = 6, CW = 64, CH = 72
  const body = new Px(CW * F, CH)
  const anch = new Px(CW * F, CH)
  for (let f = 0; f < F; f++) {
    const cx = f * CW + CW / 2
    const lift = [0, 0, 1, 1, 0, 0][f]
    const h = hero(body, cx, CH - 1, -lift, 0)
    anch.set(h.mainX, h.mainY, MAIN)
    anch.set(h.offX, h.offY, OFF)
    anch.set(h.mainX + 2, h.mainY - 18, TIP)
  }
  await body.save('fighter_idle.png')
  await anch.save('fighter_idle_anchors.png')
}

/**
 * Attack: 6 frames. Cell 98×90 — wider and taller than idle so the raised
 * weapon has room, with the feet still on the bottom row.
 *
 * The hand walks the shared five-pose vocabulary: wind-up, contact by frame
 * 2–3, then recovery.
 */
async function fighterAtk(): Promise<void> {
  const F = 6, CW = 98, CH = 90
  const body = new Px(CW * F, CH)
  const anch = new Px(CW * F, CH)
  const REACH = [-4, -2, 6, 14, 10, 2]
  const LIFT = [1, 2, 1, 0, 0, 0]
  for (let f = 0; f < F; f++) {
    const cx = f * CW + CW / 2
    const h = hero(body, cx, CH - 1, -LIFT[f], REACH[f])
    anch.set(h.mainX, h.mainY, MAIN)
    anch.set(h.offX, h.offY, OFF)
    anch.set(h.mainX + 2, h.mainY - 18, TIP)
  }
  await body.save('fighter_atk.png')
  await anch.save('fighter_atk_anchors.png')
}

/** The static PNG: canvas fallback AND the DOM roster portrait at native 1:1. */
async function fighterStatic(): Promise<void> {
  const p = new Px(64, 72)
  hero(p, 32, 71, 0, 0)
  await p.save('fighter.png')
}

// ---- gear ---------------------------------------------------------------

/**
 * The five poses as (angle, length) pairs. All three heroes animate to these,
 * which is what makes gear cost 11 × 5 rather than 11 × 3 × 14.
 *
 * Angles are screen degrees, 0 = pointing right, negative = up.
 */
const POSE_ANGLE = [55, -78, -30, 4, 46]

/**
 * One weapon strip: 5 cells, grip at a fixed point in each, blade swung to the
 * pose angle. Emits its own anchor layer so the compositor can land the grip on
 * the hero's hand.
 */
async function weapon(
  name: string,
  len: number,
  width: number,
  colour: readonly number[],
  guard: boolean,
): Promise<void> {
  const CW = 48, CH = 56, F = 5
  const gx = CW >> 1, gy = CH - 12 // grip sits low-centre in the cell
  const body = new Px(CW * F, CH)
  const anch = new Px(CW * F, CH)
  for (let f = 0; f < F; f++) {
    const ox = f * CW
    const a = (POSE_ANGLE[f] * Math.PI) / 180
    const tx = Math.round(gx + Math.cos(a) * len)
    const ty = Math.round(gy + Math.sin(a) * len)
    // haft/blade
    body.line(ox + gx, gy, ox + tx, ty, colour, width)
    // hilt below the grip
    const hx = Math.round(gx - Math.cos(a) * 6)
    const hy = Math.round(gy - Math.sin(a) * 6)
    body.line(ox + gx, gy, ox + hx, hy, LEATHER, Math.max(2, width - 1))
    if (guard) {
      const px2 = Math.round(Math.cos(a + Math.PI / 2) * 5)
      const py2 = Math.round(Math.sin(a + Math.PI / 2) * 5)
      body.line(ox + gx - px2, gy - py2, ox + gx + px2, gy + py2, GOLD, 2)
    }
    anch.set(ox + gx, gy, MAIN)
    anch.set(ox + tx, ty, TIP)
  }
  await body.save(`gear_${name}.png`)
  await anch.save(`gear_${name}_anchors.png`)
}

/** An off-hand: a held mass rather than a swung one, so it barely rotates. */
async function offhand(name: string, w: number, h: number, colour: readonly number[]): Promise<void> {
  const CW = 48, CH = 56, F = 5
  const gx = CW >> 1, gy = CH - 12
  const body = new Px(CW * F, CH)
  const anch = new Px(CW * F, CH)
  for (let f = 0; f < F; f++) {
    const ox = f * CW
    const drift = [0, -2, -3, -2, -1][f]
    const x = ox + gx - (w >> 1), y = gy - (h >> 1) + drift
    body.rect(x, y, w, h, colour)
    body.rect(x, y, 3, h, METAL_D)
    body.rect(x + (w >> 1) - 1, y + (h >> 1) - 1, 3, 3, GOLD)
    anch.set(ox + gx, gy + drift, MAIN)
  }
  await body.save(`gear_${name}.png`)
  await anch.save(`gear_${name}_anchors.png`)
}

/**
 * A body overlay: pauldron and hem, drawn at the CELL ORIGIN rather than at a
 * hand anchor, because armour is a torso silhouette change and not a held
 * object. Cell matches the idle cell so it lands on the body unshifted.
 *
 * At 52 device px a torso *texture* is invisible; a changed OUTLINE is not.
 * So these are deliberately shape-only.
 */
async function bodyOverlay(name: string, colour: readonly number[], hem: boolean): Promise<void> {
  const CW = 64, CH = 72, F = 5
  const body = new Px(CW * F, CH)
  for (let f = 0; f < F; f++) {
    const ox = f * CW, cx = ox + CW / 2
    const lift = [0, 1, 1, 0, 0][f]
    const shoulderY = CH - 64 + 20 - lift
    // pauldrons break the outline, which is the part that survives the blit
    body.rect(cx - 19, shoulderY, 8, 10, colour)
    body.rect(cx + 11, shoulderY, 8, 10, colour)
    body.rect(cx - 19, shoulderY, 8, 3, METAL)
    body.rect(cx + 11, shoulderY, 8, 3, METAL)
    if (hem) {
      // a cloak hem that swings with the pose
      const sway = [0, -1, -3, -2, -1][f]
      body.rect(cx - 14 + sway, CH - 26, 28, 12, colour)
      body.rect(cx - 14 + sway, CH - 16, 28, 3, METAL_D)
    }
  }
  await body.save(`body_${name}.png`)
}

// ---- enemies and dressing ----------------------------------------------

async function goblin(): Promise<void> {
  const F = 6, CW = 88, CH = 60
  const walk = new Px(CW * F, CH)
  for (let f = 0; f < F; f++) {
    const cx = f * CW + CW / 2
    const step = [0, 2, 3, 0, -2, -3][f]
    const bob = [0, 1, 0, 0, 1, 0][f]
    walk.rect(cx - 5 + step, CH - 12, 5, 12, GOBLIN_D)
    walk.rect(cx - step, CH - 12, 5, 12, GOBLIN_D)
    walk.rect(cx - 11, CH - 34 - bob, 22, 22, GOBLIN)
    walk.rect(cx - 11, CH - 34 - bob, 6, 22, GOBLIN_D)
    walk.rect(cx - 9, CH - 50 - bob, 18, 16, GOBLIN)
    walk.rect(cx - 9, CH - 50 - bob, 5, 16, GOBLIN_D)
    walk.rect(cx + 3, CH - 46 - bob, 3, 3, [220, 90, 60, 255]) // eye
    walk.line(cx + 11, CH - 30 - bob, cx + 19, CH - 44 - bob, LEATHER, 3) // torch
    walk.rect(cx + 17, CH - 48 - bob, 5, 5, [240, 150, 60, 255])
  }
  await walk.save('torch1_walk.png')
  const s = new Px(CW, CH)
  s.rect(CW / 2 - 11, CH - 34, 22, 22, GOBLIN)
  s.rect(CW / 2 - 9, CH - 50, 18, 16, GOBLIN)
  s.rect(CW / 2 - 5, CH - 12, 5, 12, GOBLIN_D)
  s.rect(CW / 2, CH - 12, 5, 12, GOBLIN_D)
  await s.save('torch1.png')
}

/**
 * A framing tree at 57×88 drawn size.
 *
 * Under DECO_CEIL (96) so it survives the pool, and over DECO_TREE_MIN (40) so
 * it counts as framing rather than litter. Decorations get NO baked ring
 * (`renderer.ts:579`), so unlike the units this one carries its own outline.
 */
async function tree(): Promise<void> {
  const p = new Px(58, 88)
  p.rect(24, 62, 10, 26, LEATHER_D)
  p.rect(24, 62, 4, 26, [58, 36, 20, 255])
  for (let i = 0; i < 4; i++) {
    const w = 46 - i * 8, y = 56 - i * 15
    p.rect(29 - (w >> 1), y, w, 18, i % 2 ? LEAF_D : LEAF)
    p.rect(29 - (w >> 1), y, 4, 18, [40, 62, 30, 255]) // own outline
    p.rect(29 + (w >> 1) - 2, y, 2, 18, [40, 62, 30, 255])
  }
  await p.save('tree1.png')
}

/** Grass must tile seamlessly at its authored size — at scale 1 that is 32×32. */
async function grass(): Promise<void> {
  const p = new Px(32, 32)
  p.rect(0, 0, 32, 32, GRASS)
  // low contrast, low frequency: a busy tile fights the procedural tuft layer
  for (const [x, y] of [[3, 5], [17, 2], [9, 19], [25, 13], [21, 26], [12, 29]]) {
    p.rect(x, y, 3, 2, GRASS_2)
  }
  await p.save('grass.png')
}

async function main(): Promise<void> {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })

  await fighterIdle()
  await fighterAtk()
  await fighterStatic()

  await weapon('sword', 30, 4, METAL, true)
  await weapon('greatsword', 42, 6, METAL, true)
  await weapon('staff', 40, 4, LEATHER, false)
  await weapon('dagger', 18, 3, METAL, false)
  await offhand('shield', 22, 26, CLOTH)
  await offhand('buckler', 16, 18, METAL)
  await bodyOverlay('plate', METAL_D, false)
  await bodyOverlay('robe', CLOTH_D, true)

  await goblin()
  await tree()
  await grass()

  console.log(`placeholder-pack: wrote ${OUT}`)
  console.log('This is BLOCKING, not art. Draw over it at the same dimensions.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
