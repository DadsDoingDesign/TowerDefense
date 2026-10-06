import type { CompanyId } from './companies'
import type { CoreStats, EffectMods } from '../types'

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
 * **Shape of the library.** 40 skills: 14 at Level 1, 15 at Level 2, 11 at
 * Level 3. A hero is dealt one Level 1 skill when it is picked or hired, and is
 * offered three of a tier at levels 5, 10 and 15 (`run/skills.ts`). Level 2
 * and Level 3 skills only ever arrive as those level-up offers.
 *
 * **Who can take one: anyone.** There are no classes (the classless rework,
 * `data/gear.ts`). Every skill states only ITS OWN effect, and is dealt at
 * random whatever the hero holds — a hold skill on a hero with no shield is
 * its whole hold; "Momentum" on a hero that holds nothing does nothing until
 * a shield arrives. The designer: "both skills and items — they just apply
 * their effects and things will happen basically", and "thats the fun of it
 * dont say how it will mix". So no sentence here names another piece.
 *
 * **Holds add.** A shield in the off hand holds 1-3 (`items.ITEM_BASES`); a
 * hold skill holds that many MORE (`holdAdd`). Every old "holds N instead of
 * 2" skill is the same total on a hero with a Shield as it was on a Fighter.
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
  /** One plain sentence, with the numbers the engine applies. */
  desc: string
  mods: EffectMods
  /** Where it came from: the perk, evolution or mutation it replaces. */
  from: string
  /** Unlocked for everyone from the first run. */
  starter?: boolean
  /** Achievement id that unlocks this card (it is never a random unlock). */
  feat?: string
  /**
   * The trade company whose pool this card belongs to (`data/companies.ts`).
   * On that company's routes the card is dealt more often
   * (`run/contracts.weightPool`), and a standing level with it unlocks its
   * cards first (`run/standing.rollStandingCard`). Every card names one.
   */
  company: CompanyId
}

const L1: Skill[] = [
  // ---- starters ------------------------------------------------------------
  { id: 'quick_hands', name: 'Quick Hands', level: 1, company: 'spice', starter: true, desc: 'Attacks 15% faster.', mods: { rateMult: 1.15 }, from: 'The old Tempo path (+12% a level) and the Cleric perk Zeal' },
  { id: 'hard_hitter', name: 'Hard Hitter', level: 1, company: 'metals', starter: true, desc: 'Hits 15% harder.', mods: { damageMult: 1.15 }, from: 'The old Onslaught path (+15% a level); perks Heavy Bash and Blood Pact' },
  // + crits deal 50% more (the tuning pass): on a sword-and-shield hero (5% base
  // crit) it read +0.0pt on every bench — the only starter that was nothing on
  // a starting kit. Sword & Shield +0.0 → +2.8pt mean (armour +8.3), Dagger
  // +7.3 → +12.5, Wand +0.9 → +1.2.
  { id: 'keen_eye', name: 'Keen Eye', level: 1, company: 'art', starter: true, desc: 'Crits 10% more often, and crits deal 50% more.', mods: { critChanceAdd: 0.1, critMultAdd: 0.5 }, from: 'The old Precision path (+14% a level); the Executioner mutation' },
  // ---- unlocked by playing ---------------------------------------------------
  { id: 'hold_fast', name: 'Hold Fast', level: 1, company: 'metals', desc: 'Holds 1 more enemy.', mods: { holdAdd: 1 }, from: 'Fighter perk Hold Fast (level 5)' },
  { id: 'charge', name: 'Charge', level: 1, company: 'spice', desc: 'Attacks 60% faster for the first 15 seconds of each wave.', mods: { openingRush: { rate: 0.6, dur: 15 } }, from: 'Fighter perk Charge; Rogue perk Ambush; the Opening Salvo mutation' },
  { id: 'bloodrush', name: 'Bloodrush', level: 1, company: 'spice', desc: 'Each kill makes it attack 25% faster for 1.5 seconds.', mods: { killRush: { rate: 0.25, dur: 1.5 } }, from: 'Rogue perk Bloodrush; the Blood Frenzy mutation' },
  { id: 'poison_tips', name: 'Poisoned Tips', level: 1, company: 'spice', desc: 'Every hit poisons for 10 damage a second, for 3 seconds.', mods: { burn: { dps: 10, dur: 3 } }, from: 'Rogue perk Poisoned Tips; Mystic perk Ember Veil' },
  { id: 'arc_spark', name: 'Arc Spark', level: 1, company: 'scrolls', desc: 'Every hit jumps to 1 more enemy for 45% of its damage.', mods: { shock: { chains: 1, dmgFrac: 0.45 } }, from: 'Mystic perk Arc Spark (level 5)' },
  { id: 'frostbite', name: 'Frostbite', level: 1, company: 'scrolls', desc: 'Every hit slows its target by 25% for 1.5 seconds.', mods: { chill: { slow: 0.25, dur: 1.5 } }, from: 'Mystic perk Frostbite; the Hoarfrost mutation' },
  { id: 'long_reach', name: 'Long Reach', level: 1, company: 'art', desc: 'Reaches 20% farther.', mods: { rangeMult: 1.2 }, from: 'The Marksman evolution’s reach (×1.5 there)' },
  { id: 'cleave', name: 'Cleave', level: 1, company: 'metals', desc: 'Every hit also strikes enemies within 20 of its target.', mods: { splashAdd: 20 }, from: 'Warrior perk Cleave (+14 splash); the Blasting Powder mutation' },
  // ---- the classless rework: self-contained effects that meet in play -------
  { id: 'bounty', name: 'Bounty', level: 1, company: 'silk', desc: 'Each kill it makes pays 1 more gold.', mods: { goldPerKill: 1 }, from: 'New with the classless rework' },
  { id: 'pin_down', name: 'Pin Down', level: 1, company: 'art', desc: 'Its hits deal 30% more to enemies that are being held.', mods: { vsHeld: 0.3 }, from: 'New with the classless rework' },
  { id: 'riposte', name: 'Riposte', level: 1, company: 'metals', feat: 'lone_wolf', desc: 'Enemies it holds take 80% more thorn damage.', mods: { thornsMult: 1.8 }, from: 'Fighter perk Riposte (was behind the same feat)' },
]

const L2: Skill[] = [
  // ---- starters ------------------------------------------------------------
  { id: 'heavy_blows', name: 'Heavy Blows', level: 2, company: 'metals', starter: true, desc: 'Hits 25% harder and attacks 10% faster.', mods: { damageMult: 1.25, rateMult: 1.1 }, from: 'The Warrior evolution (level 10)' },
  { id: 'long_shot', name: 'Long Shot', level: 2, company: 'art', starter: true, desc: 'Reaches 50% farther, and every shot pierces 1 extra enemy.', mods: { rangeMult: 1.5, pierce: 1, projSpeedMult: 1.4 }, from: 'The Marksman evolution (level 10)' },
  // + hits 10% harder (the tuning pass): a Level 2 starter that read +0.5pt on
  // a sword-and-shield hero and +1.3pt on a wand. Sword & Shield +0.5 → +2.5pt
  // mean, Dagger +4.3 → +9.6, Wand +1.3 → +20.6.
  { id: 'finisher', name: 'Finisher', level: 2, company: 'silk', starter: true, desc: 'Instantly kills enemies under 15% health, crits 10% more often, and hits 10% harder.', mods: { execute: 0.15, critChanceAdd: 0.1, damageMult: 1.1 }, from: 'The Assassin evolution (level 10)' },
  // ---- unlocked by playing ---------------------------------------------------
  { id: 'shield_wall', name: 'Shield Wall', level: 2, company: 'metals', desc: 'Holds 2 more enemies, in a wider circle.', mods: { holdAdd: 2, holdRadius: 90 }, from: 'Knight perk Shield Wall; the Juggernaut specialization' },
  // Thorns ×1.5 → ×3 (the tuning pass): on a sword-and-shield hero Wildfire led
  // this level by +20.3pt (§7, ceiling 20) and nothing a holder holds paid like
  // it; Anchor is the holder's own answer. Sword & Shield Anchor +15.4 → +29.4pt,
  // the level’s lead 20.3 → 17.4pt (Dagger +5.0 → +7.4, Wand unchanged).
  { id: 'anchor', name: 'Anchor', level: 2, company: 'silk', desc: 'Holds 1 more enemy, slows what it hits by 30% for 1.4 seconds, and its thorns hit 3 times as hard.', mods: { holdAdd: 1, holdRadius: 85, chill: { slow: 0.3, dur: 1.4 }, thornsMult: 3 }, from: 'The Guard evolution (level 10)' },
  // The Knight also held 3; that half of it lives in Hold Fast now, and the
  // hold is a Fighter's (see the header), so this one hits 10% harder instead.
  { id: 'stunning_bash', name: 'Stunning Bash', level: 2, company: 'metals', desc: 'Every hit has an 18% chance to stun for 0.7 seconds, and hits 10% harder.', mods: { stunChance: 0.18, stunDur: 0.7, damageMult: 1.1 }, from: 'The Knight evolution (level 10); the Vanguard and Order specializations' },
  { id: 'snare', name: 'Snare', level: 2, company: 'silk', desc: 'Buries a snare by the path that burns 14 a second and slows 30%, and its own hits slow 20%.', mods: { trap: { dps: 14, slow: 0.3 }, chill: { slow: 0.2, dur: 1 } }, from: 'The Trickster evolution (level 10); the Saboteur' },
  { id: 'wildfire', name: 'Wildfire', level: 2, company: 'spice', desc: 'Every hit burns for 12 a second for 3 seconds, and splashes 15 wider.', mods: { burn: { dps: 12, dur: 3 }, splashAdd: 15 }, from: 'The Elementalist evolution (level 10); Pyromancer' },
  // 15% → 25% (the tuning pass). §2 grades an aura skill against the same hero
  // holding its level's damage skill: at 15% a sword-and-shield hero's Blessing
  // held ×21.65 against Heavy Blows' ×19.72 (+9.8%, gate +10%), and at 20% the
  // wand's read +9.7%. At 25%: Wand +20%, Sword & Shield +21%; §7's Level 2 is
  // not solved by it (+13.6 / +15.1 / +14.1pt mean by kit).
  { id: 'blessing', name: 'Blessing', level: 2, company: 'scrolls', desc: 'Heroes near it hit 25% harder.', mods: { buffAura: { damageMult: 1.25, radius: 130 } }, from: 'The Cleric evolution (level 10); Cleric perk Blessing' },
  { id: 'gate_siphon', name: 'Siphon', level: 2, company: 'scrolls', desc: 'Hits 50% harder, and every 100 damage it deals wins back 2% of the cargo.', mods: { lifedrain: 0.2, damageMult: 1.5 }, from: 'The Warlock evolution (level 10); the Siphon mutation' },
  { id: 'killing_spree', name: 'Killing Spree', level: 2, company: 'spice', desc: 'Each kill makes it attack 45% faster for 2 seconds.', mods: { killRush: { rate: 0.45, dur: 2 } }, from: 'Assassin perk Killing Spree; Warrior perk Frenzy' },
  { id: 'cold_snap', name: 'Cold Snap', level: 2, company: 'silk', desc: 'Its hits deal 25% more to slowed enemies.', mods: { vsSlowed: 0.25 }, from: 'New with the classless rework' },
  { id: 'firebrand', name: 'Firebrand', level: 2, company: 'spice', desc: 'Its thorns set what it holds burning for 12 a second, for 3 seconds.', mods: { thornsBurn: { dps: 12, dur: 3 } }, from: 'New with the classless rework' },
  { id: 'split_shot', name: 'Split Shot', level: 2, company: 'art', desc: 'Its attacks pass through 1 more enemy.', mods: { pierce: 1 }, from: 'New with the classless rework' },
  { id: 'deadeye', name: 'Deadeye', level: 2, company: 'art', desc: 'Every 4th attack is a sure crit, and crits deal 25% more.', mods: { critEvery: 4, critMultAdd: 0.25 }, from: 'Marksman perk Deadeye (level 15)' },
]

const L3: Skill[] = [
  // ---- starters ------------------------------------------------------------
  { id: 'berserk', name: 'Berserk', level: 3, company: 'spice', starter: true, desc: 'Hits 40% harder and attacks 25% faster.', mods: { damageMult: 1.4, rateMult: 1.25 }, from: 'The Berserker specialization (level 20)' },
  { id: 'weaponmaster', name: 'Weaponmaster', level: 3, company: 'scrolls', starter: true, desc: 'Hits 20% harder, crits 20% more often, and crits deal 60% more.', mods: { damageMult: 1.2, critChanceAdd: 0.2, critMultAdd: 0.6 }, from: 'The Weaponmaster specialization (level 20)' },
  { id: 'volley', name: 'Volley', level: 3, company: 'art', starter: true, desc: 'Every 2nd attack pierces every enemy in its path, and it reaches 15% farther.', mods: { volley: { every: 2, pierce: 99 }, rangeMult: 1.15 }, from: 'Marksman perk Volley; the Ricochet mutation; the Ranger' },
  // ---- unlocked by playing ---------------------------------------------------
  { id: 'bulwark', name: 'Bulwark', level: 3, company: 'metals', desc: 'Holds 3 more enemies and slows what it hits by 45% for 2 seconds.', mods: { holdAdd: 3, holdRadius: 95, chill: { slow: 0.45, dur: 2 } }, from: 'The Bulwark and Aegis specializations; Guard perk Frozen Ground' },
  { id: 'reaper', name: 'Reaper', level: 3, company: 'scrolls', desc: 'Instantly kills enemies under 28% health, and hits 20% harder.', mods: { execute: 0.28, damageMult: 1.2 }, from: 'The Reaper specialization; Deathdealer and Nightblade' },
  { id: 'rally', name: 'Rally', level: 3, company: 'art', desc: 'Heroes near it hit 35% harder.', mods: { buffAura: { damageMult: 1.35, radius: 150 } }, from: 'The Templar specialization; Radiant and Oracle' },
  { id: 'momentum', name: 'Momentum', level: 3, company: 'spice', desc: 'Attacks 15% faster for each enemy it is holding.', mods: { rushPerHeld: 0.15 }, from: 'New with the classless rework' },
  { id: 'last_rites', name: 'Last Rites', level: 3, company: 'silk', desc: 'Every 5th kill it makes wins back 5% of the cargo.', mods: { killMend: { every: 5, hp: 1 } }, from: 'New with the classless rework' },
  // ---- opened by a feat (the specializations that used to be) ----------------
  { id: 'warden_of_ash', name: 'Warden of Ash', level: 3, company: 'metals', feat: 'win_fighter', desc: 'Holds 2 more enemies, its thorns hit 3 times as hard, and its hits and thorns set enemies burning for 26 a second.', mods: { holdAdd: 2, holdRadius: 90, thornsMult: 3, burn: { dps: 26, dur: 3 }, thornsIgnite: true }, from: 'The Warden of Ash specialization (was behind the same feat)' },
  { id: 'hexblade', name: 'Hexblade', level: 3, company: 'silk', feat: 'win_rogue', desc: 'Every hit has a 20% chance to stun for 0.7 seconds, and slows its target by 45% for 1.6 seconds.', mods: { stunChance: 0.2, stunDur: 0.7, chill: { slow: 0.45, dur: 1.6 } }, from: 'The Hexblade specialization (was behind the same feat)' },
  { id: 'stormcaller', name: 'Stormcaller', level: 3, company: 'scrolls', feat: 'win_mystic', desc: 'Every hit jumps to 3 more enemies for 60% of its damage, and hits 35% harder.', mods: { shock: { chains: 3, dmgFrac: 0.6 }, damageMult: 1.35 }, from: 'The Stormcaller specialization; Elementalist perk Static Field (behind the feat that opened Doomcaller)' },
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

/** The skills the classless rework added (tests pin their sentences). */
export const COMBO_SKILLS: readonly string[] = ['bounty', 'pin_down', 'cold_snap', 'firebrand', 'split_shot', 'momentum', 'last_rites']

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
  // The Bannerman's aura had no skill of its own when skills were dealt by
  // class: its damage line is the nearest thing it keeps.
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
