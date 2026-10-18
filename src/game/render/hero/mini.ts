/**
 * The company faces at DOCK size — redrawn for a 24 × 28 cell (shown at 2×
 * in the home dock's slot, where the crest sits today), never a downscale of
 * the field figure. Hand-drawn pixel PARTS in the pack's inks: each part is
 * a grid of palette letters, stamped back to front with its own 1 px ring of
 * the pack's outline (at 2× that is the field figures' 2 px weight), so the
 * head is outlined against the body and the prop against the hand.
 *
 * Swappable like the field rig: a face is parts + a palette + anchors, and
 * the animation moves PART GROUPS (the head, each hand with what it holds)
 * a pixel at a time and swaps the eyes — idle (4 frames), the tic
 * (6 frames, every few seconds), the reaction when its slot is picked
 * (4 frames) — and `locked` turns the whole figure to a shadow.
 *
 * Pure: no DOM.
 */
import { INK, RAMPS, SHADOW_ALPHA, rgbOf, type RampId } from './palette'
import type { PersonaId } from './rig'

export const MINI_W = 24
export const MINI_H = 28
/** The row the feet stand on. */
export const MINI_FEET = 25
/** Every part, eye and extra pixel is authored one row higher than it is drawn (headroom for Wren's hat). */
const OY = 2

type Group = 'body' | 'head' | 'off' | 'main'

interface MiniPart {
  group: Group
  x: number
  y: number
  rows: readonly string[]
  /** 0: no ring (the grid carries its own ink); default 1. */
  ring?: 0 | 1
}

interface MiniFace {
  /** letter → [ramp, tone 0..3] (tone 0 shade · 1 mid · 2 light · 3 spec). */
  inks: Readonly<Record<string, readonly [RampId, number]>>
  /** Back to front. */
  parts: readonly MiniPart[]
  /** The eyes, in cell px of the base pose (they move with the head group). */
  eyes: readonly (readonly [number, number])[]
  /** The skin under an eye (to close it). */
  skin: string
  /** The tic: per frame, a group's offset and the eyes; extra pixels (a tongue, a glint). */
  tic: readonly MiniKey[]
  react: readonly MiniKey[]
}

interface MiniKey {
  move?: Partial<Record<Group, readonly [number, number]>>
  /** Moves everything (a hop). */
  all?: readonly [number, number]
  eyes?: 'open' | 'closed' | 'happy' | 'smug'
  /** Extra pixels over the figure: [x, y, ink letter], head-relative when `onHead`. */
  extra?: readonly (readonly [number, number, string])[]
  onHead?: boolean
}

const SKIN_TAN = { s: ['skinTan', 0], S: ['skinTan', 1], L: ['skinTan', 2] } as const
const BOOTS = { b: ['leather', 0], B: ['leather', 1] } as const

const IDLE: readonly MiniKey[] = [{}, {}, { move: { head: [0, 1], off: [0, 1], main: [0, 1] } }, { move: { head: [0, 1], off: [0, 1], main: [0, 1] } }]

export const MINI_FACES: Readonly<Record<PersonaId, MiniFace>> = {
  // Saffra: saffron scarf with a gold band, the knot's tail behind; a red sash vest; a pouch of pepper.
  saffra: {
    inks: { ...SKIN_TAN, ...BOOTS, c: ['ochre', 0], C: ['ochre', 1], D: ['ochre', 2], T: ['gold', 2], t: ['gold', 1], r: ['red', 0], R: ['red', 1], Q: ['red', 2], P: ['leather', 1], p: ['leather', 0], E: ['red', 2], e: ['red', 1], k: ['ink' as RampId, 0] },
    skin: 'L',
    parts: [
      { group: 'head', x: 4, y: 8, rows: ['cC.', 'cCC', '.cC', '.cC', '..c'] },
      { group: 'body', x: 7, y: 15, rows: ['.rRRRRQ..', 'rRtRRRRQ.', 'rRRtRRRQ.', 'rRRRtRRQ.', 'rRRRRtRQ.', '.rrRRRRQ.'] },
      { group: 'body', x: 8, y: 21, rows: ['bBB.bBB', 'bBBBbBBB'] },
      { group: 'head', x: 6, y: 5, rows: ['....cCCCD..', '..cCCCCCCD.', '.cCCCCCCCCD', '.tTTTTTTTTT', 'cCCCLLLLLL.', 'cCCLLLLLLL.', 'cCCSLLLLLLL', '.cCSSLLLLL.', '..cSSSLLL..'] },
      { group: 'off', x: 4, y: 14, rows: ['.eE.', 'eEEE', 'PppP', 'pPPp'] },
      { group: 'off', x: 5, y: 18, rows: ['LS', 'SS'] },
      { group: 'main', x: 16, y: 18, rows: ['LS', 'SS'] },
    ],
    eyes: [[12, 10], [15, 10]],
    tic: [
      {},
      { move: { off: [1, -3] } },
      { move: { off: [3, -6] }, eyes: 'closed' },
      { move: { off: [3, -6] }, eyes: 'closed' },
      { move: { off: [1, -3] }, eyes: 'happy' },
      { eyes: 'happy' },
    ],
    react: [{ move: { main: [1, -3] }, eyes: 'smug' }, { all: [0, -1], move: { main: [2, -5] }, eyes: 'happy' }, { move: { main: [1, -3] }, eyes: 'happy' }, {}],
  },
  // Odile: a silver topknot and a long ear, a rose cloak, a plum tunic, a cream bolt of silk on the arm.
  odile: {
    inks: { s: ['skinRose', 0], S: ['skinRose', 1], L: ['skinRose', 2], ...BOOTS, h: ['hairBlack', 0], H: ['hairBlack', 1], G: ['hairBlack', 2], c: ['rose', 0], C: ['rose', 1], D: ['rose', 2], r: ['plum', 0], R: ['plum', 1], Q: ['plum', 2], T: ['linen', 1], P: ['linen', 1], p: ['linen', 0], W: ['linen', 2], k: ['ink' as RampId, 0] },
    skin: 'L',
    parts: [
      { group: 'body', x: 5, y: 13, rows: ['..cCCCCD...', '.cCCCCCCD..', '.cCCCCCCCD.', 'cCCCCCCCCD.', 'cCCCCCCCCC.', 'cCCCCCCCCC.', 'cCCCCCCCC..', 'ccCCCCCCC..', 'cccCCCCCc..', '.ccc.ccc...'] },
      { group: 'body', x: 8, y: 14, rows: ['.rRRRQ.', 'rRRRRRQ', 'rRRRRRQ', 'rRRRRRQ', 'rTTTTTT', 'rRRRRRQ', '.rRRRQ.'] },
      { group: 'body', x: 9, y: 21, rows: ['bB..bB', 'bBB.bBB'] },
      { group: 'head', x: 5, y: 3, rows: ['......hHG...', '......hHH...', '....hhHHHG..', '...hHHHHHHG.', 'Ls.hHHHHHHHG', '.sSShHHLLLL.', '..sShHLLLLL.', '...ShHLLLLLL', '....hHLLLLL.', '.....hSLLL..'] },
      { group: 'off', x: 2, y: 16, rows: ['pPPPW', 'pPPPP', '.ppp.'] },
      { group: 'off', x: 6, y: 18, rows: ['SL', 'sS'] },
      { group: 'main', x: 15, y: 18, rows: ['LS', 'SS'] },
    ],
    eyes: [[12, 9], [15, 9]],
    tic: [
      { eyes: 'smug' },
      { move: { main: [-3, -1] }, eyes: 'smug' },
      { move: { main: [-6, -1] }, eyes: 'smug' },
      { move: { main: [-4, -1] }, eyes: 'smug' },
      { move: { main: [-6, -1] }, eyes: 'closed' },
      { eyes: 'smug' },
    ],
    react: [{ move: { head: [1, 1] }, eyes: 'closed' }, { move: { head: [1, 2], main: [-2, -1] }, eyes: 'closed' }, { move: { head: [1, 1] }, eyes: 'happy' }, { eyes: 'smug' }],
  },
  // Brannoch: a bald dome, heavy brows, a ginger forked beard with gold beads, a leather apron, a tally slate.
  brannoch: {
    inks: { s: ['skinTan', 0], S: ['skinTan', 1], L: ['skinTan', 2], ...BOOTS, h: ['hairGinger', 0], H: ['hairGinger', 1], G: ['hairGinger', 2], n: ['navy', 0], N: ['navy', 1], M: ['navy', 2], l: ['leather', 1], m: ['leather', 2], T: ['gold', 2], w: ['wood', 1], z: ['soot', 1], W: ['white', 1], k: ['ink' as RampId, 0] },
    skin: 'L',
    parts: [
      { group: 'body', x: 4, y: 16, rows: ['.nNNNNNNNNNNM.', 'nNNllllllllNMM', 'nNNlmmmmmmlNNM', 'nNNlmmmmmmlNNM', 'nNNlmmmmmmlNNM', '.nNlllllllllM.'] },
      { group: 'body', x: 6, y: 21, rows: ['bBBB..bBBB', 'bBBBB.bBBBB'] },
      { group: 'head', x: 6, y: 6, rows: ['...sSLLLL...', '..sSLLLLLL..', '.sSSLLLLLLL.', '.sSHHHLHHHL.', 'sSSSLLLLLLL.', 'sSSHHHHHLLLL', 'sSHHHHHHHHH.', '.hHHHHHHHHH.', '.hHHHHGHHHh.', '..hHHh.hHH..', '..hTh..hTh..'] },
      { group: 'off', x: 1, y: 15, rows: ['wwwww', 'wzWzw', 'wWzWw', 'wzWzw', 'wzzzw', 'wwwww'] },
      { group: 'off', x: 4, y: 19, rows: ['SL', 'sS'] },
      { group: 'main', x: 18, y: 18, rows: ['LS', 'SS'] },
    ],
    eyes: [[11, 10], [14, 10]],
    tic: [
      {},
      { move: { off: [0, -1], head: [0, 1] } },
      { move: { off: [0, 0], head: [0, 1] }, eyes: 'smug' },
      { move: { off: [0, -1], head: [0, 1] } },
      { move: { off: [0, 0], head: [0, 1] }, eyes: 'smug' },
      {},
    ],
    react: [{ move: { head: [0, 1] } }, { move: { head: [0, 2] } }, { move: { head: [0, 1] } }, {}],
  },
  // Hask: ochre scales, oxblood spines and apron, a gold slit eye, a snout, a hook, a sack of salt; the tail behind.
  hask: {
    inks: { s: ['scaleOchre', 0], S: ['scaleOchre', 1], L: ['scaleOchre', 2], ...BOOTS, x: ['oxblood', 1], o: ['oxblood', 0], O: ['oxblood', 1], Q: ['oxblood', 2], Y: ['gold', 2], g: ['steel', 0], G: ['steel', 2], w: ['wood', 1], W: ['white', 1], n: ['bone', 0], N: ['bone', 1], R: ['red', 2], k: ['ink' as RampId, 0] },
    skin: 'S',
    parts: [
      { group: 'body', x: 0, y: 17, rows: ['......sS', '...ssSS.', '.sSSS...', 'ss......'] },
      { group: 'body', x: 7, y: 14, rows: ['.sSSSSSL.', 'sSoOOOOOL', 'sSoOOOOOQ', 'sSoOOOOOQ', 'sSoOOOOOQ', '.soOOOOOQ', '..oOO.OO.'] },
      { group: 'body', x: 8, y: 21, rows: ['sSS..sSS', 'sSSS.sSSS'] },
      { group: 'head', x: 6, y: 6, rows: ['..xx.xx.......', '.xSSxSSx......', '.sSSSSSLL.....', 'sSSSSSSLLL....', 'sSSSSSSLLLLLL.', 'sSSSSSSSSSSSL.', '.sSSSsssssss..', '..sSSLLLLLL...', '...sSSSS......'] },
      { group: 'off', x: 2, y: 15, rows: ['WWW.', 'nNNn', 'nNNN', '.nn.'] },
      { group: 'off', x: 5, y: 18, rows: ['SL', 'sS'] },
      { group: 'main', x: 17, y: 12, rows: ['.gG.', 'g..G', '...G', '..gG', '..w.', '..w.'] },
      { group: 'main', x: 17, y: 18, rows: ['LS', 'SS'] },
    ],
    eyes: [[12, 9]],
    tic: [
      {},
      { extra: [[19, 12, 'R']] },
      { extra: [[19, 12, 'R'], [20, 12, 'R'], [21, 11, 'R'], [21, 13, 'R']] },
      { extra: [[19, 12, 'R']] },
      {},
      {},
    ],
    react: [{ move: { main: [-1, -2] }, extra: [[19, 12, 'R']] }, { move: { main: [-2, -3] }, extra: [[19, 12, 'R'], [20, 12, 'R'], [21, 11, 'R'], [21, 13, 'R']] }, { move: { main: [-1, -1] } }, {}],
  },
  // Wren: a huge green hat with a sprout, white tufts and mustache, a big rosy nose, a plum coat, a glowing vial.
  wren: {
    inks: { s: ['skinRose', 0], S: ['skinRose', 1], L: ['skinRose', 2], ...BOOTS, l: ['leaf', 2], g: ['leaf', 0], G: ['leaf', 2], T: ['aqua', 2], t: ['aqua', 1], W: ['hairWhite', 2], w: ['hairWhite', 1], R: ['rose', 2], r: ['plum', 0], Q: ['plum', 2], P: ['plum', 1], a: ['glass', 1], E: ['venom', 2], e: ['venom', 1], X: ['white', 2], k: ['ink' as RampId, 0] },
    skin: 'L',
    parts: [
      { group: 'body', x: 7, y: 16, rows: ['.rPPPPQ..', 'rPPPXPPQ.', 'rPPPXPPPQ', 'rTTTTTTTQ', 'rPPPXPPPQ', '.rPPXPPQ.'] },
      { group: 'body', x: 8, y: 21, rows: ['bBB.bBB', 'bBBBbBBB'] },
      { group: 'head', x: 5, y: 9, rows: ['WwSSSLLLLL..', 'WwSSLLLLLLL.', 'WSSSLLLLLRRL', 'WSSSLLLWWRRR', '.sSSSWWWWWR.', '.sSSSLWWW...', '..sSSSSS....'] },
      { group: 'head', x: 5, y: 1, rows: ['.lG..........', '..g..........', '...gG........', '...gGG.......', '...gGGG......', '..gGGGGG.....', '..gGGGGGGG...', '.gGGGGGGGGGG.', 'tTTTTTTTTTTTT'] },
      { group: 'off', x: 3, y: 13, rows: ['.w.', '.a.', 'aEa', 'EEE', 'eEe'] },
      { group: 'off', x: 4, y: 18, rows: ['SL', 'sS'] },
      { group: 'main', x: 16, y: 19, rows: ['LS', 'SS'] },
    ],
    eyes: [[10, 10], [13, 10]],
    tic: [
      {},
      { move: { off: [1, -3] } },
      { move: { off: [2, -5] }, extra: [[7, 9, 'X']] },
      { move: { off: [2, -5] }, extra: [[7, 9, 'X'], [3, 11, 'E']], eyes: 'happy' },
      { move: { off: [1, -3] }, eyes: 'happy' },
      {},
    ],
    react: [{ move: { off: [1, -3] }, eyes: 'happy' }, { all: [0, -1], move: { off: [2, -5] }, extra: [[7, 8, 'X']], eyes: 'happy' }, { move: { off: [1, -3] }, eyes: 'happy' }, {}],
  },
}

export type MiniAnim = 'idle' | 'tic' | 'react'
export const MINI_MS: Readonly<Record<MiniAnim, readonly number[]>> = {
  idle: [320, 320, 320, 320],
  tic: [160, 160, 320, 320, 200, 160],
  react: [90, 140, 120, 160],
}
export const miniFrames = (id: PersonaId, anim: MiniAnim): number => (anim === 'idle' ? IDLE.length : anim === 'tic' ? MINI_FACES[id].tic.length : MINI_FACES[id].react.length)

export interface MiniFrame {
  w: number
  h: number
  rgba: Uint8ClampedArray
}

const INK_RGB = rgbOf(INK)

/** One dock frame. `locked`: the figure as a shadow (the company not yet open). */
export function miniFrame(id: PersonaId, anim: MiniAnim, frame: number, locked = false): MiniFrame {
  const face = MINI_FACES[id]
  const keys = anim === 'idle' ? IDLE : anim === 'tic' ? face.tic : face.react
  const k = keys[((frame % keys.length) + keys.length) % keys.length] ?? {}
  const W = MINI_W, H = MINI_H
  const rgba = new Uint8ClampedArray(W * H * 4)
  const all = k.all ?? [0, 0]
  const lift = -Math.min(0, all[1])
  // the ground shadow stays on the ground (and shrinks a little in a hop)
  for (let y = MINI_FEET; y <= MINI_FEET + 1; y++)
    for (let x = 5; x <= 18; x++) {
      const rx = 7 - lift * 0.5, cx = 11.5
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - (MINI_FEET + 0.8)) / 1.4) ** 2 > 1) continue
      const o = (y * W + x) * 4
      rgba.set([...INK_RGB, SHADOW_ALPHA], o)
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
  for (const part of face.parts) {
    const [dx, dy] = offOf(part.group)
    const px: [number, number, string][] = []
    part.rows.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch !== '.') px.push([part.x + rx + dx, part.y + ry + dy + OY, ch]) }))
    const own = new Set(px.map(([x, y]) => y * W + x))
    if (part.ring !== 0) {
      for (const [x, y] of px)
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const xx = x + ox, yy = y + oy
          if (xx < 0 || yy < 0 || xx >= W || yy >= H || own.has(yy * W + xx)) continue
          rgba.set([...INK_RGB, 255], (yy * W + xx) * 4)
        }
    }
    for (const [x, y, ch] of px) if (x >= 0 && y >= 0 && x < W && y < H) rgba.set([...colour(ch), 255], (y * W + x) * 4)
  }
  // the eyes (they ride the head group)
  if (!locked) {
    const [hx, hy] = offOf('head')
    const mode = k.eyes ?? 'open'
    face.eyes.forEach(([ex, ey], i) => {
      const x = ex + hx, y = ey + hy + OY
      const put = (xx: number, yy: number, rgb: readonly number[]) => { if (xx >= 0 && yy >= 0 && xx < W && yy < H) rgba.set([...rgb, 255], (yy * W + xx) * 4) }
      const skin = colour(face.skin)
      if (id === 'hask') {
        // a gold eye with a slit; shut, a line
        if (mode === 'open' || mode === 'smug') { put(x - 1, y, colour('Y')); put(x, y, INK_RGB); put(x - 1, y + 1, colour('Y')); put(x, y + 1, INK_RGB) } else { put(x - 1, y + 1, INK_RGB); put(x, y + 1, INK_RGB) }
        return
      }
      if (mode === 'open') { put(x, y, INK_RGB); put(x, y + 1, INK_RGB) }
      else if (mode === 'closed') { put(x, y, skin); put(x - (i ? 0 : 1), y + 1, INK_RGB); put(x + (i ? 1 : 0), y + 1, INK_RGB) }
      else if (mode === 'happy') { put(x - (i ? 0 : 1), y, INK_RGB); put(x + (i ? 1 : 0), y, INK_RGB); put(x, y + 1, skin) }
      else { put(x - (i ? 0 : 1), y, INK_RGB); put(x + (i ? 1 : 0), y, INK_RGB); put(x, y + 1, INK_RGB) }
    })
  }
  for (const [ex, ey, ch] of k.extra ?? []) {
    const [hx, hy] = k.onHead ? offOf('head') : all
    const x = ex + hx, y = ey + hy + OY
    if (x < 0 || y < 0 || x >= W || y >= H) continue
    if (!locked) rgba.set([...colour(ch), 255], (y * W + x) * 4)
  }
  return { w: W, h: H, rgba }
}
