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
import type { RunChallenge } from '../daily'
import { MAX_BASE_HP, START_GOLD } from '../../game/run/economy'

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
 * Whether the live run reads the player's hub (Phase 1). A Daily Watch is
 * played under STANDARD rules — no hub bonuses, no unlocks — so that its seed
 * deals the same map, waves and offers to everyone who plays it that day. Every
 * run-logic read of the hub goes through {@link runBonuses} / {@link runUnlocked}.
 */
export const hub = { runUsesHub: true }
const ZERO_BONUSES: MetaBonuses = { maxBaseHp: MAX_BASE_HP, startGold: START_GOLD, statBonus: 0, extraSentinels: 0, extraItems: 0, enemyHpMult: 1 }
export const runBonuses = (): MetaBonuses => (hub.runUsesHub ? useMetaStore.getState().bonuses() : ZERO_BONUSES)
export const runUnlocked = (id: string): boolean => hub.runUsesHub && useMetaStore.getState().unlocked(id)
export const usesHub = (c: RunChallenge): boolean => c.kind !== 'daily'
/** The hub facts a mid-run hire reads (Seasoned Recruits, Free Companies). */
export const recruitHub = () => ({ statBonus: runBonuses().statBonus, trained: runUnlocked('freeCompanies') })

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
