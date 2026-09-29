import { create } from 'zustand'
import { HERO_SLOT_LABEL, heroSlotsFor } from '../../game/data/items'
import { computeCombat, totalStats } from '../../game/engine/combat'
import type { HeroSlot, Item, Sentinel } from '../../game/types'
import { useGameStore } from '../../state/gameStore'

/**
 * Whose gear the Detail band is showing (Phase 2, finding 4).
 *
 * The shell has ONE selection, so tapping an item in the pack deselected the
 * hero whose gear you were looking at, and the Gear column silently fell back
 * to `roster[0]`. This remembers the last hero you looked at, so "Equip →" has
 * a target that is the hero you meant, and the Gear column can say whose it is.
 * Presentation only; never snapshotted.
 */
export const useGearTarget = create<{ heroId: string | null }>(() => ({ heroId: null }))
useGameStore.subscribe((s, prev) => {
  if (s.shellSelection?.kind === 'hero' && s.shellSelection !== prev.shellSelection) {
    useGearTarget.setState({ heroId: s.shellSelection.id })
  }
  if (s.gearSlot && s.gearSlot !== prev.gearSlot) useGearTarget.setState({ heroId: s.gearSlot.sentinelId })
})

/**
 * Where `item` would go on `hero`, what it would push back to the pack, and the
 * hero as they would stand afterwards. Mirrors `equipFromPack`'s two-hand rules
 * exactly (src/game/run/inventory.ts), so the preview is the result.
 */
export function planEquip(hero: Sentinel, item: Item, armed?: HeroSlot | null) {
  const slots = heroSlotsFor(item.slot)
  const eq = hero.equipment
  let slot: HeroSlot
  if (armed && slots.includes(armed)) slot = armed
  else if (item.slot === 'oneHand') {
    // An empty hand first; otherwise the main hand (a swap).
    slot = !eq.mainHand ? 'mainHand' : !eq.offHand && eq.mainHand.slot !== 'twoHand' ? 'offHand' : 'mainHand'
  } else slot = slots[0]

  const next = { ...eq }
  const displaced: Item[] = []
  const ret = (it: Item | null) => {
    if (it) displaced.push(it)
  }
  if (item.slot === 'twoHand') {
    ret(next.mainHand)
    ret(next.offHand)
    next.mainHand = item
    next.offHand = null
  } else if (slot === 'offHand' && next.mainHand?.slot === 'twoHand') {
    ret(next.mainHand)
    next.mainHand = null
    ret(next.offHand)
    next.offHand = item
  } else {
    ret(next[slot])
    next[slot] = item
  }
  return { slot, slotLabel: HERO_SLOT_LABEL[slot], displaced, after: { ...hero, equipment: next } as Sentinel }
}

export interface GearDelta {
  label: string
  before: number
  after: number
  /** Rounded display strings. */
  a: string
  b: string
}

/** The lines that MOVE when `after` replaces `before`, DPS first. */
export function gearDeltas(before: Sentinel, after: Sentinel): GearDelta[] {
  const p0 = computeCombat(before)
  const p1 = computeCombat(after)
  const s0 = totalStats(before)
  const s1 = totalStats(after)
  const rows: [string, number, number, (n: number) => string][] = [
    ['DPS', p0.dps, p1.dps, (n) => String(Math.round(n))],
    ['STR', s0.str, s1.str, (n) => String(Math.round(n))],
    ['DEX', s0.dex, s1.dex, (n) => String(Math.round(n))],
    ['INT', s0.int, s1.int, (n) => String(Math.round(n))],
    ['Reach', p0.range, p1.range, (n) => String(Math.round(n))],
    ['Crit', p0.critChance * 100, p1.critChance * 100, (n) => `${Math.round(n)}%`],
    ['Splash', p0.splashRadius, p1.splashRadius, (n) => String(Math.round(n))],
  ]
  return rows
    .filter(([, a, b, f]) => f(a) !== f(b))
    .map(([label, a, b, f]) => ({ label, before: a, after: b, a: f(a), b: f(b) }))
}

/** Enchantments on the new item that the displaced gear did not carry. */
export function newAffixes(item: Item, displaced: readonly Item[]): string[] {
  const had = new Set(displaced.flatMap((d) => d.enchantments.map((e) => e.label)))
  return item.enchantments.filter((e) => !had.has(e.label)).map((e) => e.label)
}

/** The hero this item helps most (DPS), for when nobody is being looked at. */
export function bestFitHero(roster: readonly Sentinel[], item: Item): Sentinel | undefined {
  let best: { h: Sentinel; gain: number } | undefined
  for (const h of roster) {
    const gain = computeCombat(planEquip(h, item).after).dps - computeCombat(h).dps
    if (!best || gain > best.gain) best = { h, gain }
  }
  return best?.h
}

/**
 * The hero a loose item would be equipped on: the hero whose slot is armed,
 * else the one you last looked at, else the one it helps most. ONE answer, read
 * by both the item panel's "Equip →" and the Gear column, so the column always
 * shows the gear the comparison is against.
 */
export function equipTarget(
  roster: readonly Sentinel[],
  item: Item,
  armedHeroId: string | null | undefined,
  rememberedId: string | null,
): Sentinel | undefined {
  return (
    roster.find((h) => h.id === armedHeroId) ?? roster.find((h) => h.id === rememberedId) ?? bestFitHero(roster, item)
  )
}
