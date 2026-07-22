import { nextId } from '../core/rng'
import type { Archetype, Sentinel } from '../types'

interface ArchetypeTemplate {
  archetype: Archetype
  name: string
  blurb: string
  color: string
  accent: string
  stats: Sentinel['stats']
  attack: Sentinel['attack']
}

/**
 * Base archetype templates. Each has a natural stat lean and a distinct attack
 * feel so the three read differently even before the M2 branching tree exists.
 */
export const ARCHETYPES: Record<Archetype, ArchetypeTemplate> = {
  fighter: {
    archetype: 'fighter',
    name: 'Fighter',
    blurb: 'Frontline bruiser. Short reach, heavy hits, holds the line.',
    color: '#d9743f',
    accent: '#f0a868',
    stats: { str: 12, dex: 6, int: 3 },
    attack: {
      damage: 26,
      range: 96,
      rate: 0.95,
      projectileSpeed: 560,
      splashRadius: 0,
      critChance: 0.05,
      critMult: 1.5,
      damageType: 'physical',
    },
  },
  rogue: {
    archetype: 'rogue',
    name: 'Rogue',
    blurb: 'Single-target burst. Fast strikes, high crit, long reach.',
    color: '#4fae72',
    accent: '#88e0a8',
    stats: { str: 6, dex: 12, int: 4 },
    attack: {
      damage: 14,
      range: 168,
      rate: 2.1,
      projectileSpeed: 760,
      splashRadius: 0,
      critChance: 0.28,
      critMult: 2.0,
      damageType: 'physical',
    },
  },
  mystic: {
    archetype: 'mystic',
    name: 'Mystic',
    blurb: 'Area control. Slower cast, splashes elemental damage on impact.',
    color: '#5b8cd6',
    accent: '#9ec1f0',
    stats: { str: 4, dex: 5, int: 13 },
    attack: {
      damage: 16,
      range: 150,
      rate: 0.8,
      projectileSpeed: 480,
      splashRadius: 58,
      critChance: 0.05,
      critMult: 1.5,
      damageType: 'magic',
    },
  },
}

let nameCounters: Record<Archetype, number> = { fighter: 0, rogue: 0, mystic: 0 }

const NAME_POOLS: Record<Archetype, string[]> = {
  fighter: ['Bran', 'Doyle', 'Marek', 'Ossa', 'Torv'],
  rogue: ['Vesper', 'Quill', 'Sable', 'Nyx', 'Wren'],
  mystic: ['Aldre', 'Sorrel', 'Ipha', 'Cael', 'Mireth'],
}

/** Create a fresh sentinel of the given archetype (level 1, no gear). */
export function createSentinel(archetype: Archetype): Sentinel {
  const t = ARCHETYPES[archetype]
  const pool = NAME_POOLS[archetype]
  const name = pool[nameCounters[archetype] % pool.length]
  nameCounters[archetype]++
  return {
    id: nextId('sent'),
    name,
    archetype,
    stats: { ...t.stats },
    attack: { ...t.attack },
    level: 1,
    xp: 0,
    color: t.color,
    accent: t.accent,
  }
}

/** The player's opening roster for M1: one of each archetype. */
export function startingRoster(): Sentinel[] {
  return [createSentinel('fighter'), createSentinel('rogue'), createSentinel('mystic')]
}
