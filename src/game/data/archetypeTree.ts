import type { Archetype, AttackProfile, CoreStats, EffectMods } from '../types'

/**
 * The Sentinel progression tree: 3 base archetypes → 9 sub-archetypes (tier 1,
 * unlocked at level 10) → 27 specializations (tier 2, level 20).
 *
 * Abilities are data, not code: each node contributes stat grants and `EffectMods`
 * that the engine reads. This keeps 27 distinct builds real while the engine
 * implements ~16 effect primitives once. Gear enchantments (M3) reuse EffectMods.
 */
export interface TreeNode {
  id: string
  name: string
  tier: 0 | 1 | 2
  parent: string | null
  archetype: Archetype
  /** One-line identity. */
  blurb: string
  /** Ability preview shown on the evolution card. */
  ability: string
  /** Stats granted when this node is chosen (evolutions) or the base (tier 0). */
  grant?: { stats?: Partial<CoreStats>; thorns?: number; patience?: number }
  mods?: EffectMods
  // Tier-0 only:
  base?: AttackProfile
  baseStats?: CoreStats
  baseThorns?: number
  basePatience?: number
  color?: string
  accent?: string
}

const HUES: Record<Archetype, { color: string; accent: string }> = {
  fighter: { color: '#d9743f', accent: '#f0a868' },
  rogue: { color: '#4fae72', accent: '#88e0a8' },
  mystic: { color: '#5b8cd6', accent: '#9ec1f0' },
}

// ---------------------------------------------------------------- Tier 0
const TIER0: TreeNode[] = [
  {
    id: 'fighter',
    name: 'Fighter',
    tier: 0,
    parent: null,
    archetype: 'fighter',
    blurb: 'Frontline bruiser who holds the line.',
    ability: 'Blocks up to 2 enemies at close range.',
    base: {
      damage: 26,
      range: 96,
      rate: 0.95,
      projectileSpeed: 560,
      splashRadius: 0,
      critChance: 0.05,
      critMult: 1.5,
      damageType: 'physical',
    },
    baseStats: { str: 12, dex: 6, int: 3 },
    baseThorns: 8,
    basePatience: 5,
    mods: { block: { count: 2, radius: 72 }, physDefAdd: 20 },
    ...HUES.fighter,
  },
  {
    id: 'rogue',
    name: 'Rogue',
    tier: 0,
    parent: null,
    archetype: 'rogue',
    blurb: 'Single-target burst with high crit.',
    ability: 'Fast, long-range strikes that crit often.',
    base: {
      damage: 14,
      range: 168,
      rate: 2.1,
      projectileSpeed: 760,
      splashRadius: 0,
      critChance: 0.28,
      critMult: 2.0,
      damageType: 'physical',
    },
    baseStats: { str: 6, dex: 12, int: 4 },
    baseThorns: 2,
    basePatience: 4,
    ...HUES.rogue,
  },
  {
    id: 'mystic',
    name: 'Mystic',
    tier: 0,
    parent: null,
    archetype: 'mystic',
    blurb: 'Area control and elemental damage.',
    ability: 'Splashes magic damage on impact.',
    base: {
      damage: 16,
      range: 150,
      rate: 0.8,
      projectileSpeed: 480,
      splashRadius: 58,
      critChance: 0.05,
      critMult: 1.5,
      damageType: 'magic',
    },
    baseStats: { str: 4, dex: 5, int: 13 },
    baseThorns: 2,
    basePatience: 4,
    ...HUES.mystic,
  },
]

// Compact builders to keep the 36 evolution nodes readable.
const t1 = (
  id: string,
  parent: Archetype,
  name: string,
  blurb: string,
  ability: string,
  grant: TreeNode['grant'],
  mods: EffectMods,
): TreeNode => ({ id, name, tier: 1, parent, archetype: parent, blurb, ability, grant, mods })

const t2 = (
  id: string,
  parent: string,
  archetype: Archetype,
  name: string,
  ability: string,
  grant: TreeNode['grant'],
  mods: EffectMods,
): TreeNode => ({ id, name, tier: 2, parent, archetype, blurb: ability, ability, grant, mods })

// ---------------------------------------------------------------- Tier 1 (9)
const TIER1: TreeNode[] = [
  // Fighter
  t1('warrior', 'fighter', 'Warrior', 'Pure damage.', 'Heavier, faster strikes.', { stats: { str: 8, dex: 3 }, thorns: 3, patience: 3 }, { damageMult: 1.25, rateMult: 1.1, physDefAdd: 6 }),
  t1('knight', 'fighter', 'Knight', 'Crowd control.', 'Bashes stun foes; holds 3 enemies.', { stats: { str: 7, dex: 2 }, thorns: 4, patience: 4 }, { stunChance: 0.18, stunDur: 0.7, block: { count: 3, radius: 80 }, physDefAdd: 16 }),
  // Guard — the anchor line (H1). It used to sell only `dmgReductionAura`, which
  // the engine can barely pay out: a tower is damageable *only while blocking*
  // (`engine.updateSentinels`), so a shield aura protects almost nothing, and the
  // Guard itself became a second body that blocked, took melee and died. It now
  // pays rent three ways that all survive contact with the engine: it **holds**
  // (block), it **grinds** what it holds (thorns), and it **slows the lane** so
  // the whole team gets more seconds of fire per enemy — plus the HP to still be
  // standing when that matters.
  t1('guard', 'fighter', 'Guard', 'Anchors the line.', 'Holds 3 enemies, chills what it strikes, shields nearby allies.', { stats: { str: 8, dex: 1 }, thorns: 8, patience: 5 }, { dmgReductionAura: { reduction: 0.2, radius: 120 }, block: { count: 3, radius: 85 }, chill: { slow: 0.3, dur: 1.4 }, thornsMult: 1.5, hpMult: 1.35, physDefAdd: 24 }),
  // Rogue
  t1('assassin', 'rogue', 'Assassin', 'Executes.', 'Instantly kills badly wounded foes.', { stats: { dex: 8, str: 2 }, patience: 3 }, { execute: 0.15, critChanceAdd: 0.1 }),
  // ---- what a trap actually is, said on the card (m-1) ----------------------
  // The engine lays **one** trap per Sentinel — `engine.ts` builds it in the
  // constructor at `nearestPathPoint(slot)`, never moves it, and sweeps a
  // `TRAP_RADIUS` of 34px against a 2290px lane (about 3% of the road). It is a
  // mine beside the tower, not a minefield: "Lays hazards", plural, and the
  // Saboteur's "traps carpet the path" were both selling a placement mechanic
  // that does not exist. `mergeMods` takes best-of, so two trap sources are
  // still one trap. `describeMods` now prints the count, the dps and the slow.
  t1('trickster', 'rogue', 'Trickster', 'Traps & debuffs.', 'Buries one hazard beside it that wounds and slows whatever crosses it.', { stats: { dex: 7, int: 3 }, patience: 3 }, { trap: { dps: 14, slow: 0.3 }, chill: { slow: 0.2, dur: 1 } }),
  t1('marksman', 'rogue', 'Marksman', 'Range & pierce.', 'Long shots that pierce one extra enemy.', { stats: { dex: 8, str: 1 }, patience: 3 }, { rangeMult: 1.5, pierce: 1, projSpeedMult: 1.4 }),
  // Mystic
  t1('elementalist', 'mystic', 'Elementalist', 'DoTs.', 'Splash that burns over time.', { stats: { int: 8, dex: 2 }, patience: 3 }, { burn: { dps: 12, dur: 3 }, splashAdd: 15 }),
  t1('cleric', 'mystic', 'Cleric', 'Heals & buffs.', 'Heals and empowers the Sentinel row.', { stats: { int: 7, str: 2 }, patience: 4 }, { healAura: { hps: 8, radius: 130 }, buffAura: { damageMult: 1.15, radius: 130 } }),
  t1('warlock', 'mystic', 'Warlock', 'Life-drain.', 'Drains life; sacrifices HP for power.', { stats: { int: 8, str: 2 }, patience: 2 }, { lifedrain: 0.2, selfSacrifice: 0.15, damageMult: 1.3 }),
]

// ---------------------------------------------------------------- Tier 2 (27)
const TIER2: TreeNode[] = [
  // Warrior
  t2('berserker', 'warrior', 'fighter', 'Berserker', 'Reckless: huge damage, thinner armor.', { stats: { str: 12, dex: 4 }, thorns: 4 }, { damageMult: 1.4, rateMult: 1.25, hpMult: 0.85 }),
  t2('juggernaut', 'warrior', 'fighter', 'Juggernaut', 'An immovable wall with punishing thorns.', { stats: { str: 10 }, thorns: 10, patience: 6 }, { hpMult: 1.6, block: { count: 4, radius: 90 }, thornsMult: 2, physDefAdd: 30 }),
  t2('weaponmaster', 'warrior', 'fighter', 'Weaponmaster', 'Precise strikes crit often and hard.', { stats: { str: 8, dex: 8 } }, { critChanceAdd: 0.2, critMultAdd: 0.6, damageMult: 1.2 }),
  // Knight
  t2('bulwark', 'knight', 'fighter', 'Bulwark', 'Fortress: holds five, freezes the lane, shields all.', { stats: { str: 10 }, thorns: 8, patience: 8 }, { block: { count: 5, radius: 95 }, dmgReductionAura: { reduction: 0.3, radius: 130 }, chill: { slow: 0.45, dur: 2 }, hpMult: 1.85, thornsMult: 1.6, physDefAdd: 34 }),
  t2('vanguard', 'knight', 'fighter', 'Vanguard', 'A stunning charge with real damage.', { stats: { str: 10, dex: 4 } }, { stunChance: 0.25, stunDur: 0.9, damageMult: 1.25 }),
  t2('order_sentinel', 'knight', 'fighter', 'Sentinel of Order', 'Locks the lane with stun and chill.', { stats: { str: 8, int: 4 }, patience: 5 }, { stunChance: 0.3, stunDur: 0.8, chill: { slow: 0.4, dur: 1.5 } }),
  // Guard
  t2('aegis', 'guard', 'fighter', 'Aegis', 'Holds four, freezes them solid, shields the whole line.', { stats: { str: 9 }, thorns: 8, patience: 8 }, { dmgReductionAura: { reduction: 0.4, radius: 150 }, block: { count: 4, radius: 95 }, chill: { slow: 0.5, dur: 2.2 }, hpMult: 1.45, physDefAdd: 26 }),
  // ---- the card was true of nothing the engine did (C2) ---------------------
  //
  // "Everything it holds burns on its thorns" was sold on a mechanism that did
  // not exist. Thorns go through `engine.damageEnemy`, which writes no statuses;
  // burn was written only in `applyHit`, reachable only from a projectile. And a
  // Fighter fires ONE projectile at one target (`splashRadius 0`, `pierce 0`)
  // while burn does not stack, so of the four bodies this node holds at most one
  // was ever alight — and never from the thorns.
  //
  // `thornsIgnite` is the engine capability that makes the sentence true: the
  // grind is a strike for the purposes of burn, so all four held bodies burn,
  // continuously, for as long as they are held. See `engine.igniteFromThorns`
  // for why it is opt-in rather than a universal rule about blockers.
  t2('warden_of_ash', 'guard', 'fighter', 'Warden of Ash', 'Everything it holds burns on its thorns.', { stats: { str: 10 }, thorns: 16, patience: 6 }, { thornsMult: 3, block: { count: 4, radius: 90 }, burn: { dps: 26, dur: 3 }, thornsIgnite: true, hpMult: 1.5, physDefAdd: 22 }),
  t2('bannerman', 'guard', 'fighter', 'Bannerman', 'Rallies allies with damage and healing.', { stats: { str: 7, int: 4 }, patience: 6 }, { buffAura: { damageMult: 1.25, radius: 140 }, healAura: { hps: 6, radius: 120 } }),
  // Assassin
  t2('deathdealer', 'assassin', 'rogue', 'Deathdealer', 'Bigger executes, deadly crits.', { stats: { dex: 12, str: 3 } }, { execute: 0.22, critChanceAdd: 0.15, critMultAdd: 0.5 }),
  t2('nightblade', 'assassin', 'rogue', 'Nightblade', 'A blur of executing strikes.', { stats: { dex: 14 } }, { execute: 0.18, rateMult: 1.5 }),
  t2('reaper', 'assassin', 'rogue', 'Reaper', 'Reaps anything close to death.', { stats: { dex: 10, str: 4 } }, { execute: 0.28, damageMult: 1.2 }),
  // Trickster
  t2('saboteur', 'trickster', 'rogue', 'Saboteur', 'One buried charge, and nothing walks over it twice.', { stats: { dex: 10, int: 4 } }, { trap: { dps: 30, slow: 0.35 } }),
  t2('venomancer', 'trickster', 'rogue', 'Venomancer', 'Poisons that rot foes over time.', { stats: { dex: 8, int: 6 } }, { burn: { dps: 18, dur: 4 }, trap: { dps: 12, slow: 0.3 } }),
  t2('hexblade', 'trickster', 'rogue', 'Hexblade', 'Curses that freeze and stun.', { stats: { dex: 9, int: 5 } }, { stunChance: 0.2, stunDur: 0.7, chill: { slow: 0.45, dur: 1.6 } }),
  // Marksman
  t2('sharpshooter', 'marksman', 'rogue', 'Sharpshooter', 'Extreme range, brutal crits.', { stats: { dex: 12, str: 2 } }, { rangeMult: 1.9, critChanceAdd: 0.25, critMultAdd: 0.4 }),
  t2('ranger', 'marksman', 'rogue', 'Ranger', 'Rapid piercing volleys.', { stats: { dex: 14 } }, { pierce: 3, rateMult: 1.35 }),
  t2('arbalest', 'marksman', 'rogue', 'Arbalest', 'Heavy bolts punch through ranks.', { stats: { dex: 9, str: 5 } }, { pierce: 2, damageMult: 1.5 }),
  // Elementalist
  t2('pyromancer', 'elementalist', 'mystic', 'Pyromancer', 'Infernos that spread and burn.', { stats: { int: 12 } }, { burn: { dps: 26, dur: 4 }, splashAdd: 25 }),
  t2('cryomancer', 'elementalist', 'mystic', 'Cryomancer', 'Freezing fields slow everything.', { stats: { int: 10, dex: 3 } }, { chill: { slow: 0.55, dur: 2.5 }, splashAdd: 20 }),
  t2('stormcaller', 'elementalist', 'mystic', 'Stormcaller', 'Lightning arcs between foes.', { stats: { int: 11, dex: 3 } }, { shock: { chains: 3, dmgFrac: 0.6 }, splashAdd: 10 }),
  // Cleric
  // The pure healer has to out-earn a Pyromancer in the same slot, and at 16hps
  // it did not: §2 measured it +4.7% over a mystic damage filler, inside the
  // support sweep's own resolution. It is the one cleric that buys nothing but
  // sustain, so sustain is what had to pay — 16 → 30hps, which is what it costs
  // to actually keep a blocking carrier standing through a depth-9 wave rather
  // than merely slow its death down. Its two siblings sell buff+heal mixes and
  // are comfortably clear of the bar; this one had no second axis to lean on.
  //
  // ---- 30 → 38, and the reason it moved again is structural (m-2) ----------
  //
  // `healAura.hps` is a **flat number**, and it is the only thing this node
  // sells. Every point of gear the game hands out raises the damage filler it is
  // graded against and raises this node not at all, so its §2 margin erodes
  // whenever gear does. Re-basing the two clamped affixes in `items.ts` and
  // paying for it in the Epic/Legendary budgets moved the mystic filler's hold
  // ceiling to ×7.41 while this node stayed at ×8.14 — a margin of ×1.098
  // against the ×1.10 floor, i.e. a failure by one part in a thousand with
  // nothing about the node changed.
  //
  // Measured against the same filler: 30 → ×8.14 (×1.098, fails), 34 → ×8.53
  // (×1.151), 38 → ×8.93 (×1.205), 44 → ×8.93, 52 → ×8.93. It is set at the
  // point where more healing stops buying anything at all, because past there
  // the carrier is dying to something a heal cannot answer — a saturation point
  // is a stabler place to stand than a number fitted to clear the gate.
  t2('radiant', 'cleric', 'mystic', 'Radiant', 'Powerful sustained healing.', { stats: { int: 10, str: 3 }, patience: 5 }, { healAura: { hps: 38, radius: 160 } }),
  t2('templar', 'cleric', 'mystic', 'Templar', 'Empowers the whole line.', { stats: { int: 9, str: 4 } }, { buffAura: { damageMult: 1.35, radius: 150 }, healAura: { hps: 6, radius: 120 } }),
  t2('oracle', 'cleric', 'mystic', 'Oracle', 'A balance of speed, heal, and buff.', { stats: { int: 11 }, patience: 4 }, { buffAura: { damageMult: 1.2, radius: 150 }, healAura: { hps: 10, radius: 150 }, rateMult: 1.15 }),
  // Warlock
  t2('soulflay', 'warlock', 'mystic', 'Soulflay', 'Massive drain and raw power.', { stats: { int: 12, str: 2 } }, { lifedrain: 0.35, selfSacrifice: 0.2, damageMult: 1.4 }),
  t2('plaguebringer', 'warlock', 'mystic', 'Plaguebringer', 'Plague clouds that devour ranks.', { stats: { int: 10, str: 3 } }, { burn: { dps: 22, dur: 5 }, splashAdd: 35, lifedrain: 0.15 }),
  t2('doomcaller', 'warlock', 'mystic', 'Doomcaller', 'Ruinous power at great personal cost.', { stats: { int: 13 } }, { selfSacrifice: 0.3, damageMult: 1.8, execute: 0.15 }),
]

export const ALL_NODES: TreeNode[] = [...TIER0, ...TIER1, ...TIER2]
const NODE_BY_ID = new Map(ALL_NODES.map((n) => [n.id, n]))

export function getNode(id: string): TreeNode {
  const n = NODE_BY_ID.get(id)
  if (!n) throw new Error(`Unknown tree node: ${id}`)
  return n
}

export function childrenOf(id: string): TreeNode[] {
  return ALL_NODES.filter((n) => n.parent === id)
}

export const BASE_ARCHETYPE_NODES = TIER0

/**
 * Best-of, per field — the merge rule for the STATUSES only.
 *
 * This block used to claim best-of was *the* stacking rule, ten lines above a
 * `mergeMods` doc comment stating the real one, and `describe.ts` printed the
 * claim to the player (F11). It is one of three rules: multipliers multiply,
 * flat bonuses sum, and only these structured statuses keep the strongest. See
 * {@link mergeMods} below and `describe.ts`'s `STACKING_RULE`, which now says
 * all three.
 */
const bestOf =<T extends Record<string, number>>(a: T | undefined, b: T | undefined): T | undefined => {
  if (!a) return b
  if (!b) return a
  const out = { ...a } as Record<string, number>
  for (const k of Object.keys(b)) out[k] = Math.max(out[k] ?? -Infinity, (b as Record<string, number>)[k])
  return out as T
}

/**
 * Merge a list of EffectMods into one. Mults multiply, adds sum, and structured
 * statuses take the **best of every field independently**.
 *
 * *Why per-field and not "the strongest object wins" (H2).* The old merge picked
 * one whole object by a single key — `burn` by `dps`, `block` by `count`,
 * `healAura` by `hps` — and silently dropped every other field on the loser. A
 * legendary Flaming weapon rolling 43 dps for 3s therefore **deleted** a Mythic
 * Incendiary mutation's 4s duration, because 43 > 45 was decided on dps alone and
 * the duration came along for the ride. Worse, the engine's own cross-tower rule
 * was already per-field (`applyHit` takes `max` of `burnDps` and, separately,
 * `max` of `burnUntil`; `chill` maxes slow and until independently), so the game
 * ran two different stacking rules and surfaced neither. This is now the single
 * rule, and it is the one the engine already used.
 */
export function mergeMods(list: (EffectMods | undefined)[]): EffectMods {
  const out: EffectMods = {
    damageMult: 1,
    rateMult: 1,
    rangeMult: 1,
    hpMult: 1,
    projSpeedMult: 1,
    physDefAdd: 0,
    splashAdd: 0,
    critChanceAdd: 0,
    critMultAdd: 0,
    pierce: 0,
    thornsMult: 1,
    stunChance: 0,
    stunDur: 0,
    execute: 0,
    lifedrain: 0,
    selfSacrifice: 0,
  }
  for (const m of list) {
    if (!m) continue
    if (m.damageMult != null) out.damageMult! *= m.damageMult
    if (m.rateMult != null) out.rateMult! *= m.rateMult
    if (m.rangeMult != null) out.rangeMult! *= m.rangeMult
    if (m.projSpeedMult != null) out.projSpeedMult! *= m.projSpeedMult
    if (m.hpMult != null) out.hpMult! *= m.hpMult
    if (m.thornsMult != null) out.thornsMult! *= m.thornsMult
    if (m.physDefAdd != null) out.physDefAdd! += m.physDefAdd
    if (m.splashAdd != null) out.splashAdd! += m.splashAdd
    if (m.critChanceAdd != null) out.critChanceAdd! += m.critChanceAdd
    if (m.critMultAdd != null) out.critMultAdd! += m.critMultAdd
    if (m.pierce != null) out.pierce! += m.pierce
    if (m.stunChance != null) out.stunChance! = Math.max(out.stunChance!, m.stunChance)
    if (m.stunDur != null) out.stunDur! = Math.max(out.stunDur!, m.stunDur)
    if (m.execute != null) out.execute! = Math.max(out.execute!, m.execute)
    if (m.lifedrain != null) out.lifedrain! += m.lifedrain
    if (m.selfSacrifice != null) out.selfSacrifice! += m.selfSacrifice
    // A capability, not a magnitude: one source that has it is enough.
    if (m.thornsIgnite) out.thornsIgnite = true
    out.burn = bestOf(out.burn, m.burn)
    out.chill = bestOf(out.chill, m.chill)
    out.shock = bestOf(out.shock, m.shock)
    out.block = bestOf(out.block, m.block)
    out.healAura = bestOf(out.healAura, m.healAura)
    out.buffAura = bestOf(out.buffAura, m.buffAura)
    out.dmgReductionAura = bestOf(out.dmgReductionAura, m.dmgReductionAura)
    out.trap = bestOf(out.trap, m.trap)
  }
  return out
}
