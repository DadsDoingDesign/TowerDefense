/**
 * Small deterministic PRNG (mulberry32). Seedable so runs/loot can be reproduced
 * and tested. Falls back to a time-free auto seed derived from a global counter.
 */
export class RNG {
  private state: number

  constructor(seed: number = RNG.autoSeed()) {
    this.state = seed >>> 0
  }

  private static counter = 0x9e3779b9
  static autoSeed(): number {
    // Avoid Date.now()/Math.random() so behaviour is reproducible across resumes.
    RNG.counter = (RNG.counter + 0x6d2b79f5) >>> 0
    return RNG.counter
  }

  /** Float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  chance(p: number): boolean {
    return this.next() < p
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }

  /**
   * The stream's current position, as one uint32. Persisting this alongside the
   * run seed lets a resumed run CONTINUE the stream rather than restart it —
   * without it, a reload would re-deal the loot the run already handed out (C3).
   */
  saveState(): number {
    return this.state >>> 0
  }

  /** Put a stream back at a position captured by {@link saveState}. */
  loadState(state: number): void {
    this.state = state >>> 0
  }
}

let idCounter = 0
export const nextId = (prefix = 'e'): string => `${prefix}${(idCounter++).toString(36)}`

/** Current entity-id counter — persisted so a resumed run never re-issues an id. */
export const idCounterState = (): number => idCounter

/**
 * Fast-forward the id counter past everything a restored run already minted.
 * Only ever moves forward, so it can't collide with ids handed out since boot.
 */
export function restoreIdCounter(n: number): void {
  if (Number.isFinite(n) && n > idCounter) idCounter = Math.floor(n)
}

/**
 * Domain separator between hashed parts (m-1).
 *
 * It MUST stay non-empty. Joining with an empty string made
 * `(seed, 'combat', 'node1', 12)` and `(seed, 'combat', 'node11', 2)` hash the
 * same string, so two different encounters in one run shared a roll sequence.
 * U+0001 cannot occur in a node id, a stream name or a
 * stringified number, so no two distinct part lists can collide through it.
 *
 * Written as an escape on purpose: as a literal control character it is
 * invisible in diffs, reviews and most editors — which is exactly how it gets
 * deleted by accident, silently reintroducing the collision.
 */
const PART_SEP = ''

/**
 * FNV-1a over the stringified parts → a uint32 seed. Used to derive independent
 * per-system streams from one run seed, so a change to (say) cosmetic jitter can
 * never reshuffle combat or loot rolls.
 */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 0x811c9dc5
  const s = parts.join(PART_SEP)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) || 1
}

/**
 * Names of the independent RNG streams derived from a run seed.
 *
 * `field` is the battlefield/encounter-shape stream (WS8): which map a run is
 * fought on and which composition variant each node fields. It is separate from
 * `map` — the run-map DAG — because the two are drawn at different moments and
 * neither may be able to reshuffle the other: switching Banners re-deals the
 * run map from the same seed, and that must not become a battlefield reroll.
 */
export type RngStream = 'combat' | 'loot' | 'map' | 'cosmetic' | 'field'

/** A fresh RNG for one system, deterministic in the run seed and any extra keys. */
export function streamRng(runSeed: number, stream: RngStream, ...extra: (string | number)[]): RNG {
  return new RNG(hashSeed(runSeed, stream, ...extra))
}

/**
 * A fresh, unpredictable run seed. Deliberately uses entropy (unlike
 * {@link RNG.autoSeed}, a process-global counter that re-deals identical loot
 * after a reload) — everything downstream derives from it deterministically, so
 * storing this one number reproduces the whole run.
 */
export function newRunSeed(): number {
  const rand = Math.floor(Math.random() * 0xffffffff)
  const time = typeof performance !== 'undefined' ? Math.floor(performance.now() * 1000) : 0
  return hashSeed(rand, time, Date.now())
}
