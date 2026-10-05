import { describe, expect, it, vi } from 'vitest'

/*
 * Two tabs share one localStorage. The browser tells a tab about the OTHER
 * tab's writes with a `storage` event; this shim records the listeners the
 * stores install so the test can play the other tab.
 */
const shim = vi.hoisted(() => {
  const data = new Map<string, string>()
  const listeners: ((e: { key: string | null }) => void)[] = []
  ;(globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
      setItem: (k: string, v: string) => void data.set(k, String(v)),
      removeItem: (k: string) => void data.delete(k),
    },
    addEventListener: (type: string, cb: (e: { key: string | null }) => void) => {
      if (type === 'storage') listeners.push(cb)
    },
    removeEventListener: () => {},
  }
  return { data, fire: (key: string | null) => listeners.forEach((cb) => cb({ key })) }
})

import { useMetaStore } from '../src/state/metaStore'
import { useSettingsStore } from '../src/state/settingsStore'

/** What the other tab writes: the same persisted envelope zustand writes. */
function otherTabWrites(key: string, patch: (state: Record<string, unknown>) => void): void {
  const env = JSON.parse(shim.data.get(key)!) as { state: Record<string, unknown>; version: number }
  patch(env.state)
  shim.data.set(key, JSON.stringify(env))
  shim.fire(key)
}

describe('persisted stores follow other tabs', () => {
  it('meta: gold banked in another tab is not overwritten by this one', () => {
    useMetaStore.getState().deposit(5) // this tab saves once
    otherTabWrites('fieldwatch-meta', (s) => {
      s.bank = 500
    })
    expect(useMetaStore.getState().bank).toBe(500)
    useMetaStore.getState().deposit(10) // and a later save builds on it
    const stored = JSON.parse(shim.data.get('fieldwatch-meta')!).state
    expect(stored.bank).toBe(510)
  })

  it('meta: a corrupt write from another tab lands as defaults, not NaN', () => {
    otherTabWrites('fieldwatch-meta', (s) => {
      s.bank = 'lots'
    })
    expect(useMetaStore.getState().bank).toBe(100)
  })

  it('settings: a change in another tab applies here', () => {
    useSettingsStore.setState({ highContrast: false }) // this tab saves once
    otherTabWrites('fieldwatch-settings', (s) => {
      s.highContrast = true
    })
    expect(useSettingsStore.getState().highContrast).toBe(true)
  })

  it('ignores other keys', () => {
    const before = useMetaStore.getState().bank
    shim.data.set('fieldwatch-meta', JSON.stringify({ state: { bank: 999 }, version: 99 }))
    shim.fire('some-other-key')
    expect(useMetaStore.getState().bank).toBe(before)
  })
})
