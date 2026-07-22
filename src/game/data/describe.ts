import type { CoreStats, EffectMods } from '../types'

const pct = (v: number) => `${Math.round(v * 100)}%`
const signPct = (mult: number) => {
  const d = mult - 1
  return `${d >= 0 ? '+' : ''}${Math.round(d * 100)}%`
}

/** Human-readable bullet list for a set of combat mods (branch or gear). */
export function describeMods(m: EffectMods): string[] {
  const out: string[] = []
  if (m.damageMult != null && m.damageMult !== 1) out.push(`${signPct(m.damageMult)} damage`)
  if (m.rateMult != null && m.rateMult !== 1) out.push(`${signPct(m.rateMult)} attack speed`)
  if (m.rangeMult != null && m.rangeMult !== 1) out.push(`${signPct(m.rangeMult)} range`)
  if (m.hpMult != null && m.hpMult !== 1) out.push(`${signPct(m.hpMult)} HP`)
  if (m.critChanceAdd) out.push(`+${pct(m.critChanceAdd)} crit chance`)
  if (m.critMultAdd) out.push(`+${pct(m.critMultAdd)} crit damage`)
  if (m.splashAdd) out.push(`+${m.splashAdd} splash radius`)
  if (m.pierce) out.push(`pierces ${m.pierce} extra ${m.pierce === 1 ? 'enemy' : 'enemies'}`)
  if (m.execute) out.push(`executes below ${pct(m.execute)} HP`)
  if (m.burn) out.push(`burns ${Math.round(m.burn.dps)}/s for ${m.burn.dur}s`)
  if (m.chill) out.push(`chills ${pct(m.chill.slow)} for ${m.chill.dur}s`)
  if (m.shock) out.push(`chains to ${m.shock.chains} for ${pct(m.shock.dmgFrac)}`)
  if (m.stunChance) out.push(`${pct(m.stunChance)} to stun ${m.stunDur ?? 0.5}s`)
  if (m.block) out.push(`blocks ${m.block.count} enemies`)
  if (m.thornsMult && m.thornsMult !== 1) out.push(`${signPct(m.thornsMult)} thorns`)
  if (m.healAura) out.push(`heals allies ${Math.round(m.healAura.hps)}/s`)
  if (m.buffAura) out.push(`buffs allies ${signPct(m.buffAura.damageMult)} dmg`)
  if (m.dmgReductionAura) out.push(`shields allies ${pct(m.dmgReductionAura.reduction)}`)
  if (m.lifedrain) out.push(`life-drain ${pct(m.lifedrain)} to base`)
  if (m.selfSacrifice) out.push(`sacrifices ${pct(m.selfSacrifice)} HP for power`)
  if (m.trap) out.push(`lays traps (${Math.round(m.trap.dps)}/s)`)
  return out
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
