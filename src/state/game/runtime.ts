/**
 * The game store's process-wide mutable state that is NOT store data: the run's
 * RNG streams, whether the live run reads the hub, the wave-beat timer, and
 * whether this session owns the persisted run. Every slice reads these through
 * the holders below (an ES module cannot reassign another module's `let`), and
 * nothing here imports the store, so there are no import cycles.
 */
import { streamRng } from '../../game/core/rng'
import type { MetaBonuses } from '../metaStore'
import { useMetaStore } from '../metaStore'
import { hiresTrained } from '../../game/run/relics'
import { chooseFieldOrientation, type FieldOrientation } from '../../game/data/maps'
import { recruitSkill } from '../../game/run/skills'
import { skillPoolFor } from '../../game/run/watch'
import { runItemPool, skillCompany, weightPool } from '../../game/run/contracts'
import type { CompanyId } from '../../game/data/companies'

/**
 * Per-system RNG streams, all derived from the run seed (C1).
 *
 * They are deliberately independent: rolling one more cosmetic number, or
 * offering one more merchant item, can never reshuffle the combat rolls or the
 * map. `rng` is the loot/event stream — the one most of the store draws from.
 * Combat is not here: the engine gets its own stream per battle (see startWave).
 */
export const streams = {
  rng: streamRng(0, 'loot'),
  mapRng: streamRng(0, 'map'),
}

/** Re-seed every derived stream for a new run. Call before generating anything. */
export function seedRunStreams(runSeed: number): void {
  streams.rng = streamRng(runSeed, 'loot')
  streams.mapRng = streamRng(runSeed, 'map')
}

/**
 * The hub as a run reads it (Phase 1). Every run-logic read of the hub goes
 * through {@link runBonuses} / {@link runUnlocked}; since the Daily (which read
 * no hub) is gone, every run reads it.
 */
export const runBonuses = (): MetaBonuses => useMetaStore.getState().bonuses()
export const runUnlocked = (id: string): boolean => useMetaStore.getState().unlocked(id)
/** Whether a feat-locked option is open to this run (the ledger is `metaStore`'s). */
export const featUnlocked = (achievementId: string): boolean => useMetaStore.getState().achieved(achievementId)
/** Whether a feat-locked relic may be dealt into this run's reward hands. */
export const relicUnlocked = featUnlocked

/**
 * SK1: the skill pool a run beginning now deals from — the player's unlocked
 * cards, weighted to the route's company and the HQ's focus (`contracts.weightPool`). Read ONCE,
 * when the run begins, and kept on the run (`skillPool`): a card unlocked at
 * the end of a run never changes the run it was earned in.
 */
export const startingSkillPool = (company: CompanyId | null, focus?: RunFocus): string[] =>
  weightPool(skillPoolFor(useMetaStore.getState().skills, (id) => useMetaStore.getState().achieved(id)), company, skillCompany, focus)

/**
 * The classless rework: the item KINDS a run beginning now deals from — the
 * basic five plus the player's unlocked kinds, weighted to the route's
 * company, and any Sovereign kind owned at its low weight (`contracts.runItemPool`).
 * Read once, kept on the run (`itemPool`), like the skill pool.
 */
export const startingItemPool = (company: CompanyId | null, focus?: RunFocus): string[] =>
  runItemPool([...(useMetaStore.getState().items ?? []), ...(useMetaStore.getState().sovereign ?? [])], company, focus)

/** The HQ's company focus as a run carries it (`RunHq.focus` / `boost`). */
export type RunFocus = { company: CompanyId | null; boost: number } | null

/**
 * SK1: who deals a hire its first skill — the live run's seed and pool, set
 * whenever a run begins or resumes. A hash of the hire's id, never a stream
 * draw (`run/skills.recruitSkill`). `items` is the run's item pool, which a
 * hire is rolled from.
 */
export const skillRun: { seed: number; pool: readonly string[]; items: readonly string[] } = { seed: 0, pool: [], items: [] }
export const dealSkill = (heroId: string): string | null => recruitSkill(skillRun.seed, heroId, skillRun.pool)

/** The hub facts a mid-run hire reads (Seasoned Recruits, Free Companies), and its first skill. */
export const recruitHub = (relics: readonly string[] = []) => ({
  // Nothing the HQ sells raises a hire's stats (Seasoned Recruits retired).
  statBonus: 0,
  // Free Companies, or the Mercenary Charter relic (Phase 3b).
  trained: hiresTrained(runUnlocked('freeCompanies'), relics),
  skillFor: dealSkill,
  itemPool: skillRun.items,
})

/**
 * How long the wave-clear beat holds before the wave settles (H18).
 *
 * 900ms is a beat, not a cutscene: long enough for the sting to resolve and for
 * the banner to be read, short enough that a player taking three waves in a
 * two-minute session never feels it as a wait. It is skippable from the first
 * frame, and a LOSS gets less of it — a defeat wants the retry, not the dwell
 * (Sakurai, "Swift Retries").
 */
export const WAVE_BEAT_MS = 900
export const WAVE_BEAT_LOSS_MS = 550
/** The live hold's timer, and the one flag that lets a settlement through it. */
/**
 * Q10 — the kinds the live wave is introducing to the Codex (none of them in
 * it before this wave started). Session-only: the enemy info card keeps such a
 * kind "not met yet" until one has actually spawned. Set by `startWave`.
 */
export const waveFirsts: { kinds: ReadonlySet<string> } = { kinds: new Set() }

export const beat: { timer: ReturnType<typeof setTimeout> | null; settling: boolean } = { timer: null, settling: false }

/**
 * Drop the beat's timer (F6).
 *
 * The rule: **whoever drops the beat drops its timer, in the same breath.** An
 * orphaned timer from an earlier beat would otherwise fire into a SECOND, live
 * beat and settle it early — a wave-clear hold that ends before its sting does.
 */
export function clearBeatTimer(): void {
  if (beat.timer !== null) {
    clearTimeout(beat.timer)
    beat.timer = null
  }
}

/**
 * Whether THIS session has a run of its own on the line.
 *
 * Without this, a boot that sits in the hub showing the resume prompt would
 * count as "no live run" and the first `pagehide` — which a plain reload
 * fires — would delete the very snapshot the player was being offered. A
 * snapshot is only ever cleared by the session that owns the run it belongs to,
 * or by an explicit discard.
 */
export const session = { ownsRun: false }

/**
 * Which way up the NEXT battle's field is drawn (Portrait battlefields).
 *
 * Read once, when a battle node is entered (`selectNode`),
 * and stored on the run as the oriented `battleMap` — so a rotation mid-battle
 * never swaps the geometry under a posted company. The default reads the
 * window through the pure `chooseFieldOrientation`; with no window (the balance
 * harness, Vitest in node) it is landscape. Tests pin it with
 * `setLayoutOrientation`.
 */
export const layout: { orientation: () => FieldOrientation } = {
  orientation: () => {
    const w = typeof window !== 'undefined' ? (window as { innerWidth?: number; innerHeight?: number }) : null
    return chooseFieldOrientation(w?.innerWidth ?? 0, w?.innerHeight ?? 0)
  },
}
const defaultOrientation = layout.orientation
/** Pin the orientation the next battle is dealt (tests); `null` restores the window read. */
export function setLayoutOrientation(fn: (() => FieldOrientation) | null): void {
  layout.orientation = fn ?? defaultOrientation
}
