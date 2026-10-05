import type { Archetype, CoreStats, EffectMods } from '../types'

/**
 * ---------------------------------------------------------------------------
 * Skills (SK1) — the one way a hero grows
 * ---------------------------------------------------------------------------
 *
 * The designer: "there are a set of 3 basic skills you get to start … there
 * should be Level 2, 3 skills too that you only get as options when leveling
 * your hero during a run … you can only equip 3 skills per hero and then it
 * just bumps their stats and you pick which." And, on how heroes grow: "skills
 * and weapon type affect your hero".
 *
 * So skills REPLACE the two systems that used to grow a hero — the level-5/15
 * spec perks (`perks.ts`, gone) and the level-10/20 evolutions (the
 * sub-archetype and specialization nodes of `archetypeTree.ts`, no longer
 * offered). Every skill below is built from one of them, or from a mutation
 * rule, and `from` says which: the numbers are the source's, so a skill is
 * exactly as strong as the thing it replaces unless its comment says why not.
 *
 * **Shape of the library.** 33 skills: 12 at Level 1, 12 at Level 2, 9 at
 * Level 3. A hero is dealt one Level 1 skill when it is picked or hired, and is
 * offered three of a tier at levels 5, 10 and 15 (`run/skills.ts`). Level 2
 * and Level 3 skills only ever arrive as those level-up offers.
 *
 * **Who can take one.** Most skills fit any class. A skill that only makes
 * sense for one class names it (`class`) and is only offered to it: holding
 * enemies and thorns are the Fighter's (a Rogue or Mystic that held enemies
 * would also become a melee hero — see the clearance rule in
 * `data/terrain.ts`; no skill grants a hold outside the Fighter line, so no
 * skill changes who swings), and a few lines keep a class's flavour (the
 * Rogue's executions and curses, the Mystic's blessings and storms).
 *
 * **Who has which.** Nine are STARTERS (three per level): every player has them
 * from the first run, so every offer at every milestone has something in it.
 * Twenty are unlocked one at a time by playing (Watch levels and wins,
 * `run/watch.ts`), and four open with a feat (`feat`) the way the
 * feat-locked specializations and perk options did.
 *
 * Every `desc` is one plain sentence with the engine's own numbers.
 */
export type SkillLevel = 1 | 2 | 3

export interface Skill {
  id: string
  name: string
  level: SkillLevel
  /** Offered only to heroes of this class; absent = any class. */
  class?: Archetype
  /** One plain sentence, with the numbers the engine applies. */
  desc: string
  mods: EffectMods
  /** Where it came from: the perk, evolution or mutation it replaces. */
  from: string
  /** Unlocked for everyone from the first run. */
  starter?: boolean
  /** Achievement id that unlocks this card (it is never a random unlock). */
  feat?: string
}

const L1: Skill[] = [
  // ---- starters ------------------------------------------------------------
  { id: 'quick_hands', name: 'Quick Hands', level: 1, starter: true, desc: 'Attacks 15% faster.', mods: { rateMult: 1.15 }, from: 'The old Tempo path (+12% a level) and the Cleric perk Zeal' },
  { id: 'hard_hitter', name: 'Hard Hitter', level: 1, starter: true, desc: 'Hits 15% harder.', mods: { damageMult: 1.15 }, from: 'The old Onslaught path (+15% a level); perks Heavy Bash and Blood Pact' },
  { id: 'keen_eye', name: 'Keen Eye', level: 1, starter: true, desc: 'Crits 10% more often.', mods: { critChanceAdd: 0.1 }, from: 'The old Precision path (+14% a level); the Executioner mutation' },
  // ---- unlocked by playing ---------------------------------------------------
  { id: 'hold_fast', name: 'Hold Fast', level: 1, class: 'fighter', desc: 'Holds 3 enemies instead of 2.', mods: { block: { count: 3, radius: 72 } }, from: 'Fighter perk Hold Fast (level 5)' },
  { id: 'charge', name: 'Charge', level: 1, desc: 'Attacks 60% faster for the first 15 seconds of each wave.', mods: { openingRush: { rate: 0.6, dur: 15 } }, from: 'Fighter perk Charge; Rogue perk Ambush; the Opening Salvo mutation' },
  { id: 'bloodrush', name: 'Bloodrush', level: 1, desc: 'Each kill makes it attack 25% faster for 1.5 seconds.', mods: { killRush: { rate: 0.25, dur: 1.5 } }, from: 'Rogue perk Bloodrush; the Blood Frenzy mutation' },
  { id: 'poison_tips', name: 'Poisoned Tips', level: 1, desc: 'Every hit poisons for 10 damage a second, for 3 seconds.', mods: { burn: { dps: 10, dur: 3 } }, from: 'Rogue perk Poisoned Tips; Mystic perk Ember Veil' },
  { id: 'arc_spark', name: 'Arc Spark', level: 1, desc: 'Every hit jumps to 1 more enemy for 45% of its damage.', mods: { shock: { chains: 1, dmgFrac: 0.45 } }, from: 'Mystic perk Arc Spark (level 5)' },
  { id: 'frostbite', name: 'Frostbite', level: 1, desc: 'Every hit slows its target by 25% for 1.5 seconds.', mods: { chill: { slow: 0.25, dur: 1.5 } }, from: 'Mystic perk Frostbite; the Hoarfrost mutation' },
  { id: 'long_reach', name: 'Long Reach', level: 1, desc: 'Reaches 20% farther.', mods: { rangeMult: 1.2 }, from: 'The Marksman evolution’s reach (×1.5 there)' },
  { id: 'cleave', name: 'Cleave', level: 1, desc: 'Every hit also strikes enemies within 20 of its target.', mods: { splashAdd: 20 }, from: 'Warrior perk Cleave (+14 splash); the Blasting Powder mutation' },
  { id: 'riposte', name: 'Riposte', level: 1, class: 'fighter', feat: 'lone_wolf', desc: 'Enemies it holds take 80% more thorn damage.', mods: { thornsMult: 1.8 }, from: 'Fighter perk Riposte (was behind the same feat)' },
]

const L2: Skill[] = [
  // ---- starters ------------------------------------------------------------
  { id: 'heavy_blows', name: 'Heavy Blows', level: 2, starter: true, desc: 'Hits 25% harder and attacks 10% faster.', mods: { damageMult: 1.25, rateMult: 1.1 }, from: 'The Warrior evolution (level 10)' },
  { id: 'long_shot', name: 'Long Shot', level: 2, starter: true, desc: 'Reaches 50% farther, and every shot pierces 1 extra enemy.', mods: { rangeMult: 1.5, pierce: 1, projSpeedMult: 1.4 }, from: 'The Marksman evolution (level 10)' },
  { id: 'finisher', name: 'Finisher', level: 2, starter: true, desc: 'Instantly kills enemies under 15% health, and crits 10% more often.', mods: { execute: 0.15, critChanceAdd: 0.1 }, from: 'The Assassin evolution (level 10)' },
  // ---- unlocked by playing ---------------------------------------------------
  { id: 'shield_wall', name: 'Shield Wall', level: 2, class: 'fighter', desc: 'Holds 4 enemies instead of 2, in a wider circle.', mods: { block: { count: 4, radius: 90 } }, from: 'Knight perk Shield Wall; the Juggernaut specialization' },
  { id: 'anchor', name: 'Anchor', level: 2, class: 'fighter', desc: 'Holds 3 enemies, slows what it hits by 30% for 1.4 seconds, and its thorns hit 50% harder.', mods: { block: { count: 3, radius: 85 }, chill: { slow: 0.3, dur: 1.4 }, thornsMult: 1.5 }, from: 'The Guard evolution (level 10)' },
  // The Knight also held 3; that half of it lives in Hold Fast now, and the
  // hold is a Fighter's (see the header), so this one hits 10% harder instead.
  { id: 'stunning_bash', name: 'Stunning Bash', level: 2, desc: 'Every hit has an 18% chance to stun for 0.7 seconds, and hits 10% harder.', mods: { stunChance: 0.18, stunDur: 0.7, damageMult: 1.1 }, from: 'The Knight evolution (level 10); the Vanguard and Order specializations' },
  { id: 'snare', name: 'Snare', level: 2, desc: 'Buries a snare by the path that burns 14 a second and slows 30%, and its own hits slow 20%.', mods: { trap: { dps: 14, slow: 0.3 }, chill: { slow: 0.2, dur: 1 } }, from: 'The Trickster evolution (level 10); the Saboteur' },
  { id: 'wildfire', name: 'Wildfire', level: 2, desc: 'Every hit burns for 12 a second for 3 seconds, and splashes 15 wider.', mods: { burn: { dps: 12, dur: 3 }, splashAdd: 15 }, from: 'The Elementalist evolution (level 10); Pyromancer' },
  { id: 'blessing', name: 'Blessing', level: 2, class: 'mystic', desc: 'Heroes near it hit 15% harder.', mods: { buffAura: { damageMult: 1.15, radius: 130 } }, from: 'The Cleric evolution (level 10); Cleric perk Blessing' },
  { id: 'gate_siphon', name: 'Gate Siphon', level: 2, class: 'mystic', desc: 'Hits 50% harder, and every 100 damage it deals mends the Gate by 0.4.', mods: { lifedrain: 0.2, damageMult: 1.5 }, from: 'The Warlock evolution (level 10); the Siphon mutation' },
  { id: 'killing_spree', name: 'Killing Spree', level: 2, desc: 'Each kill makes it attack 45% faster for 2 seconds.', mods: { killRush: { rate: 0.45, dur: 2 } }, from: 'Assassin perk Killing Spree; Warrior perk Frenzy' },
  { id: 'deadeye', name: 'Deadeye', level: 2, class: 'rogue', desc: 'Every 4th attack is a sure crit, and crits deal 25% more.', mods: { critEvery: 4, critMultAdd: 0.25 }, from: 'Marksman perk Deadeye (level 15)' },
]

const L3: Skill[] = [
  // ---- starters ------------------------------------------------------------
  { id: 'berserk', name: 'Berserk', level: 3, starter: true, desc: 'Hits 40% harder and attacks 25% faster.', mods: { damageMult: 1.4, rateMult: 1.25 }, from: 'The Berserker specialization (level 20)' },
  { id: 'weaponmaster', name: 'Weaponmaster', level: 3, starter: true, desc: 'Hits 20% harder, crits 20% more often, and crits deal 60% more.', mods: { damageMult: 1.2, critChanceAdd: 0.2, critMultAdd: 0.6 }, from: 'The Weaponmaster specialization (level 20)' },
  { id: 'volley', name: 'Volley', level: 3, starter: true, desc: 'Every 2nd attack pierces every enemy in its path, and it reaches 15% farther.', mods: { volley: { every: 2, pierce: 99 }, rangeMult: 1.15 }, from: 'Marksman perk Volley; the Ricochet mutation; the Ranger' },
  // ---- unlocked by playing ---------------------------------------------------
  { id: 'bulwark', name: 'Bulwark', level: 3, class: 'fighter', desc: 'Holds 5 enemies and slows what it hits by 45% for 2 seconds.', mods: { block: { count: 5, radius: 95 }, chill: { slow: 0.45, dur: 2 } }, from: 'The Bulwark and Aegis specializations; Guard perk Frozen Ground' },
  { id: 'reaper', name: 'Reaper', level: 3, class: 'rogue', desc: 'Instantly kills enemies under 28% health, and hits 20% harder.', mods: { execute: 0.28, damageMult: 1.2 }, from: 'The Reaper specialization; Deathdealer and Nightblade' },
  { id: 'rally', name: 'Rally', level: 3, class: 'mystic', desc: 'Heroes near it hit 35% harder.', mods: { buffAura: { damageMult: 1.35, radius: 150 } }, from: 'The Templar specialization; Radiant and Oracle' },
  // ---- opened by a feat (the specializations that used to be) ----------------
  { id: 'warden_of_ash', name: 'Warden of Ash', level: 3, class: 'fighter', feat: 'win_fighter', desc: 'Holds 4 enemies, and its thorns hit 3 times as hard and set them burning for 26 a second.', mods: { block: { count: 4, radius: 90 }, thornsMult: 3, burn: { dps: 26, dur: 3 }, thornsIgnite: true }, from: 'The Warden of Ash specialization (was behind the same feat)' },
  { id: 'hexblade', name: 'Hexblade', level: 3, class: 'rogue', feat: 'win_rogue', desc: 'Every hit has a 20% chance to stun for 0.7 seconds, and slows its target by 45% for 1.6 seconds.', mods: { stunChance: 0.2, stunDur: 0.7, chill: { slow: 0.45, dur: 1.6 } }, from: 'The Hexblade specialization (was behind the same feat)' },
  { id: 'stormcaller', name: 'Stormcaller', level: 3, class: 'mystic', feat: 'win_mystic', desc: 'Every hit jumps to 3 more enemies for 60% of its damage, and hits 35% harder.', mods: { shock: { chains: 3, dmgFrac: 0.6 }, damageMult: 1.35 }, from: 'The Stormcaller specialization; Elementalist perk Static Field (behind the feat that opened Doomcaller)' },
]

export const ALL_SKILLS: readonly Skill[] = [...L1, ...L2, ...L3]
const BY_ID = new Map(ALL_SKILLS.map((s) => [s.id, s]))

export const skillById = (id: string): Skill | undefined => BY_ID.get(id)
export const isSkillId = (v: unknown): v is string => typeof v === 'string' && BY_ID.has(v)

/** The skills everyone has from the first run: three per level. */
export const STARTER_SKILLS: readonly string[] = ALL_SKILLS.filter((s) => s.starter).map((s) => s.id)
/** The cards a Watch level or a win can unlock, at random. */
export const RANDOM_UNLOCK_SKILLS: readonly string[] = ALL_SKILLS.filter((s) => !s.starter && !s.feat).map((s) => s.id)
/** The cards a feat opens, by skill id. */
export const FEAT_SKILLS: Readonly<Record<string, string>> = Object.fromEntries(ALL_SKILLS.filter((s) => s.feat).map((s) => [s.id, s.feat!]))

/** Whether a hero of this class may be offered (or keep) this skill. */
export const skillFits = (s: Pick<Skill, 'class'>, archetype: Archetype): boolean => !s.class || s.class === archetype

/** "Level 2" — never "T2" on screen. */
export const skillLevelLabel = (level: number): string => `Level ${level}`

/**
 * The mods a hero's skills contribute, in order — what `computeCombat` folds
 * in where the evolution nodes and spec perks used to go. An id this build
 * does not know (a save from a later build) contributes nothing.
 */
export function skillModsOf(s: { skills?: readonly string[] }): EffectMods[] {
  const out: EffectMods[] = []
  for (const id of s.skills ?? []) {
    const k = BY_ID.get(id)
    if (k) out.push(k.mods)
  }
  return out
}

// ---------------------------------------------------------------------------
// The stat bump
// ---------------------------------------------------------------------------

export type BumpStat = keyof CoreStats
export const BUMP_STATS: readonly BumpStat[] = ['str', 'dex', 'int']
/**
 * A full hero's alternative to a new skill: +N to one stat, by the milestone's
 * level. Sized to sit beside a skill of the same level: +4 STR on a level-5
 * Fighter is about +11% damage (each point is +4%), the size of a Level 1 skill.
 */
export const BUMP_AMOUNT: Readonly<Record<SkillLevel, number>> = { 1: 4, 2: 6, 3: 8 }
export const BUMP_LABEL: Readonly<Record<BumpStat, string>> = { str: 'STR', dex: 'DEX', int: 'INT' }
/** What each stat does, in one line (the bump choice says it). */
export const BUMP_WHAT: Readonly<Record<BumpStat, string>> = {
  str: 'physical damage',
  dex: 'attack speed and crit',
  int: 'magic damage',
}

// ---------------------------------------------------------------------------
// Old saves: perks and evolutions → skills
// ---------------------------------------------------------------------------

/**
 * What each retired spec perk became. Every one of the 27 maps to a skill; the
 * rationale is the `from` line of the skill it names.
 */
export const PERK_TO_SKILL: Readonly<Record<string, string>> = {
  f5_second_wind: 'hold_fast',
  f5_last_stand: 'charge',
  f5_riposte: 'riposte',
  r5_ambush: 'charge',
  r5_bloodrush: 'bloodrush',
  r5_poison: 'poison_tips',
  m5_arc: 'arc_spark',
  m5_frostbite: 'frostbite',
  m5_ember: 'poison_tips',
  warrior_cleave: 'cleave',
  warrior_frenzy: 'killing_spree',
  knight_concussion: 'hard_hitter',
  knight_second_wind: 'shield_wall',
  guard_frozen: 'bulwark',
  guard_unbroken: 'riposte',
  assassin_opening: 'charge',
  assassin_spree: 'killing_spree',
  trickster_charge: 'snare',
  trickster_venom: 'poison_tips',
  marksman_volley: 'volley',
  marksman_deadeye: 'deadeye',
  elem_conflagration: 'wildfire',
  elem_static: 'stormcaller',
  cleric_sanctuary: 'quick_hands',
  cleric_blessing: 'blessing',
  warlock_blood_pact: 'hard_hitter',
  warlock_siphon: 'gate_siphon',
}

/** What each retired evolution (sub-archetype or specialization) became. */
export const EVOLUTION_TO_SKILL: Readonly<Record<string, string>> = {
  // Level 10 — the sub-archetypes.
  warrior: 'heavy_blows',
  knight: 'stunning_bash',
  guard: 'anchor',
  assassin: 'finisher',
  trickster: 'snare',
  marksman: 'long_shot',
  elementalist: 'wildfire',
  cleric: 'blessing',
  warlock: 'gate_siphon',
  // Level 20 — the specializations.
  berserker: 'berserk',
  juggernaut: 'shield_wall',
  weaponmaster: 'weaponmaster',
  bulwark: 'bulwark',
  vanguard: 'stunning_bash',
  order_sentinel: 'stunning_bash',
  aegis: 'bulwark',
  warden_of_ash: 'warden_of_ash',
  // A Fighter's aura has no Fighter skill (blessings are the Mystic's): its
  // damage line is the nearest thing it keeps.
  bannerman: 'heavy_blows',
  deathdealer: 'reaper',
  nightblade: 'reaper',
  reaper: 'reaper',
  saboteur: 'snare',
  venomancer: 'poison_tips',
  hexblade: 'hexblade',
  sharpshooter: 'long_shot',
  ranger: 'volley',
  arbalest: 'long_shot',
  pyromancer: 'wildfire',
  cryomancer: 'frostbite',
  stormcaller: 'stormcaller',
  radiant: 'rally',
  templar: 'rally',
  oracle: 'rally',
  soulflay: 'gate_siphon',
  plaguebringer: 'wildfire',
  doomcaller: 'gate_siphon',
}
