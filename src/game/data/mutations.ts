import { nextId, type RNG } from '../core/rng'
import type { EffectMods, Mutation } from '../types'

interface MutTemplate { key: string; name: string; desc: string; mods: EffectMods }

/**
 * Attack mutations — each dramatically changes how a hero attacks (not just a
 * stat nudge). Rolled at the mid-map fork.
 */
const MUTATIONS: MutTemplate[] = [
  { key: 'volatile', name: 'Volatile Rounds', desc: 'Attacks explode on impact for splash damage in a wide radius.', mods: { splashAdd: 46, damageMult: 1.05 } },
  { key: 'chain', name: 'Chain Arc', desc: 'Every hit arcs to 3 nearby enemies for 60% damage.', mods: { shock: { chains: 3, dmgFrac: 0.6 } } },
  { key: 'pierce', name: 'Piercing Volley', desc: 'Shots pierce through 3 enemies and fire 30% faster.', mods: { pierce: 3, rateMult: 1.3 } },
  { key: 'rapid', name: 'Rapid Fire', desc: 'Doubles attack rate, but each hit lands lighter.', mods: { rateMult: 2.0, damageMult: 0.62 } },
  { key: 'heavy', name: 'Heavy Ordnance', desc: 'Huge, slow hits — 2.1× damage at 60% rate.', mods: { damageMult: 2.1, rateMult: 0.6 } },
  { key: 'incendiary', name: 'Incendiary', desc: 'Ignites enemies for heavy burning damage over time.', mods: { burn: { dps: 34, dur: 4 }, damageMult: 1.05 } },
  { key: 'cryo', name: 'Cryo Blast', desc: 'Attacks splash and chill enemies, slowing them sharply.', mods: { chill: { slow: 0.5, dur: 2.5 }, splashAdd: 34 } },
  { key: 'executioner', name: 'Executioner', desc: 'Instantly kills enemies below 25% HP; +12% crit.', mods: { execute: 0.25, critChanceAdd: 0.12 } },
  { key: 'siphon', name: 'Siphon', desc: 'Heals the base for 40% of damage dealt; +20% damage.', mods: { lifedrain: 0.4, damageMult: 1.2 } },
  { key: 'overcharge', name: 'Overcharge', desc: '+50% range, +35% damage, +20% attack rate.', mods: { rangeMult: 1.5, damageMult: 1.35, rateMult: 1.2 } },
  { key: 'concussive', name: 'Concussive', desc: '25% chance to stun enemies on hit for 0.8s.', mods: { stunChance: 0.25, stunDur: 0.8 } },
]

/** Roll one random mutation, avoiding keys the hero already carries when possible. */
export function rollMutation(rng: RNG, exclude: string[] = []): Mutation {
  const pool = MUTATIONS.filter((m) => !exclude.includes(m.key))
  const t = rng.pick(pool.length ? pool : MUTATIONS)
  return { id: nextId('mut'), key: t.key, name: t.name, desc: t.desc, mods: t.mods }
}
