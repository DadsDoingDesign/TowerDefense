import { beforeEach, describe, expect, it } from 'vitest'
import { dailySeed, STANDARD_RUN, utcDateKey, type RunChallenge } from '../src/state/daily'
import { useGameStore } from '../src/state/gameStore'
import { useMetaStore } from '../src/state/metaStore'
import { dailyAttempt, runTerms, seedEditable, vowAllowed } from '../src/state/runTerms'

/*
 * The hero-pick run terms (Q8): one table that the store enforces and every
 * hero-pick layout reads, so the screen cannot offer what the store refuses.
 */

const g = () => useGameStore.getState()
const DAILY: RunChallenge = { kind: 'daily', date: '2026-09-30', scored: false }
const SEEDED: RunChallenge = { kind: 'seeded', date: null, scored: false }

describe('run terms (pure)', () => {
  it('a Daily has no Vow and no seed to change; other runs have both', () => {
    expect(vowAllowed(DAILY)).toBe(false)
    expect(seedEditable(DAILY)).toBe(false)
    for (const c of [STANDARD_RUN, SEEDED]) {
      expect(vowAllowed(c)).toBe(true)
      expect(seedEditable(c)).toBe(true)
    }
  })

  it("a Daily is the scored attempt until that day's attempt is claimed", () => {
    expect(dailyAttempt(DAILY, null)).toBe('scored')
    // Yesterday's claim does not spend today's attempt.
    expect(dailyAttempt(DAILY, { date: '2026-09-29', done: true })).toBe('scored')
    // Claimed today — finished or still running — and the run is practice.
    expect(dailyAttempt(DAILY, { date: '2026-09-30', done: true })).toBe('practice')
    expect(dailyAttempt(DAILY, { date: '2026-09-30', done: false })).toBe('practice')
    expect(dailyAttempt(STANDARD_RUN, null)).toBeNull()
    expect(dailyAttempt(SEEDED, { date: '2026-09-30', done: true })).toBeNull()
  })

  it('says plainly what picking a hero spends on a Daily', () => {
    const scored = runTerms(DAILY, 7, null)
    expect(scored).toMatchObject({ seedLabel: 'Daily · 2026-09-30', editable: false, vow: false, attempt: 'scored' })
    expect(scored.lines[0]).toBe("Picking a hero uses today's one scored attempt.")
    expect(scored.lines.join(' ')).toMatch(/no Vow/)

    const practice = runTerms(DAILY, 7, { date: '2026-09-30', done: true })
    expect(practice.attempt).toBe('practice')
    expect(practice.lines[0]).toMatch(/scored attempt is used.*practice/)
  })

  it('labels a random seed and a custom seed, and names the chip for what it does', () => {
    const std = runTerms(STANDARD_RUN, 93200335, null)
    expect(std).toMatchObject({ seedLabel: 'Seed 93200335', editable: true, vow: true, attempt: null, lines: [] })
    // The visible text leads the accessible name (label-in-name).
    expect(std.seedName.startsWith(std.seedLabel)).toBe(true)

    const custom = runTerms(SEEDED, 424242, null)
    expect(custom.seedLabel).toBe('Custom seed 424242')
    expect(custom.seedName.startsWith(custom.seedLabel)).toBe(true)
    expect(custom.lines[0]).toMatch(/not ranked/)
  })
})

describe('run terms (store)', () => {
  beforeEach(() => {
    useMetaStore.getState().resetMeta()
  })

  it('a typed seed never turns the Daily into a custom-seed run', () => {
    g().startDaily()
    expect(g().reseedRun('424242')).toBe(false)
    expect(g().challenge.kind).toBe('daily')
    expect(g().runSeed).toBe(dailySeed(utcDateKey()))
    expect(g().randomizeRunSeed()).toBe(false)
    expect(g().challenge.kind).toBe('daily')
  })

  it('no Vow on a Daily, even with rungs unlocked', () => {
    useMetaStore.setState({ sacrificeTier: 3 })
    g().startDaily()
    g().setRunBanner(2)
    expect(g().runBanner).toBe(0)
  })

  it('the terms the screen shows agree with what committing a hero does', () => {
    g().startDaily()
    expect(runTerms(g().challenge, g().runSeed, useMetaStore.getState().daily).attempt).toBe('scored')
    g().pickStartingHero('fighter')
    expect(g().challenge.scored).toBe(true)
    // The next Daily start today says practice — and is practice.
    g().startDaily()
    expect(runTerms(g().challenge, g().runSeed, useMetaStore.getState().daily).attempt).toBe('practice')
    g().pickStartingHero('fighter')
    expect(g().challenge.scored).toBe(false)
  })

  it('a custom seed has a way back to a random one, and keeps its Vow', () => {
    useMetaStore.setState({ sacrificeTier: 3 })
    g().newRun()
    g().setRunBanner(2)
    expect(g().reseedRun('424242')).toBe(true)
    expect(g().challenge.kind).toBe('seeded')
    expect(g().runBanner).toBe(2)
    expect(g().randomizeRunSeed()).toBe(true)
    expect(g().challenge.kind).toBe('standard')
    expect(g().runSeed).not.toBe(424242)
    expect(g().runBanner).toBe(2)
    // Once a hero is committed, the seed is the run's.
    g().pickStartingHero('rogue')
    const seed = g().runSeed
    expect(g().randomizeRunSeed()).toBe(false)
    expect(g().runSeed).toBe(seed)
  })
})
