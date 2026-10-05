import { beforeEach, describe, expect, it } from 'vitest'
import { migrateChallenge, SEEDED_RUN, STANDARD_RUN } from '../src/state/seeds'
import { useGameStore } from '../src/state/gameStore'
import { useMetaStore } from '../src/state/metaStore'
import { runTerms, seedEditable } from '../src/state/runTerms'

/*
 * The hero-pick run terms (Q8): one table that the store enforces and the
 * hero-pick seed chip reads, so the screen cannot offer what the store refuses.
 * The Daily (with its fixed seed and scored attempt) is gone; the stake that
 * replaced the difficulty step is set on the contract board, before the pick.
 */
const g = () => useGameStore.getState()

describe('run terms (pure)', () => {
  it('any contract’s seed can be typed over', () => {
    for (const c of [STANDARD_RUN, SEEDED_RUN]) expect(seedEditable(c)).toBe(true)
  })

  it('labels a random seed and a custom seed, and names the chip for what it does', () => {
    const std = runTerms(STANDARD_RUN, 93200335)
    expect(std).toMatchObject({ seedLabel: 'Seed 93200335', editable: true, lines: [] })
    expect(std.seedName.startsWith(std.seedLabel)).toBe(true)
    const custom = runTerms(SEEDED_RUN, 424242)
    expect(custom.seedLabel).toBe('Custom seed 424242')
    expect(custom.seedName.startsWith(custom.seedLabel)).toBe(true)
    expect(custom.lines.join(' ')).toMatch(/no standing/)
  })

  it('a Daily saved before the Daily was removed resumes as a standard run', () => {
    expect(migrateChallenge({ kind: 'daily', date: '2026-09-30', scored: true })).toEqual(STANDARD_RUN)
    expect(migrateChallenge({ kind: 'seeded' })).toEqual(SEEDED_RUN)
    expect(migrateChallenge('junk')).toEqual(STANDARD_RUN)
  })
})

describe('the store honours the terms', () => {
  beforeEach(() => {
    useMetaStore.getState().resetMeta()
    useMetaStore.setState({ stats: { ...useMetaStore.getState().stats, runsCompleted: 2 } })
  })

  it('a typed seed re-deals the run on the same contract, marked custom', () => {
    g().openContracts({ company: 'art', crates: 1, purse: 30 })
    g().signContract()
    expect(g().screen).toBe('heroPick')
    expect(g().reseedRun('tuesday')).toBe(true)
    expect(g().challenge.kind).toBe('seeded')
    expect(g().contract).toMatchObject({ company: 'art', crates: 1, purse: 30, signed: false })
    expect(g().randomizeRunSeed()).toBe(true)
    expect(g().challenge.kind).toBe('standard')
  })

  it('refuses a re-seed once a hero is committed', () => {
    g().newRun()
    g().pickStartingHero('pick-0')
    expect(g().reseedRun('42')).toBe(false)
  })
})
