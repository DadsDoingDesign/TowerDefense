import { nextId, type RNG } from '../core/rng'
import type { EffectMods, Mutation, UpgradeGrant } from '../types'

interface MutTemplate { key: string; name: string; desc: string; downside: string; mods: EffectMods; grantUpgrade?: UpgradeGrant }

/**
 * Attack mutations — each dramatically re-shapes how a hero attacks (not just a
 * stat nudge) and, as the game's Mythic-tier reward, buys its power with a real
 * downside on another axis. Rolled at the mid-map fork.
 */
const MUTATIONS: MutTemplate[] = [
  { key: 'volatile', name: 'Volatile Rounds', desc: 'Attacks explode for wide splash damage — but fire slower.', downside: '−15% attack speed', mods: { splashAdd: 50, rateMult: 0.85 } },
  { key: 'chain', name: 'Chain Arc', desc: 'Every hit arcs to 3 nearby enemies — the main hit lands lighter.', downside: '−12% damage', mods: { shock: { chains: 3, dmgFrac: 0.6 }, damageMult: 0.88 } },
  { key: 'pierce', name: 'Piercing Volley', desc: 'Shots pierce 3 enemies and fire 30% faster — for less per hit.', downside: '−15% damage', mods: { pierce: 3, rateMult: 1.3, damageMult: 0.85 } },
  { key: 'rapid', name: 'Rapid Fire', desc: 'Doubles attack rate — each hit lands much lighter.', downside: '−45% damage per hit', mods: { rateMult: 2.0, damageMult: 0.55 }, grantUpgrade: { path: 'tempo', levels: 1 } },
  { key: 'heavy', name: 'Heavy Ordnance', desc: 'Devastating 2.2× hits — at half the fire rate.', downside: '−50% attack speed', mods: { damageMult: 2.2, rateMult: 0.5 }, grantUpgrade: { path: 'power', levels: 1 } },
  { key: 'incendiary', name: 'Incendiary', desc: 'Ignites enemies for heavy burn — direct hits are weaker.', downside: '−15% damage', mods: { burn: { dps: 40, dur: 4 }, damageMult: 0.85 } },
  { key: 'cryo', name: 'Cryo Blast', desc: 'Splash that chills enemies sharply — at a damage cost.', downside: '−15% damage', mods: { chill: { slow: 0.55, dur: 3 }, splashAdd: 34, damageMult: 0.85 } },
  { key: 'executioner', name: 'Executioner', desc: 'Executes enemies below 28% HP; +12% crit — but strikes slower.', downside: '−15% attack speed', mods: { execute: 0.28, critChanceAdd: 0.12, rateMult: 0.85 }, grantUpgrade: { path: 'precision', levels: 1 } },
  { key: 'siphon', name: 'Siphon', desc: 'Heals the base for 50% of damage — at shorter range.', downside: '−20% range', mods: { lifedrain: 0.5, rangeMult: 0.8 } },
  { key: 'overcharge', name: 'Overcharge', desc: '+60% range and +40% damage — but fires far slower.', downside: '−35% attack speed', mods: { rangeMult: 1.6, damageMult: 1.4, rateMult: 0.65 } },
  { key: 'concussive', name: 'Concussive', desc: '30% chance to stun for 0.9s — hits land weaker.', downside: '−20% damage', mods: { stunChance: 0.3, stunDur: 0.9, damageMult: 0.8 } },
]

/** Roll one random mutation, avoiding keys the hero already carries when possible. */
export function rollMutation(rng: RNG, exclude: string[] = []): Mutation {
  const pool = MUTATIONS.filter((m) => !exclude.includes(m.key))
  const t = rng.pick(pool.length ? pool : MUTATIONS)
  return { id: nextId('mut'), key: t.key, name: t.name, desc: t.desc, rarity: 'mythic', downside: t.downside, mods: t.mods, grantUpgrade: t.grantUpgrade }
}
