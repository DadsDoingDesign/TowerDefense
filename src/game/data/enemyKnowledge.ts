import { ENEMY_MODS, ENEMY_TYPES } from './enemies'

/**
 * ---------------------------------------------------------------------------
 * Q10 — what the Watch KNOWS about an enemy, from having fought it.
 * ---------------------------------------------------------------------------
 *
 * The wave strip's portraits open a small card about the enemy (see
 * `ui/shell/EnemyCard.tsx`). The card only says what the player has learned
 * the honest way — by facing and felling the thing — and shows "?" for the
 * rest. The rule is three steps, read off two facts the meta save keeps:
 *
 *  - **new**   — never faced. Name and picture only (plus whatever the wave's
 *                scouting report already prints for every wave: armour and an
 *                elite's modifier — hiding those on the card would contradict
 *                the composition panel one band up).
 *  - **met**   — faced in at least one wave (`Codex.enemies`, recorded when a
 *                wave starts) or felled at least once. Adds the basics you can
 *                SEE from the wall: its HP and its pace.
 *  - **known** — felled {@link STUDY_KILLS} of them ({@link STUDY_KILLS_BOSS} for
 *                a champion — you rarely meet one twice). Adds what it DOES
 *                (its behaviour and the counter to it) and what it costs the
 *                Gate if it gets through.
 *
 * **Kind, not key.** Knowledge is keyed by the enemy with its elite modifier
 * stripped (`barrel3_plated` → `barrel3`), because a modifier is disclosed on
 * every wave's scouting report anyway and a Plated Ironbarrel is still an
 * Ironbarrel. A specialist (`torch3_shaman`) is its own kind: a shaman does a
 * different job from the raider it was carved out of.
 */

export type KnowledgeLevel = 'new' | 'met' | 'known'

/** Felled this many of a rank-and-file kind to know it in full. */
export const STUDY_KILLS = 5
/** …and this many of a champion. */
export const STUDY_KILLS_BOSS = 1

const MOD_SUFFIXES = ENEMY_MODS.map((m) => `_${m.id}`)

/** The knowledge kind of a registry key: the key without its elite modifier. */
export function enemyKind(key: string): string {
  for (const s of MOD_SUFFIXES) if (key.endsWith(s)) return key.slice(0, -s.length)
  return key
}

/** The two facts the rule reads — a `Codex`'s shape, without importing the store. */
export interface KnowledgeFacts {
  /** Registry keys met in a wave (modded keys included). */
  enemies: readonly string[]
  /** Felled count by KIND (see {@link enemyKind}). */
  felled: Readonly<Record<string, number>>
}

export interface Knowledge {
  level: KnowledgeLevel
  kind: string
  felled: number
  /** Kills that make it `known`. */
  need: number
}

/**
 * The rule. `live` is the running wave's side of it, which the meta save does
 * not have yet:
 *
 *  - `felled` — the wave's own kills of this kind (the tally is only written
 *    when a wave settles, and a card opened mid-wave should count the bodies
 *    already on the ground);
 *  - `notYetSeen` — this wave is the kind's FIRST (the Codex notes a wave's
 *    whole line-up the moment it starts) and not one has spawned yet. Until
 *    one walks out, the Codex sighting is a promise, not a meeting.
 */
export function knowledgeOf(
  key: string,
  facts: KnowledgeFacts,
  live: { felled?: number; notYetSeen?: boolean } = {},
): Knowledge {
  const kind = enemyKind(key)
  const felled = Math.max(0, Math.floor(facts.felled[kind] ?? 0)) + Math.max(0, Math.floor(live.felled ?? 0))
  const need = ENEMY_TYPES[kind]?.isBoss ? STUDY_KILLS_BOSS : STUDY_KILLS
  const met = felled > 0 || (!live.notYetSeen && facts.enemies.some((k) => enemyKind(k) === kind))
  return { level: felled >= need ? 'known' : met ? 'met' : 'new', kind, felled, need }
}

/**
 * Fold one wave's kills-by-key into the running tally, by kind. Unknown keys
 * (a build that no longer has the enemy) and non-positive counts are dropped.
 */
export function addFelled(
  cur: Readonly<Record<string, number>>,
  byKey: Iterable<readonly [string, number]>,
): Record<string, number> | null {
  let next: Record<string, number> | null = null
  for (const [key, n] of byKey) {
    const kind = enemyKind(key)
    const add = Math.floor(n)
    if (!ENEMY_TYPES[kind] || !(add > 0)) continue
    next ??= { ...cur }
    next[kind] = Math.min(FELLED_CAP, (next[kind] ?? 0) + add)
  }
  return next
}

/** A tally this high is a corrupt save, not a player; keeps the number printable. */
export const FELLED_CAP = 9_999_999

/** Validate a stored tally (meta migration): known kinds, whole non-negative counts. */
export function sanitizeFelled(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (enemyKind(k) !== k || !ENEMY_TYPES[k]) continue
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 1) continue
    out[k] = Math.min(FELLED_CAP, Math.floor(v))
  }
  return out
}
