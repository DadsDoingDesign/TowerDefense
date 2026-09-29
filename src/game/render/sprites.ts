/**
 * Sprite loader for the real-art themes. Each theme has its own pack folder under
 * public/assets/sprites/<pack>/ containing role-named PNGs (fighter/rogue/mystic,
 * the enemy roster, plus grass/road terrain). Assets are CC0 pixel art — see
 * public/assets/sprites/CREDITS.md.
 *
 * **Load the active pack, not all of them (M37).**
 *
 * This used to fetch `SPRITE_PACKS.length × ROLE_NAMES.length` images at boot —
 * 196 requests for a game whose theme is hardcoded to `tinyswords` and which has
 * no picker. 150 of those requests were for the five inactive packs, and only 25
 * of the 150 were even real files: the other 125 asked for roles those packs
 * have never contained (see PACK_ROLES), so on a static host they 404 and behind
 * an SPA fallback they hand back index.html to be decoded as an image. All of it
 * on a phone, before the first wave, for art nothing can select.
 *
 * Now `preloadSprites()` loads exactly the pack the active theme names, and
 * {@link preloadPack} is the hook a theme picker would call when the player
 * switches — the other packs stay reachable, they just are not paid for up front.
 */
import { ANIM_ROLES } from './anim'
import { getActiveStyle, onThemeChange } from './themes'

export const SPRITE_PACKS = ['tinyswords', 'fieldwatch', 'fantasy', 'undead', 'infernal', 'frost', 'sylvan']

/**
 * Every role the renderer may ask for. Add new roles here or they won't preload
 * — and add them to the owning pack's entry in PACK_ROLES below if that pack is
 * not the default.
 */
const ROLE_NAMES = [
  // towers
  'fighter', 'rogue', 'mystic',
  // enemies — 3 goblin factions × 5 tiers (Tiny Swords)
  'torch1', 'torch2', 'torch3', 'torch4', 'torch5',
  'tnt1', 'tnt2', 'tnt3', 'tnt4', 'tnt5',
  'barrel1', 'barrel2', 'barrel3', 'barrel4', 'barrel5',
  // terrain
  'grass', 'road',
  // decorations (Tiny Swords)
  'tree1', 'tree2', 'tree3', 'tree4',
  'rock1', 'rock2', 'rock3', 'rock4',
  'bush1', 'bush2',
]

/**
 * Packs that ship animation strips (idle/attack/walk). The five retired 32px
 * packs are statics only, so asking them for a `_walk` is 10 guaranteed 404s.
 */
const ANIM_PACKS = new Set(['tinyswords', 'fieldwatch'])

/**
 * Gear art for the paper-doll compositor (`loadout.ts`), which only the
 * from-scratch pack ships.
 *
 * Each `gear_*` file is a `GEAR_POSE_CELLS`-wide strip of the shared angle
 * vocabulary; each `body_*` is the same strip of pauldron-and-hem overlays.
 * The nouns mirror `data/items.ts` exactly — WEAPONS, OFFHANDS and BODIES —
 * because the compositor looks gear up by the item's own lowercased name.
 */
const WEAPON_ART = [
  'sword', 'axe', 'dagger', 'wand', 'rod', 'scepter',
  'greatsword', 'warhammer', 'bow', 'staff', 'grimoire',
]
const OFFHAND_ART = ['shield', 'buckler', 'tome', 'quiver', 'focus']
const BODY_ART = ['plate', 'mail', 'robe', 'cloak', 'aegis']
export const GEAR_ROLES = [
  ...WEAPON_ART.map((n) => `gear_${n}`),
  ...OFFHAND_ART.map((n) => `gear_${n}`),
  ...BODY_ART.map((n) => `body_${n}`),
]

/**
 * What each pack ACTUALLY ships, which is not the same as what the renderer may
 * ask for.
 *
 * The five non-default packs predate the Tiny Swords enemy roster: on disk each
 * holds `fighter/rogue/mystic/grass/road` plus seven enemy PNGs under retired
 * names (brute/colossus/grunt/ogre/runner/shade/warden) that no current enemy id
 * maps to. Preloading `ROLE_NAMES` against them therefore requested 25 files per
 * pack that cannot exist. Listing the truth per pack costs one line each and
 * makes a request that misses a bug rather than the norm.
 *
 * Keep these in sync with `public/assets/sprites/<pack>/`.
 */
const LEGACY_PACK_ROLES = ['fighter', 'rogue', 'mystic', 'grass', 'road']
const PACK_ROLES: Record<string, readonly string[]> = {
  // Tiny Swords draws its road procedurally — there is no road.png in the pack.
  tinyswords: ROLE_NAMES.filter((n) => n !== 'road'),
  // The from-scratch pack: every role Tiny Swords has, plus the gear layers.
  fieldwatch: [...ROLE_NAMES.filter((n) => n !== 'road'), ...GEAR_ROLES],
  fantasy: LEGACY_PACK_ROLES,
  undead: LEGACY_PACK_ROLES,
  infernal: LEGACY_PACK_ROLES,
  frost: LEGACY_PACK_ROLES,
  sylvan: LEGACY_PACK_ROLES,
}

const images = new Map<string, HTMLImageElement>()
const packsLoaded = new Set<string>()
/** Images requested but not yet settled. Ready means started and nothing pending. */
let pending = 0
let started = false
const readyCbs: (() => void)[] = []

function settle(): void {
  if (pending > 0) return
  const cbs = readyCbs.splice(0)
  for (const cb of cbs) cb()
}

function load(key: string, src: string): void {
  if (images.has(key)) return
  pending++
  const img = new Image()
  img.onload = img.onerror = () => {
    pending--
    settle()
  }
  img.src = src
  images.set(key, img)
}

/**
 * Fetch one pack's sprites. Idempotent per pack, so a picker can call it on
 * every switch. No-op outside a document (SSR, the balance harness).
 */
export function preloadPack(pack: string): void {
  if (typeof document === 'undefined' || packsLoaded.has(pack)) return
  packsLoaded.add(pack)
  started = true
  for (const name of PACK_ROLES[pack] ?? ROLE_NAMES) {
    load(`${pack}/${name}`, `assets/sprites/${pack}/${name}.png`)
  }
  if (ANIM_PACKS.has(pack)) {
    for (const name of ANIM_ROLES) load(`${pack}/${name}`, `assets/sprites/${pack}/${name}.png`)
  }
  // Everything may already have been cached synchronously by the browser; a
  // no-pending state still has to reach the callbacks.
  settle()
}

/** Preload the pack the active theme renders with (see themes.ts). */
export function preloadSprites(): void {
  const pack = getActiveStyle().sprites?.pack
  if (pack) preloadPack(pack)
}

// Switching theme fetches the new pack automatically, so a future picker cannot
// select art that was never requested. Idempotent per pack.
onThemeChange((style) => {
  if (style.sprites) preloadPack(style.sprites.pack)
})

/** A decoded image for pack+role, or undefined (caller falls back procedurally). */
export function getSprite(pack: string, name: string): HTMLImageElement | undefined {
  const img = images.get(`${pack}/${name}`)
  return img && img.complete && img.naturalWidth > 0 ? img : undefined
}

export const spritesReady = (): boolean => started && pending === 0

/** Fire cb once the requested sprites have loaded (or immediately if already so). */
export function onSpritesReady(cb: () => void): void {
  if (spritesReady()) cb()
  else readyCbs.push(cb)
}
