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
const nameCounters: Record<Archetype, number> = { fighter: 0, rogue: 0, mystic: 0 }

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
    attack: { ...node.base! },
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
