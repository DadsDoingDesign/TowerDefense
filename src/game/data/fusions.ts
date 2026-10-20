import type { CompanyId } from './companies'
import type { IconKey } from './iconAtlas'
import type { EffectMods } from '../types'

/**
 * ---------------------------------------------------------------------------
 * Named merges (Oct 2026) — `docs/SKILL_FUSION.md`
 * ---------------------------------------------------------------------------
 *
 * The designer: "the merging should be possible with any combination in any
 * order, but order does matter and affects what's made."
 *
 * Any card dropped on any held skill merges (`run/fusion.ts`): the held skill
 * is the BASE and keeps itself, the card is the INFUSION and lends its share
 * (`data/infusions.ts`) and one re-expression rule. A NAMED merge is the
 * special for ONE ordered pair: the same base and the same share, and in place
 * of the rule a stronger twist only it has (the fifteen `EffectMods` fields at
 * the end of `types.ts`). The other order of the same two skills is a plain
 * merge — A onto B is never B onto A.
 *
 * Two tiers. A tier-1 recipe's base is a library skill; a GREATER recipe's
 * base is a tier-1 named merge, so it is three skills in one slot (the depth
 * cap, `fusion.MAX_DEPTH`) and keeps the tier-1 twist beside its own capstone.
 *
 * `parts` is the order: [base, infusion]. Pure data: no import of `skills.ts`
 * (it imports this). `tests/merge.test.ts` holds the shape — every infusion a
 * library card that is not a signature or a feat card; no two Level 1
 * starters; each skill in at most three recipes; one greater per company —
 * and every twist line to COPY.md's 80 characters.
 *
 * The twists' numbers are the tuned ones: §7b of `balance/REPORT.md` grades
 * each named merge against the plain merge of the same order (the same base
 * and share, the rule in place of the twist), aiming at +10–25%.
 */

/** What a merge looks like when it lands: the flash and its tag take this colour (a design token). */
export type FusionElement = 'fire' | 'poison' | 'frost' | 'storm' | 'blood' | 'steel' | 'wind' | 'banner'

/** The token each element flashes in (`global.css`; no new colour). */
export const ELEMENT_TOKEN: Readonly<Record<FusionElement, string>> = {
  fire: '--fighter',
  poison: '--rogue',
  frost: '--info',
  storm: '--mystic',
  blood: '--bad',
  steel: '--co-metals',
  wind: '--co-silk',
  banner: '--warn',
}

export interface FusionDef {
  /** `fz_<name>`: never a library id or a plain merge's, so a save can tell them apart. */
  id: string
  name: string
  /** The order that makes it: [base, infusion]. The base is a library skill (tier 1) or a tier-1 named merge (greater). */
  parts: readonly [string, string]
  /** 1: two skills; 2 (greater): a tier-1 named merge and one more. */
  tier: 1 | 2
  /** The highest level among its skills. */
  level: 1 | 2 | 3
  /** Its base's company. */
  company: CompanyId
  /** The twist: the rule only it has, with its number. */
  twist: string
  /** The twist alone; the base and the share are added by `skills.skillModsOf`. */
  mods: EffectMods
  /** Its picture everywhere a skill is pictured (the token, the slot, the Codex). */
  icon: IconKey
  element: FusionElement
}

export const FUSIONS: readonly FusionDef[] = [
  // ---- Tier 1, Level 1 onto Level 1: the level-5 card onto the starting skill -
  // Every one pairs a card that standing or a delivery unlocks: no two Level 1
  // starters make one. (When fusion was unordered they did, three ways, and
  // every first-timer's hero fused at level 5 — the zero-meta escort went
  // 15% → 30%. docs/SKILL_FUSION.md § 7.) A first run meets a named merge
  // only in Anvilfall, two starters met at level 15.
  {
    id: 'fz_thousand_cuts',
    name: 'Thousand Cuts',
    parts: ['keen_eye', 'long_reach'],
    tier: 1,
    level: 1,
    company: 'silk',
    twist: 'Crits bounce to 1 more enemy for 60%.',
    mods: { ricochet: 0.6 },
    icon: 'crit',
    element: 'wind',
  },
  {
    id: 'fz_relentless',
    name: 'Relentless',
    parts: ['hard_hitter', 'pin_down'],
    tier: 1,
    level: 1,
    company: 'spice',
    twist: 'Each hit on an enemy makes its next on it 25% harder, up to double.',
    mods: { focusStack: { step: 0.25, cap: 1 } },
    icon: 'damage',
    element: 'blood',
  },
  {
    id: 'fz_bushwhack',
    name: 'Bushwhack',
    parts: ['quick_hands', 'charge'],
    tier: 1,
    level: 1,
    company: 'silk',
    twist: 'Its first hit on each enemy deals 50% more.',
    mods: { firstHit: 0.5 },
    icon: 'blade',
    element: 'wind',
  },
  {
    id: 'fz_sunder',
    name: 'Sunder',
    parts: ['hard_hitter', 'cleave'],
    tier: 1,
    level: 1,
    company: 'spice',
    twist: 'A killing hit’s excess rolls on to the next enemy, up to 3 more.',
    mods: { overkill: 1 },
    icon: 'axe',
    element: 'steel',
  },
  {
    id: 'fz_plague_spark',
    name: 'Plague Spark',
    parts: ['arc_spark', 'poison_tips'],
    tier: 1,
    level: 1,
    company: 'scrolls',
    twist: 'Every 2nd attack jumps to 1 more enemy, and its jumps poison what they hit.',
    mods: { arcCarry: true, chainEvery: { every: 2, chains: 1, dmgFrac: 0.45 } },
    icon: 'shock',
    element: 'storm',
  },
  {
    id: 'fz_rimecut',
    name: 'Rimecut',
    parts: ['frostbite', 'keen_eye'],
    tier: 1,
    level: 1,
    company: 'scrolls',
    twist: '+18% crit on slowed enemies; those crits deal 60% more and freeze 2s.',
    mods: { critFreeze: { dur: 2, bonus: 0.6, chance: 0.18 } },
    icon: 'chill',
    element: 'frost',
  },
  {
    id: 'fz_crushing_grip',
    name: 'Crushing Grip',
    parts: ['hold_fast', 'pin_down'],
    tier: 1,
    level: 1,
    company: 'spice',
    twist: 'A held enemy that dies bursts for 40% of its hit within 50.',
    mods: { heldBurst: { frac: 0.4, radius: 50 } },
    icon: 'block',
    element: 'steel',
  },
  // ---- Tier 1, a Level 2 card onto a Level 1 skill (level 10) -------------
  {
    id: 'fz_plaguebearer',
    name: 'Plaguebearer',
    parts: ['poison_tips', 'venom_spit'],
    tier: 1,
    level: 2,
    company: 'art',
    twist: 'Enemies dying of its poison pass it, fresh, to 4 near them.',
    mods: { contagion: { count: 4, radius: 90 } },
    icon: 'curse',
    element: 'poison',
  },
  {
    id: 'fz_cinderburst',
    name: 'Cinderburst',
    parts: ['cleave', 'wildfire'],
    tier: 1,
    level: 2,
    company: 'metals',
    twist: 'Enemies it set burning burst for 50% of its hit when they die.',
    mods: { deathBurst: { frac: 0.5, radius: 45 } },
    icon: 'burn',
    element: 'fire',
  },
  {
    id: 'fz_hail_of_arrows',
    name: 'Hail of Arrows',
    parts: ['long_reach', 'long_shot'],
    tier: 1,
    level: 2,
    company: 'silk',
    twist: 'Every 4th attack also shoots 2 more enemies for 40%.',
    mods: { fanEvery: { every: 4, count: 2, frac: 0.4 } },
    icon: 'bow',
    element: 'wind',
  },
  {
    id: 'fz_coup_de_grace',
    name: 'Coup de Grâce',
    parts: ['charge', 'finisher'],
    tier: 1,
    level: 2,
    company: 'spice',
    twist: 'Executes under 22% instead, and each execution readies its next attack.',
    mods: { executeReady: true, execute: 0.22 },
    icon: 'execute',
    element: 'blood',
  },
  {
    id: 'fz_shatterglass',
    name: 'Shatterglass',
    parts: ['frostbite', 'cold_snap'],
    tier: 1,
    level: 2,
    company: 'scrolls',
    twist: 'Hits on slowed enemies splinter 35% to enemies within 45.',
    mods: { frostSplash: { frac: 0.35, radius: 45 } },
    icon: 'splash',
    element: 'frost',
  },
  {
    id: 'fz_rallying_standard',
    name: 'Rallying Standard',
    parts: ['hold_fast', 'banner_bearer'],
    tier: 1,
    level: 2,
    company: 'spice',
    twist: 'Heroes near it crit 15% more often.',
    mods: { critAura: { add: 0.15, radius: 130 } },
    icon: 'banner',
    element: 'banner',
  },
  // ---- Tier 1, a Level 3 card (level 15) -----------------------------------
  {
    id: 'fz_anvilfall',
    name: 'Anvilfall',
    parts: ['heavy_blows', 'weaponmaster'],
    tier: 1,
    level: 3,
    company: 'metals',
    twist: 'Every 3rd attack shakes enemies within 60 of its target for 60%.',
    mods: { quakeEvery: { every: 3, frac: 0.6, radius: 60 } },
    icon: 'hammer',
    element: 'steel',
  },
  {
    id: 'fz_red_mist',
    name: 'Red Mist',
    parts: ['bloodrush', 'berserk'],
    tier: 1,
    level: 3,
    company: 'art',
    twist: 'Each kill this wave adds 2.5% attack speed, to +25%.',
    mods: { frenzy: { rate: 0.025, cap: 0.25 } },
    icon: 'haste',
    element: 'blood',
  },
  // ---- Greater: a Level 3 card onto a tier-1 named merge (level 15) -------
  // Three skills in one slot, the depth cap. Each keeps its tier-1 twist and
  // adds a capstone; one per company.
  {
    id: 'fz_skyfall',
    name: 'Skyfall',
    parts: ['fz_hail_of_arrows', 'volley'],
    tier: 2,
    level: 3,
    company: 'silk',
    twist: 'Every 2nd attack shakes enemies within 55 of its target for 50%.',
    mods: { quakeEvery: { every: 2, frac: 0.5, radius: 55 } },
    icon: 'bow',
    element: 'wind',
  },
  {
    id: 'fz_black_death',
    name: 'Black Death',
    parts: ['fz_plaguebearer', 'reaper'],
    tier: 2,
    level: 3,
    company: 'art',
    twist: 'Enemies dying of its poison burst for 40% of its hit within 50.',
    mods: { deathBurst: { frac: 0.4, radius: 50 } },
    icon: 'curse',
    element: 'poison',
  },
  {
    id: 'fz_glass_storm',
    name: 'Glass Storm',
    parts: ['fz_shatterglass', 'tinkers_spark'],
    tier: 2,
    level: 3,
    company: 'scrolls',
    twist: '+30% crit on slowed enemies; those crits deal 80% more and freeze 1.5s.',
    mods: { critFreeze: { dur: 1.5, bonus: 0.8, chance: 0.3 } },
    icon: 'chill',
    element: 'frost',
  },
  {
    id: 'fz_forgefire',
    name: 'Forgefire',
    parts: ['fz_cinderburst', 'weaponmaster'],
    tier: 2,
    level: 3,
    company: 'metals',
    twist: 'Crits bounce on in full, and a kill’s excess rolls on at 50%.',
    mods: { ricochet: 1, overkill: 0.5 },
    icon: 'burn',
    element: 'fire',
  },
  {
    id: 'fz_war_banner',
    name: 'War Banner',
    parts: ['fz_rallying_standard', 'rally'],
    tier: 2,
    level: 3,
    company: 'spice',
    twist: 'Each kill this wave adds 4% attack speed, to +40%.',
    mods: { frenzy: { rate: 0.04, cap: 0.4 } },
    icon: 'banner',
    element: 'banner',
  },
]
