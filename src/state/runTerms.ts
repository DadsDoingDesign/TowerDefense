/**
 * The terms of the run being set up on hero-pick: what its seed is and whether
 * it can be changed.
 *
 * One pure table, read by BOTH the store (which enforces it) and the hero-pick
 * seed chip (which says it), so the screen cannot offer what the store refuses.
 * The stake is chosen before the hero pick now (the contract board), so the
 * difficulty is no longer a hero-pick term.
 */
import type { RunChallenge, RunKind } from './seeds'

/** Any contract's seed can be typed over on the hero pick (the old Daily's could not). */
export const seedEditable = (_c: RunChallenge): boolean => true

export interface RunTerms {
  kind: RunKind
  /** The seed control's visible text: "Seed 93200335", "Custom seed 424242". */
  seedLabel: string
  /** The seed control's accessible name — the visible text plus what pressing it does. */
  seedName: string
  /** Whether the seed can be typed over. */
  editable: boolean
  /**
   * The run's terms in plain sentences, or empty for an ordinary contract
   * (which needs none). The first line is the one that matters most.
   */
  lines: string[]
}

export function runTerms(c: RunChallenge, seed: number): RunTerms {
  if (c.kind === 'seeded') {
    return {
      kind: c.kind,
      seedLabel: `Custom seed ${seed}`,
      seedName: `Custom seed ${seed}. Change the seed`,
      editable: true,
      lines: ['Custom seed · pays its gold.', 'It earns no standing and unlocks nothing.'],
    }
  }
  return {
    kind: c.kind,
    seedLabel: `Seed ${seed}`,
    seedName: `Seed ${seed}, random. Play a set seed instead`,
    editable: true,
    lines: [],
  }
}
