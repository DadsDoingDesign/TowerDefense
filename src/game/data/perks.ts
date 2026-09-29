import type { EffectMods } from '../types'

/**
 * ---------------------------------------------------------------------------
 * Spec perks — the level-up choices that replaced the skill tree (Phase 3b)
 * ---------------------------------------------------------------------------
 *
 * The old per-hero upgrade tree was three IDENTICAL paths (Onslaught / Tempo /
 * Precision) offered to all 27 specs: "+15% damage", "+12% attack speed", "+14%
 * crit". Every hero in the game made the same purchase decision, it was a gold
 * sink rather than a build choice, and it was one of the eight systems feeding
 * `damageMult`. The review also found depths 1–3 carried no build decision at
 * all — the first evolution arrived at level 10.
 *
 * A perk is a free pick-one-of-two at a level milestone, and each pair belongs
 * to a LINE: level 5 is chosen by the base archetype (every hero is still a
 * Fighter, Rogue or Mystic there), level 15 by the sub-archetype the hero
 * evolved into at 10. Nine lines, eighteen level-15 perks, none shared. Most
 * are rules — a cadence, a trigger, a status the line did not have — rather
 * than a percentage, because a percentage is the decision the old tree already
 * failed to make interesting.
 *
 * The third option at a milestone (`unlock`) is not offered until the named
 * achievement is earned — a horizontal unlock: a new way to build, never a
 * stronger version of an old one.
 *
 * Every mod here is one the engine applies (`EffectMods`, `engine.ts`); every
 * `desc` is the number it applies. `balance/report.ts` §7 measures each perk
 * alone and gates that none is dead and that no pair has a known answer.
 */
export interface Perk {
  id: string
  name: string
  /** One line, the rule in the player's words — and the engine's numbers. */
  desc: string
  mods: EffectMods
  /** Achievement id that opens this option; absent = always offered. */
  unlock?: string
}

/** The levels a perk is chosen at, in order. */
export const PERK_LEVELS = [5, 15] as const

/** Level 5: by base archetype. */
const PERKS_5: Record<string, Perk[]> = {
  fighter: [
    { id: 'f5_second_wind', name: 'Second Wind', desc: 'While blocking, heals 3% of max HP per second.', mods: { blockRegen: 0.03 } },
    { id: 'f5_last_stand', name: 'Last Stand', desc: 'Below 40% HP, strikes 60% harder.', mods: { lastStand: { below: 0.4, damage: 0.6 } } },
    { id: 'f5_riposte', name: 'Riposte', desc: 'Thorns ×1.8: every blow it takes is returned harder.', mods: { thornsMult: 1.8 }, unlock: 'lone_wolf' },
  ],
  rogue: [
    { id: 'r5_ambush', name: 'Ambush', desc: 'For the first 20s of each wave, attacks 70% faster.', mods: { openingRush: { rate: 0.7, dur: 20 } } },
    { id: 'r5_bloodrush', name: 'Bloodrush', desc: 'Each kill: attacks 25% faster for 1.5s.', mods: { killRush: { rate: 0.25, dur: 1.5 } } },
    { id: 'r5_poison', name: 'Poisoned Tips', desc: 'Every hit poisons: 10/s for 3s.', mods: { burn: { dps: 10, dur: 3 } }, unlock: 'lone_wolf' },
  ],
  mystic: [
    { id: 'm5_arc', name: 'Arc Spark', desc: 'Every hit arcs to 1 more enemy for 45% of its force.', mods: { shock: { chains: 1, dmgFrac: 0.45 } } },
    { id: 'm5_frostbite', name: 'Frostbite', desc: 'Every hit chills 25% for 1.5s.', mods: { chill: { slow: 0.25, dur: 1.5 } } },
    { id: 'm5_ember', name: 'Ember Veil', desc: 'Every hit burns: 12/s for 3s.', mods: { burn: { dps: 12, dur: 3 } }, unlock: 'lone_wolf' },
  ],
}

/** Level 15: by the sub-archetype the hero evolved into at level 10. */
const PERKS_15: Record<string, Perk[]> = {
  warrior: [
    { id: 'warrior_cleave', name: 'Cleave', desc: 'Strikes carry: +14 splash radius.', mods: { splashAdd: 14 } },
    { id: 'warrior_frenzy', name: 'Frenzy', desc: 'Each kill: attacks 90% faster for 3s.', mods: { killRush: { rate: 0.9, dur: 3 } } },
  ],
  knight: [
    { id: 'knight_concussion', name: 'Concussion', desc: 'Its bash lands more often and harder: 32% to stun, for 1.2s.', mods: { stunChance: 0.32, stunDur: 1.2 } },
    { id: 'knight_second_wind', name: 'Shield Wall', desc: 'While blocking, heals 4% of max HP per second.', mods: { blockRegen: 0.04 } },
  ],
  guard: [
    { id: 'guard_frozen', name: 'Frozen Ground', desc: 'The ground it holds freezes: blocks 4 enemies in a wider circle, and chills 45% for 2s.', mods: { block: { count: 4, radius: 95 }, chill: { slow: 0.45, dur: 2 } } },
    { id: 'guard_unbroken', name: 'Unbroken', desc: 'While blocking, heals 3% of max HP per second, and +20 armour.', mods: { blockRegen: 0.03, physDefAdd: 20 } },
  ],
  assassin: [
    { id: 'assassin_opening', name: 'Opening Cut', desc: 'For the first 25s of each wave, attacks 120% faster.', mods: { openingRush: { rate: 1.2, dur: 25 } } },
    { id: 'assassin_spree', name: 'Killing Spree', desc: 'Each kill: attacks 45% faster for 2s.', mods: { killRush: { rate: 0.45, dur: 2 } } },
  ],
  trickster: [
    { id: 'trickster_charge', name: 'Second Charge', desc: 'Its hazard burns 45/s and slows 45%.', mods: { trap: { dps: 45, slow: 0.45 } } },
    { id: 'trickster_venom', name: 'Venom', desc: 'Every hit poisons: 28/s for 4s.', mods: { burn: { dps: 28, dur: 4 } } },
  ],
  marksman: [
    { id: 'marksman_volley', name: 'Volley', desc: 'Every 2nd arrow pierces everything within its reach, and arrows fly 15% farther.', mods: { volley: { every: 2, pierce: 99 }, rangeMult: 1.15 } },
    { id: 'marksman_deadeye', name: 'Deadeye', desc: 'Every 4th arrow is a guaranteed crit, and crits hit 25% harder.', mods: { critEvery: 4, critMultAdd: 0.25 } },
  ],
  elementalist: [
    { id: 'elem_conflagration', name: 'Conflagration', desc: 'Every hit burns: 45/s for 4s.', mods: { burn: { dps: 45, dur: 4 } } },
    { id: 'elem_static', name: 'Static Field', desc: 'Every hit arcs to 2 more enemies for 50%.', mods: { shock: { chains: 2, dmgFrac: 0.5 } } },
  ],
  cleric: [
    { id: 'cleric_sanctuary', name: 'Sanctuary', desc: 'Heals allies 18/s in a wider ring.', mods: { healAura: { hps: 18, radius: 150 } } },
    { id: 'cleric_blessing', name: 'Blessing', desc: 'Allies nearby deal 20% more damage.', mods: { buffAura: { damageMult: 1.2, radius: 150 } } },
  ],
  warlock: [
    { id: 'warlock_blood_pact', name: 'Blood Pact', desc: 'While its blood price is paid (below 90% HP), strikes 30% harder.', mods: { lastStand: { below: 0.9, damage: 0.3 } } },
    { id: 'warlock_siphon', name: 'Deep Siphon', desc: 'Life-drain +0.3, and +15% damage: the Gate drinks deep of what it deals.', mods: { lifedrain: 0.3, damageMult: 1.15 } },
  ],
}

export const ALL_PERKS: Perk[] = [...Object.values(PERKS_5).flat(), ...Object.values(PERKS_15).flat()]
const PERK_BY_ID = new Map(ALL_PERKS.map((p) => [p.id, p]))

export const perkById = (id: string): Perk | undefined => PERK_BY_ID.get(id)

/**
 * The choice point a perk level belongs to, keyed the way the balance
 * harness pins it: `5:fighter`, `15:marksman`.
 */
export interface PerkPoint {
  key: string
  level: number
  line: string
  options: Perk[]
}

/** Every choice point in the game, for tooling (§7 and the build oracle). */
export function allPerkPoints(): PerkPoint[] {
  return [
    ...Object.entries(PERKS_5).map(([line, options]) => ({ key: `5:${line}`, level: 5, line, options })),
    ...Object.entries(PERKS_15).map(([line, options]) => ({ key: `15:${line}`, level: 15, line, options })),
  ]
}

/** The options at one milestone for a line, before any unlock filter. */
export function perkOptionsFor(level: number, line: string): Perk[] {
  return (level === 5 ? PERKS_5[line] : level === 15 ? PERKS_15[line] : undefined) ?? []
}

/**
 * The mods a hero's chosen perks contribute — what `computeCombat` folds in
 * where the upgrade tree's path levels used to go. An id this build does not
 * know (a save from a later build) contributes nothing rather than throwing.
 */
export function perkModsOf(s: { perks?: readonly string[] }): EffectMods[] {
  const out: EffectMods[] = []
  for (const id of s.perks ?? []) {
    const p = PERK_BY_ID.get(id)
    if (p) out.push(p.mods)
  }
  return out
}
