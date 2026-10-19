/**
 * The company faces at DOCK size — the five liaisons as the designer
 * APPROVED them (Oct 2026: Saffra, Hask, Brannoch, Odile, Wren; the finals
 * are `scripts/designs/`, listed in `scripts/liaison-finals.ts`), each
 * REDRAWN by hand for a 28 × 28 cell (shown at 2× in the home dock's slot) as
 * a small version of its final: the same silhouette, the same head-led
 * shapes and the final's own inks, letter for letter — never a downscale.
 * Hand-drawn pixel PARTS; each part is stamped back to
 * front with its own 1 px ring of the pack's outline (at 2× that is the
 * field figures' 2 px weight), so a head is outlined against its body and a
 * prop against its hand. Arms are drawn ON (sleeve to hand), never floating.
 *
 * Swappable like the field rig: a face is named parts + a palette; a frame
 * moves part GROUPS a pixel (or `nudge`s one part), hides / shows / swaps a
 * part (an arm reaching across, a sinking hat), and sets the eyes and where
 * they look (the five finals show none: hats, brows and pots hide them). Each face's motion is BRANDED (round 4, Oct 2026: the designer
 * asked for "unique movement in a branded way for that character"): its own
 * tempo, weight and kind of motion, held key poses (`idleMs`) at its own
 * co-prime period (2111, 3301, 4703, 3907, 5303 ms), its own tic on its own
 * interval with a hashed phase (they never sync), and its own reaction when
 * its slot is picked; `locked` turns it to a shadow. The briefs are above
 * {@link MINI_FACES}.
 * {@link miniAt} says which frame plays at a time — the dock's one clock.
 * Shipped in the home dock (October 2026): `ui/shell/DockFace.tsx` draws
 * these in place of the crests.
 *
 * Pure: no DOM.
 */
import { INK, RAMPS, SHADOW_ALPHA, rgbOf, type RampId } from './palette'
import type { PersonaId } from './rig'

export const MINI_W = 28
export const MINI_H = 28
/** The row the feet stand on (the shadow is the two rows under it). */
export const MINI_FEET = 24

export type Group = 'body' | 'head' | 'off' | 'main' | 'back'

export interface MiniPart {
  id: string
  group: Group
  x: number
  y: number
  rows: readonly string[]
  /** Hidden unless a frame shows it. */
  hidden?: boolean
  /** 0: no ink ring (a string, a strand drawn in ink). Default 1. */
  ring?: 0 | 1
}

export interface MiniKey {
  move?: Partial<Record<Group, readonly [number, number]>>
  /** Moves ONE part on top of its group (a sack tossed off the hand, a hat brim dropped over the eyes). */
  nudge?: Readonly<Record<string, readonly [number, number]>>
  /** Moves everything (a hop, a weight shift). */
  all?: readonly [number, number]
  /** 'wink': the near (last) eye shut; 'hidden': no eyes drawn (under a brim). */
  eyes?: 'open' | 'closed' | 'happy' | 'smug' | 'wink' | 'hidden'
  /** Where the eyes look: their px shifted this much inside the face (a glance up, a look back). */
  look?: readonly [number, number]
  show?: readonly string[]
  hide?: readonly string[]
  /** Replace a part's rows this frame (a tipped beam, a new chalk mark). */
  swap?: Readonly<Record<string, readonly string[]>>
  /** Loose pixels (a falling pinch, a glint): [x, y, ink letter]. */
  extra?: readonly (readonly [number, number, string])[]
}

export interface MiniFace {
  /**
   * letter → [ramp, tone 0..3] (0 shade · 1 mid · 2 light · 3 specular), or a
   * colour as `#rrggbb`: a liaison's dock figure keeps its approved final's
   * own inks (`scripts/designs/`), letter for letter.
   */
  inks: Readonly<Record<string, readonly [RampId, number] | string>>
  parts: readonly MiniPart[]
  /** The eyes (cell px of the base pose; they ride the head group). */
  eyes: readonly (readonly [number, number])[]
  /** Slit pupils (a reptile): the eye is gold with an ink slit. */
  slit?: boolean
  /** The skin an eye closes onto. */
  skin: string
  idle: readonly MiniKey[]
  /** The idle period (ms): evenly over its frames, or by {@link idleMs}. */
  period: number
  /** The idle's own holds (ms, summing to `period`): a held pose, a quick flick. Absent: even. */
  idleMs?: readonly number[]
  tic: readonly MiniKey[]
  ticMs: readonly number[]
  /** The tic plays every this many ms (the five all differ). */
  ticEvery: number
  react: readonly MiniKey[]
  reactMs: readonly number[]
}

/** A part's rows with row `i` dropped and a blank row on top: the mass sinks a px while its foot stays put (a squash). */
const sink = (rows: readonly string[], i: number): string[] => ['.'.repeat(rows[0].length), ...rows.filter((_, r) => r !== i)]
/** A part's rows with row `i` doubled (the last row dropped): it sags a px at that row. */
const sag = (rows: readonly string[], i: number): string[] => [...rows.slice(0, i + 1), ...rows.slice(i, -1)]

// ── Saffra (Peppercorn Co.), the Field Burner: saffra-d03-props.ts B1 ────────
const SAFFRA_HAT = [
  '.........VVbVVuUU.........',
  '.......VVbbVVVVuUUUU......',
  '......VVbVVVVVVuUUUUu.....',
  '......VbVVVVVVVuUUUUu.....',
  '......VVVVVVVVVuUUUUu.....',
  '......UVVVVVVVVuUUUuu.....',
  '......rRRRRRRRRRRRyOr.....',
  '......rrrrrrrrrrrrrrr.....',
  '.bVVVVVVVVVVVVVVVVVVVVVVU.',
  'UUUUUUUUUUUUUUUUUUUUUUUUUu',
  '.uuu..................uuu.',
]
const SAFFRA_SINK = sink(SAFFRA_HAT, 3)
// ── Hask (Butcherblock), the Salt-Barge Poleman: hask-d03.ts D03 ────────────
const HASK_CONE = [
  '.........T.........',
  '........uOo........',
  '.......uOOoo.......',
  '......uOOOooh......',
  '....uuOOOOOooh.....',
  '...uOOOOOOOooohh...',
  '.uuOOOOOOOOOoooHh..',
  'uuuuuuuuuuuuuuuuhhH',
]
const HASK_CONE_SINK = sink(HASK_CONE, 4)
const HASK_TAIL = ['GG.......', 'gGG......', '.gGGGGGGG', '..zgggggg']
const HASK_TAIL_UP = ['.GG......', 'gGG......', 'gGGGGGGGG', '.zgggggg.']
const HASK_TAIL_DOWN = ['.........', 'GG.......', 'gGGGGGGGG', 'zzgggggg.']
// ── Brannoch (Ironvein), the Mason Guild Elder: brannoch-d07.ts D07 ─────────
const BRANNOCH_DOME = ['...EEEEEE...', '..EFFEEEEe..', '.EFEEEEEEee.', 'EEEEEEEEeeee', 'eeEEEEEeeee.']
const BRANNOCH_DOME_SINK = sink(BRANNOCH_DOME, 2)
const BRANNOCH_BEARD = [
  '...LLLLLLLLLLMM.',
  '.LLLLLLLLLLLLMMM',
  '.LLLLLLLLLLLLMMM',
  'LLlLLLLLLLLMMMMM',
  'MLLLLLLLLMMMMMMm',
  '.MLMMMLMMMLMMmmm',
  '.MmmMmmMMmmMmmm.',
  '...mmmmmmmmm....',
]
const BRANNOCH_SAG = sag(BRANNOCH_BEARD, 5)
// ── Odile (Rosethread), the Ford Toll-Keeper: odile-d04-a-final.ts ──────────
const ODILE_LANTERN = ['.uo.', 'uyyo', 'uyyo', '.uu.']
const ODILE_LANTERN_LIT = ['.uo.', 'uwyo', 'uyyo', '.uu.']
const ODILE_BUD = ['.jQ.', 'jjQR', 'QQRr']
const ODILE_BUD_OPEN = ['j..Q', 'jjQR', 'QQRr']
// ── Wren (Greenvial), the Flowerpot Potter: wren-d09-E-smock-final.ts ───────
const WREN_POT = [
  '....ffLLLll....',
  '....fLLLLll....',
  '...ffLLLLlll...',
  '...fLLLLLlll...',
  '..ffLLLLLLJll..',
  '..fLLLLLLLlll..',
  '.ffLLLLLLLllll.',
  'ffffffffffLllll',
  'LLLLLLLLLLLLlll',
  'lllllllllllllll',
]
const WREN_POT_SINK = sink(WREN_POT, 3)
const WREN_NOSE = ['NNN', 'NmNN', 'NNMN', '.MM.']
const WREN_NOSE_BACK = ['NNN', 'NmNN', 'NMNN', 'MM..']
const WREN_NOSE_FWD = ['NNN', 'NmNN', 'NNNM', '..MM']
const WREN_NOSE_DROP = ['NNN', 'NmNN', 'NNNN', 'NNMN', '.MM.']

/*
 * THE FIVE LIAISONS (Oct 2026): each dock figure is a small, hand-drawn
 * version of its company liaison's APPROVED final (`scripts/designs/`, listed
 * in `scripts/liaison-finals.ts`): the same silhouette, the same head-led
 * shapes and the final's own inks, letter for letter; never a downscale. Each
 * moves in its final's spirit, at the dock's own co-prime clock (the periods
 * and tic intervals below never sync):
 *   Saffra   the weighty bob: the hat sinks, the body settles a beat later, the hat rebounds; smoke drifts off the ember pot;
 *            tic: the pot swung, the puff of smoke landing; react: the brim tipped up, a puff
 *   Odile    the ears lag: the lily pad and the head dip, the leaf ears follow a frame late and overshoot;
 *            tic: the ears prick, the toll lantern swings out blazing, the lotus opens; react: a slow half-bow, the ears trailing
 *   Brannoch planted: one slow breath (the dome sinks, the brows drop, the beard sags), then nothing;
 *            tic: the back hand strokes the beard down, twice, the brows lift; react: one gruff nod
 *   Hask     the poling breath: he leans in and settles, the pole following a frame late;
 *            tic: the stroke (draw up, plant, DRIVE, the brine thrown up); react: the cone dipped, the tail flicked
 *   Wren     the nose flop: the pot settles on his shoulders and the potato nose swings forward and back;
 *            tic: the root stick stamped (dust), the nose bouncing; react: the pot jolted, the nose flopping
 */
export const MINI_FACES: Readonly<Record<PersonaId, MiniFace>> = {
  saffra: {
    inks: {
      u: '#5a4646', U: '#866353', V: '#b48355', b: '#dab570', B: '#f5efa9',
      r: '#693d5b', R: '#b65555', Q: '#f76666', y: '#ffed44', O: '#d08c41', o: '#a38250', g: '#dab570',
      x: '#5e474e', X: '#87465a', h: '#b16c4d', H: '#d9945f', q: '#87465a',
      e: '#977b6b', E: '#d5b583', F: '#efe1ab',
      i: '#394243', I: '#4f5e65', J: '#737f8e', K: '#bac1c8',
    },
    skin: 'E',
    parts: [
      { id: 'tails', group: 'head', x: 3, y: 15, rows: ['RQ.', '.RR'] },
      { id: 'boots', group: 'back', x: 9, y: 22, rows: ['uUU...uUU..', 'uUUU..uUUUV'] },
      { id: 'body', group: 'body', x: 8, y: 15, rows: ['..xXXXXXXx..', '.xXXgggggXx.', '.xRRRRRRRRRx', 'xxXgggggggXx', 'xUXOggggOgXx', 'xuXOOgOgOOXx', '.xuuQuuyuux.'] },
      { id: 'hair', group: 'head', x: 5, y: 15, rows: ['hHHh', 'qhh.'] },
      { id: 'mask', group: 'head', x: 16, y: 15, rows: ['EEFE', 'RRRR', '.RR.'] },
      { id: 'head', group: 'head', x: 1, y: 3, rows: SAFFRA_HAT },
      { id: 'handB', group: 'off', x: 6, y: 18, rows: ['EE', 'eE'] },
      { id: 'pot', group: 'main', x: 20, y: 19, rows: ['.QyyQ.', 'JKKKKJ', 'iIJJIi', 'iIIIIi', '.iiii.'] },
      { id: 'handF', group: 'main', x: 20, y: 18, rows: ['EE', 'Ee'] },
      { id: 'smoke', group: 'main', x: 25, y: 17, rows: ['K'] },
      { id: 'puff', group: 'main', x: 23, y: 13, hidden: true, rows: ['.KK.', 'KJJK', '.JJ.'] },
    ],
    eyes: [],
    // the weighty bob: the hat sinks, the hands and the pot settle a beat later, the hat rebounds a px; the smoke drifts up and thins
    // (two of the final's loops in the dock's one)
    idle: [
      {},
      { swap: { head: SAFFRA_SINK }, nudge: { smoke: [0, -1] } },
      { swap: { head: SAFFRA_SINK }, move: { main: [0, 1], off: [0, 1] }, nudge: { smoke: [0, -1] } },
      { move: { main: [0, 1], off: [0, 1] }, nudge: { smoke: [1, -2] } },
      { move: { head: [0, -1] }, nudge: { smoke: [1, -2] } },
      { hide: ['smoke'] },
      {},
      { swap: { head: SAFFRA_SINK }, nudge: { smoke: [0, -1] } },
      { swap: { head: SAFFRA_SINK }, move: { main: [0, 1], off: [0, 1] }, nudge: { smoke: [0, -1] } },
      { move: { main: [0, 1], off: [0, 1] }, nudge: { smoke: [1, -2] } },
      { move: { head: [0, -1] }, nudge: { smoke: [1, -2] } },
      { hide: ['smoke'] },
    ],
    idleMs: [220, 130, 150, 230, 140, 170, 220, 130, 150, 230, 140, 201],
    period: 2111,
    // the ember pot swung back, then forward and up: the puff lands on the third frame and drifts off; the hat lifts
    tic: [
      { nudge: { pot: [-1, 0] }, hide: ['smoke'] },
      { nudge: { pot: [1, -1] }, swap: { head: SAFFRA_SINK }, hide: ['smoke'] },
      { nudge: { pot: [1, 0] }, swap: { head: SAFFRA_SINK }, show: ['puff'], hide: ['smoke'] },
      { show: ['puff'], nudge: { puff: [1, -1] }, hide: ['smoke'] },
      { show: ['puff'], nudge: { puff: [2, -2] } },
      { move: { head: [0, -1] } },
      {},
    ],
    ticMs: [90, 100, 260, 200, 220, 120, 160],
    ticEvery: 4300,
    // "Deal!": the brim tipped up at you, a puff off the coals, held
    react: [
      { move: { head: [0, -1] } },
      { move: { head: [0, -1] }, show: ['puff'], nudge: { pot: [1, -1] } },
      { show: ['puff'], nudge: { puff: [1, -1] } },
      {},
    ],
    reactMs: [80, 120, 440, 200],
  },
  odile: {
    inks: {
      e: '#977b6b', E: '#d5b583', F: '#efe1ab', r: '#693d5b', R: '#ab6282', Q: '#c5836e',
      p: '#433d5b', P: '#775396', i: '#a8719a', g: '#2f966a', G: '#38b251', v: '#95d562', V: '#bdd763',
      o: '#b48355', O: '#d9945f', y: '#ffed44', u: '#6f5a48', U: '#866353',
      n: '#404e75', N: '#3e8698', t: '#5ab3ac', j: '#ffcfb4', w: '#ffffff',
    },
    skin: 'E',
    parts: [
      { id: 'boots', group: 'body', x: 11, y: 22, rows: ['uU.uU.', 'uUU.uUU'] },
      { id: 'cloak', group: 'body', x: 7, y: 13, rows: ['....tttNNn....', '...ttttNjNn...', '...tttNNjQNn..', '..ttttNNjjQn..', '..tttNNNjjQQn.', '.ttttNNNjjjQn.', '.tttNNNNjjjQQn', 'tttNNNNjjjjQQn', 'nnnnnnnjjjjQQQ'] },
      { id: 'satchel', group: 'body', x: 6, y: 17, rows: ['UOU', 'UyU', 'uuu'] },
      { id: 'earL', group: 'back', x: 1, y: 10, rows: ['FFEe...', '.eEEEe.'] },
      { id: 'earR', group: 'back', x: 21, y: 7, rows: ['....F', '..EEF', 'eEEE.', '.e...'] },
      { id: 'face', group: 'head', x: 13, y: 12, rows: ['FEE', 'EEE', '.e.'] },
      { id: 'hair', group: 'head', x: 7, y: 11, rows: ['.pPPiPPPPPPPp.', 'pPPiPPp...PPPp', 'pPPPPp.....PPp', '.pPPp......pp.'] },
      { id: 'head', group: 'head', x: 6, y: 8, rows: ['..VVVVVVvvvv..', 'VVVwVVVvvvvvvG', '.GGGGGGGG.GGG.'] },
      { id: 'lotus', group: 'head', x: 11, y: 5, rows: ODILE_BUD },
      { id: 'lantern', group: 'main', x: 20, y: 18, rows: ODILE_LANTERN },
      { id: 'handB', group: 'off', x: 5, y: 16, rows: ['EE', 'eE'] },
      { id: 'handF', group: 'main', x: 20, y: 16, rows: ['EEe', '.e.'] },
    ],
    eyes: [],
    // the head mass dips (the pad, the bud, the hair), the leaf ears follow a frame late and overshoot, then rise
    // (two of the final's loops, a touch slower, then a held breath)
    idle: [
      {},
      { move: { head: [0, 1] } },
      { move: { head: [0, 1], main: [0, 1], off: [0, 1], back: [0, 1] } },
      { move: { head: [0, 1], main: [0, 1], off: [0, 1], back: [0, 2] } },
      { move: { back: [0, 2] } },
      { move: { back: [0, 1] } },
      {},
      { move: { head: [0, 1] } },
      { move: { head: [0, 1], main: [0, 1], off: [0, 1], back: [0, 1] } },
      { move: { head: [0, 1], main: [0, 1], off: [0, 1], back: [0, 2] } },
      { move: { back: [0, 2] } },
      { move: { back: [0, 1] } },
      {},
    ],
    idleMs: [285, 195, 225, 300, 225, 255, 285, 195, 225, 300, 225, 255, 331],
    period: 3301,
    // her ears prick at a barge's bell; the lantern swings back, then out at arm's length, blazing, the lotus opening; held; home
    tic: [
      { nudge: { earL: [-1, -1], earR: [1, -1], lantern: [-1, 0] } },
      { nudge: { earL: [-1, -1], earR: [1, -1], lantern: [1, 0], handF: [1, 0] } },
      { nudge: { earL: [-1, -1], earR: [1, -1], lantern: [2, 0], handF: [1, 0] }, swap: { lantern: ODILE_LANTERN_LIT, lotus: ODILE_BUD_OPEN } },
      { nudge: { lantern: [2, 0], handF: [1, 0] }, swap: { lantern: ODILE_LANTERN_LIT, lotus: ODILE_BUD_OPEN } },
      { nudge: { lantern: [1, 0] }, swap: { lotus: ODILE_BUD_OPEN } },
      { nudge: { lotus: [0, 1] } },
    ],
    ticMs: [130, 90, 190, 320, 180, 170],
    ticEvery: 6300,
    // a slow half-bow, the ears trailing a beat behind; she rises
    react: [
      { move: { head: [0, 1] } },
      { move: { head: [0, 1], back: [0, 1] } },
      { move: { head: [0, 2], back: [0, 1] } },
      { move: { head: [0, 1] }, nudge: { earL: [0, 1], earR: [0, 1] } },
      {},
    ],
    reactMs: [200, 240, 460, 240, 260],
  },
  brannoch: {
    inks: {
      e: '#977b6b', E: '#d5b583', F: '#efe1ab', c: '#a06961', C: '#c88176', D: '#f69e7d',
      m: '#a29395', M: '#c3c1a6', L: '#e1d4bd', l: '#fffce7',
      i: '#4f5e65', I: '#737f8e', J: '#bac1c8',
      u: '#5a4646', U: '#866353', V: '#b48355', p: '#796865', P: '#a39681', T: '#bcaba8', b: '#6f5a48',
    },
    skin: 'E',
    parts: [
      { id: 'boots', group: 'back', x: 8, y: 22, rows: ['.bu.....bb.', 'uuI.....uuuJ'] },
      { id: 'body', group: 'body', x: 6, y: 17, rows: ['.TPPPPPPPPPPpp.', '.UUUUUUUUUUUuu.', 'TPPPPPPPPPPPPpp', 'TPPPPPPPPPPpPpp'] },
      { id: 'pouch', group: 'body', x: 7, y: 19, rows: ['VVu', 'Uuu'] },
      { id: 'chisel', group: 'body', x: 18, y: 19, rows: ['J', 'J'] },
      { id: 'apron', group: 'body', x: 10, y: 18, rows: ['.VVVVVU.', 'VVVVVVUu', 'VVVVuuUu', 'VVVVVVUu'] },
      { id: 'fringe', group: 'head', x: 6, y: 7, rows: ['.LLM', 'LLMm', 'MMMm'] },
      { id: 'dome', group: 'head', x: 8, y: 4, rows: BRANNOCH_DOME },
      { id: 'head', group: 'head', x: 5, y: 10, rows: BRANNOCH_BEARD },
      { id: 'brows', group: 'head', x: 11, y: 8, rows: ['LLLL.LLLL', '.MM...MM.'] },
      { id: 'moustache', group: 'head', x: 10, y: 11, rows: ['.LLLLLLLLLM', 'LLL.....MMM'] },
      { id: 'nose', group: 'head', x: 17, y: 9, rows: ['.DC.', 'DCCc', '.cc.'] },
      { id: 'mallet', group: 'main', x: 21, y: 20, rows: ['...V..', 'JVVVVJ', 'IVVVUI'] },
      { id: 'handB', group: 'off', x: 4, y: 19, rows: ['.EE', 'eEE'] },
      { id: 'handF', group: 'main', x: 22, y: 18, rows: ['.E.', 'eEE', '.e.'] },
    ],
    eyes: [],
    // one slow breath: the dome sinks a px, the brows drop, the beard sags and the hands settle; held; then a long, planted stillness
    idle: [
      {},
      { swap: { dome: BRANNOCH_DOME_SINK }, nudge: { brows: [0, 1] } },
      { swap: { dome: BRANNOCH_DOME_SINK, head: BRANNOCH_SAG }, nudge: { brows: [0, 1] }, move: { main: [0, 1], off: [0, 1] } },
      { swap: { dome: BRANNOCH_DOME_SINK }, nudge: { brows: [0, 1] } },
      {},
    ],
    idleMs: [2400, 300, 1120, 300, 583],
    period: 4703,
    // the back hand comes up onto the beard and strokes it down, twice; the brows lift, fond
    tic: [
      { nudge: { handB: [2, -5] }, swap: { dome: BRANNOCH_DOME_SINK } },
      { nudge: { handB: [2, -3], brows: [0, -1] }, swap: { head: BRANNOCH_SAG } },
      { nudge: { handB: [2, -1], brows: [0, -1] }, swap: { head: BRANNOCH_SAG } },
      { nudge: { handB: [2, -5], brows: [0, -1] }, swap: { dome: BRANNOCH_DOME_SINK } },
      { nudge: { handB: [2, -3], brows: [0, -1] }, swap: { head: BRANNOCH_SAG } },
      { nudge: { handB: [1, 0] }, swap: { dome: BRANNOCH_DOME_SINK, head: BRANNOCH_SAG } },
    ],
    ticMs: [260, 280, 300, 240, 300, 320],
    ticEvery: 7900,
    // one gruff nod: the brows drop first, the head goes down a px and holds, comes back
    react: [{ nudge: { brows: [0, 1] } }, { move: { head: [0, 1] }, nudge: { brows: [0, 1] } }, {}],
    reactMs: [120, 380, 220],
  },
  hask: {
    inks: {
      z: '#3d4f4d', g: '#5a7d53', G: '#728844', v: '#9bb94e', V: '#bdd763', y: '#ffed44',
      c: '#977b6b', C: '#d5b583', d: '#efe1ab', h: '#5a4646', H: '#866353', i: '#b48355', a: '#6f5a48',
      l: '#9e8776', L: '#e1d4bd', m: '#fffce7', o: '#a38250', O: '#cea554', u: '#f1da84', T: '#b3a645',
      '4': '#2a485e', '5': '#4f7585', '6': '#83a2ac', w: '#ffffff',
    },
    skin: 'G',
    parts: [
      { id: 'tail', group: 'back', x: 2, y: 18, rows: HASK_TAIL },
      { id: 'legs', group: 'back', x: 12, y: 20, rows: ['G...G.', 'Gv..Gv', 'gv..gv'] },
      { id: 'feet', group: 'back', x: 12, y: 23, ring: 0, rows: ['kk..kk'] },
      { id: 'pole', group: 'off', x: 5, y: 13, rows: ['i...................', '.HH.................', '...HH...............', '.....HH.............', '.......HH...........', '.........HH.........', '...........HH.......', '.............HH.....', '...............HH...', '.................556'] },
      { id: 'smock', group: 'body', x: 9, y: 13, rows: ['...5566...', '..556666..', '.55566665.', '.OuOuOuOu.', '4555555554', '45L5mL5m54', '4mLmLmLmL4'] },
      { id: 'snout', group: 'head', x: 16, y: 11, rows: ['gGGGGyz..', 'gGGGGGGVV', '.gCCCCCC.'] },
      { id: 'head', group: 'head', x: 8, y: 3, rows: HASK_CONE },
      { id: 'gripFar', group: 'main', x: 5, y: 12, rows: ['Gv', 'gG'] },
      { id: 'armF', group: 'main', x: 18, y: 15, rows: ['G.', 'Gv', 'gv', 'zg'] },
      { id: 'splash', group: 'off', x: 23, y: 20, hidden: true, ring: 0, rows: ['.w..', 'w6.6', '.66.'] },
      { id: 'splash2', group: 'off', x: 21, y: 17, hidden: true, ring: 0, rows: ['..w..w', '.w6.w6', 'w66w66', '.6556.'] },
    ],
    eyes: [],
    // the poling breath, twice a loop: he leans into the pole and settles onto his legs, the pole following a frame late
    idle: [
      {},
      { move: { head: [1, 0], body: [1, 0], main: [1, 0] } },
      { move: { head: [1, 1], body: [1, 0], main: [1, 1] }, swap: { head: HASK_CONE_SINK } },
      { move: { head: [1, 1], body: [1, 0], main: [1, 1], off: [1, 1] }, swap: { head: HASK_CONE_SINK } },
      { move: { head: [1, 0], body: [1, 0], main: [1, 0], off: [1, 1] } },
      {},
      { move: { head: [1, 0], body: [1, 0], main: [1, 0] } },
      { move: { head: [1, 1], body: [1, 0], main: [1, 1] }, swap: { head: HASK_CONE_SINK } },
      { move: { head: [1, 1], body: [1, 0], main: [1, 1], off: [1, 1] }, swap: { head: HASK_CONE_SINK } },
      { move: { head: [1, 0], body: [1, 0], main: [1, 0], off: [1, 1] } },
    ],
    idleMs: [1000, 180, 200, 300, 200, 667, 180, 200, 300, 680],
    period: 3907,
    // the stroke: draw up (the tail lifts), plant, DRIVE — the brine thrown up — hold, recover
    tic: [
      { move: { head: [-1, 0], body: [-1, 0], main: [-1, 0], off: [-1, 0] }, swap: { tail: HASK_TAIL_UP } },
      { show: ['splash'] },
      { move: { head: [1, 1], body: [1, 0], main: [1, 1], off: [-1, 0] }, swap: { tail: HASK_TAIL_DOWN, head: HASK_CONE_SINK }, show: ['splash2'] },
      { move: { head: [1, 1], body: [1, 0], main: [1, 1], off: [-1, 0] }, swap: { tail: HASK_TAIL_DOWN, head: HASK_CONE_SINK }, show: ['splash2'], nudge: { splash2: [0, -1] } },
      { move: { head: [1, 0], body: [1, 0], main: [1, 0] } },
      {},
    ],
    ticMs: [200, 100, 140, 340, 220, 240],
    ticEvery: 5500,
    // dry and patient: the cone dips at you, slowly; the tail's tip flicks; he straightens
    react: [
      { move: { head: [0, 1] } },
      { move: { head: [0, 1] }, swap: { head: HASK_CONE_SINK, tail: HASK_TAIL_UP } },
      { move: { head: [0, 1] }, swap: { head: HASK_CONE_SINK } },
      {},
    ],
    reactMs: [140, 160, 420, 260],
  },
  wren: {
    inks: {
      g: '#27716f', j: '#2f966a', J: '#5ab659', i: '#bdd763', v: '#387253', V: '#529650', W: '#7cbb4e',
      y: '#f4e341', H: '#dab570', h: '#b48355', d: '#5a4646', D: '#866353',
      e: '#977b6b', E: '#d5b583', n: '#9e7466', N: '#c5836e', m: '#ffcfb4', M: '#eb876a',
      l: '#a55a50', L: '#cc804b', f: '#d9945f', I: '#bcada7', X: '#8e7b67',
    },
    skin: 'N',
    parts: [
      { id: 'boots', group: 'back', x: 9, y: 22, rows: ['DhD..Dh.', 'dDDd.dDDd'] },
      { id: 'body', group: 'body', x: 6, y: 14, rows: ['...iiiiiiiii...', '..iJJJJJJJJJj..', '.dJJJJJJJJJJjg.', 'jJddJJJJJJJJjgg', 'jJJJddddydddjgg', 'jJjJJjJJjJJjggg', '.jJjJJjJJjJjgg.', '..jjjjjjjjjgg..'] },
      { id: 'armB', group: 'off', x: 4, y: 15, rows: ['.jj', 'jJ.', 'jj.', '.jj'] },
      { id: 'handB', group: 'off', x: 7, y: 18, rows: ['eE', 'Ee'] },
      { id: 'beard', group: 'head', x: 9, y: 14, rows: ['IIII..IIII', '.XII..IIX.'] },
      { id: 'nose', group: 'head', x: 13, y: 14, rows: WREN_NOSE },
      { id: 'head', group: 'head', x: 6, y: 4, rows: WREN_POT },
      { id: 'sprout', group: 'head', x: 11, y: 2, rows: ['iJ.Ji', '..v..'] },
      { id: 'armF', group: 'main', x: 19, y: 15, rows: ['jj.', '.jj', '..j'] },
      { id: 'stick', group: 'main', x: 23, y: 16, rows: ['H', 'D', 'D', 'D', 'D', 'D', 'D', 'd'] },
      { id: 'handF', group: 'main', x: 22, y: 17, rows: ['eE', 'Ee'] },
      { id: 'dust', group: 'main', x: 22, y: 22, hidden: true, ring: 0, rows: ['I...I', '.I.I.'] },
    ],
    eyes: [],
    // the pot settles onto his shoulders (it sinks a px, the hands with it) and the potato nose swings forward and back under the rim
    idle: [
      { swap: { nose: WREN_NOSE_BACK } },
      { swap: { head: WREN_POT_SINK }, nudge: { sprout: [0, 1] } },
      { swap: { head: WREN_POT_SINK }, nudge: { sprout: [0, 1] }, move: { main: [0, 1], off: [0, 1] } },
      { swap: { head: WREN_POT_SINK, nose: WREN_NOSE_FWD }, nudge: { sprout: [0, 1] }, move: { main: [0, 1], off: [0, 1] } },
      { swap: { nose: WREN_NOSE_FWD }, move: { main: [0, 1], off: [0, 1] } },
      {},
    ],
    idleMs: [2400, 300, 280, 900, 450, 973],
    period: 5303,
    // he lifts the root stick and stamps it (dust, the pot jolts); the nose drops, swings forward and back, and hangs still
    tic: [
      { nudge: { stick: [0, -1], handF: [0, -1], armF: [0, -1] }, swap: { nose: WREN_NOSE_BACK } },
      { nudge: { stick: [0, -2], handF: [0, -2], armF: [0, -1] } },
      { swap: { head: WREN_POT_SINK, nose: WREN_NOSE_DROP }, nudge: { sprout: [0, 1] }, move: { main: [0, 1], off: [0, 1] }, show: ['dust'] },
      { swap: { head: WREN_POT_SINK, nose: WREN_NOSE_FWD }, show: ['dust'], nudge: { dust: [0, -1], sprout: [0, 1] } },
      { swap: { nose: WREN_NOSE_BACK } },
      {},
    ],
    ticMs: [200, 200, 190, 240, 200, 260],
    ticEvery: 7100,
    // the pot jolts down onto his shoulders and the nose flops: down, forward, back, still
    react: [
      { swap: { head: WREN_POT_SINK, nose: WREN_NOSE_DROP }, nudge: { sprout: [0, 1] } },
      { swap: { nose: WREN_NOSE_FWD } },
      { swap: { nose: WREN_NOSE_BACK } },
      { swap: { nose: WREN_NOSE_FWD } },
      {},
    ],
    reactMs: [140, 180, 220, 200, 260],
  },
}

export type MiniAnim = 'idle' | 'tic' | 'react'

export const miniFrames = (id: PersonaId, anim: MiniAnim): number => {
  const f = MINI_FACES[id]
  return anim === 'idle' ? f.idle.length : anim === 'tic' ? f.tic.length : f.react.length
}

/** Per-frame hold times (ms). */
export function miniMs(id: PersonaId, anim: MiniAnim): number[] {
  const f = MINI_FACES[id]
  if (anim === 'idle') return f.idleMs ? [...f.idleMs] : f.idle.map(() => f.period / f.idle.length)
  return [...(anim === 'tic' ? f.ticMs : f.reactMs)]
}
/** For the previews (the dock reads {@link miniAt}). */
export const MINI_MS = {
  idle: [320, 320, 320, 320],
  tic: [160, 160, 320, 320, 200, 160],
  react: [90, 140, 120, 160],
} as const

/** A small stable hash in [0, 1). */
function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10007) / 10007
}
/**
 * The tic's phase (ms into its interval): a hash of the face, so the five never
 * sync. The salt is the one (of 20,000 tried, `TIC_SALT`) whose first twelve
 * seconds open with nobody mid-tic, never have three faces ticking at once,
 * and start no two tics closest together (here ≥ 0.58 s apart).
 */
const TIC_SALT = 16744
export const ticPhase = (id: PersonaId): number => Math.round(hash01(`tic:${TIC_SALT}:${id}`) * MINI_FACES[id].ticEvery)

/** Which frame of an animation plays `into` ms after it starts (−1 once it is over). */
function frameAt(ms: readonly number[], into: number): number {
  let acc = 0
  for (let i = 0; i < ms.length; i++) { acc += ms[i]; if (into < acc) return i }
  return -1
}

/** How a face's clock runs: picked at `pickedAt` (ms), held `still` (reduced motion), the tic played only every `ticEach`th time (Light: 2). */
export interface ClockOpts {
  pickedAt?: number
  still?: boolean
  ticEach?: number
}

/**
 * The one clock every company face moves by, at any size: the idle loop at
 * the face's own period; the tic on its own interval and hashed phase; the
 * reaction for its length once picked at `pickedAt`. Under reduced motion
 * only the still pose. WHEN each plays (the idle `period`, the tic's and the
 * reaction's lengths, `ticEvery`, the phase) is the dock face's, so a face at
 * two sizes moves in step with itself and out of step with the other four;
 * WHICH frame is `face`'s own holds (`idleMs` / `ticMs` / `reactMs`, or even
 * idle beats), scaled to fit.
 */
export function spriteAt(id: PersonaId, face: MiniFace, t: number, o: ClockOpts = {}): { anim: MiniAnim; frame: number } {
  if (o.still) return { anim: 'idle', frame: 0 }
  const clock = MINI_FACES[id]
  const sum = (ms: readonly number[]) => ms.reduce((a, b) => a + b, 0)
  // WHEN each animation plays is the dock face's (its lengths); WHICH frame is this face's own holds, scaled to fit
  const within = (own: readonly number[], len: number, into: number) => frameAt(own, (into * sum(own)) / len)
  if (o.pickedAt != null && t >= o.pickedAt) {
    const len = sum(clock.reactMs)
    if (t - o.pickedAt < len) return { anim: 'react', frame: Math.max(0, within(face.reactMs, len, t - o.pickedAt)) }
  }
  const ticLen = sum(clock.ticMs)
  const shifted = t + ticPhase(id)
  const into = ((shifted % clock.ticEvery) + clock.ticEvery) % clock.ticEvery
  // `ticEach` n: only every nth tic plays (Light: 2, half as often), on the same phase, so the five stay out of step
  const each = Math.max(1, Math.round(o.ticEach ?? 1))
  const nth = Math.floor(shifted / clock.ticEvery)
  if (into < ticLen && ((nth % each) + each) % each === 0) return { anim: 'tic', frame: Math.max(0, within(face.ticMs, ticLen, into)) }
  const phase = ((t % clock.period) + clock.period) % clock.period
  const holds = face.idleMs ?? face.idle.map(() => 1)
  return { anim: 'idle', frame: Math.max(0, within(holds, clock.period, phase)) }
}

/**
 * What a dock figure shows at time `t` (ms): the idle loop at its own period;
 * the tic on its own interval and phase; the reaction for its length once the
 * slot is picked at `pickedAt`. Under reduced motion only the still pose.
 */
export function miniAt(id: PersonaId, t: number, o: ClockOpts = {}): { anim: MiniAnim; frame: number } {
  return spriteAt(id, MINI_FACES[id], t, o)
}

export interface MiniFrame {
  w: number
  h: number
  rgba: Uint8ClampedArray
}

const INK_RGB = rgbOf(INK)

/** How one size is painted: its cell, its ground shadow, its eyes, and whether it gets the pack's outer px. */
export interface SpriteSize {
  w: number
  h: number
  /** The shadow: centre, radii (px), drawn under everything. */
  shadow: { cx: number; cy: number; rx: number; ry: number; rows?: readonly [number, number] }
  /**
   * One more px of ink round the whole figure, so the outer line is 2 px
   * (the pack's at the field's scale) while the lines between parts stay 1.
   */
  outer: boolean
  /** Eyes: 'dot' 1 × 2 (the dock), 'pack' 2 × 3 (the field's: small and dark, as the pack's). */
  eyes: 'dot' | 'pack'
}

export const DOCK_SIZE: SpriteSize = { w: MINI_W, h: MINI_H, shadow: { cx: 13.5, cy: MINI_FEET + 1.6, rx: 8, ry: 1.3, rows: [MINI_FEET + 1, MINI_FEET + 2] }, outer: false, eyes: 'dot' }

/** One dock frame. `locked`: the figure as a shadow (the company not open yet). */
export function miniFrame(id: PersonaId, anim: MiniAnim, frame: number, locked = false): MiniFrame {
  return paintSprite(MINI_FACES[id], anim, frame, locked, DOCK_SIZE)
}

/**
 * Paint one frame of a hand-drawn face at one size: the shadow; each part back
 * to front, ringed in 1 px of ink, at its group's offset this frame; the outer
 * px if the size takes one; then the eyes by expression and loose pixels.
 */
export function paintSprite(face: MiniFace, anim: MiniAnim, frame: number, locked: boolean, size: SpriteSize): MiniFrame {
  const keys = anim === 'idle' ? face.idle : anim === 'tic' ? face.tic : face.react
  const k = keys[((frame % keys.length) + keys.length) % keys.length] ?? {}
  const W = size.w, H = size.h
  const rgba = new Uint8ClampedArray(W * H * 4)
  const all = k.all ?? [0, 0]
  const lift = -Math.min(0, all[1])
  // the ground shadow stays on the ground (and shrinks a little in a hop)
  const sh = size.shadow
  for (let y = sh.rows?.[0] ?? Math.floor(sh.cy - sh.ry); y <= (sh.rows?.[1] ?? Math.ceil(sh.cy + sh.ry)); y++)
    for (let x = Math.floor(sh.cx - sh.rx); x <= Math.ceil(sh.cx + sh.rx); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue
      const rx = sh.rx - lift * 0.5
      if (((x + 0.5 - sh.cx) / rx) ** 2 + ((y + 0.5 - sh.cy) / sh.ry) ** 2 > 1) continue
      rgba.set([...INK_RGB, SHADOW_ALPHA], (y * W + x) * 4)
    }
  const colour = (ch: string): [number, number, number] => {
    if (ch === 'k') return INK_RGB
    const ink = face.inks[ch]
    if (!ink) return INK_RGB
    if (typeof ink === 'string') {
      const rgb = rgbOf(ink)
      // a shadow: the lit half of the inks in the lighter navy, the rest in the darker
      return locked ? rgbOf(RAMPS.navy[rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11 >= 150 ? 1 : 0]) : rgb
    }
    if (locked) return rgbOf(RAMPS.navy[ink[1] >= 2 ? 1 : 0])
    return rgbOf(RAMPS[ink[0]][ink[1]])
  }
  const offOf = (g: Group): [number, number] => {
    const m = k.move?.[g] ?? [0, 0]
    return [m[0] + all[0], m[1] + all[1]]
  }
  const put = (x: number, y: number, rgb: readonly number[]) => { if (x >= 0 && y >= 0 && x < W && y < H) rgba.set([...rgb, 255], (y * W + x) * 4) }
  const isInk = (x: number, y: number) => {
    const o = (y * W + x) * 4
    return rgba[o + 3] === 255 && rgba[o] === INK_RGB[0] && rgba[o + 1] === INK_RGB[1] && rgba[o + 2] === INK_RGB[2]
  }
  for (const part of face.parts) {
    const shown = part.hidden ? k.show?.includes(part.id) : !k.hide?.includes(part.id)
    if (!shown) continue
    const [gx, gy] = offOf(part.group)
    const nu = k.nudge?.[part.id] ?? [0, 0]
    const dx = gx + nu[0], dy = gy + nu[1]
    const rows = k.swap?.[part.id] ?? part.rows
    const px: [number, number, string][] = []
    rows.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch !== '.') px.push([part.x + rx + dx, part.y + ry + dy, ch]) }))
    const own = new Set(px.map(([x, y]) => y * W + x))
    if (part.ring !== 0)
      for (const [x, y] of px)
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const xx = x + ox, yy = y + oy
          if (xx < 0 || yy < 0 || xx >= W || yy >= H || own.has(yy * W + xx)) continue
          put(xx, yy, INK_RGB)
        }
    for (const [x, y, ch] of px) put(x, y, colour(ch))
  }
  if (size.outer) {
    const add: number[] = []
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (rgba[(y * W + x) * 4 + 3] === 255) continue
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const xx = x + ox, yy = y + oy
          if (xx >= 0 && yy >= 0 && xx < W && yy < H && isInk(xx, yy)) { add.push(y * W + x); break }
        }
      }
    for (const i of add) rgba.set([...INK_RGB, 255], i * 4)
  }
  if (!locked) {
    const [gx, gy] = offOf('head')
    const hn = k.nudge?.head ?? [0, 0], lk = k.look ?? [0, 0]
    const hx = gx + hn[0] + lk[0], hy = gy + hn[1] + lk[1]
    const skin = colour(face.skin)
    face.eyes.forEach(([ex, ey], i) => {
      const x = ex + hx, y = ey + hy
      // a wink shuts the near (last) eye only
      const mode = k.eyes === 'wink' ? (i === face.eyes.length - 1 ? 'closed' : 'open') : (k.eyes ?? 'open')
      if (mode === 'hidden') return
      if (size.eyes === 'pack') return packEye(put, x, y, mode, !!face.slit, skin, colour)
      if (face.slit) {
        // a gold eye with an ink slit; shut, a line
        if (mode === 'closed') { put(x - 1, y + 1, INK_RGB); put(x, y + 1, INK_RGB); put(x - 1, y, skin); put(x, y, skin) }
        else if (mode === 'smug') { put(x - 1, y, INK_RGB); put(x, y, INK_RGB); put(x - 1, y + 1, colour('Y')); put(x, y + 1, INK_RGB) }
        else { put(x - 1, y, colour('Y')); put(x, y, INK_RGB); put(x - 1, y + 1, colour('Y')); put(x, y + 1, INK_RGB) }
        return
      }
      if (mode === 'open') { put(x, y, INK_RGB); put(x, y + 1, INK_RGB) }
      else if (mode === 'closed') { put(x, y, skin); put(x - (i ? 0 : 1), y + 1, INK_RGB); put(x + (i ? 1 : 0), y + 1, INK_RGB) }
      else if (mode === 'happy') { put(x - (i ? 0 : 1), y, INK_RGB); put(x + (i ? 1 : 0), y, INK_RGB); put(x, y + 1, skin) }
      else { put(x - (i ? 0 : 1), y, INK_RGB); put(x + (i ? 1 : 0), y, INK_RGB); put(x, y + 1, INK_RGB) }
    })
    for (const [ex, ey, ch] of k.extra ?? []) put(ex + all[0], ey + all[1], colour(ch))
  }
  return { w: W, h: H, rgba }
}

/**
 * The field-size eye (the pack's goblins': small and dark, never a white disc):
 * open, a 2 × 3 ink mark; shut, a low arc; happy, a raised arc; smug, a lid
 * over a low pupil. A reptile's is a 3 × 3 gold eye with an ink slit.
 */
function packEye(put: (x: number, y: number, rgb: readonly number[]) => void, x: number, y: number, mode: string, slit: boolean, skin: readonly number[], colour: (ch: string) => [number, number, number]): void {
  const box = (rgb: readonly number[], x0: number, x1: number) => { for (let yy = y; yy < y + 3; yy++) for (let xx = x0; xx <= x1; xx++) put(xx, yy, rgb) }
  if (slit) {
    const gold = rgbOf(RAMPS.gold[2])
    box(skin, x - 1, x + 1)
    if (mode === 'closed') { put(x - 1, y + 2, INK_RGB); put(x, y + 2, INK_RGB); put(x + 1, y + 2, INK_RGB); return }
    box(gold, x - 1, x + 1)
    for (let yy = y; yy < y + 3; yy++) put(x, yy, INK_RGB)
    if (mode === 'smug') { put(x - 1, y, INK_RGB); put(x + 1, y, INK_RGB) }
    void colour
    return
  }
  box(skin, x, x + 1)
  if (mode === 'open') { box(INK_RGB, x, x + 1); return }
  if (mode === 'closed') { put(x - 1, y + 1, INK_RGB); put(x, y + 2, INK_RGB); put(x + 1, y + 2, INK_RGB); put(x + 2, y + 1, INK_RGB); return }
  if (mode === 'happy') { put(x - 1, y + 1, INK_RGB); put(x, y, INK_RGB); put(x + 1, y, INK_RGB); put(x + 2, y + 1, INK_RGB); return }
  // smug: the lid's line over a low pupil
  for (let xx = x - 1; xx <= x + 2; xx++) put(xx, y, INK_RGB)
  put(x, y + 1, INK_RGB); put(x + 1, y + 1, INK_RGB); put(x, y + 2, INK_RGB); put(x + 1, y + 2, INK_RGB)
}
