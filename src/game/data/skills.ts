import type { CompanyId } from './companies'
import type { CoreStats, EffectMods } from '../types'
import type { IconKey } from './iconAtlas'

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
 * **Shape of the library.** 50 skills: 14 at Level 1, 24 at Level 2, 12 at
 * Level 3 (five of the Level 2 are the companies' signature skills, Draft 4 · B).
 * Each belongs to one people's company, as `docs/peoples/roster.json` files it. A hero is dealt one Level 1 skill when it is picked or hired, and is
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
 * Thirty-two are unlocked one at a time by playing (standing levels,
 * deliveries and sealed crates), four open with a feat (`feat`) the way the
 * feat-locked specializations and perk options did, and five — one per
 * company — are its signature (`signature`), paid only by its loyalty track.
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
   * The company's signature skill (Draft 4 · B): paid only by standing 5 on
   * that company's loyalty track (`run/track.ts`) — never a random, contract
   * or crate unlock, and not a starter or a feat. One per company.
   */
  signature?: true
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
  { id: 'quick_hands', name: 'Quick Hands', level: 1, company: 'silk', starter: true, desc: 'Attacks 15% faster.', mods: { rateMult: 1.15 }, from: 'The old Tempo path (+12% a level) and the Cleric perk Zeal' },
  { id: 'hard_hitter', name: 'Hard Hitter', level: 1, company: 'spice', starter: true, desc: 'Hits 15% harder.', mods: { damageMult: 1.15 }, from: 'The old Onslaught path (+15% a level); perks Heavy Bash and Blood Pact' },
  // + crits deal 50% more (the tuning pass): on a sword-and-shield hero (5% base
  // crit) it read +0.0pt on every bench — the only starter that was nothing on
  // a starting kit. Sword & Shield +0.0 → +2.8pt mean (armour +8.3), Dagger
  // +7.3 → +12.5, Wand +0.9 → +1.2.
  { id: 'keen_eye', name: 'Keen Eye', level: 1, company: 'silk', starter: true, desc: 'Crit chance +10%, crit damage +50%.', mods: { critChanceAdd: 0.1, critMultAdd: 0.5 }, from: 'The old Precision path (+14% a level); the Executioner mutation' },
  // ---- unlocked by playing ---------------------------------------------------
  { id: 'hold_fast', name: 'Hold Fast', level: 1, company: 'spice', desc: 'Holds 1 more enemy.', mods: { holdAdd: 1 }, from: 'Fighter perk Hold Fast (level 5)' },
  { id: 'charge', name: 'Charge', level: 1, company: 'spice', desc: 'Attacks 60% faster for the first 15s of each wave.', mods: { openingRush: { rate: 0.6, dur: 15 } }, from: 'Fighter perk Charge; Rogue perk Ambush; the Opening Salvo mutation' },
  { id: 'bloodrush', name: 'Bloodrush', level: 1, company: 'art', desc: 'Each kill makes it attack 25% faster for 1.5s.', mods: { killRush: { rate: 0.25, dur: 1.5 } }, from: 'Rogue perk Bloodrush; the Blood Frenzy mutation' },
  { id: 'poison_tips', name: 'Poisoned Tips', level: 1, company: 'art', desc: 'Every hit poisons 10/s for 3s.', mods: { burn: { dps: 10, dur: 3 } }, from: 'Rogue perk Poisoned Tips; Mystic perk Ember Veil' },
  { id: 'arc_spark', name: 'Arc Spark', level: 1, company: 'scrolls', desc: 'Every hit jumps to 1 more enemy for 45% of its damage.', mods: { shock: { chains: 1, dmgFrac: 0.45 } }, from: 'Mystic perk Arc Spark (level 5)' },
  { id: 'frostbite', name: 'Frostbite', level: 1, company: 'scrolls', desc: 'Every hit slows 25% for 1.5s.', mods: { chill: { slow: 0.25, dur: 1.5 } }, from: 'Mystic perk Frostbite; the Hoarfrost mutation' },
  { id: 'long_reach', name: 'Long Reach', level: 1, company: 'silk', desc: 'Reaches 20% farther.', mods: { rangeMult: 1.2 }, from: 'The Marksman evolution’s reach (×1.5 there)' },
  { id: 'cleave', name: 'Cleave', level: 1, company: 'metals', desc: 'Every hit also strikes enemies within 14 of its target.', mods: { splashAdd: 14 }, from: 'Warrior perk Cleave (+14 splash); the Blasting Powder mutation' },
  // ---- the classless rework: self-contained effects that meet in play -------
  { id: 'bounty', name: 'Bounty', level: 1, company: 'art', desc: 'Each kill pays 3 more gold.', mods: { goldPerKill: 3 }, from: 'New with the classless rework' },
  { id: 'pin_down', name: 'Pin Down', level: 1, company: 'silk', desc: 'Hits 30% harder on held enemies.', mods: { vsHeld: 0.3 }, from: 'New with the classless rework' },
  { id: 'riposte', name: 'Riposte', level: 1, company: 'metals', feat: 'lone_wolf', desc: 'Enemies it holds take 80% more thorn damage.', mods: { thornsMult: 1.8 }, from: 'Fighter perk Riposte (was behind the same feat)' },
]

const L2: Skill[] = [
  // ---- starters ------------------------------------------------------------
  { id: 'heavy_blows', name: 'Heavy Blows', level: 2, company: 'metals', starter: true, desc: 'Hits 25% harder and attacks 10% faster.', mods: { damageMult: 1.25, rateMult: 1.1 }, from: 'The Warrior evolution (level 10)' },
  { id: 'long_shot', name: 'Long Shot', level: 2, company: 'silk', starter: true, desc: 'Reaches 50% farther, and every shot pierces 1 extra enemy.', mods: { rangeMult: 1.5, pierce: 1, projSpeedMult: 1.4 }, from: 'The Marksman evolution (level 10)' },
  // + hits 10% harder (the tuning pass): a Level 2 starter that read +0.5pt on
  // a sword-and-shield hero and +1.3pt on a wand. Sword & Shield +0.5 → +2.5pt
  // mean, Dagger +4.3 → +9.6, Wand +1.3 → +20.6.
  { id: 'finisher', name: 'Finisher', level: 2, company: 'art', starter: true, desc: 'Kills enemies under 15% health outright; +10% crit chance, +10% damage.', mods: { execute: 0.15, critChanceAdd: 0.1, damageMult: 1.1 }, from: 'The Assassin evolution (level 10)' },
  // ---- unlocked by playing ---------------------------------------------------
  { id: 'shield_wall', name: 'Shield Wall', level: 2, company: 'spice', desc: 'Holds 2 more enemies, in a wider circle.', mods: { holdAdd: 2, holdRadius: 90 }, from: 'Knight perk Shield Wall; the Juggernaut specialization' },
  // Thorns ×1.5 → ×3 (the tuning pass): on a sword-and-shield hero Wildfire led
  // this level by +20.3pt (§7, ceiling 20) and nothing a holder holds paid like
  // it; Anchor is the holder's own answer. Sword & Shield Anchor +15.4 → +29.4pt,
  // the level’s lead 20.3 → 17.4pt (Dagger +5.0 → +7.4, Wand unchanged).
  { id: 'anchor', name: 'Anchor', level: 2, company: 'metals', desc: 'Holds 1 more enemy, slows what it hits 30% for 1.4s, and thorns ×3.', mods: { holdAdd: 1, holdRadius: 85, chill: { slow: 0.3, dur: 1.4 }, thornsMult: 3 }, from: 'The Guard evolution (level 10)' },
  // The Knight also held 3; that half of it lives in Hold Fast now, and the
  // hold is a Fighter's (see the header), so this one hits 10% harder instead.
  { id: 'stunning_bash', name: 'Stunning Bash', level: 2, company: 'metals', desc: 'Every hit has an 18% chance to stun for 0.7s, and hits 10% harder.', mods: { stunChance: 0.18, stunDur: 0.7, damageMult: 1.1 }, from: 'The Knight evolution (level 10); the Vanguard and Order specializations' },
  { id: 'snare', name: 'Snare', level: 2, company: 'silk', desc: 'Lays a snare on the path that burns 14/s and slows 30%; its hits slow 20%.', mods: { trap: { dps: 14, slow: 0.3 }, chill: { slow: 0.2, dur: 1 } }, from: 'The Trickster evolution (level 10); the Saboteur' },
  { id: 'wildfire', name: 'Wildfire', level: 2, company: 'spice', desc: 'Every hit burns 12/s for 3s and splashes 15 wider.', mods: { burn: { dps: 12, dur: 3 }, splashAdd: 15 }, from: 'The Elementalist evolution (level 10); Pyromancer' },
  // 15% → 25% (the tuning pass). §2 grades an aura skill against the same hero
  // holding its level's damage skill: at 15% a sword-and-shield hero's Blessing
  // held ×21.65 against Heavy Blows' ×19.72 (+9.8%, gate +10%), and at 20% the
  // wand's read +9.7%. At 25%: Wand +20%, Sword & Shield +21%; §7's Level 2 is
  // not solved by it (+13.6 / +15.1 / +14.1pt mean by kit).
  // 25% → 40% (the merged tuning pass): with item identities the §2 carriers
  // rolled weaker (the empty slot holds ×4.24, was ×6.45), the third hero's own
  // damage carries more of the hold, and at 25% Blessing read +10% (wand) and
  // −28% (sword and shield) against Heavy Blows. §2 is bimodal in the elite
  // column (a sword-and-shield hold either kills the column or is walked past:
  // ×7–8 or ×43–50), so it was scanned on a grid, Blessing / Rally, wand and
  // sword-and-shield against the fillers: 30/40% +21 / +5 / +32 / +32%;
  // 35/45% +15 / +5 / +39 / +26%; 40/50% +15 / +32 / +45 / +45% (kept: every
  // neighbour from 38/48 to 44/54 passes); 45/55% +15 / +21 / +39 / +45%.
  { id: 'blessing', name: 'Blessing', level: 2, company: 'scrolls', desc: 'Heroes near it hit 40% harder.', mods: { buffAura: { damageMult: 1.4, radius: 130 } }, from: 'The Cleric evolution (level 10); Cleric perk Blessing' },
  { id: 'gate_siphon', name: 'Siphon', level: 2, company: 'scrolls', desc: 'Hits 50% harder; every 100 damage wins back 2% cargo.', mods: { lifedrain: 0.2, damageMult: 1.5 }, from: 'The Warlock evolution (level 10); the Siphon mutation' },
  { id: 'killing_spree', name: 'Killing Spree', level: 2, company: 'art', desc: 'Each kill makes it attack 45% faster for 2s.', mods: { killRush: { rate: 0.45, dur: 2 } }, from: 'Assassin perk Killing Spree; Warrior perk Frenzy' },
  { id: 'cold_snap', name: 'Cold Snap', level: 2, company: 'scrolls', desc: 'Hits 25% harder on slowed enemies.', mods: { vsSlowed: 0.25 }, from: 'New with the classless rework' },
  { id: 'firebrand', name: 'Firebrand', level: 2, company: 'spice', desc: 'Its thorns burn what it holds 12/s for 3s.', mods: { thornsBurn: { dps: 12, dur: 3 } }, from: 'New with the classless rework' },
  { id: 'split_shot', name: 'Split Shot', level: 2, company: 'silk', desc: 'Its attacks pass through 1 more enemy.', mods: { pierce: 1 }, from: 'New with the classless rework' },
  { id: 'deadeye', name: 'Deadeye', level: 2, company: 'silk', desc: 'Every 4th attack crits; +25% crit damage.', mods: { critEvery: 4, critMultAdd: 0.25 }, from: 'Marksman perk Deadeye (level 15)' },
  // ---- the companies' signature skills (Draft 4 · B, the loyalty track) -----
  // One per company, paid ONLY by standing 5 on its track (`run/track.ts`):
  // never a random, contract or crate unlock, never a starter or a feat. Each
  // is two of the engine's existing effects in its company's taste, sized to
  // sit beside the Level 2 cards (two Level 1 effects, or a Level 2 one
  // trimmed): Peppercorn burns and speed, Easel reach and crit, Ironvein hold
  // and hit, Rosethread gold and slow, Moonquill chain and slow.
  { id: 'pepperfire', name: 'Spicy Peps', level: 2, company: 'spice', signature: true, desc: 'Every hit burns 10/s for 3s, and it attacks 15% faster.', mods: { burn: { dps: 10, dur: 3 }, rateMult: 1.15 }, from: 'New with the loyalty track: Peppercorn Co.’s signature (Poisoned Tips and Quick Hands, met)' },
  { id: 'gilt_frame', name: 'Starweave', level: 2, company: 'silk', signature: true, desc: 'Reaches 25% farther; +15% crit chance, +25% crit damage.', mods: { rangeMult: 1.25, critChanceAdd: 0.15, critMultAdd: 0.25 }, from: 'New with the loyalty track: Rosethread’s signature (was Easel House’s) (Long Reach and Keen Eye, met)' },
  { id: 'ore_sense', name: 'Ore Sense', level: 2, company: 'metals', desc: 'Holds 1 more enemy, and hits 20% harder.', mods: { holdAdd: 1, damageMult: 1.2 }, from: 'New with the loyalty track as Ironvein’s signature (Hold Fast and Hard Hitter, met); a plain card since the peoples’ rosters, which gave the signature to Bolder Bash' },
  { id: 'velvet_toll', name: 'Blood Price', level: 2, company: 'art', signature: true, desc: 'Each kill pays 4 more gold, and its hits slow 25% for 1.5s.', mods: { goldPerKill: 4, chill: { slow: 0.25, dur: 1.5 } }, from: 'New with the loyalty track: Rosethread’s signature (Bounty and Frostbite, met)' },
  { id: 'moonwake', name: 'Thornbloom', level: 2, company: 'scrolls', signature: true, desc: 'Every hit jumps to 1 more enemy for 50% and slows 25% for 1.5s.', mods: { shock: { chains: 1, dmgFrac: 0.5 }, chill: { slow: 0.25, dur: 1.5 } }, from: 'New with the loyalty track: Greenvial’s signature (was Moonquill’s) (Arc Spark and Frostbite, met)' },
  // ---- the peoples' rosters (Oct 2026, `docs/peoples/roster.json`) -------
  // Bolder Bash is the dwarves' (Ironvein's) signature; the others are
  // ordinary cards, unlocked by playing. Appended, so every list built off
  // this library keeps its older entries where they were.
  { id: 'bolder_bash', name: 'Bolder Bash', level: 2, company: 'metals', signature: true, desc: 'Hits 20% harder, and every hit splashes 20 wider.', mods: { damageMult: 1.2, splashAdd: 20 }, from: 'New with the peoples’ rosters: Ironvein’s signature (Cleave and Hard Hitter, met)' },
  { id: 'banner_bearer', name: 'Banner Bearer', level: 2, company: 'spice', desc: 'Heroes near it attack 20% faster.', mods: { rateAura: { rateMult: 1.2, radius: 130 } }, from: 'New with the peoples’ rosters (the humans): Blessing’s reach, for speed' },
  { id: 'venom_spit', name: 'Venom Spit', level: 2, company: 'art', desc: 'Every 3rd attack poisons the 3 nearest enemies 12/s for 3s.', mods: { spitEvery: { every: 3, count: 3, dps: 12, dur: 3 } }, from: 'New with the peoples’ rosters (the reptilians)' },
  { id: 'overgrowth', name: 'Overgrowth', level: 2, company: 'scrolls', desc: 'Grows roots on the path beside it that slow 40% and sting 8/s.', mods: { trap: { dps: 8, slow: 0.4 } }, from: 'New with the peoples’ rosters (the gnomes): the Snare’s hazard, rooted' },
]

const L3: Skill[] = [
  // ---- starters ------------------------------------------------------------
  { id: 'berserk', name: 'Berserk', level: 3, company: 'art', starter: true, desc: 'Hits 40% harder and attacks 25% faster.', mods: { damageMult: 1.4, rateMult: 1.25 }, from: 'The Berserker specialization (level 20)' },
  { id: 'weaponmaster', name: 'Weaponmaster', level: 3, company: 'spice', starter: true, desc: 'Hits 20% harder; +20% crit chance, +60% crit damage.', mods: { damageMult: 1.2, critChanceAdd: 0.2, critMultAdd: 0.6 }, from: 'The Weaponmaster specialization (level 20)' },
  { id: 'volley', name: 'Volley', level: 3, company: 'silk', starter: true, desc: 'Every 2nd attack pierces its whole path; reaches 15% farther.', mods: { volley: { every: 2, pierce: 99 }, rangeMult: 1.15 }, from: 'Marksman perk Volley; the Ricochet mutation; the Ranger' },
  // ---- unlocked by playing ---------------------------------------------------
  { id: 'bulwark', name: 'Bulwark', level: 3, company: 'metals', desc: 'Holds 3 more enemies and slows what it hits 45% for 2s.', mods: { holdAdd: 3, holdRadius: 95, chill: { slow: 0.45, dur: 2 } }, from: 'The Bulwark and Aegis specializations; Guard perk Frozen Ground' },
  { id: 'reaper', name: 'Reaper', level: 3, company: 'art', desc: 'Kills enemies under 28% health outright, and hits 20% harder.', mods: { execute: 0.28, damageMult: 1.2 }, from: 'The Reaper specialization; Deathdealer and Nightblade' },
  // 35% → 50% (the merged tuning pass; see Blessing): at 35% the wand's Rally
  // read +5% against the same hero holding Berserk (gate +10%); at 50% +32%,
  // the sword and shield's +45%.
  { id: 'rally', name: 'Rally', level: 3, company: 'spice', desc: 'Heroes near it hit 50% harder.', mods: { buffAura: { damageMult: 1.5, radius: 150 } }, from: 'The Templar specialization; Radiant and Oracle' },
  { id: 'momentum', name: 'Momentum', level: 3, company: 'metals', desc: 'Attacks 15% faster per enemy it holds.', mods: { rushPerHeld: 0.15 }, from: 'New with the classless rework' },
  { id: 'last_rites', name: 'Last Rites', level: 3, company: 'scrolls', desc: 'Every 5th kill wins back 5% cargo.', mods: { killMend: { every: 5, hp: 1 } }, from: 'New with the classless rework' },
  // ---- opened by a feat (the specializations that used to be) ----------------
  { id: 'warden_of_ash', name: 'Warden of Ash', level: 3, company: 'metals', feat: 'win_fighter', desc: 'Holds 2 more enemies, thorns ×3, and its hits and thorns burn 26/s.', mods: { holdAdd: 2, holdRadius: 90, thornsMult: 3, burn: { dps: 26, dur: 3 }, thornsIgnite: true }, from: 'The Warden of Ash specialization (was behind the same feat)' },
  { id: 'hexblade', name: 'Hexblade', level: 3, company: 'art', feat: 'win_rogue', desc: 'Every hit has a 20% chance to stun for 0.7s, and slows 45% for 1.6s.', mods: { stunChance: 0.2, stunDur: 0.7, chill: { slow: 0.45, dur: 1.6 } }, from: 'The Hexblade specialization (was behind the same feat)' },
  // 3 jumps at 60% → 2 at 45% (the merged tuning pass). Once §7's Level 3
  // bench could rank (fitted on a hero holding Berserk), Stormcaller solved
  // the Dagger point: +65.7pt against Warden of Ash's +40.3 (lead +25.5,
  // ceiling +20). Its damage was not the lever (×1.35 → ×1.15 moved the lead
  // 0.4pt): the chains are. 2 at 50% read +18.2 / +13.4 (Dagger / Sword &
  // Shield, where Warden of Ash leads), 2 at 40% +12.4 / +17.0, 2 at 45%
  // +15.7 / +16.0 — neither point solved, and it still tops the Dagger point.
  { id: 'stormcaller', name: 'Stormcaller', level: 3, company: 'scrolls', feat: 'win_mystic', desc: 'Every hit jumps to 2 more enemies for 45%, and hits 35% harder.', mods: { shock: { chains: 2, dmgFrac: 0.45 }, damageMult: 1.35 }, from: 'The Stormcaller specialization; Elementalist perk Static Field (behind the feat that opened Doomcaller)' },
  // ---- the peoples' rosters (Oct 2026) ------------------------------------
  { id: 'tinkers_spark', name: 'Tinker’s Spark', level: 3, company: 'scrolls', desc: 'Every 5th attack jumps to 3 more enemies in full; hits 25% harder.', mods: { chainEvery: { every: 5, chains: 3, dmgFrac: 1 }, damageMult: 1.25 }, from: 'New with the peoples’ rosters (the gnomes)' },
]

export const ALL_SKILLS: readonly Skill[] = [...L1, ...L2, ...L3]
const BY_ID = new Map(ALL_SKILLS.map((s) => [s.id, s]))

export const skillById = (id: string): Skill | undefined => BY_ID.get(id)
export const isSkillId = (v: unknown): v is string => typeof v === 'string' && BY_ID.has(v)

/** The skills everyone has from the first run: three per level. */
export const STARTER_SKILLS: readonly string[] = ALL_SKILLS.filter((s) => s.starter).map((s) => s.id)
/** The cards a standing level, a delivery or a sealed crate can unlock (never a signature skill). */
export const RANDOM_UNLOCK_SKILLS: readonly string[] = ALL_SKILLS.filter((s) => !s.starter && !s.feat && !s.signature).map((s) => s.id)
/** The cards the peoples' rosters added (Oct 2026). */
export const PEOPLES_SKILLS: readonly string[] = ['bolder_bash', 'banner_bearer', 'venom_spit', 'overgrowth', 'tinkers_spark']
/**
 * The cards the charter's door counts (`run/charter.charterDoor`): the random
 * cards as they stood before the peoples' rosters — Ore Sense, a signature
 * then, and the rosters' new cards are not in it — so an earned door stays open.
 */
export const CHARTER_SKILLS: readonly string[] = RANDOM_UNLOCK_SKILLS.filter((id) => id !== 'ore_sense' && !PEOPLES_SKILLS.includes(id))
/** Each company's signature skill (Draft 4 · B): standing 5 on its track pays it, and nothing else does. */
export const SIGNATURE_SKILLS: Readonly<Record<CompanyId, string>> = Object.fromEntries(
  ALL_SKILLS.filter((s) => s.signature).map((s) => [s.company, s.id]),
) as Record<CompanyId, string>
/** Whether a skill is a company's signature skill. */
export const isSignatureSkill = (id: string): boolean => !!BY_ID.get(id)?.signature
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

/**
 * A skill's lead effect as a picture and a word or two — the pick-one strip's
 * token (`ui/shell/PickStrip.tsx`), which carries no name: "Speed +15%",
 * "Burn", "Hold". Read off the mods in a fixed order, so a skill with several
 * leads with the one its sentence leads with: the named effects first (an
 * execute, a snare, a stun, chains, a hold, a volley, burn, gold), then the
 * plain multipliers, damage before speed. (It was multipliers first, and 18
 * skills' marks contradicted their own first words — Heavy Blows "Hits 25%
 * harder" drew the speed chevrons, Snare and Anchor the chill flake, Finisher
 * and Reaper the damage slashes; `tests/skills.test.ts` pins them.) It is the
 * skill's icon everywhere a skill is pictured (`channels.skillIcon`, the Codex
 * tile, the hero card's slots). A number rides only where the
 * mod IS the number (the three plain multipliers); everything else is the word,
 * and the card under the strip says the rest.
 */
export interface SkillHeadline {
  icon: IconKey
  label: string
  value?: string
}

const pct = (mult: number) => `+${Math.round((mult - 1) * 100)}%`

const HEADLINES: readonly [keyof EffectMods, (m: EffectMods) => SkillHeadline][] = [
  ['execute', () => ({ icon: 'execute', label: 'Execute' })],
  ['trap', () => ({ icon: 'trap', label: 'Trap' })],
  ['stunChance', () => ({ icon: 'stun', label: 'Stun' })],
  ['shock', () => ({ icon: 'shock', label: 'Shock' })],
  ['block', () => ({ icon: 'block', label: 'Hold' })],
  ['holdAdd', () => ({ icon: 'block', label: 'Hold' })],
  ['holdRadius', () => ({ icon: 'block', label: 'Hold' })],
  ['volley', () => ({ icon: 'projectile', label: 'Volley' })],
  ['burn', () => ({ icon: 'burn', label: 'Burn' })],
  ['goldPerKill', () => ({ icon: 'gold', label: 'Bounty' })],
  ['damageMult', (m) => ({ icon: 'damage', label: 'Dmg', value: pct(m.damageMult!) })],
  ['rateMult', (m) => ({ icon: 'haste', label: 'Speed', value: pct(m.rateMult!) })],
  ['rangeMult', (m) => ({ icon: 'range', label: 'Reach', value: pct(m.rangeMult!) })],
  ['critChanceAdd', () => ({ icon: 'crit', label: 'Crit' })],
  ['critMultAdd', () => ({ icon: 'crit', label: 'Crit' })],
  ['critEvery', () => ({ icon: 'crit', label: 'Crit' })],
  ['chill', () => ({ icon: 'chill', label: 'Chill' })],
  ['lifedrain', () => ({ icon: 'lifedrain', label: 'Drain' })],
  ['splashAdd', () => ({ icon: 'splash', label: 'Splash' })],
  ['pierce', () => ({ icon: 'pierce', label: 'Pierce' })],
  ['projSpeedMult', () => ({ icon: 'projectile', label: 'Shots' })],
  ['thornsMult', () => ({ icon: 'thorns', label: 'Thorns' })],
  ['thornsIgnite', () => ({ icon: 'thorns', label: 'Thorns' })],
  ['buffAura', () => ({ icon: 'auraBuff', label: 'Aura' })],
  ['killRush', () => ({ icon: 'haste', label: 'Rush' })],
  ['openingRush', () => ({ icon: 'haste', label: 'Rush' })],
  ['leakWard', () => ({ icon: 'hp', label: 'Ward' })],
  ['vsHeld', () => ({ icon: 'damage', label: 'Vs held' })],
  ['vsSlowed', () => ({ icon: 'chill', label: 'Vs slowed' })],
  ['thornsBurn', () => ({ icon: 'thorns', label: 'Thorns' })],
  ['rushPerHeld', () => ({ icon: 'haste', label: 'Rush' })],
  ['killMend', () => ({ icon: 'hp', label: 'Mend' })],
  // The peoples' kit (Oct 2026).
  ['rateAura', () => ({ icon: 'auraBuff', label: 'Aura' })],
  ['chainEvery', () => ({ icon: 'shock', label: 'Shock' })],
  ['spitEvery', () => ({ icon: 'burn', label: 'Poison' })],
  ['root', () => ({ icon: 'trap', label: 'Roots' })],
  ['critBurn', () => ({ icon: 'burn', label: 'Burn' })],
  ['doubleEvery', () => ({ icon: 'damage', label: 'Twice' })],
  ['killReady', () => ({ icon: 'haste', label: 'Ready' })],
  ['vsPlated', () => ({ icon: 'armour', label: 'Vs plated' })],
  ['vsWarded', () => ({ icon: 'armour', label: 'Vs warded' })],
]

export function skillHeadline(skill: Pick<Skill, 'mods'>): SkillHeadline {
  for (const [key, read] of HEADLINES) if (skill.mods[key] != null) return read(skill.mods)
  return { icon: 'boon', label: 'Skill' }
}
