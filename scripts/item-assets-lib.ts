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
 *    cell, pixel-doubled, in the fist. A body piece is not drawn there.
 *  - **Doll** — the paper-doll compositor (`render/loadout.ts`): a `gear_<noun>`
 *    or `body_<noun>` strip, which only the from-scratch `fieldwatch` pack ships
 *    and only for a few nouns.
 *
 * `DRAFTS` holds the PROPOSED unique icons for the items that borrow another
 * item's cell — 16 × 16 interiors in `scripts/fw-icons.ts`'s own format and
 * palette (the outline ring is added by {@link outlined}, the same walk the
 * atlas uses). They are proposals for the designer, not shipped art: nothing
 * in the game reads them.
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
  /** The mark on the battlefield figure: the same cell in the fist, or null (a body piece is not drawn). */
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
        figureMark: k.slot === 'body' ? null : icon,
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
  group('figure', (r) => (r.figureMark ? `${r.figureMark} in the fist` : 'nothing drawn (body)'))
  group('doll', (r) => (r.dollArt ? r.dollRole : 'no doll art (bare figure)'))
  return out
}

/**
 * Who keeps a shared cell: the kind the cell was drawn FOR (the basic or
 * first-listed one). Every other kind on that cell borrows it and gets a draft.
 */
export const CELL_OWNER: Readonly<Partial<Record<IconKey, string>>> = {
  blade: 'Sword',
  wand: 'Wand',
  grimoire: 'Grimoire',
  shield: 'Shield',
  plate: 'Plate',
  cloth: 'Robe',
}

/* ----------------------------------------------------------------- drafts */

/** `scripts/fw-icons.ts`'s palette, character for character (every hue from the CC0 harvest). */
export const PALETTE: Readonly<Record<string, string>> = {
  K: '#161c2e',
  W: '#fffce7',
  S: '#bac1c8',
  s: '#737f8e',
  d: '#4a6982',
  P: '#e1d4bd',
  p: '#ccb88d',
  q: '#9e8776',
  G: '#ffed44',
  g: '#d08c41',
  h: '#a38250',
  T: '#8cc3c4',
  t: '#47aba9',
  u: '#27716f',
  R: '#f76666',
  r: '#b65555',
  n: '#87465a',
  L: '#b48355',
  l: '#866353',
  o: '#6f5a48',
  E: '#95d562',
  e: '#38b251',
  f: '#276740',
  V: '#a8719a',
  v: '#775396',
}

export const CELL = 16

export interface Draft {
  kind: string
  borrows: IconKey
  /** What makes it its own object at 16 px, in one line. */
  idea: string
  /** 16 rows × 16 palette characters, interior only, inside rows/cols 1..14. */
  art: readonly string[]
}

/** The atlas's outline walk (`fw-icons.ts` `outline`): `K` into every empty pixel 4-touching a filled one. */
export function outlined(art: readonly string[]): string[][] {
  const g = art.map((r) => [...r])
  const out = g.map((r) => [...r])
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++) {
      if (g[y][x] !== '.') continue
      const near =
        (y > 0 && g[y - 1][x] !== '.') ||
        (y < CELL - 1 && g[y + 1][x] !== '.') ||
        (x > 0 && g[y][x - 1] !== '.') ||
        (x < CELL - 1 && g[y][x + 1] !== '.')
      if (near) out[y][x] = 'K'
    }
  return out
}

/** A draft as hex pixels (null = clear), outline included — what the harness and Figma draw. */
export const draftPixels = (d: Draft): (string | null)[][] => outlined(d.art).map((r) => r.map((c) => (c === '.' ? null : PALETTE[c])))

export const DRAFTS: readonly Draft[] = [
  {
    kind: 'Rod',
    borrows: 'wand',
    idea: 'A long steel rod, corner to corner, gold bands and a red gem: reach, not a twig.',
    art: [
      '................',
      '................',
      '...........RR...',
      '..........RWRR..',
      '..........RRRR..',
      '.........GgRR...',
      '........sSg.....',
      '.......sSs......',
      '......gGs.......',
      '.....sSs........',
      '....sSs.........',
      '...gGs..........',
      '..sSs...........',
      '..ss............',
      '................',
      '................',
    ],
  },
  {
    kind: 'Saffron Brand',
    borrows: 'blade',
    idea: 'The sword, gilded saffron, with a flame running up its edge.',
    art: [
      '................',
      '............R...',
      '...........RGR..',
      '..........RGWG..',
      '.........RGWGg..',
      '........RGWGg...',
      '.......RGWGg....',
      '......RGWGg.....',
      '.......GWGg.....',
      '.....GWGg.......',
      '....rGGg........',
      '...rrrrrr.......',
      '...ll.rr........',
      '..lll.r.........',
      '..ll............',
      '................',
    ],
  },
  {
    kind: 'Tome',
    borrows: 'grimoire',
    idea: 'A small brown book, three-quarter view, pages showing and a red ribbon.',
    art: [
      '................',
      '................',
      '................',
      '.....LLLLLLL....',
      '....LLLLLLLl....',
      '...LLLqqLLLlP...',
      '...LLLLLLLLlP...',
      '...LLLqqqLLlP...',
      '...LLLLLLLLlP...',
      '...LLLLLLLLlP...',
      '...lllllllllP...',
      '...PPPPPPPPPP...',
      '.....r..........',
      '.....r..........',
      '................',
      '................',
    ],
  },
  {
    kind: 'Moonquill Codex',
    borrows: 'grimoire',
    idea: 'A night-teal codex with a cream crescent, and a quill standing out of it.',
    art: [
      '................',
      '............W...',
      '...........WP...',
      '..........WP....',
      '..uuuuuuuuPuu...',
      '..uttttttPtuu...',
      '..utttWWtttuu...',
      '..uttWtttttuu...',
      '..uttWtttttuu...',
      '..utttWWtttuu...',
      '..uttttttttuu...',
      '..uuuuuuuuuuu...',
      '..PPPPPPPPPPP...',
      '...hhhhhhhhh....',
      '................',
      '................',
    ],
  },
  {
    kind: 'Buckler',
    borrows: 'shield',
    idea: 'A small ROUND shield with a steel boss: smaller and rounder than the heater.',
    art: [
      '................',
      '................',
      '................',
      '................',
      '......llll......',
      '.....lLLLLl.....',
      '....lLLSSLLl....',
      '....lLSWSSLl....',
      '....lLSSSSLl....',
      '....lLLSSLLl....',
      '.....lLLLLl.....',
      '......llll......',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  {
    kind: 'Pavise',
    borrows: 'shield',
    idea: 'A tall wooden wall-shield, full height, steel rim and a centre ridge.',
    art: [
      '................',
      '....ssssssss....',
      '....sLLLLLLs....',
      '....sLLLLLLs....',
      '....sLLSSLLs....',
      '....sLLSSLLs....',
      '....sLLSSLLs....',
      '....sLLSSLLs....',
      '....sLLSSLLs....',
      '....sLLSSLLs....',
      '....sLLLLLLs....',
      '....sLLLLLLs....',
      '....sLLLLLLs....',
      '....ssssssss....',
      '................',
      '................',
    ],
  },
  {
    kind: 'Gilded Easel',
    borrows: 'shield',
    idea: 'A gold frame holding a painted canvas, on easel legs.',
    art: [
      '................',
      '.......gg.......',
      '...gggggggggg...',
      '...gGGGGGGGGg...',
      '...gGTTTTTTGg...',
      '...gGTTTWTTGg...',
      '...gGTEETTTGg...',
      '...gGEEEETTGg...',
      '...gGeeeeeeGg...',
      '...gGGGGGGGGg...',
      '...gggggggggg...',
      '....l..l...l....',
      '...l...l....l...',
      '...l...l....l...',
      '................',
      '................',
    ],
  },
  {
    kind: 'Mail',
    borrows: 'plate',
    idea: 'A chain shirt: checkered rings, short sleeves, a ragged hem.',
    art: [
      '................',
      '................',
      '.....ss..ss.....',
      '..sSsSsSsSsSs...',
      '..SsSsSsSsSsS...',
      '..sSsSsSsSsSs...',
      '...sSsSsSsSs....',
      '...SsSsSsSsS....',
      '...sSsSsSsSs....',
      '...SsSsSsSsS....',
      '...sSsSsSsSs....',
      '...S.s.S.s.S....',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  {
    kind: 'Aegis',
    borrows: 'plate',
    idea: 'A rounded steel cuirass, shoulders up, gold rim and a gold sun boss.',
    art: [
      '................',
      '................',
      '...ggg....ggg...',
      '..gSSSggggSSSg..',
      '..gSSSSSSSSSSg..',
      '..gSSSSGGSSSSg..',
      '..gSSSGWGGSSSg..',
      '..gSSSGGGGSSSg..',
      '..gSSSSGGSSSSg..',
      '..gSSSSSSSSSSg..',
      '...gSSSSSSSSg...',
      '....gggggggg....',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  {
    kind: 'Ironheart Plate',
    borrows: 'plate',
    idea: 'Dark iron plate with a red heart at its centre.',
    art: [
      '................',
      '................',
      '...dd.ddd.dd....',
      '..ddddddddddd...',
      '..dssssssssdd...',
      '..dsRR.RRssdd...',
      '..dsRRRRRssdd...',
      '..dsRWRRRssdd...',
      '..dssRRRsssdd...',
      '..dsssRssssdd...',
      '...dssssssdd....',
      '...dd.ddd.dd....',
      '...dd.ddd.dd....',
      '................',
      '................',
      '................',
    ],
  },
  {
    kind: 'Cloak',
    borrows: 'cloth',
    idea: 'A green hooded cloak with a gold clasp, flaring at the hem.',
    art: [
      '................',
      '................',
      '......ffff......',
      '.....fEEEEf.....',
      '.....fEooEf.....',
      '.....fEooEf.....',
      '......fGGf......',
      '.....fEeeEf.....',
      '....fEeeeeEf....',
      '....fEeeeeEf....',
      '...fEeeeeeeEf...',
      '...fEeeeeeeEf...',
      '..fEeeeeeeeeEf..',
      '..ffffffffffff..',
      '................',
      '................',
    ],
  },
  {
    kind: 'Silkwind Cloak',
    borrows: 'cloth',
    idea: 'A violet silk cloak, hood and gold clasp, its hem blown sideways past cream wind streaks.',
    art: [
      '................',
      '................',
      '.....vvvv.......',
      '....vVVVVv..WWW.',
      '....vVooVv......',
      '.....vGGv...WW..',
      '....vVVVVvv.....',
      '...vVVVVVVVv....',
      '...vVVWVVVVVv...',
      '...vVVVWVVVVVv..',
      '....vVVVWVVVVVv.',
      '.....vVVVVVVVVv.',
      '......vvvvvvvvv.',
      '................',
      '................',
      '................',
    ],
  },
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
