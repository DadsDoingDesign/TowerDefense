import type { EffectMods } from '../types'
import type { FusionElement } from './fusions'

/**
 * ---------------------------------------------------------------------------
 * Ordered merges (Oct 2026) — every library skill's INFUSION half
 * ---------------------------------------------------------------------------
 *
 * The designer: "the merging should be possible with any combination in any
 * order, but order does matter and affects what's made."
 *
 * So every library skill (`data/skills.ts`) has two halves. Its CORE is its
 * own `mods`: what it does in a slot of its own, and what it keeps when it is
 * the BASE of a merge (the skill already in the slot, which keeps its name,
 * its numbers and the way it delivers them). Its INFUSION is below: what it
 * lends when it is dropped onto another skill — a share of its strength
 * (about 40%), its tag (the element it lends), and the adjective it names
 * the merge with ("Frozen Arc Spark" is Arc Spark with Frostbite poured in).
 * Dropped the other way round the same two skills make a different skill:
 * "Sparking Frostbite" is Frostbite's slow at full with Arc Spark's jump lent.
 *
 * The share stacks on what the base already does (`skills.stackShare`): a
 * burn onto a burn adds its damage, a slow onto a slow its slow, chains'
 * damage onto chains. Everything else is added as it is.
 *
 * Then ONE re-expression rule (`reexpress`, below) may apply: the infusion's
 * tag met through the base's DELIVERY — the way the base puts its effect on
 * enemies (a jump, a splash, a pierce, a hold, an aura, a status). The rules
 * reuse the fusion twists (`types.ts`, the fifteen at the end of
 * `EffectMods`): nothing here is a mechanic of its own, and no engine code
 * reads this file.
 *
 * Named recipes (`data/fusions.ts`) are the specials: for one ordered pair,
 * a stronger twist of their own in place of the rule.
 *
 * Pure data: no import of `skills.ts`. `tests/merge.test.ts` holds every
 * library skill to exactly one entry, every line to COPY.md's 80 characters,
 * and every adjective to one word no other skill uses.
 */

/** The element an infusion lends — what the re-expression rules key on. */
export type InfusionTag =
  | 'fire'
  | 'poison'
  | 'frost'
  | 'storm'
  | 'splash'
  | 'steel'
  | 'crit'
  | 'speed'
  | 'blood'
  | 'reach'
  | 'guard'
  | 'banner'
  | 'root'
  | 'gold'
  | 'mend'

/** The colour each tag flashes in (`fusions.ELEMENT_TOKEN`): the merge's tag on the card and the beat. */
export const TAG_ELEMENT: Readonly<Record<InfusionTag, FusionElement>> = {
  fire: 'fire',
  poison: 'poison',
  frost: 'frost',
  storm: 'storm',
  splash: 'steel',
  steel: 'steel',
  crit: 'wind',
  speed: 'wind',
  blood: 'blood',
  reach: 'wind',
  guard: 'steel',
  banner: 'banner',
  root: 'poison',
  gold: 'banner',
  mend: 'banner',
}

export interface Infusion {
  tag: InfusionTag
  /** One word, the merge's first: "Frozen" Arc Spark. No two skills share one. */
  adj: string
  /** The share it lends (about 40% of its own strength). */
  mods: EffectMods
  /** The share in one line, with its numbers (COPY.md: ≤ 80 characters). */
  line: string
}

export const INFUSIONS: Readonly<Record<string, Infusion>> = {
  // ---- Level 1 ---------------------------------------------------------------
  quick_hands: { tag: 'speed', adj: 'Quick', mods: { rateMult: 1.06 }, line: 'Attacks 6% faster.' },
  hard_hitter: { tag: 'steel', adj: 'Hard', mods: { damageMult: 1.06 }, line: 'Hits 6% harder.' },
  keen_eye: { tag: 'crit', adj: 'Keen', mods: { critChanceAdd: 0.04, critMultAdd: 0.2 }, line: 'Crit chance +4%, crit damage +20%.' },
  hold_fast: { tag: 'guard', adj: 'Steadfast', mods: { vsHeld: 0.08 }, line: 'Hits 8% harder on held enemies.' },
  charge: { tag: 'speed', adj: 'Charging', mods: { openingRush: { rate: 0.25, dur: 15 } }, line: 'Attacks 25% faster for the first 15s of each wave.' },
  bloodrush: { tag: 'blood', adj: 'Bloodied', mods: { killRush: { rate: 0.1, dur: 1.5 } }, line: 'Each kill makes it attack 10% faster for 1.5s.' },
  poison_tips: { tag: 'poison', adj: 'Venomous', mods: { burn: { dps: 4, dur: 3 } }, line: 'Hits poison 4/s for 3s.' },
  arc_spark: { tag: 'storm', adj: 'Sparking', mods: { shock: { chains: 1, dmgFrac: 0.18 } }, line: 'Hits jump to 1 more enemy for 18%.' },
  frostbite: { tag: 'frost', adj: 'Frozen', mods: { chill: { slow: 0.1, dur: 1.5 } }, line: 'Hits slow 10% for 1.5s.' },
  long_reach: { tag: 'reach', adj: 'Reaching', mods: { rangeMult: 1.08 }, line: 'Reaches 8% farther.' },
  cleave: { tag: 'splash', adj: 'Cleaving', mods: { splashAdd: 6 }, line: 'Hits also strike enemies within 6.' },
  bounty: { tag: 'gold', adj: 'Gilded', mods: { goldPerKill: 1 }, line: 'Each kill pays 1 more gold.' },
  pin_down: { tag: 'guard', adj: 'Pinning', mods: { vsHeld: 0.12 }, line: 'Hits 12% harder on held enemies.' },
  riposte: { tag: 'guard', adj: 'Barbed', mods: { thornsMult: 1.3 }, line: 'Thorns +30%.' },
  // ---- Level 2 ---------------------------------------------------------------
  heavy_blows: { tag: 'steel', adj: 'Mighty', mods: { damageMult: 1.1, rateMult: 1.04 }, line: 'Hits 10% harder and attacks 4% faster.' },
  long_shot: { tag: 'reach', adj: 'Farshot', mods: { rangeMult: 1.15, projSpeedMult: 1.15 }, line: 'Reaches 15% farther.' },
  finisher: { tag: 'blood', adj: 'Merciless', mods: { execute: 0.06, damageMult: 1.04 }, line: 'Kills under 6% health outright; hits 4% harder.' },
  shield_wall: { tag: 'guard', adj: 'Walled', mods: { holdAdd: 1 }, line: 'Holds 1 more enemy.' },
  anchor: { tag: 'guard', adj: 'Anchored', mods: { chill: { slow: 0.12, dur: 1.4 }, thornsMult: 1.5 }, line: 'Hits slow 12% for 1.4s; thorns +50%.' },
  stunning_bash: { tag: 'steel', adj: 'Stunning', mods: { stunChance: 0.07, stunDur: 0.7 }, line: 'Hits have a 7% chance to stun for 0.7s.' },
  snare: { tag: 'root', adj: 'Snaring', mods: { trap: { dps: 6, slow: 0.12 } }, line: 'Lays a snare on the path that burns 6/s and slows 12%.' },
  wildfire: { tag: 'fire', adj: 'Blazing', mods: { burn: { dps: 5, dur: 3 }, splashAdd: 6 }, line: 'Hits burn 5/s for 3s and splash 6 wider.' },
  blessing: { tag: 'banner', adj: 'Blessed', mods: { buffAura: { damageMult: 1.15, radius: 110 } }, line: 'Heroes near it hit 15% harder.' },
  gate_siphon: { tag: 'blood', adj: 'Siphoning', mods: { damageMult: 1.18, lifedrain: 0.1 }, line: 'Hits 18% harder; every 100 damage wins back 1% cargo.' },
  killing_spree: { tag: 'blood', adj: 'Frenzied', mods: { killRush: { rate: 0.18, dur: 2 } }, line: 'Each kill makes it attack 18% faster for 2s.' },
  cold_snap: { tag: 'frost', adj: 'Brittle', mods: { vsSlowed: 0.1 }, line: 'Hits 10% harder on slowed enemies.' },
  firebrand: { tag: 'fire', adj: 'Branded', mods: { thornsBurn: { dps: 5, dur: 3 } }, line: 'Its thorns burn what it holds 5/s for 3s.' },
  split_shot: { tag: 'reach', adj: 'Splitting', mods: { volley: { every: 3, pierce: 1 } }, line: 'Every 3rd attack passes through 1 more enemy.' },
  deadeye: { tag: 'crit', adj: 'Sighted', mods: { critEvery: 8, critMultAdd: 0.1 }, line: 'Every 8th attack crits; crit damage +10%.' },
  pepperfire: { tag: 'fire', adj: 'Peppered', mods: { burn: { dps: 4, dur: 3 }, rateMult: 1.06 }, line: 'Hits burn 4/s for 3s; attacks 6% faster.' },
  gilt_frame: { tag: 'crit', adj: 'Starlit', mods: { rangeMult: 1.1, critChanceAdd: 0.06, critMultAdd: 0.1 }, line: 'Reaches 10% farther; crit chance +6%, crit damage +10%.' },
  ore_sense: { tag: 'steel', adj: 'Veined', mods: { damageMult: 1.08 }, line: 'Hits 8% harder.' },
  velvet_toll: { tag: 'gold', adj: 'Tolled', mods: { goldPerKill: 1, chill: { slow: 0.1, dur: 1.5 } }, line: 'Each kill pays 1 more gold; hits slow 10% for 1.5s.' },
  moonwake: { tag: 'storm', adj: 'Blooming', mods: { shock: { chains: 1, dmgFrac: 0.2 }, chill: { slow: 0.1, dur: 1.5 } }, line: 'Hits jump to 1 more enemy for 20% and slow 10% for 1.5s.' },
  bolder_bash: { tag: 'splash', adj: 'Bold', mods: { damageMult: 1.08, splashAdd: 8 }, line: 'Hits 8% harder and splash 8 wider.' },
  banner_bearer: { tag: 'banner', adj: 'Bannered', mods: { rateAura: { rateMult: 1.08, radius: 110 } }, line: 'Heroes near it attack 8% faster.' },
  venom_spit: { tag: 'poison', adj: 'Spitting', mods: { spitEvery: { every: 5, count: 2, dps: 8, dur: 3 } }, line: 'Every 5th attack poisons the 2 nearest enemies 8/s for 3s.' },
  overgrowth: { tag: 'root', adj: 'Overgrown', mods: { trap: { dps: 3, slow: 0.16 } }, line: 'Grows roots on the path that slow 16% and sting 3/s.' },
  // ---- Level 3 ---------------------------------------------------------------
  berserk: { tag: 'steel', adj: 'Berserk', mods: { damageMult: 1.16, rateMult: 1.1 }, line: 'Hits 16% harder and attacks 10% faster.' },
  weaponmaster: { tag: 'crit', adj: 'Masterful', mods: { damageMult: 1.08, critChanceAdd: 0.08, critMultAdd: 0.24 }, line: 'Hits 8% harder; crit chance +8%, crit damage +24%.' },
  volley: { tag: 'reach', adj: 'Volleying', mods: { volley: { every: 4, pierce: 99 } }, line: 'Every 4th attack pierces its whole path.' },
  bulwark: { tag: 'guard', adj: 'Bulwarked', mods: { holdAdd: 1, chill: { slow: 0.18, dur: 2 } }, line: 'Holds 1 more enemy; hits slow 18% for 2s.' },
  reaper: { tag: 'blood', adj: 'Reaping', mods: { execute: 0.11, damageMult: 1.08 }, line: 'Kills under 11% health outright; hits 8% harder.' },
  rally: { tag: 'banner', adj: 'Rallying', mods: { buffAura: { damageMult: 1.2, radius: 120 } }, line: 'Heroes near it hit 20% harder.' },
  momentum: { tag: 'speed', adj: 'Rolling', mods: { rushPerHeld: 0.06 }, line: 'Attacks 6% faster per enemy it holds.' },
  last_rites: { tag: 'mend', adj: 'Hallowed', mods: { killMend: { every: 12, hp: 1 } }, line: 'Every 12th kill wins back 5% cargo.' },
  warden_of_ash: { tag: 'fire', adj: 'Ashen', mods: { thornsMult: 1.6, burn: { dps: 10, dur: 3 } }, line: 'Thorns +60%; hits burn 10/s for 3s.' },
  hexblade: { tag: 'frost', adj: 'Hexed', mods: { stunChance: 0.08, stunDur: 0.7, chill: { slow: 0.18, dur: 1.6 } }, line: 'Hits have an 8% chance to stun for 0.7s, and slow 18%.' },
  stormcaller: { tag: 'storm', adj: 'Thundering', mods: { shock: { chains: 1, dmgFrac: 0.2 }, damageMult: 1.14 }, line: 'Hits jump to 1 more enemy for 20%; hits 14% harder.' },
  tinkers_spark: { tag: 'storm', adj: 'Tinkered', mods: { chainEvery: { every: 5, chains: 2, dmgFrac: 0.5 }, damageMult: 1.1 }, line: 'Every 5th attack jumps to 2 more enemies for 50%; hits 10% harder.' },
}

// ---------------------------------------------------------------------------
// The base's delivery, and the re-expression rules
// ---------------------------------------------------------------------------

/**
 * How a base puts its effect on enemies, read off its own mods in a fixed
 * order (the first that applies): a JUMP (Arc Spark), an AURA (Blessing), the
 * GROUND (Snare), a HOLD (Hold Fast, Pin Down, thorns), a PIERCE (Long Shot),
 * a SPLASH (Cleave, Wildfire), a STATUS (Poisoned Tips, Frostbite), or a
 * plain STRIKE (Hard Hitter, Keen Eye).
 */
export type Delivery = 'chain' | 'aura' | 'ground' | 'hold' | 'pierce' | 'splash' | 'status' | 'strike'

export function deliveryOf(m: EffectMods): Delivery {
  if (m.shock || m.chainEvery) return 'chain'
  if (m.buffAura || m.rateAura || m.critAura) return 'aura'
  if (m.trap) return 'ground'
  if (m.holdAdd || m.vsHeld || m.thornsMult || m.thornsBurn || m.rushPerHeld) return 'hold'
  if (m.pierce || m.volley) return 'pierce'
  if (m.splashAdd) return 'splash'
  if (m.burn || m.chill || m.spitEvery) return 'status'
  return 'strike'
}

/** What one rule adds: its mods (the fusion twists) and its line. */
export interface Reexpression {
  mods: EffectMods
  line: string
}

/** The status a fire / poison / frost tag puts on a body, as a line says it. */
const STATUS_WORD: Partial<Record<InfusionTag, { verb: string; noun: string }>> = {
  fire: { verb: 'burn', noun: 'burn' },
  poison: { verb: 'poison', noun: 'poison' },
  frost: { verb: 'slow', noun: 'slow' },
}

/**
 * The re-expression: the infusion's tag met through the base's delivery, or
 * null where no rule applies (the share alone is the merge). `baseTag` is the
 * base's own tag (a merged base's root skill's), which says WHICH status a
 * status base puts down. Nineteen rules, the first that applies:
 *
 *  1. a status into a jump — the jumps carry it (`arcCarry`): "Frozen Arc Spark";
 *  2. a jump into a status — the status jumps (the share's arc, `arcCarry`): "Sparking Frostbite";
 *  3. a splash into a burn or poison — its dead burst (`deathBurst`);
 *  4. a splash into a slow — hits on slowed enemies splinter (`frostSplash`);
 *  5. a status into a splash or a pierce — it rides them (the engine's own
 *     rule: every body a splash or a pierce strikes takes the hit's statuses);
 *  6. a crit into a jump — crits bounce on (`ricochet`);
 *  7. a crit into a slow — crits on slowed enemies freeze (`critFreeze`);
 *  8. a crit into an aura — the aura lends crit (`critAura`);
 *  9. steel into a hold — a held body bursts when it dies (`heldBurst`);
 * 10. steel into a plain strike — hits on one enemy build up (`focusStack`);
 * 11. blood into a splash — a killing hit's excess rolls on (`overkill`);
 * 12. reach into a pierce — every 6th attack fans out (`fanEvery`);
 * 13. speed into a blood base — kills build speed (`frenzy`).
 * 14. a crit into a plain hit, a hold, a pierce or a splash — crits bounce (`ricochet`);
 * 15. poison into a plain hit or a hold — its dead pass it on (`contagion`);
 * 16. fire into a plain hit or a hold — its dead burst (`deathBurst`);
 * 17. frost into a plain hit or a hold — hits on slowed enemies splinter (`frostSplash`);
 * 18. speed into a plain hit, a hold or a status — kills build speed (`frenzy`);
 * 19. steel into a status — its first hit on each enemy lands harder (`firstHit`).
 * Everything else (gold, mend, roots, a banner but crit, storm into a plain
 * hit…) is the share alone.
 */
export function reexpress(tag: InfusionTag, delivery: Delivery, baseTag: InfusionTag): Reexpression | null {
  const st = STATUS_WORD[tag]
  if (st && delivery === 'chain') return { mods: { arcCarry: true }, line: `Its jumps ${st.verb} what they hit.` }
  if (tag === 'storm' && delivery === 'status') {
    const b = STATUS_WORD[baseTag]
    return { mods: { arcCarry: true }, line: `Its jumps carry its ${b?.noun ?? 'poison'}.` }
  }
  if (tag === 'splash' && delivery === 'status') {
    if (baseTag === 'frost') return { mods: { frostSplash: { frac: 0.15, radius: 40 } }, line: 'Hits on slowed enemies splinter 15% to enemies within 40.' }
    return { mods: { deathBurst: { frac: 0.25, radius: 40 } }, line: `Enemies dying of its ${STATUS_WORD[baseTag]?.noun ?? 'poison'} burst for 25% within 40.` }
  }
  if (st && (delivery === 'splash' || delivery === 'pierce')) {
    return { mods: {}, line: delivery === 'splash' ? `Its splash ${st.verb}s all it strikes.` : `Its piercing shots ${st.verb} all they pass.` }
  }
  if (tag === 'crit' && delivery === 'chain') return { mods: { ricochet: 0.3 }, line: 'Crits bounce to 1 more enemy for 30%.' }
  if (tag === 'crit' && baseTag === 'frost') return { mods: { critFreeze: { dur: 1, bonus: 0.2, chance: 0.05 } }, line: '+5% crit on slowed enemies; those crits deal 20% more and freeze 1s.' }
  if (tag === 'crit' && delivery === 'aura') return { mods: { critAura: { add: 0.05, radius: 120 } }, line: 'Heroes near it crit 5% more often.' }
  if (tag === 'steel' && delivery === 'hold') return { mods: { heldBurst: { frac: 0.2, radius: 45 } }, line: 'A held enemy that dies bursts for 20% of its hit within 45.' }
  if (tag === 'steel' && delivery === 'strike') return { mods: { focusStack: { step: 0.05, cap: 0.15 } }, line: 'Each hit on an enemy makes its next on it 5% harder, to +15%.' }
  if (tag === 'blood' && delivery === 'splash') return { mods: { overkill: 0.5 }, line: 'A killing hit’s excess rolls on at 50%, up to 3 more.' }
  if (tag === 'reach' && delivery === 'pierce') return { mods: { fanEvery: { every: 6, count: 1, frac: 0.3 } }, line: 'Every 6th attack also shoots 1 more enemy for 30%.' }
  if (tag === 'speed' && baseTag === 'blood') return { mods: { frenzy: { rate: 0.02, cap: 0.2 } }, line: 'Each kill this wave adds 2% attack speed, to +20%.' }
  // The plain hit and the hold: the element lands on the one body it strikes.
  const near = delivery === 'strike' || delivery === 'hold'
  if (tag === 'crit' && (near || delivery === 'pierce' || delivery === 'splash')) return { mods: { ricochet: 0.2 }, line: 'Crits bounce to 1 more enemy for 20%.' }
  if (tag === 'poison' && near) return { mods: { contagion: { count: 2, radius: 60 } }, line: 'Enemies dying of its poison pass it to 2 near them.' }
  if (tag === 'fire' && near) return { mods: { deathBurst: { frac: 0.15, radius: 35 } }, line: 'Enemies dying of its burn burst for 15% within 35.' }
  if (tag === 'frost' && near) return { mods: { frostSplash: { frac: 0.1, radius: 35 } }, line: 'Hits on slowed enemies splinter 10% to enemies within 35.' }
  if (tag === 'speed' && (near || delivery === 'status')) return { mods: { frenzy: { rate: 0.01, cap: 0.1 } }, line: 'Each kill this wave adds 1% attack speed, to +10%.' }
  if (tag === 'steel' && delivery === 'status') return { mods: { firstHit: 0.15 }, line: 'Its first hit on each enemy deals 15% more.' }
  return null
}
