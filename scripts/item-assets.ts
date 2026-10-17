/**
 * Item assets — the inventory and the renders behind the Figma page
 * "Item assets" (`docs/FIGMA.md` § Item assets).
 *
 *   npx tsx scripts/item-assets.ts            print the inventory and the shared
 *                                             assets; write docs/item-assets/inventory.json
 *   npx tsx scripts/item-assets.ts --render   also render every PNG under
 *                                             docs/item-assets/ through the real
 *                                             draw code (harness/items.html)
 *
 * `--render` starts its own Vite dev server on port 5217 (or uses one already
 * there: `ITEM_ASSETS_BASE=http://localhost:5217`), drives the harness in
 * headless Chromium, and stops the server it started. Playwright is not a
 * dependency (see `scripts/ui-audit.mjs`): the module and the browser come from
 * `PW_MODULE` / `PW_CHROMIUM`, defaulting to this machine's global install.
 *
 * What gets rendered, per item kind and per rarity it can roll:
 *  - `icon-<rarity>.png`   the pack tile the UI draws (`.sh-tile`, real CSS);
 *  - `figure-<rarity>.png` the battlefield figure (`drawSentinel` + `gearMarks`)
 *                          on ONE neutral hero for every item;
 *  - `doll-<rarity>.png`   the paper doll (`loadout.heroStrip`) on the doll
 *                          pack's one figure.
 * plus `loadouts/` (complete kits) and `cells/` (each of the twelve kinds that
 * borrowed a cell: the one it borrowed, beside its own).
 *
 * The docs folder is not served and nothing in it is a game asset.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { itemAssetRows, LEGACY_BASES, LOADOUTS, sharedAssets, SHIPPED_CELLS, slug } from './item-assets-lib'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs', 'item-assets')
const PORT = 5217
const PW_MODULE = process.env.PW_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs'
const CHROME = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

const rows = itemAssetRows()
const shared = sharedAssets(rows)
const iconShared = shared.filter((s) => s.channel === 'icon')
const sharing = new Set(iconShared.flatMap((s) => s.kinds))

/** Each kind that borrowed a cell must now be drawn on its own (`iconAtlas.NOUN_ICON`). */
for (const s of SHIPPED_CELLS) {
  const row = rows.find((r) => r.kind === s.kind)
  if (!row) throw new Error(`[item-assets] '${s.kind}' is not an item kind the game deals`)
  if (row.icon !== s.cell) throw new Error(`[item-assets] '${s.kind}' draws the '${row.icon}' cell, not its own '${s.cell}'`)
}

function printInventory(): void {
  const pad = (s: string, n: number) => s.padEnd(n)
  console.log(`${rows.length} item kinds the game deals (each rolls Common → Mythic)\n`)
  console.log(`${pad('kind', 17)}${pad('slot', 9)}${pad('hands', 18)}${pad('tier', 10)}${pad('icon', 11)}${pad('figure', 12)}doll`)
  for (const r of rows)
    console.log(
      `${pad(r.kind, 17)}${pad(r.slot, 9)}${pad(r.handRule, 18)}${pad(r.tier, 10)}${pad(r.icon, 11)}${pad(r.figureMark ?? '— (body)', 12)}${r.dollArt ? r.dollRole : `— (${r.dollRole} not shipped)`}`,
    )
  console.log(`\nLegacy bases (not dealt): ${LEGACY_BASES.map((b) => `${b.kind} (${b.why})`).join('; ')}`)
  console.log('\nShared assets — two or more different items, one picture:')
  for (const s of shared) console.log(`  ${pad(s.channel, 7)}${pad(s.asset, 30)}${s.kinds.join(', ')}`)
  console.log(`\nIcon: ${rows.length - sharing.size} unique, ${sharing.size} sharing one${sharing.size ? ` (${[...sharing].join(', ')})` : ''}`)
  console.log(`Own cells shipped for the old borrowers: ${SHIPPED_CELLS.map((s) => `${s.kind} (${s.cell}, was ${s.borrowed})`).join(', ')}`)
}

async function writeInventory(): Promise<void> {
  await mkdir(OUT, { recursive: true })
  const json = {
    generatedBy: 'npx tsx scripts/item-assets.ts',
    items: rows.map((r) => ({ ...r, slug: slug(r.kind), sharesIcon: sharing.has(r.kind) })),
    legacy: LEGACY_BASES,
    shared,
    shippedCells: SHIPPED_CELLS.map((s) => ({ ...s, slug: slug(s.kind) })),
    loadouts: LOADOUTS,
  }
  await writeFile(join(OUT, 'inventory.json'), JSON.stringify(json, null, 1) + '\n')
  console.log(`\nwrote ${join('docs', 'item-assets', 'inventory.json')}`)
}

async function up(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok
  } catch {
    return false
  }
}

async function render(): Promise<void> {
  const base = process.env.ITEM_ASSETS_BASE ?? `http://localhost:${PORT}`
  let server: ChildProcess | null = null
  if (!(await up(base))) {
    server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true })
    for (let i = 0; i < 120 && !(await up(base)); i++) await new Promise((r) => setTimeout(r, 500))
  }
  // Untyped on purpose: Playwright is not a dependency of this repo.
  const { chromium } = (await import(PW_MODULE)) as { chromium: any } // eslint-disable-line @typescript-eslint/no-explicit-any
  const browser = await chromium.launch({ executablePath: CHROME })
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 4 })
    const errors: string[] = []
    page.on('pageerror', (e: Error) => errors.push(e.message))
    page.on('console', (m: { type(): string; text(): string }) => {
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text())
    })
    await page.goto(`${base}/harness/items.html`, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => (window as unknown as { __itemAssetsReady?: boolean }).__itemAssetsReady === true, null, { timeout: 60000 })
    if (errors.length) throw new Error(`harness errors:\n${errors.join('\n')}`)

    // Canvases come out as their exact pixels; the DOM tiles as element shots.
    const canvases: { path: string; data: string }[] = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLCanvasElement>('canvas[data-out]')).map((c) => ({ path: c.dataset.out!, data: c.toDataURL('image/png') })),
    )
    for (const c of canvases) {
      const file = join(OUT, c.path)
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, Buffer.from(c.data.split(',')[1], 'base64'))
    }
    const tiles = await page.locator('[data-shot]').all()
    for (const t of tiles) {
      const file = join(OUT, (await t.getAttribute('data-shot'))!)
      await mkdir(dirname(file), { recursive: true })
      await t.screenshot({ path: file, omitBackground: false })
    }
    console.log(`rendered ${canvases.length} canvases and ${tiles.length} tiles into docs/item-assets/`)
  } finally {
    await browser.close()
    if (server?.pid) {
      try {
        process.kill(-server.pid)
      } catch {
        server.kill()
      }
    }
  }
}

/**
 * Re-encode every render as a palette PNG. Pixel art and the flat UI tiles sit
 * well under 256 colours, so this is lossless in practice and keeps the
 * committed folder small (the full-resolution set lives in Figma).
 */
async function compress(): Promise<void> {
  const walk = async (dir: string): Promise<string[]> =>
    (await Promise.all((await readdir(dir)).map(async (n) => ((await stat(join(dir, n))).isDirectory() ? walk(join(dir, n)) : [join(dir, n)])))).flat()
  let before = 0
  let after = 0
  for (const f of (await walk(OUT)).filter((f) => f.endsWith('.png'))) {
    const src = await readFile(f)
    const out = await sharp(src).png({ palette: true, colours: 256, dither: 0, compressionLevel: 9, effort: 10 }).toBuffer()
    before += src.length
    after += Math.min(out.length, src.length)
    if (out.length < src.length) await writeFile(f, out)
  }
  console.log(`palette PNGs: ${(before / 1e6).toFixed(2)} MB -> ${(after / 1e6).toFixed(2)} MB`)
}

printInventory()
await writeInventory()
if (process.argv.includes('--render')) {
  await render()
  await compress()
}
