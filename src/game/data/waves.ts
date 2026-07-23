import type { SpawnEvent, WaveDef } from '../types'

export type EncounterKind = 'normal' | 'elite' | 'boss'

const clampTier = (n: number) => Math.max(1, Math.min(4, n))

/**
 * Build a wave for a map node at the given depth (layer) and kind. Difficulty
 * scales with depth in two ways: more goblins per wave, and higher-tier goblins
 * (torch/tnt/barrel 1→4). Elites are denser and one tier tougher; the boss
 * brings two tier-5 champions with an escort.
 */
export function generateEncounter(depth: number, kind: EncounterKind, label?: string): WaveDef {
  if (kind === 'boss') return bossWave(depth, label)

  const eliteBoost = kind === 'elite' ? 1.4 : 1
  // Depth HP curve — steepened after the P1–P4 power gains (dead item slots
  // became live offense, plus the tower upgrade tree) to keep the band honest.
  const hpMult = (1 + (depth - 1) * 0.85) * eliteBoost
  const gap = kind === 'elite' ? 0.62 : 0.78
  const bump = kind === 'elite' ? 1 : 0

  // Tier climbs every ~3 depths; elites add a tier.
  const torchTier = clampTier(1 + Math.floor((depth - 1) / 3) + bump)
  const tntTier = clampTier(1 + Math.floor(depth / 3) + bump)
  const barrelTier = clampTier(1 + Math.floor((depth - 1) / 3) + bump)

  const torches = 5 + Math.round(depth * 2.4) + (kind === 'elite' ? 4 : 0)
  const tnts = depth >= 2 ? depth + 1 : 0
  const barrels = (depth >= 3 ? Math.floor((depth - 2) / 1.5) : 0) + (kind === 'elite' ? 2 : 0)
  const heavyBarrels = (depth >= 6 ? Math.floor((depth - 5) / 1.5) : 0) + (kind === 'elite' && depth >= 4 ? 1 : 0)

  const spawns: SpawnEvent[] = []
  let t = 0
  const push = (typeId: string, count: number, g: number) => {
    for (let i = 0; i < count; i++) {
      spawns.push({ typeId, at: t, hpMult })
      t += g
    }
  }
  push(`torch${torchTier}`, torches, gap)
  if (tnts) { t += 1.2; push(`tnt${tntTier}`, tnts, gap * 0.8) }
  if (barrels) { t += 1.4; push(`barrel${barrelTier}`, barrels, gap * 2) }
  if (heavyBarrels) { t += 1.6; push(`barrel${clampTier(barrelTier + 1)}`, heavyBarrels, gap * 2.4) }

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
    spawns.push({ typeId: i % 3 === 0 ? 'barrel3' : i % 2 === 0 ? 'tnt3' : 'torch3', at: i * 0.6, hpMult: 2.2 })
  }
  spawns.push({ typeId: 'torch5', at: 4, hpMult: 1 })
  spawns.push({ typeId: 'barrel5', at: 12, hpMult: 1 })
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
