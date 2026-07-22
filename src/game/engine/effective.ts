import { clamp } from '../core/vec'
import type { AttackProfile, Sentinel } from '../types'

/** Attack values after folding in the sentinel's core stats. */
export interface EffectiveAttack extends AttackProfile {
  dps: number
}

/**
 * Derive combat numbers from base attack + core stats. Keeps archetype stat
 * leans meaningful: STR/INT scale damage by type, DEX scales rate and crit.
 * Gear (M3) and Patience (M2) will hook in here later.
 */
export function computeEffectiveAttack(s: Sentinel): EffectiveAttack {
  const a = s.attack
  const st = s.stats
  const isPhys = a.damageType === 'physical'
  const dmgStat = isPhys ? st.str : st.int
  const damage = a.damage * (1 + dmgStat * 0.04)
  const rate = a.rate * (1 + st.dex * 0.02)
  const critChance = clamp(a.critChance + st.dex * 0.004, 0, 0.9)
  const avgCrit = 1 + critChance * (a.critMult - 1)
  return {
    ...a,
    damage,
    rate,
    critChance,
    dps: damage * rate * avgCrit,
  }
}
