/**
 * The hero as DATA — {@link HeroLook} — and the rules that turn it into parts.
 *
 *   HeroLook { race, head, hair, skin, hairInk, palette, company, gear, state }
 *
 * - `gear` names what the hero carries (roster item names, or part ids). Each
 *   name resolves to an item PART ({@link resolveItem}); a name with no part
 *   falls back to a keyword family, then to the slot's generic part, so a
 *   missing piece never leaves a hole.
 * - `state` is everything that is not gear but changes the look: the rarity
 *   of each worn piece, the level (the cape's tier), skill tells and status
 *   effects. {@link STATE_LAYERS} says which layers each one may touch.
 * - `company` swaps the cloth and trim inks to the hiring company's colours.
 *
 * Pure: no DOM.
 */
import type { RampId } from './palette'
import type { Grip, Motion, RaceId } from './rig'

// ── layers (the draw order) ────────────────────────────────────────────────

export type LayerId = 'back' | 'offArm' | 'legs' | 'body' | 'armour' | 'head' | 'hair' | 'mainArm' | 'mainItem' | 'offItem' | 'fx'
/** The fixed draw order, back to front. */
export const LAYERS: readonly LayerId[] = ['back', 'offArm', 'legs', 'body', 'armour', 'head', 'hair', 'mainArm', 'mainItem', 'offItem', 'fx']
export const layerIndex = (l: LayerId): number => LAYERS.indexOf(l)

// ── items ──────────────────────────────────────────────────────────────────

export type GearSlot = 'oneHand' | 'twoHand' | 'either' | 'offHand' | 'body'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'
export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic']

export type WeaponFamily =
  | 'sword' | 'greatsword' | 'sabre' | 'falchion' | 'dagger'
  | 'axe' | 'greataxe' | 'hammer' | 'maul' | 'pick' | 'club' | 'cleaver' | 'hook'
  | 'spear' | 'halberd' | 'glaive' | 'harpoon' | 'banner'
  | 'bow' | 'staff' | 'wand' | 'sceptre' | 'grimoire'
export type OffFamily = 'shieldRound' | 'shieldKite' | 'shieldHeater' | 'buckler' | 'pavise' | 'quiver' | 'orb' | 'tome' | 'pouch' | 'flask' | 'javelins' | 'offDagger'
export type BodyFamily = 'mail' | 'padded' | 'leather' | 'brigandine' | 'plate' | 'robe' | 'apron' | 'cloak' | 'vest' | 'hood' | 'scale' | 'belt'
export type Family = WeaponFamily | OffFamily | BodyFamily

/** Shape and ink knobs an item can set on its family's part. */
export interface ItemParams {
  /** Length / size scale (1 = the family's). */
  size?: number
  /** The blade or head's ramp. */
  blade?: RampId
  /** The haft / grip / frame ramp. */
  haft?: RampId
  /** The item's own trim (guard, rim, binding) when common. */
  trim?: RampId
  /** A cloth panel: a robe, a flag, a shield's field (default: the company's cloth). */
  cloth?: RampId
  /** A light the item gives off by itself (a spiced edge, a vial). */
  glow?: RampId
  /** A shape variant inside the family (e.g. 'bearded' axe, 'barbed' quiver). */
  variant?: string
  /** A mark painted on it (a shield's emblem, a banner's charge). */
  emblem?: 'star' | 'rune' | 'chili' | 'anvil' | 'heart' | 'tooth' | 'leaf' | 'moon' | 'scale'
}

export interface ItemSpec {
  name: string
  slot: GearSlot
  family: Family
  p?: ItemParams
}

/** What a gear name resolved to. `fallback`: no part of its own (a keyword family or the slot's generic). */
export interface ItemPart extends ItemSpec {
  fallback: false | 'keyword' | 'generic'
}

const I = (name: string, slot: GearSlot, family: Family, p?: ItemParams): ItemSpec => ({ name, slot, family, p })

/**
 * Every roster item (`peoples/roster.json`) → its part. Twenty per people;
 * families are shared across peoples, the knobs make each one its own.
 */
export const ITEMS: readonly ItemSpec[] = [
  // ── Humans (Peppercorn): swords, shields, mail, spice fire, banners ──
  I('Sword', 'oneHand', 'sword'),
  I('Arming Sword', 'oneHand', 'sword', { size: 1.12, variant: 'arming' }),
  I('Shield', 'offHand', 'shieldHeater', { size: 0.9 }),
  I('Kite Shield', 'offHand', 'shieldKite'),
  I('Mail', 'body', 'mail'),
  I('Gambeson', 'body', 'padded'),
  I('Falchion', 'oneHand', 'falchion'),
  I('Spiced Blade', 'oneHand', 'sword', { glow: 'ember', trim: 'red' }),
  I('Halberd', 'twoHand', 'halberd'),
  I('Banner Pole', 'twoHand', 'banner'),
  I('Heater Shield', 'offHand', 'shieldHeater', { size: 1.08, emblem: 'chili' }),
  I('Brigandine', 'body', 'brigandine'),
  I('Greatsword', 'twoHand', 'greatsword'),
  I('Pepperport Sabre', 'oneHand', 'sabre', { trim: 'gold', glow: 'ember' }),
  I("Captain's Shield", 'offHand', 'shieldHeater', { size: 1.12, trim: 'gold', emblem: 'star' }),
  I('Aegis', 'body', 'plate', { trim: 'gold', variant: 'aegis' }),
  I("Sergeant's Cuirass", 'body', 'plate', { variant: 'pauldrons' }),
  I('Saffron Brand', 'oneHand', 'sword', { size: 1.15, blade: 'gold', trim: 'red', glow: 'ember' }),
  I('Pepperport Standard', 'twoHand', 'banner', { size: 1.12, trim: 'gold', emblem: 'chili' }),
  I('Saltmarsh Warplate', 'body', 'plate', { variant: 'heavy', trim: 'aqua' }),
  // ── Elves (Rosethread): bows, knives, woven light armour ──
  I('Bow', 'twoHand', 'bow'),
  I('Shortbow', 'twoHand', 'bow', { size: 0.82 }),
  I('Dagger', 'either', 'dagger'),
  I('Quiver', 'offHand', 'quiver'),
  I('Cloak', 'body', 'cloak'),
  I('Silk Wrap', 'body', 'vest', { cloth: 'rose', variant: 'wrap' }),
  I('Longbow', 'twoHand', 'bow', { size: 1.2 }),
  I('Twin Knives', 'either', 'dagger', { variant: 'twin' }),
  I('Focus', 'offHand', 'orb', { glow: 'aqua' }),
  I('Barbed Quiver', 'offHand', 'quiver', { variant: 'barbed' }),
  I('Woven Vest', 'body', 'vest', { cloth: 'linen' }),
  I('Thornweave Hood', 'body', 'hood', { cloth: 'leaf' }),
  I('Recurve Bow', 'twoHand', 'bow', { variant: 'recurve' }),
  I('Loomwarden Bow', 'twoHand', 'bow', { variant: 'recurve', trim: 'rose' }),
  I("Ranger's Dirk", 'either', 'dagger', { size: 1.25 }),
  I('Starfeather Quiver', 'offHand', 'quiver', { trim: 'gold', emblem: 'star' }),
  I('Moonsilk Mantle', 'body', 'cloak', { cloth: 'hairSilver', variant: 'hooded', emblem: 'moon' }),
  I('Silkwind Cloak', 'body', 'cloak', { cloth: 'rose', variant: 'long' }),
  I('Starstring Longbow', 'twoHand', 'bow', { size: 1.2, haft: 'hairSilver', trim: 'gold', glow: 'frost' }),
  I('Whisperfang', 'either', 'dagger', { size: 1.1, variant: 'curved', blade: 'plum', glow: 'plum' }),
  // ── Dwarves (Ironvein): axes, hammers, plate, splash and stuns ──
  I('Axe', 'oneHand', 'axe'),
  I('Hand Hammer', 'oneHand', 'hammer'),
  I("Miner's Pick", 'oneHand', 'pick'),
  I('Round Shield', 'offHand', 'shieldRound'),
  I('Chainshirt', 'body', 'mail'),
  I('Forge Apron', 'body', 'apron'),
  I('Bearded Axe', 'oneHand', 'axe', { size: 1.12, variant: 'bearded' }),
  I('Maul', 'twoHand', 'maul'),
  I('Pavise', 'offHand', 'pavise'),
  I('Rune Shield', 'offHand', 'shieldRound', { emblem: 'rune', glow: 'aqua' }),
  I('Plate', 'body', 'plate'),
  I('Stoneskin Mail', 'body', 'mail', { blade: 'stone' }),
  I('Warhammer', 'twoHand', 'maul', { variant: 'spike' }),
  I('Greataxe', 'twoHand', 'greataxe'),
  I('Quarry Breaker', 'twoHand', 'maul', { blade: 'stone', size: 1.1 }),
  I('Anvil Shield', 'offHand', 'shieldRound', { size: 1.08, emblem: 'anvil', blade: 'iron' }),
  I('Deepforge Plate', 'body', 'plate', { variant: 'pauldrons', glow: 'ember' }),
  I('Ironheart Plate', 'body', 'plate', { variant: 'heavy', emblem: 'heart', trim: 'gold' }),
  I('Mountainbreaker', 'twoHand', 'maul', { size: 1.22, trim: 'gold', variant: 'spike' }),
  I("Thane's Bulwark", 'offHand', 'pavise', { size: 1.1, trim: 'gold', emblem: 'anvil' }),
  // ── Reptilians (Butcherblock): spears, cleavers, hooks, leather and scale ──
  I('Spear', 'twoHand', 'spear'),
  I('Fang Knife', 'either', 'dagger', { blade: 'bone', variant: 'fang' }),
  I('Bone Club', 'oneHand', 'club'),
  I('Buckler', 'offHand', 'buckler'),
  I('Leather', 'body', 'leather'),
  I('Hide Wrap', 'body', 'padded', { cloth: 'hide', variant: 'hide' }),
  I('Cleaver', 'oneHand', 'cleaver'),
  I('Meat Hook', 'oneHand', 'hook'),
  I('Harpoon', 'twoHand', 'harpoon'),
  I('Gator Buckler', 'offHand', 'buckler', { size: 1.15, emblem: 'tooth' }),
  I('Javelin Sling', 'offHand', 'javelins'),
  I('Scale Hide', 'body', 'scale'),
  I('Glaive', 'twoHand', 'glaive'),
  I('Bonecrusher', 'twoHand', 'maul', { blade: 'bone', variant: 'bone' }),
  I('Venom Fang', 'either', 'dagger', { blade: 'bone', variant: 'fang', glow: 'venom' }),
  I('Stalker Leathers', 'body', 'leather', { cloth: 'soot', variant: 'stalker' }),
  I('Smokehouse Apron', 'body', 'apron', { cloth: 'oxblood' }),
  I('Kingscale Shield', 'offHand', 'shieldRound', { emblem: 'scale', trim: 'gold', blade: 'scaleTeal' }),
  I('Wyrmtooth Spear', 'twoHand', 'spear', { size: 1.12, blade: 'bone', variant: 'tooth', trim: 'gold' }),
  I("Butcher-King's Cleaver", 'oneHand', 'cleaver', { size: 1.2, trim: 'gold' }),
  // ── Gnomes (Greenvial): wands and staffs, potions, robes ──
  I('Wand', 'either', 'wand'),
  I('Rod', 'oneHand', 'wand', { variant: 'rod' }),
  I('Sprout Wand', 'oneHand', 'wand', { variant: 'sprout' }),
  I('Tome', 'offHand', 'tome'),
  I('Herb Pouch', 'offHand', 'pouch'),
  I('Robe', 'body', 'robe'),
  I('Sceptre', 'oneHand', 'sceptre'),
  I('Thornrod', 'oneHand', 'wand', { variant: 'thorn' }),
  I('Spark Coil', 'either', 'wand', { variant: 'coil', glow: 'aqua' }),
  I('Flask', 'offHand', 'flask'),
  I('Mossweave Robe', 'body', 'robe', { cloth: 'moss' }),
  I('Brew Belt', 'body', 'belt'),
  I('Staff', 'twoHand', 'staff'),
  I('Grimoire', 'twoHand', 'grimoire'),
  I('Bloomstaff', 'twoHand', 'staff', { variant: 'bloom' }),
  I('Philter Rack', 'offHand', 'flask', { variant: 'rack' }),
  I("Alchemist's Coat", 'body', 'robe', { variant: 'coat', cloth: 'plum' }),
  I('Greenvial Herbal', 'twoHand', 'grimoire', { cloth: 'leaf', emblem: 'leaf' }),
  I('Worldroot Staff', 'twoHand', 'staff', { variant: 'roots', size: 1.1, glow: 'venom' }),
  I('Elixir of Plenty', 'offHand', 'flask', { size: 1.25, trim: 'gold', glow: 'gold' }),
]

const BY_NAME = new Map(ITEMS.map((i) => [i.name.toLowerCase(), i]))

/** Name keywords → family, for gear that has no part of its own yet. First match wins. */
const KEYWORDS: readonly [RegExp, Family, GearSlot][] = [
  [/great ?sword|claymore/, 'greatsword', 'twoHand'],
  [/great ?axe/, 'greataxe', 'twoHand'],
  [/sabre|saber|scimitar/, 'sabre', 'oneHand'],
  [/falchion/, 'falchion', 'oneHand'],
  [/sword|blade|brand/, 'sword', 'oneHand'],
  [/dagger|knife|knives|dirk|fang/, 'dagger', 'either'],
  [/axe|hatchet/, 'axe', 'oneHand'],
  [/maul|warhammer|breaker|crusher/, 'maul', 'twoHand'],
  [/hammer|mace/, 'hammer', 'oneHand'],
  [/pick/, 'pick', 'oneHand'],
  [/club|cudgel/, 'club', 'oneHand'],
  [/cleaver/, 'cleaver', 'oneHand'],
  [/hook/, 'hook', 'oneHand'],
  [/halberd|poleaxe/, 'halberd', 'twoHand'],
  [/glaive/, 'glaive', 'twoHand'],
  [/harpoon|trident/, 'harpoon', 'twoHand'],
  [/spear|lance|pike/, 'spear', 'twoHand'],
  [/banner|standard|flag/, 'banner', 'twoHand'],
  [/bow/, 'bow', 'twoHand'],
  [/staff|stave/, 'staff', 'twoHand'],
  [/sceptre|scepter/, 'sceptre', 'oneHand'],
  [/wand|rod|coil/, 'wand', 'oneHand'],
  [/grimoire|herbal/, 'grimoire', 'twoHand'],
  [/pavise|bulwark|tower shield/, 'pavise', 'offHand'],
  [/buckler/, 'buckler', 'offHand'],
  [/kite/, 'shieldKite', 'offHand'],
  [/heater/, 'shieldHeater', 'offHand'],
  [/shield/, 'shieldRound', 'offHand'],
  [/quiver/, 'quiver', 'offHand'],
  [/javelin/, 'javelins', 'offHand'],
  [/focus|orb|crystal/, 'orb', 'offHand'],
  [/tome|book/, 'tome', 'offHand'],
  [/pouch|bag|satchel/, 'pouch', 'offHand'],
  [/flask|vial|philter|elixir|potion/, 'flask', 'offHand'],
  [/robe|coat|gown/, 'robe', 'body'],
  [/apron/, 'apron', 'body'],
  [/mantle|cloak|cape/, 'cloak', 'body'],
  [/hood|cowl/, 'hood', 'body'],
  [/plate|cuirass|aegis|breastplate/, 'plate', 'body'],
  [/brigandine/, 'brigandine', 'body'],
  [/mail|chain|hauberk/, 'mail', 'body'],
  [/scale/, 'scale', 'body'],
  [/leather|leathers|jerkin/, 'leather', 'body'],
  [/gambeson|wrap|padded|hide/, 'padded', 'body'],
  [/vest|wrap|tunic/, 'vest', 'body'],
  [/belt/, 'belt', 'body'],
]

/** The slot's generic part: what any unknown piece in that slot looks like. */
export const GENERIC: Readonly<Record<'main' | 'off' | 'body', ItemSpec>> = {
  main: I('(generic one-hand)', 'oneHand', 'sword', { variant: 'plain' }),
  off: I('(generic off-hand)', 'offHand', 'shieldRound', { variant: 'plain' }),
  body: I('(generic body)', 'body', 'padded', { variant: 'plain' }),
}

export type HandSlot = 'main' | 'off' | 'body'

/**
 * A gear name → its part. Known item → its own spec; unknown name → the first
 * keyword family that fits the slot; else the slot's generic part.
 */
export function resolveItem(name: string, slot: HandSlot): ItemPart {
  const known = BY_NAME.get(name.toLowerCase())
  if (known && fits(known.slot, slot)) return { ...known, fallback: false }
  const n = name.toLowerCase()
  for (const [re, family, s] of KEYWORDS) if (re.test(n) && fits(s, slot)) return { name, slot: s, family, fallback: 'keyword' }
  return { ...GENERIC[slot], name, fallback: 'generic' }
}

function fits(item: GearSlot, slot: HandSlot): boolean {
  if (slot === 'body') return item === 'body'
  if (slot === 'off') return item === 'offHand' || item === 'either'
  return item === 'oneHand' || item === 'twoHand' || item === 'either'
}

const TWO_HANDED: ReadonlySet<Family> = new Set<Family>(['greatsword', 'greataxe', 'maul', 'spear', 'halberd', 'glaive', 'harpoon', 'banner', 'staff'])

export function motionOf(main: ItemPart | null): Motion {
  if (!main) return 'swing'
  switch (main.family) {
    case 'spear': case 'halberd': case 'glaive': case 'harpoon': case 'banner':
      return 'thrust'
    case 'bow':
      return 'shoot'
    case 'staff': case 'wand': case 'sceptre': case 'grimoire':
      return 'cast'
    default:
      return 'swing'
  }
}

export function gripOf(main: ItemPart | null, off: ItemPart | null): Grip {
  if (!main) return 'one'
  if (main.family === 'bow') return 'bow'
  if (TWO_HANDED.has(main.family)) return 'two'
  if (main.family === 'dagger' && (main.p?.variant === 'twin' || off?.family === 'dagger' || off?.family === 'offDagger')) return 'twin'
  return 'one'
}

/** Does the main item take both hands (the off hand must stay free)? */
export const takesBothHands = (main: ItemPart | null): boolean => !!main && (TWO_HANDED.has(main.family) || main.family === 'bow')

// ── state ──────────────────────────────────────────────────────────────────

export type Status = 'hasted' | 'slowed' | 'stunned' | 'buffed'
export const STATUSES: readonly Status[] = ['hasted', 'slowed', 'stunned', 'buffed']

/** The tells a skill can put on a hero. A skill with none draws nothing. */
export type Tell = 'banner' | 'burn' | 'frost' | 'venom' | 'spark' | 'rage' | 'keen' | 'bloom'
export const TELLS: readonly Tell[] = ['banner', 'burn', 'frost', 'venom', 'spark', 'rage', 'keen', 'bloom']

/** Roster skill → tell (`peoples/roster.json`). */
export const SKILL_TELL: Readonly<Record<string, Tell>> = {
  'Banner Bearer': 'banner', Rally: 'banner',
  'Spicy Peps': 'burn', Wildfire: 'burn', Firebrand: 'burn', 'Warden of Ash': 'burn',
  Frostbite: 'frost', 'Cold Snap': 'frost', Snare: 'frost',
  'Poisoned Tips': 'venom', 'Venom Spit': 'venom', Hexblade: 'venom',
  'Arc Spark': 'spark', Stormcaller: 'spark', "Tinker's Spark": 'spark',
  Bloodrush: 'rage', Berserk: 'rage', 'Killing Spree': 'rage', 'Blood Price': 'rage',
  'Keen Eye': 'keen', Deadeye: 'keen', 'Long Shot': 'keen',
  Thornbloom: 'bloom', Overgrowth: 'bloom', Blessing: 'bloom',
}

export interface HeroState {
  /** The rarity of each worn piece. */
  rarity?: Partial<Record<HandSlot, Rarity>>
  /** The hero's level: sets the cape's tier ({@link capeTier}). */
  level?: number
  /** Skills by name (roster names) or tells directly. */
  skills?: readonly string[]
  status?: readonly Status[]
  /** Low on health. */
  wounded?: boolean
}

/** Cape tier by level: 0 none, 1 short, 2 long, 3 long with a trimmed hem and a clasp. */
export function capeTier(level: number | undefined): 0 | 1 | 2 | 3 {
  const l = level ?? 1
  return l >= 8 ? 3 : l >= 5 ? 2 : l >= 3 ? 1 : 0
}

export function tellsOf(state: HeroState | undefined): Set<Tell> {
  const out = new Set<Tell>()
  for (const s of state?.skills ?? []) {
    const t = (TELLS as readonly string[]).includes(s) ? (s as Tell) : SKILL_TELL[s]
    if (t) out.add(t)
  }
  return out
}

/**
 * Which layers each kind of state may change — the contract the tests hold
 * the compositor to. Anything not listed for a state must come out
 * byte-identical when only that state changes.
 */
export const STATE_LAYERS = {
  rarityMain: ['mainItem'],
  rarityOff: ['offItem'],
  rarityBody: ['armour', 'back'],
  level: ['back'],
  banner: ['back'],
  burn: ['mainItem', 'fx'],
  frost: ['mainItem', 'fx'],
  venom: ['mainItem', 'fx'],
  spark: ['fx'],
  rage: ['fx'],
  keen: ['fx'],
  bloom: ['fx'],
  hasted: ['fx'],
  slowed: ['legs', 'fx'],
  stunned: ['head', 'fx'],
  buffed: ['fx'],
  wounded: ['head', 'fx'],
} as const satisfies Record<string, readonly LayerId[]>

// ── company liveries ───────────────────────────────────────────────────────

/** The hiring company's colours: the cloth and trim inks a hire wears. */
export interface Livery {
  cloth: RampId
  trim: RampId
}
export const LIVERIES: Readonly<Record<string, Livery>> = {
  /** The pack's own knights (no company). */
  neutral: { cloth: 'teal', trim: 'cream' },
  Peppercorn: { cloth: 'red', trim: 'gold' },
  Rosethread: { cloth: 'rose', trim: 'linen' },
  Ironvein: { cloth: 'navy', trim: 'ember' },
  Butcherblock: { cloth: 'oxblood', trim: 'bone' },
  Greenvial: { cloth: 'leaf', trim: 'aqua' },
  'Easel House': { cloth: 'plum', trim: 'cream' },
  Moonquill: { cloth: 'navy', trim: 'hairSilver' },
}

// ── the spec ───────────────────────────────────────────────────────────────

export type PaletteSlot = 'cloth' | 'trim' | 'metal' | 'leather' | 'pants'

export interface HeroLook {
  race: RaceId
  /** Head variant (race face): see `RACE_HEADS`. */
  head?: string
  /** Hair / headgear variant: see `RACE_HAIR`. */
  hair?: string
  skin?: RampId
  hairInk?: RampId
  /** Explicit inks; win over the company's. */
  palette?: Partial<Record<PaletteSlot, RampId>>
  /** The hiring company (a `LIVERIES` key). */
  company?: string
  gear?: { main?: string | null; off?: string | null; body?: string | null }
  state?: HeroState
}

/** A stable cache key for a look (same look → same key, any field order). */
export function lookKey(l: HeroLook): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])])) : v
  return JSON.stringify(sort(l))
}
