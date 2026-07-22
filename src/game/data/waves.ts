import type { SpawnEvent, WaveDef } from '../types'

export const TOTAL_WAVES = 8

/**
 * Procedurally build a wave. Difficulty escalates: more enemies, tougher HP,
 * and heavier enemy types appear as the run goes on. Wave 8 is the boss.
 */
export function generateWave(index: number): WaveDef {
  const isBoss = index === TOTAL_WAVES
  if (isBoss) {
    const spawns: SpawnEvent[] = []
    // A stream of chaff escorting the Warden.
    for (let i = 0; i < 12; i++) {
      spawns.push({ typeId: i % 2 === 0 ? 'runner' : 'grunt', at: i * 0.7, hpMult: 2.4 })
    }
    spawns.push({ typeId: 'warden', at: 3, hpMult: 1 })
    return { index, label: `Wave ${index} — The Warden`, spawns, isBoss: true }
  }

  const hpMult = 1 + (index - 1) * 0.28
  const gruntCount = 4 + index * 2
  const runnerCount = index >= 2 ? Math.floor(index * 1.5) : 0
  const bruteCount = index >= 3 ? Math.floor((index - 2) / 1.5) : 0

  const spawns: SpawnEvent[] = []
  let t = 0
  const push = (typeId: string, count: number, gap: number) => {
    for (let i = 0; i < count; i++) {
      spawns.push({ typeId, at: t, hpMult })
      t += gap
    }
  }

  push('grunt', gruntCount, 0.85)
  if (runnerCount) {
    t += 1.5
    push('runner', runnerCount, 0.55)
  }
  if (bruteCount) {
    t += 1.5
    push('brute', bruteCount, 1.8)
  }

  // Sort by spawn time so interleaving reads cleanly.
  spawns.sort((a, b) => a.at - b.at)
  return { index, label: `Wave ${index}`, spawns, isBoss: false }
}

/** Human-readable composition summary for the pre-wave preview. */
export function waveComposition(wave: WaveDef): { typeId: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const s of wave.spawns) counts.set(s.typeId, (counts.get(s.typeId) ?? 0) + 1)
  return [...counts.entries()].map(([typeId, count]) => ({ typeId, count }))
}
