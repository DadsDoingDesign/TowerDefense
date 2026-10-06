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

export function readRaw(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null
  } catch {
    return null
  }
}

// ------------------------------------------------------------ write failures
/*
 * A refused write used to be invisible. `writeRaw` returned false and the
 * zustand adapter below threw the false away, so a full quota or a private
 * window lost the meta bank — every run's savings — with nothing said. Every
 * write in the app comes through `writeRaw`, so this is where a failure is
 * noticed; `state/saveHealth.ts` turns the first one into a notice.
 */

/** Why a write was refused, in the player's terms (see `saveHealth.ts`). */
export type SaveFailReason = 'blocked' | 'quota' | 'error'

export interface SaveFailure {
  key: string
  reason: SaveFailReason
}

let firstFailure: SaveFailure | null = null
const failListeners = new Set<(f: SaveFailure) => void>()

/** Quota errors differ by engine: the DOMException name, or the legacy codes (22, Firefox's 1014). */
function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: unknown; code?: unknown }
  return e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014
}

/** Record a refused write. Only the session's FIRST failure is announced. */
function noteWriteFailure(key: string, reason: SaveFailReason): void {
  if (firstFailure) return
  firstFailure = { key, reason }
  for (const cb of [...failListeners]) {
    try {
      cb(firstFailure)
    } catch {
      /* a listener's own trouble must not turn a failed save into a crash */
    }
  }
}

/** The first write this session that storage refused, or null while every write has landed. */
export const saveFailure = (): SaveFailure | null => firstFailure

/**
 * Hear about the session's first refused write. A failure that already
 * happened (say, during boot, before the listener was installed) is delivered
 * at once. Returns the unsubscribe function.
 */
export function onSaveFailure(cb: (f: SaveFailure) => void): () => void {
  failListeners.add(cb)
  if (firstFailure) cb(firstFailure)
  return () => {
    failListeners.delete(cb)
  }
}

/**
 * Returns false when the write was refused (blocked storage, quota) — never
 * throws. A refusal is recorded for the save notice (`onSaveFailure`).
 */
export function writeRaw(key: string, value: string): boolean {
  try {
    const s = store()
    if (!s) {
      noteWriteFailure(key, 'blocked')
      return false
    }
    s.setItem(key, value)
    return true
  } catch (err) {
    noteWriteFailure(key, isQuotaError(err) ? 'quota' : 'error')
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
  let text: string
  try {
    text = JSON.stringify(value)
  } catch {
    // Unserialisable (a cycle, a BigInt): the save is lost all the same.
    noteWriteFailure(key, 'error')
    return false
  }
  return writeRaw(key, text)
}

/**
 * Run `cb` whenever ANOTHER tab changes `key` (or clears storage).
 *
 * zustand's `persist` reads storage once, at boot, and afterwards only writes.
 * With the game open in two tabs that is a lost update: tab B earns marks and
 * saves, then stale tab A buys a perk and saves its whole old record over B's.
 * The `storage` event is the browser telling us the other write happened — it
 * never fires for this tab's own writes — so a store that rehydrates on it is
 * always writing on top of the latest record rather than its boot-time copy.
 */
export function onStorageKeyChange(key: string, cb: () => void): void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === key || e.key === null) cb()
  })
}

/**
 * A zustand `persist` storage adapter built on the guards above.
 *
 * zustand's own `createJSONStorage` catches the *lookup* of localStorage but not
 * a throwing `setItem`, so a blocked/full Safari would surface the throw inside
 * a `set()` call. This adapter cannot throw, and it treats a corrupted value as
 * missing — which is what keeps a hand-mangled save degrading to defaults
 * instead of crashing (M11).
 *
 * `setItem` has to return void to zustand, which has nothing to do with a
 * refusal anyway; `writeRaw` records it for the save notice instead.
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
