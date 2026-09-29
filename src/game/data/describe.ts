import type { CoreStats, EffectMods, Enchantment } from '../types'

const pct = (v: number) => `${Math.round(v * 100)}%`
/** One decimal, trailing ".0" trimmed — for small per-100 style numbers. */
const num1 = (v: number) => v.toFixed(1).replace(/\.0$/, '')
/**
 * Life-drain restores `damage × lifedrain × 0.02` base HP (engine.ts
 * LIFEDRAIN_SCALE). Quote it per 100 damage so the number is legible at the
 * 0.1–0.5 values the game actually rolls, instead of rounding to "0%" (H5).
 */
const lifedrainPer100 = (lifedrain: number) => num1(lifedrain * 0.02 * 100)
const signPct = (mult: number) => {
  const d = mult - 1
  return `${d >= 0 ? '+' : ''}${Math.round(d * 100)}%`
}

/**
 * What actually happens when two sources give the same effect (H2 / F11).
 *
 * ---- this string used to be false ---------------------------------------
 *
 * It read *"Two sources of the same effect don't add up — you keep the best of
 * each number."* `mergeMods` (`archetypeTree.ts`) does three different things,
 * and best-of is the smallest of the three:
 *
 *  - **multiplies** `damageMult`, `rateMult`, `rangeMult`, `projSpeedMult`,
 *    `hpMult`, `thornsMult`;
 *  - **sums** `physDefAdd`, `splashAdd`, `critChanceAdd`, `critMultAdd`,
 *    `pierce`, `lifedrain`, `selfSacrifice`;
 *  - **takes the best**, per field, only for `stunChance`, `stunDur`, `execute`
 *    and the structured statuses (burn / chill / shock / block / the auras /
 *    trap).
 *
 * The cost of the lie was not cosmetic, and it fell on exactly the decision the
 * line exists to inform. Close Quarters (+22% team damage) then Whetstone Pact
 * (+20% rate, −10% damage) promised +22% damage and delivers 1.22 × 0.90 =
 * **+9.8%** — less than half. Onslaught L1+L2+L3 merges to 1.15 × 1.28 × 1.5 =
 * **+121% damage**, printed on the same panel as "you keep the best of each
 * number". And it hid real synergies too: two +14% crit sources give 28%, and a
 * player who believed the rule would never take the second.
 *
 * The rule below states all three behaviours in the order a player meets them,
 * grouped by the wording they see on the card rather than by the field name:
 * anything that reads as a ± percentage OF the hero (damage, attack speed,
 * range, HP) multiplies; anything that reads as a flat bonus added to a pool
 * (crit, splash, pierce, armour, life-drain) adds; a repeated status is the
 * only case where the strongest simply wins.
 */
export const STACKING_RULE =
  '±% damage, attack speed, range and HP multiply together. Crit, splash, pierce, armour and life-drain add up. ' +
  'Burn, chill, stun, chains, blocks and auras keep the strongest — a second copy of one adds nothing.'

/**
 * The same rule as three bullets, for a surface with room to breathe.
 *
 * `STACKING_RULE` is the drop-in one-liner every current caller renders; this is
 * the same content split where it naturally splits, so a panel that can afford
 * three short lines reads better without either version being able to drift
 * from the other's meaning.
 */
export const STACKING_RULES: readonly string[] = [
  'Multiplies: ±% damage, attack speed, range, HP, thorns.',
  'Adds up: crit chance and damage, splash, pierce, armour, life-drain.',
  'Strongest wins: burn, chill, stun, chains, blocks, auras, traps.',
]

/** Human-readable bullet list for a set of combat mods (branch or gear). */
export function describeMods(m: EffectMods): string[] {
  const out: string[] = []
  if (m.damageMult != null && m.damageMult !== 1) out.push(`${signPct(m.damageMult)} damage`)
  if (m.rateMult != null && m.rateMult !== 1) out.push(`${signPct(m.rateMult)} attack speed`)
  if (m.rangeMult != null && m.rangeMult !== 1) out.push(`${signPct(m.rangeMult)} range`)
  if (m.projSpeedMult != null && m.projSpeedMult !== 1) out.push(`${signPct(m.projSpeedMult)} projectile speed`)
  if (m.hpMult != null && m.hpMult !== 1) out.push(`${signPct(m.hpMult)} HP`)
  // `physDefAdd` was merged, applied, and described NOWHERE (F11) — the mirror
  // of a tooltip claiming an effect that does not exist. It is real armour:
  // `computeCombat` puts it in `profile.physDef` and the engine mitigates the
  // melee a blocking Sentinel takes by `50 / (50 + physDef)`. Quoted as the
  // reduction the player actually gets, since the raw number means nothing.
  if (m.physDefAdd) {
    const cut = Math.round((m.physDefAdd / (50 + m.physDefAdd)) * 100)
    out.push(`−${cut}% melee damage taken while blocking`)
  }
  // A crit penalty at or past −100% can only ever land on zero (computeCombat
  // clamps crit to [0, 0.95]), so say what actually happens instead of printing
  // a percentage the engine will never apply. `cx_vengeful` is priced on this.
  if (m.critChanceAdd != null && m.critChanceAdd <= -1) out.push('never crits')
  else if (m.critChanceAdd) out.push(`${m.critChanceAdd >= 0 ? '+' : ''}${pct(m.critChanceAdd)} crit chance`)
  if (m.critMultAdd) out.push(`${m.critMultAdd >= 0 ? '+' : ''}${pct(m.critMultAdd)} crit damage`)
  if (m.splashAdd) out.push(`${m.splashAdd >= 0 ? '+' : ''}${m.splashAdd} splash radius`)
  if (m.pierce) out.push(`pierces ${m.pierce} extra ${m.pierce === 1 ? 'enemy' : 'enemies'}`)
  if (m.execute) out.push(`executes below ${pct(m.execute)} HP`)
  if (m.burn) out.push(`burns ${Math.round(m.burn.dps)}/s for ${m.burn.dur}s`)
  // Only meaningful alongside a burn, and it changes WHO burns rather than by
  // how much — so it is its own line rather than a qualifier smuggled into the
  // one above (C2).
  if (m.thornsIgnite && m.burn) out.push('thorns set every blocked enemy alight')
  if (m.chill) out.push(`chills ${pct(m.chill.slow)} for ${m.chill.dur}s`)
  if (m.shock) out.push(`chains to ${m.shock.chains} for ${pct(m.shock.dmgFrac)}`)
  if (m.stunChance) out.push(`${pct(m.stunChance)} to stun ${m.stunDur ?? 0.5}s`)
  if (m.block) out.push(`blocks ${m.block.count} enemies`)
  if (m.thornsMult && m.thornsMult !== 1) out.push(`${signPct(m.thornsMult)} thorns`)
  if (m.healAura) out.push(`heals allies ${Math.round(m.healAura.hps)}/s`)
  if (m.buffAura) out.push(`buffs allies ${signPct(m.buffAura.damageMult)} dmg`)
  if (m.dmgReductionAura) out.push(`shields allies ${pct(m.dmgReductionAura.reduction)}`)
  if (m.lifedrain) out.push(`life-drain: +${lifedrainPer100(m.lifedrain)} base HP per 100 damage`)
  // Both halves, because the effect has two (F11). `computeCombat` turns
  // `selfSacrifice` into BOTH `startMissingFrac` (the Sentinel deploys at that
  // much less HP) and a `1 + selfSacrifice` multiplier on its damage. The old
  // line named only the cost — "sacrifices 30% HP for power" — so the tooltip
  // priced a downside and left the upside to be guessed at.
  if (m.selfSacrifice) out.push(`starts at ${pct(m.selfSacrifice)} less HP for +${pct(m.selfSacrifice)} damage`)
  // Both numbers, and the honest count. `trap.slow` was merged, applied by
  // `engine.updateTraps` and described nowhere — the same defect as the
  // undescribed `physDefAdd` above. And "traps", plural, was wrong: the engine
  // lays exactly ONE trap per Sentinel, in the constructor, at the path point
  // nearest its slot, and never moves it (`engine.ts`, `TRAP_RADIUS`), while
  // `mergeMods` takes the best-of so a second trap source still yields one.
  if (m.trap) {
    const slow = m.trap.slow ? `, slows ${pct(m.trap.slow)}` : ''
    out.push(`one hazard on the path beside it: ${Math.round(m.trap.dps)}/s${slow}`)
  }
  return out
}

/** One-line effect summary for an enchantment (label + what it does). */
export function describeEnchant(e: Enchantment): string {
  const parts: string[] = []
  if (e.stats?.str) parts.push(`+${e.stats.str} STR`)
  if (e.stats?.dex) parts.push(`+${e.stats.dex} DEX`)
  if (e.stats?.int) parts.push(`+${e.stats.int} INT`)
  if (e.thorns) parts.push(`+${e.thorns} Thorns`)
  if (e.patience) parts.push(`+${e.patience} Patience`)
  if (e.mods) parts.push(...describeMods(e.mods))
  return parts.join(', ')
}

/** Short stat-grant summary, e.g. "+8 STR +3 DEX +3 Patience". */
export function describeGrant(grant: {
  stats?: Partial<CoreStats>
  thorns?: number
  patience?: number
}): string {
  const parts: string[] = []
  if (grant.stats?.str) parts.push(`+${grant.stats.str} STR`)
  if (grant.stats?.dex) parts.push(`+${grant.stats.dex} DEX`)
  if (grant.stats?.int) parts.push(`+${grant.stats.int} INT`)
  if (grant.thorns) parts.push(`+${grant.thorns} Thorns`)
  if (grant.patience) parts.push(`+${grant.patience} Patience`)
  return parts.join('  ')
}
