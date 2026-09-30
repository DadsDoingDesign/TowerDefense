import { BEHAVIOUR_INFO } from '../../game/data/behaviours'
import { ENEMY_MODS, ENEMY_TYPES, leakCeiling } from '../../game/data/enemies'
import type { Knowledge } from '../../game/data/enemyKnowledge'
import type { WaveDef } from '../../game/types'

/**
 * Q10 — the enemy info card's contents, as data (the card itself is
 * `EnemyCard.tsx`). Every number is read off `ENEMY_TYPES` and the wave the
 * player is actually facing; what the Watch has not learned yet
 * (`knowledgeOf`) comes back as `null`, which the card prints as "?".
 */

/** How a pace reads in words — the bands are the roster's own spread (74–146). */
export function paceWord(speed: number): string {
  return speed >= 120 ? 'Fast' : speed >= 90 ? 'Steady' : 'Slow'
}

export interface EnemyCardData {
  name: string
  boss: boolean
  level: Knowledge['level']
  felled: number
  need: number
  /**
   * HP of one of these in THIS wave — `baseHp × the spawn's hpMult × the
   * battle's HP multiplier` (Threat, the node, the Banner), the exact number
   * the engine gives it. `[lo, hi]` when the sub-waves field it at different
   * strengths. Null until met.
   */
  hp: [number, number] | null
  /** "Fast" / "Steady" / "Slow", and the unhindered crossing time of this lane. Null until met. */
  pace: { word: string; seconds: number | null } | null
  /** Armour — always shown: every wave's scouting report prints it. Empty = none. */
  armour: string[]
  /** An elite's modifier sentence, if it wears one (also on the scouting report). */
  mod: string | null
  /** What it does and how to beat it. `[]` = nothing special; null until known. */
  tricks: { label: string; counter: string }[] | null
  /** Base HP it costs if it gets through (a splitter's pieces included). Null until known. */
  gate: number | null
}

export function enemyCardData(
  key: string,
  ctx: { wave: WaveDef | null | undefined; hpMult: number; laneLength: number; knowledge: Knowledge },
): EnemyCardData | null {
  const t = ENEMY_TYPES[key]
  if (!t) return null
  const k = ctx.knowledge
  const met = k.level !== 'new'
  const known = k.level === 'known'

  let hp: [number, number] | null = null
  if (met) {
    const mults = (ctx.wave?.spawns ?? []).filter((s) => s.typeId === key).map((s) => s.hpMult)
    // The engine's own rounding (`spawnDue`).
    const vals = (mults.length ? mults : [1]).map((m) => Math.round(t.baseHp * m * ctx.hpMult))
    hp = [Math.min(...vals), Math.max(...vals)]
  }

  const armour: string[] = []
  if (t.physResist) armour.push(`Physical ${Math.round(t.physResist * 100)}%`)
  if (t.magResist) armour.push(`Magic ${Math.round(t.magResist * 100)}%`)
  const mod = ENEMY_MODS.find((m) => key.endsWith(`_${m.id}`))

  return {
    name: t.name,
    boss: !!t.isBoss,
    level: k.level,
    felled: k.felled,
    need: k.need,
    hp,
    pace: met
      ? { word: paceWord(t.speed), seconds: ctx.laneLength > 0 ? Math.round(ctx.laneLength / t.speed) : null }
      : null,
    armour,
    mod: mod ? mod.blurb : null,
    tricks: known ? (t.behaviours ?? []).map((b) => ({ label: BEHAVIOUR_INFO[b.kind].label, counter: BEHAVIOUR_INFO[b.kind].counter })) : null,
    gate: known ? leakCeiling(key) : null,
  }
}

/** The card's last line: how much more fighting the "?"s cost. */
export function learnLine(d: Pick<EnemyCardData, 'level' | 'felled' | 'need'>): string {
  if (d.level === 'new') return 'Not met yet — face one to learn its size and pace.'
  if (d.level === 'met') {
    const left = d.need - d.felled
    return `Felled ${d.felled}. Fell ${left} more to learn its tricks.`
  }
  return `Felled ${d.felled}.`
}
