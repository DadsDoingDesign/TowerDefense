/**
 * Generate the PWA icon set from one inline SVG (M24).
 *
 * Run with `npm run icons`. Committed output lives in `public/icons/`, so the
 * build has no image-generation step and `sharp` stays a dev-only dependency.
 * The mark is the same shield/eye used by the favicon in index.html.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

/** `pad` insets the mark so a maskable icon survives a circular crop. */
const mark = (size: number, pad: number, bg: string): string => {
  const s = 32
  const scale = (size * (1 - pad * 2)) / s
  const off = size * pad
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${bg}"/>
  <g transform="translate(${off} ${off}) scale(${scale})">
    <path d="M16 4l10 4v7c0 6-4 10-10 13C10 25 6 21 6 15V8z" fill="none" stroke="#f0a868" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="16" cy="14" r="3" fill="#f0a868"/>
  </g>
</svg>`
}

const TARGETS = [
  { file: 'icon-192.png', size: 192, pad: 0.12 },
  { file: 'icon-512.png', size: 512, pad: 0.12 },
  // Maskable icons get cropped to whatever shape the launcher wants, so the
  // mark sits inside the 80% safe zone.
  { file: 'icon-192-maskable.png', size: 192, pad: 0.22 },
  { file: 'icon-512-maskable.png', size: 512, pad: 0.22 },
  // iOS does not honour `purpose`, and composites onto white if the PNG has
  // alpha — this one is opaque by construction.
  { file: 'apple-touch-icon.png', size: 180, pad: 0.16 },
]

await mkdir(OUT, { recursive: true })
for (const t of TARGETS) {
  const svg = Buffer.from(mark(t.size, t.pad, '#201711'))
  await sharp(svg).png().toFile(resolve(OUT, t.file))
  console.log(`icons: ${t.file} (${t.size}px)`)
}
