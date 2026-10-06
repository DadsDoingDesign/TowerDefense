import { describe, expect, it } from 'vitest'
import { balanceVerdict, escapeAnnotation, invariantMode, MAX_ANNOTATIONS } from '../balance/verdict'

// The balance harness takes ~20 minutes, so its ending is held here in
// isolation: what CI's BALANCE_INVARIANTS=warn changes, and what it must not.

describe('invariantMode', () => {
  it('fails by default, so `npm run balance` locally keeps its gate', () => {
    expect(invariantMode({})).toBe('fail')
    expect(invariantMode({ BALANCE_INVARIANTS: '' })).toBe('fail')
    expect(invariantMode({ BALANCE_INVARIANTS: 'off' })).toBe('fail')
  })
  it('warns only on the explicit opt-in', () => {
    expect(invariantMode({ BALANCE_INVARIANTS: 'warn' })).toBe('warn')
    expect(invariantMode({ BALANCE_INVARIANTS: ' WARN ' })).toBe('warn')
  })
})

describe('balanceVerdict', () => {
  const failures = ['Offense spread too wide: 3.4× (>3×).', 'Rarity budget not monotonic: epic ≤ rare.']

  it('passes clean in both modes', () => {
    for (const mode of ['fail', 'warn'] as const) {
      const v = balanceVerdict([], mode)
      expect(v.exitCode).toBe(0)
      expect(v.console).toEqual(['\n✅ All balance invariants passed.'])
    }
    expect(balanceVerdict([], 'fail').stepSummary).toBe('')
    expect(balanceVerdict([], 'warn').stepSummary).toContain('All balance invariants passed')
  })

  it('fail mode exits 1 with the same verdict it always printed, and no annotations', () => {
    const v = balanceVerdict(failures, 'fail')
    expect(v.exitCode).toBe(1)
    expect(v.console).toEqual(['\n❌ 2 invariant(s) failed:', '  - ' + failures[0], '  - ' + failures[1]])
    expect(v.console.some((l) => l.startsWith('::warning'))).toBe(false)
    expect(v.stepSummary).toBe('')
  })

  it('warn mode exits 0, keeps the verdict, and annotates every failure', () => {
    const v = balanceVerdict(failures, 'warn')
    expect(v.exitCode).toBe(0)
    // The same verdict lines lead, so a log reads the same in both modes.
    expect(v.console.slice(0, 3)).toEqual(balanceVerdict(failures, 'fail').console)
    const notes = v.console.filter((l) => l.startsWith('::warning title=Balance invariant::'))
    expect(notes).toHaveLength(2)
    expect(notes[0]).toContain('Offense spread too wide')
    expect(v.stepSummary).toContain('## Balance invariants')
    expect(v.stepSummary).toContain('**2 tuning invariant(s) failed**')
    for (const f of failures) expect(v.stepSummary).toContain(`- ${f}`)
  })

  it('caps the annotations but lists every failure in the summary', () => {
    const many = Array.from({ length: 50 }, (_, i) => `Invariant ${i} failed.`)
    const v = balanceVerdict(many, 'warn')
    expect(v.exitCode).toBe(0)
    const notes = v.console.filter((l) => l.startsWith('::warning'))
    expect(notes).toHaveLength(MAX_ANNOTATIONS + 1)
    expect(notes.at(-1)).toContain(`${50 - MAX_ANNOTATIONS} more`)
    for (const f of many) expect(v.stepSummary).toContain(`- ${f}`)
  })

  it('escapes what would end a workflow command early', () => {
    expect(escapeAnnotation('50% of\nruns\r')).toBe('50%25 of%0Aruns%0D')
    const v = balanceVerdict(['line one\nline two'], 'warn')
    expect(v.console.find((l) => l.startsWith('::warning'))).toBe('::warning title=Balance invariant::line one%0Aline two')
    expect(v.stepSummary).toContain('- line one line two')
  })
})
