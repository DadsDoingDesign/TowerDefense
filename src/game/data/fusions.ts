import type { CompanyId } from './companies'
import type { IconKey } from './iconAtlas'
import type { EffectMods } from '../types'

/**
 * ---------------------------------------------------------------------------
 * Skill fusion (Oct 2026) — `docs/SKILL_FUSION.md`
 * ---------------------------------------------------------------------------
 *
 * The designer: "It's also kinda boring having my skills replace each other.
 * Can they merge and fuse into new combos and new types of skills. I want real
 * variety and fun."
 *
 * A recipe is two library skills (`data/skills.ts`) and the fused skill they
 * make. A fused skill holds ONE slot: its effect is its two parts' mods and
 * then its own `mods` — the TWIST, a rule only a fusion has (the fifteen new
 * `EffectMods` fields at the end of `types.ts`). `skills.skillModsOf` does
 * the expanding, so a fusion is worth exactly what holding both parts was,
 * plus the twist. The rules — when a card fuses, the held pair's choice, the
 * offer — are `run/fusion.ts`.
 *
 * Pure data: no import of `skills.ts` (it imports this). `level` is the higher
 * part's and `company` one of its parts' — `tests/fusion.test.ts` holds both,
 * and that every part is a starter or a common unlock (never a signature or a
 * feat card) in at most three recipes, and that the five companies have three
 * each.
 *
 * Every `desc` says the parts' numbers in one sentence and `twist` the new
 * rule with its number (COPY.md's skill line, 80 characters each).
 *
 * The twists' numbers are the tuned ones: §7b of `balance/REPORT.md` grades
 * each fusion against the same hero holding both its parts, aiming at +10–25%
 * (the freed slot is the main reward).
 */

/** What a fusion looks like when it lands: the flash and its tag take this colour (a design token). */
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
  /** `fz_<name>`: never a library id, so a save can tell them apart. */
  id: string
  name: string
  /** The two library skills it is made of, in the order its sentence reads them. */
  parts: readonly [string, string]
  /** The higher part's level. */
  level: 1 | 2 | 3
  /** One of its parts' companies. */
  company: CompanyId
  /** The parts' numbers, in one sentence. */
  desc: string
  /** The twist: the rule only the fusion has, with its number. */
  twist: string
  /** The twist alone; the parts' mods are added by `skillModsOf`. */
  mods: EffectMods
  /** Its picture everywhere a skill is pictured (the token, the slot, the Codex). */
  icon: IconKey
  element: FusionElement
}

export const FUSIONS: readonly FusionDef[] = [
  // ---- Level 1 + Level 1: paired at level 5, fused as a held pair from level 10 -
  // Every one pairs a card that standing or a delivery unlocks: no two Level 1
  // starters fuse. (They did, three ways, and every first-timer's hero fused at
  // level 5 — the zero-meta escort went 15% → 30% and the first-timer line
  // 12% → 28%, past both bands. §7b, docs/SKILL_FUSION.md § 7.) A first run
  // meets a fusion only in Anvilfall, two starters met at level 15.
  {
    id: 'fz_thousand_cuts',
    name: 'Thousand Cuts',
    parts: ['long_reach', 'keen_eye'],
    level: 1,
    company: 'silk',
    desc: 'Reaches 20% farther; crit chance +10%, crit damage +50%.',
    twist: 'Crits bounce to 1 more enemy for 60%.',
    mods: { ricochet: 0.6 },
    icon: 'crit',
    element: 'wind',
  },
  {
    id: 'fz_relentless',
    name: 'Relentless',
    parts: ['hard_hitter', 'pin_down'],
    level: 1,
    company: 'silk',
    desc: 'Hits 15% harder, and 30% harder on held enemies.',
    twist: 'Each hit on an enemy makes its next on it 25% harder, up to double.',
    mods: { focusStack: { step: 0.25, cap: 1 } },
    icon: 'damage',
    element: 'blood',
  },
  {
    id: 'fz_bushwhack',
    name: 'Bushwhack',
    parts: ['quick_hands', 'charge'],
    level: 1,
    company: 'spice',
    desc: 'Attacks 15% faster, and 60% faster for the first 15s of each wave.',
    twist: 'Its first hit on each enemy deals 50% more.',
    mods: { firstHit: 0.5 },
    icon: 'blade',
    element: 'wind',
  },
  {
    id: 'fz_sunder',
    name: 'Sunder',
    parts: ['hard_hitter', 'cleave'],
    level: 1,
    company: 'metals',
    desc: 'Hits 15% harder, and every hit strikes enemies within 14 of its target.',
    twist: 'A killing hit’s excess rolls on to the next enemy, up to 3 more.',
    mods: { overkill: 1 },
    icon: 'axe',
    element: 'steel',
  },
  {
    id: 'fz_plague_spark',
    name: 'Plague Spark',
    parts: ['poison_tips', 'arc_spark'],
    level: 1,
    company: 'scrolls',
    desc: 'Every hit poisons 10/s for 3s and jumps to 1 more enemy for 45%.',
    twist: 'Its jumps poison what they hit.',
    mods: { arcCarry: true },
    icon: 'shock',
    element: 'storm',
  },
  {
    id: 'fz_rimecut',
    name: 'Rimecut',
    parts: ['frostbite', 'keen_eye'],
    level: 1,
    company: 'scrolls',
    desc: 'Every hit slows 25% for 1.5s; crit chance +10%, crit damage +50%.',
    twist: '+12% crit on slowed enemies; those crits deal 40% more and freeze 1.5s.',
    mods: { critFreeze: { dur: 1.5, bonus: 0.4, chance: 0.12 } },
    icon: 'chill',
    element: 'frost',
  },
  {
    id: 'fz_crushing_grip',
    name: 'Crushing Grip',
    parts: ['hold_fast', 'pin_down'],
    level: 1,
    company: 'spice',
    desc: 'Holds 1 more enemy, and hits 30% harder on held enemies.',
    twist: 'A held enemy that dies bursts for 40% of its hit within 50.',
    mods: { heldBurst: { frac: 0.4, radius: 50 } },
    icon: 'block',
    element: 'steel',
  },
  // ---- Level 1 + Level 2: met at the second milestone (level 10) ---------
  {
    id: 'fz_plaguebearer',
    name: 'Plaguebearer',
    parts: ['poison_tips', 'venom_spit'],
    level: 2,
    company: 'art',
    desc: 'Every hit poisons 10/s for 3s; every 3rd poisons the 3 nearest 12/s.',
    twist: 'Enemies dying of its poison pass it, fresh, to 4 near them.',
    mods: { contagion: { count: 4, radius: 90 } },
    icon: 'curse',
    element: 'poison',
  },
  {
    id: 'fz_cinderburst',
    name: 'Cinderburst',
    parts: ['cleave', 'wildfire'],
    level: 2,
    company: 'metals',
    desc: 'Every hit burns 12/s for 3s and splashes 29 wider.',
    twist: 'Enemies it set burning burst for 50% of its hit when they die.',
    mods: { deathBurst: { frac: 0.5, radius: 45 } },
    icon: 'burn',
    element: 'fire',
  },
  {
    id: 'fz_hail_of_arrows',
    name: 'Hail of Arrows',
    parts: ['long_reach', 'long_shot'],
    level: 2,
    company: 'silk',
    desc: 'Reaches 80% farther, and every shot pierces 1 extra enemy.',
    twist: 'Every 4th attack also shoots 2 more enemies for 40%.',
    mods: { fanEvery: { every: 4, count: 2, frac: 0.4 } },
    icon: 'bow',
    element: 'wind',
  },
  {
    id: 'fz_coup_de_grace',
    name: 'Coup de Grâce',
    parts: ['charge', 'finisher'],
    level: 2,
    company: 'art',
    desc: 'Kills under 15% health outright; +60% speed for 15s; +10% crit, +10% damage.',
    twist: 'Kills under 22% outright, and each execution readies its next attack.',
    mods: { executeReady: true, execute: 0.22 },
    icon: 'execute',
    element: 'blood',
  },
  {
    id: 'fz_shatterglass',
    name: 'Shatterglass',
    parts: ['frostbite', 'cold_snap'],
    level: 2,
    company: 'scrolls',
    desc: 'Every hit slows 25% for 1.5s, and hits 25% harder on slowed enemies.',
    twist: 'Hits on slowed enemies splinter 35% to enemies within 45.',
    mods: { frostSplash: { frac: 0.35, radius: 45 } },
    icon: 'splash',
    element: 'frost',
  },
  {
    id: 'fz_rallying_standard',
    name: 'Rallying Standard',
    parts: ['hold_fast', 'banner_bearer'],
    level: 2,
    company: 'spice',
    desc: 'Holds 1 more enemy; heroes near it attack 20% faster.',
    twist: 'Heroes near it crit 10% more often.',
    mods: { critAura: { add: 0.1, radius: 130 } },
    icon: 'banner',
    element: 'banner',
  },
  // ---- Level 2 / Level 1 + Level 3: met at the last milestone (level 15) ---
  {
    id: 'fz_anvilfall',
    name: 'Anvilfall',
    parts: ['heavy_blows', 'weaponmaster'],
    level: 3,
    company: 'metals',
    desc: 'Hits 50% harder, attacks 10% faster; +20% crit chance, +60% crit damage.',
    twist: 'Every 4th attack shakes enemies within 60 of its target for 60%.',
    mods: { quakeEvery: { every: 4, frac: 0.6, radius: 60 } },
    icon: 'hammer',
    element: 'steel',
  },
  {
    id: 'fz_red_mist',
    name: 'Red Mist',
    parts: ['bloodrush', 'berserk'],
    level: 3,
    company: 'art',
    desc: 'Hits 40% harder, attacks 25% faster; each kill +25% speed for 1.5s.',
    twist: 'Each kill this wave adds 4% attack speed, to +40%.',
    mods: { frenzy: { rate: 0.04, cap: 0.4 } },
    icon: 'haste',
    element: 'blood',
  },
]
