/**
 * Enemy assets — the inventory and the renders behind the Figma page
 * "Enemy assets" (`docs/FIGMA.md` § Enemy assets).
 *
 *   npx tsx scripts/enemy-assets.ts            print the inventory; write
 *                                              docs/enemy-assets/inventory.json
 *   npx tsx scripts/enemy-assets.ts --render   also render every PNG under
 *                                              docs/enemy-assets/ through the
 *                                              real draw code (harness/enemies.html)
 *
 * `--render` starts its own Vite dev server on port 5225 (or uses one already
 * there: `ENEMY_ASSETS_BASE=http://localhost:5225`), drives the harness in
 * headless Chromium, and stops the server it started. Playwright is not a
 * dependency (see `scripts/ui-audit.mjs`): the module and the browser come from
 * `PW_MODULE` / `PW_CHROMIUM`, defaulting to this machine's global install.
 * The renders are re-encoded as palette PNGs; the folder stays under 5 MB.
 *
 * It also checks the inventory's promises: every (road, faction, tier) has its
 * own look id and its own name, and no two clans share a part name for the
 * same slot of the ladder (each clan's kit is its own art).
 *
 * The docs folder is not served and nothing in it is a game asset.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { CLANS } from '../src/game/data/clans'
import { enemyAssetRows, FORM_TITLE, FORMS, renderPath, roadSlug, sheetPath, walkPath } from './enemy-assets-lib'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs', 'enemy-assets')
const PORT = 5225
const PW_MODULE = process.env.PW_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs'
const CHROME = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

const rows = enemyAssetRows()

function check(): void {
  const looks = new Set(rows.map((r) => r.lookId))
  if (looks.size !== rows.length) throw new Error('[enemy-assets] two rows share a look id')
  const names = new Set(rows.map((r) => `${r.clan}:${r.name}`))
  if (names.size !== rows.length) throw new Error('[enemy-assets] two units of one road share a name')
  const clanNames = new Set(rows.filter((r) => r.clan).map((r) => r.name))
  if (clanNames.size !== rows.filter((r) => r.clan).length) throw new Error('[enemy-assets] two clans share a unit name')
}

function printInventory(): void {
  const pad = (s: string, n: number) => s.padEnd(n)
  console.log(`${rows.length} looks: ${CLANS.length} clans + the plain bench goblins × 3 factions × 5 tiers, each in ${FORMS.length} forms (${FORMS.map((f) => FORM_TITLE[f]).join(', ')})\n`)
  console.log(`${pad('look', 16)}${pad('name', 20)}${pad('engine name', 18)}look`)
  for (const r of rows) console.log(`${pad(r.lookId, 16)}${pad(r.name, 20)}${pad(r.engineName, 18)}${r.look}${r.boss ? '  [boss]' : ''}`)
  for (const c of CLANS) console.log(`\n${c.name} (${c.company}): ${c.tell}`)
}

async function writeInventory(): Promise<void> {
  await mkdir(OUT, { recursive: true })
  const json = {
    generatedBy: 'npx tsx scripts/enemy-assets.ts',
    clans: CLANS.map((c) => ({ id: c.id, company: c.company, name: c.name, tell: c.tell, specialists: c.specialists })),
    forms: FORMS.map((f) => ({ form: f, title: FORM_TITLE[f] })),
    looks: rows.map((r) => ({
      ...r,
      renders: Object.fromEntries(FORMS.map((f) => [f, renderPath(r.clan, r.key, f)])),
      ...(r.tier === 1 || r.key === 'torch5' ? { walk: walkPath(r.clan, r.key) } : {}),
      sheet: sheetPath(r.clan),
      road: roadSlug(r.clan),
    })),
  }
  await writeFile(join(OUT, 'inventory.json'), JSON.stringify(json, null, 1) + '\n')
  console.log(`\nwrote ${join('docs', 'enemy-assets', 'inventory.json')}`)
}

async function up(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok
  } catch {
    return false
  }
}

async function render(): Promise<void> {
  const base = process.env.ENEMY_ASSETS_BASE ?? `http://localhost:${PORT}`
  let server: ChildProcess | null = null
  if (!(await up(base))) {
    server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true })
    for (let i = 0; i < 120 && !(await up(base)); i++) await new Promise((r) => setTimeout(r, 500))
  }
  // Untyped on purpose: Playwright is not a dependency of this repo.
  const { chromium } = (await import(PW_MODULE)) as { chromium: any } // eslint-disable-line @typescript-eslint/no-explicit-any
  const browser = await chromium.launch({ executablePath: CHROME })
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
    const errors: string[] = []
    page.on('pageerror', (e: Error) => errors.push(e.message))
    page.on('console', (m: { type(): string; text(): string }) => {
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text())
    })
    await page.goto(`${base}/harness/enemies.html`, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => (window as unknown as { __enemyAssetsReady?: boolean }).__enemyAssetsReady === true, null, { timeout: 90000 })
    if (errors.length) throw new Error(`harness errors:\n${errors.join('\n')}`)
    const canvases: { path: string; data: string }[] = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLCanvasElement>('canvas[data-out]')).map((c) => ({ path: c.dataset.out!, data: c.toDataURL('image/png') })),
    )
    for (const c of canvases) {
      const file = join(OUT, c.path)
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, Buffer.from(c.data.split(',')[1], 'base64'))
    }
    console.log(`rendered ${canvases.length} canvases into docs/enemy-assets/`)
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

/** Re-encode every render as a palette PNG (pixel art on grass sits well under 256 colours). */
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

check()
printInventory()
await writeInventory()
if (process.argv.includes('--render')) {
  await render()
  await compress()
}
