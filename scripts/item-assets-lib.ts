/**
 * The item-asset inventory, as pure data — what every item base the game can
 * deal looks like, in each of the three places an item is drawn, and where
 * two or more different items share one picture.
 *
 * Read by `scripts/item-assets.ts` (the CLI: prints the table, writes
 * `docs/item-assets/inventory.json`, drives the render harness) and by
 * `harness/items.ts` (the render harness itself, which draws through the real
 * draw code). No DOM, no Node: both programs import it.
 *
 * The three channels an item is drawn on:
 *
 *  - **Icon** — its atlas cell (`iconAtlas.itemIcon`), on the pack tile, the
 *    gear slot, the reward card and every row that names it, framed by the
 *    rarity tile (`.sh-tile`: hue, letter, pips, ornament count).
 *  - **Figure** — the battlefield hero (`render/gearMarks.ts`): the SAME atlas
 *    cell, pixel-doubled, in the fist; a body piece is WORN instead — the
 *    figure's own tunic re-inked in the cell's colours, plus its silhouette
 *    (`render/bodyLayer.ts`).
 *  - **Doll** — the paper-doll compositor (`render/loadout.ts`): a `gear_<noun>`
 *    or `body_<noun>` strip, which only the from-scratch `fieldwatch` pack ships
 *    and only for a few nouns.
 *
 * Every kind the game deals has its own icon cell (`SHIPPED_CELLS`: the twelve
 * that borrowed one until Oct 2026), so the icon channel shares nothing.
 */
import { gripOf, RARITY_ORDER } from '../src/game/data/items'
import { itemIcon, type IconKey } from '../src/game/data/iconAtlas'
import { ITEM_KINDS, type ItemKind } from '../src/game/data/itemKinds'
import { packRoles } from '../src/game/render/sprites'
import type { ItemRarity, ItemSlot } from '../src/game/types'

/** The hand rule, in words — what `items.gripOf` decides. */
export const GRIP_RULE: Readonly<Record<string, string>> = {
  main: 'Main hand',
  either: 'Main or off hand',
  off: 'Off hand',
  twoHand: 'Both hands',
  body: 'Body',
}

export const SLOT_ORDER: readonly ItemSlot[] = ['oneHand', 'twoHand', 'offHand', 'body']
export const SLOT_TITLE: Readonly<Record<ItemSlot, string>> = {
  oneHand: 'One-handed weapons',
  twoHand: 'Two-handed weapons',
  offHand: 'Off-hand pieces',
  body: 'Body pieces',
}

/** The pack the paper doll is composited from — the only one that ships gear strips. */
export const DOLL_PACK = 'fieldwatch'

export interface ItemAssetRow {
  kind: string
  slot: ItemSlot
  grip: string
  handRule: string
  /** Every rarity the kind can be dealt or raised to (any roll may land on any; the forge raises to Mythic). */
  rarities: readonly ItemRarity[]
  tier: 'basic' | 'unlock' | 'sovereign'
  level: number
  company: string
  /** The atlas cell — the icon everywhere in the UI. */
  icon: IconKey
  /** The mark on the battlefield figure: the same cell in the fist, or worn on the body (`bodyLayer`). */
  figureMark: IconKey | null
  /** The doll strip the compositor asks for, and whether the doll pack ships it. */
  dollRole: string
  dollArt: boolean
}

/** One row per item KIND the game deals (`itemKinds.ITEM_KINDS`). */
export function itemAssetRows(): ItemAssetRow[] {
  const shipped = new Set(packRoles(DOLL_PACK))
  return SLOT_ORDER.flatMap((slot) =>
    ITEM_KINDS.filter((k) => k.slot === slot).map((k: ItemKind) => {
      const item = { name: k.id, slot: k.slot }
      const grip = gripOf(item)
      const icon = itemIcon(item)
      // The compositor looks gear up by the item's own lowercased noun (`sprites.ts`, GEAR_ROLES).
      const dollRole = `${k.slot === 'body' ? 'body' : 'gear'}_${k.id.toLowerCase()}`
      return {
        kind: k.id,
        slot: k.slot,
        grip,
        handRule: GRIP_RULE[grip],
        rarities: RARITY_ORDER,
        tier: k.level >= 4 ? 'sovereign' : k.basic ? 'basic' : 'unlock',
        level: k.level,
        company: k.company,
        icon,
        figureMark: icon,
        dollRole,
        dollArt: shipped.has(dollRole),
      } satisfies ItemAssetRow
    }),
  )
}

/**
 * Bases the tables still know but the game no longer deals: the US spelling
 * (a renamed save) and the five keepsakes (relics since Phase 3b; only an old
 * save carries one). Listed so the inventory is complete, never drawn.
 */
export const LEGACY_BASES: readonly { kind: string; why: string }[] = [
  { kind: 'Scepter', why: 'old spelling of Sceptre (old saves)' },
  ...['Banner', 'Standard', 'Relic', 'Beacon', 'Oath'].map((kind) => ({ kind, why: 'keepsake, now a relic (old saves only)' })),
]

export interface SharedAsset {
  channel: 'icon' | 'figure' | 'doll'
  asset: string
  kinds: string[]
}

/** Every asset two or more different items share, per channel. */
export function sharedAssets(rows: readonly ItemAssetRow[] = itemAssetRows()): SharedAsset[] {
  const out: SharedAsset[] = []
  const group = (channel: SharedAsset['channel'], key: (r: ItemAssetRow) => string) => {
    const by = new Map<string, string[]>()
    for (const r of rows) by.set(key(r), [...(by.get(key(r)) ?? []), r.kind])
    for (const [asset, kinds] of by) if (kinds.length > 1) out.push({ channel, asset, kinds })
  }
  group('icon', (r) => r.icon)
  group('figure', (r) => (r.slot === 'body' ? `${r.figureMark} worn` : r.figureMark ? `${r.figureMark} in the fist` : 'nothing drawn'))
  group('doll', (r) => (r.dollArt ? r.dollRole : 'no doll art (bare figure)'))
  return out
}

/** The pixel size of an atlas cell (the harness draws cells at ×16). */
export const CELL = 16

/**
 * The twelve kinds that used to BORROW another kind's atlas cell, and the cell
 * each has now (Oct 2026). The art is drawn in `scripts/fw-icons.ts` (rows
 * 12–13) like every other cell; this table is what the inventory and the
 * harness say about it — the cell it borrowed, shown beside its own.
 * `item-assets.ts` refuses to run if `itemIcon` does not give each kind its cell.
 */
export interface ShippedCell {
  kind: string
  /** Its own cell, in `iconAtlas.ICON_ORDER`. */
  cell: IconKey
  /** The cell it borrowed until it had one. */
  borrowed: IconKey
  /** What makes it its own object at 16 px, in one line. */
  idea: string
}

export const SHIPPED_CELLS: readonly ShippedCell[] = [
  { kind: 'Saffron Brand', cell: 'brand', borrowed: 'blade', idea: 'The sword gilded saffron, flames licking up its back, a red guard.' },
  { kind: 'Rod', cell: 'rod', borrowed: 'wand', idea: 'A long steel rod corner to corner, two gold bands and a red gem: reach, not a twig.' },
  { kind: 'Tome', cell: 'tome', borrowed: 'grimoire', idea: 'A small brown book, three-quarter view, page edges showing and a red ribbon.' },
  { kind: 'Moonquill Codex', cell: 'codex', borrowed: 'grimoire', idea: 'A night-teal codex with a cream crescent moon, a quill standing out of it.' },
  { kind: 'Buckler', cell: 'buckler', borrowed: 'shield', idea: 'The shield, smaller and round: a wooden disc, steel rim and boss.' },
  { kind: 'Pavise', cell: 'pavise', borrowed: 'shield', idea: 'The shield, tall: a painted wall-shield, arched top, steel ridge and two feet.' },
  { kind: 'Gilded Easel', cell: 'easel', borrowed: 'shield', idea: 'A gold frame round a painted canvas, on easel legs.' },
  { kind: 'Mail', cell: 'mail', borrowed: 'plate', idea: 'A chain shirt: a T of rings, short sleeves, a belt, a ragged hem.' },
  { kind: 'Aegis', cell: 'aegis', borrowed: 'plate', idea: 'A rounded steel cuirass, gold rim and a gold sun boss.' },
  { kind: 'Ironheart Plate', cell: 'ironheart', borrowed: 'plate', idea: 'Dark iron plate with a red heart at its centre.' },
  { kind: 'Cloak', cell: 'cloak', borrowed: 'cloth', idea: 'A green hooded cloak, gold clasp, open down the front on a red lining.' },
  { kind: 'Silkwind Cloak', cell: 'silkwind', borrowed: 'cloth', idea: 'A violet silk cloak on a gold lining, its hem blown sideways past wind streaks.' },
]

/* --------------------------------------------------------------- loadouts */

export interface LoadoutSpec {
  id: string
  title: string
  mainHand: { kind: string; rarity: ItemRarity } | null
  offHand: { kind: string; rarity: ItemRarity } | null
  body: { kind: string; rarity: ItemRarity } | null
}

/** Complete kits on the same neutral hero: the figure is what it holds, not a class. */
export const LOADOUTS: readonly LoadoutSpec[] = [
  { id: 'greatsword-plate', title: 'Two-hander · Greatsword + Plate', mainHand: { kind: 'Greatsword', rarity: 'epic' }, offHand: null, body: { kind: 'Plate', rarity: 'rare' } },
  { id: 'sword-shield', title: 'Sword and shield · Sword + Shield + Mail', mainHand: { kind: 'Sword', rarity: 'common' }, offHand: { kind: 'Shield', rarity: 'rare' }, body: { kind: 'Mail', rarity: 'common' } },
  { id: 'bow-cloak', title: 'Bow · Bow + Cloak', mainHand: { kind: 'Bow', rarity: 'legendary' }, offHand: null, body: { kind: 'Cloak', rarity: 'rare' } },
  { id: 'wand-tome', title: 'Wand and tome · Wand + Tome + Robe', mainHand: { kind: 'Wand', rarity: 'rare' }, offHand: { kind: 'Tome', rarity: 'epic' }, body: { kind: 'Robe', rarity: 'common' } },
  { id: 'dagger-buckler', title: 'Mixed rarities · Dagger + Buckler + Aegis', mainHand: { kind: 'Dagger', rarity: 'mythic' }, offHand: { kind: 'Buckler', rarity: 'common' }, body: { kind: 'Aegis', rarity: 'legendary' } },
  { id: 'sovereign', title: 'Sovereign · Saffron Brand + Gilded Easel + Ironheart Plate', mainHand: { kind: 'Saffron Brand', rarity: 'legendary' }, offHand: { kind: 'Gilded Easel', rarity: 'epic' }, body: { kind: 'Ironheart Plate', rarity: 'mythic' } },
]

/** A file-name slug for a kind ("Saffron Brand" → "saffron-brand"). */
export const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** A stable seed per (kind, rarity), so a re-render deals the same enchantments. */
export function seedFor(kind: string, rarity: string): number {
  let h = 2166136261
  for (const c of `${kind}|${rarity}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}
