/**
 * Sprite loader for the Fantasy theme. Assets are CC0 pixel art from the Dungeon
 * Crawl Stone Soup tileset (public domain); see public/assets/sprites/CREDITS.md.
 * Images are keyed by tower archetype ('fighter'|'rogue'|'mystic'), enemy type id
 * ('grunt'|'runner'|...), and terrain ('grass'|'road').
 */
const SPRITE_NAMES = [
  'fighter', 'rogue', 'mystic',
  'grunt', 'runner', 'shade', 'brute', 'ogre', 'warden', 'colossus',
  'grass', 'road',
]

const images = new Map<string, HTMLImageElement>()
let loadedCount = 0
let started = false
const readyCbs: (() => void)[] = []

export function preloadSprites(): void {
  if (started || typeof document === 'undefined') return
  started = true
  for (const name of SPRITE_NAMES) {
    const img = new Image()
    img.onload = () => {
      loadedCount++
      if (loadedCount === SPRITE_NAMES.length) readyCbs.forEach((cb) => cb())
    }
    img.src = `assets/sprites/${name}.png`
    images.set(name, img)
  }
}

/** An image only if it has finished decoding (else undefined → caller falls back). */
export function getSprite(name: string): HTMLImageElement | undefined {
  const img = images.get(name)
  return img && img.complete && img.naturalWidth > 0 ? img : undefined
}

export const spritesReady = (): boolean => loadedCount === SPRITE_NAMES.length

/** Register a callback fired once all sprites have loaded (or immediately if ready). */
export function onSpritesReady(cb: () => void): void {
  if (spritesReady()) cb()
  else readyCbs.push(cb)
}
