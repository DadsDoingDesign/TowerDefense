/**
 * The Fieldwatch icon atlas — one PNG, 78 icons, drawn in the Tiny Swords hand.
 *
 * Run with `npm run fw-icons` to REWRITE the committed
 * `public/assets/ui/fw-icons.png`; `npm run fw-icons:check` re-encodes into
 * memory and compares instead, and that is the form `npm run build` runs. The
 * build still generates no images — the check writes nothing — so `sharp` stays
 * a dev-only dependency (same contract as `scripts/icons.ts`).
 *
 * ---------------------------------------------------------------------------
 * Why this file exists
 * ---------------------------------------------------------------------------
 * The item and status layer of the UI was 100% Unicode. 57 item concepts shared
 * four glyphs; 28 statuses and abilities had no mark at all; and eleven glyphs
 * carried two or more meanings apiece. A drop's *damage type* — the single
 * property that decides whether it is worth anything to a given hero — had no
 * visual channel anywhere in the game.
 *
 * ---------------------------------------------------------------------------
 * The style, MEASURED rather than assumed
 * ---------------------------------------------------------------------------
 * Every number below came off the shipped CC0 sprites (see the probe in
 * `docs/DESIGN_REVIEW.md`, 2026-08-21), and two of them contradict the folklore
 * this file was briefed with:
 *
 *  - **The outline is `#161C2E`, fully opaque, and it is the strongest tell.**
 *    All 68 files in `public/assets/ui/tinyswords/` use it; it accounts for
 *    247,849 of the opaque pixels across the whole 243-file harvest.
 *  - **There is no 1px outer halo at alpha 80.** What alpha 80 actually draws is
 *    a *ground shadow* — an ellipse under the object, present on the three
 *    128×128 pickups and nowhere else. The 30 system icons instead use alpha
 *    **100** for their interior fill and 255 only for the outline, which is a
 *    different device again (they are drawn to sit on a light button).
 *    Reproducing a nonexistent halo would have been the foreign-looking choice.
 *  - **Density is 1×.** No file in the kit is a scaled-up block grid, so these
 *    are authored as real pixels too and displayed at integer multiples only.
 *
 * So what an icon here reproduces is: an opaque `#161C2E` silhouette outline, a
 * tiny palette taken from the harvest itself, and a ground shadow of
 * `#161C2E` at alpha 80 where the object reads as sitting on something.
 *
 * ---------------------------------------------------------------------------
 * Authoring
 * ---------------------------------------------------------------------------
 * Each icon is 16 rows × 16 columns of palette characters and holds only the
 * **interior**. `outline()` walks the grid afterwards and paints `#161C2E` into
 * every transparent pixel that touches a filled one, which is what makes the
 * silhouette ring uniform across 78 hand-drawn shapes instead of 78 separate
 * attempts at the same 1px border. Art must therefore stay inside rows/cols
 * 1..14 so the ring has somewhere to go; `assert` below enforces it.
 *
 * 16×16 is the display contract as well as the authoring one: the atlas is
 * shown at 16 CSS px or 32 CSS px and never in between, because a pixel-art
 * icon at a non-integer scale is a blurred icon (`image-rendering: pixelated`
 * turns that blur into uneven columns instead, which is worse).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'ui')

/**
 * `--check` re-encodes into memory and compares, writing nothing. That is what
 * `npm run build` runs: the atlas, `channels.ts` and `global.css` are three
 * files that have to agree and only one of them is compiled, so the agreement
 * has to be a build step rather than a habit.
 */
const CHECK = process.argv.includes('--check')

/** The Tiny Swords outline. Opaque, and the same on every icon. */
const OUTLINE = '#161c2e'

/**
 * The working palette. Every entry is a colour that occurs in the harvested
 * CC0 set (`public/assets/CC0-MANIFEST.md`) — no invented hues, so a new icon
 * cannot drift out of the pack's colour space.
 */
const PALETTE: Record<string, string> = {
  K: OUTLINE,
  W: '#fffce7', // cream highlight
  S: '#bac1c8', // steel light
  s: '#737f8e', // steel mid
  d: '#4a6982', // steel dark
  P: '#e1d4bd', // parchment light
  p: '#ccb88d', // parchment mid
  q: '#9e8776', // parchment dark
  G: '#ffed44', // gold light
  g: '#d08c41', // gold mid
  h: '#a38250', // gold dark
  T: '#8cc3c4', // teal light
  t: '#47aba9', // teal mid
  u: '#27716f', // teal dark
  R: '#f76666', // red light
  r: '#b65555', // red mid
  n: '#87465a', // red dark
  L: '#b48355', // leather light
  l: '#866353', // leather mid
  o: '#6f5a48', // leather dark
  E: '#95d562', // green light
  e: '#38b251', // green mid
  f: '#276740', // green dark
  V: '#a8719a', // violet light
  v: '#775396', // violet mid
}

const N = 16
const COLS = 8

type Art = string[]

/**
 * The atlas, in grid order. The KEY is what `src/ui/channels.ts` names, and the
 * order here IS the cell order — moving a row moves the sprite, so append
 * rather than reorder.
 */
const ICONS: [string, Art][] = []
const icon = (key: string, art: Art) => ICONS.push([key, art])

/* ------------------------------------------------------ row 0 · status A */

icon('burn', [
  '................',
  '................',
  '.......R........',
  '......RR........',
  '......RRR.......',
  '.....RRRR.......',
  '.....RRGR.......',
  '....RRGGGR......',
  '....RGGGGR......',
  '...RRGGWGGR.....',
  '...RGGWWWGR.....',
  '...RGGWWWGR.....',
  '...RRGGGGGR.....',
  '....RRGGGRR.....',
  '.....RRRRR......',
  '................',
])

icon('chill', [
  '................',
  '................',
  '.......TT.......',
  '....T..TT..T....',
  '.....T.TT.T.....',
  '......TTTT......',
  '..TTT.TWWT.TTT..',
  '....TTTWWTTT....',
  '....TTTWWTTT....',
  '..TTT.TWWT.TTT..',
  '......TTTT......',
  '.....T.TT.T.....',
  '....T..TT..T....',
  '.......TT.......',
  '................',
  '................',
])

icon('shock', [
  '................',
  '................',
  '........GG......',
  '.......GGG......',
  '......GGG.......',
  '.....GGG........',
  '....GGGG........',
  '...GGGGGGG......',
  '......GGGG......',
  '.......GGG......',
  '......GGG.......',
  '.....GGG........',
  '....GGG.........',
  '...GG...........',
  '................',
  '................',
])

/**
 * Seeing stars — three of them, and no disc.
 *
 * The first version was a filled yellow roundel with a lighter figure inside
 * it, and `gold` is a filled yellow roundel with a lighter figure inside it. At
 * 16px the figure is four pixels wide and carries nothing; what the eye gets is
 * "yellow circle" twice, on a screen where one of them means a currency you are
 * about to spend. The stagger convention costs nothing and cannot collide: three
 * separate five-pixel crosses have a silhouette no single-body icon can imitate.
 */
icon('stun', [
  '................',
  '................',
  '.......G........',
  '.......G........',
  '.....GGGGG......',
  '.......G........',
  '.......G........',
  '................',
  '...G........G...',
  '...G........G...',
  '.GGGGG....GGGGG.',
  '...G........G...',
  '...G........G...',
  '................',
  '................',
  '................',
])

icon('execute', [
  '................',
  '................',
  '...SSSSSSSSS....',
  '...SWWWWWWWS....',
  '...SWWWWWWWS....',
  '....SWWWWWS.....',
  '.....SWWWS......',
  '......SWS.......',
  '.......S........',
  '................',
  '..rrrrrrrrrrr...',
  '..rrrrrrrrrrr...',
  '................',
  '................',
  '................',
  '................',
])

icon('lifedrain', [
  '................',
  '................',
  '.......R........',
  '......RRR.......',
  '.....RRRRR......',
  '....RRRWRRR.....',
  '....RRRWRRR.....',
  '...RRRRWRRRR....',
  '...RRRRRRRRR....',
  '...RRRRRRRRR....',
  '...rRRRRRRRr....',
  '....rRRRRRr.....',
  '.....rrrrr......',
  '................',
  '................',
  '................',
])

icon('crit', [
  '................',
  '................',
  '.......R........',
  '.......R........',
  '......RGR.......',
  '.R....RGR....R..',
  '..RR.RGGGR.RR...',
  '...RRGGWGGRR....',
  '.RRRRGGWGGRRRR..',
  '...RRGGWGGRR....',
  '..RR.RGGGR.RR...',
  '.R....RGR....R..',
  '......RGR.......',
  '.......R........',
  '................',
  '................',
])

/**
 * A blast INSIDE a radius, not an eight-rayed star.
 *
 * The first version was a gold burst with eight symmetric rays and a white
 * core — which is `marks`, the meta currency, drawn slightly fatter. A combat
 * effect and the thing you spend between runs must not be the same picture, and
 * `marks` owns the star: `✦` has meant Watch Marks and only Watch Marks since
 * Phase 2 and the sprite has to keep that promise. Splash keeps the gold but
 * spends it on a dashed containing ring and puts a RED detonation in the middle
 * — two elements instead of one, and the only red-inside-gold cell in the sheet.
 */
icon('splash', [
  '................',
  '................',
  '................',
  '.....gg..gg.....',
  '...gg......gg...',
  '..g...RRRR....g.',
  '..g..RRWWRR...g.',
  '.....RRWWRR.....',
  '..g..RRRRRR...g.',
  '..g...RRRR....g.',
  '...gg......gg...',
  '.....gg..gg.....',
  '................',
  '................',
  '................',
  '................',
])

/* ------------------------------------------------------ row 1 · status B */

icon('block', [
  '................',
  '................',
  '...SSSSSSSSS....',
  '...SWWSSSSSS....',
  '...SWWSSSSSS....',
  '...uuuuuuuuu....',
  '...SSSSSSSSd....',
  '...SSSSSSSSd....',
  '....SSSSSSd.....',
  '.....SSSSd......',
  '......SSd.......',
  '.......d........',
  '................',
  '................',
  '................',
  '................',
])

/**
 * A steel caltrop, not a parchment burr. The first version used the two
 * parchment tones, which is fine on the warm panel and nearly invisible on the
 * hero-pick trait tile — and the trait tile is a parchment square.
 */
icon('thorns', [
  '................',
  '................',
  '.......S........',
  '...S...S...S....',
  '...SS.SSS.SS....',
  '....SSSSSSS.....',
  '....SsssssS.....',
  '..SSSsssssSSS...',
  '....SsssssS.....',
  '....SSSSSSS.....',
  '...SS.SSS.SS....',
  '...S...S...S....',
  '.......S........',
  '................',
  '................',
  '................',
])

icon('pierce', [
  '................',
  '................',
  '................',
  '................',
  '....r...r.......',
  '....r...r..SS...',
  '....r...r.SSS...',
  '.lllrlllrlSSSS..',
  '.lllrlllrlSSS...',
  '....r...r..SS...',
  '....r...r.......',
  '................',
  '................',
  '................',
  '................',
  '................',
])

/**
 * A great helm — and it took three tries to get here, which is the point of
 * rendering rather than assuming.
 *
 * v1 was three tapering steel bands (scale armour, in principle). At 16px on a
 * real settings row it read as a **hamburger menu** — the exact failure this
 * pass exists to remove: a picture that says something other than what it
 * means. v2 was a breastplate, which reads correctly but is the same object as
 * `plate`, the heavy-body item kind, so the collision just moved. A helm is
 * unmistakably armour, is nothing else in the set, and — unlike the other two —
 * survives being 16 pixels tall.
 */
/**
 * A CRESTED helm with one visor slot. Not a skull, and not a stack of bars.
 *
 * The first version was a great helm with two dark eye slits and a dark
 * breathing grid under them. That is a cranium: at the shipped 16px it was
 * indistinguishable from `boss` (a parchment skull with two dark eyes and dark
 * teeth), which is the same defect class as the scale-armour mail that read as
 * a hamburger menu.
 *
 * What makes a skull is TWO HOLES AND A MOUTH, so both had to go. A single
 * T-visor is one dark shape rather than three, and the red crest above the dome
 * is the tell no skull has — a plume says the thing is WORN. The first attempt
 * at this fix went the other way and drew a banded pauldron instead; rendered,
 * three grey bars stacked with dark lines between them is a hamburger menu,
 * which is the exact failure this pass had already caught once. Steel, plus a
 * crest, plus one slot.
 */
icon('armour', [
  '................',
  '.......R........',
  '......RRR.......',
  '.....RRRRR......',
  '....SSSSSSSS....',
  '...SSSSSSSSSS...',
  '..SSSSSSSSSSSS..',
  '..SSSKKKKKSSSS..',
  '..SSSSSKSSSSSS..',
  '..SSSSSKSSSSSS..',
  '..SSSSSSSSSSSS..',
  '...SSSSSSSSSS...',
  '....SSSSSSSS....',
  '.....SSSSSS.....',
  '................',
  '................',
])

icon('damage', [
  '................',
  '................',
  '................',
  '..........RR....',
  '.......R.RRR....',
  '......RR.RR..R..',
  '.....RR.RR..RR..',
  '....RR.RR..RR...',
  '...RR.RR..RR....',
  '..RR.RR..RR.....',
  '..R.RR..RR......',
  '....R..RR.......',
  '.......R........',
  '................',
  '................',
  '................',
])

icon('range', [
  '................',
  '................',
  '.......T........',
  '.....TTTTT......',
  '....TT...TT.....',
  '...TT..T..TT....',
  '..TT..TTT..TT...',
  '.TT.TTTWTTT.TT..',
  '..TT..TTT..TT...',
  '...TT..T..TT....',
  '....TT...TT.....',
  '.....TTTTT......',
  '.......T........',
  '................',
  '................',
  '................',
])

icon('haste', [
  '................',
  '................',
  '.....G...G......',
  '....GG..GG......',
  '...GG..GG.......',
  '..GG..GG........',
  '.GG..GG.........',
  '..GG..GG........',
  '...GG..GG.......',
  '....GG..GG......',
  '.....G...G......',
  '................',
  '................',
  '................',
  '................',
  '................',
])

icon('hp', [
  '................',
  '................',
  '...RR......RR...',
  '..RRRRR..RRRRR..',
  '.RRWRRRRRRRRRRR.',
  '.RWRRRRRRRRRRRR.',
  '.RRRRRRRRRRRRRR.',
  '..RRRRRRRRRRRR..',
  '...RRRRRRRRRR...',
  '....RRRRRRRR....',
  '.....RRRRRR.....',
  '......RRRR......',
  '.......RR.......',
  '................',
  '................',
  '................',
])

/* ------------------------------------------------------ row 2 · status C */

icon('auraHeal', [
  '................',
  '................',
  '....EE....EE....',
  '..EE........EE..',
  '.E....EEEE....E.',
  '.....EEEEEE.....',
  '.E...EEWWEE...E.',
  '...EEEEWWEEEE...',
  '...EEEEWWEEEE...',
  '.E...EEWWEE...E.',
  '.....EEEEEE.....',
  '.E....EEEE....E.',
  '..EE........EE..',
  '....EE....EE....',
  '................',
  '................',
])

icon('auraBuff', [
  '................',
  '................',
  '....GG....GG....',
  '..GG...G....GG..',
  '.G....GGG.....G.',
  '.....GGGGG......',
  '.G...GGGGG....G.',
  '.......G........',
  '.......G........',
  '.G.....G......G.',
  '.......G........',
  '.G............G.',
  '..GG........GG..',
  '....GG....GG....',
  '................',
  '................',
])

icon('auraShield', [
  '................',
  '................',
  '....TT....TT....',
  '..TT........TT..',
  '.T...TTTTTT...T.',
  '.....TTTTTT.....',
  '.T...TTWWTT...T.',
  '.....TTTTTT.....',
  '.....uTTTTu.....',
  '.T....uTTu....T.',
  '.......uu.......',
  '.T............T.',
  '..TT........TT..',
  '....TT....TT....',
  '................',
  '................',
])

icon('trap', [
  '................',
  '................',
  '................',
  '..s..........s..',
  '..ss........ss..',
  '..sSs......sSs..',
  '..ssSs....sSss..',
  '...ssSssssSss...',
  '....sssssssss...',
  '...sssssssssss..',
  '..ss.ssssss..ss.',
  '..s...ssss....s.',
  '................',
  '................',
  '................',
  '................',
])

icon('sacrifice', [
  '................',
  '................',
  '...RR......RR...',
  '..RRRRR..RRRRR..',
  '.RRWRRR..RRRRRR.',
  '.RWRRRRR..RRRRR.',
  '.RRRRRR..RRRRRR.',
  '..RRRRR..RRRRR..',
  '...RRRR..RRRR...',
  '....RRR..RRR....',
  '.....RR..RR.....',
  '......RR.R......',
  '.......RR.......',
  '................',
  '................',
  '................',
])

icon('projectile', [
  '................',
  '................',
  '................',
  '................',
  '..T.............',
  '................',
  '..TT.......S....',
  '.........SSSS...',
  '..TTT.SSSSSSSS..',
  '.........SSSS...',
  '..TT.......S....',
  '................',
  '..T.............',
  '................',
  '................',
  '................',
])

icon('patience', [
  '................',
  '................',
  '....pppppp......',
  '....pWWWWp......',
  '....pWWWWp......',
  '.....pWWp.......',
  '......pp........',
  '......pp........',
  '.....pWWp.......',
  '....pWggWp......',
  '....pWggWp......',
  '....pgggggp.....',
  '....pppppp......',
  '................',
  '................',
  '................',
])

/**
 * A CRACKED gem, not a broken ring.
 *
 * The first version was a violet annulus with a bite out of it, which at 16px
 * is a dark "C" — the same read as `bow`. This is the only cell that carries the
 * two violets, so the colour was never the problem; the outline was. A faceted
 * stone split by a black fissure keeps the hue, keeps the "something is wrong
 * with this" reading, and shares its silhouette with nothing: `dust` is a teal
 * comet and `depth` is a hollow teal lozenge.
 */
icon('curse', [
  '................',
  '................',
  '.....VVVVVV.....',
  '....VvvvvvvV....',
  '...VvvKvvvvvV...',
  '..VvvvKvvvvvvV..',
  '..VvvvvKvvvvvV..',
  '...VvvvKvvvvV...',
  '...VvvvvKvvvV...',
  '....VvvvKvvV....',
  '.....VvvKvV.....',
  '......VvKV......',
  '.......VV.......',
  '................',
  '................',
  '................',
])

/* --------------------------------------------------- row 3 · weapons, 1H */

icon('blade', [
  '................',
  '................',
  '............SS..',
  '...........SWS..',
  '..........SWSS..',
  '.........SWSS...',
  '........SWSS....',
  '.......SWSS.....',
  '......SWSS......',
  '.....SWSS.......',
  '....hSSS........',
  '...hhhhhh.......',
  '...ll.hh........',
  '..lll.h.........',
  '..ll............',
  '................',
])

icon('dagger', [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.........SS.....',
  '........SWS.....',
  '.......SWSS.....',
  '......SWSS......',
  '.....hSSS.......',
  '...hhhhhhh......',
  '....ll.hh.......',
  '...lll..........',
  '...ll...........',
  '................',
  '................',
])

/**
 * DOUBLE-BIT, because a single bit on a haft is a flag.
 *
 * The first version hung one head off a full-height shaft with a foot at the
 * bottom, which at 16px is a pole with something attached near the top — i.e.
 * the `wave` pennant. Cell (2,3) and cell (4,6) were the same picture. Angling
 * the haft did not fix it: a quadrilateral on a slanted stick is still a
 * banner, just a windier one.
 *
 * What kills the reading is SYMMETRY. A flag hangs on one side of its pole and
 * cannot do otherwise; a bit either side of the haft is an axe and cannot be
 * anything else. It costs the crescent edge — there is no room for a concave
 * bevel on a five-pixel blade — and buys a silhouette no standard can imitate.
 */
icon('axe', [
  '................',
  '................',
  '....SS.ll.SS....',
  '...SSSSllSSSS...',
  '..SSSSSllSSSSS..',
  '..SWWSSllSSSSS..',
  '..SWWSSllSSSSS..',
  '...SSSSllSSSS...',
  '....SS.ll.SS....',
  '.......ll.......',
  '.......ll.......',
  '.......ll.......',
  '.......ll.......',
  '......oooo......',
  '................',
  '................',
])

icon('wand', [
  '................',
  '................',
  '..........V.....',
  '.........VVV....',
  '..........V.....',
  '.........VvV....',
  '........Vvv.....',
  '.......Lvv......',
  '......LLL.......',
  '.....LLL........',
  '....LLL.........',
  '...oLL..........',
  '...oo...........',
  '................',
  '................',
  '................',
])

icon('sceptre', [
  '................',
  '................',
  '.........GG.....',
  '........GWWG....',
  '........GWWG....',
  '.........GG.....',
  '........hgh.....',
  '.......hgh......',
  '......hgh.......',
  '.....hgh........',
  '....hgh.........',
  '...hgh..........',
  '...hh...........',
  '................',
  '................',
  '................',
])

icon('greatblade', [
  '................',
  '..........SSS...',
  '.........SSWS...',
  '........SSWSS...',
  '.......SSWSS....',
  '......SSWSS.....',
  '.....SSWSS......',
  '....SSWSS.......',
  '...SSWSS........',
  '..hSSSS.........',
  '.hhhhhhh........',
  '..lll.hh........',
  '..lll.h.........',
  '..lll...........',
  '..ooo...........',
  '................',
])

icon('hammer', [
  '................',
  '................',
  '.....SSSSSS.....',
  '....SSWWWSSS....',
  '....SSWWWSSS....',
  '....SSWWWSSS....',
  '.....SSSSSS.....',
  '.......ll.......',
  '.......ll.......',
  '.......ll.......',
  '.......ll.......',
  '.......ll.......',
  '......oooo......',
  '................',
  '................',
  '................',
])

/**
 * The arrow is the whole point.
 *
 * The first version was a leather arc and a vertical string and nothing else,
 * which at 16px is a dark broken ring — the same read as `curse`. A bow without
 * an arrow is a letter C. The shaft now crosses the string and carries a head
 * that breaks the right edge, so the silhouette is a ring WITH A LINE THROUGH
 * IT, which no other cell in the sheet is.
 */
icon('bow', [
  '................',
  '................',
  '....lll.........',
  '...ll..S........',
  '..ll...S........',
  '..l....S........',
  '..l....S...S....',
  '..l..LLLLLLLSS..',
  '..l....S...S....',
  '..l....S........',
  '..ll...S........',
  '...ll..S........',
  '....lll.........',
  '................',
  '................',
  '................',
])

/* --------------------------------------- row 4 · weapons 2H, off-hand, body */

icon('staff', [
  '................',
  '................',
  '.........TTT....',
  '........TWWWT...',
  '........TWWWT...',
  '.........TTT....',
  '........Ll......',
  '.......Ll.......',
  '......Ll........',
  '.....Ll.........',
  '....Ll..........',
  '...Ll...........',
  '..Ll............',
  '..oo............',
  '................',
  '................',
])

icon('grimoire', [
  '................',
  '................',
  '...vvvvvvvvv....',
  '...vVVVVVVVv....',
  '...vVPPPPPVv....',
  '...vVPGGGPVv....',
  '...vVPGWGPVv....',
  '...vVPGGGPVv....',
  '...vVPPPPPVv....',
  '...vVVVVVVVv....',
  '...vvvvvvvvv....',
  '....ooooooo.....',
  '................',
  '................',
  '................',
  '................',
])

icon('shield', [
  '................',
  '................',
  '...SSSSSSSSS....',
  '...SSWWSSSSS....',
  '...SSWWSSSSS....',
  '...SdSSSSSdS....',
  '...SdSSSSSdS....',
  '...SdSSSSSdS....',
  '....dSSSSSd.....',
  '.....dSSSd......',
  '......dSd.......',
  '.......d........',
  '................',
  '................',
  '................',
  '................',
])

icon('quiver', [
  '................',
  '................',
  '....S..S..S.....',
  '....S..S..S.....',
  '...SSS.S.SSS....',
  '....lllllll.....',
  '....lLLLLLl.....',
  '....lLLLLLl.....',
  '....looooLl.....',
  '....lLLLLLl.....',
  '....lLLLLLl.....',
  '....looooLl.....',
  '....lLLLLLl.....',
  '.....lllll......',
  '................',
  '................',
])

icon('orb', [
  '................',
  '................',
  '.....TTTTT......',
  '....TWWTTTT.....',
  '...TWWWTTTTT....',
  '...TWWTTTTTT....',
  '...TTTTTTTTT....',
  '...TTTTTTTuT....',
  '....TTTTuuT.....',
  '.....TuuuT......',
  '.....hhhhh......',
  '....hhhhhhh.....',
  '................',
  '................',
  '................',
  '................',
])

icon('plate', [
  '................',
  '................',
  '...SS.SSS.SS....',
  '..SSSSSSSSSSS...',
  '..SSSWWSSSSdS...',
  '..SSSWWSSSSdS...',
  '..SSSSSSSSSdS...',
  '..SSSSSSSSSdS...',
  '..SSSSSSSSSdS...',
  '...SSSSSSSSd....',
  '...SS.SSS.SS....',
  '...SS.SSS.SS....',
  '................',
  '................',
  '................',
  '................',
])

icon('cloth', [
  '................',
  '................',
  '....pppppp......',
  '...pPPPPPPp.....',
  '..pPPqqqqPPp....',
  '..pPq....qPp....',
  '..pPq....qPp....',
  '..pPPqqqqPPp....',
  '..pPPPPPPPPp....',
  '..pPPPPPPPPp....',
  '..pPPPPPPPPp....',
  '..pqPPPPPPqp....',
  '..pq.pppp.qp....',
  '..p...pp...p....',
  '................',
  '................',
])

icon('banner', [
  '................',
  '................',
  '....GGGGGGG.....',
  '....GRRRRRG.....',
  '....GRWWWRG.....',
  '....GRWGWRG.....',
  '....GRWWWRG.....',
  '....GRRRRRG.....',
  '....GGGGGGG.....',
  '.....o.o.o......',
  '.......o........',
  '.......o........',
  '.......o........',
  '......ooo.......',
  '................',
  '................',
])

/* ---------------------------------------------- row 5 · relics, marks, coin */

icon('relic', [
  '................',
  '................',
  '......GGG.......',
  '.....GWWWG......',
  '....GW...WG.....',
  '....GW...WG.....',
  '.....GWWWG......',
  '......GGG.......',
  '.....hGGGh......',
  '....hhGGGhh.....',
  '...hhhGGGhhh....',
  '...hhhhhhhhh....',
  '................',
  '................',
  '................',
  '................',
])

icon('beacon', [
  '................',
  '................',
  '.......G........',
  '......GRG.......',
  '.....GRWRG......',
  '.....GRRRG......',
  '......GGG.......',
  '.....sSSSs......',
  '.....sSWSs......',
  '.....sSSSs......',
  '....ssSSSss.....',
  '....sssssss.....',
  '...sssssssss....',
  '................',
  '................',
  '................',
])

/**
 * The physical / magic corner marks — the property with no channel at all
 * before this. They are deliberately blunt: a wedge of steel against a
 * three-point spark, at the smallest size the atlas draws, because they have to
 * survive being stamped in the corner of a 40px tile.
 */
icon('phys', [
  '................',
  '................',
  '................',
  '................',
  '.......S........',
  '......SSS.......',
  '.....SWWSS......',
  '....SWWWWSS.....',
  '...SWWWWWWSS....',
  '....SSWWWSS.....',
  '.....SSSSS......',
  '......SSS.......',
  '.......S........',
  '................',
  '................',
  '................',
])

icon('magic', [
  '................',
  '................',
  '................',
  '.......V........',
  '.......V........',
  '....V..V..V.....',
  '.....V.V.V......',
  '..VVVVVWVVVVV...',
  '.....V.V.V......',
  '....V..V..V.....',
  '.......V........',
  '.......V........',
  '................',
  '................',
  '................',
  '................',
])

icon('gold', [
  '................',
  '................',
  '.....GGGGG......',
  '....GGGGGGG.....',
  '...GGWWGGGGG....',
  '...GGWGGhGGG....',
  '...GGGGhGGGG....',
  '...GGGhGGGGG....',
  '...GGhGGGGGG....',
  '...GGhhhGGGG....',
  '....GGGGGGG.....',
  '.....GGGGG......',
  '................',
  '................',
  '................',
  '................',
])

icon('dust', [
  '................',
  '................',
  '.......T........',
  '......TWT.......',
  '.....TWWTT......',
  '....TWTTTTT.....',
  '...TWTTTTTuT....',
  '....TTTTTuT.....',
  '.....TTTuT......',
  '......TuT.......',
  '.......u........',
  '................',
  '..T.........T...',
  '.TTT.......TTT..',
  '..T.........T...',
  '................',
])

icon('marks', [
  '................',
  '................',
  '.......G........',
  '.......G........',
  '......GGG.......',
  '..G...GGG...G...',
  '...GG.GWG.GG....',
  '....GGGWGGG.....',
  '..GGGGGWGGGGG...',
  '....GGGWGGG.....',
  '...GG.GWG.GG....',
  '..G...GGG...G...',
  '......GGG.......',
  '.......G........',
  '.......G........',
  '................',
])

icon('keepsake', [
  '................',
  '................',
  '....gg....gg....',
  '...gGGg..gGGg...',
  '...gGWGggGWGg...',
  '....gGGWWGGg....',
  '.....gGWWGg.....',
  '.....gGWWGg.....',
  '....gGGWWGGg....',
  '...gGWg..gWGg...',
  '...gGg....gGg...',
  '...gg......gg...',
  '................',
  '................',
  '................',
  '................',
])

/* ------------------------------------------------ row 6 · places and events */

icon('shrine', [
  '................',
  '................',
  '.......T........',
  '......TWT.......',
  '.....TWWWT......',
  '....TWWTWWT.....',
  '...TWWTTTWWT....',
  '....TWWTWWT.....',
  '.....TWWWT......',
  '......TWT.......',
  '.......T........',
  '....pppppp......',
  '...pppppppp.....',
  '................',
  '................',
  '................',
])

icon('forge', [
  '................',
  '................',
  '....SSSSS.......',
  '...SSWWWSS......',
  '...SSWWWSS......',
  '....SSSSS.......',
  '......ll........',
  '.......ll.......',
  '........ll......',
  '.....RRRRR......',
  '....RRGGGRR.....',
  '...RRGGWGGRR....',
  '...oooooooo.....',
  '................',
  '................',
  '................',
])

icon('merchant', [
  '................',
  '................',
  '..oo............',
  '..oo............',
  '...ppppppp......',
  '...pGGGGGp......',
  '...pGGGGGp......',
  '...ppppppp......',
  '....ooooo.......',
  '................',
  '...oo.....oo....',
  '..oKKo...oKKo...',
  '...oo.....oo....',
  '................',
  '................',
  '................',
])

icon('recruit', [
  '................',
  '................',
  '......ppp.......',
  '.....pPPPp......',
  '.....pPKPp......',
  '.....pPPPp......',
  '......ppp.......',
  '....ttttttt.....',
  '...tttTTTttt....',
  '...ttTTTTTtt....',
  '...tt.TTT.tt....',
  '...t..TTT..t....',
  '......t.t.......',
  '......t.t.......',
  '................',
  '................',
])

icon('wave', [
  '................',
  '..K.............',
  '..KGGGGGGG......',
  '..KGRRRRRG......',
  '..KGRRRRG.......',
  '..KGRRRG........',
  '..KGRRRRG.......',
  '..KGRRRRRG......',
  '..KGGGGGGG......',
  '..K.............',
  '..K.............',
  '..K.............',
  '..K.............',
  '.KKK............',
  '................',
  '................',
])

icon('boss', [
  '................',
  '................',
  '....PPPPPP......',
  '...PPPPPPPP.....',
  '...PPKPPKPP.....',
  '...PPKPPKPP.....',
  '...PPPPPPPP.....',
  '...PPPKKPPP.....',
  '....PPPPPP......',
  '.....PPPP.......',
  '....PKPKPK......',
  '....PPPPPP......',
  '................',
  '................',
  '................',
  '................',
])

icon('evolve', [
  '................',
  '................',
  '.......G........',
  '......GGG.......',
  '.....GGWGG......',
  '....GGGWGGG.....',
  '...GG..G..GG....',
  '.......G........',
  '.....GGGGG......',
  '....GGGWGGG.....',
  '...GG..G..GG....',
  '.......G........',
  '.....GGGGG......',
  '....GG...GG.....',
  '................',
  '................',
])

icon('mutate', [
  '................',
  '................',
  '.....PPPP.......',
  '.....P..P.......',
  '.....P..P.......',
  '....PP..PP......',
  '....P.VV.P......',
  '...P.VVVV.P.....',
  '...PVVWVVVP.....',
  '..P.VVVVVV.P....',
  '..PVVVVVVVVP....',
  '..PVVVVVVVVP....',
  '..PPVVVVVVPP....',
  '...PPPPPPPP.....',
  '................',
  '................',
])

/* ---------------------------------------------------- row 7 · system marks */

icon('threat', [
  '................',
  '................',
  '................',
  '...........rr...',
  '..........rRr...',
  '.......rr.rRr...',
  '......rRr.rRr...',
  '...rr.rRr.rRr...',
  '..rRr.rRr.rRr...',
  '..rRr.rRr.rRr...',
  '..rRr.rRr.rRr...',
  '..rrrrrrrrrrr...',
  '................',
  '................',
  '................',
  '................',
])

icon('base', [
  '................',
  '................',
  '..pp.pp.pp.pp...',
  '..pppppppppp....',
  '..pPPPPPPPPp....',
  '..pPPKKKKPPp....',
  '..pPPKTTKPPp....',
  '..pPPKTTKPPp....',
  '..pPPKTTKPPp....',
  '..pPPKTTKPPp....',
  '..pPPPPPPPPp....',
  '..pppppppppp....',
  '................',
  '................',
  '................',
  '................',
])

/**
 * A map NODE — the marker a run is a chain of.
 *
 * This cell shipped dead: nothing in the game named it. It is alive now as the
 * Hub's "Start a Run", which used to draw `wave` — one of the four unrelated
 * meanings that one pennant was carrying (an incoming wave, the wave-clear
 * beat, "start a campaign" and "post a Sentinel on a slot"). A run is a walk
 * from node to node down a map, so the map's own marker is what starts it.
 *
 * Squared up while it was being revived: at 11 rows by 14 columns the old
 * lozenge was wider than it was tall, and a wide ring with a bright dot in the
 * middle is an EYE. Equal axes read as a rhombus, which is what the run map
 * actually draws.
 */
icon('depth', [
  '................',
  '................',
  '.......t........',
  '......ttt.......',
  '.....tt.tt......',
  '....tt...tt.....',
  '...tt..T..tt....',
  '..tt..TWT..tt...',
  '...tt..T..tt....',
  '....tt...tt.....',
  '.....tt.tt......',
  '......ttt.......',
  '.......t........',
  '................',
  '................',
  '................',
])

icon('back', [
  '................',
  '................',
  '................',
  '.......p........',
  '......pp........',
  '.....pp.........',
  '....ppppppppp...',
  '...pppppppppp...',
  '....ppppppppp...',
  '.....pp.........',
  '......pp........',
  '.......p........',
  '................',
  '................',
  '................',
  '................',
])

icon('soundOn', [
  '................',
  '................',
  '.........s......',
  '.....SS..s.s....',
  '....SSS.s...s...',
  '...SSSS.s.s.s...',
  '..SSSSS.s.s.s...',
  '..SSSSS.s.s.s...',
  '..SSSSS.s.s.s...',
  '...SSSS.s.s.s...',
  '....SSS.s...s...',
  '.....SS..s.s....',
  '.........s......',
  '................',
  '................',
  '................',
])

icon('soundOff', [
  '................',
  '................',
  '................',
  '.....SS.........',
  '....SSS...r..r..',
  '...SSSS....rr...',
  '..SSSSS.....r...',
  '..SSSSS....rr...',
  '..SSSSS...r..r..',
  '...SSSS.........',
  '....SSS.........',
  '.....SS.........',
  '................',
  '................',
  '................',
  '................',
])

icon('settings', [
  '................',
  '................',
  '.....s.ss.s.....',
  '....sssssss.....',
  '...ssSSSSSss....',
  '..sSSS...SSSs...',
  '..sSS.....SSs...',
  '..sSS.....SSs...',
  '..sSS.....SSs...',
  '..sSSS...SSSs...',
  '...ssSSSSSss....',
  '....sssssss.....',
  '.....s.ss.s.....',
  '................',
  '................',
  '................',
])

icon('warn', [
  '................',
  '................',
  '.......G........',
  '......GGG.......',
  '.....GGGGG......',
  '.....GGKGG......',
  '....GGGKGGG.....',
  '....GGGKGGG.....',
  '...GGGGKGGGG....',
  '...GGGGGGGGG....',
  '..GGGGGKGGGGG...',
  '..GGGGGGGGGGG...',
  '..GGGGGGGGGGG...',
  '................',
  '................',
  '................',
])

/* ------------------------------------------------------------ row 8 · spill */

/**
 * A grant rather than a thing: the attribute half of a spoils card, and the
 * Watchtower perks. Both used to be `✚` / `⬢`, which said nothing about being
 * permanent, and `⬢` in particular was one anti-aliased pixel away from `⬡`,
 * the base-integrity mark in the header.
 */
icon('boon', [
  '................',
  '................',
  '................',
  '.......GG.......',
  '.......GG.......',
  '..e..GGGGGG..e..',
  '.ee..GGGGGG..ee.',
  '.ee....GG....ee.',
  '.ee....GG....ee.',
  '.ee..........ee.',
  '..ef........fe..',
  '...ff......ff...',
  '....ffffffff....',
  '................',
  '................',
  '................',
])

icon('loot', [
  '................',
  '................',
  '................',
  '...LLLLLLLL.....',
  '..LLLLLLLLLL....',
  '..LLLGGGGLLL....',
  '..oooooooooo....',
  '..LLLGGGGLLL....',
  '..LLLGWWGLLL....',
  '..LLLGGGGLLL....',
  '..LLLLLLLLLL....',
  '..oooooooooo....',
  '................',
  '................',
  '................',
  '................',
])

/* ------------------------------------------------- row 8 · polarity (P3b/M10)

   `effectIcon` had no sign channel: `−45% attack speed` and `+20% attack speed`
   classified to the same cell, so the game stamped speed-lines on Reckless and
   on every two-hander in the game (`Warhammer`, `−8% Attack Speed`, base). A
   number that goes the wrong way is not the same fact as one that goes the
   right way, and on a merchant board it is the fact that decides the purchase.

   Two mirrored cells rather than a generic "downside" mark, because "slower"
   and "weaker" are different answers to "why is this cheap". */

/** The mirror of `haste`: chevrons reversed, and steel instead of gold. */
icon('slow', [
  '................',
  '................',
  '......S...S.....',
  '......SS..SS....',
  '.......SS..SS...',
  '........SS..SS..',
  '.........SS..SS.',
  '........SS..SS..',
  '.......SS..SS...',
  '......SS..SS....',
  '......S...S.....',
  '................',
  '................',
  '................',
  '................',
  '................',
])

/** The mirror of `damage`: the same red, pointed down instead of crossed. */
icon('weaken', [
  '................',
  '................',
  '.....rrrrrr.....',
  '.....rRRRRr.....',
  '.....rRRRRr.....',
  '.....rRRRRr.....',
  '..rrrrRRRRrrrr..',
  '..rRRRRRRRRRRr..',
  '...nRRRRRRRRn...',
  '....nRRRRRRn....',
  '.....nRRRRn.....',
  '......nRRn......',
  '.......nn.......',
  '................',
  '................',
  '................',
])

/* --------------------------------------------- row 8 · the split meanings (M8)

   Three cells that exist because three others were carrying two meanings each.
   `armour` meant the armour stat AND the Assist setting; `settings` (a cog)
   meant the Settings screen AND "put your gear on"; `wave` meant an incoming
   wave AND "post a Sentinel on a slot" (and two more besides). A glyph with two
   meanings is worse than no glyph, because the player learns the wrong one
   first and then has to unlearn it. */

/** Assist. An open hand — the help offered, not the armour stat. */
icon('assist', [
  '................',
  '................',
  '.....P..P..P....',
  '....PP.PP.PP....',
  '....PP.PP.PP....',
  '..P.PPPPPPPP....',
  '.PPPPPPPPPPP....',
  '..PPPPPPPPPP....',
  '...qPPPPPPPP....',
  '....PPPPPPPP....',
  '....PPPPPPP.....',
  '.....PPPPP......',
  '................',
  '................',
  '................',
  '................',
])

/** Equip. Literally the dashed `+` the copy tells the player to look for. */
icon('equip', [
  '................',
  '................',
  '..SS.SS.SS.SS...',
  '..S.........S...',
  '..S.........S...',
  '.......G........',
  '..S....G....S...',
  '..S..GGGGG..S...',
  '..S....G....S...',
  '.......G........',
  '..S.........S...',
  '..S.........S...',
  '..SS.SS.SS.SS...',
  '................',
  '................',
  '................',
])

/**
 * Deploy. A caret coming down onto a marked slot — put this one HERE.
 *
 * A stemless caret rather than a full arrow, because `weaken` one cell to the
 * left is a full red down-arrow and two down-arrows on one sheet is how this
 * whole class of defect starts. Solid triangle, no stem, and the dashes under
 * it are the same dashes `equip` draws — the shell marks an empty slot with a
 * dashed outline, so both tips point at the thing the player is looking for.
 */
icon('deploy', [
  '................',
  '................',
  '................',
  '................',
  '...GGGGGGGGGG...',
  '....GGGGGGGG....',
  '.....GGGGGG.....',
  '......GGGG......',
  '.......GG.......',
  '................',
  '..SS.SS.SS.SS...',
  '................',
  '................',
  '................',
  '................',
  '................',
])

/* ------------------------------------- rows 8-9 · the rest of the polarity (M3)

   `slow` and `weaken` above were TWO of the ten sign-carrying concepts
   `describeMods` / `describeBase` can emit, and the other eight had no mirror at
   all — so `−15% HP`, `−14% range`, `−15% projectile speed`, `−70 splash
   radius`, `−25% crit chance` and `never crits` each drew the identical picture
   to their positive twin. Counted off the real producers (archetype tree,
   mutations, upgrade tree, rewards, shrines, 20 000 generated items): five of
   those eight have shipping content behind them TODAY — `rangeMult`,
   `projSpeedMult`, `hpMult`, `critChanceAdd` and `splashAdd` all go negative in
   `src/game/data/` — and `−70 splash radius` (`cx_wild`) is the one the item's
   own source comment calls out as zeroing a Stormcaller's blast.

   `thornsMult`, `critMultAdd` and `buffAura.damageMult` have no negative
   content today; they are drawn anyway because they are the same KIND of fact —
   a signed number off the same three functions — and the cost of a cell is
   ~100 bytes of PNG against a picture that would argue for the wrong purchase
   the first time a designer types a number below 1.

   The device is deliberately NOT one shared "downside" overlay. Seven cells
   that look alike at 16px is the collision this whole sheet exists to end, so
   each negative keeps its own family's motif and says its own word: the heart
   BREAKS, the reach is PULLED IN, the shot DROOPS, the blast COLLAPSES, the
   star is STRUCK THROUGH, the spikes SNAP OFF, the aura arrow TURNS DOWN.
   Direction and silhouette carry it; the hue shift is a bonus, never the
   channel — same rule as everything else in `channels.ts`. */

/**
 * The mirror of `hp`: the same heart, filled only part of the way up.
 *
 * The first version was a BROKEN heart — `hp`'s silhouette with a 2px crack
 * down it — and it was wrong for a reason no amount of staring at it would have
 * shown: `sacrifice`, eight cells earlier, is already a red heart with a 2px
 * crack down it, and has been since P3. Two cells cannot be the same drawing.
 * The measured pair sat at 98% silhouette agreement, and `starts at 30% less HP
 * for +30% damage` and `−15% HP` are lines that appear on the same panel.
 *
 * So this drains instead of breaking. The steel-dark `d` reading as the empty
 * part of the vessel and `R` as what is left is the health-bar idiom, and it
 * gives the pair a channel that is not hue: in greyscale the drained half sits
 * at luminance 99 against the red half's 146 and the panel's 36, so it is
 * legible as a LEVEL with the colour taken away entirely. Pure `#161C2E` would
 * have had more contrast against the red and almost none against `--panel`,
 * which is the same near-black — the top of the heart would simply have gone
 * missing on the surface it ships on.
 */
icon('frail', [
  '................',
  '................',
  '...dd......dd...',
  '..ddddd..ddddd..',
  '.ddSddddddddddd.',
  '.dSdddddddddddd.',
  '.dddddddddddddd.',
  '..RRRRRRRRRRRR..',
  '...RRRRRRRRRR...',
  '....RRRRRRRR....',
  '.....RRRRRR.....',
  '......RRRR......',
  '.......RR.......',
  '................',
  '................',
  '................',
])

/**
 * The mirror of `range`: the far wall, brought closer.
 *
 * Two full-height posts at the edges with wedges pressing inward on a teal
 * core. `range` is a wide reticle that fills the cell, so the negative had to
 * be the opposite READING rather than a recoloured copy — and it had to be
 * horizontal, because reach is a horizontal fact and because a four-way
 * convergence is what `shrink` two cells along already uses.
 *
 * The first attempt WAS a four-way convergence, four steel wedges at the
 * corners around a pale core. Rendered at 16px it was a small grey X — which is
 * `trap`, a small grey bowtie, one row up in the sheet. Judged in the atlas it
 * looked fine; judged at the size it ships at it was the collision this whole
 * file exists to prevent.
 */
icon('shorten', [
  '................',
  '................',
  '................',
  '.S............S.',
  '.S............S.',
  '.S............S.',
  '.S.S........S.S.',
  '.S.SS..TT..SS.S.',
  '.S.SS..TT..SS.S.',
  '.S.S........S.S.',
  '.S............S.',
  '.S............S.',
  '.S............S.',
  '................',
  '................',
  '................',
])

/**
 * The mirror of `projectile`: the shot droops off the line it was meant to fly.
 *
 * `projectile` is a flat arrow with teal speed-lines behind it. Here the teal
 * becomes the DASHED IDEAL PATH along the top and the steel arrow falls away
 * from it — two elements that only make sense together, which is what stops it
 * reading as a generic down-right arrow. A braking bar in front of the arrow
 * was the first idea and it read as `block`; a slower thing and a stopped thing
 * are not the same fact.
 */
icon('drag', [
  '................',
  '..TT..TT..TT....',
  '..TT..TT..TT....',
  '................',
  '...SS...........',
  '....SS..........',
  '.....SS.........',
  '......SS........',
  '.......SS.......',
  '........SSSSS...',
  '.........SSSS...',
  '..........SSS...',
  '...........SS...',
  '................',
  '................',
  '................',
])

/**
 * The mirror of `splash`: the blast pulled in to almost nothing.
 *
 * The first version kept `splash`'s dashed containing ring and changed only
 * what sat inside it, on the reasoning that the ring is what says "radius". At
 * 16px that was two orange rings with a red middle, twice — a distinction
 * visible in the atlas and gone on the line, which is the same defect as
 * shipping no polarity at all. So the ring goes and the composition inverts:
 * `splash` is a ring OUTSIDE a fat detonation, this is four heavy arrowheads
 * crushing IN on a 2px remnant. The red core is the only thing the two share,
 * and it is what keeps this in the splash family rather than reading as a
 * generic "reduce" mark.
 *
 * Orthogonal arrows, deliberately: `shorten` presses inward too, and it does it
 * horizontally between two posts. Same idea, two different figures, because
 * `−70 splash radius` and `−22% range` are two different facts.
 */
icon('shrink', [
  '................',
  '................',
  '.....gggggg.....',
  '......gggg......',
  '.......gg.......',
  '..g..........g..',
  '..gg........gg..',
  '..ggg..RR..ggg..',
  '..ggg..RR..ggg..',
  '..gg........gg..',
  '..g..........g..',
  '.......gg.......',
  '......gggg......',
  '.....gggggg.....',
  '................',
  '................',
])

/**
 * The mirror of `crit`: the star, struck through.
 *
 * `never crits` is the line this exists for — `cx_frenzied` and `cx_vengeful`
 * both print it and both drew the plain crit star, which is the sentence and
 * the picture disagreeing about the sign of the same fact. A strikethrough is
 * the one negation device that survives 16 pixels: a circle-and-slash needs a
 * ring nobody can see at this size, and an X over a star is two starbursts on
 * top of each other. The star drains to steel so the red band is the only
 * saturated thing in the cell, and it replaces the star's own widest ray so the
 * silhouette stays a star rather than becoming a plus sign.
 */
icon('nocrit', [
  '................',
  '................',
  '.......S........',
  '.......S........',
  '......SsS.......',
  '.S....SsS....S..',
  '..SS.SsssS.SS...',
  '.RRRRRRRRRRRRRR.',
  '.nnnnnnnnnnnnnn.',
  '..SS.SsssS.SS...',
  '.S....SsS....S..',
  '......SsS.......',
  '.......S........',
  '.......S........',
  '................',
  '................',
])

/**
 * The mirror of `thorns`: the spikes snapped clean off the ball.
 *
 * `thorns` is a steel ball with twelve spikes radiating from it. Take the
 * spikes away and what is left is a plain steel disc — which at 16px is
 * `settings`, a plain steel cog, and close enough to `orb` and `gold` to matter
 * (the first version was exactly that disc with four one-pixel nubs, and on the
 * line it read as a cog). So the spikes stay and become the message: four
 * chunky 2×2 fragments floating a full pixel clear of the ball, with the
 * auto-outline drawing a dark break in every gap. Five separate shapes in one
 * cell is a silhouette nothing else on the sheet has, and it says what the
 * number says — the spikes are still the point, there is just less of them.
 */
icon('blunt', [
  '................',
  '................',
  '.......SS.......',
  '.......SS.......',
  '................',
  '......SSSS......',
  '.....SssssS.....',
  '.SS.SssssssS.SS.',
  '.SS.SssssssS.SS.',
  '.....SssssS.....',
  '......SSSS......',
  '................',
  '.......SS.......',
  '.......SS.......',
  '................',
  '................',
])

/**
 * The mirror of `auraBuff`: the same broken ring, the arrow turned down.
 *
 * The ring is `auraBuff`'s ring pixel for pixel — the aura family is read off
 * that dashed circle and all three members share it — so the only thing that
 * differs is the arrow inside, flipped and moved from gold to red. It is the
 * one cell here with no shipping content behind it yet (`buffAura.damageMult`
 * is above 1 in all four places that set it), and it is drawn for the same
 * reason the guard in `checkConsumers` exists: the failure it prevents is
 * silent, and the moment somebody types 0.9 there the sentence would say
 * "buffs allies −10% dmg" under a gold arrow pointing up.
 */
icon('auraWeaken', [
  '................',
  '................',
  '....GG....GG....',
  '..GG...R....GG..',
  '.G.....R......G.',
  '.......R........',
  '.G.....R......G.',
  '.....RRRRR......',
  '.....RRRRR......',
  '.G....RRR.....G.',
  '.......R........',
  '.G............G.',
  '..GG........GG..',
  '....GG....GG....',
  '................',
  '................',
])

/* ========================================================================= */

const assert = () => {
  const seen = new Set<string>()
  for (const [key, art] of ICONS) {
    if (seen.has(key)) throw new Error(`duplicate icon key ${key}`)
    seen.add(key)
    if (art.length !== N) throw new Error(`${key}: ${art.length} rows, want ${N}`)
    art.forEach((row, y) => {
      if (row.length !== N) throw new Error(`${key} row ${y}: ${row.length} cols, want ${N}`)
      for (let x = 0; x < N; x++) {
        const c = row[x]
        if (c !== '.' && !PALETTE[c]) throw new Error(`${key} (${x},${y}): unknown palette char '${c}'`)
        // The auto-outline needs a free ring, so nothing may touch the border.
        if (c !== '.' && (x === 0 || y === 0 || x === N - 1 || y === N - 1)) {
          throw new Error(`${key}: art at (${x},${y}) touches the border — the outline has nowhere to go`)
        }
      }
    })
  }
}

const hex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]

/**
 * The style tell, applied uniformly: every transparent pixel 4-adjacent to a
 * filled one becomes an opaque `#161C2E`. Hand-drawing this 78 times would have
 * produced 78 slightly different borders.
 */
const outline = (art: Art): string[][] => {
  const g = art.map((r) => [...r])
  const out = g.map((r) => [...r])
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (g[y][x] !== '.') continue
      const near =
        (y > 0 && g[y - 1][x] !== '.') ||
        (y < N - 1 && g[y + 1][x] !== '.') ||
        (x > 0 && g[y][x - 1] !== '.') ||
        (x < N - 1 && g[y][x + 1] !== '.')
      if (near) out[y][x] = 'K'
    }
  }
  return out
}

const SRC = (...p: string[]) => resolve(dirname(fileURLToPath(import.meta.url)), '..', ...p)

/**
 * The atlas and the app must agree about which cell is which, and nothing in a
 * PNG can say so. `channels.ts` carries the same list as `ICON_ORDER`, and this
 * compares the two — a reordered icon here without the matching edit there would
 * otherwise ship silently as N wrong pictures.
 *
 * ---------------------------------------------------------------------------
 * Why the CSS is checked too (M13)
 * ---------------------------------------------------------------------------
 * This guard used to cover the TypeScript half only, and the TypeScript half was
 * never the exposed one. `channels.ts` names the cells; `global.css` decides
 * where a cell IS, via `background-size`, and it did that with a bare literal —
 * `calc(var(--fw-i-size) * 9)` — with a comment claiming it read `--fw-i-cols`,
 * a token that was defined nowhere in the project. Append eight icons and the
 * sheet grows a tenth row, every `--iy` samples a fraction of a cell short, and
 * the exact "N wrong pictures" failure this file exists to prevent arrives
 * through the one door it was not watching. So the geometry is now declared in
 * CSS as two named tokens and both are compared against the real grid, along
 * with `ICON_COLS`.
 */
const checkConsumers = async () => {
  const { readFile } = await import('node:fs/promises')
  const rows = Math.ceil(ICONS.length / COLS)
  const mine = ICONS.map(([k]) => k)

  const channels = await readFile(SRC('src', 'ui', 'channels.ts'), 'utf8')
  const block = /export const ICON_ORDER = \[([\s\S]*?)\] as const/.exec(channels)
  if (!block) throw new Error('channels.ts has no ICON_ORDER array to check against')
  const declared = [...block[1].matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1])
  if (declared.length !== mine.length || declared.some((k, i) => k !== mine[i])) {
    throw new Error(
      `ICON_ORDER disagrees with the atlas.\n  channels.ts: ${declared.join(' ')}\n  fw-icons.ts: ${mine.join(' ')}`,
    )
  }
  const cols = /export const ICON_COLS = (\d+)/.exec(channels)
  if (!cols || Number(cols[1]) !== COLS) throw new Error(`channels.ts ICON_COLS is ${cols?.[1]}, atlas is ${COLS}`)
  const rowsTs = /export const ICON_ROWS = (\d+)/.exec(channels)
  if (!rowsTs || Number(rowsTs[1]) !== rows) throw new Error(`channels.ts ICON_ROWS is ${rowsTs?.[1]}, atlas is ${rows}`)

  const css = await readFile(SRC('src', 'styles', 'global.css'), 'utf8')
  const cssCols = /--fw-i-cols:\s*(\d+)/.exec(css)
  const cssRows = /--fw-i-rows:\s*(\d+)/.exec(css)
  if (!cssCols) throw new Error('global.css does not define --fw-i-cols')
  if (!cssRows) throw new Error('global.css does not define --fw-i-rows')
  if (Number(cssCols[1]) !== COLS) throw new Error(`global.css --fw-i-cols is ${cssCols[1]}, atlas is ${COLS}`)
  if (Number(cssRows[1]) !== rows) throw new Error(`global.css --fw-i-rows is ${cssRows[1]}, atlas is ${rows}`)
  // A literal left behind in `background-size` would silently outrank the
  // tokens, so the rule has to be reading them.
  if (!/background-size:\s*calc\(var\(--fw-i-size\) \* var\(--fw-i-cols\)\) calc\(var\(--fw-i-size\) \* var\(--fw-i-rows\)\)/.test(css)) {
    throw new Error('global.css .fw-i background-size does not read --fw-i-cols / --fw-i-rows')
  }

  console.log(`consumers agree: ${mine.length} keys, ${COLS}x${rows} grid (channels.ts + global.css)`)
}

async function main() {
  assert()
  await checkConsumers()
  const rows = Math.ceil(ICONS.length / COLS)
  const W = COLS * N
  const H = rows * N
  const buf = Buffer.alloc(W * H * 4, 0)

  ICONS.forEach(([, art], i) => {
    const ox = (i % COLS) * N
    const oy = Math.floor(i / COLS) * N
    const g = outline(art)
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const c = g[y][x]
        if (c === '.') continue
        const [r, gr, b] = hex(PALETTE[c])
        const o = ((oy + y) * W + (ox + x)) * 4
        buf[o] = r
        buf[o + 1] = gr
        buf[o + 2] = b
        buf[o + 3] = 255
      }
    }
  })

  /*
   * TRUECOLOUR, and the 868 bytes are worth it (C4).
   *
   * This used to be `.png({ palette: true, colours: 64 })`. sharp does not honour
   * `colours` on that path: what it wrote was **bit depth 4, sixteen palette
   * entries**, quantised from the 25 authored colours by libimagequant. Decoded
   * off the committed file, the damage was not subtle — NEITHER VIOLET
   * SURVIVED (`#a8719a` and `#775396` both went), parchment light and parchment
   * mid collapsed into one entry, three unrelated authored colours all landed on
   * `#aa7c70`, and six of the sixteen shipped colours occur nowhere in the
   * harvested CC0 set, which is precisely the claim the palette comment above
   * makes about itself.
   *
   * The visible cost fell on the one pair that had to work. `magic` and `phys`
   * are the mark for the property `offers.ts` calls the single thing that
   * decides whether a drop is worth anything to a given hero, and they were
   * designed as violet-versus-steel. Quantised, `magic` shipped as a muddy tan
   * spark beside a grey diamond: the contrast the pair is built on did not
   * exist in the file. A 16-entry palette also cannot be extended — every new
   * icon makes the quantiser drop something else, silently.
   *
   * An indexed PNG of 26 opaque colours is not meaningfully smaller than a
   * truecolour one at this size anyway; the whole saving was ~868 bytes on a
   * single request that is already cached forever.
   */
  await mkdir(OUT, { recursive: true })
  const png = await sharp(buf, { raw: { width: W, height: H, channels: 4 } })
    .png({ palette: false, compressionLevel: 9, effort: 10 })
    .toBuffer()

  const target = resolve(OUT, 'fw-icons.png')
  if (CHECK) {
    const { readFile } = await import('node:fs/promises')
    const on_disk = await readFile(target).catch(() => null)
    if (!on_disk) throw new Error(`${target} is missing — run \`npm run fw-icons\``)
    if (!on_disk.equals(png)) {
      throw new Error(
        `public/assets/ui/fw-icons.png is stale (${on_disk.length}B on disk, ${png.length}B from source) — run \`npm run fw-icons\``,
      )
    }
    console.log(`fw-icons.png is current  ${W}x${H}  ${ICONS.length} icons  ${(png.length / 1024).toFixed(1)} KB`)
    return
  }
  await writeFile(target, png)

  // The key order IS the cell order; print it so `channels.ts` can be checked
  // against the atlas by eye rather than by trust.
  console.log(`fw-icons.png  ${W}x${H}  ${ICONS.length} icons  ${(png.length / 1024).toFixed(1)} KB`)
  ICONS.forEach(([k], i) => {
    const c = i % COLS
    const r = Math.floor(i / COLS)
    process.stdout.write(`${String(i).padStart(2)} ${k.padEnd(12)} (${c},${r})${c === COLS - 1 ? '\n' : '  '}`)
  })
  if (ICONS.length % COLS) process.stdout.write('\n')

  // A 6x contact sheet for the render-and-measure loop. Scratch output, not
  // shipped — it is written next to the atlas only when --sheet is passed.
  if (process.argv.includes('--sheet')) {
    const sheet = await sharp(buf, { raw: { width: W, height: H, channels: 4 } })
      .resize(W * 6, H * 6, { kernel: 'nearest' })
      .flatten({ background: '#2f2418' })
      .png()
      .toBuffer()
    await writeFile(resolve(process.cwd(), 'fw-icons-sheet.png'), sheet)
    console.log('contact sheet -> fw-icons-sheet.png')
  }
}

main()
