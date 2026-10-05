/**
 * Pure rules around one battle of a run: its combat seed, the XP it pays, and
 * what an Endless round is worth. The settlement that applies them lives in the
 * store's battle slice (`src/state/game/battleSlice.ts`).
 */
import { hashSeed } from '../core/rng'
import { ENEMY_TYPES } from '../data/enemies'
import type { EncounterKind } from '../data/waves'
import { applyXp } from '../engine/leveling'
import type { Sentinel, WaveDef } from '../types'

/**
 * The combat seed for one battle. Deterministic in (run seed, node, wave), so a
 * replayed run replays its fights exactly, while two different nodes never share
 * a roll sequence. The node key is the node's map-local id (`n<layer>-<row>`),
 * never a counter, so the same seed replays the same fights in any session.
 */
export function combatSeed(runSeed: number, nodeKey: string, wave: number): number {
  return hashSeed(runSeed, 'combat', nodeKey, wave)
}

/**
 * ---------------------------------------------------------------------------
 * Levels are a resource, not a clock (Phase 3b)
 * ---------------------------------------------------------------------------
 *
 * The engine pays `0.2 × maxHp + reward` XP per kill, and `maxHp` carries the
 * wave's budget AND the run's Threat — both exponential in depth. So the XP a
 * wave paid grew ~×3 per node while the level curve (`xpToReach`) grows
 * linearly: the review measured a hero at L8 after depth 3, L14 after depth 4
 * and L19 after depth 5, i.e. every level-up decision crammed into two nodes
 * and ~10× overflow for the rest of the run. Depths 1–3 had no build decision
 * in them at all, and the level-20 evolution arrived with the run half over.
 *
 * So the run layer re-prices a cleared wave: it is worth a known amount of
 * level-XP per fielded hero — {@link waveXp}, linear in depth, more for an
 * elite or a boss — scaled by how much of the wave the company actually killed
 * (a leak is XP not earned), and split half evenly (everyone on the field
 * fought) and half by the engine's own kill credit (who did the killing). The
 * engine's raw XP still decides the SHARE; it no longer decides the SIZE.
 *
 * Fitted so a hero fielded in every fight reaches level 5 around depth 2,
 * level 10 at the first act boss (depth 4), level 15 around depth 7 and level
 * 20 around depth 8–9 of 12 — and a route that skips fights for stops levels
 * visibly slower, which is the trade a stop is supposed to be.
 */
export const XP_BASE = 60
export const XP_PER_DEPTH = 55
const XP_KIND: Record<EncounterKind, number> = { normal: 1, elite: 1.4, boss: 1.8 }

/**
 * A stop still drills the company: every hero gains this share of a plain
 * fight's XP for the layer when the company consumes a merchant, shrine,
 * recruit or campfire stop. A fight pays more — the XP is still the price of
 * skipping one — but a stop is no longer a dead loss on the level curve, which
 * made a stop-first route a walk into the act-2 boss two levels short.
 *
 * 0.35 → **0.55** (tuning lane): at 0.35 the first-timer line — the
 * stop-first heuristic REPORT §11 models — won 14% (15.3% at n=600), under its
 * 15–35% band, because it reached act 3 levels short. At 0.55 it wins 20.3%
 * (n=600) while the fight-first lines move ≤2pt: a fight still pays nearly
 * twice a stop's XP, plus its gold and card. §6 has no stops, so it cannot move.
 */
export const STOP_XP_SHARE = 0.55
export const stopXp = (depth: number): number => Math.round(waveXp(depth, 'normal') * STOP_XP_SHARE)

/** Level-XP one fielded hero earns, on average, for clearing a wave at `depth`. */
export const waveXp = (depth: number, kind: EncounterKind): number =>
  (XP_BASE + XP_PER_DEPTH * Math.max(1, depth)) * XP_KIND[kind]

/** The raw XP the engine would pay for killing every body in `wave` at `hpMult`. */
export function waveRawXp(wave: Pick<WaveDef, 'spawns'>, hpMult: number): number {
  let total = 0
  for (const s of wave.spawns) {
    const t = ENEMY_TYPES[s.typeId]
    if (!t) continue
    total += Math.round(Math.round(t.baseHp * s.hpMult * hpMult) * 0.2) + t.reward
  }
  return total
}

/**
 * Re-price a wave's raw XP as level-XP (see the block above). Returns the same
 * rows with `xpGained` replaced; ids and order are kept.
 */
export function levelXpAwards<T extends { id: string; xpGained: number }>(
  perSentinel: readonly T[],
  ctx: { wave: Pick<WaveDef, 'spawns'>; hpMult: number; depth: number; kind: EncounterKind },
): T[] {
  const n = perSentinel.length
  if (!n) return []
  const raw = perSentinel.reduce((a, p) => a + Math.max(0, p.xpGained), 0)
  const possible = waveRawXp(ctx.wave, ctx.hpMult)
  const cleared = possible > 0 ? Math.min(1, raw / possible) : 0
  const pool = waveXp(ctx.depth, ctx.kind) * n * cleared
  return perSentinel.map((p) => {
    const share = raw > 0 ? Math.max(0, p.xpGained) / raw : 1 / n
    return { ...p, xpGained: Math.round(pool * (0.5 / n + 0.5 * share)) }
  })
}

/**
 * The roster after a wave's XP lands, in both modes and both outcomes. A hero
 * that crossed a skill milestone now owes its choice; that is read off the
 * hero itself (`run/skills.pendingMilestone`), so there is no queue to keep.
 */
export function applyBattleXp(
  roster: Sentinel[],
  perSentinel: readonly { id: string; xpGained: number }[],
): { roster: Sentinel[] } {
  const xpById = new Map(perSentinel.map((p) => [p.id, p.xpGained]))
  return { roster: roster.map((s) => applyXp(s, xpById.get(s.id) ?? 0)) }
}

/** What clearing an Endless round pays: every 10th is a boss, every other 5th an elite. */
export function endlessRoundSpoils(round: number): {
  isBoss: boolean
  isElite: boolean
  dustGain: number
  lootCount: number
  luck: number
} {
  const isBoss = round % 10 === 0
  const isElite = !isBoss && round % 5 === 0
  return {
    isBoss,
    isElite,
    dustGain: 5 + (isElite ? 5 : 0) + (isBoss ? 15 : 0),
    lootCount: isBoss ? 3 : isElite ? 2 : 1,
    luck: Math.min(0.45, round * 0.03),
  }
}
