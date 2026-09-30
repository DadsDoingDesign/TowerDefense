import { describe, expect, it } from 'vitest'
import { getNode } from '../src/game/data/archetypeTree'
import { createSentinel } from '../src/game/data/sentinels'
import { KIT } from '../src/game/engine/kit'
import { heroFacts, heroPickVariant, HERO_ORDER, placeHint, playStyle, recommendFirstRun } from '../src/ui/shell/heroPickFacts'

/**
 * H3-2: the hero-pick variants print plain-language lines built from the tree.
 * These pin the templates to the data, so a change in `archetypeTree.ts` that
 * makes a sentence false fails here instead of shipping a lie (the H11 lesson).
 */
const all = HERO_ORDER.map((a) => heroFacts(createSentinel(a)))
const by = (a: string) => all.find((f) => f.archetype === a)!

describe('hero-pick facts', () => {
  it('reads block, splash and damage type off the tree', () => {
    for (const f of all) {
      const node = getNode(f.archetype)
      expect(f.block).toBe(node.mods?.block?.count ?? 0)
      expect(f.damageType).toBe(node.base!.damageType)
      expect(f.splash > 0).toBe(node.base!.splashRadius > 0)
      expect(f.kit.weaponRarity).toBe(KIT[f.archetype][0].rarity)
    }
  })

  it('says a blocker holds the path, with its real block count', () => {
    const f = by('fighter')
    expect(f.block).toBeGreaterThan(0)
    expect(f.playStyle).toContain(`stops up to ${f.block} enemies`)
    expect(f.place).toMatch(/beside the path/)
  })

  it('says a splash hero hits a crowd, and never claims it blocks', () => {
    const f = by('mystic')
    expect(f.playStyle).toMatch(/every enemy near the target/)
    expect(f.playStyle).not.toMatch(/stops/)
  })

  it('states a crit rate the numbers support', () => {
    const f = by('rogue')
    const m = f.playStyle.match(/1 hit in (\d+)/)
    expect(m).not.toBeNull()
    expect(Math.abs(1 / Number(m![1]) - f.critChance)).toBeLessThan(0.1)
  })

  it('follows the numbers, not the archetype name', () => {
    // A long-reach non-blocker with no splash and no crit reads as plain shots.
    const plain = playStyle({ block: 0, splash: 0, damageType: 'physical', rate: 1, range: 200, critChance: 0.05, critMult: 1.5 })
    expect(plain).toMatch(/single shots from far back/)
    expect(placeHint({ block: 0, splash: 0, range: 90 })).toMatch(/reach is short/)
  })

  it('recommends the longest reach, and says why with the real numbers', () => {
    const rec = recommendFirstRun(all)
    const longest = Math.max(...all.map((f) => f.range))
    const f = all.find((x) => x.id === rec.id)!
    expect(f.range).toBe(longest)
    expect(rec.reason).toContain(String(f.range))
    // It never claims to be the strongest pick — only the most forgiving.
    expect(rec.reason).not.toMatch(/strongest|best/i)
  })

  it('parses the URL switch and ignores anything else', () => {
    expect(heroPickVariant('?heropick=cards')).toBe('cards')
    expect(heroPickVariant('?heropick=compare&art=fieldwatch')).toBe('compare')
    expect(heroPickVariant('?heropick=recommend')).toBe('recommend')
    expect(heroPickVariant('?heropick=nope')).toBeNull()
    expect(heroPickVariant('')).toBeNull()
  })
})
