import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWorker } from '../build/pwa'

/*
 * Lane 4.6: a navigation gets NAV_TIMEOUT_MS on the network, then the cached
 * shell. The real worker (the template, rendered the way the build renders
 * it) runs here against a fake `self`, `caches` and `fetch`, on fake timers.
 */

const ROOT = resolve(import.meta.dirname, '..')
const template = readFileSync(join(ROOT, 'src/sw/sw.template.js'), 'utf8')
const MARK = './assets/index-abc.js'
const SHELL_HTML = `<!doctype html><html><body><div id="root"></div><script type="module" src="${MARK}"></script></body></html>`

type Listener = (e: unknown) => void

function boot(opts: { fetch: (req: unknown) => Promise<Response>; shell: boolean }) {
  const sw = renderWorker(template, { version: 'v1', shellMark: MARK, shellLen: SHELL_HTML.length, critical: ['index.html'], optional: [] })
  const listeners: Record<string, Listener> = {}
  const entries = new Map<string, Response>()
  if (opts.shell) entries.set('./index.html', new Response(SHELL_HTML, { headers: { 'content-type': 'text/html' } }))
  const cache = {
    match: async (k: string) => entries.get(k)?.clone(),
    put: async (k: string, r: Response) => void entries.set(k, r),
    delete: async (k: string) => entries.delete(k),
    add: async () => {},
  }
  const caches = {
    open: async () => cache,
    match: async () => undefined,
    keys: async () => [],
    delete: async () => true,
  }
  const self = {
    registration: { scope: 'https://game.test/' },
    location: { href: 'https://game.test/sw.js', origin: 'https://game.test' },
    addEventListener: (t: string, cb: Listener) => void (listeners[t] = cb),
    clients: { claim: async () => {} },
    skipWaiting: () => {},
  }
  new Function('self', 'caches', 'fetch', sw)(self, caches, opts.fetch)

  /** Dispatch a navigation; returns the response promise and a settled flag. */
  const navigate = () => {
    let responded: Promise<Response> | null = null
    const waits: Promise<unknown>[] = []
    listeners.fetch({
      request: { method: 'GET', url: 'https://game.test/', mode: 'navigate' },
      respondWith: (p: Promise<Response>) => void (responded = p),
      waitUntil: (p: Promise<unknown>) => void waits.push(p),
    })
    const state = { settled: false, response: null as Response | null }
    responded!.then((r) => {
      state.settled = true
      state.response = r
    })
    return { state, waits }
  }
  return { navigate }
}

/** A network that answers when told to (or never). */
function deferredNetwork() {
  let answer!: (r: Response) => void
  let fail!: (e: Error) => void
  const fetch = vi.fn(
    () =>
      new Promise<Response>((res, rej) => {
        answer = res
        fail = rej
      }),
  )
  return { fetch, answer: (body: string) => answer(new Response(body)), fail: () => fail(new TypeError('Failed to fetch')) }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('the navigation deadline', () => {
  it('a prompt network answer is served as before', async () => {
    const net = deferredNetwork()
    const { navigate } = boot({ fetch: net.fetch, shell: true })
    const nav = navigate()
    net.answer('fresh')
    await vi.advanceTimersByTimeAsync(0)
    expect(nav.state.settled).toBe(true)
    expect(await nav.state.response!.text()).toBe('fresh')
  })

  it('a slow network gets four seconds, then the cached shell answers', async () => {
    const net = deferredNetwork()
    const { navigate } = boot({ fetch: net.fetch, shell: true })
    const nav = navigate()
    await vi.advanceTimersByTimeAsync(3999)
    expect(nav.state.settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(nav.state.settled).toBe(true)
    expect(await nav.state.response!.text()).toBe(SHELL_HTML)
    // The late answer still lands (and the worker is kept alive for it).
    expect(nav.waits).toHaveLength(1)
    net.answer('late')
    await vi.advanceTimersByTimeAsync(0)
    await expect(nav.waits[0]).resolves.toBeDefined()
  })

  it('with no cached shell (a first visit), it keeps waiting on the network', async () => {
    const net = deferredNetwork()
    const { navigate } = boot({ fetch: net.fetch, shell: false })
    const nav = navigate()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(nav.state.settled).toBe(false)
    net.answer('eventually')
    await vi.advanceTimersByTimeAsync(0)
    expect(await nav.state.response!.text()).toBe('eventually')
  })

  it('offline falls back to the cached shell at once, without waiting out the timer', async () => {
    const net = deferredNetwork()
    const { navigate } = boot({ fetch: net.fetch, shell: true })
    const nav = navigate()
    net.fail()
    await vi.advanceTimersByTimeAsync(0)
    expect(nav.state.settled).toBe(true)
    expect(await nav.state.response!.text()).toBe(SHELL_HTML)
  })

  it('offline with no shell is a network error, as before', async () => {
    const net = deferredNetwork()
    const { navigate } = boot({ fetch: net.fetch, shell: false })
    const nav = navigate()
    net.fail()
    await vi.advanceTimersByTimeAsync(0)
    expect(nav.state.response!.type).toBe('error')
  })
})

describe('the update check on return (src/pwa.ts)', () => {
  it('asks at most once per interval, starting one interval after registering', async () => {
    const { updateChecker, UPDATE_CHECK_MS } = await import('../src/pwa')
    expect(UPDATE_CHECK_MS).toBe(30 * 60 * 1000)
    let t = 1_000
    const update = vi.fn(async () => undefined)
    const onVisible = updateChecker({ update } as never, () => t, 1000)
    onVisible() // registering has just checked
    expect(update).not.toHaveBeenCalled()
    t += 999
    onVisible()
    expect(update).not.toHaveBeenCalled()
    t += 1
    onVisible()
    expect(update).toHaveBeenCalledTimes(1)
    onVisible()
    expect(update).toHaveBeenCalledTimes(1)
    t += 1000
    onVisible()
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('a failing check never throws or rejects into the page', async () => {
    const { updateChecker } = await import('../src/pwa')
    let t = 0
    const rejecting = updateChecker({ update: () => Promise.reject(new Error('offline')) } as never, () => t, 1)
    const throwing = updateChecker(
      {
        update: () => {
          throw new Error('InvalidStateError')
        },
      } as never,
      () => t,
      1,
    )
    t = 5
    expect(() => rejecting()).not.toThrow()
    expect(() => throwing()).not.toThrow()
    await vi.advanceTimersByTimeAsync(0)
  })
})
