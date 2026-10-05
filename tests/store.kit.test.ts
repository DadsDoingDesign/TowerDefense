import { describe, expect, it } from 'vitest'
import { useGameStore } from '../src/state/gameStore'
import { heroChoices } from '../src/game/run/heroes'
import { heroDamageType } from '../src/game/data/items'
import type { Item } from '../src/game/types'

/**
 * The opening kit through the real store (the classless rework): the leader
 * walks out wearing EXACTLY the gear its card showed — `heroChoices` previews
 * it, `pickStartingHero` re-deals it with real ids — and nothing it was dealt
 * sits unworn in the pack.
 */
describe('campaign opening kit', () => {
  it.each([0, 1, 2])('pick-%i walks out wearing the gear its card showed', (i) => {
    const s = useGameStore.getState()
    s.newRun()
    expect(useGameStore.getState().screen).toBe('heroPick')
    expect(useGameStore.getState().inventory).toEqual([])
    const st0 = useGameStore.getState()
    const card = heroChoices(st0.runSeed, st0.skillPool, st0.itemPool)[i]
    useGameStore.getState().pickStartingHero(`pick-${i}`)
    const st = useGameStore.getState()
    const hero = st.roster[0]
    expect(hero.name).toBe(card.name)
    expect(hero.skills).toEqual(card.skill ? [card.skill] : undefined)
    const strip = (it: Item | null) => (it ? { ...it, id: '' } : null)
    for (const slot of ['mainHand', 'offHand', 'body'] as const) expect(strip(hero.equipment[slot])).toEqual(strip(card.equipment[slot]))
    const w = hero.equipment.mainHand!
    expect(w).toBeTruthy()
    // The weapon's damage is the damage the hero deals with it.
    if (heroDamageType(hero) === 'magic') expect(w.base.magDamage ?? 0).toBeGreaterThan(0)
    else expect(w.base.physDamage ?? 0).toBeGreaterThan(0)
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
