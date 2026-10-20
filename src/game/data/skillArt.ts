import type { InfusionTag } from './infusions'

/**
 * ---------------------------------------------------------------------------
 * Skill art (Oct 2026) — every library skill's own picture, and the layers a
 * merge is composed from
 * ---------------------------------------------------------------------------
 *
 * The designer: "make unique assets that actually feel like the different
 * things merging". Until this, a skill was pictured by its lead EFFECT's mark
 * (`skills.skillHeadline`): five Rush skills shared the speed chevrons, six
 * "harder" skills the slashes, and a merge borrowed its base's mark, so
 * "Frozen Arc Spark" looked exactly like Arc Spark.
 *
 * Now each of the 50 library skills has a 16 × 16 drawing of its own whose
 * silhouette names it (Frostbite a frost crystal on a fang, Arc Spark a forked
 * bolt, Poisoned Tips a dripping arrowhead …), drawn the Stardew way the
 * character-design skill (§ 4c) took from the designer's spec, in the atlas's
 * hand (`scripts/fw-icons.ts`: 1 px of the pack's navy ink round a filled
 * interior, nothing touching the cell's edge):
 *
 *  - **Key colours.** The part of a drawing that carries its element (the
 *    bolt, the crystal, the poison on the tip) is painted in three KEY
 *    letters, `1` light · `2` mid · `3` dark, never in a fixed colour. The key
 *    resolves through an element ramp ({@link TAG_RAMP}): a library skill's
 *    own tag's, or — in a merge — the infusion's. That swap IS the merge's
 *    colour: one drawing gives Arc Spark's yellow bolt and Frozen Arc Spark's
 *    ice-blue one. Everything else (steel, wood, bone, the ink) is fixed, so
 *    the base still reads as itself.
 *  - **Hue-shifted ramps.** Every ramp turns in hue from light to dark (8–70°;
 *    the metals and the oak least) — shadows cool or magenta, lights warm —
 *    never one hue darkened toward black. Every colour is the harvested pack’s.
 *  - **One motif per tag** ({@link MOTIFS}): a small mark of the infusion's
 *    element stamped on a FIXED corner or edge of the grid (a flame lick top
 *    right, a poison drip bottom right, a storm spark top left …), with its
 *    own ink ring, so it sits on the base like a layer on one grid and never
 *    melts into its silhouette. Frost is the one edge treatment: rime on every
 *    top edge.
 *
 * Pure data: no import of `skills.ts`. The composer is `skillIcons.ts`; the
 * atlas bakes the library and named pictures from it (`scripts/fw-icons.ts`);
 * the plain merges are composed at runtime (`ui/SkillIcon.tsx`).
 */

/** A 16 × 16 drawing: `.` empty, an atlas letter, or a key `1`/`2`/`3`. */
export type SkillArt = readonly string[]

/** The navy ink, the pack's one outline (`fw-icons.ts` OUTLINE). */
export const INK = '#161c2e'

/**
 * The fixed colours, letter for letter the atlas's (`fw-icons.ts` PALETTE),
 * plus colours the harvested CC0 pack has and the atlas did not need: `N` the
 * pack's navy shadow, `M` its magenta shadow (goblin red's, H319), and the
 * ramps' own colours as letters (below), so a named merge can hold two
 * elements at once. `tests/skillIcons.test.ts` finds every added colour in
 * the pack's PNGs.
 */
export const SKILL_PALETTE: Readonly<Record<string, string>> = {
  K: INK,
  W: '#fffce7',
  S: '#bac1c8',
  s: '#737f8e',
  d: '#4a6982',
  N: '#404e75',
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
  M: '#693d5b',
  L: '#b48355',
  l: '#866353',
  o: '#6f5a48',
  E: '#95d562',
  e: '#38b251',
  f: '#276740',
  V: '#a8719a',
  v: '#775396',
  // The ramps' own colours as fixed letters, so a named merge's drawing can
  // hold two elements at once (Rimecut's ice blade AND its rose crit star).
  Y: '#faee6d', // storm yellow
  F: '#e15454', // fire red
  B: '#3e8698', // frost mid
  C: '#b45076', // crit rose
  c: '#ffcfb4', // crit blush
  O: '#f69e7d', // copper light
  b: '#b16c4d', // copper rust
  i: '#c6f0db', // wind mint
  m: '#5ab3ac', // wind teal
  H: '#ede6ac', // birch
  D: '#d5b583', // straw / oak light
  z: '#d9945f', // saffron
}

/** An element ramp: the colours keys `1` (light), `2` (mid) and `3` (dark) take. */
export type Ramp = readonly [string, string, string]

/**
 * Each infusion tag's ramp, light → dark, hue-shifted (every colour from the
 * harvested CC0 pack). Tags of one family keep one hue family (the three
 * guards are oak, the steel and the splash share the metal's cool turn), so a
 * merge's colour already says what kind of thing was poured in; the motif
 * says which.
 */
export const TAG_RAMP: Readonly<Record<InfusionTag, Ramp>> = {
  fire: ['#ffed44', '#e15454', '#87465a'], // yellow → red → wine (H54 → H0 → H342)
  poison: ['#95d562', '#38b251', '#775396'], // acid → green → violet shadow
  root: ['#bbb552', '#387253', '#6f5a48'], // olive → moss → bark
  frost: ['#8cc3c4', '#3e8698', '#404e75'], // the pack's teal turn: H181 → H192 → H224
  storm: ['#fffce7', '#faee6d', '#775396'], // white-hot → yellow → violet
  blood: ['#f76666', '#b65555', '#693d5b'], // red → brick → magenta (goblin red's turn)
  steel: ['#bac1c8', '#737f8e', '#404e75'], // grey → slate → navy
  splash: ['#f69e7d', '#b16c4d', '#693d5b'], // copper: peach → rust → magenta
  crit: ['#ffcfb4', '#b45076', '#693d5b'], // Rosethread's silk: blush → rose → plum
  speed: ['#c6f0db', '#5ab3ac', '#417168'], // the wind: mint → teal → pine
  reach: ['#ede6ac', '#a8719a', '#775396'], // birch → heather → violet
  guard: ['#d5b583', '#b48355', '#6f5a48'], // oak: straw → oak → bark
  banner: ['#efe1ab', '#d9945f', '#b16c4d'], // saffron cloth: cream → saffron → rust
  gold: ['#ffed44', '#d08c41', '#a38250'], // the atlas's gold
  mend: ['#fffce7', '#c6f0db', '#5ab659'], // hallowed: cream → mint → green
}

/**
 * Where a motif sits. Each is a fixed place on the grid, so a motif is a layer
 * that lands in the same spot on every base — the eye learns "a flame top
 * right means Blazing".
 */
export type MotifPlace = 'tl' | 'tr' | 'bl' | 'br' | 'left' | 'right' | 'rim'

export interface Motif {
  place: MotifPlace
  /** Its pixels, top-left at `at` (keys take the infusion's ramp). Empty for the rim. */
  art: readonly string[]
  at: readonly [number, number]
}

/**
 * The fifteen motifs, one per tag. Each is 4–10 lit pixels inside a footprint
 * of at most 6 × 7 (ink ring included), small enough that the base's
 * silhouette still leads at 1×. The corners are shared out so that the
 * busiest one (top left) holds four tags and every motif in one corner has
 * its own shape and colour.
 */
export const MOTIFS: Readonly<Record<InfusionTag, Motif>> = {
  // A flame lick, top right.
  fire: { place: 'tr', at: [11, 1], art: ['.1..', '.11.', '121.', '.2..'] },
  // A poison drop falling, bottom right.
  poison: { place: 'br', at: [12, 9], art: ['.1.', '1W2', '223', '...', '.3.'] },
  // A leaf sprig, bottom left.
  root: { place: 'bl', at: [1, 10], art: ['..12', '.1W2', '122.', '2...'] },
  // Rime: every top edge frosts over (no stamp).
  frost: { place: 'rim', at: [0, 0], art: [] },
  // A spark, top left.
  storm: { place: 'tl', at: [1, 1], art: ['..1.', '.11.', '..11', '.1..'] },
  // A blood drop, bottom left.
  blood: { place: 'bl', at: [1, 10], art: ['.1.', '.1.', '1W2', '223'] },
  // A riveted strap, top left.
  steel: { place: 'tl', at: [1, 1], art: ['1W1W', '2323'] },
  // A burst of debris, bottom right.
  splash: { place: 'br', at: [11, 11], art: ['1.1', '.W.', '1.2'] },
  // A four-point crit star, top right.
  crit: { place: 'tr', at: [12, 1], art: ['.1.', '1W1', '.1.'] },
  // Speed streaks, on the left edge.
  speed: { place: 'left', at: [1, 6], art: ['111', '...', '.11'] },
  // An arrowhead, on the right edge.
  reach: { place: 'right', at: [12, 6], art: ['1..', '11.', '1..'] },
  // A small shield, bottom left.
  guard: { place: 'bl', at: [1, 11], art: ['112', '1W2', '.2.'] },
  // A pennant, top left.
  banner: { place: 'tl', at: [1, 1], art: ['W11', 'W1.', 'W..'] },
  // A coin, bottom right.
  gold: { place: 'br', at: [12, 11], art: ['112', '1W2', '223'] },
  // A heart of light, top left.
  mend: { place: 'tl', at: [1, 1], art: ['1.1', '1W1', '.2.'] },
}

/**
 * The atlas cell of a skill's own picture: `sk` + its id in camel case for a
 * library skill (`skArcSpark`), `fz` + its name for a named merge
 * (`fzRimecut`). The atlas's keys are letters only (`fw-icons.ts` reads them
 * with `/'([A-Za-z]+)'/`). Callers check it against `ICON_ORDER`.
 */
export function skillArtKey(id: string): string {
  const camel = (s: string) => s.split('_').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('')
  return id.startsWith('fz_') ? `fz${camel(id.slice(3))}` : `sk${camel(id)}`
}

/* ===========================================================================
 * The 50 library skills, by level, in `skills.ts` order
 * ======================================================================== */

export const SKILL_ART: Readonly<Record<string, SkillArt>> = {
  // ---- Level 1 -------------------------------------------------------------
  // Quick Hands: an open glove flicking, two arcs of its blur behind.
  quick_hands: [
    '................',
    '................',
    '........1.1.....',
    '.......1212.1...',
    '.......12121W...',
    '...W...121212...',
    '..W....1222221..',
    '..W...12222222..',
    '.W..1.12222223..',
    '.W..2212222223..',
    '..W..222222233..',
    '......22222333..',
    '.......223333...',
    '........3333....',
    '................',
    '................',
  ],
  // Hard Hitter: a steel gauntlet punching right, the hit's lines ahead of it.
  hard_hitter: [
    '................',
    '................',
    '................',
    '...11.11.11.11..',
    '...W13W13W13W1..',
    '...12312312312..',
    '...12312312312..',
    '...33333333333..',
    '...1W111112233..',
    '...12222223333..',
    '....22223333....',
    '.....LLLLLL.....',
    '.....llllll.....',
    '................',
    '................',
    '................',
  ],
  // Keen Eye: an eye, its iris in the crit's rose, a glint on it.
  keen_eye: [
    '................',
    '................',
    '................',
    '................',
    '......PPPP......',
    '....PP1111PP....',
    '...P1122N211P...',
    '..P1122NNW221P..',
    '..P12233NN321P..',
    '...P1233333qP...',
    '....PP2222PP....',
    '......PPPP......',
    '................',
    '................',
    '................',
    '................',
  ],
  // Hold Fast: a gloved fist clenched round an iron bar.
  hold_fast: [
    '................',
    '.......SS.......',
    '.......Ss.......',
    '.......Ss.......',
    '....1111S11.....',
    '...121212121....',
    '...122222222....',
    '...12222222S3...',
    '...2222222sS3...',
    '...2222223Ss3...',
    '...3333333Ss....',
    '....33333.Ss....',
    '.......Ss.......',
    '.......sd.......',
    '................',
    '................',
  ],
  // Charge: a boot mid-stride, the dash behind it.
  charge: [
    '................',
    '................',
    '........111.....',
    '........112.....',
    '.WW.....112.....',
    '........122.....',
    '.WWWW...122.....',
    '........12221...',
    '..WWW...1222211.',
    '........1222223.',
    '.WWWW...3333333.',
    '........ooooooo.',
    '................',
    '................',
    '................',
    '................',
  ],
  // Bloodrush: a drop of blood, the rush's chevrons beside it.
  bloodrush: [
    '................',
    '..........1.....',
    '..........1.....',
    '.........111....',
    '.........112....',
    '.W..W...11122...',
    '..W..W..1W122...',
    '...W..W.1W1222..',
    '..W..W..112223..',
    '.W..W...112223..',
    '.........22233..',
    '.........22333..',
    '..........333...',
    '................',
    '................',
    '................',
  ],
  // Poisoned Tips: a steel arrowhead pointing up, poison on its tip and dripping.
  poison_tips: [
    '................',
    '...........11...',
    '..........1W12..',
    '.........1W122..',
    '........11222...',
    '.......SS1223...',
    '......SSs.33....',
    '.....SSs...2....',
    '....lLs.........',
    '...lLl.....1....',
    '..lLl......2....',
    '..Ll............',
    '.lL.............',
    '................',
    '................',
    '................',
  ],
  // Arc Spark: a forked bolt.
  arc_spark: [
    '................',
    '.........1111...',
    '........1112....',
    '.......1122.....',
    '......1122......',
    '.....11122......',
    '....111111122...',
    '.......11122....',
    '......1122......',
    '.....11.22......',
    '....11...22.....',
    '...12.....22....',
    '...2.......3....',
    '................',
    '................',
    '................',
  ],
  // Frostbite: a fang, a frost crystal grown on it.
  frostbite: [
    '................',
    '...........1....',
    '..........1W1...',
    '.......1..1W2.1.',
    '......1W1.1W212.',
    '......1W2212233.',
    '...PPPPP222333..',
    '..PWPPPPPq33....',
    '..PWPPPPpq......',
    '..PWPPPPq.......',
    '...WPPPpq.......',
    '...PPPpq........',
    '...PPpq.........',
    '....Pq..........',
    '................',
    '................',
  ],
  // Long Reach: a long spear across the cell, a pennon at its head.
  long_reach: [
    '................',
    '...........SW...',
    '..........SSSW..',
    '.........SSSs...',
    '........1lSs....',
    '.......1W2l.....',
    '.......1223.....',
    '.......23.......',
    '......23........',
    '.....23.........',
    '....23..........',
    '...23...........',
    '..23............',
    '..3.............',
    '................',
    '................',
  ],
  // Cleave: a copper axe head and the wide arc it sweeps.
  cleave: [
    '................',
    '......WWW.......',
    '....WWPPPW......',
    '...WPP..........',
    '..WP...1111.....',
    '..WP..1W12221...',
    '.WP...122223333.',
    '.WP...L2223333..',
    '..W..LL..33.....',
    '.....LL.........',
    '....LL..........',
    '...LL...........',
    '..LL............',
    '..l.............',
    '................',
    '................',
  ],
  // Bounty: a coin purse, a coin falling in.
  bounty: [
    '................',
    '.........11.....',
    '........1W12....',
    '........1223....',
    '.....ll..33.....',
    '....lLLl........',
    '.....ll.........',
    '....12222.......',
    '...1W222223.....',
    '..1W22222223....',
    '..12222222233...',
    '..12222222333...',
    '...223333333....',
    '....3333333.....',
    '................',
    '................',
  ],
  // Pin Down: a stake driven through a strip of cloth into the ground.
  pin_down: [
    '................',
    '.......SS.......',
    '......SSSs......',
    '.......Ss.......',
    '.......11.......',
    '.......12.......',
    '.......12.......',
    '..PPPP.12.PPP...',
    '..qPPPP12PPPq...',
    '...qqqP12Pqq....',
    '.......23.......',
    '...eeeee3eeee...',
    '..effffffffffe..',
    '................',
    '................',
    '................',
  ],
  // Riposte: a round buckler bristling with thorns.
  riposte: [
    '................',
    '.......S........',
    '...S..SsS..S....',
    '....s11111s.....',
    '...1112221W1....',
    '..S12222222sS...',
    '..1222SSs2223...',
    '.S122SWSs2223S..',
    '..122SSss2223...',
    '..S12222222sS...',
    '...12222223.....',
    '....s33333s.....',
    '...S..SsS..S....',
    '.......S........',
    '................',
    '................',
  ],

  // ---- Level 2 -------------------------------------------------------------
  // Heavy Blows: a warhammer coming down, the ground cracking under it.
  heavy_blows: [
    '................',
    '.......lo.......',
    '.......Ll.......',
    '.......Ll.......',
    '.......Ll.......',
    '.......Ll.......',
    '...1111111111...',
    '...1W11111112...',
    '...1222222223...',
    '...1222222223...',
    '...3333333333...',
    '..W..........W..',
    '.W.W........W.W.',
    '.qqqq.qqqq.qqqq.',
    '................',
    '................',
  ],
  // Long Shot: a drawn longbow, its arrow nocked.
  long_shot: [
    '................',
    '....22..........',
    '...23.W.........',
    '..23...W........',
    '..2.....W.......',
    '.23......W......',
    '.2........W.....',
    '.2..121SSSSSSSs.',
    '.2........W.....',
    '.23......W......',
    '..2.....W.......',
    '..23...W........',
    '...23.W.........',
    '....22..........',
    '................',
    '................',
  ],
  // Finisher: a skull, a killing slash across it.
  finisher: [
    '................',
    '................',
    '.............1..',
    '.....PPPPP..12..',
    '....PPPPPPP12...',
    '...PPPWPPP12....',
    '...PNNPPN12.....',
    '...PNNPP12N.....',
    '...PPPP12PP.....',
    '....PP12PP......',
    '....P12qPq......',
    '....12P.P.......',
    '...12...........',
    '...2............',
    '................',
    '................',
  ],
  // Shield Wall: two oak shields locked edge over edge.
  shield_wall: [
    '................',
    '................',
    '..SSSSS.........',
    '..S1112SSSSSS...',
    '..S1222S11122S..',
    '..S1222S12222S..',
    '..S1222S12222S..',
    '..S2223S12222S..',
    '...S23S.S2223S..',
    '....SS...S223S..',
    '..........S3S...',
    '...........S....',
    '................',
    '................',
    '................',
    '................',
  ],
  // Anchor: an iron anchor, a hemp rope coiled on its shank.
  anchor: [
    '................',
    '.......12.......',
    '......2..3......',
    '.......33.......',
    '.....SSSSSS.....',
    '.......S1.......',
    '......12S2......',
    '.......SS1......',
    '......1S2.......',
    '.......Ss.......',
    '..S....Ss....S..',
    '..SS...Ss...SS..',
    '...SSs.Ss.sSS...',
    '....sSSSSSSs....',
    '................',
    '................',
  ],
  // Stunning Bash: a flanged mace head, stars knocked loose above it.
  stunning_bash: [
    '................',
    '..G........G....',
    '.GWG..G...GWG...',
    '..G..GWG...G....',
    '......G.........',
    '.....1111.......',
    '....112221......',
    '...1W12221......',
    '...12222223.....',
    '....1222233.....',
    '.....2333.......',
    '......Ll........',
    '......Ll........',
    '......lo........',
    '................',
    '................',
  ],
  // Snare: a rope noose staked out, roots knotted through it.
  snare: [
    '................',
    '................',
    '.....11222......',
    '....12....23....',
    '...12......2....',
    '...12......p....',
    '...12......p....',
    '...12......p....',
    '...12......p....',
    '...12...ppPpp...',
    '...12..p.....p..',
    '..1223..ppppp...',
    '.3333333333333..',
    '................',
    '................',
    '................',
  ],
  // Wildfire: flames leaping, three tongues.
  wildfire: [
    '................',
    '......3.........',
    '.....33.....3...',
    '.....332...33...',
    '..3..3223..323..',
    '..33.32213.3223.',
    '..3233221332123.',
    '..322232112W123.',
    '..32212W1211223.',
    '..3221WW1W12223.',
    '..32211WWW11223.',
    '...322111111223.',
    '....3322222233..',
    '......333333....',
    '................',
    '................',
  ],
  // Blessing: a halo, its light falling.
  blessing: [
    '................',
    '.....111111.....',
    '....1......1....',
    '.....333333.....',
    '.......W........',
    '...1W11111112...',
    '...1W22222223...',
    '....12222223....',
    '.....122223.....',
    '......1223......',
    '.......23.......',
    '.......23.......',
    '.....122223.....',
    '....12222233....',
    '................',
    '................',
  ],
  // Siphon: a glass vial, blood drawn up its tube.
  gate_siphon: [
    '................',
    '.....SSSSSS.....',
    '.....S....S.....',
    '.....S....S.....',
    '..........S.....',
    '.....PPP..S.....',
    '.....TTT..S.....',
    '....TTWTT.2.....',
    '...TTW111T1.....',
    '...T111122T.....',
    '...T122223T.....',
    '...T233333T.....',
    '....TTTTTT......',
    '................',
    '................',
    '................',
  ],
  // Killing Spree: three claw rakes.
  killing_spree: [
    '................',
    '................',
    '...1....1....1..',
    '...12...12...12.',
    '....12...12...1.',
    '....12...12...2.',
    '.....12...12..2.',
    '.....12...12..2.',
    '......2...2...3.',
    '......23..23..3.',
    '.......2...2..3.',
    '.......3...3....',
    '........3...3...',
    '................',
    '................',
    '................',
  ],
  // Cold Snap: a block of ice, cracked through.
  cold_snap: [
    '................',
    '................',
    '...111111111....',
    '..1WW1111112....',
    '..1W111N1122....',
    '..11111N11223...',
    '..1111N111223...',
    '..111N1N11223...',
    '..12N222N2223...',
    '..1222222N223...',
    '..2222222N223...',
    '..222222222233..',
    '...3333333333...',
    '................',
    '................',
    '................',
  ],
  // Firebrand: a torch, its flame up.
  firebrand: [
    '................',
    '........3.......',
    '.......33.......',
    '......3223......',
    '.....32213......',
    '.....3211W3.....',
    '.....321WW3.....',
    '......3113......',
    '......SSSS......',
    '.......LL.......',
    '.......Ll.......',
    '.......Ll.......',
    '.......Ll.......',
    '.......lo.......',
    '................',
    '................',
  ],
  // Split Shot: an arrow splitting into two heads.
  split_shot: [
    '................',
    '............SSs.',
    '...........SSs..',
    '..........Ss....',
    '.........l......',
    '........l.......',
    '.12....l........',
    '..12..l.........',
    '..1LLL..........',
    '..12..l.........',
    '.12....l........',
    '........l.......',
    '.........Ss.....',
    '..........SSs...',
    '...........SSs..',
    '................',
  ],
  // Deadeye: a sight's reticle, a bead at its heart.
  deadeye: [
    '................',
    '.......1........',
    '.....11211......',
    '....1..2..1.....',
    '...1...2...1....',
    '...1.......1....',
    '..12222.22223...',
    '...1...W...1....',
    '...1.......3....',
    '....1..2..3.....',
    '.....33233......',
    '.......3........',
    '................',
    '................',
    '................',
    '................',
  ],
  // Spicy Peps (Pepperfire): a chili pepper, hot.
  pepperfire: [
    '................',
    '..........ee....',
    '.........eef....',
    '........1112....',
    '.......1W112..G.',
    '......1W1122.G..',
    '......111122..G.',
    '.....1111222....',
    '.....111223.....',
    '....111223......',
    '...112233.......',
    '..11233.........',
    '.123............',
    '................',
    '................',
    '................',
  ],
  // Starweave (Gilt Frame): a star woven of silk thread.
  gilt_frame: [
    '................',
    '.......1........',
    '.......1........',
    '......121.......',
    '......121.......',
    '.1111.1W1.1111..',
    '..22211W11222...',
    '....211W112.....',
    '....2112112.....',
    '...22.323.22....',
    '...2..323..2....',
    '..2...3.3...2...',
    '..............W.',
    '.............W..',
    '................',
    '................',
  ],
  // Ore Sense: a lump of rock, a vein of ore glinting in it.
  ore_sense: [
    '................',
    '................',
    '.......qq.......',
    '.....qqppqq.....',
    '....qppp1Wpq....',
    '...qpp1W21ppq...',
    '..qpp1223ppppq..',
    '..qpp223pp1Wpo..',
    '..qppp3pp1223o..',
    '..qqpppp12233o..',
    '...oqpppp33qoo..',
    '....ooqqqqooo...',
    '......oooo......',
    '................',
    '................',
    '................',
  ],
  // Blood Price (Velvet Toll): a coin stamped with a drop.
  velvet_toll: [
    '................',
    '................',
    '......1111......',
    '....11222211....',
    '...1W2222222....',
    '...12222R2223...',
    '..1W222RR22223..',
    '..122RRRRr2223..',
    '..122RRRrr2223..',
    '..1222Rrr22223..',
    '...22222222233..',
    '...22222222333..',
    '....33222333....',
    '......3333......',
    '................',
    '................',
  ],
  // Thornbloom (Moonwake): a bloom on a thorned stem, sparking.
  moonwake: [
    '................',
    '......1.........',
    '.....121..W.....',
    '..1.12221.......',
    '..121W2W121.....',
    '...12222221.....',
    '..1222W22221....',
    '...12223321.....',
    '....13333.......',
    '......ee........',
    '....e.ee........',
    '.....ee.e.......',
    '......ee........',
    '......ef........',
    '................',
    '................',
  ],
  // Bolder Bash: a boulder bursting through, its dust behind.
  bolder_bash: [
    '................',
    '................',
    '........1111....',
    '......1W11122...',
    '.....1W1112222..',
    '.qq..111122232..',
    '....1111222232..',
    '....1122223222..',
    '.qq.1222232222..',
    '....2222322223..',
    '.....222223333..',
    '.qq...2233333...',
    '........3333....',
    '................',
    '................',
    '................',
  ],
  // Banner Bearer: a flag on its pole, flying.
  banner_bearer: [
    '................',
    '..GG............',
    '..oL111111......',
    '..oL1W11221.....',
    '..oL122222......',
    '..oL1222221.....',
    '..oL222223......',
    '..oL2233333.....',
    '..oL............',
    '..oL............',
    '..oL............',
    '..oL............',
    '..oL............',
    '..ol............',
    '................',
    '................',
  ],
  // Venom Spit: a viper's open jaws, venom flying from them.
  venom_spit: [
    '................',
    '................',
    '................',
    '...11111........',
    '..1W1N1111...1..',
    '..12222222......',
    '..122233332..1..',
    '..122...W.......',
    '..122.......11..',
    '..12222P........',
    '..1222222.......',
    '...333333.......',
    '................',
    '................',
    '................',
    '................',
  ],
  // Overgrowth: a root spiralling up, leaves on it.
  overgrowth: [
    '................',
    '........11......',
    '.......1W22.....',
    '.......1223.....',
    '....1...2.......',
    '...122..2.......',
    '....2..22..11...',
    '.......2..1W22..',
    '......22..1223..',
    '......2..22.....',
    '...12.2.22......',
    '...1222.2.......',
    '....3322........',
    '...33333333.....',
    '................',
    '................',
  ],

  // ---- Level 3 -------------------------------------------------------------
  // Berserk: a horned helm, the rage burning in its slit.
  berserk: [
    '................',
    '.P............P.',
    '.PP..........PP.',
    '..PP.111111.PP..',
    '..qPP111211PPq..',
    '...q1111W1211q..',
    '....1222222221..',
    '....1RRRRRRRR2..',
    '....12R2RR2R23..',
    '....1222222223..',
    '....1222222223..',
    '....3222.22233..',
    '.....333.3333...',
    '................',
    '................',
    '................',
  ],
  // Weaponmaster: two swords crossed, their hilts in rose.
  weaponmaster: [
    '................',
    '..SW........WS..',
    '..sSS......SSs..',
    '...sSS....SSs...',
    '....sSS..SSs....',
    '.....sSSSSs.....',
    '......sSSs......',
    '......SssS......',
    '.....SSs.sSS....',
    '...1SSs...sSS1..',
    '...12s.....s12..',
    '..1L23.....3L21.',
    '..LL.........LL.',
    '..l...........l.',
    '................',
    '................',
  ],
  // Volley: three arrows falling together.
  volley: [
    '................',
    '.1...1...1......',
    '.12..12..12.....',
    '.2...2...2......',
    '..L...L...L.....',
    '..L...L...L.....',
    '...L...L...L....',
    '...L...L...L....',
    '....L...L...L...',
    '....l...l...l...',
    '.....S...S...S..',
    '....SSs.SSs.SSs.',
    '.....s...s...s..',
    '................',
    '................',
    '................',
  ],
  // Bulwark: a tower shield, iron bands across its oak.
  bulwark: [
    '................',
    '...SSSSSSSSS....',
    '...S1112222S....',
    '...S1222222S....',
    '...SSSSSSSSS....',
    '...S1222222S....',
    '...S1222222S....',
    '...S1222SS2S....',
    '...S1222SS2S....',
    '...SSSSSSSSS....',
    '...S1222222S....',
    '...S2222223S....',
    '...S2333333S....',
    '....SSSSSSS.....',
    '................',
    '................',
  ],
  // Reaper: a scythe, its edge blood-bright.
  reaper: [
    '................',
    '.....SSSSSSS....',
    '...SSS2222221...',
    '..SS23.....l12..',
    '.S2.......l..2..',
    '.3.......l...3..',
    '.........l......',
    '........l.......',
    '.......l........',
    '......L.........',
    '.....L..........',
    '....l...........',
    '...l............',
    '..o.............',
    '................',
    '................',
  ],
  // Rally: a war horn, its call spreading.
  rally: [
    '................',
    '................',
    '...........111..',
    '..........1W331.',
    '..........13332.',
    '..........12222.',
    '...........1g22.',
    '...........1g23.',
    '..........12223.',
    '..P......122233.',
    '..Pq...1122233..',
    '...qq11222333...',
    '.....3333333....',
    '................',
    '................',
    '................',
  ],
  // Momentum: a wagon wheel rolling, its wind behind it.
  momentum: [
    '................',
    '................',
    '.......11111....',
    '.....112.l.122..',
    '....12...l...23.',
    '....1.l..l..l.3.',
    '...12..l.l.l..3.',
    '...1....lol...3.',
    '...1lllloWolll3.',
    '...2....lol...3.',
    '...2...l.l.l..3.',
    '....2.l..l..l3..',
    '....23...l..33..',
    '.......33333....',
    '..qq.qqqqqqqqq..',
    '................',
  ],
  // Last Rites: a headstone, a mending light over it.
  last_rites: [
    '................',
    '.......1........',
    '......121.......',
    '.......1........',
    '.....PPPPP......',
    '....PPPPPPp.....',
    '....PPqPqPp.....',
    '....PqqqqPp.....',
    '....PPqPPPp.....',
    '....PPqPPPp.....',
    '....PPPPPPp.....',
    '...2222222223...',
    '..222333333332..',
    '................',
    '................',
    '................',
  ],
  // Warden of Ash: an iron brazier, its fire banked.
  warden_of_ash: [
    '................',
    '......3...3.....',
    '.....323.323....',
    '.....32213223...',
    '....3221W1123...',
    '....321WWW113...',
    '...SSSSSSSSSSS..',
    '...SssssssssSs..',
    '....SsssssssS...',
    '.....SssssS.....',
    '.......Ss.......',
    '.......Ss.......',
    '.....SSssSS.....',
    '................',
    '................',
    '................',
  ],
  // Hexblade: a hexed dagger, its rune cold.
  hexblade: [
    '................',
    '.............1..',
    '............1W..',
    '...........1W2..',
    '..........1W2...',
    '.........1W2....',
    '........1123....',
    '.......1123.....',
    '..vv..1V23......',
    '...vvV123.......',
    '....vVV3........',
    '....oVv.........',
    '...oo..v........',
    '..oo............',
    '................',
    '................',
  ],
  // Stormcaller: a storm cloud, its bolt striking down.
  stormcaller: [
    '................',
    '.....SSS........',
    '...SSSSSSSS.....',
    '..SSSWSSSSSSs...',
    '.SSSSSSSSSSSss..',
    '.sSSSSSSSSSsss..',
    '..sssss1sssss...',
    '......11........',
    '.....111........',
    '.....11111......',
    '.......12.......',
    '......12........',
    '.....12.........',
    '.....2..........',
    '................',
    '................',
  ],
  // Tinker's Spark: a gear, a spark leaping off its teeth.
  tinkers_spark: [
    '................',
    '...........11...',
    '.....S.S..112...',
    '....SSSSS..12...',
    '..S.SsssS.1W21..',
    '..SSsS.SsS..12..',
    '...Ss...sS..2...',
    '..SSs...sSSS....',
    '...Ss...sS......',
    '..SSsS.SsS......',
    '..S.SsssS.S.....',
    '....SSSSS.......',
    '.....S.S........',
    '................',
    '................',
    '................',
  ],
}
