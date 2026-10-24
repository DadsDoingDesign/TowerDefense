/**
 * The armour colours, for the canvas (asset critique, Oct 2026, round 3).
 *
 * The run map's armour tab (`.mn-armour`, `ArmourMark`) has always worn them —
 * `--armour-plated` and `--armour-warded` in `global.css` — but the badge over
 * an armoured goblin's head on the field was ringed in the same gold as every
 * other elite, so nothing tied "Warded" on the map to the Warded goblin in the
 * lane. The badge's ring now wears the same colour. `game/` cannot read CSS,
 * so the values live here and `tests/armourInk.test.ts` holds them equal to
 * the stylesheet's tokens.
 */
export const ARMOUR_INK = {
  plated: '#a9b9c9',
  warded: '#b28cf0',
} as const
