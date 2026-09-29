import type { CoreStats, EffectMods, ItemRarity } from '../types'

/**
 * ---------------------------------------------------------------------------
 * Relics — one pool where keepsakes and team stat cards used to overlap
 * (Phase 3b)
 * ---------------------------------------------------------------------------
 *
 * The review found two systems doing one job: a **keepsake** was a body-slot
 * item whose enchantments buffed the whole company (+x% damage, +x% rate…),
 * and a **stat card** was a reward whose grant buffed the whole company (+x%
 * damage, +x% rate…). Same effects, two vocabularies, two places to look —
 * and between them two of the eight systems feeding `damageMult`.
 *
 * A relic is the one thing now: a run-long, company-wide possession, taken from
 * a reward hand (every elite guarantees one; an act boss offers three) and
 * listed in one place. About half of them are no longer a percentage at all but
 * a RULE — a ward, a charter, a cadence, a rush — because "+x%" is the decision
 * the old cards had already failed to make interesting. None sells plain
 * "+x% damage": that line is gone, and with it one of the `damageMult` sources.
 *
 * `kind` says which half a relic is. A `stat` relic's `grant` lands on every
 * hero in the company, hires included; a `rule` relic changes how the run or
 * the fight works — through `mods` the engine reads (a team capability) or a
 * `rule` the run layer applies (`run/relics.ts`). Every `desc` is the number
 * the code applies; `balance/report.ts` §15 grades the combat half on the stop
 * rate benches and the run-rule half on paired whole runs.
 */
export interface RelicGrant {
  stats?: Partial<CoreStats>
  thorns?: number
  patience?: number
  /** Team mods — applied to every hero on the field, every wave. */
  mods?: EffectMods
}

/** A rule the RUN layer applies (the engine never sees these). */
export type RelicRule = 'mercenaryCharter' | 'fieldSurgeon' | 'quartermaster' | 'warDiary' | 'titheBox'

/**
 * An engine capability a relic needs. Capabilities another lane owns are
 * declared here by name and gated by {@link ENGINE_CAPABILITIES}: a relic whose
 * capability this build does not implement is never offered, so no card can
 * sell a rule the engine cannot keep.
 */
export type Capability =
  | 'leakWard'
  | 'volley'
  | 'killRush'
  | 'openingRush'
  | 'lastStand'
  /** The combat lane's status interaction: a burning enemy's fire spreads on death. */
  | 'burnSpreadOnDeath'
  /** The combat lane's Watch command, upgraded: Rally Horn becomes Flare. */
  | 'command:flare'

/**
 * Which capabilities THIS build's engine implements — the relic → engine
 * capability map. The first five are the Phase 3b rule hooks in `engine.ts`.
 * The last two belong to the combat lane and flip to `true` when its engine
 * lands (and `CAPABILITY_MODS` below carries the flag it reads).
 */
export const ENGINE_CAPABILITIES: Record<Capability, boolean> = {
  leakWard: true,
  volley: true,
  killRush: true,
  openingRush: true,
  lastStand: true,
  // Phase 3a: `engine.onDeath` spreads a burn when the team carries the flag
  // below, and Flare is a Watch Command (`data/commands.ts`); a relic's
  // `commands` swap the company's Rally Horn for it (`commandsFor`).
  burnSpreadOnDeath: true,
  'command:flare': true,
}

/**
 * What a capability relic hands the engine, as team mods. Written as a plain
 * record rather than `EffectMods` for the two foreign capabilities, whose flag
 * the combat lane defines; the engine ignores a key it does not read.
 */
export const CAPABILITY_MODS: Partial<Record<Capability, Record<string, unknown>>> = {
  burnSpreadOnDeath: { burnSpreadOnDeath: true },
}

export interface Relic {
  id: string
  name: string
  rarity: ItemRarity
  kind: 'stat' | 'rule'
  desc: string
  grant?: RelicGrant
  rule?: RelicRule
  requires?: Capability
  /** Watch commands this relic grants (the combat lane's command ids). */
  commands?: string[]
  /** The stated cost, for a pact. Every one is a number the code applies. */
  downside?: string
  /** Achievement id that adds this relic to the pool; absent = always in it. */
  unlock?: string
}

export const RELICS: readonly Relic[] = [
  // ---- stat relics: the old stat cards and keepsakes, merged -------------
  { id: 'ledger', name: "Drillmaster's Ledger", rarity: 'common', kind: 'stat', desc: '+3 STR, +3 DEX, +3 INT · every hero, hires included', grant: { stats: { str: 3, dex: 3, int: 3 } } },
  { id: 'hourglass', name: 'Watch Hourglass', rarity: 'common', kind: 'stat', desc: '+5 Patience · every hero, hires included', grant: { patience: 5 } },
  { id: 'horn', name: 'Hunting Horn', rarity: 'rare', kind: 'stat', desc: '+7% attack speed · the whole company', grant: { mods: { rateMult: 1.07 } } },
  { id: 'keen', name: 'Keen Whetstone', rarity: 'rare', kind: 'stat', desc: '+6% crit chance, +25% crit damage · the whole company', grant: { mods: { critChanceAdd: 0.06, critMultAdd: 0.25 } } },
  { id: 'close_quarters', name: 'Close Quarters', rarity: 'epic', kind: 'stat', desc: '+18% damage, −18% range · the whole company', downside: '−18% range · whole company', grant: { mods: { damageMult: 1.18, rangeMult: 0.82 } } },
  { id: 'whetstone_pact', name: 'Whetstone Pact', rarity: 'epic', kind: 'stat', desc: '+32% attack speed, no crits · the whole company', downside: 'the company never crits', grant: { mods: { rateMult: 1.32, critChanceAdd: -1 } } },
  { id: 'bloodletting', name: 'Bloodletting', rarity: 'epic', kind: 'stat', desc: '+20% damage, +8 Thorns, −22% hero HP · the whole company', downside: '−22% hero HP · whole company', grant: { thorns: 8, mods: { damageMult: 1.2, hpMult: 0.78 } } },
  { id: 'exec_oath', name: 'Executioner’s Oath', rarity: 'legendary', kind: 'stat', desc: 'Executes anything below 45% HP, +12% crit chance, −12% attack speed · the whole company', downside: '−12% attack speed · whole company', grant: { mods: { execute: 0.45, critChanceAdd: 0.12, rateMult: 0.88 } } },
  { id: 'wildfire', name: 'Wildfire Pact', rarity: 'legendary', kind: 'stat', desc: 'Every hit burns for 80/s over 3s, −35% damage per hit · the whole company', downside: '−35% damage per hit · whole company', grant: { mods: { burn: { dps: 80, dur: 3 }, damageMult: 0.65 } } },
  { id: 'iron_vigil', name: 'Iron Vigil', rarity: 'legendary', kind: 'stat', desc: '+60% hero HP, +16 Thorns, +6 Patience, −14% damage · the whole company', downside: '−14% damage · whole company', grant: { thorns: 16, patience: 6, mods: { hpMult: 1.6, damageMult: 0.86 } } },

  // ---- rule relics: change how the fight or the run works ---------------
  { id: 'warding_stone', name: 'Warding Stone', rarity: 'rare', kind: 'rule', desc: 'The first 2 enemies to reach the Gate each wave cost it nothing.', requires: 'leakWard', grant: { mods: { leakWard: 2 } } },
  { id: 'hound_banner', name: 'Bloodhound Banner', rarity: 'rare', kind: 'rule', desc: 'Every 5th shot of every hero pierces 2 more enemies.', requires: 'volley', grant: { mods: { volley: { every: 5, pierce: 2 } } } },
  { id: 'ambush_drum', name: 'Ambush Drum', rarity: 'rare', kind: 'rule', desc: 'For the first 20s of every wave, the whole company attacks 35% faster.', requires: 'openingRush', grant: { mods: { openingRush: { rate: 0.35, dur: 20 } } } },
  { id: 'veteran_cloak', name: "Veteran's Cloak", rarity: 'epic', kind: 'rule', desc: 'A kill makes that hero attack 25% faster for 1.5s.', requires: 'killRush', grant: { mods: { killRush: { rate: 0.25, dur: 1.5 } } }, unlock: 'act_two' },
  { id: 'last_rampart', name: 'Last Rampart', rarity: 'epic', kind: 'rule', desc: 'Heroes below 35% HP strike 50% harder.', requires: 'lastStand', grant: { mods: { lastStand: { below: 0.35, damage: 0.5 } } }, unlock: 'flawless_boss' },
  { id: 'charter', name: 'Mercenary Charter', rarity: 'rare', kind: 'rule', desc: 'Recruits arrive at your company’s median level instead of three behind it.', rule: 'mercenaryCharter', unlock: 'full_company' },
  { id: 'surgeon', name: "Field Surgeon's Kit", rarity: 'common', kind: 'rule', desc: 'The Gate recovers 2 after every fight you win.', rule: 'fieldSurgeon' },
  { id: 'seal', name: "Quartermaster's Seal", rarity: 'rare', kind: 'rule', desc: 'Merchants lay out a fifth item, and your first restock at each one is free.', rule: 'quartermaster' },
  { id: 'diary', name: 'War Diary', rarity: 'epic', kind: 'rule', desc: 'After every fight, the lowest-level hero on the field gains 50% more XP.', rule: 'warDiary' },
  { id: 'tithe', name: 'Tithe Box', rarity: 'common', kind: 'rule', desc: '+10 gold for every fight you win.', rule: 'titheBox' },
  { id: 'ember_urn', name: 'Ember Urn', rarity: 'epic', kind: 'rule', desc: 'A burning enemy that dies spreads its fire to the enemies beside it.', requires: 'burnSpreadOnDeath' },
  { id: 'signal_flare', name: 'Signal Flare', rarity: 'rare', kind: 'rule', desc: 'Your Rally Horn becomes Flare.', requires: 'command:flare', commands: ['flare'] },
]

const RELIC_BY_ID = new Map(RELICS.map((r) => [r.id, r]))
export const relicById = (id: string): Relic | undefined => RELIC_BY_ID.get(id)

/** Whether this build can keep a relic's promise (its capability is implemented). */
export const relicSupported = (r: Relic): boolean => !r.requires || ENGINE_CAPABILITIES[r.requires]

/**
 * The relics that may be offered: supported by this build's engine, opened (if
 * they sit behind a feat), and not already held.
 */
export function relicPool(opts: { held?: readonly string[]; unlocked?: (achievementId: string) => boolean } = {}): Relic[] {
  const held = new Set(opts.held ?? [])
  const unlocked = opts.unlocked ?? (() => false)
  return RELICS.filter((r) => relicSupported(r) && !held.has(r.id) && (!r.unlock || unlocked(r.unlock)))
}

/** The team mods a set of held relics hands the engine, every wave. */
export function relicTeamMods(held: readonly string[]): EffectMods[] {
  const out: EffectMods[] = []
  for (const id of held) {
    const r = RELIC_BY_ID.get(id)
    if (!r || !relicSupported(r)) continue
    if (r.grant?.mods) out.push(r.grant.mods)
    const cap = r.requires ? CAPABILITY_MODS[r.requires] : undefined
    if (cap) out.push(cap as EffectMods)
  }
  return out
}

/** Whether a run holding `held` has a given run-layer rule. */
export const hasRelicRule = (held: readonly string[], rule: RelicRule): boolean =>
  held.some((id) => RELIC_BY_ID.get(id)?.rule === rule)

/** The flat stats every hero gains from held stat relics (hires included). */
export function relicStatGrant(held: readonly string[]): { stats: CoreStats; thorns: number; patience: number } {
  const out = { stats: { str: 0, dex: 0, int: 0 }, thorns: 0, patience: 0 }
  for (const id of held) {
    const g = RELIC_BY_ID.get(id)?.grant
    if (!g) continue
    out.stats.str += g.stats?.str ?? 0
    out.stats.dex += g.stats?.dex ?? 0
    out.stats.int += g.stats?.int ?? 0
    out.thorns += g.thorns ?? 0
    out.patience += g.patience ?? 0
  }
  return out
}

/** Watch commands the held relics grant (only those this build supports). */
export const relicCommands = (held: readonly string[]): string[] =>
  held.flatMap((id) => {
    const r = RELIC_BY_ID.get(id)
    return r && relicSupported(r) ? (r.commands ?? []) : []
  })
