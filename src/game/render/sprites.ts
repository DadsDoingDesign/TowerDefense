/**
 * Sprite loader for the real-art themes. Each theme has its own pack folder under
 * public/assets/sprites/<pack>/ containing role-named PNGs (fighter/rogue/mystic,
 * the enemy roster, plus grass/road terrain). Assets are CC0 pixel art — see
 * public/assets/sprites/CREDITS.md.
 *
 * **Load what the active theme draws, not every pack (M37).**
 *
 * This used to fetch every pack × every role at boot — 196 requests for a game
 * whose theme is hardcoded to `tinyswords` and which has no picker. Now
 * `preloadSprites()` loads exactly the files the active theme draws — across
 * its per-role fallback chain (see {@link themeArtPlan}) — and
 * {@link preloadPack} is the whole-pack hook the harness and the tests use.
 *
 * The same declaration drives the service worker's precache: `build/pwa.ts`
 * precaches {@link themeAssetPaths} of the default theme and nothing else
 * under `assets/sprites/`, so a shadowed or inactive file costs no install
 * request.
 */
import { ANIM_ROLES } from './anim'
import { getActiveStyle, onThemeChange, packDensity, type ThemeStyle } from './themes'

/**
 * Every role the renderer may ask for. Add new roles here or they won't preload
 * — and add them to the owning pack's entry in PACK_ROLES below.
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
/** Every gear role the compositor may ask for. */
export const GEAR_ROLES: readonly string[] = [
  ...WEAPON_ART.map((n) => `gear_${n}`),
  ...OFFHAND_ART.map((n) => `gear_${n}`),
  ...BODY_ART.map((n) => `body_${n}`),
]

/** Every runtime role any pack may ship: the renderer's roles, their strips, the gear. */
export const ALL_ROLES: readonly string[] = [...new Set([...ROLE_NAMES, ...ANIM_ROLES, ...GEAR_ROLES])]

/**
 * What each pack ACTUALLY ships, file for file — not what the renderer may ask
 * for. The per-role fallback chain (below) resolves against this, so an entry
 * here is a promise: `tests/pwa.precache.test.ts` fails if a declared file is
 * missing from `public/assets/sprites/<pack>/`, and also if a runtime role sits
 * in the folder undeclared (authored art that would never be drawn).
 *
 * **Shipping a role is adding it here.** Author `fieldwatch/tree2.png`, list
 * `'tree2'` below, and from that build on every tree2 draws from the new pack
 * while everything it does not ship keeps drawing from the next pack in the
 * chain (HANDOFF §6.4). `*_anchors.png` marker layers are build inputs
 * (`npm run anchors`), never fetched, so they are not listed.
 */
const PACK_ROLES: Record<string, readonly string[]> = {
  // Tiny Swords draws its road procedurally — there is no road.png in the pack.
  tinyswords: [...ROLE_NAMES.filter((n) => n !== 'road'), ...ANIM_ROLES],
  // The from-scratch pack, as far as it has been authored (placeholder
  // blocking today — `npm run placeholder-pack`).
  fieldwatch: [
    'fighter', 'fighter_idle', 'fighter_atk',
    'torch1', 'torch1_walk',
    'grass',
    'tree1',
    'gear_sword', 'gear_dagger', 'gear_greatsword', 'gear_staff', 'gear_shield', 'gear_buckler',
    'body_plate', 'body_robe',
  ],
}

/** The roles a pack declares (empty for an unknown pack). */
export const packRoles = (pack: string): readonly string[] => PACK_ROLES[pack] ?? []

/**
 * Every file `preloadPack(pack)` requests, as `assets/`-relative URLs — the
 * WHOLE pack, whether or not a theme draws each file from it. The harness and
 * the tests load packs this way; the game loads {@link themeAssetPaths}.
 */
export function packAssetPaths(pack: string): string[] {
  return [...new Set(packRoles(pack))].map((name) => `assets/sprites/${pack}/${name}.png`)
}

// ── The per-role fallback chain ─────────────────────────────────────────────
/**
 * A theme names a primary pack and an ordered fallback list
 * (`SpriteConfig.fallback`, e.g. fieldwatch → tinyswords). Each role is drawn
 * from the FIRST pack in that chain that ships it, at THAT pack's own density
 * (`packDensity`), and a role no pack ships falls through to the procedural
 * token exactly as before. This is what lets the from-scratch art go live one
 * role at a time instead of in one all-or-nothing theme flip.
 *
 * Resolution is per FAMILY, not per file: `fighter`, `fighter_idle` and
 * `fighter_atk` are one figure and always come from the same pack — an idle
 * loop from one artist and an attack strip from another would pop between
 * silhouettes on every shot. A pack that ships ANY role of a family owns the
 * whole family; the draw code already copes with a gap inside a family (no
 * attack strip → the idle strip, no strips → the still).
 */
const ANIM_SUFFIX = /_(idle|atk|walk)$/
export const artFamily = (role: string): string => role.replace(ANIM_SUFFIX, '')

/** Where one role is drawn from: the pack, and that pack's own density. */
export interface ArtSource {
  pack: string
  spriteScale: 0.5 | 1
}

/** A theme's chain, primary first. Empty for a procedural theme. */
export function artChain(style: ThemeStyle = getActiveStyle()): string[] {
  if (!style.sprites) return []
  return [...new Set([style.sprites.pack, ...(style.sprites.fallback ?? [])])]
}

/** family → packs in the chain that own it, in chain order. */
function familyOwners(chain: readonly string[]): Map<string, string[]> {
  const owners = new Map<string, string[]>()
  for (const pack of chain) {
    for (const role of packRoles(pack)) {
      const fam = artFamily(role)
      const list = owners.get(fam) ?? []
      if (!list.includes(pack)) list.push(pack)
      owners.set(fam, list)
    }
  }
  return owners
}

/**
 * Role → the pack it is drawn from, for every role any pack in the chain ships.
 * Pure (no image state), so the precache (`build/pwa.ts`) and the loader agree
 * on exactly which file of which pack is drawn — and fetch nothing else.
 */
export function themeArtPlan(style: ThemeStyle = getActiveStyle()): Map<string, string> {
  const chain = artChain(style)
  const owners = familyOwners(chain)
  const plan = new Map<string, string>()
  for (const pack of chain) {
    for (const role of packRoles(pack)) {
      if (!plan.has(role) && owners.get(artFamily(role))?.[0] === pack) plan.set(role, pack)
    }
  }
  return plan
}

/**
 * Exactly the files a theme draws, across its whole chain, as
 * `assets/`-relative URLs. The boot preload and the service worker's precache
 * both use this, so neither fetches a file the renderer will not draw — the
 * tinyswords `fighter` shadowed by a shipped fieldwatch one is not requested.
 */
export function themeAssetPaths(style: ThemeStyle = getActiveStyle()): string[] {
  return [...themeArtPlan(style)].map(([role, pack]) => `assets/sprites/${pack}/${role}.png`)
}

/** The packs a theme actually draws at least one file from, in chain order. */
export function themeArtPacks(style: ThemeStyle = getActiveStyle()): string[] {
  const used = new Set(themeArtPlan(style).values())
  return artChain(style).filter((p) => used.has(p))
}

// ── Loading ─────────────────────────────────────────────────────────────────
const images = new Map<string, HTMLImageElement>()
/** `pack/role` keys whose request failed (404, bad decode). */
const failed = new Set<string>()
const packsLoaded = new Set<string>()
/** Images requested but not yet settled. Ready means started and nothing pending. */
let pending = 0
let started = false
/**
 * Bumped every time an image settles (loads OR fails). A cache of anything
 * built from sprites — the paper-doll composites in `loadout.ts`, the resolved
 * chain below — keys on it, so a result built while art was still missing is
 * rebuilt once more art has arrived, and not on every frame in between.
 */
let generation = 0
const readyCbs: (() => void)[] = []

function settle(): void {
  if (pending > 0) return
  const cbs = readyCbs.splice(0)
  for (const cb of cbs) cb()
}

function load(key: string, src: string): void {
  if (images.has(key) || typeof document === 'undefined') return
  started = true
  pending++
  const img = new Image()
  img.onload = () => {
    pending--
    generation++
    settle()
  }
  img.onerror = () => {
    failed.add(key)
    pending--
    generation++
    settle()
  }
  img.src = src
  images.set(key, img)
}

const loadRole = (pack: string, role: string): void => load(`${pack}/${role}`, `assets/sprites/${pack}/${role}.png`)

/**
 * Fetch one pack's sprites — all of them. Idempotent per pack. No-op outside a
 * document (SSR, the balance harness).
 */
export function preloadPack(pack: string): void {
  if (typeof document === 'undefined' || packsLoaded.has(pack)) return
  packsLoaded.add(pack)
  started = true
  for (const role of packRoles(pack)) loadRole(pack, role)
  // Everything may already have been cached synchronously by the browser; a
  // no-pending state still has to reach the callbacks.
  settle()
}

/** Fetch exactly the files a theme draws (see {@link themeAssetPaths}). */
export function preloadTheme(style: ThemeStyle): void {
  if (typeof document === 'undefined') return
  started = true
  for (const [role, pack] of themeArtPlan(style)) loadRole(pack, role)
  settle()
}

/** Preload what the active theme renders with (see themes.ts). */
export function preloadSprites(): void {
  preloadTheme(getActiveStyle())
}

// Switching theme fetches what the new theme draws automatically, so a future
// picker cannot select art that was never requested.
onThemeChange((style) => {
  preloadTheme(style)
  resolved.clear()
})

/** A decoded image for pack+role, or undefined (caller falls back procedurally). */
export function getSprite(pack: string, name: string): HTMLImageElement | undefined {
  const img = images.get(`${pack}/${name}`)
  return img && img.complete && img.naturalWidth > 0 ? img : undefined
}

// ── Resolution at draw time ─────────────────────────────────────────────────
/** role → source, for the active theme at the current {@link generation}. */
const resolved = new Map<string, ArtSource | null>()
let resolvedGen = -1
let resolvedStyle: ThemeStyle | null = null
let resolvedOwners: Map<string, string[]> = new Map()

/**
 * The pack the active theme draws `role` from, and its density — or undefined
 * when no pack in the chain ships the role's family (procedural fallback).
 *
 * The owner is decided by DECLARATION, not by what happens to have decoded
 * yet, so a role never pops from one pack's art to another's while the boot
 * preload is still in flight. The one exception is a request that FAILED (a
 * declared file that 404s): that pack is skipped for the whole family and the
 * next pack's copy is fetched on the spot, so a broken upload degrades to the
 * previous art rather than to a circle.
 */
export function artFor(role: string): ArtSource | undefined {
  const style = getActiveStyle()
  if (!style.sprites) return undefined
  if (resolvedGen !== generation || resolvedStyle !== style) {
    if (resolvedStyle !== style) resolvedOwners = familyOwners(artChain(style))
    resolved.clear()
    resolvedGen = generation
    resolvedStyle = style
  }
  const hit = resolved.get(role)
  if (hit !== undefined) return hit ?? undefined
  const fam = artFamily(role)
  let src: ArtSource | null = null
  for (const pack of resolvedOwners.get(fam) ?? []) {
    const famRoles = packRoles(pack).filter((r) => artFamily(r) === fam)
    if (famRoles.some((r) => failed.has(`${pack}/${r}`))) continue
    // A fallback pack's copy is not in the boot plan; ask for it now.
    for (const r of famRoles) loadRole(pack, r)
    src = { pack, spriteScale: packDensity(pack) }
    break
  }
  resolved.set(role, src)
  return src ?? undefined
}

/**
 * The decoded image the active theme draws for `role`, with the pack and
 * density it came from — or undefined (not shipped, or not decoded yet).
 */
export function spriteFor(role: string): (ArtSource & { img: HTMLImageElement }) | undefined {
  const src = artFor(role)
  if (!src) return undefined
  const img = getSprite(src.pack, role)
  return img ? { ...src, img } : undefined
}

const spritesReady = (): boolean => started && pending === 0

/** See {@link generation}: changes whenever any requested sprite settles. */
export const spriteGeneration = (): number => generation

/** Fire cb once the requested sprites have loaded (or immediately if already so). */
export function onSpritesReady(cb: () => void): void {
  if (spritesReady()) cb()
  else readyCbs.push(cb)
}
