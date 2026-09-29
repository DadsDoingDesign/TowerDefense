/**
 * Guarded localStorage (H22).
 *
 * Safari with cookies/site-data blocked THROWS on the mere `window.localStorage`
 * property access, not just on read/write — so any unguarded touch during module
 * init or first render kills the app before it paints. Every raw storage access
 * in the app goes through here; the worst case is a session that simply does not
 * persist, which is a far better failure than a white screen.
 */

let probed = false
let backing: Storage | null = null

/** Resolve the real Storage once, tolerating a throwing property access. */
function store(): Storage | null {
  if (probed) return backing
  probed = true
  try {
    const s = window.localStorage
    // A property that exists but rejects writes (Safari private mode) is not
    // usable storage; find that out here rather than mid-run.
    const probe = '__fw_probe__'
    s.setItem(probe, '1')
    s.removeItem(probe)
    backing = s
  } catch {
    backing = null
  }
  return backing
}

/** True when this browser actually lets us persist anything. */
export const storageAvailable = (): boolean => store() !== null

export function readRaw(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null
  } catch {
    return null
  }
}

/** Returns false when the write was refused (blocked storage, quota) — never throws. */
export function writeRaw(key: string, value: string): boolean {
  try {
    const s = store()
    if (!s) return false
    s.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeRaw(key: string): void {
  try {
    store()?.removeItem(key)
  } catch {
    /* nothing to do — the key is unreachable either way */
  }
}

/** Parse a JSON key, treating corruption as "absent" rather than as an error. */
export function readJson<T>(key: string): T | null {
  const raw = readRaw(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    return writeRaw(key, JSON.stringify(value))
  } catch {
    return false
  }
}

/**
 * A zustand `persist` storage adapter built on the guards above.
 *
 * zustand's own `createJSONStorage` catches the *lookup* of localStorage but not
 * a throwing `setItem`, so a blocked/full Safari would surface the throw inside
 * a `set()` call. This adapter cannot throw, and it treats a corrupted value as
 * missing — which is what keeps a hand-mangled save degrading to defaults
 * instead of crashing (M11).
 */
export const safePersistStorage = {
  getItem: (name: string): string | null => readRaw(name),
  setItem: (name: string, value: string): void => {
    writeRaw(name, value)
  },
  removeItem: (name: string): void => removeRaw(name),
}

// ---------------------------------------------------------------- coercion
// Migrations exist to stop a field that was added later from arriving as
// `undefined` and turning every later `x + n` into a permanent NaN (M11).

/** A finite number or the fallback. Rejects NaN, Infinity, strings, null. */
export function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** A finite number clamped to a range, or the fallback. */
export function clampNum(v: unknown, fallback: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num(v, fallback)))
}

export function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

export function str<T extends string>(v: unknown, fallback: T, allowed: readonly T[]): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

export function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

/** A `Record<string, number>` with every value coerced to a finite number. */
export function numRecord(v: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!v || typeof v !== 'object') return out
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const n = num(val, 0)
    if (n) out[k] = n
  }
  return out
}
