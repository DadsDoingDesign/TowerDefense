/**
 * LS3 — teach in layers: new ideas arrive when they matter.
 *
 * The designer: "The game should be easy to pick up … right now feels like a
 * lot to learn." A first run met about twenty ideas at once — the Gate, gold,
 * Threat, three classes and their stats, gear with rarity and enchants, the
 * pack, relics, perks, evolutions, Watch Commands, battle speed, sub-waves,
 * danger tiles, map challenges, stakes, the purse … (Perks and evolutions are
 * one idea now — skills.)
 *
 * This module is the one answer to "may this idea be on screen yet?". Pure —
 * no zustand, no React — so the rules are unit-tested (`tests/staging.test.ts`)
 * and every surface asks the same question the same way.
 *
 * **The rule.** An idea is shown when the run is not staged, or the player has
 * already met it (`met`, persisted in the meta save), or the moment it matters
 * has come (`presentIdeas`, derived from the run). The first time an idea is
 * present it is added to `met` — a latch, so an idea never disappears again
 * once seen, across a reload or a later run.
 *
 * **Who is staged.** A run is staged when it begins with no finished run on
 * the meta save and "Show everything from the start" off (`startsFirstRun`);
 * the menu is staged on the same terms (`menuStaged`): a first-timer takes one
 * free escort, and the contract board and the cash-out open after the first
 * finished contract (the mercenary company). Staging changes what is SHOWN;
 * the four things it holds back on the road itself live in
 * `game/run/firstRun.ts`.
 *
 * **The staggered reveal** (October 2026, {@link revealOf}): run 2 no longer
 * opens everything at once. The HQ opens the first time the bank holds
 * `hq.HQ_OPENS_AT` gold (latched in `met`, so it stays open); the sealed
 * crates after the first DELIVERED contract (latched too); stakes per company
 * at `contracts.STAKES_OPEN_AT` standing with it (`stakesShown`); the market
 * of the day and company focus from the `contracts.MARKET_FROM_RUN`th
 * finished contract. A save that met the HQ or the crates before the stagger
 * keeps them (the latch is the same `met` entry).
 */
import type { MapNode, RunMap } from '../game/data/runmap'
import { COMPANY_IDS, type CompanyId } from '../game/data/companies'
import { marketOpen, stakesOpen } from '../game/run/contracts'
import { cratesOpenFor, FOCUS_FROM_RUN, HQ_OPENS_AT } from '../game/run/hq'
import { standingOf, type StandingXp } from '../game/run/standing'

/**
 * Every idea the game introduces, in roughly the order a first run meets them.
 * The core ones are there from the first battle; the rest arrive later.
 */
export const IDEAS = [
  'hero',
  'post',
  'cargo',
  'gold',
  'contract',
  'escort',
  'city',
  'subwave',
  'speed',
  'depth',
  'gear',
  'command',
  'strength',
  'recruit',
  'merchant',
  'shrine',
  'campfire',
  'elite',
  'relic',
  'skill',
  'danger',
  'challenge',
  'bank',
  'purse',
  'standing',
  'stake',
  'hq',
  'crates',
  'sovereign',
  'market',
  'focus',
] as const
export type IdeaId = (typeof IDEAS)[number]

/** Met from the very first battle — never staged. A first run is an escort contract on a road of three cities. */
export const CORE_IDEAS: readonly IdeaId[] = ['hero', 'post', 'cargo', 'gold', 'contract', 'escort', 'city']

const KNOWN = new Set<string>(IDEAS)
export const isIdea = (v: unknown): v is IdeaId => typeof v === 'string' && KNOWN.has(v)

/**
 * The persisted `met` list, validated: known ids only, each once, in the order
 * first met. Anything else in a stored payload is dropped.
 */
export function readMet(raw: unknown): IdeaId[] {
  if (!Array.isArray(raw)) return []
  // SK1: a player who met perks or evolutions has met skills. The mercenary
  // company: the Gate is the cargo, Marks are the bank's gold, and the
  // difficulty step (once the Vow) is the stake. The Daily and Endless went.
  return [...new Set(raw.map((x) => (typeof x === 'string' && x in RENAMED ? RENAMED[x] : x)).filter(isIdea))]
}
const RENAMED: Record<string, IdeaId> = { perk: 'skill', evolve: 'skill', vow: 'stake', difficulty: 'stake', gate: 'cargo', marks: 'bank' }

/** The meta record's one field staging reads. */
export interface StagingStats {
  runsCompleted: number
}

/** Whether a run beginning now is staged (a first run). */
export function startsFirstRun(stats: StagingStats, showEverything: boolean): boolean {
  return !showEverything && !((stats.runsCompleted ?? 0) > 0)
}

/** Whether the menu is staged: one free escort, no board, no stakes, no cash-out. */
export function menuStaged(stats: StagingStats, showEverything: boolean): boolean {
  return !showEverything && !((stats.runsCompleted ?? 0) > 0)
}

/** The first skill choice a hero is offered (its level-5 milestone). */
export const FIRST_CHOICE_LEVEL = 5

const FIGHTS = new Set<MapNode['type']>(['battle', 'elite', 'miniboss', 'boss'])

/** What `presentIdeas` reads — `GameData` satisfies it structurally. */
export interface StageState {
  screen: string
  runMap: Pick<RunMap, 'nodes'>
  clearedNodeIds: readonly string[]
  reachableNodeIds: readonly string[]
  activeNodeId: string | null
  event: { kind: string } | null
  threat: number
  battlePhase: string
  hud: { subWave: number; breather: boolean }
  roster: readonly { level: number; skills?: readonly string[]; skillPicks?: number }[]
  reward: readonly { kind: string }[] | null
  relics: readonly string[]
  battleMap: { terrainRule?: unknown; tiles?: readonly { danger?: unknown }[] }
}

/** Fights this run has cleared (the start node is not a fight). */
export function fightsWon(s: Pick<StageState, 'runMap' | 'clearedNodeIds'>): number {
  const cleared = new Set(s.clearedNodeIds)
  return s.runMap.nodes.filter((n) => cleared.has(n.id) && FIGHTS.has(n.type)).length
}

/**
 * The ideas the run in front of the player has brought to the table right now.
 *
 * Each line is the moment that idea starts to matter:
 *  - **subwave, speed** once the first sub-wave is down (the first breather),
 *    so the player has watched one at the speed it was written for;
 *  - **depth, gear, command** after the first win: the road's length, the
 *    spoils the first win pays out, and the one-per-sub-wave command;
 *  - **strength** once enemies are stronger than at the start (after a stop);
 *  - **merchant, recruit, shrine, campfire, elite** when one is in reach or
 *    being visited;
 *  - **relic** when a relic is offered or held;
 *  - **skill** from the hero pick on: every hero there is offered with one
 *    (its coach tip is the pick's; the first milestone's tip is the choice);
 *  - **danger, challenge** when the field being fought on has them.
 */
export function presentIdeas(s: StageState): Set<IdeaId> {
  const out = new Set<IdeaId>(CORE_IDEAS)
  const won = fightsWon(s)
  const live = s.screen === 'battle'
  if (won > 0 || (live && s.battlePhase === 'battle' && (s.hud.breather || s.hud.subWave > 0))) {
    out.add('subwave')
    out.add('speed')
  }
  if (won > 0) {
    out.add('depth')
    out.add('gear')
    out.add('command')
  }
  if (s.threat > 1.001) out.add('strength')

  const byId = new Map(s.runMap.nodes.map((n) => [n.id, n]))
  const here = [...s.reachableNodeIds, ...(s.activeNodeId ? [s.activeNodeId] : [])].map((id) => byId.get(id)?.type)
  for (const kind of ['merchant', 'recruit', 'shrine', 'campfire', 'elite'] as const) {
    if (here.includes(kind) || s.event?.kind === kind) out.add(kind)
  }
  if (s.relics.length > 0 || s.reward?.some((c) => c.kind === 'relic')) out.add('relic')
  if (s.screen === 'heroPick' || s.roster.some((h) => (h.skills?.length ?? 0) > 0 || h.level >= FIRST_CHOICE_LEVEL)) out.add('skill')
  if (live && s.battleMap.tiles?.some((t) => !!t.danger)) out.add('danger')
  if (live && s.battleMap.terrainRule) out.add('challenge')
  return out
}

/** What the meta save holds that the staggered reveal reads. */
export interface RevealFacts extends StagingStats {
  /** Contracts delivered (`stats.runsWon`). */
  runsWon?: number
  bank?: number
  standing?: StandingXp
  /** The ideas already met — the HQ's and the crates' latches. */
  met?: readonly string[]
  /** Any HQ level bought (a save that bought one has met the HQ, whatever `met` says). */
  hqOwned?: boolean
}

/** What the menu, the HQ and the contract pages may show yet (the staggered reveal). */
export interface Reveal {
  /** The HQ: the first time the bank holds `hq.HQ_OPENS_AT`, then for good. */
  hq: boolean
  /** The sealed crates: after the first delivered contract, then for good. */
  crates: boolean
  /** The market of the day: from the `contracts.MARKET_FROM_RUN`th finished contract. */
  market: boolean
  /** Company focus (the HQ's Operations): from the `hq.FOCUS_FROM_RUN`th finished contract. */
  focus: boolean
}

export const ALL_REVEALED: Reveal = { hq: true, crates: true, market: true, focus: true }

/** The staggered reveal. "Show everything from the start" opens it all. */
export function revealOf(v: RevealFacts, showEverything: boolean): Reveal {
  if (showEverything) return ALL_REVEALED
  const runs = v.runsCompleted ?? 0
  const met = v.met ?? []
  return {
    hq: met.includes('hq') || !!v.hqOwned || (runs > 0 && (v.bank ?? 0) >= HQ_OPENS_AT),
    crates: met.includes('crates') || cratesOpenFor(v.runsWon ?? 0),
    market: marketOpen(runs),
    focus: runs >= FOCUS_FROM_RUN,
  }
}

/** Whether stakes show (and may be set) on `company`'s terms: at `contracts.STAKES_OPEN_AT` standing with it. */
export function stakesShown(standing: StandingXp, company: CompanyId, showEverything: boolean): boolean {
  return showEverything || stakesOpen(standingOf(standing, company))
}

/**
 * The ideas the meta save alone introduces. A finished contract opens the
 * bank, the purse, standing and the charter's goal; the rest arrive with the
 * staggered reveal: the HQ at {@link HQ_OPENS_AT} banked, the crates at the
 * first delivery, the stake at standing 2 with any company, the market and
 * focus at run {@link FOCUS_FROM_RUN}. Each is latched into `met` once seen.
 */
export function metaIdeas(v: RevealFacts): IdeaId[] {
  if (!((v.runsCompleted ?? 0) > 0)) return []
  const r = revealOf(v, false)
  const out: IdeaId[] = ['bank', 'purse', 'standing', 'sovereign']
  if (r.hq) out.push('hq')
  if (r.crates) out.push('crates')
  if (v.standing && COMPANY_IDS.some((c) => stakesOpen(standingOf(v.standing!, c)))) out.push('stake')
  if (r.market) out.push('market')
  if (r.focus) out.push('focus')
  return out
}

/** The one visibility rule. */
export function ideaShown(id: IdeaId, staged: boolean, met: readonly string[], present: ReadonlySet<IdeaId>): boolean {
  return !staged || present.has(id) || met.includes(id)
}

