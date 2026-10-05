import type { TerrainRuleId } from '../types'

/**
 * ---------------------------------------------------------------------------
 * The trade companies (the mercenary company, build step 2)
 * ---------------------------------------------------------------------------
 *
 * The designer: "you run a private militia hired by trade companies to clear
 * their trade routes". Five companies hire you, one route each. A company is:
 *
 *  - a **name, crest and colour** (the approved night-lantern mockups,
 *    `trade/NOTES.md` § Palette). The colour is a FILL and a light, never body
 *    text; the crest shape and the name always ride with it, so colour is never
 *    the only carrier;
 *  - its **goods** — what its cargo crates hold, and what the market of the day
 *    names (`run/contracts.marketOfDay`);
 *  - its **route ground** — the existing map challenges and hazards as company
 *    flavour (`run/terrain.nodeTerrainRule` reads `ground.rules`);
 *  - its **pool**: every skill card and item kind names a company (`Skill.company`,
 *    `ItemKind.company`). On that company's routes its pieces are dealt more
 *    often (`run/contracts.weightPool`); a standing level with it unlocks its
 *    cards first (`run/standing.rollStandingCard`).
 *  - its **towns**: the three cities its road stops at — the three act bosses.
 *
 * Pure data. `game/` must not import `ui/`, so the crest's pixel rows live
 * here and the UI (`ui/pixel.tsx`) and the canvas both draw from them.
 */
export type CompanyId = 'spice' | 'art' | 'metals' | 'silk' | 'scrolls'

export const COMPANY_IDS: readonly CompanyId[] = ['spice', 'art', 'metals', 'silk', 'scrolls']

export const isCompanyId = (v: unknown): v is CompanyId => typeof v === 'string' && (COMPANY_IDS as readonly string[]).includes(v)

export interface RouteGround {
  /** The ground's name, as the contract board shows it ("Wildfire"). */
  name: string
  /** The map challenges a battle on this road may carry (one is drawn per battle, as ever). */
  rules: readonly TerrainRuleId[]
  /** The 8px swatch beside the name (a chip, never a signal on its own). */
  swatch: string
}

export interface Company {
  id: CompanyId
  /** Its trading name: "Peppercorn Co.". */
  name: string
  /** What it trades, as the board names it: "Spice", "Metals & Stones". */
  goods: string
  /** The goods as a lower-case noun for a sentence: "its spice", "crates of ore". */
  noun: string
  /** The company's hue (`--co-<id>`). A fill and a light; names stay cream. */
  color: string
  ground: RouteGround
  /** Its road's three cities, in order: act 1's, act 2's, and the destination. */
  towns: readonly [string, string, string]
  /**
   * Its own contract letters, `{c1}`/`{c2}`/`{dest}`/`{noun}` filled in. One
   * line each, the world talking — never a rule.
   */
  letters: readonly string[]
  /**
   * The emblem drawn on its crest (8 × 8 pixel rows: `o` outline, `p` paper,
   * `g` gold). The shield around it is shared (`crestRows`).
   */
  emblem: readonly string[]
  /** A company that opens later: it hires once you hold this standing with ANY company. */
  opensAt?: number
}

/** The ground every route used to share, and a battle with no contract still deals. */
export const OPEN_GROUND: readonly TerrainRuleId[] = ['flooded', 'wildfire']

export const COMPANIES: readonly Company[] = [
  {
    id: 'spice',
    name: 'Peppercorn Co.',
    goods: 'Spice',
    noun: 'spice',
    color: '#c6e05a',
    ground: { name: 'Wildfire', rules: ['wildfire'], swatch: '#e0743a' },
    towns: ['Saltmarsh', 'Cinder Ford', 'Pepperport'],
    letters: [
      '{name} seeks an escort for its {noun}, by {c1} and {c2} to {dest}.',
      '{name} wants its {noun} through the burning country to {dest} before the price turns.',
    ],
    emblem: ['..o..o..', '...oo...', '..pppp..', '.pppppp.', 'ppppgppp', 'pppgggpp', 'ppppgppp', '.pppppp.'],
  },
  {
    id: 'art',
    name: 'Easel House',
    goods: 'Art',
    noun: 'paintings',
    color: '#c6a4ff',
    ground: { name: 'Flooded canals', rules: ['flooded'], swatch: '#4f8fc4' },
    towns: ['Hollowmere', 'Gilt Bridge', 'Varnish'],
    letters: [
      '{name} needs its {noun} kept dry along the canal road to {dest}.',
      '{name} sends its {noun} by {c1} and {c2} to {dest}, and pays for every frame that arrives.',
    ],
    emblem: ['gggggggg', 'gppppppg', 'gpppoppg', 'gppooopg', 'gpooooog', 'gppppppg', 'gggggggg', '........'],
  },
  {
    id: 'metals',
    name: 'Ironvein',
    goods: 'Metals & Stones',
    noun: 'ore',
    color: '#5d8be2',
    ground: { name: 'Quarry boulders', rules: ['quarry'], swatch: '#8a8a8a' },
    towns: ['Slagpit', 'Cobble Rise', 'Deepforge'],
    letters: [
      '{name} will pay well for {noun} that reaches {dest} unstolen.',
      '{name} needs its {noun} hauled past the quarries, by {c1} and {c2} to {dest}.',
    ],
    emblem: ['..oooo..', '.oppppo.', 'oppppppo', 'oooooooo', '.oppppo.', '..oppo..', '...oo...', '........'],
  },
  {
    id: 'silk',
    name: 'Rosethread',
    goods: 'Silk',
    noun: 'silk',
    color: '#dba5b9',
    ground: { name: 'Fords and fires', rules: OPEN_GROUND, swatch: '#a08060' },
    towns: ['Reedwick', 'Spindle', 'Loomhaven'],
    letters: [
      '{name} asks for quiet blades on the river road to {dest}.',
      '{name} sends bolts of {noun} by {c1} and {c2} to {dest}, and pays by the bolt.',
    ],
    emblem: ['oooooooo', '.pppppp.', '.gggggg.', '.pppppp.', '.gggggg.', '.pppppp.', 'oooooooo', '........'],
  },
  {
    id: 'scrolls',
    name: 'Moonquill',
    goods: 'Scrolls & Arcana',
    noun: 'scrolls',
    color: '#e4e8f2',
    ground: { name: 'Cursed ground', rules: ['hexed'], swatch: '#f49e80' },
    towns: ['Quill Hill', 'Lanternhold', 'Inkspire'],
    letters: [
      '{name} seeks wardens for sealed {noun} bound for {dest}.',
      '{name} sends its {noun} over cursed ground, by {c1} and {c2} to {dest}.',
    ],
    emblem: ['.oooooo.', 'oppppppo', '.pgggpp.', '.pppppp.', '.pggggp.', '.pppppp.', 'oppppppo', '.oooooo.'],
    opensAt: 3,
  },
]

const BY_ID = new Map(COMPANIES.map((c) => [c.id, c]))
export const companyById = (id: CompanyId): Company => BY_ID.get(id)!

/** The company a first-timer's one free escort is for. */
export const FIRST_COMPANY: CompanyId = 'spice'

/**
 * The Sovereign Route's emblem (the endgame charter): a crown — no company's
 * road, so no company's crest. Drawn on the same shield in the Sovereign cyan.
 */
export const SOVEREIGN_EMBLEM: readonly string[] = ['........', 'g..gg..g', 'gg.gg.gg', 'gggggggg', 'gpggggpg', 'gggggggg', '.oooooo.', '........']

/** A locked company's emblem: a question mark. */
export const UNKNOWN_EMBLEM: readonly string[] = ['..pppp..', '.pp..pp.', '.....pp.', '....pp..', '...pp...', '...pp...', '........', '...pp...']

/**
 * The crest's pixel rows: a 16 × 18 heater shield (`o` outline, `l` light top,
 * `c` field, `d` shaded right edge) with the 8 × 8 emblem set into it.
 */
export function crestRows(emblem: readonly string[]): string[] {
  const W = 16
  const H = 18
  const rows: string[][] = []
  const inside = (x: number, y: number): boolean => {
    if (y < 0 || y >= H) return false
    if (y < 10) return x >= 1 && x <= 14
    const half = 7 - Math.floor((y - 9) * 0.85)
    return x >= 8 - half && x <= 7 + half
  }
  for (let y = 0; y < H; y++) {
    const r: string[] = []
    for (let x = 0; x < W; x++) {
      if (!inside(x, y)) r.push('.')
      else if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) r.push('o')
      else if (y <= 2) r.push('l')
      else if (!inside(x + 2, y)) r.push('d')
      else r.push('c')
    }
    rows.push(r)
  }
  emblem.forEach((er, ey) => er.split('').forEach((ch, ex) => {
    if (ch !== '.') rows[4 + ey][4 + ex] = ch
  }))
  return rows.map((r) => r.join(''))
}
