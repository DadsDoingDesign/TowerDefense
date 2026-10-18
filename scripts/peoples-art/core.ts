/** The draft module's palette, types and pixel rules (see `scripts/peoples-art.ts`). Pure. */
import type { IconKey } from '../../src/game/data/iconAtlas'
import type { BodyKey, BodyStyle } from '../../src/game/render/bodyLayer'
import type { HitEffect } from '../../src/game/render/attackLook'

/** The Tiny Swords outline, the same on every icon. */
export const OUTLINE = '#161c2e'

/** The atlas palette (`fw-icons.ts` PALETTE), letter for letter: no new hues. */
export const PALETTE: Readonly<Record<string, string>> = {
  K: OUTLINE,
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
/** A palette letter's hex (for body styles and tells). */
export const c = (k: keyof typeof PALETTE | string): string => PALETTE[k] ?? OUTLINE

export type Art = readonly string[]
export interface Pt {
  x: number
  y: number
}
export type Slot = 'oneHand' | 'twoHand' | 'either' | 'offHand' | 'body'
export type Status = 'kept' | 'new' | 'renamed'

export interface DraftItem {
  name: string
  level: 1 | 2 | 3 | 4
  slot: Slot
  does: string
  status: Status
  /** Drafted pixels, or the shipped atlas cell a kept item already has. */
  icon: Art | IconKey
  /** Where a held picture is gripped, in its 16 px cell (weapons; off-hands default to the lower middle). */
  grip?: Pt
  /** The real enchantment glint on the held weapon, when its own effect is one the game already inks. */
  glint?: HitEffect
  /** A body piece: a drafted style, or the shipped piece a kept item is. */
  body?: BodyStyle | BodyKey
  /** Held in both fists (a pair). */
  twin?: boolean
  /** A renamed item's old name. */
  was?: string
}

export type PipShape = 'dot' | 'chili' | 'coin' | 'drop' | 'star' | 'leaf' | 'skull' | 'fang' | 'spark' | 'flake' | 'arrow' | 'rune' | 'gear'

/**
 * A skill's persistent mark on the hero. Small by rule: inside the hero's own
 * tile, never above its head's top (the goblins' HP bars ride the lane beside
 * it), never on the road.
 */
export type Tell =
  /** The real `gearMarks` glint on the weapon (burn, chill, shock, drain, stun, execute). */
  | { kind: 'glint'; effect: HitEffect }
  /** A ground ring at the feet; `dash` > 0 dashes it, `pulse` > 0 doubles it. */
  | { kind: 'ring'; ink: string; dash?: number; r?: number; double?: boolean }
  /** The real support aura (`overlays.drawAura`), at a small radius. */
  | { kind: 'aura'; ink: string; r: number }
  /** A short row of pips by the shoulder, like the patience pips. */
  | { kind: 'pips'; ink: string; n: number; shape: PipShape }
  /** A little pennant on a staff behind the back. */
  | { kind: 'pennant'; ink: string; emblem?: string; tail?: boolean }
  /** Speed lines streaming off the back. */
  | { kind: 'streaks'; ink: string; n?: number }
  /** Roots / vines curling round the feet. */
  | { kind: 'roots'; ink: string; bloom?: string }
  /** Small shields standing in an arc in front of the feet: how many it holds. */
  | { kind: 'shields'; n: number; ink: string }
  /** A ring of spikes at the feet. */
  | { kind: 'thorns'; ink: string; ember?: string }
  /** A sight mark by the eye. */
  | { kind: 'sight'; ink: string }
  /** A glow round the weapon hand in a colour the game has no glint for. */
  | { kind: 'halo'; ink: string; core?: string }
  /** Motes rising off the off hand, the feet or the weapon. */
  | { kind: 'motes'; ink: string; at: 'off' | 'feet' | 'main'; shape?: PipShape }
  /** Orbiting marks round the waist. */
  | { kind: 'orbit'; ink: string; n: number; shape: PipShape }
  /** A chain from the hand to the ground (an anchor). */
  | { kind: 'chain'; ink: string }
  /** The real held-enemy arc (`drawSentinel` `blocking`). */
  | { kind: 'held' }

/** What the on-hit frame shows on the goblin it strikes. */
export interface Hit {
  effect?: HitEffect
  crit?: boolean
  splash?: number
  pierce?: boolean
  /** Chain arcs to this many more goblins (real `fxArc`). */
  chain?: number
  /** The goblin's own drawn states (real `drawEnemy`). */
  status?: readonly ('burn' | 'chill' | 'stun')[]
  /** Drafted marks where the game has none. */
  mark?: readonly ('poison' | 'bleed' | 'roots' | 'coin' | 'thorns' | 'crack' | 'brew' | 'skull' | 'snare' | 'star')[]
  /** A real floater over the goblin. */
  floater?: { text: string; ink: string; crit?: boolean }
  /** The real snare (`projectiles.drawTrap`) on the road under it. */
  trap?: boolean
  /** The hero is holding the goblin (the real blocking arc). */
  held?: boolean
  /** A real proc ring on the hero (`fx.fxProc`). */
  proc?: 'shock' | 'burn' | 'execute' | 'stun'
  /** A second goblin behind the first (for splash, pierce and chains). */
  second?: boolean
}

export interface DraftSkill {
  name: string
  level: 1 | 2 | 3
  does: string
  status: string
  signature?: boolean
  icon: Art
  tell: readonly Tell[]
  hit: Hit
}

/** How a people's heroes are kitted for the skill frames (what they swing or shoot). */
export interface SkillKit {
  /** An item of this people, by name, held in the weapon hand. */
  main: string
  off?: string
  delivery: 'swing' | 'arrow' | 'bolt' | 'knife'
  damageType: 'physical' | 'magic'
}

export interface People {
  id: 'humans' | 'elves' | 'dwarves' | 'reptilians' | 'gnomes'
  title: string
  company: string
  style: string
  /** The family's materials, as the sheet says them. */
  materials: string
  kit: SkillKit
  items: readonly DraftItem[]
  skills: readonly DraftSkill[]
}


export const isArt = (i: Art | IconKey): i is Art => Array.isArray(i)

const N = 16

/** Every art grid is 16 × 16 of known letters with a free border; throws on the first fault. */
export function assertArt(key: string, art: Art): void {
  if (art.length !== N) throw new Error(`${key}: ${art.length} rows, want ${N}`)
  art.forEach((row, y) => {
    if (row.length !== N) throw new Error(`${key} row ${y}: ${row.length} cols, want ${N}`)
    for (let x = 0; x < N; x++) {
      const ch = row[x]
      if (ch !== '.' && !PALETTE[ch]) throw new Error(`${key} (${x},${y}): unknown palette letter '${ch}'`)
      if (ch !== '.' && (x === 0 || y === 0 || x === N - 1 || y === N - 1)) throw new Error(`${key}: art at (${x},${y}) touches the border`)
    }
  })
}

/** The atlas rule: every empty pixel 4-adjacent to a filled one becomes the outline. */
export function outline(art: Art): string[][] {
  const g = art.map((r) => [...r])
  const out = g.map((r) => [...r])
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (g[y][x] !== '.') continue
      const near = (y > 0 && g[y - 1][x] !== '.') || (y < N - 1 && g[y + 1][x] !== '.') || (x > 0 && g[y][x - 1] !== '.') || (x < N - 1 && g[y][x + 1] !== '.')
      if (near) out[y][x] = 'K'
    }
  return out
}

/** An art grid as 16 × 16 RGBA, outlined. */
export function artRGBA(art: Art): Uint8ClampedArray<ArrayBuffer> {
  const px = new Uint8ClampedArray(new ArrayBuffer(N * N * 4))
  const g = outline(art)
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const ch = g[y][x]
      if (ch === '.') continue
      const hex = PALETTE[ch]
      const o = (y * N + x) * 4
      px[o] = parseInt(hex.slice(1, 3), 16)
      px[o + 1] = parseInt(hex.slice(3, 5), 16)
      px[o + 2] = parseInt(hex.slice(5, 7), 16)
      px[o + 3] = 255
    }
  return px
}

