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
}

let idCounter = 0
export const nextId = (prefix = 'e'): string => `${prefix}${(idCounter++).toString(36)}`
