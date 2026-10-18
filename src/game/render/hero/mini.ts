/**
 * The company faces at DOCK size — redrawn for a 24 × 28 cell (shown at 2×
 * in the home dock's slot), never a downscale of the field figure.
 * Hand-drawn pixel PARTS in the pack's inks; each part is stamped back to
 * front with its own 1 px ring of the pack's outline (at 2× that is the
 * field figures' 2 px weight), so a head is outlined against its body and a
 * prop against its hand. Arms are drawn ON (sleeve to hand), never floating.
 *
 * Swappable like the field rig: a face is named parts + a palette; a frame
 * moves part GROUPS a pixel, hides / shows / swaps a part (an arm reaching
 * across, a tipped scale), and sets the eyes. Each face has its own idle
 * SHAPE at its own period (co-prime: 830, 1570, 2210, 1930, 1310 ms), its
 * own tic on its own interval with a hashed phase (they never sync), and its
 * own reaction when its slot is picked; `locked` turns it to a shadow.
 * {@link miniAt} says which frame plays at a time — the dock's one clock.
 * Shipped in the home dock (October 2026): `ui/shell/DockFace.tsx` draws
 * these in place of the crests.
 *
 * Pure: no DOM.
 */
import { INK, RAMPS, SHADOW_ALPHA, rgbOf, type RampId } from './palette'
import type { PersonaId } from './rig'

export const MINI_W = 24
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
  /** Moves everything (a hop, a weight shift). */
  all?: readonly [number, number]
  eyes?: 'open' | 'closed' | 'happy' | 'smug'
  show?: readonly string[]
  hide?: readonly string[]
  /** Replace a part's rows this frame (a tipped beam, a new chalk mark). */
  swap?: Readonly<Record<string, readonly string[]>>
  /** Loose pixels (a falling pinch, a glint): [x, y, ink letter]. */
  extra?: readonly (readonly [number, number, string])[]
}

export interface MiniFace {
  /** letter → [ramp, tone 0..3] (0 shade · 1 mid · 2 light · 3 specular). */
  inks: Readonly<Record<string, readonly [RampId, number]>>
  parts: readonly MiniPart[]
  /** The eyes (cell px of the base pose; they ride the head group). */
  eyes: readonly (readonly [number, number])[]
  /** Slit pupils (a reptile): the eye is gold with an ink slit. */
  slit?: boolean
  /** The skin an eye closes onto. */
  skin: string
  idle: readonly MiniKey[]
  /** The idle period (ms), spread over its frames. */
  period: number
  tic: readonly MiniKey[]
  ticMs: readonly number[]
  /** The tic plays every this many ms (the five all differ). */
  ticEvery: number
  react: readonly MiniKey[]
  reactMs: readonly number[]
}

const BOOTS = { b: ['leather', 0], B: ['leather', 1] } as const

export const MINI_FACES: Readonly<Record<PersonaId, MiniFace>> = {
  // ── Saffra: ginger hair under a saffron bandana with a gold band, the knot's two tails streaming behind (the notch no
  //    other face has); a narrow red vest with a gold sash; the near arm bent forward, a burlap pepper sack held out at the
  //    knee (at 24 px a balance reads as a crossbow). Lean and asymmetric against Brannoch's square block.
  saffra: {
    inks: {
      s: ['skinTan', 0], S: ['skinTan', 1], L: ['skinTan', 2], ...BOOTS,
      c: ['ochre', 0], C: ['ochre', 1], D: ['ochre', 2], y: ['gold', 2], Y: ['gold', 0], a: ['gold', 1],
      q: ['hairGinger', 0], h: ['hairGinger', 1], H: ['hairGinger', 2],
      r: ['red', 0], R: ['red', 1], Q: ['red', 2], n: ['navy', 0], N: ['navy', 1], l: ['leather', 0], m: ['leather', 1], z: ['brass', 2],
      u: ['wood', 1], U: ['wood', 2], V: ['wood', 3], e: ['red', 0], E: ['red', 2],
    },
    skin: 'L',
    parts: [
      { id: 'knot', group: 'head', x: 2, y: 7, rows: ['DCc..', '.DCCc', '..CCc', '.DCc.', 'DCc..'] },
      { id: 'offArm', group: 'off', x: 7, y: 13, rows: ['.cC', '.cC', 'cC.', 'LS.'] },
      { id: 'legs', group: 'body', x: 10, y: 20, rows: ['nN.nN', 'nN.nN'] },
      { id: 'boots', group: 'body', x: 9, y: 22, rows: ['bBB.bBB.', 'bBBBbBBB'] },
      { id: 'body', group: 'body', x: 9, y: 13, rows: ['.RRRRR.', 'QRaRRRr', 'QRRaRRr', 'QRRRaRr', 'lmmzmml', 'DCCCCCc', '.DCCCc.'] },
      { id: 'mainArm', group: 'main', x: 15, y: 13, rows: ['Cc...', 'Cc...', 'CCcLS', '.ccSs'] },
      { id: 'head', group: 'head', x: 6, y: 4, rows: ['...DDCCc....', '.DDDCCCCcc..', 'DDCCCCCCCcc.', 'yyyyyyyyyyY.', 'HhhhqSSSSSq.', 'HhhhqLLLLLLs', 'hhhhqLLLLLLs', '.hhqLLLLLss.', '..qqsLLLss..', '....ssss....'] },
      { id: 'sack', group: 'main', x: 17, y: 17, rows: ['.eE..', 'uUUV.', 'uUEUV', 'uUUUV', '.uUU.'] },
    ],
    eyes: [[13, 9], [16, 9]],
    idle: [{}, { move: { head: [0, 1], main: [0, 1], off: [0, 1] } }, { move: { head: [0, 1] } }, {}],
    period: 829,
    // she weighs the sack in her hand: it sinks, settles, sinks again, and she grins at the weight (it never rises to the face)
    tic: [
      { move: { main: [0, 1] } },
      {},
      { move: { main: [0, 1] }, eyes: 'happy' },
      { eyes: 'happy' },
      { move: { main: [0, 1] }, eyes: 'happy' },
      {},
    ],
    ticMs: [160, 200, 220, 320, 300, 200],
    ticEvery: 5300,
    react: [{ all: [0, -1], eyes: 'smug' }, { all: [0, -2], eyes: 'happy' }, { all: [0, -1], eyes: 'happy' }, { eyes: 'happy' }],
    reactMs: [80, 120, 100, 160],
  },
  // ── Odile: tall; a raven topknot; a long ear reaching out sideways; a rose cloak (the biggest mass), a plum tunic; a cream bolt of silk on the arm.
  odile: {
    inks: {
      s: ['skinRose', 0], S: ['skinRose', 1], L: ['skinRose', 2], ...BOOTS,
      h: ['hairBlack', 0], H: ['hairBlack', 1], G: ['hairBlack', 2],
      c: ['plum', 0], C: ['plum', 1], D: ['plum', 2], r: ['rose', 0], R: ['rose', 1], Q: ['rose', 2],
      T: ['linen', 1], p: ['linen', 0], P: ['linen', 1], W: ['linen', 2],
    },
    skin: 'L',
    parts: [
      { id: 'cloak', group: 'back', x: 2, y: 12, rows: ['....cCCCCD...', '...cCCCCCCD..', '..cCCCCCCCCD.', '..cCCCCCCCCD.', '.cCCCCCCCCCC.', '.cCCCCCCCCCC.', 'cCCCCCCCCCCC.', 'cCCCCCCCCCCC.', 'ccCCCCCCCCCc.', 'cccc..ccccc..', 'ccc..........'] },
      { id: 'offArm', group: 'off', x: 5, y: 14, rows: ['..rR', '.rR.', '.rR.', '.SL.', '.sS.'] },
      { id: 'body', group: 'body', x: 8, y: 13, rows: ['.rRRRQ.', 'rRRRRRQ', 'rRRRRRQ', 'rRRRRRQ', 'rTTTTTT', 'rRRRRRQ', 'rRRRRRQ', '.rRRRQ.', '.r..rQ.'] },
      { id: 'boots', group: 'body', x: 8, y: 22, rows: ['bB..bB', 'bBB.bBB'] },
      { id: 'head', group: 'head', x: 7, y: 2, rows: ['.....hHh...', '.....hHH...', '...hhHHHh..', '..hHHHHHHh.', '.hHHHLLLLL.', '.hHHLLLLLL.', '.hHHLLLLLLL', '..hHLLLLLL.', '..hHSLLLL..', '...hSSLL...', '....SSS....'] },
      { id: 'ear', group: 'head', x: 2, y: 8, rows: ['L.....', 'LLSs..', '.sSSSs'] },
      { id: 'bolt', group: 'off', x: 1, y: 18, rows: ['pPPPW', 'pPPPP', '.ppp.'] },
      { id: 'collar', group: 'body', x: 8, y: 13, rows: ['cCCCCD.', '.cCCD..'] },
      { id: 'mainArm', group: 'main', x: 14, y: 14, rows: ['Rr..', 'RRr.', '.RR.', '.LS.', '.sS.'] },
      { id: 'smooth', group: 'body', x: 6, y: 17, hidden: true, rows: ['....RRR', '..LSRr.', '..sS...'] },
    ],
    eyes: [[13, 9], [16, 9]],
    idle: [{}, {}, { move: { head: [0, 1] } }, { move: { head: [0, 1], main: [0, 1] } }, { move: { head: [0, 1], main: [0, 1] } }, { move: { head: [0, 1] } }, {}, {}],
    period: 1571,
    tic: [
      { eyes: 'smug' },
      { eyes: 'smug', hide: ['mainArm'], show: ['smooth'] },
      { eyes: 'smug', hide: ['mainArm'], show: ['smooth'], move: { off: [0, -1] } },
      { eyes: 'closed', hide: ['mainArm'], show: ['smooth'] },
      { eyes: 'closed', hide: ['mainArm'], show: ['smooth'], move: { off: [0, -1] } },
      { eyes: 'smug' },
    ],
    ticMs: [240, 260, 300, 320, 320, 260],
    ticEvery: 7100,
    react: [{ move: { head: [1, 1] }, eyes: 'closed' }, { move: { head: [1, 2], body: [0, 1] }, eyes: 'closed' }, { move: { head: [1, 1] }, eyes: 'happy' }, { eyes: 'smug' }],
    reactMs: [180, 260, 200, 200],
  },
  // ── Brannoch: wide and square; a bald dome, heavy brows, a ginger forked beard with gold beads; an iron-blue shirt (the biggest mass) under a leather apron; a tally slate.
  brannoch: {
    inks: {
      s: ['skinTan', 0], S: ['skinTan', 1], L: ['skinTan', 2], W: ['skinTan', 3], ...BOOTS,
      h: ['hairGinger', 0], H: ['hairGinger', 1], G: ['hairGinger', 2],
      n: ['navy', 0], N: ['navy', 1], M: ['navy', 2], l: ['leather', 1], m: ['leather', 2],
      T: ['gold', 2], w: ['wood', 1], z: ['soot', 1], X: ['white', 1],
    },
    skin: 'L',
    parts: [
      { id: 'offArm', group: 'off', x: 3, y: 16, rows: ['..nN', '.nN.', '.nN.', '.SL.'] },
      { id: 'body', group: 'body', x: 4, y: 15, rows: ['.nNNNNNNNNNNM.', 'nNNNNNNNNNNNMM', 'nNNNlmmmmlNNNM', 'nNNNlmmmmlNNNM', 'nNNNlmmmmlNNNM', 'nNNNllllllNNNM', '.nn.......nM..'] },
      { id: 'boots', group: 'body', x: 4, y: 22, rows: ['.bBBB..bBBB.', 'bBBBBB.bBBBBB'] },
      { id: 'head', group: 'head', x: 6, y: 6, rows: ['...sSLLL....', '..sSLLLLWL..', '.sSSLLLLLLL.', '.sSHHHLHHHL.', 'sSSLLLLLLLL.', 'sSSLLLLLLLLL', 'sSHHHHHHHHH.', '.hHHHHHHHHH.', '.hHHHHGHHHh.', '..hHHh.hHH..', '..hTh..hTh..'] },
      { id: 'slate', group: 'off', x: 0, y: 18, rows: ['wwwww', 'wzXzw', 'wXzXw', 'wzzzw', 'wwwww'] },
      { id: 'mainArm', group: 'main', x: 17, y: 16, rows: ['Nn..', 'NNn.', '.NN.', '.LS.'] },
    ],
    eyes: [[11, 10], [14, 10]],
    // a planted weight shift: the whole upper body leans a pixel one way, then the other
    idle: [{}, { move: { head: [-1, 0], off: [-1, 0], main: [-1, 0] } }, { move: { head: [-1, 0], off: [-1, 0], main: [-1, 0] } }, { move: { head: [-1, 0], off: [-1, 0], main: [-1, 0] } }, {}, {}, { move: { head: [1, 0], off: [1, 0], main: [1, 0] } }, { move: { head: [1, 0], off: [1, 0], main: [1, 0] } }, { move: { head: [1, 0], off: [1, 0], main: [1, 0] } }, {}, {}],
    period: 2213,
    tic: [
      {},
      { move: { off: [0, -1] }, eyes: 'smug' },
      { move: { off: [0, -1] }, eyes: 'smug', swap: { slate: ['wwwww', 'wzXXw', 'wXzXw', 'wzzzw', 'wwwww'] } },
      { move: { off: [0, -1] }, eyes: 'smug', swap: { slate: ['wwwww', 'wzXXw', 'wXXXw', 'wzzzw', 'wwwww'] } },
      { eyes: 'open', swap: { slate: ['wwwww', 'wzXXw', 'wXXXw', 'wzzzw', 'wwwww'] } },
      {},
    ],
    ticMs: [200, 220, 260, 300, 260, 200],
    ticEvery: 6700,
    react: [{ move: { head: [0, 1] } }, { move: { head: [0, 2] } }, { move: { head: [0, 1] } }, {}],
    reactMs: [120, 220, 140, 160],
  },
  // ── Hask: low and long; a flat, wide snout with a nostril and a lipless mouth line; a gold slit eye under a brow ridge;
  //    teal scales with a low oxblood back ridge; a thick tapering tail; an oxblood apron (the biggest mass); a hook hanging down.
  hask: {
    inks: {
      s: ['scaleTeal', 0], S: ['scaleTeal', 1], L: ['scaleTeal', 2], ...BOOTS,
      x: ['oxblood', 0], X: ['oxblood', 1], o: ['oxblood', 0], O: ['oxblood', 1], Q: ['oxblood', 2],
      Y: ['gold', 2], j: ['bone', 1], J: ['bone', 2], g: ['steel', 0], G: ['steel', 2], w: ['wood', 1],
    },
    skin: 'S',
    slit: true,
    parts: [
      { id: 'tail', group: 'back', x: 0, y: 16, rows: ['.......sS', '.....sSSS', '...sSSSs.', '.sSSSs...', 'sSSs.....', 'Ss.......'] },
      { id: 'offArm', group: 'off', x: 4, y: 15, rows: ['..sS', '.sS.', '.sS.', '.SL.'] },
      { id: 'body', group: 'body', x: 6, y: 13, rows: ['..sSSSL...', '.sSoOOOOL.', 'sSoOOOOOQL', 'sSoOOOOOQ.', 'sSoOOxOOQ.', 'sSoOOOOOQ.', '.soOOOOOQ.', '..sS..sS..'] },
      { id: 'boots', group: 'body', x: 7, y: 22, rows: ['sSS..sSS', 'sSSS.sSSS'] },
      { id: 'head', group: 'head', x: 6, y: 5, rows: ['..xXxXx......', '.sSSSSSL.....', 'sSSLLLLLL....', 'sSSS.SLLLLLLL', 'sSSSSSSSSSSSS', 'sSSSSSSSSSSSL', '.sSjjjjjjjjj.', '..sSJJJJJJ...'] },
      { id: 'mainArm', group: 'main', x: 15, y: 14, rows: ['Ss...', 'SSs..', '.SSs.', '..SL.'] },
      { id: 'hook', group: 'main', x: 17, y: 18, rows: ['.w...', '.w...', '.G...', '.G..G', '..GG.'] },
    ],
    eyes: [[11, 8]],
    // a slow sway, the tail swishing against it
    idle: [{}, { move: { head: [1, 0] } }, { move: { head: [1, 0] }, swap: { tail: ['........S', '.....sSSS', '...sSSSs.', '.sSSSs...', 'sSSs.....', 'Ss.......'] } }, { move: { head: [1, 0] } }, {}, {}, { move: { head: [-1, 0] } }, { move: { head: [-1, 0] }, swap: { tail: ['.......sS', '.....sSSS', '...sSSSs.', '.sSSSs...', 'sSSs.....', '.Ss......'] } }, { move: { head: [-1, 0] } }, {}],
    period: 1933,
    tic: [
      {},
      { eyes: 'smug', swap: { tail: ['......sSS', '.....sSS.', '...sSSSs.', '.sSSSs...', 'sSSs.....', 'Ss.......'] } },
      { eyes: 'closed', swap: { tail: ['.....sSS.', '....sSS..', '...sSSSs.', '.sSSSs...', 'sSSs.....', 'Ss.......'] } },
      { eyes: 'closed', swap: { tail: ['......sSS', '.....sSS.', '...sSSSs.', '.sSSSs...', 'sSSs.....', 'Ss.......'] } },
      { eyes: 'smug' },
      {},
    ],
    ticMs: [200, 220, 320, 260, 220, 200],
    ticEvery: 5900,
    react: [
      { move: { main: [0, -1] }, swap: { hook: ['.w...', '.w...', '.G...', 'G..G.', '.GG..'] } },
      { move: { main: [0, -1] }, swap: { hook: ['.w...', '..w..', '...GG', '....G', '..GG.'] } },
      { move: { main: [0, -1] }, swap: { hook: ['.w..G', '.w..G', '.GGG.', '.....', '.....'] } },
      {},
    ],
    reactMs: [110, 110, 110, 160],
  },
  // ── Wren: a small round body under a huge green hat with a sprout; a big round nose, a rosy cheek, a little white beard;
  //    a moss coat (with the hat, the biggest mass); short legs; a glowing vial hanging from the off hand, at the side.
  wren: {
    inks: {
      s: ['skinRose', 0], S: ['skinRose', 1], L: ['skinRose', 2], ...BOOTS,
      l: ['leaf', 2], g: ['leaf', 0], G: ['leaf', 2], H: ['leaf', 1], T: ['aqua', 2], t: ['aqua', 1],
      W: ['hairWhite', 2], w: ['hairWhite', 1], N: ['skinRose', 2], n: ['skinRose', 1],
      m: ['moss', 0], M: ['moss', 1], Q: ['moss', 2], a: ['glass', 1], E: ['venom', 2], e: ['venom', 1], X: ['white', 2],
    },
    skin: 'L',
    parts: [
      { id: 'offArm', group: 'off', x: 5, y: 17, rows: ['..mM', '.mM.', '.SL.'] },
      { id: 'body', group: 'body', x: 7, y: 16, rows: ['.mMMMMQ..', 'mMMMMMMQ.', 'mMMMMMMMQ', 'mTTTTTTTQ', 'mMMMMMMMQ', '.mMMMMMQ.'] },
      { id: 'boots', group: 'body', x: 8, y: 22, rows: ['bBB.bBB', 'bBBBbBBB'] },
      { id: 'head', group: 'head', x: 5, y: 10, rows: ['WwSSSLLLLL...', 'WwSSLLLLLLNN.', 'WSSSLLLLLLNNN', 'WSSSLLLLWWnnn', '.sSSSLWWWWW..', '.sSSSWWWWW...', '..sSWWWW.....'] },
      { id: 'hat', group: 'head', x: 5, y: 2, rows: ['.lG..........', '..g..........', '...gG........', '...gHG.......', '..gHHHG......', '..gHHHHG.....', '.gHHHHHHGG...', 'tTTTTTTTTTTT.'] },
      { id: 'vial', group: 'off', x: 3, y: 20, rows: ['.w.', '.a.', 'aEa', 'EEE', 'eEe'] },
      { id: 'mainArm', group: 'main', x: 15, y: 17, rows: ['Mm.', 'MM.', 'LS.'] },
    ],
    eyes: [[11, 11], [14, 11]],
    // a gentle bob, the hat's tip lagging a beat
    idle: [{}, { move: { body: [0, 0], head: [0, 1], off: [0, 1], main: [0, 1] } }, { move: { head: [0, 1] }, swap: { hat: ['..lG.........', '...g.........', '...gG........', '...gHG.......', '..gHHHG......', '..gHHHHG.....', '.gHHHHHHGG...', 'tTTTTTTTTTTT.'] } }, {}, {}, {}],
    period: 1307,
    tic: [
      { move: { off: [-1, -1] } },
      { move: { off: [-2, -3] } },
      { move: { off: [-2, -4] }, extra: [[2, 17, 'X']] },
      { move: { off: [-2, -4] }, extra: [[2, 17, 'X'], [1, 20, 'E']], eyes: 'happy' },
      { move: { off: [-1, -2] }, eyes: 'happy' },
      {},
    ],
    ticMs: [200, 220, 300, 320, 240, 200],
    ticEvery: 7700,
    react: [{ move: { head: [0, 1], off: [-1, -2] }, eyes: 'happy' }, { move: { off: [-2, -4] }, extra: [[2, 17, 'X']], eyes: 'happy' }, { move: { head: [0, 1], off: [-1, -2] }, eyes: 'happy' }, {}],
    reactMs: [120, 200, 120, 160],
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
  if (anim === 'idle') return f.idle.map(() => f.period / f.idle.length)
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
 * sync. The salt is the one (of 5,000 tried, `TIC_SALT`) whose first twelve
 * seconds start no two tics within 0.6 s and open with nobody mid-tic.
 */
const TIC_SALT = 2011
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
 * only the still pose. `face` gives the frame counts and holds; the timing
 * (`period`, `ticEvery`, the phase) is the dock face's, so a face at two
 * sizes moves in step with itself and out of step with the other four.
 */
export function spriteAt(id: PersonaId, face: MiniFace, t: number, o: ClockOpts = {}): { anim: MiniAnim; frame: number } {
  if (o.still) return { anim: 'idle', frame: 0 }
  const clock = MINI_FACES[id]
  if (o.pickedAt != null && t >= o.pickedAt) {
    const i = frameAt(face.reactMs, t - o.pickedAt)
    if (i >= 0) return { anim: 'react', frame: i }
  }
  const ticLen = face.ticMs.reduce((a, b) => a + b, 0)
  const shifted = t + ticPhase(id)
  const into = ((shifted % clock.ticEvery) + clock.ticEvery) % clock.ticEvery
  // `ticEach` n: only every nth tic plays (Light: 2, half as often), on the same phase, so the five stay out of step
  const each = Math.max(1, Math.round(o.ticEach ?? 1))
  const nth = Math.floor(shifted / clock.ticEvery)
  if (into < ticLen && ((nth % each) + each) % each === 0) return { anim: 'tic', frame: frameAt(face.ticMs, into) }
  const per = clock.period / face.idle.length
  return { anim: 'idle', frame: Math.floor((((t % clock.period) + clock.period) % clock.period) / per) }
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

const DOCK_SIZE: SpriteSize = { w: MINI_W, h: MINI_H, shadow: { cx: 11.5, cy: MINI_FEET + 1.6, rx: 7, ry: 1.3, rows: [MINI_FEET + 1, MINI_FEET + 2] }, outer: false, eyes: 'dot' }

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
    const [dx, dy] = offOf(part.group)
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
    const [hx, hy] = offOf('head')
    const mode = k.eyes ?? 'open'
    const skin = colour(face.skin)
    face.eyes.forEach(([ex, ey], i) => {
      const x = ex + hx, y = ey + hy
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
