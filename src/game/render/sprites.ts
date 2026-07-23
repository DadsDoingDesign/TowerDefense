/**
 * Sprite loader for the real-art themes. Each theme has its own pack folder under
 * public/assets/sprites/<pack>/ containing role-named PNGs (fighter/rogue/mystic,
 * the enemy roster, plus grass/road terrain). Assets are CC0 pixel art from the
 * Dungeon Crawl Stone Soup tileset — see public/assets/sprites/CREDITS.md.
 */
export const SPRITE_PACKS = ['tinyswords', 'fantasy', 'undead', 'infernal', 'frost', 'sylvan']
const ROLE_NAMES = [
  // towers
  'fighter', 'rogue', 'mystic',
  // enemies — 3 goblin factions × 5 tiers (Tiny Swords)
  'torch1', 'torch2', 'torch3', 'torch4', 'torch5',
  'tnt1', 'tnt2', 'tnt3', 'tnt4', 'tnt5',
  'barrel1', 'barrel2', 'barrel3', 'barrel4', 'barrel5',
  // terrain
  'grass', 'road',
]

const images = new Map<string, HTMLImageElement>()
const total = SPRITE_PACKS.length * ROLE_NAMES.length
let loadedCount = 0
let started = false
const readyCbs: (() => void)[] = []

export function preloadSprites(): void {
  if (started || typeof document === 'undefined') return
  started = true
  for (const pack of SPRITE_PACKS) {
    for (const name of ROLE_NAMES) {
      const img = new Image()
      img.onload = img.onerror = () => {
        loadedCount++
        if (loadedCount === total) readyCbs.forEach((cb) => cb())
      }
      img.src = `assets/sprites/${pack}/${name}.png`
      images.set(`${pack}/${name}`, img)
    }
  }
}

/** A decoded image for pack+role, or undefined (caller falls back procedurally). */
export function getSprite(pack: string, name: string): HTMLImageElement | undefined {
  const img = images.get(`${pack}/${name}`)
  return img && img.complete && img.naturalWidth > 0 ? img : undefined
}

export const spritesReady = (): boolean => loadedCount >= total

/** Fire cb once all sprites have loaded (or immediately if already ready). */
export function onSpritesReady(cb: () => void): void {
  if (spritesReady()) cb()
  else readyCbs.push(cb)
}
