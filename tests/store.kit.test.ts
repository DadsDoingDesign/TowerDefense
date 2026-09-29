import { describe, expect, it } from 'vitest'
import { useGameStore } from '../src/state/gameStore'

/**
 * The opening kit through the real store: dealt AFTER the pick, for the hero
 * picked, and worn — not left in the pack (it used to be both roster-blind
 * and unequipped, while the balance harness modelled it worn).
 */
describe('campaign opening kit', () => {
  it.each(['fighter', 'rogue', 'mystic'] as const)('%s walks out wearing an on-type kit', (arch) => {
    const s = useGameStore.getState()
    s.newRun()
    expect(useGameStore.getState().screen).toBe('heroPick')
    expect(useGameStore.getState().inventory).toEqual([])
    useGameStore.getState().pickStartingHero(arch)
    const st = useGameStore.getState()
    const hero = st.roster[0]
    expect(hero.archetype).toBe(arch)
    const w = hero.equipment.mainHand!
    expect(w).toBeTruthy()
    expect(hero.equipment.body).toBeTruthy()
    expect(hero.equipment.offHand).toBeTruthy()
    if (arch === 'mystic') expect(w.base.magDamage ?? 0).toBeGreaterThan(0)
    else expect(w.base.physDamage ?? 0).toBeGreaterThan(0)
    // Nothing the kit dealt is sitting unworn in the pack.
    expect(st.inventory).toEqual([])
  })

  it('a second pick is refused (it would re-deal the kit)', () => {
    useGameStore.getState().newRun()
    useGameStore.getState().pickStartingHero('rogue')
    const before = useGameStore.getState().roster
    useGameStore.getState().pickStartingHero('mystic')
    expect(useGameStore.getState().roster).toBe(before)
  })
})
