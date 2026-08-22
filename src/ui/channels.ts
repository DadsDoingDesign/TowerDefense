import { RARITY, RARITY_ORDER } from '../game/data/items'
import type { FocusMode, Item, ItemRarity } from '../game/types'

/**
 * The vocabulary both UIs draw from: non-colour channels, the tokens that carry
 * the colour one (M27c, M34), and the handful of labels that must not differ
 * between the Root Shell and the `?shell=0` screens.
 *
 * It lives at `src/ui/` rather than `src/ui/shell/` (L3) because it is not a
 * shell module — `src/ui/components/` and `src/ui/screens/` both import it, and
 * a module three sibling directories reach into should not sit inside one of
 * them. Every time a caller kept a private copy instead of importing, the copy
 * went stale: three of them were still drawing rogue as `✦` long after `✦` had
 * been reserved for Watch Marks alone.
 *
 * Two problems, one file.
 *
 * **Rarity and archetype were colour-only.** A pack tile said "legendary" with
 * a border hue and nothing else; a hero card said "mystic" with a rail hue and
 * nothing else. That is no signal at all to a player who cannot separate those
 * hues, and `title=` — the shell's fallback everywhere — does not exist on a
 * touch device. So every rarity now also carries an INITIAL and a pip count,
 * and every hero carries its archetype glyph.
 *
 * **The hues were hardcoded past the token layer.** `RARITY[r].color` and
 * `sentinel.color` are hex strings from `src/game/data/`, so they went straight
 * into inline styles and no stylesheet could touch them — which meant a
 * colour-vision mode could never re-tint the two ramps that most need it.
 * Reading them through `var(--rarity-*)` / `var(--fighter|rogue|mystic)`
 * instead puts them back under `global.css`, where `:root[data-vision]`
 * redefines them. The hex values in `items.ts` and `sentinels.ts` remain the
 * source of truth for the DEFAULT palette; `--rarity-*` in `global.css`
 * mirrors them, and `assertRarityTokensMatch` below shouts in dev if the two
 * ever drift — the failure mode this replaces is a ramp that silently means
 * two different things in two files (DESIGN_SYSTEM §3.1).
 */

/** The rarity ramp as CSS custom properties, so the vision modes can re-tint. */
export const rarityVar = (r: ItemRarity): string => `var(--rarity-${r})`

/**
 * Dev-only guard that `--rarity-*` still equals `RARITY[r].color`. It reads the
 * *computed* token, so it also catches a token that was deleted or misspelt.
 * Skipped when a colour-vision mode is on, where disagreeing is the point.
 */
export function assertRarityTokensMatch(): void {
  if (typeof document === 'undefined') return
  if ((document.documentElement.dataset.vision ?? 'default') !== 'default') return
  const cs = getComputedStyle(document.documentElement)
  for (const r of RARITY_ORDER) {
    const token = cs.getPropertyValue(`--rarity-${r}`).trim().toLowerCase()
    if (token && token !== RARITY[r].color.toLowerCase()) {
      console.warn(`[channels] --rarity-${r} is ${token} but items.ts says ${RARITY[r].color}`)
    }
  }
}

/** One letter, so rarity survives with the colour switched off entirely. */
export const RARITY_INITIAL: Record<ItemRarity, string> = {
  common: 'C',
  rare: 'R',
  epic: 'E',
  legendary: 'L',
  mythic: 'M',
}

/** 1–5. Drawn as pips, so the ramp is also readable as a COUNT. */
export const rarityRank = (r: ItemRarity): number => RARITY_ORDER.indexOf(r) + 1

/**
 * The archetype hue as a token. `sentinel.color` is the same value as a raw
 * hex; going through the token is what lets the colour-vision modes move it.
 */
export const archetypeVar = (archetype: string): string =>
  archetype === 'fighter' || archetype === 'rogue' || archetype === 'mystic' ? `var(--${archetype})` : 'var(--line-strong)'

/**
 * The archetype glyph.
 *
 * Rogue used to be `✦` — the same mark as Watch Marks, attribute rewards, perks
 * and mutations, five meanings on one glyph and twice on some screens
 * (DESIGN_SYSTEM §6 flags the overload). `✦` now means Watch Marks and nothing
 * else; rogue took `➶`, which reads as the ranged skirmisher it is.
 */
export const ARCHETYPE_GLYPH: Record<string, string> = { fighter: '⚔', rogue: '➶', mystic: '❋' }

/** Currency marks. `✦` is Watch Marks — only Watch Marks. */
export const CURRENCY_GLYPH = { gold: '⟡', dust: '◈', marks: '✦' } as const

/**
 * The four targeting orders, named once (L3).
 *
 * `tactics.focus` is ONE rule the engine applies to every Sentinel on the
 * field, so the two UIs describing it differently is a correctness problem, not
 * a style one. There were three tables: the shell's four abbreviations, the
 * shell's `FOCUS_FULL` expansions used as accessible names, and the legacy
 * panel's own `hint` strings, which disagreed with both ("Closest to the base"
 * for a rule the engine reads as first-in-lane; "Closest to the tower" for one
 * it reads as nearest-to-the-Sentinel).
 *
 * `label` is what fits a 4–6 character segmented button; `full` is the
 * unabbreviated name, used as the accessible name in the shell and as the hint
 * line in the legacy panel. The shell's wording is the one that ships.
 */
export const FOCUS_OPTS: readonly { id: FocusMode; label: string; full: string }[] = [
  { id: 'first', label: 'First', full: 'First in the lane' },
  { id: 'lowestHp', label: 'Low HP', full: 'Lowest health' },
  { id: 'strongest', label: 'Strong', full: 'Strongest' },
  { id: 'nearest', label: 'Near', full: 'Nearest to the Sentinel' },
]

/** The unabbreviated focus name, by id. */
export const focusFull = (f: FocusMode): string => FOCUS_OPTS.find((o) => o.id === f)?.full ?? f

/* ==========================================================================
 * The icon layer (P3)
 * ========================================================================== */

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
export const ICON_ROWS = 10

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
  if (i < 0) throw new Error(`[channels] unknown icon key '${k}' — not in ICON_ORDER`)
  return { ix: i % ICON_COLS, iy: Math.floor(i / ICON_COLS) }
}

/**
 * The text an icon stands in for, where a render site has to SAY it.
 *
 * `Icon` is `aria-hidden` everywhere and the rule that makes that safe is that
 * the meaning is always already in text nearby. Three sites broke it (M11) —
 * the pack tile, the offer card and the menu row all drew `damageMark` as the
 * only statement of an item's damage type, and none of their accessible names
 * mentioned it. This is what they append. Deliberately not a table over every
 * key: an entry here is a promise that some control's accessible name is built
 * from it, and a map of 71 unused strings would rot.
 */
export const ICON_LABEL: Partial<Record<IconKey, string>> = {
  phys: 'physical damage',
  magic: 'magic damage',
  boss: 'boss',
}

/** The damage type in words — the text half of the `damageMark` channel. */
export const markLabel = (k: IconKey | null | undefined): string => (k ? (ICON_LABEL[k] ?? '') : '')

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
 * branch order, and the icon is looked up from what it captured. The two
 * cannot disagree about which noun a name carries, because they are asking the
 * same question in the same language. `Sceptre` is carried here and not there
 * only because nothing generates it — the spelling in `WEAPONS` is `Scepter` —
 * and a table that quietly drops a spelling is how this started.
 */
const NOUN_RE =
  /(Greatsword|Sword|Axe|Dagger|Wand|Rod|Scepter|Sceptre|Warhammer|Bow|Staff|Grimoire|Shield|Buckler|Tome|Quiver|Focus|Plate|Mail|Robe|Cloak|Aegis|Banner|Standard|Relic|Beacon|Oath)/

const NOUN_ICON: Record<string, IconKey> = {
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

/**
 * Physical or magic — and `null` for anything that deals neither.
 *
 * This is the property that decides whether a drop is worth anything to a given
 * hero (TNT goblins shrug off 15–25% of magic, barrel goblins 15–35% of
 * physical) and it had no visual channel anywhere in the game. It is read off
 * `item.base`, which is what the engine reads, rather than off the noun — a
 * hand-built or reforged item cannot end up marked as something it is not.
 *
 * Off-hands and body armour deal no damage at all, so they get no mark. A blank
 * corner means "this does not have a damage type", which is true and useful;
 * stamping every item would make the mark noise.
 */
export function damageMark(item: Pick<Item, 'base'>): IconKey | null {
  if (item.base.magDamage) return 'magic'
  if (item.base.physDamage) return 'phys'
  return null
}

/**
 * One icon for one line of generated effect text.
 *
 * `describeMods`, `describeBase` and `describeEnchant` (`src/game/data/`) are
 * the single source of every effect sentence in the game, and they are read on
 * the hero panel, on 39 tree nodes, on 11 mutations, on 9 upgrade levels, on 16
 * reward cards, on 6 shrines and in every item detail. Classifying their OUTPUT
 * here rather than changing them means one table lights all of it up, and the
 * data layer stays owned by the people who own the data layer.
 *
 * ---------------------------------------------------------------------------
 * Leftmost wins, not first-listed (M10)
 * ---------------------------------------------------------------------------
 * This used to return the first rule in the list that matched anywhere, which
 * is the right answer for ONE effect and the wrong one for a sentence carrying
 * several. A sentence carrying several is what an enchant renders as, whole:
 *
 *   `Reckless — +85% damage, −45% attack speed`   → stamped `haste`
 *   `Wild — +25% crit chance, … −25% attack speed …` → stamped `haste`
 *
 * `attack speed` sat at index 9 and outranked `crit` at 11 and `damage` at 25,
 * so the two most punishing curses in the game — the three slowest items a
 * player can own — advertised themselves with speed-lines. Reading the line
 * left to right instead gives the effect the SENTENCE leads with, which is the
 * one `describeMods` puts first and the one the player reads first.
 *
 * Order is still load-bearing, but only as the tie-break at a single position,
 * and every entry that looks redundant is still not: `−22% melee damage taken
 * while blocking` contains "damage"; `executes below 12% HP` contains "HP";
 * `life-drain: +0.4 base HP per 100 damage` contains both; `starts at 30% less
 * HP for +30% damage` contains both again. Each of those specific phrases
 * begins at or before the generic word it embeds, so leftmost-wins keeps them —
 * and the list order settles the exact ties (`Physical Damage` and `damage`
 * both start at "Physical"? no — but `crit chance` and `crit damage` do share
 * a start, and the ordering is what picks one).
 *
 * ---------------------------------------------------------------------------
 * Sign, because `−45%` and `+20%` are not the same fact
 * ---------------------------------------------------------------------------
 * There was no polarity channel at all, so `−45% attack speed` and `+20% attack
 * speed` produced an identical picture, and every two-handed weapon in the game
 * (`−8% Attack Speed`, straight off `describeBase`) wore a speed-line. On the
 * merchant board — the screen that is supposed to be answerable before you read
 * a word — that is the picture actively arguing for the wrong purchase.
 * `POLARITY` below maps a directional cell onto its mirror. It used to hold two
 * entries, under a claim that everything absent was "a fact without a direction
 * (`splash radius`, `range`, `HP`, `pierces`)" — and three of those four are
 * written WITH a sign by the very function that emits them, so `−70 splash
 * radius` shipped wearing the picture for `+34 splash radius` (M3). Ten
 * concepts carry a sign; all ten are in the table now, and the two deliberate
 * absentees are argued for at `POLARITY` itself.
 *
 * Returns `null` for anything unrecognised — a pure stat grant (`+8 STR`), the
 * stacking rule, an authored blurb — and the caller then renders exactly what
 * it rendered before. There is no "unknown" icon on purpose: a wrong picture is
 * worse than no picture.
 */
const EFFECT_RULES: [RegExp, IconKey][] = [
  // -- phrases that embed a more generic word, first ------------------------
  [/melee damage taken while blocking/i, 'armour'],
  [/executes below/i, 'execute'],
  [/life-?drain/i, 'lifedrain'],
  [/starts at .* less HP/i, 'sacrifice'],
  [/lays traps/i, 'trap'],
  [/heals allies/i, 'auraHeal'],
  [/buffs allies/i, 'auraBuff'],
  [/shields allies/i, 'auraShield'],
  [/projectile speed/i, 'projectile'],
  [/attack speed/i, 'haste'],
  [/keepsake/i, 'keepsake'],
  // -- the plain ones -------------------------------------------------------
  // `never crits` says its own sign in words and has no number for `signOf`
  // to read, so it cannot reach `nocrit` through `POLARITY`
  // and needs a rule of its own. It has to sit BEFORE the crit rule: both
  // match at index 0 on the bare line, and the tie at a position goes to
  // whichever rule is listed first. `cx_frenzied` and `cx_vengeful` are what
  // print it.
  [/never crits/i, 'nocrit'],
  [/crit chance|crit damage|% Crit/i, 'crit'],
  [/\bburns?\b/i, 'burn'],
  [/\bchills?\b/i, 'chill'],
  [/chains to/i, 'shock'],
  [/to stun\b/i, 'stun'],
  [/\bblocks \d/i, 'block'],
  [/\bthorns\b/i, 'thorns'],
  [/\bpierces\b/i, 'pierce'],
  [/splash/i, 'splash'],
  [/\bpatience\b/i, 'patience'],
  [/Physical Damage/i, 'phys'],
  [/Magic Damage/i, 'magic'],
  [/\brange\b/i, 'range'],
  [/\bHP\b/i, 'hp'],
  [/\bdamage\b|\bdmg\b/i, 'damage'],
]

/**
 * The cells that mean "this number went the other way".
 *
 * ---------------------------------------------------------------------------
 * Two of ten was not a polarity channel (M3)
 * ---------------------------------------------------------------------------
 * This table held `haste` and `damage` and stopped there, under a comment
 * claiming everything absent was "a fact without a direction (`splash radius`,
 * `range`, `HP`, `pierces`)". Three of those four carry a sign in the very
 * sentence that names them, written by `describeMods` itself:
 *
 *   `if (m.splashAdd) out.push(`${m.splashAdd >= 0 ? '+' : ''}${m.splashAdd} splash radius`)`
 *
 * So `−70 splash radius` — `cx_wild`, whose own source comment says it "zeroes
 * a Stormcaller's 83px blast" — was drawn with the picture for `+34 splash
 * radius`, on the merchant board, which `offers.ts` calls the one screen that
 * has to be answerable before you read a word.
 *
 * The full set of sign-carrying concepts, counted off `describeMods` and
 * `describeBase` rather than guessed, is TEN. All ten are here now except two
 * that must not be here, and both exclusions are load-bearing:
 *
 *  - **`armour`** — `−22% melee damage taken while blocking` is written with a
 *    minus and is a BONUS. `physDefAdd` never goes negative in any producer,
 *    and the minus belongs to the damage-taken figure rather than to the stat.
 *    Flipping it would invert the one line in the game whose sign is already
 *    inverted in the words.
 *  - **`sacrifice`** — `starts at 30% less HP for +30% damage` is a cost and a
 *    benefit in one sentence. It has no single direction, which is exactly why
 *    it has a cell of its own.
 *
 * `pierce`, `execute`, `lifedrain`, `trap`, `block` and the four statuses take
 * no entry because their sentences carry no sign at all — `pierces 2 extra
 * enemies` cannot be negative and never will be.
 *
 * `never crits` reaches `nocrit` through a rule rather than through this table:
 * it has no number in front of it, so `negativeBefore` has nothing to read.
 */
const POLARITY: Partial<Record<IconKey, IconKey>> = {
  haste: 'slow',
  damage: 'weaken',
  hp: 'frail',
  range: 'shorten',
  projectile: 'drag',
  splash: 'shrink',
  crit: 'nocrit',
  thorns: 'blunt',
  auraBuff: 'auraWeaken',
}

/**
 * Which way does the number attached to the matched phrase point?
 *
 * `-1` negative, `1` positive, `0` no number at all — a bare authored phrase,
 * which keeps the plain cell. Both the typographic minus `−` that
 * `describeMods` writes and a plain hyphen count, because only one of those is
 * guaranteed: `describeMods` uses `−` for `physDefAdd` and a plain `-` for
 * everything `signPct` touches.
 *
 * ---------------------------------------------------------------------------
 * The number is usually before the phrase. Once, it is inside it.
 * ---------------------------------------------------------------------------
 * This used to be `negativeBefore`, and it only walked BACKWARDS — which is the
 * right and sufficient answer for nine of the ten signed concepts, because
 * `describeMods` writes them as `${sign}${number} ${noun}`:
 *
 *   `−70 splash radius`   `-15% HP`   `−8% Attack Speed`   `+25% crit chance`
 *
 * The tenth is `buffs allies −20% dmg`, where the phrase LEADS and its number
 * sits after it. A backwards-only reader finds nothing in front of index 0,
 * calls that "no sign", and hands back the positive cell for a debuff.
 *
 * So the forward scan is a FALLBACK, reached only when the backwards walk found
 * no sign character at all, and it is bounded by the next comma. That bound is
 * the part that matters: `+34 splash radius, −18% damage` must not let the
 * second clause's minus reach the first clause's phrase, and an unbounded
 * forward scan is exactly how it would.
 */
function signOf(line: string, at: number, end: number): -1 | 0 | 1 {
  let i = at - 1
  while (i >= 0 && /[\s\d.,%]/.test(line[i])) i--
  if (i >= 0) {
    if (line[i] === '−' || line[i] === '-') return -1
    if (line[i] === '+') return 1
  }
  const stop = line.indexOf(',', end)
  const m = /([+\-−])\d/.exec(line.slice(end, stop < 0 ? line.length : stop))
  if (m) return m[1] === '+' ? 1 : -1
  return 0
}

export function effectIcon(line: string): IconKey | null {
  let best: IconKey | null = null
  let bestAt = Infinity
  let bestEnd = 0
  for (const [re, key] of EFFECT_RULES) {
    const m = re.exec(line)
    if (!m) continue
    // Strictly less-than: the first rule to claim a position keeps it, which is
    // what makes the specific-before-generic ordering above still decide ties.
    if (m.index < bestAt) {
      bestAt = m.index
      bestEnd = m.index + m[0].length
      best = key
      if (bestAt === 0) break
    }
  }
  if (!best) return null
  const flipped = POLARITY[best]
  return flipped && signOf(line, bestAt, bestEnd) < 0 ? flipped : best
}
