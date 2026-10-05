import { describe, expect, it } from 'vitest'
import { ENEMY_MODS, ENEMY_TYPES, eliteName, modKey } from '../src/game/data/enemies'
import { generateItem, RARITY } from '../src/game/data/items'
import { allMutations, mutationName } from '../src/game/data/mutations'
import { allStatCards } from '../src/game/data/rewards'
import { RNG } from '../src/game/core/rng'
import { itemName, moneyText, NODE_ICON, PERK_ICON, ICON_ORDER } from '../src/ui/channels'
import { UPGRADES } from '../src/state/metaStore'

describe('elite names', () => {
  it('put the goblin first and the modifier after it', () => {
    expect(eliteName('The Colossus Keg', 'Plated')).toBe('The Colossus Keg · Plated')
    expect(ENEMY_TYPES[modKey('barrel5', 'plated')].name).toBe('The Colossus Keg · Plated')
    expect(ENEMY_TYPES[modKey('tnt2', 'warded')].name).toBe('Bomber · Warded')
  })
  it('never puts an article in the middle of a name', () => {
    for (const base of ['torch1', 'tnt5', 'barrel5', 'torch5']) {
      for (const m of ENEMY_MODS) {
        const name = ENEMY_TYPES[modKey(base, m.id)].name
        expect(name).not.toMatch(/\w The /)
      }
    }
  })
})

describe('item names', () => {
  it('generated names no longer carry the rarity word', () => {
    const rng = new RNG(1234)
    const words = Object.values(RARITY).map((r) => r.label)
    for (let i = 0; i < 400; i++) {
      const item = generateItem(rng, { luck: 0.5 })
      for (const w of words) expect(item.name.split(' ')).not.toContain(w)
    }
  })
  it('itemName strips the rarity word from names saved before the change', () => {
    expect(itemName({ name: 'Heavy Rare Grimoire' })).toBe('Heavy Grimoire')
    expect(itemName({ name: 'Common Axe' })).toBe('Axe')
    expect(itemName({ name: 'Legendary Banner of Focus' })).toBe('Banner of Focus')
    expect(itemName({ name: 'Axe' })).toBe('Axe')
  })
})

describe('mutation display names', () => {
  it('uses the new names and resolves old saved names by key', () => {
    const names = allMutations().map((m) => m.name)
    for (const n of ['Blasting Powder', 'Siege Weight', 'Quickdraw', 'Hoarfrost', 'Emberbrand']) {
      expect(names).toContain(n)
    }
    for (const old of ['Volatile Rounds', 'Heavy Ordnance', 'Rapid Fire', 'Cryo Blast', 'Overcharge', 'Incendiary']) {
      expect(names).not.toContain(old)
    }
    expect(mutationName('volatile', 'Volatile Rounds')).toBe('Blasting Powder')
    // Cut from the pool (no-HP pass), still named on a saved hero.
    expect(mutationName('overcharge', 'Overcharge')).toBe('Stormcharged')
    expect(mutationName('no-such-key', 'Kept')).toBe('Kept')
  })
})

describe('copy', () => {
  it('reward cards state their scope and never say "bought with"', () => {
    for (const c of allStatCards()) {
      expect(c.desc).not.toMatch(/bought with|the team|tower/i)
      expect(c.desc).toMatch(/all your heroes/)
    }
  })
  it('money reads in words', () => {
    expect(moneyText(60, 'gold')).toBe('60 gold')
    expect(moneyText(1)).toBe('1 gold')
  })
})

describe('icon coverage', () => {
  it('every map node type and every perk has its own atlas cell', () => {
    for (const t of ['start', 'battle', 'elite', 'merchant', 'shrine', 'recruit', 'campfire', 'miniboss', 'boss']) {
      expect(ICON_ORDER).toContain(NODE_ICON[t])
    }
    const perkIcons = [...UPGRADES.map((u) => PERK_ICON[u.id]), PERK_ICON.sacrifice]
    expect(perkIcons.every(Boolean)).toBe(true)
    expect(new Set(perkIcons).size).toBe(perkIcons.length)
  })
})
