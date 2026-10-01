/**
 * LS3 — teach in layers: new ideas arrive when they matter.
 *
 * The designer: "The game should be easy to pick up … right now feels like a
 * lot to learn." A first run met about twenty ideas at once — the Gate, gold,
 * Threat, three classes and their stats, gear with rarity and enchants, the
 * pack, relics, perks, evolutions, Watch Commands, battle speed, sub-waves,
 * danger tiles, map challenges, Vows, the Daily, Endless … (Perks and
 * evolutions are one idea now — skills — and the Vows are the difficulty.)
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
 * the Watchtower menu is staged on the same terms (`menuStaged`). A returning
 * player — any finished run, or a run saved before staging existed — sees
 * everything from the start. Staging changes what is SHOWN; the four things it
 * holds back on the road itself live in `game/run/firstRun.ts`.
 */
import type { MapNode, RunMap } from '../game/data/runmap'
import type { RunChallenge } from './daily'

/**
 * Every idea the game introduces, in roughly the order a first run meets them.
 * The first four are there from the first battle; the rest arrive later.
 */
export const IDEAS = [
  'hero',
  'post',
  'gate',
  'gold',
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
  'marks',
  'difficulty',
  'daily',
  'endless',
] as const
export type IdeaId = (typeof IDEAS)[number]

/** Met from the very first battle — never staged. */
export const CORE_IDEAS: readonly IdeaId[] = ['hero', 'post', 'gate', 'gold']

const KNOWN = new Set<string>(IDEAS)
export const isIdea = (v: unknown): v is IdeaId => typeof v === 'string' && KNOWN.has(v)

/**
 * The persisted `met` list, validated: known ids only, each once, in the order
 * first met. Anything else in a stored payload is dropped.
 */
export function readMet(raw: unknown): IdeaId[] {
  if (!Array.isArray(raw)) return []
  // SK1: a player who met perks or evolutions has met skills, and one who met
  // the Vows has met the difficulty — the ideas they became.
  return [...new Set(raw.map((x) => (typeof x === 'string' && x in RENAMED ? RENAMED[x] : x)).filter(isIdea))]
}
const RENAMED: Record<string, IdeaId> = { perk: 'skill', evolve: 'skill', vow: 'difficulty' }

/** The meta record's one field staging reads. */
export interface StagingStats {
  runsCompleted: number
}

/** Whether a run beginning now is staged (a first run). */
export function startsFirstRun(stats: StagingStats, showEverything: boolean, challenge: Pick<RunChallenge, 'kind'>): boolean {
  return !showEverything && challenge.kind === 'standard' && !((stats.runsCompleted ?? 0) > 0)
}

/** Whether the Watchtower menu is staged (difficulty, Daily and Endless locked). */
export function menuStaged(stats: StagingStats, showEverything: boolean): boolean {
  return !showEverything && !((stats.runsCompleted ?? 0) > 0)
}

/** The first skill choice a hero is offered (its level-5 milestone). */
export const FIRST_CHOICE_LEVEL = 5

const FIGHTS = new Set<MapNode['type']>(['battle', 'elite', 'miniboss', 'boss'])

/** What `presentIdeas` reads — `GameData` satisfies it structurally. */
export interface StageState {
  mode: 'campaign' | 'endless'
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
  if (s.mode === 'campaign' && s.threat > 1.001) out.add('strength')

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

/** The ideas the meta save alone introduces: a finished run opens all four. */
export function metaIdeas(stats: StagingStats): IdeaId[] {
  return (stats.runsCompleted ?? 0) > 0 ? ['marks', 'difficulty', 'daily', 'endless'] : []
}

/** The one visibility rule. */
export function ideaShown(id: IdeaId, staged: boolean, met: readonly string[], present: ReadonlySet<IdeaId>): boolean {
  return !staged || present.has(id) || met.includes(id)
}

/**
 * The party row's "Open slot · recruit a hero" card.
 *
 * It names the recruit idea, so it follows it — with one exception the brief
 * spells out: the first battle is only "post a hero, start the wave". A
 * recruit stop in reach on the first map (layer 1 may roll one) latches the
 * idea before the first fight, so on a staged run the card also waits out that
 * fight. Everywhere else — and on any run that is not staged — it is exactly
 * `recruitShown`.
 */
export function openSlotShown(
  staged: boolean,
  recruitShown: boolean,
  s: Pick<StageState, 'screen' | 'runMap' | 'clearedNodeIds'>,
): boolean {
  if (!staged) return recruitShown
  if (s.screen === 'battle' && fightsWon(s) === 0) return false
  return recruitShown
}
