import { nextId } from '../core/rng'
import { BASE_ARCHETYPE_NODES, getNode } from './archetypeTree'
import type { Archetype, Equipment, Sentinel } from '../types'

/** Lightweight archetype metadata for the UI, derived from the tier-0 tree nodes. */
export const ARCHETYPES: Record<Archetype, { name: string; blurb: string; color: string; accent: string }> =
  Object.fromEntries(
    BASE_ARCHETYPE_NODES.map((n) => [
      n.archetype,
      { name: n.name, blurb: n.blurb, color: n.color!, accent: n.accent! },
    ]),
  ) as Record<Archetype, { name: string; blurb: string; color: string; accent: string }>

const NAME_POOLS: Record<Archetype, string[]> = {
  fighter: ['Bran', 'Doyle', 'Marek', 'Ossa', 'Torv', 'Grael', 'Hthe', 'Rook'],
  rogue: ['Vesper', 'Quill', 'Sable', 'Nyx', 'Wren', 'Fenn', 'Dask', 'Lyre'],
  mystic: ['Aldre', 'Sorrel', 'Ipha', 'Cael', 'Mireth', 'Yavn', 'Esk', 'Orla'],
}
export type NameCounters = Record<Archetype, number>

/**
 * How many names each archetype pool has handed out. A process-global, like the
 * entity-id counter — so it resets on reload, and a Sentinel recruited after a
 * resume used to be handed a name already worn by someone on the roster. It
 * rides in the run snapshot for exactly that reason (m-4).
 */
const nameCounters: NameCounters = { fighter: 0, rogue: 0, mystic: 0 }

/** The counters as they stand, for the run snapshot. */
export const nameCounterState = (): NameCounters => ({ ...nameCounters })

/**
 * Fast-forward the counters past every name a restored run already issued. Only
 * ever moves forward, so it cannot collide with names handed out since boot.
 */
export function restoreNameCounters(counters: Partial<NameCounters> | null | undefined): void {
  if (!counters) return
  for (const key of Object.keys(nameCounters) as Archetype[]) {
    const n = counters[key]
    if (typeof n === 'number' && Number.isFinite(n) && n > nameCounters[key]) {
      nameCounters[key] = Math.floor(n)
    }
  }
}

function emptyEquipment(): Equipment {
  return { mainHand: null, offHand: null, body: null }
}

/** Create a fresh level-1 Sentinel of the given archetype. */
export function createSentinel(archetype: Archetype): Sentinel {
  const node = getNode(archetype)
  const pool = NAME_POOLS[archetype]
  const name = pool[nameCounters[archetype] % pool.length]
  nameCounters[archetype]++
  return {
    id: nextId('sent'),
    name,
    archetype,
    branchPath: [archetype],
    stats: { ...node.baseStats! },
    thorns: node.baseThorns!,
    patience: node.basePatience!,
    level: 1,
    xp: 0,
    equipment: emptyEquipment(),
    color: node.color!,
    accent: node.accent!,
  }
}

/** The player's opening roster: one of each archetype. */
export function startingRoster(): Sentinel[] {
  return [createSentinel('fighter'), createSentinel('rogue'), createSentinel('mystic')]
}
