/**
 * No two source files may differ only in letter case (`HeroCard.tsx` and
 * `heroCard.ts`). Linux tells them apart, but a Mac's file system does not,
 * so `import './heroCard'` can resolve to the wrong file and the build fails
 * there, which is where the iOS app is built.
 */
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('file names', () => {
  it('no two files differ only in case (extension ignored)', () => {
    const root = join(__dirname, '..')
    const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
    const seen = new Map<string, string>()
    const clashes: string[] = []
    for (const f of files) {
      const key = f.replace(/\.(tsx?|jsx?|mjs|cjs|css)$/, '').toLowerCase()
      const other = seen.get(key)
      if (other && other.replace(/\.[^./]+$/, '') !== f.replace(/\.[^./]+$/, '')) clashes.push(`${other} <-> ${f}`)
      else seen.set(key, f)
    }
    expect(clashes).toEqual([])
  })
})
