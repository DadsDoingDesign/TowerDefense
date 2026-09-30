import { ENEMY_TYPES } from '../../game/data/enemies'
import type { WaveDef } from '../../game/types'

/**
 * ---------------------------------------------------------------------------
 * Who is still coming (G2-2) — the wave strip's enemy queue, as data.
 * ---------------------------------------------------------------------------
 *
 * The wave strip's progress bar said how FAR through a wave you were and
 * nothing about WHAT was left. The line-up was one tap away in setup (the
 * composition panel) and nowhere at all once the wave went live, because the
 * live layout collapses that panel. This is the queue that replaces the bar.
 *
 * `spawnOrder` is the engine's own spawn order, restated: `GameEngine` builds
 * `spawnQueue` by normalising the spawns' groups to 0..n-1 and sorting stably
 * by (group, at), and `hud.enemiesSpawned` is the index into exactly that
 * list. So `spawnOrder(wave).slice(hud.enemiesSpawned)` is precisely the
 * bodies the engine has not spawned yet — the preview cannot drift from the
 * fight without `tests/enemyQueue.test.ts`, which drives the real engine,
 * failing first. (Restated rather than read off the engine so setup, which has
 * no engine, uses the same derivation — the same reason `encounterPreview.ts`
 * restates the store.)
 */
export interface QueuedSpawn {
  typeId: string
  /** The sub-wave it belongs to, normalised to 0..n-1 as the engine does. */
  group: number
}

export function spawnOrder(wave: WaveDef | null | undefined): QueuedSpawn[] {
  if (!wave) return []
  const groups = [...new Set(wave.spawns.map((s) => s.group ?? 0))].sort((a, b) => a - b)
  const gIndex = new Map(groups.map((g, i) => [g, i]))
  return wave.spawns
    .map((s) => ({ typeId: s.typeId, group: gIndex.get(s.group ?? 0)!, at: s.at }))
    .sort((a, b) => a.group - b.group || a.at - b.at)
    .map(({ typeId, group }) => ({ typeId, group }))
}

/** One chip of the strip: a kind of enemy and how many of it are queued. */
export interface LineUpEntry {
  /** Registry key — `torch3`, `barrel3_plated`, `torch3_shaman`. */
  typeId: string
  /** The art identity (`ENEMY_TYPES[key].id`): an elite or a specialist is drawn as its base goblin. */
  art: string
  name: string
  count: number
  boss: boolean
}

/**
 * Group a queue by kind, in order of FIRST arrival — so the first chip is
 * always the next body through the gate, and a kind drops off the front once
 * its last body has spawned.
 */
export function lineUp(queue: readonly QueuedSpawn[]): LineUpEntry[] {
  const out = new Map<string, LineUpEntry>()
  for (const { typeId } of queue) {
    const hit = out.get(typeId)
    if (hit) {
      hit.count++
      continue
    }
    const t = ENEMY_TYPES[typeId]
    // A key this build has no entry for is skipped by the engine too
    // (`spawnDue`), so it is not "coming" and gets no chip.
    if (!t) continue
    out.set(typeId, { typeId, art: t.id, name: t.name, count: 1, boss: !!t.isBoss })
  }
  return [...out.values()]
}

/** The moments the strip changes for (see `WaveBar`). */
export type StripMoment = 'setup' | 'live' | 'held'

/**
 * What the strip lists in each moment:
 *
 *  - setup — the whole wave;
 *  - live  — everything not yet spawned, across the sub-waves still to come;
 *  - held  — the NEXT sub-wave only: the breather's one move is made against
 *            it, and `hud.subWave` is already that group's index here (the
 *            engine increments it on entering the breather).
 */
export function queueFor(
  wave: WaveDef | null | undefined,
  moment: StripMoment,
  hud: { enemiesSpawned: number; subWave: number },
): QueuedSpawn[] {
  const order = spawnOrder(wave)
  if (moment === 'setup') return order
  const rest = order.slice(Math.max(0, hud.enemiesSpawned))
  return moment === 'held' ? rest.filter((s) => s.group === hud.subWave) : rest
}

/**
 * "Torch Goblin ×3, Bomber ×1" — the queue in words, for its accessible name.
 * Every kind, not just the chips that fit. `×n` rather than a plural: the
 * names include "Warlord Grukk" and "Barrel Imp · Plated", which no suffix
 * rule pluralises, and the composition panel already counts in `×n`.
 */
export function lineUpWords(entries: readonly LineUpEntry[]): string {
  return entries.map((e) => `${e.name} ×${e.count}`).join(', ')
}

/** A queue portrait's box, in CSS px — `--icon-md`, a whole multiple of 16. */
export const QUEUE_CHIP = 32
const GAP = 4
/** The "+N" tail's reserved width. */
const MORE = 24
/** The designer's default: at most three kinds, then "+N" for the rest. */
const MAX_KINDS = 3

/**
 * How many portraits fit in `w` px when there are `n` kinds to show — measured
 * off the queue's real width, so a 320px phone shows fewer rather than
 * clipping one, and a "+N" is always left room when anything is left out.
 */
export function chipsThatFit(w: number, n: number): number {
  for (let k = Math.min(n, MAX_KINDS); k >= 1; k--) {
    const need = k * QUEUE_CHIP + (k - 1) * GAP + (n > k ? GAP + MORE : 0)
    if (need <= w) return k
  }
  return 0
}
