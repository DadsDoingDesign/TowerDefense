/**
 * The seasons' hashes (Oct 2026): every seasonal placement and variation is a
 * pure function of position, the field's id and the season — the same on
 * every bake, and never a draw on any run's RNG stream.
 */

/** A per-pixel hash in [0, 1). */
export const hash01 = (x: number, y: number, salt: number): number => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(salt, 2246822519)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** A string's hash (a field's id, a season's name), for a salt. */
export const hashStr = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) % 1000003
}

/** Smooth value noise in [0, 1) at a cell size of `scale` px (two octaves). */
export function valueNoise(x: number, y: number, scale: number, salt: number): number {
  const one = (sx: number, sy: number, s: number): number => {
    const x0 = Math.floor(sx)
    const y0 = Math.floor(sy)
    const fx = sx - x0
    const fy = sy - y0
    const u = fx * fx * (3 - 2 * fx)
    const v = fy * fy * (3 - 2 * fy)
    const a = hash01(x0, y0, s)
    const b = hash01(x0 + 1, y0, s)
    const c = hash01(x0, y0 + 1, s)
    const d = hash01(x0 + 1, y0 + 1, s)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
  return one(x / scale, y / scale, salt) * 0.68 + one((x * 2.3) / scale, (y * 2.3) / scale, salt + 7) * 0.32
}
