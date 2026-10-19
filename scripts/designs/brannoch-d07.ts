/**
 * Brannoch design 07 — the Mason Guild Elder. Hand-authored pixel maps (see brannoch-lib.ts).
 *
 * Has cut Ironvein's gate stones for sixty winters: a bald, polished dome
 * with a fringe of white hair, two bushy white brows that hide his eyes, the
 * biggest white beard on the mountain, a stone-dust smock, and his old
 * mason's mallet hanging head-down from his fist. Silhouette: a shining
 * dome over a great white square. Tic: he strokes his beard, slowly, twice —
 * the sentimental one.
 */
import type { Design } from './brannoch-lib'
import { AT, FEET, FIST_B, FIST_F, PAL, SHADOW, bell } from './brannoch-common'

const DOME = [
  '...........EEEEEEEE',
  '........EEEEFFEEEEEEEe',
  '......EEEFFwwFEEEEEEEEee',
  '.....EEEFwwFEEEEEEEEEEEee',
  '...EEEEEFFEEEEEEEEEEEEEeeee',
  '...EEEEFEEEEEEEEEEEEEEEeeee',
  '..EEEEEEEEEEEEEEEEEEEEEeeeee',
  '.EEEEEEEEEEEEEEEEEEEEEeeeeeee',
  '.EEEEEEEEEEEEEEEEEEEEeeeeeeee',
  'eEEEEEEEEEEEEEEEEEEEeeeeeeeee',
  'eeEEEEEEEEEEEEEEEEeeeeeeeeeee',
  'eeeeeeEEEEEEEEeeeeeeeeeeeeeee',
]

const FRINGE = [
  '...LLLLLM',
  '.LLLlLLMMm',
  'LLLLLLMMMm',
  'LLlLLLMMmm',
  'MLLLLMMMmm',
  'MMLLMMMmm',
  '.MMMMMmm',
]

const BROWS = [
  '.LLLLLL.....LLLLLLL',
  'LLlLLLLM...LLllLLLLLM',
  'MLLLMMMm..MLLLLLLLMMm',
  '.mmmmm.....mmmmmmmm',
]

const BEARD = [
  '.......LLLLLLLLLLLLLLLLLLLLLLLLMMMMM',
  '.....LLLLLLLLLLLLLLLLLLLLLLLLLLLMMMMMM',
  '...LLLLLLLLLLLLLLLLLLLLLLLLLLLLLMMMMMMMM',
  '..LLLLLLLlllLLLLLLLLLLLLLLLLLLLLMMMMMMMM',
  '.LLLLLLLllLLLLLLLLLLLLLLLMLLLLLLMMMMMMMM',
  '.LLLLLLlLLLLLLLLLLLLLLLLLMLLMLLLMMMMMMMM',
  'LLLLLLLLLLLLLLLLLLLMLLLLLMLLMLLLMMMMMMMM',
  'LLLLLLLMLLLLLLLLLLLMLLLLLMLLMLLMMMMMMMMM',
  'LLLLLLLMLLMLLMLMLLLMLLLLLMLLMMMMMMMMMMMM',
  'LMLLMLLMLLMLLMLMLLLMLLMLLMLLMMMMmMMMmMMM',
  'LMLLMLLMLLMLLMLMLLLMLLMLLMMMMMMMmMMMmMmm',
  'MMMMMLLMLLMLLMLMLLLMLMMMMmMMMMMMmMMMmmmm',
  '.MMMMMMMMMmMMmMMMMMMMMMMMmMMMMMMmMMmmmm',
  '.MMMmMMmMMmMMmMMMMMmMMMMMmMMmMMMmmmmmmm',
  '..MMmMMmMMmMMmMmMMMmMMMMMmMMmmmmmmmmm',
  '...MmMMmMMmMMmMmMMMmMMmMmmmmmmmmmmmmm',
  '....mmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
  '......mmmmmmmmmmmmmmmmmmmmmmmm',
  '.........mmmmmmmmmmmmmmmmm',
]

const MOUSTACHE = [
  '......LLLLLLLLLLLLLLLLL',
  '...LLLLlllLLLLLLLLLLLLLLM',
  '.LLLllLLLLLLLLLLLLLLLLLLMMm',
  'LLLLLLLLMMMMMMMMMMMMLLLLMMm',
  'MLLLMMm............mMMMMm',
  '.mmmm...............mmm',
]

const NOSE = [
  '..DDCC.',
  '.DDCCCc',
  'DDCCCCc',
  'DCCCCCc',
  'CCCCCcc',
  '.ccccc.',
]

/** The shared bell this design wore before it got its own body (for the before/after card). */
export const BODY_SHARED = bell({ 1: 'T', 2: 'P', 3: 'p', 4: 'u', 5: 'U' })

/** His own body: a short stone-grey smock with dust on its sleeves, belted, under the apron. */
const BODY = [
  '...TTPPPPPPPPPPPPPPPPPPPPPPPPpppp',
  '..TTPPPPPPPPPPPPPPPPPPPPPPPPPPpppp',
  '..TTPPPPPPPPPPPPPPPPPPPPPPPPPPpppp',
  '.TTPPPPPPPPPPPPPPPPPPPPPPPPPPPppppp',
  '.UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUuuuu',
  '.uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu',
  'TTPPPLPPPPPPPPPPPPPPPPPPPPPPPpPPpppp',
  'TTPPTLPPPPPPPPPPPPPPPPPPPPPPPpPPpppp',
  'TPPPPPPPPPPPPPPPPPPPPPPPPPPPpPPPpppp',
  'TPPPPPPPPPPPPPPPPPPPPPPPPPPPpPPPpppp',
  'pppppppppppppppppppppppppppppppppppp',
]

/**
 * The leather mason's apron that hangs below the smock to his boot tops (the stepped hem is
 * his silhouette): stone dust ground into it, a stitched pocket with a chisel's steel showing.
 */
const APRON = [
  '..VVVVVVVVVVVVVUUu',
  '..VVTVVVVVVVVVVUUu',
  '..VTTVVVVVVVVVVUUu',
  '.VVVVVVVVVVVVVVVUUu',
  '.VVVVVVVVVVJIVVVUUu',
  '.VVVVVVVVVuJIuuuUUu',
  '.VVVVVVTVVuUVUUuUUu',
  'VVVVVVTTVVuuuuuuUUuu',
  'VtVVtVVtVVtVVtVVtUuu',
  'UVVVVVVVVVVVVVVVUUuu',
  '.uUUUUUUUUUUUUUUUuu',
]

/** The apron as it hung in the body round, to the ground over his feet (for the before/after card). */
export const APRON_LONG = [
  '..VVVVVVVVVVVVVUUu',
  '..VVTVVVVVVVVVVUUu',
  '..VTTVVVVVVVVVVUUu',
  '.VVVVVVVVVVVVVVVUUu',
  '.VVVVVVVVVVJIVVVUUu',
  '.VVVVVVVVVuJIuuuUUu',
  '.VVVVVVVVVuUVUUuUUu',
  'VVVVVVVTVVuUUUUuUUuu',
  'VVVVVVTTVVuUUUUuUUuu',
  'VVVVVVVVVVuuuuuuUUuu',
  'VtVVtVVtVVtVVtVVtUuu',
  'UVVVVVVVVVVVVVVVUUuu',
  '.uUUUUUUUUUUUUUUUuu',
  '..uuuuuuuuuuuuuuuu',
]

/**
 * His boots, planted wide under the hem in the pack's nub-foot way: dark leather lit
 * on the shin, an iron toe cap, a soot-black sole; the near boot a size up and its toe out past the apron.
 */
const BOOT_B = [
  '.ubbbu..',
  '.ubbuuu.',
  '.uuuuIJi',
  'uuuuuIJi',
  'zzzzzzzz',
]
const BOOT_F = [
  '.ubbbbu..',
  '.ubbbuuu.',
  '.uuuuuIJi',
  'uuuuuuIJi',
  'zzzzzzzzz',
]

/** A leather pouch on the back hip, its flap held by a brass stud. */
const POUCH = [
  'UUUUUu',
  'VVtVUu',
  'VVVVUu',
  'UVVVUu',
  'UUUUuu',
  '.uuuu',
]

/** A second chisel hung blade-down through a loop on the belt, at his front hip. */
const CHISEL = [
  'uUu',
  '.JI',
  '.JI',
  '.JI',
  '.Ji',
  '..i',
]

const MALLET = [
  '......VU',
  '......VU',
  '......VU',
  'JIVVVVVVVVVVJI',
  'JIVVwVVVVVVUJI',
  'JIVVVVVVTVVUJI',
  'JIVVVVVVVVVUJI',
  'IiVVVVVVVVUUIi',
  'IiUUUUUUUUUuIi',
  '.iuuuuuuuuuui',
]

export const D07: Design = {
  id: 'd07',
  title: 'Mason Guild Elder',
  concept: 'Has cut the gate stones for sixty winters: a bald polished dome, white brows hiding his eyes, the biggest white beard on the mountain, a mallet hanging low.',
  pal: PAL,
  headBottom: 56,
  parts: [
    { id: 'shadow', group: 'feet', x: AT.shadow[0], y: AT.shadow[1], rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: AT.feet[0], y: AT.feet[1], rows: FEET, ring: 0, hidden: true },
    { id: 'bootB', group: 'feet', x: 36, y: 66, rows: BOOT_B },
    { id: 'bootF', group: 'feet', x: 57, y: 66, rows: BOOT_F },
    { id: 'body', group: 'body', x: 32, y: 52, rows: BODY },
    { id: 'bodyPouch', group: 'body', x: 34, y: 57, rows: POUCH },
    { id: 'bodyChisel', group: 'body', x: 61, y: 57, rows: CHISEL, ring: 1 },
    { id: 'bodyApron', group: 'body', x: 41, y: 55, rows: APRON },
    { id: 'fringe', group: 'head', x: 31, y: 28, rows: FRINGE },
    { id: 'dome', group: 'head', x: 36, y: 20, rows: DOME, squash: [4, 7] },
    { id: 'beard', group: 'head', x: 29, y: 36, rows: BEARD, sags: true },
    { id: 'brows', group: 'head', x: 46, y: 30, rows: BROWS },
    { id: 'moustache', group: 'head', x: 42, y: 37, rows: MOUSTACHE },
    { id: 'nose', group: 'head', x: 58, y: 34, rows: NOSE },
    { id: 'mallet', group: 'prop', x: 70, y: 59, rows: MALLET },
    { id: 'handB', group: 'hands', x: 27, y: 58, rows: FIST_B },
    { id: 'handF', group: 'hands', x: 72, y: 56, rows: FIST_F },
  ],
  idle: [
    {},
    { squash: 1, nudge: { brows: [0, 1] } },
    { squash: 2, sag: 1, nudge: { brows: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, sag: 1, nudge: { brows: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, nudge: { brows: [0, 1] } },
    {},
  ],
  idleMs: [300, 160, 180, 280, 160, 220],
  // the back hand comes up onto the beard and strokes it down, twice; the brows lift, fond
  tic: [
    { nudge: { handB: [4, -12] }, squash: 1 },
    { nudge: { handB: [5, -8], brows: [0, -1] }, sag: 1 },
    { nudge: { handB: [5, -3], brows: [0, -1] }, sag: 1 },
    { nudge: { handB: [4, -12], brows: [0, -1] }, squash: 1 },
    { nudge: { handB: [5, -6], brows: [0, -1] }, sag: 1 },
    { nudge: { handB: [3, -1] }, squash: 2, sag: 1 },
  ],
  ticMs: [260, 280, 300, 240, 300, 320],
}

/** The body round's d07, before the boots: the apron to the ground, the pack's ink stub feet under it. */
export const D07_BEFORE: Design = {
  ...D07,
  id: 'd07-apron',
  parts: D07.parts
    .filter((p) => !p.id.startsWith('boot'))
    .map((p) => {
      if (p.id === 'feet') return { ...p, hidden: false }
      if (p.id === 'bodyApron') return { ...p, rows: APRON_LONG }
      // where the mallet and its fist hung before the near boot stepped out
      if (p.id === 'mallet') return { ...p, x: 64, y: 61 }
      if (p.id === 'handF') return { ...p, x: 67, y: 58 }
      return p
    }),
}
