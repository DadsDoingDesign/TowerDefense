import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * Lane 4.5: a refused save is no longer silent. Every write in the app goes
 * through `writeRaw`; these hold what it records when storage refuses, and
 * what `saveHealth` does with it. The storage module keeps per-session state
 * (the probed backing store, the first failure), so each test loads it fresh.
 */

type Win = { localStorage?: unknown; addEventListener?: unknown }
const g = globalThis as { window?: Win }

function fakeStorage(setItem: (k: string, v: string) => void) {
  const data = new Map<string, string>()
  return {
    data,
    store: {
      getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
      setItem: (k: string, v: string) => {
        setItem(k, v)
        data.set(k, v)
      },
      removeItem: (k: string) => void data.delete(k),
    },
  }
}

const quota = () => Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError', code: 22 })

async function freshStorage() {
  vi.resetModules()
  return import('../src/state/storage')
}

let saved: Win | undefined
beforeEach(() => {
  saved = g.window
})
afterEach(() => {
  g.window = saved
})

describe('writeRaw on a refused write', () => {
  it('a working store records nothing', async () => {
    g.window = { localStorage: fakeStorage(() => {}).store }
    const s = await freshStorage()
    expect(s.writeRaw('k', 'v')).toBe(true)
    expect(s.saveFailure()).toBeNull()
  })

  it('blocked storage (the property access throws) is reported as blocked', async () => {
    g.window = {
      get localStorage(): unknown {
        throw new Error('SecurityError: access denied')
      },
    }
    const s = await freshStorage()
    expect(s.writeRaw('fieldwatch-meta', '{}')).toBe(false)
    expect(s.saveFailure()).toEqual({ key: 'fieldwatch-meta', reason: 'blocked' })
  })

  it('private mode (the probe write throws) is reported as blocked', async () => {
    g.window = { localStorage: fakeStorage(() => { throw quota() }).store }
    const s = await freshStorage()
    expect(s.writeRaw('k', 'v')).toBe(false)
    expect(s.saveFailure()?.reason).toBe('blocked')
  })

  it('a full quota after the probe is reported as quota, and never throws', async () => {
    const fs = fakeStorage((k) => {
      if (k !== '__fw_probe__') throw quota()
    })
    g.window = { localStorage: fs.store }
    const s = await freshStorage()
    expect(() => s.writeRaw('fieldwatch-run', 'x')).not.toThrow()
    expect(s.writeRaw('fieldwatch-run', 'x')).toBe(false)
    expect(s.saveFailure()).toEqual({ key: 'fieldwatch-run', reason: 'quota' })
  })

  it("Firefox's legacy quota code counts as quota; anything else is a plain error", async () => {
    g.window = {
      localStorage: fakeStorage((k) => {
        if (k === 'ff') throw Object.assign(new Error('full'), { name: 'NS_ERROR_DOM_QUOTA_REACHED', code: 1014 })
        if (k === 'other') throw new Error('disk on fire')
      }).store,
    }
    let s = await freshStorage()
    s.writeRaw('ff', 'v')
    expect(s.saveFailure()?.reason).toBe('quota')
    s = await freshStorage()
    s.writeRaw('other', 'v')
    expect(s.saveFailure()?.reason).toBe('error')
  })

  it('the zustand adapter no longer swallows the failure', async () => {
    g.window = { localStorage: fakeStorage((k) => { if (k !== '__fw_probe__') throw quota() }).store }
    const s = await freshStorage()
    expect(() => s.safePersistStorage.setItem('fieldwatch-meta', '{"bank":500}')).not.toThrow()
    expect(s.saveFailure()).toEqual({ key: 'fieldwatch-meta', reason: 'quota' })
  })

  it('an unserialisable value is a failed save, not a throw', async () => {
    g.window = { localStorage: fakeStorage(() => {}).store }
    const s = await freshStorage()
    const loop: Record<string, unknown> = {}
    loop.self = loop
    expect(s.writeJson('fieldwatch-run', loop)).toBe(false)
    expect(s.saveFailure()).toEqual({ key: 'fieldwatch-run', reason: 'error' })
  })

  it('announces only the first failure, and replays it to a late listener', async () => {
    g.window = { localStorage: fakeStorage((k) => { if (k !== '__fw_probe__') throw quota() }).store }
    const s = await freshStorage()
    const early = vi.fn()
    s.onSaveFailure(early)
    s.writeRaw('a', '1')
    s.writeRaw('b', '2')
    s.writeRaw('c', '3')
    expect(early).toHaveBeenCalledTimes(1)
    expect(early).toHaveBeenCalledWith({ key: 'a', reason: 'quota' })
    const late = vi.fn()
    s.onSaveFailure(late)
    expect(late).toHaveBeenCalledWith({ key: 'a', reason: 'quota' })
  })

  it("a listener that throws does not break the write's contract", async () => {
    g.window = { localStorage: fakeStorage((k) => { if (k !== '__fw_probe__') throw quota() }).store }
    const s = await freshStorage()
    s.onSaveFailure(() => {
      throw new Error('listener bug')
    })
    expect(() => s.writeRaw('a', '1')).not.toThrow()
  })
})

describe('saveHealth', () => {
  async function freshHealth() {
    vi.resetModules()
    const storage = await import('../src/state/storage')
    const health = await import('../src/state/saveHealth')
    const { useGameStore } = await import('../src/state/gameStore')
    const { useMetaStore } = await import('../src/state/metaStore')
    return { storage, health, useGameStore, useMetaStore }
  }

  it('the copy says what happened and why, in one line', async () => {
    const { health } = await freshHealth()
    for (const r of ['quota', 'blocked', 'error'] as const) {
      const t = health.saveFailedText(r)
      expect(t.startsWith("Progress isn't being saved on this device: ")).toBe(true)
      expect(t).not.toContain('\n')
    }
  })

  it('the first refused write becomes the toast notice, once', async () => {
    g.window = { localStorage: fakeStorage((k) => { if (k !== '__fw_probe__') throw quota() }).store, addEventListener: () => {} }
    const { storage, health, useGameStore } = await freshHealth()
    health.installSaveHealth()
    storage.writeRaw('fieldwatch-meta', '{}')
    const n = useGameStore.getState().gearNotice
    expect(n?.text).toBe(health.saveFailedText('quota'))
    expect(n?.tone).toBe('warn')
    useGameStore.setState({ gearNotice: null }) // the toast spends it
    storage.writeRaw('fieldwatch-meta', '{}')
    expect(useGameStore.getState().gearNotice).toBeNull()
  })

  it('waits behind a notice already in the slot instead of overwriting it', async () => {
    const { health, useGameStore } = await freshHealth()
    useGameStore.setState({ gearNotice: { text: 'Your off-hand went back to the pack', at: 1 } })
    health.postNotice('second')
    expect(useGameStore.getState().gearNotice?.text).toBe('Your off-hand went back to the pack')
    useGameStore.setState({ gearNotice: null })
    expect(useGameStore.getState().gearNotice?.text).toBe('second')
  })

  it('persistent storage: feature-detected, never throws, asked once per session', async () => {
    const { health } = await freshHealth()
    expect(await health.requestPersistentStorage(undefined)).toBeNull()
    health.resetSaveHealthForTests()
    expect(await health.requestPersistentStorage({})).toBeNull()

    health.resetSaveHealthForTests()
    const persist = vi.fn(async () => true)
    expect(await health.requestPersistentStorage({ persist, persisted: async () => true })).toBe(true)
    expect(persist).not.toHaveBeenCalled() // already persistent: no prompt

    health.resetSaveHealthForTests()
    const denied = vi.fn(async () => false)
    const sm = { persist: denied, persisted: async () => false }
    expect(await health.requestPersistentStorage(sm)).toBe(false)
    expect(await health.requestPersistentStorage(sm)).toBe(false)
    expect(denied).toHaveBeenCalledTimes(1)

    health.resetSaveHealthForTests()
    expect(await health.requestPersistentStorage({ persist: () => Promise.reject(new Error('insecure')) })).toBeNull()
    health.resetSaveHealthForTests()
    expect(
      await health.requestPersistentStorage({
        persist: () => {
          throw new Error('sync throw')
        },
      }),
    ).toBeNull()
  })

  it('asks for persistent storage when the first run settles, not at boot', async () => {
    const persist = vi.fn(async () => true)
    const nav = (globalThis as { navigator?: unknown }).navigator
    Object.defineProperty(globalThis, 'navigator', { value: { storage: { persist, persisted: async () => false } }, configurable: true })
    try {
      const { health, useMetaStore } = await freshHealth()
      health.installSaveHealth()
      await Promise.resolve()
      expect(persist).not.toHaveBeenCalled()
      const m = useMetaStore.getState()
      useMetaStore.setState({ stats: { ...m.stats, runsCompleted: m.stats.runsCompleted + 1 } })
      await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(1))
      useMetaStore.setState({ bank: m.bank + 500 })
      await Promise.resolve()
      expect(persist).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true })
    }
  })
})
