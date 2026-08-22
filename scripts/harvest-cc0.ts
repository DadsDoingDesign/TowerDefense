/**
 * harvest-cc0.ts — re-derive every Tiny Swords asset in `public/assets/` from the
 * OLD, genuinely-CC0 build of the pack, and write `public/assets/CC0-MANIFEST.md`.
 *
 *   npx tsx scripts/harvest-cc0.ts          # fetch (cached), rebuild, write manifest
 *   npx tsx scripts/harvest-cc0.ts --check  # verify only; touch nothing
 *
 * ## Why this script exists
 *
 * Tiny Swords is **no longer CC0**. The itch page now reads, verbatim:
 *
 *   "Feel free to use this asset pack in both personal and commercial projects,
 *    modifying the assets as needed. Crediting is not required, but it helps and
 *    is always welcome. You may not redistribute, resell, or repackage the
 *    assets, even if the files are modified."
 *
 * Pixel Frog kept the older public-domain build as a separate download named
 * `TS_old version_CC0 Licensed`. Only THAT build may be redistributed.
 *
 * This repository is public on GitHub, so every PNG under `public/assets/` is a
 * redistribution. Nineteen files had been taken — via the `chongdashu/
 * phaserjs-tinyswords` GitHub mirror, which a stale `CREDITS.md` line described
 * as a "CC0 mirror" — from the POST-CC0 build, and hosting those loose is
 * exactly what the current licence forbids. This script replaces all nineteen
 * with old-CC0 art and harvests the rest of the public-domain pack.
 *
 * ## Provenance, and why a mirror's own CC0 claim is not evidence
 *
 * `chongdashu/phaserjs-tinyswords` presents post-CC0 content while being cited
 * as a CC0 source. A mirror's README is not proof. Provenance here was settled
 * by comparing **exact opaque-colour sets** against both builds: the post-CC0
 * build introduced palette entries the old build never contained, so a file
 * carrying a chongdashu-exclusive colour and zero old-build-exclusive colour
 * cannot have come from the public-domain build. `--check` re-runs that test.
 *
 * The upstream used here is `FulAppiOS/Agent-Quest`, which ships the old build
 * under a real `CC0 1.0 LICENSE.txt`. Its own theme README independently
 * confirms the two judgements this script encodes: that the pack is "Update 010
 * (CC0 edition)", and that `BuildingsCustom/` is "user-authored custom art" —
 * which is why `BuildingsCustom/` is deliberately NOT harvested. Those eight
 * buildings appear in no Pixel Frog description; their provenance is unverified,
 * so they are left out.
 *
 * ## The halo convention
 *
 * Field sprites carry a 1px outline so they read against grass: a ring of
 * `#161C2E` at alpha 80 in the transparent pixels 8-adjacent to the artwork.
 * Every generated sprite is trimmed to its opaque bounding box and then grown
 * by exactly 1px for that ring, so the file is always `bbox + 2` on each axis.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import sharp from 'sharp'

const ROOT = resolve(import.meta.dirname, '..')
const ASSETS = join(ROOT, 'public', 'assets')
const CACHE = join(ROOT, 'node_modules', '.cache', 'cc0-pack')
const CHECK_ONLY = process.argv.includes('--check')

/** The verified CC0 upstream. Raw files hang off this prefix. */
const UPSTREAM =
  'https://raw.githubusercontent.com/FulAppiOS/Agent-Quest/main/client/public/assets/themes/tiny-swords-cc0/'
const UPSTREAM_HOME = 'https://github.com/FulAppiOS/Agent-Quest'
/** Enumerates the upstream so the palette check can see the WHOLE pack. */
const UPSTREAM_TREE = 'https://api.github.com/repos/FulAppiOS/Agent-Quest/git/trees/main?recursive=1'
const UPSTREAM_PREFIX = 'client/public/assets/themes/tiny-swords-cc0/'

const HALO = { r: 0x16, g: 0x1c, b: 0x2e, a: 80 }

// ----------------------------------------------------------------- fetching

async function source(rel: string): Promise<string> {
  const dst = join(CACHE, rel)
  if (existsSync(dst)) return dst
  const url = UPSTREAM + rel.split('/').map(encodeURIComponent).join('/')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`)
  mkdirSync(dirname(dst), { recursive: true })
  writeFileSync(dst, Buffer.from(await res.arrayBuffer()))
  return dst
}

// ------------------------------------------------------------- pixel helpers

type Img = { d: Buffer; w: number; h: number }

const load = async (p: string): Promise<Img> => {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { d: data, w: info.width, h: info.height }
}
const save = (img: Img, p: string): Promise<unknown> => {
  mkdirSync(dirname(p), { recursive: true })
  return sharp(img.d, { raw: { width: img.w, height: img.h, channels: 4 } })
    .png({ compressionLevel: 9, palette: true })
    .toFile(p)
}

function crop(src: Img, x0: number, y0: number, w: number, h: number): Img {
  const d = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let k = 0; k < 4; k++) d[(y * w + x) * 4 + k] = src.d[((y + y0) * src.w + (x + x0)) * 4 + k]
  return { d, w, h }
}

function flipX(src: Img): Img {
  const d = Buffer.alloc(src.d.length)
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++)
      for (let k = 0; k < 4; k++) d[(y * src.w + x) * 4 + k] = src.d[(y * src.w + (src.w - 1 - x)) * 4 + k]
  return { d, w: src.w, h: src.h }
}

/** Trim to the opaque bounding box. Throws on a fully transparent image. */
function trim(src: Img): Img {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++)
      if (src.d[(y * src.w + x) * 4 + 3] > 0) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  if (x1 < 0) throw new Error('trim: image is fully transparent')
  return crop(src, x0, y0, x1 - x0 + 1, y1 - y0 + 1)
}

/**
 * Grow by 1px and paint the outline ring. Reads from a snapshot so the ring
 * cannot feed on itself and thicken.
 */
function addHalo(src: Img): Img {
  const w = src.w + 2, h = src.h + 2
  const d = Buffer.alloc(w * h * 4)
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++)
      for (let k = 0; k < 4; k++) d[((y + 1) * w + (x + 1)) * 4 + k] = src.d[(y * src.w + x) * 4 + k]
  const snap = Buffer.from(d)
  const N = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (snap[i + 3] !== 0) continue
      let near = false
      for (const [dx, dy] of N) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        if (snap[(ny * w + nx) * 4 + 3] > 0) { near = true; break }
      }
      if (!near) continue
      d[i] = HALO.r; d[i + 1] = HALO.g; d[i + 2] = HALO.b; d[i + 3] = HALO.a
    }
  return { d, w, h }
}

/**
 * Nine-slice resample: split a square source into thirds and resize each region
 * independently, so corners keep their proportions at the target size. Used to
 * regenerate the four `border-image` chrome files, whose CSS contract (110x110
 * with `slice 46`) must survive the licence swap untouched — the stylesheets
 * that consume them are owned by another agent.
 *
 * NEAREST, deliberately. A smooth kernel blends neighbouring pixels and invents
 * colours that exist nowhere in the source: lanczos3 turned a 15-colour wood
 * panel into 371 colours, which both blurs the pixel art and destroys the one
 * signal the palette check downstream relies on. 64->46 is not an integer ratio
 * so nearest drops some rows unevenly, but CSS `border-image` stretches these
 * regions at paint time regardless, and a crisp edge survives that better.
 */
async function nineSlice(srcPath: string, out: string, size: number, border: number): Promise<void> {
  const meta = await sharp(srcPath).metadata()
  const S = meta.width!
  const t = Math.round(S / 3)
  const mid = size - border * 2
  const cols: Array<[number, number, number]> = [[0, t, border], [t, S - 2 * t, mid], [S - t, t, border]]
  const rows = cols
  const canvas = sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  const parts: sharp.OverlayOptions[] = []
  let top = 0
  for (const [sy, sh, dh] of rows) {
    let left = 0
    for (const [sx, sw, dw] of cols) {
      const buf = await sharp(srcPath)
        .extract({ left: sx, top: sy, width: sw, height: sh })
        .resize(dw, dh, { kernel: 'nearest', fit: 'fill' })
        .png().toBuffer()
      parts.push({ input: buf, left, top })
      left += dw
    }
    top += dh
  }
  mkdirSync(dirname(out), { recursive: true })
  await canvas.composite(parts).png({ compressionLevel: 9 }).toFile(out)
}

// ------------------------------------------------------- the sprite rebuilds

/**
 * The nineteen tainted files and what replaces each.
 *
 * `grass` is a terrain tile: it must stay a seamless 64x64 with no halo and no
 * trim, so it is the one entry that skips both.
 *
 * The old build ships ONE pine (a six-frame sway animation) plus a stump, where
 * the post-CC0 build had four distinct species. tree1/2/3 are therefore the
 * three most mutually-different sway frames of that single pine — measured, not
 * guessed: frames 0/4/5 differ from one another by 4.7k-8.4k pixels, where
 * frames 0 and 2 differ by only 56. They read as one species in three poses.
 * `tree4` is the stump, which at least brings a genuinely different silhouette.
 *
 * The old build has three land rocks to the post-CC0 build's four, so `rock4`
 * is the largest of them mirrored — CC0 permits modification, and a mirrored
 * boulder is a real silhouette rather than a duplicate. Deleting `rock4.png`
 * instead is safe (the loader falls back procedurally) but costs one 404.
 */
type SpriteJob = {
  out: string
  src: string
  crop?: [number, number, number, number]
  flip?: boolean
  raw?: boolean
  note: string
}
const SPRITES: SpriteJob[] = [
  { out: 'grass.png', src: 'Terrain/Ground/Tilemap_Flat.png', crop: [64, 64, 64, 64], raw: true,
    note: 'interior grass tile (row 1, col 1 of the 10x4 autotile block) — seamless, no halo' },
  { out: 'tree1.png', src: 'Resources/Trees/Tree.png', crop: [0, 0, 192, 192],
    note: 'pine, sway frame 0' },
  { out: 'tree2.png', src: 'Resources/Trees/Tree.png', crop: [0, 192, 192, 192],
    note: 'pine, sway frame 4 (8015 px different from frame 0)' },
  { out: 'tree3.png', src: 'Resources/Trees/Tree.png', crop: [192, 192, 192, 192],
    note: 'pine, sway frame 5 (4768 px from frame 0, 8350 from frame 4)' },
  { out: 'tree4.png', src: 'Resources/Trees/Tree.png', crop: [0, 384, 192, 192],
    note: 'tree stump — the only other woodland silhouette the old build ships' },
  { out: 'bush1.png', src: 'Deco/09.png', note: 'large bush' },
  { out: 'bush2.png', src: 'Deco/08.png', note: 'medium bush' },
  { out: 'rock1.png', src: 'Deco/04.png', note: 'small rock' },
  { out: 'rock2.png', src: 'Deco/06.png', note: 'large rock' },
  { out: 'rock3.png', src: 'Deco/05.png', note: 'medium rock' },
  { out: 'rock4.png', src: 'Deco/06.png', flip: true, note: 'large rock, mirrored (no 4th land rock exists)' },

  /*
   * Barrels: a licence-independent bug fixed while we are in here.
   *
   * `barrel1..5.png` were 158x164 windows onto a sheet whose grid is 128px, so
   * each one carried the intended barrel (50x70) PLUS two fragments of the
   * neighbouring roll-cycle cells — 1572 stray pixels against 2545 real ones,
   * i.e. 38% of the visible art was pieces of other poses. That is five of the
   * fifteen enemy types, `barrel5` "The Colossus Keg" among them.
   *
   * The idle barrel is cell (0,0) of the 6x6 128px grid. Cropping to the actual
   * cell and trimming gives a clean 50x70.
   *
   * The colour mapping is preserved exactly, INCLUDING `barrel5` reusing Purple
   * — the tier-5 duplication documented in CREDITS.md is a real content gap, and
   * silently papering over it here would make that note wrong.
   */
  ...(['Red', 'Blue', 'Purple', 'Yellow', 'Purple'] as const).map((colour, i) => ({
    out: `barrel${i + 1}.png`,
    src: `Factions/Goblins/Troops/Barrel/${colour}/Barrel_${colour}.png`,
    crop: [0, 0, 128, 128] as [number, number, number, number],
    note: `Goblin Barrel (${colour.toLowerCase()}), idle cell (0,0) of the 6x6 128px sheet${i === 4 ? ' — same art as barrel3, see CREDITS.md' : ''}`,
  })),
]

/** border-image chrome. Sources chosen for closest tone to what they replace. */
const CHROME: Array<{ out: string; src: string; note: string }> = [
  { out: 'btn_big_blue_9.png', src: 'UI/Buttons/Button_Blue_9Slides.png',
    note: 'teal button with light frame — near-exact tonal match to the file it replaces' },
  { out: 'paper_special_9.png', src: 'UI/Buttons/Button_Blue_9Slides_Pressed.png',
    note: 'slate blue-grey panel — closest tone to the retired art; NOTE: the old file had gold corner filigree, which the CC0 build has no equivalent for' },
  { out: 'paper_regular_9.png', src: 'UI/Buttons/Button_Disable_9Slides.png',
    note: 'neutral tan panel standing in for cream parchment (legacy.css only)' },
  { out: 'woodtable_9.png', src: 'UI/Banners/Carved_9Slides.png',
    note: 'carved wood-grain panel (legacy.css only)' },
]

/** Post-CC0 files that are simply deleted: nothing references them. */
const DELETE = ['btn_big_blue.png', 'paper_regular.png', 'paper_special.png', 'woodtable.png']

/** Verbatim copies of old-CC0 art. [upstream path, destination, purpose] */
const HARVEST: Array<[string, string, string]> = []
const push = (src: string, dst: string, use: string): number => HARVEST.push([src, dst, use])

// UI — panels and banners
for (const [s, d] of [
  ['UI/Banners/Carved_9Slides.png', 'carved_9slides.png'],
  ['UI/Banners/Carved_3Slides.png', 'carved_3slides.png'],
  ['UI/Banners/Carved_Regular.png', 'carved_regular.png'],
  ['UI/Banners/Banner_Vertical.png', 'banner_vertical.png'],
  ['UI/Banners/Banner_Horizontal.png', 'banner_horizontal.png'],
  ['UI/Banners/Banner_Connection_Up.png', 'banner_connection_up.png'],
  ['UI/Banners/Banner_Connection_Down.png', 'banner_connection_down.png'],
  ['UI/Banners/Banner_Connection_Left.png', 'banner_connection_left.png'],
  ['UI/Banners/Banner_Connection_Right.png', 'banner_connection_right.png'],
]) push(s, `ui/tinyswords/${d}`, 'panel / banner chrome (9-slice or fixed)')

// UI — 4-state buttons. Hover and Disable are shared across colours upstream.
for (const [s, d] of [
  ['UI/Buttons/Button_Blue.png', 'button_blue.png'],
  ['UI/Buttons/Button_Blue_Pressed.png', 'button_blue_pressed.png'],
  ['UI/Buttons/Button_Red.png', 'button_red.png'],
  ['UI/Buttons/Button_Red_Pressed.png', 'button_red_pressed.png'],
  ['UI/Buttons/Button_Hover.png', 'button_hover.png'],
  ['UI/Buttons/Button_Disable.png', 'button_disable.png'],
  ['UI/Buttons/Button_Blue_9Slides.png', 'button_blue_9slides.png'],
  ['UI/Buttons/Button_Blue_9Slides_Pressed.png', 'button_blue_9slides_pressed.png'],
  ['UI/Buttons/Button_Red_9Slides.png', 'button_red_9slides.png'],
  ['UI/Buttons/Button_Red_9Slides_Pressed.png', 'button_red_9slides_pressed.png'],
  ['UI/Buttons/Button_Hover_9Slides.png', 'button_hover_9slides.png'],
  ['UI/Buttons/Button_Disable_9Slides.png', 'button_disable_9slides.png'],
]) push(s, `ui/tinyswords/${d}`, 'button, 4-state (regular / hover / pressed / disable)')

// UI — the ten system icons in three states.
const ICON_NAMES = ['close', 'gear', 'sound', 'speed1', 'speed2', 'speed3', 'cart', 'plus', 'minus', 'lock']
for (const state of ['Regular', 'Pressed', 'Disable'])
  ICON_NAMES.forEach((name, i) => {
    const n = String(i + 1).padStart(2, '0')
    push(`UI/Icons/${state}_${n}.png`, `ui/tinyswords/icon_${name}_${state.toLowerCase()}.png`,
      `system icon "${name}" (${state.toLowerCase()})`)
  })

for (let i = 1; i <= 6; i++)
  push(`UI/Pointers/0${i}.png`, `ui/tinyswords/pointer_0${i}.png`, 'cursor / pointer')

for (const c of ['Blue', 'Red', 'Yellow'])
  push(`UI/Ribbons/Ribbon_${c}_3Slides.png`, `ui/tinyswords/ribbon_${c.toLowerCase()}_3slides.png`, 'label ribbon (3-slice)')

// Pickups — the currency icons the HUD currently draws as the glyphs ⟡ ◈ ✦.
push('Resources/Resources/G_Idle.png', 'ui/tinyswords/pickup_gold.png', 'gold pouch — currency icon')
push('Resources/Resources/M_Idle.png', 'ui/tinyswords/pickup_meat.png', 'meat — currency icon')
push('Resources/Resources/W_Idle.png', 'ui/tinyswords/pickup_wood.png', 'wood log — currency icon')

// Effects — feed the particle work.
push('Effects/Explosion/Explosions.png', 'fx/tinyswords/explosions.png', 'explosion sheet (feeds particle FX)')
push('Effects/Fire/Fire.png', 'fx/tinyswords/fire.png', 'fire loop (feeds particle FX)')
push('Factions/Knights/Troops/Dead/Dead.png', 'fx/tinyswords/dead.png', 'death animation strip')
push('Factions/Knights/Troops/Archer/Arrow/Arrow.png', 'fx/tinyswords/arrow.png', 'arrow projectile')
push('Factions/Goblins/Troops/TNT/Dynamite/Dynamite.png', 'fx/tinyswords/dynamite.png', 'dynamite projectile')
push('Terrain/Water/Foam/Foam.png', 'fx/tinyswords/foam.png', 'shoreline foam loop')
push('Terrain/Water/Water.png', 'fx/tinyswords/water.png', 'water base tile')
push('Terrain/Bridge/Bridge_All.png', 'fx/tinyswords/bridge.png', 'bridge pieces')

// Deco 01-18, harvested whole so future scatter has the full set.
for (let i = 1; i <= 18; i++) {
  const n = String(i).padStart(2, '0')
  push(`Deco/${n}.png`, `deco/tinyswords/deco_${n}.png`, 'scatter decoration (mushroom / rock / bush / grass / bone / sign)')
}

// ------------------------------------------------------------------ palettes

/**
 * Every PNG in the CC0 pack except `BuildingsCustom/`. The palette check has to
 * see the WHOLE pack, not just the files this script happens to copy: the units
 * and goblins already on disk came from Warrior/Archer/Pawn/Torch/TNT/Barrel
 * sheets that are legitimately CC0 but are sliced elsewhere, and checking them
 * against a partial palette reports every one of them as suspect.
 */
async function packFiles(): Promise<string[]> {
  const cached = join(CACHE, '_tree.json')
  let body: string
  if (existsSync(cached)) body = readFileSync(cached, 'utf8')
  else {
    const res = await fetch(UPSTREAM_TREE)
    if (!res.ok) throw new Error(`tree api -> ${res.status}`)
    body = await res.text()
    mkdirSync(CACHE, { recursive: true })
    writeFileSync(cached, body)
  }
  const tree = JSON.parse(body) as { tree: Array<{ path: string; type: string }> }
  return tree.tree
    .filter((e) => e.type === 'blob' && e.path.startsWith(UPSTREAM_PREFIX) && e.path.endsWith('.png'))
    .map((e) => e.path.slice(UPSTREAM_PREFIX.length))
    .filter((p) => !p.startsWith('BuildingsCustom/'))
}

const opaqueColours = (img: Img): Set<number> => {
  const s = new Set<number>()
  for (let i = 0; i < img.d.length; i += 4)
    if (img.d[i + 3] === 255) s.add((img.d[i] << 16) | (img.d[i + 1] << 8) | img.d[i + 2])
  return s
}

// ---------------------------------------------------------------------- main

type Row = { file: string; src: string; size: string; bytes: number; use: string }

async function main(): Promise<void> {
  const rows: Row[] = []
  let wrote = 0

  console.log(CHECK_ONLY ? '-- check only, nothing will be written --' : `upstream: ${UPSTREAM_HOME}`)

  // 1. sprite replacements
  for (const job of SPRITES) {
    const sp = await source(job.src)
    let img = await load(sp)
    if (job.crop) img = crop(img, ...job.crop)
    if (job.flip) img = flipX(img)
    if (!job.raw) img = addHalo(trim(img))
    const out = join(ASSETS, 'sprites', 'tinyswords', job.out)
    const before = existsSync(out) ? await sharp(out).metadata() : null
    if (!CHECK_ONLY) { await save(img, out); wrote++ }
    console.log(
      `  sprite ${job.out.padEnd(11)} ${before ? `${before.width}x${before.height}` : '-'} -> ${img.w}x${img.h}   <- ${job.src}`,
    )
    rows.push({ file: `sprites/tinyswords/${job.out}`, src: job.src, size: `${img.w}x${img.h}`,
      bytes: existsSync(out) ? readFileSync(out).length : 0, use: job.note })
  }

  // 2. border-image chrome
  for (const c of CHROME) {
    const sp = await source(c.src)
    const out = join(ASSETS, 'ui', 'tinyswords', c.out)
    if (!CHECK_ONLY) { await nineSlice(sp, out, 110, 46); wrote++ }
    console.log(`  chrome ${c.out.padEnd(20)} 110x110 (slice 46)   <- ${c.src}`)
    rows.push({ file: `ui/tinyswords/${c.out}`, src: c.src, size: '110x110',
      bytes: existsSync(out) ? readFileSync(out).length : 0, use: c.note })
  }

  // 3. deletions
  for (const f of DELETE) {
    const p = join(ASSETS, 'ui', 'tinyswords', f)
    if (existsSync(p)) { if (!CHECK_ONLY) rmSync(p); console.log(`  delete ui/tinyswords/${f} (post-CC0, unreferenced)`) }
  }

  // 4. verbatim harvest
  for (const [src, dst, use] of HARVEST) {
    const sp = await source(src)
    const out = join(ASSETS, dst)
    const meta = await sharp(sp).metadata()
    if (!CHECK_ONLY) {
      mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, readFileSync(sp))
      wrote++
    }
    rows.push({ file: dst, src, size: `${meta.width}x${meta.height}`, bytes: readFileSync(sp).length, use })
  }
  console.log(`  harvest ${HARVEST.length} files copied verbatim`)

  /*
   * 5. Palette self-check — the test that catches a post-CC0 file.
   *
   * The post-CC0 build introduced palette entries the public-domain build never
   * had. So: build the union of every opaque colour in the whole CC0 pack, then
   * assert that no shipped sprite uses a colour outside it. A file that fails
   * this did not come from the public-domain build, whatever its mirror claimed.
   */
  const cc0 = new Set<number>()
  const all = await packFiles()
  for (const rel of all) opaqueColours(await load(await source(rel))).forEach((c) => cc0.add(c))
  console.log(`  reference palette: ${cc0.size} colours over ${all.length} CC0 pack files`)

  const haloRGB = (HALO.r << 16) | (HALO.g << 8) | HALO.b
  let suspect = 0
  for (const dir of ['sprites/tinyswords', 'ui/tinyswords', 'fx/tinyswords', 'deco/tinyswords']) {
    const abs = join(ASSETS, dir)
    if (!existsSync(abs)) continue
    for (const f of readdirSync(abs).filter((f) => f.endsWith('.png'))) {
      const alien = [...opaqueColours(await load(join(abs, f)))].filter((c) => !cc0.has(c) && c !== haloRGB)
      if (alien.length) {
        suspect++
        const hex = alien.slice(0, 4).map((c) => '#' + c.toString(16).padStart(6, '0')).join(' ')
        console.log(`  !! ${dir}/${f}: ${alien.length} colour(s) absent from the CC0 pack — ${hex}`)
      }
    }
  }
  console.log(suspect === 0
    ? '  palette check PASS: every shipped Tiny Swords colour exists in the CC0 pack'
    : `  palette check FAIL: ${suspect} file(s) carry colours the CC0 pack does not contain`)

  // 6. manifest
  const total = rows.reduce((n, r) => n + r.bytes, 0)
  const md = [
    '# CC0 asset manifest',
    '',
    'Every file below is derived from the **old, public-domain build** of Tiny Swords',
    '(`TS_old version_CC0 Licensed`), obtained from a mirror that ships a real',
    `CC0 1.0 \`LICENSE.txt\`: <${UPSTREAM_HOME}>.`,
    '',
    'Generated by `scripts/harvest-cc0.ts` — re-run it to rebuild, `--check` to verify.',
    '',
    '> **The current Tiny Swords download is NOT CC0** and must never be used here.',
    '> Its licence forbids redistribution "even if the files are modified", and a',
    "> public repo hosting loose PNGs is redistribution. See this repo's",
    '> `public/assets/sprites/CREDITS.md`.',
    '',
    `Licence for everything listed: **CC0 1.0 Universal** (public domain dedication).`,
    `Files: ${rows.length}. Total: ${(total / 1024).toFixed(1)} KB.`,
    '',
    '| File (under `public/assets/`) | Native size | Bytes | Upstream path | Use |',
    '|---|---|---|---|---|',
    ...rows.map((r) => `| \`${r.file}\` | ${r.size} | ${r.bytes} | \`${r.src}\` | ${r.use} |`),
    '',
    '## Deliberately NOT harvested',
    '',
    '- `BuildingsCustom/` (Alchemist, Arena, Chapel, Forge, Library, Tavern, Castle,',
    '  Tower) — the upstream theme README calls these "user-authored custom art".',
    '  They appear in no Pixel Frog description. Unverified provenance, so excluded.',
    '- The 24 ribbon connector pieces and the 8 `*_3Slides` button variants — real',
    '  CC0, simply not needed yet. Add them here if a screen calls for them.',
    '',
  ].join('\n')
  if (!CHECK_ONLY) writeFileSync(join(ASSETS, 'CC0-MANIFEST.md'), md)

  const sha = createHash('sha256').update(md).digest('hex').slice(0, 12)
  console.log(`\n${CHECK_ONLY ? 'checked' : `wrote ${wrote} files +`} manifest (${rows.length} entries, ${(total / 1024).toFixed(1)} KB, ${sha})`)
}

await main()
