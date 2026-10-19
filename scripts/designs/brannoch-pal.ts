/**
 * Brannoch designs — the palette audit: every ink a design uses must be a
 * colour that appears in the old-CC0 Tiny Swords stills already shipped in
 * public/assets/sprites/tinyswords/ (the plain pack files; the clan bakes are
 * ours and are skipped) or in a file `public/assets/CC0-MANIFEST.md` lists.
 *
 *   npx tsx scripts/designs/brannoch-pal.ts          # list the pack's colours (by use)
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

const ROOT = resolve(import.meta.dirname, '..', '..')
export const PACK_DIR = join(ROOT, 'public', 'assets', 'sprites', 'tinyswords')

/** The pack's colours with their pixel counts, most used first. */
export async function packColours(min = 8): Promise<Map<string, number>> {
  const manifest = readFileSync(join(ROOT, 'public', 'assets', 'CC0-MANIFEST.md'), 'utf8')
  const listed = [...manifest.matchAll(/^\| `([^`]+\.png)`/gm)].map((m) => join(ROOT, 'public', 'assets', m[1]))
  const sprites = readdirSync(PACK_DIR).filter((f) => f.endsWith('.png') && !/^(cinder|delve|hexmoon|silkcut|smudge)_/.test(f)).map((f) => join(PACK_DIR, f))
  const files = [...new Set([...sprites, ...listed])]
  const count = new Map<string, number>()
  for (const f of files) {
    const { data } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 250) continue
      const k = '#' + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')
      count.set(k, (count.get(k) ?? 0) + 1)
    }
  }
  return new Map([...count].filter((c) => c[1] >= min).sort((a, b) => b[1] - a[1]))
}

async function main() {
  const c = await packColours()
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  for (const [k, n] of c) console.log(`${k} ${rgb(k).join(',').padEnd(12)} ${n}`)
}

if (process.argv[1]?.endsWith('brannoch-pal.ts')) main()
