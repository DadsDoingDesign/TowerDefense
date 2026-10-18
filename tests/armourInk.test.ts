import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ARMOUR_INK } from '../src/game/data/armourInk'

/*
 * The field badge's armour ring and the run map's armour tab wear one colour
 * per armour (asset critique, Oct 2026): the canvas's copy must match the
 * stylesheet's token, or the two drift apart the way every local copy has.
 */
describe('armour ink', () => {
  const css = readFileSync(join(__dirname, '..', 'src', 'styles', 'global.css'), 'utf8')
  for (const [mod, hex] of Object.entries(ARMOUR_INK))
    it(`${mod} matches --armour-${mod}`, () => {
      const m = new RegExp(`--armour-${mod}:\\s*(#[0-9a-fA-F]{6})`).exec(css)
      expect(m?.[1].toLowerCase()).toBe(hex)
    })
})
