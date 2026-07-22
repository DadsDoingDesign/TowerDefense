import type { SpawnEvent, WaveDef } from '../types'

export type EncounterKind = 'normal' | 'elite' | 'boss'

/**
 * Build a wave for a map node at the given depth (layer) and kind. Difficulty
 * scales with depth; elites are denser and tougher; the boss brings a Colossus
 * with an escort.
 */
export function generateEncounter(depth: number, kind: EncounterKind, label?: string): WaveDef {
  if (kind === 'boss') return bossWave(depth, label)

  const eliteBoost = kind === 'elite' ? 1.35 : 1
  const hpMult = (1 + (depth - 1) * 0.22) * eliteBoost
  const gap = kind === 'elite' ? 0.7 : 0.85

  const grunts = 5 + depth * 2 + (kind === 'elite' ? 3 : 0)
  const runners = depth >= 2 ? depth + 1 : 0
  const shades = depth >= 4 ? depth - 3 : 0
  const brutes = (depth >= 3 ? Math.floor((depth - 2) / 2) : 0) + (kind === 'elite' ? 2 : 0)
  const ogres = (depth >= 6 ? Math.floor((depth - 5) / 2) : 0) + (kind === 'elite' && depth >= 4 ? 1 : 0)

  const spawns: SpawnEvent[] = []
  let t = 0
  const push = (typeId: string, count: number, g: number) => {
    for (let i = 0; i < count; i++) {
      spawns.push({ typeId, at: t, hpMult })
      t += g
    }
  }
  push('grunt', grunts, gap)
  if (runners) { t += 1.2; push('runner', runners, gap * 0.7) }
  if (shades) { t += 1.2; push('shade', shades, gap) }
  if (brutes) { t += 1.4; push('brute', brutes, gap * 2) }
  if (ogres) { t += 1.6; push('ogre', ogres, gap * 2.4) }

  spawns.sort((a, b) => a.at - b.at)
  return {
    index: depth,
    label: label ?? (kind === 'elite' ? `Elite — Depth ${depth}` : `Depth ${depth}`),
    spawns,
    isBoss: false,
  }
}

function bossWave(depth: number, label?: string): WaveDef {
  const spawns: SpawnEvent[] = []
  for (let i = 0; i < 16; i++) {
    spawns.push({ typeId: i % 3 === 0 ? 'brute' : i % 2 === 0 ? 'runner' : 'grunt', at: i * 0.6, hpMult: 2.2 })
  }
  spawns.push({ typeId: 'warden', at: 4, hpMult: 1 })
  spawns.push({ typeId: 'colossus', at: 12, hpMult: 1 })
  spawns.sort((a, b) => a.at - b.at)
  return { index: depth, label: label ?? 'The Final Watch', spawns, isBoss: true }
}

/**
 * Endless Watch wave for a given round. Every 10th round is a boss, every 5th an
 * elite; difficulty ramps faster than the campaign (depth = round + 2).
 */
export function generateEndlessWave(round: number): WaveDef {
  const kind: EncounterKind = round % 10 === 0 ? 'boss' : round % 5 === 0 ? 'elite' : 'normal'
  const wave = generateEncounter(round + 2, kind, `Wave ${round}${kind === 'elite' ? ' — Elite' : kind === 'boss' ? ' — Boss' : ''}`)
  return { ...wave, index: round }
}

/** Human-readable composition summary for the pre-wave preview. */
export function waveComposition(wave: WaveDef): { typeId: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const s of wave.spawns) counts.set(s.typeId, (counts.get(s.typeId) ?? 0) + 1)
  return [...counts.entries()].map(([typeId, count]) => ({ typeId, count }))
}
