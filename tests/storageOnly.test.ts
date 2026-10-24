/**
 * Every save read and write must go through `src/state/storage.ts`.
 *
 * In the iOS app WebKit may clear localStorage when the phone is low on space,
 * so `storage.ts` mirrors every write to native Preferences (`src/native.ts`).
 * Code that calls localStorage directly skips that mirror, and its data can
 * vanish on a phone without anyone noticing on the web.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..', 'src')
const ALLOWED = new Set(['state/storage.ts', 'native.ts'])
const DIRECT = /\b(?:window\.)?(?:localStorage|sessionStorage)\s*\.\s*(?:getItem|setItem|removeItem|clear|key)\s*\(/

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return files(p)
    return /\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

describe('storage access', () => {
  it('only storage.ts and native.ts touch localStorage directly', () => {
    const offenders = files(SRC)
      .map((p) => relative(SRC, p).split('\\').join('/'))
      .filter((rel) => !ALLOWED.has(rel))
      .filter((rel) => DIRECT.test(readFileSync(join(SRC, rel), 'utf8')))
    expect(offenders).toEqual([])
  })
})
