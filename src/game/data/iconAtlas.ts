/**
 * The icon atlas, as data — `public/assets/ui/fw-icons.png`'s cell order and
 * the item-noun → shape table.
 *
 * It lives under `game/data/` (not `ui/channels.ts`, where it was authored)
 * because the battle CANVAS draws from the same atlas now: a hero carries its
 * real weapon and off-hand on the field (`render/gearMarks.ts`), and `game/`
 * must not import `ui/`. `channels.ts` re-exports every name here, so UI
 * callers keep importing from there; `scripts/fw-icons.ts` checks THIS file's
 * `ICON_ORDER` / `ICON_COLS` / `ICON_ROWS` against the sheet.
 */
import { ITEM_NOUN_RE } from './items'
import type { Item } from '../types'

/**
 * The 78 cells of `public/assets/ui/fw-icons.png`, IN CELL ORDER.
 *
 * The list is authored twice on purpose — here and in `scripts/fw-icons.ts` —
 * because a PNG cannot carry its own index and a silently-shifted atlas is 78
 * wrong pictures rather than one visible error. The generator refuses to write
 * the file unless this array matches it exactly, and `npm run build` runs the
 * same check without writing, so the duplication is checked rather than
 * trusted. **Append; never reorder.**
 *
 * ---------------------------------------------------------------------------
 * What this replaces
 * ---------------------------------------------------------------------------
 * Every item and status in the game was a Unicode glyph, and there were not
 * enough distinct glyphs to go round. Measured before this landed, in the
 * shipping shell alone: 26 item nouns and 5 rarities shared **four** marks
 * (`⚔ ⚒ ⛊ ⛨`); 22 distinct combat effects had **none**; and eleven glyphs each
 * carried two or more unrelated meanings — `⛨` alone meant body armour, the
 * armour stat, the Assist setting and base integrity.
 *
 * The rule that survives all of it: an icon is ADDITIVE. Rarity still carries
 * its letter and its pip count, statuses still carry their sentence, and every
 * control still carries a text accessible name. Nothing here is ever the only
 * channel, so an atlas that fails to load costs decoration and no meaning —
 * which is also why every `<Icon>` is `aria-hidden`.
 *
 * That invariant was asserted here and broken at three render sites (M11):
 * `damageMark` was the ONLY statement of an item's damage type on the pack
 * tile, the offer card and the menu row, and the `boss` skull was the only
 * statement that a boss was coming. `ICON_LABEL` below is what those sites now
 * append to their accessible names, and `DetailBand` prints a visible `Boss`
 * tag beside the skull. The invariant is a claim about the render sites, so it
 * has to be paid for at the render sites.
 */
export const ICON_ORDER = [
  // row 0 — status A
  'burn', 'chill', 'shock', 'stun', 'execute', 'lifedrain', 'crit', 'splash',
  // row 1 — status B
  'block', 'thorns', 'pierce', 'armour', 'damage', 'range', 'haste', 'hp',
  // row 2 — status C
  'auraHeal', 'auraBuff', 'auraShield', 'trap', 'sacrifice', 'projectile', 'patience', 'curse',
  // row 3 — one-handed and two-handed weapons
  'blade', 'dagger', 'axe', 'wand', 'sceptre', 'greatblade', 'hammer', 'bow',
  // row 4 — two-handers, off-hands, bodies
  'staff', 'grimoire', 'shield', 'quiver', 'orb', 'plate', 'cloth', 'banner',
  // row 5 — keepsakes, damage-type marks, currencies
  'relic', 'beacon', 'phys', 'magic', 'gold', 'dust', 'marks', 'keepsake',
  // row 6 — places and events
  'shrine', 'forge', 'merchant', 'recruit', 'wave', 'boss', 'evolve', 'mutate',
  // row 7 — system marks
  'threat', 'base', 'depth', 'back', 'soundOn', 'soundOff', 'settings', 'warn',
  // row 8 — polarity, the three meanings that were sharing another cell, and
  // the start of the six mirrors M3 was missing
  'boon', 'loot', 'slow', 'weaken', 'assist', 'equip', 'deploy', 'frail',
  // row 9 — the rest of the polarity mirrors (M3)
  'shorten', 'drag', 'shrink', 'nocrit', 'blunt', 'auraWeaken',
  // row 9 (cont.) – 11 — the map's node marks, the menu's endless loop and the
  // Watchtower perks (Wave 1): the last system-font glyphs in the shell
  'battle', 'start', 'elite', 'crown', 'endless', 'coffer', 'seasoned', 'company',
  'map', 'orders', 'vow',
  // row 11 (cont.) — the Settings rows' last system-font glyphs (Phase 2)
  'motion', 'contrast', 'scale', 'vision', 'tips', 'calm', 'mono',
] as const

export type IconKey = (typeof ICON_ORDER)[number]

/**
 * The grid. `global.css` declares the same two numbers as `--fw-i-cols` and
 * `--fw-i-rows` and `background-size` reads them; `scripts/fw-icons.ts`
 * compares all four against the real sheet and refuses to write otherwise.
 * Before that the CSS carried a bare `* 9` with a comment claiming it read a
 * token that did not exist, so appending a ninth row of icons would have moved
 * every cell in the atlas with nothing anywhere to notice (M13).
 */
export const ICON_COLS = 8
export const ICON_ROWS = 12

/**
 * Where an icon sits in the sheet, as (column, row).
 *
 * Throws rather than returning `{-1,-1}`. `IconKey` is a closed union, so the
 * only way to arrive here with an unknown key is a cast or a hand-built string
 * — and the old fallback answered that with cell (−1,−1), which is a valid CSS
 * background-position pointing one cell off the top-left of the sheet: a
 * transparent square, no warning, and a picture silently missing wherever the
 * cast was. Fail where the mistake is.
 */
export const iconCell = (k: IconKey): { ix: number; iy: number } => {
  const i = ICON_ORDER.indexOf(k)
  if (i < 0) throw new Error(`[iconAtlas] unknown icon key '${k}' — not in ICON_ORDER`)
  return { ix: i % ICON_COLS, iy: Math.floor(i / ICON_COLS) }
}


/**
 * The 26 item nouns, mapped onto 18 drawn shapes.
 *
 * Compression, not laziness: a Buckler and a Shield are the same silhouette at
 * 16px and pretending otherwise buys a difference nobody can see, while a
 * Greatsword and a Dagger are genuinely different objects and now look it. What
 * matters is that the four-glyph regime is over — a Bow, a Staff and a Warhammer
 * were all `⚒`.
 *
 * ---------------------------------------------------------------------------
 * ONE regex, because `renameFor` is one regex (M9)
 * ---------------------------------------------------------------------------
 * The noun is read out of the item NAME because that is where it lives:
 * `nameItem` composes `[prefix] Rarity Noun [of Suffix]` and the noun is never
 * stored as a field. This used to be an ORDERED LIST of little regexes tested
 * one after another, under a comment asserting it matched `items.ts`'s
 * `renameFor` "and the order matters in the same way". It did not, and the two
 * sentences describe different machines:
 *
 *  - `renameFor` is a single alternation. A regex alternation is matched
 *    **leftmost-by-position** — the engine walks the string and takes the first
 *    place where any branch matches, so the noun that appears EARLIEST IN THE
 *    NAME wins, and the order the branches are written in only breaks ties at
 *    the same position (`Greatsword` before `Sword`).
 *  - A list of separate regexes is matched **by list order** — the earliest
 *    ENTRY that matches anywhere wins, wherever in the string it sits.
 *
 * Those agree until a noun can appear twice in one name, and one can:
 * `of Focus` is in the keepsake enchant pool (`items.ts`) and keepsakes are
 * named `${rarity} ${noun} ${enchant}`. `Legendary Banner of Focus` is a Banner
 * by `renameFor` and was an `orb` here — a single-hero off-hand crystal drawn
 * on a team-wide keepsake, at the pack tile, the merchant row, the forge row,
 * the reward card, the gear slot and the item-panel head. 25 generatable names,
 * about 2.4% of drops.
 *
 * So this is now the same shape as `renameFor`: one alternation, in the same
 * branch order, and the icon is looked up from what it captured. Since round 3
 * it is literally the same regex (`items.ITEM_NOUN_RE`), which the grip table
 * — which hand an item fits — reads too, so the icon, the rename and the hand
 * rule cannot disagree about which noun a name carries. Both spellings of
 * Sceptre/Scepter are carried.
 */
const NOUN_RE = ITEM_NOUN_RE

const NOUN_ICON: Record<string, IconKey> = {
  // The Sovereign tier draws as its everyday cousin; the cyan tier mark says the rest.
  'Saffron Brand': 'blade',
  'Moonquill Codex': 'grimoire',
  'Gilded Easel': 'shield',
  'Ironheart Plate': 'plate',
  'Silkwind Cloak': 'cloth',
  Greatsword: 'greatblade',
  Sword: 'blade',
  Axe: 'axe',
  Dagger: 'dagger',
  Wand: 'wand',
  Rod: 'wand',
  Scepter: 'sceptre',
  Sceptre: 'sceptre',
  Warhammer: 'hammer',
  Bow: 'bow',
  Staff: 'staff',
  Grimoire: 'grimoire',
  Tome: 'grimoire',
  Shield: 'shield',
  Buckler: 'shield',
  Pavise: 'shield',
  Quiver: 'quiver',
  Focus: 'orb',
  Plate: 'plate',
  Mail: 'plate',
  Aegis: 'plate',
  Robe: 'cloth',
  Cloak: 'cloth',
  Banner: 'banner',
  Standard: 'banner',
  Relic: 'relic',
  Oath: 'relic',
  Beacon: 'beacon',
}

/** Fallback when a name carries no noun the table knows (a hand-built item). */
const SLOT_ICON: Record<string, IconKey> = {
  oneHand: 'blade',
  twoHand: 'greatblade',
  offHand: 'shield',
  body: 'plate',
}

/** The shape for an item — what it IS, before what it does. */
export function itemIcon(item: Pick<Item, 'name' | 'slot'>): IconKey {
  const noun = NOUN_RE.exec(item.name)?.[0]
  if (noun && NOUN_ICON[noun]) return NOUN_ICON[noun]
  return SLOT_ICON[item.slot] ?? 'loot'
}

