/**
 * ---------------------------------------------------------------------------
 * Watch Commands (Phase 3a) — the one active input a battle has
 * ---------------------------------------------------------------------------
 *
 * Before this, a battle was "tap Start, watch 20–50 seconds". A Watch Command
 * is ONE active ability per sub-wave: its charge is spent on use and refills
 * when the next sub-wave begins, so the decision is WHEN, not whether.
 *
 * The run's commands are DERIVED from its relics ({@link commandsFor}), so
 * there is no extra state to save: a run starts with {@link DEFAULT_COMMANDS}
 * and a relic that grants a command (Signal Flare → Flare) swaps it in. Every
 * command a company carries shares the same per-sub-wave charge.
 *
 * Every use is written into the battle's input log (`engine.inputLog`) with
 * the tick it fired on, and `GameEngine` replays a log to the identical result
 * at any play speed — see `tests/engine.combat.test.ts`.
 *
 * The numbers are read by the engine from HERE, so the button's copy and the
 * sim cannot disagree.
 */
export type CommandId = 'rally' | 'flare' | 'hold'

export interface WatchCommand {
  id: CommandId
  name: string
  /** One line, for the button's accessible name and the tooltip. */
  blurb: string
}

/**
 * Rally Horn: the whole company attacks this much faster for `dur` seconds.
 * The brief's +30%/6s measured ~0 base HP a node over never pressing it (§16d,
 * inside the noise): a sub-wave's crunch outlasts 6s and +30% on a clearing
 * team rarely changes a leak. +40%/8s is the smallest step that reads as a
 * decision (§16d ≈0.3 HP/node) without pushing §6 past its band (+50% did: 61%).
 */
export const RALLY = { rateMult: 1.4, dur: 8 } as const
/**
 * Flare: every enemy within `radius` of the LEAD enemy (furthest down the
 * lane) is slowed by `slow` for `dur` seconds. Auto-aimed at the front of the
 * column so it is one tap on a phone; the lead is where a slow buys the most.
 */
export const FLARE = { radius: 160, slow: 0.4, dur: 4 } as const
/** Hold the Line: the Gate ignores the next `leaks` leaks, until the sub-wave ends. */
export const HOLD = { leaks: 3 } as const

export const WATCH_COMMANDS: Record<CommandId, WatchCommand> = {
  rally: {
    id: 'rally',
    name: 'Rally Horn',
    blurb: `Your heroes attack ${Math.round((RALLY.rateMult - 1) * 100)}% faster for ${RALLY.dur}s`,
  },
  flare: {
    id: 'flare',
    name: 'Flare',
    blurb: `Slows every goblin near the front of the column by ${Math.round(FLARE.slow * 100)}% for ${FLARE.dur}s`,
  },
  hold: {
    id: 'hold',
    name: 'Hold the Line',
    blurb: `The Gate ignores the next ${HOLD.leaks} goblins to reach it this sub-wave`,
  },
}

export const COMMAND_IDS = Object.keys(WATCH_COMMANDS) as CommandId[]

/** What every run starts with. */
export const DEFAULT_COMMANDS: readonly CommandId[] = ['rally']

export const isCommandId = (x: unknown): x is CommandId => typeof x === 'string' && x in WATCH_COMMANDS

/**
 * The commands a run carries, from what its relics grant (`relicCommands` in
 * `data/relics.ts`). A granted command REPLACES the default — Signal Flare's
 * card is "Your Rally Horn becomes Flare" — so one charge is always one
 * button. Unknown ids (a newer build's command) are dropped.
 */
export function commandsFor(granted: readonly string[]): CommandId[] {
  const ids = [...new Set(granted.filter(isCommandId))]
  return ids.length ? ids : [...DEFAULT_COMMANDS]
}
